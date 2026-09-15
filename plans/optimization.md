# Runtime optimization — agreed scope

**Status:** backlog after the 2026-09 Firefox FPS discussion. Not a performance crisis.  
**Related:** [`poki.md`](./poki.md) (download budget, 2× art), [`player-mechanics-backlog.md`](./player-mechanics-backlog.md) (platform / spike / obstacle *look* is ship, not a placeholder), [`e6-level-hints.md`](./e6-level-hints.md) (poster look and loop rules).

Do not treat this file as a licence to simplify gameplay, swap background art, or replace GSAP timelines with hand-rolled tweens.

---

## Diagnosis (keep this when revisiting)

The game is already light. Evidence:

- Itch production build on a **Samsung Galaxy M20 (2019)** in Chrome: visually stable ~60 fps, while the Android chrome itself stutters.
- Desktop **Chrome** (PC and phone) is fine.
- Download is ~5 MB; that is **not** the same as GPU cost, but the M20 result still means the scene is cheap.

**Firefox** stuttering on an i5 / 16 GB / **GTX 1660 Super** (Linux + NVIDIA in particular) is a browser / compositor / WebGL-path problem, not “too many colourful sprites”. Do not gut the platformer to please that outlier.

Measure **production** (`npm run build` / itch zip), not `npm start`. Webpack `inline-source-map` + HMR is much more expensive in Firefox than in Chrome.

---

## Do

### 1. Bake static `Graphics` to textures / sprites (main item)

**Done (2026-09-15):** platforms, spikes, stones, branches via `cacheAsTexture`. Branches are baked as an axis-aligned round-rect (angle 0); Matter rotation lives on the display container only.

Platforms, spikes, stones and branches are live Pixi `Graphics` (`fill` + `stroke`, often translucent). They are **not** rebuilt every frame (retained mode), but each one is still a tessellated fill+stroke mesh submitted every draw. A cached texture is two triangles and batches.

**Preserve the ship look.** Translucent rounded plates, outlines, spike saws, opaque stone/branch fills — same as today. This is not a style pass and not “replace vectors with painted tiles”.

| Source | Files | Note |
|--------|--------|------|
| Platforms `ground` / `wall` / `leaf` / `sticky` | [`src/physics/static-body.ts`](../src/physics/static-body.ts) | Fully static. Alpha ~0.6–0.8 and corner radius **8** stay. |
| Spikes | [`src/entities/hazard.ts`](../src/entities/hazard.ts), [`src/entities/spike-outline.ts`](../src/entities/spike-outline.ts) | Bake the generated polygon; killbox / inset unchanged. |
| Stone | [`src/entities/obstacle.ts`](../src/entities/obstacle.ts) | Bake. Circle outline is isotropic — Matter spin does not smear a ring the way it smears a long stroke. |
| Branch | [`src/entities/obstacle.ts`](../src/entities/obstacle.ts) | Bake the **axis-aligned** round-rect only (local angle 0). Spawn / Matter `angle` is applied on the display container in `syncFromBody`, never into the raster — otherwise long edges become a staircase. |

Suggested Pixi v8 approach: build the `Graphics` once, `cacheAsTexture()` (see [`src/components/bake-static-graphics.ts`](../src/components/bake-static-graphics.ts)). Destroy with `children: true` so the cached render-group texture returns to the pool (`PhysicsBody.destroy`).

Do **not** bake things that must change geometry every frame (spider web). The hint swipe trail is item 5, not a `cacheAsTexture` candidate.

### 2. One animation clock (keep GSAP)

**Done (2026-09-15):** GSAP is advanced from Pixi `app.ticker` via `gsap.ticker.tick()` (`bindGsapToPixiTicker` in [`src/index.ts`](../src/index.ts)). Own RAF is killed once (`sleep`) and kept off by no-op `wake` (tweens would otherwise restart it). `lagSmoothing(0)` on. Platform resume no longer calls `gsap.ticker.wake()`.

GSAP stays. All existing tweens / timelines stay.

Today Pixi `app.ticker` and `gsap.ticker` are two `requestAnimationFrame` loops. Drive GSAP from the Pixi ticker and do not let GSAP run its own RAF. `tick()` (not bare `updateRoot`) keeps `gsap.ticker.add` listeners alive — hint trail redraw in `LevelHint` depends on that.

Pause behaviour must keep working: platform ads already pause `gsap.globalTimeline`; user-pause currently leaves hint / portal GSAP running — do not “fix” that here ([`e6-level-hints.md`](./e6-level-hints.md)). The GSAP Pixi callback must **not** early-return on `isGamePaused()` (HUD / modal tweens need the clock).

### 3. Renderer init flags (no visual change)

In [`src/index.ts`](../src/index.ts) `app.init`:

- `preference: 'webgl'` — do not let Pixi pick WebGPU on Firefox.
- `powerPreference: 'high-performance'` — prefer the discrete GPU when the OS offers one.

Keep `antialias: false`. Do **not** cap `devicePixelRatio` in this pass (sharpness is part of the look; Chrome on M20 already holds 60 uncapped).

