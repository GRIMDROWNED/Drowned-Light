/* Drowned Light — bullet hell: patterned hostile bullets for the dungeon levels (Robert, 2026-11-05: the Abyssal
   Spires plays like a bullet hell). Step 1 of docs: Level 2 plan.

   These are not G.projectiles. They are a light pool of their own, so a room can fill with hundreds: no light per
   bullet, one pre-drawn sprite each, drawn above the darkness so they always read. A bullet that meets a knight who is
   invulnerable (the dash's window, or the moment after a hit) passes through; one dashed through gives a dodge spark.

   Patterns (each returns nothing; `o` = { speed, kind, dmg, by, r, curve }):
     Bullets.ring(x, y, n, offset, o)            n bullets round a circle, turned by offset (radians)
     Bullets.fan(x, y, ang, n, spread, o)         n bullets across `spread` radians, centred on ang
     Bullets.wall(x, y, ang, width, n, gap, o)    a line of n bullets across `width` moving along ang, with a hole
                                                  `gap` px wide at a random place (always one way through)
     Bullets.lane(x, y, ang, n, step, o)          n bullets in single file along ang, `step` px apart (a bridge lane)
     Bullets.spiral(x, y, arms, rate, spin, time, o)  an emitter: `arms` bullets every `rate` s for `time` s, turning `spin` rad/s
   The Spire Sentinel (a crystal turret, DL.ENEMIES.sentinel) runs a loop of these: Bullets.sentinel.
   Numbers: DL.BULLETS (src/data.js). Host only: the Spires is Sandbox-only and solo for now (co-op not synced). */
