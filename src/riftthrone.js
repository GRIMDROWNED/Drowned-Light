/* Drowned Light — the Lord of the Rift Throne, the Abyssal Spires' boss (step 7 of the Level 2 plan), drawn by Robert.
   (Robert is still to name him; the in-game name is a stand-in, DL.ENEMIES.riftlord.)

   He sleeps on his throne at the top of the Spires. Step into the arena and its ways out seal: he wakes, rises, and his
   three minions climb out of the floor (src/spirefoes.js, DL.MINIONS.riftlord). Then three phases of bullet patterns:
     1  side on, walking: Glaive Slam (a ring where the glaive lands and a wall with one gap) and Rift Storm (a spiral)
     2  below 66%: he kneels, cracked open (no blow lands), and fights front on: Sweep (fans swung across you), a
        thicker Storm, Rift Tears (bursts opening round you), and he blinks across the arena
     3  below 33%: he kneels again, and from then on the rift behind him also pours a slow spiral
   Beaten, the run is won: his reward goes into the run's loot, the arena's arch takes everything home, and (once per
   device) the Chain Reaper can be chosen for new games. Numbers: DL.BULLETS.riftlord (src/data.js). Host only. */
"use strict";
(function (DL) {
  const G = DL.Game, B = DL.BULLETS, TAU = Math.PI * 2, rand = DL.rand;
  const T = () => B.riftlord;
  const RT = (DL.RiftThrone = {});
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const DOWN = Math.PI / 2;
  const sideOn = (a) => (Math.cos(a) >= 0 ? 0 : Math.PI);

  RT.lord = () => G.enemies.find((e) => e.def.riftlord && !e.removed);
  // Out of his sleep: he sits up in front of his throne (src/spires.js seals the arena and calls this)
  RT.wake = function (room) {
    const s = DL.Spires.seat();
    const e = G.makeEnemy("riftlord", s.x, s.y, DL.SPIRES.wave.zone, { room, heat: 1, act: "waking", t: T().wake, phase: 0, anim: ["waking", 0, DOWN], lift: s.lift, mStart: true });
    e.angle = DOWN;
    G.enemies.push(e);
    G.camera.shake = 8;
    DL.Sound.play("whisper");
    say("On the throne, a crack of light opens down a stone face. The Lord of the Rift Throne wakes.", "danger");
    return e;
  };
  // where a minion climbs out: on the arena floor near him
  RT.callSpot = function (b) {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), r = rand(90, 220), x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r * 0.8;
      if (DL.Spires.canStand(b, x, y, 30)) return { x, y };
    }
    return { x: b.x, y: b.y + 60 };
  };
  // what a blow does: nothing while he wakes, kneels or blinks
  RT.soak = (e, d) => (e.act === "waking" || e.act === "rising" || e.act === "kneel" || (e.fade != null && e.fade < 0.5) ? 0 : d);

  /* ---------------- each frame (SpireFoes.busy) ---------------- */
  RT.busy = function (e, dt, p, dp) {
    const S = T(), sc = e.def.scale;
    e.moving = false;
    if (e.act === "waking" || e.act === "rising") return intro(e, dt);
    // a phase change: kneel, burst, call
    const f = e.hp / e.maxHp, want = f < S.phase[1] ? 2 : f < S.phase[0] ? 1 : 0;
    if (want > e.phase && e.act !== "kneel") return kneel(e, want);
    if (e.pour) { e.pour.x = e.x; e.pour.y = e.y - 120 * sc; }
    if (!e.act) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.phase === 0) { // side on, walking within the band
        const want = dp < S.keep[0] ? -1 : dp > S.keep[1] ? 1 : 0;
        if (want) {
          e.x += Math.cos(a) * want * e.speed * dt; e.y += Math.sin(a) * want * e.speed * dt;
          e.angle = want > 0 ? a : a + Math.PI; e.moving = true; e.anim = null;
        } else { e.angle = a; e.anim = ["idle", 0, sideOn(a)]; }
      } else e.anim = ["p2", 0, DOWN]; // front on, cracked open
      e.next = (e.next == null ? 1.2 : e.next) - dt;
      if (e.next <= 0) start(e, p, a);
      return;
    }
    e.t -= dt;
    ({ raise, hit, storm, sweep, tears, blinkOut, blinkIn, kneel: kneeling, after })[e.act](e, dt, p);
  };
  function intro(e, dt) {
    const S = T();
    e.t -= dt;
    if (e.act === "waking" && e.t <= 0) { e.act = "rising"; e.t = S.rise; e.anim = ["rising", 0, DOWN]; }
    else if (e.act === "rising") {
      e.lift = DL.Spires.seat().lift * Math.max(0, e.t / S.rise);
      e.y += 40 * dt; // he steps down off the dais
      if (e.t <= 0) {
        e.act = null; e.lift = 0; e.anim = null; e.next = 0.8;
        const set = DL.MINIONS.riftlord;
        for (const type in set) if (set[type].start) DL.Minions.call(e, type, set[type].start);
        say("He takes up his glaive. Find the gaps!", "danger");
      }
    }
  }
  function start(e, p, a) {
    const S = T(), ph = e.phase, roll = Math.random();
    e.aim = a;
    if (ph === 0) {
      if (roll < 0.55) { e.act = "raise"; e.t = S.slam.raise; e.anim = ["attack", 0, sideOn(a)]; e.angle = sideOn(a); }
      else beginStorm(e);
      return;
    }
    if (roll < 0.3) { e.act = "sweep"; e.t = S.sweep.wind; e.anim = ["sweep", 0, DOWN]; e.fans = 0; }
    else if (roll < 0.55) beginStorm(e);
    else if (roll < 0.8) {
      e.act = "tears"; e.t = S.tears.open; e.anim = ["enraged", 0, DOWN];
      const n = S.tears.n[ph - 1], a0 = rand(0, TAU);
      e.tearAt = Array.from({ length: n }, (_, i) => { const q = a0 + (i / n) * TAU, r = rand(S.tears.r[0], S.tears.r[1]); return { x: p.x + Math.cos(q) * r, y: p.y + Math.sin(q) * r * 0.8 }; });
      DL.Sound.play("whisper");
    } else { e.act = "blinkOut"; e.t = S.blink.out; }
  }
  function beginStorm(e) {
    const S = T().storm, ph = e.phase;
    e.act = "storm"; e.t = S.time;
    e.anim = ph === 0 ? ["attack", 2, DOWN] : ["p2", 0, DOWN];
    DL.Bullets.spiral(e.x, e.y - 120 * e.def.scale, S.arms[ph], S.rate, ph === 2 ? -S.spin : S.spin, S.time, { by: "the Rift Storm", dmg: S.dmg, speed: S.speed, kind: 1 }, e);
    DL.Sound.play("whisper");
  }
  const after = (e) => { if (e.t <= 0) { e.act = null; e.anim = null; e.next = T().every[e.phase]; } };
  const done = (e, t) => { e.act = "after"; e.t = t; };
  // Glaive Slam: raised high, then down where it reaches toward you
  function raise(e) {
    if (e.t > 0) return;
    const S = T().slam, sc = e.def.scale, a = e.aim;
    e.act = "hit"; e.t = S.hit; e.anim = ["attack", 1, sideOn(a)];
    const ix = e.x + Math.cos(a) * 90 * sc, iy = e.y + Math.sin(a) * 60 * sc, p = G.player;
    G.camera.shake = 9;
    for (let i = 0; i < 18; i++) G.puff(ix + rand(-30, 30), iy - rand(0, 20), "rgba(220,170,255,0.8)", 110, 0.7);
    DL.Sound.play("hit");
    if (Math.hypot(p.x - ix, p.y - iy) < S.r && !(p.inv > 0) && !(p.dashT > 0)) G.hurtPlayer(e.dmg, a, e.def.name);
    const o = { by: "the Lord of the Rift Throne's glaive", dmg: S.dmg, speed: S.speed, kind: 1 };
    DL.Bullets.ring(ix, iy - 10, S.ring[e.phase], rand(0, TAU), o);
    DL.Bullets.later(0.35, e, () => DL.Bullets.wall(e.x, e.y - 40, Math.atan2(p.y - e.y, p.x - e.x), S.wall[0], S.wall[1], S.wall[2], { ...o, kind: 0 }));
  }
  function hit(e) { if (e.t <= 0) done(e, 0.35); }
  function storm(e) { if (e.t <= 0) done(e, 0.3); }
  // Sweep: fans swung across you one after another, each turned a little further
  function sweep(e, dt, p) {
    const S = T().sweep;
    if (e.t > 0) return;
    if (e.fans >= S.fans) return done(e, 0.4);
    const dir = e.id % 2 ? 1 : -1, a = Math.atan2(p.y - (e.y - 60), p.x - e.x) + dir * (e.fans - (S.fans - 1) / 2) * S.turn;
    DL.Bullets.fan(e.x, e.y - 60 * e.def.scale, a, S.n, S.spread, { by: "the Lord's sweep", dmg: S.dmg, speed: S.speed, kind: 0 });
    e.fans++; e.t = S.gap;
    if (e.fans === 1) DL.Sound.play("hit");
  }
  // Rift Tears: marked round you, then each bursts into a ring
  function tears(e) {
    if (e.t > 0) return;
    const S = T().tears;
    for (const q of e.tearAt) {
      DL.Bullets.ring(q.x, q.y - 20, S.ring, rand(0, TAU), { by: "a rift tear", dmg: S.dmg, speed: S.speed, kind: 1 });
      for (let i = 0; i < 6; i++) G.puff(q.x + rand(-10, 10), q.y - rand(0, 30), "rgba(235,200,255,0.8)", 70, 0.5);
    }
    e.tearAt = null;
    DL.Sound.play("chime");
    done(e, 0.4);
  }
  // Blink: fades out, crosses the arena, fades in
  function blinkOut(e) {
    const S = T().blink;
    e.fade = Math.max(0, e.t / S.out);
    if (e.t > 0) return;
    const p = G.player, f = DL.Spires.floorOf(e.room);
    for (let i = 0; i < 20; i++) {
      const x = DL.rand(f[0] + 120, f[2] - 120) + DL.SPIRES.x, y = DL.rand(f[1] + 120, f[3] - 120) + DL.SPIRES.y;
      if (!DL.Spires.canStand(e, x, y, 50) || Math.hypot(x - p.x, y - p.y) < S.far) continue;
      e.x = x; e.y = y; e.spx = x; e.spy = y; break;
    }
    e.act = "blinkIn"; e.t = S.in;
  }
  function blinkIn(e) {
    e.fade = 1 - Math.max(0, e.t / T().blink.in);
    if (e.t <= 0) { e.fade = null; done(e, 0.2); }
  }
  // A phase falls: he kneels, the rift blazes, a ring bursts out twice
  function kneel(e, ph) {
    const S = T();
    e.phase = ph; e.act = "kneel"; e.t = S.kneel; e.anim = ["enraged", 0, DOWN]; e.fade = null;
    G.camera.shake = 10;
    DL.Sound.play("whisper");
    const o = { by: "the Lord of the Rift Throne's fury", dmg: S.slam.dmg, speed: 120, kind: 1 };
    DL.Bullets.later(0.6, e, () => DL.Bullets.ring(e.x, e.y - 80, 24, rand(0, TAU), o));
    DL.Bullets.later(1.1, e, () => DL.Bullets.ring(e.x, e.y - 80, 24, Math.PI / 24, o));
    say(ph === 1 ? "His armour cracks open and crystal pours out of it. The rift behind him tears wider!" : "He falls to one knee and the rift pours down on the arena!", "danger");
  }
  function kneeling(e) {
    for (let i = 0; i < 2; i++) G.puff(e.x + rand(-40, 40), e.y - rand(40, 220), "rgba(230,190,255,0.75)", 90, 0.6);
    if (e.t > 0) return;
    if (e.phase === 2 && !e.pour) { const P = T().pour; e.pour = DL.Bullets.spiral(e.x, e.y - 120 * e.def.scale, P.arms, P.rate, P.spin, 9999, { by: "the pouring rift", dmg: P.dmg, speed: P.speed, kind: 1 }, e); }
    done(e, 0.2);
  }

  /* ---------------- slain ---------------- */
  RT.slain = function (e) {
    const S = T();
    e.removed = true;
    DL.Bullets.clear(); // his patterns go out with him
    G.effects.push({ type: "dissolve", e, t: 0, max: 2.4 });
    for (let i = 0; i < 50; i++) G.puff(e.x + rand(-60, 60), e.y - rand(0, 280), "rgba(235,200,255,0.85)", 120, 1.6, -30);
    G.camera.shake = 14;
    DL.Sound.play("milestone");
    G.save.riftlord = (G.save.riftlord || 0) + 1;
    DL.Spires.won(S.reward);
    G.persist();
    say("The Lord of the Rift Throne drops to his knees, and the rift behind him tears him apart into light.", "good");
    if (!G.kitOpen("chainReaper")) {
      G.unlockKit("chainReaper", true);
      setTimeout(() => say("Out of the light where he fell steps a knight in a violet gas mask, a chain sickle at his hip. The Chain Reaper answers you now: choose him when you begin a new game.", "good"), 3500);
    }
  };

  /* ---------------- drawing ---------------- */
  // where his glaive will land, and the rift tears, glowing on the floor
  RT.drawMark = function (c, e, t) {
    const S = T(), sc = e.def.scale;
    c.save();
    c.globalCompositeOperation = "lighter";
    if (e.act === "raise") {
      const k = 1 - Math.max(0, e.t) / S.slam.raise, ix = e.x + Math.cos(e.aim) * 90 * sc, iy = e.y + Math.sin(e.aim) * 60 * sc;
      c.strokeStyle = `rgba(230,160,255,${0.35 + 0.5 * k})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(ix, iy, S.slam.r, S.slam.r * 0.55, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(190,110,255,${0.1 + 0.25 * k})`;
      c.beginPath(); c.ellipse(ix, iy, S.slam.r * k, S.slam.r * 0.55 * k, 0, 0, TAU); c.fill();
    }
    if (e.act === "tears" && e.tearAt) {
      const k = 1 - Math.max(0, e.t) / S.tears.open;
      for (const q of e.tearAt) {
        c.strokeStyle = `rgba(240,200,255,${0.4 + 0.5 * k})`; c.lineWidth = 2;
        c.beginPath(); c.moveTo(q.x, q.y - 30 * k); c.lineTo(q.x + 5, q.y - 5); c.lineTo(q.x - 4, q.y + 4); c.lineTo(q.x, q.y + 26 * k); c.stroke();
        c.fillStyle = `rgba(190,110,255,${0.1 + 0.2 * k})`;
        c.beginPath(); c.ellipse(q.x, q.y, 34, 18, 0, 0, TAU); c.fill();
      }
    }
    c.restore();
  };
  // asleep on his throne, until the arena wakes him (src/spires.js draws it among the props)
  RT.drawSleeping = function (c, x, y, t) {
    const sc = DL.ENEMIES.riftlord.scale, breath = Math.sin(t * 1.3) * 1.5;
    DL.Art.drawUnit(c, "riftlord", "seated", 0, DOWN, x, y + breath * 0.3, sc, {});
  };
})(window.DL);
