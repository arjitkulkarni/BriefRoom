import { ArrowRight, Armchair, BadgeCheck, Bot, CakeSlice, CheckCircle2, ClipboardCheck, Cpu, FileCheck2, Fingerprint, Gem, Handshake, Layers, Link2, MessageSquareText, MousePointerClick, Radar, Shirt, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { EASE } from '@/components/motion/kit';
import { Link } from 'react-router-dom';
import { TEMPLATES } from '@shared/templates';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { lastShop } from '@/lib/keys';
import { cn } from '@/lib/utils';
import { KindChip, MarkerBadge } from '../annotations/annotation-meta';
import { DEMO_ANNOTATIONS, DEMO_DIFF, DEMO_HASH, DEMO_IMAGE, DEMO_IMAGE_SIZE } from './demo-data';
import { DemoMarkers } from './hero-preview';
import { HeroCopy, HeroScene } from './hero-spatial';

/** Highlighter stroke behind text; wraps across lines (box-decoration-clone), never forces overflow. */
function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="box-decoration-clone rounded-[3px] bg-[linear-gradient(transparent_46%,var(--accent)_46%,var(--accent)_90%,transparent_90%)] px-1 [-webkit-box-decoration-break:clone]">{children}</span>;
}

/** Scroll reveal: the section header, then its content, rise into place once (opacity + 24 px). */
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -12% 0px' },
  transition: { duration: 0.75, delay, ease: EASE.settle },
});

function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24', className)}>
      <motion.div {...reveal()}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-px w-6 bg-accent" aria-hidden /> {eyebrow}
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{intro}</p>}
      </motion.div>
      <motion.div className="mt-10" {...reveal(0.12)}>
        {children}
      </motion.div>
    </section>
  );
}

