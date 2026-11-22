import type { Template } from '@shared/templates';
import type { ActivityView, AnalysisOutcome, Blocker, OrderSummary, OrderView, PublicConfig, ShopPublic } from '@shared/types';
import { uid } from './utils';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: { blockers?: Blocker[]; [k: string]: unknown },
  ) {
    super(message);
  }
}

type Opts = { method?: string; key?: string | null; body?: unknown; blob?: Blob; headers?: Record<string, string> };

async function req<T>(path: string, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.key) headers['x-key'] = o.key;
  let body: BodyInit | undefined;
  if (o.blob) {
    headers['content-type'] = o.blob.type || 'application/octet-stream';
    body = o.blob;
  } else if (o.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(o.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: o.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string; details?: ApiError['details'] };
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status, json.details);
  return json as T;
}

export type OrderResponse<R = unknown> = { result: R; order: OrderView };
export type ShopActivity = ActivityView & { orderId: string; orderTitle: string };

let configP: Promise<PublicConfig> | null = null;
export const getConfig = () => (configP ??= req<PublicConfig>('/api/config').catch((e) => ((configP = null), Promise.reject(e))));

const o = (id: string) => `/api/orders/${encodeURIComponent(id)}`;

export const api = {
  templates: () => req<{ templates: Record<string, Template> }>('/api/templates'),
  createShop: (b: { name: string; ownerName: string; category: string; city: string }) => req<{ shop: ShopPublic; sellerKey: string }>('/api/shops', { body: b }),
  shop: (id: string) => req<{ shop: ShopPublic }>(`/api/shops/${encodeURIComponent(id)}`),
  shopOrders: (id: string, key: string) => req<{ orders: OrderSummary[] }>(`/api/shops/${encodeURIComponent(id)}/orders`, { key }),
  shopActivity: (id: string, key: string) => req<{ activity: ShopActivity[] }>(`/api/shops/${encodeURIComponent(id)}/activity`, { key }),
  createOrder: (shopId: string, b: { customerName: string; template: string; title?: string }, key?: string | null) =>
    req<{ orderId: string; customerKey: string; createdBy: 'seller' | 'customer' }>(`/api/shops/${encodeURIComponent(shopId)}/orders`, { body: b, key, headers: { 'idempotency-key': uid() } }),

  meta: (id: string) => req<{ id: string; shopId: string; title: string; template: string; shopName: string }>(`${o(id)}/meta`),
  order: (id: string, key: string) => req<{ order: OrderView }>(o(id), { key }),

  uploadReference: (id: string, key: string, blob: Blob, caption = '') => req<OrderResponse<{ referenceId: string }>>(`${o(id)}/references?caption=${encodeURIComponent(caption)}`, { key, blob }),
  importReference: (id: string, key: string, url: string) => req<OrderResponse<{ referenceId: string }>>(`${o(id)}/references/import`, { key, body: { url } }),
  removeReference: (id: string, key: string, refId: string) => req<OrderResponse>(`${o(id)}/references/${refId}`, { key, method: 'DELETE' }),

  createAnnotation: (id: string, key: string, b: { referenceId: string; kind: string; note: string; color?: string | null; shape: 'rect' | 'point'; x: number; y: number; w: number; h: number }) =>
    req<OrderResponse<{ annotationId: string; number: number }>>(`${o(id)}/annotations`, { key, body: b }),
  updateAnnotation: (id: string, key: string, annId: string, b: Record<string, unknown>) => req<OrderResponse>(`${o(id)}/annotations/${annId}`, { key, body: b, method: 'PATCH' }),
  deleteAnnotation: (id: string, key: string, annId: string) => req<OrderResponse>(`${o(id)}/annotations/${annId}`, { key, method: 'DELETE' }),
  commentAnnotation: (id: string, key: string, annId: string, body: string) => req<OrderResponse>(`${o(id)}/annotations/${annId}/comments`, { key, body: { body } }),
  annotationResolution: (id: string, key: string, annId: string, action: 'request' | 'confirm' | 'cancel' | 'reopen') =>
    req<OrderResponse<{ status: string; pending: boolean }>>(`${o(id)}/annotations/${annId}/resolution`, { key, body: { action } }),

  raiseClarification: (id: string, key: string, b: { title: string; description?: string; critical?: boolean; annotationId?: string | null; messageId?: string | null; evidence?: string }) =>
    req<OrderResponse<{ clarificationId: string }>>(`${o(id)}/clarifications`, { key, body: b }),
  commentClarification: (id: string, key: string, cid: string, body: string) => req<OrderResponse>(`${o(id)}/clarifications/${cid}/comments`, { key, body: { body } }),
  updateClarification: (id: string, key: string, cid: string, b: { action: 'resolve' | 'reopen' | 'set_critical'; resolution?: string; critical?: boolean }) =>
    req<OrderResponse>(`${o(id)}/clarifications/${cid}`, { key, body: b, method: 'PATCH' }),

  updateSpec: (id: string, key: string, spec: Record<string, unknown>) => req<OrderResponse<{ changes: string[] }>>(`${o(id)}/spec`, { key, body: { spec }, method: 'PATCH' }),
  analyse: (id: string, key: string, messages: { id: string; text: string }[]) => req<OrderResponse<AnalysisOutcome & { count: number }>>(`${o(id)}/analysis`, { key, body: { messages } }),
  suggestion: (id: string, key: string, sid: string, b: { action: 'ask' | 'dismiss'; question?: string; critical?: boolean }) => req<OrderResponse>(`${o(id)}/suggestions/${sid}`, { key, body: b, method: 'PATCH' }),

  propose: (id: string, key: string, note: string) => req<OrderResponse<{ versionId: string; number: number; snapshotHash: string; replayed: boolean }>>(`${o(id)}/versions`, { key, body: { note } }),
  decide: (id: string, key: string, versionId: string, b: { decision: 'approved' | 'changes_requested'; snapshotHash: string; reason?: string }) =>
    req<OrderResponse<{ decision: string; agreed: boolean; replayed: boolean }>>(`${o(id)}/versions/${versionId}/decision`, { key, body: b, headers: { 'idempotency-key': uid() } }),
  reopen: (id: string, key: string) => req<OrderResponse>(`${o(id)}/reopen`, { key, body: {} }),
  complete: (id: string, key: string) => req<OrderResponse>(`${o(id)}/complete`, { key, body: {} }),

  nexconnToken: (b: { orderId?: string; shopId?: string; refresh?: boolean }, key: string) =>
    req<{ token: string; userId: string; name: string; channelId: string | null }>('/api/nexconn/token', { key, body: b }),
  profiles: (shopId: string, key: string, ids: string[]) => req<{ profiles: { userId: string; name: string }[] }>(`/api/nexconn/profiles?shopId=${shopId}&ids=${encodeURIComponent(ids.join(','))}`, { key }),
  groups: (shopId: string, key: string, ids: string[]) =>
    req<{ groups: { groupId: string; name: string; memberCount: number }[] }>(`/api/nexconn/groups?shopId=${shopId}&ids=${encodeURIComponent(ids.join(','))}`, { key }),
  members: (shopId: string, key: string, channelId: string) => req<{ members: { userId: string }[] }>(`/api/nexconn/groups/${channelId}/members?shopId=${shopId}`, { key }),
  stats: () => req<Record<string, number>>('/api/stats'),
};

export async function shareBase(): Promise<string> {
  const c = await getConfig().catch(() => null);
  return (c?.publicUrl || window.location.origin).replace(/\/$/, '');
}
