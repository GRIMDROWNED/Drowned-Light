/* Drowned Light — the camp's lava works (step 8 of the Level 3 plan, The Molten Mines).

   What the Mines pay for at camp (DL.UPGRADES with `mines`, hidden until Obsidian first comes home; numbers in
   DL.LAVA_CAMP, src/data.js). Each is an existing building redone for lava, after Robert's art:
     Magma Forge      the Forge rebuilt (needs Forge 4): weapon damage up, and every blow sets the Drowned burning
                      (the burn rides the kit's blows in src/kits.js; the damage is in G.stats, src/game.js)
     Brazier Towers   the watchtowers rebuilt (needs Watchtowers 1): at night each one also lobs a lava mortar at the
                      biggest Drowned in reach; the shot is marked on the ground before it lands
     Fire Grate Gates iron grates outside each gate (needs Barricade 2): a Drowned stepping on one sets it off, it
                      glows, then flames for a moment and cools (the Grate Run's art, assets/sprites/mines)
   The Forge Gate: a lava twin of the Rift Portal that opens on its own once all five mini bosses of the Mines have
   fallen in this world (their Magma Hearts, save.minesHearts); step into it to go straight into the Mines.
   Art (Robert's, cut by tools/cut_mines.py to assets/sprites/mines-camp at 2 file px per world px). */
