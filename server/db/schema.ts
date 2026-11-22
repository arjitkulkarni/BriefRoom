/**
 * BriefRoom relational model (Drizzle ORM, PostgreSQL / Neon).
 *
 * Relational rows for everything queried or changed independently; JSONB only for the
 * immutable version snapshot and validated event payloads. Versions and approvals are
 * append-only — enforced by triggers in the `immutability` migration, not just by code.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { BriefSnapshot } from '../../shared/snapshot.ts';
import type { SpecValue, SuggestionEvidence } from '../../shared/types.ts';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').notNull().defaultNow();
const roleCheck = (col: string) => sql.raw(`${col} in ('seller','customer')`);

/* ------------------------------------------------------------------ shops */

export const shops = pgTable('shops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerName: text('owner_name').notNull(),
  category: text('category').notNull(),
  city: text('city').notNull().default(''),
  /** Stable Nexconn user ID of the seller (letters + digits, ≤ 64 bytes). */
  sellerUserId: text('seller_user_id').notNull().unique(),
  /** SHA-256 of the seller's private dashboard key — the key itself is never stored. */
  sellerKeyHash: text('seller_key_hash').notNull().unique(),
  createdAt: created(),
});

/* ------------------------------------------------------------------ orders */

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id),
    template: text('template').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('collecting'),
    /** Private capability for the customer's link (shown to the seller for re-sharing). */
    customerKey: text('customer_key').notNull().unique(),
    createdByRole: text('created_by_role').notNull(),
    /** Optional client-supplied key making "create order" retries idempotent per shop. */
    creationKey: text('creation_key'),
    annotationSeq: integer('annotation_seq').notNull().default(0),
    /** Incremented on every committed change: optimistic concurrency token + cache key. */
    revision: integer('revision').notNull().default(0),
    latestVersionId: text('latest_version_id').references((): AnyPgColumn => briefVersions.id),
    agreedVersionId: text('agreed_version_id').references((): AnyPgColumn => briefVersions.id),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    agreedAt: ts('agreed_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [
    index('orders_shop_updated_idx').on(t.shopId, t.updatedAt),
    index('orders_shop_status_idx').on(t.shopId, t.status),
    uniqueIndex('orders_shop_creation_key_uq').on(t.shopId, t.creationKey).where(sql`${t.creationKey} is not null`),
    check('orders_status_ck', sql`${t.status} in ('collecting','awaiting_clarification','awaiting_approval','changes_requested','agreed','completed')`),
    check('orders_created_by_ck', roleCheck('created_by_role')),
  ],
);

export const participants = pgTable(
  'participants',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    displayName: text('display_name').notNull(),
    nexconnUserId: text('nexconn_user_id').notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex('participants_order_role_uq').on(t.orderId, t.role), index('participants_nexconn_idx').on(t.nexconnUserId), check('participants_role_ck', roleCheck('role'))],
);

/* ------------------------------------------------------------------ references */

export const referenceImages = pgTable(
  'reference_images',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    storageProvider: text('storage_provider').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: integer('byte_size').notNull(),
    contentSha256: text('content_sha256').notNull(),
    caption: text('caption').notNull().default(''),
    source: text('source').notNull().default('upload'),
    createdByRole: text('created_by_role').notNull(),
    createdAt: created(),
    /** Soft delete: frozen versions may still reference the image. */
    removedAt: ts('removed_at'),
  },
  (t) => [
    index('reference_images_order_idx').on(t.orderId, t.position),
    check('reference_images_mime_ck', sql`${t.mimeType} in ('image/jpeg','image/png','image/webp')`),
    check('reference_images_dims_ck', sql`${t.width} > 0 and ${t.height} > 0`),
  ],
);

/* ------------------------------------------------------------------ annotations */

export const annotations = pgTable(
  'annotations',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    referenceImageId: text('reference_image_id')
      .notNull()
      .references(() => referenceImages.id),
    number: integer('number').notNull(),
    kind: text('kind').notNull(),
    shape: text('shape').notNull(),
    /** Normalised (0..1) coordinates in the original image's space — never screen pixels. */
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    w: doublePrecision('w').notNull(),
    h: doublePrecision('h').notNull(),
    color: text('color'),
    note: text('note').notNull().default(''),
    status: text('status').notNull().default('open'),
    resolutionRequestedBy: text('resolution_requested_by'),
    resolutionRequestedAt: ts('resolution_requested_at'),
    resolvedBy: text('resolved_by'),
    resolvedAt: ts('resolved_at'),
    createdByRole: text('created_by_role').notNull(),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('annotations_order_number_uq').on(t.orderId, t.number),
    index('annotations_reference_idx').on(t.referenceImageId),
    check('annotations_kind_ck', sql`${t.kind} in ('keep','change','colour','remove','add','question','custom')`),
    check('annotations_shape_ck', sql`${t.shape} in ('rect','point')`),
    check('annotations_status_ck', sql`${t.status} in ('open','discussion','resolved')`),
    check('annotations_geometry_ck', sql`${t.x} between 0 and 1 and ${t.y} between 0 and 1 and ${t.w} between 0 and 1 and ${t.h} between 0 and 1 and ${t.x} + ${t.w} <= 1.0001 and ${t.y} + ${t.h} <= 1.0001`),
  ],
);

/** Contextual discussion threads for annotations and clarifications. */
export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    authorRole: text('author_role').notNull(),
    body: text('body').notNull(),
    createdAt: created(),
  },
  (t) => [index('comments_subject_idx').on(t.subjectType, t.subjectId, t.createdAt), check('comments_subject_ck', sql`${t.subjectType} in ('annotation','clarification')`), check('comments_author_ck', roleCheck('author_role'))],
);

