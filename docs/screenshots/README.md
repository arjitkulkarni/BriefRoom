# Screenshots — BriefRoom 2.0 (light and dark)

Captured 2026-11-22 with Playwright (headless Chromium) from the production build, on demo data created through the real API. Every file exists as `-light.jpg` and `-dark.jpg`. No console errors and no horizontal overflow were recorded during capture.

| File | Screen |
|---|---|
| `landing-desktop-*` | Landing page, full length, 1440 px |
| `landing-mobile-*` | Landing hero, 390 px phone |
| `start-*` | Seller onboarding |
| `dashboard-desktop-*` | Seller dashboard: pipeline filters, order cards, recent activity |
| `workspace-desktop-*` | Workspace, seller view: annotations rail, reference canvas, version 2 approval card + comparison |
| `workspace-thread-*` | Workspace, customer view: a selected region (spotlight) with its discussion, Clarification Radar |
| `workspace-laptop-*` | Workspace at 1024 px: two columns, specification editor |
| `workspace-mobile-*` | Workspace at 390 px: canvas, annotation list, bottom tab bar |
| `workspace-mobile-versions-*` | Mobile versions tab: approval card and comparison |
| `agreed-desktop-*` | Agreed order: "Order agreed" card with the full fingerprint |
| `workorder-*` | Printable A4 work order |
| `design-system-*` | `/design-system` component and token reference |

Live chat shows "Live sync off" in these captures because no Nexconn credentials were configured. The UI says so honestly instead of simulating messages.
