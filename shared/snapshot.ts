/**
 * Frozen brief snapshots, canonical serialisation and structured diffs.
 *
 * A snapshot is everything both participants agree to: reference image identities and
 * content hashes, annotation geometry and state, the structured specification and
 * clarification outcomes. The SHA-256 of `canonicalJSON(snapshot)` is the version
 * fingerprint. This module is pure (no Node/DOM APIs) so the browser can recompute
 * and verify a fingerprint with WebCrypto.
 */
import { formatValue, isFilled, templateFor, type Field } from './templates.ts';
import type { AnnotationKind, AnnotationShape, AnnotationStatus, ClarificationStatus, SpecValue } from './types.ts';

export const SNAPSHOT_SCHEMA = 'briefroom.snapshot/v2';
export const HASH_ALGORITHM = 'sha256-canonical-json-v2';

export interface SnapshotReference {
  id: string;
  sha256: string;
  width: number;
  height: number;
  mimeType: string;
  caption: string;
}

export interface SnapshotAnnotation {
  id: string;
  number: number;
  referenceId: string;
  kind: AnnotationKind;
  shape: AnnotationShape;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string | null;
  note: string;
  status: AnnotationStatus;
}

export interface SnapshotClarification {
  id: string;
  title: string;
  critical: boolean;
  status: ClarificationStatus;
  resolution: string | null;
}

export interface BriefSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  order: { id: string; shopId: string; template: string; title: string };
  references: SnapshotReference[];
  annotations: SnapshotAnnotation[];
  spec: Record<string, SpecValue>;
  clarifications: SnapshotClarification[];
}

/** Coordinates are stored at 4 decimal places (0.01 % of the image) so serialisation is deterministic. */
export const roundCoord = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;

