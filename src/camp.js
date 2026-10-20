/* Drowned Light — base camp layout: where every structure stands at each tier,
   the palisade ring with its four gates, and how bodies get through them. */
"use strict";
(function (DL) {
  const PI = Math.PI;
  const R = DL.WALL_R;
  const GATES = [-PI / 2, 0, PI / 2, PI]; // north, east, south, west
  const GATE_HALF = 24;                    // half the gate opening, in world px
  const Camp = (DL.Camp = { GATES, GATE_HALF });

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
    const diag = R - 52;
    L.towers = [[-3 * PI / 4], [-PI / 4], [3 * PI / 4]].slice(0, up.tower).map(([a]) => ({ x: Math.cos(a) * diag, y: Math.sin(a) * diag }));
    const pa = [[-PI / 2, -0.42], [PI / 2, -0.42], [0, -0.42], [PI, -0.42], [-PI / 2, 0.42], [PI / 2, 0.42]];
    L.pylons = pa.slice(0, up.pylon * 2).map(([g, o]) => ({ x: Math.cos(g + o) * (R - 20), y: Math.sin(g + o) * (R - 20) }));
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

  // Angular distance (as arc length on the wall) to the nearest gate, and that gate's angle.
  Camp.nearestGate = function (x, y) {
    const a = Math.atan2(y, x);
    let best = GATES[0], bd = 1e9;
    for (const g of GATES) {
      const d = Math.abs(DL.angleDiff(a, g)) * R;
      if (d < bd) { bd = d; best = g; }
    }
    return { angle: best, arc: bd };
  };

  // Keep a body (circle radius r) out of the palisade, except through a gate.
  Camp.collideWall = function (ent, r, up) {
    if (!Camp.walled(up)) return;
    const d = Math.hypot(ent.x, ent.y);
    const thick = 7 + r;
    if (Math.abs(d - R) >= thick || d < 1) return;
    if (Camp.nearestGate(ent.x, ent.y).arc < GATE_HALF - r) return;
    const nd = d < R ? R - thick : R + thick;
    ent.x = (ent.x / d) * nd;
    ent.y = (ent.y / d) * nd;
  };

  /* Where a walker at (x, y) should head to reach (tx, ty) when walls stand between them:
     line up with the nearest gate first, then walk through. */
  Camp.route = function (x, y, tx, ty, up) {
    if (!Camp.walled(up)) return null;
    const inside = Math.hypot(x, y) < R, tInside = Math.hypot(tx, ty) < R;
    if (inside === tInside) return null;
    const g = Camp.nearestGate(x, y);
    if (g.arc < GATE_HALF * 0.6) return null; // already lined up with the gate
    const rr = inside ? R - 34 : R + 34;
    return { x: Math.cos(g.angle) * rr, y: Math.sin(g.angle) * rr };
  };
})(window.DL);
