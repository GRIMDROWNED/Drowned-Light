/* Drowned Light — runs and rewards (step 6 of the Level 2 plan): the way into the dungeons, and what they pay for.

   The Drowned Gate: once the Sunken King has fallen, walk up the causeway into its open arch and it offers the
     dungeons beyond it (one for now, the Abyssal Spires; each new level adds one more). The Rift Portal at camp, opened
     by lighting every Mist Well in the Spires once, offers the same choice from home.
   A run's loot: Rift Shards (foes, won rooms, side-room chests) and the Aether Crystals you didn't burn. Walk out and
     half comes home to the stash (all of it once the boss is beaten, step 7); fall and the mist keeps it all.
   What it buys (DL.UPGRADES with `rift`, hidden until Rift Shards first come home):
     Crystal Turret  turrets by the camp's gates that spin out slow spirals of crystal at the Drowned (3 levels)
     Mist Lantern    in a dungeon's mist your lantern lights a wider ring and corruption builds slower (src/spires.js)
   Numbers: DL.RIFT and DL.SPIRES.loot (src/data.js). Co-op (step 9): any knight may choose a dungeon, and the host's
   device takes the whole party in (src/spires.js); the loot comes home to the host's stash, which is everyone's.
   Art (Robert's, cut by tools/cut_spires.py to assets/sprites/rift, drawn at half size): the turret's 3 levels (its
   launcher drawn pointing right, so it's mirrored to face Drowned on the left), its bolt, muzzle flash and shatter,
   the Mist Lantern's 3 levels and the Rift Portal (dormant and open). */
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
    // Level 3 (src/mines.js): in the Sandbox while it's being built; later, once the Rift Throne has fallen
    { id: "mines", name: "The Molten Mines", text: "A fortress of basalt over a sea of lava.", open: () => DL.SANDBOX && !(DL.Net && DL.Net.role), go: () => DL.Mines.enter() },
  ];
  Rift.go = function (id) {
    const d = Rift.DUNGEONS.find((q) => q.id === id);
    if (!d || (d.open && !d.open())) return false;
    if (G.isGuest()) { DL.Net.event({ t: "riftGo", id }); return true; } // the host's device takes everyone in
    d.go();
    return true;
  };
  /* ---------------- Robert's art ---------------- */
  const ART = ["turret-1", "turret-2", "turret-3", "bolt", "flash-1", "flash-2", "hit", "lantern-1", "lantern-2", "lantern-3", "portal-off", "portal-on"];
  const IMG = {};
  let loading = false;
  function loadArt() {
    if (loading || typeof Image === "undefined") return;
    loading = true;
    for (const n of ART) { const im = new Image(); im.onload = () => (IMG[n] = im); im.src = DL.asset("assets/sprites/rift/" + n + ".png"); }
  }
  const draw = (c, im, x, y, k = 0.5, flip = false) => { // stood on its foot at (x, y)
    const w = im.width * k, h = im.height * k;
    if (!flip) return c.drawImage(im, x - w / 2, y - h, w, h);
    c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(im, -w / 2, -h, w, h); c.restore();
  };
  // where the camp's Mist Lantern and Rift Portal stand: fractions of the palisade's half-side, east and west of the Flame, south of the cross paths
  const LANTERN = { fx: 0.55, fy: 0.24 }, PORTAL = { fx: -0.56, fy: 0.26, k: 0.36 };
  const at = (q) => ({ x: Math.round(q.fx * DL.WALL_R), y: Math.round(q.fy * DL.WALL_R) });
  Rift.lanternSpot = () => (G.save.up.mistlantern ? at(LANTERN) : null);
  Rift.portalSpot = () => (Rift.portal() ? at(PORTAL) : null);

  // Walking into the open Drowned Gate: the choice of dungeons (once each time you come up to it).
  let atGate = false, atPortal = false;
  Rift.local = function () {
    const p = G.player;
    if (G.spires) { atGate = true; return; } // back out of a dungeon you stand in the arch: step away first
    if (!p || G.state !== "play" || G.cave) { atGate = atPortal = false; return; }
    // the Rift Portal at camp: step into its swirl (not in co-op yet: then it stands dormant)
    const ps = Rift.portalSpot();
    if (ps) {
      const dx = p.x - ps.x, dy = p.y - ps.y;
      if (Math.abs(dx) < 34 && dy > -14 && dy < 16) { if (!atPortal) { atPortal = true; DL.UI.openGate("portal"); } }
      else if (Math.hypot(dx, dy) > 90) atPortal = false;
    }
    if (!DL.Finale.won()) { atGate = false; return; }
    const g = DL.Finale.gate(), dx = p.x - g.x, dy = p.y - g.y;
    if (Math.abs(dx) < 60 && dy > 0 && dy < 46) {
      if (!atGate) { atGate = true; DL.UI.openGate("gate"); }
    } else if (Math.hypot(dx, dy) > 130) atGate = false;
  };
  // the Rift Portal's card, top of the camp's Buildings tab
  Rift.card = function () {
    if (!Rift.portal()) return "";
    return `<article class="card rift-card"><header><h3>Rift Portal</h3><span class="tag">Open</span></header>
      <p>Every Mist Well in the Spires burns, and their light holds a rift open here in the camp: a way straight to the roads beyond the Drowned Gate.</p>
      <footer><button data-act="rift">Step through</button></footer></article>`;
  };

  /* ---------------- the Crystal Turret ---------------- */
  const GATES = [-Math.PI / 2, Math.PI / 2, 0, Math.PI]; // north and south first, then east and west
  let cds = [], fl = [], face = [], phase = 0, hits = [];
  const HEAD = [0, 46, 52, 64]; // how high its crystal head rides above the foot, by level (world px)
  // the launcher's tip in each level's picture (fractions of its width and height), for the muzzle flash
  const TIP = [null, [0.83, 0.1], [0.86, 0.09], [0.92, 0.24]];
  // a crystal shard striking a Drowned (game.js): a small shatter of violet sparks
  Rift.hit = (x, y) => { if (hits.length < 40) hits.push({ x, y, t: 0 }); };
  Rift.spots = function () {
    const n = R.turret.spots[G.save.up.crystal || 0] || 0, r = DL.CAMP_RADIUS + 4;
    return GATES.slice(0, n).map((g) => {
      const ux = Math.round(Math.cos(g)), uy = Math.round(Math.sin(g));
      return { x: ux * r - uy * R.turret.along, y: uy * r + ux * R.turret.along };
    });
  };
  Rift.update = function (dt) {
    for (const h of hits) h.t += dt;
    hits = hits.filter((h) => h.t < 0.25);
    const lv = G.save.up.crystal || 0, T = R.turret;
    if (!lv || G.spires || G.cave || G.isGuest()) return;
    Rift.spots().forEach((s, i) => {
      cds[i] = (cds[i] || 0) - dt;
      if (fl[i] > 0) fl[i] -= dt;
      const foe = G.nearestEnemy(s.x, s.y, T.range);
      if (foe) face[i] = foe.x < s.x ? -1 : 1; // the launcher swings round to the nearest Drowned
      if (cds[i] > 0 || !foe) return;
      cds[i] = T.every[lv];
      fl[i] = 0.18;
      phase += 0.37; // each spiral turns a little from the last, so the gaps move
      for (let k = 0; k < T.n[lv]; k++) {
        const a = phase + (k / T.n[lv]) * Math.PI * 2;
        G.projectiles.push({ x: s.x, y: s.y - HEAD[lv], vx: Math.cos(a) * T.speed, vy: Math.sin(a) * T.speed, life: T.life, dmg: T.dmg[lv], hostile: false, kind: "shard", col: "214,168,255", crystal: true });
      }
    });
  };
  // the turrets, the Mist Lantern and the Rift Portal among the camp's buildings
  Rift.push = function (list, c, t) {
    if (G.spires || G.cave) return;
    loadArt();
    const lv = Math.min(3, G.save.up.crystal || 0);
    if (lv) Rift.spots().forEach((s, i) => list.push({ y: s.y, f: () => (IMG["turret-" + lv] ? turretArt(c, s, i, lv, t) : turret(c, s.x, s.y, t + i)) }));
    const ls = Rift.lanternSpot(), ll = Math.min(3, G.save.up.mistlantern || 0), li = IMG["lantern-" + ll];
    if (ls && li) list.push({ y: ls.y, f: () => draw(c, li, ls.x, ls.y + 4) });
    const ps = Rift.portalSpot(), open = true, pi = IMG[open ? "portal-on" : "portal-off"];
    if (ps && pi) list.push({ y: ps.y, f: () => portalArt(c, pi, ps, open, t) });
    if (hits.length && IMG.hit) list.push({ y: 1e9, f: () => {
      for (const h of hits) { c.globalAlpha = 1 - h.t / 0.25; draw(c, IMG.hit, h.x, h.y + 11, 0.4 + h.t); }
      c.globalAlpha = 1;
    } });
  };
  function turretArt(c, s, i, lv, t) {
    const im = IMG["turret-" + lv], flip = face[i] < 0, w = im.width / 2, h = im.height / 2;
    c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(s.x, s.y - 2, w * 0.42, 8, 0, 0, Math.PI * 2); c.fill();
    draw(c, im, s.x, s.y + 2, 0.5, flip);
    if (fl[i] > 0 && IMG["flash-1"]) { // the muzzle flash at the launcher's tip as it fires
      const tp = TIP[lv], mx = s.x + (flip ? -1 : 1) * (tp[0] - 0.5) * w, my = s.y + 2 - h + tp[1] * h, f = IMG[fl[i] > 0.09 ? "flash-1" : "flash-2"];
      c.save(); c.globalCompositeOperation = "lighter"; draw(c, f, mx, my + f.height / 4, 0.5); c.restore();
    }
    // the crystal's glow, pulsing
    c.save(); c.globalCompositeOperation = "lighter";
    const gy = s.y - HEAD[lv], g = c.createRadialGradient(s.x, gy, 0, s.x, gy, 30);
    g.addColorStop(0, `rgba(200,150,255,${0.22 + 0.1 * Math.sin(t * 3 + i)})`); g.addColorStop(1, "rgba(200,150,255,0)");
    c.fillStyle = g; c.fillRect(s.x - 30, gy - 30, 60, 60);
    c.restore();
  }
  // the Rift Portal: its swirl slowly turning (a soft pulse over the drawn disc), or dormant in co-op
  function portalArt(c, im, ps, open, t) {
    c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(ps.x, ps.y - 2, im.width * PORTAL.k * 0.45, 9, 0, 0, Math.PI * 2); c.fill();
    draw(c, im, ps.x, ps.y + 4, PORTAL.k);
    if (!open) return;
    const h = im.height * PORTAL.k, cy = ps.y + 4 - h * 0.56, r = im.width * PORTAL.k * 0.24;
    c.save(); c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(ps.x, cy, 0, ps.x, cy, r);
    g.addColorStop(0, `rgba(235,200,255,${0.25 + 0.15 * Math.sin(t * 2.4)})`); g.addColorStop(1, "rgba(180,110,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(ps.x, cy, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // a turret's shot: Robert's crystal bolt turned the way it flies (false: not one of these, or no art yet)
  Rift.drawBolt = function (c, b, a) {
    const im = IMG.bolt;
    if (!im) return false;
    const w = im.width / 2, h = im.height / 2;
    c.save(); c.translate(b.x, b.y); c.rotate(a); c.drawImage(im, -w + 4, -h / 2, w, h); c.restore();
    return true;
  };
  // drawn in code until the art loads: a violet crystal on a stone plinth
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
    Rift.campLights(L);
    if (!G.save.up.crystal || G.spires || G.cave) return;
    for (const s of Rift.spots()) L.push({ x: s.x, y: s.y - 40, r: 60, s: 0.4, col: "200,150,255", a: 0.7 });
  };
  Rift.campLights = function (L) {
    if (G.spires || G.cave) return;
    const ls = Rift.lanternSpot(), ps = Rift.portalSpot();
    if (ls) L.push({ x: ls.x, y: ls.y - 90, r: 70 + 20 * G.save.up.mistlantern, s: 0.5, col: "215,180,255", a: 0.8 });
    if (ps) L.push({ x: ps.x, y: ps.y - 60, r: 120, s: 0.6, col: "190,130,255", a: 0.85 });
  };
})(window.DL);
