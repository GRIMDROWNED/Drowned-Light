/* Drowned Light — the Ashen Sovereign's minions in the Molten Mines (Level 3 step 3; Robert 2026-11-09: they are the
   only small foes, and they also guard the corridors and side rooms).

   They are Drowned in body (DL.ENEMIES wretch, ashguard, halberdier, acolyte: walk, wind up, strike), each with its
   own extras here (numbers in DL.MINE_FOES):
     Molten Wretch     packs, fast zigzag lunges; drips small burning puddles as it runs; eats a fallen minion to heal
     Ash Guard         slow, heavy; its shield takes most of a blow from the front (get behind it); the slam throws a
                       ring of fire globs
     Ember Halberdier  a long, telegraphed sweep and a lunge; from further off it winds up and throws a 3-way crescent
     Cinder Acolyte    keeps away; lights a fire circle under you (a ring, then flame) and wards another minion
                       (half damage while the ember ring burns round it). Kill it first.
   Guard posts: each group waits at its post and comes out of the stone when a knight comes near (once a run). A group
   whose post is a side room (`seal`) shuts that room behind the knight until it's broken (src/mines.js). */
"use strict";
(function (DL) {
  const G = DL.Game, TAU = Math.PI * 2, { rand, dist } = DL;
  const F = (DL.MineFoes = {});
  const N = () => DL.MINE_FOES;
  const OX = () => DL.MINES.x, OY = () => DL.MINES.y;
  const sfx = (n) => DL.Sound && DL.Sound.play(n);

  // [room, x, y, types...] in local px; a room listed in SEAL shuts while its group lives
  const POSTS = [
    ["run", 0, 1090, "wretch", "wretch", "wretch"],
    ["mine", -960, 620, "wretch", "wretch", "wretch", "wretch"],
    ["gallery", 960, 700, "halberdier"],
    ["ncw", -460, -100, "ashguard"], ["ncw", -460, -290, "acolyte"],
    ["nce", 460, -260, "halberdier"], ["nce", 460, -60, "wretch", "wretch"],
    ["store", -980, 1150, "ashguard", "acolyte", "wretch", "wretch", "wretch"],
    ["vault", -1260, -900, "halberdier", "halberdier", "acolyte"],
  ];
  F.SEAL = ["store", "vault"]; // their guards are held in the room with you (src/mines.js)
  const WAKE = 650; // a post's group comes out when a knight is this near

  let puddles = [];
  F.reset = function () { puddles = []; };
  // the run's foes still standing for a room
  F.left = (room) => G.enemies.filter((e) => e.room === room && e.def.mine && !e.removed).length;

  /* ---------------- every frame (from DL.Mines.update) ---------------- */
  F.update = function (dt) {
    const sp = G.spires, p = G.player;
    if (!sp || !p) return;
    const ox = OX(), oy = OY(), n = N();
    sp.posts = sp.posts || {};
    POSTS.forEach((q, i) => {
      if (sp.posts[i] || Math.hypot(p.x - ox - q[1], p.y - oy - q[2]) > WAKE) return;
      if (F.SEAL.includes(q[0]) && DL.Mines.pieceAt(p.x, p.y, 30) !== q[0]) return; // a side room's guards rise once you're in it
      sp.posts[i] = true;
      q.slice(3).forEach((type, k) => {
        const a = (k / Math.max(1, q.length - 3)) * TAU, r = q.length > 4 ? 40 : 0;
        const x = ox + q[1] + Math.cos(a) * r, y = oy + q[2] + Math.sin(a) * r * 0.7;
        G.enemies.push(G.makeEnemy(type, x, y, n.zone, { room: q[0], mine: true, cd: rand(0.6, 1.4) }));
        for (let j = 0; j < 8; j++) G.puff(x + rand(-12, 12), y - rand(0, 30), "rgba(255,140,50,0.7)", 60, 0.6, -30);
      });
    });
    // burning puddles
    for (const u of puddles) {
      u.t += dt;
      if (Math.hypot(p.x - u.x, (p.y - u.y) * 1.6) < u.r) G.hurtPlayer(n.wretch.dmg, -Math.PI / 2, "a molten puddle");
    }
    puddles = puddles.filter((u) => u.t < n.wretch.burns);
    for (const e of G.enemies) {
      if (!e.def.mine || e.removed) continue;
      if (e.wardT > 0) e.wardT -= dt;
      const k = e.def.mine;
      if (k === "wretch" && e.moving) {
        e.dripT = (e.dripT == null ? rand(0, n.wretch.drip) : e.dripT) - dt;
        if (e.dripT <= 0 && puddles.length < 40) { e.dripT = n.wretch.drip; puddles.push({ x: e.x, y: e.y, r: n.wretch.puddle, t: 0 }); }
      } else if (k === "acolyte") {
        e.wardCd = (e.wardCd == null ? 1.5 : e.wardCd) - dt;
        if (e.wardCd <= 0) {
          e.wardCd = n.acolyte.wardEvery;
          let best = null, bd = n.acolyte.wardR;
          for (const o of G.enemies) {
            if (o === e || o.removed || !o.def.mine || o.def.mine === "acolyte") continue;
            const d = dist(o.x, o.y, e.x, e.y);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) {
            best.wardT = n.acolyte.wardFor;
            G.text(best.x, best.y - 70, "Warded", "#ffb070", 0.9);
            sfx("chime");
            for (let j = 0; j < 8; j++) G.spark(best.x + rand(-16, 16), best.y - rand(0, 50), "255,170,80", 80);
          }
        }
      }
    }
  };

  // its own move, in place of the Drowned's walk (game.js); true while it's busy
  F.busy = function (e, dt, p, dp) {
    if (e.def.mine !== "halberd") return false;
    const n = N().halberd;
    if (e.throwT > 0) { // winding up the throw: it stands and flares
      e.throwT -= dt;
      e.state = "move"; e.moving = false;
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.flash = Math.max(e.flash, 0.05);
      if (e.throwT <= 0) {
        DL.Bullets.fan(e.x, e.y - 24, e.angle, 3, n.spread, { speed: n.speed, kind: 5, dmg: n.dmg, by: e.def.name, r: 9 });
        sfx("flameHit");
        e.cd = 0.8;
      }
      return true;
    }
    e.throwCd = (e.throwCd == null ? 2 : e.throwCd) - dt;
    if (e.throwCd <= 0 && e.state === "move" && dp > n.near && dp < n.far) {
      e.throwCd = n.throwEvery; e.throwT = n.throwWind;
      G.text(e.x, e.y - 90, "!", "#ffb070", 1.1);
      return true;
    }
    return false;
  };

  // its blow (strike in game.js): true when that's all it does
  F.strike = function (e) {
    const n = N(), p = e.tgt || G.player;
    if (e.def.mine === "acolyte") {
      if (p.def) return false; // fighting a turned Drowned: an ordinary blow
      G.telegraphs.push({ by: e.def.name, x: p.x, y: p.y, r: n.acolyte.circle, t: 0, delay: n.acolyte.fuse, dmg: e.dmg, rose: false, fire: true });
      sfx("whisper");
      return true;
    }
    if (e.def.mine === "guard") {
      DL.Bullets.ring(e.x, e.y - 10, n.guard.ring, rand(0, TAU), { speed: n.guard.speed, kind: 4, dmg: n.guard.dmg, by: e.def.name, life: n.guard.life });
      G.camera.shake = Math.max(G.camera.shake || 0, 4);
    }
    return false;
  };

  // what a blow does to it: half while an Acolyte wards it
  F.soak = (e, d) => (e.wardT > 0 ? d * 0.5 : d);

  // a minion fell: Wretches near it feed on it
  F.slain = function (e) {
    const n = N().wretch;
    for (const w of G.enemies) {
      if (w === e || w.removed || w.def.mine !== "wretch" || dist(w.x, w.y, e.x, e.y) > n.feastR) continue;
      const h = Math.round(w.maxHp * n.feast);
      w.hp = Math.min(w.maxHp, w.hp + h);
      G.text(w.x, w.y - 50, "+" + h, "#ffb070", 0.9);
      for (let j = 0; j < 5; j++) G.puff(e.x + rand(-10, 10), e.y - rand(0, 16), "rgba(255,120,40,0.7)", 50, 0.6, -20);
    }
  };

  /* ---------------- drawing ---------------- */
  const vis = (view, x, y, m) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m;
  // on the floor: the Wretches' puddles
  F.drawFloor = function (c, view, t) {
    const life = N().wretch.burns;
    for (const u of puddles) {
      if (!vis(view, u.x, u.y, 40)) continue;
      const a = Math.min(1, (life - u.t) / 0.6);
      c.fillStyle = `rgba(60,20,8,${0.6 * a})`; c.beginPath(); c.ellipse(u.x, u.y, u.r, u.r * 0.55, 0, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,${110 + 40 * Math.sin(t * 6 + u.x)},30,${0.75 * a})`; c.beginPath(); c.ellipse(u.x, u.y, u.r * 0.7, u.r * 0.38, 0, 0, TAU); c.fill();
    }
  };
  // above the darkness: the ward's ember ring, and the Acolytes' fire circles before they flare
  F.drawGlow = function (c, t, view) {
    for (const e of G.enemies) {
      if (!(e.wardT > 0) || e.removed || !vis(view, e.x, e.y, 60)) continue;
      c.strokeStyle = `rgba(255,170,80,${0.5 + 0.3 * Math.sin(t * 8)})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(e.x, e.y - 2, 26, 11, 0, 0, TAU); c.stroke();
    }
    for (const tg of G.telegraphs) {
      if (!tg.fire || !vis(view, tg.x, tg.y, 80)) continue;
      const k = Math.min(1, tg.t / tg.delay);
      c.strokeStyle = `rgba(255,${150 - 60 * k},40,${0.4 + 0.5 * k})`; c.lineWidth = 2 + 3 * k;
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r, tg.r * 0.5, 0, 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,120,30,${0.15 + 0.3 * k})`;
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r * k, tg.r * 0.5 * k, 0, 0, TAU); c.fill();
    }
  };
})(window.DL);
