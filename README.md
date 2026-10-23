# Drowned Light

**Will you thrive in the light or drown in the darkness?**

A top-down dark-fantasy survival game for the browser and phones. You are a lantern-bearing knight. By day you range out from your base camp to gather supplies. By night the darkness corrupts anyone outside the light, and the Drowned Knights (knights it has already claimed) come for you and your fire.

## Play

- **Online:** enable GitHub Pages for this repo (Settings → Pages → deploy from `main`, root). Then open the Pages URL on desktop or phone.
- **Install it as an app:** on the Pages site, Chrome on desktop shows an install icon in the address bar (or ⋮ → *Cast, save and share* → *Install page as app*). Chrome on Android offers ⋮ → *Add to Home screen* / *Install app*. It launches full screen with its own icon and also starts offline. On iPhone, use Safari → Share → *Add to Home Screen*.
- **Locally:** run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.
  Opening `index.html` directly also works. Chrome blocks pixel access on `file://`, though, so the Drowned recolouring falls back to a simpler tint.

### Controls

| | Desktop | Phone |
|---|---|---|
| Move | WASD / arrows | Drag anywhere on the left half |
| Attack (auto mode) | automatic: the nearest Drowned, or a supply node you stand beside | automatic |
| Attack (manual mode) | hold **J** / **K** or the left mouse button; aim with the mouse | hold **ATTACK** to strike the way you face; **drag on it to aim** any direction (e.g. strike back while retreating). Leans toward nearby foes |
| Mine (manual mode) | hold **G** or the right mouse button | hold **MINE** (lights up when supplies are in reach) |
| Dash | Space / Shift | DASH |
| Kit ability | E / Q | ability button |
| Place torch | F / T | TORCH |
| Camp menu | C (at camp) | ENTER CAMP |
| Pause | Esc / P | ❚❚ |
| View | title or pause screen → **View: Auto / Portrait / Landscape** | same |

## The core loop

1. **Day: venture out.** Chop down trees for wood, and gather stone, bloom resin and iron scrap. Felled trees and mined supplies grow back at dawn. Rings of land get darker and richer the farther you go: *The Shallows → The Mire → Drowned Reaches → The Abyss*.
2. **Night: stay in the light.** Outside light, **corruption** rises. It has four visible stages, and at 100% you become a Drowned Knight.
   - **Firelight** (camp, torches, Illuminate) *reverses* corruption, heals you and refills your lantern.
   - **Bloomlight** (Refuge Blooms, Sentinel Blooms, Mother Roots) only *halts* it. Blooms wake at night, and the Drowned come to tear them down. Refuge and Sentinel Blooms grow only in **groves**: a clearing of 2 to 7 blooms plus a few bloom sprouts, at most one per 1280 px cell of a grid and at least 800 px from the next, so the land between groves is dark. Pick a grove before dusk and hold it (`DL.GROVE` in `src/data.js`, `World.grove` in `src/world.js`).
   - **Lantern oil** halves corruption in the dark until it runs dry.
3. **Return and build.** Supplies you carry are stored automatically when you reach camp. Spend them on camp structures or on training your kit.
4. **Defend.** If you're at camp at night, waves march on the Central Flame. If it goes out, your home goes dark until dawn.

### The base camp
The camp grows through three tiers as the Central Flame levels up:
- **Tier I, A Place to Rest** (Flame 1–2): a stone fire ring, a tent and a banner.
- **Tier II, A Growing Bastion** (Flame 3–4): a raised fire pit, a flagstone plaza, boardwalks to the gates and more tents.
- **Tier III, A Beacon in the Marsh** (Flame 5): an iron beacon brazier, more banners, and boardwalks running out over the marsh.

| Structure | What it does |
|---|---|
| Central Flame | Camp light radius and flame strength; unlocks higher levels of everything else |
| Forge | Weapon damage |
| Armory | Max health |
| Workbench | Lantern oil, torch satchel size, torch burn time |
| Cultivation Plot | Grows Bloom Resin, stored at every dawn |
| Watchtowers | Crossbow towers that shoot the Drowned at night |
| Lantern Pylons | Firelight posts on the perimeter. They slow the Drowned and are hunted by Lantern Reavers, then relit at dawn |
| Barricade & Gate | Level 1 is a stake ring. Level 2 is a palisade with four gates, so the Drowned must path through them and take stake damage. Level 3 reinforces it with gate lanterns and spikes |

