# BriefRoom: motion research

**Date:** 2026-11-22
**Method:** I opened each page in headless Chromium (Playwright 1.65.1, 1440×900, a standard desktop Chrome user-agent string, software WebGL, no WebGPU). I took frames about 0.5, 2 and 5 s after DOMContentLoaded, plus a 700 ms idle control. I then moved the pointer to 4–5 positions, used a 300 px wheel scroll, and scrolled to 25/50/75/100 %. Each frame pair was compared by pixel diff and by a diff of computed `transform` and `opacity` values. Recorded MP4s were sampled by seeking to 8 points in each video. Doc pages were read with `page.innerText`, and versions come from `npm view`. All frames are kept outside the repo. Anything marked *inferred* was not seen directly.

---

## 1. Shopify Editions Winter '24 header

- **URLs inspected:** https://www.awwwards.com/inspiration/shopify-winter-24-edition-header-shopify-editions-winter-24 and the live site it links to, https://www.shopify.com/editions/winter2024
- **Method:** On Awwwards the element is shown as 3 muted, looping MP4s (3.0 s, 9.9 s and 5.6 s, at 1600×1200). I sampled 8 frames from each by seeking. The live site got the full capture run.

**Observed: Awwwards recordings**
- The scene is a "FOUNDATIONS" headline over a field of white/lavender stepped cubes. Product cards float at different depths: a sneaker card, a talking-head video tile, a POS terminal, helmet cards, a surf-photo card with a small control panel, chrome stars/diamonds and a coin stack.
- **3.0 s clip:** the camera pushes into the cube field. Cards grow and spread outward, and by ~60 % of the clip white blocks fill the frame. A white "CONVERSION" section then comes in from the bottom, with a variant-editor UI card on a white pedestal and a round avatar-video bubble. *Inferred* to be scroll-driven, because the section text enters from below while the cursor stays still.
- **9.9 s clip:** hovering an object shows an uppercase callout joined to it by a thin leader line, e.g. "ATTRACT NEW CUSTOMERS WITH SHOP CAMPAIGNS" on the coin and "ALL-NEW HARDWARE FOR SHOPIFY POS" on the terminal. The coin turns. Hovering the helmet area fans out three colour-variant helmet cards. The clip is zoomed/cropped, so I can't tell whether the zoom comes from the site or from the recording.

**Observed: live site**
- **Staged intro.** The first frame came at 1.9 s because the screenshot was slow. It showed only the headline at low opacity on a lavender gradient, with no nav. At 2.75 s the headline was fully opaque and the nav was present, but the 3D layer was not. By 7.3 s the 3D cube scene and cards were in place.
- **Build:**
  - two `.glb` models (`cubeworld-jan19-6.glb`, `cartridge-jan25.glb`) with the Draco decoder WASM, drawn into a full-viewport 1440×900 canvas;
  - six `.riv` files plus `rive.wasm` (`@rive-app/canvas@2.37.4`) for the feature illustrations, in 402×402 and 658×406 canvases;
  - 27 DOM elements with `matrix3d` transforms inside `perspective: 1388.58px` containers, and 34 `preserve-3d` elements.
- **Pointer.** In the control step (no pointer movement) no DOM transforms changed. Video playback still changed about 11 % of pixels. Every pointer move changed the `matrix3d` of 5 DOM card elements. For one card, the Y angle derived from its matrix ranged from about 8° to 13° across the five pointer positions, so the cards parallax by a few degrees with the pointer. The hover callouts did not appear because my pointer positions did not land on objects.
- **Idle motion.** With no input, between the 7.3 s and 9.7 s frames, the coin turned and the helmet cards went from a fan of 3 to 1.
- **Scroll:**
  - A 300 px wheel moved `scrollY` by only 130 px. The page handles scrolling itself (*inferred*).
  - That scroll rotated a large 3D container by about 11°: m11 went from 0.527 to 0.360.
  - `scrollTo(25 %)` ended at y=901 instead of about 11,479.
  - Sections in scroll order: the white CONVERSION section (UI card on a pedestal), Shopify Magic chat-UI cards surrounded by floating chrome stars, then a dark Developer section with list rows and a blurred gradient glow.
- **Reduced motion.** No `prefers-reduced-motion` rules were found in the readable stylesheets. One cross-origin sheet could not be read.

