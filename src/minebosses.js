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
        and lands panting: blows deal more then. Out of reach while it flies.
     E. The Seething Seraph (the Molten Choir), drawn by Robert: floats round the room's middle inside a ring of eight
        obsidian shards (real targets, DL.ENEMIES.seraphShard); while any stands it takes no harm, and broken ones grow
        back after a while. Ember spirals, rings of orbs, and Judgement: lines marked on the floor, then a molten
        column runs out along each. The most bullet hell of the five.
     F. The Cinder Colossus (the Bound Bastion), drawn by Robert: a chained fortress, tethered near its post until half
        health, when it tears its chains free and walks faster. Its two shoulder towers (real targets,
        DL.ENEMIES.cinderTower) lob mortars at marked circles; while either stands, blows barely scratch it. Break both
        and the furnace in its chest blazes open for a while (blows deal double), then the towers rise again. Its
        chained fists sweep wide; free, it fires a fist on a jet of flame along a marked line.
     C. The Ashen Sovereign (the Ashen Throne), drawn by Robert: the main boss. He sits on his throne until a knight
        steps into the arena; then he rises and calls Ash Guards and Wretches. Three phases, kneeling (no blow lands)
        at 66% and 33% to call more of his minions (all must fall before the arena opens):
          1  the Halberd: wide marked sweeps (a fan of crescents), and a thrust that cracks the floor into lanes of fire
          2  the Burning Cloak: the arena's braziers spin rings of embers, and lava floods the arena's outer ring for a
             while (marked first), squeezing the fight into the middle
          3  the Molten Crown: he vanishes into pillars of flame and steps out elsewhere in a burst, dense spirals, and
             the Ashen Decree: the whole floor is marked to erupt but for a few safe stones. */
