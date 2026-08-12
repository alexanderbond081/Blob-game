# Fairy Blob

Casual HTML5 platformer: a glowing blob jumps across leaves and collects fireflies. Short Poki-style levels, landscape **960×540**.

**Status:** playable vertical slice / portfolio prototype — main menu with level carousel, one JSON level, sticky walls, hazards/death, crouch/hide, collectibles, pause → Home / Resume / Restart. Not yet submitted to portals.

Built with **Pixi.js v8**, **Matter.js**, **TypeScript**, **Webpack 5**.

## Play locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

### Controls

| Action | Keyboard | Touch / UI |
|--------|----------|------------|
| Move | `A` / `D` or ← → | Bottom-left / bottom-right of invisible 9-slice pad |
| Jump | `Space` / `W` / ↑ | Mid-left / mid-right (also moves) |
| Crouch / hide | `S` / ↓ | Bottom-center of 9-slice pad |
| Pause | `Esc` | Pause button (gameplay HUD, right cluster) |
| Resume / Home / Restart | `Esc` resumes | Pause modal buttons |
| Fullscreen | `F` | Top-left HUD button (hidden on Poki builds) |
| Mute SFX | — | Top-right sound button |
| Mute music | — | Top-right music button |

Stuck keys / touch after OS UI (notification shade, tab blur) are cleared on focus loss.

## What’s in this build

- Main menu hub: background, level carousel, Play, Progress / Customize modals
- Progress modal: episode summaries (completion % + fireflies) on a fixed grid
- Customize modal: skin grid, lock feedback, selection saved; applied on next level start
- Pause modal (gameplay): Home → menu (no ad break); Resume / Restart → `commercialBreak` when an ad actually starts, then gameplay
- Matter.js physics, walkable ground detection (slopes-ready normals)
- Camera follow + clamp, dual parallax backgrounds
- Blob player: run / jump / crouch wind-up, jelly squash, facing + hang sprites; colored skins via `skins-catalog`
- **Sticky walls** (`label: "sticky-wall"`): air cling, slow slide, peel-off stretch, wall-jump
- **Hazards** (`hazards[]`, e.g. `type: "spikes"`): solid kill volumes
- **Death:** shared kill path (hazard / fall) → optional `burst` anim → droplet splash → pause → respawn (empty burst frame OK; no forced hide of last frame)
- **Crouch / hide:** hold ↓ / `S` / bottom-center; blend-in squat + alpha; collider half-height; release → micro-hop; jump from crouch skips squat wind-up
- Fireflies: bob animation, pickup SFX, respawn after a few seconds
- Top icon HUD: fullscreen (non-Poki), pause (gameplay), separate music / SFX mute
- Platform SDK bridge: `gameLoadingFinished`, `gameplayStart` / `Stop`, `commercialBreak` / rewarded hooks ([`src/platform/platform.ts`](src/platform/platform.ts))

Level data: JSON + Zod ([`src/levels/`](src/levels/)) — `platforms`, `hazards`, `collectibles`, spawn, size, backgrounds, exit portal.

## Goals

- Primary release target: **[Poki](https://poki.com/)**
- Also shipable to **[itch.io](https://itch.io/)** and **[CrazyGames](https://www.crazygames.com/)**
- Monetize on portals; source public for portfolio under **All Rights Reserved** (see [`LICENSE`](./LICENSE))

## Resolution & art

- Design size: **960×540** (16:9), contain-scale into the host window / iframe, clipped to the design rect
- Landscape-first; portrait / rotate UX deferred
- Prefer **2×** art with `"data": { "resolution": 2 }` in [`src/assets/manifest.json`](src/assets/manifest.json) (logical sizes in Pixi — do not also `scale = 0.5`)
- Backgrounds: logical bleed around the viewport; parallax clamped (no tiling)
- Debug tinted rects for platforms / sticky walls / spikes until final art lands

## Scripts

| Command | Channel | Portal SDK in `index.html` |
|---------|---------|----------------------------|
| `npm start` | `local` | none |
| `npm run build` | `release` | none |
| `npm run build:itch` | `itch` | none |
| `npm run build:poki` | `poki` | [Poki SDK v2](https://sdk.poki.com/html5) |
| `npm run build:crazygames` | `crazygames` | [CrazyGames SDK v3](https://docs.crazygames.com/sdk/intro/) |

Channel is written by `scripts/generate-build-info.cjs`. Webpack injects the portal `<script>` only for `poki` / `crazygames`. Runtime bridge: [`src/platform/platform.ts`](src/platform/platform.ts).

Production builds write `dist/BUILD.txt` (version, channel, git meta). Upload the whole `dist/` folder to a portal.

## Project layout (high level)

| Path | Role |
|------|------|
| `src/scenes/` | Loading, main menu, platform level |
| `src/components/` | Level carousel and shared UI bits |
| `src/entities/` | Player, collectibles, hazards |
| `src/fx/` | Death droplet pool and other short-lived VFX |
| `src/physics/` | Matter world, static bodies, ground / wall contact |
| `src/world/` | Camera, parallax, level root |
| `src/levels/` | Zod schema + JSON levels (`forest-01`) |
| `src/input/` | Shared controls + 9-slice touch pad |
| `src/hud/` | Icon HUD + modals (pause, result, Progress, Customize) |
| `src/managers/` | Scenes catalog, skins catalog, GameProgress, sound |
| `src/platform/` | Poki / CrazyGames / no-op adapters |
| `plans/` | Design / portal research notes |

## UI workflow progress

| Stage | Status |
|-------|--------|
| A — Main menu + carousel + platform session | Done |
| B — Pause modal (Resume / Home / Restart) | Done |
| A2 — Portal chain + GameProgress + catalog | Done |
| C — Level-clear modal (stats + Continue) | Done |
| D — Progress / Customize modals + selected skin in-level | Done |
| E — Help / rewarded teleport | Next |
| F — Polish (movePill, etc.) | Later |

## Known gaps (not blockers for a first push)

- More player kit still queued (double jump, dash, glide) — see mechanics backlog
- Final art for sticky walls / spikes; per-skin droplet assets deferred (catalog field ready)
- Bundle is heavier than an ideal Poki first download (`bundle.js` ~1.4 MB + music) — optimize before portal submit
- Portrait / rotate UX and portal safe-area adaptation deferred## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE).  
You may view the source for portfolio / learning; reuse of code or assets needs written permission (or a platform publishing agreement).

## Plans

| File | Contents |
|------|----------|
| [`plans/poki-2d-platformer-concept.md`](./plans/poki-2d-platformer-concept.md) | Game concept, scope, stack |
| [`plans/player-mechanics-backlog.md`](./plans/player-mechanics-backlog.md) | Player mechanics backlog (cling / death / crouch done; double jump, dash, glide queued) |
| [`plans/poki.md`](./plans/poki.md) | Poki / CrazyGames technical notes |

## Author

Aliaksandr Bandarenka — [github.com/alexanderbond081](https://github.com/alexanderbond081)
