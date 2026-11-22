/**
 * Image validation from the bytes themselves — the browser-supplied MIME type is never trusted.
 * Detects JPEG / PNG / WebP by magic number and reads pixel dimensions from the headers.
 */
import { createHash } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_DIMENSION = 12_000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ImageInfo {
  mimeType: ImageMime;
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
}

export class ImageValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function sniffMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function pngSize(buf: Buffer) {
  // IHDR is always the first chunk: width/height big-endian at bytes 16..23.
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf: Buffer) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Standalone markers without a length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xda) return null; // start of scan before any frame header: malformed
    i += 2 + len;
  }
  return null;
}

function webpSize(buf: Buffer) {
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buf.length >= 30) {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    // Key frame start code 9d 01 2a at 23..25, then 14-bit width/height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

export function inspectImage(buf: Buffer): ImageInfo {
  if (!buf.length) throw new ImageValidationError('The upload was empty.');
  if (buf.length > MAX_UPLOAD_BYTES) throw new ImageValidationError(`Image too large — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, 413);
  const mimeType = sniffMime(buf);
  if (!mimeType) throw new ImageValidationError('Only JPEG, PNG or WebP images are supported (the file content is not a recognised image).', 415);
  const size = mimeType === 'image/png' ? pngSize(buf) : mimeType === 'image/jpeg' ? jpegSize(buf) : webpSize(buf);
  if (!size || size.width < 1 || size.height < 1) throw new ImageValidationError('Could not read the image dimensions — the file may be corrupt.');
  if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) throw new ImageValidationError(`Image dimensions exceed ${MAX_DIMENSION}px.`);
  return {
    mimeType,
    extension: mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp',
    width: size.width,
    height: size.height,
    byteSize: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}
