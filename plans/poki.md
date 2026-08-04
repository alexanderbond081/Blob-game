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
| Full-bleed / parallax **background** | **2200×1200** | **1100×600** | Manifest `data.resolution: 2` |
| Other sprites / UI (typical) | 2× the on-screen size | on-screen size | Same: `resolution: 2`, or spritesheet `meta.scale` |

- In Pixi, **`resolution: 2`** on the asset means `texture.width` / `height` are already logical (half of the file pixels). Do **not** also apply `sprite.scale = 0.5` on those assets — that would be 0.25×.
- Equivalent idea to “scale 0.5”, but the correct Pixi hook for textures is **`resolution`**, not a hardcoded sprite scale in every consumer.

### Background placement (bleed + parallax)

Background is **not** stretched to the full level length and **does not tile**. Place it on the **viewport**:

- Logical **1100×600** centered on **960×540** → about **70px** bleed left/right and **30px** top/bottom.
- With a perfect 16:9 frame, bleed sits outside the clip and is hidden.
- If the host iframe aspect shifts slightly, those margins can show instead of empty bars (when resize strategy allows).
- Parallax uses the **same factor on X and Y**. Shift is **clamped to the bleed**: the layer moves with the camera, then **stops at the edges** so the texture always covers the viewport (no cropped sides / empty gaps).
- **Far** layer: nearly fixed; small parallax within bleed.
- **Mid** layer (clouds, trees, props): can drift (e.g. downward as the player climbs); still no tiling — travel limited by bleed; art/layout beyond that is the designer’s job.
- Travel budget ≈ `bleed / parallax` in camera pixels. Example: 70px horizontal bleed at `parallax: 0.1` → ~700px of camera scroll before the bg freezes. Longer levels simply leave the far/mid layers parked at the clamp.

### Mobile / orientation (deferred)

Landscape-only 16:9 on a portrait phone → large letterboxing. Options later:

- Landscape-only + “rotate device” hint, or
- Separate portrait layout.

**Current decision:** landscape-first only; portrait UX later. Many Poki games ship horizontal; still verify portal requirements before submit so a publisher agreement is not accidentally violated.

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
| Design resolution | **960×540** (16:9) + contain scale + clip to design rect; **2×** art via `resolution: 2` (bg **2200×1200** → logical **1100×600** with bleed; parallax clamp, no tile) |
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
- [ ] Target Poki first vs CrazyGames Basic Launch first
- [ ] Level catalog + win / next-level flow (portal threshold → next scene)
