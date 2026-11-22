/**
 * /motion-lab — isolated preview of three motion directions (docs/MOTION_CONCEPTS.md). Not linked from the product
 * and not imported by any production screen; lazy-loaded, so it adds nothing to other routes.
 * Deep links: /motion-lab?c=a | b | c
 */
import { LayoutGroup, motion, MotionConfig } from 'motion/react';
import { FlaskConical } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageLoader } from '@/components/feedback/states';
import { Logo, ThemeSegmented } from '@/components/layout/brand';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { EASE } from '@/components/motion/kit';

const ConceptSpatial = lazy(() => import('./concept-a-spatial'));
const ConceptStory = lazy(() => import('./concept-b-story'));
const ConceptLiving = lazy(() => import('./concept-c-living'));

type ConceptId = 'a' | 'b' | 'c';
const CONCEPTS: { id: ConceptId; label: string; name: string; sequence: string[] }[] = [
  {
    id: 'a',
    label: 'A',
    name: 'Spatial workspace',
    sequence: [
      'Badge, then the headline word by word; the yellow highlighter wipes across “without the guesswork.”, then the line, CTAs and checklist settle with a short stagger.',
      'The product assembles in depth: the yellow plate, the reference canvas, then conversation, radar, specification, version and agreement panels fly forward from −280 px to their own depth, 0.12–0.15 s apart.',
      'Numbered pins pop up above the photo at four different depths, each casting a soft shadow onto the photo.',
      'Living loop: every 4.2 s the focus moves to the next annotation and the conversation panel swaps to that region’s thread.',
      'Once: Priya approves (sweep from the left), Neha approves (sweep from the right), the two chips converge into “Order agreed” and the fingerprint is highlighted.',
      'With a mouse, the whole composition leans toward the pointer through heavy springs (±6° / ±8°); three panels drift a few pixels. Touch and reduced motion keep the resting composition.',
    ],
  },
  {
    id: 'b',
    label: 'B',
    name: 'Scroll story',
    sequence: [
      'A sticky stage with eight steps; native scrolling only. The rail on the left fills with scroll progress, and the current step’s title is highlighted.',
      '01 Upload card with progress bar → 02 the thumbnail morphs into the canvas (shared element) → 03 pins pop in with the region outlines.',
      '04 The discussion card arrives and the canvas spotlights region #1 → 05 the radar resolves both items, which glide into Resolved.',
      '06 The version card comes forward while earlier cards recede (scale 0.94, 45 % opacity); diff values are highlighted in sequence and the price gets a short emphasis.',
      '07 Both approvals check in from opposite sides → 08 they converge into the agreement, which scales forward under a soft yellow glow.',
      'Scrolling back reverses each state; clicking a step scrolls there. Phones show a caption bar and at most two cards at a time.',
    ],
  },
  {
    id: 'c',
    label: 'C',
    name: 'Living canvas',
    sequence: [
      'Hover a pin to preview it below the photo; click to focus: the photo zooms toward the region, a cut-out spotlight glides to it, and the pins counter-scale so they stay the same size.',
      'The discussion tab opens with the region’s thread emerging message by message; “Raise as clarification” adds it to the radar (the badge count rolls and bumps).',
      'Radar: Resolve moves an item into Resolved with a shared-layout glide; the banner flips from “blocks the next version” to “Nothing blocks version 2”.',
      'Versions: the selector pill slides; version 1 removes pins #3 and #4 from the photo, version 2 brings them back and highlights each changed value in sequence.',
      'Approve is locked while anything blocks the version. Each person’s approval animates from their side; both together converge into the agreement, then the work order card unfolds.',
      'Tabs slide in the direction of travel; every control is a real button, and state changes are announced to screen readers.',
    ],
  },
];

export default function MotionLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('c');
  const active: ConceptId = raw === 'b' || raw === 'c' ? raw : 'a';
  const concept = CONCEPTS.find((c) => c.id === active)!;
  useEffect(() => {
    document.title = 'Motion Lab — BriefRoom (preview)';
  }, []);
  const pick = (id: ConceptId) => {
    setParams(id === 'a' ? {} : { c: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell min-h-dvh">
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
            <Logo />
            <Badge tone="warning" className="max-sm:hidden">
              <FlaskConical aria-hidden /> Motion Lab · preview, not the production page
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <ThemeSegmented />
            </div>
            <LayoutGroup id="lab-concepts">
              <nav aria-label="Motion concepts" className="flex w-full gap-1 rounded-lg border border-border bg-surface p-1 sm:w-auto">
                {CONCEPTS.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c.id)} aria-current={c.id === active ? 'page' : undefined} className={cn('relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none', c.id === active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {c.id === active && <motion.span layoutId="lab-concept-pill" className="absolute inset-0 rounded-md bg-primary" transition={{ duration: 0.35, ease: EASE.glide }} />}
                    <span className="relative">
                      {c.label} <span className="max-sm:hidden">· {c.name}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </LayoutGroup>
          </div>
        </header>

        <main>
          <Suspense fallback={<PageLoader />}>
            {active === 'a' && <ConceptSpatial />}
            {active === 'b' && <ConceptStory />}
            {active === 'c' && <ConceptLiving />}
          </Suspense>

          <section aria-labelledby="sequence-h" className="border-t border-border bg-surface">
            <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Concept {concept.label}</p>
              <h2 id="sequence-h" className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
                {concept.name} — animation sequence
              </h2>
              <ol className="mt-5 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {concept.sequence.map((s, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-border bg-background p-3">
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-xs text-muted-foreground">Transform and opacity animations only (plus one background-size highlighter wipe); off-screen loops pause; reduced-motion users get instant states. Comparison: docs/MOTION_CONCEPTS.md.</p>
            </div>
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}
