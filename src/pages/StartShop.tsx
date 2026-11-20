import { useState } from 'react';
import { TEMPLATES } from '../../shared/templates';
import { Logo } from '../components/ui';
import { api, saveSellerKey } from '../lib/api';

export default function StartShop() {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('cake');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { shop, sellerKey } = await api.createShop({ name: name.trim(), owner: owner.trim(), category, city: city.trim() });
      saveSellerKey(shop.id, sellerKey);
      window.location.href = `/seller/${shop.id}`;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <div className="card form-card">
        <Logo />
        <h1>Set up your shop</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Free. Takes 20 seconds. You'll get a shop link for your Instagram bio and a dashboard for every custom order.
        </p>
        <div className="stack">
          <div>
            <label className="label">Shop name</label>
            <input className="input" value={name} maxLength={60} placeholder="e.g. Sugar & Sprinkles" onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Your name</label>
              <input className="input" value={owner} maxLength={40} placeholder="e.g. Neha" onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">City</label>
              <input className="input" value={city} maxLength={40} placeholder="e.g. Pune" onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">What do you make?</label>
            <div className="choice-grid">
              {Object.values(TEMPLATES).map((t) => (
                <button key={t.id} type="button" className={`choice ${category === t.id ? 'on' : ''}`} onClick={() => setCategory(t.id)}>
                  <span className="e">{t.emoji}</span>
                  {t.name.replace('Custom ', '').replace('Printed ', '')}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn block lg" onClick={create} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create my shop →'}
          </button>
        </div>
      </div>
    </div>
  );
}
