/* Drowned Light — the Pyramid (docs/PYRAMID-PLAN.md). The Level 1 map is a grid of squares (DL.MAP); the camp is the
   centre square (0, 0). Knights claim squares next to ones they hold, and every claimed square rises out of the
   ground: the camp stands as many levels high as the Central Flame's level, each ring out one level lower, so the
   base is one stepped pyramid with the flame on top. Each claimed square has a brazier at its centre (it does what
   outposts did: store supplies, travel, light; src/outposts.js). Robert's layout (sketch, 2026-11-03): the land builds
   out as four quarters, each level an L wrapped round the last, split by a cross of long stairways running from the
   camp down to the marsh along the axes (gx = 0 and gy = 0). Only the cross has stairs; anyone crossing a drop off
   them climbs it slowly (DL.PYRAMID.climb).

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
    if (G.isGuest() || G.save.up.flame <= 0 || (gx === 0 && gy === 0) || !Py.has(gx, gy) || !G.save.pyramid.sq[key(gx, gy)]) return false;
    const fire = G.outposts.find((o) => o.gx === gx && o.gy === gy);
    if (fire) {
      fire.lit = false; fire.hp = 0; // invalidate enemies' old goal references too
      for (const pylon of fire.pylons || []) { pylon.lit = false; pylon.hp = 0; }
    }
    delete G.save.pyramid.sq[key(gx, gy)];
    G.save.up.flame = Math.max(0, G.save.up.flame - 1);
    DL.Outposts.reset();
    DL.Siege.levelLost();
    G.persist();
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
    if (G.save.up.flame <= 0) return "This world has fallen; begin a new game";
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
      for (const q of [...L.towers.map((q) => ({ ...q, r: 14 })), ...(o.pylons || []).map((q) => ({ ...q, r: 6 })), ...(L.barracks ? [{ ...L.barracks, r: P.champion.barracksRadius }] : [])]) {
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
  // Stairs only where an edge crosses the cross of stairways: north/south edges of the gx = 0 column, east/west of gy = 0.
  const axis = (gx, gy, dx) => (dx ? gy === 0 : gx === 0);
  Py.axis = axis;
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
        if (edge > HALF - band && !(axis(gx, gy, dx) && onStair(along))) return P.climb;
      } else if (d < 0) {
        // the low side: the foot of the step
        if (edge > HALF - 12 && !(axis(gx, gy, dx) && onStair(along))) return P.climb;
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
    Py.updateChampions(dt);
  };
  const sh = (gx, gy) => shown.get(key(gx, gy)) || 0;

  // Rock faces, lips and stairs on the ground layer (src/render.js), for the squares in view.
  Py.drawGround = function (c, view) {
    if (G.cave) return;
    const g0x = Math.round(view.left / CELL) - 1, g1x = Math.round(view.right / CELL) + 1;
    const g0y = Math.round(view.top / CELL) - 1, g1y = Math.round(view.bottom / CELL) + 1;
    // first the tops and the paved stairways of the cross, then the faces over them
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const h = sh(gx, gy);
      if (h <= 0.01) continue;
      const { x, y } = Py.center(gx, gy), L = x - HALF, T = y - HALF;
      // a faint stone wash on the raised top, so held land reads at a glance
      c.fillStyle = `rgba(150,140,115,${Math.min(0.1, 0.025 * h)})`;
      c.fillRect(L, T, CELL, CELL);
      if (gx === 0 && gy === 0) { // the camp: the four stairways start at its gates
        const a = DL.WALL_R || 235;
        lane(c, x - P.stairW / 2, y + a, P.stairW, HALF - a, false); lane(c, x - P.stairW / 2, T, P.stairW, HALF - a, false);
        lane(c, x + a, y - P.stairW / 2, HALF - a, P.stairW, true); lane(c, L, y - P.stairW / 2, HALF - a, P.stairW, true);
      } else if (gx === 0) lane(c, x - P.stairW / 2, T, P.stairW, CELL, false);
      else if (gy === 0) lane(c, L, y - P.stairW / 2, CELL, P.stairW, true);
    }
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const h = sh(gx, gy);
      if (h <= 0.01) continue;
      const { x, y } = Py.center(gx, gy), L = x - HALF, T = y - HALF;
      for (const [dx, dy] of SIDES) {
        const d = h - sh(gx + dx, gy + dy);
        if (d <= 0.01) continue;
        const st = axis(gx, gy, dx);
        if (dy === 1) southFace(c, L, T + CELL, d, st);
        else if (dy === -1) rimH(c, L, T, CELL, st);
        else rimV(c, dx === 1 ? L + CELL - 4 : L, T, dx, st);
      }
    }
  };
  /* A stretch of the cross's stairways across a held square: a paved lane of shallow treads between low kerbs
     (coded; one long flight a level, the drawn flights sit at the drops). */
  function lane(c, x, y, w, h, horiz) {
    c.fillStyle = "rgba(128,118,96,0.78)"; c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(0,0,0,0.2)";
    if (horiz) for (let xx = x + 8; xx < x + w; xx += 18) c.fillRect(xx, y, 2, h);
    else for (let yy = y + 8; yy < y + h; yy += 18) c.fillRect(x, yy, w, 2);
    c.fillStyle = "rgba(205,190,150,0.35)";
    if (horiz) { c.fillRect(x, y + 2, w, 2); c.fillRect(x, y + h - 9, w, 2); } else { c.fillRect(x + 2, y, 2, h); c.fillRect(x + w - 9, y, 2, h); }
    c.fillStyle = "rgba(44,38,30,0.85)"; // the kerbs
    if (horiz) { c.fillRect(x, y - 4, w, 5); c.fillRect(x, y + h - 1, w, 7); } else { c.fillRect(x - 5, y, 5, h); c.fillRect(x + w, y, 5, h); }
  }
  // Robert's drawn stone strips (tools/cut_pyramid.py, 2 file px per world px). Until they load, the coded stone shows.
  const ART = {};
  for (const n of ["south", "north", "east", "west", "stairS", "stairN", "stairE", "stairW"]) {
    if (typeof Image === "undefined") break; // the node tests have no images
    const img = new Image();
    img.onload = () => { ART[n] = img; };
    img.src = DL.asset("assets/sprites/pyramid/" + (n.startsWith("stair") ? "stair-" + { S: "south", N: "north", E: "east", W: "west" }[n[5]] : "step-" + n) + ".png");
  }
  // Tile a strip along a run, clipped to the box (x, y, w, h). Horizontal strips are `th` px tall, vertical ones `th` wide.
  function strip(c, img, x, y, w, h, th, vertical) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (!vertical) {
      const tw = img.width * th / img.height;
      for (let yy = y; yy < y + h; yy += th) for (let xx = x; xx < x + w; xx += tw) c.drawImage(img, xx, yy, tw + 0.5, th);
    } else {
      const tl = img.height * th / img.width;
      for (let yy = y; yy < y + h; yy += tl) c.drawImage(img, x, yy, th, tl + 0.5);
    }
    c.restore();
  }
  // The face on a square's south edge: stone courses (one drawn course per level), stairs in the middle.
  function southFace(c, L, foot, d, stair) {
    const H = faceH(d), top = foot - H, sx = L + HALF - P.stairW / 2;
    if (ART.south) {
      strip(c, ART.south, L, top, CELL, H, P.course || 18, false); // three drawn courses a level
      const sg = c.createLinearGradient(0, foot, 0, foot + 18);
      sg.addColorStop(0, "rgba(0,0,0,0.45)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sg; c.fillRect(L, foot, CELL, 18);
      if (!stair) return;
      if (ART.stairS) return c.drawImage(ART.stairS, sx - 8, top - 4, P.stairW + 16, H + 6); // the flight, stretched to the face's height
      return stairs(c, sx, top, H);
    }
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
    if (stair) stairs(c, sx, top, H);
  }
  // Stairs: lit treads stepping down to the foot (coded until the stair art comes).
  function stairs(c, sx, top, H) {
    const n = Math.max(2, Math.round(H / 8)), st = H / n;
    for (let i = 0; i < n; i++) {
      const yy = top + i * st;
      c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(sx, yy, P.stairW, st);
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(sx, yy + st - 2, P.stairW, 2);
    }
    c.fillStyle = "#3a342b"; c.fillRect(sx - 6, top, 6, H); c.fillRect(sx + P.stairW, top, 6, H); // the stair's side walls
  }
  // A north edge seen from above: a pale lip on the high side, a dark line below it, and the stairs' landing.
  function rimH(c, L, T, w, stair) {
    if (ART.north) strip(c, ART.north, L, T - 2, w, 11, 11, false);
    else { c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(L, T, w, 3); c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(L, T - 3, w, 3); }
    if (!stair) return;
    const sx = L + HALF - P.stairW / 2;
    if (ART.stairN) { // the flight going down and away to the north: its landing on this square, its foot on the land beyond
      const w = P.stairW + 16, h = w * ART.stairN.height / ART.stairN.width;
      return c.drawImage(ART.stairN, sx - 8, T + 16 - h, w, h);
    }
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(sx, T + i * 5, P.stairW, 5); }
  }
  // An east or west edge: lip and shadow line along it, and the stairs' treads crossing it.
  // Robert's east/west stairs (2026-11-03) are drawn with height, which the overhead camera never shows on a side edge,
  // so they read as stuck on (Robert: "This looks wrong"). Off until top-down side stairs are drawn (Robert chose new art);
  // meanwhile the north flight is turned on its side. The files stay.
  const SIDE_STAIR_ART = true; // the top-down redo is in (v0.15.188); west is east mirrored
  function rimV(c, X, T, dx, stair) {
    const img = dx === 1 ? ART.east : ART.west;
    if (img) strip(c, img, dx === 1 ? X - 9 : X, T, 13, CELL, 13, true);
    else {
      c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(X, T, 3, CELL);
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(X + (dx === 1 ? 4 : -3), T, 3, CELL);
    }
    if (!stair) return;
    const sy = T + HALF - P.stairW / 2, x0 = dx === 1 ? X - 16 : X;
    const st = SIDE_STAIR_ART ? (dx === 1 ? ART.stairE : ART.stairW) : null;
    if (st) { // the flight runs down and away across the edge: its landing (a third of it) on this square
      // a long flight, so it's drawn squeezed east-west (narrower treads) to about 200 px; its paved landing is the first 22%
      const h = P.stairW + 10, w = Math.min(h * st.width / st.height, 200), edge = dx === 1 ? X + 4 : X;
      return c.drawImage(st, dx === 1 ? edge - w * 0.22 : edge - w * 0.78, sy - 5, w, h);
    }
    if (ART.stairN) { // meanwhile: the north flight (seen from above) turned to run down to the east or west
      const w = P.stairW + 16, h = w * ART.stairN.height / ART.stairN.width, edge = dx === 1 ? X + 4 : X;
      c.save(); c.translate(edge, sy + P.stairW / 2); c.rotate(dx === 1 ? Math.PI / 2 : -Math.PI / 2);
      c.drawImage(ART.stairN, -w / 2, 16 - h, w, h);
      return c.restore();
    }
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(x0 + i * 5, sy, 5, P.stairW); }
  }

  /* ---------------- barracks champions ---------------- */
  // Live defenders are rebuilt from the barracks, like camp defenses; only the building level is saved.
  G.champions = [];
  const training = new Map();
  const barracksLevel = (gx, gy) => Math.min(P.build.barracks.max, Math.max(0, Py.buildings(gx, gy).barracks || 0));
  const champHome = (h) => {
    const c = Py.layout(h.gx, h.gy).barracks, C = P.champion;
    return { x: c.x + C.spawnX + h.slot * C.spacing, y: c.y + C.spawnY };
  };
  const alive = (h) => G.save.up.flame > 0 && h && h.hp > 0 && Py.has(h.gx, h.gy) && barracksLevel(h.gx, h.gy) > 0;
  const inGuard = (e, gx, gy) => {
    const c = Py.center(gx, gy);
    return Math.max(Math.abs(e.x - c.x), Math.abs(e.y - c.y)) <= P.champion.defend;
  };
  Py.resetChampions = function () { G.champions = []; training.clear(); };
  Py.updateChampions = function (dt) {
    if (G.isGuest() || G.cave || G.save.up.flame <= 0) return;
    const C = P.champion;
    G.champions = G.champions.filter(alive);
    const homes = new Set();
    Py.each((gx, gy) => {
      if (!gx && !gy) return;
      const level = barracksLevel(gx, gy);
      if (!level) return;
      const id = key(gx, gy); homes.add(id);
      // An extinguished square cannot train until its fire is restored.
      const fire = G.outposts.find((o) => o.gx === gx && o.gy === gy);
      if (!fire || !fire.lit) return;
      const count = G.champions.filter((h) => h.gx === gx && h.gy === gy).length;
      if (count >= C.count[level]) { training.delete(id); return; }
      const left = (training.has(id) ? training.get(id) : C.train[level]) - dt;
      if (left > 0) { training.set(id, left); return; }
      const slots = G.champions.filter((h) => h.gx === gx && h.gy === gy).map((h) => h.slot);
      let slot = 0; while (slots.includes(slot)) slot++;
      const h = { id: ++G.eid, champion: true, gx, gy, slot, hp: C.hp[level], maxHp: C.hp[level],
        angle: Math.PI / 2, moving: false, animT: 0, flash: 0, cd: 0, swing: 0, hit: false, tgt: null };
      Object.assign(h, champHome(h)); G.champions.push(h);
      training.set(id, C.train[level]);
      if (G.puff) G.puff(h.x, h.y - 20, "rgba(255,200,110,0.6)", 35, 0.6);
    });
    for (const id of training.keys()) if (!homes.has(id)) training.delete(id);
    for (const h of G.champions) {
      const level = barracksLevel(h.gx, h.gy), home = champHome(h);
      h.maxHp = C.hp[level]; h.hp = Math.min(h.hp, h.maxHp);
      h.animT += dt; h.flash = Math.max(0, h.flash - dt); h.cd = Math.max(0, h.cd - dt); h.moving = false;
      const valid = (e) => e && !e.removed && e.hp > 0 && e.rise <= 0 && !e.dormant && !(e.mind > 0) && inGuard(e, h.gx, h.gy);
      if (h.swing > 0) {
        const before = h.swing; h.swing = Math.max(0, h.swing - dt);
        const e = h.tgt;
        if (!h.hit && before > C.hitAt && h.swing <= C.hitAt) {
          h.hit = true;
          if (valid(e) && DL.dist(h.x, h.y, e.x, e.y) <= C.reach + e.def.radius + C.radius) {
            G.hitEnemy(e, C.dmg[level], h.angle, C.knockback, 0, true);
            G.effects.push({ type: "slash", x: h.x, y: h.y - 20, ang: h.angle, arc: 1.7,
              r: C.reach, t: 0, max: C.swing, col: "255,195,100", w: 5 });
          }
        }
        continue;
      }
      let target = null, nearest = Infinity;
      for (const e of G.enemies) if (valid(e)) {
        const d = DL.dist(h.x, h.y, e.x, e.y);
        if (d < nearest) { target = e; nearest = d; }
      }
      h.tgt = target;
      if (!target && DL.dist(h.x, h.y, home.x, home.y) < C.guard) {
        if (G.outposts.some((o) => o.gx === h.gx && o.gy === h.gy && o.lit)) h.hp = Math.min(h.maxHp, h.hp + C.regen * dt);
        continue;
      }
      const tx = target ? target.x : home.x, ty = target ? target.y : home.y;
      h.angle = Math.atan2(ty - h.y, tx - h.x);
      if (target && nearest <= C.reach + target.def.radius) {
        if (!h.cd) { h.swing = C.swing; h.hit = false; h.cd = C.cd; }
        continue;
      }
      const waypoint = Py.route ? Py.route(h.x, h.y, tx, ty) : null;
      const dx = (waypoint ? waypoint.x : tx) - h.x, dy = (waypoint ? waypoint.y : ty) - h.y, d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, C.speed * Py.speedMult(h) * dt);
      h.x += dx / d * step; h.y += dy / d * step; h.moving = true;
      DL.World.collide(h, C.radius);
      if (Py.collide) Py.collide(h, C.radius);
      DL.Finale.collide(h);
    }
  };
  // Enemies may fight a nearby defending champion just as they fight a Bone Hound.
  Py.championTarget = function (x, y, radius) {
    let best = null, d = radius;
    for (const h of G.champions) if (alive(h)) {
      const next = DL.dist(x, y, h.x, h.y);
      if (next < d) { d = next; best = h; }
    }
    return best;
  };
  Py.hurtChampion = function (h, amount) {
    if (G.isGuest() || !alive(h) || !Number.isFinite(amount) || amount <= 0) return;
    h.hp = Math.max(0, h.hp - amount); h.flash = 0.2;
    if (!h.hp) {
      const level = barracksLevel(h.gx, h.gy);
      training.set(key(h.gx, h.gy), P.champion.train[level]);
      if (G.puff) G.puff(h.x, h.y - 20, "rgba(220,190,140,0.6)", 35, 0.6);
    }
  };
  Py.championShot = function (b) {
    if (G.isGuest()) return false;
    const h = G.champions.find((h) => alive(h) && DL.dist(b.x, b.y, h.x, h.y - 22) < P.champion.radius + (b.r || 4));
    if (!h) return false;
    Py.hurtChampion(h, b.dmg); return true;
  };
  Py.championRows = function (near) {
    return G.champions.filter((h) => alive(h) && (!near || near(h.x, h.y, 1100))).map((h) =>
      [h.id, h.gx, h.gy, h.slot, h.x, h.y, h.angle, h.moving ? 1 : 0, Math.ceil(h.hp), h.maxHp, h.swing, h.flash]);
  };
  Py.applyChampions = function (rows) {
    if (G.save.up.flame <= 0) return;
    const old = new Map(G.champions.map((h) => [h.id, h]));
    G.champions = (rows || []).map((r) => Object.assign(old.get(r[0]) || { id: r[0], x: r[4], y: r[5], animT: 0 }, {
      champion: true, gx: r[1], gy: r[2], slot: r[3], tx: r[4], ty: r[5], angle: r[6], moving: !!r[7], hp: r[8], maxHp: r[9], swing: r[10], flash: r[11],
    }));
  };
  Py.guestChampions = function (dt, blend) {
    if (G.save.up.flame <= 0) return;
    for (const h of G.champions) {
      h.x += (h.tx - h.x) * blend; h.y += (h.ty - h.y) * blend;
      h.animT += dt; h.flash = Math.max(0, h.flash - dt); h.swing = Math.max(0, h.swing - dt);
    }
  };

  /* ---------------- HUD ---------------- */
  Py.line = () => `${Py.count()} / ${Py.limit()} squares held · ${Math.round(Py.coverage() * 100)}% of the land (${Math.round(P.win * 100)}% wakes the Drowned Gate)`;
})(window.DL);

