/* Drowned Light — the fires of the Pyramid's squares (they replaced outposts; src/pyramid.js holds the squares).
   Every square the knights hold has a brazier of firelight at its middle in a ring of stakes. Supplies carried
   there are sent home to the camp's stash, and with your Kindle lit you can travel along his old paths between
   the camp and every square (DL.OUTPOST). The Drowned go for a square's fire like any light; destroyed, its square
   sinks and the Central Flame loses a level. Surviving squares recover at dawn. The host runs their fires and sends them in
   snapshots, which also tell a friend's device which squares are held. */
"use strict";
(function (DL) {
  const { dist, rand } = DL;
  const G = DL.Game, O = DL.OUTPOST;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Outposts = (DL.Outposts = {});
  G.outposts = [];

  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  Outposts.max = () => DL.Pyramid.limit();
  const name = (o) => `the ${compass(o.x, o.y)} square, ring ${DL.Pyramid.ring(o.gx, o.gy)}`;
  const maxHp = () => DL.PYRAMID.hp;
  // Version 0.15.171 stored 1 for a held square; widen only when it acquires changing state.
  function saveHp(o) {
    const sq = G.save.pyramid.sq, k = o.gx + "," + o.gy;
    if (!sq[k]) return;
    if (typeof sq[k] !== "object") sq[k] = {};
    sq[k].hp = o.hp;
  }

  // The live fires, one at the middle of every square the knights hold (the camp has its own Central Flame).
  // A fire keeps its state across a rebuild.
  Outposts.reset = function () {
    if (!G.isGuest()) DL.Pyramid.reset();
    const old = new Map(G.outposts.map((o) => [o.gx + "," + o.gy, o]));
    const list = [];
    DL.Pyramid.each((gx, gy) => {
      if (!gx && !gy) return;
      const c = DL.Pyramid.center(gx, gy);
      const saved = G.save.pyramid.sq[gx + "," + gy], max = maxHp();
      const hp = saved && Number.isFinite(saved.hp) ? Math.max(0, Math.min(max, saved.hp)) : max;
      const o = old.get(gx + "," + gy) || { kind: "outpost", gx, gy, x: c.x, y: c.y, rad: 14, hitT: 0 };
      Object.assign(o, { hp, max, lit: hp > 0 });
      list.push(o);
    });
    G.outposts = list;
    for (const o of list) DL.Pyramid.refreshBuildings(o);
  };
  Outposts.dawn = function () {
    for (const o of G.outposts) {
      o.lit = true; o.hp = o.max;
      if (!G.isGuest()) saveHp(o);
      for (const q of o.pylons || []) { q.lit = true; q.hp = q.max; }
    }
  };
  Outposts.update = function (dt) {
    for (const o of G.outposts) { o.hitT = Math.max(0, o.hitT - dt); for (const q of o.pylons || []) q.hitT = Math.max(0, q.hitT - dt); }
    DL.Pyramid.update(dt);
    DL.Pyramid.updateBuildings(dt);
  };

  // The square's fire a knight at (x, y) stands at, if any.
  Outposts.at = function (x, y) {
    for (const o of G.outposts) if (dist(x, y, o.x, o.y) < O.useR) return o;
    return null;
  };
  // The square a knight at (x, y) could claim, if any.
  Outposts.claimable = (x, y) => DL.Pyramid.claimable(x, y);
  // Why it can't be claimed (null when it can): the square at (gx, gy), or the one the knight stands in.
  Outposts.lock = function (gx, gy) {
    if (gx == null) { const s = G.player && DL.Pyramid.claimable(G.player.x, G.player.y); if (!s) return "Stand near the middle of a square next to your land"; gx = s.gx; gy = s.gy; }
    return DL.Pyramid.lock(gx, gy);
  };

  // Claim the square the knight stands in (a guest asks the host, who pays from the shared stash).
  Outposts.raise = function () {
    const p = G.player, spot = Outposts.claimable(p.x, p.y);
    if (!spot) return false;
    if (G.isGuest()) { DL.Net.event({ t: "outpost", gx: spot.gx, gy: spot.gy }); return true; }
    return Outposts.raiseHost(spot.gx, spot.gy, true);
  };
  Outposts.raiseHost = (gx, gy, mine) => DL.Pyramid.claimHost(gx, gy, mine);

  // The Drowned strike its fire (src/game.js).
  Outposts.hurt = function (o, amt) {
    if (G.isGuest() || G.save.up.flame <= 0 || !o.lit || !G.outposts.includes(o) || !Number.isFinite(amt) || amt <= 0) return;
    o.hp = Math.max(0, o.hp - amt);
    o.hitT = 0.2;
    for (let i = 0; i < 4; i++) G.spark(o.x, o.y - 24, "255,160,70", 80);
    if (o.hp <= 0 && o.lit) {
      o.lit = false; o.hp = 0;
      for (let i = 0; i < 14; i++) G.puff(o.x, o.y - 24, "rgba(40,40,40,0.7)", 50, 1);
      DL.Pyramid.lose(o.gx, o.gy);
      const msg = `The Drowned take ${name(o)}. Its land sinks into the marsh.`;
      DL.Net.say(msg, "danger");
      say(msg, "danger");
    } else {
      saveHp(o);
      G.persist();
    }
  };

  /* ---------------- travel ---------------- */
  // Where you can travel from here: the camp and every outpost but the one you stand at.
  Outposts.dests = function () {
    const p = G.player, here = G.atOutpost;
    const out = [];
    if (!G.inCamp) out.push({ id: "camp", name: "The camp", x: 0, y: 70, lit: true });
    G.outposts.forEach((o, i) => { if (o !== here) out.push({ id: i, name: name(o), x: o.x, y: o.y + 40, lit: o.lit, dir: compass(o.x, o.y), m: Math.round(Math.hypot(o.x, o.y) / 10) }); });
    if (DL.Finale.stage() === 3) { const h = DL.Finale.hearth(); out.push({ id: "gate", name: "the Drowned Gate", x: h.x, y: h.y + 160, lit: true, dir: compass(h.x, h.y), m: Math.round(Math.hypot(h.x, h.y) / 10) }); } // where the Fire Bearer waits
    for (const d of out) d.far = Math.round(dist(p.x, p.y, d.x, d.y) / 10);
    return out;
  };
  // Why you can't travel now (null when you can).
  Outposts.travelLock = function () {
    if (G.save.up.flame <= 0) return "The Central Flame is lost. This world has fallen";
    if (!DL.Kindle.lit() && DL.Finale.stage() < 1) return "You need a guide who knows the old paths. Something lost in the Mire still remembers them";
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
    say(`${DL.Finale.stage() >= 1 ? "The Fire Bearer's light" : "Your Kindle"} leads you along the old paths to ${d.id === "camp" ? "the camp" : d.name}.`, "good");
    return true;
  };

  /* ---------------- light and drawing ---------------- */
  Outposts.lights = function (L) {
    DL.Pyramid.buildingLights(L);
    for (const o of G.outposts) {
      if (o.lit) L.push({ x: o.x, y: o.y - 24, r: O.light * G.diff().light, s: 1, col: "255,140,60", a: 1, flick: 1, kind: "human" });
      else L.push({ x: o.x, y: o.y - 20, r: 30, s: 0.5, col: "255,80,30", a: 0.4, flick: 1 });
    }
  };
  const CLAIM_FIRE = 42; // px from the claim brazier's foot up to its coals
  // Into the y-sorted scene: the ring of stakes and the brazier (a drawn outpost replaces both once it's in).
  Outposts.push = function (list, c, t, view, sprite, fire, bar) {
    DL.Pyramid.pushBuildings(list, c, t, view, sprite, fire);
    for (const o of G.outposts) {
      if (o.x < view.left - 200 || o.x > view.right + 200 || o.y < view.top - 200 || o.y > view.bottom + 200) continue;
      const claim = DL.Art.sprites.claimBrazier; // Robert's claim brazier and banner (tools/cut_pyramid.py) mark a held square
      if (claim) {
        if (DL.Art.sprites.claimBanner) list.push({ y: o.y - 8, f: () => sprite(c, "claimBanner", o.x + 30, o.y - 4) });
        list.push({ y: o.y, f: () => {
          sprite(c, "claimBrazier", o.x, o.y + 4);
          const top = o.y + 4 - CLAIM_FIRE;
          if (o.lit) fire(c, o.x, top, 1.7 + (o.hitT > 0 ? -0.3 : 0), t);
          if (o.lit && o.hp < o.max) bar(c, o.x, top - 46, 30, o.hp / o.max, "#ffb35a");
        } });
        continue;
      }
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
  Outposts.rows = () => G.outposts.map((o) => [o.gx, o.gy, o.x, o.y, o.lit ? 1 : 0, Math.round(o.hp), o.max, o.b, (o.pylons || []).map((q) => [Math.round(q.hp), q.lit ? 1 : 0])]);
  Outposts.apply = function (rows) {
    G.outposts = (rows || []).map((r) => ({ kind: "outpost", gx: r[0], gy: r[1], x: r[2], y: r[3], lit: !!r[4], hp: r[5], max: r[6] || maxHp(), b: DL.Pyramid.cleanBuildings(r[7]), rad: 14, hitT: 0 }));
    DL.Pyramid.setHeld(G.outposts.map((o) => o.gx + "," + o.gy)); // a friend sees the host's pyramid
    G.outposts.forEach((o, i) => {
      DL.Pyramid.refreshBuildings(o);
      const states = rows[i][8] || [];
      (o.pylons || []).forEach((q, j) => { if (states[j]) { q.hp = states[j][0]; q.lit = !!states[j][1]; } });
    });
    if (G.atOutpost) G.atOutpost = G.outposts.find((o) => o.gx === G.atOutpost.gx && o.gy === G.atOutpost.gy) || null;
  };
})(window.DL);

