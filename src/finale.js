/* Drowned Light — the Spark Bearer and the Portal Hall (Robert, 2026-11-10; it replaced the Fire Bearer, the Drowned
   Gate and the Sunken King).
   Nothing of it shows until it's earned (the secrecy rule): Central Flame DL.FINALE.flame, the Starved Bell and the
   Deadly Rose slain, Derek won, and your Kindle lit (Finale.ready). At the next dawn Kindle climbs into the Central Flame
   and drinks it in, and a spark catches in him: he stands up as the Spark Bearer, and beside the Flame stone steps open
   in the ground, the stair down to the Portal Hall.
     the hall     eight-sided, far off the map (DL.FINALE.hall), with a portal on each of its eight walls and the stair up
                  to the camp at its south corner. G.cave is set while the party is down there (`hall: true`), so the
                  world's clock, its spawns and its bosses leave it alone, just as in Derek's Hollow (src/cave.js).
     the defense  walk down with the Bearer waiting and he climbs onto the dais at the hall's heart to fill it with his
                  spark. The Drowned pour out of the eight dark portals at him (the Sunken King's Tide Stalkers, Sunken
                  Wisps and Tide Leeches among them) while the knights hold them off. Struck down he loses part of his
                  spark and gets up again. If every knight is down at once the hall casts the party out and the stair
                  stays shut until the next dawn.
     lit          the spark full, Kindle comes back off the dais, small again, the first portal (the Abyssal Spires)
                  opens and the victory screen shows. Each later portal opens when the dungeon behind the one before it
                  is cleared (Finale.cleared, G.save.dungeons). Walk into a lit portal and the party goes in
                  (DL.Rift.go); a dark one shows "???" until it wakes.
   The host runs it all; guests follow its snapshots (Finale.snap) and "hall" messages. The hall, its portals and the
   stair are stand-ins drawn in code (and Robert's Rift Portal picture) until his concept art is drawn; the Bearer is his
   drawn Fire Bearer for now. Numbers: DL.FINALE (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU, clamp } = DL;
  const G = DL.Game, F = DL.FINALE, HL = F.hall;
  const toast = (m, k) => DL.UI && DL.UI.toast(m, k);
  const say = (m, k) => { toast(m, k); DL.Net.say(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const Finale = (DL.Finale = { b: null });
  const SPARK = "255,205,120";
  const now = () => performance.now() / 1000;
  let net = { stage: 0, charge: 0, mask: 0 }, seen = -1, winAt = 0;

  /* ---------------- state ---------------- */
  // stage: 0 nothing yet (all secret), 1 the Bearer waits by the stair, 4 the hall is lit (old worlds' 2 and 3, the
  // march and the gate, go back to 1)
  const S = () => G.save.finale;
  Finale.stage = () => (G.isGuest() ? net.stage : S().stage);
  // while Kindle is the Bearer, the host's Kindle isn't at their heel (src/kindle.js)
  Finale.bearing = () => !G.isGuest() && S().stage === 1;
  Finale.ready = () => (G.save.up.flame || 0) >= F.flame && !!G.save.trophies.bell && !!G.save.trophies.rose && !!G.save.golem && !!G.save.kindle.lit;
  Finale.won = () => Finale.stage() === 4;
  Finale.sealed = () => S().fail === G.save.nights;
  const inHallNow = () => !!(G.cave && G.cave.hall);
  const defending = () => inHallNow() && G.cave.mode === "defend";

  /* ---------------- the dungeons behind the portals ---------------- */
  // A dungeon's boss beaten: it's cleared for good (from src/riftthrone.js, src/minebosses.js). Old worlds count too.
  Finale.cleared = function (id) {
    if (G.isGuest()) return;
    const d = (G.save.dungeons = G.save.dungeons || {});
    if (d[id]) return;
    d[id] = 1;
    G.persist();
    const i = F.portals.findIndex((q) => q && q.id === id);
    if (i >= 0 && Finale.won() && portalLit(i + 1)) setTimeout(() => say("Far below the camp, another portal in the Portal Hall wakes.", "good"), 4000);
  };
  Finale.isCleared = (id) => !!(G.save.dungeons || {})[id] || (id === "spires" && G.save.riftlord > 0) || (id === "mines" && G.save.sovereign > 0);
  // Portal `i` is open: the hall is lit, the dungeon behind it is built (and open), and the one before it is cleared
  // (the Sandbox opens every built one)
  function portalLit(i) {
    const q = F.portals[i];
    if (!q || S().stage !== 4) return false;
    const d = DL.Rift.DUNGEONS.find((x) => x.id === q.id);
    if (!d || (d.open && !d.open())) return false;
    return DL.SANDBOX || i === 0 || (F.portals[i - 1] && Finale.isCleared(F.portals[i - 1].id));
  }
  Finale.portalLit = (i) => (G.isGuest() ? !!(net.mask & (1 << i)) : portalLit(i));
  const litCount = () => F.portals.reduce((n, q, i) => n + (Finale.portalLit(i) ? 1 : 0), 0);

  /* ---------------- where things are ---------------- */
  const HX = HL.x, HY = HL.y, R = HL.r, AP = R * Math.cos(Math.PI / 8); // AP: from the heart to the middle of each wall
  const ANG = Array.from({ length: 8 }, (_, i) => -Math.PI / 2 - Math.PI / 8 + (i * Math.PI) / 4); // the walls, from the NNW round
  const NRM = ANG.map((a) => [Math.cos(a), Math.sin(a)]);
  const VTX = Array.from({ length: 8 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 4; return [Math.cos(a) * R, Math.sin(a) * R]; }); // the corners, N first
  const STAIR = { hw: 46, y0: R - 90, y1: R + 70 }; // the stair up, out of the south corner (hall-local px)
  Finale.inHall = (x, y) => Math.abs(x - HX) < 1500 && Math.abs(y - HY) < 1500;
  const portalAt = (i, inset) => ({ x: HX + NRM[i][0] * (AP - inset), y: HY + NRM[i][1] * (AP - inset) });
  const onStair = (dx, dy, m) => Math.abs(dx) < STAIR.hw - m && dy > STAIR.y0 && dy < STAIR.y1;
  const onFloor = (dx, dy, m) => NRM.every(([nx, ny]) => dx * nx + dy * ny <= AP - m);
  // the stair down, by the Central Flame, and where the Bearer waits beside it
  // (the base's own Portal Hall building, DL.Camp.layout().hall, from the base redesign, when it stands; else DL.FINALE.door
  // and a stand-in stairwell drawn here)
  const built = () => { const L = DL.Camp.layout ? DL.Camp.layout(G.save.up) : null; return L && L.hall ? L.hall : null; };
  const door = () => { const h = built(); return h ? { x: h.x, y: h.y + 20, hw: h.hw } : { x: F.door.x, y: F.door.y, hw: 44 }; };
  const waitSpot = () => { const d = door(); return { x: d.x + d.hw + 40, y: d.y + 10 }; };
  const backSpot = (n) => { const d = door(); return { x: d.x + (n ? 34 * n * (n % 2 ? 1 : -1) / 2 : 0), y: d.y + 70 }; }; // coming back up
  const topOfStair = (n) => ({ x: HX + (n ? 30 * n * (n % 2 ? 1 : -1) / 2 : 0), y: HY + R - 110 });

  // Nobody walks through the hall's walls; the stair is the only way out.
  Finale.collideHall = function (ent, r) {
    if (!Finale.inHall(ent.x, ent.y)) return;
    let dx = ent.x - HX, dy = ent.y - HY;
    if (onStair(dx, dy, -r) && (Math.abs(dx) < STAIR.hw - r || !onFloor(dx, dy, r))) {
      ent.x = HX + clamp(dx, -STAIR.hw + r, STAIR.hw - r);
      ent.y = HY + Math.min(dy, STAIR.y1 - r);
      return;
    }
    for (let pass = 0; pass < 2; pass++) for (const [nx, ny] of NRM) {
      const over = dx * nx + dy * ny - (AP - r);
      if (over > 0) { dx -= nx * over; dy -= ny * over; }
    }
    ent.x = HX + dx; ent.y = HY + dy;
  };

  /* ---------------- the Bearer ---------------- */
  const maxHp = () => Math.round(F.hp * G.partyScale());
  function makeBearer(x, y) {
    const max = maxHp();
    return { kind: "bearer", x, y, rad: 34, hp: max, max, lit: true, down: false, downT: 0, angle: Math.PI / 2, moving: false, animT: 0, hitT: 0, charge: 0, pulseT: F.pulseEvery };
  }
  Finale.reset = function () {
    Finale.b = null; winAt = 0;
    if (G.isGuest()) return;
    const s = S();
    if (s.stage === 2 || s.stage === 3) { s.stage = 1; s.rest = null; } // the march and the gate are gone: he waits by the stair
    if (s.stage === 1) Finale.b = makeBearer(waitSpot().x, waitSpot().y);
  };
  function store() { G.persist(); }

  // The Drowned's blows on him (src/game.js), while they make him their goal.
  Finale.hurt = function (b, amt) {
    if (!b || b.down) return;
    b.hp -= amt;
    b.hitT = 0.2;
    if (defending()) b.charge = Math.max(0, b.charge - F.hitCharge);
    for (let i = 0; i < 4; i++) G.spark(b.x + rand(-14, 14), b.y - rand(40, 110), SPARK, 90);
    if (b.hp <= 0) fall(b);
  };
  // Struck down on the dais: he loses part of his spark, and gets up again after a while.
  function fall(b) {
    b.hp = 0; b.down = true; b.lit = false; b.downT = F.downFor;
    b.charge = Math.max(0, b.charge - F.fallLoss);
    for (let i = 0; i < 30; i++) G.puff(b.x + rand(-30, 30), b.y - rand(0, 140), "rgba(40,36,32,0.75)", 80, 1.3, -20);
    sfx("death");
    say(`The Spark Bearer falls! His spark gutters to ${Math.floor(b.charge * 100)}%. Hold them off until he gets up.`, "danger");
  }
  function getUp(b) {
    b.down = false; b.lit = true; b.hp = b.max * F.riseHp;
    for (const e of G.enemies) if (!e.removed && Finale.inHall(e.x, e.y)) e.goal = b; // they turn on him again
    for (let i = 0; i < 20; i++) G.spark(b.x + rand(-20, 20), b.y - rand(20, 120), SPARK, 100);
    say("The Spark Bearer climbs back onto the dais. His spark catches again.", "good");
  }
  // His fire scorches whatever crowds him.
  function pulse(b, dt) {
    b.pulseT -= dt;
    if (b.pulseT > 0) return;
    const prey = G.enemies.filter((e) => !e.removed && e.rise <= 0 && dist(e.x, e.y, b.x, b.y) < F.pulseR + e.def.radius);
    if (!prey.length) { b.pulseT = 0.4; return; }
    b.pulseT = F.pulseEvery;
    G.effects.push({ type: "ring", x: b.x, y: b.y - 6, r0: 20, r1: F.pulseR, col: SPARK, w: 6, t: 0, max: 0.5 });
    for (const e of prey) G.hitEnemy(e, F.pulseDmg, Math.atan2(e.y - b.y, e.x - b.x), 140, 6, true);
    sfx("flameHit");
  }

  /* ---------------- rising (host, at dawn) ---------------- */
  function rise() {
    const s = S();
    s.stage = 1; s.fail = -1;
    G.kindles = G.kindles.filter((k) => k.owner !== 0); // Kindle goes into the fire
    Finale.b = makeBearer(waitSpot().x, waitSpot().y);
    Finale.b.grow = 0;
    store();
    setTimeout(() => say("Kindle scuttles up onto the Central Flame and drinks it in, flame and all.", "good"), 2600);
    setTimeout(() => { sfx("milestone"); G.camera.shake = 10; say("A spark catches in him, and he stands up as tall as a tower: the Spark Bearer.", "good"); }, 6500);
    setTimeout(() => say("Beside the Flame the ground splits open on a stair, down to a hall no knight has seen. The Bearer waits there for you: walk down with him.", "warn"), 11000);
  }
  Finale.dawn = function () {
    if (G.isGuest()) return;
    const s = S(), b = Finale.b;
    if (s.stage === 0 && Finale.ready()) return rise();
    if (b && !inHallNow()) { b.hp = b.max = maxHp(); b.down = false; b.lit = true; }
  };
  Finale.nightfall = function () {};
  // Sandbox (pause menu): raise him now, or put the hall back to sleep to play it again
  Finale.sandbox = function () {
    if (G.isGuest() || inHallNow()) return;
    const s = S();
    if (s.stage === 0) return rise();
    s.stage = 0; s.fail = -1; s.won = 0;
    Finale.b = null;
    if (G.save.kindle.lit && !G.kindles.some((k) => k.owner === 0)) DL.Kindle.back(G.player.x - 26, G.player.y + 10);
    store();
    toast("Sandbox: the Portal Hall sleeps again. Use the button once more to raise the Spark Bearer.", "warn");
  };
  Finale.sandboxLabel = () => (S().stage === 0 ? "Sandbox: raise the Spark Bearer" : "Sandbox: put the Portal Hall to sleep");

  /* ---------------- going down and coming up (host) ---------------- */
  const followers = () => [...G.hounds, ...G.golems, ...G.kindles];
  const everyone = () => [G.player, ...G.allies];
  function enter(mode) {
    if (G.state === "camp") DL.UI.closeCamp();
    G.cave = { hall: true, mode, intro: mode === "defend" ? 5 : 0, burstT: 2, surged: [], sendT: {} };
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = []; G.walls = []; G.lightZones = [];
    G.selfEnemy = null;
    const p = G.player, at = topOfStair(0);
    p.x = at.x; p.y = at.y; p.kx = p.ky = 0; p.dashT = 0; p.angle = -Math.PI / 2;
    G.camera.x = p.x; G.camera.y = p.y;
    for (const a of G.allies) pull(a);
    for (const f of followers()) { f.x = p.x + rand(-30, 30); f.y = p.y + rand(-10, 20); }
    if (mode === "defend") {
      const b = Finale.b || (Finale.b = makeBearer(HX, HY));
      Object.assign(b, { x: HX, y: HY + 6, hp: maxHp(), max: maxHp(), down: false, lit: true, charge: 0, angle: Math.PI / 2, grow: 1, moving: false });
      sfx("rise");
      G.camera.shake = 8;
      say("Down the stair lies a hall of eight dark portals. The Spark Bearer climbs onto the dais at its heart and begins to burn. Something stirs in the portals: guard him until his spark fills the hall!", "warn");
    } else {
      sfx("chime");
      toast(`The Portal Hall. ${litCount()} of 8 portals burn; walk into one to go through. The stair leads back up to the camp.`, "good");
      if (G.allies.length) DL.Net.say("Your party walks down the stair into the Portal Hall.", "good");
    }
  }
  function pull(a) {
    const s = topOfStair(a.id);
    a.x = a.tx = s.x; a.y = a.ty = s.y;
    if (G.cave) G.cave.sendT[a.id] = 2;
    DL.Net.sendTo(a.id, { t: "hall", on: 1, mode: G.cave ? G.cave.mode : "open", x: s.x, y: s.y });
  }
  // Back up the stair into the camp (`lost`: cast out of a lost defense).
  function leave(lost) {
    G.cave = null;
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = [];
    const p = G.player, max = G.stats().maxHp, at = backSpot(0);
    if (lost || p.downT > 0) { p.downT = 0; p.hp = Math.max(1, max * F.failHp); p.inv = 1.5; }
    p.hallRise = 0;
    p.x = at.x; p.y = at.y; p.kx = p.ky = 0;
    G.camera.x = p.x; G.camera.y = p.y;
    for (const f of followers()) { f.x = p.x + rand(-30, 30); f.y = p.y + rand(-10, 20); }
    for (const a of G.allies) {
      const s = backSpot(a.id);
      a.x = a.tx = s.x; a.y = a.ty = s.y;
      DL.Net.sendTo(a.id, { t: "hall", on: 0, lost: lost ? 1 : 0, x: s.x, y: s.y });
    }
    for (const k of everyone()) k.hallT = 2;
    G.persist();
  }
  function lose() {
    const s = S(), b = Finale.b;
    s.fail = G.save.nights;
    leave(true);
    if (b) Object.assign(b, waitSpot(), { hp: maxHp(), max: maxHp(), down: false, lit: true, charge: 0, moving: false });
    sfx("death");
    say("Every knight is down. The hall casts you out, and the Spark Bearer climbs back up the stair, his spark spent. The stair stays shut until the next dawn.", "danger");
  }
  function win() {
    const s = S(), b = Finale.b, cv = G.cave;
    s.stage = 4;
    s.won = G.save.day;
    cv.mode = "open";
    for (const e of G.enemies) {
      e.removed = true;
      for (let i = 0; i < 6; i++) G.puff(e.x + rand(-12, 12), e.y - rand(0, 40), "rgba(255,210,140,0.6)", 60, 0.8, -30);
    }
    G.enemies = []; G.projectiles = []; G.telegraphs = [];
    rouse(); // the fallen get up
    if (b) { b.leave = 0; b.down = false; b.lit = true; }
    G.camera.shake = 14;
    sfx("milestone");
    store();
    say("The Spark Bearer's spark fills the hall! Fire runs along the floor to every portal, and the first of them bursts into light.", "good");
    winAt = now() + 8;
  }
  // the knights who fell in the defense get up (the host here; friends from a message)
  function rouse() {
    const p = G.player, max = G.stats().maxHp;
    if (p.downT > 0) { p.downT = 0; p.hp = max * 0.5; p.inv = 1.5; }
    p.hallRise = 0;
    for (const a of G.allies) DL.Net.sendTo(a.id, { t: "hall", rise: 1 });
  }
  // Into a lit portal: back up out of the hall first (a run comes home to where it set out), then through.
  function go(i) {
    const q = F.portals[i];
    leave(false);
    if (!DL.Rift.go(q.id)) toast("The portal flickers, but won't let you through yet.", "warn");
  }

  /* ---------------- a knight falls in the hall ---------------- */
  // Not drowned: down until `knightRise` s have passed (or the defense is over). From die() via Cave.fall (src/game.js).
  Finale.fall = function () {
    const p = G.player;
    if (p.downT > 0) return true;
    p.downT = 1e9; // (src/game.js counts a guest's down time; the hall raises its own)
    p.hallRise = F.knightRise;
    p.hp = 0;
    sfx("death");
    for (let i = 0; i < 24; i++) G.puff(p.x + rand(-12, 12), p.y - rand(0, 60), "rgba(255,200,120,0.6)", 50, 1.2, -30);
    toast(`You fall. You'll get up in ${F.knightRise} seconds, if anyone still stands.`, "danger");
    return true;
  };
  function riseLocal(dt) {
    const p = G.player;
    if (!(p.downT > 0) || !(p.hallRise > 0) || !inHallNow()) return;
    p.hallRise -= dt;
    if (p.hallRise > 0) return;
    p.downT = 0; p.hallRise = 0; p.hp = G.stats().maxHp * 0.4; p.inv = 1.5;
    for (let i = 0; i < 12; i++) G.spark(p.x + rand(-10, 10), p.y - rand(0, 40), SPARK, 60);
    toast("You get back up.", "good");
  }

  /* ---------------- every frame ---------------- */
  Finale.update = function (dt) {
    riseLocal(dt);
    const b = Finale.b;
    if (b) {
      b.animT += dt * (b.moving ? 0.35 : 0.5);
      b.hitT = Math.max(0, b.hitT - dt);
      if (b.grow != null && b.grow < 1) b.grow = Math.min(1, b.grow + dt / 6);
    }
    if (G.isGuest()) return;
    if (b && b.leave != null) leaving(b, dt);
    if (inHallNow()) return G.cave.mode === "defend" ? defend(dt) : hub(dt);
    if (G.spires || G.cave || G.state !== "play" || S().stage < 1) return;
    // walking down the stair by the Central Flame
    const d = door();
    for (const k of everyone()) {
      if (!k || k.down || k.downT > 0) continue;
      k.hallT = Math.max(0, (k.hallT || 0) - dt);
      const dx = k.x - d.x, dy = k.y - d.y;
      if (Math.abs(dx) > 30 || dy < -54 || dy > -12) continue;
      if (k.hallT > 0) continue;
      const id = k === G.player ? 0 : k.id;
      if (S().stage === 4) return enter("open");
      if (Finale.sealed()) { k.hallT = 6; if (id === 0) { toast("The stair is shut. The hall will open again at dawn.", "warn"); sfx("deny"); } else DL.Net.tell(id, "The stair is shut. The hall will open again at dawn.", "warn"); continue; }
      return enter("defend");
    }
  };
  // Into the hall's middle he goes (from the stair's foot); back out of it, small again, at the end.
  function leaving(b, dt) {
    b.leave += dt / 4;
    if (b.leave < 1) return;
    Finale.b = null;
    for (let i = 0; i < 30; i++) G.spark(HX + rand(-40, 40), HY - rand(0, 200), SPARK, 120);
    DL.Kindle.back(HX, HY + 30);
    say("Off the dais scuttles Kindle, small again, his fire still burning. He runs to your side.", "good");
  }

  // Host, in the defense.
  function defend(dt) {
    const cv = G.cave, b = Finale.b;
    for (const a of G.allies) { // a friend who joined late (or missed the message) is pulled down too
      if (Finale.inHall(a.tx, a.ty)) continue;
      cv.sendT[a.id] = (cv.sendT[a.id] || 0) - dt;
      if (cv.sendT[a.id] <= 0) pull(a);
    }
    if (G.player.downT > 0 && G.allies.every((a) => a.down)) return lose();
    if (!b) return;
    if (cv.intro > 0) { cv.intro -= dt; return; }
    if (b.down) {
      b.downT -= dt;
      if (b.downT <= 0) getUp(b);
    } else {
      const wisp = G.enemies.some((e) => e.type === "wisp" && !e.removed && e.rise <= 0);
      b.charge = Math.min(1, b.charge + (dt / F.charge) * (wisp ? F.wispSlow : 1));
      pulse(b, dt);
    }
    // a crowd at each mark
    F.surges.forEach((q, i) => {
      if (cv.surged[i] || b.charge < q.at) return;
      cv.surged[i] = true;
      for (const type in q.kinds) for (let n = 0; n < Math.max(1, Math.round(q.kinds[type] * G.partyScale())); n++) spawn(type, (Math.random() * 8) | 0);
      G.camera.shake = 10;
      sfx("growl");
      say(`${q.name}!`, "danger");
    });
    // and a steady flow out of the dark portals
    cv.burstT -= dt;
    if (cv.burstT <= 0) {
      cv.burstT = F.burst / G.diff().spawn;
      const live = G.enemies.filter((e) => !e.removed).length, cap = Math.round(F.cap * G.partyScale());
      const n = Math.round((F.n[0] + (F.n[1] - F.n[0]) * b.charge) * G.partyScale()), at = (Math.random() * 8) | 0;
      for (let i = 0; i < n && live + i < cap; i++) spawn(pickType(), at);
    }
    if (b.charge >= 1) win();
  }
  function pickType() {
    let sum = 0;
    for (const k in F.pool) sum += F.pool[k];
    let r = Math.random() * sum;
    for (const k in F.pool) { r -= F.pool[k]; if (r <= 0) return k; }
    return "footman";
  }
  function spawn(type, i) {
    const o = portalAt(i, 70), b = Finale.b;
    G.enemies.push(G.makeEnemy(type, o.x + rand(-24, 24), o.y + rand(-14, 14), F.zone, { rise: 0.6, goal: b && b.lit ? b : null }));
    for (let k = 0; k < 6; k++) G.puff(o.x + rand(-20, 20), o.y + rand(-8, 8), "rgba(150,90,220,0.6)", 60, 0.7, -30);
  }

  // Host, in the lit hall: the stair back up, and the portals.
  function hub(dt) {
    for (const k of everyone()) {
      if (!k || k.down || k.downT > 0) continue;
      k.hallT = Math.max(0, (k.hallT || 0) - dt);
      const dx = k.x - HX, dy = k.y - HY;
      if (Math.abs(dx) < STAIR.hw && dy > R + 22) return leave(false);
      for (let i = 0; i < 8; i++) {
        const o = portalAt(i, 34);
        if (dist(k.x, k.y, o.x, o.y) > 34) continue;
        if (portalLit(i)) return go(i);
        if (k.hallT > 0) continue;
        k.hallT = 5;
        const msg = portalHint(i), id = k === G.player ? 0 : k.id;
        if (id === 0) { toast(msg, "warn"); sfx("deny"); } else DL.Net.tell(id, msg, "warn");
      }
    }
  }
  function portalHint(i) {
    const q = F.portals[i], before = F.portals[i - 1];
    if (!q) return "This portal is dark and cold. Nothing has been found behind it yet.";
    if (before && !Finale.isCleared(before.id)) return `This portal is dark. It wakes once you have cleared ${before.name.replace(/^The /, "the ")}.`;
    return "This portal stirs, but it hasn't woken yet.";
  }

  // The victory screen, once the hall is lit (every device).
  Finale.tick = function () {
    if (winAt && now() >= winAt) { winAt = 0; DL.UI.showWin(); }
  };
  Finale.local = function () {};

  /* ---------------- the camp menu, the field guide and the HUD ---------------- */
  Finale.card = function () {
    const st = Finale.stage();
    if (st < 1) return "";
    if (st === 4) return `<article class="card finale-card"><header><h3>The Portal Hall</h3><span class="tag">${litCount()} of 8 lit</span></header>
      <p>The Spark Bearer filled the hall below the camp with his spark. Walk down the stair beside the Central Flame and into a burning portal to reach the dungeon behind it. Clear a dungeon and the next portal wakes.</p></article>`;
    const shut = Finale.sealed();
    return `<article class="card finale-card"><header><h3>The Spark Bearer</h3><span class="tag">${shut ? "The stair is shut" : "Waiting"}</span></header>
      <p>Kindle drank the Central Flame and rose as the Spark Bearer. He waits by the stair beside the Flame, down to a hall of eight dark portals. Walk down with him and hold the hall while he fills it with his spark: the Drowned will pour out of the portals at him.</p>
      ${shut ? `<footer><span class="req">The hall cast you out. The stair opens again at dawn.</span></footer>` : ""}</article>`;
  };
  Finale.guideLine = function () {
    const st = Finale.stage();
    if (st === 0) return "";
    if (st === 4) return `<b>The Portal Hall</b> lies down the stair beside the Central Flame: ${litCount()} of its 8 portals burn.`;
    return "<b>The Spark Bearer</b> waits by the stair beside the Central Flame, down to the Portal Hall.";
  };
  // The banner in the camp (the hall's own comes through Cave.objective, below)
  Finale.objective = function (p) {
    if (inHallNow() || Finale.stage() !== 1 || !Finale.b) return "";
    return dist(p.x, p.y, door().x, door().y) < 420 ? (Finale.sealed() ? "The stair to the Portal Hall is shut until dawn" : "The Spark Bearer waits · walk down the stair with him") : "";
  };
  Finale.hallObjective = function () {
    const cv = G.cave, b = Finale.b;
    if (!cv) return "";
    if (cv.mode !== "defend") return `The Portal Hall · ${litCount()} of 8 portals lit`;
    const ch = Math.floor((G.isGuest() ? net.charge : b ? b.charge : 0) * 100);
    if (G.player.downT > 0) return `You're down · the Spark Bearer's spark ${ch}%`;
    if (b && b.down) return `The Spark Bearer is down · his spark ${ch}% · hold them off`;
    return `Guard the Spark Bearer · his spark ${ch}%` + (b ? ` · ${Math.max(0, Math.ceil(b.hp))} / ${b.max}` : "");
  };
  // The compass: back to the stair while the Bearer waits and you're out in the marsh.
  Finale.nav = function (p) {
    if (G.cave || G.spires || Finale.stage() !== 1) return null;
    return dist(p.x, p.y, door().x, door().y) > 700 ? { x: door().x, y: door().y, label: "Portal Hall" } : null;
  };
  // In the defense the camera pulls back to show the whole hall (src/render.js, src/game.js).
  Finale.view = (p) => (defending() && p && Finale.inHall(p.x, p.y) ? { need: 1250, needW: 1300, x: HX, y: HY - 60, lean: 0.55 } : null);

  /* ---------------- light ---------------- */
  // The braziers at the hall's corners (their light halts corruption, like the bloomlight), the burning portals, the Bearer.
  Finale.lights = function (L) {
    const b = Finale.b, p = G.player, diff = G.diff().light;
    if (b && !b.down) {
      const grow = b.grow != null ? b.grow : 1, fade = b.leave != null ? 1 - b.leave : 1;
      L.push({ x: b.x, y: b.y - 60, r: F.light * diff * (0.3 + 0.7 * grow) * fade, s: 1, col: SPARK, a: 0.95 * fade, flick: 1, kind: "human" });
    } else if (b && b.down) L.push({ x: b.x, y: b.y - 20, r: 70, s: 0.4, col: "255,120,40", a: 0.45, flick: 1 });
    if (p && Finale.inHall(p.x, p.y)) {
      // a dim glow over the whole floor, from the spark in the stone: no corruption builds down here
      L.push({ x: HX, y: HY, r: R * 1.3, s: 0.25, col: "200,170,140", a: 0.35, kind: "bloom" });
      L.push({ x: HX, y: HY + R, r: 160, s: 0.4, col: "255,180,110", a: 0.6 }); // the stair up
      VTX.forEach((v, k) => { if (k !== 4) L.push({ x: HX + v[0] * 0.86, y: HY + v[1] * 0.86 - 30, r: 230 * diff, s: 0.8, col: "255,170,90", a: 0.8, flick: 1, kind: "bloom" }); });
      for (let i = 0; i < 8; i++) {
        const o = portalAt(i, 20), q = F.portals[i];
        if (Finale.portalLit(i)) L.push({ x: o.x, y: o.y - 50, r: 210, s: 0.75, col: q.col, a: 0.9 });
        else L.push({ x: o.x, y: o.y - 50, r: 80, s: 0.4, col: "120,80,180", a: 0.4 });
      }
      if (Finale.stage() === 4 && !b) L.push({ x: HX, y: HY - 20, r: 260 * diff, s: 0.8, col: SPARK, a: 0.85, flick: 1, kind: "human" });
      return;
    }
    if (Finale.stage() >= 1 && p && Math.abs(p.x - door().x) < 1200 && Math.abs(p.y - door().y) < 1200)
      L.push({ x: door().x, y: door().y - 30, r: 90, s: 0.5, col: Finale.won() ? "200,150,255" : SPARK, a: 0.7 });
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Finale.snap = function () {
    const st = S().stage, b = Finale.b, cv = G.cave;
    if (!st && !b) return 0;
    let mask = 0;
    for (let i = 0; i < 8; i++) if (portalLit(i)) mask |= 1 << i;
    return [st, b ? [r1(b.x), r1(b.y), Math.round(b.hp), b.max, (b.down ? 1 : 0) | (b.moving ? 4 : 0), r1(b.angle), Math.round(b.charge * 1000) / 1000,
      b.leave != null ? r1(b.leave) : -1, b.grow != null ? r1(b.grow) : 1] : 0,
      cv && cv.hall ? [cv.mode === "defend" ? 1 : 0] : 0, mask];
  };
  Finale.applySnap = function (m) {
    if (!m) { net.stage = 0; net.mask = 0; Finale.b = null; return; }
    const was = net.stage;
    net.stage = m[0]; net.mask = m[3] || 0;
    if (seen < 0) seen = net.stage; // the stage when we joined: a hall lit before we came shows no victory
    if (net.stage === 4 && was !== 4 && seen !== 4) winAt = now() + 8;
    const r = m[1];
    if (r) {
      const b = Finale.b || (Finale.b = { kind: "bearer", x: r[0], y: r[1], rad: 34, animT: 0, hitT: 0 });
      if (Math.hypot(r[0] - b.x, r[1] - b.y) > 600) { b.x = r[0]; b.y = r[1]; } // into the hall, or back up: no gliding there
      Object.assign(b, { tx: r[0], ty: r[1], hp: r[2], max: r[3], down: !!(r[4] & 1), moving: !!(r[4] & 4), angle: r[5], lit: !(r[4] & 1), charge: r[6],
        leave: r[7] >= 0 ? r[7] : null, grow: r[8] });
      net.charge = r[6];
    } else Finale.b = null;
    if (m[2]) G.cave = { hall: true, mode: m[2][0] ? "defend" : "open", guest: true }; // (Cave.applySnap cleared it just before)
  };
  // Guest: glide the Bearer toward the host's position.
  Finale.guest = function (dt, k01) {
    const b = Finale.b;
    if (!b || b.tx == null) return;
    b.x += (b.tx - b.x) * k01; b.y += (b.ty - b.y) * k01;
  };
  // Guest: pulled down into the hall, sent back up, or raised when the defense is won.
  Finale.guestMsg = function (m) {
    const p = G.player, max = G.stats().maxHp;
    if (m.rise) { if (p.downT > 0) { p.downT = 0; p.hp = max * 0.5; p.inv = 1.5; } p.hallRise = 0; return; }
    if (m.on) {
      if (G.state === "camp") DL.UI.closeCamp();
      G.cave = { hall: true, mode: m.mode, guest: true };
    } else {
      G.cave = null;
      if (m.lost || p.downT > 0) { p.downT = 0; p.hp = Math.max(p.hp, max * F.failHp); }
      p.hallRise = 0;
    }
    p.x = m.x; p.y = m.y; p.kx = 0; p.ky = 0; p.inv = 1.5;
    G.camera.x = p.x; G.camera.y = p.y;
    G.enemies = []; G.projectiles = [];
    sfx(m.on ? "rise" : m.lost ? "death" : "chime");
  };

  /* ---------------- drawing: stand-ins until Robert's concept art is drawn ---------------- */
  // a soft round glow, painted once per colour and stamped (no gradients built every frame)
  const glows = {};
  function glowPic(col) {
    if (glows[col]) return glows[col];
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = cv.height = 64;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glows[col] = cv);
  }
  function glow(c, x, y, r, col, a) {
    c.globalAlpha = a;
    c.drawImage(glowPic(col), x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
  }
  // a drawn sprite, `k` world px per file px, anchored at (ax, ay) of its size, mirrored if asked
  function spr(c, n, x, y, k, flip) {
    const s = DL.Art.sprites[n];
    if (!s) return false;
    const w = Math.round(s.w * s.res * k), h = Math.round(s.h * s.res * k), sm = c.imageSmoothingEnabled;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (flip) c.scale(-1, 1);
    c.imageSmoothingEnabled = false;
    c.drawImage(s.c, Math.round(-w / 2), -h, w, h);
    c.imageSmoothingEnabled = sm;
    c.restore();
    return true;
  }
  const visible = (view, x0, y0, x1, y1) => x1 > view.left && x0 < view.right && y1 > view.top && y0 < view.bottom;

  // The hall's floor (src/world.js ground chunks): flagstones inside the eight walls, black beyond them.
  Finale.groundColor = function (x, y) {
    const dx = x - HX, dy = y - HY;
    if (!onFloor(dx, dy, 0) && !onStair(dx, dy, 0)) { const v = 5 + DL.fbm(x / 70, y / 70, 31) * 5; return [v, v, v + 2]; }
    const tx = DL.World.texel("campFlags", x, y, 0.5);
    let [r, g, b] = tx || [52, 50, 56];
    const edge = Math.min(...NRM.map(([nx, ny]) => AP - (dx * nx + dy * ny))); // how far in from the nearest wall
    const k = clamp(1 - edge / 120, 0, 1) * (onStair(dx, dy, 0) && dy > R - 60 ? 0.3 : 1);
    return [r * (1 - 0.55 * k), g * (1 - 0.55 * k), b * (1 - 0.45 * k)];
  };

  Finale.drawGround = function (c, view, t) {
    if (Finale.stage() >= 1 && !built() && visible(view, door().x - 80, door().y - 80, door().x + 80, door().y + 40)) drawStairwell(c, t);
    if (!visible(view, HX - R - 40, HY - R - 160, HX + R + 40, HY + R + 120)) return;
    c.save();
    // the back walls: the faces of the walls north of the hall's middle stand up out of the floor
    const WH = 110;
    for (let k = 0; k < 8; k++) {
      const a = VTX[k], b2 = VTX[(k + 1) % 8], ny = NRM[(k + 1) % 8][1]; // face k+1 (ANG order) runs from corner k to k+1
      if (ny > 0.5) continue;
      c.fillStyle = "#1c1a20";
      c.beginPath(); c.moveTo(HX + a[0], HY + a[1]); c.lineTo(HX + b2[0], HY + b2[1]); c.lineTo(HX + b2[0], HY + b2[1] - WH); c.lineTo(HX + a[0], HY + a[1] - WH); c.closePath(); c.fill();
      c.strokeStyle = "#2c2932"; c.lineWidth = 2;
      for (let row = 1; row < 4; row++) { const h = (WH * row) / 4; c.beginPath(); c.moveTo(HX + a[0], HY + a[1] - h); c.lineTo(HX + b2[0], HY + b2[1] - h); c.stroke(); }
      c.fillStyle = "#3a3640";
      c.beginPath(); c.moveTo(HX + a[0], HY + a[1] - WH); c.lineTo(HX + b2[0], HY + b2[1] - WH); c.lineTo(HX + b2[0], HY + b2[1] - WH - 8); c.lineTo(HX + a[0], HY + a[1] - WH - 8); c.closePath(); c.fill();
    }
    // the low lip of the walls in front
    c.strokeStyle = "#141217"; c.lineWidth = 10;
    c.beginPath();
    for (let k = 2; k <= 6; k++) { const v = VTX[k]; if (k === 2) c.moveTo(HX + v[0], HY + v[1]); else c.lineTo(HX + v[0], HY + v[1]); }
    c.stroke();
    // the stair up, out of the south corner
    for (let i = 0; i < 6; i++) {
      const y = HY + R - 40 + i * 18;
      c.fillStyle = i % 2 ? "#2a2830" : "#34313b";
      c.fillRect(HX - STAIR.hw, y, STAIR.hw * 2, 14);
    }
    // channels in the floor from the dais to every portal: they burn as the spark fills, and stay lit to the open portals
    const b = Finale.b, ch = b && defending() ? (G.isGuest() ? net.charge : b.charge) : 0;
    for (let i = 0; i < 8; i++) {
      const o = portalAt(i, 50), lit = Finale.portalLit(i), q = F.portals[i];
      c.strokeStyle = "#0e0d11"; c.lineWidth = 9;
      c.beginPath(); c.moveTo(HX + NRM[i][0] * HL.dais, HY + NRM[i][1] * HL.dais); c.lineTo(o.x, o.y); c.stroke();
      const u = lit ? 1 : ch;
      if (u > 0) {
        c.strokeStyle = lit ? `rgba(${q.col},${0.55 + 0.2 * Math.sin(t * 2 + i)})` : `rgba(${SPARK},0.7)`; c.lineWidth = 4;
        c.beginPath(); c.moveTo(HX + NRM[i][0] * HL.dais, HY + NRM[i][1] * HL.dais);
        c.lineTo(HX + NRM[i][0] * (HL.dais + (AP - 50 - HL.dais) * u), HY + NRM[i][1] * (HL.dais + (AP - 50 - HL.dais) * u)); c.stroke();
      }
    }
    // the dais: a round step of stone with a rune ring that fills with the spark
    c.fillStyle = "#25232b"; c.beginPath(); c.ellipse(HX, HY + 6, HL.dais + 8, (HL.dais + 8) * 0.62, 0, 0, TAU); c.fill();
    c.fillStyle = "#3b3843"; c.beginPath(); c.ellipse(HX, HY, HL.dais, HL.dais * 0.62, 0, 0, TAU); c.fill();
    c.strokeStyle = "rgba(20,18,24,0.9)"; c.lineWidth = 6;
    c.beginPath(); c.ellipse(HX, HY, HL.dais * 0.72, HL.dais * 0.45, 0, 0, TAU); c.stroke();
    const full = Finale.won() ? 1 : ch;
    if (full > 0) {
      c.strokeStyle = `rgba(${SPARK},${0.5 + 0.4 * full})`; c.lineWidth = 4;
      c.beginPath(); c.ellipse(HX, HY, HL.dais * 0.72, HL.dais * 0.45, 0, -Math.PI / 2, -Math.PI / 2 + TAU * full); c.stroke();
    }
    c.restore();
  };
  // In the camp: the stair down beside the Flame (a dark well with steps going down north).
  function drawStairwell(c, t) {
    const d = door();
    c.save();
    c.fillStyle = "#3d3a36"; c.fillRect(d.x - 44, d.y - 62, 88, 62);
    c.fillStyle = "#08070a"; c.fillRect(d.x - 36, d.y - 56, 72, 50);
    for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(70,64,60,${0.9 - i * 0.2})`; c.fillRect(d.x - 34 + i * 2, d.y - 18 - i * 10, 68 - i * 4, 6); }
    const a = 0.25 + 0.15 * Math.sin(t * 2);
    c.fillStyle = Finale.won() ? `rgba(200,150,255,${a})` : `rgba(${SPARK},${a})`;
    c.fillRect(d.x - 30, d.y - 54, 60, 10);
    c.restore();
  }

  // Into the y-sorted scene: the stair's two posts in camp, the portals and braziers in the hall, and the Bearer.
  Finale.push = function (list, c, t, view) {
    const b = Finale.b, d = door();
    if (Finale.stage() >= 1 && !built() && visible(view, d.x - 80, d.y - 200, d.x + 80, d.y + 40))
      for (const sx of [-1, 1]) list.push({ y: d.y - 2, f: () => post(c, d.x + sx * 46, d.y - 2, t) });
    if (visible(view, HX - R - 100, HY - R - 260, HX + R + 100, HY + R + 120)) {
      for (let i = 0; i < 8; i++) { const o = portalAt(i, 12); list.push({ y: o.y, f: () => drawPortal(c, i, o, t) }); }
      VTX.forEach((v, k) => { if (k === 4) return; const x = HX + v[0] * 0.86, y = HY + v[1] * 0.86; list.push({ y, f: () => brazier(c, x, y, t) }); });
      if (!b && Finale.won()) list.push({ y: HY, f: () => DL.Art.drawFire(c, HX, HY - 4, 1.6, t) }); // the spark he left on the dais
    }
    if (b && visible(view, b.x - 300, b.y - 600, b.x + 300, b.y + 60)) list.push({ y: b.y, f: () => drawBearer(c, b, t) });
  };
  function post(c, x, y, t) {
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 14, 5, 0, 0, TAU); c.fill();
    c.fillStyle = "#4a4640"; c.fillRect(x - 9, y - 70, 18, 70);
    c.fillStyle = "#5c5750"; c.fillRect(x - 9, y - 70, 18, 5);
    c.fillStyle = "#2a2724"; c.fillRect(x - 12, y - 78, 24, 10);
    DL.Art.drawFire(c, x, y - 80, 0.6, t + x);
  }
  function brazier(c, x, y, t) {
    c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(x, y, 18, 6, 0, 0, TAU); c.fill();
    c.fillStyle = "#3a3640"; c.fillRect(x - 6, y - 34, 12, 34);
    c.fillStyle = "#4c4754"; c.beginPath(); c.ellipse(x, y - 36, 18, 7, 0, 0, TAU); c.fill();
    DL.Art.drawFire(c, x, y - 38, 0.9, t + x * 0.01);
  }
  // A portal: Robert's Rift Portal picture (open or dormant), a glow in its dungeon's colour while it burns.
  function drawPortal(c, i, o, t) {
    const lit = Finale.portalLit(i), q = F.portals[i], im = DL.Rift.art(lit ? "portal-on" : "portal-off"), k = 0.3;
    if (im) {
      const w = im.width * k, h = im.height * k;
      c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(o.x, o.y - 2, w * 0.42, 8, 0, 0, TAU); c.fill();
      if (!lit) c.filter = "grayscale(0.7) brightness(0.55)";
      c.drawImage(im, o.x - w / 2, o.y + 4 - h, w, h);
      c.filter = "none";
    } else {
      c.fillStyle = "#2a2730"; c.fillRect(o.x - 40, o.y - 120, 80, 120);
      c.fillStyle = lit ? `rgba(${q.col},0.85)` : "#050407";
      c.beginPath(); c.ellipse(o.x, o.y - 60, 28, 50, 0, 0, TAU); c.fill();
    }
    const p = G.player;
    if (p && dist(p.x, p.y, o.x, o.y) < 170) {
      c.font = "bold 13px serif"; c.textAlign = "center";
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillText(lit ? q.name : "???", o.x + 1, o.y - 133);
      c.fillStyle = lit ? `rgb(${q.col})` : "#8a8394"; c.fillText(lit ? q.name : "???", o.x, o.y - 134);
    }
  }

  // Over the dark: the portals' swirl, the Bearer's spark and the ring of his charge.
  Finale.glow = function (c, t, view) {
    const b = Finale.b;
    if (visible(view, HX - R - 100, HY - R - 260, HX + R + 100, HY + R + 120)) {
      for (let i = 0; i < 8; i++) {
        if (!Finale.portalLit(i)) continue;
        const o = portalAt(i, 12);
        glow(c, o.x, o.y - 62, 52 + Math.sin(t * 2.4 + i) * 5, F.portals[i].col, 0.45);
      }
    }
    if (b && !b.down) {
      const s = bearerScale(b), x = b.x, y = b.y - (DL.Art.sprites.fbFront ? 24 : 15) * s, r = (16 + Math.sin(t * 7) * 2) * s;
      glow(c, x, y, r, SPARK, 0.8);
      const ch = G.isGuest() ? net.charge : b.charge;
      if (defending() && ch > 0) {
        c.strokeStyle = `rgba(${SPARK},${0.4 + 0.5 * ch})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, r * 0.9 + 30 * (1 - ch), -Math.PI / 2, -Math.PI / 2 + TAU * ch); c.stroke();
      }
    }
  };

  // How big he stands: growing out of the fire when he first rises, shrinking back into Kindle at the end.
  function bearerScale(b) {
    const grow = b.grow != null ? b.grow : 1, leave = b.leave != null ? b.leave : 0;
    return (1 + 3.4 * grow) * (1 - 0.75 * Math.min(1, leave * 1.5));
  }
  // Robert's drawn Fire Bearer (props/fb*) stands in: planted on the dais and by the stair, guttered out when down.
  function drawnBearer(c, b, t, k) {
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
    let n = "fbCamp", flip = false;
    if (b.down) n = "fbDown";
    else if (b.moving && Math.abs(ca) > Math.abs(sa) * 1.2) { n = "fbSide"; flip = ca < 0; }
    else if (b.moving && sa < 0) n = "fbBack";
    else if (b.moving) n = "fbFront";
    spr(c, n, b.x, b.y, k, flip);
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
    if (b.hp < b.max && !b.down && b.max) { // his health, while he's hurt
      const w = 90, x = b.x - w / 2, y = b.y - 42 * s - 14;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = "#ffd27a"; c.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 4);
    }
  }
})(window.DL);
