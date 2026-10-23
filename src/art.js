/* Drowned Light — art: procedural pixel sprites for the world, camp and effects.
   Knights (player and Drowned) are painted in src/units.js. */
"use strict";
(function (DL) {
  const Art = (DL.Art = { sprites: {}, sheets: {} });

  Art.load = function () {
    buildSprites();
    Art.buildUnits();
    return Art.loadFrames();
  };

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
      // crisp 1px Bresenham line
      seg(x0, y0, x1, y1, col) {
        g.fillStyle = col;
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx + dy;
        for (;;) {
          g.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * e;
          if (e2 >= dy) { e += dy; x0 += sx; }
          if (e2 <= dx) { e += dx; y0 += sy; }
        }
      },
      g,
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
  Art.mk = mk;

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

    // The Bone Wolf den (coded stand-in until its drawn art arrives): a low earth-and-rock mound with a black
    // mouth facing you, ribs and bones strewn round it, a big skull on top.
    S.boneDen = mk(76, 48, (P) => {
      const bone = "#cfc3a2", boneDk = "#8f846b", earth = "#3a3128", earthHi = "#52463a";
      P.ell(38, 34, 36, 14, earth);
      P.ell(38, 26, 30, 18, earth);
      P.ell(30, 20, 16, 11, earthHi);
      P.poly([8, 34, 12, 22, 20, 24, 18, 36], C.stoneDk);
      P.poly([56, 36, 60, 22, 68, 26, 70, 36], C.stone);
      P.rect(60, 24, 3, 8, C.stoneHi);
      P.poly([14, 22, 20, 14, 26, 18, 22, 26], C.stone);
      // the mouth
      P.ell(38, 37, 13, 10, "#0b0908");
      P.rect(25, 37, 26, 9, "#0b0908");
      P.ell(38, 38, 9, 7, "#020202");
      // jaw-like stones framing it
      for (let i = 0; i < 5; i++) P.poly([27 + i * 5, 28 + Math.abs(i - 2), 29 + i * 5, 32 + Math.abs(i - 2), 31 + i * 5, 28 + Math.abs(i - 2)], bone);
      // ribs arching over the mound
      for (let i = 0; i < 4; i++) P.curve(22 + i * 8, 30, 24 + i * 8, 6 + i, 30 + i * 8, 14 + (i % 2) * 3, 2, i % 2 ? boneDk : bone);
      // the skull on top
      P.ell(40, 9, 7, 5, bone);
      P.rect(36, 11, 9, 4, bone);
      P.rect(37, 8, 2, 2, "#140f0c"); P.rect(42, 8, 2, 2, "#140f0c");
      P.rect(38, 14, 1, 2, boneDk); P.rect(41, 14, 1, 2, boneDk);
      // bones strewn on the ground
      P.line([4, 42, 12, 40], 2, bone); P.rect(3, 41, 2, 2, bone); P.rect(12, 39, 2, 2, bone);
      P.line([60, 44, 70, 43], 2, boneDk); P.rect(69, 42, 2, 2, bone);
      P.line([16, 46, 22, 44], 1, bone);
      P.rect(52, 45, 3, 2, bone);
      grass(P, 6, 36, 3, "#2c4230"); grass(P, 64, 38, 3, "#2c4230");
      P.rect(48, 18, 4, 3, C.moss); P.rect(20, 28, 3, 2, C.mossHi);
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

    /* ---- base camp (see the Base Camp concept sheet) ---- */
    const sigil = "#e0913a", bannerCloth = "#2a2f36", bannerTrim = "#7a5a3a";
    S.banner = mk(16, 46, (P) => {
      P.rect(7, 0, 2, 46, C.wood); P.rect(7, 0, 1, 46, C.woodHi);
      P.rect(1, 3, 14, 2, C.wood);
      P.poly([2, 5, 14, 5, 14, 30, 12, 27, 10, 32, 8, 27, 6, 32, 4, 27, 2, 30], bannerCloth);
      P.rect(2, 5, 12, 1, bannerTrim);
      P.rect(6, 10, 4, 1, sigil); P.rect(5, 11, 1, 6, sigil); P.rect(10, 11, 1, 6, sigil); P.rect(6, 17, 4, 1, sigil);
      P.rect(7, 8, 2, 13, sigil);
      P.rect(5, 43, 6, 3, C.stoneDk);
    });

    S.firepit2 = mk(50, 28, (P) => {
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        P.ell(25 + Math.cos(a) * (19 - ring * 2), 15 + Math.sin(a) * (9 - ring) - ring * 3, 3.4, 2.6, (i + ring) % 2 ? C.stoneDk : C.stone);
      }
      P.ell(25, 14, 11, 5, "#1a120c");
      P.line([14, 17, 36, 10], 3, C.wood); P.line([15, 10, 35, 17], 3, C.woodHi);
    });

    S.brazierBig = mk(46, 40, (P) => {
      P.poly([8, 39, 12, 26, 34, 26, 38, 39], C.stone);
      P.rect(12, 26, 22, 2, C.stoneHi); P.rect(10, 34, 26, 1, C.stoneDk);
      P.poly([3, 12, 43, 12, 37, 26, 9, 26], "#3a3e42");
      P.rect(3, 12, 40, 2, "#7a8086");
      P.rect(8, 17, 30, 1, "#2a2d30");
      for (const x of [9, 19, 29]) P.rect(x, 15, 2, 9, "#565c62");
      P.rect(6, 9, 34, 3, "#1a120c");
    });

    S.forge = mk(44, 42, (P) => {
      P.rect(20, 0, 9, 16, C.stoneDk); P.rect(20, 0, 9, 2, C.stone); P.rect(22, 3, 2, 10, C.stone);
      P.poly([3, 41, 4, 14, 33, 14, 34, 41], C.stone);
      P.rect(4, 14, 30, 2, C.stoneHi);
      for (let y = 20; y < 40; y += 6) P.rect(4, y, 30, 1, C.stoneDk);
      P.poly([9, 38, 9, 27, 13, 23, 22, 23, 26, 27, 26, 38], "#1a0e08");
      P.rect(11, 30, 13, 8, "#ff8a2a"); P.rect(13, 32, 9, 5, "#ffd27a");
      P.rect(34, 30, 8, 3, "#3e4246"); P.rect(34, 30, 8, 1, "#70767c"); P.rect(36, 33, 4, 8, C.root);
    });

    S.awning = mk(48, 36, (P) => {
      P.rect(4, 8, 2, 28, C.wood); P.rect(42, 8, 2, 28, C.wood);
      P.poly([1, 10, 8, 2, 40, 2, 47, 10], C.cloth);
      P.poly([24, 2, 40, 2, 47, 10, 30, 10], C.clothDk);
      for (let x = 1; x < 47; x += 6) P.poly([x, 10, x + 6, 10, x + 3, 14], x % 12 === 1 ? C.cloth : C.clothDk);
    });

    S.workbench = mk(36, 30, (P) => {
      P.rect(4, 16, 2, 13, C.wood); P.rect(30, 16, 2, 13, C.wood);
      P.rect(2, 13, 32, 4, C.wood); P.rect(2, 13, 32, 1, C.woodEnd);
      P.rect(10, 22, 16, 7, C.root); P.rect(10, 22, 16, 1, C.rootHi); P.rect(17, 22, 1, 7, C.barkDk);
      P.line([6, 12, 12, 9], 2, C.iron); P.rect(5, 10, 3, 3, C.ironHi);
      P.rect(14, 11, 7, 2, C.woodHi); P.rect(15, 10, 1, 1, C.iron);
      P.rect(25, 5, 5, 8, "#2a2622"); P.rect(26, 7, 3, 5, "#ffcf7a"); P.rect(27, 8, 1, 3, "#fff3c4"); P.rect(27, 3, 1, 2, C.iron);
    });

    S.garden = mk(56, 36, (P) => {
      P.rect(3, 8, 50, 26, "#24180f");
      for (let y = 12; y < 34; y += 5) P.rect(5, y, 46, 2, "#3a2a1c");
      for (const x of [2, 18, 36, 52]) { P.rect(x, 4, 2, 31, C.wood); P.rect(x, 4, 1, 2, C.woodEnd); }
      P.rect(2, 7, 52, 1, C.woodHi); P.rect(2, 20, 52, 1, C.wood); P.rect(2, 33, 52, 1, C.wood);
    });

    S.pylon = mk(18, 56, (P) => {
      P.rect(7, 4, 4, 48, C.wood); P.rect(7, 4, 1, 48, C.woodHi);
      P.rect(1, 6, 16, 2, C.wood); P.rect(8, 1, 2, 4, C.iron);
      P.seg(3, 8, 3, 11, C.iron); P.seg(14, 8, 14, 11, C.iron);
      for (const x of [1, 12]) { P.rect(x, 11, 5, 7, "#2a2622"); P.rect(x + 1, 12, 3, 5, "#3b2d20"); }
      P.ell(9, 52, 6, 3, C.stoneDk); P.rect(4, 50, 10, 3, C.stone);
    });

    S.palisade = mk(28, 32, (P) => {
      for (let i = 0; i < 5; i++) {
        const x = i * 5 + 1, top = 3 + (i % 2) * 2;
        P.poly([x, 32, x, top + 3, x + 2, top, x + 4, top + 3, x + 4, 32], i % 2 ? C.wood : "#4e3a29");
        P.rect(x, top + 3, 1, 28 - top, C.woodHi);
      }
      P.rect(0, 13, 28, 2, C.barkDk); P.rect(0, 24, 28, 2, C.barkDk);
    });

    S.gatePost = mk(14, 50, (P) => {
      P.poly([2, 50, 2, 6, 7, 0, 12, 6, 12, 50], C.wood);
      P.rect(3, 6, 2, 44, C.woodHi);
      P.rect(2, 14, 10, 2, C.iron); P.rect(2, 36, 10, 2, C.iron);
      P.rect(11, 18, 3, 1, C.iron);
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
  // With the drawn fire loaded (fire1–6), one of its six frames, about 18 px tall per unit of size, sunk a
  // little into whatever it burns on so its round foot doesn't float.
  Art.drawFire = function (ctx, x, y, size, t, cool) {
    const f = !cool && Art.sprites["fire" + (1 + (Math.floor(t * 10 + x * 0.37) % 6 + 6) % 6)];
    if (f) {
      const h = 18 * size, w = (h * f.w) / f.h;
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true; // it's drawn smaller than it was cut, so let it blend
      ctx.drawImage(f.c, Math.round(x - w / 2), Math.round(y - h * 0.88), w, h);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
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
