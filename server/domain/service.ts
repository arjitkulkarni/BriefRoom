/**
 * BriefRoom domain service — the authoritative state machine.
 *
 * Every mutation runs in ONE database transaction that:
 *   1. locks the order row (SELECT … FOR UPDATE) — serialises all writes to an order,
 *   2. applies the change,
 *   3. recomputes the order status,
 *   4. appends a validated domain event (which doubles as the Nexconn outbox entry),
 *   5. bumps the order revision.
 * After commit, the outbox dispatcher publishes the event to the order's Nexconn group.
 */
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { EVENT_TO_MESSAGE, type BrPayload } from '../../shared/messages.ts';
import { roundCoord, truncate } from '../../shared/snapshot.ts';
import { TEMPLATES, templateFor } from '../../shared/templates.ts';
import {
  ANNOTATION_KINDS,
  type AnnotationKind,
  type DomainEventType,
  type OrderStatus,
  type OrderSummary,
  type OrderView,
  type Role,
  type ShopPublic,
  type Spec,
  type SpecValue,
} from '../../shared/types.ts';
import type { AppConfig } from '../config.ts';
import type { Db, Executor, Tx } from '../db/client.ts';
import {
  annotations,
  approvals,
  briefVersions,
  clarifications,
  comments,
  domainEvents,
  nexconnChannels,
  orders,
  participants,
  referenceImages,
  shops,
  specifications,
  suggestions,
} from '../db/schema.ts';
import { HttpError } from '../http/errors.ts';
import type { NexconnServerApi } from '../nexconn/client.ts';
import type { ImageStorageProvider } from '../storage/provider.ts';
import { clampText, hashKey, hashSnapshot, rid, safeEqual, secretKey, type AssetSigner, ms, msReq } from './util.ts';
import {
  activityView,
  annotationView,
  buildSnapshot,
  clarificationView,
  commentView,
  computeBlockers,
  eventSummary,
  referenceView,
  specFromRows,
  suggestionView,
  versionViews,
  type OrderRow,
} from './views.ts';

export interface Deps {
  db: Db;
  storage: ImageStorageProvider;
  signer: AssetSigner;
  config: AppConfig;
  nexconn: NexconnServerApi;
  /** Called after every committed mutation (wakes the outbox dispatcher). */
  onCommit: () => void;
}

export interface OrderAccess {
  order: OrderRow;
  role: Role;
}

type Names = Record<Role, string>;
interface MutCtx {
  tx: Tx;
  order: OrderRow;
  role: Role;
  names: Names;
  emit: (type: DomainEventType, entity: { type: string; id: string; versionId?: string | null }, data: Record<string, unknown>, extra?: Partial<BrPayload>) => Promise<string>;
}