"use strict";
(function (DL) {
  const G = DL.Game, N = () => DL.LAVA_CAMP;
  const LC = (DL.LavaCamp = {});
  const up = () => G.save.up;
  const away = () => !!(G.spires || G.cave);

  /* ---------------- Robert's art ---------------- */
  const OWN = ["magma-forge", "brazier-tower", "forge-gate-off", "forge-gate-on"];
  const MINES = ["grate-1", "grate-2", "grate-3", "grate-flame-1", "grate-flame-2", "grate-flame-3", "grate-flame-4", "colossus-mortar", "warn-1", "warn-2", "warn-3"];
  const IMG = {};
  let loading = false;
  function loadArt() {
    if (loading || typeof Image === "undefined") return;
    loading = true;
    const get = (dir, n) => { const im = new Image(); im.onload = () => (IMG[n] = im); im.src = DL.asset(`assets/sprites/${dir}/${n}.png`); };
    for (const n of OWN) get("mines-camp", n);
    for (const n of MINES) get("mines", n);
  }
  LC.IMG = IMG;
  // a picture stood on its foot at (x, y), at half its file size (or `w` world px wide)
  const draw = (c, im, x, y, w) => { const k = w ? w / im.width : 0.5, iw = im.width * k, ih = im.height * k; c.drawImage(im, x - iw / 2, y - ih, iw, ih); };

  /* ---------------- the Forge Gate ---------------- */
  LC.gateOpen = () => { const h = G.save.minesHearts || {}; return N().gate.bosses.every((b) => h[b]); };
  LC.gateSpot = () => {
    if (!LC.gateOpen()) return null;
    const L = DL.Camp.layout(G.save.up); // the compact base's monument ring stands for the Mines instead (src/refuge.js)
    if (L && L.monuments) return null;
    return { x: Math.round(N().gate.fx * DL.WALL_R), y: Math.round(N().gate.fy * DL.WALL_R) };
  };
  let atGate = false;
  LC.local = function () {
    const p = G.player, s = LC.gateSpot();
    if (!p || !s || G.state !== "play" || away()) { atGate = !!G.spires; return; }
    const dx = p.x - s.x, dy = p.y - s.y;
    if (Math.abs(dx) < 30 && dy > -14 && dy < 16) { if (!atGate) { atGate = true; DL.UI.openGate("forge"); } }
    else if (Math.hypot(dx, dy) > 90) atGate = false;
  };

  /* ---------------- the Fire Grate Gates ---------------- */
  let grates = [];
  LC.grates = function () {
    if (!up().firegate || !DL.Camp.walled(up())) return [];
    const r = DL.WALL_R + N().grate.out;
    return DL.Camp.GATES.map((g, i) => {
      const old = grates[i] || {};
      return { x: Math.round(Math.cos(g)) * r, y: Math.round(Math.sin(g)) * r, k: old.k || 0, st: old.st || "cold" };
    });
  };
  function updateGrates(dt) {
    const Q = N().grate;
    grates = LC.grates();
    for (const g of grates) {
      g.k += dt;
      const on = (e) => !e.removed && !(e.rise > 0) && !e.def.fly && !e.def.boss && Math.abs(e.x - g.x) < Q.half && Math.abs(e.y - g.y) < Q.half;
      if (g.st === "cold" && G.enemies.some(on)) { g.st = "warn"; g.k = 0; }
      else if (g.st === "warn" && g.k >= Q.warn) { g.st = "burn"; g.k = 0; }
      else if (g.st === "burn") {
        for (const e of G.enemies) if (on(e)) {
          e.hp -= Q.dps * dt;
          if (!(e.burn > 0)) { e.burn = Q.burnFor; e.burnDps = Q.burnDps; }
          if (e.hp <= 0) G.kill(e, true);
        }
        if (g.k >= Q.burn) { g.st = "cool"; g.k = 0; }
      } else if (g.st === "cool" && g.k >= Q.cool) { g.st = "cold"; g.k = 0; }
    }
  }

  /* ---------------- the Brazier Towers' mortars ---------------- */
  let shells = [], cds = [];
  const TOP = 112; // the fire bowl atop a Brazier Tower, above its foot (world px)
  function updateMortars(dt) {
    const B = N().brazier, towers = up().brazier && up().tower ? DL.Camp.layout(up()).towers : [];
    towers.forEach((t, i) => {
      cds[i] = (cds[i] || B.first) - dt;
      if (cds[i] > 0 || !G.night) return;
      // the biggest Drowned in reach: bosses and elites before the small fry
      let best = null, bh = B.minHp;
      for (const e of G.enemies) {
        if (e.removed || e.rise > 0 || e.def.fly || Math.hypot(e.x - t.x, e.y - t.y) > B.range) continue;
        const h = e.maxHp || e.def.hp || 0;
        if (h > bh) { bh = h; best = e; }
      }
      if (!best) { cds[i] = 0.5; return; }
      cds[i] = B.every;
      shells.push({ x0: t.x, y0: t.y - TOP, tx: best.x, ty: best.y, t: 0, T: B.warn });
    });
    for (const s of shells) {
      s.t += dt;
      if (s.t < s.T || s.done) continue;
      s.done = true;
      for (const e of G.enemies) {
        if (e.removed || e.rise > 0 || e.def.fly) continue;
        const d = Math.hypot(e.x - s.tx, e.y - s.ty);
        if (d < B.r + e.def.radius) G.hitEnemy(e, B.dmg, Math.atan2(e.y - s.ty, e.x - s.tx), 220, B.burnDps);
      }
      s.boom = 0;
    }
    for (const s of shells) if (s.done) s.boom += dt;
    shells = shells.filter((s) => !s.done || s.boom < 0.45);
  }
  LC.update = function (dt) {
    if (away() || G.isGuest()) { shells = []; return; }
    updateGrates(dt);
    updateMortars(dt);
  };

  /* ---------------- drawing ---------------- */
  // the Magma Forge over the Forge's spot (false: not built, or no art yet: the plain forge is drawn)
  LC.drawForge = function (c, b, fortress) {
    const im = up().magmaforge && IMG["magma-forge"];
    if (!im) return false;
    draw(c, im, b.x, b.y + (fortress ? 16 : 6), 112);
    return true;
  };
  LC.drawTower = function (c, tw, fortress) {
    const im = up().brazier && IMG["brazier-tower"];
    if (!im) return false;
    draw(c, im, tw.x, tw.y + (fortress ? 16 : 6), 64);
    return true;
  };
  LC.push = function (list, c, t) {
    if (away()) return;
    loadArt();
    const Q = N().grate;
    for (const g of (G.isGuest() ? LC.grates() : grates)) {
      // the grate lies flat under everything; its flame stands y-sorted with the Drowned walking through
      list.push({ y: g.y - 40, f: () => {
        const im = IMG["grate-" + (g.st === "burn" ? 3 : g.st === "warn" ? 2 : 1)];
        if (im) c.drawImage(im, g.x - 28, g.y - 23, 56, 46);
        else { c.fillStyle = "#140c0c"; c.fillRect(g.x - 26, g.y - 18, 52, 36); }
      } });
      if (g.st !== "burn") continue;
      const fi = IMG["grate-flame-" + (g.k < 0.12 ? 1 : g.k > Q.burn - 0.2 ? 4 : 2 + (Math.floor(t * 10 + g.x) & 1))];
      if (fi) list.push({ y: g.y + 10, f: () => draw(c, fi, g.x, g.y + 24, 62) });
    }
    const gs = LC.gateSpot();
    if (gs) list.push({ y: gs.y, f: () => {
      const im = IMG["forge-gate-on"];
      if (!im) return;
      draw(c, im, gs.x, gs.y + 6, 124);
      const h = (im.height * 124) / im.width, cy = gs.y + 6 - h * 0.45;
      c.save(); c.globalCompositeOperation = "lighter"; // the swirl's breath
      c.globalAlpha = 0.18 + 0.12 * Math.sin(t * 2.2);
      c.fillStyle = "#ff8a2a"; c.beginPath(); c.ellipse(gs.x, cy, 26, 34, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    } });
    if (shells.length) list.push({ y: 1e9, f: () => drawShells(c, t) });
  };
  function drawShells(c, t) {
    const B = N().brazier, mi = IMG["colossus-mortar"];
    for (const s of shells) {
      if (!s.done) {
        // the mark where it lands, tightening as it falls
        const k = s.t / s.T;
        const wi = IMG["warn-" + (k < 0.45 ? 1 : k < 0.85 ? 2 : 3)];
        if (wi) { const sx = (2 * B.r) / 187, sy = (1.1 * B.r) / 102; c.drawImage(wi, s.tx - 100 * sx, s.ty - 64 * sy, 200 * sx, 120 * sy); }
        else { c.strokeStyle = `rgba(255,120,40,${0.4 + 0.4 * k})`; c.lineWidth = 2; c.beginPath(); c.ellipse(s.tx, s.ty, B.r, B.r * 0.55, 0, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = `rgba(255,90,20,${0.12 + 0.15 * k})`;
        c.beginPath(); c.ellipse(s.tx, s.ty, B.r * k, B.r * 0.55 * k, 0, 0, Math.PI * 2); c.fill();
        // the shell on its arc
        const x = s.x0 + (s.tx - s.x0) * k, y = s.y0 + (s.ty - s.y0) * k - Math.sin(Math.PI * k) * 160;
        if (mi) { c.save(); c.translate(x, y); c.rotate(t * 8); c.drawImage(mi, -mi.width / 4, -mi.height / 4, mi.width / 2, mi.height / 2); c.restore(); }
        else { c.fillStyle = "#ff8a2a"; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); }
      } else {
        const k = s.boom / 0.45; // the burst
        c.save(); c.globalCompositeOperation = "lighter";
        c.fillStyle = `rgba(255,140,40,${0.7 * (1 - k)})`;
        c.beginPath(); c.ellipse(s.tx, s.ty, B.r * (0.6 + 0.6 * k), B.r * 0.55 * (0.6 + 0.6 * k), 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
  }
  LC.lights = function (L) {
    if (away()) return;
    const gs = LC.gateSpot();
    if (gs) L.push({ x: gs.x, y: gs.y - 50, r: 120, s: 0.6, col: "255,120,40", a: 0.85 });
    if (up().magmaforge) { const f = DL.Camp.layout(up()).forge; if (f) L.push({ x: f.x, y: f.y - 30, r: 90, s: 0.5, col: "255,110,30", a: 0.8, flick: 1 }); }
    if (up().brazier) for (const tw of DL.Camp.layout(up()).towers) L.push({ x: tw.x, y: tw.y - TOP, r: 70, s: 0.5, col: "255,130,40", a: 0.8, flick: 1 });
    for (const g of grates) if (g.st === "burn" || g.st === "warn") L.push({ x: g.x, y: g.y - 20, r: g.st === "burn" ? 80 : 40, s: 0.5, col: "255,120,40", a: 0.8 });
    for (const s of shells) if (s.done) L.push({ x: s.tx, y: s.ty, r: 110, s: 0.5, col: "255,130,40", a: 0.9 * (1 - s.boom / 0.45) });
  };
})(window.DL);
