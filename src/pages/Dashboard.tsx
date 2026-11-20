import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageHandler, NCEngine } from '@nexconn/chat';
import { TEMPLATES, templateFor } from '../../shared/templates';
import { MSG, type OrderSummary, type ShopPublic, type StartContent } from '../../shared/types';
import ChatUIPanel from '../components/ChatUIPanel';
import { ErrorPage, Logo, Spinner, StatusChip, ago, copyText, useToast, whatsappLink } from '../components/ui';
import { api, publicBase, sellerKey } from '../lib/api';
import { connectNexconn, initNexconn, onChannelSelected, postCard } from '../lib/nexconn';

export default function Dashboard() {
  const { shopId = '' } = useParams();
  const key = sellerKey(shopId);
  const [shop, setShop] = useState<ShopPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    api
      .shop(shopId)
      .then(({ shop }) => setShop(shop))
      .catch((e) => setError(e.message));
    (async () => {
      await initNexconn();
      const t = await api.token({ key, shopId });
      await connectNexconn(t.token, t.userId);
      setChatReady(true);
    })().catch((e) => setChatError(e.message));
  }, [shopId, key]);

  if (!key) return <ErrorPage title="This isn't your dashboard">Open it on the device you created the shop with, or <a href="/start">create a shop</a>.</ErrorPage>;
  if (error) return <ErrorPage title="Shop not found">{error}</ErrorPage>;
  if (!shop) return <Spinner label="Loading your shop…" />;
  return <Shop shop={shop} sellerKey={key} chatReady={chatReady} chatError={chatError} />;
}

