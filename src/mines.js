/* Drowned Light — the Molten Mines: Level 3, a lava fortress dungeon (Robert, 2026-11-09; plan: the "Level 3 plan: The
   Molten Mines" doc, art prompts: art-prompts/molten-mines-prompts.md).

   Step 1 of 9: the map. Dark basalt floors, stairs and stone causeways over a sea of lava, after Robert's four map
   paintings, laid out as a hub and four wings, each a trap corridor leading to a big boss room:
     Gate Hall (way in and out) -> Grate Run -> the Ash Hall (the hub, its rune circle)
       west:  Slag Mine (mine carts)        -> the Fused Forge     (Magma Golem, A)      side: Storeroom
       east:  Gibbet Gallery (cages)        -> the Furnace Pit     (Furnace Hydra, B)    side: the Bone Wolf den
       NW:    Crystal Stair (jets, tiles)   -> the Molten Choir    (Seething Seraph, E)  side: Vault
       NE:    Broken Causeway (geysers)     -> the Deepfire Roost  (Crucible Wyrm, D)
       north: the great stair -> the Bound Bastion (Cinder Colossus, F) -> the Ashen Throne (the Ashen Sovereign, C)
   All five mini bosses must fall before the Sovereign (Robert). Rooms, traps, the minions and the bosses come in later
   steps; for now it's stone to walk, Ember Shrines to light and a way home.

   Like the Spires it's 3/4 top-down, not isometric: a floor's world rect is where you walk and its basalt face hangs
   DOWN from its south edge, longer the higher it stands, sinking into the mist at its foot. The stone is painted
   once into 1024 px chunks (made as they come into view). The mist sea below (Robert: mist, not lava pools) is one small coded texture, laid as a pattern
   and slowly drifted: one fill a frame. Glows are the one cached glow picture; lights only near the knight.

   Ember Shrines (the Spires' Mist Wells, in lava): walk up to one and it lights and becomes your checkpoint (saved,
   G.save.minesShrines; the next run starts at the last one lit). Walk away from a lit shrine and back, and stand at it
   a moment, to go home. The arch in the Gate Hall goes home too.
   Co-op (step 9, like the Spires): the host's device runs the run (rooms, foes, bosses, loot) and takes the whole
   party in and out; each friend's device moves its own knight, keeps it on the stone and runs the corridors' traps for
   it, and draws the run from the host's snapshots (Mi.snap: rooms, shrines, bag, bullets, the bosses' fists, pools,
   flood and Decree; each foe's move rides its row, MineBosses.vis). Every boss blow is tested on every knight in the
   run (MineBosses.party). The party shares one bag; a friend who falls rises at the run's checkpoint; if the host
   falls the run is lost. Numbers: DL.MINES (src/data.js). */
