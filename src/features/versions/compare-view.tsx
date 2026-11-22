/**
 * Visual version diff — every highlight is computed from the two stored snapshots (diffSnapshots),
 * never from the live draft.
 */
import { ArrowRight, Columns2, IndianRupee, SplitSquareHorizontal, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { diffSnapshots, type SnapshotAnnotation } from '@shared/snapshot';
import type { OrderView, ReferenceView, VersionView } from '@shared/types';
import { EmptyState } from '@/components/feedback/states';
import { NativeSelect } from '@/components/ui/form';
import { Badge } from '@/components/ui/primitives';
import { cn, money } from '@/lib/utils';
import { MarkerBadge } from '../annotations/annotation-meta';

type Mark = SnapshotAnnotation & { change: 'added' | 'removed' | 'modified' | 'same' };

function Overlay({ marks }: { marks: Mark[] }) {
  return (
    <>
      {marks.map((m) => {
        const cls = m.change === 'added' ? 'border-ann-add bg-ann-add/15' : m.change === 'removed' ? 'border-dashed border-ann-remove bg-ann-remove/10' : m.change === 'modified' ? 'border-ann-change bg-ann-change/15' : 'border-white/70 bg-transparent';
        const tag = m.change === 'added' ? 'New' : m.change === 'removed' ? 'Removed' : m.change === 'modified' ? 'Changed' : null;
        if (m.shape === 'point')
          return (
            <span key={m.id + m.change} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
              <MarkerBadge number={m.number} kind={m.kind} className={m.change === 'removed' ? 'opacity-60' : undefined} />
            </span>
          );
        return (
          <span key={m.id + m.change} className={cn('absolute rounded-[5px] border-2', cls)} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}>
            <span className="absolute -left-2.5 -top-2.5 flex items-center gap-1">
              <MarkerBadge number={m.number} kind={m.kind} size="sm" />
              {tag && <span className="rounded bg-surface-elevated px-1 text-[10px] font-bold text-foreground shadow">{tag}</span>}
            </span>
          </span>
        );
      })}
    </>
  );
}

function ImageFrame({ reference, children, label }: { reference: ReferenceView | undefined; children?: React.ReactNode; label: string }) {
  if (!reference) return <div className="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{label}</div>;
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-canvas" style={{ aspectRatio: `${reference.width} / ${reference.height}` }}>
      <img src={reference.url} alt={label} className="absolute inset-0 size-full object-contain" loading="lazy" />
      {children}
    </div>
  );
}

