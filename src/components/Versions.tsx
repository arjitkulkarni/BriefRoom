import type { OrderView, Role, Version } from '../../shared/types';
import { ago } from './ui';

export default function Versions({
  order,
  focusVersion,
  onApprove,
  onRequestChanges,
}: {
  order: OrderView;
  focusVersion: number | null;
  onApprove: (n: number) => void;
  onRequestChanges: (n: number) => void;
}) {
  const role: Role = order.role;
  const latestN = order.versions.length;
  if (!latestN)
    return (
      <div className="card empty">
        <div className="big">📄</div>
        <b>No versions yet</b>
        <div>When the photos, pins and details look right, propose version 1. Both of you then approve the same version.</div>
      </div>
    );
  return (
    <div>
      {[...order.versions].reverse().map((v: Version) => {
        const price = v.snapshot.spec.price;
        const isLatest = v.n === latestN;
        const agreed = order.agreedVersion === v.n;
        const canDecide = isLatest && order.agreedVersion === null && !v.approvals[role];
        return (
          <div key={v.n} id={`version-${v.n}`} className={`card version ${isLatest ? 'latest' : ''}`} style={focusVersion === v.n ? { boxShadow: '0 0 0 3px var(--brand-soft)' } : undefined}>
            <div className="row wrap">
              <b style={{ fontSize: 16 }}>Version {v.n}</b>
              {agreed && <span className="chip agreed">🤝 Agreed</span>}
              {isLatest && !agreed && v.changeRequest && <span className="chip changes">Changes requested</span>}
              {!isLatest && !agreed && <span className="chip">Superseded</span>}
              <span className="spacer" />
              <span className="muted" style={{ fontSize: 13 }}>
                by {v.proposedBy === role ? 'you' : v.proposedBy} · {ago(v.proposedAt)}
              </span>
            </div>
            <div className="row wrap" style={{ marginTop: 6, fontSize: 14 }}>
              <span>
                <b>{typeof price === 'number' ? `₹${price.toLocaleString('en-IN')}` : 'Price not set'}</b>
              </span>
              <span className="faint">·</span>
              <span className="muted">
                {v.snapshot.refs.length} photos · {v.snapshot.pins.length} pins
              </span>
              <span className="faint">·</span>
              <span className="mono faint" title={v.hash}>
                #{v.hash.slice(0, 10)}
              </span>
            </div>
            {v.note && <div style={{ marginTop: 8 }}>“{v.note}”</div>}
            {v.changes.length > 0 && (
              <ul>
                {v.changes.slice(0, 12).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
                {v.changes.length > 12 && <li>+{v.changes.length - 12} more</li>}
              </ul>
            )}
            {v.changeRequest && (
              <div className="banner changes" style={{ marginTop: 10, marginBottom: 0 }}>
                ↩️ <span>
                  <b>{v.changeRequest.by === role ? 'You' : v.changeRequest.by} asked for changes</b> {v.changeRequest.reason}
                </span>
              </div>
            )}
            <div className="approvals">
              {(['customer', 'seller'] as Role[]).map((r) => (
                <span key={r} className={`appr ${v.approvals[r] ? 'yes' : ''}`}>
                  {v.approvals[r] ? '✓' : '…'} {r === role ? 'You' : r === 'seller' ? 'Seller' : 'Customer'}
                  {v.approvals[r] ? ` approved ${ago(v.approvals[r]!)}` : ' pending'}
                </span>
              ))}
            </div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <a className="btn ghost sm" href={`/o/${order.id}/work-order?v=${v.n}`}>
                View as work order
              </a>
              {canDecide && (
                <>
                  <span className="spacer" />
                  <button className="btn warn sm" onClick={() => onRequestChanges(v.n)}>
                    Request changes
                  </button>
                  <button className="btn ok sm" onClick={() => onApprove(v.n)}>
                    ✓ Approve version {v.n}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
