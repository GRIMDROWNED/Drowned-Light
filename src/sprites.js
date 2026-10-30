/* Drowned Light — hand-drawn sprites loaded from PNG files over the coded art.
   UNITS replace views of a coded unit sheet (src/units.js); PROPS replace world and
   camp sprites (src/art.js). Anything not listed keeps its coded art, and a file that
   fails to load is skipped.
   One PNG per frame at art-pixel size (1 px = 1 art pixel, shown ×2 in game), facing
   right for side views. A set with `res: 2` has two file pixels per art pixel (drawn 1:1 on
   screen) for finer detail. Frame entries are paths under the set's folder, with optional
   suffixes: "@bob" draws the frame one pixel lower (a step), "@fall" lays it on its side.
   `feet` gives a file's foot point [x, y] in its own pixels; without it the feet are
   guessed from the lowest opaque pixels near the middle of the bottom of the sprite. */
"use strict";
(function (DL) {
  const Art = DL.Art;

  // Set to false to go back to the coded sprites everywhere.
  const ENABLED = true;

  // Kit knights: [how far toward the drowned palette, lantern turns cyan] per corruption stage, as in src/units.js.
  // Drawn 4-frame runs (running() below) switched off 2026-10-29: Robert didn't like how they look; the frames stay in assets for a redraw later.
  // The Jade Breaker runs again since 2026-10-30 with an 8-frame side run from SpriteCook (jade() below).
  const RUNS = false;
  const stages = (kit) => ({ [kit + 1]: [0, false], [kit + 2]: [0.22, false], [kit + 3]: [0.5, false], [kit + 4]: [0.8, true], ["self_" + kit]: [0.9, true] });

  // A unit from its motion sheet: a pose per view (front, back, right) and three attack frames shared by every view.
  // A single pose walks by stepping ("@bob") and dies by falling ("@fall").
  function motion(extra = {}) {
    const atk = ["attackA", "attackB", "attackC"], views = {};
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]]) {
      views[dir] = Object.assign({
        idle: [p], walk: [p, p, p, p], attack: atk,
        dash: [p], hurt: [p], death: [p, p, p + "@fall"],
      }, extra[dir]);
      views[dir].walk = stepped(views[dir].walk);
    }
    return views;
  }

  // Every walk is 8 frames, with the feet lifted in turn on top of the drawn frames ("@L2" lifts the
  // left half of the legs 2 art px), since the rendered walk frames barely move the legs.
  const STEP = ["L2", "L1", "", "R1", "R2", "R1", "", "L1"];
  function stepped(frames) {
    const f8 = frames.length === 4 ? frames.flatMap((f) => [f, f]) : frames;
    return f8.map((f, i) => (STEP[i] && !f.includes("@") ? f + "@" + STEP[i] : f));
  }
  const drowned = (type, views, res) => ({ path: "assets/sprites/drowned/" + type + "/", keys: { [type]: [0, false] }, views: views || motion(), res });

  // The 12 poses from the enemy prompt: three views, a side walk, three attack frames, hurt and death.
  const POSES_SIDE = { hurt: ["side/hurt"], death: ["side/hurt", "side/death", "side/death"] };
  const twelve = (type) => drowned(type, motion({
    side: Object.assign({ walk: ["side/walk1", "side/walk2", "side/walk3", "side/walk4"] }, POSES_SIDE),
    down: POSES_SIDE, up: POSES_SIDE,
  }), 2);

  // A walk drawn with real leg movement: 4 frames each shown twice, with no foot lift ("@-").
  const WALK4 = [1, 1, 2, 2, 3, 3, 4, 4].map((i) => "side/walk" + i + "@-");
  // Front and back walks are 4 frames from one sheet, each shown twice to match the side walk's length.
  const WALK4x2 = (p) => [1, 1, 2, 2, 3, 3, 4, 4].map((i) => p + i);

  const sheetFeet = (files, xy) => Object.fromEntries(files.map((f) => [f, xy]));
  const WALK_FRONT = WALK4x2("walkF").map((f) => f + "@-");
  const WALK_BACK = WALK4x2("walkB").map((f) => f + "@-");
  // The shared foot point of each walk sheet (side, front, back), as printed by tools/cut_ai_sprites.py
  // (moved onto the feet by hand where a pike or staff butt on the ground pulled it aside).
  const walkFeet = (side, front, back) =>
    Object.assign(sheetFeet([1, 2, 3, 4].map((i) => "side/walk" + i), side), sheetFeet(WALK4x2("walkF"), front), sheetFeet(WALK4x2("walkB"), back));

  // An enemy with the 12 poses plus 4-pose walk sheets for all three views.
  const walking = (type, side, front, back, res = 2) => Object.assign(drowned(type, motion({
    side: Object.assign({ walk: WALK4 }, POSES_SIDE),
    down: Object.assign({ walk: WALK_FRONT }, POSES_SIDE),
    up: Object.assign({ walk: WALK_BACK }, POSES_SIDE),
  }), res), { feet: walkFeet(side, front, back) });

  // The knight has his own walk, dash, hurt and death frames; down and up views borrow the side ones for dash, hurt and death.
  const KNIGHT_SIDE = { dash: ["side/dash"], hurt: ["side/hurt"], death: ["side/hurt", "side/death", "side/death"] };
  const UNITS = [
    {
      path: "assets/sprites/lantern-knight/",
      keys: stages("lanternBlade"),
      res: 2,
      views: motion({
        side: Object.assign({ walk: WALK4 }, KNIGHT_SIDE),
        down: Object.assign({ walk: WALK_FRONT }, KNIGHT_SIDE),
        up: Object.assign({ walk: WALK_BACK }, KNIGHT_SIDE),
      }),
      feet: walkFeet([44, 80], [35, 82], [30, 82]),
    },
    walking("squire", [46, 86], [38, 86], [37, 84]),
    walking("archer", [44, 83], [35, 90], [33, 88]),
    walking("revenant", [54, 79], [38, 80], [41, 82]),
    walking("defiler", [54, 84], [38, 86], [40, 87]),
    walking("blackguard", [61, 87], [36, 88], [32, 87]),
    walking("hexbearer", [55, 91], [46, 95], [41, 93]),
    // the boss is drawn 1.5x bigger, so its frames are cut at 3 file px per art pixel
    walking("champion", [87, 128], [58, 129], [41, 132], 3),
    walking("footman", [56, 78], [36, 84], [37, 83]),
    // the other kits' knights: the 12 poses and walk sheets like an enemy's, at every corruption stage
    Object.assign(walking("pikeWarden", [48, 103], [33, 103], [31, 103]), { path: "assets/sprites/pike-warden/", keys: stages("pikeWarden") }),
    arbalist(),
    iceMage(),
    Object.assign(walking("flameBastion", [58, 97], [39, 97], [33, 93]), { path: "assets/sprites/flame-bastion/", keys: stages("flameBastion") }),
    reaper(),
    jade(),
    rosePaladin(),
    // the Bone Hound summon: the same 12 poses and walk sheets, its side walk a four-legged gallop
    Object.assign(walking("boneHound", [55, 55], [27, 64], [26, 66]), { path: "assets/sprites/bone-hound/", keys: { boneHound: [0, false] } }),
    // its first form, the Bone Pup (src/summons.js), cut at res 4: 22 px tall, about three quarters of the hound
    Object.assign(walking("boneHound_f0", [87, 88], [27, 88], [26, 87], 4), { path: "assets/sprites/bone-hound-f0/", keys: { boneHound_f0: [0, false] } }),
    // the Ember Hound (its third form), res 4: 34 px tall with its flames
    Object.assign(walking("boneHound_f2", [117, 132], [47, 138], [46, 138], 4), { path: "assets/sprites/bone-hound-f2/", keys: { boneHound_f2: [0, false] } }),
    // the Grave Warg (its last form), res 4: 38 px tall with its horns and ghost-fire
    Object.assign(walking("boneHound_f3", [123, 151], [63, 154], [55, 154], 4), { path: "assets/sprites/bone-hound-f3/", keys: { boneHound_f3: [0, false] } }),
    derek(),
    // his first form, Pebble Derek (src/summons.js): about three quarters of his size
    derek("derek_f0", "derek-f0", [22, 48], [27, 45], [28, 44]),
    // Crystal Derek (his third form): a seventh bigger, crystals grown out of him
    derek("derek_f2", "derek-f2", [43, 84], [42, 74], [39, 71]),
    // Derek the Bastion (his last form): a third bigger, a walking castle wall
    derek("derek_f3", "derek-f3", [49, 91], [45, 80], [43, 81]),
    kindle(),
    // Fred the Sprout (Fred's first form, src/fred.js), cut at res 4: 20 px tall with his cap, half the knight
    fred("fred_f0", "fred-f0", [42, 82], [43, 82], [41, 83]),
    fred("fred_f1", "fred-f1", [54, 109], [48, 110], [48, 109]), // Fred (level 5), 27 px
    fred("fred_f2", "fred-f2", [120, 167], [72, 167], [78, 170]), // Weeping Fred (level 10), 41 px
    fred("fred_f3", "fred-f3", [160, 248], [107, 222], [110, 216]), // Fred the Rotwalker (level 15), 52 px
    // David the Hatchling (the wyvern's first form, src/wyvern.js), res 4: 24 px from wing tip to tail
    wyvern("wyvern_f0", "wyvern-f0", [90, 117], [81, 116], [82, 122]),
    wyvern("wyvern_f1", "wyvern-f1", [125, 160], [123, 173], [111, 189]), // David (level 5), 37 px
    wyvern("wyvern_f2", "wyvern-f2", [144, 210], [139, 267], [141, 261]), // Great David (level 10), 47 px
    wyvern("wyvern_f3", "wyvern-f3", [160, 257], [152, 289], [157, 287]), // David the Bloodwing (level 15), 52 px
    wyvernMother(),
    abigail(),
    // Mourning Abigail (her third form): a tenth taller, in violet mourning rags
    abigail("abigail_f2", "abigail-f2", [98, 136], [78, 149], [83, 152]),
    // Abigail, Queen of Sorrows (her last form): a fifth taller, crowned in pale bone
    abigail("abigail_f3", "abigail-f3", [106, 146], [110, 171], [112, 168]),
    bell(),
    rose(),
    colossus(),
  ];

  /* The Frostweaver (kit 04, still "relicBearer" inside so old saves keep their kit): the 12 poses and walk sheets like the
     other kits, except that his side view is a standalone picture, flipped (tools/cut_ai_sprites.py). The standing and
     casting feet are the middle between his boots, since the staff's butt reaches the ground too. */
  function iceMage() {
    const set = Object.assign(walking("relicBearer", [53, 106], [25, 106], [35, 105]), { path: "assets/sprites/ice-mage/", keys: stages("relicBearer") });
    Object.assign(set.feet, { front: [35, 104], back: [22, 103], right: [48, 105], attackA: [48, 103], attackB: [40, 94], attackC: [41, 102] });
    return set;
  }

  // The Chain Reaper (kit 06): the 12 poses and walk sheets, plus a lunge for his dash. His throw is the wind-up and
  // the empty hand flung out (the game draws the flying sickle and chain); the chain whirled overhead is his cast.
  // The Ashen Arbalist (redrawn 2026-10-28): aims, looses and reloads; kneels to loose Scatter Shot; a low sidestep for his dash.
  function arbalist() {
    const set = Object.assign(walking("ashenArbalist", [37, 83], [31, 84], [33, 84]), { path: "assets/sprites/ashen-arbalist/", keys: stages("ashenArbalist") });
    for (const dir in set.views) Object.assign(set.views[dir], { cast: ["side/castA", "side/castB", "side/castB"], dash: ["side/dash"] });
    return set;
  }

  // The Jade Breaker (kit 07): the 12 poses and walk sheets for all three views.
  // His sweep is wind-up, mid-sweep, follow-through; Jade Tide is a crouched wind-up and the great sweep; a low lunge for his dash.
  // At full speed he runs with 8 frames from the side (side/sprint1-8) and facing you (sprintF1-8), made with SpriteCook and
  // recoloured to his palette; running away from you he keeps his walk, played a third quicker.
  function jade() {
    const set = Object.assign(walking("jadeBreaker", [76, 91], [28, 92], [29, 93]), { path: "assets/sprites/jade-breaker/", keys: stages("jadeBreaker") });
    for (const dir in set.views) Object.assign(set.views[dir], { cast: ["side/castA", "side/castB", "side/castB"], dash: ["side/dash"] });
    const sprint = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => "side/sprint" + i);
    set.views.side.run = sprint.map((f) => f + "@-");
    const sprintF = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => "sprintF" + i);
    set.views.down.run = sprintF.map((f) => f + "@-");
    set.views.up.run = WALK_BACK;
    Object.assign(set.feet, sheetFeet(sprint, [41, 98]), sheetFeet(sprintF, [30, 98]));
    return set;
  }

  /* The Rose Paladin (kit 08): the 12 poses and walk sheets. His Thorn Lash is the raised sword, the cut and the
     follow-through (the Deadly Rose's whip is drawn cracking round the arc, src/render.js); in Rose's Waltz he turns on
     the spot inside her ring of thorns. Feet of the single poses set by hand: his sword tip and cape reach the ground. */
  function rosePaladin() {
    const set = Object.assign(walking("rosePaladin", [66, 98], [62, 100], [55, 100]), { path: "assets/sprites/rose-paladin/", keys: stages("rosePaladin") });
    Object.assign(set.feet, { front: [49, 98], back: [34, 98], right: [56, 97], attackA: [54, 88], attackB: [48, 78], attackC: [52, 77], "side/hurt": [58, 85] });
    return set;
  }

  function reaper() {
    const set = Object.assign(walking("chainReaper", [44, 80], [26, 86], [29, 86]), { path: "assets/sprites/chain-reaper/", keys: stages("chainReaper") });
    for (const dir in set.views) Object.assign(set.views[dir], { attack: ["attackA", "attackB", "attackB"], cast: ["attackC"], dash: ["side/dash"] });
    return running(set, [55, 76], [42, 82], [33, 82]);
  }

  // A run played at full speed (src/render.js): 4 drawn frames a view (side/run1-4, runF1-4, runB1-4) and each sheet's foot point.
  function running(set, side, front, back) {
    if (!RUNS) return set;
    const RUN = { side: ["side/run", side], down: ["runF", front], up: ["runB", back] };
    for (const dir in RUN) {
      const fr = [1, 2, 3, 4].map((i) => RUN[dir][0] + i);
      set.views[dir].run = fr.map((f) => f + "@-");
      Object.assign(set.feet, sheetFeet(fr, RUN[dir][1]));
    }
    return set;
  }

  // Derek the golem familiar, cut at res 4, 30 px tall (about 3/8 of the knight). His cast is drawn
  // facing you (fists up, slam, rise) and from the side; from behind he just stamps. He is never hurt.
  function derek(key = "derek", folder = "derek", side = [33, 67], front = [33, 62], back = [35, 66]) {
    const set = Object.assign(walking(key, side, front, back, 4), { path: "assets/sprites/" + folder + "/", keys: { [key]: [0, false] } });
    set.views.side.attack = ["side/castUp", "side/castSlam", "side/castSlam"];
    set.views.up.attack = ["back", "back@bob", "back"];
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]]) Object.assign(set.views[dir], { hurt: [p], death: [p, p, p + "@fall"] });
    return set;
  }

  // Fred the mushroom familiar: his attack takes a breath and spits, "heal" raises his arms facing you (a glowcap
  // sprouting), and he wilts under his cap when he dies.
  function fred(key, folder, side, front, back) {
    const set = Object.assign(walking(key, side, front, back, 4), { path: "assets/sprites/" + folder + "/", keys: { [key]: [0, false] } });
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]])
      Object.assign(set.views[dir], { attack: ["attackA", "attackB", "attackB"], heal: ["heal"], hurt: ["side/hurt"], death: ["side/death"], idle: [p] });
    return set;
  }

  // David the wyvern familiar: he always flies, so his walk is a flap (poses B's four wing beats side on, the fly
  // sheets toward and away from you). His attack rears back and spits a bolt, and "roar" is his shriek.
  function wyvern(key, folder, side, front, back) {
    const set = Object.assign(walking(key, side, front, back, 4), { path: "assets/sprites/" + folder + "/", keys: { [key]: [0, false] } });
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]])
      Object.assign(set.views[dir], { attack: ["attackA", "attackB", "attackB"], roar: ["attackC"], hurt: ["side/hurt"], death: ["side/death"], idle: [p] });
    return set;
  }

  // The Mother Wyvern, David's mother (src/wyvern.js), cut at res 4: 95 px standing, wings half spread. She stalks on
  // foot (front and back walk sheets, a step side on) and flies ("fly": four wing beats side on, two toward and away
  // from you). Her other moves are drawn side on only: "rear" gathering a breath, "breath" breathing fire, "rake" a
  // claw, "dive" and "roar" (calling the storm). Feet: the side wing beats share one, the walks theirs.
  function wyvernMother() {
    const set = Object.assign(walking("wyvern", [241, 394], [193, 431], [190, 429], 4), { path: "assets/sprites/wyvern-mother/", keys: { wyvern: [0, false] } });
    Object.assign(set.feet, sheetFeet([1, 2, 3, 4].map((i) => "side/fly" + i), [241, 394]));
    const sideOnly = { rear: ["side/rear"], breath: ["side/breath"], rake: ["side/rake"], attack: ["side/rake"], dive: ["side/dive"], roar: ["side/roar"], hurt: ["side/hurt"], death: ["side/hurt", "side/death", "side/death"] };
    Object.assign(set.views.side, sideOnly, { walk: stepped(["right", "right", "right", "right"]), fly: [1, 1, 2, 2, 3, 3, 4, 4].map((i) => "side/fly" + i + "@-") });
    Object.assign(set.views.down, sideOnly, { fly: ["flyF1", "flyF1", "flyF2", "flyF2"] });
    Object.assign(set.views.up, sideOnly, { fly: ["flyB1", "flyB1", "flyB2", "flyB2"] });
    return set;
  }

  // Kindle the walking lantern, cut at res 4, 32 px tall with his ring. He idles and scuttles in all three
  // views; "attack" is him pouring flame into a lantern, "point" leads the way, and "death" is the broken
  // lantern lying on its side (before he is lit).
  function kindle() {
    const set = Object.assign(walking("kindle", [39, 72], [34, 69], [34, 66], 4), { path: "assets/sprites/kindle/", keys: { kindle: [0, false] } });
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]])
      Object.assign(set.views[dir], { attack: ["pour"], point: [dir === "side" ? "side/point" : p], hurt: ["side/crouch"], death: ["broken"] });
    return set;
  }

  // Abigail the soul wraith, cut at res 4, 28 px tall from hem to hood. She floats (src/render.js lifts her off the
  // ground): her walk is a drift, "attack" raises an arm and throws, "bless" is her blessing (facing you, arms up),
  // and "death" fades her away.
  function abigail(key = "abigail", folder = "abigail", side = [89, 125], front = [68, 121], back = [70, 117]) {
    const set = Object.assign(walking(key, side, front, back, 4), { path: "assets/sprites/" + folder + "/", keys: { [key]: [0, false] } });
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]])
      Object.assign(set.views[dir], { attack: ["side/castUp", "side/throw", "side/throw"], bless: ["bless"], hurt: ["side/hurt"], death: ["side/fade"], idle: [p] });
    // side on she drifts with only the two leaning frames (the upright ones made her bob up and down); she
    // straightens up only when she stops
    set.views.side.walk = [1, 1, 3, 3, 1, 1, 3, 3].map((i) => "side/walk" + i + "@-");
    return set;
  }

  // The Starved Bell, the roaming Abyss boss: the 12 poses and walk sheets, cut at res 4, 56 px tall (shown x1.25).
  // Its attack is rearing back, the lunge with its mouth gaping, and a raking claw.
  function bell() {
    return Object.assign(walking("bell", [202, 227], [148, 227], [113, 232], 4), { path: "assets/sprites/starved-bell/", keys: { bell: [0, false] } });
  }

  // The Deadly Rose, the Abyss garden boss: the 12 poses and walk sheets, cut at res 4, 92 px tall (shown x0.8).
  // Her feet are hidden under her gown, so her walks are a glide, the gown and whip swaying. Her attack is the whip
  // raised, the lash stretched out, and the follow-through; the poses are pinned at the middle of the gown's hem.
  function rose() {
    const set = Object.assign(walking("rose", [342, 407], [239, 430], [318, 375], 4), { path: "assets/sprites/deadly-rose/", keys: { rose: [0, false] } });
    Object.assign(set.feet, { front: [194, 370], back: [191, 370], right: [189, 364], attackA: [200, 376], attackB: [175, 339], attackC: [198, 323],
      "side/hurt": [178, 337], "side/death": [206, 169] });
    return set;
  }

  // The Drowned Colossus, the last wave of Derek's Hollow, cut at res 4, 64 art px tall crouched. It crawls on three side
  // frames; its blow rears a fist and slams it down (seen from the front: both fists up, then down), and it dies collapsing.
  function colossus() {
    const set = Object.assign(walking("colossus", [191, 246], [143, 258], [154, 273], 4), { path: "assets/sprites/colossus/", keys: { colossus: [0, false] } });
    set.views.side.walk = [1, 1, 2, 2, 3, 3, 2, 2].map((i) => "side/walk" + i + "@-");
    set.views.side.attack = ["side/attackA", "side/attackB", "side/attackB"];
    set.views.down.attack = ["stompUp", "stompDown", "stompDown"];
    set.views.up.attack = ["back", "back@bob", "back"];
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]]) Object.assign(set.views[dir], { idle: [p], hurt: ["side/hurt"], death: ["side/hurt", "death", "death"] });
    return set;
  }

  // World and camp sprites: Art.sprites name -> file. Drawn with the bottom centre on the ground, like the coded ones.
  const PLANTS = ["refugeOn", "refugeOff", "sentinelOn", "sentinelOff", "rootOn", "rootOff", "sproutOn", "sproutOff", "sproutOn2", "sproutOff2", "sproutBare", "husk", "gardenOn", "gardenOff",
    "reeds1", "reeds2", "reeds3", "reeds4", "reeds5", "reeds6", "gardenBed1", "gardenBed2", "gardenBed3",
    "swampTree11", "swampTree12", "swampTree13", "swampTree14", "swampTree21", "swampTree22", "swampTree23", "swampTree24", "swampTree31", "swampTree32", "swampTree33", "swampTree34",
    "boulder11", "boulder12", "boulder13", "boulder21", "boulder22", "boulder23", "boulder31", "boulder32", "boulder33", "boulder41", "boulder42", "boulder43",
    "flame1", "flame2", "flame3", "forge1", "forge2", "forge3", "forge4", "armory1", "armory2", "armory3", "armory4", "workbench1", "workbench2", "workbench3", "workbench4", "tower1", "tower2", "tower3", "pylon1", "pylon2", "pylon3", "stake", "palisade", "palisade2", "gatePost", "gatePost2", "palisadeSide", "palisadeSide2", "cornerPost", "cornerPost2", "tent", "banner", "torch", "burnt", "brazier", "fire1", "fire2", "fire3", "fire4", "fire5", "fire6", "iron11", "iron12", "iron13", "iron21", "iron22", "iron23", "iron31", "iron32", "iron33", "amethyst11", "amethyst12", "amethyst13", "amethyst21", "amethyst22", "amethyst23", "amethyst31", "amethyst32", "amethyst33", "resWood", "resStone", "resResin", "resIron", "resPearl", "denGuarded", "denCleared", "caveSealed", "caveOpen", "headstone", "grave", "grave2", "pillar", "soulOrb", "soulFly1", "soulFly2", "roseBriar1", "roseBriar2", "roseBriar3", "roseBriar4", "roseBriar5", "roseLash1", "roseLash2", "roseLash3", "roseWaltz1", "roseWaltz2", "roseWaltz3", "roseWaltz4", "roseBud", "roseWither", "roseBush0", "roseBush1", "roseBush2", "rosePetal1", "rosePetal2", "rosePetal3", "rosePetal4", "rosePetal5", "rosePetal6",
    "kennel1", "kennel2", "kennel3", "workshop1", "workshop2", "workshop3", "shrine1", "shrine2", "shrine3", "toadstool1", "toadstool2", "toadstool3", "fairyRing", "fairyRingWilt", "glowcap1", "glowcap2", "glowcap3", "roost1", "roost2", "roost3", "wyvNest", "wyvNestEmpty", "wyvEgg", "wyvEggHatch", "wyvEggShell",
    "bellTower", "roseHeart1", "roseHeart2", "roseHeart3", "outpost",
    "blackPearl11", "blackPearl12", "blackPearl13", "blackPearl21", "blackPearl22", "blackPearl23", "blackPearl31", "blackPearl32", "blackPearl33", "resBlack",
    // the Chain Reaper's flying sickle, chain and its weight, Violet Snare's ring and the coil on a snared Drowned (src/render.js)
    "reaperSickle1", "reaperSickle2", "reaperSickle3", "reaperSickle4", "reaperChain", "reaperWeight", "reaperSnare", "reaperSnared",
    // Jade Tide's crystals (src/kits.js, drawn in src/render.js)
    "jadeCrystal1", "jadeCrystal2", "jadeCrystal3", "jadeCrystal4",
    // the Frostweaver's owl (standing, flying, casting), its shard, the staff's frost bolts, the Ice Bomb and its spikes (src/kits.js, src/render.js)
    "owlFront", "owlBack", "owlSide", "owlRise", "owlFly1", "owlFly2", "owlFly3", "owlFly4", "owlFly5", "owlCast", "iceShard", "iceBolt", "iceBoltBig", "iceGem", "iceSpike1", "iceSpike2",
    // the Flame Bastion's drawn fire wall, four flickering frames (src/render.js)
    "wallFire1", "wallFire2", "wallFire3", "wallFire4",
    // the Ashen Arbalist's bolts and the burst where a flare lands (src/render.js)
    "arbBolt", "arbFlareBolt", "arbFlare1", "arbFlare2", "arbFlare3", "arbFlare4",
    // the finale (src/finale.js): the Sunken King's body (still, heart open, roaring, dying), his hand, the Drowned Gate
    "fnKingStill", "fnKingOpen", "fnKingRoar", "fnKingDying", "fnHandRest", "fnHandRaised", "fnHandSlam", "fnHandSweep", "fnGate1", "fnGate2", "fnGate3", "fnWall", "fnPost",
    "fnRuinA1", "fnRuinA2", "fnRuinA3", "fnRuinA4", "fnRuinB1", "fnRuinB2", "fnRuinB3", "fnRuinB4",
    "fbFront", "fbBack", "fbSide", "fbCamp", "fbHurl", "fbDown"];
  const PROPS = {
    path: "assets/sprites/",
    // cut at 2 file px per art pixel, like the units
    res: 2,
    files: Object.fromEntries(PLANTS.map((n) => [n, "props/" + n])),
    // The armory and workbench concept art have their own canopies, so the coded awning is hidden once they load.
    hide: { awning: ["rack", "workbench"] },
  };

  const images = {}; // url -> frame { c, w, h, ax, ay }

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = DL.asset(url);
    });
  }
  // Run the loads a few at a time rather than all ~300 at once.
  function loadAll(urls, each, n = 12) {
    const queue = [...urls];
    return Promise.all(Array.from({ length: n }, function next() {
      if (!queue.length) return Promise.resolve();
      const u = queue.shift();
      return loadImage(u).then((img) => { each(u, img); return next(); });
    }));
  }

  function toFrame(img) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const w = c.width, h = c.height, p = g.getImageData(0, 0, w, h).data;
    const op = (x, y) => p[(y * w + x) * 4 + 3] > 0;
    // Centre of the bottom quarter, then the lowest opaque pixel near that centre (skips a blade tip off to one side).
    let sx = 0, n = 0;
    for (let y = Math.floor(h * 0.75); y < h; y++) for (let x = 0; x < w; x++) if (op(x, y)) { sx += x; n++; }
    const ax = n ? Math.round(sx / n) : w >> 1, reach = Math.max(3, Math.round(w * 0.2));
    const near = (y) => { for (let x = Math.max(0, ax - reach); x <= Math.min(w - 1, ax + reach); x++) if (op(x, y)) return true; return false; };
    let ay = h - 1;
    while (ay > 0 && !near(ay)) ay--;
    return { c, w, h, ax, ay: ay + 1 };
  }

  // A frame variant: "bob" one pixel lower, "fall" rotated onto its side, "L1"/"R2"... one foot lifted, "-" unchanged.
  function variant(fr, mod) {
    if (mod === "-") return fr;
    if (mod[0] === "L" || mod[0] === "R") return lift(fr, mod[0] === "R", +mod.slice(1));
    if (mod === "bob") return { c: fr.c, w: fr.w, h: fr.h, ax: fr.ax, ay: fr.ay - (fr.res || 1), res: fr.res };
    const c = document.createElement("canvas");
    c.width = fr.h; c.height = fr.w;
    const g = c.getContext("2d");
    g.translate(fr.h, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(fr.c, 0, 0);
    return { c, w: fr.h, h: fr.w, ax: Math.round(fr.h / 2), ay: fr.w, res: fr.res };
  }

  // Lift one half of the legs (left or right of the foot point) by n art px; the rest of the frame stays.
  function lift(fr, right, n) {
    const res = fr.res || 1, dy = n * res, legs = Math.round(fr.h * 0.2), y0 = fr.ay - legs;
    const x0 = right ? fr.ax : 0, w = right ? fr.w - fr.ax : fr.ax;
    const c = document.createElement("canvas");
    c.width = fr.w; c.height = fr.h;
    const g = c.getContext("2d");
    g.drawImage(fr.c, 0, 0);
    g.clearRect(x0, y0, w, legs);
    g.drawImage(fr.c, x0, y0, w, legs, x0, y0 - dy, w, legs);
    return { c, w: fr.w, h: fr.h, ax: fr.ax, ay: fr.ay, res };
  }

  // Shift a frame toward the drowned look: darker, colder steel and cloth, optionally a cyan lantern.
  function corrupt(fr, t, cyan) {
    if (!t && !cyan) return fr;
    const c = document.createElement("canvas");
    c.width = fr.w; c.height = fr.h;
    const g = c.getContext("2d");
    g.drawImage(fr.c, 0, 0);
    const d = g.getImageData(0, 0, fr.w, fr.h), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      let r = p[i], gr = p[i + 1], b = p[i + 2];
      const glow = r > 150 && r - b > 70;
      if (glow && cyan) { const v = r; r = v * 0.35; gr = v * 0.9; b = v * 0.95; }
      else if (!glow) {
        const l = (r + gr + b) / 3;
        r += (l * 0.45 - r) * t; gr += (l * 0.62 - gr) * t; b += (l * 0.7 - b) * t;
      }
      p[i] = r; p[i + 1] = gr; p[i + 2] = b;
    }
    g.putImageData(d, 0, 0);
    return { c, w: fr.w, h: fr.h, ax: fr.ax, ay: fr.ay, res: fr.res };
  }

  const fileOf = (entry) => entry.split("@")[0];
  const propImage = (name) => images[PROPS.path + PROPS.files[name] + ".png"];

  // Load every listed file, then swap the loaded art into the sprites and sheets already built.
  Art.loadFrames = function () {
    if (!ENABLED) return Promise.resolve();
    const urls = new Set();
    for (const set of UNITS) for (const dir in set.views) for (const anim in set.views[dir])
      for (const e of set.views[dir][anim]) urls.add(set.path + fileOf(e) + ".png");
    for (const name in PROPS.files) urls.add(PROPS.path + PROPS.files[name] + ".png");
    const got = (u, img) => { if (img) images[u] = toFrame(img); };
    // A phone on a patchy connection can drop a few files, and a missing frame leaves that animation
    // in coded art, so the game starts with what arrived and keeps retrying the rest in the background.
    const retry = (n) => {
      const missing = [...urls].filter((u) => !images[u]);
      if (!missing.length || n > 4) return;
      setTimeout(() => loadAll(missing, got, 4).then(() => { if (missing.some((u) => images[u])) apply(); retry(n + 1); }), 1500 * n);
    };
    return loadAll(urls, got).then(() => { apply(); retry(1); });
  };

  // Put the loaded files into the sprites and sheets (again after a retry brings more).
  function apply() {
    for (const set of UNITS) if (set.res) for (const dir in set.views) for (const anim in set.views[dir])
      for (const e of set.views[dir][anim]) { const f = images[set.path + fileOf(e) + ".png"]; if (f) f.res = set.res; }
    for (const set of UNITS) for (const file in set.feet || {}) {
      const f = images[set.path + file + ".png"];
      if (f) [f.ax, f.ay] = set.feet[file];
    }
    for (const name in PROPS.files) {
      const f = propImage(name);
      if (f) Art.sprites[name] = { c: f.c, w: f.w / PROPS.res, h: f.h / PROPS.res, res: PROPS.res };
    }
    for (const name in PROPS.hide)
      if (PROPS.hide[name].every(propImage)) {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        Art.sprites[name] = { c, w: 0, h: 0 };
      }
    for (const key in Art.sheets) Art.applyFrames(key, Art.sheets[key]);
  }

  // Called whenever a coded sheet is built (and for the ones built before loading): swap in loaded frames.
  Art.applyFrames = function (key, sheet) {
    for (const set of UNITS) {
      if (!set.keys[key]) continue;
      const [t, cyan] = set.keys[key];
      for (const dir in set.views) for (const anim in set.views[dir]) {
        const frames = set.views[dir][anim].map((e) => {
          const f = images[set.path + fileOf(e) + ".png"], mod = e.split("@")[1];
          return f && (mod ? variant(f, mod) : f);
        });
        if (frames.every(Boolean)) sheet[dir][anim] = frames.map((f) => corrupt(f, t, cyan));
      }
    }
    return sheet;
  };
})(window.DL);
