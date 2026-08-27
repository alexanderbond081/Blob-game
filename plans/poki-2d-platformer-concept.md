# Concept — Mystical Blob 2D Platformer (Fairy Blob)

Personal game concept for a casual HTML5 release (Poki / CrazyGames).  
Platform notes (SDK, size limits, engines): see `poki.md`.

---

## One-liner

A glowing blob explores short mystical meadows, collecting fireflies and unlocking platformer abilities episode by episode. Cozy art, soft glow — not a heavy physics sandbox.

---

## Fantasy & Feel

- Theme: **magic / mystique** — soft night meadow, bioluminescence, fairy dust.
- Player: a **living dewdrop** woken by fairy pollen — starts simple (walk only); grows a kit of movement abilities over the campaign.
- Goal per level: **collect enough pollen-lights (fireflies)** to coax open a leftover fairy portal (not necessarily all); optional 100% + gold fireflies for completionists.
- Field: **small** — readable at a glance; levels last from **~10 seconds to a few minutes**.
- Mood tools (no real Light2D):
  - slightly **dimmed** environment;
  - **semi-transparent glow** around blob and collectibles;
  - optional “dark” levels where mostly glows read against the dim field.

### Origin story (design fantasy)

Working narrative — **aspirational to fully visualize**; MVP can imply it with short beats / stills if a full intro is too heavy:

1. A **fairy** flies over a brook / meadow, shedding **magic pollen**.
2. Pollen settles as our **fireflies** (can read as simple glowing dots).
3. One mote lands on a **large water drop** gathered on a leaf; the drop slides down, **opens its eyes**, and comes alive — the blob (awake = **crawl left/right only** at first).
4. The fairy opens a **portal** and flies through it.
5. The portal **closes but does not vanish**; during play it **eases open again** as the blob gathers fireflies (ties collect → clear fantasy together).
6. **True ending (post-campaign):** the magical drop reaches the **fairy world** and becomes **almost a fairy** (wings / fairy-like form) — soft epilogue, not a second game.

**First level beat (concrete):** right after waking, the blob **crawls toward a bouncing dewdrop already visible on screen** and absorbs it → first ability (**jump**). Teach walk → walk-to-relic → jump in one short field; no long “crawl-only campaign.”

Portal + pollen also justify **ability relics**: other motes touched objects without fully waking them; the blob absorbs those “half-alive” tokens to gain moves (see Progression).

---

## Core Loop

1. Pick a level from the hub / level select (shows per-level firefly progress).
2. Move with currently unlocked abilities; collect fireflies (and optional gold ones).
3. Reach the **required firefly count** → leftover **fairy portal** opens enough to enter → next level / return to hub.
4. Optional: hazards (spikes, insects) block paths or kill; optional: crown on full clear.
5. Episode openers: find / absorb one **pollen relic** → new ability → layouts that use it. Level 1’s relic is on-screen from the start (bouncing dewdrop → jump).

---

## Progression — Episodes & Abilities

Campaign is split into **episodes**; length is **not fixed** — early episodes stay short so a thin kit does not bore casual players.

### Episode length & difficulty pacing

| Phase | Kit so far | Episode length (guideline) | Difficulty |
|-------|------------|----------------------------|------------|
| **Early** (e.g. jump only, then jump + one more) | 1–2 abilities | **Shorter** (~3–5 levels) | Very easy → easy; teach the new move fast |
| **Mid** (2–3+ abilities) | Kit starts to combine | **Longer** (~5–10 levels) | Easy → mild medium; more layout variety |
| **Later** | Full / near-full kit | Full episode length OK | Still mostly easy–medium (Poki-casual); spike sparingly |

Rationale: a long stretch of **jump-only** levels will lose non-hardcore players at the start. Unlock the next relic sooner early on; once 2–3 moves exist, it is safe to stretch episodes and ramp complexity.

### Unlock rules

- **Start of first playthrough:** only **move left / right**.
- **Level 1, immediately after waking:** crawl to the **on-screen bouncing dewdrop** → unlock **jump** (first pollen relic).
- **Start of each later episode:** unlock **one new ability** by collecting another **pollen relic** — an **inanimate** object the fairy’s dust touched but did **not** fully awaken like the blob. Prefer props that read clearly as **hub icons**, e.g.:
  - **Tiny bouncing dewdrop** → **jump** (level 1, visible from the start)
  - **Sparkling drop stuck to a stem** → **sticky cling**
  - **Floating butterfly wing** → **glide / float**
  - Further episode unlocks (tokens TBD): **double jump**, **dash**, **crouch / hide**, …
