/* Drowned Light — the Abyssal Spires' first foes (step 3 of docs: Level 2 plan), each built round a bullet pattern
   (src/bullets.js), drawn by Robert (tools/cut_ai_sprites.py, assets/sprites/spires-foes/).

   Chain Leaper: stalks you, crouches, and leaps at where you stand. A ring marks the landing; it slams down there and
     a ring of crystal shards bursts out. Dash out from under it, then thread the ring.
   Bridge Bowman: keeps its distance, draws, and looses parallel lanes of crystal arrows down the line at you. One lane
     is always left empty, and while it draws, faint lines show every lane but that one.
   Mist Shade: lurks faded (hard to see, hard to hurt) until your light finds it, surfaces, throws a fan of mist bolts,
     then fades and slips away. A burning Aether Crystal or a torch near it holds it in the open.
   Rift Caller: floats far back, tears small rifts open round you that each spit aimed bursts, and calls Drowned up out
     of the mist to fight for it.
   Prism Knight (elite): its crystal shield soaks most of a blow from the front (go round it); what it soaks, and a
     slow count of its own, it bursts back out as a ring of bullets. Close in and it bashes with the shield.
   All read e.heat (0..1, set by the room, src/spires.js): gentle by the hub, dense deep in. They run their own moves
   (game.js calls SpireFoes.busy in place of the Drowned's walk-and-strike); e.pose (0, 1, 2 = attackA, B, C) picks the
   drawn frame and e.lift raises the Leaper off its shadow. Numbers: DL.BULLETS.leaper / .bowman (src/data.js). */
