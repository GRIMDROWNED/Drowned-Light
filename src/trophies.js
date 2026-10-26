/* Drowned Light — trophies of the Abyss bosses, built in the camp (DL.UPGRADES "bell" and "roseheart").
   Slaying the Starved Bell gives its clapper for the Bell Tower (its tolls are in src/siege.js). Slaying the
   Deadly Rose gives her heart: planted inside the walls it wakes at dusk and, every few seconds, bursts briar up
   under the Drowned nearest it, binding them where they stand (DL.ROSE_HEART). The host's device runs the
   binding and sends the briar in its snapshots. */
"use strict";
(function (DL) {
  const { dist, rand } = DL;
  const G = DL.Game;
  const say = (m, k) => { if (DL.UI) DL.UI.toast(m, k); DL.Net.say(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const RED = "200,30,50";
  const Trophies = (DL.Trophies = {});
  let vines = [], bindT = 2;

  // A boss slain for the first time: its trophy can now be built.
  Trophies.won = function (kind) {
    if (G.isGuest() || G.save.trophies[kind]) return;
    G.save.trophies[kind] = 1;
    G.persist();
    setTimeout(() => say(kind === "bell"
      ? "You pry the clapper from the Starved Bell. Hung in your camp, it would toll before the Drowned come: build the Bell Tower."
      : "Her heart still beats, a great red bud. Planted in your camp, it would bind the Drowned in briar: build the Rose Heart.", "good"), 2200);
  };

  Trophies.reset = function () { vines = []; bindT = 2; };
  // Where the heart stands in the camp, and its level's numbers.
  Trophies.heart = function () {
    const lv = G.save.up.roseheart, L = DL.Camp.layout(G.save.up);
    return lv && L.roseheart ? Object.assign({ x: L.roseheart.x, y: L.roseheart.y, lv }, DL.ROSE_HEART.levels[lv - 1]) : null;
  };
  const awake = () => G.nightAmt > 0.3 && !G.cave;

  /* ---------------- the binding (host) ---------------- */
  const valid = (e) => !e.removed && e.rise <= 0 && !e.dormant && !e.isSelf;
  Trophies.update = function (dt) {
    for (const v of vines) v.t += dt;
    vines = vines.filter((v) => v.t < v.life);
    if (G.isGuest()) return;
    const h = Trophies.heart();
    // the bound: held fast, stung every half second
    for (const e of G.enemies) {
      if (!(e.bound > 0)) continue;
      e.bound -= dt;
      e.stun = Math.max(e.stun || 0, Math.min(e.bound, 0.2));
      e.stingT = (e.stingT || 0) - dt;
      if (e.stingT <= 0 && h) { e.stingT = 0.5; G.hitEnemy(e, h.sting, 0, 0); }
    }
    if (!h || !awake()) return;
    bindT -= dt;
    if (bindT > 0) return;
    const prey = G.enemies.filter((e) => valid(e) && !(e.bound > 0) && dist(h.x, h.y, e.x, e.y) < h.reach)
      .sort((a, b) => dist(h.x, h.y, a.x, a.y) - dist(h.x, h.y, b.x, b.y)).slice(0, h.n);
    if (!prey.length) { bindT = 0.5; return; }
    bindT = h.every;
    sfx("swing");
    for (const e of prey) bind(e, h);
  };
  function bind(e, h) {
    const hold = e.def.boss ? h.hold / 2 : h.hold;
    e.bound = hold;
    e.stingT = 0.3;
    e.kx = e.ky = 0;
    vines.push({ x: e.x, y: e.y + 2, v: Math.random() < 0.5 ? 0 : 1, t: 0, life: hold + 0.5 });
    G.effects.push({ type: "roseBind", x1: h.x, y1: h.y - 30, x2: e.x, y2: e.y - 20, t: 0, max: 0.35 });
    for (let i = 0; i < 8; i++) G.spark(e.x + rand(-10, 10), e.y - rand(0, 30), RED, 70);
  }

  /* ---------------- drawing ---------------- */
  // Into the y-sorted scene: the briar holding each bound Drowned.
  Trophies.push = function (list, c) {
    for (const v of vines) list.push({ y: v.y, f: () => DL.Rose.drawVine(c, v, v.t) });
  };
  // Its glow at night, red and slow, wider with each level.
  Trophies.lights = function (L) {
    const h = Trophies.heart();
    if (h && G.nightAmt > 0.3) L.push({ x: h.x, y: h.y - 30, r: 50 + 12 * h.lv, s: 0.5, col: RED, a: 0.7 });
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Trophies.rows = () => vines.map((v) => [r1(v.x), r1(v.y), v.v, r1(v.t), r1(v.life)]);
  Trophies.apply = function (rows) {
    vines = (rows || []).map((r) => ({ x: r[0], y: r[1], v: r[2], t: r[3], life: r[4] }));
  };
})(window.DL);
