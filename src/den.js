/* Drowned Light — the Bone Wolf den: one lair out in the Mire, where a pack of five Bone Wolves sleeps.
   Kill all five, haul one of their carcasses back into the camp, and it rises as your Bone Hound
   (src/hounds.js). In co-op every knight hauls their own. The host's device runs the den and the pack;
   guests see the carcasses and who carries one in the snapshots (src/net.js). Numbers are in DL.DEN. */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, D = DL.DEN;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  // carry: who hauls which carcass (knight id: 0 is the host, friends by their co-op number); view: the guest's copy
  const Den = (DL.Den = { carry: new Map(), view: null });

  /* Where it lies: the same spot for every visit and every co-op friend in a world of this difficulty,
     on dry land and well away from the bloom groves, so holding a grove and raiding the den don't mix. */
  let spot = null, spotFor = null;
  Den.spot = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE;
    const dry = (x, y) => !W.isWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !W.isWater(x + Math.cos(i * 0.785) * 110, y + Math.sin(i * 0.785) * 80));
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 600) / GR.cell); gy <= Math.floor((y + 600) / GR.cell); gy++)
        for (let gx = Math.floor((x - 600) / GR.cell); gx <= Math.floor((x + 600) / GR.cell); gx++) {
          const g = W.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 520) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 64 && !spot; t++) {
      const a = DL.hash(31, 17, 900 + t) * TAU, r = D.dist + (DL.hash(31, 17, 980 + t) - 0.5) * 300;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y)) spot = { x, y };
    }
    spot = spot || { x: D.dist, y: 0 };
    spotFor = G.save.difficulty;
    return spot;
  };
  // Which way it lies from the camp, in words.
  Den.direction = function () {
    const s = Den.spot(), a = Math.atan2(s.y, s.x);
    return ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  };

  // What every device draws: is the pack broken, the carcasses still lying there [x, y, angle], and who hauls one.
  Den.state = function () {
    if (G.isGuest()) return Den.view || { cleared: false, bodies: [], carriers: [] };
    const taken = new Set(Den.carry.values());
    return { cleared: G.save.den.cleared, bodies: G.save.den.bodies.filter((b) => !taken.has(b)), carriers: [...Den.carry.keys()] };
  };
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Den.carrying = (id = myId()) => Den.state().carriers.includes(id);

  /* ---------------- the pack (host only) ---------------- */
  const knightOf = (id) => (id === 0 ? (G.state === "play" || G.state === "camp" ? G.player : null) : G.allies.find((a) => a.id === id && !a.down) || null);
  const knights = () => [[0, knightOf(0)], ...G.allies.map((a) => [a.id, knightOf(a.id)])].filter(([, k]) => k);
  const hasHound = (id) => G.hounds.some((h) => h.owner === id && !h.gone);

  function spawnPack(n) {
    const s = Den.spot(), zi = Math.max(1, DL.World.zoneIndex(s.x, s.y));
    for (let i = 0; i < n; i++) {
      // curled up in a fan in front of the den's mouth
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.55, r = 70 + 26 * (i % 2);
      const x = s.x + Math.cos(a) * r, y = s.y + 14 + Math.sin(a) * r * 0.7;
      G.enemies.push(G.makeEnemy("bonewolf", x, y, zi, { dormant: true, homeX: x, homeY: y, angle: a + Math.PI }));
    }
  }

  Den.update = function (dt) {
    const s = G.save.den, at = Den.spot(), ks = knights();
    // a carcass whose hauler fell or left drops back where it lay
    for (const id of [...Den.carry.keys()]) if (!knightOf(id)) Den.carry.delete(id);
    const near = Math.min(1e9, ...ks.map(([, k]) => dist(k.x, k.y, at.x, at.y)));
    if (!s.found && dist(G.player.x, G.player.y, at.x, at.y) < 520) {
      s.found = true;
      G.persist();
      say("Bones crunch underfoot. This is the Bone Wolf den.", "warn");
    }
    const pack = G.enemies.filter((e) => e.def.den && !e.removed);
    if (!s.cleared) {
      if (!pack.length && near < D.spawn) spawnPack(D.pack - s.bodies.length);
      else if (pack.length && near > D.forget) {
        // everyone left before the pack was broken: it gathers again, whole
        for (const e of pack) e.removed = true;
        G.enemies = G.enemies.filter((e) => !e.removed);
        s.bodies = [];
        G.persist();
      } else if (pack.some((e) => !e.dormant && !e.homing)) {
        // one wakes, they all wake
        for (const e of pack) if (e.dormant) { e.dormant = false; e.homing = false; }
      }
    }
    // Hauling: once the pack is broken, a knight without a hound picks a carcass up by walking over it.
    if (s.cleared) for (const [id, k] of ks) {
      if (Den.carry.has(id) || hasHound(id)) continue;
      const taken = new Set(Den.carry.values());
      const b = s.bodies.find((q) => !taken.has(q) && dist(k.x, k.y, q[0], q[1]) < D.grab);
      if (!b) continue;
      Den.carry.set(id, b);
      tell(id, "You take up a Bone Wolf's carcass. Carry it into the camp and it will rise for you.", "good");
      sfx("pickup");
    }
    // Into the camp with it: it rises as that knight's Bone Hound.
    for (const [id, b] of [...Den.carry]) {
      const k = knightOf(id);
      if (!k || DL.Camp.sq(k.x, k.y) >= DL.CAMP_RADIUS) continue;
      Den.carry.delete(id);
      s.bodies = s.bodies.filter((q) => q !== b);
      DL.Hounds.grant(id);
    }
  };
  function tell(id, msg, kind) {
    if (id === 0) say(msg, kind);
    else DL.Net.tell(id, msg, kind);
  }

  // A wolf killed: its carcass stays where it fell. The fifth breaks the pack.
  Den.slain = function (e) {
    const s = G.save.den;
    sfx("shatter");
    for (let i = 0; i < 12; i++) G.puff(e.x + rand(-10, 10), e.y - rand(0, 24), "rgba(200,190,160,0.6)", 50, 0.9, -20);
    s.bodies.push([Math.round(e.x), Math.round(e.y), Math.round(e.angle * 10) / 10]);
    if (s.bodies.length >= D.pack && !s.cleared) {
      s.cleared = true;
      const msg = "The pack is broken. Carry a carcass back into the camp, and see what rises.";
      say(msg, "good");
      DL.Net.say(msg, "good");
    }
    G.persist();
  };

  /* A wolf whose prey ran off too far trots home to its spot and curls up again, healed. Returns true
     while it's on its way (the rest of its turn is skipped). */
  Den.homing = function (e, p, dt) {
    if (e.dormant) return false;
    const pd = dist(p.x, p.y, e.homeX, e.homeY);
    if (!e.homing && pd < D.leash) return false;
    if (e.homing && pd < D.wake) { e.homing = false; return false; }
    e.homing = true;
    e.state = "move";
    const dx = e.homeX - e.x, dy = e.homeY - e.y, d = Math.hypot(dx, dy);
    if (d < 12) {
      Object.assign(e, { homing: false, dormant: true, moving: false, hp: e.maxHp, bleed: 0, burn: 0 });
      return true;
    }
    e.x += (dx / d) * e.speed * 0.8 * dt;
    e.y += (dy / d) * e.speed * 0.8 * dt;
    e.angle = Math.atan2(dy, dx);
    e.moving = true;
    return true;
  };

  // The den fills again at the dawn after its last carcass is taken.
  Den.dawn = function () {
    const s = G.save.den;
    if (s.cleared && !s.bodies.length) { s.cleared = false; G.persist(); }
  };
  // A new life: whatever you were hauling is back at the den.
  Den.reset = function () { Den.carry.clear(); };

  // Co-op: the den as sent to a friend, and as the friend reads it.
  Den.row = function () {
    const st = Den.state();
    return [st.cleared ? 1 : 0, st.bodies, st.carriers];
  };
  Den.apply = function (r) {
    if (r) Den.view = { cleared: !!r[0], bodies: r[1], carriers: r[2] };
  };
})(window.DL);
