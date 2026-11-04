# Working on Drowned Light (for AI assistants)

Two AI assistants work on this repo for the owner, Robert Eldridge (GitHub `GRIMDROWNED`):
**Claude** (Claude Code) and **GPT** (ChatGPT). Robert has the final say on everything.
Below him, **Claude has priority on architecture**.

## Who decides what

| Area | Decides |
|---|---|
| Game design, art, balance, what gets built | Robert |
| Architecture: file/module layout, the `DL` namespace, save format, co-op/netcode, render pipeline, asset loading and caching, build/version/release process, tooling | Claude (Robert can overrule) |
| Small fixes inside an existing pattern (a bug, a number, text, a new item that follows how similar items are done) | Whoever is doing the work |

If GPT wants to change something in the architecture row, it **proposes** it in
[`docs/AI-COMMS.md`](docs/AI-COMMS.md) and waits for Claude to answer `Accepted` or
`Declined` there before building it. If Claude and GPT disagree, the entry is marked
`Needs Robert` and Robert picks.

## The comms log

[`docs/AI-COMMS.md`](docs/AI-COMMS.md) is how Claude and GPT talk to each other.
Neither assistant sees the other's chats, so anything the other one needs to know goes there.

- **Read it before starting work**, and answer any open entry addressed to you.
- **Write an entry** when you: propose an architecture change, make a decision the other
  should follow, change a convention below, hand over half-finished work, or find a problem
  in the other's work.
- Commit the log together with the work it talks about.

## Conventions to keep (short version)

- Plain JavaScript on a canvas, no build step, no npm. Served as a PWA from GitHub Pages.
  Every module hangs off the global `DL` object (`src/core.js` creates it).
- **Version bump on every change that ships:** the `?v=` on every link and script in
  `index.html` and `VERSION` in `sw.js` must match (e.g. `0.15.168` → `0.15.169`).
  New `src/` files must also be added to `index.html` and to the cache list in `sw.js`.
- **Images load through `DL.asset(url)`** (adds `?v=<version>` so an update's art isn't
  hidden by the old offline cache). Never load an image by a bare path.
- **Numbers live in `src/data.js`** (`DL.HOUND`, `DL.GOLEM`, `DL.GROVE`, `DL.SPAWN_TABLE`, ...),
  not scattered through logic.
- **Camp layout:** with the Refuge on (`DL.Refuge.on()`, the default) the camp is the terraced fortress in `src/refuge.js`; new camp buildings go in `DL.REFUGE.items` with a district and spot, and walkers route with `DL.Camp.route`. See `docs/REFUGE.md`.
- **Camp distance:** the camp is a square. Use `DL.Camp.sq` / `DL.Camp.inside` /
  `DL.Camp.gatePoint` (`src/camp.js`), not `Math.hypot`.
- **Damage to the player** goes through `G.hurtPlayer(dmg, ang, by)` with a readable name in
  `by`, so the death screen can name the killer.
- **New input actions** go in the `ACTIONS` list in `src/binds.js` so they can be rebound.
  New menu screens must be reachable by gamepad and need a B-back case in `back()` in `src/pad.js`.
- **New touch action buttons** go in `RING` in `src/ui.js`.
- **Secrecy rule:** anything won from a boss or familiar quest stays hidden (`???`
  silhouette/card, no name in field guide, travel or quest text) until it is earned.
- **Co-op** runs over PeerJS (`src/net.js`). Anything that changes world state must work
  for host and guest; say in the PR if co-op is untested.
- **Art** is cut from returned sheets by the Python tools in `tools/`
  (`cut_ai_sprites.py`, `cutlib.py`); edit the cutter and re-run it rather than hand-editing PNGs.
- Work on a branch and open a pull request; Robert merges.