- Relics replace the older “catch a live insect” idea (flea / snail / butterfly as creatures) — same mechanical slots, clearer iconography, lighter to animate.

### Replay & ability persistence

- **Replaying any unlocked level:** blob keeps **all abilities earned so far** on this save (not the episode’s “as if first time” kit).
- **Ability / relic pickups** can be **collected again** on level replay and on a full campaign replay (for juice / score / completion feel); they should not soft-lock if already owned — re-collect = feedback, ownership already true.
- **After full campaign clear:** primary CTA becomes **Play from start** (same button as Continue, or a swapped label). New run starts with **the full ability kit available immediately** (New Game+ style), while fireflies / relics / crowns remain **re-collectable**.
- **Main / hub screen:** icons for unlocked abilities (empty slots or locked silhouettes until earned).

Exact relic → ability mapping and episode count stay flexible; mechanical feel lives in [`player-mechanics-backlog.md`](./player-mechanics-backlog.md).

---

## Collectibles, Portal & Win Rules

| Piece | Rule |
|-------|------|
| **Fireflies (normal)** | Pollen-lights. Primary collectible. Portal opens after a **threshold count** (not full clear). |
| **Portal** | Fairy’s leftover gate: mostly shut, **opens as fireflies are gathered**, then carries the blob to the next field (or hub). |
| **Level clear** | Threshold met + enter portal. Remaining fireflies can stay for 100% / revisit. |
| **Pollen relics** | Episode ability unlocks (dewdrop, stem-spark, wing, …). Re-collectable on replays. |
| **Gold fireflies** | Harder / gated by abilities or awkward routes. Collecting them unlocks a **golden blob skin**. |
| **End-of-level score** | Fireflies collected **this run** on that level. |
| **Lifetime score** | Total fireflies collected across the whole save. |
| **Hub totals** | Show lifetime normal fireflies + some presentation of gold firefly count. |
| **Level select** | Per level: **collected / total** fireflies (e.g. `7/12`). |
| **Crown** | After **all** fireflies on a level are collected (incl. revisit), show a **crown above the blob** (on that level’s card and/or in-level). |
| **True ending** | After full clear (and optional completion goals): drop enters fairy world ≈ becomes fairy-like. |

Gold vs normal counts and whether gold fireflies count toward the portal threshold: **open** — lean toward gold being optional completion, not required for clear.

---

## Meta UI (hub)

On the main / hub screen (and related select screens), surface at least:

1. Unlocked **ability icons** (relic silhouettes)
2. **Lifetime firefly** count
3. **Gold firefly** progress (count and/or progress toward gold skin)
4. Level list with **X / Y** fireflies and **crown** when fully cleared
5. CTA: **Continue** during campaign → **Play from start** after full clear (NG+ with all abilities)

---

## Modes (design vision)

| Mode | When | Idea |
|------|------|------|
| **Campaign (Casual)** | Default from day one | Episode progression, pollen-relic unlocks, portal clears, firefly scores. **MVP is this only.** After full clear: **Play from start** with all abilities (NG+). |
| **Speedrun** | Unlocks after **all campaign levels** cleared | Same rules / layouts; primary score = **clear time (seconds)** per level; later global / friend leaderboards. **First post-campaign mode** (cheapest to add). |
| **Puzzle** | After campaign (later) | Layouts / rules lean on order, gated routes, ability use as the puzzle. |
| **Survival** | After campaign (later) | Extra pressure (e.g. draining energy / hazards); builds on puzzle-ish constraints. |

Old “Arcade timer on the same casual run” folds into **Speedrun** as the post-game timed mode. Modes share world/tech; Speedrun is mostly UI + timer + save best times.

---

## Scope — Minimum (MVP)

**Ship / show / submit goal.**

