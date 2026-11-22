/**
 * `npm run db:import-json [path/to/db.json]` — one-way, idempotent import of the BriefRoom 1.x
 * JSON store into Postgres. The JSON file and the uploads folder are only READ, never modified.
 *
 * Preserved: shop/order IDs, customer links (customer keys), seller dashboard keys (re-hashed),
 * Nexconn user IDs and group channel IDs, reference images (copied into the storage provider),
 * pins → annotations, specs, versions with approvals and change requests.
 * Re-hashed: version fingerprints are recomputed in the v2 canonical format; the 1.x fingerprint
 * is recorded in the version note so old printed work orders can still be matched.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { HASH_ALGORITHM, SNAPSHOT_SCHEMA, normaliseSnapshot, type BriefSnapshot } from '../../shared/snapshot.ts';
import { TEMPLATES, templateFor } from '../../shared/templates.ts';
import type { AnnotationKind, Role, Spec } from '../../shared/types.ts';
import { loadConfig } from '../config.ts';
import { sanitizeSpec } from '../domain/service.ts';
import { hashKey, hashSnapshot, rid } from '../domain/util.ts';
import { inspectImage } from '../storage/image.ts';
import { createStorage, referenceKey } from '../storage/provider.ts';
import { connectPglite, connectPostgres } from './client.ts';
import { annotations, approvals, briefVersions, domainEvents, nexconnChannels, orders, participants, referenceImages, shops, specifications } from './schema.ts';

interface LegacyRef { id: string; url: string; caption: string; by: Role; at: number; fromChat?: boolean }
interface LegacyPin { id: string; n: number; refId: string; x: number; y: number; w: number; h: number; kind: string; note: string; color?: string; by: Role; at: number; resolved: boolean }
interface LegacyContent { refs: LegacyRef[]; pins: LegacyPin[]; spec: Spec }
interface LegacyVersion { n: number; snapshot: LegacyContent; hash: string; proposedBy: Role; proposedAt: number; note: string; approvals: Partial<Record<Role, number>>; changeRequest?: { by: Role; reason: string; at: number } }
interface LegacyOrder { id: string; shopId: string; template: string; title: string; customerName: string; customerUserId: string; customerKey: string; channelId: string; createdAt: number; updatedAt: number; draft: LegacyContent; versions: LegacyVersion[]; agreedVersion: number | null; pinCounter: number }
interface LegacyShop { id: string; name: string; owner: string; category: string; city: string; sellerUserId: string; sellerKey: string; createdAt: number }
interface LegacyDb { shops: Record<string, LegacyShop>; orders: Record<string, LegacyOrder> }

/** Like sanitizeSpec, but skips (and reports) individual legacy values that no longer validate. */
function lenientSpec(template: string, raw: Spec, orderId: string): Spec {
  const out: Spec = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    try {
      Object.assign(out, sanitizeSpec(template, 'seller', { [k]: v }));
    } catch (e) {
      console.warn(`[import] order ${orderId}: skipped spec field "${k}" (${(e as Error).message})`);
    }
  }
  return out;
}

const KIND_MAP: Record<string, AnnotationKind> = { keep: 'keep', change: 'change', colour: 'colour', remove: 'remove', text: 'add', question: 'question' };

const { config } = loadConfig();
const file = resolve(process.argv[2] ?? join(config.dataDir, 'db.json'));
if (!existsSync(file)) {
  console.error(`[import] No legacy store at ${file}. Pass the path: npm run db:import-json -- path/to/db.json`);
  process.exit(1);
}
const legacy = JSON.parse(readFileSync(file, 'utf8')) as LegacyDb;
const uploadsDir = join(resolve(file, '..'), 'uploads');
const handle = config.database.url ? await connectPostgres(config.database.url, config.database.migrationUrl) : await connectPglite(config.database.embeddedDir);
if ((await handle.pendingMigrations()) > 0) {
  console.error('[import] Run `npm run db:migrate` first.');
  process.exit(1);
}
const db = handle.db;
const storage = createStorage(config);
const stats = { shops: 0, orders: 0, refs: 0, refsMissing: 0, pins: 0, versions: 0, skipped: 0 };

