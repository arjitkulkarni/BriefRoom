/**
 * Express application factory. All routes are thin: parse/validate input, resolve access,
 * call a domain command, return the fresh authoritative order view.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { and, count, eq, inArray } from 'drizzle-orm';
import { TEMPLATES } from '../shared/templates.ts';
import type { PublicConfig, Role } from '../shared/types.ts';
import type { AppConfig } from './config.ts';
import type { DbHandle } from './db/client.ts';
import { annotations, briefVersions, domainEvents, orders, participants, referenceImages, shops } from './db/schema.ts';
import type { Commands } from './domain/commands.ts';
import type { CoreService, OrderAccess } from './domain/service.ts';
import { HttpError, route } from './http/errors.ts';
import { NexconnError } from './nexconn/client.ts';
import type { createChannelManager, createOutbox } from './nexconn/outbox.ts';
import { ImageValidationError, MAX_UPLOAD_BYTES } from './storage/image.ts';

export interface AppDeps {
  config: AppConfig;
  dbh: DbHandle;
  core: CoreService;
  commands: Commands;
  channels: ReturnType<typeof createChannelManager>;
  outbox: ReturnType<typeof createOutbox>;
  startedAt: number;
}

const key = (req: Request) => req.get('x-key') ?? undefined;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function createApp(deps: AppDeps) {
  const { config, dbh, core, commands, channels, outbox } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', express.json({ limit: '256kb' }));

  const access = (req: Request) => core.orderAccess(String(req.params.id), key(req));
  const view = (a: OrderAccess) => core.getOrderView({ order: a.order, role: a.role });
  /** Run a command, then answer with the fresh authoritative view. */
  const act = async <T>(req: Request, res: Response, fn: (a: OrderAccess) => Promise<T>) => {
    const a = await access(req);
    const result = await fn(a);
    res.json({ result, order: await view(a) });
  };

  /* ------------------------------------------------------------ meta */

  app.get('/api/config', (_req, res) => {
    const body: PublicConfig = {
      nexconn: { enabled: config.nexconn.enabled, appKey: config.nexconn.enabled ? config.nexconn.appKey : '', areaCode: config.nexconn.areaCode, environment: config.nexconn.environment, region: config.nexconn.region },
      ai: { provider: config.ai.provider },
      storage: config.storage.provider,
      publicUrl: config.env === 'production' ? config.publicUrl : '',
    };
    res.json(body);
  });
  app.get('/api/templates', (_req, res) => res.json({ templates: TEMPLATES }));

  app.get(
    '/api/health',
    route(async (req, res) => {
      const base = { ok: true, uptimeSeconds: Math.round((Date.now() - deps.startedAt) / 1000), database: dbh.kind };
      if (req.query.deep !== '1') return void res.json(base);
      const checks: Record<string, unknown> = {};
      try {
        checks.database = { ok: true, kind: dbh.kind, pingMs: await dbh.ping(), pendingMigrations: await dbh.pendingMigrations() };
      } catch (e) {
        checks.database = { ok: false, error: (e as Error).message };
      }
      checks.storage = await core.storage.healthCheck();
      checks.nexconn = { enabled: config.nexconn.enabled, environment: config.nexconn.environment, region: config.nexconn.region, outbox: outbox.stats };
      checks.ai = { provider: config.ai.provider, chain: config.ai.chain.map((p) => ({ provider: p.id, model: p.model })) };
      const ok = (checks.database as { ok: boolean }).ok && (checks.storage as { ok: boolean }).ok;
      res.status(ok ? 200 : 503).json({ ...base, ok, checks });
    }),
  );

  /* ------------------------------------------------------------ shops */

  app.post(
    '/api/shops',
    route(async (req, res) => {
      const r = await core.createShop({ name: str(req.body?.name), ownerName: str(req.body?.ownerName ?? req.body?.owner), category: str(req.body?.category), city: str(req.body?.city) });
      res.status(201).json(r);
    }),
  );
  app.get(
    '/api/shops/:id',
    route(async (req, res) => res.json({ shop: await core.getShop(String(req.params.id)) })),
  );
  app.get(
    '/api/shops/:id/orders',
    route(async (req, res) => {
      const shop = await core.sellerAccess(String(req.params.id), key(req));
      res.json({ orders: await core.listShopOrders(shop.id) });
    }),
  );
  app.get(
    '/api/shops/:id/activity',
    route(async (req, res) => {
      const shop = await core.sellerAccess(String(req.params.id), key(req));
      res.json({ activity: await core.shopActivity(shop.id) });
    }),
  );
  app.post(
    '/api/shops/:id/orders',
    route(async (req, res) => {
      const shopId = String(req.params.id);
      let createdBy: Role = 'customer';
      if (key(req)) {
        await core.sellerAccess(shopId, key(req));
        createdBy = 'seller';
      }
      const r = await core.createOrder(shopId, { customerName: str(req.body?.customerName), template: str(req.body?.template), title: str(req.body?.title), creationKey: req.get('idempotency-key') ?? undefined }, createdBy);
      res.status(r.replayed ? 200 : 201).json(r);
    }),
  );

  /* ------------------------------------------------------------ orders */

  app.get(
    '/api/orders/:id/meta',
    route(async (req, res) => res.json(await core.orderMeta(String(req.params.id)))),
  );
  app.get(
    '/api/orders/:id',
    route(async (req, res) => {
      const a = await access(req);
      res.json({ order: await view(a) });
    }),
  );

  app.post(
    '/api/orders/:id/references',
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES + 1024 }),
    route((req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Send the image bytes as the request body.');
      return act(req, res, (a) => commands.addReference(a, req.body as Buffer, str(req.query.caption)));
    }),
  );
  app.post(
    '/api/orders/:id/references/import',
    route((req, res) => act(req, res, (a) => commands.importReference(a, str(req.body?.url)))),
  );
  app.delete(
    '/api/orders/:id/references/:refId',
    route((req, res) => act(req, res, (a) => commands.removeReference(a, String(req.params.refId)))),
  );

  app.post(
    '/api/orders/:id/annotations',
    route((req, res) =>
      act(req, res, (a) =>
        commands.createAnnotation(a, {
          referenceId: str(req.body?.referenceId),
          kind: str(req.body?.kind),
          note: str(req.body?.note),
          color: req.body?.color ?? null,
          shape: str(req.body?.shape),
          x: req.body?.x,
          y: req.body?.y,
          w: req.body?.w,
          h: req.body?.h,
        }),
      ),
    ),
  );
  app.patch(
    '/api/orders/:id/annotations/:annId',
    route((req, res) => act(req, res, (a) => commands.updateAnnotation(a, String(req.params.annId), req.body ?? {}))),
  );
  app.delete(
    '/api/orders/:id/annotations/:annId',
    route((req, res) => act(req, res, (a) => commands.deleteAnnotation(a, String(req.params.annId)))),
  );
  app.post(
    '/api/orders/:id/annotations/:annId/comments',
    route((req, res) => act(req, res, (a) => commands.commentAnnotation(a, String(req.params.annId), str(req.body?.body)))),
  );
  app.post(
    '/api/orders/:id/annotations/:annId/resolution',
    route((req, res) => {
      const action = str(req.body?.action);
      if (!['request', 'confirm', 'cancel', 'reopen'].includes(action)) throw new HttpError(400, 'action must be request, confirm, cancel or reopen');
      return act(req, res, (a) => commands.annotationResolution(a, String(req.params.annId), action as 'request'));
    }),
  );

  app.post(
    '/api/orders/:id/clarifications',
    route((req, res) =>
      act(req, res, (a) =>
        commands.raiseClarification(a, {
          title: str(req.body?.title),
          description: str(req.body?.description),
          critical: req.body?.critical === true,
          annotationId: str(req.body?.annotationId) || null,
          messageId: str(req.body?.messageId) || null,
          evidence: str(req.body?.evidence),
        }),
      ),
    ),
  );
  app.post(
    '/api/orders/:id/clarifications/:cid/comments',
    route((req, res) => act(req, res, (a) => commands.commentClarification(a, String(req.params.cid), str(req.body?.body)))),
  );
  app.patch(
    '/api/orders/:id/clarifications/:cid',
    route((req, res) => {
      const action = str(req.body?.action);
      if (!['resolve', 'reopen', 'set_critical'].includes(action)) throw new HttpError(400, 'action must be resolve, reopen or set_critical');
      return act(req, res, (a) => commands.updateClarification(a, String(req.params.cid), { action: action as 'resolve', resolution: str(req.body?.resolution), critical: req.body?.critical === true }));
    }),
  );

  app.patch(
    '/api/orders/:id/spec',
    route((req, res) => act(req, res, (a) => commands.updateSpec(a, (req.body?.spec ?? {}) as Record<string, unknown>))),
  );

  app.post(
    '/api/orders/:id/analysis',
    route((req, res) => {
      const messages = Array.isArray(req.body?.messages) ? (req.body.messages as { id: unknown; text: unknown }[]).map((m) => ({ id: str(m?.id), text: str(m?.text) })).filter((m) => m.id && m.text) : [];
      return act(req, res, (a) => commands.analyse(a, messages));
    }),
  );
  app.patch(
    '/api/orders/:id/suggestions/:sid',
    route((req, res) => {
      const action = str(req.body?.action);
      if (action !== 'ask' && action !== 'dismiss') throw new HttpError(400, 'action must be ask or dismiss');
      return act(req, res, (a) => commands.suggestionAction(a, String(req.params.sid), { action, question: str(req.body?.question), critical: typeof req.body?.critical === 'boolean' ? req.body.critical : undefined }));
    }),
  );

  app.post(
    '/api/orders/:id/versions',
    route((req, res) => act(req, res, (a) => commands.proposeVersion(a, str(req.body?.note)))),
  );
  app.post(
    '/api/orders/:id/versions/:versionId/decision',
    route((req, res) => {
      const decision = str(req.body?.decision);
      if (decision !== 'approved' && decision !== 'changes_requested') throw new HttpError(400, 'decision must be approved or changes_requested');
      return act(req, res, (a) =>
        commands.decideVersion(a, String(req.params.versionId), { decision, snapshotHash: str(req.body?.snapshotHash), reason: str(req.body?.reason), idempotencyKey: req.get('idempotency-key') ?? str(req.body?.idempotencyKey) }),
      );
    }),
  );
  app.post(
    '/api/orders/:id/reopen',
    route((req, res) => act(req, res, (a) => commands.reopenOrder(a))),
  );
  app.post(
    '/api/orders/:id/complete',
    route((req, res) => act(req, res, (a) => commands.completeOrder(a))),
  );

  /* ------------------------------------------------------------ Nexconn identity + Chat UI hooks */

  app.post(
    '/api/nexconn/token',
    route(async (req, res) => {
      if (!config.nexconn.enabled) throw new HttpError(503, 'Nexconn is not configured on the server. Add the Nexconn App Key/Secret for this environment and NEXCONN_REGION.');
      const refresh = req.body?.refresh === true;
      let userId: string;
      let name: string;
      let channelId: string | null = null;
      if (req.body?.orderId) {
        const a = await core.orderAccess(str(req.body.orderId), key(req));
        const [p] = await core.db.select().from(participants).where(and(eq(participants.orderId, a.order.id), eq(participants.role, a.role)));
        userId = p.nexconnUserId;
        name = p.displayName;
        const ch = await channels.ensureChannel(a.order.id);
        channelId = ch.channelId;
        if (!ch.ready) throw new HttpError(502, `The order's Nexconn group could not be created yet: ${ch.error}`);
      } else if (req.body?.shopId) {
        const shop = await core.sellerAccess(str(req.body.shopId), key(req));
        userId = shop.sellerUserId;
        name = `${shop.ownerName} · ${shop.name}`;
      } else throw new HttpError(400, 'orderId or shopId is required');
      if (refresh) core.tokenCache.delete(userId);
      const token = await channels.registerUser(userId, name);
      res.json({ token, userId, name, channelId });
    }),
  );

  /** Chat UI ServiceHooks for the seller inbox — only users/groups of the caller's own shop. */
  async function sellerScope(req: Request) {
    const shop = await core.sellerAccess(str(req.query.shopId), key(req));
    const shopOrders = await core.db.select({ id: orders.id, title: orders.title }).from(orders).where(eq(orders.shopId, shop.id));
    return { shop, shopOrders };
  }
  app.get(
    '/api/nexconn/profiles',
    route(async (req, res) => {
      const { shop, shopOrders } = await sellerScope(req);
      const ids = str(req.query.ids).split(',').filter(Boolean).slice(0, 200);
      const people = shopOrders.length ? await core.db.select().from(participants).where(and(inArray(participants.orderId, shopOrders.map((o) => o.id)), inArray(participants.nexconnUserId, ids.length ? ids : ['-']))) : [];
      res.json({ profiles: ids.map((userId) => ({ userId, name: userId === shop.sellerUserId ? `${shop.ownerName} · ${shop.name}` : (people.find((p) => p.nexconnUserId === userId)?.displayName ?? 'Customer') })) });
    }),
  );
  app.get(
    '/api/nexconn/groups',
    route(async (req, res) => {
      const { shopOrders } = await sellerScope(req);
      const ids = str(req.query.ids).split(',').filter(Boolean).slice(0, 200);
      res.json({ groups: ids.map((groupId) => ({ groupId, name: shopOrders.find((o) => `o${o.id}` === groupId)?.title ?? 'Order', memberCount: 2 })) });
    }),
  );
  app.get(
    '/api/nexconn/groups/:channelId/members',
    route(async (req, res) => {
      const { shopOrders } = await sellerScope(req);
      const o = shopOrders.find((x) => `o${x.id}` === String(req.params.channelId));
      if (!o) return void res.json({ members: [] });
      const people = await core.db.select().from(participants).where(eq(participants.orderId, o.id));
      res.json({ members: people.map((p) => ({ userId: p.nexconnUserId })) });
    }),
  );

  /* ------------------------------------------------------------ assets (signed capability URLs) */

  app.get(
    '/api/assets/:refId',
    route(async (req, res) => {
      const refId = String(req.params.refId);
      if (!core.signer.verify(refId, str(req.query.sig))) throw new HttpError(403, 'Invalid image link');
      const [ref] = await core.db.select().from(referenceImages).where(eq(referenceImages.id, refId));
      if (!ref) throw new HttpError(404, 'Image not found');
      if (ref.storageProvider === 's3' && core.storage.presignedGetUrl) {
        const url = await core.storage.presignedGetUrl(ref.storageKey, 3600);
        res.setHeader('Cache-Control', 'private, max-age=1800');
        return void res.redirect(302, url);
      }
      const obj = core.storage.open ? await core.storage.open(ref.storageKey) : null;
      if (!obj) throw new HttpError(404, 'Image file missing from storage');
      res.setHeader('Content-Type', ref.mimeType);
      res.setHeader('Content-Length', String(obj.size));
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      obj.stream.pipe(res);
    }),
  );

  /* ------------------------------------------------------------ public usage numbers */

  app.get(
    '/api/stats',
    route(async (_req, res) => {
      const [[s], [o], [agreed], [v], [ann], [refs], [sent]] = await Promise.all([
        core.db.select({ n: count() }).from(shops),
        core.db.select({ n: count() }).from(orders),
        core.db.select({ n: count() }).from(orders).where(inArray(orders.status, ['agreed', 'completed'])),
        core.db.select({ n: count() }).from(briefVersions),
        core.db.select({ n: count() }).from(annotations),
        core.db.select({ n: count() }).from(referenceImages),
        core.db.select({ n: count() }).from(domainEvents).where(eq(domainEvents.nexconnStatus, 'sent')),
      ]);
      res.json({ shops: s.n, orders: o.n, agreed: agreed.n, versions: v.n, annotations: ann.n, references: refs.n, nexconnEventsDelivered: sent.n });
    }),
  );

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  /* ------------------------------------------------------------ SPA */

  const dist = join(process.cwd(), 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, path) => path.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
    app.use((req, res, next) => (req.method === 'GET' ? res.setHeader('Cache-Control', 'no-cache').sendFile(join(dist, 'index.html')) : next()));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let message = 'Something went wrong on our side.';
    let details: Record<string, unknown> | undefined;
    if (err instanceof HttpError) {
      status = err.status;
      message = err.message;
      details = err.details;
    } else if (err instanceof ImageValidationError) {
      status = err.status;
      message = err.message;
    } else if (err instanceof NexconnError) {
      status = 502;
      message = `Nexconn error: ${err.message}`;
    } else if ((err as { type?: string })?.type === 'entity.too.large') {
      status = 413;
      message = 'Upload too large.';
    } else if ((err as { type?: string })?.type === 'entity.parse.failed') {
      status = 400;
      message = 'Malformed JSON body.';
    }
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({ error: message, ...(details ? { details } : {}) });
  });

  return app;
}
