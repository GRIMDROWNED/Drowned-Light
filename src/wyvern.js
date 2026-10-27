/* Drowned Light — Gerald, a wyvern familiar, won by stealing an egg from a nest and killing its mother.
   A nest of bones and black branches sits on the rocks of the Drowned Reaches with a clutch of blood-red eggs in
   it, while the mother is out hunting. Walk into the nest and you take an egg, and she comes for it at once: she
   hunts whoever carries it wherever they run, over walls and water, until one of them is dead. Slay her and the
   egg hatches into a skeletal little wyvern (every knight close by takes an egg from the clutch too). Fall, and
   she snatches the egg back and flies home with it. Slain, she's gone a few days and her nest lies empty.
   Her moves: a claw (her ordinary blow); the swoop, rising and diving straight through her prey; fire breath in a
   cone; and below half her health, lightning called down on every knight near her.
   Gerald flies at his knight's shoulder and spits bolts at the Drowned. At levels 5, 10 and 15 you choose his
   road: A, the Storm (Chain Lightning, Tailwind, Static Shock) or B, the Fire (Searing Bolt, War Fury,
   Cauterize). Tailwind and War Fury are boosts the knight calls with the Boost button: 20 s on, 40 s from one to
   the next. The host runs every Gerald, the mother and the egg, and sends them in its snapshots; each device
   calls its own boost and is healed by its own Cauterize. Numbers: DL.WYVERN, DL.ENEMIES.wyvern.
   Until Robert's drawings are in, Gerald, his mother and the nest are drawn here in code. */
