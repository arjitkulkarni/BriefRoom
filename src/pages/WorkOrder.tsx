import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { formatValue, isFilled, templateFor } from '../../shared/templates';
import { PIN_KINDS, type BriefContent, type OrderView, type Version } from '../../shared/types';
import { PinOverlay } from '../components/RefCanvas';
import { ErrorPage, Logo, Spinner } from '../components/ui';
import { api, customerKey, sellerKey } from '../lib/api';

/** Printable work order: what both sides agreed to make. Print -> "Save as PDF" gives a receipt. */
export default function WorkOrder() {
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let key = customerKey(orderId);
      if (!key) key = sellerKey((await api.meta(orderId)).shopId);
      if (!key) throw new Error('Open this from the brief room on your device.');
      setOrder((await api.order(orderId, key)).order);
    })().catch((e) => setError(e.message));
  }, [orderId]);

  if (error) return <ErrorPage title="Can't open work order">{error}</ErrorPage>;
  if (!order) return <Spinner />;

  const vParam = Number(params.get('v'));
  const version: Version | null =
    (vParam && order.versions[vParam - 1]) || (order.agreedVersion ? order.versions[order.agreedVersion - 1] : order.versions[order.versions.length - 1]) || null;
  const content: BriefContent = version?.snapshot ?? order.draft;
  const agreed = version !== null && order.agreedVersion === version.n;
  const t = templateFor(order.template);

  return (
    <div className="wo">
      <div className="row no-print">
        <Logo />
        <span className="spacer" />
        <a className="btn ghost sm" href={`/o/${order.id}`}>
          ← Back to brief room
        </a>
        <button className="btn sm" onClick={() => window.print()}>
          Print / save PDF
        </button>
      </div>

      <div style={{ marginTop: 22 }}>
        <span className={`chip ${agreed ? 'agreed' : version ? 'proposed' : 'draft'}`}>
          {agreed ? '🤝 Agreed work order' : version ? `Version ${version.n} · not yet agreed` : 'Draft · not yet proposed'}
        </span>
        <h1>
          {t.emoji} {order.title}
        </h1>
        <div className="muted">
          {order.shopName} × {order.customerName} · order <span className="mono">{order.id}</span>
        </div>
      </div>

      {agreed && version && (
        <div className="seal" style={{ marginTop: 18 }}>
          <span style={{ fontSize: 32 }}>🤝</span>
          <div style={{ flex: 1 }}>
            <b>Both sides approved version {version.n}</b>
            <div style={{ fontSize: 13.5 }}>
              Customer approved {new Date(version.approvals.customer!).toLocaleString('en-IN')} · Seller approved{' '}
              {new Date(version.approvals.seller!).toLocaleString('en-IN')}
            </div>
            <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
              Agreement fingerprint (SHA-256): {version.hash}
            </div>
          </div>
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>Visual reference</h2>
        {content.refs.length === 0 ? (
          <div className="muted">No reference images.</div>
        ) : (
          <div className="wo-refs">
            {content.refs.map((r) => (
              <div key={r.id}>
                <div className="wo-ref">
                  <img src={r.url} alt={r.caption} />
                  <PinOverlay pins={content.pins.filter((p) => p.refId === r.id)} />
                </div>
                {content.pins
                  .filter((p) => p.refId === r.id)
                  .map((p) => (
                    <div key={p.id} style={{ fontSize: 14, marginTop: 6 }}>
                      <b style={{ color: PIN_KINDS[p.kind].color }}>#{p.n}</b> {PIN_KINDS[p.kind].emoji} {PIN_KINDS[p.kind].label}
                      {p.color && (
                        <>
                          {' '}
                          <span className="swatch" style={{ background: p.color }} />
                          <span className="mono">{p.color}</span>
                        </>
                      )}
                      {p.note ? ` - ${p.note}` : ''}
                      {p.resolved ? <span className="faint"> (resolved)</span> : ''}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>Specifications</h2>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="spec-table">
            <tbody>
              {t.fields
                .filter((f) => isFilled(content.spec[f.key]))
                .map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>
                      {f.type === 'colors' ? (
                        <span>
                          {(content.spec[f.key] as string[]).map((c) => (
                            <span key={c} style={{ marginRight: 10 }}>
                              <span className="swatch" style={{ background: c }} />
                              <span className="mono">{c}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <b>{formatValue(f, content.spec[f.key])}</b>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {version?.note && (
        <p className="muted" style={{ marginTop: 16 }}>
          Note on version {version.n}: “{version.note}”
        </p>
      )}
      <p className="faint" style={{ fontSize: 12.5, marginTop: 30 }}>
        Generated by BriefRoom. The fingerprint changes if any photo, pin or detail changes, so both sides can prove which version was agreed.
      </p>
    </div>
  );
}
