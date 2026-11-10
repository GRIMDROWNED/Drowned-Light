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
   The Spire Sentinel (a crystal turret, DL.ENEMIES.sentinel) runs a loop of these: Bullets.sentinel. Its e.heat
   (0..1) sets how dense: gentle in the first rooms, dense deep in (rooms will set it per room).
   Numbers: DL.BULLETS (src/data.js). Co-op: the host's device fires them all and hits only its own knight; each
   snapshot carries the bullets near a friend (Bu.rows), whose device flies them on between snapshots and dodges or
   takes them itself (Bu.apply), so a dash through a wall feels the same on every screen. */
"use strict";
(function (DL) {
  const G = DL.Game, B = DL.BULLETS, TAU = Math.PI * 2;
  const Bu = (DL.Bullets = {});
  let list = [], emitters = [], later = [], nextId = 1, struck = new Set(); // struck: bullets that hit this guest already
  Bu.list = () => list;
  Bu.clear = () => { list = []; emitters = []; later = []; struck = new Set(); };
  // run fn after `s` seconds of game time (so a pause pauses it), unless `owner` has died by then
  const after = (s, owner, fn) => later.push({ t: s, owner, fn });
  Bu.later = after;

  function add(x, y, ang, o) {
    if (list.length >= B.cap) return;
    const sp = o.speed || B.speed;
    list.push({ id: nextId++, x, y, x0: x, y0: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: o.r || B.r, dmg: o.dmg || B.dmg,
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

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  // Host: the bullets near a friend, [id, x, y, vx, vy, r, kind, curve, dmg, time left]
  Bu.rows = function (near) {
    const out = [];
    for (const b of list) if (near(b.x, b.y, 800)) out.push([b.id, r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.r, b.kind, r1(b.curve), b.dmg, r1(b.life - b.t)]);
    return out;
  };
  // Guest: the host's bullets, flown on here until the next snapshot (one that already hit us stays spent)
  Bu.apply = function (rows) {
    const old = new Map(list.map((b) => [b.id, b]));
    list = [];
    for (const r of rows || []) {
      if (struck.has(r[0])) continue;
      const o = old.get(r[0]);
      list.push({ id: r[0], x: r[1], y: r[2], x0: r[1], y0: r[2], vx: r[3], vy: r[4], r: r[5], kind: r[6], curve: r[7], dmg: r[8], life: r[9], t: 0, by: "a bolt of rift light", dodged: !!(o && o.dodged) });
    }
    if (struck.size > 400) struck = new Set([...struck].slice(-200));
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
      if (G.isGuest()) struck.add(b.id);
    }
    list = list.filter((b) => b.life > 0);
  };

  /* ---------------- drawing ---------------- */
  // one sprite per kind: a dark rim (so it reads on light stone), a coloured glow and a white-hot core
  const COLS = [["170,110,255", "#f4e6ff"], ["255,110,200", "#ffe6f6"], ["110,220,255", "#e6fbff"], ["170,110,255", "#f4e6ff"], ["255,130,40", "#fff0c0"],
    // the Molten Mines (Robert's drawn set, tools/cut_mines.py): 4 lava orb, 5 fire crescent, 6 comet, 7 rock, 8 shard, 9 spark
    ["255,130,40", "#fff0c0"], ["255,130,40", "#fff0c0"], ["255,110,30", "#fff0c0"], ["255,150,60", "#fff0c0"], ["255,170,80", "#fff0c0"]];
  const MINE_ART = { 4: 0, 5: 2, 6: 1, 7: 3, 8: 4, 9: 5 }; // kind -> assets/sprites/mines/bullet-N
  const TURNS = new Set([2, 5, 6, 8, 9]); // drawn pointing east: turned the way they fly
  let sprites = null;
  // Robert's drawn bullets and Sentinel (tools/cut_spires.py); the coded ones show until they load
  const ART = {};
  if (typeof Image !== "undefined") for (const n of ["bullet-0", "bullet-1", "bullet-2", "bullet-3", "sentinel", "sentinel-orbit"]) {
    const im = new Image();
    im.onload = () => { ART[n] = im; if (n.startsWith("bullet")) sprites = null; };
    im.src = DL.asset("assets/sprites/spires/" + n + ".png");
  }
  if (typeof Image !== "undefined") for (const kind in MINE_ART) {
    const im = new Image();
    im.onload = () => { ART["bullet-" + kind] = im; sprites = null; };
    im.src = DL.asset("assets/sprites/mines/bullet-" + MINE_ART[kind] + ".png");
  }
  function build() {
    sprites = COLS.map(([glow, core], i) => {
      const art = ART["bullet-" + i];
      if (art) { // a soft glow under the drawn bullet, which keeps its own dark rim
        const c = document.createElement("canvas"); c.width = c.height = 32;
        const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, `rgba(${glow},0.6)`); gr.addColorStop(1, `rgba(${glow},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
        const k = 22 / Math.max(art.width, art.height);
        g.drawImage(art, 16 - (art.width * k) / 2, 16 - (art.height * k) / 2, art.width * k, art.height * k);
        c.drawn = true;
        return c;
      }
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
      const sp = sprites[b.kind] || sprites[0], s = (b.r / B.r) * (sp.drawn ? 30 : 24);
      if (sp.drawn && TURNS.has(b.kind)) { // the arrow points the way it flies
        c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx)); c.drawImage(sp, -s / 2, -s / 2, s, s); c.restore();
      } else c.drawImage(sp, b.x - s / 2, b.y - s / 2, s, s);
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
    if (dp > S.wake || DL.Spires.hidden(p, e)) { e.charge = 0; return; } // too far, or lost in the mist
    e.bt = (e.bt || 0) - dt;
    if (e.fireT > 0) e.fireT -= dt;
    if (e.bt > 0) return;
    if (!e.charge) { e.charge = S.charge; e.pat = LOOP[(e.step = ((e.step || 0) + 1)) % LOOP.length]; }
    e.charge -= dt;
    if (e.charge > 0) return;
    e.charge = 0;
    e.fireT = 0.3; // the drawn Sentinel shows its firing frame for a moment
    const x = e.x, y = e.y - S.mouth, aim = Math.atan2(p.y - 18 - y, p.x - x), o = { by: "a Spire Sentinel", dmg: S.dmg };
    // heat: 0 = a gentle first room, 1 = the dense rooms deep in (Robert, 2026-11-05)
    const h = Math.max(0, Math.min(1, e.heat || 0)), L = (a, b) => a + (b - a) * h, n = (a, b) => Math.round(L(a, b));
    const aimNow = () => Math.atan2(p.y - 18 - y, p.x - x); // its prey, wherever they've got to
    if (e.pat === "spiral") { Bu.spiral(x, y, n(2, 4), L(0.16, 0.07), 1.3, 2.6, { ...o, speed: L(90, 120) }, e); e.bt = L(3.8, 3.0); }
    else if (e.pat === "rings") {
      const k = n(12, 26), rings = n(2, 3), sp = L(100, 125);
      for (let i = 0; i < rings; i++) after(i * 0.45, e, () => Bu.ring(x, y, k, i % 2 ? Math.PI / k : 0, { ...o, speed: sp, kind: 1 }));
      e.bt = L(2.8, 2.2);
    } else if (e.pat === "fan") {
      const k = n(5, 9), volleys = n(2, 3), sp = L(120, 165);
      for (let i = 0; i < volleys; i++) after(i * 0.38, e, () => Bu.fan(x, y, aimNow(), k, L(0.8, 1.0), { ...o, speed: sp, kind: 2 }));
      e.bt = L(2.6, 2.0);
    } else {
      const k = n(14, 28), gap = L(100, 55), sp = L(80, 105);
      Bu.wall(x, y, aim, L(380, 440), k, gap, { ...o, speed: sp });
      if (h > 0.3) after(0.8, e, () => Bu.wall(x, y, aimNow(), L(380, 440), k, gap, { ...o, speed: sp }));
      e.bt = L(3.0, 2.4);
    }
    DL.Sound.play("chime");
  };

  // Coded art until Robert draws it: a carved plinth and a great crystal floating over it, brightening as it charges.
  Bu.drawSentinel = function (c, e, t) {
    const S = B.sentinel, ch = e.charge > 0 ? 1 - e.charge / S.charge : 0, bob = Math.sin(t * 2 + e.id) * 3;
    const x = e.x, y = e.y;
    const poses = ART.sentinel, orbit = ART["sentinel-orbit"];
    if (poses && orbit) { // Robert's drawn turret: idle loop with its shards turning, charge, fire, hurt
      let im = orbit, n = 6, f = Math.floor(t * 8 + e.id) % 6;
      if (e.flash > 0) { im = poses; f = 4; }
      else if (e.fireT > 0) { im = poses; f = 3; }
      else if (ch > 0) { im = poses; f = ch < 0.5 ? 1 : 2; }
      if (im === poses) n = 6;
      const fw = im.width / n, w = fw / 2, h = im.height / 2;
      c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 26, 8, 0, 0, TAU); c.fill();
      c.drawImage(im, f * fw, 0, fw, im.height, x - w / 2, y - h + 4, w, h);
      if (e.hp < e.maxHp) {
        c.fillStyle = "rgba(10,5,20,0.8)"; c.fillRect(x - 20, y - h - 2, 40, 4);
        c.fillStyle = "#c08cff"; c.fillRect(x - 20, y - h - 2, 40 * Math.max(0, e.hp / e.maxHp), 4);
      }
      return;
    }
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
