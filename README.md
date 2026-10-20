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