**Relevant to BriefRoom**
- **Reference canvas:** place references as cards at different depths and give them a few degrees of pointer-coupled tilt. Plain DOM is enough; this does not need a WebGL scene.
- **Annotation pins:** use the hover callout with a leader line and an uppercase label as the pin tooltip.
- **Version comparison:** use the helmet "fan" as a stacked set of versions that spreads out on hover or focus.
- **Page entry:** use the staged reveal order: headline, then chrome, then the spatial layer.

**Limits:** I saw the hover callouts only in the recordings. WebGL was software-rendered. The first-frame timing was inflated by the slow screenshot. The Awwwards cookie notice ("GOT IT") was visible in the corner but did not cover the content.

## 2. Bezel (landing.love)

- **URLs:** https://www.landing.love/sites/bezel/ was inspected. The live site it links to ("Visit Site", https://www.bezel.it/) could **not** be opened: both `www.bezel.it` and `bezel.it` failed with `ERR_NAME_NOT_RESOLVED` in this environment.
- **Method:** full capture run on the landing.love page, plus 8 seek samples of its 80 s "Full Recording" MP4.

**Observed**
- landing.love describes Bezel as "a collaborative 3D design tool, empowering teams to design and prototype on a spatial canvas together". Its clip index labels are: Hero "3D & WebGL", Features "3D & WebGL", and Features "Scroll Animation" (×3).
- The hero frame of the recording shows a dark 3D scene: a desk, plant and laptop, plus a chair wrapped in a red 3D selection bounding box. A floating bar-chart card ("3,027") hangs above the desk. Coloured cursor/flag markers point at objects. *Inferred:* these are collaborator markers. The headline reads "Design and prototype on a spatial canvas together".
- Seeking the recording to 0:02 … 1:18 repainted the **same hero frame** every time; only the player's timecode changed. So I could not see the later sections in this run.
- The landing.love page itself showed no pointer response: 0 % pixel change and no transform changes.

**Relevant to BriefRoom:** collaborator cursors and a selection box inside a spatial scene map to presence on the reference canvas, showing who is looking at which reference. The floating data card maps to a small status card on the canvas.

**Limits:** everything after the hero frame, and the live site.

## 3. Framer University: spatial 3D hero

- **URLs:** https://framer.university/resources/spatial-3d-hero-section-in-framer and its "View demo", https://spatial-hero.learnframer.site/
- **Method:** full capture run on both pages. The demo cannot scroll (page height equals the viewport).

