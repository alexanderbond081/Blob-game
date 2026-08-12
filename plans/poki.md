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

### Pattern (proven in slot project)

Fixed **design resolution** + **contain / letterbox** scale:

```javascript
const scale = Math.min(clientWidth / gameWidth, clientHeight / gameHeight);
stage.scale.set(scale);
stage.x = (clientWidth - gameWidth * scale) * 0.5;
stage.y = (clientHeight - gameHeight * scale) * 0.5;
```

### For Poki / this project

- Design size: **960×540** (16:9).
- Scale with **contain** (`Math.min`) so the stage fills whatever window/iframe the portal provides.
- Inside a 16:9 Poki iframe, contain scale fills the canvas with **no bars**.
- Prefer **contain** over **cover** (`Math.max` + crop) unless intentional.
- **Clip** all game content to the 960×540 design rect (mask on the view root) so overflow outside the letterboxed stage is never visible — easier to tell scene bugs from “drawing past the frame”.

### Art / texture resolution (2× for Retina)

Gameplay and layout use **logical** design pixels (960×540). Source art is authored at **2×** so it stays sharp on high-DPI phones / Full HD iframes.

| Asset | Source file (2×) | Logical size (1×) | How |
|-------|------------------|-------------------|-----|
| Static **sky** (landscape) | often **1920×1080** (exact cover) or **1920×1280** (3:2 mild spare) | **960×540** or **960×640** | Manifest `data.resolution: 2` |
| Parallax **far / mid** | size to taste; prefer tuning `parallax` over huge bleed canvases | usually ≈ viewport or slightly larger | Same `resolution` hook |
| Other sprites / UI (typical) | 2× the on-screen size | on-screen size | Same: `resolution: 2`, or spritesheet `meta.scale` |

- In Pixi, **`resolution: 2`** on the asset means `texture.width` / `height` are already logical (half of the file pixels). Do **not** also apply `sprite.scale = 0.5` on those assets — that would be 0.25×.
- Equivalent idea to “scale 0.5”, but the correct Pixi hook for textures is **`resolution`**, not a hardcoded sprite scale in every consumer.

### Background placement (parallax)

Background is **not** stretched to the level size and **does not tile**. It sits in **screen space** ([`ParallaxLayer`](../src/world/parallax-layer.ts)):

- Logical size = file pixels / manifest `resolution` (sprite is not scaled in code).
- **Anchor:** when the camera is on the level floor (`cameraY = levelHeight − 540`) and `cameraX = 0`, the layer is **horizontally centered** and its **bottom** matches the viewport bottom
- Parallax: `offset = (camera − anchor) × factor` on X/Y. **No edge clamp** — if travel × factor exceeds texture oversize, the image edge can enter the frame.
- Level JSON: `backgrounds` is an **array** (back→front). Optional `id` (`sky` / `far` / `mid` / …) is designer markup only.

### Background art strategy (landscape now, portrait later)

Painful lesson: painted mid/far layers (grass tufts, props, etc.) are **expensive to author**. Do **not** rely on large spare bleed margins as the default way to hide parallax edges.

**Preferred approach**

1. **Gameplay / platforms first** — colliders and layout do not depend on bg cover; orientation must not break platform geometry.
2. **Sky (static, `parallax: 0`)**
   - Landscape: can be exact **960×540** logical (e.g. 1920×1080 @ 2) — fills the design rect; will not show edges while `p = 0`.
   - Portrait (when we build it): use a **separate sky texture**. It does **not** need to match the landscape sky logically (mood plate, not a shared world slice). Optional later: `texturePortrait` / portrait backgrounds array.
3. **Far / mid (and any moving layers)**
   - **Primary control: lower `parallax`** in the level JSON so `(levelSize − viewport) × p` stays within whatever oversize the art already has.
   - Small oversize is fine if it falls out of the paint naturally; **avoid** rebuilding huge bleed canvases just to support a high `p`.
   - Zooming the whole game to “cover” a tall phone makes the **playable width** much narrower (~540–640 instead of 960) — that is a playability problem, not solved by fatter sky art. Portrait play may stay landscape-only + rotate hint, or get a dedicated UI/camera layout later.

**Rejected as default:** mandating **1100×600** / large universal bleed for every parallax layer; mandating square skies only to serve portrait without a second asset.

### Mobile / orientation (deferred)

Landscape-only 16:9 on a portrait phone → large letterboxing. Options later:

- Landscape-only + “rotate device” hint (likely for v1 gameplay), or
- Separate portrait layout + **separate sky** + retuned far/mid `parallax` (see strategy above).

**Current decision:** landscape-first only; portrait UX in **stage F**, i.e. after the demo is submitted. Many Poki games ship horizontal; still verify portal requirements before submit so a publisher agreement is not accidentally violated.

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
| Design resolution | **960×540** (16:9) + contain scale + clip; **2×** art via `resolution: 2`; bg: exact/static sky OK; far/mid **tune parallax** over large bleed; portrait → **separate sky** (see Background art strategy) |
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
- [x] Orientation for v1 → **landscape-first** (portrait UX deferred)
- [x] Physics for v1 → **Matter.js** (custom AABB only for death droplet FX)
- [x] UI hub + pause loop (menu carousel, Pause Home/Resume/Restart, platform session + commercialBreak on intent to play)
- [x] Level catalog + portal exit chain + GameProgress save (A2); level-clear modal (C)
- [x] Progress / Customize HudModals (stage D; OK dismiss) + skins catalog applied in-level
- [x] Portrait / rotate support → **stage F** (Poki accepts landscape-only; camera + HUD + hub modals rework is too costly for the demo)
- [x] Rewarded help → **stage F**; shape still open (flight vs teleport to portal)
- [ ] Target Poki first vs CrazyGames Basic Launch first
- [ ] Firefly economy beyond the portal gate (currency for skins?) — affects 100 % completion rewards

---

## Roadmap after stage D

### Stage E — playable demo (ship to itch, submit to Poki)

Ordered by dependency: anything that changes level rules lands before the levels are authored.

| # | Task | Depends on / notes |
|---|------|--------------------|
| 1 | Portal unlock by fireflies + door art | Gate rule is part of every level's design |
| 2 | Portal entry animation + SFX before the result modal | Independent, can run in parallel |
| 3 | Enemies: moving hazards (beetle / spider / wasp), fixed paths | New `enemies[]`-style schema entry; blocks level authoring |
| 4 | 10 levels, progressive difficulty | After 1 and 3 |
| 5 | Touch controls rework | Current invisible 9-slice pad is a stopgap and not playable enough. Gesture-first, no on-screen buttons. Likely shape: thumbstick spawned under the finger + tap-to-jump zone; pure swipes read badly with wall cling |
| 6 | Hints for existing mechanics only | After the mechanic set is frozen |
| 7 | Demo outro screen after the last level | "Thanks for playing the demo, wishlist the full version…" |
| 8 | Poki submission prerequisites | `gameLoadingFinished`, no external links, incognito / no-`localStorage` path, first-download size, 60 FPS on mid-range mobile |

Balancing note: gating design is still open. Flight may replace a plain double jump as the unlockable move, with the remaining mechanics available from the start.

Suggested support work for balancing 10 levels: lightweight local telemetry (per-level time, deaths, fireflies collected) — tuning ten levels by feel alone is guesswork.

### Stage F — content & feature depth (after publishing approval)

- Portrait / rotate support (moved out of the demo)
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