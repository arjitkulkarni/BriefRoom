import express, { type NextFunction, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES, templateFor } from '../shared/templates.ts';
import { PIN_KINDS, diffBriefs, type OrderView, type PinKind, type Role } from '../shared/types.ts';
import { HttpError, decide, propose, rid, roleFor, sanitizeSpec, toSummary, toView, assertEditable } from './brief.ts';
import { clientArea, createGroupChannel, issueAccessToken, nexconnConfigured, publicAppKey } from './nexconn.ts';
import { UPLOAD_DIR, db, persist, type OrderRecord, type ShopRecord } from './store.ts';

const app = express();
app.use(express.json({ limit: '12mb' }));

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num01 = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));
const route =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

function shopOr404(id: string): ShopRecord {
  const s = db.shops[id];
  if (!s) throw new HttpError(404, 'Shop not found');
  return s;
}
function orderOr404(id: string): OrderRecord {
  const o = db.orders[id];
  if (!o) throw new HttpError(404, 'Order not found');
  return o;
}
function authed(req: Request): { o: OrderRecord; role: Role } {
  const o = orderOr404(String(req.params.id));
  const role = roleFor(o, req.get('x-key'));
  if (!role) throw new HttpError(403, 'You do not have access to this brief');
  return { o, role };
}
const save = (o: OrderRecord, role: Role): OrderView => {
  o.updatedAt = Date.now();
  persist();
  return toView(o, role);
};

/* ------------------------------------------------------------------ config */

app.get('/api/config', (_req, res) => {
  res.json({ appKey: publicAppKey(), area: clientArea(), nexconnReady: nexconnConfigured(), publicUrl: process.env.PUBLIC_URL || '' });
});
app.get('/api/templates', (_req, res) => res.json({ templates: TEMPLATES }));

/* ------------------------------------------------------------------ shops */

app.post(
  '/api/shops',
  route(async (req, res) => {
    const name = str(req.body?.name, 60) || 'My Shop';
    const owner = str(req.body?.owner, 40) || 'Owner';
    const category = TEMPLATES[str(req.body?.category, 20)] ? str(req.body?.category, 20) : 'cake';
    const id = rid(4);
    const shop: ShopRecord = {
      id,
      name,
      owner,
      category,
      city: str(req.body?.city, 40),
      sellerUserId: `s${id}`,
      sellerKey: randomBytes(18).toString('base64url'),
      createdAt: Date.now(),
    };
    await issueAccessToken(shop.sellerUserId, `${owner} · ${name}`); // registers the seller with Nexconn
    db.shops[id] = shop;
    db.names[shop.sellerUserId] = `${owner} · ${name}`;
    persist();
    const { sellerKey, ...pub } = shop;
    res.json({ shop: pub, sellerKey });
  }),
);

app.get(
  '/api/shops/:id',
  route((req, res) => {
    const { sellerKey: _k, ...pub } = shopOr404(String(req.params.id));
    res.json({ shop: pub });
  }),
);

app.get(
  '/api/shops/:id/orders',
  route((req, res) => {
    const shop = shopOr404(String(req.params.id));
    if (req.get('x-key') !== shop.sellerKey) throw new HttpError(403, 'Seller key required');
    const orders = Object.values(db.orders)
      .filter((o) => o.shopId === shop.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toSummary);
    res.json({ orders });
  }),
);

