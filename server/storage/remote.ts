/**
 * Server-side import of an image that was shared in the chat ("Add to brief").
 * SSRF guard: https only, every hop's host must resolve to public addresses, limited
 * redirects, size and time limits. The bytes then go through the normal image validation.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ImageValidationError, MAX_UPLOAD_BYTES } from './image.ts';

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'https:') throw new ImageValidationError('Only https image links can be added to the brief.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new ImageValidationError('Could not resolve the image host.');
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new ImageValidationError('That image host is not allowed.');
}

export async function fetchRemoteImage(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImageValidationError('Invalid image URL.');
  }
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { accept: 'image/*' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok || !res.body) throw new ImageValidationError(`Could not download the image (HTTP ${res.status}).`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_UPLOAD_BYTES) throw new ImageValidationError('Image too large.', 413);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) throw new ImageValidationError('Image too large.', 413);
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new ImageValidationError('Too many redirects.');
}
