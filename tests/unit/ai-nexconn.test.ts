import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { analyseBrief } from '../../server/ai/analyzer.ts';
import { runRules, type AnalysisInput } from '../../server/ai/rules.ts';
import { loadConfig } from '../../server/config.ts';
import { createNexconnClient, NexconnError } from '../../server/nexconn/client.ts';
import { testConfig } from '../helpers.ts';

const openai = (model: string) => ({ id: 'openai' as const, apiKey: 'k', model, baseUrl: 'https://api.openai.com/v1' });
const xai = (model: string) => ({ id: 'xai' as const, apiKey: 'xk', model, baseUrl: 'https://api.x.ai/v1' });

const input = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  template: 'cake',
  spec: { weight: '1 kg', flavour: 'Vanilla', deliveryDate: '2099-12-01' },
  annotations: [],
  clarifications: [],
  messages: [],
  today: '2026-11-22',
  ...over,
});

test('rules: "a little bigger and slightly lighter" yields size and shade questions with evidence', () => {
  const s = runRules(input({ messages: [{ id: 'm1', text: 'Make it a little bigger and slightly lighter.' }] }));
  const size = s.find((x) => x.category === 'missing_size' && x.evidence[0].ref === 'm1');
  const shade = s.find((x) => x.category === 'unspecified_colour' && x.evidence[0].ref === 'm1');
  assert.ok(size, 'size question');
  assert.ok(shade, 'shade question');
  assert.match(size!.evidence[0].quote, /a little bigger/);
});

test('rules: missing time slot, delivery address, colour with no swatch, empty change note, keep-vs-remove conflict', () => {
  const s = runRules(
    input({
      spec: { weight: '1 kg', deliveryDate: '2099-12-01', fulfilment: 'Delivery' },
      annotations: [
        { id: 'a1', number: 1, kind: 'colour', note: 'make these ivory', color: null, status: 'open', x: 0.1, y: 0.1, w: 0.3, h: 0.3, referenceId: 'r' },
        { id: 'a2', number: 2, kind: 'change', note: 'this', color: null, status: 'open', x: 0.6, y: 0.6, w: 0.2, h: 0.2, referenceId: 'r' },
        { id: 'a3', number: 3, kind: 'keep', note: 'leaves', color: null, status: 'open', x: 0.6, y: 0.6, w: 0.2, h: 0.2, referenceId: 'r' },
        { id: 'a4', number: 4, kind: 'remove', note: 'leaves', color: null, status: 'open', x: 0.61, y: 0.6, w: 0.2, h: 0.2, referenceId: 'r' },
      ],
    }),
  );
  const cats = s.map((x) => x.category);
  assert.ok(cats.includes('missing_delivery_time'));
  assert.ok(s.some((x) => x.category === 'incomplete_spec' && /address/i.test(x.question)));
  assert.ok(s.some((x) => x.category === 'unspecified_colour' && x.evidence[0].ref === 'a1'));
  assert.ok(s.some((x) => x.category === 'ambiguous_annotation' && x.evidence[0].ref === 'a2'));
  assert.ok(s.some((x) => x.category === 'conflict' && x.evidence.length === 2), 'keep vs remove conflict');
});

test('rules: chat says eggless or another weight → conflict with the structured spec', () => {
  const s = runRules(input({ messages: [{ id: 'm9', text: 'Please make it eggless, 2 kg' }] }));
  assert.ok(s.some((x) => x.category === 'conflict' && /eggless/i.test(x.question)));
  assert.ok(s.some((x) => x.category === 'conflict' && /2 kg/.test(x.question)));
});

