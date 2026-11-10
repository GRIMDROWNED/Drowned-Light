/* Drowned Light — the Molten Mines' mini bosses (Level 3 step 4; plan "Level 3 plan: The Molten Mines", Mini bosses).
   Each waits in its big room; a knight stepping in wakes it and the room shuts (fire curtains, src/mines.js) until it
   falls. They fight through the bullet system (src/bullets.js). Numbers: DL.MINE_BOSSES (src/data.js). Host only.

     A. The Magma Golem, the Fused Warden (the Fused Forge), drawn by Robert:
        a slow walker. Slam: fists up (the floor marks round him), down: a blow in the mark and a ring of slag with one
        gap to slip through. Hurl: it tears off a fist and throws it: a shadow, then a molten pool and a burst of
        shards; the fist fuses back. After every third slam its chest core splits open: blows deal double.
     B. The Furnace Hydra (the Furnace Pit), drawn by Robert: rooted in its rock mound, it never moves. Three heads take
        turns: the left breathes a sweeping cone of fire, the middle spins a spiral, the right lobs lava globs that
        leave pools. Its health is the three heads end to end: each third lost cuts a head (and its attack) off. A cut
        head grows back after `regrow` s (a third of the bar back) unless the next is cut first; all three down and
        the body falls.
     D. The Crucible Wyrm (the Deepfire Roost), drawn by Robert: on the ground it stalks you for claw and tail combos
        and beats its wings to throw you back. Then it takes off and strafes the room: each run is marked on the floor
        first and leaves a lane of burning pools. It ends in a dive at you (a marked circle, a slam, a ring of rocks)
        and lands panting: blows deal more then. Out of reach while it flies. */
