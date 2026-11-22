/**
 * Integration tests: real migrations on a real Postgres engine (PGlite) through the real HTTP API.
 * Nexconn is a recording fake here — these tests prove our outbox, idempotency and agreement
 * logic, not the live Nexconn service (live checks: docs/RELEASE_VERIFICATION.md).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { briefVersions, domainEvents } from '../../server/db/schema.ts';
import { completeCakeSpec, createTestApp, makePng, seedOrder } from '../helpers.ts';

type T = Awaited<ReturnType<typeof createTestApp>>;
let t: T;
before(async () => {
  t = await createTestApp();
});
after(async () => {
  await t.close();
});

async function upload(o: Awaited<ReturnType<typeof seedOrder>>, key = o.customerKey) {
  const r = await t.call('POST', `/api/orders/${o.orderId}/references?caption=Pinterest`, { key, raw: makePng(120, 90) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.order.references.at(-1).id as string;
}
const latestVersion = (order: any) => order.versions.find((v: any) => v.id === order.latestVersionId);
const decide = (o: any, key: string, version: any, decision: string, extra: Record<string, unknown> = {}) =>
  t.call('POST', `/api/orders/${o.orderId}/versions/${version.id}/decision`, { key, body: { decision, snapshotHash: version.snapshotHash, ...extra } });

describe('schema & migrations', () => {
  test('all tables exist and immutability triggers are installed', async () => {
    const r = await t.dbh.db.execute(sql`select tgname from pg_trigger where not tgisinternal order by tgname`);
    const names = (r as unknown as { rows: { tgname: string }[] }).rows.map((x) => x.tgname);
    assert.deepEqual(names, ['approvals_append_only', 'approvals_no_delete', 'brief_versions_immutable', 'brief_versions_no_delete']);
    assert.equal(await t.dbh.pendingMigrations(), 0);
  });
});

describe('golden path: spatial collaboration → radar → versions → dual approval', () => {
  test('full flow ends AGREED with both approvals bound to one immutable hash', async () => {
    const o = await seedOrder(t);
    const refId = await upload(o);

    // 6. Buyer annotates the flower region (normalised rect) and asks to change the colour.
    let r = await t.call('POST', `/api/orders/${o.orderId}/annotations`, {
      key: o.customerKey,
      body: { referenceId: refId, kind: 'colour', note: 'Can we change these to ivory roses?', color: '#F4EBD9', shape: 'rect', x: 0.18, y: 0.12, w: 0.32, h: 0.26 },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ann = r.body.order.annotations[0];
    assert.equal(ann.number, 1);
    assert.equal(ann.color, '#f4ebd9');
    assert.deepEqual([ann.x, ann.y, ann.w, ann.h], [0.18, 0.12, 0.32, 0.26]);

    // 8–9. Seller replies in the region's thread, buyer confirms, then two-party resolution.
    await t.call('POST', `/api/orders/${o.orderId}/annotations/${ann.id}/comments`, { key: o.sellerKey, body: { body: 'Should I keep the leaves green?' } });
    r = await t.call('POST', `/api/orders/${o.orderId}/annotations/${ann.id}/comments`, { key: o.customerKey, body: { body: 'Yes.' } });
    const thread = r.body.order.annotations[0];
    assert.equal(thread.status, 'discussion');
    assert.deepEqual(thread.comments.map((c: any) => c.authorRole), ['seller', 'customer']);
    r = await t.call('POST', `/api/orders/${o.orderId}/annotations/${ann.id}/resolution`, { key: o.sellerKey, body: { action: 'request' } });
    assert.equal(r.body.order.annotations[0].resolutionRequestedBy, 'seller');
    r = await t.call('POST', `/api/orders/${o.orderId}/annotations/${ann.id}/resolution`, { key: o.sellerKey, body: { action: 'confirm' } });
    assert.equal(r.status, 409, 'the requester cannot confirm their own request');
    r = await t.call('POST', `/api/orders/${o.orderId}/annotations/${ann.id}/resolution`, { key: o.customerKey, body: { action: 'confirm' } });
    assert.equal(r.body.order.annotations[0].status, 'resolved');
    assert.equal(r.body.order.annotations[0].resolvedBy, 'customer');

    // 10. Radar: required fields block a proposal; a critical clarification blocks too.
    r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: { note: 'v1' } });
    assert.equal(r.status, 422);
    assert.ok(r.body.details.blockers.some((b: any) => b.kind === 'required_field' && b.id === 'weight'));
    r = await t.call('POST', `/api/orders/${o.orderId}/clarifications`, { key: o.sellerKey, body: { title: 'Which shade of ivory for the message?', critical: true } });
    const clarId = r.body.order.clarifications[0].id;
    assert.equal(r.body.order.status, 'awaiting_clarification');
    await completeCakeSpec(t, o);
    r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: {} });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body.details.blockers.map((b: any) => b.kind), ['critical_clarification']);
    // 11. Resolve the critical issue (resolution text is mandatory and becomes part of the brief).
    r = await t.call('PATCH', `/api/orders/${o.orderId}/clarifications/${clarId}`, { key: o.customerKey, body: { action: 'resolve' } });
    assert.equal(r.status, 400);
    r = await t.call('PATCH', `/api/orders/${o.orderId}/clarifications/${clarId}`, { key: o.customerKey, body: { action: 'resolve', resolution: 'Warm ivory, like the swatch on #1' } });
    assert.equal(r.body.order.status, 'collecting');
    assert.equal(r.body.order.blockers.length, 0);

    // 13. Seller proposes version 1 — the proposer does NOT auto-approve.
    r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: { note: 'First proposal' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v1 = latestVersion(r.body.order);
    assert.equal(v1.number, 1);
    assert.equal(v1.approvals.length, 0);
    assert.equal(r.body.order.status, 'awaiting_approval');
    assert.equal(r.body.order.draftDirty, false);

    // 14. Buyer requests a change.
    r = await decide(o, o.customerKey, v1, 'changes_requested', { reason: 'Make it 2 kg please' });
    assert.equal(r.body.order.status, 'changes_requested');

    // 15. Seller updates and proposes version 2.
    await t.call('PATCH', `/api/orders/${o.orderId}/spec`, { key: o.customerKey, body: { spec: { weight: '2 kg' } } });
    await t.call('PATCH', `/api/orders/${o.orderId}/spec`, { key: o.sellerKey, body: { spec: { price: 2400 } } });
    r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: { note: '2 kg, new price' } });
    const v2 = latestVersion(r.body.order);
    assert.equal(v2.number, 2);
    // 16. The visual diff is derived from the two stored snapshots.
    assert.deepEqual(v2.diff.price, { before: 1850, after: 2400 });
    assert.ok(v2.diff.spec.some((c: any) => c.key === 'weight' && c.before === '1.5 kg' && c.after === '2 kg'));
    assert.equal(r.body.order.versions[0].status, 'changes_requested', 'v1 stays on record');

    // A stale version can no longer be approved.
    r = await decide(o, o.customerKey, v1, 'approved');
    assert.equal(r.status, 409);

    // 17. Buyer approves — not agreed yet.
    r = await decide(o, o.customerKey, v2, 'approved');
    assert.equal(r.body.result.agreed, false);
    assert.equal(r.body.order.status, 'awaiting_approval');
    // 18–20. Seller approves the same version + hash → AGREED.
    r = await decide(o, o.sellerKey, v2, 'approved');
    assert.equal(r.body.result.agreed, true);
    assert.equal(r.body.order.status, 'agreed');
    assert.equal(r.body.order.agreedVersionId, v2.id);
    const agreedV = latestVersion(r.body.order);
    assert.equal(agreedV.status, 'agreed');
    assert.deepEqual(agreedV.approvals.map((a: any) => [a.role, a.snapshotHash]).sort(), [
      ['customer', v2.snapshotHash],
      ['seller', v2.snapshotHash],
    ]);
    // The agreement locks the brief.
    r = await t.call('PATCH', `/api/orders/${o.orderId}/spec`, { key: o.customerKey, body: { spec: { weight: '3 kg' } } });
    assert.equal(r.status, 409);
    // Events were recorded for every step.
    const types = (await t.call('GET', `/api/orders/${o.orderId}`, { key: o.sellerKey })).body.order.activity.map((a: any) => a.type);
    for (const ty of ['ORDER_CREATED', 'REFERENCE_ADDED', 'ANNOTATION_CREATED', 'ANNOTATION_COMMENTED', 'ANNOTATION_RESOLVED', 'CLARIFICATION_RAISED', 'CLARIFICATION_RESOLVED', 'SPECIFICATION_UPDATED', 'VERSION_PROPOSED', 'VERSION_REJECTED', 'VERSION_APPROVED', 'ORDER_AGREED'])
      assert.ok(types.includes(ty), `missing ${ty}`);

    // Reopen keeps the agreed version immutable; a new version needs both approvals again.
    r = await t.call('POST', `/api/orders/${o.orderId}/reopen`, { key: o.customerKey });
    assert.equal(r.status, 403, 'only the seller can reopen');
    r = await t.call('POST', `/api/orders/${o.orderId}/reopen`, { key: o.sellerKey });
    assert.equal(r.body.order.status, 'collecting');
    assert.equal(r.body.order.agreedVersionId, null);
    assert.equal(r.body.order.versions.find((v: any) => v.id === v2.id).status, 'agreed');
  });
});

describe('agreement engine rules', () => {
  async function proposed() {
    const o = await seedOrder(t);
    await upload(o);
    await completeCakeSpec(t, o);
    const r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: {} });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { o, v: latestVersion(r.body.order) };
  }

  test('buyer approval alone or seller approval alone does not agree the order', async () => {
    const a = await proposed();
    assert.equal((await decide(a.o, a.o.customerKey, a.v, 'approved')).body.order.status, 'awaiting_approval');
    const b = await proposed();
    assert.equal((await decide(b.o, b.o.sellerKey, b.v, 'approved')).body.order.status, 'awaiting_approval');
  });

  test('approvals of different versions never agree an order', async () => {
    const { o, v: v1 } = await proposed();
    await decide(o, o.customerKey, v1, 'approved');
    await t.call('PATCH', `/api/orders/${o.orderId}/spec`, { key: o.sellerKey, body: { spec: { price: 1999 } } });
    const r = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: {} });
    const v2 = latestVersion(r.body.order);
    assert.equal(r.body.order.versions[0].status, 'superseded');
    const s = await decide(o, o.sellerKey, v2, 'approved');
    assert.equal(s.body.result.agreed, false, 'customer approved v1, seller approved v2');
    assert.equal(s.body.order.status, 'awaiting_approval');
  });

  test('an approval with a different hash than the stored version is rejected', async () => {
    const { o, v } = await proposed();
    const r = await t.call('POST', `/api/orders/${o.orderId}/versions/${v.id}/decision`, { key: o.customerKey, body: { decision: 'approved', snapshotHash: 'f'.repeat(64) } });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /fingerprint/);
  });

  test('duplicate approval requests are idempotent (same key or repeated decision)', async () => {
    const { o, v } = await proposed();
    const h = { 'idempotency-key': 'approve-123' };
    const first = await t.call('POST', `/api/orders/${o.orderId}/versions/${v.id}/decision`, { key: o.customerKey, body: { decision: 'approved', snapshotHash: v.snapshotHash }, headers: h });
    const again = await t.call('POST', `/api/orders/${o.orderId}/versions/${v.id}/decision`, { key: o.customerKey, body: { decision: 'approved', snapshotHash: v.snapshotHash }, headers: h });
    const third = await decide(o, o.customerKey, v, 'approved');
    assert.equal(first.status, 200);
    assert.equal(again.body.result.replayed, true);
    assert.equal(third.body.result.replayed, true);
    assert.equal(latestVersion(third.body.order).approvals.length, 1);
    const conflict = await decide(o, o.customerKey, v, 'changes_requested', { reason: 'no' });
    assert.equal(conflict.status, 409);
  });

  test('concurrent final approvals are serialised: exactly one ORDER_AGREED', async () => {
    const { o, v } = await proposed();
    const [a, b] = await Promise.all([decide(o, o.customerKey, v, 'approved'), decide(o, o.sellerKey, v, 'approved')]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal([a.body.result.agreed, b.body.result.agreed].filter(Boolean).length, 1);
    const agreedEvents = await t.dbh.db.select().from(domainEvents).where(sql`${domainEvents.orderId} = ${o.orderId} and ${domainEvents.type} = 'ORDER_AGREED'`);
    assert.equal(agreedEvents.length, 1);
  });

  test('snapshots are immutable in the database and previous versions stay accessible', async () => {
    const { o, v } = await proposed();
    const dbError = (re: RegExp) => (e: unknown) => re.test(String((e as { cause?: Error }).cause?.message ?? (e as Error).message));
    await assert.rejects(() => t.dbh.db.update(briefVersions).set({ snapshotHash: 'a'.repeat(64) }).where(eq(briefVersions.id, v.id)), dbError(/immutable/));
    await assert.rejects(() => t.dbh.db.delete(briefVersions).where(eq(briefVersions.id, v.id)), dbError(/permanent/));
    const r = await t.call('GET', `/api/orders/${o.orderId}`, { key: o.customerKey });
    assert.equal(r.body.order.versions[0].snapshotHash, v.snapshotHash);
  });

  test('re-proposing an unchanged brief is idempotent for the proposer and rejected for the other side', async () => {
    const { o, v } = await proposed();
    const same = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.sellerKey, body: {} });
    assert.equal(same.body.result.replayed, true);
    assert.equal(same.body.result.versionId, v.id);
    const other = await t.call('POST', `/api/orders/${o.orderId}/versions`, { key: o.customerKey, body: {} });
    assert.equal(other.status, 409);
  });
});

describe('access control & validation', () => {
  test('keys are scoped: a customer cannot read another order, and seller-only fields are protected', async () => {
    const a = await seedOrder(t);
    const b = await seedOrder(t);
    assert.equal((await t.call('GET', `/api/orders/${a.orderId}`, { key: b.customerKey })).status, 403);
    assert.equal((await t.call('GET', `/api/orders/${a.orderId}`)).status, 403);
    assert.equal((await t.call('GET', `/api/shops/${a.shopId}/orders`, { key: a.customerKey })).status, 403);
    const price = await t.call('PATCH', `/api/orders/${a.orderId}/spec`, { key: a.customerKey, body: { spec: { price: 1 } } });
    assert.equal(price.status, 403);
    const view = await t.call('GET', `/api/orders/${a.orderId}`, { key: a.customerKey });
    assert.equal(view.body.order.inviteKey, undefined, 'invite key is seller-only');
  });

  test('uploads are sniffed server-side and served only through signed URLs', async () => {
    const o = await seedOrder(t);
    const bad = await t.call('POST', `/api/orders/${o.orderId}/references`, { key: o.customerKey, raw: Buffer.from('<svg/>') });
    assert.equal(bad.status, 415);
    await upload(o);
    const ref = (await t.call('GET', `/api/orders/${o.orderId}`, { key: o.customerKey })).body.order.references[0];
    assert.equal(ref.mimeType, 'image/png');
    assert.deepEqual([ref.width, ref.height], [120, 90]);
    const ok = await fetch(t.base + ref.url);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/png');
    const forged = await fetch(`${t.base}/api/assets/${ref.id}?sig=forged`);
    assert.equal(forged.status, 403);
  });

  test('annotation geometry is validated and normalised; point annotations are supported', async () => {
    const o = await seedOrder(t);
    const refId = await upload(o);
    const r = await t.call('POST', `/api/orders/${o.orderId}/annotations`, { key: o.customerKey, body: { referenceId: refId, kind: 'remove', shape: 'point', x: 0.7071234, y: 1.4, note: 'No sprinkles here' } });
    const a = r.body.order.annotations[0];
    assert.deepEqual([a.shape, a.x, a.y, a.w, a.h], ['point', 0.7071, 1, 0, 0]);
    const bad = await t.call('POST', `/api/orders/${o.orderId}/annotations`, { key: o.customerKey, body: { referenceId: refId, kind: 'explode', x: 0, y: 0 } });
    assert.equal(bad.status, 400);
    const q = await t.call('POST', `/api/orders/${o.orderId}/annotations`, { key: o.customerKey, body: { referenceId: refId, kind: 'question', x: 0.1, y: 0.1, w: 0.1, h: 0.1 } });
    assert.equal(q.status, 400, 'a question needs text');
  });
});

describe('Nexconn outbox (fake Nexconn server API)', () => {
  test('events are published in order as BR:* messages, channel created once, held back and retried after an outage', async () => {
    const m = await createTestApp({ autoDispatch: false });
    try {
      const shop = await m.call('POST', '/api/shops', { body: { name: 'Studio', ownerName: 'Neha', category: 'cake' } });
      const created = await m.call('POST', `/api/shops/${shop.body.shop.id}/orders`, { key: shop.body.sellerKey, body: { customerName: 'Priya' } });
      const orderId = created.body.orderId as string;
      const customerKey = created.body.customerKey as string;
      await m.call('POST', `/api/orders/${orderId}/references`, { key: customerKey, raw: makePng(40, 30) });

      // Outage on the first send: ORDER_CREATED goes into backoff and REFERENCE_ADDED must wait.
      m.nexconn.failNextSends = 1;
      await m.ctx.outbox.runOnce();
      let rows = await m.dbh.db.select().from(domainEvents).where(eq(domainEvents.orderId, orderId)).orderBy(domainEvents.seq);
      assert.equal(rows[0].type, 'ORDER_CREATED');
      assert.equal(rows[0].nexconnStatus, 'pending');
      assert.match(rows[0].nexconnLastError ?? '', /outage/);
      assert.equal(rows[1].nexconnStatus, 'pending', 'later event held back within the batch');
      // A second run while the first event is still in backoff must not leapfrog it.
      await m.ctx.outbox.runOnce();
      rows = await m.dbh.db.select().from(domainEvents).where(eq(domainEvents.orderId, orderId)).orderBy(domainEvents.seq);
      assert.equal(rows[1].nexconnStatus, 'pending', 'later event held back across batches');

      // Backoff elapses → both delivered, in order.
      await m.dbh.db.update(domainEvents).set({ nexconnNextAttemptAt: new Date(0) }).where(eq(domainEvents.orderId, orderId));
      await m.ctx.outbox.runOnce();
      rows = await m.dbh.db.select().from(domainEvents).where(eq(domainEvents.orderId, orderId)).orderBy(domainEvents.seq);
      assert.deepEqual(rows.map((r) => [r.type, r.nexconnStatus]), [
        ['ORDER_CREATED', 'sent'],
        ['REFERENCE_ADDED', 'sent'],
      ]);
      assert.ok(rows.every((r) => r.nexconnMessageId), 'Nexconn message IDs are recorded on the events');
      const sent = m.nexconn.calls.filter((c) => c.op === 'send' && c.args.channelId === `o${orderId}`).slice(-2);
      assert.deepEqual(sent.map((s) => s.args.messageType), ['BR:OrderCreated', 'BR:ReferenceAdded']);
      const payload = JSON.parse(String(sent[1].args.content));
      assert.equal(payload.eventType, 'REFERENCE_ADDED');
      assert.equal(payload.actor.role, 'customer');
      const view = await m.call('GET', `/api/orders/${orderId}`, { key: customerKey });
      assert.equal(sent[1].args.fromUserId, view.body.order.participants.find((p: any) => p.role === 'customer').nexconnUserId);
      assert.equal(view.body.order.channel.status, 'ready');
      assert.equal(m.nexconn.calls.filter((c) => c.op === 'createGroup').length, 1, 'channel created exactly once');
    } finally {
      await m.close();
    }
  });

  test('a busy order cannot hold back another order: delivery is fair across orders and in order within each', async () => {
    const m = await createTestApp({ autoDispatch: false });
    try {
      const shop = await m.call('POST', '/api/shops', { body: { name: 'Studio', ownerName: 'Neha', category: 'cake' } });
      const open = async (customerName: string) =>
        (await m.call('POST', `/api/shops/${shop.body.shop.id}/orders`, { key: shop.body.sellerKey, body: { customerName } })).body as { orderId: string; customerKey: string };
      const busy = await open('Busy');
      for (let i = 0; i < 60; i++) await m.call('PATCH', `/api/orders/${busy.orderId}/spec`, { key: busy.customerKey, body: { spec: { message: `Draft ${i}` } } });
      const quiet = await open('Quiet'); // created after 61 events of the busy order (more than a whole batch)

      await m.ctx.outbox.runOnce();
      const sends = m.nexconn.calls.filter((c) => c.op === 'send').map((c) => String(c.args.channelId));
      const busySends = sends.map((ch, i) => (ch === `o${busy.orderId}` ? i : -1)).filter((i) => i >= 0);
      assert.equal(busySends.length, 61, 'everything is delivered in the end');
      assert.ok(sends.indexOf(`o${quiet.orderId}`) < busySends[5], 'the quiet order is served in the first round, not after the whole backlog');
      const rows = await m.dbh.db.select().from(domainEvents).where(eq(domainEvents.orderId, busy.orderId)).orderBy(domainEvents.seq);
      const sentOrder = m.nexconn.calls.filter((c) => c.op === 'send' && c.args.channelId === `o${busy.orderId}`).map((c) => JSON.parse(String(c.args.content)).eventId);
      assert.deepEqual(sentOrder, rows.map((r) => r.id), 'one order’s events stay in sequence');
    } finally {
      await m.close();
    }
  });

  test('without Nexconn credentials, events are recorded honestly as skipped and the brief still works', async () => {
    const off = await createTestApp({ nexconnEnabled: false });
    try {
      const o = await seedOrder(off);
      const r = await off.call('GET', `/api/orders/${o.orderId}`, { key: o.customerKey });
      assert.equal(r.body.order.channel.status, 'disabled');
      assert.equal(r.body.order.activity[0].nexconnStatus, 'skipped');
      const tok = await off.call('POST', '/api/nexconn/token', { key: o.customerKey, body: { orderId: o.orderId } });
      assert.equal(tok.status, 503);
    } finally {
      await off.close();
    }
  });
});

describe('suggestions (rules provider)', () => {
  test('analysis creates grounded suggestions; ask turns one into a clarification; dismiss sticks', async () => {
    const o = await seedOrder(t);
    const refId = await upload(o);
    await t.call('POST', `/api/orders/${o.orderId}/annotations`, { key: o.customerKey, body: { referenceId: refId, kind: 'change', note: 'make it a little bigger', x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
    let r = await t.call('POST', `/api/orders/${o.orderId}/analysis`, { key: o.sellerKey, body: { messages: [{ id: 'msg-1', text: 'Slightly lighter pink please' }] } });
    assert.equal(r.body.result.provider, 'rules');
    const sugs = r.body.order.suggestions;
    assert.ok(sugs.length >= 2);
    assert.ok(sugs.every((s: any) => s.source === 'rules' && s.evidence.length > 0));
    const shade = sugs.find((s: any) => s.category === 'unspecified_colour');
    r = await t.call('PATCH', `/api/orders/${o.orderId}/suggestions/${shade.id}`, { key: o.sellerKey, body: { action: 'ask', question: 'Which exact pink? Please pick a swatch.' } });
    const cl = r.body.order.clarifications.find((c: any) => c.id === r.body.result.clarificationId);
    assert.equal(cl.title, 'Which exact pink? Please pick a swatch.');
    assert.equal(cl.source, 'rules');
    assert.equal(cl.messageId, 'msg-1');
    const other = r.body.order.suggestions.find((s: any) => s.status === 'suggested');
    r = await t.call('PATCH', `/api/orders/${o.orderId}/suggestions/${other.id}`, { key: o.sellerKey, body: { action: 'dismiss' } });
    r = await t.call('POST', `/api/orders/${o.orderId}/analysis`, { key: o.sellerKey, body: { messages: [{ id: 'msg-1', text: 'Slightly lighter pink please' }] } });
    assert.ok(!r.body.order.suggestions.some((s: any) => s.id === other.id), 'dismissed suggestions do not come back');
  });
});

describe('one-click live demo', () => {
  test('seeds the Priya & Neha story through real commands, leaves only the re-quote, and stays out of /api/stats', async () => {
    const before = (await t.call('GET', '/api/stats')).body;
    const d = await t.call('POST', '/api/demo', { body: {} });
    assert.equal(d.status, 201, JSON.stringify(d.body));
    const { shopId, orderId, sellerKey, customerKey } = d.body;
    await t.ctx.demo.idle(); // dashboard orders + chat lines are seeded in the background

    const asCustomer = (await t.call('GET', `/api/orders/${orderId}`, { key: customerKey })).body.order;
    const asSeller = (await t.call('GET', `/api/orders/${orderId}`, { key: sellerKey })).body.order;
    assert.equal(asCustomer.role, 'customer');
    assert.equal(asSeller.role, 'seller');
    assert.equal(asSeller.title, 'Aditi’s 25th birthday cake');
    assert.equal(asSeller.status, 'changes_requested');
    assert.equal(asSeller.references.length, 1);
    assert.deepEqual(
      asSeller.annotations.map((a: any) => [a.number, a.kind, a.status, a.comments.length]),
      [
        [1, 'change', 'discussion', 2],
        [2, 'keep', 'resolved', 2],
      ],
    );
    assert.deepEqual(asSeller.clarifications.map((c: any) => c.status), ['resolved']);
    assert.deepEqual(asSeller.versions.map((v: any) => [v.number, v.status]), [[1, 'changes_requested']]);
    assert.deepEqual(asSeller.blockers.map((b: any) => b.id), ['price'], 'only the seller price is left open');

    // The seller dashboard looks like a working shop: one order in each state.
    const shop = await t.call('GET', `/api/shops/${shopId}/orders`, { key: sellerKey });
    assert.equal(shop.status, 200, JSON.stringify(shop.body));
    const statuses = (shop.body.orders as any[]).map((o) => o.status).sort();
    assert.deepEqual(statuses, ['agreed', 'awaiting_clarification', 'changes_requested', 'completed']);

    // The chat lines follow the order's activity, sent as the two real participants.
    const sends = t.nexconn.calls.filter((c) => c.op === 'send' && c.args.channelId === asSeller.channel.channelId).map((c) => c.args as { fromUserId: string; messageType: string; content: string });
    const kinds = sends.map((s) => (s.messageType === 'RC:TxtMsg' ? 'text' : 'card'));
    const texts = sends.filter((s) => s.messageType === 'RC:TxtMsg');
    assert.equal(texts.length, 3);
    assert.equal(kinds.slice(-3).join(), 'text,text,text', 'chat lines come after the activity cards');
    const ids = Object.fromEntries(asSeller.participants.map((p: any) => [p.role, p.nexconnUserId]));
    assert.deepEqual(texts.map((s) => s.fromUserId), [ids.customer, ids.seller, ids.customer]);
    assert.match(JSON.parse(texts[0].content).content, /2 kg/);

    // Demo shops and their orders are not usage.
    assert.deepEqual((await t.call('GET', '/api/stats')).body, before);

    // The guided path from the demo page: re-quote → propose v2 (diff against v1) → both approve.
    let r = await t.call('PATCH', `/api/orders/${orderId}/spec`, { key: sellerKey, body: { spec: { price: 2400 } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.order.blockers, []);
    r = await t.call('POST', `/api/orders/${orderId}/versions`, { key: sellerKey, body: { note: 'Two kilos, ivory sugar roses.' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = latestVersion(r.body.order);
    assert.equal(v.number, 2);
    assert.ok(v.diff.summary.some((l: string) => /1\.5 kg.*2 kg/.test(l)), JSON.stringify(v.diff.summary));
    assert.ok(v.diff.summary.some((l: string) => /1,850.*2,400/.test(l)), JSON.stringify(v.diff.summary));
    assert.equal((await decide({ orderId }, customerKey, v, 'approved')).status, 200);
    r = await decide({ orderId }, sellerKey, v, 'approved');
    assert.equal(r.body.order.status, 'agreed');
  });
});
