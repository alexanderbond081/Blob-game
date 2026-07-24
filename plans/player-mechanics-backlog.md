# Player Mechanics Backlog

Planned blob abilities / surface interactions for the platformer.  
**Status:** living backlog — ship items move to Done; list still grows.  
This list will grow; append new items below, do not drop old ones without a note.

Related: [`poki-2d-platformer-concept.md`](./poki-2d-platformer-concept.md)

---

## Queued (ordinary platformer kit)

| # | Mechanic | Behavior (intent) | Notes / open knobs | Assets |
|---|----------|-------------------|--------------------|--------|
| 2 | **Spikes / death surfaces** | Blob pops on spiked surfaces → level restart. | For now, same path as fall-off-bottom death / restart. | Spikes art TBD |
| 3 | **Crouch / hide** | Blob crouches, becomes semi-transparent → hidden from enemies. | Needs enemy LOS / aggro rules later. | Crouch pose / alpha TBD |
| 4 | **Double jump** | Second jump in air. Instead of pre-jump squat: **semi-transparent fairy wings** flap, then vanish. Wings leave a **sparkling mini-star trail** that fades. | Wing + trail VFX are part of the feel, not optional polish. | Wings + star particles — may be missing |
| 5 | **Dash (left / right)** | Short dash; blob becomes flatter; dodge or pass through narrow gaps. | Hitbox / collision while flat important. | Squash / dash frames TBD |
| 6 | **Glide / float** | Slow descent while gliding. Same fairy wings + sparkle trail as double jump; wings disappear when glide ends. | Share wing/trail VFX with #4 if possible. | Same as #4 or shared |

---

## Implementation order (suggestion only)

Not committed — reorder when scheduling:

1. ~~Sticky cling (#1)~~ → Done  
2. Spikes / death (#2) — reuse existing fall-restart pipeline  
3. Crouch / hide (#3) — input + hitbox + alpha (+ enemy rules later)  
4. Double jump (#4) — air state + wing/trail VFX  
5. Glide (#6) — extend air/wing system from #4  
6. Dash (#5) — timing, squash, narrow-gap collision  

---

## Asset gaps

- Not every item has matching art yet (especially **fairy wings**, **sparkle trail**, possibly **spikes**, **sticky surfaces**, **dash squash**).  
- Prefer shared wing + trail FX for **double jump (#4)** and **glide (#6)**.  
- Mark asset readiness when packs land; do not block design notes on missing sprites.
- Sticky walls still use debug purple rects; final art TBD (mechanic itself is done).

---

## Done / deferred

| # | Mechanic | Notes |
|---|----------|-------|
| 1 | Sticky vertical cling | **Done.** Cling + wall-jump; `sticky-wall` label; hang-left/right; jelly hang/squash/peel (6-frame stretch before detach); jump preferred over peel; cling only if wall top above blob center. Slide / jump multipliers still tunable. |
