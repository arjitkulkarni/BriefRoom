/**
 * Brief engine: draft -> frozen, hashed versions -> dual approval of the SAME version.
 */
import { createHash, randomBytes } from 'node:crypto';
import { templateFor } from '../shared/templates.ts';
import {
  canonicalJSON,
  diffBriefs,
  missingRequired,
  type BriefContent,
  type OrderStatus,
  type OrderSummary,
  type OrderView,
  type Role,
  type Spec,
  type Version,
} from '../shared/types.ts';
import { db, type OrderRecord } from './store.ts';

export const rid = (bytes = 5) => randomBytes(bytes).toString('hex');

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function hashBrief(order: OrderRecord, content: BriefContent): string {
  return createHash('sha256').update(canonicalJSON({ order: order.id, template: order.template, content })).digest('hex');
}

export const latest = (o: OrderRecord): Version | null => o.versions[o.versions.length - 1] ?? null;

export function statusOf(o: OrderRecord): OrderStatus {
  if (o.agreedVersion !== null) return 'agreed';
  const v = latest(o);
  if (!v) return 'draft';
  if (v.changeRequest) return 'changes';
  return 'proposed';
}

export function toView(o: OrderRecord, role: Role): OrderView {
  const shop = db.shops[o.shopId];
  const v = latest(o);
  return {
    id: o.id,
    shopId: o.shopId,
    shopName: shop?.name ?? 'Shop',
    template: o.template,
    title: o.title,
    customerName: o.customerName,
    customerUserId: o.customerUserId,
    sellerUserId: shop?.sellerUserId ?? '',
    channelId: o.channelId,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    draft: o.draft,
    versions: o.versions,
    agreedVersion: o.agreedVersion,
    status: statusOf(o),
    draftDirty: !v || hashBrief(o, o.draft) !== v.hash,
    role,
    ...(role === 'seller' ? { inviteKey: o.customerKey } : {}),
  };
}

export function toSummary(o: OrderRecord): OrderSummary {
  const v = latest(o);
  const spec = (o.agreedVersion ? o.versions[o.agreedVersion - 1]?.snapshot.spec : v?.snapshot.spec) ?? o.draft.spec;
  return {
    id: o.id,
    title: o.title,
    template: o.template,
    customerName: o.customerName,
    status: statusOf(o),
    latestVersion: v?.n ?? 0,
    price: typeof spec.price === 'number' ? spec.price : null,
    deliveryDate: typeof spec.deliveryDate === 'string' ? spec.deliveryDate : null,
    updatedAt: o.updatedAt,
    pins: o.draft.pins.length,
    refs: o.draft.refs.length,
  };
}

export function roleFor(o: OrderRecord, key: string | undefined): Role | null {
  if (!key) return null;
  if (key === o.customerKey) return 'customer';
  if (key === db.shops[o.shopId]?.sellerKey) return 'seller';
  return null;
}

export function assertEditable(o: OrderRecord) {
  if (o.agreedVersion !== null) throw new HttpError(409, 'This brief is agreed and locked. The seller can reopen it if something must change.');
}

/** Keep only known template fields, coerce types, enforce seller-only fields. */
export function sanitizeSpec(o: OrderRecord, role: Role, patch: Record<string, unknown>): Spec {
  const t = templateFor(o.template);
  const out: Spec = {};
  for (const f of t.fields) {
    if (!(f.key in patch)) continue;
    if (f.sellerOnly && role !== 'seller') continue;
    const v = patch[f.key];
    switch (f.type) {
      case 'bool':
        out[f.key] = Boolean(v);
        break;
      case 'number':
      case 'money': {
        const n = Number(v);
        if (v === '' || v === null || !isFinite(n)) out[f.key] = '';
        else out[f.key] = Math.max(0, Math.round(n));
        break;
      }
      case 'colors':
        out[f.key] = (Array.isArray(v) ? v : []).map((c) => String(c).slice(0, 24)).slice(0, 8);
        break;
      case 'select':
        out[f.key] = f.options?.includes(String(v)) ? String(v) : '';
        break;
      default:
        out[f.key] = String(v ?? '').slice(0, f.max ?? 500);
    }
  }
  return out;
}

export function propose(o: OrderRecord, role: Role, note: string): Version {
  assertEditable(o);
  const prev = latest(o);
  const hash = hashBrief(o, o.draft);
  if (prev && prev.hash === hash && !prev.changeRequest) throw new HttpError(409, `Nothing changed since version ${prev.n}.`);
  const snapshot: BriefContent = structuredClone(o.draft);
  const complete = missingRequired(o.template, snapshot.spec).length === 0;
  const v: Version = {
    n: o.versions.length + 1,
    snapshot,
    hash,
    proposedBy: role,
    proposedAt: Date.now(),
    note: note.slice(0, 300),
    changes: diffBriefs(o.template, prev?.snapshot ?? null, snapshot),
    approvals: complete ? { [role]: Date.now() } : {},
  };
  o.versions.push(v);
  o.updatedAt = Date.now();
  return v;
}

export function decide(o: OrderRecord, role: Role, n: number, decision: 'approve' | 'changes', reason: string): { agreed: boolean; version: Version } {
  assertEditable(o);
  const v = latest(o);
  if (!v || v.n !== n) throw new HttpError(409, 'A newer version exists. Review the latest one.');
  if (decision === 'approve') {
    const missing = missingRequired(o.template, v.snapshot.spec);
    if (missing.length) throw new HttpError(400, `Can't approve yet - missing: ${missing.join(', ')}`);
    v.approvals[role] = Date.now();
    v.changeRequest = undefined;
    const agreed = Boolean(v.approvals.seller && v.approvals.customer);
    if (agreed) o.agreedVersion = v.n;
    o.updatedAt = Date.now();
    return { agreed, version: v };
  }
  if (!reason.trim()) throw new HttpError(400, 'Tell the other side what should change.');
  v.changeRequest = { by: role, reason: reason.slice(0, 500), at: Date.now() };
  delete v.approvals[role];
  o.updatedAt = Date.now();
  return { agreed: false, version: v };
}