### High-risk reasons to leave the light
- **Amethyst** deposits glow purple in the Drowned Reaches and the Abyss, farther out than iron, and stay day and night like the other supplies. You need them for top-tier upgrades.
- **Torches** you plant burn out, and Lantern Reavers snuff them out.
- **Mother Roots**: defend one until dawn for a big reward.
- **Your drowned self**: when you fall, a Drowned version of you keeps everything you carried. Kill it to get your supplies back. If you die again first, they're gone.

### Save slots
There are three save files (title screen → **Saves**). Each keeps its own camp, kit, difficulty and day. **Continue** resumes the current slot. A save from before slots existed becomes slot 1.

### Starting a game: kit, difficulty and combat
A new game asks you to choose a **kit**, a **difficulty** and a **combat mode** (Auto-attack or Manual attack). The kit and difficulty stay fixed for that save. The combat mode can be switched any time from the pause menu.

### Co-op (online, up to 4 players)
Title screen → **Play with a friend**.
- **Host:** needs a game of their own. **Host my world** opens a room with a 5-character code. Share the code, then **Start playing**. The friend can join any time.
- **Join:** pick the kit you'll bring (any of the five), type the code, and you play in the host's world: their camp, difficulty, day and stash. The kit joins at its co-op level, or your best level for it in your own saves. Kit levels you train in co-op are kept on your device for your next co-op game. Your own saves never change.

What's shared:
- The Drowned hunt whichever knight is nearer, and night waves also turn up near a friend who wanders off.
- Supplies the guest mines or picks up are theirs to carry, and go into the host's stash when they reach camp.
- Lights, torches and Flame Bastion walls the guest raises are real for both players.

**At camp:**
- Both players can build and train from the shared stash; the host's device approves each purchase.
- Only the host can rest until dusk.
- The world keeps running while either player is in the camp menu (you just stand still).

**Pausing:** the host's pause freezes the game for both players, and the guest sees "Paused by the host". The guest's pause menu doesn't stop the world.

**Finding each other:** a compass line and an arrow at the screen edge point to your friend.

**Falling and leaving:** a guest who falls rises again at camp a few seconds later and loses what they carried; there's no drowned self for guests. Leave from the pause menu.

**How it works:** the host's device runs the world and sends snapshots about 15 times a second. A snapshot holds only what's near the guest, and a beat is skipped when the connection is backed up. The guest's device runs its own knight and reports hits, mining and deposits (`src/net.js`). The free public PeerJS server introduces the two devices, and the game data then goes directly between them over WebRTC. The PeerJS library is loaded only when co-op is used, so solo play still works offline. Some strict networks (schools, offices, some mobile carriers) block direct connections.

### Mining
Supply nodes take several hits to break: trees 5, boulders 6, iron 5, bloom sprouts 2, amethyst 4. Each strike shakes and cracks the node and throws chips. The last strike shatters it into pieces of its sprite, and the supplies spill out as pickups that fly to you. In auto mode the knight mines a node you stand beside whenever no Drowned are in reach. In manual mode mining has its own control (Mine / G / right-click), so Attack never mines by mistake.

### View
**Auto** follows the device. **Portrait** and **Landscape** lock the screen rotation in the installed app. Where a lock isn't possible:
- a phone held the other way turns the whole game 90°;
- a desktop window shows a portrait or landscape play area with dark bars.

The setting is remembered on that device.

**Kits** (following the Kit 01 and Base Kits 02–05 concept sheets):

