# Poki / CrazyGames — Notes for a Potential Casual Web Game

Personal notes from research (2026). Audience: future HTML5 casual game (≈ Poki-style — e.g. a character jumping on leaves / platforms). Not related to the slot-machine learning project; this file is meant to be moved to a general notes folder later.

---

## Product Idea Context

- Casual web game close to content on [Poki.com](https://poki.com/) (light platformer / physics feel).
- Similar games exist; unique design direction possible.
- Target platforms initially: **Poki**, optionally **CrazyGames**.
- **This repo (Fairy Blob):** Pixi.js v8 + TypeScript + Matter.js + Webpack 5 — see [`poki-2d-platformer-concept.md`](./poki-2d-platformer-concept.md) and [`../README.md`](../README.md).
- Alternatives still valid for other titles: Defold / Construct / Phaser.

---

## Poki — How They Accept Games

### Format

- **HTML5 / browser build only** (not APK, Steam, native exe).
- Typical package: `index.html` + JS/WASM + local assets (zip / upload folder).
- Runs in Poki iframe / game canvas.

### Submission path

1. Apply via [game submission form](https://sdk.poki.com/) (Poki for Developers is often **closed beta / invite**).
2. Hand-curated review (quality, player fit, tech/mobile optimization). They may not reply to every submission.
3. If accepted → access to **Poki for Developers**: upload versions, Inspector, preview.
4. Implement **mandatory requirements + Poki SDK**, then request review for launch.

Docs: [sdk.poki.com](https://sdk.poki.com/), [requirements](https://sdk.poki.com/requirements), [HTML5 SDK](https://sdk.poki.com/html5).

### What they look for

- **Quality** — UX/feel and core loop.
- **Player fit** — global casual audience.
- **Tech** — mobile + desktop web optimization, small downloads, solid performance.
- Cross-device (mobile + desktop) is strongly preferred.

### Hard technical requirements (summary)

| Topic | Requirement |
|-------|-------------|
| Devices | Must be playable on **mobile and tablet**; cover full screen in portrait and/or landscape |
| Aspect | **16:9**; scale to fill their game canvas. Reference sizes: **640×360**, **836×470**, **1031×580** |
| Size | Target **initial download ≤ ~5–8 MB** |
| External requests | **Blocked by default** — no Google Fonts, external CDNs, remote assets; everything in the build (exceptions: approved multiplayer / analytics + privacy statement) |
| Branding | No splash with outgoing links / third-party ads; logo OK on loading screen |
| Ads | **Only via Poki SDK** |
| Adblock | Game must remain playable with adblock (no “disable adblock” walls) |
| Incognito | Wrap `localStorage` in try/catch |

### Poki SDK (HTML5)

**No separate install package for HTML5.** Include CDN script:

```html
<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>
```

```javascript
PokiSDK.init()
  .then(() => { /* continue */ })
  .catch(() => { /* still load the game */ });

PokiSDK.gameLoadingFinished();
PokiSDK.gameplayStart();
PokiSDK.gameplayStop();

PokiSDK.commercialBreak(() => { /* mute / pause audio */ }).then(() => { /* resume */ });
PokiSDK.rewardedBreak({ size: 'medium' }).then((success) => { /* reward if success */ });
```

Also relevant: mute/disable keyboard during ads; prevent page scroll on Space/arrows; optional user accounts / cloud saves / shareable URLs — see [HTML5 docs](https://sdk.poki.com/html5).

Portal access (Inspector, uploads) is **after acceptance**; the SDK script itself is public for local integration.

### Engines Poki accepts

They explicitly work with many stacks: **Defold, PlayCanvas, Pixi, Three.js, Phaser, Construct, Godot, optimized Unity**, etc.

Guide: [developers.poki.com — web game engines](https://developers.poki.com/guide/web-game-engines).

Rough fit for lightweight 2D casual:

| Engine | Notes |
|--------|--------|
| **Defold** | Official Poki partner; ~1 MB empty; excellent mobile web |
| **Construct 3** | Very small export; many Poki casuals |
| **PixiJS / Phaser** | Listed; Pixi = render + DIY game systems |
| **Godot** | OK if web export is aggressively optimized |
| **Unity** | Allowed but web builds often heavy vs 8 MB goal |

For a leaf-jumper-style 2D game, prefer **Defold / Construct / Pixi / Phaser** over unoptimized Unity.

---

## Viewport / Aspect Ratio Approach

Runtime: [`src/world/game-view.ts`](../src/world/game-view.ts). Canvas fills the iframe; the **playfield** is contain-scaled and centered. No stage mask — backgrounds may draw into the letterbox. HUD chrome is the same scale as the world but origin'd at the canvas corner (iframe edges).

| Orientation | Playfield (camera / Matter) | Aspect |
|-------------|-----------------------------|--------|
| Landscape (`clientW ≥ clientH`) | **960×540** | 16:9 |
| Portrait (`clientH > clientW`) | **540×960** | 9:16 |

To pull the portrait camera back (more world in frame), multiply both 540 and 960 by the same factor in `game-view.ts`.

### Letterbox (not CSS black bars)

`scale = min(clientW / viewW, clientH / viewH)`. Empty iframe around the playfield is **logical pad** (same units as the camera). Fill it with background art, not `#222` forever. Renderer clear `#222` is only a fallback until textures cover the pad.

Pad budget **`VIEW_BLEED = 240`** logical px per edge covers:

- 21:9 phones vs 16:9 / 9:16 (~150 px)
- ~1:1 fold inners (~210 px)

### HUD

Buttons sit on the **iframe** (logical screen = playfield + pad), not on the 16:9/9:16 box. Modals dim the full iframe.

### Texture resolution (2× for Retina)

Gameplay uses logical pixels. Source art is **2×** (`data.resolution: 2`). Do **not** also `sprite.scale = 0.5`.

### Background placement (parallax)

Screen-space, not stretched, no clamp ([`ParallaxLayer`](../src/world/parallax-layer.ts)):

- Extra **width** is always split left/right of the playfield (`originX = (viewW − tileW) / 2`).
- **Sky** (`id: sky` or `parallax: 0`): **centered** on the playfield. A 1440×1440 plate is the union of 16:9 and 9:16 plus pad. A centered camera (blob in the middle of the screen) always sits on the same sky pixel; a blob on the **ground** sits lower on the sky in 9:16 than in 16:9 (taller view, same texture). That gradient shift is inherent unless sky is a flat color or we floor-align sky (then the ground is stable and high platforms drift instead).
- **Far / mid** (`parallax > 0`): **floor** — image bottom = playfield bottom (horizon). Extra height goes **up**. 16:9 ↔ 9:16 changes how far the horizon sits below screen center (270 vs 480), so a centered blob slides against these layers; that keeps the painted horizon on the playfield edge.
- Parallax: `offset = (levelH − cameraY − viewH) × p`. Camera clamps to the **playfield**, not the iframe.

Level JSON `backgrounds[]` is back→front. `id: sky` selects the center anchor.

### meadow-01 background sizes (1500×1500, p_sky=0, p_far=0.1, p_mid=0.3)

Current files @2 (`meadow-bg-*-blur*`): sky **960×540**, far **1015×519**, mid **1125×625** — landscape core only; portrait and iframe pads will show `#222` until re-exported.

**Letterbox plate** (must, both orientations, `VIEW_BLEED=240`):

A plate that covers both cores + 240 pad is **1440×1440** logical (**2880×2880** @2). Sky (`p = 0`) can be this square (or two files: landscape **1440×1020**, portrait **1020×1440**).

**Plus parallax travel** (so camera motion does not reveal the texture edge):

\[
W = \mathrm{core}W + 2(\mathrm{level}W - \mathrm{core}W)\,p + 2\times 240
\]
\[
H = \mathrm{core}H + (\mathrm{level}H - \mathrm{core}H)\,p + 2\times 240
\]

Take the **max** of landscape core 960×540 and portrait core 540×960:

| Layer | p | Logical W×H | File @2 |
|-------|---|-------------|---------|
| sky | 0 | **1440×1440** | 2880×2880 |
| far | 0.1 | **1548×1494** → round **1560×1500** | 3120×3000 |
| mid | 0.3 | **1764×1602** → round **1800×1620** | 3600×3240 |

The **painted** detail can stay in the 16:9 / 9:16 core; bleed may be simple sky/soil extension (no extra tufts). To avoid huge mid canvases, **lower `p`** instead of painting travel+bleed at full detail.

Optional ground-crop pad (~80 px of soil below the horizon) lives **inside** the bottom 240 bleed.

---

## CrazyGames — Differences vs Poki

Docs: [docs.crazygames.com](https://docs.crazygames.com/).

### Same in spirit

- HTML5 / WebGL in iframe.
- Engines: Unity, Defold, Godot, Phaser, PlayCanvas, Construct, **Pixi.js**, etc.
- CDN SDK script; gameplay start/stop + ads concepts.
- 16:9 contain scaling works well (desktop iframes are mostly 16:9).

### Meaningful differences

| Topic | Poki | CrazyGames |
|-------|------|------------|
| **Initial size** | ~**5–8 MB** (strict) | ≤ **50 MB** (≤ **20 MB** for mobile homepage); total up to **250 MB** |
| **Aspect** | **16:9 mandatory** | **16:9 strongly recommended**; **portrait OK** (side padding on desktop) |
| **Launch model** | Curated; SDK required for release | **Basic Launch** (SDK optional, no monetization) → **Full Launch** (SDK + ads required) |
| **SDK** | `PokiSDK` | `CrazyGames.SDK` v3 — **not interchangeable** |
| **External requests** | Blocked by default | Less size-hostile; still no third-party ads |
| **Docs / access** | Portal often invite/closed beta | More open developer docs + portal |

CrazyGames HTML5 SDK (v3):

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

Initialize before use (`await CrazyGames.SDK.init()` — check current docs). Events live under modules (`game.gameplayStart`, ads, user, data, etc.).

### Practical takeaway

- **One game architecture** (16:9 + contain + light web stack).
- **Two thin platform adapters** (Poki SDK vs CrazyGames SDK) — do not assume one script works on both.
- Poki = stricter weight + curation; CrazyGames = easier size budget + Basic Launch path.

---

## Physics Libraries (2D / 3D)

Pixi.js is a **renderer only** — no built-in physics. Sync every frame:

```text
physics.step(dt) → sprite.position / rotation = body transform
```

### 2D (relevant for leaf-jumper / platformer)

| Library | Notes | Good for |
|---------|--------|----------|
| **[Matter.js](https://brm.io/matter-js/)** | Easiest start, many examples | Prototypes, few bodies |
| **[Planck.js](https://piqnt.com/planck.js/)** | Box2D in JS | Classic 2D physics, no WASM |
| **[Rapier 2D](https://rapier.rs/)** `@dimforge/rapier2d` | Rust → WASM, fast, TypeScript | Heavier sims, modern choice |
| **box2d-wasm** | Box2D via WASM | Need Box2D specifically |
| **nape-js** | Fast JS niche option | Perf alternative to Matter |

Often for casual jump-on-platforms: **Matter**, or even **custom AABB + gravity + jump** without a full engine.

### 3D (many Poki titles — different stack)

Usually **not Pixi**:

| Stack | Physics |
|-------|---------|
| Three.js | Cannon-es, Ammo.js, Rapier 3D |
| PlayCanvas / Unity / Godot / Defold | Built-in |
| Babylon.js | Physics plugins |

Rapier 3D: `@dimforge/rapier3d`.

### Engines with physics built in

| Engine | Physics |
|--------|---------|
| **Phaser** | Arcade / Matter |
| **Defold** | Box2D / Bullet |
| **Godot** | Built-in 2D/3D |
| **Construct** | Built-in |

Pixi = draw yourself + pick physics package. Phaser/Defold = gameplay kit included.

### Recommendation for this idea

1. Prototype feel: **Matter.js + Pixi** (or custom collisions).
2. If many bodies / need stability: **Rapier 2D**.
3. Do **not** default to 3D physics for a 2D visual game — Poki 3D games use different engines.

---

## Suggested Tech Direction (Non-Binding)

| Layer | Suggestion |
|-------|------------|
| Render / game | Pixi.js + TS **or** Defold / Phaser if wanting editor + physics bundled |
| Design resolution | **960×540** landscape / **540×960** portrait, contain + unclipped bg bleed (`VIEW_BLEED` 240); **2×** art; HUD on iframe edges; far/mid **tune parallax** as well as bleed — see Viewport section |
| Physics | Matter (start) → Rapier if needed |
| Monetization | Thin adapter: `PokiSDK` / `CrazyGames.SDK` behind one interface |
| Bundle size | Design for **Poki’s ~8 MB** first — then CrazyGames is easy |

---

## Useful Links

- Poki SDK home: https://sdk.poki.com/
- Poki requirements: https://sdk.poki.com/requirements
- Poki HTML5 SDK: https://sdk.poki.com/html5
- Poki engines guide: https://developers.poki.com/guide/web-game-engines
- CrazyGames docs: https://docs.crazygames.com/
- CrazyGames technical requirements: https://docs.crazygames.com/requirements/technical/
- CrazyGames gameplay / iframe sizes: https://docs.crazygames.com/requirements/gameplay/
- Rapier: https://rapier.rs/
- Matter.js: https://brm.io/matter-js/

---

## Open Decisions (for later)

- [x] Stack for Fairy Blob → **Pixi DIY + Matter** (not Defold/Phaser)
- [x] Orientation for v1 → **landscape 16:9 + portrait 9:16** (contain playfield, bg in letterbox, HUD on iframe)
- [x] Physics for v1 → **Matter.js** (custom AABB only for death droplet FX)
- [x] UI hub + pause loop (menu carousel, Pause Home/Resume/Restart, platform session + commercialBreak on intent to play)
- [x] Level catalog + portal exit chain + GameProgress save (A2); level-clear modal (C)
- [x] Progress / Customize HudModals (stage D; OK dismiss) + skins catalog applied in-level
- [x] Portal unlock by firefly rim slots + door / vortex art (stage E #1). Blob fly-in animation deferred
- [x] Moving hazards (caterpillar / spider / mosquito) on fixed rails (stage E #3). Place on demo levels while authoring E4
- [x] Portrait / rotate playfield → **done** (540×960 camera, menu reflow, HUD on iframe). Remaining: re-export meadow bg plates to the bleed spec; pull-back zoom if 540-wide is too tight
- [x] Rewarded help → **stage F**; shape still open (flight vs teleport to portal)
- [x] Mobile background freeze: sync platform `hidden` on `pageshow` / `focus` / first pointer / Page Lifecycle freeze-resume, not only `visibilitychange`. Does **not** clear HUD Pause (`isPaused`)
- [ ] Target Poki first vs CrazyGames Basic Launch first
- [ ] Firefly economy beyond the portal gate (currency for skins?) — affects 100 % completion rewards

---

## Roadmap after stage D

### Stage E — playable demo (ship to itch, submit to Poki)

Ordered by dependency: anything that changes level rules lands before the levels are authored.

| # | Task | Depends on / notes |
|---|------|--------------------|
| 1 | Portal unlock by fireflies + door art | **Done.** Locked until `exit.slots` fireflies dock on the rim; door tweens out, vortex spins. Extra flies fade into the centre |
| 2 | Portal entry animation + SFX before the result modal | Enter SFX (`portal-enter`) is in. **Blob fly-in / suck-in animation deferred** — result modal still fires on overlap |
| 3 | Enemies: moving hazards (caterpillar / spider / mosquito), fixed paths | **Done (runtime).** Live in `hazards[]` (`from` / `to` centres + `speed`), not a separate `enemies[]`. Sensor kill volumes share the spike death path. Remaining: author onto the 10 demo levels |
| 4 | 10 levels, progressive difficulty | After 3. Authoring is **Ogmo 3** entity layers → runtime JSON (Y flipped on load). Meadow layouts in-repo; `meadow-13` has first authored `stone` / `branch`. Ogmo stone `width` → `size`; branch `rotation` is radians — see [`player-mechanics-backlog.md`](./player-mechanics-backlog.md) |
| 5 | Touch controls rework | **Done (playable).** Gesture-first; comfortable on phone after settle / flick-on-up / no false jump-run. Jump / crouch swipes; jump side-speed lasts until landing or cling. Horizontal swipe deferred until dash (then: on release + speed threshold, no run latch). Slow drag is live analog. Tap, 0.5 s hold, or any gameplay key cancels. Full jump height from 45° up; ~33° deadzone. Top HUD band (~72 px) **intentionally** ends the stroke (chrome / pause). Flick vs slow-swipe distances tuned. Remaining polish: [Touch follow-ups](#touch-follow-ups) |
| 6 | Hints for existing mechanics only | **Playback done** (move / jump / crouch / crouch-jump). Remaining: place posters while authoring levels. Plan: [`e6-level-hints.md`](./e6-level-hints.md) |
| 7 | Demo outro screen after the last level | **Done (UI).** Same result modal in `demoComplete` mode: title "Demo complete!" + "Thanks for playing!", last-run stats, Home + Restart (no Play). **Todo later:** celebratory music/SFX + VFX (sparks, glowing pollen, happy blob, fairies — TBD) |
| 8 | Poki submission prerequisites | `gameLoadingFinished`, no external links, incognito / no-`localStorage` path, first-download size, 60 FPS on mid-range mobile |

### Touch follow-ups (E5 polish, not blockers)

Playable as-is; leftover event / edge-case holes:

1. **`pointerup` capture race.** Window `pointerup` (capture) runs before Pixi, so `finishStroke` often never sees the up position. A down→up flick with no `pointermove` can still drop. Make the window listener bubble-only fallback, or drop it.
2. **`touchend` id mismatch.** `Touch.identifier` is compared to `pointerId`; on some Android they differ, so this backup path is dead.
3. **`pointercancel` vs `touchcancel`.** Pointer cancel may commit the swipe; touch cancel aborts. Align them.
4. **End-pause flick.** A flick that sits still ~40 ms before lift can be classified as a fat-finger tap.
5. **Pause / blur.** The layer stays live; a jump already committed can fire after returning to the tab. Clear or freeze gestures on pause and `visibilitychange` / `blur`.
6. **Failed takeoff.** If a committed jump never leaves the ground (ceiling), `jumpCommitted` can leave a ground run. Clear the latch if still grounded after wind-up.

Second finger is ignored on purpose (one-gesture control). Dead `isPrimary` branch in `onPointerDown` can go when #1/#2 are cleaned up.

Balancing note: gating design is still open. Flight may replace a plain double jump as the unlockable move, with the remaining mechanics available from the start.

Suggested support work for balancing 10 levels: lightweight local telemetry (per-level time, deaths, fireflies collected) — tuning ten levels by feel alone is guesswork.

### Stage F — content & feature depth (after publishing approval)

- Re-export meadow sky/far/mid to the bleed spec (see Viewport); optional portrait camera pull-back
- Finish player mechanics — mainly animations and VFX for them
- Finish locations and levels, including enemy art and level design
- Rewarded help: flight or teleport to the portal
- More characters
- Asset optimization (atlases, audio, first-download size)
- Sound design and music pass
- More skins
- Skin (or other) unlocks for full completion and 100 % collection

### Stage G — final polish before portal tests

- `movePill` placement so the Poki pill never overlaps our HUD
- Safe areas / portal chrome adaptation
- Whatever the platform test round turns up