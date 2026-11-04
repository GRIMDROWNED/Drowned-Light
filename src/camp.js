/* Drowned Light — base camp layout: where every structure stands at each tier,
   the square palisade with a gate in the middle of each side, and how bodies get through them. */
"use strict";
(function (DL) {
  const PI = Math.PI;
  let R = DL.WALL_R; // the palisade's half-side: Barricade levels 4 and 5 push it out (Camp.sync)
  const GATES = [-PI / 2, 0, PI / 2, PI]; // north, east, south, west
  const GATE_HALF = 24;                    // half the gate opening, in world px
  const Camp = (DL.Camp = { GATES, GATE_HALF });

  // Size the camp for the Barricade level: the walls, the ground inside them, and the deposit range follow.
  const fort = (up) => !!(DL.Refuge && DL.Refuge.on(up));
  Camp.sync = function (up) {
    const r = fort(up) ? DL.Refuge.wallR(up) : Math.max(DL.WALL_SIZES[up.stakes] || DL.WALL_SIZES[0], DL.WALL_TIER[Camp.tier(up)] || 0);
    if (r === R) return;
    R = DL.WALL_R = r;
    DL.CAMP_RADIUS = (fort(up) ? Math.min(R, DL.REFUGE.spotR) : R) - 30; // the Refuge's outer wards are fortress, not camp
    buildWalls();
    if (DL.World) DL.World.ground.clear(); // the camp earth reaches out to the new walls
  };

  // The camp is a square of half-side R: its "distance" from the centre is the larger of |x| and |y|.
  Camp.sq = (x, y) => Math.max(Math.abs(x), Math.abs(y));
  Camp.inside = (x, y) => Camp.sq(x, y) < R;
  // A point by gate g: `out` past the wall line (negative is inside), `along` the wall from the gate's middle.
  Camp.gatePoint = function (g, along, out) {
    const ux = Math.round(Math.cos(g)), uy = Math.round(Math.sin(g));
    return { x: ux * (R + out) - uy * along, y: uy * (R + out) + ux * along };
  };
  // The point at angle a on the square of half-side s.
  Camp.onSquare = function (a, s) {
    const cx = Math.cos(a), cy = Math.sin(a), k = s / Math.max(Math.abs(cx), Math.abs(cy));
    return { x: cx * k, y: cy * k };
  };
  // Points every `step` px around the square of half-side s, corners included.
  Camp.ring = function (s, step) {
    const pts = [], n = Math.max(1, Math.round((2 * s) / step));
    for (let i = 0; i < n; i++) {
      const t = -s + (2 * s * i) / n;
      pts.push({ x: t, y: -s }, { x: s, y: t }, { x: -t, y: s }, { x: -s, y: -t });
    }
    return pts;
  };

  // A new silhouette at Flame 5, 10, 15 and 20; a drowned flame keeps the first camp's shape.
  Camp.tier = (up) => Math.max(1, DL.FLAME.looks.filter((l) => up.flame >= l).length);
  Camp.walled = (up) => (fort(up) ? DL.Refuge.walled(up) : up.stakes >= 2);
  Camp.towerCount = (lv) => [0, 1, 2, 4][lv];

  let cacheKey = "", cache = null;
  Camp.layout = function (up) {
    Camp.sync(up);
    if (fort(up)) return DL.Refuge.layout(up); // the terraced fortress (src/refuge.js)
    const key = JSON.stringify(up);
    if (key === cacheKey) return cache;
    const tier = Camp.tier(up);
    const L = { tier, R };
    /* Laid out after Robert's picture (2026-11-03): the Flame's plaza in the middle on the cross of paths, a building
       in each quarter (forge NW, armory NE, workbench SW, garden SE), tents either side of the north path, and the
       companions' homes and trophies further out along the walls. Spots are fractions of the wall's half-side, so
       everything moves apart as the camp grows. */
    const at = (fx, fy, extra) => ({ x: Math.round(fx * R), y: Math.round(fy * R), ...extra });
    L.tents = [at(-0.22, -0.72, { flip: false })];
    if (tier >= 2) L.tents.push(at(0.22, -0.72, { flip: true }));
    L.banners = [at(-0.2, -0.3)];
    if (tier >= 2) L.banners.push(at(0.2, -0.3));
    if (tier >= 3) L.banners.push(at(-0.2, 0.3), at(0.2, 0.3));
    if (tier >= 4) L.banners.push(at(-0.6, -0.1), at(0.6, -0.1));
    if (tier >= 5) L.banners.push(at(-0.13, 0.62), at(0.13, 0.62));
    L.forge = up.forge ? at(-0.5, -0.38) : null;
    L.armory = up.armory ? at(0.5, -0.38) : null;
    L.workbench = up.workbench ? at(-0.5, 0.42) : null;
    L.garden = up.garden ? at(0.5, 0.42) : null;
    L.kennel = up.kennel ? at(-0.8, -0.58) : null;
    L.workshop = up.workshop ? at(0.8, -0.58) : null;
    L.bell = up.bell ? at(-0.8, -0.2) : null;
    L.roseheart = up.roseheart ? at(0.8, -0.2) : null;
    L.shrine = up.shrine ? at(-0.8, 0.26) : null;
    L.toadstool = up.toadstool ? at(0.8, 0.26) : null;
    L.roost = up.roost ? at(0.3, 0.78) : null;
    // watchtowers stand in the corners (the third level fills all four), pylons along the walls by the gates
    const cn = R - 56;
    L.towers = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, Camp.towerCount(up.tower)).map(([sx, sy]) => ({ x: sx * cn, y: sy * cn }));
    const pa = [[-PI / 2, -1], [PI / 2, -1], [0, -1], [PI, -1], [-PI / 2, 1], [PI / 2, 1]];
    L.pylons = pa.slice(0, up.pylon * 2).map(([g, o]) => Camp.gatePoint(g, o * 96, -20));
    L.boardwalks = tier >= 2;
    L.solids = [{ x: 0, y: 0, r: 16 }];
    for (const t of L.tents) L.solids.push({ x: t.x, y: t.y, r: 18 });
    for (const t of L.towers) L.solids.push({ x: t.x, y: t.y, r: 14 });
    for (const t of L.pylons) L.solids.push({ x: t.x, y: t.y, r: 6 });
    if (L.forge) L.solids.push({ x: L.forge.x, y: L.forge.y, r: 18 });
    if (L.armory) L.solids.push({ x: L.armory.x, y: L.armory.y, r: 12 });
    if (L.workbench) L.solids.push({ x: L.workbench.x, y: L.workbench.y, r: 13 });
    for (const k of ["kennel", "workshop", "shrine", "toadstool", "roost", "roseheart", "bell"]) if (L[k]) L.solids.push({ x: L[k].x, y: L[k].y, r: k === "bell" ? 12 : 16 });
    cacheKey = key;
    cache = L;
    return L;
  };

  // Distance along the wall to the nearest gate (the middle of the side the point faces), and that gate's angle.
  Camp.nearestGate = function (x, y) {
    if (Math.abs(x) >= Math.abs(y)) return { angle: x >= 0 ? 0 : PI, arc: Math.abs(y) };
    return { angle: y >= 0 ? PI / 2 : -PI / 2, arc: Math.abs(x) };
  };

  // Keep a body (circle radius r) out of the palisade, except through a gate. Each side is two stretches of
  // wall, from the corners to the gate's edge; a body is pushed off the nearest point of each it touches, so
  // it slides round a corner instead of catching on it.
  const WALLS = [];
  function buildWalls() {
    WALLS.length = 0;
    for (const g of GATES) for (const sgn of [-1, 1]) {
      WALLS.push([Camp.gatePoint(g, sgn * (GATE_HALF + 7), 0), Camp.gatePoint(g, sgn * R, 0), Math.round(Math.cos(g)), Math.round(Math.sin(g))]);
    }
  }
  buildWalls();
  Camp.collideWall = function (ent, r, up) {
    if (fort(up)) { Camp.sync(up); return DL.Refuge.collide(ent, r, up); }
    if (!Camp.walled(up)) return;
    Camp.sync(up);
    const thick = 7 + r;
    for (const [a, b, nx, ny] of WALLS) {
      const ex = b.x - a.x, ey = b.y - a.y, k = Math.max(0, Math.min(1, ((ent.x - a.x) * ex + (ent.y - a.y) * ey) / (ex * ex + ey * ey)));
      const px = a.x + ex * k, py = a.y + ey * k, dx = ent.x - px, dy = ent.y - py, d = Math.hypot(dx, dy);
      if (d >= thick) continue;
      // right on the wall line: back out to the side it came from
      const side = (ent.x * nx + ent.y * ny) < R ? -1 : 1;
      const ux = d > 0.5 ? dx / d : nx * side, uy = d > 0.5 ? dy / d : ny * side;
      ent.x = px + ux * thick;
      ent.y = py + uy * thick;
    }
  };

  /* Where a walker at (x, y) should head to reach (tx, ty) when walls stand between them:
     line up with the nearest gate first, then walk straight through along its line. */
  Camp.route = function (x, y, tx, ty, up) {
    if (fort(up)) { Camp.sync(up); return DL.Refuge.route(x, y, tx, ty, up); }
    if (!Camp.walled(up)) return null;
    Camp.sync(up);
    const inside = Camp.inside(x, y), tInside = Camp.inside(tx, ty);
    if (inside === tInside) return null;
    const g = Camp.nearestGate(x, y);
    if (g.arc < GATE_HALF * 0.6) return Camp.gatePoint(g.angle, 0, inside ? 40 : -40); // lined up: through
    return Camp.gatePoint(g.angle, 0, inside ? -34 : 34);
  };

  // The same four-gate square geometry, translated to a Pyramid square without resizing the camp.
  Camp.collideSquareWalls = function (ent, r, cx, cy, half, gate) {
    const thick = 7 + r;
    for (const a of GATES) for (const sgn of [-1, 1]) {
      const nx = Math.round(Math.cos(a)), ny = Math.round(Math.sin(a));
      const ax = cx + nx * half - ny * sgn * (gate + 7), ay = cy + ny * half + nx * sgn * (gate + 7);
      const bx = cx + nx * half - ny * sgn * half, by = cy + ny * half + nx * sgn * half;
      const ex = bx - ax, ey = by - ay;
      const k = Math.max(0, Math.min(1, ((ent.x - ax) * ex + (ent.y - ay) * ey) / (ex * ex + ey * ey)));
      const px = ax + ex * k, py = ay + ey * k, dx = ent.x - px, dy = ent.y - py, d = Math.hypot(dx, dy);
      if (d >= thick) continue;
      const side = ((ent.x - cx) * nx + (ent.y - cy) * ny) < half ? -1 : 1;
      ent.x = px + (d > 0.5 ? dx / d : nx * side) * thick;
      ent.y = py + (d > 0.5 ? dy / d : ny * side) * thick;
    }
  };
  Camp.routeSquare = function (x, y, tx, ty, cx, cy, half, gate) {
    const lx = x - cx, ly = y - cy, inside = Camp.sq(lx, ly) < half;
    const targetInside = Camp.sq(tx - cx, ty - cy) < half;
    if (inside && targetInside) return null;
    if (!inside && !targetInside) {
      // A square between us and the goal also needs a route through its two gates.
      let lo = 0, hi = 1;
      for (const [p, v] of [[lx, tx - x], [ly, ty - y]]) {
        if (Math.abs(v) < 0.001) { if (Math.abs(p) > half) return null; continue; }
        const a = (-half - p) / v, b = (half - p) / v;
        lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
      }
      if (lo > hi || hi < 0 || lo > 1) return null;
    }
    const g = Camp.nearestGate(inside ? tx - cx : lx, inside ? ty - cy : ly);
    const nx = Math.round(Math.cos(g.angle)), ny = Math.round(Math.sin(g.angle));
    const aligned = Math.abs(nx ? ly : lx) < gate * 0.6;
    const out = aligned ? (inside ? 40 : -40) : (inside ? -34 : 34);
    return { x: cx + nx * (half + out), y: cy + ny * (half + out) };
  };
})(window.DL);

