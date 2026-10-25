/* Drowned Light — the Deadly Rose, a thorned queen who holds a garden of blood-red roses deep in the Abyss.
   A tall pale woman in a gown of torn red petals, a crown of thorns, a great rose blooming at her heart, and arms
   that run on into long thorn whips. Unlike the Starved Bell she doesn't roam: her garden stands in one place
   (the same in every world of a difficulty), so she can be found and fought on purpose. Red petals drift on the
   wind for a long way round it (blowing from the garden, so you walk into them to find it), a crimson glow
   marks it, the field guide tells you which way it lies, and Kindle can lead you there.
   She stands asleep among her roses until a knight comes near, and never strays far from them. Her moves (the
   concept sheet's):
     lash   a thorn whip cracked across a long arc in front of her (her ordinary blow);
     waltz  she spins, her whips whirling round her in a ring of thorns that cuts and hurls back all near;
     briar  thorned vines and roses burst up from the ground in a line toward every knight and under them,
            and stand a few seconds, stinging whoever walks into them.
   Below half her health her heart-rose opens: she moves and acts faster, and the briar rings her as well.
   Slain, she stays gone a few days. The host runs her; her vines and whirl ride the snapshots (src/net.js).
   Numbers: DL.ENEMIES.rose and DL.ROSE (src/data.js). The coded stand-in sheet is at the bottom (a fallback for her drawn frames, set up in src/sprites.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, K = DL.ROSE;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Rose = (DL.Rose = { e: null });
  const NAME = "The Deadly Rose";
  const KINDS = ["waltz", "briar"];
  const RED = "220,40,60";
  let vines = [], hinted = false, found = false;
  const now = () => performance.now() / 1000;
  const age = (o) => o.t + (o.at ? now() - o.at : 0);

  const state = () => G.save.rose;
  Rose.alive = () => state().dead < 0;
  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];

  /* ---------------- where her garden lies ---------------- */
  // On dry land in the Abyss, clear of the bloom groves and well away from the old graves.
  let spot = null, spotFor = null;
  Rose.lair = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE, gs = DL.Abigail.graveSpot();
    const dry = (x, y) => !W.isWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !W.isWater(x + Math.cos(i * 0.785) * 170, y + Math.sin(i * 0.785) * 110));
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 700) / GR.cell); gy <= Math.floor((y + 700) / GR.cell); gy++)
        for (let gx = Math.floor((x - 700) / GR.cell); gx <= Math.floor((x + 700) / GR.cell); gx++) {
          const g = W.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 560) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 96 && !spot; t++) {
      const a = DL.hash(61, 37, 900 + t) * TAU, r = K.dist + (DL.hash(61, 37, 1000 + t) - 0.5) * 300;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y) && Math.hypot(x - gs.x, y - gs.y) > 1500) spot = { x, y };
    }
    spot = spot || { x: -gs.x * 0.9, y: -gs.y * 0.9 };
    spotFor = G.save.difficulty;
    bushes = null;
    return spot;
  };
  // The ring of rose bushes round the garden: drawn, not solid.
  let bushes = null;
  Rose.bushes = function () {
    if (bushes) return bushes;
    const s = Rose.lair();
    bushes = [];
    for (let i = 0; i < K.bushes; i++) {
      const a = (i / K.bushes) * TAU + (DL.hash(61, i, 7) - 0.5) * 0.35, r = K.clear * (0.68 + DL.hash(61, i, 8) * 0.22);
      if (Math.sin(a) > 0.82) continue; // a way in from the south
      bushes.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * 0.75, v: i % 3, ph: DL.hash(61, i, 9) * TAU });
    }
    return bushes;
  };
  // Asleep in her bud: alive, and nobody has woken her (she isn't in play, or lies dormant). Only with the drawn bud;
  // without it she stands asleep as herself (src/render.js).
  Rose.asleep = () => !!DL.Art.sprites.roseBud && Rose.alive() && !G.cave && !G.enemies.some((e) => e.def.rose && !e.dormant);
  Rose.clears = (x, y) => { const s = Rose.lair(); return Math.hypot(x - s.x, y - s.y) < K.clear; };
  Rose.where = function () { const s = Rose.lair(); return { dir: compass(s.x, s.y), m: Math.round(Math.hypot(s.x, s.y) / 10) }; };
  Rose.found = () => found || !!state().found;
  Rose.guideLine = function () {
    const w = Rose.where();
    if (!Rose.alive()) return `<b>${NAME}</b> lies withered in her garden, ${w.m} m ${w.dir} of camp. She will bloom again.`;
    return `<b>${NAME}</b> keeps a garden of red roses deep in the Abyss, ${w.m} m ${w.dir} of camp. Follow the drifting petals upwind; she lashes, whirls, and raises thorns under you.`;
  };
  // The compass to her garden, once found, while she lives.
  Rose.showNav = () => !G.cave && Rose.found() && Rose.alive();

  const nearest = (x, y) => Math.min(1e9, ...G.knights().map((k) => dist(k.x, k.y, x, y)));

  /* ---------------- every device: finding the garden ---------------- */
  Rose.local = function () {
    const p = G.player;
    if (!p || G.cave || G.state !== "play") return;
    const s = Rose.lair(), d = dist(p.x, p.y, s.x, s.y);
    if (!hinted && d < K.hintR && d > K.foundR && Rose.alive()) {
      hinted = true;
      say(`Red petals drift past on the black wind, blowing from the ${compass(s.x - p.x, s.y - p.y)}.`, "warn");
    }
    if (!found && d < K.foundR) {
      found = true;
      if (!G.isGuest() && !state().found) { state().found = true; G.persist(); }
      if (Rose.alive()) say(DL.Art.sprites.roseBud ? "A garden of blood-red roses round a great closed bud. Something sleeps inside it. Step closer and it wakes."
        : "A garden of blood-red roses, and among them a queen of thorns, head bowed. Step closer and she wakes.", "danger");
    }
  };

  /* ---------------- host ---------------- */
  Rose.update = function (dt) {
    if (G.isGuest() || G.cave) return;
    for (const v of vines) v.t += dt;
    vines = vines.filter((v) => v.t < v.life);
    sting(dt);
    let e = Rose.e;
    if (e && (e.removed || !G.enemies.includes(e))) Rose.e = e = null;
    if (!Rose.alive()) return;
    const s = Rose.lair();
    if (!e) {
      if (nearest(s.x, s.y) > K.spawn) return;
      e = Rose.e = G.makeEnemy("rose", s.x, s.y - 20, 4, { dormant: true, angle: Math.PI / 2 });
      G.enemies.push(e);
      return;
    }
    if (e.lashT > 0) e.lashT -= dt;
    if (nearest(e.x, e.y) > K.forget) {
      // everyone left: she goes back to her roses, whole again
      e.removed = true;
      G.enemies = G.enemies.filter((q) => q !== e);
      Rose.e = null;
      vines = [];
      return;
    }
    // she never leaves her garden far behind
    const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy);
    if (d > K.leash) { e.x = s.x + (dx / d) * K.leash; e.y = s.y + (dy / d) * K.leash; }
  };

  function hurt(k, dmg, ang, kb) {
    if (k.hound) return DL.Hounds.hurt(k, dmg, ang);
    if (k !== G.player) return DL.Net.hurtAlly(k, dmg, ang);
    const was = k.hp;
    G.hurtPlayer(dmg, ang);
    if (k.hp < was && kb && !DL.Kits.steady(k)) { k.kx += Math.cos(ang) * kb; k.ky += Math.sin(ang) * kb; }
  }
  const targets = () => [...G.knights(), ...G.hounds.filter((h) => !(h.down > 0))];

  // A knight standing in her thorns is stung every half second.
  let stingT = 0;
  function sting(dt) {
    stingT -= dt;
    if (stingT > 0 || !vines.length) return;
    stingT = 0.5;
    for (const k of targets()) {
      if (k === G.player && (G.state !== "play" || k.downT > 0)) continue;
      const v = vines.find((q) => q.t > 0.3 && q.t < q.life - 0.4 && Math.hypot(k.x - q.x, (k.y - q.y) / 0.6) < K.briar.r);
      if (v) hurt(k, v.dmg, Math.atan2(k.y - v.y, k.x - v.x), 0);
    }
  }

  // Her mind, every frame she's awake (from the Drowned's behaviour in src/game.js).
  Rose.think = function (e, dt, p, dp) {
    if (!e.awake) {
      e.awake = true;
      for (const k of KINDS) e[k + "T"] = K[k].first;
      G.camera.shake = 8;
      sfx("growl");
      for (let i = 0; i < 26; i++) G.puff(e.x + rand(-60, 60), e.y - rand(0, 140), `rgba(${RED},0.6)`, 60, 1.2, 20);
      const msg = DL.Art.sprites.roseBud ? "The great bud tears open. " + NAME + " steps out, her thorns uncoiling." : NAME + " lifts her head. Her thorns uncoil.";
      say(msg, "danger");
      DL.Net.say(msg, "danger");
    }
    if (e.stun > 0.25) e.stun = 0.25; // a queen doesn't stagger for long
    if (!e.phase2 && e.hp < e.maxHp * K.phase2) {
      e.phase2 = true;
      e.speed *= K.fast;
      e.briarT = Math.min(e.briarT, 1);
      G.camera.shake = 10;
      sfx("growl");
      for (let i = 0; i < 20; i++) G.puff(e.x + rand(-14, 14), e.y - 120 + rand(-10, 10), `rgba(${RED},0.8)`, 110, 1);
      const msg = "The rose at her heart tears open. " + NAME + " quickens!";
      say(msg, "danger");
      DL.Net.say(msg, "danger");
    }
    if (Math.random() < dt * 3) G.puff(e.x + rand(-30, 30), e.y - rand(30, 150), `rgba(${RED},0.5)`, 30, 1.4, 25); // petals falling off her
    const rate = e.phase2 ? K.rate : 1;
    for (const k of KINDS) e[k + "T"] -= dt * rate;
    if (e.state !== "move" || e.stun > 0 || e.spin || e.cd > 1.2) return;
    let best = null;
    if (e.waltzT <= 0 && dp < K.waltz.r + 30) best = "waltz";
    else if (e.briarT <= 0 && dp < K.briar.reach) best = "briar";
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
    if (kind === "waltz") {
      G.telegraphs.push({ x: e.x, y: e.y, r: k.r, t: 0, delay: k.windup, dmg: 0, rose: true });
      sfx("whisper");
      return;
    }
    // the briar: a line of thorns toward every knight in reach, and one right under them
    sfx("rise");
    const spots = [];
    for (const q of G.knights()) {
      const d = dist(e.x, e.y, q.x, q.y);
      if (d > K.briar.reach + 60) continue;
      const a = Math.atan2(q.y - e.y, q.x - e.x);
      for (let i = 1; i <= k.n; i++) {
        const u = Math.min(d, i * k.step);
        spots.push({ x: e.x + Math.cos(a) * u, y: e.y + Math.sin(a) * u, i });
      }
      spots.push({ x: q.x, y: q.y, i: k.n + 1 });
    }
    if (e.phase2) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; spots.push({ x: e.x + Math.cos(a) * 110, y: e.y + Math.sin(a) * 75, i: 2 }); }
    for (const s of spots) {
      const delay = k.windup + k.delay + s.i * 0.08;
      G.telegraphs.push({ x: s.x, y: s.y, r: k.r, t: 0, delay, dmg: e.dmg * k.dmg, rose: true });
      vines.push({ x: s.x, y: s.y, t: -delay, life: k.life, dmg: e.dmg * k.sting, v: (Math.random() * 3) | 0 });
    }
    while (vines.length > K.maxVines) vines.shift();
  }

  // Her blow lands (from the enemy update's strike): the lash, or the move she wound up.
  Rose.strike = function (e) {
    const kind = e.special;
    e.special = null;
    if (kind === "waltz") {
      e.spin = { t: K.waltz.spin, tick: 0, hits: 0 };
      sfx("dash");
      return;
    }
    if (kind === "briar") {
      G.camera.shake = Math.max(G.camera.shake, 6);
      sfx("shatter");
      return;
    }
    // the lash: a long thorn whip cracked across her front
    const def = e.def, R = def.range + 20;
    e.lashT = K.lashShow; // Robert's drawn whip trail plays over it (Rose.push)
    if (!DL.Art.sprites.roseLash2) G.effects.push({ type: "slash", x: e.x, y: e.y - 40, ang: e.aim, arc: def.arc, r: R, t: 0, max: 0.22, col: RED, w: 5 });
    sfx("hit");
    for (const k of targets()) {
      const d = dist(e.x, e.y, k.x, k.y), a = Math.atan2(k.y - e.y, k.x - e.x);
      if (d < R + 8 && Math.abs(DL.angleDiff(e.aim, a)) < def.arc / 2 + 0.15) hurt(k, e.dmg, a, K.lashKb);
    }
    for (const w of G.stoneWalls) if (!w.dead && DL.Golems.distTo(w, e.x, e.y) < R) DL.Golems.hitWall(w);
  };

  /* Her whirl: she spins in place, edging toward her prey, her whips cutting all round her a few times.
     Returns true while she's spinning, so she neither walks nor strikes otherwise. */
  Rose.busy = function (e, dt, p) {
    const s = e.spin;
    if (!s) return false;
    const k = K.waltz;
    s.t -= dt;
    s.tick -= dt;
    e.state = "recover"; e.stT = 0.3; e.moving = true;
    e.angle = e.aim = (e.aim || 0) + dt * 14;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * k.drift * dt; e.y += (dy / d) * e.speed * k.drift * dt;
    if (s.tick <= 0 && s.hits < k.hits) {
      s.tick = k.spin / k.hits;
      s.hits++;
      G.effects.push({ type: "ring", x: e.x, y: e.y - 40, r0: 30, r1: k.r, t: 0, max: 0.3, col: RED, w: 5 });
      sfx("swing");
      for (const q of targets()) if (dist(e.x, e.y, q.x, q.y) < k.r + 6) hurt(q, e.dmg * k.dmg, Math.atan2(q.y - e.y, q.x - e.x), k.kb);
      for (const w of G.stoneWalls) if (!w.dead && DL.Golems.distTo(w, e.x, e.y) < k.r) DL.Golems.hitWall(w);
    }
    if (Math.random() < 0.7) { const a = rand(0, TAU); G.puff(e.x + Math.cos(a) * k.r * 0.8, e.y - 30 + Math.sin(a) * k.r * 0.4, `rgba(${RED},0.7)`, 90, 0.6); }
    if (s.t <= 0) { e.spin = null; e.state = "move"; e.cd = 1; e.moving = false; }
    return true;
  };

  Rose.slain = function (e) {
    const S = state();
    S.dead = G.save.day;
    Rose.e = null;
    vines = [];
    G.persist();
    for (let i = 0; i < 40; i++) G.puff(e.x + rand(-50, 50), e.y - rand(0, 160), `rgba(${RED},0.7)`, 90, 1.6, 30);
    const msg = NAME + " withers, and her petals fall still.";
    say(msg, "good");
    DL.Net.say(msg, "good");
  };
  Rose.dawn = function () {
    const S = state();
    if (S.dead >= 0 && G.save.day - S.dead >= K.respawnDays) { S.dead = -1; G.persist(); }
  };
  Rose.reset = function () { Rose.e = null; vines = []; };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Rose.snap = function () {
    const e = Rose.e && !Rose.e.removed ? Rose.e : null;
    if (!vines.length && !(e && (e.spin || e.special || e.lashT > 0))) return 0;
    return [vines.map((v) => [r1(v.x), r1(v.y), r1(v.t), v.life, v.v]), e ? [e.id, e.spin ? 1 : 0, KINDS.indexOf(e.special), Math.max(0, r1(e.lashT || 0))] : 0];
  };
  Rose.applySnap = function (s) {
    for (const e of G.enemies) if (e.def.rose) { e.spin = null; e.special = null; e.lashT = 0; }
    if (!s) { vines = []; return; }
    const at = now();
    vines = s[0].map((q) => ({ x: q[0], y: q[1], t: q[2], life: q[3], v: q[4], at }));
    const e = s[1] && G.enemies.find((q) => q.id === s[1][0]);
    if (e) { e.spin = s[1][1] ? { t: 1 } : null; e.special = KINDS[s[1][2]] || null; e.lashT = s[1][3] || 0; }
  };

  /* ---------------- drawing ---------------- */
  // The garden's ground: a dark stain of fallen petals; and her vines' roots.
  Rose.drawGround = function (c, view) {
    if (G.cave) return;
    const s = Rose.lair();
    if (s.x < view.left - 300 || s.x > view.right + 300 || s.y < view.top - 300 || s.y > view.bottom + 300) return;
    const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, K.clear);
    g.addColorStop(0, "rgba(70,8,16,0.55)"); g.addColorStop(0.7, "rgba(50,6,12,0.35)"); g.addColorStop(1, "rgba(40,4,10,0)");
    c.fillStyle = g;
    c.beginPath(); c.ellipse(s.x, s.y, K.clear, K.clear * 0.75, 0, 0, TAU); c.fill();
    for (let i = 0; i < 70; i++) {
      const a = DL.hash(62, i, 1) * TAU, r = Math.sqrt(DL.hash(62, i, 2)) * K.clear * 0.9;
      c.fillStyle = i % 3 ? "#5e0c18" : "#8a1424";
      c.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r * 0.75), 3, 2);
    }
    for (const v of vines) {
      const k = Math.min(1, Math.max(0, age(v) / 0.25));
      if (k <= 0) continue;
      c.fillStyle = "rgba(30,10,8,0.5)";
      c.beginPath(); c.ellipse(v.x, v.y, K.briar.r * k, K.briar.r * 0.5 * k, 0, 0, TAU); c.fill();
    }
  };
  // Into the y-sorted scene: the rose bushes, her vines (Robert's drawn briar once loaded, src/sprites.js), and the withered bloom while she's dead.
  Rose.push = function (list, c, t, view) {
    if (G.cave) return;
    const s = Rose.lair();
    if (s.x < view.left - 400 || s.x > view.right + 400 || s.y < view.top - 400 || s.y > view.bottom + 500) return;
    for (const b of Rose.bushes()) list.push({ y: b.y, f: () => drawBush(c, b, t) });
    if (!Rose.alive()) list.push({ y: s.y, f: () => drawSprite(c, "roseWither", s.x, s.y, 1) });
    else if (Rose.asleep()) list.push({ y: s.y, f: () => drawBud(c, s, t) });
    for (const e of G.enemies) if (e.def.rose && e.lashT > 0 && DL.Art.sprites.roseLash2) list.push({ y: e.y + 2, f: () => drawLash(c, e) });
    for (const e of G.enemies) if (e.def.rose && e.spin && DL.Art.sprites.roseWaltz1) list.push({ y: e.y + 3, f: () => drawWaltz(c, e, t) });
    for (const v of vines) {
      const T = age(v);
      if (T > 0) list.push({ y: v.y, f: () => drawVine(c, v, T) });
    }
  };
  function drawSprite(c, key, x, y, sc) {
    const sp = DL.Art.sprites[key] || sprites[key] || (sprites[key] = BUILD[key]()); // Robert's drawn piece if there is one
    const w = sp.w * 2 * sc, h = sp.h * 2 * sc;
    c.drawImage(sp.c, Math.round(x - w / 2), Math.round(y - h + 2), w, h);
  }
  // The giant bud she sleeps in (Robert's drawing), breathing slowly, with a glow seeping between its petals.
  function drawBud(c, s, t) {
    const sp = DL.Art.sprites.roseBud, w = sp.w * 2, h = sp.h * 2, k = 1 + Math.sin(t * 1.2) * 0.012;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath(); c.ellipse(s.x, s.y, w * 0.38, w * 0.1, 0, 0, TAU); c.fill();
    c.drawImage(sp.c, Math.round(s.x - (w * k) / 2), Math.round(s.y - h * k + 4), Math.round(w * k), Math.round(h * k));
  }
  function drawBush(c, b, t) {
    c.fillStyle = "rgba(0,0,0,0.3)";
    const sw = DL.Art.sprites["roseBush" + b.v] ? DL.Art.sprites["roseBush" + b.v].w * 0.75 : 22; // under Robert's drawn bushes, as wide as they are
    c.beginPath(); c.ellipse(b.x, b.y, sw, sw * 0.3, 0, 0, TAU); c.fill();
    c.save();
    c.translate(b.x, b.y);
    c.rotate(Math.sin(t * 0.8 + b.ph) * 0.03);
    drawSprite(c, "roseBush" + b.v, 0, 0, 1);
    c.restore();
  }
  // Her whip's trail (Robert's three frames: coiled, cracked out in a long arc, fading in petals), swung out from
  // her arm along her aim; turned over rather than upside down when she lashes to the left.
  function drawLash(c, e) {
    const k = 1 - e.lashT / K.lashShow, f = k < 0.3 ? 1 : k < 0.7 ? 2 : 3;
    const sp = DL.Art.sprites["roseLash" + f], w = sp.w * 2, h = sp.h * 2;
    let a = e.aim || 0;
    c.save();
    c.translate(Math.round(e.x), Math.round(e.y - 110 * e.def.scale)); // from her shoulder
    if (Math.cos(a) < 0) { c.scale(-1, 1); a = Math.PI - a; }
    c.rotate(a);
    c.globalAlpha *= f === 3 ? Math.min(1, e.lashT / (K.lashShow * 0.3)) : 1;
    c.drawImage(sp.c, f === 3 ? 40 : 6, -Math.round(h / 2), w, h);
    c.restore();
  }
  // Her waltz: Robert's ring of whirling thorn whips round her waist, a quarter turn a frame, as wide as the ring
  // it cuts, flattened a little to lie in the 3/4 view.
  function drawWaltz(c, e, t) {
    const sp = DL.Art.sprites["roseWaltz" + (1 + (Math.floor(t * 16) % 4))], w = sp.w * 2, h = sp.h * 2 * 0.8;
    c.drawImage(sp.c, Math.round(e.x - w / 2), Math.round(e.y - 40 - h / 2), w, h);
  }
  function drawVine(c, v, T) {
    const rise = Math.min(1, T / 0.2), fade = Math.min(1, (v.life - T) / 0.5);
    if (fade <= 0) return;
    if (DL.Art.sprites.roseBriar3) {
      // Robert's drawn briar: breaking the ground, shooting up, swaying while it stands, then withering
      const left = v.life - T, f = T < 0.1 ? 1 : T < 0.22 ? 2 : left < 0.6 ? 5 : 3 + (Math.floor((T - 0.22) / 0.35) % 2);
      const sp = DL.Art.sprites["roseBriar" + f], w = sp.w * 2, h = sp.h * 2;
      c.save();
      c.globalAlpha *= Math.min(1, left / 0.3);
      c.translate(Math.round(v.x), Math.round(v.y) + 2);
      if (v.v === 1) c.scale(-1, 1); // some grow mirrored, so a line of them isn't all alike
      c.drawImage(sp.c, -Math.round(w / 2), -h, w, h);
      c.restore();
      return;
    }
    c.save();
    c.globalAlpha *= fade;
    c.beginPath(); c.rect(v.x - 40, v.y - 120, 80, 122); c.clip();
    drawSprite(c, "roseVine" + v.v, v.x, v.y + (1 - rise) * 70, 1);
    c.restore();
  }
  // In the glow pass: her whirling whips, the windup of her moves, and the petals blowing off her garden.
  Rose.drawGlow = function (c, t, view) {
    if (G.cave) return;
    for (const e of G.enemies) {
      if (!e.def.rose || e.dormant) continue;
      if (e.spin && !DL.Art.sprites.roseWaltz1) {
        for (let i = 0; i < 2; i++) {
          const a = t * 13 + i * Math.PI, r = K.waltz.r * 0.92;
          c.strokeStyle = `rgba(${RED},0.75)`;
          c.lineWidth = 3;
          c.beginPath(); c.ellipse(e.x, e.y - 30, r, r * 0.5, 0, a, a + 1.6); c.stroke();
          c.strokeStyle = "rgba(255,150,160,0.5)";
          c.lineWidth = 1;
          c.beginPath(); c.ellipse(e.x, e.y - 30, r - 4, (r - 4) * 0.5, 0, a + 0.3, a + 1.5); c.stroke();
        }
      } else if (!e.spin && e.state === "windup" && e.special === "waltz") {
        const k = Math.max(0, 1 - e.stT / K.waltz.windup);
        c.strokeStyle = `rgba(${RED},${0.2 + 0.6 * k})`;
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(e.x, e.y - 30, 30 + 40 * k, (30 + 40 * k) * 0.5, 0, 0, TAU); c.stroke();
      }
    }
    if (G.state !== "play" && G.state !== "camp") return;
    petals(c, t, view);
  };
  // Petals on the wind: thick by the garden, a few strays far out, all blowing away from it.
  const drift = [];
  function petals(c, t, view) {
    const p = G.player;
    if (!p || !Rose.alive()) { drift.length = 0; return; }
    const s = Rose.lair(), d = dist(p.x, p.y, s.x, s.y);
    const n = d > K.petalR ? 0 : Math.round(6 + 30 * (1 - d / K.petalR));
    const w = view.right - view.left, h = view.bottom - view.top;
    while (drift.length < n) drift.push({ x: rand(view.left, view.right), y: rand(view.top, view.bottom), s: Math.random(), ph: Math.random() * TAU });
    if (drift.length > n) drift.length = n;
    const a = Math.atan2(p.y - s.y, p.x - s.x), vx = Math.cos(a), vy = Math.sin(a);
    for (const q of drift) {
      q.x += vx * (0.6 + q.s * 0.8) + Math.sin(t * 2 + q.ph) * 0.3;
      q.y += vy * (0.6 + q.s * 0.8) + Math.cos(t * 1.7 + q.ph) * 0.2;
      if (q.x < view.left) q.x += w; else if (q.x > view.right) q.x -= w;
      if (q.y < view.top) q.y += h; else if (q.y > view.bottom) q.y -= h;
      const f = Math.sin(t * 4 + q.ph);
      const sp = DL.Art.sprites["rosePetal" + (1 + (Math.floor(t * (4 + q.s * 4) + q.ph * 3) % 6))];
      if (sp) {
        // Robert's petals, tumbling through their six shapes; drawn plainly, not as glow
        const k = 0.7 + q.s * 0.5, pw = sp.w * 2 * k, ph = sp.h * 2 * k;
        c.save();
        c.globalCompositeOperation = "source-over";
        c.globalAlpha = 0.85;
        c.drawImage(sp.c, Math.round(q.x - pw / 2), Math.round(q.y - ph / 2), Math.round(pw), Math.round(ph));
        c.restore();
        continue;
      }
      c.fillStyle = `rgba(${q.s > 0.5 ? "230,50,70" : "170,20,40"},${0.55 + 0.3 * f})`;
      c.fillRect(Math.round(q.x), Math.round(q.y), 2 + Math.round(Math.abs(f) * 1.5), 2);
    }
  }
  Rose.lights = function (L) {
    const p = G.player;
    if (!p || G.cave) return;
    const s = Rose.lair();
    if (Math.abs(s.x - p.x) > 1200 || Math.abs(s.y - p.y) > 1200) return;
    L.push({ x: s.x, y: s.y - 20, r: Rose.alive() ? 170 : 90, s: 0.35, col: RED, a: Rose.alive() ? 0.55 : 0.25 });
    if (Rose.alive()) for (const b of Rose.bushes()) L.push({ x: b.x, y: b.y - 14, r: 26, s: 0.4, col: RED, a: 0.5 });
  };

  /* ---------------- the coded garden pieces ---------------- */
  const PAL = {
    stem: "#3b2a17", stemHi: "#5d4424", stemDk: "#22180c", leaf: "#2f3b1c", leafHi: "#4a5a28",
    rose: "#9c1528", roseHi: "#d2304a", roseLt: "#f06a7a", roseDk: "#5a0a16", thorn: "#c9b28a",
    skin: "#ece2da", skinDk: "#a8958d", hair: "#7d7365", hairDk: "#4a4238", lace: "#e6d8c8", laceDk: "#a8988a",
    eye: "#ff4458", outline: "#0b0506",
  };
  const bloom = (P, x, y, r) => {
    const p = PAL;
    P.ell(x, y, r, r * 0.85, p.roseDk);
    P.ell(x - r * 0.15, y - r * 0.15, r * 0.8, r * 0.65, p.rose);
    P.ell(x - r * 0.25, y - r * 0.3, r * 0.4, r * 0.3, p.roseHi);
    if (r >= 3) { P.px(x, y, p.roseDk); P.px(x - 1, y - 1, p.roseLt); }
  };
  function thornLine(P, pts, col, hi) {
    P.line(pts, 2, col);
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
      P.px(mx + 1, my - 1, PAL.thorn); P.px(mx - 1, my + 1, hi || PAL.thorn);
    }
  }
  const sprites = {};
  const BUILD = {
    roseBush0: () => bush(0), roseBush1: () => bush(1), roseBush2: () => bush(2),
    roseVine0: () => vine(0), roseVine1: () => vine(1), roseVine2: () => vine(2),
    roseWither: () => DL.Art.mk(40, 30, (P) => {
      const p = PAL;
      thornLine(P, [4, 26, 12, 22, 20, 26, 28, 21, 36, 25], p.stemDk);
      P.ell(20, 22, 11, 6, p.roseDk); P.ell(18, 21, 8, 4, "#3e0812"); P.ell(16, 20, 3, 2, p.rose);
      for (const [x, y] of [[8, 27], [30, 27], [25, 18], [12, 18]]) P.ell(x, y, 2, 1, p.roseDk);
    }, PAL.outline),
  };
  function bush(v) {
    return DL.Art.mk(36, 34, (P) => {
      const p = PAL, h = DL.hash;
      for (let i = 0; i < 6; i++) {
        const x0 = 18 + (i - 2.5) * 3, top = 8 + h(v, i, 3) * 10, lean = (i - 2.5) * 2.4;
        thornLine(P, [x0, 33, x0 + lean * 0.5, (33 + top) / 2, x0 + lean, top], i % 2 ? p.stem : p.stemDk);
      }
      for (let i = 0; i < 9; i++) P.ell(6 + h(v, i, 4) * 24, 14 + h(v, i, 5) * 16, 3, 2, i % 2 ? p.leaf : p.leafHi);
      for (let i = 0; i < 4 + v; i++) bloom(P, 7 + h(v, i, 6) * 22, 7 + h(v, i, 7) * 14, 3 + h(v, i, 8) * 1.5);
    }, PAL.outline);
  }
  function vine(v) {
    return DL.Art.mk(40, 58, (P) => {
      const p = PAL;
      thornLine(P, [12, 57, 9, 40, 14, 22, 11 + v, 8], p.stem);
      thornLine(P, [26, 57, 30, 44, 26, 30, 29, 18 - v], p.stemDk);
      thornLine(P, [20, 57, 19, 46, 21, 34], p.stemHi);
      P.ell(16, 34, 3, 2, p.leaf); P.ell(25, 40, 3, 2, p.leafHi);
      bloom(P, 11 + v, 7, 5);
      bloom(P, 29, 16 - v, 4);
      if (v) bloom(P, 21, 32, 3);
    }, PAL.outline);
  }

  /* ---------------- the coded stand-in sheet (until Robert's drawn frames come in) ---------------- */
  const W = 104, H = 100, CX = 52, GY = 96;
  // sway: the gown's hem · bob: up/down · whip: the whip arm (rest, up, lash, follow) · lean: flinch back · sink: collapsing (death)
  const ANIMS = {
    idle: [{ sway: 0 }, { sway: 1, bob: -1 }],
    walk: [{ sway: -2 }, { sway: 0, bob: -1 }, { sway: 2 }, { sway: 0, bob: -1 }],
    attack: [{ whip: "up", bob: -1 }, { whip: "lash", sway: 1 }, { whip: "follow", sway: 2 }],
    hurt: [{ lean: 2, sway: -1 }],
    death: [{ sink: 8, sway: -2 }, { sink: 22, sway: -3 }, { sink: 40, sway: -4 }],
  };

  function draw(P, dir, pose) {
    const g = P.g;
    g.save();
    if (pose.sink) { g.translate(0, pose.sink); g.beginPath(); g.rect(0, 0, W, GY + 1 - pose.sink); g.clip(); }
    if (dir === "side") side(P, pose); else front(P, pose, dir === "up");
    g.restore();
  }
  // The gown: torn red petals over cream lace, flaring out to the ground, thorn vines and roses round the hem.
  function gown(P, x, top, sway, back, lean = 0) {
    const p = PAL, hem = GY - 1, n = 8, h = hem - top;
    const half = (u) => 6 + 26 * Math.pow(u, 1.7);
    const at = (u, side) => [x + lean * (1 - u) + sway * u * u + side * half(u), top + u * h];
    const L = [], R = [];
    for (let i = 0; i <= n; i++) { L.push(...at(i / n, -1)); R.unshift(...at(i / n, 1)); } // down the left side, back up the right
    P.poly([...L, ...R], p.roseDk);
    if (!back) {
      const [lx] = at(1, -0.3), [rx] = at(1, 0.25), [tx] = at(0.1, 0);
      P.poly([tx - 2, top + h * 0.1, tx + 2, top + h * 0.1, rx, hem, lx, hem], p.lace);
      P.poly([tx + 1, top + h * 0.2, tx + 2, top + h * 0.2, rx, hem, rx - 4, hem], p.laceDk);
    }
    // ragged petals, thickest at the hips and the flare
    for (let i = 0; i < 46; i++) {
      const u = 0.08 + 0.86 * DL.hash(71, i, 1), side = DL.hash(71, i, 2) * 2 - 1;
      if (!back && Math.abs(side + 0.02) < 0.24 && u > 0.15) continue; // leave the lace showing down the front
      const [px, py] = at(u, side * 0.92), w = 3 + u * 4, l = 5 + u * 6;
      const col = i % 5 === 0 ? p.roseHi : i % 2 ? p.rose : p.roseDk;
      P.poly([px - w, py - 2, px + w, py - 2, px + w * 0.6, py + l * 0.7, px + 1, py + l * 0.45, px - w * 0.3, py + l], col);
    }
    // the hem's tatters and thorn vines
    for (let i = 0; i <= 10; i++) {
      const [hx] = at(1, -1 + i / 5);
      P.poly([hx - 3, hem - 4, hx + 3, hem - 4, hx + (i % 2 ? 2 : -1), hem + 1], i % 2 ? p.rose : p.roseDk);
    }
    const [v0] = at(1, -1.08), [v1] = at(1, 1.08);
    thornLine(P, [v0, hem, v0 + 12, hem - 9, x + sway - 10, hem - 3, x + sway + 4, hem - 10, v1 - 14, hem - 4, v1, hem - 1], p.stem);
    for (const [u, sd, r] of [[0.92, -0.75, 3], [0.7, -0.3, 2.5], [0.88, 0.45, 3], [0.97, 0.85, 3], [0.55, -0.7, 2.5], [0.5, 0.6, 2.5]]) { const [bx, by] = at(u, sd); bloom(P, bx, by, r); }
  }
  function head(P, x, y, back, side) {
    const p = PAL;
    // long pale hair falling down the back and over the shoulders
    P.poly([x - 4, y - 5, x + 4, y - 5, x + 6, y + 2, x + 8, y + 18, x + 3, y + 15, x - 3, y + 15, x - 8, y + 18, x - 6, y + 2], p.hairDk);
    P.poly([x - 3, y - 5, x + 3, y - 5, x + 5, y + 2, x + 6, y + 14, x - 6, y + 14, x - 5, y + 2], p.hair);
    if (!back) {
      if (side) { P.ell(x + 2, y + 1, 3.5, 5, p.skin); P.px(x + 4, y, p.eye); P.px(x + 5, y + 4, p.skinDk); }
      else {
        P.ell(x, y + 1, 4, 5, p.skin);
        P.rect(x - 4, y - 4, 8, 3, p.hair); // a fringe
        P.px(x - 2, y, p.eye); P.px(x + 2, y, p.eye);
        P.px(x, y + 4, p.skinDk);
      }
    }
    // the crown of thorns with its roses
    P.rect(x - 6, y - 6, 12, 2, p.stemDk);
    for (let i = -2; i <= 2; i++) P.poly([x + i * 2.6 - 1, y - 6, x + i * 2.6 + 1, y - 6, x + i * 2.6, y - 11 - (i === 0 ? 3 : Math.abs(i) === 1 ? 1 : 0)], p.stem);
    bloom(P, x - 4, y - 6, 2); bloom(P, x + 4, y - 6, 2);
  }
  // A thorned arm from the shoulder through the elbow to a clawed hand, or on into a long whip.
  function arm(P, pts) { thornLine(P, pts, PAL.stem, PAL.stemHi); P.line(pts.slice(0, 4), 3, PAL.stem); }
  function claw(P, x, y, up) {
    for (let i = -1; i <= 1; i++) P.line([x, y, x + i * 3, y + (up ? -6 : 6), x + i * 4 + 1, y + (up ? -9 : 9)], 1, PAL.roseHi);
  }
  function front(P, pose, back) {
    const p = PAL, b = pose.bob || 0, sway = pose.sway || 0, lean = pose.lean || 0, x = CX;
    const waist = GY - 50 + b, sh = GY - 66 + b, hy = GY - 78 + b - lean;
    // the whip arm (her right, the viewer's left) behind her when raised
    const sx = back ? x + 9 : x - 9, dirx = back ? 1 : -1;
    const whip = pose.whip;
    if (whip === "up") arm(P, [sx, sh, sx + dirx * 12, sh - 14, sx + dirx * 6, sh - 26, sx - dirx * 8, sh - 30, sx - dirx * 22, sh - 22]);
    gown(P, x, waist, sway, back, lean);
    // the bodice of bark and thorns
    P.poly([x - 7 + lean, waist + 1, x + 7 + lean, waist + 1, x + 10, sh, x - 10, sh], p.stem);
    P.poly([x - 5 + lean, waist, x + 4 + lean, waist, x + 7, sh + 1, x - 6, sh + 1], p.stemHi);
    for (let i = 0; i < 4; i++) P.px(x - 4 + i * 3, waist - 4 - i * 2, p.thorn);
    if (!back) { bloom(P, x, sh + 6, pose.whip ? 5 : 4.5); P.px(x - 1, sh + 6, p.roseLt); }
    bloom(P, x - 10, sh, 3); bloom(P, x + 10, sh, 3);
    head(P, x, hy, back);
    // the other arm: a clawed hand raised beside her head
    const ox = back ? x - 9 : x + 9, odx = back ? -1 : 1;
    arm(P, [ox, sh, ox + odx * 9, sh - 6, ox + odx * 8, sh - 18]);
    claw(P, ox + odx * 8, sh - 18, true);
    // the whip arm, unless it was drawn raised behind
    if (whip === "lash") arm(P, [sx, sh, sx + dirx * 10, sh + 10, sx + dirx * 4, GY - 26, sx - dirx * 20, GY - 10, sx - dirx * 40, GY - 4]);
    else if (whip === "follow") arm(P, [sx, sh, sx + dirx * 12, sh + 14, sx + dirx * 18, GY - 18, sx + dirx * 30, GY - 6, sx + dirx * 44, GY - 2]);
    else if (!whip) arm(P, [sx, sh, sx + dirx * 12, sh + 12, sx + dirx * 18, waist + 12, sx + dirx * 26, GY - 18, sx + dirx * 36, GY - 6, sx + dirx * 42, GY - 1]);
  }
  function side(P, pose) {
    const p = PAL, b = pose.bob || 0, sway = pose.sway || 0, lean = pose.lean || 0, x = CX - 4;
    const waist = GY - 50 + b, sh = GY - 66 + b, hy = GY - 78 + b;
    const whip = pose.whip;
    // the far arm, a claw held up behind her
    arm(P, [x - 2, sh, x - 10, sh - 8, x - 8, sh - 20]);
    claw(P, x - 8, sh - 20, true);
    if (whip === "up") arm(P, [x + 2, sh, x - 6, sh - 14, x - 20, sh - 20, x - 34, sh - 12]);
    // the gown trails behind her
    gown(P, x - 2, waist, sway - 4, true, lean * -1);
    P.poly([x - 6, waist + 4, x + 4, waist + 4, x + 18 + sway, GY - 1, x - 4 + sway, GY - 1], p.rose);
    P.poly([x - 2, waist + 8, x + 2, waist + 8, x + 12 + sway, GY - 1, x + 4 + sway, GY - 1], p.lace);
    P.poly([x - 5 - lean, waist + 1, x + 5 - lean, waist + 1, x + 6, sh, x - 6, sh], p.stem);
    P.poly([x - 1 - lean, waist, x + 4 - lean, waist, x + 5, sh + 1, x, sh + 1], p.stemHi);
    bloom(P, x + 4, sh + 6, 3.5);
    bloom(P, x, sh, 3);
    head(P, x + 1 - lean, hy - lean, false, true);
    // the near arm and its whip
    if (whip === "lash") arm(P, [x + 2, sh, x + 14, sh + 4, x + 30, sh + 10, x + 44, GY - 18, x + 50, GY - 4]);
    else if (whip === "follow") arm(P, [x + 2, sh, x + 12, sh + 10, x + 24, GY - 24, x + 40, GY - 8, x + 50, GY - 2]);
    else if (!whip) arm(P, [x + 2, sh, x + 8, sh + 12, x + 14, waist + 10, x + 16, GY - 20, x + 24, GY - 6, x + 32, GY - 1]);
  }

  Rose.sheet = function () {
    const sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = {};
      for (const anim in ANIMS) sheet[dir][anim] = ANIMS[anim].map((pose) => Object.assign(DL.Art.mk(W, H, (P) => draw(P, dir, pose), PAL.outline), { ax: CX, ay: GY }));
    }
    return sheet;
  };
})(window.DL);
