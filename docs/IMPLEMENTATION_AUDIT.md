# BriefRoom — Implementation Audit (Phase 0)

Audit date: 2026-11-22 · Branch: `main` (up to date with `origin/main`, HEAD `f148e07`)

This document records the state of the repository **before** the BriefRoom 2.0 rebuild, the baseline build/test results, and the risks of the migration. It is updated at the end of each stage (see "Stage log" at the bottom).

---

## 1. Baseline verification (run before any change)

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | OK — 135 packages, Node v24.16.0, npm 11.13.0 |
| Typecheck | `tsc -p tsconfig.json --noEmit` | **Pass** (0 errors) |
| Unit tests | `npm test` (`tsx --test tests/*.test.ts`) | **6/6 pass** (brief engine) |
| Production build | `vite build` | **Pass** — single JS chunk 1,505 kB (404 kB gzip); warning: `@nexconn/engine` imports Node `path` (externalized) |
| Git | `git status` | Clean except the untracked master prompt file |

Nexconn credentials were not present (`.env` absent), so no runtime path that touches Nexconn could be exercised. **The existing Nexconn integration has never been verified against a live app** — `PLAN.md` itself expects "1–3 small integration fixes" on first run.

---

## 2. Existing architecture

```
Browser (React 19 SPA, React Router 7, Vite 8)
  ├─ pages: Landing, StartShop, Dashboard, ShopPage, Room, WorkOrder, Stats, NotFound
  ├─ Nexconn Chat SDK (NCEngine) + Chat UI (<nc-chat-ui-app-provider>) — one connection per page load
  └─ custom Chat UI card Web Components (BR:Start/Ref/Pin/Spec/Version/Decision)
        │  REST (x-key header = capability key)
        ▼
Express 5 API (tsx, single process)  ── signed Nexconn Server API (token issue, group create)
  └─ JSON file store (data/db.json, debounced atomic write) + local uploads (data/uploads)
```

* **Identity model**: no accounts. A seller gets a random `sellerKey` stored in `localStorage`; a customer gets a private link `?k=<customerKey>`. Every API call sends the key in `x-key`; `roleFor()` maps it to `seller` / `customer`.
* **Brief engine** (`server/brief.ts`): draft → `propose()` freezes a deep-cloned snapshot and SHA-256 of a canonical JSON → `decide()` approves or requests changes → order agreed when both roles approved the latest version. Reopen (seller) clears `agreedVersion`.
* **Live sync**: the acting client posts a `BR:*` card into the Nexconn group via Chat UI; the other client's `MessageHandler` sees a `BR:*` message and re-fetches the order. A 15 s polling interval runs as a fallback.

## 3. Folder structure (36 tracked files)

```
server/   index.ts (385 lines, all routes) · brief.ts (engine) · nexconn.ts (Server API client) · store.ts (JSON store)
shared/   types.ts (domain types, BR:* contracts, diff, canonicalJSON) · templates.ts (cake/merch/furniture fields)
src/      main.tsx (router) · styles.css (239 lines, single light palette)
          lib/ api.ts · nexconn.ts (SDK + Chat UI bootstrap) · cards.ts (Web Components)
          components/ ChatUIPanel · RefCanvas (image + region pins) · SpecForm · Versions · ui (Logo, Spinner, Toast…)
          pages/ Landing · StartShop · Dashboard · ShopPage · Room · WorkOrder · Stats · NotFound
tests/    brief.test.ts (node:test)
root      README, PLAN (launch plan), SUBMISSION, render.yaml, .env.example, index.html, vite/ts config
```

## 4. Working functionality (by code inspection + tests)

