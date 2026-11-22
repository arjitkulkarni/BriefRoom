/**
 * Deterministic ambiguity rules — always available, no external calls, fully explainable.
 * Every suggestion quotes the exact text or field it came from. Suggestions are questions
 * for humans; nothing here edits the brief.
 */
import { templateFor, isFilled, formatValue } from '../../shared/templates.ts';
import { ANNOTATION_KIND_META, type AnnotationKind, type Spec, type SuggestionCategory, type SuggestionEvidence } from '../../shared/types.ts';

export interface AnalysisInput {
  template: string;
  spec: Spec;
  annotations: { id: string; number: number; kind: AnnotationKind; note: string; color: string | null; status: string; x: number; y: number; w: number; h: number; referenceId: string }[];
  clarifications: { id: string; title: string; status: string }[];
  messages: { id: string; text: string }[];
  today: string; // YYYY-MM-DD
}

export interface SuggestionDraft {
  question: string;
  category: SuggestionCategory;
  evidence: SuggestionEvidence[];
}

const VAGUE = /\b(a (?:little|bit|tad)(?: (?:more|less|bigger|smaller|lighter|darker))?|slightly \w+|(?:a bit|bit) \w+er|kind of|kinda|sort of|something like (?:this|that)|-ish|\w+ish|some more|few more|not too \w+|maybe|roughly|around|approx(?:imately)?)\b/i;
const SIZE_WORDS = /\b(bigger|smaller|larger|taller|shorter|wider|narrower|size)\b/i;
const SHADE_WORDS = /\b(lighter|darker|brighter|duller|pastel|softer|shade|tone)\b/i;
const COLOURS = /\b(pink|blush|rose|red|maroon|blue|navy|teal|turquoise|green|mint|sage|olive|yellow|gold|golden|silver|white|ivory|cream|beige|peach|coral|orange|purple|lavender|lilac|violet|black|grey|gray|brown|nude|champagne)\b/i;
const EGGLESS = /\b(eggless|egg-free|no eggs?|without eggs?)\b/i;
const WEIGHT = /\b(\d+(?:\.\d+)?)\s?(kg|kgs|kilo|kilos)\b/i;