test('AI provider: ungrounded (hallucinated) evidence is dropped; failures fall back to rules and are reported', async () => {
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  { question: 'Which shade of ivory?', category: 'unspecified_colour', evidence: [{ kind: 'message', ref: 'm1', quote: 'slightly lighter' }] },
                  { question: 'Do you want gold leaf?', category: 'incomplete_spec', evidence: [{ kind: 'message', ref: 'm1', quote: 'add gold leaf everywhere' }] },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  const r = await analyseBrief(input({ messages: [{ id: 'm1', text: 'Make it a little bigger and slightly lighter.' }] }), { provider: 'openai', chain: [openai('m')] }, fakeFetch);
  const ai = r.suggestions.filter((s) => s.source === 'ai');
  assert.equal(ai.length, 1, 'only the grounded AI suggestion survives');
  assert.equal(ai[0].question, 'Which shade of ivory?');
  assert.ok(r.suggestions.some((s) => s.source === 'rules'), 'rules always run');

  const failing = (async () => new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })) as typeof fetch;
  const r2 = await analyseBrief(input(), { provider: 'openai', chain: [openai('nope')] }, failing);
  assert.match(r2.aiError ?? '', /OpenAI: HTTP 404: model not found/);
  assert.equal(r2.provider, 'rules');
  assert.ok(r2.suggestions.every((s) => s.source === 'rules'));
});

test('AI providers: an OpenAI failure falls back to Grok (xAI) through its OpenAI-compatible endpoint', async () => {
  const calls: { url: string; auth: string; body: { model: string; temperature?: number } }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, auth: (init.headers as Record<string, string>).Authorization, body: JSON.parse(String(init.body)) });
    if (url.startsWith('https://api.openai.com')) return new Response(JSON.stringify({ error: { message: 'You exceeded your current quota' } }), { status: 429 });
    const content = JSON.stringify({ suggestions: [{ question: 'Which shade of ivory?', category: 'unspecified_colour', evidence: [{ kind: 'message', ref: 'm1', quote: 'slightly lighter' }] }] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await analyseBrief(input({ messages: [{ id: 'm1', text: 'Make it slightly lighter.' }] }), { provider: 'openai', chain: [openai('gpt-4o-mini'), xai('grok-test')] }, f);
  assert.deepEqual(
    calls.map((c) => c.url),
    ['https://api.openai.com/v1/chat/completions', 'https://api.x.ai/v1/chat/completions'],
  );
  assert.equal(calls[1].auth, 'Bearer xk');
  assert.equal(calls[1].body.model, 'grok-test');
  assert.equal(r.provider, 'xai');
  assert.match(r.aiError ?? '', /OpenAI: HTTP 429: You exceeded your current quota/);
  assert.ok(r.suggestions.some((s) => s.source === 'ai' && s.question === 'Which shade of ivory?'));

  // xAI error bodies are { code, error: "message" }.
  const xaiDown = (async () => new Response(JSON.stringify({ code: 'Client specified an invalid argument', error: 'Incorrect API key provided' }), { status: 400 })) as unknown as typeof fetch;
  const r2 = await analyseBrief(input(), { provider: 'xai', chain: [xai('grok-test')] }, xaiDown);
  assert.equal(r2.provider, 'rules');
  assert.match(r2.aiError ?? '', /Grok \(xAI\): HTTP 400: Incorrect API key provided/);

  // OpenAI reasoning models (gpt-5*, o-series) are sent without a temperature.
  calls.length = 0;
  await analyseBrief(input(), { provider: 'openai', chain: [openai('gpt-5-mini')] }, f);
  assert.equal('temperature' in calls[0].body, false);
});

