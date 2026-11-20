import type { OrderSummary, OrderView, ShopPublic } from '../../shared/types';

export interface AppConfig {
  appKey: string;
  area: string;
  nexconnReady: boolean;
  publicUrl: string;
}

async function req<T>(path: string, init: RequestInit & { key?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.key) headers['x-key'] = init.key;
  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
const post = <T>(path: string, body: unknown, key?: string | null, method = 'POST') => req<T>(path, { method, body: JSON.stringify(body), key });

let cfg: Promise<AppConfig> | null = null;
export const getConfig = () => (cfg ??= req<AppConfig>('/api/config'));

type OrderRes = { order: OrderView };

export const api = {
  createShop: (b: { name: string; owner: string; category: string; city: string }) => post<{ shop: ShopPublic; sellerKey: string }>('/api/shops', b),
  shop: (id: string) => req<{ shop: ShopPublic }>(`/api/shops/${id}`),
  shopOrders: (id: string, key: string) => req<{ orders: OrderSummary[] }>(`/api/shops/${id}/orders`, { key }),
  createOrder: (shopId: string, b: { customerName: string; template: string; title?: string }, key?: string | null) =>
    post<{ orderId: string; customerKey: string; createdBy: 'seller' | 'customer' }>(`/api/shops/${shopId}/orders`, b, key),
  meta: (id: string) => req<{ id: string; shopId: string; title: string; template: string; shopName: string }>(`/api/orders/${id}/meta`),
  order: (id: string, key: string) => req<OrderRes>(`/api/orders/${id}`, { key }),
  addRef: (id: string, key: string, b: { url: string; w: number; h: number; caption?: string; fromChat?: boolean }) =>
    post<OrderRes & { ref: OrderView['draft']['refs'][number] }>(`/api/orders/${id}/refs`, b, key),
  removeRef: (id: string, key: string, refId: string) => req<OrderRes>(`/api/orders/${id}/refs/${refId}`, { method: 'DELETE', key }),
  addPin: (id: string, key: string, b: { refId: string; x: number; y: number; w: number; h: number; kind: string; note: string; color?: string }) =>
    post<OrderRes & { pin: OrderView['draft']['pins'][number] }>(`/api/orders/${id}/pins`, b, key),
  updatePin: (id: string, key: string, pinId: string, b: { resolved?: boolean; note?: string }) =>
    post<OrderRes>(`/api/orders/${id}/pins/${pinId}`, b, key, 'PATCH'),
  removePin: (id: string, key: string, pinId: string) => req<OrderRes>(`/api/orders/${id}/pins/${pinId}`, { method: 'DELETE', key }),
  saveSpec: (id: string, key: string, spec: Record<string, unknown>) => post<OrderRes & { changes: string[] }>(`/api/orders/${id}/spec`, { spec }, key, 'PATCH'),
  propose: (id: string, key: string, note: string) => post<OrderRes & { version: OrderView['versions'][number] }>(`/api/orders/${id}/versions`, { note }, key),
  decide: (id: string, key: string, n: number, decision: 'approve' | 'changes', reason = '') =>
    post<OrderRes & { agreed: boolean; version: OrderView['versions'][number] }>(`/api/orders/${id}/versions/${n}/decision`, { decision, reason }, key),
  reopen: (id: string, key: string) => post<OrderRes>(`/api/orders/${id}/reopen`, {}, key),
  token: (b: { key: string; shopId?: string; orderId?: string }) => post<{ token: string; userId: string; role: 'seller' | 'customer'; name: string }>('/api/token', b),
  upload: (key: string, dataUrl: string) => post<{ url: string }>('/api/uploads', { dataUrl }, key),
  profiles: (ids: string[]) => req<{ profiles: { userId: string; name: string }[] }>(`/api/profiles?ids=${encodeURIComponent(ids.join(','))}`),
  groups: (ids: string[]) => req<{ groups: { groupId: string; name: string; memberCount: number }[] }>(`/api/groups?ids=${encodeURIComponent(ids.join(','))}`),
  members: (channelId: string) => req<{ members: { userId: string }[] }>(`/api/groups/${channelId}/members`),
  stats: () => req<Record<string, number>>('/api/stats'),
};

/* ------------------------------------------------------------- keys kept on this device */

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};
export const sellerKey = (shopId: string) => get(`br.seller.${shopId}`);
export const saveSellerKey = (shopId: string, key: string) => {
  set(`br.seller.${shopId}`, key);
  set('br.lastShop', shopId);
};
export const lastShop = () => get('br.lastShop');
export const customerKey = (orderId: string) => get(`br.customer.${orderId}`);
export const saveCustomerKey = (orderId: string, key: string) => set(`br.customer.${orderId}`, key);

export async function publicBase(): Promise<string> {
  const c = await getConfig().catch(() => null);
  return (c?.publicUrl || window.location.origin).replace(/\/$/, '');
}

/** Downscale to <=1600px JPEG before upload (phones send 4-12 MB photos). */
export function compressImage(file: File, max = 1600): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: c.toDataURL('image/jpeg', 0.86), w, h });
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = url;
  });
}

export function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = src;
  });
}
