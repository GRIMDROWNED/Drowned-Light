/* Drowned Light — the Drowned Colossus: the eighth and last wave of Derek's Hollow (src/cave.js).
   An ancient stone guardian that crawls on its knuckles, a ruined wooden scaffold still lashed to its back. It rises from
   the deep water at the north of the cave and fights with four attacks (the concept sheet's):
     slam      its arm sweeps a wide arc in front of it and hurls knights back (its ordinary blow);
     summon    it pounds the ground: broken pillars burst up around it and small Drowned Knights climb out among them;
     surge     it stomps out a ring of water that rolls across the cave (a pillar between you and it shelters you);
     collapse  it shakes its ruined back loose and stones rain down on and around every knight.
   The host runs it (Colossus.think from the enemy update, Colossus.strike when a blow lands); the pillars, rings and
   falling stones ride the cave's snapshot to guests. Its coded stand-in sheet is built here; drawn frames from
   assets/sprites/colossus/ replace it once they exist. Numbers: DL.ENEMIES.colossus and DL.COLOSSUS (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, K = DL.COLOSSUS;
  const sfx = (n) => DL.Sound.play(n);
  const Colossus = (DL.Colossus = {});
  const KINDS = ["summon", "surge", "collapse"];
  let ruins = [], surges = [], rocks = [];
  const now = () => performance.now() / 1000;
  // A guest only hears about things a few times a second: it runs their clocks on between snapshots.
  const age = (o) => o.t + (o.at ? now() - o.at : 0);

  Colossus.reset = function () { ruins = []; surges = []; rocks = []; };
  Colossus.alive = () => G.enemies.find((e) => e.def.colossus && !e.removed);

  /* ---------------- hurting knights ---------------- */
  function hurt(k, dmg, ang, kb) {
    if (k.hound) return DL.Hounds.hurt(k, dmg, ang);
    if (k !== G.player) return DL.Net.hurtAlly(k, dmg, ang);
    const was = k.hp;
    G.hurtPlayer(dmg, ang);
    if (k.hp < was && kb && !DL.Kits.steady(k)) { k.kx += Math.cos(ang) * kb; k.ky += Math.sin(ang) * kb; }
  }
  const targets = () => [...G.knights(), ...G.hounds.filter((h) => !(h.down > 0))];
  // Ground shapes are drawn squashed (like the telegraphs): measure in the same squashed space.
  const flat = (x0, y0, x1, y1) => Math.hypot(x1 - x0, (y1 - y0) / 0.55);

  /* ---------------- the host's brain (called every frame from the enemy update) ---------------- */
  Colossus.think = function (e, dt, p, dp) {
    if (!e.awake) {
      e.awake = true;
      for (const k of KINDS) e[k + "T"] = K[k].first;
    }
    if (e.stun > 0.15) e.stun = 0.15; // too big to stagger for long
    if (!e.phase2 && e.hp < e.maxHp * K.phase2) {
      e.phase2 = true;
      e.speed *= K.fast;
      e.collapseT = Math.min(e.collapseT, 1.5);
      G.camera.shake = 12;
      sfx("growl");
      DL.UI.toast("The Colossus tears at its own ruined back!", "danger");
      DL.Net.say("The Colossus tears at its own ruined back!", "danger");
    }
    const rate = e.phase2 ? K.rate : 1;
    for (const k of KINDS) e[k + "T"] -= dt * rate;
    if (e.state !== "move" || e.stun > 0 || e.cd > 1.2 || dp > 520) return; // never straight after a blow
    // one move at a time, the one that's been ready longest first
    let best = null;
    for (const k of KINDS) if (e[k + "T"] <= 0 && (!best || e[k + "T"] < e[best + "T"])) best = k;
    if (best === "surge" && dp > K.surge.reach * 0.8) best = null; // the ring wouldn't reach
    if (best) begin(e, best, p);
  };

  function begin(e, kind, p) {
    const k = K[kind];
    e[kind + "T"] = k.every;
    e.state = "windup";
    e.stT = k.windup;
    e.special = kind;
    e.aim = e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.aimGoal = null;
    e.tgt = p;
    e.moving = false;
    sfx(kind === "collapse" ? "growl" : "rise");
    if (kind === "summon") {
      // where the pillars will burst up: around the Colossus, leaning toward its prey
      e.spots = [];
      for (let i = 0; i < k.ruins; i++) {
        const a = e.aim + (i - (k.ruins - 1) / 2) * 1.1 + rand(-0.2, 0.2), r = rand(95, 170);
        const s = inArena(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8);
        e.spots.push(s);
        G.telegraphs.push({ x: s.x, y: s.y, r: k.r + 8, t: 0, delay: k.windup, dmg: e.dmg * k.dmg });
      }
    }
  }
  // Keep a spot inside the cave's floor.
  function inArena(x, y) {
    const C = DL.CAVE, dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy), max = C.radius - 50;
    return d > max ? { x: C.x + (dx / d) * max, y: C.y + (dy / d) * max } : { x, y };
  }

  // Its blow lands (from the enemy update's strike): the arm's sweep, or the move it wound up.
  Colossus.strike = function (e) {
    const kind = e.special;
    e.special = null;
    G.camera.shake = Math.max(G.camera.shake, kind ? 11 : 7);
    if (kind === "summon") return summon(e);
    if (kind === "surge") {
      surges.push({ x: e.x, y: e.y, t: 0, dmg: e.dmg * K.surge.dmg, hit: [] });
      sfx("shatter");
      for (let i = 0; i < 24; i++) G.puff(e.x + rand(-50, 50), e.y + rand(-12, 12), "rgba(90,235,245,0.55)", 90, 0.8, -40);
      return;
    }
    if (kind === "collapse") return collapse(e);
    // the slam: a wide sweep of its arm
    const def = e.def, R = def.range + 34;
    G.effects.push({ type: "slash", x: e.x, y: e.y - 20, ang: e.aim, arc: def.arc, r: R, t: 0, max: 0.26, col: "90,230,240", w: 12 });
    sfx("shatter");
    for (const k of targets()) {
      const d = dist(e.x, e.y, k.x, k.y), a = Math.atan2(k.y - e.y, k.x - e.x);
      if (d < R && Math.abs(DL.angleDiff(e.aim, a)) < def.arc / 2 + 0.15) hurt(k, e.dmg, a, K.slam.kb);
    }
    for (const w of G.stoneWalls) if (!w.dead && DL.Golems.distTo(w, e.x, e.y) < R) { DL.Golems.hitWall(w); DL.Golems.hitWall(w); } // Derek's walls don't slow it for long
    const hx = e.x + Math.cos(e.aim) * 70, hy = e.y + Math.sin(e.aim) * 50;
    for (let i = 0; i < 12; i++) G.puff(hx + rand(-20, 20), hy + rand(-8, 8), "rgba(90,235,245,0.5)", 80, 0.6, -30);
  };

  function summon(e) {
    const k = K.summon;
    for (const s of e.spots || []) addRuin(s.x, s.y);
    e.spots = null;
    sfx("shatter");
    let adds = G.enemies.filter((a) => a.type === k.add && a.fromColossus).length;
    for (let i = 0; i < Math.round(k.adds * G.partyScale()) && adds < k.maxAdds; i++, adds++) {
      const a = rand(0, TAU), s = inArena(e.x + Math.cos(a) * rand(80, 150), e.y + Math.sin(a) * rand(60, 110));
      G.enemies.push(G.makeEnemy(k.add, s.x, s.y, DL.CAVE.zone, { rise: 0.9, fromColossus: true }));
    }
  }

  function collapse(e) {
    const k = K.collapse, n = e.phase2 ? k.n2 : k.n, ks = G.knights();
    for (let i = 0; i < n; i++) {
      const on = ks.length ? ks[i % ks.length] : e, off = i < ks.length ? 0 : rand(40, 130), a = rand(0, TAU);
      const s = inArena(on.x + Math.cos(a) * off, on.y + Math.sin(a) * off * 0.8);
      const delay = k.delay + i * 0.12;
      G.telegraphs.push({ x: s.x, y: s.y, r: k.r, t: 0, delay, dmg: e.dmg * k.dmg });
      rocks.push({ x: s.x, y: s.y, t: 0, delay, v: (Math.random() * 4) | 0, leave: Math.random() < k.leave });
    }
    for (let i = 0; i < 20; i++) G.puff(e.x + rand(-40, 40), e.y - rand(40, 110), "rgba(120,125,110,0.6)", 60, 1, 30);
  }

  function addRuin(x, y) {
    if (ruins.length >= K.maxRuins) ruins.shift();
    ruins.push({ x, y, t: 0, life: K.summon.life, v: (Math.random() * 4) | 0 });
    for (let i = 0; i < 10; i++) G.puff(x + rand(-16, 16), y + rand(-6, 6), "rgba(110,112,100,0.7)", 70, 0.7, -30);
  }

  /* ---------------- every frame (host) ---------------- */
  Colossus.update = function (dt) {
    for (const q of ruins) q.t += dt;
    ruins = ruins.filter((q) => q.t < q.life);
    for (const q of rocks) {
      q.t += dt;
      if (q.t >= q.delay && !q.done) {
        q.done = true;
        sfx("flameHit");
        G.camera.shake = Math.max(G.camera.shake, 5);
        for (let i = 0; i < 8; i++) G.puff(q.x + rand(-20, 20), q.y + rand(-6, 6), "rgba(110,112,100,0.7)", 80, 0.6, -20);
        if (q.leave) addRuin(q.x, q.y);
      }
    }
    rocks = rocks.filter((q) => q.t < q.delay + 0.3);
    for (const s of surges) {
      s.t += dt;
      const r = s.t * K.surge.speed;
      for (const k of targets()) {
        if (s.hit.includes(k)) continue;
        const d = flat(s.x, s.y, k.x, k.y);
        if (Math.abs(d - r) > K.surge.band || d > K.surge.reach) continue;
        s.hit.push(k);
        if (sheltered(s, k)) { if (k === G.player) DL.UI.toast("The pillar breaks the wave.", "good"); continue; }
        hurt(k, s.dmg, Math.atan2(k.y - s.y, k.x - s.x), K.surge.kb);
      }
      if (Math.random() < 0.8) { const a = rand(0, TAU); G.puff(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.55, "rgba(90,235,245,0.5)", 40, 0.5, -30); }
    }
    surges = surges.filter((s) => s.t * K.surge.speed < K.surge.reach + 20);
  };
  // Is a pillar standing between the ring's heart and this knight?
  function sheltered(s, k) {
    const dx = k.x - s.x, dy = k.y - s.y, L = Math.hypot(dx, dy) || 1;
    return ruins.some((q) => {
      if (q.t < 0.4) return false;
      const u = ((q.x - s.x) * dx + (q.y - s.y) * dy) / (L * L);
      if (u <= 0 || u >= 1) return false;
      return dist(s.x + dx * u, s.y + dy * u, q.x, q.y) < K.summon.r + 6;
    });
  }

  // The pillars are solid to everyone (from Cave.collide, inside the Hollow).
  Colossus.collide = function (ent, r) {
    for (const q of ruins) {
      if (q.t < 0.25) continue;
      const dx = ent.x - q.x, dy = ent.y - q.y, d = Math.hypot(dx, dy), min = K.summon.r + r;
      if (d < min && d > 0.01) { ent.x = q.x + (dx / d) * min; ent.y = q.y + (dy / d) * min; }
    }
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Colossus.snap = function () {
    const e = Colossus.alive();
    if (!ruins.length && !surges.length && !rocks.length && !e) return 0;
    return [ruins.map((q) => [r1(q.x), r1(q.y), r1(q.t), q.life, q.v]), surges.map((s) => [r1(s.x), r1(s.y), r1(s.t)]),
      rocks.map((q) => [r1(q.x), r1(q.y), r1(q.t), q.delay, q.v]), e && e.special ? [e.id, KINDS.indexOf(e.special)] : 0];
  };
  Colossus.applySnap = function (s) {
    if (!s) return Colossus.reset();
    const at = now();
    ruins = s[0].map((q) => ({ x: q[0], y: q[1], t: q[2], life: q[3], v: q[4], at }));
    surges = s[1].map((q) => ({ x: q[0], y: q[1], t: q[2], at }));
    rocks = s[2].map((q) => ({ x: q[0], y: q[1], t: q[2], delay: q[3], v: q[4], at }));
    for (const e of G.enemies) if (e.def.colossus) e.special = s[3] && s[3][0] === e.id ? KINDS[s[3][1]] : null;
  };

  /* ---------------- drawing ---------------- */
  // On the ground: the rolling rings of water and the shadows of stones about to land.
  Colossus.drawGround = function (c) {
    for (const s of surges) {
      const r = age(s) * K.surge.speed;
      if (r > K.surge.reach) continue;
      const k = 1 - r / K.surge.reach;
      c.strokeStyle = `rgba(90,235,245,${0.35 + 0.5 * k})`;
      c.lineWidth = 10;
      c.beginPath(); c.ellipse(s.x, s.y, r, r * 0.55, 0, 0, TAU); c.stroke();
      c.strokeStyle = `rgba(220,255,255,${0.5 * k})`;
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(s.x, s.y, Math.max(1, r - 4), Math.max(1, (r - 4) * 0.55), 0, 0, TAU); c.stroke();
    }
    for (const q of rocks) {
      const k = Math.min(1, age(q) / q.delay);
      if (k >= 1) continue;
      c.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * k})`;
      c.beginPath(); c.ellipse(q.x, q.y, 10 + 16 * k, (10 + 16 * k) * 0.5, 0, 0, TAU); c.fill();
    }
  };
  // Into the y-sorted scene: the pillars, and the stones in the air.
  Colossus.push = function (list, c) {
    for (const q of ruins) list.push({ y: q.y, f: () => drawRuin(c, q) });
    for (const q of rocks) {
      const k = age(q) / q.delay;
      if (k < 1) list.push({ y: q.y + 1, f: () => drawStone(c, q.x, q.y - (1 - k * k) * 420, q.v, 1) });
    }
  };
  function drawRuin(c, q) {
    const T = age(q), rise = Math.min(1, T / 0.25), fade = Math.min(1, (q.life - T) / 0.6);
    if (fade <= 0) return;
    const s = DL.Art.sprites["pillar"];
    c.save();
    c.globalAlpha *= fade;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath(); c.ellipse(q.x, q.y, 22, 8, 0, 0, TAU); c.fill();
    c.beginPath(); c.rect(q.x - 40, q.y - 140, 80, 140); c.clip();
    const sink = (1 - rise) * 60;
    if (s) {
      const w = s.w * 2, h = s.h * 2;
      c.drawImage(s.c, Math.round(q.x - w / 2), Math.round(q.y - h + sink + 4), w, h);
    } else {
      drawStone(c, q.x, q.y + sink, q.v, 1.6);
    }
    c.restore();
  }
  function drawStone(c, x, y, v, s) {
    const b = DL.Art.sprites["boulder" + (1 + (v % 4)) + "1"];
    if (b) { const w = b.w * 2 * s * 0.6, h = b.h * 2 * s * 0.6; c.drawImage(b.c, Math.round(x - w / 2), Math.round(y - h), w, h); return; }
    c.fillStyle = "#3a3b37"; c.beginPath(); c.ellipse(x, y - 12 * s, 14 * s, 11 * s, 0, 0, TAU); c.fill();
    c.fillStyle = "#565850"; c.beginPath(); c.ellipse(x - 3 * s, y - 15 * s, 7 * s, 5 * s, 0, 0, TAU); c.fill();
  }
  // Under its windup: the ground it's about to hit (a guest learns the move from the snapshot).
  Colossus.drawWindup = function (c, e) {
    const k = Math.max(0, 1 - e.stT / (e.special ? K[e.special].windup : e.def.windup));
    c.save();
    c.globalCompositeOperation = "lighter";
    if (e.special === "surge") {
      c.strokeStyle = `rgba(90,235,245,${0.15 + 0.45 * k})`;
      c.lineWidth = 3;
      const r = 40 + 30 * k;
      c.beginPath(); c.ellipse(e.x, e.y, r, r * 0.55, 0, 0, TAU); c.stroke();
    } else if (!e.special) {
      const R = e.def.range + 34;
      c.fillStyle = `rgba(60,220,230,${0.08 + 0.22 * k})`;
      c.beginPath();
      c.moveTo(e.x, e.y);
      c.ellipse(e.x, e.y, R, R * 0.7, 0, e.aim - e.def.arc / 2, e.aim + e.def.arc / 2);
      c.closePath(); c.fill();
    }
    c.restore();
  };

  /* ---------------- the coded stand-in sheet (until drawn frames are cut in) ---------------- */
  const PAL = {
    stone: "#4b4e47", stoneHi: "#6d7165", stoneLt: "#888c7e", stoneDk: "#2d302c", stoneDeep: "#1c1f1e",
    moss: "#566f2a", mossHi: "#86a63a", mossDk: "#33451c",
    wood: "#6e4c2c", woodHi: "#93703f", woodDk: "#3f2b19", chain: "#6a4a32", chainHi: "#99704e",
    glow: "#4fe6f0", glowHi: "#d0feff", glowDk: "#1f8f9a", mouth: "#061012", outline: "#060808",
  };
  const W = 112, H = 78, CX = 56, GY = 72;
  // bob: body up/down · lift: hand lift [left, right] · arm: the striking arm (up, slam, follow) · glow: eyes and cracks · sink: into the water (death)
  const ANIMS = {
    idle: [{ glow: 0 }, { bob: 1, glow: 1 }],
    walk: [{ lift: [5, 0], bob: -1 }, { bob: 0 }, { lift: [0, 5], bob: -1 }, { bob: 0 }],
    attack: [{ arm: "up", bob: -2, glow: 2 }, { arm: "slam", bob: 2, glow: 2 }, { arm: "follow", bob: 1, glow: 1 }],
    hurt: [{ bob: -2, lean: 1 }],
    death: [{ sink: 6, glow: 0 }, { sink: 14, glow: 0 }, { sink: 26, glow: 0 }],
  };

  function draw(P, dir, pose) {
    const p = PAL, g = P.g;
    g.save();
    g.translate(0, pose.sink || 0);
    if (dir === "side") side(P, p, pose); else front(P, p, pose, dir === "up");
    g.restore();
  }
  const rock = (P, p, x, y, rx, ry) => { P.ell(x, y, rx, ry, p.stoneDk); P.ell(x - rx * 0.15, y - ry * 0.2, rx * 0.82, ry * 0.75, p.stone); P.ell(x - rx * 0.35, y - ry * 0.4, rx * 0.4, ry * 0.3, p.stoneHi); };
  function scaffold(P, p, x0, y0, w, h, lean) {
    // the ruined wooden lattice lashed to its back
    const at = (u, v) => [x0 + u * w + v * lean, y0 + v * h];
    for (let i = 0; i <= 3; i++) { const [ax, ay] = at(i / 3, 0), [bx, by] = at(i / 3, 1); P.seg(ax, ay, bx, by, p.woodDk); P.seg(ax + 1, ay, bx + 1, by, p.wood); }
    for (let j = 0; j <= 2; j++) { const [ax, ay] = at(-0.08, j / 2), [bx, by] = at(1.08, j / 2); P.seg(ax, ay, bx, by, p.woodDk); P.seg(ax, ay - 1, bx, by - 1, j ? p.wood : p.woodHi); }
    const [ax, ay] = at(0, 0), [bx, by] = at(1, 1);
    P.seg(ax, ay, bx, by, p.wood);
    const [cx, cy] = at(0.95, -0.25), [dx, dy] = at(1.1, 0.1); P.seg(cx, cy, dx, dy, p.woodHi); // a snapped beam sticking up
  }
  function drips(P, p, list) {
    for (const [x, y, l, kind] of list) {
      P.rect(x, y, 1, l, kind === 2 ? p.glowDk : kind ? p.mossHi : p.moss);
      if (kind === 2) P.px(x, y + l, p.glow);
    }
  }
  function hand(P, p, x, y, side) {
    P.ell(x, y, 10, 5, p.stoneDk);
    P.ell(x - 1, y - 1, 8, 3.5, p.stone);
    for (let i = 0; i < 4; i++) { const fx = x - 7 + i * 4.5; P.rect(fx, y + 1, 3, 4, p.stoneDk); P.px(fx + 1, y + 1, p.stoneHi); }
    if (side) P.rect(x + 7, y - 1, 4, 3, p.stoneDk);
  }
  function arm(P, p, sx, sy, hx, hy, w) {
    // a thick stone limb from the shoulder (sx, sy) to the hand (hx, hy), with a rusted chain band
    const a = Math.atan2(hy - sy, hx - sx), nx = -Math.sin(a), ny = Math.cos(a);
    P.poly([sx + nx * w, sy + ny * w, hx + nx * w * 0.8, hy + ny * w * 0.8, hx - nx * w * 0.8, hy - ny * w * 0.8, sx - nx * w, sy - ny * w], p.stoneDk);
    P.poly([sx + nx * (w - 2), sy + ny * (w - 2), hx + nx * (w * 0.8 - 2), hy + ny * (w * 0.8 - 2), hx, hy, sx, sy], p.stone);
    const mx = sx + (hx - sx) * 0.62, my = sy + (hy - sy) * 0.62;
    P.seg(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w, p.chain);
    P.seg(mx + nx * w + Math.cos(a), my + ny * w + Math.sin(a), mx - nx * w + Math.cos(a), my - ny * w + Math.sin(a), p.chainHi);
    P.seg(sx + (hx - sx) * 0.3, sy + (hy - sy) * 0.3, sx + (hx - sx) * 0.45 + nx * 2, sy + (hy - sy) * 0.45 + ny * 2, p.glowDk); // a glowing crack
  }
  function front(P, p, pose, back) {
    const b = pose.bob || 0, lift = pose.lift || [0, 0], gl = pose.glow || 0, x = CX;
    if (!back) scaffold(P, p, x - 22, 8 + b, 40, 16, 4);
    // the hunched back and the great shoulders
    rock(P, p, x, 38 + b, 33, 21);
    rock(P, p, x - 30, 40 + b, 16, 15);
    rock(P, p, x + 30, 40 + b, 16, 15);
    // arms: the left always on the ground, the right swings when it strikes
    const lh = [x - 39, GY - 5 - lift[0]];
    arm(P, p, x - 32, 44 + b, lh[0], lh[1] - 3, 8);
    hand(P, p, lh[0], lh[1]);
    let rh = [x + 39, GY - 5 - lift[1]];
    if (pose.arm === "up") rh = [x + 38, 12];
    else if (pose.arm === "slam") rh = [x + 48, GY - 4];
    else if (pose.arm === "follow") rh = [x + 45, GY - 6];
    arm(P, p, x + 32, 44 + b, rh[0], rh[1] + (pose.arm === "up" ? 4 : -3), 8);
    if (pose.arm === "up") rock(P, p, rh[0], rh[1], 9, 8); else hand(P, p, rh[0], rh[1]);
    if (back) {
      scaffold(P, p, x - 22, 10 + b, 44, 24, -3);
      P.seg(x - 28, 30 + b, x + 22, 50 + b, p.chain); P.seg(x - 27, 30 + b, x + 23, 50 + b, p.chainHi);
      drips(P, p, [[x - 24, 44 + b, 9, 0], [x - 14, 50 + b, 7, 1], [x + 6, 52 + b, 8, 0], [x + 18, 46 + b, 10, 2], [x - 34, 48 + b, 8, 0], [x + 34, 48 + b, 7, 1]]);
      return;
    }
    // the boxy skull, hung low in front
    const hy = 34 + b + (pose.lean ? -2 : 0);
    P.rect(x - 10, hy, 20, 21, p.stoneDk);
    P.rect(x - 9, hy + 1, 17, 19, p.stoneHi);
    P.rect(x + 6, hy + 1, 3, 19, p.stone);
    P.rect(x - 9, hy + 1, 17, 2, p.stoneLt);
    P.rect(x - 9, hy + 6, 17, 2, p.stoneDk); // the brow
    P.rect(x - 7, hy + 8, 4, 3, p.mouth); P.rect(x + 2, hy + 8, 4, 3, p.mouth);
    P.rect(x - 6, hy + 9, 2, 2, gl ? p.glowHi : p.glow); P.rect(x + 3, hy + 9, 2, 2, gl ? p.glowHi : p.glow);
    P.rect(x - 7, hy + 12, 13, 8, p.mouth);
    for (let i = 0; i < 4; i++) { P.rect(x - 6 + i * 3, hy + 12, 1, 8, p.glow); P.px(x - 6 + i * 3, hy + 12, p.glowHi); }
    drips(P, p, [[x - 4, hy + 20, 4, 2], [x + 2, hy + 20, 6, 2]]);
    // moss slung over everything, and the chain across its chest
    P.ell(x - 4, hy, 8, 3, p.moss); P.ell(x - 6, hy - 1, 4, 2, p.mossHi);
    P.ell(x - 31, 27 + b, 10, 3, p.moss); P.ell(x + 30, 27 + b, 9, 3, p.moss); P.ell(x - 12, 19 + b, 13, 4, p.moss); P.ell(x + 12, 20 + b, 11, 3, p.mossDk);
    drips(P, p, [[x - 40, 29 + b, 13, 0], [x - 34, 30 + b, 16, 1], [x - 27, 31 + b, 10, 0], [x + 25, 30 + b, 13, 0], [x + 32, 29 + b, 10, 1], [x + 38, 30 + b, 15, 0],
      [x - 18, 22 + b, 8, 0], [x + 15, 22 + b, 7, 1], [x - 21, 40 + b, 9, 2], [x + 21, 41 + b, 8, 2]]);
    P.seg(x - 30, 46 + b, x - 12, 54 + b, p.chain); P.seg(x - 30, 47 + b, x - 12, 55 + b, p.chainHi);
    if (gl) { P.seg(x - 37, 36 + b, x - 29, 43 + b, p.glow); P.seg(x + 27, 36 + b, x + 35, 44 + b, p.glow); }
  }
  function side(P, p, pose) {
    const b = pose.bob || 0, lift = pose.lift || [0, 0], gl = pose.glow || 0, x = CX - 6;
    // the far arm, in shadow
    const fh = [x + 20 - lift[1] * 0.6, GY - 5 - lift[1]];
    arm(P, p, x + 14, 42 + b, fh[0], fh[1] - 3, 7);
    hand(P, p, fh[0], fh[1], true);
    // haunch and hind limb, the hump, the near shoulder
    rock(P, p, x - 24, 50 + b, 15, 15);
    P.rect(x - 32, 58 + b, 13, GY - 60 - b, p.stoneDk); P.rect(x - 31, 58 + b, 10, GY - 61 - b, p.stone);
    P.ell(x - 26, GY - 2, 9, 3, p.stoneDk);
    rock(P, p, x - 2, 38 + b, 31, 21);
    rock(P, p, x + 16, 42 + b, 16, 15);
    scaffold(P, p, x - 22, 8 + b, 34, 16, 5);
    // the near arm: on the ground, raised, or slammed far forward
    let nh = [x + 26 + lift[0] * 0.8, GY - 5 - lift[0]];
    if (pose.arm === "up") nh = [x + 24, 10];
    else if (pose.arm === "slam") nh = [x + 46, GY - 4];
    else if (pose.arm === "follow") nh = [x + 40, GY - 6];
    // the skull, jutting forward
    const hy = 38 + b + (pose.lean ? -2 : 0), hx = x + 28;
    P.rect(hx, hy, 17, 20, p.stoneDk);
    P.rect(hx + 1, hy + 1, 15, 18, p.stoneHi);
    P.rect(hx + 1, hy + 1, 4, 18, p.stone);
    P.rect(hx + 1, hy + 1, 15, 2, p.stoneLt);
    P.rect(hx + 1, hy + 6, 15, 2, p.stoneDk);
    P.rect(hx + 10, hy + 8, 4, 3, p.mouth); P.rect(hx + 11, hy + 9, 2, 2, gl ? p.glowHi : p.glow);
    P.rect(hx + 8, hy + 12, 8, 7, p.mouth);
    for (let i = 0; i < 3; i++) { P.rect(hx + 9 + i * 2.5, hy + 12, 1, 7, p.glow); P.px(hx + 9 + i * 2.5, hy + 12, p.glowHi); }
    drips(P, p, [[hx + 11, hy + 19, 5, 2]]);
    P.ell(hx + 6, hy, 7, 3, p.moss);
    arm(P, p, x + 16, 46 + b, nh[0], nh[1] + (pose.arm === "up" ? 4 : -3), 8);
    if (pose.arm === "up") rock(P, p, nh[0], nh[1], 9, 8); else hand(P, p, nh[0], nh[1], true);
    P.ell(x - 6, 19 + b, 17, 4, p.moss); P.ell(x - 10, 18 + b, 7, 2, p.mossHi); P.ell(x + 16, 29 + b, 9, 3, p.moss);
    drips(P, p, [[x - 22, 22 + b, 11, 0], [x - 13, 21 + b, 14, 1], [x - 2, 21 + b, 10, 0], [x + 8, 22 + b, 12, 0], [x + 12, 32 + b, 10, 1], [x + 21, 32 + b, 13, 0],
      [x - 33, 42 + b, 11, 0], [x - 6, 42 + b, 9, 2], [x + 4, 44 + b, 8, 2]]);
    P.seg(x - 20, 28 + b, x + 10, 50 + b, p.chain); P.seg(x - 19, 28 + b, x + 11, 50 + b, p.chainHi);
    if (gl) P.seg(x - 8, 34 + b, x + 2, 42 + b, p.glow);
  }

  Colossus.sheet = function () {
    const sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = {};
      for (const anim in ANIMS) sheet[dir][anim] = ANIMS[anim].map((pose) => Object.assign(DL.Art.mk(W, H, (P) => draw(P, dir, pose), PAL.outline), { ax: CX, ay: GY }));
    }
    return sheet;
  };
})(window.DL);
