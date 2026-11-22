# BriefRoom motion design

*2026-11-22 · motion language for BriefRoom 2.0. Research: [MOTION_RESEARCH.md](MOTION_RESEARCH.md) · concepts and recommendation: [MOTION_CONCEPTS.md](MOTION_CONCEPTS.md) · live previews: `/motion-lab`.*

## 1. Idea

**Spatial BriefRoom: the product unfolds in space.** A reference becomes a discussion, the discussion becomes a decision, and the decision becomes an agreement. Motion shows that progression and nothing else. Every animated element is a real piece of the product: the reference canvas, annotation pins, conversation, Clarification Radar, specification, version diff, approvals and agreement. There are no abstract shapes.

The visual identity is unchanged ([design.md](../design.md)): near-black or warm-paper surfaces, the white editorial serif, and the **yellow highlighter**, which becomes the signature motion. Light and Dark themes use the same choreography.

## 2. Technology decision

| Option | Decision | Why |
|---|---|---|
| **Motion for React** (`motion` 14, already installed) | **Use** | Springs, gestures, `layoutId` shared elements, `AnimatePresence`, `useScroll`/`useTransform`, `MotionConfig reducedMotion`. Peer range `react ^18 \|\| ^19`. Adds no bytes. |
| **CSS 3D transforms** (one `perspective` root, `preserve-3d` groups, `translateZ` per layer) | **Use** for depth | The floating panels are real UI, so DOM text stays crisp, selectable, translatable and accessible. The research found Shopify Editions builds its floating cards the same way: DOM with CSS 3D (`matrix3d`, `perspective` ≈ 1389 px), with WebGL only for the product scene. No WebGL, so no context loss, GPU blocklist or fallback problems. |
| React Three Fiber + three | Not now | A WebGL scene would render text as textures or as DOM overlays (which is CSS 3D again). Its peer range `react >=19 <19.4` would also block the next React minor. Reconsider only for a non-UI 3D object. |
| GSAP ScrollTrigger | Not used | It would be a second animation engine on the same elements. `useScroll` covers the progress-driven story without pinning or scroll-jacking. The licence was fine. |
| Spline | Not used | The hero required WebGPU in testing, the runtime is 36.7 MB unpacked, self-hosting is Enterprise-only, and free exports carry a watermark. |
| Rive | Not used | Needs `.riv` authoring, and free exports show a splash screen. Motion keyframes cover the approval seal. |

**Cost of the previews:** concept chunks are 3.4–5.1 KB gzipped, plus 6.4 KB for the lab page shell. All are lazy-loaded, so they add nothing to other routes.

## 3. Motion tokens

| Token | Value | Use |
|---|---|---|
| `settle` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances: quick start, long soft landing |
| `glide` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving between two resting states (focus, tabs, layout) |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | Leaving: short and out of the way |
| micro | 120–180 ms | Hover, press, small state flips |
| UI | 260–350 ms | Tabs, panels, list moves |
| entrance | 600–900 ms | Page and section reveals |
| story | 0.9–1.25 s | Spatial assembly, scroll-story steps |
| stagger | 60 ms (words) · 120–150 ms (layers, pins) · 160 ms (diff rows) | Sequence without waiting |
| cursor spring | stiffness 70 · damping 20 · mass 1.1 | Heavy lean, no wobble |
| pop spring | stiffness 420 · damping 26 | Pins, counters, seals (no visible overshoot loops) |
| max tilt | ±6° X · ±8° Y on top of a resting tilt of 12° X / −15° Y / 3° Z | Legible at every angle |
| perspective | 1900 px desktop · 1300 px phone | Natural depth, not fish-eye |
| depth scale | plate −50 · canvas 0 · pins +22…+64 · version +50 · spec +70 · chat +95 · radar +140 · agreement +165 (px) | Nearer means later in the story |
| depth shadow | `y = 8 + 0.16z`, `blur = 22 + 0.42z`, `alpha = 0.18 + z/600` | Depth without blur filters |

## 4. The highlighter as motion

