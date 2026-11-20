import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChannelType, MessageHandler, NCEngine } from '@nexconn/chat';
import { templateFor } from '../../shared/templates';
import {
  MSG,
  missingRequired,
  otherRole,
  type DecisionContent,
  type OrderView,
  type PinContent,
  type RefContent,
  type SpecContent,
  type StartContent,
  type VersionContent,
} from '../../shared/types';
import ChatUIPanel from '../components/ChatUIPanel';
import RefCanvas from '../components/RefCanvas';
import SpecForm from '../components/SpecForm';
import Versions from '../components/Versions';
import { ErrorPage, Logo, Spinner, StatusChip, copyText, useToast } from '../components/ui';
import { api, compressImage, customerKey, imageSize, publicBase, saveCustomerKey, sellerKey } from '../lib/api';
import { connectNexconn, initNexconn, onAddToBrief, postCard } from '../lib/nexconn';

export default function Room() {
  const { orderId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ key: string; order: OrderView } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isNew = params.get('new') === '1';

  useEffect(() => {
    (async () => {
      let key = params.get('k');
      if (key) {
        saveCustomerKey(orderId, key);
        params.delete('k');
        setParams(params, { replace: true });
      } else key = customerKey(orderId);
      if (!key) {
        const meta = await api.meta(orderId);
        key = sellerKey(meta.shopId);
      }
      if (!key) throw new Error('This link is missing its access key. Ask the seller to resend your brief link.');
      const { order } = await api.order(orderId, key);
      await initNexconn();
      const t = await api.token({ key, orderId });
      await connectNexconn(t.token, t.userId);
      setState({ key, order });
    })().catch((e) => setError(e.message));
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorPage title="Can't open this brief">{error}</ErrorPage>;
  if (!state) return <Spinner label="Opening the brief room…" />;
  return <Workspace initial={state.order} accessKey={state.key} isNew={isNew} />;
}

type Tab = 'visual' | 'details' | 'versions';

function Workspace({ initial, accessKey, isNew }: { initial: OrderView; accessKey: string; isNew: boolean }) {
  const nav = useNavigate();
  const [order, setOrder] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.draft.refs.length ? 'visual' : initial.versions.length ? 'versions' : 'visual');
  const [mobile, setMobile] = useState<'brief' | 'chat'>('brief');
  const [activeRef, setActiveRef] = useState<string | null>(initial.draft.refs[0]?.id ?? null);
  const [focusPin, setFocusPin] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState<number | null>(null);
  const [modal, setModal] = useState<null | { kind: 'propose' } | { kind: 'changes'; n: number }>(null);
  const [modalText, setModalText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const orderRef = useRef(order);
  orderRef.current = order;

  const role = order.role;
  const other = otherRole(role);
  const t = templateFor(order.template);
  const latest = order.versions[order.versions.length - 1] ?? null;
  const locked = order.agreedVersion !== null;
  const missing = missingRequired(order.template, order.draft.spec);

  const refresh = useCallback(async () => {
    try {
      const { order } = await api.order(orderRef.current.id, accessKey);
      setOrder(order);
    } catch {
      /* transient */
    }
  }, [accessKey]);

  // Live sync: any BriefRoom card arriving in this order's Nexconn group triggers a refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    NCEngine.addMessageHandler(
      'briefroom-sync',
      new MessageHandler({
        onMessageReceived: ({ messages }) => {
          const hit = messages.some(
            (m) => m.channelIdentifier.channelType === ChannelType.GROUP && m.channelIdentifier.channelId === orderRef.current.channelId && m.messageType.startsWith('BR:'),
          );
          if (hit) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(refresh, 250);
          }
        },
      }),
    );
    const poll = setInterval(refresh, 15000);
    return () => {
      NCEngine.removeMessageHandler('briefroom-sync');
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  // First open of a freshly created order: drop the "brief room opened" card into the chat.
  useEffect(() => {
    if (!isNew) return;
    postCard<StartContent>(order.channelId, MSG.START, { title: order.title, template: order.template, by: role });
    const u = new URL(window.location.href);
    u.searchParams.delete('new');
    window.history.replaceState(null, '', u.toString());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chat card buttons -> focus the right thing in the brief.
  useEffect(() => {
    const onFocus = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      const o = orderRef.current;
      setMobile('brief');
      if (d.pinId) {
        const pin = o.draft.pins.find((p) => p.id === d.pinId);
        if (!pin) return toast.show('That pin was removed or changed.');
        setTab('visual');
        setActiveRef(pin.refId);
        setFocusPin(pin.id);
      } else if (d.refId) {
        setTab('visual');
        setActiveRef(d.refId);
      } else if (d.version) {
        setTab('versions');
        setFocusVersion(d.version);
        setTimeout(() => document.getElementById(`version-${d.version}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      } else if (d.workOrder) {
        nav(`/o/${o.id}/work-order`);
      }
    };
    window.addEventListener('briefroom:focus', onFocus);
    return () => window.removeEventListener('briefroom:focus', onFocus);
  }, [nav, toast]);

  // Chat UI message menu "Add to brief" on photos shared in chat.
  useEffect(() => {
    onAddToBrief(async (url, channelId) => {
      const o = orderRef.current;
      if (channelId !== o.channelId) return;
      try {
        const { w, h } = await imageSize(url);
        const r = await api.addRef(o.id, accessKey, { url, w, h, caption: 'From chat', fromChat: true });
        setOrder(r.order);
        setActiveRef(r.ref.id);
        setTab('visual');
        setMobile('brief');
        await postCard<RefContent>(o.channelId, MSG.REF, { refId: r.ref.id, url: r.ref.url, caption: 'Added from chat', by: o.role });
        toast.show('Photo added to the brief. Now drag on it to pin details.');
      } catch (e: any) {
        toast.show(e.message);
      }
    });
    return () => {
      onAddToBrief(null);
    };
  }, [accessKey, toast]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- actions */

  const upload = async (files: FileList) => {
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const img = await compressImage(file);
        const { url } = await api.upload(accessKey, img.dataUrl);
        const r = await api.addRef(order.id, accessKey, { url, w: img.w, h: img.h, caption: file.name.replace(/\.[^.]+$/, '').slice(0, 60) });
        setOrder(r.order);
        setActiveRef(r.ref.id);
        await postCard<RefContent>(order.channelId, MSG.REF, { refId: r.ref.id, url: absolute(r.ref.url), caption: r.ref.caption, by: role });
      } catch (e: any) {
        toast.show(e.message);
      }
    }
  };

  const addPin: Parameters<typeof RefCanvas>[0]['onAddPin'] = async (p) => {
    const r = await api.addPin(order.id, accessKey, p);
    setOrder(r.order);
    const ref = r.order.draft.refs.find((x) => x.id === p.refId)!;
    await postCard<PinContent>(order.channelId, MSG.PIN, {
      pinId: r.pin.id,
      n: r.pin.n,
      url: absolute(ref.url),
      x: r.pin.x,
      y: r.pin.y,
      w: r.pin.w,
      h: r.pin.h,
      kind: r.pin.kind,
      note: r.pin.note,
      color: r.pin.color,
      by: role,
    });
    toast.show(`Pin #${r.pin.n} sent to the ${other}.`);
  };

  const saveSpec = async (patch: Record<string, unknown>) => {
    try {
      const r = await api.saveSpec(order.id, accessKey, patch);
      setOrder(r.order);
      if (r.changes.length) await postCard<SpecContent>(order.channelId, MSG.SPEC, { changes: r.changes, by: role });
      toast.show('Saved. The other side can see the changes.');
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  const propose = () =>
    run(async () => {
      const r = await api.propose(order.id, accessKey, modalText.trim());
      setOrder(r.order);
      setModal(null);
      setModalText('');
      setTab('versions');
      const v = r.version;
      await postCard<VersionContent>(order.channelId, MSG.VERSION, {
        n: v.n,
        price: typeof v.snapshot.spec.price === 'number' ? v.snapshot.spec.price : null,
        changes: v.changes.slice(0, 8),
        note: v.note,
        hash: v.hash,
        by: role,
      });
      toast.show(`Version ${v.n} sent for approval.`);
    });

  const approve = (n: number) =>
    run(async () => {
      const r = await api.decide(order.id, accessKey, n, 'approve');
      setOrder(r.order);
      await postCard<DecisionContent>(order.channelId, MSG.DECISION, { n, decision: 'approve', by: role });
      if (r.agreed) {
        const v = r.version;
        await postCard<DecisionContent>(order.channelId, MSG.DECISION, {
          n,
          decision: 'agreed',
          hash: v.hash,
          price: typeof v.snapshot.spec.price === 'number' ? v.snapshot.spec.price : null,
          by: role,
        });
        toast.show('🤝 Agreed! Both of you approved the same version.');
      } else toast.show(`You approved version ${n}. Waiting for the ${other}.`);
    });

  const requestChanges = () =>
    run(async () => {
      if (modal?.kind !== 'changes') return;
      const r = await api.decide(order.id, accessKey, modal.n, 'changes', modalText.trim());
      setOrder(r.order);
      await postCard<DecisionContent>(order.channelId, MSG.DECISION, { n: modal.n, decision: 'changes', reason: modalText.trim(), by: role });
      setModal(null);
      setModalText('');
    });

  const reopen = () =>
    run(async () => {
      if (!confirm('Reopen the agreed brief? The agreed version stays on record; any change becomes a new version that needs approval again.')) return;
      const r = await api.reopen(order.id, accessKey);
      setOrder(r.order);
      await postCard<DecisionContent>(order.channelId, MSG.DECISION, { n: order.agreedVersion ?? 0, decision: 'reopen', by: role });
    });

  const shareInvite = async () => {
    if (!order.inviteKey) return;
    const link = `${await publicBase()}/o/${order.id}?k=${order.inviteKey}`;
    const ok = await copyText(link);
    toast.show(ok ? 'Customer link copied - send it on WhatsApp or Instagram.' : link);
  };

  /* ---------------------------------------------------------------- banner */

  const banner = (() => {
    if (locked) {
      const v = order.versions[order.agreedVersion! - 1];
      const price = v.snapshot.spec.price;
      return (
        <div className="banner agreed">
          <span className="ico">🤝</span>
          <div className="txt">
            <b>Agreed on version {v.n}{typeof price === 'number' ? ` · ₹${price.toLocaleString('en-IN')}` : ''}</b>
            Both of you approved the exact same photos, pins and details. Agreement <span className="mono">#{v.hash.slice(0, 10)}</span>
          </div>
          <a className="btn ok" href={`/o/${order.id}/work-order`}>
            Open work order
          </a>
          {role === 'seller' && (
            <button className="btn ghost sm" onClick={reopen} disabled={busy}>
              Reopen
            </button>
          )}
        </div>
      );
    }
    if (latest && !order.draftDirty && !latest.changeRequest) {
      const mine = latest.approvals[role];
      return (
        <div className="banner proposed">
          <span className="ico">{mine ? '⏳' : '📄'}</span>
          <div className="txt">
            <b>{mine ? `You approved version ${latest.n}` : `Version ${latest.n} is waiting for your approval`}</b>
            {mine ? `Waiting for the ${other} to approve the same version.` : `Proposed by ${latest.proposedBy === role ? 'you' : `the ${latest.proposedBy}`}. Check the photos, pins and details, then approve or ask for changes.`}
          </div>
          {!mine && (
            <>
              <button className="btn warn" onClick={() => setModal({ kind: 'changes', n: latest.n })} disabled={busy}>
                Request changes
              </button>
              <button className="btn ok" onClick={() => approve(latest.n)} disabled={busy}>
                ✓ Approve v{latest.n}
              </button>
            </>
          )}
        </div>
      );
    }
    if (latest?.changeRequest && !order.draftDirty)
      return (
        <div className="banner changes">
          <span className="ico">↩️</span>
          <div className="txt">
            <b>{latest.changeRequest.by === role ? 'You asked for changes' : `The ${latest.changeRequest.by} asked for changes`} on version {latest.n}</b>
            “{latest.changeRequest.reason}” Update the photos, pins or details, then propose version {latest.n + 1}.
          </div>
        </div>
      );
    return (
      <div className="banner draft">
        <span className="ico">✍️</span>
        <div className="txt">
          <b>{latest ? `Draft has changes not in version ${latest.n}` : 'Building the brief together'}</b>
          {latest ? 'Propose a new version so both of you can approve it.' : 'Add reference photos, pin what to keep or change, and fill in the details. Then propose version 1.'}
        </div>
        <button className="btn" onClick={() => setModal({ kind: 'propose' })} disabled={busy}>
          Propose version {(latest?.n ?? 0) + 1}
        </button>
      </div>
    );
  })();

  return (
    <div className="room">
      <header className="room-top">
        <Logo href={role === 'seller' ? `/seller/${order.shopId}` : '/'} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>
            {t.emoji} {order.title}
          </h1>
          <div className="faint" style={{ fontSize: 12.5 }}>
            {order.shopName} × {order.customerName} · you are the <b>{role}</b>
          </div>
        </div>
        <StatusChip status={order.status} />
        {role === 'seller' && order.inviteKey && (
          <button className="btn ghost sm hide-sm" onClick={shareInvite}>
            🔗 Customer link
          </button>
        )}
        <a className="btn ghost sm hide-sm" href={`/o/${order.id}/work-order`}>
          Work order
        </a>
      </header>
      <div className="mobile-switch">
        <button className={`tab ${mobile === 'brief' ? 'on' : ''}`} onClick={() => setMobile('brief')}>
          📋 Brief
        </button>
        <button className={`tab ${mobile === 'chat' ? 'on' : ''}`} onClick={() => setMobile('chat')}>
          💬 Chat
        </button>
      </div>
      <div className={`room-grid show-${mobile}`}>
        <section className="chat-col" aria-label="Conversation">
          <ChatUIPanel mode="room" channelId={order.channelId} />
        </section>
        <main className="work">
          {banner}
          {!locked && missing.length > 0 && (
            <div className="ready">
              <span className="muted">Needed before anyone can approve:</span>
              {missing.map((m) => (
                <span key={m} className="miss">
                  {m}
                </span>
              ))}
            </div>
          )}
          <div className="tabs">
            <button className={`tab ${tab === 'visual' ? 'on' : ''}`} onClick={() => setTab('visual')}>
              🖼 Visual brief · {order.draft.pins.length} pins
            </button>
            <button className={`tab ${tab === 'details' ? 'on' : ''}`} onClick={() => setTab('details')}>
              🧾 Details
            </button>
            <button className={`tab ${tab === 'versions' ? 'on' : ''}`} onClick={() => setTab('versions')}>
              📄 Versions · {order.versions.length}
            </button>
          </div>

          {tab === 'visual' && (
            <RefCanvas
              refs={order.draft.refs}
              pins={order.draft.pins}
              role={role}
              locked={locked}
              activeRefId={activeRef}
              focusPinId={focusPin}
              onSelectRef={(id) => {
                setActiveRef(id);
                setFocusPin(null);
              }}
              onUpload={upload}
              onRemoveRef={(id) => run(async () => setOrder((await api.removeRef(order.id, accessKey, id)).order))}
              onAddPin={addPin}
              onTogglePin={(p) => run(async () => setOrder((await api.updatePin(order.id, accessKey, p.id, { resolved: !p.resolved })).order))}
              onRemovePin={(p) => run(async () => setOrder((await api.removePin(order.id, accessKey, p.id)).order))}
              onFocusPin={setFocusPin}
            />
          )}
          {tab === 'details' && <SpecForm template={order.template} spec={order.draft.spec} role={role} locked={locked} onSave={saveSpec} />}
          {tab === 'versions' && <Versions order={order} focusVersion={focusVersion} onApprove={approve} onRequestChanges={(n) => setModal({ kind: 'changes', n })} />}
        </main>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            {modal.kind === 'propose' ? (
              <>
                <h3 style={{ marginTop: 0 }}>Propose version {(latest?.n ?? 0) + 1}</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  This freezes the current photos, pins and details into a version. The {other} reviews it and approves or asks for changes.
                </p>
                {missing.length > 0 && <div className="error-box" style={{ marginBottom: 12 }}>Still missing: {missing.join(', ')}. You can propose now, but nobody can approve until these are filled.</div>}
                <textarea className="textarea" placeholder="Optional note, e.g. 'Switched to eggless, price updated'" value={modalText} maxLength={300} onChange={(e) => setModalText(e.target.value)} />
                <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={propose} disabled={busy}>
                    {busy ? 'Sending…' : 'Send for approval'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>What should change in version {modal.n}?</h3>
                <textarea className="textarea" autoFocus placeholder="e.g. Make the flowers lighter pink and change the message to 'Happy 25th, Aditi'" value={modalText} maxLength={500} onChange={(e) => setModalText(e.target.value)} />
                <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button className="btn warn" onClick={requestChanges} disabled={busy || !modalText.trim()}>
                    Send change request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

/** Cards travel through Nexconn to other devices, so image URLs must be absolute. */
function absolute(url: string) {
  return url.startsWith('http') ? url : `${window.location.origin}${url}`;
}
