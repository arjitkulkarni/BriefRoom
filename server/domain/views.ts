/**
 * Row → view mapping, draft snapshots, blockers and event summaries.
 */
import { ANNOTATION_KIND_META, type ActivityView, type AnnotationKind, type AnnotationView, type ApprovalView, type Blocker, type ClarificationView, type CommentView, type DomainEventType, type ReferenceView, type Role, type Spec, type SuggestionView, type VersionView } from '../../shared/types.ts';
import { diffSnapshots, normaliseSnapshot, SNAPSHOT_SCHEMA, truncate, type BriefSnapshot } from '../../shared/snapshot.ts';
import { missingRequired } from '../../shared/templates.ts';
import type { annotations, approvals, briefVersions, clarifications, comments, domainEvents, orders, referenceImages, specifications, suggestions } from '../db/schema.ts';
import { ms, msReq, type AssetSigner } from './util.ts';

export type OrderRow = typeof orders.$inferSelect;
export type RefRow = typeof referenceImages.$inferSelect;
export type AnnRow = typeof annotations.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type ClarRow = typeof clarifications.$inferSelect;
export type SugRow = typeof suggestions.$inferSelect;
export type SpecRow = typeof specifications.$inferSelect;
export type VersionRow = typeof briefVersions.$inferSelect;
export type ApprovalRow = typeof approvals.$inferSelect;
export type EventRow = typeof domainEvents.$inferSelect;

export const specFromRows = (rows: SpecRow[]): Spec => Object.fromEntries(rows.map((r) => [r.fieldKey, r.value]));

export function buildSnapshot(order: Pick<OrderRow, 'id' | 'shopId' | 'template' | 'title'>, refs: RefRow[], anns: AnnRow[], spec: Spec, clars: ClarRow[]): BriefSnapshot {
  const liveRefs = refs.filter((r) => !r.removedAt).sort((a, b) => a.position - b.position);
  const liveRefIds = new Set(liveRefs.map((r) => r.id));
  return normaliseSnapshot({
    schema: SNAPSHOT_SCHEMA,
    order: { id: order.id, shopId: order.shopId, template: order.template, title: order.title },
    references: liveRefs.map((r) => ({ id: r.id, sha256: r.contentSha256, width: r.width, height: r.height, mimeType: r.mimeType, caption: r.caption })),
    annotations: anns
      .filter((a) => !a.deletedAt && liveRefIds.has(a.referenceImageId))
      .map((a) => ({
        id: a.id,
        number: a.number,
        referenceId: a.referenceImageId,
        kind: a.kind as AnnotationKind,
        shape: a.shape as 'rect' | 'point',
        x: a.x,
        y: a.y,
        w: a.w,
        h: a.h,
        color: a.color,
        note: a.note,
        status: a.status as AnnotationView['status'],
      })),
    spec,
    clarifications: clars.map((c) => ({ id: c.id, title: c.title, critical: c.critical, status: c.status as ClarificationView['status'], resolution: c.resolution })),
  });
}

/** What prevents proposing a new version: required fields, critical clarifications, open questions on the image. */
export function computeBlockers(template: string, spec: Spec, clars: ClarRow[], anns: AnnRow[], liveRefIds: Set<string>): Blocker[] {
  const out: Blocker[] = missingRequired(template, spec).map((f) => ({ kind: 'required_field' as const, id: f.key, label: `${f.label} is required` }));
  for (const c of clars) if (c.critical && c.status !== 'resolved') out.push({ kind: 'critical_clarification', id: c.id, label: c.title });
  for (const a of anns)
    if (!a.deletedAt && a.kind === 'question' && a.status !== 'resolved' && liveRefIds.has(a.referenceImageId))
      out.push({ kind: 'open_question', id: a.id, label: `Question #${a.number}${a.note ? `: ${truncate(a.note, 50)}` : ''}` });
  return out;
}

export const commentView = (c: CommentRow, names: Record<Role, string>): CommentView => ({
  id: c.id,
  authorRole: c.authorRole as Role,
  authorName: names[c.authorRole as Role] ?? c.authorRole,
  body: c.body,
  createdAt: msReq(c.createdAt),
});

export function referenceView(r: RefRow, signer: AssetSigner): ReferenceView {
  return {
    id: r.id,
    url: signer.url(r.id),
    width: r.width,
    height: r.height,
    mimeType: r.mimeType,
    sha256: r.contentSha256,
    caption: r.caption,
    source: r.source as ReferenceView['source'],
    createdByRole: r.createdByRole as Role,
    createdAt: msReq(r.createdAt),
    removed: Boolean(r.removedAt),
  };
}

export function annotationView(a: AnnRow, cmts: CommentView[]): AnnotationView {
  return {
    id: a.id,
    number: a.number,
    referenceId: a.referenceImageId,
    kind: a.kind as AnnotationKind,
    shape: a.shape as AnnotationView['shape'],
    x: a.x,
    y: a.y,
    w: a.w,
    h: a.h,
    color: a.color,
    note: a.note,
    status: a.status as AnnotationView['status'],
    resolutionRequestedBy: (a.resolutionRequestedBy as Role) ?? null,
    resolvedBy: (a.resolvedBy as Role) ?? null,
    resolvedAt: ms(a.resolvedAt),
    createdByRole: a.createdByRole as Role,
    createdAt: msReq(a.createdAt),
    updatedAt: msReq(a.updatedAt),
    comments: cmts,
  };
}

