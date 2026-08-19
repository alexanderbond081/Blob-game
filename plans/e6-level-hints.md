# Stage E6 — In-level control hints

**Status:** ready to implement (design locked in chat, 2026-08-18).  
**Owner:** separate implementation pass. Do not mix with touch follow-ups, PWA/iOS chrome, or E3 enemies.  
Related: [`poki.md`](./poki.md) stage E #6, [`player-mechanics-backlog.md`](./player-mechanics-backlog.md).

## Goal

Teach existing demo mechanics **in the level**, not in the itch description. Hints are **authored world objects** (any count, any placement). They sit in the playfield, move with platforms (camera 1:1), and never freeze or steal input.

Levels are small: always-on loops are acceptable; do not persist `seenHints` in v1.

## Locked design

### Placement / layer

- Hints live in **world space** (`worldRoot` / `LevelRoot`), **behind** platforms, hazards, portal, fireflies, player, droplets.
- Hints sit **in front of** screen-space parallax (`sky` / `far` / `mid` are siblings **under** `worldRoot` in `PlatformLevelScene`).
- Author geometry so leaves/walls do not cover the poster (layout, not engine clipping).
- **Not** a screen-space HUD overlay. **Not** above the blob.

### Look

- Backing: filled rect, **black at 50% alpha**, **no outline / no 9-slice frame** (must not read as a platform).
- Foreground: **opaque white** pictograms (not paragraphs of text). Short symbols on keycaps are OK (`↑`, WASD).
- Keyboard: static keycap art + **pressed / unpressed** (two textures or two visibilities).
- Touch: **motion** of a white pictogram (finger / swipe arrow), GSAP loop.
- Gamepad: reserve a slot in data; **do not implement** until a gamepad path exists.

### Behaviour

- Visible for the whole run (looping). No trigger rect in v1 (display pose only).
- **Do not** lock controls, teleport the blob, dim the whole screen, or require the player to “complete” the hint gesture.
- Pause-menu help sheet is **out of scope** for this pass (same `kind` art can be reused later).

### Input mode (which art to show)

Last-input wins. **Do not** use UA / screen size / `maxTouchPoints`.

| Event | Mode |
|-------|------|
| `keydown` of a **gameplay** key (WASD / arrows / Space) | `keyboard` |
| `pointerdown` with `pointerType === 'touch'` or `'pen'` | `touch` |
| `pointerType === 'mouse'` | **do not** switch to touch (HUD / carousel clicks) |

Default before any gameplay input: `matchMedia('(pointer: coarse)').matches` → `touch`, else `keyboard`.

Centralize this in something like `src/input/input-mode.ts` so hints and (later) other UI share one flag.

## Data

Add `hints[]` to runtime level JSON ([`src/levels/level-schema.ts`](../src/levels/level-schema.ts)). Same authoring Y as spawn (from level bottom); flip in [`level-loader.ts`](../src/levels/level-loader.ts) like other points/rects.

```ts
{
  id: string;           // stable, unique per level (e.g. "meadow-01-jump")
  kind: HintKind;       // see table below
  x: number;            // left of backing rect (author space)
  y: number;            // top of backing rect (author space, from level bottom)
  width: number;
  height: number;
}
```

`id` is for future `seenHints`; unused in v1.

Ogmo: new **rect** entity `hint` with enum value `kind` (and optional `id` string). Export into `src/levels/levels/*.json` the same way platforms are exported today (manual or existing convert step). Project file: `src/levels/*.ogmo.json`.

## `kind` set

Implement playback for **shipped** kit first. Stub `kind` values for queued moves so Ogmo does not break later.

