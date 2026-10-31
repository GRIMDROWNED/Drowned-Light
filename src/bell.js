/* Drowned Light — the Starved Bell, the boss that roams the Abyss. A great rusted bell carried on four long
   legs of bone, its mouth a ring of teeth around a clapper of vertebrae. "It rings only with hunger, and what
   it swallows is never heard again." It creeps round the Abyss buried in the mire, bursts up under whoever comes
   near, tolls to rot the light out of them, and swallows knights whole; friends cut a swallowed knight free by
   hurting it. There is one in a world; slain, it stays gone a few days. The host's device runs it; friends see
   it in the snapshots like any Drowned and are told when they're swallowed (src/net.js). Numbers: DL.BELL. */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, D = DL.BELL;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Bell = (DL.Bell = { e: null, hintT: 0 });
  const NAME = "The Starved Bell";

  // Its save: where on the ring it lies (radians round the camp), and the day it was slain (-1: it lives).
  function state() {
    const s = G.save.bell;
    if (s.a == null) s.a = DL.hash(53, 29, 7) * TAU; // every world starts it in the same place
    return s;
  }
  Bell.spot = function () {
    const s = state();
    return { x: Math.cos(s.a) * D.r, y: Math.sin(s.a) * D.r };
  };
  const nearest = (e) => Math.min(1e9, ...G.knights().map((k) => dist(k.x, k.y, e.x, e.y)));
  const name = (k) => (k === G.player ? "The host" : k.label || "A friend");
  function tell(k, msg, kind) {
    if (k === G.player) say(msg, kind);
    else DL.Net.tell(k.id, msg, kind);
  }

  /* ---------------- host ---------------- */
  Bell.update = function (dt) {
    if (G.isGuest() || G.cave) return;
    const s = state();
    Bell.hintT -= dt;
    let e = Bell.e;
    if (e && (e.removed || !G.enemies.includes(e))) Bell.e = e = null;
    if (s.dead >= 0) return;
    if (!e) {
      // nobody near: it creeps on round the ring, deep in the mud
      s.a = (s.a + D.roam * dt) % TAU;
      const at = Bell.spot();
      if (DL.Finale.fighting()) return; // it keeps away from the Sunken King's arena (src/finale.js)
      if (!G.knights().some((k) => dist(k.x, k.y, at.x, at.y) < D.spawn)) return;
      e = Bell.e = G.makeEnemy("bell", at.x, at.y, 4, { dormant: true, tollT: 3, gulpT: 4, angle: Math.atan2(-at.y, -at.x) });
      G.enemies.push(e);
      if (Bell.hintT <= 0) {
        Bell.hintT = 90;
        sfx("toll");
        const msg = "A bell tolls somewhere in the dark: low, slow, and hungry.";
        say(msg, "warn");
        DL.Net.say(msg, "warn");
      }
      return;
    }
    const near = nearest(e);
    if (near > D.forget && !e.meal) { sink(e); return; }
    if (e.dormant) creep(e, dt, near);
    if (e.meal) feed(e, dt);
    // it never leaves the Abyss: chase it to the edge and it stops there
    const minR = DL.ZONES[4].r + 120, r = Math.hypot(e.x, e.y);
    if (r < minR) { e.x *= minR / r; e.y *= minR / r; }
  };

  // Everyone left: it sinks back into the deep, whole again, and goes on roaming from there.
  function sink(e) {
    state().a = Math.atan2(e.y, e.x);
    e.removed = true;
    G.enemies = G.enemies.filter((q) => q !== e);
    Bell.e = null;
  }

  // Buried, it slides on along the ring, leaving a wake in the mud; it lies still once someone is close.
  function creep(e, dt, near) {
    if (near < 520) { e.moving = false; return; }
    const a = Math.atan2(e.y, e.x) + 0.2, tx = Math.cos(a) * D.r, ty = Math.sin(a) * D.r;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * D.creep * dt; e.y += (dy / d) * D.creep * dt;
    e.angle = Math.atan2(dy, dx);
    if (Math.random() < 0.15) G.puff(e.x + rand(-30, 30), e.y + rand(-6, 6), "rgba(60,200,210,0.4)", 20, 0.8);
  }

  // Whatever it's doing, awake (called from the Drowned's behaviour in src/game.js).
  Bell.behave = function (e, dt, p, dp) {
    if (!e.erupted) erupt(e);
    if (e.meal || e.gulp) return;
    e.tollT -= dt;
    e.gulpT -= dt;
    if (e.tollT <= 0 && dp < D.tollR + 60 && e.state === "move") toll(e);
  };

  // The ambush: up out of the mire in a ring of mud and teeth.
  function erupt(e) {
    e.erupted = true;
    e.stun = 0.5; // a beat to see what rose before it strikes
    G.telegraphs.push({ by: e.def.name, x: e.x, y: e.y, r: D.erupt, t: 0, delay: 0.25, dmg: e.dmg * 0.6 });
    for (let i = 0; i < 24; i++) G.puff(e.x + rand(-60, 60), e.y + rand(-14, 14), "rgba(60,200,210,0.6)", 120, 0.9, -40);
    G.camera.shake = 10;
    sfx("rise");
    const msg = NAME + " bursts from the mire!";
    say(msg, "danger");
    DL.Net.say(msg, "danger");
  }

  // The toll: a ring of sound that wounds, seeps corruption into you and makes torches gutter.
  function toll(e) {
    e.tollT = D.tollEvery * (e.hp < e.maxHp / 2 ? 0.7 : 1);
    G.telegraphs.push({ by: e.def.name, x: e.x, y: e.y, r: D.tollR, t: 0, delay: 1, dmg: e.dmg * 0.55, corrupt: D.tollCorrupt });
    for (const max of [0.9, 1.2, 1.5]) G.effects.push({ type: "ring", x: e.x, y: e.y - 50, r0: 24, r1: D.tollR, col: "150,230,240", w: 6, t: 0, max });
    G.text(e.x, e.y - 150, "TOLL", "#9fdfe6", 1.2);
    for (const t of G.torches) if (dist(e.x, e.y, t.x, t.y) < D.tollR) t.t = Math.max(0, t.t - 15);
    sfx("toll");
  }

  /* Its swallow: it rears (the lane it will lunge down shows on the ground), then lunges mouth first.
     Returns true while it's busy with that or with eating, so it neither walks nor claws. */
  Bell.busy = function (e, dt, p, dp) {
    if (e.meal) { e.state = "recover"; e.stT = 0.3; e.moving = false; return true; } // mouth clamped round its meal
    const g = e.gulp;
    if (g) {
      e.moving = false;
      e.aim = e.angle = g.ang;
      g.t -= dt;
      if (g.t > 0) { e.state = "windup"; e.stT = g.t * (e.def.windup / D.gulpWindup); return true; }
      if (!g.lunged) {
        g.lunged = true;
        g.bite = 0.4;
        e.kx += Math.cos(g.ang) * D.lunge; e.ky += Math.sin(g.ang) * D.lunge;
        sfx("bite");
      }
      e.state = "recover"; e.stT = 0.3;
      g.bite -= dt;
      const mx = e.x + Math.cos(g.ang) * 40, my = e.y + Math.sin(g.ang) * 40;
      const k = G.knights().find((q) => !(q.dashT > 0) && !(q === G.player && q.inv > 0.6) && dist(q.x, q.y, mx, my) < 48);
      if (k) swallow(e, k);
      else if (g.bite <= 0) { e.gulp = null; e.state = "move"; e.cd = 0.8; }
      return true;
    }
    if (e.gulpT <= 0 && e.state === "move" && dp < D.gulpR && !p.hound && !e.dormant) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      e.gulp = { t: D.gulpWindup, ang };
      e.gulpT = D.gulpEvery * (e.hp < e.maxHp / 2 ? 0.75 : 1);
      for (let i = 1; i <= 3; i++) G.telegraphs.push({ by: e.def.name, x: e.x + Math.cos(ang) * 46 * i, y: e.y + Math.sin(ang) * 46 * i, r: 30, t: 0, delay: D.gulpWindup, dmg: 0 });
      return true;
    }
    return false;
  };

  function swallow(e, k) {
    e.gulp = null;
    e.meal = { k, t: D.hold, tick: 0.3, hp0: e.hp };
    e.state = "recover"; e.stT = 0.1;
    hold(k, e, D.hold + 0.6);
    G.camera.shake = 9;
    sfx("growl");
    tell(k, NAME + " swallows you whole! Your friends can cut you free.", "danger");
    const msg = `${name(k)} is swallowed by ${NAME}! Strike it to cut them free.`;
    if (k !== G.player) say(msg, "danger");
    for (const a of G.allies) if (a !== k) DL.Net.tell(a.id, msg, "danger");
  }
  // Pin a knight in its mouth (dur > 0), or let them go (dur 0). A friend's device pins its own knight.
  function hold(k, e, dur, ang = 0) {
    k.swallowed = dur > 0;
    if (k === G.player) G.hold(e.x, e.y - 2, dur, ang);
    else DL.Net.holdAlly(k, Math.round(e.x), Math.round(e.y - 2), dur, ang);
  }

  function feed(e, dt) {
    const m = e.meal, k = m.k;
    const gone = k === G.player ? G.state !== "play" || k.downT > 0 : k.down || !G.allies.includes(k);
    if (gone) { k.swallowed = false; e.meal = null; e.state = "move"; return; }
    m.t -= dt;
    m.tick -= dt;
    if (m.tick <= 0) {
      m.tick = 0.6;
      const dmg = e.dmg * D.bite;
      if (k === G.player) G.hurtPlayer(dmg, 0, DL.ENEMIES.bell.name); else DL.Net.hurtAlly(k, dmg, 0);
      if (Math.random() < 0.8) sfx("bite");
    }
    if (m.t <= 0) spit(e, false);
    else if (e.hp < m.hp0 - D.free * e.maxHp) spit(e, true);
  }
  // Out it comes: hurled from the mouth. Cut free, the bell reels.
  function spit(e, freed) {
    const k = e.meal.k;
    e.meal = null;
    e.state = "move";
    e.cd = 1;
    e.gulpT = Math.max(e.gulpT, 3);
    if (freed) e.stun = 1.2;
    hold(k, e, 0, e.angle);
    for (let i = 0; i < 14; i++) G.puff(e.x + Math.cos(e.angle) * 30, e.y - 30, "rgba(60,220,230,0.7)", 120, 0.6);
    tell(k, freed ? "You're cut free of the bell!" : "The bell spits you out.", freed ? "good" : "warn");
  }

  // Slain: it lets go of whoever it held, and the Abyss is quiet for a few days.
  Bell.slain = function (e) {
    if (e.meal) spit(e, true);
    const s = state();
    s.dead = G.save.day;
    s.a = DL.rand(0, TAU); // it rises again somewhere else on the ring
    Bell.e = null;
    G.persist();
    const msg = NAME + " cracks and falls silent.";
    say(msg, "good");
    DL.Net.say(msg, "good");
    DL.Trophies.won("bell");
  };
  Bell.dawn = function () {
    const s = state();
    if (s.dead >= 0 && G.save.day - s.dead >= D.respawnDays) { s.dead = -1; G.persist(); }
  };
  Bell.reset = function () { Bell.e = null; };
})(window.DL);