"use strict";
(function (DL) {
  const G = DL.Game, B = DL.BULLETS, TAU = Math.PI * 2;
  const Bu = (DL.Bullets = {});
  let list = [], emitters = [], later = [];
  Bu.list = () => list;
  Bu.clear = () => { list = []; emitters = []; later = []; };
  // run fn after `s` seconds of game time (so a pause pauses it), unless `owner` has died by then
  const after = (s, owner, fn) => later.push({ t: s, owner, fn });

  function add(x, y, ang, o) {
    if (list.length >= B.cap) return;
    const sp = o.speed || B.speed;
    list.push({ x, y, x0: x, y0: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: o.r || B.r, dmg: o.dmg || B.dmg,
      by: o.by || "a crystal bolt", kind: o.kind || 0, curve: o.curve || 0, life: o.life || B.life, t: 0, dodged: false });
  }
  Bu.ring = function (x, y, n, offset, o = {}) { for (let i = 0; i < n; i++) add(x, y, offset + (i / n) * TAU, o); };
  Bu.fan = function (x, y, ang, n, spread, o = {}) {
    for (let i = 0; i < n; i++) add(x, y, ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), o);
  };
  Bu.wall = function (x, y, ang, width, n, gap, o = {}) {
    const nx = -Math.sin(ang), ny = Math.cos(ang), hole = (Math.random() - 0.5) * (width - gap * 2);
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1) - 0.5) * width;
      if (Math.abs(s - hole) < gap / 2) continue;
      add(x + nx * s, y + ny * s, ang, o);
    }
  };
  Bu.lane = function (x, y, ang, n, step, o = {}) {
    for (let i = 0; i < n; i++) add(x - Math.cos(ang) * step * i, y - Math.sin(ang) * step * i, ang, o);
  };
  Bu.spiral = function (x, y, arms, rate, spin, time, o = {}, owner = null) {
    const em = { x, y, arms, rate, spin, time, o, owner, t: 0, next: 0, a: Math.random() * TAU };
    emitters.push(em);
    return em;
  };

  /* ---------------- moving and hitting ---------------- */
  Bu.update = function (dt) {
    for (const q of later) if ((q.t -= dt) <= 0 && !(q.owner && q.owner.removed)) q.fn();
    later = later.filter((q) => q.t > 0);
    for (const em of emitters) {
      if (em.owner && em.owner.removed) em.dead = true;
      em.t += dt;
      em.a += em.spin * dt;
      while (em.next <= em.t && em.t <= em.time && !em.dead) {
        for (let i = 0; i < em.arms; i++) add(em.x, em.y, em.a + (i / em.arms) * TAU, em.o);
        em.next += em.rate;
      }
    }
    emitters = emitters.filter((em) => em.t <= em.time && !em.dead);
    if (!list.length) return;
    const p = G.player, alive = p && G.state === "play" && !(p.downT > 0);
    const hx = p ? p.x : 0, hy = p ? p.y - 18 : 0;
    for (const b of list) {
      if (b.curve) { const c = Math.cos(b.curve * dt), s = Math.sin(b.curve * dt), vx = b.vx; b.vx = vx * c - b.vy * s; b.vy = vx * s + b.vy * c; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (b.t > b.life || Math.abs(b.x - b.x0) > B.reach || Math.abs(b.y - b.y0) > B.reach) { b.life = 0; continue; }
      if (!alive) continue;
      const dx = b.x - hx, dy = b.y - hy;
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
      const d2 = dx * dx + dy * dy, hit = b.r + B.hitbox;
      if (d2 > hit * hit) continue;
      if (p.inv > 0 || p.dashT > 0) {
        // through the dash: no harm, and a flash to say you threaded it
        if (p.dashT > 0 && !b.dodged) {
          b.dodged = true;
          G.spark(b.x, b.y, "235,215,255", 50);
          G.dodges = (G.dodges || 0) + 1;
        }
        continue;
      }
      G.hurtPlayer(b.dmg, Math.atan2(b.vy, b.vx), b.by);
      b.life = 0;
    }
    list = list.filter((b) => b.life > 0);
  };

  /* ---------------- drawing ---------------- */
  // one sprite per kind: a dark rim (so it reads on light stone), a violet glow and a white-hot core
  const COLS = [["170,110,255", "#f4e6ff"], ["255,110,200", "#ffe6f6"], ["110,220,255", "#e6fbff"]];
  let sprites = null;
  function build() {
    sprites = COLS.map(([glow, core]) => {
      const c = document.createElement("canvas"); c.width = c.height = 24;
      const g = c.getContext("2d"), gr = g.createRadialGradient(12, 12, 0, 12, 12, 12);
      gr.addColorStop(0, `rgba(${glow},0.9)`); gr.addColorStop(0.5, `rgba(${glow},0.45)`); gr.addColorStop(1, `rgba(${glow},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 24, 24);
      g.fillStyle = "rgba(25,8,45,0.9)"; g.beginPath(); g.arc(12, 12, 6.2, 0, TAU); g.fill();
      g.fillStyle = `rgb(${glow})`; g.beginPath(); g.arc(12, 12, 5, 0, TAU); g.fill();
      g.fillStyle = core; g.beginPath(); g.arc(12, 12, 3, 0, TAU); g.fill();
      return c;
    });
  }
  // above the darkness, under the glow: they must always be seen
  Bu.draw = function (c, view) {
    if (!list.length) return;
    if (!sprites) build();
    for (const b of list) {
      if (b.x < view.left - 12 || b.x > view.right + 12 || b.y < view.top - 12 || b.y > view.bottom + 12) continue;
      const s = (b.r / B.r) * 24;
      c.drawImage(sprites[b.kind] || sprites[0], b.x - s / 2, b.y - s / 2, s, s);
    }
  };

  /* ---------------- the Spire Sentinel: a crystal turret ---------------- */
  // It never moves; it charges (glowing brighter) and then plays one pattern, round and round its loop.
  const LOOP = ["spiral", "rings", "fan", "wall"];
  Bu.sentinel = function (e, dt, p, dp) {
    const S = B.sentinel;
    e.moving = false;
    e.angle = Math.PI / 2;
    if (e.rise > 0 || e.stun > 0 || DL.Kits.frozen(e)) return; // staggered or frozen: it holds its fire
    if (dp > S.wake) { e.charge = 0; return; }
    e.bt = (e.bt || 0) - dt;
    if (e.bt > 0) return;
    if (!e.charge) { e.charge = S.charge; e.pat = LOOP[(e.step = ((e.step || 0) + 1)) % LOOP.length]; }
    e.charge -= dt;
    if (e.charge > 0) return;
    e.charge = 0;
    const x = e.x, y = e.y - S.mouth, aim = Math.atan2(p.y - 18 - y, p.x - x), o = { by: "a Spire Sentinel", dmg: S.dmg };
    if (e.pat === "spiral") { Bu.spiral(x, y, 3, 0.1, 1.3, 2.6, { ...o, speed: 105 }, e); e.bt = 3.4; }
    else if (e.pat === "rings") {
      Bu.ring(x, y, 20, 0, { ...o, speed: 115, kind: 1 });
      after(0.45, e, () => Bu.ring(x, y, 20, Math.PI / 20, { ...o, speed: 115, kind: 1 }));
      after(0.9, e, () => Bu.ring(x, y, 20, 0, { ...o, speed: 115, kind: 1 }));
      e.bt = 2.4;
    } else if (e.pat === "fan") {
      for (let i = 0; i < 3; i++) after(i * 0.38, e, () => Bu.fan(x, y, Math.atan2(G.player.y - 18 - y, G.player.x - x), 7, 0.9, { ...o, speed: 150, kind: 2 }));
      e.bt = 2.2;
    } else {
      Bu.wall(x, y, aim, 420, 22, 70, { ...o, speed: 95 });
      after(0.8, e, () => Bu.wall(x, y, Math.atan2(G.player.y - 18 - y, G.player.x - x), 420, 22, 70, { ...o, speed: 95 }));
      e.bt = 2.6;
    }
    DL.Sound.play("chime");
  };

  // Coded art until Robert draws it: a carved plinth and a great crystal floating over it, brightening as it charges.
  Bu.drawSentinel = function (c, e, t) {
    const S = B.sentinel, ch = e.charge > 0 ? 1 - e.charge / S.charge : 0, bob = Math.sin(t * 2 + e.id) * 3;
    const x = e.x, y = e.y;
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 24, 8, 0, 0, TAU); c.fill();
    // plinth
    c.fillStyle = "#241a36"; c.fillRect(x - 20, y - 22, 40, 22);
    c.fillStyle = "#4a3a66"; c.fillRect(x - 20, y - 22, 40, 5);
    c.fillStyle = "#5a4680"; c.fillRect(x - 20, y - 17, 6, 17);
    c.fillStyle = `rgba(190,130,255,${0.5 + 0.5 * ch})`;
    for (let i = 0; i < 3; i++) c.fillRect(x - 10 + i * 9, y - 12, 3, 6);
    // orbiting shards
    for (let i = 0; i < 4; i++) {
      const a = t * 1.6 + (i / 4) * TAU, ox = Math.cos(a) * 22, oy = Math.sin(a) * 7;
      if (oy < 0) shard(c, x + ox, y - S.mouth - 8 + oy + bob, 5, ch);
    }
    // the great crystal
    const cy = y - S.mouth + bob, flash = e.flash > 0;
    c.fillStyle = "#1d0f33";
    diamond(c, x, cy, 14, 30);
    c.fillStyle = flash ? "#ffffff" : "#9558e6"; diamond(c, x, cy, 12, 27);
    c.fillStyle = flash ? "#ffffff" : "#5a2ea8"; c.beginPath(); c.moveTo(x, cy - 27); c.lineTo(x + 12, cy); c.lineTo(x, cy + 14); c.closePath(); c.fill();
    c.fillStyle = "#e3c8ff"; c.beginPath(); c.moveTo(x, cy - 27); c.lineTo(x - 12, cy); c.lineTo(x - 3, cy); c.closePath(); c.fill();
    if (ch > 0) { c.fillStyle = `rgba(255,240,255,${ch})`; c.beginPath(); c.arc(x, cy, 3 + ch * 4, 0, TAU); c.fill(); }
    for (let i = 0; i < 4; i++) {
      const a = t * 1.6 + (i / 4) * TAU, ox = Math.cos(a) * 22, oy = Math.sin(a) * 7;
      if (oy >= 0) shard(c, x + ox, y - S.mouth - 8 + oy + bob, 5, ch);
    }
    // health
    if (e.hp < e.maxHp) {
      c.fillStyle = "rgba(10,5,20,0.8)"; c.fillRect(x - 20, y - S.mouth - 46, 40, 4);
      c.fillStyle = "#c08cff"; c.fillRect(x - 20, y - S.mouth - 46, 40 * Math.max(0, e.hp / e.maxHp), 4);
    }
  };
  function diamond(c, x, y, w, h) { c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h * 0.5); c.lineTo(x - w, y); c.closePath(); c.fill(); }
  function shard(c, x, y, s, ch) {
    c.fillStyle = "#1d0f33"; diamond(c, x, y, s * 0.7, s * 1.6);
    c.fillStyle = ch > 0 ? "#f0d8ff" : "#b884ff"; diamond(c, x, y, s * 0.5, s * 1.3);
  }
  // its charge glow, above the darkness
  Bu.glow = function (c, t, view) {
    for (const e of G.enemies) {
      if (!e.def.sentinel || e.removed || e.x < view.left - 80 || e.x > view.right + 80 || e.y < view.top - 120 || e.y > view.bottom + 40) continue;
      const ch = e.charge > 0 ? 1 - e.charge / B.sentinel.charge : 0, y = e.y - B.sentinel.mouth, r = 30 + 30 * ch;
      const g = c.createRadialGradient(e.x, y, 0, e.x, y, r);
      g.addColorStop(0, `rgba(190,130,255,${0.35 + 0.5 * ch})`); g.addColorStop(1, "rgba(190,130,255,0)");
      c.fillStyle = g; c.fillRect(e.x - r, y - r, r * 2, r * 2);
    }
  };
})(window.DL);