| Kit | Attack | Dash | Ability | Special |
|---|---|---|---|---|
| **01 Lantern Blade**: *A light still endures.* | Blade Arc (fast sword arcs) | Lantern Strike (damages what you pass through) | **Illuminate**: firelight burst and sanctuary | **Lantern Strike**: the damaging dash |
| **02 Pike Warden**: *Reach keeps the dark away.* | Pike Thrust (hits everything along a line, strong knockback) | plain | **Warding Sweep**: full-circle sweep, knocks arrows from the air, halves damage taken briefly | **Stable Form**: standing still, take 25% less damage, no knockback, thrusts +15% |
| **03 Ashen Arbalist**: *Quiet light. Farther truths.* | Piercing Bolt (long-range crossbow) | plain | **Scatter Shot**: a fan of bolts; light flares where they land | **Quiet Light**: bolts deal up to +35% damage the farther they fly |
| **04 Relic Bearer**: *Lost things still shine.* | Relic Orb (seeking orbs) | plain | **Beacon Pulse**: lights the area, purges corruption, slows the Drowned, dispels arrows | wider lantern, slower oil burn |
| **05 Flame Bastion**: *Some light burns brighter.* | Bastion Blade (heavy sword) | Shield Slam (staggers) | **Flame Bastion**: a wall of fire that blocks and burns | shield blocks 25% of damage |

**Kit levels 1–20** are trained at camp (Base Camp → **Kit**) with iron, resin and, from level 10, pearls. Every level adds +5% damage and a slightly faster ability.

**Pacing.** Three levers slow progress down evenly (all in `src/data.js`):
- `COST_SCALE` (2): multiplies every building and kit-level price.
- `FLAME_NIGHTS`: the Central Flame needs 1 / 3 / 6 / 10 nights survived for levels 2 / 3 / 4 / 5. Every other building's levels depend on the Flame.
- `KIT_BANDS`: kit levels are locked behind camp structures:

  | Kit levels | Needs |
  |---|---|
  | 2–5 | Forge 1 |
  | 6–10 | Forge 2, Central Flame 3 |
  | 11–15 | Forge 3, Armory 2, Central Flame 4 |
  | 16–20 | Forge 4, Armory 3, Central Flame 5 |

Levels **5, 10, 15 and 20** are milestones. Each one unlocks a new mechanic for that kit (see the Kit tab or `src/data.js`) and a visible change:
- **5:** the weapon glows.
- **10:** embers drift from the knight.
- **15:** a ring of light at the knight's feet.
- **20:** a crest of light above the hood.

Reaching a milestone triggers a pillar of the kit's light.

**Bone Hound:** an ally won at the **Bone Wolf den**, a unique lair out in the Mire (about 1750 px from camp; the Kit tab and the field guide say which way). Five Bone Wolves sleep at its mouth by day and by night: they wake when you come within 240 px, run home and heal if you get 560 px from the den, and the whole pack gathers again if everyone leaves before it's broken. Kill all five, walk over a carcass to haul it (you move at 85% speed), and carry it into the camp: it rises as your Bone Hound. In co-op every knight hauls their own (a carcass goes back to the den if its hauler falls or leaves), and a hound won anywhere comes along when you join a friend. The den fills again at the dawn after its last carcass is taken. One hound per knight. It hunts in order: any Drowned that retreats (Mire Stalkers, anything backing away), then anything that shoots (Tide Archers, Hexbearers), then whatever is nearest. Retreating and shooting prey is chased up to 480 px from its knight, the rest within 320. It bites, hops clear and comes again, but stays on the heels of prey that runs. It goes through the palisade by the gates, lining up first and then running straight through. Each bite (6 damage) adds a stack of bleeding, 2.5 damage a second for 4 seconds that ignores armour, up to 3 stacks. It has 80 health, heals in firelight, and some Drowned turn on it. It never dies: beaten down, it lies knocked out for 20 seconds, then gets up whole. Its health and bite grow 15% per Central Flame level after 2. Numbers: `DL.HOUND` and `DL.DEN` in `src/data.js`.

**Derek:** a stone golem familiar won in Derek's Hollow (below). One per knight. He can't be hurt and doesn't fight. He follows his knight, and every 9 seconds, when a Drowned comes within 300 px, he raises a stone wall 76 px long across its path, between it and his knight. Any Drowned within 230 px of a wall goes for the wall instead of the knight, walls are solid to the Drowned, and arrows and orbs stop on them. Each blow or shot is one hit, and two hits break a wall. A wall crumbles on its own after 20 seconds, and at most 2 stand for each Derek. He stands about 3/8 of the knight's height. Numbers are in `DL.GOLEM` (src/data.js).

