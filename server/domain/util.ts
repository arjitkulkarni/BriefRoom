import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { canonicalJSON, type BriefSnapshot } from '../../shared/snapshot.ts';

/** Random hex ids — letters + digits only, as Nexconn user/channel IDs require. */
export const rid = (bytes = 6) => randomBytes(bytes).toString('hex');
export const secretKey = () => randomBytes(18).toString('base64url');
export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export const hashKey = (key: string) => sha256(`briefroom-key:${key}`);
export const ms = (d: Date | null | undefined) => (d ? d.getTime() : null);
export const msReq = (d: Date) => d.getTime();

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** SHA-256 fingerprint of a version snapshot (hex). */
export const hashSnapshot = (s: BriefSnapshot) => sha256(canonicalJSON(s));

/** Capability URLs for reference images: knowing the URL grants that one image, nothing else. */
export function createAssetSigner(secret: string) {
  const sign = (refId: string) => createHmac('sha256', secret).update(`asset:${refId}`).digest('base64url').slice(0, 32);
  return {
    url: (refId: string) => `/api/assets/${refId}?sig=${sign(refId)}`,
    verify: (refId: string, sig: string) => typeof sig === 'string' && safeEqual(sign(refId), sig),
  };
}
export type AssetSigner = ReturnType<typeof createAssetSigner>;

export const clampText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
