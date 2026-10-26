/* Drowned Light — Abigail, a soul wraith familiar. Every knight wins their own: soul orbs lie scattered
   over the land, and each device sees and picks up only its own knight's. Carry them to the old graves
   deep in the Abyss and lay them to rest; once ten are laid there, Abigail rises from the graves and
   follows you for good. She sends homing soul orbs at the Drowned (each one an orb hits is weakened for
   good), and every so often blesses her knight with a little more strength, speed and toughness.
   Each device gathers and lays orbs to rest for its own knight; the host runs every Abigail and sends them
   in its snapshots. An Abigail a friend won comes along into other worlds, like a hound. Numbers: DL.ABIGAIL. */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, A = DL.ABIGAIL;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const CAST = 0.45, CAST_AT = 0.2; // her throw, and when the orb leaves her hand
  const SOUL = "90,245,205"; // the teal of her orbs (the Drowned glow a colder cyan)
  const Abigail = (DL.Abigail = {});
  G.wraiths = [];

  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  Abigail.SOUL = SOUL;

  /* ---------------- where things lie (the same for every visit and every friend in a world of this difficulty) ---------------- */
  // The graves: on dry land deep in the Abyss, clear of the bloom groves.
  let spot = null, spotFor = null;
  Abigail.graveSpot = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE;
    const dry = (x, y) => !W.isWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !W.isWater(x + Math.cos(i * 0.785) * 130, y + Math.sin(i * 0.785) * 90));
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
      const a = DL.hash(53, 29, 700 + t) * TAU, r = A.graveDist + (DL.hash(53, 29, 780 + t) - 0.5) * 300;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y)) spot = { x, y };
    }
    spot = spot || { x: 0, y: A.graveDist };
    spotFor = G.save.difficulty;
    return spot;
  };
  // The stones: a tall headstone at the heart (where the orbs are laid), graves round it, a pillar on each side.
  const LAYOUT = [["headstone", 0, -8], ["grave", -64, -34], ["grave", -30, -52], ["grave", 30, -52], ["grave", 64, -34],
    ["grave", -84, 14], ["grave", 84, 14], ["grave", -50, 50], ["grave", 50, 50], ["pillar", -124, -16], ["pillar", 124, -16]];
  let graves = null, gravesFor = null;
  Abigail.graves = function () {
    if (graves && gravesFor === G.save.difficulty) return graves;
    const s = Abigail.graveSpot();
    graves = LAYOUT.map(([type, dx, dy], i) => ({ type, x: s.x + dx, y: s.y + dy, i }));
    gravesFor = G.save.difficulty;
    return graves;
  };
  // The soul orbs: a few in every ring of the land, on dry ground.
  let orbs = null, orbsFor = null;
  Abigail.orbs = function () {
    if (orbs && orbsFor === G.save.difficulty) return orbs;
    const W = DL.World;
    orbs = [];
    let n = 0;
    for (const [count, r0, r1] of A.orbs) for (let k = 0; k < count; k++, n++) {
      let at = null;
      for (let t = 0; t < 24 && !at; t++) {
        // spread round the ring: each takes its own slice of the circle, jittered
        const a = ((k + DL.hash(61, n, 800 + t)) / count) * TAU + n * 1.7, r = r0 + DL.hash(61, n, 900 + t) * (r1 - r0);
        const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
        if (!W.isWater(x, y) && DL.Camp.sq(x, y) > 320) at = { x, y };
      }
      if (at) orbs.push({ i: n, x: at.x, y: at.y });
    }
    orbsFor = G.save.difficulty;
    return orbs;
  };

  /* ---------------- your own souls (each device for its own knight) ---------------- */
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  // A friend's progress lives in their co-op profile, so it comes with them from world to world. The orbs they
  // picked up in this world are remembered only while they're here.
  let guestTaken = new Set(), guestFound = false;
  function mine() {
    if (!G.isGuest()) return G.save.souls;
    const pr = DL.Net.profile();
    return { held: pr.soulsHeld || 0, given: pr.soulsGiven || 0, taken: [...guestTaken], found: guestFound };
  }
  function store(v) {
    if (!G.isGuest()) { Object.assign(G.save.souls, v); G.persist(); return; }
    const pr = DL.Net.profile();
    if (v.held != null) pr.soulsHeld = v.held;
    if (v.given != null) pr.soulsGiven = v.given;
    if (v.won) pr.abigail = 1;
    DL.Net.saveProfile(pr);
  }
  Abigail.won = () => (G.isGuest() ? DL.Net.hasAbigail() : !!G.save.abigail);
  Abigail.mine = () => G.wraiths.find((w) => w.owner === myId()) || null;
  Abigail.held = () => mine().held;
  // The orbs still lying out there for you (none once she's yours).
  Abigail.left = function () {
    if (G.state === "title" || Abigail.won()) return [];
    const taken = new Set(mine().taken);
    return Abigail.orbs().filter((o) => !taken.has(o.i));
  };

  function ownerOf(w) {
    if (w.owner === 0) return G.state === "play" || G.state === "camp" ? G.player : null;
    return G.allies.find((a) => a.id === w.owner) || null;
  }

  // One Abigail per knight, ever: winning her again or joining only gives back the one they have.
  function spawn(owner, x, y) {
    const had = G.wraiths.find((o) => o.owner === owner);
    if (had) return had;
    const w = { id: ++G.eid, wraith: true, owner, x, y, angle: Math.PI / 2, moving: false, animT: 0, state: "move", stT: 0, cd: 1, pulseT: A.pulseEvery, buff: 0 };
    G.wraiths.push(w);
    for (let i = 0; i < 18; i++) G.puff(x + rand(-12, 12), y - rand(0, 40), `rgba(${SOUL},0.6)`, 50, 1, -30);
    return w;
  }
  // A new life (or a reload): your Abigail is back at your side.
  Abigail.reset = function () {
    G.wraiths = [];
    near = false;
    if (!G.isGuest() && G.save.abigail && G.player) spawn(0, G.player.x + 24, G.player.y - 6);
  };
  // Host: a friend who won her (here or in any world) brings her along.
  Abigail.join = function (owner) {
    const a = G.allies.find((o) => o.id === owner);
    if (a) spawn(owner, a.x + 24, a.y - 6);
  };
  // Host: a friend left, and their Abigail goes with them.
  Abigail.leave = function (owner) { G.wraiths = G.wraiths.filter((w) => w.owner !== owner); };
  // A guest who leaves forgets which orbs they picked up in that world.
  Abigail.forget = function () { guestTaken = new Set(); guestFound = false; };

  /* ---------------- gathering and laying them to rest (your own device) ---------------- */
  let near = false;
  Abigail.gather = function () {
    const p = G.player;
    if (!p || G.state !== "play" || G.cave || Abigail.won()) return;
    const M = mine();
    // picking up
    for (const o of Abigail.left()) {
      if (dist(p.x, p.y - 10, o.x, o.y - 16) > A.grab) continue;
      const held = M.held + 1;
      if (G.isGuest()) guestTaken.add(o.i);
      else G.save.souls.taken.push(o.i);
      store({ held });
      M.held = held;
      sfx("chime");
      for (let i = 0; i < 12; i++) G.spark(o.x, o.y - 16, SOUL, 90);
      const s = Abigail.graveSpot(), need = Math.max(0, A.need - M.given);
      say(held + M.given === 1
        ? `A soul orb, cold and whispering. Lay ${A.need} of them to rest at the old graves in the Abyss, to the ${compass(s.x, s.y)}.`
        : `Soul orb taken (${held} carried · ${M.given} of ${A.need} laid to rest${held >= need ? " · enough: take them to the graves" : ""}).`, "good");
    }
    // the graves
    const s = Abigail.graveSpot(), d = dist(p.x, p.y, s.x, s.y);
    if (!M.found && d < 480) {
      if (G.isGuest()) guestFound = true;
      else { G.save.souls.found = true; G.persist(); }
      say("Old graves lean in the black mud here, and something weeps among them. Soul orbs could be laid to rest at the tall headstone.", "warn");
    }
    if (d > A.giveR + 60) near = false;
    if (d > A.giveR || near) return;
    near = true;
    if (!M.held) { say(`The graves wait for soul orbs: ${A.need - M.given} more to lay to rest.`, "warn"); return; }
    const given = Math.min(A.need, M.given + M.held);
    sfx("whisper");
    for (let i = 0; i < 16; i++) G.spark(s.x, s.y - 30, SOUL, 120);
    if (given < A.need) {
      store({ held: 0, given });
      say(`You lay ${M.held} soul orb${M.held > 1 ? "s" : ""} to rest (${given} of ${A.need}).`, "good");
      return;
    }
    store({ held: 0, given, won: true });
    if (!G.isGuest()) G.save.abigail = 1;
    G.persist();
    sfx("milestone");
    for (let i = 0; i < 30; i++) G.puff(s.x + rand(-30, 30), s.y - rand(0, 50), `rgba(${SOUL},0.6)`, 60, 1.2, -40);
    say("The tenth soul sinks into the earth, and a hooded girl rises from the graves: Abigail. She drifts to your side.", "good");
    if (G.isGuest()) DL.Net.event({ t: "abigail" }); // the host raises her beside you
    else spawn(0, s.x, s.y - 10);
  };

  /* ---------------- her blessing (on every device, for its own knight) ---------------- */
  Abigail.buffed = () => { const w = Abigail.mine(); return !!(w && w.buff > 0); };
  Abigail.mult = () => (Abigail.buffed() ? 1 + DL.Summons.wraith().buff : 1);

  /* ---------------- the wraiths themselves (host only) ---------------- */
  // Her orb's sting grows with the Central Flame and her own level (src/summons.js).
  Abigail.dmg = () => Math.round(A.dmg * (1 + A.perFlame * Math.max(0, G.save.up.flame - A.reqFlame)) * DL.Summons.wraith().dmgMult * 10) / 10;
  const valid = (e) => e && !e.removed && e.rise <= 0 && !e.dormant;
  function target(w, o) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (!valid(e) || dist(o.x, o.y, e.x, e.y) > A.sight) continue;
      // the ones not yet weakened first, then the nearest to her
      const d = dist(w.x, w.y, e.x, e.y) + (e.cursed ? 400 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function throwOrb(w, e) {
    const x = w.x, y = w.y - 30, a = Math.atan2(e.y - 20 * e.def.scale - y, e.x - x);
    G.projectiles.push({ x, y, vx: Math.cos(a) * A.orbSpeed, vy: Math.sin(a) * A.orbSpeed, life: A.orbLife, dmg: Abigail.dmg(), hostile: false,
      kind: "soul", col: SOUL, r: 9, homing: true, hit: new Set(), soul: true, pierce: DL.Summons.wraith().bounce }); // Mourning Abigail's leap on to a second
    sfx("whisper");
  }
  // A Drowned her orb hits is weakened for good, once: less damage and speed, and it takes more.
  Abigail.curse = function (e) {
    if (e.cursed || e.removed) return;
    e.cursed = true;
    const k = DL.Summons.wraith().curse;
    e.dmg *= 1 - k;
    e.speed *= 1 - k;
    e.curseK = k;
    for (let i = 0; i < 8; i++) G.spark(e.x + rand(-8, 8), e.y - rand(10, 40) * e.def.scale, SOUL, 60);
    G.text(e.x, e.y - 50 * e.def.scale - 30, "Weakened", "#7ff5cf", 0.9);
  };

  function step(w, dt) {
    const o = ownerOf(w);
    if (!o) { if (w.owner !== 0) w.gone = true; return; }
    w.animT += dt;
    w.cd -= dt;
    w.buff = Math.max(0, w.buff - dt);
    const lv = DL.Summons.wraith();
    // the Queen of Sorrows' wail: every Drowned near her knight is cursed and stunned
    if (lv.wail) {
      w.wailT = (w.wailT == null ? 4 : w.wailT) - dt;
      if (w.wailT <= 0 && G.enemies.some((e) => valid(e) && dist(o.x, o.y, e.x, e.y) < 200)) {
        w.wailT = lv.wail;
        G.effects.push({ type: "howl", x: w.x, y: w.y - 30, t: 0, max: 0.9, col: SOUL, r: 200 });
        sfx("whisper");
        for (const e of G.enemies) if (valid(e) && dist(o.x, o.y, e.x, e.y) < 200) { Abigail.curse(e); if (!e.def.boss) e.stun = Math.max(e.stun || 0, 1); }
      }
    }
    // her blessing: a wave of soul-light washes over her knight (not yet while she's only a wisp)
    w.pulseT -= dt;
    if (w.pulseT <= 0 && !lv.bless) w.pulseT = 1;
    else if (w.pulseT <= 0) {
      w.pulseT = A.pulseEvery;
      w.buff = A.buffDur;
      const pct = Math.round(lv.buff * 100);
      G.effects.push({ type: "soulPulse", x1: w.x, y1: w.y - 30, x2: o.x, y2: o.y - 24, owner: w.owner, t: 0, max: 0.7 });
      if (w.owner === 0) { sfx("chime"); if (!G.save.blessed) { G.save.blessed = 1; G.persist(); say(`Abigail's blessing: ${pct}% more damage and speed, and ${pct}% less harm, for ${A.buffDur} seconds.`, "good"); } }
    }
    if (dist(w.x, w.y, o.x, o.y) > 700) {
      Object.assign(w, { x: o.x + 24, y: o.y - 6, state: "move" });
      for (let i = 0; i < 10; i++) G.puff(w.x, w.y - 30, `rgba(${SOUL},0.5)`, 40, 0.7);
    }
    if (w.state === "cast") {
      w.stT -= dt;
      if (!w.thrown && w.stT <= CAST - CAST_AT) { w.thrown = true; if (valid(w.tgt)) throwOrb(w, w.tgt); }
      if (w.stT <= 0) w.state = "move";
    } else if (w.cd <= 0 && !(o.downT > 0) && !o.down) {
      const e = target(w, o);
      if (e) {
        Object.assign(w, { state: "cast", stT: CAST, cd: lv.cd, tgt: e, thrown: false });
        w.angle = Math.atan2(e.y - w.y, e.x - w.x);
      }
    }
    // she drifts beside her knight, on the right and a little behind, clear of them so you can see her; a wraith
    // floats over water and through walls
    const a = o.angle || 0;
    const fx = o.x - Math.cos(a) * 8 + Math.cos(a + Math.PI / 2) * 36, fy = o.y - Math.sin(a) * 6 + Math.sin(a + Math.PI / 2) * 24;
    const d = dist(w.x, w.y, fx, fy);
    w.moving = d > (w.moving ? 4 : 14); // a little slack, so she doesn't flicker between drifting and still
    if (!w.moving) return;
    const spd = d > 150 ? A.speed * 1.5 : Math.min(A.speed, d * 3);
    w.x += ((fx - w.x) / d) * spd * dt;
    w.y += ((fy - w.y) / d) * spd * dt;
    if (w.state !== "cast") w.angle = Math.atan2(fy - w.y, fx - w.x);
  }

  Abigail.update = function (dt) {
    Abigail.gather();
    for (const w of G.wraiths) step(w, dt);
    G.wraiths = G.wraiths.filter((w) => !w.gone);
  };

  // Light: a cold glow around her and around each orb still lying out there for you. Neither holds off corruption.
  Abigail.lights = function (L) {
    for (const w of G.wraiths) L.push({ x: w.x, y: w.y - 30, r: 46, s: 0.4, col: SOUL, a: 0.55 });
    const p = G.player;
    if (!p) return;
    for (const o of Abigail.left()) if (Math.abs(o.x - p.x) < 900 && Math.abs(o.y - p.y) < 900) L.push({ x: o.x, y: o.y - 16, r: 40, s: 0.4, col: SOUL, a: 0.8 });
    const s = Abigail.graveSpot();
    if (!Abigail.won() && Math.abs(s.x - p.x) < 1000 && Math.abs(s.y - p.y) < 1000) L.push({ x: s.x, y: s.y - 30, r: 60 + 6 * mine().given, s: 0.4, col: SOUL, a: 0.5 });
  };
  // What this device draws at the graves: one soul circling the headstone for each you've laid to rest.
  Abigail.restingSouls = () => (G.state === "title" || Abigail.won() ? 0 : mine().given);

  // The field guide's line, and the camp card's progress.
  Abigail.progress = () => { const M = mine(); return { held: M.held, given: M.given, found: !!M.found }; };
  Abigail.where = function () { const s = Abigail.graveSpot(); return { dir: compass(s.x, s.y), m: Math.round(Math.hypot(s.x, s.y) / 10) }; };
  Abigail.guideLine = function () {
    if (Abigail.won()) return `<b>Abigail</b> drifts at your side, weakening the Drowned with her soul orbs and blessing you every ${A.pulseEvery} s.`;
    const M = mine(), w = Abigail.where();
    return `Soul orbs glow pale teal across the land. Lay ${A.need} to rest at the old graves in the Abyss, ${M.found ? `${w.m} m ${w.dir} of camp` : "far out"}, and <b>Abigail</b> rises (${M.given} laid, ${M.held} carried).`;
  };
  // The compass to the graves: once found, while you carry orbs.
  Abigail.showNav = () => !G.cave && !Abigail.won() && !!mine().found && mine().held > 0;

  // Co-op: each Abigail as [id, owner, x, y, angle, moving, throw time left (0 when not throwing), blessing left]
  Abigail.rows = function () {
    const r1 = (v) => Math.round(v * 10) / 10;
    return G.wraiths.map((w) => [w.id, w.owner, r1(w.x), r1(w.y), r1(w.angle), w.moving ? 1 : 0, w.state === "cast" ? r1(w.stT) : 0, r1(w.buff)]);
  };
  Abigail.apply = function (rows) {
    const old = new Map(G.wraiths.map((w) => [w.id, w]));
    G.wraiths = (rows || []).map((r) => {
      const w = old.get(r[0]) || { id: r[0], wraith: true, x: r[2], y: r[3], animT: 0 };
      // a blessing that just began washes over its knight here too
      if (r[7] > (w.buff || 0) + 1) {
        const k = r[1] === DL.Net.myId ? G.player : G.allies.find((a) => a.id === r[1]);
        if (k) G.effects.push({ type: "soulPulse", x1: r[2], y1: r[3] - 30, x2: k.x, y2: k.y - 24, owner: r[1], t: 0, max: 0.7 });
        if (r[1] === DL.Net.myId) sfx("chime");
      }
      return Object.assign(w, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], state: r[6] > 0 ? "cast" : "move", stT: r[6], buff: r[7] });
    });
  };
  // Guest: glide toward the host's positions, and gather your own orbs.
  Abigail.guest = function (dt, k01) {
    for (const w of G.wraiths) {
      if (w.tx == null) continue;
      w.x += (w.tx - w.x) * k01; w.y += (w.ty - w.y) * k01;
      w.animT += dt;
      w.buff = Math.max(0, w.buff - dt);
      if (w.state === "cast") w.stT -= dt;
    }
    Abigail.gather();
  };
})(window.DL);