test('config: AI_PROVIDER picks the first provider and the other key becomes the fallback', () => {
  const keys = ['AI_PROVIDER', 'OPENAI_API_KEY', 'XAI_API_KEY', 'OPENAI_MODEL', 'XAI_MODEL', 'NODE_ENV', 'SESSION_SECRET'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const run = (env: Partial<Record<(typeof keys)[number], string>>) => {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, { NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40), ...env });
    return loadConfig();
  };
  try {
    let r = run({ OPENAI_API_KEY: 'sk-a', XAI_API_KEY: 'xai-b' });
    assert.deepEqual(
      r.config.ai.chain.map((p) => [p.id, p.model]),
      [
        ['openai', 'gpt-4o-mini'],
        ['xai', 'grok-4.20-non-reasoning'],
      ],
    );
    r = run({ AI_PROVIDER: 'xai', OPENAI_API_KEY: 'sk-a', XAI_API_KEY: 'xai-b', XAI_MODEL: 'grok-4.3' });
    assert.equal(r.config.ai.provider, 'xai');
    assert.deepEqual(
      r.config.ai.chain.map((p) => p.id),
      ['xai', 'openai'],
    );
    assert.equal(r.config.ai.chain[0].model, 'grok-4.3');
    assert.equal(r.config.ai.chain[0].baseUrl, 'https://api.x.ai/v1');
    r = run({ AI_PROVIDER: 'rules', OPENAI_API_KEY: 'sk-a' });
    assert.equal(r.config.ai.provider, 'rules');
    assert.equal(r.config.ai.chain.length, 0);
    r = run({ AI_PROVIDER: 'xai', OPENAI_API_KEY: 'sk-a' });
    assert.deepEqual(
      r.config.ai.chain.map((p) => p.id),
      ['openai'],
    );
    assert.ok(r.warnings.some((w) => /XAI_API_KEY is not set/.test(w)));
    r = run({ AI_PROVIDER: 'gemini' });
    assert.ok(r.errors.some((e) => /AI_PROVIDER must be/.test(e)));
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test('config: in production PUBLIC_URL falls back to Render\'s RENDER_EXTERNAL_URL; PUBLIC_URL wins when set', () => {
  const keys = ['NODE_ENV', 'PUBLIC_URL', 'RENDER_EXTERNAL_URL', 'SESSION_SECRET'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const run = (env: Partial<Record<(typeof keys)[number], string>>) => {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, { NODE_ENV: 'production', SESSION_SECRET: 'y'.repeat(40), ...env });
    return loadConfig();
  };
  try {
    let r = run({ RENDER_EXTERNAL_URL: 'https://briefroom.onrender.com' });
    assert.equal(r.config.publicUrl, 'https://briefroom.onrender.com');
    assert.ok(!r.errors.some((e) => /PUBLIC_URL/.test(e)));
    r = run({ RENDER_EXTERNAL_URL: 'https://briefroom.onrender.com', PUBLIC_URL: 'https://brief.example.com/' });
    assert.equal(r.config.publicUrl, 'https://brief.example.com');
    r = run({});
    assert.ok(r.errors.some((e) => /PUBLIC_URL is required/.test(e)));
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test('Nexconn client signs requests as SHA1(secret + nonce + timestamp) and parses tokens', async () => {
  const seen: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ code: 0, result: { userId: 'u1', accessToken: 'TOKEN' } }), { status: 200 });
  }) as unknown as typeof fetch;
  const cfg = testConfig().nexconn;
  const c = createNexconnClient(cfg, f);
  assert.equal(await c.issueAccessToken('u1', 'Neha'), 'TOKEN');
  const h = seen[0].headers;
  assert.equal(seen[0].url, 'https://a.example/v4/auth/access-token/issue');
  assert.equal(h['App-Key'], 'test-key');
  assert.equal(h.Signature, createHash('sha1').update(cfg.appSecret + h.Nonce + h.Timestamp).digest('hex'));
  assert.ok(h.Nonce.length <= 18);
});

test('Nexconn client fails over to the backup domain on 5xx and treats 25409 as "group exists"', async () => {
  const hosts: string[] = [];
  let n = 0;
  const f = (async (url: string) => {
    hosts.push(new URL(url).host);
    n++;
    if (n === 1) return new Response('upstream error', { status: 502 });
    return new Response(JSON.stringify({ code: 25409, msg: 'group exists' }), { status: 200 });
  }) as unknown as typeof fetch;
  const c = createNexconnClient(testConfig().nexconn, f);
  assert.equal(await c.createGroupChannel({ channelId: 'oabc', name: 'x', owner: 's1', members: ['c1'] }), 'exists');
  assert.deepEqual(hosts, ['a.example', 'b.example']);

  const biz = (async () => new Response(JSON.stringify({ code: 1004, msg: 'signature error' }), { status: 401 })) as unknown as typeof fetch;
  const c2 = createNexconnClient(testConfig().nexconn, biz);
  await assert.rejects(() => c2.issueAccessToken('u', 'n'), (e: unknown) => e instanceof NexconnError && e.business === true);
});
