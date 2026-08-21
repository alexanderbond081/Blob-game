# Fairy Blob

Casual HTML5 platformer: a glowing blob jumps across leaves and collects fireflies. Short Poki-style levels, landscape **960×540**.

**Status:** playable vertical slice / portfolio prototype — main menu with level carousel, Ogmo-authored meadow levels, sticky walls, hazards/death, crouch/hide + crouch jump, fireflies that fill the portal, pause → Home / Resume / Restart. Not yet submitted to portals.

Built with **Pixi.js v8**, **Matter.js**, **TypeScript**, **Webpack 5**.

## Play locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

### Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | `A` / `D` or ← → | Drag slowly left / right; stops when the finger stops |
| Jump | `Space` / `W` / ↑ | Swipe up; 45° = full height and full run (same as keys); steeper eases to vertical; stops on landing |
| Crouch / hide | `S` / ↓ | Swipe down (latches); tap, hold-cancel, or any key to stand |
| Cancel last action | — | Tap, still press ~0.5 s, or any gameplay key |
| Pause | `Esc` | Pause button (gameplay HUD, right cluster) |
| Resume / Home / Restart | `Esc` resumes | Pause modal buttons |
| Fullscreen | `F` | Top-left HUD button (hidden on Poki builds) |
| Mute SFX | — | Top-right sound button |
| Mute music | — | Top-right music button |

Stuck keys / touch after OS UI (notification shade, tab blur) are cleared on focus loss.

Touch is gesture-first (no on-screen buttons). Horizontal swipes are ignored until dash. Jump sector starts ~33° above ±X; height is full from 45° up. Climbing a sticky wall is an upward swipe along the wall. A swipe into the top HUD band ends the stroke (intentional).

## What’s in this build

- Main menu hub: background, level carousel, Play, Progress / Customize modals
- Progress modal: episode summaries (completion % + fireflies) on a fixed grid
- Customize modal: skin grid, lock feedback, selection saved; applied on next level start
- Pause modal (gameplay): Home → menu (no ad break); Resume / Restart → `commercialBreak` when an ad actually starts, then gameplay
- Matter.js physics, walkable ground detection (slopes-ready normals)
- Camera follow + clamp, dual parallax backgrounds
- Blob player: run / jump / crouch wind-up, jelly squash, facing + hang sprites; colored skins via `skins-catalog`
- **Sticky walls** (`label: "sticky-wall"`): air cling, slow slide, peel-off stretch, wall-jump
- **Hazards** (`hazards[]`, `type: "spikes"`): solid AABB kill volumes; generated isosceles saw inside the box ([`src/entities/spike-outline.ts`](src/entities/spike-outline.ts)). Optional `facing` (one side) and `length` (0–1 tooth height)
- **Death:** shared kill path (hazard / fall) → optional `burst` anim → droplet splash → pause → respawn (empty burst frame OK; no forced hide of last frame)
- **Crouch / hide:** hold ↓ / `S` / down swipe; blend-in squat + alpha; collider half-height; release → 12-frame ease-in then micro-hop; crouch-jump grace 18 frames; jump from any crouch skips squat wind-up, uses `CROUCH_JUMP_VELOCITY` and a lower-pitched jump SFX
- **Portal gate:** starts locked; fireflies home to rim slots (`exit.slots`); door tweens out and a vortex spins when full; overlap then clears the level. Blob fly-in / suck-in animation is deferred
- Fireflies: wander around their point, pickup wind SFX, then fly to a portal slot (or fade into the vortex if the rim is already full)
- Top icon HUD: fullscreen (non-Poki), pause (gameplay), separate music / SFX mute
- Platform SDK bridge: `gameLoadingFinished`, `gameplayStart` / `Stop`, `commercialBreak` / rewarded hooks ([`src/platform/platform.ts`](src/platform/platform.ts))

