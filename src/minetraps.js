/* Drowned Light — the Molten Mines' traps (Level 3 step 2, Robert 2026-11-09: "in the small rooms and corridors the
   player will dodge traps such as fire grates falling cages and other traps").

   Each corridor teaches one trap (plan: "Level 3 plan: The Molten Mines", Traps). Every trap warns before it hurts
   (a glow, a shadow, smoke, sparks or bubbling), and a dash's dodge window always gets through (hurtPlayer skips a
   dashing knight; a dash over a fallen tile doesn't fall).
     Grate Run       fire grates      rows glow 0.8 s, then a flame column for 1 s; waves, alternate rows, open lanes
     Gibbet Gallery  falling cages    a shadow grows under you 0.9 s, then an iron cage drops: caught = locked 3 s
                                      (attack or dash to break out sooner); it stands as a wall a few seconds
     Crystal Stair   flame jets       a nozzle in the wall puffs smoke, then blasts a lane across the corridor
                     crumbling tiles  step on one: it cracks and glows, falls 1 s later; fall in = hurt, back to stone
     Broken Causeway lava geysers     a bubbling ring, then a burst and a ring of lava globs (bullets)
                     crumbling tiles  along the causeway to the Roost
     Slag Mine       ore carts        the rails spark and a bell rings, then a cart rushes down the track
   Only the corridor the knight is in (and a margin round it) runs its traps; everything is drawn only on screen and
   lit only with one cached glow picture. Numbers: DL.MINE_TRAPS (src/data.js). Solo only for now (co-op: step 9). */
