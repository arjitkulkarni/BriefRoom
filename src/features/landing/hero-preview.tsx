import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Circle, Fingerprint, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { ANNOTATION_KIND_META } from '@shared/types';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { KindChip, MarkerBadge, TONE_CLASSES, toneOf } from '../annotations/annotation-meta';
import { DEMO_ANNOTATIONS, DEMO_HASH, DEMO_IMAGE, DEMO_IMAGE_SIZE, type DemoAnnotation } from './demo-data';

export function DemoMarkers({ items, selected, onSelect, size = 'md' }: { items: DemoAnnotation[]; selected: string | null; onSelect?: (id: string) => void; size?: 'sm' | 'md' }) {
  return (
    <>
      {items.map((a) => {
        const sel = a.id === selected;
        const t = TONE_CLASSES[toneOf(a.kind)];
        const label = `#${a.number} ${ANNOTATION_KIND_META[a.kind].label}: ${a.note}`;
        const common = 'absolute focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring';
        if (a.shape === 'point')
          return (
            <button key={a.id} type="button" aria-label={label} aria-pressed={sel} onClick={() => onSelect?.(a.id)} className={cn(common, 'z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity', selected && !sel && 'opacity-50')} style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
              <MarkerBadge number={a.number} kind={a.kind} className={cn(size === 'md' ? 'size-7 text-xs' : '', sel && 'scale-125 ring-4')} />
            </button>
          );
        return (
          <button
            key={a.id}
            type="button"
            aria-label={label}
            aria-pressed={sel}
            onClick={() => onSelect?.(a.id)}
            className={cn(common, 'rounded-[6px] border-2 transition-[opacity,box-shadow]', t.border, a.status === 'resolved' && !sel ? 'border-dashed' : '', sel ? 'z-20 shadow-[0_0_0_3px_#ffffff]' : 'bg-white/10', selected && !sel && 'opacity-50')}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
          >
            <span className="absolute -left-3 -top-3">
              <MarkerBadge number={a.number} kind={a.kind} size={size} />
            </span>
          </button>
        );
      })}
    </>
  );
}

/** The landing hero's interactive product preview (window chrome + offset highlighter block). */
export function HeroPreview() {
  const [selected, setSelected] = useState<string>('a1');
  const reduce = useReducedMotion();
  const a = DEMO_ANNOTATIONS.find((x) => x.id === selected)!;
  return (
    <div className="relative">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-accent sm:translate-x-4 sm:translate-y-4" aria-hidden />
      <figure className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-xl" aria-label="Interactive preview of a BriefRoom order workspace">
        <div className="flex items-center gap-2 border-b border-divider bg-surface-secondary px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border-strong/60" />
            <span className="size-2.5 rounded-full bg-border-strong/60" />
            <span className="size-2.5 rounded-full bg-border-strong/60" />
          </span>
          <span className="ml-2 truncate text-xs font-semibold text-muted-foreground">Aditi's 25th birthday cake · Priya × Sugar &amp; Sprinkles</span>
          <Badge tone="info" className="ml-auto hidden sm:inline-flex">
            Version 2
          </Badge>
        </div>
        <div className="grid sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
          <div className="canvas-surface relative p-4">
            <div className="relative mx-auto max-w-[300px] overflow-hidden rounded-md shadow-lg" style={{ aspectRatio: `${DEMO_IMAGE_SIZE.width} / ${DEMO_IMAGE_SIZE.height}` }}>
              <img src={DEMO_IMAGE} alt="Reference photo: a white tiered cake topped with berries" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
              <DemoMarkers items={DEMO_ANNOTATIONS} selected={selected} onSelect={setSelected} />
            </div>
            <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">Tap a marker</p>
          </div>
          <div className="flex min-h-0 flex-col gap-3 border-t border-divider p-4 sm:border-l sm:border-t-0">
            <AnimatePresence mode="wait">
              <motion.div key={a.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <MarkerBadge number={a.number} kind={a.kind} />
                  <KindChip kind={a.kind} short />
                  {a.status === 'resolved' && (
                    <Badge tone="success" className="ml-auto">
                      <CheckCircle2 aria-hidden /> Resolved
                    </Badge>
                  )}
                </div>
                <ol className="grid gap-1.5">
                  {a.thread.map((m, i) => (
                    <li key={i} className={cn('max-w-[95%] rounded-lg border px-2.5 py-1.5 text-[13px]', m.who === 'customer' ? 'justify-self-end border-bubble-own-border bg-bubble-own' : 'border-bubble-other-border bg-bubble-other')}>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.who === 'customer' ? 'Priya · customer' : 'Neha · seller'}</span>
                      <span className="text-foreground">{m.text}</span>
                    </li>
                  ))}
                </ol>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-2.5 py-2 text-[12px] text-warning-text">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <b>Needs clarification:</b> exact delivery time on 1 Dec?
              </span>
            </div>
            <div className="grid gap-1 rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-[12px]">
              <span className="font-semibold text-foreground">v1 → v2</span>
              <span className="text-muted-foreground">
                Size <s>1 kg</s> → <b className="text-foreground">1.5 kg</b> · Price <s>₹1,850</s> → <b className="text-foreground">₹2,400</b>
              </span>
            </div>
            <div className="mt-auto grid gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px]">
              <span className="flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="size-3.5 text-success-text" aria-hidden /> Priya approved v2
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Circle className="size-3.5" aria-hidden /> Neha · waiting to approve
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Fingerprint className="size-3" aria-hidden /> {DEMO_HASH.slice(0, 20)}…
              </span>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