| Include | Exclude |
|---------|---------|
| Blob + ability-gated kit (at least walk → jump → a couple more over episodes) | Full rigid-body “toy physics” |
| Portal clear after firefly **threshold** (not collect-all) | Speedrun / Puzzle / Survival |
| Episodes (early shorter ~3–5; later ~5–10); **~15–20** levels total for first ship | 50 unique hard levels |
| Hub: ability icons + lifetime fireflies; level select X/Y | Online leaderboards |
| Soft glow + slight dimming | Real lighting / shadows engine |
| Simple hazards (spikes etc. as blockers / kill) | Energy drain systems |
| Static + light parallax backgrounds | Complex weather / day cycle |
| Touch + keyboard; **rotate** 16:9 ↔ 9:16; any iframe contain-scale + unclipped bg bleed; HUD on iframe; **2×** art | Optional portrait pull-back zoom in `game-view.ts` if the 540-wide path is hard to read |
| Local progress save (levels, abilities, firefly totals) | Cloud saves / accounts |
| Basic SFX + 1 music track | Full adaptive soundtrack pack |
| Gold fireflies + gold skin **nice-to-have in MVP** if cheap | Must-ship gold skin on day one |

**Feel target:** one cozy evening of short levels with a clear “I grew new moves” arc; enough for CrazyGames Basic / Poki pitch.

---

## Scope — Maximum (full vision)

| Include |
|---------|
| **~50** short levels across more episodes (still mostly easy–medium; variety via layout + abilities + dressing) |
| Full ability kit unlocked episode-by-episode (jump, cling, hide, double jump, dash, glide, …) |
| Gold fireflies everywhere they matter + **golden blob skin** |
| Crowns on 100% levels; rich hub presentation of scores |
| Post-campaign modes: **Speedrun** (with leaderboards), then **Puzzle**, **Survival** |
| **NG+**: Play from start with full kit; relics / fireflies re-collectable |
| Soft **true ending** (drop ≈ fairy) — even if intro is abbreviated |
| More dark/glow-focused levels |
| Richer parallax set (sky, mountains, forest, clouds, near trees/bushes, water) |
| Mode-specific audio / juice |
| Poki + CrazyGames SDK adapters, thumbnails, polish pass |

**Not in vision (unless revisited):** 3D, multiplayer, procedural infinite runner.  
**Narrative:** light fairy-pollen fantasy is in-scope; a fully animated intro is optional / max-vision polish, not a blocker for MVP.

---

## Level & World Assumptions

