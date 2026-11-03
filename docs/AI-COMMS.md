# Claude ↔ GPT comms log

The working log between the two AI assistants on Drowned Light. Rules are in
[`AGENTS.md`](../AGENTS.md). In short: Robert decides design; **Claude has priority on
architecture**; GPT proposes architecture changes here and waits for an answer.

## How to use this file

- Read the **Open** section before starting work. Answer anything addressed to you.
- Add new entries at the **top** of the section they belong in, using the template.
- When an entry is settled, move it to **Closed** with its final status.
- Keep entries short. Link files (`src/camp.js`), PRs (`#148`) and commits.
- Never put secrets, keys or personal data here; the repo is public.

### Entry template

```
### YYYY-MM-DD · <Claude|GPT> → <Claude|GPT|Both> · <short topic>
Type: Proposal | Decision | Handover | Question | Problem | Note
Status: Open | Accepted | Declined | Needs Robert | Done
Files/PRs: <paths, PR numbers>

<What and why, a few lines.>

Reply (<who>, YYYY-MM-DD): <answer>
```

Status meanings: **Open** waits on the other assistant. **Accepted / Declined** is Claude's
call on an architecture proposal. **Needs Robert** means we disagree or it's a design call,
and Robert picks. **Done** is finished or just for the record.

---

## Open

### 2026-11-03 · Claude → GPT · Pyramid base: plan and work split
Type: Handover
Status: Open
Files/PRs: `docs/PYRAMID-PLAN.md`, #150

Robert has picked a new goal for Level 1. The camp grows into a stepped pyramid of 800 px squares
on a fixed 9 × 9 map, Central Flame levels unlock squares, sieges every 5 nights attack the squares,
and 80% coverage starts the Sunken King fight. Please read `docs/PYRAMID-PLAN.md`, including
Robert's answers: you lose at flame 0, the barracks makes champions, the Drowned climb step edges
slowly (full speed on the stairs), and the escort march is cut.

- **Claude builds steps 1–2 first** (bounded map, `src/pyramid.js` core, save format, outposts
  replaced). Please don't start steps 3–8 until Claude posts here that step 2 is merged, because
  they build on its API.
- **Meanwhile, GPT can:** read the plan and reply here with questions or proposals, and write art
  prompts for the "Art needed" list (into `docs/` or a reply here) for Robert to generate.
- After step 2, GPT takes steps 3, 4, 5, 7 and 8. Open one PR per step and add an entry here
  when each is up, so Claude can review it.

Reply (GPT, ____-__-__):


---

## Closed

### 2026-11-03 · Claude → GPT · Comms log set up
Type: Decision
Status: Done
Files/PRs: `AGENTS.md`, `docs/AI-COMMS.md`

Robert asked for a log for Claude and GPT to talk while working on the repo, with Claude
having priority on architecture. This file is it. Please read `AGENTS.md` first: it has
who decides what and the conventions that keep the game working (version bump,
`DL.asset`, `src/data.js` for numbers, `DL.Camp` for camp distance, `G.hurtPlayer` names,
the `ACTIONS` list in `src/binds.js`, the secrecy rule). If any of it looks wrong or out of date, open an entry.
