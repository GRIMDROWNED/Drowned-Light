/* Drowned Light — knights painted as pixel art: the Lantern Knight, its four
   corruption stages, and the Drowned Knights that share its silhouette.
   Every frame is generated once at load into small canvases (a "sheet"):
     sheet[dir][anim][frame]   dir: down | up | side (left = mirrored side)
   Swap in hand-drawn sheets later by filling Art.sheets with the same shape. */
"use strict";
(function (DL) {
  const Art = DL.Art;
  const FW = 44, FH = 54, CX = 22, GY = 50; // frame size and foot anchor, in art pixels
  const PS = 2;                              // world px per art pixel
  Art.UNIT = { FW, FH, CX, GY, PS };

  /* ---------- palettes ---------- */
  const KNIGHT = {
    cloth: "#ddd0b4", clothMd: "#b4a587", clothDk: "#7b6c56", shadow: "#141619",
    metal: "#8d9397", metalHi: "#cdd1cf", metalDk: "#4b5157", leather: "#5b4331", boot: "#2e2722",
    gold: "#b98a4a", eye: "#121417", blade: "#c9ced0", bladeHi: "#f4f2ea",
    lanternFrame: "#352a20", glow: "#ffab3d", core: "#fff1c2", wood: "#5a4230", trim: "#7a2e2a",
    drip: "#2d8f98", dripHi: "#6ff3fb", outline: "#0a0b0c",
  };
  const DROWNED = {
    cloth: "#8b9796", clothMd: "#5f6d70", clothDk: "#35434a", shadow: "#06090b",
    metal: "#3e4d57", metalHi: "#6f8c96", metalDk: "#1f2a31", leather: "#2a2a28", boot: "#151a1d",
    gold: "#4c6a6e", eye: "#8ff8ff", blade: "#5f7a84", bladeHi: "#8ff8ff",
    lanternFrame: "#1b2429", glow: "#4fe6f0", core: "#e2ffff", wood: "#2b2b28", trim: "#5d2a28",
    drip: "#2aa6b1", dripHi: "#8ff8ff", outline: "#050708",
  };

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  function mixPal(a, b, t, over = {}) {
    const out = {};
    for (const k in a) out[k] = mixHex(a[k], b[k], t);
    return Object.assign(out, over);
  }

  /* ---------- animation poses ---------- */
  const ANIMS = {
    idle: [{}, { bob: 1, sway: 1 }],
    walk: [{ liftL: 2, stride: 3, bob: -1, sway: 1, hem: 1 }, { stride: 0 }, { liftR: 2, stride: -3, bob: -1, sway: -1, hem: -1 }, { stride: 0 }],
    attack: [{ atk: 0, lean: -1 }, { atk: 1, lean: 2, hem: 1 }, { atk: 2, lean: 1 }],
    dash: [{ dash: 1, lean: 3, hem: 4, stride: 4, bob: 1 }],
    hurt: [{ lean: -2, bob: 1, hurt: 1 }],
    death: [{ kneel: 4, lean: -1 }, { kneel: 8, lean: 1 }, { fallen: 1 }],
  };
  const FACING = { down: Math.PI / 2, up: -Math.PI / 2, side: 0 };
  // Resting weapon angle per view, and the attack swing (windup, strike, follow-through) relative to facing.
  const IDLE_BLADE = {
    sword: { down: 2.0, up: 1.25, side: 1.2 },
    pike: { down: -1.85, up: -1.3, side: -1.15 },
    crossbow: { down: Math.PI / 2, up: -Math.PI / 2, side: 0.15 },
    staff: { down: -Math.PI / 2, up: -Math.PI / 2, side: -Math.PI / 2 },
  };
  const ATK_OFFSET = { sword: [-2.4, -0.15, 1.1], pike: [0, 0, 0], crossbow: [0, 0, 0] };
  const THRUST = { pike: [-3, 4, 1], crossbow: [0, -3, -1] }; // hand pulled back / driven forward

  /* ---------- pieces ---------- */
  function hemPoints(pts, xr, xl, y, n, hem, torn, seed) {
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = xr + (xl - xr) * u + hem * (1 - u);
      const cut = i % 2 ? 2 + (torn ? Math.floor(DL.hash(i, seed, 3) * 3) : 1) : 0;
      pts.push(x, y - cut);
    }
  }

  function lantern(P, p, x, y, sway) {
    P.seg(x, y, x + sway, y + 3, p.metalDk);
    const lx = Math.round(x + sway - 2), ly = y + 3;
    P.rect(lx + 1, ly, 3, 1, p.lanternFrame);
    P.rect(lx, ly + 1, 5, 6, p.lanternFrame);
    P.rect(lx + 1, ly + 2, 3, 4, p.glow);
    P.px(lx + 2, ly + 3, p.core);
    P.rect(lx + 1, ly + 7, 3, 1, p.lanternFrame);
  }

  function blade(P, S, hx, hy, ang) {
    const p = S.pal, ux = Math.cos(ang), uy = Math.sin(ang);
    const kind = S.weapon;
    if (kind === "pike") {
      const L = 25;
      P.line([hx - ux * 7, hy - uy * 7, hx + ux * L, hy + uy * L], 2, p.wood);
      const tx = hx + ux * (L + 6), ty = hy + uy * (L + 6), bx = hx + ux * (L - 1), by = hy + uy * (L - 1);
      P.poly([tx, ty, bx - uy * 2.5, by + ux * 2.5, bx + uy * 2.5, by - ux * 2.5], p.blade);
      P.seg(bx, by, tx, ty, p.bladeHi);
      P.seg(bx - ux, by - uy, bx - ux * 3 - uy * 2, by - uy * 3 + ux * 2, p.gold);
      return;
    }
    if (kind === "crossbow") {
      P.line([hx - ux * 3, hy - uy * 3, hx + ux * 9, hy + uy * 9], 2, p.wood);
      const fx = hx + ux * 8, fy = hy + uy * 8;
      const l1x = fx - ux * 2 - uy * 6, l1y = fy - uy * 2 + ux * 6, l2x = fx - ux * 2 + uy * 6, l2y = fy - uy * 2 - ux * 6;
      P.line([l1x, l1y, fx, fy, l2x, l2y], 2, p.metalDk);
      P.seg(l1x, l1y, hx + ux, hy + uy, p.bladeHi);
      P.seg(l2x, l2y, hx + ux, hy + uy, p.bladeHi);
      P.seg(hx, hy, fx + ux * 3, fy + uy * 3, p.gold);
      return;
    }
    if (kind === "staff") {
      const top = hy - 22;
      P.line([hx, hy + 7, hx, top + 4], 2, p.wood);
      P.ell(hx, top, 4, 4.5, p.gold);
      P.ell(hx, top, 2.5, 3, p.lanternFrame);
      P.rect(hx - 1, top - 2, 3, 4, p.glow);
      P.px(hx, top - 1, p.core);
      P.seg(hx - 4, top + 4, hx - 2, top + 7, p.gold);
      P.seg(hx + 4, top + 4, hx + 2, top + 7, p.gold);
      P.rect(hx, top - 7, 1, 2, p.gold);
      return;
    }
    if (kind === "bow") {
      const g = P.g;
      g.strokeStyle = p.wood; g.lineWidth = 2;
      g.beginPath(); g.arc(hx, hy, 7, ang - 1.15, ang + 1.15); g.stroke();
      P.seg(hx + Math.cos(ang - 1.15) * 7, hy + Math.sin(ang - 1.15) * 7, hx + Math.cos(ang + 1.15) * 7, hy + Math.sin(ang + 1.15) * 7, p.bladeHi);
      return;
    }
    if (kind === "pole") {
      P.line([hx, hy + 5, hx + 1, hy - 26], 2, p.wood);
      P.seg(hx + 1, hy - 26, hx + 5, hy - 27, p.metalDk);
      P.seg(hx + 5, hy - 27, hx + 5, hy - 24, p.metalDk);
      lantern(P, p, hx + 5, hy - 25, 0);
      return;
    }
    if (kind === "claws") return;
    const len = kind === "greatsword" ? 21 : kind === "shortsword" ? 9 : 14;
    const w = kind === "greatsword" ? 3 : 2;
    const tx = hx + ux * len, ty = hy + uy * len;
    P.line([hx + ux * 2, hy + uy * 2, tx, ty], w, p.blade);
    P.seg(hx + ux * 3, hy + uy * 3, tx - ux * 2, ty - uy * 2, p.bladeHi);
    P.line([hx - uy * 3 + ux * 2, hy + ux * 3 + uy * 2, hx + uy * 3 + ux * 2, hy - ux * 3 + uy * 2], 2, p.gold);
    P.seg(hx, hy, hx - ux * 2, hy - uy * 2, p.leather);
  }

  function offhand(P, S, x, y, sway) {
    const p = S.pal;
    if (S.offhand === "lantern") lantern(P, p, x, y, sway);
    else if (S.offhand === "shield") {
      P.ell(x, y + 2, 4.5, 5.5, p.wood);
      P.ell(x, y + 2, 3, 4, p.clothDk);
      P.rect(x - 1, y + 1, 2, 2, p.metalHi);
    } else if (S.offhand === "bastion") {
      // the Flame Bastion's shield: planks, iron bands and a burning sigil
      P.rect(x - 5, y - 9, 11, 18, p.wood);
      P.seg(x - 2, y - 8, x - 2, y + 7, p.leather);
      P.seg(x + 2, y - 8, x + 2, y + 7, p.leather);
      P.rect(x - 5, y - 6, 11, 1, p.metalDk);
      P.rect(x - 5, y + 5, 11, 1, p.metalDk);
      P.rect(x - 1, y - 3, 3, 5, p.glow);
      P.px(x, y - 2, p.core);
    } else if (S.offhand === "tower") {
      P.rect(x - 5, y - 8, 10, 16, p.metalDk);
      P.rect(x - 4, y - 7, 8, 14, p.metal);
      P.rect(x - 4, y - 7, 8, 2, p.trim);
      P.rect(x - 1, y - 5, 2, 12, p.trim);
      P.rect(x - 3, y - 5, 1, 10, p.metalHi);
    }
  }

  function crown(P, p, c, ht) {
    for (let i = -2; i <= 2; i++) {
      const h = 6 - Math.abs(i) * 2;
      P.rect(c + i * 3 - 1, ht + 3 - h, 2, h + 2, p.metalDk);
      P.px(c + i * 3 - 1, ht + 3 - h, p.dripHi);
    }
  }

  function drips(P, S, c, top) {
    if (!S.drips) return;
    const g = P.g, p = S.pal;
    g.globalCompositeOperation = "source-atop";
    for (let i = 0; i < S.drips; i++) {
      const x = Math.floor(c - 10 + DL.hash(i, 1, S.seed) * 20);
      const y = Math.floor(top - 12 + DL.hash(i, 2, S.seed) * 36);
      g.fillStyle = i % 3 ? p.drip : p.dripHi;
      g.fillRect(x, y, 1, 1 + Math.floor(DL.hash(i, 3, S.seed) * 4));
    }
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- the knight body, three views ---------- */
  // Proportions (art px, ground up): legs 11 · torso 12 · hooded head 12.
  function hoodFront(c, ht, top) {
    return [c, ht, c + 3, ht + 1, c + 5, ht + 4, c + 6, ht + 8, c + 6, top + 1, c - 6, top + 1, c - 6, ht + 8, c - 5, ht + 4, c - 3, ht + 1];
  }
  function mantle(c, top, mw, vneck) {
    return [c - mw, top + 5, c - mw + 1, top + 1, c - 5, top - 2, c - 2, top - 1, c, top + (vneck ? 2 : -1), c + 2, top - 1, c + 5, top - 2,
      c + mw - 1, top + 1, c + mw, top + 4, c + mw - 2, top + 6, c + mw - 4, top + 4, c + 3, top + 6, c + 1, top + 4, c - 1, top + 6,
      c - 3, top + 4, c - mw + 4, top + 6, c - mw + 2, top + 4];
  }

  function humanoid(P, S, dir, pose) {
    const p = S.pal, k = pose.kneel || 0, bulk = S.bulk || 0;
    const lean = pose.lean || 0;
    const c = CX + (dir === "side" ? lean : 0);
    const b = (pose.bob || 0) + k;
    const G = GY, top = G - 23 + b, ht = top - 12;
    const hem = pose.hem || 0, sway = pose.sway || 0;
    const tw = (dir === "side" ? 3 : 5) + bulk;
    const mw = 9 + bulk;
    const legH = Math.max(2, 11 - k);
    const lw = 3 + (bulk ? 1 : 0);

    // weapon hand position + blade angle
    const F = FACING[dir];
    const wk = IDLE_BLADE[S.weapon] ? S.weapon : "sword";
    let ang = IDLE_BLADE[wk][dir], hx, hy;
    if (pose.atk != null && ATK_OFFSET[wk]) ang = F + ATK_OFFSET[wk][pose.atk];
    if (dir === "down") { hx = c - tw - 2; hy = top + (pose.atk === 0 ? 3 : 10); }
    else if (dir === "up") { hx = c + tw + 2; hy = top + (pose.atk === 0 ? 3 : 10); }
    else { hx = c + 3 + (pose.atk === 1 ? 2 : 0); hy = top + (pose.atk === 0 ? 2 : 9); }
    if (S.weapon === "crossbow" && dir === "down") { hx = c; hy = top + 8; }
    if (THRUST[wk] && pose.atk != null) { const k = THRUST[wk][pose.atk]; hx += Math.cos(F) * k; hy += Math.sin(F) * k; }
    if (wk === "staff" && pose.atk != null) hy -= pose.atk === 1 ? 4 : 1;
    if (pose.dash && wk === "sword") ang = dir === "side" ? 2.6 : ang + 0.5;

    const legs = (shadeOuter) => {
      for (const [x0, lift] of [[c - 4 - bulk, pose.liftL || 0], [c + 1 + bulk, pose.liftR || 0]]) {
        P.rect(x0, G - legH - 1 - lift, lw, legH - 2, p.metalDk);
        if (shadeOuter) P.rect(x0, G - legH - 1 - lift, 1, legH - 3, p.metal);
        P.rect(x0, G - 3 - lift, lw, 3, p.boot);
      }
    };
    const backCloak = (col, seed) => {
      const cw0 = 7 + bulk, cw1 = 11 + bulk + (S.torn ? 1 : 0);
      const pts = [c - cw0, top, c + cw0, top, c + cw1 + hem, G - 3];
      hemPoints(pts, c + cw1 + hem, c - cw1 - hem, G - 3, 7, 0, S.torn, seed);
      pts.push(c - cw1 - hem, G - 3);
      P.poly(pts, col);
      return cw0;
    };

    if (dir === "down") {
      backCloak(p.clothDk, 1);
      legs(true);
      // chest plate, belt, tabard
      P.rect(c - tw, top, tw * 2, 12, p.metal);
      P.rect(c - tw + 1, top + 5, 2, 4, p.metalHi);
      P.rect(c + tw - 2, top + 5, 1, 4, p.metalDk);
      P.rect(c - tw, top + 7, tw * 2, 1, p.metalDk);
      P.rect(c - 1, top + 5, 2, 2, p.metalHi);
      P.rect(c - tw, top + 9, tw * 2, 2, p.leather);
      P.rect(c - 1, top + 9, 2, 2, p.gold);
      P.poly([c - 3, top + 11, c + 3, top + 11, c + 3, G - 6, c + 2, G - 4, c + 1, G - 6, c, G - 3, c - 1, G - 6, c - 2, G - 4, c - 3, G - 6], p.cloth);
      // arms (mantle covers the shoulders)
      P.line([c - tw - 1, top + 2, hx, hy], 3, p.metal);
      P.line([c + tw + 1, top + 2, c + tw + 2, top + 9], 3, p.metal);
      // hood + helm
      P.poly(hoodFront(c, ht, top), p.cloth);
      P.poly([c + 2, ht + 1, c + 5, ht + 4, c + 6, ht + 8, c + 6, top + 1, c + 3, top + 1], p.clothMd);
      P.rect(c - 4, ht + 4, 8, 8, p.shadow);
      P.rect(c - 3, ht + 5, 6, 6, p.metal);
      P.rect(c - 3, ht + 5, 1, 5, p.metalHi);
      P.rect(c + 2, ht + 6, 1, 5, p.metalDk);
      P.rect(c - 3, ht + 7, 6, 1, p.eye);
      P.rect(c, ht + 7, 1, 3, p.eye);
      // shoulder mantle drapes over everything
      P.poly(mantle(c, top - 1, mw, true), p.clothDk);
      P.poly(mantle(c, top + 1, mw, true), p.clothDk);
      P.poly(mantle(c, top, mw, true), p.cloth);
      P.poly([c + 2, top - 1, c + 5, top - 2, c + mw - 1, top + 1, c + mw, top + 4, c + mw - 2, top + 6, c + mw - 4, top + 4, c + 3, top + 4], p.clothMd);
      if (S.crown) crown(P, p, c, ht);
      P.rect(c + tw + 1, top + 8, 3, 2, p.leather);
      blade(P, S, hx, hy, ang);
      P.rect(hx - 1, hy - 1, 3, 2, p.leather);
      offhand(P, S, c + tw + 3, top + 9, sway);
    } else if (dir === "up") {
      legs(false);
      offhand(P, S, c - tw - 3, top + 9, sway);
      const cw0 = backCloak(p.cloth, 2);
      P.poly([c + 1, top, c + cw0, top, c + 12 + bulk + hem, G - 3, c + 3, G - 5], p.clothMd);
      P.seg(c - 4, top + 4, c - 6, G - 6, p.clothMd);
      P.seg(c - 1, top + 5, c - 1, G - 5, p.clothMd);
      P.poly(hoodFront(c, ht, top), p.cloth);
      P.poly([c, ht, c + 3, ht + 1, c + 5, ht + 4, c + 6, ht + 8, c + 6, top + 1, c + 1, top + 1], p.clothMd);
      P.seg(c, ht + 2, c, top, p.clothDk);
      P.poly(mantle(c, top - 1, mw, false), p.clothDk);
      P.poly(mantle(c, top + 1, mw, false), p.clothDk);
      P.poly(mantle(c, top, mw, false), p.cloth);
      P.poly([c + 1, top - 1, c + 5, top - 2, c + mw - 1, top + 1, c + mw, top + 4, c + mw - 2, top + 6, c + mw - 4, top + 4, c + 2, top + 4], p.clothMd);
      if (S.crown) crown(P, p, c, ht);
      blade(P, S, hx, hy, ang);
      P.rect(hx - 1, hy - 1, 3, 2, p.leather);
    } else {
      // side view, facing right
      if (S.offhand === "lantern") lantern(P, p, c - 4, top + 8, -sway);
      const cw = 12 + bulk + (S.torn ? 1 : 0) + hem;
      const cloak = [c - 1, top, c + 2, top, c + 3, G - 6];
      hemPoints(cloak, c + 3, c - cw, G - 3, 6, 0, S.torn, 3);
      cloak.push(c - cw, G - 3, c - cw + 3 + Math.floor(hem / 2), top + 9, c - 5, top + 1);
      P.poly(cloak, p.clothDk);
      const st = pose.stride || 0;
      P.rect(c - 2 - st, G - legH - 1, lw, legH - 2, p.metalDk);
      P.rect(c - 2 - st, G - 3, lw + 1, 3, p.boot);
      P.rect(c - 1 + st, G - legH - 1, lw, legH - 2, p.metal);
      P.rect(c - 1 + st, G - 3, lw + 1, 3, p.boot);
      P.rect(c - tw, top, tw * 2 + 1, 12, p.metal);
      P.rect(c + tw - 1, top + 5, 1, 5, p.metalHi);
      P.rect(c - tw, top + 9, tw * 2 + 1, 2, p.leather);
      P.poly([c, top + 11, c + tw + 1, top + 11, c + tw, G - 6, c + 2, G - 4, c, G - 6], p.cloth);
      P.poly([c - 1, ht, c + 2, ht + 1, c + 4, ht + 4, c + 5, ht + 8, c + 5, top + 1, c - 5, top + 1, c - 6, ht + 7, c - 4, ht + 2], p.cloth);
      P.poly([c - 1, ht, c - 1, top + 1, c - 5, top + 1, c - 6, ht + 7, c - 4, ht + 2], p.clothMd);
      P.rect(c + 1, ht + 4, 4, 7, p.shadow);
      P.rect(c + 2, ht + 5, 3, 5, p.metal);
      P.rect(c + 2, ht + 7, 3, 1, p.eye);
      const sm = (o) => [c - 6, top + 6 + o, c - 5, top + o, c - 2, top - 2 + o, c + 3, top - 1 + o, c + 5, top + 3 + o, c + 4, top + 5 + o, c + 2, top + 4 + o, c, top + 6 + o, c - 2, top + 5 + o, c - 4, top + 7 + o];
      P.poly(sm(-1), p.clothDk);
      P.poly(sm(1), p.clothDk);
      P.poly(sm(0), p.cloth);
      P.poly([c - 6, top + 6, c - 5, top, c - 2, top - 2, c - 2, top + 5, c - 4, top + 7], p.clothMd);
      if (S.crown) crown(P, p, c - 1, ht);
      if (S.offhand === "shield" || S.offhand === "tower" || S.offhand === "bastion") offhand(P, S, c + tw + 3, top + 6, 0);
      P.line([c + 1, top + 3, hx, hy], 3, p.metal);
      blade(P, S, hx, hy, ang);
      P.rect(hx - 1, hy - 1, 3, 2, p.leather);
    }
    drips(P, S, c, top);
  }

  /* ---------- the Swarming Revenant: a crawling, half-drowned body ---------- */
  function crawler(P, S, dir, pose) {
    const p = S.pal, G = GY, c = CX;
    const r = pose.atk === 1 ? 4 : pose.atk === 0 ? -2 : (pose.liftL ? 2 : pose.liftR ? -1 : 0);
    const k = pose.kneel || 0;
    const top = G - 13 + k;
    if (dir === "side") {
      P.line([c - 6, G - 3, c - 11, G], 2, p.metalDk);
      P.poly([c - 11, G, c - 9, top + 5, c - 3, top, c + 4, top + 1, c + 8, top + 6, c + 9, G - 1], p.cloth);
      P.poly([c - 11, G, c - 9, top + 5, c - 5, top + 3, c - 4, G], p.clothMd);
      P.poly([c + 3, top - 1, c + 11, top + 4, c + 11, G - 4, c + 3, G - 5], p.clothDk);
      P.rect(c + 7, top + 4, 4, 4, p.shadow);
      P.rect(c + 8, top + 5, 2, 1, p.eye);
      P.line([c + 5, G - 4, c + 12 + r, G - 1], 2, p.metal);
      P.seg(c + 12 + r, G - 1, c + 14 + r, G, p.bladeHi);
    } else {
      const face = dir === "down";
      P.poly([c - 10, G - 1, c - 8, top + 3, c, top, c + 8, top + 3, c + 10, G - 1, c + 5, G, c, G - 2, c - 5, G], p.cloth);
      P.poly([c + 1, top, c + 8, top + 3, c + 10, G - 1, c + 5, G, c + 2, G - 3], p.clothMd);
      P.line([c - 6, G - 5, c - 9 - (face ? 0 : 1), G + (face ? 0 : -1) - r], 2, p.metal);
      P.line([c + 6, G - 5, c + 9, G - 2 + r], 2, p.metal);
      P.poly([c, top - 3, c + 5, top + 3, c + 4, top + 8, c - 4, top + 8, c - 5, top + 3], p.clothDk);
      if (face) {
        P.rect(c - 2, top + 3, 4, 4, p.shadow);
        P.px(c - 1, top + 4, p.eye); P.px(c + 1, top + 4, p.eye);
      }
    }
    drips(P, S, c, top + 8);
  }

  /* ---------- the Bone Hound: a summoned skeletal hound in a torn red mantle ----------
     Its own frame size; side views face right. Coded fallback under the drawn sheets (src/sprites.js). */
  const HW = 44, HH = 34, HX = 22, HG = 31;
  const HOUND = {
    bone: "#d9cdae", boneMd: "#ab9e80", boneDk: "#6f6551", hollow: "#231c19", red: "#8f201b", redMd: "#6a1713",
    redDk: "#430d0b", eye: "#ff4b2b", leather: "#4b3427", gold: "#a8813f", outline: "#0b0908",
  };
  // Leg tracks [front near, front far, hind near, hind far] as [x shift, foot lift], plus body bob.
  const HOUND_ANIMS = {
    idle: [{ legs: [[2, 0], [3, 0], [-1, 0], [0, 0]] }, { legs: [[2, 0], [3, 0], [-1, 0], [0, 0]], bob: 1, tail: 1 }],
    // a gallop in four sharply different beats: stretched out, front planted, gathered, hind planted
    walk: [
      { legs: [[7, 1], [5, 0], [-7, 0], [-5, 1]], tail: -1 },
      { legs: [[1, 0], [3, 0], [-3, 3], [-1, 2]], bob: -1 },
      { legs: [[-3, 2], [-1, 1], [3, 1], [5, 2]], bob: -2, arch: 2, tail: 1 },
      { legs: [[5, 4], [7, 3], [0, 0], [-2, 0]], bob: -1, head: -1 },
    ],
    attack: [
      { legs: [[4, 0], [5, 0], [-3, 0], [-2, 0]], bob: 2, head: 2, push: -2 },
      { legs: [[9, 3], [8, 2], [-8, 0], [-6, 1]], bob: -1, push: 4, jaw: 3, head: 1 },
      { legs: [[4, 0], [5, 0], [-4, 0], [-3, 0]], push: 2, jaw: 1 },
    ],
    hurt: [{ legs: [[0, 0], [1, 0], [-3, 0], [-2, 0]], push: -3, head: -2, jaw: 1 }],
    death: [{ legs: [[5, 0], [6, 0], [-6, 0], [-5, 0]], bob: 4, head: 3 }, { pile: 1 }, { pile: 2 }],
  };

  function houndBone(P, pts, w, col) {
    P.line(pts, w, col);
  }
  function houndLeg(P, hx, hy, fx, fy, hind, col, dk) {
    if (hind) {
      // thigh forward to the knee, shin back to the hock, then down to the paw
      const kx = hx + 3, ky = hy + Math.round((fy - hy) * 0.35), ax = fx - 2, ay = fy - 3;
      houndBone(P, [hx, hy, kx, ky, ax, ay, fx, fy - 1], 2, col);
      P.px(kx, ky, dk);
    } else {
      const ex = hx - 1, ey = hy + Math.round((fy - hy) * 0.5);
      houndBone(P, [hx, hy, ex, ey, fx, fy - 1], 2, col);
      P.px(ex, ey, dk);
    }
    P.rect(fx - 1, fy - 1, 4, 1, col);
    P.px(fx + 3, fy - 1, dk);
  }
  function houndSkullSide(P, p, x, y, jaw) {
    // horns sweeping back off the crown
    P.poly([x + 1, y - 2, x + 3, y - 3, x - 3, y - 8], p.boneMd);
    P.poly([x + 3, y - 3, x + 6, y - 3, x + 1, y - 9], p.bone);
    // cranium and snout
    P.poly([x - 1, y, x + 1, y - 3, x + 6, y - 4, x + 8, y - 2, x + 12, y - 1, x + 12, y + 2, x + 5, y + 2, x, y + 2], p.bone);
    P.rect(x + 1, y + 1, 10, 1, p.boneMd);
    // lower jaw, hinged at the back
    P.poly([x + 1, y + 2, x + 11, y + 2 + jaw, x + 10, y + 4 + jaw, x + 2, y + 4], p.boneMd);
    for (let i = 0; i < 4; i++) { P.px(x + 4 + i * 2, y + 2, p.bone); if (jaw > 1) P.px(x + 5 + i * 2, y + 2 + Math.round(jaw * (0.4 + i * 0.15)), p.bone); }
    if (jaw > 1) P.rect(x + 3, y + 3, 7, jaw - 1, p.redDk);
    // eye socket and its ember
    P.rect(x + 4, y - 2, 3, 2, p.hollow);
    P.px(x + 5, y - 2, p.eye);
    P.px(x + 11, y, p.hollow);
  }
  function houndPile(P, p, n) {
    const G = HG, c = HX;
    P.line([c - 10, G - 2, c + 6, G - 3], 2, p.boneMd);
    for (let i = 0; i < 5; i++) P.line([c - 8 + i * 3, G - 3, c - 7 + i * 3 + (i % 2), G - 6 - (i % 2)], 1, p.bone);
    P.poly([c - 4, G - 5, c + 3, G - 6, c + 2, G - 2, c - 5, G - 1], p.red);
    P.line([c - 14, G - 1, c - 9, G - 2], 1, p.boneMd);
    P.line([c + 9, G - 1, c + 14, G], 2, p.boneDk);
    houndSkullSide(P, p, c + 4 + (n > 1 ? 1 : 0), G - 5 + (n > 1 ? 1 : 0), 1);
  }

  function hound(P, dir, pose) {
    const p = HOUND, G = HG, c = HX;
    if (pose.pile) { houndPile(P, p, pose.pile); return; }
    const b = pose.bob || 0, push = pose.push || 0, head = pose.head || 0, jaw = pose.jaw || 0, arch = pose.arch || 0;
    const L = pose.legs;
    if (dir === "side") {
      const hip = { x: c - 8 + push, y: G - 13 + b }, sh = { x: c + 6 + push, y: G - 14 + b };
      // far legs first, in shadow
      houndLeg(P, sh.x - 1, sh.y, sh.x + L[1][0] - 1, G - L[1][1], false, p.boneDk, p.hollow);
      houndLeg(P, hip.x + 1, hip.y, hip.x + L[3][0] + 1, G - L[3][1], true, p.boneDk, p.hollow);
      // tail: a chain of vertebrae curling up
      const tl = pose.tail || 0;
      const tail = [hip.x, hip.y, hip.x - 4, hip.y - 3 + tl, hip.x - 7, hip.y - 7 + tl, hip.x - 7 + tl, hip.y - 11];
      houndBone(P, tail, 1, p.boneMd);
      for (let i = 2; i < tail.length; i += 2) P.px(tail[i], tail[i + 1], p.bone);
      // the hollow of the ribcage, then the ribs and spine over it
      const midY = G - 16 + b - arch;
      P.poly([hip.x + 2, hip.y + 1, sh.x - 1, sh.y + 1, sh.x - 1, G - 7 + b, hip.x + 4, G - 9 + b], p.hollow);
      for (let x = hip.x + 4; x <= sh.x - 1; x += 2) P.seg(x, midY + 1 + Math.abs(x - c) / 6, x + 1, G - 8 + b, p.bone);
      P.line([hip.x + 4, G - 8 + b, sh.x, G - 7 + b], 1, p.boneMd);
      P.curve(hip.x, hip.y, c - 1 + push, midY, sh.x, sh.y, 2, p.bone);
      P.ell(hip.x, hip.y + 1, 2.5, 2, p.boneMd);
      // spines along the back, biggest over the shoulders
      [[-6, 3], [-3, 4], [0, 5], [3, 6]].forEach(([dx, h]) => {
        const x = c + dx + push, y = midY + Math.abs(dx) / 4;
        P.poly([x - 1, y, x + 2, y, x - 2, y - h], dx > 0 ? p.bone : p.boneMd);
      });
      // a strap across the ribs with its buckle
      P.seg(c - 1 + push, midY + 1, c + 1 + push, G - 8 + b, p.leather);
      P.px(c + push, G - 11 + b, p.gold);
      // neck and skull
      const hx = sh.x + 3, hy = sh.y - 4 + head;
      houndBone(P, [sh.x, sh.y, hx, hy + 1], 2, p.boneMd);
      // the torn red mantle over the shoulders
      P.poly([sh.x - 5, sh.y - 2, sh.x + 3, sh.y - 4, sh.x + 4, sh.y, sh.x + 1, G - 8 + b, sh.x - 1, G - 10 + b, sh.x - 3, G - 7 + b, sh.x - 4, G - 11 + b, sh.x - 7, G - 9 + b], p.red);
      P.poly([sh.x - 5, sh.y - 2, sh.x - 1, sh.y - 3, sh.x - 3, G - 8 + b, sh.x - 7, G - 9 + b], p.redMd);
      houndSkullSide(P, p, hx, hy - 1, jaw);
      // near legs on top
      houndLeg(P, sh.x, sh.y + 1, sh.x + L[0][0], G - L[0][1], false, p.bone, p.boneDk);
      houndLeg(P, hip.x, hip.y + 1, hip.x + L[2][0], G - L[2][1], true, p.bone, p.boneDk);
      return;
    }
    const face = dir === "down";
    // front and back views: the legs alternate lifts, the body bobs over them
    const lift = (i) => L[i][1];
    const top = G - 14 + b;
    // hind legs (farther apart, behind)
    for (const [i, sx] of [[2, -1], [3, 1]]) {
      const x = c + sx * 6;
      P.line([x, top + 2, x + sx, G - 1 - lift(i)], 2, face ? p.boneDk : p.boneMd);
      P.rect(x + sx - 1, G - 1 - lift(i), 3, 1, face ? p.boneDk : p.boneMd);
    }
    if (!face) {
      // pelvis and the tail curling up toward the viewer
      const tl = pose.tail || 0;
      P.ell(c, top + 3, 4, 2.5, p.boneMd);
      houndBone(P, [c, top + 2, c + 1 + tl, top - 3, c - 1 + tl, top - 7], 1, p.boneMd);
      P.px(c + 1 + tl, top - 3, p.bone); P.px(c - 1 + tl, top - 7, p.bone);
    }
    // ribcage
    P.poly([c - 5, top - 2, c + 5, top - 2, c + 4, top + 5, c - 4, top + 5], p.hollow);
    for (let y = top - 1; y <= top + 4; y += 2) { P.seg(c - 5, y, c - 1, y + 1, p.bone); P.seg(c + 1, y + 1, c + 5, y, p.bone); }
    P.line([c, top - 3, c, top + 5], 1, p.boneMd);
    // spines fanning up from the back
    [[-4, 4], [-1, 6], [2, 5], [4, 3]].forEach(([dx, h]) => P.poly([c + dx - 1, top - 2, c + dx + 1, top - 2, c + dx + Math.sign(dx || 1), top - 2 - h], face ? p.boneMd : p.bone));
    // front legs
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const x = c + sx * 4;
      P.line([x, top + 1, x + sx, top + 6, x, G - 1 - lift(i)], 2, p.bone);
      P.rect(x - 1, G - 1 - lift(i), 3, 1, p.bone);
      if (face) P.px(x + sx * 2, G - 1 - lift(i), p.boneDk);
    }
    // mantle over the shoulders
    P.poly([c - 7, top - 4, c + 7, top - 4, c + 6, top + 2, c + 3, top + 6, c + 1, top + 3, c - 2, top + 7, c - 4, top + 2, c - 7, top + 3], p.red);
    P.poly([c + 1, top - 4, c + 7, top - 4, c + 6, top + 2, c + 3, top + 6, c + 2, top], p.redMd);
    // skull
    const hy = top - 7 + head + (pose.push > 0 ? 2 : 0);
    P.poly([c - 6, hy - 6, c - 3, hy - 3, c - 5, hy - 2], p.boneMd);
    P.poly([c + 6, hy - 6, c + 3, hy - 3, c + 5, hy - 2], p.boneMd);
    if (face) {
      P.poly([c - 4, hy - 4, c + 4, hy - 4, c + 5, hy, c + 3, hy + 3, c + 2, hy + 6, c - 2, hy + 6, c - 3, hy + 3, c - 5, hy], p.bone);
      P.rect(c - 3, hy - 1, 2, 2, p.hollow); P.rect(c + 1, hy - 1, 2, 2, p.hollow);
      P.px(c - 2, hy - 1, p.eye); P.px(c + 2, hy - 1, p.eye);
      P.px(c - 1, hy + 4, p.hollow); P.px(c + 1, hy + 4, p.hollow);
      P.rect(c - 2, hy + 6, 5, 1 + jaw, jaw ? p.redDk : p.boneMd);
      P.rect(c - 2, hy + 6 + jaw, 5, 1, p.boneMd);
      if (jaw) { P.px(c - 2, hy + 6, p.bone); P.px(c + 2, hy + 6, p.bone); }
    } else {
      P.poly([c - 4, hy - 4, c + 4, hy - 4, c + 5, hy, c + 3, hy + 2, c - 3, hy + 2, c - 5, hy], p.boneMd);
      P.rect(c - 2, hy - 3, 4, 1, p.bone);
    }
  }

  function houndSheet() {
    const sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = {};
      for (const anim in HOUND_ANIMS) sheet[dir][anim] = HOUND_ANIMS[anim].map((pose) =>
        Object.assign(Art.mk(HW, HH, (P) => hound(P, pose.pile ? "side" : dir, pose), HOUND.outline), { ax: HX, ay: HG + 1 }));
    }
    return sheet;
  }

  /* ---------- Derek: a mossy stone golem with a glowing cyan heart and rocks circling him ----------
     Its own frame size; side views face right. Coded until drawn sheets come in (src/sprites.js). */
  const GW = 40, GH = 40, GX = 20, GG = 37;
  const GOLEM = {
    stone: "#64665d", stoneHi: "#8d8f82", stoneDk: "#3d3e38", crack: "#25261f", moss: "#4c6a32", mossHi: "#7d9e46",
    core: "#5ff3ff", coreHi: "#eaffff", coreDk: "#1d97a8", outline: "#0a0b09",
  };
  // lift: foot lift [near, far]; orb: where the circling rocks are (quarter turns); arm: fists raised (−) or slammed (+); glow: heart brightness
  const GOLEM_ANIMS = {
    idle: [{ orb: 0 }, { orb: 1, bob: 1 }],
    walk: [{ lift: [3, 0], stride: 2, orb: 0, bob: -1 }, { orb: 1 }, { lift: [0, 3], stride: -2, orb: 2, bob: -1 }, { orb: 3 }],
    attack: [{ arm: -7, glow: 1, orb: 0, bob: -1 }, { arm: -10, glow: 2, orb: 1, bob: -2 }, { arm: 4, glow: 2, orb: 2, bob: 1 }],
  };
  function golem(P, dir, pose) {
    const p = GOLEM, G = GG, side = dir === "side", back = dir === "up";
    const c = GX, cy = G - 17 + (pose.bob || 0), lift = pose.lift || [0, 0], st = pose.stride || 0;
    const rock = (x, y, r) => { P.ell(x, y, r, r * 0.85, p.stoneDk); P.ell(x - r * 0.25, y - r * 0.25, r * 0.6, r * 0.5, p.stone); };
    const orbs = [0, 2].map((k) => { const a = ((pose.orb || 0) + k) * Math.PI / 2 + 0.6; return { x: c + Math.cos(a) * 16, y: cy - 4 + Math.sin(a) * 5, front: Math.sin(a) > 0 }; });
    for (const o of orbs) if (!o.front) rock(o.x, o.y, 2.5);
    // stubby legs
    const legs = side ? [[c - 3 - st, lift[1], p.stoneDk], [c + 3 + st, lift[0], p.stone]] : [[c - 6, lift[0], p.stone], [c + 6, lift[1], p.stone]];
    for (const [x, l, col] of legs) { P.rect(x - 3, G - 7 - l, 6, 6, p.stoneDk); P.rect(x - 3, G - 7 - l, 5, 4, col); P.rect(x - 4, G - 2 - l, 8, 2, p.stoneDk); }
    // fists, behind the body when seen from behind
    const arm = pose.arm || 0;
    const fists = side ? [[c - 10, cy + 2 + arm]] : [[c - 13, cy + 2 + arm], [c + 13, cy + 2 + arm]];
    if (back || side) for (const [x, y] of fists) rock(x, y, 4); // seen from the side, his fist swings behind him
    // the boulder body
    P.ell(c, cy, 12, 11, p.stoneDk);
    P.ell(c - 1, cy - 1, 11, 10, p.stone);
    P.ell(c - 4, cy - 4, 5, 4, p.stoneHi);
    P.poly([c - 11, cy + 3, c + 11, cy + 3, c + 8, cy + 9, c - 8, cy + 9], p.stoneDk);
    // cracks running out from the heart
    const hx = side ? c + 6 : c;
    if (!back) { P.seg(hx - 3, cy, hx - 9, cy - 5, p.crack); P.seg(hx + 2, cy + 3, hx + 6, cy + 8, p.crack); P.seg(hx - 2, cy + 4, hx - 6, cy + 9, p.crack); }
    else { P.seg(c - 4, cy - 4, c + 2, cy + 3, p.crack); P.seg(c + 2, cy + 3, c + 7, cy + 1, p.crack); P.seg(c - 6, cy + 2, c - 2, cy + 8, p.crack); }
    // moss over the top
    P.ell(c - 1, cy - 9, back ? 9 : 7, 3, p.moss);
    P.ell(c - 3, cy - 10, 4, 2, p.mossHi);
    P.rect(c + 4, cy - 8, 2, 3, p.moss); P.rect(c - 8, cy - 8, 2, 4, p.moss);
    if (back) { P.ell(c + 3, cy + 1, 4, 2, p.moss); P.px(c + 2, cy, p.mossHi); }
    // the glowing heart
    if (!back) {
      const s = side ? 2 : 3, g = pose.glow || 0;
      P.poly([hx, cy - s - 2, hx + s + 1, cy + 1, hx, cy + s + 3, hx - s - 1, cy + 1], p.coreDk);
      P.poly([hx, cy - s - 1, hx + s, cy + 1, hx, cy + s + 2, hx - s, cy + 1], p.core);
      P.rect(hx - (g ? 1 : 0), cy, g ? 2 : 1, g ? 2 : 1, p.coreHi);
    }
    if (!back && !side) for (const [x, y] of fists) rock(x, y, 4);
    for (const o of orbs) if (o.front) rock(o.x, o.y, 2.5);
  }
  function golemSheet() {
    const sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = {};
      for (const anim in GOLEM_ANIMS) sheet[dir][anim] = GOLEM_ANIMS[anim].map((pose) =>
        Object.assign(Art.mk(GW, GH, (P) => golem(P, dir, pose), GOLEM.outline), { ax: GX, ay: GG, res: 2.47 })); // shown 30 px tall, like the drawn ones
    }
    return sheet;
  }

  // Kindle has no coded sheet (src/render.js draws his stand-in by hand): an empty one for the drawn frames to fill.
  function kindleSheet(extra = ["point"]) {
    const blank = Object.assign(Art.mk(1, 1, () => {}), { ax: 0, ay: 0, blank: true }), sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = { idle: [blank], walk: [blank], attack: [blank], hurt: [blank], death: [blank] };
      for (const a of extra) sheet[dir][a] = [blank];
    }
    return sheet;
  }

  /* ---------- sheet building ---------- */
  function fallen(src, dir) {
    // Lay the kneeling frame on its side.
    const c = document.createElement("canvas");
    c.width = FW; c.height = FH;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.translate(CX, GY - 4);
    g.rotate(dir === "up" ? -Math.PI / 2 : Math.PI / 2);
    g.drawImage(src, -CX, -GY + 4);
    return { c, w: FW, h: FH };
  }

  function buildSheet(S) {
    const sheet = {};
    for (const dir of ["down", "up", "side"]) {
      sheet[dir] = {};
      for (const anim in ANIMS) {
        sheet[dir][anim] = [];
        ANIMS[anim].forEach((pose) => {
          if (pose.fallen) { sheet[dir][anim].push(fallen(sheet[dir][anim][1].c, dir)); return; }
          sheet[dir][anim].push(Art.mk(FW, FH, (P) => (S.crawl ? crawler : humanoid)(P, S, dir, pose), S.pal.outline));
        });
      }
    }
    return sheet;
  }

  Art.buildUnits = function () {
    const sh = Art.sheets;
    // Each kit's knight at the four corruption stages, plus its drowned self. Built the first time it's drawn.
    const stages = [
      { t: 0, drips: 0, over: {} },
      { t: 0.22, drips: 6, over: {} },
      { t: 0.5, drips: 14, over: { glow: "#e8b45a" } },
      { t: 0.8, drips: 26, over: { glow: "#5fe6ee", core: "#e2ffff", eye: "#5fe6ee" } },
    ];
    for (const kit in KIT_GEAR) {
      const gear = KIT_GEAR[kit];
      stages.forEach((st, i) => {
        Art.specs[kit + (i + 1)] = Object.assign({ pal: mixPal(KNIGHT, DROWNED, st.t, st.over), drips: st.drips, seed: 11 }, gear);
      });
      Art.specs["self_" + kit] = Object.assign({ pal: mixPal(KNIGHT, DROWNED, 0.9, { glow: "#5fe6ee", core: "#e2ffff", eye: "#8ff8ff" }), drips: 30, seed: 11 }, gear);
    }
    const d = (over) => mixPal(DROWNED, DROWNED, 0, over);
    sh.squire = buildSheet({ pal: d({}), weapon: "shortsword", offhand: "none", torn: true, drips: 10, seed: 21 });
    sh.footman = buildSheet({ pal: d({}), weapon: "sword", offhand: "shield", drips: 12, seed: 22 });
    sh.archer = buildSheet({ pal: d({ cloth: "#76827f" }), weapon: "bow", offhand: "none", torn: true, drips: 10, seed: 23 });
    sh.revenant = buildSheet({ pal: d({ cloth: "#6f7c7b" }), weapon: "claws", crawl: true, drips: 8, seed: 24 });
    sh.defiler = buildSheet({ pal: d({ cloth: "#99a3a0" }), weapon: "pole", offhand: "none", torn: true, drips: 12, seed: 25 });
    sh.blackguard = buildSheet({ pal: d({ cloth: "#4a5559", clothMd: "#36424a", metal: "#2c3840", metalHi: "#55707a" }), weapon: "sword", offhand: "tower", bulk: 2, drips: 10, seed: 26 });
    sh.hexbearer = buildSheet({ pal: d({ cloth: "#8d9896" }), weapon: "staff", offhand: "lantern", torn: true, drips: 14, seed: 28 });
    sh.boneHound = Art.applyFrames("boneHound", houndSheet());
    sh.derek = Art.applyFrames("derek", golemSheet());
    sh.kindle = Art.applyFrames("kindle", kindleSheet());
    sh.abigail = Art.applyFrames("abigail", kindleSheet(["bless"])); // the same for Abigail (src/render.js)
    sh.champion = buildSheet({ pal: d({ cloth: "#c3cbc6", clothMd: "#8d9a99", blade: "#7fa6b0" }), weapon: "greatsword", offhand: "none", bulk: 1, crown: true, drips: 22, seed: 27 });
  };

  // What each kit's knight carries (matches the kit concept sheets).
  const KIT_GEAR = {
    lanternBlade: { weapon: "sword", offhand: "lantern" },
    pikeWarden: { weapon: "pike", offhand: "lantern" },
    ashenArbalist: { weapon: "crossbow", offhand: "lantern" },
    relicBearer: { weapon: "staff", offhand: "none" },
    flameBastion: { weapon: "sword", offhand: "bastion", bulk: 1 },
  };
  Art.specs = {};
  Art.sheet = function (key) {
    if (!Art.sheets[key] && Art.specs[key]) Art.sheets[key] = Art.applyFrames(key, buildSheet(Art.specs[key]));
    return Art.sheets[key];
  };

  /* ---------- drawing ---------- */
  Art.unitDir = function (angle) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    if (Math.abs(cx) > 0.72) return { dir: "side", flip: cx < 0 };
    return { dir: cy > 0 ? "down" : "up", flip: false };
  };

  const tmp = document.createElement("canvas");
  const tg = tmp.getContext("2d");

  /* Draw a unit with its feet at (x, y). opt: alpha, flash (0..1), flashColor, clip (0..1 visible from top). */
  Art.drawUnit = function (ctx, key, anim, frame, angle, x, y, scale, opt = {}) {
    const sheet = Art.sheet(key);
    if (!sheet) return;
    const { dir, flip } = Art.unitDir(angle);
    const frames = sheet[dir][anim] || sheet[dir].idle;
    const f = frames[((frame % frames.length) + frames.length) % frames.length];
    // Coded frames share one size and foot anchor; loaded PNG frames carry their own, and may be drawn
    // at `res` file pixels per art pixel for finer detail.
    const fr = f.c, w = f.w, h = f.h, ax = f.ax != null ? f.ax : CX, ay = f.ay != null ? f.ay : GY;
    const s = (PS * scale) / (f.res || 1);
    const clip = opt.clip != null ? Math.max(0, Math.min(1, opt.clip)) : 1;
    let img = fr;
    if (opt.flash) {
      if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
      tg.clearRect(0, 0, w, h);
      tg.globalCompositeOperation = "source-over";
      tg.drawImage(fr, 0, 0);
      tg.globalCompositeOperation = "source-atop";
      tg.globalAlpha = Math.min(1, opt.flash);
      tg.fillStyle = opt.flashColor || "#fff";
      tg.fillRect(0, 0, w, h);
      tg.globalAlpha = 1;
      tg.globalCompositeOperation = "source-over";
      img = tmp;
    }
    ctx.save();
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h * clip, -ax * s, -ay * s, w * s, h * clip * s);
    ctx.restore();
  };
  Art.animLength = (key, anim) => Art.sheet(key).down[anim].length;
})(window.DL);
