# BriefRoom — Design Research

Date of inspection: **2026-11-22** · Researcher: automated Playwright session (headless Chromium, Playwright 1.65.1, Node 24) · Scope: colour/visual reference for BriefRoom's design system.

> **Use of screenshots:** every image under `docs/design-references/` is an **internal design reference only**. They contain third-party logos, illustrations, fonts and user-generated content. Nothing in them (logos, brand illustrations, fonts, artwork) may be copied into the product.

> **Provenance rule used throughout:** a value marked **verified** was read either from a stylesheet / CSS custom property (downloaded CSS text, cross-checked against the in-page CSSOM) or from `getComputedStyle` of a named element at a stated viewport and theme. Nothing in this document's palette tables was read off a screenshot. Section 9 contains **recommendations**, not findings.

Machine-readable palette with full per-value provenance: [`design-references/mastryhub-colors.json`](design-references/mastryhub-colors.json) (264 entries: 124 CSS-variable values, 140 computed-style values, 0 inferred; includes a WCAG contrast table).

---

## 1. Summary

- **MastryHub has a real dark theme, but it is toggle-only.** Clicking `button[aria-label="Switch to dark mode"]` (inside the slide-out menu) adds `class="dark"` to `<html>` and stores `localStorage.theme = "dark"`; it persists across reloads. **It does not follow `prefers-color-scheme`**: with dark emulation, `/` and `/explore` render **0.000 % different pixels** from light at both 1440×900 and 390×844 (the three home-page screenshots are byte-identical by SHA-256).
- **Two visual modes coexist.** The **landing page** (`/`) is art-directed near-black (`#0A0A0A`) in *both* theme states — `body.landing-page` re-points the theme tokens and forces all `dark:` utility variants (788 `body.landing-page` selector occurrences in the CSS), so toggling changes 0 of 63 matched elements. The **app pages** (e.g. `/explore`) genuinely flip: 81.6 % (desktop) / 79.0 % (mobile) of pixels change.
- **The palette is monochrome-first with one accent.** Light: page `#FFFFFF`, text `#0F0F0F`, secondary `#4B5563`, muted `#6B7280`/`#6D6D6D`, black or `#E5E7EB`/`#D1D5DB` borders. Dark: page `#0F0F0F`, raised `#1A1A1A`, cards `#111111`, text `#FFFFFF`, muted `#9CA3AF`/`#9A9A9A`. The single chromatic accent is **yellow `#FACC15`** (badges shift to `#EAB308` in dark), used in small areas: highlights, indicator squares, offset slabs, hover fills.
- **Theming principle = inversion.** "Selected/primary" is black-on-white in light and white-on-black in dark (category chips, "Install App", calendar buttons). The hard offset shadow on "Sign In" flips from `#000000` to `#FFFFFF`, so the brutalist silhouette survives the theme change.
- **Component language is neo-brutalist.** It uses 2 px **dashed** black/white outlines on controls, 0 px-radius buttons with **hard 4 px offset shadows** that "press" (translate 2–4 px) on hover, and chunky uppercase type: self-hosted `trap` 300–900 in the app; Oswald, Space Mono and decorative display faces on the landing page.
- **Do not copy these weaknesses:**
  - The theme control is hidden in a drawer, and system preference is ignored.
  - The closed off-canvas drawer holds **13 invisible Tab stops**.
  - Focus relies on the browser-default ring.
  - A global `*{border-color:#f003}` makes faint **red** borders appear where a border colour is missing.
  - shadcn-style tokens (`--background`, `--border`, …) have **no dark values**.
  - Card/chip borders are low-contrast (1.24–1.47:1), and landing footer text at white 40–45 % sits below AA.
- **Secondary references:** the most transferable patterns are:
  - Linear's real-product hero, with an **activity feed** (actor · action · time) and agent panel.
  - Window-chrome product previews (Notion, Framer, Figma).
  - Figma's canvas selection handles and **pause control** on auto-advancing content.
  - shadcn's form treatment and complete component-state set.

  Reject Stripe-style animated gradient canvases, backdrop-blur/glass headers as a default, and heavy ambient motion.

---

## 2. Websites inspected

| URL | Date | Method | Viewports | Themes | Status |
|---|---|---|---|---|---|
| https://mastryhub.com/ | 2026-11-22 | Playwright computed styles (role probes plus a census of all visible elements), in-page CSSOM walk of `document.styleSheets`, `curl` + text parse of all CSS (3 Next.js chunks, Google Fonts CSS, inline `<style>` from server HTML), hover/focus probes, screenshots, pixel diff + SHA-256 | 1440×900 (DPR 1); 390×844 (`isMobile`, `hasTouch`, DPR 2) | `prefers-color-scheme` light, dark; theme toggle → dark (clicked); reload persistence | **ok**. Landing is forced dark, so the light/dark toggle produces no visible change here (documented, not a capture failure) |
| https://mastryhub.com/explore | 2026-11-22 | Same as above (app surface that uses the theme tokens); drawer open/closed in both themes | 1440×900; 390×844 | Light emulation, dark emulation (fresh context), toggled dark, toggled back to light | **ok** |
| https://mastryhub.com/events, https://mastryhub.com/hubs | 2026-11-22 | Playwright quick probe (body class, toggle presence, inputs) + screenshot (kept in scratch, not in docs) | 1440×900 | Light | **ok (probe only)**. Confirms app pages use `bg-theme-bg text-theme-text` without `landing-page` |
| https://linear.app/ | 2026-11-22 | Playwright screenshot + DOM observations (header, h1, CTAs, media, running animations, h2 outline, sticky check) | 1440×900 | Light emulation requested | **ok / limited**. Site rendered **dark regardless** (`color-scheme: dark` on `<html>`) |
| https://www.figma.com/ | 2026-11-22 | Same as Linear | 1440×900 | Light | **ok / limited**. First pass: the cookie banner covered the hero (not detectable by id/class). Re-captured after clicking the **non-consent** option "Do not allow cookies". Hero is a rotating carousel, so the screenshot shows one frame |
| https://www.notion.com/ | 2026-11-22 | Same as Linear | 1440×900 | Light | **ok** |
| https://www.framer.com/ | 2026-11-22 | Same as Linear | 1440×900 | Light emulation requested | **ok / limited**. Site rendered **dark regardless**. A cookie component existed in the DOM but is not visible in the captured viewport; nothing clicked |
| https://stripe.com/ | 2026-11-22 | Same as Linear | 1440×900 | Light | **ok**. Announcement bar at top. Nothing clicked (a newsletter-consent text matched the banner heuristic; no reject/close button matched) |
| https://ui.shadcn.com/ | 2026-11-22 | Same as Linear | 1440×900 | Light | **ok** |

All pages returned HTTP 200. No bot protection or CAPTCHA was encountered.

---

## 3. MastryHub analysis

MastryHub is a Web3/hackathon community platform (Next.js). Theme handling lives in Tailwind-style utilities plus a small set of CSS custom properties. The `dark:` variant is compiled as `.dark X` **and** `body.landing-page X`, which is why the landing page is always dark.

### 3.1 Overall light appearance

- **App pages (`/explore`, light):** stark white page (`#FFFFFF`) with near-black body text (`#0F0F0F`) and pure-black headings (`#000000`).
  - Controls are drawn with **2 px dashed black outlines** on white (search field, Filters, city tiles, icon box) with 12 px radius.
  - The active category chip is a **solid black block** with white text; inactive chips are grey (`#4B5563` text, `#D1D5DB` dashed border).
  - Content cards are softer: white with a 3 px `#E5E7EB` border and 16 px radius.
  - Colour is almost absent except a small yellow "Featured" badge, the yellow square inside "Sign In", Tailwind status pills, and user-uploaded event artwork.
  - [Desktop](design-references/mastryhub-explore-desktop-light.png) · [Mobile](design-references/mastryhub-explore-mobile-light.png) · [Drawer open](design-references/mastryhub-explore-desktop-menu-light.png)