"use strict";
(function (DL) {
  const G = DL.Game, TAU = Math.PI * 2;
  const T = (DL.MineTraps = {});
  const N = () => DL.MINE_TRAPS;
  const OX = () => DL.MINES.x, OY = () => DL.MINES.y;
  const sfx = (n) => DL.Sound && DL.Sound.play(n);

  /* ---------------- where they are (local px) ---------------- */
  // corridor boxes: the traps in one run only while the knight is inside (with a margin)
  const ZONES = {
    run: [-110, 1000, 110, 1400], gallery: [660, 570, 1260, 750], mine: [-1260, 570, -660, 750],
    ncw: [-580, -320, -340, 250], nce: [340, -320, 860, 250], // the Broken Causeway takes in its causeway east
  };
  const GRATES = []; // the Grate Run: 6 rows of 3
  for (let r = 0; r < 6; r++) for (let k = -1; k <= 1; k++) GRATES.push({ x: k * 64, y: 1068 + r * 56, row: r, col: k + 1, at: -9 });
  const JETS = [ // the Crystal Stair: nozzles in the west (-1) and east (1) walls, each blasting a lane across
    { y: 190, side: -1, off: 0 }, { y: 100, side: 1, off: 0.8 }, { y: 10, side: -1, off: 1.6 }, { y: -80, side: 1, off: 2.4 },
  ];
  const JET_X0 = -580, JET_X1 = -340;
  // Robert's side-view head (jet-head-side, drawn facing east): HEAD_W world px wide, its wall block sunk HEAD_IN px into
  // the wall, its nozzle's mouth at NOZ (fractions of the picture); the flame starts at the mouth
  const HEAD_W = 72, HEAD_IN = 10, NOZ = [913 / 1192, 581 / 1030];
  const mouthOut = () => (art("jet-head-side") ? HEAD_W * NOZ[0] - HEAD_IN : 0); // how far the mouth stands out of the wall
  const TILES = [ // crumbling tiles: x0, y0, x1, y1
    ...[0, 1, 2, 3, 4].flatMap((i) => [[-580 + i * 48, -254, -532 + i * 48, -206], [-580 + i * 48, -206, -532 + i * 48, -158]]),
    ...[0, 1, 2, 3, 4].map((i) => [618 + i * 46, -190, 664 + i * 46, -110]),
  ].map((q) => ({ q, st: 0, t: 0 })); // st: 0 solid, 1 cracking, 2 fallen
  const GEYSERS = [{ x: 400, y: 170, off: 0 }, { x: 520, y: 60, off: 0.9 }, { x: 400, y: -50, off: 1.8 }, { x: 520, y: -160, off: 2.7 }];
  const RAIL_Y = 666, RAIL_X0 = -1260, RAIL_X1 = -660;

  let cages = [], cart = null, sched = { grate: 0, pat: 0, cage: 0, cart: 0 }, last = null, glowPic = null;
  T._cart = () => cart; // for tests
  T.reset = function () {
    cages = []; cart = null; sched = { grate: 0, pat: 0, cage: 0, cart: 1.5 }; last = null;
    for (const g of GRATES) g.at = -9;
    for (const t of TILES) { t.st = 0; t.t = 0; }
    const p = G.player;
    if (p) p.mCage = null;
  };
  const inZone = (lx, ly, k, m = 120) => { const z = ZONES[k]; return lx > z[0] - m && lx < z[2] + m && ly > z[1] - m && ly < z[3] + m; };
  const jk = (j) => (G.t + j.off) % N().jet.every; // where a jet is in its rhythm
  const hurt = (dmg, ang, by) => G.hurtPlayer(dmg, ang, by);

  /* ---------------- each frame ---------------- */
  T.update = function (dt) {
    const p = G.player;
    if (!p || G.state !== "play") return;
    const ox = OX(), oy = OY(), lx = p.x - ox, ly = p.y - oy, now = G.t, n = N();
    const cap = (v) => DL.clamp(v, -320, 320); // walking speed (a jump back to a shrine or stone is not a heading)
    const vx = last ? cap((p.x - last.x) / Math.max(dt, 1e-3)) : 0, vy = last ? cap((p.y - last.y) / Math.max(dt, 1e-3)) : 0;
    last = { x: p.x, y: p.y };

    // locked in a cage: held where it fell; each attack or dash shakes it looser
    if (p.mCage) {
      const c = p.mCage;
      c.lock -= dt;
      if ((p.attackN || 0) !== c.atk) { c.atk = p.attackN || 0; c.lock -= n.cage.shake; sfx("clink"); }
      if (p.dashT > 0 && !c.dashing) { c.lock -= n.cage.shake; sfx("clink"); }
      c.dashing = p.dashT > 0;
      p.x = ox + c.x; p.y = oy + c.y; p.kx = p.ky = 0; p.dashT = 0; p.spx = p.x; p.spy = p.y;
      if (c.lock <= 0) {
        p.mCage = null; c.open = true; c.life = Math.min(c.life, n.cage.after);
        for (let i = 0; i < 10; i++) G.spark(p.x + DL.rand(-24, 24), p.y - DL.rand(0, 60), "200,190,180", 90);
        sfx("shatter");
      }
    }

    // the Grate Run: a new pattern every few seconds while you're in it
    if (inZone(lx, ly, "run")) {
      if ((sched.grate -= dt) <= 0) {
        sched.grate = n.grate.every;
        const pat = sched.pat++ % 3;
        if (pat === 0) for (const g of GRATES) g.at = now + (5 - g.row) * n.grate.wave; // a wave rolling down at you
        else if (pat === 1) for (const g of GRATES) g.at = now + (g.row % 2) * (n.grate.warn + n.grate.burn); // alternate rows
        else { const safe = Math.floor(Math.random() * 3); for (const g of GRATES) if (g.col !== safe) g.at = now; } // one open lane
        sfx("torch");
      }
      for (const g of GRATES) {
        const k = now - g.at;
        if (k < n.grate.warn || k > n.grate.warn + n.grate.burn) continue;
        if (Math.abs(lx - g.x) < 30 && Math.abs(ly - g.y) < 24) hurt(n.grate.dmg, -Math.PI / 2, "a fire grate");
      }
    }

    // the Gibbet Gallery: cages dropped where you're headed
    if (inZone(lx, ly, "gallery", 0) && !p.mCage) {
      if ((sched.cage -= dt) <= 0 && cages.filter((c) => !c.down).length < n.cage.max) {
        sched.cage = n.cage.every;
        const z = ZONES.gallery;
        const tx = DL.clamp(lx + vx * n.cage.lead, z[0] + 30, z[2] - 30), ty = DL.clamp(ly + vy * n.cage.lead, z[1] + 30, z[3] - 20);
        cages.push({ x: tx, y: ty, t: 0, down: false, life: n.cage.stand, lock: 0, atk: 0 });
      }
    }
    for (const c of cages) {
      c.t += dt;
      if (!c.down && c.t >= n.cage.warn) {
        c.down = true;
        G.camera.shake = Math.max(G.camera.shake || 0, 5);
        sfx("clink");
        for (let i = 0; i < 8; i++) G.puff(ox + c.x + DL.rand(-26, 26), oy + c.y, "rgba(120,110,105,0.7)", 60, 0.6);
        if (!p.mCage && Math.hypot(lx - c.x, ly - c.y) < n.cage.r && !(p.dashT > 0)) {
          hurt(n.cage.dmg, Math.PI / 2, "a falling cage");
          p.mCage = c; c.lock = n.cage.lock; c.atk = p.attackN || 0; c.life = Math.max(c.life, n.cage.lock + n.cage.after);
          DL.UI && DL.UI.toast("Caged! Attack or dash to shake it loose.", "warn");
        }
      }
      if (c.down && p.mCage !== c) c.life -= dt;
    }
    cages = cages.filter((c) => !c.down || c.life > 0 || p.mCage === c);

    // the Crystal Stair: flame jets on a rhythm
    if (inZone(lx, ly, "ncw")) {
      for (const j of JETS) {
        const k = jk(j);
        if (k < n.jet.warn) {
          if (Math.random() < dt * 14) G.puff(ox + (j.side < 0 ? JET_X0 + 10 : JET_X1 - 10), oy + j.y - 20, "rgba(90,85,85,0.7)", 30, 0.8, -20);
        } else if (k < n.jet.warn + n.jet.burn) {
          if (!j.lit) { j.lit = true; sfx("flameHit"); }
          if (lx > JET_X0 && lx < JET_X1 && Math.abs(ly - j.y) < n.jet.half) hurt(n.jet.dmg, j.side < 0 ? 0 : Math.PI, "a flame jet");
        } else j.lit = false;
      }
    }

    // the Broken Causeway: lava geysers
    if (inZone(lx, ly, "nce")) {
      for (const g of GEYSERS) {
        const k = (now + g.off) % n.geyser.every;
        if (k >= n.geyser.warn && !g.burst) {
          g.burst = true;
          sfx("flameHit");
          DL.Bullets.ring(ox + g.x, oy + g.y - 10, n.geyser.globs, Math.random() * TAU, { speed: n.geyser.speed, kind: 4, dmg: n.geyser.globDmg, by: "a lava glob", life: n.geyser.globLife });
          for (let i = 0; i < 10; i++) G.spark(ox + g.x + DL.rand(-14, 14), oy + g.y - DL.rand(0, 40), "255,150,50", 140);
        }
        if (k < n.geyser.warn) g.burst = false;
        if (k >= n.geyser.warn && k < n.geyser.warn + n.geyser.burn && Math.hypot(lx - g.x, (ly - g.y) * 1.4) < n.geyser.r) hurt(n.geyser.dmg, -Math.PI / 2, "a lava geyser");
      }
    }

    // crumbling tiles (the Crystal Stair and the causeway to the Roost)
    let onTile = null;
    for (const t of TILES) {
      const q = t.q, on = lx > q[0] && lx < q[2] && ly > q[1] && ly < q[3];
      if (on) onTile = t;
      if (t.st === 0 && on) { t.st = 1; t.t = 0; sfx("chop"); }
      else if (t.st === 1 && (t.t += dt) >= n.tile.crack) { t.st = 2; t.t = 0; sfx("shatter"); for (let i = 0; i < 6; i++) G.puff(ox + (q[0] + q[2]) / 2 + DL.rand(-16, 16), oy + (q[1] + q[3]) / 2, "rgba(60,40,36,0.8)", 40, 0.6, 40); }
      else if (t.st === 2 && (t.t += dt) >= n.tile.gone) { t.st = 0; t.t = 0; }
    }
    if (onTile && onTile.st === 2 && !(p.dashT > 0) && !p.mCage) {
      // fell through: hurt, and back up on the last sound stone
      hurt(n.tile.dmg, Math.PI / 2, "a crumbling floor");
      const s = p.mSafe || { x: ox, y: oy + 1680 };
      p.x = s.x; p.y = s.y; p.spx = p.x; p.spy = p.y; p.kx = p.ky = 0;
      for (let i = 0; i < 8; i++) G.puff(p.x + DL.rand(-14, 14), p.y - DL.rand(0, 40), "rgba(120,110,110,0.7)", 50, 0.7);
    } else if (!onTile && !p.mCage && DL.Mines.walkable(p.x, p.y)) p.mSafe = { x: p.x, y: p.y };

    // the Slag Mine: a runaway ore cart down the track
    if (inZone(lx, ly, "mine", 60)) {
      if (!cart && (sched.cart -= dt) <= 0) {
        const dir = sched.dir = -(sched.dir || -1);
        cart = { dir, x: dir > 0 ? RAIL_X0 - 40 : RAIL_X1 + 40, t: 0, rang: false };
      }
    }
    if (cart) {
      cart.t += dt;
      if (cart.t < n.cart.warn) {
        if (!cart.rang && cart.t > 0.05) { cart.rang = true; sfx("chime"); sfx("clink"); }
        if (Math.random() < dt * 30) G.spark(ox + DL.rand(RAIL_X0, RAIL_X1), oy + RAIL_Y + (Math.random() < 0.5 ? -8 : 8), "255,210,120", 40);
      } else {
        cart.x += cart.dir * n.cart.speed * dt;
        if (Math.abs(lx - cart.x) < 34 && Math.abs(ly - RAIL_Y) < 26 && !(p.dashT > 0) && !(p.inv > 0) && !p.mCage) {
          hurt(n.cart.dmg, cart.dir > 0 ? 0 : Math.PI, "a runaway ore cart");
          p.kx += cart.dir * n.cart.kb; p.ky += (ly < RAIL_Y ? -1 : 1) * n.cart.kb * 0.5;
        }
        if (cart.x < RAIL_X0 - 60 || cart.x > RAIL_X1 + 60) { cart = null; sched.cart = n.cart.every; }
      }
    }
  };

  // a fallen cage is a wall (except to the knight locked inside it)
  T.collide = function (ent, r) {
    if (!cages.length) return;
    const ox = OX(), oy = OY();
    for (const c of cages) {
      if (!c.down || ent.mCage === c) continue;
      const dx = ent.x - ox - c.x, dy = ent.y - oy - c.y, d = Math.hypot(dx, dy), min = 30 + r;
      if (d < min && d > 0.01) { ent.x = ox + c.x + (dx / d) * min; ent.y = oy + c.y + (dy / d) * min; }
    }
  };
  // is a local point on a fallen tile? (the Drowned keep off them)
  T.hole = function (lx, ly) {
    for (const t of TILES) if (t.st === 2 && lx > t.q[0] && lx < t.q[2] && ly > t.q[1] && ly < t.q[3]) return true;
    return false;
  };

  /* ---------------- drawing (Robert's art from DL.Mines.IMG; coded until it loads) ---------------- */
  const art = (n) => DL.Mines.IMG && DL.Mines.IMG[n];
  // a drawn piece w px wide (height kept), its foot at (x, y); flip mirrors it
  function put(c, im, x, y, w, flip) {
    const h = (w * im.height) / im.width;
    if (!flip) { c.drawImage(im, x - w / 2, y - h, w, h); return; }
    c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(im, -w / 2, y - h, w, h); c.restore();
  }
  // where a geyser is drawn standing (its burst y-sorted) rather than on the floor
  const geyserUp = (k, n) => k > n.warn - 0.3 && k < n.warn + n.burn + 0.5;
  const vis = (view, x, y, m) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m;
  function tongue(c, x, y, w, h, t, seed) { // one flickering flame tongue, base at (x, y)
    const cols = ["#ff5a10", "#ff9a2a", "#ffe08a"];
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.3, hh = h * k * (0.85 + 0.15 * Math.sin(t * 13 + seed + i)), ww = w * k;
      c.fillStyle = cols[i];
      c.beginPath(); c.moveTo(x - ww, y);
      c.quadraticCurveTo(x - ww * 0.7, y - hh * 0.6, x + Math.sin(t * 9 + seed) * w * 0.3, y - hh);
      c.quadraticCurveTo(x + ww * 0.7, y - hh * 0.6, x + ww, y); c.closePath(); c.fill();
    }
  }
  // on the floor, under everything: grates, vents, tiles, cage shadows, rail sparks
  T.drawFloor = function (c, view, t) {
    const ox = OX(), oy = OY(), now = G.t, n = N();
    for (const g of GRATES) {
      const x = ox + g.x, y = oy + g.y;
      if (!vis(view, x, y, 40)) continue;
      const k = now - g.at, warm = k >= 0 && k < n.grate.warn ? k / n.grate.warn : k >= n.grate.warn && k < n.grate.warn + n.grate.burn ? 1 : 0;
      const gi = art("grate-" + (warm === 0 ? 1 : k < n.grate.warn ? 2 : 3));
      if (gi) { c.drawImage(gi, x - 28, y - 23, 56, 46); continue; }
      c.fillStyle = "#140c0c"; c.fillRect(x - 26, y - 18, 52, 36);
      if (warm) { c.fillStyle = `rgba(255,${120 + 80 * warm},40,${0.35 + 0.6 * warm})`; c.fillRect(x - 24, y - 16, 48, 32); }
      c.fillStyle = "#3a302e";
      for (let i = 0; i < 6; i++) c.fillRect(x - 24 + i * 9, y - 16, 3, 32);
      c.fillRect(x - 26, y - 18, 52, 3); c.fillRect(x - 26, y + 15, 52, 3); c.fillRect(x - 26, y - 1, 52, 2);
    }
    for (const g of GEYSERS) {
      const x = ox + g.x, y = oy + g.y;
      if (!vis(view, x, y, 60)) continue;
      const k = (now + g.off) % n.geyser.every, bub = k < n.geyser.warn ? Math.max(0, (k - (n.geyser.warn - 1.2)) / 1.2) : 0;
      const gi = art("geyser-1");
      if (gi) { if (!geyserUp(k, n.geyser)) put(c, gi, x, y + 16, 64); continue; }
      c.fillStyle = "#1a0e0a"; c.beginPath(); c.ellipse(x, y, 30, 18, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(255,${110 + 90 * bub},30,${0.5 + 0.5 * bub})`; c.lineWidth = 3 + 3 * bub;
      c.beginPath(); c.ellipse(x, y, 30 + 6 * bub * Math.sin(t * 20), 18 + 3 * bub, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,140,40,${0.25 + 0.6 * bub})`; c.beginPath(); c.ellipse(x, y, 20, 11, 0, 0, TAU); c.fill();
      if (bub > 0) for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.7; c.fillStyle = "#ffd070"; c.beginPath(); c.arc(x + Math.cos(a * 1.3) * 14, y + Math.sin(a) * 7, 2 + 2 * bub * Math.abs(Math.sin(a * 2)), 0, TAU); c.fill(); }
    }
    for (const tl of TILES) {
      const q = tl.q, x = ox + q[0], y = oy + q[1], w = q[2] - q[0], h = q[3] - q[1];
      if (!vis(view, x + w / 2, y + h / 2, 60)) continue;
      const ti = art("crumble-" + (tl.st === 0 ? 1 : tl.st === 2 ? 4 : tl.t < n.tile.crack * 0.5 ? 2 : 3));
      if (ti) {
        const j = tl.st === 1 ? Math.sin(t * 40) * 1.5 * (tl.t / n.tile.crack) : 0;
        c.drawImage(ti, x + j, y, w, h);
        const back = tl.st === 2 ? Math.max(0, (tl.t - (n.tile.gone - 0.6)) / 0.6) : 0; // the stone knits back
        if (back) { c.globalAlpha = back; c.drawImage(art("crumble-1"), x, y, w, h); c.globalAlpha = 1; }
        continue;
      }
      if (tl.st === 2) {
        const back = Math.max(0, (tl.t - (n.tile.gone - 0.6)) / 0.6); // the stone knits back in the last moments
        c.fillStyle = "#2c2628"; c.fillRect(x, y, w, h);
        c.fillStyle = "rgba(90,80,82,0.9)"; c.fillRect(x + 3, y + 6, w - 6, h - 6); // the mist far below
        c.fillStyle = "#120a0a"; c.fillRect(x, y, w, 6);
        if (back) { c.fillStyle = `rgba(58,48,46,${back})`; c.fillRect(x, y, w, h); }
        continue;
      }
      c.strokeStyle = "rgba(20,10,10,0.8)"; c.lineWidth = 1.5; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      c.beginPath(); c.moveTo(x + w * 0.2, y + 3); c.lineTo(x + w * 0.45, y + h * 0.5); c.lineTo(x + w * 0.3, y + h - 3); c.moveTo(x + w * 0.45, y + h * 0.5); c.lineTo(x + w - 4, y + h * 0.4); c.stroke();
      if (tl.st === 1) {
        const k = tl.t / n.tile.crack, j = Math.sin(t * 40) * 1.5 * k;
        c.fillStyle = `rgba(255,120,40,${0.2 + 0.5 * k})`; c.fillRect(x + 2 + j, y + 2, w - 4, h - 4);
        c.strokeStyle = `rgba(255,220,140,${0.5 + 0.5 * k})`; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + 4, y + h * 0.3); c.lineTo(x + w * 0.5, y + h * 0.55); c.lineTo(x + w - 4, y + h * 0.25); c.moveTo(x + w * 0.5, y + h * 0.55); c.lineTo(x + w * 0.6, y + h - 4); c.stroke();
      }
    }
    // the flame jets' nozzles: a dragon-head block in each wall
    for (const j of JETS) {
      const x = ox + (j.side < 0 ? JET_X0 : JET_X1), y = oy + j.y;
      if (!vis(view, x, y, 60)) continue;
      const k = jk(j), warm = k < n.jet.warn ? k / n.jet.warn : k < n.jet.warn + n.jet.burn ? 1 : 0;
      const hs = art("jet-head-side");
      if (hs) { // mirrored for the east wall's heads, so every mouth faces across the stair
        const H = (HEAD_W * hs.height) / hs.width, top = y - 18 - NOZ[1] * H;
        c.save(); c.translate(x, 0); c.scale(-j.side, 1); c.drawImage(hs, -HEAD_IN, top, HEAD_W, H); c.restore();
        continue;
      }
      const hi = art("jet-head");
      if (hi) { put(c, hi, x, y + 4, 42); continue; }
      c.fillStyle = "#2a2020"; c.fillRect(x - 12, y - 30, 24, 28);
      c.fillStyle = "#4a3c38"; c.fillRect(x - 12, y - 30, 24, 4);
      c.fillStyle = `rgba(255,${120 + 100 * warm},40,${0.4 + 0.6 * warm})`; c.fillRect(x - 5 - j.side * 6, y - 20, 10, 8);
    }
    for (const cg of cages) {
      if (cg.down) continue;
      const x = ox + cg.x, y = oy + cg.y;
      if (!vis(view, x, y, 60)) continue;
      const k = Math.min(1, cg.t / N().cage.warn);
      c.fillStyle = `rgba(0,0,0,${0.15 + 0.5 * k})`; c.beginPath(); c.ellipse(x, y, 10 + 26 * k, 5 + 12 * k, 0, 0, TAU); c.fill();
    }
    if (cart && cart.t < n.cart.warn) { // the rails glow ahead of the cart
      const a = 0.3 + 0.3 * Math.sin(t * 20);
      c.fillStyle = `rgba(255,190,90,${a})`;
      c.fillRect(ox + RAIL_X0 + 6, oy + RAIL_Y - 9, RAIL_X1 - RAIL_X0 - 12, 3); c.fillRect(ox + RAIL_X0 + 6, oy + RAIL_Y + 7, RAIL_X1 - RAIL_X0 - 12, 3);
    }
  };
  function cageDraw(c, x, y, t, fall, cg) {
    const im = art(!cg.down ? "cage-hang" : cg.open ? "cage-broken" : "cage-down");
    if (im) {
      const w = cg.down ? (im.width / 2) * 0.8 : 42;
      if (!cg.down) { c.strokeStyle = "#1e1818"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - fall - 260); c.lineTo(x, y - fall - 70); c.stroke(); }
      put(c, im, x, y + 4 - fall, w);
      return;
    }
    const W = 50, H = 72, top = y - H - fall;
    c.strokeStyle = "#1e1818"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, top - 160); c.lineTo(x, top - 6); c.stroke(); // its chain
    c.fillStyle = "#5a4640"; c.beginPath(); c.ellipse(x, top + 4, W / 2, 10, 0, Math.PI, 0); c.fill();
    c.fillStyle = "#8a6e5e"; c.fillRect(x - W / 2, top + 2, W, 4); c.fillRect(x - W / 2, top + H - 4, W, 5);
    for (let i = 0; i <= 6; i++) {
      const bx = x - W / 2 + i * (W / 6) - 1.5;
      c.fillStyle = "#1a1212"; c.fillRect(bx + 1, top + 4, 3, H - 6); // a dark edge so the bars read on the stone
      c.fillStyle = "#7a6052"; c.fillRect(bx, top + 4, 3, H - 6);
      c.fillStyle = "rgba(255,200,150,0.5)"; c.fillRect(bx, top + 4, 1, H - 6); // lit from the forges
    }
  }
  // standing things, y-sorted with the knights: flame columns, falling and fallen cages, the cart, jets, geysers
  T.push = function (list, c, t, view) {
    const ox = OX(), oy = OY(), now = G.t, n = N();
    for (const g of GRATES) {
      const k = now - g.at - n.grate.warn;
      if (k < 0 || k > n.grate.burn) continue;
      const x = ox + g.x, y = oy + g.y;
      if (!vis(view, x, y, 100)) continue;
      const s = Math.min(1, k * 8, (n.grate.burn - k) * 6);
      const fi = art("grate-flame-" + (k < 0.12 ? 1 : k > n.grate.burn - 0.2 ? 4 : 2 + (Math.floor(t * 10 + g.x) & 1)));
      if (fi) { list.push({ y: y + 10, f: () => put(c, fi, x, y + 24, 62) }); continue; }
      list.push({ y: y + 10, f: () => { tongue(c, x - 12, y + 8, 12, 70 * s, t, g.x + g.y); tongue(c, x + 12, y + 8, 12, 64 * s, t, g.y); tongue(c, x, y + 12, 15, 90 * s, t, g.x); } });
    }
    for (const cg of cages) {
      const x = ox + cg.x, y = oy + cg.y;
      if (!vis(view, x, y, 120)) continue;
      const fall = cg.down ? 0 : 420 * Math.pow(1 - Math.min(1, cg.t / n.cage.warn), 0.5) + (cg.t < n.cage.warn * 0.85 ? 200 : 0);
      list.push({ y: y + (G.player && G.player.mCage === cg ? 30 : 2), f: () => cageDraw(c, x, y, t, fall, cg) }); // over a knight locked in it
    }
    if (cart && cart.t >= n.cart.warn) {
      const x = ox + cart.x, y = oy + RAIL_Y + 2;
      const ci = art("cart-side");
      if (ci && vis(view, x, y, 80)) list.push({ y, f: () => { put(c, ci, x, y + 4, 61, cart.dir < 0); for (let i = 0; i < 2; i++) G.spark(x - cart.dir * 24 + DL.rand(-4, 4), y - 2, "255,200,100", 50); } });
      else if (vis(view, x, y, 80)) list.push({ y, f: () => {
        c.fillStyle = "#120a0a"; c.fillRect(x - 22, y - 6, 8, 8); c.fillRect(x + 14, y - 6, 8, 8);
        c.fillStyle = "#3a2618"; c.fillRect(x - 26, y - 30, 52, 26); c.fillStyle = "#3e3434"; c.fillRect(x - 26, y - 30, 52, 4); c.fillRect(x - 26, y - 8, 52, 3);
        c.fillStyle = "#ff7a1a"; c.beginPath(); c.ellipse(x, y - 30, 22, 7, 0, Math.PI, 0); c.fill();
        for (let i = 0; i < 2; i++) G.spark(x - cart.dir * 24 + DL.rand(-4, 4), y - 2, "255,200,100", 50);
      } });
    }
    for (const j of JETS) {
      const k = jk(j) - n.jet.warn;
      if (k < 0 || k > n.jet.burn) continue;
      const y = oy + j.y, x0 = ox + JET_X0, x1 = ox + JET_X1;
      if (!vis(view, (x0 + x1) / 2, y, 200)) continue;
      const s = Math.min(1, k * 8, (n.jet.burn - k) * 6), from = (j.side < 0 ? x0 : x1) + j.side * -mouthOut(), len = (x1 - x0) * s;
      const fi = art("jet-" + (k < 0.12 ? 1 : k > n.jet.burn - 0.2 ? 4 : 2 + (Math.floor(t * 12 + j.y) & 1)));
      if (fi) { // Robert's flame, drawn pointing east: mirrored for the east wall's nozzles
        list.push({ y: y + n.jet.half, f: () => {
          const L = Math.max(30, (x1 - x0 + 20 - mouthOut()) * Math.min(1, k * 8)), H = 2.2 * n.jet.half;
          c.save(); c.translate(from, y - 18); c.scale(-j.side, 1); c.drawImage(fi, 0, -H / 2, L, H); c.restore();
        } });
        continue;
      }
      list.push({ y: y + n.jet.half, f: () => {
        const gr = c.createLinearGradient(from, 0, from - j.side * len, 0);
        gr.addColorStop(0, "rgba(255,240,180,0.95)"); gr.addColorStop(0.5, "rgba(255,150,40,0.9)"); gr.addColorStop(1, "rgba(255,80,10,0)");
        c.fillStyle = gr;
        c.beginPath(); c.moveTo(from, y - 18); c.lineTo(from - j.side * len, y - 18 - n.jet.half); c.lineTo(from - j.side * len, y - 18 + n.jet.half); c.closePath(); c.fill();
        for (let i = 1; i <= 4; i++) tongue(c, from - j.side * len * (i / 5), y - 4, 10, 30, t, i + j.y);
      } });
    }
    for (const g of GEYSERS) {
      const kk = (now + g.off) % n.geyser.every, gi = art("geyser-1");
      if (gi && geyserUp(kk, n.geyser)) {
        const x = ox + g.x, y = oy + g.y, d = kk - n.geyser.warn;
        if (!vis(view, x, y, 160)) continue;
        const im = art("geyser-" + (d < 0 ? 2 : d < n.geyser.burn ? 3 : 4));
        list.push({ y: y + 4, f: () => put(c, im, x, y + 16, 64) });
        continue;
      }
      const k = kk - n.geyser.warn;
      if (gi || k < 0 || k > n.geyser.burn) continue;
      const x = ox + g.x, y = oy + g.y;
      if (!vis(view, x, y, 160)) continue;
      const s = Math.min(1, k * 10, (n.geyser.burn - k) * 5);
      list.push({ y: y + 4, f: () => {
        c.fillStyle = "#ff6a14"; c.fillRect(x - 12 * s, y - 120 * s, 24 * s, 120 * s);
        c.fillStyle = "#ffb040"; c.fillRect(x - 6 * s, y - 120 * s, 12 * s, 120 * s);
        tongue(c, x, y - 110 * s, 20 * s, 40 * s, t, g.x);
      } });
    }
  };
  // above the darkness: one cached glow per burning or warning trap (so they always read)
  T.drawGlow = function (c, t, view) {
    const ox = OX(), oy = OY(), now = G.t, n = N();
    if (!glowPic) {
      glowPic = document.createElement("canvas"); glowPic.width = glowPic.height = 64;
      const g = glowPic.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,150,50,0.9)"); gr.addColorStop(0.4, "rgba(255,110,30,0.35)"); gr.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    const glow = (x, y, r, a) => { if (vis(view, x, y, r)) { c.globalAlpha = a; c.drawImage(glowPic, x - r, y - r, r * 2, r * 2); } };
    for (const g of GRATES) {
      const k = now - g.at;
      if (k < 0 || k > n.grate.warn + n.grate.burn) continue;
      glow(ox + g.x, oy + g.y - (k > n.grate.warn ? 30 : 0), k > n.grate.warn ? 60 : 34, k > n.grate.warn ? 0.6 : 0.4 * (k / n.grate.warn));
    }
    for (const j of JETS) {
      const k = jk(j);
      if (k > n.jet.warn && k < n.jet.warn + n.jet.burn) glow(ox + (JET_X0 + JET_X1) / 2, oy + j.y - 18, 110, 0.5);
    }
    for (const g of GEYSERS) {
      const k = (now + g.off) % n.geyser.every;
      if (k > n.geyser.warn - 1.2) glow(ox + g.x, oy + g.y - (k > n.geyser.warn ? 50 : 0), k > n.geyser.warn ? 80 : 40, 0.5);
    }
    for (const tl of TILES) if (tl.st === 1) glow(ox + (tl.q[0] + tl.q[2]) / 2, oy + (tl.q[1] + tl.q[3]) / 2, 34, 0.5 * (tl.t / n.tile.crack));
    if (cart && cart.t >= n.cart.warn) glow(ox + cart.x, oy + RAIL_Y - 30, 46, 0.5);
    c.globalAlpha = 1;
  };
})(window.DL);