**Derek's Hollow:** a unique cave mouth in the Mire, 175 m north-east of camp. Its stones part only at night. Walk into the mouth and every knight in the game is pulled down into the Hollow, a round cave arena lit by bloomlight crystals, and Derek wakes beside each knight who doesn't have him yet. Seven waves pour out of the tunnels, each led by a kind of Drowned not met yet (Wretches, Mire Stalkers, Tide Archers, Revenants, Lantern Reavers, Hexbearers, Bone Bulwarks) with the earlier kinds mixed in. The world clock stops while you're below. A knight who falls there is only down: clearing a wave heals everyone by a quarter and raises the fallen at half health. Clear all seven and everyone who was there keeps their Derek (a friend's is remembered on their device and rejoins them in any co-op game). If every knight is down at once, the Hollow casts you out at the mouth with a third of your health and stays sealed until the next night. Numbers are in `DL.CAVE` (src/data.js).

**Kindle:** a walking lantern on four spider legs, and every knight lights their own. A broken lantern lies cold out in the Mire, about 1450 px from camp where the iron starts (the field guide says which way once you've found it). Walk up to it with torches in your satchel and it takes them one at a time; seven light your Kindle for good, and from then on he follows you. In co-op each knight feeds their own seven (the broken lantern stays there for whoever hasn't lit theirs yet), and a Kindle a friend lit comes along into other worlds, like a hound. His light is only a lantern's glow: it doesn't hold off corruption. When his knight's lantern is below half, he fills its oil (at most once every 50 seconds) without touching the corruption they carry; he never fills anyone else's. Every third night after the world's first Kindle was lit, at dawn, they all pick the same unique place (one the host hasn't found yet first, then the one shown least), the Bone Wolf den or Derek's cave, and each runs out ahead of its knight with a trail of embers until that knight gets there. New places only need an entry in `Kindle.sites` (src/kindle.js). Numbers: `DL.KINDLE` in `src/data.js`. He is drawn from the art sheets (`assets/sprites/kindle/`, cut at res 4, 32 px tall with his ring): he pours when he fills your lantern, points the way while he waits for you, and lies broken on his side until lit; the coded stand-in remains as a fallback.

**Difficulties:**

| | Supplies | The Drowned | Light |
|---|---|---|---|
| **Dim** | plentiful (×1.35 yield) | weaker (×0.7 health, ×0.65 damage), fewer | blooms ×1.6, firelight +15%, corruption ×0.65, softer nights |
| **Dark** | standard | standard | standard |
| **Pitch Black** | scarcer (×0.8) | ×1.35 health, ×1.25 damage, more of them | blooms ×0.65, firelight −12%, corruption ×1.3, dimmer days |
| **Abyss** | scarce (×0.65) | ×1.75 health, ×1.5 damage, many more | blooms ×0.4, firelight −22%, corruption ×1.65, dim days; the Mire and deeper corrupt even by day |

### The Drowned
Every enemy telegraphs its attack with a cyan wind-up, so you can dash out of the way.
- **Mire Stalker**: fast and frail. Weaves from side to side, leaps in to strike, then falls back and comes again.
- **Drowned Wretch**: the common melee Drowned. Each hit also adds 4% corruption.
- **Tide Archer**: keeps its distance. Every other shot is a spread of three arrows.
- **Swarming Revenant**: claws up out of the ground and closes in from all sides.
- **Lantern Reaver**: hunts light sources, and torches near it burn down five times as fast. Leaps at you when close.
- **Bone Bulwark**: armoured tank. Its shield blocks 70% of blows from the front, Drowned near it take 25% less damage, and it braces and charges down a straight lane.
- **Marsh Hexbearer**: a caster that stays at range. It throws slow orbs that add corruption, pools corruption under you every third cast (standing in a pool wounds and corrupts you), teleports away when you get close, and calls up revenants.
- **Drowned Sovereign** (boss): rallies nearby Drowned (faster, harder hits), summons revenants, and alternates spike eruptions with shockwave lanes. Below half health it bursts with corruption and grows faster.

## Code layout

No build step, no dependencies. These are plain scripts loaded in order:

