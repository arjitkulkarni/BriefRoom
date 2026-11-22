import { ArrowLeft, Fingerprint, Handshake, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatValue, isFilled, templateFor } from '@shared/templates';
import { ANNOTATION_KIND_META, roleLabel, ROLES, type OrderView, type Role, type VersionView } from '@shared/types';
import { FullPageMessage, PageLoader } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { customerKey, sellerKey } from '@/lib/keys';
import { dateTime } from '@/lib/utils';
import { MarkerBadge, TONE_CLASSES, toneOf } from '../annotations/annotation-meta';
import { VerifyFingerprint } from './approval-panel';

export default function WorkOrderPage() {
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let key = customerKey(orderId);
      if (!key) key = sellerKey((await api.meta(orderId)).shopId);
      if (!key) throw new Error('Open the work order from the order workspace on your device.');
      setOrder((await api.order(orderId, key)).order);
    })().catch((e) => setError((e as Error).message));
  }, [orderId]);

  if (error) return <FullPageMessage title="Can’t open this work order">{error}</FullPageMessage>;
  if (!order) return <PageLoader label="Preparing the work order…" />;

  const wanted = params.get('v');
  const version: VersionView | null =
    order.versions.find((v) => v.id === wanted || String(v.number) === wanted) ?? order.versions.find((v) => v.id === order.agreedVersionId) ?? order.versions.find((v) => v.id === order.latestVersionId) ?? null;
  const agreed = Boolean(version && version.id === order.agreedVersionId && (order.status === 'agreed' || order.status === 'completed'));
  const t = templateFor(order.template);
  const names = Object.fromEntries(order.participants.map((p) => [p.role, p.name])) as Record<Role, string>;

  if (!version)
    return (
      <FullPageMessage title="No version yet" action={<Button asChild><Link to={`/o/${order.id}`}>Back to the brief</Link></Button>}>
        A work order is generated from a frozen version. Propose version 1 first.
      </FullPageMessage>
    );

  const snap = version.snapshot;
  const refUrl = (id: string) => order.references.find((r) => r.id === id)?.url;

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <div className="no-print sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/o/${order.id}`}>
            <ArrowLeft /> Back to the brief
          </Link>
        </Button>
        <span className="ml-auto" />
        <ThemeToggle />
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print / Save PDF
        </Button>
      </div>

      <article className="mx-auto my-6 max-w-[210mm] rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-10 print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-divider pb-5">
          <div>
            <Logo />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Work order</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">{order.title}</h1>
          </div>
          <div className="text-right text-sm">
            {agreed ? (
              <Badge tone="success">
                <Handshake aria-hidden /> Agreed
              </Badge>
            ) : (
              <Badge tone="warning">Not agreed — preview of version {version.number}</Badge>
            )}
            <p className="mt-2 font-mono text-xs text-muted-foreground">Order #{order.id}</p>
            <p className="font-mono text-xs text-muted-foreground">Version {version.number}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-divider py-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seller</p>
            <p className="mt-1 font-semibold text-foreground">{order.shopName}</p>
            <p className="text-muted-foreground">{names.seller}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</p>
            <p className="mt-1 font-semibold text-foreground">{names.customer}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</p>
            <p className="mt-1 font-semibold text-foreground">{t.name}</p>
            <p className="text-muted-foreground">Proposed {dateTime(version.createdAt)}</p>
          </div>
        </section>

        <section className="py-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Visual reference & annotations</h2>
          {snap.references.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No reference images.</p>}
          <div className="mt-3 grid gap-6">
            {snap.references.map((r) => {
              const anns = snap.annotations.filter((a) => a.referenceId === r.id);
              return (
                <div key={r.id} className="print-avoid-break grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
                  <div className="relative overflow-hidden rounded-md border border-border" style={{ aspectRatio: `${r.width} / ${r.height}` }}>
                    {refUrl(r.id) && <img src={refUrl(r.id)} alt={r.caption || 'Reference'} className="absolute inset-0 size-full object-contain" />}
                    {anns.map((a) =>
                      a.shape === 'point' ? (
                        <span key={a.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
                          <MarkerBadge number={a.number} kind={a.kind} size="sm" />
                        </span>
                      ) : (
                        <span key={a.id} className={`absolute rounded border-2 ${TONE_CLASSES[toneOf(a.kind)].border}`} style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}>
                          <MarkerBadge number={a.number} kind={a.kind} size="sm" className="absolute -left-2.5 -top-2.5" />
                        </span>
                      ),
                    )}
                  </div>
                  <ol className="grid content-start gap-2 text-sm">
                    {anns.length === 0 && <li className="text-muted-foreground">No annotations on this image.</li>}
                    {anns.map((a) => (
                      <li key={a.id} className="flex items-start gap-2">
                        <MarkerBadge number={a.number} kind={a.kind} size="sm" />
                        <div>
                          <p className="font-semibold text-foreground">
                            {ANNOTATION_KIND_META[a.kind].label}
                            {a.status === 'resolved' && <span className="font-normal text-muted-foreground"> · resolved</span>}
                          </p>
                          <p className="text-foreground">{a.note || '—'}</p>
                          {a.color && (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                              <span className="size-3 rounded-sm border border-border-strong" style={{ background: a.color }} aria-hidden /> {a.color}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        <section className="print-avoid-break border-t border-divider py-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Specification</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-divider">
              {t.fields
                .filter((f) => isFilled(snap.spec[f.key]))
                .map((f) => (
                  <tr key={f.key}>
                    <th scope="row" className="w-2/5 py-2 pr-4 text-left font-medium text-muted-foreground">
                      {f.label}
                    </th>
                    <td className="py-2 font-semibold text-foreground">
                      {f.type === 'colors' ? (
                        <span className="flex flex-wrap gap-2">
                          {(snap.spec[f.key] as string[]).map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 font-mono text-xs font-normal">
                              <span className="size-3.5 rounded-sm border border-border-strong" style={{ background: c }} aria-hidden /> {c}
                            </span>
                          ))}
                        </span>
                      ) : (
                        formatValue(f, snap.spec[f.key])
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {snap.clarifications.some((c) => c.status === 'resolved') && (
          <section className="print-avoid-break border-t border-divider py-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Decisions recorded</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {snap.clarifications
                .filter((c) => c.status === 'resolved')
                .map((c) => (
                  <li key={c.id}>
                    <span className="text-muted-foreground">{c.title}</span> → <b className="text-foreground">{c.resolution}</b>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {version.note && <p className="border-t border-divider py-4 text-sm text-muted-foreground">Note on version {version.number}: “{version.note}”</p>}

        <section className="print-avoid-break border-t border-divider pt-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Approvals</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => {
              const a = version.approvals.find((x) => x.role === r && x.decision === 'approved');
              return (
                <div key={r} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold text-foreground">
                    {names[r]} <span className="font-normal text-muted-foreground">· {roleLabel(r)}</span>
                  </p>
                  <p className={a ? 'text-success-text' : 'text-muted-foreground'}>{a ? `Approved ${dateTime(a.createdAt)}` : 'Not approved'}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg bg-surface-secondary p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Fingerprint className="size-3.5" aria-hidden /> Agreement fingerprint — SHA-256 of the frozen version ({version.hashAlgorithm})
            </p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">{version.snapshotHash}</p>
            <div className="no-print mt-2">
              <VerifyFingerprint version={version} />
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Generated by BriefRoom. The fingerprint changes if any image, annotation, detail, price or decision changes, so both sides can show which exact version was approved. It is a record of the agreement, not a legal contract.
          </p>
        </section>
      </article>
    </div>
  );
}