/** Create an order. Seller-created (with seller key) or customer self-serve from the public shop page. */
app.post(
  '/api/shops/:id/orders',
  route(async (req, res) => {
    const shop = shopOr404(String(req.params.id));
    const bySeller = req.get('x-key') === shop.sellerKey;
    const template = TEMPLATES[str(req.body?.template, 20)] ? str(req.body?.template, 20) : shop.category;
    const customerName = str(req.body?.customerName, 40) || 'Customer';
    const t = templateFor(template);
    const id = rid(5);
    const order: OrderRecord = {
      id,
      shopId: shop.id,
      template,
      title: str(req.body?.title, 60) || `${t.name} for ${customerName}`,
      customerName,
      customerUserId: `c${id}`,
      customerKey: randomBytes(18).toString('base64url'),
      channelId: `o${id}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      draft: { refs: [], pins: [], spec: {} },
      versions: [],
      agreedVersion: null,
      pinCounter: 0,
    };
    db.names[order.customerUserId] = customerName;
    // Register the customer, then create the private order group (seller owns it).
    await issueAccessToken(order.customerUserId, customerName);
    await createGroupChannel(order.channelId, `${t.emoji} ${order.title}`, shop.sellerUserId, [order.customerUserId]);
    db.orders[id] = order;
    persist();
    res.json({ orderId: id, customerKey: order.customerKey, createdBy: bySeller ? 'seller' : 'customer' });
  }),
);

/* ------------------------------------------------------------------ orders */

app.get(
  '/api/orders/:id/meta',
  route((req, res) => {
    const o = orderOr404(String(req.params.id));
    res.json({ id: o.id, shopId: o.shopId, title: o.title, template: o.template, shopName: db.shops[o.shopId]?.name ?? '' });
  }),
);

app.get(
  '/api/orders/:id',
  route((req, res) => {
    const { o, role } = authed(req);
    db.visits.push({ orderId: o.id, role, at: Date.now() });
    if (db.visits.length > 20000) db.visits.splice(0, 5000);
    persist();
    res.json({ order: toView(o, role) });
  }),
);

app.post(
  '/api/orders/:id/refs',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    const url = str(req.body?.url, 2000);
    if (!/^(\/uploads\/[\w.-]+|https:\/\/\S+)$/.test(url)) throw new HttpError(400, 'Invalid image URL');
    if (o.draft.refs.length >= 12) throw new HttpError(400, 'Up to 12 reference images per brief');
    const ref = {
      id: rid(4),
      url,
      w: Math.round(Number(req.body?.w) || 0),
      h: Math.round(Number(req.body?.h) || 0),
      caption: str(req.body?.caption, 120),
      by: role,
      at: Date.now(),
      fromChat: Boolean(req.body?.fromChat),
    };
    o.draft.refs.push(ref);
    res.json({ order: save(o, role), ref });
  }),
);

app.delete(
  '/api/orders/:id/refs/:refId',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    o.draft.refs = o.draft.refs.filter((r) => r.id !== req.params.refId);
    o.draft.pins = o.draft.pins.filter((p) => p.refId !== req.params.refId);
    res.json({ order: save(o, role) });
  }),
);

app.post(
  '/api/orders/:id/pins',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    const ref = o.draft.refs.find((r) => r.id === req.body?.refId);
    if (!ref) throw new HttpError(400, 'Reference image not found');
    const kind = (str(req.body?.kind, 12) in PIN_KINDS ? str(req.body?.kind, 12) : 'change') as PinKind;
    const x = num01(req.body?.x);
    const y = num01(req.body?.y);
    const pin = {
      id: rid(4),
      n: ++o.pinCounter,
      refId: ref.id,
      x,
      y,
      w: Math.max(0.02, Math.min(1 - x, num01(req.body?.w))),
      h: Math.max(0.02, Math.min(1 - y, num01(req.body?.h))),
      kind,
      note: str(req.body?.note, 300),
      color: kind === 'colour' ? str(req.body?.color, 24) || undefined : undefined,
      by: role,
      at: Date.now(),
      resolved: false,
    };
    o.draft.pins.push(pin);
    res.json({ order: save(o, role), pin });
  }),
);

app.patch(
  '/api/orders/:id/pins/:pinId',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    const pin = o.draft.pins.find((p) => p.id === req.params.pinId);
    if (!pin) throw new HttpError(404, 'Pin not found');
    if (typeof req.body?.resolved === 'boolean') pin.resolved = req.body.resolved;
    if (typeof req.body?.note === 'string') pin.note = str(req.body.note, 300);
    res.json({ order: save(o, role), pin });
  }),
);

app.delete(
  '/api/orders/:id/pins/:pinId',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    o.draft.pins = o.draft.pins.filter((p) => p.id !== req.params.pinId);
    res.json({ order: save(o, role) });
  }),
);

app.patch(
  '/api/orders/:id/spec',
  route((req, res) => {
    const { o, role } = authed(req);
    assertEditable(o);
    const before = structuredClone(o.draft);
    Object.assign(o.draft.spec, sanitizeSpec(o, role, req.body?.spec ?? {}));
    const changes = diffBriefs(o.template, before, o.draft);
    res.json({ order: save(o, role), changes });
  }),
);

app.post(
  '/api/orders/:id/versions',
  route((req, res) => {
    const { o, role } = authed(req);
    const version = propose(o, role, str(req.body?.note, 300));
    res.json({ order: save(o, role), version });
  }),
);

app.post(
  '/api/orders/:id/versions/:n/decision',
  route((req, res) => {
    const { o, role } = authed(req);
    const decision = req.body?.decision === 'changes' ? 'changes' : 'approve';
    const result = decide(o, role, Number(req.params.n), decision, str(req.body?.reason, 500));
    res.json({ order: save(o, role), ...result });
  }),
);

app.post(
  '/api/orders/:id/reopen',
  route((req, res) => {
    const { o, role } = authed(req);
    if (role !== 'seller') throw new HttpError(403, 'Only the seller can reopen an agreed brief');
    o.agreedVersion = null;
    res.json({ order: save(o, role) });
  }),
);

/* ------------------------------------------------------------------ identity & Chat UI hooks */

app.post(
  '/api/token',
  route(async (req, res) => {
    const key = str(req.body?.key, 80);
    const shop = req.body?.shopId ? db.shops[str(req.body.shopId, 20)] : undefined;
    const order = req.body?.orderId ? db.orders[str(req.body.orderId, 20)] : undefined;
    let userId: string;
    let role: Role;
    if (shop && key === shop.sellerKey) {
      userId = shop.sellerUserId;
      role = 'seller';
    } else if (order) {
      const r = roleFor(order, key);
      if (!r) throw new HttpError(403, 'Invalid key');
      role = r;
      userId = r === 'seller' ? db.shops[order.shopId].sellerUserId : order.customerUserId;
    } else throw new HttpError(403, 'Invalid key');
    const token = await issueAccessToken(userId, db.names[userId] ?? 'User');
    res.json({ token, userId, role, name: db.names[userId] ?? 'User' });
  }),
);

app.get('/api/profiles', (req, res) => {
  const ids = String(req.query.ids ?? '').split(',').filter(Boolean).slice(0, 200);
  res.json({ profiles: ids.map((userId) => ({ userId, name: db.names[userId] ?? 'User' })) });
});

app.get('/api/groups', (req, res) => {
  const ids = String(req.query.ids ?? '').split(',').filter(Boolean).slice(0, 200);
  res.json({
    groups: ids.map((channelId) => {
      const o = db.orders[channelId.slice(1)];
      const t = templateFor(o?.template ?? 'cake');
      return { groupId: channelId, name: o ? `${t.emoji} ${o.customerName} · ${o.title}` : 'Order', memberCount: 2 };
    }),
  });
});

app.get('/api/groups/:channelId/members', (req, res) => {
  const o = db.orders[String(req.params.channelId).slice(1)];
  if (!o) return void res.json({ members: [] });
  res.json({ members: [{ userId: db.shops[o.shopId]?.sellerUserId }, { userId: o.customerUserId }].filter((m) => m.userId) });
});

/* ------------------------------------------------------------------ uploads */

function keyIsValid(key: string | undefined): boolean {
  if (!key) return false;
  return Object.values(db.shops).some((s) => s.sellerKey === key) || Object.values(db.orders).some((o) => o.customerKey === key);
}

app.post(
  '/api/uploads',
  route((req, res) => {
    if (!keyIsValid(req.get('x-key'))) throw new HttpError(403, 'Not allowed');
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl ?? ''));
    if (!m) throw new HttpError(400, 'Send a JPEG, PNG or WebP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 6 * 1024 * 1024) throw new HttpError(413, 'Image too large (max 6 MB)');
    const file = `${Date.now().toString(36)}${rid(8)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    writeFileSync(join(UPLOAD_DIR, file), buf);
    res.json({ url: `/uploads/${file}` });
  }),
);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

/* ------------------------------------------------------------------ stats (traction proof) */

app.get('/api/stats', (_req, res) => {
  const orders = Object.values(db.orders);
  res.json({
    shops: Object.keys(db.shops).length,
    orders: orders.length,
    agreed: orders.filter((o) => o.agreedVersion !== null).length,
    versions: orders.reduce((n, o) => n + o.versions.length, 0),
    pins: orders.reduce((n, o) => n + o.draft.pins.length, 0),
    references: orders.reduce((n, o) => n + o.draft.refs.length, 0),
    nexconnUsers: Object.keys(db.shops).length + orders.length,
  });
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ------------------------------------------------------------------ static app */

const dist = join(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api/') ? res.sendFile(join(dist, 'index.html')) : next()));
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[api]', err?.message ?? err);
  res.status(status).json({ error: err?.message ?? 'Server error' });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`BriefRoom API on http://localhost:${port}`);
  if (!nexconnConfigured()) console.warn('!! Set NEXCONN_APP_KEY / NEXCONN_APP_SECRET in .env (see .env.example)');
});
