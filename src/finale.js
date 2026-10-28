/* Drowned Light — the finale: the Fire Bearer, the march to the Drowned Gate, and the Sunken King.
   Nothing of it shows until it's earned (the secrecy rule): Central Flame 5, the Starved Bell and the Deadly Rose slain,
   Derek won from the Colossus, and your Kindle lit. At the next dawn Kindle climbs into the Central Flame, drinks it in and
   rises as the Fire Bearer, a lantern as tall as a tower on four long legs. From the camp, by day, the host begins the march:
     the march  the Bearer walks for the Drowned Gate, far out in the Abyss, but only while a knight walks beside it. By day the
                Drowned climb out of the mud to drown its flame; at dusk it plants its legs wherever it is and makes camp
                (braziers round it, its light grows), and the night's waves come for it there. It heals some at dawn.
                Struck down, it gutters and falls back to its last camp, and rekindles at dawn. The Great Siege doesn't
                come for the camp while it's out: the Drowned hunt the Bearer instead.
     the gate   a gate of black stone with three hollows above its doors, alone in the Abyss, with black water behind it.
                Anyone can come upon it before the end; it only says it's sealed.
     the King   when the Bearer plants on the hearth before the gate, the Sunken King rises out of the black water behind it:
                a drowned giant, crowned, so big the gate only reaches his waist. Blades can't hurt him. While the Bearer
                stands it gathers its flame; full, it hurls it at him and burns his heart open for a few seconds, the only
                time he can be hurt. He slams his hands down on knights and the Bearer, sweeps his arm across the arena,
                calls the Drowned out of the water, and later rains black water. Three burnings at least (his health is
                split in thirds). Slain, he sinks; the Bearer walks into the gate, its fire pours through, the gate opens,
                and Kindle comes back out, small again. The victory screen follows.
   The host runs it all and sends it in its snapshots (Finale.snap); each device finds the gate for itself. The King and the
   Bearer are coded stand-ins until their drawings are in. Numbers: DL.FINALE and DL.ENEMIES.king (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU, clamp } = DL;
  const G = DL.Game, F = DL.FINALE, K = DL.FINALE.king, GT = DL.FINALE.gate;
  const toast = (m, k) => DL.UI && DL.UI.toast(m, k);
  const say = (m, k) => { toast(m, k); DL.Net.say(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const Finale = (DL.Finale = { b: null });
  const KING = "The Sunken King", MOVES = ["slam", "sweep", "call", "rain"];
  const FIRE = "255,150,60";
  const now = () => performance.now() / 1000;
  const age = (o) => o.t + (o.at ? now() - o.at : 0);
  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  let blows = [], beam = null, found = false, net = { stage: 0, charge: 0, open: 0, phase: 0, kingId: 0 }, seen = -1, winAt = 0;

  /* ---------------- state ---------------- */
  // The stage: 0 nothing yet (all secret), 1 the Bearer has risen and waits in the camp, 2 on the march, 3 at the gate, 4 won.
  const S = () => G.save.finale;
  Finale.stage = () => (G.isGuest() ? net.stage : S().stage);
  // The Bearer is out of the camp: the Great Siege leaves the camp alone.
  Finale.away = () => Finale.stage() === 2 || Finale.stage() === 3;
  // While Kindle is the Bearer, the host's Kindle isn't at their heel.
  Finale.bearing = () => !G.isGuest() && S().stage >= 1 && S().stage <= 3;
  // Everything the end needs, done in this world.
  Finale.ready = () => G.save.up.flame >= 5 && !!G.save.trophies.bell && !!G.save.trophies.rose && !!G.save.golem && !!G.save.kindle.lit;
  Finale.king = () => G.enemies.find((e) => e.def.king && !e.removed) || null;
  Finale.won = () => Finale.stage() === 4;

  /* ---------------- where the gate stands ---------------- */
  // Dry land in the north half of the Abyss, its arena clear of water and bloom groves, far from the Rose and the graves.
  let spot = null, spotFor = null;
  Finale.gate = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE, rose = DL.Rose.lair(), gs = DL.Abigail.graveSpot();
    const dryRing = (x, y) => {
      if (W.isWater(x, y)) return false;
      for (const r of [160, 320, GT.arenaR]) for (let i = 0; i < 8; i++) if (W.isWater(x + Math.cos(i * 0.785) * r, y + Math.sin(i * 0.785) * r * 0.8)) return false;
      return true;
    };
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 900) / GR.cell); gy <= Math.floor((y + 900) / GR.cell); gy++)
        for (let gx = Math.floor((x - 900) / GR.cell); gx <= Math.floor((x + 900) / GR.cell); gx++) {
          const g = W.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 720) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 160 && !spot; t++) {
      const a = -Math.PI / 2 + (DL.hash(71, 43, 300 + t) - 0.5) * 2.2, r = GT.dist + (DL.hash(71, 43, 400 + t) - 0.5) * 500;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      const ax = x, ay = y + GT.arenaY;
      if (dryRing(ax, ay) && !groveNear(ax, ay) && Math.hypot(x - rose.x, y - rose.y) > 1800 && Math.hypot(x - gs.x, y - gs.y) > 1400) spot = { x, y };
    }
    spot = spot || { x: 0, y: -GT.dist };
    spotFor = G.save.difficulty;
    return spot;
  };
  const arena = () => { const g = Finale.gate(); return { x: g.x, y: g.y + GT.arenaY }; };
  const plant = () => { const g = Finale.gate(); return { x: g.x, y: g.y + GT.plantY }; };
  Finale.where = function () { const g = Finale.gate(); return { dir: compass(g.x, g.y), m: Math.round(Math.hypot(g.x, g.y) / 10) }; };
  // No rocks or trees in the arena, nor in the black water behind the gate.
  Finale.clears = function (x, y) {
    const g = Finale.gate(), a = arena();
    return Math.hypot(x - a.x, y - a.y) < GT.clear || Math.hypot(x - g.x, (y - g.y + 150) * 1.6) < 520;
  };
  // Nobody walks behind the gate into the black water.
  Finale.collide = function (ent) {
    const g = Finale.gate();
    if (Math.abs(ent.x - g.x) < 430 && ent.y < g.y + 4 && ent.y > g.y - 700) ent.y = g.y + 4;
  };

  /* ---------------- the Bearer ---------------- */
  const maxHp = () => Math.round(F.hp * G.partyScale());
  function makeBearer(x, y) {
    const s = S(), max = maxHp();
    return { kind: "bearer", x, y, rad: 34, hp: s.hp > 0 ? Math.min(s.hp, max) : max, max, lit: !s.down, down: !!s.down, angle: Math.PI / 2,
      moving: false, animT: 0, hitT: 0, camp: false, charge: 0, pulseT: F.pulseEvery, bandT: 6, waveT: 4, saveT: 8 };
  }
  const campSpot = () => ({ x: 96, y: 64 });
  Finale.reset = function () {
    blows = []; beam = null;
    Finale.b = null;
    if (G.isGuest()) return;
    const s = S();
    if (s.stage === 1) Finale.b = makeBearer(campSpot().x, campSpot().y);
    else if (s.stage === 2 || s.stage === 3) Finale.b = makeBearer(s.x, s.y);
  };
  function store() {
    const b = Finale.b, s = S();
    if (b) { s.x = Math.round(b.x); s.y = Math.round(b.y); s.hp = Math.round(b.hp); s.down = b.down; }
    G.persist();
  }

  // Enemies hurting it (from the Drowned's blows on their goal, src/game.js) and the King's hands.
  Finale.hurt = function (b, amt) {
    if (!b || b.down) return;
    b.hp -= amt;
    b.hitT = 0.2;
    if (S().stage === 3) b.charge = Math.max(0, b.charge - K.hitCharge);
    for (let i = 0; i < 5; i++) G.spark(b.x + rand(-14, 14), b.y - rand(40, 110), FIRE, 90);
    if (b.hp <= 0) fall(b);
  };
  // Struck down: it gutters and staggers back to its last camp, to rekindle at dawn.
  function fall(b) {
    const s = S(), back = s.rest || campSpot();
    b.hp = 0; b.down = true; b.lit = false; b.camp = false; b.charge = 0;
    for (let i = 0; i < 30; i++) G.puff(b.x + rand(-30, 30), b.y - rand(0, 140), "rgba(40,36,32,0.75)", 80, 1.3, -20);
    const k = Finale.king();
    if (k) sink(k);
    b.x = back.x; b.y = back.y;
    if (s.stage === 3) s.stage = 2;
    store();
    sfx("death");
    say("The Fire Bearer gutters out and staggers back to its last camp. Its fire will rekindle at dawn.", "danger");
  }

  /* ---------------- rising (host, at dawn) ---------------- */
  function rise() {
    const s = S();
    s.stage = 1;
    s.hp = -1; s.down = false; s.rest = null;
    G.kindles = G.kindles.filter((k) => k.owner !== 0); // Kindle goes into the fire
    Finale.b = makeBearer(campSpot().x, campSpot().y);
    Finale.b.grow = 0;
    G.persist();
    setTimeout(() => say("Kindle scuttles up onto the Central Flame and drinks it in, flame and all.", "good"), 2600);
    setTimeout(() => { sfx("milestone"); G.camera.shake = 10; say("The fire rises with him. Kindle stands up as tall as a tower: the Fire Bearer.", "good"); }, 6500);
    setTimeout(() => say(`Far off in the Abyss, something answers. The Bearer turns to the ${Finale.where().dir}. Begin the march from the camp, by day.`, "warn"), 11000);
  }
  Finale.dawn = function () {
    if (G.isGuest()) return;
    const s = S(), b = Finale.b;
    if (s.stage === 0 && Finale.ready()) return rise();
    if (!b) return;
    b.camp = false;
    if (b.down) {
      b.down = false; b.lit = true; b.hp = b.max = maxHp();
      say("Dawn. The Fire Bearer's flame rekindles. Walk beside it and it marches on.", "good");
    } else b.hp = Math.min(b.max, b.hp + b.max * F.dawnHeal);
    store();
  };
  // Dusk on the march: it plants its legs and makes camp, braziers round it.
  Finale.nightfall = function () {
    if (G.isGuest()) return;
    const s = S(), b = Finale.b;
    if (s.stage !== 2 || !b || b.down) return;
    b.camp = true;
    b.moving = false;
    b.waveT = 5;
    s.rest = { x: Math.round(b.x), y: Math.round(b.y) };
    const night = DL.CYCLE.night + DL.CYCLE.dusk + DL.CYCLE.dawn;
    for (let i = 0; i < F.braziers; i++) {
      const a = (i / F.braziers) * TAU + Math.PI / 4;
      G.torches.push({ type: "brazier", x: b.x + Math.cos(a) * F.brazierR, y: b.y + Math.sin(a) * F.brazierR * 0.7, t: night, max: night, r: 120 * G.diff().light, hp: 90, rad: 10 });
    }
    store();
    say("The Fire Bearer plants its legs and makes camp. Hold its light until dawn.", "warn");
  };

  // From the camp menu (the host, by day): off to the gate.
  Finale.begin = function () {
    const s = S(), b = Finale.b;
    if (G.isGuest() || s.stage !== 1 || !b || G.night) return false;
    s.stage = 2;
    s.rest = { x: Math.round(b.x), y: Math.round(b.y) };
    store();
    sfx("milestone");
    say(`The Fire Bearer sets out for the gate, ${Finale.where().m} m to the ${Finale.where().dir}. It walks only while a knight walks beside it.`, "good");
    return true;
  };
  Finale.lock = function () {
    if (G.isGuest()) return "Only the host can begin the march";
    if (G.night) return "Only by day";
    return "";
  };

  /* ---------------- every frame (host) ---------------- */
  const knights = () => G.knights();
  const nearest = (x, y) => Math.min(1e9, ...knights().map((k) => dist(k.x, k.y, x, y)));
  Finale.update = function (dt) {
    if (!G.isGuest()) { for (const q of blows) q.t += dt; if (beam) beam.t += dt; }
    land();
    blows = blows.filter((q) => age(q) < q.delay + (q.kind === "sweep" ? 1.2 : 1));
    if (beam && age(beam) > beam.max) beam = null;
    if (G.isGuest() || G.cave) return;
    const s = S(), b = Finale.b;
    if (!b) return;
    b.animT += dt * (b.moving ? 0.35 : 0.5);
    b.hitT = Math.max(0, b.hitT - dt);
    if (b.grow != null && b.grow < 1) b.grow = Math.min(1, b.grow + dt / 6);
    if (b.leave != null) return leaving(b, dt);
    if (b.down) return;
    pulse(b, dt);
    if (s.stage === 2) march(b, dt);
    else if (s.stage === 3) atGate(b, dt);
    b.saveT -= dt;
    if (b.saveT <= 0) { b.saveT = 8; store(); }
  };

  // Its fire scorches whatever crowds it.
  function pulse(b, dt) {
    b.pulseT -= dt;
    if (b.pulseT > 0) return;
    const prey = G.enemies.filter((e) => !e.removed && e.rise <= 0 && !e.def.king && dist(e.x, e.y, b.x, b.y) < F.pulseR + e.def.radius);
    if (!prey.length) { b.pulseT = 0.4; return; }
    b.pulseT = F.pulseEvery;
    G.effects.push({ type: "ring", x: b.x, y: b.y - 6, r0: 20, r1: F.pulseR, col: FIRE, w: 6, t: 0, max: 0.5 });
    for (const e of prey) G.hitEnemy(e, F.pulseDmg, Math.atan2(e.y - b.y, e.x - b.x), 140, 6, true);
    sfx("flameHit");
  }

  function march(b, dt) {
    if (b.camp) {
      // its camp for the night: waves from two sides while a knight is there to hold it
      if (nearest(b.x, b.y) > F.campR) return;
      b.waveT -= dt;
      if (b.waveT > 0) return;
      b.waveT = F.waveEvery;
      const zi = Math.max(1, DL.World.zoneIndex(b.x, b.y)), D = G.diff();
      const n = Math.round((F.waveN + Math.floor(G.save.day * 0.5)) * D.spawn * G.partyScale()), a = rand(0, TAU);
      for (let i = 0; i < 2; i++) G.spawnWave(b.x, b.y, DL.ZONES[zi].pool, Math.ceil(n / 2), b, 430, zi, a + i * Math.PI);
      return;
    }
    if (G.night) { b.moving = false; return; }
    const to = plant(), d = dist(b.x, b.y, to.x, to.y);
    if (d < 6) return arrive(b);
    if (nearest(b.x, b.y) > F.leash) { b.moving = false; return; }
    const spd = F.speed * (DL.World.isWater(b.x, b.y) ? F.wade : 1), step = Math.min(d, spd * dt);
    b.x += ((to.x - b.x) / d) * step;
    b.y += ((to.y - b.y) / d) * step;
    b.angle = Math.atan2(to.y - b.y, to.x - b.x);
    b.moving = true;
    if (Math.random() < dt * 3) G.puff(b.x + rand(-30, 30), b.y + rand(-8, 8), "rgba(70,60,50,0.5)", 30, 0.8);
    // by day the Drowned climb out of the mud ahead of it
    b.bandT -= dt;
    if (b.bandT > 0) return;
    b.bandT = F.bandEvery;
    const zi = Math.max(1, DL.World.zoneIndex(b.x, b.y)), n = Math.round((F.bandN + Math.max(0, zi - 2)) * G.diff().spawn * G.partyScale());
    const base = b.angle + rand(-1.1, 1.1);
    for (let i = 0; i < n; i++) {
      const a = base + rand(-0.5, 0.5), r = F.bandR + rand(-40, 60);
      const e = G.makeEnemy(DL.weighted(DL.ZONES[zi].pool), b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, zi, { goal: b, march: true, rise: 0.9 });
      G.enemies.push(e);
    }
  }

  function arrive(b) {
    const s = S();
    s.stage = 3;
    b.moving = false;
    b.charge = 0;
    b.angle = -Math.PI / 2;
    store();
    say("The Fire Bearer plants its legs on the cold hearth before the gate.", "warn");
  }

  /* ---------------- the Sunken King (host) ---------------- */
  function atGate(b, dt) {
    let e = Finale.king();
    const g = Finale.gate();
    if (!e) {
      if (nearest(g.x, g.y) > K.spawn) return;
      e = G.makeEnemy("king", g.x, g.y + 14, 4, { rise: K.rise, angle: Math.PI / 2, phase: 0, open: 0 });
      for (const k of MOVES) e[k + "T"] = K[k].first + K.rise;
      G.enemies.push(e);
      b.charge = 0;
      G.camera.shake = 14;
      sfx("rise");
      say("The black water behind the gate heaves. Something vast is rising.", "danger");
      setTimeout(() => { if (Finale.king()) say(`${KING} rises! Blades can't touch him. Guard the Fire Bearer while it gathers its flame.`, "danger"); }, 2800);
      return;
    }
    if (nearest(g.x, g.y) > K.forget) return sink(e);
    if (e.rise > 0 || e.open > 0) return;
    b.charge = Math.min(1, b.charge + dt / K.charge);
    if (b.charge >= 1) burn(b, e);
  }
  // Everyone left: he sinks back into the water, whole.
  function sink(e) {
    e.removed = true;
    G.enemies = G.enemies.filter((q) => q !== e);
    blows = [];
    G.telegraphs = G.telegraphs.filter((q) => !q.king);
  }
  // The Bearer hurls its flame: his heart burns open.
  function burn(b, e) {
    b.charge = 0;
    e.open = K.open;
    e.special = null;
    blows = blows.filter((q) => q.t >= q.delay); // whatever he was winding up comes to nothing
    G.telegraphs = G.telegraphs.filter((q) => !q.king);
    beam = { x1: b.x, y1: b.y - 70, x2: e.x, y2: e.y - 284, t: 0, max: 0.9 };
    G.camera.shake = 12;
    sfx("milestone");
    say("The Fire Bearer hurls its flame! The King's heart burns open: strike it now!", "good");
  }
  Finale.isOpen = (e) => (G.isGuest() ? net.open > 0 && net.kingId === e.id : e.open > 0);
  // How much of a blow lands: nothing while his heart is shut, and never past the end of this burning.
  Finale.cap = function (e, d) {
    if (!(e.open > 0)) return 0;
    const floor = e.phase < K.phases.length ? e.maxHp * K.phases[e.phase] : 0;
    return Math.max(0, Math.min(d, e.hp - floor));
  };
  let immuneT = 0;
  Finale.immune = function (e) {
    if (now() - immuneT < 0.5) return;
    immuneT = now();
    G.text(e.x, e.y - 150, "His heart is sealed", "#9fdfe6", 1.1);
  };

  // His brain, every frame from the Drowned's behaviour (src/game.js).
  Finale.think = function (e, dt) {
    if (e.hx == null) { e.hx = e.x; e.hy = e.y; }
    e.x = e.hx; e.y = e.hy; // nothing shoves him (Derek's walls, the crowd)
    e.stun = 0; e.conf = 0; e.sleep = false; e.mind = 0; e.slow = 0; e.kx = 0; e.ky = 0; e.burn = 0; e.bleed = 0; e.bound = 0;
    e.state = "move"; e.moving = false;
    if (e.open > 0) {
      e.open -= dt;
      const floor = e.phase < K.phases.length ? e.maxHp * K.phases[e.phase] : -1;
      if (e.hp <= floor + 0.5) { e.open = 0; e.phase++; enrage(e); }
      else if (e.open <= 0) say("The King's heart seals over. Guard the Bearer while it gathers its flame again.", "warn");
      return;
    }
    const rate = Math.pow(K.rate, e.phase);
    for (const k of MOVES) e[k + "T"] -= dt * rate;
    if (blows.some((q) => q.t < q.delay && q.kind !== "rain")) return; // one hand move at a time
    const ks = knights();
    if (!ks.length) return;
    for (const k of MOVES) {
      if (e[k + "T"] > 0 || (k === "rain" && e.phase < 1)) continue;
      e[k + "T"] = K[k].every;
      if (k === "slam") slam(e, ks);
      else if (k === "sweep") sweep(e, ks);
      else if (k === "call") call(e);
      else rain(e, ks);
      if (k !== "rain" && e.phase >= 2 && k === "slam") slam(e, ks, true); // at the last, both hands at once
      break;
    }
  };
  // He doesn't walk or strike like the other Drowned: his hands do everything.
  Finale.busy = () => true;
  function enrage(e) {
    G.camera.shake = 14;
    sfx("growl");
    say(e.phase >= 2 ? "The King tears at the gate and roars. Both his hands come for you now!" : "The King's heart seals over, and he roars. Black water begins to rain.", "danger");
  }

  const handFree = (side) => !blows.some((q) => q.side === side && q.t < q.delay + 0.6);
  function slam(e, ks, second) {
    const b = Finale.b, useBearer = b && !b.down && Math.random() < 0.3, tgt = useBearer ? b : ks[(Math.random() * ks.length) | 0];
    const g = Finale.gate();
    let side = tgt.x < g.x ? -1 : 1;
    if (!handFree(side)) side = -side;
    if (!handFree(side)) return;
    const x = tgt.x + (second ? rand(-60, 60) : 0), y = Math.max(g.y + 40, tgt.y + (second ? rand(-40, 40) : 0)), S2 = K.slam;
    blows.push({ kind: "slam", side, x, y, t: 0, delay: S2.windup, r: S2.r, bearer: S2.bearer });
    G.telegraphs.push({ x, y, r: S2.r, t: 0, delay: S2.windup, dmg: e.dmg * S2.dmg, king: true });
    sfx("rise");
  }
  function sweep(e, ks) {
    const g = Finale.gate(), a = arena(), W = K.sweep, tgt = ks[(Math.random() * ks.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    if (!handFree(side)) return;
    const y = clamp(tgt.y, g.y + 60, a.y + GT.arenaR * 0.8);
    const x0 = a.x - side * ((W.n - 1) / 2) * W.step;
    blows.push({ kind: "sweep", side, x: x0, y, x2: a.x + side * ((W.n - 1) / 2) * W.step, t: 0, delay: W.windup, r: W.r, bearer: W.bearer });
    for (let i = 0; i < W.n; i++) G.telegraphs.push({ x: x0 + side * i * W.step, y, r: W.r, t: 0, delay: W.windup + i * 0.04, dmg: e.dmg * W.dmg, king: true });
    sfx("growl");
  }
  function call(e) {
    const g = Finale.gate(), b = Finale.b, live = G.enemies.filter((q) => q.fromKing && !q.removed).length;
    const n = Math.min(14 - live, Math.round((K.call.n + e.phase) * G.partyScale()));
    for (let i = 0; i < n; i++) {
      const x = g.x + rand(-380, 380), y = g.y + rand(30, 90);
      G.enemies.push(G.makeEnemy(DL.weighted(DL.ZONES[4].pool), x, y, 4, { rise: 0.9, goal: b && !b.down ? b : null, fromKing: true }));
    }
    if (n > 0) for (let i = 0; i < 16; i++) G.puff(g.x + rand(-380, 380), g.y + rand(20, 80), "rgba(60,200,210,0.6)", 60, 0.9, -30);
  }
  function rain(e, ks) {
    const R = K.rain;
    for (let i = 0; i < R.n; i++) {
      const on = ks[i % ks.length], a = rand(0, TAU), off = i < ks.length ? 0 : rand(40, 150);
      const x = on.x + Math.cos(a) * off, y = on.y + Math.sin(a) * off * 0.8;
      G.telegraphs.push({ x, y, r: R.r, t: 0, delay: R.windup + i * 0.08, dmg: e.dmg * R.dmg, corrupt: R.corrupt, king: true });
      blows.push({ kind: "rain", side: 0, x, y, t: 0, delay: R.windup + i * 0.08, r: R.r, bearer: 0 });
    }
  }
  // A hand coming down (or the sweep passing) on the Bearer too.
  function land() {
    const b = Finale.b;
    for (const q of blows) {
      if (q.landed || age(q) < q.delay) continue;
      q.landed = true;
      if (q.kind === "slam") { G.camera.shake = Math.max(G.camera.shake, 9); sfx("shatter"); for (let i = 0; i < 14; i++) G.puff(q.x + rand(-40, 40), q.y + rand(-10, 10), "rgba(60,200,210,0.6)", 110, 0.7, -30); }
      if (G.isGuest() || !b || b.down || !q.bearer) continue;
      const hit = q.kind === "sweep" ? Math.abs(b.y - q.y) < q.r + 20 : dist(b.x, b.y, q.x, q.y) < q.r + 24;
      if (hit) Finale.hurt(b, q.bearer);
    }
  }

  // Slain: he sinks, the Bearer walks into the gate, and the gate opens.
  Finale.slain = function (e) {
    const s = S(), b = Finale.b;
    s.stage = 4;
    s.won = G.save.day;
    blows = [];
    G.telegraphs = G.telegraphs.filter((q) => !q.king);
    for (const q of G.enemies) if (q.fromKing) q.removed = true;
    G.camera.shake = 16;
    sfx("milestone");
    say(`${KING} sinks into the black water, and does not rise again.`, "good");
    if (b) { b.leave = 0; b.down = false; b.lit = true; }
    store();
    setTimeout(() => say("The Fire Bearer walks into the gate. Its fire pours through the black stone, and the Drowned Gate opens.", "good"), 3200);
    winAt = now() + 8;
  };
  // Into the gate: it shrinks back into Kindle, who scuttles out again.
  function leaving(b, dt) {
    const g = Finale.gate();
    b.leave += dt / 5;
    b.moving = b.leave < 0.6;
    if (b.moving) { b.x += (g.x - b.x) * Math.min(1, dt * 0.8); b.y += (g.y + 20 - b.y) * Math.min(1, dt * 0.8); b.angle = -Math.PI / 2; }
    if (b.leave < 1) return;
    Finale.b = null;
    for (let i = 0; i < 30; i++) G.spark(g.x + rand(-40, 40), g.y - rand(0, 200), FIRE, 120);
    DL.Kindle.back(g.x, g.y + 40);
    say("Out of the open gate scuttles Kindle, small again, his fire still burning. He runs to your side.", "good");
  }
  // The victory screen, once the gate has opened (every device).
  Finale.tick = function () {
    if (winAt && now() >= winAt) { winAt = 0; DL.UI.showWin(); }
  };

  /* ---------------- every device: coming upon the gate ---------------- */
  Finale.local = function () {
    const p = G.player;
    if (!p || G.cave || G.state !== "play") return;
    const g = Finale.gate();
    if (found || dist(p.x, p.y, g.x, g.y + 200) > GT.foundR) return;
    found = true;
    if (!G.isGuest() && !S().found) { S().found = true; G.persist(); }
    const st = Finale.stage();
    if (st === 0) toast("A gate of black stone stands alone here, taller than any tree, sealed shut. Black water laps behind it. Three hollows are carved above its doors, and before it lies a cold hearth as wide as a house.", "warn");
    else if (st === 4) toast("The Drowned Gate stands open. Warm light breathes out of it.", "good");
  };
  Finale.found = () => found || !!S().found;

  /* ---------------- the camp menu, the field guide and the HUD ---------------- */
  // A card at the top of the Buildings tab once the Bearer has risen.
  Finale.card = function () {
    const st = Finale.stage();
    if (st < 1) return "";
    const w = Finale.where();
    if (st === 4) return `<article class="card finale-card"><header><h3>The Drowned Gate</h3><span class="tag">Open</span></header>
      <p>The Fire Bearer carried the last light of the marsh to the gate, and ${KING} is no more. The gate stands open, ${w.m} m to the ${w.dir}.</p></article>`;
    const lock = Finale.lock();
    const body = st === 1
      ? `<p>Kindle drank the Central Flame and rose as the Fire Bearer. Far off in the Abyss, ${w.m} m to the ${w.dir}, something waits for its fire. Walk beside it and it marches; it rests at night, and the Drowned will come for its flame.</p>
         <footer>${lock ? `<span class="req">${lock}</span>` : ""}<button data-act="march" ${lock ? "disabled" : ""}>Begin the march</button></footer>`
      : `<p>${st === 3 ? "The Bearer stands on the hearth before the gate." : "The Bearer is on its way to the gate. It walks only while a knight walks beside it, and makes camp at night."}</p>`;
    return `<article class="card finale-card"><header><h3>The Fire Bearer</h3><span class="tag">${st === 1 ? "Waiting" : st === 2 ? "On the march" : "At the gate"}</span></header>${body}</article>`;
  };
  // The field guide's line: nothing at all until the gate is found or the Bearer has risen.
  Finale.guideLine = function () {
    const st = Finale.stage(), w = Finale.where();
    if (st === 0) return Finale.found() ? `A sealed gate of black stone stands in the Abyss, ${w.m} m ${w.dir} of camp. Three hollows are carved above its doors.` : "";
    if (st === 4) return `<b>The Drowned Gate</b> stands open, ${w.m} m ${w.dir} of camp.`;
    return `<b>The Fire Bearer</b> carries the Central Flame's fire to the gate in the Abyss, ${w.m} m ${w.dir} of camp. It walks only while you walk beside it, and makes camp at night.`;
  };
  // The banner while you're with it.
  Finale.objective = function (p) {
    const st = Finale.stage(), b = Finale.b;
    if (!b || (st !== 2 && st !== 3) || dist(p.x, p.y, b.x, b.y) > 900) return "";
    const hp = `Bearer ${Math.max(0, Math.ceil(b.hp))} / ${b.max}`;
    if (b.down) return "The Fire Bearer has guttered out · it rekindles at dawn";
    if (st === 3) {
      const e = Finale.king();
      if (!e || e.rise > 0) return `The Fire Bearer stands before the gate · ${hp}`;
      if (Finale.isOpen(e)) return `His heart is open: strike ${KING}! · ${hp}`;
      return `Guard the Bearer · its flame ${Math.floor((G.isGuest() ? net.charge : b.charge) * 100)}% · ${hp}`;
    }
    if (b.camp) return `Hold the Bearer's camp until dawn · ${hp}`;
    const to = plant();
    return `Walk beside the Fire Bearer · ${hp} · gate ${Math.round(dist(b.x, b.y, to.x, to.y) / 10)} m`;
  };
  // The compass: to the Bearer while you're away from it, to the gate while you're with it.
  Finale.nav = function (p) {
    const st = Finale.stage(), b = Finale.b;
    if (G.cave || (st !== 1 && st !== 2 && st !== 3) || !b) return null;
    if (st === 1) return null;
    if (dist(p.x, p.y, b.x, b.y) > 700) return { x: b.x, y: b.y, label: "Bearer" };
    const g = Finale.gate();
    return { x: g.x, y: g.y, label: "Gate" };
  };
  // In the arena the camera pulls back and leans toward the King, so you can see him (src/render.js, src/game.js).
  Finale.view = function (p) {
    if (G.cave || Finale.stage() !== 3) return null;
    const a = arena(), g = Finale.gate();
    return dist(p.x, p.y, a.x, a.y) < GT.arenaR + 450 ? { need: GT.view, needW: GT.viewW, x: g.x, y: g.y - 440 } : null;
  };
  // While the Bearer camps, and in the arena, only its waves and the King's Drowned come (src/game.js).
  Finale.busySpot = function (p) {
    const st = Finale.stage(), b = Finale.b;
    if (st === 2 && b && b.camp && G.night && dist(p.x, p.y, b.x, b.y) < F.campR) return true;
    if (st === 3) { const a = arena(); return dist(p.x, p.y, a.x, a.y) < GT.arenaR + 600; }
    return false;
  };
  // The King in the arena: the Starved Bell keeps away (src/bell.js).
  Finale.fighting = () => Finale.stage() === 3 && !!Finale.king();

  /* ---------------- light ---------------- */
  Finale.lights = function (L) {
    const b = Finale.b, st = Finale.stage(), g = Finale.gate();
    if (b && !b.down) {
      const grow = b.grow != null ? b.grow : 1, fade = b.leave != null ? 1 - b.leave : 1;
      const r = (b.camp ? F.restLight : F.light) * G.diff().light * (0.3 + 0.7 * grow) * fade;
      L.push({ x: b.x, y: b.y - 60, r, s: 1, col: FIRE, a: 0.95 * fade, flick: 1, kind: "human" });
    } else if (b && b.down) L.push({ x: b.x, y: b.y - 20, r: 60, s: 0.4, col: "255,80,30", a: 0.4, flick: 1 });
    if (st === 4) L.push({ x: g.x, y: g.y - 60, r: 260, s: 0.8, col: "255,200,120", a: 0.85, flick: 1, kind: "human" });
    const e = Finale.king();
    if (e) {
      // a cold sheen off the black water lights him from below, so he looms out of the dark
      const k = kingRise(e);
      L.push({ x: g.x, y: g.y - 230, r: 520 * (0.4 + 0.6 * k), s: 0.7 * k, col: "70,230,240", a: 0.45 * k });
      if (Finale.isOpen(e)) L.push({ x: g.x, y: g.y - 270, r: 220, s: 0.8, col: "255,120,40", a: 0.9, flick: 1 });
    }
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Finale.snap = function () {
    const st = S().stage, b = Finale.b, e = Finale.king();
    if (!st && !b) return 0;
    return [st, b ? [r1(b.x), r1(b.y), Math.round(b.hp), b.max, (b.down ? 1 : 0) | (b.camp ? 2 : 0) | (b.moving ? 4 : 0), r1(b.angle), Math.round(b.charge * 100) / 100,
      b.leave != null ? r1(b.leave) : -1, b.grow != null ? r1(b.grow) : 1] : 0,
      e ? [e.id, r1(e.open || 0), e.phase || 0] : 0,
      blows.map((q) => [q.kind, q.side, r1(q.x), r1(q.y), r1(q.t), q.delay, q.r, q.x2 != null ? r1(q.x2) : 0]),
      beam ? [r1(beam.x1), r1(beam.y1), r1(beam.x2), r1(beam.y2), r1(beam.t)] : 0];
  };
  Finale.applySnap = function (m) {
    if (!m) { net.stage = 0; Finale.b = null; return; }
    const at = now(), was = net.stage;
    net.stage = m[0];
    if (seen < 0) seen = net.stage; // the stage when we joined: a gate opened before we came shows no victory
    if (net.stage === 4 && was !== 4 && seen !== 4) winAt = now() + 8;
    const r = m[1];
    if (r) {
      const b = Finale.b || (Finale.b = { kind: "bearer", x: r[0], y: r[1], rad: 34, animT: 0, hitT: 0 });
      Object.assign(b, { tx: r[0], ty: r[1], hp: r[2], max: r[3], down: !!(r[4] & 1), camp: !!(r[4] & 2), moving: !!(r[4] & 4), angle: r[5], lit: !(r[4] & 1),
        leave: r[7] >= 0 ? r[7] : null, grow: r[8] });
      net.charge = r[6];
    } else Finale.b = null;
    net.kingId = m[2] ? m[2][0] : 0; net.open = m[2] ? m[2][1] : 0; net.phase = m[2] ? m[2][2] : 0;
    for (const e of G.enemies) if (e.def.king) { e.open = e.id === net.kingId ? net.open : 0; e.phase = net.phase; }
    blows = m[3].map((q) => ({ kind: q[0], side: q[1], x: q[2], y: q[3], t: q[4], delay: q[5], r: q[6], x2: q[7], at, landed: q[4] >= q[5] }));
    beam = m[4] ? { x1: m[4][0], y1: m[4][1], x2: m[4][2], y2: m[4][3], t: m[4][4], max: 0.9, at } : null;
  };
  // Guest: glide the Bearer toward the host's position.
  Finale.guest = function (dt, k01) {
    const b = Finale.b;
    if (!b || b.tx == null) return;
    b.x += (b.tx - b.x) * k01; b.y += (b.ty - b.y) * k01;
    b.animT += dt * (b.moving ? 0.35 : 0.5);
  };

  /* ---------------- drawing ---------------- */
  // On the ground: the black water behind the gate, the old flagstones of the arena, and the hearth.
  Finale.drawGround = function (c, view, t) {
    const g = Finale.gate(), a = arena(), p = plant();
    if (g.x + 700 < view.left || g.x - 700 > view.right || g.y - 500 > view.bottom || g.y + 900 < view.top) return;
    c.save();
    // flagstones, cracked and half sunk
    c.fillStyle = "rgba(20,26,28,0.55)";
    c.beginPath(); c.ellipse(a.x, a.y, GT.arenaR, GT.arenaR * 0.62, 0, 0, TAU); c.fill();
    c.strokeStyle = "rgba(70,84,86,0.35)";
    c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const u = DL.hash(71, i, 11), v = DL.hash(71, i, 12), x = a.x + (u - 0.5) * GT.arenaR * 1.7, y = a.y + (v - 0.5) * GT.arenaR * 1.05;
      if (Math.hypot((x - a.x) / GT.arenaR, (y - a.y) / (GT.arenaR * 0.62)) > 0.95) continue;
      c.strokeRect(Math.round(x - 18), Math.round(y - 9), 36, 18);
    }
    // the black water
    const wy = g.y - 150;
    c.fillStyle = "#03090b";
    c.beginPath(); c.ellipse(g.x, wy, 520, 190, 0, 0, TAU); c.fill();
    c.strokeStyle = "rgba(70,200,210,0.25)";
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.25 + i / 3) % 1;
      c.globalAlpha = 1 - k;
      c.beginPath(); c.ellipse(g.x, wy + 20, 120 + 380 * k, 40 + 140 * k, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    // the hearth: a ring of great stones the Bearer plants on
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * TAU, x = p.x + Math.cos(an) * 62, y = p.y + Math.sin(an) * 34;
      c.fillStyle = "#1f2729"; c.beginPath(); c.ellipse(x, y, 13, 7, 0, 0, TAU); c.fill();
      c.fillStyle = "#3a4548"; c.beginPath(); c.ellipse(x - 2, y - 2, 8, 4, 0, 0, TAU); c.fill();
    }
    c.fillStyle = Finale.stage() === 3 ? "rgba(120,50,20,0.35)" : "rgba(10,10,10,0.45)";
    c.beginPath(); c.ellipse(p.x, p.y, 50, 26, 0, 0, TAU); c.fill();
    c.restore();
  };

  // Into the y-sorted scene: the King behind the gate, the gate, his hands, and the Bearer.
  Finale.push = function (list, c, t, view) {
    const g = Finale.gate(), b = Finale.b, e = Finale.king();
    const inView = (x, y, m) => x > view.left - m && x < view.right + m && y > view.top - 80 && y < view.bottom + m + 600;
    if (e && inView(g.x, g.y, 900)) list.push({ y: g.y - 40, f: () => drawKing(c, e, t) });
    if (inView(g.x, g.y, 500)) list.push({ y: g.y, f: () => drawGate(c, g, t) });
    if (e && kingRise(e) > 0.6) for (const side of [-1, 1]) { const h = handAt(e, side); list.push({ y: h.y + 2, f: () => drawHand(c, h, side, t) }); }
    if (b && inView(b.x, b.y, 300)) list.push({ y: b.y, f: () => drawBearer(c, b, t) });
  };
  // Over the dark: the Bearer's fire, the King's eyes and heart, and the flame it hurls.
  Finale.glow = function (c, t, view) {
    const b = Finale.b, e = Finale.king(), g = Finale.gate();
    if (b && !b.down) {
      const s = bearerScale(b), x = b.x, y = b.y - 15 * s, r = (16 + Math.sin(t * 7) * 2) * s;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,220,140,0.8)"); gr.addColorStop(1, "rgba(255,140,50,0)");
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
      const ch = G.isGuest() ? net.charge : b.charge;
      if (Finale.stage() === 3 && ch > 0) {
        // the flame it gathers: a ring that closes as it fills
        c.strokeStyle = `rgba(255,170,70,${0.4 + 0.5 * ch})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, r * 0.9 + 30 * (1 - ch), -Math.PI / 2, -Math.PI / 2 + TAU * ch); c.stroke();
      }
    }
    if (e && e.rise <= 0) {
      const k = kingRise(e), wy = g.y - 40, base = wy + (1 - k) * 560, at = (dy) => wy + (base + dy - wy) * KS;
      for (const sx of [-26, 26]) {
        const x = g.x + sx * KS, y = at(-470), r = 22 + Math.sin(t * 3 + sx) * 3, gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(120,250,255,0.9)"); gr.addColorStop(1, "rgba(60,220,230,0)");
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (Finale.isOpen(e)) {
        const x = g.x, y = at(30 - 270), r = 50 + Math.sin(t * 9) * 6, gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(255,240,180,0.95)"); gr.addColorStop(0.5, "rgba(255,140,40,0.7)"); gr.addColorStop(1, "rgba(255,80,20,0)");
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    if (beam) {
      const k = Math.min(1, age(beam) / beam.max);
      for (let i = 0; i < 10; i++) {
        const u = Math.min(1, k * 1.8 - i * 0.06);
        if (u <= 0) continue;
        const x = beam.x1 + (beam.x2 - beam.x1) * u, y = beam.y1 + (beam.y2 - beam.y1) * u - Math.sin(Math.PI * u) * 120;
        const r = 16 - i, gr = c.createRadialGradient(x, y, 0, x, y, r * 2);
        gr.addColorStop(0, `rgba(255,230,160,${0.95 * (1 - k * 0.5)})`); gr.addColorStop(1, "rgba(255,120,40,0)");
        c.fillStyle = gr; c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      }
    }
    if (Finale.stage() === 4 && g.x > view.left - 400 && g.x < view.right + 400) {
      const gr = c.createLinearGradient(0, g.y - 170, 0, g.y);
      gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(1, `rgba(255,200,120,${0.45 + 0.1 * Math.sin(t * 2)})`);
      c.fillStyle = gr; c.fillRect(g.x - 104, g.y - 170, 208, 170);
    }
  };

  // How big the Bearer stands: growing out of the fire when it first rises, shrinking into the gate at the end.
  function bearerScale(b) {
    const grow = b.grow != null ? b.grow : 1, leave = b.leave != null ? b.leave : 0;
    return (1 + 3.4 * grow) * (1 - 0.75 * Math.max(0, leave - 0.5) * 2);
  }
  function drawBearer(c, b, t) {
    const s = bearerScale(b);
    c.save();
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath(); c.ellipse(b.x, b.y, 12 * s, 4.4 * s, 0, 0, TAU); c.fill();
    if (b.hitT > 0) c.filter = "brightness(1.8)";
    DL.Render.kindleUnit(c, { x: b.x, y: b.y, angle: b.angle, moving: b.moving, animT: b.animT }, t, s, b.down);
    c.restore();
    // its health, while it's hurt
    if (b.hp < b.max && !b.down) {
      const w = 90, x = b.x - w / 2, y = b.y - 42 * s - 14;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = "#ffae52"; c.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 4);
    }
  }
  const Art = () => DL.Art;

  // How far he has risen out of the water (0 to 1).
  function kingRise(e) { return e.rise > 0 ? clamp(1 - e.rise / K.rise, 0, 1) : 1; }
  const KS = 0.85, STONE = "#1d2b30", STONE_HI = "#34484f", STONE_LT = "#56727a", WEED = "#2a4a36", WEED_HI = "#3f6e4c", CYAN = "90,235,245";
  function drawKing(c, e, t) {
    const g = Finale.gate(), k = kingRise(e), open = Finale.isOpen(e);
    const wy = g.y - 40, base = wy + (1 - k) * 560, sway = Math.sin(t * 0.7) * 6, x = g.x + sway * 0.3;
    const slump = open ? 30 : 0, y0 = base + slump;
    // arms, from the shoulders to wherever the hands are (they come up out of the water with him)
    c.save();
    c.globalAlpha = clamp((k - 0.4) / 0.6, 0, 1);
    for (const side of [-1, 1]) {
      const h = handAt(e, side), sx = x + side * 220 * KS, sy = wy + (y0 - 380 - wy) * KS;
      const ex = (sx + h.x) / 2 + side * 120, ey = Math.min(sy, h.y - h.lift) - 40;
      c.strokeStyle = STONE; c.lineWidth = 70; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, h.x, h.y - h.lift - 20); c.stroke();
      c.strokeStyle = STONE_HI; c.lineWidth = 40;
      c.beginPath(); c.moveTo(sx - side * 6, sy - 10); c.quadraticCurveTo(ex - side * 6, ey - 10, h.x, h.y - h.lift - 30); c.stroke();
      c.strokeStyle = WEED; c.lineWidth = 10;
      c.beginPath(); c.moveTo(sx, sy - 28); c.quadraticCurveTo(ex, ey - 30, (ex + h.x) / 2, (ey + h.y - h.lift) / 2 - 20); c.stroke();
    }
    c.restore();
    c.save();
    c.beginPath(); c.rect(g.x - 900, wy - 1200, 1800, 1200); c.clip(); // nothing of him below the water
    c.translate(x, wy); c.scale(KS, KS); c.translate(-x, -wy); // his body drawn a little smaller than his reach
    // the great body, hunched, rising out of the water
    c.fillStyle = STONE;
    c.beginPath();
    c.moveTo(x - 190, wy + 10); c.lineTo(x - 250, y0 - 330); c.quadraticCurveTo(x - 200, y0 - 430, x - 70, y0 - 420);
    c.lineTo(x + 70, y0 - 420); c.quadraticCurveTo(x + 200, y0 - 430, x + 250, y0 - 330); c.lineTo(x + 190, wy + 10); c.closePath(); c.fill();
    c.fillStyle = STONE_HI;
    c.beginPath(); c.moveTo(x - 160, wy); c.lineTo(x - 215, y0 - 320); c.quadraticCurveTo(x - 160, y0 - 400, x - 40, y0 - 395); c.lineTo(x - 30, wy); c.closePath(); c.fill();
    // ribs of black plate across the chest, and the heart behind them
    const hy = y0 - 270;
    if (open) {
      c.fillStyle = "#3b1206"; c.beginPath(); c.ellipse(x, hy, 70, 60, 0, 0, TAU); c.fill();
      c.fillStyle = "#ff8a2a"; c.beginPath(); c.ellipse(x, hy, 40 + Math.sin(t * 9) * 4, 36, 0, 0, TAU); c.fill();
      c.fillStyle = "#ffe9a8"; c.beginPath(); c.ellipse(x, hy - 4, 18, 16, 0, 0, TAU); c.fill();
      Art().drawFire(c, x, hy + 30, 1.6, t);
    } else {
      c.fillStyle = "#081013"; c.beginPath(); c.ellipse(x, hy, 62, 54, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(${CYAN},${0.35 + 0.15 * Math.sin(t * 2)})`; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x - 30, hy - 30); c.lineTo(x - 6, hy - 4); c.lineTo(x - 20, hy + 28); c.moveTo(x - 6, hy - 4); c.lineTo(x + 26, hy - 14); c.stroke();
    }
    c.strokeStyle = STONE_LT; c.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      const yy = hy - 60 + i * 38, w = 150 - Math.abs(i - 1.5) * 18;
      c.beginPath(); c.moveTo(x - w, yy + 12); c.quadraticCurveTo(x, yy - 14 + (open ? -18 : 0), x + w, yy + 12); c.stroke();
    }
    // weed hanging off him, and the water running down
    for (let i = 0; i < 14; i++) {
      const u = DL.hash(73, i, 1), xx = x - 220 + u * 440, top = y0 - 330 - DL.hash(73, i, 2) * 80, len = 60 + DL.hash(73, i, 3) * 160;
      c.strokeStyle = i % 3 ? WEED : WEED_HI; c.lineWidth = 6;
      c.beginPath(); c.moveTo(xx, top); c.quadraticCurveTo(xx + Math.sin(t + i) * 10, top + len / 2, xx + Math.sin(t * 0.8 + i) * 6, top + len); c.stroke();
    }
    // the head: a drowned skull of a king, its crown a ring of broken spires
    const hx = x + sway * 0.5, hyy = y0 - 470;
    c.fillStyle = STONE;
    c.beginPath(); c.ellipse(hx, hyy, 66, 74, 0, 0, TAU); c.fill();
    c.fillStyle = STONE_HI;
    c.beginPath(); c.ellipse(hx - 14, hyy - 12, 42, 52, 0, 0, TAU); c.fill();
    c.fillStyle = "#03080a";
    for (const sx of [-26, 26]) { c.beginPath(); c.ellipse(hx + sx, hyy, 16, 12, 0, 0, TAU); c.fill(); }
    c.fillStyle = `rgba(${CYAN},0.95)`;
    for (const sx of [-26, 26]) { c.beginPath(); c.ellipse(hx + sx, hyy + 1, 6, 4, 0, 0, TAU); c.fill(); }
    c.fillStyle = "#03080a"; c.fillRect(hx - 28, hyy + 30, 56, 26);
    c.fillStyle = `rgba(${CYAN},0.55)`;
    for (let i = 0; i < 6; i++) c.fillRect(hx - 24 + i * 9, hyy + 30, 3, 20);
    c.fillStyle = "#2a2618";
    for (let i = 0; i < 7; i++) {
      const an = -Math.PI / 2 + (i - 3) * 0.32, bx = hx + Math.cos(an) * 60, by = hyy - 50 + Math.abs(i - 3) * 6, h = 50 + ((i * 37) % 30) - Math.abs(i - 3) * 6;
      c.beginPath(); c.moveTo(bx - 9, by); c.lineTo(bx + (i % 2 ? 4 : -4), by - h); c.lineTo(bx + 9, by); c.closePath(); c.fill();
    }
    c.fillStyle = "#4a4126"; c.fillRect(hx - 60, hyy - 54, 120, 12);
    c.restore();
    // the water breaking round him
    c.fillStyle = `rgba(${CYAN},${0.25 + 0.1 * Math.sin(t * 3)})`;
    c.beginPath(); c.ellipse(g.x, wy + 6, 230, 26, 0, 0, TAU); c.fill();
    // his health, under the gate's lintel
    if (e.hp < e.maxHp || open) {
      const w = 260, bx = g.x - w / 2, by = g.y - 452;
      c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(bx - 2, by - 2, w + 4, 9);
      c.fillStyle = open ? "#ffae52" : "#7ff6ff"; c.fillRect(bx, by, w * clamp(e.hp / e.maxHp, 0, 1), 5);
      c.fillStyle = "#000";
      for (const q of K.phases) c.fillRect(bx + w * q - 1, by - 2, 2, 9);
    }
  }
  // Where each hand is: resting on the ground beside the gate, raised over a knight, or sweeping the arena.
  function handAt(e, side) {
    const g = Finale.gate(), rest = { x: g.x + side * 330, y: g.y + 60, lift: 0 }, k = kingRise(e);
    if (k < 1) { const u = clamp((k - 0.6) / 0.4, 0, 1); return { x: g.x + side * (240 + 90 * u), y: g.y - 60 + 120 * u, lift: 140 * Math.sin(Math.PI * u) }; } // up out of the water and over onto the ground
    const q = blows.find((o) => o.side === side && age(o) < o.delay + (o.kind === "sweep" ? 1.2 : 1));
    if (!q) return rest;
    const T = age(q);
    if (q.kind === "slam") {
      if (T < q.delay) {
        const u = T / q.delay, fly = Math.min(1, u * 2.5);
        const lift = u < 0.85 ? 260 * Math.min(1, u * 3) : 260 * (1 - (u - 0.85) / 0.15);
        return { x: rest.x + (q.x - rest.x) * fly, y: rest.y + (q.y - rest.y) * fly, lift };
      }
      const back = clamp((T - q.delay - 0.4) / 0.6, 0, 1);
      return { x: q.x + (rest.x - q.x) * back, y: q.y + (rest.y - q.y) * back, lift: Math.sin(Math.PI * back) * 80 };
    }
    // the sweep: out to the far end of the lane, then across it, then home
    if (T < q.delay) { const u = Math.min(1, T / (q.delay * 0.6)); return { x: rest.x + (q.x - rest.x) * u, y: rest.y + (q.y - rest.y) * u, lift: 60 * Math.sin(Math.PI * u) }; }
    const u = clamp((T - q.delay) / 0.5, 0, 1);
    if (u < 1) return { x: q.x + (q.x2 - q.x) * u, y: q.y, lift: 0 };
    const back = clamp((T - q.delay - 0.5) / 0.7, 0, 1);
    return { x: q.x2 + (rest.x - q.x2) * back, y: q.y + (rest.y - q.y) * back, lift: Math.sin(Math.PI * back) * 60 };
  }
  function drawHand(c, h, side, t) {
    const x = h.x, y = h.y - h.lift;
    c.fillStyle = `rgba(0,0,0,${0.25 + 0.3 * Math.max(0, 1 - h.lift / 260)})`;
    c.beginPath(); c.ellipse(h.x, h.y, 70, 26, 0, 0, TAU); c.fill();
    c.fillStyle = STONE;
    c.beginPath(); c.ellipse(x, y - 24, 64, 34, 0, 0, TAU); c.fill();
    c.fillStyle = STONE_HI;
    c.beginPath(); c.ellipse(x - side * 10, y - 32, 40, 18, 0, 0, TAU); c.fill();
    for (let i = 0; i < 4; i++) {
      const fx = x - 48 + i * 32;
      c.fillStyle = STONE; c.beginPath(); c.ellipse(fx, y - 2, 13, 18, 0, 0, TAU); c.fill();
      c.fillStyle = "#c9d7cf"; c.beginPath(); c.moveTo(fx - 5, y + 8); c.lineTo(fx, y + 20); c.lineTo(fx + 5, y + 8); c.fill();
    }
    c.fillStyle = WEED; c.fillRect(x - 30, y - 50, 60, 6);
    if (Math.random() < 0.08) G.puff(x + rand(-50, 50), y - 10, `rgba(${CYAN},0.5)`, 20, 0.6, 30);
  }

  // The Drowned Gate: two pillars of black stone, a lintel, sealed doors with three hollows (lit once the Bearer has
  // risen: the Bell's cold cyan, the Rose's red, the Colossus's moss green), or open and breathing light at the end.
  function drawGate(c, g, t) {
    const st = Finale.stage(), x = g.x, y = g.y, DH = 170, PH = 215;
    c.save();
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath(); c.ellipse(x, y + 4, 220, 30, 0, 0, TAU); c.fill();
    if (st === 4) {
      c.fillStyle = "#1a0e06"; c.fillRect(x - 104, y - DH, 208, DH);
    } else {
      c.fillStyle = "#0a0f11"; c.fillRect(x - 104, y - DH, 208, DH);
      c.fillStyle = "#141c20"; c.fillRect(x - 100, y - DH + 4, 98, DH - 8); c.fillRect(x + 2, y - DH + 4, 98, DH - 8);
      c.strokeStyle = "#26333a"; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x - 96, y - DH + 30 + i * 38); c.lineTo(x + 96, y - DH + 30 + i * 38); c.stroke(); }
    }
    for (const sx of [-1, 1]) {
      const px = x + sx * 128;
      c.fillStyle = "#11181b"; c.fillRect(px - 26, y - PH, 52, PH);
      c.fillStyle = "#1e2a2f"; c.fillRect(px - 26, y - PH, 18, PH);
      c.fillStyle = "#2c3c43"; for (let i = 0; i < 4; i++) c.fillRect(px - 26, y - PH + 14 + i * 50, 52, 4);
      c.fillStyle = "#1c3326"; c.fillRect(px - 26 + sx * 8, y - 100, 14, 70);
    }
    // the lintel, broken at one end, with the three hollows
    c.fillStyle = "#0e1417"; c.fillRect(x - 175, y - PH - 34, 330, 40);
    c.fillStyle = "#24323a"; c.fillRect(x - 175, y - PH - 34, 330, 8);
    c.fillStyle = "#0e1417"; c.beginPath(); c.moveTo(x + 155, y - PH - 34); c.lineTo(x + 172, y - PH - 20); c.lineTo(x + 158, y - PH + 6); c.closePath(); c.fill();
    const cols = ["90,235,245", "220,40,60", "130,190,90"];
    for (let i = 0; i < 3; i++) {
      const hx = x - 52 + i * 52, hy = y - PH - 14;
      c.fillStyle = "#050809"; c.beginPath(); c.arc(hx, hy, 13, 0, TAU); c.fill();
      if (st >= 1) { c.fillStyle = `rgba(${cols[i]},${0.6 + 0.25 * Math.sin(t * 2 + i)})`; c.beginPath(); c.arc(hx, hy, 8, 0, TAU); c.fill(); }
    }
    c.restore();
  }
})(window.DL);
