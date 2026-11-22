# BriefRoom Design System

> **Source of truth for every frontend decision.** Tokens live in [`src/styles/globals.css`](src/styles/globals.css); this document explains them. Research evidence: [`docs/DESIGN_RESEARCH.md`](docs/DESIGN_RESEARCH.md). Living showcase: `/design-system`.
>
> Version 2.0 · 2026-11-22

---

## 1. Brand direction

**Positioning.** A premium visual collaboration and agreement workspace for custom-order businesses. Tagline: *"From something like this to exactly what we agreed to make."*

**Idea: ink + highlighter.** People bring BriefRoom a reference and *mark it up*. The identity is built from exactly that act. Ink is the precise near-black of a final decision. Paper is the warm off-white of a worksheet. A highlighter yellow marks what matters. That gives a sharp, editorial, crafted look that does not depend on pink or cake imagery, so it works the same for cakes, merchandise, furniture and jewellery.

**Personality:** creative · precise · clear · trustworthy · collaborative · crafted · professional.

| We are | We are not |
|---|---|
| Editorial, calm, confident | Playful-cute, pastel-sweet, "bakery" |
| High-contrast ink with one bright accent | Rainbow CTAs, gradient blobs, glassmorphism |
| The product UI shown as the hero | Stock dashboards with fake numbers |
| Restrained motion that explains state | Decorative animation |

---

## 2. MastryHub reference analysis (summary)

The full report is in `docs/DESIGN_RESEARCH.md`. It covers 264 verified values, 21 screenshots and the methodology. The findings that shaped BriefRoom:

1. **A two-tone ink/paper system.** In the app (`/explore`), light mode is `#FFFFFF` page with `#0F0F0F` text; dark mode is `#0F0F0F` page with `#FFFFFF` text (`--theme-bg` / `--theme-text`). Primary and selected states **invert** (black on white ↔ white on black).
2. **One loud accent, used sparingly.** `#FACC15` yellow, always paired with black text (13.7:1). It is used behind headline words like a highlighter stroke, on badges, and on the offset block behind the product preview.
3. **Tonal layering in dark.** Page `#0F0F0F`, list rows `#0A0A0A`, cards `#111111` with a `#1F2937` border, raised inputs `#1A1A1A`, chips `#1F2937`. No pure-black field everywhere.
4. **The dark theme is real but only reachable via a toggle** (`html.dark` + `localStorage.theme`). `prefers-color-scheme` changes 0 % of pixels. The marketing home page is art-directed dark in both states.
5. **Energy comes from contrast and hard edges.** Neo-brutalist buttons have 0 radius, a 2 px border and a hard `4px 4px 0` offset shadow. Secondary controls use dashed outlines.
6. **What not to copy.** Border contrast is only 1.24–1.47:1, focus uses the browser default, 13 invisible tab stops sit in the closed drawer, and the shadcn tokens have no dark values.

### 2.1 What BriefRoom takes, and what it leaves

| Taken (relationships) | Left behind |
|---|---|
| Ink/paper two-tone base and inverted primary across themes | Logo, illustrations, grunge display fonts, copy |
| A single yellow accent with dark text, used as a *highlighter* | 0-radius brutalist buttons and offset shadows on every control |
| Product preview framed in window chrome with an offset accent block (landing hero only) | Dashed outlines as the default secondary style |
| Tonal dark layers (page < card < raised) | Dark-only marketing page; toggle-only dark mode (BriefRoom also follows the system) |
| High-contrast type hierarchy | Low-contrast borders, default focus rings |

---

## 3. Verified reference values (MastryHub) vs adapted BriefRoom values

Labels: **Reference** = read from MastryHub CSS variables or computed styles (provenance in `docs/design-references/mastryhub-colors.json`). **Adapted** = an original BriefRoom value derived from that relationship. No adapted value is claimed to be MastryHub's.

