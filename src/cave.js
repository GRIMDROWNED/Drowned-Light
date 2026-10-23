/* Drowned Light — Derek's Hollow: the cave where Derek is won.
   Its mouth is a unique structure in the Mire. The stones across it part only at night; walk in and every
   knight in the game is pulled down into the Hollow, a round cave arena that lies far off the map. Derek
   wakes there beside each knight who doesn't have him yet and fights with them through seven waves of the
   Drowned, each wave bringing a kind they haven't faced yet. Clear all seven and every knight who was there
   keeps their Derek. If every knight falls, the Hollow throws them out and seals until the next night.
   The world clock stops while you're below. The host's device runs the trial and tells each guest where to
   go; snapshots carry its state. The mouth and the floor are drawn (coded fallbacks until they load). Numbers: DL.CAVE (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, C = DL.CAVE;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const everyone = (m, k) => { say(m, k); DL.Net.say(m, k); };
  const DOWN = 1e9; // a knight down in the Hollow stays down until their friends clear the wave (or all fall)
  const TUNNELS = [-Math.PI / 2, -0.35, Math.PI + 0.35, 0.9, Math.PI - 0.9]; // where the Drowned pour in
  // The rock mound is solid (circles around the mouth, from its middle); the doorway between them stays open.
  const MOUND = [[-62, -50, 40], [60, -50, 38], [0, -82, 40], [-72, -2, 22], [68, -2, 22]];
  const DOOR = { x: 0, y: -14, r: 26 }; // standing here, in the doorway at the top of the steps, takes you in
  const Cave = (DL.Cave = {});
  G.cave = null;

  /* ---------------- where things are ---------------- */
  // The mouth: C.dist px from camp in the first dry spot found turning from the north-east, well away from the
  // Bone Wolf den (whose place depends on the difficulty, so this is worked out again when that changes).
  let mouth = null, mouthFor = null;
  Cave.mouth = function () {
    if (mouth && mouthFor === G.save.difficulty) return mouth;
    mouth = null;
    mouthFor = G.save.difficulty;
    const wet = (x, y) => DL.World.waterVal(x, y) < 0.36, den = DL.Den ? DL.Den.spot() : { x: 1e9, y: 0 };
    for (let k = 0; k < 60 && !mouth; k++) {
      const a = -0.8 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.13, x = Math.cos(a) * C.dist, y = Math.sin(a) * C.dist;
      let dry = !wet(x, y) && !wet(x, y - 40) && dist(x, y, den.x, den.y) > 800;
      for (let i = 0; i < 8 && dry; i++) dry = !wet(x + Math.cos((i / 8) * TAU) * 120, y - 30 + Math.sin((i / 8) * TAU) * 120);
      if (dry) mouth = { x: Math.round(x), y: Math.round(y) };
    }
    return mouth || (mouth = { x: Math.round(Math.cos(-0.8) * C.dist), y: Math.round(Math.sin(-0.8) * C.dist) });
  };
  const mound = () => { const m = Cave.mouth(); return { x: m.x, y: m.y - 40 }; };
  const door = () => { const m = Cave.mouth(); return { x: m.x + DOOR.x, y: m.y + DOOR.y }; };
  // The cave itself lies far off the map; nothing of the wetland is generated there.
  Cave.inRegion = (x, y) => Math.abs(x - C.x) < 1500 && Math.abs(y - C.y) < 1500;
  Cave.inside = (x, y) => dist(x, y, C.x, C.y) < C.radius + 60;
  // Nothing grows on the mound or right in front of the mouth.
  Cave.clears = function (x, y) { const q = mound(); return dist(x, y, q.x, q.y + 20) < 140; };
  Cave.active = () => !!G.cave;

  // The mound is solid, and nothing leaves the cave arena.
  Cave.collide = function (ent, r) {
    if (Cave.inRegion(ent.x, ent.y)) {
      const dx = ent.x - C.x, dy = ent.y - C.y, d = Math.hypot(dx, dy), max = C.radius - r;
      if (d > max) { ent.x = C.x + (dx / d) * max; ent.y = C.y + (dy / d) * max; }
      return;
    }
    const m = Cave.mouth();
    if (Math.abs(ent.x - m.x) > 140 || Math.abs(ent.y - m.y + 40) > 140) return;
    for (const [ox, oy, R] of MOUND) {
      const cx = m.x + ox, cy = m.y + oy, dx = ent.x - cx, dy = ent.y - cy, d = Math.hypot(dx, dy), min = R + r;
      if (d < min && d > 0.01) { ent.x = cx + (dx / d) * min; ent.y = cy + (dy / d) * min; }
    }
  };

  // Is Derek still to be won by this knight (0 = the host, else a friend's co-op number)?
  const hasDerek = (owner) => G.golems.some((m) => m.owner === owner && !m.trial);
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Cave.sealed = () => G.save.caveFail === G.save.nights;

  /* ---------------- the trial (host) ---------------- */
  Cave.reset = function () { G.cave = null; };

  // Host, every frame: watch the mouth while above, run the waves while below.
  Cave.update = function (dt) {
    const m = Cave.mouth();
    if (!G.save.caveFound && !G.cave && dist(G.player.x, G.player.y, m.x, m.y) < 650) {
      G.save.caveFound = 1;
      G.persist();
      say("A cave mouth in the Mire, sealed with heaped stones. Something hums deep inside.", "warn");
    }
    if (G.isGuest()) return;
    if (G.cave) return trial(dt);
    const dr = door();
    for (const k of [G.player, ...G.allies]) {
      const d = dist(k.x, k.y, dr.x, dr.y);
      k.caveHintT = Math.max(0, (k.caveHintT || 0) - dt);
      if (k.down || k.downT > 0 || d > DOOR.r) continue;
      // standing in the mouth
      const id = k === G.player ? 0 : k.id, tell = (msg, kind) => {
        if (k.caveHintT > 0) return;
        k.caveHintT = 6;
        if (id === 0) { say(msg, kind); sfx("deny"); } else DL.Net.tell(id, msg, kind);
      };
      if (![0, ...G.allies.map((a) => a.id)].some((o) => !hasDerek(o))) tell("The Hollow lies quiet. Derek already walks with you.");
      else if (!G.night) tell("The stones across the cave mouth only part at night.", "warn");
      else if (Cave.sealed()) tell("The Hollow is sealed. Try again tomorrow night.", "warn");
      else return start();
    }
  };

  function start() {
    if (G.state === "camp") DL.UI.closeCamp();
    const m = Cave.mouth();
    G.cave = { wave: 0, phase: "intro", t: C.intro, queue: [], burstT: 0, ret: { x: m.x, y: m.y + 40 }, sendT: {} };
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = []; G.walls = []; G.lightZones = [];
    G.selfEnemy = null;
    place(G.player, 0);
    G.camera.x = G.player.x; G.camera.y = G.player.y;
    for (const a of G.allies) pull(a);
    // Derek wakes beside every knight who hasn't won him yet
    for (const o of [0, ...G.allies.map((a) => a.id)]) wake(o);
    sfx("rise");
    G.camera.shake = 8;
    everyone("The ground gives way into the Hollow. Derek wakes from the stone beside you: hold out together through seven waves!", "warn");
  }
  // A spot by the heart of the cave for knight number `id`.
  function spot(id) { const a = Math.PI / 2 + id * 1.4; return { x: C.x + Math.cos(a) * 40, y: C.y + Math.sin(a) * 24 }; }
  function place(k, id) { const s = spot(id); k.x = s.x; k.y = s.y; k.kx = 0; k.ky = 0; }
  // Drag a friend down: their device moves their knight, and the host moves its copy now so the Drowned see it there.
  function pull(a) {
    const s = spot(a.id);
    a.x = a.tx = s.x; a.y = a.ty = s.y;
    G.cave.sendT[a.id] = 2;
    DL.Net.sendTo(a.id, { t: "cave", on: 1, x: s.x, y: s.y });
  }
  function wake(owner) {
    if (hasDerek(owner) || G.golems.some((m) => m.owner === owner)) return;
    const s = spot(owner);
    DL.Golems.give(owner, s.x + 26, s.y - 16, true);
  }

  function trial(dt) {
    const cv = G.cave;
    // a friend who joined late (or missed the message) is pulled in too
    for (const a of G.allies) {
      if (Cave.inRegion(a.tx, a.ty)) continue;
      cv.sendT[a.id] = (cv.sendT[a.id] || 0) - dt;
      if (cv.sendT[a.id] <= 0) { pull(a); wake(a.id); }
    }
    // everyone down: the trial is lost
    if (G.player.downT > 0 && G.allies.every((a) => a.down)) return end(false);
    if (cv.phase === "intro" || cv.phase === "rest") {
      cv.t -= dt;
      if (cv.t <= 0) startWave(cv.wave + 1);
      return;
    }
    // the wave pours out of the tunnels a few at a time
    cv.burstT -= dt;
    if (cv.queue.length && cv.burstT <= 0) {
      cv.burstT = C.burst;
      const a = DL.pick(TUNNELS), n = Math.min(cv.queue.length, cv.queue[0] === "revenant" ? 5 : 3);
      for (let i = 0; i < n; i++) {
        const r = C.radius - 30 - rand(0, 30), b = a + rand(-0.12, 0.12);
        G.enemies.push(G.makeEnemy(cv.queue.shift(), C.x + Math.cos(b) * r, C.y + Math.sin(b) * r, C.zone));
      }
      for (let i = 0; i < 8; i++) G.puff(C.x + Math.cos(a) * (C.radius - 30), C.y + Math.sin(a) * (C.radius - 30), "rgba(60,200,210,0.5)", 60, 0.8);
    }
    if (!cv.queue.length && !G.enemies.length) {
      if (cv.wave >= C.waves.length) return end(true);
      cv.phase = "rest";
      cv.t = C.rest;
      sfx("chime");
      everyone(`Wave ${cv.wave} cleared. Derek's heart flares: wounds close and the fallen rise.`, "good");
      mend(C.heal, C.rise);
    }
  }

  function startWave(n) {
    const cv = G.cave, w = C.waves[n - 1], scale = G.diff().spawn * G.partyScale();
    cv.wave = n; cv.phase = "fight"; cv.burstT = 0.5;
    // the new kind first, then the ones already met, shuffled
    const q = [], seen = C.waves.slice(0, n - 1).map((x) => x.type);
    for (let i = 0; i < Math.max(1, Math.round(w.n * scale)); i++) q.push(w.type);
    const mix = [];
    for (let i = 0; i < Math.round(w.mix * scale); i++) mix.push(DL.pick(seen));
    for (let i = mix.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [mix[i], mix[j]] = [mix[j], mix[i]]; }
    for (let i = 0; i < mix.length; i++) q.splice(Math.min(q.length, 2 + i * 2), 0, mix[i]); // the new kind leads, the rest come in among them
    cv.queue = q;
    sfx("whisper");
    everyone(`Wave ${n} of ${C.waves.length}: ${w.name}!`, n === C.waves.length ? "danger" : "warn");
  }

  // Between waves: everyone heals by `heal` of their health, and the fallen rise with `rise` of it.
  function mend(heal, rise) {
    const p = G.player, max = G.stats().maxHp;
    if (p.downT > 0) { p.downT = 0; p.hp = max * rise; p.inv = 1.5; }
    else p.hp = Math.min(max, p.hp + max * heal);
    for (const a of G.allies) DL.Net.sendTo(a.id, { t: "caveMend", heal, rise });
    for (const k of G.knights()) for (let i = 0; i < 10; i++) G.spark(k.x + rand(-10, 10), k.y - rand(0, 40), "90,235,245", 60);
  }

  function end(won) {
    const cv = G.cave, p = G.player, max = G.stats().maxHp, ret = cv.ret;
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = [];
    G.cave = null;
    if (won) {
      for (const m of G.golems) if (m.trial) m.trial = false; // every Derek who fought here stays with his knight
      G.save.golem = 1;
      sfx("milestone");
      everyone("The seventh wave breaks. Derek climbs out of the Hollow with you, and he's yours for good.", "good");
    } else {
      for (const m of G.golems) if (m.trial) { m.gone = true; for (let i = 0; i < 12; i++) G.puff(m.x + rand(-12, 12), m.y - rand(0, 20), "rgba(120,130,110,0.6)", 50, 0.9); }
      G.golems = G.golems.filter((m) => !m.gone);
      G.save.caveFail = G.save.nights;
      sfx("death");
      everyone("The Hollow casts you out and Derek sinks back into the stone. The cave is sealed until tomorrow night.", "danger");
    }
    p.downT = 0;
    p.hp = won ? max : Math.max(1, max * C.failHp);
    p.inv = 1.5;
    p.x = ret.x; p.y = ret.y; p.kx = 0; p.ky = 0;
    G.camera.x = p.x; G.camera.y = p.y;
    for (const a of G.allies) {
      const x = ret.x + 34 * a.id * (a.id % 2 ? 1 : -1) / 2, y = ret.y + 10;
      a.x = a.tx = x; a.y = a.ty = y;
      DL.Net.sendTo(a.id, { t: "cave", on: 0, won: won ? 1 : 0, x, y });
    }
    G.persist();
  }

  // A knight falls in the Hollow: not drowned, just down until the wave is cleared. Returns true when it handled the fall.
  Cave.fall = function () {
    if (!G.cave) return false;
    const p = G.player;
    if (p.downT > 0) return true;
    p.downT = DOWN;
    p.hp = 0;
    sfx("death");
    for (let i = 0; i < 24; i++) G.puff(p.x + rand(-12, 12), p.y - rand(0, 60), "rgba(60,220,230,0.7)", 50, 1.2, -30);
    say("You fall. You'll rise when the wave is cleared, if anyone still stands.", "danger");
    return true;
  };

  /* ---------------- co-op ---------------- */
  // Host: what guests need to know, in each snapshot.
  Cave.snap = () => (G.cave ? [G.cave.wave, G.cave.phase === "fight" ? 1 : 0, Math.round(G.cave.t * 10) / 10, G.cave.queue.length] : 0);
  // Guest: the trial's state from a snapshot (the moves themselves come as messages).
  Cave.applySnap = function (s) {
    G.cave = s ? { wave: s[0], phase: s[1] ? "fight" : s[0] ? "rest" : "intro", t: s[2], queue: { length: s[3] } } : null;
  };
  Cave.guestMsg = function (m) {
    const p = G.player, max = G.stats().maxHp;
    if (m.t === "caveMend") {
      if (p.downT > 0) { p.downT = 0; p.hp = max * m.rise; p.inv = 1.5; }
      else p.hp = Math.min(max, p.hp + max * m.heal);
      return;
    }
    if (m.on) {
      if (G.state === "camp") DL.UI.closeCamp();
      if (!G.cave) G.cave = { wave: 0, phase: "intro", t: C.intro, queue: { length: 0 } };
      p.downT = 0;
    } else {
      G.cave = null;
      p.downT = 0;
      p.hp = m.won ? max : Math.max(p.hp, max * C.failHp);
      if (m.won) {
        const pr = DL.Net.profile();
        pr.golem = 1; // he joins you whenever you play in a friend's world from now on
        DL.Net.saveProfile(pr);
      }
    }
    p.x = m.x; p.y = m.y; p.kx = 0; p.ky = 0; p.inv = 1.5;
    G.camera.x = p.x; G.camera.y = p.y;
    G.enemies = []; G.projectiles = [];
    sfx(m.on ? "rise" : m.won ? "milestone" : "death");
  };

  /* ---------------- HUD ---------------- */
  Cave.objective = function () {
    const cv = G.cave, n = C.waves.length;
    if (!cv) return "";
    if (G.player.downT > 0) return `You're down · you rise when wave ${cv.wave} is cleared`;
    if (cv.phase === "intro") return `Derek's Hollow · the Drowned stir in the tunnels`;
    if (cv.phase === "rest") return `Wave ${cv.wave} of ${n} cleared · wave ${cv.wave + 1} in ${Math.ceil(cv.t)}`;
    const left = G.enemies.length + cv.queue.length;
    return `Derek's Hollow · wave ${cv.wave} of ${n} · ${left} Drowned left`;
  };
  // Which way the mouth lies from camp, in words, for the Kit tab.
  Cave.where = function () {
    const m = Cave.mouth(), a = Math.atan2(-m.y, m.x);
    const names = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
    return { dir: names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8], m: Math.round(Math.hypot(m.x, m.y) / 10) };
  };
  Cave.showNav = () => !G.cave && !!G.save.caveFound && !G.golems.some((m) => m.owner === myId() && !m.trial);

  /* ---------------- light ---------------- */
  // Crystal veins light the cave with bloomlight (it halts corruption); the open mouth glows at night.
  const CRYSTALS = [{ x: 0, y: -60, r: 240, big: 1 }]; // the big one Derek slept against, then veins round the wall
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 7) * TAU + 0.2;
    CRYSTALS.push({ x: Math.round(Math.cos(a) * (C.radius - 70)), y: Math.round(Math.sin(a) * (C.radius - 70)), r: 165 });
  }
  Cave.lights = function (L) {
    const k = G.player;
    if (k && Cave.inRegion(k.x, k.y)) {
      for (const q of CRYSTALS) L.push({ x: C.x + q.x, y: C.y + q.y - 14, r: q.r * G.diff().light, s: 0.9, col: "80,230,240", a: 0.9, kind: "bloom" });
      return;
    }
    const m = Cave.mouth();
    if (G.night && !Cave.sealed() && Math.abs(k.x - m.x) < 900 && Math.abs(k.y - m.y) < 900) L.push({ x: m.x, y: m.y - 18, r: 70, s: 0.5, col: "80,230,240", a: 0.7 });
  };

  /* ---------------- drawing (the drawn mouth and floor, with coded fallbacks; the crystals and cave wall are coded) ---------------- */
  function sprite(c, name, x, y, flip) {
    const s = DL.Art.sprites[name];
    if (!s) return false;
    const w = s.w * 2, h = s.h * 2;
    c.save();
    if (flip) { c.translate(Math.round(x), 0); c.scale(-1, 1); c.drawImage(s.c, Math.round(-w / 2), Math.round(y - h), w, h); }
    else c.drawImage(s.c, Math.round(x - w / 2), Math.round(y - h), w, h);
    c.restore();
    return true;
  }
  function blob(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }

  // Cave floor colour for the ground chunks (src/world.js).
  Cave.groundColor = function (x, y) {
    const d = dist(x, y, C.x, C.y), h = DL.hash(x >> 1, y >> 1, 5), n = DL.fbm(x / 70, y / 70, 31);
    if (d > C.radius + 40) { const v = 6 + n * 6; return [v, v + 1, v + 3]; }
    let r, g, b;
    const tx = DL.World.texel("caveFloor", x, y, 0.62); // the drawn stone floor, darkened like the wetland's ground
    if (tx) [r, g, b] = tx;
    else {
      r = 46 + n * 30; g = 45 + n * 28; b = 50 + n * 28;
      if (h > 0.97) { r += 14; g += 14; b += 14; } else if (h < 0.03) { r -= 8; g -= 8; b -= 6; }
      if (DL.fbm(x / 30, y / 30, 33) > 0.66) { r -= 6; g += 6; b += 8; } // damp patches
    }
    const k = Math.max(0, Math.min(1, (d - (C.radius - 60)) / 100)); // the floor darkens up to the cave wall
    return [r * (1 - 0.7 * k), g * (1 - 0.7 * k), b * (1 - 0.6 * k)];
  };

  // On the ground: the tunnel mouths and the rune circle where Derek slept.
  Cave.drawGround = function (c, view) {
    if (view.right < C.x - 700 || view.left > C.x + 700 || view.bottom < C.y - 700 || view.top > C.y + 700) return;
    for (const a of TUNNELS) {
      const x = C.x + Math.cos(a) * (C.radius - 6), y = C.y + Math.sin(a) * (C.radius - 6);
      blob(c, x, y, 46, 28, "rgba(0,0,0,0.85)");
      blob(c, x, y, 30, 18, "#000");
    }
    c.strokeStyle = "rgba(90,235,245,0.22)";
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(C.x, C.y - 30, 92, 50, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(C.x, C.y - 30, 70, 38, 0, 0, TAU); c.stroke();
  };

  // Into the y-sorted scene: the mouth up top; the cave wall's boulders and the crystals below.
  Cave.push = function (list, c, t, view) {
    const m = Cave.mouth();
    if (m.x > view.left - 200 && m.x < view.right + 200 && m.y > view.top - 60 && m.y < view.bottom + 200) list.push({ y: m.y, f: () => drawMouth(c, m, t) });
    if (view.right < C.x - 700 || view.left > C.x + 700 || view.bottom < C.y - 700 || view.top > C.y + 700) return;
    const n = Math.round((TAU * (C.radius + 22)) / 34);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (TUNNELS.some((b) => Math.abs(DL.angleDiff(a, b)) < 0.13)) continue;
      const x = C.x + Math.cos(a) * (C.radius + 22), y = C.y + Math.sin(a) * (C.radius + 22) * 0.98, v = 1 + Math.floor(DL.hash(i, 3, 41) * 4);
      list.push({ y, f: () => { if (!sprite(c, "boulder" + v + "1", x, y + 6, DL.hash(i, 1, 42) > 0.5)) { blob(c, x, y - 12, 22, 18, "#2a2b2e"); blob(c, x - 4, y - 18, 12, 9, "#3a3b3e"); } } });
    }
    for (const q of CRYSTALS) list.push({ y: C.y + q.y, f: () => drawCrystal(c, C.x + q.x, C.y + q.y, q.big ? 1.6 : 1, t) });
  };

  function drawCrystal(c, x, y, s, t) {
    blob(c, x, y, 16 * s, 5 * s, "rgba(0,0,0,0.4)");
    const shards = [[-9, 22, -0.25], [0, 34, 0], [8, 26, 0.3], [-3, 16, -0.6], [12, 14, 0.7]];
    for (const [dx, h, lean] of shards) {
      const bx = x + dx * s, hh = h * s, tx = bx + Math.sin(lean) * hh, ty = y - Math.cos(lean) * hh;
      c.fillStyle = "#1b5a63";
      c.beginPath(); c.moveTo(bx - 4 * s, y); c.lineTo(tx, ty); c.lineTo(bx + 4 * s, y); c.closePath(); c.fill();
      c.fillStyle = `rgba(120,240,250,${0.55 + 0.25 * Math.sin(t * 2 + dx)})`;
      c.beginPath(); c.moveTo(bx - 1 * s, y - 2); c.lineTo(tx, ty); c.lineTo(bx + 2 * s, y - 2); c.closePath(); c.fill();
    }
  }

  // The mouth: a mossy rock mound with a dark arch in its face. By day (or sealed) stones block the arch;
  // on an open night its runes glow (drawn above the dark in Cave.drawGlow).
  // The drawn mouth sits with its doorway on m.x (the art's is a little right of its middle) and its steps running down past m.y.
  const ART_DX = -12, ART_DY = 30;
  function drawMouth(c, m, t) {
    const open = G.night && !Cave.sealed();
    if (DL.Art.sprites.caveOpen) {
      blob(c, m.x, m.y + 22, 92, 16, "rgba(0,0,0,0.35)");
      sprite(c, open ? "caveOpen" : "caveSealed", m.x + ART_DX, m.y + ART_DY);
      return;
    }
    const x = m.x, y = m.y;
    blob(c, x, y - 4, 92, 22, "rgba(0,0,0,0.4)");
    // the mound: overlapping rock humps, darker toward the ground
    const humps = [[-58, -26, 34, 30], [56, -24, 36, 30], [-28, -52, 40, 40], [30, -50, 40, 40], [0, -70, 46, 40], [-70, -10, 22, 16], [72, -8, 24, 16]];
    for (const [dx, dy, rx, ry] of humps) blob(c, x + dx, y + dy, rx, ry, "#3a3833");
    for (const [dx, dy, rx, ry] of humps) blob(c, x + dx - rx * 0.15, y + dy - ry * 0.25, rx * 0.7, ry * 0.55, "#4a4740");
    for (const [dx, dy, rx] of humps) blob(c, x + dx - rx * 0.2, y + dy - rx * 0.6, rx * 0.45, rx * 0.22, "rgba(78,98,62,0.85)"); // moss on top
    // the arch
    c.fillStyle = "#050607";
    c.beginPath(); c.moveTo(x - 24, y); c.lineTo(x - 24, y - 26); c.ellipse(x, y - 26, 24, 24, 0, Math.PI, 0); c.lineTo(x + 24, y); c.closePath(); c.fill();
    c.strokeStyle = "#57534a";
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(x - 26, y); c.lineTo(x - 26, y - 26); c.ellipse(x, y - 26, 26, 26, 0, Math.PI, 0); c.lineTo(x + 26, y); c.stroke();
    if (!open) {
      // heaped stones close it
      for (const [dx, dy, r] of [[-12, -6, 11], [11, -7, 12], [0, -20, 11], [-9, -30, 8], [10, -31, 8], [0, -40, 7]]) {
        blob(c, x + dx, y + dy, r, r * 0.85, "#5a564d");
        blob(c, x + dx - 3, y + dy - 3, r * 0.5, r * 0.4, "#6c675c");
      }
    }
  }

  // Above the dark: the open mouth's runes.
  Cave.drawGlow = function (c, t) {
    if (!G.night || Cave.sealed() || G.cave) return;
    const m = Cave.mouth(), a = 0.55 + 0.3 * Math.sin(t * 2.2);
    if (DL.Art.sprites.caveOpen) {
      // the drawn runes: a soft glow over each pillar's runes, the keystone's gem and the dark of the doorway
      const glow = (x, y, rx, ry, k) => {
        const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        g.addColorStop(0, `rgba(90,235,245,${k * a})`); g.addColorStop(1, "rgba(90,235,245,0)");
        c.save(); c.translate(x, y); c.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); c.translate(-x, -y);
        c.fillStyle = g; c.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2);
        c.restore();
      };
      glow(m.x - 39, m.y - 50, 9, 26, 0.5);
      glow(m.x + 37, m.y - 50, 9, 26, 0.5);
      glow(m.x - 1, m.y - 85, 12, 12, 0.8);
      glow(m.x, m.y - 36, 22, 26, 0.3);
      return;
    }
    c.fillStyle = `rgba(90,235,245,${a})`;
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI + (i / 6) * Math.PI, x = m.x + Math.cos(ang) * 33, y = m.y - 26 + Math.sin(ang) * 33;
      c.fillRect(x - 2, y - 3, 4, 6);
    }
    const g = c.createRadialGradient(m.x, m.y - 18, 0, m.x, m.y - 18, 26);
    g.addColorStop(0, `rgba(90,235,245,${0.35 * a})`); g.addColorStop(1, "rgba(90,235,245,0)");
    c.fillStyle = g;
    c.fillRect(m.x - 26, m.y - 44, 52, 52);
  };
})(window.DL);
