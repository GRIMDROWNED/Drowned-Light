/* Drowned Light — base camp layout: where every structure stands at each tier,
   the square palisade with a gate in the middle of each side, and how bodies get through them. */
"use strict";
(function (DL) {
  const PI = Math.PI;
  const R = DL.WALL_R;
  const GATES = [-PI / 2, 0, PI / 2, PI]; // north, east, south, west
  const GATE_HALF = 24;                    // half the gate opening, in world px
  const Camp = (DL.Camp = { GATES, GATE_HALF });

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

  // Tier I at Flame 1–2, Tier II at 3–4, Tier III at 5.
  Camp.tier = (up) => (up.flame >= 5 ? 3 : up.flame >= 3 ? 2 : 1);
  Camp.walled = (up) => up.stakes >= 2;

  let cacheKey = "", cache = null;
  Camp.layout = function (up) {
    const key = JSON.stringify(up);
    if (key === cacheKey) return cache;
    const tier = Camp.tier(up);
    const L = { tier, R };
    L.tents = [{ x: -82, y: -70, flip: false }];
    if (tier >= 2) L.tents.push({ x: 80, y: -78, flip: true });
    if (tier >= 3) L.tents.push({ x: -34, y: -132, flip: false }, { x: 40, y: -128, flip: true });
    L.banners = [{ x: -30, y: -34 }];
    if (tier >= 2) L.banners.push({ x: 30, y: -34 });
    if (tier >= 3) L.banners.push({ x: -58, y: 38 }, { x: 58, y: 38 });
    L.forge = up.forge ? { x: -138, y: 14 } : null;
    L.armory = up.armory ? { x: 136, y: 16 } : null;
    L.workbench = up.workbench ? { x: -50, y: 150 } : null;
    L.garden = up.garden ? { x: 66, y: 140 } : null;
    // watchtowers stand in the corners, pylons along the walls either side of the gates
    const cn = R - 56;
    L.towers = [[-1, -1], [1, -1], [-1, 1]].slice(0, up.tower).map(([sx, sy]) => ({ x: sx * cn, y: sy * cn }));
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
  for (const g of GATES) for (const sgn of [-1, 1]) {
    WALLS.push([Camp.gatePoint(g, sgn * (GATE_HALF + 7), 0), Camp.gatePoint(g, sgn * R, 0), Math.round(Math.cos(g)), Math.round(Math.sin(g))]);
  }
  Camp.collideWall = function (ent, r, up) {
    if (!Camp.walled(up)) return;
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
    if (!Camp.walled(up)) return null;
    const inside = Camp.inside(x, y), tInside = Camp.inside(tx, ty);
    if (inside === tInside) return null;
    const g = Camp.nearestGate(x, y);
    if (g.arc < GATE_HALF * 0.6) return Camp.gatePoint(g.angle, 0, inside ? 40 : -40); // lined up: through
    return Camp.gatePoint(g.angle, 0, inside ? -34 : 34);
  };
})(window.DL);
