/**
 * BriefRoom motion kit — the motion language (docs/MOTION_DESIGN.md) and the product fragments shared by
 * the landing hero and the /motion-lab previews.
 * Content is the landing page's illustrative demo brief (no fake users, metrics or testimonials).
 */
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { Check, Fingerprint, Handshake } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MarkerBadge, TONE_CLASSES, toneOf } from '@/features/annotations/annotation-meta';
import { DEMO_ANNOTATIONS, DEMO_DIFF, DEMO_HASH, DEMO_IMAGE, DEMO_IMAGE_SIZE, type DemoAnnotation } from '@/features/landing/demo-data';

type Bezier = [number, number, number, number];
/** Entrances settle (quick start, long soft landing) · state changes glide · exits leave quickly. */
export const EASE: Record<'settle' | 'glide' | 'exit', Bezier> = { settle: [0.22, 1, 0.36, 1], glide: [0.65, 0, 0.35, 1], exit: [0.4, 0, 1, 1] };
/** Cursor-driven springs are heavy and damped: the composition leans, it never wobbles. */
export const CURSOR_SPRING = { stiffness: 70, damping: 20, mass: 1.1 };
export const POP: Transition = { type: 'spring', stiffness: 420, damping: 26 };

export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
export const IMAGE_RATIO = `${DEMO_IMAGE_SIZE.width} / ${DEMO_IMAGE_SIZE.height}`;
export const ANNOTATIONS = DEMO_ANNOTATIONS;
export const DIFF = DEMO_DIFF;
export const HASH = DEMO_HASH;
export const SPEC: [string, string][] = [
  ['Size / weight', '1.5 kg'],
  ['Shape · flavour', 'Round · Vanilla'],
  ['Needed on', 'Tue 1 Dec · evening'],
  ['Pickup or delivery', 'Pickup'],
  ['Quoted price', '₹2,400'],
];

/** A shadow that grows with a layer's distance from the canvas plane — a depth cue without blur filters. */
export const depthShadow = (z: number) =>
  `0 ${Math.round(8 + z * 0.16)}px ${Math.round(22 + z * 0.42)}px -12px rgb(var(--shadow-color) / ${Math.min(0.5, 0.18 + z / 600).toFixed(2)})`;

const HIGHLIGHT_BG = {
  /** Display text: the landing hero's stroke across the lower half of the letters. */
  brand: 'linear-gradient(transparent 46%, var(--accent) 46%, var(--accent) 90%, transparent 90%)',
  /** Small text: a soft full-height marker, so light and dark text both keep their contrast. */
  mark: 'linear-gradient(color-mix(in srgb, var(--accent) 40%, transparent), color-mix(in srgb, var(--accent) 40%, transparent))',
};

/** The yellow highlighter, as motion: the stroke wipes in left → right (wraps across lines). */
export function HighlightWipe({ children, active = true, delay = 0, duration = 0.65, tone = 'brand', className }: { children: ReactNode; active?: boolean; delay?: number; duration?: number; tone?: 'brand' | 'mark'; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn('box-decoration-clone rounded-[3px] bg-no-repeat px-1 [-webkit-box-decoration-break:clone]', className)}
      style={{ backgroundImage: HIGHLIGHT_BG[tone] }}
      initial={reduce ? false : { backgroundSize: '0% 100%' }}
      animate={{ backgroundSize: active ? '100% 100%' : '0% 100%' }}
      transition={reduce ? { duration: 0 } : { duration, delay: active ? delay : 0, ease: EASE.settle }}
    >
      {children}
    </motion.span>
  );
}