/** Deterministic JSON: object keys sorted recursively, arrays kept in order, no whitespace. */
export function canonicalJSON(v: unknown): string {
  if (v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`)
      .join(',')}}`;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Non-finite number in snapshot');
  return JSON.stringify(v);
}

/** Normalise a snapshot into its canonical form (sorted collections, rounded geometry, filled spec only). */
export function normaliseSnapshot(s: BriefSnapshot): BriefSnapshot {
  const spec: Record<string, SpecValue> = {};
  for (const k of Object.keys(s.spec).sort()) if (isFilled(s.spec[k])) spec[k] = s.spec[k];
  return {
    schema: SNAPSHOT_SCHEMA,
    order: { id: s.order.id, shopId: s.order.shopId, template: s.order.template, title: s.order.title },
    references: [...s.references],
    annotations: [...s.annotations]
      .sort((a, b) => a.number - b.number)
      .map((a) => ({ ...a, x: roundCoord(a.x), y: roundCoord(a.y), w: roundCoord(a.w), h: roundCoord(a.h), color: a.color ?? null })),
    spec,
    clarifications: [...s.clarifications].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/* ------------------------------------------------------------------ diff */

export type AnnotationChange = 'geometry' | 'kind' | 'note' | 'color' | 'status' | 'reference';

export interface SpecChange {
  key: string;
  label: string;
  group: string;
  role: Field['role'] | null;
  before: string;
  after: string;
}

export interface SnapshotDiff {
  references: { added: SnapshotReference[]; removed: SnapshotReference[] };
  annotations: {
    added: SnapshotAnnotation[];
    removed: SnapshotAnnotation[];
    modified: { before: SnapshotAnnotation; after: SnapshotAnnotation; changes: AnnotationChange[] }[];
  };
  spec: SpecChange[];
  price: { before: number | null; after: number | null } | null;
  delivery: SpecChange[];
  clarifications: { added: SnapshotClarification[]; resolved: SnapshotClarification[] };
  /** Human-readable lines for chat cards and version history. */
  summary: string[];
  isEmpty: boolean;
}

const priceOf = (template: string, spec: Record<string, SpecValue>): number | null => {
  const f = templateFor(template).fields.find((x) => x.role === 'price');
  const v = f ? spec[f.key] : undefined;
  return typeof v === 'number' ? v : null;
};

const sameGeometry = (a: SnapshotAnnotation, b: SnapshotAnnotation) =>
  roundCoord(a.x) === roundCoord(b.x) && roundCoord(a.y) === roundCoord(b.y) && roundCoord(a.w) === roundCoord(b.w) && roundCoord(a.h) === roundCoord(b.h) && a.shape === b.shape;

export function diffSnapshots(prev: BriefSnapshot | null, next: BriefSnapshot): SnapshotDiff {
  const template = templateFor(next.order.template);
  const empty: BriefSnapshot = { ...next, references: [], annotations: [], spec: {}, clarifications: [] };
  const p = prev ?? empty;

  const prevRefs = new Map(p.references.map((r) => [r.id, r]));
  const nextRefs = new Map(next.references.map((r) => [r.id, r]));
  const references = {
    added: next.references.filter((r) => !prevRefs.has(r.id)),
    removed: p.references.filter((r) => !nextRefs.has(r.id)),
  };

  const prevAnn = new Map(p.annotations.map((a) => [a.id, a]));
  const nextAnn = new Map(next.annotations.map((a) => [a.id, a]));
  const added = next.annotations.filter((a) => !prevAnn.has(a.id));
  const removed = p.annotations.filter((a) => !nextAnn.has(a.id));
  const modified: SnapshotDiff['annotations']['modified'] = [];
  for (const after of next.annotations) {
    const before = prevAnn.get(after.id);
    if (!before) continue;
    const changes: AnnotationChange[] = [];
    if (!sameGeometry(before, after)) changes.push('geometry');
    if (before.kind !== after.kind) changes.push('kind');
    if (before.note !== after.note) changes.push('note');
    if ((before.color ?? null) !== (after.color ?? null)) changes.push('color');
    if (before.status !== after.status) changes.push('status');
    if (before.referenceId !== after.referenceId) changes.push('reference');
    if (changes.length) modified.push({ before, after, changes });
  }

  const spec: SpecChange[] = [];
  for (const f of template.fields) {
    const a = formatValue(f, p.spec[f.key]);
    const b = formatValue(f, next.spec[f.key]);
    if (a !== b) spec.push({ key: f.key, label: f.label, group: f.group, role: f.role ?? null, before: a, after: b });
  }
  const pb = prev ? priceOf(p.order.template, p.spec) : null;
  const pa = priceOf(next.order.template, next.spec);
  const price = pb !== pa ? { before: pb, after: pa } : null;
  const delivery = spec.filter((c) => c.role === 'deliveryDate' || c.role === 'deliveryTime' || c.role === 'fulfilment' || c.role === 'address');

  const prevCl = new Map(p.clarifications.map((c) => [c.id, c]));
  const clarifications = {
    added: next.clarifications.filter((c) => !prevCl.has(c.id)),
    resolved: next.clarifications.filter((c) => c.status === 'resolved' && prevCl.get(c.id)?.status !== 'resolved'),
  };

  const summary: string[] = [];
  for (const c of spec) summary.push(c.before === '—' ? `${c.label}: ${c.after}` : `${c.label}: ${c.before} → ${c.after}`);
  for (const a of added) summary.push(`#${a.number} added (${a.kind}${a.note ? `: ${truncate(a.note, 60)}` : ''})`);
  for (const a of removed) summary.push(`#${a.number} removed`);
  for (const m of modified) summary.push(`#${m.after.number} ${m.changes.includes('status') && m.changes.length === 1 ? m.after.status : `changed (${m.changes.join(', ')})`}`);
  if (references.added.length) summary.push(`${references.added.length} reference image${references.added.length > 1 ? 's' : ''} added`);
  if (references.removed.length) summary.push(`${references.removed.length} reference image${references.removed.length > 1 ? 's' : ''} removed`);
  for (const c of clarifications.resolved) summary.push(`Resolved: ${truncate(c.title, 60)}`);

  const isEmpty =
    !references.added.length && !references.removed.length && !added.length && !removed.length && !modified.length && !spec.length && !clarifications.added.length && !clarifications.resolved.length;
  return { references, annotations: { added, removed, modified }, spec, price, delivery, clarifications, summary, isEmpty };
}

export function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
