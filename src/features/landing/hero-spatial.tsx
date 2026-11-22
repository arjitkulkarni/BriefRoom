/**
 * Landing hero (2.1 visual refresh, from the approved reference design): the order workspace suspended in space —
 * the annotated reference in a window, floating region callouts, the conversation, version cards and the final
 * approval — circled by a golden orbit. Real DOM layers in CSS 3D (docs/MOTION_DESIGN.md): the pointer leans the
 * composition, one ambient loop (light travelling along the orbit), and the two approvals converge once.
 * Illustrative example data only — no real users, metrics or testimonials.
 */
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { ArrowRight, Check, Fingerprint, Layers, Lasso, MapPin, MessageCircle, MessageSquareText, MousePointer2, Paperclip, PenLine, Play, SendHorizontal, ShieldCheck, Sparkles, Square, Zap } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CURSOR_SPRING, EASE, Words } from '@/components/motion/kit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { DEMO_IMAGE, DEMO_IMAGE_SIZE } from './demo-data';

/* ------------------------------------------------------------------ copy */

function rise(reduce: boolean | null, delay: number) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.75, delay, ease: EASE.settle } };
}

const FEATURES: { icon: typeof Zap; label: string }[] = [
  { icon: MessageSquareText, label: 'Real-time conversation' },
  { icon: Layers, label: 'Version & visual comparison' },
  { icon: ShieldCheck, label: 'Dual approval with fingerprint' },
  { icon: Zap, label: 'AI-assisted clarifications' },
];

export function HeroCopy() {
  const reduce = useReducedMotion();
  return (
    <div className="relative z-10 min-w-0">
      <motion.div {...rise(reduce, 0.05)}>
        <Badge tone="outline" className="whitespace-normal border-border-strong/40 bg-surface/60 px-3 py-1 text-[13px] backdrop-blur">
          <Sparkles className="text-accent" aria-hidden /> For cakes, merch, furniture &amp; jewellery made to order
        </Badge>
      </motion.div>
      <h1 className="mt-7 font-display text-[clamp(2.75rem,6.4vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground">
        <span className="relative inline-block">
          <Words text="Custom orders," delay={0.12} />
          <motion.svg aria-hidden viewBox="0 0 40 40" className="absolute -right-[0.55em] -top-[0.35em] size-[0.55em] overflow-visible text-accent" initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.35, type: 'spring', stiffness: 380, damping: 18 }}>
            <path d="M8 28 L16 20 M18 34 L30 30 M20 14 L24 4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
          </motion.svg>
        </span>{' '}
        <span className="relative inline-block whitespace-nowrap px-[0.16em]">
          <motion.span aria-hidden className="absolute inset-x-0 bottom-[0.02em] top-[0.12em] rounded-[0.14em] bg-accent shadow-[0_10px_40px_-12px_rgb(246_195_67/0.65)]" style={{ originX: 0, skewX: -9 }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.75, ease: EASE.settle }} />
          <span className="relative text-accent-foreground">
            <Words text="without the" delay={0.32} />
          </span>
        </span>{' '}
        <span className="relative inline-block">
          <Words text="guesswork." delay={0.55} />
          <svg aria-hidden viewBox="0 0 300 26" preserveAspectRatio="none" className="absolute -bottom-[0.16em] left-[2%] h-[0.26em] w-[96%] overflow-visible">
            <defs>
              <linearGradient id="hero-underline" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                <stop offset="0.18" stopColor="var(--accent)" />
                <stop offset="0.8" stopColor="var(--accent)" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path d="M3 17 C 70 7, 170 5, 297 12" stroke="url(#hero-underline)" strokeWidth="6" strokeLinecap="round" fill="none" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.05, duration: 0.9, ease: EASE.settle }} />
          </svg>
        </span>
      </h1>
      <motion.p {...rise(reduce, 0.7)} className="mt-7 max-w-[30rem] text-lg text-muted-foreground sm:text-xl">
        One shared space for every reference, revision and final yes.
      </motion.p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <motion.div {...rise(reduce, 0.82)}>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/start">
              Create your first brief <ArrowRight />
            </Link>
          </Button>
        </motion.div>
        <motion.div {...rise(reduce, 0.9)}>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <a href="#how">
              <Play className="fill-current" /> See how it works
            </a>
          </Button>
        </motion.div>
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.li key={f.label} {...rise(reduce, 1.0 + i * 0.07)} className="flex flex-col items-start gap-2 text-[13px] font-medium leading-snug text-muted-foreground sm:items-center sm:text-center">
            <span className="grid size-10 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
              <f.icon className="size-5" aria-hidden />
            </span>
            {f.label}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

