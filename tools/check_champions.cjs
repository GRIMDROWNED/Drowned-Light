/* Run with node tools/check_champions.cjs. No packages or browser are needed. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");

function world(level = 1) {
  const DL = {};
  const context = vm.createContext({ window: { DL }, console });
  vm.runInContext(fs.readFileSync(path.join(root, "src/data.js"), "utf8"), context);
  let guest = false;
  const hits = [];
  const G = DL.Game = {
    save: { up: { flame: 10 }, pyramid: { sq: { "1,0": { b: { barracks: level } } } } },
    eid: 0, cave: null, enemies: [], effects: [], outposts: [{ gx: 1, gy: 0, lit: true }],
    isGuest: () => guest,
    hitEnemy: (e, amount) => { e.hp -= amount; hits.push([e, amount]); },
    canAfford: () => true, pay() {}, persist() {},
  };
  DL.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  DL.World = { collide() {} }; DL.Cave = { inRegion: () => false }; DL.Finale = { collide() {} };
  DL.Sound = { play() {} }; DL.Net = { say() {} }; DL.Outposts = { reset() {} };
  vm.runInContext(fs.readFileSync(path.join(root, "src/camp.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src/pyramid.js"), "utf8"), context);
  const Py = DL.Pyramid, C = DL.PYRAMID.champion;
  Py.setHeld(["1,0"]);
  return { DL, G, Py, C, hits, guest: (value) => { guest = value; } };
}

// Barracks follow the normal square purchase path and preserve existing siege HP and defenses.
{
  const { G, Py } = world(0);
  G.save.pyramid.sq["1,0"] = { hp: 230, b: { wall: 2, tower: 1 } };
  const actor = { x: 800, y: 0 };
  assert.equal(Py.buildLock(1, 0, "barracks", actor), null);
  assert.equal(Py.buildHost(1, 0, "barracks", actor), true);
  assert.equal(Py.buildings(1, 0).barracks, 1);
  assert.equal(Py.buildings(1, 0).wall, 2);
  assert.equal(G.save.pyramid.sq["1,0"].hp, 230);
  assert.ok(Py.layout(1, 0).barracks);
}

// Building a barracks doesn't instantly create an army, and production stops at the building's capacity.
{
  const { G, Py, C } = world(2);
  Py.updateChampions(C.train[2] - 0.1); assert.equal(G.champions.length, 0);
  Py.updateChampions(0.11); assert.equal(G.champions.length, 1);
  Py.updateChampions(C.train[2]); assert.equal(G.champions.length, 2);
  Py.updateChampions(C.train[2] * 10); assert.equal(G.champions.length, 2);
  assert.notEqual(G.champions[0].slot, G.champions[1].slot);
}

// A fallen defender disappears from snapshots and is replaced only after a complete training interval.
{
  const { G, Py, C } = world();
  Py.updateChampions(C.train[1]);
  const oldId = G.champions[0].id;
  Py.hurtChampion(G.champions[0], C.hp[1]);
  assert.equal(Py.championRows().length, 0);
  Py.updateChampions(C.train[1] - 0.1); assert.equal(G.champions.length, 0);
  Py.updateChampions(0.11); assert.equal(G.champions.length, 1);
  assert.notEqual(G.champions[0].id, oldId);
}

// Guard combat uses the host's normal hit path, and never pursues enemies beyond the home square's bounds.
{
  const { G, Py, C, hits } = world();
  Py.updateChampions(C.train[1]);
  const h = G.champions[0];
  const enemy = { x: h.x + 20, y: h.y, hp: 100, def: { radius: 10 }, rise: 0 };
  G.enemies.push(enemy);
  Py.updateChampions(0.01); assert.ok(h.swing > 0);
  Py.updateChampions(C.swing); assert.equal(hits.length, 1); assert.equal(enemy.hp, 100 - C.dmg[1]);
  assert.equal(Py.championTarget(h.x, h.y, 100), h);
  enemy.x = 800 + C.defend + 1;
  Py.updateChampions(1); assert.equal(h.tgt, null);
}

// Mindrot stops protecting an enemy as soon as it expires, even when the timer overshoots below zero.
for (const mind of [1, -0.01]) {
  const { G, Py, C } = world();
  Py.updateChampions(C.train[1]);
  const h = G.champions[0];
  G.enemies.push({ x: h.x + 20, y: h.y, hp: 100, def: { radius: 10 }, rise: 0, mind });
  Py.updateChampions(0.01);
  assert.equal(h.swing > 0, mind <= 0, "only an active Mindrot effect prevents targeting");
}

// Extinguished fires pause recruitment; lost squares remove their defenders and pending recruitment.
{
  const { G, Py, C } = world(2);
  G.outposts[0].lit = false;
  Py.updateChampions(C.train[2] * 2); assert.equal(G.champions.length, 0);
  G.outposts[0].lit = true;
  Py.updateChampions(C.train[2]); assert.equal(G.champions.length, 1);
  delete G.save.pyramid.sq["1,0"]; Py.setHeld([]);
  assert.equal(Py.championRows().length, 0);
  Py.updateChampions(1); assert.equal(G.champions.length, 0);
}

// Guests receive and smooth puppets, but cannot train or damage anything themselves.
{
  const host = world();
  host.Py.updateChampions(host.C.train[1]);
  const rows = host.Py.championRows(() => true);
  assert.equal(host.Py.championRows(() => false).length, 0);
  const client = world(); client.guest(true);
  client.Py.applyChampions(rows); assert.equal(client.G.champions.length, 1);
  const h = client.G.champions[0], hp = h.hp;
  client.Py.hurtChampion(h, 100); assert.equal(h.hp, hp);
  h.tx += 100; const x = h.x;
  client.Py.guestChampions(0.1, 0.5); assert.equal(h.x, x + 50);
  client.Py.updateChampions(client.C.train[1] * 10); assert.equal(client.G.champions.length, 1);
  assert.equal(client.hits.length, 0);
  client.Py.applyChampions([]); assert.equal(client.G.champions.length, 0);
}

// A terminal world cannot recruit, move, attack, heal or damage champions through delayed callbacks.
{
  const { G, Py, C, hits, guest } = world();
  Py.updateChampions(C.train[1]);
  const h = G.champions[0]; h.hp -= 10; h.tx = h.x + 100; h.ty = h.y + 100;
  G.save.up.flame = 0;
  const before = JSON.stringify(G.champions);
  Py.updateChampions(C.train[1] * 10);
  Py.hurtChampion(h, 1000);
  assert.equal(Py.championShot({ x: h.x, y: h.y - 22, dmg: 1000 }), false);
  assert.equal(Py.championTarget(h.x, h.y, 100), null);
  assert.equal(Py.championRows().length, 0);
  guest(true); Py.guestChampions(1, 1);
  Py.applyChampions([]);
  assert.equal(JSON.stringify(G.champions), before);
  assert.equal(hits.length, 0);
}

console.log("Champion checks passed: buildings, training, capacity, replacement, combat, square loss, guest authority and terminal worlds.");
