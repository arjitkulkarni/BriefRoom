/**
 * Test harness: real Postgres engine (PGlite, in-memory) + the real versioned migrations +
 * the real HTTP app. Nexconn is replaced by a recording FAKE — tests using it prove our
 * outbox/idempotency logic, NOT the live Nexconn integration.
 */
import { createServer, type Server } from 'node:http';
import { Readable } from 'node:stream';
import { deflateSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.ts';
import type { AppConfig } from '../server/config.ts';
import { connectPglite } from '../server/db/client.ts';
import { createContext } from '../server/context.ts';
import { NexconnError, NEXCONN_CODES, type NexconnServerApi } from '../server/nexconn/client.ts';
import type { ImageStorageProvider } from '../server/storage/provider.ts';

/* ------------------------------------------------------------------ images */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A real, decodable RGB PNG of the given size filled with one colour. */
export function makePng(width: number, height: number, rgb: [number, number, number] = [240, 200, 210]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** Minimal JPEG header (SOI, APP0, SOF0) — enough for dimension parsing. */
export function makeJpegHeader(width: number, height: number) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}
/** Minimal lossless WebP header (VP8L) — enough for dimension parsing. */
export function makeWebpHeader(width: number, height: number) {
  const bits = (width - 1) | ((height - 1) << 14);
  const vp8l = Buffer.alloc(5);
  vp8l[0] = 0x2f;
  vp8l.writeUInt32LE(bits >>> 0, 1);
  const body = Buffer.concat([Buffer.from('WEBPVP8L', 'ascii'), Buffer.from([vp8l.length, 0, 0, 0]), vp8l]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), size, body]);
}

/* ------------------------------------------------------------------ fakes */

export function memoryStorage(): ImageStorageProvider & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    name: 'local',
    objects,
    async put(key, body) {
      objects.set(key, body);
    },
    async open(key) {
      const b = objects.get(key);
      return b ? { stream: Readable.from(b), contentType: 'image/png', size: b.length } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async healthCheck() {
      return { ok: true, detail: 'memory', ms: 0 };
    },
  };
}

export interface FakeNexconn extends NexconnServerApi {
  calls: { op: string; args: Record<string, unknown> }[];
  groups: Set<string>;
  failNextSends: number;
}
export function fakeNexconn(enabled = true): FakeNexconn {
  const fake: FakeNexconn = {
    enabled,
    calls: [],
    groups: new Set(),
    failNextSends: 0,
    async issueAccessToken(userId, name) {
      fake.calls.push({ op: 'token', args: { userId, name } });
      return `token-${userId}`;
    },
    async createGroupChannel(input) {
      fake.calls.push({ op: 'createGroup', args: input });
      if (fake.groups.has(input.channelId)) return 'exists';
      fake.groups.add(input.channelId);
      return 'created';
    },
    async sendGroupMessage(input) {
      fake.calls.push({ op: 'send', args: input });
      if (fake.failNextSends > 0) {
        fake.failNextSends--;
        throw new NexconnError('simulated outage', 500, 503);
      }
      if (!fake.groups.has(input.channelId)) throw new NexconnError('group missing', NEXCONN_CODES.GROUP_NOT_FOUND, 200, true);
      return `msg-${fake.calls.length}`;
    },
  };
  return fake;
}

/* ------------------------------------------------------------------ context + server */

export function testConfig(over: Partial<AppConfig> = {}): AppConfig {
  return {
    env: 'test',
    port: 0,
    publicUrl: 'http://localhost',
    dataDir: '.',
    sessionSecret: 'test-secret-test-secret-test-secret-1234',
    database: { url: null, migrationUrl: null, embeddedDir: '' },
    nexconn: { enabled: true, environment: 'development', appKey: 'test-key', appSecret: 'test-secret', region: 'sg', apiHosts: ['a.example', 'b.example'], areaCode: 2 },
    storage: { provider: 'local', uploadsDir: '.', s3: null },
    ai: { provider: 'rules', chain: [] },
    ...over,
  };
}

/** `nexconn` swaps in a real client (live tests); `t.nexconn` stays the recording fake for the offline tests. */
export async function createTestApp(opts: { nexconnEnabled?: boolean; autoDispatch?: boolean; nexconn?: NexconnServerApi } = {}) {
  const dbh = await connectPglite(null);
  await dbh.migrate();
  const nexconn = fakeNexconn(opts.nexconnEnabled ?? true);
  const storage = memoryStorage();
  const config = testConfig();
  const client = opts.nexconn ?? nexconn;
  config.nexconn.enabled = client.enabled;
  const ctx = createContext(config, dbh, { nexconn: client, storage, autoDispatch: opts.autoDispatch });
  const app = createApp(ctx);
  const server: Server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call<T = any>(method: string, path: string, opts2: { key?: string; body?: unknown; raw?: Buffer; headers?: Record<string, string> } = {}): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { ...(opts2.headers ?? {}) };
    if (opts2.key) headers['x-key'] = opts2.key;
    let body: BodyInit | undefined;
    if (opts2.raw) {
      headers['content-type'] = 'application/octet-stream';
      body = new Uint8Array(opts2.raw);
    } else if (opts2.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts2.body);
    }
    const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    const text = await res.text();
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* raw */
    }
    return { status: res.status, body: json as T };
  }

  return {
    ctx,
    dbh,
    nexconn,
    storage,
    base,
    call,
    async close() {
      ctx.outbox.stop();
      await new Promise((r) => server.close(r));
      await dbh.close();
    },
  };
}

/** Seller shop + one order, returning both keys. */
export async function seedOrder(t: Awaited<ReturnType<typeof createTestApp>>, template = 'cake') {
  const shop = await t.call('POST', '/api/shops', { body: { name: 'Sugar & Sprinkles', ownerName: 'Neha', category: template, city: 'Pune' } });
  const sellerKey = shop.body.sellerKey as string;
  const order = await t.call('POST', `/api/shops/${shop.body.shop.id}/orders`, { key: sellerKey, body: { customerName: 'Priya', template, title: "Aditi's 25th birthday cake" } });
  return { shopId: shop.body.shop.id as string, sellerKey, orderId: order.body.orderId as string, customerKey: order.body.customerKey as string };
}

/** Fill every required cake field (price via the seller). */
export async function completeCakeSpec(t: Awaited<ReturnType<typeof createTestApp>>, o: Awaited<ReturnType<typeof seedOrder>>, extra: Record<string, unknown> = {}) {
  await t.call('PATCH', `/api/orders/${o.orderId}/spec`, {
    key: o.customerKey,
    body: { spec: { weight: '1.5 kg', shape: 'Round', flavour: 'Vanilla', deliveryDate: '2099-12-01', timeSlot: 'Evening (4–8)', fulfilment: 'Pickup', ...extra } },
  });
  return t.call('PATCH', `/api/orders/${o.orderId}/spec`, { key: o.sellerKey, body: { spec: { price: 1850 } } });
}
