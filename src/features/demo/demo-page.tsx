import { ArrowRight, ExternalLink, LayoutDashboard, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, PageLoader } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { api, type DemoSession } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DemoGuide } from './demo-guide';

/**
 * One real order, both people on one screen: the seller (desktop) and the customer (phone) in two
 * frames. Each frame is its own Nexconn user in the order's private group channel, so every change
 * on one side shows up on the other without a refresh.
 */

// v2: the Priya & Neha story. Older saved demos (a different story) are not reused.
const STORE = 'br.demo.v2';

// The guided steps (plain words: who, which side, which button) live in ./demo-guide.

const load = (): DemoSession | null => {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) ?? 'null') as DemoSession | null;
    return d?.orderId && d.sellerKey && d.customerKey ? d : null;
  } catch {
    return null;
  }
};
const save = (d: DemoSession | null) => {
  try {
    if (d) localStorage.setItem(STORE, JSON.stringify(d));
    else localStorage.removeItem(STORE);
  } catch {
    /* storage unavailable: the demo still works for this visit */
  }
};

// StrictMode runs effects twice in development: share one in-flight request.
let pending: Promise<DemoSession> | null = null;
async function getDemo(fresh: boolean): Promise<DemoSession> {
  if (!fresh) {
    const existing = load();
    if (existing && (await api.meta(existing.orderId).then(() => true, () => false))) return existing;
  }
  pending ??= api.demo().finally(() => (pending = null));
  const d = await pending;
  save(d);
  return d;
}

export default function DemoPage() {
  const [demo, setDemo] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'seller' | 'customer'>('customer');

  const start = useCallback(async (fresh: boolean) => {
    setError(null);
    setDemo(null);
    try {
      setDemo(await getDemo(fresh));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    document.title = 'Live demo · BriefRoom';
    void start(false);
  }, [start]);

  if (error)
    return (
      <div className="app-shell grid min-h-dvh place-items-center p-6">
        <ErrorState title="The demo could not start" action={<Button onClick={() => void start(true)}>Try again</Button>}>
          {error}
        </ErrorState>
      </div>
    );
  if (!demo) return <PageLoader label="Setting up a real order for you…" />;

  const sellerSrc = `/o/${demo.orderId}#k=${encodeURIComponent(demo.sellerKey)}`;
  const customerSrc = `/o/${demo.orderId}#k=${encodeURIComponent(demo.customerKey)}`;

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        <Logo />
        <Badge tone="primary">Live demo</Badge>
        <p className="hidden min-w-0 truncate text-sm text-muted-foreground xl:block">Priya is ordering a birthday cake from Neha’s shop. You play both of them: whatever one does, the other sees instantly.</p>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="subtle" size="sm" onClick={() => void start(true)} title="Start a fresh order">
            <RotateCcw /> <span className="max-sm:hidden">Start over</span>
          </Button>
          <ThemeToggle />
          <Button asChild size="sm" className="max-sm:hidden">
            <Link to="/start">
              Set up your own shop <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>

      <DemoGuide key={demo.orderId} demo={demo} onRestart={() => void start(true)} />

      <div className="flex shrink-0 gap-1 border-b border-border p-2 lg:hidden" role="tablist" aria-label="Whose screen">
        {(['customer', 'seller'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors', tab === t ? 'bg-primary-soft text-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t === 'customer' ? <Smartphone className="size-4" aria-hidden /> : <Monitor className="size-4" aria-hidden />}
            {t === 'customer' ? 'Priya (customer)' : 'Neha (shop)'}
          </button>
        ))}
      </div>

      <main className="flex min-h-0 flex-1 gap-3 p-2 sm:p-3">
        {/* Both frames stay mounted on small screens so both people stay connected; tabs only hide one. */}
        <Pane
          className={cn('min-w-0 flex-1', tab !== 'seller' && 'max-lg:hidden')}
          icon={Monitor}
          title="Neha runs the cake shop “Sugar & Sprinkles”"
          role="Seller"
          src={sellerSrc}
          extra={
            <a href={`/seller/${demo.shopId}#k=${encodeURIComponent(demo.sellerKey)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
            </a>
          }
        />
        <Pane className={cn('w-full lg:w-[400px] lg:shrink-0', tab !== 'customer' && 'max-lg:hidden')} icon={Smartphone} title="Priya wants a cake" role="Customer" src={customerSrc} />
      </main>
    </div>
  );
}

function Pane({ className, icon: Icon, title, role, src, extra }: { className?: string; icon: ComponentType<{ className?: string }>; title: string; role: string; src: string; extra?: React.ReactNode }) {
  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label={`${role} view`}>
      <div className="flex h-8 items-center gap-2 px-1">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        <Badge tone={role === 'Seller' ? 'info' : 'success'}>{role === 'Seller' ? 'Shop' : 'Customer'}</Badge>
        <span className="ml-auto flex items-center gap-1">
          {extra}
          <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <ExternalLink className="size-3.5" aria-hidden /> New tab
          </a>
        </span>
      </div>
      {/* `name` scopes each frame's remembered key (see lib/keys tabKey), so navigation inside a frame keeps its side. */}
      <iframe title={`${role} view`} name={`br-demo-${role.toLowerCase()}`} src={src} allow="clipboard-write" className="min-h-0 w-full flex-1 rounded-xl border border-border bg-background shadow-sm" />
    </section>
  );
}
