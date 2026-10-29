/* Drowned Light — rendering: world, characters, darkness and light. */
"use strict";
(function (DL) {
  const W = DL.World, Art = DL.Art;
  const PS = 2;   // procedural sprite pixel size in world px

  const R = (DL.Render = {});

  R.init = function () {
    R.cv = document.getElementById("game");
    R.ctx = R.cv.getContext("2d");
    R.lc = document.createElement("canvas");
    R.lx = R.lc.getContext("2d");
    R.motes = [];
    R.resize();
    addEventListener("resize", R.resize);
  };

  R.resize = function () {
    R.dpr = Math.min(devicePixelRatio || 1, 2);
    const sz = DL.View.size();
    R.W = sz.w;
    R.H = sz.h;
    R.cv.width = Math.round(R.W * R.dpr);
    R.cv.height = Math.round(R.H * R.dpr);
    R.zoom = Math.max(0.85, Math.min(2.2, Math.min(R.W, R.H) / 460));
    R.lc.width = Math.ceil(R.W / 2);
    R.lc.height = Math.ceil(R.H / 2);
    const v = document.createElement("canvas");
    v.width = R.cv.width; v.height = R.cv.height;
    const g = v.getContext("2d");
    const gr = g.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.75);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = gr;
    g.fillRect(0, 0, v.width, v.height);
    R.vignette = v;
  };

  function sprite(c, name, x, y, flip, alpha) {
    const s = Art.sprites[name];
    if (!s) return;
    const w = s.w * PS, h = s.h * PS;
    c.save();
    if (alpha != null) c.globalAlpha = alpha;
    if (flip) {
      c.translate(Math.round(x), 0);
      c.scale(-1, 1);
      c.drawImage(s.c, Math.round(-w / 2), Math.round(y - h), w, h);
    } else c.drawImage(s.c, Math.round(x - w / 2), Math.round(y - h), w, h);
    c.restore();
  }

  function shadow(c, x, y, rx, ry, a = 0.38) {
    c.fillStyle = `rgba(0,0,0,${a})`;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  R.treeSprite = (o) => treeSprite(o);
  // Three drawn trees when their art is loaded, one picked per spot, chopped down in four stages
  // (whole, lopped, broken, stump: every hit but the last shows); else the two coded ones.
  function treeSprite(o) {
    if (!Art.sprites.swampTree11) return "tree" + o.variant;
    const v = o.art || (o.art = 1 + Math.floor(DL.hash(o.x | 0, o.y | 0, 11) * 3));
    const k = o.mineHp == null ? 0 : 1 - o.mineHp / o.def.hits;
    return "swampTree" + v + Math.min(4, 1 + Math.ceil(k * 3 - 1e-9));
  }

  R.rockSprite = (o) => rockSprite(o);
  // Four drawn boulders (two shapes, bare or mossy) when their art is loaded, each crumbling in three
  // stages as it's mined; else the coded rock.
  function rockSprite(o) { return Art.sprites.boulder11 ? staged(o, "boulder", 4) : "rock"; }
  // Three drawn iron deposits, mined down the same way; else the coded pile.
  R.ironSprite = (o) => ironSprite(o);
  function ironSprite(o) { return Art.sprites.iron11 ? staged(o, "iron", 3) : "ironpile"; }
  // The "pearl" resource is drawn as amethyst deposits when their art is loaded.
  R.amethystSprite = (o) => amethystSprite(o);
  function amethystSprite(o) { return Art.sprites.amethyst11 ? staged(o, "amethyst", 3) : "pearl"; }
  // One of n drawn variants, picked per spot, at the damage stage its mining has reached.
  function staged(o, base, n) {
    const v = o.art || (o.art = 1 + Math.floor(DL.hash(o.x | 0, o.y | 0, 13) * n));
    const k = o.mineHp == null ? 0 : 1 - o.mineHp / o.def.hits;
    return base + v + (k >= 2 / 3 ? 3 : k >= 1 / 3 ? 2 : 1);
  }

  function objSprite(o) {
    switch (o.type) {
      case "tree": return o.harvested ? null : treeSprite(o);
      case "stone": return o.harvested ? null : rockSprite(o);
      case "iron": return o.harvested ? null : ironSprite(o);
      case "sprout": return o.harvested ? "sproutBare" : o.active ? "sproutOn" : "sproutOff";
      case "refuge": return o.dead ? "husk" : o.active ? "refugeOn" : "refugeOff";
      case "sentinel": return o.dead ? "husk" : o.active ? "sentinelOn" : "sentinelOff";
      case "root": return o.dead ? "husk" : o.active ? "rootOn" : "rootOff";
      case "pearl": return o.harvested ? null : amethystSprite(o);
      case "black": return o.harvested ? null : Art.sprites.blackPearl11 ? staged(o, "blackPearl", 3) : "blackClam";
      // six drawn reed clumps when their art is loaded, one picked per spot
      case "reeds": return Art.sprites.reeds1 ? "reeds" + (o.reed || (o.reed = 1 + Math.floor(DL.hash(o.x | 0, o.y | 0, 9) * 6))) : "reeds";
      // the drawn den: eyes in its mouth while the pack lives, empty once it's broken; else the coded one
      // the drawn graves come in two kinds, one picked per stone
      case "grave": return Art.sprites.grave2 && DL.hash(o.x | 0, o.y | 0, 11) < 0.4 ? "grave2" : "grave";
      case "den": return Art.sprites.denGuarded ? (DL.Den.state().cleared ? "denCleared" : "denGuarded") : "boneDen";
      default: return o.def.sprite;
    }
  }

  R.draw = function (G) {
    // facing the Sunken King, the camera pulls back far enough to show him (src/finale.js)
    const fv = G.player && G.state !== "title" ? DL.Finale.view(G.player) : null;
    R.zoomMul = (R.zoomMul || 1) + ((fv ? Math.min(1, R.H / (R.zoom * fv.need), R.W / (R.zoom * fv.needW)) : 1) - (R.zoomMul || 1)) * 0.03;
    const c = R.ctx, z = R.zoom * R.zoomMul, cam = G.camera, dpr = R.dpr;
    const shx = (Math.random() - 0.5) * cam.shake, shy = (Math.random() - 0.5) * cam.shake;
    const vw = R.W / z, vh = R.H / z, left = cam.x - vw / 2, top = cam.y - vh / 2;
    const view = { left, top, right: left + vw, bottom: top + vh };
    R.view = { left, top, z }; // for turning the mouse position into a world aim
    const t = G.t;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#05090c";
    c.fillRect(0, 0, R.W, R.H);
    const toWorld = () => c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (-left * z + shx), dpr * (-top * z + shy));
    toWorld();
    c.imageSmoothingEnabled = false;

    /* ground */
    const CH = W.CH;
    let built = 0;
    for (let cy = Math.floor(top / CH); cy <= Math.floor(view.bottom / CH); cy++) {
      for (let cx = Math.floor(left / CH); cx <= Math.floor(view.right / CH); cx++) {
        let gc = W.groundCanvas(cx, cy, false);
        if (!gc && built < 3) { gc = W.groundCanvas(cx, cy, true); built++; }
        if (!gc) { c.fillStyle = "#121a17"; c.fillRect(cx * CH, cy * CH, CH, CH); continue; }
        c.drawImage(gc, cx * CH, cy * CH, CH + 0.6, CH + 0.6);
      }
    }

    /* camp ground: paths, plaza, boardwalks */
    drawCampGround(c, G);
    DL.Cave.drawGround(c, view);
    DL.Rose.drawGround(c, view);
    DL.Finale.drawGround(c, view, t);

    for (const d of G.decals) sprite(c, d.type, d.x, d.y, false, Math.min(1, d.t / 3));

    /* telegraphs on the ground */
    for (const tg of G.telegraphs) {
      const k = Math.min(1, tg.t / tg.delay);
      // the Deadly Rose's are red, the mother wyvern's a pale storm-white
      c.fillStyle = tg.rose ? `rgba(200,30,50,${0.12 + 0.25 * k})` : tg.wyv ? `rgba(200,220,255,${0.1 + 0.22 * k})` : `rgba(60,220,230,${0.12 + 0.25 * k})`;
      c.strokeStyle = tg.rose ? `rgba(255,110,120,${0.5 + 0.5 * k})` : tg.wyv ? `rgba(235,245,255,${0.5 + 0.5 * k})` : `rgba(120,245,255,${0.5 + 0.5 * k})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r, tg.r * 0.55, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r * k, tg.r * 0.55 * k, 0, 0, Math.PI * 2); c.fill();
    }

    /* Hexbearer corruption pools */
    for (const q of G.hexPools || []) {
      const k = Math.min(1, q.t / 0.6) * Math.min(1, (q.life - q.t) / 0.8), pulse = 0.85 + 0.15 * Math.sin(t * 4 + q.x);
      c.fillStyle = `rgba(20,120,130,${0.32 * k})`;
      c.strokeStyle = `rgba(90,235,245,${0.55 * k})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(q.x, q.y, q.r * pulse, q.r * 0.55 * pulse, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    drawReaperGround(c, G, t); // the Chain Reaper's Violet Snare and Violet Gyre rings
    drawWallCracks(c, G, t); // the molten cracks under the Flame Bastion's walls

    /* y-sorted scene */
    const list = [];
    const m = 120;
    W.near(cam.x, cam.y, Math.max(vw, vh) / 2 + m, (o) => {
      if (o.x < left - m || o.x > view.right + m || o.y < top - 40 || o.y > view.bottom + 160) return;
      const name = objSprite(o);
      if (name) list.push({ y: o.y, f: () => drawObject(c, G, o, name) });
    });
    pushCamp(list, G, c, t);
    DL.Cave.push(list, c, t, view);
    DL.Rose.push(list, c, t, view);
    DL.Trophies.push(list, c);
    DL.Outposts.push(list, c, t, view, sprite, Art.drawFire, bar);
    DL.Fred.push(list, c, t, view);
    DL.Wyvern.push(list, c, t, view);
    DL.Finale.push(list, c, t, view);
    for (const tr of G.torches) list.push({ y: tr.y, f: () => drawTorch(c, tr, t) });
    // Flame Bastion walls: flames that shoot up from the middle outward as the wall rises, and sink as it dies
    for (const w of G.walls || []) {
      if (Art.sprites.wallFire1) { pushWallFire(list, c, w, t); continue; }
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), n = Math.max(2, Math.round(len / 12)), f = Math.min(1, w.t / 1);
      const up = Math.min(1, (w.max - w.t) / 0.35);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = w.x1 + (w.x2 - w.x1) * u, y = w.y1 + (w.y2 - w.y1) * u;
        const g = Math.max(0, Math.min(1, up * 2 - Math.abs(u - 0.5) * 2)); // the middle first, then out to the ends
        const size = (1.7 + 0.35 * Math.sin(t * 9 + i * 1.7) + (i % 2) * 0.3) * f * g;
        if (size > 0.05) list.push({ y, f: () => Art.drawFire(c, x, y, size, t + i) });
      }
    }
    for (const z of G.lightZones) if (z.fire) list.push({ y: z.y, f: () => Art.drawFire(c, z.x, z.y, 0.7 * Math.min(1, z.t), t + z.x) });
    for (const k of G.pickups) list.push({ y: k.y, f: () => drawPickup(c, k, t) });
    for (const e of G.enemies) {
      if (e.x < left - 100 || e.x > view.right + 100 || e.y < top - 40 || e.y > view.bottom + 140) continue;
      list.push({ y: e.y, f: () => drawEnemy(c, e, t) });
    }
    for (const f of G.effects) if (f.type === "dissolve") list.push({ y: f.e.y, f: () => drawDissolve(c, f) });
    for (const h of G.hounds) list.push({ y: h.y, f: () => drawHound(c, h, t) });
    for (const m of G.golems) list.push({ y: m.y, f: () => drawGolem(c, m, t) });
    for (const k of G.kindles) list.push({ y: k.y, f: () => drawKindle(c, k, t) });
    const kb = DL.Kindle.broken();
    if (kb) list.push({ y: kb.y, f: () => drawKindleBroken(c, kb, t) });
    for (const w of G.wraiths) list.push({ y: w.y, f: () => drawWraith(c, w, t) });
    for (const w of G.stoneWalls) for (let i = 0; i < 3; i++) {
      const u = (i - 1) / 3, x = w.x + Math.cos(w.ang) * w.len * u, y = w.y + Math.sin(w.ang) * w.len * u;
      list.push({ y, f: () => drawWallRock(c, w, i, x, y, t) });
    }
    const den = DL.Den.state();
    for (const b of den.bodies) list.push({ y: b[1], f: () => drawCarcass(c, b) });
    if (G.player && G.state !== "dead") list.push({ y: G.player.y, f: () => drawPlayer(c, G, t) });
    for (const a of G.allies) list.push({ y: a.y, f: () => drawAlly(c, a, t) });
    // the Chain Reaper's sickle flying out on its chain, and the coil round a snared Drowned's ankles
    const pl = G.player;
    if (pl && pl.swing && pl.swing.kind === "chain") list.push({ y: pl.y + 1, f: () => drawThrow(c, pl.x, pl.y, pl.swing, t) });
    for (const a of G.allies) if (a.swing && a.swing.kind === "chain" && !a.down) list.push({ y: a.y + 1, f: () => drawThrow(c, a.x, a.y, a.swing, t) });
    if (Art.sprites.reaperSnared) for (const e of G.enemies) if (e.snareT > 0 && !e.removed) list.push({ y: e.y + 1, f: () => sprite(c, "reaperSnared", e.x, e.y + 5, false, Math.min(1, e.snareT * 3)) });
    // Jade Tide's crystals: cracking up, grown (glinting now and then), shattering in their last moments
    if (Art.sprites.jadeCrystal2) for (const cr of DL.Kits.crystals()) {
      if (cr.at > 0) continue;
      const left = cr.max - cr.t, f = cr.t < 0.08 ? 1 : left < 0.25 ? 4 : (Math.floor(G.t * 3 + cr.x) % 4 === 0 ? 3 : 2);
      list.push({ y: cr.y, f: () => sprite(c, "jadeCrystal" + f, cr.x, cr.y + 8, cr.flip, f === 4 ? Math.max(0, left / 0.25) : 1) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f();

    /* non-glowing particles */
    for (const f of G.effects) if (f.type === "shatter") drawShatter(c, f);
    for (const f of G.effects) {
      if (f.type !== "p") continue;
      const a = 1 - f.t / f.max;
      c.globalAlpha = a;
      c.fillStyle = f.col;
      c.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    c.globalAlpha = 1;

    /* darkness + light */
    drawLighting(G, c, left, top, z, shx, shy);
    toWorld();

    /* glowing things drawn above the darkness */
    c.globalCompositeOperation = "lighter";
    for (const b of G.projectiles) drawProjectile(c, b);
    for (const b of G.netProjectiles || []) drawProjectile(c, b);
    for (const a of G.allies) {
      for (const q of a.proj || []) drawProjectile(c, { x: q[0], y: q[1], vx: q[2], vy: q[3], kind: q[4], col: q[5], hostile: false, life: 1 });
      const s = a.swing;
      if (s && !a.down && s.kind === "arc") drawSlash(c, a.x, a.y - 24, s.ang, s.arc, s.range, Math.min(1, s.t / s.dur), s.col, 9, s.flip);
    }
    for (const f of G.effects) {
      if (f.type === "spark") {
        const a = 1 - f.t / f.max;
        c.fillStyle = `rgba(${f.col},${a})`;
        c.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      } else if (f.type === "erupt") {
        // the Flame Bastion's eruption: a front of fire racing from the knight to where the wall rises
        const k = f.t / f.max, d = f.reach * Math.min(1, k * 1.3), n = Math.max(3, Math.round(f.h / 14));
        for (let i = -n; i <= n; i++) {
          const w = (i / n) * f.h * Math.min(1, 0.3 + k), x = f.x + f.ux * d - f.uy * w, y = f.y + f.uy * d + f.ux * w;
          Art.drawFire(c, x, y, (2.2 - k * 1.2) * (1 - Math.abs(i / n) * 0.4), t + i);
        }
      } else if (f.type === "flare" && Art.sprites.arbFlare1) {
        // the Ashen Arbalist's drawn burst of light, spark -> star and ring -> fading ring
        const s = Art.sprites["arbFlare" + Math.min(4, 1 + Math.floor((f.t / f.max) * 4))], w = s.w * PS * f.s, h = s.h * PS * f.s;
        c.drawImage(s.c, Math.round(f.x - w / 2), Math.round(f.y + 12 * f.s - h), w, h); // the ring's front edge on the ground
      } else if (f.type === "ring") {
        const k = f.t / f.max, r = f.r0 + (f.r1 - f.r0) * Math.sqrt(k);
        c.strokeStyle = `rgba(${f.col},${(1 - k) * 0.9})`;
        c.lineWidth = f.w * (1 - k) + 1;
        c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.7, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.type === "slash") {
        drawSlash(c, f.x, f.y, f.ang, f.arc, f.r, f.t / f.max, f.col, f.w, false);
      } else if (f.type === "golemBeam") {
        // Derek calling a wall up: a cyan thread from his heart to the ground where it rises
        const k = f.t / f.max;
        c.strokeStyle = `rgba(90,235,245,${0.9 * (1 - k)})`;
        c.lineWidth = 4 * (1 - k) + 1;
        c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke();
        c.strokeStyle = `rgba(90,235,245,${0.7 * (1 - k)})`;
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(f.x2, f.y2 + 10, 20 + 30 * k, (20 + 30 * k) * 0.5, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.type === "kindleRefill") {
        // Kindle tipping flame into a lantern: embers arcing from him to it
        const k = f.t / f.max;
        for (let i = 0; i < 6; i++) {
          const u = Math.min(1, k * 1.6 - i * 0.08);
          if (u <= 0) continue;
          const x = f.x1 + (f.x2 - f.x1) * u, y = f.y1 + (f.y2 - f.y1) * u - Math.sin(Math.PI * u) * 26;
          c.fillStyle = `rgba(255,${170 + i * 10},80,${0.9 * (1 - k)})`;
          c.beginPath(); c.arc(x, y, 3 - i * 0.3, 0, Math.PI * 2); c.fill();
        }
      } else if (f.type === "soulPulse") {
        // Abigail's blessing: souls stream from her to her knight, then a ring of soul-light at their feet
        const k = f.t / f.max;
        for (let i = 0; i < 5; i++) {
          const u = Math.min(1, k * 2 - i * 0.1);
          if (u <= 0) continue;
          const x = f.x1 + (f.x2 - f.x1) * u, y = f.y1 + (f.y2 - f.y1) * u - Math.sin(Math.PI * u) * 18;
          c.fillStyle = `rgba(${SOUL},${0.9 * (1 - k)})`;
          c.beginPath(); c.arc(x, y, 3.2 - i * 0.4, 0, Math.PI * 2); c.fill();
        }
        if (k > 0.4) {
          const q = (k - 0.4) / 0.6, r = 12 + 26 * q;
          c.strokeStyle = `rgba(${SOUL},${0.85 * (1 - q)})`;
          c.lineWidth = 3 * (1 - q) + 1;
          c.beginPath(); c.ellipse(f.x2, f.y2 + 24, r, r * 0.45, 0, 0, Math.PI * 2); c.stroke();
        }
      } else if (f.type === "pillar") {
        // level-up: a column of the kit's light rising from the knight
        const k = f.t / f.max, a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * 0.5);
        const w = f.big ? 46 : 28, h = f.big ? 260 : 170;
        const g = c.createLinearGradient(0, f.y, 0, f.y - h);
        g.addColorStop(0, `rgba(${f.col},${0.8 * a})`); g.addColorStop(1, `rgba(${f.col},0)`);
        c.fillStyle = g;
        c.fillRect(f.x - w / 2, f.y - h, w, h);
        c.fillStyle = `rgba(255,255,240,${0.6 * a})`;
        c.fillRect(f.x - w / 8, f.y - h * 0.9, w / 4, h * 0.9);
      } else if (f.type === "howl") {
        // the Grave Warg's howl, Abigail's wail, a Bastion wall bursting: a ring rolling out
        const k = f.t / f.max, r = (f.r || 150) * Math.sqrt(k), col = f.col || "190,150,255";
        c.strokeStyle = `rgba(${col},${0.8 * (1 - k)})`;
        c.lineWidth = 5 * (1 - k) + 1;
        c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.type === "roseBind") {
        // the Rose Heart lashing out: a red thread of briar from the heart to its prey
        const k = f.t / f.max;
        c.strokeStyle = `rgba(220,40,60,${0.85 * (1 - k)})`;
        c.lineWidth = 3 * (1 - k) + 1;
        c.beginPath(); c.moveTo(f.x1, f.y1); c.quadraticCurveTo((f.x1 + f.x2) / 2, Math.min(f.y1, f.y2) - 40, f.x2, f.y2); c.stroke();
      } else if (f.type === "bellToll") {
        // the Bell Tower tolling: rings from the bell, and a long arrow of sound toward where the wave will come from
        const k = f.t / f.max, b = DL.Camp.layout(G.save.up).bell;
        if (b) for (let i = 0; i < 3; i++) {
          const q = (k * 1.5 - i * 0.2);
          if (q <= 0 || q >= 1) continue;
          c.strokeStyle = `rgba(255,200,120,${0.7 * (1 - q)})`;
          c.lineWidth = 2;
          c.beginPath(); c.ellipse(b.x, b.y - 40, 14 + 60 * q, (14 + 60 * q) * 0.6, 0, 0, Math.PI * 2); c.stroke();
        }
        const R0 = DL.WALL_R + 20, ux = Math.cos(f.a), uy = Math.sin(f.a);
        c.strokeStyle = `rgba(255,120,80,${0.8 * (1 - k)})`;
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(ux * R0, uy * R0); c.lineTo(ux * (R0 + 120), uy * (R0 + 120)); c.stroke();
      } else if (f.type === "spikes") {
        const k = f.t / f.max;
        c.fillStyle = `rgba(120,245,255,${1 - k})`;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2, x = f.x + Math.cos(a) * f.r * 0.5, y = f.y + Math.sin(a) * f.r * 0.3;
          const h = 26 * (1 - k * 0.6);
          c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x, y - h); c.lineTo(x + 3, y); c.fill();
        }
      }
    }
    const p = G.player;
    if (p && p.swing) {
      const s = p.swing, k = s.t / s.dur;
      if (s.kind === "arc") drawSlash(c, p.x, p.y - 24, s.ang, s.arc, s.range, k, s.col, 9, s.flip);
      else if (s.kind === "thrust") {
        // a lance of light along the pike's line
        const ux = Math.cos(s.ang), uy = Math.sin(s.ang), x0 = p.x + ux * 14, y0 = p.y - 26 + uy * 8;
        const reach = s.range * Math.min(1, k * 2.2);
        c.strokeStyle = `rgba(${s.col},${0.9 * (1 - k)})`;
        c.lineWidth = 7 * (1 - k) + 1;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + ux * reach, y0 + uy * reach); c.stroke();
        c.fillStyle = `rgba(255,250,230,${1 - k})`;
        c.fillRect(x0 + ux * reach - 2, y0 + uy * reach - 2, 4, 4);
      } else if (k < 0.5) {
        const ux = Math.cos(s.ang), uy = Math.sin(s.ang), r = 10 * (1 - k * 2);
        const g = c.createRadialGradient(p.x + ux * 18, p.y - 28, 0, p.x + ux * 18, p.y - 28, r + 6);
        g.addColorStop(0, `rgba(${s.col},0.9)`); g.addColorStop(1, `rgba(${s.col},0)`);
        c.fillStyle = g; c.fillRect(p.x + ux * 18 - r - 6, p.y - 34 - r, (r + 6) * 2, (r + 6) * 2);
      }
    }
    if (p && G.state !== "title") drawKitGlow(c, G, p, t);
    if (p && G.state === "play" && G.save.attackMode === "manual") {
      // where a manual strike will go
      const a = p.aim != null ? p.aim : p.angle, r0 = 30, r1 = 40;
      const x0 = p.x + Math.cos(a) * r0, y0 = p.y - 22 + Math.sin(a) * r0 * 0.75;
      const x1 = p.x + Math.cos(a) * r1, y1 = p.y - 22 + Math.sin(a) * r1 * 0.75;
      c.strokeStyle = `rgba(${DL.Kits.color()},0.55)`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x0 + Math.cos(a + 2.4) * 6, y0 + Math.sin(a + 2.4) * 6); c.lineTo(x1, y1); c.lineTo(x0 + Math.cos(a - 2.4) * 6, y0 + Math.sin(a - 2.4) * 6);
      c.stroke();
    }
    for (const e of G.enemies) if (e.rise <= 0 && !e.def.king && !(e.def.rose && e.dormant && Art.sprites.roseBud)) drawEyes(c, e, t);
    for (const h of G.hounds) drawHoundEyes(c, h, t);
    // once the pack is broken, the carcasses glow faintly so you can find one to carry home
    if (den.cleared && !DL.Hounds.mine()) for (const b of den.bodies) {
      const a = 0.25 + 0.12 * Math.sin(t * 3 + b[0]), g = c.createRadialGradient(b[0], b[1] - 10, 0, b[0], b[1] - 10, 30);
      g.addColorStop(0, `rgba(230,215,170,${a})`); g.addColorStop(1, "rgba(230,215,170,0)");
      c.fillStyle = g;
      c.fillRect(b[0] - 30, b[1] - 40, 60, 60);
    }
    for (const m of G.golems) drawGolemHeart(c, m, t);
    drawFormEmbers(c, G, t);
    DL.Cave.drawGlow(c, t);
    DL.Rose.drawGlow(c, t, view);
    for (const k of G.kindles) drawKindleGlow(c, k, t);
    drawSoulGlow(c, G, view, t);
    DL.Fred.glow(c, t, view);
    DL.Wyvern.glow(c, t, view);
    DL.Finale.glow(c, t, view);
    if (kb && Math.sin(t * 1.3) > 0.6) { c.fillStyle = "rgba(255,110,50,0.35)"; c.fillRect(kb.x - 2, kb.y - 8, 4, 4); }
    drawMotes(c, G, view, t);
    c.globalCompositeOperation = "source-over";

    /* floating text */
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.textAlign = "center";
    for (const tx of G.texts) {
      const a = 1 - tx.t / tx.max;
      const sx = (tx.x - left) * z, sy = (tx.y - top) * z;
      c.font = `700 ${Math.round(13 * tx.scale)}px Inter, system-ui, sans-serif`;
      c.globalAlpha = a;
      c.fillStyle = "rgba(0,0,0,0.75)";
      c.fillText(tx.txt, sx + 1, sy + 1);
      c.fillStyle = tx.col;
      c.fillText(tx.txt, sx, sy);
    }
    c.globalAlpha = 1;

    /* co-op: an arrow at the screen edge pointing to each friend who's out of view */
    for (const fr of G.state !== "title" ? G.allies : []) {
      const sx = (fr.x - left) * z, sy = (fr.y - 40 - top) * z, m = 34;
      if (sx < 0 || sy < 0 || sx > R.W || sy > R.H) {
        const cx = R.W / 2, cy = R.H / 2, a = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((R.W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (R.H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
        const ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
        c.save();
        c.translate(ex, ey);
        c.rotate(a);
        c.fillStyle = "rgba(231,217,255,0.9)";
        c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.fill();
        c.restore();
        c.font = "700 10px Inter, system-ui, sans-serif";
        c.textAlign = "center";
        c.fillStyle = "rgba(231,217,255,0.9)";
        c.fillText(fr.label || "Friend", ex - Math.cos(a) * 20, ey - Math.sin(a) * 20 + 3);
      }
    }

    /* screen overlays */
    c.drawImage(R.vignette, 0, 0, R.W, R.H);
    if (p && G.state !== "title") {
      const cor = p.corrupt / 100;
      if (cor > 0.3) {
        const a = (cor - 0.3) / 0.7 * (0.55 + 0.1 * Math.sin(t * 3));
        const gr = c.createRadialGradient(R.W / 2, R.H / 2, Math.min(R.W, R.H) * (0.5 - cor * 0.25), R.W / 2, R.H / 2, Math.max(R.W, R.H) * 0.7);
        gr.addColorStop(0, "rgba(0,30,35,0)");
        gr.addColorStop(1, `rgba(2,40,48,${a})`);
        c.fillStyle = gr;
        c.fillRect(0, 0, R.W, R.H);
      }
      if (p.hurtFlash > 0) {
        c.fillStyle = `rgba(150,20,20,${p.hurtFlash * 0.8})`;
        c.fillRect(0, 0, R.W, R.H);
      }
    }
    if (G.state === "dying" || G.state === "dead") {
      const k = Math.min(1, (G.dying || 3) / 2.6);
      c.fillStyle = `rgba(2,14,18,${k * 0.85})`;
      c.fillRect(0, 0, R.W, R.H);
    }
  };

  /* ---------- scene pieces ---------- */
  function drawObject(c, G, o, name) {
    const sh = o.type === "tree" ? 20 : o.type === "root" ? 40 : o.type === "den" ? (name === "boneDen" ? 62 : 96) : (o.type === "stone" && name !== "rock") || (o.type === "iron" && name !== "ironpile") ? 18 : 12;
    shadow(c, o.x, o.y, sh, sh * 0.35, 0.3);
    let x = o.x;
    const hit = o.hitT > 0 ? o.hitT / 0.18 : 0;
    if (hit) x += Math.sin(G.t * 80) * 2.5 * hit;
    c.save();
    if (hit && o.def.res) {
      // squash on impact
      c.translate(x, o.y);
      c.scale(1 + 0.08 * hit, 1 - 0.1 * hit);
      c.translate(-x, -o.y);
    }
    sprite(c, name, x, o.y + 2, o.flip);
    c.restore();
    if (o.def.bloom && !o.dead && o.hp < o.maxHp) bar(c, o.x, o.y - Art.sprites[name].h * PS - 6, 34, o.hp / o.maxHp, "#5fe6ee");
    // drawn boulders and trees show their damage in their own stages
    if (o.def.hits && o.mineHp != null && o.mineHp < o.def.hits && !/^(boulder|iron\d|amethyst|swampTree)/.test(name)) drawCracks(c, o, name, 1 - o.mineHp / o.def.hits);
  }

  // Damage on a supply node: dark cracks in stone and iron, pale splintered chips in wood and plants.
  function drawCracks(c, o, name, k) {
    const s = Art.sprites[name], w = s.w * PS, h = s.h * PS;
    const cx = o.x, cy = o.y + 2 - h * 0.45;
    const wood = o.type === "tree" || o.type === "sprout";
    c.strokeStyle = wood ? "rgba(214,182,130,0.9)" : "rgba(12,10,8,0.9)";
    c.lineWidth = 2;
    const n = Math.ceil(k * 3);
    for (let i = 0; i < n; i++) {
      let x = cx + (DL.hash(i, 1, o.x | 0) - 0.5) * w * 0.4, y = cy + (DL.hash(i, 2, o.y | 0) - 0.5) * h * 0.3;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 3; j++) {
        x += (DL.hash(i, j + 3, o.x | 0) - 0.5) * w * 0.35;
        y += (DL.hash(i, j + 7, o.y | 0) - 0.3) * h * 0.25;
        c.lineTo(Math.round(x), Math.round(y));
      }
      c.stroke();
    }
  }

  // A mined node breaking apart: pieces of its own sprite tumble out and fade.
  function drawShatter(c, f) {
    const s = Art.sprites[f.sprite];
    if (!s) return;
    const k = f.t / f.max;
    c.globalAlpha = Math.max(0, 1 - k * k);
    for (const pc of f.pieces) {
      const x = pc.x + pc.vx * f.t, y = pc.y + pc.vy * f.t + 320 * f.t * f.t;
      c.save();
      c.translate(x, y);
      c.rotate(pc.vr * f.t);
      const res = s.res || 1;
      c.drawImage(s.c, pc.sx * res, pc.sy * res, pc.sw * res, pc.sh * res, (-pc.sw * PS) / 2, (-pc.sh * PS) / 2, pc.sw * PS, pc.sh * PS);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  function bar(c, x, y, w, k, col) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 5);
    c.fillStyle = col;
    c.fillRect(Math.round(x - w / 2), Math.round(y), Math.max(0, w * k), 3);
  }

  /* ---------- base camp: grows through three tiers ---------- */
  function drawCampGround(c, G) {
    const L = DL.Camp.layout(G.save.up), R = DL.WALL_R;
    if (L.tier === 1) {
      c.strokeStyle = "rgba(90,75,55,0.35)";
      c.lineWidth = 3;
      c.setLineDash([6, 10]);
      c.strokeRect(-DL.CAMP_RADIUS, -DL.CAMP_RADIUS, DL.CAMP_RADIUS * 2, DL.CAMP_RADIUS * 2);
      c.setLineDash([]);
      return;
    }
    // trodden perimeter path and a flagstone plaza
    c.strokeStyle = "rgba(66,54,40,0.6)";
    c.lineWidth = 18;
    c.strokeRect(-(R - 34), -(R - 34), (R - 34) * 2, (R - 34) * 2);
    const floor = W.canvases[L.tier >= 3 ? "campPaving" : "campFlags"];
    if (floor) {
      // the drawn floor, one texel per 2 px like the ground, darkened to match it; the Beacon's is wider
      const pat = c.createPattern(floor, "repeat");
      pat.setTransform(new DOMMatrix().scale(2));
      const rx = L.tier >= 3 ? 104 : 80, ry = rx * 0.7;
      c.fillStyle = pat;
      c.beginPath(); c.rect(-rx, 6 - ry, rx * 2, ry * 2); c.fill();
      c.fillStyle = "rgba(0,0,0,0.2)"; c.fill();
      c.strokeStyle = "rgba(24,19,14,0.7)"; c.lineWidth = 3; c.stroke();
    } else {
      c.fillStyle = "#3a342b";
      c.beginPath(); c.ellipse(0, 4, 58, 40, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2c271f";
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        c.fillRect(Math.round(Math.cos(a) * 44) - 5, Math.round(4 + Math.sin(a) * 30) - 3, 10, 6);
      }
    }
    // boardwalks out to each gate (the Beacon's run on out over the marsh)
    const reach = L.tier >= 3 ? R + 140 : R + 36;
    const boards = W.canvases.boardwalk;
    if (boards) {
      // drawn planks at full size (a texel per px, so a plank is about half the walk wide), laid across the walk:
      // the texture's planks run left to right, so turn it for the east-west walks
      for (const g of DL.Camp.GATES) {
        const ux = Math.round(Math.cos(g)), uy = Math.round(Math.sin(g));
        const pat = c.createPattern(boards, "repeat");
        pat.setTransform(ux ? new DOMMatrix().rotate(90) : new DOMMatrix());
        const x0 = ux ? Math.min(ux * 44, ux * reach) : -14, y0 = uy ? Math.min(uy * 44, uy * reach) : -14;
        const w = ux ? reach - 44 : 28, h = uy ? reach - 44 : 28;
        c.fillStyle = "#1e150e"; c.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
        c.fillStyle = pat; c.fillRect(x0, y0, w, h);
        c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x0, y0, w, h);
      }
    } else for (const g of DL.Camp.GATES) {
      const ux = Math.round(Math.cos(g)), uy = Math.round(Math.sin(g));
      for (let r = 48, i = 0; r < reach; r += 8, i++) {
        const x = ux * r, y = uy * r;
        c.fillStyle = "#1e150e";
        if (ux) c.fillRect(x - 3, y - 14, 7, 28); else c.fillRect(x - 14, y - 3, 28, 7);
        c.fillStyle = i % 3 === 0 ? "#5a442e" : i % 2 ? "#4a3828" : "#533f2b";
        if (ux) c.fillRect(x - 3, y - 13, 6, 26); else c.fillRect(x - 13, y - 3, 26, 6);
      }
    }
  }

  // Drawn buildings have no shadow (the owner prefers them without); coded fallback art keeps a plain one.
  function groundShadow(c, name, x, y, flip, rx, ry) {
    if (!(Art.sprites[name] && Art.sprites[name].res)) shadow(c, x, y - 2, rx, ry);
  }

  function pushCamp(list, G, c, t) {
    const u = G.save.up, L = DL.Camp.layout(u), R = DL.WALL_R, night = G.nightAmt;
    const put = (y, f) => list.push({ y, f });
    for (const tn of L.tents) put(tn.y, () => { groundShadow(c, "tent", tn.x, tn.y + 4, tn.flip, 26, 7); sprite(c, "tent", tn.x, tn.y + 4, tn.flip); });
    for (const b of L.banners) put(b.y, () => { shadow(c, b.x, b.y + 1, 6, 2); sprite(c, "banner", b.x, b.y + 2); });
    // drawn buildings have a picture per level; the coded ones are the fallback
    const drawn = Art.sprites.forge1;
    const building = (b, name) => { groundShadow(c, name, b.x, b.y + 4, false, Art.sprites[name].w * 0.75, 7); sprite(c, name, b.x, b.y + 4); };
    if (L.forge) put(L.forge.y, () => building(L.forge, drawn ? "forge" + u.forge : "forge"));
    if (L.armory) put(L.armory.y, () => {
      if (drawn) return building(L.armory, "armory" + u.armory);
      shadow(c, L.armory.x, L.armory.y + 2, 26, 7);
      if (L.tier >= 2) sprite(c, "awning", L.armory.x, L.armory.y + 4);
      sprite(c, "rack", L.armory.x, L.armory.y + 4);
    });
    if (L.workbench) put(L.workbench.y, () => {
      if (drawn) return building(L.workbench, "workbench" + u.workbench);
      shadow(c, L.workbench.x, L.workbench.y + 2, 26, 7);
      if (L.tier >= 2) sprite(c, "awning", L.workbench.x, L.workbench.y + 4, true);
      sprite(c, "workbench", L.workbench.x, L.workbench.y + 4);
    });
    if (L.garden) put(L.garden.y - 20, () => drawGarden(c, L.garden, u.garden, night, t));
    // the companions' homes (a picture per level) and the Abyss trophies
    for (const k of ["kennel", "workshop", "shrine", "toadstool", "roost"]) if (L[k]) put(L[k].y, () => building(L[k], k + u[k]));
    if (L.bell) put(L.bell.y, () => building(L.bell, "bellTower"));
    if (L.roseheart) put(L.roseheart.y, () => drawRoseHeart(c, L.roseheart, u.roseheart, night, t));
    for (const tw of L.towers) put(tw.y, () => { const n = drawn ? "tower" + u.tower : "tower"; groundShadow(c, n, tw.x, tw.y + 4, false, 20, 6); sprite(c, n, tw.x, tw.y + 4); });
    const pyl = drawn ? "pylon" + u.pylon : "pylon", lamps = drawn ? PYLON_LAMPS[u.pylon] : [[-11, -77], [11, -77]];
    for (const q of G.pylons) put(q.y, () => {
      groundShadow(c, pyl, q.x, q.y + 4, false, 10, 3);
      sprite(c, pyl, q.x, q.y + 4);
      if (q.lit) for (const [ox, oy] of lamps) lampFlame(c, q.x + ox, q.y + oy);
      if (q.hp < q.max) bar(c, q.x, q.y - 120, 24, q.hp / q.max, "#ffb35a");
    });
    // barricade: stakes, then a palisade with four gates
    if (u.stakes === 1) {
      DL.Camp.ring(R - 10, 52).forEach(({ x, y }, i) => put(y, () => sprite(c, "stake", x, y + 2, i % 2 === 0)));
    } else if (u.stakes >= 2) {
      const rf = u.stakes >= 3 && Art.sprites.palisade2 ? "2" : "";
      if (Art.sprites.palisadeSide) {
        // drawn walls: front-facing sections along the north and south, side-on strips down the east and
        // west (packed closer, as each covers less ground), and a post at each corner
        const n = Math.round((2 * R) / 46);
        for (let i = 1; i < n; i++) for (const y of [-R, R]) {
          const x = -R + (2 * R * i) / n;
          if (Math.abs(x) < DL.Camp.GATE_HALF + 22) continue;
          put(y, () => sprite(c, "palisade" + rf, x, y + 4, i % 2 === 0));
        }
        const m = Math.round((2 * R) / SIDE_STEP);
        for (let i = 1; i < m; i++) for (const x of [-R, R]) {
          const y = -R + (2 * R * i) / m;
          if (Math.abs(y) < DL.Camp.GATE_HALF + 14) continue;
          put(y, () => sprite(c, "palisadeSide" + rf, x, y + 4, x > 0));
        }
        for (const x of [-R, R]) for (const y of [-R, R]) put(y + 1, () => sprite(c, "cornerPost" + rf, x, y + 4, x > 0));
      } else DL.Camp.ring(R, 46).forEach(({ x, y }, i) => {
        if (DL.Camp.nearestGate(x, y).arc < DL.Camp.GATE_HALF + 22) return;
        put(y, () => sprite(c, "palisade" + rf, x, y + 4, i % 2 === 0));
      });
      for (const g of DL.Camp.GATES) for (const sgn of [-1, 1]) {
        const { x, y } = DL.Camp.gatePoint(g, sgn * (DL.Camp.GATE_HALF + 6), 0);
        put(y + 1, () => {
          if (u.stakes >= 3 && Art.sprites.gatePost2) {
            // the reinforced post carries its own lamp, hung out on the side away from the gate
            sprite(c, "gatePost2", x, y + 4, sgn > 0);
            lampFlame(c, x + (sgn > 0 ? -GATE_LAMP[0] : GATE_LAMP[0]), y + GATE_LAMP[1]);
            return;
          }
          sprite(c, "gatePost", x, y + 4, sgn > 0);
          if (u.stakes >= 3) {
            c.fillStyle = "#2a2622"; c.fillRect(x + (sgn > 0 ? -14 : 6), y - 62, 8, 11);
            c.fillStyle = "#ffab3d"; c.fillRect(x + (sgn > 0 ? -12 : 8), y - 60, 4, 7);
          }
        });
        if (u.stakes >= 3) {
          // spikes flanking each gate on the outside
          for (let k = 0; k < 3; k++) {
            const { x: sx, y: sy } = DL.Camp.gatePoint(g, sgn * (DL.Camp.GATE_HALF + 4 + k * 9), 22);
            put(sy, () => sprite(c, "stake", sx, sy + 2, k % 2 === 0));
          }
        }
      }
    }
    // the Central Flame: stone ring → raised fire pit → iron beacon
    const f = G.flame;
    put(2, () => {
      const lvl = u.flame;
      let fy = 2;
      if (Art.sprites.flame1) { const y = [10, 14, 12][L.tier - 1]; sprite(c, "flame" + L.tier, 0, y); fy = FLAME_FIRE[L.tier]; }
      else if (L.tier === 1) sprite(c, "firering", 0, 10);
      else if (L.tier === 2) { sprite(c, "firepit2", 0, 14); fy = -2; }
      else { shadow(c, 0, 8, 40, 10, 0.45); sprite(c, "brazierBig", 0, 12); fy = -46; }
      if (f.lit) Art.drawFire(c, 0, fy, 1.6 + lvl * 0.25 + (f.hitT > 0 ? -0.4 : 0), t);
      else { c.fillStyle = "#6a2a14"; c.fillRect(-4, fy - 4, 3, 2); c.fillRect(3, fy - 2, 2, 2); }
      if (f.lit && f.hp < f.max) bar(c, 0, fy - 50 - lvl * 4, 46, f.hp / f.max, "#ffb35a");
    });
  }

  /* The Rose Heart: Robert's drawing of each level once it's in (roseHeart1–3); till then the Deadly Rose's own bud,
     smaller, in a ring of stones, swelling with each level and breathing slowly. */
  function drawRoseHeart(c, h, lvl, night, t) {
    const own = Art.sprites["roseHeart" + lvl];
    if (own) return sprite(c, "roseHeart" + lvl, h.x, h.y + 4);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      c.fillStyle = i % 2 ? "#32363a" : "#4c5052";
      c.beginPath(); c.ellipse(h.x + Math.cos(a) * 26, h.y + 2 + Math.sin(a) * 9, 5, 3.5, 0, 0, Math.PI * 2); c.fill();
    }
    const bud = Art.sprites.roseBud;
    if (!bud) { c.fillStyle = "#8a1424"; c.beginPath(); c.ellipse(h.x, h.y - 18, 12, 18, 0, 0, Math.PI * 2); c.fill(); return; }
    const k = [0, 0.3, 0.37, 0.44][lvl] * (1 + Math.sin(t * (night > 0.3 ? 2.4 : 1.2)) * 0.015), w = bud.w * PS * k, hh = bud.h * PS * k;
    c.drawImage(bud.c, Math.round(h.x - w / 2), Math.round(h.y + 4 - hh), Math.round(w), Math.round(hh));
  }

  // Where the fire sits in each drawn Central Flame (on its coals), and the lamp glass on each drawn pylon
  // level and on the reinforced gate post, relative to where they stand.
  const FLAME_FIRE = { 1: -12, 2: -34, 3: -68 };
  const PYLON_LAMPS = { 1: [[-20, -74], [17, -58]], 2: [[-19, -71], [17, -62]], 3: [[-24, -71], [23, -63]] };
  const GATE_LAMP = [31, -56];
  const SIDE_STEP = 18; // ground each side-on wall strip covers, north to south
  function lampFlame(c, x, y) {
    c.fillStyle = "#ffab3d"; c.fillRect(Math.round(x) - 3, Math.round(y) - 5, 6, 10);
    c.fillStyle = "#fff1c2"; c.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 5);
  }

  // The drawn bed for each plot level: its soil's left, back and front corners in the PNG's pixels. Flowers
  // go in rows of six along the furrows, which run from the left corner toward the front one.
  const BED_SOIL = { 1: [[22, 44], [63, 20], [75, 72]], 2: [[16, 42], [56, 22], [65, 66]], 3: [[18, 62], [56, 36], [70, 92]] };
  const BED_ROWS = { 1: [0.5], 2: [0.68, 0.32], 3: [0.8, 0.5, 0.2] };

  function drawGarden(c, g, lvl, night, t) {
    const bed = Art.sprites["gardenBed" + lvl];
    if (bed && Art.sprites.gardenOn) {
      sprite(c, "gardenBed" + lvl, g.x, g.y + 4);
      const [L, T, B] = BED_SOIL[lvl], x0 = g.x - (bed.w * PS) / 2, y0 = g.y + 4 - bed.h * PS;
      // back rows first, so the front ones overlap them
      for (const v of BED_ROWS[lvl]) for (let i = 0; i < 6; i++) {
        const u = 0.1 + (0.8 * i) / 5;
        const x = L[0] + u * (B[0] - L[0]) + v * (T[0] - L[0]), y = L[1] + u * (B[1] - L[1]) + v * (T[1] - L[1]);
        sprite(c, night > 0.3 ? "gardenOn" : "gardenOff", Math.round(x0 + x), Math.round(y0 + y + 3));
      }
      return;
    }
    sprite(c, "garden", g.x, g.y + 4);
    const n = [0, 6, 12, 18][lvl];
    for (let i = 0; i < n; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const x = g.x - 40 + col * 16 + (row % 2) * 6, y = g.y - 40 + row * 18;
      const pulse = 0.6 + 0.4 * Math.sin(t * 2 + i);
      c.fillStyle = "#2b3e2c"; c.fillRect(x, y - 2, 2, 8); c.fillRect(x - 3, y + 2, 3, 2); c.fillRect(x + 2, y, 3, 2);
      c.fillStyle = night > 0.3 ? `rgba(127,246,255,${0.6 + 0.4 * pulse})` : "#1d4d55";
      c.fillRect(x - 1, y - 6, 4, 5);
      if (night > 0.3) { c.fillStyle = "#e9ffff"; c.fillRect(x, y - 5, 2, 2); }
    }
  }

  function drawTorch(c, tr, t) {
    if (tr.type === "brazier") {
      shadow(c, tr.x, tr.y, 12, 4);
      sprite(c, "brazier", tr.x, tr.y + 2);
      Art.drawFire(c, tr.x, tr.y + 14 - Art.sprites.brazier.h * PS, 1.1, t);
    } else {
      shadow(c, tr.x, tr.y, 6, 3);
      sprite(c, "torch", tr.x, tr.y + 2);
      const k = tr.t < 8 ? tr.t / 8 : 1;
      Art.drawFire(c, tr.x, tr.y + 10 - Art.sprites.torch.h * PS, 0.5 + 0.5 * k, t);
    }
    if (tr.hp < (tr.type === "brazier" ? 60 : 40)) bar(c, tr.x, tr.y - 64, 22, tr.hp / (tr.type === "brazier" ? 60 : 40), "#ffb35a");
  }

  function drawPickup(c, k, t) {
    const y = k.y - 6 - Math.abs(Math.sin(t * 5 + k.x)) * 3;
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.fillRect(k.x - 3, k.y - 1, 6, 2);
    // the drawn supply (resWood, resStone ...), bobbing above its spot; else a coloured square
    const name = "res" + k.res[0].toUpperCase() + k.res.slice(1);
    if (Art.sprites[name]) return sprite(c, name, k.x, y + 6);
    c.fillStyle = "#07090a";
    c.fillRect(k.x - 4, y - 4, 8, 8);
    c.fillStyle = DL.RESOURCES[k.res].color;
    c.fillRect(k.x - 3, y - 3, 6, 6);
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillRect(k.x - 2, y - 2, 2, 2);
  }

  // Walk frames per second: `rate` is for a 4-frame walk, and longer walks play faster so a stride takes as long.
  const walkRate = (key, rate) => (rate * Art.animLength(key, "walk")) / 4;

  // A kit with its own casting pose (the Chain Reaper whirling his chain) shows it for its ability; the rest swing.
  const castAnim = (key) => (Art.sheet(key).down.cast ? "cast" : "attack");

  // Which animation the player shows this frame: [anim, frame, facing angle].
  function playerAnim(G, p, t) {
    if (G.state === "dying") return ["death", Math.min(2, Math.floor(G.dying / 0.45)), p.angle];
    if (p.dashT > 0) return ["dash", 0, p.angle];
    if (p.hurtFlash > 0.15) return ["hurt", 0, p.angle];
    if (p.swing) return ["attack", Math.min(2, Math.floor((p.swing.t / p.swing.dur) * 3)), p.swing.ang];
    if (p.cast) return [castAnim(G.save.kit + p.stage), Math.min(2, Math.floor((p.cast.t / p.cast.dur) * 3)), p.cast.ang];
    if (p.moving) return ["walk", Math.floor(p.animT * walkRate(G.save.kit + p.stage, 6)), p.angle];
    return ["idle", Math.floor(t * 1.6), p.angle];
  }

  function drawPlayer(c, G, t) {
    const p = G.player;
    if (p.held) return; // inside the Starved Bell
    const key = G.save.kit + (G.state === "dying" ? 4 : p.stage);
    for (const tr of p.trail) Art.drawUnit(c, key, "dash", 0, tr.ang, tr.x, tr.y, 1, { alpha: tr.life * 1.4, flash: 0.5, flashColor: "#ffd59a" });
    shadow(c, p.x, p.y, 15, 5);
    const [anim, fr, ang] = playerAnim(G, p, t);
    let alpha = 1;
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2) alpha = 0.65;
    if (p.downT > 0) { Art.drawUnit(c, key, "death", 2, ang, p.x, p.y, 1, { alpha: 0.5 }); return; }
    Art.drawUnit(c, key, anim, fr, ang, p.x, p.y, 1, { alpha, flash: p.flash > 0 ? 0.7 : 0, flashColor: "#ff9a9a" });
  }

  // The co-op friend: their own kit and corruption, animated from what their device reports.
  function drawAlly(c, a, t) {
    if (a.swallowed) return; // inside the Starved Bell
    const key = a.kit + (a.stage || 1);
    shadow(c, a.x, a.y, 15, 5);
    if (a.down) { Art.drawUnit(c, key, "death", 2, a.angle, a.x, a.y, 1, { alpha: 0.5 }); }
    else {
      let anim = "idle", fr = Math.floor(t * 1.6), ang = a.angle;
      if (a.dashT > 0) anim = "dash";
      else if (a.swing) { anim = "attack"; fr = Math.min(2, Math.floor((a.swing.t / a.swing.dur) * 3)); ang = a.swing.ang; }
      else if (a.cast) { anim = castAnim(key); fr = Math.min(2, Math.floor(a.cast * 3)); }
      else if (a.moving) { anim = "walk"; fr = Math.floor(a.animT * walkRate(key, 6)); }
      Art.drawUnit(c, key, anim, fr, ang, a.x, a.y, 1);
    }
    // name tag + health
    const label = a.label || "Friend";
    c.font = "700 9px Inter, system-ui, sans-serif";
    c.textAlign = "center";
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillText(label, a.x + 1, a.y - 87);
    c.fillStyle = "#ffe6c2";
    c.fillText(label, a.x, a.y - 88);
    if (!a.down) bar(c, a.x, a.y - 84, 26, Math.max(0, a.hp) / (a.maxHp || 100), "#c8484e");
  }

  const unitKey = (e) => (e.isSelf ? "self_" + DL.Game.save.kit : e.def.beast ? "boneHound" : e.type);

  function enemyAnim(e, t) {
    if (e.state === "windup") return ["attack", 0, e.aim];
    if (e.state === "recover") return ["attack", e.stT > 0.2 ? 1 : 2, e.aim];
    if (e.moving) return ["walk", Math.floor(e.animT * walkRate(unitKey(e), e.def.crawl ? 8 : 5.5)), e.angle];
    return ["idle", Math.floor(t * 1.6 + e.animT), e.angle];
  }

  /* The Chain Reaper's Sickle Throw: the sickle spins out along each line to the throw's reach and back (out at
     half time), its chain run out from the hand behind it. Drawn in code if the drawn pieces haven't loaded. */
  function drawThrow(c, x, y, s, t) {
    const ch = Art.sprites.reaperChain, sk = Art.sprites["reaperSickle" + (1 + (Math.floor(t * 24) % 4))];
    const k = Math.min(1, s.t / s.dur), len = s.range * Math.sin(k * Math.PI);
    for (const a of s.angs || [s.ang]) {
      const hx = x + Math.cos(a) * 12, hy = y - 30 + Math.sin(a) * 6;
      c.save();
      c.translate(Math.round(hx), Math.round(hy));
      c.rotate(a);
      if (ch) {
        const tw = ch.w * PS, th = ch.h * PS;
        for (let d = 0; d < len; d += tw) {
          const seg = Math.min(tw, len - d);
          c.drawImage(ch.c, 0, 0, (seg / tw) * ch.c.width, ch.c.height, d, -th / 2, seg, th);
        }
      } else {
        c.strokeStyle = "#5c5468"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke();
      }
      c.translate(len, 0);
      c.rotate(t * 22);
      if (sk) c.drawImage(sk.c, (-sk.w * PS) / 2, (-sk.h * PS) / 2, sk.w * PS, sk.h * PS);
      else {
        c.strokeStyle = `rgb(${s.col})`; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 9, 0.4, Math.PI * 1.6); c.stroke();
      }
      c.restore();
    }
  }

  // The drawn fire wall: sections of flame lined up along the wall and overlapping, each flickering through
  // the four frames out of step with its neighbours, every other one mirrored so the pattern doesn't repeat.
  // Each section's sides are faded out (made once, below) so the overlaps blend into one ribbon of fire
  // instead of showing the hard edges as steps on a diagonal.
  const softFire = {};
  function wallFireFrame(k) {
    if (softFire[k]) return softFire[k];
    const s = Art.sprites["wallFire" + k], cv = document.createElement("canvas");
    cv.width = s.c.width; cv.height = s.c.height;
    const x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, cv.width, 0);
    x.drawImage(s.c, 0, 0);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.28, "rgba(0,0,0,1)");
    g.addColorStop(0.72, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.globalCompositeOperation = "destination-in";
    x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
    return (softFire[k] = { c: cv, w: s.w, h: s.h });
  }
  function pushWallFire(list, c, w, t) {
    // closer together where the wall runs across the screen at a slant, so the soft sides overlap
    const dx = Math.abs(w.x2 - w.x1), len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    const n = Math.max(1, Math.round(len / (dx / len > 0.95 ? 34 : 22)));
    const f = Math.min(1, w.t / 1), up = Math.min(1, (w.max - w.t) / 0.35);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = w.x1 + (w.x2 - w.x1) * u, y = w.y1 + (w.y2 - w.y1) * u;
      const g = Math.max(0, Math.min(1, up * 2 - Math.abs(u - 0.5) * 2)) * f; // the middle first, then out to the ends
      if (g < 0.05) continue;
      const s = wallFireFrame(1 + ((Math.floor(t * 10) + i * 3) % 4));
      // as wide as its share of the wall seen across the screen (and plenty to blend), so a wall running up the screen stays thin
      const span = Math.min(1, Math.max(0.55, (dx / n * 3) / (s.w * PS)));
      const sw = s.w * PS * span * (0.8 + 0.2 * g), sh = s.h * PS * 1.25 * g * (1 + 0.06 * Math.sin(t * 7 + i * 2.1));
      list.push({ y, f: () => {
        c.save();
        c.translate(Math.round(x), Math.round(y + 4));
        if (i % 2) c.scale(-1, 1);
        c.drawImage(s.c, Math.round(-sw / 2), Math.round(-sh), sw, sh);
        c.restore();
      } });
    }
  }

  // The molten crack a Flame Bastion wall stands in, glowing and pulsing, burning out as the wall dies.
  function drawWallCracks(c, G, t) {
    for (const w of G.walls || []) {
      const f = Math.min(1, w.t / 1) * Math.min(1, (w.max - w.t) / 0.2), pulse = 0.8 + 0.2 * Math.sin(t * 6 + w.x1);
      c.lineCap = "round";
      c.strokeStyle = `rgba(30,8,2,${0.7 * f})`; c.lineWidth = 12;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
      c.strokeStyle = `rgba(230,70,20,${0.85 * f * pulse})`; c.lineWidth = 6;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
      c.strokeStyle = `rgba(255,220,140,${0.9 * f * pulse})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
      c.lineCap = "butt";
    }
  }

  // Violet Snare's ring of whirled chain, flung out from the knight, and the Violet Gyre rings it leaves at level 20.
  function drawReaperGround(c, G, t) {
    const ring = Art.sprites.reaperSnare;
    const draw = (x, y, r, a, wob) => {
      if (ring) {
        const w = r * 2 * (1 + wob), h = r * 0.9 * (1 + wob);
        c.save(); c.globalAlpha = a;
        c.drawImage(ring.c, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
        c.restore();
      } else {
        c.strokeStyle = `rgba(176,120,255,${a})`; c.lineWidth = 4;
        c.beginPath(); c.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); c.stroke();
      }
    };
    for (const f of G.effects) {
      if (f.type !== "snare") continue;
      const k = f.t / f.max;
      draw(f.x, f.y, f.r * (0.35 + 0.65 * Math.sqrt(k)), 1 - k * k, 0);
    }
    for (const g of DL.Kits.gyres()) draw(g.x, g.y, g.r * 0.85, Math.min(1, g.t / 0.6) * 0.85, 0.04 * Math.sin(t * 9));
  }

  function drawEnemy(c, e, t) {
    const d = e.def, s = d.scale;
    if (d.bell && e.dormant) { drawBuriedBell(c, e, t); return; }
    if (d.rose && e.dormant && Art.sprites.roseBud) return; // the Deadly Rose asleep inside her bud (src/rose.js)
    if (d.wyvern) return DL.Wyvern.drawMother(c, e, t); // the mother wyvern, drawn in code until her drawings are in (src/wyvern.js)
    if (d.king) return; // the Sunken King is drawn behind the gate, with his hands (src/finale.js)
    if (e.rise > 0) {
      // clawing up out of the water
      const k = 1 - e.rise / 0.9;
      c.save();
      c.beginPath(); c.rect(e.x - 60 * s - (d.shadow || 0), e.y - 160 * s, 120 * s + 2 * (d.shadow || 0), 160 * s); c.clip();
      Art.drawUnit(c, unitKey(e), "walk", Math.floor(k * 8), e.angle, e.x, e.y + (1 - k) * (d.sink || 34) * s, s, { alpha: 0.4 + 0.6 * k });
      c.restore();
      c.fillStyle = "rgba(60,200,210,0.5)";
      c.beginPath(); c.ellipse(e.x, e.y, 14 * s + 4, 4, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    shadow(c, e.x, e.y, (d.shadow || 14) * s, (d.shadow || 14) * 0.36 * s);
    if (e.state === "windup" && d.colossus) DL.Colossus.drawWindup(c, e);
    else if (e.state === "windup") {
      // telegraph the coming blow
      const k = 1 - e.stT / d.windup;
      c.save();
      c.globalCompositeOperation = "lighter";
      if (d.ranged) {
        c.strokeStyle = `rgba(90,235,245,${0.15 + 0.5 * k})`;
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(e.x, e.y - 30); c.lineTo(e.x + Math.cos(e.aim) * 240, e.y - 30 + Math.sin(e.aim) * 240); c.stroke();
      } else {
        c.fillStyle = `rgba(60,220,230,${0.08 + 0.22 * k})`;
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.ellipse(e.x, e.y, d.range + 14, (d.range + 14) * 0.7, 0, e.aim - 0.95, e.aim + 0.95);
        c.closePath(); c.fill();
      }
      c.restore();
    }
    // Bone Wolves wear the hound's bones with a drowned, cyan cast
    const flash = e.flash > 0 ? 0.9 : e.state === "windup" ? 0.2 + 0.2 * Math.sin(t * 30) : d.beast ? WOLF_TINT : 0;
    const flashColor = e.flash > 0 ? "#ffffff" : d.beast && e.state !== "windup" ? WOLF_CAST : d.rose ? "#ff7a8a" : "#7ff6ff";
    const [anim, fr, ang] = enemyAnim(e, t);
    Art.drawUnit(c, unitKey(e), anim, fr, ang, e.x, e.y, s, { flash, flashColor, alpha: e.dormant ? 0.8 : 1 });
    if (e.hp < e.maxHp) bar(c, e.x, e.y - (d.barY || (d.crawl ? 36 : d.beast ? 66 : 84) * s) - 4, Math.round((d.barW || 26) * Math.max(1, s)), e.hp / e.maxHp, d.boss ? "#7ff6ff" : "#c8484e");
    if (e.burn > 0) Art.drawFire(c, e.x + Math.sin(t * 7) * 4, e.y - 10, 0.5, t);
    if (e.bleed > 0) {
      // Bone Hound bleed: drops running down to the ground
      c.fillStyle = "#a3170f";
      for (let i = 0; i < 4; i++) {
        const k = (t * 1.4 + i * 0.27 + e.id * 0.13) % 1;
        c.fillRect(Math.round(e.x + ((i * 7 + e.id * 3) % 17) - 8), Math.round(e.y - (1 - k) * 34 * s), 2, 3);
      }
    }
  }

  // The Starved Bell lying in wait: only the crown of the bell shows above the mire, with ripples around it.
  function drawBuriedBell(c, e, t) {
    const s = e.def.scale, sink = 80 * s;
    c.save();
    c.beginPath(); c.rect(e.x - 120, e.y - 200, 240, 200); c.clip();
    Art.drawUnit(c, "bell", "idle", 0, Math.PI / 2, e.x, e.y + sink, s, { flash: 0.15, flashColor: "#1d3a3c" });
    c.restore();
    c.strokeStyle = "rgba(90,200,210,0.35)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.4 + i * 0.5) % 1, r = 30 + 40 * k;
      c.globalAlpha = 1 - k;
      c.beginPath(); c.ellipse(e.x, e.y - 4, r, r * 0.35, 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // The Bone Hound: bites play its attack, a struck hound flinches, a knocked-out one collapses and lies there.
  function houndAnim(h, t) {
    if (h.down > 0) return ["death", Math.min(2, Math.floor(((h.downMax || DL.HOUND.downTime) - h.down) / 0.2))];
    if (h.state === "bite") return ["attack", Math.min(2, Math.floor((1 - h.stT / 0.3) * 3))];
    if (h.hurtT > 0) return ["hurt", 0];
    if (h.moving) return ["walk", Math.floor(h.animT * walkRate("boneHound", 11))];
    return ["idle", Math.floor(t * 1.6 + h.id)];
  }
  // Each of its four forms (src/summons.js) is drawn from its own sheet once that's in; till then its sprite is scaled and tinted.
  function drawHound(c, h, t) {
    const lk = DL.Summons.look("hound"), s = lk.scale;
    shadow(c, h.x, h.y, 18 * s, 5 * s);
    const [anim, fr] = houndAnim(h, t);
    Art.drawUnit(c, lk.key, anim, fr, h.angle, h.x, h.y, s, h.flash > 0 ? { flash: 0.8, flashColor: "#ffb0a0" } : lk);
    // knocked out: the bar fills as it pulls itself back together
    if (h.down > 0) bar(c, h.x, h.y - 34, 22, 1 - h.down / (h.downMax || DL.HOUND.downTime), "#8f846b");
    else if (h.hp < h.maxHp) bar(c, h.x, h.y - 70 * s, 22, Math.max(0, h.hp) / h.maxHp, "#d9cdae");
  }
  const WOLF_TINT = 0.22, WOLF_CAST = "#4fb8bf";
  // A Bone Wolf's carcass at the den (one being hauled shows under Carrying in the HUD, not on the knight).
  function drawCarcass(c, b) {
    shadow(c, b[0], b[1], 16, 4, 0.3);
    Art.drawUnit(c, "boneHound", "death", 2, b[2], b[0], b[1], 1, { flash: WOLF_TINT, flashColor: WOLF_CAST });
  }
  // Derek: casting plays his attack (fists up, then slammed down), otherwise he plods or stands.
  function golemAnim(m, t) {
    if (m.state === "cast") return ["attack", Math.max(0, Math.min(2, Math.floor((1 - m.stT / 0.7) * 3)))];
    if (m.moving) return ["walk", Math.floor(m.animT * walkRate("derek", 7))];
    return ["idle", Math.floor(t * 1.6 + m.id)];
  }
  function drawGolem(c, m, t) {
    const lk = DL.Summons.look("golem");
    shadow(c, m.x, m.y, 12 * lk.scale, 4 * lk.scale);
    const [anim, fr] = golemAnim(m, t);
    Art.drawUnit(c, lk.key, anim, fr, m.angle, m.x, m.y, lk.scale, lk);
  }
  // Companions in their higher forms (src/summons.js) shed motes of their colour: embers, crystal glints, soul-light.
  function drawFormEmbers(c, G, t) {
    for (const [kind, list, h] of [["hound", G.hounds, 30], ["golem", G.golems, 26], ["wraith", G.wraiths, 50]]) {
      const col = DL.Summons.look(kind).ember;
      if (!col) continue;
      for (const m of list) {
        if (m.down > 0) continue;
        for (let i = 0; i < 4; i++) {
          const u = (t * 0.8 + i / 4 + m.id * 0.13) % 1, x = m.x + Math.sin(i * 2.3 + t * 1.7 + m.id) * 12, y = m.y - 6 - u * h;
          c.fillStyle = `rgba(${col},${0.8 * Math.sin(Math.PI * u)})`;
          c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        }
      }
    }
  }
  // His heart glows over the dark, brighter while he calls up a wall (hidden when he walks away from you).
  function drawGolemHeart(c, m, t) {
    const { dir, flip } = Art.unitDir(m.angle);
    if (dir === "up") return;
    const lk = DL.Summons.look("golem"), sc = lk.size || lk.scale, x = m.x + (dir === "side" ? (flip ? -7 : 7) : 0) * sc, y = m.y - 12 * sc;
    const a = (m.state === "cast" ? 0.9 : 0.45) + 0.1 * Math.sin(t * 3 + m.id), r = m.state === "cast" ? 13 : 7;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,250,255,${a})`); g.addColorStop(1, "rgba(90,235,245,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // One of the three boulders in a wall Derek raised: it rises out of the ground, cracks after the first blow.
  function drawWallRock(c, w, i, x, y, t) {
    const v = 1 + ((w.id + i) % 4), name = Art.sprites.boulder11 ? "boulder" + v + (w.hits >= 2 ? 1 : 2) : "rock";
    const s = Art.sprites[name];
    if (!s) return;
    const k = Math.min(1, w.t / 0.4), sc = (Art.sprites.boulder11 ? 0.62 : 0.9) * PS, wd = s.w * sc, h = s.h * sc;
    const shake = w.hitT > 0 ? Math.sin(t * 80 + i) * 2.5 * (w.hitT / 0.2) : 0;
    shadow(c, x, y, wd * 0.42, wd * 0.14, 0.3 * k);
    c.save();
    c.beginPath(); c.rect(x - wd, y - h - 4, wd * 2, h + 6); c.clip(); // rising out of the ground
    c.drawImage(s.c, Math.round(x - wd / 2 + shake), Math.round(y + 2 - h + (1 - k) * h), wd, h);
    c.restore();
  }
  /* Kindle, the walking lantern: a coded stand-in until the drawn sprite arrives. A bronze cage with
     glass panes and a ring on top, carried on four spider legs. Broken, he lies on his side with his
     legs curled, the glass dark (an ember shows for each torch fed so far). */
  const KINDLE_METAL = "#3b2c1c", KINDLE_RIM = "#8a6a3a", KINDLE_GLASS = "rgba(255,190,90,0.85)", KINDLE_COLD = "rgba(60,70,72,0.9)";
  function kindleLegs(c, k, t, lift) {
    const step = k.moving ? k.animT * 13 : 0;
    c.strokeStyle = "#7a5a32";
    c.lineWidth = 2.2;
    c.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1, back = i % 2 ? 1 : -1, ph = step + (i === 0 || i === 3 ? 0 : Math.PI);
      const up = k.moving ? Math.max(0, Math.sin(ph)) * 3 : 0, sw = k.moving ? Math.cos(ph) * 3 : 0;
      const hx = side * 5, hy = -lift - 1 + back, kx = side * 13 + sw, ky = -lift - 7 + back - up, fx = side * 12 + sw * 1.4, fy = back * 2 - up;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    }
  }
  function kindleBody(c, lit, fed, t) {
    // the cage: cap, panes, base, and the carry ring
    c.fillStyle = KINDLE_METAL;
    c.fillRect(-8, -24, 16, 3); c.fillRect(-7, -4, 14, 3);
    c.beginPath(); c.moveTo(-6, -24); c.lineTo(0, -28); c.lineTo(6, -24); c.fill();
    c.strokeStyle = KINDLE_RIM; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, -31, 3.5, 0, Math.PI * 2); c.stroke();
    c.fillStyle = lit ? KINDLE_GLASS : KINDLE_COLD;
    c.fillRect(-6, -21, 12, 17);
    if (lit) {
      const f = 1 + 0.15 * Math.sin(t * 11);
      c.fillStyle = "rgba(255,240,180,0.95)";
      c.beginPath(); c.ellipse(0, -10, 2.5 * f, 5 * f, 0, 0, Math.PI * 2); c.fill();
    } else {
      for (let i = 0; i < fed; i++) { c.fillStyle = "rgba(255,120,50,0.8)"; c.fillRect(-4 + (i % 4) * 2.5, -7 - Math.floor(i / 4) * 2.5, 1.5, 1.5); }
      c.strokeStyle = "rgba(200,210,210,0.5)"; c.lineWidth = 0.8; // cracked glass
      c.beginPath(); c.moveTo(-5, -19); c.lineTo(-1, -13); c.lineTo(-3, -8); c.moveTo(-1, -13); c.lineTo(4, -15); c.stroke();
    }
    c.fillStyle = KINDLE_RIM; // the bars
    for (const x of [-6, -1, 4]) c.fillRect(x, -21, 2, 17);
  }
  // Drawn frames, once they've loaded (otherwise the coded stand-in below).
  const kindleDrawn = () => !Art.sheet("kindle").down.idle[0].blank;
  // Your broken lantern, until you light it: tipped over, legs curled up.
  function drawKindleBroken(c, b, t) {
    shadow(c, b.x, b.y, 13, 4);
    if (kindleDrawn()) return Art.drawUnit(c, "kindle", "death", 0, Math.PI / 2, b.x, b.y, 1);
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y));
    c.rotate(-1.25);
    c.translate(0, -2);
    kindleLegs(c, { moving: false }, t, 1);
    kindleBody(c, false, b.fed, t);
    c.restore();
  }
  // Pouring flame into a lantern just now, leading the way and waiting for you (pointing), scuttling, or standing.
  function kindleAnim(k) {
    if (k.pourAt && performance.now() - k.pourAt < 700) return ["attack", 0, k.angle];
    if (k.moving) return ["walk", Math.floor(k.animT * walkRate("kindle", 12)), k.angle];
    if (k.lead != null) return ["point", 0, k.lead];
    return ["idle", 0, k.angle];
  }
  function drawKindle(c, k, t) {
    shadow(c, k.x, k.y, 11, 4);
    if (kindleDrawn()) {
      const [anim, fr, ang] = kindleAnim(k);
      return Art.drawUnit(c, "kindle", anim, fr, ang, k.x, k.y, 1);
    }
    c.save();
    c.translate(Math.round(k.x), Math.round(k.y));
    const bob = k.moving ? Math.abs(Math.sin(k.animT * 13)) * 1.5 : Math.sin(t * 2) * 0.6;
    kindleLegs(c, k, t, 8);
    c.translate(0, -8 - bob);
    kindleBody(c, true, 0, t);
    c.restore();
  }
  // Kindle at any size (the Fire Bearer, src/finale.js), standing, walking or guttered out.
  R.kindleUnit = function (c, k, t, sc, down) {
    if (kindleDrawn()) {
      const [anim, fr, ang] = down ? ["death", 0, k.angle] : kindleAnim(k);
      return Art.drawUnit(c, "kindle", anim, fr, ang, k.x, k.y, sc);
    }
    c.save();
    c.translate(Math.round(k.x), Math.round(k.y));
    c.scale(sc, sc);
    if (down) c.rotate(-1.25);
    kindleLegs(c, k, t, down ? 1 : 8);
    c.translate(0, down ? -2 : -8 - (k.moving ? Math.abs(Math.sin(k.animT * 13)) * 1.5 : 0));
    kindleBody(c, !down, 0, t);
    c.restore();
  };
  // Over the dark: his flame, and while he leads the way, a trail of embers pointing where.
  function drawKindleGlow(c, k, t) {
    const x = k.x, y = k.y - (kindleDrawn() ? 13 : 18), r = 14 + Math.sin(t * 9) * 1.5, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,210,120,0.75)"); g.addColorStop(1, "rgba(255,150,60,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    const a = k.lead;
    if (a == null) return;
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.9 + i / 4) % 1), d = 26 + u * 70, px = k.x + Math.cos(a) * d, py = k.y - 6 + Math.sin(a) * d * 0.75;
      c.fillStyle = `rgba(255,180,80,${0.7 * Math.sin(Math.PI * u)})`;
      c.beginPath(); c.arc(px, py, 3, 0, Math.PI * 2); c.fill();
    }
  }
  /* Where a side-view hound frame's eyes are, from its feet in world px (found once per frame): the red
     pixels highest and farthest forward (the mantle sits lower and farther back). */
  function houndEye(f) {
    if (f.eye !== undefined) return f.eye;
    const w = f.c.width, h = f.c.height, d = f.c.getContext("2d").getImageData(0, 0, w, h).data;
    const red = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] && d[i] > 110 && d[i] - d[i + 1] > 90 && d[i] - d[i + 2] > 90) red.push([x, y]);
    }
    const ax = f.ax != null ? f.ax : Art.UNIT.CX, ay = f.ay != null ? f.ay : Art.UNIT.GY, k = Art.UNIT.PS / (f.res || 1);
    let best = null;
    for (const p of red) if (!best || p[0] - p[1] * 0.5 > best[0] - best[1] * 0.5) best = p;
    if (!best) return (f.eye = null);
    const near = red.filter(([x, y]) => Math.abs(x - best[0]) <= 4 * (f.res || 1) && Math.abs(y - best[1]) <= 3 * (f.res || 1));
    const mx = near.reduce((s, p) => s + p[0], 0) / near.length, my = near.reduce((s, p) => s + p[1], 0) / near.length;
    return (f.eye = { x: (mx + 0.5 - ax) * k, y: (my + 0.5 - ay) * k });
  }
  // Facing you, the drawn hound's eyes sit right of its feet and move with its head: the standing pose, then each
  // of the four front run frames (world px from the feet). The coded fallback holds its head still.
  const HOUND_FRONT_EYES = { idle: [[6.5, -36]], walk: [[4.5, -38], [7, -25], [5.5, -37], [5, -45]] };
  // Embers in its eye sockets, so it reads in the dark. They follow the head through every frame.
  function drawHoundEyes(c, h, t) {
    if (h.down > 0) return;
    const [anim, fr] = houndAnim(h, t), lk = DL.Summons.look("hound");
    if (lk.drawn) return; // a form's own drawing brings its own eyes
    beastEyes(c, h.x, h.y, h.angle, anim, fr, h.id, lk.scale > 1.2 ? "170,120,255" : "255,80,40", t, lk.scale);
  }
  // The same for any unit drawn from the hound's sheet (the Bone Wolves at the den burn cyan, like the Drowned).
  function beastEyes(c, hx, hy, ang, anim, fr, id, rgb, t, sc = 1) {
    const { dir, flip } = Art.unitDir(ang);
    if (dir === "up") return;
    const frames = Art.sheet("boneHound")[dir][anim], i = ((fr % frames.length) + frames.length) % frames.length, f = frames[i];
    const drawn = !!f.res, front = dir === "down" && (anim === "idle" || anim === "walk" || !drawn);
    let eyes;
    if (front) {
      // two eyes facing you
      const [ex, ey] = drawn ? HOUND_FRONT_EYES[anim][anim === "walk" ? Math.floor(i / 2) % 4 : 0] : [0, -46];
      eyes = [[ex - 4, ey], [ex + 4, ey]];
    } else {
      // side on (the front view borrows the side frames for attack, hurt and death)
      const eye = houndEye(f);
      if (!eye) return;
      eyes = [[dir === "side" && flip ? -eye.x : eye.x, eye.y]];
    }
    const r = front ? 6 : 8, pulse = 0.75 + 0.25 * Math.sin(t * 6 + id);
    for (const [ex, ey] of eyes) {
      const x = hx + ex * sc, y = hy + ey * sc;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${0.6 * pulse})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // A soft cyan halo around the visor so the Drowned read in the dark.
  function drawEyes(c, e, t) {
    if (e.def.beast) { const [anim, fr, ang] = enemyAnim(e, t); beastEyes(c, e.x, e.y, ang, anim, fr, e.id, "80,235,245", t); return; }
    const s = e.def.scale;
    const ang = e.state === "move" ? e.angle : e.aim;
    const { dir, flip } = Art.unitDir(ang);
    if (dir === "up") return;
    const side = dir === "side" ? (flip ? -1 : 1) : 0;
    const x = e.x + side * (e.def.eyeX || (e.def.crawl ? 17 : 7)) * s;
    const y = e.y - (e.def.eyeY || (e.def.crawl ? (dir === "side" ? 16 : 18) : 56)) * s;
    const pulse = 0.75 + 0.25 * Math.sin(t * 5 + e.x);
    const r = (e.def.eyeR || 9) * s + 3, col = e.def.eyeCol || "80,235,245";
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${0.5 * pulse})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawDissolve(c, f) {
    const e = f.e, k = f.t / f.max;
    Art.drawUnit(c, unitKey(e), "death", Math.min(2, Math.floor(k * 3)), e.angle, e.x, e.y, e.def.scale, { alpha: 1 - k * k, flash: 0.3 + k * 0.5, flashColor: "#5fe6ee" });
  }

  function drawSlash(c, x, y, ang, arc, r, k, rgb, w, flip) {
    // A crescent of light that sweeps across the arc.
    const a0 = ang - arc / 2, a1 = ang + arc / 2;
    const sweep = Math.min(1, k * 1.6);
    const head = flip ? a1 - (a1 - a0) * sweep : a0 + (a1 - a0) * sweep;
    const tail = flip ? Math.min(a1, head + arc * 0.7) : Math.max(a0, head - arc * 0.7);
    const fade = 1 - Math.max(0, k - 0.5) * 2;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const u0 = i / steps, u1 = (i + 1) / steps;
      const s0 = tail + (head - tail) * u0, s1 = tail + (head - tail) * u1;
      c.strokeStyle = `rgba(${rgb},${0.9 * u1 * fade})`;
      c.lineWidth = 1 + w * u1;
      c.beginPath();
      c.ellipse(x, y, r * 0.85, r * 0.62, 0, Math.min(s0, s1), Math.max(s0, s1));
      c.stroke();
    }
  }

  /* Abigail, the soul wraith: a coded stand-in until the drawn sprite arrives. A hooded girl of teal rags
     floating above the ground, her face a black hollow with two pale eyes, a gold chain across her chest,
     her tattered hem trailing off into wisps. She raises an arm to throw her orbs. */
  const SOUL = DL.Abigail.SOUL;
  const WRAITH = { dark: "#0c2b29", cloak: "#175a52", hood: "#22786c", hi: "#3aa596", face: "#020606", gold: "#c8a24a" };
  // Where she floats this frame (her feet's spot on the ground stays at w.x, w.y): [x, top of the hem, facing].
  function wraithPose(w, t) {
    const { dir, flip } = Art.unitDir(w.angle);
    return { x: Math.round(w.x), y: Math.round(w.y - 14 + Math.sin(t * 2.2 + w.id) * 3), dir, flip };
  }
  // Drawn frames, once they've loaded (otherwise the coded stand-in below).
  const wraithDrawn = () => !Art.sheet("abigail").down.idle[0].blank;
  // Throwing (arm up, then the throw), blessing her knight just now (facing you, arms raised), drifting, or floating still.
  function wraithAnim(w, t) {
    if (w.state === "cast") return ["attack", Math.max(0, Math.min(2, Math.floor((1 - w.stT / 0.45) * 3))), w.angle];
    if (w.buff > DL.ABIGAIL.buffDur - 0.9) return ["bless", 0, Math.PI / 2];
    if (w.moving) return ["walk", Math.floor(w.animT * walkRate("abigail", 7)), w.angle];
    return ["idle", 0, w.angle];
  }
  function drawWraith(c, w, t) {
    const lk = DL.Summons.look("wraith");
    if (lk.wisp && !lk.drawn) return; // the Soul Wisp is all glow, drawn above the dark (drawWispGlow)
    if (wraithDrawn() || lk.drawn) {
      shadow(c, w.x, w.y, 10 * lk.scale, 3, 0.22);
      const [anim, fr, ang] = wraithAnim(w, t);
      return Art.drawUnit(c, lk.key, anim, fr, ang, w.x, w.y - 10 + Math.sin(t * 2.2 + w.id) * 3, lk.scale, lk);
    }
    const P = wraithPose(w, t), sway = Math.sin(t * 3 + w.id) * 3, side = P.dir === "side", back = P.dir === "up";
    shadow(c, w.x, w.y, 10, 3, 0.22);
    c.save();
    c.translate(P.x, P.y);
    if (side && P.flip) c.scale(-1, 1);
    // her rags, tapering into a ragged trailing hem
    c.fillStyle = WRAITH.dark;
    c.beginPath();
    c.moveTo(-10, -30);
    c.quadraticCurveTo(-13, -14, -9 + sway * 0.3, -4);
    c.lineTo(-6 + sway, 5); c.lineTo(-3 + sway * 0.6, -1); c.lineTo(0 + sway, 7); c.lineTo(3 + sway * 0.5, -1); c.lineTo(7 + sway, 4);
    c.quadraticCurveTo(13, -14, 10, -30);
    c.closePath(); c.fill();
    c.fillStyle = WRAITH.cloak;
    c.beginPath();
    c.moveTo(-7, -30); c.quadraticCurveTo(-8, -16, -5 + sway * 0.4, -6); c.lineTo(-1 + sway * 0.6, -2); c.lineTo(3 + sway * 0.5, -7);
    c.quadraticCurveTo(7, -16, 7, -30);
    c.closePath(); c.fill();
    // a ragged sleeve: hanging at her side, or raised to throw
    const throwing = w.state === "cast";
    c.fillStyle = WRAITH.dark;
    c.beginPath();
    if (throwing) { c.moveTo(4, -32); c.lineTo(18, -40); c.lineTo(19, -35); c.lineTo(7, -25); }
    else { c.moveTo(6, -31); c.lineTo(12 + sway * 0.3, -17); c.lineTo(8 + sway * 0.3, -15); c.lineTo(4, -24); }
    c.closePath(); c.fill();
    // the gold chain across her chest
    if (!back) { c.fillStyle = WRAITH.gold; for (let i = 0; i < 5; i++) c.fillRect(-6 + i * 2.6, -29 + i * 1.8, 1.6, 1.6); }
    // the hood
    c.fillStyle = WRAITH.hood;
    c.beginPath(); c.moveTo(-10, -28); c.quadraticCurveTo(-12, -47, 0, -49); c.quadraticCurveTo(12, -47, 10, -28); c.closePath(); c.fill();
    c.fillStyle = WRAITH.hi;
    c.fillRect(-8, -42, 2, 11);
    // her face, a hollow in the hood (none from behind)
    if (!back) {
      c.fillStyle = WRAITH.face;
      c.beginPath(); c.ellipse(side ? 3 : 0, -36, side ? 4.5 : 5.5, 6.5, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  // Her eyes, as world points (none from behind).
  function wraithEyes(w, t) {
    const P = wraithPose(w, t);
    if (DL.Summons.look("wraith").wisp) return [];
    if (P.dir === "up" || wraithDrawn()) return []; // the drawn eyes glow on their own
    if (P.dir === "side") return [[P.x + (P.flip ? -4.5 : 4.5), P.y - 37]];
    return [[P.x - 2.2, P.y - 37], [P.x + 2.2, P.y - 37]];
  }
  R.drawWraith = drawWraith;
  // the Soul Wisp: a lone soul with pale eyes, trailing wisps, bigger while it throws (also her Kit portrait)
  function drawWisp(c, x, y, k, angle, id, t) {
    for (let i = 1; i <= 4; i++) {
      const u = (t * 1.1 + i / 4) % 1;
      c.fillStyle = `rgba(${SOUL},${0.45 * Math.sin(Math.PI * u)})`;
      c.beginPath(); c.arc(x + Math.sin(t * 3 + i * 2) * 5 - Math.cos(angle) * u * 14, y + 4 + u * 10, 2.6 - u * 1.5, 0, Math.PI * 2); c.fill();
    }
    soulOrb(c, x, y, k, t * 3 + id);
  }
  R.drawWisp = drawWisp;
  // A soul orb: a dark round soul with two pale eyes in a teal halo (`s` scales it, `ph` sets its flicker).
  function soulOrb(c, x, y, s, ph) {
    const sp = Art.sprites.soulOrb;
    if (sp) {
      // the drawn one: a soft halo, then the orb with its wisp curling up (its centre is near the bottom)
      const r = 11 * s, g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${SOUL},0.5)`); g.addColorStop(1, `rgba(${SOUL},0)`);
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      const op = c.globalCompositeOperation, w = sp.w * PS * s, h = sp.h * PS * s;
      c.globalCompositeOperation = "source-over";
      c.drawImage(sp.c, Math.round(x - w / 2), Math.round(y + 6 * s - h), w, h);
      c.globalCompositeOperation = op;
      return;
    }
    const r = 13 * s, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${SOUL},0.95)`); g.addColorStop(0.45, `rgba(${SOUL},0.5)`); g.addColorStop(1, `rgba(${SOUL},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    const op = c.globalCompositeOperation;
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#020807";
    c.beginPath(); c.arc(x, y, 4.2 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(200,255,240,${0.75 + 0.25 * Math.sin(ph * 2)})`;
    c.fillRect(x - 2.2 * s, y - 1.2 * s, 1.4 * s, 1.4 * s); c.fillRect(x + 0.8 * s, y - 1.2 * s, 1.4 * s, 1.4 * s);
    c.globalCompositeOperation = op;
  }
  /* Over the dark: Abigail's eyes and the souls circling her, her blessing at her knight's feet, the mark on
     the Drowned she has weakened, your soul orbs lying out there, and the souls you've laid to rest at the graves. */
  function drawSoulGlow(c, G, view, t) {
    const AB = DL.Abigail, me = G.isGuest() ? DL.Net.myId : 0;
    for (const w of G.wraiths) {
      for (const [x, y] of wraithEyes(w, t)) {
        const g = c.createRadialGradient(x, y, 0, x, y, 5);
        g.addColorStop(0, "rgba(200,255,240,0.95)"); g.addColorStop(1, `rgba(${SOUL},0)`);
        c.fillStyle = g; c.fillRect(x - 5, y - 5, 10, 10);
      }
      const P = wraithPose(w, t);
      if (DL.Summons.look("wraith").wisp) drawWisp(c, P.x, P.y - 22, w.state === "cast" ? 1.5 : 1.25, w.angle, w.id, t);
      else for (let i = 0; i < 2; i++) {
        const a = t * 1.6 + i * Math.PI + w.id;
        soulOrb(c, P.x + Math.cos(a) * 17, P.y - 26 + Math.sin(a) * 7, 0.45, t * 3 + i);
      }
      if (w.buff > 0) {
        const k = w.owner === me ? G.player : G.allies.find((a) => a.id === w.owner);
        if (!k) continue;
        const f = Math.min(1, w.buff / 1.5), pulse = 0.75 + 0.25 * Math.sin(t * 5);
        c.strokeStyle = `rgba(${SOUL},${0.55 * f * pulse})`;
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(k.x, k.y, 18, 7, 0, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 3; i++) {
          const u = (t * 0.7 + i / 3) % 1;
          c.fillStyle = `rgba(${SOUL},${0.7 * f * Math.sin(Math.PI * u)})`;
          c.fillRect(k.x + Math.cos(i * 2.1 + t) * 13 - 1, k.y - u * 50 - 1, 2, 2);
        }
      }
    }
    for (const e of G.enemies) {
      if (!e.cursed || e.rise > 0) continue;
      const s = e.def.scale, a = 0.3 + 0.12 * Math.sin(t * 4 + e.id);
      c.strokeStyle = `rgba(${SOUL},${a})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(e.x, e.y, 13 * s, 5 * s, 0, 0, Math.PI * 2); c.stroke();
      const u = (t * 0.8 + e.id * 0.37) % 1;
      c.fillStyle = `rgba(${SOUL},${0.6 * Math.sin(Math.PI * u)})`;
      c.fillRect(e.x + Math.sin(e.id) * 8 - 1, e.y - u * 40 * s - 1, 2, 2);
    }
    for (const o of AB.left()) {
      if (o.x < view.left - 40 || o.x > view.right + 40 || o.y < view.top - 40 || o.y > view.bottom + 60) continue;
      const y = o.y - 16 + Math.sin(t * 2 + o.i) * 3;
      for (let i = 1; i <= 4; i++) {
        // wisps curling up off it
        const u = (t * 0.9 + i / 4) % 1;
        c.fillStyle = `rgba(${SOUL},${0.45 * Math.sin(Math.PI * u)})`;
        c.beginPath(); c.arc(o.x + Math.sin(t * 3 + i * 2) * 4, y - 6 - u * 16, 2.2 - u, 0, Math.PI * 2); c.fill();
      }
      soulOrb(c, o.x, y, 0.85, t * 2 + o.i);
    }
    const n = AB.restingSouls();
    if (n) {
      const gs = AB.graveSpot();
      if (Math.abs(gs.x - G.camera.x) < 900 && Math.abs(gs.y - G.camera.y) < 900)
        for (let i = 0; i < n; i++) {
          const a = t * 0.8 + (i / n) * Math.PI * 2;
          soulOrb(c, gs.x + Math.cos(a) * 28, gs.y - 50 + Math.sin(a) * 9, 0.4, t * 2 + i);
        }
    }
  }

  function drawProjectile(c, b) {
    const a = Math.atan2(b.vy, b.vx), ux = Math.cos(a), uy = Math.sin(a);
    if (b.kind === "soul") {
      // Abigail's soul orb: a teal wisp trailing behind a dark round soul with two pale eyes
      const tt = DL.Game.t;
      const fly = Art.sprites[Math.floor(tt * 10) % 2 ? "soulFly2" : "soulFly1"];
      if (fly) {
        // the drawn orb streaming its tail behind it, turned the way it flies (its head is at the right end)
        const w = fly.w * PS * 0.75, h = fly.h * PS * 0.75, g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 14);
        g.addColorStop(0, `rgba(${SOUL},0.55)`); g.addColorStop(1, `rgba(${SOUL},0)`);
        c.fillStyle = g; c.fillRect(b.x - 14, b.y - 14, 28, 28);
        c.save();
        c.globalCompositeOperation = "source-over";
        c.translate(b.x, b.y); c.rotate(a);
        if (Math.cos(a) < 0) c.scale(1, -1); // keep it upright going left
        c.drawImage(fly.c, -w + 6, -h / 2, w, h);
        c.restore();
        return;
      }
      for (let i = 1; i <= 6; i++) {
        const w = Math.sin(tt * 18 + i * 1.3) * 2.5 * (i / 6);
        c.fillStyle = `rgba(${SOUL},${0.55 * (1 - i / 7)})`;
        c.beginPath(); c.arc(b.x - ux * i * 4.5 - uy * w, b.y - uy * i * 4.5 + ux * w, 4.5 - i * 0.5, 0, Math.PI * 2); c.fill();
      }
      soulOrb(c, b.x, b.y, 1, tt * 3 + b.x * 0.01);
      return;
    }
    if (b.kind === "spore") return DL.Fred.drawGlob(c, b); // Fred's spore glob
    if (b.kind === "wyvBolt") return DL.Wyvern.drawBolt(c, b); // David's bolt
    if (b.kind === "orb") {
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 12);
      g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.35, `rgba(${b.col},0.9)`); g.addColorStop(1, `rgba(${b.col},0)`);
      c.fillStyle = g; c.fillRect(b.x - 12, b.y - 12, 24, 24);
      c.strokeStyle = `rgba(${b.col},0.4)`; c.lineWidth = 3;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - ux * 18, b.y - uy * 18); c.stroke();
      return;
    }
    if (b.kind === "wave") {
      c.strokeStyle = `rgba(${b.col},${Math.min(1, b.life * 4)})`;
      c.lineWidth = 5;
      c.beginPath(); c.arc(b.x - ux * 14, b.y - uy * 14, 22, a - 1.1, a + 1.1); c.stroke();
      c.lineWidth = 2; c.strokeStyle = `rgba(255,255,240,${Math.min(1, b.life * 4)})`;
      c.beginPath(); c.arc(b.x - ux * 14, b.y - uy * 14, 22, a - 0.8, a + 0.8); c.stroke();
      return;
    }
    if (b.kind === "spear") {
      c.strokeStyle = `rgba(${b.col},${Math.min(1, b.life * 4)})`;
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - ux * 46, b.y - uy * 46); c.stroke();
      c.fillStyle = "rgba(255,255,240,0.95)";
      c.beginPath(); c.moveTo(b.x + ux * 8, b.y + uy * 8); c.lineTo(b.x - uy * 4, b.y + ux * 4); c.lineTo(b.x + uy * 4, b.y - ux * 4); c.fill();
      return;
    }
    const bolt = b.kind === "bolt" && !b.hostile && Art.sprites[b.flare ? "arbFlareBolt" : "arbBolt"];
    if (bolt) {
      // the Ashen Arbalist's drawn bolt, its head at the front, turned the way it flies
      const w = bolt.w * PS, h = bolt.h * PS;
      c.save();
      c.globalCompositeOperation = "source-over";
      c.translate(b.x, b.y); c.rotate(a);
      c.drawImage(bolt.c, -w + 4, -h / 2, w, h);
      c.restore();
      return;
    }
    const len = b.kind === "arrow" ? 14 : b.kind === "bolt" ? (b.hostile === false && b.flare ? 18 : 14) : 8;
    c.strokeStyle = `rgba(${b.col},0.95)`;
    c.lineWidth = b.kind === "shard" ? 3 : b.flare ? 3 : 2;
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - ux * len, b.y - uy * len); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.fillRect(b.x - 1, b.y - 1, 2, 2);
  }

  /* Milestone looks: a glowing weapon (5), drifting embers (10, spawned in kits.js),
     a ring of light at the feet (15), and a crest of light above the hood (20). */
  function drawKitGlow(c, G, p, t) {
    const tier = DL.Kits.tier(), col = DL.Kits.color();
    for (const w of [G.wisp, ...G.allies.map((a) => a.wisp)]) {
      if (!w) continue;
      const g = c.createRadialGradient(w.x, w.y, 0, w.x, w.y, 14);
      g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.3, "rgba(255,232,170,0.8)"); g.addColorStop(1, "rgba(255,232,170,0)");
      c.fillStyle = g; c.fillRect(w.x - 14, w.y - 14, 28, 28);
    }
    if (DL.Kits.steady(p)) {
      // Stable Form: braced, a firm band of light at the feet
      c.strokeStyle = `rgba(${col},0.55)`;
      c.lineWidth = 2;
      c.setLineDash([5, 4]);
      c.beginPath(); c.ellipse(p.x, p.y + 1, 19, 6, 0, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }
    if (tier < 1) return;
    const { dir, flip } = Art.unitDir(p.swing ? p.swing.ang : p.angle);
    const side = flip ? -1 : 1;
    const hx = p.x + (dir === "down" ? -14 : dir === "up" ? 14 : 8 * side), hy = p.y - 26;
    const pulse = 0.75 + 0.25 * Math.sin(t * 4);
    const r = 8 + tier * 3;
    let g = c.createRadialGradient(hx, hy, 0, hx, hy, r);
    g.addColorStop(0, `rgba(${col},${(0.22 + 0.04 * tier) * pulse})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(hx - r, hy - r, r * 2, r * 2);
    if (tier >= 3) {
      c.strokeStyle = `rgba(${col},${0.35 + 0.15 * Math.sin(t * 3)})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(p.x, p.y, 24, 8, 0, 0, Math.PI * 2); c.stroke();
      g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
      g.addColorStop(0, `rgba(${col},0.25)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(p.x - 30, p.y - 12, 60, 24);
    }
    if (tier >= 4) {
      const cy = p.y - 84 + Math.sin(t * 2) * 1.5;
      c.fillStyle = `rgba(${col},${0.7 * pulse})`;
      for (let i = -2; i <= 2; i++) c.fillRect(p.x + i * 5 - 1, cy - (6 - Math.abs(i) * 2), 2, 6 - Math.abs(i) * 2);
      g = c.createRadialGradient(p.x, cy - 3, 0, p.x, cy - 3, 22);
      g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(p.x - 22, cy - 25, 44, 44);
    }
  }

  function drawMotes(c, G, view, t) {
    const n = Math.round(50 * G.nightAmt);
    while (R.motes.length < n) R.motes.push({ x: DL.rand(view.left, view.right), y: DL.rand(view.top, view.bottom), s: Math.random(), ph: Math.random() * 6 });
    if (R.motes.length > n) R.motes.length = n;
    const w = view.right - view.left, h = view.bottom - view.top;
    for (const m of R.motes) {
      m.y -= 0.15 + m.s * 0.2;
      m.x += Math.sin(t + m.ph) * 0.2;
      if (m.x < view.left) m.x += w; else if (m.x > view.right) m.x -= w;
      if (m.y < view.top) m.y += h; else if (m.y > view.bottom) m.y -= h;
      const a = (0.25 + 0.35 * Math.sin(t * 2 + m.ph)) * G.nightAmt;
      c.fillStyle = `rgba(90,230,240,${Math.max(0, a)})`;
      c.fillRect(m.x, m.y, 1.5 + m.s, 1.5 + m.s);
    }
  }

  /* ---------- lighting ---------- */
  function drawLighting(G, c, left, top, z, shx, shy) {
    const p = G.player;
    const zi = p ? W.zoneIndex(p.x, p.y) : 0;
    const dim = DL.ZONES[zi].dim;
    const D = G.diff();
    const dark = Math.min(0.96, (0.12 + 0.84 * G.nightAmt) * D.darkness + (dim + D.dayDim) * (1 - G.nightAmt));
    G.darkness = dark;
    const L = R.lx, lw = R.lc.width, lh = R.lc.height, k = z / 2;
    const ox = shx / 2, oy = shy / 2;
    L.globalCompositeOperation = "source-over";
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = `rgba(3,9,14,${dark})`;
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = "destination-out";
    const flick = (li) => (li.flick ? 1 + Math.sin(G.t * 11 + li.x) * 0.025 + (Math.random() - 0.5) * 0.03 : 1);
    for (const li of G.lights) {
      const x = (li.x - left) * k + ox, y = (li.y - top) * k + oy, r = li.r * k * flick(li);
      if (x < -r || y < -r || x > lw + r || y > lh + r) continue;
      const g = L.createRadialGradient(x, y, r * 0.05, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${li.s})`);
      g.addColorStop(0.55, `rgba(0,0,0,${li.s * 0.75})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      L.fillStyle = g;
      L.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(R.lc, 0, 0, R.W, R.H);

    // Coloured glow: warm human light vs. cold bioluminescence.
    c.globalCompositeOperation = "lighter";
    const strength = 0.25 + dark * 0.6;
    for (const li of G.lights) {
      if (!li.col) continue;
      const x = (li.x - left) * z + shx, y = (li.y - top) * z + shy, r = li.r * z * 0.85 * flick(li);
      if (x < -r || y < -r || x > R.W + r || y > R.H + r) continue;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${li.col},${0.3 * li.a * strength})`);
      g.addColorStop(0.4, `rgba(${li.col},${0.12 * li.a * strength})`);
      g.addColorStop(1, `rgba(${li.col},0)`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = "source-over";
    c.imageSmoothingEnabled = false;
  }
})(window.DL);