- Duration: **~10 s – few minutes** per level.
- Space: **small field** — camera may barely scroll or gently follow; not open-world.
- Content reuse: many levels = **same mechanics, different layout + art dressing** (Poki-normal).
- **Pacing:** early episodes **shorter**; after ~2–3 abilities, episodes lengthen and difficulty climbs easy → medium (see Progression).
- Authoring: **[Ogmo 3](https://ogmo-editor-3.github.io/)** entity layers (AABB platforms, spawn, portal, fireflies, spikes) exported to JSON; runtime flips Y from the level bottom. Tiled is no longer the plan.

### Background layers (parallax)

| Layer | Motion | Examples |
|-------|--------|----------|
| Far static / near-static | 0 or tiny drift | Sky gradient, distant mountains, far forest silhouette |
| Mid slow | Parallax factor < 1 | Clouds drifting, distant canopy |
| Near mild | Stronger parallax / slow sway | Close trees, bushes, lake surface shimmer |
| Playfield | Camera follow | Ground, leaves, entities |
| FX / glow | Screen or world space | Blob/item aura (additive / alpha sprites) |

Parallax = **offset layers by camera × factor** (manual in [`ParallaxLayer`](../src/world/parallax-layer.ts)).

**Art / orientation policy (supported):** live rotate between 16:9 and 9:16; contain-scale into any iframe. Paint **bleed** around the core so letterbox is not `#222` (spec in [`plans/poki.md`](./poki.md) → Viewport). Mid/far tufts stay expensive — extend sky/soil in the pad, **lower `p`** rather than painting full parallax travel. Platforms/colliders remain the source of truth for layout.

---

## Rough Timelines

Assumes **one developer**, prior Pixi/TS experience, **simple physics** (no custom engine), glow-not-lights.  
**Part-time** ≈ 15–25 h/week · **Full-time** ≈ 35–40 h/week.

| Milestone | Part-time | Full-time |
|-----------|-----------|-----------|
| Playable prototype (1 level, feel OK) | 2–4 weeks | 1.5–3 weeks |
| **MVP** (15–20 levels, episodes + ability unlocks, portal clear, hub scores, Casual campaign only) | **2.5–4 months** | **1.5–2.5 months** |
| Speedrun mode + best times on same levels | +2–4 weeks | +1–2 weeks |
| Expand to ~50 levels (content pipeline mature) | +1–2 months | +3–6 weeks |
| Puzzle + Survival + dark-level pass | +1.5–3 months | +1–2 months |
| **Maximum vision** (50 levels + post-campaign modes + store polish) | **~6–9 months** | **~5–7 months** |

**Fast honest path:** MVP campaign (episodes + abilities + portal) → soft launch / feedback → Speedrun → later modes.

---

## Recommended PixiJS Stack

Keep the “mini-engine” thin: libraries for map + camera + physics; own code for blob feel and modes.

| Layer | Choice | Role |
|-------|--------|------|
| Language | **TypeScript** | Same as existing projects |
| Renderer | **Pixi.js v8** | Sprites, containers, filters (optional glow) |
| Bundler | **Webpack 5** (chosen) | Vite remains a fine alternative for a greenfield fork |
| Level editor | **[Ogmo 3](https://ogmo-editor-3.github.io/)** | Entity rectangles + point entities; export JSON, convert Y on load |
| Map loader | Custom Zod JSON ([`src/levels/`](../src/levels/)) | `platforms` / `hazards` / `collectibles` / spawn / exit — no tilemap runtime |
| Camera | **[pixi-viewport](https://github.com/pixijs-userland/pixi-viewport)** *or* ~15-line follow | Center on blob, clamp to level bounds |
| Physics | **[Matter.js](https://brm.io/matter-js/)** *or* kinematic AABB + gravity | Static colliders from Ogmo rectangles; blob as controlled body — **do not write a physics engine** |
| Animation / juice | **GSAP** (known) + simple sprite states | Jump squash, collect pop, leaf sway |
| Glow / mystique | Bright sprites + alpha / optional Pixi blur/glow filter | Dim world `ColorMatrix` or dark overlay — **no Light2D** |
| Audio | **@pixi/sound** or Howler | SFX + music; optional Speedrun / ending cues later |
| Input | Pointer + keyboard | Touch primary for Poki mobile |
| Persist | `localStorage` (try/catch for Incognito) | Levels, abilities, firefly/relic totals, crowns, NG+ flag; later best times |
| Platform (later) | Thin adapters for **PokiSDK** / **CrazyGames.SDK** | Behind one `PlatformAds` / `PlatformLifecycle` interface |

### Optional later

| Piece | When |
|-------|------|
| **Rapier 2D** | Only if Matter feels weak with many bodies |
| Skeletal / mesh animation | **Not planned for MVP.** Prefer sprite sheets + manual Pixi `Mesh` deformation. If richer skeletons are ever needed later: **Spine** (paid editor, strong Pixi runtime), **DragonBones** (free/open tooling, thinner ecosystem), **Live2D Cubism** (character-focused, separate license), or stick to DIY mesh. Overkill for a simple blob ball in v1. |
| Phaser | Alternative if you want Arcade physics + scenes bundled — different project shape |

### Suggested runtime layout

```text
app.stage
├─ HUD / UI (fixed screen)
└─ Viewport (camera)
   └─ World
      ├─ BG far (sky, mountains)      parallax ~0–0.2
      ├─ BG mid (clouds, far trees)   parallax ~0.3–0.5
      ├─ BG near (bushes, lake)       parallax ~0.6–0.8
      ├─ Playfield (Ogmo / JSON colliders)
      ├─ Entities (blob, fireflies, hazards)
      └─ Glow FX (additive sprites / filters)
```

Collision shapes and entity spawns come from Ogmo **entity layers**, not from guessing pixels.

---

## Explicit Non-Goals (MVP)

- Custom physics engine  
- Real dynamic lighting / normal maps  
- Post-campaign modes (Speedrun / Puzzle / Survival) before campaign ships  
- 50 levels before first playable vertical slice  
- Online leaderboards on day one  
- Godot feature-parity — use **Ogmo + Matter + viewport** as the substitute toolkit  

---

## Success Criteria

**MVP done when:**

- [ ] Blob feel is fun for 5+ minutes straight  
- [ ] Episodes unlock abilities in a readable order (level 1: crawl → dewdrop jump; early episodes short)  
- [ ] 15–20 levels completable on mobile + desktop via portal threshold  
- [ ] Hub shows ability icons + lifetime fireflies; level select shows X/Y  
- [ ] Glow + dim + parallax sell the “mystic meadow” mood  
- [ ] Build size aimed at web portals (~Poki-friendly if possible)  
- [ ] Can demo in browser without apologizing for missing post-game modes  

**Maximum done when:** full ability kit + gold skin/crowns, ~50 levels, NG+ + soft true ending, Speedrun (+ leaderboards) and later modes feel distinct, portal SDK + store assets ready.

---

## Prototype status (vertical slice)

Shipped in-repo (not full MVP): meadow JSON levels authored in Ogmo (`meadow-01`, `meadow-02`), Matter player (cling, crouch/hide + crouch jump, spikes + death droplets), moving insects (`caterpillar` / `spider` / `mosquito` on `hazards[]` rails — runtime done, not yet placed on the 10 demo levels), fireflies that fill portal rim slots and open the door/vortex, dual parallax, keyboard + touch, **landscape/portrait rotate + odd iframe sizes**, hub UI (Progress / Customize / pause / clear), portal SDK adapters. **Not yet:** blob fly-in into the open portal (deferred), episode gating (start as walk-only), pollen relics, gold fireflies, crowns, NG+, origin/ending beats. Runtime stays Zod-validated JSON; Ogmo is the layout editor. Meadow bleed plates still need re-export.

---

## Playable demo (milestone before MVP)

A smaller milestone than the MVP above: a build worth publishing on itch.io and sending to Poki for publishing approval. Tracked as **stage E** in [`poki.md`](./poki.md) and the README.

**Demo done when:**

- [x] Portal opens on a firefly threshold, with door / vortex art  
- [ ] Portal entry animation before the result modal (**deferred**)  
- [x] Moving enemies exist (caterpillar / spider / mosquito on fixed paths) and share the death pipeline. Remaining: place on demo levels  
- [ ] 10 levels with a readable difficulty curve  
- [x] Touch controls are genuinely playable on a phone (gesture-first, no on-screen buttons). Event-order polish still open — [`poki.md`](./poki.md) Touch follow-ups  
- [ ] Hints teach the mechanics that ship in the demo — spec [`e6-level-hints.md`](./e6-level-hints.md)  
- [x] Outro screen after the last level points at the full version — result modal `demoComplete` (Home / Restart). Celebratory SFX/VFX deferred  
- [ ] Poki submission prerequisites pass (see [`poki.md`](./poki.md))  

Scope differences from the MVP: 10 levels instead of 15–20, no pollen-relic episode gating (most of the kit is available from the start; **flight** is the candidate for the single unlockable / rewarded move), no NG+, no gold fireflies or crowns, no hub meta beyond Progress / Customize. Portrait / rotate / iframe sizes **ship**. Remaining stage F: meadow bleed plates, rewarded help, wider content pass.

---

## Open Decisions

- [x] Collectible fantasy → **fireflies** as settled fairy pollen (v1; can be glowing dots)  
- [x] Camera → follow + clamp to level bounds (lerp polish later if needed)  
- [x] Stickiness → **Matter** static labels (`sticky-wall`) + cling controller (not pure kinematic world)  
- [x] Bundler → **Webpack 5**  
- [x] Level clear → **fairy portal** after firefly threshold (not collect-all)  
- [x] Level authoring → **Ogmo 3** entity layers → Zod JSON (Y flipped on load); Tiled not used  
- [x] Meta progression → **episodes unlock abilities** via **inanimate pollen relics**; hub shows icons + totals  
- [x] Replays keep earned abilities; full clear → **Play from start** with full kit (NG+); relics re-collectable  
- [x] Level 1: wake as crawl-only → on-screen **bouncing dewdrop** → **jump**; early episodes **shorter**, stretch after 2–3 abilities  
- [ ] Demo gating: flight as the only unlockable move (rest available from the start) vs relic-style episode gating — decide before authoring the 10 demo levels  
- [ ] Exact later episode order / relic → ability mapping (stem-spark, wing, …)  
- [ ] How much of the fairy intro to ship in MVP (implied lore vs short cutscene vs full animation)  
- [ ] Do gold fireflies count toward the portal threshold, or optional only?  
- [ ] Portal destination: always next level vs hub with free level select  
- [ ] Launch target first: itch / CrazyGames Basic / Poki submission  

---

## Related Files

| File | Contents |
|------|----------|
| `poki.md` | Poki / CrazyGames technical notes, SDK, physics library overview |
| [`player-mechanics-backlog.md`](./player-mechanics-backlog.md) | Player kit backlog — mechanics + VFX; campaign unlock fantasy lives in this concept |
| [`../README.md`](../README.md) | Current build summary + how to run |
| This file | Game concept, progression, scope min/max, timelines, Pixi stack for *this* title |
