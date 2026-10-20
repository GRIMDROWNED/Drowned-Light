/* Drowned Light — game data. Tune balance here. */
"use strict";
(function (DL) {
  // Seconds per phase of the day/night cycle.
  DL.CYCLE = { day: 80, dusk: 10, night: 75, dawn: 8 };
  DL.CYCLE.total = DL.CYCLE.day + DL.CYCLE.dusk + DL.CYCLE.night + DL.CYCLE.dawn;

  DL.CAMP_RADIUS = 170; // deposit + camp menu range

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
      pool: { squire: 4, footman: 4, archer: 3, revenant: 2, defiler: 2 } },
    { name: "Drowned Reaches", r: 2600, corrupt: 1.55, hp: 1.8, dmg: 1.45, yield: 2.3, density: 13, dim: 0.2,
      pool: { squire: 3, footman: 4, archer: 3, revenant: 3, defiler: 3, blackguard: 2, champion: 0.15 } },
    { name: "The Abyss", r: 4000, corrupt: 2, hp: 2.4, dmg: 1.75, yield: 3.2, density: 14, dim: 0.5, abyss: true,
      pool: { footman: 3, archer: 3, revenant: 3, defiler: 3, blackguard: 3, champion: 0.5 } },
  ];

  // What grows where (weights), per zone index.
  DL.SPAWN_TABLE = [
    {},
    { tree: 4, wood: 6, stone: 5, sprout: 2, refuge: 1.6, reeds: 4, grave: 1, pillar: 0.5 },
    { tree: 3, wood: 4, stone: 4, iron: 2.5, sprout: 3, refuge: 1.6, sentinel: 0.8, reeds: 3, grave: 1.5, pillar: 1.2 },
    { tree: 2.5, wood: 3, stone: 3, iron: 4, sprout: 3.5, refuge: 1.4, sentinel: 1.2, reeds: 2, grave: 2, pillar: 2 },
    { tree: 2, wood: 2, stone: 3, iron: 5, sprout: 4, refuge: 1, sentinel: 1.5, reeds: 1, grave: 2.5, pillar: 2.5 },
  ];

  // World objects. `solid` = collision radius. `bloom` objects glow at night and shelter you.
  DL.OBJ = {
    tree: { sprite: "tree", solid: 9 },
    pillar: { sprite: "pillar", solid: 9 },
    grave: { sprite: "grave" },
    reeds: { sprite: "reeds" },
    wood: { sprite: "driftwood", res: "wood", base: 3, gather: 0.7, r: 14 },
    stone: { sprite: "rock", res: "stone", base: 3, gather: 0.9, r: 12, solid: 7 },
    iron: { sprite: "ironpile", res: "iron", base: 2, gather: 1.1, r: 14 },
    sprout: { sprite: "sprout", res: "resin", base: 2, gather: 0.8, r: 10 },
    pearl: { sprite: "pearl", res: "pearl", base: 1, gather: 0.5, r: 8 },
    refuge: { sprite: "refuge", bloom: true, light: 125, hp: 70, rad: 14, name: "Refuge Bloom" },
    sentinel: { sprite: "sentinel", bloom: true, light: 95, hp: 100, rad: 14, turret: true, name: "Sentinel Bloom" },
    root: { sprite: "root", bloom: true, light: 200, hp: 480, rad: 30, solid: 20, name: "Mother Root" },
  };

  // Every Drowned Knight is the player's own armour, corrupted (see Art.VARIANTS).
  DL.ENEMIES = {
    squire: { name: "Broken Squire", hp: 16, speed: 92, dmg: 6, range: 30, windup: 0.32, cd: 1.0, scale: 0.78,
      variant: "drowned", radius: 10, mass: 0.7, drop: { iron: 0.15 } },
    footman: { name: "Drowned Footman", hp: 34, speed: 58, dmg: 11, range: 36, windup: 0.45, cd: 1.4, scale: 1,
      variant: "drowned", radius: 13, mass: 1, drop: { iron: 0.4 } },
    archer: { name: "Shade Archer", hp: 22, speed: 64, dmg: 9, range: 230, windup: 0.7, cd: 2.3, scale: 0.95,
      variant: "drowned", radius: 12, mass: 0.9, ranged: true, keep: 170, drop: { iron: 0.3 } },
    revenant: { name: "Swarming Revenant", hp: 9, speed: 104, dmg: 5, range: 24, windup: 0.25, cd: 0.9, scale: 0.6,
      variant: "drowned", radius: 8, mass: 0.4, crawl: true, drop: { resin: 0.1 } },
    defiler: { name: "Lantern Defiler", hp: 44, speed: 52, dmg: 12, range: 40, windup: 0.6, cd: 1.6, scale: 1.05,
      variant: "drowned", radius: 13, mass: 1.2, targetsLight: true, lightDmg: 26, drop: { resin: 0.6, iron: 0.3 } },
    blackguard: { name: "Blackguard", hp: 140, speed: 40, dmg: 20, range: 44, windup: 0.75, cd: 2.0, scale: 1.3,
      variant: "blackguard", radius: 18, mass: 3.5, armor: 0.35, drop: { iron: 1 } },
    champion: { name: "Drowned Champion", hp: 520, speed: 56, dmg: 28, range: 70, windup: 0.8, cd: 2.2, scale: 1.7,
      variant: "champion", radius: 24, mass: 8, armor: 0.2, boss: true, drop: { iron: 1, pearl: 1 } },
    self: { name: "Your Drowned Self", hp: 200, speed: 70, dmg: 15, range: 44, windup: 0.5, cd: 1.3, scale: 1.05,
      variant: "self", radius: 14, mass: 2, boss: true, drop: {} },
  };

  // Base kits. A kit = weapon + dash behaviour + signature ability.
  DL.KITS = {
    lanternBlade: {
      name: "Lantern Blade", tag: "Kit 01",
      desc: "A faithful blade and a lantern that holds back the dark. Quick strikes, and your dash becomes a Lantern Strike that cuts through the Drowned.",
      attack: { dmg: 12, range: 64, arc: 2.1, cd: 0.42, kb: 150, color: "255,197,106" },
      dashDmg: 9,
      ability: { id: "illuminate", name: "Illuminate", oil: 15, cd: 14, radius: 150, dmg: 22, dur: 5,
        desc: "A burst of firelight that burns and repels the Drowned, leaving a short-lived sanctuary." },
    },
    pyreCenser: {
      name: "Pyre Censer", tag: "Kit 02",
      desc: "A heavy censer of burning pitch. Slow, wide swings set the Drowned ablaze; Kindle plants braziers that light and scorch the night.",
      attack: { dmg: 17, range: 72, arc: 2.8, cd: 0.72, kb: 220, burn: 5, color: "255,122,58" },
      dashDmg: 0,
      ability: { id: "kindle", name: "Kindle", oil: 10, cd: 16, radius: 115, dps: 9, dur: 14,
        desc: "Plant a burning brazier: firelight that scorches any Drowned who come near." },
      cost: { stone: 20, iron: 15, resin: 10 }, req: { forge: 1 },
    },
  };
  DL.MASTERY_COSTS = [
    { resin: 8, iron: 5 },
    { resin: 16, iron: 12, pearl: 1 },
    { resin: 26, iron: 20, pearl: 4 },
  ];

  DL.TORCH_COST = { wood: 3, resin: 1 };

  // Camp buildings. costs[level] = price to go from `level` to `level + 1`.
  // reqFlame(target) = Central Flame level needed to build that level.
  DL.UPGRADES = [
    { id: "flame", name: "Central Flame", max: 5,
      info: "Your home's light. Bigger radius, a sturdier flame, and it unlocks higher building levels.",
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
    { id: "lantern", name: "Lanternwright", max: 4, info: "A brighter, longer-burning lantern. Lantern oil halves corruption in the dark.",
      effect: (l) => `Lantern oil ${60 + 25 * l} · torch satchel ${3 + l}`,
      costs: [{ resin: 6, stone: 6 }, { resin: 12, iron: 6 }, { resin: 20, iron: 12, pearl: 2 }, { resin: 30, iron: 20, pearl: 5 }],
      reqFlame: (t) => t },
    { id: "tower", name: "Watchtowers", max: 3, info: "Crossbow towers that defend the camp at night.",
      effect: (l) => (l ? `${l} tower${l > 1 ? "s" : ""} · bolt damage ${10 + 6 * l}` : "No towers"),
      costs: [{ wood: 24, stone: 14 }, { wood: 34, stone: 24, iron: 10 }, { wood: 48, iron: 24, pearl: 3 }],
      reqFlame: (t) => t + 1 },
    { id: "stakes", name: "Warding Stakes", max: 3, info: "A ring of stakes that wounds and slows the Drowned as they reach camp.",
      effect: (l) => (l ? `Ring damage ${15 * l} · slows attackers` : "No stakes"),
      costs: [{ wood: 18 }, { wood: 32, iron: 8 }, { wood: 48, iron: 18, resin: 10 }],
      reqFlame: (t) => t },
  ];

  // Camp siege waves get nastier each night.
  DL.campPool = function (day) {
    const p = { squire: 5, footman: 3 };
    if (day >= 2) p.archer = 2;
    if (day >= 3) { p.defiler = 2; p.revenant = 2; }
    if (day >= 4) p.blackguard = 1;
    return p;
  };
})(window.DL);
