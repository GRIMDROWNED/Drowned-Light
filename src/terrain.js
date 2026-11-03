/* Drowned Light — "Four heights" test land: the marsh rises in four levels of ground, cut by cliffs and joined by ramps.
   Switched on per save from the pause menu (Land: Four heights). Off, nothing here changes the game.

   Level 0 is the low marsh, 3 the high ground. Where one level meets a lower one there's a cliff: its foot is the
   contour line, and on a south-facing edge its rock face is drawn on the high side, FACE px tall per level dropped,
   so the face sits on screen where a 3/4 view shows it. Knights and the Drowned can't walk up or down a cliff or
   onto its face: they take a ramp, a patch of ground (the ramp noise) where the levels slope into each other.
   The camp sits flat on level 1, and the special places (den, graves, garden, ring, nest, gate, cave) are slopes. */
"use strict";
(function (DL) {
  const G = DL.Game;
  const CELL = 4;                 // the height grid's resolution in world px
  const N = 256 / CELL;           // cells per chunk side (World.CH is 256)
  const CUTS = [0.42, 0.53, 0.62]; // elevation noise -> level 0 (about 30% of the land), 1 (32%), 2 (22%), 3 (16%)
  const FACE = 26;                // px of rock face per level dropped
  const RAMP = 0.6;               // ramp noise above this is a ramp (about a quarter of the land)
  const TINT = [0.62, 1, 1.38, 1.8]; // the higher, the lighter and drier
  const T = (DL.Terrain = {});
  const grids = new Map();
  let zones = null, zonesFor = null;

  T.on = () => !!(G.save && G.save.terrain === "heights");

  // Drop the height grids and the drawn ground (after switching, or for a new world).
  T.reset = function () { grids.clear(); zones = null; DL.World.ground.clear(); };

  T.toggle = function () {
    G.save.terrain = T.on() ? "flat" : "heights";
    T.reset();
    G.persist();
  };

  // The special places stand on slopes, so none is walled off on top of a cliff.
  function slopes() {
    if (zones && zonesFor === G.save.difficulty) return zones;
    zonesFor = G.save.difficulty;
    zones = [];
    const add = (f, r) => { try { const s = f(); if (s) zones.push({ x: s.x, y: s.y, r }); } catch (e) { /* not ready yet */ } };
    add(() => DL.Den.spot(), DL.DEN.clear + 160);
    add(() => DL.Kindle.spot(), 220);
    add(() => DL.Abigail.graveSpot(), DL.ABIGAIL.clear + 160);
    add(() => DL.Rose.lair(), DL.ROSE.clear + 260);
    add(() => DL.Fred.ringSpot(), DL.FRED.clear + 160);
    add(() => DL.Wyvern.nestSpot(), DL.WYVERN.clear + 200);
    add(() => DL.Cave.mouth(), 260);
    add(() => { const g = DL.Finale.gate(); return { x: g.x, y: g.y + DL.FINALE.gate.arenaY }; }, DL.FINALE.gate.clear + 900);
    return zones;
  }

  // Elevation and ramp noise sampled every CELL px (lattice points), read back blended between the four nearest,
  // so cliff lines curve smoothly instead of stepping.
  function grid(cx, cy) {
    const key = cx + "," + cy;
    let g = grids.get(key);
    if (g) return g;
    g = { e: new Float32Array(N * N), r: new Float32Array(N * N) };
    const Z = slopes(), x0 = cx * 256, y0 = cy * 256;
    const near = Z.filter((z) => Math.abs(z.x - x0 - 128) < z.r + 200 && Math.abs(z.y - y0 - 128) < z.r + 200);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + i * CELL, y = y0 + j * CELL, k = j * N + i;
      let e = DL.fbm(x / 650, y / 650, 41);
      // the camp is flat ground on level 1, easing out into the land round it
      const sq = DL.Camp.sq(x, y);
      if (sq < 900) e = DL.lerp(0.475, e, Math.max(0, (sq - 520) / 380));
      let r = DL.fbm(x / 220, y / 220, 57);
      if (DL.Cave.inRegion(x, y)) r = 1;
      for (const z of near) { const d = Math.hypot(x - z.x, y - z.y); if (d < z.r) r = Math.max(r, RAMP + 0.2 * Math.min(1, (z.r - d) / 60)); }
      g.e[k] = e; g.r[k] = r;
    }
    grids.set(key, g);
    if (grids.size > 400) grids.delete(grids.keys().next().value);
    return g;
  }
  function pt(arr, ix, iy) {
    const cx = Math.floor(ix / N), cy = Math.floor(iy / N);
    return grid(cx, cy)[arr][(iy - cy * N) * N + (ix - cx * N)];
  }
  function sample(arr, x, y) {
    const fx = x / CELL, fy = y / CELL, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const a = pt(arr, ix, iy), b = pt(arr, ix + 1, iy), c = pt(arr, ix, iy + 1), d = pt(arr, ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const tierOf = (e) => (e < CUTS[0] ? 0 : e < CUTS[1] ? 1 : e < CUTS[2] ? 2 : 3);
  T.elev = (x, y) => sample("e", x, y);
  T.tier = (x, y) => tierOf(sample("e", x, y));
  T.ramp = (x, y) => sample("r", x, y) > RAMP;

  // How far down the rock face (x, y) is, 0 at its top lip to 1 at its foot, or -1 if it isn't on one.
  T.face = function (x, y) {
    if (T.ramp(x, y)) return -1;
    const L = T.tier(x, y);
    if (L === 0) return -1;
    for (let k = CELL; k <= 3 * FACE; k += CELL) {
      const t = T.tier(x, y + k);
      if (t > L) return -1;
      if (t < L) {
        const span = (L - t) * FACE;
        return k <= span ? 1 - k / span : -1;
      }
    }
    return -1;
  };

  // May a walker step from (ax, ay) to (bx, by)? Not up or down a cliff, nor onto a rock face, except on a ramp.
  // Something already stuck on a face (the land was just switched on) may walk off it.
  function canStep(ax, ay, bx, by) {
    if (T.ramp(ax, ay) || T.ramp(bx, by)) return true;
    if (T.face(ax, ay) >= 0) return true;
    return T.tier(ax, ay) === T.tier(bx, by) && T.face(bx, by) < 0;
  }

  // Keep a walker (a knight or a Drowned) off cliffs: it slides along them, or stops. Call after it has moved.
  // A jump of more than 64 px since last frame (respawn, travel, a blink) is let through.
  T.block = function (ent) {
    if (!T.on() || DL.Cave.inRegion(ent.x, ent.y)) { ent.hx = null; return; }
    const hx = ent.hx, hy = ent.hy;
    if (hx != null && Math.abs(ent.x - hx) + Math.abs(ent.y - hy) < 64 && !canStep(hx, hy, ent.x, ent.y)) {
      if (canStep(hx, hy, ent.x, hy)) ent.y = hy;
      else if (canStep(hx, hy, hx, ent.y)) ent.x = hx;
      else { ent.x = hx; ent.y = hy; }
    }
    ent.hx = ent.x; ent.hy = ent.y;
  };

  // Nothing grows on a rock face.
  T.bare = (x, y) => T.on() && !DL.Cave.inRegion(x, y) && T.face(x, y) >= 0;

  // The ground colour at (x, y) with the land's heights painted in (World.groundColor calls this).
  T.shade = function (x, y, col) {
    if (DL.Cave.inRegion(x, y)) return col;
    const f = T.face(x, y);
    if (f >= 0) {
      // rock face: pale at the lip, darker and wetter toward the foot, in rough layers
      const s = DL.noise(x / 14, y / 3.2, 71) * 0.5 + DL.noise(x / 5, y / 9, 72) * 0.25;
      const k = 1 - 0.5 * f, base = 50 + s * 26;
      if (f > 0.8) return [base * 0.55, base * 0.55, base * 0.5]; // a dark crease where it meets the ground
      if (f < 0.12) return [base * 1.45 + 6, base * 1.4 + 6, base * 1.25]; // the lip
      return [base * k + 12, base * k + 5, base * k * 0.8];
    }
    const L = T.tier(x, y), ramp = T.ramp(x, y);
    // on a ramp the levels blend; elsewhere each level has its own light
    let m;
    if (ramp) {
      const e = T.elev(x, y), lo = [0.3, CUTS[0], CUTS[1], CUTS[2], 0.72];
      const p = Math.max(0, Math.min(3, e < CUTS[0] ? (e - 0.3) / (CUTS[0] - 0.3) - 0.5 : e < CUTS[1] ? 0.5 + (e - CUTS[0]) / (CUTS[1] - CUTS[0]) : e < CUTS[2] ? 1.5 + (e - CUTS[1]) / (CUTS[2] - CUTS[1]) : 2.5 + (e - CUTS[2]) / (lo[4] - CUTS[2])));
      const a = Math.floor(p), b = Math.min(3, a + 1);
      m = DL.lerp(TINT[a], TINT[b], p - a);
    } else m = TINT[L];
    let [r, g, b] = col;
    const grey = (r + g + b) / 3, dry = 0.1 * L;
    r = DL.lerp(r, grey, dry) * m; g = DL.lerp(g, grey, dry) * m; b = DL.lerp(b, grey, dry) * m;
    if (ramp) {
      // worn steps where a ramp crosses from one level to the next
      if (T.tier(x, y - CELL) !== L || T.tier(x - CELL, y) !== L) { r *= 0.82; g *= 0.82; b *= 0.82; }
      return [r, g, b];
    }
    // a light rim on the high side of an edge seen from above (north, east and west edges)
    if (T.tier(x, y - CELL) < L || T.tier(x - CELL, y) < L || T.tier(x + CELL, y) < L) return [r * 1.3 + 8, g * 1.3 + 8, b * 1.25 + 6];
    // a dark line at the foot of an east or west cliff
    if (T.tier(x - CELL, y) > L || T.tier(x + CELL, y) > L) return [r * 0.55, g * 0.55, b * 0.55];
    // the cliff's shadow on the low ground below a south face
    for (let k = CELL; k <= 16; k += CELL) if (T.tier(x, y - k) > L && !T.ramp(x, y - k)) { const s = 0.45 + 0.55 * (k / 16); return [r * s, g * s, b * s]; }
    return [r, g, b];
  };

  T.label = () => "Land: " + (T.on() ? "Four heights (test)" : "Flat marsh");
})(window.DL);