| Role | MastryHub light (reference) | MastryHub dark (reference) | BriefRoom light (adapted) | BriefRoom dark (adapted) | Why it differs |
|---|---|---|---|---|---|
| Page background | `#FFFFFF` (`--theme-bg`) | `#0F0F0F` (`--theme-bg`) | `#F6F5F1` | `#0F0F11` | Warm paper separates page from white cards; long work sessions |
| Primary text | `#0F0F0F` (`--theme-text`) | `#FFFFFF` (`--theme-text`) | `#17161A` | `#F3F2EE` | Softer than pure black/white; less glare |
| Secondary text | `#4B5563` (computed) | `#9CA3AF` (computed) | `#64625C` | `#A6A49E` | Warm neutrals; ≥ 5.3:1 everywhere |
| Card | `#FFFFFF` + 3 px `#E5E7EB` | `#111111` + 3 px `#1F2937` | `#FFFFFF` + 1 px `#E2DFD7` | `#16161A` + 1 px `#2B2B31` | Lighter borders; elevation via tone + shadow |
| Row / secondary surface | `#F9FAFB` | `#0A0A0A` | `#F1EFEA` | `#1C1C21` | Visible tonal step in both themes |
| Raised input | `#FFFFFF`, 2 px dashed `#000` | `#1A1A1A`, 2 px dashed `#FFF` | `#FFFFFF`, 1 px `#8E8A81` | `#16161A`, 1 px `#6D6B73` | Solid 3.44:1 boundary (WCAG 1.4.11) |
| Chip | `#F3F4F6` | `#1F2937` | `#F1EFEA` | `#25252B` | Neutral, not blue-grey |
| Primary / selected | `#000000` on white | `#FFFFFF` on black | `#17161A` | `#F3F2EE` | Same inversion, softened |
| Accent | `#FACC15` + black text | `#FACC15` (badge `#EAB308`) | `#F6C343` + ink text | `#F6C343` + ink text | Warmer marigold highlighter; 11:1 with ink |
| Overlay | `#00000033` | `#00000066` | `rgb(23 22 26 / .45)` | `rgb(0 0 0 / .62)` | Stronger scrim for dialogs |
| Focus | browser default | browser default | 2 px ink ring + offset | 2 px highlighter ring | Visible ≥ 11:1 in both themes |

---

## 4. Colour system

### 4.1 Light theme tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#F6F5F1` | App/page background (paper) |
| `--foreground` | `#17161A` | Primary text (ink) |
| `--surface` | `#FFFFFF` | Cards, panels, inputs |
| `--surface-secondary` | `#F1EFEA` | Rows, segmented controls, insets |
| `--surface-tertiary` | `#E9E6DF` | Pressed / nested insets |
| `--surface-elevated` | `#FFFFFF` | Dialogs, menus, popovers (+ shadow) |
| `--primary` / `-foreground` / `-hover` | `#17161A` / `#FFFFFF` / `#2E2C31` | The one primary action per view |
| `--primary-soft` | `#FCF1C7` | Selected item (highlighter tint) |
| `--secondary` / `-foreground` / `-hover` | `#ECEAE4` / `#17161A` / `#E2DFD7` | Secondary buttons |
| `--accent` / `-foreground` | `#F6C343` / `#17161A` | Highlighter: brand mark, key highlights, own chat tint, dark focus ring |
| `--muted` / `--muted-foreground` | `#EEECE6` / `#64625C` | Hover fills / secondary text |
| `--border` / `--border-strong` / `--divider` | `#E2DFD7` / `#8E8A81` / `#EBE8E1` | Card edges / interactive boundaries / separators |
| `--input` / `--ring` / `--placeholder` | `#8E8A81` / `#17161A` / `#75726B` | Form control boundary / focus / placeholder |
| `--success` · `-bg` · `-text` | `#1D7A46` · `#E5F3EB` · `#16663A` | Approvals, agreed, resolved |
| `--warning` · `-bg` · `-text` | `#B45309` · `#FCF0DB` · `#8A4006` | Blockers, awaiting clarification |
| `--destructive` · `-bg` · `-text` | `#C4302B` · `#FCE8E7` · `#A52722` | Errors, changes requested, delete |
| `--info` · `-bg` · `-text` | `#2D5BCC` · `#E8EEFC` · `#2449A8` | Awaiting approval, links to versions |
| `--canvas` / `--canvas-dot` | `#E9E7E1` / `#D7D3CA` | Dotted work surface behind references |
| `--bubble-own` / `--bubble-other` | `#FCF4D6` / `#FFFFFF` | Conversation |

### 4.2 Dark theme tokens (designed separately, not inverted)

