/* Drowned Light — the finale: the Fire Bearer, the march to the Drowned Gate, and the Sunken King.
   Nothing of it shows until it's earned (the secrecy rule): Central Flame 5, the Starved Bell and the Deadly Rose slain,
   Derek won from the Colossus, and your Kindle lit. At the next dawn Kindle climbs into the Central Flame, drinks it in and
   rises as the Fire Bearer, a lantern as tall as a tower on four long legs. From the camp, by day, the host begins the march:
     the march  the Bearer walks for the Drowned Gate, far out in the Abyss, but only while a knight walks beside it. By day the
                Drowned climb out of the mud to drown its flame; at dusk it plants its legs wherever it is and makes camp
                (braziers round it, its light grows), and the night's waves come for it there. It heals some at dawn.
                Struck down, it gutters and falls back to its last camp, and rekindles at dawn. The Great Siege doesn't
                come for the camp while it's out: the Drowned hunt the Bearer instead.
     the gate   a round arch of black stone with three hollows round it, alone in the Abyss in a lake of black water, a
                causeway running out to it.
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
  // The black lake round the gate: a rounded box (1 at its shore), and the causeway that crosses it to the gate.
  const LK = GT.lake, CW = GT.causeway;
  const lakeD = (dx, dy) => Math.pow(Math.pow(Math.abs(dx / LK.rx), 4) + Math.pow(Math.abs((dy - LK.cy) / LK.ry), 4), 0.25);
  // No rocks or trees in the lake, on the causeway or in the arena.
  Finale.clears = function (x, y) {
    const g = Finale.gate(), a = arena(), dx = x - g.x, dy = y - g.y;
    return lakeD(dx, dy) < 1.1 || Math.hypot(x - a.x, y - a.y) < GT.clear || (Math.abs(dx) < CW + 90 && dy > 0 && dy < LK.cy + LK.ry + 420);
  };
  // Nobody wades the black water: out onto the causeway or back to the shore, whichever is nearer.
  Finale.collide = function (ent) {
    const g = Finale.gate(), dx = ent.x - g.x, dy = ent.y - g.y, ax = Math.abs(dx);
    if (ax >= LK.rx || Math.abs(dy - LK.cy) >= LK.ry) return;
    const d = lakeD(dx, dy);
    if (d >= 1 || (ax < CW && dy > 4)) return;
    let nx = g.x + dx / d, ny = g.y + LK.cy + (dy - LK.cy) / d, best = Math.hypot(nx - ent.x, ny - ent.y);
    if (dy > 4 && ax - CW < best) { nx = g.x + Math.sign(dx) * (CW - 0.5); ny = ent.y; }
    else if (dy <= 4 && ax < CW && 4 - dy < best) { nx = ent.x; ny = g.y + 4.5; }
    ent.x = nx; ent.y = ny;
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
    beam = { x1: b.x, y1: b.y - 70, x2: e.x + GK().heartX, y2: Finale.gate().y + GK().heart + kingDrop(e), t: 0, max: 0.9 };
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
    roarAt = now();
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
      const x = g.x + rand(-CW + 30, CW - 30), y = g.y + rand(30, 150); // up out of the cracks in the causeway
      G.enemies.push(G.makeEnemy(DL.weighted(DL.ZONES[4].pool), x, y, 4, { rise: 0.9, goal: b && !b.down ? b : null, fromKing: true }));
    }
    if (n > 0) for (let i = 0; i < 16; i++) G.puff(g.x + rand(-CW, CW), g.y + rand(30, 150), "rgba(60,200,210,0.6)", 60, 0.9, -30);
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
    deathAt = now();
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
    if (st === 0) toast("A gate of black stone stands alone in a lake of black water, taller than any tree, a causeway running out to it. Black water falls in its arch like a curtain. Three hollows are carved round the arch, and on the causeway lies a cold hearth as wide as a house.", "warn");
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
    if (st === 0) return Finale.found() ? `A sealed gate of black stone stands in the Abyss, ${w.m} m ${w.dir} of camp, out in a black lake. Three hollows are carved round its arch.` : "";
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
    if (G.cave || (Finale.stage() !== 3 && !(Finale.stage() === 4 && now() - deathAt < 6))) return null; // and while he sinks
    const a = arena(), g = Finale.gate();
    return dist(p.x, p.y, a.x, a.y) < GT.arenaR + 450 ? { need: GT.view, needW: GT.viewW, x: g.x, y: g.y - 780 } : null;
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
    // the gate's fire bowls and the causeway's torches never go out
    const cam = G.camera;
    if (cam && Math.abs(cam.x - g.x) < 2200 && Math.abs(cam.y - g.y) < 2200) {
      for (const sx of [-1, 1]) {
        L.push({ x: g.x + sx * bowlX(), y: g.y - 255, r: 210, s: 0.7, col: "255,160,70", a: 0.75, flick: 1 });
        for (const ty of TORCHES) L.push({ x: g.x + sx * (CW + 16), y: g.y + ty - (DL.Art.sprites.fnPost ? 95 : 70), r: 150, s: 0.6, col: "255,160,70", a: 0.7, flick: 1 });
      }
    }
    const e = Finale.king();
    if (e) {
      // a cold sheen off the black water lights him from below, so he looms out of the dark
      const k = kingRise(e);
      L.push({ x: g.x, y: g.y - 400, r: 820 * (0.4 + 0.6 * k), s: 0.75 * k, col: "70,230,240", a: 0.5 * k });
      if (Finale.isOpen(e)) L.push({ x: g.x + GK().heartX, y: g.y + GK().heart + kingDrop(e), r: 260, s: 0.8, col: "255,120,40", a: 0.9, flick: 1 });
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
    if (net.stage === 4 && was !== 4 && seen !== 4) { winAt = now() + 8; deathAt = now(); }
    const r = m[1];
    if (r) {
      const b = Finale.b || (Finale.b = { kind: "bearer", x: r[0], y: r[1], rad: 34, animT: 0, hitT: 0 });
      Object.assign(b, { tx: r[0], ty: r[1], hp: r[2], max: r[3], down: !!(r[4] & 1), camp: !!(r[4] & 2), moving: !!(r[4] & 4), angle: r[5], lit: !(r[4] & 1),
        leave: r[7] >= 0 ? r[7] : null, grow: r[8] });
      net.charge = r[6];
    } else Finale.b = null;
    const ph = net.phase;
    net.kingId = m[2] ? m[2][0] : 0; net.open = m[2] ? m[2][1] : 0; net.phase = m[2] ? m[2][2] : 0;
    if (net.phase > ph) roarAt = now();
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
  // Laid out after Robert's concept (art-prompts/kit-refs/sunken-king-concept.png): a causeway across a black lake to a
  // round-arched gate with fire bowls, ruins standing in the water, and the King rising behind the gate, his arms reaching
  // round both sides so his hands rest in the water beside the causeway. It's all drawn in code until the drawings come,
  // through coarse buffers (P world px to the pixel) so it comes out in the same chunky pixels as the sprites.
  const P = 3;
  const KG = { water: -70, heart: -340, eyes: -505, eyeDx: 30, elbow: 590, elbowY: -300, rest: 450, restY: 40, bowl: 152, drop: 880, lift: 72 }; // lift: how far his whole body stands above where it's painted
  KG.heartX = 0;
  // Robert's drawn King (2026-10-28, cut by tools/cut_ai_sprites.py into props/fnKing*, fnHand*, fnGate*) stands farther
  // back: his body is cut off at the belly, drawn at `scale` × its file size, its bottom edge `water` px off the gate.
  const DKG = { water: -205, heart: -358, heartX: 24, eyes: -560, eyeDx: 22, elbow: 360, elbowY: -230, rest: 450, restY: 40, drop: 620, lift: 0, scale: 2 };
  const kingArt = () => !!DL.Art.sprites.fnKingStill;
  const gateArt = () => !!DL.Art.sprites.fnGate1;
  const GK = () => (kingArt() ? DKG : KG);
  const bowlX = () => (gateArt() ? 124 : KG.bowl); // the gate's fire bowls
  // a drawn sprite, `k` world px per file px, anchored at (ax, ay) of its size, mirrored if asked
  function spr(c, n, x, y, k, flip, ax, ay) {
    const s = DL.Art.sprites[n];
    if (!s) return false;
    const w = Math.round(s.w * s.res * k), h = Math.round(s.h * s.res * k), sm = c.imageSmoothingEnabled;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (flip) c.scale(-1, 1);
    c.imageSmoothingEnabled = false;
    c.drawImage(s.c, Math.round(-w * (ax == null ? 0.5 : ax)), Math.round(-h * (ay == null ? 1 : ay)), w, h);
    c.imageSmoothingEnabled = sm;
    c.restore();
    return true;
  }
  const TORCHES = [190, 540]; // the causeway's torch posts, px south of the gate
  const CYAN = "90,235,245";
  const C = { ink: "#05080a", s0: "#111719", s1: "#1b2326", s2: "#283337", s3: "#3a484d", s4: "#566a70",
    gold0: "#5a4318", gold1: "#9a7530", gold2: "#d6ad55", gold3: "#f3dc93", weed0: "#1d3a22", weed1: "#2f5a2e", weed2: "#4f8a3a",
    bone0: "#8d8466", bone1: "#d6cfae", bone2: "#f2edd6", cyan0: "#0f5d66", cyan1: "#2fb9c6", cyan2: "#7ff4fa", cyan3: "#e2ffff",
    water0: "#03080a", water1: "#071316", water2: "#0f272b", red0: "#3a0c12", red1: "#6e1a24", red2: "#93283a" };
  const H = (a, b, c2) => DL.hash(97, a, b * 31 + (c2 || 0));
  const HOLLOWS = [[-103, -237, "90,235,245"], [0, -285, "220,40,60"], [103, -237, "130,190,90"]]; // the Bell, the Rose, the Colossus
  // ruins in the lake: [x, y, scale, how deep it's sunk] and broken arches: [x, y, span, broken]
  const RUINS = [[-720, -560, 1, 0], [-540, -650, 0.8, 0.3], [-780, -330, 0.9, 0.4], [-690, -120, 1.05, 0], [-760, 160, 0.9, 0.3],
    [680, -590, 0.85, 0.2], [520, -660, 0.75, 0], [780, -360, 1, 0], [700, -110, 0.95, 0.4], [760, 190, 0.85, 0], [-330, -700, 0.7, 0.45], [330, -680, 0.7, 0.2]];
  const ARCHES = [[-640, -430, 150, 0], [600, -470, 140, 1]];
  // the same out of Robert's drawn ruins (props/fnRuinA1-4, B1-4: arch, broken arch, tall pillar, stump): [x, y, name, mirrored]
  const DRUINS = [[-640, -430, "fnRuinA1", 0], [600, -470, "fnRuinB2", 1], [-330, -700, "fnRuinB1", 0], [330, -690, "fnRuinA2", 0],
    [-720, -600, "fnRuinB3", 0], [-520, -660, "fnRuinA4", 1], [-780, -290, "fnRuinA3", 0], [-690, -90, "fnRuinB4", 0], [-760, 170, "fnRuinB3", 1],
    [700, -620, "fnRuinA3", 1], [520, -680, "fnRuinB4", 1], [780, -290, "fnRuinB3", 1], [700, -90, "fnRuinA4", 0], [760, 190, "fnRuinA4", 1]];
  // the causeway's low broken walls, their posts and torches
  const WALLS = [];
  for (const sx of [-1, 1]) {
    for (let i = 0, y = 24; y < 720; i++) {
      const len = 40 + Math.floor(H(i, sx > 0 ? 5 : 6) * 30);
      if (H(i, sx > 0 ? 7 : 8) > 0.2) WALLS.push({ x: sx * (CW + 16), y: y + len, len, h: 16 + Math.floor(H(i, 10 + sx) * 3) * 4 });
      y += len + 4;
    }
    for (const py of [24, 370, 720]) WALLS.push({ x: sx * (CW + 16), y: py, post: true });
    for (const ty of TORCHES) WALLS.push({ x: sx * (CW + 16), y: ty, torch: true });
  }
  // the same out of Robert's drawn wall and fire-bowl post (props/fnWall, fnPost): a stretch of wall every 46 px, gaps where
  // it's tumbled down, a post with its fire at each torch and at the far end
  const DWALLS = [];
  for (const sx of [-1, 1]) {
    for (let i = 0, y = 40; y < 700; i++, y += 46) {
      if (H(i, sx > 0 ? 17 : 18) < 0.14 && !TORCHES.some((ty) => Math.abs(ty - y) < 70)) continue;
      DWALLS.push({ x: sx * (CW + 18), y, drawn: "fnWall" });
    }
    for (const ty of [...TORCHES, 720]) DWALLS.push({ x: sx * (CW + 18), y: ty + 6, drawn: "fnPost" });
  }

  // Coarse buffers: paint in world (or gate-local) coordinates at 1/P scale, then stamp them back up unsmoothed.
  const bufs = {};
  function buf(key, w, h) {
    let b = bufs[key];
    if (!b) { b = bufs[key] = document.createElement("canvas"); b.g = b.getContext("2d", { willReadFrequently: true }); }
    const bw = Math.ceil(w / P) + 1, bh = Math.ceil(h / P) + 1;
    if (b.width !== bw || b.height !== bh) { b.width = bw; b.height = bh; } else { b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.clearRect(0, 0, bw, bh); }
    return b;
  }
  // hard edges, like the drawn sprites (no soft half-see-through rims)
  function crisp(b) {
    const d = b.g.getImageData(0, 0, b.width, b.height), a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] < 110 ? 0 : 255;
    b.g.putImageData(d, 0, 0);
  }
  function paint(b, x0, y0, fn, hard) {
    b.g.setTransform(1 / P, 0, 0, 1 / P, -x0 / P, -y0 / P);
    fn(b.g);
    b.g.setTransform(1, 0, 0, 1, 0, 0);
    if (hard) crisp(b);
  }
  function stamp(c, b, x, y) {
    const sm = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    c.drawImage(b, Math.round(x), Math.round(y), b.width * P, b.height * P);
    c.imageSmoothingEnabled = sm;
  }
  // painted fresh every frame (the hands, the heart)
  function pix(c, key, x0, y0, w, h, fn) {
    x0 = Math.floor(x0 / P) * P; y0 = Math.floor(y0 / P) * P;
    const b = buf(key, w, h);
    paint(b, x0, y0, fn, true);
    stamp(c, b, x0, y0);
  }
  // painted once, round the gate (gate-local coordinates)
  const done = {};
  function cached(key, x0, y0, w, h, fn, hard) {
    if (!done[key]) { const b = buf(key, w, h); paint(b, x0, y0, fn, hard); done[key] = b; }
    return done[key];
  }

  // a few drawing helpers
  function poly(g, pts, fill, outline) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (outline) { g.strokeStyle = C.ink; g.lineWidth = outline; g.lineJoin = "round"; g.stroke(); }
    g.fillStyle = fill; g.fill();
  }
  function oval(g, x, y, rx, ry, fill, outline) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (outline) { g.strokeStyle = C.ink; g.lineWidth = outline; g.stroke(); }
    g.fillStyle = fill; g.fill();
  }
  function line(g, x1, y1, x2, y2, col, w) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  // a strand of waterweed hanging off him, a bead of water at its tip
  function strand(g, x, y, len, w, col, seed) {
    const amp = 6 + (seed % 5) * 3;
    const path = () => {
      g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(seed * 7 + k * 1.1) * amp * (k / 8), y + (len * k) / 8);
    };
    g.lineCap = "round"; g.lineJoin = "round";
    path(); g.strokeStyle = C.ink; g.lineWidth = w + 5; g.stroke();
    path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
    if (seed % 3 === 0) { g.fillStyle = C.cyan1; g.fillRect(x + Math.sin(seed * 7 + 7.8) * 7 - 2, y + len + 2, 4, 8); }
  }
  function barnacles(g, x, y, n, seed) {
    for (let i = 0; i < n; i++) {
      const bx = x + (H(seed, 60, i) - 0.5) * 50, by = y + (H(seed, 61, i) - 0.5) * 30, r = 5 + H(seed, 62, i) * 5;
      oval(g, bx, by, r, r * 0.8, C.bone0, 3);
      oval(g, bx - 1, by - 1, r * 0.55, r * 0.45, C.bone1);
      oval(g, bx, by, 2, 2, C.ink);
    }
  }
  // a great stone limb from (ax, ay) to (bx, by), lit along its top, bound with stone bracers and hung with weed
  function limb(g, ax, ay, bx, by, wa, wb, seed) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (ny > 0) { nx = -nx; ny = -ny; }
    oval(g, ax, ay, wa, wa * 0.92, C.s1, 6);
    poly(g, [[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]], C.s1, 6);
    oval(g, ax, ay, wa - 3, wa * 0.92 - 3, C.s1);
    poly(g, [[ax + nx * wa * 0.9, ay + ny * wa * 0.9], [bx + nx * wb * 0.9, by + ny * wb * 0.9], [bx + nx * wb * 0.3, by + ny * wb * 0.3], [ax + nx * wa * 0.3, ay + ny * wa * 0.3]], C.s2);
    line(g, ax + nx * (wa - 10), ay + ny * (wa - 10), bx + nx * (wb - 10), by + ny * (wb - 10), C.s3, 5);
    for (let i = 0; i < 18; i++) {
      const f = H(seed, 63, i), s = (H(seed, 64, i) - 0.5) * 1.6, w = wa + (wb - wa) * f;
      g.fillStyle = i % 3 ? C.s0 : C.s3;
      g.fillRect(ax + dx * f + nx * w * s, ay + dy * f + ny * w * s, 10 + H(seed, 65, i) * 14, 4);
    }
    for (const f of [0.3, 0.58, 0.84]) {
      const px = ax + dx * f, py = ay + dy * f, w = wa + (wb - wa) * f + 4;
      line(g, px + nx * w, py + ny * w, px - nx * w, py - ny * w, C.ink, 22);
      line(g, px + nx * w, py + ny * w, px - nx * w, py - ny * w, C.s0, 15);
      line(g, px + nx * w * 0.8, py + ny * w * 0.8, px - nx * w * 0.8, py - ny * w * 0.8, C.gold0, 3);
    }
    barnacles(g, ax + dx * 0.18 + nx * wa * 0.4, ay + dy * 0.18 + ny * wa * 0.4, 6, seed);
    barnacles(g, ax + dx * 0.7 - nx * wb * 0.3, ay + dy * 0.7 - ny * wb * 0.3, 4, seed + 1);
    for (let i = 0; i < 8; i++) {
      const f = 0.05 + i * 0.12, px = ax + dx * f + nx * (wa + (wb - wa) * f) * 0.8, py = ay + dy * f + ny * (wa + (wb - wa) * f) * 0.8;
      strand(g, px, py, 50 + H(seed, 66, i) * 130, 7 + (i % 2) * 3, [C.weed0, C.weed1, C.weed2][i % 3], seed * 11 + i);
    }
  }

  // On the ground: the black lake, its muddy shore, the causeway's flagstones, and the hearth the Bearer plants on.
  const lakePath = (g, s, cx, cy) => {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * TAU, cs = Math.cos(th), sn = Math.sin(th);
      const x = cx + s * LK.rx * Math.sign(cs) * Math.sqrt(Math.abs(cs)), y = cy + LK.cy + s * LK.ry * Math.sign(sn) * Math.sqrt(Math.abs(sn));
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  };
  function paintGround(g) {
    lakePath(g, 1, 0, 0); g.fillStyle = C.water1; g.fill();
    lakePath(g, 0.8, 0, -30); g.fillStyle = C.water0; g.fill();
    for (let i = 0; i < 320; i++) {
      const x = (H(i, 1) - 0.5) * 2 * LK.rx, y = LK.cy + (H(i, 2) - 0.5) * 2 * LK.ry;
      if (lakeD(x, y) > 0.96) continue;
      g.fillStyle = H(i, 3) < 0.75 ? C.water2 : "#16363b";
      g.fillRect(Math.round(x), Math.round(y), 9 + Math.round(H(i, 4) * 27), 3);
    }
    lakePath(g, 1, 0, 0); g.strokeStyle = "#0a0e0d"; g.lineWidth = 22; g.stroke();
    for (let i = 0; i < 150; i++) {
      const th = (i / 150) * TAU, cs = Math.cos(th), sn = Math.sin(th), r = 1 + (H(i, 6) - 0.5) * 0.04;
      const x = r * LK.rx * Math.sign(cs) * Math.sqrt(Math.abs(cs)), y = LK.cy + r * LK.ry * Math.sign(sn) * Math.sqrt(Math.abs(sn)), s = 6 + H(i, 7) * 11;
      oval(g, x, y, s, s * 0.6, "#1a201f");
      oval(g, x - 2, y - 2, s * 0.55, s * 0.3, "#2b3331");
    }
    // the causeway, from the gate's step out past the shore
    const y1 = LK.cy + LK.ry + 360;
    g.fillStyle = C.ink; g.fillRect(-CW - 10, -12, (CW + 10) * 2, y1 + 12);
    for (let row = 0, y = -10; y < y1; row++, y += 34) {
      for (let j = 0, x = -CW - 8 - (row % 2) * 30; x < CW + 8; j++) {
        const w = 50 + Math.round(H(row, 40, j) * 40), x0 = Math.max(x, -CW - 8), x1 = Math.min(x + w, CW + 8), v = H(row, 41, j);
        g.fillStyle = v < 0.33 ? C.s1 : v < 0.75 ? "#20292c" : C.s2;
        g.fillRect(x0 + 2, y + 2, x1 - x0 - 4, 30);
        g.fillStyle = "#2f3a3e"; g.fillRect(x0 + 2, y + 2, x1 - x0 - 4, 3);
        if (H(row, 42, j) < 0.12) { g.fillStyle = C.weed0; g.fillRect(x0 + 6, y + 18, 14, 8); }
        if (H(row, 43, j) < 0.16) {
          g.strokeStyle = C.ink; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x0 + 8, y + 6); g.lineTo(x0 + 20, y + 16); g.lineTo(x0 + 14, y + 28); g.stroke();
        }
        x += w;
      }
    }
    // its far end sinks into the mud
    g.globalCompositeOperation = "destination-out";
    const gr = g.createLinearGradient(0, y1 - 300, 0, y1);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = gr; g.fillRect(-CW - 20, y1 - 300, (CW + 20) * 2, 320);
    g.globalCompositeOperation = "source-over";
  }
  // Robert asked (2026-10-28) for the game's own drawn ground here: the deep-water texture for the lake and the camp's
  // flagstones for the causeway, darkened. Painted once at full size when both have loaded; the coded ground until then.
  let tgCanvas = null;
  function texturedGround() {
    if (tgCanvas) return tgCanvas;
    const W = DL.World.canvases, deep = W.deep, flags = W.campFlags;
    if (!deep || !flags) return null;
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = 1720; cv.height = 1560;
    g.translate(860, 760);
    const pat = (img) => { const q = g.createPattern(img, "repeat"); q.setTransform(new DOMMatrix().scale(2)); return q; };
    // the lake: deep water, darker still
    lakePath(g, 1, 0, 0); g.fillStyle = pat(deep); g.fill();
    g.fillStyle = "rgba(2,8,10,0.45)"; g.fill();
    lakePath(g, 0.8, 0, -30); g.fillStyle = "rgba(0,4,6,0.3)"; g.fill();
    // its muddy shore
    lakePath(g, 1, 0, 0); g.strokeStyle = "#0a0e0d"; g.lineWidth = 22; g.stroke();
    for (let i = 0; i < 150; i++) {
      const th = (i / 150) * TAU, cs = Math.cos(th), sn = Math.sin(th), r = 1 + (H(i, 6) - 0.5) * 0.04;
      const x = r * LK.rx * Math.sign(cs) * Math.sqrt(Math.abs(cs)), y = LK.cy + r * LK.ry * Math.sign(sn) * Math.sqrt(Math.abs(sn)), s = 6 + H(i, 7) * 11;
      oval(g, x, y, s, s * 0.6, "#1a201f");
      oval(g, x - 2, y - 2, s * 0.55, s * 0.3, "#2b3331");
    }
    // the causeway: flagstones, as dark as the ground round them, with a dark kerb
    const y1 = LK.cy + LK.ry + 360;
    g.fillStyle = C.ink; g.fillRect(-CW - 10, -12, (CW + 10) * 2, y1 + 12);
    g.fillStyle = pat(flags); g.fillRect(-CW - 6, -10, (CW + 6) * 2, y1 + 10);
    g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(-CW - 6, -10, (CW + 6) * 2, y1 + 10);
    // its far end sinks into the mud
    g.globalCompositeOperation = "destination-out";
    const gr = g.createLinearGradient(0, y1 - 300, 0, y1);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = gr; g.fillRect(-CW - 20, y1 - 300, (CW + 20) * 2, 320);
    return (tgCanvas = cv);
  }
  Finale.drawGround = function (c, view, t) {
    const g = Finale.gate(), p = plant();
    if (g.x + 880 < view.left || g.x - 880 > view.right || g.y - 780 > view.bottom || g.y + 820 < view.top) return;
    const tg = texturedGround();
    if (tg) c.drawImage(tg, g.x - 860, g.y - 760);
    else stamp(c, cached("ground", -860, -760, 1720, 1560, paintGround), g.x - 860, g.y - 760);
    c.save();
    // glints on the black water
    for (let i = 0; i < 50; i++) {
      const lx = (H(i, 31) - 0.5) * 1.9 * LK.rx, ly = LK.cy + (H(i, 32) - 0.5) * 1.9 * LK.ry, a = Math.sin(t * 1.3 + i * 2.1);
      if (a < 0.2 || lakeD(lx, ly) > 0.95 || (Math.abs(lx) < CW + 30 && ly > -10)) continue;
      c.fillStyle = `rgba(${CYAN},${0.2 * a})`;
      c.fillRect(Math.round(g.x + lx + Math.sin(t * 0.5 + i) * 6), Math.round(g.y + ly), 12 + Math.round(H(i, 33) * 22), 3);
    }
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

  // Into the y-sorted scene: the ruins, the causeway's walls, the King behind the gate, the gate, his hands, and the Bearer.
  Finale.push = function (list, c, t, view) {
    const g = Finale.gate(), b = Finale.b, e = Finale.king();
    if (g.x + 900 > view.left && g.x - 900 < view.right && g.y - 820 < view.bottom && g.y + 820 > view.top) {
      if (DL.Art.sprites.fnRuinA1) for (const r of DRUINS) list.push({ y: g.y + r[1], f: () => drawnRuin(c, g.x + r[0], g.y + r[1], r[2], r[3], t) });
      else {
        for (const r of RUINS) list.push({ y: g.y + r[1], f: () => drawRuin(c, g.x + r[0], g.y + r[1], r[2], r[3], t) });
        for (const a of ARCHES) list.push({ y: g.y + a[1], f: () => drawArch(c, g.x + a[0], g.y + a[1], a[2], a[3], t) });
      }
      for (const w of DL.Art.sprites.fnWall ? DWALLS : WALLS) list.push({ y: g.y + w.y, f: () => drawWall(c, g, w, t) });
      if (e) list.push({ y: g.y - 40, f: () => drawKing(c, e, t) });
      else if (kingArt() && now() - deathAt < 5) {
        // slain, he sinks
        const u = (now() - deathAt) / 5;
        list.push({ y: g.y - 40, f: () => drawDrawnKing(c, g, "fnKingDying", Math.round((u * u * DKG.drop) / P) * P, 1 - u, t) });
      }
      list.push({ y: g.y, f: () => drawGate(c, g, t) });
    }
    if (e && kingRise(e) > 0.6) for (const side of [-1, 1]) { const h = handAt(e, side); list.push({ y: h.y + 2, f: () => drawHand(c, e, h, side, t) }); }
    if (b && b.x > view.left - 300 && b.x < view.right + 300 && b.y > view.top - 80 && b.y < view.bottom + 900) list.push({ y: b.y, f: () => drawBearer(c, b, t) });
  };
  // Over the dark: the Bearer's fire, the King's eyes, face and heart, and the flame it hurls.
  Finale.glow = function (c, t, view) {
    const b = Finale.b, e = Finale.king(), g = Finale.gate();
    const blob = (x, y, r, inner, outer) => {
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (b && !b.down) {
      const s = bearerScale(b), x = b.x, y = b.y - (DL.Art.sprites.fbFront ? 24 : 15) * s, r = (16 + Math.sin(t * 7) * 2) * s;
      blob(x, y, r, "rgba(255,220,140,0.8)", "rgba(255,140,50,0)");
      const ch = G.isGuest() ? net.charge : b.charge;
      if (Finale.stage() === 3 && ch > 0) {
        // the flame it gathers: a ring that closes as it fills
        c.strokeStyle = `rgba(255,170,70,${0.4 + 0.5 * ch})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, r * 0.9 + 30 * (1 - ch), -Math.PI / 2, -Math.PI / 2 + TAU * ch); c.stroke();
      }
    }
    if (e) {
      const k = kingRise(e), dy = kingDrop(e) + bob(t), Q = GK(), top = g.y + Q.water, hx = g.x + Q.heartX;
      const ey = g.y + Q.eyes + dy, hy = g.y + Q.heart + dy;
      if (ey < top) {
        for (const sx of [-1, 1]) blob(g.x + sx * Q.eyeDx, ey, 26 + Math.sin(t * 3 + sx) * 3, `rgba(130,250,255,${0.9 * k})`, "rgba(60,220,230,0)");
        blob(g.x, ey + 20, 90, `rgba(${CYAN},${0.22 * k})`, `rgba(${CYAN},0)`);
      }
      if (hy < top) {
        if (Finale.isOpen(e)) blob(hx, hy, 64 + Math.sin(t * 9) * 6, "rgba(255,240,180,0.95)", "rgba(255,80,20,0)");
        else blob(hx, hy, 95, `rgba(${CYAN},${(0.3 + 0.12 * Math.sin(t * 2.2)) * k})`, `rgba(${CYAN},0)`);
      }
    }
    if (beam) {
      const k = Math.min(1, age(beam) / beam.max);
      for (let i = 0; i < 10; i++) {
        const u = Math.min(1, k * 1.8 - i * 0.06);
        if (u <= 0) continue;
        const x = beam.x1 + (beam.x2 - beam.x1) * u, y = beam.y1 + (beam.y2 - beam.y1) * u - Math.sin(Math.PI * u) * 120, r = 16 - i;
        blob(x, y, r * 2, `rgba(255,230,160,${0.95 * (1 - k * 0.5)})`, "rgba(255,120,40,0)");
      }
    }
    if (g.x > view.left - 400 && g.x < view.right + 400 && g.y - 300 < view.bottom && g.y + 100 > view.top) {
      for (const sx of [-1, 1]) blob(g.x + sx * bowlX(), g.y - (gateArt() ? 268 : 252), 46 + Math.sin(t * 8 + sx) * 4, "rgba(255,190,100,0.5)", "rgba(255,120,40,0)");
      if (Finale.stage() === 4 && gateArt()) blob(g.x, g.y - 110, 170 + Math.sin(t * 2) * 8, "rgba(255,210,130,0.45)", "rgba(255,170,80,0)");
      else if (Finale.stage() === 4) {
        const gr = c.createLinearGradient(0, g.y - 268, 0, g.y);
        gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(1, `rgba(255,200,120,${0.45 + 0.1 * Math.sin(t * 2)})`);
        c.save(); openingPath(c, g.x, g.y); c.clip();
        c.fillStyle = gr; c.fillRect(g.x - 120, g.y - 268, 240, 268);
        c.restore();
      }
    }
  };

  // How big the Bearer stands: growing out of the fire when it first rises, shrinking into the gate at the end.
  function bearerScale(b) {
    const grow = b.grow != null ? b.grow : 1, leave = b.leave != null ? b.leave : 0;
    return (1 + 3.4 * grow) * (1 - 0.75 * Math.max(0, leave - 0.5) * 2);
  }
  // Robert's drawn Fire Bearer (props/fb*): facing the way it walks, planted at night and at the gate, hurling its flame,
  // guttered out. `k` is its size (1 when grown).
  function drawnBearer(c, b, t, k) {
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
    let n = "fbFront", flip = false;
    if (b.down) n = "fbDown";
    else if (beam && age(beam) < beam.max) { n = "fbHurl"; flip = beam.x2 < b.x; }
    else if (b.camp || (Finale.stage() === 3 && !b.moving && b.leave == null)) n = "fbCamp";
    else if (b.moving && Math.abs(ca) > Math.abs(sa) * 1.2) { n = "fbSide"; flip = ca < 0; }
    else if (b.moving && sa < 0) n = "fbBack";
    const bob = b.moving ? Math.round(Math.abs(Math.sin(b.animT * 13)) * 3) : 0;
    spr(c, n, b.x, b.y - bob, k, flip);
  }
  function drawBearer(c, b, t) {
    const s = bearerScale(b);
    c.save();
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath(); c.ellipse(b.x, b.y, 12 * s, 4.4 * s, 0, 0, TAU); c.fill();
    if (b.hitT > 0) c.filter = "brightness(1.8)";
    if (DL.Art.sprites.fbFront) drawnBearer(c, b, t, s / 4.4);
    else DL.Render.kindleUnit(c, { x: b.x, y: b.y, angle: b.angle, moving: b.moving, animT: b.animT }, t, s, b.down);
    c.restore();
    // its health, while it's hurt
    if (b.hp < b.max && !b.down) {
      const w = 90, x = b.x - w / 2, y = b.y - 42 * s - 14;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = "#ffae52"; c.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 4);
    }
  }

  /* the ruins in the water: the old drawn pillar, darkened and sunk */
  let ruinArt = null;
  function ruin() {
    if (ruinArt) return ruinArt;
    const s = DL.Art.sprites.pillar;
    if (!s) return null;
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = s.c.width; cv.height = s.c.height;
    g.drawImage(s.c, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(8,20,26,0.55)"; g.fillRect(0, 0, cv.width, cv.height);
    return (ruinArt = { c: cv, w: s.w, h: s.h });
  }
  function ripple(c, x, y, w, t, seed) {
    c.fillStyle = "rgba(3,8,10,0.75)";
    c.beginPath(); c.ellipse(x, y, w * 0.45, w * 0.11, 0, 0, TAU); c.fill();
    const k = (t * 0.35 + seed) % 1;
    c.strokeStyle = `rgba(${CYAN},${0.3 * (1 - k)})`; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y, w * (0.4 + 0.5 * k), w * (0.1 + 0.12 * k), 0, 0, TAU); c.stroke();
  }
  // returns the y of its top
  function drawRuin(c, x, y, sc, sunk, t, dry) {
    const s = ruin(), w = (s ? s.w : 35) * 2 * sc, h = (s ? s.h : 53) * 2 * sc, sink = dry ? 0 : h * (0.18 + sunk);
    if (dry) { c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(x, y, w * 0.4, w * 0.12, 0, 0, TAU); c.fill(); }
    c.save();
    c.beginPath(); c.rect(x - w, y - h * 1.5, w * 2, h * 1.5 + (dry ? 4 : 0)); c.clip();
    if (s) c.drawImage(s.c, Math.round(x - w / 2), Math.round(y - h + sink), Math.round(w), Math.round(h));
    else { c.fillStyle = C.s2; c.fillRect(x - w * 0.3, y - h + sink, w * 0.6, h); }
    c.restore();
    if (!dry) ripple(c, x, y, w, t, H(x | 0, 70));
    return y - h + sink;
  }
  // a drawn ruin, its foot sunk in the black water
  function drawnRuin(c, x, y, name, flip, t) {
    const s = DL.Art.sprites[name];
    if (!s) return;
    const w = s.w * s.res, h = s.h * s.res;
    c.save();
    c.beginPath(); c.rect(x - w, y - h * 1.2, w * 2, h * 1.2); c.clip();
    spr(c, name, x, y + Math.round(h * 0.1), 1, !!flip);
    c.restore();
    if (w > 150) for (const sx of [-1, 1]) ripple(c, x + sx * w * 0.36, y, 90, t, H(x | 0, 72 + sx)); // an arch stands on two feet
    else ripple(c, x, y, w * 1.4, t, H(x | 0, 72));
  }
  function drawArch(c, x, y, span, broken, t) {
    const top = drawRuin(c, x - span / 2, y, 0.85, 0, t);
    drawRuin(c, x + span / 2, y, 0.85, broken ? 0.25 : 0, t);
    const cy = top + 12, r = span / 2, a1 = broken ? Math.PI * 1.55 : TAU;
    c.save();
    c.lineCap = "butt";
    c.strokeStyle = C.ink; c.lineWidth = 30; c.beginPath(); c.arc(x, cy, r, Math.PI, a1); c.stroke();
    c.strokeStyle = "#232c2b"; c.lineWidth = 24; c.beginPath(); c.arc(x, cy, r, Math.PI, a1); c.stroke();
    c.strokeStyle = "#3a4440"; c.lineWidth = 5; c.beginPath(); c.arc(x, cy, r + 8, Math.PI, a1); c.stroke();
    c.strokeStyle = C.ink; c.lineWidth = 3;
    for (let a = Math.PI + 0.3; a < a1 - 0.1; a += 0.3) { c.beginPath(); c.moveTo(x + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12)); c.lineTo(x + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12)); c.stroke(); }
    c.restore();
  }
  // a stretch of the causeway's low wall (its top, and its south face), a post, or a torch
  function drawWall(c, g, w, t) {
    const x = g.x + w.x, y = g.y + w.y;
    if (w.drawn) {
      c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 20, 6, 0, 0, TAU); c.fill();
      spr(c, w.drawn, x, y + 2, 1);
      return;
    }
    if (w.torch) {
      const s = DL.Art.sprites.torch;
      if (!s) return;
      const sw = s.w * 2, sh = s.h * 2;
      c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(x, y, 10, 4, 0, 0, TAU); c.fill();
      c.drawImage(s.c, Math.round(x - sw / 2), Math.round(y - sh + 2), sw, sh);
      DL.Art.drawFire(c, x, y + 10 - sh, 1.1, t);
      return;
    }
    if (w.post) { drawRuin(c, x, y, 0.42, 0, t, true); return; }
    const top = y - w.len - w.h;
    c.fillStyle = C.ink; c.fillRect(x - 14, top - 2, 28, w.len + w.h + 3);
    c.fillStyle = C.s3; c.fillRect(x - 12, top, 24, w.len);
    c.fillStyle = C.s4; c.fillRect(x - 12, top, 24, 3);
    c.fillStyle = C.s1; c.fillRect(x - 12, y - w.h, 24, w.h);
    c.fillStyle = C.s0; c.fillRect(x - 12, y - w.h + 6, 24, 2);
    if (w.len > 52) { c.fillStyle = C.ink; c.fillRect(x - 12, top + (w.len >> 1), 24, 2); }
    if (H(w.y, 71, w.x) < 0.4) { c.fillStyle = C.weed1; c.fillRect(x - 12 + ((w.y * 7) % 14), top + 4, 8, 5); }
  }

  /* the Sunken King */
  // How far he has risen out of the water (0 to 1), and how far below his full height he stands.
  function kingRise(e) { return e.rise > 0 ? clamp(1 - e.rise / K.rise, 0, 1) : 1; }
  function kingDrop(e) { const Q = GK(); return Math.round(((1 - kingRise(e)) * Q.drop + (Finale.isOpen(e) && Q === KG ? 27 : 0)) / P) * P - Q.lift; }
  const bob = (t) => Math.round(Math.sin(t * 0.9) * 1.4) * P; // his slow breathing
  // his back half: the hunched body, the black hollow of his chest, his upper arms out to the elbows
  function paintKingBack(g) {
    for (const s of [-1, 1]) limb(g, s * 290, -450, s * KG.elbow, KG.elbowY, 100, 92, s > 0 ? 3 : 4);
    const torso = [[-300, 80], [-335, -300], [-255, -475], [-120, -548], [120, -548], [255, -475], [335, -300], [300, 80]];
    poly(g, torso, C.s1, 7);
    g.save(); poly(g, torso, C.s1); g.clip();
    for (let row = 0, y = -540; y < 80; row++, y += 44) {
      g.fillStyle = C.s0; g.fillRect(-340, y, 680, 4);
      for (let x = -340 + (row % 2) * 40; x < 340; x += 80 + H(row, 80, x) * 30) g.fillRect(x, y, 4, 44);
      g.fillStyle = C.s2; g.fillRect(-300 + H(row, 81) * 500, y + 8, 40, 6);
    }
    g.restore();
    oval(g, 0, -350, 178, 142, "#060a0b", 6);
    oval(g, 0, -335, 150, 110, "#04211f");
    // water running down his front
    for (let i = 0; i < 16; i++) { const x = -260 + H(i, 82) * 520; g.fillStyle = "rgba(47,185,198,0.45)"; g.fillRect(x, -470 + H(i, 83) * 200, 3, 60 + H(i, 84) * 160); }
  }
  // his front half: ribs, shoulders, the drowned skull and its crown, and the weed hanging off it all
  function paintKingFront(g) {
    // ribs, caging the heart
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const y0 = -462 + i * 26, rib = () => { g.beginPath(); g.moveTo(s * (i < 2 ? 24 : 84 - i * 3), y0); g.quadraticCurveTo(s * (205 - i * 6), y0 - 30 + i * 6, s * (160 - i * 12), y0 + 120 - i * 4); };
      g.lineCap = "round";
      rib(); g.strokeStyle = C.ink; g.lineWidth = 25; g.stroke();
      rib(); g.strokeStyle = C.s2; g.lineWidth = 16; g.stroke();
      g.save(); g.translate(0, -4); rib(); g.strokeStyle = C.s3; g.lineWidth = 5; g.stroke(); g.restore();
    }
    poly(g, [[-16, -492], [16, -492], [12, -428], [-12, -428]], C.s2, 6);
    oval(g, 0, -478, 15, 15, C.gold1, 5); oval(g, -3, -481, 7, 7, C.gold2);
    // shoulders, great rounded plates of stone trimmed in old gold
    for (const s of [-1, 1]) {
      oval(g, s * 300, -485, 152, 108, C.s1, 7);
      g.save(); g.beginPath(); g.ellipse(s * 300, -485, 152, 108, 0, 0, TAU); g.clip();
      oval(g, s * 300 - s * 20, -522, 130, 72, C.s2);
      oval(g, s * 300 - s * 40, -556, 70, 18, C.s3);
      g.strokeStyle = C.s0; g.lineWidth = 4;
      for (let i = 0; i < 5; i++) { const a = s * 300 - 120 + i * 60; g.beginPath(); g.moveTo(a, -590); g.lineTo(a + 14, -520); g.lineTo(a - 6, -440); g.stroke(); }
      g.strokeStyle = C.gold1; g.lineWidth = 7; g.beginPath(); g.ellipse(s * 300, -470, 140, 96, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      for (let i = 0; i < 10; i++) { g.fillStyle = C.s1; g.fillRect(s * 300 - 140 + H(i, 85, s) * 260, -560 + H(i, 86, s) * 150, 18, 4); }
      g.restore();
      barnacles(g, s * 360, -520, 9, s > 0 ? 7 : 8);
      barnacles(g, s * 230, -430, 5, s > 0 ? 9 : 10);
    }
    // the hood of stone his skull hangs in
    oval(g, 0, -505, 108, 98, C.s1, 7);
    oval(g, -14, -540, 76, 50, C.s2);
    // the skull: cold cyan, burning eyes, a grin of glowing teeth
    poly(g, [[-62, -560], [62, -560], [70, -505], [52, -470], [44, -428], [-44, -428], [-52, -470], [-70, -505]], C.cyan0, 6);
    oval(g, -30, -488, 26, 18, C.cyan1); oval(g, 30, -488, 26, 18, C.cyan1);
    oval(g, 0, -545, 46, 14, C.cyan1);
    poly(g, [[-66, -548], [66, -548], [62, -526], [-62, -526]], C.s1, 4); // the brow
    for (const s of [-1, 1]) {
      oval(g, s * KG.eyeDx, KG.eyes, 20, 13, C.ink);
      oval(g, s * KG.eyeDx, KG.eyes, 12, 7, C.cyan2);
      oval(g, s * KG.eyeDx, KG.eyes, 5, 3, C.cyan3);
    }
    poly(g, [[-9, -486], [9, -486], [0, -468]], C.ink);
    g.fillStyle = C.ink; g.fillRect(-40, -462, 80, 34);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = C.cyan2; g.fillRect(-36 + i * 10.5, -460, 7, 13);
      g.fillStyle = C.cyan1; g.fillRect(-36 + i * 10.5, -444, 7, 13);
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(127,244,250,0.6)"; g.fillRect(-32 + i * 13, -428, 3, 14 + H(i, 87) * 40); }
    // the crown: a band of old gold and seven tall spires
    const sp = [62, 86, 108, 140, 108, 86, 62];
    for (let i = -3; i <= 3; i++) {
      const bx = i * 33, by = -572 + Math.abs(i) * 3, tip = by - sp[i + 3], tx = bx + i * 7;
      poly(g, [[bx - 15, by], [tx, tip], [bx + 15, by]], C.gold1, 6);
      poly(g, [[bx - 13, by], [tx, tip + 4], [bx - 1, by]], C.gold2);
      line(g, tx - 1, tip + 8, bx - 8, by - 6, C.gold3, 2);
      if (i > -3) poly(g, [[bx - 30, by + 2], [bx - 17, by - 34], [bx - 4, by + 2]], C.gold0, 4);
    }
    poly(g, [[-118, -584], [118, -584], [112, -552], [-112, -552]], C.gold1, 6);
    g.fillStyle = C.gold3; g.fillRect(-114, -583, 228, 4);
    g.fillStyle = C.gold0; g.fillRect(-112, -558, 224, 5);
    oval(g, 0, -569, 9, 10, C.red2, 4); oval(g, -60, -568, 7, 7, C.cyan1, 4); oval(g, 60, -568, 7, 7, C.cyan1, 4);
    // weed off his hood and shoulders, falling over his chest and arms
    for (let i = 0; i < 60; i++) {
      const x = -390 + H(i, 88) * 780;
      if (Math.abs(x) < 80) continue;
      const y = -565 + Math.min(1, Math.abs(x) / 380) * 90 + H(i, 89) * 40, len = 50 + H(i, 90) * H(i, 95) * 330;
      strand(g, x, y, len, 4 + (i % 3) * 2, i % 5 === 0 ? C.weed2 : i % 2 ? C.weed0 : C.weed1, i);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) strand(g, s * (72 + i * 9), -552 + i * 8, 70 + i * 22, 7, i % 2 ? C.weed1 : C.weed2, 50 + i + (s > 0 ? 10 : 0));
  }
  // His heart, between his back and his ribs: cracked cyan crystal, or burned open.
  function drawHeart(c, x, y, open, t) {
    pix(c, "heart", x - 110, y - 110, 220, 220, (g) => {
      if (open) {
        oval(g, x, y, 72, 64, "#3b1206", 5);
        oval(g, x, y, 44 + Math.sin(t * 9) * 4, 40, "#ff8a2a");
        oval(g, x, y - 4, 20, 18, "#ffe9a8");
        return;
      }
      const at = (pts) => pts.map(([a, b]) => [x + a * 1.35, y + b * 1.35]);
      poly(g, at([[0, -50], [22, -60], [46, -48], [56, -14], [36, 30], [0, 60], [-36, 30], [-56, -14], [-46, -48], [-22, -60]]), C.cyan0, 6);
      poly(g, at([[0, -38], [20, -48], [38, -38], [44, -12], [0, 40], [-44, -12], [-38, -38], [-20, -48]]), C.cyan1);
      poly(g, at([[-8, -30], [10, -36], [22, -14], [0, 14], [-20, -10]]), C.cyan2);
      g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2.2);
      g.strokeStyle = C.cyan3; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.moveTo(x - 50, y - 40); g.lineTo(x - 8, y - 6); g.lineTo(x - 26, y + 44); g.moveTo(x - 8, y - 6); g.lineTo(x + 40, y - 20); g.lineTo(x + 30, y + 34); g.moveTo(x + 4, y - 64); g.lineTo(x - 8, y - 6); g.stroke();
      g.globalAlpha = 1;
    });
    if (open) DL.Art.drawFire(c, x, y + 34, 2.4, t);
  }
  // Which drawing of him: roaring when he rises and when he's enraged, slumped with his heart burned open, or sinking.
  let roarAt = -9, deathAt = -99;
  function kingPose(e) { return Finale.isOpen(e) ? "fnKingOpen" : now() - roarAt < 1.8 ? "fnKingRoar" : "fnKingStill"; }
  function drawDrawnKing(c, g, pose, dy, k, t) {
    const wy = g.y + DKG.water;
    c.save();
    c.beginPath(); c.rect(g.x - 900, wy - 1700, 1800, 1700); c.clip(); // nothing of him below the water
    spr(c, pose, g.x, wy + dy, DKG.scale);
    for (let i = 0; i < 18; i++) {
      const x = g.x + (H(i, 91) - 0.5) * 800, y0 = wy - 420 + H(i, 92) * 300 + dy, ph = (t * 0.7 + H(i, 93)) % 1;
      c.fillStyle = `rgba(${CYAN},${0.7 * (1 - ph)})`;
      c.fillRect(Math.round(x), Math.round(y0 + ph * 160), 3, 9);
    }
    c.restore();
    c.save();
    c.fillStyle = `rgba(${CYAN},${(0.14 + 0.06 * Math.sin(t * 3)) * k})`;
    c.beginPath(); c.ellipse(g.x, wy + 4, 470, 34, 0, 0, TAU); c.fill();
    c.strokeStyle = `rgba(${CYAN},${0.35 * k})`; c.lineWidth = 3;
    for (let i = 0; i < 2; i++) { const q = (t * 0.3 + i / 2) % 1; c.globalAlpha = 1 - q; c.beginPath(); c.ellipse(g.x, wy + 6, 450 + 160 * q, 30 + 30 * q, 0, 0, TAU); c.stroke(); }
    c.restore();
  }
  function drawKing(c, e, t) {
    const g = Finale.gate(), k = kingRise(e), dy = kingDrop(e) + bob(t), wy = g.y + KG.water;
    if (kingArt()) {
      if (k >= 1 && !e.roared) { e.roared = true; roarAt = now(); } // up, he roars
      return drawDrawnKing(c, g, kingPose(e), dy, k, t);
    }
    const back = cached("kingB", -720, -800, 1440, 890, paintKingBack, true), front = cached("kingF", -720, -800, 1440, 890, paintKingFront, true);
    c.save();
    c.beginPath(); c.rect(g.x - 900, wy - 1700, 1800, 1700); c.clip(); // nothing of him below the water
    stamp(c, back, g.x - 720, g.y - 800 + dy);
    drawHeart(c, g.x, g.y + KG.heart + dy, Finale.isOpen(e), t);
    stamp(c, front, g.x - 720, g.y - 800 + dy);
    // water running off him
    for (let i = 0; i < 26; i++) {
      const x = g.x + (H(i, 91) - 0.5) * (i < 18 ? 640 : 1100), y0 = g.y - 470 + H(i, 92) * 260 + dy, ph = (t * 0.7 + H(i, 93)) % 1;
      c.fillStyle = `rgba(${CYAN},${0.75 * (1 - ph)})`;
      c.fillRect(Math.round(x), Math.round(y0 + ph * 160), 3, 9);
    }
    c.restore();
    // the water breaking round him
    c.save();
    c.fillStyle = `rgba(${CYAN},${(0.16 + 0.06 * Math.sin(t * 3)) * k})`;
    c.beginPath(); c.ellipse(g.x, wy + 4, 360, 30, 0, 0, TAU); c.fill();
    c.strokeStyle = `rgba(${CYAN},${0.35 * k})`; c.lineWidth = 3;
    for (let i = 0; i < 2; i++) { const q = (t * 0.3 + i / 2) % 1; c.globalAlpha = 1 - q; c.beginPath(); c.ellipse(g.x, wy + 6, 340 + 160 * q, 28 + 30 * q, 0, 0, TAU); c.stroke(); }
    c.restore();
  }
  // Where each hand is: resting in the water beside the causeway, raised over a knight, or sweeping the arena.
  function handAt(e, side) {
    const g = Finale.gate(), rest = { x: g.x + side * KG.rest, y: g.y + KG.restY, lift: 0, pose: "rest" }, k = kingRise(e);
    if (k < 1) { const u = clamp((k - 0.6) / 0.4, 0, 1); return { x: g.x + side * (560 - 110 * u), y: g.y - 60 + 100 * u, lift: 140 * Math.sin(Math.PI * u), pose: u < 0.5 ? "raised" : "rest" }; } // up out of the water
    const q = blows.find((o) => o.side === side && age(o) < o.delay + (o.kind === "sweep" ? 1.2 : 1));
    if (!q) return rest;
    const T = age(q);
    if (q.kind === "slam") {
      if (T < q.delay) {
        const u = T / q.delay, fly = Math.min(1, u * 2.5);
        const lift = u < 0.85 ? 260 * Math.min(1, u * 3) : 260 * (1 - (u - 0.85) / 0.15);
        return { x: rest.x + (q.x - rest.x) * fly, y: rest.y + (q.y - rest.y) * fly, lift, pose: u > 0.88 ? "slam" : "raised" };
      }
      const back = clamp((T - q.delay - 0.4) / 0.6, 0, 1);
      return { x: q.x + (rest.x - q.x) * back, y: q.y + (rest.y - q.y) * back, lift: Math.sin(Math.PI * back) * 80, pose: back > 0 ? "rest" : "slam" };
    }
    // the sweep: out to the far end of the lane, then across it, then home
    if (T < q.delay) { const u = Math.min(1, T / (q.delay * 0.6)); return { x: rest.x + (q.x - rest.x) * u, y: rest.y + (q.y - rest.y) * u, lift: 60 * Math.sin(Math.PI * u), pose: u < 1 ? "rest" : "sweep" }; }
    const u = clamp((T - q.delay) / 0.5, 0, 1);
    if (u < 1) return { x: q.x + (q.x2 - q.x) * u, y: q.y, lift: 0, pose: "sweep", dir: Math.sign(q.x2 - q.x) };
    const back = clamp((T - q.delay - 0.5) / 0.7, 0, 1);
    return { x: q.x2 + (rest.x - q.x2) * back, y: q.y + (rest.y - q.y) * back, lift: Math.sin(Math.PI * back) * 60, pose: "rest" };
  }
  // A great hand, palm down, its bone claws reaching for the causeway; (x, y) is where the claws touch.
  function paintHand(g, x, y0, side, lift) {
    const y = y0 - 20, spread = 0.16 + 0.14 * Math.min(1, lift / 200);
    // the thumb, on the causeway side
    const tx = x - side * 80, ty = y - 80, tdx = -side * 0.6, tdy = 0.8;
    line(g, tx, ty, tx + tdx * 60, ty + tdy * 60, C.ink, 40); line(g, tx, ty, tx + tdx * 60, ty + tdy * 60, C.s1, 32);
    claw(g, tx + tdx * 64, ty + tdy * 64, tdx, tdy);
    poly(g, [[x - 78, y - 150], [x + 78, y - 150], [x + 98, y - 70], [x + 74, y - 42], [x - 74, y - 42], [x - 98, y - 70]], C.s1, 7);
    poly(g, [[x - 70, y - 146], [x + 70, y - 146], [x + 84, y - 96], [x - 84, y - 96]], C.s2);
    for (let i = 0; i < 4; i++) {
      const kx = x + (i - 1.5) * 44, ky = y - 50 + Math.abs(i - 1.5) * 6, a = Math.PI / 2 + (i - 1.5) * spread - side * 0.12;
      const mx = kx + Math.cos(a) * 50, my = ky + Math.sin(a) * 50, a2 = a + (i < 2 ? 0.14 : -0.14), fx = mx + Math.cos(a2) * 42, fy = my + Math.sin(a2) * 42;
      line(g, kx, ky, mx, my, C.ink, 40); line(g, mx, my, fx, fy, C.ink, 34);
      line(g, kx, ky, mx, my, C.s1, 33); line(g, mx, my, fx, fy, C.s2, 27);
      line(g, mx - 12, my, mx + 12, my, C.s0, 4);
      oval(g, kx, ky - 4, 22, 17, C.s2, 5); oval(g, kx - 4, ky - 9, 10, 6, C.s3);
      claw(g, fx + Math.cos(a2) * 6, fy + Math.sin(a2) * 6, Math.cos(a2), Math.sin(a2));
    }
    barnacles(g, x + side * 40, y - 120, 6, side > 0 ? 12 : 13);
    for (let i = 0; i < 5; i++) strand(g, x - 70 + i * 34, y - 148, 40 + H(i, 94, side) * 60, 7, i % 2 ? C.weed1 : C.weed2, i * 3 + (side > 0 ? 1 : 2));
  }
  function claw(g, x, y, dx, dy) {
    const nx = -dy, ny = dx, L = 52, W = 12;
    poly(g, [[x + nx * W, y + ny * W], [x + dx * L + nx * 3, y + dy * L + ny * 3], [x - nx * W, y - ny * W]], C.bone1, 5);
    poly(g, [[x - nx * W, y - ny * W], [x + dx * L + nx * 2, y + dy * L + ny * 2], [x - nx * 2, y - ny * 2]], C.bone0);
    line(g, x + nx * 6, y + ny * 6, x + dx * L * 0.6 + nx * 4, y + dy * L * 0.6 + ny * 4, C.bone2, 3);
  }
  function drawHand(c, e, h, side, t) {
    const g = Finale.gate(), k = kingRise(e), dy = kingDrop(e) + bob(t);
    const ex = g.x + side * GK().elbow, ey = g.y + GK().elbowY + dy, hx = Math.round(h.x), hy = Math.round(h.y - h.lift);
    const wet = lakeD(h.x - g.x, h.y - g.y) < 1 && !(Math.abs(h.x - g.x) < CW && h.y > g.y + 4);
    c.save();
    c.globalAlpha = clamp((k - 0.4) / 0.6, 0, 1);
    if (wet) ripple(c, h.x, h.y + 10, 260, t, side > 0 ? 0.3 : 0.7);
    else { c.fillStyle = `rgba(0,0,0,${0.25 + 0.3 * Math.max(0, 1 - h.lift / 260)})`; c.beginPath(); c.ellipse(h.x, h.y + 4, 110, 30, 0, 0, TAU); c.fill(); }
    if (DL.Art.sprites.fnHandRest) drawnHand(c, h, side, ex, ey, hx, hy);
    else { const x0 = Math.min(ex, hx) - 170, y0 = Math.min(ey, hy - 150) - 120;
    pix(c, "hand" + side, x0, y0, Math.max(ex, hx) + 170 - x0, hy + 90 - y0, (q) => {
      limb(q, ex, ey, hx + side * 22, hy - 120, 92, 72, side > 0 ? 5 : 6);
      paintHand(q, hx, hy, side, h.lift);
    }); }
    // resting in the water, its claws sunk in it
    if (wet && h.lift < 12) {
      c.fillStyle = "rgba(5,14,17,0.55)";
      c.beginPath(); c.ellipse(h.x, h.y + 18, 130, 22, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(${CYAN},0.35)`; c.lineWidth = 2;
      c.beginPath(); c.ellipse(h.x, h.y + 14, 128, 20, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    }
    c.restore();
    if (Math.random() < 0.08) G.puff(hx + rand(-60, 60), hy - 40, `rgba(${CYAN},0.5)`, 20, 0.6, 30);
  }

  // Robert's drawn hand (a right hand; the left is it mirrored): resting, raised, slammed, sweeping. Each pose has the
  // point (fractions of its size) set where the claws touch, and where its forearm leaves the picture: a coded stone limb
  // joins that to his elbow.
  const HAND = { rest: ["fnHandRest", 0.5, 0.96, 0.5, 0.02], raised: ["fnHandRaised", 0.5, 0.6, 0.8, 0.98],
    slam: ["fnHandSlam", 0.5, 0.86, 0.5, 0.02], sweep: ["fnHandSweep", 0.62, 0.86, 0.04, 0.3] };
  // His forearm, from the elbow to the hand: the drawn forearm out of the resting hand's picture, laid along it end to end.
  let strip = null;
  function forearm(c, ex, ey, wx, wy) {
    const s = DL.Art.sprites.fnHandRest;
    if (!strip) {
      const fw = s.c.width, fh = s.c.height, cx = Math.round(fw * 0.33), cw = Math.round(fw * 0.34), ch = Math.round(fh * 0.34);
      strip = document.createElement("canvas"); strip.width = ch; strip.height = cw;
      const g = strip.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.translate(0, cw); g.rotate(-Math.PI / 2);
      g.drawImage(s.c, cx, 0, cw, ch, 0, 0, cw, ch);
      strip.k = (s.w * s.res) / fw; // world px per pixel of the picture
    }
    const L = Math.hypot(wx - ex, wy - ey), k = strip.k, len = strip.width * k - 4, W = strip.height * k, sm = c.imageSmoothingEnabled;
    c.save();
    c.translate(Math.round(ex), Math.round(ey)); c.rotate(Math.atan2(wy - ey, wx - ex));
    c.imageSmoothingEnabled = false;
    for (let d = 0; d < L; d += len) {
      const part = Math.min(len + 4, L - d + 4);
      c.drawImage(strip, 0, 0, part / k, strip.height, Math.round(d), Math.round(-W / 2), Math.round(part), Math.round(W));
    }
    c.imageSmoothingEnabled = sm;
    c.restore();
  }
  function drawnHand(c, h, side, ex, ey, hx, hy) {
    const H2 = HAND[h.pose] || HAND.rest, s = DL.Art.sprites[H2[0]], flip = h.pose === "sweep" ? (h.dir || side) < 0 : side < 0;
    if (!s) return;
    const w = s.w * s.res, ht = s.h * s.res, fx = flip ? 1 - H2[3] : H2[3], ax = flip ? 1 - H2[1] : H2[1];
    const wx = hx + (fx - ax) * w, wy = hy + (H2[4] - H2[2]) * ht + 20;
    if (Math.hypot(wx - ex, wy - ey) > 30) forearm(c, ex, ey, wx, wy);
    spr(c, H2[0], hx, hy, 1, flip, H2[1], H2[2]);
  }

  // The Drowned Gate: a round arch of black stone on two pillars with fire bowls, a red banner with a gold cross hanging in
  // it, and three hollows round the arch (lit once the Bearer has risen: the Bell's cold cyan, the Rose's red, the
  // Colossus's moss green). Sealed, black water falls in the arch like a curtain; open, it breathes golden light.
  function openingPath(c, x, y) {
    c.beginPath(); c.moveTo(x - 118, y); c.lineTo(x - 118, y - 150); c.arc(x, y - 150, 118, Math.PI, TAU); c.lineTo(x + 118, y); c.closePath();
  }
  function paintGate(g) {
    poly(g, [[-220, -8], [220, -8], [220, 14], [-220, 14]], C.s1, 5);
    g.fillStyle = C.s3; g.fillRect(-218, -8, 436, 4);
    // the arch's deep jambs
    g.fillStyle = C.s0; g.fillRect(-122, -150, 12, 150); g.fillRect(110, -150, 12, 150);
    for (const sx of [-1, 1]) {
      const px = sx * KG.bowl;
      poly(g, [[px - 40, -30], [px + 40, -30], [px + 40, -6], [px - 40, -6]], C.s2, 5);
      g.fillStyle = C.s3; g.fillRect(px - 38, -30, 76, 4);
      poly(g, [[px - 31, -205], [px + 31, -205], [px + 31, -30], [px - 31, -30]], C.s2, 5);
      g.fillStyle = C.s3; g.fillRect(px - 29, -205, 22, 175);
      g.fillStyle = C.s1; g.fillRect(px + 16, -205, 13, 175);
      g.fillStyle = C.s0; for (let y = -180; y < -30; y += 26) g.fillRect(px - 29, y, 58, 3);
      g.fillStyle = C.gold1; g.fillRect(px - 2, -186, 4, 140);
      poly(g, [[px, -132], [px + 9, -118], [px, -104], [px - 9, -118]], C.gold2, 3);
      g.fillStyle = C.weed1; g.fillRect(px + sx * 14 - 5, -110, 10, 66); g.fillStyle = C.weed2; g.fillRect(px + sx * 14 - 5, -110, 4, 40);
      poly(g, [[px - 40, -226], [px + 40, -226], [px + 40, -205], [px - 40, -205]], C.s3, 5);
      g.fillStyle = C.s4; g.fillRect(px - 38, -226, 76, 4);
      g.fillStyle = C.gold1; g.fillRect(px - 38, -212, 76, 3);
      // the fire bowl
      poly(g, [[px - 34, -246], [px + 34, -246], [px + 20, -228], [px - 20, -228]], "#2a2420", 5);
      g.fillStyle = C.gold1; g.fillRect(px - 34, -248, 68, 5);
      g.fillStyle = "#ff9a3a"; g.fillRect(px - 26, -252, 52, 4);
    }
    // the arch
    g.lineCap = "butt";
    g.strokeStyle = C.ink; g.lineWidth = 42; g.beginPath(); g.arc(0, -150, 135, Math.PI, TAU); g.stroke();
    g.strokeStyle = C.s2; g.lineWidth = 34; g.beginPath(); g.arc(0, -150, 135, Math.PI, TAU); g.stroke();
    g.strokeStyle = C.s3; g.lineWidth = 6; g.beginPath(); g.arc(0, -150, 147, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 3;
    for (let a = Math.PI + 0.22; a < TAU - 0.1; a += 0.24) { g.beginPath(); g.moveTo(Math.cos(a) * 118, -150 + Math.sin(a) * 118); g.lineTo(Math.cos(a) * 152, -150 + Math.sin(a) * 152); g.stroke(); }
    // the keystone, and the gold cross above it
    poly(g, [[-22, -268], [22, -268], [28, -308], [-28, -308]], C.s3, 5);
    poly(g, [[0, -324], [12, -312], [0, -300], [-12, -312]], C.gold1, 4);
    oval(g, 0, -312, 4, 4, C.gold3);
    // the three hollows
    for (const [hx, hy] of HOLLOWS) { oval(g, hx, hy, 11, 11, C.gold0, 5); oval(g, hx, hy, 8, 8, "#030607"); }
    // the banner, red with a gold cross, hanging in the arch
    g.fillStyle = C.gold1; g.fillRect(-34, -258, 68, 5);
    poly(g, [[-25, -254], [25, -254], [25, -72], [0, -92], [-25, -72]], C.red1, 5);
    poly(g, [[-25, -254], [-17, -254], [-17, -78], [-25, -72]], C.red2);
    poly(g, [[17, -254], [25, -254], [25, -72], [17, -79]], C.red0);
    g.fillStyle = C.gold1; g.fillRect(-25, -246, 50, 3);
    g.fillStyle = C.gold2; g.fillRect(-3, -226, 6, 78); g.fillRect(-17, -202, 34, 6);
    g.fillStyle = C.gold3; g.fillRect(-3, -226, 2, 78);
    oval(g, 0, -199, 7, 7, C.gold2, 3);
    for (const [a, b] of [[0, -230], [0, -146], [-20, -199], [20, -199]]) poly(g, [[a, b - 5], [a + 5, b], [a, b + 5], [a - 5, b]], C.gold2);
  }
  // Robert's drawn gate: sealed, its hollows lit (from the Bearer's rising), and open.
  function drawGate(c, g, t) {
    const st = Finale.stage(), x = g.x, y = g.y;
    if (gateArt()) {
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.beginPath(); c.ellipse(x, y + 6, 200, 26, 0, 0, TAU); c.fill();
      spr(c, st === 4 ? "fnGate3" : st >= 1 ? "fnGate2" : "fnGate1", x, y + 6, 1);
      return kingBar(c, x, y);
    }
    c.save();
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath(); c.ellipse(x, y + 8, 240, 28, 0, 0, TAU); c.fill();
    openingPath(c, x, y); c.clip();
    if (st === 4) { c.fillStyle = "#3a2210"; c.fillRect(x - 120, y - 270, 240, 270); }
    else {
      c.fillStyle = "rgba(4,14,17,0.62)"; c.fillRect(x - 120, y - 270, 240, 270);
      c.fillStyle = `rgba(${CYAN},0.28)`;
      for (let i = 0; i < 16; i++) {
        const sx = x - 112 + i * 15, sp = 70 + H(i, 21) * 60, len = 30 + Math.round(H(i, 22) * 40);
        for (let j = 0; j < 2; j++) c.fillRect(sx, Math.round(y - 270 + ((t * sp + H(i, 23 + j) * 300) % 300)), 3, len);
      }
    }
    c.restore();
    stamp(c, cached("gate", -240, -345, 480, 370, paintGate, true), x - 240, y - 345);
    if (st >= 1) for (const [hx, hy, col] of HOLLOWS) {
      c.fillStyle = `rgba(${col},${0.65 + 0.25 * Math.sin(t * 2 + hx)})`;
      c.beginPath(); c.arc(x + hx, y + hy, 7, 0, TAU); c.fill();
    }
    for (const sx of [-1, 1]) DL.Art.drawFire(c, x + sx * KG.bowl, y - 246, 2.3, t);
    kingBar(c, x, y);
  }
  // his health, on the gate's step
  function kingBar(c, x, y) {
    const e = Finale.king();
    if (e && (e.hp < e.maxHp || Finale.isOpen(e))) {
      const w = 300, bx = x - w / 2, by = y + 22;
      c.fillStyle = "rgba(0,0,0,0.75)"; c.fillRect(bx - 2, by - 2, w + 4, 10);
      c.fillStyle = Finale.isOpen(e) ? "#ffae52" : "#7ff6ff"; c.fillRect(bx, by, w * clamp(e.hp / e.maxHp, 0, 1), 6);
      c.fillStyle = "#000";
      for (const q of K.phases) c.fillRect(bx + w * q - 1, by - 2, 2, 10);
    }
  }
})(window.DL);
