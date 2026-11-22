/**
 * Capability keys kept on this device. Seller keys unlock a shop dashboard; customer keys
 * unlock one order. Storage can be unavailable (private mode) — every access is guarded.
 */
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
    /* storage unavailable */
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

/** Pick up a key passed in the URL (?k= or #k=), persist it, and strip it from the address bar. */
export function consumeUrlKey(): string | null {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('k');
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get('k');
  const k = fromQuery || fromHash;
  if (!k) return null;
  url.searchParams.delete('k');
  url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
  return k;
}
