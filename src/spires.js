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
   them; the small arch on the south platform takes you home. Every fighting floor is a room (ROOMS): step onto it and rune
   light seals its ways out while its Spire Sentinels (crystal turrets, src/bullets.js) and Drowned rise; clear it and it opens.
   Drowned route over stairs and bridges (Spires.route).
   A run (step 6, src/rift.js): you come in through the open Drowned Gate or the camp's Rift Portal (or the Sandbox pause
   menu). Foes, won rooms and the chests in the three side rooms give Rift Shards; walk out and half of them, and of your
   unburnt Aether Crystals, come home; fall and the mist keeps it all. The world clock stops while you're here.
   Co-op (step 9): the host runs the run. Every knight is pulled in and sent home with the host's; the host's device
   seals rooms, lights Wells, opens chests and picks up Aether Crystals for any knight who walks there, and sends the
   run's state in each snapshot (Sp.snap). A guest's device moves its own knight through the portals, keeps it in a
   sealed room it stood in, dodges the bullets itself, and asks the host (Net events) to burn a crystal or leave.
   The party shares one bag. A guest who falls rises at the run's checkpoint; if the host falls, the run is lost.
   Numbers: DL.SPIRES (src/data.js). */
"use strict";
(function (DL) {
  const G = DL.Game, S = DL.SPIRES;
  const OX = S.x, OY = S.y, LH = S.lh;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const all = (m, k) => { say(m, k); if (DL.Net) DL.Net.say(m, k); }; // the host's news, on every friend's screen in the run too
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
    // Lower Causeways (south-west, low and wide)
    cw1: [-1500, 420, -1120, 660, 0],
    cw2: [-2200, 340, -1780, 700, 0],
    cw3: [-2150, 940, -1500, 1180, 0],
    // Crystal Terraces (east)
    ct1: [1100, -20, 1560, 330, 1],
    ct2: [1060, -560, 1700, -230, 2],
    ct3: [1900, -500, 2260, -140, 2],
    // High Spires (north)
    north: [-260, -760, 260, -520, 3],
    high: [-460, -1460, 460, -1000, 4],
    hw: [-1100, -1300, -700, -1020, 4],
    he: [700, -1340, 1100, -1060, 4],
    // the Rift Throne's round arena at the top (oval: the box is its bounds)
    arena: [-560, -2420, 560, -1580, 5, "oval"],
    // side rooms (step 6): off the misty wings, a harder fight and a chest
    sd1: [-1800, 1300, -1440, 1500, 0],
    sd2: [2440, -460, 2760, -200, 2],
    sd3: [-1660, -1320, -1320, -1060, 4],
  };
  // stairs rising one level going north: x0, y0 (top), x1, y1 (foot), level at the foot
  const STAIRS = {
    s1: [-55, -212, 55, 2, 1],
    s2: [-715, -452, -615, -288, 2],
    s3: [605, -492, 715, -288, 2],
    s4: [1280, -242, 1390, -8, 1],
    s5: [-50, -532, 50, -288, 2],
    s6: [-55, -1012, 55, -748, 3],
    s7: [-60, -1592, 60, -1448, 4],
  };
  // rope bridges: x1, y1, x2, y2, half width
  const BRIDGES = {
    b1: [195, 175, 485, 150, 26],
    b2: [-195, 250, -560, 470, 26],
    b3: [-820, 540, -1120, 540, 26],
    b4: [-1500, 540, -1780, 520, 26],
    b5: [-1990, 700, -1900, 940, 26],
    b6: [800, 170, 1100, 160, 26],
    b7: [1700, -320, 1900, -320, 26],
    b8: [-460, -1160, -700, -1160, 26],
    b9: [460, -1200, 700, -1200, 26],
    b10: [-1620, 1180, -1620, 1300, 26],
    b11: [2260, -330, 2440, -330, 26],
    b12: [-1100, -1190, -1320, -1190, 26],
  };
  // where two pieces meet: [a, b, x, y] (the Drowned route through these)
  const JOINS = [
    ["plaza", "s1", 0, -4], ["s1", "walk", 0, -206], ["walk", "s2", -665, -294], ["s2", "west", -665, -446],
    ["walk", "s3", 660, -294], ["s3", "east", 660, -486], ["plaza", "b1", 203, 173], ["b1", "terrace", 478, 151],
    ["plaza", "b2", -203, 252], ["b2", "south", -552, 465],
    ["south", "b3", -812, 540], ["b3", "cw1", -1112, 540], ["cw1", "b4", -1492, 540], ["b4", "cw2", -1772, 521],
    ["cw2", "b5", -1988, 692], ["b5", "cw3", -1902, 932],
    ["terrace", "b6", 792, 170], ["b6", "ct1", 1108, 160], ["ct1", "s4", 1335, -12], ["s4", "ct2", 1335, -238],
    ["ct2", "b7", 1692, -320], ["b7", "ct3", 1908, -320],
    ["walk", "s5", 0, -292], ["s5", "north", 0, -528], ["north", "s6", 0, -752], ["s6", "high", 0, -1008],
    ["high", "b8", -452, -1160], ["b8", "hw", -708, -1160], ["high", "b9", 452, -1200], ["b9", "he", 708, -1200],
    ["high", "s7", 0, -1452], ["s7", "arena", 0, -1586],
    ["cw3", "b10", -1620, 1172], ["b10", "sd1", -1620, 1308], ["ct3", "b11", 2252, -330], ["b11", "sd2", 2448, -330],
    ["hw", "b12", -1108, -1190], ["b12", "sd3", -1312, -1190],
  ];
  const RUNE = { x: 0, y: 160, r: 150, sq: 0.78 }; // the rune circle on the plaza (squashed by sq: it lies on the floor)
  const ARCH_W = { x: -730, y: -640 }, RING_E = { x: 690, y: -700 }, ARCH_S = { x: -680, y: 455 };
  const ARCH_T = { x: -330, y: -1700 }; // in the throne arena: straight back to the rune hub
  const THRONE = { x: 0, y: -2300 };
  const THRONE_K = 1.2; // the throne is drawn this much bigger than its file's half size: its lord is three knights tall
  // where the Lord of the Rift Throne sits (src/riftthrone.js): in front of the throne, lifted onto its seat
  const SEAT = { dy: 46, lift: 70 };
  // Mist Wells: dark until a knight stands at one, then lit (a landmark per district for now; step 4 gives them their job)
  const WELLS = [[-1820, 1090], [2080, -260], [-900, -1110], [900, -1150], [-1990, 450]];
  // things that stand up: drawn y-sorted with the knights. kind, x, y, (size)
  const PROPS = [
    ["arch", ARCH_W.x, ARCH_W.y, 1], ["ring", RING_E.x, RING_E.y], ["arch", ARCH_S.x, ARCH_S.y, 0.8],
    ["banner", -592, 470], ["post", -188, 8], ["post", 188, 8], ["post", -188, 312], ["post", 188, 312],
    ["spire", -480, -292], ["spire", -240, -292], ["spire", 240, -292], ["spire", 480, -292],
    ["post", -880, -458], ["post", -580, -458], ["post", 540, -500], ["post", 840, -500],
    ["crystal", 742, 262, 1.5, 0], ["crystal", 700, 276, 0.8, 2], ["crystal", 770, 232, 0.9, 1],
    ["crystal", -870, -680, 1, 1], ["crystal", 840, -740, 1.1, 0], ["crystal", -800, 622, 1.1, 2], ["crystal", -566, 628, 0.8, 0],
    ["crystal", 500, 60, 0.7, 1], ["crystal", -130, -280, 0.7, 2], ["crystal", 300, -228, 0.6, 0],
    ["arch", ARCH_T.x, ARCH_T.y, 0.8], ["throne", THRONE.x, THRONE.y],
    ...WELLS.map(([x, y], i) => ["well", x, y, i]),
    // causeways
    ["post", -1480, 438], ["post", -1140, 438], ["post", -2180, 358], ["post", -1800, 358], ["banner", -1520, 1150],
    ["crystal", -2120, 680, 1.2, 0], ["crystal", -1560, 1160, 1, 1], ["crystal", -2130, 960, 0.8, 2], ["crystal", -1150, 640, 0.7, 1],
    // terraces: crystals everywhere
    ["crystal", 1130, 300, 1.3, 0], ["crystal", 1530, 10, 1, 2], ["crystal", 1090, -540, 1.1, 1], ["crystal", 1680, -250, 0.9, 0],
    ["crystal", 2230, -480, 1.4, 0], ["crystal", 1930, -160, 1, 2], ["crystal", 1500, 300, 0.8, 1], ["post", 1080, -248], ["post", 1680, -248],
    // high spires: a row of spires
    ["spire", -440, -1018], ["spire", -220, -1018], ["spire", 220, -1018], ["spire", 440, -1018],
    ["spire", -240, -538], ["spire", 240, -538], ["post", -1080, -1040], ["post", -720, -1040], ["post", 720, -1080], ["post", 1080, -1080],
    ["crystal", -1080, -1280, 1.1, 0], ["crystal", 1080, -1320, 1.1, 0],
    // the arena: crystals round its rim
    ["crystal", -470, -2000, 1.2, 0], ["crystal", 470, -2000, 1.2, 0], ["crystal", -330, -2290, 1, 1], ["crystal", 330, -2290, 1, 1],
  ];
  // solid circles: x, y, r
  const SOLIDS = [
    [ARCH_W.x - 60, ARCH_W.y, 18], [ARCH_W.x + 60, ARCH_W.y, 18], [RING_E.x - 72, RING_E.y, 18], [RING_E.x + 72, RING_E.y, 18],
    [ARCH_S.x - 48, ARCH_S.y, 15], [ARCH_S.x + 48, ARCH_S.y, 15],
    [-188, 8, 11], [188, 8, 11], [-188, 312, 11], [188, 312, 11], [-880, -458, 11], [-580, -458, 11], [540, -500, 11], [840, -500, 11],
    [-480, -292, 11], [-240, -292, 11], [240, -292, 11], [480, -292, 11], [742, 262, 22], [-870, -680, 12], [840, -740, 12], [-800, 622, 12],
    [ARCH_T.x - 48, ARCH_T.y, 15], [ARCH_T.x + 48, ARCH_T.y, 15], [THRONE.x, THRONE.y - 40, 110], ...WELLS.map(([x, y]) => [x, y - 10, 40]),
    [-440, -1018, 11], [-220, -1018, 11], [220, -1018, 11], [440, -1018, 11], [-240, -538, 11], [240, -538, 11],
    [1130, 300, 16], [2230, -480, 16], [-2120, 680, 14],
  ];
  // stone columns standing up out of the mist (not walkable): x, y, width, level
  const PILLARS = [
    [-420, -80, 64, 1], [330, -100, 56, 1], [-400, 560, 76, 0], [300, 540, 64, 1], [1000, -220, 84, 2], [980, 430, 70, 1],
    [-1060, -160, 76, 2], [-60, 700, 60, 0], [640, 650, 80, 0], [-300, -640, 58, 3], [170, -650, 66, 3], [-1080, 360, 66, 1],
    [1060, -660, 56, 3], [-1080, -700, 56, 3], [1100, 120, 50, 1], [-200, 470, 44, 0], [420, -560, 48, 3],
    [-1300, 900, 70, 0], [-2400, 800, 60, 0], [-1000, 1150, 64, 0], [-2500, 200, 70, 1], [1300, 600, 70, 0], [1900, 300, 66, 1],
    [2400, -800, 60, 2], [1500, -900, 70, 3], [-1500, -600, 70, 2], [-1500, -1500, 66, 4], [1400, -1600, 70, 4], [-900, -1900, 76, 4],
    [900, -1950, 76, 4], [-800, -2500, 60, 5], [800, -2450, 60, 5], [0, -2600, 70, 5], [-2000, -200, 60, 1], [2500, 0, 56, 1],
  ].filter((q) => !Object.values(FLOORS).some((f) => q[0] + q[2] > f[0] - 30 && q[0] - q[2] < f[2] + 30 && q[1] + q[2] > f[1] - 30 && q[1] - q[2] < f[3] + 260));
  const FALL = { x0: 690, x1: 760, y: 300, len: 300 }; // the stream of violet light pouring off the terrace
  const SPAWN = { x: 0, y: 290 };

  /* ---------------- where you can stand ---------------- */
  Sp.inRegion = (x, y) => Math.abs(x - OX) < S.halfW && Math.abs(y - OY) < S.halfH;
  Sp.active = () => !!G.spires;
  const inRect = (x, y, q, m) => {
    if (q[5] === "oval") { const rx = (q[2] - q[0]) / 2 - m, ry = (q[3] - q[1]) / 2 - m; return ((x - q[0] - rx - m) / rx) ** 2 + ((y - q[1] - ry - m) / ry) ** 2 < 1; }
    return x > q[0] + m && x < q[2] - m && y > q[1] + m && y < q[3] - m;
  };
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
  // somewhere this walker may stand (a room's foe only on its room's floor): a Chain Leaper picks its landing with this
  Sp.canStand = (ent, x, y, m = 16) => {
    const hold = heldIn(ent);
    return hold ? inRect(x - OX, y - OY, hold, m) : Sp.walkable(x, y, m);
  };

  // Keep a walker on the stone: back to where it last stood (sliding along the edge if it can).
  Sp.collide = function (ent, r) {
    if (!Sp.inRegion(ent.x, ent.y)) return;
    for (const s of SOLIDS) {
      const dx = ent.x - OX - s[0], dy = ent.y - OY - s[1], d = Math.hypot(dx, dy), min = s[2] + r;
      if (d < min && d > 0.01) { ent.x = OX + s[0] + (dx / d) * min; ent.y = OY + s[1] + (dy / d) * min; }
    }
    const m = Math.min(8, r * 0.6), hold = heldIn(ent);
    if (hold ? !inRect(ent.x - OX, ent.y - OY, hold, m) : !Sp.walkable(ent.x, ent.y, m)) {
      const lx = ent.spx, ly = ent.spy;
      if (lx == null || !Sp.inRegion(lx, ly)) { if (ent === G.player) { ent.x = OX + SPAWN.x; ent.y = OY + SPAWN.y; } }
      else if (hold ? inRect(ent.x - OX, ly - OY, hold, m) : Sp.walkable(ent.x, ly, m)) ent.y = ly;
      else if (hold ? inRect(lx - OX, ent.y - OY, hold, m) : Sp.walkable(lx, ent.y, m)) ent.x = lx;
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
    const saved = wellsSave();
    G.spires = { bx: p.x, by: p.y, inPortal: true, flare: 0, seal: null, cleared: {}, lit: {}, litT: {}, away: {}, took: {}, aether: 0, shard: 0, opened: {}, bubbles: [] };
    for (const i in saved) if (saved[i]) { G.spires.lit[i] = true; G.spires.litT[i] = -99; if (WELL_ROOM[i]) G.spires.cleared[WELL_ROOM[i]] = true; }
    const at = saved.at != null && WELLS[saved.at] ? { x: WELLS[saved.at][0], y: WELLS[saved.at][1] + 60 } : SPAWN; // the last Well lit: a checkpoint
    p.x = OX + at.x; p.y = OY + at.y; p.spx = p.x; p.spy = p.y;
    p.kx = p.ky = 0; p.dashT = 0; p.angle = -Math.PI / 2;
    for (const a of G.allies) pull(a);
    for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); f.spx = null; }
    G.camera.x = p.x; G.camera.y = p.y - 20;
    if (G.allies.length) DL.Net.say("Your host steps through, and the mist takes you with them: the Abyssal Spires.", "good");
    say(at === SPAWN ? "The Abyssal Spires. Causeways south-west, crystal terraces east, the high spires north and the throne at the top."
      : "Back at your Mist Well. Stand at a lit Well a moment to go home.", "good");
  };
  // where a run starts: the last Well lit, or the rune plaza (world px)
  function checkpoint() {
    const at = wellsSave().at;
    return at != null && WELLS[at] ? { x: OX + WELLS[at][0], y: OY + WELLS[at][1] + 60 } : { x: OX + SPAWN.x, y: OY + SPAWN.y };
  }
  Sp.checkpoint = () => (G.spires && G.spires.cp ? G.spires.cp : checkpoint());
  // Host: bring a friend's knight in beside yours (their device moves it; the host's copy goes now so the Drowned see it)
  function pull(a) {
    const p = G.player, x = p.x + 34 * a.id * (a.id % 2 ? 1 : -1) / 2, y = p.y + 16;
    a.x = a.tx = x; a.y = a.ty = y;
    DL.Net.sendTo(a.id, { t: "spires", on: 1, x, y, cp: [Math.round(p.x), Math.round(p.y)] });
  }
  // Host: a friend who joins while the run is on comes straight in
  Sp.join = (a) => { if (G.spires && !G.spires.guest) pull(a); };
  // what this run has found so far: Rift Shards and unburnt Aether Crystals
  Sp.bag = () => (G.spires ? { shard: G.spires.shard, aether: G.spires.aether } : null);
  // a foe of a room broken: Rift Shards (kill in src/game.js)
  Sp.onKill = function (e) {
    const sp = G.spires, n = sp && e.room ? DL.SPIRES.loot.kill[e.def.spire || e.type] || 0 : 0;
    if (!n) return;
    sp.shard += n;
    G.texts.push({ x: e.x, y: e.y - 50, txt: `+${n} Rift Shard${n > 1 ? "s" : ""}`, col: "#d6a8ff", t: 0, max: 1, scale: 0.9 });
  };
  // Out of the Spires. Walking out (the exit arch, a lit Well) you keep DL.SPIRES.loot.keep of what you carry;
  // `all` brings everything home (the boss, step 7). Falling never comes here: the mist keeps it all (die in game.js).
  Sp.leave = function (all) {
    const sp = G.spires, p = G.player;
    if (!sp) return;
    G.spires = null;
    const k = all ? 1 : DL.SPIRES.loot.keep, got = { shard: Math.floor(sp.shard * k), aether: Math.floor(sp.aether * k) };
    const home = DL.Rift.bringHome(got);
    DL.Bullets.clear();
    DL.SpireFoes.clear();
    for (const e of G.enemies) if (Sp.inRegion(e.x, e.y)) e.removed = true;
    G.enemies = G.enemies.filter((e) => !e.removed);
    if (p) {
      p.x = sp.bx; p.y = sp.by; p.kx = p.ky = 0; p.dashT = 0;
      if (Sp.inRegion(p.x, p.y)) { p.x = 0; p.y = 70; }
      for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); }
      G.camera.x = p.x; G.camera.y = p.y - 20;
    }
    const msg = home ? `You step back out of the mist with ${home}${all ? "" : " (half of what you carried: the mist keeps the rest)"}.` : "You step back out of the mist.";
    sendHome(msg, "good");
    say(msg, "good");
  };
  // Host: every friend back out beside the host's knight (or lost with the run: the host fell)
  function sendHome(msg, kind) {
    const p = G.player, x0 = p && !Sp.inRegion(p.x, p.y) ? p.x : 0, y0 = p && !Sp.inRegion(p.x, p.y) ? p.y : 70;
    for (const a of G.allies) {
      const x = x0 + 34 * a.id * (a.id % 2 ? 1 : -1) / 2, y = y0 + 12;
      a.x = a.tx = x; a.y = a.ty = y;
      DL.Net.sendTo(a.id, { t: "spires", on: 0, x, y, m: msg, k: kind });
    }
  }
  // Host: the host fell in a run (die in game.js): the mist keeps the bag, and the friends are cast out with them
  Sp.lost = function () {
    if (!G.spires || !G.allies.length) return;
    sendHome("Your host has fallen in the mist. The run is lost, and everything it found with it.", "danger");
  };

  /* ---------------- co-op ---------------- */
  const keys = (o) => Object.keys(o).filter((k) => o[k]);
  const flags = (list) => { const o = {}; for (const k of list || []) o[k] = true; return o; };
  // Host: the run's state for each snapshot (bubbles as world points: a guest can't follow a knight it doesn't run)
  Sp.snap = function (near) {
    const sp = G.spires;
    if (!sp) return 0;
    return [sp.seal, Math.round(sp.sealT * 10) / 10 || 0, keys(sp.cleared), keys(sp.lit), keys(sp.took), keys(sp.opened), sp.won ? 1 : 0,
      Math.round(sp.flare * 100) / 100, bubbles().slice(0, sp.bubbles.length).map((b, i) => [Math.round(b.x), Math.round(b.y), sp.bubbles[i].r, Math.round(sp.bubbles[i].t * 10) / 10, sp.bubbles[i].max]),
      sp.shard, sp.aether, DL.Bullets.rows(near)];
  };
  // Guest: the host's run, from a snapshot
  Sp.applySnap = function (s) {
    const sp = G.spires;
    if (!s) { if (sp && sp.guest && !sp.fresh) { G.spires = null; DL.Bullets.clear(); } return; }
    if (!sp || !sp.guest) return; // the "in" message comes first
    sp.fresh = false;
    const p = G.player;
    if (s[0] !== sp.seal) { sp.held = !!(s[0] && p && inRect(p.x - OX, p.y - OY, FLOORS[s[0]], 34)); sp.seal = s[0]; } // held only if it sealed round you
    sp.sealT = s[1];
    sp.cleared = flags(s[2]);
    for (const i of s[3]) if (!sp.lit[i]) { sp.lit[i] = true; sp.litT[i] = G.t; }
    if (s[6] && !sp.won) DL.RiftThrone.guestWon(); // he fell with us in the arena
    sp.took = flags(s[4]); sp.opened = flags(s[5]); sp.won = !!s[6]; sp.flare = s[7];
    sp.bubbles = s[8].map((b) => ({ x: b[0], y: b[1], r: b[2], t: b[3], max: b[4] }));
    sp.shard = s[9]; sp.aether = s[10];
    DL.Bullets.apply(s[11]);
  };
  // Guest: the host took us in, or sent us home
  Sp.guestMsg = function (m) {
    const p = G.player;
    if (m.on) {
      if (G.state === "camp") DL.UI.closeCamp();
      G.spires = { guest: true, fresh: true, inPortal: true, flare: 0, seal: null, held: false, sealT: 0, cleared: {}, lit: {}, litT: {}, away: {}, took: {}, aether: 0, shard: 0, opened: {}, bubbles: [],
        cp: m.cp ? { x: m.cp[0], y: m.cp[1] + 12 } : null };
      // the Wells already lit are lit from the start: no fade
      G.enemies = []; G.projectiles = [];
      DL.Bullets.clear();
      p.downT = 0;
    } else {
      G.spires = null;
      DL.Bullets.clear();
      G.enemies = [];
      if (p.downT > 0) { p.downT = 0; p.hp = Math.max(1, G.stats().maxHp * 0.5); }
      if (m.m) say(m.m, m.k);
    }
    p.x = m.x; p.y = m.y; p.spx = p.x; p.spy = p.y; p.kx = p.ky = 0; p.dashT = 0; p.inv = 1.5;
    G.camera.x = p.x; G.camera.y = p.y - 20;
  };

  /* ---------------- rooms (step 2 of the Level 2 plan) ----------------
     A room is one floor. Step onto it and its ways out seal with rune light; its foes climb out of the mist (Sentinels
     stand up where they're listed); break them all and the light fades. heat 0..1 sets how dense the Sentinels' patterns
     are: gentle by the hub, dense deep in (Robert, 2026-11-05). The hub, the portal ledges and the exit ledge have no fight.
     Step on the rune circle's heart (no room sealed) to wake every cleared room again: it's a test room. */
  // floor, heat, Sentinels [[x, y]], other foes [[type, n]]
  const ROOMS = {
    // Chain Leapers and Bridge Bowmen (src/spirefoes.js) on the causeways and beyond; a few Drowned for blades
    // Mist Shades in the misty rooms, Rift Callers on the high ground, a Prism Knight to hold the deep rooms
    terrace: { heat: 0, sent: [[640, 150]], foes: [["leaper", 1]] },
    walk: { heat: 0.2, sent: [[-300, -250], [300, -250]], foes: [["bowman", 1]] },
    cw1: { heat: 0.15, sent: [[-1310, 540]], foes: [["leaper", 2]] },
    cw2: { heat: 0.3, sent: [[-1990, 520]], foes: [["leaper", 1], ["bowman", 1], ["shade", 1]] },
    cw3: { heat: 0.45, sent: [[-1660, 1040]], foes: [["leaper", 2], ["shade", 2]] },
    ct1: { heat: 0.3, sent: [[1330, 130]], foes: [["bowman", 1], ["footman", 1]] },
    ct2: { heat: 0.5, sent: [[1380, -400]], foes: [["bowman", 1], ["caller", 1]] },
    ct3: { heat: 0.65, sent: [[2080, -380]], foes: [["leaper", 1], ["shade", 2], ["prism", 1]] },
    north: { heat: 0.5, sent: [], foes: [["bowman", 1], ["leaper", 1], ["caller", 1]] },
    high: { heat: 0.75, sent: [[-300, -1240], [300, -1240]], foes: [["bowman", 1], ["leaper", 1], ["prism", 1], ["caller", 1]] },
    hw: { heat: 0.85, sent: [[-900, -1220]], foes: [["shade", 2], ["leaper", 1]] },
    he: { heat: 0.85, sent: [[900, -1250]], foes: [["shade", 1], ["bowman", 1], ["prism", 1]] },
    arena: { heat: 1, sent: [], foes: [], boss: true }, // the Lord of the Rift Throne and his minions (src/riftthrone.js)
    // side rooms: a harder fight for a chest of Rift Shards (opened once a run, after the room is won)
    sd1: { heat: 0.7, sent: [[-1700, 1360]], foes: [["leaper", 2], ["shade", 2], ["bowman", 1]], chest: [-1560, 1420] },
    sd2: { heat: 0.9, sent: [[2600, -400]], foes: [["prism", 1], ["shade", 2], ["caller", 1]], chest: [2680, -260] },
    sd3: { heat: 1, sent: [[-1580, -1270], [-1400, -1270]], foes: [["prism", 1], ["caller", 1], ["leaper", 2]], chest: [-1490, -1120] },
  };
  Sp.ROOMS = ROOMS;
  // each room's ways out: where its floor meets a stair or bridge, and which way the rune curtain lies across it
  const GATES = {};
  for (const j of JOINS) for (const [a, b] of [[j[0], j[1]], [j[1], j[0]]]) {
    if (!ROOMS[a]) continue;
    let w, ang;
    if (STAIRS[b]) { const q = STAIRS[b]; w = q[2] - q[0] + 10; ang = 0; }
    else { const q = BRIDGES[b]; w = q[4] * 2 + 12; ang = Math.atan2(q[3] - q[1], q[2] - q[0]) + Math.PI / 2; }
    (GATES[a] = GATES[a] || []).push({ x: j[2], y: j[3], w, ang });
  }
  /* ---------------- the Hollow Mist (step 4) ----------------
     Thick violet mist sits round each Mist Well and the way in to it. It hides what's inside (foes, bullets, the floor),
     corruption builds while you stand in it (your lantern halves that), and it hides you too: foes farther than
     DL.SPIRES.mist.see lose you (mist-walking), and your first blow on a foe from inside it lands harder.
     Aether Crystals grow only in the mist: walk into one to take it, then burn it (the torch button) for a bubble of
     light round you that clears the mist and the corruption for a while. Light a patch's Mist Well and it clears for
     good: its room stays won, and the Well becomes a checkpoint (the next visit starts there, and standing at it a
     moment after walking away takes you home). Lit Wells are saved (G.save.spiresWells). */
  // x, y, rx, ry (an ellipse, local), the Well that clears it
  const MIST = [
    { x: -1830, y: 1010, rx: 430, ry: 250, well: 0 }, // the far causeway and the bridge down to it
    { x: 1990, y: -320, rx: 360, ry: 250, well: 1 }, // the far crystal terrace
    { x: -850, y: -1170, rx: 340, ry: 230, well: 2 }, // the west wing of the high spires
    { x: 870, y: -1200, rx: 340, ry: 240, well: 3 }, // the east wing
    { x: -1990, y: 520, rx: 300, ry: 250, well: 4 }, // the second causeway
  ];
  // Aether Crystals: where they grow (local), in the mist
  const AETHER = [[-2080, 1100], [-1560, 1080], [-1940, 820], [2200, -420], [1950, -180], [-1040, -1260], [-760, -1050],
    [1030, -1300], [760, -1100], [-2120, 400], [-1860, 640]];
  Sp.MIST = MIST;
  Sp.WELLS_N = WELLS.length;
  const wellsSave = () => (G.save.spiresWells = G.save.spiresWells || {});
  // the room a Well stands in
  const WELL_ROOM = WELLS.map(([x, y]) => Object.keys(ROOMS).find((k) => inRect(x, y, FLOORS[k], 0)) || null);
  // in a patch of unlit mist (local px; k < 1 is how far in: 0.85 = the thick of it)
  function mistAt(lx, ly, k = 0.85) {
    const sp = G.spires;
    if (!sp) return null;
    for (const m of MIST) if (!sp.lit[m.well] && ((lx - m.x) / m.rx) ** 2 + ((ly - m.y) / m.ry) ** 2 < k * k) return m;
    return null;
  }
  // the bubbles of light that clear the mist: a burning Aether Crystal, torches
  function bubbles() {
    const sp = G.spires, out = [];
    if (!sp) return out;
    for (const b of sp.bubbles) {
      const k = b.follow === true ? G.player : b.follow ? G.allies.find((a) => a.id === b.follow) : null; // a friend's crystal follows their knight
      out.push({ x: k ? k.x : b.x, y: k ? k.y : b.y, r: b.r * Math.min(1, b.t / 1.5, (b.max - b.t + 0.3) / 0.6) });
    }
    for (const t of G.torches) if (Sp.inRegion(t.x, t.y)) out.push({ x: t.x, y: t.y, r: DL.SPIRES.mist.torch });
    return out;
  }
  const lit = (x, y) => bubbles().some((b) => Math.hypot(x - b.x, y - b.y) < b.r * 0.85);
  Sp.lightAt = lit; // a burning Aether Crystal or a torch here: a Mist Shade can't fade in it
  Sp.floorOf = (id) => FLOORS[id];
  // standing in thick mist, no light round you
  Sp.misty = (x, y) => !!G.spires && !!mistAt(x - OX, y - OY) && !lit(x, y);
  // the knight is lost to this foe: they're in the mist and it's not close
  Sp.hidden = (p, e) => !!G.spires && Sp.misty(p.x, p.y) && Math.hypot(p.x - e.x, p.y - e.y) > DL.SPIRES.mist.see;
  // corruption per second in the Spires (0 out of the mist): updateCorruption in game.js
  const lanternLv = () => Math.min(3, (G.save.up && G.save.up.mistlantern) || 0);
  Sp.corruption = (p) => (Sp.misty(p.x, p.y) ? DL.SPIRES.mist.corrupt * DL.RIFT.lantern.corrupt[lanternLv()] : 0); // the Mist Lantern (src/rift.js) slows it
  Sp.lanternR = () => (lanternLv() ? DL.RIFT.lantern.ring[lanternLv()] : DL.SPIRES.mist.lantern);
  // burn a carried Aether Crystal (the torch button in the Spires): false if none
  Sp.burn = function (who) {
    const sp = G.spires, M = DL.SPIRES.mist;
    if (!sp || !sp.aether) return false;
    sp.aether--;
    if (sp.guest) DL.Net.event({ t: "spBurn" }); // the bag is the host's: it burns one there, round us
    else sp.bubbles.push({ follow: who ? who.id : true, r: M.bubble, t: M.burn, max: M.burn });
    if (who) { DL.Net.say(`The ${who.label} burns an Aether Crystal: the mist draws back.`, "good"); return true; }
    for (let i = 0; i < 20; i++) G.puff(G.player.x + DL.rand(-20, 20), G.player.y - DL.rand(0, 50), "rgba(230,200,255,0.8)", 90, 0.9);
    DL.Sound.play("torch");
    if (sp.guest && !sp.bubbles.length) sp.bubbles.push({ x: G.player.x, y: G.player.y, r: M.bubble, t: M.burn, max: M.burn }); // till the host's answer
    say(`The Aether Crystal burns: the mist draws back from you.${sp.aether ? ` (${sp.aether} left)` : ""}`, "good");
    return true;
  };
  function mistUpdate(sp, p, dt) {
    for (const b of sp.bubbles) b.t -= dt;
    sp.bubbles = sp.bubbles.filter((b) => b.t > 0);
    if (sp.guest) return guestHome(sp, p, dt);
    const lx = p.x - OX, ly = p.y - OY;
    AETHER.forEach(([x, y], i) => {
      if (sp.took[i] || !mistAt(x, y, 1) || !party().some((k) => Math.hypot(k.x - OX - x, k.y - OY - y) < 26)) return;
      sp.took[i] = true; sp.aether++;
      for (let k = 0; k < 14; k++) G.puff(OX + x + DL.rand(-10, 10), OY + y - DL.rand(0, 30), "rgba(220,170,255,0.9)", 70, 0.7);
      DL.Sound.play("chime");
      all(`An Aether Crystal (${sp.aether}). Burn it with the torch button for light in the mist.`, "good");
    });
    const m = mistAt(lx, ly);
    if (m && !sp.warned) { sp.warned = true; say("Thick mist: it hides you, and them. Corruption builds in here.", "danger"); }
    // a lit Well, walked away from and come back to: stand at it a moment to go home
    WELLS.forEach(([x, y], i) => {
      if (!sp.lit[i]) return;
      const d = Math.hypot(lx - x, ly - y - 50);
      if (d > 140) sp.away[i] = true;
      if (sp.away[i] && d < 46 && !sp.seal) {
        sp.homeT = (sp.homeT || 0) + dt;
        if (sp.homeT > DL.SPIRES.mist.home) { sp.homeT = 0; Sp.leave(); }
      } else if (d < 46) sp.homeT = 0;
    });
  }
  // the knights on their feet in the run (the host's and the friends' copies)
  const party = () => [...(G.player && !(G.player.downT > 0) ? [G.player] : []), ...G.allies.filter((a) => !a.down)];
  // Guest: standing a moment at a lit Well, as on the host: ask the host to take everyone home
  function guestHome(sp, p, dt) {
    const lx = p.x - OX, ly = p.y - OY;
    WELLS.forEach(([x, y], i) => {
      if (!sp.lit[i]) return;
      const d = Math.hypot(lx - x, ly - y - 50);
      if (d > 140) sp.away[i] = true;
      if (sp.away[i] && d < 46 && !sp.seal) {
        sp.homeT = (sp.homeT || 0) + dt;
        if (sp.homeT > DL.SPIRES.mist.home) { sp.homeT = -99; DL.Net.event({ t: "spLeave", all: 0 }); }
      } else if (d < 46 && sp.homeT > 0) sp.homeT = 0;
    });
  }
  let fog = null; // one small canvas, reused for every patch
  function drawFog(c, view, t) {
    const sp = G.spires;
    if (!sp) return;
    const p = G.player, holes = bubbles(), K = 0.25; // a quarter-size canvas, scaled up: soft and cheap
    if (p && Sp.inRegion(p.x, p.y)) holes.push({ x: p.x, y: p.y - 20, r: p.oil > 0 ? Sp.lanternR() : Sp.lanternR() * 0.6 });
    for (const m of MIST) {
      const k = sp.lit[m.well] ? Math.max(0, 1 - (G.t - (sp.litT[m.well] || -9)) / 2.5) : 1; // a lit Well's mist fades away
      if (k <= 0) continue;
      const x0 = OX + m.x - m.rx * 1.15, y0 = OY + m.y - m.ry * 1.15, w = m.rx * 2.3, h = m.ry * 2.3;
      if (x0 > view.right || x0 + w < view.left || y0 > view.bottom || y0 + h < view.top) continue;
      const fw = Math.ceil(w * K), fh = Math.ceil(h * K);
      if (!fog) fog = document.createElement("canvas");
      if (fog.width < fw || fog.height < fh) { fog.width = Math.max(fog.width, fw); fog.height = Math.max(fog.height, fh); }
      const g = fog.getContext("2d");
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, fog.width, fog.height);
      g.save(); g.scale(K, K); g.translate(-x0, -y0);
      // the body of the mist: thick in the middle, thinning to its rim
      g.save(); g.translate(OX + m.x, OY + m.y); g.scale(1, m.ry / m.rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, m.rx * 1.15);
      gr.addColorStop(0, "rgba(58,34,92,0.97)"); gr.addColorStop(0.62, "rgba(66,40,104,0.95)"); gr.addColorStop(0.86, "rgba(80,52,124,0.55)"); gr.addColorStop(1, "rgba(90,60,140,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m.rx * 1.15, 0, Math.PI * 2); g.fill();
      g.restore();
      // slow swirls of lighter mist in it
      g.fillStyle = "rgba(150,120,200,0.10)";
      for (let i = 0; i < 9; i++) {
        const a = t * 0.12 + i * 2.1, rr = 0.55 + 0.3 * Math.sin(i * 1.7 + t * 0.2);
        g.beginPath(); g.ellipse(OX + m.x + Math.cos(a) * m.rx * rr, OY + m.y + Math.sin(a * 1.3) * m.ry * rr, m.rx * 0.32, m.ry * 0.22, 0, 0, Math.PI * 2); g.fill();
      }
      // light cuts holes in it
      g.globalCompositeOperation = "destination-out";
      for (const b of holes) {
        if (b.x + b.r < x0 || b.x - b.r > x0 + w || b.y + b.r < y0 || b.y - b.r > y0 + h) continue;
        const hg = g.createRadialGradient(b.x, b.y, b.r * 0.35, b.x, b.y, b.r);
        hg.addColorStop(0, "rgba(0,0,0,1)"); hg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = hg; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      const sm = c.imageSmoothingEnabled;
      c.imageSmoothingEnabled = true; // soft, not blocky: it's mist, not pixel art
      c.globalAlpha = k;
      c.drawImage(fog, 0, 0, fw, fh, x0, y0, w, h);
      c.globalAlpha = 1;
      c.imageSmoothingEnabled = sm;
    }
  }
  // the Aether Crystals not yet taken, glowing through the mist (they're how you find your way in it)
  function drawAether(c, t, view) {
    const sp = G.spires;
    if (!sp) return;
    AETHER.forEach(([lx, ly], i) => {
      const x = OX + lx, y = OY + ly;
      if (sp.took[i] || !mistAt(lx, ly, 1) || x < view.left - 40 || x > view.right + 40 || y < view.top - 60 || y > view.bottom + 20) return;
      const pulse = 0.75 + 0.25 * Math.sin(t * 3 + i), node = IMG["aether-" + (1 + (i % 3))], im = node || IMG["crystal-3"];
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.7 * pulse; c.drawImage(art.glow, x - 34, y - 46, 68, 68);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      if (im) { const k = node ? 0.5 : 0.28, w = im.width * k, h = im.height * k; c.drawImage(im, x - w / 2, y - h + 2, w, h); }
      else c.drawImage(art.crystals[2], x - 10, y - 26, 20, 26);
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.5 * pulse; c.drawImage(art.glow, x - 14, y - 26, 28, 28);
      c.globalAlpha = 1;
    });
    // a burning crystal: a ring of violet light round the knight
    for (const b of bubbles().slice(0, sp.bubbles.length)) {
      c.globalAlpha = 0.25; c.drawImage(art.glow, b.x - b.r * 0.6, b.y - 20 - b.r * 0.6, b.r * 1.2, b.r * 1.2);
    }
    c.globalAlpha = 1;
  }

  // a room's foes still standing
  const foesOf = (id) => G.enemies.filter((e) => e.room === id && !e.removed && e.hp > 0);
  // a free spot on the floor, away from the knight
  function spot(f, p) {
    for (let k = 0; k < 30; k++) {
      const x = OX + DL.rand(f[0] + 30, f[2] - 30), y = OY + DL.rand(f[1] + 30, f[3] - 30);
      if (!Sp.walkable(x, y, 20) || Math.hypot(x - p.x, y - p.y) < 170 || SOLIDS.some((q) => Math.hypot(x - OX - q[0], y - OY - q[1]) < q[2] + 20)) continue;
      return [x, y];
    }
    return [OX + (f[0] + f[2]) / 2, OY + (f[1] + f[3]) / 2];
  }
  function seal(sp, id, p) {
    const R = ROOMS[id], f = FLOORS[id];
    sp.seal = id; sp.sealT = 0;
    sp.held = inRect(G.player.x - OX, G.player.y - OY, f, 34) && !(G.player.downT > 0);
    if (R.boss) DL.RiftThrone.wake(id);
    for (const [x, y] of R.sent) {
      G.enemies.push(G.makeEnemy("sentinel", OX + x, OY + y, S.wave.zone, { heat: R.heat, room: id }));
      for (let i = 0; i < 12; i++) G.puff(OX + x + DL.rand(-14, 14), OY + y - DL.rand(0, 60), "rgba(200,150,255,0.7)", 50, 0.7);
    }
    for (const [type, n] of R.foes) for (let i = 0; i < n; i++) {
      const [x, y] = spot(f, p);
      G.enemies.push(G.makeEnemy(type, x, y, S.wave.zone, { rise: 0.9, room: id, heat: R.heat }));
    }
    G.camera.shake = 5;
    DL.Sound.play("whisper");
    if (!R.boss) all("Rune light seals the way out. Break everything in the room!", "danger");
  }
  Sp.seat = () => ({ x: OX + THRONE.x, y: OY + THRONE.y + SEAT.dy, lift: SEAT.lift });
  // the boss beaten (src/riftthrone.js): his reward into the run's loot, and the arena's arch now goes home with all of it
  Sp.won = function (reward) {
    const sp = G.spires;
    if (!sp) return;
    sp.won = true;
    sp.shard += reward.shard; sp.aether += reward.aether;
    setTimeout(() => all(`${reward.shard} Rift Shards and ${reward.aether} Aether Crystals glitter where he fell. The arch in the arena now takes you home with everything you carry.`, "good"), 2500);
  };
  function open(sp) {
    const id = sp.seal;
    sp.cleared[id] = true; sp.seal = null; sp.flare = 1;
    const L = DL.SPIRES.loot.room, n = Math.round(L[0] + (L[1] - L[0]) * ROOMS[id].heat);
    sp.shard += n;
    for (const g of GATES[id] || []) for (let i = 0; i < 10; i++) G.puff(OX + g.x + DL.rand(-g.w / 2, g.w / 2) * Math.cos(g.ang), OY + g.y + DL.rand(-g.w / 2, g.w / 2) * Math.sin(g.ang) - DL.rand(0, 40), "rgba(220,180,255,0.8)", 60, 0.8);
    DL.Sound.play("chime");
    const left = Object.keys(ROOMS).filter((k) => !sp.cleared[k]).length;
    all(`The rune light fades: ${n} Rift Shards.` + (ROOMS[id].chest ? " The chest can be opened now." : left ? ` The way on is open. (${left} room${left > 1 ? "s" : ""} left)` : DL.SANDBOX ? " Every room is clear. Step on the rune circle's heart to wake them again." : " Every room is clear."), "good");
  }
  // where the room's foes and a sealed-in knight may stand
  function heldIn(ent) {
    const sp = G.spires;
    if (!sp) return null;
    if (ent.room && FLOORS[ent.room]) return FLOORS[ent.room];
    if (sp.seal && ent === G.player && sp.held) return FLOORS[sp.seal]; // only a knight the room sealed round
    return null;
  }

  // The portals, and waking the rune circle.
  Sp.update = function (dt) {
    const sp = G.spires, p = G.player;
    if (!sp || !p) return;
    if (!Sp.inRegion(p.x, p.y)) { G.spires = null; return; }
    sp.flare = Math.max(0, sp.flare - dt * 0.5);
    const lx = p.x - OX, ly = p.y - OY;
    const atW = Math.abs(lx - ARCH_W.x) < 36 && ly < ARCH_W.y - 4 && ly > ARCH_W.y - 40, atE = Math.abs(lx - RING_E.x) < 44 && ly < RING_E.y - 4 && ly > RING_E.y - 40;
    const atS = Math.abs(lx - ARCH_S.x) < 30 && ly < ARCH_S.y - 4 && ly > ARCH_S.y - 40;
    const atT = Math.abs(lx - ARCH_T.x) < 30 && ly < ARCH_T.y - 4 && ly > ARCH_T.y - 40;
    if (sp.guest) { // a friend's device: ask the host to take everyone out
      if ((atS || (atT && sp.won && !sp.seal)) && !sp.asked) { sp.asked = true; DL.Net.event({ t: "spLeave", all: atS ? 0 : 1 }); }
      if (atS || (atT && sp.won && !sp.seal)) return;
      sp.asked = false;
    } else {
      if (atS) { Sp.leave(); return; }
      if (atT && sp.won && !sp.seal) { Sp.leave(true); return; } // the boss beaten: home with it all
    }
    if (Math.abs(lx - ARCH_T.x) < 30 && ly < ARCH_T.y - 4 && ly > ARCH_T.y - 40) { // the arena's arch: back to the hub
      p.x = OX + SPAWN.x; p.y = OY + SPAWN.y; p.spx = p.x; p.spy = p.y; p.dashT = 0; p.kx = p.ky = 0;
      G.camera.x = p.x; G.camera.y = p.y - 20;
      for (let i = 0; i < 18; i++) G.puff(p.x + DL.rand(-16, 16), p.y - DL.rand(0, 50), "rgba(200,150,255,0.7)", 70, 0.8);
      DL.Sound.play("chime");
      return;
    }
    if (!sp.guest) WELLS.forEach(([x, y], i) => {
      if (sp.lit[i] || !party().some((k) => Math.hypot(k.x - OX - x, k.y - OY - y - 30) < 70)) return;
      sp.lit[i] = true; sp.litT[i] = G.t;
      const sv = wellsSave(); sv[i] = true; sv.at = i; G.persist();
      for (let k = 0; k < 24; k++) G.puff(OX + x + DL.rand(-30, 30), OY + y - DL.rand(0, 90), "rgba(230,200,255,0.8)", 80, 0.9);
      DL.Sound.play("chime");
      all("The Mist Well wakes and the mist round it clears for good. It's your checkpoint now.", "good");
    });
    mistUpdate(sp, p, dt);
    if ((atW || atE) && !sp.inPortal) {
      const to = atW ? RING_E : ARCH_W;
      p.x = OX + to.x; p.y = OY + to.y + 44; p.spx = p.x; p.spy = p.y; p.dashT = 0; p.kx = p.ky = 0; p.angle = Math.PI / 2;
      G.camera.x = p.x; G.camera.y = p.y - 20;
      for (let i = 0; i < 18; i++) G.puff(p.x + DL.rand(-16, 16), p.y - DL.rand(0, 50), "rgba(200,150,255,0.7)", 70, 0.8);
      DL.Sound.play("chime");
    }
    sp.inPortal = atW || atE;
    if (sp.guest) { sp.sealT += dt; return; } // the rest is the host's
    // rooms: step in and it seals; clear it and it opens
    const pt = party();
    if (sp.seal) {
      sp.sealT += dt;
      if (sp.sealT > 1 && !foesOf(sp.seal).length) open(sp);
    } else {
      for (const id in ROOMS) if (!sp.cleared[id] && pt.some((k) => inRect(k.x - OX, k.y - OY, FLOORS[id], 34))) { seal(sp, id, p); break; }
    }
    // a won side room's chest: walk up to it
    for (const id in ROOMS) {
      const q = ROOMS[id].chest;
      if (!q || !sp.cleared[id] || sp.opened[id] || !pt.some((k) => Math.hypot(k.x - OX - q[0], k.y - OY - q[1] - 10) < 44)) continue;
      sp.opened[id] = true;
      const C = DL.SPIRES.loot.chest, n = Math.round(DL.rand(C.shard[0], C.shard[1]));
      sp.shard += n; sp.aether += C.aether;
      for (let k = 0; k < 26; k++) G.puff(OX + q[0] + DL.rand(-18, 18), OY + q[1] - DL.rand(0, 50), "rgba(230,190,255,0.85)", 90, 0.9);
      DL.Sound.play("milestone");
      all(`The chest springs open: ${n} Rift Shards and ${C.aether} Aether Crystals.`, "good");
    }
    // the rune circle's heart wakes every cleared room again (Sandbox only: in a real run a room is won once)
    if (DL.SANDBOX && !sp.seal && Object.keys(sp.cleared).length && Math.hypot(lx - RUNE.x, (ly - RUNE.y) / RUNE.sq) < 34) {
      sp.cleared = {}; sp.flare = 1;
      WELL_ROOM.forEach((r, i) => { if (r && sp.lit[i]) sp.cleared[r] = true; }); // a lit Well keeps its room won
      G.camera.shake = 6;
      DL.Sound.play("whisper");
      say("The runes flare. Every room stirs again.", "danger");
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
  const BX0 = -2800, BY0 = -2800, BX1 = 2900, BY1 = 1800; // the painted extent (local)
  const CH = 1024; // painted in square chunks, made as they come into view and dropped far away (phones)
  let chunks = new Map(), art = null, sky = null;

  // Robert's drawn pieces (tools/cut_spires.py, 2 file px per world px). They load when the room is first drawn;
  // until then (and in the node tests) the coded stone shows, and when the last one lands the room repaints.
  const ART_N = ["arena", "throne", "well-dark", "well-lit", "floor-2", "floor-3", "floor-4", "kerb", "face-1-band", "face-1-foot", "face-2-band", "face-2-foot", "stairs",
    "bridge", "bridge-post", "post", "spire", "arch", "ring", "exit-banner", "crystal-1", "crystal-2", "crystal-3",
    "column-1", "column-1b", "column-2", "column-3", "rune-circle", "rune-glow",
    "chest-shut", "chest-open", "aether-1", "aether-2", "aether-3", "seal-1", "seal-2", "seal-3", "seal-4"];
  const IMG = {};
  let loading = false;
  function loadArt() {
    if (loading || typeof Image === "undefined") return;
    loading = true;
    let left = ART_N.length;
    const done = () => { if (--left === 0) chunks = new Map(); };
    for (const n of ART_N) {
      const im = new Image();
      im.onload = () => { IMG[n] = im; done(); };
      im.onerror = done;
      im.src = DL.asset("assets/sprites/spires/" + n + ".png");
    }
  }
  // tile a drawn strip across x0..x1 with its top at y, h tall
  function stripX(g, img, x0, x1, y, h, off = 0) {
    const w = (img.width * h) / img.height;
    g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, h); g.clip();
    for (let x = x0 - off * w; x < x1; x += w) g.drawImage(img, x, y, w + 0.5, h);
    g.restore();
  }
  // the runs of an edge at y between x0 and x1 that no stair or bridge comes in through
  function runs(x0, x1, y, gaps) {
    const cut = gaps.filter((q) => Math.abs(q[1] - y) < 30 && q[0] > x0 - 52 && q[0] < x1 + 52).map((q) => [q[0] - 52, q[0] + 52]).sort((a, b) => a[0] - b[0]);
    const out = [];
    let x = x0;
    for (const [a, b] of cut) { if (a > x) out.push([x, a]); x = Math.max(x, b); }
    if (x < x1) out.push([x, x1]);
    return out;
  }
  const FOOT_WALL = { 1: 37, 2: 35.5 }; // the wall rows at the top of each face's foot picture (world px)

  // A stone face hanging from a floor's south edge: courses of brick darkening downward, a ragged foot, fading out.
  function face(g, x0, x1, y, h, r, glyphs, v = 1) {
    if (IMG["face-" + v + "-band"] && IMG["face-" + v + "-foot"]) return faceArt(g, x0, x1, y, h, r, v);
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

  // The drawn face: the top half of the wall tiled down as far as it needs, then the foot (the rest of the wall and the
  // hanging rock) once, then the same light and fade as the coded one.
  function faceArt(g, x0, x1, y, h, r, v) {
    const band = IMG["face-" + v + "-band"], foot = IMG["face-" + v + "-foot"];
    const bw = band.width / 2, bh = band.height / 2, fw = foot.width / 2, fh = foot.height / 2, fwall = FOOT_WALL[v];
    const fy = Math.max(0, h - fwall), w = Math.round(x1 - x0), H = Math.round(fy + fh) + 1, t = mk(w, H), q = t.getContext("2d");
    const off = r() * bw;
    for (let yy = 0; yy < fy; yy += bh) for (let xx = -off; xx < w; xx += bw) q.drawImage(band, xx, yy, bw + 0.5, bh + 0.5);
    for (let xx = -off; xx < w; xx += fw) q.drawImage(foot, xx, fy, fw + 0.5, fh);
    q.globalCompositeOperation = "source-atop";
    let gr = q.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(200,170,255,0.16)"); gr.addColorStop(Math.min(0.2, 24 / w), "rgba(200,170,255,0)");
    gr.addColorStop(Math.max(0.8, 1 - 24 / w), "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.4)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    gr = q.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0.1)"); gr.addColorStop(1, "rgba(10,0,25,0.5)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    q.fillStyle = "rgba(0,0,0,0.35)"; q.fillRect(0, 0, w, 3);
    q.globalCompositeOperation = "destination-out";
    gr = q.createLinearGradient(0, fy + fwall, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.85)");
    q.fillStyle = gr; q.fillRect(0, fy + fwall, w, H);
    g.drawImage(t, x0, y);
  }

  // A floor's top: flagstones in offset rows, bevelled, with a lighter kerb round the edge.
  function top(g, x0, y0, x1, y1, r, gaps) {
    g.save();
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.fillStyle = C.grout; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const drawn = IMG["floor-2"] && IMG.kerb;
    if (drawn) { // Robert's tiles, on one grid for the whole room so neighbouring floors line up
      const T = 192;
      for (let ty = BY0 + Math.floor((y0 - BY0) / T) * T; ty < y1; ty += T)
        for (let tx = BX0 + Math.floor((x0 - BX0) / T) * T; tx < x1; tx += T) {
          const k = r(), im = (k < 0.14 && IMG["floor-3"]) || (k < 0.28 && IMG["floor-4"]) || IMG["floor-2"];
          g.drawImage(im, tx, ty, T, T);
        }
    }
    const TW = 22, TH = 17;
    for (let row = 0, y = drawn ? y1 : y0; y < y1; row++, y += TH) {
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
    if (drawn) { // the drawn parapet along the north and south edges
      for (const [a, b] of runs(x0, x1, y1, gaps)) stripX(g, IMG.kerb, a, b, y1 - 24, 24, r());
      for (const [a, b] of runs(x0, x1, y0, gaps)) stripX(g, IMG.kerb, a, b, y0, 24, r());
    } else for (let x = x0; x < x1; x += 24) {
      if (!open(x + 12, y0)) kerb(x, y0, 24, 8);
      if (!open(x + 12, y1)) kerb(x, y1 - 8, 24, 8);
    }
    for (let y = y0 + 8; y < y1 - 8; y += 24) {
      if (!open(x0, y + 12)) kerb(x0, y, 8, Math.min(24, y1 - 8 - y));
      if (!open(x1, y + 12)) kerb(x1 - 8, y, 8, Math.min(24, y1 - 8 - y));
    }
    // raised blocks along the south edge (a parapet you can see over)
    for (let x = x0 + 18; !drawn && x < x1 - 30; x += 56) {
      if (open(x + 8, y1)) continue;
      g.fillStyle = C.rim; g.fillRect(x, y1 - 18, 16, 8);
      g.fillStyle = C.faceL; g.fillRect(x, y1 - 10, 16, 10);
      g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x + 12, y1 - 10, 4, 10);
    }
    g.restore();
  }

  // The rune circle set into the plaza: rings of wedge stones round a disc, with grooves for the runes.
  function runeFloor(g, r) {
    const im = IMG["rune-circle"];
    if (im) { const w = RUNE.r * 2 + 14, h = (w * im.height) / im.width; g.drawImage(im, RUNE.x - w / 2, RUNE.y - h / 2, w, h); return; }
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
    const im = IMG.stairs;
    if (im) { // the drawn flight, its treads (file px 38..191 across, 28..386 down) stretched onto the stair
      const sx = (q[2] - q[0]) / (191 - 38), sy = (q[3] - q[1]) / (386 - 28);
      g.drawImage(im, q[0] - 38 * sx, q[1] - 28 * sy, im.width * sx, im.height * sy);
      return;
    }
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
    if (IMG.bridge) return bridgeArt(g, q);
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

  // The drawn bridge: the plank strip laid along it (always drawn west to east, so its chains hang down), posts at the ends.
  function bridgeArt(g, q) {
    let [ax, ay, bx, by, hw] = q;
    if (bx < ax) [ax, ay, bx, by] = [bx, by, ax, ay];
    const im = IMG.bridge, len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), tw = im.width / 2, th = im.height / 2;
    g.save(); g.translate(ax, ay); g.rotate(ang);
    g.beginPath(); g.rect(-4, -th, len + 8, th * 3); g.clip();
    for (let s = -4; s < len + 4; s += tw) g.drawImage(im, s, -32, tw + 0.5, th);
    g.restore();
    const post = IMG["bridge-post"];
    if (!post) return;
    const nx = -Math.sin(ang), ny = Math.cos(ang), pw = post.width / 2, ph = post.height / 2;
    for (const [px, py] of [[ax, ay], [bx, by]]) for (const sd of [-1, 1]) g.drawImage(post, px + nx * hw * sd - pw / 2, py + ny * hw * sd - ph + 4, pw, ph);
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
  // a seamless square of soft mist: puffs drawn wrapped round the edges so it tiles with no seam
  function mistTile(seed, n, tint) {
    const N = 512, r = rng(seed), c = mk(N, N), g = c.getContext("2d");
    for (let i = 0; i < n; i++) {
      const x = r() * N, y = r() * N, R = 50 + r() * 150, a = 0.05 + r() * r() * 0.4;
      for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, R);
        gr.addColorStop(0, `rgba(${tint},${a})`); gr.addColorStop(0.6, `rgba(${tint},${a * 0.45})`); gr.addColorStop(1, `rgba(${tint},0)`);
        g.fillStyle = gr; g.fillRect(x + dx - R, y + dy - R, R * 2, R * 2);
      }
    }
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

  // Every slab (with the box it paints into), back to front by its south edge, then the bridges on top.
  let SLABS = null;
  function slabs() {
    if (SLABS) return SLABS;
    const gaps = JOINS.map((j) => [j[2], j[3]]), L = [];
    let n = 0;
    const add = (y, box, f) => { const seed = 1234 + 7919 * n++; L.push({ y, box, f: (g) => f(g, rng(seed)) }); };
    for (const k in FLOORS) {
      const q = FLOORS[k], fh = S.hang + q[4] * LH + 120;
      if (q[5] === "oval") { add(q[3], [q[0], q[1], q[2], q[3] + fh], (g, r) => oval(g, q, r)); continue; }
      add(q[3], [q[0] - 4, q[1] - 30, q[2] + 4, q[3] + fh], (g, r) => {
        face(g, q[0], q[2], q[3], S.hang + q[4] * LH, r, Math.round((q[2] - q[0]) / 160), k === "plaza" || k === "west" || k === "east" || k === "high" || k === "ct2" ? 2 : 1);
        top(g, q[0], q[1], q[2], q[3], r, gaps);
        if (k === "plaza") runeFloor(g, r);
      });
    }
    for (const k in STAIRS) {
      const q = STAIRS[k];
      add(q[3] - 0.5, [q[0] - 60, q[1] - 60, q[2] + 60, q[3] + S.hang + q[4] * LH + 120], (g, r) => { face(g, q[0] - 3, q[2] + 3, q[3], S.hang + q[4] * LH, r, 0); stairs(g, q, r); });
    }
    const COLS = ["column-1", "column-1b", "column-2", "column-3"];
    PILLARS.forEach((q, i) => add(q[1] + q[2] * 0.4, [q[0] - q[2], q[1] - q[2], q[0] + q[2], q[1] + 800], (g, r) => {
      const im = IMG[COLS[i % 4]];
      if (im) { const w = q[2] * 1.3, h = (w * im.height) / im.width; g.drawImage(im, q[0] - w / 2, q[1] - w * 0.35, w, h); return; }
      const w = q[2], d = w * 0.8;
      face(g, q[0] - w / 2, q[0] + w / 2, q[1] + d / 2, S.hang + 30 + q[3] * LH, r, 1);
      top(g, q[0] - w / 2, q[1] - d / 2, q[0] + w / 2, q[1] + d / 2, r, []);
    }));
    L.sort((a, b) => a.y - b.y);
    for (const k in BRIDGES) {
      const q = BRIDGES[k], pad = 60;
      add(1e9, [Math.min(q[0], q[2]) - pad, Math.min(q[1], q[3]) - pad, Math.max(q[0], q[2]) + pad, Math.max(q[1], q[3]) + pad], (g, r) => bridge(g, q, r));
    }
    return (SLABS = L);
  }
  // the round arena: its hanging wall swept down from the lower rim, then Robert's drawn floor (or a coded one)
  function oval(g, q, r) {
    const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2, rx = (q[2] - q[0]) / 2, ry = (q[3] - q[1]) / 2, H = S.hang + q[4] * LH;
    g.save(); g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, cy + H + 80); g.lineTo(cx + rx, cy + H + 80); g.closePath();
    g.clip(); face(g, q[0], q[2], cy, ry + H, r, 6, 2); g.restore();
    const im = IMG.arena;
    if (im) { const h = (2 * rx * im.height) / im.width; g.drawImage(im, q[0], cy - ry * 1.02, 2 * rx, h); return; }
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip(); top(g, q[0], q[1], q[2], q[3] + 10, r, []); g.restore();
  }
  function paintChunk(i, j) {
    const x0 = BX0 + i * CH, y0 = BY0 + j * CH, c = mk(CH, CH), g = c.getContext("2d");
    g.translate(-x0, -y0);
    for (const sl of slabs()) {
      const b = sl.box;
      if (b[2] < x0 || b[0] > x0 + CH || b[3] < y0 || b[1] > y0 + CH) continue;
      sl.f(g);
    }
    return c;
  }

  function build() {
    loadArt();
    const r = rng(99);
    art = {
      crystals: [0, 1, 2].map(crystalSprite), arch: archSprite(1), archS: archSprite(0.8), ring: ringSprite(),
      post: postSprite(48, r), spire: postSprite(118, r), puff: puffSprite(), sea: mistTile(57, 34, "172,128,224"), veil: mistTile(91, 18, "214,186,250"), glow: glowSprite(), runes: runeRing(),
    };
    // mist puffs drifting below the platforms, and far columns in the haze
    const m = rng(4242);
    art.mist = Array.from({ length: 70 }, () => ({ x: (m() - 0.5) * 5400, y: (m() - 0.5) * 4400 - 600, s: 2.5 + m() * 3, v: 6 + m() * 10, a: 0.5 + m() * 0.5 }));
    art.far = Array.from({ length: 50 }, () => ({ x: (m() - 0.5) * 6000, y: (m() - 0.5) * 5200 - 600, w: 30 + m() * 50, h: 120 + m() * 220 }));
    art.motes = Array.from({ length: 120 }, () => ({ x: (m() - 0.5) * 5000, y: (m() - 0.5) * 4200 - 600, p: m() * 10, v: 10 + m() * 18 }));
  }

  /* ---------------- drawing each frame ---------------- */
  const sees = (view) => view.right > OX - S.halfW && view.left < OX + S.halfW && view.bottom > OY - S.halfH && view.top < OY + S.halfH;
  Sp.covers = (view) => sees(view) && G.camera && Sp.inRegion(G.camera.x, G.camera.y);

  // The mist sea, far columns, then the painted stone; the rune ring and the light-fall glow on top of it.
  Sp.drawGround = function (c, view, t) {
    if (!sees(view)) return;
    if (!art) build();
    const vw = view.right - view.left, vh = view.bottom - view.top;
    // the violet haze, top to bottom of the view: a 1 px strip of it stretched over the screen (a gradient fill
    // this size cost a phone ten times as much)
    if (!sky) {
      sky = mk(1, 256);
      const sg = sky.getContext("2d"), g0 = sg.createLinearGradient(0, 0, 0, 256);
      g0.addColorStop(0, "#2a1842"); g0.addColorStop(0.55, "#4b2f72"); g0.addColorStop(1, "#33204f");
      sg.fillStyle = g0; sg.fillRect(0, 0, 1, 256);
    }
    const sm = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = true;
    c.drawImage(sky, 0, 0.5, 1, 255, view.left - 2, view.top - 2, vw + 4, vh + 4);
    c.imageSmoothingEnabled = sm;
    let gr;
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
    drawSea(c, view, t);
    drawMist(c, view, t, 1);
    // the painted stone: only the part on screen
    const i0 = Math.max(0, Math.floor((view.left - OX - BX0) / CH)), i1 = Math.min(Math.ceil((BX1 - BX0) / CH) - 1, Math.floor((view.right - OX - BX0) / CH));
    const j0 = Math.max(0, Math.floor((view.top - OY - BY0) / CH)), j1 = Math.min(Math.ceil((BY1 - BY0) / CH) - 1, Math.floor((view.bottom - OY - BY0) / CH));
    // a chunk is a big paint: one a frame while walking (all at once when the room opens), and the last 20 seen are
    // kept, so walking back and forth doesn't paint them again
    let made = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const key = i + "," + j;
      let ch = chunks.get(key);
      if (ch) { chunks.delete(key); chunks.set(key, ch); } // most recently seen last
      else if (made++ < 1 || chunks.size < 4) { ch = paintChunk(i, j); chunks.set(key, ch); }
      if (!ch) continue;
      const x = OX + BX0 + i * CH, y = OY + BY0 + j * CH;
      const sx = Math.max(0, view.left - x), sy = Math.max(0, view.top - y), ex = Math.min(CH, view.right - x + 1), ey = Math.min(CH, view.bottom - y + 1);
      if (ex > sx && ey > sy) c.drawImage(ch, sx, sy, ex - sx, ey - sy, x + sx, y + sy, ex - sx, ey - sy);
    }
    for (const key of chunks.keys()) { // drop the longest unseen (never one on screen: those were just moved last)
      if (chunks.size <= Math.max(20, (i1 - i0 + 1) * (j1 - j0 + 1))) break;
      chunks.delete(key);
    }
    // the rune ring, slowly turning, brighter when it wakes the Drowned
    const fl = G.spires ? G.spires.flare : 0;
    c.save();
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.45 + 0.15 * Math.sin(t * 1.7) + 0.4 * fl;
    const rg = IMG["rune-glow"];
    if (rg) { const w = RUNE.r * 2 + 14, h = (w * rg.height) / rg.width; c.drawImage(rg, OX + RUNE.x - w / 2, OY + RUNE.y - h / 2, w, h); }
    else { c.translate(OX + RUNE.x, OY + RUNE.y); c.scale(1, RUNE.sq); c.rotate(t * 0.08); c.drawImage(art.runes, -160, -160); }
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

  // the mist sea filling the gaps between the platforms: two seamless layers, drifting at different
  // speeds and sitting at different depths, so no stretch of the void is left bare
  function drawSea(c, view, t) {
    const cam = G.camera;
    for (const [img, sc, par, vx, vy, a] of [[art.sea, 2.2, 0.55, 9, 3, 1], [art.veil, 1.6, 0.8, -14, 5, 0.8]]) {
      if (!img.pat || img.patC !== c) { img.pat = c.createPattern(img, "repeat"); img.patC = c; } // made once, not every frame
      const pat = img.pat, T = 512 * sc;
      const ox = ((((cam.x - OX) * par + t * vx) % T) + T) % T, oy = ((((cam.y - OY) * par + t * vy) % T) + T) % T;
      c.save();
      c.globalAlpha = a;
      c.translate(view.left - ((view.left - ox) % T + T) % T, view.top - ((view.top - oy) % T + T) % T);
      c.scale(sc, sc);
      c.fillStyle = pat;
      c.fillRect(0, 0, (view.right - view.left) / sc + 1024, (view.bottom - view.top) / sc + 1024);
      c.restore();
    }
  }
  function drawMist(c, view, t, k) {
    for (const m of art.mist) {
      const w = 128 * m.s;
      const x = OX + ((m.x + t * m.v + 2700) % 5400) - 2700 - w / 2, y = OY + m.y - w / 2;
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
    const sp = G.spires;
    if (sp && sp.seal) for (const g of GATES[sp.seal] || []) list.push({ y: OY + g.y, f: () => curtain(c, g, t, sp.sealT) });
    // the Lord of the Rift Throne asleep on it, until the arena wakes him (and once he's beaten, an empty throne)
    if (!(sp && (sp.won || sp.seal === "arena")) && !DL.RiftThrone.lord()) {
      const st = Sp.seat();
      if (st.x > view.left - 300 && st.x < view.right + 300 && st.y > view.top - 100 && st.y < view.bottom + 400) list.push({ y: st.y, f: () => DL.RiftThrone.drawSleeping(c, st.x, st.y - st.lift, t) });
    }
    if (sp) for (const id in ROOMS) {
      const q = ROOMS[id].chest;
      if (q) list.push({ y: OY + q[1], f: () => chest(c, OX + q[0], OY + q[1], t, !!sp.opened[id], !!sp.cleared[id]) });
    }
  };
  // a side room's chest: dark stone bound in black iron, its crystal glowing once its room is won
  function chest(c, x, y, t, open, ready) {
    const im = IMG[open ? "chest-open" : "chest-shut"];
    if (im) {
      const w = im.width / 2, h = im.height / 2;
      c.save();
      c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y + 1, 26, 7, 0, 0, Math.PI * 2); c.fill();
      c.drawImage(im, x - w / 2, y - h + 3, w, h);
      if (open || ready) { c.globalCompositeOperation = "lighter"; c.globalAlpha = (open ? 0.3 : 0.35) + 0.2 * Math.sin(t * 4); c.drawImage(art.glow, x - 34, y - (open ? 66 : 54), 68, 68); }
      c.restore();
      return;
    }
    c.save();
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y + 2, 26, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2a2140"; c.fillRect(x - 22, y - 26, 44, 26);
    c.fillStyle = "#3a2f58"; c.fillRect(x - 22, y - 26, 44, 5);
    c.fillStyle = "#b48cff"; c.fillRect(x - 22, y - 16, 44, 3); c.fillRect(x - 3, y - 22, 6, 9);
    if (open) { // the lid thrown back, light pouring up
      c.fillStyle = "#3a2f58"; c.fillRect(x - 22, y - 42, 44, 14);
      c.globalCompositeOperation = "lighter";
      const g = c.createLinearGradient(0, y - 70, 0, y - 24);
      g.addColorStop(0, "rgba(200,150,255,0)"); g.addColorStop(1, "rgba(220,180,255,0.6)");
      c.fillStyle = g; c.fillRect(x - 18, y - 70, 36, 46);
    } else {
      c.fillStyle = "#2f2548"; c.beginPath(); c.moveTo(x - 24, y - 26); c.quadraticCurveTo(x, y - 44, x + 24, y - 26); c.closePath(); c.fill();
      c.strokeStyle = "#b48cff"; c.lineWidth = 2; c.stroke();
      if (ready) { c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); c.drawImage(art.glow, x - 40, y - 60, 80, 80); }
    }
    c.restore();
  }
  // a sealed way out: a wall of rune light standing across it
  function curtain(c, g, t, age) {
    const k = Math.min(1, age * 3), H = 70 * k, dx = (Math.cos(g.ang) * g.w) / 2, dy = (Math.sin(g.ang) * g.w) / 2;
    const x = OX + g.x, y = OY + g.y, im = IMG["seal-" + (1 + (Math.floor(t * 8 + g.x) & 3))];
    if (im && Math.abs(dx) > 12) { // Robert's flickering rune wall, its foot laid along the way out (sheared on a slanted bridge)
      const s = (dx > 0 ? 1 : -1), ih = 78 * k;
      c.save();
      c.transform((2 * dx * s) / im.width, (2 * dy * s) / im.width, 0, ih / im.height, x - dx * s, y - dy * s - ih);
      c.drawImage(im, 0, 0);
      c.restore();
      c.save(); c.lineCap = "round"; c.globalCompositeOperation = "lighter";
      c.strokeStyle = "rgba(190,130,255,0.35)"; c.lineWidth = 10;
      c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
      c.restore();
      return;
    }
    c.save();
    c.globalCompositeOperation = "lighter";
    const gr = c.createLinearGradient(0, y - H, 0, y);
    gr.addColorStop(0, "rgba(170,110,255,0)"); gr.addColorStop(0.6, "rgba(170,110,255,0.35)"); gr.addColorStop(1, "rgba(220,180,255,0.7)");
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.lineTo(x + dx, y + dy - H); c.lineTo(x - dx, y - dy - H); c.closePath(); c.fill();
    // runes drifting up it
    c.fillStyle = "rgba(240,220,255,0.85)";
    for (let i = 0; i < 7; i++) {
      const u = i / 6 - 0.5, life = (t * 0.6 + i * 0.37) % 1, rx = x + dx * 2 * u, ry = y + dy * 2 * u - life * H;
      c.globalAlpha = Math.sin(Math.PI * life);
      c.fillRect(rx - 1.5, ry - 3, 3, 6);
    }
    c.globalAlpha = 1;
    c.lineCap = "round"; // a band of light on the stone, so a curtain seen edge-on still reads
    c.strokeStyle = "rgba(190,130,255,0.45)"; c.lineWidth = 12;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
    c.strokeStyle = "rgba(235,210,255,0.9)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
    c.restore();
  }
  function drawProp(c, q, x, y, t) {
    const kind = q[0];
    const im = IMG[kind === "crystal" ? "crystal-" + (3 - q[4]) : kind === "banner" ? "exit-banner" : kind === "well" ? (G.spires && G.spires.lit && G.spires.lit[q[3]] ? "well-lit" : "well-dark") : kind];
    if (im && kind !== "arch" && kind !== "ring") { // drawn: stand it on its foot
      const s = (kind === "crystal" ? q[3] : kind === "throne" ? THRONE_K : 1) / 2, w = im.width * s, h = im.height * s;
      c.drawImage(im, x - w / 2, y - h + (kind === "crystal" ? 3 : 5), w, h);
    } else if (kind === "crystal") {
      const s = q[3], img = art.crystals[q[4]];
      c.drawImage(img, x - 28 * s, y - 70 * s, 56 * s, 72 * s);
    } else if (kind === "banner" || kind === "throne" || kind === "well") {
      // coded until the art loads: nothing
    } else if (kind === "arch" && im) {
      const sz = q[3], ws = 0.341 * 0.5 * sz, w = (im.width / 2) * sz, h = (im.height / 2) * sz;
      // the opening, in the raw picture's px round its foot (626, 1193): the portal swirls behind it
      const P = (rx, ry) => [x + (rx - 626) * ws, y + (ry - 1193) * ws];
      c.save(); c.beginPath();
      let p = P(345, 1175); c.moveTo(p[0], p[1]); p = P(345, 520); c.lineTo(p[0], p[1]);
      let cp = P(360, 400); p = P(628, 370); c.quadraticCurveTo(cp[0], cp[1], p[0], p[1]);
      cp = P(895, 400); p = P(910, 520); c.quadraticCurveTo(cp[0], cp[1], p[0], p[1]);
      p = P(910, 1175); c.lineTo(p[0], p[1]); c.closePath(); c.clip();
      portal(c, x, y - h * 0.4, w * 0.5, h * 0.7, t); c.restore();
      c.drawImage(im, x - w / 2, y - h, w, h);
    } else if (kind === "ring" && im) {
      const ws = 0.4234 * 0.5, w = im.width / 2, h = im.height / 2, cx = x + (627 - 627) * ws, cy = y + (545 - 1200) * ws + 10;
      c.save(); c.beginPath(); c.ellipse(cx, cy, 292 * ws, 258 * ws, 0, 0, Math.PI * 2); c.clip(); portal(c, cx, cy, 292 * ws * 2, 258 * ws * 2, t); c.restore();
      c.drawImage(im, x - w / 2, y - h + 10, w, h);
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
    const mode = c.globalCompositeOperation;
    c.globalCompositeOperation = "source-over";
    drawFog(c, view, t); // the Hollow Mist over everything in it
    drawAether(c, t, view);
    c.globalCompositeOperation = mode;
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
      else if (q[0] === "throne") glow(x, y - 120, 150, 0.4 * tw);
      else if (q[0] === "well" && G.spires && G.spires.lit && G.spires.lit[q[3]]) glow(x, y - 60, 90, 0.6 * tw);
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
      if (!near(x, y) || q[0] === "banner" || (q[0] === "well" && !(G.spires.lit && G.spires.lit[q[3]]))) continue;
      const big = q[0] === "arch" || q[0] === "ring";
      L.push({ x, y: y - (big ? 90 : 40), r: big ? 170 : q[0] === "crystal" ? 80 * q[3] : 70, s: big ? 0.8 : 0.6, col: GLOW, a: 0.8 });
    }
    if (G.spires.seal) for (const g of GATES[G.spires.seal] || []) L.push({ x: OX + g.x, y: OY + g.y - 30, r: 110, s: 0.7, col: GLOW, a: 0.8 });
    if (near(OX + RUNE.x, OY + RUNE.y)) L.push({ x: OX + RUNE.x, y: OY + RUNE.y, r: 200, s: 0.5 + 0.4 * (G.spires.flare || 0), col: GLOW, a: 0.6 });
    if (near(OX + FALL.x0, OY + FALL.y)) L.push({ x: OX + (FALL.x0 + FALL.x1) / 2, y: OY + FALL.y + 40, r: 140, s: 0.6, col: GLOW, a: 0.7 });
  };
})(window.DL);
