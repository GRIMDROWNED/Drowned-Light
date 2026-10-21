/* Drowned Light — game data. Tune balance here. */
"use strict";
(function (DL) {
  // Seconds per phase of the day/night cycle.
  DL.CYCLE = { day: 80, dusk: 10, night: 75, dawn: 8 };
  DL.CYCLE.total = DL.CYCLE.day + DL.CYCLE.dusk + DL.CYCLE.night + DL.CYCLE.dawn;

  DL.CAMP_RADIUS = 205; // deposit + camp menu range
  DL.WALL_R = 235;      // palisade ring
  DL.GARDEN_YIELD = [0, 4, 8, 14];
  DL.TIER_NAMES = ["", "A Place to Rest", "A Growing Bastion", "A Beacon in the Marsh"];

  DL.RESOURCES = {
    wood: { name: "Wood", color: "#a07a52" },
    stone: { name: "Stone", color: "#9a9d9e" },
    resin: { name: "Bloom Resin", color: "#43e6ee" },
    iron: { name: "Iron Scrap", color: "#c06a44" },
    pearl: { name: "Abyssal Pearl", color: "#bfa8ff" },
  };
  DL.RES_KEYS = Object.keys(DL.RESOURCES);

  // Zones are rings around the camp. Deeper = darker, deadlier, richer.
  DL.ZONES = [
    { name: "Camp Clearing", r: 0, corrupt: 1, hp: 1, dmg: 1, yield: 1, density: 0, dim: 0, pool: {} },
    { name: "The Shallows", r: 380, corrupt: 1, hp: 1, dmg: 1, yield: 1, density: 9, dim: 0,
      pool: { squire: 5, footman: 3, revenant: 1 } },
    { name: "The Mire", r: 1300, corrupt: 1.25, hp: 1.35, dmg: 1.2, yield: 1.6, density: 11, dim: 0.08,
      pool: { squire: 4, footman: 4, archer: 3, revenant: 2, defiler: 2, hexbearer: 1 } },
    { name: "Drowned Reaches", r: 2600, corrupt: 1.55, hp: 1.8, dmg: 1.45, yield: 2.3, density: 13, dim: 0.2,
      pool: { squire: 3, footman: 4, archer: 3, revenant: 3, defiler: 3, blackguard: 2, hexbearer: 2, champion: 0.15 } },
    { name: "The Abyss", r: 4000, corrupt: 2, hp: 2.4, dmg: 1.75, yield: 3.2, density: 14, dim: 0.5, abyss: true,
      pool: { footman: 3, archer: 3, revenant: 3, defiler: 3, blackguard: 3, hexbearer: 3, champion: 0.5 } },
  ];

  // What grows where (weights), per zone index.
  DL.SPAWN_TABLE = [
    {},
    { tree: 4, wood: 6, stone: 5, sprout: 2, refuge: 1.6, reeds: 4, grave: 1, pillar: 0.5 },
    { tree: 3, wood: 4, stone: 4, iron: 2.5, sprout: 3, refuge: 1.6, sentinel: 0.8, reeds: 3, grave: 1.5, pillar: 1.2 },
    { tree: 2.5, wood: 3, stone: 3, iron: 4, sprout: 3.5, refuge: 1.4, sentinel: 1.2, reeds: 2, grave: 2, pillar: 2 },
    { tree: 2, wood: 2, stone: 3, iron: 5, sprout: 4, refuge: 1, sentinel: 1.5, reeds: 1, grave: 2.5, pillar: 2.5 },
  ];

  // World objects. `solid` = collision radius, `hits` = strikes to mine it. `bloom` objects glow at night and shelter you.
  DL.OBJ = {
    tree: { sprite: "tree", solid: 9 },
    pillar: { sprite: "pillar", solid: 9 },
    grave: { sprite: "grave" },
    reeds: { sprite: "reeds" },
    wood: { sprite: "driftwood", res: "wood", base: 3, hits: 3, r: 14 },
    stone: { sprite: "rock", res: "stone", base: 3, hits: 4, r: 12, solid: 7 },
    iron: { sprite: "ironpile", res: "iron", base: 2, hits: 5, r: 14 },
    sprout: { sprite: "sprout", res: "resin", base: 2, hits: 2, r: 10 },
    pearl: { sprite: "pearl", res: "pearl", base: 1, hits: 2, r: 8 },
    refuge: { sprite: "refuge", bloom: true, light: 125, hp: 70, rad: 14, name: "Refuge Bloom" },
    sentinel: { sprite: "sentinel", bloom: true, light: 95, hp: 100, rad: 14, turret: true, name: "Sentinel Bloom" },
    root: { sprite: "root", bloom: true, light: 200, hp: 480, rad: 30, solid: 20, name: "Mother Root" },
  };

  // Every Drowned Knight wears the player's armour, corrupted. Sprites: src/units.js, keyed by type.
  DL.ENEMIES = {
    squire: { name: "Mire Stalker", hp: 16, speed: 92, dmg: 6, range: 30, windup: 0.32, cd: 1.0, scale: 0.78,
      radius: 10, mass: 0.7, zigzag: true, lunge: 380, retreat: 0.7, drop: { iron: 0.15 } },
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
    self: { name: "Your Drowned Self", hp: 200, speed: 70, dmg: 15, range: 44, windup: 0.5, cd: 1.3, scale: 1.05,
      radius: 14, mass: 2, boss: true, drop: {} },
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
    pikeWarden: {
      name: "Pike Warden", tag: "Kit 02", motto: "Reach keeps the dark away.", roles: ["Control", "Defense", "Frontline"],
      weapon: "Pike and lantern", color: "255,214,140",
      desc: "Extended reach and a stable form. Pike Thrust strikes everything along a line and drives it back.",
      attack: { type: "thrust", name: "Pike Thrust", dmg: 15, range: 96, width: 26, cd: 0.6, kb: 240 },
      dash: { type: "plain" },
      special: { name: "Stable Form", desc: "Plant your feet: after a moment standing still you take 25% less damage, can't be knocked back, and thrusts hit 15% harder." },
      passive: { stance: { after: 0.35, guard: 0.25, dmg: 1.15 } },
      ability: { id: "sweep", name: "Warding Sweep", oil: 12, cd: 11, radius: 115, dmg: 18,
        desc: "A full circle of the pike: hurls the Drowned back, knocks arrows from the air and steadies you." },
      milestones: [
        { name: "Long Reach", desc: "Your pike reaches a fifth farther, its head glowing." },
        { name: "Skewer", desc: "Thrusts pin the Drowned in place for a moment." },
        { name: "Warding Ring", desc: "Warding Sweep leaves a ring of firelight behind." },
        { name: "Warden's Line", desc: "Every thrust launches a spectral spear down the line." },
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
    relicBearer: {
      name: "Relic Bearer", tag: "Kit 04", motto: "Lost things still shine.", roles: ["Utility", "Area control", "Exploration"],
      weapon: "Relic staff", color: "255,232,170",
      desc: "An ancient staff that guides the way and bends light. Seeking orbs, a wider lantern and a slower-burning oil.",
      attack: { type: "orb", name: "Relic Orb", dmg: 10, range: 230, cd: 0.6, speed: 300 },
      dash: { type: "plain" },
      ability: { id: "pulse", name: "Beacon Pulse", oil: 14, cd: 13, radius: 170, dmg: 14, purify: 20,
        desc: "Reveal, purify, dispel: a pulse that lights the area, burns away corruption and scatters arrows." },
      passive: { lanternR: 1.4, oilDrain: 0.7 },
      special: { name: "Wide Lantern", desc: "Your lantern reaches 40% farther and burns its oil 30% slower." },
      milestones: [
        { name: "Lost Things Shine", desc: "A guiding wisp drifts toward the nearest supplies." },
        { name: "Twin Relics", desc: "The staff looses two orbs at a time." },
        { name: "Purifying Pulse", desc: "Beacon Pulse also heals you and cleanses twice as much." },
        { name: "Guiding Light", desc: "A halo of bloomlight travels with you and holds corruption at bay." },
      ],
    },
    flameBastion: {
      name: "Flame Bastion", tag: "Kit 05", motto: "Some light burns brighter.", roles: ["Tank", "Area damage", "Hold the line"],
      weapon: "Sword and bastion shield", color: "255,120,50",
      desc: "An unbreakable guard. The shield blunts every blow, Shield Slam staggers, and Flame Bastion raises a wall of fire.",
      attack: { type: "arc", name: "Bastion Blade", dmg: 16, range: 56, arc: 1.8, cd: 0.62, kb: 170 },
      dash: { type: "slam", dmg: 14, stun: 0.8 },
      ability: { id: "wall", name: "Flame Bastion", oil: 14, cd: 15, length: 150, dps: 14, dur: 7,
        desc: "Raise a wall of fire that blocks the Drowned, burns them and lights the night." },
      passive: { guard: 0.25 },
      special: { name: "Bastion Shield", desc: "Your shield blocks 25% of every blow." },
      milestones: [
        { name: "Tempered Shield", desc: "The shield glows; it blocks 35% of every blow." },
        { name: "Searing Wall", desc: "Flame Bastion burns hotter and stands longer." },
        { name: "Bulwark", desc: "Shield Slam sends out a shockwave that staggers everything near." },
        { name: "Unbreakable", desc: "Flame Bastion rises as a full ring of fire around you." },
      ],
    },
  };
  DL.KIT_ORDER = ["lanternBlade", "pikeWarden", "ashenArbalist", "relicBearer", "flameBastion"];

  /* ---------- pacing ----------
     Three levers slow everything down together:
     1. COST_SCALE multiplies every building and kit-level price.
     2. The Central Flame needs nights survived (FLAME_NIGHTS), and every building's levels hang off the Flame.
     3. Kit levels are locked in bands behind camp structures (KIT_BANDS). */
  DL.COST_SCALE = 2;
  DL.FLAME_NIGHTS = [0, 0, 1, 3, 6, 10]; // nights survived to build Central Flame level i
  DL.KIT_BANDS = [
    { upTo: 5, req: { forge: 1 } },
    { upTo: 10, req: { forge: 2, flame: 3 } },
    { upTo: 15, req: { forge: 3, armory: 2, flame: 4 } },
    { upTo: 20, req: { forge: 4, armory: 3, flame: 5 } },
  ];
  const scaleCost = (c) => {
    const out = {};
    for (const k in c) out[k] = Math.max(1, Math.round(c[k] * DL.COST_SCALE));
    return out;
  };

  // Price to train a kit from level L to L + 1.
  DL.kitLevelCost = function (L) {
    const c = { iron: Math.round(2 + 1.6 * L), resin: Math.round(1 + 0.9 * L) };
    if (L < 8) c.stone = 3 + L;
    if (L < 4) c.wood = 4;
    if (L >= 9) c.pearl = Math.floor((L - 6) / 3);
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
  DL.scaleCost = scaleCost;

  // Camp buildings. costs[level] = price to go from `level` to `level + 1`.
  // reqFlame(target) = Central Flame level needed to build that level.
  DL.UPGRADES = [
    { id: "flame", name: "Central Flame", max: 5,
      info: "The heart of the camp. A bigger light and a sturdier flame. Levels 3 and 5 grow the camp into a Bastion, then a Beacon.",
      effect: (l) => `Light radius ${180 + 40 * l} · flame strength ${150 + 100 * l}`,
      costs: [null, { wood: 10, stone: 6 }, { wood: 22, stone: 16, resin: 5 }, { wood: 34, stone: 30, iron: 10, resin: 10 },
        { wood: 48, stone: 42, iron: 22, pearl: 3 }],
      reqFlame: () => 0 },
    { id: "forge", name: "Forge", max: 4, info: "Hone your weapon.",
      effect: (l) => `Weapon damage +${20 * l}%`,
      costs: [{ stone: 8, iron: 4 }, { stone: 16, iron: 10 }, { stone: 26, iron: 20, pearl: 2 }, { stone: 38, iron: 30, pearl: 5 }],
      reqFlame: (t) => t },
    { id: "armory", name: "Armory", max: 4, info: "Reinforce your armour.",
      effect: (l) => `Max health ${100 + 25 * l}`,
      costs: [{ wood: 10, iron: 4 }, { wood: 20, iron: 12 }, { wood: 30, iron: 22, resin: 8 }, { wood: 44, iron: 32, pearl: 4 }],
      reqFlame: (t) => t },
    { id: "workbench", name: "Workbench", max: 4, info: "Craft lanterns and tools. A longer-burning lantern halves corruption in the dark for longer.",
      effect: (l) => `Lantern oil ${60 + 25 * l} · torch satchel ${3 + l} · torches burn ${50 + 15 * l}s`,
      costs: [{ resin: 6, stone: 6 }, { resin: 12, iron: 6 }, { resin: 20, iron: 12, pearl: 2 }, { resin: 30, iron: 20, pearl: 5 }],
      reqFlame: (t) => t },
    { id: "garden", name: "Cultivation Plot", max: 3, info: "Grow bioluminescent flora inside the walls. Light from the living.",
      effect: (l) => (l ? `Harvest ${DL.GARDEN_YIELD[l]} Bloom Resin each dawn` : "Nothing planted"),
      costs: [{ wood: 12, resin: 6 }, { wood: 20, stone: 10, resin: 12 }, { wood: 30, resin: 20, pearl: 2 }],
      reqFlame: (t) => t + 1 },
    { id: "tower", name: "Watchtowers", max: 3, info: "Crossbow towers that spot and shoot the Drowned at night.",
      effect: (l) => (l ? `${l} tower${l > 1 ? "s" : ""} · bolt damage ${10 + 6 * l}` : "No towers"),
      costs: [{ wood: 24, stone: 14 }, { wood: 34, stone: 24, iron: 10 }, { wood: 48, iron: 24, pearl: 3 }],
      reqFlame: (t) => t + 1 },
    { id: "pylon", name: "Lantern Pylons", max: 3, info: "Firelight on the perimeter. Guides the way and slows the encroaching Drowned — but Lantern Reavers hunt them.",
      effect: (l) => (l ? `${2 * l} pylons light the walls` : "No pylons"),
      costs: [{ wood: 16, stone: 10, resin: 4 }, { wood: 24, iron: 10, resin: 8 }, { stone: 30, iron: 18, pearl: 2 }],
      reqFlame: (t) => t + 1 },
    { id: "stakes", name: "Barricade & Gate", max: 3, info: "Keep the darkness out. Walls force the Drowned through four gates, where stakes wound them.",
      effect: (l) => ["No defenses", "A ring of stakes · 15 damage to attackers", "Palisade with four gates · 25 damage at the gates",
        "Reinforced palisade · 40 damage at the gates, attackers slowed"][l],
      costs: [{ wood: 18 }, { wood: 36, iron: 8 }, { wood: 50, iron: 18, resin: 10 }],
      reqFlame: (t) => [0, 1, 3, 5][t] },
  ];

  for (const u of DL.UPGRADES) u.costs = u.costs.map((c) => (c ? scaleCost(c) : c));

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
