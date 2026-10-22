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

1. **Day: venture out.** Gather wood, stone, bloom resin and iron scrap. Rings of land get darker and richer the farther you go: *The Shallows → The Mire → Drowned Reaches → The Abyss*.
2. **Night: stay in the light.** Outside light, **corruption** rises. It has four visible stages, and at 100% you become a Drowned Knight.
   - **Firelight** (camp, torches, Illuminate) *reverses* corruption, heals you and refills your lantern.
   - **Bloomlight** (Refuge Blooms, Sentinel Blooms, Mother Roots) only *halts* it. Blooms wake at night, and the Drowned come to tear them down.
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
- **Abyssal Pearls** surface only in darkness (the Mire and deeper). You need them for top-tier upgrades.
- **Torches** you plant burn out, and Lantern Reavers snuff them out.
- **Mother Roots**: defend one until dawn for a big reward.
- **Your drowned self**: when you fall, a Drowned version of you keeps everything you carried. Kill it to get your supplies back. If you die again first, they're gone.

### Save slots
There are three save files (title screen → **Saves**). Each keeps its own camp, kit, difficulty and day. **Continue** resumes the current slot. A save from before slots existed becomes slot 1.

### Starting a game: kit, difficulty and combat
A new game asks you to choose a **kit**, a **difficulty** and a **combat mode** (Auto-attack or Manual attack). The kit and difficulty stay fixed for that save. The combat mode can be switched any time from the pause menu.

### Co-op (online, 2 players)
Title screen → **Play with a friend**.
- **Host:** needs a game of their own. **Host my world** opens a room with a 5-character code. Share the code, then **Start playing**. The friend can join any time.
- **Join:** pick the kit you'll bring (any of the five), type the code, and you play in the host's world: their camp, difficulty, day and stash. The kit joins at its co-op level, or your best level for it in your own saves. Kit levels you train in co-op are kept on your device for your next co-op game. Your own saves never change.

What's shared:
- The Drowned hunt whichever knight is nearer, and night waves and pearls also turn up near a friend who wanders off.
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
Supply nodes take several hits to break: logs 3, rock 4, iron 5, bloom sprouts 2, pearls 2. Each strike shakes and cracks the node and throws chips. The last strike shatters it into pieces of its sprite, and the supplies spill out as pickups that fly to you. In auto mode the knight mines a node you stand beside whenever no Drowned are in reach. In manual mode mining has its own control (Mine / G / right-click), so Attack never mines by mistake.

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
| `src/units.js` | the knight and Drowned Knight sprite sheets (all animations, corruption stages) |
| `src/sprites.js` | loads hand-drawn PNG art over the coded sprites and sheets |
| `src/world.js` | endless chunked wetland: ground texture, resources, blooms, collisions |
| `src/game.js` | simulation: player, corruption, spawning, enemy AI, combat, camp economy, saving |
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
- **Pike Warden knight**: the same 12 poses and walk sheets as an enemy, tinted for every corruption stage. Its front walk stepped with one foot, so the cutter mirrors the legs for the other step. Ashen Arbalist, Relic Bearer and Flame Bastion are still coded.
- **Mire Stalker** (squire): the 12 poses from the enemy prompt (three views, a 4-frame side walk, three attack frames, hurt and death), also at `res: 2`.
- **Drowned Wretch** (footman): two batches of renders. The first batch came out as the knight with cyan details, so `match_colors` in `tools/cutlib.py` recolours it to match the second.
- **Tide Archer** (archer): the 12 poses. Six of them came as cells of one 3×2 sheet, cut into frames before cutting.
- **Swarming Revenant** (revenant), **Lantern Reaver** (defiler), **Bone Bulwark** (blackguard), **Marsh Hexbearer** (hexbearer) and **Drowned Sovereign** (champion, cut at `res: 3` because the boss is drawn 1.5× bigger): the poses came as two 3×2 sheets of six (`GRIDS` in the cutter splits them into poses, keeping a cloak or blade that pokes over a cell edge with its pose).
- The knight and all eight enemies walk with 4-pose side, front and back walk sheets.
- Everything else (plants, camp and world) is coded until its new art arrives. Set `ENABLED = false` in `src/sprites.js` to use coded art everywhere.

`tools/cut_ai_sprites.py <folder>` cuts the AI renders. Walk cycles come as one sheet per view (`SHEETS`), cut onto a shared canvas with one foot point so the character doesn't jitter between frames; longer walks play faster so a stride takes the same time. For single images, it keys out the magenta, shrinks every pose of a character by the same factor, limits the palette and adds an outline (Python with Pillow, NumPy and SciPy). `tools/cut_concept_sprites.py` is the older cutter for the concept sheets. To add or redraw art:
1. Draw one PNG per frame at art-pixel size (a knight is about 36 px tall), facing right for side views. Free editors: [Piskel](https://www.piskelapp.com) or [LibreSprite](https://libresprite.github.io).
2. Put it under `assets/sprites/` and list it in `src/sprites.js` (`UNITS` for animated units, `PROPS` for world and camp sprites).
3. Add the files to the `FILES` list in `sw.js` so the installed app has them offline.

A file that's missing or fails to load just keeps the coded frames.

`assets/lantern_atlas.png` (the earlier illustrated sheet) stays in the repo for reference but is no longer loaded.

Blooms, ruins and camp buildings are also drawn in code (`src/art.js`).
