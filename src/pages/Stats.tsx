import { useEffect, useState } from 'react';
import { Logo, Spinner } from '../components/ui';
import { api } from '../lib/api';

const LABELS: Record<string, string> = {
  shops: 'Seller shops',
  orders: 'Brief rooms',
  agreed: 'Briefs agreed',
  versions: 'Versions proposed',
  pins: 'Image pins',
  references: 'Reference photos',
  nexconnUsers: 'Nexconn users',
};

/** Public live usage - traction proof for judges. */
export default function Stats() {
  const [s, setS] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const load = () => api.stats().then(setS).catch(() => undefined);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  if (!s) return <Spinner />;
  return (
    <div className="wo">
      <Logo />
      <h1>BriefRoom in the wild</h1>
      <p className="muted">Live numbers, refreshed every 10 seconds. Every seller and customer is a real Nexconn user.</p>
      <div className="grid-3">
        {Object.entries(LABELS).map(([k, label]) => (
          <div className="stat" key={k}>
            <div className="v">{s[k] ?? 0}</div>
            <div className="k">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
