# Drowned Light

**Will you thrive in the light or drown in the darkness?**

A top-down dark-fantasy survival game for the browser and phones. You are a lantern-bearing knight. By day you range out from your base camp to gather supplies. By night the darkness corrupts anyone outside the light, and the Drowned Knights (knights it has already claimed) come for you and your fire.

## Play

- **Online:** enable GitHub Pages for this repo (Settings → Pages → deploy from `main`, root). Then open the Pages URL on desktop or phone.
- **Locally:** run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.
  Opening `index.html` directly also works. Chrome blocks pixel access on `file://`, though, so the Drowned recolouring falls back to a simpler tint.

### Controls

| | Desktop | Phone |
|---|---|---|
| Move | WASD / arrows | Drag anywhere on the left half |
| Attack | automatic (nearest enemy) | automatic |
| Dash | Space / Shift | DASH |
| Kit ability | E / Q | ability button |
| Place torch | F / T | TORCH |
| Camp menu | C (at camp) | ENTER CAMP |
| Pause | Esc / P | ❚❚ |

## The core loop

1. **Day: venture out.** Gather wood, stone, bloom resin and iron scrap. Rings of land get darker and richer the farther you go: *The Shallows → The Mire → Drowned Reaches → The Abyss*.
2. **Night: stay in the light.** Outside light, **corruption** rises. It has four visible stages, and at 100% you become a Drowned Knight.
   - **Firelight** (camp, torches, Illuminate) *reverses* corruption, heals you and refills your lantern.
   - **Bloomlight** (Refuge Blooms, Sentinel Blooms, Mother Roots) only *halts* it. Blooms wake at night, and the Drowned come to tear them down.
   - **Lantern oil** halves corruption in the dark until it runs dry.
3. **Return and build.** Supplies you carry are stored automatically when you reach camp. Spend them on camp structures, or forge new kits.
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
| Lantern Pylons | Firelight posts on the perimeter. They slow the Drowned and are hunted by Defilers, then relit at dawn |
| Barricade & Gate | Level 1 is a stake ring. Level 2 is a palisade with four gates, so the Drowned must path through them and take stake damage. Level 3 reinforces it with gate lanterns and spikes |

### High-risk reasons to leave the light
- **Abyssal Pearls** surface only in darkness (the Mire and deeper). You need them for top-tier upgrades.
- **Torches** you plant burn out, and Lantern Defilers hunt them.
- **Mother Roots**: defend one until dawn for a big reward.
- **Your drowned self**: when you fall, a Drowned version of you keeps everything you carried. Kill it to get your supplies back. If you die again first, they're gone.

### Kits
- **Lantern Blade** (Kit 01): fast sword arcs. Dash becomes a damaging *Lantern Strike*. Ability **Illuminate** is a burst of firelight that damages and repels enemies and leaves a short-lived sanctuary.
- **Pyre Censer** (Kit 02, forged at camp): slow, wide burning swings. Ability **Kindle** plants a brazier that lights and scorches.
- Each kit's ability levels up through **Mastery** at camp.

### The Drowned
Broken Squire · Drowned Footman · Shade Archer · Swarming Revenant (rises from the ground) · Lantern Defiler (hunts light sources) · Blackguard (armoured tank) · Drowned Champion (boss: summons revenants and calls up spike eruptions). Every enemy telegraphs its attack with a cyan wind-up, so you can dash out of the way.

## Code layout

No build step, no dependencies. These are plain scripts loaded in order:

| File | What it does |
|---|---|
| `src/core.js` | math, deterministic noise, input (keyboard + floating joystick), WebAudio sound effects |
| `src/data.js` | **all balance numbers**: day/night lengths, zones, enemies, kits, upgrade costs |
| `src/camp.js` | base camp layout per tier, palisade walls, gate pathing |
| `src/art.js` | procedural pixel sprites for the world, camp and effects |
| `src/units.js` | the knight and Drowned Knight sprite sheets (all animations, corruption stages) |
| `src/world.js` | endless chunked wetland: ground texture, resources, blooms, collisions |
| `src/game.js` | simulation: player, corruption, spawning, enemy AI, combat, camp economy, saving |
| `src/render.js` | drawing, the darkness/light compositing, effects |
| `src/ui.js` | HUD, camp menu, title, pause and death screens |
| `src/main.js` | boot + main loop |

Progress (camp, stored supplies, kits, day) saves to the browser's `localStorage`.

## Art

The knight and every Drowned Knight are pixel sprites painted in code (`src/units.js`) at the same pixel size as the world. They follow the Lantern Knight concept sheets.
- **Lantern Knight**: idle, 4-frame walk, 3-frame attack, dash, hurt and death, in down / up / side views (left mirrors right). There are four corruption stages: steel and cloth darken, cyan seeps in, and the lantern turns cyan.
- **The Drowned** share the knight's hood, mantle and armour, darkened, with glowing visors and cyan drips. Each has its own gear: the squire's short sword, the footman's round shield, the archer's bow, the defiler's pole lantern, the Blackguard's tower shield and bulk, and the Champion's crown and greatsword. The revenant crawls.

Sheets have the shape `Art.sheets[key][dir][anim][frame]`, so hand-drawn sprite sheets can replace the generated ones later without touching the game code.

`assets/lantern_atlas.png` (the earlier illustrated sheet) stays in the repo for reference but is no longer loaded.

Blooms, ruins and camp buildings are also drawn in code (`src/art.js`).
