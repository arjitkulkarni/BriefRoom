/**
 * ImageStorageProvider — image bytes live in object storage, never in Postgres.
 * Postgres keeps the key, MIME type, dimensions, content hash and ownership.
 *
 *  - s3:    Neon Object Storage (S3-compatible, private bucket, path-style addressing, SigV4).
 *           Reads are served through short-lived presigned GET URLs.
 *  - local: files under UPLOADS_DIR (development, or a single instance with a persistent disk).
 */
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../config.ts';

export interface StoredObject {
  stream: Readable;
  contentType: string;
  size: number;
}

export interface ImageStorageProvider {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Presigned URL for direct reads (s3 only). */
  presignedGetUrl?(key: string, expiresInSeconds: number): Promise<string>;
  /** Stream an object through the app server (local only). */
  open?(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Round-trip check used by /api/health?deep=1. */
  healthCheck(): Promise<{ ok: boolean; detail: string; ms: number }>;
}

const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', txt: 'text/plain' };

class LocalStorage implements ImageStorageProvider {
  readonly name = 'local' as const;
  constructor(private readonly root: string) {
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
  }
  private path(key: string) {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(normalize(this.root) + sep)) throw new Error('Invalid storage key');
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.path(key);
    mkdirSync(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async open(key: string): Promise<StoredObject | null> {
    const p = this.path(key);
    try {
      const s = await stat(p);
      return { stream: createReadStream(p), contentType: CONTENT_TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream', size: s.size };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
  async healthCheck() {
    const t0 = performance.now();
    const key = `_health/${Date.now()}.txt`;
    try {
      await this.put(key, Buffer.from('ok'));
      await this.delete(key);
      return { ok: true, detail: `local disk ${this.root}`, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, detail: (e as Error).message, ms: Math.round(performance.now() - t0) };
    }
  }
}

class S3Storage implements ImageStorageProvider {
  readonly name = 's3' as const;
  private clientP: Promise<import('@aws-sdk/client-s3').S3Client>;
  constructor(private readonly cfg: NonNullable<AppConfig['storage']['s3']>) {
    this.clientP = import('@aws-sdk/client-s3').then(
      ({ S3Client }) =>
        new S3Client({
          endpoint: cfg.endpoint,
          region: cfg.region,
          credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
          forcePathStyle: true, // required by Neon Object Storage
        }),
    );
  }
  async put(key: string, body: Buffer, contentType: string) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    // Keys are content-addressed and never overwritten, so cached copies can be immutable.
    await (await this.clientP).send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' }));
  }
  async presignedGetUrl(key: string, expiresInSeconds: number) {
    const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([import('@aws-sdk/client-s3'), import('@aws-sdk/s3-request-presigner')]);
    return getSignedUrl(await this.clientP, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }
  async delete(key: string) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.clientP).send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
  async healthCheck() {
    const t0 = performance.now();
    const key = `_health/${Date.now()}.txt`;
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      await this.put(key, Buffer.from('ok'), 'text/plain');
      const res = await (await this.clientP).send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      const text = await res.Body?.transformToString();
      await this.delete(key);
      if (text !== 'ok') throw new Error('read-back mismatch');
      return { ok: true, detail: `bucket "${this.cfg.bucket}" @ ${new URL(this.cfg.endpoint).host}`, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, detail: (e as Error).message, ms: Math.round(performance.now() - t0) };
    }
  }
}

export function createStorage(config: AppConfig): ImageStorageProvider {
  if (config.storage.provider === 's3' && config.storage.s3) return new S3Storage(config.storage.s3);
  return new LocalStorage(config.storage.uploadsDir);
}

/** Content-addressed object key: orders/<orderId>/<refId>-<sha16>.<ext> */
export const referenceKey = (orderId: string, refId: string, sha256: string, ext: string) => `orders/${orderId}/${refId}-${sha256.slice(0, 16)}.${ext}`;
