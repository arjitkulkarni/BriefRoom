/**
 * Concept B — Scroll story. A sticky stage narrates one order in eight steps while the page scrolls normally
 * (no wheel hijacking, no snapping, no pinning library). Scroll progress only picks the current step; every element
 * then animates on its own timeline, so fast scrolling never leaves half-drawn frames. Earlier cards recede in
 * depth as newer ones arrive; the upload thumbnail morphs into the canvas (shared-element transition).
 */
import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useReducedMotion, useScroll, type MotionValue, type Variants } from 'motion/react';
import { CheckCircle2, FileCheck2, GitCompareArrows, ImageUp, MessageSquareText, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Badge } from '@/components/ui/primitives';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { KindChip, MarkerBadge } from '../annotations/annotation-meta';
import { DEMO_IMAGE } from '../landing/demo-data';
import { AgreementCard, ANNOTATIONS, Card, CountRoll, depthShadow, DiffRows, EASE, HighlightWipe, ReferenceCanvas, ThreadBubbles } from '@/components/motion/kit';

const STEPS = [
  { title: 'A reference arrives', body: 'Priya shares “something like this” — the photo of the cake she loves.' },
  { title: 'It becomes the canvas', body: 'The photo opens as the shared canvas for this one order.' },
  { title: 'Point at exact regions', body: 'Numbered pins mark what to keep, change, recolour or remove.' },
  { title: 'Discuss in context', body: 'Each region carries its own conversation, next to the pixels it is about.' },
  { title: 'Clarifications resolve', body: 'Open questions get answers and move to Resolved.' },
  { title: 'Compare versions', body: 'Version 2 shows exactly what changed — size, roses, message and price.' },
  { title: 'Both approve', body: 'Customer and seller each approve the same frozen version.' },
  { title: 'Agreed', body: 'One fingerprint. One work order. Nothing left to guess.' },
];

const CARD: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.96, transition: { duration: 0.3, ease: EASE.exit } },
  front: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.75, ease: EASE.settle } },
  recede: { opacity: 0.45, y: 8, scale: 0.94, transition: { duration: 0.6, ease: EASE.glide } },
};

type Pos = Record<'upload' | 'canvas' | 'chat' | 'radar' | 'version' | 'agree', CSSProperties>;
const DESKTOP: Pos = {
  upload: { left: '29%', top: '30%', width: '42%' },
  canvas: { left: '3%', top: '3%', width: '30%' },
  chat: { left: '36%', top: '5%', width: '31%' },
  radar: { left: '36%', top: '49%', width: '31%' },
  version: { left: '68%', top: '12%', width: '31%' },
  agree: { left: '33%', top: '79%', width: '46%' },
};
const MOBILE: Pos = {
  upload: { left: '6%', top: '22%', width: '88%' },
  canvas: { left: '2%', top: '1%', width: '46%' },
  chat: { left: '50%', top: '2%', width: '49%' },
  radar: { left: '50%', top: '30%', width: '49%' },
  version: { left: '2%', top: '50%', width: '96%' },
  agree: { left: '2%', top: '78%', width: '96%' },
};

const CLARS = [
  { id: 'k1', title: 'Exact shade of ivory for #1?', answer: 'Ivory #f4ebd9' },
  { id: 'k2', title: 'Time slot is required', answer: 'Evening (4–8)' },
];