| Token | Value | Notes |
|---|---|---|
| `--background` | `#0F0F11` | Near-black with a cool hint; never pure `#000` |
| `--surface` / `-secondary` / `-tertiary` / `-elevated` | `#16161A` / `#1C1C21` / `#25252B` / `#1E1E23` | Four distinct tonal layers: navigation, cards, insets, overlays |
| `--foreground` / `--muted-foreground` | `#F3F2EE` / `#A6A49E` | Warm off-white text |
| `--primary` / `-foreground` / `-hover` | `#F3F2EE` / `#121214` / `#DAD8D1` | Primary inverts to paper, as on MastryHub |
| `--primary-soft` | `#2A2517` | Selected item (dim highlighter) |
| `--accent` | `#F6C343` | Same highlighter in both themes |
| `--border` / `--border-strong` / `--input` | `#2B2B31` / `#6D6B73` / `#6D6B73` | Boundaries still ≥ 3:1 where meaningful |
| `--ring` | `#F6C343` | Highlighter focus ring (11:1) |
| `--success-bg` / `-text` | `#10261A` / `#6CD39A` | Lighter text tints for dark surfaces |
| `--warning-bg` / `-text` | `#2A1E0C` / `#F4B157` | |
| `--destructive-bg` / `-text` | `#2C1413` / `#FF8F89` | |
| `--info-bg` / `-text` | `#121C34` / `#93B2FF` | |
| `--canvas` / `--canvas-dot` | `#0A0A0C` / `#1F1F25` | Canvas is darker than the page, so the image glows |
| `--bubble-own` / `--bubble-other` | `#29251A` / `#1C1C21` | |
| Shadows | black at 50–80 % | Dark elevation relies more on tone than on shadow |

Solid button fills for success/destructive/info keep the same hue in both themes, so their meaning never changes between themes.

### 4.3 Annotation tokens

Each kind has a **solid** (marker fill, white number), a **bg** (chip background) and **text** (chip label). Marker solids are identical in both themes because markers sit on photographs. Each marker also gets a 2 px white `--marker-ring` so it stays visible on any image.

| Kind → tone | Solid | Light chip (bg / text) | Dark chip (bg / text) | Icon | Label |
|---|---|---|---|---|---|
| KEEP | `#1D7A46` | `#E5F3EB` / `#16663A` | `#12271B` / `#6CD39A` | lock | Keep exactly |
| CHANGE (incl. colour, custom) | `#2D5BCC` | `#E8EEFC` / `#2449A8` | `#131D35` / `#93B2FF` | pencil · palette · message | Change this / Change colour / Custom instruction |
| REMOVE | `#C4302B` | `#FCE8E7` / `#A52722` | `#2E1515` / `#FF8F89` | eraser | Remove |
| QUESTION | `#7A3FD1` | `#F1EAFC` / `#6331B5` | `#231636` / `#C6A6FF` | circle-help | Ask a question |
| ADD | `#B25A00` | `#FCEFDF` / `#8C4700` | `#2C1D0B` / `#F5AE5C` | plus | Add something |

**Never colour alone.** Every annotation shows its number plus an icon or text label. Resolved annotations get a ✓ badge and a dashed outline. Status chips always pair an icon with text.

### 4.4 Colour rules

- **One primary per view.** Primary is ink (light) or paper (dark). Everything else is secondary, outline or ghost. The highlighter is never used as a second CTA colour.
- Success, warning, destructive and info keep their meaning in both themes.
- **Selected = highlighter** (`--primary-soft`), in both themes.
- The canvas is always the most contrasting region of the workspace, so references never blend into the panels.
- Components use semantic utilities only. No hex values appear outside `globals.css`, with two exceptions: user-chosen annotation colours, and the fixed white marker ring and labels drawn over photographs.

---

## 5. Contrast verification (WCAG 2.2 AA, calculated)

Ratios are computed with the WCAG relative-luminance formula from the token hex values by [`scripts/check-contrast.mjs`](scripts/check-contrast.mjs) (`npm run check:contrast`). They are **calculated, not estimated**.