The yellow stroke **wipes in left to right** (`background-size` 0 → 100%, `settle`, 0.6–0.9 s) and wraps across lines with `box-decoration-break: clone`. It always marks *the thing that matters now*:

- the headline phrase ("without the guesswork.")
- the current step of a story
- each changed value in a version diff, in sequence
- the agreement fingerprint
- the active item in a list

There are two tones:
- **brand:** the hero's stroke across the lower half of the letters, for display text only.
- **mark:** a soft full-height marker (`color-mix(accent 40%)`) for small text, so white text in Dark and ink in Light both keep their contrast.

## 5. Choreography patterns

1. **Assemble in depth.** Layers start 280 px behind their place and 40 px low, then settle forward in story order: canvas → pins → conversation → radar → specification → version → agreement.
2. **Lean, don't spin.** Only a mouse moves the whole composition, through the cursor spring, and it returns to rest on leave. Touch and reduced motion get the resting composition, which is designed to look finished when still.
3. **Focus.** Selecting a region zooms the photo toward it (×1.55, clamped so the image never leaves its frame). A cut-out spotlight glides to the region, and the pins counter-scale (1/zoom), so their size and coordinates stay true.
4. **Emerge.** Messages of a thread arrive 0.22–0.35 s apart (rise 10 px, scale 0.97 → 1).
5. **Glide between groups.** A resolved clarification moves from "Needs clarification" to "Resolved" with a shared `layoutId`. Counts roll; badges bump once.
6. **Recede.** When a newer card takes the stage, older ones step back (scale 0.94, opacity 0.45) instead of disappearing.
7. **Converge.** Each approval sweeps in from its own side: buyer from the left, seller from the right. Only after both are confirmed do the two chips slide together into "Order agreed", followed by the fingerprint wipe. It is a seal, not confetti.
8. **One idle loop.** At most one ambient behaviour per view, only while on screen. In the hero, focus cycles through the annotations every 4.2 s and three panels drift by 3–5 px over 9–12 s.

## 6. Rules

- **Animate transform and opacity.** There are two deliberate exceptions, each on a single element: the highlighter's `background-size`, and the spotlight's geometry.
- **No scroll hijacking.** Scroll progress may *choose* a state; it never moves content against the wheel. There is no snapping and no pinning library.
- **Pause off-screen.** Loops run only while `useInView` reports the stage visible.
- **Reduced motion.** `<MotionConfig reducedMotion="user">` turns off transform and layout animation and keeps opacity. Components also check `useReducedMotion()` to skip loops, the lean and keyframe emphasis. State is always shown immediately.
- **Interaction first.** Animations never block input. Every control is a real button with a visible focus ring. Esc clears focus. State changes are announced through `aria-live`.
- **The workspace stays efficient.** Spatial depth and the lean belong to marketing surfaces. The app uses the same tokens at UI speed, with no 3D and no ambient loops.
- **Print stays clean.** Animation-only elements are never part of the work order's print output.
- **Theme-agnostic.** All colours come from tokens, so Light and Dark animate identically.

## 7. Rollout plan (after a concept is chosen)

| Surface | Motion |
|---|---|
| Landing hero | Concept A: staged copy, highlighter wipe, spatial composition, lean, one idle loop, approvals converge once |
| Landing story | A compressed Concept B (4–5 steps, `useScroll` state, no pinning), or keep the existing static sections with scroll reveals |
| Dashboard | Order cards enter with a 40 ms stagger; status badges cross-fade; counts roll; panels open with `settle` |
| Workspace | Canvas appears with a short scale and fade; pins pop at their real coordinates; selection focuses with the spotlight (zoom optional); tabs slide in the direction of travel; panels resize through `layout` |
| Conversation | Messages emerge; activity cards expand; connection states animate; new events don't shift the list (`popLayout`) |
| Clarification Radar | Open items get a subtle emphasis; resolved items glide into Resolved; counts roll |
| Versions | Before/after cross-fades; diff values highlighted in sequence; price change emphasised once |
| Approvals | Distinct buyer and seller animations; converge only on the backend's confirmed state; fingerprint wipe |
| Work order | Paper settles in (opacity and 8 px rise); print CSS untouched |