for (const s of Object.values(legacy.shops ?? {})) {
  const [exists] = await db.select({ id: shops.id }).from(shops).where(eq(shops.id, s.id));
  if (exists) {
    stats.skipped++;
    continue;
  }
  await db.insert(shops).values({ id: s.id, name: s.name, ownerName: s.owner, category: TEMPLATES[s.category] ? s.category : 'cake', city: s.city ?? '', sellerUserId: s.sellerUserId, sellerKeyHash: hashKey(s.sellerKey), createdAt: new Date(s.createdAt) });
  stats.shops++;
}

for (const o of Object.values(legacy.orders ?? {})) {
  const [exists] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, o.id));
  const shop = legacy.shops[o.shopId];
  if (exists || !shop) {
    stats.skipped++;
    continue;
  }
  // 1. Copy every image the draft or any version references (bytes are validated like new uploads).
  const allRefs = new Map<string, LegacyRef>();
  for (const c of [o.draft, ...o.versions.map((v) => v.snapshot)]) for (const r of c.refs) allRefs.set(r.id, r);
  const refInfo = new Map<string, { key: string; sha256: string; width: number; height: number; mimeType: string; byteSize: number }>();
  for (const r of allRefs.values()) {
    const local = r.url.startsWith('/uploads/') ? join(uploadsDir, r.url.slice('/uploads/'.length)) : null;
    if (!local || !existsSync(local)) {
      console.warn(`[import] order ${o.id}: reference ${r.id} (${r.url}) not found locally — kept out of the import, listed here so nothing is silently lost.`);
      stats.refsMissing++;
      continue;
    }
    const buf = readFileSync(local);
    const info = inspectImage(buf);
    const key = referenceKey(o.id, r.id, info.sha256, info.extension);
    await storage.put(key, buf, info.mimeType);
    refInfo.set(r.id, { key, sha256: info.sha256, width: info.width, height: info.height, mimeType: info.mimeType, byteSize: info.byteSize });
  }

  const toSnapshot = (c: LegacyContent): BriefSnapshot =>
    normaliseSnapshot({
      schema: SNAPSHOT_SCHEMA,
      order: { id: o.id, shopId: o.shopId, template: o.template, title: o.title },
      references: c.refs.filter((r) => refInfo.has(r.id)).map((r) => ({ id: r.id, sha256: refInfo.get(r.id)!.sha256, width: refInfo.get(r.id)!.width, height: refInfo.get(r.id)!.height, mimeType: refInfo.get(r.id)!.mimeType, caption: r.caption ?? '' })),
      annotations: c.pins
        .filter((p) => refInfo.has(p.refId))
        .map((p) => ({ id: p.id, number: p.n, referenceId: p.refId, kind: KIND_MAP[p.kind] ?? 'change', shape: 'rect' as const, x: p.x, y: p.y, w: p.w, h: p.h, color: p.color ?? null, note: p.note ?? '', status: p.resolved ? ('resolved' as const) : ('open' as const) })),
      spec: lenientSpec(o.template, c.spec ?? {}, o.id),
      clarifications: [],
    });

  await db.transaction(async (tx) => {
    const latest = o.versions.at(-1);
    const status = o.agreedVersion ? 'agreed' : latest ? (latest.changeRequest ? 'changes_requested' : 'awaiting_approval') : 'collecting';
    await tx.insert(orders).values({ id: o.id, shopId: o.shopId, template: templateFor(o.template).id, title: o.title, status, customerKey: o.customerKey, createdByRole: 'seller', annotationSeq: o.pinCounter, createdAt: new Date(o.createdAt), updatedAt: new Date(o.updatedAt) });
    await tx.insert(participants).values([
      { id: rid(), orderId: o.id, role: 'seller', displayName: `${shop.owner} · ${shop.name}`, nexconnUserId: shop.sellerUserId },
      { id: rid(), orderId: o.id, role: 'customer', displayName: o.customerName, nexconnUserId: o.customerUserId },
    ]);
    // The 1.x app created this group already; ensureChannel treats "already exists" (25409) as success.
    await tx.insert(nexconnChannels).values({ orderId: o.id, channelId: o.channelId, ownerUserId: shop.sellerUserId, memberUserIds: [o.customerUserId] });
    let position = 0;
    const draftRefIds = new Set(o.draft.refs.map((r) => r.id));
    for (const r of allRefs.values()) {
      const info = refInfo.get(r.id);
      if (!info) continue;
      await tx.insert(referenceImages).values({
        id: r.id, orderId: o.id, position: ++position, storageProvider: storage.name, storageKey: info.key, mimeType: info.mimeType, width: info.width, height: info.height, byteSize: info.byteSize, contentSha256: info.sha256,
        caption: r.caption ?? '', source: r.fromChat ? 'chat' : 'upload', createdByRole: r.by === 'seller' ? 'seller' : 'customer', createdAt: new Date(r.at), removedAt: draftRefIds.has(r.id) ? null : new Date(o.updatedAt),
      });
      stats.refs++;
    }
    const draftPinIds = new Set(o.draft.pins.map((p) => p.id));
    const allPins = new Map<string, LegacyPin>();
    for (const c of [...o.versions.map((v) => v.snapshot), o.draft]) for (const p of c.pins) allPins.set(p.id, p);
    for (const p of allPins.values()) {
      if (!refInfo.has(p.refId)) continue;
      await tx.insert(annotations).values({
        id: p.id, orderId: o.id, referenceImageId: p.refId, number: p.n, kind: KIND_MAP[p.kind] ?? 'change', shape: 'rect', x: p.x, y: p.y, w: Math.min(p.w, 1 - p.x), h: Math.min(p.h, 1 - p.y), color: p.color ?? null, note: p.note ?? '',
        status: p.resolved ? 'resolved' : 'open', createdByRole: p.by === 'seller' ? 'seller' : 'customer', createdAt: new Date(p.at), deletedAt: draftPinIds.has(p.id) ? null : new Date(o.updatedAt),
      });
      stats.pins++;
    }
    for (const [fieldKey, value] of Object.entries(lenientSpec(o.template, o.draft.spec ?? {}, o.id))) {
      if (value === '' || (Array.isArray(value) && !value.length)) continue;
      await tx.insert(specifications).values({ orderId: o.id, fieldKey, value, updatedByRole: 'seller' });
    }
    let latestId: string | null = null;
    let agreedId: string | null = null;
    for (const v of o.versions) {
      const snapshot = toSnapshot(v.snapshot);
      const hash = hashSnapshot(snapshot);
      const id = rid();
      const isLatest = v === latest;
      const vStatus = o.agreedVersion === v.n ? 'agreed' : v.changeRequest ? 'changes_requested' : isLatest ? 'proposed' : 'superseded';
      await tx.insert(briefVersions).values({ id, orderId: o.id, number: v.n, snapshot, snapshotHash: hash, hashAlgorithm: HASH_ALGORITHM, proposedByRole: v.proposedBy, note: `${v.note ? `${v.note} · ` : ''}imported from BriefRoom 1.x (legacy fingerprint ${v.hash})`.slice(0, 300), status: vStatus, createdAt: new Date(v.proposedAt) });
      for (const role of ['seller', 'customer'] as const)
        if (v.approvals[role]) await tx.insert(approvals).values({ id: rid(), orderId: o.id, versionId: id, role, decision: 'approved', snapshotHash: hash, createdAt: new Date(v.approvals[role]!) });
      if (v.changeRequest && !v.approvals[v.changeRequest.by])
        await tx.insert(approvals).values({ id: rid(), orderId: o.id, versionId: id, role: v.changeRequest.by, decision: 'changes_requested', snapshotHash: hash, reason: v.changeRequest.reason, createdAt: new Date(v.changeRequest.at) });
      if (isLatest) latestId = id;
      if (o.agreedVersion === v.n) agreedId = id;
      stats.versions++;
    }
    await tx.update(orders).set({ latestVersionId: latestId, agreedVersionId: agreedId, agreedAt: agreedId ? new Date(o.updatedAt) : null }).where(eq(orders.id, o.id));
    await tx.insert(domainEvents).values({ id: crypto.randomUUID(), orderId: o.id, type: 'ORDER_CREATED', actorRole: 'system', entityType: 'order', entityId: o.id, payload: { v: 1, summary: 'Imported from BriefRoom 1.x' }, nexconnStatus: 'skipped', nexconnLastError: 'Imported history is not re-announced in chat' });
  });
  stats.orders++;
}

console.log('[import] done', stats);
await handle.close();
