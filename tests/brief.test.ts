import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'briefroom-test-'));
const store = await import('../server/store.ts');
const b = await import('../server/brief.ts');

store.db.shops.s1 = { id: 's1', name: 'Sugar', owner: 'Neha', category: 'cake', city: '', sellerUserId: 'ss1', sellerKey: 'SK', createdAt: 0 };
const order = () => ({
  id: 'o1', shopId: 's1', template: 'cake', title: 'Cake', customerName: 'Priya', customerUserId: 'co1', customerKey: 'CK', channelId: 'oo1',
  createdAt: 0, updatedAt: 0, draft: { refs: [] as any[], pins: [] as any[], spec: {} as Record<string, any> }, versions: [] as any[],
  agreedVersion: null as number | null, pinCounter: 0,
});
const complete = (o: ReturnType<typeof order>) =>
  Object.assign(o.draft.spec, { weight: '1 kg', flavour: 'Vanilla', deliveryDate: '2026-12-01', fulfilment: 'Pickup' });

test('keys resolve to roles', () => {
  const o = order();
  assert.equal(b.roleFor(o, 'CK'), 'customer');
  assert.equal(b.roleFor(o, 'SK'), 'seller');
  assert.equal(b.roleFor(o, 'nope'), null);
});

test('spec sanitizing: seller-only fields, enums, unknown keys', () => {
  const s = b.sanitizeSpec(order(), 'customer', { price: 999, flavour: 'Hacker', bogus: 1, eggless: 'yes' });
  assert.equal(s.price, undefined);
  assert.equal(s.flavour, '');
  assert.ok(!('bogus' in s));
  assert.equal(s.eggless, true);
});

test('approval is blocked until required fields (incl. price) are filled', () => {
  const o = order();
  complete(o);
  const v1 = b.propose(o, 'customer', '');
  assert.deepEqual(v1.approvals, {});
  assert.throws(() => b.decide(o, 'customer', 1, 'approve', ''), /price/i);
});

test('identical versions are rejected; stale versions cannot be approved', () => {
  const o = order();
  complete(o);
  o.draft.spec.price = 1500;
  b.propose(o, 'seller', '');
  assert.throws(() => b.propose(o, 'seller', ''), /Nothing changed/);
  o.draft.spec.price = 1600;
  b.propose(o, 'seller', '');
  assert.throws(() => b.decide(o, 'customer', 1, 'approve', ''), /newer/);
});

test('full flow: change request -> new version -> both approve the same version -> locked', () => {
  const o = order();
  complete(o);
  o.draft.spec.price = 1850;
  const v1 = b.propose(o, 'seller', 'first');
  assert.ok(v1.approvals.seller, 'proposer auto-approves a complete version');
  b.decide(o, 'customer', 1, 'changes', 'pinker please');
  assert.equal(b.statusOf(o), 'changes');
  o.draft.pins.push({ id: 'p1', n: 1, refId: 'r1', x: 0.1, y: 0.1, w: 0.2, h: 0.2, kind: 'colour', note: 'pink', color: '#f4a7c0', by: 'customer', at: 0, resolved: false });
  const v2 = b.propose(o, 'seller', 'pinker');
  assert.ok(v2.changes.some((c) => c.startsWith('Pin #1 added')));
  const r = b.decide(o, 'customer', 2, 'approve', '');
  assert.equal(r.agreed, true);
  assert.equal(b.statusOf(o), 'agreed');
  assert.throws(() => b.assertEditable(o), /locked/);
  assert.equal(v2.hash, b.hashBrief(o, v2.snapshot));
  assert.notEqual(v1.hash, v2.hash);
});

test('invite key is only exposed to the seller', () => {
  const o = order();
  assert.equal(b.toView(o, 'customer').inviteKey, undefined);
  assert.equal(b.toView(o, 'seller').inviteKey, 'CK');
});
