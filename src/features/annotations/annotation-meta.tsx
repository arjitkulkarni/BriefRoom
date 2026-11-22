import { CircleHelp, Eraser, Lock, MessageSquareText, Palette, Pencil, Plus, type LucideIcon } from 'lucide-react';
import { ANNOTATION_KIND_META, type AnnotationKind, type AnnotationTone } from '@shared/types';
import { cn } from '@/lib/utils';

export const KIND_ICON: Record<AnnotationKind, LucideIcon> = {
  keep: Lock,
  change: Pencil,
  colour: Palette,
  remove: Eraser,
  add: Plus,
  question: CircleHelp,
  custom: MessageSquareText,
};

/** Token classes per tone (design.md §4.3 annotation tokens). */
export const TONE_CLASSES: Record<AnnotationTone, { solid: string; soft: string; border: string; text: string; ring: string }> = {
  keep: { solid: 'bg-ann-keep text-ann-keep-on', soft: 'bg-ann-keep-bg', border: 'border-ann-keep', text: 'text-ann-keep-text', ring: 'ring-ann-keep' },
  change: { solid: 'bg-ann-change text-ann-change-on', soft: 'bg-ann-change-bg', border: 'border-ann-change', text: 'text-ann-change-text', ring: 'ring-ann-change' },
  remove: { solid: 'bg-ann-remove text-ann-remove-on', soft: 'bg-ann-remove-bg', border: 'border-ann-remove', text: 'text-ann-remove-text', ring: 'ring-ann-remove' },
  question: { solid: 'bg-ann-question text-ann-question-on', soft: 'bg-ann-question-bg', border: 'border-ann-question', text: 'text-ann-question-text', ring: 'ring-ann-question' },
  add: { solid: 'bg-ann-add text-ann-add-on', soft: 'bg-ann-add-bg', border: 'border-ann-add', text: 'text-ann-add-text', ring: 'ring-ann-add' },
};

export const toneOf = (k: AnnotationKind) => ANNOTATION_KIND_META[k].tone;

/** Kind chip: icon + label, coloured by tone (label means colour is never the only signal). */
export function KindChip({ kind, className, short }: { kind: AnnotationKind; className?: string; short?: boolean }) {
  const meta = ANNOTATION_KIND_META[kind];
  const Icon = KIND_ICON[kind];
  const t = TONE_CLASSES[meta.tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', t.soft, t.text, className)}>
      <Icon className="size-3.5" aria-hidden />
      {short ? meta.short : meta.label}
    </span>
  );
}

/** Numbered marker badge used on the canvas, in lists, threads and chat cards. */
export function MarkerBadge({ number, kind, resolved, size = 'md', className }: { number: number; kind: AnnotationKind; resolved?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const t = TONE_CLASSES[toneOf(kind)];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold tabular-nums shadow-sm ring-2 ring-marker-ring',
        size === 'sm' ? 'size-5 text-[10px]' : 'size-6 text-[11px]',
        t.solid,
        resolved && 'opacity-75',
        className,
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}
