/**
 * Concept C — Living canvas. An interactive demonstration of BriefRoom's real interaction model (illustrative data,
 * nothing is saved): hover or click a pin to focus its region, read the discussion that belongs to it, raise it as a
 * clarification, resolve the radar, switch versions, and approve as each party. Approval stays locked while anything
 * blocks the version — the same rule the backend enforces. Every control is a real button.
 */
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, FileCheck2, GitCompareArrows, Handshake, MessageSquareText, MousePointerClick, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { ANNOTATION_KIND_META } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { KindChip, MarkerBadge, TONE_CLASSES, toneOf } from '../annotations/annotation-meta';
import { DEMO_IMAGE, type DemoAnnotation } from '../landing/demo-data';
import { AgreementCard, ANNOTATIONS, CountRoll, DIFF, EASE, HASH, HighlightWipe, IMAGE_RATIO, pct, Spotlight, ThreadBubbles } from '@/components/motion/kit';

type Tab = 'talk' | 'radar' | 'versions' | 'approve';
interface Clar {
  id: string;
  title: string;
  tag: string;
  answer: string;
  resolved: boolean;
}
const START: Clar[] = [
  { id: 'c1', title: 'Exact delivery time on 1 Dec?', tag: 'Critical · asked by Neha', answer: 'Evening, 5–7 pm', resolved: false },
  { id: 'c2', title: 'Time slot is required', tag: 'Required field', answer: 'Evening (4–8)', resolved: false },
];
const TABS: { id: Tab; label: string; icon: typeof MessageSquareText }[] = [
  { id: 'talk', label: 'Discuss', icon: MessageSquareText },
  { id: 'radar', label: 'Radar', icon: ShieldAlert },
  { id: 'versions', label: 'Versions', icon: GitCompareArrows },
  { id: 'approve', label: 'Approve', icon: Handshake },
];
/** Version 1 had two annotations; version 2 added #3 and #4. */
const IN_V1 = new Set(['a1', 'a2']);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Pin({ a, selected, hovered, inv, resolved, onSelect, onHover }: { a: DemoAnnotation; selected: string | null; hovered: string | null; inv: number; resolved: boolean; onSelect: (id: string | null) => void; onHover: (id: string | null) => void }) {
  const t = TONE_CLASSES[toneOf(a.kind)];
  const sel = selected === a.id;
  const hov = hovered === a.id;
  const dim = Boolean(selected) && !sel;
  const label = `#${a.number} ${ANNOTATION_KIND_META[a.kind].label}: ${a.note}`;
  const handlers = {
    onClick: () => onSelect(sel ? null : a.id),
    onPointerEnter: () => onHover(a.id),
    onPointerLeave: () => onHover(null),
    onFocus: () => onHover(a.id),
    onBlur: () => onHover(null),
  };
  const badge = (
    <motion.span className="block" animate={{ scale: inv * (sel ? 1.12 : hov ? 1.08 : 1) }} transition={{ duration: 0.4, ease: EASE.settle }}>
      <MarkerBadge number={a.number} kind={a.kind} resolved={resolved} className={cn('shadow-md', sel && 'ring-4 ring-white/80')} />
    </motion.span>
  );
  return (
    <motion.span className="pointer-events-none absolute inset-0" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.35, ease: EASE.settle }}>
      {a.shape === 'point' ? (
        <button type="button" aria-label={label} aria-pressed={sel} {...handlers} className={cn('pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring', dim && 'opacity-60')} style={{ left: pct(a.x), top: pct(a.y) }}>
          {badge}
        </button>
      ) : (
        <button type="button" aria-label={label} aria-pressed={sel} {...handlers} className={cn('pointer-events-auto absolute rounded-[6px] border-2 transition-[opacity,background-color] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring', t.border, hov || sel ? 'bg-white/20' : 'bg-white/[0.06]', dim && 'opacity-60')} style={{ left: pct(a.x), top: pct(a.y), width: pct(a.w), height: pct(a.h) }}>
          <span className="absolute -left-3 -top-3">{badge}</span>
        </button>
      )}
    </motion.span>
  );
}