"use strict";
(function (DL) {
  const G = DL.Game, B = DL.BULLETS, TAU = Math.PI * 2;
  const F = (DL.SpireFoes = {});
  const heat = (e) => Math.max(0, Math.min(1, e.heat || 0));
  const L = (e, r) => r[0] + (r[1] - r[0]) * heat(e);
  const N = (e, r) => Math.round(L(e, r));
  const rand = DL.rand;

  F.busy = function (e, dt, p, dp) {
    const k = e.def.spire;
    if (!k) return false;
    e.state = "move";
    if (DL.Kits.frozen(e)) { e.moving = false; return true; } // frozen solid: it holds still
    if (k !== "shade" && !e.act && DL.Spires.hidden(p, e)) { prowl(e, dt); return true; } // lost you in the mist: it prowls
    ({ leaper, bowman, shade, caller, prism })[k](e, dt, p, dp);
    return true;
  };
  // what a blow does to it (hitEnemy in game.js; ang is the way the blow drives it): a faded Shade is hard to touch,
  // the Prism Knight's shield soaks a blow from the front
  F.soak = function (e, d, ang) {
    if (e.def.spire === "shade" && e.fade < 0.6) return d * B.shade.faded;
    if (e.def.spire === "prism" && e.act !== "bash") {
      const S = B.prism, front = Math.cos(ang - (e.angle + Math.PI)) > Math.cos(S.front);
      if (front) {
        e.soaked = (e.soaked || 0) + d * (1 - S.soak);
        e.glint = 0.25;
        return d * S.soak;
      }
    }
    return d;
  };

  // walk toward (+1), away from (-1) or round (0) the knight
  function step(e, dt, p, want, k = 1) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    let mx = (dx / d) * want, my = (dy / d) * want;
    if (want === 0) { const s = Math.sin(G.t * 0.7 + e.id) > 0 ? 1 : -1; mx = (-dy / d) * s; my = (dx / d) * s; }
    const spd = e.speed * k * (e.slow > 0 ? 0.6 : 1);
    e.x += mx * spd * dt; e.y += my * spd * dt;
    e.angle = want === 0 ? Math.atan2(dy, dx) : Math.atan2(my, mx);
    e.moving = true;
  }

  // lost in the mist: wander slowly, and start fresh when it finds you again
  function prowl(e, dt) {
    e.pose = null;
    e.wanderA = (e.wanderA == null ? rand(0, TAU) : e.wanderA) + rand(-2, 2) * dt;
    e.x += Math.cos(e.wanderA) * e.speed * 0.35 * dt; e.y += Math.sin(e.wanderA) * e.speed * 0.35 * dt;
    e.angle = e.wanderA; e.moving = true;
    e.next = Math.max(e.next || 0, 0.8);
  }

  /* ---------------- the Chain Leaper ---------------- */
  function leaper(e, dt, p, dp) {
    const S = B.leaper;
    if (e.next == null) e.next = rand(1, 2);
    if (!e.act) {
      e.pose = null;
      step(e, dt, p, dp > 150 ? 1 : 0, dp > 150 ? 1 : 0.6);
      e.next -= dt;
      if (e.next <= 0 && dp < S.reach) {
        e.act = "crouch"; e.t = S.crouch; e.pose = 0; e.moving = false;
        // the landing: where you stand, no farther than its leap
        const a = Math.atan2(p.y - e.y, p.x - e.x), far = Math.min(dp, L(e, S.hop));
        let tx = e.x + Math.cos(a) * far, ty = e.y + Math.sin(a) * far;
        for (let i = 0; i < 6 && !DL.Spires.canStand(e, tx, ty); i++) { tx = (tx + e.x) / 2; ty = (ty + e.y) / 2; }
        e.tx = tx; e.ty = ty; e.aim = a; e.angle = a;
      }
      return;
    }
    e.moving = false;
    e.t -= dt;
    if (e.act === "crouch") {
      if (Math.random() < 0.3) G.puff(e.x + rand(-12, 12), e.y, "rgba(200,150,255,0.6)", 40, 0.4);
      if (e.t <= 0) { e.act = "air"; e.t = S.air; e.pose = 1; e.x0 = e.x; e.y0 = e.y; }
    } else if (e.act === "air") {
      const u = 1 - Math.max(0, e.t) / S.air;
      e.x = e.x0 + (e.tx - e.x0) * u; e.y = e.y0 + (e.ty - e.y0) * u;
      e.lift = S.peak * Math.sin(Math.PI * u);
      if (e.t <= 0) slam(e, p);
    } else if (e.act === "slam") {
      if (e.t <= 0) { e.act = null; e.pose = null; e.next = L(e, S.every); }
    }
  }
  function slam(e, p) {
    const S = B.leaper;
    e.act = "slam"; e.t = S.slam; e.pose = 2; e.lift = 0;
    e.x = e.tx; e.y = e.ty;
    G.camera.shake = Math.max(G.camera.shake || 0, 4);
    for (let i = 0; i < 14; i++) G.puff(e.x + rand(-22, 22), e.y - rand(0, 10), "rgba(210,160,255,0.75)", 90, 0.6);
    DL.Sound.play("hit");
    if (Math.hypot(p.x - e.x, p.y - e.y) < S.hitR && !(p.inv > 0) && !(p.dashT > 0))
      G.hurtPlayer(e.dmg, Math.atan2(p.y - e.y, p.x - e.x), e.def.name);
    // the shard ring: one, or two turned half a gap so the second fills the first's holes
    const n = N(e, S.ring), rings = N(e, S.rings), sp = L(e, S.speed), x = e.x, y = e.y - 10, o0 = rand(0, TAU);
    const o = { by: "a Chain Leaper's shards", dmg: S.dmg, speed: sp, kind: 1 };
    DL.Bullets.ring(x, y, n, o0, o);
    for (let i = 1; i < rings; i++) DL.Bullets.later(i * 0.3, e, () => DL.Bullets.ring(x, y, n, o0 + Math.PI / n, o));
  }

  /* ---------------- the Bridge Bowman ---------------- */
  function bowman(e, dt, p, dp) {
    const S = B.bowman;
    if (e.next == null) e.next = rand(1.2, 2.2);
    if (!e.act) {
      e.pose = null;
      const near = S.keep[0], far = S.keep[1];
      step(e, dt, p, dp < near ? -1 : dp > far ? 1 : 0, dp < near ? 1 : dp > far ? 1 : 0.45);
      e.next -= dt;
      if (e.next <= 0 && dp < S.reach) {
        e.act = "draw"; e.t = S.draw; e.pose = 0; e.moving = false;
        e.aim = Math.atan2(p.y - 18 - (e.y - S.hand), p.x - e.x); e.angle = e.aim;
        e.lanes = N(e, S.lanes); e.safe = 1 + Math.floor(Math.random() * (e.lanes - 2));
        e.width = L(e, S.width);
      }
      return;
    }
    e.moving = false;
    e.t -= dt;
    if (e.act === "draw") {
      if (e.t <= 0) { loose(e); e.act = "loose"; e.t = S.loose; e.pose = 1; }
    } else if (e.act === "loose") {
      if (e.t <= 0) { e.act = "quiver"; e.t = S.quiver; e.pose = 2; }
    } else if (e.t <= 0) { e.act = null; e.pose = null; e.next = L(e, S.every); }
  }
  // where lane i starts: spread across the line of fire at the bow
  function laneAt(e, i) {
    const s = (i / (e.lanes - 1) - 0.5) * e.width, nx = -Math.sin(e.aim), ny = Math.cos(e.aim);
    return [e.x + Math.cos(e.aim) * 20 + nx * s, e.y - B.bowman.hand + Math.sin(e.aim) * 20 + ny * s];
  }
  function loose(e) {
    const S = B.bowman, o = { by: "a Bridge Bowman's arrows", dmg: S.dmg, speed: L(e, S.speed), kind: 2 }, per = N(e, S.per);
    for (let i = 0; i < e.lanes; i++) {
      if (i === e.safe) continue;
      const [x, y] = laneAt(e, i);
      DL.Bullets.lane(x, y, e.aim, per, S.step, o);
    }
    DL.Sound.play("chime");
  }

  /* ---------------- the Mist Shade ---------------- */
  function shade(e, dt, p, dp) {
    const S = B.shade;
    if (e.fade == null) { e.fade = 0.2; e.next = rand(0.8, 1.6); }
    e.lift = S.hover + Math.sin(G.t * 2.2 + e.id) * 5;
    const held = DL.Spires.lightAt(e.x, e.y); // light holds it in the open
    if (!e.act) {
      e.fade = Math.max(held ? 1 : 0.2, e.fade - dt * 2);
      e.pose = held ? null : 2;
      // drift round the knight at a distance, slowly
      const want = dp > S.lurk[1] ? 1 : dp < S.lurk[0] ? -1 : 0;
      step(e, dt, p, want, want === 0 ? 0.35 : 0.8);
      e.next -= dt;
      const find = DL.Spires.misty(p.x, p.y) ? S.find[0] : S.find[1];
      if (e.next <= 0 && (dp < find || held)) { e.act = "surface"; e.t = S.surface; e.pose = 0; e.aim = Math.atan2(p.y - 18 - (e.y - e.lift - 40), p.x - e.x); }
      return;
    }
    e.moving = false;
    e.t -= dt;
    if (e.act === "surface") {
      e.fade = Math.min(1, e.fade + dt / S.surface);
      if (e.t <= 0) { e.act = "gather"; e.t = S.gather; e.pose = 0; }
    } else if (e.act === "gather") {
      e.aim = Math.atan2(p.y - 18 - (e.y - e.lift - 40), p.x - e.x); e.angle = e.aim;
      if (Math.random() < 0.5) G.puff(e.x + Math.cos(e.aim) * 20, e.y - e.lift - 44, "rgba(200,160,255,0.7)", 30, 0.4);
      if (e.t <= 0) { throwFan(e); e.act = "throw"; e.t = S.throw; e.pose = 1; }
    } else if (e.act === "throw") {
      if (e.t <= 0) { e.act = "fade"; e.t = S.fade; e.pose = 2; }
    } else {
      e.fade = Math.max(held ? 1 : 0.2, e.fade - dt / S.fade);
      if (e.t <= 0) {
        // slips away through the mist to somewhere else round you
        for (let i = 0; i < 8; i++) G.puff(e.x + rand(-14, 14), e.y - e.lift - rand(0, 60), "rgba(170,130,230,0.6)", 50, 0.6);
        if (!held) {
          const a = rand(0, TAU), r = L(e, S.blink);
          for (let k = 0; k < 8; k++) {
            const x = p.x + Math.cos(a + k * 0.8) * r, y = p.y + Math.sin(a + k * 0.8) * r;
            if (DL.Spires.canStand(e, x, y)) { e.x = x; e.y = y; break; }
          }
        }
        e.act = null; e.next = L(e, S.rest);
      }
    }
  }
  function throwFan(e) {
    const S = B.shade, n = N(e, S.fan), volleys = N(e, S.volleys), x = e.x + Math.cos(e.aim) * 18, y = e.y - e.lift - 40;
    const o = { by: "a Mist Shade", dmg: S.dmg, speed: L(e, S.speed), kind: 0 };
    for (let i = 0; i < volleys; i++) DL.Bullets.later(i * 0.32, e, () => {
      const p = G.player;
      DL.Bullets.fan(x, y, Math.atan2(p.y - 18 - y, p.x - x), n, L(e, S.spread), o);
    });
    DL.Sound.play("whisper");
  }

  /* ---------------- the Rift Caller ---------------- */
  const rifts = [];
  F.clear = () => { rifts.length = 0; };
  function caller(e, dt, p, dp) {
    const S = B.caller;
    if (e.next == null) { e.next = rand(1.5, 2.5); e.callT = S.call * 0.6; }
    e.lift = S.hover + Math.sin(G.t * 1.7 + e.id) * 6;
    tickRifts(e, dt);
    e.callT -= dt;
    if (!e.act) {
      e.pose = null;
      step(e, dt, p, dp < S.keep[0] ? -1 : dp > S.keep[1] ? 1 : 0, dp < S.keep[0] ? 1 : 0.4);
      e.next -= dt;
      const mine = G.enemies.filter((q) => q.calledBy === e.id && !q.removed).length;
      if (e.callT <= 0 && mine < S.callMax) { e.act = "call"; e.t = S.bow; e.pose = 2; e.callT = S.call; }
      else if (e.next <= 0 && dp < S.reach) { e.act = "tear"; e.t = S.tear; e.pose = 0; e.angle = Math.atan2(p.y - e.y, p.x - e.x); }
      return;
    }
    e.moving = false;
    e.t -= dt;
    if (e.act === "tear" && e.t <= 0) {
      const n = N(e, S.rifts), a0 = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU, r = rand(S.ring[0], S.ring[1]);
        rifts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8 - 20, t: 0, owner: e, shots: 0 });
      }
      DL.Sound.play("whisper");
      e.act = "channel"; e.t = 0.5; e.pose = 1;
    } else if (e.act === "call" && e.t <= 0) {
      const room = e.room, f = room && DL.Spires.floorOf(room);
      for (let i = 0; i < S.calls; i++) {
        let x = e.x + rand(-120, 120), y = e.y + rand(-60, 80);
        if (f && !DL.Spires.canStand(e, x, y)) { x = e.x; y = e.y + 30; }
        G.enemies.push(G.makeEnemy(S.callType, x, y, DL.SPIRES.wave.zone, { rise: 0.9, room, calledBy: e.id }));
        for (let k = 0; k < 10; k++) G.puff(x + rand(-12, 12), y - rand(0, 40), "rgba(200,150,255,0.7)", 60, 0.7);
      }
      DL.Sound.play("whisper");
      e.act = null; e.next = Math.max(e.next, 1.2);
    } else if (e.act === "channel" && e.t <= 0) { e.act = null; e.pose = null; e.next = L(e, S.every); }
  }
  // each rift opens, spits its bursts at the knight, and closes; one dies with its Caller
  function tickRifts(e, dt) {
    const S = B.caller, p = G.player;
    for (const r of rifts) {
      if (r.owner !== e) continue;
      r.t += dt;
      if (r.shots < S.bursts && r.t > S.open + r.shots * S.gap) {
        r.shots++;
        DL.Bullets.fan(r.x, r.y, Math.atan2(p.y - 18 - r.y, p.x - r.x), N(e, S.burst), S.spread, { by: "a Rift Caller's rift", dmg: S.dmg, speed: L(e, S.speed), kind: 0 });
      }
    }
    for (let i = rifts.length - 1; i >= 0; i--) if (rifts[i].t > S.life || rifts[i].owner.removed) rifts.splice(i, 1);
  }
  function drawRift(c, r, t) {
    const S = B.caller, k = Math.min(1, r.t / S.open, (S.life - r.t) / 0.4), h = 34 * k, w = 9 * k;
    c.save();
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = Math.max(0, k);
    c.drawImage(glowSprite(), r.x - 40, r.y - 40, 80, 80);
    c.fillStyle = "rgba(250,235,255,0.95)";
    c.beginPath(); c.moveTo(r.x, r.y - h);
    for (let i = 1; i <= 4; i++) c.lineTo(r.x + (i % 2 ? w : -w * 0.4) * (1 + 0.2 * Math.sin(t * 20 + i)), r.y - h + (i / 4) * h * 2);
    c.lineTo(r.x, r.y + h);
    for (let i = 3; i >= 1; i--) c.lineTo(r.x + (i % 2 ? -w : w * 0.4), r.y - h + (i / 4) * h * 2);
    c.closePath(); c.fill();
    c.restore();
  }
  let glowC = null;
  function glowSprite() {
    if (glowC) return glowC;
    glowC = document.createElement("canvas"); glowC.width = glowC.height = 64;
    const g = glowC.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(220,160,255,0.9)"); gr.addColorStop(1, "rgba(160,90,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return glowC;
  }
  F.drawRifts = function (c, t) { for (const r of rifts) if (!r.owner.removed) drawRift(c, r, t); };

  /* ---------------- the Prism Knight ---------------- */
  function prism(e, dt, p, dp) {
    const S = B.prism;
    if (e.next == null) e.next = L(e, S.every);
    if (e.glint > 0) e.glint -= dt;
    e.next -= dt;
    if (!e.act) {
      e.pose = null;
      step(e, dt, p, dp > S.bash.reach * 0.8 ? 1 : 0, dp > S.bash.reach * 0.8 ? 1 : 0.3);
      e.angle = Math.atan2(p.y - e.y, p.x - e.x); // the shield always faces you
      if ((e.soaked || 0) >= S.burstAt || (e.next <= 0 && dp < S.reach)) { e.act = "raise"; e.t = S.raise; e.pose = 2; }
      else if (dp < S.bash.reach && (e.bashCd || 0) <= 0) { e.act = "brace"; e.t = S.bash.wind; e.pose = 0; e.aim = e.angle; }
      e.bashCd = (e.bashCd || 0) - dt;
      return;
    }
    e.moving = false;
    e.t -= dt;
    if (e.act === "brace") {
      if (e.t <= 0) { e.act = "bash"; e.t = S.bash.time; e.pose = 1; e.kx += Math.cos(e.aim) * S.bash.lunge; e.ky += Math.sin(e.aim) * S.bash.lunge; e.hitDone = false; }
    } else if (e.act === "bash") {
      if (!e.hitDone && Math.hypot(p.x - e.x, p.y - e.y) < S.bash.reach && !(p.inv > 0) && !(p.dashT > 0)) {
        e.hitDone = true;
        G.hurtPlayer(e.dmg, e.aim, e.def.name);
        p.kx = (p.kx || 0) + Math.cos(e.aim) * S.bash.kb; p.ky = (p.ky || 0) + Math.sin(e.aim) * S.bash.kb;
      }
      if (e.t <= 0) { e.act = null; e.pose = null; e.bashCd = S.bash.cd; }
    } else if (e.act === "raise") {
      e.glint = 0.3;
      if (e.t <= 0) {
        const n = N(e, S.ring) + Math.floor((e.soaked || 0) / S.extra), o = { by: "a Prism Knight's burst", dmg: S.dmg, speed: L(e, S.speed), kind: 1 };
        DL.Bullets.ring(e.x, e.y - 50, n, rand(0, TAU), o);
        if (heat(e) > 0.5) DL.Bullets.later(0.35, e, () => DL.Bullets.ring(e.x, e.y - 50, n, Math.PI / n, o));
        for (let i = 0; i < 16; i++) G.puff(e.x + rand(-20, 20), e.y - rand(30, 80), "rgba(235,210,255,0.8)", 90, 0.6);
        DL.Sound.play("chime");
        e.soaked = 0; e.next = L(e, S.every);
        e.act = "after"; e.t = 0.4;
      }
    } else if (e.t <= 0) { e.act = null; e.pose = null; }
  }

  /* ---------------- telegraphs, on the ground under them ---------------- */
  F.drawMark = function (c, e, t) {
    if (e.def.spire === "prism" && e.glint > 0) { // the shield flares as it soaks a blow or gathers its burst
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.min(1, e.glint * 4);
      c.drawImage(glowSprite(), e.x + Math.cos(e.angle) * 18 - 40, e.y - 90, 80, 80); c.restore();
    }
    if (!e.def.spire || !e.act) return;
    c.save();
    c.globalCompositeOperation = "lighter";
    if (e.def.spire === "leaper" && (e.act === "crouch" || e.act === "air")) {
      const S = B.leaper, k = e.act === "air" ? 1 - Math.max(0, e.t) / S.air : 0.3 * (1 - e.t / S.crouch);
      c.strokeStyle = `rgba(220,150,255,${0.35 + 0.5 * k})`; c.lineWidth = 2;
      c.beginPath(); c.ellipse(e.tx, e.ty, S.hitR, S.hitR * 0.55, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(190,110,255,${0.08 + 0.25 * k})`;
      c.beginPath(); c.ellipse(e.tx, e.ty, S.hitR * k, S.hitR * 0.55 * k, 0, 0, TAU); c.fill();
    } else if (e.def.spire === "bowman" && e.act === "draw") {
      const k = 1 - Math.max(0, e.t) / B.bowman.draw, len = 260;
      for (let i = 0; i < e.lanes; i++) {
        if (i === e.safe) continue;
        const [x, y] = laneAt(e, i);
        c.strokeStyle = `rgba(110,220,255,${0.08 + 0.3 * k})`; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(e.aim) * len, y + Math.sin(e.aim) * len); c.stroke();
      }
    }
    c.restore();
  };
})(window.DL);
