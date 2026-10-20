/* Drowned Light — the five base kits in play: attacks, dashes, abilities, passives,
   the 20-level progression and what changes at milestones 5, 10, 15 and 20. */
"use strict";
(function (DL) {
  const { dist, rand, TAU, angleDiff } = DL;
  const G = DL.Game;
  const K = (DL.Kits = {});
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);

  /* ---------- progression ---------- */
  K.level = () => G.save.kitLevel;
  K.tier = () => Math.floor(G.save.kitLevel / 5); // 0..4: one per milestone reached
  K.has = (lvl) => G.save.kitLevel >= lvl;
  K.power = () => 1 + 0.05 * (G.save.kitLevel - 1); // +5% damage per level
  K.cdMult = () => 1 - 0.012 * (G.save.kitLevel - 1);
  K.color = () => G.kit().color;
  K.abilityCd = () => G.kit().ability.cd * K.cdMult();

  // Training at camp: cost, Central Flame requirement, and whether it's possible.
  // Training the next level: its cost and which camp structures it still needs.
  K.trainInfo = function () {
    const L = G.save.kitLevel;
    if (L >= DL.KIT_MAX_LEVEL) return { max: true };
    const cost = DL.kitLevelCost(L), req = DL.kitLevelReq(L + 1);
    const missing = Object.keys(req).filter((k) => G.save.up[k] < req[k])
      .map((k) => `${DL.UPGRADES.find((u) => u.id === k).name} ${req[k]}`);
    return { cost, req, missing, locked: missing.length > 0, ok: !missing.length && G.canAfford(cost) };
  };
  K.train = function () {
    const info = K.trainInfo();
    if (info.max || !info.ok) { sfx("deny"); return null; }
    G.pay(info.cost);
    G.save.kitLevel += 1;
    G.persist();
    const L = G.save.kitLevel, mi = DL.MILESTONE_LEVELS.indexOf(L);
    const p = G.player, col = K.color();
    G.effects.push({ type: "pillar", x: p.x, y: p.y, t: 0, max: mi >= 0 ? 1.6 : 1, col, big: mi >= 0 });
    G.effects.push({ type: "ring", x: p.x, y: p.y - 10, r0: 8, r1: mi >= 0 ? 140 : 70, t: 0, max: 0.7, col, w: mi >= 0 ? 10 : 5 });
    for (let i = 0; i < (mi >= 0 ? 40 : 14); i++) G.spark(p.x + rand(-14, 14), p.y - rand(0, 60), col, 160);
    if (mi >= 0) {
      const m = G.kit().milestones[mi];
      sfx("milestone");
      say(`Level ${L} milestone — ${m.name}: ${m.desc}`, "good");
      return { level: L, milestone: m };
    }
    sfx("build");
    return { level: L };
  };

  /* ---------- passives ---------- */
  // Pike Warden's Stable Form: standing still for a moment.
  K.steady = function (p) {
    const st = G.kit().passive && G.kit().passive.stance;
    return !!st && !p.moving && p.dashT <= 0 && (p.stillT || 0) >= st.after;
  };
  // Ashen Arbalist's Quiet Light: bolts hit harder the farther they've flown.
  K.farShotMult = function (b) {
    if (!b.farShot) return 1;
    const f = b.farShot, d = dist(b.ox, b.oy, b.x, b.y);
    return 1 + f.bonus * Math.max(0, Math.min(1, (d - f.from) / (f.to - f.from)));
  };

  K.damageTaken = function (p) {
    const kit = G.kit();
    let m = 1;
    if (kit.passive && kit.passive.guard) m *= 1 - (K.has(5) ? 0.35 : kit.passive.guard);
    if (K.steady(p)) m *= 1 - kit.passive.stance.guard;
    if (p.guardT > 0) m *= 0.5;
    return m;
  };
  K.lanternMult = () => (G.kit().passive && G.kit().passive.lanternR) || 1;
  K.oilDrain = () => (G.kit().passive && G.kit().passive.oilDrain) || 1;

  /* ---------- helpers ---------- */
  function nearest(x, y, R, skip) {
    let best = null, bd = R;
    for (const e of G.enemies) {
      if (e.rise > 0 || e.dormant || e.removed || (skip && skip.has(e))) continue;
      const d = dist(x, y, e.x, e.y) - e.def.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function shoot(p, ang, o) {
    const kit = G.kit();
    G.projectiles.push(Object.assign({
      x: p.x + Math.cos(ang) * 14, y: p.y - 26 + Math.sin(ang) * 8, ox: p.x, oy: p.y - 26,
      farShot: kit.passive && kit.passive.farShot,
      vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed,
      hostile: false, col: kit.color, hit: new Set(), pierce: 0,
    }, o));
  }
  function clearArrows(x, y, r) {
    G.projectiles = G.projectiles.filter((b) => {
      if (b.hostile && dist(x, y, b.x, b.y) < r) { G.spark(b.x, b.y, "90,235,245", 60); return false; }
      return true;
    });
  }
  function lightZone(x, y, r, t, extra) {
    G.lightZones.push(Object.assign({ x, y, r: r * G.diff().light, t }, extra || {}));
  }

  /* ---------- auto-attack ---------- */
  K.attack = function (p, st) {
    const kit = G.kit(), a = kit.attack, pw = K.power() * st.dmgMult * G.corruptBonus();
    const id = G.save.kit;
    let range = a.range;
    if (id === "pikeWarden" && K.has(5)) range *= 1.2;
    if (id === "ashenArbalist" && K.has(5)) range *= 1.15;
    if (id === "lanternBlade" && K.has(20)) range *= 1.1;
    const target = nearest(p.x, p.y, range + 26);
    if (!target) return false;
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    p.attackN = (p.attackN || 0) + 1;
    if (!p.moving) p.angle = ang;
    const swing = { ang, t: 0, dur: 0.2, col: kit.color, kind: a.type, range, flip: p.attackN % 2 === 1, arc: a.arc };

    if (a.type === "arc") {
      let arc = a.arc;
      if (id === "lanternBlade" && K.has(20)) { arc *= 1.3; swing.col = "255,244,214"; }
      swing.arc = arc;
      const burn = id === "lanternBlade" && K.has(5) ? 3 * pw : 0;
      for (const e of G.enemies.slice()) {
        if (e.rise > 0) continue;
        const d = dist(p.x, p.y, e.x, e.y) - e.def.radius;
        const ad = Math.abs(angleDiff(ang, Math.atan2(e.y - p.y, e.x - p.x)));
        if (d <= range && (ad <= arc / 2 || d < 8)) G.hitEnemy(e, a.dmg * pw, ang, a.kb, burn);
      }
      if (id === "lanternBlade" && K.has(10) && p.attackN % 3 === 0) {
        shoot(p, ang, { kind: "wave", speed: 430, life: 0.42, dmg: a.dmg * pw * 0.7, pierce: 99, r: 20, col: swing.col });
      }
      sfx("swing");
    } else if (a.type === "thrust") {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      for (const e of G.enemies.slice()) {
        if (e.rise > 0) continue;
        const rx = e.x - p.x, ry = e.y - p.y, along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
        if (along > -6 && along < range + e.def.radius && perp < a.width / 2 + e.def.radius) {
          G.hitEnemy(e, a.dmg * pw * (K.steady(p) ? kit.passive.stance.dmg : 1), ang, a.kb);
          if (K.has(10)) e.stun = Math.max(e.stun || 0, 0.6);
        }
      }
      if (K.has(20)) shoot(p, ang, { kind: "spear", speed: 720, life: 0.38, dmg: a.dmg * pw * 0.6, pierce: 99, r: 16 });
      sfx("swing");
    } else if (a.type === "bolt") {
      const count = K.has(20) ? 3 : 1;
      const aim = Math.atan2(target.y - 20 * target.def.scale - (p.y - 26), target.x - p.x);
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 0.14;
        const flare = K.has(15) && p.attackN % 4 === 0 && i === 0;
        shoot(p, aim + off, { kind: "bolt", speed: a.speed * (K.has(5) ? 1.2 : 1), life: (range * 1.15) / a.speed, dmg: a.dmg * pw,
          pierce: K.has(10) ? 3 : a.pierce, flare, r: 10 });
      }
      sfx("arrow");
    } else if (a.type === "orb") {
      const count = K.has(10) ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const off = count > 1 ? (i ? 0.5 : -0.5) : 0;
        shoot(p, ang + off, { kind: "orb", speed: a.speed, life: 1.4, dmg: a.dmg * pw, homing: true, r: 12 });
      }
      sfx("ability");
    }
    p.swing = swing;
    p.atkCd = a.cd;
    return true;
  };

  /* ---------- dash ---------- */
  K.dashStart = function (p) {
    p.slamShock = G.kit().dash.type === "slam" && K.has(15);
    p.fireTrailD = 0;
  };
  K.dashTick = function (p, st, dt) {
    const d = G.kit().dash, pw = K.power() * st.dmgMult * G.corruptBonus();
    const ang = Math.atan2(p.dashDir.y, p.dashDir.x);
    if (d.type === "strike" || d.type === "slam") {
      for (const e of G.enemies) {
        if (e.rise > 0 || p.dashHit.has(e)) continue;
        if (dist(p.x, p.y, e.x, e.y) < e.def.radius + 22) {
          p.dashHit.add(e);
          G.hitEnemy(e, d.dmg * pw, ang, d.type === "slam" ? 260 : 120);
          if (d.stun) e.stun = Math.max(e.stun || 0, d.stun);
        }
      }
    }
    if (d.type === "strike" && K.has(20)) {
      p.fireTrailD += 440 * dt;
      if (p.fireTrailD > 26) { p.fireTrailD = 0; lightZone(p.x, p.y, 46, 1.8, { fire: true, dps: 8 * pw }); }
    }
    if (p.dashT <= 0 && p.slamShock) {
      p.slamShock = false;
      G.effects.push({ type: "ring", x: p.x, y: p.y - 6, r0: 10, r1: 110, t: 0, max: 0.4, col: K.color(), w: 7 });
      G.camera.shake = 6;
      for (const e of G.enemies.slice()) {
        if (e.rise > 0 || dist(p.x, p.y, e.x, e.y) > 110 + e.def.radius) continue;
        G.hitEnemy(e, d.dmg * pw * 0.6, Math.atan2(e.y - p.y, e.x - p.x), 220);
        e.stun = Math.max(e.stun || 0, 0.8);
      }
    }
  };

  /* ---------- abilities ---------- */
  K.ability = function (p, st) {
    const kit = G.kit(), ab = kit.ability, pw = K.power() * st.dmgMult;
    const col = kit.color;
    if (ab.id === "illuminate") {
      const r = ab.radius * (1 + 0.01 * (K.level() - 1));
      G.effects.push({ type: "ring", x: p.x, y: p.y - 20, r0: 10, r1: r, t: 0, max: 0.45, col: "255,220,150", w: 8 });
      for (const e of G.enemies.slice()) {
        if (dist(p.x, p.y, e.x, e.y) < r + e.def.radius) G.hitEnemy(e, ab.dmg * pw, Math.atan2(e.y - p.y, e.x - p.x), 300);
      }
      lightZone(p.x, p.y - 10, r * 0.85, ab.dur * (K.has(15) ? 2 : 1), { heal: K.has(15) });
      for (let i = 0; i < 24; i++) G.spark(p.x, p.y - 20, "255,210,130", 220);
    } else if (ab.id === "sweep") {
      const r = ab.radius;
      G.effects.push({ type: "slash", x: p.x, y: p.y - 20, ang: p.angle, arc: TAU, r, t: 0, max: 0.28, col, w: 10 });
      G.effects.push({ type: "ring", x: p.x, y: p.y - 10, r0: 20, r1: r, t: 0, max: 0.35, col, w: 5 });
      for (const e of G.enemies.slice()) {
        if (dist(p.x, p.y, e.x, e.y) < r + e.def.radius) G.hitEnemy(e, ab.dmg * pw, Math.atan2(e.y - p.y, e.x - p.x), 360);
      }
      clearArrows(p.x, p.y - 20, r + 20);
      p.guardT = 1.5;
      if (K.has(15)) lightZone(p.x, p.y - 10, 125, 5);
    } else if (ab.id === "scatter") {
      const t = nearest(p.x, p.y, 320);
      const aim = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.angle;
      const n = ab.count + (K.has(20) ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const off = (i / (n - 1) - 0.5) * 1.0;
        shoot(p, aim + off, { kind: "bolt", speed: 560, life: 0.5, dmg: ab.dmg * pw, pierce: K.has(10) ? 2 : 0, lightOnEnd: true, r: 10 });
      }
      sfx("arrow");
    } else if (ab.id === "pulse") {
      const r = ab.radius;
      G.effects.push({ type: "ring", x: p.x, y: p.y - 20, r0: 10, r1: r, t: 0, max: 0.6, col, w: 8 });
      G.effects.push({ type: "ring", x: p.x, y: p.y - 20, r0: 10, r1: r * 0.6, t: 0, max: 0.45, col: "255,255,240", w: 4 });
      for (const e of G.enemies.slice()) {
        if (dist(p.x, p.y, e.x, e.y) < r + e.def.radius) {
          G.hitEnemy(e, ab.dmg * pw, Math.atan2(e.y - p.y, e.x - p.x), 160);
          e.slow = Math.max(e.slow, 2);
        }
      }
      clearArrows(p.x, p.y - 20, r);
      p.corrupt = Math.max(0, p.corrupt - ab.purify * (K.has(15) ? 2 : 1));
      if (K.has(15)) p.hp = Math.min(st.maxHp, p.hp + 25);
      lightZone(p.x, p.y - 10, r * 0.7, 4);
    } else if (ab.id === "wall") {
      const dur = ab.dur * (K.has(10) ? 1.5 : 1), dps = ab.dps * pw * (K.has(10) ? 1.6 : 1);
      if (K.has(20)) {
        const n = 10, R = 96;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
          G.walls.push({ x1: p.x + Math.cos(a0) * R, y1: p.y + Math.sin(a0) * R, x2: p.x + Math.cos(a1) * R, y2: p.y + Math.sin(a1) * R, t: dur, max: dur, dps });
        }
      } else {
        const ux = Math.cos(p.angle), uy = Math.sin(p.angle), cx = p.x + ux * 55, cy = p.y + uy * 55, h = ab.length / 2;
        G.walls.push({ x1: cx - uy * h, y1: cy + ux * h, x2: cx + uy * h, y2: cy - ux * h, t: dur, max: dur, dps });
      }
      G.camera.shake = 5;
      sfx("torch");
    }
  };

  /* ---------- per-frame upkeep: walls, fire, healing, milestone flourishes ---------- */
  function segDist(px, py, w) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / l2));
    const qx = w.x1 + dx * t, qy = w.y1 + dy * t;
    return { d: Math.hypot(px - qx, py - qy), qx, qy };
  }

  K.update = function (dt) {
    const p = G.player, kit = G.kit(), st = G.stats();
    p.guardT = Math.max(0, (p.guardT || 0) - dt);

    // Flame Bastion walls block, burn and slow the Drowned.
    for (const w of G.walls) {
      w.t -= dt;
      for (const e of G.enemies) {
        if (e.rise > 0 || e.removed) continue;
        const s = segDist(e.x, e.y, w), min = e.def.radius + 8;
        if (s.d < min) {
          const nx = (e.x - s.qx) / (s.d || 1), ny = (e.y - s.qy) / (s.d || 1);
          e.x = s.qx + nx * min; e.y = s.qy + ny * min;
          e.hp -= w.dps * dt;
          e.slow = Math.max(e.slow, 0.3);
          if (Math.random() < 0.05) G.spark(e.x, e.y - 20, "255,130,50", 40);
          if (e.hp <= 0) G.kill(e);
        }
      }
    }
    G.walls = G.walls.filter((w) => w.t > 0);

    // Fire trails and healing sanctuaries.
    for (const z of G.lightZones) {
      if (z.fire) {
        for (const e of G.enemies) {
          if (e.rise > 0 || e.removed || dist(z.x, z.y, e.x, e.y) > z.r * 0.7) continue;
          e.hp -= z.dps * dt;
          if (e.hp <= 0) G.kill(e);
        }
      }
      if (z.heal && dist(p.x, p.y, z.x, z.y) < z.r * 0.82) p.hp = Math.min(st.maxHp, p.hp + 5 * dt);
    }

    // Relic Bearer's guiding wisp drifts toward the nearest supplies.
    if (G.save.kit === "relicBearer" && K.has(5)) {
      G.wispT = (G.wispT || 0) - dt;
      if (G.wispT <= 0) {
        G.wispT = 0.6;
        let best = null, bd = 900;
        DL.World.near(p.x, p.y, 900, (o) => {
          if (!o.def.res || o.harvested) return;
          const d = dist(p.x, p.y, o.x, o.y);
          if (d < bd && d > 40) { bd = d; best = o; }
        });
        for (const pr of G.pearls) { const d = dist(p.x, p.y, pr.x, pr.y); if (d < bd && d > 40) { bd = d; best = pr; } }
        G.wispTarget = best;
      }
      const tg = G.wispTarget;
      if (!G.wisp) G.wisp = { x: p.x, y: p.y - 40 };
      let tx = p.x, ty = p.y - 46;
      if (tg && !tg.harvested) {
        const d = dist(p.x, p.y, tg.x, tg.y), k = Math.min(80, d * 0.5) / (d || 1);
        tx = p.x + (tg.x - p.x) * k; ty = p.y - 30 + (tg.y - p.y) * k;
      }
      const f = 1 - Math.pow(0.05, dt);
      G.wisp.x += (tx - G.wisp.x) * f;
      G.wisp.y += (ty + Math.sin(G.t * 3) * 6 - G.wisp.y) * f;
    } else G.wisp = null;

    // Embers that drift off a kit from its second milestone on.
    const tier = K.tier();
    if (tier >= 2 && Math.random() < dt * (3 + tier * 3)) {
      G.effects.push({ type: "spark", x: p.x + rand(-12, 12), y: p.y - rand(10, 60), vx: rand(-10, 10), vy: rand(-50, -25), t: 0, max: rand(0.6, 1.1), col: kit.color, size: rand(1.5, 2.5) });
    }
  };

  // Extra lights from the kit: walls, fire trails, the Relic Bearer's halo.
  K.lights = function (L) {
    const p = G.player, D = G.diff();
    for (const w of G.walls) {
      const f = Math.min(1, w.t / 1.2);
      for (const u of [0.15, 0.5, 0.85]) {
        L.push({ x: w.x1 + (w.x2 - w.x1) * u, y: w.y1 + (w.y2 - w.y1) * u - 14, r: 80 * f * D.light, s: f, col: "255,120,40", a: f, flick: 1, kind: "human" });
      }
    }
    if (p && G.save.kit === "relicBearer" && K.has(20)) {
      L.push({ x: p.x, y: p.y - 24, r: 92 * D.light, s: 0.55, col: "255,232,170", a: 0.25, kind: "bloom" });
    }
    if (G.wisp) L.push({ x: G.wisp.x, y: G.wisp.y, r: 40, s: 0.4, col: "255,232,170", a: 0.9 });
  };
})(window.DL);
