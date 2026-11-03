# The Pyramid: plan for Level 1's new goal

Status: **steps 1–7 built** (Robert answered the open questions 2026-11-03); step 8 is next. Robert decides design; Claude owns the architecture below
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
  **lowers the Central Flame by a level**. If the flame drops to 0, you lose.
- When the pyramid covers **80% of the land** (the rest is left for the Drowned to spawn in), the
  **Sunken King fight** starts. This replaces the Fire Bearer march as its trigger. Winning
  unlocks Level 2.
- Squares **replace outposts** (Claude's recommendation; Robert asked, not yet confirmed).

## Robert's answers (2026-11-03)

1. **Losing:** the player loses when the Central Flame drops to **0**.
2. **Barracks:** makes **champions** for now (it may become an army later).
3. **Pyramid edges:** the Drowned can **climb** the step edges, but it **slows them down**. On the
   **stairs** they walk at full speed. Knights take the stairs too *(proposed: knights climb
   edges slowly as well)*.
4. **Fire Bearer:** left to Claude. **Decision: the escort march is cut. Kindle stays as the
   Fire Bearer in the fight itself.** At 80% coverage the Bearer rises at the top of the pyramid,
   and the next day the host can set out with it straight to the gate on the north rim, which by
   then is next to your outer squares. The Sunken King still needs the Bearer's flame to open his
   heart, so his fight and its art stay as they are. The long walk, the night camps and falling
   back to the last camp are removed. Why: after covering 80% of the map, a slow escort across
   ground you already own is busywork. The fight is the payoff.

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
- **Layout (Robert's sketch, 2026-11-03, v0.15.189):** the land builds out as **four quarters**,
  each level an L wrapped round the last, split by a **cross of long stairways** running from the
  camp's four gates down to the marsh along the `gx = 0` and `gy = 0` lines. **Only the cross has
  stairs**; every other step edge is a solid face (climbed slowly). The stairways are paved lanes
  `stairW` wide (coded) with the drawn flights at each drop, and nothing spawns on them.
  `Pyramid.axis(gx, gy, dx)` says whether an edge has stairs.
- **Paving (Robert, 2026-11-03, v0.15.192):** a held square (not the camp's) is paved with the camp
  flagstones, and its resources grow only in three kerbed square **marsh beds** (`DL.PYRAMID.beds`;
  the south-west corner is left for the barracks). The world's own nodes there are hidden
  (`Pyramid.hides`, filtered in `World.near`); each bed has its own nodes (`o.bed`), seen once
  the square is held. Knights aren't slowed by water under the paving (`Pyramid.paved`).
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
- **Climbing:** a walker crossing a step edge off the cross's stairs moves at `DL.PYRAMID.climb` speed *(proposed 0.35)*, and gets full speed on a stair. This goes in `Pyramid.speedMult(ent)` and is called by the knight and Drowned movement in `src/game.js`.
- **Sieges:** `src/siege.js` changes from "every 10th night at the camp" to "every 5th night at
  the outer squares". A square at 0 HP is lost: `Pyramid.lose(gx, gy)` drops the flame one level
  and lowers the square. Flame 0 is game over (`DL.SIEGE.gameOver` turns on for this).
- **Finale:** `Finale` starts from `Pyramid.coverage() >= DL.PYRAMID.win` instead of the trophy
  and Kindle checks.
- **Co-op:** the host owns `save.pyramid` and sends claims and losses in snapshots, the same way
  outposts work now.

## Build order and who does what

| Step | What | Who |
|---|---|---|
| 1 | Bounded map: rim, special places pinned to squares, zones by ring (**done**, v0.15.170: `DL.MAP`, `World.GRID/EDGE/beyond`, zones use `Camp.sq`, special places placed with `Camp.onSquare`) | Claude |
| 2 | `src/pyramid.js` core: grid, save, claim/lose, coverage, raised-step drawing, stairs, climbing; outposts replaced (**done**, v0.15.171; see the API below) | Claude |
| 3 | Central Flame levels to 20, max set by Barricade, look change every 5 levels | GPT (Claude reviews) |
| 4 | Per-square buildings: walls, pylons, watchtowers (camp code made reusable in step 2) | GPT |
| 5 | Sieges every 5 nights against squares, square HP, lost squares lower the flame, lose rule | GPT (Claude reviews) |
| 6 | Coverage HUD, the 80% trigger for the Sunken King, cutting the escort march (answer 4) (**done**, v0.15.177: `Finale.ready` uses coverage, `Finale.begin` sends the Bearer to the hearth, gate travel destination) | Claude |
| 7 | Barracks that makes champions | GPT |
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

## Step 2 API (`src/pyramid.js`, built 2026-11-03)

Grid: `Pyramid.cell(x, y)` → `{gx, gy}`, `center(gx, gy)`, `ring(gx, gy)`, `inGrid`, `has(gx, gy)`,
`each(fn(gx, gy))` (the camp `0,0` included), `count()` (held squares, not counting the camp), `total()` (80),
`coverage()` (0–1), `limit()` (`perFlame × (flame − 1)`), `height(gx, gy)` (flame level − ring, held only).
Claiming: `claimable(x, y)`, `cost(gx, gy)`, `lock(gx, gy)`, `claimHost(gx, gy, mine)`. Losing: `lose(gx, gy)`
(sinks the square; **step 5 must also drop the Central Flame a level there and check flame 0 = game over**).
Movement: `speedMult(ent)` (already applied to the knight's walk and to every walking Drowned in `src/game.js`).
Drawing: `update(dt)` (called from `Outposts.update`), `drawGround(c, view)` (called from `src/render.js`).
Text: `line()`.

Save: `G.save.pyramid.sq = { "gx,gy": 1 }`. Step 5 can widen the value to an object, for example
`{ hp, b: {...} }`. Keep `1` meaning "held" for old saves.

Each held square's fire lives in `G.outposts` (`src/outposts.js`: `{gx, gy, x, y, hp, max, lit}`), which handles
storing supplies, travel, light, the Drowned targeting it, and co-op rows. A friend's device learns the held
squares from those rows (`Outposts.apply` → `Pyramid.setHeld`).

Not done yet:
- The Drowned don't path to the stairways of the cross. They climb straight over, which is slow.
- Trees and rocks can still stand on a rock face.
- Robert's stone faces are in (v0.15.178, `assets/sprites/pyramid/step-*.png`, cut by `tools/cut_pyramid.py`). Stairs, markers, barracks, flame looks and the rim are still coded placeholders.
