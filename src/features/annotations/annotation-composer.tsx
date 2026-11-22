import { useEffect, useRef, useState } from 'react';
import { ANNOTATION_KINDS, ANNOTATION_KIND_META, type AnnotationKind } from '@shared/types';
import { cropBackground, pointRegion } from '@shared/geometry';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { KIND_ICON, TONE_CLASSES } from './annotation-meta';
import type { PendingRegion } from './reference-canvas';

const COLOUR_KINDS = new Set<AnnotationKind>(['colour', 'change', 'add', 'custom']);
/** One plain sentence per choice, so nobody has to guess what a label means. */
const KIND_HINT: Record<AnnotationKind, string> = {
  keep: 'Don’t touch this part',
  change: 'Make this part different',
  colour: 'Use a different colour',
  remove: 'Take this part out',
  add: 'Put something new here',
  question: 'Not sure? Ask first',
  custom: 'Something else',
};

const SWATCHES = ['#f4ebd9', '#f7d6dc', '#e8b4bc', '#c9a227', '#9bb59a', '#a8c5da', '#5b4b8a', '#1f1f24'];

export interface AnnotationDraft {
  kind: AnnotationKind;
  note: string;
  color: string | null;
}

export function AnnotationComposer({ region, imageUrl, busy, onSave, onCancel, className }: { region: PendingRegion; imageUrl: string; busy: boolean; onSave: (d: AnnotationDraft) => void; onCancel: () => void; className?: string }) {
  const [kind, setKind] = useState<AnnotationKind>('change');
  const [note, setNote] = useState('');
  const [color, setColor] = useState<string>('#f4ebd9');
  const [useColor, setUseColor] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const meta = ANNOTATION_KIND_META[kind];
  const colourAllowed = COLOUR_KINDS.has(kind);
  const needsNote = kind === 'question';

  useEffect(() => noteRef.current?.focus(), [kind]);
  useEffect(() => setUseColor(kind === 'colour'), [kind]);

  const crop = cropBackground(region.shape === 'point' ? pointRegion(region.x, region.y) : region);
  const submit = () => {
    if (needsNote && !note.trim()) return noteRef.current?.focus();
    onSave({ kind, note: note.trim(), color: colourAllowed && useColor ? color : null });
  };

  return (
    <form
      className={cn('grid gap-4', className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 rounded-md border border-border bg-surface-secondary bg-no-repeat" style={{ backgroundImage: `url("${imageUrl}")`, ...crop }} aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-foreground">{region.shape === 'point' ? 'You picked this spot' : 'You picked this part'}</p>
          <p className="text-[13px] text-muted-foreground">Two quick steps, then the other person sees it.</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Step n={1} /> What do you want here?
        </legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="What do you want here?">
          {ANNOTATION_KINDS.map((k) => {
            const m = ANNOTATION_KIND_META[k];
            const Icon = KIND_ICON[k];
            const t = TONE_CLASSES[m.tone];
            const on = k === kind;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k)}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? cn('border-2', t.border, t.soft, t.text) : 'border-border bg-surface text-foreground hover:bg-surface-secondary',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-tight">{m.short}</span>
                  <span className={cn('block text-[11px] leading-tight', on ? 'opacity-90' : 'text-muted-foreground')}>{KIND_HINT[k]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="ann-note" className="flex items-center gap-2 text-sm font-bold">
          <Step n={2} /> {meta.prompt}
          {needsNote && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea
          id="ann-note"
          ref={noteRef}
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={kind === 'colour' ? 'e.g. Ivory roses instead of pink' : kind === 'question' ? 'e.g. Should the leaves stay green?' : 'Be specific: what, how much, which colour'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
      </div>

      {colourAllowed && (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <input type="checkbox" className="size-4 accent-primary" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
            Show the exact colour I want
          </label>
          {useColor && (
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Colour ${s}`}
                  aria-pressed={color === s}
                  onClick={() => setColor(s)}
                  className={cn('size-8 rounded-md border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', color === s && 'ring-2 ring-ring ring-offset-2 ring-offset-surface-elevated')}
                  style={{ background: s }}
                />
              ))}
              <label className="relative size-8 cursor-pointer overflow-hidden rounded-md border border-border-strong" title="Custom colour">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute -inset-2 size-12 cursor-pointer" aria-label="Pick a custom colour" />
              </label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-24 font-mono text-xs" aria-label="Colour hex value" maxLength={7} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save & send
        </Button>
      </div>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground" aria-hidden>
      {n}
    </span>
  );
}
