/* Drowned Light — game data. Tune balance here. */
"use strict";
(function (DL) {
  // Seconds per phase of the day/night cycle.
  DL.CYCLE = { day: 80, dusk: 10, night: 75, dawn: 8 };
  DL.CYCLE.total = DL.CYCLE.day + DL.CYCLE.dusk + DL.CYCLE.night + DL.CYCLE.dawn;

  DL.CAMP_RADIUS = 205; // deposit + camp menu range (grows with the walls: DL.Camp.menuR)
  DL.WALL_R = 235;      // palisade half-side; set from the Barricade level by DL.Camp.sync
  DL.WALL_SIZES = [235, 235, 235, 235, 290, 345]; // palisade half-side at each Barricade level: levels 4 and 5 push it out
  DL.GARDEN_YIELD = [0, 4, 8, 14];
  DL.TIER_NAMES = ["", "A Place to Rest", "A Growing Bastion", "A Beacon in the Marsh"];

  DL.RESOURCES = {
    wood: { name: "Wood", color: "#a07a52" },
    stone: { name: "Stone", color: "#9a9d9e" },
    resin: { name: "Bloom Resin", color: "#43e6ee" },
    iron: { name: "Iron Scrap", color: "#c06a44" },
    pearl: { name: "Amethyst", color: "#bfa8ff" },
    black: { name: "Black Pearl", color: "#5d6b8c" }, // found only in the Abyss
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
        { name: "Lost Things Shine", desc: "A wisp familiar hovers by you and flicks motes of light at nearby Drowned." },
        { name: "Twin Relics", desc: "The staff looses two orbs at a time." },
        { name: "Purifying Pulse", desc: "Beacon Pulse also heals you and cleanses twice as much." },
        { name: "Guiding Light", desc: "A halo of bloomlight travels with you and holds corruption at bay." },
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
    chainReaper: {
      name: "Chain Reaper", tag: "Kit 06", motto: "The dark is only a tether.", roles: ["Speed", "Burst", "Glass cannon"],
      weapon: "Chain sickle", color: "176,120,255",
      desc: "A sickle on a long chain, thrown out and torn back. The fastest and deadliest knight, but the most fragile: every kill gives you your dash back.",
      attack: { type: "chain", name: "Sickle Throw", dmg: 18, back: 0.5, range: 110, width: 30, cd: 0.45, kb: 90 },
      dash: { type: "strike", dmg: 10, cd: 1.1 },
      hpMult: 0.7, speedMult: 1.2,
      ability: { id: "snare", name: "Violet Snare", oil: 12, cd: 12, radius: 115, dmg: 16, root: 2,
        desc: "Whirl the chain around you: it cuts every Drowned in reach and roots them in place for 2 seconds." },
      passive: { rush: { speed: 1.25, dur: 1.5 } },
      special: { name: "Reaper's Rush", desc: "Every kill resets your dash and gives you a burst of speed." },
      milestones: [
        { name: "Barbed Chain", desc: "Sickle Throw tears the flesh: the Drowned it hits bleed." },
        { name: "Twin Sickles", desc: "The throw splits in two." },
        { name: "Executioner", desc: "50% more damage to Drowned below 30% health." },
        { name: "Violet Gyre", desc: "Violet Snare leaves a ring of whirling chains that cuts and roots whatever crosses it." },
      ],
    },
  };
  DL.KIT_ORDER = ["lanternBlade", "pikeWarden", "ashenArbalist", "relicBearer", "flameBastion", "chainReaper"];

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
    need: 10, orbs: [[3, 550, 1250], [4, 1400, 2550], [3, 2700, 3900], [2, 4150, 4700]], grab: 28,
    graveDist: 4400, clear: 190, giveR: 120,
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
    ringDist: 3150, clear: 170, wakeR: 70, trialHp: 260, waveEvery: 10, waveR: 480, trialCapEvery: 15, winR: 900, wilt: 3,
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
    nestDist: 3400, clear: 170, grab: 40, warnR: 230, arriveR: 760, winR: 900, respawnDays: 3, haulSpeed: 0.92, catchUp: 620,
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
    r: 4800, roam: 0.0035, spawn: 1100, forget: 1700, erupt: 120, creep: 26,
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
    dist: 4500, clear: 230, bushes: 11, petalR: 1700, hintR: 1500, foundR: 420, spawn: 1100, forget: 1700, leash: 460,
    lashKb: 260, lashShow: 0.4, phase2: 0.5, fast: 1.2, rate: 1.35, respawnDays: 4, maxVines: 30,
    waltz: { first: 5, every: 9, windup: 0.9, spin: 1.3, r: 170, drift: 0.6, hits: 3, dmg: 0.45, kb: 240 },
    briar: { first: 3, every: 11, windup: 0.6, delay: 0.5, reach: 480, n: 5, step: 58, r: 34, dmg: 0.7, life: 4, sting: 0.12 },
  };
  /* The finale (src/finale.js): Kindle becomes the Fire Bearer and carries the last light of the marsh to the Drowned Gate.
     Nothing of it shows until it's earned: Central Flame 5, the Starved Bell and the Deadly Rose slain, Derek won from the
     Colossus, and your Kindle lit. At the next dawn Kindle drinks from the Central Flame and rises as the Bearer.
       gate      the Drowned Gate stands `dist` px out (±250) in the north half of the Abyss, on dry land, kept `clear` px clear
                 of rocks and trees; within `foundR` px a knight has found it. The arena is a ring of `arenaR` px whose
                 heart lies `arenaY` px south of the gate; the Bearer stops `plantY` px south of the gate. In the arena the
                 camera pulls back to show at least `view` px top to bottom (and `viewW` across), and leans toward the King.
       march     begun from the camp by day. The Bearer walks `speed` px/s (`wade` × in water), only while a knight is within
                 `leash` px. It has `hp` health (× the party), firelight `light` px round it, and every `pulseEvery` s burns
                 the Drowned within `pulseR` px for `pulseDmg` (and sets them alight). By day, every `bandEvery` s while it
                 walks, `bandN` (+1 per zone past the Mire) Drowned rise from the mud `bandR` px off and come for it.
       night     at dusk it plants its feet wherever it is (its last camp, where it falls back to) and lights `braziers`
                 braziers `brazierR` px round it; its light grows to `restLight`. Every `waveEvery` s a wave of `waveN`
                 (+ the day, like the camp's) comes for it from two sides, while a knight is within `campR` px.
                 At dawn it heals `dawnHeal` of its health. The Great Siege doesn't come while the Bearer is out.
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
    gate: { dist: 4900, clear: 560, foundR: 650, arenaR: 420, arenaY: 250, plantY: 380, view: 1150, viewW: 760 },
    speed: 24, wade: 0.6, leash: 340, hp: 1500, light: 260, restLight: 330, pulseEvery: 3, pulseR: 95, pulseDmg: 18,
    bandEvery: 15, bandN: 3, bandR: 440, braziers: 4, brazierR: 160, waveEvery: 11, waveN: 4, campR: 750, dawnHeal: 0.4,
    king: {
      rise: 3.5, charge: 16, hitCharge: 0.012, open: 9, phases: [0.66, 0.33], rate: 1.25, forget: 1500, spawn: 1000,
      slam: { first: 3, every: 4.2, windup: 1.4, r: 92, dmg: 1.3, bearer: 70 },
      sweep: { first: 8, every: 11, windup: 1.7, n: 13, step: 62, r: 40, dmg: 1, bearer: 90 },
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
               `life` seconds as cover; `adds` small Drowned Knights (`add`) climb out with them, never more than `maxAdds` alive.
     surge:    stomps out a ring of water that rolls `reach` px at `speed` px/s and hits `dmg` × its blow (knocking back `kb`).
               A knight with a ruin between them and the Colossus is sheltered from it.
     collapse: brings its ruined back down: `n` (`n2` once wounded) falling stones, one on each knight and the rest near them,
               landing after `delay` seconds for `dmg` × its blow; each leaves a ruin `leave` of the time.
     Below `phase2` of its health it moves `fast` × quicker and its moves come round `rate` × as often. */
  DL.COLOSSUS = {
    slam: { kb: 300 },
    summon: { every: 16, first: 6, windup: 1.1, ruins: 3, dmg: 0.6, life: 14, r: 22, adds: 3, add: "squire", maxAdds: 6 },
    surge: { every: 12, first: 10, windup: 1.2, reach: 340, speed: 290, band: 24, dmg: 0.75, kb: 280 },
    collapse: { every: 14, first: 14, windup: 0.9, n: 5, n2: 9, delay: 1.5, r: 38, dmg: 0.9, leave: 0.35 },
    maxRuins: 9, phase2: 0.5, fast: 1.2, rate: 1.45,
  };
  /* The Great Siege (src/siege.js): every `every`th night the Drowned march on the camp wherever the knights are.
     A wave comes every `waveEvery` s (the first `first` s after dusk) from `sides` directions, each `size` times a
     normal camp wave, as strong as zone `zone(night)`. If the Central Flame goes out that night the camp has fallen.
     `gameOver`: a fallen camp ends the game. Off while the game is in development (it only tells you); turn it on
     near release. The Starved Bell Tower tolls `warn` s before every camp wave and leaves it dazed for `daze` s. */
  DL.SIEGE = {
    every: 10, waveEvery: 10, first: 4, sides: 2, size: 1.5, warn: 8, daze: 2,
    zone: (night) => Math.min(4, 1 + Math.floor(night / 10)),
    gameOver: false,
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

  // Camp buildings. costs[level] = price to go from `level` to `level + 1`.
  // reqFlame(target) = Central Flame level needed to build that level.
  DL.UPGRADES = [
    { id: "flame", name: "Central Flame", max: 5,
      info: "The heart of the camp. A bigger light and a sturdier flame. Levels 3 and 5 grow the camp into a Bastion, then a Beacon.",
      effect: (l) => `Light radius ${180 + 40 * l} · flame strength ${150 + 100 * l}`,
      costs: [null, { wood: 10, stone: 6 }, { wood: 22, stone: 16, resin: 5 }, { wood: 34, stone: 30, iron: 10, resin: 10 },
        { wood: 48, stone: 42, iron: 22, pearl: 3, black: 2 }],
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
      reqFlame: (t) => [0, 1, 3, 5, 5, 5][t] },
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
  ];

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
