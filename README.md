# BriefRoom

**From "something like this" to exactly what we agreed to make.**

BriefRoom is a visual collaboration and agreement workspace for custom-order businesses: custom cakes first, plus printed merchandise, furniture and jewellery. A customer and a seller share one private room per order. There they:

1. **mark up reference images**: rectangle or pin annotations ("keep", "change colour", "remove", "add", "question"), each with its own discussion;
2. **settle open questions** in the Clarification Radar, helped by an ambiguity detector (deterministic rules, plus OpenAI and/or Grok when configured);
3. **freeze versions**: snapshots with a SHA-256 fingerprint and a visual diff between versions;
4. **both approve the same version**. Only then does the backend mark the order **agreed** and produce a printable A4 work order.

Real-time conversation and live sync run on **Nexconn** (Chat SDK, Chat UI, Platform Chat API). Data lives in **Neon** (Postgres and Object Storage).

> Nexconn Build Challenge 2026 · Marketplace & Support · Web

---

## Contents

[Architecture](#architecture) · [Technology](#technology) · [Folder structure](#folder-structure) · [Running locally](#running-locally) · [Environment](#environment) · [Database (Neon)](#database-neon) · [Object storage](#object-storage) · [Nexconn setup](#nexconn-setup) · [Testing](#testing) · [Deployment](#deployment) · [Known limitations](#known-limitations) · [Manual tasks remaining](#manual-tasks-remaining)

Design source of truth: [`design.md`](design.md) · research: [`docs/DESIGN_RESEARCH.md`](docs/DESIGN_RESEARCH.md) · audit: [`docs/IMPLEMENTATION_AUDIT.md`](docs/IMPLEMENTATION_AUDIT.md) · frontend plan: [`docs/FRONTEND_IMPLEMENTATION_PLAN.md`](docs/FRONTEND_IMPLEMENTATION_PLAN.md)

---

## Architecture

```
Browser (React 19 SPA · Tailwind v4 tokens · Radix · Light/Dark/System)
 ├─ Workspace: canvas · annotations · Clarification Radar · spec · versions · approvals
 │    └─ Conversation: custom React UI on the Nexconn Chat SDK (themeable; BR:* activity cards)
 ├─ Seller dashboard: pipeline · activity · Nexconn Chat UI inbox
 └─ REST /api/*  (capability keys in the x-key header)
                    │
Express API ────────┤ every mutation = ONE Postgres transaction:
 (server/)          │   lock order row (SELECT … FOR UPDATE) → change → recompute status
                    │   → append domain_events row (doubles as the Nexconn outbox) → bump revision
                    │
                    ├─ Outbox dispatcher ──► Nexconn Platform Chat API
                    │     ensure group channel (idempotent, 25409 = exists)
                    │     publish BR:* custom message from the actor (isEchoToSender=1)
                    │     retries with backoff · per-order ordering · lease (SKIP LOCKED)
                    ├─ ImageStorageProvider ──► Neon Object Storage (S3, private bucket, presigned reads) | local disk
                    └─ AmbiguityProvider ──► deterministic rules (always) + OpenAI / Grok (optional, grounded)
Neon Postgres (Drizzle schema + versioned SQL migrations; DB triggers keep versions/approvals immutable)
```

**Principles**

- **The backend owns the agreement; Nexconn carries the communication.** BR:* messages are display hints plus refresh signals. Clients re-fetch authoritative state, and "verified" badges on chat cards are checked against the API.
- **Approvals bind to order ID + version ID + SHA-256 snapshot hash.** The second approval is serialised by a row lock, and the order becomes `agreed` atomically in that same transaction.
- **Versions are immutable in the database.** Triggers reject changes to a frozen snapshot, and versions and approvals are never deleted. Later changes become a new version that needs both approvals again.
- **Annotation coordinates are normalised (0–1) to the original image.** Screen pixels are never stored.
- **Order creation does not depend on Nexconn being up.** The channel ID is reserved in the same transaction and created (and retried) by the outbox.
- **No fake chat.** Without Nexconn credentials the UI says so ("Live sync off") and refreshes on window focus. Nothing is simulated.

### Data model (Postgres)

`shops` · `orders` · `participants` · `reference_images` · `annotations` · `comments` (annotation & clarification threads) · `clarifications` · `suggestions` · `specifications` · `brief_versions` (JSONB snapshot + hash) · `approvals` · `domain_events` (+ outbox columns) · `nexconn_channels`. See [`server/db/schema.ts`](server/db/schema.ts) and [`drizzle/`](drizzle/).

### Order lifecycle

`collecting` → `awaiting_clarification` (critical question or open image question) → `awaiting_approval` (version proposed) → `changes_requested` → `agreed` (both approved the same hash) → `completed`. The seller may reopen an agreed order: the agreed version stays on record, and the next version needs both approvals.

### Domain events → Nexconn messages

| Domain event | Nexconn custom message |
|---|---|
| ORDER_CREATED | `BR:OrderCreated` |
| REFERENCE_ADDED | `BR:ReferenceAdded` |
| ANNOTATION_CREATED | `BR:AnnotationCreated` |
| ANNOTATION_COMMENTED | `BR:AnnotationComment` |
| ANNOTATION_UPDATED / _RESOLUTION_REQUESTED / _RESOLVED / _REOPENED / _DELETED | `BR:AnnotationUpdated` |
| CLARIFICATION_RAISED | `BR:ClarificationRaised` |
| CLARIFICATION_RESOLVED | `BR:ClarificationResolved` |
| SPECIFICATION_UPDATED | `BR:SpecUpdated` |
| VERSION_PROPOSED | `BR:VersionProposed` |
| VERSION_APPROVED / VERSION_REJECTED | `BR:VersionDecision` |
| ORDER_AGREED | `BR:OrderAgreed` |
| REFERENCE_REMOVED, CLARIFICATION_COMMENTED/_REOPENED, ORDER_REOPENED/_COMPLETED | `BR:OrderUpdated` |

Types are registered on the client before `connect` (`shared/messages.ts`).

## Technology

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 8 (Rolldown), React Router 7, Tailwind CSS 4, Radix UI, lucide-react, Motion, Sonner, React Hook Form + Zod |
| Backend | Node 22+, Express 5, tsx, Zod |
| Database | Neon Postgres via `node-postgres` (pooled) + Drizzle ORM / drizzle-kit migrations; PGlite (in-process Postgres) for tests and credential-free dev |
| Storage | Neon Object Storage (S3 API via `@aws-sdk/client-s3`, path-style, presigned GET) · local disk |
| Realtime | Nexconn Chat SDK `@nexconn/chat` 26.5.1, Chat UI `@nexconn/chatui` 26.5.0, Platform Chat API v4 |
| AI | OpenAI or Grok (xAI) Chat Completions with JSON-schema output (optional, one falls back to the other) + deterministic rules |
| Tests | `node:test` (unit + integration on PGlite), Playwright (E2E, 2 contexts) |

## Folder structure

```
shared/            Domain vocabulary, templates, snapshot/diff/hash, geometry, BR:* message contract (used by server AND client)
server/
  config.ts        Env parsing + startup validation (actionable errors)
  app.ts           Express routes          context.ts  Composition root
  db/              schema.ts · client.ts (pg | PGlite) · migrate.ts · import-json.ts
  domain/          service.ts (access, views, mutate) · commands.ts (all state changes) · views.ts · util.ts
  nexconn/         client.ts (signed Server API) · outbox.ts (channels + dispatcher)
  storage/         image.ts (byte sniffing) · provider.ts (s3 | local) · remote.ts (SSRF-guarded import)
  ai/              rules.ts · analyzer.ts (provider chain OpenAI → Grok, evidence grounding)
drizzle/           Versioned SQL migrations (0000_init, 0001_immutability)
src/
  app routes in main.tsx · styles/globals.css (ALL design tokens)
  components/ui    Button, form controls, overlays (dialog/sheet/menu/tooltip/tabs/popover), primitives
  components/      layout (logo, theme toggle) · feedback (empty/error/status/connection)
  features/        landing · shops · dashboard · workspace · annotations · conversation · clarification
                   specifications · versions · approvals (incl. work order)
  services/nexconn client.ts (SDK lifecycle) · use-channel.ts (messages) · chatui.ts (inbox)
  hooks/ lib/ pages/ (design-system, stats, not-found)
tests/             unit/ · integration/ (real migrations on PGlite through the HTTP API) · helpers.ts
e2e/               Playwright golden path + responsive/theme checks
docs/              Audit, design research (+ screenshots), frontend plan, screenshots
```

## Running locally

Requirements: Node 22+ (tested on 24.16).

```bash
npm install
npm run dev            # API :8787 + Vite :5173 (proxy /api)
```

- **No `.env` at all** works: an embedded PGlite database and local uploads in `./data`, rules-only AI, and Nexconn shown as "Live sync off".
- **With Neon** (this repo is linked via `neon init` / `neon deploy`, and `.env.local` holds the variables): run `npm run db:migrate` once, then `npm run dev`. The dev scripts load `.env` and then `.env.local`.
- Open http://localhost:5173 → **Create your first brief** → dashboard → **New brief**. Open the customer link in a second browser profile or on a phone on the same Wi-Fi.

Useful scripts: `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run build` · `npm start` · `npm run db:generate` (after editing the schema) · `npm run db:migrate` · `npm run db:import-json -- path/to/db.json` · `npm run check:contrast`.

## Environment

Only the server reads environment variables; the browser gets public settings from `GET /api/config`. In production, invalid settings stop the server with a checklist. In development they degrade the affected feature, with a warning.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | – | `production` enables strict validation |
| `PORT` | – | API port (default 8787) |
| `PUBLIC_URL` | **prod** | Public HTTPS origin used in share links. Rejected if it points at localhost in production. On Render it defaults to `RENDER_EXTERNAL_URL` (the onrender.com URL), so set it only for a custom domain |
| `DATA_DIR` | – | Dev data folder (embedded DB, local uploads, generated dev secret). Default `./data` |
| `SESSION_SECRET` | **prod** | ≥ 32 random chars; signs reference-image URLs. Generated for dev |
| `DATABASE_URL` | **prod** | Neon **pooled** URL (`-pooler` host) for app queries. Absent in dev → embedded PGlite |
| `DATABASE_URL_UNPOOLED` | for migrations | Neon **direct** URL used by `npm run db:migrate` |
| `NEXCONN_ENVIRONMENT` | – | `development` / `production`: chooses which key pair is used (defaults to `production` when `NODE_ENV=production`) |
| `NEXCONN_DEV_APP_KEY` / `NEXCONN_DEV_APP_SECRET` | for chat | Development app credentials (Nexconn Console → App Key page) |
| `NEXCONN_PROD_APP_KEY` / `NEXCONN_PROD_APP_SECRET` | for chat in prod | Production app credentials |
| `NEXCONN_REGION` | with keys | `sg` · `na` · `sa`, matching your app's data centre. Sets both the Server API hosts and the Chat SDK `AreaCode` |
| `UPLOAD_PROVIDER` | – | `s3` (default when `AWS_ENDPOINT_URL_S3` is set) or `local` |
| `UPLOADS_DIR` | – | Local provider folder (default `DATA_DIR/uploads`) |
| `S3_BUCKET` | – | Bucket name (default `assets`, declared in `neon.ts`) |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | for s3 | Neon Object Storage credentials (written by `neon deploy` / `neon env pull`) |
| `AI_PROVIDER` | – | `auto` (default: OpenAI first, Grok as fallback) · `openai` · `xai` (that provider first, the other as fallback) · `rules` (no AI) |
| `OPENAI_API_KEY` | – | Enables OpenAI suggestions (rules always run) |
| `OPENAI_MODEL` | – | Default `gpt-4o-mini` |
| `XAI_API_KEY` | – | Enables Grok (xAI) suggestions through its OpenAI-compatible API (`https://api.x.ai/v1`) |
| `XAI_MODEL` | – | Default `grok-4.20-non-reasoning` |

Neon also writes `NEON_BRANCH`, `NEON_BRANCH_ID` and `NEON_FUNCTION_HOST_SUFFIX` to `.env.local`. BriefRoom does not use them. Secret-bearing files (`.env`, every `.env.*` except `.env.example`, `.neon`) are gitignored.

**Local development uses the Neon `dev` branch**, not `production`: `neon checkout dev --create` created it from production and rewrote only the Neon variables in `.env.local`. It was created under the `neon.ts` policy, so it **expires 7 days after creation**; recreate it the same way, or remove the TTL in the Neon Console if you want to keep it.

## Database (Neon)

- **Driver:** `node-postgres` pool on the pooled URL, which suits a long-running Express server (as the Neon agent skill recommends). **Migrations** run over the direct URL (`DATABASE_URL_UNPOOLED`), since PgBouncer transaction mode breaks session-level statements.
- **Schema as code:** `server/db/schema.ts` → `npm run db:generate` → reviewed SQL in `drizzle/` → `npm run db:migrate`. Migrations are additive. `0001_immutability.sql` adds triggers: frozen snapshot fields cannot change, agreed versions cannot change status, and versions and approvals cannot be deleted.
- The server refuses to start against Postgres with pending migrations and tells you to run `npm run db:migrate`. The embedded PGlite dev database migrates itself.
- **Importing BriefRoom 1.x JSON data:** `npm run db:import-json -- path/to/db.json`. It is idempotent and never modifies the JSON file or uploads. It keeps IDs, customer links, seller keys (re-hashed), Nexconn user/channel IDs and images, and it reports any image file it cannot find.

## Object storage

Uploads go to `POST /api/orders/:id/references` as raw bytes. The server checks the magic number (JPEG/PNG/WebP only), the dimensions and the size (≤ 8 MB, ≤ 12,000 px), computes SHA-256, and stores the bytes under `orders/<orderId>/<refId>-<sha16>.<ext>`. Postgres keeps the key, MIME type, dimensions, hash, uploader and timestamps. Images are read through `GET /api/assets/:refId?sig=…`. That URL is an HMAC-signed capability link, so knowing it grants that single image; it 302-redirects to a 1-hour presigned Neon URL. "Add to brief" on a chat photo imports the image server-side, with an SSRF guard (https only, public IPs only, size and time limits).

## Nexconn setup

1. In the Nexconn Console create (or open) your app. Note its **data centre** and copy the **App Key** and **App Secret**. Create a separate production app or key pair if you have one.
2. Set `NEXCONN_DEV_APP_KEY`, `NEXCONN_DEV_APP_SECRET` and `NEXCONN_REGION` (`sg` / `na` / `sa`) in `.env.local`, then restart. The startup log prints `nexconn: development app abc…xyz · region …`.
3. In production set `NEXCONN_ENVIRONMENT=production` and the `NEXCONN_PROD_*` pair.
4. Live: every order gets the private group `o<orderId>` (seller as owner, customer as member, `joinPerm: 3`), tokens are issued by `POST /api/nexconn/token`, and domain events are published as BR:* messages.

**What uses what.**
- **Platform Chat API** (server): `/v4/auth/access-token/issue`, `/v4/group-channel/create`, `/v4/group-channel/message/send`. Signed with SHA1(secret + nonce + timestamp), with primary/backup domain failover.
- **Chat SDK** (workspace): `NCEngine.initialize/connect`, `registerCustomMessages` (before connect), `MessageHandler`, `ConnectionStatusHandler`, `GroupChannel.sendMessage/sendMediaMessage`, `BaseChannel.createMessagesQuery`.
- **Chat UI** (seller inbox): `NCChatUIApplication`, ServiceHooks, custom BR:* web component.

Verified against the docs fetched from docs.nexconn.ai on 2026-11-22 and against the installed `.d.ts` files. Where they disagreed, the installed code wins: the custom-message field is `isPersisted`, not the documented `isPersited`.

### Verifying Nexconn with real credentials

`npm test` uses a **fake** Nexconn server API: it proves our outbox, idempotency and ordering logic, not the live service. Two opt-in suites run against the **real** Nexconn app in `.env.local`:

```bash
npm run test:live                              # server side: real Platform Chat API, in-memory DB
E2E_ENV_FILE=.env.local npm run test:e2e       # browsers: Neon dev branch + Neon storage + Nexconn
# PowerShell: $env:E2E_ENV_FILE='.env.local'; npm run test:e2e
```

**Verified live on 2026-11-22** (the app's single key pair, labelled *AppKey-Production* in the Console; data centre Singapore = `sg`), all passing:

| Check | How |
|---|---|
| Credentials and region | Server issues tokens on `api.sg-light-api.com` (the `sa` host answered "App-Key is not exist", so `NEXCONN_REGION` is `sg`) |
| Two independent users, private group | Seller (desktop) and buyer (phone) contexts get server-issued tokens and connect; the order's group `o<orderId>` is created on Nexconn with exactly the two participants (`joinPerm: 3`) |
| Real-time text, both directions | Delivered without reloads; sender sees the SDK's sent/read state |
| Image message | Uploaded through Nexconn by the buyer, received by the seller with an https URL |
| BR:* custom events | Three events in a row refresh the other side live and arrive in order, exactly once, each with a Nexconn message ID |
| Idempotency | Replaying an approval with the same `Idempotency-Key` → one event, one message; creating an existing group → `25409` handled as "exists" |
| Retries and ordering | One injected network failure (both API domains) → event goes into backoff, later events of that order wait, the retry succeeds against the real API and all three arrive in seq order |
| History | After a reload the conversation (texts, photo, activity cards) comes back from the Nexconn server |
| Reconnection | Buyer goes offline, seller sends, buyer reconnects (pill returns to **Live**) and receives the missed message |
| Seller inbox (Chat UI) | Lists the order conversation by title and renders the BR:* cards with BriefRoom's component (Chat UI registers it as `<nc-c-br-activity>`) |

**Cross-checked in the Nexconn Console (Polaris → Data Tracking), 2026-11-22.** For the final run's group, *Message Status* lists every message once, with the same message IDs our `domain_events` table recorded. That covers the 9 server-sent `BR:*` events in seq order, the two clients' texts and the photo (source *Web*), and the text sent while the buyer was offline. *Delivery Status* for the approval event shows the other participant as **delivered successfully**, and *Connection Status* shows the buyer's second Web session starting 5 s after that offline message (the reconnect). **Usage → Chat** (MAU, concurrent connections, storage) is refreshed once a day (last update 11/21 15:59:59 UTC at check time), so the day's traffic shows there the next day.

## Testing

| Suite | Command | What it proves |
|---|---|---|
| Unit | `npm test` | Snapshot hashing (identical / spec / asset hash / coordinates), canonical JSON, diffs, geometry under resize, byte-level image validation, rules engine, AI grounding (hallucinated evidence dropped), Nexconn signing + failover |
| Integration | `npm test` | Real migrations on Postgres (PGlite) through the real HTTP API. Full golden path; single approvals don't agree; cross-version and wrong-hash approvals are rejected; idempotent decisions; concurrent final approvals give exactly one `ORDER_AGREED`; DB-level immutability; access control; signed asset URLs; outbox ordering, retries and one channel per order; honest "skipped" without Nexconn |
| E2E | `npm run test:e2e` | Seller (1440 px desktop) and buyer (390 px touch phone) in two contexts, from an empty shop to an agreed order and work order (all 21 steps of the brief); theme persistence and no flash; System theme; no overflow or console errors at 1440/1280/1024/768/390/360 px in both themes; mobile touch targets |
| Design | `npm run check:contrast` | 80 WCAG contrast checks over both palettes |
| Live server | `npm run test:live` | Real Nexconn Platform API: token issuance in the configured region, idempotent group creation, outbox retry + per-order ordering with an injected failure. Skipped without credentials |
| Live browsers | `E2E_ENV_FILE=.env.local npm run test:e2e` | The E2E suite above **plus** `e2e/nexconn-live.spec.ts` (9 live checks, see the table above) against the services in that file. Use a Neon **dev** branch. The live spec skips itself when the server has no Nexconn keys |

## Deployment

The Render Blueprint is [`render.yaml`](render.yaml). It is a single stateless web service in the **Ohio** region, next to Neon `us-east-2`.

1. Push the repo, then in Render use **New → Blueprint** and select it.
2. Fill the `sync: false` variables (Render asks only once, at creation): `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` from the Neon **production** branch, `NEXCONN_PROD_APP_KEY/SECRET`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (production branch storage), `OPENAI_API_KEY`, `XAI_API_KEY`. Get the Neon production values with `neon env pull --branch production --file .env.render` (gitignored). `SESSION_SECRET` is generated and `PUBLIC_URL` falls back to `RENDER_EXTERNAL_URL`.
3. Build: `npm ci --include=dev && npm run build` (`NODE_ENV=production` is visible at build time and would otherwise make npm skip the devDependencies the build needs). Pre-deploy: `npm run db:migrate` (paid plans only; the Blueprint uses `starter`). Start: `npm start`. Health check: `/api/health` (`?deep=1` also checks the database, a storage round-trip, Nexconn and the AI chain).
4. **Nexconn environment:** the app has a single key pair, labelled *AppKey-Production* in the Console, so the Blueprint uses `NEXCONN_ENVIRONMENT=production` with that pair as `NEXCONN_PROD_APP_KEY/SECRET`. Locally, `.env.local` holds the same pair under `NEXCONN_DEV_*`. It is the same app, so that works.
5. After deploy: open `https://<your-url>/api/health?deep=1`, run the golden path on two devices, and confirm an uploaded image still loads after a redeploy. Images live in Neon Object Storage, not on the instance.

Verified locally before deploying (2026-11-22): a clean checkout of only the committable files builds with the command above under `NODE_ENV=production`, and the server boots with the production configuration (production Neon branch, production bucket, Nexconn `sg`, AI chain): `pendingMigrations: 0` and a green deep health check. Not yet verified: an actual Render deploy and a real phone against it.

Any Node host works, with the same commands and variables.

## Known limitations

- **Nexconn SDK console errors (vendor-side):** the SDK uploads its own diagnostics to the log collector named in Nexconn's server-side configuration (`logcollection.ronghub.com`). That host's CORS preflight rejects the SDK's own `X-User-Agent` header, so every browser logs a CORS error plus a failed request. Chat is unaffected, and the public SDK API (`NCEngine.initialize`: `appKey`, `logLevel`, `areaCode`) has no switch to turn the upload off, so it needs a fix from Nexconn. The E2E console checks ignore exactly that host (`e2e/support/console.ts`).
- **One Nexconn app for local testing and production:** both use the app's single key pair, so local test traffic counts toward its usage (Chat Free: 2,000 MAU, 100 concurrent connections). To keep them apart, create a second app in the Console for development and put its keys in `.env.local`.
- `node-postgres` prints a deprecation warning ("client.query() while a query is executing") for concurrent queries inside one transaction. pg 8 queues them correctly and `package.json` pins `pg@^8`; revisit before upgrading to pg 9.
- **Chat UI has no theming API**, verified in its bundle, so the seller **inbox** stays light in dark mode. The workspace conversation is BriefRoom's own themed UI.
- Web SDK history is fetched from the server on every load (the Web SDK has no local store). Reactions and quoted replies are not exposed in the custom workspace chat; Chat UI provides them in the inbox.
- **No accounts:** access is by capability links (seller dashboard link, customer order link). Losing a link means asking the other side or using the dashboard link stored on another device.
- **Ambiguity detection is advisory:** rules use English keyword patterns, and AI output only counts when its quoted evidence appears verbatim in the brief or chat.
- Presigned image URLs expire after 1 hour, but the signed app URLs that redirect to them never do. Revoking an image link requires rotating `SESSION_SECRET`, which invalidates all image links.
- The SHA-256 fingerprint proves *which version* was approved. It is not a legal contract or an e-signature.

## Manual tasks remaining

1. **Nexconn:** report the `logcollection.ronghub.com` CORS issue to Nexconn. The message-level Console check is done (see "Verifying Nexconn"). Check **Usage → Chat** the day after testing for the MAU figure, if you want a screenshot for the submission.
2. **Review and commit** the 2.0 working tree, then push it to the repository Render deploys from.
3. **Deploy** with the Blueprint, entering the values from your local `.env.render` (production Neon branch + keys). After the first deploy, open `/api/health?deep=1`.
4. **Real phone:** run the golden path on a phone over mobile data against the deployed URL, then record the demo.
5. **Submission:** fill the App Key, live URL, repo and video links in `SUBMISSION.md`.

## License

MIT
