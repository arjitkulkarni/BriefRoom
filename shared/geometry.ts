/**
 * Annotation geometry. The authoritative coordinates are normalised to the ORIGINAL image
 * (0..1 on each axis), so markers stay on the same pixels at any display size, zoom level or
 * device. Screen pixels are only ever derived, never stored.
 */
export interface NRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Pointer position (client px) → normalised image coordinates, given the image's on-screen box. */
export function toNormalised(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  return { x: clamp01((clientX - box.left) / box.width), y: clamp01((clientY - box.top) / box.height) };
}

/** Normalised rectangle → pixel rectangle inside an image rendered at displayWidth × displayHeight. */
export function toPixels(r: NRect, displayWidth: number, displayHeight: number) {
  return { left: r.x * displayWidth, top: r.y * displayHeight, width: r.w * displayWidth, height: r.h * displayHeight };
}

/** Rectangle spanned by two normalised points (drag start/end), clamped to the image. */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): NRect {
  const x = clamp01(Math.min(a.x, b.x));
  const y = clamp01(Math.min(a.y, b.y));
  return { x, y, w: clamp01(Math.max(a.x, b.x)) - x, h: clamp01(Math.max(a.y, b.y)) - y };
}

/**
 * Size of an image that fits inside a container while preserving its aspect ratio
 * (the canvas never stretches the reference).
 */
export function fitContain(imageW: number, imageH: number, maxW: number, maxH: number) {
  if (imageW <= 0 || imageH <= 0) return { width: 0, height: 0 };
  const scale = Math.min(maxW / imageW, maxH / imageH);
  return { width: Math.round(imageW * scale), height: Math.round(imageH * scale) };
}

/** CSS background placement that shows exactly region `r` of an image inside a crop box. */
export function cropBackground(r: NRect) {
  const w = Math.max(r.w, 0.02);
  const h = Math.max(r.h, 0.02);
  return {
    backgroundSize: `${100 / w}% ${100 / h}%`,
    backgroundPosition: `${w >= 1 ? 0 : (r.x / (1 - w)) * 100}% ${h >= 1 ? 0 : (r.y / (1 - h)) * 100}%`,
  };
}

/** Square region centred on a point annotation, used for crop previews. */
export function pointRegion(x: number, y: number, size = 0.22): NRect {
  return { x: clamp01(Math.min(1 - size, x - size / 2)), y: clamp01(Math.min(1 - size, y - size / 2)), w: size, h: size };
}