const quote = (text: string, match: RegExpMatchArray | null) => {
  if (!match || match.index === undefined) return text.slice(0, 120);
  const start = Math.max(0, match.index - 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, match.index + match[0].length + 40).trim()}${match.index + match[0].length + 40 < text.length ? '…' : ''}`;
};

function overlap(a: AnalysisInput['annotations'][number], b: AnalysisInput['annotations'][number]) {
  if (a.referenceId !== b.referenceId) return 0;
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

export function runRules(input: AnalysisInput): SuggestionDraft[] {
  const t = templateFor(input.template);
  const out: SuggestionDraft[] = [];
  const field = (role: string) => t.fields.find((f) => f.role === role);
  const sizeField = field('size');
  const colourField = field('colours');
  const dateField = field('deliveryDate');
  const timeField = field('deliveryTime');
  const fulfilmentField = field('fulfilment');
  const addressField = field('address');

  // Text sources: annotation notes + recent chat messages.
  const texts: { evidence: SuggestionEvidence['kind']; ref: string; text: string; label: string }[] = [
    ...input.annotations.filter((a) => a.note).map((a) => ({ evidence: 'annotation' as const, ref: a.id, text: a.note, label: `#${a.number}` })),
    ...input.messages.filter((m) => m.text?.trim()).map((m) => ({ evidence: 'message' as const, ref: m.id, text: m.text, label: 'chat' })),
  ];

  for (const s of texts) {
    const vague = s.text.match(VAGUE);
    if (vague) {
      const isSize = SIZE_WORDS.test(s.text);
      const isShade = SHADE_WORDS.test(s.text) || COLOURS.test(s.text);
      if (isSize)
        out.push({
          category: 'missing_size',
          question: `“${vague[0]}” — what exact ${sizeField ? sizeField.label.toLowerCase() : 'size'} is needed?`,
          evidence: [{ kind: s.evidence, ref: s.ref, quote: quote(s.text, vague) }],
        });
      if (isShade)
        out.push({
          category: 'unspecified_colour',
          question: `Which exact shade is meant by “${vague[0]}”? Picking a swatch avoids guesswork.`,
          evidence: [{ kind: s.evidence, ref: s.ref, quote: quote(s.text, vague) }],
        });
      if (!isSize && !isShade)
        out.push({
          category: 'vague_quantity',
          question: `“${vague[0]}” could mean different things — can it be made specific (an exact amount, size or count)?`,
          evidence: [{ kind: s.evidence, ref: s.ref, quote: quote(s.text, vague) }],
        });
    }
    const egg = s.text.match(EGGLESS);
    if (egg && t.fields.some((f) => f.key === 'eggless') && input.spec.eggless !== true)
      out.push({
        category: 'conflict',
        question: 'The conversation mentions eggless, but the brief does not say eggless. Which is correct?',
        evidence: [{ kind: s.evidence, ref: s.ref, quote: quote(s.text, egg) }, { kind: 'spec', ref: 'eggless', quote: 'Eggless: not set' }],
      });
    const w = s.text.match(WEIGHT);
    if (w && sizeField && isFilled(input.spec[sizeField.key])) {
      const specText = String(input.spec[sizeField.key]);
      const said = Number(w[1]);
      const specNum = Number((specText.match(/\d+(?:\.\d+)?/) ?? [''])[0]);
      if (specNum && said !== specNum)
        out.push({
          category: 'conflict',
          question: `The conversation says ${w[0]} but the brief says ${specText}. Which size is final?`,
          evidence: [{ kind: s.evidence, ref: s.ref, quote: quote(s.text, w) }, { kind: 'spec', ref: sizeField.key, quote: `${sizeField.label}: ${specText}` }],
        });
    }
  }

  // Colours named in annotations without a picked colour.
  for (const a of input.annotations) {
    const meta = ANNOTATION_KIND_META[a.kind];
    if (a.status === 'resolved') continue;
    const colourWord = a.note.match(COLOURS);
    if ((a.kind === 'colour' && !a.color) || (colourWord && !a.color && a.kind !== 'keep'))
      out.push({
        category: 'unspecified_colour',
        question: `#${a.number}: which exact colour${colourWord ? ` of ${colourWord[0]}` : ''}? Pick it on the colour picker.`,
        evidence: [{ kind: 'annotation', ref: a.id, quote: a.note ? quote(a.note, colourWord) : `${meta.label} with no colour chosen` }],
      });
    if ((a.kind === 'change' || a.kind === 'custom' || a.kind === 'add') && a.note.trim().length < 8)
      out.push({
        category: 'ambiguous_annotation',
        question: `#${a.number} (${meta.label.toLowerCase()}) has ${a.note.trim() ? `only “${a.note.trim()}”` : 'no description'} — what exactly should happen here?`,
        evidence: [{ kind: 'annotation', ref: a.id, quote: a.note.trim() || `${meta.label}, no note` }],
      });
  }

  // Keep vs remove on the same region.
  const live = input.annotations.filter((a) => a.status !== 'resolved');
  for (const a of live)
    for (const b of live)
      if (a.number < b.number && overlap(a, b) > 0.4 && ((a.kind === 'keep' && b.kind === 'remove') || (a.kind === 'remove' && b.kind === 'keep')))
        out.push({
          category: 'conflict',
          question: `#${a.number} and #${b.number} cover the same area but say “${ANNOTATION_KIND_META[a.kind].short}” and “${ANNOTATION_KIND_META[b.kind].short}”. Which one applies?`,
          evidence: [
            { kind: 'annotation', ref: a.id, quote: `#${a.number} ${ANNOTATION_KIND_META[a.kind].label}${a.note ? `: ${a.note}` : ''}` },
            { kind: 'annotation', ref: b.id, quote: `#${b.number} ${ANNOTATION_KIND_META[b.kind].label}${b.note ? `: ${b.note}` : ''}` },
          ],
        });

  // Structured specification checks (deterministic validation).
  if (sizeField && !isFilled(input.spec[sizeField.key]))
    out.push({ category: 'missing_size', question: `What exact ${sizeField.label.toLowerCase()} is required?`, evidence: [{ kind: 'spec', ref: sizeField.key, quote: `${sizeField.label}: not set` }] });
  if (dateField && isFilled(input.spec[dateField.key])) {
    const date = String(input.spec[dateField.key]);
    if (date < input.today)
      out.push({ category: 'conflict', question: `The date (${formatValue(dateField, date)}) is in the past. What is the correct date?`, evidence: [{ kind: 'spec', ref: dateField.key, quote: `${dateField.label}: ${date}` }] });
    if (timeField && !isFilled(input.spec[timeField.key]))
      out.push({
        category: 'missing_delivery_time',
        question: `What time on ${formatValue(dateField, date)} should it be ready?`,
        evidence: [{ kind: 'spec', ref: timeField.key, quote: `${timeField.label}: not set` }],
      });
  } else if (dateField) {
    out.push({ category: 'missing_delivery_time', question: 'When is it needed (date and time)?', evidence: [{ kind: 'spec', ref: dateField.key, quote: `${dateField.label}: not set` }] });
  }
  if (fulfilmentField && addressField && input.spec[fulfilmentField.key] === 'Delivery' && !isFilled(input.spec[addressField.key]))
    out.push({ category: 'incomplete_spec', question: 'Delivery is selected — what is the delivery address?', evidence: [{ kind: 'spec', ref: addressField.key, quote: `${addressField.label}: not set` }] });
  if (colourField && !isFilled(input.spec[colourField.key]) && input.annotations.some((a) => a.kind === 'colour' || COLOURS.test(a.note)))
    out.push({
      category: 'unspecified_colour',
      question: `Colours are discussed on the image but the ${colourField.label.toLowerCase()} is empty. Which colours are final?`,
      evidence: [{ kind: 'spec', ref: colourField.key, quote: `${colourField.label}: not set` }],
    });

  return out;
}
