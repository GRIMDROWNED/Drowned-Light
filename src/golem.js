/* Drowned Light — Derek, a stone golem familiar won in Derek's Hollow (src/cave.js). One per knight.
   He can't be hurt and doesn't fight: every so often, when the Drowned close in on his knight, he
   raises a stone wall across their path. Drowned near a wall turn on it instead of the knight, and
   two blows bring it down. The host's device runs every Derek and every wall, the guests' ones too,
   and sends them in its snapshots. Balance numbers are in DL.GOLEM (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand } = DL;
  const G = DL.Game, H = DL.GOLEM;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const CAST = 0.7, CAST_AT = 0.4, THICK = 10, RISE = 0.4; // the summoning, when the wall comes up, wall half-thickness, rising time
  const Golems = (DL.Golems = {});
  G.golems = [];
  G.stoneWalls = [];

  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Golems.mine = () => G.golems.find((m) => m.owner === myId()) || null;
  function ownerOf(m) {
    if (m.owner === 0) return G.player;
    return G.allies.find((a) => a.id === m.owner) || null;
  }

  function spawn(owner, x, y, trial) {
    const m = { id: ++G.eid, golem: true, owner, trial: !!trial, x, y, angle: Math.PI / 2, moving: false, animT: 0, state: "move", stT: 0, cd: 2 };
    G.golems.push(m);
    for (let i = 0; i < 16; i++) G.puff(x + rand(-14, 14), y - rand(0, 24), "rgba(120,130,110,0.6)", 50, 0.9, -20);
    for (let i = 0; i < 10; i++) G.spark(x, y - 24, "90,235,245", 80);
    return m;
  }
  // A new life (or a reload) brings Derek back to your side at the camp, and to every friend who won him.
  Golems.reset = function () {
    const friends = G.golems.filter((m) => m.owner !== 0 && !m.trial).map((m) => m.owner);
    G.golems = [];
    G.stoneWalls = [];
    if (G.isGuest()) return;
    if (G.save.golem && G.player) spawn(0, G.player.x + 28, G.player.y + 8);
    for (const a of G.allies) if (friends.includes(a.id)) spawn(a.id, a.x + 28, a.y + 8);
  };

  /* ---------------- winning him ---------------- */
  // Host: Derek rises beside a knight (0 = the host, else a friend's co-op number). A `trial` Derek fights in
  // the Hollow and stays only if the trial is won; a friend who already won him gets him back when they join.
  Golems.give = function (owner, x, y, trial) {
    const had = G.golems.find((m) => m.owner === owner);
    if (had) return had;
    const k = owner === 0 ? G.player : G.allies.find((a) => a.id === owner);
    if (!k) return null;
    return spawn(owner, x != null ? x : k.x + 28, y != null ? y : k.y + 8, trial);
  };

  /* ---------------- walls ---------------- */
  // The two ends of a wall, and how far a point is from it.
  const ends = (w) => {
    const hx = (Math.cos(w.ang) * w.len) / 2, hy = (Math.sin(w.ang) * w.len) / 2;
    return [w.x - hx, w.y - hy, w.x + hx, w.y + hy];
  };
  Golems.closest = function (w, x, y) {
    const [x1, y1, x2, y2] = ends(w), dx = x2 - x1, dy = y2 - y1;
    const u = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    return { x: x1 + dx * u, y: y1 + dy * u };
  };
  const distTo = (w, x, y) => { const q = Golems.closest(w, x, y); return Math.hypot(x - q.x, y - q.y); };
  Golems.distTo = distTo;
  const standing = (w) => !w.dead && w.t > RISE * 0.5;

  function raise(m, x, y, ang) {
    const w = { id: ++G.eid, stoneWall: true, owner: m.owner, x, y, ang, len: H.len, rad: THICK, hits: H.hits, t: 0, hitT: 0 };
    G.stoneWalls.push(w);
    // too many: his oldest one gives way
    const own = G.stoneWalls.filter((o) => o.owner === m.owner && !o.dead);
    if (own.length > H.maxWalls) crumble(own[0], false);
    Golems.raiseFx(w, m);
    // the Drowned nearby turn on it at once
    for (const e of G.enemies) if (!e.removed && distTo(w, e.x, e.y) < H.lure + 60) e.goal = w;
  }
  Golems.raiseFx = function (w, m) {
    const [x1, y1, x2, y2] = ends(w);
    for (let i = 0; i <= 6; i++) {
      const x = x1 + ((x2 - x1) * i) / 6, y = y1 + ((y2 - y1) * i) / 6;
      G.puff(x + rand(-4, 4), y, "rgba(110,100,85,0.7)", 50, 0.7, -20);
    }
    if (m) G.effects.push({ type: "golemBeam", x1: m.x, y1: m.y - 12, x2: w.x, y2: w.y - 10, t: 0, max: 0.45 });
    sfx("rise");
  };

  // A Drowned blow (or an arrow or orb) lands on a wall: each one is a single hit, however hard.
  Golems.hitWall = function (w) {
    if (w.dead) return;
    w.hits -= 1;
    w.hitT = 0.2;
    for (let i = 0; i < 5; i++) G.spark(w.x + rand(-w.len / 3, w.len / 3), w.y - rand(6, 22), "200,190,170", 70);
    sfx("clink");
    if (w.hits <= 0) crumble(w, true);
  };
  function crumble(w, broken) {
    w.dead = true;
    Golems.crumbleFx(w);
    if (broken) sfx("shatter");
  }
  Golems.crumbleFx = function (w) {
    const [x1, y1, x2, y2] = ends(w);
    for (let i = 0; i <= 8; i++) {
      const x = x1 + ((x2 - x1) * i) / 8, y = y1 + ((y2 - y1) * i) / 8;
      G.puff(x + rand(-5, 5), y - rand(0, 20), "rgba(110,100,85,0.7)", 60, 0.9, -10);
    }
  };

  // Host: a Drowned close to a standing wall goes for the wall instead of its knight.
  Golems.lure = function (e) {
    if (e.goal && e.goal.stoneWall && !e.goal.dead) return;
    for (const w of G.stoneWalls) if (standing(w) && distTo(w, e.x, e.y) < H.lure) { e.goal = w; return; }
  };
  // Walls are solid to the Drowned: push one out of any it stands in.
  Golems.push = function (a, r) {
    for (const w of G.stoneWalls) {
      if (!standing(w)) continue;
      const q = Golems.closest(w, a.x, a.y), min = r + THICK;
      let dx = a.x - q.x, dy = a.y - q.y, d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.01) { dx = -Math.sin(w.ang); dy = Math.cos(w.ang); d = 1; }
      a.x = q.x + (dx / d) * min; a.y = q.y + (dy / d) * min;
    }
  };
  // The wall a hostile shot at (x, y) runs into, if any.
  Golems.wallAt = function (x, y) {
    for (const w of G.stoneWalls) if (standing(w) && distTo(w, x, y + 22) < THICK + 4) return w;
    return null;
  };

  /* ---------------- Derek himself (host only) ---------------- */
  const valid = (e) => e && !e.removed && e.rise <= 0 && !e.dormant;
  // The nearest Drowned closing on his knight that no wall is holding yet (one already at the knight's
  // throat is past walling off: a wall needs room to go up between them).
  function threat(o) {
    let best = null, bd = H.trigger;
    for (const e of G.enemies) {
      if (!valid(e) || (e.goal && e.goal.stoneWall && !e.goal.dead)) continue;
      const d = dist(o.x, o.y, e.x, e.y);
      if (d < bd && d > 70 + e.def.radius) { bd = d; best = e; }
    }
    return best;
  }

  function step(m, dt) {
    const o = ownerOf(m);
    if (!o) { m.gone = true; return; }
    m.animT += dt;
    m.cd -= dt;
    if (dist(m.x, m.y, o.x, o.y) > 700) {
      Object.assign(m, { x: o.x + 28, y: o.y + 8, state: "move" });
      for (let i = 0; i < 8; i++) G.puff(m.x, m.y - 10, "rgba(120,130,110,0.6)", 40, 0.6);
    }
    if (m.state === "cast") {
      m.stT -= dt;
      m.moving = false;
      if (!m.cast.done && m.stT <= CAST - CAST_AT) { m.cast.done = true; raise(m, m.cast.x, m.cast.y, m.cast.ang); }
      if (m.stT <= 0) m.state = "move";
      return;
    }
    // a Drowned closing in: raise a wall across its way, between it and his knight
    const e = m.cd <= 0 ? threat(o) : null;
    if (e) {
      const d = dist(o.x, o.y, e.x, e.y) || 1, ux = (e.x - o.x) / d, uy = (e.y - o.y) / d;
      const gap = Math.min(H.gap, d * 0.55);
      m.cast = { x: o.x + ux * gap, y: o.y + uy * gap, ang: Math.atan2(uy, ux) + Math.PI / 2, done: false };
      m.state = "cast"; m.stT = CAST; m.cd = H.buildCd;
      m.angle = Math.atan2(m.cast.y - m.y, m.cast.x - m.x);
      m.moving = false;
      return;
    }
    // otherwise he plods along at his knight's side, opposite the hound
    const a = o.angle || 0, fx = o.x + Math.cos(a + Math.PI / 2) * 30 - Math.cos(a) * 12, fy = o.y + Math.sin(a + Math.PI / 2) * 22 + 6;
    const d = dist(m.x, m.y, fx, fy);
    m.moving = d > 16;
    if (!m.moving) return;
    let mx = fx - m.x, my = fy - m.y;
    const wp = DL.Hounds.gateWay(m, fx, fy);
    if (wp) { mx = wp.x - m.x; my = wp.y - m.y; }
    const md = Math.hypot(mx, my) || 1, spd = (d > 160 ? H.speed * 1.3 : Math.min(H.speed, d * 3)) * (DL.World.isWater(m.x, m.y) ? 0.85 : 1);
    m.x += (mx / md) * spd * dt;
    m.y += (my / md) * spd * dt;
    m.angle = Math.atan2(my, mx);
    DL.World.collide(m, 7);
    G.collideCamp(m, 7);
  }

  Golems.update = function (dt) {
    for (const m of G.golems) step(m, dt);
    G.golems = G.golems.filter((m) => !m.gone);
    for (const w of G.stoneWalls) {
      w.t += dt;
      w.hitT = Math.max(0, w.hitT - dt);
      if (!w.dead && w.t > H.life) crumble(w, false);
    }
    G.stoneWalls = G.stoneWalls.filter((w) => !w.dead);
  };
})(window.DL);
