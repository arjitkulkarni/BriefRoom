import { AlertTriangle, Bot, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Cpu, Loader2, MapPin, MessageSquare, Plus, RotateCcw, ShieldAlert, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { EASE } from '@/components/motion/kit';
import { AI_PROVIDER_LABEL, otherRole, roleLabel, type AnalysisOutcome, type Blocker, type ClarificationView, type OrderView, type Role, type SuggestionView } from '@shared/types';
import { EmptyState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { Badge, Switch } from '@/components/ui/primitives';
import { ago, cn } from '@/lib/utils';
import { MarkerBadge } from '../annotations/annotation-meta';

export interface RadarActions {
  raise: (input: { title: string; description?: string; critical: boolean; annotationId?: string | null }) => Promise<boolean>;
  reply: (id: string, body: string) => Promise<boolean>;
  resolve: (id: string, resolution: string) => Promise<boolean>;
  reopen: (id: string) => Promise<void>;
  setCritical: (id: string, critical: boolean) => Promise<void>;
  analyse: () => Promise<AnalysisOutcome | null>;
  ask: (s: SuggestionView, question: string, critical: boolean) => Promise<void>;
  dismiss: (s: SuggestionView) => Promise<void>;
  focusAnnotation: (id: string) => void;
  focusSpec: (key: string) => void;
}

const SOURCE = {
  manual: { label: 'Asked by a person', icon: MessageSquare },
  ai: { label: 'AI suggestion', icon: Bot },
  rules: { label: 'Rules check', icon: Cpu },
} as const;

function ClarificationCard({ c, order, role, locked, busy, actions }: { c: ClarificationView; order: OrderView; role: Role; locked: boolean; busy: string | null; actions: RadarActions }) {
  const [open, setOpen] = useState(c.status !== 'resolved');
  const [reply, setReply] = useState('');
  const [resolution, setResolution] = useState('');
  const names = Object.fromEntries(order.participants.map((p) => [p.role, p.name])) as Record<Role, string>;
  const ann = c.annotationId ? order.annotations.find((a) => a.id === c.annotationId) : null;
  const Src = SOURCE[c.source];
  return (
    <motion.article layout layoutId={`clar-${c.id}`} transition={{ layout: { duration: 0.45, ease: EASE.glide } }} className={cn('rounded-xl border bg-surface', c.critical && c.status !== 'resolved' ? 'border-warning/50 shadow-[0_0_0_3px_rgb(180_83_9/0.08)]' : 'border-border')}>
      <button type="button" className="flex w-full items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', c.status === 'resolved' ? 'bg-success-bg text-success-text' : c.critical ? 'bg-warning-bg text-warning-text' : 'bg-info-bg text-info-text')}>
          {c.status === 'resolved' ? <CheckCircle2 className="size-4" aria-hidden /> : c.critical ? <ShieldAlert className="size-4" aria-hidden /> : <CircleHelp className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{c.title}</p>
          {c.status === 'resolved' && c.resolution && (
            <p className="mt-0.5 text-[13px] text-success-text">
              <span aria-hidden>→ </span>
              <span className="sr-only">Answer: </span>
              {c.resolution}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {c.critical && c.status !== 'resolved' && <Badge tone="warning">Blocks next version</Badge>}
            <Badge tone="neutral">
              <Src.icon aria-hidden /> {Src.label}
            </Badge>
            {c.ownerRole && c.status !== 'resolved' && <Badge tone="outline">Owner: {c.ownerRole === role ? 'you' : roleLabel(c.ownerRole)}</Badge>}
          </div>
        </div>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-divider p-3 text-sm">
          {c.description && <p className="text-foreground">{c.description}</p>}
          {c.evidence && (
            <blockquote className="border-l-2 border-border-strong pl-3 text-[13px] italic text-muted-foreground">
              <span className="not-italic font-semibold">Evidence: </span>
              {c.evidence}
            </blockquote>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              Raised by {c.createdByRole === role ? 'you' : names[c.createdByRole]} · {ago(c.createdAt)}
            </span>
            {ann && (
              <button className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline" onClick={() => actions.focusAnnotation(ann.id)}>
                <MarkerBadge number={ann.number} kind={ann.kind} size="sm" /> Show region
              </button>
            )}
            {c.messageId && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" aria-hidden /> From the conversation</span>}
          </div>
          {c.comments.length > 0 && (
            <ol className="grid gap-1.5">
              {c.comments.map((m) => (
                <li key={m.id} className="rounded-md bg-surface-secondary px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {m.authorRole === role ? 'You' : m.authorName} · {ago(m.createdAt)}
                  </p>
                  <p className="text-foreground">{m.body}</p>
                </li>
              ))}
            </ol>
          )}
          {c.status === 'resolved' ? (
            <div className="rounded-md border border-success/30 bg-success-bg px-3 py-2">
              <p className="text-xs font-semibold text-success-text">
                Resolved by {c.resolvedByRole === role ? 'you' : names[c.resolvedByRole!]} · {ago(c.resolvedAt)}
              </p>
              <p className="mt-0.5 text-foreground">{c.resolution}</p>
              {!locked && (
                <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => actions.reopen(c.id)}>
                  <RotateCcw /> Reopen
                </Button>
              )}
            </div>
          ) : (
            !locked && (
              <div className="grid gap-2">
                <div className="flex gap-2">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" aria-label={`Reply to ${c.title}`} onKeyDown={async (e) => e.key === 'Enter' && reply.trim() && (await actions.reply(c.id, reply)) && setReply('')} />
                  <Button variant="outline" disabled={!reply.trim()} loading={busy === `reply-${c.id}`} onClick={async () => (await actions.reply(c.id, reply)) && setReply('')}>
                    Reply
                  </Button>
                </div>
                <div className="grid gap-2 rounded-md border border-border bg-surface-secondary p-2.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor={`res-${c.id}`}>
                    Answer that resolves it <span className="font-normal text-muted-foreground">(becomes part of the agreed brief)</span>
                  </label>
                  <div className="flex gap-2">
                    <Input id={`res-${c.id}`} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Keep the leaves green" />
                    <Button variant="success" disabled={!resolution.trim()} loading={busy === `resolve-${c.id}`} onClick={async () => (await actions.resolve(c.id, resolution)) && setResolution('')}>
                      Resolve
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={c.critical} onCheckedChange={(v) => void actions.setCritical(c.id, v)} aria-label="Critical: blocks the next version" />
                    Critical — blocks the next version until resolved
                  </label>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </motion.article>
  );
}

function SuggestionCard({ s, order, role, actions, busy }: { s: SuggestionView; order: OrderView; role: Role; actions: RadarActions; busy: string | null }) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(s.question);
  const [critical, setCritical] = useState(['missing_size', 'missing_delivery_time', 'conflict', 'unspecified_colour'].includes(s.category));
  const other = roleLabel(otherRole(role)).toLowerCase();
  return (
    <article className="rounded-lg border border-dashed border-border-strong bg-surface p-3 text-sm">
      <div className="flex items-start gap-2">
        <Badge tone={s.source === 'ai' ? 'primary' : 'neutral'} className="shrink-0">
          {s.source === 'ai' ? <Bot aria-hidden /> : <Cpu aria-hidden />}
          {s.source === 'ai' ? 'AI-generated' : 'Rules check'}
        </Badge>
        <span className="text-xs text-muted-foreground">Suggestion — not a confirmed fact</span>
      </div>
      {editing ? <Textarea className="mt-2" rows={2} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Edit the question" /> : <p className="mt-2 font-semibold text-foreground">{q}</p>}
      <ul className="mt-2 grid gap-1">
        {s.evidence.map((e, i) => {
          const ann = e.kind === 'annotation' ? order.annotations.find((a) => a.id === e.ref) : null;
          return (
            <li key={i} className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
              {ann ? (
                <button className="shrink-0" onClick={() => actions.focusAnnotation(ann.id)} aria-label={`Show annotation ${ann.number}`}>
                  <MarkerBadge number={ann.number} kind={ann.kind} size="sm" />
                </button>
              ) : e.kind === 'spec' ? (
                <button className="shrink-0 text-primary-text" onClick={() => actions.focusSpec(e.ref)} aria-label="Open the field">
                  <ClipboardList className="size-4" aria-hidden />
                </button>
              ) : (
                <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              <q className="italic">{e.quote}</q>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => actions.ask(s, q, critical)} loading={busy === `ask-${s.id}`}>
          Ask the {other}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.dismiss(s)} aria-label="Dismiss suggestion">
          <X /> Dismiss
        </Button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch checked={critical} onCheckedChange={setCritical} aria-label="Mark as critical" /> Critical
        </label>
      </div>
    </article>
  );
}

export function BlockerSummary({ blockers, onFocus }: { blockers: Blocker[]; onFocus: (b: Blocker) => void }) {
  if (!blockers.length)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5 text-sm text-success-text">
        <CheckCircle2 className="size-4" aria-hidden /> Nothing blocks the next version.
      </div>
    );
  return (
    <div className="rounded-lg border border-warning/40 bg-warning-bg p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning-text">
        <AlertTriangle className="size-4" aria-hidden /> {blockers.length} item{blockers.length > 1 ? 's' : ''} must be settled before a version can be proposed
      </p>
      <ul className="mt-2 grid gap-1">
        {blockers.map((b) => (
          <li key={`${b.kind}-${b.id}`}>
            <button className="text-left text-[13px] text-foreground underline-offset-2 hover:underline" onClick={() => onFocus(b)}>
              {b.kind === 'required_field' ? 'Missing: ' : b.kind === 'open_question' ? 'Open question: ' : 'Critical: '}
              {b.label.replace(/ is required$/, '')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadarPanel({ order, role, locked, busy, actions, onBlocker }: { order: OrderView; role: Role; locked: boolean; busy: string | null; actions: RadarActions; onBlocker: (b: Blocker) => void }) {
  const [askOpen, setAskOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [critical, setCritical] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisOutcome | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const groups = {
    needs: order.clarifications.filter((c) => c.status === 'open'),
    discussion: order.clarifications.filter((c) => c.status === 'discussion'),
    resolved: order.clarifications.filter((c) => c.status === 'resolved'),
  };
  const openQuestions = order.annotations.filter((a) => a.kind === 'question' && a.status !== 'resolved');
  const missing = order.blockers.filter((b) => b.kind === 'required_field');
  const suggestions = order.suggestions.filter((s) => s.status === 'suggested');

  const runAnalysis = async () => {
    setAnalysing(true);
    setAnalysis(await actions.analyse());
    setAnalysing(false);
  };

  return (
    <div className="grid gap-5 p-4">
      <BlockerSummary blockers={order.blockers} onFocus={onBlocker} />

      <section aria-labelledby="needs-h" className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 id="needs-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Needs clarification · {groups.needs.length + openQuestions.length + missing.length}
          </h3>
          {!locked && (
            <Button size="sm" variant="ghost" onClick={() => setAskOpen(true)}>
              <Plus /> Ask a question
            </Button>
          )}
        </div>
        {missing.map((b) => (
          <button key={b.id} onClick={() => onBlocker(b)} className="flex items-center gap-3 rounded-lg glass-panel p-3 text-left text-sm hover:bg-surface-secondary">
            <span className="grid size-7 place-items-center rounded-full bg-warning-bg text-warning-text">
              <ClipboardList className="size-4" aria-hidden />
            </span>
            <span className="flex-1 font-semibold text-foreground">{b.label}</span>
            <Badge tone="warning">Required field</Badge>
          </button>
        ))}
        {openQuestions.map((a) => (
          <button key={a.id} onClick={() => actions.focusAnnotation(a.id)} className="flex items-center gap-3 rounded-lg glass-panel p-3 text-left text-sm hover:bg-surface-secondary">
            <MarkerBadge number={a.number} kind={a.kind} />
            <span className="flex-1 text-foreground">{a.note}</span>
            <Badge tone="info">
              <MapPin aria-hidden /> On the image
            </Badge>
          </button>
        ))}
        {groups.needs.map((c) => (
          <ClarificationCard key={c.id} c={c} order={order} role={role} locked={locked} busy={busy} actions={actions} />
        ))}
        {groups.needs.length + openQuestions.length + missing.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting for an answer.</p>}
      </section>

      {groups.discussion.length > 0 && (
        <section aria-labelledby="disc-h" className="grid gap-2">
          <h3 id="disc-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            In discussion · {groups.discussion.length}
          </h3>
          {groups.discussion.map((c) => (
            <ClarificationCard key={c.id} c={c} order={order} role={role} locked={locked} busy={busy} actions={actions} />
          ))}
        </section>
      )}

      <section aria-labelledby="sug-h" className="grid gap-2 rounded-xl glass-panel-secondary/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="sug-h" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Sparkles className="size-4 text-primary-text" aria-hidden /> Ambiguity check
          </h3>
          {!locked && (
            <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analysing}>
              {analysing ? <Loader2 className="animate-spin" /> : <Sparkles />} {suggestions.length ? 'Re-check' : 'Check the brief'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Finds vague sizes, unnamed colours, missing times and contradictions. Suggestions never change the brief — a person decides.</p>
        {analysis && (
          <p className="text-xs text-muted-foreground" role="status">
            {analysis.provider !== 'rules'
              ? `Checked with ${AI_PROVIDER_LABEL[analysis.provider]} + rules.`
              : analysis.aiError
                ? 'Checked with deterministic rules.'
                : 'Checked with deterministic rules (no AI provider configured).'}
            {analysis.aiError && (
              <span className="text-warning-text">
                {' '}
                {analysis.provider !== 'rules' ? `Fallback used — ${analysis.aiError}.` : `AI unavailable (${analysis.aiError}) — showing rules only.`}
              </span>
            )}
          </p>
        )}
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} s={s} order={order} role={role} actions={actions} busy={busy} />
        ))}
        {analysis && suggestions.length === 0 && <EmptyState icon={CheckCircle2} title="No ambiguities found" className="bg-surface py-6" />}
      </section>

      {groups.resolved.length > 0 && (
        <section aria-labelledby="res-h" className="grid gap-2">
          <h3 id="res-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Resolved · {groups.resolved.length}
          </h3>
          {groups.resolved.map((c) => (
            <ClarificationCard key={c.id} c={c} order={order} role={role} locked={locked} busy={busy} actions={actions} />
          ))}
        </section>
      )}

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask the {roleLabel(otherRole(role)).toLowerCase()} a question</DialogTitle>
            <DialogDescription>It appears in both Radars and in the conversation, and stays open until someone records the answer.</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={3} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Should the gold drip be on all sides?" aria-label="Question" />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={critical} onCheckedChange={setCritical} /> Critical — block the next version until answered
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim()}
              loading={busy === 'raise'}
              onClick={async () => {
                if (await actions.raise({ title, critical })) {
                  setTitle('');
                  setAskOpen(false);
                }
              }}
            >
              Ask
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
