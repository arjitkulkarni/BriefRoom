import { Activity, ArrowRight, Copy, ExternalLink, Inbox, KeyRound, LayoutGrid, Link2, MessageSquare, Plus, Search, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TEMPLATES, templateFor } from '@shared/templates';
import { isBrMessage } from '@shared/messages';
import { ORDER_STATUSES, ORDER_STATUS_META, type OrderStatus, type OrderSummary, type ShopPublic } from '@shared/types';
import { EmptyState, ErrorState, FullPageMessage, PageLoader, StatusBadge } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { Skeleton } from '@/components/ui/primitives';
import { copyWithToast } from '@/lib/clipboard';
import { api, getConfig, shareBase, type ShopActivity } from '@/lib/api';
import { consumeUrlKey, saveSellerKey, sellerKey } from '@/lib/keys';
import { ago, cn, money, shortDate, whatsappLink } from '@/lib/utils';
import { ModeSwitchRequired, onMessages } from '@/services/nexconn/client';
import { getInboxApp, initInbox } from '@/services/nexconn/chatui';
import { CATEGORY_ICON } from '../shops/start-shop-page';

export default function DashboardPage() {
  const { shopId = '' } = useParams();
  const [key] = useState(() => {
    const fromUrl = consumeUrlKey();
    if (fromUrl) saveSellerKey(shopId, fromUrl);
    return fromUrl ?? sellerKey(shopId);
  });
  if (!key)
    return (
      <FullPageMessage title="This dashboard is private" action={<Button asChild><Link to="/start">Create a shop</Link></Button>}>
        Open your private dashboard link (it was shown when you created the shop) on this device, or create a new shop.
      </FullPageMessage>
    );
  return <Dashboard shopId={shopId} accessKey={key} />;
}

type View = 'orders' | 'messages';