const PayloadSchema = z.object({
  v: z.literal(1),
  eventId: z.string(),
  eventType: z.string(),
  orderId: z.string(),
  actor: z.object({ role: z.enum(['seller', 'customer', 'system']), name: z.string() }),
  at: z.number(),
  summary: z.string().max(400),
  focus: z.object({ kind: z.enum(['annotation', 'reference', 'clarification', 'version', 'spec', 'order']), id: z.string(), number: z.number().optional() }).optional(),
  crop: z.object({ imageUrl: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  lines: z.array(z.string().max(200)).max(12).optional(),
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  versionNumber: z.number().int().optional(),
  decision: z.enum(['approved', 'changes_requested']).optional(),
  annotation: z.object({ kind: z.string(), note: z.string(), color: z.string().nullable(), status: z.string() }).optional(),
});

const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOUR_KINDS = new Set<AnnotationKind>(['colour', 'change', 'add', 'custom']);

export function createBriefService(deps: Deps) {
  const { db, storage, signer, config, nexconn } = deps;
  const tokenCache = new Map<string, string>();

  /* ================================================================== helpers */

  async function participantNames(ex: Executor, orderId: string): Promise<Names> {
    const rows = await ex.select().from(participants).where(eq(participants.orderId, orderId));
    const names: Names = { seller: 'Seller', customer: 'Customer' };
    for (const p of rows) names[p.role as Role] = p.displayName;
    return names;
  }

  async function emit(tx: Tx, order: OrderRow, role: Role | 'system', names: Names, type: DomainEventType, entity: { type: string; id: string; versionId?: string | null }, data: Record<string, unknown>, extra: Partial<BrPayload> = {}) {
    const id = crypto.randomUUID();
    const actorName = role === 'system' ? 'BriefRoom' : names[role];
    const payload = PayloadSchema.parse({ v: 1, eventId: id, eventType: type, orderId: order.id, actor: { role, name: actorName }, at: Date.now(), summary: truncate(eventSummary(type, actorName, data), 400), ...extra });
    await tx.insert(domainEvents).values({
      id,
      orderId: order.id,
      type,
      actorRole: role,
      entityType: entity.type,
      entityId: entity.id,
      versionId: entity.versionId ?? null,
      payload,
      nexconnStatus: nexconn.enabled ? 'pending' : 'skipped',
      nexconnMessageType: EVENT_TO_MESSAGE[type],
      nexconnLastError: nexconn.enabled ? null : 'Nexconn not configured on the server',
    });
    return id;
  }

  async function loadDraftParts(ex: Executor, orderId: string) {
    const [refs, anns, specRows, clars] = await Promise.all([
      ex.select().from(referenceImages).where(eq(referenceImages.orderId, orderId)).orderBy(asc(referenceImages.position)),
      ex.select().from(annotations).where(and(eq(annotations.orderId, orderId), isNull(annotations.deletedAt))).orderBy(asc(annotations.number)),
      ex.select().from(specifications).where(eq(specifications.orderId, orderId)),
      ex.select().from(clarifications).where(eq(clarifications.orderId, orderId)).orderBy(asc(clarifications.createdAt)),
    ]);
    return { refs, anns, spec: specFromRows(specRows), specRows, clars };
  }

  async function refreshStatus(tx: Tx, orderId: string) {
    const [o] = await tx.select({ status: orders.status, template: orders.template }).from(orders).where(eq(orders.id, orderId));
    if (o.status !== 'collecting' && o.status !== 'awaiting_clarification') return;
    const [{ n: critical }] = await tx
      .select({ n: count() })
      .from(clarifications)
      .where(and(eq(clarifications.orderId, orderId), eq(clarifications.critical, true), ne(clarifications.status, 'resolved')));
    const [{ n: questions }] = await tx
      .select({ n: count() })
      .from(annotations)
      .where(and(eq(annotations.orderId, orderId), eq(annotations.kind, 'question'), ne(annotations.status, 'resolved'), isNull(annotations.deletedAt)));
    const next: OrderStatus = critical + questions > 0 ? 'awaiting_clarification' : 'collecting';
    if (next !== o.status) await tx.update(orders).set({ status: next }).where(eq(orders.id, orderId));
  }

  async function mutate<T>(orderId: string, role: Role, fn: (ctx: MutCtx) => Promise<T>): Promise<T> {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!order) throw new HttpError(404, 'Order not found');
      const names = await participantNames(tx, orderId);
      const ctx: MutCtx = { tx, order, role, names, emit: (type, entity, data, extra) => emit(tx, order, role, names, type, entity, data, extra) };
      const out = await fn(ctx);
      await refreshStatus(tx, orderId);
      await tx.update(orders).set({ revision: sql`${orders.revision} + 1`, updatedAt: new Date() }).where(eq(orders.id, orderId));
      return out;
    });
    deps.onCommit();
    return result;
  }

  function assertEditable(order: OrderRow) {
    if (order.status === 'agreed' || order.status === 'completed')
      throw new HttpError(409, 'This brief is agreed and locked. The seller can reopen it; any change then becomes a new version that both of you approve again.');
  }

  const cropFor = (refId: string, a: { x: number; y: number; w: number; h: number; shape?: string }) => {
    if (a.shape === 'point') {
      const s = 0.22;
      return { imageUrl: signer.url(refId), x: roundCoord(Math.min(1 - s, Math.max(0, a.x - s / 2))), y: roundCoord(Math.min(1 - s, Math.max(0, a.y - s / 2))), w: s, h: s };
    }
    return { imageUrl: signer.url(refId), x: roundCoord(a.x), y: roundCoord(a.y), w: roundCoord(Math.max(a.w, 0.02)), h: roundCoord(Math.max(a.h, 0.02)) };
  };

  /* ================================================================== access */

  async function sellerAccess(shopId: string, key: string | undefined) {
    const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
    if (!shop) throw new HttpError(404, 'Shop not found');
    if (!key || !safeEqual(hashKey(key), shop.sellerKeyHash)) throw new HttpError(403, 'Seller key required for this dashboard');
    return shop;
  }

  async function orderAccess(orderId: string, key: string | undefined): Promise<OrderAccess> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new HttpError(404, 'Order not found');
    if (key && safeEqual(key, order.customerKey)) return { order, role: 'customer' };
    if (key) {
      const [shop] = await db.select({ h: shops.sellerKeyHash }).from(shops).where(eq(shops.id, order.shopId));
      if (shop && safeEqual(hashKey(key), shop.h)) return { order, role: 'seller' };
    }
    throw new HttpError(403, 'You do not have access to this brief. Ask the seller to resend your private link.');
  }

  /* ================================================================== shops */

  async function createShop(input: { name: string; ownerName: string; category: string; city: string }, opts: { demo?: boolean } = {}) {
    const id = rid(4);
    const sellerKey = secretKey();
    const [shop] = await db
      .insert(shops)
      .values({
        id,
        name: clampText(input.name, 60) || 'My Shop',
        ownerName: clampText(input.ownerName, 40) || 'Owner',
        category: TEMPLATES[input.category] ? input.category : 'cake',
        city: clampText(input.city, 40),
        // Demo shops get their own prefix so /api/stats can leave them out of usage numbers.
        sellerUserId: `${opts.demo ? 'demo' : 's'}${id}${rid(3)}`,
        sellerKeyHash: hashKey(sellerKey),
      })
      .returning();
    return { shop: shopPublic(shop), sellerKey };
  }

  const shopPublic = (s: typeof shops.$inferSelect): ShopPublic => ({ id: s.id, name: s.name, ownerName: s.ownerName, category: s.category, city: s.city, createdAt: msReq(s.createdAt) });

  async function getShop(shopId: string) {
    const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
    if (!shop) throw new HttpError(404, 'Shop not found');
    return shopPublic(shop);
  }

  /* ================================================================== orders */

  async function createOrder(shopId: string, input: { customerName: string; template: string; title: string; creationKey?: string }, createdBy: Role) {
    const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
    if (!shop) throw new HttpError(404, 'Shop not found');
    const creationKey = clampText(input.creationKey, 80) || null;
    if (creationKey) {
      const [existing] = await db.select().from(orders).where(and(eq(orders.shopId, shopId), eq(orders.creationKey, creationKey)));
      if (existing) return { orderId: existing.id, customerKey: existing.customerKey, createdBy: existing.createdByRole as Role, replayed: true };
    }
    const template = TEMPLATES[input.template] ? input.template : shop.category;
    const t = templateFor(template);
    const customerName = clampText(input.customerName, 40) || 'Customer';
    const id = rid(5);
    const customerKey = secretKey();
    const title = clampText(input.title, 80) || `${t.name} for ${customerName}`;
    await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({ id, shopId, template, title, customerKey, createdByRole: createdBy, creationKey }).returning();
      const sellerName = `${shop.ownerName} · ${shop.name}`;
      const customerUserId = `c${id}${rid(3)}`;
      await tx.insert(participants).values([
        { id: rid(), orderId: id, role: 'seller', displayName: sellerName, nexconnUserId: shop.sellerUserId },
        { id: rid(), orderId: id, role: 'customer', displayName: customerName, nexconnUserId: customerUserId },
      ]);
      // Reserve the channel ID first: retries can never create a second channel for this order.
      await tx.insert(nexconnChannels).values({ orderId: id, channelId: `o${id}`, ownerUserId: shop.sellerUserId, memberUserIds: [customerUserId] });
      await emit(tx, order, createdBy, { seller: sellerName, customer: customerName }, 'ORDER_CREATED', { type: 'order', id }, { title }, { focus: { kind: 'order', id } });
    });
    deps.onCommit();
    return { orderId: id, customerKey, createdBy, replayed: false };
  }

  async function orderMeta(orderId: string) {
    const [row] = await db.select({ id: orders.id, shopId: orders.shopId, title: orders.title, template: orders.template, shopName: shops.name }).from(orders).innerJoin(shops, eq(shops.id, orders.shopId)).where(eq(orders.id, orderId));
    if (!row) throw new HttpError(404, 'Order not found');
    return row;
  }

  async function getOrderView({ order, role }: OrderAccess): Promise<OrderView> {
    const id = order.id;
    const [[o], [shop], parts, drafts, cmts, sugs, vers, apprs, [channel], events] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, id)),
      db.select().from(shops).where(eq(shops.id, order.shopId)),
      db.select().from(participants).where(eq(participants.orderId, id)),
      loadDraftParts(db, id),
      db.select().from(comments).where(eq(comments.orderId, id)).orderBy(asc(comments.createdAt)),
      db.select().from(suggestions).where(and(eq(suggestions.orderId, id), ne(suggestions.status, 'dismissed'))).orderBy(asc(suggestions.createdAt)),
      db.select().from(briefVersions).where(eq(briefVersions.orderId, id)).orderBy(asc(briefVersions.number)),
      db.select().from(approvals).where(eq(approvals.orderId, id)),
      db.select().from(nexconnChannels).where(eq(nexconnChannels.orderId, id)),
      db.select().from(domainEvents).where(eq(domainEvents.orderId, id)).orderBy(desc(domainEvents.seq)).limit(80),
    ]);
    const names: Names = { seller: 'Seller', customer: 'Customer' };
    for (const p of parts) names[p.role as Role] = p.displayName;
    const { refs, anns, spec, specRows, clars } = drafts;
    const bySubject = (type: string, sid: string) => cmts.filter((c) => c.subjectType === type && c.subjectId === sid).map((c) => commentView(c, names));
    const draft = buildSnapshot(o, refs, anns, spec, clars);
    const draftHash = hashSnapshot(draft);
    const versions = versionViews(vers, apprs);
    const latest = versions.find((v) => v.id === o.latestVersionId) ?? null;
    const liveRefIds = new Set(refs.filter((r) => !r.removedAt).map((r) => r.id));
    return {
      id: o.id,
      shopId: o.shopId,
      shopName: shop?.name ?? 'Shop',
      template: o.template,
      title: o.title,
      status: o.status as OrderStatus,
      revision: o.revision,
      createdAt: msReq(o.createdAt),
      updatedAt: msReq(o.updatedAt),
      agreedAt: ms(o.agreedAt),
      completedAt: ms(o.completedAt),
      role,
      participants: parts.map((p) => ({ role: p.role as Role, name: p.displayName, nexconnUserId: p.nexconnUserId })),
      channel: { channelId: channel?.channelId ?? `o${id}`, status: !nexconn.enabled ? 'disabled' : ((channel?.status as 'pending' | 'ready' | 'failed') ?? 'pending'), lastError: channel?.lastError ?? null },
      references: refs.map((r) => referenceView(r, signer)),
      annotations: anns.map((a) => annotationView(a, bySubject('annotation', a.id))),
      clarifications: clars.map((c) => clarificationView(c, bySubject('clarification', c.id))),
      suggestions: sugs.map(suggestionView),
      spec,
      specMeta: Object.fromEntries(specRows.map((r) => [r.fieldKey, { updatedByRole: r.updatedByRole as Role, updatedAt: msReq(r.updatedAt) }])),
      versions,
      latestVersionId: o.latestVersionId,
      agreedVersionId: o.agreedVersionId,
      draftHash,
      draftDirty: !latest || latest.snapshotHash !== draftHash,
      blockers: computeBlockers(o.template, spec, clars, anns, liveRefIds),
      activity: events.map(activityView),
      ...(role === 'seller' ? { inviteKey: o.customerKey } : {}),
    };
  }

  async function listShopOrders(shopId: string): Promise<OrderSummary[]> {
    const rows = await db.select().from(orders).where(eq(orders.shopId, shopId)).orderBy(desc(orders.updatedAt)).limit(200);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [parts, refs, annCounts, clarCounts, vers, specRows, lastEvents] = await Promise.all([
      db.select().from(participants).where(and(inArray(participants.orderId, ids), eq(participants.role, 'customer'))),
      db.select().from(referenceImages).where(and(inArray(referenceImages.orderId, ids), isNull(referenceImages.removedAt))).orderBy(asc(referenceImages.position)),
      db.select({ orderId: annotations.orderId, n: count() }).from(annotations).where(and(inArray(annotations.orderId, ids), isNull(annotations.deletedAt))).groupBy(annotations.orderId),
      db.select({ orderId: clarifications.orderId, n: count() }).from(clarifications).where(and(inArray(clarifications.orderId, ids), ne(clarifications.status, 'resolved'))).groupBy(clarifications.orderId),
      db.select({ id: briefVersions.id, orderId: briefVersions.orderId, number: briefVersions.number, snapshot: briefVersions.snapshot }).from(briefVersions).where(inArray(briefVersions.orderId, ids)),
      db.select().from(specifications).where(inArray(specifications.orderId, ids)),
      db.execute(sql`select distinct on (order_id) order_id, payload->>'summary' as summary, created_at from domain_events where order_id in ${ids} order by order_id, seq desc`),
    ]);
    const last = new Map(((lastEvents as unknown as { rows: { order_id: string; summary: string; created_at: string | Date }[] }).rows ?? []).map((r) => [r.order_id, r]));
    return rows.map((o) => {
      const t = templateFor(o.template);
      const priceKey = t.fields.find((f) => f.role === 'price')?.key ?? 'price';
      const dateKey = t.fields.find((f) => f.role === 'deliveryDate')?.key ?? 'deliveryDate';
      const latest = vers.find((v) => v.id === o.latestVersionId);
      const agreed = vers.find((v) => v.id === o.agreedVersionId);
      const draftSpec = specFromRows(specRows.filter((s) => s.orderId === o.id));
      const spec = (agreed ?? latest)?.snapshot.spec ?? draftSpec;
      const price = typeof spec[priceKey] === 'number' ? (spec[priceKey] as number) : typeof draftSpec[priceKey] === 'number' ? (draftSpec[priceKey] as number) : null;
      const date = (spec[dateKey] ?? draftSpec[dateKey]) as string | undefined;
      const thumb = refs.find((r) => r.orderId === o.id);
      const ev = last.get(o.id);
      return {
        id: o.id,
        title: o.title,
        template: o.template,
        customerName: parts.find((p) => p.orderId === o.id)?.displayName ?? 'Customer',
        status: o.status as OrderStatus,
        latestVersionNumber: latest?.number ?? 0,
        price,
        deliveryDate: typeof date === 'string' && date ? date : null,
        thumbnailUrl: thumb ? signer.url(thumb.id) : null,
        annotationCount: Number(annCounts.find((c) => c.orderId === o.id)?.n ?? 0),
        openClarifications: Number(clarCounts.find((c) => c.orderId === o.id)?.n ?? 0),
        lastActivity: ev ? { summary: ev.summary, at: new Date(ev.created_at).getTime() } : null,
        updatedAt: msReq(o.updatedAt),
        createdAt: msReq(o.createdAt),
      };
    });
  }

  async function shopActivity(shopId: string) {
    const rows = await db
      .select({ e: domainEvents, title: orders.title })
      .from(domainEvents)
      .innerJoin(orders, eq(orders.id, domainEvents.orderId))
      .where(eq(orders.shopId, shopId))
      .orderBy(desc(domainEvents.seq))
      .limit(30);
    return rows.map((r) => ({ ...activityView(r.e), orderId: r.e.orderId, orderTitle: r.title }));
  }

  return {
    db,
    participantNames,
    mutate,
    assertEditable,
    loadDraftParts,
    cropFor,
    sellerAccess,
    orderAccess,
    createShop,
    getShop,
    createOrder,
    orderMeta,
    getOrderView,
    listShopOrders,
    shopActivity,
    tokenCache,
    config,
    storage,
    signer,
    nexconn,
  };
}

