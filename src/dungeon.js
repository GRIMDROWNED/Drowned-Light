/* Drowned Light — the dungeons, side by side (Level 3, 2026-11-09).

   Each dungeon level lives far off the map in its own module with the same face: the Abyssal Spires (src/spires.js,
   Level 2) and the Molten Mines (src/mines.js, Level 3). G.spires is the run you're on, whichever dungeon it is in
   (`lv: "mines"` for the Mines; the Spires' runs carry none). The rest of the game talks to DL.Dungeon, which hands
   each call to the dungeon of the run you're on, or of the place a point lies in:
     inRegion(x, y)   any dungeon's ground          collide(ent, r)   keep a walker on that dungeon's stone
     update(dt)       the run's portals and rooms   route(...)        a Drowned's next join on the way
     checkpoint()     where a run's fallen rise     lights(L)         the run's lights round the knight
     onKill(e)        a room's foe broken           leave(all)/lost() out of the run / the host fell in it
     bag()            the run's finds               dark()            the run's darkness
     covers(view)     a dungeon fills the screen (skip the wetland ground)
   DL.DungeonGeo(L) is the shared stone: floors (rects or ovals), stairs rising north, bridges (segments), the joins
   between them, solid circles, from local layout tables, for a dungeon whose origin is (L.ox, L.oy). */
