# The Pyramid: plan for Level 1's new goal

Status: **plan, not built yet**. Robert decides design; Claude owns the architecture below
(see [`AGENTS.md`](../AGENTS.md)). Questions and hand-offs go in [`AI-COMMS.md`](AI-COMMS.md).
Numbers marked *(proposed)* are Claude's starting values and go in `src/data.js` so they can be tuned.

## The idea (Robert, 2026-11-03)

- The map is **fixed and finite**, not endless random land.
- The camp grows outward in **squares**. Every square you claim rises out of the ground one level
  lower than the ring inside it, so the base becomes **one big stepped pyramid** with the Central
  Flame on top. **Stairs** sit in the middle of every square edge and lead up to the flame.
- **Central Flame levels unlock new squares.** Growing the walls (Barricade) raises the flame's
  maximum level. The flame and the camp **change look every 5 flame levels**.
- On each square you build **walls, lantern pylons, watchtowers** and a new **barracks**
  (it makes champions or an army; Robert hasn't picked yet).
- **Every 5 nights** huge waves of Drowned Knights attack the squares. Each square they destroy
  **lowers the Central Flame by a level**. Falling too far loses the game.
- When the pyramid covers **80% of the land** (the rest is left for the Drowned to spawn in), the
  **Sunken King fight** starts. This replaces the Fire Bearer march as its trigger. Winning
  unlocks Level 2.
- Squares **replace outposts** (Claude's recommendation; Robert asked, not yet confirmed).

## Open questions for Robert

1. **Losing:** "when it reaches lvl 9 the player loses". Do you mean the flame dropping back to
   level 0 (going out), or a fixed level like 9? *(proposed: you lose when the centre square falls
   or the flame drops to 0.)*
2. **Barracks:** champions (a few strong heroes) or an army (many weak soldiers)? This can wait
   until steps 1–4 are built.
3. **Cliffs:** should the pyramid's step edges block walking, so the Drowned have to use the stairs
   (more tactical, more work), or only look raised? *(proposed: they look raised and the walls you
   build do the blocking. Blocking cliffs can be added later.)*
4. **Is the Fire Bearer (Kindle's escort) removed** entirely, or kept for the walk to the gate after
   the pyramid triggers the fight?

## Layout *(proposed)*

- The land is a **9 × 9 grid of squares**, each **800 px** across (the camp today is 470–690 px).
  The map is 7200 px across, from −3600 to +3600, and the centre square is the camp.
- **Rings**: ring 0 is the camp. Rings 1–4 hold 8, 16, 24 and 32 squares (80 in all).
  The zones follow the rings: ring 1 The Shallows, ring 2 The Mire, ring 3 Drowned Reaches,
  ring 4 The Abyss.
- **Outside the grid**, a dark rim of deep water and Abyss shore closes the world. The Drowned also
  spawn here, and the Drowned Gate stands on the north rim.
- **80% coverage** is 64 of the 80 squares.
- **Pyramid height:** the camp is level 4 *(top)*, ring 1 is 3, ring 2 is 2, ring 3 is 1 and
  ring 4 is 0. A square is drawn raised only once it's claimed.
- **Unlocking:** flame level `L` lets you hold up to `4 × (L − 1)` squares *(proposed)*. You
  claim ring by ring, inner rings first, with the corners and edge-centres (the stair squares)
  of a ring before its fill-in squares. Flame 20 allows 76 squares, which is enough for 80%.
- **The flame's max level** is `4 × Barricade level` *(proposed)*. The Barricade gets more levels
  for this.
- **Look:** new flame and camp art at flame 5, 10, 15 and 20.

## Architecture (Claude decides; GPT proposes changes in the comms log)

- **Fixed map:** the world is already the same every visit for a given difficulty, because it's
  seeded noise. "Prebuilt" therefore means **bounded**. `World` stops generating past the rim, and
  the special places (den, cave, graves, garden, fairy ring, nest, gate) are pinned to named
  squares instead of distances. A later `assets/maps/level1.json` can override single squares by
  hand, without needing a map editor first.
- **New module `src/pyramid.js` (`DL.Pyramid`):** grid maths (`sq(gx, gy)`, `ring`, `height`,
  `isStair`, `worldToSquare`), what can be claimed, claiming, losing, coverage and drawing the
  raised steps (reusing the cliff-face drawing from #148, which is in git history).
  Its numbers live in `DL.PYRAMID` in `src/data.js`.
- **Save:** `G.save.pyramid = { squares: { "gx,gy": { hp, b: { wall, pylon, tower, barracks } } } }`.
  The camp square is implied. Old saves turn each outpost into a claimed square near it, then
  `save.outposts` is dropped.
- **Per-square buildings** reuse the camp's patterns (`Camp.layout` / `Camp.collideWall` take a
  square's centre and size instead of assuming the origin). Costs and HP go in `DL.PYRAMID.build`.
- **Sieges:** `src/siege.js` changes from "every 10th night at the camp" to "every 5th night at
  the outer squares". A square at 0 HP is lost: `Pyramid.lose(gx, gy)` drops the flame one level
  and lowers the square.
- **Finale:** `Finale` starts from `Pyramid.coverage() >= DL.PYRAMID.win` instead of the trophy
  and Kindle checks.
- **Co-op:** the host owns `save.pyramid` and sends claims and losses in snapshots, the same way
  outposts work now.

## Build order and who does what

| Step | What | Who |
|---|---|---|
| 1 | Bounded map: rim, special places pinned to squares, zones by ring | Claude |
| 2 | `src/pyramid.js` core: grid, save, claim/lose, coverage, raised-step drawing, stairs; outposts replaced | Claude |
| 3 | Central Flame levels to 20, max set by Barricade, look change every 5 levels | GPT (Claude reviews) |
| 4 | Per-square buildings: walls, pylons, watchtowers (camp code made reusable in step 2) | GPT |
| 5 | Sieges every 5 nights against squares, square HP, lost squares lower the flame, lose rule | GPT (Claude reviews) |
| 6 | Coverage HUD and the 80% trigger for the Sunken King; Fire Bearer change per question 4 | Claude |
| 7 | Barracks (after Robert picks champions or army) | GPT |
| 8 | Level 2 unlock screen (placeholder until Level 2 exists) | GPT |

Steps 1–2 must land first because everything else builds on them. After that, steps 3, 4 and 5
touch different files and can run side by side.

## Art needed (prompts to be written per piece)

- Raised square: stone step faces in four directions, plus a top-edge lip (tileable).
- Stairs: one flight, drawn facing south, east, west and north.
- Claimed-square marker (a small brazier or banner).
- Barracks, three levels.
- Central Flame looks at levels 5, 10, 15 and 20.
- The rim: deep water edge, Abyss shore.
