# Concept — Mystical Blob 2D Platformer (Fairy Blob)

Personal game concept for a casual HTML5 release (Poki / CrazyGames).  
Platform notes (SDK, size limits, engines): see `poki.md`.

---

## One-liner

A glowing blue blob crawls and jumps across a small mystical field of leaves and ground, collecting fireflies (or similar). Short levels, cozy art, soft glow — not a heavy physics sandbox.

---

## Fantasy & Feel

- Theme: **magic / mystique** — soft night meadow, bioluminescence.
- Player: **blue glowing blob** — crawls on ground, crawls/jumps on leaves.
- Goal per level: **collect all target items** (e.g. fireflies).
- Field: **small** — readable at a glance; levels last from **~10 seconds to a few minutes**.
- Mood tools (no real Light2D):
  - slightly **dimmed** environment;
  - **semi-transparent glow** around blob and collectibles;
  - optional “dark” levels where mostly glows read against the dim field.

---

## Core Loop

1. Enter short level (small arena / meadow).
2. Move blob (crawl + jump) on ground and leaf platforms.
3. Collect all required items → win.
4. Optional: obstacles (spikes, insects) — in fuller scopes they also deal damage / block paths.
5. Next level; difficulty and decoration escalate slowly (many early levels are easy — Poki-typical).

---

## Modes (design vision)

| Mode | Idea |
|------|------|
| **Casual** | Chill collect; parameters at maximum comfort. **MVP starts here only.** |
| **Arcade** | Same levels + time limit / counter; more energetic music. |
| **Puzzle** | Parameters change as items are collected; **order matters** — not everything reachable at once. |
| **Survival** | Puzzle rules + **draining energy** restored only by collecting; hazards deal damage. |

Modes share the same world/tech; Casual → Arcade are cheap. Puzzle / Survival need extra rules and level design.

---

## Scope — Minimum (MVP)

**Ship / show / submit goal.**

| Include | Exclude |
|---------|---------|
| 1 player blob: move, jump, leaf/ground contact | Full rigid-body “toy physics” |
| Collect-all win condition | Puzzle sequencing |
| **~15–20** short levels (easy → mild medium) | 50 unique hard levels |
| **Casual mode only** | Arcade / Puzzle / Survival |
| Soft glow + slight dimming | Real lighting / shadows engine |
| Simple obstacles as blockers (optional, few levels) | Energy drain, damage systems |
| Static + light parallax backgrounds | Complex weather / day cycle |
| Touch + keyboard; **960×540** design, contain-scale + clip; **2×** art (`resolution: 2`); bg **2200×1200** → logical **1100×600** with bleed; parallax clamp (no tile) | Portrait / rotate-device UX (deferred; many Poki titles ship landscape-first) |
| Local progress save | Cloud saves / accounts |
| Basic SFX + 1 music track | Full adaptive soundtrack pack |

**Feel target:** one cozy evening session of short levels; enough for CrazyGames Basic / Poki pitch.

---

## Scope — Maximum (full vision)

| Include |
|---------|
| **~50** short levels (still mostly easy–medium; variety via decoration + mild obstacles) |
| All **4 modes** (Casual, Arcade, Puzzle, Survival) |
| Parameter / ability changes tied to collectibles (Puzzle+) |
| Energy drain + hazard damage (Survival) |
| More dark/glow-focused levels |
| Richer parallax set (sky, mountains, forest, clouds, near trees/bushes, water) |
| Upgrade/meta progression between levels (light) |
| Arcade timer + mode-specific audio |
| Poki + CrazyGames SDK adapters, thumbnails, polish pass |

**Not in vision (unless revisited):** 3D, multiplayer, procedural infinite runner, heavy narrative.

---

## Level & World Assumptions

- Duration: **~10 s – few minutes** per level.
- Space: **small field** — camera may barely scroll or gently follow; not open-world.
- Content reuse: many levels = **same mechanics, different layout + art dressing** (Poki-normal).
- Authoring: prefer **Tiled** maps (`.tmj`) so packing scenes stays visual, not hand-coded coordinates forever.

### Background layers (parallax)

| Layer | Motion | Examples |
|-------|--------|----------|
| Far static / near-static | 0 or tiny drift | Sky gradient, distant mountains, far forest silhouette |
| Mid slow | Parallax factor < 1 | Clouds drifting, distant canopy |
| Near mild | Stronger parallax / slow sway | Close trees, bushes, lake surface shimmer |
| Playfield | Camera follow | Ground, leaves, entities |
| FX / glow | Screen or world space | Blob/item aura (additive / alpha sprites) |

Parallax = **offset layers by camera × factor** (Tiled parallax props or manual). No need for a lighting engine.

---

## Rough Timelines

Assumes **one developer**, prior Pixi/TS experience, **simple physics** (no custom engine), glow-not-lights.  
**Part-time** ≈ 15–25 h/week · **Full-time** ≈ 35–40 h/week.