"use strict";
(function (DL) {
  const G = DL.Game, TAU = Math.PI * 2, { rand, dist } = DL;
  const MB = (DL.MineBosses = {});
  const N = () => DL.MINE_BOSSES;
  const OX = () => DL.MINES.x, OY = () => DL.MINES.y;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound && DL.Sound.play(n);
  const sideOn = (a) => (Math.cos(a) >= 0 ? 0 : Math.PI);
  // which boss waits in which room
  MB.ROOMS = { forge: "golem", pit: "hydra", roost: "wyrm" };
  const WAKE = {
    golem: "Fire curtains roar up. In the forge's heart the stone stirs: the Magma Golem wakes!",
    hydra: "Fire curtains roar up. The pit's mound splits and three heads rise: the Furnace Hydra!",
    wyrm: "Fire curtains roar up. Wings beat in the smoke above: the Crucible Wyrm comes down!",
  };

  let fists = [], pools = [];
  MB.reset = function () { fists = []; pools = []; };
  MB.boss = (room) => G.enemies.find((e) => e.room === room && e.def.boss && e.def.mine && !e.removed);

  /* ---------------- waking ---------------- */
  // each frame (src/mines.js): a knight in a boss room that's still standing wakes its boss, and the room shuts
  MB.update = function (dt, room) {
    const sp = G.spires, p = G.player, n = N();
    if (room && MB.ROOMS[room] && !sp.cleared[room] && !sp.seal && !MB.boss(room)) {
      const type = MB.ROOMS[room], at = n[type].at, x = OX() + at[0], y = OY() + at[1];
      const e = G.makeEnemy(type, x, y, n.zone, { room, act: "wake", t: 1.4, slams: 0, next: 1, cd: 99, hx: x, hy: y, heads: 3, grow: 0 });
      e.angle = Math.atan2(p.y - y, p.x - x);
      G.enemies.push(e);
      sp.seal = room;
      G.camera.shake = 8;
      sfx("torch");
      for (let i = 0; i < 24; i++) G.puff(x + rand(-50, 50), y - rand(0, 160), "rgba(255,130,40,0.75)", 90, 0.9, -30);
      say(WAKE[type], "danger");
    }
    // molten pools burn whoever walks in them
    for (const q of pools) {
      q.t += dt;
      if (p && Math.hypot(p.x - q.x, (p.y - q.y) * 1.6) < q.r && !(p.dashT > 0)) G.hurtPlayer(q.dmg, -Math.PI / 2, "a molten pool");
    }
    pools = pools.filter((q) => q.t < q.life);
    // fists in the air
    for (const f of fists) {
      f.t += dt;
      if (f.t < f.fly) continue; // (a glob thrown a moment after the first starts below 0)
      f.done = true;
      land(f);
    }
    fists = fists.filter((f) => !f.done);
  };
  // a thrown fist or a lava glob comes down: a blow where it lands, a burst of shards, a molten pool
  function land(f) {
    const p = G.player;
    G.camera.shake = Math.max(G.camera.shake || 0, f.glob ? 4 : 9);
    sfx("hit");
    for (let i = 0; i < (f.glob ? 8 : 16); i++) G.puff(f.tx + rand(-30, 30), f.ty - rand(0, 30), "rgba(255,120,40,0.75)", 110, 0.7, -20);
    if (p && Math.hypot(p.x - f.tx, (p.y - f.ty) * 1.3) < f.r && !(p.dashT > 0) && !(p.inv > 0)) G.hurtPlayer(f.dmg, Math.atan2(p.y - f.ty, p.x - f.tx), f.by);
    if (f.shards) DL.Bullets.ring(f.tx, f.ty - 10, f.shards, rand(0, TAU), { by: f.glob ? "a lava spatter" : "a slag shard", dmg: f.bulletDmg, speed: f.speed, kind: f.glob ? 9 : 7 });
    pools.push({ x: f.tx, y: f.ty, r: f.poolR, t: 0, life: f.poolLife, dmg: f.poolDmg });
  }

  /* ---------------- each frame (MineFoes.busy) ---------------- */
  MB.busy = function (e, dt, p, dp) {
    e.moving = false; e.state = "move";
    if (e.def.mine === "golem") golem(e, dt, p, dp);
    else if (e.def.mine === "hydra") hydra(e, dt, p, dp);
    else if (e.def.mine === "wyrm") wyrm(e, dt, p, dp);
    return true;
  };
  function golem(e, dt, p, dp) {
    const n = N().golem, a = Math.atan2(p.y - e.y, p.x - e.x), half = e.hp / e.maxHp < n.half;
    if (e.act) { e.t -= dt; return ({ wake, raise, slam, core, wind, hurl, regrow, after })[e.act](e, dt, p, a); }
    if (dp > n.keep * e.def.size) { // stomping at you
      e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      e.angle = a; e.moving = true; e.anim = null;
      if (Math.random() < dt * 2) G.camera.shake = Math.max(G.camera.shake || 0, 1.5);
    } else { e.angle = a; e.anim = ["idle", 0, a]; }
    e.next -= dt;
    if (e.next > 0) return;
    e.aim = a;
    if (dp < 260 * e.def.size || Math.random() < 0.35) { e.act = "raise"; e.t = n.raise; e.anim = ["raise", 0, sideOn(a)]; sfx("whisper"); }
    else { e.act = "wind"; e.t = n.wind; e.throws = half ? 2 : 1; e.anim = ["windup", 0, sideOn(a)]; }
  }
  const after = (e) => { if (e.t <= 0) { e.act = null; e.anim = null; e.next = e.hp / e.maxHp < N().golem.half ? N().golem.every2 : N().golem.every; } };
  const done = (e, t) => { e.act = "after"; e.t = t; e.anim = null; };
  function wake(e) {
    e.anim = ["core", 0, sideOn(e.angle)];
    if (Math.random() < 0.3) G.puff(e.x + rand(-40, 40), e.y - rand(0, 200), "rgba(255,140,50,0.7)", 70, 0.7, -30);
    if (e.t <= 0) { e.act = null; e.anim = null; e.next = 0.8; }
  }
  function raise(e) {
    if (e.t > 0) return;
    const n = N().golem, p = G.player, R = n.r * e.def.size;
    e.act = "slam"; e.t = n.hit; e.anim = ["slam", 0, sideOn(e.aim)];
    G.camera.shake = 11;
    sfx("hit");
    for (let i = 0; i < 22; i++) G.puff(e.x + rand(-R, R) * 0.8, e.y + rand(-R, R) * 0.4, "rgba(255,130,40,0.8)", 120, 0.7, -20);
    if (Math.hypot(p.x - e.x, (p.y - e.y) * 1.5) < R && !(p.dashT > 0) && !(p.inv > 0)) G.hurtPlayer(e.dmg * n.dmg, Math.atan2(p.y - e.y, p.x - e.x), e.def.name);
    // a ring of slag with one gap, turned somewhere new each time
    const gapAt = rand(0, TAU);
    DL.Bullets.fan(e.x, e.y - 20, gapAt + Math.PI, n.ring, TAU - n.gap, { by: "the Magma Golem's slam", dmg: n.bulletDmg, speed: n.speed, kind: 7 });
    e.slams = (e.slams || 0) + 1;
  }
  function slam(e) {
    if (e.t > 0) return;
    const n = N().golem;
    if (e.slams % n.cores === 0) { // its chest splits open
      e.act = "core"; e.t = n.core; e.anim = ["core", 0, sideOn(e.aim)];
      sfx("shatter");
      say("Its chest splits open: strike the core!", "good");
    } else done(e, 0.3);
  }
  function core(e) {
    if (Math.random() < 0.4) G.spark(e.x + rand(-16, 16), e.y - 110 * e.def.size + rand(-16, 16), "255,220,140", 120);
    if (e.t <= 0) done(e, 0.2);
  }
  function wind(e, dt, p, a) {
    e.aim = a; e.angle = a; e.anim = ["windup", 0, sideOn(a)];
    if (e.t > 0) return;
    const n = N().golem, s = e.def.size, hx = e.x + Math.cos(sideOn(a)) * 40 * s, hy = e.y - 130 * s;
    // aimed a little ahead of where you're going
    const vx = p.spx != null ? (p.x - p.spx) : 0, vy = p.spy != null ? (p.y - p.spy) : 0;
    const tx = p.x + DL.clamp(vx, -12, 12) * n.lead * 60, ty = p.y + DL.clamp(vy, -12, 12) * n.lead * 60;
    fists.push({ x0: hx, y0: hy, gy: e.y, tx, ty, t: 0, fly: n.fly, dmg: e.dmg * n.fistDmg, by: "the Magma Golem's fist", r: n.fistR,
      shards: n.shards, bulletDmg: n.bulletDmg, speed: n.speed, poolR: n.poolR, poolLife: n.poolLife, poolDmg: n.poolDmg, arc: 220 });
    e.act = "hurl"; e.t = 0.45; e.anim = ["hurl", 0, sideOn(a)];
    sfx("whisper");
  }
  function hurl(e) {
    if (e.t > 0) return;
    if (--e.throws > 0) { e.act = "wind"; e.t = N().golem.wind * 0.6; return; } // the other fist
    e.act = "regrow"; e.t = N().golem.regrow; e.anim = ["regrow", 0, sideOn(e.aim)];
  }
  function regrow(e) {
    if (Math.random() < 0.3) G.puff(e.x + Math.cos(sideOn(e.aim)) * 50, e.y - 110 * e.def.size, "rgba(120,90,80,0.7)", 40, 0.5);
    if (e.t <= 0) done(e, 0.2);
  }
  /* ---------------- B. the Furnace Hydra ---------------- */
  // where each head's mouth is, from the mound's foot (world px at size 1): left, middle, right
  const MOUTH = { L: [-70, -120], M: [0, -165], R: [70, -128] };
  const mouth = (e, h) => ({ x: e.x + MOUTH[h][0] * e.def.size, y: e.y + MOUTH[h][1] * e.def.size });
  // heads still up: the left goes first, then the right; the middle is last (as Robert drew it)
  const headsUp = (e) => (e.heads >= 3 ? ["L", "M", "R"] : e.heads === 2 ? ["M", "R"] : e.heads === 1 ? ["M"] : []);
  const STILL = ["idle", "cut1", "cut2", "cut3"];
  function hydra(e, dt, p) {
    const n = N().hydra, seg = e.maxHp / 3;
    e.x = e.hx; e.y = e.hy; e.kx = e.ky = 0; // rooted
    e.angle = Math.PI / 2;
    // a head lost: each third of its health
    const up = Math.max(0, Math.ceil(e.hp / seg - 1e-6));
    if (up < e.heads) {
      e.heads = up; e.grow = n.regrow;
      sfx("shatter"); G.camera.shake = 10;
      const m = mouth(e, up === 2 ? "L" : up === 1 ? "R" : "M");
      for (let i = 0; i < 18; i++) G.puff(m.x + rand(-20, 20), m.y + rand(-20, 20), "rgba(255,120,40,0.85)", 120, 0.8, -20);
      if (up > 0) say(up === 2 ? "A head falls! Cut the next before it grows back." : "Another head! Strike the last before they grow back!", "good");
      if (e.act && e.act !== "wake") { e.act = "after"; e.t = 0.6; }
      e.anim = ["hurt", 0, e.angle]; e.hurtT = 0.4;
    }
    // a cut head grows back unless the next falls first
    if (e.heads > 0 && e.heads < 3 && e.act !== "wake") {
      e.grow -= dt;
      if (e.grow <= 0) {
        e.heads += 1; e.hp = Math.min(e.maxHp, e.hp + seg); e.grow = n.regrow;
        e.act = "regrowing"; e.t = 0.9;
        sfx("whisper");
        say("A head grows back from the stump!", "danger");
      }
    }
    if (e.act) { e.t -= dt; return ({ wake: hWake, regrowing: hAfter, after: hAfter, breathW, breath, spiralW, spiral: hSpiral, lobW, lob })[e.act](e, dt, p); }
    e.hurtT = (e.hurtT || 0) - dt;
    e.anim = e.hurtT > 0 ? ["hurt", 0, e.angle] : e.heads === 3 ? ["idle", Math.floor(G.t * 5) % 4, e.angle] : [STILL[3 - e.heads], 0, e.angle];
    e.next -= dt;
    if (e.next > 0) return;
    // the heads take turns
    const heads = headsUp(e);
    e.turn = ((e.turn || 0) + 1) % heads.length;
    const h = heads[e.turn];
    e.aim = Math.atan2(p.y - mouth(e, h).y, p.x - mouth(e, h).x);
    if (h === "L") { e.act = "breathW"; e.t = n.breath.wind; e.sweep = Math.random() < 0.5 ? -1 : 1; }
    else if (h === "M") { e.act = "spiralW"; e.t = n.spiral.wind; }
    else { e.act = "lobW"; e.t = n.lob.wind; }
    sfx("whisper");
  }
  // its own still while doing something its drawn poses don't show (fewer heads than the attack poses)
  const pose = (e, full) => [e.heads === 3 ? full : STILL[3 - e.heads], 0, e.angle];
  function hWake(e) {
    e.anim = ["roar", 0, e.angle];
    if (Math.random() < 0.4) G.puff(e.x + rand(-80, 80), e.y - rand(0, 160), "rgba(255,140,50,0.7)", 70, 0.7, -30);
    if (e.t <= 0) { e.act = null; e.next = 0.6; }
  }
  function hAfter(e) {
    if (e.act === "regrowing") e.anim = [e.heads === 3 ? "regrow" : STILL[3 - e.heads], 0, e.angle];
    if (e.t <= 0) { e.act = null; e.next = N().hydra.every * (e.heads === 3 ? 1 : 0.8); }
  }
  // left head: a cone of fire that sweeps across where you stood
  function breathW(e, dt, p) {
    e.anim = pose(e, "still");
    if (e.t > 0) return;
    e.act = "breath"; e.t = N().hydra.breath.time; e.emit = 0;
    e.aim -= e.sweep * N().hydra.breath.sweep / 2;
  }
  function breath(e, dt) {
    const b = N().hydra.breath, m = mouth(e, "L");
    e.anim = pose(e, "breath");
    e.aim += (e.sweep * b.sweep * dt) / b.time;
    e.emit -= dt;
    if (e.emit <= 0) {
      e.emit = b.rate;
      DL.Bullets.fan(m.x, m.y, e.aim + rand(-0.06, 0.06), b.n, b.spread, { by: "the Furnace Hydra's breath", dmg: N().hydra.bulletDmg, speed: b.speed, kind: 9, life: b.life });
    }
    if (e.t <= 0) { e.act = "after"; e.t = 0.4; }
  }
  // middle head: spins up, then a spiral of fireballs
  function spiralW(e) {
    e.anim = pose(e, "spiral");
    if (e.t > 0) return;
    const s = N().hydra.spiral, m = mouth(e, "M");
    DL.Bullets.spiral(m.x, m.y + 60 * e.def.size, s.arms + (3 - e.heads), s.rate, (Math.random() < 0.5 ? -1 : 1) * s.spin, s.time,
      { by: "the Furnace Hydra's spiral", dmg: N().hydra.bulletDmg, speed: s.speed, kind: 4 }, e);
    e.act = "spiral"; e.t = s.time;
  }
  function hSpiral(e) {
    e.anim = pose(e, "spiral");
    if (e.t <= 0) { e.act = "after"; e.t = 0.3; }
  }
  // right head: lava globs lobbed round you, each a pool where it lands
  function lobW(e, dt, p) {
    e.anim = pose(e, "lob");
    if (e.t > 0) return;
    const l = N().hydra.lob, n = N().hydra, m = mouth(e, "R"), count = l.n + (e.heads < 3 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = i === 0 ? 0 : rand(l.spread * 0.4, l.spread);
      fists.push({ x0: m.x, y0: m.y, gy: e.y, tx: p.x + Math.cos(a) * r, ty: p.y + Math.sin(a) * r * 0.7, t: -i * 0.15, fly: l.fly, glob: true,
        dmg: e.dmg * l.dmg, by: "a lava glob", r: l.r, shards: l.shards, bulletDmg: n.bulletDmg, speed: l.speed, poolR: n.poolR, poolLife: n.poolLife, poolDmg: n.poolDmg, arc: 160 });
    }
    sfx("whisper");
    e.act = "lob"; e.t = 0.5;
  }
  function lob(e) {
    e.anim = pose(e, "lob");
    if (e.t <= 0) { e.act = "after"; e.t = 0.3; }
  }

  /* ---------------- D. the Crucible Wyrm ---------------- */
  const face = (e, a) => { e.angle = a; return sideOn(a); };
  const roostBox = (m) => { const f = DL.Mines.FLOORS.roost; return [OX() + f[0] + m, OY() + f[1] + m, OX() + f[2] - m, OY() + f[3] - m]; };
  // where a line through (x, y) along angle a leaves the room, both ways
  function across(x, y, a) {
    const [x0, y0, x1, y1] = roostBox(110);
    [x, y] = [DL.clamp(x, x0, x1), DL.clamp(y, y0, y1)];
    const reach = (dx, dy) => Math.min(dx > 0 ? (x1 - x) / dx : dx < 0 ? (x0 - x) / dx : 1e9, dy > 0 ? (y1 - y) / dy : dy < 0 ? (y0 - y) / dy : 1e9);
    const dx = Math.cos(a), dy = Math.sin(a), tf = reach(dx, dy), tb = reach(-dx, -dy);
    return [x - dx * tb, y - dy * tb, x + dx * tf, y + dy * tf];
  }
  const inRoost = (x, y) => { const [x0, y0, x1, y1] = roostBox(110); return [DL.clamp(x, x0, x1), DL.clamp(y, y0, y1)]; };
  function wyrm(e, dt, p, dp) {
    const n = N().wyrm, s = e.def.size, a = Math.atan2(p.y - e.y, p.x - e.x), half = e.hp / e.maxHp < 0.5;
    if (e.act) { e.t -= dt; return ({ wake: wDescend, claw, tail, beat, rise, toA, lane, run, dive, slamDown, pant, after: wAfter })[e.act](e, dt, p, a); }
    e.lift = 0;
    e.ground = (e.ground || 0) + dt;
    if (e.ground > n.ground * (half ? 0.75 : 1)) { e.ground = 0; e.act = "rise"; e.t = n.rise; e.runs = half ? n.runs + 1 : n.runs; sfx("whisper"); return; }
    if (dp > n.reach * s) { // stalking you
      e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      e.angle = a; e.moving = true; e.anim = null;
      e.close = 0;
    } else {
      e.angle = a; e.anim = ["idle", 0, sideOn(a)];
      e.close = (e.close || 0) + dt;
      e.next -= dt;
      if (e.next > 0) return;
      e.aim = a;
      if (e.close > n.crowd) { e.act = "beat"; e.t = n.beat; e.close = 0; }
      else { e.act = "claw"; e.t = n.claw; }
    }
  }
  function wDescend(e) { // it comes down into the roost
    e.lift = Math.max(0, 260 * (e.t / 1.4));
    e.anim = [e.t > 0.3 ? "fly" : "land", Math.floor(G.t * 10), face(e, e.angle)];
    if (e.t <= 0) { e.lift = 0; G.camera.shake = 10; e.act = "after"; e.t = 0.6; e.next = 0.5; }
  }
  function strike(e, R, arc, dmg, by) {
    const p = G.player, d = Math.hypot(p.x - e.x, (p.y - e.y) * 1.4), a = Math.atan2(p.y - e.y, p.x - e.x);
    let off = Math.abs(a - e.aim); if (off > Math.PI) off = TAU - off;
    if (d < R && (arc >= Math.PI || off < arc / 2)) G.hurtPlayer(dmg, a, by);
  }
  // claw: a swipe in front, then the tail sweeps all round
  function claw(e) {
    const n = N().wyrm, s = e.def.size;
    e.anim = ["attackA", 0, face(e, e.aim)];
    if (e.t > 0) return;
    strike(e, n.clawR * s, 2.0, e.dmg * n.clawDmg, "the Crucible Wyrm's claws");
    sfx("hit");
    for (let i = 0; i < 8; i++) G.spark(e.x + Math.cos(e.aim) * 80 * s, e.y + Math.sin(e.aim) * 40 * s - 30, "255,170,80", 160);
    e.act = "tail"; e.t = n.tail;
  }
  function tail(e) {
    const n = N().wyrm, s = e.def.size;
    e.anim = ["attackB", 0, face(e, e.aim)];
    if (e.t > 0) return;
    strike(e, n.tailR * s, TAU, e.dmg * n.tailDmg, "the Crucible Wyrm's tail");
    G.camera.shake = Math.max(G.camera.shake || 0, 6);
    DL.Bullets.ring(e.x, e.y - 10, n.tailRocks, rand(0, TAU), { by: "a flung rock", dmg: n.bulletDmg, speed: n.rockSpeed, kind: 7 });
    sfx("hit");
    e.act = "after"; e.t = 0.6;
  }
  // wing beat: a gust that throws knights back
  function beat(e) {
    const n = N().wyrm, p = G.player;
    e.anim = ["fly", e.t > n.beat / 2 ? 0 : 4, face(e, e.aim)];
    if (e.t > 0) return;
    const a = Math.atan2(p.y - e.y, p.x - e.x), d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < n.gustR * e.def.size && !(p.dashT > 0)) { p.kx = Math.cos(a) * n.gust; p.ky = Math.sin(a) * n.gust; }
    for (let i = 0; i < 20; i++) { const b = rand(0, TAU); G.puff(e.x + Math.cos(b) * 60, e.y + Math.sin(b) * 30, "rgba(200,170,150,0.6)", 160, 0.6, 0); }
    G.camera.shake = Math.max(G.camera.shake || 0, 5);
    sfx("whisper");
    e.act = "after"; e.t = 0.4;
  }
  // into the air
  function rise(e) {
    const n = N().wyrm;
    e.lift = n.alt * (1 - Math.max(0, e.t) / n.rise);
    e.anim = ["fly", Math.floor(G.t * 10), face(e, e.angle)];
    if (e.t <= 0) nextRun(e);
  }
  function nextRun(e) {
    const p = G.player, n = N().wyrm;
    if (e.runs-- <= 0) { e.act = "dive"; e.t = n.diveAim; return; }
    const [ax, ay, bx, by] = across(p.x, p.y, rand(0, TAU));
    // start from the nearer end
    const near = Math.hypot(ax - e.x, ay - e.y) < Math.hypot(bx - e.x, by - e.y);
    e.ax = near ? ax : bx; e.ay = near ? ay : by; e.bx = near ? bx : ax; e.by = near ? by : ay;
    e.act = "toA"; e.t = 3;
  }
  // flying round to the start of a run
  function toA(e, dt) {
    const n = N().wyrm, d = Math.hypot(e.ax - e.x, e.ay - e.y), a = Math.atan2(e.ay - e.y, e.ax - e.x), st = n.fly * dt;
    e.lift = n.alt;
    e.anim = ["fly", Math.floor(G.t * 10), face(e, a)];
    if (d > st && e.t > 0) { e.x += Math.cos(a) * st; e.y += Math.sin(a) * st; return; }
    e.x = e.ax; e.y = e.ay;
    e.act = "lane"; e.t = n.mark;
  }
  // the run is marked on the floor, then it goes
  function lane(e) {
    e.anim = ["fly", Math.floor(G.t * 10), face(e, Math.atan2(e.by - e.y, e.bx - e.x))];
    if (e.t > 0) return;
    e.act = "run"; e.t = 4; e.drop = 0;
    sfx("torch");
  }
  function run(e, dt) {
    const n = N().wyrm, d = Math.hypot(e.bx - e.x, e.by - e.y), a = Math.atan2(e.by - e.y, e.bx - e.x), st = n.dash * dt, p = G.player;
    e.anim = ["fly", Math.floor(G.t * 14), face(e, a)];
    const mv = Math.min(d, st);
    e.x += Math.cos(a) * mv; e.y += Math.sin(a) * mv;
    e.drop += mv;
    while (e.drop >= n.laneStep) {
      e.drop -= n.laneStep;
      pools.push({ x: e.x + rand(-6, 6), y: e.y + rand(-4, 4), r: n.laneR, t: 0, life: n.laneLife, dmg: n.laneDmg });
    }
    // it rakes whoever it passes over
    if (Math.hypot(p.x - e.x, (p.y - e.y) * 1.4) < 60 * e.def.size && !(p.dashT > 0)) G.hurtPlayer(e.dmg * n.runDmg, a, "the Crucible Wyrm's strafing run");
    if (d <= st || e.t <= 0) nextRun(e);
  }
  // the dive: a circle follows you, then it locks and it comes down there
  function dive(e, dt, p) {
    const n = N().wyrm;
    e.lift = n.alt;
    e.anim = ["fly", Math.floor(G.t * 10), face(e, Math.atan2(p.y - e.y, p.x - e.x))];
    if (e.t > n.diveLock) { [e.tx, e.ty] = inRoost(p.x, p.y); }
    if (e.t > 0) return;
    e.act = "slamDown"; e.t = n.diveFly; e.fx = e.x; e.fy = e.y;
    sfx("whisper");
  }
  function slamDown(e) {
    const n = N().wyrm, k = 1 - Math.max(0, e.t) / n.diveFly;
    e.x = e.fx + (e.tx - e.fx) * k; e.y = e.fy + (e.ty - e.fy) * k; e.lift = n.alt * (1 - k);
    e.anim = ["dive", 0, face(e, Math.atan2(e.ty - e.fy, e.tx - e.fx))];
    if (e.t > 0) return;
    e.lift = 0; e.aim = e.angle;
    strike(e, n.slamR * e.def.size, TAU, e.dmg * n.slamDmg, "the Crucible Wyrm's dive");
    DL.Bullets.ring(e.x, e.y - 10, n.slamRocks, rand(0, TAU), { by: "a flung rock", dmg: n.bulletDmg, speed: n.rockSpeed, kind: 7 });
    G.camera.shake = 13;
    sfx("hit");
    for (let i = 0; i < 24; i++) G.puff(e.x + rand(-90, 90), e.y + rand(-30, 30), "rgba(255,130,40,0.8)", 120, 0.8, -20);
    e.act = "pant"; e.t = n.pant;
    say("The Wyrm lands panting: strike now!", "good");
  }
  function pant(e) {
    e.anim = [e.t > N().wyrm.pant - 0.4 ? "land" : "attackC", 0, sideOn(e.angle)];
    if (Math.random() < 0.15) G.puff(e.x + Math.cos(e.angle) * 80, e.y - 30, "rgba(90,80,80,0.6)", 40, 0.8, -20);
    if (e.t <= 0) { e.act = "after"; e.t = 0.3; e.next = 0.6; }
  }
  function wAfter(e) { if (e.t <= 0) { e.act = null; e.anim = null; e.next = N().wyrm.every; } }
  const flying = (e) => e.def.mine === "wyrm" && (e.lift || 0) > 30;

  // what a blow does to it: double while the golem's core is open, more while the wyrm pants; nothing while a boss
  // wakes or the wyrm is in the air
  MB.soak = (e, d) => (e.act === "wake" || flying(e) ? 0 : e.act === "core" ? d * N().golem.coreDmg : e.act === "pant" ? d * N().wyrm.pantDmg : d);
  MB.slain = function (e) {
    DL.Bullets.clear();
    fists = [];
    G.camera.shake = 14;
    for (let i = 0; i < 40; i++) G.puff(e.x + rand(-60, 60), e.y - rand(0, 220), "rgba(255,130,40,0.85)", 120, 1.4, -30);
    sfx("milestone");
  };

  /* ---------------- drawing ---------------- */
  const IMG = (n) => DL.Mines.IMG && DL.Mines.IMG[n];
  const vis = (view, x, y, m) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m;
  // on the floor: molten pools, the slam's mark, where a fist will land
  MB.drawFloor = function (c, view, t) {
    const n = N().golem;
    for (const q of pools) {
      if (!vis(view, q.x, q.y, 120)) continue;
      const a = Math.min(1, q.t * 4, (q.life - q.t) / 0.8), im = IMG("golem-pool");
      c.globalAlpha = Math.max(0, a);
      if (im) { const w = q.r * 2.4, h = (w * im.height) / im.width; c.drawImage(im, q.x - w / 2, q.y - h / 2, w, h); }
      else { c.fillStyle = "rgba(255,110,30,0.8)"; c.beginPath(); c.ellipse(q.x, q.y, q.r, q.r * 0.55, 0, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    for (const f of fists) {
      const k = Math.max(0, Math.min(1, f.t / f.fly));
      c.fillStyle = `rgba(0,0,0,${0.2 + 0.4 * k})`; c.beginPath(); c.ellipse(f.tx, f.ty, 20 + 40 * k, (20 + 40 * k) * 0.5, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(255,140,40,${0.4 + 0.5 * k})`; c.lineWidth = 2; c.beginPath(); c.ellipse(f.tx, f.ty, f.r, f.r * 0.55, 0, 0, TAU); c.stroke();
    }
    for (const e of G.enemies) {
      if (e.def.mine !== "golem" || e.removed || e.act !== "raise" || !vis(view, e.x, e.y, 200)) continue;
      const R = n.r * e.def.size, k = 1 - Math.max(0, e.t) / n.raise;
      c.strokeStyle = `rgba(255,150,50,${0.35 + 0.5 * k})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(e.x, e.y, R, R / 1.5, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,110,30,${0.1 + 0.25 * k})`;
      c.beginPath(); c.ellipse(e.x, e.y, R * k, (R / 1.5) * k, 0, 0, TAU); c.fill();
    }
    // the Crucible Wyrm: its shadow while it flies, the run about to come, the dive's circle
    for (const e of G.enemies) {
      if (e.def.mine !== "wyrm" || e.removed) continue;
      const n = N().wyrm, s = e.def.size;
      if (e.lift > 0 && vis(view, e.x, e.y, 200)) {
        const k = 1 - Math.min(1, e.lift / n.alt) * 0.5;
        c.fillStyle = `rgba(0,0,0,${0.35 * k})`; c.beginPath(); c.ellipse(e.x, e.y, 90 * s * k, 30 * s * k, 0, 0, TAU); c.fill();
      }
      if (e.act === "lane" || e.act === "run") {
        const k = e.act === "lane" ? 1 - Math.max(0, e.t) / n.mark : 1, a = Math.atan2(e.by - e.ay, e.bx - e.ax), w = 34 * s;
        c.save(); c.translate(e.ax, e.ay); c.rotate(a);
        c.fillStyle = `rgba(255,110,30,${e.act === "lane" ? 0.12 + 0.2 * k : 0.08})`;
        c.fillRect(0, -w, Math.hypot(e.bx - e.ax, e.by - e.ay), w * 2);
        c.restore();
      }
      if ((e.act === "dive" || e.act === "slamDown") && e.tx != null) {
        const k = e.act === "dive" ? 1 - Math.max(0, e.t) / n.diveAim : 1, R = n.slamR * s;
        c.strokeStyle = `rgba(255,150,50,${0.4 + 0.5 * k})`; c.lineWidth = 3;
        c.beginPath(); c.ellipse(e.tx, e.ty, R, R / 1.4, 0, 0, TAU); c.stroke();
        c.fillStyle = `rgba(255,110,30,${0.08 + 0.2 * k})`; c.fill();
      }
    }
    // the Furnace Hydra's breath, about to come: a cone on the floor where it will sweep
    for (const e of G.enemies) {
      if (e.def.mine !== "hydra" || e.removed || e.act !== "breathW" || !vis(view, e.x, e.y, 500)) continue;
      const b = N().hydra.breath, k = 1 - Math.max(0, e.t) / b.wind, m = mouth(e, "L"), gy = e.y - 10, L = b.speed * b.life;
      const a0 = e.aim - b.sweep / 2 - b.spread / 2, a1 = e.aim + b.sweep / 2 + b.spread / 2;
      c.fillStyle = `rgba(255,120,30,${0.08 + 0.2 * k})`;
      c.beginPath(); c.moveTo(m.x, gy);
      c.arc(m.x, gy, L, Math.min(a0, a1), Math.max(a0, a1)); c.closePath(); c.fill();
    }
  };
  // standing: fists flying in an arc (y-sorted by where they'll land)
  MB.push = function (list, c, t, view) {
    for (const f of fists) {
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / f.fly), x = f.x0 + (f.tx - f.x0) * k, gy = f.gy + (f.ty - f.gy) * k;
      const y = f.y0 + (f.ty - f.y0) * k - Math.sin(Math.PI * k) * f.arc;
      if (!vis(view, x, y, 120)) continue;
      list.push({ y: gy, f: () => {
        const im = IMG(f.glob ? "bullet-0" : "golem-fist");
        if (!im) { c.fillStyle = f.glob ? "#ff8a2a" : "#4a3028"; c.beginPath(); c.arc(x, y, f.glob ? 12 : 18, 0, TAU); c.fill(); return; }
        const w = f.glob ? 34 : 66, h = (w * im.height) / im.width, flip = f.tx < f.x0;
        c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.rotate(Math.sin(t * 9) * 0.15); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
      } });
    }
  };
  // above the darkness: the open core blazing, a pool's glow
  MB.drawGlow = function (c, t, view) {
    for (const e of G.enemies) {
      if (e.def.mine !== "golem" || e.removed || !vis(view, e.x, e.y, 300)) continue;
      const im = IMG("golem-core"), open = e.act === "core", s = e.def.size;
      if (!im || !(open || e.act === "wake")) continue;
      const w = (open ? 70 + 8 * Math.sin(t * 12) : 40) * s;
      c.globalAlpha = open ? 0.9 : 0.5;
      c.drawImage(im, e.x - w / 2 + Math.cos(e.angle) * 6, e.y - 120 * s - w / 2, w, w);
      c.globalAlpha = 1;
    }
  };
})(window.DL);
