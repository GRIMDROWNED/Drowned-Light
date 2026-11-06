/* Drowned Light — runs and rewards (step 6 of the Level 2 plan): the way into the dungeons, and what they pay for.

   The Drowned Gate: once the Sunken King has fallen, walk up the causeway into its open arch and it offers the
     dungeons beyond it (one for now, the Abyssal Spires; each new level adds one more). The Rift Portal at camp, opened
     by lighting every Mist Well in the Spires once, offers the same choice from home.
   A run's loot: Rift Shards (foes, won rooms, side-room chests) and the Aether Crystals you didn't burn. Walk out and
     half comes home to the stash (all of it once the boss is beaten, step 7); fall and the mist keeps it all.
   What it buys (DL.UPGRADES with `rift`, hidden until Rift Shards first come home):
     Crystal Turret  turrets by the camp's gates that spin out slow spirals of crystal at the Drowned (3 levels)
     Mist Lantern    in a dungeon's mist your lantern lights a wider ring and corruption builds slower (src/spires.js)
   Numbers: DL.RIFT and DL.SPIRES.loot (src/data.js). Host only; co-op runs come with the co-op pass (step 9). */
"use strict";
(function (DL) {
  const G = DL.Game, R = DL.RIFT;
  const Rift = (DL.Rift = {});
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const name = (k, n) => `${n} ${DL.RESOURCES[k].name}${n === 1 ? "" : "s"}`;

  /* ---------------- loot home ---------------- */
  // Into the stash: what came home, in words ("" for nothing).
  Rift.bringHome = function (got) {
    const parts = [];
    for (const k of ["shard", "aether"]) if (got[k] > 0) {
      if (!G.isGuest()) G.save.stash[k] = (G.save.stash[k] || 0) + got[k];
      parts.push(name(k, got[k]));
    }
    if (!parts.length) return "";
    if (got.shard > 0 && !G.save.riftHome) {
      G.save.riftHome = 1;
      setTimeout(() => say("Rift Shards hum in the stash. New things can be built in the camp with them.", "good"), 2500);
    }
    G.persist();
    return parts.join(" and ");
  };
  // the dungeon materials show in the stash once any have come home
  Rift.seen = () => !!G.save.riftHome || DL.SANDBOX;

  /* ---------------- the way in ---------------- */
  const wells = () => G.save.spiresWells || {};
  Rift.wellsLit = () => { let n = 0; for (let i = 0; i < DL.Spires.WELLS_N; i++) if (wells()[i]) n++; return n; };
  Rift.portal = () => Rift.wellsLit() >= DL.Spires.WELLS_N; // every Mist Well lit once
  Rift.DUNGEONS = [
    { id: "spires", name: "The Abyssal Spires", text: "Floating stone in a sea of violet mist.", go: () => DL.Spires.enter() },
  ];
  Rift.go = function (id) {
    const d = Rift.DUNGEONS.find((q) => q.id === id);
    if (!d || (DL.Net && DL.Net.role)) return false;
    d.go();
    return true;
  };
  // Walking into the open Drowned Gate: the choice of dungeons (once each time you come up to it).
  let atGate = false;
  Rift.local = function () {
    const p = G.player;
    if (G.spires) { atGate = true; return; } // back out of a dungeon you stand in the arch: step away first
    if (!p || G.state !== "play" || G.cave || !DL.Finale.won()) { atGate = false; return; }
    const g = DL.Finale.gate(), dx = p.x - g.x, dy = p.y - g.y;
    if (Math.abs(dx) < 60 && dy > 0 && dy < 46) {
      if (!atGate) { atGate = true; DL.UI.openGate("gate"); }
    } else if (Math.hypot(dx, dy) > 130) atGate = false;
  };
  // the Rift Portal's card, top of the camp's Buildings tab
  Rift.card = function () {
    if (!Rift.portal()) return "";
    const coop = DL.Net && DL.Net.role;
    return `<article class="card rift-card"><header><h3>Rift Portal</h3><span class="tag">Open</span></header>
      <p>Every Mist Well in the Spires burns, and their light holds a rift open here in the camp: a way straight to the roads beyond the Drowned Gate.</p>
      <footer>${coop ? `<span class="req">Not in co-op yet</span>` : ""}<button data-act="rift" ${coop ? "disabled" : ""}>Step through</button></footer></article>`;
  };

  /* ---------------- the Crystal Turret ---------------- */
  const GATES = [-Math.PI / 2, Math.PI / 2, 0, Math.PI]; // north and south first, then east and west
  let cds = [], phase = 0;
  Rift.spots = function () {
    const n = R.turret.spots[G.save.up.crystal || 0] || 0, r = DL.CAMP_RADIUS + 4;
    return GATES.slice(0, n).map((g) => {
      const ux = Math.round(Math.cos(g)), uy = Math.round(Math.sin(g));
      return { x: ux * r - uy * R.turret.along, y: uy * r + ux * R.turret.along };
    });
  };
  Rift.update = function (dt) {
    const lv = G.save.up.crystal || 0, T = R.turret;
    if (!lv || G.spires || G.cave || G.isGuest()) return;
    Rift.spots().forEach((s, i) => {
      cds[i] = (cds[i] || 0) - dt;
      if (cds[i] > 0 || !G.nearestEnemy(s.x, s.y, T.range)) return;
      cds[i] = T.every[lv];
      phase += 0.37; // each spiral turns a little from the last, so the gaps move
      for (let k = 0; k < T.n[lv]; k++) {
        const a = phase + (k / T.n[lv]) * Math.PI * 2;
        G.projectiles.push({ x: s.x, y: s.y - 34, vx: Math.cos(a) * T.speed, vy: Math.sin(a) * T.speed, life: T.life, dmg: T.dmg[lv], hostile: false, kind: "shard", col: "214,168,255" });
      }
    });
  };
  // drawn in code until Robert's art: a violet crystal on a stone plinth, among the camp's buildings
  Rift.push = function (list, c, t) {
    if (!G.save.up.crystal || G.spires || G.cave) return;
    Rift.spots().forEach((s, i) => list.push({ y: s.y, f: () => turret(c, s.x, s.y, t + i) }));
  };
  function turret(c, x, y, t) {
    c.save();
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y + 2, 18, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3b3550"; c.fillRect(x - 14, y - 14, 28, 15);
    c.fillStyle = "#4d4668"; c.fillRect(x - 14, y - 14, 28, 4);
    const bob = Math.sin(t * 2) * 2, lv = G.save.up.crystal, h = 26 + lv * 6;
    c.fillStyle = "#b07cff";
    c.beginPath(); c.moveTo(x, y - 18 - h + bob); c.lineTo(x + 9, y - 22 + bob); c.lineTo(x, y - 16 + bob); c.lineTo(x - 9, y - 22 + bob); c.closePath(); c.fill();
    c.fillStyle = "#e6d0ff";
    c.beginPath(); c.moveTo(x, y - 18 - h + bob); c.lineTo(x + 3, y - 24 + bob); c.lineTo(x, y - 18 + bob); c.closePath(); c.fill();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(x, y - 26 - h / 2, 0, x, y - 26 - h / 2, 30);
    g.addColorStop(0, `rgba(200,150,255,${0.35 + 0.15 * Math.sin(t * 3)})`); g.addColorStop(1, "rgba(200,150,255,0)");
    c.fillStyle = g; c.fillRect(x - 30, y - 56 - h / 2, 60, 60);
    c.restore();
  }
  Rift.lights = function (L) {
    if (!G.save.up.crystal || G.spires || G.cave) return;
    for (const s of Rift.spots()) L.push({ x: s.x, y: s.y - 40, r: 60, s: 0.4, col: "200,150,255", a: 0.7 });
  };
})(window.DL);