export function clarificationView(c: ClarRow, cmts: CommentView[]): ClarificationView {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status as ClarificationView['status'],
    critical: c.critical,
    source: c.source as ClarificationView['source'],
    evidence: c.evidence,
    annotationId: c.annotationId,
    messageId: c.messageId,
    createdByRole: c.createdByRole as Role,
    ownerRole: (c.ownerRole as Role) ?? null,
    resolution: c.resolution,
    resolvedByRole: (c.resolvedByRole as Role) ?? null,
    resolvedAt: ms(c.resolvedAt),
    createdAt: msReq(c.createdAt),
    updatedAt: msReq(c.updatedAt),
    comments: cmts,
  };
}

export const suggestionView = (s: SugRow): SuggestionView => ({
  id: s.id,
  question: s.question,
  category: s.category as SuggestionView['category'],
  evidence: s.evidence,
  source: s.source as SuggestionView['source'],
  status: s.status as SuggestionView['status'],
  clarificationId: s.clarificationId,
  createdAt: msReq(s.createdAt),
});

export function versionViews(rows: VersionRow[], apprs: ApprovalRow[]): VersionView[] {
  const sorted = [...rows].sort((a, b) => a.number - b.number);
  return sorted.map((v, i) => ({
    id: v.id,
    number: v.number,
    snapshot: v.snapshot,
    snapshotHash: v.snapshotHash,
    hashAlgorithm: v.hashAlgorithm,
    proposedByRole: v.proposedByRole as Role,
    note: v.note,
    status: v.status as VersionView['status'],
    createdAt: msReq(v.createdAt),
    approvals: apprs
      .filter((a) => a.versionId === v.id)
      .map(
        (a): ApprovalView => ({ id: a.id, role: a.role as Role, decision: a.decision as ApprovalView['decision'], snapshotHash: a.snapshotHash, reason: a.reason, createdAt: msReq(a.createdAt) }),
      ),
    diff: i === 0 ? null : diffSnapshots(sorted[i - 1].snapshot, v.snapshot),
  }));
}

export const activityView = (e: EventRow): ActivityView => ({
  id: e.id,
  seq: e.seq,
  type: e.type as DomainEventType,
  actorRole: (e.actorRole as ActivityView['actorRole']) ?? null,
  entityType: e.entityType,
  entityId: e.entityId,
  summary: String((e.payload as { summary?: string }).summary ?? e.type),
  createdAt: msReq(e.createdAt),
  nexconnStatus: e.nexconnStatus as ActivityView['nexconnStatus'],
  nexconnMessageId: e.nexconnMessageId,
});

export const kindLabel = (k: string) => ANNOTATION_KIND_META[k as AnnotationKind]?.label ?? k;

export function eventSummary(type: DomainEventType, actor: string, d: Record<string, unknown>): string {
  const n = d.number !== undefined ? `#${d.number}` : '';
  const q = (s: unknown, len = 70) => (s ? `“${truncate(String(s), len)}”` : '');
  switch (type) {
    case 'ORDER_CREATED':
      return `Brief room opened: ${d.title}`;
    case 'REFERENCE_ADDED':
      return `${actor} added a reference image${d.source === 'chat' ? ' from the chat' : ''}`;
    case 'REFERENCE_REMOVED':
      return `${actor} removed a reference image`;
    case 'ANNOTATION_CREATED':
      return `${actor} marked ${n} · ${kindLabel(String(d.kind))}${d.note ? ` ${q(d.note)}` : ''}`;
    case 'ANNOTATION_UPDATED':
      return `${actor} edited ${n}`;
    case 'ANNOTATION_COMMENTED':
      return `${actor} on ${n}: ${q(d.body, 90)}`;
    case 'ANNOTATION_RESOLUTION_REQUESTED':
      return `${actor} asked to resolve ${n}`;
    case 'ANNOTATION_RESOLVED':
      return `${n} resolved · confirmed by ${actor}`;
    case 'ANNOTATION_REOPENED':
      return `${actor} reopened ${n}`;
    case 'ANNOTATION_DELETED':
      return `${actor} removed ${n}`;
    case 'CLARIFICATION_RAISED':
      return `${actor} asked: ${q(d.title, 90)}`;
    case 'CLARIFICATION_COMMENTED':
      return `${actor} replied on ${q(d.title)}`;
    case 'CLARIFICATION_RESOLVED':
      return `Resolved by ${actor}: ${q(d.title)}${d.resolution ? ` → ${q(d.resolution)}` : ''}`;
    case 'CLARIFICATION_REOPENED':
      return `${actor} reopened ${q(d.title)}`;
    case 'SPECIFICATION_UPDATED':
      return `${actor} updated ${d.count} detail${d.count === 1 ? '' : 's'}`;
    case 'VERSION_PROPOSED':
      return `${actor} proposed version ${d.versionNumber}`;
    case 'VERSION_APPROVED':
      return `${actor} approved version ${d.versionNumber}`;
    case 'VERSION_REJECTED':
      return `${actor} requested changes on version ${d.versionNumber}${d.reason ? `: ${q(d.reason)}` : ''}`;
    case 'ORDER_AGREED':
      return `Agreed: both approved version ${d.versionNumber}`;
    case 'ORDER_REOPENED':
      return `${actor} reopened the agreed brief`;
    case 'ORDER_COMPLETED':
      return `${actor} marked the order completed`;
  }
}
