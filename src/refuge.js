/* Drowned Light — the Refuge (Robert, 2026-11-03): the camp grows over the Central Flame's 20 levels from a hearth
   on a stone foundation into a terraced fortress, after Robert's concept (/mnt/project-files/refuge/). It replaces the
   grid of claimable squares (src/pyramid.js keeps its code; the pause menu's "Refuge" switch brings the squares back:
   save.up.fortress = 0).

   Geometry: nested square terrace walls round the flame (sanctum, district terrace, outer terrace), each one level of
   drop with its south face hanging below it, solid except at stairs. Every side has a central stair (an avenue runs
   from the sanctum out through all of them) and, as the refuge grows, two side stairs on the district terrace (level 9)
   and on the outer terrace (level 15): 12 stairs round the outside at level 20. Numbers live in DL.REFUGE (src/data.js).

   Layout: each item has a hand-placed spot at level 20 in its district; earlier levels scale it in, and a fixed
   search nudges it to the nearest free ground in its quarter. Positions depend only on the levels in save.up, so
   every device and every visit sees the same refuge. Camp building ids, costs and unlocks are untouched
   (DL.UPGRADES); this only decides where they stand and what the fortress around them looks like. */
"use strict";
(function (DL) {
  const RF = DL.REFUGE;
  const Refuge = (DL.Refuge = {});
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const at = (list, lv) => { let v = null; for (const [l, x] of list) if (lv >= l) v = x; return v; };
  const FACE = () => RF.face;

  Refuge.on = (up) => { const u = up || (DL.Game.save && DL.Game.save.up); return !u || u.fortress !== 0; };
  Refuge.level = (up) => Math.max(1, Math.min(DL.FLAME.max, (up || DL.Game.save.up).flame || 1));
  Refuge.barracks = (up) => (Refuge.on(up) ? at(RF.barracks, Refuge.level(up)) || 0 : 0);
  Refuge.info = (lv) => RF.levels[lv];

  /* ---------------- geometry ---------------- */
  // The terrace rings at a level, outermost first: { id, half, face (south drop, 0 for the low wall), thick, stairs }.
  const geoCache = new Map();
  Refuge.geo = function (lv) {
    if (geoCache.has(lv)) return geoCache.get(lv);
    const cw = at(RF.centralW, lv), rings = [];
    const stairs = (side) => {
      const out = [];
      for (let s = 0; s < 4; s++) {
        out.push({ s, at: 0, w: cw, main: true });
        if (side) for (const sg of [-1, 1]) out.push({ s, at: sg * side.at, w: side.w });
      }
      return out;
    };
    // terraces from the outside in; the low wall stands round the camp until the Inner Court rises
    for (const T of [...RF.terraces].reverse()) {
      if (lv < T.from) continue;
      const half = at(T.half, lv);
      if (T.id === "sanctum" && lv >= RF.lowWall && !rings.some((r) => r.id === "main")) rings.push({ id: "low", half: RF.camp, face: 0, thick: 12, stairs: stairs(null) });
      rings.push({ id: T.id, half, face: FACE(), thick: 14, beds: !!T.beds, stairs: stairs(T.side && lv >= T.side && { at: Math.round(half * RF.sideAt), w: RF.sideW }) });
    }
    if (lv >= RF.lowWall && !rings.some((r) => r.id === "main" || r.id === "low")) rings.push({ id: "low", half: RF.camp, face: 0, thick: 12, stairs: stairs(null) });
    const outer = rings[0] && rings[0].id !== "sanctum" && rings[0].id !== "low" ? rings[0].half : 0;
    const R = Math.max(outer, RF.camp);
    const g = { lv, R, cw, rings, outerRing: rings[0] && rings[0].half === R ? rings[0] : null };
    geoCache.set(lv, g);
    return g;
  };
  // The camp's half-side (DL.WALL_R) for these levels.
  Refuge.wallR = (up) => Refuge.geo(Refuge.level(up)).R;
  // How far out the fortress (with its outermost face) reaches: world nodes inside are hidden, the ground is dry.
  Refuge.clearR = (up) => { const g = Refuge.geo(Refuge.level(up)); return g.R + (g.rings[0] ? g.rings[0].face : 0) + 24; };
  // The outer wall stands (and blocks) once there are low walls or terraces, or the Barricade's palisade.
  Refuge.walled = (up) => Refuge.geo(Refuge.level(up)).rings.some((r) => r.half === Refuge.geo(Refuge.level(up)).R) || up.stakes >= 2;

  // Rings that block at these levels: the terraces, and a palisade ring at the camp's edge when only the Barricade stands.
  function blockers(up) {
    const g = Refuge.geo(Refuge.level(up));
    if (g.rings.some((r) => r.half === g.R) || up.stakes < 2) return g.rings;
    return [{ id: "palisade", half: g.R, face: 0, thick: 7, stairs: [0, 1, 2, 3].map((s) => ({ s, at: 0, w: DL.Camp.GATE_HALF * 2 + 10, main: true })) }, ...g.rings];
  }
  Refuge.blockers = blockers;

  /* Marsh beds (Robert, 2026-11-04): the outer wards are paved over the near zones, so their resources grow only in
     kerbed beds of marsh. Fixed spots from the level-20 layout (they never move); a bed shows once its ward stands.
     World.gen makes each bed's nodes (o.rbed = the ward's id); Pyramid.hides hides them until then. */
  let bedList = null;
  Refuge.beds = function () {
    if (bedList) return bedList;
    const g = Refuge.geo(DL.FLAME.max), B = RF.bed, out = [];
    g.rings.forEach((ring, i) => {
      if (!ring.beds) return;
      const inner = g.rings[i + 1], lo = inner.half + inner.face, mid = Math.round((lo + ring.half) / 2);
      const half = Math.min(B.half, Math.floor((ring.half - lo) / 2 - 46));
      const n = Math.max(2, Math.floor((2 * mid) / B.gap) + 1), cand = [];
      for (let k = 0; k < n; k++) {
        const a = -mid + (2 * mid * k) / (n - 1);
        cand.push([a, -mid], [a, mid]);
        if (k > 0 && k < n - 1) cand.push([-mid, a], [mid, a]);
      }
      for (const [x, y] of cand) {
        const h = half + 10;
        if (free(g, [x - h, y - h, x + h, y + h], [], [])) out.push({ x, y, half, ring: ring.id, i: out.length });
      }
    });
    return (bedList = out);
  };
  Refuge.bedsAt = (lv) => { const ids = new Set(Refuge.geo(lv).rings.map((r) => r.id)); return Refuge.beds().filter((b) => ids.has(b.ring)); };
  Refuge.inBed = (x, y, up) => Refuge.bedsAt(Refuge.level(up)).some((b) => Math.abs(x - b.x) < b.half && Math.abs(y - b.y) < b.half);

  // A ring's wall as boxes [x0, y0, x1, y1] with the stair gaps cut out. The south wall is its whole hanging face.
  function wallBoxes(ring) {
    if (ring._boxes) return ring._boxes;
    const h = ring.half, t = ring.thick, out = [];
    for (let s = 0; s < 4; s++) {
      const gaps = ring.stairs.filter((q) => q.s === s).map((q) => [q.at - q.w / 2, q.at + q.w / 2]).sort((a, b) => a[0] - b[0]);
      const spans = [];
      let from = -h - t;
      for (const [a, b] of gaps) { if (a > from) spans.push([from, a]); from = Math.max(from, b); }
      if (from < h + t) spans.push([from, h + t]);
      for (const [a, b] of spans) {
        if (s === 0) out.push([a, -h - t, b, -h + t]);
        else if (s === 2) out.push([a, h - t, b, h + Math.max(t, ring.face)]);
        else if (s === 1) out.push([h - t, a, h + t, b]);
        else out.push([-h - t, a, -h + t, b]);
      }
    }
    return (ring._boxes = out);
  }
  Refuge.wallBoxes = wallBoxes;

  // Keep a body (circle radius r) out of the walls: pushed out of a box by its shortest way.
  Refuge.collide = function (ent, r, up) {
    for (const ring of blockers(up)) {
      if (DL.Camp.sq(ent.x, ent.y) > ring.half + ring.face + r + 12) continue;
      for (const [x0, y0, x1, y1] of wallBoxes(ring)) {
        const a = x0 - r, b = y0 - r, c = x1 + r, d = y1 + r;
        if (ent.x <= a || ent.x >= c || ent.y <= b || ent.y >= d) continue;
        const m = [ent.x - a, c - ent.x, ent.y - b, d - ent.y], k = m.indexOf(Math.min(...m));
        if (k === 0) ent.x = a; else if (k === 1) ent.x = c; else if (k === 2) ent.y = b; else ent.y = d;
      }
    }
  };
  // Is (x, y) inside a ring's top (not its face)?
  const inside = (ring, x, y) => Math.abs(x) < ring.half && Math.abs(y) < ring.half;
  // A stair's two ends: `inn` on the high side, `out` past the foot (below the face on the south).
  function stairEnds(ring, q, gap) {
    const [nx, ny] = SIDES[q.s]; // `at` is x along the north and south sides, y along the east and west
    const o = ring.half + (q.s === 2 ? ring.face : 0) + gap;
    return { inn: { x: nx ? nx * (ring.half - gap) : q.at, y: ny ? ny * (ring.half - gap) : q.at },
      out: { x: nx ? nx * o : q.at, y: ny ? ny * o : q.at } };
  }
  Refuge.stairEnds = stairEnds;
  /* Where a walker at (x, y) heading for (tx, ty) should go when terrace walls stand between them: the ring to cross
     first (outward, the smallest one it's inside; inward, the largest the target is inside), through the stair that
     makes the shortest way. Lined up with the stair, it walks straight through; else it heads for the stair's foot. */
  Refuge.route = function (x, y, tx, ty, up) {
    const rings = blockers(up);
    for (const r of rings) if (r.face && y >= r.half - 4 && y < r.half + r.face + 6 && Math.abs(x) < r.half) { // on a south flight: finish it
      const q = r.stairs.filter((q) => q.s === 2).reduce((a, b) => (Math.abs(b.at - x) < Math.abs(a.at - x) ? b : a));
      const e = stairEnds(r, q, 30);
      return inside(r, tx, ty) ? e.inn : e.out;
    }
    let ring = null;
    const outward = rings.filter((r) => inside(r, x, y) && !inside(r, tx, ty));
    if (outward.length) ring = outward.reduce((a, b) => (a.half < b.half ? a : b));
    else {
      const inward = rings.filter((r) => !inside(r, x, y) && inside(r, tx, ty));
      if (inward.length) ring = inward.reduce((a, b) => (a.half > b.half ? a : b));
    }
    if (!ring) return null;
    const out = !inside(ring, x, y) ? false : true;
    let best = null, bd = Infinity;
    for (const q of ring.stairs) {
      const e = stairEnds(ring, q, 34), near = out ? e.inn : e.out;
      const d = Math.hypot(near.x - x, near.y - y) + Math.hypot(tx - near.x, ty - near.y);
      if (d < bd) { bd = d; best = { q, e }; }
    }
    const { q, e } = best, [nx] = SIDES[q.s];
    const along = nx ? y : x, aligned = Math.abs(along - q.at) < q.w * 0.3;
    const near = out ? e.inn : e.out, far = out ? e.out : e.inn;
    const close = Math.hypot(near.x - x, near.y - y) < 46;
    return aligned && (close || Math.abs(DL.Camp.sq(x, y) - ring.half) < ring.face + 50) ? far : near;
  };

  /* ---------------- layout ---------------- */
  const BUILDINGS = ["forge", "armory", "workbench", "garden", "kennel", "workshop", "shrine", "toadstool", "roost", "bell", "roseheart"];
  Refuge.BUILDINGS = BUILDINGS;
  const QUAD = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] };

  // Is a footprint box free at this geometry?
  function free(g, box, placed, towers) {
    const [x0, y0, x1, y1] = box, R = g.R, lane = g.cw / 2 + 12;
    if (x0 < -R + 34 || x1 > R - 34 || y0 < -R + 34 || y1 > R - 34) return false;
    if (x1 > -lane && x0 < lane) return false; // the avenues
    if (y1 > -lane && y0 < lane) return false;
    const cx = (x0 + x1) / 2, cy = y1 - 4;
    for (const ring of g.rings) {
      const m = ring.thick + 20; // the wall's own width and room to walk past it
      if (inside(ring, cx, cy)) { if (ring.id === "sanctum") return false; if (x0 < -ring.half + m || x1 > ring.half - m || y0 < -ring.half + m || y1 > ring.half - m) return false; }
      else if (x1 > -ring.half - m && x0 < ring.half + m && y1 > -ring.half - m && y0 < ring.half + ring.face + m) return false;
      for (const q of ring.stairs) { // keep the stair's landing and foot clear
        const e = stairEnds(ring, q, 0), [nx] = SIDES[q.s], half = q.w / 2 + 26;
        const px0 = Math.min(e.inn.x, e.out.x) - (nx ? 70 : half), px1 = Math.max(e.inn.x, e.out.x) + (nx ? 70 : half);
        const py0 = Math.min(e.inn.y, e.out.y) - (nx ? half : 70), py1 = Math.max(e.inn.y, e.out.y) + (nx ? half : 70);
        if (x1 > px0 && x0 < px1 && y1 > py0 && y0 < py1) return false;
      }
    }
    for (const t of towers) if (x1 > t.x - 30 && x0 < t.x + 30 && y1 > t.y - 34 && y0 < t.y + 14) return false;
    for (const p of placed) if (x1 + 10 > p.box[0] && x0 - 10 < p.box[2] && y1 + 10 > p.box[1] && y0 - 10 < p.box[3]) return false;
    return true;
  }
  const footprint = (x, y, hw) => [x - hw, y - Math.round(hw * 0.95), x + hw, y + 4];
  // The nearest free spot to (px, py) in quadrant q (a spiral of 6 px steps), or anywhere, or null.
  function findSpot(g, px, py, hw, q, placed, towers) {
    for (let r = 0; r <= 260; r += 6) {
      const n = Math.max(1, Math.round((2 * Math.PI * r) / 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.round(px + Math.cos(a) * r), y = Math.round(py + Math.sin(a) * r);
        if (q && (Math.sign(x) !== q[0] || Math.sign(y) !== q[1])) continue;
        if (free(g, footprint(x, y, hw), placed, towers)) return { x, y };
      }
    }
    return null;
  }

  let cacheKey = "", cache = null;
  Refuge.layout = function (up) {
    const lv = Refuge.level(up);
    const key = JSON.stringify(up);
    if (key === cacheKey) return cache;
    const g = Refuge.geo(lv), R = g.R, k = Math.min(1, R / RF.spotR);
    const L = { tier: DL.Camp.tier(up), R, lv, geo: g, fortress: true, items: [], plots: [], missing: [] };
    const ti = Math.min(R, RF.spotR) - RF.towerIn; // the outer wards have their own drawn corner towers
    // north towers sit further in, as their tall picture would otherwise stand up over the north wall
    const tSpot = ([sx, sy]) => ({ x: sx * ti, y: sy * (sy < 0 ? ti - 50 : ti) });
    L.towers = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, DL.Camp.towerCount(up.tower)).map(tSpot);
    const towerSpots = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(tSpot);
    const placed = [];
    // built buildings first (they keep the best ground), then the refuge's own pieces by level, then empty plots
    const ids = [...BUILDINGS.filter((id) => up[id] > 0), ...Object.keys(RF.items).filter((id) => !BUILDINGS.includes(id) && lv >= (RF.items[id].from || 1)), ...BUILDINGS.filter((id) => !(up[id] > 0))];
    for (const id of ids) {
      const it = RF.items[id];
      if (id === "barracks" && !Refuge.barracks(up)) continue;
      const px = Math.round(it.at[0] * k), py = Math.round(it.at[1] * k);
      const spot = findSpot(g, px, py, it.hw, QUAD[it.d], placed, towerSpots) || findSpot(g, px, py, it.hw, null, placed, towerSpots);
      const built = BUILDINGS.includes(id) ? up[id] > 0 : true;
      // no room: a built building still stands (squeezed in where it would go), a refuge piece waits for more ground
      if (!spot) { if (built && BUILDINGS.includes(id)) placed.push({ id, x: px, y: py, hw: it.hw, box: footprint(px, py, it.hw), crowded: true }); L.missing.push(id); continue; }
      placed.push({ id, x: spot.x, y: spot.y, hw: it.hw, box: footprint(spot.x, spot.y, it.hw) });
    }
    for (const p of placed) {
      const it = RF.items[p.id], isB = BUILDINGS.includes(p.id);
      if (isB && up[p.id] > 0) L[p.id] = { x: p.x, y: p.y };
      else if (isB) { if (lv >= 6) L.plots.push({ x: p.x, y: p.y, hw: p.hw, reserved: true }); } // empty plots once the districts' terrace is built
      else L.items.push({ id: p.id, x: p.x, y: p.y, hw: p.hw, ph: it.ph, sprite: it.sprite, flip: it.flip });
      if (!isB || up[p.id] > 0) L.plots.push({ x: p.x, y: p.y, hw: p.hw, id: p.id });
    }
    for (const id of BUILDINGS) if (!L[id]) L[id] = null;
    const b = L.items.find((i) => i.id === "barracks");
    L.barracks = b ? { x: b.x, y: b.y } : null;
    L.tents = L.items.filter((i) => i.sprite === "tent").map((i) => ({ x: i.x, y: i.y, flip: !!i.flip }));
    // banners at the sanctum's corners (or round the hearth before it), more as it grows
    const s0r = g.rings.find((r) => r.id === "sanctum"), s = s0r ? s0r.half : 70;
    L.banners = [[-1, -1], [1, -1]].map(([sx, sy]) => ({ x: sx * (s - 22), y: sy * (s - 18) }));
    if (lv >= 10) L.banners.push(...[[-1, 1], [1, 1]].map(([sx, sy]) => ({ x: sx * (s - 22), y: sy * (s - 26) })));
    L.pylons = [[-Math.PI / 2, -1], [Math.PI / 2, -1], [0, -1], [Math.PI, -1], [-Math.PI / 2, 1], [Math.PI / 2, 1]].slice(0, up.pylon * 2)
      .map(([a, o]) => DL.Camp.gatePoint(a, o * (g.cw / 2 + 30), a < -1 ? -95 : -60)); // on open ground inside, off the wall
    L.boardwalks = false;
    L.solids = [{ x: 0, y: 0, r: 16 }];
    for (const t of L.towers) L.solids.push({ x: t.x, y: t.y, r: 14 });
    for (const t of L.pylons) L.solids.push({ x: t.x, y: t.y, r: 6 });
    for (const p of placed) if (!BUILDINGS.includes(p.id) || up[p.id] > 0) L.solids.push({ x: p.x, y: p.y - 6, r: Math.max(10, Math.round(p.hw * 0.55)) });
    // the refuge's lit pieces: braziers on the terrace corners, lamps at the stairs, beacons round the sanctum
    L.fires = [];
    const ring = (id) => g.rings.find((r) => r.id === id);
    if (lv >= 12 && ring("main")) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.fires.push({ x: sx * (ring("main").half - 16), y: sy * (ring("main").half - 16), kind: "brazier" });
    if (lv >= 13) for (const r of [ring("main")].filter(Boolean)) for (const sg of [-1, 1]) for (const [nx, ny] of SIDES) {
      const d = (ring("sanctum").half + r.half) / 2;
      L.fires.push({ x: nx * d + (ny ? sg * (g.cw / 2 + 12) : 0), y: ny * d + (nx ? sg * (g.cw / 2 + 12) : 0), kind: "torch" });
    }
    if (lv >= 19) for (const r of g.rings) if (r.id !== "sanctum" && r.half <= RF.spotR) for (const q of r.stairs) {
      const e = stairEnds(r, q, 12), [nx] = SIDES[q.s];
      for (const sg of [-1, 1]) L.fires.push({ x: e.inn.x + (nx ? 0 : sg * (q.w / 2 + 8)), y: e.inn.y + (nx ? sg * (q.w / 2 + 8) : 0), kind: "torch" });
    }
    if (lv >= 20) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.fires.push({ x: sx * (s + 4), y: sy * (s + 4) - (sy > 0 ? 0 : 0), kind: "beacon" });
    // Robert's decor (D2) on the outer wards: by each central stair's landing, inside the ward, clear of the beds
    L.decor = [];
    const KINDS = ["statue", "well", "rack", "crates", "planter", "statue", "crates", "rack"], beds = Refuge.bedsAt(lv).map((b) => ({ box: [b.x - b.half, b.y - b.half, b.x + b.half, b.y + b.half] }));
    g.rings.forEach((r, i) => {
      if (!r.beds) return;
      const inner = g.rings[i + 1], d = inner.half + inner.face + 70;
      SIDES.forEach(([nx, ny], si) => { for (const sg of [-1, 1]) {
        const x = nx * d + (ny ? sg * (g.cw / 2 + 115) : 0), y = ny * d + (nx ? sg * (g.cw / 2 + 115) : 0), hw = 22;
        if (!free(g, footprint(x, y, hw), [...placed, ...beds], [])) continue;
        L.decor.push({ x, y, kind: KINDS[(si * 2 + (sg > 0) + i) % KINDS.length] });
        L.solids.push({ x, y: y - 6, r: 12 });
      } });
    });
    for (const f of L.fires) if (f.kind !== "torch") L.solids.push({ x: f.x, y: f.y, r: 8 });
    cacheKey = key;
    cache = L;
    return L;
  };

  /* ---------------- drawing (ground layer) ---------------- */
  const pats = new WeakMap();
  function pattern(c, n) {
    const img = DL.World.canvases && DL.World.canvases[n];
    if (!img) return null;
    let m = pats.get(c);
    if (!m) pats.set(c, (m = {}));
    if (!m[n]) { m[n] = c.createPattern(img, "repeat"); m[n].setTransform(new DOMMatrix().scale(2)); }
    return m[n];
  }
  function fill(c, n, x, y, w, h, dark, fallback) {
    const p = pattern(c, n);
    c.fillStyle = p || fallback; c.fillRect(x, y, w, h);
    if (dark) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(x, y, w, h); }
  }
  const P = () => DL.Pyramid.art || {};

  /* Robert's drawn refuge pieces (tools/cut_refuge.py, 2026-11-03): the hearth's base, the bordered plaza (also each
     building's plot), the low walls and the terrace (corners, wall runs, four stairs, floor). Kit pieces keep their
     crop boxes from his pictures (KIT, source px; S world px per source px), so they line up by source coordinates:
     `edge` = the source lines laid on the wall's outer north/west/east edge and on its south edge. */
  const S = 0.3, IMG = {};
  const KIT = {
    terrace: { edge: { n: 118, w: 300, e: 1232, s: 735 }, out: 10, sIn: 8, tread: { n: [680, 855], s: [685, 850], w: [380, 575], e: [380, 575] },
      box: { nw: [305, 100, 455, 265], ne: [1080, 100, 1230, 265], sw: [300, 670, 455, 908], se: [1080, 670, 1235, 908],
        n: [455, 118, 625, 232], s: [455, 730, 625, 908], w: [298, 262, 422, 338], e: [1108, 262, 1232, 338],
        stN: [625, 95, 910, 282], stS: [622, 712, 912, 936], stW: [236, 330, 442, 628], stE: [1094, 330, 1302, 628] } },
    low: { edge: { n: 345, w: 165, e: 1092, s: 840 }, out: 10, sIn: 8,
      box: { nw: [158, 335, 268, 458], ne: [990, 335, 1098, 458], sw: [158, 805, 268, 966], se: [990, 805, 1098, 966],
        n: [268, 358, 490, 455], s: [268, 832, 475, 962], w: [170, 458, 257, 528], e: [998, 458, 1087, 528] } },
    // Robert's tall two-tier picture (L7-tall-tier, 2026-11-04): `rim` = its outer wall ring (the outer terrace), `tier` = its tall inner terrace (the sanctum)
    rim: { edge: { n: 45, w: 168, e: 1369, s: 900 }, out: 6, sIn: 8, tread: { n: [715, 825], s: [715, 830], w: [235, 300], e: [235, 300] },
      box: { nw: [150, 20, 335, 190], n: [335, 12, 520, 125], stN: [640, 22, 900, 160], w: [150, 400, 262, 520], stW: [145, 185, 265, 350], sw: [145, 790, 330, 1016], s: [330, 880, 530, 1016], stS: [640, 870, 900, 1016], ne: [1202, 20, 1387, 190], se: [1207, 790, 1392, 1016], e: [1275, 400, 1387, 520], stE: [1272, 185, 1392, 350] } },
    tier: { edge: { n: 200, w: 422, e: 1115, s: 662 }, out: 6, sIn: 8, tread: { n: [715, 825], s: [720, 830], w: [445, 525], e: [445, 525] },
      box: { nw: [415, 185, 545, 355], n: [545, 200, 665, 280], stN: [665, 190, 875, 335], w: [462, 570, 522, 640], stW: [355, 380, 530, 600], sw: [415, 590, 560, 805], s: [560, 650, 665, 805], stS: [665, 635, 880, 805], ne: [992, 185, 1122, 355], se: [977, 590, 1122, 805], e: [1015, 570, 1075, 640], stE: [1007, 380, 1182, 600] } },
    // Robert's T1 sanctum (2026-11-04, art-prompts/terrace-fortress-prompts.md)
    sanct: { edge: { n: 150, w: 165, e: 1149, s: 775 }, out: 6, sIn: 8, tread: { n: [610, 705], s: [610, 705], w: [415, 560], e: [415, 560] },
      box: { nw: [150, 85, 380, 340], n: [372, 120, 540, 290], stN: [540, 85, 775, 300], w: [150, 290, 335, 340], stW: [85, 340, 345, 720], sw: [120, 680, 375, 1062], s: [375, 760, 545, 1062], stS: [540, 740, 775, 1080], ne: [934, 85, 1164, 340], se: [939, 680, 1194, 1062], e: [979, 290, 1164, 340], stE: [969, 340, 1229, 720] } },
    // Robert's T2 Inner Court (2026-11-04)
    court: { edge: { n: 150, w: 102, e: 1210, s: 840 }, out: 6, sIn: 8, tread: { n: [600, 712], s: [600, 712], w: [470, 690], e: [470, 690] },
      box: { nw: [95, 80, 245, 290], n: [440, 135, 545, 290], stN: [545, 85, 770, 290], w: [85, 290, 350, 445], stW: [85, 440, 350, 720], sw: [80, 760, 250, 1118], s: [450, 820, 545, 1100], stS: [545, 790, 770, 1118], ne: [1067, 80, 1217, 290], se: [1062, 760, 1232, 1118], e: [962, 290, 1227, 445], stE: [962, 440, 1227, 720] } },
    // Robert's T4 Outer Ward (2026-11-04)
    ward: { edge: { n: 140, w: 78, e: 1175, s: 905 }, out: 6, sIn: 8, tread: { n: [580, 673], s: [562, 690], w: [520, 620], e: [520, 620] },
      box: { nw: [40, 10, 215, 300], n: [235, 130, 330, 295], stN: [530, 75, 723, 305], w: [70, 300, 235, 470], stW: [78, 470, 205, 650], sw: [35, 760, 215, 1182], s: [215, 900, 325, 1182], stS: [525, 830, 728, 1182], ne: [1038, 10, 1213, 300], se: [1038, 760, 1218, 1182], e: [1018, 300, 1183, 470], stE: [1048, 470, 1175, 650] } },
    // Robert's T3 Middle Ward (2026-11-04)
    mward: { edge: { n: 80, w: 85, e: 1228, s: 900 }, out: 6, sIn: 8, tread: { n: [590, 723], s: [590, 723], w: [440, 545], e: [440, 545] },
      box: { nw: [70, 28, 225, 270], n: [225, 60, 315, 230], stN: [540, 50, 773, 240], w: [85, 650, 225, 760], stW: [85, 400, 225, 580], sw: [40, 760, 230, 1139], s: [230, 860, 305, 1130], stS: [540, 790, 773, 1139], ne: [1088, 28, 1243, 270], se: [1083, 760, 1273, 1139], e: [1088, 650, 1228, 760], stE: [1088, 400, 1228, 580] } },
    // Robert's T5 Low Ward (2026-11-04)
    lward: { edge: { n: 100, w: 60, e: 1195, s: 890 }, out: 6, sIn: 8, tread: { n: [560, 695], s: [560, 695], w: [330, 440], e: [330, 440] },
      box: { nw: [28, 10, 205, 270], n: [200, 75, 285, 245], stN: [505, 35, 750, 250], w: [55, 470, 190, 560], stW: [55, 290, 190, 470], sw: [15, 750, 200, 1223], s: [200, 860, 280, 1170], stS: [505, 800, 750, 1223], ne: [1050, 10, 1227, 270], se: [1055, 750, 1240, 1223], e: [1065, 470, 1200, 560], stE: [1065, 290, 1200, 470] } },
    // Robert's T6 Curtain Terrace (2026-11-04)
    curt: { edge: { n: 110, w: 68, e: 1186, s: 905 }, out: 6, sIn: 8, tread: { n: [572, 685], s: [572, 685], w: [445, 545], e: [445, 545] },
      box: { nw: [30, 20, 225, 270], n: [222, 105, 258, 265], stN: [495, 40, 760, 270], w: [55, 590, 200, 660], stW: [55, 400, 205, 560], sw: [15, 765, 210, 1220], s: [210, 880, 255, 1215], stS: [495, 860, 760, 1225], ne: [1029, 20, 1224, 270], se: [1044, 765, 1239, 1220], e: [1054, 590, 1199, 660], stE: [1049, 400, 1199, 560] } },
    // Robert's T7 Great Wall (2026-11-04)
    great: { edge: { n: 100, w: 58, e: 1195, s: 910 }, out: 6, sIn: 8, tread: { n: [580, 675], s: [565, 690], w: [535, 620], e: [535, 620] },
      box: { nw: [20, 10, 190, 300], n: [185, 95, 300, 240], stN: [480, 10, 773, 245], w: [50, 410, 170, 450], stW: [50, 500, 170, 640], sw: [10, 840, 180, 1215], s: [180, 900, 290, 1200], stS: [460, 800, 793, 1238], ne: [1063, 10, 1233, 300], se: [1073, 840, 1243, 1215], e: [1083, 410, 1203, 450], stE: [1083, 500, 1203, 640] } },
  };
  if (typeof Image !== "undefined") {
    const names = ["foundation", "plaza", "terrace-floor", "avenue-ew", "avenue-ns", "floor-sanctum", "floor-flags", "floor-cobble", "plot-s", "plot-m", "plot-l", "d-bastion", "d-tower", "d-gate", "d-battlement", "d-pillar", "d-beacon", "d-bowl", "d-lantern", "d-statue", "d-planter", "d-well", "d-rack", "d-crates", "hearth1", "hearth5", "hearth10", "hearth15", "hearth20"];
    for (const k of ["terrace", "low", "rim", "tier", "sanct", "court", "ward", "mward", "lward", "curt", "great"]) for (const n of Object.keys(KIT[k].box)) names.push(k + "-" + n);
    for (const n of names) { const img = new Image(); img.onload = () => { IMG[n] = img; }; img.src = DL.asset("assets/sprites/refuge/" + n + ".png"); }
  }
  Refuge.art = IMG;
  // Buildings Robert redrew on their own plinths (B02-B18): id -> levels. Drawn at BS world px per source px.
  Refuge.BUILT = { forge: 4, armory: 4, garden: 3, alchemy: 1, quarters: 1, lodge: 1, archive: 1, circle: 1, tent: 2, barracks: 3, roseheart: 3, bell: 1, roost: 3, shrine: 3, toadstool: 3, workshop: 3, kennel: 3, pylon: 3, tower: 3 };
  const BSCALE = { alchemy: 1.6, quarters: 1.6, lodge: 1.6, archive: 1.6, circle: 1.6, tent: 0.6, barracks: 0.75, roseheart: 0.8, bell: 0.6, shrine: 0.85, toadstool: 0.85, kennel: 0.75, pylon: 0.65, tower: 0.7 }; // B18 was drawn smaller
  const BS = 0.2;
  if (typeof Image !== "undefined") for (const [id, n] of Object.entries(Refuge.BUILT)) for (let i = 1; i <= n; i++) {
    const img = new Image(); img.onload = () => { IMG["b-" + id + i] = img; }; img.src = DL.asset("assets/sprites/refuge/b-" + id + i + ".png");
  }
  // Draw a redrawn building (its plinth's front edge a little below its spot); false if its art isn't in.
  Refuge.drawBuilding = function (c, id, lvl, x, y) {
    const im = IMG["b-" + id + lvl]; if (!im) return false;
    const k = (BS / 0.4) * (BSCALE[id] || 1), w = im.width * k, h = im.height * k;
    c.drawImage(im, x - w / 2, y + 16 - h, w, h);
    return true;
  };
  // Robert's hearths (B01): world width, and where the bowl sits as a fraction of the picture (the game's fire goes there)
  Refuge.HEARTH = { 1: { w: 70, bx: 0.5, by: 0.43 }, 5: { w: 70, bx: 0.49, by: 0.27 }, 10: { w: 74, bx: 0.49, by: 0.28 }, 15: { w: 80, bx: 0.47, by: 0.11 }, 20: { w: 98, bx: 0.5, by: 0.19 } };
  // Draw one kit wall ring of half-side h, with its stairs (or openings) where `ring.stairs` says.
  function kitRing(c, ring, kind) {
    const K = KIT[kind], E = K.edge, h = ring.half, B = K.box, img = (n) => IMG[kind + "-" + n];
    if (!["nw", "ne", "sw", "se", "n", "s", "w", "e"].every(img)) return false;
    const X = { w: (ix) => -h - K.out + (ix - E.w) * S, e: (ix) => h + K.out - (E.e - ix) * S };
    const Y = { n: (iy) => -h - K.out + (iy - E.n) * S, s: (iy) => h - K.sIn + (iy - E.s) * S };
    const put = (n, x, y, sx = 1, sy = 1) => { const b = B[n]; c.drawImage(img(n), x, y, (b[2] - b[0]) * S * sx, (b[3] - b[1]) * S * sy); };
    const gaps = (si) => ring.stairs.filter((q) => q.s === si);
    // wall runs: tiled between the corners, broken at the openings (stairs are drawn over theirs)
    const run = (n, horiz, a0, a1, pos, si) => {
      const b = B[n], len = (horiz ? b[2] - b[0] : b[3] - b[1]) * S;
      c.save(); c.beginPath();
      let from = a0;
      const cuts = kind === "low" ? gaps(si).map((q) => [q.at - q.w / 2, q.at + q.w / 2]).sort((u, v) => u[0] - v[0]) : [];
      const spans = [];
      for (const [u, v] of cuts) { if (u > from) spans.push([from, u]); from = Math.max(from, v); }
      if (from < a1) spans.push([from, a1]);
      for (const [u, v] of spans) horiz ? c.rect(u, pos - 200, v - u, 400) : c.rect(pos - 200, u, 400, v - u);
      c.clip();
      const V = DL.Render && DL.Render.vis, lo = V ? (horiz ? V.left : V.top) - len - 60 : -Infinity, hi = V ? (horiz ? V.right : V.bottom) + 60 : Infinity;
      if (V && (horiz ? pos < V.top - 260 || pos > V.bottom + 60 : pos < V.left - 260 || pos > V.right + 60)) { c.restore(); return; }
      for (let a = a0; a < a1; a += len - 0.5) if (a > lo && a < hi) horiz ? put(n, a, pos) : put(n, pos, a);
      c.restore();
    };
    const L = X.w(B.nw[2]), R = X.e(B.ne[0]), T = Y.n(B.nw[3]), D = Y.s(B.sw[1]);
    run("n", true, L, R, Y.n(B.n[1]), 0);
    run("s", true, X.w(B.sw[2]), X.e(B.se[0]), Y.s(B.s[1]), 2);
    run("w", false, T, D, X.w(B.w[0]), 3);
    run("e", false, Y.n(B.ne[3]), Y.s(B.se[1]), X.e(B.e[0]), 1);
    put("nw", X.w(B.nw[0]), Y.n(B.nw[1])); put("ne", X.e(B.ne[0]), Y.n(B.ne[1]));
    put("sw", X.w(B.sw[0]), Y.s(B.sw[1])); put("se", X.e(B.se[0]), Y.s(B.se[1]));
    if (kind === "low") return true;
    for (const q of ring.stairs) { // Robert's flights, stretched across so their treads span the stair's width
      const side = "nesw"[q.s], n = "st" + side.toUpperCase(), b = B[n], tr = K.tread[side];
      if (!img(n)) continue;
      const k = q.w / ((tr[1] - tr[0]) * S), mid = (tr[0] + tr[1]) / 2;
      if (side === "n" || side === "s") put(n, q.at - (mid - b[0]) * S * k, (side === "n" ? Y.n : Y.s)(b[1]), k, 1);
      else put(n, (side === "w" ? X.w : X.e)(b[0]), q.at - (mid - b[1]) * S * k, 1, k);
    }
    return true;
  }
  // A drawn picture centred at (x, y) and `w` world px wide.
  const pic = (c, n, x, y, w, dark) => {
    const im = IMG[n]; if (!im) return false;
    const h = (w * im.height) / im.width;
    c.drawImage(im, x - w / 2, y - h / 2, w, h);
    if (dark) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(x - w / 2, y - h / 2, w, h); }
    return true;
  };
  // The four faces of a ring: drawn rock courses on the south (stairs in the gaps), lips on the other three.
  function faces(c, ring, t) {
    const kit = { low: "low", sanctum: "sanct", main: "court", outer: "mward", ward4: "ward", ward5: "lward", ward6: "curt", ward7: "great" }[ring.id] || "terrace";
    if (kitRing(c, ring, kit) || (kit === "sanct" && kitRing(c, ring, "tier")) || ((kit === "court" || kit === "ward" || kit === "mward" || kit === "lward" || kit === "curt" || kit === "great") && kitRing(c, ring, "terrace")) || (kit !== "terrace" && kit !== "low" && kitRing(c, ring, "terrace"))) return;
    const h = ring.half, A = P(), F = ring.face;
    const gaps = (s) => ring.stairs.filter((q) => q.s === s);
    const spans = (s) => {
      const out = []; let from = -h;
      for (const q of gaps(s).sort((a, b) => a.at - b.at)) { if (q.at - q.w / 2 > from) out.push([from, q.at - q.w / 2]); from = q.at + q.w / 2; }
      if (from < h) out.push([from, h]);
      return out;
    };
    if (ring.id === "low") { // a knee-high wall of fitted stones
      for (let s = 0; s < 4; s++) for (const [a, b] of spans(s)) {
        const [nx, ny] = SIDES[s];
        const x = nx ? nx * h - 5 : a, y = ny ? ny * h - 8 : a, w = nx ? 10 : b - a, hh = ny ? 14 : b - a;
        c.fillStyle = "#3a3329"; c.fillRect(x, y, w, hh);
        c.fillStyle = "rgba(205,190,150,0.45)"; c.fillRect(x, y, w, nx ? hh : 3);
        c.fillStyle = "rgba(0,0,0,0.3)"; for (let k = (nx ? y : x) + 9; k < (nx ? y + hh : x + w); k += 16) nx ? c.fillRect(x, k, w, 2) : c.fillRect(k, y + 3, 2, hh - 3);
      }
      return;
    }
    for (const [a, b] of spans(2)) { // south face
      if (A.south) DL.Pyramid.strip(c, A.south, a, h, b - a, F, DL.PYRAMID.course || 18, false);
      else { c.fillStyle = "#5f5849"; c.fillRect(a, h, b - a, F); c.fillStyle = "rgba(205,190,150,0.55)"; c.fillRect(a, h, b - a, 3); }
      const sg = c.createLinearGradient(0, h + F, 0, h + F + 18);
      sg.addColorStop(0, "rgba(0,0,0,0.45)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sg; c.fillRect(a, h + F, b - a, 18);
    }
    for (const q of gaps(2)) { // the south stairs: Robert's flight, fitted to the gap
      if (A.stairS) c.drawImage(A.stairS, q.at - q.w / 2 - 6, h - 4, q.w + 12, F + 6);
      else for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#7a705c" : "#9a8f76"; c.fillRect(q.at - q.w / 2, h + (i * F) / 6, q.w, F / 6); }
    }
    for (const [a, b] of spans(0)) { // north lip
      if (A.north) DL.Pyramid.strip(c, A.north, a, -h - 2, b - a, 11, 11, false);
      else { c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(a, -h, b - a, 3); c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(a, -h - 3, b - a, 3); }
    }
    for (const dx of [1, -1]) for (const [a, b] of spans(dx === 1 ? 1 : 3)) {
      const img = dx === 1 ? A.east : A.west, X = dx * h + (dx === 1 ? -4 : 0);
      if (img) DL.Pyramid.strip(c, img, dx === 1 ? X - 9 : X, a, 13, b - a, 13, true);
      else { c.fillStyle = "rgba(215,200,160,0.5)"; c.fillRect(X, a, 3, b - a); c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(X + (dx === 1 ? 4 : -3), a, 3, b - a); }
    }
    // north, east and west stairs: treads running down over the edge (top-down, as on the pyramid)
    for (const q of [...gaps(0), ...gaps(1), ...gaps(3)]) {
      const [nx, ny] = SIDES[q.s], run = 44;
      if (ny) DL.Pyramid.lane(c, q.at - q.w / 2, -h - run, q.w, run + 14, false, q.w);
      else DL.Pyramid.lane(c, nx > 0 ? h - 14 : -h - run, q.at - q.w / 2, run + 14, q.w, true, q.w);
      c.fillStyle = "rgba(0,0,0,0.45)";
      if (ny) c.fillRect(q.at - q.w / 2 - 6, -h - 2, q.w + 12, 4); else c.fillRect(nx * h - 2, q.at - q.w / 2 - 6, 4, q.w + 12);
    }
  }
  // A kerbed plot of flagstones under a building; a reserved one stays bare, with no name (the secrecy rule).
  function plot(c, p, flags) {
    const pn = p.hw < 26 ? "plot-s" : p.hw < 36 ? "plot-m" : "plot-l", im = IMG[pn];
    if (im) { // Robert's plinths (S4): top edge just above the footprint, steps hanging below the front
      const w = 2 * p.hw + 30, h = (w * im.height) / im.width, top = p.y - Math.round(p.hw * 0.95) - 16;
      c.drawImage(im, p.x - w / 2, top, w, h);
      if (p.reserved) { c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(p.x - w / 2 + 6, top + 6, w - 12, h * 0.7); }
      return;
    }
    if (pic(c, "plaza", p.x, p.y - Math.round(p.hw * 0.45), 2 * p.hw + 34, p.reserved ? 0.4 : 0.1)) return;
    const w = p.hw + 14, top = p.y - Math.round(p.hw * 0.95) - 12, bottom = p.y + 14;
    c.fillStyle = "rgba(30,25,20,0.9)"; c.fillRect(p.x - w - 4, top - 4, 2 * w + 8, bottom - top + 8);
    if (flags) { c.fillStyle = flags; c.fillRect(p.x - w, top, 2 * w, bottom - top); }
    c.fillStyle = p.reserved ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)"; c.fillRect(p.x - w, top, 2 * w, bottom - top);
    c.fillStyle = "rgba(200,180,120,0.35)"; c.fillRect(p.x - w - 4, top - 4, 2 * w + 8, 2);
    if (p.reserved) { c.strokeStyle = "rgba(200,180,120,0.3)"; c.setLineDash([5, 6]); c.lineWidth = 2; c.strokeRect(p.x - w + 6, top + 6, 2 * w - 12, bottom - top - 12); c.setLineDash([]); }
  }
  // A placeholder for a refuge building with no art yet: a hatched plot with its name, plainly not finished art.
  Refuge.drawPlaceholder = function (c, it) {
    const w = it.hw, top = it.y - Math.round(w * 0.95), h = it.y + 4 - top;
    c.save();
    c.fillStyle = "rgba(60,48,34,0.85)"; c.fillRect(it.x - w, top, 2 * w, h);
    c.beginPath(); c.rect(it.x - w, top, 2 * w, h); c.clip();
    c.strokeStyle = "rgba(230,190,110,0.28)"; c.lineWidth = 3;
    for (let k = -h; k < 2 * w; k += 12) { c.beginPath(); c.moveTo(it.x - w + k, it.y + 4); c.lineTo(it.x - w + k + h, top); c.stroke(); }
    c.restore();
    c.strokeStyle = "rgba(230,200,140,0.8)"; c.lineWidth = 2; c.strokeRect(it.x - w + 1, top + 1, 2 * w - 2, h - 2);
    c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillText(it.ph, it.x + 1, top + h / 2 + 5); c.fillStyle = "#f2dca8"; c.fillText(it.ph, it.x, top + h / 2 + 4);
  };

  const floorPats = new WeakMap();
  function floorPat(c) {
    let p = floorPats.get(c);
    if (!p) { p = c.createPattern(IMG["terrace-floor"], "repeat"); p.setTransform(new DOMMatrix().scale(S / 0.6)); floorPats.set(c, p); }
    return p;
  }
  Refuge.drawGround = function (c, L, t) {
    const g = L.geo, lv = L.lv, flags = pattern(c, "campFlags"), paving = pattern(c, "campPaving");
    // the camp yard (packed earth with a dashed edge at first, flagstones once walled), and the hearth's foundation
    if (lv >= RF.lowWall || g.rings.length) fill(c, "campFlags", -g.R, -g.R, 2 * g.R, 2 * g.R, 0.38, "#3d372d");
    else { c.strokeStyle = "rgba(90,75,55,0.35)"; c.lineWidth = 3; c.setLineDash([6, 10]); c.strokeRect(-g.R + 20, -g.R + 20, 2 * g.R - 40, 2 * g.R - 40); c.setLineDash([]); }
    // terraces, outermost first, each with its faces; the sanctum gets the Beacon's paving
    const terr = g.rings.filter((r) => r.id !== "low");
    for (const r of terr) {
      const dark = r.id === "sanctum" ? 0.08 : r.id === "main" ? 0.2 : 0.3;
      const fl = IMG[r.id === "sanctum" ? "floor-sanctum" : r.id === "main" || r.id === "outer" ? "floor-flags" : "floor-cobble"];
      if (fl) { // Robert's floors (S3): mosaic on the sanctum (centred on the flame), flagstones on the court and middle ward, cobbles on the outer wards
        const p = c.createPattern(fl, "repeat"), k = (r.id === "sanctum" ? 2 * r.half : 190) / fl.width;
        p.setTransform(new DOMMatrix().translate(r.id === "sanctum" ? -r.half : 0, r.id === "sanctum" ? -r.half : 0).scale(k));
        c.fillStyle = p; c.fillRect(-r.half, -r.half, 2 * r.half, 2 * r.half);
        c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(-r.half, -r.half, 2 * r.half, 2 * r.half);
      } else if (IMG["terrace-floor"]) { // the drawn terrace floor, repeated; each ring down a shade darker
        const p = floorPat(c);
        c.fillStyle = p; c.fillRect(-r.half, -r.half, 2 * r.half, 2 * r.half);
        c.fillStyle = `rgba(0,0,0,${dark + 0.12})`; c.fillRect(-r.half, -r.half, 2 * r.half, 2 * r.half);
      } else fill(c, r.id === "sanctum" ? "campPaving" : "campFlags", -r.half, -r.half, 2 * r.half, 2 * r.half, dark, "#4a4438");
      if (lv >= 8 && r === terr[0] && r.id !== "sanctum" && !IMG["mward-nw"]) { // (the drawn wards have their own bastions) // Reinforced Walls: corner bastions
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = sx * r.half - (sx > 0 ? 44 : 0), y = sy * r.half - (sy > 0 ? 44 : 0);
          c.fillStyle = "#2c2721"; c.fillRect(x - 2, y - 2, 48, 48);
          fill(c, "campPaving", x, y, 44, 44, 0.15, "#6a604d");
          c.fillStyle = "rgba(220,200,150,0.35)"; c.fillRect(x, y, 44, 3);
        }
      }
    }
    if (lv < 4 && IMG.foundation) { // Robert's stone base under the hearth, and from level 2 his bordered plaza round it
      if (lv >= 2) pic(c, "plaza", 0, 2, 250, 0.12);
      pic(c, "foundation", 0, 6, 120, 0.08);
    } else if (lv < 4) { // the stone foundation round the hearth
      const f = 54 + (lv >= 2 ? 16 : 0);
      c.fillStyle = "#26211b"; c.fillRect(-f - 4, -f - 4, 2 * f + 8, 2 * f + 8);
      fill(c, "campPaving", -f, -f, 2 * f, 2 * f, 0.1, "#655c4a");
    }
    // the avenues: from the sanctum (or the hearth) out through every central stair
    const s0 = terr.find((r) => r.id === "sanctum");
    const inner = s0 ? s0.half + s0.face : 60, reach = g.R + 30;
    if (lv >= 2) for (const [nx, ny] of SIDES) {
      const w = g.cw;
      if (nx && IMG["avenue-ew"]) { // east-west: Robert's stair strip (S1), its kerbs just outside the avenue
        const im = IMG["avenue-ew"], h = w + 18, k = h / im.height, x0 = nx > 0 ? inner - 8 : -reach, len = reach - inner + 8;
        const p = c.createPattern(im, "repeat"); p.setTransform(new DOMMatrix().translate(0, -h / 2).scale(k));
        c.fillStyle = p; c.fillRect(x0, -h / 2, len, h);
      } else if (nx && IMG["terrace-floor"]) { // east-west: a paved road between kerbs (the stair strip turned on its side read as planks)
        const x0 = nx > 0 ? inner - 8 : -reach, len = reach - inner + 8;
        c.fillStyle = floorPat(c); c.fillRect(x0, -w / 2, len, w);
        c.fillStyle = "rgba(255,235,190,0.08)"; c.fillRect(x0, -w / 2, len, w);
        c.fillStyle = "rgba(30,24,18,0.9)"; c.fillRect(x0, -w / 2 - 5, len, 5); c.fillRect(x0, w / 2, len, 6);
        c.fillStyle = "rgba(220,195,140,0.45)"; c.fillRect(x0, -w / 2 - 5, len, 2);
      } else if (nx) DL.Pyramid.lane(c, nx > 0 ? inner - 8 : -reach, -w / 2, reach - inner + 8, w, true, w);
      else if (IMG["avenue-ns"]) { // north-south: Robert's paved avenue (S2), its kerbs just outside the avenue
        const im = IMG["avenue-ns"], h = w + 18, k = h / im.width, y0 = ny > 0 ? inner - 8 : -reach, len = reach - inner + 8;
        const p = c.createPattern(im, "repeat"); p.setTransform(new DOMMatrix().translate(-h / 2, 0).scale(k));
        c.fillStyle = p; c.fillRect(-h / 2, y0, h, len);
      } else DL.Pyramid.lane(c, -w / 2, ny > 0 ? inner - 8 : -reach, w, reach - inner + 8, false, w);
    }
    const marsh = pattern(c, "grass"), V = DL.Render && DL.Render.vis;
    if (marsh) for (const b of Refuge.bedsAt(lv)) { // the marsh beds, kerbed
      if (V && (b.x + b.half < V.left - 20 || b.x - b.half > V.right + 20 || b.y + b.half < V.top - 20 || b.y - b.half > V.bottom + 20)) continue;
      const x = b.x - b.half, y = b.y - b.half, w = b.half * 2;
      c.fillStyle = "rgba(34,32,30,0.95)"; c.fillRect(x - 8, y - 8, w + 16, w + 16);
      c.fillStyle = "rgba(200,195,180,0.35)"; c.fillRect(x - 8, y - 8, w + 16, 3);
      c.fillStyle = marsh; c.fillRect(x, y, w, w);
      c.fillStyle = "rgba(0,0,0,0.16)"; c.fillRect(x, y, w, w);
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x, y, w, 6);
    }
    for (const r of g.rings) faces(c, r, t);
    if (lv >= 10 && s0) { // the Inner Ring's coping round the sanctum
      c.fillStyle = "rgba(225,205,150,0.4)";
      c.fillRect(-s0.half, -s0.half, 2 * s0.half, 3); c.fillRect(-s0.half, -s0.half, 3, 2 * s0.half); c.fillRect(s0.half - 3, -s0.half, 3, 2 * s0.half);
    }
    // the flame's star inlay from Final Reinforcement on
    if (lv >= 19 && !IMG["floor-sanctum"]) { // (the drawn mosaic has its own star)
      c.strokeStyle = "rgba(190,70,40,0.55)"; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 46 : 84; c[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r * 0.75 + 4); }
      c.stroke();
    }
    for (const p of L.plots) if (!(p.id && IMG["b-" + p.id + "1"] && !p.reserved)) plot(c, p, flags);
  };

  /* ---------------- HUD / text ---------------- */
  Refuge.line = (up) => { const lv = Refuge.level(up || DL.Game.save.up); return `Refuge level ${lv} of ${DL.FLAME.max}: ${RF.levels[lv].name}`; };
})(window.DL);
