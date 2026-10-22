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
    Object.assign(walking("ashenArbalist", [57, 81], [35, 85], [42, 86]), { path: "assets/sprites/ashen-arbalist/", keys: stages("ashenArbalist") }),
    Object.assign(walking("relicBearer", [57, 105], [39, 101], [40, 101]), { path: "assets/sprites/relic-bearer/", keys: stages("relicBearer") }),
    Object.assign(walking("flameBastion", [53, 86], [37, 86], [34, 86]), { path: "assets/sprites/flame-bastion/", keys: stages("flameBastion") }),
  ];

  // World and camp sprites: Art.sprites name -> file. Drawn with the bottom centre on the ground, like the coded ones.
  const PLANTS = ["refugeOn", "refugeOff", "sentinelOn", "sentinelOff", "rootOn", "rootOff", "sproutOn", "sproutOff", "sproutBare", "husk", "gardenOn", "gardenOff",
    "reeds1", "reeds2", "reeds3", "reeds4", "reeds5", "reeds6", "gardenBed1", "gardenBed2", "gardenBed3",
    "swampTree1", "swampTree2", "swampTree3",
    "boulder11", "boulder12", "boulder13", "boulder21", "boulder22", "boulder23", "boulder31", "boulder32", "boulder33", "boulder41", "boulder42", "boulder43",
    "flame1", "flame2", "flame3", "forge1", "forge2", "forge3", "forge4", "armory1", "armory2", "armory3", "armory4", "workbench1", "workbench2", "workbench3", "workbench4", "tower1", "tower2", "tower3", "pylon1", "pylon2", "pylon3", "stake", "palisade", "palisade2", "gatePost", "gatePost2", "tent", "banner"];
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
      img.src = url;
    });
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
    return Promise.all([...urls].map((u) => loadImage(u).then((img) => { if (img) images[u] = toFrame(img); })))
      .then(() => {
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
      });
  };

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
