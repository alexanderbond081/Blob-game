# Stage E6 — In-level control hints

**Status:** playback done for shipped kit including crouch (2026-08-20); remaining work is authoring while levels are built.  
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

- Backing: filled rect, **~50% alpha**, corner radius **8** (same as platforms), **no outline / no 9-slice frame**. Plate tint/alpha live in `hint-layout.ts`.
- Plate size is **fixed per `kind`** in code (`hint-layout.ts`), not in JSON.
- Keyboard: white `key-unpressed` / `key-pressed` @2x (100×100 source) + dark labels. Cycle per scheme: idle → press → release, then optional fade/gap, swap arrows/WASD. Timings in `hint-layout.ts` (`HINT_KEY_*`, `HINT_SCHEME_*`). No Space on the poster (reserved for a future dash).
- Touch: `touch-hand` as a mouse-style pointer (no rotation; hotspot = fingertip). Contact ring + **8px** `#bfbfbf` trail with round caps; the tail fades first (comet).
- Walk / jump swipe speeds and loop pause: `HINT_MOVE_SPEED`, `HINT_JUMP_SPEED`, `HINT_CYCLE_PAUSE_SEC`. Crouch-jump splits the two slides with hand fade + `HINT_SLIDE_GAP_SEC`.
- Gamepad: slot in `InputMode`; **do not implement** until a gamepad path exists.

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

`hints[]` in runtime level JSON ([`src/levels/level-schema.ts`](../src/levels/level-schema.ts)). Same authoring Y as platforms (from level bottom); flip in [`level-loader.ts`](../src/levels/level-loader.ts). Missing `hints` defaults to `[]`.

```ts
{
  kind: HintKind;
  x: number;            // left of backing rect (author space)
  y: number;            // top of backing rect (author space, from level bottom)
}
```

No `width` / `height` / `id` in v1. Size comes from `kind`. JSON is authored by hand (no Ogmo entity yet).

## `kind` set

| `kind` | Keyboard loop | Touch loop | Status |
|--------|-----------------|------------|--------|
| `move-right` | → / D | finger slides L-R | **Done** — meadow-01 |
| `move-left` | ← / A | finger slides R-L | **Done** — meadow-03 |
| `jump-right` | ↑+→ / W+D | swipe up-right | **Done** — meadow-01 |
| `jump-left` | ↑+← / W+A | swipe up-left | **Done** — meadow-02, meadow-03 |
| `crouchJump-right` | ↓ (`HINT_KEY_SHORT_SEC`) then ↑+→ | swipe down, fade, swipe up-right | **Done** — meadow-04 |
| `crouchJump-left` | ↓ then ↑+← | swipe down, fade, swipe up-left | **Done** (code); not placed |
| `crouch` | ↓ / S | swipe down | **Done** (code); place when a low gap needs hide |
| `jump` | ↑ | swipe up | stub — only if a level needs a straight hop |
| `cling-right` / `cling-left` | use jump-dir | use jump-dir | not a separate poster |
| `dash` / `glide` / `flight` | stub | stub | backlog (mechanics not shipped) |

## Runtime wiring

1. Parse `hints` (default `[]`).
2. `LevelRoot` adds a hints layer **first** (before platforms).
3. `LevelHint` plate + masked content; `MoveHint` / `JumpHint` / `CrouchHint` / `CrouchJumpHint` own GSAP loops.
4. Subscribe to input-mode; swap / restart the matching timeline.
5. `PlatformLevelScene.update` does not tick hints — GSAP owns the loop.
6. Gesture layer stays **above** the world. Hints are not interactive.

## Files

- `src/levels/level-schema.ts`, `src/levels/level-loader.ts`
- `src/levels/levels/meadow-01.json` … `meadow-04.json`
- `src/input/input-mode.ts`
- `src/entities/hints/` (`level-hint.ts`, `move-hint.ts`, `jump-hint.ts`, `crouch-hint.ts`, `crouch-jump-hint.ts`, `touch-pointer.ts`, `keyboard-cluster.ts`, `hint-layout.ts`, `create-level-hint.ts`)
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
- Dash / glide / flight posters until those moves exist

## Test plan

- [x] Old levels without `hints` still load (`meadow-13`, `testlevel-00`).
- [x] Poster is behind leaves/blob, above parallax; plate has no stroke.
- [x] Keyboard: keycaps blink; mouse-clicking HUD does **not** switch to touch art.
- [x] Touch: swipe loops; WASD/arrows/Space switch to keyboard art.
- [ ] Coarse-pointer default shows touch art before first key (verify on a phone with no prior key).
- [x] Scene change / restart does not leak GSAP tweens (kill on `destroy`).
- [x] meadow-01 readable on phone landscape and desktop 960×540.
- [x] Pause modal: hints keep looping (same as portal); ads freeze them.

## Remaining (this stage)

Engine for the shipped kit is in. Left:

1. **Authoring** while building levels: place posters where the player actually learns the move (`crouch`, `crouchJump-left`, cling via `jump-*` at sticky walls).
2. **Optional:** straight `jump` up only if a layout cannot be taught by jump-left/right.
3. **Mark E6 done** in [`poki.md`](./poki.md) / README when the demo set’s posters are placed.