function Shop({ shop, sellerKey: key, chatReady, chatError }: { shop: ShopPublic; sellerKey: string; chatReady: boolean; chatError: string | null }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [tab, setTab] = useState<'orders' | 'inbox'>('orders');
  const [base, setBase] = useState('');
  const [customer, setCustomer] = useState('');
  const [template, setTemplate] = useState(shop.category);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<{ id: string; link: string; name: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => api.shopOrders(shop.id, key).then((r) => setOrders(r.orders)).catch(() => undefined), [shop.id, key]);

  useEffect(() => {
    load();
    publicBase().then(setBase);
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!chatReady) return;
    NCEngine.addMessageHandler(
      'briefroom-dash',
      new MessageHandler({ onMessageReceived: ({ messages }) => messages.some((m) => m.messageType.startsWith('BR:')) && load() }),
    );
    onChannelSelected((channelId) => setSelected(channelId));
    return () => {
      NCEngine.removeMessageHandler('briefroom-dash');
      onChannelSelected(null);
    };
  }, [chatReady, load]);

  const shopLink = `${base}/shop/${shop.id}`;

  const create = async () => {
    setCreating(true);
    try {
      const r = await api.createOrder(shop.id, { customerName: customer.trim() || 'Customer', template, title: title.trim() }, key);
      const link = `${base}/o/${r.orderId}?k=${r.customerKey}`;
      setInvite({ id: r.orderId, link, name: customer.trim() || 'there' });
      if (chatReady) {
        await postCard<StartContent>(`o${r.orderId}`, MSG.START, {
          title: title.trim() || `${templateFor(template).name} for ${customer.trim() || 'Customer'}`,
          template,
          by: 'seller',
        });
      }
      setCustomer('');
      setTitle('');
      load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setCreating(false);
    }
  };

  const list = orders ?? [];
  const waiting = list.filter((o) => o.status === 'proposed' || o.status === 'changes').length;
  const agreed = list.filter((o) => o.status === 'agreed');
  const agreedValue = agreed.reduce((n, o) => n + (o.price ?? 0), 0);

  return (
    <div className="dash">
      <header className="dash-head">
        <Logo href={`/seller/${shop.id}`} />
        <div>
          <b style={{ fontSize: 17 }}>{shop.name}</b>
          <div className="faint" style={{ fontSize: 13 }}>
            {shop.owner}
            {shop.city ? ` · ${shop.city}` : ''} · seller dashboard
          </div>
        </div>
        <span className="spacer" />
        <a className="btn ghost sm" href={shopLink} target="_blank" rel="noreferrer">
          View shop page ↗
        </a>
      </header>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{list.length}</div>
          <div className="k">briefs</div>
        </div>
        <div className="stat">
          <div className="v">{waiting}</div>
          <div className="k">awaiting approval</div>
        </div>
        <div className="stat">
          <div className="v">{agreed.length}</div>
          <div className="k">agreed orders</div>
        </div>
        <div className="stat">
          <div className="v">₹{agreedValue.toLocaleString('en-IN')}</div>
          <div className="k">agreed value</div>
        </div>
      </div>

      <div className="dash-grid">
        <aside>
          <div className="card panel">
            <h3>New brief for a customer</h3>
            <div className="stack">
              <div>
                <label className="label">Customer name</label>
                <input className="input" placeholder="e.g. Priya" value={customer} maxLength={40} onChange={(e) => setCustomer(e.target.value)} />
              </div>
              <div>
                <label className="label">What are they ordering?</label>
                <select className="select" value={template} onChange={(e) => setTemplate(e.target.value)}>
                  {Object.values(TEMPLATES).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Title (optional)</label>
                <input className="input" placeholder="e.g. Aditi's 25th birthday cake" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <button className="btn block" onClick={create} disabled={creating}>
                {creating ? 'Creating…' : 'Create brief room'}
              </button>
            </div>
            {invite && (
              <div style={{ marginTop: 16 }}>
                <div className="label">Send this private link to {invite.name}</div>
                <div className="linkbox">{invite.link}</div>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={async () => toast.show((await copyText(invite.link)) ? 'Link copied' : invite.link)}>
                    Copy
                  </button>
                  <a
                    className="btn ghost sm"
                    target="_blank"
                    rel="noreferrer"
                    href={whatsappLink(`Hi ${invite.name}! Here's our brief room for your order at ${shop.name}. Share photos, mark what you like, and approve the final design here: ${invite.link}`)}
                  >
                    WhatsApp
                  </a>
                  <a className="btn sm" href={`/o/${invite.id}`}>
                    Open room →
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="card panel">
            <h3>Your shop link</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
              Put it in your Instagram bio or WhatsApp status. Customers start their own brief, so no more 40-message DM threads.
            </p>
            <div className="linkbox">{shopLink}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn ghost sm" onClick={async () => toast.show((await copyText(shopLink)) ? 'Shop link copied' : shopLink)}>
                Copy
              </button>
              <a className="btn ghost sm" target="_blank" rel="noreferrer" href={whatsappLink(`Order a custom ${templateFor(shop.category).noun} from ${shop.name}: ${shopLink}`)}>
                WhatsApp
              </a>
            </div>
          </div>
        </aside>

        <main>
          <div className="tabs">
            <button className={`tab ${tab === 'orders' ? 'on' : ''}`} onClick={() => setTab('orders')}>
              Orders
            </button>
            <button className={`tab ${tab === 'inbox' ? 'on' : ''}`} onClick={() => setTab('inbox')}>
              💬 Inbox
            </button>
          </div>

          {tab === 'orders' &&
            (orders === null ? (
              <div className="card empty">Loading…</div>
            ) : list.length === 0 ? (
              <div className="card empty">
                <div className="big">🧁</div>
                <b>No briefs yet</b>
                <div>Create one on the left, or share your shop link so customers can start their own.</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="orders">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th className="hide-sm">Version</th>
                      <th className="hide-sm">Needed on</th>
                      <th>Price</th>
                      <th className="hide-sm">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((o) => (
                      <tr key={o.id} onClick={() => (window.location.href = `/o/${o.id}`)}>
                        <td>
                          <b>
                            {templateFor(o.template).emoji} {o.customerName}
                          </b>
                          <div className="faint" style={{ fontSize: 12.5 }}>
                            {o.title} · {o.refs} photos · {o.pins} pins
                          </div>
                        </td>
                        <td>
                          <StatusChip status={o.status} />
                        </td>
                        <td className="hide-sm">{o.latestVersion ? `v${o.latestVersion}` : '—'}</td>
                        <td className="hide-sm">{o.deliveryDate ? new Date(o.deliveryDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                        <td>{o.price !== null ? `₹${o.price.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="hide-sm faint">{ago(o.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          <div style={{ display: tab === 'inbox' ? 'block' : 'none' }}>
            {chatError ? (
              <div className="error-box">{chatError}</div>
            ) : !chatReady ? (
              <div className="card empty">Connecting to chat…</div>
            ) : (
              <>
                {selected && (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <span className="muted">Selected conversation</span>
                    <span className="spacer" />
                    <a className="btn sm" href={`/o/${selected.slice(1)}`}>
                      Open its brief room →
                    </a>
                  </div>
                )}
                <div className="inbox">
                  <ChatUIPanel mode="inbox" />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      {toast.node}
    </div>
  );
}
