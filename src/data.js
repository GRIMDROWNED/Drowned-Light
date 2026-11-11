/* Drowned Light — game data. Tune balance here. */
"use strict";
(function (DL) {
  // Seconds per phase of the day/night cycle.
  DL.CYCLE = { day: 80, dusk: 10, night: 75, dawn: 8 };
  DL.CYCLE.total = DL.CYCLE.day + DL.CYCLE.dusk + DL.CYCLE.night + DL.CYCLE.dawn;

  DL.CAMP_RADIUS = 205; // deposit + camp menu range (grows with the walls: DL.Camp.menuR)
  DL.WALL_R = 235;      // palisade half-side; set from the Barricade level by DL.Camp.sync
  DL.WALL_SIZES = [235, 235, 235, 235, 290, 345]; // palisade half-side at each Barricade level: levels 4 and 5 push it out
  DL.WALL_TIER = [0, 235, 260, 300, 335, 370];    // ...and at least this at each camp look (Flame 1/5/10/15/20), so the camp spreads out as it grows (Robert, 2026-11-03)
  DL.GARDEN_YIELD = [0, 4, 8, 14];
  DL.TIER_NAMES = ["", "A Place to Rest", "A Growing Bastion", "A Beacon in the Marsh", "A Citadel of Light", "The Crown of the Pyramid"];
  DL.FLAME = { max: 20, perBarricade: 4, looks: [1, 5, 10, 15, 20] };

  DL.RESOURCES = {
    wood: { name: "Wood", color: "#a07a52" },
    stone: { name: "Stone", color: "#9a9d9e" },
    resin: { name: "Bloom Resin", color: "#43e6ee" },
    iron: { name: "Iron Scrap", color: "#c06a44" },
    pearl: { name: "Amethyst", color: "#9fd0ff" }, // blue since 2026-11-05: violet is the Aether Crystal's
    black: { name: "Black Pearl", color: "#5d6b8c" }, // found only in the Abyss
    // brought home from the dungeons (src/spires.js, src/rift.js): kept out of sight until the first run home
    shard: { name: "Rift Shard", color: "#d6a8ff", rift: true },
    aether: { name: "Aether Crystal", color: "#9a5cff", rift: true },
    // from the Molten Mines (src/mines.js): Obsidian from the Sovereign's guard and chests, a Magma Heart per mini boss
    obsidian: { name: "Obsidian", color: "#6b5a7a", rift: true },
    heart: { name: "Magma Heart", color: "#ff6a1a", rift: true },
  };
  DL.RES_KEYS = Object.keys(DL.RESOURCES);

  /* The Level 1 map (docs/PYRAMID-PLAN.md): a square grid of `cell` px squares, `rings` rings round the camp's
     square (a 9 x 9 grid), so the grid reaches `cell * (rings + 0.5)` px out (Camp.sq). Past it a rim of Abyss
     shore `rim` px wide, then black water no one can cross: the world ends there (World.EDGE). */
  DL.MAP = { cell: 800, rings: 4, rim: 1500 };

  // Zones are the map's square rings round the camp (Camp.sq distance). Deeper = darker, deadlier, richer.
  DL.ZONES = [
    { name: "Camp Clearing", r: 0, corrupt: 1, hp: 1, dmg: 1, yield: 1, density: 0, dim: 0, pool: {} },
    { name: "The Shallows", r: 400, corrupt: 1, hp: 1, dmg: 1, yield: 1, density: 9, dim: 0,
      pool: { squire: 5, footman: 3, revenant: 1 } },
    { name: "The Mire", r: 1200, corrupt: 1.25, hp: 1.35, dmg: 1.2, yield: 1.6, density: 11, dim: 0.08,
      pool: { squire: 4, footman: 4, archer: 3, revenant: 2, defiler: 2, hexbearer: 1 } },
    { name: "Drowned Reaches", r: 2000, corrupt: 1.55, hp: 1.8, dmg: 1.45, yield: 2.3, density: 13, dim: 0.2,
      pool: { squire: 3, footman: 4, archer: 3, revenant: 3, defiler: 3, blackguard: 2, hexbearer: 2, champion: 0.15 } },
    { name: "The Abyss", r: 2800, corrupt: 2, hp: 2.4, dmg: 1.75, yield: 3.2, density: 14, dim: 0.5, abyss: true,
      pool: { footman: 3, archer: 3, revenant: 3, defiler: 3, blackguard: 3, hexbearer: 3, champion: 0.5 } },
  ];

  // What grows where (weights), per zone index. Refuge and Sentinel Blooms grow only in groves (DL.GROVE);
  // their old weight went to "gap" so everything else keeps its density.
  DL.SPAWN_TABLE = [
    {},
    { tree: 4, gap: 11.6, stone: 2.5, sprout: 2, reeds: 4 },
    { tree: 3, gap: 11.1, stone: 2, iron: 2.5, sprout: 3, reeds: 3 },
    { tree: 2.5, gap: 11.1, stone: 1.5, iron: 4, pearl: 1.5, sprout: 3.5, reeds: 2 },
    { tree: 2, gap: 11, stone: 1.5, iron: 5, pearl: 2, black: 0.7, sprout: 4, reeds: 1 },
  ];

  /* Bloom groves: the glowing plants grow in clumps, at most one per cell of the grove grid, with real
     darkness between them, so night means choosing a grove and holding it. `cell` = grid size in world px,
     `chance` = odds a cell has a grove, `spread` = how far its blooms sit from its heart, `clear` = radius kept
     free of trees and rocks. Per zone: how many Refuge and Sentinel Blooms, and extra Bloom Sprouts (resin). */
  DL.GROVE = {
    cell: 1280, margin: 400, chance: 0.8, spread: 150, clear: 190,
    zones: [
      null,
      { refuge: [4, 6], sentinel: [0, 0], sprout: [2, 3] },
      { refuge: [3, 5], sentinel: [1, 1], sprout: [2, 4] },
      { refuge: [3, 4], sentinel: [1, 2], sprout: [3, 4] },
      { refuge: [2, 3], sentinel: [2, 3], sprout: [3, 5] },
    ],
  };

  // World objects. `solid` = collision radius, `hits` = strikes to mine it. `bloom` objects glow at night and shelter you.
  DL.OBJ = {
    // Trees are the wood: chop one down for a big load; it grows back at dawn.
    tree: { sprite: "tree", solid: 9, res: "wood", base: 6, hits: 5, r: 16 },
    // Graves and pillars don't spawn in the wild: they stand only at the Abyss graves, where Abigail is won (src/abigail.js).
    pillar: { sprite: "pillar", solid: 9 },
    grave: { sprite: "grave", solid: 6 },
    headstone: { sprite: "headstone", solid: 8 },
    reeds: { sprite: "reeds" },
    stone: { sprite: "rock", res: "stone", base: 6, hits: 6, r: 12, solid: 7 },
    iron: { sprite: "ironpile", res: "iron", base: 2, hits: 5, r: 14 },
    sprout: { sprite: "sprout", res: "resin", base: 2, hits: 2, r: 10 },
    // Amethyst grows from the Drowned Reaches outward, beyond where iron begins.
    pearl: { sprite: "pearl", res: "pearl", base: 1, hits: 4, r: 10 },
    // Black Pearl clams lie half sunk in the Abyss mud and nowhere else: one or two pearls each, and they're slow to pry open.
    black: { sprite: "blackClam", res: "black", base: 0.45, hits: 6, r: 10 },
    refuge: { sprite: "refuge", bloom: true, light: 125, hp: 70, rad: 14, name: "Refuge Bloom" },
    sentinel: { sprite: "sentinel", bloom: true, light: 95, hp: 100, rad: 14, turret: true, name: "Sentinel Bloom" },
    // The Bone Wolf den: one in the world (src/den.js).
    den: { sprite: "boneDen", solid: 40, name: "Bone Wolf Den" },
    root: { sprite: "root", bloom: true, light: 200, hp: 480, rad: 30, solid: 20, name: "Mother Root" },
  };

  // Every Drowned Knight wears the player's armour, corrupted. Sprites: src/units.js, keyed by type.
  DL.ENEMIES = {
    squire: { name: "Mire Stalker", hp: 16, speed: 92, dmg: 6, range: 30, windup: 0.32, cd: 1.0, scale: 0.78,
      radius: 10, mass: 0.7, zigzag: true, lunge: 380, retreat: 0.7, drop: { iron: 0.15 } },
    // A crystal turret of the Abyssal Spires: never moves, plays bullet patterns (src/bullets.js).
    sentinel: { name: "Spire Sentinel", hp: 110, speed: 0, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1,
      radius: 18, mass: 50, sentinel: true, shadow: 22, drop: {} },
    // The Abyssal Spires' bullet-pattern foes (src/spirefoes.js): their moves are their own (range 0: no Drowned blow)
    leaper: { name: "Chain Leaper", hp: 46, speed: 74, dmg: 12, range: 0, windup: 1, cd: 99, scale: 1, radius: 13, mass: 1.2,
      spire: "leaper", shadow: 18, barY: 84, drop: {} },
    bowman: { name: "Bridge Bowman", hp: 34, speed: 62, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 12, mass: 0.9,
      spire: "bowman", shadow: 15, barY: 112, drop: {} },
    shade: { name: "Mist Shade", hp: 30, speed: 84, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 11, mass: 0.6,
      spire: "shade", shadow: 12, barY: 128, drop: {} },
    caller: { name: "Rift Caller", hp: 70, speed: 46, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 14, mass: 1.5,
      spire: "caller", shadow: 18, barY: 176, drop: {} },
    prism: { name: "Prism Knight", hp: 170, speed: 46, dmg: 16, range: 0, windup: 1, cd: 99, scale: 1, radius: 17, mass: 4,
      spire: "prism", shadow: 22, barY: 132, barW: 40, drop: {} },
    footman: { name: "Drowned Wretch", hp: 34, speed: 58, dmg: 11, range: 36, windup: 0.45, cd: 1.4, scale: 1,
      radius: 13, mass: 1, corruptHit: 4, drop: { iron: 0.4 } },
    archer: { name: "Tide Archer", hp: 22, speed: 64, dmg: 9, range: 230, windup: 0.7, cd: 2.3, scale: 0.95,
      radius: 12, mass: 0.9, ranged: true, keep: 170, spread: 3, drop: { iron: 0.3 } },
    revenant: { name: "Swarming Revenant", hp: 9, speed: 104, dmg: 5, range: 24, windup: 0.25, cd: 0.9, scale: 0.85,
      radius: 8, mass: 0.4, crawl: true, surround: true, drop: { resin: 0.1 } },
    defiler: { name: "Lantern Reaver", hp: 44, speed: 52, dmg: 12, range: 40, windup: 0.6, cd: 1.6, scale: 1.05,
      radius: 13, mass: 1.2, targetsLight: true, lightDmg: 26, snuff: 90, lunge: 340, drop: { resin: 0.6, iron: 0.3 } },
    blackguard: { name: "Bone Bulwark", hp: 140, speed: 40, dmg: 20, range: 44, windup: 0.75, cd: 2.0, scale: 1.15,
      radius: 18, mass: 3.5, armor: 0.35, shield: 0.7, guard: 110, charge: true, drop: { iron: 1 } },
    champion: { name: "Drowned Sovereign", hp: 520, speed: 56, dmg: 28, range: 70, windup: 0.8, cd: 2.2, scale: 1.5,
      radius: 24, mass: 8, armor: 0.2, boss: true, aura: 170, drop: { iron: 1, pearl: 1 } },
    hexbearer: { name: "Marsh Hexbearer", hp: 38, speed: 50, dmg: 8, range: 250, windup: 0.9, cd: 2.6, scale: 1.05,
      radius: 13, mass: 1.1, ranged: true, keep: 200, caster: true, drop: { resin: 0.7, pearl: 0.05 } },
    // The pack at the Bone Wolf den (src/den.js): wild Bone Hounds that never leave it, by day or night.
    bonewolf: { name: "Bone Wolf", hp: 30, speed: 140, dmg: 7, range: 26, windup: 0.3, cd: 1.1, scale: 1,
      radius: 10, mass: 0.8, lunge: 340, den: true, beast: true, drop: {} },
    // The Starved Bell: one roams the Abyss, buried in the mire, and bursts up under whoever comes near (src/bell.js).
    bell: { name: "The Starved Bell", hp: 760, speed: 62, dmg: 26, range: 70, windup: 0.7, cd: 1.9, scale: 1.25,
      radius: 26, mass: 10, armor: 0.15, boss: true, bell: true, wake: 150, barY: 150, drop: { iron: 3, pearl: 2, resin: 2, black: 1.2 } },
    // The Deadly Rose: a thorned queen who keeps a garden of roses at one spot in the Abyss (src/rose.js). Her moves: DL.ROSE.
    rose: { name: "The Deadly Rose", hp: 900, speed: 46, dmg: 22, range: 105, windup: 0.7, cd: 1.9, scale: 0.8,
      radius: 20, mass: 12, armor: 0.1, boss: true, rose: true, arc: 1.5, wake: 230, shadow: 30, barY: 160, barW: 60,
      eyeX: 2, eyeY: 156, eyeR: 3, eyeCol: "255,60,80", drop: { iron: 3, pearl: 3, resin: 3, black: 1.5 } },
    // The last foe of Derek's Hollow (src/colossus.js): a crawling stone guardian. Its four attacks are tuned in DL.COLOSSUS.
    colossus: { name: "Drowned Colossus", hp: 1100, speed: 34, dmg: 26, range: 92, windup: 0.95, cd: 2.4, scale: 1,
      radius: 30, mass: 40, armor: 0.2, boss: true, colossus: true, arc: 2.6, shadow: 70, sink: 130, barY: 144, barW: 90, eyeX: 60, eyeY: 72, eyeR: 14,
      drop: { iron: 1, pearl: 1 } },
    // The mother wyvern: she hunts whoever stole one of her eggs, until one of them is dead (src/wyvern.js). Her moves: DL.WYVERN.
    wyvern: { name: "The Mother Wyvern", hp: 820, speed: 74, dmg: 20, range: 62, windup: 0.55, cd: 1.6, scale: 1,
      radius: 22, mass: 9, armor: 0.1, boss: true, wyvern: true, fly: true, shadow: 34, barY: 120, barW: 60, drop: { iron: 2, pearl: 2, resin: 2 } },
    // The Sunken King: the last foe, risen at the Drowned Gate when the Fire Bearer reaches it (src/finale.js). Blades can't
    // hurt him until the Bearer's flame burns his heart open. His moves: DL.FINALE.king.
    king: { name: "The Sunken King", hp: 900, speed: 0, dmg: 20, range: 0, windup: 1, cd: 99, scale: 1,
      radius: 46, mass: 1e6, boss: true, king: true, drop: {} },
    self: { name: "Your Drowned Self", hp: 200, speed: 70, dmg: 15, range: 44, windup: 0.5, cd: 1.3, scale: 1.05,
      radius: 14, mass: 2, boss: true, drop: {} },
    /* The bosses' minions (src/minions.js, Robert's concept sheets 2026-11-04; their calling is in DL.MINIONS). They grow
       like the horde, not like their boss. Until Robert's drawings are cut in they wear `look` (another unit's drawings)
       at `lookScale`, washed `tintK` with `tint`. `prey`: "hurt" hunts the most wounded knight, "egg" the egg carrier;
       `hang`: keeps that far off; `drain`: each bite heals its boss that share of the boss's health; `ward`: its boss
       takes that much less damage while it lives. */
    drakeling: { name: "Carrion Drakeling", hp: 16, speed: 125, dmg: 6, range: 28, windup: 0.3, cd: 1.2, scale: 1, radius: 9, mass: 0.4,
      fly: true, lunge: 360, retreat: 0.8, minion: true, look: "wyvern_f0", lookScale: 1.1, tint: "#b0202a", tintK: 0.35, pack: [2, 3], drop: {} },
    raptor: { name: "Bonepicker Raptor", hp: 36, speed: 128, dmg: 9, range: 32, windup: 0.35, cd: 1.1, scale: 1, radius: 12, mass: 0.8,
      lunge: 380, zigzag: true, prey: "egg", minion: true, look: "boneHound", lookScale: 1, tint: "#c0282a", tintK: 0.3, drop: {} },
    screecher: { name: "Red Marrow Screecher", hp: 60, speed: 52, dmg: 9, range: 36, windup: 0.5, cd: 1.6, scale: 1, radius: 13, mass: 1,
      hang: 260, minion: true, look: "wyvern_f1", lookScale: 1.2, tint: "#e8d8c0", tintK: 0.35, drop: { iron: 0.5 } },
    cairn: { name: "Cairn Crawler", hp: 55, speed: 46, dmg: 11, range: 34, windup: 0.55, cd: 1.5, scale: 1, radius: 15, mass: 2,
      armor: 0.3, minion: true, look: "colossus", lookScale: 0.5, drop: { stone: 0.5 } },
    servitor: { name: "Bog Totem Servitor", hp: 150, speed: 30, dmg: 14, range: 44, windup: 0.8, cd: 2.2, scale: 1, radius: 18, mass: 4,
      armor: 0.25, ward: 0.4, minion: true, look: "derek", lookScale: 2.4, tint: "#566f2a", tintK: 0.25, drop: { iron: 1 } },
    siltfist: { name: "Silt Fist Fragment", hp: 220, speed: 40, dmg: 22, range: 56, windup: 0.8, cd: 2.2, scale: 1, radius: 22, mass: 6,
      armor: 0.2, minion: true, look: "colossus", lookScale: 0.9, tint: "#1c1f1e", tintK: 0.3, drop: { iron: 1 } },
    leech: { name: "Clapper Leech", hp: 22, speed: 96, dmg: 5, range: 26, windup: 0.3, cd: 0.9, scale: 1, radius: 9, mass: 0.5,
      drain: 0.01, minion: true, look: "bell", lookScale: 0.4, tint: "#9a7a48", tintK: 0.25, drop: {} },
    tollwretch: { name: "Toll Wretch", hp: 45, speed: 56, dmg: 8, range: 32, windup: 0.45, cd: 1.4, scale: 1, radius: 12, mass: 0.9,
      hang: 240, minion: true, look: "hexbearer", lookScale: 1, tint: "#d8cdb0", tintK: 0.4, drop: { resin: 0.5 } },
    skitterer: { name: "Chapel Skitterer", hp: 18, speed: 112, dmg: 6, range: 26, windup: 0.28, cd: 0.95, scale: 1, radius: 9, mass: 0.5,
      surround: true, minion: true, look: "bell", lookScale: 0.5, tint: "#6a5030", tintK: 0.3, pack: [2, 4], drop: {} },
    handmaiden: { name: "Briar Handmaiden", hp: 85, speed: 62, dmg: 12, range: 64, windup: 0.55, cd: 1.6, scale: 1, radius: 13, mass: 1.2,
      lunge: 300, minion: true, look: "rose", lookScale: 0.55, tint: "#e8c8b8", tintK: 0.2, drop: { resin: 0.5 } },
    rosewretch: { name: "Rose Wretch", hp: 48, speed: 76, dmg: 9, range: 32, windup: 0.4, cd: 1.2, scale: 1, radius: 12, mass: 1,
      prey: "hurt", drain: 0.01, minion: true, look: "revenant", lookScale: 1.4, tint: "#9c1a1e", tintK: 0.45, drop: {} },
    thornling: { name: "Thornling Swarm Stalker", hp: 10, speed: 126, dmg: 4, range: 22, windup: 0.22, cd: 0.8, scale: 1, radius: 7, mass: 0.3,
      surround: true, minion: true, look: "revenant", lookScale: 0.75, tint: "#6a4a2a", tintK: 0.45, pack: [3, 5], drop: {} },
    // the Sunken King's (Robert's sheet, 2026-11-04). `burrow`: dives into the causeway and bursts up under a knight that often
    tidestalker: { name: "Tide Stalker", hp: 26, speed: 100, dmg: 8, range: 28, windup: 0.3, cd: 1.0, scale: 1, radius: 11, mass: 0.7,
      zigzag: true, minion: true, look: "revenant", lookScale: 1.15, tint: "#566f2a", tintK: 0.4, pack: [2, 3], drop: {} },
    wisp: { name: "Sunken Wisp", hp: 40, speed: 60, dmg: 7, range: 230, windup: 0.7, cd: 2.2, scale: 1, radius: 11, mass: 0.6,
      ranged: true, keep: 200, fly: true, shot: "wispBolt", minion: true, look: "abigail", lookScale: 0.8, tint: "#4fe6f0", tintK: 0.35, drop: {} },
    tideleech: { name: "Tide Leech", hp: 70, speed: 50, dmg: 13, range: 34, windup: 0.5, cd: 1.6, scale: 1, radius: 14, mass: 2,
      armor: 0.2, burrow: 6, minion: true, look: "revenant", lookScale: 1.4, tint: "#2d302c", tintK: 0.45, drop: {} },
    // the Abyssal Spires' boss (src/riftthrone.js; health in DL.BOSS.hp, x1.5 size in DL.BOSS.size) and his minions
    // (src/spirefoes.js). The boss is still to be named by Robert: "the Lord of the Rift Throne" until then.
    riftlord: { name: "The Lord of the Rift Throne", hp: 1800, speed: 52, dmg: 22, range: 0, windup: 1, cd: 99, scale: 1, radius: 24, mass: 30,
      spire: "riftlord", riftlord: true, boss: true, shadow: 34, barY: 214, barW: 70, drop: {} },
    mite: { name: "Rift Mite", hp: 18, speed: 120, dmg: 9, range: 0, windup: 1, cd: 99, scale: 1, radius: 10, mass: 0.5,
      spire: "mite", minion: true, shadow: 14, barY: 56, drop: {} },
    swisp: { name: "Shard Wisp", hp: 40, speed: 60, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 11, mass: 0.6,
      spire: "swisp", minion: true, shadow: 12, barY: 90, drop: {} },
    warden: { name: "Throne Warden", hp: 120, speed: 62, dmg: 15, range: 0, windup: 1, cd: 99, scale: 1, radius: 16, mass: 3,
      spire: "warden", minion: true, shadow: 20, barY: 132, barW: 34, drop: {} },
    /* The Ashen Sovereign's minions (Robert's sheet, 2026-11-09): the Molten Mines' only small foes (src/minefoes.js,
       numbers in DL.MINE_FOES). They walk and strike like the Drowned, with their own extras (`mine` names them). Until
       Robert's drawings are in they wear another unit's (`look`), washed with ember colours. */
    wretch: { name: "Molten Wretch", hp: 26, speed: 118, dmg: 7, range: 28, windup: 0.32, cd: 1.1, scale: 0.85, radius: 10, mass: 0.6,
      lunge: 340, zigzag: true, mine: "wretch", minion: true, look: "rosewretch", lookScale: 0.9, tint: "#ff6a1a", tintK: 0.4, drop: {} },
    ashguard: { name: "Ash Guard", hp: 150, speed: 40, dmg: 18, range: 44, windup: 0.8, cd: 2.2, scale: 1.2, radius: 16, mass: 4,
      shield: 0.75, mine: "guard", minion: true, look: "blackguard", lookScale: 1, tint: "#4a3a34", tintK: 0.35, barY: 110, drop: {} },
    halberdier: { name: "Ember Halberdier", hp: 95, speed: 60, dmg: 16, range: 66, windup: 0.7, cd: 1.8, scale: 1, radius: 14, mass: 2,
      lunge: 280, mine: "halberd", minion: true, look: "warden", lookScale: 0.9, tint: "#e8501a", tintK: 0.6, barY: 120, drop: {} },
    // The Molten Mines' mini bosses (src/minebosses.js, numbers in DL.MINE_BOSSES; health in DL.BOSS.hp, size DL.BOSS.size)
    golem: { name: "The Magma Golem", hp: 1500, speed: 34, dmg: 24, range: 0, windup: 1, cd: 99, scale: 1, radius: 34, mass: 30,
      mine: "golem", boss: true, shadow: 60, barY: 200, barW: 70, drop: {} },
    hydra: { name: "The Furnace Hydra", hp: 1500, speed: 0, dmg: 22, range: 0, windup: 1, cd: 99, scale: 1, radius: 70, mass: 999,
      mine: "hydra", boss: true, shadow: 0, barY: 220, barW: 90, drop: {} },
    wyrm: { name: "The Crucible Wyrm", hp: 1500, speed: 70, dmg: 24, range: 0, windup: 1, cd: 99, scale: 1, radius: 40, mass: 40,
      mine: "wyrm", boss: true, shadow: 70, barY: 200, barW: 90, drop: {} },
    seraph: { name: "The Seething Seraph", hp: 1500, speed: 40, dmg: 22, range: 0, windup: 1, cd: 99, scale: 1, radius: 30, mass: 999,
      mine: "seraph", boss: true, shadow: 0, barY: 200, barW: 80, drop: {} },
    cinder: { name: "The Cinder Colossus", hp: 1800, speed: 30, dmg: 26, range: 0, windup: 1, cd: 99, scale: 1, radius: 50, mass: 999,
      mine: "cinder", boss: true, shadow: 80, barY: 210, barW: 100, drop: {} },
    sovereign: { name: "The Ashen Sovereign", hp: 2400, speed: 58, dmg: 26, range: 0, windup: 1, cd: 99, scale: 1, radius: 30, mass: 999,
      mine: "sovereign", boss: true, shadow: 50, barY: 210, barW: 110, drop: {} },
    // one of the Cinder Colossus's two shoulder towers (src/minebosses.js): struck at its feet on that side
    cinderTower: { name: "Shoulder Tower", hp: 90, speed: 0, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 26, mass: 999,
      mine: "tower", ghost: true, shadow: 0, barY: 40, barW: 30, drop: {} },
    // one of the eight obsidian shards orbiting the Seething Seraph (src/minebosses.js): break them all to hurt it
    seraphShard: { name: "Obsidian Shard", hp: 40, speed: 0, dmg: 0, range: 0, windup: 1, cd: 99, scale: 1, radius: 18, mass: 999,
      mine: "shard", ghost: true, shadow: 0, barY: 70, barW: 24, drop: {} },
    acolyte: { name: "Cinder Acolyte", hp: 55, speed: 62, dmg: 12, range: 250, windup: 0.6, cd: 2.6, scale: 1, radius: 12, mass: 0.9,
      hang: 250, mine: "acolyte", minion: true, look: "hexbearer", lookScale: 1, tint: "#d04010", tintK: 0.4, drop: {} },
  };

  // Base kits. A kit = weapon + dash behaviour + signature ability.
  /* Base kits (see the Kit 01 and Base Kits 02–05 concept sheets). A kit is chosen when a game
     starts and kept for that save. It levels 1–20 at camp; levels 5, 10, 15 and 20 are milestones
     that change how it plays and how it looks. `color` tints its light, trails and milestone glow. */
  DL.KIT_MAX_LEVEL = 20;
  DL.MILESTONE_LEVELS = [5, 10, 15, 20];
  DL.KITS = {
    lanternBlade: {
      name: "Lantern Blade", tag: "Kit 01", motto: "A light still endures.", roles: ["Balanced", "Melee", "Light"],
      weapon: "Blade and lantern", color: "255,197,106",
      desc: "A faithful blade and a lantern that holds back the dark. Quick sword arcs; your dash is a Lantern Strike that cuts through the Drowned.",
      attack: { type: "arc", name: "Blade Arc", dmg: 12, range: 64, arc: 2.1, cd: 0.42, kb: 150 },
      dash: { type: "strike", dmg: 9 },
      special: { name: "Lantern Strike", desc: "Your dash cuts through every Drowned in your path." },
      ability: { id: "illuminate", name: "Illuminate", oil: 15, cd: 14, radius: 150, dmg: 22, dur: 5,
        desc: "A burst of firelight that burns and repels the Drowned and leaves a short-lived sanctuary." },
      milestones: [
        { name: "Kindled Edge", desc: "Your blade glows and its strikes set the Drowned alight." },
        { name: "Twin Arc", desc: "Every third swing sends a crescent of light flying forward." },
        { name: "Sanctuary", desc: "Illuminate's sanctuary lasts twice as long and heals you inside it." },
        { name: "Dawnblade", desc: "A blazing white-gold blade: wider arcs, and your Lantern Strike leaves a trail of fire." },
      ],
    },
    // the Dragon Spear (renamed and redrawn 2026-11-01; the id is still the Pike Warden's, so saves keep their kit)
    pikeWarden: {
      name: "Dragon Spear", tag: "Kit 02", motto: "Reach keeps the dark away.", roles: ["Control", "Defense", "Frontline"],
      weapon: "Dragon spear", color: "240,70,90",
      desc: "Extended reach and a stable form. Spear Thrust strikes everything along a line and drives it back.",
      attack: { type: "thrust", name: "Spear Thrust", dmg: 15, range: 96, width: 26, cd: 0.6, kb: 240 },
      dash: { type: "plain" },
      special: { name: "Stable Form", desc: "Plant your feet: after a moment standing still you take 25% less damage, can't be knocked back, and thrusts hit 15% harder." },
      passive: { stance: { after: 0.35, guard: 0.25, dmg: 1.15 } },
      // a spirit dragon coils `coil` s before you, then lunges `reach` px (up to `reachMax` at level 20) at `speed`, striking all within `r` of its jaws
      ability: { id: "lunge", name: "Dragon Lunge", oil: 12, cd: 11, dmg: 24, kb: 360, reach: 260, reachMax: 540, speed: 620, coil: 0.3, r: 36,
        desc: "A crimson spirit dragon coils before you, then lunges far ahead, farther with every level: it strikes and hurls back every Drowned in its path and tears arrows from the air." },
      milestones: [
        { name: "Long Reach", desc: "Your spear reaches a fifth farther, its head glowing." },
        { name: "Skewer", desc: "Thrusts pin the Drowned in place for a moment." },
        { name: "Dragonfire Trail", desc: "Dragon Lunge leaves a trail of crimson fire that burns the Drowned." },
        { name: "Dragon's Line", desc: "Every thrust sends a small spirit dragon streaking down the line." },
      ],
    },
    ashenArbalist: {
      name: "Ashen Arbalist", tag: "Kit 03", motto: "Quiet light. Farther truths.", roles: ["Ranged", "Precision", "Support"],
      weapon: "Arbalest and lantern", color: "255,160,80",
      desc: "Piercing shots and a steady aim. Strike the Drowned from far outside their reach.",
      attack: { type: "bolt", name: "Piercing Bolt", dmg: 14, range: 270, cd: 0.75, pierce: 1, speed: 620 },
      dash: { type: "plain" },
      special: { name: "Quiet Light", desc: "Bolts strike harder the farther they fly: up to 35% more damage at long range." },
      passive: { farShot: { from: 100, to: 260, bonus: 0.35 } },
      ability: { id: "scatter", name: "Scatter Shot", oil: 12, cd: 10, count: 7, dmg: 12,
        desc: "A fan of bolts. Where each one lands, light flares and reveals the dark." },
      milestones: [
        { name: "Steady Aim", desc: "Longer range and brighter, faster bolts." },
        { name: "Farther Truths", desc: "Bolts pierce through three of the Drowned." },
        { name: "Flare Bolts", desc: "Every fourth bolt bursts into searing light." },
        { name: "Volley", desc: "Each shot looses three bolts at once." },
      ],
    },
    // Kit 04, the Frostweaver (replaced the Relic Bearer 2026-10-30; the key stays "relicBearer" so old saves keep their kit).
    // Freezing slows a Drowned to 60% speed for `frost` s; brittle ones take `brittle` more damage for `brittleT` s (DL.ICE).
    relicBearer: {
      name: "Frostweaver", tag: "Kit 04", motto: "Even the dark can freeze.", roles: ["Ranged", "Area damage", "Crowd control"],
      weapon: "Crystal staff", color: "150,215,255",
      desc: "A masked mage in a white witch's hat. Frost bolts from a crystal staff, and an Ice Bomb that bursts over a wide area and freezes the Drowned.",
      attack: { type: "frost", name: "Frost Bolt", dmg: 13, range: 240, cd: 0.6, speed: 460 },
      dash: { type: "plain" },
      // lobbed `throw` px (or at the nearest Drowned in reach), it lands after `flight` s and bursts over `radius` px
      ability: { id: "icebomb", name: "Ice Bomb", oil: 14, cd: 12, radius: 150, dmg: 30, kb: 140, throw: 200, reach: 300, flight: 0.55,
        desc: "Hurl a bomb of ice that bursts over a wide area: it strikes every Drowned in the blast and freezes them." },
      passive: { lanternR: 1.4, oilDrain: 0.7 },
      special: { name: "Frost Lantern", desc: "Your blue lantern reaches 40% farther and burns its oil 30% slower." },
      milestones: [
        { name: "Ice Owl", desc: "An owl of ice flies with you and hurls ice shards at nearby Drowned." },
        { name: "Deep Freeze", desc: "All your attacks freeze the Drowned, slowing them." },
        { name: "Brittle", desc: "Your attacks make the Drowned brittle: they take 20% more damage." },
        { name: "Shatter", desc: "A frozen Drowned that dies shatters, freezing up to 3 more nearby." },
      ],
    },
    flameBastion: {
      name: "Flame Bastion", tag: "Kit 05", motto: "Some light burns brighter.", roles: ["Tank", "Area damage", "Hold the line"],
      weapon: "Sword and bastion shield", color: "255,120,50",
      desc: "An unbreakable guard with a huge blade. Wide, heavy cleaves, a shield that blunts every blow, Shield Slam staggers, and Flame Bastion erupts into a wall of fire.",
      // the great sword: the widest, longest swing of any kit, slower and harder than the Lantern Blade's
      attack: { type: "arc", name: "Bastion Blade", dmg: 20, range: 74, arc: 2.2, cd: 0.7, kb: 210 },
      dash: { type: "slam", dmg: 14, stun: 0.8 },
      // fire erupts from your feet and races `reach` px ahead (hitting and lighting all in its path), then stands as the wall
      ability: { id: "wall", name: "Flame Bastion", oil: 14, cd: 14, length: 170, dps: 14, dur: 7, reach: 80, dmg: 24, burn: 6,
        desc: "Fire erupts from your feet and races ahead, hurling back and setting alight everything in its path, then stands as a wall that blocks and burns the Drowned and lights the night." },
      passive: { guard: 0.25 },
      special: { name: "Bastion Shield", desc: "Your shield blocks 25% of every blow." },
      milestones: [
        { name: "Tempered Shield", desc: "The shield glows; it blocks 35% of every blow." },
        { name: "Searing Wall", desc: "Flame Bastion burns hotter and stands longer." },
        { name: "Bulwark", desc: "Shield Slam sends out a shockwave that staggers everything near." },
        { name: "Unbreakable", desc: "Flame Bastion rises as a full ring of fire around you." },
      ],
    },
    // Fast and deadly, but frail: 70% health, a fifth faster, a dash every 1.1 s (src/game.js), and a kill gives the dash back.
    chainReaper: { secret: true, // won from the Lord of the Rift Throne (src/riftthrone.js); worlds that already had him keep him
      name: "Chain Reaper", tag: "Kit 06", motto: "The dark is only a tether.", roles: ["Speed", "Burst", "Glass cannon"],
      weapon: "Chain sickle", color: "176,120,255",
      desc: "A sickle on a long chain, thrown out and torn back. The fastest and deadliest knight, but the most fragile: every kill gives you your dash back.",
      attack: { type: "chain", name: "Sickle Throw", dmg: 18, back: 0.5, range: 110, width: 30, cd: 0.45, kb: 90 },
      dash: { type: "strike", dmg: 10, cd: 1.1 },
      hpMult: 0.7, speedMult: 1.2,
      // `wide`: Twin Sickles (10) whirls the snare that many times wider. A rooted Drowned can't move or attack (src/game.js).
      ability: { id: "snare", name: "Violet Snare", oil: 12, cd: 12, radius: 230, wide: 1.5, dmg: 16, root: 2,
        desc: "Whirl the chain far around you: it cuts every Drowned in reach and roots them in place for 2 seconds. Rooted, they can't attack." },
      passive: { rush: { speed: 1.25, dur: 1.5 } },
      special: { name: "Reaper's Rush", desc: "Every kill resets your dash and gives you a burst of speed." },
      milestones: [
        { name: "Barbed Chain", desc: "Sickle Throw tears the flesh: the Drowned it hits bleed." },
        { name: "Twin Sickles", desc: "The throw splits in two, and Violet Snare whirls 50% wider." },
        { name: "Executioner", desc: "50% more damage to Drowned below 30% health." },
        { name: "Violet Gyre", desc: "Violet Snare leaves a ring of whirling chains that cuts and roots whatever crosses it." },
      ],
    },
    // Kit 07: the heaviest, widest swing in the game and the hardest knockback, on the fastest feet but one; slow to swing again.
    jadeBreaker: {
      name: "Jade Breaker", tag: "Kit 07", motto: "Stone remembers every blow.", roles: ["Heavy", "Crowd control", "Knockback"],
      weapon: "Jade greatsword", color: "90,230,150",
      desc: "A huge jade crystal greatsword. Slow, sweeping strikes that hurl the Drowned away, on fast feet: dart in, break them, dart out.",
      // `grow`: the sweep's own extra damage per kit level, on top of every kit's +5% (K.power); `shatterKb`: all his knockback from Shatter (10)
      attack: { type: "arc", name: "Jade Sweep", dmg: 26, range: 84, arc: 2.6, cd: 1.0, kb: 320, grow: 0.05, shatterKb: 1.5 },
      dash: { type: "plain" },
      speedMult: 1.15,
      // moving `full` s builds the next swing up to +bonus damage; standing still drains it twice as fast
      passive: { momentum: { full: 1, bonus: 0.3 } },
      // a fan of crystals bursting out row by row to `reach`, each row `step` px on; they stand `life` s, then shatter
      // held (`charge`): after `hold` s it's charged; let go to rush forward `dash` s at `speed`, striking all you pass
      // for the sweep's damage x`bonus`, and the tide bursts out where you stop, x`bonus` too. While you rush, the tide keeps
      // pace: a row of crystals `lane` px either side of your path every `row` px. His own dash stays free.
      // Twin Tide (15) multiplies the tide's reach and that lane by `twin`.
      // Jade Cascade (20): a Drowned the crystals kill sets off a ring of tide `cascade.radius` px round where it fell,
      // `cascade.gens` tides deep at most.
      ability: { id: "tide", name: "Jade Tide", oil: 14, cd: 13, dmg: 30, kb: 300, reach: 210, step: 44, fan: 1.3, speed: 520, life: 0.7, twin: 2,
        cascade: { gens: 3, delay: 0.12, cap: 500, radius: 210 },
        charge: { hold: 0.35, max: 1.5, dash: 0.28, speed: 560, bonus: 1.3, kb: 260, row: 40, lane: 55 },
        desc: "A huge sweep that sends a wave of jade crystals bursting from the ground in a fan ahead: every Drowned it reaches is struck and hurled back. Hold it to charge, then let go to rush forward in a dash strike that hits 30% harder, the tide racing along beside you, and ends in the tide." },
      special: { name: "Momentum", desc: "Moving builds up your next swing: up to 30% more damage after a second on the move." },
      milestones: [
        { name: "Crystal Edge", desc: "Your sweep reaches farther and hurls the Drowned harder." },
        { name: "Shatter", desc: "Everything you do hurls the Drowned 50% harder, and they're stunned for a moment." },
        { name: "Twin Tide", desc: "Jade Tide surges twice as far, and races twice as wide beside your rush." },
        { name: "Jade Cascade", desc: "A Drowned killed by Jade Tide's crystals sets off a ring of jade tide all around where it fell." },
      ],
    },
    /* Kit 08, a secret: the Deadly Rose's knight. Nothing of him shows until he's earned (DL.secretKit in src/game.js):
       slay the Deadly Rose and grow her heart in your camp to its last level (DL.UPGRADES "roseheart"). From then on he
       can be chosen in every new game on this device. Her thorn whip is his sword's reach: the widest, longest swing in
       the game, slow to come round again. */
    rosePaladin: {
      name: "Rose Paladin", tag: "Kit 08", motto: "Every rose keeps its thorns.", roles: ["Heavy", "Reach", "Binding"],
      weapon: "Thorn greatsword and rose shield", color: "220,40,60", secret: true,
      desc: "The Deadly Rose's last knight, in thorned bronze and rose-red. His thorn sword lashes like her whip across a huge arc in front of him, and he whirls into her waltz.",
      // `lash`: drawn as her whip cracking round the arc (src/render.js)
      attack: { type: "arc", lash: true, name: "Thorn Lash", dmg: 22, range: 128, arc: 3.4, cd: 0.95, kb: 230 },
      dash: { type: "plain" },
      // his rose shield takes `aegis` off every blow, and a Drowned that strikes him is pricked for `thorns` x its blow
      passive: { aegis: 0.15, thorns: 0.5 },
      // the waltz: he whirls `spin` s, cutting all within `r` px `hits` times; he walks at `move` x his pace meanwhile.
      // Briar Bind (5) holds what it cuts `bind` s; The Last Dance (20) grows it to `bigR` and `bigHits`.
      ability: { id: "waltz", name: "Rose's Waltz", oil: 14, cd: 12, r: 120, spin: 1.2, hits: 3, dmg: 16, kb: 200, move: 0.6, bind: 1.6, sting: 3, bigR: 165, bigHits: 5,
        desc: "Whirl as the Deadly Rose did: a ring of thorn whips spins round you, cutting and hurling back every Drowned near, three times over. You can walk while you waltz." },
      special: { name: "Thorned Aegis", desc: "Your rose shield takes 15% off every blow, and the Drowned that strike you are pricked by its thorns." },
      milestones: [
        { name: "Briar Bind", desc: "Rose's Waltz binds every Drowned it cuts in briar for a moment, stung while they're held." },
        { name: "Crown of Thorns", desc: "Thorn Lash tears the flesh: the Drowned it strikes bleed." },
        { name: "Rosebriar Lash", desc: "Every third Thorn Lash binds whatever it strikes in briar." },
        { name: "The Last Dance", desc: "Rose's Waltz grows as wide as the Rose's own and spins five times." },
      ],
    },
    /* Kit 09: a hooded crimson reaper-knight who feeds on the kill. Blood Tithe (src/kits.js K.tithe): every Drowned he
       slays is a stack, a boss `boss` stacks, and every `bossHits`th blow on a boss one more. Each stack is `dmg` more
       damage, `speed` more pace and `atk` faster swings, with no cap. They hold `hold` s after the last kill, then
       bleed away one every `drain` s. His look follows the stacks, not his level: forms at `forms` stacks (src/render.js).
       To come: a secret unlock (Robert, 2026-11-01); open from the start for now. */
    bloodsworn: {
      name: "Bloodsworn", tag: "Kit 09", motto: "Every death is a tithe.", roles: ["Snowball", "Melee", "Area damage"],
      weapon: "Crimson longsword", color: "235,50,90",
      desc: "A hooded knight in bone and crimson. Every Drowned he cuts down makes him stronger, faster and quicker to swing, for a while. Stay in the fight and he grows into a crowned terror; hang back and the blood runs dry.",
      attack: { type: "arc", name: "Red Edge", dmg: 11, range: 70, arc: 2.2, cd: 0.5, kb: 140 },
      dash: { type: "plain" },
      // `long`: Long Vigil (15). No cap on the stacks (Robert, 2026-11-01). `healAt`, `heal`: Bloodthirst (10). `halo*`: Thorn Halo (5). `crescent`: Crowned (20)
      passive: { tithe: { dmg: 0.02, speed: 0.01, atk: 0.01, hold: 4, drain: 0.4, boss: 5, bossHits: 4, forms: [10, 20, 30],
        long: 7, healAt: 20, heal: 2, haloAt: 20, haloR: 74, haloDmg: 6, haloCd: 0.5, crescent: 0.6 } },
      // Reap the Tithe: thorns burst up all round him out to `r` + `perR` a stack, striking for `dmg` x (1 + `perDmg` a stack),
      // and spend every stack (half from Crowned, 20)
      ability: { id: "reap", name: "Reap the Tithe", oil: 12, cd: 12, r: 90, perR: 5, rMax: 290, dmg: 18, perDmg: 0.08, kb: 260,
        desc: "Spend your Blood Tithe: thorns of blood burst from the ground all around you. The more stacks you spend, the wider and harder they strike." },
      special: { name: "Blood Tithe", desc: "Every kill is a stack: 2% more damage, 1% more speed and 1% faster swings each, with no limit. They hold 4 seconds after your last kill, then bleed away. Bosses give 5." },
      milestones: [
        { name: "Thorn Halo", desc: "At 20 stacks a halo of thorns crowns you and cuts the Drowned close around you." },
        { name: "Bloodthirst", desc: "At 20 stacks or more, every kill heals you." },
        { name: "Long Vigil", desc: "Your stacks hold 7 seconds after your last kill." },
        { name: "Crowned in Thorns", desc: "At 30 stacks your swings throw red crescents, and Reap the Tithe spends only half your stacks." },
      ],
    },
    /* Kit 10: a bronze knight in a ragged crimson cape with a forge-hot greatsword (Robert's art, 2026-11-06; name and
       abilities proposed by Claude, open to change). Forge Heat (src/kits.js K.heat): every Drowned his blows strike adds
       `perHit` heat (x`tempered` from Tempered Steel, 5), and every blow his guard blocks adds `perBlock`, up to `max`. It holds
       `hold` s after his last blow, then cools `cool` a second. His cleave hits up to `dmg` harder as it fills; full heat
       makes his next Brand Thrust erupt. To come: he'll be Level 3's unlock (Robert, 2026-11-08); open from the start for now. */
    cinderbrand: {
      name: "Cinderbrand", tag: "Kit 10", motto: "The forge never cools.", roles: ["Heavy", "Guard", "Burst"],
      weapon: "Forge greatsword", color: "255,130,40",
      desc: "A bronze knight with a forge-hot greatsword. Slow, crushing overhead chops, every other one sweeping wide, build heat in the blade. Hold your ability to plant the sword and guard; let go to lunge in a Brand Thrust that pierces a whole line. At full heat the thrust erupts in flame.",
      // every other chop sweeps wider (`slash`): `arc` wide, x`dmg` the damage. Both are drawn as the downward chop: the level
      // frames read as a stab (Robert, 2026-11-08)
      attack: { type: "arc", name: "Forge Cleave", dmg: 24, range: 80, arc: 1.7, cd: 0.85, kb: 230, slash: { arc: 2.8, dmg: 0.8 } },
      dash: { type: "plain" },
      passive: { heat: { perHit: 9, perBlock: 20, max: 100, hold: 3, cool: 14, dmg: 0.25, tempered: 1.5, burnAt: 50 } },
      // held (`guard`): the sword planted, he stands his ground; blows from within `arc` of his front lose `block` of their
      // damage. Up to `max` s, then the thrust goes off by itself. Let go (or tap): he lunges `dash` s at `speed`, piercing
      // all within `width` of his path and `reach` past where he stops. Full heat: x`erupt` damage, a line of fire
      // (`fire` dps for `fireT` s) and the heat spent. Brand Line (15): `far` x farther and the line always burns.
      // Forgeheart (20): an eruption spends half the heat and bursts in a ring `ring` px round where he stops.
      ability: { id: "brand", name: "Brand Thrust", oil: 12, cd: 9, dmg: 30, kb: 260, burn: 5, reach: 70, width: 44, speed: 720, dash: 0.16, far: 1.5,
        erupt: 1.8, fire: 12, fireT: 3, ring: 130,
        // Riposte (10) also cracks the ground round him with magma while he guards: a ring from `r0` px spreading to `rMax`
        // over `grow` s, lighting every Drowned standing in it (`burn` a second x his power) (Robert, 2026-11-08)
        guard: { block: 0.7, arc: 2.2, max: 3, riposte: 1, magma: { r0: 40, rMax: 160, grow: 2.5, burn: 6 } },
        desc: "Hold to plant your greatsword and guard: blows from the front lose most of their force and stoke the blade. Let go to lunge in a thrust that pierces every Drowned in a line and sets them burning. At full heat it erupts in a line of fire." },
      special: { name: "Forge Heat", desc: "Every blow that lands heats your sword, and so does every blow you block. A hot blade cleaves up to 25% harder; at full heat your next Brand Thrust erupts in flame." },
      milestones: [
        { name: "Tempered Steel", desc: "Your sword heats half again as fast, and from half heat your cleaves set the Drowned alight." },
        { name: "Riposte", desc: "A blow your guard blocks is struck straight back at the Drowned that threw it, and while you guard the ground cracks with magma in a spreading ring that sets every Drowned in it alight." },
        { name: "Brand Line", desc: "Brand Thrust lunges half again as far and always leaves a burning line behind it." },
        { name: "Forgeheart", desc: "An erupting Brand Thrust spends only half your heat and bursts in a ring of fire where you stop." },
      ],
    },
  };
  // The Frostweaver's frost (src/kits.js): how long freezing and brittle last, brittle's extra damage taken, and the shatter
  // of a frozen Drowned dying (it freezes up to `shatterN` others within `shatterR` px). The owl familiar from level 5.
  DL.ICE = { frost: 2.5, brittle: 0.2, brittleT: 4, shatterN: 3, shatterR: 150, owl: { range: 260, cd: 1.1, dmg: 6 } };
  DL.KIT_ORDER = ["lanternBlade", "pikeWarden", "ashenArbalist", "relicBearer", "flameBastion", "chainReaper", "jadeBreaker", "rosePaladin", "bloodsworn", "cinderbrand"];

  /* ---------- pacing ----------
     Three levers slow everything down together:
     1. COST_SCALE multiplies every building and kit-level price.
     2. The Central Flame needs nights survived (FLAME_NIGHTS), and every building's levels hang off the Flame.
     3. Kit levels are locked in bands behind camp structures (KIT_BANDS). */
  DL.COST_SCALE = 2;
  // The original 1 / 3 / 6 / 10 nights at levels 2–5, then 2 more nights per level (Robert, 2026-11-03):
  // flame 10 at 20 nights, 17 (enough squares for 80% of the map) at 34, 20 at 40.
  DL.FLAME_NIGHTS = Array.from({ length: DL.FLAME.max + 1 }, (_, l) => (l <= 5 ? l * (l - 1) / 2 : 10 + 2 * (l - 5)));
  DL.KIT_BANDS = [
    { upTo: 5, req: { forge: 1 } },
    { upTo: 10, req: { forge: 2, flame: 3 } },
    { upTo: 15, req: { forge: 3, armory: 2, flame: 4 } },
    { upTo: 20, req: { forge: 4, armory: 3, flame: 5 } },
  ];
  const scaleCost = (c) => {
    const out = {};
    for (const k in c) out[k] = k === "heart" ? c[k] : Math.max(1, Math.round(c[k] * DL.COST_SCALE)); // a world has only five Magma Hearts
    return out;
  };

  // Price to train a kit from level L to L + 1.
  DL.kitLevelCost = function (L) {
    const c = { iron: Math.round(2 + 1.6 * L), resin: Math.round(1 + 0.9 * L) };
    if (L < 8) c.stone = 3 + L;
    if (L < 4) c.wood = 4;
    if (L >= 9) c.pearl = Math.floor((L - 6) / 3);
    if (L >= 19) c.black = 3; // the last level needs Black Pearls from the Abyss
    return scaleCost(c);
  };
  // Structures needed to train up to `target`.
  DL.kitLevelReq = (target) => DL.KIT_BANDS.find((b) => target <= b.upTo).req;

  /* Difficulty: chosen with the kit when a game starts.
     yield/density = supplies, enemyHp/enemyDmg/spawn = the Drowned, bloom/light/corrupt/darkness/dayDim = light. */
  DL.DIFFICULTIES = {
    dim: { name: "Dim", motto: "A pale light still lingers.",
      yield: 1.35, density: 1.15, enemyHp: 0.7, enemyDmg: 0.65, spawn: 0.75, bloom: 1.6, light: 1.15, corrupt: 0.65, darkness: 0.82, dayDim: 0,
      notes: ["Plentiful supplies", "Weaker, fewer Drowned", "Blooms everywhere, wider firelight", "Corruption creeps slowly"] },
    dark: { name: "Dark", motto: "The night as it was meant to be.",
      yield: 1, density: 1, enemyHp: 1, enemyDmg: 1, spawn: 1, bloom: 1, light: 1, corrupt: 1, darkness: 1, dayDim: 0,
      notes: ["Standard supplies", "Standard Drowned", "Standard light", "The intended challenge"] },
    pitch: { name: "Pitch Black", motto: "The light grows thin.",
      yield: 0.8, density: 0.9, enemyHp: 1.35, enemyDmg: 1.25, spawn: 1.25, bloom: 0.65, light: 0.88, corrupt: 1.3, darkness: 1, dayDim: 0.08,
      notes: ["Scarcer supplies", "Stronger, more numerous Drowned", "Fewer blooms, shorter firelight", "Corruption bites faster"] },
    abyss: { name: "Abyss", motto: "Nothing here remembers the sun.",
      yield: 0.65, density: 0.8, enemyHp: 1.75, enemyDmg: 1.5, spawn: 1.5, bloom: 0.4, light: 0.78, corrupt: 1.65, darkness: 1, dayDim: 0.25, dayCorrupt: true,
      notes: ["Scarce supplies", "Brutal Drowned in great numbers", "Rare blooms, feeble firelight, dim days", "The Mire and deeper corrupt even by day"] },
  };
  DL.DIFF_ORDER = ["dim", "dark", "pitch", "abyss"];

  DL.TORCH_COST = { wood: 3, resin: 1 };

  /* Bone Hound: an ally won at the Bone Wolf den (DL.DEN), one per knight. It hunts in order:
     any Drowned that retreats (Mire Stalkers, and anything backing away), then anything that shoots
     (Tide Archers, Hexbearers), then whatever is nearest. Priority prey is chased out to `chase` px
     from its knight, the rest within `sight`. Every bite opens a bleed that ignores armour and stacks up to `bleedMax`.
     It never dies: beaten down, it lies knocked out for `downTime` seconds, then gets up whole.
     Health and bite grow by `perFlame` for each Central Flame level past `reqFlame`. */
  DL.HOUND = {
    name: "Bone Hound", reqFlame: 2, downTime: 20,
    hp: 80, dmg: 6, cd: 0.8, range: 22, speed: 185, lunge: 360, perFlame: 0.15,
    bleedDps: 2.5, bleedDur: 4, bleedMax: 3,
    sight: 320, chase: 480, leash: 650, regen: 5, radius: 9,
  };
  /* The Bone Wolf den (src/den.js): one per world, about `dist` px from camp, out in the Mire. `pack` Bone Wolves
     sleep at its mouth; they wake when a knight comes within `wake` px, run home if their prey gets `leash` px from
     the den, and the whole pack gathers again if every knight goes `forget` px away before it is broken. Once all
     are dead, walk over a carcass to haul it (at `haulSpeed`) and bring it into the camp: it rises as your hound.
     The den fills again at the dawn after its last carcass is taken. `clear` keeps trees and rocks off its ground. */
  DL.DEN = { dist: 1750, clear: 190, pack: 5, wake: 240, leash: 560, spawn: 900, forget: 1500, grab: 34, haulSpeed: 0.85 };
  /* Kindle, the walking lantern (src/kindle.js): every knight lights their own. A broken lantern lies `dist` px from
     camp, in the Mire where the iron starts. Stand within `feedR` px of it and it takes a torch from your satchel
     every `feedEvery` seconds; `torches` light your Kindle for good. Then he follows you at `speed` and, when your
     lantern is below `refillBelow` of its oil, fills it (no more than once every `refillEvery` seconds). He only
     fills his own knight's lantern, doesn't touch corruption, and his light doesn't hold it off. Every `guideEvery`
     nights after the world's first Kindle was lit, every Kindle runs `lead` px ahead of its knight toward the same
     unique place, until that knight is within `reachR` px of it. */
  DL.KINDLE = { dist: 1450, torches: 7, feedR: 46, feedEvery: 0.5, speed: 160, refillEvery: 50, refillBelow: 0.5, guideEvery: 3, lead: 90, reachR: 360 };
  /* Abigail, the soul wraith familiar (src/abigail.js): every knight wins their own. `orbs` soul orbs lie scattered
     over the land, per ring [how many, from px, to px] out from camp; each device sees and picks up only its own.
     Walk within `grab` px of one to take it. Bring them to the graves in the Abyss (`graveDist` px out, a clearing
     of `clear` px) and they're laid to rest when you come within `giveR` px of the heart of the graves; `need` laid
     to rest and Abigail rises. She floats at her knight's side and every `cd` seconds sends a homing soul orb
     (`dmg`, growing by `perFlame` per Central Flame level past `reqFlame`) at a Drowned within `sight` px of her
     knight. A Drowned an orb hits is weakened for good: `curse` less damage and speed, and takes `curse` more damage
     (once, it doesn't stack). Every `pulseEvery` seconds she blesses her knight for `buffDur` seconds: `buff` more
     damage and speed, and `buff` less damage taken. */
  DL.ABIGAIL = {
    name: "Abigail", speed: 175, cd: 1.6, sight: 300, dmg: 6, perFlame: 0.15, reqFlame: 2,
    orbSpeed: 240, orbLife: 2.4, curse: 0.1, pulseEvery: 20, buffDur: 10, buff: 0.1,
    need: 10, orbs: [[3, 480, 1120], [4, 1280, 1920], [3, 2080, 2720], [2, 2900, 3500]], grab: 28,
    graveDist: 3200, clear: 190, giveR: 120,
  };
  /* Fred, the mushroom familiar (src/fred.js). A tiny Fred sleeps in a fairy ring of toadstools in the Drowned
     Reaches, `ringDist` px out (a clearing of `clear` px). Come within `wakeR` px of it at night with a torch in your
     satchel and he wakes, and the Drowned hunt him until dawn: a wave (`waveR` px out) every `waveEvery` s, and he
     sprouts a glowcap every `trialCapEvery` s for his defenders. He has `trialHp` health (more per friend). Alive at
     dawn: every knight within `winR` px of the ring wins their own Fred. Killed: the ring wilts for `wilt` nights.
     He follows his knight at `speed` and every `cd` s spits a spore glob (`dmg`, growing by `perFlame` per Central
     Flame level past `reqFlame`) at a Drowned within `sight` px of his knight: `slow` less speed for `slowFor` s
     (half as much on a boss). By night, and in the Abyss, he sprouts a glowcap every `capEvery` s (at most `capMax`
     lying out, each lasting `capLife` s): step on it to heal `capHeal`. At levels 5, 10 and 15 you choose his road,
     A (Mender) or B (Blight): `roads`. Bosses are never confused, turned or put to sleep. */
  DL.FRED = {
    name: "Fred", speed: 150, sight: 270, cd: 2.2, dmg: 4, perFlame: 0.15, reqFlame: 2, globSpeed: 230, globLife: 1.7,
    slow: 0.25, slowFor: 3,
    capEvery: 30, capHeal: 12, capLife: 45, capMax: 3, capR: 20,
    bloomEvery: 20, bloomHeal: 20, bloomCleanse: 15,   // A at 5: Bloomcaps
    cloudR: 55, confuse: 2,                            // B at 5: Befuddling Spores
    ringEvery: 20, ringFor: 8, ringR: 90, ringHeal: 3, // A at 10: Fairy Ring
    mindEvery: 14, mindFor: 4, mindR: 260,             // B at 10: Mindrot
    rebloom: 0.4,                                      // A at 15: Second Bloom
    stormEvery: 25, stormR: 200, sleep: 2.5,           // B at 15: Spore Storm
    ringDist: 2400, clear: 170, wakeR: 70, trialHp: 260, waveEvery: 10, waveR: 480, trialCapEvery: 15, winR: 900, wilt: 3,
    campCaps: [0, 0, 1, 3], // glowcaps the Toadstool Cottage sprouts in the camp each dawn, by its level
    repick: { resin: 40, pearl: 10, black: 5 }, // choosing his roads again, at a level 3 cottage
    roads: [
      [{ name: "Bloomcaps", text: "Glowcaps every 20 s heal 20 and burn away corruption" },
        { name: "Befuddling Spores", text: "Spore globs burst into a cloud: the Drowned in it forget you and wander off for 2 s" }],
      [{ name: "Fairy Ring", text: "Standing still, he drips a ring every 20 s: for 8 s knights in it heal 3 a second and corruption stops" },
        { name: "Mindrot", text: "Every 14 s a Drowned turns and fights the other Drowned for 4 s" }],
      [{ name: "Second Bloom", text: "Once a night, when you fall, he stands you back up at 40% health" },
        { name: "Spore Storm", text: "Every 25 s every Drowned near you falls asleep for 2.5 s (a blow wakes it)" }],
    ],
  };
  /* David, the wyvern familiar (src/wyvern.js). A nest of bones on the rocks of the Drowned Reaches, `nestDist` px
     out (a clearing of `clear` px), holds a clutch of blood-red eggs while their mother hunts. Walk into the nest
     (within `grab` px of its heart) and you take one (`warnR`: how near you're warned first). She comes at once,
     from `arriveR` px off, and hunts whoever carries it, wherever they go, over walls and water, never tiring.
     Slay her and the egg hatches: the carrier and every knight within `winR` px of her wins their own David. Kill
     the carrier, and she snatches the egg back and flies home with it. Slain, she's gone `respawnDays` days and her
     nest lies empty. Her moves (her body and claw are DL.ENEMIES.wyvern):
       swoop  every `every` s, when her prey is `min`–`max` px off: she rises (`windup` s, the lane shows on the
              ground) and dives straight through at `speed` px/s for `dur` s, raking every knight she passes
              (`dmg` of her blow, hurled `kb` px back);
       breath every `every` s, when her prey is within `range` px: `windup` s rearing, then `dur` s of fire in a
              cone `arc` radians each side, `dmg` of her blow every `tick` s to everyone in it;
       storm  (below `phase2` of her health) every `every` s: lightning falls `delay` s after its marks, one on
              each knight and `extra` more near them (`r` px, `dmg` of her blow).
     She flies to catch up when her prey is more than `catchUp` px off. The carrier carries the egg at `haulSpeed`.
     David himself flies at his knight's shoulder at `speed` and every `cd` s spits a bolt (`dmg`, growing by
     `perFlame` per Central Flame level past `reqFlame`) at a Drowned within `sight` px of his knight. At levels 5,
     10 and 15 you choose his road, A (Storm) or B (Fire): `roads`. Each road's level 10 power is a boost you call
     with the Boost button: it lasts `boostFor` s and can be called again `boostEvery` s after it began. */
  DL.WYVERN = {
    name: "David", speed: 190, sight: 300, cd: 2, dmg: 5, perFlame: 0.15, reqFlame: 2, boltSpeed: 380, boltLife: 1.6,
    chainN: 3, chainR: 130, chainDmg: 0.6,             // A at 5: Chain Lightning
    searMult: 2.5, searCd: 1.35, searBurn: 4,          // B at 5: Searing Bolt (its fire burns for 3 s)
    boostFor: 20, boostEvery: 40, tailwind: 0.3, fury: 0.25, // A at 10: Tailwind (speed); B at 10: War Fury (damage)
    shock: 0.8,                                        // A at 15: Static Shock (stun, never a boss)
    cauterAt: 0.3, cauterHeal: 0.3, cauterFor: 3, cauterEvery: 60, // B at 15: Cauterize
    nestDist: 2550, clear: 170, grab: 40, warnR: 230, arriveR: 760, winR: 900, respawnDays: 3, haulSpeed: 0.92, catchUp: 620,
    swoop: { first: 5, every: 9, min: 110, max: 430, windup: 0.8, speed: 720, dur: 0.6, dmg: 0.9, kb: 300 },
    breath: { first: 3, every: 11, range: 230, windup: 0.8, dur: 1.4, arc: 0.48, tick: 0.25, dmg: 0.22 },
    storm: { every: 12, delay: 1.2, extra: 3, r: 40, dmg: 0.85 },
    phase2: 0.5,
    repick: { iron: 30, pearl: 10, black: 5 }, // choosing his roads again, at a level 3 Wyvern Roost
    roads: [
      [{ name: "Chain Lightning", text: "His bolt is lightning that leaps to 3 more Drowned nearby for 60% of its damage" },
        { name: "Searing Bolt", text: "A slower fireball for 2.5 times the damage that sets its target burning; he aims for the biggest foe" }],
      [{ name: "Tailwind", text: "Boost: you move 30% faster for 20 s (again 40 s after it began)" },
        { name: "War Fury", text: "Boost: you deal 25% more damage for 20 s (again 40 s after it began)" }],
      [{ name: "Static Shock", text: "His lightning stuns every Drowned it strikes for 0.8 s (never a boss)" },
        { name: "Cauterize", text: "Once a minute, when you drop below 30% health, he burns your wounds shut: you heal 30% over 3 s" }],
    ],
  };
  /* The Starved Bell (src/bell.js): one roams the Abyss, `r` px out from the camp, creeping `roam` radians a second
     round the ring while nobody is near. It rises from the deep (comes into play) when a knight is within `spawn` px
     and sinks back, healed, once every knight is `forget` px away. It lies buried until a knight comes within its
     `wake` (DL.ENEMIES.bell), then bursts up in a ring of `erupt` px. Awake it claws (its normal blow), tolls every
     `tollEvery` seconds (a ring of `tollR` px that hurts and adds `tollCorrupt` corruption), and every `gulpEvery`
     seconds, when a knight is within `gulpR` px, rears for `gulpWindup` seconds and lunges mouth first. A knight it
     catches is swallowed for `hold` seconds, bitten for `bite` of its damage every half second; it spits them out early
     once it has lost `free` of its health since (friends, hounds and Derek can cut you free), or when it dies. Slain, it
     stays gone for `respawnDays` days. */
  DL.BELL = {
    r: 3200, roam: 0.0035, spawn: 1100, forget: 1700, erupt: 120, creep: 26,
    tollEvery: 8, tollR: 160, tollCorrupt: 12, gulpEvery: 7, gulpR: 170, gulpWindup: 0.9, lunge: 620,
    hold: 3, bite: 0.22, free: 0.1, respawnDays: 3,
  };
  /* The Deadly Rose (src/rose.js): her garden lies `dist` px out from camp in the Abyss (±150), a clearing of `clear` px
     ringed by up to `bushes` rose bushes. Red petals blow off it out to `petalR` px; a knight within `hintR` px is told
     which way they blow from, and within `foundR` px has found it. She comes into play when a knight is within `spawn` px,
     goes back to her roses, whole, once every knight is `forget` px away, and never strays more than `leash` px from
     them. She sleeps until a knight comes within her `wake` (DL.ENEMIES.rose).
       lash   her ordinary blow: a whip across `arc` (DL.ENEMIES.rose) out to her range + 20, hurling knights `lashKb` back.
              Its drawn trail plays for `lashShow` s.
       waltz  first after `first` s, then every `every` s when her prey is within `r` + 30 px: a `windup` s warning ring,
              then she spins for `spin` s, edging toward them at `drift` of her speed, and cuts everyone within `r` px
              `hits` times for `dmg` of her damage, hurling them `kb` back.
       briar  every `every` s when her prey is within `reach` px: after `windup` + `delay` s, thorns burst up in a line
              of `n` spots `step` px apart toward every knight and one under each (`r` px, `dmg` of her damage); they
              stand `life` s and sting anyone in them for `sting` of her damage every half second. At most `maxVines`.
     Below `phase2` of her health she moves `fast` times quicker, her moves come `rate` times as often, and the briar
     rings her too. Slain, she stays gone `respawnDays` days. */
  DL.ROSE = {
    dist: 3250, clear: 230, bushes: 11, petalR: 1700, hintR: 1500, foundR: 420, spawn: 1100, forget: 1700, leash: 460,
    lashKb: 260, lashShow: 0.4, phase2: 0.5, fast: 1.2, rate: 1.35, respawnDays: 4, maxVines: 30,
    waltz: { first: 5, every: 9, windup: 0.9, spin: 1.3, r: 170, drift: 0.6, hits: 3, dmg: 0.45, kb: 240 },
    briar: { first: 3, every: 11, windup: 0.6, delay: 0.5, reach: 480, n: 5, step: 58, r: 34, dmg: 0.7, life: 4, sting: 0.12 },
  };
  /* How the Drowned grow night by night (src/game.js makeEnemy). Up to night `until` each one gains `hp` health and `dmg`
     damage a night; after it only `lateHp` and `lateDmg` (balance pass, Robert 2026-11-04: the Flame runs to night 40
     but a knight's power tops out near night 15, so the horde must not turn into sponges). Waves still grow in number. */
  DL.GROWTH = { until: 10, hp: 0.08, dmg: 0.05, lateHp: 0.02, lateDmg: 0.01 };
  /* The great bosses (balance pass, 2026-11-04). Their health is `hp[type]` (in place of DL.ENEMIES' hp) x zone x
     difficulty, growing `perNight` a night (not DL.GROWTH) and `perAlly` more for every friend in co-op (the horde gets
     +15%). Their blows keep growing `dmgNight` a night. Poise: a stun from a kit or familiar holds any boss (the
     Sovereign too) at most `stun` s, and then none takes hold for `immune` s (src/game.js G.stun).
     Size (Robert 2026-11-04, "about 1.8x bigger"): each boss's drawing, body (`radius`), reach (`range`) and health bar
     height (`barY`) in DL.ENEMIES are multiplied by `size[type]` below, so each stands about three knights tall. The
     Sunken King is a scene of his own and keeps his size. */
  DL.BOSS = {
    size: { colossus: 2.2, bell: 2.0, rose: 1.75, wyvern: 1.6, riftlord: 1.5, golem: 1.25, hydra: 1.6, wyrm: 1.35, seraph: 1.3, cinder: 1.4, sovereign: 1.5 },
    view: 820, viewR: 650, // within `viewR` px of an awake boss the camera pulls back to show at least `view` px top to bottom
    hp: { colossus: 2000, wyvern: 1700, bell: 1500, rose: 1700, king: 1600, riftlord: 1800, golem: 1500, hydra: 1500, wyrm: 1500, seraph: 1500, cinder: 1800, sovereign: 2400 },
    perNight: 0.04, dmgNight: 0.05, perAlly: 0.6,
    stun: 0.3, immune: 3,
  };
  /* The bosses' minions (src/minions.js; their bodies are in DL.ENEMIES). Each boss calls its own while it fights and they
     crumble when it dies or leaves. `max` is the most alive at once (x the party for the swarms, `party: true`).
       start  how many come when the fight starts;  phase2  how many more come when the boss drops below half health;
       every  then one batch of `n` every `every` s (`every2` below half);  respawn  a lone one comes back that long
       after it falls.  Special callings: the Bell's Skitterers come `perToll` with each toll; the Colossus's ruins
       let a Crawler out (`fromRuin`) when they crumble; a Screecher calls `call` Drakelings every `callEvery` s; a
       Toll Wretch makes the Bell toll `tollRate` x as often. The Sunken King's climb out of the causeway, not round him. */
  DL.MINIONS = {
    colossus: {
      cairn: { max: 6, fromRuin: 1, party: true },
      servitor: { max: 2, start: 2, phase2: 1, ward: 600 },
      siltfist: { max: 1, phase2: 1 },
    },
    bell: {
      skitterer: { max: 8, perToll: 3, party: true },
      leech: { max: 4, every: 14, every2: 10, n: 2, party: true },
      tollwretch: { max: 1, start: 1, respawn: 25, tollRate: 1.6 },
    },
    rose: {
      handmaiden: { max: 4, start: 2, phase2: 2 },
      rosewretch: { max: 3, every: 16, every2: 11, n: 1 },
      thornling: { max: 9, every: 10, every2: 7, n: 3, party: true, bushes: true },
    },
    wyvern: {
      drakeling: { max: 6, every: 9, every2: 7, n: 2, party: true },
      raptor: { max: 4, start: 2, phase2: 2 },
      screecher: { max: 2, start: 1, phase2: 1, call: 2, callEvery: 8, wildMax: 4 },
    },
    // the Sunken King's: his own "call" move (DL.FINALE.king.call) now brings Tide Stalkers; while a Wisp lives the
    // Fire Bearer gathers its flame only `slow` as fast
    king: {
      tidestalker: { max: 14 },
      wisp: { max: 3, start: 2, phase2: 1, slow: 0.6 },
      tideleech: { max: 3, every: 14, every2: 10, n: 1, party: true },
    },
    // the Lord of the Rift Throne's (src/riftthrone.js): they climb out of the arena floor, held to it
    riftlord: {
      mite: { max: 6, every: 11, every2: 7, n: 2, party: true },
      swisp: { max: 3, start: 1, phase2: 2 },
      warden: { max: 2, start: 1, phase2: 1 },
    },
    near: 1400, // a boss more than this far from every knight is left alone (no calling)
    /* Robert (2026-11-04): once a boss has been slain (save.archive), its minions also roam as ordinary Drowned at
       night, from its home zone (`zone`, DL.ZONES index) outward, with these weights added to the zone's pool.
       The swarming ones come in a `pack` (DL.ENEMIES). Away from their boss they don't call, ward or heal. */
    wild: {
      colossus: { zone: 2, pool: { cairn: 1.5, servitor: 0.4, siltfist: 0.15 } },
      wyvern: { zone: 3, pool: { drakeling: 1.2, raptor: 1, screecher: 0.3 } },
      bell: { zone: 4, pool: { skitterer: 1.2, leech: 1, tollwretch: 0.4 } },
      rose: { zone: 4, pool: { thornling: 1.2, rosewretch: 0.8, handmaiden: 0.4 } },
      king: { zone: 4, pool: { tidestalker: 1.2, wisp: 0.4, tideleech: 0.4 } },
    },
  };
  /* Last stand (src/game.js hurtPlayer): a blow that would kill you while your health is above `above` of its maximum
     leaves you at 1 health instead, safe from harm for `inv` s. A blow taken at or below that line kills as usual. */
  DL.LAST_STAND = { above: 0.25, inv: 1 };
  /* The finale (src/finale.js): Kindle becomes the Fire Bearer and carries the last light of the marsh to the Drowned Gate.
     Nothing of it shows until it's earned: Central Flame 5, the Starved Bell and the Deadly Rose slain, Derek won from the
     Colossus, and your Kindle lit. At the next dawn Kindle drinks from the Central Flame and rises as the Bearer.
       gate      the Drowned Gate stands `dist` px out (±250) in the north half of the Abyss, on dry land, kept `clear` px clear
                 of rocks and trees; within `foundR` px a knight has found it. The arena is a ring of `arenaR` px whose
                 heart lies `arenaY` px south of the gate; the Bearer stops `plantY` px south of the gate. In the arena the
                 camera pulls back to show at least `view` px top to bottom (and `viewW` across), and leans toward the King.
                 The gate stands in a lake of black water (`lake`: a rounded box centred `cy` px off the gate, `rx` by `ry`
                 px); a stone causeway `causeway` px either side of the middle runs out of it to the gate. Nobody wades it.
       bearer    sent from the camp by day, it strides straight to the hearth (the escort march was cut for the pyramid).
                 It has `hp` health (× the party), firelight `light` px round it, and every `pulseEvery` s burns the
                 Drowned within `pulseR` px for `pulseDmg`. At dawn it heals `dawnHeal` of its health. The march numbers
                 below (speed, leash, band*, braziers, wave*, campR, restLight) are no longer used.
       falling   at 0 health it gutters and falls back to its last camp (or the Central Flame), and rekindles at dawn.
       king      the Sunken King rises `rise` s after the Bearer plants at the gate. While the Bearer stands it fills its
                 charge over `charge` s (each blow it takes knocks off `hitCharge`), then hurls its flame: the King's heart
                 burns open for `open` s, the only time he can be hurt. At `phases` of his health the burning ends and he
                 grows angrier (his moves come `rate` × as often per phase). He sinks back, whole, if every knight
                 goes `forget` px off. His moves, each on its own timer:
                   slam   a great hand falls on a knight (or the Bearer): `r` px, after `windup` s, `dmg` × his damage, and
                          `bearer` damage to the Bearer if it's under it;
                   sweep  his arm sweeps a lane across the arena at a knight's height: `n` spots `step` px apart;
                   call   `n` (+1 per phase) Drowned climb out of the black water and go for the Bearer;
                   rain   from phase 2: black water rains on `n` spots round the knights, adding `corrupt` corruption. */
  DL.FINALE = {
    gate: { dist: 3950, clear: 560, foundR: 650, arenaR: 420, arenaY: 250, plantY: 380, view: 1450, viewW: 1000,
      lake: { cy: -150, rx: 820, ry: 580 }, causeway: 170 },
    speed: 24, wade: 0.6, leash: 340, hp: 1500, light: 260, restLight: 330, pulseEvery: 3, pulseR: 95, pulseDmg: 18,
    bandEvery: 15, bandN: 3, bandR: 440, braziers: 4, brazierR: 160, waveEvery: 11, waveN: 4, campR: 750, dawnHeal: 0.4,
    king: {
      rise: 3.5, charge: 16, hitCharge: 0.012, open: 9, phases: [0.66, 0.33], rate: 1.25, forget: 1500, spawn: 1000,
      slam: { first: 3, every: 4.2, windup: 1.4, r: 92, dmg: 1.3, bearer: 70 },
      sweep: { first: 8, every: 11, windup: 1.7, n: 9, step: 58, r: 40, dmg: 1, bearer: 90 },
      call: { first: 6, every: 15, n: 4 },
      rain: { first: 4, every: 9, windup: 1.3, n: 6, r: 48, dmg: 0.5, corrupt: 10 },
    },
  };
  /* Derek, the stone golem familiar (src/golem.js): won in Derek's Hollow (DL.CAVE), one per knight.
     He can't be hurt. Every `buildCd` seconds, when a Drowned comes within `trigger` px of his knight,
     he raises a stone wall `len` px long across its path, `gap` px out from the knight. Drowned within
     `lure` px of a wall drop everything to smash it (arrows and orbs stop on it too); `hits` blows break it,
     and it crumbles on its own after `life` seconds. At most `maxWalls` stand for each Derek. */
  DL.GOLEM = {
    name: "Derek",
    speed: 150, buildCd: 9, trigger: 300, gap: 90, len: 76, hits: 2, life: 20, maxWalls: 2,
    lure: 230, castRange: 260,
  };
  /* Derek's Hollow (src/cave.js): the cave where Derek is won. Its mouth stands `dist` px from camp in the Mire;
     the cave arena (`radius` px) lies far off the map at (x, y), and its Drowned are as strong as zone `zone`'s.
     `intro` seconds before wave 1, `rest` between waves, a group pours out of a tunnel every `burst` seconds.
     Each wave brings `n` of its new kind plus `mix` of the kinds already met (both scaled by difficulty and party).
     After a wave everyone heals `heal` of their health and the fallen rise with `rise`; losing leaves you `failHp`. */
  /* Bullet hell for the dungeon levels (src/bullets.js). Bullets are slow and readable; the dash threads them. */
  DL.BULLETS = {
    cap: 700, speed: 110, r: 6, dmg: 7, life: 7, reach: 1100,
    hitbox: 6, // added to a bullet's radius: how close to the knight's middle it must come to hit
    sentinel: { wake: 560, charge: 0.7, mouth: 52, dmg: 7 }, // the Spire Sentinel crystal turret
    // [gentle, dense] pairs are read at the room's heat (src/spirefoes.js)
    // the Chain Leaper: crouch, leap at you (no farther than hop), slam, a ring of shards
    leaper: { reach: 480, every: [3.4, 2.2], crouch: 0.55, air: 0.6, slam: 0.45, hop: [230, 320], peak: 70, hitR: 44,
      ring: [10, 20], rings: [1, 2], speed: [95, 125], dmg: 7 },
    // the Bridge Bowman: keeps keep[0]..keep[1] away, draws, looses `lanes` parallel lanes of `per` arrows (one lane left empty)
    bowman: { reach: 620, keep: [230, 340], every: [3.2, 2.2], draw: 0.85, loose: 0.25, quiver: 0.55, hand: 52,
      lanes: [7, 9], per: [3, 5], step: 30, width: [280, 360], speed: [150, 190], dmg: 6 },
    // the Mist Shade: lurks lurk[0]..[1] away faded (takes `faded` of a blow), surfaces when your light comes within
    // find (in mist / out of it) or a bubble of light holds it, throws fans, fades and blinks away
    shade: { hover: 16, lurk: [170, 240], find: [140, 250], surface: 0.35, gather: 0.55, throw: 0.3, fade: 0.5, rest: [2.6, 1.8],
      fan: [7, 13], volleys: [1, 2], spread: [0.9, 1.2], speed: [115, 150], dmg: 7, faded: 0.3, blink: [170, 240] },
    // the Rift Caller: keeps keep[0]..[1] away, tears `rifts` round you that each fire `bursts` aimed bursts, and calls
    // `calls` Drowned every `call` s (no more than callMax of its own at once)
    caller: { hover: 22, reach: 650, keep: [300, 420], every: [4.4, 3.0], tear: 0.6, rifts: [2, 3], ring: [150, 220], open: 0.8,
      life: 2.6, bursts: 2, gap: 0.7, burst: [3, 5], spread: 0.5, speed: [120, 150], dmg: 7, call: 12, calls: 2, callMax: 4,
      bow: 0.8, callType: "footman" },
    // the Prism Knight: its shield takes all but `soak` of a blow within `front` rad of dead ahead; it bursts a ring when
    // it has soaked burstAt or every `every` s (one more bullet per `extra` soaked), and bashes what comes close
    prism: { reach: 520, front: 1.2, soak: 0.35, burstAt: 60, extra: 6, every: [7, 5], raise: 0.6, ring: [16, 26],
      speed: [100, 125], dmg: 8, bash: { reach: 66, wind: 0.45, time: 0.3, lunge: 260, kb: 360, cd: 1.6 } },
    // the Rift Throne boss's minions: the Mite scuttles in, its back cracks and it bursts into a ring; the Wisp keeps its
    // distance and flings stars and spins spirals; the Warden thrusts its halberd close in and plants it for a wall
    mite: { crack: 0.6, near: 70, ring: 10, speed: 120, dmg: 7 },
    swisp: { hover: 34, keep: [180, 300], every: [3.0, 2.2], charge: 0.6, star: 12, spin: 2.2, arms: 3, speed: 115, dmg: 7 },
    warden: { reach: 84, draw: 0.5, thrust: 0.3, lunge: 280, kb: 300, cd: 1.4, plant: 0.8, every: 6, wall: [520, 22, 80], speed: 140, dmg: 7 },
    /* the Lord of the Rift Throne (src/riftthrone.js). Asleep on his throne until you step into the arena: he wakes
       (`wake` s), rises (`rise` s), then fights in three phases (below `phase` of his health he kneels for `kneel` s, can't
       be hurt, bursts a ring and calls more minions). Between moves he waits `every[phase]` s.
       Phase 1, side on, walking within keep[0]..keep[1]: Glaive Slam (raise, then a ring and a wall with a gap at you)
       and Rift Storm (arms spread, a spiral). Phase 2 and 3, front on, his armour cracked: Sweep (fans swept across
       you), Storm (more arms), Rift Tears (bursts round you), and he blinks across the arena. Phase 3 the rift also pours
       a slow spiral the whole time. Beaten: `reward` into the run's loot, and everything carried comes home. */
    riftlord: { wake: 1.4, rise: 1.0, keep: [170, 300], every: [2.0, 1.6, 1.2], phase: [0.66, 0.33], kneel: 2.2,
      slam: { raise: 0.9, hit: 0.45, r: 84, ring: [20, 24, 28], wall: [760, 30, 100], speed: 130, dmg: 9 },
      storm: { time: 3.2, arms: [3, 4, 5], rate: 6, spin: 1.3, speed: 105, dmg: 7 },
      sweep: { wind: 0.7, fans: 4, n: 13, spread: 1.5, turn: 0.3, gap: 0.22, speed: 150, dmg: 8 },
      tears: { n: [3, 4], r: [120, 200], open: 0.9, ring: 10, speed: 120, dmg: 7 },
      blink: { out: 0.45, in: 0.45, far: 260 },
      pour: { arms: 2, rate: 3, spin: 0.7, speed: 90, dmg: 6 },
      reward: { shard: 60, aether: 4 } },
  };

  /* Abyssal Spires test room (Robert, 2026-11-05: try a dungeon with corridors and heights in the 3/4 view before
     drawing art for it). Far off the map like Derek's Hollow; reached from the pause menu in Sandbox. src/spires.js */
  DL.SPIRES = {
    x: 40000, y: 0, halfW: 2900, halfH: 3000,
    lh: 48,      // world px of drop per height level (a face this much taller per level)
    hang: 44,    // face showing under a level-0 floor before it fades into the mist
    dark: 0.36,  // the room's darkness (violet dusk, not night)
    wave: { zone: 1 },
    // the Hollow Mist (src/spires.js): corruption a second in it, how near a foe still sees you in it, the first-strike
    // bonus from it, the light holes cut by your lantern / a torch / a burning Aether Crystal (for `burn` s), and how
    // long you stand at a lit Mist Well to go home
    mist: { corrupt: 3, see: 110, strike: 1.5, lantern: 85, torch: 120, bubble: 190, burn: 25, home: 1.5 }, // the zone the rooms' foes are made for (their health and damage); rooms: ROOMS in src/spires.js
    // a run's loot (step 6): Rift Shards per foe broken, per room cleared (by its heat, 0..1), in a side room's chest;
    // carried Aether Crystals come home too. Leave and you keep `keep` of it; fall and the mist keeps it all.
    loot: { kill: { sentinel: 1, leaper: 1, bowman: 1, shade: 2, caller: 2, prism: 4, swisp: 1, warden: 2 }, room: [2, 8], chest: { shard: [14, 20], aether: 2 }, keep: 0.5 },
  };
  // The Molten Mines (Level 3, src/mines.js): off the map at x -40000. lh/hang as in the Spires; dark is the run's
  // darkness (the lava lights it); home is how long you stand at a lit Ember Shrine to go home.
  DL.MINES = { x: -40000, y: 0, halfW: 2500, halfH: 2200, lh: 48, hang: 50, dark: 0.3, home: 1.5 };
  /* the Ashen Sovereign's minions in the Molten Mines (src/minefoes.js; their bodies are in DL.ENEMIES).
     wretch: drips burning puddles (`puddle` px, `burns` s, `dmg` a touch) every `drip` s while it moves, and heals
       `feast` of its health when a minion falls within `feastR` px. guard: its slam throws a ring of `ring` fire globs.
     halberd: every `throwEvery` s, from `near`..`far` px, it winds up `throwWind` s and throws a 3-way fire crescent.
     acolyte: lights a fire circle (`circle` px, `fuse` s) under a knight instead of striking, and every `wardEvery` s
       wards the nearest other minion within `wardR` px: half damage for `wardFor` s. */
  DL.MINE_FOES = {
    zone: 4, // they grow like the Abyss's Drowned
    wretch: { drip: 1.1, puddle: 22, burns: 3, dmg: 4, feast: 0.35, feastR: 220 },
    guard: { ring: 10, speed: 140, dmg: 8, life: 1.4 },
    halberd: { throwEvery: 4.5, near: 120, far: 320, throwWind: 0.55, speed: 230, dmg: 10, spread: 0.55 },
    acolyte: { circle: 46, fuse: 1.1, wardEvery: 5, wardR: 260, wardFor: 4 },
  };
  // the Molten Mines' traps (src/minetraps.js): seconds, px, damage. Every one warns first; a dash gets through.
  /* The Molten Mines' mini bosses (src/minebosses.js). Each wakes when a knight steps into its room, which then shuts
     (fire curtains) until it falls. Between moves it waits `every` s (`every2` below `half` health).
     golem (A, the Fused Forge): walks at you to `keep` px. Slam: fists up for `raise` s (the floor marks `r` px round
       him), down: `dmg` in the mark and a ring of `ring` slag bullets with one `gap` (radians) to slip through. Every
       `cores` slams its chest splits open for `core` s: blows deal x`coreDmg`. Hurl: winds up `wind` s, throws its fist
       (`fly` s, a shadow where it lands, aimed `lead` s ahead of you): `fistDmg` within `fistR`, a molten pool (`poolR`
       px, `poolLife` s, `poolDmg` a touch) and `shards` bullets; the fist regrows in `regrow` s. Below half: two fists.
     hydra (B, the Furnace Pit): rooted at `at`. Its heads take turns every `every` s. breath (left): `wind` s of a cone
       on the floor, then for `time` s a fan of `n` sparks across `spread` every `rate` s, sweeping `sweep` radians.
       spiral (middle): `arms` (+1 per lost head) fireballs every `rate` s for `time` s. lob (right): `n` globs (+1 once a
       head is lost) round you within `spread` px, landing in `fly` s: `dmg` within `r`, `shards` spatters, a pool.
       A lost head grows back in `regrow` s unless the next is cut first.
     wyrm (D, the Deepfire Roost): on foot it stalks to `reach` px, then claw (`claw` s wind, `clawDmg` within `clawR`)
       and tail (`tail` s, `tailDmg` all round within `tailR`, `tailRocks` bullets); a knight close for `crowd` s gets a
       wing beat (`gust` px/s push within `gustR`). After `ground` s it rises (`rise` s, to `alt` px) for `runs` strafing
       runs (+1 below half): marked `mark` s, flown at `dash` px/s, a burning pool every `laneStep` px (`laneR`,
       `laneLife`, `laneDmg`). Then the dive: a circle follows you `diveAim` s (locks `diveLock` s before), a `diveFly` s
       swoop, `slamDmg` within `slamR` and `slamRocks` rocks. It pants `pant` s after: blows deal x`pantDmg`.
     seraph (E, the Molten Choir): floats round the room's middle, `shards` obsidian shards (DL.ENEMIES.seraphShard)
       orbiting `orbitR` px out; while any stands it takes no harm; broken ones grow back after `regrow` s. Moves in
       turn every `every` s: spiral (`arms` sparks every `rate` s for `time` s), Judgement (lines marked `mark` s, then a
       molten column runs out along each at `beamSpeed`, `beamDmg` within `beamR`, leaving pools; two lines below
       half), ring (`ringN` orbs, twice).
     cinder (F, the Bound Bastion): chained within `chainR` of `at` (chains to rings `anchorX`/`anchorY` off it) until
       half health, then tears free (`tear` s) and walks x`free` faster. Two towers (DL.ENEMIES.cinderTower) `towerOff`
       px either side: while one stands blows deal x`guard`; both down opens the furnace for `open` s (x`openDmg`), then
       they rise again. mortar (towers up): `n` shells per tower round you within `spread`, `fly` s, `dmg` within `r`,
       `shards`, a pool. sweep: `wind` s arc marked, `dmg` within `r` across `arc`, `rocks` bullets. rocket (free): a
       line marked `wind` s, a fist at `speed` along `len`, `dmg` within `r`.
     sovereign (C, the Ashen Throne): seated at `at`, rising `wake` s. Kneels `kneel` s (no harm) at 66% and 33%,
       calling `calls[phase-1]` (the first on waking). Walks to `keep`; moves every `every` s (quicker later). sweep:
       `wind` s arc marked, `dmg` within `r` across `arc`, `n` (+2 a phase) crescents. thrust: 3 (5 later) lanes of `n`
       fire cracks `step` apart, `split` rad apart. Phase 2+: `braziers` spin spirals every `every` s; the `flood` fills
       the rim outside `safe` of the arena's size every `every` s (`warn` s marked, `time` s, `dmg` a touch). Phase 3:
       every third move a blink (`sink` s pillar, out `min`..`max` px from you, `rise` s, a `ring`), a `spiral`, and
       the `decree` every `every` s: the floor marked (`grid` px cells) `warn` s, then x`dmg` bullet damage unless you
       stand on one of `safe` stones (`r` px). */
  DL.MINE_BOSSES = {
    zone: 4,
    golem: { at: [-1860, 560], every: 1.7, every2: 1.2, half: 0.5, keep: 110, raise: 1.0, hit: 0.6, r: 120, dmg: 1, ring: 26, gap: 0.55,
      speed: 125, bulletDmg: 9, cores: 3, core: 3, coreDmg: 2, wind: 0.8, fly: 1.0, lead: 0.4, fistDmg: 1, fistR: 70,
      poolR: 62, poolLife: 6, poolDmg: 10, shards: 8, regrow: 1.0 },
    hydra: { at: [1830, 600], every: 1.4, regrow: 12, bulletDmg: 9, poolR: 52, poolLife: 5, poolDmg: 10,
      breath: { wind: 0.7, time: 1.4, rate: 0.08, n: 3, spread: 0.35, sweep: 0.9, speed: 260, life: 1.6 },
      spiral: { wind: 0.6, arms: 3, rate: 0.2, spin: 1.5, time: 2.4, speed: 125 },
      lob: { wind: 0.6, n: 3, spread: 140, fly: 1.1, r: 56, dmg: 0.8, shards: 6, speed: 150 } },
    wyrm: { at: [1210, -200], every: 0.9, reach: 120, claw: 0.55, clawR: 150, clawDmg: 1, tail: 0.5, tailR: 150, tailDmg: 0.8, tailRocks: 10,
      crowd: 2.5, beat: 0.5, gust: 700, gustR: 220, ground: 9, rise: 0.8, alt: 150, runs: 2, mark: 0.8, fly: 420, dash: 620,
      laneStep: 46, laneR: 40, laneLife: 5, laneDmg: 8, runDmg: 0.8, diveAim: 1.4, diveLock: 0.4, diveFly: 0.45, slamR: 130, slamDmg: 1.2,
      slamRocks: 16, pant: 3, pantDmg: 1.5, bulletDmg: 9, rockSpeed: 150 },
    seraph: { at: [-1210, -260], every: 1.2, shards: 8, orbitR: 120, orbitSpin: 0.8, regrow: 20, lift: 34, bulletDmg: 9,
      spiral: { wind: 0.6, arms: 4, rate: 0.17, spin: 1.3, time: 3, speed: 120 },
      judge: { mark: 1.1, lock: 0.3, len: 1000, beamSpeed: 800, beamR: 48, beamDmg: 1.1, split: 0.45, poolStep: 70, poolR: 34, poolLife: 2.5, poolDmg: 8 },
      ringN: 20, ringSpeed: 140 },
    cinder: { at: [0, -560], every: 1.3, keep: 140, chainR: 150, anchorX: 300, anchorY: -150, tear: 1.4, free: 1.8,
      towerOff: 62, guard: 0.25, open: 9, openDmg: 2, bulletDmg: 10, poolR: 50, poolLife: 5, poolDmg: 10,
      mortar: { wind: 0.8, n: 3, spread: 170, fly: 1.25, r: 66, dmg: 0.9, shards: 6, speed: 140 },
      sweep: { wind: 0.75, r: 210, arc: 2.6, dmg: 1.1, rocks: 11, speed: 160 },
      rocket: { wind: 0.8, speed: 760, r: 52, dmg: 1, len: 900 } },
    sovereign: { at: [0, -1615], wake: 2.2, kneel: 3, keep: 130, every: 1.2, bulletDmg: 10,
      calls: [["ashguard", "wretch", "wretch", "wretch"], ["acolyte", "halberdier", "halberdier"], ["ashguard", "acolyte", "wretch", "wretch"]],
      sweep: { wind: 0.8, r: 200, arc: 2.4, dmg: 1, n: 7, speed: 170 },
      thrust: { wind: 0.7, n: 7, step: 46, split: 0.32, speed: 260 },
      braziers: { at: [[-560, -1380], [560, -1380]], every: 7, arms: 3, rate: 0.22, spin: 1.2, time: 2.6, speed: 120 },
      flood: { every: 15, warn: 1.6, time: 5, safe: 0.62, dmg: 10 },
      blink: { sink: 0.8, rise: 0.6, min: 220, max: 380, ring: 18, speed: 150 },
      spiral: { arms: 5, rate: 0.16, spin: 1.4, time: 2.6, speed: 130 },
      decree: { every: 13, warn: 2.2, grid: 90, safe: 3, r: 70, dmg: 2.5 } },
  };
  /* A Molten Mines run's finds (src/mines.js): Obsidian per minion broken (`kill`), `chest` from the Storeroom's and
     the Vault's chests once their guards fall, `boss` from each mini boss and `sovereign` from him; a Magma Heart from
     each of the five mini bosses the first time it dies. Walking out keeps `keep` of it; beating the Sovereign brings
     it all home; falling loses it. */
  DL.MINE_LOOT = { kill: { wretch: 1, ashguard: 3, halberdier: 2, acolyte: 2 }, chest: [10, 14], boss: 15, sovereign: 40, keep: 0.5 };
  DL.MINE_TRAPS = {
    grate: { every: 3.4, warn: 0.8, burn: 1, wave: 0.35, dmg: 14 }, // the Grate Run: a new pattern every 3.4 s
    cage: { every: 1.7, warn: 0.9, max: 3, lead: 0.5, r: 30, dmg: 6, lock: 3, shake: 0.5, stand: 3.5, after: 1.5 }, // the Gibbet Gallery
    jet: { every: 3.2, warn: 0.8, burn: 0.9, half: 18, dmg: 16 }, // the Crystal Stair
    tile: { crack: 1, gone: 5, dmg: 12 }, // crumbling tiles
    geyser: { every: 3.6, warn: 1.6, burn: 0.5, r: 34, dmg: 16, globs: 6, speed: 150, globDmg: 8, globLife: 1.8 }, // the Broken Causeway
    cart: { every: 3.2, warn: 1.2, speed: 680, dmg: 22, kb: 420 }, // the Slag Mine
  };
  // what the dungeons pay for at the base (src/rift.js): the Crystal Turret by level, the Mist Lantern, the Rift Portal
  DL.RIFT = {
    turret: { spots: [0, 2, 4, 4], every: [0, 2.4, 1.9, 1.5], n: [0, 6, 8, 10], dmg: [0, 9, 12, 16], range: 300, speed: 240, life: 1.4, along: 150 },
    lantern: { ring: [0, 150, 190, 230], corrupt: [1, 0.5, 0.4, 0.3] }, // by Mist Lantern level
  };
  // what the Molten Mines pay for at the base (src/lavacamp.js): the Magma Forge, Brazier Towers, Fire Grate Gates, the Forge Gate
  DL.LAVA_CAMP = {
    forge: { dmg: 0.2, burn: 0.12 },   // Magma Forge: weapon damage +20%; each blow burns for 3 s at 12% of it a second
    brazier: { every: 4.5, first: 2, range: 420, minHp: 60, warn: 1.1, r: 60, dmg: 45, burnDps: 8 }, // a mortar per tower at the biggest Drowned in reach (night)
    grate: { out: 34, half: 30, warn: 0.35, burn: 1.2, cool: 2.2, dps: 40, burnFor: 2, burnDps: 6 }, // a grate outside each gate, set off by a Drowned on it
    gate: { bosses: ["golem", "hydra", "wyrm", "seraph", "cinder"], fx: 0.56, fy: -0.12 }, // the Forge Gate: opens once all five have fallen; its spot
  };

  DL.CAVE = {
    x: 0, y: 40000, radius: 360, dist: 1750, zone: 2,
    intro: 6, rest: 8, burst: 1.4, heal: 0.25, rise: 0.5, failHp: 0.35,
    waves: [
      { type: "footman", n: 6, mix: 0, name: "Drowned Wretches" },
      { type: "squire", n: 6, mix: 3, name: "Mire Stalkers" },
      { type: "archer", n: 4, mix: 5, name: "Tide Archers" },
      { type: "revenant", n: 12, mix: 4, name: "a swarm of Revenants" },
      { type: "defiler", n: 4, mix: 6, name: "Lantern Reavers" },
      { type: "hexbearer", n: 3, mix: 7, name: "Marsh Hexbearers" },
      { type: "blackguard", n: 3, mix: 9, name: "Bone Bulwarks" },
      { type: "colossus", n: 1, mix: 4, name: "the Drowned Colossus", boss: true }, // with `mix` of the earlier kinds; it rises `rise` seconds in
    ],
    rise: 2.6, bossY: -230, // the boss rises `rise` seconds into its wave, from the deep water `bossY` px north of the cave's heart
  };
  /* The Drowned Colossus (src/colossus.js; its body, blow and size are in DL.ENEMIES.colossus, where `shadow`, `sink`, `barY`,
     `barW`, `eyeX`, `eyeY` and `eyeR` fit its shadow, rise, health bar and eye glow to its big sprite), wave 8 of Derek's Hollow. Between blows of its arm (a sweep `arc` radians wide, in
     DL.ENEMIES, that hurls knights `slam.kb` px) it uses one of three slower moves, each on its own timer (`every` seconds, `first` for the first):
     summon:   pounds the ground: `ruins` broken pillars burst up around it (each hits `dmg` × its blow where it lands) and stand
               `life` seconds as cover; `adds` Cairn Crawlers (`add`, its minions: DL.MINIONS) climb out with them, never more than `maxAdds` alive.
     surge:    stomps out a ring of water that rolls `reach` px at `speed` px/s and hits `dmg` × its blow (knocking back `kb`).
               A knight with a ruin between them and the Colossus is sheltered from it.
     collapse: brings its ruined back down: `n` (`n2` once wounded) falling stones, one on each knight and the rest near them,
               landing after `delay` seconds for `dmg` × its blow; each leaves a ruin `leave` of the time.
     Below `phase2` of its health it moves `fast` × quicker and its moves come round `rate` × as often. */
  DL.COLOSSUS = {
    slam: { kb: 300 },
    summon: { every: 16, first: 6, windup: 1.1, ruins: 3, dmg: 0.6, life: 14, r: 22, adds: 2, add: "cairn", maxAdds: 6 },
    surge: { every: 12, first: 10, windup: 1.2, reach: 340, speed: 290, band: 24, dmg: 0.75, kb: 280 },
    collapse: { every: 14, first: 14, windup: 0.9, n: 5, n2: 9, delay: 1.5, r: 38, dmg: 0.9, leave: 0.35 },
    maxRuins: 9, phase2: 0.5, fast: 1.2, rate: 1.45,
  };
  /* The Great Siege (src/siege.js): every `every`th night the Drowned march on exposed Pyramid squares wherever the knights are.
     A wave comes every `waveEvery` s (the first `first` s after dusk) from `sides` directions, each `size` times a
     normal camp wave, as strong as zone `zone(night)`. A destroyed square lowers the Central Flame one level.
     With no squares left the camp itself is attacked; each snuff costs a flame level. Level 0 ends the game.
     The Starved Bell Tower tolls `warn` s before every wave and leaves it dazed for `daze` s. */
  DL.SIEGE = {
    // Robert (2026-11-03): every 10th night, and then every held square is attacked (`groups` at a time, in turn)
    every: 10, waveEvery: 10, first: 4, sides: 2, groups: 4, size: 1.5, warn: 8, daze: 2, spawnGap: 300,
    zone: (night) => Math.min(4, 1 + Math.floor(night / 10)),
    gameOver: true,
  };
  /* The Rose Heart (src/trophies.js): from dusk to dawn, every `every` s it binds the `n` Drowned nearest it within
     `reach` px with briar: they can't move or strike for `hold` s (bosses for half as long) and take `sting` damage
     every half second. Per level 1–3. */
  DL.ROSE_HEART = {
    levels: [
      { every: 6, n: 1, reach: 190, hold: 2.5, sting: 3 },
      { every: 5, n: 2, reach: 230, hold: 3, sting: 4 },
      { every: 4, n: 3, reach: 270, hold: 3.5, sting: 6 },
    ],
  };
  /* Companion levels (src/summons.js): each companion trains from level 0 to `max` at camp, its home (DL.UPGRADES
     kennel, workshop, shrine) allowing five levels per home level. Levels 5, 10 and 15 change its form: a new look
     and a new power. `forms` names each form; the per-level numbers are in Summons.stats. */
  DL.SUMMON = {
    max: 15, perHome: 5, formAt: [0, 5, 10, 15],
    hound: { home: "kennel", name: "Bone Hound", forms: ["Bone Pup", "Bone Hound", "Ember Hound", "Grave Warg"],
      powers: ["Small and quick to fall", "Leaps on fleeing prey", "Bites set the Drowned alight; bleed stacks 5 deep", "Howls every 16 s: Drowned near it freeze in terror; gets up twice as fast"] },
    golem: { home: "workshop", name: "Derek", forms: ["Pebble Derek", "Derek", "Crystal Derek", "Derek the Bastion"],
      powers: ["One small wall at a time", "Two walls, two hits each", "Crystal walls take three hits and cut whatever strikes them", "Three great walls, four hits each, that burst and stagger the Drowned when they fall"] },
    wraith: { home: "shrine", name: "Abigail", forms: ["Soul Wisp", "Abigail", "Mourning Abigail", "Abigail, Queen of Sorrows"],
      powers: ["Weak soul orbs, no blessing", "Blesses her knight", "Orbs leap to a second Drowned; curse 15%", "Wails every 22 s: every Drowned near is cursed and stunned; blessing 15%"] },
    fred: { home: "toadstool", name: "Fred", forms: ["Fred the Sprout", "Fred", "Weeping Fred", "Fred the Rotwalker"],
      powers: ["Spits slowing spores and grows healing glowcaps", "Choose his road: Bloomcaps or Befuddling Spores",
        "Choose his road: Fairy Ring or Mindrot", "Choose his road: Second Bloom or Spore Storm"] },
    wyvern: { home: "roost", name: "David", forms: ["David the Hatchling", "David", "Great David", "David the Bloodwing"],
      powers: ["Spits bolts of blood-red fire at the Drowned", "Choose his road: Chain Lightning or Searing Bolt",
        "Choose his road: Tailwind or War Fury", "Choose his road: Static Shock or Cauterize"] },
  };
  // Price to train a companion from level L to L + 1.
  DL.summonCost = function (L) {
    const c = { iron: Math.round(3 + 1.3 * L), resin: Math.round(2 + 0.7 * L) };
    if (L < 6) c.stone = 4 + L;
    if (L >= 6) c.pearl = Math.floor((L - 3) / 3);
    if (L >= 14) c.black = 2;
    return scaleCost(c);
  };
  /* Outposts (src/outposts.js): from Central Flame `reqFlame`, claim the heart of a bloom grove (stand within `claimR`
     px of it) and raise an outpost: a brazier of firelight (`light` px) in a ring of stakes. You can store supplies
     there, and with your Kindle lit, travel between the camp and every outpost. At most `max[flame level]`. Lantern
     Reavers and the rest of the Drowned can snuff it (`hp`); it is lit again at dawn. You can't travel with a Drowned
     within `safeR` px of you. */
  DL.OUTPOST = { reqFlame: 3, max: [0, 0, 0, 1, 2, 3], cost: { wood: 24, stone: 16, iron: 8 }, claimR: 120, useR: 90, light: 150, hp: 160, safeR: 260 };
  DL.scaleCost = scaleCost;
  /* The Pyramid (src/pyramid.js, docs/PYRAMID-PLAN.md). The Central Flame's level L lets the knights hold
     `perFlame * (L - 1)` squares; a square is claimed standing within `claimR` px of its middle, next to one already
     held, for cost[ring - 1]. Held squares stand (flame level - ring) levels high, `face` px of rock per level (at
     most `maxFace` levels drawn), rising `riseSpeed` levels a second. Stairs run only along the cross of stairways
     (the gx = 0 and gy = 0 lines, `stairW` px wide); off them, crossing a step goes at `climb` of full speed. `win` of the squares held wakes the Drowned Gate. */
  DL.PYRAMID = {
    beds: { at: [[1, -1], [-1, -1], [1, 1]], off: 170, jitter: 20, half: 85, nodes: 3 }, // marsh beds in a held square's paving, clear of the lane and towers
    perFlame: 4, claimR: 170, face: 54, course: 18, maxFace: 4, riseSpeed: 1.5, stairW: 110, climb: 0.35, win: 0.8, hp: 320,
    wallR: 350, gateHalf: 55, wallStep: 28, buildR: 90, wallDamagePerLevel: 3, wallEvery: 0.6,
    towerRange: 300, towerEvery: 1.1, towerSpeed: 520, towerDamage: 10, towerPerLevel: 6,
    pylonHp: 80, pylonLight: 118,
    build: {
      wall: { name: "Square walls", max: 3, info: "A square palisade with four gates. Spikes wound the Drowned against its walls, harder at each level.", reqFlame: [2, 5, 10], costs: [{ wood: 20, stone: 10 }, { wood: 30, stone: 20, iron: 6 }, { wood: 40, stone: 30, iron: 12 }] },
      pylon: { name: "Square lantern pylons", max: 3, info: "Two, four, then six firelight pylons. Snuffed lamps relight at dawn.", reqFlame: [2, 5, 10], costs: [{ wood: 12, stone: 8, resin: 6 }, { wood: 18, stone: 12, resin: 10, iron: 4 }, { wood: 24, stone: 18, resin: 14, iron: 8 }] },
      tower: { name: "Square watchtowers", max: 3, info: "One, two, then four crossbow towers. They defend the square at night.", reqFlame: [2, 5, 10], costs: [{ wood: 16, stone: 10, iron: 4 }, { wood: 24, stone: 16, iron: 8 }, { wood: 32, stone: 24, iron: 14 }] },
    },
    cost: [
      { wood: 20, stone: 12 },
      { wood: 30, stone: 20, iron: 6 },
      { wood: 40, stone: 30, iron: 12, pearl: 2 },
      { wood: 50, stone: 40, iron: 18, pearl: 4, black: 1 },
    ],
  };

  // Barracks share the square-build menu; their champions guard that square, and replacements take time.
  DL.PYRAMID.build = DL.PYRAMID.build || {};
  DL.PYRAMID.build.barracks = {
    name: "Barracks", max: 3, info: "Trains champions to defend this square. Fallen champions are replaced here over time.",
    costs: [{ wood: 24, stone: 18, iron: 8 }, { wood: 36, stone: 26, iron: 16, pearl: 2 }, { wood: 50, stone: 36, iron: 24, pearl: 4, black: 2 }],
    reqFlame: [2, 5, 10],
  };
  DL.PYRAMID.champion = {
    count: [0, 1, 2, 3], train: [0, 30, 24, 18], hp: [0, 100, 140, 180], dmg: [0, 14, 20, 26],
    speed: 105, reach: 32, cd: 1.1, swing: 0.3, hitAt: 0.14, radius: 10, defend: 480, guard: 70, regen: 4,
    spawnX: 38, spawnY: 32, spacing: 28, knockback: 60, scale: 0.85, barracksRadius: 26,
  };

  /* The Refuge (Robert, 2026-11-03; src/refuge.js): the camp grows into a terraced fortress over the Central Flame's
     20 levels, in place of the grid of squares. Switched in the pause menu (save.up.fortress: 0 = the old squares).
     Half-sides are in world px round the flame; [level, value] lists take the last entry at or below the level.
     Each terrace wall is one level of drop: a south face `face` px tall hangs below it (like the pyramid's steps).
     Stairs: `at` = offset along the side from its middle, `w` = width. Items: `at` = where it stands at level 20
     (earlier levels scale it in and the placer nudges it to the nearest free ground in its district); `hw` = half
     its footprint's width; `from` = the refuge level a decor piece appears; `ph` = placeholder until art is drawn. */
  DL.REFUGE = {
    camp: 420,                                   // the camp's half-side before the terraces (levels 1-4)
    lowWall: 3,                                  // low stone walls round the camp from this level until the Inner Court rises
    // Robert, 2026-11-04: a new terrace rises every 3 Central Flame levels, each covering more of the map. half = half-side
    // ([level, value] list), side = the level its two extra stairs per side open, at sideAt x its half from the middle.
    terraces: [
      { id: "sanctum", from: 2, half: [[2, 110], [10, 150]] },          // the flame's platform
      { id: "main", from: 5, half: [[5, 500], [7, 580]], side: 7 },    // Inner Court: the districts
      { id: "outer", from: 8, half: [[8, 880]], side: 10 },             // Middle Ward
      { id: "ward4", from: 11, half: [[11, 1120]], side: 13, beds: true },  // Outer Ward
      { id: "ward5", from: 14, half: [[14, 1350]], side: 16, beds: true }, // Low Ward
      { id: "ward6", from: 17, half: [[17, 1600]], side: 19, beds: true }, // Curtain Terrace
      { id: "ward7", from: 20, half: [[20, 1860]], side: 20, beds: true }, // Great Wall
    ],
    sideAt: 0.62, sideW: 54,
    spotR: 780,                                  // buildings' level-20 spots (items.at) are laid out inside this half-side
    bed: { half: 70, gap: 360 },                 // marsh beds on the outer wards: resources grow only in them
    centralW: [[1, 56], [15, 72]],               // the central stairs and avenues (Great Stairways widen them); 56 fits Robert's drawn flight
    face: 46,                                    // a terrace wall's south face, as tall as Robert's drawn one (tools/cut_refuge.py)
    barracks: [[5, 1], [12, 2], [17, 3]],        // the refuge's barracks level (its champions defend the refuge)
    towerIn: 70,                                 // watchtowers stand this far in from the outermost wall's corners
    levels: [
      null,
      { name: "First Flame", text: "A small hearth on a stone foundation." },
      { name: "Raised Hearth", text: "The flame stands on a raised platform with four stairs; tents gather round it." },
      { name: "Fortified Camp", text: "Low stone walls with four openings." },
      { name: "Survivor Camp", text: "Banners round the flame, a paved camp." },
      { name: "Inner Court", text: "A walled terrace for the districts, and the barracks." },
      { name: "Expanded Court", text: "More room on the Inner Court for new buildings." },
      { name: "Court Stairs", text: "Two more stairs on every side of the Inner Court; the resource yards." },
      { name: "Middle Ward", text: "A second terrace rises round the Inner Court." },
      { name: "Reinforced Walls", text: "Corner bastions on the outer wall." },
      { name: "Inner Ring", text: "A wider sanctum and Inner Court; more stairs on the Middle Ward." },
      { name: "Outer Ward", text: "A third terrace, with marsh beds where resources grow." },
      { name: "Defensive Expansion", text: "Watch fires on the Inner Court's corners; the barracks grows." },
      { name: "Resource Network", text: "An alchemy station, lit avenues, more stairs on the Outer Ward." },
      { name: "Low Ward", text: "A fourth terrace reaches into the marsh, with more beds." },
      { name: "Great Stairways", text: "Grand central stairs; survivor quarters and more tents." },
      { name: "Upper Works", text: "An expedition lodge and a research archive; more Low Ward stairs." },
      { name: "Curtain Terrace", text: "A fifth terrace, and the barracks' last form." },
      { name: "Outer Ring", text: "The wards fill with life." },
      { name: "Final Reinforcement", text: "Lamps at the inner stairs, a star round the flame, more Curtain stairs." },
      { name: "Great Wall", text: "The last terrace, the summoning circle, beacons and the crowned flame." },
    ],
    // district: nw military and crafting, ne champions and operations, sw familiars and cultivation, se boss rewards
    items: {
      // existing camp buildings (canonical ids from DL.UPGRADES; shown when built, a reserved plot otherwise)
      forge: { d: "nw", at: [-361, -144], hw: 38 }, armory: { d: "nw", at: [-144, -361], hw: 38 }, workbench: { d: "nw", at: [-419, -361], hw: 30 },
      garden: { d: "sw", at: [-361, 159], hw: 40 }, kennel: { d: "sw", at: [-159, 378], hw: 30 }, shrine: { d: "sw", at: [-332, 335], hw: 27 },
      toadstool: { d: "sw", at: [-430, 433], hw: 26 }, workshop: { d: "sw", at: [-585, 202], hw: 28 }, roost: { d: "sw", at: [-231, 643], hw: 34 },
      bell: { d: "se", at: [159, 347], hw: 28 }, roseheart: { d: "se", at: [361, 361], hw: 30 },
      // refuge structures, by refuge level
      barracks: { d: "ne", at: [332, -173], hw: 44, from: 5 },
      tentA: { d: "ne", at: [159, -361], hw: 26, from: 2, sprite: "tent" }, tentB: { d: "ne", at: [419, -404], hw: 26, from: 2, sprite: "tent", flip: true },
      supplies: { d: "ne", at: [274, -332], hw: 18, from: 2 },
      storehouse: { d: "ne", at: [592, -376], hw: 36, from: 7, ph: "Storehouse" },
      salvage: { d: "sw", at: [-404, 549], hw: 36, from: 7, ph: "Salvage Yard" },
      training: { d: "nw", at: [-578, -217], hw: 40, from: 7, ph: "Training Grounds" },
      alchemy: { d: "nw", at: [-217, -585], hw: 30, from: 13, ph: "Alchemy Station" },
      quarters: { d: "ne", at: [578, -188], hw: 40, from: 14, ph: "Survivor Quarters" },
      tentC: { d: "ne", at: [217, -592], hw: 26, from: 14, sprite: "tent" }, tentD: { d: "ne", at: [361, -607], hw: 26, from: 14, sprite: "tent", flip: true },
      lodge: { d: "ne", at: [592, -578], hw: 38, from: 16, ph: "Expedition Lodge" },
      archive: { d: "se", at: [376, 159], hw: 38, from: 16, ph: "Research Archive" },
      circle: { d: "se", at: [578, 303], hw: 44, from: 20, ph: "Summoning Circle" },
    },
  };

  /* The compact base (Robert, 2026-11-10; plan "Compact base that grows with dungeons"): the Refuge stays a small walled
     town that is REBUILT IN PLACE as dungeons are cleared, instead of spreading over the map with the Central Flame.
     Base tier = dungeons whose boss has fallen (DL.Base.cleared(), src/refuge.js), 0..8. Each tier: the outer wall's
     half-side `R` and the drawn terrace look it is rebuilt in (`kit`, Robert's T1-T7 pictures), side stairs (`side`,
     a fraction of R either side of the middle on the east, south and west walls). `cap` = the Central Flame's highest
     level at that tier: the only way to keep levelling the base is the next dungeon. The north wall has no central
     stair: the Portal Hall (the Spark Bearer's portal room door) stands at the end of the north avenue, with a stair
     either side of it (`hall`). save.up.fortress: 1/missing = this compact base, 2 = the old spreading fortress, 0 = squares. */
  DL.BASE = {
    tiers: [
      { R: 470, kit: "low" },                  // 0: the first camp (low walls from Flame 3)
      { R: 490, kit: "court" },                // 1: Abyssal Spires
      { R: 510, kit: "mward" },                // 2: Molten Mines
      { R: 530, kit: "ward", side: 0.62 },     // 3
      { R: 550, kit: "lward", side: 0.62 },    // 4
      { R: 570, kit: "curt", side: 0.62 },     // 5
      { R: 590, kit: "great", side: 0.62 },    // 6
      { R: 610, kit: "great", side: 0.62 },    // 7
      { R: 630, kit: "great", side: 0.62 },    // 8: all eight dungeons
    ],
    cap: [5, 7, 9, 11, 13, 15, 17, 19, 20],
    dungeons: ["spires", "mines"],            // the first two; the portal room's next six add theirs (save.dungeons[id] = 1)
    hall: { hw: 84, h: 170, gap: 150 },       // the Portal Hall's reserved picture box; the north stairs stand `gap` px either side
    torches: 3, braziers: 5, lamps: 6, beacons: 8, // the tier these lit pieces appear from
  };

  // What the Refuge's upper works do (Robert's picks, 2026-11-04; src/works.js). Each works once its refuge level stands.
  DL.WORKS = {
    alchemy: { resin: 4, max: 3 },                       // each dawn brews a lantern-oil flask from 4 resin (holds 3); an empty lantern drinks one
    quarters: { give: { wood: 6, stone: 6, iron: 2 }, mend: 0.015 }, // survivors bring supplies each dawn; on siege nights they mend the flame and pylons (share of max hp a second)
    lodge: { loot: { pearl: [2, 4], iron: [2, 5] }, black: 0.35 }, // an expedition leaves at dusk and comes back at dawn with rare loot
    archive: { bonus: 0.1, kin: { bell: [], rose: [], colossus: [], wyvern: [], champion: [] } }, // +10% damage to a slain boss's kind (its kin: new enemy types to come)
    circle: { slots: 2 },
    // the yards (Robert's picks, 2026-11-04)
    storehouse: { keep: 0.5 },                          // when you fall, half of what you carry is kept safe in the stash
    salvage: { trades: [                                // a converter in the camp menu: give -> get, from the stash
      { give: { wood: 4 }, get: { stone: 3 } }, { give: { stone: 4 }, get: { wood: 3 } },
      { give: { wood: 5 }, get: { resin: 2 } }, { give: { stone: 5 }, get: { iron: 2 } },
      { give: { iron: 10 }, get: { pearl: 1 } }] },
    training: { champion: 1.25 },                       // the barracks' champions are drilled: health and damage x this
    supplies: { torches: 1, oil: 0.25 },                // at dusk: a torch (up to your satchel) and a share of your lantern's oil                                 // familiars that can walk with you at once (1 without the circle)
  };
  DL.FAMILIARS = ["hound", "golem", "wraith", "fred", "wyvern"];

  // Camp buildings. costs[level] = price to go from `level` to `level + 1`.
  // reqFlame(target) = Central Flame level needed to build that level.
  DL.UPGRADES = [
    { id: "flame", name: "Central Flame", max: DL.FLAME.max,
      info: "The heart of the pyramid. Each Barricade level allows four Flame levels, up to 20. The camp takes a new form at levels 5, 10, 15 and 20.",
      effect: (l) => `Light radius ${180 + 40 * l} · flame strength ${150 + 100 * l}`,
      costs: [null, { wood: 10, stone: 6 }, { wood: 22, stone: 16, resin: 5 }, { wood: 34, stone: 30, iron: 10, resin: 10 },
        { wood: 48, stone: 42, iron: 22, pearl: 3, black: 2 },
        ...Array.from({ length: DL.FLAME.max - 5 }, (_, i) => ({
          wood: 62 + i * 14, stone: 54 + i * 12, iron: 30 + i * 8,
          resin: 12 + i * 3, pearl: 4 + Math.floor(i / 2), black: 2 + Math.floor(i / 3),
        }))],
      reqFlame: () => 0 },
    { id: "forge", name: "Forge", max: 4, info: "Hone your weapon.",
      effect: (l) => `Weapon damage +${20 * l}%`,
      costs: [{ stone: 8, iron: 4 }, { stone: 16, iron: 10 }, { stone: 26, iron: 20, pearl: 2 }, { stone: 38, iron: 30, pearl: 5, black: 2 }],
      reqFlame: (t) => t },
    { id: "armory", name: "Armory", max: 4, info: "Reinforce your armour.",
      effect: (l) => `Max health ${100 + 25 * l}`,
      costs: [{ wood: 10, iron: 4 }, { wood: 20, iron: 12 }, { wood: 30, iron: 22, resin: 8 }, { wood: 44, iron: 32, pearl: 4, black: 2 }],
      reqFlame: (t) => t },
    { id: "workbench", name: "Workbench", max: 4, info: "Craft lanterns and tools. A longer-burning lantern halves corruption in the dark for longer.",
      effect: (l) => `Lantern oil ${60 + 25 * l} · torch satchel ${3 + l} · torches burn ${50 + 15 * l}s`,
      costs: [{ resin: 6, stone: 6 }, { resin: 12, iron: 6 }, { resin: 20, iron: 12, pearl: 2 }, { resin: 30, iron: 20, pearl: 5, black: 2 }],
      reqFlame: (t) => t },
    { id: "garden", name: "Cultivation Plot", max: 3, info: "Grow bioluminescent flora inside the walls. Light from the living.",
      effect: (l) => (l ? `Harvest ${DL.GARDEN_YIELD[l]} Bloom Resin each dawn` : "Nothing planted"),
      costs: [{ wood: 12, resin: 6 }, { wood: 20, stone: 10, resin: 12 }, { wood: 30, resin: 20, pearl: 2, black: 1 }],
      reqFlame: (t) => t + 1 },
    { id: "tower", name: "Watchtowers", max: 3, info: "Crossbow towers that spot and shoot the Drowned at night.",
      effect: (l) => (l ? `${[0, 1, 2, 4][l]} tower${l > 1 ? "s" : ""} · bolt damage ${10 + 6 * l}` : "No towers"),
      costs: [{ wood: 24, stone: 14 }, { wood: 34, stone: 24, iron: 10 }, { wood: 48, iron: 24, pearl: 3, black: 2 }],
      reqFlame: (t) => t + 1 },
    { id: "pylon", name: "Lantern Pylons", max: 3, info: "Firelight on the perimeter. Guides the way and slows the encroaching Drowned — but Lantern Reavers hunt them.",
      effect: (l) => (l ? `${2 * l} pylons light the walls` : "No pylons"),
      costs: [{ wood: 16, stone: 10, resin: 4 }, { wood: 24, iron: 10, resin: 8 }, { stone: 30, iron: 18, pearl: 2, black: 1 }],
      reqFlame: (t) => t + 1 },
    { id: "stakes", name: "Barricade & Gate", max: 5, info: "Keep the darkness out. Walls force the Drowned through four gates, where stakes wound them. Levels 4 and 5 push the walls out, making room inside.",
      effect: (l) => ["No defenses", "A ring of stakes · 15 damage to attackers", "Palisade with four gates · 25 damage at the gates",
        "Reinforced palisade · 40 damage at the gates, attackers slowed", "Wider palisade · the camp grows · 50 damage at the gates",
        "Great palisade · the camp grows again · 60 damage at the gates"][l],
      costs: [{ wood: 18 }, { wood: 36, iron: 8 }, { wood: 50, iron: 18, resin: 10 }, { wood: 64, stone: 30, iron: 24 },
        { wood: 76, stone: 44, iron: 30, black: 3 }],
      reqFlame: (t) => [0, 1, 4, 8, 12, 16][t] },
    /* Homes for your companions: each level of a home lets its companion train five more levels (DL.SUMMON).
       `needs` = the companion someone in this world must have won before the home can be built. */
    { id: "kennel", name: "Bone Kennel", max: 3, needs: "hound", info: "A den of bones and hides for your Bone Hound. Each level lets it train five more levels.",
      effect: (l) => (l ? `Bone Hound training up to level ${5 * l}` : "Not built"),
      costs: [{ wood: 20, stone: 14, iron: 6 }, { wood: 30, stone: 24, iron: 16, pearl: 2 }, { stone: 36, iron: 28, pearl: 4, black: 2 }],
      reqFlame: (t) => [0, 2, 3, 5][t] },
    { id: "workshop", name: "Derek's Workshop", max: 3, needs: "golem", info: "A mason's yard of cut stone and glowing moss where Derek rests and grows. Each level lets him train five more levels.",
      effect: (l) => (l ? `Derek training up to level ${5 * l}` : "Not built"),
      costs: [{ wood: 12, stone: 22, iron: 6 }, { wood: 18, stone: 34, iron: 16, pearl: 2 }, { stone: 48, iron: 26, pearl: 4, black: 2 }],
      reqFlame: (t) => [0, 3, 4, 5][t] },
    { id: "shrine", name: "Soul Shrine", max: 3, needs: "wraith", info: "Candles and old gravestones where Abigail's soul gathers strength. Each level lets her train five more levels.",
      effect: (l) => (l ? `Abigail training up to level ${5 * l}` : "Not built"),
      costs: [{ wood: 10, stone: 16, resin: 10 }, { stone: 26, resin: 18, pearl: 3 }, { stone: 36, resin: 26, pearl: 5, black: 2 }],
      reqFlame: (t) => [0, 2, 3, 5][t] },
    { id: "toadstool", name: "Toadstool Cottage", max: 3, needs: "fred", info: "A mossy log, then a stump house, then a cottage under a giant spotted cap, where Fred rests and grows. Each level lets him train five more levels. From level 2 it sprouts glowcaps in the camp every dawn.",
      effect: (l) => (l ? `Fred training up to level ${5 * l}${DL.FRED.campCaps[l] ? ` · ${DL.FRED.campCaps[l]} glowcap${DL.FRED.campCaps[l] > 1 ? "s" : ""} in the camp each dawn` : ""}${l >= 3 ? " · lets you choose Fred's roads again" : ""}` : "Not built"),
      costs: [{ wood: 14, stone: 8, resin: 12 }, { wood: 22, resin: 20, pearl: 3 }, { wood: 30, resin: 30, pearl: 5, black: 2 }],
      reqFlame: (t) => [0, 2, 3, 5][t] },
    { id: "roost", name: "Wyvern Roost", max: 3, needs: "wyvern", info: "A ledge of piled stones and bones, then a perch of black timber, then a great eyrie hung with old banners, where David roosts and grows. Each level lets him train five more levels.",
      effect: (l) => (l ? `David training up to level ${5 * l}${l >= 3 ? " · lets you choose David's roads again" : ""}` : "Not built"),
      costs: [{ wood: 16, stone: 16, iron: 6 }, { wood: 26, stone: 24, iron: 14, pearl: 3 }, { wood: 34, iron: 26, pearl: 5, black: 2 }],
      reqFlame: (t) => [0, 2, 3, 5][t] },
    /* Trophies of the Abyss bosses: `trophy` = the boss that must have been slain (save.trophies) before it can be built. */
    { id: "bell", name: "Starved Bell Tower", max: 1, trophy: "bell", info: "The Starved Bell's clapper, hung from a frame of black timber. It tolls before every wave that comes for the camp, and calls out where it's coming from.",
      effect: (l) => (l ? `Warns ${DL.SIEGE.warn} s before each wave · warned waves arrive dazed for ${DL.SIEGE.daze} s` : "Slay the Starved Bell in the Abyss for its clapper"),
      costs: [{ wood: 30, stone: 20, iron: 14 }],
      reqFlame: () => 3 },
    { id: "roseheart", name: "Rose Heart", max: 3, trophy: "rose", info: "The Deadly Rose's heart, planted inside the walls. It wakes at night and bursts thorned briar up under the Drowned, binding them where they stand.",
      effect: (l) => {
        if (!l) return "Slay the Deadly Rose in the Abyss for her heart";
        const r = DL.ROSE_HEART.levels[l - 1];
        return `Binds ${r.n} Drowned every ${r.every} s for ${r.hold} s · reach ${r.reach}`;
      },
      costs: [{ wood: 16, resin: 16, pearl: 2 }, { wood: 24, resin: 24, pearl: 4 }, { resin: 34, pearl: 6, black: 3 }],
      reqFlame: (t) => [0, 3, 4, 5][t] },
    // paid for with what the dungeons give (src/rift.js): hidden until you first carry Rift Shards home
    { id: "crystal", name: "Crystal Turret", max: 3, rift: true,
      info: "A shard of the Spires set by the gates. When the Drowned come near it spins out slow spirals of crystal at them.",
      effect: (l) => { const T = DL.RIFT.turret; return l ? `${T.spots[l]} turrets · ${T.n[l]} shards a spiral every ${T.every[l]} s · ${T.dmg[l]} damage` : "No turrets"; },
      costs: [{ shard: 20, stone: 12 }, { shard: 40, aether: 2, iron: 10 }, { shard: 70, aether: 4, pearl: 3 }],
      reqFlame: () => 0 },
    { id: "mistlantern", name: "Mist Lantern", max: 3, rift: true,
      info: "A lamp post at camp burning a sliver of Aether Crystal, kindred to your own lantern. In the mist of the dungeons your lantern lights a wider ring round you and the corruption builds slower.",
      effect: (l) => { const M = DL.RIFT.lantern; return l ? `In the mist: lantern ring ${M.ring[l]} px · corruption x${M.corrupt[l]}` : "Your lantern only"; },
      costs: [{ shard: 30, aether: 6 }, { shard: 50, aether: 8, iron: 10 }, { shard: 80, aether: 12, pearl: 4 }],
      reqFlame: () => 0 },
    // paid for with what the Molten Mines give (src/lavacamp.js): hidden until Obsidian first comes home. Each needs the
    // building it rebuilds (`reqUp`). Five Magma Hearts in a world (one per mini boss): these take four.
    { id: "magmaforge", name: "Magma Forge", max: 1, mines: true, reqUp: { forge: 4 },
      info: "The Forge rebuilt in basalt round a crucible of molten metal. Blades come off its anvil hot enough to set the Drowned burning.",
      effect: (l) => { const F = DL.LAVA_CAMP.forge; return l ? `Weapon damage +${F.dmg * 100}% more · every blow sets the Drowned burning` : "Your Forge as it is"; },
      costs: [{ obsidian: 30, heart: 2, iron: 10 }], reqFlame: () => 0 },
    { id: "brazier", name: "Brazier Towers", max: 1, mines: true, reqUp: { tower: 1 },
      info: "The watchtowers' tops rebuilt in basalt, with a fire bowl and a small mortar. At night each one lobs molten slag at the biggest Drowned in reach.",
      effect: (l) => { const B = DL.LAVA_CAMP.brazier; return l ? `A lava mortar every ${B.every} s per tower · ${B.dmg} damage round where it lands` : "Crossbows only"; },
      costs: [{ obsidian: 25, heart: 1, stone: 15 }], reqFlame: () => 0 },
    { id: "firegate", name: "Fire Grate Gates", max: 1, mines: true, reqUp: { stakes: 2 },
      info: "Iron grates from the Mines set in the ground outside each gate. A Drowned stepping onto one sets it off: it glows, then flames up through the bars.",
      effect: (l) => { const Q = DL.LAVA_CAMP.grate; return l ? `A grate at each gate · ${Q.dps} damage a second while it flames · cools for ${Q.cool} s` : "No grates"; },
      costs: [{ obsidian: 20, heart: 1, iron: 8 }], reqFlame: () => 0 },
  ];

  // the bosses' size (DL.BOSS.size): `size` is kept on the def so drawing code can scale fixed offsets by it
  for (const [type, f] of Object.entries(DL.BOSS.size)) {
    const d = DL.ENEMIES[type];
    d.size = f;
    d.scale *= f;
    d.radius = Math.round(d.radius * f);
    d.range = Math.round(d.range * f);
    if (d.barY) d.barY = Math.round(d.barY * f);
  }

  for (const u of DL.UPGRADES) u.costs = u.costs.map((c) => (c ? scaleCost(c) : c));
  DL.OUTPOST.cost = scaleCost(DL.OUTPOST.cost);
  DL.FRED.repick = scaleCost(DL.FRED.repick);
  DL.WYVERN.repick = scaleCost(DL.WYVERN.repick);

  // Camp siege waves get nastier each night.
  DL.campPool = function (day) {
    const p = { squire: 5, footman: 3 };
    if (day >= 2) p.archer = 2;
    if (day >= 3) { p.defiler = 2; p.revenant = 2; }
    if (day >= 4) p.blackguard = 1;
    if (day >= 5) p.hexbearer = 1;
    return p;
  };
})(window.DL);