// The window shows a landscape crop of the portrait reference; annotations are mapped into that crop.
const FRAME_RATIO = 1.36;
const VISIBLE_H = DEMO_IMAGE_SIZE.width / DEMO_IMAGE_SIZE.height / FRAME_RATIO;
const CROP_TOP = 0.2 * (1 - VISIBLE_H);
const cy = (y: number) => `${(((y - CROP_TOP) / VISIBLE_H) * 100).toFixed(2)}%`;
const ch = (h: number) => `${((h / VISIBLE_H) * 100).toFixed(2)}%`;
const REGIONS = [
  { n: 1, x: 0.23, y: 0.23, w: 0.5, h: 0.18, dashed: false },
  { n: 2, x: 0.31, y: 0.405, w: 0.24, h: 0.09, dashed: true },
];

function Layer({ z, delay, live, style, className, children }: { z: number; delay: number; live: boolean; style: CSSProperties; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={cn('absolute [transform-style:preserve-3d]', className)} style={style} initial={reduce ? { opacity: 0, z } : { opacity: 0, z: z - 280, y: 46 }} animate={live || reduce ? { opacity: 1, z, y: 0 } : undefined} transition={{ duration: reduce ? 0.25 : 1.25, delay: reduce ? 0 : delay, ease: EASE.settle }}>
      {children}
    </motion.div>
  );
}

const Avatar = ({ who }: { who: 'P' | 'N' }) => (
  <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 ring-surface', who === 'P' ? 'bg-ann-question-bg text-ann-question-text' : 'bg-ann-keep-bg text-ann-keep-text')}>
    {who}
  </span>
);

