# Player Mechanics Backlog

Planned blob abilities / surface interactions for the platformer.  
**Status:** living backlog — ship items move to Done; list still grows.  
This list will grow; append new items below, do not drop old ones without a note.

Related: [`poki-2d-platformer-concept.md`](./poki-2d-platformer-concept.md)

---

## Queued (ordinary platformer kit)

| # | Mechanic | Behavior (intent) | Notes / open knobs | Assets |
|---|----------|-------------------|--------------------|--------|
| 4 | **Double jump** | Second jump in air. Instead of pre-jump squat: **semi-transparent fairy wings** flap, then vanish. Wings leave a **sparkling mini-star trail** that fades. | Wing + trail VFX are part of the feel, not optional polish. | Wings + star particles — may be missing |
| 5 | **Dash (left / right)** | Short dash; blob becomes flatter; dodge or pass through narrow gaps. | Hitbox / collision while flat important. | Squash / dash frames TBD |
| 6 | **Glide / float** | Slow descent while gliding. Same fairy wings + sparkle trail as double jump; wings disappear when glide ends. | Share wing/trail VFX with #4 if possible. | Same as #4 or shared |

---

## Implementation order (suggestion only)

Not committed — reorder when scheduling:

1. ~~Sticky cling (#1)~~ → Done  
2. ~~Spikes / death (#2)~~ → Done  
3. ~~Crouch / hide (#3)~~ → Done  
4. Double jump (#4) — air state + wing/trail VFX  
5. Glide (#6) — extend air/wing system from #4  
6. Dash (#5) — timing, squash, narrow-gap collision  

---

## Asset gaps

- Not every item has matching art yet (especially **fairy wings**, **sparkle trail**, **dash squash**).  
- Prefer shared wing + trail FX for **double jump (#4)** and **glide (#6)**.  
- Mark asset readiness when packs land; do not block design notes on missing sprites.
- Sticky walls / spikes still use debug colored rects; droplet splash is in (even fan); puddle / land polish deferred.

---

## Done / deferred

| # | Mechanic | Notes |
|---|----------|-------|
| 1 | Sticky vertical cling | **Done.** Cling + wall-jump; `sticky-wall` label; hang-left/right; jelly hang/squash/peel; jump preferred over peel; cling only if wall top above blob center. |
| 2 | Spikes / death surfaces | **Done.** Level `hazards[]` (`type: spikes`); solid Matter `hazard` bodies; shared death pipeline with fall (`beginDeath` → `burst` anim → pause → respawn). Death VFX: pooled kinematic droplets (`src/fx/blob-droplet-pool.ts`), even circular fan. Enemies later via `enemies[]`, same kill path. |
| 3 | Crouch / hide | **Done.** Hold ↓ / `KeyS` / touch bottom-center; 0.5s blend; idle frames at ½ height, breath ×¼, alpha 0.6; Matter collider scaleY → 0.5 (feet planted); stand still (no crawl); jump exits crouch; `isHidden` at full blend for future LOS. |