function RadarStory({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [resolved, setResolved] = useState<string[]>([]);
  useEffect(() => {
    if (!active) {
      setResolved([]);
      return;
    }
    if (reduce) {
      setResolved(CLARS.map((c) => c.id));
      return;
    }
    const t = [window.setTimeout(() => setResolved(['k1']), 700), window.setTimeout(() => setResolved(['k1', 'k2']), 1500)];
    return () => t.forEach(clearTimeout);
  }, [active, reduce]);
  const open = CLARS.filter((c) => !resolved.includes(c.id));
  const done = CLARS.filter((c) => resolved.includes(c.id));
  return (
    <LayoutGroup id="story-radar">
      <div className="grid gap-1.5 text-[12px]">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Needs clarification · <CountRoll value={open.length} />
        </p>
        {open.map((c) => (
          <motion.div key={c.id} layoutId={c.id} transition={{ layout: { duration: 0.5, ease: EASE.glide } }} className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-bg px-2 py-1.5 text-warning-text">
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-semibold">{c.title}</span>
          </motion.div>
        ))}
        {done.length > 0 && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resolved</p>}
        {done.map((c) => (
          <motion.div key={c.id} layoutId={c.id} transition={{ layout: { duration: 0.5, ease: EASE.glide } }} className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-bg px-2 py-1.5 text-success-text">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="font-semibold">{c.title}</span> → {c.answer}
            </span>
          </motion.div>
        ))}
      </div>
    </LayoutGroup>
  );
}

function Stage({ step, compact }: { step: number; compact: boolean }) {
  const P = compact ? MOBILE : DESKTOP;
  // Each card: hidden before its step, in front at its step, receding as later steps take the stage.
  const state = (from: number, recedeAt?: number): 'hidden' | 'front' | 'recede' => {
    if (step < from) return 'hidden';
    if (compact && recedeAt !== undefined && step >= recedeAt + 1) return 'hidden'; // phones: keep at most two cards
    return recedeAt !== undefined && step >= recedeAt ? 'recede' : 'front';
  };
  const [sellerDone, setSellerDone] = useState(false);
  useEffect(() => {
    if (step < 6) return setSellerDone(false);
    const t = window.setTimeout(() => setSellerDone(true), 800);
    return () => window.clearTimeout(t);
  }, [step]);
  const a1 = ANNOTATIONS[0];
  const finale = step >= 7;
  return (
    <div className={cn('relative w-full', compact ? 'h-full min-h-[420px]' : 'h-[min(80svh,660px)]')}>
      {/* the agreement glow: only the finale gets it */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-x-[10%] bottom-0 h-1/2 rounded-full bg-accent/25 blur-3xl" initial={false} animate={{ opacity: finale ? 1 : 0, scale: finale ? 1 : 0.8 }} transition={{ duration: 0.9, ease: EASE.settle }} />
      <LayoutGroup id="story">
        <AnimatePresence initial={false}>
          {step === 0 ? (
            <motion.div key="upload" className="absolute z-20" style={P.upload} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} transition={{ duration: 0.6, ease: EASE.settle }}>
              <Card title="New reference" icon={<ImageUp className="size-3.5" aria-hidden />} style={{ boxShadow: depthShadow(120) }}>
                <div className="flex items-center gap-3">
                  <motion.div layoutId="story-reference" className="size-16 shrink-0 overflow-hidden rounded-lg" transition={{ layout: { duration: 0.9, ease: EASE.settle } }}>
                    <img src={DEMO_IMAGE} alt="" className="size-full object-cover" draggable={false} />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">something-like-this.jpg</p>
                    <p className="text-[11.5px] text-muted-foreground">Priya · customer · just now</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.5, ease: EASE.glide }} />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="canvas" layoutId="story-reference" className="absolute z-0" style={P.canvas} transition={{ layout: { duration: 0.9, ease: EASE.settle } }}>
              <ReferenceCanvas showPins={step >= 2} selected={step >= 3 && step <= 4 ? 'a1' : null} spotlight={step === 3} pinDelay={0.15} />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>

      <motion.div className="absolute z-10" style={P.chat} variants={CARD} initial="hidden" animate={state(3, 5)}>
        <Card title="Discussion · region #1" icon={<MessageSquareText className="size-3.5" aria-hidden />} style={{ boxShadow: depthShadow(80) }} bodyClassName="min-h-[120px]">
          <div className="mb-2 flex items-center gap-2">
            <MarkerBadge number={a1.number} kind={a1.kind} size="sm" />
            <KindChip kind={a1.kind} short />
          </div>
          {step >= 3 && <ThreadBubbles thread={a1.thread} delay={0.25} step={0.35} />}
        </Card>
      </motion.div>

      <motion.div className="absolute z-10" style={P.radar} variants={CARD} initial="hidden" animate={state(4, 5)}>
        <Card title="Clarification Radar" icon={<ShieldAlert className="size-3.5" aria-hidden />} style={{ boxShadow: depthShadow(80) }}>
          <RadarStory active={step >= 4} />
        </Card>
      </motion.div>

      <motion.div className="absolute z-20" style={P.version} variants={CARD} initial="hidden" animate={state(5, 7)}>
        <Card title="Version 1 → 2" icon={<GitCompareArrows className="size-3.5" aria-hidden />} aside={<Badge tone="info">v2</Badge>} style={{ boxShadow: depthShadow(120) }} bodyClassName="p-2">
          <DiffRows show={step >= 5} delay={0.3} />
        </Card>
      </motion.div>

      <motion.div className="absolute z-30" style={P.agree} variants={CARD} initial="hidden" animate={step >= 6 ? 'front' : 'hidden'}>
        <motion.div animate={{ scale: finale ? 1.04 : 1 }} transition={{ duration: 0.8, ease: EASE.settle }}>
          <AgreementCard buyer={step >= 6} seller={sellerDone} agreed={finale} style={{ boxShadow: depthShadow(finale ? 200 : 120) }} />
          <AnimatePresence>
            {finale && (
              <motion.p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-foreground" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.9, duration: 0.5 }}>
                <FileCheck2 className="size-3.5" aria-hidden /> Printable work order ready
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Rail({ step, progress, onPick }: { step: number; progress: MotionValue<number>; onPick: (i: number) => void }) {
  return (
    <div className="relative min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">From reference to agreement</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">
        One order, <HighlightWipe delay={0.2}>start to finish.</HighlightWipe>
      </h2>
      <div className="relative mt-6 pl-5">
        <div className="absolute bottom-2 left-0 top-2 w-px bg-border" aria-hidden />
        <motion.div className="absolute bottom-2 left-0 top-2 w-px origin-top bg-foreground" style={{ scaleY: progress }} aria-hidden />
        <ol className="grid gap-0.5">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} layout="position" transition={{ layout: { duration: 0.35, ease: EASE.glide } }}>
              <button type="button" onClick={() => onPick(i)} aria-current={i === step ? 'step' : undefined} className="group w-full rounded-md py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn('flex items-baseline gap-2 text-[15px] font-semibold transition-colors', i === step ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                  <span className="w-5 font-mono text-[11px] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {i === step ? <HighlightWipe key={`step-${i}`} tone="mark">{s.title}</HighlightWipe> : <span>{s.title}</span>}
                </span>
                <AnimatePresence initial={false}>
                  {i === step && (
                    <motion.span className="block pl-7 pt-1 text-sm text-muted-foreground" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3, ease: EASE.settle }}>
                      {s.body}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.li>
          ))}
        </ol>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">Scroll normally — nothing takes over your wheel. Pick a step to jump to it.</p>
    </div>
  );
}

function MobileCaption({ step, progress }: { step: number; progress: MotionValue<number> }) {
  return (
    <div className="pt-3">
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <motion.div className="h-full origin-left rounded-full bg-foreground" style={{ scaleX: progress }} />
      </div>
      <div className="relative mt-3 min-h-[92px]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE.settle }}>
            <p className="font-mono text-[11px] text-muted-foreground">
              {step + 1} / {STEPS.length}
            </p>
            <p className="font-display text-xl font-semibold text-foreground">
              <HighlightWipe>{STEPS[step].title}</HighlightWipe>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ConceptStory() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const isLg = useMediaQuery('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const s = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.9999)));
    setStep((p) => (p === s ? p : s));
  });
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: reduce ? 'auto' : 'smooth' });
  };
  return (
    <section ref={ref} aria-label="Concept B: scroll story from reference to agreement" className="relative" style={{ height: `${STEPS.length * 72 + 28}svh` }}>
      <div className="sticky top-0 h-svh overflow-hidden">
        <div className={cn('mx-auto grid h-full w-full max-w-7xl gap-4 px-4 sm:px-6', isLg ? 'grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] items-center gap-10' : 'grid-rows-[auto_minmax(0,1fr)] pb-4')}>
          {isLg ? <Rail step={step} progress={scrollYProgress} onPick={goTo} /> : <MobileCaption step={step} progress={scrollYProgress} />}
          <Stage step={step} compact={!isLg} />
        </div>
      </div>
    </section>
  );
}
