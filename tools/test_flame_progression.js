/* Run with node tools/test_flame_progression.js. Exercise real upgrade purchases without a browser. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DL = {
  World: { ground: new Map() }, Sound: { play() {} },
  Kits: { lanternMult: () => 1, titheDmg: () => 1 },
  Abigail: { mult: () => 1 }, Wyvern: { dmgMult: () => 1 },
  UI: { toast() {} }, Net: { role: null, event(e) { this.sent = e; } },
};
const context = vm.createContext({ window: { DL }, localStorage: { setItem() {} }, setTimeout() {} });
for (const file of ["data", "game", "camp"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/" + file + ".js"), "utf8"), context);
const G = DL.Game, flame = DL.UPGRADES.find((u) => u.id === "flame");
G.save = G.defaultSave();
G.save.nights = DL.FLAME_NIGHTS[20];
for (const k of DL.RES_KEYS) G.save.stash[k] = 100000;
G.player = { hp: 100, carried: {} };
G.flame = { hp: 250, max: 250, lit: true };
G.resetPylons = () => DL.Camp.sync(G.save.up);

assert.match(G.upgradeLock(flame, 1), /Barricade 1/);
const initial = JSON.stringify(G.save.stash);
assert.equal(G.buyUpgrade("flame"), false);
assert.equal(JSON.stringify(G.save.stash), initial, "locked purchases must not spend supplies");
assert.equal(G.buyUpgrade("stakes"), true, "the first Barricade must be buildable at Flame 1");
while (G.save.up.flame < 20) {
  const level = G.save.up.flame;
  if (level === G.flameCap()) {
    const stash = JSON.stringify(G.save.stash);
    assert.equal(G.buyUpgrade("flame"), false);
    assert.equal(JSON.stringify(G.save.stash), stash);
    assert.equal(G.buyUpgrade("stakes"), true, "each cap can be lifted without a progression deadlock");
  }
  G.save.nights = DL.FLAME_NIGHTS[level + 1] - 1;
  assert.match(G.upgradeLock(flame, level), /night/);
  G.save.nights++;
  assert.equal(G.buyUpgrade("flame"), true);
  assert.equal(G.flame.hp, G.stats().flameHp);
  assert.equal(G.flame.max, G.stats().flameHp);
  assert.ok(flame.costs[level] && Object.values(flame.costs[level]).every(Number.isFinite));
}
assert.equal(G.flameCap(), 20);
assert.equal(G.save.up.stakes, 5);
assert.equal(G.buyUpgrade("flame"), false);
assert.equal(G.buyUpgrade("does-not-exist"), false);
for (const [level, tier] of [[1,1], [4,1], [5,2], [9,2], [10,3], [14,3], [15,4], [19,4], [20,5]]) {
  const up = { ...G.save.up, flame: level };
  assert.equal(DL.Camp.tier(up), tier);
  assert.equal(DL.Camp.layout(up).tier, tier);
  assert.ok(DL.TIER_NAMES[tier]);
}
DL.Net.role = "guest";
const saved = JSON.stringify(G.save);
G.buyUpgrade("flame");
assert.equal(DL.Net.sent.t, "build");
assert.equal(JSON.stringify(G.save), saved, "guests request upgrades without spending the host stash locally");
console.log("Flame progression passed: all levels 1–20, Barricade caps, costs, night locks, milestone tiers, guest authority.");
