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
/** Sign out of a shop on this device: forget its seller key (the dashboard link still works). */
export const forgetSellerKey = (shopId: string) => {
  try {
    localStorage.removeItem(`br.seller.${shopId}`);
    if (localStorage.getItem('br.lastShop') === shopId) localStorage.removeItem('br.lastShop');
  } catch {
    /* storage unavailable */
  }
};
export const customerKey = (orderId: string) => get(`br.customer.${orderId}`);
export const saveCustomerKey = (orderId: string, key: string) => set(`br.customer.${orderId}`, key);

/**
 * The key this browser tab is acting with for one order. One person can hold both keys on one
 * device (a seller testing their own customer link), so each tab remembers which side it is on
 * and a refresh never silently switches seller ↔ customer.
 *
 * Frames of one tab share sessionStorage, so a framed page (the /demo page shows the seller and the
 * customer side by side) scopes the key to its frame's name, which survives navigation inside the
 * frame (workspace → work order → back).
 */
const tabSlot = (orderId: string) => (inFrame() ? `br.tab.frame-${window.name || 'unnamed'}.${orderId}` : `br.tab.${orderId}`);
export const tabKey = (orderId: string) => {
  try {
    return sessionStorage.getItem(tabSlot(orderId));
  } catch {
    return null;
  }
};
export const setTabKey = (orderId: string, key: string) => {
  try {
    sessionStorage.setItem(tabSlot(orderId), key);
  } catch {
    /* storage unavailable */
  }
};

/** Framed (by the /demo page): keys stay out of this device's long-term storage. */
export const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/** Pick up a key passed in the URL (?k= or #k=) and strip it from the address bar (kept when framed). */
export function consumeUrlKey(): string | null {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('k');
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get('k');
  const k = fromQuery || fromHash;
  if (!k) return null;
  if (inFrame()) return k;
  url.searchParams.delete('k');
  url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
  return k;
}