function ChatProblem() {
  const lines = [
    { who: 'c', t: 'Something like this but pink? 🙂', time: '10:02' },
    { who: 's', t: 'Which pink — blush or hot pink?', time: '10:40' },
    { who: 'c', t: '[voice note 0:48]', time: '11:15' },
    { who: 's', t: 'Is it 1 kg or 1.5?', time: '13:02' },
    { who: 'c', t: 'Whatever looks right. Eggless pls', time: '18:30' },
    { who: 's', t: 'Does ₹1,800 work? Includes topper?', time: 'Tue' },
    { who: 'c', t: 'Wait which photo did we decide on', time: 'Wed' },
  ];
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div className="relative rounded-xl glass-panel p-4 shadow-sm" aria-label="Illustration of a typical chat thread">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">Illustration · a typical custom-order thread</p>
        <ol className="grid gap-2">
          {lines.map((l, i) => (
            <li key={i} className={cn('max-w-[78%] rounded-lg px-3 py-1.5 text-sm', l.who === 'c' ? 'justify-self-end bg-bubble-own text-foreground' : 'bg-surface-secondary text-foreground')}>
              {l.t} <span className="ml-1 text-[11px] text-muted-foreground">{l.time}</span>
            </li>
          ))}
        </ol>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-xl bg-gradient-to-t from-surface to-transparent" aria-hidden />
      </div>
      <ul className="grid gap-4">
        {[
          ['“The flowers on the left” means something different to each person.', 'Words about images are ambiguous. BriefRoom lets people point at the exact region.'],
          ['Size, price and date get agreed somewhere in message 27.', 'Every detail lives in one structured specification with an owner and a history.'],
          ['Nobody can prove what was finally confirmed.', 'Both people approve the same frozen version with a fingerprint, and it becomes the work order.'],
        ].map(([p, s]) => (
          <li key={p} className="rounded-lg glass-panel p-4">
            <p className="font-semibold text-foreground">{p}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpatialDemo() {
  const [selected, setSelected] = useState('a1');
  const a = DEMO_ANNOTATIONS.find((x) => x.id === selected)!;
  return (
    <div className="grid gap-6 rounded-2xl glass-panel p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="canvas-surface rounded-xl p-4">
        <div className="relative mx-auto max-w-[300px] overflow-hidden rounded-md shadow-lg" style={{ aspectRatio: `${DEMO_IMAGE_SIZE.width} / ${DEMO_IMAGE_SIZE.height}` }}>
          <img src={DEMO_IMAGE} alt="Reference photo with four numbered annotations" className="absolute inset-0 size-full object-cover" loading="lazy" />
          <DemoMarkers items={DEMO_ANNOTATIONS} selected={selected} onSelect={setSelected} />
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ANNOTATIONS.map((x) => (
            <button key={x.id} onClick={() => setSelected(x.id)} aria-pressed={x.id === selected} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', x.id === selected ? 'border-primary/40 bg-primary-soft' : 'border-border hover:bg-surface-secondary')}>
              <MarkerBadge number={x.number} kind={x.kind} size="sm" />
              <KindChip kind={x.kind} short />
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">
            #{a.number} · {a.note}
          </p>
          <ol className="mt-3 grid gap-2">
            {a.thread.map((m, i) => (
              <li key={i} className={cn('max-w-[90%] rounded-lg border px-3 py-2 text-sm', m.who === 'customer' ? 'justify-self-end border-bubble-own-border bg-bubble-own' : 'border-bubble-other-border bg-bubble-other')}>
                <span className="block text-[11px] font-semibold text-muted-foreground">{m.who === 'customer' ? 'Customer' : 'Seller'}</span>
                {m.text}
              </li>
            ))}
          </ol>
        </div>
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {[
            [MousePointerClick, 'Drag an area or drop a pin. Coordinates are stored relative to the image, so markers stay put on any screen.'],
            [MessageSquareText, 'Each region has its own discussion. Click the discussion to highlight the region, or the region to open the discussion.'],
            [CheckCircle2, 'A region only counts as resolved when the other person confirms it.'],
            [Layers, 'Seven annotation types, each with an icon and label: keep, change, colour, remove, add, question, custom.'],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof CheckCircle2;
            return (
              <li key={i} className="flex gap-2">
                <I className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
                <span>{text as string}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function RadarDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-3 rounded-2xl glass-panel p-5 shadow-sm">
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm font-semibold text-warning-text">
          <ShieldAlert className="size-4" aria-hidden /> 2 items block the next version
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Needs clarification</p>
        {[
          ['Time slot is required', 'Required field', 'warning'],
          ['Exact shade of ivory for #1?', 'Critical · asked by the seller', 'warning'],
        ].map(([t, b, tone]) => (
          <div key={t} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <ShieldAlert className="size-4 text-warning-text" aria-hidden />
            <span className="flex-1 font-semibold text-foreground">{t}</span>
            <Badge tone={tone as 'warning'}>{b}</Badge>
          </div>
        ))}
        <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Resolved</p>
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-bg p-3 text-sm">
          <CheckCircle2 className="size-4 text-success-text" aria-hidden />
          <span className="flex-1 text-foreground">Keep the leaves green → “Yes, keep them green.”</span>
        </div>
      </div>
      <div className="grid content-start gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-5">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            <Cpu aria-hidden /> Rules check
          </Badge>
          <span className="text-xs text-muted-foreground">Suggestion, not a confirmed fact</span>
        </div>
        <p className="font-semibold text-foreground">“A little bigger and slightly lighter” — what exact size and which shade?</p>
        <blockquote className="border-l-2 border-border-strong pl-3 text-sm italic text-muted-foreground">Evidence: “Make it a little bigger and slightly lighter.” — chat, today</blockquote>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" tabIndex={-1}>
            Ask the customer
          </Button>
          <Button size="sm" variant="outline" tabIndex={-1}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" tabIndex={-1}>
            Dismiss
          </Button>
        </div>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <Bot className="mt-0.5 size-4 shrink-0" aria-hidden />
          Deterministic checks always run. With an OpenAI key the AI adds suggestions too, but only ones that quote real evidence. It never edits the brief, resolves anything or approves.
        </p>
      </div>
    </div>
  );
}

function VersionDemo() {
  const [split, setSplit] = useState(48);
  const v1 = DEMO_ANNOTATIONS.slice(0, 2);
  const v2 = DEMO_ANNOTATIONS;
  return (
    <div className="grid gap-6 rounded-2xl glass-panel p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="grid gap-2">
        <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-md shadow-lg" style={{ aspectRatio: `${DEMO_IMAGE_SIZE.width} / ${DEMO_IMAGE_SIZE.height}` }}>
          <img src={DEMO_IMAGE} alt="Version 2 with all annotations" className="absolute inset-0 size-full object-cover" loading="lazy" />
          <DemoMarkers items={v2} selected={null} size="sm" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-hidden>
            <img src={DEMO_IMAGE} alt="" className="absolute inset-0 size-full object-cover" />
            <DemoMarkers items={v1} selected={null} size="sm" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} aria-hidden />
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">v1</span>
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">v2</span>
        </div>
        <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare version 1 and version 2" className="mx-auto w-full max-w-[300px] accent-primary" />
      </div>
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="success">+2 annotations</Badge>
          <Badge tone="warning">₹1,850 → ₹2,400</Badge>
          <Badge tone="outline">4 detail changes</Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Differences between version 1 and version 2</caption>
            <thead className="bg-surface-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">v1</th>
                <th className="px-3 py-2">v2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {DEMO_DIFF.map((d) => (
                <tr key={d.label}>
                  <th scope="row" className="px-3 py-2 font-medium text-foreground">
                    {d.label}
                  </th>
                  <td className="px-3 py-2 text-muted-foreground line-through">{d.before}</td>
                  <td className="px-3 py-2 font-semibold text-foreground">{d.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">Every proposal is a frozen snapshot. Differences are calculated from the two stored snapshots: images, regions, specification, price and delivery.</p>
      </div>
    </div>
  );
}

function ApprovalDemo() {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
      <div className="grid gap-3">
        {[
          ['Priya', 'Customer', 'Approved version 2'],
          ['Neha', 'Seller', 'Approved version 2'],
        ].map(([n, r, s]) => (
          <div key={n} className="flex items-center gap-3 rounded-xl border border-success/30 bg-surface p-4 shadow-xs">
            <CheckCircle2 className="size-6 text-success-text" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">
                {n} <span className="font-normal text-muted-foreground">· {r}</span>
              </p>
              <p className="text-sm text-muted-foreground">{s} · same fingerprint</p>
            </div>
          </div>
        ))}
      </div>
      <ArrowRight className="mx-auto size-6 rotate-90 text-muted-foreground lg:rotate-0" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-success/40 bg-surface shadow-md">
        <div className="flex items-center gap-3 bg-success-bg px-5 py-4">
          <span className="grid size-10 place-items-center rounded-full bg-success text-success-foreground">
            <Handshake className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-success-text">Order agreed</p>
            <p className="font-semibold text-foreground">Version 2 · ₹2,400 · 1 Dec, evening</p>
          </div>
        </div>
        <div className="grid gap-2 p-5">
          <p className="flex items-start gap-1.5 break-all font-mono text-xs text-muted-foreground">
            <Fingerprint className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {DEMO_HASH}
          </p>
          <p className="text-xs text-muted-foreground">Example fingerprint. The order counts as agreed only after the server verifies both approvals for the same version ID and SHA-256 hash, inside one database transaction.</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileCheck2 className="size-4" aria-hidden /> Printable A4 work order generated
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const shop = lastShop();
  return (
    <div className="app-shell min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6" aria-label="Main">
          <Logo className="text-[21px]" />
          <div className="ml-10 hidden items-center gap-1 md:flex">
            {[
              ['#how', 'How it works'],
              ['#features', 'Product'],
              ['#use-cases', 'Use cases'],
              ['https://github.com/arjitkulkarni/BriefRoom#readme', 'Docs'],
            ].map(([href, label]) => (
              <a key={href} href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {shop ? (
              <Button asChild variant="outline" size="sm">
                <Link to={`/seller/${shop}`}>My dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/start">
                  <span className="max-[420px]:hidden">Create your first brief</span>
                  <span className="min-[421px]:hidden">Get started</span>
                </Link>
              </Button>
            )}
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="relative mx-auto grid w-full max-w-7xl items-center gap-10 overflow-x-clip px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-6 lg:pb-24">
          <HeroCopy />
          <div className="min-w-0">
            <HeroScene />
          </div>
        </section>

        <div className="border-y border-[var(--glass-border)] bg-surface/40">
          <motion.p className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-6 text-[13px] font-semibold tracking-[0.32em] text-muted-foreground sm:text-sm" {...reveal()}>
            {['DISCUSS', 'CLARIFY', 'VERSION', 'APPROVE'].map((w, i) => (
              <span key={w} className="flex items-center gap-5">
                {i > 0 && <span className="text-accent" aria-hidden>·</span>}
                {w}
              </span>
            ))}
          </motion.p>
        </div>

        <div className="border-y border-border bg-surface">
          <Section eyebrow="The problem" title="Custom orders get lost in chat." intro="Chat is great for talking and terrible for agreeing. Screenshots, voice notes and “like this but…” pile up until nobody can say what was finally decided.">
            <ChatProblem />
          </Section>
        </div>

        <Section id="how" eyebrow="How BriefRoom works" title={<>From “something like this” to <Highlight>exactly what we agreed</Highlight>.</>}>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Link2, 'Share a reference', 'The seller sends a private link, or customers start from the shop link. Customers drop in “something like this” photos.'],
              [MousePointerClick, 'Point at what you mean', 'Mark exact regions: keep, change colour, remove, add, or ask. Every region gets its own discussion.'],
              [Radar, 'Settle open questions', 'The Clarification Radar and ambiguity checks surface missing sizes, colours and times before anything is frozen.'],
              [Handshake, 'Both approve one version', 'A frozen version with a SHA-256 fingerprint. When both approve the same one, it becomes the work order.'],
            ].map(([Icon, t, d], i) => {
              const I = Icon as typeof Link2;
              return (
                <li key={t as string} className="relative rounded-xl glass-panel p-5 shadow-xs">
                  <span className="font-mono text-xs font-medium text-muted-foreground">0{i + 1}</span>
                  <I className="mt-3 size-6 text-foreground" aria-hidden />
                  <h3 className="mt-3 font-bold text-foreground">{t as string}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{d as string}</p>
                </li>
              );
            })}
          </ol>
        </Section>

        <div id="features" className="border-y border-border bg-surface-secondary/60">
          <Section eyebrow="Visual collaboration" title="Talk about the exact region, not “the thing on the left”." intro="Try it: pick a marker. The discussion stays attached to that area of the image.">
            <SpatialDemo />
          </Section>
        </div>

        <Section eyebrow="Clarification Radar" title="See what’s still undecided — before it becomes a remake." intro="Questions, missing required details and critical issues in one shared board. Critical items block the next version until someone records the answer.">
          <RadarDemo />
        </Section>

        <div className="border-y border-border bg-surface-secondary/60">
          <Section eyebrow="Version comparison" title="What changed between versions, at a glance." intro="Drag the slider to compare version 1 and version 2.">
            <VersionDemo />
          </Section>
        </div>

        <Section eyebrow="Dual approval" title="Agreed means both of you approved the same thing." intro="Approvals bind to the order, the version and its SHA-256 fingerprint. Any change after that becomes a new version that needs both approvals again. The fingerprint is a record of what was agreed, not a legal contract.">
          <ApprovalDemo />
        </Section>

        <div className="border-y border-border bg-surface">
          <Section eyebrow="For sellers" title="Built for small studios that make things to order.">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [ClipboardCheck, 'Quote with confidence', 'Size, materials, date and price live in one checklist. Required fields have to be filled before a version can be proposed.'],
                [BadgeCheck, 'A record of every yes', 'Who approved what, and when, bound to an exact fingerprint you can print for the workshop.'],
                [Link2, 'A link for your bio', 'Customers start their own brief from your shop page. No app or signup for them.'],
                [ShieldCheck, 'Less back-and-forth', 'Questions are tied to regions and tracked to resolution instead of scrolling through chat.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Link2;
                return (
                  <li key={t as string} className="rounded-xl border border-border bg-background p-5">
                    <I className="size-6 text-foreground" aria-hidden />
                    <h3 className="mt-3 font-bold text-foreground">{t as string}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <Section id="use-cases" eyebrow="Use cases" title="One workflow, any made-to-order product." intro="Each product type has its own structured template. These are the real fields BriefRoom uses.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [CakeSlice, TEMPLATES.cake],
                [Shirt, TEMPLATES.merch],
                [Armchair, TEMPLATES.furniture],
                [Gem, TEMPLATES.jewellery],
              ] as const
            ).map(([Icon, t]) => (
              <div key={t.id} className="rounded-xl glass-panel p-5 shadow-xs">
                <Icon className="size-6 text-foreground" aria-hidden />
                <h3 className="mt-3 font-bold text-foreground">{t.name}</h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {t.fields
                    .filter((f) => f.required)
                    .map((f) => (
                      <li key={f.key} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {f.label.replace(/ \(.+\)$/, '')}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Your next custom order, agreed in one place.</h2>
            <p className="mx-auto mt-4 max-w-xl opacity-80">Set up a shop in under a minute, send one private link, and agree on exactly what you’ll make.</p>
            <Button asChild size="lg" className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/start">
                Create your first brief <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Logo />
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">From something like this to exactly what we agreed to make. Real-time conversations powered by Nexconn.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground sm:ml-auto" aria-label="Footer">
            <Link to="/start" className="hover:text-foreground">
              Start a shop
            </Link>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <Link to="/design-system" className="hover:text-foreground">
              Design system
            </Link>
            <Link to="/stats" className="hover:text-foreground">
              Live usage
            </Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
          Product photos from Unsplash (see <code className="font-mono">public/images/CREDITS.md</code>). Demo content on this page is illustrative.
        </p>
      </footer>
    </div>
  );
}
