# Stage E6 — In-level control hints

**Status:** in progress (move / jump / crouch-jump playing, 2026-08-20).  
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
- Content is **masked** to the rounded plate so the hand never draws outside.

### Look

- Backing: filled rect, **black at 50% alpha**, corner radius **8** (same as platforms), **no outline / no 9-slice frame**.
- Plate size is **fixed per `kind`** in code (`hint-layout.ts`), not in JSON.
- Keyboard: white `key-unpressed` / `key-pressed` @2x (100×100 source) + dark labels. Cycle per scheme: 0.5s idle → 1s press → 0.5s release, then fade, gap, swap arrows/WASD. No Space on the poster (reserved for a future dash).
- Touch: `touch-hand` as a mouse-style pointer (no rotation; hotspot = fingertip). Contact ring + **8px** `#bfbfbf` trail with round caps; the tail fades first (comet).
- Walk swipe speed = player walk (**300 px/s**). Jump swipe = **1.5×** that with `power2.in`.
- Loop pause after each gesture: **1.5s**.
- Gamepad: reserve a slot in `InputMode`; **do not implement** until a gamepad path exists.

### Behaviour

- Visible for the whole run (looping). No trigger rect in v1 (display pose only).
- **Do not** lock controls, teleport the blob, dim the whole screen, or require the player to “complete” the hint gesture.
- Pause-menu help sheet is **out of scope** for this pass (same `kind` art can be reused later).
- **Pause vs GSAP:** the pause modal stops the Pixi scene ticker, but **does not** pause `gsap.globalTimeline` (portal vortex and hint loops keep playing). Platform ads *do* pause the global timeline. Do not freeze hints on user-pause unless we later pause a dedicated hint timeline — same as the portal today.

### Input mode (which art to show)

Last-input wins. **Do not** use UA / screen size / `maxTouchPoints`. Tracker: [`src/input/input-mode.ts`](../src/input/input-mode.ts).

| Event | Mode |
|-------|------|
| `keydown` of a **gameplay** key (WASD / arrows / Space) | `keyboard` |
| `pointerdown` with `pointerType === 'touch'` or `'pen'` | `touch` |
| `pointerType === 'mouse'` | **do not** switch to touch (HUD / carousel clicks) |

Default before any gameplay input: `matchMedia('(pointer: coarse)').matches` → `touch`, else `keyboard`.

## Data

Add `hints[]` to runtime level JSON ([`src/levels/level-schema.ts`](../src/levels/level-schema.ts)). Same authoring Y as platforms (from level bottom); flip in [`level-loader.ts`](../src/levels/level-loader.ts). Missing `hints` defaults to `[]`.

```ts
{
  kind: HintKind;
  x: number;            // left of backing rect (author space)
  y: number;            // top of backing rect (author space, from level bottom)
}
```

No `width` / `height` / `id` in v1. Size comes from `kind`.

Ogmo: still optional. meadow-01 currently hand-edits JSON.

## `kind` set

Playback is implemented for move, jump, and crouch-jump. Other values parse and are skipped at runtime.

| `kind` | Keyboard loop | Touch loop | Status |
|--------|-----------------|------------|--------|
| `move-right` | → / D | finger slides L-R | **Playing** (meadow-01) |
| `move-left` | ← / A | finger slides R-L | Playing (meadow-03) |
| `jump-right` | ↑+→ / W+D | swipe up-right | Playing (meadow-01) |
| `jump-left` | ↑+← / W+A | swipe up-left | Playing (meadow-03) |
| `jump` | ↑ | swipe up | stub |
| `crouch` | ↓ | swipe down | stub |
| `crouchJump-right` | ↓ 0.5s then ↑+→ (no idle between) | swipe down, then up-right | Playing (code only) |
| `crouchJump-left` | ↓ 0.5s then ↑+← | swipe down, then up-left | Playing (code only) |
| `cling-right` / `cling-left` | use jump-dir | use jump-dir | not a separate poster |
| `dash` / `glide` / `flight` | stub | stub | backlog |

## Runtime wiring

1. Parse `hints` (default `[]`).
2. `LevelRoot` adds a hints layer **first** (before platforms).
3. `LevelHint` plate + masked content; `MoveHint` / `JumpHint` / `CrouchJumpHint` own GSAP loops.
4. Subscribe to input-mode; swap / restart the matching timeline.
5. `PlatformLevelScene.update` does not tick hints — GSAP owns the loop.
6. Gesture layer stays **above** the world. Hints are not interactive.

## Files

- `src/levels/level-schema.ts`, `src/levels/level-loader.ts`, `src/levels/levels/meadow-01.json`
- `src/input/input-mode.ts`
- `src/entities/hints/` (`level-hint.ts`, `move-hint.ts`, `jump-hint.ts`, `crouch-jump-hint.ts`, `touch-pointer.ts`, `keyboard-cluster.ts`, `hint-layout.ts`, `create-level-hint.ts`)
- `src/world/level-root.ts`
- `src/assets/manifest.json` (`hint-touch-hand`, `hint-touch-point`, `hint-key-pressed`, `hint-key-unpressed`, `resolution: 2`)

## Out of scope

- Input lock, teleport-to-trigger, “must perform the gesture”
- Trigger radius / fade-in by proximity (v1 always on)
- `GameProgress.seenHints`
- Pause-modal tutorial page
- Freezing hint GSAP on the pause modal (see Behaviour)
- iOS PWA / hiding the fullscreen HUD button
- Gamepad glyphs
- Frame-by-frame swipe filmstrips, Lottie, Spine
- Ogmo entity (JSON is authored by hand for now)

## Test plan

- [ ] Old levels without `hints` still load.
- [ ] Poster is behind leaves/blob, above parallax; plate has no stroke.
- [ ] Keyboard: keycaps blink; mouse-clicking HUD does **not** switch to touch art.
- [ ] Touch: swipe loops; WASD/arrows/Space switch to keyboard art.
- [ ] Coarse-pointer default shows touch art before first key.
- [ ] Scene change / restart does not leak GSAP tweens.
- [ ] meadow-01 readable on phone landscape and desktop 960×540.
- [ ] Pause modal: hints keep looping (same as portal); ads freeze them.

## Remaining

- Place remaining posters on later levels.
- Mark E6 done in [`poki.md`](./poki.md) / README when the demo set is authored.
