CREATE TABLE "annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"reference_image_id" text NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"shape" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"w" double precision NOT NULL,
	"h" double precision NOT NULL,
	"color" text,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_requested_by" text,
	"resolution_requested_at" timestamp with time zone,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_by_role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "annotations_kind_ck" CHECK ("annotations"."kind" in ('keep','change','colour','remove','add','question','custom')),
	CONSTRAINT "annotations_shape_ck" CHECK ("annotations"."shape" in ('rect','point')),
	CONSTRAINT "annotations_status_ck" CHECK ("annotations"."status" in ('open','discussion','resolved')),
	CONSTRAINT "annotations_geometry_ck" CHECK ("annotations"."x" between 0 and 1 and "annotations"."y" between 0 and 1 and "annotations"."w" between 0 and 1 and "annotations"."h" between 0 and 1 and "annotations"."x" + "annotations"."w" <= 1.0001 and "annotations"."y" + "annotations"."h" <= 1.0001)
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"version_id" text NOT NULL,
	"role" text NOT NULL,
	"decision" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_decision_ck" CHECK ("approvals"."decision" in ('approved','changes_requested')),
	CONSTRAINT "approvals_role_ck" CHECK (role in ('seller','customer'))
);
--> statement-breakpoint
CREATE TABLE "brief_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"hash_algorithm" text NOT NULL,
	"proposed_by_role" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brief_versions_status_ck" CHECK ("brief_versions"."status" in ('proposed','changes_requested','superseded','agreed')),
	CONSTRAINT "brief_versions_hash_ck" CHECK ("brief_versions"."snapshot_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "clarifications" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"annotation_id" text,
	"message_id" text,
	"created_by_role" text NOT NULL,
	"owner_role" text,
	"resolution" text,
	"resolved_by_role" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clarifications_status_ck" CHECK ("clarifications"."status" in ('open','discussion','resolved')),
	CONSTRAINT "clarifications_source_ck" CHECK ("clarifications"."source" in ('manual','ai','rules'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_subject_ck" CHECK ("comments"."subject_type" in ('annotation','clarification')),
	CONSTRAINT "comments_author_ck" CHECK (author_role in ('seller','customer'))
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" bigserial NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_role" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"version_id" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nexconn_status" text DEFAULT 'pending' NOT NULL,
	"nexconn_message_type" text,
	"nexconn_message_id" text,
	"nexconn_attempts" integer DEFAULT 0 NOT NULL,
	"nexconn_last_error" text,
	"nexconn_next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nexconn_lease_until" timestamp with time zone,
	"nexconn_sent_at" timestamp with time zone,
	CONSTRAINT "domain_events_nexconn_status_ck" CHECK ("domain_events"."nexconn_status" in ('pending','sending','sent','skipped','failed'))
);
--> statement-breakpoint
CREATE TABLE "nexconn_channels" (
	"order_id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"member_user_ids" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "nexconn_channels_channel_id_unique" UNIQUE("channel_id"),
	CONSTRAINT "nexconn_channels_status_ck" CHECK ("nexconn_channels"."status" in ('pending','ready','failed'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"template" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"customer_key" text NOT NULL,
	"created_by_role" text NOT NULL,
	"creation_key" text,
	"annotation_seq" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"latest_version_id" text,
	"agreed_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"agreed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "orders_customer_key_unique" UNIQUE("customer_key"),
	CONSTRAINT "orders_status_ck" CHECK ("orders"."status" in ('collecting','awaiting_clarification','awaiting_approval','changes_requested','agreed','completed')),
	CONSTRAINT "orders_created_by_ck" CHECK (created_by_role in ('seller','customer'))
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"role" text NOT NULL,
	"display_name" text NOT NULL,
	"nexconn_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_role_ck" CHECK (role in ('seller','customer'))
);
--> statement-breakpoint
CREATE TABLE "reference_images" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"position" integer NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"content_sha256" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'upload' NOT NULL,
	"created_by_role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "reference_images_mime_ck" CHECK ("reference_images"."mime_type" in ('image/jpeg','image/png','image/webp')),
	CONSTRAINT "reference_images_dims_ck" CHECK ("reference_images"."width" > 0 and "reference_images"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_name" text NOT NULL,
	"category" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"seller_user_id" text NOT NULL,
	"seller_key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_seller_user_id_unique" UNIQUE("seller_user_id"),
	CONSTRAINT "shops_seller_key_hash_unique" UNIQUE("seller_key_hash")
);
--> statement-breakpoint
CREATE TABLE "specifications" (
	"order_id" text NOT NULL,
	"field_key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_role" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specifications_order_id_field_key_pk" PRIMARY KEY("order_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"question" text NOT NULL,
	"category" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"clarification_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestions_status_ck" CHECK ("suggestions"."status" in ('suggested','asked','dismissed')),
	CONSTRAINT "suggestions_source_ck" CHECK ("suggestions"."source" in ('ai','rules'))
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_reference_image_id_reference_images_id_fk" FOREIGN KEY ("reference_image_id") REFERENCES "public"."reference_images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_version_id_brief_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."brief_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_versions" ADD CONSTRAINT "brief_versions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_annotation_id_annotations_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexconn_channels" ADD CONSTRAINT "nexconn_channels_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_latest_version_id_brief_versions_id_fk" FOREIGN KEY ("latest_version_id") REFERENCES "public"."brief_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_agreed_version_id_brief_versions_id_fk" FOREIGN KEY ("agreed_version_id") REFERENCES "public"."brief_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_clarification_id_clarifications_id_fk" FOREIGN KEY ("clarification_id") REFERENCES "public"."clarifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "annotations_order_number_uq" ON "annotations" USING btree ("order_id","number");--> statement-breakpoint
CREATE INDEX "annotations_reference_idx" ON "annotations" USING btree ("reference_image_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_version_role_uq" ON "approvals" USING btree ("version_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_order_idempotency_uq" ON "approvals" USING btree ("order_id","idempotency_key") WHERE "approvals"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "brief_versions_order_number_uq" ON "brief_versions" USING btree ("order_id","number");--> statement-breakpoint
CREATE INDEX "clarifications_order_status_idx" ON "clarifications" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "comments_subject_idx" ON "comments" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_events_seq_uq" ON "domain_events" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "domain_events_order_seq_idx" ON "domain_events" USING btree ("order_id","seq");--> statement-breakpoint
CREATE INDEX "domain_events_outbox_idx" ON "domain_events" USING btree ("nexconn_status","nexconn_next_attempt_at");--> statement-breakpoint
CREATE INDEX "orders_shop_updated_idx" ON "orders" USING btree ("shop_id","updated_at");--> statement-breakpoint
CREATE INDEX "orders_shop_status_idx" ON "orders" USING btree ("shop_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_shop_creation_key_uq" ON "orders" USING btree ("shop_id","creation_key") WHERE "orders"."creation_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_order_role_uq" ON "participants" USING btree ("order_id","role");--> statement-breakpoint
CREATE INDEX "participants_nexconn_idx" ON "participants" USING btree ("nexconn_user_id");--> statement-breakpoint
CREATE INDEX "reference_images_order_idx" ON "reference_images" USING btree ("order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_order_fingerprint_uq" ON "suggestions" USING btree ("order_id","fingerprint");