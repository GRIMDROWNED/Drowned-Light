/* Drowned Light — Kindle, a walking lantern on four spider legs. Every knight has their own to win:
   out in the Mire, about where the iron starts, a broken lantern lies cold. Feed it seven torches
   (walk up to it with torches in your satchel) and your Kindle flares alight for good and follows you.
   His fire doesn't hold off corruption, but every so often he tips some of it into his own knight's
   lantern, and every third night after the first Kindle in the world was lit, all of them lead their
   knights to the same unique place (the Bone Wolf den, Derek's cave, ...).
   Each device feeds and refills for its own knight; the host runs every lit Kindle and sends them in
   its snapshots. A Kindle a friend lit comes along into other worlds, like a hound. Numbers: DL.KINDLE. */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, K = DL.KINDLE;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Kindle = (DL.Kindle = {});
  G.kindles = [];

  /* Where the broken lantern lies: the same spot for every visit and every friend in a world of this
     difficulty, on dry land, clear of the bloom groves, the den and the cave. */
  let spot = null, spotFor = null;
  Kindle.spot = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE, den = DL.Den.spot(), cave = DL.Cave ? DL.Cave.mouth() : { x: 1e9, y: 0 };
    const dry = (x, y) => !W.isWater(x, y) && [0, 1, 2, 3, 4, 5].every((i) => !W.isWater(x + Math.cos(i * 1.05) * 50, y + Math.sin(i * 1.05) * 36));
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 500) / GR.cell); gy <= Math.floor((y + 500) / GR.cell); gy++)
        for (let gx = Math.floor((x - 500) / GR.cell); gx <= Math.floor((x + 500) / GR.cell); gx++) {
          const g = W.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 420) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 64 && !spot; t++) {
      const a = DL.hash(47, 23, 600 + t) * TAU, r = K.dist + (DL.hash(47, 23, 680 + t) - 0.5) * 160;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y) && Math.hypot(x - den.x, y - den.y) > 700 && Math.hypot(x - cave.x, y - cave.y) > 500) spot = { x, y };
    }
    spot = spot || { x: -K.dist, y: 0 };
    spotFor = G.save.difficulty;
    return spot;
  };

  /* The unique places he can lead you to. A new one only needs an entry here: where it is, and
     whether the host has found it yet (places not found yet come first). */
  Kindle.sites = function () {
    const list = [{ id: "den", name: "the Bone Wolf den", at: DL.Den.spot, found: () => !!G.save.den.found }];
    if (DL.Cave && DL.Cave.mouth) list.push({ id: "cave", name: "the mouth of Derek's cave", at: DL.Cave.mouth, found: () => !!G.save.caveFound });
    if (DL.Abigail) list.push({ id: "graves", name: "the old graves in the Abyss", at: DL.Abigail.graveSpot, found: () => !!G.save.souls.found });
    return list;
  };
  const site = (id) => Kindle.sites().find((s) => s.id === id) || null;
  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];

  /* ---------------- whose is lit (each device for its own knight) ---------------- */
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  // A friend's progress lives in their co-op profile, so it comes with them from world to world.
  function mine() {
    if (!G.isGuest()) return G.save.kindle;
    return { lit: DL.Net.hasKindle(), fed: DL.Net.profile().kindleFed || 0 };
  }
  Kindle.lit = () => !!mine().lit;
  Kindle.mine = () => G.kindles.find((k) => k.owner === myId()) || null;
  function ownerOf(k) {
    if (k.owner === 0) return G.state === "play" || G.state === "camp" ? G.player : null;
    return G.allies.find((a) => a.id === k.owner) || null;
  }

  // One Kindle per knight, ever: a second lighting or joining only gives back the one they have.
  function spawn(owner, x, y) {
    const had = G.kindles.find((o) => o.owner === owner);
    if (had) return had;
    const k = { id: ++G.eid, kindle: true, owner, x, y, angle: Math.PI / 2, moving: false, animT: 0 };
    G.kindles.push(k);
    const S = G.save.kindle;
    if (S.since < 0) { S.since = G.save.nights; G.persist(); } // the guiding count starts with the world's first Kindle
    return k;
  }
  // A new life (or a reload): your lit Kindle is back at your side.
  let refillT = 0, feedT = 0, asked = false, found = false;
  Kindle.reset = function () {
    G.kindles = [];
    refillT = K.refillEvery * 0.5;
    if (!G.isGuest() && G.save.kindle.lit && G.player) spawn(0, G.player.x - 26, G.player.y + 10);
  };
  // Host: a friend who has lit their Kindle (here or in any world) brings it along.
  Kindle.join = function (owner) {
    const a = G.allies.find((o) => o.id === owner);
    if (a) spawn(owner, a.x - 26, a.y + 10);
  };
  // Host: a friend left, and their Kindle goes with them (so a friend who joins next under the same number
  // doesn't inherit it).
  Kindle.leave = function (owner) { G.kindles = G.kindles.filter((k) => k.owner !== owner); };

  /* ---------------- feeding the broken lantern (your own device) ---------------- */
  Kindle.feed = function (dt) {
    const p = G.player;
    if (!p || G.state !== "play" || Kindle.lit()) return;
    const s = Kindle.spot(), d = dist(p.x, p.y, s.x, s.y), M = mine(), left = K.torches - M.fed;
    if (!found && d < 380) {
      found = true;
      if (!G.isGuest() && !G.save.kindle.found) { G.save.kindle.found = true; G.persist(); }
      say(`A broken lantern lies here on four bent legs, cold and dark. It needs ${left} torch${left > 1 ? "es" : ""} to burn again.`, "warn");
    }
    feedT = Math.max(0, feedT - dt);
    if (d > 200) asked = false;
    if (d > K.feedR || feedT > 0) return;
    if (G.save.torches <= 0) {
      if (!asked) { asked = true; say(`The lantern needs ${left} more torch${left > 1 ? "es" : ""}. Craft them at the camp.`, "warn"); }
      return;
    }
    asked = false;
    feedT = K.feedEvery;
    G.save.torches -= 1;
    const fed = M.fed + 1;
    sfx("torch");
    for (let i = 0; i < 8; i++) G.spark(s.x, s.y - 10, "255,170,70", 70);
    if (fed < K.torches) {
      store({ fed });
      say(`You feed a torch into the broken lantern (${fed}/${K.torches}).`, "good");
      return;
    }
    store({ fed, lit: true });
    sfx("milestone");
    for (let i = 0; i < 24; i++) G.spark(s.x, s.y - 16, "255,190,90", 140);
    for (let i = 0; i < 10; i++) G.puff(s.x + rand(-10, 10), s.y - rand(0, 20), "rgba(90,80,70,0.6)", 40, 0.9, -30);
    say("Kindle flares alight! The lantern stands up on its four legs and scuttles to your side.", "good");
    refillT = K.refillEvery * 0.5;
    if (G.isGuest()) DL.Net.event({ t: "kindle" }); // the host raises him beside you
    else spawn(0, s.x, s.y);
  };
  function store(v) {
    if (!G.isGuest()) { Object.assign(G.save.kindle, v); G.persist(); return; }
    const pr = DL.Net.profile();
    pr.kindleFed = v.fed;
    if (v.lit) pr.kindle = 1;
    DL.Net.saveProfile(pr);
  }

  /* ---------------- refilling your lantern (your own device) ---------------- */
  // Now and then your own Kindle tops up your lantern. Only the oil: corruption you already carry stays.
  Kindle.refill = function (dt) {
    const k = Kindle.mine(), p = G.player, st = G.stats();
    refillT -= dt;
    if (!k || !p || G.state !== "play" || refillT > 0 || p.oil >= st.maxOil * K.refillBelow || dist(k.x, k.y, p.x, p.y) > 120) return;
    p.oil = st.maxOil;
    refillT = K.refillEvery;
    sfx("chime");
    k.pourAt = performance.now();
    G.effects.push({ type: "kindleRefill", x1: k.x, y1: k.y - 18, x2: p.x, y2: p.y - 28, t: 0, max: 0.6 });
    if (!G.save.kindle.refilled) { G.save.kindle.refilled = true; if (!G.isGuest()) G.persist(); say("Kindle tips some of his flame into your lantern. Your oil is full.", "good"); }
  };

  /* ---------------- the Kindles themselves (host only) ---------------- */
  Kindle.update = function (dt) {
    Kindle.feed(dt);
    const S = G.save.kindle, g = S.guide && site(S.guide), at = g && g.at();
    if (S.guide && !g) S.guide = null;
    for (const k of G.kindles) step(k, dt, g, at);
    G.kindles = G.kindles.filter((k) => !k.gone);
    // every knight with a Kindle has been shown the way: the guiding is over
    if (g && G.kindles.length && G.kindles.every((k) => k.arrived)) {
      S.guide = null;
      S.led[g.id] = (S.led[g.id] || 0) + 1;
      for (const k of G.kindles) k.arrived = false;
      G.persist();
    }
    Kindle.refill(dt);
  };

  function step(k, dt, g, at) {
    const p = ownerOf(k);
    if (!p) { if (k.owner !== 0) k.gone = true; return; }
    k.animT += dt;
    if (dist(k.x, k.y, p.x, p.y) > 700) {
      Object.assign(k, { x: p.x - 26, y: p.y + 10 });
      for (let i = 0; i < 8; i++) G.spark(k.x, k.y - 14, "255,170,70", 60);
    }
    // Leading the way: he runs out ahead of his knight toward the place, and stops once they're there.
    let fx, fy;
    k.lead = null;
    if (g && !k.arrived) {
      const d = dist(p.x, p.y, at.x, at.y);
      if (d < K.reachR) {
        k.arrived = true;
        tell(k.owner, `Kindle has led you to ${g.name}.`, "good");
        if (k.owner === 0) sfx("chime");
      } else {
        const ux = (at.x - p.x) / d, uy = (at.y - p.y) / d;
        fx = p.x + ux * K.lead; fy = p.y + uy * K.lead;
        k.lead = Math.atan2(at.y - k.y, at.x - k.x);
      }
    }
    if (fx == null) {
      // otherwise he trots at his knight's heel, behind and to the left
      const a = p.angle || 0;
      fx = p.x - Math.cos(a) * 26 + Math.cos(a - Math.PI / 2) * 18;
      fy = p.y - Math.sin(a) * 18 + Math.sin(a - Math.PI / 2) * 14 + 8;
    }
    const d = dist(k.x, k.y, fx, fy);
    k.moving = d > 12;
    if (!k.moving) return;
    let mx = fx - k.x, my = fy - k.y;
    const wp = DL.Hounds.gateWay(k, fx, fy);
    if (wp) { mx = wp.x - k.x; my = wp.y - k.y; }
    const md = Math.hypot(mx, my) || 1, spd = d > 140 ? K.speed * 1.4 : Math.min(K.speed, d * 3.5);
    k.x += (mx / md) * spd * dt;
    k.y += (my / md) * spd * dt;
    k.angle = Math.atan2(my, mx);
    DL.World.collide(k, 6);
    G.collideCamp(k, 6);
  }
  function tell(id, msg, kind) {
    if (id === 0) say(msg, kind);
    else DL.Net.tell(id, msg, kind);
  }

  // Every third dawn after the world's first Kindle was lit, they all pick the same place to show:
  // one the host hasn't found first, then the one they've led to least.
  Kindle.dawn = function () {
    const S = G.save.kindle;
    if (S.since < 0 || S.guide || !G.kindles.length) return;
    const n = G.save.nights - S.since;
    if (n <= 0 || n % K.guideEvery) return;
    const list = Kindle.sites();
    if (!list.length) return;
    list.sort((a, b) => (a.found() ? 1 : 0) - (b.found() ? 1 : 0) || (S.led[a.id] || 0) - (S.led[b.id] || 0));
    const g = list[0], at = g.at();
    S.guide = g.id;
    for (const k of G.kindles) k.arrived = false;
    G.persist();
    const msg = `Kindle's flame leans to the ${compass(at.x, at.y)}. He wants to show you something: follow him.`;
    setTimeout(() => { for (const k of G.kindles) tell(k.owner, msg, "good"); }, 2500);
  };

  // Light: a lantern's glow to see by, but not firelight. It doesn't hold back corruption. Your own
  // broken lantern glows faintly so you can find it at night.
  Kindle.lights = function (L) {
    for (const k of G.kindles) L.push({ x: k.x, y: k.y - 18, r: 70, s: 0.5, col: "255,175,80", a: 0.7, flick: 1 });
    const b = Kindle.broken();
    if (b) L.push({ x: b.x, y: b.y - 8, r: 22, s: 0.3, col: "255,120,60", a: 0.35 });
  };
  // The broken lantern as this device draws it: only until your own Kindle is lit.
  Kindle.broken = () => (G.state === "title" || Kindle.lit() ? null : Object.assign({ fed: mine().fed }, Kindle.spot()));

  // The field guide's line about him (camp menu).
  Kindle.guideLine = function () {
    const M = mine();
    if (M.lit) return `<b>Kindle</b> follows you. He tops up your lantern oil now and then (not your corruption), and every ${K.guideEvery} nights he leads you somewhere worth finding.`;
    if (G.save.kindle.found || M.fed) { const s = Kindle.spot(); return `A broken lantern lies to the ${compass(s.x, s.y)} of the camp. Walk up to it with torches: ${K.torches - M.fed} more and your <b>Kindle</b> burns again.`; }
    return `Somewhere in the Mire, where the iron starts, a broken lantern waits for ${K.torches} torches.`;
  };

  // Co-op: each lit Kindle as [id, owner, x, y, angle, moving, angle he leads toward or null]
  Kindle.rows = function () {
    const r1 = (v) => Math.round(v * 10) / 10;
    return G.kindles.map((k) => [k.id, k.owner, r1(k.x), r1(k.y), r1(k.angle), k.moving ? 1 : 0, k.lead == null ? null : r1(k.lead)]);
  };
  Kindle.apply = function (rows) {
    const old = new Map(G.kindles.map((k) => [k.id, k]));
    G.kindles = (rows || []).map((r) => {
      const k = old.get(r[0]) || { id: r[0], kindle: true, x: r[2], y: r[3], animT: 0 };
      return Object.assign(k, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], lead: r[6] });
    });
  };
  // Guest: glide toward the host's positions, and do your own feeding and refills.
  Kindle.guest = function (dt, k01) {
    for (const k of G.kindles) {
      if (k.tx == null) continue;
      k.x += (k.tx - k.x) * k01; k.y += (k.ty - k.y) * k01;
      k.animT += dt;
    }
    Kindle.feed(dt);
    Kindle.refill(dt);
  };
})(window.DL);
