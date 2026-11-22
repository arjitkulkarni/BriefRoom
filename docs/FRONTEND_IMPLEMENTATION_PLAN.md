# BriefRoom 2.0 — Frontend Implementation Plan

Date: 2026-11-22 · Source of truth for visuals: [`/design.md`](../design.md) · Backend contracts: `shared/types.ts`, `shared/messages.ts`

## 1. Current frontend (before)

| Item | Finding |
|---|---|
| Framework | React 19.3, TypeScript 5.9, Vite 8 (Rolldown), React Router 7 (`BrowserRouter`, 8 routes) |
| Styling | One 239-line `styles.css`, fixed light "Atelier" palette (`#e4572e` accent), no tokens, no dark mode |
| Components | `ui.tsx` (Logo, Spinner, Toast, StatusChip), `RefCanvas`, `SpecForm`, `Versions`, `ChatUIPanel`; pages hold most logic (Room.tsx 494 lines) |
| State | Local `useState` per page, full order re-fetch on Nexconn `BR:*` messages + **15 s polling** |
| Chat | Nexconn Chat UI web component in the room and the seller inbox |
| Reusable | Normalised pin geometry (kept), template-driven spec form (logic kept), Chat UI hook wiring for the inbox (kept), WhatsApp share helpers, client-side image downscale |
| Broken / duplicated | Status labels duplicated in 3 places; approval UI duplicated (banner + version card); emojis as the only kind indicator; no keyboard access to pins; modal not focus-trapped; `confirm()` dialogs |

## 2. Technology decisions

| Need | Choice | Why |
|---|---|---|
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`, peer `vite ^8` verified) + CSS variables | Semantic tokens in one file, light/dark by swapping variables |
| Primitives | **Radix UI** (`radix-ui` 1.8, React 19 peer verified) wrapped shadcn-style in `components/ui` | Accessible dialogs, menus, tooltips, tabs, popovers; one component library only |
| Icons | **lucide-react** | Consistent stroke icons; annotation kinds get icon + label, never colour alone |
| Motion | **motion** 14 (`motion/react`) with `useReducedMotion` | Subtle, interruptible transitions; respects reduced motion |
| Forms | **react-hook-form + zod** for onboarding/order forms; spec editor stays template-driven | Validation without over-abstraction |
| Toasts | **sonner** | Accessible live-region toasts |
| Workspace chat | **Custom React UI on the Nexconn Chat SDK** | Chat UI has no theming API (hard-coded light colours verified in the bundle) — it cannot follow dark mode; BR:* events render as native activity cards |
| Seller inbox | **Nexconn Chat UI** (channel list across orders) | Ready-made multi-conversation inbox; shown inside a framed panel (light only — documented limitation) |

No React, router or build-tool migration.

## 3. Routes (all preserved; two added)

| Path | Screen | Data |
|---|---|---|
| `/` | Landing | static + `GET /api/config` |
| `/start` | Seller onboarding | `POST /api/shops` |
| `/seller/:shopId` | Seller dashboard (pipeline, activity, inbox) | `GET /api/shops/:id/orders`, `/activity`, Nexconn token (shop) |
| `/shop/:shopId` | Public shop → customer starts a brief | `GET /api/shops/:id`, `POST /api/shops/:id/orders` |
| `/o/:orderId` | **Workspace** (canvas · conversation · radar · spec · versions · approval) | `GET /api/orders/:id` + every command endpoint; Nexconn token (order) |
| `/o/:orderId/work-order` | Printable A4 work order | `GET /api/orders/:id` |
| `/design-system` *(new)* | Internal visual QA of every component in both themes | none |
| `/stats` | Public usage numbers | `GET /api/stats` |

Access keys: seller key in `localStorage` (`br.seller.<shopId>`), customer key from `?k=` then `localStorage`; the key is stripped from the URL immediately. New: a private **dashboard link** (`/seller/:id#k=…`) lets a seller open the dashboard on another device.

## 4. Component architecture

```
src/
  app/            router (lazy routes), providers (theme, tooltip, toaster)
  styles/         globals.css (Tailwind + @theme mapping), tokens.css (light/dark/system variables)
  lib/            api.ts (typed client), keys.ts, format.ts, image.ts, utils.ts (cn)
  hooks/          use-theme, use-media-query, use-order (authoritative order + live refresh)
  services/nexconn/ client.ts (SDK init/register/connect, user switching), use-channel.ts (history + live messages), chatui.ts (inbox)
  components/
    ui/           button, input, textarea, select, label, badge, card, dialog, sheet, dropdown-menu, tooltip, tabs, popover, separator, skeleton, switch
    layout/       logo, theme-toggle, site-header, app-shell
    feedback/     empty-state, error-state, status-badge, connection-pill
  features/
    landing/  shops/  dashboard/  workspace/  references/  annotations/  conversation/
    clarification/  specifications/  versions/  approvals/
  pages/          not-found, design-system, stats
```

Rules: presentation components receive data + callbacks; API calls live in `lib/api.ts`; order state + refresh in `hooks/use-order.ts`; business rules (blockers, status, diff) come from the server or `shared/` — never re-implemented in components.

## 5. Business logic preserved

Normalised annotation geometry · template-driven spec fields with seller-only price · capability-key access · dual approval of the same version · reopen by seller · work order with full fingerprint · "Add to brief" from a chat image · seller inbox · WhatsApp share links.

## 6. Live synchronisation (replaces 15 s polling)

1. Server commits a change + domain event → outbox publishes `BR:*` to the order's Nexconn group.
2. Both clients receive it through `MessageHandler.onMessageReceived` → `use-order` re-fetches `GET /api/orders/:id` (debounced, revision-checked).
3. Without Nexconn credentials the UI states "Live sync off — Nexconn not configured" and refreshes on window focus / manual refresh. No fake messages are ever rendered.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Chat SDK UI untested against a live app (no credentials in this session) | Implemented against the fetched docs + installed `.d.ts`; honest connection/error states; manual verification steps in README |
| Chat UI inbox stays light in dark mode | Framed as an embedded panel with a note; workspace chat is fully themed |
| Large rewrite | Backend contracts covered by 35 tests; Playwright golden path across desktop + mobile contexts |
| Bundle size (Nexconn SDK ~1.4 MB) | Nexconn modules are lazy-loaded only on the workspace/dashboard routes |
