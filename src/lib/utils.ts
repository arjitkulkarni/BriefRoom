import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (n: number | null | undefined) => (typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—');

export function ago(ts: number | null | undefined) {
  if (!ts) return '';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const dateTime = (ts: number | null | undefined) =>
  ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';

export const shortHash = (h: string, n = 10) => h.slice(0, n);

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/** SHA-256 hex in the browser (WebCrypto) — used to independently verify version fingerprints. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