| Pair | Tokens | Light | Dark | Required |
|---|---|---|---|---|
| Body text | `foreground` on `background` | 16.51:1 ✅ | 17.09:1 ✅ | ≥ 4.5:1 |
| Body text on card | `foreground` on `surface` | 18.01:1 ✅ | 16.11:1 ✅ | ≥ 4.5:1 |
| Text on secondary surface | `foreground` on `surface-secondary` | 15.67:1 ✅ | 15.15:1 ✅ | ≥ 4.5:1 |
| Text on elevated (dialogs, menus) | `foreground` on `surface-elevated` | 18.01:1 ✅ | 14.82:1 ✅ | ≥ 4.5:1 |
| Muted text on page | `muted-foreground` on `background` | 5.59:1 ✅ | 7.68:1 ✅ | ≥ 4.5:1 |
| Muted text on card | `muted-foreground` on `surface` | 6.10:1 ✅ | 7.24:1 ✅ | ≥ 4.5:1 |
| Muted text on secondary | `muted-foreground` on `surface-secondary` | 5.31:1 ✅ | 6.81:1 ✅ | ≥ 4.5:1 |
| Primary button label | `primary-foreground` on `primary` | 18.01:1 ✅ | 16.70:1 ✅ | ≥ 4.5:1 |
| Primary button (hover) | `primary-foreground` on `primary-hover` | 13.81:1 ✅ | 13.12:1 ✅ | ≥ 4.5:1 |
| Secondary button label | `secondary-foreground` on `secondary` | 14.97:1 ✅ | 13.60:1 ✅ | ≥ 4.5:1 |
| Highlighter accent label | `accent-foreground` on `accent` | 10.98:1 ✅ | 11.41:1 ✅ | ≥ 4.5:1 |
| Selected item text | `foreground` on `primary-soft` | 15.90:1 ✅ | 13.63:1 ✅ | ≥ 4.5:1 |
| Link / primary text on card | `primary-text` on `surface` | 18.01:1 ✅ | 16.11:1 ✅ | ≥ 4.5:1 |
| Destructive button | `destructive-foreground` on `destructive` | 5.52:1 ✅ | 5.52:1 ✅ | ≥ 4.5:1 |
| Success button | `success-foreground` on `success` | 5.35:1 ✅ | 5.35:1 ✅ | ≥ 4.5:1 |
| Success badge | `success-text` on `success-bg` | 6.13:1 ✅ | 8.69:1 ✅ | ≥ 4.5:1 |
| Warning badge | `warning-text` on `warning-bg` | 6.61:1 ✅ | 8.74:1 ✅ | ≥ 4.5:1 |
| Destructive badge | `destructive-text` on `destructive-bg` | 6.12:1 ✅ | 7.84:1 ✅ | ≥ 4.5:1 |
| Info badge | `info-text` on `info-bg` | 6.97:1 ✅ | 8.10:1 ✅ | ≥ 4.5:1 |
| Tooltip | `tooltip-foreground` on `tooltip` | 18.01:1 ✅ | 16.70:1 ✅ | ≥ 4.5:1 |
| Placeholder in input | `placeholder` on `surface` | 4.80:1 ✅ | 5.30:1 ✅ | ≥ 4.5:1 |
| Own chat bubble | `foreground` on `bubble-own` | 16.34:1 ✅ | 13.65:1 ✅ | ≥ 4.5:1 |
| Other chat bubble | `foreground` on `bubble-other` | 18.01:1 ✅ | 15.15:1 ✅ | ≥ 4.5:1 |
| Activity card | `foreground` on `activity` | 17.25:1 ✅ | 15.47:1 ✅ | ≥ 4.5:1 |
| Marker number KEEP | `#FFFFFF` on `ann-keep` | 5.35:1 ✅ | 5.35:1 ✅ | ≥ 4.5:1 |
| Marker number CHANGE | `#FFFFFF` on `ann-change` | 6.03:1 ✅ | 6.03:1 ✅ | ≥ 4.5:1 |
| Marker number REMOVE | `#FFFFFF` on `ann-remove` | 5.52:1 ✅ | 5.52:1 ✅ | ≥ 4.5:1 |
| Marker number QUESTION | `#FFFFFF` on `ann-question` | 6.07:1 ✅ | 6.07:1 ✅ | ≥ 4.5:1 |
| Marker number ADD | `#FFFFFF` on `ann-add` | 4.82:1 ✅ | 4.82:1 ✅ | ≥ 4.5:1 |
| Chip KEEP | `ann-keep-text` on `ann-keep-bg` | 6.13:1 ✅ | 8.58:1 ✅ | ≥ 4.5:1 |
| Chip CHANGE | `ann-change-text` on `ann-change-bg` | 6.97:1 ✅ | 8.01:1 ✅ | ≥ 4.5:1 |
| Chip REMOVE | `ann-remove-text` on `ann-remove-bg` | 6.12:1 ✅ | 7.73:1 ✅ | ≥ 4.5:1 |
| Chip QUESTION | `ann-question-text` on `ann-question-bg` | 6.79:1 ✅ | 8.31:1 ✅ | ≥ 4.5:1 |
| Chip ADD | `ann-add-text` on `ann-add-bg` | 6.15:1 ✅ | 8.61:1 ✅ | ≥ 4.5:1 |
| Input border vs card (WCAG 1.4.11) | `input` on `surface` | 3.44:1 ✅ | 3.44:1 ✅ | ≥ 3:1 |
| Outline control border vs card | `border-strong` on `surface` | 3.44:1 ✅ | 3.44:1 ✅ | ≥ 3:1 |
| Focus ring vs page | `ring` on `background` | 16.51:1 ✅ | 11.68:1 ✅ | ≥ 3:1 |
| Focus ring vs card | `ring` on `surface` | 18.01:1 ✅ | 11.00:1 ✅ | ≥ 3:1 |
| Primary button vs page | `primary` on `background` | 16.51:1 ✅ | 17.09:1 ✅ | ≥ 3:1 |
| Card edge (decorative, not required) | `border` on `surface` | 1.33:1 | 1.28:1 | decorative |