/* ------------------------------------------------------------------ clarifications & suggestions */

export const clarifications = pgTable(
  'clarifications',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('open'),
    critical: boolean('critical').notNull().default(false),
    source: text('source').notNull().default('manual'),
    evidence: text('evidence').notNull().default(''),
    annotationId: text('annotation_id').references(() => annotations.id),
    /** Nexconn message UID of the conversation message this clarification came from, if any. */
    messageId: text('message_id'),
    createdByRole: text('created_by_role').notNull(),
    ownerRole: text('owner_role'),
    resolution: text('resolution'),
    resolvedByRole: text('resolved_by_role'),
    resolvedAt: ts('resolved_at'),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('clarifications_order_status_idx').on(t.orderId, t.status),
    check('clarifications_status_ck', sql`${t.status} in ('open','discussion','resolved')`),
    check('clarifications_source_ck', sql`${t.source} in ('manual','ai','rules')`),
  ],
);

export const suggestions = pgTable(
  'suggestions',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Dedupe key so re-running analysis never resurrects a dismissed suggestion. */
    fingerprint: text('fingerprint').notNull(),
    question: text('question').notNull(),
    category: text('category').notNull(),
    evidence: jsonb('evidence').$type<SuggestionEvidence[]>().notNull(),
    source: text('source').notNull(),
    status: text('status').notNull().default('suggested'),
    clarificationId: text('clarification_id').references(() => clarifications.id),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('suggestions_order_fingerprint_uq').on(t.orderId, t.fingerprint),
    check('suggestions_status_ck', sql`${t.status} in ('suggested','asked','dismissed')`),
    check('suggestions_source_ck', sql`${t.source} in ('ai','rules')`),
  ],
);

/* ------------------------------------------------------------------ specification */

export const specifications = pgTable(
  'specifications',
  {
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').notNull(),
    value: jsonb('value').$type<SpecValue>().notNull(),
    updatedByRole: text('updated_by_role').notNull(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.fieldKey] })],
);

/* ------------------------------------------------------------------ versions & approvals */

export const briefVersions = pgTable(
  'brief_versions',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    snapshot: jsonb('snapshot').$type<BriefSnapshot>().notNull(),
    snapshotHash: text('snapshot_hash').notNull(),
    hashAlgorithm: text('hash_algorithm').notNull(),
    proposedByRole: text('proposed_by_role').notNull(),
    note: text('note').notNull().default(''),
    status: text('status').notNull().default('proposed'),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('brief_versions_order_number_uq').on(t.orderId, t.number),
    check('brief_versions_status_ck', sql`${t.status} in ('proposed','changes_requested','superseded','agreed')`),
    check('brief_versions_hash_ck', sql`${t.snapshotHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const approvals = pgTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    versionId: text('version_id')
      .notNull()
      .references(() => briefVersions.id),
    role: text('role').notNull(),
    decision: text('decision').notNull(),
    /** The fingerprint the participant reviewed — must equal the version's hash. */
    snapshotHash: text('snapshot_hash').notNull(),
    reason: text('reason').notNull().default(''),
    idempotencyKey: text('idempotency_key'),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('approvals_version_role_uq').on(t.versionId, t.role),
    uniqueIndex('approvals_order_idempotency_uq').on(t.orderId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    check('approvals_decision_ck', sql`${t.decision} in ('approved','changes_requested')`),
    check('approvals_role_ck', roleCheck('role')),
  ],
);

/* ------------------------------------------------------------------ domain events (+ Nexconn outbox) */

export const domainEvents = pgTable(
  'domain_events',
  {
    id: text('id').primaryKey(),
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorRole: text('actor_role'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    versionId: text('version_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: created(),
    nexconnStatus: text('nexconn_status').notNull().default('pending'),
    nexconnMessageType: text('nexconn_message_type'),
    nexconnMessageId: text('nexconn_message_id'),
    nexconnAttempts: integer('nexconn_attempts').notNull().default(0),
    nexconnLastError: text('nexconn_last_error'),
    nexconnNextAttemptAt: ts('nexconn_next_attempt_at').notNull().defaultNow(),
    nexconnLeaseUntil: ts('nexconn_lease_until'),
    nexconnSentAt: ts('nexconn_sent_at'),
  },
  (t) => [
    uniqueIndex('domain_events_seq_uq').on(t.seq),
    index('domain_events_order_seq_idx').on(t.orderId, t.seq),
    index('domain_events_outbox_idx').on(t.nexconnStatus, t.nexconnNextAttemptAt),
    check('domain_events_nexconn_status_ck', sql`${t.nexconnStatus} in ('pending','sending','sent','skipped','failed')`),
  ],
);

export const nexconnChannels = pgTable(
  'nexconn_channels',
  {
    orderId: text('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull().unique(),
    ownerUserId: text('owner_user_id').notNull(),
    memberUserIds: jsonb('member_user_ids').$type<string[]>().notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: created(),
    readyAt: ts('ready_at'),
  },
  (t) => [check('nexconn_channels_status_ck', sql`${t.status} in ('pending','ready','failed')`)],
);

export const schema = {
  shops,
  orders,
  participants,
  referenceImages,
  annotations,
  comments,
  clarifications,
  suggestions,
  specifications,
  briefVersions,
  approvals,
  domainEvents,
  nexconnChannels,
};