"use strict";
(function (DL) {
  const { dist, rand, TAU, angleDiff } = DL;
  const G = DL.Game, W = DL.WYVERN;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const CAST = 0.4, CAST_AT = 0.2; // his spit, and when the bolt leaves him
  const BLOOD = "255,80,60", STORM = "170,210,255", FIRE = "255,140,50";
  const NAME = "The mother wyvern";
  const Wyv = (DL.Wyvern = { boostT: 0, boostCd: 0, boostKind: null, healT: 0, cauterCd: 0 });
  G.wyverns = [];

  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Wyv.won = () => (G.isGuest() ? DL.Net.hasWyvern() : !!G.save.wyvern);
  Wyv.mine = () => G.wyverns.find((m) => m.owner === myId()) || null;
  const lv = () => DL.Summons.wyvern();
  const form = () => DL.Summons.form("wyvern");
  // His colour: blood-red until his first road, then storm-blue or fire-orange, whichever road he leans to.
  Wyv.col = function () {
    const p = DL.Summons.path("wyvern"), a = p.filter((v) => v === "A").length, b = p.filter((v) => v === "B").length;
    return !a && !b ? BLOOD : a >= b ? STORM : FIRE;
  };

  /* ---------------- the nest (the same for every visit and every friend in a world of this difficulty) ---------------- */
  let spot = null, spotFor = null;
  Wyv.nestSpot = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const Wd = DL.World, Dif = G.diff(), GR = DL.GROVE, fr = DL.Fred.ringSpot();
    const dry = (x, y) => !Wd.isWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !Wd.isWater(x + Math.cos(i * 0.785) * 120, y + Math.sin(i * 0.785) * 80));
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 600) / GR.cell); gy <= Math.floor((y + 600) / GR.cell); gy++)
        for (let gx = Math.floor((x - 600) / GR.cell); gx <= Math.floor((x + 600) / GR.cell); gx++) {
          const g = Wd.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 480) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 96 && !spot; t++) {
      const a = DL.hash(83, 47, 300 + t) * TAU, r = W.nestDist + (DL.hash(83, 47, 400 + t) - 0.5) * 300;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y) && !DL.Cave.clears(x, y) && Math.hypot(x - fr.x, y - fr.y) > 1600) spot = { x, y };
    }
    spot = spot || { x: -fr.x, y: -fr.y };
    spotFor = G.save.difficulty;
    sticks = null;
    return spot;
  };
  Wyv.clears = (x, y) => { const s = Wyv.nestSpot(); return Math.hypot(x - s.x, y - s.y) < W.clear; };
  Wyv.where = function () { const s = Wyv.nestSpot(); return { dir: compass(s.x, s.y), m: Math.round(Math.hypot(s.x, s.y) / 10) }; };
  // Her nest lies empty for a few days after she's slain.
  let netEmpty = false;
  Wyv.empty = () => (G.isGuest() ? netEmpty : G.save.wyvNest.dead >= 0);

  /* ---------------- the heist (host) ---------------- */
  // heist: { carrier: knight id (0: the host) } while someone has an egg; mom: the mother, once she's in play.
  let heist = null, mom = null, netCarrier = -1;
  Wyv.carrier = () => (G.isGuest() ? netCarrier : heist ? heist.carrier : -1);
  Wyv.carrying = () => Wyv.carrier() === myId();
  const knightOf = (id) => (id === 0 ? (G.state === "play" && !(G.player.downT > 0) ? G.player : null) : G.allies.find((a) => a.id === id && !a.down) || null);
  function tell(id, msg, kind) {
    if (id === 0) say(msg, kind);
    else DL.Net.tell(id, msg, kind);
  }
  const hasOwn = (id) => (id === 0 ? !!G.save.wyvern : G.wyverns.some((m) => m.owner === id));
  // Host: a knight steps into the nest and lifts an egg.
  function take(id) {
    if (heist || Wyv.empty() || hasOwn(id) || G.cave) return false;
    const k = knightOf(id);
    if (!k) return false;
    heist = { carrier: id };
    const a = rand(0, TAU);
    mom = G.makeEnemy("wyvern", k.x + Math.cos(a) * W.arriveR, k.y + Math.sin(a) * W.arriveR, 3,
      { alt: 1, move: { kind: "arrive", t: 0 }, swoopT: W.swoop.first, breathT: W.breath.first, stormT: 2 });
    G.enemies.push(mom);
    tell(id, "You lift a warm, blood-red egg out of the nest. Its mother will hunt you until one of you is dead. Slay her, and it's yours.", "warn");
    const msg = "A shriek splits the sky. The mother wyvern is coming for her egg!";
    say(msg, "danger"); DL.Net.say(msg, "danger");
    sfx("growl");
    G.camera.shake = 6;
    return true;
  }
  Wyv.takeHost = take;
  // The carrier has fallen (or left, or gone underground): she snatches back the egg and flies home with it.
  function retrieve(why) {
    if (!heist) return;
    const id = heist.carrier;
    heist = null;
    if (mom && !mom.removed) {
      mom.removed = true;
      G.enemies = G.enemies.filter((e) => e !== mom);
      for (let i = 0; i < 20; i++) G.puff(mom.x + rand(-30, 30), mom.y - rand(20, 90), "rgba(120,30,30,0.6)", 90, 1, -60);
    }
    mom = null;
    if (why !== "quiet") {
      tell(id, "The mother wyvern snatches back her egg and carries it home to her nest.", "danger");
      const msg = "The mother wyvern takes back her egg and flies home.";
      if (id !== 0) say(msg, "warn");
      for (const a of G.allies) if (a.id !== id) DL.Net.tell(a.id, msg, "warn");
    }
  }
  // The host's own knight fell (src/game.js die()).
  Wyv.fell = function (id) { if (heist && heist.carrier === id) retrieve(); };

  // Who she hunts: whoever carries her egg (anyone else only gets in her way).
  Wyv.prey = function (e, best) {
    const k = heist && knightOf(heist.carrier);
    return k || best;
  };

  // Slain: the egg hatches in its carrier's arms, and every knight near her takes one from the clutch.
  Wyv.slain = function (e) {
    const id = heist ? heist.carrier : -1;
    heist = null; mom = null;
    G.save.wyvNest.dead = G.save.day;
    const hatch = "The mother wyvern crashes down and lies still. The egg in your arms cracks, and out pushes a hatchling, all bone and wet red wings. It shrieks at you once, then climbs onto your shoulder. You call him Gerald.";
    const clutch = "The mother wyvern crashes down and lies still. You take an egg from her clutch, and it hatches in your hands: a hatchling, all bone and wet red wings. You call him Gerald.";
    for (const k of G.knights()) {
      const kid = k === G.player ? 0 : k.id;
      if (hasOwn(kid) || (kid !== id && dist(k.x, k.y, e.x, e.y) > W.winR)) continue;
      if (kid === 0) { G.save.wyvern = 1; say(kid === id ? hatch : clutch, "good"); }
      else DL.Net.sendTo(kid, { t: "wyvWon", m: kid === id ? hatch : clutch });
      spawn(kid, k.x, k.y);
    }
    sfx("milestone");
    G.persist();
  };
  // Guest: the host says your egg hatched.
  Wyv.wonGuest = function (m) {
    const pr = DL.Net.profile();
    pr.wyvern = 1;
    DL.Net.saveProfile(pr);
    sfx("milestone");
    say(m, "good");
  };
  Wyv.dawn = function () {
    const n = G.save.wyvNest;
    if (n.dead >= 0 && G.save.day - n.dead >= W.respawnDays) { n.dead = -1; G.persist(); }
  };

  // Host, each frame: the heist runs on until she or the carrier is dead.
  function heistStep() {
    if (!heist) return;
    if (G.cave || !knightOf(heist.carrier)) return retrieve();
    if (!mom || mom.removed || !G.enemies.includes(mom)) {
      // she left play somehow (a new life): bring her back from the sky
      const k = knightOf(heist.carrier), a = rand(0, TAU);
      mom = G.makeEnemy("wyvern", k.x + Math.cos(a) * W.arriveR, k.y + Math.sin(a) * W.arriveR, 3,
        { alt: 1, move: { kind: "arrive", t: 0 }, swoopT: W.swoop.first, breathT: W.breath.first, stormT: 2 });
      G.enemies.push(mom);
    }
  }

  /* ---------------- the mother (host; called from the Drowned's update in src/game.js) ---------------- */
  function hurt(k, dmg, ang) {
    if (k === G.player) G.hurtPlayer(dmg, ang);
    else DL.Net.hurtAlly(k, dmg, ang);
  }
  // Her timers, and which move she picks next (between her claws).
  Wyv.think = function (e, dt, p, dp) {
    e.swoopT -= dt; e.breathT -= dt; e.stormT -= dt;
    if (!e.phase2 && e.hp < e.maxHp * W.phase2) {
      e.phase2 = true;
      e.stormT = 1;
      const msg = "The mother wyvern screams, and the sky answers with lightning!";
      say(msg, "danger"); DL.Net.say(msg, "danger");
    }
    if (e.move || e.state !== "move" || e.stun > 0) return;
    const S = W.swoop, B = W.breath;
    if (e.phase2 && e.stormT <= 0) {
      e.stormT = W.storm.every;
      e.move = { kind: "roar", t: 0.7 };
      storm(e);
    } else if (e.swoopT <= 0 && dp > S.min && dp < S.max) {
      e.swoopT = S.every * (e.phase2 ? 0.75 : 1);
      const ang = Math.atan2(p.y - e.y, p.x - e.x), len = S.speed * S.dur;
      e.move = { kind: "rise", t: S.windup, ang, hit: [] };
      for (let i = 1; i <= 6; i++) G.telegraphs.push({ x: e.x + Math.cos(ang) * (len * i) / 6, y: e.y + Math.sin(ang) * (len * i) / 6, r: 30, t: 0, delay: S.windup, dmg: 0, wyv: true });
      sfx("growl");
    } else if (e.breathT <= 0 && dp < B.range) {
      e.breathT = B.every * (e.phase2 ? 0.8 : 1);
      e.move = { kind: "rear", t: B.windup, ang: Math.atan2(p.y - e.y, p.x - e.x) };
    }
  };
  // Lightning on every knight near her, and a few more strikes about them.
  function storm(e) {
    const S = W.storm;
    for (const k of G.knights()) {
      if (dist(k.x, k.y, e.x, e.y) > 700) continue;
      G.telegraphs.push({ x: k.x, y: k.y, r: S.r, t: 0, delay: S.delay, dmg: e.dmg * S.dmg, wyv: true, bolt: true });
      for (let i = 0; i < S.extra; i++) {
        const a = rand(0, TAU), r = rand(50, 130);
        G.telegraphs.push({ x: k.x + Math.cos(a) * r, y: k.y + Math.sin(a) * r, r: S.r, t: 0, delay: S.delay + rand(0, 0.5), dmg: e.dmg * S.dmg, wyv: true, bolt: true });
      }
    }
    sfx("toll");
  }
  /* What she's doing instead of walking and clawing: flying in, flying to catch up, rising for a swoop and diving,
     rearing and breathing fire, or roaring up the storm. Returns true while she's busy. */
  Wyv.busy = function (e, dt, p, dp) {
    const m = e.move;
    e.alt = e.alt || 0;
    if (!m) {
      if (dp > W.catchUp) { e.move = { kind: "fly", t: 0 }; return true; }
      e.alt = Math.max(0, e.alt - dt * 3);
      return false;
    }
    m.t -= dt;
    e.state = "move";
    const toward = (spd) => {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * spd * dt; e.y += (dy / d) * spd * dt;
      e.angle = Math.atan2(dy, dx);
      e.moving = true;
    };
    if (m.kind === "arrive" || m.kind === "fly") {
      // on the wing, fast, until she's on top of her prey
      e.alt = Math.min(1, e.alt + dt * 2);
      toward(e.speed * (m.kind === "arrive" ? 3.4 : 3));
      if (dp < 150) {
        if (m.kind === "arrive") { G.text(e.x, e.y - 140, "SHRIEK", "#ff9a7a", 1.2); G.camera.shake = 8; sfx("growl"); }
        e.move = { kind: "land", t: 0.4 };
      }
      return true;
    }
    if (m.kind === "land") {
      e.alt = Math.max(0, e.alt - dt * 2.6);
      e.moving = false;
      if (m.t <= 0) { e.move = null; e.alt = 0; e.cd = Math.max(e.cd, 0.4); }
      return true;
    }
    if (m.kind === "rise") {
      // up into the air, the lane she'll dive down showing on the ground
      e.alt = Math.min(0.7, e.alt + dt * 1.5);
      e.angle = m.ang;
      e.moving = false;
      if (m.t <= 0) { m.kind = "dive"; m.t = W.swoop.dur; sfx("dash"); }
      return true;
    }
    if (m.kind === "dive") {
      const S = W.swoop;
      e.alt = Math.max(0.15, e.alt - dt * 1.2);
      e.x += Math.cos(m.ang) * S.speed * dt; e.y += Math.sin(m.ang) * S.speed * dt;
      e.angle = m.ang;
      e.moving = true;
      for (const k of G.knights()) {
        if (m.hit.includes(k) || k.dashT > 0 || dist(k.x, k.y, e.x, e.y) > 42) continue;
        m.hit.push(k);
        hurt(k, e.dmg * S.dmg, m.ang);
        if (k === G.player) { G.player.kx += Math.cos(m.ang) * S.kb; G.player.ky += Math.sin(m.ang) * S.kb; }
      }
      if (Math.random() < 0.6) G.puff(e.x, e.y, "rgba(120,30,30,0.45)", 40, 0.5);
      if (m.t <= 0) e.move = { kind: "land", t: 0.45 };
      return true;
    }
    if (m.kind === "rear") {
      e.moving = false;
      e.angle = m.ang;
      if (m.t <= 0) { e.move = { kind: "breath", t: W.breath.dur, ang: m.ang, tick: 0 }; sfx("ability"); }
      return true;
    }
    if (m.kind === "breath") {
      const B = W.breath;
      // she sweeps slowly after her prey: run round her, not away down the cone
      const want = Math.atan2(p.y - e.y, p.x - e.x);
      m.ang += Math.max(-0.7 * dt, Math.min(0.7 * dt, angleDiff(m.ang, want)));
      e.angle = m.ang;
      e.moving = false;
      m.tick -= dt;
      if (m.tick <= 0) {
        m.tick = B.tick;
        for (const k of G.knights()) {
          const d = dist(k.x, k.y, e.x, e.y);
          if (d > B.range + 10 || Math.abs(angleDiff(m.ang, Math.atan2(k.y - e.y, k.x - e.x))) > B.arc) continue;
          hurt(k, e.dmg * B.dmg, m.ang);
        }
        for (const t of G.torches) if (dist(t.x, t.y, e.x, e.y) < B.range && Math.abs(angleDiff(m.ang, Math.atan2(t.y - e.y, t.x - e.x))) < B.arc) t.t = Math.max(0, t.t - 4);
      }
      if (m.t <= 0) { e.move = null; e.cd = Math.max(e.cd, 0.6); }
      return true;
    }
    if (m.kind === "roar") {
      e.moving = false;
      if (m.t <= 0) e.move = null;
      return true;
    }
    e.move = null;
    return false;
  };

  /* ---------------- Gerald himself (host only) ---------------- */
  function ownerOf(m) {
    if (m.owner === 0) return G.state === "play" || G.state === "camp" ? G.player : null;
    return G.allies.find((a) => a.id === m.owner) || null;
  }
  function spawn(owner, x, y) {
    const had = G.wyverns.find((m) => m.owner === owner);
    if (had) return had;
    const m = { id: ++G.eid, wyvern: true, owner, x: x - 24, y: y + 6, angle: Math.PI / 2, moving: false, animT: rand(0, 3), state: "move", stT: 0, cd: 1.5 };
    G.wyverns.push(m);
    for (let i = 0; i < 16; i++) G.puff(m.x + rand(-12, 12), m.y - rand(10, 40), "rgba(160,40,40,0.5)", 50, 1, -25);
    return m;
  }
  // A new life (or a reload): your Gerald is back at your side, and every friend's; any egg is back in the nest.
  Wyv.reset = function () {
    const friends = G.wyverns.filter((m) => m.owner !== 0).map((m) => m.owner);
    if (heist && heist.carrier !== 0) tell(heist.carrier, "The mother wyvern took back her egg while the camp slept.", "warn");
    heist = null; mom = null;
    G.wyverns = [];
    Object.assign(Wyv, { boostT: 0, healT: 0 });
    near = 0;
    if (G.isGuest()) return;
    if (G.save.wyvern && G.player) spawn(0, G.player.x, G.player.y);
    for (const a of G.allies) if (friends.includes(a.id)) spawn(a.id, a.x, a.y);
  };
  // Host: a friend who won him (here or in any world) brings him along; one who leaves takes him away (and any egg goes home).
  Wyv.join = function (owner) {
    const a = G.allies.find((o) => o.id === owner);
    if (a) spawn(owner, a.x, a.y);
  };
  Wyv.leave = function (owner) {
    G.wyverns = G.wyverns.filter((m) => m.owner !== owner);
    if (heist && heist.carrier === owner) retrieve("quiet");
  };
  Wyv.forget = function () { netCarrier = -1; netEmpty = false; guestFound = false; };

  // His bolt grows with the Central Flame and his own level (src/summons.js).
  Wyv.dmg = () => Math.round(W.dmg * (1 + W.perFlame * Math.max(0, G.save.up.flame - W.reqFlame)) * lv().mult * 10) / 10;
  const valid = (e) => e && !e.removed && e.rise <= 0 && !e.dormant;
  function target(m, o, L) {
    let best = null, bs = -1e9;
    for (const e of G.enemies) {
      if (!valid(e) || dist(o.x, o.y, e.x, e.y) > W.sight) continue;
      // Searing Bolt goes for the biggest foe; otherwise the nearest
      const s = L.sear ? e.hp + (e.def.boss ? 1e5 : 0) : -dist(m.x, m.y, e.x, e.y);
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  const ALT = [24, 30, 38, 46]; // how high each form flies, in world px
  function bolt(m, e, L) {
    const f = form(), x = m.x, y = m.y - ALT[f] - 6, a = Math.atan2(e.y - 20 * e.def.scale - y, e.x - x), sp = L.sear ? W.boltSpeed * 0.75 : W.boltSpeed;
    G.projectiles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: W.boltLife, dmg: Wyv.dmg() * (L.sear ? W.searMult : 1), hostile: false,
      kind: "wyvBolt", col: L.chain ? STORM : L.sear ? FIRE : BLOOD, r: L.sear ? 8 : 6, homing: true, hit: new Set(), wyv: { chain: L.chain, shock: L.shock, sear: L.sear } });
    sfx(L.chain ? "arrow" : "torch");
  }
  // A bolt lands: a searing one sets its target burning; lightning leaps on to more Drowned and, with Static Shock, stuns.
  Wyv.boltHit = function (e, b) {
    const o = b.wyv, mult = lv().mult;
    if (o.sear) { e.burn = 3; e.burnDps = W.searBurn * mult; }
    if (o.shock && !e.def.boss) e.stun = Math.max(e.stun || 0, W.shock);
    if (!o.chain) return;
    const near = G.enemies.filter((q) => q !== e && valid(q) && dist(q.x, q.y, e.x, e.y) < W.chainR).sort((a, c) => dist(a.x, a.y, e.x, e.y) - dist(c.x, c.y, e.x, e.y)).slice(0, W.chainN);
    let from = e;
    for (const q of near) {
      G.effects.push({ type: "wyvArc", x1: from.x, y1: from.y - 22 * from.def.scale, x2: q.x, y2: q.y - 22 * q.def.scale, t: 0, max: 0.3, seed: rand(0, 100) });
      from = q;
      if (o.shock && !q.def.boss) q.stun = Math.max(q.stun || 0, W.shock);
      G.hitEnemy(q, b.dmg * W.chainDmg, Math.atan2(q.y - e.y, q.x - e.x), 30);
    }
  };

  function step(m, dt) {
    const o = ownerOf(m);
    if (!o) { if (m.owner !== 0) m.gone = true; return; }
    const L = lv(), f = form();
    m.animT += dt;
    m.cd -= dt;
    if (dist(m.x, m.y, o.x, o.y) > 700) {
      Object.assign(m, { x: o.x - 24, y: o.y + 6, state: "move" });
      for (let i = 0; i < 8; i++) G.puff(m.x, m.y - 30, "rgba(160,40,40,0.5)", 40, 0.7);
    }
    const down = o.downT > 0 || o.down;
    if (m.state === "cast") {
      m.stT -= dt;
      if (!m.thrown && m.stT <= CAST - CAST_AT) { m.thrown = true; if (valid(m.tgt)) bolt(m, m.tgt, L); }
      if (m.stT <= 0) m.state = "move";
      else if (valid(m.tgt)) m.angle = Math.atan2(m.tgt.y - m.y, m.tgt.x - m.x);
    } else if (!down && m.cd <= 0) {
      const e = target(m, o, L);
      if (e) {
        Object.assign(m, { state: "cast", stT: CAST, cd: L.cd, tgt: e, thrown: false });
        m.angle = Math.atan2(e.y - m.y, e.x - m.x);
      }
    }
    // he flies at his knight's shoulder, a little behind, over walls and water alike: beside him when the knight
    // faces up or down, behind and a little up the screen when he faces sideways, so the knight is drawn over him.
    // The bigger forms keep further out so they don't hide their knight.
    const a = o.angle || 0, sp = [44, 52, 62, 72][f], sv = Math.abs(Math.sin(a)), ch = Math.abs(Math.cos(a));
    const fx = o.x + Math.cos(a + Math.PI / 2) * sp * sv - Math.cos(a) * sp * ch, fy = o.y + Math.sin(a + Math.PI / 2) * sp * 0.5 * sv - Math.sin(a) * sp * 0.3 - 6 - 8 * ch;
    const d = dist(m.x, m.y, fx, fy);
    m.moving = d > (m.moving ? 4 : 12);
    if (!m.moving) { if (m.state !== "cast") m.angle = a; return; } // hovering, he looks where his knight looks
    const spd = d > 160 ? W.speed * 1.5 : Math.min(W.speed, d * 3.5);
    m.x += ((fx - m.x) / d) * spd * dt;
    m.y += ((fy - m.y) / d) * spd * dt;
    if (m.state !== "cast") m.angle = Math.atan2(fy - m.y, fx - m.x);
  }

  /* ---------------- each device, for its own knight ---------------- */
  let near = 0, guestFound = false;
  function visit() {
    const p = G.player;
    if (!p || G.state !== "play" || G.cave || p.downT > 0) return;
    const s = Wyv.nestSpot(), d = dist(p.x, p.y, s.x, s.y);
    const found = G.isGuest() ? guestFound : G.save.wyvNest.found;
    if (!found && d < 520) {
      if (G.isGuest()) guestFound = true;
      else { G.save.wyvNest.found = true; G.persist(); }
      if (!Wyv.won()) say(Wyv.empty() ? "A great nest of bones and black branches on the rocks. It lies empty and cold." : "A great nest of bones and black branches on the rocks, and in it a clutch of blood-red eggs, still warm. Whatever laid them is out hunting.", "warn");
    }
    if (d > W.warnR + 60) near = 0;
    if (Wyv.won() || Wyv.empty() || Wyv.carrier() >= 0) return;
    if (d < W.warnR && near < 1) { near = 1; say("Take an egg, and its mother will hunt you until one of you is dead.", "warn"); }
    if (d < W.grab && near < 2) {
      near = 2;
      if (G.isGuest()) DL.Net.event({ t: "wyvEgg" });
      else take(0);
    }
  }
  // The Boost button: Tailwind or War Fury, whichever road he took at level 10.
  Wyv.hasBoost = () => !!(Wyv.mine() && lv().boost);
  Wyv.boostName = () => (lv().boost === "A" ? W.roads[1][0].name : W.roads[1][1].name);
  Wyv.boost = function () {
    if (!Wyv.hasBoost()) { if (Wyv.mine()) say("Gerald has no boost yet. Choose his road at level 10.", "warn"); sfx("deny"); return; }
    if (Wyv.boostCd > 0) { say(`${Wyv.boostName()} is ready again in ${Math.ceil(Wyv.boostCd)} s.`, "warn"); sfx("deny"); return; }
    const p = G.player, m = Wyv.mine(), k = lv().boost;
    Wyv.boostT = W.boostFor; Wyv.boostCd = W.boostEvery; Wyv.boostKind = k;
    const col = k === "A" ? STORM : FIRE;
    G.effects.push({ type: "howl", x: p.x, y: p.y - 6, t: 0, max: 0.8, col, r: 90 });
    G.effects.push({ type: "wyvArc", x1: m.x, y1: m.y - 40, x2: p.x, y2: p.y - 30, t: 0, max: 0.4, seed: rand(0, 100), col });
    for (let i = 0; i < 16; i++) G.spark(p.x, p.y - 30, col, 120);
    sfx("ability");
    say(k === "A" ? "Gerald shrieks and the wind is at your back. (Tailwind: 30% faster for 20 s.)" : "Gerald roars fire over you. (War Fury: 25% more damage for 20 s.)", "good");
  };
  Wyv.speedMult = () => (Wyv.boostT > 0 && Wyv.boostKind === "A" ? 1 + W.tailwind : 1);
  Wyv.dmgMult = () => (Wyv.boostT > 0 && Wyv.boostKind === "B" ? 1 + W.fury : 1);
  function local(dt) {
    visit();
    Wyv.boostT = Math.max(0, Wyv.boostT - dt);
    Wyv.boostCd = Math.max(0, Wyv.boostCd - dt);
    Wyv.cauterCd = Math.max(0, Wyv.cauterCd - dt);
    const p = G.player;
    if (!p || G.state !== "play" || p.downT > 0) return;
    const st = G.stats();
    if (Wyv.healT > 0) {
      Wyv.healT -= dt;
      p.hp = Math.min(st.maxHp, p.hp + (st.maxHp * W.cauterHeal * dt) / W.cauterFor);
      if (Math.random() < 0.4) G.spark(p.x + rand(-10, 10), p.y - rand(10, 50), FIRE, 50);
    }
    // Cauterize: once a minute, when you're badly hurt, he burns your wounds shut
    if (Wyv.mine() && lv().cauter && Wyv.cauterCd <= 0 && p.hp > 0 && p.hp < st.maxHp * W.cauterAt) {
      Wyv.cauterCd = W.cauterEvery;
      Wyv.healT = W.cauterFor;
      G.effects.push({ type: "howl", x: p.x, y: p.y - 6, t: 0, max: 0.7, col: FIRE, r: 60 });
      for (let i = 0; i < 20; i++) G.puff(p.x + rand(-12, 12), p.y - rand(0, 50), "rgba(255,140,50,0.5)", 50, 1, -30);
      sfx("torch");
      say("Gerald breathes fire over your wounds and burns them shut. (Cauterize: once a minute.)", "good");
    }
  }

  Wyv.update = function (dt) {
    for (const m of G.wyverns) step(m, dt);
    G.wyverns = G.wyverns.filter((m) => !m.gone);
    heistStep();
    local(dt);
  };

  // Light: his eyes, the mother's, and the eggs glowing in the nest.
  Wyv.lights = function (L) {
    const col = Wyv.col(), f = form();
    for (const m of G.wyverns) L.push({ x: m.x, y: m.y - ALT[f] - 10, r: 34 + f * 6, s: 0.35, col, a: 0.5 });
    for (const e of G.enemies) if (e.def.wyvern) L.push({ x: e.x, y: e.y - 70 - (e.alt || 0) * 90, r: 90, s: 0.3, col: BLOOD, a: 0.55 });
    const p = G.player;
    if (!p || G.cave) return;
    const s = Wyv.nestSpot();
    if (!Wyv.empty() && Math.abs(s.x - p.x) < 1200 && Math.abs(s.y - p.y) < 1200) L.push({ x: s.x, y: s.y - 10, r: 70, s: 0.35, col: BLOOD, a: 0.4 });
    if (Wyv.carrier() >= 0) {
      const k = Wyv.carrier() === myId() ? p : G.allies.find((a) => a.id === Wyv.carrier());
      if (k) L.push({ x: k.x, y: k.y - 30, r: 46, s: 0.35, col: BLOOD, a: 0.5 });
    }
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  const MOVES = ["", "arrive", "fly", "land", "rise", "dive", "rear", "breath", "roar"];
  Wyv.rows = function () {
    const e = G.enemies.find((q) => q.def.wyvern);
    return {
      f: G.wyverns.map((m) => [m.id, m.owner, r1(m.x), r1(m.y), r1(m.angle), m.moving ? 1 : 0, m.state === "cast" ? 1 : 0, r1(m.stT)]),
      c: heist ? heist.carrier : -1,
      m: e ? [e.id, MOVES.indexOf(e.move ? e.move.kind : ""), r1(e.move ? e.move.t : 0), r1(e.move && e.move.ang != null ? e.move.ang : e.angle), r1(e.alt || 0)] : 0,
      s: Wyv.empty() ? 1 : 0,
    };
  };
  Wyv.apply = function (d) {
    if (!d) return;
    const old = new Map(G.wyverns.map((m) => [m.id, m]));
    G.wyverns = (d.f || []).map((r) => {
      const m = old.get(r[0]) || { id: r[0], wyvern: true, x: r[2], y: r[3], animT: rand(0, 3) };
      return Object.assign(m, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], state: r[6] ? "cast" : "move", stT: r[7] });
    });
    netCarrier = d.c == null ? -1 : d.c;
    netEmpty = !!d.s;
    if (d.m) {
      const e = G.enemies.find((q) => q.id === d.m[0]);
      if (e) Object.assign(e, { move: d.m[1] ? { kind: MOVES[d.m[1]], t: d.m[2], ang: d.m[3] } : null, altT: d.m[4] });
    }
  };
  // Guest: glide toward the host's positions, and look after your own knight.
  Wyv.guest = function (dt, k01) {
    for (const m of G.wyverns) {
      if (m.tx == null) continue;
      m.x += (m.tx - m.x) * k01; m.y += (m.ty - m.y) * k01;
      m.animT += dt;
      if (m.state === "cast") m.stT -= dt;
    }
    for (const e of G.enemies) if (e.def.wyvern && e.altT != null) e.alt = (e.alt || 0) + (e.altT - (e.alt || 0)) * k01;
    local(dt);
  };

  // The field guide's line.
  Wyv.guideLine = function () {
    if (Wyv.won()) return `<b>Gerald</b> flies at your shoulder, a wyvern of bone and red wings you stole as an egg.`;
    const w = Wyv.where(), found = G.isGuest() ? guestFound : G.save.wyvNest.found;
    return `A wyvern nests on the rocks of the Drowned Reaches${found ? `, ${w.m} m ${w.dir} of camp` : ""}. Steal one of her eggs and she will hunt you until one of you is dead.`;
  };

  /* ---------------- drawing (a coded stand-in until Robert's drawings are in) ---------------- */
  const PAL = { bone: "#d6c3a0", boneDk: "#8d7457", boneHi: "#efe2c4", wing: "#7a1e1e", wingDk: "#4a1010", wingHi: "#9a2c26",
    blood: "#a3170f", eye: "#ff3a2a", beak: "#e0c48e", hole: "#1a0808", out: "#1a0d08" };
  function poly(c, pts, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function seg(c, pts, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  }
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  // One wing from the shoulder (sx, sy), spread to side s (+1 right, -1 left), flap -1 (down) .. 1 (up).
  function wing(c, sx, sy, s, flap, big, o) {
    const lift = flap * 14, ex = sx + s * 16, ey = sy - 14 - lift, tx = sx + s * (30 + (big ? 4 : 0)), ty = sy - 2 - lift * 0.7;
    const back = [sx + s * 24, sy + 12 - lift * 0.3, sx + s * 14, sy + 10, sx + s * 6, sy + 6];
    poly(c, [sx, sy, ex, ey, tx, ty, ...back], PAL.wing);
    poly(c, [sx, sy, ex, ey, sx + s * 18, sy + 4], PAL.wingHi);
    // the finger bones, and rot holes in the skin
    seg(c, [sx, sy, ex, ey, tx, ty], 1.6, PAL.bone);
    seg(c, [ex, ey, back[0], back[1]], 1, PAL.bone);
    seg(c, [ex, ey, back[2], back[3]], 1, PAL.bone);
    ell(c, sx + s * 15, sy + 2 - lift * 0.4, 1.6, 1.2, PAL.hole);
    if (big) ell(c, sx + s * 22, sy + 4 - lift * 0.5, 1.3, 1, PAL.hole);
    poly(c, [ex - 1, ey, ex + s * 2, ey - 4, ex + 1, ey], PAL.boneHi); // the claw on the wrist
    if (o.drip) for (let i = 0; i < 3; i++) { const x = back[i * 2], y = back[i * 2 + 1]; c.fillStyle = PAL.blood; c.fillRect(x - 0.5, y, 1, 3 + ((i * 5 + o.id) % 4) + Math.sin(o.t * 2 + i) * 1.2); }
  }
  function head(c, x, y, side, back, o) {
    if (back) { ell(c, x, y, 4.5, 4, PAL.bone); for (const s of [-1, 1]) poly(c, [x + s * 2, y - 2, x + s * 6, y - 9, x + s * 4, y - 1], PAL.boneDk); return; }
    if (side) {
      ell(c, x, y, 5, 4, PAL.bone);
      poly(c, [x + 3, y - 2, x + 11, y + 1, x + 8, y + 4, x + 3, y + 3], PAL.beak);      // the hooked beak
      poly(c, [x - 2, y - 3, x - 9, y - 9, x - 3, y - 1], PAL.boneDk);                   // horns sweeping back
      poly(c, [x, y - 4, x - 4, y - 11, x + 1, y - 3], PAL.boneHi);
      ell(c, x + 1, y - 0.5, 1.5, 1.5, PAL.hole); ell(c, x + 1.2, y - 0.5, 0.8, 0.8, PAL.eye);
    } else {
      for (const s of [-1, 1]) { poly(c, [x + s * 2, y - 3, x + s * 7, y - 10, x + s * 4, y - 1], PAL.boneDk); poly(c, [x + s * 1, y - 4, x + s * 3, y - 11, x + s * 3, y - 3], PAL.boneHi); }
      ell(c, x, y, 4.5, 4.5, PAL.bone);
      poly(c, [x - 2.5, y + 2, x, y + 9, x + 2.5, y + 2], PAL.beak);
      for (const s of [-1, 1]) { ell(c, x + s * 2, y - 0.5, 1.4, 1.4, PAL.hole); ell(c, x + s * 2, y - 0.5, 0.8, 0.8, PAL.eye); }
    }
  }
  /* One wyvern, its feet (or where they'd touch the ground) at (x, y). o: { k: size, dir, flip, alt (px up),
     flap phase, anim: "idle"|"fly"|"cast"|"roar", drip (the mature form's dripping wings), t, id } */
  function figure(c, x, y, o) {
    const side = o.dir === "side", back = o.dir === "up", flying = o.alt > 2;
    const flapK = flying || o.anim === "fly" ? Math.sin(o.ph) : o.anim === "roar" ? 0.9 : o.anim === "cast" ? 0.5 : 0.25 + Math.sin(o.t * 1.4 + o.id) * 0.08;
    c.save();
    c.translate(Math.round(x), Math.round(y - o.alt));
    c.scale(o.k, o.k);
    if (side && o.flip) c.scale(-1, 1);
    const big = o.k > 0.9;
    if (side) {
      // the far wing, the tail, the legs, the body, the neck and head, the near wing
      wing(c, 2, -21, -1, flapK * 0.8, big, o);
      seg(c, [-8, -16, -20, -12, -30, -15, -36, -10], 3, PAL.bone);
      for (let i = 0; i < 4; i++) poly(c, [-12 - i * 6, -14 - (i % 2), -14 - i * 6, -19 - (i % 2), -16 - i * 6, -14 - (i % 2)], PAL.boneDk);
      if (!flying) { seg(c, [-3, -13, -5, -6, -3, 0], 2, PAL.boneDk); seg(c, [3, -13, 5, -6, 4, 0], 2, PAL.bone); }
      else { seg(c, [-3, -13, -8, -9], 2, PAL.boneDk); seg(c, [3, -13, -2, -9], 2, PAL.bone); }
      ell(c, 0, -16, 10, 6, PAL.bone);
      for (let i = -2; i <= 2; i++) seg(c, [i * 3, -20, i * 3 + 1, -12], 1, PAL.boneDk); // ribs
      ell(c, 0, -15, 4, 3, PAL.wingDk);
      const lunge = o.anim === "cast" || o.anim === "roar" ? 4 : 0;
      seg(c, [7, -19, 12 + lunge, -27, 14 + lunge, -31], 3, PAL.bone);
      head(c, 16 + lunge, -33 + (o.anim === "roar" ? -3 : 0), true, false, o);
      wing(c, 4, -19, -1, flapK, big, o);
    } else {
      // facing you or away: tail behind (or toward you), both wings spread
      if (!back) seg(c, [0, -12, 10, -9, 16, -14, 14, -20], 3, PAL.boneDk);
      if (back) head(c, 0, -31, false, true, o);
      wing(c, -4, -21, -1, flapK, big, o);
      wing(c, 4, -21, 1, flapK, big, o);
      if (!flying) { seg(c, [-4, -12, -6, -5, -5, 0], 2, PAL.bone); seg(c, [4, -12, 6, -5, 5, 0], 2, PAL.bone); }
      ell(c, 0, -17, 7, 8, PAL.bone);
      for (let i = 0; i < 3; i++) seg(c, [-6, -21 + i * 3.5, 6, -21 + i * 3.5], 1, PAL.boneDk);
      ell(c, 0, -16, 3, 4, PAL.wingDk);
      if (back) seg(c, [0, -10, -5, -2, 3, 4, 8, 2], 3, PAL.bone);
      else { seg(c, [0, -23, 0, -28], 3, PAL.bone); head(c, 0, -31 + (o.anim === "roar" ? -2 : 0), false, false, o); }
    }
    c.restore();
  }
  // World point of its eyes, for the glow over the dark.
  function eyes(x, y, o) {
    const k = o.k, ay = y - o.alt;
    if (o.dir === "up") return [];
    if (o.dir === "side") { const s = o.flip ? -1 : 1, l = o.anim === "cast" || o.anim === "roar" ? 4 : 0; return [[x + s * (17.2 + l) * k, ay - 33.5 * k]]; }
    return [[x - 2 * k, ay - 31.5 * k], [x + 2 * k, ay - 31.5 * k]];
  }
  function shadow(c, x, y, rx, ry, a = 0.3) { c.fillStyle = `rgba(0,0,0,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  const KSIZE = [0.55, 0.78, 1.0, 1.2]; // each form's size on the coded figure
  function geraldOpts(m, t) {
    const f = form(), { dir, flip } = DL.Art.unitDir(m.angle);
    return { k: KSIZE[f], dir, flip, alt: ALT[f] + Math.sin(m.animT * 2.2) * 3, ph: m.animT * 9, anim: m.state === "cast" ? "cast" : "fly", drip: f === 3, t, id: m.id % 7 };
  }
  // Robert's drawing of a form, once it's loaded (wyvern_f0 and so on, src/sprites.js), replaces the coded figure.
  const drawnKey = (f) => { const k = "wyvern_f" + f, sh = DL.Art.sheets[k]; return sh && !sh.down.idle[0].blank && !sh.down.walk[0].blank ? k : null; };
  Wyv.drawn = drawnKey;
  // The drawings hang from the tail tip, which reaches lower than the coded figure's talons.
  const DRAWN_LIFT = 0.7;
  // Where his mouth is on the Hatchling's drawing, from his tail tip (in screen px at res 4), for the glow of his spit.
  // The drawings have their own red eyes, so they get no eye glow.
  const DRAWN_HEAD = { down: [0, -36], up: [0, -40], side: [20, -40] };
  function drawnHead(m, o) {
    const [dx, dy] = DRAWN_HEAD[o.dir];
    return [m.x + dx * (o.flip ? -1 : 1), m.y - o.alt * DRAWN_LIFT + dy];
  }
  function drawGerald(c, m, t) {
    const o = geraldOpts(m, t), key = drawnKey(form());
    shadow(c, m.x, m.y, 10 * o.k, 3.5 * o.k, 0.22);
    if (!key) return figure(c, m.x, m.y, o);
    const cast = m.state === "cast";
    DL.Art.drawUnit(c, key, cast ? "attack" : "walk", cast ? Math.min(2, Math.floor((1 - m.stT / CAST) * 3)) : Math.floor(m.animT * 10), m.angle, m.x, m.y - o.alt * DRAWN_LIFT, 1);
  }
  // The mother: the mature form, twice as big again, landing and rearing and diving.
  const MOM_K = 2.3;
  function momOpts(e, t) {
    const m = e.move, kind = m ? m.kind : "", { dir, flip } = DL.Art.unitDir(e.angle);
    const anim = kind === "rear" || kind === "roar" || kind === "breath" ? "roar" : e.state === "windup" ? "cast" : e.alt > 0.05 ? "fly" : "idle";
    return { k: MOM_K, dir, flip, alt: (e.alt || 0) * 90, ph: e.animT * 7, anim, drip: true, t, id: e.id % 7 };
  }
  Wyv.drawMother = function (c, e, t) {
    const o = momOpts(e, t), m = e.move;
    shadow(c, e.x, e.y, 30 * (1 - (e.alt || 0) * 0.3), 10 * (1 - (e.alt || 0) * 0.3), 0.32 - (e.alt || 0) * 0.12);
    if (e.state === "windup") {
      // her claw coming: a cone of warning on the ground
      const k = 1 - e.stT / e.def.windup;
      c.fillStyle = `rgba(255,90,60,${0.08 + 0.22 * k})`;
      c.beginPath(); c.moveTo(e.x, e.y); c.ellipse(e.x, e.y, e.def.range + 14, (e.def.range + 14) * 0.7, 0, e.aim - 0.95, e.aim + 0.95); c.closePath(); c.fill();
    }
    if (m && m.kind === "rear") {
      // the fire she's about to breathe, marked on the ground
      const B = W.breath, k = 1 - Math.max(0, m.t) / B.windup;
      c.fillStyle = `rgba(255,120,40,${0.1 + 0.2 * k})`;
      c.beginPath(); c.moveTo(e.x, e.y); c.ellipse(e.x, e.y, B.range, B.range * 0.7, 0, m.ang - B.arc, m.ang + B.arc); c.closePath(); c.fill();
    }
    c.save();
    if (e.flash > 0) c.filter = "brightness(2.2)";
    figure(c, e.x, e.y, o);
    c.restore();
    if (e.hp < e.maxHp) {
      const w = e.def.barW, y = e.y - o.alt - e.def.barY;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
      c.fillStyle = "#ff6a50"; c.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 3);
    }
    if (e.burn > 0) DL.Art.drawFire(c, e.x + Math.sin(t * 7) * 6, e.y - o.alt - 20, 0.7, t);
  };

  // The nest: a rough ring of bones and black branches on a shelf of rock, and the clutch in it.
  let sticks = null;
  function nestSticks() {
    if (sticks) return sticks;
    const s = Wyv.nestSpot();
    sticks = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + DL.hash(87, i, 1) * 0.3, r = 0.85 + DL.hash(87, i, 2) * 0.3;
      sticks.push({ x: s.x + Math.cos(a) * 58 * r, y: s.y + Math.sin(a) * 30 * r, a: a + Math.PI / 2 + (DL.hash(87, i, 3) - 0.5), len: 14 + DL.hash(87, i, 4) * 14, bone: DL.hash(87, i, 5) < 0.4, i });
    }
    return sticks;
  }
  function drawStick(c, k) {
    const dx = Math.cos(k.a) * k.len / 2, dy = Math.sin(k.a) * k.len / 4;
    seg(c, [k.x - dx, k.y - 6 - dy, k.x + dx, k.y - 6 + dy], k.bone ? 3 : 2.6, k.bone ? PAL.bone : "#2a1d14");
    if (k.bone) { ell(c, k.x - dx, k.y - 6 - dy, 2.2, 2, PAL.boneHi); ell(c, k.x + dx, k.y - 6 + dy, 2.2, 2, PAL.boneHi); }
  }
  function drawEgg(c, x, y, t, i) {
    ell(c, x, y - 1, 7, 2.5, "rgba(0,0,0,0.35)");
    ell(c, x, y - 9, 6.5, 9, "#6e1414");
    ell(c, x - 2, y - 12, 2.5, 4, "#a8302a");
    for (let j = 0; j < 4; j++) ell(c, x - 3 + ((j * 7 + i * 3) % 7), y - 4 - ((j * 5 + i) % 10), 0.9, 0.9, "#2a0606");
    ell(c, x + 2, y - 7, 1.4, 2, `rgba(255,120,90,${0.25 + 0.15 * Math.sin(t * 2 + i)})`);
  }
  Wyv.push = function (list, c, t, view) {
    const inView = (x, y, m = 120) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m * 1.6;
    for (const m of G.wyverns) list.push({ y: m.y + 8, f: () => drawGerald(c, m, t) }); // he flies: drawn a little over what stands by him
    if (G.cave) return;
    const s = Wyv.nestSpot();
    if (!inView(s.x, s.y, 200)) return;
    list.push({ y: s.y - 40, f: () => {
      ell(c, s.x, s.y - 4, 74, 40, "#2b2622"); ell(c, s.x, s.y - 6, 64, 33, "#3a332c"); ell(c, s.x, s.y - 4, 50, 24, "#1d1611");
      for (const k of nestSticks()) if (k.y < s.y) drawStick(c, k);
    } });
    const eggs = Wyv.empty() ? 0 : Wyv.carrier() >= 0 ? 2 : 3;
    if (eggs) list.push({ y: s.y, f: () => { const at = [[-11, 2], [10, 0], [0, 8]]; for (let i = 0; i < eggs; i++) drawEgg(c, s.x + at[i][0], s.y + at[i][1], t, i); } });
    list.push({ y: s.y + 32, f: () => { for (const k of nestSticks()) if (k.y >= s.y) drawStick(c, k); } });
  };

  // Over the dark: his eyes and his mother's, her fire and her storm, his lightning arcs, the egg's glow.
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,240,220,${a})`); g.addColorStop(0.35, `rgba(${col},${a * 0.7})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function zig(c, x1, y1, x2, y2, seed, col, w) {
    c.strokeStyle = `rgba(${col})`; c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i < 6; i++) {
      const u = i / 6, j = Math.sin(seed * 13.7 + i * 5.1) * 7;
      c.lineTo(x1 + (x2 - x1) * u + j, y1 + (y2 - y1) * u + j * 0.5);
    }
    c.lineTo(x2, y2); c.stroke();
  }
  Wyv.glow = function (c, t, view) {
    const col = Wyv.col();
    for (const m of G.wyverns) {
      const o = geraldOpts(m, t), drawn = drawnKey(form());
      const pts = drawn ? [] : eyes(m.x, m.y, o);
      for (const [x, y] of pts) glow(c, x, y, 5 + o.k * 3, BLOOD, 0.8);
      if (m.state === "cast") { const [x, y] = drawn ? drawnHead(m, o) : pts[0] || [m.x, m.y - o.alt - 30]; glow(c, x, y + 4, 14, col, 0.5); }
    }
    for (const e of G.enemies) {
      if (!e.def.wyvern) continue;
      const o = momOpts(e, t), m = e.move;
      for (const [x, y] of eyes(e.x, e.y, o)) glow(c, x, y, 6, BLOOD, 0.75);
      if (m && m.kind === "breath") {
        // a roaring cone of fire, ragged at the edges
        const B = W.breath, hy = e.y - o.alt - 60;
        for (let i = 0; i < 26; i++) {
          const u = ((t * 2.4 + i / 26) % 1), a = m.ang + Math.sin(i * 7.3 + t * 9) * B.arc * 0.85, r = 20 + u * B.range;
          glow(c, e.x + Math.cos(a) * r, hy + (e.y - hy) * u + Math.sin(a) * r * 0.7, 10 + u * 22, FIRE, 0.55 * (1 - u * 0.6));
        }
      }
      if (m && (m.kind === "rear" || m.kind === "roar")) { const [x, y] = eyes(e.x, e.y, o)[0] || [e.x, e.y - 80]; glow(c, x, y + 8, 22, m.kind === "roar" ? STORM : FIRE, 0.6); }
    }
    // whoever carries an egg glows red with it
    const cid = Wyv.carrier();
    if (cid >= 0) {
      const k = cid === myId() ? G.player : G.allies.find((a) => a.id === cid);
      if (k) glow(c, k.x, k.y - 30, 18 + Math.sin(t * 4) * 3, BLOOD, 0.55);
    }
    if (!G.cave && !Wyv.empty()) {
      const s = Wyv.nestSpot();
      if (s.x > view.left - 100 && s.x < view.right + 100 && s.y > view.top - 100 && s.y < view.bottom + 100) glow(c, s.x, s.y - 8, 34, BLOOD, 0.25 + 0.08 * Math.sin(t * 2));
    }
    // the knight's boost, while it lasts
    const p = G.player;
    if (p && Wyv.boostT > 0) {
      const bc = Wyv.boostKind === "A" ? STORM : FIRE, fade = Math.min(1, Wyv.boostT / 2);
      for (let i = 0; i < 3; i++) {
        const u = (t * 1.6 + i / 3) % 1;
        glow(c, p.x + Math.sin(i * 2.1 + t * 3) * 10, p.y - u * 50, 7, bc, 0.5 * (1 - u) * fade);
      }
    }
    for (const fx of G.effects) {
      if (fx.type === "wyvArc") {
        const k = fx.t / fx.max, cc = fx.col || STORM;
        zig(c, fx.x1, fx.y1, fx.x2, fx.y2, fx.seed + Math.floor(fx.t * 30), `${cc},${0.9 * (1 - k)}`, 3);
        zig(c, fx.x1, fx.y1, fx.x2, fx.y2, fx.seed + Math.floor(fx.t * 30), `255,255,255,${0.8 * (1 - k)}`, 1);
        glow(c, fx.x2, fx.y2, 14, cc, 0.6 * (1 - k));
      } else if (fx.type === "wyvStrike") {
        // a bolt of lightning out of the sky
        const k = fx.t / fx.max;
        zig(c, fx.x + 20, fx.y - 420, fx.x, fx.y, fx.x * 0.1, `${STORM},${1 - k}`, 5);
        zig(c, fx.x + 20, fx.y - 420, fx.x, fx.y, fx.x * 0.1, `255,255,255,${1 - k}`, 2);
        glow(c, fx.x, fx.y, 50, STORM, 0.8 * (1 - k));
      }
    }
  };
  // His bolt: a spit of blood-fire, a crackling spark of lightning, or a fat fireball.
  Wyv.drawBolt = function (c, b) {
    const a = Math.atan2(b.vy, b.vx), ux = Math.cos(a), uy = Math.sin(a), col = b.col || BLOOD, storm = col === STORM;
    if (storm) {
      zig(c, b.x - ux * 22, b.y - uy * 22, b.x, b.y, b.x * 0.3 + b.y, `${col},0.9`, 2);
    } else for (let i = 1; i <= 5; i++) {
      c.fillStyle = `rgba(${col},${0.45 * (1 - i / 6)})`;
      c.beginPath(); c.arc(b.x - ux * i * 4, b.y - uy * i * 4, (b.r || 6) * 0.6 - i * 0.4, 0, TAU); c.fill();
    }
    glow(c, b.x, b.y, (b.r || 6) + 5, col, 0.9);
  };
  // The Kit tab's portrait: his current form, perched (the hatchling, as a dark shape, before he's won).
  Wyv.portrait = function (g, cv, t) {
    const f = Wyv.won() ? form() : 0, k = [1.2, 1.05, 0.9, 0.8][f], key = drawnKey(f);
    if (key) {
      g.save(); g.translate(cv.width / 2, cv.height - 2); g.scale(0.82, 0.82); g.imageSmoothingEnabled = false;
      DL.Art.drawUnit(g, key, "idle", 0, 0, 0, 0, 1);
      return g.restore();
    }
    const o = { k, dir: "side", flip: false, alt: 0, ph: t * 6, anim: "idle", drip: f === 3, t, id: 1 };
    g.save(); g.translate(cv.width / 2 + 8, cv.height - 3);
    figure(g, 0, 0, o);
    g.globalCompositeOperation = "lighter";
    for (const [x, y] of eyes(0, 0, o)) glow(g, x, y, 4, BLOOD, 0.8);
    g.restore();
  };
})(window.DL);
