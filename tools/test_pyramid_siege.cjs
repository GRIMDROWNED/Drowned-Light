// Run with node tools/test_pyramid_siege.cjs. No browser, packages, or built assets required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function world(flame = 5, squares = {}) {
  const calls = { waves: [], defeats: 0, titles: 0, saved: null };
  const noop = () => {};
  const DL = {
    TAU: Math.PI * 2, rand: (a = 0, b = 1) => (a + b) / 2,
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)), lerp: (a, b, t) => a + (b - a) * t,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    World: { chunks: new Map(), ground: new Map() },
    Sound: { play: noop, init: noop }, Net: { role: null, say: noop },
    UI: { toast: noop, hideScreens: noop, toTitle: () => calls.titles++ },
    Cave: { inRegion: () => false, fall: () => true }, Wyvern: { fell: noop },
  };
  const ctx = vm.createContext({ window: { DL }, console, setTimeout: noop, localStorage: { setItem: noop } });
  for (const file of ["data", "game", "camp", "pyramid", "outposts", "siege"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/" + file + ".js"), "utf8"), ctx, { filename: file });
  }
  DL.Finale = { away: () => false };
  const G = DL.Game;
  G.save = G.defaultSave();
  G.save.up.flame = flame;
  G.save.pyramid.sq = JSON.parse(JSON.stringify(squares));
  G.save.nights = 4; G.save.day = 5;
  G.stats = () => ({ flameHp: 150 + 100 * G.save.up.flame });
  G.flame = { kind: "flame", x: 0, y: 0, hp: G.stats().flameHp, max: G.stats().flameHp, lit: true };
  G.state = "play";
  G.effects = []; G.enemies = [];
  G.player = { x: 0, y: 70, zi: 1, hp: 100, carried: Object.fromEntries(DL.RES_KEYS.map((k) => [k, 0])) };
  G.persist = () => { calls.saved = JSON.parse(JSON.stringify(G.save)); };
  G.spawnWave = (...args) => { calls.waves.push(args); return [{ stun: 0 }]; };
  G.partyScale = () => 1;
  G.puff = noop; G.spark = noop;
  const fallen = G.campFallen;
  G.campFallen = () => { calls.defeats++; fallen(); };
  DL.Outposts.reset();
  return { DL, G, calls };
}

// Nights 5, 10, ... are sieges, and only exposed squares receive their waves.
{
  const squares = {};
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x || y) squares[x + "," + y] = 1;
  // Extend a solid block to surround square (1,0), making it an interior square.
  squares["2,-1"] = squares["2,0"] = squares["2,1"] = 1;
  const { DL, G, calls } = world(5, squares);
  assert.equal(DL.Siege.isSiegeNight(5), true);
  assert.equal(DL.Siege.isSiegeNight(10), true);
  assert.equal(DL.Siege.isSiegeNight(4), false);
  assert.equal(DL.Siege.targets().some((o) => o.gx === 1 && o.gy === 0), false);
  DL.Siege.nightfall();
  assert.equal(DL.Siege.on, true);
  DL.Siege.update(DL.SIEGE.first);
  assert.equal(calls.waves.length, DL.SIEGE.sides);
  for (const row of calls.waves) {
    assert.equal(row[4].kind, "outpost");
    assert.equal(DL.Siege.targets().includes(row[4]), true);
    const dx = Math.round(Math.cos(row[7])), dy = Math.round(Math.sin(row[7]));
    assert.equal(DL.Pyramid.has(row[4].gx + dx, row[4].gy + dy), false);
  }
  G.save.nights = 3;
  DL.Siege.reset(); DL.Siege.nightfall();
  assert.equal(DL.Siege.on, false);
}

// Legacy numeric squares acquire HP lazily; damage persists without destroying building records.
{
  const { DL, G, calls } = world(5, { "1,0": 1, "0,1": { hp: 180, b: { wall: 2, tower: 1 } } });
  const fire = G.outposts.find((o) => o.gx === 1);
  assert.equal(fire.hp, DL.PYRAMID.hp);
  DL.Outposts.hurt(fire, 20);
  assert.equal(calls.saved.pyramid.sq["1,0"].hp, DL.PYRAMID.hp - 20);
  DL.Outposts.reset();
  assert.equal(G.outposts.find((o) => o.gx === 1).hp, DL.PYRAMID.hp - 20);
  const built = G.outposts.find((o) => o.gy === 1);
  DL.Outposts.hurt(built, 10);
  assert.deepEqual(calls.saved.pyramid.sq["0,1"].b, { wall: 2, tower: 1 });
  DL.Outposts.dawn();
  assert.equal(G.save.pyramid.sq["0,1"].hp, DL.PYRAMID.hp);
  assert.equal(G.save.pyramid.sq["0,1"].b.wall, 2);
}

