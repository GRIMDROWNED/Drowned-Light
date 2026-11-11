# The Refuge: a 20-level fortress in place of the square grid

> **2026-11-10: the compact base replaces this by default.** Robert found the fortress too big to walk. The base now stays
> a small walled town (half-side 470 at tier 0 to 630 at tier 8) that is **rebuilt in place** each time a dungeon's boss
> falls: base tier = dungeons cleared (`DL.Base`, `DL.BASE`). Each tier sets the outer wall's size and drawn look
> (Robert's T2-T7 terrace pictures), adds side stairs from tier 3 and lit pieces, and raises the Central Flame's cap
> (5, 7, 9 ... 20). All buildings get fixed plots per tier. The Portal Hall (the Spark Bearer's portal room door) has
> reserved ground at the end of the north avenue, with a stair either side of it. The pause switch cycles
> Compact / Old fortress / Squares; everything below describes the old fortress (`save.up.fortress` 2).
>
> **Monument ring (2026-11-11):** eight plinths round the sanctum (`L.monuments`, `DL.BASE.monuments`), one per Portal
> Hall portal, clockwise from the north-east. Plinth i lights once `save.up.tier > i` (portals open in order), in the
> colour of `DL.FINALE.portals[i]` (fallback list in `DL.BASE.monuments`). Coded stand-ins (`Refuge.drawMonument`) until
> Robert's pictures (`art-prompts/base-monument-prompts.md`).

Status: **built on a branch for Robert to try (v0.15.203)**. Robert asked for it 2026-11-03 and chose that the fortress
**replaces the whole square grid** (he may switch to "replaces only the camp" later). Target look: Robert's concept
(`/mnt/project-files/refuge/fortress-concept-L20.png`) and his 20-stage sheet (`build-stages-1-20.png`).

## Turning it off

- **In the game:** pause menu → **Refuge: Fortress / Squares**. Host only. It flips `save.up.fortress` (missing or 1 =
  fortress, 0 = the old squares). Nothing is deleted: held squares, their buildings and HP stay in
  `save.pyramid.sq` and come back when switched to Squares.
- **In the code:** revert the PR. Main before this work is v0.15.202, commit `a07545a`.

## What it does

- The **refuge level is the Central Flame level** (1–20). Each level changes the fortress (table below). Losing flame
  levels in a siege shrinks it again.
- The Central Flame stays at (0, 0). The camp's half-side `DL.WALL_R` is the outermost wall: 420 (levels 1–4),
  500 (5–6), 580 (7), 880 (8–10), 1120 (11–13), 1350 (14–16), 1600 (17–19), 1860 (20). Widened 2026-11-04 so every
  building's biggest drawn picture has room (see "Placement" below).
- **Terraces:** nested square walls, each one level of drop (46 px face hanging below its south edge), drawn with
  Robert's terrace picture (see "Drawn kit" below). They are **solid**; only stairs pass. Sanctum (flame platform) from
  level 4, district terrace from 6, outer terrace from 11.
- **Stairs:** every wall has a central stair on each side (an avenue runs through all of them). The district terrace
  gets two more per side at level 9, the outer terrace two more per side at level 15: **12 stairs round the outside at
  level 20** (3 per side, the middle one widest). Every stair joins two walkable levels (checked in
  `tools/test_refuge.cjs`).
- **Square grid off:** squares can't be claimed, the grid's raised steps and slow-climb edges are gone, and world
  nodes under the fortress are hidden. Map size, zones and special places are unchanged.
- **Win:** Central Flame 20 (the completed refuge) wakes the Drowned Gate, in place of 80% of the land.
- **Sieges:** every 10th night as before, but there are no squares, so they come for the camp (the existing
  "no squares left" path in `src/siege.js`). A snuffed flame still costs a level; 0 still loses the world.
- **Barracks:** the refuge has its own barracks (level 1 at refuge 5, 2 at 12, 3 at 17, Robert's barracks1–3 art).
  It trains champions with the existing champion code (they guard the whole refuge).
- **Barricade:** stakes and palisade now stand along the outermost wall, broken at every stair. Its gates are the
  stairs. Levels 4–5 no longer push the walls out (the refuge level does that).

## The 20 levels (`DL.REFUGE.levels` in `src/data.js`)

| Lv | Name | What appears |
|---|---|---|
| 1 | First Flame | Hearth on a stone foundation, dashed camp edge |
| 2 | Survivor Camp | Two tents, a supply pile, avenues to the four sides |
| 3 | Fortified Camp | Low stone walls with four openings; the camp is paved |
| 4 | First Terrace | Raised sanctum round the flame with four stairs |
| 5 | Barracks | Barracks (level 1, trains champions); flame look 5 |
| 6 | Expanded Terrace | District terrace, half-side 300, four central stairs |
| 7 | Resource Yards | Storehouse, Salvage Yard, Training Grounds (placeholders) |
| 8 | Reinforced Walls | Corner bastions on the outermost wall |
| 9 | Secondary Access | Two side stairs on every side of the district terrace |
| 10 | Inner Ring | Sanctum 150 with coping, terrace 340, four banners; flame look 10 |
| 11 | Outer Terrace | Outer terrace, half-side 490, central stairs |
| 12 | Defensive Expansion | Braziers on the district terrace corners; barracks level 2 |
| 13 | Resource Network | Alchemy Station (placeholder), torches along the avenues |
| 14 | Living Quarters | Survivor Quarters (placeholder), two more tents |
| 15 | Great Stairways | Two side stairs on every outer side, wider central stairs; flame look 15 |
| 16 | Upper Works | Expedition Lodge, Research Archive (placeholders) |
| 17 | Champion Wing | Barracks level 3 |
| 18 | Outer Ring | Outer terrace grows to 540 |
| 19 | Final Reinforcement | Torches at every stair, star inlay round the flame |
| 20 | Completed Refuge | Summoning Circle (placeholder), four beacons round the sanctum; flame look 20 |

## Buildings and districts

Ids, costs, unlocks, familiar homes and boss trophies are untouched (`DL.UPGRADES`). Only where they stand changed.
Each has a hand-placed spot at level 20 (`DL.REFUGE.items`). At lower levels the spot is scaled in and a fixed search
moves it to the nearest free ground in its quarter, away from avenues, stair landings, towers and other buildings.
Positions depend only on the levels in `save.up`, so co-op peers see the same refuge.

| District | Existing structures (id) | Refuge structures |
|---|---|---|
| North-west: military and crafting | Forge (`forge`), Armory (`armory`), Workbench (`workbench`) | Training Grounds, Alchemy Station |
| North-east: champions and operations | | Barracks, tents (survivor camp), supply pile, Storehouse, Survivor Quarters, Expedition Lodge |
| South-west: familiars and cultivation | Cultivation Plot (`garden`), Bone Kennel (`kennel`), Soul Shrine (`shrine`), Toadstool Cottage (`toadstool`), Derek's Workshop (`workshop`), Wyvern Roost (`roost`) | Salvage Yard |
| South-east: boss rewards | Starved Bell Tower (`bell`), Rose Heart (`roseheart`) | Research Archive, Summoning Circle |
| Centre | Central Flame, banners, Watchtowers (`tower`, outer corners), Lantern Pylons (`pylon`, beside the central stairs) | Beacons, braziers |

- An existing building not yet built gets an **empty kerbed plot with no name** (secrecy rule: nothing says what goes
  there).
- A built building always stands, even if the refuge is too small for it yet (it squeezes in at its scaled spot).
  With every building built (sandbox), levels 1–9 are crowded; normal play has far fewer buildings that early.
- A refuge structure that finds no room waits for a bigger level. In normal play none do. With every building built
  (sandbox) the Salvage Yard waits from level 7 to 11. At levels 14–17 the outer band is narrow, so the Survivor
  Quarters may stand just south of the east avenue until the outer ring grows at 18.

## Save migration

- `save.up.fortress` is new. Missing (every old save) = fortress on. New games write `fortress: 1`.
- `save.pyramid.sq` is kept untouched in fortress mode, so switching to Squares restores the held squares.
- Nothing else in the save changed. Co-op: `up` is already in every snapshot, so guests follow the host's switch.

## Code

- `src/refuge.js` (`DL.Refuge`): geometry (`geo`, `blockers`, `wallBoxes`, `stairEnds`), `collide`, `route`,
  `layout`, ground drawing, placeholders. Numbers in `DL.REFUGE` (`src/data.js`).
- `src/camp.js`: `sync`, `layout`, `walled`, `collideWall`, `route` hand over to the Refuge when it's on.
- `src/pyramid.js`: no claiming, no grid drawing or climbing, nodes hidden under the fortress, the refuge's barracks
  champions (square `0,0`); `art`, `strip`, `lane` exported for the terraces.
- `src/render.js`: `pushRefuge` (barracks, placeholders, fires, palisade broken at the stairs).
- Also: `src/game.js` (lights, flame toast, wider camp collision range), `src/hounds.js` (hound routes by the
  stairs), `src/world.js` (no water under the fortress), `src/finale.js`, `src/siege.js`, `src/ui.js` (switch, HUD,
  help text), `index.html`, `sw.js`.

## Drawn kit (Robert's four pictures, 2026-11-03)

Robert's pictures are in `/mnt/project-files/refuge/returned/` and cut by `tools/cut_refuge.py` into
`assets/sprites/refuge/` (pieces keep their source crop boxes; `KIT` in `src/refuge.js` mirrors them, 0.3 world px per
source px):

- `foundation.png` (L1): the hearth's stone base, levels 1–3.
- `plaza.png` (L2): the bordered plaza round the hearth at levels 2–3, and the stone plot under every building.
- `low-*.png` (L3): the low walls, corners plus tiling runs, cut open at the four openings.
- `tier-*.png` and `rim-*.png` (L7-tall-tier, 2026-11-04; replaced L5-two-tier): the sanctum uses the tall inner terrace (`tier`), the outer
  terrace the outer wall ring (`rim`).
- `terrace-*.png` (L4): the district terrace (and any ring without its own kit): corners, tiling edge runs, the four stairs
  (stretched only along the treads to each stair's width) and `terrace-floor.png`, the terrace paving.

All pieces are recoloured to the grey stone of `L6-two-tier-grey.png` (Robert chose grey everywhere, 2026-11-04;
the cutter maps each picture onto the grey palette by brightness). Nothing is flipped or stretched as a whole building. Missing pieces fall back to the coded flagstones and faces.

## Art manifest

Reused now: Robert's refuge kit above, avenue `pyramid/stairway-lane.png` (north–south), flagstones `campFlags` / `campPaving`, every camp building, barracks1–3, tents, banners,
braziers, torches, palisade, towers, pylons, flame looks.

Needed (prompts in `/mnt/project-files/art-prompts/refuge-prompts.md`; until then a hatched plot with the
name shows, which is the placeholder):

| Piece | Key / file to add | Size (world px) |
|---|---|---|
| Training Grounds | `refugeTraining` | ~80 × 76 |
| Alchemy Station | `refugeAlchemy` | ~60 × 60 |
| Storehouse | `refugeStorehouse` | ~72 × 70 |
| Salvage Yard | `refugeSalvage` | ~72 × 70 |
| Survivor Quarters | `refugeQuarters` | ~80 × 76 |
| Expedition Lodge | `refugeLodge` | ~76 × 72 |
| Research Archive | `refugeArchive` | ~76 × 72 |
| Summoning Circle | `refugeCircle` | ~88 × 84 |
| East/west avenue (treads running left-right) | `pyramid/avenue-east.png` | strip, 112 px tall |
| Corner bastion | `refugeBastion` | 48 × 48 + height |
| Wall coping / battlement strip | `pyramid/coping-*.png` | strips |
| Beacon brazier (sanctum corners) | `refugeBeacon` | ~30 × 60 |

## Unresolved

- Balance: the refuge is bigger than the old camp, so a night at the camp covers more ground. Untested in play.
- Co-op on two devices is untested (the switch and layout travel in `up`; champions are host-run as before).
- Real gamepad untested for the new pause button (it is a plain menu button like Zoom).
- Kindle travel between squares has nothing to travel to in fortress mode (only the gate at the end).
- The E/W avenues are a plain paved road with kerbs for now; an east–west stair strip would look better.
- If Robert later picks "fortress replaces only the camp", the grid comes back around a refuge capped at the centre
  square; the code for both is already here.

## What the upper works do (Robert's picks, 2026-11-04; `src/works.js`, numbers in `DL.WORKS`)

| Work | Refuge level | Effect |
|---|---|---|
| Alchemy Station | 13 | Each dawn brews a lantern-oil flask from 4 resin (holds 3). An empty lantern away from the fire drinks one. |
| Survivor Quarters | 14 | Each dawn survivors bring 6 wood, 6 stone, 2 iron. On siege nights they mend the Central Flame and pylons. |
| Expedition Lodge | 16 | An expedition leaves at dusk and returns at dawn with 2-4 amethyst, 2-5 iron, 35% a Black Pearl. |
| Research Archive | 16 | Each boss slain (recorded in `save.archive`) gives +10% damage against that boss and its kin (`DL.WORKS.archive.kin`, empty until new enemy types are made for each boss). |
| Summoning Circle | 20 | Two familiars can walk with you at once. |

**Familiars, one at a time** (Robert, 2026-11-04): a knight brings one familiar (two with the Summoning Circle), chosen with
**Bring along** on its Kit card (`save.fams`). A familiar just won comes along at once. Homes can still be built and
levelled for their effects. Co-op guests' familiars are not limited yet.

## Placement (2026-11-04)

Robert asked that no building cover a wall or anything else. `Refuge.PIC` (src/refuge.js) holds each drawn
building's biggest picture (half-width, height above the plinth's front edge), measured from
assets/sprites/refuge/b-*.png; re-measure it when art changes. The placer keeps that whole picture clear of terrace
walls and faces, stairs, avenues, watchtowers, gate pylons, fires and marsh beds, so a building never moves as it
levels up. tools/test_refuge.cjs fails if any built building lacks room from level 5 on. Before the Inner Court
(levels 1-4) only the early buildings are expected; a sandbox with every building built crowds there.

## The yards (Robert's picks, 2026-11-04; src/works.js, DL.WORKS)

- Storehouse (refuge 7): when you fall, half of each carried resource goes safely to the stash (shown on the death screen).
- Salvage Yard (7): a converter card on the camp's Build tab (4 wood -> 3 stone, 4 stone -> 3 wood, 5 wood -> 2 resin,
  5 stone -> 2 iron, 10 iron -> 1 amethyst).
- Training Grounds (7): drilled champions, health and damage x1.25.
- Supply Pile (2): at dusk, a torch (up to your satchel) and a quarter of your lantern's oil.

## Barracks posts (Robert, 2026-11-04)

From Flame 5 the refuge has a barracks beside every stair of its outermost wall (4, then 12 once side stairs open),
inside the wall, moving out as each new terrace rises (`L.posts` in Refuge.layout; the old single district barracks
is gone). Each post trains its own champions (count, training time and strength from DL.PYRAMID.champion at the
refuge's barracks level 1/2/3), who hold their stair within `defend` px and close in round the flame. A camp
champion's slot is post * 4 + n (src/pyramid.js). Terraces were widened again so every post fits.
