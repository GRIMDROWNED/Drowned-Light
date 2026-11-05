/* Drowned Light — the Abyssal Spires: a test room for a dungeon level with corridors and height (Robert, 2026-11-05).
   Floating violet stone platforms over a sea of mist, after Robert's "Abyssal Spires" picture: a round rune plaza, a long
   walkway one level up reached by stairs, two portal platforms a level higher still, a terrace with a falling stream of
   light across a rope bridge, and a little arch platform down a second bridge.

   It's drawn in the game's 3/4 top-down view, not isometric, so the knights' front/back/side art works unchanged. Height
   is faked the way the Pyramid does it: a floor's world rect is where you walk, and its stone face hangs DOWN from its
   south edge, longer the higher it stands, fading into the mist. Everything is painted in code once into one canvas
   (cheap to draw each frame); crystals, arches and posts are y-sorted with the knights; runes, portals, the light-fall,
   crystal glows and the mist move.

   You walk only on floors, stairs and bridges (Spires.collide). Step into the west arch or the east ring to cross between
   them; the small arch on the south platform takes you home. A Spire Sentinel (crystal turret, src/bullets.js) on the terrace and one in the walkway
   fire bullet patterns. Stand on the middle of the rune circle and Drowned climb out
   of the mist on the far platforms (and broken Sentinels come back) and come for you, routing over stairs and bridges (Spires.route).
   Reached from the pause menu in Sandbox. The world clock stops while you're here. Numbers: DL.SPIRES (src/data.js). */