- **Landing page (`/`):** near-black (`#0A0A0A`) hero with giant uppercase display type. The lead word block "COOL STUFF" is set in yellow `#FACC15` using a stencil-style display face. A browser-window product frame (4 px white border, 12 px radius) sits over a yellow slab offset 16 px/16 px. The page then alternates bands: light grey `#F5F5F5` logo strip, `#0A0A0A` events, white `#FFFFFF` feature sections with 2 px black dividers, a yellow band, `#000000` and `#111111` dark bands, and a `#000000` footer. [Viewport](design-references/mastryhub-desktop-light.png) · [Full page](design-references/mastryhub-desktop-light-fullpage.png) · [Mobile](design-references/mastryhub-mobile-light.png)

### 3.2 Dark appearance (exists — evidence)

| Check | Result |
|---|---|
| Theme toggle | `button[aria-label="Switch to dark mode"]` inside the off-canvas `<aside>` (translated −280 px desktop / −390 px mobile until "Open menu" is clicked). After click: `<html class="dark">`, `localStorage.theme="dark"`, aria-label becomes "Switch to light mode". Survives reload |
| Dark token block | `.dark{--theme-bg:#0f0f0f;--theme-text:#fff;--theme-bg-secondary:#1a1a1a;--theme-text-muted:#9a9a9a;--theme-border:#2a2a2a; …17 --dashboard-* tokens}` in `3ea0c9898c0ebce8.css`; 2,412 `.dark` occurrences in that file |
| `prefers-color-scheme` | Only **one** rule in all CSS: `@media (prefers-color-scheme:dark){.bottom-sheet-container{background:#1a1a1a}}` (component-level, `f5f09351d82ac7ba.css`). **0** custom properties defined inside it |
| Dark emulation, no stored choice | `/explore`: `<html>` has no `.dark`, body `#FFFFFF`, **0.000 %** pixel diff vs light (desktop and mobile). `/`: **0.000 %**, byte-identical PNG |
| Toggle on app page | `/explore` light → dark: **81.578 %** of pixels differ (desktop), **79.027 %** (mobile) |
| Toggle on landing page | `/`: 0.000 % pixel diff in the viewport; 0 of 63 (desktop) / 48 (mobile) matched elements change any colour property. The only census differences are rotating-carousel items swapping category colours (`#F18F01` ↔ `#E84C3D`), not theme effects |

Dark app screenshots: [desktop](design-references/mastryhub-explore-desktop-dark.png) · [mobile](design-references/mastryhub-explore-mobile-dark.png) · [drawer](design-references/mastryhub-explore-desktop-menu-dark.png). Landing in "dark" (identical): [toggled](design-references/mastryhub-desktop-toggled-dark.png) · [emulated](design-references/mastryhub-desktop-emulated-dark.png) · [mobile toggled](design-references/mastryhub-mobile-toggled-dark.png) · [mobile emulated](design-references/mastryhub-mobile-emulated-dark.png).

**Dark mapping (app):** page `#0F0F0F`, text `#FFFFFF`; raised controls `#1A1A1A` (search, Filters); cards `#111111` with 3 px `#1F2937` border; list rows `#0A0A0A` (darker than the page); tiles `#000000`; dashed outlines flip to `#FFFFFF`. Muted text is `#9CA3AF` (Tailwind gray-400) or `#9A9A9A` (token); chips `#1F2937`/`#374151`; status pills become translucent fills (`#14532D4D`, `#1E3A8A4D`) with light text; overlay goes from black 20 % to black 40 %. The dark elevation is **not monotonic**: raised inputs are *lighter* than the page (`#1A1A1A`), while list rows and tiles are *darker* (`#0A0A0A`, `#000000`).

### 3.3 Backgrounds and surfaces

| Surface | Light | Dark | Landing (both states) |
|---|---|---|---|
| Page | `#FFFFFF` | `#0F0F0F` | `#0A0A0A` |
| Raised control (input, Filters) | `#FFFFFF` + 2 px dashed `#000000` | `#1A1A1A` + 2 px dashed `#FFFFFF` | — |
| Content card | `#FFFFFF` + 3 px `#E5E7EB` | `#111111` + 3 px `#1F2937` | white cards on dark (`#FFFFFF`, radius 12–16 px) |
| List row (discussion) | `#F9FAFB` + 1 px dashed `#E5E7EB` | `#0A0A0A` + 1 px dashed `#374151` | — |
| Tile (city) | `#FFFFFF` + 2 px dashed `#000000` | `#000000` + 2 px dashed `#FFFFFF` | — |
| Drawer / side menu | `#FFFFFF` | `#0F0F0F` | `#0F0F0F` (forced) |
| Overlay | `#00000033` + `backdrop-blur-sm` | `#00000066` + blur | — |
| Bands | — | — | `#F5F5F5`, `#FFFFFF`, `#000000`, `#111111`, `#0A0A0A` |

In **light**, separation comes almost entirely from **borders** (white-on-white with black or grey outlines), not from surface tint or shadow. In **dark**, separation uses small luminance steps (`#0A0A0A` / `#0F0F0F` / `#111111` / `#1A1A1A`) plus borders.

### 3.4 Typography and hierarchy

Fonts (verified via `document.fonts`, `@font-face` rules in the CSSOM and computed `font-family`):
- **App:** `trap` (self-hosted, weights 300–900; `@font-face` in `f5f09351d82ac7ba.css`) for everything; system-ui fallback.
- **Landing:**
  - `"Space Mono"` 400/700 for body (Google Fonts; inline `.landing-page{font-family:'Space Mono'}`).
  - `Oswald` 500/700 for display (`.font-display`, uppercase). Note: the h2s compute to `font-weight: 800`, but only Oswald 500/700 are loaded.
  - `trap` 900 for some headings.
  - Decorative faces: `BombSound` and `23Seconds` (hero h1, inline `@font-face`) and `KindlyCrunch` (quote). `Theganesha`, `Graphyne`, `Anime Ace` and `The Chello` are also declared.
- Uppercase is pervasive (headings, buttons, chips, labels). Tracking is negative on large headings (−0.02 em) and positive on small labels (+0.01–0.1 em).

Observed type scale (computed, `font-size/line-height`):

| Element | Desktop 1440 | Mobile 390 | Family / weight / case |
|---|---|---|---|
| App h1 ("EXPLORE") | 60/60 px, −1.2 px | 30/36 px | trap 900, uppercase |
| App section h2 ("JOIN THE HUBS") | 36/40 px | 20/28 px | trap 900, uppercase |
| App card title (h3) | 18/28 px | 16/20 – 18/28 px | trap 700 |
| App subtitle (p) | 18/28 px | 14/20 px | trap 400 |
| App body / card description | 14/22.75 px | 14/22.75 px | trap 400 |
| App label ("POPULAR CITIES") | 14/20 px | 14/20 px | trap 700, uppercase |
| App chip / button text | 14/20 px, +0.14 px | — | trap 500, uppercase |
| App badge / count | 10–12 px | — | trap 700–900 |
| Landing display h2 | 96/96 px | 48/48 px | Oswald 800 (700 face), uppercase |
| Landing hero h1 lines (spans inside the h1) | 96/96 and 120/120 px | 48/48 and 60/63 px | BombSound 900 / 23Seconds 900, uppercase |
| Landing section h2 | 60–72 px | 24–36 px | trap 900 |
| Landing body | 16/24, 20/28 px | 14/22.75, 16/24 px | Space Mono 400 |

### 3.5 Accent colours

