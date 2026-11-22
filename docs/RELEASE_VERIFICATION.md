# Release verification

*Maintainer record for BriefRoom 2.0 (2026-11-22). Public overview: [README](../README.md) · configuration: [CONFIGURATION.md](CONFIGURATION.md) · build history: [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md).*

## How to re-run the live checks

`npm test` uses a **fake** Nexconn server API. It proves the outbox, idempotency and ordering logic, not the live service. Two opt-in suites use the real Nexconn app configured in `.env.local`:

```bash
npm run test:live                              # server side: real Platform Chat API, in-memory DB
E2E_ENV_FILE=.env.local npm run test:e2e       # browsers: Neon dev branch + Neon storage + Nexconn
# PowerShell: $env:E2E_ENV_FILE='.env.local'; npm run test:e2e
```

Point `.env.local` at a Neon **development** branch before running the browser suite, because it writes test data.

## Live Nexconn results (2026-11-22)

These ran against the app's single key pair, which the Console labels *AppKey-Production*, in data centre Singapore (`sg`). All passed.

| Check | How |
|---|---|
| Credentials and region | The server issues tokens on `api.sg-light-api.com`. The `sa` host answered "App-Key is not exist", so `NEXCONN_REGION` was corrected to `sg` |
| Two independent users, private group | A seller (desktop) context and a buyer (phone) context get server-issued tokens and connect. The order's group is created on Nexconn with exactly the two participants (`joinPerm: 3`) |
| Real-time text, both directions | Delivered without reloads; the sender sees the SDK's sent/read state |
| Image message | Uploaded through Nexconn by the buyer and received by the seller with an https URL. Only this direction was tested |
| BR:* custom events | Three events in a row refresh the other side live and arrive in order, exactly once, each with a Nexconn message ID |
| Idempotency | Replaying an approval with the same `Idempotency-Key` gives one event and one message. Creating an existing group returns `25409`, which is handled as "exists" |
| Retries and ordering | One network failure was injected on both API domains. The event went into backoff and later events of that order waited. The retry then succeeded against the real API, and all three events arrived in seq order |
| History | After a reload, the conversation (texts, photo, activity cards) comes back from the Nexconn server |
| Reconnection | The buyer goes offline and the seller sends a message. The buyer reconnects (the pill returns to **Live**) and receives the missed message |
| Seller inbox (Chat UI) | Lists the order conversation by its title and renders the BR:* cards with BriefRoom's component |

Full suite on that stack: 13/13 Playwright tests and 3/3 live server tests. Credential-free default: E2E 4 passed, with the live spec skipped by design; unit and integration 38/38; contrast 80/80.

## Nexconn Console cross-check (Polaris → Data Tracking)

- **Message Status** lists every message of the final run's group once, with the same message IDs recorded in `domain_events`. That covers the server-sent `BR:*` events in seq order, the clients' texts and photo (source *Web*), and the text sent while the buyer was offline.
- **Delivery Status** for the approval event shows the other participant as *delivered successfully*.
- **Connection Status** shows the buyer's second Web session starting 5 s after the offline message, i.e. the reconnect.
- **Usage → Chat** (MAU, concurrent connections, storage) is refreshed once a day, so a day's traffic appears there the next day. Plan: Chat Free (2,000 MAU, 100 concurrent connections).

## Production readiness (checked locally, not yet deployed)

- **Clean checkout:** only the committable files, built with `npm ci --include=dev && npm run build` under `NODE_ENV=production`, build successfully. Without `--include=dev`, npm skips the devDependencies the build needs.
- **Production boot:** the production configuration (production Neon branch, production bucket, Nexconn `sg`, AI chain) starts with `pendingMigrations: 0`. `/api/health?deep=1` is green, including a storage round-trip.
- **Secrets:** no secret values or credential patterns appear in the committable files or in any commit.

## Deploying (Render)

1. Pull the production branch's Neon values into a gitignored file: `neon env pull --branch production --file .env.render`, then add the Nexconn and AI keys. Review it.
2. In Render, use **New → Blueprint** and select the repository and branch. Enter the `sync: false` values from `.env.render` when asked; Render prompts only once.
3. After the first deploy:
   - open `/api/health?deep=1`
   - run the golden path on two devices, one of them a real phone on mobile data
   - confirm an uploaded image still loads after a redeploy
   - delete `.env.render` if you no longer need it

## Open items

- **Vendor issue, to report to Nexconn:** the SDK uploads its diagnostics to `logcollection.ronghub.com`, whose CORS preflight rejects the SDK's own `X-User-Agent` header. Browsers log a CORS error, but chat is unaffected.
- **Not yet verified:** an actual Render deploy, and a real phone against it.
