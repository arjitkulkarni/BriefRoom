import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TEMPLATES } from '../../shared/templates';
import type { ShopPublic } from '../../shared/types';
import { ErrorPage, Logo, Spinner } from '../components/ui';
import { api, saveCustomerKey } from '../lib/api';

/** Public page a seller shares in their Instagram bio. The customer starts their own brief. */
export default function ShopPage() {
  const { shopId = '' } = useParams();
  const [shop, setShop] = useState<ShopPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .shop(shopId)
      .then(({ shop }) => {
        setShop(shop);
        setTemplate(shop.category);
        document.title = `${shop.name} · Custom orders`;
      })
      .catch((e) => setError(e.message));
  }, [shopId]);

  const start = async () => {
    if (!shop || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createOrder(shop.id, { customerName: name.trim(), template, title: title.trim() });
      saveCustomerKey(r.orderId, r.customerKey);
      window.location.href = `/o/${r.orderId}?new=1`;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (error && !shop) return <ErrorPage title="Shop not found">{error}</ErrorPage>;
  if (!shop) return <Spinner />;
  const t = TEMPLATES[shop.category];

  return (
    <div className="center-page">
      <div className="card form-card">
        <div className="row">
          <span style={{ fontSize: 40 }}>{t?.emoji ?? '🛍️'}</span>
          <div>
            <b style={{ fontSize: 19 }}>{shop.name}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              by {shop.owner}
              {shop.city ? ` · ${shop.city}` : ''}
            </div>
          </div>
        </div>
        <h1>Let's design your order together</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Share photos of what you like, mark exactly what to keep or change, and approve one final design with the seller. No more lost WhatsApp threads.
        </p>
        <div className="stack">
          <div>
            <label className="label">Your name</label>
            <input className="input" value={name} maxLength={40} placeholder="e.g. Priya" onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">What would you like?</label>
            <div className="choice-grid">
              {Object.values(TEMPLATES).map((tp) => (
                <button key={tp.id} type="button" className={`choice ${template === tp.id ? 'on' : ''}`} onClick={() => setTemplate(tp.id)}>
                  <span className="e">{tp.emoji}</span>
                  {tp.name.replace('Custom ', '').replace('Printed ', '')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Occasion or title (optional)</label>
            <input className="input" value={title} maxLength={60} placeholder="e.g. Mom's 50th birthday" onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn block lg" onClick={start} disabled={busy || !name.trim()}>
            {busy ? 'Opening your brief room…' : 'Start my brief →'}
          </button>
          <div className="faint" style={{ fontSize: 12.5, textAlign: 'center' }}>
            Free · no signup · powered by <Logo href="/" />
          </div>
        </div>
      </div>
    </div>
  );
}
