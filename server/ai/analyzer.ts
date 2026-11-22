/**
 * Ambiguity detection behind a provider abstraction.
 *  - Rules: deterministic validation, always runs.
 *  - AI (optional): OpenAI (OPENAI_API_KEY) and/or Grok by xAI (XAI_API_KEY), both through the
 *    OpenAI-compatible chat-completions API. Providers are tried in the configured order, so the
 *    second one is a fallback. Structured output, validated with zod, and every piece of evidence
 *    must quote text that really exists in the brief or chat — anything the model cannot ground is
 *    dropped. The AI suggests questions; it never edits or resolves anything.
 */
import { z } from 'zod';
import { AI_PROVIDER_LABEL, SUGGESTION_CATEGORIES, type AnalysisOutcome, type SuggestionEvidence } from '../../shared/types.ts';
import { templateFor } from '../../shared/templates.ts';
import type { AppConfig, AiProviderConfig } from '../config.ts';
import { runRules, type AnalysisInput, type SuggestionDraft } from './rules.ts';
import { sha256 } from '../domain/util.ts';

export interface AnalysisResult extends AnalysisOutcome {
  suggestions: (SuggestionDraft & { source: 'ai' | 'rules'; fingerprint: string })[];
}

const AiOutput = z.object({
  suggestions: z
    .array(
      z.object({
        question: z.string().min(5).max(300),
        category: z.enum(SUGGESTION_CATEGORIES),
        evidence: z.array(z.object({ kind: z.enum(['message', 'annotation', 'spec', 'clarification']), ref: z.string().max(80), quote: z.string().min(1).max(300) })).min(1).max(3),
      }),
    )
    .max(8),
});

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'category', 'evidence'],
        properties: {
          question: { type: 'string', description: 'One short clarifying question addressed to the other participant.' },
          category: { type: 'string', enum: [...SUGGESTION_CATEGORIES] },
          evidence: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'ref', 'quote'],
              properties: {
                kind: { type: 'string', enum: ['message', 'annotation', 'spec', 'clarification'] },
                ref: { type: 'string', description: 'The id of the message/annotation/clarification, or the spec field key.' },
                quote: { type: 'string', description: 'An exact, verbatim excerpt of the source text.' },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You review a custom-order brief shared between a customer and a seller (custom cakes, merchandise, furniture, jewellery).
Find details that are ambiguous, vague, missing or contradictory and could cause the wrong product to be made:
vague quantities ("a little bigger"), unspecified colours/shades, missing sizes, missing delivery dates/times, conflicting statements, incomplete specifications, ambiguous image annotations.
Rules:
- Output clarifying QUESTIONS only. Never state what the customer intended, never fill in values, never resolve anything.
- Every suggestion must cite evidence: the exact id/key and a VERBATIM quote copied from the input. No quote, no suggestion.
- Do not repeat issues already listed under "open_clarifications".
- At most 6 suggestions, most important first. Plain, polite English.`;

function normalise(s: string) {
  return s.toLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
}

/** Keep only evidence whose quote really appears in the referenced source. */
function grounded(input: AnalysisInput, ev: SuggestionEvidence): boolean {
  const q = normalise(ev.quote.replace(/^…|…$/g, ''));
  if (!q) return false;
  const t = templateFor(input.template);
  let source = '';
  if (ev.kind === 'message') source = input.messages.find((m) => m.id === ev.ref)?.text ?? '';
  else if (ev.kind === 'annotation') {
    const a = input.annotations.find((x) => x.id === ev.ref || `#${x.number}` === ev.ref);
    source = a ? `${a.note} #${a.number} ${a.kind} ${a.color ?? ''}` : '';
  } else if (ev.kind === 'clarification') source = input.clarifications.find((c) => c.id === ev.ref)?.title ?? '';
  else if (ev.kind === 'spec') {
    const f = t.fields.find((x) => x.key === ev.ref);
    source = f ? `${f.label}: ${JSON.stringify(input.spec[f.key] ?? 'not set')} not set` : '';
  }
  return Boolean(source) && normalise(source).includes(q.slice(0, 120));
}

async function runProvider(input: AnalysisInput, provider: AiProviderConfig, fetchImpl: typeof fetch): Promise<SuggestionDraft[]> {
  const { apiKey, model, baseUrl } = provider;
  const t = templateFor(input.template);
  const payload = {
    product: t.name,
    today: input.today,
    specification: t.fields.map((f) => ({ key: f.key, label: f.label, required: Boolean(f.required), value: input.spec[f.key] ?? null })),
    annotations: input.annotations.map((a) => ({ id: a.id, number: a.number, kind: a.kind, note: a.note, color: a.color, status: a.status })),
    open_clarifications: input.clarifications.filter((c) => c.status !== 'resolved').map((c) => ({ id: c.id, title: c.title })),
    recent_messages: input.messages.slice(-40).map((m) => ({ id: m.id, text: m.text.slice(0, 500) })),
  };
  const res = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model,
      // OpenAI reasoning models (gpt-5*, o-series) only accept the default temperature.
      ...(/^(gpt-5|o\d)/.test(model) ? {} : { temperature: 0.2 }),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'brief_ambiguities', strict: true, schema: JSON_SCHEMA } },
    }),
  });
  // OpenAI errors are { error: { message } }; xAI errors are { code, error: "message" }.
  const body = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string; refusal?: string } }[]; error?: string | { message?: string } };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(typeof body.error === 'string' ? body.error : body.error?.message)?.slice(0, 200) ?? 'request failed'}`);
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error(body.choices?.[0]?.message?.refusal ? 'the model refused the request' : 'no content returned');
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error('output was not valid JSON');
  }
  const parsed = AiOutput.safeParse(json);
  if (!parsed.success) throw new Error('output failed validation');
  return parsed.data.suggestions
    .map((s) => ({ ...s, evidence: s.evidence.filter((e) => grounded(input, e)) }))
    .filter((s) => s.evidence.length > 0);
}

export const fingerprintOf = (s: SuggestionDraft) => sha256(`${s.category}|${normalise(s.question)}|${s.evidence.map((e) => `${e.kind}:${e.ref}`).sort().join(',')}`).slice(0, 32);

export async function analyseBrief(input: AnalysisInput, ai: AppConfig['ai'], fetchImpl: typeof fetch = fetch): Promise<AnalysisResult> {
  const rules = runRules(input).map((s) => ({ ...s, source: 'rules' as const, fingerprint: fingerprintOf(s) }));
  let aiSuggestions: AnalysisResult['suggestions'] = [];
  let used: AnalysisResult['provider'] = 'rules';
  const failures: string[] = [];
  for (const provider of ai.chain) {
    try {
      aiSuggestions = (await runProvider(input, provider, fetchImpl)).map((s) => ({ ...s, source: 'ai' as const, fingerprint: fingerprintOf(s) }));
      used = provider.id;
      break;
    } catch (e) {
      failures.push(`${AI_PROVIDER_LABEL[provider.id]}: ${(e as Error).message}`);
    }
  }
  const seen = new Set<string>();
  const merged = [...rules, ...aiSuggestions].filter((s) => (seen.has(s.fingerprint) ? false : (seen.add(s.fingerprint), true)));
  return { suggestions: merged.slice(0, 14), provider: used, aiError: failures.length ? failures.join(' · ') : null };
}
