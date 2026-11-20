# BriefRoom

**From "something like this" to exactly what we agreed to make.**

BriefRoom turns a customer's vague reference photo into a clear, versioned visual brief that **buyer and seller both approve**. The whole conversation stays attached to it.
It's built for custom-order businesses (home bakers first, then printed merch and furniture) on the **Nexconn Chat SDK** and **Nexconn Chat UI**.

> Nexconn Build Challenge 2026 · Track: **Marketplace & Support** · Platform: **Web**

---

## The problem

Every custom order starts with a screenshot and "make it like this, but…".

A home baker in Pune gets a Pinterest photo on WhatsApp: *"like this but pink, and write Happy 25th."* Forty messages, three voice notes and two days later:
- *Which* pink? *Which* flowers, the big ones or the small ones?
- Was it 1 kg or 1.5 kg? Eggless? Did ₹1,800 include the topper?
- The cake is delivered and the customer says *"that's not what I asked for."* The baker scrolls back through 200 messages to prove what was agreed. Nobody can.

The cost is real: remakes, refunds, angry reviews, and hours of clarification per order. Every small seller who makes things to order (cakes, printed merch, furniture, jewellery, tailoring) has this problem.
**Chat is great for talking. It's terrible at agreeing.**

## The solution

One **brief room** per order. The chat is on the left and the brief is on the right, and the two are wired together.

1. **Reference photos.** The customer uploads "something like this", or long-presses any photo in the chat and taps **Add to brief**.
2. **Region pins.** Either side drags over a part of the photo and says exactly what they mean:
   ✅ *Keep exactly* · ✏️ *Change this* · 🎨 *Change colour* (with an exact colour) · 🚫 *Remove* · 🔤 *Add text* · ❓ *Question*.
   Each pin appears in the chat as a card showing a **crop of that exact region**. Tap it and the brief zooms to the pin.
3. **Structured spec.** Size, tiers, flavour, eggless, frosting, colour palette, message on cake, delivery date, slot, pickup or delivery, and the quoted price (seller only).
   Required fields act as a checklist, so nobody can approve an incomplete brief.
4. **Versions.** "Propose version 3" freezes the photos, pins and spec into a **hashed snapshot** and shows a diff (*"Size: 1 kg → 1.5 kg, Pin #4 added: colour #f4a7c0"*).
5. **Dual approval.** The order is only **agreed** when **both sides approve the same version**. Any change after that becomes a new version. The agreed brief becomes a printable **work order** with an **agreement fingerprint (SHA-256)**: proof of what was agreed, for both sides.

**The winning moment in the demo:** two people turn an ambiguous Pinterest screenshot into an approved, priced order in about 3 minutes, without losing a word of the discussion.

## Who it's for

| | |
|---|---|
| **First users** | Home bakers and small cake studios selling through Instagram and WhatsApp (very common in Indian cities) |
| **Also fits** | Custom merch printers, furniture makers. The template engine already includes 🎂 cakes, 👕 merch and 🪑 furniture |
| **Who pays** | The **seller**. BriefRoom cuts clarification time and wrong orders, which are their biggest hidden costs |
| **How sellers get customers in** | A **shop link** in the Instagram bio. Customers open it, start their own brief, and never need to install an app or sign up |

## Product tour

| Screen | What happens |
|---|---|
| `/` | Landing page: the problem, how it works, call to action |
| `/start` | Seller creates a shop in 20 seconds (name, city, what they make) |
| `/seller/:shopId` | **Seller dashboard**: order pipeline (Collecting details → Awaiting approval → Changes requested → Agreed), agreed revenue, new brief with a WhatsApp-ready invite link, shop link, and a **Chat UI inbox** of all customer conversations |
| `/shop/:shopId` | Public shop page. The customer types their name, picks what they want, and lands in their own brief room |
| `/o/:orderId` | **Brief room**: Chat UI conversation, plus a visual brief (photos and pins), details (spec), and versions (diffs and approvals) |
| `/o/:orderId/work-order` | Printable agreed work order with pins, spec table, approval timestamps and the agreement fingerprint |
| `/stats` | Live public usage numbers (traction proof) |

## How Nexconn powers it

