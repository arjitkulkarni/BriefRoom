import { formatValue, isFilled, templateFor } from './templates.ts';

export type Role = 'seller' | 'customer';
export type Spec = Record<string, string | number | boolean | string[]>;

/** A reference image the brief is built around. */
export interface Ref {
  id: string;
  url: string;
  w: number;
  h: number;
  caption: string;
  by: Role;
  at: number;
  fromChat?: boolean;
}

export type PinKind = 'keep' | 'change' | 'colour' | 'remove' | 'text' | 'question';

export const PIN_KINDS: Record<PinKind, { label: string; emoji: string; color: string }> = {
  keep: { label: 'Keep exactly', emoji: '✅', color: '#16a34a' },
  change: { label: 'Change this', emoji: '✏️', color: '#2563eb' },
  colour: { label: 'Change colour', emoji: '🎨', color: '#c026d3' },
  remove: { label: 'Remove', emoji: '🚫', color: '#dc2626' },
  text: { label: 'Add / edit text', emoji: '🔤', color: '#d97706' },
  question: { label: 'Question', emoji: '❓', color: '#475569' },
};

/** A region on a reference image (x/y/w/h are 0..1 fractions of the image). */
export interface Pin {
  id: string;
  n: number;
  refId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PinKind;
  note: string;
  color?: string;
  by: Role;
  at: number;
  resolved: boolean;
}

export interface BriefContent {
  refs: Ref[];
  pins: Pin[];
  spec: Spec;
}

export interface Version {
  n: number;
  snapshot: BriefContent;
  hash: string;
  proposedBy: Role;
  proposedAt: number;
  note: string;
  changes: string[];
  approvals: Partial<Record<Role, number>>;
  changeRequest?: { by: Role; reason: string; at: number };
}

export type OrderStatus = 'draft' | 'proposed' | 'changes' | 'agreed';

export interface ShopPublic {
  id: string;
  name: string;
  owner: string;
  category: string;
  city: string;
  sellerUserId: string;
}

export interface OrderView {
  id: string;
  shopId: string;
  shopName: string;
  template: string;
  title: string;
  customerName: string;
  customerUserId: string;
  sellerUserId: string;
  channelId: string;
  createdAt: number;
  updatedAt: number;
  draft: BriefContent;
  versions: Version[];
  agreedVersion: number | null;
  status: OrderStatus;
  draftDirty: boolean;
  role: Role;
  /** Only present for the seller: the customer's private invite key. */
  inviteKey?: string;
}

export interface OrderSummary {
  id: string;
  title: string;
  template: string;
  customerName: string;
  status: OrderStatus;
  latestVersion: number;
  price: number | null;
  deliveryDate: string | null;
  updatedAt: number;
  pins: number;
  refs: number;
}

/* ---------------------------------------------------------- Nexconn custom messages */

export const MSG = {
  START: 'BR:Start',
  REF: 'BR:Ref',
  PIN: 'BR:Pin',
  SPEC: 'BR:Spec',
  VERSION: 'BR:Version',
  DECISION: 'BR:Decision',
} as const;

export interface StartContent {
  title: string;
  template: string;
  by: Role;
}
export interface RefContent {
  refId: string;
  url: string;
  caption: string;
  by: Role;
}
export interface PinContent {
  pinId: string;
  n: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PinKind;
  note: string;
  color?: string;
  by: Role;
}
export interface SpecContent {
  changes: string[];
  by: Role;
}
export interface VersionContent {
  n: number;
  price: number | null;
  changes: string[];
  note: string;
  hash: string;
  by: Role;
}
export interface DecisionContent {
  n: number;
  decision: 'approve' | 'changes' | 'agreed' | 'reopen';
  reason?: string;
  hash?: string;
  price?: number | null;
  by: Role;
}

/* ---------------------------------------------------------- helpers */

export const roleLabel = (r: Role) => (r === 'seller' ? 'Seller' : 'Customer');
export const otherRole = (r: Role): Role => (r === 'seller' ? 'customer' : 'seller');

export function missingRequired(template: string, spec: Spec): string[] {
  return templateFor(template)
    .fields.filter((f) => f.required && !isFilled(spec[f.key]))
    .map((f) => f.label);
}

/** Human-readable list of what changed between two brief contents. */
export function diffBriefs(template: string, prev: BriefContent | null, next: BriefContent): string[] {
  const out: string[] = [];
  const t = templateFor(template);
  const ps = prev?.spec ?? {};
  for (const f of t.fields) {
    const a = formatValue(f, ps[f.key]);
    const b = formatValue(f, next.spec[f.key]);
    if (a !== b) out.push(a === '—' ? `${f.label}: ${b}` : `${f.label}: ${a} → ${b}`);
  }
  const prevPins = new Map((prev?.pins ?? []).map((p) => [p.id, p]));
  for (const p of next.pins) {
    const old = prevPins.get(p.id);
    if (!old) out.push(`Pin #${p.n} added: ${PIN_KINDS[p.kind].label}${p.note ? ` - ${p.note}` : ''}`);
    else if (old.resolved !== p.resolved) out.push(`Pin #${p.n} ${p.resolved ? 'resolved' : 'reopened'}`);
    else if (old.note !== p.note || old.color !== p.color || old.kind !== p.kind) out.push(`Pin #${p.n} edited`);
    prevPins.delete(p.id);
  }
  for (const p of prevPins.values()) out.push(`Pin #${p.n} removed`);
  const prevRefs = new Set((prev?.refs ?? []).map((r) => r.id));
  const added = next.refs.filter((r) => !prevRefs.has(r.id)).length;
  const removed = (prev?.refs ?? []).filter((r) => !next.refs.some((n) => n.id === r.id)).length;
  if (added) out.push(`${added} reference image${added > 1 ? 's' : ''} added`);
  if (removed) out.push(`${removed} reference image${removed > 1 ? 's' : ''} removed`);
  return out;
}

export function canonicalJSON(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON((v as any)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
