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
3. **Return and build.** Supplies you carry are stored automatically when you reach camp. Spend them on the Central Flame, Forge, Armory, Lanternwright, Watchtowers and Warding Stakes, or forge new kits.
4. **Defend.** If you're at camp at night, waves march on the Central Flame. If it goes out, your home goes dark until dawn.

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
| `src/art.js` | loads the knight atlas, builds the recoloured Drowned variants, draws the procedural pixel sprites |
| `src/world.js` | endless chunked wetland: ground texture, resources, blooms, collisions |
| `src/game.js` | simulation: player, corruption, spawning, enemy AI, combat, camp economy, saving |
| `src/render.js` | drawing, the darkness/light compositing, effects |
| `src/ui.js` | HUD, camp menu, title, pause and death screens |
| `src/main.js` | boot + main loop |

Progress (camp, stored supplies, kits, day) saves to the browser's `localStorage`.

## Art

`assets/lantern_atlas.png` is the player sheet: 1920×1008, 8 columns × 3 rows of 240×336 frames.
Columns: down, down-right, right, up-right, up, up-left, left, down-left. Rows: idle, walk, dash.

The Drowned Knights are generated from this same sheet at load time. Armour is darkened and the warm lantern light turns abyssal cyan, so they are literally the player's corrupted reflection. Blooms, ruins and camp buildings are drawn in code as pixel sprites. Dedicated sprite sheets can replace any of them later.

**Art that would help most next:** a multi-frame walk cycle (4–6 frames per direction), an attack swing row, and dedicated enemy sheets (archer bow, blackguard shield, champion).