### 4. Hint poster blink on loop restart

The whole control tile — including the **50% plate** — sometimes flashes for a frame when the gesture loop wraps. Seen on **desktop Chrome**, so this is a real bug, not a Firefox fillrate issue.

Trace how the poster is built and how `repeat: -1` restarts:

- Construction in [`src/entities/hints/level-hint.ts`](../src/entities/hints/level-hint.ts): plate `Graphics`, stencil `maskGfx` (kept in the display list on purpose — `renderable=false` made Pixi v8 clip everything), masked content, touch vs keyboard layers.
- Touch loops in `move` / `run` / `jump` / `crouch` / `crouch-jump`: `gsap.timeline({ repeat: -1, onRepeat })` resets the trail on wrap (`resetTrail()` → `Graphics.clear()`), then the timeline `set`s hand/contact alpha and tip pose again.
- Keyboard loop (`playKeyboardCycle`) `set`s cluster `alpha: 0` at the start of each repeat. That should not touch the plate — if the plate still blinks in keyboard mode, the cause is the poster root / mask, not the keys.

Likely suspects (confirm, do not shotgun): a one-frame stencil miss when the mask or trail geometry is rebuilt; GSAP `onRepeat` racing the first `set` of the next cycle; accidentally tweening the `LevelHint` container (plate is a child); `Graphics.clear()` hitch that flashes the translucent plate.

Fix the restart so the plate never drops out. Do not hide the blink by fading the whole poster. Ship look stays ([`e6-level-hints.md`](./e6-level-hints.md)): 50% rounded plate, content clipped to it, looping forever.

### 5. Hint swipe trail — continuous line, no live primitives

[`src/entities/hints/touch-pointer.ts`](../src/entities/hints/touch-pointer.ts) `SwipeTrail` is a `Graphics` rebuilt **every GSAP ticker frame**: `filter` points, `clear()`, then a new `stroke()` + `circle()` **per sample**. That is create/destroy of GPU geometry on the fly, and it is a prime suspect for item 4’s flash (`onRepeat` → `resetTrail()`).

- Check init and sampling: `setSamplingTrail`, `sampleTrail` (skip if under 1 px), `HINT_TRAIL_LIFETIME_SEC`, `gsap.ticker.add` in `LevelHint`.
- Prefer **one continuous ribbon** (single polyline / mesh) whose tail fades, not N independent segments. Reuse the same object; do not `clear()` into an empty graph every frame if the path can be updated in place.
- Keep the comet look: `#bfbfbf`, current `HINT_TRAIL_WIDTH`, round caps, tail dies first. Hand + contact sprites stay as they are.

---

## Do not

These were discussed and rejected as not worth the game:

| Idea | Why not |
|------|---------|
| Replace / shrink meadow sky / far / mid textures, or swap sky for a gradient | Art *is* the game. Sky `.webp` is small because gradients compress; VRAM size is irrelevant on a 1660 Super and on the M20 result. |
| Rewrite spider web (`Graphics.clear` + stroke each frame) as a scaled strip | One line. Not the bottleneck. Leave it. |
| Replace GSAP with manual animation | Out of scope. Item 2 only unifies the clock. |
| Cap resolution / DPR, debounce `visualViewport` resize, reuse Matter side-probe, drop ColorMatrix hover | Invisible micro-opts. Not needed while Chrome on a 2019 phone is already smooth. Revisit only with a new, measured target (e.g. a specific low-end Firefox device). |
| `cullable`, lazy-load unused skins, strip `autoGenerateMipmaps`, delete unused `pixi-filters` | Nice hygiene, not FPS. Separate chores if ever touched. |

---

## Hand-check after item 1

- Platform fill + outline + alpha match the current Graphics look (especially `sticky` 0.6).
- Spikes still align with the inset killbox; `facing` / `length` still author correctly.
- Stones roll without a mushy ring. Branches: baked at 0°, then rotated — long edges must not look stair-stepped at spawn.
- Scene destroy does not leak GPU textures (level restart / menu round-trip).
- Spider web, portal, droplets, firefly `ParticleContainer` — untouched. Hint posters are items 4–5.

## Hand-check after item 2

- Menu / Pause / Result: Play–Continue idle bounce and button hover/press/tap still animate while the scene is paused.
- Fade between scenes still completes; carousel snap / lock shake still feel the same.
- Hint posters and portal door/vortex keep looping during user Pause; freeze during platform ad / tab hidden; resume after ad without needing a second GSAP RAF.
- No obvious “double speed” after a hitch (lagSmoothing off).

## Hand-check after items 4–5

- Loop wrap on every shipped `kind` (touch and keyboard): plate alpha stays put; no one-frame flash of the whole tile.
- Input-mode swap (keyboard ↔ touch) still kills the old timeline and does not leave a stuck trail or a blank plate.
- Trail is a fading comet during the swipe and is gone during `HINT_CYCLE_PAUSE_SEC`; it does not leak outside the rounded plate.
- Pause modal: hint GSAP still runs (same as portal); ads still freeze it.