| Nexconn capability | How BriefRoom uses it | Code |
|---|---|---|
| **Server API: issue access token** (`/v4/auth/access-token/issue`) | Seller and customer identities. Signed server-side with primary/backup domain failover; the App Secret never reaches the browser | [server/nexconn.ts](server/nexconn.ts) |
| **Server API: create group channel** (`/v4/group-channel/create`) | One private group per order (seller as owner plus the customer). `joinPerm: 3`, so nobody else can join | [server/nexconn.ts](server/nexconn.ts) |
| **Chat UI app shell** (`<nc-chat-ui-app-provider>`) | The order conversation (text, images, files, replies, reactions, editing, read state) in the brief room, and the seller's **inbox** with the built-in channel list | [src/components/ChatUIPanel.tsx](src/components/ChatUIPanel.tsx) |
| **Chat UI ServiceHooks** | `reqUserProfiles`, `reqGroupProfiles`, `reqGroupMembers` backed by our API, so conversations read "🎂 Priya · Aditi's 25th birthday cake" | [src/lib/nexconn.ts](src/lib/nexconn.ts) |
| **Chat UI custom messages + Web Components** | 6 custom card bubbles: `BR:Start`, `BR:Ref`, `BR:Pin` (renders a crop of the pinned region), `BR:Spec` (diff), `BR:Version` (price, changes, hash, *Review* button), `BR:Decision` (approved / changes / **agreed** / reopened) | [src/lib/cards.ts](src/lib/cards.ts) |
| **Chat UI message menu + i18n** | A custom **"Add to brief"** item on image messages turns any photo in the chat into a reference (`cloneMessageMenu`, `setMessageMenu`, `registerLanguagePack`, `MESSAGE_MENU_ITEM_CLICK`) | [src/lib/nexconn.ts](src/lib/nexconn.ts) |
| **Chat UI feature switches & events** | Reactions, message editing and message state switched on; `CHANNEL_SELECTED` links the inbox to the brief room | [src/lib/nexconn.ts](src/lib/nexconn.ts) |
| **Chat SDK** `NCEngine` + `MessageHandler` | Connect with a server-issued token. Incoming `BR:*` messages in the order group trigger a live refresh of the brief on the other side | [src/pages/Room.tsx](src/pages/Room.tsx) |
| **Chat SDK** `SendMessageParams` via `app.sendMessage` | Every brief action posts a card into the conversation, so the chat *is* the audit trail | [src/pages/Room.tsx](src/pages/Room.tsx) |

## Architecture

```
 Customer (phone browser)                         Seller (laptop / phone)
 ┌──────────────────────────────┐                ┌──────────────────────────────────┐
 │ Chat UI conversation  │ Brief │                │ Dashboard · Chat UI inbox · Brief │
 └──────────┬───────────────────┘                └───────────────┬──────────────────┘
            │  text · photos · BR:Pin / BR:Version / BR:Decision cards │
            ▼                                                          ▼
   ┌──────────────── Nexconn group channel  o<orderId>  (seller + customer) ───────────────┐
   │ real-time delivery · history · media · reactions · read state · custom messages        │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
            ▲  token issue, group create (signed Server API)
 ┌──────────┴────────────────────────────────────────────────────────────────────────────┐
 │ BriefRoom API (Express): shops, orders, uploads, brief engine                          │
 │   draft → propose (frozen snapshot + SHA-256) → approve / request changes → agreed      │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key decisions**
- **Nexconn carries the conversation; the server owns the agreement.** The brief (photos, pins, spec, versions, approvals) is authoritative on the server, so approvals can't be forged from a client. Each action also posts a typed card through Nexconn, which notifies the other side and makes the chat a complete, readable audit trail.
- **One group channel per order, not one direct channel per pair.** A repeat customer's three orders stay three separate rooms, each with its own history in the seller's inbox.
- **Chat UI for the conversation, custom Web Components for the cards.** We get a production-grade chat (media, replies, reactions, editing) and spend our time on what's new: the brief.
- **Approval binds to a hash, not to a "latest" pointer.** You approve version 3 by its fingerprint. Any later edit creates version 4 and needs fresh approval from both sides.
- **No accounts.** Sellers get a private key on their device. Customers get a private link. That removes the biggest drop-off for small sellers and their customers.

**Build boundary (deliberate):** no AI image generation and no checkout. BriefRoom does one thing: turn ambiguity into agreement.

**Known limitations**
- Device-bound keys (no login yet). A seller who clears their browser needs their dashboard link again. Phone OTP login is next on the roadmap.
- A JSON-file store and local uploads fit a single instance with a persistent disk. Swap [server/store.ts](server/store.ts) for Postgres plus object storage to scale.
- Minor edits (resolving a pin) sync through a 15 s refresh. Significant actions sync instantly through Nexconn cards.

## Run locally

Requirements: Node 20+ and a free Nexconn account (Free Chat Plan: 10,000 MAU, no card).

1. Create an app at [console.nexconn.ai](https://console.nexconn.ai/agile/register) in the **Singapore** data center. Copy the **App Key** and **App Secret** from the App Key page.
2. Set up and run:
   ```bash
   cp .env.example .env     # paste NEXCONN_APP_KEY and NEXCONN_APP_SECRET
   npm install
   npm run dev              # web :5173 · api :8787
   npm test                 # brief engine tests
   ```
3. Open http://localhost:5173, then **Create your free shop** and **Create brief room**. Open the customer link in a second browser profile, or on your phone over the same Wi-Fi (Vite listens on your LAN IP).

## Deploy

One Node service. With Render, use [render.yaml](render.yaml): build `npm install && npm run build`, start `npm start`, with a persistent disk at `/var/data` (`DATA_DIR`). Set `PUBLIC_URL` to your live URL so share links point at it.

## Roadmap
- Phone OTP login and multi-staff shops
- Side-by-side visual comparison of versions
- Advance payment link after agreement (UPI)
- Seller templates: saved designs, price lists and add-ons
- Optional AI: draft the spec from the conversation (suggestions only, the humans still agree)

## Project layout
```
server/   Express API · Nexconn Server API client · brief engine · JSON store
shared/   Types, Nexconn custom message contracts, product templates, diff
src/      React app · Nexconn Chat SDK + Chat UI bootstrap · card Web Components · pages
tests/    Brief engine tests (node:test)
```

MIT License