Level data: JSON + Zod ([`src/levels/`](src/levels/)) — `platforms`, `hazards`, `collectibles`, spawn, size, backgrounds, exit portal. Layouts are blocked in **[Ogmo 3](https://ogmo-editor-3.github.io/)** (`*-ogmo.json`); Y is flipped on load (`authorY` from the level bottom).

## Goals

- Primary release target: **[Poki](https://poki.com/)**
- Also shipable to **[itch.io](https://itch.io/)** and **[CrazyGames](https://www.crazygames.com/)**
- Monetize on portals; source public for portfolio under **All Rights Reserved** (see [`LICENSE`](./LICENSE))

## Resolution & art

- Design size: **960×540** (16:9), contain-scale into the host window / iframe, clipped to the design rect
- Landscape-first; portrait / rotate UX deferred
- Prefer **2×** art with `"data": { "resolution": 2 }` in [`src/assets/manifest.json`](src/assets/manifest.json) (logical sizes in Pixi — do not also `scale = 0.5`)
- Backgrounds: logical bleed around the viewport; parallax clamped (no tiling)
- World collision art is ship look: translucent rounded Graphics plates (`ground` / `leaf` / `wall` / `sticky`) and the spike saw. Optional later: tint / alpha, or round the spike inner core — not painted leaf/spike textures

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
| `src/entities/` | Player, fireflies, portal, hazards |
| `src/fx/` | Death droplet pool and other short-lived VFX |
| `src/physics/` | Matter world, static bodies, ground / wall contact |
| `src/world/` | Camera, parallax, level root |
| `src/levels/` | Zod schema + JSON levels (`meadow-01` / `meadow-02`) + Ogmo sources |
| `src/input/` | Shared analog controls + gesture touch layer |
| `src/hud/` | Icon HUD + modals (pause, result, Progress, Customize) |
| `src/managers/` | Scenes catalog, skins catalog, GameProgress, sound |
| `src/platform/` | Poki / CrazyGames / no-op adapters |
| `plans/` | Design / portal research notes |

## UI workflow progress

| Stage | Scope | Status |
|-------|-------|--------|
| A — Main menu + carousel + platform session | UI shell | Done |
| B — Pause modal (Resume / Home / Restart) | UI shell | Done |
| A2 — Portal chain + GameProgress + catalog | Save / flow | Done |
| C — Level-clear modal (stats + Continue) | UI shell | Done |
| D — Progress / Customize modals + selected skin in-level | UI shell | Done |
| **E — Playable demo** (portal gate, enemies, 10 levels, touch rework, hints, demo outro) | Ship to itch + submit to Poki | **Next** |
| F — Content & feature depth (portrait, rewarded help, more mechanics / skins / audio, asset optimization) | Post-approval | Later |
| G — Final polish before portal tests (`movePill`, safe areas, etc.) | Pre-release | Later |

### Stage E — demo checklist

Goal: a build good enough to publish on itch.io and send to Poki for publishing approval.

| # | Task | Notes |
|---|------|-------|
| 1 | Portal unlock by fireflies + door art | **Done.** Locked until `exit.slots` fireflies dock on the rim; door opens to a spinning vortex |
| 2 | Portal entry animation + SFX before the result modal | Enter SFX is in; **blob fly-in animation deferred**. Result modal still fires on overlap |
| 3 | Enemies: moving hazards (beetle / spider / wasp) on fixed paths | New level-schema object; needed before authoring levels |
| 4 | 10 levels with a progressive difficulty curve | Only after 1 and 3 |
| 5 | Touch controls rework | **Done (playable).** Gesture layer: settle + flick-on-up, jump/crouch swipes, analog axes from angle, tap / 0.5 s / key cancel. Horizontal swipe deferred until dash. Remaining event-order polish in [`plans/poki.md`](./plans/poki.md) → Touch follow-ups |
| 6 | Hints for the mechanics that already exist | **Playback done** (move / jump / crouch / crouch-jump). Place on levels while authoring. Plan: [`plans/e6-level-hints.md`](./plans/e6-level-hints.md) |
| 7 | Demo outro screen after the last level | **Done (UI).** Result modal `demoComplete` when no next level. Celebratory SFX/VFX deferred |
| 8 | Poki submission prerequisites | Requirements checklist, first-download size, 60 FPS on mid-range mobile, no-`localStorage` (incognito) path |

## Known gaps (not blockers for a first push)

- Demo-complete celebration polish: music/SFX + VFX (sparks, glowing pollen, happy blob, fairies — TBD) on the last-level result modal
- Touch follow-ups (not blockers): `pointerup` capture race vs Pixi up position; `touchend` identifier vs `pointerId`; `pointercancel` vs `touchcancel`; flick that pauses before lift; pause/blur leaving a committed jump; failed takeoff leaving a ground run — see [`plans/poki.md`](./plans/poki.md)
- Portal entry (blob suck-in) animation before the result modal — deferred
- More player kit still queued (double jump / flight, dash, glide) — see mechanics backlog
- Platform plates and the spike saw are the ship look (optional later: tint / alpha; round the spike inner core). Per-skin droplet assets deferred (catalog field ready)
- Bundle is heavier than an ideal Poki first download (`bundle.js` ~1.4 MB + music) — optimize before portal submit
- Portrait / rotate UX and portal safe-area adaptation deferred to stage F
- Pause modal stops the scene ticker but not `gsap.globalTimeline` (portal + hint loops keep playing). Platform ads do pause GSAP. Freeze hints later only if that contrast becomes a problem.

## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE).  
You may view the source for portfolio / learning; reuse of code or assets needs written permission (or a platform publishing agreement).

## Plans

| File | Contents |
|------|----------|
| [`plans/poki-2d-platformer-concept.md`](./plans/poki-2d-platformer-concept.md) | Game concept, scope, stack |
| [`plans/player-mechanics-backlog.md`](./plans/player-mechanics-backlog.md) | Player mechanics backlog (cling / death / crouch + crouch jump done; double jump, dash, glide queued) |
| [`plans/e6-level-hints.md`](./plans/e6-level-hints.md) | Stage E6: in-level control hints (authoring + playback) |
| [`plans/poki.md`](./plans/poki.md) | Poki / CrazyGames technical notes |

## Author

Aliaksandr Bandarenka — [github.com/alexanderbond081](https://github.com/alexanderbond081)
