# Fairy Blob

Casual HTML5 platformer: a glowing blob jumps across leaves and collects fireflies. Short Poki-style levels, landscape **960×540**.

**Status:** playable vertical slice / portfolio prototype (one JSON level, core movement + collectibles). Not yet submitted to portals.

Built with **Pixi.js v8**, **Matter.js**, **TypeScript**, **Webpack 5**.

## Play locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

### Controls

| Action | Keyboard | Touch (invisible 9-slice pad) |
|--------|----------|-------------------------------|
| Move | `A` / `D` or ← → | Bottom-left / bottom-right |
| Jump | `Space` / `W` / ↑ | Mid-left / mid-right (also moves) |
| Fullscreen | `F` | — |

## What’s in this build

- Matter.js physics, walkable ground detection (slopes-ready normals)
- Camera follow + clamp, dual parallax backgrounds
- Blob player: run / jump / crouch wind-up, jelly squash, spritesheet facing
- Fireflies: bob animation, pickup SFX, respawn after a few seconds
- Fall below level → respawn at spawn
- Platform SDK hooks for Poki / CrazyGames builds (ads not wired yet)

## Goals

- Primary release target: **[Poki](https://poki.com/)**
- Also shipable to **[itch.io](https://itch.io/)** and **[CrazyGames](https://www.crazygames.com/)**
- Monetize on portals; source public for portfolio under **All Rights Reserved** (see [`LICENSE`](./LICENSE))

## Resolution & art

- Design size: **960×540** (16:9), contain-scale into the host window / iframe, clipped to the design rect
- Landscape-first; portrait / rotate UX deferred
- Prefer **2×** art with `"data": { "resolution": 2 }` in [`src/assets/manifest.json`](src/assets/manifest.json) (logical sizes in Pixi — do not also `scale = 0.5`)
- Backgrounds: logical bleed around the viewport; parallax clamped (no tiling)

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
| `src/scenes/` | Loading + platform level scene |
| `src/entities/` | Player, collectibles |
| `src/physics/` | Matter world, static bodies, ground contact |
| `src/world/` | Camera, parallax, level root |
| `src/levels/` | Zod schema + JSON levels (`forest-01`) |
| `src/input/` | Shared controls + 9-slice touch pad |
| `src/platform/` | Poki / CrazyGames / no-op adapters |
| `plans/` | Design / portal research notes |

## Known gaps (not blockers for a first push)

- One demo level; no win/lose loop or progression HUD yet (old HUD leftover, mostly unused)
- No ambience track in the manifest yet
- Bundle is heavier than an ideal Poki first download (`bundle.js` ~1.4 MB + music) — optimize before portal submit
- Ads / rewarded breaks not implemented
- `MainGameScene` is unused legacy demo code

## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE).  
You may view the source for portfolio / learning; reuse of code or assets needs written permission (or a platform publishing agreement).

## Plans

| File | Contents |
|------|----------|
| [`plans/poki-2d-platformer-concept.md`](./plans/poki-2d-platformer-concept.md) | Game concept, scope, stack |
| [`plans/poki.md`](./plans/poki.md) | Poki / CrazyGames technical notes |

## Author

Aliaksandr Bandarenka — [github.com/alexanderbond081](https://github.com/alexanderbond081)
