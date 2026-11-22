import { useEffect, useState } from 'react';
import { ErrorState, PageLoader } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { api } from '@/lib/api';

const LABELS: Record<string, string> = {
  shops: 'Seller shops',
  orders: 'Brief rooms',
  agreed: 'Agreed orders',
  versions: 'Versions proposed',
  annotations: 'Annotations',
  references: 'Reference images',
  nexconnEventsDelivered: 'Events delivered via Nexconn',
};

/** Public, live usage numbers straight from the database (no estimates). */
export default function StatsPage() {
  const [s, setS] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api
      .stats()
      .then(setS)
      .catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="p-6"><ErrorState title="Could not load usage">{err}</ErrorState></div>;
  if (!s) return <PageLoader />;
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">BriefRoom usage</h1>
        <p className="mt-2 text-muted-foreground">Counted live from the database when this page loads.</p>
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(LABELS).map(([k, label]) => (
            <div key={k} className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">{s[k] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
