import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cropBackground, fitContain, rectFromPoints, toNormalised, toPixels } from '../../shared/geometry.ts';
import { inspectImage, ImageValidationError } from '../../server/storage/image.ts';
import { makeJpegHeader, makePng, makeWebpHeader } from '../helpers.ts';

test('pointer positions are normalised to the image box, independent of display size', () => {
  const small = { left: 100, top: 50, width: 400, height: 300 };
  const big = { left: 0, top: 0, width: 1600, height: 1200 };
  const a = toNormalised(100 + 0.25 * 400, 50 + 0.5 * 300, small);
  const b = toNormalised(0.25 * 1600, 0.5 * 1200, big);
  assert.deepEqual(a, { x: 0.25, y: 0.5 });
  assert.deepEqual(a, b);
  assert.deepEqual(toNormalised(-50, 10_000, small), { x: 0, y: 1 }, 'clamped to the image');
});

test('resizing preserves marker placement: same normalised rect maps to the same relative pixels', () => {
  const r = { x: 0.2, y: 0.1, w: 0.3, h: 0.25 };
  for (const [w, h] of [
    [360, 270],
    [800, 600],
    [1440, 1080],
  ]) {
    const p = toPixels(r, w, h);
    assert.ok(Math.abs(p.left / w - 0.2) < 1e-9 && Math.abs(p.top / h - 0.1) < 1e-9 && Math.abs(p.width / w - 0.3) < 1e-9 && Math.abs(p.height / h - 0.25) < 1e-9);
  }
});

test('drag rectangles are order-independent and clamped', () => {
  assert.deepEqual(rectFromPoints({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }), { x: 0.2, y: 0.3, w: 0.39999999999999997, h: 0.5 });
  const r = rectFromPoints({ x: -1, y: 0.5 }, { x: 2, y: 0.5 });
  assert.equal(r.x, 0);
  assert.equal(r.w, 1);
});

test('fitContain preserves aspect ratio (portrait and landscape)', () => {
  assert.deepEqual(fitContain(1200, 900, 600, 600), { width: 600, height: 450 });
  assert.deepEqual(fitContain(900, 1600, 600, 600), { width: 338, height: 600 });
});

test('crop background targets the region', () => {
  const c = cropBackground({ x: 0, y: 0, w: 0.5, h: 0.5 });
  assert.equal(c.backgroundSize, '200% 200%');
  assert.equal(c.backgroundPosition, '0% 0%');
});

test('image validation sniffs real content and dimensions (PNG, JPEG, WebP)', () => {
  const png = inspectImage(makePng(64, 48));
  assert.equal(png.mimeType, 'image/png');
  assert.deepEqual([png.width, png.height], [64, 48]);
  assert.match(png.sha256, /^[0-9a-f]{64}$/);
  const jpg = inspectImage(makeJpegHeader(1600, 1200));
  assert.deepEqual([jpg.mimeType, jpg.width, jpg.height], ['image/jpeg', 1600, 1200]);
  const webp = inspectImage(makeWebpHeader(300, 200));
  assert.deepEqual([webp.mimeType, webp.width, webp.height], ['image/webp', 300, 200]);
});

test('spoofed uploads are rejected regardless of claimed type', () => {
  assert.throws(() => inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), ImageValidationError);
  assert.throws(() => inspectImage(Buffer.from('GIF89a......')), /JPEG, PNG or WebP/);
  assert.throws(() => inspectImage(Buffer.alloc(0)), /empty/);
  assert.throws(() => inspectImage(Buffer.alloc(9 * 1024 * 1024, 0xff)), /too large/);
});