/** Words rise into place one after another (wrap-safe "line by line" reveal). */
export function Words({ text, delay = 0, step = 0.06 }: { text: string; delay?: number; step?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <motion.span
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: '0.42em', filter: 'blur(6px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: '0em', filter: 'blur(0px)' }}
            transition={{ duration: reduce ? 0.2 : 0.8, delay: delay + i * step, ease: EASE.settle }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

/** Simple product card used by every concept. */
export function Card({ title, icon, aside, children, className, style, bodyClassName }: { title?: ReactNode; icon?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties; bodyClassName?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface text-foreground', className)} style={style}>
      {title && (
        <div className="flex items-center gap-2 border-b border-divider bg-surface-secondary/60 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {icon}
          <span className="truncate">{title}</span>
          {aside && <span className="ml-auto shrink-0 normal-case tracking-normal">{aside}</span>}
        </div>
      )}
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ reference canvas */

function RegionOutline({ a, i, show, delay, selected, withBadge }: { a: DemoAnnotation; i: number; show: boolean; delay: number; selected: string | null; withBadge: boolean }) {
  const reduce = useReducedMotion();
  const t = TONE_CLASSES[toneOf(a.kind)];
  const sel = selected === a.id;
  const dim = Boolean(selected) && !sel;
  const target = show ? { opacity: dim ? 0.45 : 1, scale: 1 } : { opacity: 0, scale: 0.9 };
  const transition = { delay: show && !reduce ? delay + i * 0.12 : 0, duration: reduce ? 0.15 : 0.5, ease: EASE.settle };
  if (a.shape === 'point')
    return withBadge ? (
      <motion.span className="absolute z-10" style={{ left: pct(a.x), top: pct(a.y) }} initial={{ opacity: 0, scale: 0.4 }} animate={show ? { opacity: dim ? 0.55 : 1, scale: sel ? 1.18 : 1 } : { opacity: 0, scale: 0.4 }} transition={{ ...POP, delay: transition.delay }}>
        <span className="block -translate-x-1/2 -translate-y-1/2">
          <MarkerBadge number={a.number} kind={a.kind} size="sm" />
        </span>
      </motion.span>
    ) : null;
  return (
    <motion.span
      className={cn('absolute rounded-[6px] border-2', t.border, sel ? 'bg-white/15 shadow-[0_0_0_3px_rgb(255_255_255/0.85)]' : 'bg-white/[0.06]')}
      style={{ left: pct(a.x), top: pct(a.y), width: pct(a.w), height: pct(a.h) }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={target}
      transition={transition}
    >
      {withBadge && (
        <span className="absolute -left-3 -top-3">
          <MarkerBadge number={a.number} kind={a.kind} size="sm" />
        </span>
      )}
    </motion.span>
  );
}

/** Cut-out spotlight that glides between regions (the workspace's focus treatment). */
export function Spotlight({ a }: { a: DemoAnnotation | null }) {
  const box = a ? (a.shape === 'point' ? { left: a.x - 0.09, top: a.y - 0.06, width: 0.18, height: 0.12 } : { left: a.x - 0.015, top: a.y - 0.012, width: a.w + 0.03, height: a.h + 0.024 }) : null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute rounded-[8px]"
      style={{ boxShadow: '0 0 0 9999px var(--canvas-dim)' }}
      initial={false}
      animate={box ? { opacity: 1, left: pct(box.left), top: pct(box.top), width: pct(box.width), height: pct(box.height) } : { opacity: 0 }}
      transition={{ duration: 0.55, ease: EASE.glide }}
    />
  );
}

function FloatingPin({ a, z, show, delay, active, dim }: { a: DemoAnnotation; z: number; show: boolean; delay: number; active: boolean; dim: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="absolute"
      style={{ left: pct(a.x), top: pct(a.y), z }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={show ? { opacity: dim ? 0.6 : 1, scale: active ? 1.22 : 1 } : { opacity: 0, scale: 0.3 }}
      transition={{ ...POP, delay: show && !reduce ? delay : 0 }}
    >
      <span className={cn('block', a.shape === 'point' ? '-translate-x-1/2 -translate-y-1/2' : '-translate-x-3 -translate-y-3')}>
        <MarkerBadge number={a.number} kind={a.kind} className={cn('shadow-lg', active && 'ring-4 ring-white/80')} />
      </span>
    </motion.span>
  );
}

/**
 * Reference photo on the dotted canvas. Region outlines stay in the photo plane; with `depth > 0` the numbered pins
 * float above the photo at their own depths (each casts a soft shadow onto the photo).
 */
export function ReferenceCanvas({ width, selected = null, showPins = true, pinDelay = 0, depth = 0, spotlight = false, imageLayoutId, className, imgClassName }: { width?: number | string; selected?: string | null; showPins?: boolean; pinDelay?: number; depth?: number; spotlight?: boolean; imageLayoutId?: string; className?: string; imgClassName?: string }) {
  const floating = depth > 0;
  const sel = ANNOTATIONS.find((x) => x.id === selected) ?? null;
  return (
    <div className={cn('relative [transform-style:preserve-3d]', className)} style={{ width }}>
      <div className="canvas-surface rounded-2xl border border-border p-3" style={{ boxShadow: depthShadow(0) }}>
        <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: IMAGE_RATIO }}>
          <motion.img layoutId={imageLayoutId} src={DEMO_IMAGE} alt="Reference photo: a white tiered cake topped with berries" className={cn('absolute inset-0 size-full select-none object-cover', imgClassName)} draggable={false} />
          {ANNOTATIONS.map((a, i) => (
            <RegionOutline key={a.id} a={a} i={i} show={showPins} delay={pinDelay} selected={selected} withBadge={!floating} />
          ))}
          {floating &&
            ANNOTATIONS.map((a, i) => (
              <motion.span
                key={`shadow-${a.id}`}
                aria-hidden
                className="absolute size-6 rounded-full bg-black/45 blur-[5px]"
                style={{ left: pct(a.x), top: pct(a.y), translate: a.shape === 'point' ? `calc(-50% + ${6 + i * 2}px) calc(-50% + ${9 + i * 2}px)` : `${-6 + i * 2}px ${-3 + i * 2}px` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: showPins ? 0.75 : 0 }}
                transition={{ delay: showPins ? pinDelay + 0.3 + i * 0.12 : 0, duration: 0.5 }}
              />
            ))}
          {spotlight && <Spotlight a={sel} />}
        </div>
      </div>
      {floating && (
        <div className="pointer-events-none absolute inset-3 [transform-style:preserve-3d]" aria-hidden>
          {ANNOTATIONS.map((a, i) => (
            <FloatingPin key={a.id} a={a} z={depth + i * 10} show={showPins} delay={pinDelay + 0.2 + i * 0.12} active={selected === a.id} dim={Boolean(selected) && selected !== a.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ conversation · radar · versions · approvals */

export function ThreadBubbles({ thread, delay = 0, step = 0.32, className }: { thread: DemoAnnotation['thread']; delay?: number; step?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <ol className={cn('grid gap-1.5', className)}>
      {thread.map((m, i) => (
        <motion.li
          key={`${i}-${m.text}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduce ? 0 : delay + i * step, duration: 0.45, ease: EASE.settle }}
          className={cn('max-w-[92%] rounded-lg border px-2.5 py-1.5 text-[12.5px] leading-snug', m.who === 'customer' ? 'justify-self-end border-bubble-own-border bg-bubble-own' : 'border-bubble-other-border bg-bubble-other')}
        >
          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{m.who === 'customer' ? 'Priya · customer' : 'Neha · seller'}</span>
          <span className="text-foreground">{m.text}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/** Counter that rolls to its new value. */
export function CountRoll({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex overflow-hidden tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: '-90%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '90%', opacity: 0 }} transition={{ duration: 0.28, ease: EASE.settle }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Version diff rows: each change slides in, then its new value is highlighted in sequence; the price gets a short emphasis. */
export function DiffRows({ show = true, delay = 0, className }: { show?: boolean; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <ul className={cn('grid gap-0.5', className)}>
      {DIFF.map((d, i) => {
        const price = d.label === 'Quoted price';
        const at = delay + i * 0.16;
        return (
          <motion.li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 rounded-md px-1.5 py-1 text-[12px]" initial={{ opacity: 0, x: -10 }} animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }} transition={{ delay: show && !reduce ? at : 0, duration: 0.4, ease: EASE.settle }}>
            <span className="truncate text-muted-foreground">{d.label}</span>
            <span className="text-right">
              <s className="mr-1.5 text-muted-foreground">{d.before}</s>
              <motion.span className="inline-block" animate={show && price && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ delay: at + 0.55, duration: 0.5, ease: EASE.glide }}>
                <HighlightWipe tone="mark" active={show} delay={at + 0.2} className={cn('text-foreground', price ? 'font-bold' : 'font-semibold')}>
                  {d.after}
                </HighlightWipe>
              </motion.span>
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** One party's approval; buyer and seller animate from opposite sides so the two decisions read as distinct. */
export function ApprovalChip({ name, role, done, side }: { name: string; role: string; done: boolean; side: 'left' | 'right' }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative overflow-hidden rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-[12px]"
      exit={reduce ? { opacity: 0 } : { x: side === 'left' ? '55%' : '-55%', opacity: 0, scale: 0.9, transition: { duration: 0.45, ease: EASE.glide } }}
    >
      <motion.span aria-hidden className="absolute inset-0 bg-accent/25" style={{ originX: side === 'left' ? 0 : 1 }} initial={false} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.6, ease: EASE.settle }} />
      <span className="relative flex items-center gap-2">
        <motion.span
          className={cn('grid size-5 shrink-0 place-items-center rounded-full border', done ? 'border-success bg-success text-success-foreground' : 'border-border-strong bg-surface')}
          initial={false}
          animate={done && !reduce ? { scale: [0.5, 1.18, 1], rotate: side === 'left' ? [-30, 0, 0] : [30, 0, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.55, ease: EASE.settle }}
        >
          {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
        </motion.span>
        <span className="min-w-0 leading-tight">
          <b className="block truncate text-foreground">{name}</b>
          <span className="block truncate text-[11px] text-muted-foreground">{done ? 'Approved v2' : role}</span>
        </span>
      </span>
    </motion.div>
  );
}

/** Two approvals converge into one agreement (only when both are confirmed). */
export function AgreementCard({ buyer, seller, agreed = buyer && seller, className, style }: { buyer: boolean; seller: boolean; agreed?: boolean; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn('rounded-xl border bg-surface p-2.5 transition-colors', agreed ? 'border-success/60' : 'border-border', className)} style={style}>
      <AnimatePresence mode="wait" initial={false}>
        {!agreed ? (
          <motion.div key="pending" className="grid grid-cols-2 gap-2" exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.3 } }}>
            <ApprovalChip name="Priya" role="Customer · to approve" done={buyer} side="left" />
            <ApprovalChip name="Neha" role="Seller · to approve" done={seller} side="right" />
          </motion.div>
        ) : (
          <motion.div key="agreed" className="grid gap-1" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE.settle }}>
            <span className="flex items-center gap-2 text-[13px] font-bold text-success-text">
              <Handshake className="size-4" aria-hidden /> Order agreed · Version 2
            </span>
            <span className="text-[11.5px] text-muted-foreground">Both approved the same version and fingerprint.</span>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-foreground">
              <Fingerprint className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                <HighlightWipe tone="mark" delay={0.35} duration={0.9}>
                  {HASH.slice(0, 24)}…
                </HighlightWipe>
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
