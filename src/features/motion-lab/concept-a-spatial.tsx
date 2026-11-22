/**
 * Concept A — Spatial workspace. The landing hero's product preview, separated into real UI layers suspended at
 * different depths (CSS 3D: one perspective root, preserve-3d groups, translateZ per layer — the panels stay real,
 * crisp, accessible DOM). The pointer leans the whole composition through heavy springs; three layers drift slowly;
 * the brief "lives": it cycles through its annotations and the two approvals converge once.
 */
import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { ArrowRight, CheckCircle2, ClipboardList, GitCompareArrows, MessageSquareText, ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { KindChip, MarkerBadge } from '../annotations/annotation-meta';
import { AgreementCard, ANNOTATIONS, Card, CURSOR_SPRING, depthShadow, DiffRows, EASE, HighlightWipe, ReferenceCanvas, SPEC, ThreadBubbles, Words } from '@/components/motion/kit';

type Box = CSSProperties | null;
interface Composition {
  canvasW: number;
  canvas: Box;
  plate: Box;
  chat: Box;
  radar: Box;
  spec: Box;
  version: Box;
  agree: Box;
  tilt: string;
  perspective: number;
}

/** Layer positions (% of the stage) — tuned from screenshots at 1440 and 390 px. */
const DESKTOP: Composition = {
  canvasW: 262,
  canvas: { left: '17%', top: '4%' },
  plate: { left: 'calc(17% - 24px)', top: 'calc(4% + 28px)', width: 262, height: 380 },
  chat: { left: '54%', top: '1%', width: 272 },
  radar: { left: '61%', top: '41%', width: 240 },
  spec: { left: '-4%', top: '49%', width: 214 },
  version: { left: '51%', top: '61%', width: 276 },
  agree: { left: '8%', top: '83%', width: 300 },
  tilt: 'rotateX(12deg) rotateY(-15deg) rotateZ(3deg)',
  perspective: 1900,
};
const MOBILE: Composition = {
  canvasW: 168,
  canvas: { left: '4%', top: '2%' },
  plate: { left: 'calc(4% + 18px)', top: 'calc(2% + 20px)', width: 168, height: 244 },
  chat: { left: '41%', top: '4%', width: 200 },
  radar: null,
  spec: null,
  version: { left: '18%', top: '50%', width: 236 },
  agree: { left: '3%', top: '78%', width: 270 },
  tilt: 'rotateX(9deg) rotateY(-8deg) rotateZ(2deg)',
  perspective: 1300,
};

function Layer({ z, delay, float = 0, live, style, children }: { z: number; delay: number; float?: number; live: boolean; style: CSSProperties; children: ReactNode }) {
  const reduce = useReducedMotion();
  const drifting = float > 0 && live && !reduce;
  return (
    <motion.div
      className="absolute [transform-style:preserve-3d]"
      style={style}
      initial={reduce ? { opacity: 0, z } : { opacity: 0, z: z - 280, y: 46 }}
      animate={{ opacity: 1, z, y: 0 }}
      transition={{ duration: reduce ? 0.25 : 1.25, delay: reduce ? 0 : delay, ease: EASE.settle }}
    >
      <motion.div
        className="size-full [transform-style:preserve-3d]"
        animate={drifting ? { y: [0, -float, 0] } : { y: 0 }}
        transition={drifting ? { duration: 6.5 + float, repeat: Infinity, ease: 'easeInOut', delay: delay + 1.3 } : { duration: 0.6 }}
        whileHover={reduce ? undefined : { z: 22, transition: { duration: 0.35, ease: EASE.settle } }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function HeroCopy() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.75, delay, ease: EASE.settle } };
  return (
    <div className="relative z-10 min-w-0">
      <motion.div {...rise(0.05)}>
        <Badge tone="outline" className="whitespace-normal bg-surface">
          <Sparkles aria-hidden /> For cakes, merch, furniture &amp; jewellery made to order
        </Badge>
      </motion.div>
      <h1 className="mt-6 font-display text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground">
        <Words text="Custom orders," delay={0.12} />{' '}
        <HighlightWipe delay={0.95} duration={0.85}>
          <Words text="without the guesswork." delay={0.3} />
        </HighlightWipe>
      </h1>
      <motion.p {...rise(0.62)} className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
        One shared space for every reference, revision and final yes.
      </motion.p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <motion.div {...rise(0.78)}>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/start">
              Create your first brief <ArrowRight />
            </Link>
          </Button>
        </motion.div>
        <motion.div {...rise(0.86)}>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <a href="/#how">See how it works</a>
          </Button>
        </motion.div>
      </div>
      <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {['No app for customers — a private link', 'Real-time conversation per order', 'Both approve the same frozen version', 'Printable work order with a fingerprint'].map((t, i) => (
          <motion.li key={t} {...rise(0.98 + i * 0.07)} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-success-text" aria-hidden /> {t}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function ChatPanel({ id }: { id: string }) {
  const a = ANNOTATIONS.find((x) => x.id === id)!;
  return (
    <Card
      title="Conversation"
      icon={<MessageSquareText className="size-3.5" aria-hidden />}
      aside={
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-text">
          <span className="size-1.5 rounded-full bg-success" aria-hidden /> Live
        </span>
      }
      style={{ boxShadow: depthShadow(95) }}
      bodyClassName="min-h-[150px]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE.settle }} className="grid gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MarkerBadge number={a.number} kind={a.kind} size="sm" />
            <KindChip kind={a.kind} short />
            <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">{a.note}</span>
          </div>
          <ThreadBubbles thread={a.thread.slice(0, 2)} delay={0.12} step={0.28} />
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function RadarPanel() {
  return (
    <Card title="Clarification Radar" icon={<ShieldAlert className="size-3.5 text-warning-text" aria-hidden />} aside={<Badge tone="warning">1 open</Badge>} style={{ boxShadow: depthShadow(140) }}>
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-2.5 py-2 text-[12px] text-warning-text">
        <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" aria-hidden />
        <span>
          <b>Critical:</b> exact delivery time on 1 Dec?
        </span>
      </div>
    </Card>
  );
}

function SpecPanel() {
  return (
    <Card title="Specification" icon={<ClipboardList className="size-3.5" aria-hidden />} style={{ boxShadow: depthShadow(70) }} bodyClassName="p-2.5">
      <dl className="grid gap-1 text-[11.5px]">
        {SPEC.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="truncate text-muted-foreground">{k}</dt>
            <dd className="shrink-0 font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function VersionPanel({ live }: { live: boolean }) {
  return (
    <Card title="Version 1 → 2" icon={<GitCompareArrows className="size-3.5" aria-hidden />} aside={<Badge tone="info">v2</Badge>} style={{ boxShadow: depthShadow(50) }} bodyClassName="p-2">
      <DiffRows show={live} delay={1.6} />
    </Card>
  );
}

export default function ConceptSpatial() {
  const reduce = useReducedMotion();
  const isMd = useMediaQuery('(min-width: 768px)');
  const L = isMd ? DESKTOP : MOBILE;
  const stageRef = useRef<HTMLDivElement>(null);
  const live = useInView(stageRef, { margin: '-10% 0px -10% 0px' });

  // Pointer → heavy springs → whole-composition lean (mouse only; touch keeps the resting composition).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), CURSOR_SPRING);
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), CURSOR_SPRING);
  const gx = useSpring(useTransform(mx, [-0.5, 0.5], [-34, 34]), CURSOR_SPRING);
  const gy = useSpring(useTransform(my, [-0.5, 0.5], [-24, 24]), CURSOR_SPRING);
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  // The brief lives: focus moves through the annotations while the stage is on screen.
  const [sel, setSel] = useState('a1');
  useEffect(() => {
    if (reduce || !live) return;
    const ids = ANNOTATIONS.map((a) => a.id);
    const t = window.setInterval(() => setSel((s) => ids[(ids.indexOf(s) + 1) % ids.length]), 4200);
    return () => window.clearInterval(t);
  }, [reduce, live]);

  // Both approvals converge once, after the composition has assembled.
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
    const t = [window.setTimeout(() => setBuyer(true), 2400), window.setTimeout(() => setSeller(true), 3200), window.setTimeout(() => setAgreed(true), 4400)];
    return () => {
      t.forEach(clearTimeout);
      played.current = false;
    };
  }, [live, reduce]);

  const leaning = isMd && !reduce;
  return (
    <section className="relative overflow-x-clip" onPointerMove={onMove} onPointerLeave={onLeave} aria-label="Concept A: spatial workspace hero">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-4 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pb-20 lg:pt-14">
        <HeroCopy />
        <div ref={stageRef} className="relative mx-auto h-[520px] w-full max-w-[400px] sm:h-[600px] md:max-w-[680px] lg:h-[640px]" style={{ perspective: L.perspective }} role="img" aria-label="BriefRoom workspace in layers: reference photo with numbered annotations, the region's conversation, a clarification, the specification, the version comparison and both approvals forming the agreement">
          <motion.div aria-hidden className="pointer-events-none absolute left-[16%] top-[12%] size-[64%] rounded-full bg-accent/20 blur-3xl" style={leaning ? { x: gx, y: gy } : undefined} />
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={leaning ? { rotateX: rx, rotateY: ry } : undefined}>
            <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: L.tilt }} aria-hidden>
              {L.plate && (
                <Layer z={-50} delay={0.05} live={live} style={L.plate}>
                  <div className="size-full rounded-2xl bg-accent" />
                </Layer>
              )}
              <Layer z={0} delay={0.18} live={live} style={L.canvas!}>
                <ReferenceCanvas width={L.canvasW} selected={sel} depth={isMd ? 34 : 22} pinDelay={0.9} />
              </Layer>
              <Layer z={95} delay={0.45} float={5} live={live} style={L.chat!}>
                <ChatPanel id={sel} />
              </Layer>
              {L.radar && (
                <Layer z={140} delay={0.6} float={4} live={live} style={L.radar}>
                  <RadarPanel />
                </Layer>
              )}
              {L.spec && (
                <Layer z={70} delay={0.72} live={live} style={L.spec}>
                  <SpecPanel />
                </Layer>
              )}
              <Layer z={50} delay={0.86} live={live} style={L.version!}>
                <VersionPanel live={live} />
              </Layer>
              <Layer z={165} delay={1.02} float={3} live={live} style={L.agree!}>
                <AgreementCard buyer={buyer} seller={seller} agreed={agreed} style={{ boxShadow: depthShadow(165) }} className={cn(agreed && 'ring-2 ring-success/20')} />
              </Layer>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