| File | What it does |
|---|---|
| `src/core.js` | math, deterministic noise, input (keyboard, mouse aim, floating joystick, attack button), WebAudio sound effects |
| `src/view.js` | Auto / Portrait / Landscape view: orientation lock, rotated stage, letterboxing |
| `src/net.js` | online co-op: rooms, host snapshots, guest state and events (PeerJS) |
| `src/data.js` | **all balance numbers**: day/night lengths, zones, enemies, kits and milestones, kit level costs, difficulties, upgrade costs |
| `src/kits.js` | the five kits in play: attacks, dashes, abilities, passives, training and milestone effects |
| `src/camp.js` | base camp layout per tier, palisade walls, gate pathing |
| `src/art.js` | procedural pixel sprites for the world, camp and effects |
| `src/units.js` | the knight, Drowned Knight, Bone Hound and Derek sprite sheets (all animations, corruption stages) |
| `src/sprites.js` | loads hand-drawn PNG art over the coded sprites and sheets |
| `src/world.js` | endless chunked wetland: ground texture, resources, blooms, collisions |
| `src/game.js` | simulation: player, corruption, spawning, enemy AI, combat, camp economy, saving |
| `src/hounds.js` | the Bone Hound: its hunt and bite, bleeding, being knocked out, co-op ownership |
| `src/den.js` | the Bone Wolf den: where it lies, the pack, hauling a carcass home to win a hound |
| `src/golem.js` | Derek the stone golem familiar: following, raising stone walls the Drowned attack |
| `src/cave.js` | Derek's Hollow: the cave mouth, the seven-wave cave trial that wins Derek, its co-op messages and art |
| `src/kindle.js` | Kindle the walking lantern: lighting him with torches, following, refilling lantern oil, leading the way to unique places |
| `src/render.js` | drawing, the darkness/light compositing, effects |
| `src/ui.js` | HUD, camp menu, title, pause and death screens |
| `src/main.js` | boot + main loop |
| `manifest.webmanifest`, `sw.js`, `icons/` | installable-app profile, offline cache, app icons |

**Releasing an update:** bump the version in `sw.js` (`VERSION`) and the `?v=` stamps in `index.html` together. Installed copies then fetch the new files and reload themselves the next time they're opened online.

Progress (camp, stored supplies, kits, day) saves to the browser's `localStorage`.

## Art

The knight and every Drowned Knight are pixel sprites painted in code (`src/units.js`) at the same pixel size as the world. They follow the Lantern Knight concept sheets.
- **Lantern Knight**: idle, 4-frame walk, 3-frame attack, dash, hurt and death, in down / up / side views (left mirrors right). There are four corruption stages: steel and cloth darken, cyan seeps in, and the lantern turns cyan.
- **The Drowned** share the knight's hood, mantle and armour, darkened, with glowing visors and cyan drips.

Sheets have the shape `Art.sheets[key][dir][anim][frame]`, so hand-drawn sprite sheets can replace the generated ones later without touching the game code.