"use strict";
(function (DL) {
  const G = DL.Game, TAU = Math.PI * 2, { rand, dist } = DL;
  const MB = (DL.MineBosses = {});
  const N = () => DL.MINE_BOSSES;
  const OX = () => DL.MINES.x, OY = () => DL.MINES.y;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound && DL.Sound.play(n);
  const sideOn = (a) => (Math.cos(a) >= 0 ? 0 : Math.PI);
  /* Co-op (step 9): the host's device runs the bosses, so every blow is tested against each knight in the run (the
     host's own and its friends'); a friend's goes to their device, at most twice a second (what burns underfoot would
     send one every frame), and their device lets a dash or a moment's grace slip it as for any blow. */
  const party = (MB.party = () => [G.player, ...G.allies.filter((a) => !a.down)].filter(Boolean));
  MB.hurt = hurtK;
  function hurtK(k, dmg, ang, by) {
    if (k === G.player) return G.hurtPlayer(dmg, ang, by);
    if (k.dashT > 0 || G.t < (k.mbT || 0)) return;
    k.mbT = G.t + 0.5;
    DL.Net.hurtAlly(k, dmg, ang, by);
  }
  // which boss waits in which room
  MB.ROOMS = { forge: "golem", pit: "hydra", roost: "wyrm", choir: "seraph", bastion: "cinder", throne: "sovereign" };
  const WAKE = {
    golem: "Fire curtains roar up. In the forge's heart the stone stirs: the Magma Golem wakes!",
    hydra: "Fire curtains roar up. The pit's mound splits and three heads rise: the Furnace Hydra!",
    wyrm: "Fire curtains roar up. Wings beat in the smoke above: the Crucible Wyrm comes down!",
    seraph: "Fire curtains roar up. A choir hums in the heat: the Seething Seraph rises, ringed in obsidian!",
    cinder: "Fire curtains roar up. Chains groan and the bastion stands up: the Cinder Colossus!",
    sovereign: "Fire curtains roar up. On the throne the Ashen Sovereign lifts his head, and rises. \"Kneel.\"",
  };

  let fists = [], pools = [];
  MB.reset = function () { fists = []; pools = []; rockets = []; flood = null; decree = null; };
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
      for (const k of party()) if (Math.hypot(k.x - q.x, (k.y - q.y) * 1.6) < q.r && !(k.dashT > 0)) hurtK(k, q.dmg, -Math.PI / 2, "a molten pool");
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
    MB.updateRockets(dt);
  };
  // a thrown fist or a lava glob comes down: a blow where it lands, a burst of shards, a molten pool
  function land(f) {
    if (!f.r) { for (let i = 0; i < 5; i++) G.puff(f.tx + rand(-14, 14), f.ty - rand(0, 14), "rgba(110,90,80,0.7)", 60, 0.5, -10); return; } // flung debris
    G.camera.shake = Math.max(G.camera.shake || 0, f.glob ? 4 : 9);
    sfx("hit");
    for (let i = 0; i < (f.glob ? 8 : 16); i++) G.puff(f.tx + rand(-30, 30), f.ty - rand(0, 30), "rgba(255,120,40,0.75)", 110, 0.7, -20);
    for (const k of party()) if (Math.hypot(k.x - f.tx, (k.y - f.ty) * 1.3) < f.r && !(k.dashT > 0) && !(k.inv > 0)) hurtK(k, f.dmg, Math.atan2(k.y - f.ty, k.x - f.tx), f.by);
    if (f.shards) DL.Bullets.ring(f.tx, f.ty - 10, f.shards, rand(0, TAU), { by: f.glob ? "a lava spatter" : "a slag shard", dmg: f.bulletDmg, speed: f.speed, kind: f.glob ? 9 : 7 });
    if (f.poolR) pools.push({ x: f.tx, y: f.ty, r: f.poolR, t: 0, life: f.poolLife, dmg: f.poolDmg });
  }

  /* ---------------- each frame (MineFoes.busy) ---------------- */
  MB.busy = function (e, dt, p, dp) {
    e.moving = false; e.state = "move";
    if (e.def.mine === "golem") golem(e, dt, p, dp);
    else if (e.def.mine === "hydra") hydra(e, dt, p, dp);
    else if (e.def.mine === "wyrm") wyrm(e, dt, p, dp);
    else if (e.def.mine === "seraph") seraph(e, dt, p);
    else if (e.def.mine === "shard") shard(e);
    else if (e.def.mine === "cinder") cinder(e, dt, p, dp);
    else if (e.def.mine === "tower") tower(e);
    else if (e.def.mine === "sovereign") sovereign(e, dt, p, dp);
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
    const n = N().golem, R = n.r * e.def.size;
    e.act = "slam"; e.t = n.hit; e.anim = ["slam", 0, sideOn(e.aim)];
    G.camera.shake = 11;
    sfx("hit");
    for (let i = 0; i < 22; i++) G.puff(e.x + rand(-R, R) * 0.8, e.y + rand(-R, R) * 0.4, "rgba(255,130,40,0.8)", 120, 0.7, -20);
    for (const k of party()) if (Math.hypot(k.x - e.x, (k.y - e.y) * 1.5) < R && !(k.dashT > 0) && !(k.inv > 0)) hurtK(k, e.dmg * n.dmg, Math.atan2(k.y - e.y, k.x - e.x), e.def.name);
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
      const [gx, gy2] = inRoom(e.room, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7);
      fists.push({ x0: m.x, y0: m.y, gy: e.y, tx: gx, ty: gy2, t: -i * 0.15, fly: l.fly, glob: true,
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
  // a spot pulled inside a boss's room (so lobbed things land on the floor, not in the mist)
  const inRoom = (room, x, y) => { const f = DL.Mines.FLOORS[room]; return [DL.clamp(x, OX() + f[0] + 40, OX() + f[2] - 40), DL.clamp(y, OY() + f[1] + 40, OY() + f[3] - 40)]; };
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
    for (const k of party()) {
      const d = Math.hypot(k.x - e.x, (k.y - e.y) * 1.4), a = Math.atan2(k.y - e.y, k.x - e.x);
      let off = Math.abs(a - e.aim); if (off > Math.PI) off = TAU - off;
      if (d < R && (arc >= Math.PI || off < arc / 2)) hurtK(k, dmg, a, by);
    }
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
    const ks = party(), p = ks[Math.floor(Math.random() * ks.length)], n = N().wyrm; // each run crosses one of the knights
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
    const n = N().wyrm, d = Math.hypot(e.bx - e.x, e.by - e.y), a = Math.atan2(e.by - e.y, e.bx - e.x), st = n.dash * dt;
    e.anim = ["fly", Math.floor(G.t * 14), face(e, a)];
    const mv = Math.min(d, st);
    e.x += Math.cos(a) * mv; e.y += Math.sin(a) * mv;
    e.drop += mv;
    while (e.drop >= n.laneStep) {
      e.drop -= n.laneStep;
      pools.push({ x: e.x + rand(-6, 6), y: e.y + rand(-4, 4), r: n.laneR, t: 0, life: n.laneLife, dmg: n.laneDmg });
    }
    // it rakes whoever it passes over
    for (const k of party()) if (Math.hypot(k.x - e.x, (k.y - e.y) * 1.4) < 60 * e.def.size && !(k.dashT > 0)) hurtK(k, e.dmg * n.runDmg, a, "the Crucible Wyrm's strafing run");
    if (d <= st || e.t <= 0) nextRun(e);
  }
  // the dive: a circle follows you, then it locks and it comes down there
  function dive(e, dt, p) {
    const n = N().wyrm;
    e.lift = n.alt;
    e.anim = ["fly", Math.floor(G.t * 10), face(e, Math.atan2(p.y - e.y, p.x - e.x))];
    if (e.t > n.diveLock) { [e.wx, e.wy] = inRoost(p.x, p.y); }
    if (e.t > 0) return;
    e.act = "slamDown"; e.t = n.diveFly; e.fx = e.x; e.fy = e.y;
    sfx("whisper");
  }
  function slamDown(e) {
    const n = N().wyrm, k = 1 - Math.max(0, e.t) / n.diveFly;
    e.x = e.fx + (e.wx - e.fx) * k; e.y = e.fy + (e.wy - e.fy) * k; e.lift = n.alt * (1 - k);
    e.anim = ["dive", 0, face(e, Math.atan2(e.wy - e.fy, e.wx - e.fx))];
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

  /* ---------------- E. the Seething Seraph ---------------- */
  const shardsOf = (e) => G.enemies.filter((o) => o.owner === e && !o.removed);
  function grow(e, all) {
    const n = N().seraph, have = new Set(shardsOf(e).map((o) => o.slot));
    for (let i = 0; i < n.shards; i++) {
      if (have.has(i)) continue;
      const o = G.makeEnemy("seraphShard", e.x, e.y, N().zone, { room: e.room, owner: e, slot: i, shardN: 1 + (i % 3), cd: 99 });
      G.enemies.push(o);
      shard(o);
      for (let j = 0; j < 4; j++) G.spark(o.x, o.y - 60, "255,170,80", 90);
    }
    if (!all) say("The obsidian shards grow back round the Seraph!", "danger");
  }
  function shard(o) { // it rides its slot in the ring
    const e = o.owner;
    if (!e || e.removed || e.hp <= 0) { o.removed = true; return; }
    const n = N().seraph, a = e.orb + (o.slot / n.shards) * TAU, R = n.orbitR * e.def.size;
    o.x = e.x + Math.cos(a) * R; o.y = e.y + Math.sin(a) * R * 0.55; o.kx = o.ky = 0;
    o.moving = false; o.state = "move";
  }
  function seraph(e, dt, p) {
    const n = N().seraph, half = e.hp / e.maxHp < 0.5;
    e.orb = (e.orb || 0) + n.orbitSpin * dt;
    e.lift = n.lift + Math.sin(G.t * 2) * 6;
    // drifting round the room's middle
    const tx = e.hx + Math.sin(G.t * 0.35) * 180, ty = e.hy + Math.sin(G.t * 0.23) * 90, d = Math.hypot(tx - e.x, ty - e.y);
    if (d > 4) { e.x += ((tx - e.x) / d) * Math.min(d, e.speed * dt); e.y += ((ty - e.y) / d) * Math.min(d, e.speed * dt); }
    e.kx = e.ky = 0;
    // its broken shards grow back
    const up = shardsOf(e).length;
    if (e.act !== "wake") {
      if (up === 0 && !e.bare) { e.bare = true; say("The obsidian ring is broken: strike the Seraph now!", "good"); sfx("shatter"); }
      if (up < n.shards) { e.regrowT = (e.regrowT == null ? n.regrow : e.regrowT) - dt; if (e.regrowT <= 0) { e.regrowT = null; e.bare = false; e.act = "mend"; e.t = 1; } }
      else e.regrowT = null;
    }
    const front = Math.PI / 2;
    if (e.act) { e.t -= dt; return ({ wake: sWake, mend, spinW, spin, judgeW, judge, ring, after: sAfter })[e.act](e, dt, p); }
    e.anim = ["walk", Math.floor(G.t * 6), front];
    e.next -= dt;
    if (e.next > 0) return;
    const order = ["spiral", "judge", "ring", "judge"];
    e.move = ((e.move == null ? -1 : e.move) + 1) % order.length;
    const m = order[e.move];
    if (m === "spiral") { e.act = "spinW"; e.t = n.spiral.wind; }
    else if (m === "judge") { e.act = "judgeW"; e.t = n.judge.mark; e.beams = half ? 2 : 1; }
    else { e.act = "ring"; e.t = 0.9; e.rings = 2; }
  }
  function sWake(e) {
    e.anim = ["attackB", 0, Math.PI / 2];
    if (Math.random() < 0.4) G.spark(e.x + rand(-60, 60), e.y - rand(40, 220), "255,180,90", 80);
    if (e.t <= 0) { grow(e, true); e.act = null; e.next = 0.8; }
  }
  function mend(e) {
    e.anim = ["attackC", 0, Math.PI / 2];
    if (e.t <= 0) { grow(e, false); e.act = "after"; e.t = 0.3; }
  }
  function spinW(e) {
    e.anim = ["attackA", 0, Math.PI / 2];
    if (e.t > 0) return;
    const s = N().seraph.spiral;
    DL.Bullets.spiral(e.x, e.y - 20, s.arms, s.rate, (Math.random() < 0.5 ? -1 : 1) * s.spin, s.time,
      { by: "the Seething Seraph's embers", dmg: N().seraph.bulletDmg, speed: s.speed, kind: 9 }, e);
    e.act = "spin"; e.t = s.time;
  }
  function spin(e) { e.anim = ["attackA", 0, Math.PI / 2]; if (e.t <= 0) { e.act = "after"; e.t = 0.3; } }
  // Judgement: the lines are marked (they follow you, then lock), then the columns run out along them
  function judgeW(e, dt, p) {
    const j = N().seraph.judge;
    e.anim = ["attackB", 0, Math.PI / 2];
    if (e.t > j.lock) e.jAim = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.t > 0) return;
    e.act = "judge"; e.t = j.len / j.beamSpeed; e.jd = 0; e.jPool = 0;
    sfx("torch");
    G.camera.shake = Math.max(G.camera.shake || 0, 6);
  }
  const beamAngles = (e) => (e.beams > 1 ? [e.jAim - N().seraph.judge.split, e.jAim + N().seraph.judge.split] : [e.jAim]);
  function judge(e, dt, p) {
    const j = N().seraph.judge;
    e.anim = ["attackB", 0, Math.PI / 2];
    e.jd += j.beamSpeed * dt;
    e.jPool += j.beamSpeed * dt;
    const drop = e.jPool >= j.poolStep;
    if (drop) e.jPool -= j.poolStep;
    for (const a of beamAngles(e)) {
      const x = e.x + Math.cos(a) * e.jd, y = e.y + Math.sin(a) * e.jd;
      for (const k of party()) if (Math.hypot(k.x - x, (k.y - y) * 1.3) < j.beamR && !(k.dashT > 0)) hurtK(k, e.dmg * j.beamDmg, a, "the Seething Seraph's Judgement");
      if (drop) pools.push({ x, y, r: j.poolR, t: 0, life: j.poolLife, dmg: j.poolDmg });
      if (Math.random() < 0.6) G.puff(x + rand(-14, 14), y - rand(0, 60), "rgba(255,150,50,0.8)", 90, 0.5, -60);
    }
    if (e.t <= 0) { e.act = "after"; e.t = 0.3; }
  }
  function ring(e) {
    e.anim = ["walk", Math.floor(G.t * 6), Math.PI / 2];
    if (e.t > 0) return;
    const n = N().seraph;
    DL.Bullets.ring(e.x, e.y - 20, n.ringN, e.rings * Math.PI / n.ringN, { by: "the Seething Seraph's orbs", dmg: n.bulletDmg, speed: n.ringSpeed, kind: 4 });
    sfx("whisper");
    if (--e.rings > 0) { e.t = 0.5; return; }
    e.act = "after"; e.t = 0.3;
  }
  function sAfter(e) { if (e.t <= 0) { e.act = null; e.next = N().seraph.every; } }
  // a tower's target at the colossus's feet: a ring of embers (the tower itself is drawn on the colossus)
  MB.drawTower = function (c, e) {
    const k = e.hp / e.maxHp;
    c.strokeStyle = `rgba(255,${120 + 80 * k},60,${0.45 + 0.3 * Math.sin(G.t * 5)})`; c.lineWidth = 2;
    c.beginPath(); c.ellipse(e.x, e.y, 24, 10, 0, 0, TAU); c.stroke();
    if (e.flash > 0) for (let i = 0; i < 2; i++) G.spark(e.x + rand(-20, 20), e.y - 200 * (e.body ? e.body.def.size : 1) * 0.8, "255,170,80", 60);
  };
  // a shard in the ring, lifted to the Seraph's waist; it cracks as it's hurt
  MB.drawShard = function (c, e) {
    const k = e.hp / e.maxHp, im = IMG(k < 0.4 ? "shard-break" : k < 0.75 ? "shard-crack" : "shard-" + (e.shardN || 1)), y = e.y - 80;
    c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(e.x, e.y, 12, 5, 0, 0, TAU); c.fill();
    if (e.flash > 0) c.filter = "brightness(1.8)";
    if (im) { const h = 72, w = (h * im.width) / im.height; c.drawImage(im, e.x - w / 2, y - h / 2 + Math.sin(G.t * 3 + e.slot) * 3, w, h); }
    else { c.fillStyle = "#3a2630"; c.beginPath(); c.moveTo(e.x, y - 22); c.lineTo(e.x + 9, y); c.lineTo(e.x, y + 22); c.lineTo(e.x - 9, y); c.fill(); }
    c.filter = "none";
  };

  /* ---------------- F. the Cinder Colossus ---------------- */
  const towersOf = (e) => G.enemies.filter((o) => o.body === e && !o.removed);
  let rockets = [];
  function raiseTowers(e, first) {
    const have = new Set(towersOf(e).map((o) => o.side));
    for (const side of [-1, 1]) {
      if (have.has(side)) continue;
      const o = G.makeEnemy("cinderTower", e.x, e.y, N().zone, { room: e.room, body: e, side, cd: 99 });
      G.enemies.push(o);
      tower(o);
    }
    if (!first) { say("Its towers rise again from the slag!", "danger"); sfx("torch"); }
  }
  function tower(o) { // rides its shoulder: hit it at the colossus's feet on that side
    const e = o.body;
    if (!e || e.removed || e.hp <= 0) { o.removed = true; return; }
    const n = N().cinder;
    o.x = e.x + o.side * n.towerOff * e.def.size; o.y = e.y + 6; o.kx = o.ky = 0;
    o.moving = false; o.state = "move";
  }
  // the knight's side of the line from the colossus: aim, lines
  function cinder(e, dt, p, dp) {
    const n = N().cinder, s = e.def.size, a = Math.atan2(p.y - e.y, p.x - e.x), up = towersOf(e).length;
    e.kx = e.ky = 0;
    // chained: it can't stray far from its post
    if (!e.free) { const hx = e.x - e.hx, hy = e.y - e.hy, d = Math.hypot(hx, hy); if (d > n.chainR) { e.x = e.hx + (hx / d) * n.chainR; e.y = e.hy + (hy / d) * n.chainR; } }
    // both towers down: the chest furnace opens, then they rise again
    if (e.act !== "wake" && !e.openT && up === 0 && e.towersUp) {
      e.towersUp = false; e.openT = n.open;
      say("Both towers fall: the furnace in its chest blazes open!", "good"); sfx("shatter"); G.camera.shake = 10;
    }
    if (e.openT > 0) { e.openT -= dt; if (e.openT <= 0) { e.openT = 0; raiseTowers(e, false); e.towersUp = true; } }
    if (!e.free && e.hp < e.maxHp * 0.5 && !e.act) { e.act = "tear"; e.t = n.tear; e.anim = ["unchained", 0, Math.PI / 2]; sfx("shatter"); }
    if (e.act) { e.t -= dt; return ({ wake: cWake, tear, mortarW, sweepW, sweep, rocketW, rocketGo, after: cAfter })[e.act](e, dt, p, a); }
    const still = e.openT > 0 ? "noTowers" : up === 1 ? "oneTower" : "idle";
    const sp = e.speed * (e.free ? n.free : 1);
    if (dp > n.keep * s) {
      e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt;
      e.angle = a; e.moving = true; e.anim = up < 2 || e.openT > 0 ? [still, 0, Math.PI / 2] : null;
      if (Math.random() < dt * 2) G.camera.shake = Math.max(G.camera.shake || 0, 2);
    } else { e.angle = a; e.anim = [still, 0, Math.PI / 2]; }
    e.next -= dt;
    if (e.next > 0) return;
    e.aim = a;
    if (e.free && dp > n.sweep.r * s && Math.random() < 0.6) { e.act = "rocketW"; e.t = n.rocket.wind; }
    else if (up > 0 && (dp > n.sweep.r * s || Math.random() < 0.4)) { e.act = "mortarW"; e.t = n.mortar.wind; }
    else { e.act = "sweepW"; e.t = n.sweep.wind; }
  }
  function cWake(e) {
    e.anim = ["attackC", 0, Math.PI / 2];
    if (Math.random() < 0.4) G.puff(e.x + rand(-90, 90), e.y - rand(100, 260), "rgba(255,140,50,0.7)", 70, 0.7, -30);
    if (e.t <= 0) { raiseTowers(e, true); e.towersUp = true; e.act = null; e.next = 0.8; }
  }
  // half health: it tears its chains free and flings the links
  function tear(e) {
    e.anim = ["unchained", 0, Math.PI / 2];
    if (e.t > 0) return;
    e.free = true;
    G.camera.shake = 12;
    say("It tears its chains free! The Colossus walks.", "danger");
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), r = rand(150, 260);
      fists.push({ x0: e.x, y0: e.y - 120, gy: e.y, tx: e.x + Math.cos(a) * r, ty: e.y + Math.sin(a) * r * 0.6, t: -i * 0.1, fly: 0.8, r: 0, arc: 140, im: "colossus-chain", w: 70 });
    }
    e.act = "after"; e.t = 0.4;
  }
  // its towers erupt: mortars at marked circles round you
  function mortarW(e, dt, p) {
    e.anim = ["attackC", 0, Math.PI / 2];
    if (e.t > 0) return;
    const m = N().cinder.mortar, n = N().cinder, s = e.def.size;
    for (const o of towersOf(e)) {
      const tx0 = e.x + o.side * n.towerOff * s, ty0 = e.y - 200 * s;
      for (let i = 0; i < m.n; i++) {
        const a = rand(0, TAU), r = i === 0 ? 0 : rand(m.spread * 0.4, m.spread);
        const [mx, my] = inRoom(e.room, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7);
        fists.push({ x0: tx0, y0: ty0, gy: e.y, tx: mx, ty: my, t: -i * 0.2 - (o.side > 0 ? 0.1 : 0), fly: m.fly,
          dmg: e.dmg * m.dmg, by: "a mortar shell", r: m.r, shards: m.shards, bulletDmg: n.bulletDmg, speed: m.speed, poolR: n.poolR, poolLife: n.poolLife,
          poolDmg: n.poolDmg, arc: 260, im: "colossus-mortar", w: 46 });
      }
    }
    G.camera.shake = Math.max(G.camera.shake || 0, 5);
    sfx("torch");
    e.act = "after"; e.t = 0.6;
  }
  // the chained sweep: a wide arc marked on the floor, then the fist comes round
  function sweepW(e, dt, p, a) {
    e.anim = ["attackA", 0, sideOn(e.aim)];
    if (e.t > N().cinder.sweep.wind * 0.4) e.aim = a;
    if (e.t > 0) return;
    const w = N().cinder.sweep, s = e.def.size;
    e.act = "sweep"; e.t = 0.5;
    strike(e, w.r * s, w.arc, e.dmg * w.dmg, "the Cinder Colossus's chained fist");
    DL.Bullets.fan(e.x, e.y - 20, e.aim, w.rocks, w.arc, { by: "a flung rock", dmg: N().cinder.bulletDmg, speed: w.speed, kind: 7 });
    G.camera.shake = Math.max(G.camera.shake || 0, 9);
    sfx("hit");
  }
  function sweep(e) { e.anim = ["attackB", 0, sideOn(e.aim)]; if (e.t <= 0) { e.act = "after"; e.t = 0.4; } }
  // free: it fires a fist on a jet of flame along a marked line
  function rocketW(e, dt, p, a) {
    e.anim = ["attackA", 0, sideOn(e.aim)];
    if (e.t > N().cinder.rocket.wind * 0.35) e.aim = a;
    if (e.t > 0) return;
    const r = N().cinder.rocket;
    rockets.push({ x: e.x, y: e.y - 10, a: e.aim, d: 0, len: r.len, hit: null, dmg: e.dmg * r.dmg });
    sfx("torch");
    e.act = "rocketGo"; e.t = r.len / r.speed;
  }
  function rocketGo(e) { e.anim = ["attackB", 0, sideOn(e.aim)]; if (e.t <= 0) { e.act = "after"; e.t = 0.5; } }
  function cAfter(e) { if (e.t <= 0) { e.act = null; e.next = N().cinder.every * (e.free ? 0.8 : 1); } }
  MB.updateRockets = function (dt) {
    const r = N().cinder.rocket;
    for (const k of rockets) {
      k.d += r.speed * dt;
      const x = k.x + Math.cos(k.a) * k.d, y = k.y + Math.sin(k.a) * k.d;
      k.hit = k.hit || [];
      for (const q of party()) if (!k.hit.includes(q) && Math.hypot(q.x - x, (q.y - y) * 1.3) < r.r && !(q.dashT > 0)) { k.hit.push(q); hurtK(q, k.dmg, k.a, "the Cinder Colossus's flaming fist"); }
      if (Math.random() < 0.7) G.puff(x - Math.cos(k.a) * 30, y - 40, "rgba(255,140,50,0.75)", 50, 0.5, -20);
    }
    rockets = rockets.filter((k) => k.d < k.len);
  };

  /* ---------------- C. the Ashen Sovereign ---------------- */
  // beaten: his minions crumble, and (once per device) Cinderbrand answers
  function sovSlain(e) {
    for (const o of G.enemies) if (o.room === e.room && o !== e && o.def.mine && !o.removed) { o.hp = 0; o.removed = true; for (let i = 0; i < 6; i++) G.puff(o.x, o.y - rand(0, 40), "rgba(120,100,90,0.7)", 50, 0.8, -20); }
    G.save.sovereign = (G.save.sovereign || 0) + 1;
    DL.Finale.cleared("mines"); // the Portal Hall's next portal wakes (src/finale.js)
    G.persist();
    const fell = "The Ashen Sovereign falls to one knee, and his crown gutters out. The Molten Mines are yours.";
    say(fell, "good");
    if (DL.KITS.cinderbrand.secret && !G.kitOpen("cinderbrand")) {
      G.unlockKit("cinderbrand", true);
      setTimeout(() => say("From the throne's ash a knight lifts a glowing greatsword. Cinderbrand answers you now: choose him when you begin a new game.", "good"), 3500);
    }
  }
  const ARENA = () => { const f = DL.Mines.FLOORS.throne; return { x: OX() + (f[0] + f[2]) / 2, y: OY() + (f[1] + f[3]) / 2, rx: (f[2] - f[0]) / 2, ry: (f[3] - f[1]) / 2 }; };
  const inArena = (x, y, k = 1) => { const A = ARENA(); return ((x - A.x) / (A.rx * k)) ** 2 + ((y - A.y) / (A.ry * k)) ** 2 < 1; };
  let flood = null, decree = null;
  function call(e, types) {
    for (const type of types) {
      let x = e.x, y = e.y + 80;
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU), r = rand(120, 260), tx = e.x + Math.cos(a) * r, ty = e.y + Math.sin(a) * r * 0.7;
        if (inArena(tx, ty, 0.85)) { x = tx; y = ty; break; }
      }
      G.enemies.push(G.makeEnemy(type, x, y, N().zone, { room: e.room, mine: true, cd: rand(0.8, 1.6) }));
      for (let j = 0; j < 10; j++) G.puff(x + rand(-14, 14), y - rand(0, 40), "rgba(255,140,50,0.75)", 70, 0.7, -30);
    }
  }
  const phaseOf = (e) => (e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3);
  const stillPose = (e) => (e.phase === 3 ? "crown" : e.phase === 2 ? "cloak" : "idle");
  function sovereign(e, dt, p, dp) {
    const n = N().sovereign, s = e.def.size, a = Math.atan2(p.y - e.y, p.x - e.x);
    e.kx = e.ky = 0;
    if (e.phase == null) e.phase = 1;
    // a new phase: he kneels and calls
    const ph = phaseOf(e);
    if (e.act !== "wake" && e.act !== "kneel" && ph > e.phase) {
      e.phase = ph; e.act = "kneel"; e.t = n.kneel; e.anim = ["attackC", 0, Math.PI / 2];
      DL.Bullets.clear(); decree = null;
      sfx("whisper"); G.camera.shake = 8;
      say(ph === 2 ? "The Sovereign kneels and calls his guard. His cloak catches fire!" : "He kneels once more, and his crown runs molten!", "danger");
      call(e, n.calls[ph - 1]);
    }
    if (e.phase >= 2) sovPhase2(e, dt, p);
    if (e.phase === 3) sovDecree(e, dt, p);
    if (e.act) { e.t -= dt; return ({ wake: sovWake, kneel: sovKneel, sweepW: sovSweepW, sweep: sovSweep, thrustW: sovThrustW, pillar: sovPillar, stepOut: sovStepOut, spiral: sovSpiral, after: sovAfter })[e.act](e, dt, p, a); }
    if (dp > n.keep * s) {
      e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      e.angle = a; e.moving = true; e.anim = null;
    } else { e.angle = a; e.anim = [stillPose(e), 0, Math.PI / 2]; }
    e.next -= dt;
    if (e.next > 0) return;
    e.aim = a;
    e.moves = (e.moves || 0) + 1;
    if (e.phase === 3 && e.moves % 3 === 0) { e.act = "pillar"; e.t = n.blink.sink; sfx("torch"); return; }
    if (e.phase === 3 && e.moves % 3 === 1) {
      e.act = "spiral"; e.t = n.spiral.time;
      DL.Bullets.spiral(e.x, e.y - 30, n.spiral.arms, n.spiral.rate, (Math.random() < 0.5 ? -1 : 1) * n.spiral.spin, n.spiral.time,
        { by: "the Sovereign's embers", dmg: n.bulletDmg, speed: n.spiral.speed, kind: 9 }, e);
      return;
    }
    if (dp < n.sweep.r * s * 1.1 || Math.random() < 0.35) { e.act = "sweepW"; e.t = n.sweep.wind; }
    else { e.act = "thrustW"; e.t = n.thrust.wind; }
  }
  function sovWake(e) {
    e.anim = [e.t > N().sovereign.wake * 0.5 ? "seated" : "rising", 0, Math.PI / 2];
    if (Math.random() < 0.3) G.puff(e.x + rand(-60, 60), e.y - rand(40, 200), "rgba(255,140,50,0.7)", 70, 0.7, -30);
    if (e.t <= 0) { e.act = null; e.next = 1; call(e, N().sovereign.calls[0]); }
  }
  function sovKneel(e) {
    e.anim = ["attackC", 0, Math.PI / 2];
    if (Math.random() < 0.3) G.puff(e.x + rand(-50, 50), e.y - rand(40, 220), "rgba(255,140,50,0.7)", 70, 0.7, -30);
    if (e.t <= 0) { e.act = "after"; e.t = 0.3; }
  }
  function sovSweepW(e, dt, p, a) {
    e.anim = [stillPose(e), 0, Math.PI / 2];
    if (e.t > N().sovereign.sweep.wind * 0.4) e.aim = a;
    if (e.t > 0) return;
    const w = N().sovereign.sweep, s = e.def.size;
    strike(e, w.r * s, w.arc, e.dmg * w.dmg, "the Ashen Sovereign's halberd");
    DL.Bullets.fan(e.x, e.y - 20, e.aim, w.n + (e.phase - 1) * 2, w.arc, { by: "a fire crescent", dmg: N().sovereign.bulletDmg, speed: w.speed, kind: 5 });
    G.camera.shake = Math.max(G.camera.shake || 0, 7);
    sfx("hit");
    e.act = "sweep"; e.t = 0.45;
  }
  function sovSweep(e) { e.anim = ["attackA", 0, sideOn(e.aim)]; if (e.t <= 0) { e.act = "after"; e.t = 0.35; } }
  // the thrust: the floor cracks into lanes of fire along his aim
  function sovThrustW(e, dt, p, a) {
    const th = N().sovereign.thrust;
    e.anim = ["attackB", 0, Math.PI / 2];
    if (e.t > th.wind * 0.4) e.aim = a;
    if (e.t > 0) return;
    for (const off of e.phase === 1 ? [-th.split, 0, th.split] : [-2 * th.split, -th.split, 0, th.split, 2 * th.split]) {
      DL.Bullets.lane(e.x, e.y, e.aim + off, th.n, th.step, { by: "a crack of fire", dmg: N().sovereign.bulletDmg, speed: th.speed, kind: 6 });
    }
    G.camera.shake = Math.max(G.camera.shake || 0, 9);
    sfx("hit");
    e.act = "after"; e.t = 0.5;
  }
  // phase 3: he sinks into a pillar of flame and steps out somewhere else in a burst
  function sovPillar(e, dt, p) {
    const n = N().sovereign;
    e.anim = ["pillar", 0, Math.PI / 2];
    if (e.t > 0) return;
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), r = rand(n.blink.min, n.blink.max), A = ARENA(), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.7;
      if (inArena(x, y, 0.8)) { e.x = x; e.y = y; break; }
      if (i === 15) { e.x = A.x; e.y = A.y; }
    }
    sfx("torch");
    e.act = "stepOut"; e.t = n.blink.rise;
  }
  function sovStepOut(e) {
    e.anim = [e.t > N().sovereign.blink.rise * 0.5 ? "pillar" : "stepOut", 0, Math.PI / 2];
    if (e.t > 0) return;
    const n = N().sovereign;
    DL.Bullets.ring(e.x, e.y - 30, n.blink.ring, rand(0, TAU), { by: "the Sovereign's flame burst", dmg: n.bulletDmg, speed: n.blink.speed, kind: 4 });
    G.camera.shake = Math.max(G.camera.shake || 0, 6);
    e.act = "after"; e.t = 0.4;
  }
  function sovSpiral(e) { e.anim = ["crown", 0, Math.PI / 2]; if (e.t <= 0) { e.act = "after"; e.t = 0.3; } }
  function sovAfter(e) { if (e.t <= 0) { e.act = null; e.anim = null; e.next = N().sovereign.every * (e.phase === 3 ? 0.75 : e.phase === 2 ? 0.9 : 1); } }
  // phase 2 on: the arena's braziers spin rings of embers; lava floods its outer ring now and then
  function sovPhase2(e, dt, p) {
    const n = N().sovereign;
    e.brazT = (e.brazT == null ? 2 : e.brazT) - dt;
    if (e.brazT <= 0) {
      e.brazT = n.braziers.every;
      for (const b of n.braziers.at) DL.Bullets.spiral(OX() + b[0], OY() + b[1] - 30, n.braziers.arms, n.braziers.rate, n.braziers.spin * (b[0] < 0 ? 1 : -1), n.braziers.time,
        { by: "a brazier's embers", dmg: n.bulletDmg, speed: n.braziers.speed, kind: 9 }, e);
    }
    e.floodT = (e.floodT == null ? 4 : e.floodT) - dt;
    if (e.floodT <= 0 && !flood) { e.floodT = n.flood.every; flood = { t: 0, warn: n.flood.warn, life: n.flood.warn + n.flood.time }; say("Lava wells up round the arena's rim!", "danger"); }
    if (flood) {
      flood.t += dt;
      if (flood.t > flood.life) flood = null;
      else if (flood.t > flood.warn) for (const k of party()) if (inArena(k.x, k.y) && !inArena(k.x, k.y, n.flood.safe) && !(k.dashT > 0)) hurtK(k, n.flood.dmg, -Math.PI / 2, "the flooding lava");
    }
  }
  // phase 3: the Ashen Decree, every so often: the whole floor marked to erupt but for a few safe stones
  function sovDecree(e, dt, p) {
    const n = N().sovereign.decree;
    e.decT = (e.decT == null ? 3 : e.decT) - dt;
    if (e.decT <= 0 && !decree) {
      e.decT = n.every;
      const A = ARENA(), safe = [];
      for (let i = 0; i < 40 && safe.length < n.safe; i++) {
        const x = A.x + rand(-A.rx, A.rx) * 0.7, y = A.y + rand(-A.ry, A.ry) * 0.7;
        if (inArena(x, y, 0.75) && safe.every((q) => Math.hypot(q.x - x, q.y - y) > 220)) safe.push({ x, y });
      }
      decree = { t: 0, safe };
      say("ASHEN DECREE: find a safe stone!", "danger");
      sfx("whisper");
    }
    if (decree) {
      decree.t += dt;
      if (!decree.hit && decree.t > n.warn) {
        decree.hit = true;
        G.camera.shake = 12; sfx("hit");
        for (const k of party()) {
          const ok = decree.safe.some((q) => Math.hypot(k.x - q.x, (k.y - q.y) * 1.3) < n.r);
          if (!ok && inArena(k.x, k.y) && !(k.dashT > 0) && !(k.inv > 0)) hurtK(k, N().sovereign.bulletDmg * n.dmg, -Math.PI / 2, "the Ashen Decree");
        }
        const A = ARENA();
        for (let i = 0; i < 40; i++) { const x = A.x + rand(-A.rx, A.rx) * 0.9, y = A.y + rand(-A.ry, A.ry) * 0.9; if (inArena(x, y) && !decree.safe.some((q) => Math.hypot(x - q.x, y - q.y) < n.r)) G.puff(x, y - rand(0, 40), "rgba(255,140,40,0.85)", 120, 0.7, -60); }
      }
      if (decree.t > n.warn + 0.6) decree = null;
    }
  }
  // asleep on his throne until a knight steps into the arena (drawn among the standing things)
  MB.pushSeated = function (list, c) {
    const sp = G.spires, n = N().sovereign;
    if (!sp || sp.cleared.throne || MB.boss("throne")) return;
    const x = OX() + n.at[0], y = OY() + n.at[1];
    list.push({ y, f: () => DL.Art.drawUnit(c, "sovereign", "seated", 0, Math.PI / 2, x, y + Math.sin(G.t * 1.3) * 0.5, DL.ENEMIES.sovereign.scale * DL.BOSS.size.sovereign, {}) });
  };

  // what a blow does to it: double while the golem's core is open, more while the wyrm pants; nothing while a boss
  // wakes or the wyrm is in the air
  MB.soak = (e, d) => (e.def.mine === "sovereign" ? (e.act === "wake" || e.act === "kneel" || e.act === "pillar" || e.act === "stepOut" ? 0 : d) :
    e.def.mine === "cinder" ? (e.act === "wake" ? 0 : e.openT > 0 ? d * N().cinder.openDmg : towersOf(e).length ? d * N().cinder.guard : d) :
    e.act === "wake" || flying(e) || (e.def.mine === "seraph" && shardsOf(e).length) ? 0 : e.act === "core" ? d * N().golem.coreDmg : e.act === "pant" ? d * N().wyrm.pantDmg : d);
  MB.slain = function (e) {
    for (const o of shardsOf(e)) o.removed = true;
    for (const o of towersOf(e)) o.removed = true;
    rockets = []; flood = null; decree = null;
    if (e.def.mine === "sovereign") sovSlain(e);
    DL.Bullets.clear();
    fists = [];
    G.camera.shake = 14;
    for (let i = 0; i < 40; i++) G.puff(e.x + rand(-60, 60), e.y - rand(0, 220), "rgba(255,130,40,0.85)", 120, 1.4, -30);
    sfx("milestone");
  };

  /* ---------------- co-op: what a friend's device draws ---------------- */
  const r1 = (v) => (v == null ? v : Math.round(v * 10) / 10);
  const r2 = (v) => (v == null ? v : Math.round(v * 100) / 100);
  // Host: a mine foe's move as drawn (merged into its copy on a friend's device): its pose, what it's doing and how
  // long that has left, where it aims, how high it flies, its marks on the floor
  MB.vis = function (e) {
    if (e.def.minion) return { wardT: r1(e.wardT) || 0, room: e.room };
    const o = { room: e.room, anim: e.anim || null, act: e.act || null, t: r2(e.t), aim: r2(e.aim), lift: r1(e.lift) || 0, wardT: r1(e.wardT) || 0 };
    if (e.def.mine === "wyrm") Object.assign(o, { ax: r1(e.ax), ay: r1(e.ay), bx: r1(e.bx), by: r1(e.by), wx: r1(e.wx), wy: r1(e.wy) });
    else if (e.def.mine === "seraph") Object.assign(o, { jAim: r2(e.jAim), jd: r1(e.jd), beams: e.beams });
    else if (e.def.mine === "cinder") Object.assign(o, { free: !!e.free, hx: r1(e.hx), hy: r1(e.hy) });
    else if (e.def.mine === "sovereign") o.phase = e.phase;
    else if (e.def.mine === "shard") Object.assign(o, { shardN: e.shardN, slot: e.slot });
    else if (e.def.mine === "hydra") o.heads = e.heads;
    return o;
  };
  // Host: the fight's loose pieces for each snapshot: fists and globs in the air, molten pools, rockets, the flood, the Decree
  MB.snap = (near) => [
    fists.filter((f) => near(f.tx, f.ty, 1100)).map((f) => [r1(f.x0), r1(f.y0), r1(f.gy), r1(f.tx), r1(f.ty), r2(f.t), f.fly, f.arc, f.r || 0, f.glob ? 1 : 0, f.im || 0, f.w || 0]),
    pools.filter((q) => near(q.x, q.y, 1100)).map((q) => [r1(q.x), r1(q.y), q.r, r1(q.t), q.life]),
    rockets.map((k) => [r1(k.x), r1(k.y), r2(k.a), r1(k.d)]),
    flood ? [r2(flood.t), flood.warn, flood.life] : 0,
    decree ? [r2(decree.t), decree.safe.map((q) => [r1(q.x), r1(q.y)])] : 0,
  ];
  // Guest: the host's pieces, drawn here (the host tests every knight against them)
  MB.apply = function (s) {
    if (!s) { MB.reset(); return; }
    fists = s[0].map((f) => ({ x0: f[0], y0: f[1], gy: f[2], tx: f[3], ty: f[4], t: f[5], fly: f[6], arc: f[7], r: f[8], glob: !!f[9], im: f[10] || null, w: f[11] || 0 }));
    pools = s[1].map((q) => ({ x: q[0], y: q[1], r: q[2], t: q[3], life: q[4] }));
    rockets = s[2].map((k) => ({ x: k[0], y: k[1], a: k[2], d: k[3] }));
    flood = s[3] ? { t: s[3][0], warn: s[3][1], life: s[3][2] } : null;
    decree = s[4] ? { t: s[4][0], safe: s[4][1].map((q) => ({ x: q[0], y: q[1] })) } : null;
  };
  // Guest: between snapshots, the pieces carry on moving
  MB.tick = function (dt) {
    for (const f of fists) f.t += dt;
    for (const q of pools) q.t += dt;
    const sp = N().cinder.rocket.speed;
    for (const k of rockets) k.d += sp * dt;
    if (flood) flood.t += dt;
    if (decree) decree.t += dt;
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
      if (!f.r) continue;
      c.fillStyle = `rgba(0,0,0,${0.2 + 0.4 * k})`; c.beginPath(); c.ellipse(f.tx, f.ty, 20 + 40 * k, (20 + 40 * k) * 0.5, 0, 0, TAU); c.fill();
      if (!DL.Mines.ring(c, f.tx, f.ty, f.r, f.r * 0.55, k)) { c.strokeStyle = `rgba(255,140,40,${0.4 + 0.5 * k})`; c.lineWidth = 2; c.beginPath(); c.ellipse(f.tx, f.ty, f.r, f.r * 0.55, 0, 0, TAU); c.stroke(); }
    }
    for (const e of G.enemies) {
      if (e.def.mine !== "golem" || e.removed || e.act !== "raise" || !vis(view, e.x, e.y, 200)) continue;
      const R = n.r * e.def.size, k = 1 - Math.max(0, e.t) / n.raise;
      if (!DL.Mines.ring(c, e.x, e.y, R, R / 1.5, k)) {
        c.strokeStyle = `rgba(255,150,50,${0.35 + 0.5 * k})`; c.lineWidth = 3;
        c.beginPath(); c.ellipse(e.x, e.y, R, R / 1.5, 0, 0, TAU); c.stroke();
      }
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
      if ((e.act === "dive" || e.act === "slamDown") && e.wx != null) {
        const k = e.act === "dive" ? 1 - Math.max(0, e.t) / n.diveAim : 1, R = n.slamR * s;
        c.beginPath(); c.ellipse(e.wx, e.wy, R, R / 1.4, 0, 0, TAU);
        c.fillStyle = `rgba(255,110,30,${0.08 + 0.2 * k})`; c.fill();
        if (!DL.Mines.ring(c, e.wx, e.wy, R, R / 1.4, k)) { c.strokeStyle = `rgba(255,150,50,${0.4 + 0.5 * k})`; c.lineWidth = 3; c.stroke(); }
      }
    }
    // the Ashen Sovereign: the lava flood's rim, and the Decree's marked floor with its safe stones
    if (flood || decree) {
      const A = ARENA(), n = N().sovereign;
      if (flood) {
        const live = flood.t > flood.warn, k = live ? 1 : flood.t / flood.warn;
        c.save(); c.beginPath(); c.ellipse(A.x, A.y, A.rx, A.ry, 0, 0, TAU); c.ellipse(A.x, A.y, A.rx * n.flood.safe, A.ry * n.flood.safe, 0, 0, TAU, true);
        c.fillStyle = live ? `rgba(255,${90 + 30 * Math.sin(t * 6)},20,0.7)` : `rgba(255,120,30,${0.1 + 0.25 * k})`; c.fill("evenodd"); c.restore();
      }
      if (decree) {
        const d = n.decree, k = Math.min(1, decree.t / d.warn);
        // Robert's tiles: cracking (1), splitting (2), then the burst (3) and its smoke (4) once it goes
        const after = decree.t - d.warn, ti = IMG("decree-" + (after < 0 ? (k < 0.6 ? 1 : 2) : after < 0.3 ? 3 : 4));
        const tw = d.grid, tk = tw / 120, tq = after > 0.3 ? Math.max(0, 1 - (after - 0.3) / 0.3) : 1;
        if (ti) c.globalAlpha = after < 0 ? Math.min(1, 0.35 + k) : tq;
        for (let y = A.y - A.ry; y < A.y + A.ry; y += d.grid) for (let x = A.x - A.rx; x < A.x + A.rx; x += d.grid) {
          if (!inArena(x, y, 0.97) || decree.safe.some((q) => Math.hypot(x - q.x, y - q.y) < d.r) || !vis(view, x, y, 160)) continue;
          if (ti) { c.drawImage(ti, x - tw / 2, y - 85.5 * tk, tw, 137 * tk); continue; }
          c.fillStyle = `rgba(255,120,30,${0.12 + 0.35 * k})`; c.beginPath(); c.ellipse(x, y, d.grid * 0.38, d.grid * 0.22, 0, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
        const si = IMG("decree-safe");
        for (const q of decree.safe) {
          if (si) { const sk = (2 * d.r) / 120; c.drawImage(si, q.x - d.r, q.y - 84 * sk, 2 * d.r, 137 * sk); continue; }
          c.fillStyle = "rgba(40,30,30,0.75)"; c.beginPath(); c.ellipse(q.x, q.y, d.r * 0.8, d.r * 0.45, 0, 0, TAU); c.fill();
          c.strokeStyle = "rgba(160,220,255,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(q.x, q.y, d.r * 0.8, d.r * 0.45, 0, 0, TAU); c.stroke();
        }
      }
    }
    for (const e of G.enemies) {
      if (e.def.mine !== "sovereign" || e.removed || !vis(view, e.x, e.y, 700)) continue;
      const n = N().sovereign, s = e.def.size;
      if (e.act === "sweepW") {
        const w = n.sweep, k = 1 - Math.max(0, e.t) / w.wind, R = w.r * s;
        c.fillStyle = `rgba(255,120,30,${0.1 + 0.25 * k})`;
        c.beginPath(); c.moveTo(e.x, e.y); c.ellipse(e.x, e.y, R, R / 1.4, 0, e.aim - w.arc / 2, e.aim + w.arc / 2); c.closePath(); c.fill();
      }
      if (e.act === "thrustW") {
        const th = n.thrust, k = 1 - Math.max(0, e.t) / th.wind;
        for (const off of e.phase === 1 ? [-th.split, 0, th.split] : [-2 * th.split, -th.split, 0, th.split, 2 * th.split]) {
          c.save(); c.translate(e.x, e.y); c.rotate(e.aim + off);
          c.fillStyle = `rgba(255,120,30,${0.1 + 0.3 * k})`; c.fillRect(0, -10, th.n * th.step + 120, 20); c.restore();
        }
      }
    }
    // the Cinder Colossus: its chains to the bastion walls, the sweep's arc, the fist's line
    for (const e of G.enemies) {
      if (e.def.mine !== "cinder" || e.removed || !vis(view, e.x, e.y, 1000)) continue;
      const n = N().cinder, s = e.def.size;
      if (!e.free) { const ch = IMG("colossus-chain"); for (const side of [-1, 1]) chainLine(c, ch, e.x + side * 60 * s, e.y - 90 * s, e.hx + side * n.anchorX, e.hy + n.anchorY); }
      if (e.act === "sweepW") {
        const w = n.sweep, k = 1 - Math.max(0, e.t) / w.wind, R = w.r * s;
        c.fillStyle = `rgba(255,120,30,${0.1 + 0.25 * k})`;
        c.beginPath(); c.moveTo(e.x, e.y); c.ellipse(e.x, e.y, R, R / 1.4, 0, e.aim - w.arc / 2, e.aim + w.arc / 2); c.closePath(); c.fill();
      }
      if (e.act === "rocketW") {
        const r = n.rocket, k = 1 - Math.max(0, e.t) / r.wind;
        c.save(); c.translate(e.x, e.y - 10); c.rotate(e.aim);
        c.fillStyle = `rgba(255,120,30,${0.15 + 0.3 * k})`; c.fillRect(0, -r.r * 0.7, r.len, r.r * 1.4); c.restore();
      }
    }
    // the Seething Seraph: its shadow, and Judgement's lines
    for (const e of G.enemies) {
      if (e.def.mine !== "seraph" || e.removed || !vis(view, e.x, e.y, 1100)) continue;
      const s = e.def.size, j = N().seraph.judge;
      c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(e.x, e.y, 46 * s, 16 * s, 0, 0, TAU); c.fill();
      if ((e.act === "judgeW" || e.act === "judge") && e.jAim != null) {
        const k = e.act === "judgeW" ? 1 - Math.max(0, e.t) / j.mark : 1;
        for (const a of beamAngles(e)) {
          c.save(); c.translate(e.x, e.y); c.rotate(a);
          c.fillStyle = `rgba(255,120,30,${e.act === "judgeW" ? 0.18 + 0.32 * k : 0.15})`;
          c.fillRect(0, -j.beamR * 0.8, j.len, j.beamR * 1.6);
          if (e.act === "judge") { c.fillStyle = "rgba(255,220,140,0.85)"; c.beginPath(); c.ellipse(e.jd, 0, j.beamR, j.beamR * 0.6, 0, 0, TAU); c.fill(); }
          c.restore();
        }
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
  // a chain from the colossus's wrist to a ring in the wall, link pictures laid end to end
  function chainLine(c, im, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    if (!im) { c.strokeStyle = "#4a3a34"; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); return; }
    const w = 46, h = (w * im.height) / im.width;
    c.save(); c.translate(x0, y0); c.rotate(a);
    for (let x = 0; x < d; x += w * 0.85) c.drawImage(im, x, -h / 2 + Math.sin(x * 0.02) * 3, w, h);
    c.restore();
  }
  // standing: fists flying in an arc (y-sorted by where they'll land)
  MB.push = function (list, c, t, view) {
    for (const k of rockets) {
      const x = k.x + Math.cos(k.a) * k.d, y = k.y + Math.sin(k.a) * k.d;
      if (!vis(view, x, y, 150)) continue;
      list.push({ y, f: () => {
        const im = IMG("colossus-fist");
        if (!im) { c.fillStyle = "#ff8a2a"; c.beginPath(); c.arc(x, y - 40, 20, 0, TAU); c.fill(); return; }
        const w = 130, h = (w * im.height) / im.width;
        // drawn flying left: turned to its heading
        c.save(); c.translate(x, y - 40); c.rotate(k.a + Math.PI); if (Math.cos(k.a) < 0) { c.scale(1, 1); } else c.scale(1, -1);
        c.drawImage(im, -w * 0.25, -h / 2, w, h); c.restore();
      } });
    }
    for (const f of fists) {
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / f.fly), x = f.x0 + (f.tx - f.x0) * k, gy = f.gy + (f.ty - f.gy) * k;
      const y = f.y0 + (f.ty - f.y0) * k - Math.sin(Math.PI * k) * f.arc;
      if (!vis(view, x, y, 120)) continue;
      list.push({ y: gy, f: () => {
        const im = IMG(f.im || (f.glob ? "bullet-0" : "golem-fist"));
        if (!im) { c.fillStyle = f.glob ? "#ff8a2a" : "#4a3028"; c.beginPath(); c.arc(x, y, f.glob ? 12 : 18, 0, TAU); c.fill(); return; }
        const w = f.w || (f.glob ? 34 : 66), h = (w * im.height) / im.width, flip = f.tx < f.x0;
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
