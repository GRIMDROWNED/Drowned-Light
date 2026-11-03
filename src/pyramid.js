/* Drowned Light — the Pyramid (docs/PYRAMID-PLAN.md). The Level 1 map is a grid of squares (DL.MAP); the camp is the
   centre square (0, 0). Knights claim squares next to ones they hold, and every claimed square rises out of the
   ground: the camp stands as many levels high as the Central Flame's level, each ring out one level lower, so the
   base is one stepped pyramid with the flame on top. Each claimed square has a brazier at its centre (it does what
   outposts did: store supplies, travel, light; src/outposts.js) and stairs in the middle of every edge that drops.
   Anyone crossing a drop off the stairs climbs it slowly (DL.PYRAMID.climb).

   Grid square (gx, gy) covers centre ± cell/2. Claimed squares live in G.save.pyramid.sq ("gx,gy": 1) on the host;
   friends get them in snapshots through Outposts.rows. API for later steps (sieges, buildings, coverage):
   Pyramid.cell/center/ring/inGrid/has/height/limit/count/claimable/claimHost/lose/coverage/each. */
"use strict";
(function (DL) {
  const G = DL.Game, M = DL.MAP, P = DL.PYRAMID;
  const CELL = M.cell, HALF = CELL / 2, RINGS = M.rings;
  const say = (m, k) => { if (DL.UI) DL.UI.toast(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const Py = (DL.Pyramid = {});
  const key = (gx, gy) => gx + "," + gy;
  let held = new Set(["0,0"]);  // the squares the knights hold (the camp always)
  const shown = new Map();       // the height each square is drawn at, easing toward its real height

  /* ---------------- grid ---------------- */
  Py.cell = (x, y) => ({ gx: Math.round(x / CELL), gy: Math.round(y / CELL) });
  Py.center = (gx, gy) => ({ x: gx * CELL, y: gy * CELL });
  Py.ring = (gx, gy) => Math.max(Math.abs(gx), Math.abs(gy));
  Py.inGrid = (gx, gy) => Py.ring(gx, gy) <= RINGS;
  Py.has = (gx, gy) => held.has(key(gx, gy));
  Py.count = () => held.size - 1; // claimed squares, not counting the camp
  Py.total = () => (2 * RINGS + 1) * (2 * RINGS + 1) - 1;
  Py.coverage = () => Py.count() / Py.total();
  Py.each = (fn) => { for (const k of held) { const [gx, gy] = k.split(",").map(Number); fn(gx, gy); } };
  // How many squares the Central Flame lets the knights hold.
  Py.limit = () => Math.max(0, P.perFlame * ((G.save.up.flame || 1) - 1));
  // Levels a held square stands above the marsh: the camp is as high as the flame's level, each ring out one lower.
  Py.height = (gx, gy) => (Py.has(gx, gy) ? Math.max(0, (G.save.up.flame || 1) - Py.ring(gx, gy)) : 0);

  /* ---------------- claiming ---------------- */
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const touches = (gx, gy) => SIDES.some(([dx, dy]) => Py.has(gx + dx, gy + dy));
  // The unclaimed square a knight at (x, y) could claim, standing near its middle: next to one the knights hold.
  Py.claimable = function (x, y) {
    if (G.cave) return null;
    const { gx, gy } = Py.cell(x, y), c = Py.center(gx, gy);
    if (!Py.inGrid(gx, gy) || Py.has(gx, gy) || !touches(gx, gy)) return null;
    if (Math.abs(x - c.x) > P.claimR || Math.abs(y - c.y) > P.claimR) return null;
    return { gx, gy, x: c.x, y: c.y };
  };
  Py.cost = (gx, gy) => DL.scaleCost(Object.assign({}, P.cost[Math.min(P.cost.length - 1, Py.ring(gx, gy) - 1)]));
  // Why it can't be claimed (null when it can).
  Py.lock = function (gx, gy) {
    if (Py.count() >= Py.limit()) return Py.limit() === 0 ? "Raise the Central Flame to level 2 to claim land" : "Raise the Central Flame to hold more squares";
    if (!G.canAfford(Py.cost(gx, gy))) return "Not enough in the camp's stash";
    return null;
  };
  // The host claims a square (a friend's claim comes as an "outpost" event, src/net.js).
  Py.claimHost = function (gx, gy, mine) {
    if (!Py.inGrid(gx, gy) || Py.has(gx, gy) || !touches(gx, gy)) return false;
    const lock = Py.lock(gx, gy);
    if (lock) { if (mine) { sfx("deny"); say(lock + ".", "warn"); } return false; }
    G.pay(Py.cost(gx, gy));
    G.save.pyramid.sq[key(gx, gy)] = 1;
    G.persist();
    DL.Outposts.reset();
    const c = Py.center(gx, gy);
    sfx("build");
    for (let i = 0; i < 30; i++) G.puff(c.x + DL.rand(-HALF, HALF), c.y + DL.rand(-HALF, HALF), "rgba(160,130,90,0.5)", 60, 1.1, -20);
    const msg = `The square rises out of the marsh: ${Py.count()} of ${Py.limit()} squares held, ${Math.round(Py.coverage() * 100)}% of the land.`;
    say(msg, "good");
    DL.Net.say(msg, "good");
    return true;
  };
  // The Drowned take a square (for the sieges, step 5): it sinks back into the marsh.
  Py.lose = function (gx, gy) {
    if ((gx === 0 && gy === 0) || !Py.has(gx, gy)) return false;
    delete G.save.pyramid.sq[key(gx, gy)];
    G.persist();
    DL.Outposts.reset();
    return true;
  };

  // Load the held squares from the save. Old saves' outposts become the squares they stood in.
  Py.reset = function () {
    const s = (G.save.pyramid = G.save.pyramid || { sq: {} });
    s.sq = s.sq || {};
    if (G.save.outposts && G.save.outposts.length) {
      for (const [, , x, y] of G.save.outposts) { const { gx, gy } = Py.cell(x, y); if (Py.inGrid(gx, gy) && (gx || gy)) s.sq[key(gx, gy)] = 1; }
      G.save.outposts = [];
    }
    Py.setHeld(Object.keys(s.sq));
  };
  // The squares held (from the save on the host, from a snapshot on a friend's device).
  Py.setHeld = function (keys) {
    held = new Set(["0,0", ...keys]);
  };

  /* ---------------- buildings ---------------- */
  // A numeric 1 is an older held square. Widen it only when adding a building, preserving siege HP.
  Py.cleanBuildings = function (b) {
    const out = {};
    for (const [id, def] of Object.entries(P.build)) out[id] = Math.max(0, Math.min(def.max, Math.floor(Number(b && b[id]) || 0)));
    return out;
  };
  Py.buildings = function (gx, gy) {
    const o = G.isGuest() && G.outposts.find((q) => q.gx === gx && q.gy === gy);
    const s = G.save.pyramid && G.save.pyramid.sq[key(gx, gy)];
    return Py.cleanBuildings(o ? o.b : s && s.b);
  };
  Py.buildCost = (gx, gy, id) => {
    const def = P.build[id], lv = Py.buildings(gx, gy)[id];
    return def && lv < def.max ? DL.scaleCost({ ...def.costs[lv] }) : null;
  };
  Py.buildLock = function (gx, gy, id, actor = G.player) {
    if (!Number.isInteger(gx) || !Number.isInteger(gy) || !Py.inGrid(gx, gy) || !(gx || gy) || !Py.has(gx, gy)) return "Build at a square you hold";
    const c = Py.center(gx, gy);
    if (G.cave || !actor || actor.down || actor.downT > 0 || !Number.isFinite(actor.x) || !Number.isFinite(actor.y) || DL.dist(actor.x, actor.y, c.x, c.y) > P.buildR) return "Stand at this square's fire to build";
    const def = Object.prototype.hasOwnProperty.call(P.build, id) && P.build[id];
    if (!def) return "Unknown building";
    const lv = Py.buildings(gx, gy)[id];
    if (lv >= def.max) return "Complete";
    if (G.save.up.flame < def.reqFlame[lv]) return `Needs Central Flame ${def.reqFlame[lv]}`;
    if (!G.canAfford(Py.buildCost(gx, gy, id))) return "Not enough in the camp's stash";
    return null;
  };
  Py.buildHost = function (gx, gy, id, actor = G.player) {
    if (G.isGuest() || Py.buildLock(gx, gy, id, actor)) return false;
    const b = Py.buildings(gx, gy), cost = Py.buildCost(gx, gy, id), k = key(gx, gy);
    G.pay(cost);
    const s = G.save.pyramid.sq[k];
    const state = typeof s === "object" && s ? s : (G.save.pyramid.sq[k] = {});
    b[id]++;
    state.b = b;
    G.persist();
    DL.Outposts.reset();
    sfx("build");
    const message = `${P.build[id].name} level ${b[id]} built on square ${gx}, ${gy}.`;
    say(message, "good"); DL.Net.say(message, "good");
    return true;
  };
  Py.build = function (id) {
    const o = G.atOutpost;
    if (!o || Py.buildLock(o.gx, o.gy, id)) return false;
    if (G.isGuest()) { DL.Net.event({ t: "squareBuild", gx: o.gx, gy: o.gy, id }); return true; }
    return Py.buildHost(o.gx, o.gy, id);
  };

  // Camp's four corner towers and gate-side pylons, translated to this square's centre.
  Py.layout = function (gx, gy) {
    const c = Py.center(gx, gy), b = Py.buildings(gx, gy), r = P.wallR, corner = r - 56;
    const towers = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, DL.Camp.towerCount(b.tower)).map(([x, y]) => ({ x: c.x + x * corner, y: c.y + y * corner }));
    const gates = [[0, -1, -96], [0, 1, 96], [1, 0, -96], [-1, 0, 96], [0, -1, 96], [0, 1, -96]];
    const pylons = gates.slice(0, b.pylon * 2).map(([x, y, along]) => ({ x: c.x + x * (r - 20) - y * along, y: c.y + y * (r - 20) + x * along }));
    return { ...c, r, b, towers, pylons, barracks: b.barracks ? { x: c.x - 100, y: c.y + 115 } : null };
  };
  Py.refreshBuildings = function (o) {
    o.b = Py.buildings(o.gx, o.gy);
    const L = Py.layout(o.gx, o.gy), old = o.pylons || [];
    o.pylons = L.pylons.map((q, i) => Object.assign(old[i] || { kind: "pylon", square: true, hp: P.pylonHp, max: P.pylonHp, lit: true, hitT: 0, rad: 8 }, q));
    o.towerCd = o.towerCd || [];
  };
  Py.pylons = () => G.outposts.flatMap((o) => o.pylons || []);
  Py.collide = function (ent, r) {
    if (G.cave) return;
    for (const o of G.outposts) {
      if (DL.Camp.sq(ent.x - o.x, ent.y - o.y) > P.wallR + r + 10) continue;
      const L = Py.layout(o.gx, o.gy);
      if (L.b.wall) DL.Camp.collideSquareWalls(ent, r, o.x, o.y, P.wallR, P.gateHalf);
      for (const q of [...L.towers.map((q) => ({ ...q, r: 14 })), ...(o.pylons || []).map((q) => ({ ...q, r: 6 }))]) {
        const dx = ent.x - q.x, dy = ent.y - q.y, d = Math.hypot(dx, dy), m = q.r + r;
        if (d > 0.01 && d < m) { ent.x = q.x + dx / d * m; ent.y = q.y + dy / d * m; }
      }
    }
  };
  Py.route = function (x, y, tx, ty) {
    // Leave the square we stand in first; otherwise enter the nearest wall square along the route.
    const sorted = G.outposts.filter((o) => o.b && o.b.wall).sort((a, b) => {
      const ai = DL.Camp.sq(x - a.x, y - a.y) < P.wallR, bi = DL.Camp.sq(x - b.x, y - b.y) < P.wallR;
      return (bi - ai) || (DL.dist(x, y, a.x, a.y) - DL.dist(x, y, b.x, b.y));
    });
    for (const o of sorted) {
      if (!o.b || !o.b.wall) continue;
      const q = DL.Camp.routeSquare(x, y, tx, ty, o.x, o.y, P.wallR, P.gateHalf);
      if (q) return q;
    }
    return null;
  };
  Py.updateBuildings = function (dt) {
    if (G.isGuest() || !G.night || G.cave) return;
    for (const e of G.enemies) e.squareStakeT = Math.max(0, (e.squareStakeT || 0) - dt);
    for (const o of G.outposts) {
      const L = Py.layout(o.gx, o.gy);
      if (L.b.wall) for (const e of G.enemies) {
        if (e.removed || e.rise > 0 || e.def.fly || e.squareStakeT > 0) continue;
        const x = e.x - o.x, y = e.y - o.y, along = Math.abs(x) >= Math.abs(y) ? y : x;
        if (Math.abs(DL.Camp.sq(x, y) - P.wallR) > e.def.radius + 14 || Math.abs(along) < P.gateHalf) continue;
        e.squareStakeT = P.wallEvery;
        G.hitEnemy(e, P.wallDamagePerLevel * L.b.wall, Math.atan2(y, x), 0);
      }
      L.towers.forEach((t, i) => {
        o.towerCd[i] = Math.max(0, (o.towerCd[i] || 0) - dt);
        if (o.towerCd[i] > 0) return;
        let enemy = null, best = P.towerRange;
        for (const e of G.enemies) {
          if (e.rise > 0 || e.dormant || e.removed) continue;
          const d = DL.dist(t.x, t.y, e.x, e.y);
          if (d < best) { enemy = e; best = d; }
        }
        if (!enemy) return;
        o.towerCd[i] = P.towerEvery;
        const y = t.y - (DL.Art.sprites.tower1 ? [0, 106, 112, 118][L.b.tower] : 56);
        const a = Math.atan2(enemy.y - 20 - y, enemy.x - t.x);
        G.projectiles.push({ x: t.x, y, vx: Math.cos(a) * P.towerSpeed, vy: Math.sin(a) * P.towerSpeed, life: 1.3, dmg: P.towerDamage + P.towerPerLevel * L.b.tower, hostile: false, kind: "bolt", col: "255,190,110" });
      });
    }
  };
  Py.buildingLights = function (L) {
    for (const q of Py.pylons()) if (q.lit) L.push({ x: q.x, y: q.y - 40, r: P.pylonLight * G.diff().light, s: 1, col: "255,170,80", a: 0.85, flick: 1, kind: "human" });
  };
  Py.pushBuildings = function (list, c, t, view, sprite, fire) {
    for (const o of G.outposts) {
      if (o.x < view.left - CELL || o.x > view.right + CELL || o.y < view.top - CELL || o.y > view.bottom + CELL) continue;
      const L = Py.layout(o.gx, o.gy);
      if (L.b.wall) for (const q of DL.Camp.ring(P.wallR, P.wallStep)) {
        const along = Math.abs(q.x) === P.wallR ? q.y : q.x;
        if (Math.abs(along) < P.gateHalf) continue;
        const x = o.x + q.x, y = o.y + q.y;
        const side = Math.abs(q.x) === P.wallR, suffix = L.b.wall >= 3 ? "2" : "";
        const name = side && DL.Art.sprites["palisadeSide" + suffix] ? "palisadeSide" + suffix : "palisade" + suffix;
        list.push({ y, f: () => sprite(c, name, x, y + 2, q.x < 0) });
      }
      for (const q of L.towers) list.push({ y: q.y, f: () => sprite(c, "tower" + L.b.tower, q.x, q.y + 4) });
      for (const q of o.pylons || []) list.push({ y: q.y, f: () => {
        sprite(c, "pylon" + L.b.pylon, q.x, q.y + 4);
        if (q.lit) fire(c, q.x, q.y - 70, 0.55, t);
      } });
    }
  };

  /* ---------------- climbing ---------------- */
  const faceH = (d) => Math.min(P.maxFace, d) * P.face; // px of rock face for a drop of d levels
  // The drop across the edge of square (gx, gy) toward (dx, dy): its height minus the neighbour's (>0: a drop).
  const drop = (gx, gy, dx, dy) => Py.height(gx, gy) - Py.height(gx + dx, gy + dy);
  // Is (x, y) on the stairs in the middle of an edge?
  const onStair = (along) => Math.abs(along) < P.stairW / 2;
  /* Speed for a walker at (x, y): P.climb while it's on a step edge's face or lip off the stairs, else 1.
     The band is the face on a south edge (drawn on the high square, as tall as the drop) and 20 px elsewhere,
     plus 12 px at the foot on the low side. */
  Py.speedMult = function (ent) {
    if (G.cave || DL.Cave.inRegion(ent.x, ent.y)) return 1;
    const { gx, gy } = Py.cell(ent.x, ent.y), c = Py.center(gx, gy);
    const lx = ent.x - c.x, ly = ent.y - c.y; // -HALF..HALF
    for (const [dx, dy] of SIDES) {
      const edge = dx ? dx * lx : dy * ly;         // how far toward this edge: HALF at it
      const along = dx ? ly : lx;
      const d = drop(gx, gy, dx, dy);
      if (d > 0) {
        // this square is the high side: its lip (or face, on the south) runs along the edge
        const band = dy === 1 ? faceH(d) : 20;
        if (edge > HALF - band && !onStair(along)) return P.climb;
      } else if (d < 0) {
        // the low side: the foot of the step
        if (edge > HALF - 12 && !onStair(along)) return P.climb;
      }
    }
    return 1;
  };

  /* ---------------- drawing ---------------- */
  // Each square's drawn height eases toward its real one, so a square (or the whole pyramid) rises.
  Py.update = function (dt) {
    for (const k of held) if (!shown.has(k)) shown.set(k, 0);
    for (const [k, v] of shown) {
      const [gx, gy] = k.split(",").map(Number), h = Py.height(gx, gy);
      if (v === h) continue;
      const nv = v < h ? Math.min(h, v + dt * P.riseSpeed) : Math.max(h, v - dt * P.riseSpeed);
      if (nv <= 0 && !held.has(k)) shown.delete(k); else shown.set(k, nv);
    }
  };
  const sh = (gx, gy) => shown.get(key(gx, gy)) || 0;

  // Rock faces, lips and stairs on the ground layer (src/render.js), for the squares in view.
  Py.drawGround = function (c, view) {
    if (G.cave) return;
    const g0x = Math.round(view.left / CELL) - 1, g1x = Math.round(view.right / CELL) + 1;
    const g0y = Math.round(view.top / CELL) - 1, g1y = Math.round(view.bottom / CELL) + 1;
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const h = sh(gx, gy);
      if (h <= 0.01) continue;
      const { x, y } = Py.center(gx, gy), L = x - HALF, T = y - HALF;
      // a faint stone wash on the raised top, so held land reads at a glance
      c.fillStyle = `rgba(150,140,115,${Math.min(0.1, 0.025 * h)})`;
      c.fillRect(L, T, CELL, CELL);
      for (const [dx, dy] of SIDES) {
        const d = h - sh(gx + dx, gy + dy);
        if (d <= 0.01) continue;
        if (dy === 1) southFace(c, L, T + CELL, d);
        else if (dy === -1) rimH(c, L, T, CELL);
        else rimV(c, dx === 1 ? L + CELL - 4 : L, T, dx);
      }
    }
  };
  // The face on a square's south edge: rough stone courses, darker toward the foot, stairs in the middle.
  function southFace(c, L, foot, d) {
    const H = faceH(d), top = foot - H, sx = L + HALF - P.stairW / 2;
    const grad = c.createLinearGradient(0, top, 0, foot);
    grad.addColorStop(0, "#8d8370"); grad.addColorStop(0.12, "#5f5849"); grad.addColorStop(1, "#2a2620");
    c.fillStyle = grad;
    c.fillRect(L, top, CELL, H);
    // courses of stone
    c.fillStyle = "rgba(0,0,0,0.28)";
    for (let yy = top + 10; yy < foot - 2; yy += 10) c.fillRect(L, yy, CELL, 2);
    for (let yy = top + 10, row = 0; yy < foot; yy += 10, row++) for (let xx = L + (row % 2 ? 0 : 22); xx < L + CELL; xx += 44) c.fillRect(xx, yy, 2, 10);
    // the lip, and the shadow it throws on the ground below
    c.fillStyle = "rgba(205,190,150,0.55)"; c.fillRect(L, top, CELL, 3);
    const sg = c.createLinearGradient(0, foot, 0, foot + 18);
    sg.addColorStop(0, "rgba(0,0,0,0.45)"); sg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sg; c.fillRect(L, foot, CELL, 18);
    // stairs: lit treads stepping down to the foot
    const n = Math.max(2, Math.round(H / 8)), st = H / n;
    for (let i = 0; i < n; i++) {
      const yy = top + i * st;
      c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(sx, yy, P.stairW, st);
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(sx, yy + st - 2, P.stairW, 2);
    }
    c.fillStyle = "#3a342b"; c.fillRect(sx - 6, top, 6, H); c.fillRect(sx + P.stairW, top, 6, H); // the stair's side walls
  }
  // A north edge seen from above: a pale lip on the high side, a dark line below it, and the stairs' landing.
  function rimH(c, L, T, w) {
    c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(L, T, w, 3);
    c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(L, T - 3, w, 3);
    const sx = L + HALF - P.stairW / 2;
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(sx, T + i * 5, P.stairW, 5); }
  }
  // An east or west edge: lip and shadow line along it, and the stairs' treads crossing it.
  function rimV(c, X, T, dx) {
    c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(X, T, 3, CELL);
    c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(X + (dx === 1 ? 4 : -3), T, 3, CELL);
    const sy = T + HALF - P.stairW / 2, x0 = dx === 1 ? X - 16 : X;
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(x0 + i * 5, sy, 5, P.stairW); }
  }

  /* ---------------- HUD ---------------- */
  Py.line = () => `${Py.count()} / ${Py.limit()} squares held · ${Math.round(Py.coverage() * 100)}% of the land (${Math.round(P.win * 100)}% wakes the Drowned Gate)`;
})(window.DL);