// A destroyed square sinks exactly once; old enemy goals cannot inflict a second loss.
{
  const { DL, G, calls } = world(5, { "1,0": { hp: 12, b: { wall: 2, pylon: 1 } }, "0,1": 1 });
  const fire = G.outposts.find((o) => o.gx === 1);
  const oldPylon = fire.pylons[0];
  DL.Outposts.hurt(fire, 99);
  assert.equal(DL.Pyramid.has(1, 0), false);
  assert.equal(G.save.pyramid.sq["1,0"], undefined);
  assert.equal(G.save.up.flame, 4);
  assert.equal(G.flame.max, 550);
  assert.equal(fire.lit, false);
  assert.equal(oldPylon.lit, false, "enemy goals to vanished pylons must also become invalid");
  DL.Outposts.hurt(fire, 99);
  assert.equal(DL.Pyramid.lose(1, 0), false);
  assert.equal(G.save.up.flame, 4);
  assert.equal(calls.defeats, 0);
  assert.equal(calls.saved.up.flame, 4);
}

// Hosts alone mutate square HP or ownership; snapshots convey health and disappearing squares to guests.
{
  const host = world(5, { "1,0": { hp: 120, b: { wall: 2, pylon: 1, tower: 1 } } });
  const guest = world(5);
  guest.DL.Net.role = "guest";
  host.G.outposts[0].pylons[0].hp = 20;
  host.G.outposts[0].pylons[0].lit = false;
  guest.DL.Outposts.apply(JSON.parse(JSON.stringify(host.DL.Outposts.rows())));
  assert.equal(guest.G.outposts[0].hp, 120);
  assert.equal(guest.G.outposts[0].max, host.DL.PYRAMID.hp);
  assert.equal(guest.DL.Pyramid.buildings(1, 0).wall, 2);
  assert.equal(guest.DL.Pyramid.pylons().length, 2);
  assert.equal(guest.DL.Pyramid.pylons()[0].hp, 20);
  assert.equal(guest.DL.Pyramid.pylons()[0].lit, false);
  guest.DL.Outposts.hurt(guest.G.outposts[0], 1000);
  assert.equal(guest.G.outposts[0].hp, 120);
  assert.equal(guest.DL.Pyramid.lose(1, 0), false);
  host.DL.Outposts.hurt(host.G.outposts[0], 1000);
  guest.DL.Outposts.apply(host.DL.Outposts.rows());
  assert.equal(guest.DL.Pyramid.has(1, 0), false);
  assert.equal(guest.G.outposts.length, 0);
  guest.DL.Siege.nightfall();
  assert.equal(guest.DL.Siege.on, false);
}

// Without outer squares the camp is attacked; burning out above zero costs one level and rekindles it.
{
  const { DL, G, calls } = world(3);
  DL.Siege.nightfall(); DL.Siege.update(DL.SIEGE.first);
  assert.equal(calls.waves[0][4], G.flame);
  G.flame.hp = 0; G.flame.lit = false;
  assert.equal(DL.Siege.flameOut(), true);
  assert.equal(G.save.up.flame, 2);
  assert.equal(G.flame.lit, true);
  assert.equal(G.flame.hp, G.flame.max);
  assert.equal(calls.defeats, 0);
  assert.equal(DL.Siege.flameOut(), false); // the same snuff cannot cost another level
}

// The last lost level ends play even while a camp menu is open and cannot be escaped by respawning/reloading.
{
  const { DL, G, calls } = world(1, { "1,0": 1, "0,1": 1 });
  G.state = "camp";
  DL.Outposts.hurt(G.outposts[0], 1000);
  assert.equal(G.save.up.flame, 0);
  assert.equal(calls.saved.up.flame, 0);
  assert.equal(G.state, "dying");
  assert.equal(G.deathInfo.cause, "camp");
  assert.equal(calls.defeats, 1);
  assert.equal(G.flame.lit, false);
  const survivor = G.outposts[0], hp = survivor.hp;
  DL.Outposts.hurt(survivor, 1000); // remaining enemy iterations stop changing the fallen world
  assert.equal(survivor.hp, hp);
  assert.equal(DL.Pyramid.lose(survivor.gx, survivor.gy), false);
  assert.ok(DL.Outposts.travelLock()); // old guest camp screens cannot move after the last loss
  assert.equal(DL.Pyramid.claimHost(-1, 0, true), false);
  assert.ok(DL.Pyramid.buildLock(survivor.gx, survivor.gy, "wall", { x: survivor.x, y: survivor.y }));
  assert.equal(DL.Pyramid.buildHost(survivor.gx, survivor.gy, "wall", { x: survivor.x, y: survivor.y }), false);
  assert.ok(G.upgradeLock(DL.UPGRADES.find((u) => u.id === "flame"), 0));
  assert.equal(G.buyUpgrade("flame"), false); // a queued guest purchase cannot revive a lost world
  const day = G.save.day;
  G.respawn();
  assert.equal(calls.titles, 1);
  assert.equal(G.save.day, day);
  G.state = "title";
  G.startLife = () => { G.state = "play"; };
  G.begin();
  assert.equal(G.state, "dying");
  assert.equal(G.save.up.flame, 0);
  G.save = G.defaultSave();
  G.state = "play";
  G.campFallen(); // an old loss callback, if called by another system, cannot end a newly kindled world
  assert.equal(G.state, "play");
}

console.log("Pyramid siege checks passed: schedule, perimeter targets, saves, losses, co-op rows, and terminal defeat.");