- **`#FACC15` (Tailwind yellow-400), the brand accent.** 190 occurrences in the main CSS; `--accent:#FACC15` in the landing inline `:root`; `::selection{background:var(--accent)}`. Rendered as: the headline highlight ("COOL STUFF"), the offset slab behind the hero frame, the indicator square in "Sign In" (same in both themes), the "Featured" badge (light), the hover fill of the landing primary CTA, the hard shadow of "Explore our Journey", and a yellow page band. In dark app mode the badge uses **`#EAB308`** (yellow-500).
- **`#FFDE59`:** a second, warmer yellow on the landing page only ("Join the Conversation" button, prize pills).
- **Category colours (landing event cards, 4 px left strip):** `#E84C3D`, `#3EC1D3`. The census also shows `#06C270`, `#F18F01`, `#FF4757` (pitstop highlight), and `#505FB0` on mobile. These are content-category colours, not UI chrome.
- **Status colours (app):** Tailwind 100/700/300 triplets in light (green `#DCFCE7`/`#15803D`/`#86EFAC`, blue `#DBEAFE`/`#1D4ED8`/`#93C5FD`, orange `#FFEDD5`/`#C2410C` in the census). In dark, translucent 900-level fills with 300-level text.
- `brand-*` utilities exist in the CSS: `cta`, `error` and `rose-gold` all compile to pure `#FF0000`, `surface` to `#1E1E1E`, and `border` to `#FF000033`. **No `#FF0000` was observed rendered** on `/` or `/explore`. The shadcn `--destructive` token is **black** (`0 0% 0%`), so there is no red destructive token in the theme.

### 3.6 Buttons and hover

| Button | Rest (computed) | Hover (computed after `page.hover()`) |
|---|---|---|
| Landing primary CTA "Explore" (`<a>` → inner `<button>`) | bg `#FFFFFF`, text `#000000`, 1 px `#FFFFFF`, radius 6 px, shadow `#FFFFFF 4px 4px 0 0`, Oswald 500 20 px uppercase | bg **`#FACC15`**, translate(2 px, 2 px), 200 ms |
| Landing secondary CTA "Take a journey" | transparent, text `#FFFFFF`, 1 px `#333333`, radius 6 px, shadow `#FFFFFF 4px 4px 0 0` | text **`#FACC15`**, translate(2 px, 2 px) |
| "Sign In" (light app) | bg `#FFFFFF`, text `#000000`, 2 px `#000000`, radius **0**, shadow `#000000 4px 4px 0 0`, trap 700 12 px uppercase, yellow square `#FACC15` with a 1 px border | shadow → none, translate(4 px, 4 px) ("press into shadow"), 150 ms |
| "Sign In" (dark app / landing) | bg `#000000`, text `#FFFFFF`, 2 px `#FFFFFF`, shadow `#FFFFFF 4px 4px 0 0` | translate(4 px, 4 px) |
| Primary solid ("Install App", drawer) | light: `#000000`/`#FFFFFF`; dark: `#FFFFFF`/`#000000`; radius 8 px | — |
| Secondary dashed ("Filters") | light: `#FFFFFF`, 2 px dashed `#000000`, radius 12 px; dark: `#1A1A1A`, dashed `#FFFFFF` | glow `0 0 20px #0000001A` (dark `#FFFFFF1A`), 300 ms |
| Chip, selected ("All") | light `#000000`/`#FFFFFF`, dark `#FFFFFF`/`#000000`; radius 8 px; count badge `#FFFFFF33` / `#00000033` | — |
| Chip, unselected ("Events") | light text `#4B5563`, 2 px dashed `#D1D5DB`, badge `#E5E7EB`; dark `#9CA3AF`, `#4B5563`, badge `#374151` | text and border → `#000000` (light) / `#FFFFFF` (dark), 200 ms |
| Landing CTA variants | "Join the Conversation" `#FFDE59` + 2 px `#000000` + shadow `#000000 4px 4px`; "Explore our Journey" `#000000` + shadow **`#FACC15` 4px 4px**; "View Catalysts" `#FFFFFF`, radius 0; "Browse Hubs" `#000000`, radius 8 px | — |

Card hovers: the event card lifts −4 px, its border darkens (`#E5E7EB` → `#D1D5DB` light; `#1F2937` → `#374151` dark), it gains Tailwind `shadow-xl`, and the image zooms 1.05 (`transition-transform duration-500` class). The city tile **inverts** (white ↔ black with the border flipped). Landing footer links go from white 45 % to `#FFFFFF`.

### 3.7 Borders, dividers, cards, radii, shadows

- **Borders:**
  - 2 px **dashed** (`border-dashed`) on interactive controls.
  - 2 px **solid** on the `.dashed-border` class (the name is misleading: it is `border:2px solid #000`, `#fff` in dark).
  - 3 px solid `#E5E7EB` on content cards.
  - 1 px dashed `#E5E7EB` on list rows.
  - Landing hairlines in white alpha (`#FFFFFF0F` footer, `#FFFFFF1A` panels), `#262626` section rules and 2 px `#000000` band dividers.
- **Radii (computed):**
  - 0 (Sign In, brutalist CTAs, drawer)
  - 4 px (badges, tag chips)
  - 6 px (landing CTAs, Featured badge)
  - 8 px (chips, drawer cards and nav items, "Install App"; equals `--radius:.5rem`)
  - 12 px (inputs, Filters, tiles, hero frame)
  - 16 px (event cards)
  - 9999 px (status pills, theme toggle, carousel arrows)
  - 50 % (social buttons)
- **Shadows:**
  - Hard offset `4px 4px 0 0` (black, white or `#FACC15`); also `6px 6px` and `2px 2px` variants, and `#FF4757 3px 3px` on the pitstop item.
  - Soft Tailwind shadows on listing cards (`0 4px 6px -1px #0000001A, 0 2px 4px -2px #0000001A`) and the Featured badge (`shadow-lg`).
  - Glows `0 0 20px` for hover/focus.
- **Motion (computed `transition`):**
  - 150 ms (Sign In), 200 ms (chips, CTAs), 300 ms (cards, inputs, drawer slide, theme colour change on `body`), 500 ms (card image zoom, per the `duration-500` class).
  - Easing `cubic-bezier(.4,0,.2,1)` or `(0,0,.2,1)`.
  - The landing marquee band is rotated about −1° and scaled 1.05 (computed `matrix(1.04984, -0.018325, 0.018325, 1.04984, 0, 0)`). The CSS defines an infinite `marquee-scroll` animation (`var(--duration, 30s) linear infinite`).

### 3.8 Contrast observations (WCAG 2.x, computed values)

| Pair | Ratio | Note |
|---|---|---|
| Light: text `#0F0F0F` on `#FFFFFF` | 19.17 | |
| Light: secondary `#4B5563` on `#FFFFFF` | 7.56 | |
| Light: muted label / placeholder `#6B7280` on `#FFFFFF` | 4.83 | AA floor |
| Light: token muted `#6D6D6D` on `#FFFFFF` | 5.17 | |
| Light: pill "Open" `#15803D` on `#DCFCE7` | 4.57 | barely AA |
| Light: pill "Public" `#1D4ED8` on `#DBEAFE` | 5.49 | |
| Light: `#000000` on accent `#FACC15` | 13.71 | yellow always carries **black** text |
| Light: chip border `#D1D5DB` / card border `#E5E7EB` vs `#FFFFFF` | 1.47 / 1.24 | below 3:1 non-text contrast |
| Dark: text `#FFFFFF` on `#0F0F0F` | 19.17 | |
| Dark: secondary / muted `#9CA3AF` on `#0F0F0F` | 7.55 | |
| Dark: token muted `#9A9A9A` on `#0F0F0F` | 6.81 | |
| Dark: `#000000` on `#EAB308` | 10.95 | |
| Dark: pills `#86EFAC` / `#93C5FD` on their composited fills | 11.6 / 9.35 | |
| Dark: chip border `#4B5563` / card border `#1F2937` vs `#0F0F0F` | 2.54 / 1.31 | below 3:1 |
| Landing: `#FFFFFF` on `#0A0A0A` | 19.8 | |
| Landing: `#FACC15` on `#0A0A0A` | 12.93 | |
| Landing: `#A3A3A3` on `#000000` | 8.33 | |
| Landing: footer link white 45 % (→ `#737373`) on `#000000` | 4.43 | fails AA at 14 px |
| Landing: footer paragraph white 40 % (→ `#666666`) on `#000000` | 3.66 | fails AA |
| Landing: secondary CTA border `#333333` on `#0A0A0A` | 1.57 | affordance relies on the white hard shadow |

