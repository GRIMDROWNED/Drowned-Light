/* Drowned Light — hand-drawn sprite frames loaded from PNG files.
   Each set replaces some views of a coded sheet (src/units.js); anything a set
   doesn't list keeps its coded frames, and a file that fails to load is skipped.
   One PNG per frame, drawn at art-pixel size (1 px = 1 art pixel, shown ×2 in game),
   facing right for the side view. `feet` gives each file's foot point [x, y] in its
   own pixels, so frames of different sizes line up; without it the feet are guessed
   from the lowest opaque rows. */
"use strict";
(function (DL) {
  const Art = DL.Art;

  // Corruption stages, matching the coded knight: how far toward the drowned palette, and whether the lantern turns cyan.
  const STAGES = { 1: [0, false], 2: [0.22, false], 3: [0.5, false], 4: [0.8, true] };

  const SETS = [
    {
      kit: "lanternBlade",
      path: "assets/sprites/lantern-knight/",
      views: {
        side: {
          idle: ["idle"],
          walk: ["walk1", "walk2", "walk3", "walk2"],
          attack: ["attack1", "attack2", "attack2"],
          dash: ["dash"],
          hurt: ["hurt"],
          death: ["hurt", "death", "death"],
        },
      },
      feet: {
        "side/idle": [14, 38], "side/walk1": [15, 37], "side/walk2": [12, 37], "side/walk3": [15, 36],
        "side/attack1": [16, 36], "side/attack2": [22, 39], "side/dash": [20, 36], "side/hurt": [15, 34], "side/death": [25, 37],
      },
    },
  ];

  const images = {}; // url -> frame { c, w, h, ax, ay }, filled by Art.loadFrames

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
    const p = g.getImageData(0, 0, c.width, c.height).data;
    const op = (x, y) => p[(y * c.width + x) * 4 + 3] > 0;
    let ay = c.height - 1;
    while (ay > 0 && ![...Array(c.width).keys()].some((x) => op(x, ay))) ay--;
    let sx = 0, n = 0;
    for (let y = Math.max(0, ay - 3); y <= ay; y++) for (let x = 0; x < c.width; x++) if (op(x, y)) { sx += x; n++; }
    return { c, w: c.width, h: c.height, ax: n ? Math.round(sx / n) : c.width >> 1, ay: ay + 1 };
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

  Art.loadFrames = function () {
    const urls = new Set();
    for (const set of SETS) for (const dir in set.views) for (const anim in set.views[dir])
      for (const name of set.views[dir][anim]) urls.add(set.path + dir + "/" + name + ".png");
    return Promise.all([...urls].map((u) => loadImage(u).then((img) => { if (img) images[u] = toFrame(img); })))
      .then(() => {
        for (const set of SETS) for (const file in set.feet || {}) {
          const f = images[set.path + file + ".png"];
          if (f) [f.ax, f.ay] = set.feet[file];
        }
      });
  };

  // Called whenever a coded sheet is built: swap in any loaded frames for that sheet's key.
  Art.applyFrames = function (key, sheet) {
    for (const set of SETS) {
      let t = 0, cyan = false;
      if (key === "self_" + set.kit) { t = 0.9; cyan = true; }
      else if (key.startsWith(set.kit) && STAGES[key.slice(set.kit.length)]) [t, cyan] = STAGES[key.slice(set.kit.length)];
      else continue;
      for (const dir in set.views) for (const anim in set.views[dir]) {
        const names = set.views[dir][anim];
        const frames = names.map((n) => images[set.path + dir + "/" + n + ".png"]);
        if (frames.every(Boolean)) sheet[dir][anim] = frames.map((f) => corrupt(f, t, cyan));
      }
    }
    return sheet;
  };
})(window.DL);
