# Submission form: paste-ready (BriefRoom 2.0)

**Track:** Marketplace & Support · **Main platform:** Web · **Packages:** Chat SDK + Chat UI + Platform Chat API

---

**Project name:** BriefRoom

**One-liner:** Custom orders, without the guesswork — from "something like this" to exactly what we agreed to make.

**The problem**
Custom orders (cakes, printed merch, furniture, jewellery) start with a screenshot and "make it like this, but…". Small sellers run them on chat apps. After dozens of messages and voice notes, nobody can say which colour, what size, or which version was finally confirmed. Chat is great for talking and terrible for agreeing.

**What it does**
Every order gets a private room shared by the customer and the seller:
- **Spatial conversations.** Mark an exact region of a reference image (keep, change colour, remove, add, question) and discuss it right there. A region only counts as resolved when the other person confirms.
- **Clarification Radar.** Open questions, missing required details and critical issues sit on one shared board. Critical items block the next version. An ambiguity check (deterministic rules, plus OpenAI or Grok when configured) suggests questions with quoted evidence. It never edits the brief.
- **Versions with visual diffs.** Each proposal is a frozen snapshot with a SHA-256 fingerprint. A before/after slider and a field-by-field diff show exactly what changed.
- **Dual approval.** The order becomes **agreed** only when the backend verifies, in one transaction, that both people approved the same version ID and hash. That produces a printable A4 work order with the full fingerprint.
- **Seller dashboard.** A pipeline across six states with recent activity, plus a Nexconn Chat UI inbox for every order conversation.

**Nexconn features used**
- **Platform Chat API (server):**
  - `/v4/auth/access-token/issue` (seller/customer identities, server-issued tokens, re-issue on expiry).
  - `/v4/group-channel/create`: one private group per order (`joinPerm: 3`); idempotent, so code 25409 counts as "exists".
  - `/v4/group-channel/message/send`: domain events published as BR:* custom messages from the acting user, with `isEchoToSender`, through a transactional outbox with retries and per-order ordering.
  - Signed requests with primary/backup domain failover; dev/prod key pairs; data centre selected by configuration.
- **Chat SDK (workspace):**
  - `NCEngine.initialize/connect`, with `registerCustomMessages` before connect (12 BR:* types).
  - `MessageHandler` for live sync, `ConnectionStatusHandler` (reconnecting/kicked states), `GroupChannel.sendMessage/sendMediaMessage`, `BaseChannel.createMessagesQuery` (history).
  - A custom, fully themed (light/dark) conversation UI with activity cards that are verified against the backend.
- **Chat UI (seller inbox):** `NCChatUIApplication` with ServiceHooks (profiles, groups, members), a custom BR:* message web component, and digest text for the channel list.

**Architecture:** React 19 + Tailwind v4 SPA; Express API; Neon Postgres (Drizzle migrations, DB-level immutability triggers for versions and approvals) and Neon Object Storage (private bucket, presigned reads). The backend owns the agreement, and Nexconn carries the communication. See README.

**What existed before vs. built during the challenge:** BriefRoom 1.x was built during the challenge. 2.0 is a rebuild during the challenge: new design system, Postgres persistence, the outbox, the agreement engine, the Radar, version diffs and the custom SDK chat.

**Nexconn App Key:** `PASTE_YOUR_APP_KEY`

**Live app:** `https://…` · **Repo:** `https://github.com/…` · **Demo video:** `https://…`

**Traction:** Numbers are counted live from the database at `https://…/stats`. Add Nexconn Console MAU screenshots only once real usage exists.
