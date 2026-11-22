/**
 * LIVE Nexconn server-side checks — opt-in: `npm run test:live` (reads NEXCONN_* from .env.local).
 * Uses the REAL Platform Chat API with an in-memory PGlite database (never touches Neon).
 * The retry test injects exactly one network failure in front of the real API, so the outbox's
 * retry and per-order ordering are proven against the live service, not against a fake.
 * Skipped (not failed) when the environment has no Nexconn credentials.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import { loadConfig } from '../../server/config.ts';
import { domainEvents } from '../../server/db/schema.ts';
import { createNexconnClient } from '../../server/nexconn/client.ts';
import { createTestApp, seedOrder } from '../helpers.ts';

const { config } = loadConfig();
const skip = config.nexconn.enabled ? false : 'no Nexconn credentials (set NEXCONN_DEV_APP_KEY/SECRET and NEXCONN_REGION in .env.local)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('live: the configured credentials and region issue an access token', { skip }, async () => {
  const nx = createNexconnClient(config.nexconn);
  const token = await nx.issueAccessToken('br_live_probe', 'BriefRoom live probe');
  assert.ok(token.length > 20, 'token issued');
});

test('live: creating the same group twice is idempotent (25409 → "exists")', { skip }, async () => {
  const nx = createNexconnClient(config.nexconn);
  const id = `brlive_${Date.now().toString(36)}`;
  await nx.issueAccessToken('br_live_owner', 'Live owner');
  await nx.issueAccessToken('br_live_member', 'Live member');
  const input = { channelId: id, name: 'BriefRoom live check', owner: 'br_live_owner', members: ['br_live_owner', 'br_live_member'] };
  assert.equal(await nx.createGroupChannel(input), 'created');
  assert.equal(await nx.createGroupChannel(input), 'exists');
});

test('live: a failed send is retried with backoff and later events of the order wait for it', { skip }, async () => {
  let injected = 0;
  const flaky = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    // Fail the first message-send call on BOTH data-centre domains (primary + backup) → one failed attempt.
    if (url.includes('/v4/group-channel/message/send') && injected < 2) {
      injected++;
      throw new TypeError('fetch failed (injected network error)');
    }
    return fetch(input, init);
  }) as typeof fetch;
  const t = await createTestApp({ nexconn: createNexconnClient(config.nexconn, flaky), autoDispatch: false });
  try {
    const o = await seedOrder(t); // ORDER_CREATED
    for (const title of ['Retry check B', 'Retry check C']) {
      const r = await t.call('POST', `/api/orders/${o.orderId}/clarifications`, { key: o.customerKey, body: { title } });
      assert.equal(r.status, 200);
    }
    const events = () => t.dbh.db.select().from(domainEvents).where(eq(domainEvents.orderId, o.orderId)).orderBy(asc(domainEvents.seq));

    // Run 1: the group is created on Nexconn, the first send hits the injected failure.
    await t.ctx.outbox.runOnce();
    let ev = await events();
    assert.equal(ev.length, 3);
    assert.equal(injected, 2, 'primary and backup domain both failed once');
    assert.deepEqual(ev.map((e) => [e.nexconnStatus, e.nexconnAttempts]), [['pending', 1], ['pending', 0], ['pending', 0]]);
    assert.match(ev[0].nexconnLastError ?? '', /injected/);
    assert.ok(ev[0].nexconnNextAttemptAt.getTime() > Date.now(), 'first event is in backoff');

    // Run 2 (still inside the backoff window): nothing may overtake the failed event.
    await t.ctx.outbox.runOnce();
    ev = await events();
    assert.deepEqual(ev.map((e) => e.nexconnStatus), ['pending', 'pending', 'pending'], 'later events wait for the earlier one');

    // Run 3 (after the backoff): the retry succeeds against the real API, then the rest follow in order.
    await sleep(Math.max(0, ev[0].nexconnNextAttemptAt.getTime() - Date.now()) + 300);
    await t.ctx.outbox.runOnce();
    ev = await events();
    assert.deepEqual(ev.map((e) => [e.type, e.nexconnStatus, e.nexconnAttempts]), [
      ['ORDER_CREATED', 'sent', 2],
      ['CLARIFICATION_RAISED', 'sent', 1],
      ['CLARIFICATION_RAISED', 'sent', 1],
    ]);
    const ids = ev.map((e) => e.nexconnMessageId);
    assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0), 'Nexconn returned a message ID for each event');
    assert.equal(new Set(ids).size, 3, 'each event delivered once');
    const sentAt = ev.map((e) => e.nexconnSentAt!.getTime());
    assert.ok(sentAt[0] <= sentAt[1] && sentAt[1] <= sentAt[2], 'delivered in seq order');
    console.log(`    live message IDs: ${ids.join(', ')}`);
  } finally {
    await t.close();
  }
});