**Hand-drawn art** (`src/sprites.js`) replaces coded art with PNG files in `assets/sprites/`. The art is being redone piece by piece from AI renders: one pose per image on a flat magenta background, made from prompts in the project's art-prompts file.
- **Lantern Blade knight**: front, back and side poses, 4-frame side, front and back walks cut from sheets, a 3-frame attack, dash, hurt and death. The frames are cut at twice the art resolution (`res: 2`) so the detail survives. Corruption stages and the drowned self are tinted from the same frames.
- **Pike Warden**, **Ashen Arbalist**, **Relic Bearer** and **Flame Bastion knights**: the same 12 poses and walk sheets as an enemy, tinted for every corruption stage. Walks that stepped with one foot (Pike Warden and Relic Bearer front, Flame Bastion back) get the other step by mirroring the legs (`FRAME_ORDER`, `MIRROR_AT`).
- **Mire Stalker** (squire): the 12 poses from the enemy prompt (three views, a 4-frame side walk, three attack frames, hurt and death), also at `res: 2`.
- **Drowned Wretch** (footman): two batches of renders. The first batch came out as the knight with cyan details, so `match_colors` in `tools/cutlib.py` recolours it to match the second.
- **Tide Archer** (archer): the 12 poses. Six of them came as cells of one 3×2 sheet, cut into frames before cutting.
- **Swarming Revenant** (revenant), **Lantern Reaver** (defiler), **Bone Bulwark** (blackguard), **Marsh Hexbearer** (hexbearer) and **Drowned Sovereign** (champion, cut at `res: 3` because the boss is drawn 1.5× bigger): the poses came as two 3×2 sheets of six (`GRIDS` in the cutter splits them into poses, keeping a cloak or blade that pokes over a cell edge with its pose).
- The knight and all eight enemies walk with 4-pose side, front and back walk sheets.
- **Bioluminescent plants** (Refuge Bloom, Sentinel Bloom, Mother Root, sprout, garden flowers, and the husk of a dead bloom), lit and unlit: cut from two sheets by `PROP_GRIDS` in the cutter into `assets/sprites/props/` at `res: 2`. The lit plants are scaled to match their unlit twins by the width of their rocky base.
- **Cultivation Plot**: a drawn bed per plot level (`gardenBed1`–`3`); the glowing flowers sit in rows of six along its furrows (`BED_SOIL` in `src/render.js` gives each bed's soil corners).
- **Trees**: three swamp trees (`swampTree1`–`3`), one picked per spot. The render tinted their moss pink, so `PROP_DESPILL` takes the magenta back out.
- **Boulders**: two boulder shapes, bare or mossy (`boulder11`–`43`: shape/moss, then damage stage), one picked per spot. Each shows three stages as it is mined: whole, cracked, crumbling.
- **Camp buildings**: a picture per level for the Forge, Armory and Workbench (`forge1`–`4` …), the Watchtowers and Lantern Pylons (`tower1`–`3`, `pylon1`–`3`), and one per camp tier for the Central Flame (`flame1`–`3`, drawn unlit: the fire is animated in code at `FLAME_FIRE` in `src/render.js`, and pylon and gate lamps at `PYLON_LAMPS` / `GATE_LAMP`). The tent, banner, stake, palisade and gate post keep their coded names, so the drawn ones replace them; `palisade2` and `gatePost2` are the reinforced level 3 barricade.
- **Torches and fire**: the torch, burnt torch and placed brazier replace the coded ones, and `Art.drawFire` plays six drawn flame frames (`fire1`–`6`) for every fire: the Central Flame, torches, braziers and burning enemies.
- **Reeds**: six clumps from one sheet (`reeds1`–`reeds6`), one picked per spot.
- **Iron and amethyst deposits**: three of each (`iron11`–`33`, `amethyst11`–`33`: variant, then damage stage), mined down in three stages like the boulders. Amethyst is the `pearl` resource in code.
- **Supplies**: the five resources as pickups (`resWood`, `resStone`, `resResin`, `resIron`, `resPearl`), drawn where mined supplies drop instead of coloured squares.
- **Ground**: nine repeating textures in `assets/sprites/ground/` (camp earth, flagstones for the tier II plaza, paving for tier III, marsh grass and dirt, shore, shallow and deep water, boardwalk planks), cut by the `GROUND` section of the cutter, which also makes their edges wrap. `groundColor` in `src/world.js` still decides where each terrain goes and blends them; `GROUND_K` darkens the land so the art stands out.
- Graves and pillars no longer spawn in the wild; their coded art is kept for a ruin entrance. Set `ENABLED = false` in `src/sprites.js` to use coded art everywhere.

`tools/cut_ai_sprites.py <folder>` cuts the AI renders. Walk cycles come as one sheet per view (`SHEETS`), cut onto a shared canvas with one foot point so the character doesn't jitter between frames; longer walks play faster so a stride takes the same time. For single images, it keys out the magenta, shrinks every pose of a character by the same factor, limits the palette and adds an outline (Python with Pillow, NumPy and SciPy). `tools/cut_concept_sprites.py` is the older cutter for the concept sheets. To add or redraw art:
1. Draw one PNG per frame at art-pixel size (a knight is about 36 px tall), facing right for side views. Free editors: [Piskel](https://www.piskelapp.com) or [LibreSprite](https://libresprite.github.io).
2. Put it under `assets/sprites/` and list it in `src/sprites.js` (`UNITS` for animated units, `PROPS` for world and camp sprites).
3. Add the files to the `FILES` list in `sw.js` so the installed app has them offline.

A file that's missing or fails to load just keeps the coded frames.

`assets/lantern_atlas.png` (the earlier illustrated sheet) stays in the repo for reference but is no longer loaded.

Blooms, ruins and camp buildings are also drawn in code (`src/art.js`).
