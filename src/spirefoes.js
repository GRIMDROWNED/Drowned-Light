/* Drowned Light — the Abyssal Spires' first foes (step 3 of docs: Level 2 plan), each built round a bullet pattern
   (src/bullets.js), drawn by Robert (tools/cut_ai_sprites.py, assets/sprites/spires-foes/).

   Chain Leaper: stalks you, crouches, and leaps at where you stand. A ring marks the landing; it slams down there and
     a ring of crystal shards bursts out. Dash out from under it, then thread the ring.
   Bridge Bowman: keeps its distance, draws, and looses parallel lanes of crystal arrows down the line at you. One lane
     is always left empty, and while it draws, faint lines show every lane but that one.
   Both read e.heat (0..1, set by the room, src/spires.js): gentle by the hub, dense deep in. They run their own moves
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
    if (k === "leaper") leaper(e, dt, p, dp); else bowman(e, dt, p, dp);
    return true;
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

  /* ---------------- telegraphs, on the ground under them ---------------- */
  F.drawMark = function (c, e, t) {
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