* Shop creation, public shop page, seller- and customer-initiated order creation, capability-key access control.
* Reference image upload (base64 JSON body, 6 MB cap, regex MIME check), "Add to brief" from a chat image (Chat UI message-menu extension).
* Region pins with normalised `x/y/w/h` (0..1) — correct, resize-safe geometry. Six pin kinds incl. colour picks.
* Structured spec with per-template fields, seller-only fields (price/advance), server-side sanitisation of enums/types.
* Versions: frozen snapshot, SHA-256 over canonical JSON, change list, "nothing changed" guard, stale-version guard.
* Dual approval of the **same** version; locking after agreement; seller reopen; printable work order with full hash.
* Nexconn: signed Server API calls (SHA1(secret+nonce+timestamp)) with primary/backup domain failover; one private group per order (`joinPerm: 3`); Chat UI with ServiceHooks, 6 custom card types, reactions/editing switches.

## 5. Broken or fragile functionality

| # | Problem | Impact |
|---|---|---|
| B1 | Order creation **awaits Nexconn** (token + group create). Without credentials, or on any Nexconn error, no order can be created at all. | Whole product unusable without Nexconn; retries can leave half-created state. |
| B2 | Group creation is not idempotent: a retry after a timeout returns error `25409` (already exists) and fails the request. | Duplicate/failed orders on flaky networks. |
| B3 | JSON store: whole DB in memory, debounced write (250 ms) — a crash loses recent writes; no transactions; single instance only. | Data loss; approvals not concurrency-safe. |
| B4 | Approval is **not** bound to the hash the user reviewed — the client sends only the version number. Two near-simultaneous approvals are not serialised. | Weak trust guarantee. |
| B5 | `proposer auto-approves` a complete version on proposal — the proposer never explicitly approves what they froze. | Contradicts "both participants approve". |
| B6 | Upload MIME is checked only from the data-URL prefix (client-claimed); no content sniffing, no stored dimensions/hash. Base64 inflates payloads 33 %. | Spoofable uploads. |
| B7 | `/uploads/*` served publicly with guessable-length random names; no access control. | Images readable by anyone holding a URL. |
| B8 | Live sync falls back to a hard-coded **15 s poll**; minor edits (pin resolve) only sync via that poll. | Explicitly disallowed by the brief. |
| B9 | Nexconn region hard-coded default `SG`; client and server region configured separately (`NEXCONN_AREA` vs domain). | Misconfiguration risk (brief says don't assume Singapore). |
| B10 | Seller key exists only in one browser's `localStorage`; no way to open the dashboard on a second device. | "Persist across devices" fails. |
| B11 | `GET /api/orders/:id` writes a visit row and persists on every read. | Write amplification. |
| B12 | `/api/profiles` and `/api/groups` are unauthenticated and reveal names of any user/order ID. | Information disclosure (low). |
| B13 | Chat UI has a fixed light theme (verified: hard-coded `#fff`, `#F3F5FA`, `#0047FF` in its shadow DOM, no theme API) — cannot follow a dark theme. | Blocks the dual-theme requirement for chat. |

## 6. Missing functionality (vs. the BriefRoom 2.0 brief)

Design system & dark/system themes · `/design-system` · premium landing · dashboard pipeline with 6 states · point annotations, zoom/pan, annotation navigation, contextual threads with two-party resolution · Clarification Radar (OPEN/DISCUSSION/RESOLVED, critical blockers) · AI/rules ambiguity detector · structured visual version diff + comparison slider · transactional approval engine with idempotency · domain events table · Neon Postgres persistence + migrations · object storage provider · dev/prod Nexconn credential pairs · Playwright E2E · health checks with dependency status.

## 7. Dependencies (before)

Runtime: `@nexconn/chat 26.5.1`, `@nexconn/chatui 26.5.0`, `@nexconn/engine 26.5.1`, `express ^5.3.0`, `lit ^3.3.3` (unused directly), `react/react-dom ^19.3.1`, `react-router-dom ^7.18.6`, `tsx ^4.23.15`.
Dev: `typescript ~5.9.3`, `vite ^8.3.8`, `@vitejs/plugin-react ^6.3.0`, `concurrently`, `@types/*`.

Added for 2.0 (all peer-compatible with React 19 / Vite 8, verified with `npm view`):
`pg`, `drizzle-orm` (+ `drizzle-kit`), `zod`, `@aws-sdk/client-s3` + `s3-request-presigner` (Neon Object Storage), `tailwindcss` + `@tailwindcss/vite` 4.3, `radix-ui`, `lucide-react`, `motion`, `sonner`, `react-hook-form` + `@hookform/resolvers`, `class-variance-authority`, `clsx`, `tailwind-merge`; dev: `@electric-sql/pglite` (in-process Postgres for tests), `@playwright/test`. `@neon/config` and `@neon/env` were added by `neon init`.

## 8. Infrastructure provisioned during this session

* `neon init` (user-supplied command) linked org `org-little-wind-45848855`, project `steep-brook-17264548`, branch `production`; created `neon.ts` with one **private** bucket `assets`.
* `neon deploy` (after the user completed browser sign-in) applied `+ bucket assets` on branch `production` (`br-purple-fire-bd2vysci`) and wrote 9 variables to `.env.local` (gitignored): `DATABASE_URL` (pooled, `-pooler` host), `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`.
* Read-only inspection: PostgreSQL 18.7 in AWS `us-east-2`, database `neondb`, **zero tables**, only `plpgsql` installed — the first migration is purely additive.
* `npx skills add … nexconn-chat` was **blocked by the session's permission classifier**; the Nexconn skill was instead read from a read-only clone and its documentation-first workflow followed manually (docs fetched from `docs.nexconn.ai`).

## 9. Proposed architecture (2.0)

```
React SPA (feature folders, Tailwind v4 tokens, Radix primitives, light/dark/system)
  ├─ Workspace conversation: custom React UI on the Nexconn Chat SDK (themeable; renders BR:* as activity cards)
  ├─ Seller inbox: Nexconn Chat UI (channel list across all orders)
  └─ REST /api/* (capability keys)                    Nexconn group channel per order
Express API (modular routers)                            ▲ BR:* custom messages
  ├─ domain services (orders, references, annotations,    │ (server-side, isEchoToSender=1)
  │   clarifications, specs, versions, approvals)         │
  ├─ every mutation = ONE Postgres transaction:  state change + domain_events row (outbox)
  ├─ outbox dispatcher ──────────────────────────────────┘ retries, idempotent channel creation
  ├─ ImageStorageProvider: Neon Object Storage (S3, private bucket, presigned reads) | local disk (dev)
  └─ AmbiguityProvider: OpenAI (optional) | deterministic rules (always available, labelled)
Neon Postgres (Drizzle schema + versioned SQL migrations; pooled URL for app, direct URL for migrations)
```

Key decisions (justified in `docs/FRONTEND_IMPLEMENTATION_PLAN.md` and `README.md`):
1. **Backend owns the agreement; Nexconn carries the communication.** Domain events are written in the same transaction as the state change, then published to the order's group as `BR:*` messages by the server (outbox). The receiving client re-fetches authoritative state — no client can forge an agreement by sending a card.
2. **Order creation no longer depends on Nexconn being up.** The channel row is reserved first (`o<orderId>`), created idempotently (`25409` ⇒ success) and retried by the dispatcher.
3. **Approvals bind to order ID + version ID + snapshot hash**, are serialised with `SELECT … FOR UPDATE` on the order row, and are idempotent per `(version, role)`.
4. **Versions are immutable at the database level** (trigger rejects updates to snapshot/hash).
5. **Workspace chat moves from Chat UI to a Chat-SDK UI** because Chat UI cannot be themed (B13); Chat UI remains for the seller inbox.

## 10. Migration risks

| Risk | Mitigation |
|---|---|
| Existing `data/db.json` users lose data | `npm run db:import-json` maps shops/orders/pins/versions into Postgres (idempotent, keeps the JSON file, copies uploads into the storage provider). Seller keys are re-hashed, customer links keep working. |
| API contract changes break existing share links | Routes `/o/:orderId?k=…`, `/seller/:shopId`, `/shop/:shopId`, `/o/:orderId/work-order` are preserved. |
| Existing version hashes change (new canonical snapshot schema) | Imported versions keep their original hash and snapshot verbatim (`hash_algorithm = 'legacy-v1'`); new versions use `sha256-canonical-v2`. |
| Running migrations against the production branch | Migrations are additive only; generated by drizzle-kit, reviewed, applied over the **direct** URL. Tests run on in-process PGlite, never on Neon production. |
| Nexconn untested with live credentials | Integration code follows the fetched docs + installed `.d.ts`; mocked tests are labelled as such; real-credential checks listed in README "Manual verification". |
| Chat UI → SDK UI for the workspace | Same group channel, same message types; Chat UI still used for the inbox. |

---

## Stage log

* **Stage 1 (audit)**: this document; baseline green.
* **Stage 2 (design research)**: MastryHub inspected with Playwright (computed styles + stylesheets, light/dark, desktop/mobile). Result: 264 verified values and 21 screenshots in `docs/design-references/`, written up in `docs/DESIGN_RESEARCH.md`. `design.md` defines both palettes; 80/80 contrast checks pass (`npm run check:contrast`).
* **Stage 3 (frontend)**: full rebuild. Tailwind v4 tokens, Radix primitives, Light/Dark/System with no flash, landing, onboarding, public shop, dashboard, workspace, work order, `/design-system`. Visual QA screenshots in both themes at 1440/1024/390 px. Fixed during QA:
  * React and React Router bundled twice, giving blank pages ("reading 'useContext' of null"). Root cause: the shell reported the project as `c:\…` while part of module resolution canonicalised it to `C:\…`, so Rolldown held every package under two IDs. Whether a given build broke depended on the module graph. Fixed by building from the canonical real path (`vite.config.ts` resolves `realpathSync.native(cwd)` and `chdir`s to it) plus explicit vendor chunk groups. Verified by printing module IDs from a lowercase-cwd shell. `resolve.dedupe` was tried and made things worse: it split React Router.
  * Panel overflow from flex `min-width: auto`.
  * Mobile hero overflow from a `nowrap` highlight and badge.
  * Markers not selectable while a drawing tool was active. Fixed with click hit-testing.
* **Stage 4 (Neon)**: `neon init` + `neon deploy` (bucket `assets`), Drizzle schema with 13 tables plus immutability triggers. Migrations applied to the `production` branch over the direct URL. Smoke test against the real project (pooled DB + bucket round-trip + signed/presigned image read) passed, and the smoke data was then removed. B3 and B6/B7 fixed.
* **Stage 5 (Nexconn)**:
  * Dev/prod key pairs plus `NEXCONN_REGION` (B9).
  * Transactional outbox publishing BR:* messages server-side, with idempotent channel creation (B1, B2) and per-order ordering.
  * Custom Chat SDK conversation in the workspace (B13), with the Chat UI inbox kept.
  * Event-driven refresh replaces 15 s polling (B8).
  * Not verified live: no credentials in this session.
* **Stages 6–9**: spatial annotations (rect + point, zoom, two-party resolution, threads), Clarification Radar, rules + OpenAI ambiguity detection with evidence grounding, structured version diff and slider, and the transactional dual-approval engine bound to version + hash (B4, B5). Printable A4 work order with in-browser fingerprint verification.
* **Stage 10 (tests)**: final run on 2026-11-22, all passing:
  * Typecheck: clean.
  * Unit + integration: **35/35** (PGlite, real migrations, HTTP API).
  * Contrast: **80/80**.
  * Playwright E2E: **4/4**. Golden path with seller on 1440 px desktop and buyer on a 390 px touch phone, all 21 steps through the A4 work order and in-browser fingerprint verification. Theme persistence with no flash, and System mode. No overflow or console errors at 1440/1280/1024/768/390/360 px in both themes. Mobile touch targets ≥ 40 px.
  * Neon smoke test against the real project on the final build: passed.
  * Live Nexconn not tested (no credentials).
* **Stage 13 (motion + 2.1 visual refresh, 2026-11-22)**:
  * Motion research (`docs/MOTION_RESEARCH.md`, real browser inspection) → three concepts at `/motion-lab` (`docs/MOTION_CONCEPTS.md`) → owner-approved reference design implemented. Stack: Motion (already installed) plus CSS 3D, with no WebGL and no new dependencies.
  * Landing hero rebuilt (`hero-spatial.tsx`). App-wide refresh through tokens and shared components (yellow primary with a WCAG edge, warm dark palette, glass panels, golden page light, radii, official logo files in `public/brand/`). Global `MotionConfig reducedMotion="user"`. Scroll reveals on the landing; motion in the dashboard, chat and radar.
  * QA:
    * typecheck clean; unit + integration **38/38**; default E2E **4/4** (live spec skipped by design); live Nexconn spec re-run after the refresh;
    * contrast **80/80** after syncing the checker with the new tokens (it had still been checking the old values). It caught yellow-on-paper at 1.5:1, fixed with `--primary-edge` #9A6D06 (4.22:1);
    * final screenshots of every screen in both themes with no console errors or overflow (`docs/screenshots/`, `docs/motion-previews/final/`).
  * Submission package in `submission/`: form values, write-up, and a 6-page PDF rebuilt from the verified screenshots.
* **Stage 12 (release verification, 2026-11-22, with the user's credentials)**:
  * Neon: local work moved to a new `dev` branch (`br-restless-bread-bdp7u1j7`, 7-day TTL from the `neon.ts` policy); `production` (`br-purple-fire-bd2vysci`) is used only for the production boot check. `.env.local` keeps the user's keys (the CLI rewrites only Neon variables).
  * Nexconn: the key pair in `.env.local` is valid in data centre **sg**. `NEXCONN_REGION` was set to `sa` (the `sa` host answered "App-Key is not exist") and was corrected to `sg`. The Console shows a single key pair for the app, labelled *AppKey-Production* (data centre Singapore, Chat Free), so the Render Blueprint uses it as `NEXCONN_ENVIRONMENT=production` / `NEXCONN_PROD_*`.
  * Nexconn Console check (user logged in themselves in a separate browser window; read-only): Polaris *Message Status* lists the final run's group messages with the exact IDs our DB recorded (9 `BR:*` server events in order, texts and photo from Web clients). *Delivery Status* shows the approval event delivered successfully to the other participant. *Connection Status* shows the buyer's reconnect 5 s after the offline message. *Usage → Chat* is refreshed daily (last update 11/21 15:59:59 UTC), so it showed 0 at check time.
  * Live server suite `npm run test:live`: **3/3** (token, idempotent group creation, outbox retry + ordering with one injected failure against the real API).
  * Live browser suite `e2e/nexconn-live.spec.ts` against Neon dev + Neon storage + Nexconn: **9/9** (two users, private group, text both ways, image, BR:* events in order exactly once, idempotent approval replay, history after reload, reconnection after a network drop, Chat UI inbox with BR:* cards).
  * Full E2E against the same stack: **12/12** (golden path, live spec, responsive/theme). Default credential-free E2E: **4 passed, 8 live skipped**. Unit + integration: **38/38**. Contrast: **80/80**.
  * Found and fixed: wrong region (above); `render.yaml` build would skip devDependencies under `NODE_ENV=production` (now `npm ci --include=dev`, proven from a clean checkout); `PUBLIC_URL` now falls back to Render's `RENDER_EXTERNAL_URL`; `.gitignore` now covers every `.env.*` except `.env.example`.
  * Added: Grok (xAI) as a second AI provider (`AI_PROVIDER`, OpenAI → Grok fallback); both providers verified live through the app's analyzer.
  * Vendor issue (not fixable in-app): the Nexconn SDK's diagnostics upload to `logcollection.ronghub.com` fails CORS on that host's `X-User-Agent` preflight and logs console errors.
  * Production boot check (no data written): production config validates, `pendingMigrations: 0` on `production`, storage round-trip OK on the production bucket. Not deployed; not tested on a real phone.
* **Stage 11 (docs/deploy)**: README, `.env.example`, `render.yaml` (stateless, Ohio, pre-deploy migrations), and a legacy JSON import tool verified on synthetic 1.x data. B10 fixed with the private dashboard link. B11 and B12 fixed: no write on read, and Chat UI hooks are now seller-scoped.
