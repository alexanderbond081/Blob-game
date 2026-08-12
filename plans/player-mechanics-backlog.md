# Player Mechanics Backlog

Planned blob abilities / surface interactions for the platformer.  
**Status:** living backlog — ship items move to Done; list still grows.  
This list will grow; append new items below, do not drop old ones without a note.

**Campaign note:** abilities unlock **per episode** via **pollen relics** (inanimate tokens), not live insects. Start = walk only on first playthrough; replays keep earned kit; NG+ after full clear. Lore + hub rules: [`poki-2d-platformer-concept.md`](./poki-2d-platformer-concept.md). This file stays focused on *how* each move feels when unlocked.

**Demo-scope note (stage E, under review):** gating for the demo is being rebalanced. Likely shape — **flight** becomes the one unlockable / rewarded move (instead of a plain double jump), while the rest of the kit is available from the start. Not final; revisit before authoring the 10 demo levels.

Related: [`poki-2d-platformer-concept.md`](./poki-2d-platformer-concept.md)

---

## Queued (ordinary platformer kit)

| # | Mechanic | Behavior (intent) | Notes / open knobs | Assets |
|---|----------|-------------------|--------------------|--------|
| 4 | **Double jump** | Second jump in air. Instead of pre-jump squat: **semi-transparent fairy wings** flap, then vanish. Wings leave a **sparkling mini-star trail** that fades. | Wing + trail VFX are part of the feel, not optional polish. | Wings + star particles — may be missing |
| 5 | **Dash (left / right)** | Short dash; blob becomes flatter; dodge or pass through narrow gaps. | Hitbox / collision while flat important. | Squash / dash frames TBD |
| 6 | **Glide / float** | Slow descent while gliding. Same fairy wings + sparkle trail as double jump; wings disappear when glide ends. | Share wing/trail VFX with #4 if possible. | Same as #4 or shared |
| 7 | **Flight** | Sustained powered ascent, not a single air impulse. Candidate replacement for #4 as *the* unlockable / rewarded move. | Balance risk: trivializes level layouts if uncapped — needs a duration or altitude limit. Shares the wing + trail VFX family. | Wings + trail (shared with #4 / #6) |

---

## Implementation order (suggestion only)

Not committed — reorder when scheduling:

1. ~~Sticky cling (#1)~~ → Done  
2. ~~Spikes / death (#2)~~ → Done  
3. ~~Crouch / hide (#3)~~ → Done  
4. Air state + wing/trail VFX — shared base for double jump (#4) and flight (#7)  
5. Flight (#7) or double jump (#4), whichever wins the demo gating decision  
6. Glide (#6) — extends the same air/wing system  
7. Dash (#5) — timing, squash, narrow-gap collision  

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
| 2 | Spikes / death surfaces | **Done.** Level `hazards[]` (`type: spikes`); solid Matter `hazard` bodies; shared death pipeline with fall (`beginDeath` → `burst` anim → pause → respawn). Death VFX: pooled kinematic droplets (`src/fx/blob-droplet-pool.ts`), even circular fan. Burst sheet may be a blank frame (droplets carry the pop); last frame is not force-hidden. **Next:** moving enemies (beetle / spider / wasp on fixed paths) reuse this kill path — scheduled for stage E, before the demo levels are authored. |
| 3 | Crouch / hide | **Done.** Hold ↓ / `KeyS` / touch bottom-center; blend-in squat (½ height, breath ×¼, alpha 0.6); Matter collider scaleY → 0.5 (feet planted); stand still (no crawl); release → micro-hop stand; jump from crouch skips squat wind-up; `isHidden` at full blend for future LOS. |