"use strict";
(function (DL) {
  const G = DL.Game, S = DL.SPIRES;
  const OX = S.x, OY = S.y, LH = S.lh;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const Sp = (DL.Spires = {});
  G.spires = null;

  /* ---------------- the layout (local px; y grows south) ---------------- */
  // floors: x0, y0, x1, y1, level
  const FLOORS = {
    plaza: [-210, -10, 210, 330, 1],
    walk: [-720, -300, 760, -200, 2],
    west: [-900, -700, -560, -440, 3],
    east: [520, -760, 860, -480, 3],
    terrace: [470, 40, 800, 300, 1],
    south: [-820, 420, -540, 640, 0],
  };
  // stairs rising one level going north: x0, y0 (top), x1, y1 (foot), level at the foot
  const STAIRS = {
    s1: [-55, -212, 55, 2, 1],
    s2: [-715, -452, -615, -288, 2],
    s3: [605, -492, 715, -288, 2],
  };
  // rope bridges: x1, y1, x2, y2, half width
  const BRIDGES = {
    b1: [195, 175, 485, 150, 26],
    b2: [-195, 250, -560, 470, 26],
  };
  // where two pieces meet: [a, b, x, y] (the Drowned route through these)
  const JOINS = [
    ["plaza", "s1", 0, -4], ["s1", "walk", 0, -206], ["walk", "s2", -665, -294], ["s2", "west", -665, -446],
    ["walk", "s3", 660, -294], ["s3", "east", 660, -486], ["plaza", "b1", 203, 173], ["b1", "terrace", 478, 151],
    ["plaza", "b2", -203, 252], ["b2", "south", -552, 465],
  ];
  const RUNE = { x: 0, y: 160, r: 150, sq: 0.78 }; // the rune circle on the plaza (squashed by sq: it lies on the floor)
  const ARCH_W = { x: -730, y: -640 }, RING_E = { x: 690, y: -700 }, ARCH_S = { x: -680, y: 455 };
  // things that stand up: drawn y-sorted with the knights. kind, x, y, (size)
  const PROPS = [
    ["arch", ARCH_W.x, ARCH_W.y, 1], ["ring", RING_E.x, RING_E.y], ["arch", ARCH_S.x, ARCH_S.y, 0.8],
    ["post", -188, 8], ["post", 188, 8], ["post", -188, 312], ["post", 188, 312],
    ["spire", -480, -292], ["spire", -240, -292], ["spire", 240, -292], ["spire", 480, -292],
    ["post", -880, -458], ["post", -580, -458], ["post", 540, -500], ["post", 840, -500],
    ["crystal", 742, 262, 1.5, 0], ["crystal", 700, 276, 0.8, 2], ["crystal", 770, 232, 0.9, 1],
    ["crystal", -870, -680, 1, 1], ["crystal", 840, -740, 1.1, 0], ["crystal", -800, 622, 1.1, 2], ["crystal", -566, 628, 0.8, 0],
    ["crystal", 500, 60, 0.7, 1], ["crystal", -60, -280, 0.7, 2], ["crystal", 300, -228, 0.6, 0],
  ];
  // solid circles: x, y, r
  const SOLIDS = [
    [ARCH_W.x - 60, ARCH_W.y, 18], [ARCH_W.x + 60, ARCH_W.y, 18], [RING_E.x - 72, RING_E.y, 18], [RING_E.x + 72, RING_E.y, 18],
    [ARCH_S.x - 48, ARCH_S.y, 15], [ARCH_S.x + 48, ARCH_S.y, 15],
    [-188, 8, 11], [188, 8, 11], [-188, 312, 11], [188, 312, 11], [-880, -458, 11], [-580, -458, 11], [540, -500, 11], [840, -500, 11],
    [-480, -292, 11], [-240, -292, 11], [240, -292, 11], [480, -292, 11], [742, 262, 22], [-870, -680, 12], [840, -740, 12], [-800, 622, 12],
  ];
  // stone columns standing up out of the mist (not walkable): x, y, width, level
  const PILLARS = [
    [-420, -80, 64, 1], [330, -100, 56, 1], [-400, 560, 76, 0], [300, 540, 64, 1], [1000, -220, 84, 2], [980, 430, 70, 1],
    [-1060, -160, 76, 2], [-60, 700, 60, 0], [640, 650, 80, 0], [-300, -640, 58, 3], [170, -650, 66, 3], [-1080, 360, 66, 1],
    [1060, -660, 56, 3], [-1080, -700, 56, 3], [1100, 120, 50, 1], [-200, 470, 44, 0], [420, -560, 48, 3],
  ];
  const FALL = { x0: 690, x1: 760, y: 300, len: 300 }; // the stream of violet light pouring off the terrace
  const SPAWN = { x: 0, y: 290 };

  /* ---------------- where you can stand ---------------- */
  Sp.inRegion = (x, y) => Math.abs(x - OX) < S.halfW && Math.abs(y - OY) < S.halfH;
  Sp.active = () => !!G.spires;
  const inRect = (x, y, q, m) => x > q[0] + m && x < q[2] - m && y > q[1] + m && y < q[3] - m;
  const inStair = (x, y, q, m) => x > q[0] + m && x < q[2] - m && y > q[1] && y < q[3];
  function segD(x, y, q) {
    const vx = q[2] - q[0], vy = q[3] - q[1], u = Math.max(0, Math.min(1, ((x - q[0]) * vx + (y - q[1]) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - q[0] - vx * u, y - q[1] - vy * u);
  }
  const inBridge = (x, y, q, m) => segD(x, y, q) < q[4] - m;
  // which piece (local point), or null
  function pieceAt(x, y, m) {
    for (const k in FLOORS) if (inRect(x, y, FLOORS[k], m)) return k;
    for (const k in STAIRS) if (inStair(x, y, STAIRS[k], m)) return k;
    for (const k in BRIDGES) if (inBridge(x, y, BRIDGES[k], m)) return k;
    return null;
  }
  Sp.walkable = (x, y, m = 6) => !!pieceAt(x - OX, y - OY, m);

  // Keep a walker on the stone: back to where it last stood (sliding along the edge if it can).
  Sp.collide = function (ent, r) {
    if (!Sp.inRegion(ent.x, ent.y)) return;
    for (const s of SOLIDS) {
      const dx = ent.x - OX - s[0], dy = ent.y - OY - s[1], d = Math.hypot(dx, dy), min = s[2] + r;
      if (d < min && d > 0.01) { ent.x = OX + s[0] + (dx / d) * min; ent.y = OY + s[1] + (dy / d) * min; }
    }
    const m = Math.min(8, r * 0.6);
    if (!Sp.walkable(ent.x, ent.y, m)) {
      const lx = ent.spx, ly = ent.spy;
      if (lx == null || !Sp.inRegion(lx, ly)) { if (ent === G.player) { ent.x = OX + SPAWN.x; ent.y = OY + SPAWN.y; } }
      else if (Sp.walkable(ent.x, ly, m)) ent.y = ly;
      else if (Sp.walkable(lx, ent.y, m)) ent.x = lx;
      else { ent.x = lx; ent.y = ly; }
    }
    ent.spx = ent.x; ent.spy = ent.y;
  };

  // A Drowned heading for (tx, ty) on another piece: the next join on the way, over stairs and bridges.
  const NEXT = {};
  for (const j of JOINS) { (NEXT[j[0]] = NEXT[j[0]] || []).push(j); (NEXT[j[1]] = NEXT[j[1]] || []).push(j); }
  Sp.route = function (x, y, tx, ty) {
    if (!G.spires || !Sp.inRegion(x, y)) return null;
    const a = pieceAt(x - OX, y - OY, 0), b = pieceAt(tx - OX, ty - OY, 0);
    if (!a || !b || a === b) return null;
    const prev = { [a]: null }, q = [a];
    while (q.length && !(b in prev)) {
      const k = q.shift();
      for (const j of NEXT[k] || []) { const o = j[0] === k ? j[1] : j[0]; if (!(o in prev)) { prev[o] = [k, j]; q.push(o); } }
    }
    if (!(b in prev)) return null;
    const path = [];
    for (let k = b; prev[k]; k = prev[k][0]) path.unshift(prev[k][1]);
    let j = path[0];
    if (Math.hypot(x - OX - j[2], y - OY - j[3]) < 16) j = path[1]; // at the join already: on to the next
    return j ? { x: OX + j[2], y: OY + j[3] } : { x: tx, y: ty };
  };

  /* ---------------- going in and out ---------------- */
  const followers = () => [...G.hounds, ...G.golems, ...G.kindles];
  Sp.enter = function () {
    const p = G.player;
    if (!p || G.spires || G.cave) return;
    G.spires = { bx: p.x, by: p.y, inPortal: true, wake: 0, flare: 0 };
    p.x = OX + SPAWN.x; p.y = OY + SPAWN.y; p.spx = p.x; p.spy = p.y;
    p.kx = p.ky = 0; p.dashT = 0; p.angle = -Math.PI / 2;
    for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); f.spx = null; }
    G.camera.x = p.x; G.camera.y = p.y - 20;
    sentinels();
    say("The Abyssal Spires. Cross the arches to travel; stand on the rune circle to wake the Drowned.", "good");
  };
  Sp.leave = function () {
    const sp = G.spires, p = G.player;
    if (!sp) return;
    G.spires = null;
    DL.Bullets.clear();
    for (const e of G.enemies) if (Sp.inRegion(e.x, e.y)) e.removed = true;
    G.enemies = G.enemies.filter((e) => !e.removed);
    if (p) {
      p.x = sp.bx; p.y = sp.by; p.kx = p.ky = 0; p.dashT = 0;
      if (Sp.inRegion(p.x, p.y)) { p.x = 0; p.y = 70; }
      for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); }
      G.camera.x = p.x; G.camera.y = p.y - 20;
    }
    say("You step back out of the mist.", "good");
  };

  // Spire Sentinels (crystal turrets, src/bullets.js): one on the terrace, one in the walkway; brought back if broken.
  const SENTINELS = [[640, 150, 0], [-300, -250, 0.7]]; // x, y, heat: a gentle one on the terrace, a dense one in the walkway
  function sentinels() {
    for (const [x, y, heat] of SENTINELS) {
      if (G.enemies.some((e) => e.def.sentinel && !e.removed && Math.hypot(e.x - OX - x, e.y - OY - y) < 40)) continue;
      G.enemies.push(G.makeEnemy("sentinel", OX + x, OY + y, S.wave.zone, { heat }));
      for (let i = 0; i < 12; i++) G.puff(OX + x + DL.rand(-14, 14), OY + y - DL.rand(0, 60), "rgba(200,150,255,0.7)", 50, 0.7);
    }
  }

  // The portals, and waking the rune circle.
  Sp.update = function (dt) {
    const sp = G.spires, p = G.player;
    if (!sp || !p) return;
    if (!Sp.inRegion(p.x, p.y)) { G.spires = null; return; }
    sp.flare = Math.max(0, sp.flare - dt * 0.5);
    const lx = p.x - OX, ly = p.y - OY;
    const atW = Math.abs(lx - ARCH_W.x) < 36 && ly < ARCH_W.y - 4, atE = Math.abs(lx - RING_E.x) < 44 && ly < RING_E.y - 4;
    const atS = Math.abs(lx - ARCH_S.x) < 30 && ly < ARCH_S.y - 4;
    if (atS) { Sp.leave(); return; }
    if ((atW || atE) && !sp.inPortal) {
      const to = atW ? RING_E : ARCH_W;
      p.x = OX + to.x; p.y = OY + to.y + 44; p.spx = p.x; p.spy = p.y; p.dashT = 0; p.kx = p.ky = 0; p.angle = Math.PI / 2;
      G.camera.x = p.x; G.camera.y = p.y - 20;
      for (let i = 0; i < 18; i++) G.puff(p.x + DL.rand(-16, 16), p.y - DL.rand(0, 50), "rgba(200,150,255,0.7)", 70, 0.8);
      DL.Sound.play("chime");
    }
    sp.inPortal = atW || atE;
    // the rune circle: step on its heart and the Drowned climb out of the mist on the far platforms
    const mine = G.enemies.filter((e) => !e.removed && !e.def.sentinel && Sp.inRegion(e.x, e.y));
    sp.wake = Math.max(0, sp.wake - (mine.length ? 0 : dt));
    if (!mine.length && sp.wake <= 0 && Math.hypot(lx - RUNE.x, (ly - RUNE.y) / RUNE.sq) < 34) {
      const w = S.wave, spots = [FLOORS.terrace, FLOORS.south, FLOORS.west, FLOORS.east, FLOORS.walk];
      for (let i = 0; i < w.n; i++) {
        const f = spots[i % spots.length], x = OX + (f[0] + f[2]) / 2 + DL.rand(-40, 40), y = OY + (f[1] + f[3]) / 2 + DL.rand(-20, 20);
        G.enemies.push(G.makeEnemy(w.type, x, y, w.zone, { rise: 0.9 }));
      }
      sentinels();
      sp.wake = w.rest; sp.flare = 1;
      G.camera.shake = 6;
      DL.Sound.play("whisper");
      say("The runes flare. The Drowned climb out of the mist!", "danger");
    }
  };

  /* ---------------- painting (all once, into canvases) ---------------- */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // mix two #rrggbb colours (k 0..1)
  function mix(a, b, k) {
    const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const v = [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k));
    return `rgb(${v[0]},${v[1]},${v[2]})`;
  }
  const C = {
    grout: "#20152f", topD: "#4a3a66", topL: "#8a76ae", rim: "#9c88c0", rimD: "#5e4a80",
    face: "#3e2e58", faceD: "#1f1630", faceL: "#5a4680", mortar: "#170f24",
    wood: "#4b3a36", woodL: "#6e574c", rope: "#2a2030",
    cryO: "#1d0f33", cryD: "#5a2ea8", cryM: "#9558e6", cryL: "#d6b4ff", cryH: "#f6ecff",
  };
  const GLOW = "190,130,255";
  const BX0 = -1200, BY0 = -860, BX1 = 1200, BY1 = 980; // the painted canvas's extent (local)
  let base = null, art = null;

  // A stone face hanging from a floor's south edge: courses of brick darkening downward, a ragged foot, fading out.
  function face(g, x0, x1, y, h, r, glyphs) {
    const w = Math.round(x1 - x0), H = Math.round(h + 70), t = mk(w, H), q = t.getContext("2d");
    q.fillStyle = C.face;
    q.beginPath(); q.moveTo(0, 0); q.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 8) {
      const edge = Math.min(1, Math.min(x, w - x) / 40); // shorter at the corners: a hanging root of rock
      q.lineTo(x, h * (0.75 + 0.25 * edge) + r() * 60 * edge);
    }
    q.closePath(); q.fill();
    q.globalCompositeOperation = "source-atop";
    for (let row = 0, yy = 0; yy < H; row++, yy += 14) {
      const off = (row % 2) * 14;
      for (let x = -off; x < w; x += 28) {
        const k = 0.15 + r() * 0.35 - Math.min(0.3, yy / H * 0.4);
        q.fillStyle = mix(C.faceD, C.faceL, Math.max(0, k));
        q.fillRect(x + 1, yy + 1, 26, 12);
        if (r() < 0.25) { q.fillStyle = "rgba(0,0,0,0.25)"; q.fillRect(x + 1 + r() * 20, yy + 3, 1, 8); } // a crack
      }
      q.fillStyle = C.mortar; q.fillRect(0, yy, w, 1);
    }
    // the corners turn away from the light: lighter on the west end, darker on the east
    let gr = q.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(200,170,255,0.18)"); gr.addColorStop(Math.min(0.2, 24 / w), "rgba(200,170,255,0)");
    gr.addColorStop(Math.max(0.8, 1 - 24 / w), "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.4)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    gr = q.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0.05)"); gr.addColorStop(1, "rgba(10,0,25,0.55)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    // faint carved runes
    for (let i = 0; i < glyphs; i++) rune(q, 20 + r() * (w - 40), 18 + r() * Math.max(10, h * 0.5), 6, r, `rgba(${GLOW},0.55)`);
    // under the top edge: a dark band where the floor's lip throws its shadow
    q.fillStyle = "rgba(0,0,0,0.35)"; q.fillRect(0, 0, w, 3);
    // fade into the mist
    q.globalCompositeOperation = "destination-out";
    gr = q.createLinearGradient(0, h * 0.45, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    g.drawImage(t, x0, y);
  }

  // A floor's top: flagstones in offset rows, bevelled, with a lighter kerb round the edge.
  function top(g, x0, y0, x1, y1, r, gaps) {
    g.save();
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.fillStyle = C.grout; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const TW = 22, TH = 17;
    for (let row = 0, y = y0; y < y1; row++, y += TH) {
      for (let x = x0 - (row % 2) * (TW / 2); x < x1; x += TW) {
        const k = 0.25 + r() * 0.4;
        g.fillStyle = mix(C.topD, C.topL, k); g.fillRect(x + 1, y + 1, TW - 2, TH - 2);
        g.fillStyle = mix(C.topD, C.topL, k + 0.18); g.fillRect(x + 1, y + 1, TW - 2, 2);
        g.fillStyle = mix(C.topD, C.topL, k - 0.2); g.fillRect(x + 1, y + TH - 3, TW - 2, 2);
        const roll = r();
        if (roll < 0.1) { // a crack
          g.strokeStyle = "rgba(25,15,40,0.7)"; g.lineWidth = 1;
          g.beginPath(); const cx = x + 3 + r() * 14; g.moveTo(cx, y + 2); g.lineTo(cx + r() * 6 - 3, y + 8); g.lineTo(cx + r() * 8 - 4, y + TH - 3); g.stroke();
        } else if (roll < 0.14) { // a glint of crystal grit
          g.fillStyle = `rgba(${GLOW},0.5)`; g.fillRect(x + 4 + r() * 12, y + 4 + r() * 8, 2, 2);
        } else if (roll < 0.2) { // a chipped corner
          g.fillStyle = C.grout; g.fillRect(x + 1, y + 1, 5, 4);
        }
      }
    }
    // kerb blocks round the edge (with gaps where stairs and bridges come in)
    const open = (x, y) => gaps.some((q) => Math.hypot(x - q[0], y - q[1]) < 52);
    const kerb = (x, y, w, h) => {
      g.fillStyle = C.rimD; g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.rimD, C.rim, 0.5 + r() * 0.5); g.fillRect(x + 1, y + 1, w - 2, h - 3);
      g.fillStyle = "rgba(255,240,255,0.18)"; g.fillRect(x + 1, y + 1, w - 2, 1);
    };
    for (let x = x0; x < x1; x += 24) {
      if (!open(x + 12, y0)) kerb(x, y0, 24, 8);
      if (!open(x + 12, y1)) kerb(x, y1 - 8, 24, 8);
    }
    for (let y = y0 + 8; y < y1 - 8; y += 24) {
      if (!open(x0, y + 12)) kerb(x0, y, 8, Math.min(24, y1 - 8 - y));
      if (!open(x1, y + 12)) kerb(x1 - 8, y, 8, Math.min(24, y1 - 8 - y));
    }
    // raised blocks along the south edge (a parapet you can see over)
    for (let x = x0 + 18; x < x1 - 30; x += 56) {
      if (open(x + 8, y1)) continue;
      g.fillStyle = C.rim; g.fillRect(x, y1 - 18, 16, 8);
      g.fillStyle = C.faceL; g.fillRect(x, y1 - 10, 16, 10);
      g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x + 12, y1 - 10, 4, 10);
    }
    g.restore();
  }

  // The rune circle set into the plaza: rings of wedge stones round a disc, with grooves for the runes.
  function runeFloor(g, r) {
    g.save();
    g.translate(RUNE.x, RUNE.y); g.scale(1, RUNE.sq);
    g.fillStyle = C.grout; g.beginPath(); g.arc(0, 0, RUNE.r + 4, 0, Math.PI * 2); g.fill();
    for (let R = RUNE.r; R > 26; R -= 24) {
      const n = Math.max(8, Math.round((Math.PI * 2 * R) / 34)), off = r() * 0.5;
      for (let i = 0; i < n; i++) {
        const a0 = ((i + off) / n) * Math.PI * 2 + 0.012, a1 = ((i + 1 + off) / n) * Math.PI * 2 - 0.012;
        g.fillStyle = mix(C.topD, C.topL, 0.3 + r() * 0.4 + (R === RUNE.r ? 0.15 : 0));
        g.beginPath(); g.arc(0, 0, R - 1, a0, a1); g.arc(0, 0, R - 22, a1, a0, true); g.closePath(); g.fill();
      }
    }
    g.fillStyle = mix(C.topD, C.topL, 0.55); g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#1a1028"; g.lineWidth = 4;
    for (const R of [112, 64]) { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  // a little angular rune glyph
  function rune(q, x, y, s, r, col) {
    q.strokeStyle = col; q.lineWidth = 1.5;
    q.beginPath();
    const n = 2 + Math.floor(r() * 3);
    let px = x + (r() - 0.5) * s, py = y - s;
    q.moveTo(px, py);
    for (let i = 0; i < n; i++) { px = x + (r() - 0.5) * s * 1.6; py = y - s + ((i + 1) / n) * s * 2; q.lineTo(px, py); }
    q.moveTo(x - s * 0.6, y); q.lineTo(x + s * 0.6, y + (r() - 0.5) * s);
    q.stroke();
  }

  // Stairs rising north: treads and risers between low stone rails, and the face under their foot.
  function stairs(g, q, r) {
    const [x0, y0, x1, y1] = q, n = Math.max(5, Math.round((y1 - y0) / 15)), h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * h, k = 0.35 + 0.25 * (1 - i / n); // higher steps catch more light
      g.fillStyle = mix(C.topD, C.topL, k + r() * 0.08); g.fillRect(x0, y, x1 - x0, h * 0.6);
      g.fillStyle = mix(C.topD, C.topL, k + 0.22); g.fillRect(x0, y, x1 - x0, 1.5);
      g.fillStyle = mix(C.faceD, C.face, 0.6 + r() * 0.3); g.fillRect(x0, y + h * 0.6, x1 - x0, h * 0.4);
      for (let x = x0 + 6 + r() * 20; x < x1 - 4; x += 26 + r() * 10) { g.fillStyle = "rgba(10,5,20,0.45)"; g.fillRect(x, y + h * 0.6, 1, h * 0.4); }
    }
    for (const x of [x0 - 3, x1 - 7]) { // rails
      g.fillStyle = C.rimD; g.fillRect(x, y0 - 6, 10, y1 - y0 + 6);
      g.fillStyle = C.rim; g.fillRect(x + 1, y0 - 6, 8, y1 - y0 + 2);
      for (let y = y0; y < y1; y += 22) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 1, y, 8, 1); }
      g.fillStyle = C.faceL; g.fillRect(x, y0 - 14, 10, 10); g.fillStyle = C.rim; g.fillRect(x, y0 - 16, 10, 3); // newel posts
      g.fillStyle = C.faceL; g.fillRect(x, y1 - 12, 10, 12); g.fillStyle = C.rim; g.fillRect(x, y1 - 14, 10, 3);
    }
  }

  // A rope bridge: planks across, chain rails on posts, sagging a little and dripping chain below.
  function bridge(g, q, r) {
    const [ax, ay, bx, by, hw] = q, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux;
    const sag = (u) => Math.sin(Math.PI * u) * 7;
    // chains hanging under it
    g.strokeStyle = "rgba(30,20,45,0.8)"; g.lineWidth = 1.5;
    for (let u = 0.15; u < 0.9; u += 0.14) {
      const x = ax + ux * len * u, y = ay + uy * len * u + sag(u) + 4, d = 10 + r() * 26;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + d); g.stroke();
    }
    for (let s = 0; s < len; s += 9) {
      const u = s / len, cx = ax + ux * s, cy = ay + uy * s + sag(u);
      g.fillStyle = "#1c1420";
      g.beginPath(); g.moveTo(cx + nx * hw, cy + ny * hw); g.lineTo(cx - nx * hw, cy - ny * hw);
      g.lineTo(cx - nx * hw + ux * 8, cy - ny * hw + uy * 8 + 2); g.lineTo(cx + nx * hw + ux * 8, cy + ny * hw + uy * 8 + 2); g.closePath(); g.fill();
      g.fillStyle = mix(C.wood, C.woodL, r() * 0.8);
      g.beginPath(); g.moveTo(cx + nx * (hw - 1), cy + ny * (hw - 1)); g.lineTo(cx - nx * (hw - 1), cy - ny * (hw - 1));
      g.lineTo(cx - nx * (hw - 1) + ux * 7, cy - ny * (hw - 1) + uy * 7); g.lineTo(cx + nx * (hw - 1) + ux * 7, cy + ny * (hw - 1) + uy * 7); g.closePath(); g.fill();
    }
    // chain rails, a little above the planks, and their posts at each end
    for (const sd of [1, -1]) {
      g.strokeStyle = "#2b2236"; g.lineWidth = 2;
      g.beginPath();
      for (let s = 0; s <= len; s += 6) { const u = s / len, x = ax + ux * s + nx * hw * sd, y = ay + uy * s + ny * hw * sd + sag(u) * 1.4 - 12; s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = "#6a5a7a"; g.lineWidth = 1;
      for (let s = 3; s <= len; s += 6) { const u = s / len, x = ax + ux * s + nx * hw * sd, y = ay + uy * s + ny * hw * sd + sag(u) * 1.4 - 12; g.beginPath(); g.ellipse(x, y, 2, 1.2, Math.atan2(uy, ux), 0, Math.PI * 2); g.stroke(); }
      for (const [px, py] of [[ax, ay], [bx, by]]) {
        const x = px + nx * hw * sd, y = py + ny * hw * sd;
        g.fillStyle = C.faceD; g.fillRect(x - 4, y - 18, 8, 20);
        g.fillStyle = C.faceL; g.fillRect(x - 4, y - 18, 3, 20);
        g.fillStyle = C.rim; g.fillRect(x - 5, y - 21, 10, 4);
      }
    }
  }

  // A crystal cluster: violet shards with a lit facet, standing on (0, 0).
  function crystalSprite(v) {
    const r = rng(77 + v * 13), c = mk(56, 72), g = c.getContext("2d");
    const shards = v === 0 ? [[0, 56, 9, 0], [-12, 34, 7, -0.35], [12, 40, 7, 0.3], [-5, 22, 5, -0.6], [8, 24, 5, 0.7]]
      : v === 1 ? [[2, 44, 8, 0.1], [-10, 30, 7, -0.4], [14, 26, 6, 0.55]]
      : [[0, 34, 10, 0], [-12, 22, 6, -0.5], [11, 20, 6, 0.5], [-3, 16, 4, -0.15]];
    shards.sort((a, b) => b[1] - a[1]);
    for (const [bx, h, w, lean] of shards) {
      const x = 28 + bx, y = 70, tx = x + Math.sin(lean) * h, ty = y - Math.cos(lean) * h;
      const px = Math.cos(lean) * w, py = Math.sin(lean) * w;
      const pts = [[x - px, y - py], [tx - px * 0.5, ty - py * 0.5 + h * 0.18], [tx, ty], [tx + px * 0.5, ty + py * 0.5 + h * 0.18], [x + px, y + py]];
      const path = (pp) => { g.beginPath(); g.moveTo(pp[0][0], pp[0][1]); for (const q of pp.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); };
      g.fillStyle = C.cryO; path(pts.map(([a, b]) => [a + (a - tx) * 0.08, b + (b > ty ? 1.5 : -1.5)])); g.fill();
      g.fillStyle = C.cryM; path(pts); g.fill();
      g.fillStyle = C.cryD; path([[x, y], [tx, ty], pts[3], pts[4]]); g.fill();
      g.fillStyle = C.cryL; path([pts[0], pts[1], pts[2], [x - px * 0.1, y]]); g.fill();
      g.strokeStyle = C.cryH; g.lineWidth = 1; g.beginPath(); g.moveTo(pts[1][0] + 1, pts[1][1] + 2); g.lineTo(tx, ty + 1); g.stroke();
      if (r() < 0.6) { g.fillStyle = C.cryH; g.fillRect(tx - 1, ty + 3, 2, 2); }
    }
    return c;
  }

  // Stone courses on a column, lit from the west.
  function column(g, x, y, w, h, r) {
    g.fillStyle = C.mortar; g.fillRect(x - 1, y, w + 2, h);
    for (let yy = y, row = 0; yy < y + h; yy += 12, row++) {
      const off = row % 2 ? w / 2 : 0;
      for (let xx = x - off; xx < x + w; xx += w) {
        const a = Math.max(x, xx), b = Math.min(x + w, xx + w);
        g.fillStyle = mix(C.faceD, C.faceL, 0.35 + r() * 0.35); g.fillRect(a + 0.5, yy + 0.5, b - a - 1, 11);
      }
    }
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(220,190,255,0.25)"); gr.addColorStop(0.35, "rgba(220,190,255,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }

  // A pointed arch on two pillars (base at the bottom middle). Returns the canvas and its opening's shape.
  function archSprite(s) {
    const r = rng(5), W = Math.round(150 * s), H = Math.round(200 * s), c = mk(W + 20, H + 10), g = c.getContext("2d");
    const pw = Math.round(30 * s), top = Math.round(66 * s), ox = 10;
    // the stone band of the arch: outer and inner pointed curves
    const outer = () => { g.moveTo(ox, top); g.quadraticCurveTo(ox, top * 0.15, ox + W / 2, 2); g.quadraticCurveTo(ox + W, top * 0.15, ox + W, top); };
    g.beginPath(); outer(); g.lineTo(ox + W - pw, top + 6); g.quadraticCurveTo(ox + W - pw, top * 0.55, ox + W / 2, 26 * s); g.quadraticCurveTo(ox + pw, top * 0.55, ox + pw, top + 6); g.closePath();
    g.fillStyle = C.faceL; g.fill();
    g.save(); g.clip();
    for (let i = 0; i <= 12; i++) { // voussoirs
      const a = Math.PI + (i / 12) * Math.PI, cx = ox + W / 2, cy = top + 4;
      g.strokeStyle = C.mortar; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); g.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W); g.stroke();
    }
    const gr = g.createLinearGradient(ox, 0, ox + W, 0);
    gr.addColorStop(0, "rgba(220,190,255,0.25)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.4)");
    g.fillStyle = gr; g.fillRect(ox, 0, W, top + 10);
    g.restore();
    g.strokeStyle = C.mortar; g.lineWidth = 2; g.beginPath(); outer(); g.stroke();
    // pillars, capitals and plinths
    for (const x of [ox, ox + W - pw]) {
      column(g, x, top, pw, H - top - 12 * s, r);
      g.fillStyle = C.rim; g.fillRect(x - 3, top - 2, pw + 6, 7);
      g.fillStyle = C.faceD; g.fillRect(x - 5, H - 14 * s, pw + 10, 14 * s);
      g.fillStyle = C.faceL; g.fillRect(x - 5, H - 14 * s, pw + 10, 4);
      for (let i = 0; i < 3; i++) rune(g, x + pw / 2, top + 30 * s + i * 34 * s, 5 * s, r, `rgba(${GLOW},0.85)`);
    }
    return { c, ox, W, H, pw, top, s };
  }
  // the opening of an arch (local to its base point), for the portal behind it
  function archHole(g, a, x, y) {
    const l = x - a.W / 2 + a.pw, rr = x + a.W / 2 - a.pw, b = y - 14 * a.s, t = y - a.H + a.top + 6;
    g.beginPath(); g.moveTo(l, b); g.lineTo(l, t); g.quadraticCurveTo(l, y - a.H + a.top * 0.55, x, y - a.H + 26 * a.s); g.quadraticCurveTo(rr, y - a.H + a.top * 0.55, rr, t); g.lineTo(rr, b); g.closePath();
  }

  // The great ring portal: a ring of rune blocks on a stepped base.
  function ringSprite() {
    const r = rng(9), c = mk(220, 250), g = c.getContext("2d"), cx = 110, cy = 112, R0 = 96, R1 = 66;
    // steps
    column(g, 14, 216, 192, 34, r); g.fillStyle = C.rim; g.fillRect(14, 213, 192, 5);
    column(g, 30, 198, 160, 18, r); g.fillStyle = C.rim; g.fillRect(30, 195, 160, 4);
    column(g, 34, 160, 26, 40, r); column(g, 160, 160, 26, 40, r);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.02, a1 = ((i + 1) / n) * Math.PI * 2 - 0.02, lit = 0.5 + 0.35 * Math.cos((a0 + a1) / 2 + 2.4);
      g.fillStyle = mix(C.faceD, C.rim, lit * 0.8 + r() * 0.15);
      g.beginPath(); g.arc(cx, cy, R0, a0, a1); g.arc(cx, cy, R1, a1, a0, true); g.closePath(); g.fill();
      const am = (a0 + a1) / 2;
      rune(g, cx + Math.cos(am) * (R0 + R1) / 2, cy + Math.sin(am) * (R0 + R1) / 2 + 3, 5, r, `rgba(${GLOW},0.9)`);
    }
    g.strokeStyle = C.mortar; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, R1, 0, Math.PI * 2); g.stroke();
    // the keystone crystal socket
    g.fillStyle = C.rim; g.fillRect(cx - 12, cy - R0 - 10, 24, 16);
    return { c, cx, cy, R1, w: 220, h: 250 };
  }

  // A post: a short column with a crystal; a spire: a tall one.
  function postSprite(h, r) {
    const c = mk(40, h + 14), g = c.getContext("2d");
    g.fillStyle = C.faceD; g.fillRect(4, h - 6, 32, 20); g.fillStyle = C.faceL; g.fillRect(4, h - 6, 32, 4);
    column(g, 9, 18, 22, h - 22, r);
    g.fillStyle = C.rim; g.fillRect(6, 12, 28, 8); g.fillStyle = C.rimD; g.fillRect(6, 18, 28, 3);
    return c;
  }

  function puffSprite() {
    const c = mk(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(190,150,240,0.55)"); gr.addColorStop(0.5, "rgba(160,110,220,0.25)"); gr.addColorStop(1, "rgba(140,90,210,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }
  function glowSprite() {
    const c = mk(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${GLOW},0.9)`); gr.addColorStop(0.35, `rgba(${GLOW},0.35)`); gr.addColorStop(1, `rgba(${GLOW},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  // the glowing ring of runes laid in the plaza (drawn turning, squashed onto the floor)
  function runeRing() {
    const r = rng(31), c = mk(320, 320), g = c.getContext("2d"), cx = 160;
    g.strokeStyle = `rgba(${GLOW},0.9)`; g.lineWidth = 3;
    for (const R of [112, 64]) { g.beginPath(); g.arc(cx, cx, R, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.save(); g.translate(cx + Math.cos(a) * 88, cx + Math.sin(a) * 88); g.rotate(a + Math.PI / 2);
      rune(g, 0, 0, 7, r, `rgba(${GLOW},1)`); g.restore();
    }
    for (let i = 0; i < 6; i++) { // spokes
      const a = (i / 6) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cx + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a) * 60, cx + Math.sin(a) * 60); g.stroke();
    }
    return c;
  }

  function paint() {
    const r = rng(1234), c = mk(BX1 - BX0, BY1 - BY0), g = c.getContext("2d");
    g.translate(-BX0, -BY0);
    // every slab back to front by its south edge: its hanging face, then its top
    const gaps = JOINS.map((j) => [j[2], j[3]]);
    const slabs = [];
    for (const k in FLOORS) slabs.push({ y: FLOORS[k][3], f: () => { const q = FLOORS[k]; face(g, q[0], q[2], q[3], S.hang + q[4] * LH, r, Math.round((q[2] - q[0]) / 160)); top(g, q[0], q[1], q[2], q[3], r, gaps); if (k === "plaza") runeFloor(g, r); } });
    for (const k in STAIRS) slabs.push({ y: STAIRS[k][3] - 0.5, f: () => { const q = STAIRS[k]; face(g, q[0] - 3, q[2] + 3, q[3], S.hang + q[4] * LH, r, 0); stairs(g, q, r); } });
    for (const q of PILLARS) slabs.push({ y: q[1] + q[2] * 0.4, f: () => {
      const w = q[2], d = w * 0.8;
      face(g, q[0] - w / 2, q[0] + w / 2, q[1] + d / 2, S.hang + 30 + q[3] * LH, r, 1);
      top(g, q[0] - w / 2, q[1] - d / 2, q[0] + w / 2, q[1] + d / 2, r, []);
    } });
    slabs.sort((a, b) => a.y - b.y);
    for (const s of slabs) s.f();
    for (const k in BRIDGES) bridge(g, BRIDGES[k], r);
    return c;
  }

  function build() {
    base = paint();
    const r = rng(99);
    art = {
      crystals: [0, 1, 2].map(crystalSprite), arch: archSprite(1), archS: archSprite(0.8), ring: ringSprite(),
      post: postSprite(48, r), spire: postSprite(118, r), puff: puffSprite(), glow: glowSprite(), runes: runeRing(),
    };
    // mist puffs drifting below the platforms, and far columns in the haze
    const m = rng(4242);
    art.mist = Array.from({ length: 26 }, () => ({ x: (m() - 0.5) * 2600, y: (m() - 0.5) * 2000, s: 2.5 + m() * 3, v: 6 + m() * 10, a: 0.5 + m() * 0.5 }));
    art.far = Array.from({ length: 18 }, () => ({ x: (m() - 0.5) * 3000, y: (m() - 0.5) * 2400, w: 30 + m() * 50, h: 120 + m() * 220 }));
    art.motes = Array.from({ length: 40 }, () => ({ x: (m() - 0.5) * 2400, y: (m() - 0.5) * 1800, p: m() * 10, v: 10 + m() * 18 }));
  }

  /* ---------------- drawing each frame ---------------- */
  const sees = (view) => view.right > OX - S.halfW && view.left < OX + S.halfW && view.bottom > OY - S.halfH && view.top < OY + S.halfH;
  Sp.covers = (view) => sees(view) && G.camera && Sp.inRegion(G.camera.x, G.camera.y);

  // The mist sea, far columns, then the painted stone; the rune ring and the light-fall glow on top of it.
  Sp.drawGround = function (c, view, t) {
    if (!sees(view)) return;
    if (!base) build();
    const vw = view.right - view.left, vh = view.bottom - view.top;
    let gr = c.createLinearGradient(0, view.top, 0, view.bottom);
    gr.addColorStop(0, "#2a1842"); gr.addColorStop(0.55, "#4b2f72"); gr.addColorStop(1, "#33204f");
    c.fillStyle = gr; c.fillRect(view.left - 2, view.top - 2, vw + 4, vh + 4);
    // far columns, drifting slower than the camera (they're further down)
    const cam = G.camera, px = (cam.x - OX) * 0.45, py = (cam.y - OY) * 0.45;
    c.fillStyle = "rgba(34,20,56,0.45)";
    for (const f of art.far) {
      const x = OX + f.x + px, y = OY + f.y + py;
      if (x + f.w < view.left || x - f.w > view.right || y - f.h > view.bottom || y + f.h < view.top) continue;
      c.fillRect(x - f.w / 2, y - f.h / 2, f.w, f.h);
      c.fillStyle = "rgba(60,40,90,0.4)"; c.fillRect(x - f.w / 2, y - f.h / 2, f.w, 6); c.fillStyle = "rgba(34,20,56,0.45)";
      c.fillStyle = `rgba(${GLOW},0.5)`; c.fillRect(x - 2, y - f.h / 2 - 8, 4, 8); c.fillStyle = "rgba(34,20,56,0.45)";
    }
    drawMist(c, view, t, 1);
    // the painted stone: only the part on screen
    const sx = Math.max(0, view.left - OX - BX0), sy = Math.max(0, view.top - OY - BY0);
    const ex = Math.min(base.width, view.right - OX - BX0 + 1), ey = Math.min(base.height, view.bottom - OY - BY0 + 1);
    if (ex > sx && ey > sy) c.drawImage(base, sx, sy, ex - sx, ey - sy, OX + BX0 + sx, OY + BY0 + sy, ex - sx, ey - sy);
    // the rune ring, slowly turning, brighter when it wakes the Drowned
    const fl = G.spires ? G.spires.flare : 0;
    c.save();
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.45 + 0.15 * Math.sin(t * 1.7) + 0.4 * fl;
    c.translate(OX + RUNE.x, OY + RUNE.y); c.scale(1, RUNE.sq); c.rotate(t * 0.08);
    c.drawImage(art.runes, -160, -160);
    c.restore();
    // the light-fall pouring off the terrace
    c.save();
    c.globalCompositeOperation = "lighter";
    const f = FALL, x0 = OX + f.x0, y0 = OY + f.y;
    gr = c.createLinearGradient(0, y0, 0, y0 + f.len);
    gr.addColorStop(0, `rgba(${GLOW},0.55)`); gr.addColorStop(1, `rgba(${GLOW},0)`);
    c.fillStyle = gr; c.fillRect(x0, y0, f.x1 - f.x0, f.len);
    for (let i = 0; i < 10; i++) {
      const x = x0 + 4 + i * ((f.x1 - f.x0 - 8) / 9), y = y0 + ((t * (90 + i * 13) + i * 37) % f.len);
      c.fillStyle = `rgba(235,215,255,${0.6 * (1 - (y - y0) / f.len)})`;
      c.fillRect(x, y, 2, 22);
    }
    c.restore();
  };

  function drawMist(c, view, t, k) {
    for (const m of art.mist) {
      const w = 128 * m.s, x = OX + ((m.x + t * m.v + 1300) % 2600) - 1300 - w / 2, y = OY + m.y - w / 2;
      if (x > view.right || x + w < view.left || y > view.bottom || y + w < view.top) continue;
      c.globalAlpha = m.a * k;
      c.drawImage(art.puff, x, y, w, w);
    }
    c.globalAlpha = 1;
  }

  // Arches, the ring, posts and crystals stand among the knights.
  Sp.push = function (list, c, t, view) {
    if (!sees(view) || !art) return;
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (x < view.left - 160 || x > view.right + 160 || y < view.top - 20 || y > view.bottom + 260) continue;
      list.push({ y, f: () => drawProp(c, q, x, y, t) });
    }
  };
  function drawProp(c, q, x, y, t) {
    const kind = q[0];
    if (kind === "crystal") {
      const s = q[3], img = art.crystals[q[4]];
      c.drawImage(img, x - 28 * s, y - 70 * s, 56 * s, 72 * s);
    } else if (kind === "post" || kind === "spire") {
      const img = art[kind];
      c.drawImage(img, x - 20, y - img.height + 8);
      c.drawImage(art.crystals[kind === "post" ? 2 : 0], x - 17, y - img.height - 30, 34, 44);
    } else if (kind === "arch") {
      const a = q[3] === 1 ? art.arch : art.archS;
      c.save(); archHole(c, a, x, y); c.clip(); portal(c, x, y - (a.H - a.top) * 0.55, a.W, a.H, t); c.restore();
      c.drawImage(a.c, x - a.W / 2 - a.ox, y - a.H);
      c.drawImage(art.crystals[1], x - a.W / 2 - 8, y - a.H + a.top - 44, 32, 42);
      c.drawImage(art.crystals[1], x + a.W / 2 - 24, y - a.H + a.top - 44, 32, 42);
    } else if (kind === "ring") {
      const g = art.ring, ox = x - g.w / 2, oy = y - g.h + 14;
      c.save(); c.beginPath(); c.arc(ox + g.cx, oy + g.cy, g.R1 + 1, 0, Math.PI * 2); c.clip(); portal(c, ox + g.cx, oy + g.cy, g.R1 * 2, g.R1 * 2, t); c.restore();
      c.drawImage(g.c, ox, oy);
      c.drawImage(art.crystals[0], ox + g.cx - 16, oy + g.cy - 96 - 50, 32, 52);
    }
  }
  // a swirling violet portal filling (x, y) w by h
  function portal(c, x, y, w, h, t) {
    const R = Math.max(w, h) * 0.7;
    let gr = c.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, "#f2dcff"); gr.addColorStop(0.25, "#b070ff"); gr.addColorStop(0.7, "#4a1d8a"); gr.addColorStop(1, "#1a0a33");
    c.fillStyle = gr; c.fillRect(x - R, y - R, R * 2, R * 2);
    c.globalCompositeOperation = "lighter";
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = t * (1.2 + i * 0.15) + i * 1.3;
      c.strokeStyle = `rgba(220,170,255,${0.35 - i * 0.05})`;
      c.beginPath();
      for (let u = 0; u <= 1; u += 0.08) { const rr = R * 0.9 * (1 - u), aa = a + u * 4; const px = x + Math.cos(aa) * rr, py = y + Math.sin(aa) * rr * 1.1; u ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  }

  // Above the darkness: crystal and portal glows, the rune ring's bloom, rising motes, a breath of mist.
  Sp.drawGlow = function (c, t, view) {
    if (!sees(view) || !art) return;
    const glow = (x, y, r, a) => { c.globalAlpha = a; c.drawImage(art.glow, x - r, y - r, r * 2, r * 2); };
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (x < view.left - 200 || x > view.right + 200 || y < view.top - 100 || y > view.bottom + 300) continue;
      const tw = 0.8 + 0.2 * Math.sin(t * 2 + q[1]);
      if (q[0] === "crystal") glow(x, y - 30 * q[3], 46 * q[3], 0.55 * tw);
      else if (q[0] === "post") glow(x, y - 66, 28, 0.6 * tw);
      else if (q[0] === "spire") glow(x, y - 136, 34, 0.7 * tw);
      else if (q[0] === "arch") glow(x, y - 90 * q[3], 110 * q[3], 0.35 * tw);
      else if (q[0] === "ring") glow(x, y - 124, 140, 0.4 * tw);
    }
    for (const q of PILLARS) glow(OX + q[0], OY + q[1] - 14, 24, 0.35);
    const fl = G.spires ? G.spires.flare : 0;
    glow(OX + RUNE.x, OY + RUNE.y, 190, 0.18 + 0.12 * Math.sin(t * 1.7) + 0.5 * fl);
    glow(OX + (FALL.x0 + FALL.x1) / 2, OY + FALL.y + 60, 110, 0.35);
    c.globalAlpha = 1;
    for (const m of art.motes) {
      const life = ((t + m.p) % 6) / 6, x = OX + m.x + Math.sin(t + m.p) * 10, y = OY + m.y - life * m.v * 6;
      if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
      c.fillStyle = `rgba(220,190,255,${0.7 * Math.sin(Math.PI * life)})`;
      c.fillRect(x, y, 2, 2);
    }
    c.globalCompositeOperation = "source-over";
    drawMist(c, view, t * 0.6, 0.16);
    c.globalCompositeOperation = "lighter";
  };

  // Crystal and portal light (only those near the knight, so the light pass stays cheap).
  Sp.lights = function (L) {
    const p = G.player;
    if (!p || !G.spires) return;
    const near = (x, y) => Math.abs(x - p.x) < 900 && Math.abs(y - p.y) < 700;
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (!near(x, y)) continue;
      const big = q[0] === "arch" || q[0] === "ring";
      L.push({ x, y: y - (big ? 90 : 40), r: big ? 170 : q[0] === "crystal" ? 80 * q[3] : 70, s: big ? 0.8 : 0.6, col: GLOW, a: 0.8 });
    }
    if (near(OX + RUNE.x, OY + RUNE.y)) L.push({ x: OX + RUNE.x, y: OY + RUNE.y, r: 200, s: 0.5 + 0.4 * (G.spires.flare || 0), col: GLOW, a: 0.6 });
    if (near(OX + FALL.x0, OY + FALL.y)) L.push({ x: OX + (FALL.x0 + FALL.x1) / 2, y: OY + FALL.y + 40, r: 140, s: 0.6, col: GLOW, a: 0.7 });
  };
})(window.DL);
