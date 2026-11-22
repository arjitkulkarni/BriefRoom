import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, CircleAlert, MessageSquare, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ANNOTATION_KIND_META, otherRole, roleLabel, type AnnotationView, type ReferenceView, type Role } from '@shared/types';
import { cropBackground, pointRegion } from '@shared/geometry';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { ago, cn } from '@/lib/utils';
import { KindChip, MarkerBadge } from './annotation-meta';

export function RegionCrop({ annotation, reference, className }: { annotation: Pick<AnnotationView, 'x' | 'y' | 'w' | 'h' | 'shape'>; reference?: ReferenceView; className?: string }) {
  if (!reference) return <div className={cn('rounded-md bg-surface-secondary', className)} aria-hidden />;
  const region = annotation.shape === 'point' ? pointRegion(annotation.x, annotation.y) : annotation;
  return <div className={cn('rounded-md border border-border bg-surface-secondary bg-no-repeat', className)} style={{ backgroundImage: `url("${reference.url}")`, ...cropBackground(region) }} aria-hidden />;
}

function StatusLine({ a, role }: { a: AnnotationView; role: Role }) {
  if (a.status === 'resolved')
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden /> Resolved
      </Badge>
    );
  if (a.resolutionRequestedBy)
    return (
      <Badge tone="warning">
        <CircleAlert aria-hidden />
        {a.resolutionRequestedBy === role ? `Waiting for ${otherRole(role)}` : 'Confirm resolution'}
      </Badge>
    );
  return <Badge tone={a.status === 'discussion' ? 'info' : 'neutral'}>{a.status === 'discussion' ? 'In discussion' : 'Open'}</Badge>;
}

export function AnnotationListItem({ a, reference, role, selected, onSelect }: { a: AnnotationView; reference?: ReferenceView; role: Role; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary/40 bg-primary-soft' : 'border-transparent hover:border-border hover:bg-surface-secondary',
      )}
    >
      <div className="relative shrink-0">
        <RegionCrop annotation={a} reference={reference} className="size-12" />
        <MarkerBadge number={a.number} kind={a.kind} resolved={a.status === 'resolved'} size="sm" className="absolute -left-1.5 -top-1.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindChip kind={a.kind} short />
          <StatusLine a={a} role={role} />
        </div>
        <p className={cn('mt-1 line-clamp-2 text-[13px]', a.note ? 'text-foreground' : 'italic text-muted-foreground')}>{a.note || 'No note'}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {a.createdByRole === role ? 'You' : roleLabel(a.createdByRole)} · {ago(a.createdAt)}
          </span>
          {a.comments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden />
              {a.comments.length}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

export interface ThreadActions {
  reply: (body: string) => Promise<boolean>;
  resolution: (action: 'request' | 'confirm' | 'cancel' | 'reopen') => Promise<void>;
  remove: () => Promise<void>;
  raiseClarification: () => void;
}

export function AnnotationThread({ a, reference, role, locked, busy, actions, names }: { a: AnnotationView; reference?: ReferenceView; role: Role; locked: boolean; busy: string | null; actions: ThreadActions; names: Record<Role, string> }) {
  const [text, setText] = useState('');
  const reduce = useReducedMotion();
  const other = otherRole(role);
  const meta = ANNOTATION_KIND_META[a.kind];
  const send = async () => {
    if (!text.trim()) return;
    if (await actions.reply(text)) setText('');
  };

  return (
    <section aria-label={`Discussion for annotation ${a.number}`} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <RegionCrop annotation={a} reference={reference} className="size-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MarkerBadge number={a.number} kind={a.kind} resolved={a.status === 'resolved'} />
            <KindChip kind={a.kind} />
          </div>
          <p className="mt-2 text-sm text-foreground">{a.note || <span className="italic text-muted-foreground">No note</span>}</p>
          {a.color && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span className="size-3.5 rounded-sm border border-border-strong" style={{ background: a.color }} aria-hidden />
              {a.color}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {meta.label} · by {a.createdByRole === role ? 'you' : names[a.createdByRole]} · {ago(a.createdAt)}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-2" aria-label="Replies">
        <AnimatePresence initial={false}>
          {a.comments.map((c) => {
            const mine = c.authorRole === role;
            return (
              <motion.li
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('max-w-[92%] rounded-lg border px-3 py-2 text-sm', mine ? 'ml-auto border-bubble-own-border bg-bubble-own' : 'border-bubble-other-border bg-bubble-other')}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {mine ? 'You' : c.authorName} <span className="font-normal">· {roleLabel(c.authorRole)} · {ago(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{c.body}</p>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {a.comments.length === 0 && <li className="text-[13px] text-muted-foreground">No replies yet. Discuss this exact area here — it stays linked to the region.</li>}
      </ol>

      {!locked && (
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Reply about #${a.number}…`}
            aria-label={`Reply about annotation ${a.number}`}
            className="min-h-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button size="icon" onClick={send} loading={busy === 'reply'} disabled={!text.trim()} aria-label="Send reply">
            <Send />
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-secondary p-3">
        {a.status === 'resolved' ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-foreground">
              <CheckCircle2 className="mr-1 inline size-4 text-success-text" aria-hidden />
              Resolved — confirmed by {a.resolvedBy === role ? 'you' : names[a.resolvedBy ?? other]} {ago(a.resolvedAt)}
            </p>
            {!locked && (
              <Button size="sm" variant="outline" onClick={() => actions.resolution('reopen')} loading={busy === 'resolution'}>
                <RotateCcw /> Reopen
              </Button>
            )}
          </div>
        ) : a.resolutionRequestedBy === other ? (
          <div className="grid gap-2">
            <p className="text-[13px] text-foreground">
              <b>{names[other]}</b> considers this settled. Confirm if you agree — both of you must agree before it counts as resolved.
            </p>
            {!locked && (
              <Button size="sm" variant="success" onClick={() => actions.resolution('confirm')} loading={busy === 'resolution'}>
                <CheckCircle2 /> Confirm resolved
              </Button>
            )}
          </div>
        ) : a.resolutionRequestedBy === role ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Waiting for {names[other]} to confirm this is resolved.</p>
            {!locked && (
              <Button size="sm" variant="ghost" onClick={() => actions.resolution('cancel')} loading={busy === 'resolution'}>
                Cancel request
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Settled? Ask {names[other]} to confirm.</p>
            {!locked && (
              <Button size="sm" variant="secondary" onClick={() => actions.resolution('request')} loading={busy === 'resolution'}>
                <CheckCircle2 /> Mark resolved
              </Button>
            )}
          </div>
        )}
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={actions.raiseClarification}>
            <CircleAlert /> Raise in Clarification Radar
          </Button>
          {a.createdByRole === role && (
            <Button size="sm" variant="subtle" onClick={actions.remove} loading={busy === 'remove'}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