"use strict";
(function (DL) {
  const G = DL.Game, S = DL.MINES;
  const OX = S.x, OY = S.y, LH = S.lh;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const Mi = (DL.Mines = {});

  /* ---------------- the layout (local px; y grows south) ---------------- */
  // floors: x0, y0, x1, y1, level (, "oval")
  const FLOORS = {
    gate: [-340, 1480, 340, 1760, 0], // the Gate Hall: the way in and out
    run: [-110, 1000, 110, 1400, 1], // the Grate Run
    hall: [-420, 400, 420, 900, 2], // the Ash Hall, the hub
    mine: [-1260, 570, -660, 750, 2], // the Slag Mine
    forge: [-2160, 280, -1500, 1040, 2], // the Fused Forge (Magma Golem)
    store: [-1160, 1010, -800, 1260, 1], // the Storeroom
    gallery: [660, 570, 1260, 750, 2], // the Gibbet Gallery
    pit: [1500, 280, 2160, 1040, 2], // the Furnace Pit (Furnace Hydra)
    den: [800, 1010, 1160, 1260, 1], // the Bone Wolf den (moved from the Mire, Robert 2026-11-09)
    ncw: [-580, -320, -340, 250, 3], // the Crystal Stair
    choir: [-1560, -560, -860, 160, 3], // the Molten Choir (Seething Seraph)
    vault: [-1440, -1000, -1080, -780, 4], // the Vault
    nce: [340, -320, 580, 250, 3], // the Broken Causeway
    roost: [860, -560, 1560, 160, 3], // the Deepfire Roost (Crucible Wyrm)
    bastion: [-320, -820, 320, -260, 4], // the Bound Bastion (Cinder Colossus)
    throne: [-640, -1820, 640, -1020, 5, "oval"], // the Ashen Throne's arena (the Ashen Sovereign)
  };
  Mi.FLOORS = FLOORS;
  // stairs rising north: x0, y0 (top), x1, y1 (foot), level at the foot
  const STAIRS = {
    sRun: [-70, 1392, 70, 1492, 0],
    sHall: [-70, 892, 70, 1012, 1],
    sStore: [-1040, 742, -920, 1022, 1],
    sDen: [920, 742, 1040, 1022, 1],
    sNcw: [-520, 242, -400, 412, 2],
    sNce: [400, 242, 520, 412, 2],
    sVault: [-1320, -792, -1200, -548, 3],
    sGreat: [-80, -272, 80, 412, 2], // the great stair: the Ash Hall up to the Bastion
    sThrone: [-80, -1032, 80, -808, 4],
  };
  // stone causeways over the drop: x1, y1, x2, y2, half width
  const BRIDGES = {
    bw1: [-420, 660, -660, 660, 40], bw2: [-1260, 660, -1500, 660, 40],
    be1: [420, 660, 660, 660, 40], be2: [1260, 660, 1500, 660, 40],
    bnw: [-580, -150, -860, -150, 40], bne: [580, -150, 860, -150, 40],
  };
  // where two pieces meet: [a, b, x, y] (the Drowned route through these)
  const JOINS = [
    ["gate", "sRun", 0, 1488], ["sRun", "run", 0, 1396], ["run", "sHall", 0, 1004], ["sHall", "hall", 0, 896],
    ["hall", "bw1", -416, 660], ["bw1", "mine", -664, 660], ["mine", "bw2", -1256, 660], ["bw2", "forge", -1504, 660],
    ["mine", "sStore", -980, 746], ["sStore", "store", -980, 1016],
    ["hall", "be1", 416, 660], ["be1", "gallery", 664, 660], ["gallery", "be2", 1256, 660], ["be2", "pit", 1504, 660],
    ["gallery", "sDen", 980, 746], ["sDen", "den", 980, 1016],
    ["hall", "sNcw", -460, 408], ["sNcw", "ncw", -460, 246], ["ncw", "bnw", -576, -150], ["bnw", "choir", -864, -150],
    ["choir", "sVault", -1260, -552], ["sVault", "vault", -1260, -786],
    ["hall", "sNce", 460, 408], ["sNce", "nce", 460, 246], ["nce", "bne", 576, -150], ["bne", "roost", 864, -150],
    ["hall", "sGreat", 0, 408], ["sGreat", "bastion", 0, -266], ["bastion", "sThrone", 0, -814], ["sThrone", "throne", 0, -1026],
  ];
  const RUNE = { x: 0, y: 660, r: 160, sq: 0.78 }; // the Ash Hall's rune circle (squashed: it lies on the floor)
  const EXIT = { x: -200, y: 1512 }; // the arch in the Gate Hall: home
  const THRONE = { x: 0, y: -1700 };
  const SPAWN = { x: 0, y: 1680 };
  const DEN = { x: 980, y: 1072 }; // the Bone Wolf den's mouth, in its room (src/den.js lays the pack in front of it)
  Mi.DEN = DEN;
  // The Mines can be entered (and so the den lies here, not in the Mire): for now in Sandbox only; Level 3's unlock
  // after the Rift Throne comes in step 7.
  Mi.open = () => !!DL.SANDBOX;
  // Ember Shrines: [x, y, name] (a knight-statue alcove; lit, it's the run's checkpoint)
  const SHRINES = [
    [200, 1520, "the Gate Hall"], [-300, 440, "the Ash Hall"], [-1960, 330, "the Fused Forge"], [1960, 330, "the Furnace Pit"],
    [-1380, -520, "the Molten Choir"], [1380, -520, "the Deepfire Roost"], [220, -790, "the Bound Bastion"],
  ];
  Mi.SHRINES_N = SHRINES.length;
  // things that stand up, drawn y-sorted with the knights: kind, x, y (, size)
  // the side rooms' chests (open once their guards fall): room -> x, y
  const CHESTS = { store: [-890, 1075], vault: [-1250, -945] };
  const PROPS = [
    ["arch", EXIT.x, EXIT.y], ["banner", EXIT.x - 70, 1500], ["banner", EXIT.x + 70, 1500],
    ...SHRINES.map(([x, y], i) => ["shrine", x, y, i]),
    // braziers: the hub's four corners, both ends of the Grate Run, the wings' doors, the Bastion and the arena
    ["brazier", -380, 440], ["brazier", 380, 440], ["brazier", -380, 870], ["brazier", 380, 870],
    ["brazier", -90, 1030], ["brazier", 90, 1030], ["brazier", -90, 1380], ["brazier", 90, 1380],
    ["brazier", -300, 1500], ["brazier", 300, 1500],
    ["brazier", -1520, 320], ["brazier", -1520, 1010], ["brazier", 1520, 320], ["brazier", 1520, 1010],
    ["brazier", -880, -530], ["brazier", -880, 130], ["brazier", 880, -530], ["brazier", 880, 130],
    ["brazier", -290, -790], ["brazier", -290, -290], ["brazier", 290, -290],
    ["brazier", -440, -1640], ["brazier", 440, -1640], ["brazier", -560, -1380], ["brazier", 560, -1380], ["brazier", -440, -1140], ["brazier", 440, -1140],
    ["banner", -120, -800], ["banner", 120, -800], ["banner", -160, 420], ["banner", 160, 420],
    ["throne", THRONE.x, THRONE.y],
    // the Slag Mine: carts on the track, a pit-head frame
    ["cart", -1120, 606], ["cart", -820, 734, 1], ["headframe", -1200, 590], // parked off the track (the runaway carts use it)
    // the Gibbet Gallery: a crane with a cage hanging over the way
    ["crane", 825, 600], ["cage", 860, 640], ["crane", 1095, 610, 1], ["cage", 1060, 660], // (1: arm reaching west)
    // the Crystal Stair: glowing magma crystals
    ["crystal", -560, -260, 1.2], ["crystal", -362, -40, 0.9], ["crystal", -560, 160, 1], ["crystal", -1500, -500, 1.3], ["crystal", -1100, -960, 1.1],
    // the Bone Wolf den, moved here from the Mire (Robert 2026-11-09)
    ["den", DEN.x, DEN.y],
    // the Storeroom and the Vault: crates
    ["crates", -1100, 1060], ["crates", -860, 1210], ["crates", -1400, -820], ["cartBroken", -1010, 1236],
  ];
  // solid circles: x, y, r
  const SOLIDS = [
    [EXIT.x - 44, EXIT.y, 18], [EXIT.x + 44, EXIT.y, 18], [THRONE.x, THRONE.y - 30, 110],
    ...SHRINES.map(([x, y]) => [x, y - 10, 34]),
    ...PROPS.filter((q) => q[0] === "brazier").map((q) => [q[1], q[2] - 4, 14]),
    ...PROPS.filter((q) => q[0] === "crane" || q[0] === "headframe").map((q) => [q[1] + (q[3] ? 28 : -28), q[2], 16]), // the post
    ...PROPS.filter((q) => q[0] === "crystal").map((q) => [q[1], q[2] - 6, 14 * q[3]]),
    ...PROPS.filter((q) => q[0] === "crates").map((q) => [q[1], q[2] - 8, 26]),
    [DEN.x, DEN.y - 4, 40], [-1010, 1230, 26],
    [-1120, 600, 18], [-820, 728, 18],
  ];
  // basalt columns standing up out of the lava (not walkable): x, y, width, level
  const PILLARS = [
    [-700, 300, 70, 2], [700, 300, 70, 2], [-700, 1000, 60, 1], [700, 1000, 60, 1], [-420, 1250, 64, 0], [420, 1250, 64, 0],
    [-1800, 1300, 80, 1], [1800, 1300, 80, 1], [-1900, -200, 70, 2], [1900, -200, 70, 2], [-2300, 700, 60, 1], [2300, 700, 60, 1],
    [-900, -800, 70, 3], [900, -800, 70, 3], [-650, -1100, 60, 4], [650, -1100, 60, 4], [-1100, -1500, 76, 4], [1100, -1500, 76, 4],
    [-900, -1950, 64, 5], [900, -1950, 64, 5], [0, 1950, 70, 0], [-600, 1700, 60, 0], [600, 1700, 60, 0], [1300, 1400, 66, 0], [-1300, 1500, 66, 0],
    [1700, -800, 70, 3], [-1700, -900, 70, 3], [0, -2050, 80, 5], [-250, -500, 40, 3], [250, -500, 40, 3],
  ].filter((q) => !Object.values(FLOORS).some((f) => q[0] + q[2] > f[0] - 30 && q[0] - q[2] < f[2] + 30 && q[1] + q[2] > f[1] - 30 && q[1] - q[2] < f[3] + 260));
  // lava falls pouring from cracks in the faces: x, width, the floor whose face they pour down
  const FALLS = [[-250, 34, "hall"], [260, 26, "hall"], [-1820, 40, "forge"], [1840, 40, "pit"], [-1200, 30, "choir"], [1230, 30, "roost"], [-200, 30, "bastion"], [0, 26, "gate"]];

  /* ---------------- where you can stand ---------------- */
  Mi.inRegion = (x, y) => Math.abs(x - OX) < S.halfW && Math.abs(y - OY) < S.halfH;
  Mi.active = () => !!G.spires && G.spires.lv === "mines";
  const geo = DL.DungeonGeo({ FLOORS, STAIRS, BRIDGES, JOINS, SOLIDS, ox: OX, oy: OY, inRegion: Mi.inRegion });
  Mi.walkable = geo.walkable;
  Mi.pieceAt = (x, y, m = 0) => geo.pieceAt(x - OX, y - OY, m);
  Mi.collide = function (ent, r) {
    if (!Mi.inRegion(ent.x, ent.y)) return;
    DL.MineTraps.collide(ent, r); // a fallen cage is a wall (src/minetraps.js)
    const sp = G.spires, hold = sp && sp.lv === "mines" && sp.seal && ((ent === G.player && sp.held) || ent.room === sp.seal) ? FLOORS[sp.seal] : null; // a shut room keeps you (if it shut round you) and its guards in
    geo.collide(ent, r, hold, ent === G.player ? { x: OX + SPAWN.x, y: OY + SPAWN.y } : null);
    if (sp && sp.lv === "mines") barGreat(ent);
  };
  /* The great stair up to the Bound Bastion stays barred by fire until the four wing lords (the Golem, the Hydra, the
     Wyrm and the Seraph) have fallen this run. */
  const WINGS = ["forge", "pit", "roost", "choir"], GREAT = [0, 408];
  Mi.wingsLeft = () => { const sp = G.spires; return sp ? WINGS.filter((r) => !sp.cleared[r]).length : WINGS.length; };
  let barredT = 0;
  function barGreat(ent) {
    if (ent !== G.player || !Mi.wingsLeft()) return;
    const lx = ent.x - OX, ly = ent.y - OY;
    if (Math.abs(lx) > 90 || ly > GREAT[1] - 4 || ly < -280) return;
    ent.y = OY + GREAT[1] - 4 + 0.01;
    if (G.t > barredT) { barredT = G.t + 4; const n = Mi.wingsLeft(); say(`Fire bars the great stair: ${n} wing lord${n > 1 ? "s" : ""} still stand${n > 1 ? "" : "s"}.`, "warn"); }
  }
  Mi.route = (x, y, tx, ty) => (Mi.active() && Mi.inRegion(x, y) ? geo.route(x, y, tx, ty) : null);

  /* ---------------- going in and out ---------------- */
  const followers = () => [...G.hounds, ...G.golems, ...G.kindles];
  const shrinesSave = () => (G.save.minesShrines = G.save.minesShrines || {});
  function checkpoint() {
    const at = shrinesSave().at;
    return at != null && SHRINES[at] ? { x: OX + SHRINES[at][0], y: OY + SHRINES[at][1] + 60 } : { x: OX + SPAWN.x, y: OY + SPAWN.y };
  }
  Mi.checkpoint = () => (G.spires && G.spires.cp) || checkpoint(); // a friend's device: the host's
  Mi.enter = function () {
    const p = G.player;
    if (!p || G.spires || G.cave) return;
    const saved = shrinesSave();
    for (const e of G.enemies) if (Mi.inRegion(e.x, e.y) && !e.def.den) e.removed = true; // a run starts fresh (the den's pack keeps its own count)
    G.enemies = G.enemies.filter((e) => !e.removed);
    G.spires = { lv: "mines", bx: p.x, by: p.y, flare: 0, seal: null, held: false, cleared: {}, lit: {}, litT: {}, away: {}, shard: 0, aether: 0, obsidian: 0, heart: 0, opened: {}, won: false };
    for (const i in saved) if (i !== "at" && saved[i]) { G.spires.lit[i] = true; G.spires.litT[i] = -99; }
    DL.MineTraps.reset();
    DL.MineFoes.reset();
    DL.MineBosses.reset();
    const cp = checkpoint();
    p.x = cp.x; p.y = cp.y; p.spx = p.x; p.spy = p.y;
    p.kx = p.ky = 0; p.dashT = 0; p.angle = -Math.PI / 2;
    for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); f.spx = null; }
    G.camera.x = p.x; G.camera.y = p.y - 20;
    for (const a of G.allies) pull(a);
    if (G.allies.length) DL.Net.say("Your host steps through, and the heat takes you with them: the Molten Mines.", "good");
    say(saved.at != null ? "Back at your Ember Shrine. Walk away and come back to it to go home." : "The Molten Mines. The Ash Hall lies up the Grate Run: four wings round it, and the throne at the top.", "good");
  };
  // Host: bring a friend's knight in beside yours (their device moves it; the host's copy goes now so the foes see it)
  function pull(a) {
    const p = G.player, x = p.x + 34 * a.id * (a.id % 2 ? 1 : -1) / 2, y = p.y + 16;
    a.x = a.tx = x; a.y = a.ty = y;
    DL.Net.sendTo(a.id, { t: "mines", on: 1, x, y, cp: [Math.round(p.x), Math.round(p.y)] });
  }
  // Host: a friend who joins while the run is on comes straight in
  Mi.join = (a) => { if (Mi.active() && !G.spires.guest) pull(a); };
  // Host: every friend back out beside the host's knight (or cast out with the run: the host fell)
  function sendHome(msg, kind) {
    const p = G.player, out = p && !Mi.inRegion(p.x, p.y), x0 = out ? p.x : 0, y0 = out ? p.y : 70;
    for (const a of G.allies) {
      const x = x0 + 34 * a.id * (a.id % 2 ? 1 : -1) / 2, y = y0 + 12;
      a.x = a.tx = x; a.y = a.ty = y;
      DL.Net.sendTo(a.id, { t: "mines", on: 0, x, y, m: msg, k: kind });
    }
  }
  // what this run has found so far (DL.MINE_LOOT)
  Mi.bag = () => (G.spires && G.spires.lv === "mines" ? { obsidian: G.spires.obsidian, heart: G.spires.heart } : null);
  const gain = (x, y, n, heart) => {
    const sp = G.spires;
    if (heart) sp.heart += heart;
    sp.obsidian += n;
    G.texts.push({ x, y: y - 50, txt: (n ? `+${n} Obsidian` : "") + (heart ? `${n ? "  " : ""}+${heart} Magma Heart` : ""), col: heart ? "#ff8a3a" : "#c3b2d6", t: 0, max: heart ? 2 : 1, scale: heart ? 1.2 : 0.9 });
  };
  // a mini boss's Magma Heart comes once per world, the first time it dies
  function bossLoot(e) {
    const L = DL.MINE_LOOT, hearts = (G.save.minesHearts = G.save.minesHearts || {}), sov = e.def.mine === "sovereign";
    const heart = !sov && !hearts[e.type] ? 1 : 0;
    if (heart) hearts[e.type] = 1;
    gain(e.x, e.y - 100, sov ? L.sovereign : L.boss, heart);
    if (heart) setTimeout(() => say("A Magma Heart beats where it fell: carry it home.", "good"), 1500);
    if (sov) {
      G.spires.won = true;
      setTimeout(() => say("Walk back out the way you came: everything you carry comes home with you.", "good"), 6000);
    }
  }
  // a room's foe fell: Wretches feed; the last of a shut room's group opens it
  Mi.onKill = function (e) {
    if (e.def.boss) { DL.MineBosses.slain(e); bossLoot(e); }
    else if (e.def.minion && DL.MINE_LOOT.kill[e.type]) gain(e.x, e.y, DL.MINE_LOOT.kill[e.type]);
    DL.MineFoes.slain(e);
    const sp = G.spires;
    if (sp && sp.seal === e.room && !DL.MineFoes.left(e.room)) {
      sp.cleared[e.room] = true; sp.seal = null;
      DL.Sound.play("chime");
      say("The fire curtains die down. The way is open.", "good");
    }
  };
  Mi.lost = () => { if (G.spires && !G.spires.guest && G.allies.length) sendHome("Your host has fallen in the Mines. The run is lost, and everything it found with it.", "danger"); };
  Mi.leave = function () {
    const sp = G.spires, p = G.player;
    if (!sp || sp.lv !== "mines") return;
    G.spires = null;
    DL.Bullets.clear();
    DL.MineTraps.reset();
    DL.MineFoes.reset();
    DL.MineBosses.reset();
    for (const e of G.enemies) if (Mi.inRegion(e.x, e.y) && !e.def.den) e.removed = true;
    G.enemies = G.enemies.filter((e) => !e.removed);
    if (p) {
      p.x = sp.bx; p.y = sp.by; p.kx = p.ky = 0; p.dashT = 0;
      if (Mi.inRegion(p.x, p.y)) { p.x = 0; p.y = 70; }
      for (const f of followers()) { f.x = p.x + DL.rand(-30, 30); f.y = p.y + DL.rand(-10, 20); }
      G.camera.x = p.x; G.camera.y = p.y - 20;
    }
    const k = sp.won ? 1 : DL.MINE_LOOT.keep, got = { obsidian: Math.floor(sp.obsidian * k), heart: sp.heart }; // a Magma Heart is never halved
    const home = DL.Rift.bringHome(got), msg = home ? `You climb back out of the heat with ${home}${sp.won ? "" : " (half the Obsidian: the Mines keep the rest)"}.` : "You climb back out of the heat.";
    sendHome(msg, "good");
    say(msg, "good");
  };

  // The way home, and the Ember Shrines.
  Mi.update = function (dt) {
    const sp = G.spires, p = G.player;
    if (!sp || !p) return;
    if (!Mi.inRegion(p.x, p.y)) { G.spires = null; return; }
    sp.flare = Math.max(0, sp.flare - dt * 0.5);
    const lx = p.x - OX, ly = p.y - OY, atExit = Math.abs(lx - EXIT.x) < 30 && ly < EXIT.y - 4 && ly > EXIT.y - 40;
    if (sp.guest) return guestUpdate(sp, p, dt, lx, ly, atExit);
    if (atExit) { Mi.leave(); return; }
    DL.MineTraps.update(dt); // the corridors' traps (src/minetraps.js)
    DL.MineFoes.update(dt); // the Sovereign's minions at their posts (src/minefoes.js)
    const pt = DL.MineBosses.party(), pieces = pt.map((k) => geo.pieceAt(k.x - OX, k.y - OY, 30));
    // a mini boss wakes when any knight steps into its room (src/minebosses.js)
    DL.MineBosses.update(dt, pieces.find((r) => r && DL.MineBosses.ROOMS[r] && !sp.cleared[r]) || null);
    // a cleared side room's chest: walk up to it
    for (const id in CHESTS) {
      const q = CHESTS[id];
      if (!sp.cleared[id] || sp.opened[id] || !pt.some((k) => Math.hypot(k.x - OX - q[0], k.y - OY - q[1] - 14) < 48)) continue;
      sp.opened[id] = true;
      const C = DL.MINE_LOOT.chest, n = Math.round(DL.rand(C[0], C[1]));
      gain(OX + q[0], OY + q[1], n);
      for (let k = 0; k < 24; k++) G.puff(OX + q[0] + DL.rand(-20, 20), OY + q[1] - DL.rand(0, 50), "rgba(255,170,80,0.85)", 90, 0.9, -20);
      DL.Sound.play("milestone");
      all(`The chest springs open: ${n} Obsidian.`, "good");
    }
    // a side room with its guards still standing shuts behind you (fire curtains over its doors) until they fall
    if (!sp.seal) {
      const room = pieces.find((r) => r && DL.MineFoes.SEAL.includes(r) && !sp.cleared[r] && DL.MineFoes.left(r));
      if (room) {
        sp.seal = room;
        DL.Sound.play("torch");
        all("Fire curtains roar up across the doors. Break the guards to open them.", "warn");
      }
    }
    heldBy(sp, p);
    SHRINES.forEach(([x, y, name], i) => {
      const d = Math.hypot(lx - x, ly - y - 50);
      if (!sp.lit[i]) {
        if (!pt.some((k) => Math.hypot(k.x - OX - x, k.y - OY - y - 50) < 80)) return;
        sp.lit[i] = true; sp.litT[i] = G.t; sp.away[i] = false;
        const sv = shrinesSave(); sv[i] = true; sv.at = i; G.persist();
        for (let k = 0; k < 24; k++) G.puff(OX + x + DL.rand(-26, 26), OY + y - DL.rand(0, 80), "rgba(255,190,90,0.85)", 80, 0.9);
        DL.Sound.play("chime");
        all(`The Ember Shrine of ${name} kindles. It's your checkpoint now.`, "good");
        return;
      }
      // a lit shrine, walked away from and come back to: stand at it a moment to go home
      if (d > 140) sp.away[i] = true;
      if (sp.away[i] && d < 46 && !sp.seal) {
        sp.homeT = (sp.homeT || 0) + dt;
        if (sp.homeT > S.home) { sp.homeT = 0; Mi.leave(); }
      } else if (d < 46) sp.homeT = 0;
    });
  };

  // a room shut round this device's knight keeps it in; one that shut while it stood outside doesn't
  function heldBy(sp, p) {
    if (sp.seal === sp.sealWas) return;
    sp.sealWas = sp.seal;
    sp.held = !!(sp.seal && geo.inRect(p.x - OX, p.y - OY, FLOORS[sp.seal], 20));
  }
  // A friend's device: traps for its own knight, the host's pieces moving between snapshots, and the ways home (the
  // arch, a lit shrine walked back to), which ask the host to take everyone out.
  function guestUpdate(sp, p, dt, lx, ly, atExit) {
    DL.MineTraps.update(dt);
    DL.MineBosses.tick(dt);
    DL.MineFoes.tick(dt);
    heldBy(sp, p);
    let home = atExit;
    SHRINES.forEach(([x, y], i) => {
      if (!sp.lit[i]) return;
      const d = Math.hypot(lx - x, ly - y - 50);
      if (d > 140) sp.away[i] = true;
      if (sp.away[i] && d < 46 && !sp.seal) { sp.homeT = (sp.homeT || 0) + dt; if (sp.homeT > S.home) home = true; }
    });
    if (home && !sp.asked) { sp.asked = true; sp.homeT = 0; DL.Net.event({ t: "spLeave", all: 0 }); }
    if (!home) sp.asked = false;
  }

  /* ---------------- co-op ---------------- */
  const all = (m, k) => { say(m, k); if (DL.Net && G.allies.length) DL.Net.say(m, k); }; // the host's news, on every friend's screen too
  const keys = (o) => Object.keys(o).filter((k) => o[k]);
  const flags = (list) => { const o = {}; for (const k of list || []) o[k] = true; return o; };
  // Host: the run's state for each snapshot (`m` marks it as the Mines' for DL.Dungeon.applySnap)
  Mi.snap = function (near) {
    const sp = G.spires;
    if (!sp) return 0;
    return { m: 1, s: [sp.seal, keys(sp.cleared), keys(sp.lit), keys(sp.opened), sp.won ? 1 : 0, sp.obsidian, sp.heart, Math.round(sp.flare * 100) / 100],
      b: DL.Bullets.rows(near), mb: DL.MineBosses.snap(near), pu: DL.MineFoes.snap(near) };
  };
  // Guest: the host's run, from a snapshot
  Mi.applySnap = function (q) {
    const sp = G.spires;
    if (!q) { if (sp && sp.guest && sp.lv === "mines" && !sp.fresh) guestOut(); return; }
    if (!sp || !sp.guest || sp.lv !== "mines") return; // the "in" message comes first
    sp.fresh = false;
    const s = q.s;
    sp.seal = s[0]; sp.cleared = flags(s[1]);
    for (const i of s[2]) if (!sp.lit[i]) { sp.lit[i] = true; sp.litT[i] = G.t; }
    sp.opened = flags(s[3]); sp.won = !!s[4]; sp.obsidian = s[5]; sp.heart = s[6]; sp.flare = s[7];
    DL.Bullets.apply(q.b);
    DL.MineBosses.apply(q.mb);
    DL.MineFoes.apply(q.pu);
  };
  function guestOut() {
    G.spires = null;
    DL.Bullets.clear(); DL.MineTraps.reset(); DL.MineFoes.reset(); DL.MineBosses.reset();
  }
  // Guest: the host took us in, or sent us home
  Mi.guestMsg = function (m) {
    const p = G.player;
    if (m.on) {
      if (G.state === "camp") DL.UI.closeCamp();
      G.spires = { lv: "mines", guest: true, fresh: true, flare: 0, seal: null, held: false, cleared: {}, lit: {}, litT: {}, away: {}, opened: {}, shard: 0, aether: 0, obsidian: 0, heart: 0, won: false,
        cp: m.cp ? { x: m.cp[0], y: m.cp[1] + 12 } : null };
      G.enemies = []; G.projectiles = [];
      DL.Bullets.clear(); DL.MineTraps.reset(); DL.MineFoes.reset(); DL.MineBosses.reset();
      p.downT = 0;
    } else {
      guestOut();
      G.enemies = [];
      if (p.downT > 0) { p.downT = 0; p.hp = Math.max(1, G.stats().maxHp * 0.5); }
      if (m.m) say(m.m, m.k);
    }
    p.x = m.x; p.y = m.y; p.spx = p.x; p.spy = p.y; p.kx = p.ky = 0; p.dashT = 0; p.inv = 1.5;
    G.camera.x = p.x; G.camera.y = p.y - 20;
  };

  /* ---------------- painting (all once, into canvases) ---------------- */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mix(a, b, k) {
    const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    k = Math.max(0, Math.min(1, k));
    const v = [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k));
    return `rgb(${v[0]},${v[1]},${v[2]})`;
  }
  // Robert's lava fortress palette (his concept sheets): basalt, crimson cloth, molten orange to white-hot
  const C = {
    grout: "#1a1012", topD: "#3a2a2a", topL: "#7a5c54", rim: "#8a6a5e", rimD: "#4a3434",
    face: "#2e2022", faceD: "#160d0e", faceL: "#4e3836", mortar: "#0e0708",
    wood: "#4a3020", woodL: "#6e4a30", iron: "#2a2426", ironL: "#5a5050",
    cloth: "#8e1f22", clothL: "#b83a2e", gold: "#d9a33a",
    hot: "#f06a12", hotL: "#ffb52e", hotH: "#ffe9b0",
  };
  const GLOW = "255,140,40";
  const BX0 = -2400, BY0 = -2100, BX1 = 2400, BY1 = 2000; // the painted extent (local)
  const CH = 1024;
  let chunks = new Map(), art = null;

  // Robert's drawn pieces (tools/cut_mines.py, 2 file px per world px unless noted). They load when the Mines are first
  // drawn; until then (and in the node tests) the coded stone shows, and when the last one lands the chunks repaint.
  const ART_N = ["floor-1", "floor-2", "floor-3", "face-1-head", "face-1-band", "face-1-foot", "face-2-head", "face-2-band", "face-2-foot",
    "fall-1", "fall-2", "fall-3", "fall-4", "stairs", "rune-circle", "arch", "throne", "arena-2", "brazier", "banner", "shrine-dark", "shrine-lit",
    "seal-1", "seal-2", "seal-3", "crane", "cage-hang", "cart-side", "cart-front", "cart-broken", "rail",
    // the traps' (src/minetraps.js)
    "grate-1", "grate-2", "grate-3", "grate-flame-1", "grate-flame-2", "grate-flame-3", "grate-flame-4", "cage-down", "cage-broken",
    "golem-fist", "golem-pool", "golem-core", "shard-1", "shard-2", "shard-3", "shard-crack", "shard-break", "shard-burst", "colossus-mortar", "colossus-chain", "colossus-fist", "chest-shut", "chest-open", "jet-head", "jet-1", "jet-2", "jet-3", "jet-4", "crumble-1", "crumble-2", "crumble-3", "crumble-4", "geyser-1", "geyser-2", "geyser-3", "geyser-4"];
  const IMG = {};
  Mi.IMG = IMG; // src/minetraps.js draws from it too
  let loading = false;
  function loadArt() {
    if (loading || typeof Image === "undefined") return;
    loading = true;
    let left = ART_N.length;
    const got = {};
    // all at once, so no piece is drawn half-dressed (a missing file keeps that piece coded)
    const done = () => { if (--left === 0) { Object.assign(IMG, got); chunks = new Map(); } };
    for (const n of ART_N) {
      const im = new Image();
      im.onload = () => { got[n] = im; done(); };
      im.onerror = done;
      im.src = DL.asset("assets/sprites/mines/" + n + ".png");
    }
  }
  // the wall rows at the top of each face's foot picture (world px), from the cutter
  const FOOT_WALL = { 1: 21.5, 2: 18 };
  // The drawn face: the column caps once, the mid-wall tiled down as far as it needs, then the foot (the rest of the wall
  // and its hanging rock) once; shaded and sunk into the mist like the coded one.
  function faceArt(g, x0, x1, y, h, r, v) {
    const head = IMG["face-" + v + "-head"], band = IMG["face-" + v + "-band"], foot = IMG["face-" + v + "-foot"];
    const hw = head.width / 2, hh = head.height / 2, bh = band.height / 2, fh = foot.height / 2, fwall = FOOT_WALL[v];
    const fy = Math.max(0, h - fwall), w = Math.round(x1 - x0), H = Math.round(Math.max(fy, hh) + fh) + 1, t = mk(w, H), q = t.getContext("2d");
    const off = r() * hw;
    for (let yy = Math.min(hh, fy); yy < fy; yy += bh) for (let xx = -off; xx < w; xx += hw) q.drawImage(band, xx, yy, hw + 0.5, bh + 0.5);
    for (let xx = -off; xx < w; xx += hw) q.drawImage(foot, xx, fy, hw + 0.5, fh);
    for (let xx = -off; xx < w; xx += hw) q.drawImage(head, xx, 0, hw + 0.5, Math.min(hh, fy + 4));
    q.globalCompositeOperation = "source-atop";
    let gr = q.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(255,200,160,0.12)"); gr.addColorStop(Math.min(0.2, 24 / w), "rgba(255,200,160,0)");
    gr.addColorStop(Math.max(0.8, 1 - 24 / w), "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    gr = q.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.7, "rgba(10,0,0,0.25)"); gr.addColorStop(1, "rgba(60,48,50,0.6)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    q.fillStyle = "rgba(0,0,0,0.4)"; q.fillRect(0, 0, w, 3);
    g.drawImage(t, x0, y);
  }

  // the runs of an edge at y between x0 and x1 that no stair or causeway comes in through
  function runs(x0, x1, y, gaps) {
    const cut = gaps.filter((q) => Math.abs(q[1] - y) < 30 && q[0] > x0 - 60 && q[0] < x1 + 60).map((q) => [q[0] - 60, q[0] + 60]).sort((a, b) => a[0] - b[0]);
    const out = [];
    let x = x0;
    for (const [a, b] of cut) { if (a > x) out.push([x, a]); x = Math.max(x, b); }
    if (x < x1) out.push([x, x1]);
    return out;
  }

  // A basalt face hanging from a floor's south edge: tall columns, molten seams, the foot lost in the mist.
  function face(g, x0, x1, y, h, r) {
    if (IMG["face-1-foot"] && IMG["face-2-foot"]) return faceArt(g, x0, x1, y, h, r, r() < 0.5 ? 1 : 2);
    const w = Math.round(x1 - x0), H = Math.round(h + 60), t = mk(w, H), q = t.getContext("2d");
    q.fillStyle = C.face;
    q.beginPath(); q.moveTo(0, 0); q.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 10) {
      const edge = Math.min(1, Math.min(x, w - x) / 30);
      q.lineTo(x, h * (0.8 + 0.2 * edge) + r() * 50 * edge);
    }
    q.closePath(); q.fill();
    q.globalCompositeOperation = "source-atop";
    // basalt columns: tall blocks, each its own shade, broken into courses
    for (let x = -r() * 20; x < w; ) {
      const cw = 14 + r() * 14, k = 0.2 + r() * 0.45;
      for (let yy = 0; yy < H; ) {
        const ch = 26 + r() * 30;
        q.fillStyle = mix(C.faceD, C.faceL, k - Math.min(0.35, (yy / H) * 0.45) + r() * 0.08);
        q.fillRect(x + 1, yy + 1, cw - 2, ch - 2);
        q.fillStyle = "rgba(255,220,200,0.07)"; q.fillRect(x + 1, yy + 1, 2, ch - 2); // lit west edge
        yy += ch;
      }
      q.fillStyle = C.mortar; q.fillRect(x, 0, 1, H);
      x += cw;
    }
    // molten seams creeping up from the foot
    q.lineWidth = 1.5;
    for (let i = 0; i < Math.max(1, w / 120); i++) {
      let sx = r() * w, sy = H - 4;
      const top = H * (0.25 + r() * 0.4);
      q.strokeStyle = `rgba(255,${120 + Math.round(r() * 60)},40,0.7)`;
      q.beginPath(); q.moveTo(sx, sy);
      while (sy > top) { sx += (r() - 0.5) * 10; sy -= 6 + r() * 10; q.lineTo(sx, sy); }
      q.stroke();
    }
    // the corners turn from the light; the foot sinks into the mist below
    let gr = q.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(255,200,160,0.12)"); gr.addColorStop(Math.min(0.2, 24 / w), "rgba(255,200,160,0)");
    gr.addColorStop(Math.max(0.8, 1 - 24 / w), "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    gr = q.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0.05)"); gr.addColorStop(0.55, "rgba(10,0,0,0.35)"); gr.addColorStop(0.8, "rgba(60,48,50,0.5)"); gr.addColorStop(1, "rgba(80,70,72,0.95)");
    q.fillStyle = gr; q.fillRect(0, 0, w, H);
    q.fillStyle = "rgba(0,0,0,0.4)"; q.fillRect(0, 0, w, 3); // the floor's lip throws its shadow
    g.drawImage(t, x0, y);
  }

  // A floor's top: basalt flagstones in offset rows, ember-lit grout here and there, a kerb round the edge.
  function top(g, x0, y0, x1, y1, r, gaps) {
    g.save();
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.fillStyle = C.grout; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const drawn = IMG["floor-1"];
    if (drawn) { // Robert's tiles, on one grid for the whole Mines so neighbouring floors line up
      const T = 192;
      for (let ty = BY0 + Math.floor((y0 - BY0) / T) * T; ty < y1; ty += T)
        for (let tx = BX0 + Math.floor((x0 - BX0) / T) * T; tx < x1; tx += T) {
          const k = r(), im = (k < 0.12 && IMG["floor-3"]) || (k < 0.45 && IMG["floor-2"]) || IMG["floor-1"];
          g.drawImage(im, tx, ty, T, T);
        }
    }
    const TW = 24, TH = 18;
    for (let row = 0, y = drawn ? y1 : y0; y < y1; row++, y += TH) {
      for (let x = x0 - (row % 2) * (TW / 2); x < x1; x += TW) {
        const k = 0.2 + r() * 0.4;
        g.fillStyle = mix(C.topD, C.topL, k); g.fillRect(x + 1, y + 1, TW - 2, TH - 2);
        g.fillStyle = mix(C.topD, C.topL, k + 0.18); g.fillRect(x + 1, y + 1, TW - 2, 2);
        g.fillStyle = mix(C.topD, C.topL, k - 0.2); g.fillRect(x + 1, y + TH - 3, TW - 2, 2);
        const roll = r();
        if (roll < 0.06) { // a crack with fire in it
          g.strokeStyle = "rgba(255,130,40,0.65)"; g.lineWidth = 1;
          g.beginPath(); const cx = x + 3 + r() * 14; g.moveTo(cx, y + 2); g.lineTo(cx + r() * 6 - 3, y + 8); g.lineTo(cx + r() * 8 - 4, y + TH - 3); g.stroke();
        } else if (roll < 0.1) { // ash
          g.fillStyle = "rgba(160,150,150,0.25)"; g.fillRect(x + 3 + r() * 10, y + 4 + r() * 6, 6, 3);
        } else if (roll < 0.13) { // an ember in the grout
          g.fillStyle = `rgba(${GLOW},0.7)`; g.fillRect(x, y + TH - 2, 3, 2);
        }
      }
    }
    // kerb blocks round the edge (with gaps where stairs and causeways come in)
    const open = (x, y) => gaps.some((q) => Math.hypot(x - q[0], y - q[1]) < 58);
    const kerb = (x, y, w, h) => {
      g.fillStyle = C.rimD; g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.rimD, C.rim, 0.4 + r() * 0.5); g.fillRect(x + 1, y + 1, w - 2, h - 3);
      g.fillStyle = "rgba(255,230,210,0.15)"; g.fillRect(x + 1, y + 1, w - 2, 1);
    };
    for (let x = x0; x < x1; x += 24) {
      if (!open(x + 12, y0)) kerb(x, y0, 24, 8);
      if (!open(x + 12, y1)) kerb(x, y1 - 8, 24, 8);
    }
    for (let y = y0 + 8; y < y1 - 8; y += 24) {
      if (!open(x0, y + 12)) kerb(x0, y, 8, Math.min(24, y1 - 8 - y));
      if (!open(x1, y + 12)) kerb(x1 - 8, y, 8, Math.min(24, y1 - 8 - y));
    }
    // merlons along the south edge (a parapet you can see over)
    for (const [a, b] of runs(x0, x1, y1, gaps)) for (let x = a + 14; x < b - 26; x += 52) {
      g.fillStyle = C.rim; g.fillRect(x, y1 - 20, 18, 8);
      g.fillStyle = C.faceL; g.fillRect(x, y1 - 12, 18, 12);
      g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x + 13, y1 - 12, 5, 12);
    }
    g.restore();
  }

  // The rune circle set into the Ash Hall: rings of wedge stones round a sun.
  function runeFloor(g, r, R0) {
    const RU = R0 || RUNE, im = !R0 && IMG["rune-circle"];
    if (im) { const w = RU.r * 2 + 14, h = (w * im.height) / im.width; g.drawImage(im, RU.x - w / 2, RU.y - h / 2, w, h); return; }
    g.save();
    g.translate(RU.x, RU.y); g.scale(1, RU.sq);
    g.fillStyle = C.grout; g.beginPath(); g.arc(0, 0, RU.r + 4, 0, Math.PI * 2); g.fill();
    for (let R = RU.r; R > 26; R -= 24) {
      const n = Math.max(8, Math.round((Math.PI * 2 * R) / 34)), off = r() * 0.5;
      for (let i = 0; i < n; i++) {
        const a0 = ((i + off) / n) * Math.PI * 2 + 0.012, a1 = ((i + 1 + off) / n) * Math.PI * 2 - 0.012;
        g.fillStyle = mix(C.topD, C.topL, 0.3 + r() * 0.35 + (R === RU.r ? 0.15 : 0));
        g.beginPath(); g.arc(0, 0, R - 1, a0, a1); g.arc(0, 0, R - 22, a1, a0, true); g.closePath(); g.fill();
      }
    }
    g.fillStyle = mix(C.topD, C.topL, 0.6); g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#140a0a"; g.lineWidth = 4;
    for (const R of [RU.r * 0.75, RU.r * 0.43]) { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  // Stairs rising north: basalt treads and risers between low walls.
  function stairs(g, q, r) {
    if (IMG.stairs) return stairsArt(g, q);
    const [x0, y0, x1, y1] = q, n = Math.max(5, Math.round((y1 - y0) / 16)), h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * h, k = 0.3 + 0.25 * (1 - i / n);
      g.fillStyle = mix(C.topD, C.topL, k + r() * 0.08); g.fillRect(x0, y, x1 - x0, h * 0.6);
      g.fillStyle = mix(C.topD, C.topL, k + 0.22); g.fillRect(x0, y, x1 - x0, 1.5);
      g.fillStyle = mix(C.faceD, C.face, 0.6 + r() * 0.3); g.fillRect(x0, y + h * 0.6, x1 - x0, h * 0.4);
      if (r() < 0.2) { g.fillStyle = `rgba(${GLOW},0.45)`; g.fillRect(x0 + 6 + r() * (x1 - x0 - 12), y + h * 0.6, 4, 1); }
    }
    for (const x of [x0 - 4, x1 - 6]) { // side walls
      g.fillStyle = C.rimD; g.fillRect(x, y0 - 6, 10, y1 - y0 + 6);
      g.fillStyle = C.rim; g.fillRect(x + 1, y0 - 6, 8, y1 - y0 + 2);
      for (let y = y0; y < y1; y += 22) { g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x + 1, y, 8, 1); }
      g.fillStyle = C.faceL; g.fillRect(x, y1 - 12, 10, 12); g.fillStyle = C.rim; g.fillRect(x, y1 - 14, 10, 3);
    }
  }

  // The drawn flight (file px: treads 86..394 across, 156..514 down; the top piece ends at 228, the foot starts at 336).
  // Scaled to the stair's width; a long stair repeats the middle treads, a short one is squeezed.
  function stairsArt(g, q) {
    const im = IMG.stairs, [x0, y0, x1, y1] = q, k = (x1 - x0) / (394 - 86), L = y1 - y0, X = x0 - 86 * k, W = im.width * k;
    const TT = 156, TB = 514, M0 = 228, M1 = 336;
    if (L < (TB - TT) * k) { const sy = L / (TB - TT); g.drawImage(im, X, y0 - TT * sy, W, im.height * sy); return; }
    g.drawImage(im, 0, 0, im.width, M0, X, y0 - TT * k, W, M0 * k); // the top tread and its brazier posts
    const fy = y1 - (TB - M1) * k; // where the foot piece starts
    g.drawImage(im, 0, M1, im.width, im.height - M1, X, fy, W, (im.height - M1) * k);
    g.save(); g.beginPath(); g.rect(X - 2, y0 + (M0 - TT) * k, W + 4, fy - (y0 + (M0 - TT) * k)); g.clip();
    for (let y = y0 + (M0 - TT) * k; y < fy; y += (M1 - M0) * k) g.drawImage(im, 0, M0, im.width, M1 - M0, X, y, W, (M1 - M0) * k + 0.5);
    g.restore();
  }

  // A stone causeway over the misty drop: a basalt deck on arches, parapets each side.
  function causeway(g, q, r) {
    let [ax, ay, bx, by, hw] = q;
    if (bx < ax) [ax, ay, bx, by] = [bx, by, ax, ay];
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
    g.save(); g.translate(ax, ay); g.rotate(ang);
    // the arches under it, seen past its south edge
    g.fillStyle = C.face; g.fillRect(-2, hw, len + 4, 70);
    for (let s = 20; s < len - 20; s += 60) {
      g.fillStyle = "#1a0c08"; g.beginPath(); g.ellipse(s + 20, hw + 70, 18, 46, 0, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(90,80,82,0.45)"; g.fillRect(s + 6, hw + 56, 28, 14); // mist drifting through the arch
    }
    const gr = g.createLinearGradient(0, hw, 0, hw + 70);
    gr.addColorStop(0, "rgba(0,0,0,0.2)"); gr.addColorStop(1, "rgba(80,70,72,0.85)");
    g.fillStyle = gr; g.fillRect(-2, hw, len + 4, 70);
    // the deck
    g.fillStyle = C.grout; g.fillRect(-4, -hw, len + 8, hw * 2);
    if (IMG["floor-1"]) { // Robert's flagstones along the deck
      g.save(); g.beginPath(); g.rect(-4, -hw, len + 8, hw * 2); g.clip();
      for (let s = -4 - r() * 100; s < len + 4; s += 192) g.drawImage(IMG["floor-1"], s, -96, 192, 192);
      g.restore();
    } else for (let s = -4; s < len + 4; s += 20) for (let w = -hw; w < hw; w += 16) {
      g.fillStyle = mix(C.topD, C.topL, 0.25 + r() * 0.35); g.fillRect(s + 1, w + 1, 18, 14);
    }
    for (const sd of [-1, 1]) { // parapets
      g.fillStyle = C.rimD; g.fillRect(-4, sd > 0 ? hw - 8 : -hw, len + 8, 8);
      g.fillStyle = C.rim; g.fillRect(-4, sd > 0 ? hw - 8 : -hw, len + 8, 3);
    }
    g.restore();
  }

  // A mist-sea tile: banks of ash-grey smoke over the drop (seamless; painted once). Robert (2026-11-09): mist below,
  // not lava pools; the lava falls pour down into it.
  function mistTile() {
    const N = 128, c = mk(N, N), g = c.getContext("2d"), im = g.createImageData(N, N), d = im.data;
    const f = (x, y) => DL.fbm(x / 40, y / 40, 77) * 0.7 + DL.fbm(x / 14, y / 14, 31) * 0.3;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      // blend four offset samples so the tile wraps without a seam
      const u = x / N, v = y / N;
      const n = f(x, y) * (1 - u) * (1 - v) + f(x - N, y) * u * (1 - v) + f(x, y - N) * (1 - u) * v + f(x - N, y - N) * u * v;
      const k = Math.max(0, Math.min(1, (n - 0.3) * 2.6)); // 0 = the deep gaps, 1 = the thickest banks
      const i = (y * N + x) * 4;
      d[i] = 34 + 92 * k; d[i + 1] = 28 + 84 * k; d[i + 2] = 32 + 82 * k; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  // Every slab (with the box it paints into), back to front by its south edge, then the causeways on top.
  let SLABS = null;
  function slabs() {
    if (SLABS) return SLABS;
    const gaps = JOINS.map((j) => [j[2], j[3]]), L = [];
    let n = 0;
    const add = (y, box, f) => { const seed = 4321 + 7919 * n++; L.push({ y, box, f: (g) => f(g, rng(seed)) }); };
    for (const k in FLOORS) {
      const q = FLOORS[k], fh = S.hang + q[4] * LH + 80;
      if (q[5] === "oval") { add(q[3], [q[0], q[1], q[2], q[3] + fh], (g, r) => oval(g, q, r)); continue; }
      add(q[3], [q[0] - 4, q[1] - 30, q[2] + 4, q[3] + fh], (g, r) => {
        face(g, q[0], q[2], q[3], S.hang + q[4] * LH, r);
        top(g, q[0], q[1], q[2], q[3], r, gaps);
        if (k === "hall") runeFloor(g, r);
        if (k === "mine") rails(g, q);
      });
    }
    for (const k in STAIRS) {
      const q = STAIRS[k];
      add(q[3] - 0.5, [q[0] - 60, q[1] - 60, q[2] + 60, q[3] + S.hang + q[4] * LH + 80], (g, r) => { face(g, q[0] - 4, q[2] + 4, q[3], S.hang + q[4] * LH, r); stairs(g, q, r); });
    }
    PILLARS.forEach((q) => add(q[1] + q[2] * 0.4, [q[0] - q[2], q[1] - q[2], q[0] + q[2], q[1] + 800], (g, r) => {
      const w = q[2], d = w * 0.8;
      face(g, q[0] - w / 2, q[0] + w / 2, q[1] + d / 2, S.hang + 30 + q[3] * LH, r);
      top(g, q[0] - w / 2, q[1] - d / 2, q[0] + w / 2, q[1] + d / 2, r, []);
    }));
    L.sort((a, b) => a.y - b.y);
    for (const k in BRIDGES) {
      const q = BRIDGES[k], pad = 90;
      add(1e9, [Math.min(q[0], q[2]) - pad, Math.min(q[1], q[3]) - pad, Math.max(q[0], q[2]) + pad, Math.max(q[1], q[3]) + pad], (g, r) => causeway(g, q, r));
    }
    return (SLABS = L);
  }
  // the mine track along the Slag Mine
  function rails(g, q) {
    const y = (q[1] + q[3]) / 2 + 6, im = IMG.rail;
    if (im) { const w = (im.width * 30) / im.height; for (let x = q[0] + 6; x < q[2] - 6; x += w) g.drawImage(im, x, y - 15, Math.min(w, q[2] - 6 - x) + 0.5, 30); return; }
    for (let x = q[0] + 10; x < q[2] - 10; x += 16) { g.fillStyle = C.wood; g.fillRect(x, y - 12, 8, 24); g.fillStyle = C.woodL; g.fillRect(x, y - 12, 8, 2); }
    for (const dy of [-8, 8]) { g.fillStyle = C.ironL; g.fillRect(q[0] + 6, y + dy - 1, q[2] - q[0] - 12, 3); g.fillStyle = "#1a1416"; g.fillRect(q[0] + 6, y + dy + 2, q[2] - q[0] - 12, 1); }
  }
  // the round throne arena: its face swept down from the lower rim, then the floor, a ring of runes
  function oval(g, q, r) {
    const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2, rx = (q[2] - q[0]) / 2, ry = (q[3] - q[1]) / 2, H = S.hang + q[4] * LH;
    g.save(); g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, cy + H + 80); g.lineTo(cx + rx, cy + H + 80); g.closePath();
    g.clip(); face(g, q[0], q[2], cy, ry + H, r); g.restore();
    const im = IMG["arena-2"];
    if (im) { const h = (2 * rx * im.height) / im.width; g.drawImage(im, q[0], cy - ry * 1.04, 2 * rx, h); return; }
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip(); top(g, q[0], q[1], q[2], q[3] + 10, r, []); g.restore();
    g.strokeStyle = C.rim; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy, rx - 4, ry - 4, 0, 0, Math.PI * 2); g.stroke();
    runeFloor(g, r, { x: cx, y: cy + 60, r: 300, sq: 0.62 });
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

  /* ---------------- standing props (coded until Robert's art) ---------------- */
  function glowSprite() {
    const c = mk(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${GLOW},0.9)`); gr.addColorStop(0.35, `rgba(${GLOW},0.35)`); gr.addColorStop(1, `rgba(${GLOW},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  // a square basalt arch with banners (base at the bottom middle)
  function archSprite() {
    const r = rng(5), W = 130, H = 170, c = mk(W, H), g = c.getContext("2d"), pw = 26;
    for (const x of [0, W - pw]) {
      for (let y = 30; y < H; y += 14) { g.fillStyle = mix(C.faceD, C.faceL, 0.35 + r() * 0.35); g.fillRect(x + 1, y + 1, pw - 2, 12); }
      g.fillStyle = "rgba(255,220,200,0.1)"; g.fillRect(x + 1, 30, 3, H - 30);
    }
    for (let x = 0; x < W; x += 18) { g.fillStyle = mix(C.faceD, C.rim, 0.4 + r() * 0.3); g.fillRect(x + 1, 6, 16, 24); }
    g.fillStyle = C.rim; g.fillRect(0, 2, W, 6);
    g.fillStyle = C.gold; g.fillRect(W / 2 - 8, 10, 16, 14); g.fillStyle = C.hotL; g.fillRect(W / 2 - 3, 14, 6, 6);
    return { c, W, H, pw };
  }
  function brazierSprite() {
    const c = mk(34, 56), g = c.getContext("2d"), r = rng(11);
    for (let y = 18; y < 56; y += 10) { g.fillStyle = mix(C.faceD, C.faceL, 0.4 + r() * 0.3); g.fillRect(6, y, 22, 9); }
    g.fillStyle = C.rim; g.fillRect(4, 16, 26, 4);
    g.fillStyle = C.iron; g.beginPath(); g.moveTo(1, 8); g.lineTo(33, 8); g.lineTo(27, 18); g.lineTo(7, 18); g.closePath(); g.fill();
    g.fillStyle = C.ironL; g.fillRect(1, 8, 32, 2);
    return c;
  }
  function shrineSprite(lit) {
    const c = mk(110, 130), g = c.getContext("2d"), r = rng(23);
    // the alcove: a round-topped niche of basalt blocks
    for (let y = 0; y < 130; y += 14) for (let x = 0; x < 110; x += 22) { g.fillStyle = mix(C.faceD, C.faceL, 0.3 + r() * 0.35); g.fillRect(x + (y / 14 % 2) * 11 - 11 + 1, y + 1, 20, 12); }
    g.fillStyle = "#0c0606"; g.beginPath(); g.moveTo(25, 120); g.lineTo(25, 50); g.arc(55, 50, 30, Math.PI, 0); g.lineTo(85, 120); g.closePath(); g.fill();
    // the kneeling knight statue
    g.fillStyle = lit ? "#6e5a52" : "#4a4040";
    g.fillRect(46, 52, 18, 14); g.fillRect(42, 66, 26, 26); g.fillRect(40, 92, 30, 16); // helm, body, knees
    g.fillStyle = lit ? "#9a8478" : "#5c5252"; g.fillRect(53, 40, 4, 70); g.fillRect(47, 60, 16, 3); // the sword, point down
    if (lit) { g.fillStyle = C.hotL; g.fillRect(50, 57, 3, 2); g.fillRect(57, 57, 3, 2); }
    // the fire bowl at its feet
    g.fillStyle = C.iron; g.beginPath(); g.moveTo(36, 112); g.lineTo(74, 112); g.lineTo(68, 122); g.lineTo(42, 122); g.closePath(); g.fill();
    g.fillStyle = C.rim; g.fillRect(30, 122, 50, 8);
    return c;
  }
  function crystalSprite() {
    const c = mk(56, 72), g = c.getContext("2d");
    const shards = [[0, 50, 9, 0], [-12, 32, 7, -0.35], [12, 36, 7, 0.3], [-5, 20, 5, -0.6]];
    for (const [bx, h, w, lean] of shards) {
      const x = 28 + bx, y = 70, tx = x + Math.sin(lean) * h, ty = y - Math.cos(lean) * h, px = Math.cos(lean) * w, py = Math.sin(lean) * w;
      g.fillStyle = "#1a0a06"; g.beginPath(); g.moveTo(x - px - 1, y - py + 1); g.lineTo(tx, ty - 2); g.lineTo(x + px + 1, y + py + 1); g.closePath(); g.fill();
      g.fillStyle = C.hot; g.beginPath(); g.moveTo(x - px, y - py); g.lineTo(tx, ty); g.lineTo(x + px, y + py); g.closePath(); g.fill();
      g.fillStyle = C.hotL; g.beginPath(); g.moveTo(x - px, y - py); g.lineTo(tx, ty); g.lineTo(x, y); g.closePath(); g.fill();
      g.fillStyle = C.hotH; g.fillRect(tx - 1, ty + 3, 2, 3);
    }
    return c;
  }
  function build() {
    loadArt();
    art = { glow: glowSprite(), arch: archSprite(), brazier: brazierSprite(), shrine: [shrineSprite(false), shrineSprite(true)], crystal: crystalSprite(), mist: mistTile() };
    const m = rng(4242);
    art.embers = Array.from({ length: 140 }, () => ({ x: (m() - 0.5) * 4800, y: (m() - 0.5) * 4000, p: m() * 10, v: 14 + m() * 22 }));
  }

  /* ---------------- drawing each frame ---------------- */
  const sees = (view) => view.right > OX - S.halfW && view.left < OX + S.halfW && view.bottom > OY - S.halfH && view.top < OY + S.halfH;
  Mi.covers = (view) => sees(view) && G.camera && Mi.inRegion(G.camera.x, G.camera.y);
  let mistPat = null, mistCtx = null;
  // The mist sea (one drifting pattern fill), then the painted stone, then the lava falls pouring into the mist.
  Mi.drawGround = function (c, view, t) {
    if (!sees(view)) return;
    if (!art) build();
    if (!mistPat || mistCtx !== c) { mistPat = c.createPattern(art.mist, "repeat"); mistCtx = c; }
    if (mistPat.setTransform && typeof DOMMatrix !== "undefined") mistPat.setTransform(new DOMMatrix().translate(OX + t * 9, OY + t * 3).scale(4));
    c.fillStyle = mistPat;
    c.fillRect(view.left - 2, view.top - 2, view.right - view.left + 4, view.bottom - view.top + 4);
    // the mist slowly thickens and thins, warmed from far below
    c.fillStyle = `rgba(40,22,18,${0.28 + 0.08 * Math.sin(t * 0.5)})`;
    c.fillRect(view.left - 2, view.top - 2, view.right - view.left + 4, view.bottom - view.top + 4);
    const i0 = Math.max(0, Math.floor((view.left - OX - BX0) / CH)), i1 = Math.min(Math.ceil((BX1 - BX0) / CH) - 1, Math.floor((view.right - OX - BX0) / CH));
    const j0 = Math.max(0, Math.floor((view.top - OY - BY0) / CH)), j1 = Math.min(Math.ceil((BY1 - BY0) / CH) - 1, Math.floor((view.bottom - OY - BY0) / CH));
    let made = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const key = i + "," + j;
      let ch = chunks.get(key);
      if (!ch && (made++ < 2 || chunks.size < 4)) { ch = paintChunk(i, j); chunks.set(key, ch); }
      if (!ch) continue;
      const x = OX + BX0 + i * CH, y = OY + BY0 + j * CH;
      const sx = Math.max(0, view.left - x), sy = Math.max(0, view.top - y), ex = Math.min(CH, view.right - x + 1), ey = Math.min(CH, view.bottom - y + 1);
      if (ex > sx && ey > sy) c.drawImage(ch, sx, sy, ex - sx, ey - sy, x + sx, y + sy, ex - sx, ey - sy);
    }
    if (chunks.size > 20) for (const key of [...chunks.keys()]) {
      const [i, j] = key.split(",").map(Number);
      if (i < i0 - 1 || i > i1 + 1 || j < j0 - 1 || j > j1 + 1) chunks.delete(key);
    }
    DL.MineTraps.drawFloor(c, view, t); // grates, vents, crumbling tiles, cage shadows (src/minetraps.js)
    DL.MineFoes.drawFloor(c, view, t); // the Molten Wretches' puddles (src/minefoes.js)
    DL.MineBosses.drawFloor(c, view, t); // the mini bosses' pools and marks (src/minebosses.js)
    // lava falls pouring down the faces
    FALLS.forEach(([fx, fw, id], n) => {
      const f = FLOORS[id], x = OX + fx - fw / 2, y = OY + f[3] + 4, len = S.hang + f[4] * LH + 90;
      if (x - fw > view.right || x + 2 * fw < view.left || y - 20 > view.bottom || y + len < view.top) return;
      const im = IMG["fall-" + (1 + (Math.floor(t * 8 + n) % 4))];
      if (im) { // Robert's fall: the spout and the splash as drawn, the stream stretched between them
        const W = fw * 1.9, k = W / im.width, X = OX + fx - W / 2, CAP = 45, SPL = 30, top = y - 8, bot = y + len - 30;
        c.drawImage(im, 0, 0, im.width, CAP, X, top, W, CAP * k);
        c.drawImage(im, 0, CAP, im.width, im.height - CAP - SPL, X, top + CAP * k - 1, W, bot - top - CAP * k + 2);
        c.drawImage(im, 0, im.height - SPL, im.width, SPL, X, bot, W, SPL * k);
        return;
      }
      const gr = c.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, "rgba(255,200,80,0.95)"); gr.addColorStop(0.65, "rgba(255,120,24,0.9)"); gr.addColorStop(1, "rgba(255,110,20,0)");
      c.fillStyle = gr; c.fillRect(x, y, fw, len);
      c.fillStyle = "rgba(255,240,190,0.85)";
      for (let i = 0; i < 6; i++) { const yy = y + ((t * (70 + i * 11) + i * 31) % len); c.fillRect(x + 3 + i * ((fw - 6) / 5), yy, 2, 14); }
      c.fillStyle = "rgba(60,20,10,0.6)";
      for (let i = 0; i < 3; i++) { const yy = y + ((t * (50 + i * 17) + i * 53) % len); c.fillRect(x + 4 + i * ((fw - 8) / 2), yy, 4, 5); }
    });
  };

  // Shrines, braziers, the arch, carts and cranes stand among the knights.
  Mi.push = function (list, c, t, view) {
    if (!sees(view) || !art) return;
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (x < view.left - 160 || x > view.right + 160 || y < view.top - 20 || y > view.bottom + 260) continue;
      list.push({ y, f: () => drawProp(c, q, x, y, t) });
    }
    DL.MineTraps.push(list, c, t, view);
    DL.MineBosses.push(list, c, t, view);
    DL.MineBosses.pushSeated(list, c);
    for (const id in CHESTS) {
      const q = CHESTS[id], x = OX + q[0], y = OY + q[1];
      if (x < view.left - 100 || x > view.right + 100 || y < view.top - 100 || y > view.bottom + 150) continue;
      const open = G.spires && G.spires.opened && G.spires.opened[id];
      list.push({ y, f: () => {
        const im = IMG[open ? "chest-open" : "chest-shut"];
        if (im) { const w = 64, h = (w * im.height) / im.width; c.drawImage(im, x - w / 2, y - h + 6, w, h); return; }
        c.fillStyle = "#4a2a22"; c.fillRect(x - 26, y - 30, 52, 30); c.fillStyle = "#c9862e"; c.fillRect(x - 26, y - 20, 52, 4); c.fillRect(x - 3, y - 26, 6, 10);
      } });
    }
    // a shut room's fire curtains, across each of its doors (and the great stair's, until the wings are cleared)
    const sp = G.spires;
    if (sp && sp.lv === "mines" && Mi.wingsLeft()) {
      const x = OX + GREAT[0], y = OY + GREAT[1] - 8;
      if (x > view.left - 100 && x < view.right + 100 && y > view.top - 100 && y < view.bottom + 200)
        list.push({ y: y + 6, f: () => { if (IMG["seal-1"]) curtainArt(c, x, y + 6, t); else for (let i = -3; i <= 3; i++) curtain(c, x + i * 18, y + 6, t, i); } });
    }
    if (sp && sp.lv === "mines" && sp.seal) for (const j of JOINS) {
      if (j[0] !== sp.seal && j[1] !== sp.seal) continue;
      const x = OX + j[2], y = OY + j[3];
      if (x < view.left - 100 || x > view.right + 100 || y < view.top - 100 || y > view.bottom + 100) continue;
      list.push({ y: y + 6, f: () => { if (IMG["seal-1"]) curtainArt(c, x, y + 6, t); else for (let i = -3; i <= 3; i++) curtain(c, x + i * 18, y + 6, t, i); } });
    }
  };
  // a shut door's drawn fire curtain (Robert's 3 frames), 120 px across, its foot on the threshold
  function curtainArt(c, x, y, t) {
    const im = IMG["seal-" + (1 + (((Math.floor(t * 9 + x) % 3) + 3) % 3))], w = 124, h = (w * im.height) / im.width;
    c.drawImage(im, x - w / 2, y - h + 6, w, h);
  }
  function curtain(c, x, y, t, i) {
    const h = 64 + 12 * Math.sin(t * 9 + i * 1.7);
    c.fillStyle = "rgba(255,90,20,0.85)"; c.beginPath(); c.moveTo(x - 11, y); c.quadraticCurveTo(x - 8, y - h * 0.6, x + Math.sin(t * 7 + i) * 4, y - h); c.quadraticCurveTo(x + 8, y - h * 0.6, x + 11, y); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,200,90,0.9)"; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 4, y - h * 0.4, x, y - h * 0.65); c.quadraticCurveTo(x + 4, y - h * 0.4, x + 5, y); c.closePath(); c.fill();
  }
  function flame(c, x, y, s, t) {
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.28, w = 9 * s * k, h = (18 + 5 * Math.sin(t * 9 + x + i)) * s * k;
      c.fillStyle = i === 0 ? C.hot : i === 1 ? C.hotL : C.hotH;
      c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.6, y - h * 0.6, x + Math.sin(t * 7 + i) * 2, y - h); c.quadraticCurveTo(x + w * 0.6, y - h * 0.6, x + w, y); c.closePath(); c.fill();
    }
  }
  // a drawn prop stood on its foot (file px are 2 per world px; s scales it on top of that; flip mirrors it)
  function stand(c, im, x, y, s = 1, flip = false, dy = 4) {
    const w = (im.width / 2) * s, h = (im.height / 2) * s;
    if (!flip) { c.drawImage(im, x - w / 2, y - h + dy, w, h); return; }
    c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(im, -w / 2, y - h + dy, w, h); c.restore();
  }
  // the arch's way out, in its file px (292 wide; the opening 88..214, springing at 170, crown at 120, foot at 286)
  function archArt(c, x, y) {
    const im = IMG.arch, k = 0.5, P = (px, py) => [x + (px - 146) * k, y + (py - 286) * k + 4];
    c.fillStyle = "#0a0404"; c.beginPath();
    let p = P(88, 286); c.moveTo(p[0], p[1]); p = P(88, 170); c.lineTo(p[0], p[1]);
    const cp = P(151, 70); p = P(214, 170); c.quadraticCurveTo(cp[0], cp[1], p[0], p[1]); p = P(214, 286); c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,170,90,0.12)"; c.fillRect(x - 31, y - 46, 62, 50);
    stand(c, im, x, y);
  }
  function drawProp(c, q, x, y, t) {
    const kind = q[0];
    const lit = kind === "shrine" && !!(G.spires && G.spires.lit && G.spires.lit[q[3]]);
    const im = IMG[{ brazier: "brazier", banner: "banner", throne: "throne", crane: "crane", headframe: "crane", cage: "cage-hang", cartBroken: "cart-broken",
      shrine: lit ? "shrine-lit" : "shrine-dark", cart: q[3] ? "cart-front" : "cart-side" }[kind]];
    if (kind === "arch" && IMG.arch) return archArt(c, x, y);
    if (im) {
      if (kind === "banner") return stand(c, im, x, y - 22, 1, false, 0);
      if (kind === "cage") { // hanging from its crane's arm, swaying
        const sw = Math.sin(t * 1.3 + x) * 3;
        c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(x, y, 22, 6, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#2a2020"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 96); c.lineTo(x + sw, y - 84); c.stroke();
        return stand(c, im, x + sw, y - 8, 0.8);
      }
      return stand(c, im, x, y, kind === "headframe" ? 0.85 : 1, (kind === "crane" || kind === "headframe") && !!q[3]);
    }
    if (kind === "cartBroken") return;
    if (kind === "arch") {
      const a = art.arch;
      c.fillStyle = "#0a0404"; c.fillRect(x - a.W / 2 + a.pw, y - a.H + 30, a.W - 2 * a.pw, a.H - 30); // the dark way out
      c.fillStyle = "rgba(255,170,90,0.12)"; c.fillRect(x - a.W / 2 + a.pw, y - 50, a.W - 2 * a.pw, 50);
      c.drawImage(a.c, x - a.W / 2, y - a.H);
    } else if (kind === "den") {
      // the den's own drawing (the Mire's, as Robert asked), under a light ember cast from the lava light
      const name = DL.Art.sprites.denGuarded ? (DL.Den.state().cleared ? "denCleared" : "denGuarded") : "boneDen";
      DL.Render.sprite(c, name, x, y + 20);
    } else if (kind === "brazier") {
      c.drawImage(art.brazier, x - 17, y - 52);
      flame(c, x, y - 44, 1, t);
    } else if (kind === "shrine") {
      const lit = !!(G.spires && G.spires.lit && G.spires.lit[q[3]]);
      c.drawImage(art.shrine[lit ? 1 : 0], x - 55, y - 126);
      if (lit) flame(c, x, y - 14, 0.9, t);
    } else if (kind === "banner") {
      c.fillStyle = C.iron; c.fillRect(x - 16, y - 96, 32, 4);
      c.fillStyle = C.cloth; c.beginPath(); c.moveTo(x - 13, y - 92); c.lineTo(x + 13, y - 92); c.lineTo(x + 13, y - 30); c.lineTo(x, y - 40); c.lineTo(x - 13, y - 30); c.closePath(); c.fill();
      c.fillStyle = C.gold; c.fillRect(x - 13, y - 92, 26, 2); c.fillRect(x - 1, y - 80, 2, 22); c.fillRect(x - 8, y - 70, 16, 2);
    } else if (kind === "throne") {
      c.fillStyle = C.faceD; c.fillRect(x - 130, y - 30, 260, 40); c.fillStyle = C.faceL; c.fillRect(x - 130, y - 30, 260, 5); // the dais
      c.fillStyle = C.face; c.fillRect(x - 60, y - 150, 120, 125);
      for (let i = -3; i <= 3; i++) { c.fillStyle = C.faceL; c.beginPath(); c.moveTo(x + i * 18 - 8, y - 150); c.lineTo(x + i * 18, y - 190 + Math.abs(i) * 8); c.lineTo(x + i * 18 + 8, y - 150); c.closePath(); c.fill(); }
      c.fillStyle = C.cloth; c.fillRect(x - 40, y - 140, 80, 70);
      c.fillStyle = C.gold; c.fillRect(x - 4, y - 128, 8, 40); c.fillRect(x - 18, y - 112, 36, 6);
      c.fillStyle = C.faceL; c.fillRect(x - 75, y - 80, 25, 55); c.fillRect(x + 50, y - 80, 25, 55); // armrests
    } else if (kind === "cart") {
      c.fillStyle = "#120a0a"; c.fillRect(x - 22, y - 6, 8, 8); c.fillRect(x + 14, y - 6, 8, 8);
      c.fillStyle = C.wood; c.fillRect(x - 26, y - 30, 52, 26); c.fillStyle = C.iron; c.fillRect(x - 26, y - 30, 52, 4); c.fillRect(x - 26, y - 8, 52, 3);
      c.fillStyle = C.hot; c.beginPath(); c.ellipse(x, y - 30, 22, 7, 0, Math.PI, 0); c.fill();
      c.fillStyle = C.hotL; c.fillRect(x - 8, y - 35, 6, 4); c.fillRect(x + 5, y - 33, 5, 3);
    } else if (kind === "headframe" || kind === "crane") {
      const h = kind === "crane" ? 120 : 100;
      c.fillStyle = C.wood; c.fillRect(x - 4, y - h, 8, h); c.fillStyle = C.woodL; c.fillRect(x - 4, y - h, 2, h);
      c.fillStyle = C.wood; c.fillRect(x - 4, y - h, kind === "crane" ? 70 * (q[1] > 0 ? -1 : 1) : 50, 7);
      if (kind === "headframe") { c.fillRect(x + 42, y - h, 8, h); c.fillStyle = C.iron; c.beginPath(); c.arc(x + 23, y - h + 4, 10, 0, Math.PI * 2); c.fill(); }
    } else if (kind === "cage") {
      const sw = Math.sin(t * 1.3 + x) * 3;
      c.strokeStyle = C.iron; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 140); c.lineTo(x + sw, y - 70); c.stroke();
      c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(x, y, 20, 6, 0, 0, Math.PI * 2); c.fill(); // its shadow on the floor
      c.strokeStyle = C.ironL; c.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + sw + i * 7, y - 70); c.lineTo(x + sw + i * 8, y - 30); c.stroke(); }
      c.fillStyle = C.iron; c.fillRect(x + sw - 18, y - 72, 36, 5); c.fillRect(x + sw - 20, y - 32, 40, 5);
    } else if (kind === "crystal") {
      const s = q[3];
      c.drawImage(art.crystal, x - 28 * s, y - 70 * s, 56 * s, 72 * s);
    } else if (kind === "crates") {
      for (const [dx, dy] of [[-18, 0], [14, 4], [-2, -22]]) {
        c.fillStyle = C.wood; c.fillRect(x + dx - 14, y + dy - 24, 28, 24); c.fillStyle = C.woodL; c.fillRect(x + dx - 14, y + dy - 24, 28, 3);
        c.strokeStyle = "#2a1a10"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + dx - 13, y + dy - 22); c.lineTo(x + dx + 13, y + dy - 2); c.stroke();
      }
    }
  }

  // Above the darkness: brazier and lava-fall glow, the rune circle's bloom, embers rising out of the mist.
  Mi.drawGlow = function (c, t, view) {
    if (!sees(view) || !art) return;
    const glow = (x, y, r, a) => { c.globalAlpha = a; c.drawImage(art.glow, x - r, y - r, r * 2, r * 2); };
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (x < view.left - 200 || x > view.right + 200 || y < view.top - 100 || y > view.bottom + 300) continue;
      const tw = 0.8 + 0.2 * Math.sin(t * 5 + q[1]);
      if (q[0] === "brazier") glow(x, y - 54, 46, 0.7 * tw);
      else if (q[0] === "crystal") glow(x, y - 30 * q[3], 40 * q[3], 0.5 * tw);
      else if (q[0] === "cart") glow(x, y - 32, 26, 0.5);
      else if (q[0] === "shrine" && G.spires && G.spires.lit && G.spires.lit[q[3]]) glow(x, y - 30, 70, 0.6 * tw);
    }
    for (const [fx, fw, id] of FALLS) {
      const f = FLOORS[id], x = OX + fx, y = OY + f[3] + (S.hang + f[4] * LH) * 0.6;
      if (x > view.left - 200 && x < view.right + 200 && y > view.top - 300 && y < view.bottom + 300) glow(x, y, 90, 0.4);
      const fy = OY + f[3] + S.hang + f[4] * LH + 70; // where it pours into the mist, the mist glows
      if (x > view.left - 200 && x < view.right + 200 && fy > view.top - 150 && fy < view.bottom + 150) glow(x, fy, 80 + fw, 0.35 + 0.05 * Math.sin(t * 2 + fx));
    }
    glow(OX + RUNE.x, OY + RUNE.y, 180, 0.12 + 0.06 * Math.sin(t * 1.4));
    c.globalAlpha = 1;
    DL.MineTraps.drawGlow(c, t, view);
    DL.MineFoes.drawGlow(c, t, view);
    DL.MineBosses.drawGlow(c, t, view);
    if (G.spires && G.spires.lv === "mines" && G.spires.seal) for (const j of JOINS) if (j[0] === G.spires.seal || j[1] === G.spires.seal) { c.globalAlpha = 0.6; c.drawImage(art.glow, OX + j[2] - 90, OY + j[3] - 120, 180, 180); }
    c.globalAlpha = 1;
    for (const m of art.embers) {
      const life = ((t + m.p) % 5) / 5, x = OX + m.x + Math.sin(t * 1.5 + m.p) * 12, y = OY + m.y - life * m.v * 5;
      if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
      c.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - life))},60,${0.8 * Math.sin(Math.PI * life)})`;
      c.fillRect(x, y, 2, 2);
    }
  };

  // Brazier, shrine and lava-fall light (only near the knight, so the light pass stays cheap).
  Mi.lights = function (L) {
    const p = G.player;
    if (!p || !Mi.active()) return;
    const near = (x, y) => Math.abs(x - p.x) < 900 && Math.abs(y - p.y) < 700;
    for (const q of PROPS) {
      const x = OX + q[1], y = OY + q[2];
      if (!near(x, y)) continue;
      if (q[0] === "brazier") L.push({ x, y: y - 50, r: 150, s: 0.75, col: GLOW, a: 0.7, flick: true });
      else if (q[0] === "shrine" && G.spires.lit[q[3]]) L.push({ x, y: y - 30, r: 130, s: 0.7, col: GLOW, a: 0.7 });
      else if (q[0] === "crystal") L.push({ x, y: y - 30, r: 70 * q[3], s: 0.5, col: GLOW, a: 0.6 });
    }
    for (const [fx, , id] of FALLS) {
      const f = FLOORS[id], x = OX + fx, y = OY + f[3] + 40;
      if (near(x, y)) L.push({ x, y, r: 170, s: 0.6, col: GLOW, a: 0.6 });
    }
  };
})(window.DL);