| Milestone | Part-time | Full-time |
|-----------|-----------|-----------|
| Playable prototype (1 level, feel OK) | 2–4 weeks | 1.5–3 weeks |
| **MVP** (15–20 levels, Casual only, parallax, glow, basic audio) | **2.5–4 months** | **1.5–2.5 months** |
| Arcade mode + polish on same levels | +2–4 weeks | +1–2 weeks |
| Expand to ~50 levels (content pipeline mature) | +1–2 months | +3–6 weeks |
| Puzzle + Survival + dark-level pass | +1.5–3 months | +1–2 months |
| **Maximum vision** (50 levels × 4 modes + store polish) | **~6–9 months** | **~5–7 months** |

**Fast honest path:** MVP with 20 Casual levels → soft launch / feedback → Arcade → later modes.

---

## Recommended PixiJS Stack

Keep the “mini-engine” thin: libraries for map + camera + physics; own code for blob feel and modes.

| Layer | Choice | Role |
|-------|--------|------|
| Language | **TypeScript** | Same as existing projects |
| Renderer | **Pixi.js v8** | Sprites, containers, filters (optional glow) |
| Bundler | **Vite** or Webpack | Prefer Vite for a new game (faster DX); Webpack fine if preferred |
| Level editor | **[Tiled](https://www.mapeditor.org/)** | Tile layers + object layers (collision, spawns, collectibles) |
| Map loader | **[pixi-tiledmap](https://www.npmjs.com/package/pixi-tiledmap)** (v2 / Pixi 8) | Load `.tmj` / `.tmx`, render tiles, parallax helpers |
| Camera | **[pixi-viewport](https://github.com/pixijs-userland/pixi-viewport)** *or* ~15-line follow | Center on blob, clamp to level bounds |
| Physics | **[Matter.js](https://brm.io/matter-js/)** *or* kinematic AABB + gravity | Static colliders from Tiled objects; blob as controlled body — **do not write a physics engine** |
| Animation / juice | **GSAP** (known) + simple sprite states | Jump squash, collect pop, leaf sway |
| Glow / mystique | Bright sprites + alpha / optional Pixi blur/glow filter | Dim world `ColorMatrix` or dark overlay — **no Light2D** |
| Audio | **@pixi/sound** or Howler | SFX + music; swap track for Arcade later |
| Input | Pointer + keyboard | Touch primary for Poki mobile |
| Persist | `localStorage` (try/catch for Incognito) | Level unlock / best time |
| Platform (later) | Thin adapters for **PokiSDK** / **CrazyGames.SDK** | Behind one `PlatformAds` / `PlatformLifecycle` interface |

### Optional later

| Piece | When |
|-------|------|
| **Rapier 2D** | Only if Matter feels weak with many bodies |
| Skeletal / mesh animation | **Not planned for MVP.** Prefer sprite sheets + manual Pixi `Mesh` deformation. If richer skeletons are ever needed later: **Spine** (paid editor, strong Pixi runtime), **DragonBones** (free/open tooling, thinner ecosystem), **Live2D Cubism** (character-focused, separate license), or stick to DIY mesh. Overkill for a simple blob ball in v1. |
| Phaser | Alternative if you want Arcade physics + scenes bundled — different project shape |

### Suggested runtime layout

```text
app.stage
├─ HUD / UI (fixed screen)
└─ Viewport (camera)
   └─ World
      ├─ BG far (sky, mountains)      parallax ~0–0.2
      ├─ BG mid (clouds, far trees)   parallax ~0.3–0.5
      ├─ BG near (bushes, lake)       parallax ~0.6–0.8
      ├─ Playfield (Tiled tiles)
      ├─ Entities (blob, fireflies, hazards)
      └─ Glow FX (additive sprites / filters)
```

Collision shapes and entity spawns come from Tiled **object layers**, not from guessing pixels.

---

## Explicit Non-Goals (MVP)

- Custom physics engine  
- Real dynamic lighting / normal maps  
- All four modes at once  
- 50 levels before first playable vertical slice  
- Godot feature-parity — use **Tiled + Matter + viewport** as the substitute toolkit  

---

## Success Criteria

**MVP done when:**

- [ ] Blob feel is fun for 5+ minutes straight  
- [ ] 15–20 levels completable on mobile + desktop  
- [ ] Collect-all loop clear without tutorial walls  
- [ ] Glow + dim + parallax sell the “mystic meadow” mood  
- [ ] Build size aimed at web portals (~Poki-friendly if possible)  
- [ ] Can demo in browser without apologizing for missing modes  

**Maximum done when:** all four modes feel distinct, ~50 levels shipped, portal SDK + store assets ready.

---

## Open Decisions

- [ ] Exact collectible fantasy (fireflies vs crystals vs dew)  
- [ ] Camera: hard follow vs soft lerp; how much scroll on tiny maps  
- [ ] Matter.js vs pure kinematic controller for leaf “stickiness”  
- [ ] Vite vs Webpack for greenfield repo  
- [ ] Launch target first: itch / CrazyGames Basic / Poki submission  

---

## Related Files

| File | Contents |
|------|----------|
| `poki.md` | Poki / CrazyGames technical notes, SDK, physics library overview |
| This file | Game concept, scope min/max, timelines, Pixi stack for *this* title |
