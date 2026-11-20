# Submission form: paste-ready

**Track:** Marketplace & Support · **Main platform:** Web · **Packages:** Chat SDK + Chat UI

---

**Project name:** BriefRoom

**One-liner:** From "something like this" to exactly what we agreed to make.

**Why we built it / the problem**
Custom orders (cakes, printed merch, furniture) start with a screenshot and "make it like this, but…". Small sellers in India run these orders on WhatsApp and Instagram DMs.
After 40 messages and voice notes, nobody can say which pink, what size, or whether the price included the topper. The result is wrong orders, remakes, refunds and bad reviews.
Chat is great for talking but terrible at agreeing.

**What it does**
BriefRoom gives every custom order a room. The conversation (Nexconn Chat UI) sits next to a visual brief.
- The customer uploads reference photos, or adds any photo from the chat.
- Either side drags over a region of the photo to say *keep this*, *change colour to #f4a7c0*, *remove*, *add text* or *question*.
- Each pin lands in the chat as a card showing that exact region.
- Size, flavour, message, date and the seller's quoted price go into a structured checklist.
- "Propose version" freezes everything into a hashed version with a diff.
- The order is agreed only when **both sides approve the same version**. It then becomes a printable work order with an agreement fingerprint.
- Sellers get a dashboard with an order pipeline, a shop link for their Instagram bio, and a Chat UI inbox of all customer conversations.

**Nexconn SDK features used**
- **Server API:** `/v4/auth/access-token/issue` (seller and customer identities, signed server-side with domain failover) and `/v4/group-channel/create` (one private group per order: seller as owner plus the customer, nobody else can join).
- **Chat UI:**
  - `nc-chat-ui-app-provider` for the order conversation and the seller inbox, with the channel list toggled per screen
  - ServiceHooks `reqUserProfiles`, `reqGroupProfiles`, `reqGroupMembers` backed by our API
  - **6 custom message types rendered with custom Web Components**: `BR:Start`, `BR:Ref`, `BR:Pin` (crop of the pinned region), `BR:Spec` (diff), `BR:Version` (price, changes, hash), `BR:Decision` (approved / changes / agreed / reopened)
  - a **custom message-menu item "Add to brief"** on image messages (`cloneMessageMenu`, `setMessageMenu`, `registerLanguagePack`, `MESSAGE_MENU_ITEM_CLICK`)
  - `CHANNEL_SELECTED` and `openChannel(GroupChannelIdentifier)`
  - reactions, message editing and message state enabled
- **Chat SDK:** `NCEngine.initialize/connect`, `registerCustomMessages`, `MessageHandler.onMessageReceived` (live sync of the brief when the other side acts), `SendMessageParams` through `app.sendMessage`.

**Architecture and decisions:** Nexconn carries the conversation and the server owns the agreement. Approvals bind to a SHA-256 hash of the frozen version, and every action posts a typed card so the chat is the audit trail. There's one group channel per order. Details, known limitations and the roadmap are in the README.

**What existed before vs. built during the challenge:** everything was built during the challenge. Nothing existed before.

**Nexconn App Key:** `PASTE_YOUR_APP_KEY`

**Live app:** `https://…` · **Repo:** `https://github.com/…` · **Demo video:** `https://…`

**Traction:** `N sellers · N briefs · N agreed orders · N Nexconn users`. Live numbers: `https://…/stats`. Add screenshots of the Nexconn console MAU and of agreed work orders, plus seller quotes.
