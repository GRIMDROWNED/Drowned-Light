/* Drowned Light — hand-drawn sprites loaded from PNG files over the coded art.
   UNITS replace views of a coded unit sheet (src/units.js); PROPS replace world and
   camp sprites (src/art.js). Anything not listed keeps its coded art, and a file that
   fails to load is skipped.
   One PNG per frame at art-pixel size (1 px = 1 art pixel, shown ×2 in game), facing
   right for side views. Frame entries are paths under the set's folder, with optional
   suffixes: "@bob" draws the frame one pixel lower (a step), "@fall" lays it on its side.
   `feet` gives a file's foot point [x, y] in its own pixels; without it the feet are
   guessed from the lowest opaque pixels near the middle of the bottom of the sprite. */
"use strict";
(function (DL) {
  const Art = DL.Art;

  // Kit knights: [how far toward the drowned palette, lantern turns cyan] per corruption stage, as in src/units.js.
  const KNIGHT_STAGES = { lanternBlade1: [0, false], lanternBlade2: [0.22, false], lanternBlade3: [0.5, false], lanternBlade4: [0.8, true], self_lanternBlade: [0.9, true] };

  // A unit from its motion sheet: a pose per view (front, back, right) and three attack frames shared by every view.
  // A single pose walks by stepping ("@bob") and dies by falling ("@fall").
  function motion(extra = {}) {
    const atk = ["attackA", "attackB", "attackC"], views = {};
    for (const [dir, p] of [["down", "front"], ["up", "back"], ["side", "right"]]) {
      views[dir] = Object.assign({
        idle: [p], walk: [p, p + "@bob", p, p + "@bob"], attack: atk,
        dash: [p], hurt: [p], death: [p, p, p + "@fall"],
      }, extra[dir]);
    }
    return views;
  }
  const drowned = (type, views) => ({ path: "assets/sprites/drowned/" + type + "/", keys: { [type]: [0, false] }, views: views || motion() });

  // The knight's side view keeps the walk, dash, hurt and death frames from the Lantern Knight sprite sheet.
  const KNIGHT_SIDE = { dash: ["side/dash"], hurt: ["side/hurt"], death: ["side/hurt", "side/death", "side/death"] };
  const UNITS = [
    {
      path: "assets/sprites/lantern-knight/",
      keys: KNIGHT_STAGES,
      views: motion({
        side: Object.assign({ walk: ["side/walk1", "side/walk2", "side/walk3", "side/walk2"] }, KNIGHT_SIDE),
        down: KNIGHT_SIDE,
        up: KNIGHT_SIDE,
      }),
      feet: {
        "side/walk1": [15, 37], "side/walk2": [12, 37], "side/walk3": [15, 36],
        "side/dash": [20, 36], "side/hurt": [15, 34], "side/death": [25, 37],
      },
    },
    drowned("squire"), drowned("footman"), drowned("archer"), drowned("defiler"), drowned("blackguard"), drowned("champion"),
    drowned("revenant", (() => {
      const v = { idle: ["r0"], walk: ["r0", "r1", "r2", "r3"], attack: ["attackA", "attackB", "attackB"], dash: ["r4"], hurt: ["r5"], death: ["r5", "r5", "r5@fall"] };
      return { down: v, up: v, side: v };
    })()),
  ];

  // World and camp sprites: Art.sprites name -> file. Drawn with the bottom centre on the ground, like the coded ones.
  const PROPS = {
    path: "assets/sprites/",
    files: {
      refugeOn: "plants/refugeOn", refugeOff: "plants/refugeOff", sentinelOn: "plants/sentinelOn", sentinelOff: "plants/sentinelOff",
      rootOn: "plants/rootOn", rootOff: "plants/rootOff", sproutOn: "plants/sproutOn", sproutOff: "plants/sproutOff",
      sproutBare: "plants/sproutBare", husk: "plants/husk",
      rack: "camp/rack", workbench: "camp/workbench", garden: "camp/garden",
      firering: "camp/firering", tower: "camp/tower", palisade: "camp/palisade", pylon: "camp/pylon",
      tree0: "world/tree0", tree1: "world/tree1", reeds: "world/reeds", pillar: "world/pillar", grave: "world/grave",
      driftwood: "world/driftwood", rock: "world/rock",
    },
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

  // A frame variant: "bob" one pixel lower, "fall" rotated onto its side.
  function variant(fr, mod) {
    if (mod === "bob") return { c: fr.c, w: fr.w, h: fr.h, ax: fr.ax, ay: fr.ay - 1 };
    const c = document.createElement("canvas");
    c.width = fr.h; c.height = fr.w;
    const g = c.getContext("2d");
    g.translate(fr.h, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(fr.c, 0, 0);
    return { c, w: fr.h, h: fr.w, ax: Math.round(fr.h / 2), ay: fr.w };
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
    return { c, w: fr.w, h: fr.h, ax: fr.ax, ay: fr.ay };
  }

  const fileOf = (entry) => entry.split("@")[0];
  const propImage = (name) => images[PROPS.path + PROPS.files[name] + ".png"];

  // Load every listed file, then swap the loaded art into the sprites and sheets already built.
  Art.loadFrames = function () {
    const urls = new Set();
    for (const set of UNITS) for (const dir in set.views) for (const anim in set.views[dir])
      for (const e of set.views[dir][anim]) urls.add(set.path + fileOf(e) + ".png");
    for (const name in PROPS.files) urls.add(PROPS.path + PROPS.files[name] + ".png");
    return Promise.all([...urls].map((u) => loadImage(u).then((img) => { if (img) images[u] = toFrame(img); })))
      .then(() => {
        for (const set of UNITS) for (const file in set.feet || {}) {
          const f = images[set.path + file + ".png"];
          if (f) [f.ax, f.ay] = set.feet[file];
        }
        for (const name in PROPS.files) {
          const f = propImage(name);
          if (f) Art.sprites[name] = { c: f.c, w: f.w, h: f.h };
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
