import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Clock3, ChevronLeft, ChevronRight, ClipboardList, FileText, GitCompareArrows, ImagePlus, Images, Link2, MessageSquare, MousePointer2, MoreHorizontal, Radar, Square, Trash2, Crosshair, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { templateFor } from '@shared/templates';
import { ORDER_STATUS_META, otherRole, roleLabel, type Blocker, type OrderView, type Role } from '@shared/types';
import { ConnectionPill, EmptyState, ErrorState, FullPageMessage, PageLoader, StatusBadge } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SheetContent, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from '@/components/ui/overlay';
import { Badge } from '@/components/ui/primitives';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOrder } from '@/hooks/use-order';
import { copyWithToast } from '@/lib/clipboard';
import { api, getConfig, shareBase } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { consumeUrlKey, customerKey, inFrame, saveCustomerKey, sellerKey, setTabKey, tabKey } from '@/lib/keys';
import { cn, whatsappLink } from '@/lib/utils';
import { connect, initEngine, getSnapshot, NexconnDisabled } from '@/services/nexconn/client';
import { useChannel } from '@/services/nexconn/use-channel';
import { AnnotationComposer, type AnnotationDraft } from '../annotations/annotation-composer';
import { AnnotationListItem, AnnotationThread } from '../annotations/annotation-thread';
import { ReferenceCanvas, type CanvasTool, type PendingRegion } from '../annotations/reference-canvas';
import { AgreementCard, ApprovalCard, ProposeDialog, VersionHistory } from '../approvals/approval-panel';
import { RadarPanel, type RadarActions } from '../clarification/radar-panel';
import { ChatPanel, type FocusTarget } from '../conversation/chat-panel';
import { SpecEditor } from '../specifications/spec-editor';
import { CompareView } from '../versions/compare-view';

/* ===================================================================== access */

export default function WorkspacePage() {
  const { orderId = '' } = useParams();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      // URL key → this tab's key → this device's customer key → this device's seller key.
      // The customer key is persisted only once the server confirms the role (see Workspace).
      const fromUrl = consumeUrlKey();
      if (fromUrl) {
        setTabKey(orderId, fromUrl); // per frame when framed, so the work order and back links keep the right side
        return setKey(fromUrl);
      }
      const tab = tabKey(orderId);
      if (tab) return setKey(tab);
      const c = customerKey(orderId);
      if (c) return setKey(c);
      const meta = await api.meta(orderId).catch(() => null);
      setKey(meta ? sellerKey(meta.shopId) : null);
    })();
  }, [orderId]);
  if (key === undefined) return <PageLoader label="Opening the brief…" />;
  if (!key)
    return (
      <FullPageMessage title="This link is missing its private key" action={<Button asChild variant="outline"><Link to="/">Go to BriefRoom</Link></Button>}>
        Open the exact link the seller sent you, or open this order from the seller dashboard on the device where the shop was created.
      </FullPageMessage>
    );
  return <Workspace orderId={orderId} accessKey={key} />;
}

/* ===================================================================== workspace */

type Panel = 'notes' | 'chat' | 'radar' | 'details' | 'versions';
/** "Neha · Sugar & Sprinkles" → "Neha". */
const firstName = (name: string | undefined) => (name ?? '').split(' · ')[0] || 'the other side';

type MobileTab = 'brief' | 'chat' | 'radar' | 'details' | 'versions';