**80 checks, 0 failures.** Card edges are decorative: cards are identified by tone and shadow, not by the border, so 1.4.11 does not apply to them. Disabled controls (50 % opacity) are exempt under WCAG, but labels stay legible.

---

## 6. Typography

| Family | Role | Why |
|---|---|---|
| **Manrope** 400–800 | All UI text | Geometric grotesk close in spirit to MastryHub's self-hosted "trap" (which we do not reuse), with excellent small-size legibility and tabular numerals |
| **Fraunces** 500–600 (opsz 9–144) | Selected editorial headings, wordmark | Adds craftsmanship and warmth that suits "made to order", and keeps BriefRoom from looking like a generic SaaS |
| **IBM Plex Mono** 400–500 | SHA-256 fingerprints, IDs, hex colours | Unambiguous glyphs (0/O, 1/l) for values people compare |

Fonts load from Google Fonts with `display=swap` and `preconnect`, with system fallbacks defined in the theme. Three families, nine weights in total.

| Style | Spec | Usage |
|---|---|---|
| Display | Fraunces 600, `clamp(40px, 6vw, 76px)`, −0.03em, 1.02 | Landing hero |
| Page title | Fraunces 600, 28–34 px, −0.02em | Dashboard, onboarding, work order |
| Section heading | Manrope 700, 18–22 px, −0.01em | Landing sections, panel titles |
| Card title | Manrope 700, 15 px | Cards, dialogs (18 px) |
| Body | Manrope 400–500, 15 px / 1.55 (14 px in dense panels) | Text |
| Caption / metadata | Manrope 500–600, 12–13 px, `muted-foreground` | Timestamps, authorship |
| Overline | Manrope 700, 11–12 px, uppercase, +0.08em | Group labels ("NEEDS CLARIFICATION") |
| Button | Manrope 600, 13–15 px | All buttons |
| Technical | IBM Plex Mono 400, 11–13 px | Fingerprints, IDs, hex |

---

## 7. Spacing, radius, elevation

- **Spacing:** a 4 px grid (Tailwind scale: 1 = 4 px). The common rhythm is 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.
- **Control heights:** sm 32 px · md 40 px · lg 48 px. Touch targets are 40 px minimum and 44–56 px on mobile navigation and primary mobile actions.
- **Radius:** sm 6 · md 8 (buttons, inputs, menus) · lg 12 (cards, panels) · xl 16 (dialogs, sheets, landing preview). Pills are used only for status chips and marker numbers. Nothing is "blob-rounded".
- **Elevation:** `xs` controls · `sm` cards · `md` floating toolbars · `lg` menus/popovers · `xl` dialogs/sheets. In dark mode, tone does most of the elevation work.
- **Layout dimensions:** dashboard sidebar 248 px; workspace left rail 300 px (≥ 1280); right panel 380–400 px; dialogs max-width 512 px (`xl` 576 px); sheets 440 px (side) or 88 dvh (bottom).
- **No** glassmorphism and no decorative gradient blobs. Backdrop blur is limited to a 2 px dialog scrim and translucent sticky bars, where it serves legibility.

---

## 8. Components (Light and Dark come from the same tokens)