export default function ConceptLiving() {
  const reduce = useReducedMotion();
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>('talk');
  const dir = useRef(1);
  const [clars, setClars] = useState<Clar[]>(START);
  const [version, setVersion] = useState<1 | 2>(2);
  const [buyer, setBuyer] = useState(false);
  const [seller, setSeller] = useState(false);
  const [note, setNote] = useState('');
  const [radarBump, setRadarBump] = useState(0);

  const open = clars.filter((c) => !c.resolved).length;
  const agreed = buyer && seller;
  const visible = ANNOTATIONS.filter((x) => version === 2 || IN_V1.has(x.id));
  const a = visible.find((x) => x.id === sel) ?? null;
  const peek = visible.find((x) => x.id === (hover ?? sel)) ?? null;

  // Focus: zoom toward the selected region; pins counter-scale so they stay the same size.
  const zoom = a && !reduce ? 1.55 : 1;
  const cx = a ? (a.shape === 'point' ? a.x : a.x + a.w / 2) : 0.5;
  const cy = a ? (a.shape === 'point' ? a.y : a.y + a.h / 2) : 0.5;
  const lim = ((zoom - 1) / 2) * 100;
  const tx = clamp(-(cx - 0.5) * zoom * 100, -lim, lim);
  const ty = clamp(-(cy - 0.5) * zoom * 100, -lim, lim);

  const setTab = (t: Tab) => {
    dir.current = TABS.findIndex((x) => x.id === t) >= TABS.findIndex((x) => x.id === tab) ? 1 : -1;
    setTabState(t);
  };
  const select = (id: string | null) => {
    setSel(id);
    if (id) setTab('talk');
  };
  const raise = (x: DemoAnnotation) => {
    if (clars.some((c) => c.id === `r-${x.id}`)) return;
    setClars((c) => [...c, { id: `r-${x.id}`, title: x.note, tag: `From #${x.number} · critical`, answer: x.thread[x.thread.length - 1].text, resolved: false }]);
    setRadarBump((b) => b + 1);
    setNote(`Added #${x.number} to the Clarification Radar.`);
  };
  const resolve = (c: Clar) => {
    setClars((all) => all.map((x) => (x.id === c.id ? { ...x, resolved: true } : x)));
    setNote(`Resolved: ${c.title} → ${c.answer}`);
  };
  const approve = (who: 'buyer' | 'seller') => {
    if (who === 'buyer') setBuyer(true);
    else setSeller(true);
    const both = (who === 'buyer' ? seller : buyer) === true;
    setNote(both ? 'Order agreed — both approved version 2 and the same fingerprint.' : `${who === 'buyer' ? 'Priya' : 'Neha'} approved version 2.`);
  };
  const reset = () => {
    setSel(null);
    setHover(null);
    setTabState('talk');
    setClars(START);
    setVersion(2);
    setBuyer(false);
    setSeller(false);
    setNote('Demo reset.');
  };

  return (
    <section aria-label="Concept C: interactive living canvas" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Try the workspace</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
          Point, discuss, decide — <HighlightWipe delay={0.3}>agree.</HighlightWipe>
        </h2>
        <p className="mt-3 text-muted-foreground">A live demonstration with an example brief. Pick a pin, raise a question, resolve it, compare versions, approve as both people.</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ---------------- canvas */}
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
            <MousePointerClick className="size-3.5" aria-hidden /> Reference · version {version}
            <AnimatePresence>
              {agreed && (
                <motion.span className="ml-auto" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 24 }}>
                  <Badge tone="success">
                    <ShieldCheck aria-hidden /> Agreed v2
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className={cn('canvas-surface rounded-xl p-3 transition-shadow duration-500', agreed && 'shadow-[inset_0_0_0_2px_var(--success)]')}>
            <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-lg" style={{ aspectRatio: IMAGE_RATIO }} onKeyDown={(e) => e.key === 'Escape' && select(null)}>
              <motion.div className="absolute inset-0" initial={false} animate={{ scale: zoom, x: `${tx}%`, y: `${ty}%` }} transition={{ duration: 0.75, ease: EASE.glide }}>
                <img src={DEMO_IMAGE} alt="Reference photo: a white tiered cake topped with berries" className="absolute inset-0 size-full select-none object-cover" draggable={false} />
                <Spotlight a={a} />
                <AnimatePresence initial={false}>
                  {visible.map((x) => (
                    <Pin key={x.id} a={x} selected={sel} hovered={hover} inv={1 / zoom} resolved={x.status === 'resolved'} onSelect={select} onHover={setHover} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
          <div className="mt-2 min-h-[52px] px-1" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {peek ? (
                <motion.div key={peek.id} className="flex items-center gap-2 text-sm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: EASE.settle }}>
                  <MarkerBadge number={peek.number} kind={peek.kind} size="sm" />
                  <KindChip kind={peek.kind} short />
                  <span className="min-w-0 truncate text-foreground">{peek.note}</span>
                </motion.div>
              ) : (
                <motion.p key="hint" className="text-sm text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Hover or tap a numbered pin. <span className="max-sm:hidden">Esc clears the focus.</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---------------- panel */}
        <div className="flex min-h-[540px] min-w-0 flex-col rounded-2xl border border-border bg-surface shadow-sm">
          <div role="tablist" aria-label="Workspace panels" className="flex gap-1 overflow-x-auto border-b border-divider p-1.5">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`lab-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="lab-tabpanel" onClick={() => setTab(t.id)} className={cn('relative flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {tab === t.id && <motion.span layoutId="lab-tab-pill" className="absolute inset-0 rounded-md bg-primary-soft" transition={{ duration: 0.35, ease: EASE.glide }} />}
                <span className="relative inline-flex items-center gap-1.5">
                  <t.icon className="size-4" aria-hidden />
                  <span className="max-[400px]:sr-only">{t.label}</span>
                  {t.id === 'radar' && open > 0 && (
                    <motion.span key={radarBump} className="grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] text-white" initial={reduce ? false : { scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                      <CountRoll value={open} />
                    </motion.span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden p-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} role="tabpanel" id="lab-tabpanel" aria-labelledby={`lab-tab-${tab}`} initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * 18 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * -14 }} transition={{ duration: 0.26, ease: EASE.settle }}>
                {tab === 'talk' &&
                  (a ? (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MarkerBadge number={a.number} kind={a.kind} />
                        <KindChip kind={a.kind} />
                        {a.status === 'resolved' && (
                          <Badge tone="success" className="ml-auto">
                            <CheckCircle2 aria-hidden /> Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="font-semibold text-foreground">{a.note}</p>
                      <ThreadBubbles key={a.id} thread={a.thread} delay={0.05} step={0.22} className="[&_li]:text-[13.5px]" />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled={agreed || clars.some((c) => c.id === `r-${a.id}`)} onClick={() => raise(a)}>
                          <ShieldAlert /> {clars.some((c) => c.id === `r-${a.id}`) ? 'In the radar' : 'Raise as clarification'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => select(null)}>
                          Clear focus
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <p className="text-sm text-muted-foreground">Pick a pin on the photo — its region comes into focus and the conversation about it appears here.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visible.map((x) => (
                          <button key={x.id} type="button" onClick={() => select(x.id)} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <MarkerBadge number={x.number} kind={x.kind} size="sm" />
                            <KindChip kind={x.kind} short />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                {tab === 'radar' && (
                  <LayoutGroup id="lab-radar">
                    <div className="grid gap-3">
                      <AnimatePresence mode="wait" initial={false}>
                        {open > 0 ? (
                          <motion.div key="block" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm font-semibold text-warning-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <ShieldAlert className="size-4" aria-hidden /> <CountRoll value={open} /> {open === 1 ? 'item blocks' : 'items block'} the next version
                          </motion.div>
                        ) : (
                          <motion.div key="clear" className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-bg px-3 py-2 text-sm font-semibold text-success-text" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE.settle }}>
                            <ShieldCheck className="size-4" aria-hidden /> Nothing blocks version 2
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Needs clarification</p>
                      <ul className="grid gap-2">
                        {clars
                          .filter((c) => !c.resolved)
                          .map((c) => (
                            <motion.li key={c.id} layoutId={c.id} layout transition={{ layout: { duration: 0.5, ease: EASE.glide } }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-sm">
                              <ShieldAlert className="size-4 shrink-0 text-warning-text" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <b className="block text-foreground">{c.title}</b>
                                <span className="text-[11.5px] text-muted-foreground">{c.tag}</span>
                              </span>
                              <Button size="sm" onClick={() => resolve(c)}>
                                Resolve
                              </Button>
                            </motion.li>
                          ))}
                        {open === 0 && <li className="text-sm text-muted-foreground">No open questions.</li>}
                      </ul>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resolved</p>
                      <ul className="grid gap-2">
                        {clars
                          .filter((c) => c.resolved)
                          .map((c) => (
                            <motion.li key={c.id} layoutId={c.id} layout transition={{ layout: { duration: 0.5, ease: EASE.glide } }} className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-bg p-2.5 text-sm text-success-text">
                              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                              <span className="min-w-0">
                                <b>{c.title}</b> → {c.answer}
                              </span>
                            </motion.li>
                          ))}
                      </ul>
                    </div>
                  </LayoutGroup>
                )}

                {tab === 'versions' && (
                  <div className="grid gap-3">
                    <div role="radiogroup" aria-label="Show version" className="inline-flex w-fit gap-1 rounded-lg border border-border p-1">
                      {([1, 2] as const).map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={version === v} onClick={() => setVersion(v)} className="relative rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {version === v && <motion.span layoutId="lab-version-pill" className="absolute inset-0 rounded-md bg-primary" transition={{ duration: 0.35, ease: EASE.glide }} />}
                          <span className={cn('relative transition-colors', version === v ? 'text-primary-foreground' : 'text-muted-foreground')}>Version {v}</span>
                        </button>
                      ))}
                    </div>
                    <table className="w-full text-left text-sm" aria-label="Changes between version 1 and version 2">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-1.5 font-bold">Item</th>
                          <th className={cn('py-1.5 font-bold transition-colors', version === 1 && 'text-foreground')}>v1</th>
                          <th className={cn('py-1.5 font-bold transition-colors', version === 2 && 'text-foreground')}>v2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DIFF.map((d, i) => (
                          <tr key={d.label} className="border-t border-divider">
                            <td className="py-2 pr-2 text-muted-foreground">{d.label}</td>
                            <td className={cn('py-2 pr-2 transition-opacity', version === 2 ? 'text-muted-foreground opacity-70' : 'text-foreground')}>{d.before}</td>
                            <td className="py-2">
                              <motion.span className="inline-block" animate={version === 2 && d.label === 'Quoted price' && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}>
                                <HighlightWipe tone="mark" active={version === 2} delay={0.1 + i * 0.14} className={cn('font-semibold', version === 2 ? 'text-foreground' : 'text-muted-foreground')}>
                                  {d.after}
                                </HighlightWipe>
                              </motion.span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="font-mono text-[11px] text-muted-foreground">Each version is a frozen snapshot · v2 fingerprint #{HASH.slice(0, 12)}</p>
                  </div>
                )}

                {tab === 'approve' &&
                  (open > 0 ? (
                    <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning-bg p-3 text-sm text-warning-text">
                      <p>
                        <b>Version 2 can’t be approved yet.</b> <CountRoll value={open} /> open {open === 1 ? 'clarification blocks' : 'clarifications block'} it — the same rule the real backend enforces.
                      </p>
                      <Button size="sm" variant="outline" className="w-fit" onClick={() => setTab('radar')}>
                        <ShieldAlert /> Open the radar
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <AgreementCard buyer={buyer} seller={seller} />
                      {!agreed ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button variant={buyer ? 'outline' : 'primary'} disabled={buyer} onClick={() => approve('buyer')}>
                            {buyer ? 'Priya approved' : 'Approve as Priya (customer)'}
                          </Button>
                          <Button variant={seller ? 'outline' : 'primary'} disabled={seller} onClick={() => approve('seller')}>
                            {seller ? 'Neha approved' : 'Approve as Neha (seller)'}
                          </Button>
                        </div>
                      ) : (
                        <motion.div className="grid gap-1.5 rounded-lg border border-border bg-background p-3 text-sm" initial={{ opacity: 0, y: 14, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.6, duration: 0.7, ease: EASE.settle }} style={{ transformPerspective: 900 }}>
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <FileCheck2 className="size-4" aria-hidden /> Work order · version 2
                          </span>
                          <span className="text-muted-foreground">1.5 kg · Round · Vanilla · Ivory roses #f4ebd9 · Tue 1 Dec, evening · Pickup · ₹2,400</span>
                        </motion.div>
                      )}
                    </div>
                  ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 border-t border-divider px-4 py-2.5 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1 truncate" aria-live="polite">
              {note || 'Illustrative demo — nothing here is saved.'}
            </span>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw /> Reset
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
