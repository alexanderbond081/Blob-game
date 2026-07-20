# Fairy Blob

Casual HTML5 game: a glowing blob jumps across leaves and collects fireflies. Short Poki-style levels, landscape **960×540**.

Built with **Pixi.js v8** + **TypeScript** + **Webpack 5**.

## Goals

- Primary release target: **[Poki](https://poki.com/)**
- Also shipable to **[itch.io](https://itch.io/)** and **[CrazyGames](https://www.crazygames.com/)**
- Monetize on portals; keep source public for portfolio under **All Rights Reserved** (see `LICENSE`)

## Resolution

- Design size: **960×540** (16:9)
- The stage uses **contain** scaling so it fills the host window / portal iframe
- Content is **clipped** to the 960×540 design rect (nothing draws into the letterbox)
- Portrait / rotate-device UX is deferred (landscape-first for now)

### Art (2×)

- Author textures at **2×** logical size; mark them in `manifest.json` with `"data": { "resolution": 2 }` so Pixi reports logical `width`/`height`
- **Background** source: **2200×1200** → logical **1100×600**, centered on 960×540 (~70×30 px bleed); parallax clamped to bleed (no tiling)
- Do not also `sprite.scale.set(0.5)` on assets that already use `resolution: 2`

## Scripts

| Command | Channel | Portal SDK in `index.html` |
|---------|---------|----------------------------|
| `npm start` | `local` | none |
| `npm run build` | `release` | none |
| `npm run build:itch` | `itch` | none |
| `npm run build:poki` | `poki` | [Poki SDK v2](https://sdk.poki.com/html5) |
| `npm run build:crazygames` | `crazygames` | [CrazyGames SDK v3](https://docs.crazygames.com/sdk/intro/) |

Channel comes from `scripts/generate-build-info.cjs` → `build/build-info.json`. Webpack injects the matching `<script>` only for `poki` / `crazygames`. Runtime calls go through `src/platform/platform.ts` (init + loading/gameplay hooks; ads later).

Each production build writes `dist/BUILD.txt` with version, channel, and git metadata.

## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE).  
Source may be viewed for portfolio / learning; reuse of code or assets needs written permission (or a platform publishing agreement).

## Plans

| File | Contents |
|------|----------|
| [`plans/poki-2d-platformer-concept.md`](./plans/poki-2d-platformer-concept.md) | Game concept, scope, stack |
| [`plans/poki.md`](./plans/poki.md) | Poki / CrazyGames technical notes |

## Author

Aliaksandr Bandarenka — [github.com/alexanderbond081](https://github.com/alexanderbond081)