### 3.9 How brand identity carries across themes

1. **The landing page is the brand's fixed "home" and is always dark.** Black, white and yellow, with chunky uppercase type and hard shadows.
2. **The app swaps the two neutrals and keeps everything else.**
   - Black ↔ white inversion for primary and selected states.
   - The same 2 px dashed outline weight, with the colour flipped.
   - The same type family and scale.
   - The same hard offset shadow, with the colour flipped (`#000000` → `#FFFFFF`).
3. **The accent is nearly constant.** The yellow indicator square is `#FACC15` in both themes; the Featured badge darkens slightly (`#FACC15` → `#EAB308`) for balance on dark.

Identity therefore lives mainly in **shape language and contrast** (outline style, hard shadows, uppercase weight), and only secondarily in hue.

### 3.10 Implementation and accessibility observations (evidence for "do not copy")

- **Focus order:** from page load, the first **13 Tab stops** are links and buttons inside the *closed* off-canvas drawer (x < 0, invisible). The 14th is the visible "Open menu" button. This was measured on `/` and `/explore` at desktop.
- **Focus style:** most controls show only the browser default ring (`outline: 1px auto`, computed colour `#101010`). The search field uses `outline: 2px solid transparent` (the `focus:outline-none` pattern) and relies on a soft container glow (`0 0 20px #00000026`).
- **Global `*{border-color:#f003}`** (red, 20 % alpha). Wherever a border colour utility is missing, borders render faint red. Example: landing event cards with `border-black/8`, a class that is not generated, compute `1px solid #FF000033`.
- **shadcn-style HSL tokens** (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, …) are defined only on `:root`. They keep light values in dark mode (verified: same values with `html.dark`).
- **`43ff4e9f473f496f.css`** (`--landing-*` tokens; a pill-shaped "Sign In" override) was fetched but **never attached** to `document.styleSheets` on `/` or `/explore`. Its tokens are declarations only.
- **Theme control is only reachable inside the hamburger drawer.** The site does not adopt the OS theme on first visit.

---

## 4. Colour extraction methodology

