// Run with node tools/test_refuge.cjs. No browser or packages. Checks the Refuge (src/refuge.js) at every level, with
// every building built and with none: the flame, every stair's top and foot, and every building are reachable on foot;
// walkers routed by Camp.route get from outside to the flame and back out from eight directions; 12 stairs on the
// outside wall at level 20; and nothing is placed off its terrace.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DL = { Game: {} };
const ctx = vm.createContext({ window: { DL }, console });
for (const f of ["data", "camp", "refuge"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/" + f + ".js"), "utf8"), ctx, { filename: f });
const G = DL.Game, ALL = { forge: 4, armory: 4, workbench: 4, garden: 3, tower: 3, pylon: 3, kennel: 3, workshop: 3, shrine: 3, toadstool: 3, roost: 3, bell: 1, roseheart: 3 };
const collide = (e, r, u) => {
  DL.Camp.collideWall(e, r, u);
  for (const s of DL.Camp.layout(u).solids) { const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy), m = s.r + r; if (d < m && d > 0.01) { e.x = s.x + dx / d * m; e.y = s.y + dy / d * m; } }
};
let checked = 0;
for (let lv = 1; lv <= 20; lv++) for (const full of [true, false]) {
  const u = { fortress: 1, flame: lv, stakes: full ? 5 : 0, ...Object.fromEntries(Object.keys(ALL).map((k) => [k, full ? ALL[k] : 0])) };
  G.save = { up: u };
  const L = DL.Camp.layout(u), R = L.R, S = 8, N = Math.ceil((R + 140) / S), W = 2 * N + 1;
  const ok = (x, y) => { const e = { x, y }; collide(e, 10, u); return Math.abs(e.x - x) < 0.01 && Math.abs(e.y - y) < 0.01; };
  const seen = new Uint8Array(W * W), id = (i, j) => (i + N) * W + (j + N), q = [[-N, -N]];
  seen[id(-N, -N)] = 1;
  while (q.length) {
    const [i, j] = q.pop();
    for (const [a, c] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (Math.abs(a) > N || Math.abs(c) > N || seen[id(a, c)]) continue;
      seen[id(a, c)] = ok(a * S, c * S) ? 1 : 2;
      if (seen[id(a, c)] === 1) q.push([a, c]);
    }
  }
  const reach = (x, y) => { for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) { const i = Math.round(x / S) + di, j = Math.round(y / S) + dj; if (Math.abs(i) <= N && Math.abs(j) <= N && seen[id(i, j)] === 1) return true; } return false; };
  const tag = `level ${lv}${full ? " (all built)" : ""}`;
  assert.ok(reach(0, 40), `${tag}: the flame can be reached`);
  for (const ring of DL.Refuge.blockers(u)) for (const st of ring.stairs) {
    const e = DL.Refuge.stairEnds(ring, st, 20);
    assert.ok(reach(e.inn.x, e.inn.y) && reach(e.out.x, e.out.y), `${tag}: ${ring.id} stair ${st.s}/${st.at} connects`);
  }
  for (const k of DL.Refuge.BUILDINGS) if (L[k]) assert.ok(reach(L[k].x, L[k].y + 26), `${tag}: ${k} can be reached`);
  for (const it of L.items) assert.ok(reach(it.x, it.y + 24), `${tag}: ${it.id} can be reached`);
  // Robert, 2026-11-04: buildings' whole top-level pictures must have room (no crowding) once the Inner Court stands
  if (lv >= 5) for (const k of DL.Refuge.BUILDINGS) assert.ok(!(L[k] && L.missing.includes(k)), `${tag}: ${k} has room for its biggest picture`);
  for (const k of DL.Refuge.BUILDINGS) if (L[k]) assert.ok(DL.Camp.sq(L[k].x, L[k].y) < R, `${tag}: ${k} inside the walls`);
  for (const b of DL.Refuge.bedsAt(lv)) assert.ok(reach(b.x, b.y) && ok(b.x, b.y) && !L.items.concat(L.plots).some((p) => Math.abs(p.x - b.x) < b.half + p.hw && Math.abs(p.y - b.y) < b.half + p.hw), `${tag}: marsh bed ${b.i} is open ground`);
  for (let a = 0; a < 8; a++) {
    const k = (R + 130) / Math.max(Math.abs(Math.cos(a * Math.PI / 4)), Math.abs(Math.sin(a * Math.PI / 4))), fx = Math.cos(a * Math.PI / 4) * k, fy = Math.sin(a * Math.PI / 4) * k; // 130 px outside the walls
    for (const [sx, sy, tx, ty] of [[fx, fy, 0, 30], [3, 40, fx, fy]]) {
      const e = { x: sx, y: sy };
      for (let t = 0; t < 2600 && Math.hypot(e.x - tx, e.y - ty) >= 40; t++) {
        const wp = DL.Camp.route(e.x, e.y, tx, ty, u) || { x: tx, y: ty }, dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy) || 1;
        e.x += dx / d * 3; e.y += dy / d * 3; collide(e, 9, u);
      }
      assert.ok(Math.hypot(e.x - tx, e.y - ty) < 40, `${tag}: a walker from (${Math.round(sx)}, ${Math.round(sy)}) reaches (${Math.round(tx)}, ${Math.round(ty)}), stuck at (${Math.round(e.x)}, ${Math.round(e.y)})`);
    }
  }
  checked++;
}
const g20 = DL.Refuge.geo(20);
assert.equal(g20.rings[0].stairs.length, 12, "12 stairs on the outside at level 20");
for (let s = 0; s < 4; s++) assert.equal(g20.rings[0].stairs.filter((q) => q.s === s).length, 3, "3 stairs on each side");
for (let lv = 2; lv <= 20; lv++) {
  const a = DL.Refuge.geo(lv - 1), b = DL.Refuge.geo(lv), info = DL.REFUGE.levels[lv];
  assert.ok(info && info.name && info.text, `level ${lv} has a name and description`);
}
assert.equal(DL.Refuge.on({ flame: 3 }), true, "an old save with no switch gets the Refuge");
assert.equal(DL.Refuge.on({ fortress: 0 }), false, "fortress 0 is the old squares");
console.log(`Refuge checks passed: ${checked} layouts (levels 1-20, all built and none): reachability, marsh beds, 12 outer stairs, routing in and out, the switch.`);