function WindowPanel({ live }: { live: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="glass-panel overflow-hidden rounded-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-destructive" />
          <span className="size-2.5 rounded-full bg-accent" />
          <span className="size-2.5 rounded-full bg-success" />
        </span>
        <span className="ml-1 truncate text-[12px] font-semibold text-foreground">Aditi's 25th birthday cake</span>
        <span className="ml-auto rounded-full border border-info/40 bg-info-bg px-2 py-0.5 text-[10.5px] font-bold text-info-text">Version 2</span>
      </div>
      <div className="flex gap-2 p-2.5">
        <div className="flex flex-col gap-1.5 rounded-xl bg-surface-secondary/70 p-1.5" aria-hidden>
          {[MousePointer2, Square, MapPin, PenLine, Lasso, MessageCircle].map((I, i) => (
            <span key={i} className={cn('grid size-7 place-items-center rounded-lg', i === 2 ? 'bg-primary text-primary-foreground shadow-[var(--primary-glow)]' : 'text-muted-foreground')}>
              <I className="size-3.5" />
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl" style={{ aspectRatio: `${FRAME_RATIO}` }}>
          <img src={DEMO_IMAGE} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: '50% 20%' }} draggable={false} />
          {REGIONS.map((r, i) => (
            <motion.span
              key={r.n}
              className={cn('absolute rounded-[10px] border-[2.5px] border-accent', r.dashed ? 'border-dashed bg-accent/[0.06]' : 'bg-accent/10 shadow-[0_0_24px_-4px_rgb(246_195_67/0.7)]')}
              style={{ left: `${r.x * 100}%`, top: cy(r.y), width: `${r.w * 100}%`, height: ch(r.h) }}
              initial={reduce ? false : { opacity: 0, scale: 0.85 }}
              animate={live || reduce ? { opacity: 1, scale: 1 } : undefined}
              transition={{ delay: 1.2 + i * 0.25, duration: 0.5, ease: EASE.settle }}
            >
              <motion.span className="absolute -top-3.5 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-accent-foreground shadow-lg ring-2 ring-[var(--background)]" initial={reduce ? false : { scale: 0 }} animate={live || reduce ? { scale: 1 } : undefined} transition={{ delay: 1.45 + i * 0.25, type: 'spring', stiffness: 420, damping: 20 }}>
                {r.n}
              </motion.span>
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Callout({ n, children, tone = 'accent' }: { n: number; children: ReactNode; tone?: 'accent' | 'keep' }) {
  return (
    <div className={cn('glass-panel flex items-start gap-2.5 rounded-2xl p-3 backdrop-blur-md', tone === 'keep' ? 'border-success/35 bg-success-bg/80' : 'shadow-[0_0_0_1px_rgb(246_195_67/0.25),0_18px_40px_-14px_rgb(0_0_0/0.6)]')}>
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold', tone === 'keep' ? 'bg-success text-success-foreground' : 'bg-accent text-accent-foreground')}>{n}</span>
      <div className="min-w-0 text-[13px] font-semibold leading-snug text-foreground">{children}</div>
    </div>
  );
}

function ConversationPanel() {
  const msgs: { who: 'P' | 'N'; name: string; text: string; time: string }[] = [
    { who: 'P', name: 'Priya · Customer', text: 'Can we change these to ivory roses?', time: '10:24 AM' },
    { who: 'N', name: 'Neha · Seller', text: 'Yes — should I keep the leaves green?', time: '10:27 AM' },
    { who: 'P', name: 'Priya · Customer', text: 'Yes, keep them green.', time: '10:29 AM' },
  ];
  return (
    <div className="glass-panel rounded-2xl p-2.5 backdrop-blur-md">
      <div className="mb-2 flex gap-1 rounded-xl bg-surface-secondary/70 p-1 text-[11.5px] font-bold">
        <span className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-center text-primary-foreground shadow-[var(--primary-glow)]">Conversation</span>
        <span className="flex-1 px-2 py-1.5 text-center text-muted-foreground">Clarifications</span>
      </div>
      <ol className="grid gap-1.5">
        {msgs.map((m, i) => (
          <li key={i} className="flex gap-2 rounded-xl border border-[var(--glass-border)] bg-surface-secondary/60 p-2">
            <Avatar who={m.who} />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold text-muted-foreground">{m.name}</p>
              <p className="text-[12px] leading-snug text-foreground">{m.text}</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-muted-foreground">
                {i === 2 && <Check className="size-3 text-success-text" aria-hidden />} {m.time}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-surface-secondary/60 py-1.5 pl-3 pr-1.5 text-[11.5px] text-muted-foreground">
        <span className="flex-1 truncate">Type a message…</span>
        <Paperclip className="size-3.5" aria-hidden />
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <SendHorizontal className="size-3.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function VersionCards() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="glass-panel rounded-2xl p-2 backdrop-blur-md">
        <div className="h-16 overflow-hidden rounded-lg">
          <img src={DEMO_IMAGE} alt="" className="size-full object-cover opacity-70 saturate-50" style={{ objectPosition: '50% 30%' }} draggable={false} />
        </div>
        <p className="mt-1.5 text-[12px] font-bold text-foreground">v1</p>
        <p className="text-[11.5px] text-muted-foreground">₹1,850</p>
      </div>
      <div className="relative rounded-2xl border-2 border-accent bg-[var(--glass)] p-2 shadow-[0_0_34px_-8px_rgb(246_195_67/0.6)] backdrop-blur-md">
        <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-accent text-accent-foreground shadow-md" aria-hidden>
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <div className="h-16 overflow-hidden rounded-lg">
          <img src={DEMO_IMAGE} alt="" className="size-full object-cover" style={{ objectPosition: '50% 30%' }} draggable={false} />
        </div>
        <p className="mt-1.5 text-[12px] font-bold text-foreground">v2 (Proposed)</p>
        <p className="text-[11.5px] font-semibold text-foreground">₹2,400</p>
      </div>
    </div>
  );
}

function ApprovalPanel({ buyer, seller, agreed }: { buyer: boolean; seller: boolean; agreed: boolean }) {
  const reduce = useReducedMotion();
  const Row = ({ name, done }: { name: string; done: boolean }) => (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] bg-surface-secondary/60 px-3 py-2 text-[12.5px]">
      <motion.span className={cn('grid size-5 place-items-center rounded-full', done ? 'bg-success text-success-foreground' : 'border border-border-strong')} initial={false} animate={done && !reduce ? { scale: [0.5, 1.2, 1] } : { scale: 1 }} transition={{ duration: 0.5, ease: EASE.settle }}>
        {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </motion.span>
      <span className="flex-1 font-semibold text-foreground">{name}</span>
      <span className={cn('text-[11.5px] font-semibold', done ? 'text-success-text' : 'text-muted-foreground')}>{done ? 'Approved' : 'Waiting'}</span>
    </div>
  );
  return (
    <div className={cn('glass-panel rounded-2xl p-3 backdrop-blur-md transition-shadow duration-700', agreed && 'shadow-[0_0_0_1px_rgb(246_195_67/0.5),0_0_60px_-10px_rgb(246_195_67/0.55)]')}>
      <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-foreground">
        <Fingerprint className="size-4.5 text-accent" aria-hidden /> Final approval
      </p>
      <div className="grid gap-1.5">
        <Row name="Priya (Customer)" done={buyer} />
        <Row name="Neha (Seller)" done={seller} />
      </div>
      <div className="relative mt-2.5 h-10 overflow-hidden rounded-xl border border-accent/40">
        <motion.span aria-hidden className="absolute inset-0 bg-accent" style={{ originX: 0 }} initial={false} animate={{ scaleX: agreed ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.7, ease: EASE.settle }} />
        <span className={cn('relative flex h-full items-center justify-center gap-2 text-[13.5px] font-bold transition-colors duration-300', agreed ? 'text-accent-foreground' : 'text-muted-foreground')}>
          {agreed ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
          {agreed ? 'Order Agreed' : 'Waiting for both approvals'}
        </span>
      </div>
    </div>
  );
}

/** Golden orbit around the composition: the back arc sits behind the window, the front arc passes in front. */
function Orbit({ part, live }: { part: 'back' | 'front'; live: boolean }) {
  const reduce = useReducedMotion();
  const d = part === 'back' ? 'M20 200 A480 150 0 0 1 980 200' : 'M980 200 A480 150 0 0 1 20 200';
  return (
    <svg aria-hidden viewBox="0 0 1000 400" className="size-full overflow-visible" style={{ filter: 'drop-shadow(0 0 10px rgb(246 195 67 / 0.55))' }}>
      <defs>
        <linearGradient id={`orbit-${part}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f6c343" stopOpacity="0" />
          <stop offset="0.25" stopColor="#f6c343" stopOpacity={part === 'front' ? 0.95 : 0.5} />
          <stop offset="0.75" stopColor="#f9d777" stopOpacity={part === 'front' ? 0.95 : 0.5} />
          <stop offset="1" stopColor="#f6c343" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={d} stroke={`url(#orbit-${part})`} strokeWidth={part === 'front' ? 3.2 : 2} fill="none" strokeLinecap="round" initial={reduce ? false : { pathLength: 0 }} animate={live || reduce ? { pathLength: 1 } : undefined} transition={{ delay: part === 'back' ? 0.7 : 1.1, duration: 1.4, ease: EASE.settle }} />
      {part === 'front' && live && !reduce && (
        <motion.path d={d} stroke="#fff6d6" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="70 1400" initial={{ strokeDashoffset: 1300 }} animate={{ strokeDashoffset: -1300 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 2.4 }} />
      )}
    </svg>
  );
}

interface Comp {
  window: CSSProperties;
  c1: CSSProperties | null;
  c2: CSSProperties | null;
  chat: CSSProperties | null;
  versions: CSSProperties | null;
  approval: CSSProperties;
  orbit: CSSProperties;
  tilt: string;
  perspective: number;
}
const DESKTOP: Comp = {
  window: { left: '1%', top: '9%', width: '63%' },
  c1: { left: '44%', top: '24%', width: 186 },
  c2: { left: '42%', top: '49%', width: 178 },
  chat: { left: '70.5%', top: '2%', width: '30%' },
  versions: { left: '4%', top: '61%', width: '40%' },
  approval: { left: '47%', top: '62%', width: '46%' },
  orbit: { left: '-6%', top: '42%', width: '112%', height: '52%' },
  tilt: 'rotateX(10deg) rotateY(-14deg) rotateZ(2.5deg)',
  perspective: 2100,
};
const MOBILE: Comp = {
  window: { left: '0%', top: '2%', width: '92%' },
  c1: { left: '44%', top: '12%', width: 176 },
  c2: null,
  chat: null,
  versions: null,
  approval: { left: '22%', top: '57%', width: '76%' },
  orbit: { left: '-8%', top: '40%', width: '116%', height: '52%' },
  tilt: 'rotateX(8deg) rotateY(-8deg) rotateZ(1.5deg)',
  perspective: 1400,
};

export function HeroScene() {
  const reduce = useReducedMotion();
  const isMd = useMediaQuery('(min-width: 768px)');
  const L = isMd ? DESKTOP : MOBILE;
  const stageRef = useRef<HTMLDivElement>(null);
  const live = useInView(stageRef, { margin: '-5% 0px -5% 0px' });

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), CURSOR_SPRING);
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), CURSOR_SPRING);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  // The two approvals converge once, after the scene has assembled.
  const [buyer, setBuyer] = useState(false);
  const [seller, setSeller] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const played = useRef(false);
  useEffect(() => {
    if (!live || played.current) return;
    played.current = true;
    if (reduce) {
      setBuyer(true);
      setSeller(true);
      setAgreed(true);
      return;
    }
    const t = [window.setTimeout(() => setBuyer(true), 2300), window.setTimeout(() => setSeller(true), 3000), window.setTimeout(() => setAgreed(true), 3900)];
    return () => {
      t.forEach(clearTimeout);
      played.current = false;
    };
  }, [live, reduce]);

  const leaning = isMd && !reduce;
  return (
    <div
      ref={stageRef}
      onPointerMove={onMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative mx-auto h-[470px] w-full max-w-[420px] sm:h-[560px] md:max-w-[720px] lg:h-[600px]"
      style={{ perspective: L.perspective }}
      role="img"
      aria-label="BriefRoom order workspace: an annotated reference photo, region discussions, the conversation, two versions and the final approval with both people approved — order agreed"
    >
      <div aria-hidden className="pointer-events-none absolute left-[12%] top-[16%] size-[70%] rounded-full bg-accent/20 blur-[90px]" />
      <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={leaning ? { rotateX: rx, rotateY: ry } : undefined}>
        <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: L.tilt }} aria-hidden>
          <Layer z={-70} delay={0.55} live={live} style={L.orbit}>
            <Orbit part="back" live={live} />
          </Layer>
          {L.chat && (
            <Layer z={30} delay={0.5} live={live} style={L.chat}>
              <ConversationPanel />
            </Layer>
          )}
          <Layer z={0} delay={0.2} live={live} style={L.window}>
            <WindowPanel live={live} />
          </Layer>
          {L.c1 && (
            <Layer z={110} delay={0.75} live={live} style={L.c1}>
              <Callout n={1}>
                Change to ivory roses?
                <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <span className="flex -space-x-1.5">
                    <Avatar who="P" />
                    <Avatar who="N" />
                  </span>
                  3 replies
                </span>
              </Callout>
            </Layer>
          )}
          {L.c2 && (
            <Layer z={80} delay={0.9} live={live} style={L.c2}>
              <Callout n={2} tone="keep">
                <span className="flex items-center gap-1.5">
                  Keep the leaves green. <Check className="size-3.5 text-success-text" strokeWidth={3} />
                </span>
              </Callout>
            </Layer>
          )}
          {L.versions && (
            <Layer z={120} delay={1.0} live={live} style={L.versions}>
              <VersionCards />
            </Layer>
          )}
          <Layer z={150} delay={1.1} live={live} style={L.approval}>
            <ApprovalPanel buyer={buyer} seller={seller} agreed={agreed} />
          </Layer>
          <Layer z={175} delay={0.6} live={live} style={L.orbit} className="pointer-events-none">
            <Orbit part="front" live={live} />
          </Layer>
        </div>
      </motion.div>
    </div>
  );
}