**Environment:**
- Playwright 1.65.1 (`@playwright/test`, loaded from the project's `node_modules` without modifying the project), headless Chromium, Node 24.16.
- Desktop user agent: Chrome 140 Windows. Mobile user agent: Chrome 140 Android.
- Each state used a fresh browser context: `viewport` 1440×900 (DPR 1) or 390×844 (`isMobile`, `hasTouch`, DPR 2), with `colorScheme: 'light' | 'dark'`.
- Load sequence: `goto(domcontentloaded)` → `networkidle` (≤ 25 s) → 2.5 s settle.
- Screenshots used `animations: 'disabled'` (freezes CSS animations and transitions; JavaScript-driven carousels can still advance).

**A. Stylesheets (two independent paths, cross-checked):**
1. **In-page CSSOM.** A recursive walk of `document.styleSheets` through `@media`, `@supports`, `@layer`, `@container` and nested rules, recording every `--*` declaration with its selector, at-rule chain and sheet URL, plus `@font-face` rules.
   - Readable: both Next.js chunks and inline `<style>` elements.
   - The Google Fonts sheet is cross-origin (`SecurityError`), so it was fetched with `curl` instead. It contains only `@font-face` rules and 0 custom properties.
2. **Downloaded text.** `curl` of the server HTML, the 3 CSS chunks and the Google Fonts CSS into a separate downloads folder (treated as data, never executed). The inline `<style>` block was extracted from the HTML. A purpose-written tokenizer tracked strings, comments, CSS escapes (Tailwind selectors contain `\'`, `\(`, `\:`), parentheses and the brace-context stack.
   - Custom-property declarations by sheet: `f5f09351d82ac7ba.css` **37**, `3ea0c9898c0ebce8.css` **3,135** (matches a raw `grep` count), `43ff4e9f473f496f.css` **32**, Google Fonts **0**, inline `<style>` **7**.
3. **Cross-check.** All root-level theme-context declarations attached on `/` (74 external + 7 inline) and `/explore` (74) were matched between CSSOM and text parse: **0 mismatches**. CSSOM totals: 3,179 on `/` and 3,172 on `/explore`, which equal the per-sheet sums. The 14 colour tokens from `43ff…css` are marked "text parse only" because that sheet was not attached.
4. **Format checks.** There are no `oklch()`, `lab()` or `color()` values in the CSS (0 occurrences), so computed colours are plain `rgb()`/`rgba()` and convert to hex exactly.

**B. Computed styles:**
- Named **role probes** locate concrete elements: `body`, h1, the subtitle `p`, the search `input` and its bordered container, the "Filters" button, active and inactive category buttons with their count badges, the "Bengaluru" city tile, the first `a[href^="/event/"]` card, tag chips, status pills, discussion rows, the "Featured" badge, `a.floating-sign-in` and its inner square, plus drawer parts.
  - On `/`, the section-wise sampler takes each section's heading, paragraphs, buttons, cards, links and dividers.
- For each element, the probes read `getComputedStyle` for:
  - background colour and image, colour, border (all four sides) and radius;
  - `box-shadow`, `outline` and `outline-offset`;
  - font family, size, weight, line-height, letter-spacing and text-transform;
  - transform and transition;
  - `::before`/`::after`, and `::placeholder` for the input.
- Elements entirely off-canvas (the closed drawer) are excluded. An earlier run had mis-attributed two probes to drawer elements; this was fixed and re-run, and the published values come from the corrected run.
- A **colour census** of all visible elements aggregates background, text, border and shadow values with a sample selector each. Mobile values were re-read at 390×844; the JSON records `"mobile390"` per entry.

**C. Theme switching:**
1. Inventory toggle candidates (aria-label, title, class, text matching theme, dark, light, mode).
2. Click the on-screen "Open menu", then the toggle. Record the `<html>` class, `localStorage`, cookies and aria-label.
3. Reload to test persistence; navigate to `/explore`; toggle back to light.
4. Separately, load fresh contexts with `colorScheme: 'dark'` to test system-preference handling.

**D. Interaction states:**
- **Hover:** `page.hover()` followed by a 700–800 ms settle (transitions are 150–500 ms). Before/after values were diffed for the element and its descendants.
- **Focus:** keyboard `Tab` from a freshly loaded page (up to 45 presses), reading `document.activeElement` and `:focus-visible`; also `locator.focus()` on the search input.

**E. Pixel diff:** two PNGs drawn to a canvas and compared per pixel (a pixel counts as different if any RGB channel differs by more than 8); identical results were also confirmed with SHA-256.

**F. Hex conversion:**
- `rgb()`/`rgba()` → `#RRGGBB`, or `#RRGGBBAA` with `AA = round(alpha × 255)`.
- 3- and 4-digit hex is expanded.
- shadcn HSL channel triplets (e.g. `0 0% 43%`) are converted deterministically (→ `#6E6E6E`).
- **Contrast:** WCAG relative luminance; translucent foregrounds are composited over the stated opaque background first.

**Reproducibility:** the desktop capture was run twice with identical theme results (81.578 % toggle diff both times), and mobile twice. Scripts are kept outside the repo (session scratchpad: `design-research/scripts/`). No npm packages were installed and no project files outside `docs/` were touched.

---

## 5. Verified reference values

Abbreviations used in the Source column:
- **CSS:3ea0** = `https://mastryhub.com/_next/static/chunks/3ea0c9898c0ebce8.css`
- **CSS:f5f0** = `…/f5f09351d82ac7ba.css`
- **HTML:inline** = inline `<style>` in the server HTML of `https://mastryhub.com/`
- **CS /explore** = `getComputedStyle` on `https://mastryhub.com/explore` at 1440×900, re-checked at 390×844 with identical values. "light" = `<html>` without `.dark`; "dark" = `<html class="dark">` set via the toggle; `prefers-color-scheme: light` in both.
- **CS /** = `getComputedStyle` on `https://mastryhub.com/` at 1440×900 and 390×844, identical in both theme states.

All rows are **verified**. The full list with exact selectors is in `mastryhub-colors.json`.

### 5.1 Theme tokens (CSS custom properties)

| Role | Theme | Hex | Source |
|---|---|---|---|
| Page background `--theme-bg` | light / dark / landing | `#FFFFFF` / `#0F0F0F` / `#0A0A0A` | CSS:3ea0 `:root` / `.dark` / `body.landing-page` |
| Primary text `--theme-text` | light / dark / landing | `#0F0F0F` / `#FFFFFF` / `#FFFFFF` | same |
| Secondary surface `--theme-bg-secondary` | light / dark / landing | `#FFFFFF` / `#1A1A1A` / `#111111` | same |
| Muted text `--theme-text-muted` | light / dark / landing | `#6D6D6D` / `#9A9A9A` / `#A3A3A3` | same |
| Border `--theme-border` | light / dark / landing | `#E5E5E5` / `#2A2A2A` / `#333333` | same |
| Dashboard card `--dashboard-card` | light / dark | `#FFFFFF` / `#1A1A1A` | CSS:3ea0 `:root` / `.dark` (usage not observed; dashboard is behind login) |
| Dashboard inset card `--dashboard-card-dark` | light / dark | `#F5F5F5` / `#0A0A0A` | same |
| Dashboard border / hairline | light / dark | `#0000001A`, `#0000000F` / `#FFFFFF1A`, `#FFFFFF0F` | same |
| Dashboard muted fill `--dashboard-accent-muted` | light / dark | `#0000000D` / `#FFFFFF0D` | same |
| Dashboard text primary / secondary / light | light / dark | `#0F0F0F`, `#6D6D6D`, `#9A9A9A` / `#FFFFFF`, `#9A9A9A`, `#B0B0B0` | same |
| shadcn `--background` / `--foreground` | light (no dark override) | `#FFFFFF` / `#0F0F0F` (`0 0% 100%`, `0 0% 6%`) | CSS:3ea0 `:root` |
| shadcn `--primary` = `--accent` = `--ring` = `--destructive` | light (no dark override) | `#000000` (`0 0% 0%`) | CSS:3ea0 `:root` |
| shadcn `--muted` / `--input` / `--muted-foreground` / `--secondary` | light | `#F5F5F5` / `#F5F5F5` / `#6E6E6E` / `#999999` | CSS:3ea0 `:root` |
| shadcn `--border` | light | `#00000033` (`0 0% 0%/.2`) | CSS:3ea0 `:root` |
| Landing accent `--accent` | landing | `#FACC15` | HTML:inline `:root` (wins over the HSL `--accent` on `/`) |
| Landing `--bg-dark` / `--bg-darker` / `--bg-card` | landing | `#0A0A0A` / `#000000` / `#111111` | HTML:inline `:root` |
| Landing `--text-main` / `--text-muted` / `--border-color` | landing | `#FFFFFF` / `#A3A3A3` / `#333333` | HTML:inline `:root` |
| Calendar border / button / now-indicator | light / dark | `#E5E7EB`, `#000000`, `#EF4444` / `#2A2A2A`, `#FFFFFF`, `#EF4444` | CSS:f5f0 `.fc` / `.dark .fc` |

### 5.2 App surfaces and text (`/explore`, computed)

| Role | Theme | Hex | Source |
|---|---|---|---|
| Page background | light / dark | `#FFFFFF` / `#0F0F0F` | CS /explore `body` |
| Primary text | light / dark | `#0F0F0F` / `#FFFFFF` | CS /explore `body` |
| Heading (h1) | light / dark | `#000000` / `#FFFFFF` | CS /explore `h1` "EXPLORE" |
| Secondary text | light / dark | `#4B5563` / `#9CA3AF` | CS /explore subtitle `p.text-gray-600.dark:text-gray-400` |
| Muted label | light / dark | `#6B7280` / `#9CA3AF` | CS /explore `h3` "POPULAR CITIES" |
| Muted text (token) | light / dark | `#6D6D6D` / `#9A9A9A` | CS /explore drawer `p.text-theme-text-muted` |
| Input placeholder | light / dark | `#6B7280` / `#9CA3AF` | CS /explore `input::placeholder` |
| Input / raised control surface | light / dark | `#FFFFFF` / `#1A1A1A` | CS /explore search container, "Filters" |
| Control outline (2 px dashed) | light / dark | `#000000` / `#FFFFFF` | CS /explore search container, "Filters", city tile, theme toggle |
| Selected chip bg / text | light / dark | `#000000` / `#FFFFFF` → `#FFFFFF` / `#000000` | CS /explore "ALL" category button |
| Selected chip count badge | light / dark | `#FFFFFF33` / `#00000033` | CS /explore badge inside "ALL" |
| Unselected chip text / border (2 px dashed) | light / dark | `#4B5563`, `#D1D5DB` / `#9CA3AF`, `#4B5563` | CS /explore "EVENTS" button |
| Unselected chip count badge | light / dark | `#E5E7EB` / `#374151` | CS /explore badge inside "EVENTS" |
| Tile surface | light / dark | `#FFFFFF` / `#000000` | CS /explore "Bengaluru" city button |
| Content card surface / border (3 px) | light / dark | `#FFFFFF`, `#E5E7EB` / `#111111`, `#1F2937` | CS /explore first `a[href^="/event/"]` card |
| Card title / body text | light / dark | `#000000`, `#4B5563` / `#FFFFFF`, `#9CA3AF` | CS /explore card `h3` / `p` |
| Tag chip bg / text | light / dark | `#F3F4F6`, `#4B5563` / `#1F2937`, `#9CA3AF` | CS /explore "#HealthTech" chip |
| List row surface / border (1 px dashed) | light / dark | `#F9FAFB`, `#E5E7EB` / `#0A0A0A`, `#374151` | CS /explore discussion row `a.bg-gray-50` |
| Status "Open" bg / text / border | light / dark | `#DCFCE7`, `#15803D`, `#86EFAC` / `#14532D4D`, `#86EFAC`, `#15803D` | CS /explore pill "Open" |
| Status "Public" bg / text / border | light / dark | `#DBEAFE`, `#1D4ED8`, `#93C5FD` / `#1E3A8A4D`, `#93C5FD`, `#1D4ED8` | CS /explore pill "Public" |
| Accent badge bg / text | light / dark | `#FACC15`, `#000000` / `#EAB308`, `#000000` | CS /explore "FEATURED" badge |
| Accent indicator square | light / dark | `#FACC15` / `#FACC15` | CS /explore `a.floating-sign-in span.bg-yellow-400` |
| Sign-in surface / text / border | light / dark | `#FFFFFF`, `#000000`, `#000000` / `#000000`, `#FFFFFF`, `#FFFFFF` | CS /explore `a.floating-sign-in` |
| Sign-in hard shadow | light / dark | `#000000` (4px 4px 0 0) / `#FFFFFF` (4px 4px 0 0) | CS /explore `a.floating-sign-in` box-shadow |
| Primary solid button bg / text | light / dark | `#000000`, `#FFFFFF` / `#FFFFFF`, `#000000` | CS /explore drawer "INSTALL APP" |
| Drawer surface / border | light / dark | `#FFFFFF`, `#000000` / `#0F0F0F`, `#FFFFFF` | CS /explore drawer panel |
| Overlay / scrim | light / dark | `#00000033` / `#00000066` | CS /explore drawer backdrop (`backdrop-blur-sm`) |

### 5.3 Landing page (`/`, computed; same in both theme states)

| Role | Theme | Hex | Source |
|---|---|---|---|
| Page background | landing | `#0A0A0A` | CS / `body`, landing wrapper, hero `section` |
| Text | landing | `#FFFFFF` | CS / `body` |
| Accent: headline highlight / offset slab | landing | `#FACC15` | CS / `h1 span.font-seconds` color; hero `div.bg-[#FACC15]` (translate 16 px, radius 12 px) |
| Product-frame surface / border (4 px) | landing | `#0A0A0A` / `#FFFFFF` | CS / hero `div.border-[4px].border-white` |
| Primary CTA surface / text / shadow | landing | `#FFFFFF` / `#000000` / `#FFFFFF` | CS / hero "EXPLORE" inner `button` |
| Secondary CTA border | landing | `#333333` | CS / hero "TAKE A JOURNEY" inner `button` |
| Band surfaces | landing | `#F5F5F5`, `#FFFFFF`, `#000000`, `#111111` | CS / sections "WE WORK WITH", "YOUR EVENT, STRUCTURED", "NOT JUST ANOTHER PLATFORM.", "READY TO BREAK THINGS?" |
| Band divider (2 px) | landing | `#000000` | CS / "YOUR EVENT, STRUCTURED" `border-bottom` |
| Muted text on dark / on white card | landing | `#A3A3A3` / `#6B7280` | CS / platform `p`; community `p.text-gray-500` |
| Second yellow (CTA) | landing | `#FFDE59` | CS / "Join the Conversation" |
| Accent hard shadow on black CTA | landing | `#FACC15` | CS / "Explore our Journey →" box-shadow |
| Section rule / panel divider | landing | `#262626` / `#FFFFFF1A` | CS / catalyst `border-y`; chat panel `border-b` |
| Category strip (4 px, left) | landing | `#E84C3D`, `#3EC1D3` | CS / event cards in "UPCOMING EVENTS" |
| Footer surface / top rule | landing | `#000000` / `#FFFFFF0F` | CS / `footer` |
| Footer link / paragraph | landing | `#FFFFFF73` / `#FFFFFF66` | CS / footer `a.text-white/45`, `p.text-white/40` |
| Unintended faint red border | landing | `#FF000033` | CS / event card `border` (global `*{border-color:#f003}` in CSS:3ea0) — **bug, not design** |

### 5.4 Interaction states (computed after hover or focus, 1440×900)

| Role | Theme | Hex | Source |
|---|---|---|---|
| Hover: landing primary CTA fill | landing | `#FACC15` (rest `#FFFFFF`; translate 2,2) | CS / inner `button` of "EXPLORE" after `page.hover()` |
| Hover: landing secondary CTA text | landing | `#FACC15` (rest `#FFFFFF`) | CS / "TAKE A JOURNEY" |
| Hover: footer link | landing | `#FFFFFF` (rest `#FFFFFF73`) | CS / footer link |
| Hover: unselected chip text + border | light / dark | `#000000` / `#FFFFFF` | CS /explore "EVENTS" |
| Hover: Filters glow | light / dark | `#0000001A` / `#FFFFFF1A` (0 0 20px) | CS /explore "FILTERS" |
| Hover: tile inverts | light / dark | bg `#000000` + border `#FFFFFF` / bg `#FFFFFF` + border `#000000` | CS /explore city tile |
| Hover: card border (+ `shadow-xl`, −4 px lift) | light / dark | `#D1D5DB` / `#374151` | CS /explore event card |
| Hover: Sign In | light | shadow removed, translate 4,4 (bg stays `#FFFFFF`) | CS /explore `a.floating-sign-in` |
| Focus-within: search container glow | light | `#00000026` (0 0 20px); input outline transparent | CS /explore after `focus()` on the input |
| Focus: keyboard ring on buttons | light | `outline: 1px auto` (computed `#101010`, browser default) | CS /explore `document.activeElement` after Tab |

### 5.5 Non-colour reference values (verified, computed)

- **Radii:** 0 · 4 · 6 · 8 (`--radius: .5rem`) · 12 · 16 · 9999 px · 50 %.
- **Border weights:** 1 px (rows, nav items, hairlines) · 2 px (controls, drawer, buttons) · 3 px (content cards) · 4 px (hero frame, category strip, marquee).
- **Shadows:** hard `4px 4px 0 0` (black / white / `#FACC15`); `6px 6px 0 0 #000`; Tailwind `shadow-md` / `lg` / `xl`; glow `0 0 20px`.
- **Motion:** 150 / 200 / 300 / 500 ms; `cubic-bezier(.4,0,.2,1)` and `(0,0,.2,1)`; hover translate 2–4 px; card lift −4 px; image scale 1.05.
- **Type:** see §3.4.

---

## 6. Inferred values

**None.** No colour in sections 3–5 or in `mastryhub-colors.json` was read from a screenshot (`"inferred": 0` in the JSON).

Qualitative, screenshot-only observations, deliberately given **no** hex values:
- The landing hero illustration (a multi-colour flat illustration in red, orange, blue, teal and yellow) is a brand asset that must not be reused.
- Event poster artwork on `/explore` is user content.
- Secondary-site colours are discussed only qualitatively; none were extracted for reuse.

---

## 7. Secondary references (patterns only; nothing to copy visually)

Each pattern below was seen in the 1440×900 capture (plus one scrolled viewport kept in scratch) on 2026-11-22.

### Linear — [screenshot](design-references/linear-desktop.png)

Rendered dark even under light emulation (`color-scheme: dark`). Fixed header (73 px) with a translucent background, `backdrop-filter: blur(20px)` and a 1 px light hairline. Headline Inter Variable 510 at 64/64 px, −1.4 px tracking. 82 CSS animations running at load.

| Pattern | Verdict |
|---|---|
| Hero **is the real product UI**: sidebar (Inbox / My issues / Reviews / Projects), issue detail, **Activity** list ("Linear created the issue via Slack on behalf of Karri · 2min ago"), floating agent panel ("Worked for 10 sec") | **Adopt.** BriefRoom's landing and empty states should show a real brief room: reference image with regions, a region thread, and the activity log |
| Activity microformat: icon/avatar + actor + verb + object + relative time, muted secondary text | **Adopt** for the clarification log and version history ("Seller resolved Q3 on Region 2 · 4 min ago") |
| Restrained nav: 6 text links, Log in, **one** pill "Sign up" | **Adopt** the hierarchy (one primary CTA). **Reject** the blur/glass header as a default |
| Two-tone headline (lead clause full contrast, continuation muted grey); mono uppercase micro-labels ("FIG 0.1") | **Adapt** for marketing and section intros; mono for IDs, version numbers and timestamps |
| Ambient decorative animation | **Reject** in-app (distracting next to customer imagery) |

### Figma — [screenshot](design-references/figma-desktop.png)

White page; fixed 78 px white header; nav Products / Solutions / Community / Resources / Pricing + Log in + outline "Contact sales" + solid black "Get started for free" (radius 8 px). The hero is a rotating carousel with a typed prompt box over a gallery, with prev / **pause** / next controls. One CSS animation.

| Pattern | Verdict |
|---|---|
| Canvas cues (scrolled view): a selected frame with **corner selection handles**, a pointer cursor, and an agent/prompt box floating over the canvas | **Adapt.** Region selection with handles and a distinct selection colour; show collaborator presence only if real-time is supported |
| Auto-advancing hero carries an explicit **pause** control | **Adopt** as a rule: anything that moves on its own can be paused |
| Solid black primary + outline secondary pairing in the header | **Adopt** |
| Loud, colourful showcase imagery as the hero | **Reject** for app chrome: in BriefRoom the customer's reference image supplies the colour; chrome stays neutral |

### Notion — [screenshot](design-references/notion-desktop.png)

White page; sticky 64 px header with centred logo; headline 80/80 px; pill CTAs (solid black "Get Notion free" + warm light-grey "Request a demo").

| Pattern | Verdict |
|---|---|
| Product preview inside minimal **window chrome** (traffic lights, tab strip) | **Adopt** for previews and onboarding. **Reject** the busy photographic backdrop behind it |
| Primary solid + **warm neutral** secondary pill | **Adapt.** A warm-neutral secondary suits craft/commerce without introducing a hue |
| Few sections (5 h2s), one idea each, generous whitespace | **Adopt** for marketing and onboarding pages |

### Framer — [screenshot](design-references/framer-desktop.png)

Rendered dark under light emulation; headline 54 px, −2.16 px tracking; autoplay muted looping video (1200×674) in the first viewport; 57 WAAPI animations.

| Pattern | Verdict |
|---|---|
| Product preview with an **agent side panel** listing steps with durations ("Created a design plan 6s", "Thought 4s") next to an editable canvas | **Adapt** for the version timeline and "what changed" panel beside the image |
| Autoplay video hero and heavy motion | **Reject** in-app; acceptable only on marketing with a `prefers-reduced-motion` fallback |
| Small "New:" announcement link in the hero | Neutral (marketing only) |

### Stripe — [screenshot](design-references/stripe-desktop.png)

White page; announcement bar; header not sticky; headline weight 300 at 48 px with a muted continuation; an animated **gradient `<canvas>`** (1393×761) behind the hero (rendering context not inspected); live "Global GDP running on Stripe" counter; logo strip framed by thin grid lines.

| Pattern | Verdict |
|---|---|
| Animated gradient ribbon / blob canvas | **Reject**: decorative, competes with product photos, rendering cost |
| Live metric as a trust device | **Adapt** as *real* progress ("2 of 3 clarifications resolved", "Both parties approved v3"), never vanity numbers |
| Thin structural grid lines framing sections | **Adapt** as hairline structure on light surfaces |

### shadcn/ui — [screenshot](design-references/shadcn-desktop.png)

White page; sticky 64 px header with search field, GitHub count and **theme toggle in the header**; headline 48 px, −2.4 px tracking; component showcase grid; 0 running animations.

| Pattern | Verdict |
|---|---|
| Form treatment: label above field, filled light-grey inputs, muted helper text, full-width primary ("Create Goal") stacked over outline secondary ("Cancel") | **Adopt** for brief forms, the clarification composer and the approval dialog |
| A complete state set shown together: primary / secondary / outline buttons, badges, radio / checkbox / switch, Alert Dialog, Button Group | **Adopt** as the checklist every BriefRoom component must cover (rest, hover, focus-visible, active, disabled, loading, error) |
| Theme toggle visible in the header | **Adopt** (contrast with MastryHub's drawer-only toggle) |
| Monochrome bar chart and summary tiles ("UPCOMING · May 2024 · Scheduled") | **Adopt** for dashboard tiles: status label + value + state |

---

## 8. Patterns adopted and patterns rejected

**Adopted / adapted**

1. Monochrome foundation with a **single** accent used in small, high-signal areas (MastryHub).
2. **Inversion** as the theming rule for primary and selected states (MastryHub chips, primary buttons, calendar tokens).
3. Token-driven light/dark with a class strategy and a persisted user choice (MastryHub), **plus** OS preference on first visit (MastryHub lacks this).
4. Accent hue constant across themes, lightness tuned per theme (MastryHub `#FACC15` → `#EAB308` on the dark badge).
5. Status pills: tinted fill + darker text + subtle border in light; translucent fill + light text in dark (MastryHub app). Always paired with an icon or label.
6. Tactile "press" feedback, reserved for the one consequential action (MastryHub's translate-into-shadow, adapted).
7. A real product UI as the hero and empty-state preview (Linear, Notion, Framer).
8. Activity-feed microformat with actor, action, object and time (Linear, Framer).
9. Restrained navigation: few text links, one solid primary CTA, one outline secondary (Linear, Figma, Notion).
10. Window-chrome framing for previews (Notion, Framer, MastryHub's hero frame).
11. Canvas selection handles; pause controls on anything auto-advancing (Figma).
12. Form layout and complete component-state coverage (shadcn); theme toggle visible in the header or settings (shadcn).
13. Real progress metrics instead of vanity metrics (adapted from Stripe).

**Rejected**

1. Forced-dark marketing that ignores the theme (MastryHub landing).
2. A theme toggle hidden in an off-canvas drawer; ignoring `prefers-color-scheme` (MastryHub).
3. Closed drawers that stay in the Tab order; browser-default-only focus rings (MastryHub).
4. Global fallback border colours (red `#f003`); component tokens with no dark values (MastryHub).
5. Dashed outlines as a decorative default everywhere (MastryHub). Dashed is kept only where it carries meaning (see §9 R3).
6. Pervasive uppercase and mixing 5+ display faces (MastryHub landing).
7. Sub-3:1 borders where the border is the only affordance; text below AA (MastryHub footer at 40–45 % white).
8. Decorative gradient blobs and animated canvas backgrounds (Stripe).
9. Glassmorphism / backdrop-blur chrome as a default (Linear header; MastryHub overlay blur).
10. Autoplay video and heavy ambient motion in the app (Framer, Linear).
11. Colourful showcase imagery in app chrome (Figma); busy photographic backdrops behind product previews (Notion).

---

## 9. Design rationale notes for BriefRoom (RECOMMENDATIONS, not findings)

These notes translate MastryHub's *relationships* into proposals for BriefRoom's design system. They are **recommendations**. Any hex value written here is a proposal to be validated in `design.md`, not a measured value.

- **R1. Keep MastryHub's text/background relationship; soften its separation method.**
  - MastryHub gets ≈19:1 body text in both themes (`#0F0F0F` on `#FFFFFF`, inverted in dark) and keeps secondary text ≈7.5:1 (`#4B5563` / `#9CA3AF`) with a muted floor of ≈4.8:1. Recommend the same three-tier text contrast targets: ≥ 15:1 primary, ≥ 7:1 secondary, ≥ 4.5:1 muted, on *every* surface where the text appears.
  - MastryHub separates light surfaces with heavy 2 px black outlines (white on white). For a premium collaboration tool, recommend a slightly off-white app background with pure-white working surfaces and 1 px neutral borders. Borders that are the *only* affordance need ≥ 3:1 (MastryHub's 1.24–1.47:1 card and chip borders are the counter-example).
- **R2. Make dark elevation monotonic.** MastryHub's dark mode mixes lighter (`#1A1A1A`) and darker (`#0A0A0A`, `#000000`) surfaces relative to the page (`#0F0F0F`). Recommend: page → surface → raised get progressively lighter in small, equal steps, and every token has a dark value (no light-only component tokens).
- **R3. Give the outline vocabulary a meaning that matches BriefRoom's agreement model.** MastryHub's dashed-vs-solid outlines are decorative. In BriefRoom they could encode state:
  - **dashed** = proposed / unresolved region or draft version;
  - **solid** = agreed region;
  - **solid + lock icon + subdued fill** = frozen, approved version.

  This turns a MastryHub stylistic signature into a functional one. Never rely on line style alone: pair it with a label or icon.
- **R4. One interactive accent, used the way MastryHub uses yellow: small area, high signal.**
  - MastryHub's `#FACC15` appears on indicator squares, badges, hover fills and selection highlights, never as large content backgrounds, and always carries black text. Recommend the same discipline for selection, focus ring, active region marker, "current version" and primary-action emphasis.
  - **Hue choice must be category-agnostic and avoid pink.** Customer photos will contain pastel and pink icing and chocolate browns (cakes), wood tones and neutrals (furniture), gold, silver and gemstones (jewellery), and arbitrary prints (merch). A saturated **cool** hue (blue-violet / ultramarine / cobalt family) is the least likely to blend into those images and carries no warning or success meaning.
  - Yellow/amber is best kept as the semantic *attention* colour (e.g. "needs your response") rather than the brand accent: it collides with gold jewellery, wood and butter tones, and with warning semantics.
  - As MastryHub does (`#FACC15` light → `#EAB308` dark), define a light-theme and a dark-theme tone of the accent so it meets 4.5:1 as text and 3:1 as a UI indicator in both.
- **R5. Annotation markers must not depend on hue at all.** For legibility on any photo: accent fill + 2 px white ring + a thin dark outer halo, numbered labels, and a minimum hit area. This works for cakes, furniture, jewellery and merch alike.
- **R6. Keep a neutral canvas behind reference images.** In colour-agreement workflows (icing shades, wood stains, metal finishes), the surround changes perceived colour. Recommend an untinted neutral image canvas, user-switchable between light, mid-grey and dark, independent of the app theme. Avoid placing the brand accent or saturated fills adjacent to the image.
- **R7. Channel MastryHub's energy into state changes, not decoration.**
  - MastryHub's energy comes from extreme contrast, a hot accent, heavy uppercase, hard 4 px shadows and fast press motion (150–300 ms).
  - Keep the fast, crisp motion timings: 150–200 ms for controls and 300 ms for surfaces and drawers, as measured on MastryHub, with `prefers-reduced-motion` respected.
  - Keep strong contrast for type and primary actions.
  - Drop decorative energy: tilted marquees, multiple display faces, all-caps everywhere, gradients.
  - Reserve a tactile, weighty treatment (inverse fill, subtle press) for the moment that matters: **"Approve & freeze version."**
- **R8. Typography.**
  - MastryHub's app is coherent because it uses one family (`trap`, 300–900) throughout. Recommend one neutral sans for UI plus one mono for IDs, version numbers and timestamps (Linear and MastryHub's landing both use mono for metadata).
  - Use sentence case for headings and buttons; reserve uppercase-with-tracking for small labels only.
  - Reference scale from MastryHub's app: h1 60/60 → 30/36 mobile, card title 18/28, body 14/22.75, labels 12–14. For an in-app tool, a smaller h1 is likely more appropriate (proposal).
- **R9. Theme mechanics.** Class strategy + `localStorage` (as MastryHub), **defaulting to `prefers-color-scheme`** when no choice is stored. Expose the toggle in the header or settings. Make closed drawers `inert`. Use a custom, accent-based `:focus-visible` ring (≥ 3:1 against adjacent colours) in both themes.
- **R10. Status set (proposal).** BriefRoom needs: open clarification, awaiting buyer, awaiting seller, resolved, approved by buyer, approved by seller, frozen. Follow MastryHub's pill construction (tint + strong text + 1 px border; translucent in dark), and add an icon so state never depends on colour alone.

---

## 10. Limitations

- **Public pages only.** `/` and `/explore` were analysed in depth; `/events` and `/hubs` were probed. The authenticated dashboard, where the `--dashboard-*` tokens are probably used, was not accessible; those tokens are verified as *declared and attached* but their usage was not observed.
- **Landing light/dark:** no visible difference exists to capture. This is the site's behaviour (forced dark), not a capture failure.
- **Theme toggle:** reachable only by opening the hamburger drawer. It was captured at both viewports. The mobile drawer is full-width (closed at −390 px). A first mobile run misjudged the drawer-closed state and fell back to a click on an empty page area (no visible side effect); it was re-run with a fixed check, and the published data comes from the second run.
- **Probe accuracy:** the first desktop run mis-attributed two `/explore` probes ("subtitle", "carousel arrow") to off-canvas drawer elements. Fixed (off-canvas elements excluded) and re-run; the JSON uses the corrected run.
- **Interaction coverage:**
  - Hover was measured at desktop only (no hover on touch).
  - Keyboard-focus sequences were measured in the light state at desktop only; dark-theme and mobile focus were not captured.
  - Pressed/active states were not captured.
- **Animated content:** `animations: 'disabled'` freezes CSS animations only. JavaScript carousels (MastryHub events and pitstops, Figma hero) can differ between captures; small census differences on `/` are attributed to this.
- **Fonts:** identified by computed `font-family`, `document.fonts` and `@font-face` rules. Font origin and licensing (e.g. `trap`) were not verified. Oswald is requested at weight 800 but only 500/700 are loaded.
- **`43ff4e9f473f496f.css`:** fetched but not attached on the inspected routes. Its `--landing-*` tokens are reported as declarations only and may apply on routes not inspected.
- **Secondary sites:**
  - Single viewport (1440×900), light emulation, home page only, first one to two viewports observed. No interactions were tested.
  - Linear and Framer render dark regardless of emulation.
  - Figma's hero rotates; its cookie banner was dismissed with the non-consent option.
  - Secondary colours were intentionally not extracted.
- **Time-varying content:** event listings, dates ("Sunday, November 22"), counts and the Stripe counter change over time; screenshots are a 2026-11-22 snapshot.
- **Environment:** headless Chromium with a desktop/mobile Chrome user agent. Real-device rendering (font smoothing, colour management) may differ slightly from the PNGs. Pixel diffs used a > 8/255 per-channel threshold.

### Screenshot index (`docs/design-references/`)

| File | What |
|---|---|
| [mastryhub-desktop-light.png](design-references/mastryhub-desktop-light.png) | `/` 1440×900, light emulation, toggle untouched |
| [mastryhub-desktop-light-fullpage.png](design-references/mastryhub-desktop-light-fullpage.png) | `/` full page (1440 wide), light |
| [mastryhub-desktop-emulated-dark.png](design-references/mastryhub-desktop-emulated-dark.png) | `/` with `prefers-color-scheme: dark` (byte-identical to light) |
| [mastryhub-desktop-toggled-dark.png](design-references/mastryhub-desktop-toggled-dark.png) | `/` after clicking the theme toggle (byte-identical to light) |
| [mastryhub-mobile-light.png](design-references/mastryhub-mobile-light.png) · [emulated-dark](design-references/mastryhub-mobile-emulated-dark.png) · [toggled-dark](design-references/mastryhub-mobile-toggled-dark.png) | `/` 390×844 (DPR 2); all three byte-identical |
| [mastryhub-explore-desktop-light.png](design-references/mastryhub-explore-desktop-light.png) · [dark](design-references/mastryhub-explore-desktop-dark.png) | `/explore` 1440×900, light vs toggled dark |
| [mastryhub-explore-desktop-menu-light.png](design-references/mastryhub-explore-desktop-menu-light.png) · [menu-dark](design-references/mastryhub-explore-desktop-menu-dark.png) | Slide-out menu with theme toggle, both themes |
| [mastryhub-explore-mobile-light.png](design-references/mastryhub-explore-mobile-light.png) · [dark](design-references/mastryhub-explore-mobile-dark.png) · [menu-light](design-references/mastryhub-explore-mobile-menu-light.png) · [menu-dark](design-references/mastryhub-explore-mobile-menu-dark.png) | `/explore` 390×844 (DPR 2) |
| [linear-desktop.png](design-references/linear-desktop.png) · [figma-desktop.png](design-references/figma-desktop.png) · [notion-desktop.png](design-references/notion-desktop.png) · [framer-desktop.png](design-references/framer-desktop.png) · [stripe-desktop.png](design-references/stripe-desktop.png) · [shadcn-desktop.png](design-references/shadcn-desktop.png) | Secondary references, 1440×900 |
| [mastryhub-colors.json](design-references/mastryhub-colors.json) | Full verified palette with per-value provenance and contrast table |
