/* Drowned Light — the Bone Hound, a summoned ally bought at the camp fire (Kit tab).
   One per knight. The host's device runs every hound, the guests' ones too, and sends them
   to each guest in its snapshots; a guest's purchase is an event the host pays for from the
   shared stash. Balance numbers are in DL.HOUND (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand } = DL;
  const G = DL.Game, H = DL.HOUND;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const BITE = 0.3, BITE_AT = 0.12, BACK = 0.3; // bite length, when its teeth land, then the hop clear
  const Hounds = (DL.Hounds = {});
  G.hounds = [];

  // Health and bite grow with the Central Flame.
  Hounds.stats = function () {
    const m = 1 + H.perFlame * Math.max(0, G.save.up.flame - H.reqFlame);
    return { maxHp: Math.round(H.hp * m), dmg: Math.round(H.dmg * m * 10) / 10 };
  };
  Hounds.lock = () => (G.save.up.flame < H.reqFlame ? `Needs Central Flame ${H.reqFlame}` : null);
  // Whose knight a hound follows: the host is 0, friends by their co-op number.
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Hounds.mine = () => G.hounds.find((h) => h.owner === myId() && !h.gone) || null;
  function ownerOf(h) {
    if (h.owner === 0) return G.player;
    return G.allies.find((a) => a.id === h.owner) || null;
  }

  function spawn(owner, x, y) {
    const st = Hounds.stats();
    const h = { id: ++G.eid, hound: true, owner, x, y, kx: 0, ky: 0, hp: st.maxHp, maxHp: st.maxHp, angle: Math.PI / 2, moving: false,
      animT: 0, state: "move", stT: 0, cd: 0.5, lungeCd: 0, scanT: 0, tgt: null, flash: 0, inv: 0, hurtT: 0 };
    G.hounds.push(h);
    for (let i = 0; i < 14; i++) G.puff(x + rand(-12, 12), y - rand(0, 20), "rgba(200,190,160,0.6)", 50, 0.8, -20);
    for (let i = 0; i < 8; i++) G.spark(x, y - 16, "220,50,30", 70);
    return h;
  }
  // A new life (or a reload) brings your hound back to your side at the camp.
  Hounds.reset = function () {
    G.hounds = [];
    if (!G.isGuest() && G.save.hound && G.player) spawn(0, G.player.x - 26, G.player.y + 8);
  };

  /* ---------------- buying ---------------- */
  Hounds.buy = function () {
    if (G.isGuest()) {
      if (Hounds.mine() || Hounds.lock()) { sfx("deny"); return false; }
      DL.Net.event({ t: "hound" }); // the host pays from the shared stash and raises it beside you
      return true;
    }
    return Hounds.grant(0);
  };
  // Host: raise a hound for a knight, if they don't have one and the stash can pay.
  Hounds.grant = function (owner) {
    const k = owner === 0 ? G.player : G.allies.find((a) => a.id === owner);
    if (!k || G.hounds.some((h) => h.owner === owner && !h.gone) || Hounds.lock() || !G.canAfford(H.cost)) { if (owner === 0) sfx("deny"); return false; }
    G.pay(H.cost);
    spawn(owner, k.x - 26, k.y + 8);
    if (owner === 0) {
      G.save.hound = 1;
      sfx("growl");
      say("A Bone Hound claws its way up out of the mud. It hunts at your side.", "good");
    }
    G.persist();
    return true;
  };

  /* ---------------- the hunt (host only) ---------------- */
  const valid = (e) => e && !e.removed && e.rise <= 0 && !e.dormant;
  // Who it hunts first: 0 = retreats (strikes and falls back, or has been backing away), 1 = shoots, 2 = the rest.
  const tier = (e) => (e.def.retreat || e.backT > 0 ? 0 : e.def.ranged || e.def.caster ? 1 : 2);
  function pick(h, o) {
    let best = null, bs = 1e9;
    for (const e of G.enemies) {
      if (!valid(e)) continue;
      const t = tier(e);
      if (dist(o.x, o.y, e.x, e.y) > (t < 2 ? H.chase : H.sight)) continue;
      // a better tier always wins; within a tier the nearest, keeping its current prey unless another is clearly closer
      const s = t * 10000 + dist(h.x, h.y, e.x, e.y) - (e === h.tgt ? 40 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  /* Through the palisade: pick the gate that makes the shortest way, line up with it on this side, then
     run straight through along the gate's line until past the wall, so it never scrapes along the stakes.
     Outside, it runs around the wall rather than into it. */
  function gateWay(h, tx, ty) {
    if (!DL.Camp.walled(G.save.up)) return null;
    const C = DL.Camp, R = DL.WALL_R, inside = C.inside(h.x, h.y);
    // the way round the outside keeps well off the corners, so a straight leg never clips one;
    // right by the wall, step straight out first
    const around = (a, turn) => C.onSquare(C.sq(h.x, h.y) < R + 25 ? a : a + turn, R + 90);
    if (inside === C.inside(tx, ty)) {
      if (inside) return null;
      // both outside: if the straight line cuts through the camp, go around the wall toward the target
      const dx = tx - h.x, dy = ty - h.y;
      let cuts = false;
      for (let k = 1; k < 16 && !cuts; k++) cuts = C.sq(h.x + (dx * k) / 16, h.y + (dy * k) / 16) < R + 4;
      if (!cuts) return null;
      const a = Math.atan2(h.y, h.x);
      return around(a, DL.angleDiff(a, Math.atan2(ty, tx)) > 0 ? 0.45 : -0.45);
    }
    let g = null, best = 1e9;
    for (const ga of C.GATES) {
      const gp = C.gatePoint(ga, 0, 0), d = Math.hypot(gp.x - h.x, gp.y - h.y) + Math.hypot(tx - gp.x, ty - gp.y);
      if (d < best) { best = d; g = ga; }
    }
    // how far off the gate's line it stands, measured along the wall
    const arc = Math.round(Math.cos(g)) ? Math.abs(h.y) : Math.abs(h.x);
    // still round the side from that gate (outside): go around first
    if (!inside && arc > 8) {
      const a = Math.atan2(h.y, h.x), da = DL.angleDiff(a, g);
      if (Math.abs(da) > 0.5) return around(a, Math.sign(da) * 0.45);
    }
    // line up with the gate on this side, then run straight through until past the wall
    return C.gatePoint(g, 0, arc > 8 ? (inside ? -34 : 34) : (inside ? 40 : -40));
  }
  Hounds.gateWay = gateWay; // Derek walks the same way (src/golem.js)

  function bite(h, e, st) {
    const ang = Math.atan2(e.y - h.y, e.x - h.x);
    G.effects.push({ type: "slash", x: e.x, y: e.y - 18 * e.def.scale, ang, arc: 1.7, r: 16 + 4 * e.def.scale, t: 0, max: 0.2, col: "225,45,30", w: 4 });
    for (let i = 0; i < 4; i++) G.spark(e.x, e.y - 20 * e.def.scale, "200,30,20", 70);
    sfx("bite");
    // the bleed: each bite adds a stack (up to bleedMax) and starts the clock again
    e.bleedN = Math.min(H.bleedMax, (e.bleed > 0 ? e.bleedN || 0 : 0) + 1);
    e.bleed = H.bleedDur;
    G.hitEnemy(e, st.dmg, ang, 70);
  }

  function step(h, dt, st) {
    const o = ownerOf(h);
    if (!o) { h.gone = true; return; }
    h.animT += dt;
    h.maxHp = st.maxHp;
    h.flash = Math.max(0, h.flash - dt);
    h.inv = Math.max(0, h.inv - dt);
    h.hurtT = Math.max(0, h.hurtT - dt);
    h.cd -= dt; h.lungeCd -= dt; h.scanT -= dt;
    // firelight knits its bones back together; out of a fight it mends slowly anywhere
    const heal = G.protectionAt(h.x, h.y) === "human" ? H.regen : h.tgt ? 0 : 1;
    h.hp = Math.min(h.maxHp, h.hp + heal * dt);

    // left far behind (a fall, a long dash home): it bounds back to its knight
    if (dist(h.x, h.y, o.x, o.y) > 900) {
      Object.assign(h, { x: o.x - 26, y: o.y + 8, tgt: null, state: "move" });
      for (let i = 0; i < 8; i++) G.puff(h.x, h.y - 10, "rgba(200,190,160,0.6)", 40, 0.6);
    }
    if (h.tgt && (!valid(h.tgt) || dist(o.x, o.y, h.tgt.x, h.tgt.y) > H.leash)) h.tgt = null;
    if (h.scanT <= 0 && h.state === "move") { h.scanT = 0.35; h.tgt = pick(h, o); }
    const e = h.tgt;

    let mx = 0, my = 0, spd = 0;
    if (h.state === "bite") {
      h.stT -= dt;
      if (!h.bitten && h.stT <= BITE - BITE_AT) {
        h.bitten = true;
        if (e && valid(e) && dist(h.x, h.y, e.x, e.y) < H.range + e.def.radius + 12) bite(h, e, st);
      }
      // hop clear, unless its prey is running: then it keeps on its heels
      if (h.stT <= 0) { h.state = e && valid(e) && tier(e) === 0 ? "move" : "back"; h.stT = BACK; }
    } else if (h.state === "back") {
      // hop clear after the bite, then go again
      h.stT -= dt;
      if (e) { mx = h.x - e.x; my = h.y - e.y; spd = H.speed * 0.8; }
      if (h.stT <= 0) h.state = "move";
    } else if (e) {
      const d = dist(h.x, h.y, e.x, e.y), reach = H.range + e.def.radius;
      mx = e.x - h.x; my = e.y - h.y;
      if (d > reach * 0.8) spd = H.speed;
      if (d <= reach && h.cd <= 0) {
        h.state = "bite"; h.stT = BITE; h.bitten = false; h.cd = H.cd;
        h.angle = Math.atan2(my, mx);
        spd = 0;
      } else if (d > reach + 30 && d < reach + 130 && h.lungeCd <= 0) {
        // a leap that runs down a fleeing archer
        h.kx += (mx / d) * H.lunge; h.ky += (my / d) * H.lunge;
        h.lungeCd = 2.5;
        for (let i = 0; i < 4; i++) G.puff(h.x, h.y - 6, "rgba(200,190,160,0.5)", 50, 0.4);
      }
    } else {
      // heel: trot to a spot just behind its knight
      const fx = o.x - Math.cos(o.angle || 0) * 30, fy = o.y - Math.sin(o.angle || 0) * 20 + 6, d = dist(h.x, h.y, fx, fy);
      if (d > 14) { mx = fx - h.x; my = fy - h.y; spd = d > 160 ? H.speed * 1.15 : Math.min(H.speed, d * 3); }
    }
    const md = Math.hypot(mx, my);
    h.moving = spd > 0 && md > 0.5;
    if (h.moving) {
      const wet = DL.World.isWater(h.x, h.y) ? 0.85 : 1;
      const wp = h.state === "back" ? null : gateWay(h, h.x + mx, h.y + my);
      if (wp) { mx = wp.x - h.x; my = wp.y - h.y; }
      const m2 = Math.hypot(mx, my) || 1;
      h.x += (mx / m2) * spd * wet * dt;
      h.y += (my / m2) * spd * wet * dt;
      if (h.state === "move") h.angle = Math.atan2(my, mx);
    } else if (e && h.state === "move") h.angle = Math.atan2(e.y - h.y, e.x - h.x);
    h.x += h.kx * dt; h.y += h.ky * dt;
    const decay = Math.pow(0.004, dt);
    h.kx *= decay; h.ky *= decay;
    DL.World.collide(h, 7);
    G.collideCamp(h, 7);
  }

  Hounds.update = function (dt) {
    const st = Hounds.stats();
    for (const h of G.hounds) step(h, dt, st);
    G.hounds = G.hounds.filter((h) => !h.gone);
  };

  // Host: a Drowned blow, arrow or spike lands on a hound.
  Hounds.hurt = function (h, dmg, ang) {
    if (G.isGuest() || h.gone || h.inv > 0) return;
    h.hp -= dmg;
    h.inv = 0.25; h.flash = 0.15; h.hurtT = 0.2;
    h.kx += Math.cos(ang) * 120; h.ky += Math.sin(ang) * 120;
    G.text(h.x, h.y - 66, "-" + Math.round(dmg), "#ff8a7a", 0.9);
    if (h.hp <= 0) fall(h);
  };

  function fall(h) {
    h.gone = true;
    Hounds.fallFx(h);
    if (h.owner === 0) {
      G.save.hound = 0;
      G.persist();
      say("Your Bone Hound falls apart. Raise another at the camp fire.", "warn");
    } else DL.Net.houndLost(h.owner);
  }
  Hounds.fallFx = function (h) {
    G.effects.push({ type: "houndFall", x: h.x, y: h.y, angle: h.angle, t: 0, max: 1.6 });
    for (let i = 0; i < 12; i++) G.puff(h.x + rand(-10, 10), h.y - rand(0, 24), "rgba(200,190,160,0.6)", 50, 0.9, -20);
    sfx("shatter");
  };

  // The Drowned can go for a hound as well as a knight (it counts as a little farther away).
  Hounds.nearest = function (x, y, bd) {
    let best = null;
    for (const h of G.hounds) {
      if (h.gone) continue;
      const d = dist(x, y, h.x, h.y) * 1.2;
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };
})(window.DL);