export type CoreService = ReturnType<typeof createBriefService>;

/* ====================================================================== spec sanitising */

export function sanitizeSpec(templateId: string, role: Role, patch: Record<string, unknown>): Spec {
  const t = templateFor(templateId);
  const out: Spec = {};
  for (const f of t.fields) {
    if (!(f.key in patch)) continue;
    if (f.sellerOnly && role !== 'seller') throw new HttpError(403, `${f.label} can only be set by the seller.`);
    const v = patch[f.key];
    let val: SpecValue = '';
    switch (f.type) {
      case 'bool':
        val = v === true || v === 'true';
        break;
      case 'number':
      case 'money': {
        const n = Number(v);
        val = v === '' || v === null || v === undefined || !Number.isFinite(n) ? '' : Math.max(0, Math.round(n));
        break;
      }
      case 'colors':
        val = (Array.isArray(v) ? v : []).map((c) => String(c).trim()).filter((c) => HEX.test(c)).map((c) => c.toLowerCase()).slice(0, 8);
        break;
      case 'select':
        val = f.options?.includes(String(v)) ? String(v) : '';
        if (v && !val) throw new HttpError(400, `${f.label}: “${String(v)}” is not one of the options.`);
        break;
      case 'date':
        val = typeof v === 'string' && DATE.test(v) ? v : '';
        if (v && !val) throw new HttpError(400, `${f.label} must be a date (YYYY-MM-DD).`);
        break;
      default:
        val = String(v ?? '').trim().slice(0, f.max ?? 500);
    }
    out[f.key] = val;
  }
  return out;
}

export const VALIDATION = { HEX, COLOUR_KINDS, ANNOTATION_KINDS };