**Observed**
- **How it's built, per the resource text:** 10 images, each made into a component with a hover variant that changes opacity and scale. The frames are rotated on x/y/z and some are placed deeper. A "3D Look" component makes the frame follow the cursor.
- **Intro:** at 0.5 s the cards were at low opacity. At 2 s they were fully visible and the centred headline ("Get exclusive access to our marketplace") had appeared. Between 2 s and 5 s the whole cluster shifted as it settled. After 5 s nothing changed without input.
- **Pointer** (read from the container's computed `matrix3d`):
  - centre: perspective 500 px (m34 = −0.002), no rotation;
  - upper-left: about +5.7° rotateY and +5.0° rotateX;
  - lower-right: about −6.0° and −5.4°;
  - right-middle: about −7.5° and +1.4°;
  - back at centre: flat again.
  - Each move changed 22–27 % of pixels, so the whole composition moves, not single cards.
- **Hover:** the card under the pointer went to `scale(1.05)` with `opacity: 0.5`.
- The demo loads Framer's `motion` module. 62 elements have `will-change: transform`. The resource page itself showed no pointer response.

**Relevant to BriefRoom:** a "reference wall" with references as tilted cards around the brief title, and the whole group tilting up to about 6° toward the pointer at roughly 500 px perspective. On hover we should raise the card (scale about 1.03–1.05), **not** dim it to 0.5 opacity, so it stays readable.

**Limits:** Framer's spring settings are not visible. Frames are about 1.3 s apart, so easing curves were not measured.

## 4. Spline for Web

- **URLs:** https://spline.design/web, https://spline.design/pricing, https://docs.spline.design/ (index only), and the npm README of `@splinetool/react-spline`.
- **Method:** full capture run, plus text extraction.

**Observed**
- **Hero:** in headless Chromium the hero area showed only the text "This scene requires a WebGPU-capable browser." That scene did not fall back to WebGL.
- **"One tag, any website":** `<spline-viewer>` loaded from `unpkg.com/@splinetool/viewer@2.0.75`. The page text: "It hears the whole page, not just its canvas: scenes can follow the cursor, look at it and animate as the page scrolls." The demo canvas showed a cube with an axis gizmo.
- **"Your 3D scene, as code":**
  - export to Vanilla JS, React, Next.js, Three.js or react-three-fiber;
  - the code sample uses `import { Application } from '@splinetool/runtime'` and `app.load('https://prod.spline.design/…/scene.splinecode')`.
- **Feature cards** (read from the 75 % frame):
  - **Code API:** trigger events and change variables/properties from code.
  - **Public URLs.**
  - **Self-hosted:** "Download the whole project, runtime included … On the Enterprise plan."
  - **WebGPU:** "fall back to WebGL automatically where it isn't available".
- **Pointer:** moving the pointer at the top of the page changed no pixels. The DOM changes I recorded came from an auto-cycling status list lower on the page ("Reading scene… Modeling… Lighting… Reviewing…"), which runs regardless of the pointer.
- **Pricing:** "Every plan comes with unlimited viewers. Paid plans add AI credits for every seat, watermark-free exports and more."
- **React README:**
  - install with `npm install @splinetool/react-spline @splinetool/runtime`;
  - import `Spline` from `@splinetool/react-spline`, or from `/next` for Next.js;
  - `onLoad(app)` gives `findObjectByName`/`findObjectById`, and `emitEvent('mouseHover', 'Cube')` is available;
  - the README has a "Lazy loading" section.

**Relevant to BriefRoom:** scene-level cursor following is attractive, but it would mean a runtime package (36.7 MB unpacked on npm) and a scene file fetched from `prod.spline.design` unless we self-host, which is Enterprise-only. That is out of proportion for BriefRoom.

**Limits:** the hero 3D scene did not render (no WebGPU in headless), and I did not open the detailed docs pages.

## 5. Rive for websites

- **URLs:** https://rive.app/use-cases/websites, https://rive.app/docs/runtimes/react/react, https://rive.app/docs/runtimes/web/web-js, https://rive.app/runtimes, https://rive.app/pricing
- **Method:** full capture run, plus text extraction.

**Observed**
- **Showcase:** the page is built in Framer. The showcase tiles (Figma, Shopify Editions, Intercom) are looping MP4s of 5.5 s, 11.8 s and 6.4 s. **No `.riv` file or Rive WASM was requested on this page** in my session, so I could not test a live state machine here.
- **Hero:** the prompt box has an animated multicolour glowing border. Its colours changed between the 0.5 s and 2 s frames.
- **Copy:**
  - "State machines respond to hover and clicks, and your code can drive the file from scroll or any other value."
  - "Vector graphics stay crisp at any size."
  - "Shopify built its Winter '24 Edition with Rive." This matches the six `.riv` files I saw loading in §1.
- **Docs:**
  - The React guide uses `@rive-app/react-webgl2` with `useRive({ …, autoplay: true })` and view-model hooks (`useViewModelInstanceNumber`).
  - "The Rive canvas sizes itself based on its container."
  - The web docs recommend `@rive-app/webgl2` (the Rive Renderer). They suggest `@rive-app/canvas-lite` as a smaller variant if you don't use Text, Layouts, Scripting or Audio, and calling `resizeDrawingSurfaceToCanvas()` in `onLoad`.
  - The docs have sections titled "Runtime Sizes", "Canvas vs WebGL2" and "Preloading WASM". I did not extract the figures.
- **Licensing:** "MIT-licensed runtimes. No royalties, no revenue share, no runtime fees." Pricing says: "Free exports play a Rive splash screen"; paid plans let you "Ship apps and games without the splash screen."

**Relevant to BriefRoom:** Rive fits one small, state-driven illustration, such as an agreement seal that reacts to "approved by A", "approved by B" and "agreed". It needs a `.riv` asset authored in the Rive Editor or CLI, and free exports show a splash screen.

**Limits:** no live Rive interaction was observed on rive.app. The only live Rive I saw was the `.riv` loads on Shopify's site.

## 6. Motion for React docs (motion.dev)

- **URLs:** `/docs/react`, `react-layout-animations`, `react-gestures`, `react-scroll-animations`, `react-use-scroll`, `react-use-transform`, `react-use-spring`, `react-animate-presence`, `react-use-reduced-motion`, `react-motion-config`, `react-accessibility`. Method: text extraction.

**Recorded API**
- **Import and engine:** import from `"motion/react"`. Motion describes a hybrid engine: animations run on the Web Animations API and ScrollTimeline, with a JS fallback for springs, interruptible keyframes and gesture tracking.
- **Gestures:**
  - props `whileHover`, `whileTap`, `whileFocus`, `whileDrag`, `whilePinch`, `whileInView`;
  - `tap={{ count: 2 }}` (double tap), `tap={{ hold: 0.5 }}` (long press), and a `repeat` option;
  - elements with tap events are keyboard-accessible: Enter fires `onTapStart`/`whileTap` on press and `onTap` on release.
- **Layout:**
  - `layout`, plus `layout="position"` for elements that change aspect ratio;
  - `layoutId` for shared elements, `LayoutGroup`, `layoutScroll` for scroll containers, `layoutRoot` for fixed elements;
  - animated with transforms, with scale correction for `borderRadius`/`boxShadow`;
  - a curved path via `transition={{ layout: { path: arc() } }}` (`import { arc }`);
  - layout animations are blocked during horizontal window resize, and do not work on `display: inline`.
- **AnimatePresence:**
  - each direct child needs a unique `key`;
  - `mode` is `"sync"` (default), `"wait"` or `"popLayout"`; `popLayout` needs a parent that is not `position: static`;
  - other props: `initial`, `custom`, `onExitComplete`, `propagate`, `root`;
  - hooks: `useIsPresent`, `usePresenceData`.
- **Scroll:**
  - `whileInView` with `viewport={{ once, root }}`, and `useInView`;
  - `useScroll` returns `scrollX`/`scrollY`, `scrollXProgress`/`scrollYProgress` and `scrollXLength`/`scrollYLength`;
  - `useScroll` options: `container`, `target`, `axis`, `offset` (e.g. `["start end", "end start"]`), `trackContentSize`;
  - progress mapped to `opacity`, `transform`, `clipPath` or `filter` runs on the GPU through ScrollTimeline.
- **Spring and transform:**
  - `useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })`, with `skipInitialAnimation` and `.jump()`;
  - `useTransform` takes a function or a value map, with options `clamp`, `ease`, `mixer`, and an object-output form for parallax (`{ foregroundY: [0, 2], backgroundY: [0, 0.5] }`);
  - `useMotionValueEvent(scrollY, "change", …)`.
- **Reduced motion:**
  - `<MotionConfig reducedMotion="user" | "always" | "never">`, default `"never"`;
  - `"user"` turns off transform and layout animations but keeps `opacity`/`backgroundColor`;
  - `useReducedMotion()` returns `true` when the OS setting is on;
  - the docs advise replacing transforms with opacity and turning off autoplay video and parallax.
- **Compared with View Transitions:** Motion states that its layout animations are interruptible and don't block pointer events.

## 7. GSAP ScrollTrigger and licensing

- **URLs:** https://gsap.com/docs/v3/Plugins/ScrollTrigger/, https://gsap.com/pricing/, https://gsap.com/standard-license/ (redirects to `/community/standard-license/`), https://gsap.com/resources/React/

**Recorded**
- **Config:**
  - `trigger`, `start`/`end` (String | Number | Function; doc examples `"top top"`, `"+=500"`, `"bottom 50%+=100px"`), `endTrigger`;
  - `pin` ("don't animate the pinned element itself"), `pinSpacing`, `pinType`, `pinReparent`, `pinnedContainer`, `anticipatePin`;
  - `scrub` (`true`, or seconds to catch up, e.g. `0.5`);
  - `snap` (Number | Array | Function | Object | `"labels"` | `"labelsDirectional"`);
  - `toggleActions` (default `"play none none none"`), `toggleClass`, `markers`, `once`;
  - `containerAnimation`, `fastScrollEnd`, `preventOverlaps`, `refreshPriority`, `scroller`, `horizontal`, `invalidateOnRefresh`.
- **Static methods:** `batch()`, `matchMedia()`, `normalizeScroll()`, `scrollerProxy()`.
- **React:** `@gsap/react` `useGSAP()` replaces `useEffect`/`useLayoutEffect` and cleans up automatically through `gsap.context()`. It is registered with `gsap.registerPlugin(useGSAP)`.
- **Licensing:**
  - The pricing page says "GSAP is now 100% free for all users, thanks to Webflow's support."
  - The npm `license` field is "Standard 'no charge' license".
  - The licence's prohibited use is tools that let users build visual animations without code and that compete with Webflow's visual animation building.
  - The ScrollTrigger page still calls ScrollSmoother a "members-only benefit", which is stale wording that contradicts the pricing page.

**Relevant to BriefRoom:** pin, scrub and snap are only needed for a long scroll story. Motion's `useScroll` with `target`/`offset` covers BriefRoom's needs without a second animation engine.

---

## Technology notes

All versions are from `npm view`, run 2026-11-22. BriefRoom uses React 19.3.1.

| Library | Version | React 19 compatibility (peerDependencies) | Runtime / bundle notes (as stated) | Licence (as stated) |
|---|---|---|---|---|
| `motion` | 14.14.0 (installed) | `react ^18.0.0 \|\| ^19.0.0` ✔ | WAAPI + ScrollTimeline hybrid with JS fallback; docs have a "Reduce bundle size" (`LazyMotion`) page | MIT |
| `@react-three/fiber` | 9.8.2 | `react >=19 <19.4`. ✔ for 19.3.1, but the upper bound blocks React 19.4 | needs `three >=0.156` | MIT |
| `@react-three/drei` | 10.7.9 | `react ^19`, `@react-three/fiber ^9.0.0` ✔ | needs `three >=0.159` | MIT |
| `three` | 0.187.0 | n/a | 21.0 MB unpacked (npm metadata, not bundle size) | MIT |
| `gsap` (+ `@gsap/react` 2.1.2) | 3.15.1 | `@gsap/react`: `react >=17`, `gsap ^3.12.5` ✔ | `useGSAP()` handles cleanup | "Standard 'no charge' license"; free incl. plugins (pricing page) |
| `@splinetool/react-spline` | 4.2.0 | `react *`, `react-dom *`, `@splinetool/runtime *`, `next >=14.2.0` (optional) ✔ | `@splinetool/runtime` 2.0.211 is 36.7 MB unpacked; scenes load from `prod.spline.design` unless self-hosted (Enterprise) | no licence field on npm; watermark-free exports on paid plans |
| `@rive-app/react-canvas` | 4.41.0 | `react ^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19.0` ✔ | depends on `@rive-app/canvas` 2.54.0 (WASM); docs recommend `@rive-app/react-webgl2` (4.41.0, same peer range); `canvas-lite` is smaller | MIT runtimes; free exports show a Rive splash screen |

## Patterns selected for BriefRoom

1. **Spatial reference wall** (§3, §1): references as cards at different depths and rotations. The group tilts toward the pointer by at most ~6° at about 500 px perspective and springs back to flat on pointer leave. Build it with `useMotionValue` → `useSpring` → `useTransform` on one container; no WebGL.
2. **Staged entry** (§1 live intro, §3 intro): headline first, then chrome, then the spatial layer, over about 0.5–2 s. Lead with opacity so that `reducedMotion="user"` still shows everything.
3. **Pin callout with leader line** (§1 hover callouts): annotation pins open an uppercase label joined by a hairline on hover or keyboard focus. Use `AnimatePresence` for enter and exit.
4. **Fanned versions** (§1 helmet fan): stacked versions fan out on hover or focus in version comparison. Picking one moves it into the side-by-side view through `layoutId`.
5. **Chat card → canvas** (§6 `layoutId`): a reference card in chat expands into the reference canvas as a shared element. Use `layoutScroll` on the chat scroller and `mode="popLayout"` on message lists.
6. **Presence on the canvas** (§2 Bezel hero): coloured collaborator cursors and a selection outline on the reference being discussed.
7. **One idle loop at most** (§1 coin and helmet idle motion): a slow clarification-radar sweep while questions are open. Turn it off under `useReducedMotion()`.
8. **Dual approval → agreement** (§5): a two-stage seal driven by state (A approved → B approved → agreed). Use Motion keyframes by default. Rive's state machine is an option only if we accept `.riv` authoring and the splash screen on free exports.
9. **Scroll-linked only on marketing surfaces** (§1 fly-through, §6/§7): `useScroll({ target, offset: ["start end", "end start"] })` drives GPU-friendly props (opacity, transform, filter). No pinning or scroll-jacking in the working app, because §1 showed scroll being taken over (a 300 px wheel moved only 130 px).
10. **Global reduced-motion policy** (§6): `<MotionConfig reducedMotion="user">` at the root, plus a check with `prefers-reduced-motion` emulation. §1 had no readable reduced-motion rules.

**Not adopted, with reasons:**
- **Spline:** the WebGPU-only hero failed in headless, the runtime is 36.7 MB unpacked, and self-hosting is Enterprise-only.
- **GSAP:** it would be a second engine, although the licence is fine.
- **React Three Fiber:** a full WebGL scene is more than the reference canvas needs, and the `react <19.4` peer bound blocks the next React minor.
