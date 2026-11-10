/* Drowned Light — the Molten Mines' mini bosses (Level 3 step 4; plan "Level 3 plan: The Molten Mines", Mini bosses).
   Each waits in its big room; a knight stepping in wakes it and the room shuts (fire curtains, src/mines.js) until it
   falls. They fight through the bullet system (src/bullets.js). Numbers: DL.MINE_BOSSES (src/data.js). Host only.

     A. The Magma Golem, the Fused Warden (the Fused Forge), drawn by Robert:
        a slow walker. Slam: fists up (the floor marks round him), down: a blow in the mark and a ring of slag with one
        gap to slip through. Hurl: it tears off a fist and throws it: a shadow, then a molten pool and a burst of
        shards; the fist fuses back. After every third slam its chest core splits open: blows deal double. */
"use strict";
(function (DL) {
  const G = DL.Game, TAU = Math.PI * 2, { rand, dist } = DL;
  const MB = (DL.MineBosses = {});
  const N = () => DL.MINE_BOSSES;
  const OX = () => DL.MINES.x, OY = () => DL.MINES.y;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound && DL.Sound.play(n);
  const sideOn = (a) => (Math.cos(a) >= 0 ? 0 : Math.PI);
  // which boss waits in which room
  MB.ROOMS = { forge: "golem" };

  let fists = [], pools = [];
  MB.reset = function () { fists = []; pools = []; };
  MB.boss = (room) => G.enemies.find((e) => e.room === room && e.def.boss && e.def.mine && !e.removed);

  /* ---------------- waking ---------------- */
  // each frame (src/mines.js): a knight in a boss room that's still standing wakes its boss, and the room shuts
  MB.update = function (dt, room) {
    const sp = G.spires, p = G.player, n = N();
    if (room && MB.ROOMS[room] && !sp.cleared[room] && !sp.seal && !MB.boss(room)) {
      const type = MB.ROOMS[room], at = n[type].at, x = OX() + at[0], y = OY() + at[1];
      const e = G.makeEnemy(type, x, y, n.zone, { room, act: "wake", t: 1.4, slams: 0, next: 1, cd: 99 });
      e.angle = Math.atan2(p.y - y, p.x - x);
      G.enemies.push(e);
      sp.seal = room;
      G.camera.shake = 8;
      sfx("torch");
      for (let i = 0; i < 24; i++) G.puff(x + rand(-50, 50), y - rand(0, 160), "rgba(255,130,40,0.75)", 90, 0.9, -30);
      say("Fire curtains roar up. In the forge's heart the stone stirs: the Magma Golem wakes!", "danger");
    }
    // molten pools burn whoever walks in them
    for (const q of pools) {
      q.t += dt;
      if (p && Math.hypot(p.x - q.x, (p.y - q.y) * 1.6) < q.r && !(p.dashT > 0)) G.hurtPlayer(n.golem.poolDmg, -Math.PI / 2, "a molten pool");
    }
    pools = pools.filter((q) => q.t < q.life);
    // fists in the air
    for (const f of fists) {
      f.t += dt;
      if (f.t < f.fly) continue;
      f.done = true;
      land(f);
    }
    fists = fists.filter((f) => !f.done);
  };
  function land(f) {
    const n = N().golem, p = G.player;
    G.camera.shake = Math.max(G.camera.shake || 0, 9);
    sfx("hit");
    for (let i = 0; i < 16; i++) G.puff(f.tx + rand(-30, 30), f.ty - rand(0, 30), "rgba(255,120,40,0.75)", 110, 0.7, -20);
    if (p && Math.hypot(p.x - f.tx, (p.y - f.ty) * 1.3) < n.fistR && !(p.dashT > 0) && !(p.inv > 0)) G.hurtPlayer(f.dmg, Math.atan2(p.y - f.ty, p.x - f.tx), "the Magma Golem's fist");
    DL.Bullets.ring(f.tx, f.ty - 10, n.shards, rand(0, TAU), { by: "a slag shard", dmg: n.bulletDmg, speed: n.speed, kind: 7 });
    pools.push({ x: f.tx, y: f.ty, r: n.poolR, t: 0, life: n.poolLife });
  }

  /* ---------------- each frame (MineFoes.busy) ---------------- */
  MB.busy = function (e, dt, p, dp) {
    e.moving = false; e.state = "move";
    if (e.def.mine === "golem") golem(e, dt, p, dp);
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
    const n = N().golem, p = G.player, R = n.r * e.def.size;
    e.act = "slam"; e.t = n.hit; e.anim = ["slam", 0, sideOn(e.aim)];
    G.camera.shake = 11;
    sfx("hit");
    for (let i = 0; i < 22; i++) G.puff(e.x + rand(-R, R) * 0.8, e.y + rand(-R, R) * 0.4, "rgba(255,130,40,0.8)", 120, 0.7, -20);
    if (Math.hypot(p.x - e.x, (p.y - e.y) * 1.5) < R && !(p.dashT > 0) && !(p.inv > 0)) G.hurtPlayer(e.dmg * n.dmg, Math.atan2(p.y - e.y, p.x - e.x), e.def.name);
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
    fists.push({ x0: hx, y0: hy, gy: e.y, tx, ty, t: 0, fly: n.fly, dmg: e.dmg * n.fistDmg });
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
  // what a blow does to it: double while its core is open
  MB.soak = (e, d) => (e.act === "wake" ? 0 : e.act === "core" ? d * N().golem.coreDmg : d);
  MB.slain = function (e) {
    DL.Bullets.clear();
    fists = [];
    G.camera.shake = 14;
    for (let i = 0; i < 40; i++) G.puff(e.x + rand(-60, 60), e.y - rand(0, 220), "rgba(255,130,40,0.85)", 120, 1.4, -30);
    sfx("milestone");
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
      const k = Math.min(1, f.t / f.fly);
      c.fillStyle = `rgba(0,0,0,${0.2 + 0.4 * k})`; c.beginPath(); c.ellipse(f.tx, f.ty, 20 + 40 * k, (20 + 40 * k) * 0.5, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(255,140,40,${0.4 + 0.5 * k})`; c.lineWidth = 2; c.beginPath(); c.ellipse(f.tx, f.ty, n.fistR, n.fistR * 0.55, 0, 0, TAU); c.stroke();
    }
    for (const e of G.enemies) {
      if (e.def.mine !== "golem" || e.removed || e.act !== "raise" || !vis(view, e.x, e.y, 200)) continue;
      const R = n.r * e.def.size, k = 1 - Math.max(0, e.t) / n.raise;
      c.strokeStyle = `rgba(255,150,50,${0.35 + 0.5 * k})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(e.x, e.y, R, R / 1.5, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,110,30,${0.1 + 0.25 * k})`;
      c.beginPath(); c.ellipse(e.x, e.y, R * k, (R / 1.5) * k, 0, 0, TAU); c.fill();
    }
  };
  // standing: fists flying in an arc (y-sorted by where they'll land)
  MB.push = function (list, c, t, view) {
    for (const f of fists) {
      const k = Math.min(1, f.t / f.fly), x = f.x0 + (f.tx - f.x0) * k, gy = f.gy + (f.ty - f.gy) * k;
      const y = f.y0 + (f.ty - f.y0) * k - Math.sin(Math.PI * k) * 220;
      if (!vis(view, x, y, 120)) continue;
      list.push({ y: gy, f: () => {
        const im = IMG("golem-fist");
        if (!im) { c.fillStyle = "#4a3028"; c.beginPath(); c.arc(x, y, 18, 0, TAU); c.fill(); return; }
        const w = 66, h = (w * im.height) / im.width, flip = f.tx < f.x0;
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