| Component | Spec |
|---|---|
| **Primary button** | `bg-primary` / `primary-foreground`, radius 8, 600 weight, `shadow-xs`; hover `primary-hover`; active translateY(1px); focus 2 px ring + 2 px offset; disabled 50 %; loading spinner + `aria-busy` |
| **Secondary** | `bg-secondary`, hover `secondary-hover` |
| **Outline** | 1 px `border-strong` (3.44:1) on `surface`; hover `surface-secondary` |
| **Ghost / subtle** | Transparent; hover `muted`; subtle starts in `muted-foreground` |
| **Icon button** | 40 × 40 (32 × 32 sm); always has `aria-label` |
| **Success / destructive** | Used only for approve, agree and delete decisions |
| **Inputs / textareas / selects** | `surface`, 1 px `input` border, radius 8, 40 px; focus = `ring` border + 3 px ring at 25 %; `aria-invalid` turns destructive; native `select` for mobile reliability |
| **Tabs** | Segmented: `surface-secondary` track, active = `surface` + `shadow-xs` |
| **Modal (Dialog)** | `surface-elevated`, radius 16, `shadow-xl`, scrim `overlay`, focus trapped, Esc closes, a close button with label |
| **Sheet** | Bottom sheet on phones (88 dvh, safe-area padding), right panel (440 px) elsewhere |
| **Dropdown / popover** | `surface-elevated`, radius 12, `shadow-lg`; items 36 px, highlighted with `muted` |
| **Tooltip** | Inverted (`tooltip` / `tooltip-foreground`), 12 px; supplementary only, never essential |
| **Sidebar / header** | `surface` with a 1 px `border`; active nav = `primary-soft` + `foreground` |
| **Status badge** | Pill, tone-bg + tone-text + icon + text (e.g. *Awaiting approval*) |
| **Cards** | `surface`, 1 px `border`, radius 12, `shadow-xs` |
| **Image canvas** | Dotted `canvas` surface, image fit-contain with radius 6 and `shadow-lg`, zoom toolbar floating bottom-right |
| **Annotation marker** | Rect: 2 px tone border with a faint white fill, number badge (24 px, tone solid, white 11 px bold, 2 px white ring) at top-left; point: 28 px badge; selected: other markers drop to 45 % opacity, page dims via `canvas-dim`, ring 3 px; resolved: dashed + ✓ |
| **Chat bubbles** | Own = `bubble-own` (highlighter tint), other = `bubble-other`; radius 12 with a tail corner of 4; sender name + role above; time + state (✓, ✓✓, *Not sent · Retry*) below |
| **Activity message** | Centred card (`activity`), header row with icon + actor + time, optional region crop, summary, lines, fingerprint with a *verified* badge checked against the API, and an action button |
| **Clarification card** | Status icon (help / shield / check), title, badges (Blocks next version · source · owner), evidence quote, thread, *Answer that resolves it* field, critical switch |
| **Specification row** | Label + required mark (visible `*` + sr-only "required"), help/last-changed line, seller-only lock icon, dirty ring |
| **Version card** | Number, status badge, date, mono fingerprint, note, change count, approvals x/2 |
| **Comparison panel** | Before/after slider (range input) or side by side; New / Removed / Changed tags on regions; a spec table with struck-through *before* |
| **Approval card** | Info border, version + fingerprint, both participants' states, Request changes (outline) + Approve (success); confirm dialog repeats the full hash |
| **Agreement card** | Success header *ORDER AGREED*, both approvals, full fingerprint, *Verify in your browser* (WebCrypto), work order button |
| **Timeline / activity** | Icon dot + summary + relative time, newest first |
| **Notifications** | Sonner toasts, bottom-centre on mobile, top-right on desktop; success/error variants; `role=status` |
| **Empty state** | Dashed border card, 48 px icon disc in `primary-soft`, title, one sentence, one action |
| **Skeleton** | `skeleton` token, pulse (disabled under reduced motion) |
| **Error state** | `destructive-bg`, alert icon, title + explanation + retry; `role=alert` |

---

## 9. Motion

Built with Motion for React (`motion/react`) plus CSS transitions. Durations are 120–250 ms, springs use stiffness 260–500 and damping 24–28, and nothing loops except loading indicators.

