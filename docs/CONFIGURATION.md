# Configuration reference

How BriefRoom is configured: environment variables, Neon Postgres, object storage, Nexconn and the optional AI providers. Quick start: [README](../README.md#run-it-locally). Every variable is also listed, without values, in [`.env.example`](../.env.example).

## Environment variables

Only the server reads environment variables; the browser gets its public settings from `GET /api/config`. In production, invalid settings stop the server with an actionable checklist. In development they switch off the affected feature, with a warning; nothing is simulated.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | – | `production` enables strict validation |
| `PORT` | – | API port (default 8787) |
| `PUBLIC_URL` | **prod** | Public HTTPS origin used in share links. Rejected if it points at localhost in production. On Render it defaults to `RENDER_EXTERNAL_URL`, so set it only for a custom domain |
| `DATA_DIR` | – | Development data folder (embedded database, local uploads, generated dev secret). Default `./data` |
| `SESSION_SECRET` | **prod** | At least 32 random characters; signs reference-image URLs. Generated automatically in development |
| `DATABASE_URL` | **prod** | Neon **pooled** connection string (host contains `-pooler`) for application queries. Without it, development uses an embedded PGlite database |
| `DATABASE_URL_UNPOOLED` | for migrations | Neon **direct** connection string, used by `npm run db:migrate` |
| `NEXCONN_ENVIRONMENT` | – | `development` or `production`: chooses the key pair (defaults to `production` when `NODE_ENV=production`) |
| `NEXCONN_DEV_APP_KEY` / `NEXCONN_DEV_APP_SECRET` | for chat | Key pair used when `NEXCONN_ENVIRONMENT=development` (Nexconn Console → App Key) |
| `NEXCONN_PROD_APP_KEY` / `NEXCONN_PROD_APP_SECRET` | for chat in prod | Key pair used when `NEXCONN_ENVIRONMENT=production` |
| `NEXCONN_REGION` | with keys | `sg`, `na` or `sa`, matching your app's data centre. Sets both the Server API hosts and the Chat SDK `AreaCode`. A wrong value fails token issuance with "App-Key is not exist" |
| `UPLOAD_PROVIDER` | – | `s3` (default when `AWS_ENDPOINT_URL_S3` is set) or `local` |
| `UPLOADS_DIR` | – | Local provider folder (default `DATA_DIR/uploads`) |
| `S3_BUCKET` | – | Bucket name (default `assets`, declared in `neon.ts`) |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | for s3 | Neon Object Storage credentials (written by `neon deploy` / `neon env pull`) |
| `AI_PROVIDER` | – | `auto` (default: OpenAI first, Grok as fallback) · `openai` · `xai` · `rules` (no AI) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – | Enables OpenAI suggestions; default model `gpt-4o-mini` |
| `XAI_API_KEY` / `XAI_MODEL` | – | Enables Grok (xAI) suggestions through its OpenAI-compatible API; default model `grok-4.20-non-reasoning` |
| `DEMO_POOL_SIZE` | – | Ready-made live demos (`/demo`) kept waiting so the page opens instantly; another is seeded in the background after each one is taken. Default `2` in production, `1` in development, `0` in test. `0` seeds on demand |

The Neon CLI also writes `NEON_BRANCH`, `NEON_BRANCH_ID` and `NEON_FUNCTION_HOST_SUFFIX`; BriefRoom ignores them. All secret-bearing files (`.env`, every `.env.*` except `.env.example`, and `.neon`) are gitignored.

## Database (Neon Postgres)

- **Driver.** A `node-postgres` pool on the pooled URL, which suits a long-running Express server. Migrations run over the direct URL, because PgBouncer's transaction mode breaks session-level statements.
- **Schema as code.** `server/db/schema.ts` → `npm run db:generate` → reviewed SQL in `drizzle/` → `npm run db:migrate`. Migrations are additive. `0001_immutability.sql` adds triggers that stop frozen snapshot fields or an agreed version's status from changing and block deletes of versions and approvals.
- **Safety.** The server refuses to start against Postgres with pending migrations. The embedded PGlite database used in development migrates itself.
- **Branches.** Use a Neon development branch for local work (`neon checkout dev --create`). The Neon CLI then rewrites only its own variables in `.env.local`. Branches created under the `neon.ts` policy expire after 7 days.
- **Importing BriefRoom 1.x data.** `npm run db:import-json -- path/to/db.json` is idempotent and never modifies the source file. It keeps IDs, customer links, seller keys (re-hashed), Nexconn user and channel IDs and images, and reports any missing image file.

## Object storage

1. **Upload.** `POST /api/orders/:id/references` accepts raw image bytes.
2. **Validation.** The server checks the file's magic number (JPEG, PNG or WebP only), its dimensions (≤ 12,000 px) and its size (≤ 8 MB), and computes a SHA-256.
3. **Storage.** The bytes are stored under `orders/<orderId>/<refId>-<sha16>.<ext>`. Postgres keeps the key, MIME type, dimensions, hash, uploader and timestamps.
4. **Reading.** Images are served through `GET /api/assets/:refId?sig=…`, an HMAC-signed link that grants exactly one image and redirects to a 1-hour presigned Neon URL.
5. **Chat photos.** "Add to brief" on a chat photo imports it server-side behind an SSRF guard: https only, public IPs only, size and time limits.

## Nexconn

1. In the Nexconn Console, open your app. Note its **data centre** and copy the **App Key** and **App Secret**.
2. Put the pair and `NEXCONN_REGION` in `.env.local`, then restart. The startup log prints `nexconn: <environment> app abc…xyz · region …`.
3. In production, set `NEXCONN_ENVIRONMENT` and the matching key pair in your host's environment.

**What BriefRoom uses:**
- **Platform Chat API (server)**
  - endpoints: `/v4/auth/access-token/issue`, `/v4/group-channel/create`, `/v4/group-channel/message/send`
  - every request signed with SHA1(secret + nonce + timestamp)
  - failover between the primary and backup domains
- **Chat SDK (workspace)**
  - `NCEngine.initialize/connect` and `registerCustomMessages` (before connect)
  - `MessageHandler` and `ConnectionStatusHandler`
  - `GroupChannel.sendMessage/sendMediaMessage` and `BaseChannel.createMessagesQuery`
- **Chat UI (seller inbox)**
  - `NCChatUIApplication` with ServiceHooks scoped to the seller's own shop
  - a custom web component renders BR:* cards; Chat UI registers it as `<nc-c-br-activity>`

Every order gets the private group `o<orderId>`, with the seller as owner, the customer as member, and `joinPerm: 3`. Tokens are issued by `POST /api/nexconn/token` for participants of that order only. This integration was checked against the docs at docs.nexconn.ai and the installed type definitions. Where they disagreed, the installed code wins: the custom-message field is `isPersisted`, not the documented `isPersited`.

## AI ambiguity check (optional)

Deterministic rules always run. With `OPENAI_API_KEY` and/or `XAI_API_KEY`, an AI model also proposes clarifying questions:
- **Output format.** The model's output must match a JSON schema.
- **Evidence.** Every suggestion must quote text that exists verbatim in the brief or chat; anything it cannot ground is dropped.
- **Fallback.** If the first provider fails, the other one is tried.
- **Advisory only.** Suggestions never change the brief.
