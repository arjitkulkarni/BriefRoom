import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, FileText, LayoutDashboard, PartyPopper, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrderView } from '@shared/types';
import { EASE, POP } from '@/components/motion/kit';
import { Button } from '@/components/ui/button';
import { api, type DemoSession } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The "Try it in 4 steps" bar, live: each step ticks off as the visitor does it (read from the real
 * order, not from clicks), the next one is highlighted, and agreeing ends in a small celebration.
 */

export const DEMO_STEPS: { who: string; side: string; text: string; optional?: boolean }[] = [
  { who: 'Priya', side: 'right', text: 'Draw a box on the cake and say what you want.', optional: true },
  { who: 'Neha', side: 'left', text: 'Open “Details” and set the price to ₹2,400.' },
  { who: 'Neha', side: 'left', text: 'Press “Send for approval”.' },
  { who: 'Both', side: 'left & right', text: 'Press “Approve”. Done, the order is confirmed!' },
];

/** Marks the demo starts with (see server/domain/demo.ts). */
const SEEDED_MARKS = 2;

function progressOf(order: OrderView | null): boolean[] {
  if (!order) return DEMO_STEPS.map(() => false);
  const agreed = order.status === 'agreed' || order.status === 'completed';
  const proposedV2 = order.versions.length >= 2;
  return [
    order.annotations.length > SEEDED_MARKS,
    proposedV2 || order.spec.price !== undefined, // re-quoted (cleared in the seed)
    proposedV2,
    agreed,
  ];
}

/** Polls the real order with the seller key while the page is visible, until it is agreed. */
function useDemoOrder(demo: DemoSession) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const done = order?.status === 'agreed' || order?.status === 'completed';
  useEffect(() => {
    if (done) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const r = await api.order(demo.orderId, demo.sellerKey).catch(() => null);
        if (alive && r) setOrder(r.order);
      }
      if (alive) timer = setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [demo.orderId, demo.sellerKey, done]);
  return order;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function DemoGuide({ demo, onRestart }: { demo: DemoSession; onRestart: () => void }) {
  const order = useDemoOrder(demo);
  const reduce = useReducedMotion();
  const startedAt = useRef(Date.now());
  const [agreedAfter, setAgreedAfter] = useState<number | null>(null);
  const done = useMemo(() => progressOf(order), [order]);
  const agreed = done[3];
  useEffect(() => {
    if (agreed && agreedAfter === null) setAgreedAfter(Date.now() - startedAt.current);
  }, [agreed, agreedAfter]);

  // The step to do next: the first open required step after the last finished one (step 1 is optional).
  const lastDone = done.lastIndexOf(true);
  const open = (i: number) => !done[i] && !DEMO_STEPS[i].optional;
  const after = DEMO_STEPS.findIndex((_, i) => i > lastDone && open(i));
  const current = after !== -1 ? after : DEMO_STEPS.findIndex((_, i) => open(i));
  const agreedVersion = order?.versions.find((v) => v.id === order.agreedVersionId);

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-border bg-surface/60">
      <AnimatePresence mode="wait" initial={false}>
        {agreed ? (
          <motion.div
            key="agreed"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE.settle }}
            className="relative flex flex-wrap items-center gap-x-4 gap-y-2 bg-success-bg px-3 py-2.5 sm:px-4"
            role="status"
          >
            {!reduce && <Confetti />}
            <motion.span initial={reduce ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...POP, delay: 0.1 }} className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
              <PartyPopper className="size-5" aria-hidden />
            </motion.span>
            <div className="min-w-0">
              <p className="font-bold text-foreground">
                Order agreed{agreedAfter !== null && agreedAfter < 30 * 60_000 ? ` in ${clock(agreedAfter)}` : ''}. No guesswork, no “that’s not what I asked for”.
              </p>
              <p className="truncate text-[13px] text-muted-foreground">
                Priya and Neha approved the same version {agreedVersion?.number ?? ''}
                {agreedVersion && (
                  <>
                    , sealed with fingerprint <span className="font-mono text-foreground">{agreedVersion.snapshotHash.slice(0, 12)}…</span>
                  </>
                )}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="success">
                <a href={`/o/${demo.orderId}/work-order#k=${encodeURIComponent(demo.sellerKey)}`} target="_blank" rel="noreferrer">
                  <FileText /> Work order
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/seller/${demo.shopId}#k=${encodeURIComponent(demo.sellerKey)}`} target="_blank" rel="noreferrer">
                  <LayoutDashboard /> Neha’s dashboard
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={onRestart}>
                <RotateCcw /> Try again
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="steps" exit={reduce ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE.exit }} className="flex items-center gap-3 overflow-x-auto px-3 py-2 sm:px-4">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-primary-text">
              Try it in 4 steps
              <span className="mt-0.5 block font-mono text-[11px] font-semibold normal-case tracking-normal text-muted-foreground" aria-live="polite">
                {done.filter(Boolean).length} of 4 done
              </span>
            </span>
            <ol className="flex flex-1 gap-2" aria-label="Try it in 4 steps">
              {DEMO_STEPS.map((s, i) => (
                <li
                  key={i}
                  aria-current={i === current ? 'step' : undefined}
                  className={cn(
                    'relative flex min-w-[13rem] flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] leading-snug transition-[background-color,border-color,box-shadow] duration-300',
                    done[i] ? 'border-success/35 bg-success-bg' : i === current ? 'border-primary bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]' : 'border-border bg-surface',
                  )}
                >
                  <span className={cn('relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', done[i] ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground')}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {done[i] ? (
                        <motion.span key="done" initial={reduce ? false : { scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={POP}>
                          <Check className="size-3.5" strokeWidth={3} aria-label="Done" />
                        </motion.span>
                      ) : (
                        <motion.span key="n" exit={reduce ? undefined : { scale: 0 }}>
                          {i + 1}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {i === current && !reduce && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden />}
                  </span>
                  <span className={cn('text-foreground', done[i] && 'text-muted-foreground')}>
                    <span className="font-bold text-foreground">{s.who}</span> <span className="text-muted-foreground">({s.side})</span>: {s.text}
                    {s.optional && !done[i] && <span className="ml-1 text-xs text-muted-foreground">Optional</span>}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A short, one-off burst of brand-coloured paper (purely decorative; skipped with reduced motion). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        drift: (Math.random() - 0.5) * 120,
        rotate: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.25,
        color: ['var(--color-primary)', 'var(--color-success)', '#f4ebd9', '#f7c6d0', '#6b8f5e'][i % 5],
        w: 5 + Math.random() * 5,
      })),
    [],
  );
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.color }}
          initial={{ y: -14, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: 90, x: p.drift, rotate: p.rotate, opacity: 0 }}
          transition={{ duration: 1.6, delay: p.delay, ease: EASE.settle }}
        />
      ))}
    </span>
  );
}
