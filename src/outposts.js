/* Drowned Light — outposts. From Central Flame 3, a knight standing at the heart of a bloom grove can raise an
   outpost there: a brazier of firelight in a ring of stakes. Supplies carried to an outpost are sent home to
   the camp's stash, and with your Kindle lit you can travel along his old paths between the camp and every
   outpost (DL.OUTPOST). The Drowned go for an outpost's fire like any light; snuffed, it's lit again at dawn.
   Outposts belong to the world (the host's save); the host runs their fires and sends them in snapshots. */
"use strict";
(function (DL) {
  const { dist, rand } = DL;
  const G = DL.Game, O = DL.OUTPOST;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Outposts = (DL.Outposts = {});
  G.outposts = [];

  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  Outposts.max = () => O.max[G.save.up.flame] || 0;

  // The live fires, one per saved outpost.
  Outposts.reset = function () {
    G.outposts = (G.save.outposts || []).map(([gx, gy, x, y]) => ({ kind: "outpost", gx, gy, x, y, rad: 14, hp: O.hp, max: O.hp, lit: true, hitT: 0 }));
  };
  Outposts.dawn = function () { for (const o of G.outposts) { o.lit = true; o.hp = o.max; } };
  Outposts.update = function (dt) { for (const o of G.outposts) o.hitT = Math.max(0, o.hitT - dt); };

  // The outpost a knight at (x, y) stands at, if any.
  Outposts.at = function (x, y) {
    for (const o of G.outposts) if (dist(x, y, o.x, o.y) < O.useR) return o;
    return null;
  };
  // The unclaimed grove heart a knight at (x, y) could raise an outpost on, if any.
  Outposts.claimable = function (x, y) {
    if (G.cave) return null;
    const GR = DL.GROVE, gx = Math.floor(x / GR.cell), gy = Math.floor(y / GR.cell);
    const g = DL.World.grove(gx, gy, G.diff());
    if (!g || dist(x, y, g.x, g.y) > O.claimR) return null;
    if (G.outposts.some((o) => o.gx === gx && o.gy === gy)) return null;
    return { gx, gy, x: Math.round(g.x), y: Math.round(g.y) };
  };
  // Why one can't be raised (null when it can).
  Outposts.lock = function () {
    if (G.save.up.flame < O.reqFlame) return `Needs Central Flame ${O.reqFlame}`;
    if (G.outposts.length >= Outposts.max()) return G.save.up.flame >= 5 ? "No more outposts" : "Needs a higher Central Flame for another";
    if (!G.canAfford(O.cost)) return "Not enough in the camp's stash";
    return null;
  };

  // Raise an outpost on the grove the knight stands in (a guest asks the host, who builds it from the shared stash).
  Outposts.raise = function () {
    const p = G.player, spot = Outposts.claimable(p.x, p.y);
    if (!spot) return false;
    if (G.isGuest()) { DL.Net.event({ t: "outpost", gx: spot.gx, gy: spot.gy }); return true; }
    return Outposts.raiseHost(spot.gx, spot.gy, true);
  };
  Outposts.raiseHost = function (gx, gy, mine) {
    const g = DL.World.grove(gx, gy, G.diff()), lock = Outposts.lock();
    if (!g || G.outposts.some((o) => o.gx === gx && o.gy === gy)) return false;
    if (lock) { if (mine) { sfx("deny"); say(lock + ".", "warn"); } return false; }
    G.pay(O.cost);
    const x = Math.round(g.x), y = Math.round(g.y);
    G.save.outposts.push([gx, gy, x, y]);
    G.persist();
    Outposts.reset();
    sfx("build");
    for (let i = 0; i < 20; i++) G.puff(x + rand(-50, 50), y - rand(0, 20), "rgba(160,130,90,0.6)", 50, 0.9, -20);
    const msg = "An outpost rises in the grove: a brazier of firelight in a ring of stakes. Supplies brought here go home to the camp.";
    say(msg, "good");
    DL.Net.say(msg, "good");
    return true;
  };

  // The Drowned strike its fire (src/game.js).
  Outposts.hurt = function (o, amt) {
    o.hp -= amt;
    o.hitT = 0.2;
    for (let i = 0; i < 4; i++) G.spark(o.x, o.y - 24, "255,160,70", 80);
    if (o.hp <= 0 && o.lit) {
      o.lit = false; o.hp = 0;
      for (let i = 0; i < 14; i++) G.puff(o.x, o.y - 24, "rgba(40,40,40,0.7)", 50, 1);
      DL.Net.say("An outpost's fire has been snuffed out.", "warn");
      say("An outpost's fire has been snuffed out.", "warn");
    }
  };

  /* ---------------- travel ---------------- */
  // Where you can travel from here: the camp and every outpost but the one you stand at.
  Outposts.dests = function () {
    const p = G.player, here = G.atOutpost;
    const out = [];
    if (!G.inCamp) out.push({ id: "camp", name: "The camp", x: 0, y: 70, lit: true });
    G.outposts.forEach((o, i) => { if (o !== here) out.push({ id: i, name: `Outpost ${i + 1}`, x: o.x, y: o.y + 40, lit: o.lit, dir: compass(o.x, o.y), m: Math.round(Math.hypot(o.x, o.y) / 10) }); });
    for (const d of out) d.far = Math.round(dist(p.x, p.y, d.x, d.y) / 10);
    return out;
  };
  // Why you can't travel now (null when you can).
  Outposts.travelLock = function () {
    if (!DL.Kindle.lit()) return "Light your Kindle first: he knows the old paths";
    if (G.night && G.enemies.some((e) => !e.removed && e.rise <= 0 && dist(e.x, e.y, G.player.x, G.player.y) < O.safeR)) return "The Drowned are too close";
    return null;
  };
  Outposts.travel = function (id) {
    const d = Outposts.dests().find((q) => String(q.id) === String(id));
    if (!d || !d.lit || Outposts.travelLock()) { sfx("deny"); return false; }
    const p = G.player;
    for (let i = 0; i < 16; i++) G.puff(p.x + rand(-10, 10), p.y - rand(0, 40), "rgba(255,190,110,0.6)", 50, 0.8, -30);
    p.x = d.x + rand(-6, 6); p.y = d.y;
    G.camera.x = p.x; G.camera.y = p.y;
    // your companions come along the same path (the host moves them; a friend's catch up on their own)
    if (!G.isGuest()) for (const list of [G.hounds, G.golems, G.wraiths, G.kindles || []]) for (const m of list) if (m.owner === 0) { m.x = p.x + rand(-30, 30); m.y = p.y + rand(5, 20); }
    for (let i = 0; i < 16; i++) G.puff(p.x + rand(-10, 10), p.y - rand(0, 40), "rgba(255,190,110,0.6)", 50, 0.8, -30);
    sfx("torch");
    say(`Your Kindle leads you along the old paths to ${d.id === "camp" ? "the camp" : d.name}.`, "good");
    return true;
  };

  /* ---------------- light and drawing ---------------- */
  Outposts.lights = function (L) {
    for (const o of G.outposts) {
      if (o.lit) L.push({ x: o.x, y: o.y - 24, r: O.light * G.diff().light, s: 1, col: "255,140,60", a: 1, flick: 1, kind: "human" });
      else L.push({ x: o.x, y: o.y - 20, r: 30, s: 0.5, col: "255,80,30", a: 0.4, flick: 1 });
    }
  };
  // Into the y-sorted scene: the ring of stakes and the brazier (a drawn outpost replaces both once it's in).
  Outposts.push = function (list, c, t, view, sprite, fire, bar) {
    for (const o of G.outposts) {
      if (o.x < view.left - 200 || o.x > view.right + 200 || o.y < view.top - 200 || o.y > view.bottom + 200) continue;
      const big = DL.Art.sprites.outpost; // the drawn outpost brings its own stakes
      if (!big) for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3, x = o.x + Math.cos(a) * 58, y = o.y + Math.sin(a) * 40;
        list.push({ y, f: () => sprite(c, "stake", x, y + 2, i % 2 === 0) });
      }
      list.push({ y: o.y, f: () => {
        if (big) sprite(c, "outpost", o.x, o.y + 4);
        else sprite(c, "brazier", o.x, o.y + 2);
        const top = big ? o.y - 68 : o.y + 14 - DL.Art.sprites.brazier.h * 2;
        if (o.lit) fire(c, o.x, top, 1.5 + (o.hitT > 0 ? -0.3 : 0), t);
        if (o.lit && o.hp < o.max) bar(c, o.x, top - 50, 30, o.hp / o.max, "#ffb35a");
      } });
    }
  };

  /* ---------------- co-op ---------------- */
  Outposts.rows = () => G.outposts.map((o) => [o.gx, o.gy, o.x, o.y, o.lit ? 1 : 0, Math.round(o.hp)]);
  Outposts.apply = function (rows) {
    G.outposts = (rows || []).map((r) => ({ kind: "outpost", gx: r[0], gy: r[1], x: r[2], y: r[3], lit: !!r[4], hp: r[5], max: O.hp, rad: 14, hitT: 0 }));
  };
})(window.DL);