export function CompareView({ order, initialBaseId, initialTargetId }: { order: OrderView; initialBaseId?: string | null; initialTargetId?: string | null }) {
  const versions = order.versions;
  const latest = versions.find((v) => v.id === order.latestVersionId) ?? versions.at(-1);
  const [targetId, setTargetId] = useState(initialTargetId ?? latest?.id ?? '');
  const target = versions.find((v) => v.id === targetId) ?? latest;
  const defaultBase = target ? versions.find((v) => v.number === target.number - 1) : undefined;
  const [baseId, setBaseId] = useState<string | null>(initialBaseId ?? defaultBase?.id ?? null);
  const base: VersionView | undefined = versions.find((v) => v.id === baseId);
  const [mode, setMode] = useState<'slider' | 'side'>('slider');
  const [split, setSplit] = useState(50);

  const diff = useMemo(() => (target ? diffSnapshots(base?.snapshot ?? null, target.snapshot) : null), [base, target]);
  if (!target || !diff) return <EmptyState title="No versions to compare yet">Propose a version first.</EmptyState>;

  const refById = new Map(order.references.map((r) => [r.id, r]));
  const refIds = [...new Set([...target.snapshot.references.map((r) => r.id), ...(base?.snapshot.references ?? []).map((r) => r.id)])];
  const addedIds = new Set(diff.annotations.added.map((a) => a.id));
  const modIds = new Set(diff.annotations.modified.map((m) => m.after.id));
  const marksFor = (refId: string, side: 'before' | 'after'): Mark[] => {
    if (side === 'before') return (base?.snapshot.annotations ?? []).filter((a) => a.referenceId === refId).map((a) => ({ ...a, change: diff.annotations.removed.some((r) => r.id === a.id) ? 'removed' : modIds.has(a.id) ? 'modified' : 'same' }));
    return target.snapshot.annotations.filter((a) => a.referenceId === refId).map((a) => ({ ...a, change: addedIds.has(a.id) ? 'added' : modIds.has(a.id) ? 'modified' : 'same' }));
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Before
          <NativeSelect value={baseId ?? ''} onChange={(e) => setBaseId(e.target.value || null)} className="h-9 w-36">
            <option value="">Start (empty)</option>
            {versions
              .filter((v) => v.number < target.number)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.number}
                </option>
              ))}
          </NativeSelect>
        </label>
        <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          After
          <NativeSelect
            value={target.id}
            onChange={(e) => {
              setTargetId(e.target.value);
              const t = versions.find((v) => v.id === e.target.value);
              setBaseId(versions.find((v) => t && v.number === t.number - 1)?.id ?? null);
            }}
            className="h-9 w-36"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.number}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface-secondary p-1" role="radiogroup" aria-label="Comparison layout">
          {(
            [
              ['slider', SplitSquareHorizontal, 'Slider'],
              ['side', Columns2, 'Side by side'],
            ] as const
          ).map(([m, Icon, l]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground', mode === m && 'bg-surface text-foreground shadow-xs')}>
              <Icon className="size-3.5" aria-hidden /> {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {diff.isEmpty && <Badge tone="neutral">No differences</Badge>}
        {diff.annotations.added.length > 0 && <Badge tone="success">+{diff.annotations.added.length} annotation{diff.annotations.added.length > 1 ? 's' : ''}</Badge>}
        {diff.annotations.removed.length > 0 && <Badge tone="danger">−{diff.annotations.removed.length} removed</Badge>}
        {diff.annotations.modified.length > 0 && <Badge tone="info">{diff.annotations.modified.length} changed region{diff.annotations.modified.length > 1 ? 's' : ''}</Badge>}
        {diff.spec.length > 0 && <Badge tone="outline">{diff.spec.length} detail change{diff.spec.length > 1 ? 's' : ''}</Badge>}
        {diff.price && (
          <Badge tone="warning">
            <IndianRupee aria-hidden /> {money(diff.price.before)} → {money(diff.price.after)}
          </Badge>
        )}
        {diff.delivery.length > 0 && (
          <Badge tone="warning">
            <Truck aria-hidden /> Delivery changed
          </Badge>
        )}
      </div>

      {refIds.map((id) => {
        const ref = refById.get(id);
        const inBase = Boolean(base?.snapshot.references.some((r) => r.id === id));
        const inTarget = target.snapshot.references.some((r) => r.id === id);
        if (inBase && inTarget && mode === 'slider')
          return (
            <figure key={id} className="grid gap-2">
              <div className="relative">
                <ImageFrame reference={ref} label="After">
                  <Overlay marks={marksFor(id, 'after')} />
                  <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-hidden>
                    <img src={ref?.url} alt="" className="absolute inset-0 size-full object-contain" />
                    <Overlay marks={marksFor(id, 'before')} />
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.25)]" style={{ left: `${split}%` }} aria-hidden />
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">{base ? `v${base.number}` : 'Start'}</span>
                  <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">v{target.number}</span>
                </ImageFrame>
              </div>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Before / after slider" className="w-full accent-primary" />
            </figure>
          );
        return (
          <figure key={id} className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <figcaption className="text-xs font-semibold text-muted-foreground">{base ? `Version ${base.number}` : 'Before'}</figcaption>
              {inBase ? (
                <ImageFrame reference={ref} label={`Version ${base?.number}`}>
                  <Overlay marks={marksFor(id, 'before')} />
                </ImageFrame>
              ) : (
                <ImageFrame reference={undefined} label="Image not in this version" />
              )}
            </div>
            <div className="grid gap-1">
              <figcaption className="text-xs font-semibold text-muted-foreground">Version {target.number}</figcaption>
              {inTarget ? (
                <ImageFrame reference={ref} label={`Version ${target.number}`}>
                  <Overlay marks={marksFor(id, 'after')} />
                </ImageFrame>
              ) : (
                <ImageFrame reference={undefined} label="Image removed" />
              )}
            </div>
          </figure>
        );
      })}

      {(diff.spec.length > 0 || diff.annotations.modified.length > 0 || diff.clarifications.resolved.length > 0) && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Specification and annotation changes</caption>
            <thead className="bg-surface-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Item
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {base ? `v${base.number}` : 'Before'}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  v{target.number}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {diff.spec.map((c) => (
                <tr key={c.key} className={c.role === 'price' || diff.delivery.includes(c) ? 'bg-warning-bg/50' : undefined}>
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    {c.label}
                  </th>
                  <td className="px-3 py-2 text-muted-foreground line-through decoration-destructive/60">{c.before}</td>
                  <td className="px-3 py-2 font-semibold text-foreground">{c.after}</td>
                </tr>
              ))}
              {diff.annotations.modified.map((m) => (
                <tr key={m.after.id}>
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    Annotation #{m.after.number}
                  </th>
                  <td className="px-3 py-2 text-muted-foreground">{m.before.note || '—'}</td>
                  <td className="px-3 py-2 text-foreground">
                    {m.after.note || '—'} <span className="text-xs text-muted-foreground">({m.changes.join(', ')})</span>
                  </td>
                </tr>
              ))}
              {diff.clarifications.resolved.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    {c.title}
                  </th>
                  <td className="px-3 py-2 text-muted-foreground">Open</td>
                  <td className="px-3 py-2 text-foreground">{c.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
