import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { OrderStatus } from '../../shared/types';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <a className="logo" href={href}>
      <span className="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="#fff" strokeWidth="2.2" />
          <path d="M8.5 12.3l2.4 2.4 4.6-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      BriefRoom
    </a>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="center-page">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
        <div className="spinner" />
        {label && <div className="muted">{label}</div>}
      </div>
    </div>
  );
}

export function ErrorPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="center-page">
      <div className="card form-card" style={{ textAlign: 'center' }}>
        <Logo />
        <h1>{title}</h1>
        <div className="muted">{children}</div>
      </div>
    </div>
  );
}

const STATUS: Record<OrderStatus, string> = {
  draft: 'Collecting details',
  proposed: 'Awaiting approval',
  changes: 'Changes requested',
  agreed: 'Agreed',
};
export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`chip ${status}`}>{status === 'agreed' ? '🤝 ' : ''}{STATUS[status]}</span>;
}

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const show = useCallback((t: string) => setText(t), []);
  const node = <Toast text={text} onDone={() => setText(null)} />;
  return { show, node };
}
function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return text ? (
    <div className="toast" role="status">
      {text}
    </div>
  ) : null;
}

export function ago(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