"use strict";
(function (DL) {
  const G = DL.Game;
  const D = (DL.Dungeon = {});
  const levels = () => [DL.Spires, DL.Mines].filter(Boolean);
  // the dungeon of the run you're on (null out of a run)
  D.cur = () => (G.spires ? (G.spires.lv === "mines" ? DL.Mines : DL.Spires) : null);
  D.at = (x, y) => levels().find((m) => m.inRegion(x, y)) || null;
  D.inRegion = (x, y) => !!D.at(x, y);
  D.active = () => !!G.spires;
  D.update = (dt) => { const m = D.cur(); if (m) m.update(dt); };
  D.collide = (ent, r) => { const m = D.at(ent.x, ent.y); if (m) m.collide(ent, r); };
  D.route = (x, y, tx, ty) => { const m = D.cur(); return m ? m.route(x, y, tx, ty) : null; };
  D.checkpoint = () => { const m = D.cur(); return m ? m.checkpoint() : null; };
  D.lights = (L) => { const m = D.cur(); if (m) m.lights(L); };
  D.onKill = (e) => { const m = D.cur(); if (m) m.onKill(e); };
  D.leave = (all) => { const m = D.cur(); if (m) m.leave(all); };
  D.lost = () => { const m = D.cur(); if (m) m.lost(); };
  D.join = (a) => { const m = D.cur(); if (m) m.join(a); };
  D.bag = () => { const m = D.cur(); return m ? m.bag() : null; };
  D.dark = () => (D.cur() === DL.Mines ? DL.MINES.dark : DL.SPIRES.dark);
  D.name = () => (D.cur() === DL.Mines ? "Molten Mines" : "Abyssal Spires");
  D.covers = (view) => levels().some((m) => m.covers(view));
  // the run's state for a co-op snapshot, and a friend's device taking it in (the Mines' is an object marked `m`)
  D.snap = (near) => { const m = D.cur(); return m ? m.snap(near) : 0; };
  D.applySnap = function (s) {
    if (s && s.m) DL.Mines.applySnap(s);
    else if (s) DL.Spires.applySnap(s);
    else { DL.Spires.applySnap(0); DL.Mines.applySnap(0); } // no run: out of whichever we were in
  };

  /* ---------------- the shared stone ---------------- */
  DL.DungeonGeo = function (L) {
    const { FLOORS, STAIRS, BRIDGES, JOINS, SOLIDS } = L;
    const geo = {};
    const inRect = (x, y, q, m) => {
      if (q[5] === "oval") { const rx = (q[2] - q[0]) / 2 - m, ry = (q[3] - q[1]) / 2 - m; return ((x - q[0] - rx - m) / rx) ** 2 + ((y - q[1] - ry - m) / ry) ** 2 < 1; }
      return x > q[0] + m && x < q[2] - m && y > q[1] + m && y < q[3] - m;
    };
    const inStair = (x, y, q, m) => x > q[0] + m && x < q[2] - m && y > q[1] && y < q[3];
    function segD(x, y, q) {
      const vx = q[2] - q[0], vy = q[3] - q[1], u = Math.max(0, Math.min(1, ((x - q[0]) * vx + (y - q[1]) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(x - q[0] - vx * u, y - q[1] - vy * u);
    }
    const inBridge = (x, y, q, m) => segD(x, y, q) < q[4] - m;
    geo.inRect = inRect;
    // which piece a local point is on, or null
    geo.pieceAt = function (x, y, m) {
      for (const k in FLOORS) if (inRect(x, y, FLOORS[k], m)) return k;
      for (const k in STAIRS) if (inStair(x, y, STAIRS[k], m)) return k;
      for (const k in BRIDGES) if (inBridge(x, y, BRIDGES[k], m)) return k;
      return null;
    };
    geo.walkable = (x, y, m = 6) => !!geo.pieceAt(x - L.ox, y - L.oy, m);
    // Keep a walker on the stone: out of the solids, and back to where it last stood if it stepped off (sliding along
    // the edge if it can). `hold` (a floor) keeps it on that floor alone (a sealed room); `home` is where a lost knight goes.
    geo.collide = function (ent, r, hold, home) {
      const ox = L.ox, oy = L.oy;
      for (const s of SOLIDS) {
        const dx = ent.x - ox - s[0], dy = ent.y - oy - s[1], d = Math.hypot(dx, dy), min = s[2] + r;
        if (d < min && d > 0.01) { ent.x = ox + s[0] + (dx / d) * min; ent.y = oy + s[1] + (dy / d) * min; }
      }
      const m = Math.min(8, r * 0.6), ok = (x, y) => (hold ? inRect(x - ox, y - oy, hold, m) : geo.walkable(x, y, m));
      if (!ok(ent.x, ent.y)) {
        const lx = ent.spx, ly = ent.spy;
        if (lx == null || !L.inRegion(lx, ly)) { if (home) { ent.x = home.x; ent.y = home.y; } }
        else if (ok(ent.x, ly)) ent.y = ly;
        else if (ok(lx, ent.y)) ent.x = lx;
        else { ent.x = lx; ent.y = ly; }
      }
      ent.spx = ent.x; ent.spy = ent.y;
    };
    // A Drowned heading for (tx, ty) on another piece: the next join on the way, over stairs and bridges.
    const NEXT = {};
    for (const j of JOINS) { (NEXT[j[0]] = NEXT[j[0]] || []).push(j); (NEXT[j[1]] = NEXT[j[1]] || []).push(j); }
    geo.route = function (x, y, tx, ty) {
      const ox = L.ox, oy = L.oy, a = geo.pieceAt(x - ox, y - oy, 0), b = geo.pieceAt(tx - ox, ty - oy, 0);
      if (!a || !b || a === b) return null;
      const prev = { [a]: null }, q = [a];
      while (q.length && !(b in prev)) {
        const k = q.shift();
        for (const j of NEXT[k] || []) { const o = j[0] === k ? j[1] : j[0]; if (!(o in prev)) { prev[o] = [k, j]; q.push(o); } }
      }
      if (!(b in prev)) return null;
      const path = [];
      for (let k = b; prev[k]; k = prev[k][0]) path.unshift(prev[k][1]);
      let j = path[0];
      if (Math.hypot(x - ox - j[2], y - oy - j[3]) < 16) j = path[1]; // at the join already: on to the next
      return j ? { x: ox + j[2], y: oy + j[3] } : { x: tx, y: ty };
    };
    return geo;
  };
})(window.DL);