| `kind` | Keyboard loop | Touch loop | Notes |
|--------|-----------------|------------|--------|
| `move` | ← / A then → / D press-unpress | finger / arrow slides L-R | |
| `jump` | ↑ or Space blink | swipe up | |
| `crouch` | ↓ / S hold-blink | swipe down | latched crouch |
| `crouchJump` | ↓ held, then Space | swipe down, pause, swipe up | high hop; non-obvious |
| `cling` | (optional key art) + jump | swipe up along wall | cling is **on air contact**, not “hold into wall” |
| `portal` | walk / jump in | same idea | fireflies fill slots; extra flies fade |
| `dash` | stub | stub | mechanics backlog #5 |
| `glide` / `flight` | stub | stub | backlog #6 / #7 |

Spikes: no hint required if the art reads as hazard; skip unless a level really needs it.

## Animation tech

- **Do not** use animated SVG inside Pixi (load = raster snapshot; DOM/SVG cannot z-sort between parallax and platforms).
- SVG is fine as **source art** exported to PNG `@2x` (`manifest.json` `data.resolution: 2`), same as other game art.
- Drive loops with **GSAP** (already in the project, `PixiPlugin` registered).
  - Touch: tween position / alpha of white sprites on the plate.
  - Keyboard: GSAP timeline toggles pressed/unpressed frames (optional slight `scale.y` on press).
- One helper e.g. `HintPlayback` / `LevelHint` per instance: `start()`, `stop()`, `setInputMode()`.
- Kill tweens on `destroy` (scene change).

Placeholder v1 (allowed): Pixi `Graphics` white shapes on the 50% plate if PNGs are not ready. Swap to textures without changing JSON.

## Runtime wiring

1. Parse `hints` (default `[]` so old JSON keeps working).
2. `LevelRoot`: container **first** (before platforms) or `addChildAt(hints, 0)` so posters stay behind geometry.
3. Each hint: backing `Graphics` + child content; position/size from rect.
4. Subscribe to input-mode changes; swap / restart the matching timeline.
5. `PlatformLevelScene.update` does not need per-hint logic if GSAP owns the loop.
6. Gesture layer stays **above** the world (input). Hints are not interactive.

## Files likely to touch

- `src/levels/level-schema.ts`, `src/levels/level-loader.ts`
- `src/levels/levels/meadow-01.json` (and Ogmo source) — at least **move** + **jump** as the first real placement
- Optional: meadow-02 cling / portal; crouch where a low gap exists
- `src/world/level-root.ts`
- New: `src/input/input-mode.ts`, `src/entities/level-hint.ts` (or `src/world/level-hints.ts`)
- `src/assets/manifest.json` when real PNGs land
- `.cursorrules` / README controls table only if behaviour is player-facing and stable

Do **not** rewrite `gesture-touch-layer.ts` beyond a one-line callback/event if needed to detect `pointerType`.

## Out of scope

- Input lock, teleport-to-trigger, “must perform the gesture”
- Trigger radius / fade-in by proximity (v1 always on)
- `GameProgress.seenHints`
- Pause-modal tutorial page
- iOS PWA / hiding the fullscreen HUD button
- Gamepad glyphs
- Frame-by-frame swipe filmstrips, Lottie, Spine

## Test plan

- [ ] Old levels without `hints` still load.
- [ ] Poster is behind leaves/blob, above parallax; plate has no stroke.
- [ ] Keyboard: keycaps blink; mouse-clicking HUD does **not** switch to touch art.
- [ ] Touch: swipe loops; WASD/arrows/Space switch to keyboard art.
- [ ] Coarse-pointer default shows touch art before first key.
- [ ] Scene change / restart does not leak GSAP tweens.
- [ ] meadow-01 readable on phone landscape and desktop 960×540.

## Implementation order

1. Schema + loader Y-flip + empty `hints: []` on existing JSON.
2. `input-mode.ts` + `LevelHint` placeholder Graphics + GSAP dummy loop.
3. Ogmo entity + place move/jump on meadow-01.
4. Real `kind` timelines (including `crouchJump`).
5. PNG pass when art exists (`resolution: 2`, white on transparent).
6. Mark E6 done in [`poki.md`](./poki.md) / README checklist.
