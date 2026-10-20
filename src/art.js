/* Drowned Light — art: the knight atlas, its drowned variants, and procedural pixel sprites. */
"use strict";
(function (DL) {
  const Art = (DL.Art = {
    FW: 240, FH: 336, AX: 120, AY: 314, // atlas frame size + foot anchor
    atlas: null,
    variants: {},
    sprites: {},
  });

  // Atlas columns: down, down-right, right, up-right, up, up-left, left, down-left.
  // Octants from atan2 (0 = east, clockwise on screen) mapped to those columns.
  const OCT2COL = [2, 1, 0, 7, 6, 5, 4, 3];
  Art.col = (angle) => OCT2COL[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];

  // How each Drowned variant recolours the player's armour.
  const VARIANTS = {
    drowned: { dark: 0.5, tint: [0.74, 0.93, 1.12], glow: [60, 235, 245] },
    blackguard: { dark: 0.34, tint: [0.8, 0.86, 1.02], glow: [60, 220, 235] },
    champion: { dark: 0.68, tint: [0.8, 0.96, 1.12], glow: [120, 250, 255] },
    self: { dark: 0.6, tint: [0.84, 0.95, 1.1], glow: [80, 240, 250] },
  };

  Art.load = function () {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { Art.atlas = img; finish(); };
      img.onerror = () => { Art.atlas = fallbackAtlas(); finish(); };
      img.src = "assets/lantern_atlas.png";
      function finish() {
        for (const k in VARIANTS) Art.variants[k] = recolor(Art.atlas, VARIANTS[k]);
        buildSprites();
        resolve();
      }
    });
  };

  // Half-resolution recoloured copy of the atlas. Warm lantern light becomes the abyss's cyan.
  function recolor(img, o) {
    const c = document.createElement("canvas");
    c.width = 960; c.height = 504;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    try {
      g.drawImage(img, 0, 0, 960, 504);
      const d = g.getImageData(0, 0, 960, 504), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const r = p[i], gg = p[i + 1], b = p[i + 2];
        const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
        if (r > 165 && r - b > 85 && gg > 85) {
          const t = Math.min(1.15, lum / 190);
          p[i] = o.glow[0] * t; p[i + 1] = o.glow[1] * t; p[i + 2] = o.glow[2] * t;
        } else {
          const L = lum * o.dark;
          p[i] = Math.min(255, L * o.tint[0] + 4);
          p[i + 1] = Math.min(255, L * o.tint[1] + 9);
          p[i + 2] = Math.min(255, L * o.tint[2] + 14);
        }
      }
      g.putImageData(d, 0, 0);
    } catch (e) {
      // Pixel access is blocked when opened from file:// — fall back to a CSS filter tint.
      g.clearRect(0, 0, 960, 504);
      g.filter = `grayscale(.7) brightness(${o.dark + 0.1}) sepia(.4) hue-rotate(160deg) saturate(1.4)`;
      g.drawImage(img, 0, 0, 960, 504);
      g.filter = "none";
    }
    return c;
  }

  const tmp = document.createElement("canvas");
  tmp.width = 240; tmp.height = 336;
  const tg = tmp.getContext("2d");

  /* Draw one knight frame with its feet at (x, y).
     src: "player" for the original art, or a variant key. scale is relative to the 240×336 frame. */
  Art.drawKnight = function (ctx, src, row, col, x, y, scale, opt = {}) {
    const img = src === "player" ? Art.atlas : Art.variants[src];
    if (!img) return;
    const k = src === "player" ? 1 : 0.5;
    const sw = Art.FW * k, sh = Art.FH * k, sx = col * sw, sy = row * sh;
    const dw = Art.FW * scale, dh = Art.FH * scale;
    const dx = x - Art.AX * scale, dy = y - Art.AY * scale;
    const clipH = opt.clip != null ? Math.max(0, Math.min(1, opt.clip)) : 1; // fraction visible from top (for rising)
    ctx.save();
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    if (opt.flash) {
      tg.clearRect(0, 0, 240, 336);
      tg.globalCompositeOperation = "source-over";
      tg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      tg.globalCompositeOperation = "source-atop";
      tg.fillStyle = opt.flashColor || "#fff";
      tg.globalAlpha = Math.min(1, opt.flash);
      tg.fillRect(0, 0, sw, sh);
      tg.globalAlpha = 1;
      tg.globalCompositeOperation = "source-over";
      ctx.drawImage(tmp, 0, 0, sw, sh * clipH, dx, dy, dw, dh * clipH);
    } else {
      ctx.drawImage(img, sx, sy, sw, sh * clipH, dx, dy, dw, dh * clipH);
    }
    ctx.restore();
  };

  // A plain hooded knight drawn in code, used only if assets/lantern_atlas.png is missing.
  function fallbackAtlas() {
    const c = document.createElement("canvas");
    c.width = 1920; c.height = 1008;
    const g = c.getContext("2d");
    const dirs = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
      const ox = i * 240 + 120, oy = r * 336 + 310, [dx, dy] = dirs[i];
      g.fillStyle = "#3b3530"; g.fillRect(ox - 30 + (r === 1 ? 8 : 0), oy - 60, 22, 60); g.fillRect(ox + 8 - (r === 1 ? 8 : 0), oy - 60, 22, 60);
      g.fillStyle = "#d8c9ae"; g.beginPath(); g.moveTo(ox, oy - 250); g.lineTo(ox + 75, oy - 40); g.lineTo(ox - 75, oy - 40); g.fill();
      g.fillStyle = "#8b8f94"; g.fillRect(ox - 35, oy - 190, 70, 110);
      g.fillStyle = "#e8dcc4"; g.beginPath(); g.arc(ox, oy - 210, 42, 0, Math.PI * 2); g.fill();
      if (dy >= 0) { g.fillStyle = "#1a1a1a"; g.fillRect(ox - 18 + dx * 12, oy - 220, 36, 26); }
      g.fillStyle = "#ffb54a"; g.fillRect(ox + 60 * (dx || 1) - 12, oy - 120, 24, 32);
      g.strokeStyle = "#cfd3d6"; g.lineWidth = 10; g.beginPath(); g.moveTo(ox - 50, oy - 110); g.lineTo(ox - 70 - dx * 20, oy - 10); g.stroke();
    }
    return c;
  }

  /* ---------------- Procedural pixel sprites ----------------
     Drawn small, alpha-thresholded, outlined, then upscaled ×2 with no smoothing. */
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mk(w, h, fn, outline = "#07090a") {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const P = {
      rect(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); },
      ell(x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); },
      line(pts, lw, col) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.stroke();
      },
      curve(x0, y0, cx, cy, x1, y1, lw, col) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
      },
      poly(pts, col) {
        g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.closePath(); g.fill();
      },
      px(x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); },
    };
    fn(P, w, h);
    const d = g.getImageData(0, 0, w, h), p = d.data;
    for (let i = 3; i < p.length; i += 4) p[i] = p[i] > 100 ? 255 : 0;
    if (outline) {
      const [or, og, ob] = hexRgb(outline);
      const a = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) a[i] = p[i * 4 + 3] ? 1 : 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (a[i]) continue;
        if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) {
          p[i * 4] = or; p[i * 4 + 1] = og; p[i * 4 + 2] = ob; p[i * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(d, 0, 0);
    return { c, w, h };
  }

  const C = {
    bark: "#3a3028", barkHi: "#56483a", barkDk: "#241d18", moss: "#2f4a38", mossHi: "#456b48",
    stone: "#4c5052", stoneHi: "#6e7476", stoneLt: "#8c9294", stoneDk: "#32363a",
    glow: "#7ff6ff", glowCore: "#e9ffff", glowDim: "#1d4d55", glowMid: "#36a9b4",
    root: "#3b2a1e", rootHi: "#5a4130", cloth: "#b3a68c", clothDk: "#7d725f",
    rust: "#7c4a32", rustHi: "#9a6040", iron: "#5d6266", ironHi: "#8c9397", wood: "#5a4230", woodHi: "#86663f", woodEnd: "#9c7c55",
  };

  function bulb(P, x, y, on, s = 1) {
    P.line([x, y - 4 * s, x, y - 1], 1, C.rootHi);
    P.ell(x, y + 3 * s, 3.4 * s, 4.4 * s, on ? C.glowMid : C.glowDim);
    if (on) { P.ell(x, y + 3 * s, 2.2 * s, 3 * s, C.glow); P.rect(x - 1, y + 1 * s, 2, 2 * s, C.glowCore); }
    P.line([x - 3 * s, y + 3 * s, x + 3 * s, y + 3 * s], 1, on ? "#2d7b84" : "#173a40");
  }
  function flowers(P, pts, on) {
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      P.rect(x - 1, y, 3, 1, on ? C.glow : C.glowDim); P.rect(x, y - 1, 1, 3, on ? C.glow : C.glowDim);
      if (on) P.px(x, y, C.glowCore);
    }
  }
  function grass(P, x, y, n, col = "#2c4230") {
    for (let i = 0; i < n; i++) P.line([x + i * 2, y, x + i * 2 + (i % 2 ? 1 : -1), y - 3 - (i % 3)], 1, col);
  }

  function buildSprites() {
    const S = Art.sprites;

    const tree = (seed) => mk(44, 66, (P) => {
      const lean = seed ? 4 : -3;
      P.line([22, 65, 21 + lean * 0.3, 46, 22 + lean, 26], 7, C.bark);
      P.line([20, 64, 19 + lean * 0.3, 46, 20 + lean, 28], 2, C.barkHi);
      P.line([22 + lean, 30, 10, 16, 5, 17], 3, C.bark);
      P.line([22 + lean, 27, 33, 13, 38, 6], 3, C.bark);
      P.line([21, 40, 8, 33, 4, 36], 2, C.bark);
      P.line([23 + lean, 24, 25 + lean, 8], 2, C.bark);
      P.line([33, 13, 40, 15], 1, C.barkHi);
      P.line([10, 16, 9, 9], 1, C.bark);
      if (seed) P.line([24, 46, 36, 38, 41, 40], 2, C.bark);
      for (const [x, y, l] of [[9, 17, 6], [34, 14, 8], [6, 34, 5], [26, 10, 4], [37, 8, 5]]) P.rect(x, y, 1, l, C.moss);
      P.rect(14, 62, 16, 3, C.barkDk);
    });
    S.tree0 = tree(0);
    S.tree1 = tree(1);

    S.pillar = mk(22, 46, (P) => {
      P.rect(3, 40, 16, 6, C.stoneDk);
      P.poly([5, 41, 5, 10, 8, 6, 11, 9, 14, 4, 17, 8, 17, 41], C.stone);
      P.rect(6, 10, 3, 31, C.stoneHi);
      P.line([12, 14, 11, 20, 13, 26], 1, C.stoneDk);
      P.rect(14, 30, 3, 6, C.moss); P.rect(5, 34, 4, 4, C.moss); P.rect(15, 9, 2, 4, C.mossHi);
    });

    S.grave = mk(14, 20, (P) => {
      P.poly([2, 19, 2, 6, 7, 1, 12, 6, 12, 19], C.stone);
      P.rect(3, 6, 2, 13, C.stoneHi);
      P.rect(6, 6, 2, 9, C.stoneDk); P.rect(4, 8, 6, 2, C.stoneDk);
      P.rect(1, 17, 3, 2, C.moss);
    });

    S.reeds = mk(16, 18, (P) => {
      for (let i = 0; i < 7; i++) P.line([2 + i * 2, 17, 1 + i * 2 + (i % 3) - 1, 5 + (i * 5) % 6], 1, i % 2 ? "#2c3d2c" : "#3e5236");
      P.rect(4, 4, 2, 4, "#5a4030"); P.rect(10, 6, 2, 4, "#5a4030");
    });

    S.driftwood = mk(30, 16, (P) => {
      P.rect(3, 7, 22, 5, C.wood); P.rect(3, 7, 22, 1, C.woodHi);
      P.rect(8, 3, 19, 5, C.wood); P.rect(8, 3, 19, 1, C.woodHi);
      P.ell(4, 9.5, 2.5, 2.5, C.woodEnd); P.ell(26, 5.5, 2.5, 2.5, C.woodEnd);
      P.px(4, 9, C.wood); P.px(26, 5, C.wood);
      P.line([14, 3, 12, 0], 1, C.wood);
    });

    S.rock = mk(26, 18, (P) => {
      P.ell(13, 11, 11, 6, C.stoneDk);
      P.ell(11, 9, 8, 6, C.stone); P.ell(19, 11, 5, 4, C.stone);
      P.ell(9, 7, 4, 3, C.stoneHi); P.rect(7, 5, 2, 1, C.stoneLt); P.rect(18, 9, 2, 1, C.stoneHi);
      P.rect(3, 12, 5, 2, C.moss); P.rect(16, 14, 4, 1, C.moss);
    });

    S.ironpile = mk(30, 20, (P) => {
      P.line([3, 16, 26, 9], 2, C.ironHi); P.line([24, 9, 28, 8], 3, C.rust);
      P.ell(10, 13, 6, 5, C.iron); P.rect(6, 12, 8, 2, "#1d2023"); P.rect(8, 9, 3, 2, C.ironHi);
      P.poly([16, 18, 18, 10, 26, 11, 25, 18], C.rust); P.rect(19, 12, 4, 1, C.rustHi);
      P.rect(2, 17, 6, 2, C.rust);
    });

    const sprout = (state) => mk(22, 30, (P) => {
      const on = state === 2;
      P.curve(11, 29, 4, 18, 12, 8, 2, C.root);
      P.curve(12, 8, 18, 4, 16, 11, 2, C.root);
      P.line([9, 29, 6, 24], 1, C.rootHi);
      grass(P, 3, 29, 4, "#2b3e2c");
      if (state) { bulb(P, 16, 12, on, 0.9); flowers(P, [5, 25, 15, 26], on); }
      else P.rect(15, 11, 2, 2, C.rootHi);
    });
    S.sproutBare = sprout(0); S.sproutOff = sprout(1); S.sproutOn = sprout(2);

    const refuge = (on) => mk(42, 58, (P) => {
      P.curve(9, 57, -2, 26, 20, 8, 5, C.root);
      P.curve(20, 8, 38, 2, 35, 24, 4, C.root);
      P.curve(35, 24, 33, 40, 37, 57, 4, C.root);
      P.curve(10, 55, 4, 30, 19, 10, 1, C.rootHi);
      P.curve(14, 57, 18, 46, 30, 52, 2, C.root);
      P.line([25, 6, 26, 15], 1, C.rootHi);
      bulb(P, 26, 18, on, 1.5);
      if (on) { bulb(P, 12, 30, true, 0.8); flowers(P, [6, 52, 14, 49, 28, 54, 34, 50, 20, 55], true); }
      else flowers(P, [14, 52, 28, 54], false);
      grass(P, 3, 57, 5, "#2b3e2c"); grass(P, 30, 57, 5, "#2b3e2c");
    });
    S.refugeOff = refuge(false); S.refugeOn = refuge(true);

    const sentinel = (on) => mk(40, 44, (P) => {
      P.curve(8, 43, 14, 30, 20, 26, 3, C.root); P.curve(32, 43, 26, 32, 20, 26, 3, C.root);
      P.line([20, 43, 20, 26], 3, C.root);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.48, r0 = 7, r1 = on ? 19 : 12;
        const cx = 20, cy = 22;
        P.poly([cx + Math.cos(a - 0.18) * r0, cy + Math.sin(a - 0.18) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
          cx + Math.cos(a + 0.18) * r0, cy + Math.sin(a + 0.18) * r0], on ? "#bff8ff" : "#2c5560");
      }
      P.ell(20, 22, 6, 6, on ? C.glowMid : C.glowDim);
      if (on) { P.ell(20, 22, 4, 4, C.glow); P.rect(19, 21, 2, 2, C.glowCore); }
      grass(P, 6, 43, 4); grass(P, 26, 43, 4);
    });
    S.sentinelOff = sentinel(false); S.sentinelOn = sentinel(true);

    const root = (on) => mk(88, 68, (P) => {
      const r = [[6, 67, 14, 30, 40, 18], [82, 67, 76, 28, 48, 16], [24, 67, 30, 40, 44, 24], [64, 67, 58, 42, 44, 24],
        [44, 67, 40, 46, 44, 20], [14, 50, 30, 54, 44, 46], [74, 52, 58, 56, 44, 46]];
      for (const [a, b, c, d, e, f] of r) P.curve(a, b, c, d, e, f, 5, C.root);
      for (const [a, b, c, d, e, f] of r.slice(0, 4)) P.curve(a - 1, b, c - 1, d, e - 1, f, 1, C.rootHi);
      P.curve(40, 18, 30, 4, 18, 10, 3, C.root); P.curve(48, 16, 60, 2, 70, 12, 3, C.root);
      bulb(P, 44, 20, on, 2.2); bulb(P, 19, 14, on, 1.2); bulb(P, 69, 16, on, 1.2);
      flowers(P, on ? [10, 62, 20, 58, 30, 64, 58, 63, 68, 58, 78, 63, 40, 60, 50, 64] : [20, 62, 68, 62], on);
    });
    S.rootOff = root(false); S.rootOn = root(true);

    S.husk = mk(40, 52, (P) => {
      P.curve(8, 51, 2, 28, 18, 12, 4, "#3a332d");
      P.curve(18, 12, 34, 6, 32, 28, 3, "#3a332d");
      P.curve(8, 51, 4, 30, 17, 14, 1, "#544a41");
      P.line([31, 28, 33, 36], 1, "#544a41");
      P.poly([30, 36, 36, 36, 35, 44, 31, 44], "#5c6264"); P.line([29, 38, 36, 44], 1, "#2a2f31");
      P.line([12, 51, 20, 47, 30, 51], 2, "#3a332d");
      P.rect(14, 48, 2, 2, "#3f5f63");
    });

    S.pearl = mk(12, 12, (P) => {
      P.ell(6, 6, 4.5, 4.5, "#7f6fc0"); P.ell(5.5, 5.5, 3.5, 3.5, "#c9b8ff"); P.rect(4, 3, 2, 2, "#ffffff");
    });

    S.firering = mk(38, 22, (P) => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        P.ell(19 + Math.cos(a) * 14, 12 + Math.sin(a) * 7, 3, 2.2, i % 2 ? C.stoneDk : C.stone);
      }
      P.line([9, 15, 29, 9], 3, C.wood); P.line([10, 9, 28, 15], 3, C.woodHi);
      P.ell(19, 12, 6, 3, "#1a120c");
    });

    S.tent = mk(48, 36, (P) => {
      P.poly([2, 34, 24, 3, 46, 34], C.cloth);
      P.poly([24, 3, 46, 34, 30, 34], C.clothDk);
      P.poly([17, 34, 24, 14, 28, 34], "#1b1611");
      P.line([24, 1, 24, 6], 2, C.wood);
      P.line([6, 30, 10, 24, 14, 29], 1, C.clothDk); P.rect(34, 20, 4, 3, "#8e8370");
      P.rect(1, 33, 4, 2, C.wood); P.rect(43, 33, 4, 2, C.wood);
    });

    S.anvil = mk(26, 22, (P) => {
      P.rect(8, 12, 10, 9, C.root); P.rect(8, 12, 10, 1, C.rootHi);
      P.poly([3, 6, 23, 6, 20, 11, 6, 11], "#3e4246"); P.rect(3, 6, 20, 2, "#70767c"); P.poly([1, 6, 4, 6, 4, 9], "#3e4246");
      P.line([20, 3, 25, 0], 2, C.wood);
    });

    S.rack = mk(28, 36, (P) => {
      P.rect(3, 6, 2, 30, C.wood); P.rect(23, 6, 2, 30, C.wood); P.rect(2, 8, 24, 2, C.woodHi); P.rect(2, 24, 24, 2, C.wood);
      P.line([9, 34, 9, 2], 1, C.ironHi); P.poly([8, 3, 9, 0, 10, 3], C.ironHi);
      P.ell(17, 18, 6, 8, "#7a2e2a"); P.ell(17, 18, 4, 6, "#5e2421"); P.rect(16, 11, 2, 15, "#8c9397");
    });

    S.lanternpost = mk(18, 44, (P) => {
      P.rect(7, 6, 3, 38, C.wood); P.rect(7, 6, 1, 38, C.woodHi); P.rect(9, 6, 7, 2, C.wood);
      P.rect(12, 9, 5, 7, "#2a2622"); P.rect(13, 10, 3, 5, "#ffcf7a"); P.rect(14, 11, 1, 3, "#fff3c4");
      P.rect(5, 41, 7, 3, C.root);
    });

    S.tower = mk(38, 64, (P) => {
      P.line([8, 63, 12, 24], 3, C.wood); P.line([30, 63, 26, 24], 3, C.wood);
      P.line([10, 48, 28, 36], 2, C.woodHi); P.line([28, 48, 10, 36], 2, C.woodHi);
      P.rect(6, 22, 26, 6, C.wood); P.rect(6, 22, 26, 2, C.woodEnd);
      P.rect(7, 12, 2, 10, C.wood); P.rect(29, 12, 2, 10, C.wood);
      P.poly([3, 13, 19, 2, 35, 13], C.clothDk); P.poly([19, 2, 35, 13, 26, 13], "#5f574a");
      P.line([12, 19, 26, 19], 2, C.iron); P.line([19, 15, 19, 23], 1, C.ironHi);
    });

    S.stake = mk(8, 18, (P) => {
      P.poly([2, 17, 2, 5, 4, 0, 6, 5, 6, 17], C.wood); P.rect(2, 5, 1, 12, C.woodHi);
    });

    S.torch = mk(8, 26, (P) => {
      P.rect(3, 6, 2, 20, C.wood); P.rect(3, 6, 1, 20, C.woodHi);
      P.rect(2, 3, 4, 5, "#4a3626"); P.rect(2, 5, 4, 1, "#2a1d14");
      P.rect(1, 24, 6, 2, C.root);
    });
    S.burnt = mk(8, 14, (P) => {
      P.rect(3, 3, 2, 11, "#231d18"); P.rect(2, 1, 4, 3, "#151210"); P.rect(3, 2, 1, 1, "#6a2a14");
    });
    S.brazier = mk(20, 20, (P) => {
      P.line([5, 19, 8, 11], 2, C.iron); P.line([15, 19, 12, 11], 2, C.iron); P.line([10, 19, 10, 11], 2, C.iron);
      P.poly([2, 6, 18, 6, 15, 12, 5, 12], "#3e4246"); P.rect(2, 6, 16, 1, "#70767c"); P.rect(4, 4, 12, 2, "#2a1d14");
    });
  }

  // Animated pixel fire, base at (x, y). size ~ 1 for a torch, 2–3 for the camp flame.
  Art.drawFire = function (ctx, x, y, size, t, cool) {
    const cols = cool ? ["#1c7f8a", "#3fd6e0", "#c9fbff"] : ["#d9561f", "#ffa23a", "#ffe6a6"];
    const u = 2 * size;
    for (let layer = 0; layer < 3; layer++) {
      const h = (7 - layer * 2) * size, w = (4 - layer) * size;
      ctx.fillStyle = cols[layer];
      for (let i = -w; i <= w; i += u * 0.5) {
        const k = 1 - Math.abs(i) / (w + 0.01);
        const fh = h * k * (0.75 + 0.35 * Math.sin(t * 13 + i * 1.7 + layer * 2 + x));
        ctx.fillRect(Math.round(x + i), Math.round(y - fh * 2.2), Math.ceil(u * 0.5), Math.ceil(fh * 2.2));
      }
    }
  };
})(window.DL);
