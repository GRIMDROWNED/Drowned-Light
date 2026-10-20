# Drowned Light — Prototype v0.4

**Will you thrive in the light or drown in the darkness?**

A mobile-friendly HTML5 Canvas prototype for testing a dark fantasy survival / bullet-heaven game.

## Run
Open `index.html` in Chrome, or serve the folder with `python -m http.server 8000` and visit `http://localhost:8000`.

## Controls
- Desktop: WASD or arrow keys move.
- Mobile: hold the on-screen joystick and press DASH with your other thumb, or quickly double-tap the joystick.\n- DASH travels about 100 pixels, grants brief invulnerability, and has a 3-second cooldown.
- Attacks auto-target nearby enemies.
- Approach resources to gather; return to the physical base camp at (0,0) and choose UPGRADE CAMP.

## Mechanics
- Continuous procedurally generated wilderness, a permanent home base, and a home compass
- Day/night cycle; enemies spawn at night
- Corruption from 0 to 400, ending the run at full corruption
- Human firelight reverses corruption; natural bioluminescence only halts it
- Resources, auto-combat, campfire upgrades, a Forge and Armory\n- Deposit resources while at camp. Only deposited resources and upgrades are saved in local browser storage; carried supplies are lost on death or restart.\n- Forge improves damage and attack speed, Armory increases max health.

## Roadmap
Replace placeholder art with original sprites; add cloud saves, all enemy classes, loadouts, camp buildings and balanced waves; prepare Android builds. Multiplayer is a later milestone.

This is an early test prototype, not a Google Play release.

## Illustrated player sprite atlas (pending upload)

The game now supports `assets/lantern_atlas.png` (384 × 192 px, 8 columns × 3 rows). Rows represent idle, walk and dash; columns represent down, down-right, right, up-right, up, up-left, left, down-left. The generated image is provided separately for uploading through the GitHub web interface. Until it is uploaded at this exact path, the game continues showing its older code-drawn fallback knight. This is a temporary packaging limitation, not a finished animated art asset.

## Animation update (v0.7)

- Player's legs now alternate between the atlas idle and walking poses while moving. Idle stops on a stable frame; dash continues using the atlas dash row.
- Automatic attacks trigger a brief rotational sword swing and bright blade arc aimed toward the nearest target. Existing auto-attack range, projectiles, and damage remain unchanged.
- Current atlas has one walking pose per direction (not multiple stride frames), so this is an interim two-pose animation. A full leg-by-leg walking cycle and independent weapon rig need dedicated animation frames.

## v0.8 player animation changes

- Added `player_animation.js` as a dedicated visual layer rig for the 1920×1008 illustrated knight atlas.
- Walking keeps the illustrated upper body and lantern stable while animating lower-leg areas in opposing phases, instead of flipping the whole character between two unrelated-looking poses.
- Attack now isolates the actual illustrated blade and pivots it around the sword hand; the separate slash trail is only a supplementary effect. The knight body no longer rotates to imitate a sword swing.
- The atlas still does not include a full hand-drawn walking sequence. This is a transitional programmatic rig, not final polished pixel animation.
