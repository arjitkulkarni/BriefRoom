import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalJSON, diffSnapshots, normaliseSnapshot, SNAPSHOT_SCHEMA, type BriefSnapshot } from '../../shared/snapshot.ts';
import { hashSnapshot } from '../../server/domain/util.ts';

const base = (): BriefSnapshot =>
  normaliseSnapshot({
    schema: SNAPSHOT_SCHEMA,
    order: { id: 'o1', shopId: 's1', template: 'cake', title: 'Cake' },
    references: [{ id: 'r1', sha256: 'a'.repeat(64), width: 1200, height: 900, mimeType: 'image/jpeg', caption: '' }],
    annotations: [{ id: 'a1', number: 1, referenceId: 'r1', kind: 'colour', shape: 'rect', x: 0.2, y: 0.1, w: 0.3, h: 0.25, color: '#f4e9d8', note: 'Ivory roses', status: 'open' }],
    spec: { weight: '1 kg', flavour: 'Vanilla', price: 1850, deliveryDate: '2026-12-01', timeSlot: 'Evening (4–8)', message: 'Happy 25th' },
    clarifications: [],
  });

test('identical snapshots produce identical hashes (key order does not matter)', () => {
  const a = base();
  const b = JSON.parse(JSON.stringify(a));
  // Rebuild the spec with reversed key order — canonical JSON must not care.
  b.spec = Object.fromEntries(Object.entries(a.spec).reverse());
  assert.equal(hashSnapshot(a), hashSnapshot(b));
  assert.match(hashSnapshot(a), /^[0-9a-f]{64}$/);
});

test('changed specification changes the hash', () => {
  const b = base();
  b.spec.weight = '1.5 kg';
  assert.notEqual(hashSnapshot(base()), hashSnapshot(b));
});

test('changed image asset hash changes the fingerprint', () => {
  const b = base();
  b.references[0].sha256 = 'b'.repeat(64);
  assert.notEqual(hashSnapshot(base()), hashSnapshot(b));
});

test('changed annotation coordinates change the fingerprint; sub-precision noise does not', () => {
  const moved = base();
  moved.annotations[0].x = 0.25;
  assert.notEqual(hashSnapshot(base()), hashSnapshot(moved));
  const noise = normaliseSnapshot({ ...base(), annotations: [{ ...base().annotations[0], x: 0.200001 }] });
  assert.equal(hashSnapshot(base()), hashSnapshot(noise), 'coordinates are rounded to 4 dp before hashing');
});

test('canonicalJSON sorts keys recursively and rejects non-finite numbers', () => {
  assert.equal(canonicalJSON({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  assert.throws(() => canonicalJSON({ x: Number.NaN }));
});

test('diff reports added, removed and modified annotations, spec, price and delivery changes', () => {
  const prev = base();
  const next = base();
  next.annotations = [
    { ...prev.annotations[0], color: '#fffff0', x: 0.22 },
    { id: 'a2', number: 2, referenceId: 'r1', kind: 'remove', shape: 'point', x: 0.7, y: 0.7, w: 0, h: 0, color: null, note: 'No sprinkles', status: 'open' },
  ];
  next.spec = { ...prev.spec, weight: '1.5 kg', price: 2100, timeSlot: 'Morning (9–12)', message: 'Happy 25th, Aditi!' };
  const d = diffSnapshots(prev, next);
  assert.deepEqual(d.annotations.added.map((a) => a.number), [2]);
  assert.equal(d.annotations.removed.length, 0);
  assert.deepEqual(d.annotations.modified[0].changes.sort(), ['color', 'geometry']);
  assert.deepEqual(d.price, { before: 1850, after: 2100 });
  assert.deepEqual(d.delivery.map((c) => c.key), ['timeSlot']);
  assert.ok(d.spec.some((c) => c.key === 'weight' && c.before === '1 kg' && c.after === '1.5 kg'));
  assert.ok(d.spec.some((c) => c.key === 'message'));
  assert.equal(d.isEmpty, false);

  const removed = diffSnapshots(next, prev);
  assert.deepEqual(removed.annotations.removed.map((a) => a.number), [2]);
  assert.ok(diffSnapshots(prev, base()).isEmpty, 'identical snapshots have an empty diff');
});

test('first version diff lists everything as added', () => {
  const d = diffSnapshots(null, base());
  assert.equal(d.annotations.added.length, 1);
  assert.equal(d.references.added.length, 1);
  assert.deepEqual(d.price, { before: null, after: 1850 });
});