| Moment | Motion |
|---|---|
| Open order room | Panels fade in (150 ms); canvas image fades in when decoded |
| Create / select annotation | Marker springs from 0.4 → 1; the selected marker scales 1.25 and the others dim; the canvas scrolls the region into view |
| Expand contextual discussion | Replies slide up 6 px + fade |
| Resolve | Badge swaps to ✓ and the outline turns dashed (colour + icon + text) |
| Version diff | Slider follows the pointer directly (no easing lag) |
| Live chat event | New message appended; auto-scroll only if the user is near the bottom |
| Approval → agreed | Agreement card springs in (scale 0.98 → 1) once |

`prefers-reduced-motion: reduce` turns transitions and animations off globally (`globals.css`), and `useReducedMotion()` disables JS-driven motion and smooth scrolling.

---

## 10. Responsive behaviour

| Range | Navigation | Canvas | Annotations | Conversation & decisions | Approval |
|---|---|---|---|---|---|
| **Desktop ≥ 1440** (and ≥ 1280) | Compact header | Centre column, flexible | Left rail 300 px (list → thread) | Right panel 400 px, tabs: Chat · Radar · Details · Versions | Header CTA + Versions tab |
| **Laptop 1024–1279** | Compact header | Left, flexible | *Notes* tab in the right panel | Right panel 360–380 px, 5 tabs | Same |
| **Tablet 768–1023** | Compact header, tab labels become icons + sr-only text | Left, flexible | *Notes* tab | Right panel 320 px | Same |
| **Mobile 360–767** | Header with overflow menu; **bottom tab bar** (Brief · Chat · Radar · Details · Versions, 56 px targets) | 62 dvh, *Select* tool by default so the page scrolls; *Mark area* / *Drop pin* are explicit modes | List under the canvas; the thread opens in a **bottom sheet** | Full-screen tabs | **Sticky "Review & approve" bar** above the tab bar |

Dashboard: sidebar ≥ 1024, top bar + filter chips below. Order cards: 3 columns ≥ 1280, 2 ≥ 768, 1 on phones. Version comparison is side by side on wide screens and stacked with a slider on phones. No layout may produce horizontal page overflow; the reference strip and tab lists scroll inside themselves.

---

## 11. Theme switching

- Modes: **Light · Dark · System**, from an accessible menu with radio items in the header (or a segmented radio group on `/design-system`).
- The preference is persisted in `localStorage['br.theme']`. *System* follows `prefers-color-scheme` live and syncs across tabs.
- **No flash:** an inline script in `index.html` sets `data-theme`, `color-scheme` and `<meta name=theme-color>` before first paint.
- Variables are central: the whole UI reads semantic CSS variables from `globals.css`. Overlays portal into `<body>` and therefore inherit the theme.
- Print is always light (A4 work order), whatever the screen theme.
- **Known exception:** the seller *inbox* embeds Nexconn Chat UI, whose web components hard-code a light palette and expose no theming API (verified in the installed bundle). It is shown inside a framed panel and labelled. The workspace conversation is BriefRoom's own themed UI on the Chat SDK.

---

## 12. Accessibility requirements (WCAG 2.2 AA)

- Contrast per §5. Focus is always visible (2 px ring + offset), never removed without a replacement.
- Fully keyboard operable. Canvas markers are buttons with descriptive labels; J/K or ←/→ move between annotations; V/R/P switch tools; Esc cancels. Dialogs trap focus and restore it. Menus use Radix roving focus.
- Labels: every input has a `<label>`; required fields show `*` plus sr-only "(required)"; errors use `aria-invalid` + `aria-describedby`.
- Status is never conveyed by colour alone (icons + text everywhere). Live regions announce connection state, chat additions and toasts.
- Target size ≥ 24 × 24 CSS px (2.5.8), with 40–56 px used for primary targets.
- Dragging alternatives (2.5.7): annotations can also be created with a single tap (default-size region or pin).
- Reduced motion is respected. Images have alt text; decorative crops are `aria-hidden`.

---

## 13. Do / Don't

| Do | Don't |
|---|---|
| Use semantic utilities (`bg-surface`, `text-muted-foreground`) | Hard-code hex values in components |
| Keep one primary action per view | Colour every CTA differently |
| Use the highlighter for selection and emphasis | Use yellow as a background for large areas or long text |
| Pair every status colour with an icon + label | Rely on colour alone |
| Keep the canvas the most contrasting element | Put the image on a background matching its panel |
| Show honest empty, error and offline states | Fake chat, fake users or fabricated numbers |
| Design dark mode component by component | `filter: invert()` or auto-inverted colours |
| Use subtle motion that explains change | Animate for decoration |
