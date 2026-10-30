/* Drowned Light — the seven kits in play: attacks, dashes, abilities, passives,
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
    // A co-op guest asks the host, who pays from the shared stash; the level comes back in a reply.
    if (G.isGuest()) { DL.Net.event({ t: "train", level: G.save.kitLevel }); return null; }
    G.pay(info.cost);
    G.save.kitLevel += 1;
    G.persist();
    return K.levelUpFx(G.save.kitLevel);
  };

  // The pillar of light, ring, sparks and (at milestones) fanfare for reaching level L.
  K.levelUpFx = function (L) {
    const mi = DL.MILESTONE_LEVELS.indexOf(L);
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
    if (kit.passive && kit.passive.aegis) m *= 1 - kit.passive.aegis; // the Rose Paladin's rose shield
    return m;
  };
  // The Chain Reaper's pace: a fifth faster always, faster still in Reaper's Rush after a kill.
  K.speedMult = function (p) {
    const kit = G.kit(), rush = kit.passive && kit.passive.rush;
    return (kit.speedMult || 1) * (rush && p.rushT > 0 ? rush.speed : 1) * (p.tideCharge ? 0.5 : 1) // charging Jade Tide slows him
      * (p.waltz ? kit.ability.move : 1); // and the Rose Paladin walks slower while he waltzes
  };
  // The Jade Breaker's Momentum: the bonus damage his next swing carries (0 to passive.momentum.bonus).
  function momentum(p) {
    const m = G.kit().passive && G.kit().passive.momentum;
    return m ? m.bonus * Math.min(1, (p.momT || 0) / m.full) : 0;
  }
  K.momentum = momentum;
  /* The Rose Paladin's Thorned Aegis (host): a Drowned whose blow lands on a Rose Paladin (`kit`: the struck knight's
     kit) is pricked by his shield's thorns for a share of the blow. */
  K.thorns = function (e, kit, dmg, k) {
    const ps = DL.KITS[kit] && DL.KITS[kit].passive;
    if (!ps || !ps.thorns || e.removed || e.def.king) return;
    G.hitEnemy(e, dmg * ps.thorns, Math.atan2(e.y - k.y, e.x - k.x), 60);
    for (let i = 0; i < 5; i++) G.spark(e.x + rand(-8, 8), e.y - rand(10, 40), "220,40,60", 80);
  };
  /* Bind a Drowned in the Deadly Rose's briar for `hold` s, stung for `sting` every half second (src/trophies.js runs it
     on the host, so a co-op guest sends it there). */
  K.bind = function (e, hold, sting) {
    if (e.removed || e.rise > 0 || e.def.king) return;
    if (G.isGuest()) DL.Net.event({ t: "bind", id: e.id, hold, sting });
    else DL.Trophies.bind(e, hold, sting);
  };
  K.dashCd = () => G.kit().dash.cd || 2.2;
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

  /* The Chain Reaper's blows: Executioner finishes the weak, Barbed Chain makes them bleed, and a kill
     is Reaper's Rush (the dash back and a burst of speed). On a co-op guest the host owns the Drowned,
     so a kill is judged from the blow. */
  function reap(e, dmg, ang, kb) {
    if (e.removed || e.rise > 0) return;
    const p = G.player, rush = G.kit().passive && G.kit().passive.rush;
    if (K.has(15) && e.hp < e.maxHp * 0.3) dmg *= 1.5;
    const hp = e.hp;
    G.hitEnemy(e, dmg, ang, kb);
    if (K.has(5) && !e.removed) { e.bleedN = Math.min(3, (e.bleed > 0 ? e.bleedN || 0 : 0) + 1); e.bleed = 3; }
    if (rush && (e.removed || (G.isGuest() && hp - dmg * (1 - (e.def.armor || 0)) <= 0))) {
      p.dashCd = 0;
      p.rushT = rush.dur;
      for (let i = 0; i < 8; i++) G.spark(p.x + rand(-10, 10), p.y - rand(10, 50), G.kit().color, 120);
    }
  }
  // Everything along a sickle's line out to `range`, at most `width` either side of it.
  function onLine(p, ang, range, width) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    return G.enemies.filter((e) => {
      if (e.rise > 0 || e.removed) return false;
      const rx = e.x - p.x, ry = e.y - p.y, along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
      return along > -6 && along < range + e.def.radius && perp < width / 2 + e.def.radius;
    });
  }

  /* ---------- auto-attack ---------- */
  // Manual aim gets a gentle assist: the nearest Drowned within ~35° of the aim, if any.
  function assisted(p, aim, R) {
    let best = null, bd = R;
    for (const e of G.enemies) {
      if (e.rise > 0 || e.dormant || e.removed) continue;
      const d = dist(p.x, p.y, e.x, e.y) - e.def.radius;
      if (d < bd && Math.abs(angleDiff(aim, Math.atan2(e.y - p.y, e.x - p.x))) < 0.6) { bd = d; best = e; }
    }
    return best;
  }
  K.reach = function () {
    const a = G.kit().attack, id = G.save.kit;
    let range = a.range;
    if (id === "pikeWarden" && K.has(5)) range *= 1.2;
    if (id === "ashenArbalist" && K.has(5)) range *= 1.15;
    if (id === "lanternBlade" && K.has(20)) range *= 1.1;
    if (id === "jadeBreaker" && K.has(5)) range *= 1.15;
    return range;
  };
  K.nearestEnemy = nearest;

  /* Strike with the kit's weapon. Auto mode (aim undefined) only strikes when a Drowned is in reach;
     manual mode strikes toward `aim` every time, hitting whatever is there. */
  K.attack = function (p, st, aim) {
    const kit = G.kit(), a = kit.attack, pw = K.power() * st.dmgMult * G.corruptBonus();
    const id = G.save.kit;
    const range = K.reach();
    const manual = aim != null;
    const target = manual ? assisted(p, aim, range + 40) : nearest(p.x, p.y, range + 26);
    if (!target && !manual) return false;
    const ang = target ? Math.atan2(target.y - p.y, target.x - p.x) : aim;
    p.attackN = (p.attackN || 0) + 1;
    if (!p.moving) p.angle = ang;
    const swing = { ang, t: 0, dur: 0.2, col: kit.color, kind: a.type, range, flip: p.attackN % 2 === 1, arc: a.arc };

    if (a.type === "arc") {
      let arc = a.arc;
      if (id === "lanternBlade" && K.has(20)) { arc *= 1.3; swing.col = "255,244,214"; }
      swing.arc = arc;
      const burn = id === "lanternBlade" && K.has(5) ? 3 * pw : 0;
      // the Jade Breaker's Momentum goes into the swing and is spent; Crystal Edge hurls harder, Shatter stuns
      const mom = momentum(p), jade = id === "jadeBreaker";
      const dmg = a.dmg * pw * (1 + mom), kb = a.kb * (jade && K.has(5) ? 1.2 : 1);
      // the Rose Paladin's Thorn Lash: Crown of Thorns (10) makes them bleed; Rosebriar Lash (15) binds what every third lash strikes
      const binds = a.lash && K.has(15) && (p.lashN = (p.lashN || 0) + 1) % 3 === 0;
      if (jade) { p.momT = 0; swing.dur = 0.3; if (mom > 0.15) swing.col = "180,255,200"; }
      for (const e of G.enemies.slice()) {
        if (e.rise > 0) continue;
        const d = dist(p.x, p.y, e.x, e.y) - e.def.radius;
        const ad = Math.abs(angleDiff(ang, Math.atan2(e.y - p.y, e.x - p.x)));
        if (d <= range && (ad <= arc / 2 || d < 8)) {
          G.hitEnemy(e, dmg, ang, kb, burn);
          if (jade && K.has(10)) e.stun = Math.max(e.stun || 0, 0.6);
          if (a.lash && K.has(10) && !e.removed) { e.bleedN = Math.min(3, (e.bleed > 0 ? e.bleedN || 0 : 0) + 1); e.bleed = 3; }
          if (binds) K.bind(e, 1.2, kit.ability.sting * pw);
        }
      }
      if (jade) G.camera.shake = Math.max(G.camera.shake || 0, 3);
      if (a.lash) { Object.assign(swing, { kind: "lash", dur: 0.34 }); G.camera.shake = Math.max(G.camera.shake || 0, 2); }
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
      const aim = target ? Math.atan2(target.y - 20 * target.def.scale - (p.y - 26), target.x - p.x) : ang;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 0.14;
        const flare = K.has(15) && p.attackN % 4 === 0 && i === 0;
        shoot(p, aim + off, { kind: "bolt", speed: a.speed * (K.has(5) ? 1.2 : 1), life: (range * 1.15) / a.speed, dmg: a.dmg * pw,
          pierce: K.has(10) ? 3 : a.pierce, flare, r: 10 });
      }
      sfx("arrow");
    } else if (a.type === "chain") {
      // Sickle Throw: the sickle cuts along its line on the way out; the swing tears it back halfway (K.update).
      const angs = K.has(10) ? [ang - 0.22, ang + 0.22] : [ang];
      for (const g of angs) for (const e of onLine(p, g, range, a.width)) reap(e, a.dmg * pw, g, a.kb);
      Object.assign(swing, { dur: 0.32, angs, back: false, dmg: a.dmg * a.back * pw, width: a.width });
      sfx("swing");
    } else if (a.type === "frost") {
      // the Frostweaver's frost bolt, straight and quick; from Deep Freeze on it's the bigger bolt and it freezes (K.chill)
      const aim = target ? Math.atan2(target.y - 20 * target.def.scale - (p.y - 26), target.x - p.x) : ang;
      shoot(p, aim, { kind: "ice", big: K.has(10), speed: a.speed, life: (range * 1.15) / a.speed, dmg: a.dmg * pw, ice: 1, r: 10 });
      sfx("arrow");
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
          if (G.kit().passive && G.kit().passive.rush) reap(e, d.dmg * pw, ang, 120);
          else G.hitEnemy(e, d.dmg * pw, ang, d.type === "slam" ? 260 : 120);
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
    } else if (ab.id === "icebomb") {
      // Ice Bomb: lobbed at the nearest Drowned in reach (or `throw` px the way you aim); it bursts where it lands (K.update)
      const manual = p.aim != null && G.save.attackMode === "manual";
      const t = manual ? null : nearest(p.x, p.y, ab.reach);
      const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : manual ? p.aim : p.angle;
      const d = t ? Math.min(ab.reach, dist(p.x, p.y, t.x, t.y)) : ab.throw;
      bombs.push({ x0: p.x, y0: p.y - 34, x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, t: 0, max: ab.flight, dmg: ab.dmg * pw });
      sfx("swing");
    } else if (ab.id === "snare") {
      // Violet Snare: the chain whirled round, cutting and rooting all in reach (the ring is drawn in src/render.js).
      const r = ab.radius;
      G.effects.push({ type: "snare", x: p.x, y: p.y, r, t: 0, max: 0.5 });
      for (const e of G.enemies.slice()) {
        if (e.rise > 0 || e.removed || dist(p.x, p.y, e.x, e.y) > r + e.def.radius) continue;
        reap(e, ab.dmg * pw, Math.atan2(e.y - p.y, e.x - p.x), 60);
        e.stun = Math.max(e.stun || 0, ab.root);
        e.snareT = ab.root;
      }
      if (K.has(20)) gyres.push({ x: p.x, y: p.y, r, t: 4, max: 4 });
      G.camera.shake = 4;
      sfx("swing");
    } else if (ab.id === "tide") {
      // Jade Tide: a fan of crystals bursting up row by row ahead of you (drawn in src/render.js); Twin Tide makes it twice as big.
      const ang = p.aim != null && G.save.attackMode === "manual" ? p.aim : p.angle;
      tide(p.x, p.y, ang, 0, ab.dmg * pw);
      G.effects.push({ type: "slash", x: p.x, y: p.y - 20, ang, arc: ab.fan + 0.6, r: 90, t: 0, max: 0.3, col, w: 12 });
      G.camera.shake = 7;
      sfx("swing");
    } else if (ab.id === "waltz") {
      // Rose's Waltz: he whirls inside her ring of thorn whips (src/render.js), cutting all round him `hits` times (K.update)
      const big = K.has(20);
      p.waltz = { t: ab.spin * (big ? 1.4 : 1), tick: 0, hits: 0, n: big ? ab.bigHits : ab.hits, r: big ? ab.bigR : ab.r, dmg: ab.dmg * pw };
      p.cast = { t: 0, dur: p.waltz.t, ang: p.angle }; // so a co-op friend sees him waltzing
      sfx("dash");
    } else if (ab.id === "wall") {
      const dur = ab.dur * (K.has(10) ? 1.5 : 1), dps = ab.dps * pw * (K.has(10) ? 1.6 : 1);
      if (K.has(20)) {
        const n = 10, R = 96;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
          G.walls.push({ x1: p.x + Math.cos(a0) * R, y1: p.y + Math.sin(a0) * R, x2: p.x + Math.cos(a1) * R, y2: p.y + Math.sin(a1) * R, t: dur, max: dur, dps });
        }
      } else {
        // The eruption: everything between you and where the wall rises is scorched, set alight and hurled back.
        const ang = p.aim != null && G.save.attackMode === "manual" ? p.aim : p.angle;
        const ux = Math.cos(ang), uy = Math.sin(ang), cx = p.x + ux * ab.reach, cy = p.y + uy * ab.reach, h = ab.length / 2;
        for (const e of G.enemies.slice()) {
          if (e.rise > 0 || e.removed) continue;
          const rx = e.x - p.x, ry = e.y - p.y, along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
          if (along > -10 && along < ab.reach + 24 + e.def.radius && perp < h + e.def.radius) G.hitEnemy(e, ab.dmg * pw, ang, 280, ab.burn * pw);
        }
        G.effects.push({ type: "erupt", x: p.x, y: p.y, ux, uy, reach: ab.reach, h, t: 0, max: 0.3 });
        G.walls.push({ x1: cx - uy * h, y1: cy + ux * h, x2: cx + uy * h, y2: cy - ux * h, t: dur, max: dur, dps });
      }
      G.camera.shake = 8;
      sfx("torch");
    }
  };

  /* ---------- the Frostweaver's frost ---------- */
  /* A blow of his: the Ice Bomb always freezes, everything else from Deep Freeze (10) on; from Brittle (15) it makes
     them brittle too, and from Shatter (20) a frozen one that dies shatters (K.shatter). Call it before the blow lands,
     so that blow already counts. On a co-op guest the host owns the Drowned, so it's sent there (and shown here). */
  const ICE = DL.ICE;
  K.chill = function (e, bomb) {
    if (e.removed || e.rise > 0 || G.save.kit !== "relicBearer") return;
    const freeze = bomb || K.has(10), brittle = K.has(15), shatter = K.has(20);
    if (!freeze && !brittle) return;
    if (G.isGuest()) DL.Net.event({ t: "ice", id: e.id, f: freeze ? 1 : 0, b: brittle ? 1 : 0, s: shatter ? 1 : 0 });
    K.ice(e, freeze, brittle, shatter);
  };
  K.ice = function (e, freeze, brittle, shatter) {
    if (freeze) {
      e.frost = Math.max(e.frost || 0, ICE.frost);
      e.slow = Math.max(e.slow || 0, ICE.frost);
      if (shatter) e.shatter = true;
    }
    if (brittle) e.brittle = Math.max(e.brittle || 0, ICE.brittleT);
  };
  // Frozen or brittle as this device sees it (a guest only has the host's word, in e.fx).
  K.frozen = (e) => (G.isGuest() ? (e.fx & 16) > 0 : e.frost > 0);
  K.brittle = (e) => (G.isGuest() ? (e.fx & 32) > 0 : e.brittle > 0);
  // Host: a Drowned frozen by a Shatter-level mage has died. It bursts and freezes up to ICE.shatterN others near.
  K.shatter = function (e) {
    if (!(e.frost > 0) || !e.shatter) return;
    e.shatter = false;
    G.effects.push({ type: "iceBurst", x: e.x, y: e.y, r: 46, t: 0, max: 0.55, n: 6, seed: e.id });
    for (let i = 0; i < 10; i++) G.spark(e.x + rand(-10, 10), e.y - rand(0, 40), "190,235,255", 140);
    const near = G.enemies.filter((o) => o !== e && !o.removed && !(o.rise > 0) && dist(e.x, e.y, o.x, o.y) < ICE.shatterR)
      .sort((a, b) => dist(e.x, e.y, a.x, a.y) - dist(e.x, e.y, b.x, b.y)).slice(0, ICE.shatterN);
    for (const o of near) {
      K.ice(o, true, false, true);
      G.effects.push({ type: "iceLink", x1: e.x, y1: e.y - 20, x2: o.x, y2: o.y - 20 * o.def.scale, t: 0, max: 0.35 });
    }
  };

  // Ice Bombs in the air: each lands `max` s after it's thrown and bursts over the ability's radius.
  let bombs = [], bombLife = null;
  K.bombs = () => bombs;
  function burst(b) {
    const ab = G.kit().ability, r = ab.radius;
    G.effects.push({ type: "iceBurst", x: b.x, y: b.y, r, t: 0, max: 0.9, n: 14, seed: Math.round(b.x) });
    G.effects.push({ type: "ring", x: b.x, y: b.y, r0: 10, r1: r, t: 0, max: 0.45, col: "190,235,255", w: 8 });
    for (let i = 0; i < 26; i++) G.spark(b.x + rand(-20, 20), b.y - rand(0, 30), i % 2 ? "190,235,255" : "255,255,255", 260);
    for (const e of G.enemies.slice()) {
      if (e.rise > 0 || e.removed || dist(b.x, b.y, e.x, e.y) > r + e.def.radius) continue;
      K.chill(e, true);
      G.hitEnemy(e, b.dmg, Math.atan2(e.y - b.y, e.x - b.x), ab.kb);
    }
    lightZone(b.x, b.y, r * 0.6, 1.2);
    G.camera.shake = Math.max(G.camera.shake || 0, 6);
    sfx("hit");
  }

  /* ---------- per-frame upkeep: walls, fire, healing, milestone flourishes ---------- */

  function segDist(px, py, w) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / l2));
    const qx = w.x1 + dx * t, qy = w.y1 + dy * t;
    return { d: Math.hypot(px - qx, py - qy), qx, qy };
  }

  /* Jade Tide's crystals: rows of clusters fanned out ahead of the knight, each bursting up when the wave reaches it
     (`at` s from now) and striking every Drowned within `r`; a Drowned is struck once per wave. They stand `life` s,
     or as a wall for `wall` s at Jade Bulwark, then shatter. Twin Tide (15) sends the wave `twin` times as far, and the
     tide racing beside his rush `twin` times as wide. */
  const twin = () => (K.has(15) ? G.kit().ability.twin : 1);
  let crystals = [], crystalLife = null;
  K.crystals = () => crystals;
  function tide(x, y, ang, delay, dmg, hit = new Set()) {
    const ab = G.kit().ability, stand = K.has(20) ? ab.wall : ab.life;
    for (let d = ab.step, reach = ab.reach * twin(); d <= reach; d += ab.step) {
      const n = Math.max(1, Math.round((d * ab.fan) / 55)); // about one cluster every 55 px across the fan
      for (let i = 0; i < n; i++) {
        const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * ab.fan : 0) + rand(-0.06, 0.06), dd = d + rand(-6, 6);
        crystals.push({ x: x + Math.cos(a) * dd, y: y + Math.sin(a) * dd, at: delay + d / ab.speed, t: 0, max: stand, ang, dmg, hit, flip: Math.random() < 0.5, r: 30 });
      }
    }
  }
  // During the rush the tide keeps pace with him: a row of crystals across his path (`charge.lane` px either side) bursts
  // up every `charge.row` px he travels, just ahead of him, so what he dashes past is struck too.
  function tideRow(x, y, ang, dmg, hit) {
    const ch = G.kit().ability.charge, stand = K.has(20) ? G.kit().ability.wall : G.kit().ability.life;
    const lane = ch.lane * twin(), nx = -Math.sin(ang), ny = Math.cos(ang), n = Math.max(3, Math.round(lane / 27) + 1);
    for (let i = 0; i < n; i++) {
      const o = (i / (n - 1) - 0.5) * 2 * lane + rand(-6, 6), f = 14 + rand(-4, 4);
      crystals.push({ x: x + nx * o + Math.cos(ang) * f, y: y + ny * o + Math.sin(ang) * f, at: 0, t: 0, max: stand, ang, dmg, hit, flip: Math.random() < 0.5, r: 30 });
    }
  }
  /* Jade Tide held: the button starts a charge (K.tideStart). Let go before `hold` s and the tide goes off where he
     stands; held longer, he rushes forward in a dash strike, the tide racing along beside him, and bursts out where he stops. The oil and the
     cooldown are paid on letting go. The rush is his own, so his dash stays free. Returns true while it moves him. */
  K.tideStart = function (p) { if (!p.tideCharge && !p.tideDash) p.tideCharge = { t: 0, full: false }; };
  K.tideTick = function (p, st, dt) {
    const kit = G.kit(), ab = kit.ability, ch = ab.charge;
    if (!ch) { p.tideCharge = p.tideDash = null; return false; }
    const pw = K.power() * st.dmgMult;
    const aim = () => (p.aim != null && G.save.attackMode === "manual" ? p.aim : p.angle);
    if (p.tideCharge) {
      const c = p.tideCharge;
      c.t += dt;
      if (DL.Input.abilityHeld() && c.t < ch.max && G.state === "play") {
        if (!c.full && c.t >= ch.hold) {
          c.full = true;
          G.effects.push({ type: "ring", x: p.x, y: p.y - 6, r0: 6, r1: 46, t: 0, max: 0.3, col: kit.color, w: 4 });
          sfx("build");
        }
        if (Math.random() < dt * (c.full ? 30 : 12)) G.spark(p.x + rand(-16, 16), p.y - rand(0, 50), c.full ? "180,255,200" : kit.color, 50);
        return false;
      }
      p.tideCharge = null;
      if (p.oil < ab.oil) { sfx("deny"); return false; } // spent while charging (a torch, the fire going out)
      p.oil -= ab.oil;
      p.abiCd = K.abilityCd();
      sfx("ability");
      if (!c.full) {
        p.cast = { t: 0, dur: 0.4, ang: aim() };
        K.ability(p, st);
        return false;
      }
      const ang = aim();
      p.angle = ang;
      p.tideDash = { t: ch.dash, ang, hit: new Set(), tideHit: new Set(), run: ch.row };
      p.inv = Math.max(p.inv, ch.dash + 0.1);
      G.camera.shake = 4;
    }
    const d = p.tideDash;
    if (!d) return false;
    d.t -= dt;
    p.x += Math.cos(d.ang) * ch.speed * dt;
    p.y += Math.sin(d.ang) * ch.speed * dt;
    p.moving = false;
    for (d.run += ch.speed * dt; d.run >= ch.row; d.run -= ch.row) tideRow(p.x, p.y, d.ang, ab.dmg * pw * ch.bonus, d.tideHit);
    p.trail.push({ x: p.x, y: p.y, life: 0.25, ang: d.ang });
    for (const e of G.enemies.slice()) {
      if (e.rise > 0 || e.removed || d.hit.has(e) || dist(p.x, p.y, e.x, e.y) > e.def.radius + 28) continue;
      d.hit.add(e);
      G.hitEnemy(e, kit.attack.dmg * pw * G.corruptBonus() * ch.bonus, d.ang, ch.kb);
      if (K.has(10)) e.stun = Math.max(e.stun || 0, 0.6);
    }
    if (d.t <= 0) {
      p.tideDash = null;
      p.cast = { t: 0.14, dur: 0.4, ang: d.ang }; // straight into the great sweep
      tide(p.x, p.y, d.ang, 0, ab.dmg * pw * ch.bonus, d.tideHit); // what the racing tide struck isn't struck again
      G.effects.push({ type: "slash", x: p.x, y: p.y - 20, ang: d.ang, arc: ab.fan + 0.6, r: 90, t: 0, max: 0.3, col: kit.color, w: 12 });
      G.camera.shake = 8;
      sfx("swing");
    }
    return true;
  };

  function updateCrystals(dt) {
    const ab = G.kit().ability;
    for (const c of crystals) {
      if (c.at > 0) {
        c.at -= dt;
        if (c.at > 0) continue;
        for (let i = 0; i < 4; i++) G.spark(c.x + rand(-10, 10), c.y - rand(0, 30), "120,255,170", 90);
        for (const e of G.enemies.slice()) {
          if (e.rise > 0 || e.removed || c.hit.has(e) || dist(c.x, c.y, e.x, e.y) > c.r + e.def.radius) continue;
          c.hit.add(e);
          G.hitEnemy(e, c.dmg, c.ang, ab.kb * (K.has(5) ? 1.2 : 1));
          if (K.has(10)) e.stun = Math.max(e.stun || 0, 0.6);
        }
        continue;
      }
      c.t += dt;
      if (!K.has(20) || c.t > c.max - 0.3) continue;
      // Jade Bulwark: the standing crystals are a wall the Drowned are pushed back out of
      for (const e of G.enemies) {
        if (e.rise > 0 || e.removed || e.def.king || e.def.boss) continue;
        const d = dist(c.x, c.y, e.x, e.y), min = 16 + e.def.radius;
        if (d < min) { const k = min / (d || 1); e.x = c.x + (e.x - c.x) * k; e.y = c.y + (e.y - c.y) * k; }
      }
    }
    crystals = crystals.filter((c) => c.at > 0 || c.t < c.max);
  }

  // Violet Gyre: the rings of whirling chain Violet Snare leaves behind at level 20.
  let gyres = [], gyreLife = null;
  K.gyres = () => gyres;

  K.update = function (dt) {
    const p = G.player, kit = G.kit(), st = G.stats();
    p.guardT = Math.max(0, (p.guardT || 0) - dt);
    p.rushT = Math.max(0, (p.rushT || 0) - dt);
    // Momentum builds while moving and drains twice as fast standing still
    if (kit.passive && kit.passive.momentum) p.momT = Math.max(0, Math.min(kit.passive.momentum.full, (p.momT || 0) + (p.moving ? dt : -2 * dt)));
    if (crystalLife !== p) { crystals = []; crystalLife = p; } // a new life clears them
    updateCrystals(dt);

    // Rose's Waltz: a cut all round him every spin/hits s; Briar Bind (5) holds what it cuts.
    const wz = p.waltz;
    if (wz) {
      const ab = kit.ability;
      wz.t -= dt;
      wz.tick -= dt;
      if (wz.tick <= 0 && wz.hits < wz.n) {
        wz.tick = (ab.spin * (K.has(20) ? 1.4 : 1)) / wz.n;
        wz.hits++;
        G.effects.push({ type: "ring", x: p.x, y: p.y - 26, r0: 24, r1: wz.r, t: 0, max: 0.3, col: kit.color, w: 4 });
        sfx("swing");
        for (const e of G.enemies.slice()) {
          if (e.rise > 0 || e.removed || dist(p.x, p.y, e.x, e.y) > wz.r + e.def.radius) continue;
          G.hitEnemy(e, wz.dmg * G.corruptBonus(), Math.atan2(e.y - p.y, e.x - p.x), ab.kb);
          if (K.has(5) && !(e.bound > 0)) K.bind(e, ab.bind, ab.sting * K.power() * st.dmgMult);
        }
      }
      if (Math.random() < dt * 30) { const a = rand(0, TAU); G.spark(p.x + Math.cos(a) * wz.r * 0.8, p.y - 26 + Math.sin(a) * wz.r * 0.4, kit.color, 70); }
      if (wz.t <= 0 || p.downT > 0 || G.state !== "play") p.waltz = null;
    }

    // The Chain Reaper: the sickle torn back along its line halfway through the throw.
    const sw = p.swing;
    if (sw && sw.kind === "chain" && !sw.back && sw.t >= sw.dur / 2) {
      sw.back = true;
      for (const g of sw.angs) for (const e of onLine(p, g, sw.range, sw.width)) reap(e, sw.dmg, g + Math.PI, 40);
    }
    if (gyreLife !== p) { gyres = []; gyreLife = p; } // a new life clears them
    for (const g of gyres) {
      g.t -= dt;
      for (const e of G.enemies) {
        if (e.rise > 0 || e.removed || (e.gyreT || 0) > G.t || Math.abs(dist(g.x, g.y, e.x, e.y) - g.r * 0.85) > 22 + e.def.radius) continue;
        e.gyreT = G.t + 1; // each Drowned cut at most once a second
        reap(e, kit.ability.dmg * 0.5 * K.power() * st.dmgMult, Math.atan2(e.y - g.y, e.x - g.x), 40);
        e.stun = Math.max(e.stun || 0, 1);
        e.snareT = Math.max(e.snareT || 0, 1);
      }
    }
    gyres = gyres.filter((g) => g.t > 0);
    for (const e of G.enemies) if (e.snareT > 0) e.snareT -= dt;

    // Flame Bastion walls block, burn and slow the Drowned.
    for (const w of G.walls) {
      w.t -= dt;
      for (const e of G.enemies) {
        if (e.rise > 0 || e.removed || e.def.king) continue; // the Sunken King is far too big to fence in (src/finale.js)
        const s = segDist(e.x, e.y, w), min = e.def.radius + 8;
        if (s.d < min) {
          const nx = (e.x - s.qx) / (s.d || 1), ny = (e.y - s.qy) / (s.d || 1);
          e.x = s.qx + nx * min; e.y = s.qy + ny * min;
          e.hp -= w.dps * dt;
          e.slow = Math.max(e.slow, 0.3);
          if (!(e.burn > 0)) { e.burn = 2; e.burnDps = w.dps * 0.4; } // whatever touches it catches fire
          if (Math.random() < 0.05) G.spark(e.x, e.y - 20, "255,130,50", 40);
          if (e.hp <= 0) G.kill(e);
        }
      }
    }
    G.walls = G.walls.filter((w) => w.t > 0);
    // embers rising off the walls
    for (const w of G.walls) if (Math.random() < dt * 14) {
      const u = Math.random();
      G.effects.push({ type: "spark", x: w.x1 + (w.x2 - w.x1) * u, y: w.y1 + (w.y2 - w.y1) * u - rand(10, 30), vx: rand(-12, 12), vy: rand(-70, -35), t: 0, max: rand(0.6, 1.2), col: rand(0, 1) < 0.5 ? "255,190,90" : "255,120,40", size: rand(1.5, 3) });
    }

    // Fire trails and healing sanctuaries.
    for (const z of G.lightZones) {
      if (z.fire) {
        for (const e of G.enemies) {
          if (e.rise > 0 || e.removed || e.def.king || dist(z.x, z.y, e.x, e.y) > z.r * 0.7) continue;
          e.hp -= z.dps * dt;
          if (e.hp <= 0) G.kill(e);
        }
      }
      if (z.heal && dist(p.x, p.y, z.x, z.y) < z.r * 0.82) p.hp = Math.min(st.maxHp, p.hp + 5 * dt);
    }

    if (bombLife !== p) { bombs = []; bombLife = p; } // a new life clears them
    for (const b of bombs) if ((b.t += dt) >= b.max) burst(b);
    bombs = bombs.filter((b) => b.t < b.max);

    /* The Frostweaver's owl (Ice Owl, level 5): flies at your shoulder and hurls ice shards at the nearest Drowned; when
       you've stood still a while with nothing to fight it lands beside you. G.wisp is sent to the other knights. */
    if (G.save.kit === "relicBearer" && K.has(5)) {
      const O = ICE.owl;
      if (!G.wisp) G.wisp = { x: p.x, y: p.y - 40, face: 1, castT: 0, idle: 0 };
      const w = G.wisp, tg = G.wispTarget, live = tg && !tg.removed && !(tg.rise > 0) && dist(p.x, p.y, tg.x, tg.y) < O.range + 40;
      if (!live) G.wispTarget = null;
      G.wispT = (G.wispT || 0) - dt;
      if (G.wispT <= 0 && G.state === "play" && !(p.downT > 0)) {
        let best = null, bd = O.range;
        for (const e of G.enemies) {
          if (e.rise > 0 || e.removed || e.dormant) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        G.wispTarget = best;
        if (best) {
          G.wispT = O.cd;
          const ang = Math.atan2(best.y - 20 * best.def.scale - w.y, best.x - w.x);
          shoot({ x: w.x, y: w.y + 26 }, ang, { kind: "iceShard", speed: 420, life: 0.9, dmg: O.dmg * K.power() * st.dmgMult * G.corruptBonus(), homing: true, ice: 1, r: 8 });
          w.castT = 0.3;
          w.face = Math.cos(ang) < 0 ? -1 : 1;
          G.spark(w.x, w.y, kit.color, 40);
        } else G.wispT = 0.3;
      }
      w.castT = Math.max(0, w.castT - dt);
      w.idle = p.moving || G.wispTarget ? 0 : w.idle + dt;
      // Lean a little toward whatever it's harrying, otherwise bob above your shoulder (or stand at your heel).
      const t = G.wispTarget, back = Math.cos(p.angle) < 0 ? 1 : -1;
      let tx = p.x + 24 * back, ty = p.y - 66;
      if (t) {
        const d = dist(p.x, p.y, t.x, t.y), k = Math.min(50, d * 0.4) / (d || 1);
        tx = p.x + (t.x - p.x) * k; ty = p.y - 40 + (t.y - p.y) * k;
      } else if (w.idle > 1.5) { tx = p.x + 26 * back; ty = p.y + 2; }
      const f = 1 - Math.pow(0.05, dt), ox = w.x;
      w.x += (tx - w.x) * f;
      w.y += (ty + (w.idle > 1.5 ? 0 : Math.sin(G.t * 3) * 6) - w.y) * f;
      if (!t && w.idle > 1.5) w.face = -back; // landed: looking the way you do
      else if (!t && w.castT <= 0 && Math.abs(w.x - ox) > 20 * dt) w.face = w.x > ox ? 1 : -1;
    } else { G.wisp = null; G.wispTarget = null; }

    // Embers that drift off a kit from its second milestone on.
    const tier = K.tier();
    if (tier >= 2 && Math.random() < dt * (3 + tier * 3)) {
      G.effects.push({ type: "spark", x: p.x + rand(-12, 12), y: p.y - rand(10, 60), vx: rand(-10, 10), vy: rand(-50, -25), t: 0, max: rand(0.6, 1.1), col: kit.color, size: rand(1.5, 2.5) });
    }
  };

  // Extra lights from the kit: walls, fire trails, Ice Bombs, the Ice Owl.
  K.lights = function (L) {
    const p = G.player, D = G.diff();
    for (const w of G.walls) {
      const f = Math.min(1, w.t / 1.2);
      for (const u of [0.15, 0.5, 0.85]) {
        L.push({ x: w.x1 + (w.x2 - w.x1) * u, y: w.y1 + (w.y2 - w.y1) * u - 14, r: 80 * f * D.light, s: f, col: "255,120,40", a: f, flick: 1, kind: "human" });
      }
    }
    crystals.forEach((c, i) => { if (i % 3 === 0 && c.at <= 0 && c.t < c.max - 0.2) L.push({ x: c.x, y: c.y - 20, r: 60 * D.light, s: 0.4, col: "90,230,150", a: 0.5 }); });
    for (const b of bombs) L.push({ x: b.x, y: b.y, r: 50 * D.light, s: 0.35, col: "150,215,255", a: 0.7 });
    for (const w of [G.wisp, ...G.allies.map((a) => a.wisp)]) if (w) L.push({ x: w.x, y: w.y, r: 40, s: 0.4, col: "150,215,255", a: 0.9 });
  };
})(window.DL);
