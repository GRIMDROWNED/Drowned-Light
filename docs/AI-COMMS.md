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

_(nothing open)_

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