function Dashboard({ shopId, accessKey }: { shopId: string; accessKey: string }) {
  const nav = useNavigate();
  const [shop, setShop] = useState<ShopPublic | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [activity, setActivity] = useState<ShopActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('orders');
  const [newOpen, setNewOpen] = useState(false);
  const [inboxState, setInboxState] = useState<'idle' | 'loading' | 'ready' | 'disabled' | 'reload' | 'error'>('idle');
  const [inboxError, setInboxError] = useState<string | null>(null);
  const inboxHost = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [s, o, a] = await Promise.all([api.shop(shopId), api.shopOrders(shopId, accessKey), api.shopActivity(shopId, accessKey)]);
      setShop(s.shop);
      setOrders(o.orders);
      setActivity(a.activity);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [shopId, accessKey]);

  useEffect(() => {
    void load();
    const onFocus = () => document.visibilityState === 'visible' && void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Live: connect the seller to Nexconn (Chat UI inbox mode); any BR:* event refreshes the pipeline.
  useEffect(() => {
    let off = () => {};
    (async () => {
      const cfg = await getConfig().catch(() => null);
      if (!cfg?.nexconn.enabled) return setInboxState('disabled');
      setInboxState('loading');
      try {
        await initInbox(shopId, accessKey);
        setInboxState('ready');
      } catch (e) {
        if (e instanceof ModeSwitchRequired) setInboxState('reload');
        else {
          setInboxState('error');
          setInboxError((e as Error).message);
        }
      }
      let t: ReturnType<typeof setTimeout> | null = null;
      off = onMessages((batch) => {
        if (!batch.some((m) => isBrMessage(m.messageType))) return;
        if (t) clearTimeout(t);
        t = setTimeout(() => void load(), 250);
      });
    })();
    return () => off();
  }, [shopId, accessKey, load]);

  useEffect(() => {
    if (view !== 'messages' || inboxState !== 'ready' || !inboxHost.current) return;
    if (!inboxHost.current.querySelector('nc-chat-ui-app-provider')) inboxHost.current.appendChild(document.createElement('nc-chat-ui-app-provider'));
    getInboxApp()?.setChannelBarSwitch(true);
  }, [view, inboxState]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders?.length ?? 0 };
    for (const s of ORDER_STATUSES) c[s] = orders?.filter((o) => o.status === s).length ?? 0;
    return c;
  }, [orders]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders ?? []).filter((o) => (filter === 'all' || o.status === filter) && (!q || `${o.customerName} ${o.title} ${o.id}`.toLowerCase().includes(q)));
  }, [orders, filter, query]);

  if (error && !shop) return <FullPageMessage title="Could not open the dashboard" action={<Button onClick={() => void load()}>Try again</Button>}>{error}</FullPageMessage>;
  if (!shop) return <PageLoader label="Loading your shop…" />;

  const copyShopLink = async () => {
    const link = `${await shareBase()}/shop/${shop.id}`;
    await copyWithToast(link, 'Shop link copied — add it to your Instagram bio');
  };
  const copyDashboardLink = async () => {
    const link = `${await shareBase()}/seller/${shop.id}#k=${accessKey}`;
    await copyWithToast(link, 'Private dashboard link copied — keep it safe');
  };
  const ShopIcon = CATEGORY_ICON[shop.category as keyof typeof CATEGORY_ICON] ?? Store;

  const sidebar = (
    <aside className="hidden w-62 shrink-0 flex-col border-r border-border bg-surface lg:flex" aria-label="Shop navigation">
      <div className="flex h-16 items-center px-5">
        <Logo to={`/seller/${shop.id}`} />
      </div>
      <div className="mx-3 flex items-center gap-3 rounded-lg border border-border bg-surface-secondary p-3">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
          <ShopIcon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{shop.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {shop.ownerName}
            {shop.city ? ` · ${shop.city}` : ''}
          </p>
        </div>
      </div>
      <nav className="mt-4 grid gap-1 px-3">
        {(
          [
            ['orders', LayoutGrid, 'Orders', counts.all],
            ['messages', MessageSquare, 'Messages', null],
          ] as const
        ).map(([id, Icon, label, count]) => (
          <button key={id} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={cn('flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', view === id ? 'bg-primary-soft text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="size-4" aria-hidden />
            {label}
            {count !== null && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto grid gap-1 border-t border-divider p-3">
        <Button variant="ghost" className="justify-start" onClick={copyShopLink}>
          <Link2 /> Copy shop link
        </Button>
        <Button variant="ghost" className="justify-start" asChild>
          <a href={`/shop/${shop.id}`} target="_blank" rel="noreferrer">
            <ExternalLink /> View shop page
          </a>
        </Button>
        <Button variant="ghost" className="justify-start" onClick={copyDashboardLink}>
          <KeyRound /> Copy dashboard link
        </Button>
        <div className="flex items-center justify-between px-3 pt-2 text-xs text-muted-foreground">
          Theme
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <span className="lg:hidden">
            <Logo to={`/seller/${shop.id}`} compact />
          </span>
          <h1 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">{view === 'orders' ? 'Orders' : 'Messages'}</h1>
          <div className="relative ml-auto hidden w-64 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, title, ID" className="pl-9" aria-label="Search orders" />
          </div>
          <Button onClick={() => setNewOpen(true)} className="ml-auto md:ml-0">
            <Plus /> <span className="max-sm:sr-only">New brief</span>
          </Button>
          <span className="lg:hidden">
            <ThemeToggle />
          </span>
        </header>

        <div className="flex gap-1 border-b border-border bg-surface px-4 py-2 lg:hidden">
          {(
            [
              ['orders', 'Orders'],
              ['messages', 'Messages'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={cn('h-9 flex-1 rounded-md text-sm font-semibold', view === id ? 'bg-primary-soft text-foreground' : 'text-muted-foreground')}>
              {label}
            </button>
          ))}
          <Button variant="ghost" size="icon-sm" onClick={copyShopLink} aria-label="Copy shop link">
            <Link2 />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={copyDashboardLink} aria-label="Copy private dashboard link">
            <KeyRound />
          </Button>
        </div>

        {view === 'orders' ? (
          <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="relative mb-4 md:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders" className="pl-9" aria-label="Search orders" />
              </div>
              <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Order pipeline">
                <div className="flex w-max gap-1.5">
                  {(['all', ...ORDER_STATUSES] as const).map((s) => (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={filter === s}
                      onClick={() => setFilter(s)}
                      className={cn('inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', filter === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground')}
                    >
                      {s === 'all' ? 'All orders' : ORDER_STATUS_META[s].label}
                      <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', filter === s ? 'bg-primary-foreground/20' : 'bg-surface-secondary')}>{counts[s]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {orders === null ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No briefs yet"
                  action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={() => setNewOpen(true)}>
                        <Plus /> Create your first brief
                      </Button>
                      <Button variant="outline" onClick={copyShopLink}>
                        <Link2 /> Copy shop link
                      </Button>
                    </div>
                  }
                  className="py-16"
                >
                  Create a brief for a customer and send them the private link, or share your shop link so customers can start their own.
                </EmptyState>
              ) : visible.length === 0 ? (
                <EmptyState icon={Search} title="No orders match">
                  Try another status or search term.
                </EmptyState>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {visible.map((o) => (
                    <li key={o.id}>
                      <OrderCard o={o} onOpen={() => nav(`/o/${o.id}`)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside aria-labelledby="activity-h" className="xl:sticky xl:top-22 xl:self-start">
              <h2 id="activity-h" className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Activity className="size-4" aria-hidden /> Recent activity
              </h2>
              {activity.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Activity from all orders appears here.</p>
              ) : (
                <ol className="relative grid gap-3 border-l border-divider pl-4">
                  {activity.slice(0, 14).map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-border-strong" aria-hidden />
                      <Link to={`/o/${e.orderId}`} className="block rounded-md text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="text-foreground">{e.summary}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {e.orderTitle} · {ago(e.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
            {inboxState === 'disabled' && (
              <EmptyState icon={MessageSquare} title="Messages need Nexconn credentials">
                The server has no Nexconn keys yet, so customer conversations can’t load. Nothing here is simulated — add the keys and restart the server.
              </EmptyState>
            )}
            {inboxState === 'loading' && <Skeleton className="h-[640px] rounded-xl" />}
            {inboxState === 'error' && <ErrorState title="Could not connect to Nexconn">{inboxError}</ErrorState>}
            {inboxState === 'reload' && (
              <EmptyState icon={MessageSquare} title="Reload to open the inbox" action={<Button onClick={() => window.location.reload()}>Reload</Button>}>
                The chat engine was started for an order workspace in this tab.
              </EmptyState>
            )}
            {inboxState === 'ready' && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">Inbox powered by Nexconn Chat UI (shown in its built-in light theme).</p>
                <div ref={inboxHost} className="relative h-[calc(100dvh-180px)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-white shadow-sm [&>nc-chat-ui-app-provider]:block [&>nc-chat-ui-app-provider]:size-full" />
              </>
            )}
          </main>
        )}
      </div>

      <NewBriefDialog open={newOpen} onOpenChange={setNewOpen} shop={shop} accessKey={accessKey} onCreated={() => void load()} />
    </div>
  );
}

function OrderCard({ o, onOpen }: { o: OrderSummary; onOpen: () => void }) {
  const t = templateFor(o.template);
  const next = ORDER_STATUS_META[o.status].nextAction.seller;
  const Icon = CATEGORY_ICON[o.template as keyof typeof CATEGORY_ICON] ?? Store;
  return (
    <button onClick={onOpen} className="group flex h-full w-full flex-col rounded-xl border border-border bg-surface text-left shadow-xs transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex gap-3 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-secondary">
          {o.thumbnailUrl ? <img src={o.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" /> : <Icon className="m-auto mt-5 size-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-bold text-foreground">{o.customerName}</p>
            <StatusBadge status={o.status} className="shrink-0" />
          </div>
          <p className="truncate text-sm text-foreground">{o.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {t.name} · <span className="font-mono">#{o.id}</span>
            {o.latestVersionNumber > 0 && ` · v${o.latestVersionNumber}`}
          </p>
        </div>
      </div>
      <div className="mt-auto grid gap-2 border-t border-divider px-4 py-3 text-xs">
        {o.lastActivity && (
          <p className="line-clamp-1 text-muted-foreground">
            <span className="text-foreground">{o.lastActivity.summary}</span> · {ago(o.lastActivity.at)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="font-semibold text-foreground">{o.price !== null ? money(o.price) : 'No quote yet'}</span>
          {o.deliveryDate && <span>Needed {shortDate(o.deliveryDate)}</span>}
          {o.openClarifications > 0 && <span className="text-warning-text">{o.openClarifications} open question{o.openClarifications > 1 ? 's' : ''}</span>}
        </div>
        <p className="flex items-center gap-1 font-semibold text-foreground">
          {next}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </p>
      </div>
    </button>
  );
}

function NewBriefDialog({ open, onOpenChange, shop, accessKey, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; shop: ShopPublic; accessKey: string; onCreated: () => void }) {
  const [customer, setCustomer] = useState('');
  const [template, setTemplate] = useState(shop.category);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; link: string; name: string } | null>(null);
  const nav = useNavigate();
  useEffect(() => {
    if (!open) {
      setCreated(null);
      setErr(null);
    }
  }, [open]);

  const create = async () => {
    if (!customer.trim()) return setErr('Add the customer’s name.');
    setBusy(true);
    setErr(null);
    try {
      const r = await api.createOrder(shop.id, { customerName: customer.trim(), template, title: title.trim() }, accessKey);
      setCreated({ id: r.orderId, link: `${await shareBase()}/o/${r.orderId}?k=${r.customerKey}`, name: customer.trim() });
      setCustomer('');
      setTitle('');
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Brief room ready for {created.name}</DialogTitle>
              <DialogDescription>Send this private link. Whoever has it can open this order as the customer.</DialogDescription>
            </DialogHeader>
            <p className="break-all rounded-lg bg-surface-secondary p-3 font-mono text-xs text-foreground">{created.link}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="outline" onClick={() => void copyWithToast(created.link, 'Link copied')}>
                <Copy /> Copy
              </Button>
              <Button variant="outline" asChild>
                <a href={whatsappLink(`Hi ${created.name}! Here’s our private brief room for your order with ${shop.name}. Share photos, mark exactly what you like, and approve the final design here: ${created.link}`)} target="_blank" rel="noreferrer">
                  <MessageSquare /> WhatsApp
                </a>
              </Button>
              <Button onClick={() => nav(`/o/${created.id}`)}>
                Open <ArrowRight />
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New brief</DialogTitle>
              <DialogDescription>Creates a private order room and its Nexconn conversation.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label="Customer name" required error={err && !customer.trim() ? err : undefined}>
                {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Priya" maxLength={40} />}
              </Field>
              <fieldset>
                <legend className="mb-2 text-[13px] font-semibold text-foreground">Product</legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {Object.values(TEMPLATES).map((t) => {
                    const Icon = CATEGORY_ICON[t.id as keyof typeof CATEGORY_ICON];
                    return (
                      <button key={t.id} type="button" role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)} className={cn('flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', template === t.id ? 'border-primary bg-primary-soft text-foreground' : 'border-border text-muted-foreground hover:bg-surface-secondary')}>
                        <Icon className="size-4" aria-hidden />
                        {t.name.replace(/^(Custom|Printed) /, '')}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="Title" help="Optional, e.g. “Aditi’s 25th birthday cake”.">
                {(id, d) => <Input id={id} aria-describedby={d} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />}
              </Field>
              {err && customer.trim() && <ErrorState title="Could not create the brief">{err}</ErrorState>}
              <Button onClick={create} loading={busy}>
                Create brief room
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
