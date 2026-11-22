/**
 * BriefRoom commands — every state change in the product. Each runs inside `core.mutate`
 * (one transaction, order row locked, domain event appended, revision bumped).
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { HASH_ALGORITHM, diffSnapshots, roundCoord, truncate } from '../../shared/snapshot.ts';
import { formatValue, templateFor } from '../../shared/templates.ts';
import { ANNOTATION_KINDS, otherRole, type AnnotationKind, type SuggestionCategory } from '../../shared/types.ts';
import { analyseBrief } from '../ai/analyzer.ts';
import { annotations, approvals, briefVersions, clarifications, comments, orders, referenceImages, specifications, suggestions } from '../db/schema.ts';
import { HttpError } from '../http/errors.ts';
import { inspectImage } from '../storage/image.ts';
import { referenceKey } from '../storage/provider.ts';
import { fetchRemoteImage } from '../storage/remote.ts';
import type { Tx } from '../db/client.ts';
import { sanitizeSpec, VALIDATION, type CoreService, type OrderAccess } from './service.ts';
import { clampText, hashSnapshot, rid } from './util.ts';
import { buildSnapshot, computeBlockers } from './views.ts';

const MAX_REFERENCES = 12;
const CRITICAL_BY_DEFAULT: SuggestionCategory[] = ['missing_size', 'missing_delivery_time', 'conflict', 'unspecified_colour'];

export function createCommands(core: CoreService) {
  const { mutate, assertEditable, cropFor, storage, config } = core;

  /* ================================================================== references */

  async function storeImage(orderId: string, buf: Buffer) {
    const info = inspectImage(buf); // throws on spoofed/unsupported content
    const refId = rid();
    const key = referenceKey(orderId, refId, info.sha256, info.extension);
    await storage.put(key, buf, info.mimeType);
    return { refId, key, info };
  }

  async function addReference({ order, role }: OrderAccess, buf: Buffer, caption: string, source: 'upload' | 'chat' = 'upload') {
    assertEditable(order);
    const { refId, key, info } = await storeImage(order.id, buf);
    try {
      return await mutate(order.id, role, async ({ tx, order: o, emit }) => {
        assertEditable(o);
        const live = await tx.select({ id: referenceImages.id }).from(referenceImages).where(and(eq(referenceImages.orderId, o.id), isNull(referenceImages.removedAt)));
        if (live.length >= MAX_REFERENCES) throw new HttpError(400, `Up to ${MAX_REFERENCES} reference images per brief.`);
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${referenceImages.position}), 0)` }).from(referenceImages).where(eq(referenceImages.orderId, o.id));
        await tx.insert(referenceImages).values({
          id: refId,
          orderId: o.id,
          position: Number(max) + 1,
          storageProvider: storage.name,
          storageKey: key,
          mimeType: info.mimeType,
          width: info.width,
          height: info.height,
          byteSize: info.byteSize,
          contentSha256: info.sha256,
          caption: clampText(caption, 120),
          source,
          createdByRole: role,
        });
        await emit('REFERENCE_ADDED', { type: 'reference', id: refId }, { source }, { focus: { kind: 'reference', id: refId }, crop: { imageUrl: core.signer.url(refId), x: 0, y: 0, w: 1, h: 1 } });
        return { referenceId: refId };
      });
    } catch (e) {
      await storage.delete(key).catch(() => undefined); // don't leave orphaned objects behind
      throw e;
    }
  }

  async function importReference(access: OrderAccess, url: string) {
    const buf = await fetchRemoteImage(url);
    return addReference(access, buf, 'From the chat', 'chat');
  }

  async function removeReference({ order, role }: OrderAccess, refId: string) {
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const [ref] = await tx.select().from(referenceImages).where(and(eq(referenceImages.id, refId), eq(referenceImages.orderId, o.id)));
      if (!ref || ref.removedAt) throw new HttpError(404, 'Reference not found');
      // Soft delete: frozen versions may still show this image; the bytes stay in storage.
      await tx.update(referenceImages).set({ removedAt: new Date() }).where(eq(referenceImages.id, refId));
      await tx.update(annotations).set({ deletedAt: new Date() }).where(and(eq(annotations.referenceImageId, refId), isNull(annotations.deletedAt)));
      await emit('REFERENCE_REMOVED', { type: 'reference', id: refId }, {});
      return { ok: true };
    });
  }

  /* ================================================================== annotations */

  function geometry(input: { shape?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown }) {
    const shape = input.shape === 'point' ? 'point' : 'rect';
    const num = (v: unknown) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new HttpError(400, 'Annotation coordinates must be numbers between 0 and 1 (normalised to the image).');
      return Math.min(1, Math.max(0, n));
    };
    const x = roundCoord(num(input.x));
    const y = roundCoord(num(input.y));
    if (shape === 'point') return { shape, x, y, w: 0, h: 0 } as const;
    const w = roundCoord(Math.min(1 - x, Math.max(0.01, num(input.w))));
    const h = roundCoord(Math.min(1 - y, Math.max(0.01, num(input.h))));
    return { shape, x, y, w, h } as const;
  }

  async function createAnnotation({ order, role }: OrderAccess, input: { referenceId: string; kind: string; note?: string; color?: string | null; shape?: string; x: unknown; y: unknown; w?: unknown; h?: unknown }) {
    if (!(ANNOTATION_KINDS as readonly string[]).includes(input.kind)) throw new HttpError(400, 'Unknown annotation type.');
    const kind = input.kind as AnnotationKind;
    const geo = geometry(input);
    const note = clampText(input.note, 500);
    const color = input.color && VALIDATION.HEX.test(input.color) && VALIDATION.COLOUR_KINDS.has(kind) ? input.color.toLowerCase() : null;
    if (kind === 'question' && !note) throw new HttpError(400, 'Write the question you want to ask about this area.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const [ref] = await tx.select().from(referenceImages).where(and(eq(referenceImages.id, input.referenceId), eq(referenceImages.orderId, o.id), isNull(referenceImages.removedAt)));
      if (!ref) throw new HttpError(400, 'Reference image not found.');
      const number = o.annotationSeq + 1;
      await tx.update(orders).set({ annotationSeq: number }).where(eq(orders.id, o.id));
      const id = rid();
      await tx.insert(annotations).values({ id, orderId: o.id, referenceImageId: ref.id, number, kind, ...geo, color, note, createdByRole: role });
      await emit(
        'ANNOTATION_CREATED',
        { type: 'annotation', id },
        { number, kind, note },
        { focus: { kind: 'annotation', id, number }, crop: cropFor(ref.id, geo), annotation: { kind, note, color, status: 'open' } },
      );
      return { annotationId: id, number };
    });
  }

  async function loadAnnotation(tx: Tx, orderId: string, annId: string) {
    const [a] = await tx.select().from(annotations).where(and(eq(annotations.id, annId), eq(annotations.orderId, orderId), isNull(annotations.deletedAt)));
    if (!a) throw new HttpError(404, 'Annotation not found');
    return a;
  }

  async function updateAnnotation({ order, role }: OrderAccess, annId: string, input: { note?: unknown; kind?: unknown; color?: unknown; shape?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown }) {
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const a = await loadAnnotation(tx, o.id, annId);
      if (a.createdByRole !== role) throw new HttpError(403, 'Only the person who created this annotation can edit it. Reply in its discussion instead.');
      if (a.status === 'resolved') throw new HttpError(409, 'Reopen this annotation before editing it.');
      const patch: Partial<typeof annotations.$inferInsert> = { updatedAt: new Date(), resolutionRequestedBy: null, resolutionRequestedAt: null };
      if (typeof input.note === 'string') patch.note = clampText(input.note, 500);
      if (typeof input.kind === 'string') {
        if (!(ANNOTATION_KINDS as readonly string[]).includes(input.kind)) throw new HttpError(400, 'Unknown annotation type.');
        patch.kind = input.kind;
      }
      const kind = (patch.kind ?? a.kind) as AnnotationKind;
      if (input.color !== undefined) patch.color = typeof input.color === 'string' && VALIDATION.HEX.test(input.color) && VALIDATION.COLOUR_KINDS.has(kind) ? input.color.toLowerCase() : null;
      if (input.x !== undefined) Object.assign(patch, geometry({ shape: input.shape ?? a.shape, x: input.x, y: input.y, w: input.w, h: input.h }));
      await tx.update(annotations).set(patch).where(eq(annotations.id, a.id));
      await emit('ANNOTATION_UPDATED', { type: 'annotation', id: a.id }, { number: a.number }, { focus: { kind: 'annotation', id: a.id, number: a.number } });
      return { ok: true };
    });
  }

  async function deleteAnnotation({ order, role }: OrderAccess, annId: string) {
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const a = await loadAnnotation(tx, o.id, annId);
      if (a.createdByRole !== role) throw new HttpError(403, 'Only the person who created this annotation can remove it.');
      await tx.update(annotations).set({ deletedAt: new Date() }).where(eq(annotations.id, a.id));
      await emit('ANNOTATION_DELETED', { type: 'annotation', id: a.id }, { number: a.number });
      return { ok: true };
    });
  }

  async function commentAnnotation({ order, role }: OrderAccess, annId: string, body: string) {
    const text = clampText(body, 1000);
    if (!text) throw new HttpError(400, 'Write a reply first.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      const a = await loadAnnotation(tx, o.id, annId);
      const id = rid();
      await tx.insert(comments).values({ id, orderId: o.id, subjectType: 'annotation', subjectId: a.id, authorRole: role, body: text });
      if (a.status === 'open') await tx.update(annotations).set({ status: 'discussion', updatedAt: new Date() }).where(eq(annotations.id, a.id));
      await emit(
        'ANNOTATION_COMMENTED',
        { type: 'annotation', id: a.id },
        { number: a.number, body: text },
        { focus: { kind: 'annotation', id: a.id, number: a.number }, crop: cropFor(a.referenceImageId, a), annotation: { kind: a.kind, note: a.note, color: a.color, status: a.status === 'open' ? 'discussion' : a.status } },
      );
      return { commentId: id };
    });
  }

  /** Two-party resolution: one participant requests, the OTHER confirms. */
  async function annotationResolution({ order, role }: OrderAccess, annId: string, action: 'request' | 'confirm' | 'cancel' | 'reopen') {
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      if (action !== 'reopen') assertEditable(o);
      const a = await loadAnnotation(tx, o.id, annId);
      const focus = { focus: { kind: 'annotation' as const, id: a.id, number: a.number } };
      const now = new Date();
      if (action === 'request') {
        if (a.status === 'resolved') throw new HttpError(409, 'Already resolved.');
        if (a.resolutionRequestedBy === role) return { status: a.status, pending: true };
        if (a.resolutionRequestedBy === otherRole(role)) throw new HttpError(409, `The ${otherRole(role)} already asked to resolve this — confirm it instead.`);
        await tx.update(annotations).set({ resolutionRequestedBy: role, resolutionRequestedAt: now, updatedAt: now }).where(eq(annotations.id, a.id));
        await emit('ANNOTATION_RESOLUTION_REQUESTED', { type: 'annotation', id: a.id }, { number: a.number }, focus);
        return { status: a.status, pending: true };
      }
      if (action === 'confirm') {
        if (a.status === 'resolved') return { status: 'resolved', pending: false };
        if (!a.resolutionRequestedBy) throw new HttpError(409, 'Nobody has asked to resolve this yet.');
        if (a.resolutionRequestedBy === role) throw new HttpError(409, `Waiting for the ${otherRole(role)} to confirm.`);
        await tx.update(annotations).set({ status: 'resolved', resolvedBy: role, resolvedAt: now, updatedAt: now }).where(eq(annotations.id, a.id));
        await emit('ANNOTATION_RESOLVED', { type: 'annotation', id: a.id }, { number: a.number }, { ...focus, annotation: { kind: a.kind, note: a.note, color: a.color, status: 'resolved' } });
        return { status: 'resolved', pending: false };
      }
      if (action === 'cancel') {
        if (a.resolutionRequestedBy !== role) throw new HttpError(409, 'There is no pending request of yours to cancel.');
        await tx.update(annotations).set({ resolutionRequestedBy: null, resolutionRequestedAt: null, updatedAt: now }).where(eq(annotations.id, a.id));
        return { status: a.status, pending: false };
      }
      assertEditable(o);
      if (a.status !== 'resolved') throw new HttpError(409, 'This annotation is not resolved.');
      const [{ n }] = await tx.select({ n: sql<number>`count(*)` }).from(comments).where(and(eq(comments.subjectType, 'annotation'), eq(comments.subjectId, a.id)));
      await tx
        .update(annotations)
        .set({ status: Number(n) > 0 ? 'discussion' : 'open', resolvedBy: null, resolvedAt: null, resolutionRequestedBy: null, resolutionRequestedAt: null, updatedAt: now })
        .where(eq(annotations.id, a.id));
      await emit('ANNOTATION_REOPENED', { type: 'annotation', id: a.id }, { number: a.number }, focus);
      return { status: 'open', pending: false };
    });
  }

  /* ================================================================== clarifications */

  async function raiseClarification(
    { order, role }: OrderAccess,
    input: { title: string; description?: string; critical?: boolean; annotationId?: string | null; messageId?: string | null; evidence?: string; source?: 'manual' | 'ai' | 'rules' },
    tx0?: { suggestionId: string },
  ) {
    const title = clampText(input.title, 160);
    if (!title) throw new HttpError(400, 'Write the question first.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      let annotationId: string | null = null;
      if (input.annotationId) {
        const [a] = await tx.select({ id: annotations.id }).from(annotations).where(and(eq(annotations.id, input.annotationId), eq(annotations.orderId, o.id)));
        annotationId = a?.id ?? null;
      }
      const id = rid();
      await tx.insert(clarifications).values({
        id,
        orderId: o.id,
        title,
        description: clampText(input.description, 1000),
        critical: Boolean(input.critical),
        source: input.source ?? 'manual',
        evidence: clampText(input.evidence, 600),
        annotationId,
        messageId: clampText(input.messageId, 100) || null,
        createdByRole: role,
        ownerRole: otherRole(role),
      });
      if (tx0) await tx.update(suggestions).set({ status: 'asked', clarificationId: id, question: title, updatedAt: new Date() }).where(and(eq(suggestions.id, tx0.suggestionId), eq(suggestions.orderId, o.id)));
      await emit('CLARIFICATION_RAISED', { type: 'clarification', id }, { title }, { focus: { kind: 'clarification', id }, lines: input.critical ? ['Critical — blocks the next version until resolved'] : undefined });
      return { clarificationId: id };
    });
  }

  async function loadClarification(tx: Tx, orderId: string, id: string) {
    const [c] = await tx.select().from(clarifications).where(and(eq(clarifications.id, id), eq(clarifications.orderId, orderId)));
    if (!c) throw new HttpError(404, 'Clarification not found');
    return c;
  }

  async function commentClarification({ order, role }: OrderAccess, id: string, body: string) {
    const text = clampText(body, 1000);
    if (!text) throw new HttpError(400, 'Write a reply first.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      const c = await loadClarification(tx, o.id, id);
      const cid = rid();
      await tx.insert(comments).values({ id: cid, orderId: o.id, subjectType: 'clarification', subjectId: c.id, authorRole: role, body: text });
      if (c.status === 'open') await tx.update(clarifications).set({ status: 'discussion', updatedAt: new Date() }).where(eq(clarifications.id, c.id));
      await emit('CLARIFICATION_COMMENTED', { type: 'clarification', id: c.id }, { title: c.title }, { focus: { kind: 'clarification', id: c.id }, lines: [truncate(text, 180)] });
      return { commentId: cid };
    });
  }

  async function updateClarification({ order, role }: OrderAccess, id: string, input: { action: 'resolve' | 'reopen' | 'set_critical'; resolution?: string; critical?: boolean }) {
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      const c = await loadClarification(tx, o.id, id);
      const now = new Date();
      if (input.action === 'resolve') {
        assertEditable(o);
        const resolution = clampText(input.resolution, 500);
        if (!resolution) throw new HttpError(400, 'Write the answer that resolves this — it becomes part of the agreed brief.');
        if (c.status === 'resolved') return { status: 'resolved' };
        await tx.update(clarifications).set({ status: 'resolved', resolution, resolvedByRole: role, resolvedAt: now, updatedAt: now }).where(eq(clarifications.id, c.id));
        await emit('CLARIFICATION_RESOLVED', { type: 'clarification', id: c.id }, { title: c.title, resolution }, { focus: { kind: 'clarification', id: c.id } });
        return { status: 'resolved' };
      }
      if (input.action === 'reopen') {
        assertEditable(o);
        if (c.status !== 'resolved') return { status: c.status };
        await tx.update(clarifications).set({ status: 'discussion', resolution: null, resolvedByRole: null, resolvedAt: null, updatedAt: now }).where(eq(clarifications.id, c.id));
        await emit('CLARIFICATION_REOPENED', { type: 'clarification', id: c.id }, { title: c.title }, { focus: { kind: 'clarification', id: c.id } });
        return { status: 'discussion' };
      }
      assertEditable(o);
      await tx.update(clarifications).set({ critical: Boolean(input.critical), updatedAt: now }).where(eq(clarifications.id, c.id));
      return { status: c.status };
    });
  }

  /* ================================================================== specification */

  async function updateSpec({ order, role }: OrderAccess, patch: Record<string, unknown>) {
    const clean = sanitizeSpec(order.template, role, patch);
    const t = templateFor(order.template);
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const current = await tx.select().from(specifications).where(eq(specifications.orderId, o.id));
      const before = Object.fromEntries(current.map((r) => [r.fieldKey, r.value]));
      const lines: string[] = [];
      for (const [key, value] of Object.entries(clean)) {
        const f = t.fields.find((x) => x.key === key)!;
        const a = formatValue(f, before[key]);
        const b = formatValue(f, value);
        if (a === b) continue;
        lines.push(a === '—' ? `${f.label}: ${b}` : b === '—' ? `${f.label}: cleared (was ${a})` : `${f.label}: ${a} → ${b}`);
        if (b === '—') await tx.delete(specifications).where(and(eq(specifications.orderId, o.id), eq(specifications.fieldKey, key)));
        else
          await tx
            .insert(specifications)
            .values({ orderId: o.id, fieldKey: key, value, updatedByRole: role })
            .onConflictDoUpdate({ target: [specifications.orderId, specifications.fieldKey], set: { value, updatedByRole: role, updatedAt: new Date() } });
      }
      if (lines.length) await emit('SPECIFICATION_UPDATED', { type: 'spec', id: o.id }, { count: lines.length }, { focus: { kind: 'spec', id: o.id }, lines: lines.slice(0, 12).map((l) => truncate(l, 200)) });
      return { changes: lines };
    });
  }

  /* ================================================================== AI / rules analysis */

  async function analyse({ order, role }: OrderAccess, messages: { id: string; text: string }[]) {
    const parts = await core.loadDraftParts(core.db, order.id);
    const result = await analyseBrief(
      {
        template: order.template,
        spec: parts.spec,
        annotations: parts.anns
          .filter((a) => parts.refs.some((r) => r.id === a.referenceImageId && !r.removedAt))
          .map((a) => ({ id: a.id, number: a.number, kind: a.kind as AnnotationKind, note: a.note, color: a.color, status: a.status, x: a.x, y: a.y, w: a.w, h: a.h, referenceId: a.referenceImageId })),
        clarifications: parts.clars.map((c) => ({ id: c.id, title: c.title, status: c.status })),
        messages: messages.slice(-60).map((m) => ({ id: clampText(m.id, 100), text: clampText(m.text, 2000) })),
        today: new Date().toISOString().slice(0, 10),
      },
      config.ai,
    );
    // Short write: keep asked/dismissed history; replace stale open suggestions with the fresh set.
    await core.db.transaction(async (tx) => {
      const existing = await tx.select().from(suggestions).where(eq(suggestions.orderId, order.id));
      const fresh = new Set(result.suggestions.map((s) => s.fingerprint));
      const stale = existing.filter((s) => s.status === 'suggested' && !fresh.has(s.fingerprint)).map((s) => s.id);
      if (stale.length) await tx.delete(suggestions).where(inArray(suggestions.id, stale));
      const known = new Set(existing.map((s) => s.fingerprint));
      const rows = result.suggestions
        .filter((s) => !known.has(s.fingerprint))
        .map((s) => ({ id: rid(), orderId: order.id, fingerprint: s.fingerprint, question: s.question, category: s.category, evidence: s.evidence, source: s.source }));
      if (rows.length) await tx.insert(suggestions).values(rows).onConflictDoNothing();
    });
    void role;
    return { provider: result.provider, aiError: result.aiError, count: result.suggestions.length };
  }

  async function suggestionAction(access: OrderAccess, id: string, input: { action: 'ask' | 'dismiss'; question?: string; critical?: boolean }) {
    const [s] = await core.db.select().from(suggestions).where(and(eq(suggestions.id, id), eq(suggestions.orderId, access.order.id)));
    if (!s) throw new HttpError(404, 'Suggestion not found');
    if (input.action === 'dismiss') {
      await core.db.update(suggestions).set({ status: 'dismissed', updatedAt: new Date() }).where(eq(suggestions.id, s.id));
      return { status: 'dismissed' as const };
    }
    if (s.status === 'asked' && s.clarificationId) return { status: 'asked' as const, clarificationId: s.clarificationId };
    const evidence = s.evidence;
    const r = await raiseClarification(
      access,
      {
        title: clampText(input.question, 160) || s.question,
        critical: input.critical ?? CRITICAL_BY_DEFAULT.includes(s.category as SuggestionCategory),
        source: s.source as 'ai' | 'rules',
        evidence: evidence.map((e) => `“${e.quote}”`).join(' · '),
        annotationId: evidence.find((e) => e.kind === 'annotation')?.ref ?? null,
        messageId: evidence.find((e) => e.kind === 'message')?.ref ?? null,
      },
      { suggestionId: s.id },
    );
    return { status: 'asked' as const, clarificationId: r.clarificationId };
  }

  /* ================================================================== versions & the agreement engine */

  async function proposeVersion({ order, role }: OrderAccess, noteRaw: string) {
    const note = clampText(noteRaw, 300);
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      assertEditable(o);
      const parts = await core.loadDraftParts(tx, o.id);
      const liveRefIds = new Set(parts.refs.filter((r) => !r.removedAt).map((r) => r.id));
      const blockers = computeBlockers(o.template, parts.spec, parts.clars, parts.anns, liveRefIds);
      if (blockers.length) throw new HttpError(422, `Resolve ${blockers.length} item${blockers.length > 1 ? 's' : ''} before proposing a version.`, { blockers });
      if (!liveRefIds.size) throw new HttpError(422, 'Add at least one reference image before proposing a version.', { blockers: [] });
      const snapshot = buildSnapshot(o, parts.refs, parts.anns, parts.spec, parts.clars);
      const hash = hashSnapshot(snapshot);
      const [latest] = o.latestVersionId ? await tx.select().from(briefVersions).where(eq(briefVersions.id, o.latestVersionId)) : [];
      if (latest && latest.snapshotHash === hash && latest.status === 'proposed') {
        if (latest.proposedByRole === role) return { versionId: latest.id, number: latest.number, snapshotHash: hash, replayed: true };
        throw new HttpError(409, `Version ${latest.number} already contains exactly this brief — review and approve it instead.`);
      }
      if (latest?.status === 'proposed') await tx.update(briefVersions).set({ status: 'superseded' }).where(eq(briefVersions.id, latest.id));
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${briefVersions.number}), 0)` }).from(briefVersions).where(eq(briefVersions.orderId, o.id));
      const number = Number(max) + 1;
      const id = rid();
      await tx.insert(briefVersions).values({ id, orderId: o.id, number, snapshot, snapshotHash: hash, hashAlgorithm: HASH_ALGORITHM, proposedByRole: role, note });
      await tx.update(orders).set({ latestVersionId: id, status: 'awaiting_approval' }).where(eq(orders.id, o.id));
      const diff = diffSnapshots(latest?.snapshot ?? null, snapshot);
      const priceField = templateFor(o.template).fields.find((f) => f.role === 'price');
      const price = priceField ? formatValue(priceField, snapshot.spec[priceField.key]) : '';
      await emit(
        'VERSION_PROPOSED',
        { type: 'version', id, versionId: id },
        { versionNumber: number },
        {
          focus: { kind: 'version', id, number },
          versionNumber: number,
          snapshotHash: hash,
          lines: [...(price && price !== '—' ? [`Price ${price}`] : []), ...(note ? [`“${truncate(note, 150)}”`] : []), ...diff.summary.slice(0, 8).map((l) => truncate(l, 180))],
        },
      );
      return { versionId: id, number, snapshotHash: hash, replayed: false };
    });
  }

  /**
   * The trust engine. Binds a decision to (order ID, version ID, snapshot hash).
   * Serialised by the order row lock taken in `mutate`; the order becomes AGREED only when
   * both roles have approved the SAME version with the SAME hash, inside this transaction.
   */
  async function decideVersion({ order, role }: OrderAccess, versionId: string, input: { decision: 'approved' | 'changes_requested'; snapshotHash: string; reason?: string; idempotencyKey?: string }) {
    const reason = clampText(input.reason, 500);
    const idem = clampText(input.idempotencyKey, 100) || null;
    if (input.decision === 'changes_requested' && !reason) throw new HttpError(400, 'Tell the other side what should change.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      if (idem) {
        const [prior] = await tx.select().from(approvals).where(and(eq(approvals.orderId, o.id), eq(approvals.idempotencyKey, idem)));
        if (prior) {
          if (prior.versionId !== versionId || prior.role !== role || prior.decision !== input.decision) throw new HttpError(409, 'This request key was already used for a different decision.');
          return { decision: prior.decision, agreed: o.agreedVersionId === versionId, replayed: true };
        }
      }
      const [version] = await tx.select().from(briefVersions).where(and(eq(briefVersions.id, versionId), eq(briefVersions.orderId, o.id)));
      if (!version) throw new HttpError(404, 'Version not found for this order.');
      const [mine] = await tx.select().from(approvals).where(and(eq(approvals.versionId, version.id), eq(approvals.role, role)));
      if (mine) {
        if (mine.decision === input.decision) return { decision: mine.decision, agreed: o.agreedVersionId === version.id, replayed: true };
        throw new HttpError(409, `You already ${mine.decision === 'approved' ? 'approved' : 'requested changes on'} version ${version.number}.`);
      }
      if (o.status === 'agreed' || o.status === 'completed') throw new HttpError(409, 'This order is already agreed.');
      if (o.latestVersionId !== version.id) throw new HttpError(409, `Version ${version.number} is no longer current — review the latest version.`);
      if (version.status !== 'proposed') throw new HttpError(409, `Version ${version.number} is ${version.status.replace('_', ' ')} and can no longer be decided.`);
      if (input.snapshotHash !== version.snapshotHash)
        throw new HttpError(409, 'The version you reviewed does not match the stored fingerprint. Reload and review it again.', { expected: version.snapshotHash });

      await tx.insert(approvals).values({ id: rid(), orderId: o.id, versionId: version.id, role, decision: input.decision, snapshotHash: version.snapshotHash, reason, idempotencyKey: idem });
      const base = { focus: { kind: 'version' as const, id: version.id, number: version.number }, versionNumber: version.number, snapshotHash: version.snapshotHash };

      if (input.decision === 'changes_requested') {
        await tx.update(briefVersions).set({ status: 'changes_requested' }).where(eq(briefVersions.id, version.id));
        await tx.update(orders).set({ status: 'changes_requested' }).where(eq(orders.id, o.id));
        await emit('VERSION_REJECTED', { type: 'version', id: version.id, versionId: version.id }, { versionNumber: version.number, reason }, { ...base, decision: 'changes_requested', lines: [truncate(reason, 200)] });
        return { decision: input.decision, agreed: false, replayed: false };
      }

      await emit('VERSION_APPROVED', { type: 'version', id: version.id, versionId: version.id }, { versionNumber: version.number }, { ...base, decision: 'approved' });
      const approvedBy = await tx
        .select({ role: approvals.role })
        .from(approvals)
        .where(and(eq(approvals.versionId, version.id), eq(approvals.decision, 'approved'), eq(approvals.snapshotHash, version.snapshotHash)));
      const roles = new Set(approvedBy.map((a) => a.role));
      const agreed = roles.has('seller') && roles.has('customer');
      if (agreed) {
        const now = new Date();
        await tx.update(briefVersions).set({ status: 'agreed' }).where(eq(briefVersions.id, version.id));
        await tx.update(orders).set({ status: 'agreed', agreedVersionId: version.id, agreedAt: now }).where(eq(orders.id, o.id));
        await emit('ORDER_AGREED', { type: 'version', id: version.id, versionId: version.id }, { versionNumber: version.number }, { ...base, lines: [`Fingerprint ${version.snapshotHash.slice(0, 16)}…`] });
      }
      return { decision: input.decision, agreed, replayed: false };
    });
  }

  async function reopenOrder({ order, role }: OrderAccess) {
    if (role !== 'seller') throw new HttpError(403, 'Only the seller can reopen an agreed brief.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      if (o.status !== 'agreed') throw new HttpError(409, 'Only an agreed (not completed) order can be reopened.');
      // The agreed version stays immutable and on record; the next change becomes a new version.
      await tx.update(orders).set({ status: 'collecting', agreedVersionId: null, agreedAt: null }).where(eq(orders.id, o.id));
      await emit('ORDER_REOPENED', { type: 'order', id: o.id }, {}, { focus: { kind: 'order', id: o.id } });
      return { ok: true };
    });
  }

  async function completeOrder({ order, role }: OrderAccess) {
    if (role !== 'seller') throw new HttpError(403, 'Only the seller can mark an order completed.');
    return mutate(order.id, role, async ({ tx, order: o, emit }) => {
      if (o.status !== 'agreed') throw new HttpError(409, 'Only an agreed order can be marked completed.');
      await tx.update(orders).set({ status: 'completed', completedAt: new Date() }).where(eq(orders.id, o.id));
      await emit('ORDER_COMPLETED', { type: 'order', id: o.id }, {}, { focus: { kind: 'order', id: o.id } });
      return { ok: true };
    });
  }

  return {
    addReference,
    importReference,
    removeReference,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    commentAnnotation,
    annotationResolution,
    raiseClarification,
    commentClarification,
    updateClarification,
    updateSpec,
    analyse,
    suggestionAction,
    proposeVersion,
    decideVersion,
    reopenOrder,
    completeOrder,
  };
}

export type Commands = ReturnType<typeof createCommands>;
