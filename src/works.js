/* The Refuge's upper works (Robert's picks, 2026-11-04). Numbers in DL.WORKS (src/data.js).
   - Alchemy Station (refuge 13): each dawn brews a lantern-oil flask from resin; an empty lantern away from the fire drinks one.
   - Survivor Quarters (14): survivors bring wood, stone and iron each dawn, and mend the flame and pylons on siege nights.
   - Expedition Lodge (16): an expedition leaves at dusk and comes back at dawn with amethyst, iron and maybe a Black Pearl.
   - Research Archive (16): every boss slain gives +10% damage against its kind (the boss and its kin, DL.WORKS.archive.kin).
   - Familiars: one walks with you at a time (chosen on the Kit tab); the Summoning Circle (20) allows two.
   State lives in save.works { flasks, away } and save.archive { boss type: 1 }; save.fams is the familiars you bring. */
(function () {
  "use strict";
  const DL = window.DL, W = DL.WORKS;
  const Works = (DL.Works = {});
  const G = () => DL.Game;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);

  // Whether a work stands: the fortress is on and the refuge has reached its level.
  Works.has = function (id) {
    const R = DL.Refuge, it = DL.REFUGE.items[id];
    return !!(R && G().save && R.on() && it && R.level() >= (it.from || 1));
  };
  const st = () => { const s = G().save; if (!s.works) s.works = { flasks: 0, away: false }; if (!s.archive) s.archive = {}; return s.works; };
  const add = (k, n) => { G().save.stash[k] = (G().save.stash[k] || 0) + n; };
  const roll = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

  // Dusk: the expedition sets out.
  Works.nightfall = function () {
    if (G().isGuest()) return;
    if (Works.has("supplies")) { // the supply pile: a torch and some oil for the night
      const S = W.supplies, p = G().player, cap = G().stats().torchMax, gave = [];
      if (G().save.torches < cap) { G().save.torches = Math.min(cap, G().save.torches + S.torches); gave.push("a torch"); }
      const max = G().stats().maxOil;
      if (p && p.oil < max) { p.oil = Math.min(max, p.oil + max * S.oil); gave.push("lantern oil"); }
      if (gave.length) setTimeout(() => say(`From the supply pile: ${gave.join(" and ")}.`, "good"), 3000);
    }
    if (Works.has("lodge")) { st().away = true; setTimeout(() => say("An expedition sets out from the lodge into the dark.", "info"), 4500); }
  };
  // Dawn: the flask, the survivors' haul, the expedition's return.
  Works.dawn = function () {
    if (G().isGuest()) return;
    const s = st(), notes = [];
    if (Works.has("alchemy") && s.flasks < W.alchemy.max && (G().save.stash.resin || 0) >= W.alchemy.resin) {
      G().save.stash.resin -= W.alchemy.resin; s.flasks++;
      notes.push(`The Alchemy Station brewed a flask of lantern oil (${s.flasks} of ${W.alchemy.max}).`);
    }
    if (Works.has("quarters")) {
      for (const [k, n] of Object.entries(W.quarters.give)) add(k, n);
      notes.push(`Survivors brought in ${Object.entries(W.quarters.give).map(([k, n]) => `${n} ${DL.RESOURCES[k].name}`).join(", ")}.`);
    }
    if (s.away) {
      s.away = false;
      const got = [];
      for (const [k, r] of Object.entries(W.lodge.loot)) { const n = roll(r); add(k, n); got.push(`${n} ${DL.RESOURCES[k].name}`); }
      if (DL.RESOURCES.black && Math.random() < W.lodge.black) { add("black", 1); got.push(`a ${DL.RESOURCES.black.name}`); }
      notes.push(`The expedition is back with ${got.join(", ")}.`);
    }
    notes.forEach((m, i) => setTimeout(() => say(m, "good"), 2600 + i * 1600));
  };
  // Each frame (host): an empty lantern away from the fire drinks a flask; on siege nights the survivors mend the flame.
  Works.update = function (dt) {
    const g = G(), p = g.player;
    if (!g.save || !p) return;
    const s = st();
    if (!g.isGuest() && (Works.tick = (Works.tick || 0) - dt) <= 0) { Works.tick = 1; Works.refresh(); }
    if (s.flasks > 0 && p.oil <= 0 && p.protect !== "human") {
      s.flasks--; p.oil = g.stats().maxOil;
      say(`You drink a flask of lantern oil. ${s.flasks} left.`, "good");
    }
    if (g.isGuest() || !g.night || !Works.has("quarters") || !(DL.Siege && DL.Siege.on)) return;
    const m = W.quarters.mend * dt;
    if (g.flame && g.flame.lit) g.flame.hp = Math.min(g.flame.max, g.flame.hp + g.flame.max * m);
    for (const q of g.pylons || []) if (q.lit) q.hp = Math.min(q.max, q.hp + q.max * m);
  };
  /* ---------------- the yards ---------------- */
  // Storehouse: when you fall, half of each carried resource (rounded down) goes to the stash; the rest stays with your
  // drowned self. Takes it out of `lost` and returns what was kept (or null).
  Works.keep = function (lost) {
    if (!Works.has("storehouse") || G().isGuest()) return null;
    const kept = {};
    for (const k of DL.RES_KEYS) { const n = Math.floor((lost[k] || 0) * W.storehouse.keep); if (n > 0) { kept[k] = n; lost[k] -= n; add(k, n); } }
    return Object.keys(kept).length ? kept : null;
  };
  // Salvage Yard: trade stash supplies for others (the camp menu's card).
  Works.trades = () => (Works.has("salvage") ? W.salvage.trades : []);
  Works.trade = function (i) {
    const t = Works.trades()[i], g = G();
    if (!t || !g.canAfford(t.give)) return false;
    if (!DL.SANDBOX) for (const [k, n] of Object.entries(t.give)) g.save.stash[k] -= n;
    for (const [k, n] of Object.entries(t.get)) add(k, n);
    g.persist();
    return true;
  };
  // Training Grounds: the champions' health and damage multiplier.
  Works.drill = () => (Works.has("training") ? W.training.champion : 1);

  Works.flasks = () => (G().save && G().save.works ? G().save.works.flasks : 0);

  /* ---------------- Research Archive ---------------- */
  // A boss slain is written into the archive (whether or not it's built yet).
  Works.slain = function (e) { if (e.def && e.def.boss && e.type && e.type !== "self") { st(); G().save.archive[e.type] = 1; } };
  // Damage multiplier against this Drowned: +10% for each slain boss whose kind it is.
  Works.dmgMult = function (e) {
    if (!Works.has("archive")) return 1;
    const A = G().save.archive || {}, K = W.archive.kin;
    let n = 0;
    for (const b in A) if (A[b] && (e.type === b || (K[b] && K[b].includes(e.type)))) n++;
    return 1 + n * W.archive.bonus;
  };

  /* ---------------- familiars: one at a time, two with the Summoning Circle ---------------- */
  const OWN = { hound: () => G().save.hound, golem: () => G().save.golem, wraith: () => G().save.abigail, fred: () => G().save.fred, wyvern: () => G().save.wyvern };
  Works.slots = () => (Works.has("circle") ? W.circle.slots : 1);
  Works.owned = (k) => !!(OWN[k] && OWN[k]());
  // The familiars this knight brings: the chosen ones still owned, topped up with the first owned ones.
  Works.fams = function () {
    const s = G().save; if (!s) return [];
    const n = Works.slots(), out = (s.fams || []).filter((k) => Works.owned(k)).slice(0, n);
    for (const k of DL.FAMILIARS) if (out.length < n && Works.owned(k) && !out.includes(k)) out.push(k);
    return out;
  };
  Works.brings = (k) => Works.fams().includes(k);
  // Bring this familiar along (the oldest choice steps back if every slot is taken); takes effect at once.
  Works.bring = function (k) {
    const s = G().save, cur = Works.fams();
    if (cur.includes(k) || !Works.owned(k)) return;
    s.fams = [...cur, k].slice(-Works.slots());
    Works.refresh();
    G().persist && G().persist();
  };
  // Send home the host knight's familiars that aren't chosen, and call the chosen ones.
  Works.refresh = function () {
    const g = G();
    if (g.isGuest() || !g.player) return;
    // a familiar just won walks with you at once (old saves start with what they already own)
    const sv = g.save, owned = DL.FAMILIARS.filter((k) => Works.owned(k));
    if (!sv.famSeen) sv.famSeen = owned.slice();
    for (const k of owned) if (!sv.famSeen.includes(k)) { sv.famSeen.push(k); sv.fams = [...Works.fams().filter((f) => f !== k), k].slice(-Works.slots()); }
    const arrays = { hound: "hounds", golem: "golems", wraith: "wraiths", fred: "freds", wyvern: "wyverns" };
    const mods = { hound: DL.Hounds, golem: DL.Golems, wraith: DL.Abigail, fred: DL.Fred, wyvern: DL.Wyvern };
    for (const k of DL.FAMILIARS) {
      const arr = g[arrays[k]] || [], mine = arr.some((m) => m.owner === 0 && !m.gone && !m.trial);
      if (!Works.brings(k) && mine) g[arrays[k]] = arr.filter((m) => m.owner !== 0 || m.trial);
      else if (Works.brings(k) && !mine && mods[k] && mods[k].summonMine) mods[k].summonMine();
    }
  };
})();