function Workspace({ orderId, accessKey }: { orderId: string; accessKey: string }) {
  const { order, error, busy, run, scheduleRefresh, refresh } = useOrder(orderId, accessKey);
  // Remember a customer link on this device only after the server confirms it is the customer's key.
  useEffect(() => {
    if (order?.role === 'customer' && !inFrame()) saveCustomerKey(orderId, accessKey);
  }, [order?.role, orderId, accessKey]);
  const isXl = useMediaQuery('(min-width: 1280px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const reduce = useReducedMotion();

  // ------------------------------------------------------------- Nexconn connection
  const [nexconnEnabled, setNexconnEnabled] = useState<boolean | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectNonce, setConnectNonce] = useState(0);
  const connected = useRef(false);
  useEffect(() => {
    if (!order || connected.current) return;
    connected.current = true;
    (async () => {
      const cfg = await getConfig();
      setNexconnEnabled(cfg.nexconn.enabled);
      if (!cfg.nexconn.enabled) return;
      try {
        await initEngine('sdk');
        await connect(async (refreshToken) => {
          const t = await api.nexconnToken({ orderId, refresh: refreshToken }, accessKey);
          return { token: t.token, userId: t.userId };
        });
        setConnectError(null);
      } catch (e) {
        if (e instanceof NexconnDisabled) return setNexconnEnabled(false);
        setConnectError((e as Error).message);
        connected.current = false;
      }
    })();
  }, [order, orderId, accessKey, connectNonce]);

  const channel = useChannel(order?.channel.channelId ?? null, Boolean(nexconnEnabled), (p) => p.orderId === orderId && scheduleRefresh());
  const me = order?.participants.find((p) => p.role === order.role)?.nexconnUserId ?? getSnapshot().userId;

  // ------------------------------------------------------------- UI state
  const [refId, setRefId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>('rect');
  const [pending, setPending] = useState<PendingRegion | null>(null);
  const [panel, setPanel] = useState<Panel>('chat');
  const [mobileTab, setMobileTab] = useState<MobileTab>('brief');
  const [proposeOpen, setProposeOpen] = useState(false);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [threadSheet, setThreadSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const liveRefs = useMemo(() => order?.references.filter((r) => !r.removed) ?? [], [order]);
  const ref = liveRefs.find((r) => r.id === refId) ?? liveRefs[0] ?? null;
  const refAnnotations = useMemo(() => (order && ref ? order.annotations.filter((a) => a.referenceId === ref.id) : []), [order, ref]);
  const ordered = useMemo(() => order?.annotations.filter((a) => liveRefs.some((r) => r.id === a.referenceId)) ?? [], [order, liveRefs]);
  const selectedAnn = order?.annotations.find((a) => a.id === selected) ?? null;
  const locked = order ? order.status === 'agreed' || order.status === 'completed' : true;
  const latest = order?.versions.find((v) => v.id === order.latestVersionId) ?? null;
  const agreedVersion = order?.versions.find((v) => v.id === order.agreedVersionId) ?? null;
  const awaitingMe = Boolean(latest && latest.status === 'proposed' && !latest.approvals.some((a) => a.role === order?.role));
  // I approved the current version; only the other side is left.
  const awaitingOther = Boolean(latest && latest.status === 'proposed' && latest.approvals.some((a) => a.role === order?.role && a.decision === 'approved'));
  const names = useMemo(() => Object.fromEntries((order?.participants ?? []).map((p) => [p.role, p.name])) as Record<Role, string>, [order]);

  useEffect(() => {
    if (!isMd) setTool((t) => (t === 'rect' ? 'select' : t)); // on phones, marking is an explicit mode so scrolling stays natural
  }, [isMd]);

  const selectAnnotation = useCallback(
    (id: string | null) => {
      setSelected(id);
      setPending(null);
      if (!id || !order) return;
      const a = order.annotations.find((x) => x.id === id);
      if (a) setRefId(a.referenceId);
      if (!isXl && isMd) setPanel('notes');
      if (!isMd) {
        setMobileTab('brief');
        setThreadSheet(true);
      }
    },
    [order, isXl, isMd],
  );

  const goTo = useCallback(
    (dir: 1 | -1) => {
      if (!ordered.length) return;
      const i = ordered.findIndex((a) => a.id === selected);
      const next = ordered[(i + dir + ordered.length) % ordered.length];
      selectAnnotation(next.id);
    },
    [ordered, selected, selectAnnotation],
  );

  // Keyboard: J/K or ←/→ navigate annotations, V/R/P tools, Esc clears.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      if (e.key === 'Escape') {
        setPending(null);
        setSelected(null);
      } else if (e.key === 'j' || e.key === 'ArrowRight') goTo(1);
      else if (e.key === 'k' || e.key === 'ArrowLeft') goTo(-1);
      else if (e.key === 'v') setTool('select');
      else if (e.key === 'r') setTool('rect');
      else if (e.key === 'p') setTool('point');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [goTo]);

  if (error && !order)
    return (
      <FullPageMessage title={error.status === 403 ? "You don't have access to this brief" : 'This brief could not be opened'} action={<Button onClick={() => void refresh()}>Try again</Button>}>
        {error.message}
      </FullPageMessage>
    );
  if (!order) return <PageLoader label="Opening the brief…" />;

  const t = templateFor(order.template);
  const role = order.role;
  const other = otherRole(role);

  // ------------------------------------------------------------- actions
  const upload = async (files: FileList | File[]) => {
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        const blob = await compressImage(f);
        const r = await run('upload', (k) => api.uploadReference(order.id, k, blob, f.name.replace(/\.[^.]+$/, '').slice(0, 60)), { success: 'Reference added' });
        if (r) setRefId(r.result.referenceId);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  };

  const saveAnnotation = async (d: AnnotationDraft) => {
    if (!pending || !ref) return;
    const r = await run('annotate', (k) => api.createAnnotation(order.id, k, { referenceId: ref.id, kind: d.kind, note: d.note, color: d.color, ...pending }), { success: undefined });
    if (r) {
      setPending(null);
      toast.success(`Marked #${r.result.number} — ${names[other]} will see it`);
      selectAnnotation(r.result.annotationId);
    }
  };

  const threadActions = selectedAnn && {
    reply: async (body: string) => Boolean(await run('reply', (k) => api.commentAnnotation(order.id, k, selectedAnn.id, body))),
    resolution: async (action: 'request' | 'confirm' | 'cancel' | 'reopen') => {
      await run('resolution', (k) => api.annotationResolution(order.id, k, selectedAnn.id, action), {
        success: action === 'request' ? `Asked ${names[other]} to confirm` : action === 'confirm' ? `#${selectedAnn.number} resolved` : undefined,
      });
    },
    remove: async () => {
      if (await run('remove', (k) => api.deleteAnnotation(order.id, k, selectedAnn.id), { success: `#${selectedAnn.number} removed` })) setSelected(null);
    },
    raiseClarification: async () => {
      const r = await run('raise', (k) => api.raiseClarification(order.id, k, { title: `About #${selectedAnn.number}: ${selectedAnn.note || 'please clarify this area'}`.slice(0, 160), critical: true, annotationId: selectedAnn.id }), { success: 'Added to To-do' });
      if (r) openPanel('radar');
    },
  };

  const radarActions: RadarActions = {
    raise: async (input) => Boolean(await run('raise', (k) => api.raiseClarification(order.id, k, input), { success: 'Question sent' })),
    reply: async (id, body) => Boolean(await run(`reply-${id}`, (k) => api.commentClarification(order.id, k, id, body))),
    resolve: async (id, resolution) => Boolean(await run(`resolve-${id}`, (k) => api.updateClarification(order.id, k, id, { action: 'resolve', resolution }), { success: 'Resolved' })),
    reopen: async (id) => void (await run(`reopen-${id}`, (k) => api.updateClarification(order.id, k, id, { action: 'reopen' }))),
    setCritical: async (id, critical) => void (await run(`crit-${id}`, (k) => api.updateClarification(order.id, k, id, { action: 'set_critical', critical }))),
    analyse: async () => {
      const recent = channel.messages
        .filter((m) => m.kind === 'text' && m.text)
        .slice(-60)
        .map((m) => ({ id: m.id, text: m.text! }));
      const r = await run('analyse', (k) => api.analyse(order.id, k, recent));
      return r ? r.result : null;
    },
    ask: async (s, question, critical) => void (await run(`ask-${s.id}`, (k) => api.suggestion(order.id, k, s.id, { action: 'ask', question, critical }), { success: `Asked the ${other}` })),
    dismiss: async (s) => void (await run(`dismiss-${s.id}`, (k) => api.suggestion(order.id, k, s.id, { action: 'dismiss' }))),
    focusAnnotation: (id) => selectAnnotation(id),
    focusSpec: (key) => focusSpec(key),
  };

  function openPanel(p: Panel) {
    if (isMd) setPanel(p === 'notes' && isXl ? 'chat' : p);
    else setMobileTab(p === 'notes' ? 'brief' : p);
  }
  function focusSpec(key: string) {
    openPanel('details');
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-spec-field="${key}"] input, [data-spec-field="${key}"] select, [data-spec-field="${key}"] textarea, [data-spec-field="${key}"] button`);
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      el?.focus({ preventScroll: true });
    }, 120);
  }
  const onBlocker = (b: Blocker) => (b.kind === 'required_field' ? focusSpec(b.id) : b.kind === 'open_question' ? selectAnnotation(b.id) : openPanel('radar'));
  const onFocusTarget = (f: FocusTarget) => {
    if (f.kind === 'annotation') return selectAnnotation(f.id);
    if (f.kind === 'reference') {
      setRefId(f.id);
      return isMd ? undefined : setMobileTab('brief');
    }
    if (f.kind === 'clarification') return openPanel('radar');
    if (f.kind === 'spec') return openPanel('details');
    if (f.kind === 'version') {
      setCompareTarget(f.id);
      return openPanel('versions');
    }
  };

  const decide = async (decision: 'approved' | 'changes_requested', reason?: string) => {
    if (!latest) return false;
    const r = await run('decide', (k) => api.decide(order.id, k, latest.id, { decision, snapshotHash: latest.snapshotHash, reason }));
    if (r?.result.agreed) toast.success('Agreed! Both of you approved the same version.');
    else if (r) toast.success(decision === 'approved' ? `You approved version ${latest.number}. Waiting for ${names[other]}.` : 'Change request sent');
    return Boolean(r);
  };

  const share = async () => {
    if (!order.inviteKey) return;
    const link = `${await shareBase()}/o/${order.id}?k=${order.inviteKey}`;
    await copyWithToast(link, 'Customer link copied — send it on WhatsApp or Instagram');
  };

  // ------------------------------------------------------------- panels
  const notesPanel = (
    <div className="grid gap-3 p-4">
      {selectedAnn && threadActions ? (
        <>
          <Button variant="ghost" size="sm" className="-ml-2 justify-self-start" onClick={() => setSelected(null)}>
            <ArrowLeft /> All marks
          </Button>
          <AnnotationThread a={selectedAnn} reference={order.references.find((r) => r.id === selectedAnn.referenceId)} role={role} locked={locked} busy={busy} actions={threadActions} names={names} />
        </>
      ) : ordered.length ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {ordered.length} mark{ordered.length > 1 ? 's' : ''} · {ordered.filter((a) => a.status === 'resolved').length} sorted out
          </p>
          <div className="grid gap-1">
            {ordered.map((a) => (
              <AnnotationListItem key={a.id} a={a} reference={order.references.find((r) => r.id === a.referenceId)} role={role} selected={a.id === selected} onSelect={() => selectAnnotation(a.id)} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={Crosshair} title="Nothing marked yet">
          {liveRefs.length ? 'Pick “Draw a box”, then drag on the photo to show what to keep, change, add or remove.' : 'Add a reference image first.'}
        </EmptyState>
      )}
    </div>
  );

  const versionsPanel = (
    <div className="grid gap-4 p-4">
      {agreedVersion && (order.status === 'agreed' || order.status === 'completed') ? (
        <AgreementCard order={order} version={agreedVersion} />
      ) : latest?.status === 'proposed' ? (
        <ApprovalCard order={order} version={latest} busy={busy} onApprove={async () => void (await decide('approved'))} onRequestChanges={(r) => decide('changes_requested', r)} onCompare={() => setCompareTarget(latest.id)} />
      ) : latest?.status === 'changes_requested' ? (
        <ErrorState title={`Changes requested on version ${latest.number}`} action={!locked && <Button size="sm" onClick={() => setProposeOpen(true)}>Send version {latest.number + 1} for approval</Button>}>
          “{latest.approvals.find((a) => a.decision === 'changes_requested')?.reason}”
        </ErrorState>
      ) : null}
      {order.versions.length > 0 ? (
        <>
          <section aria-labelledby="cmp-h" className="grid gap-3">
            <h3 id="cmp-h" className="flex items-center gap-2 text-sm font-bold text-foreground">
              <GitCompareArrows className="size-4" aria-hidden /> Compare versions
            </h3>
            <CompareView key={compareTarget ?? 'latest'} order={order} initialTargetId={compareTarget} />
          </section>
          <section aria-labelledby="hist-h" className="grid gap-2">
            <h3 id="hist-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              History
            </h3>
            <VersionHistory order={order} selectedId={compareTarget ?? latest?.id ?? null} onSelect={(v) => setCompareTarget(v.id)} />
          </section>
        </>
      ) : (
        <EmptyState icon={FileText} title="Nothing to approve yet" action={!locked && <Button onClick={() => setProposeOpen(true)}>Send for approval</Button>}>
          When the photo, marks and details look right, send them for approval. Once you both press Approve, the order is confirmed.
        </EmptyState>
      )}
    </div>
  );

  const chatPanel = (
    <ChatPanel
      className="h-full"
      order={order}
      enabled={nexconnEnabled !== false}
      conn={channel.conn}
      messages={channel.messages}
      hasMore={channel.hasMore}
      loading={channel.loading}
      error={channel.error}
      myUserId={me}
      onLoadOlder={channel.loadOlder}
      onSendText={channel.sendText}
      onSendImage={channel.sendImage}
      onFocus={onFocusTarget}
      onAddToBrief={(url) => void run('import', (k) => api.importReference(order.id, k, url), { success: 'Photo added to the brief' }).then((r) => r && setRefId(r.result.referenceId))}
      connectError={connectError}
      onRetry={() => {
        connected.current = false;
        setConnectError(null);
        setConnectNonce((n) => n + 1);
      }}
    />
  );
  const radarPanel = <RadarPanel order={order} role={role} locked={locked} busy={busy} actions={radarActions} onBlocker={onBlocker} />;
  const detailsPanel = <SpecEditor order={order} role={role} locked={locked} saving={busy === 'spec'} onSave={async (patch) => Boolean(await run('spec', (k) => api.updateSpec(order.id, k, patch), { success: 'Saved — the other side is notified' }))} />;
  const panels: Record<Panel, React.ReactNode> = { notes: notesPanel, chat: chatPanel, radar: radarPanel, details: detailsPanel, versions: versionsPanel };
  const openRadarCount = order.clarifications.filter((c) => c.status !== 'resolved').length + order.blockers.filter((b) => b.kind === 'required_field').length;
  const tabMeta: { id: Panel; label: string; icon: typeof MessageSquare; badge?: number }[] = [
    ...(!isXl ? [{ id: 'notes' as Panel, label: 'Marks', icon: Crosshair, badge: ordered.filter((a) => a.status !== 'resolved').length }] : []),
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'radar', label: 'To-do', icon: Radar, badge: openRadarCount },
    { id: 'details', label: 'Details', icon: ClipboardList },
    { id: 'versions', label: 'Approve', icon: FileText, badge: awaitingMe ? 1 : 0 },
  ];

  // ------------------------------------------------------------- canvas column
  const canvasColumn = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!locked && liveRefs.length > 0 && (
          <div className="inline-flex rounded-lg glass-panel p-1 shadow-xs" role="radiogroup" aria-label="Canvas tool">
            {(
              [
                ['select', MousePointer2, 'Look', 'V', 'Look around and open marks'],
                ['rect', Square, 'Draw a box', 'R', 'Drag on the photo to draw a box'],
                ['point', Crosshair, 'Point', 'P', 'Tap one spot on the photo'],
              ] as const
            ).map(([id, Icon, label, kbd, help]) => (
              <Tooltip key={id} content={`${help} (${kbd})`}>
                <button role="radio" aria-checked={tool === id} onClick={() => setTool(id)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', tool === id && 'bg-primary text-primary-foreground')}>
                  <Icon className="size-4" aria-hidden />
                  <span className={cn(id === 'select' && 'max-sm:sr-only')}>{label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        )}
        {ordered.length > 0 && (
          <div className="ml-auto inline-flex items-center gap-1 rounded-lg glass-panel p-1 shadow-xs">
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(-1)} aria-label="Previous mark">
              <ChevronLeft />
            </Button>
            <span className="min-w-20 text-center text-xs font-semibold tabular-nums text-muted-foreground" aria-live="polite">
              {selectedAnn ? `Mark ${ordered.findIndex((a) => a.id === selectedAnn.id) + 1} of ${ordered.length}` : `${ordered.length} mark${ordered.length > 1 ? 's' : ''}`}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(1)} aria-label="Next mark">
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      <div className="relative flex min-h-[320px] flex-1 flex-col">
        {ref ? (
          <ReferenceCanvas className="flex-1" reference={ref} annotations={refAnnotations} selectedId={selected} onSelect={selectAnnotation} tool={locked ? 'select' : tool} canEdit={!locked} pending={pending} onRegion={(r) => {
            setSelected(null);
            setPending(r);
          }} />
        ) : (
          <EmptyState
            className="flex-1"
            icon={Images}
            title="Start with “something like this”"
            action={
              !locked && (
                <Button onClick={() => fileRef.current?.click()} loading={busy === 'upload'}>
                  <ImagePlus /> Upload a reference image
                </Button>
              )
            }
          >
            Upload a photo of what you have in mind — then mark exactly what to keep, change, add or remove.
          </EmptyState>
        )}
        {ref && !locked && !pending && !selected && tool !== 'select' && (
          <p className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg">
            {tool === 'rect' ? '👆 Drag on the photo to draw a box around what you mean' : '👆 Tap the spot you want to talk about'}
          </p>
        )}
        <AnimatePresence>
          {pending && ref && isMd && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute inset-x-3 bottom-3 z-40 mx-auto max-h-[calc(100%-1.5rem)] max-w-lg overflow-y-auto overscroll-contain rounded-xl glass-panel-elevated p-4">
              <AnnotationComposer region={pending} imageUrl={ref.url} busy={busy === 'annotate'} onSave={saveAnnotation} onCancel={() => setPending(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Reference images">
        {liveRefs.map((r) => (
          <div key={r.id} className="group relative shrink-0">
            <button onClick={() => setRefId(r.id)} aria-pressed={ref?.id === r.id} aria-label={`Show reference ${r.caption || ''}`} className={cn('block size-16 overflow-hidden rounded-md border-2 bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', ref?.id === r.id ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100')}>
              <img src={r.url} alt="" className="size-full object-cover" loading="lazy" />
            </button>
            {order.annotations.some((a) => a.referenceId === r.id) && (
              <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 text-[10px] font-bold text-white">{order.annotations.filter((a) => a.referenceId === r.id).length}</span>
            )}
            {!locked && (
              <button onClick={() => run('removeRef', (k) => api.removeReference(order.id, k, r.id), { success: 'Reference removed' })} className="absolute -right-1.5 -top-1.5 hidden size-6 place-items-center rounded-full border border-border bg-surface-elevated text-muted-foreground shadow group-hover:grid group-focus-within:grid" aria-label="Remove this reference">
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <button onClick={() => fileRef.current?.click()} className="grid size-16 shrink-0 place-items-center rounded-md border-2 border-dashed border-border-strong text-muted-foreground transition-colors hover:border-primary hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Add a reference image">
            {busy === 'upload' ? <span className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-primary" /> : <ImagePlus className="size-5" />}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );

  // ------------------------------------------------------------- header
  const primaryAction = locked ? (
    <Button asChild variant="success" size="sm">
      <Link to={`/o/${order.id}/work-order`}>
        <FileText /> Work order
      </Link>
    </Button>
  ) : awaitingMe ? (
    <Button size="sm" variant="success" onClick={() => openPanel('versions')}>
      Review & approve
    </Button>
  ) : awaitingOther ? (
    <Button size="sm" variant="outline" onClick={() => openPanel('versions')}>
      <Clock3 /> Waiting for {firstName(names[otherRole(role)])}
    </Button>
  ) : (
    <Tooltip content="Lock in the photo, notes and price so you can both approve it">
      {/* Quieter for a customer who is waiting on the shop's changes, so the screen points to one thing to do. */}
      <Button size="sm" variant={role === 'customer' && order.status === 'changes_requested' ? 'outline' : 'primary'} onClick={() => setProposeOpen(true)}>
        <Send /> Send for approval
      </Button>
    </Tooltip>
  );

  const next = ORDER_STATUS_META[order.status].nextAction[role];
  const nextStep = (
    <div className="flex items-center gap-2 border-b border-primary/25 bg-primary-soft px-3 py-2 text-sm md:px-4" role="status">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 text-foreground">
        <span className="font-bold">Your next step:</span> {awaitingMe ? `Check version ${latest!.number} and approve it` : awaitingOther ? `You approved version ${latest!.number}. Waiting for ${firstName(names[otherRole(role)])} to approve it too` : next}
      </span>
    </div>
  );

  const header = (
    <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 md:gap-3 md:px-4">
      <Logo to={role === 'seller' ? `/seller/${order.shopId}` : '/'} compact />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold tracking-[-0.01em] text-foreground">{order.title}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {t.name} · {names.customer} × {order.shopName} · you are the {roleLabel(role).toLowerCase()}
        </p>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <StatusBadge status={order.status} />
        {latest && <Badge tone="outline">v{latest.number}</Badge>}
        <ConnectionPill state={nexconnEnabled === false ? 'disabled' : channel.conn.state} />
      </div>
      {primaryAction}
      <DropdownMenu>
        <DropdownMenuTrigger className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="More actions">
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {role === 'seller' && order.inviteKey && (
            <DropdownMenuItem onSelect={share}>
              <Link2 /> Copy customer link
            </DropdownMenuItem>
          )}
          {role === 'seller' && order.inviteKey && (
            <DropdownMenuItem onSelect={async () => window.open(whatsappLink(`Hi ${names.customer}! Here's our private brief room for your order with ${order.shopName}: ${await shareBase()}/o/${order.id}?k=${order.inviteKey}`), '_blank', 'noopener')}>
              <MessageSquare /> Share on WhatsApp
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={`/o/${order.id}/work-order`}>
              <FileText /> Work order {locked ? '' : '(draft preview)'}
            </Link>
          </DropdownMenuItem>
          {role === 'seller' && order.status === 'agreed' && (
            <DropdownMenuItem onSelect={() => run('reopen', (k) => api.reopen(order.id, k), { success: 'Brief reopened — the agreed version stays on record' })}>Reopen agreed brief</DropdownMenuItem>
          )}
          {role === 'seller' && order.status === 'agreed' && <DropdownMenuItem onSelect={() => run('complete', (k) => api.complete(order.id, k), { success: 'Order marked completed' })}>Mark completed</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle className="hidden sm:grid" />
    </header>
  );

  const propose = <ProposeDialog order={order} open={proposeOpen} onOpenChange={setProposeOpen} busy={busy} onBlocker={onBlocker} onPropose={async (note) => {
    const r = await run('propose', (k) => api.propose(order.id, k, note));
    if (r) {
      toast.success(`Version ${r.result.number} sent for approval`);
      setCompareTarget(r.result.versionId);
      openPanel('versions');
    }
    return Boolean(r);
  }} />;

  // ------------------------------------------------------------- layouts
  if (!isMd) {
    const mobileTabs: { id: MobileTab; label: string; icon: typeof MessageSquare; badge?: number }[] = [
      { id: 'brief', label: 'Photo', icon: Images },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'radar', label: 'To-do', icon: Radar, badge: openRadarCount },
      { id: 'details', label: 'Details', icon: ClipboardList },
      { id: 'versions', label: 'Approve', icon: FileText, badge: awaitingMe ? 1 : 0 },
    ];
    return (
      <div className="app-shell flex h-dvh flex-col">
        {header}
        {nextStep}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-divider bg-surface px-3 py-1.5">
          <StatusBadge status={order.status} />
          {latest && <Badge tone="outline">v{latest.number}</Badge>}
          <ConnectionPill state={nexconnEnabled === false ? 'disabled' : channel.conn.state} />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {mobileTab === 'brief' && (
            <div className="flex min-h-full flex-col">
              <div className="flex h-[62dvh] min-h-[340px] flex-col">{canvasColumn}</div>
              {notesPanel}
            </div>
          )}
          {mobileTab === 'chat' && <div className="h-full">{chatPanel}</div>}
          {mobileTab === 'radar' && radarPanel}
          {mobileTab === 'details' && detailsPanel}
          {mobileTab === 'versions' && versionsPanel}
        </main>
        {awaitingMe && mobileTab !== 'versions' && (
          <div className="border-t border-info/30 bg-info-bg px-3 py-2">
            <Button variant="success" className="w-full" onClick={() => setMobileTab('versions')}>
              Review & approve version {latest!.number}
            </Button>
          </div>
        )}
        <nav className="grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Workspace sections">
          {mobileTabs.map((tab) => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)} aria-current={mobileTab === tab.id ? 'page' : undefined} className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', mobileTab === tab.id ? 'text-primary-text' : 'text-muted-foreground')}>
              <tab.icon className="size-5" aria-hidden />
              {tab.label}
              {Boolean(tab.badge) && <span className="absolute right-[22%] top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{tab.badge}</span>}
            </button>
          ))}
        </nav>
        <Dialog open={Boolean(pending && ref)} onOpenChange={(o) => !o && setPending(null)}>
          {pending && ref && (
            <SheetContent side="bottom" title="New annotation" description="Say what you want in the part you picked.">
              <div className="p-4">
                <AnnotationComposer region={pending} imageUrl={ref.url} busy={busy === 'annotate'} onSave={saveAnnotation} onCancel={() => setPending(null)} />
              </div>
            </SheetContent>
          )}
        </Dialog>
        <Dialog open={threadSheet && Boolean(selectedAnn)} onOpenChange={setThreadSheet}>
          {selectedAnn && threadActions && (
            <SheetContent side="bottom" title={`Annotation #${selectedAnn.number}`}>
              <div className="p-4">
                <AnnotationThread a={selectedAnn} reference={order.references.find((r) => r.id === selectedAnn.referenceId)} role={role} locked={locked} busy={busy} actions={threadActions} names={names} />
              </div>
            </SheetContent>
          )}
        </Dialog>
        {propose}
      </div>
    );
  }

  return (
    <div className="app-shell flex h-dvh flex-col">
      {header}
      {nextStep}
      <div className={cn('grid min-h-0 flex-1', isXl ? 'grid-cols-[300px_minmax(0,1fr)_400px]' : 'grid-cols-[minmax(0,1fr)_minmax(320px,380px)]')}>
        {isXl && (
          <aside className="min-h-0 overflow-y-auto border-r border-border bg-surface" aria-label="Annotations">
            {notesPanel}
          </aside>
        )}
        <main className="flex min-h-0 flex-col bg-background" aria-label="Reference canvas">
          {canvasColumn}
        </main>
        <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-surface" aria-label="Conversation and decisions">
          <Tabs value={panel} onValueChange={(v) => setPanel(v as Panel)} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-w-0 border-b border-divider px-3 py-2">
              <TabsList className="flex w-full justify-start overflow-x-auto [scrollbar-width:none]">
                {tabMeta.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="relative min-w-0 flex-1 px-2">
                    <tab.icon aria-hidden />
                    <span className={cn(!isXl && 'max-lg:sr-only')}>{tab.label}</span>
                    {Boolean(tab.badge) && <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{tab.badge}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabMeta.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className={cn('min-h-0 min-w-0 flex-1', tab.id === 'chat' ? 'flex flex-col' : 'overflow-y-auto overflow-x-hidden')} forceMount={tab.id === 'chat' ? true : undefined} hidden={panel !== tab.id}>
                {panels[tab.id]}
              </TabsContent>
            ))}
          </Tabs>
        </aside>
      </div>
      {propose}
    </div>
  );
}

export type { OrderView };
