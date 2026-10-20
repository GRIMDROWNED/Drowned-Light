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

  function objSprite(o) {
    switch (o.type) {
      case "tree": return "tree" + o.variant;
      case "wood": return o.harvested ? null : "driftwood";
      case "stone": return o.harvested ? null : "rock";
      case "iron": return o.harvested ? null : "ironpile";
      case "sprout": return o.harvested ? "sproutBare" : o.active ? "sproutOn" : "sproutOff";
      case "refuge": return o.dead ? "husk" : o.active ? "refugeOn" : "refugeOff";
      case "sentinel": return o.dead ? "husk" : o.active ? "sentinelOn" : "sentinelOff";
      case "root": return o.dead ? "husk" : o.active ? "rootOn" : "rootOff";
      case "pearl": return o.harvested ? null : "pearl";
      default: return o.def.sprite;
    }
  }

  R.draw = function (G) {
    const c = R.ctx, z = R.zoom, cam = G.camera, dpr = R.dpr;
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

    for (const d of G.decals) sprite(c, d.type, d.x, d.y, false, Math.min(1, d.t / 3));

    /* telegraphs on the ground */
    for (const tg of G.telegraphs) {
      const k = Math.min(1, tg.t / tg.delay);
      c.fillStyle = `rgba(60,220,230,${0.12 + 0.25 * k})`;
      c.strokeStyle = `rgba(120,245,255,${0.5 + 0.5 * k})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r, tg.r * 0.55, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(tg.x, tg.y, tg.r * k, tg.r * 0.55 * k, 0, 0, Math.PI * 2); c.fill();
    }

    /* y-sorted scene */
    const list = [];
    const m = 120;
    W.near(cam.x, cam.y, Math.max(vw, vh) / 2 + m, (o) => {
      if (o.x < left - m || o.x > view.right + m || o.y < top - 40 || o.y > view.bottom + 160) return;
      const name = objSprite(o);
      if (name) list.push({ y: o.y, f: () => drawObject(c, G, o, name) });
    });
    for (const pr of G.pearls) if (!pr.harvested) list.push({ y: pr.y, f: () => drawObject(c, G, pr, "pearl") });
    pushCamp(list, G, c, t);
    for (const tr of G.torches) list.push({ y: tr.y, f: () => drawTorch(c, tr, t) });
    for (const w of G.walls || []) {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), n = Math.max(2, Math.round(len / 14)), f = Math.min(1, w.t / 1);
      for (let i = 0; i <= n; i++) {
        const x = w.x1 + ((w.x2 - w.x1) * i) / n, y = w.y1 + ((w.y2 - w.y1) * i) / n;
        list.push({ y, f: () => { c.fillStyle = "rgba(40,16,6,0.55)"; c.fillRect(x - 7, y - 2, 14, 4); Art.drawFire(c, x, y, (1 + 0.25 * Math.sin(t * 9 + i)) * f, t + i); } });
      }
    }
    for (const z of G.lightZones) if (z.fire) list.push({ y: z.y, f: () => Art.drawFire(c, z.x, z.y, 0.7 * Math.min(1, z.t), t + z.x) });
    for (const k of G.pickups) list.push({ y: k.y, f: () => drawPickup(c, k, t) });
    for (const e of G.enemies) {
      if (e.x < left - 100 || e.x > view.right + 100 || e.y < top - 40 || e.y > view.bottom + 140) continue;
      list.push({ y: e.y, f: () => drawEnemy(c, e, t) });
    }
    for (const f of G.effects) if (f.type === "dissolve") list.push({ y: f.e.y, f: () => drawDissolve(c, f) });
    if (G.player && G.state !== "dead") list.push({ y: G.player.y, f: () => drawPlayer(c, G, t) });
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
    for (const f of G.effects) {
      if (f.type === "spark") {
        const a = 1 - f.t / f.max;
        c.fillStyle = `rgba(${f.col},${a})`;
        c.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      } else if (f.type === "ring") {
        const k = f.t / f.max, r = f.r0 + (f.r1 - f.r0) * Math.sqrt(k);
        c.strokeStyle = `rgba(${f.col},${(1 - k) * 0.9})`;
        c.lineWidth = f.w * (1 - k) + 1;
        c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.7, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.type === "slash") {
        drawSlash(c, f.x, f.y, f.ang, f.arc, f.r, f.t / f.max, f.col, f.w, false);
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
    for (const e of G.enemies) if (e.rise <= 0) drawEyes(c, e, t);
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
    const sh = o.type === "tree" ? 20 : o.type === "root" ? 40 : 12;
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
    if (o.def.hits && o.mineHp != null && o.mineHp < o.def.hits) drawCracks(c, o, name, 1 - o.mineHp / o.def.hits);
  }

  // Damage on a supply node: dark cracks in stone and iron, pale splintered chips in wood and plants.
  function drawCracks(c, o, name, k) {
    const s = Art.sprites[name], w = s.w * PS, h = s.h * PS;
    const cx = o.x, cy = o.y + 2 - h * 0.45;
    const wood = o.type === "wood" || o.type === "sprout";
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
      c.drawImage(s.c, pc.sx, pc.sy, pc.sw, pc.sh, (-pc.sw * PS) / 2, (-pc.sh * PS) / 2, pc.sw * PS, pc.sh * PS);
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
      c.beginPath(); c.arc(0, 0, DL.CAMP_RADIUS, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      return;
    }
    // trodden perimeter path and a flagstone plaza
    c.strokeStyle = "rgba(66,54,40,0.6)";
    c.lineWidth = 18;
    c.beginPath(); c.arc(0, 0, R - 34, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#3a342b";
    c.beginPath(); c.ellipse(0, 4, 58, 40, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2c271f";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      c.fillRect(Math.round(Math.cos(a) * 44) - 5, Math.round(4 + Math.sin(a) * 30) - 3, 10, 6);
    }
    // boardwalks out to each gate (the Beacon's run on out over the marsh)
    const reach = L.tier >= 3 ? R + 140 : R + 36;
    for (const g of DL.Camp.GATES) {
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

  function pushCamp(list, G, c, t) {
    const u = G.save.up, L = DL.Camp.layout(u), R = DL.WALL_R, night = G.nightAmt;
    const put = (y, f) => list.push({ y, f });
    for (const tn of L.tents) put(tn.y, () => { shadow(c, tn.x, tn.y + 2, 26, 7); sprite(c, "tent", tn.x, tn.y + 4, tn.flip); });
    for (const b of L.banners) put(b.y, () => { shadow(c, b.x, b.y + 1, 6, 2); sprite(c, "banner", b.x, b.y + 2); });
    if (L.forge) put(L.forge.y, () => { shadow(c, L.forge.x, L.forge.y + 2, 30, 7); sprite(c, "forge", L.forge.x, L.forge.y + 4); });
    if (L.armory) put(L.armory.y, () => {
      shadow(c, L.armory.x, L.armory.y + 2, 26, 7);
      if (L.tier >= 2) sprite(c, "awning", L.armory.x, L.armory.y + 4);
      sprite(c, "rack", L.armory.x, L.armory.y + 4);
    });
    if (L.workbench) put(L.workbench.y, () => {
      shadow(c, L.workbench.x, L.workbench.y + 2, 26, 7);
      if (L.tier >= 2) sprite(c, "awning", L.workbench.x, L.workbench.y + 4, true);
      sprite(c, "workbench", L.workbench.x, L.workbench.y + 4);
    });
    if (L.garden) put(L.garden.y - 20, () => drawGarden(c, L.garden, u.garden, night, t));
    for (const tw of L.towers) put(tw.y, () => { shadow(c, tw.x, tw.y + 2, 20, 6); sprite(c, "tower", tw.x, tw.y + 4); });
    for (const q of G.pylons) put(q.y, () => {
      shadow(c, q.x, q.y + 2, 10, 3);
      sprite(c, "pylon", q.x, q.y + 4);
      if (q.lit) for (const ox of [-14, 8]) {
        c.fillStyle = "#ffab3d"; c.fillRect(q.x + ox, q.y - 82, 6, 10);
        c.fillStyle = "#fff1c2"; c.fillRect(q.x + ox + 2, q.y - 80, 2, 5);
      }
      if (q.hp < q.max) bar(c, q.x, q.y - 120, 24, q.hp / q.max, "#ffb35a");
    });
    // barricade: stakes, then a palisade with four gates
    if (u.stakes === 1) {
      const n = 34;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.cos(a) * (R - 10), y = Math.sin(a) * (R - 10);
        put(y, () => sprite(c, "stake", x, y + 2, i % 2 === 0));
      }
    } else if (u.stakes >= 2) {
      const n = Math.ceil((Math.PI * 2 * R) / 46);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
        if (DL.Camp.nearestGate(x, y).arc < DL.Camp.GATE_HALF + 22) continue;
        put(y, () => sprite(c, "palisade", x, y + 4, i % 2 === 0));
      }
      for (const g of DL.Camp.GATES) for (const sgn of [-1, 1]) {
        const a = g + (sgn * (DL.Camp.GATE_HALF + 6)) / R, x = Math.cos(a) * R, y = Math.sin(a) * R;
        put(y + 1, () => {
          sprite(c, "gatePost", x, y + 4, sgn > 0);
          if (u.stakes >= 3) {
            c.fillStyle = "#2a2622"; c.fillRect(x + (sgn > 0 ? -14 : 6), y - 62, 8, 11);
            c.fillStyle = "#ffab3d"; c.fillRect(x + (sgn > 0 ? -12 : 8), y - 60, 4, 7);
          }
        });
        if (u.stakes >= 3) {
          // spikes flanking each gate on the outside
          for (let k = 0; k < 3; k++) {
            const b = g + (sgn * (DL.Camp.GATE_HALF + 4 + k * 9)) / R, sx = Math.cos(b) * (R + 22), sy = Math.sin(b) * (R + 22);
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
      if (L.tier === 1) sprite(c, "firering", 0, 10);
      else if (L.tier === 2) { sprite(c, "firepit2", 0, 14); fy = -2; }
      else { shadow(c, 0, 8, 40, 10, 0.45); sprite(c, "brazierBig", 0, 12); fy = -46; }
      if (f.lit) Art.drawFire(c, 0, fy, 1.6 + lvl * 0.25 + (f.hitT > 0 ? -0.4 : 0), t);
      else { c.fillStyle = "#6a2a14"; c.fillRect(-4, fy - 4, 3, 2); c.fillRect(3, fy - 2, 2, 2); }
      if (f.lit && f.hp < f.max) bar(c, 0, fy - 50 - lvl * 4, 46, f.hp / f.max, "#ffb35a");
    });
  }

  function drawGarden(c, g, lvl, night, t) {
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
      Art.drawFire(c, tr.x, tr.y - 22, 1.1, t);
    } else {
      shadow(c, tr.x, tr.y, 6, 3);
      sprite(c, "torch", tr.x, tr.y + 2);
      const k = tr.t < 8 ? tr.t / 8 : 1;
      Art.drawFire(c, tr.x, tr.y - 44, 0.5 + 0.5 * k, t);
    }
    if (tr.hp < (tr.type === "brazier" ? 60 : 40)) bar(c, tr.x, tr.y - 64, 22, tr.hp / (tr.type === "brazier" ? 60 : 40), "#ffb35a");
  }

  function drawPickup(c, k, t) {
    const y = k.y - 6 - Math.abs(Math.sin(t * 5 + k.x)) * 3;
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.fillRect(k.x - 3, k.y - 1, 6, 2);
    c.fillStyle = "#07090a";
    c.fillRect(k.x - 4, y - 4, 8, 8);
    c.fillStyle = DL.RESOURCES[k.res].color;
    c.fillRect(k.x - 3, y - 3, 6, 6);
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillRect(k.x - 2, y - 2, 2, 2);
  }

  // Which animation the player shows this frame: [anim, frame, facing angle].
  function playerAnim(G, p, t) {
    if (G.state === "dying") return ["death", Math.min(2, Math.floor(G.dying / 0.45)), p.angle];
    if (p.dashT > 0) return ["dash", 0, p.angle];
    if (p.hurtFlash > 0.15) return ["hurt", 0, p.angle];
    if (p.swing) return ["attack", Math.min(2, Math.floor((p.swing.t / p.swing.dur) * 3)), p.swing.ang];
    if (p.moving) return ["walk", Math.floor(p.animT * 8), p.angle];
    return ["idle", Math.floor(t * 1.6), p.angle];
  }

  function drawPlayer(c, G, t) {
    const p = G.player;
    const key = G.save.kit + (G.state === "dying" ? 4 : p.stage);
    for (const tr of p.trail) Art.drawUnit(c, key, "dash", 0, tr.ang, tr.x, tr.y, 1, { alpha: tr.life * 1.4, flash: 0.5, flashColor: "#ffd59a" });
    shadow(c, p.x, p.y, 15, 5);
    const [anim, fr, ang] = playerAnim(G, p, t);
    let alpha = 1;
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2) alpha = 0.65;
    Art.drawUnit(c, key, anim, fr, ang, p.x, p.y, 1, { alpha, flash: p.flash > 0 ? 0.7 : 0, flashColor: "#ff9a9a" });
  }

  const unitKey = (e) => (e.isSelf ? "self_" + DL.Game.save.kit : e.type);

  function enemyAnim(e, t) {
    if (e.state === "windup") return ["attack", 0, e.aim];
    if (e.state === "recover") return ["attack", e.stT > 0.2 ? 1 : 2, e.aim];
    if (e.moving) return ["walk", Math.floor(e.animT * (e.def.crawl ? 10 : 7)), e.angle];
    return ["idle", Math.floor(t * 1.6 + e.animT), e.angle];
  }

  function drawEnemy(c, e, t) {
    const d = e.def, s = d.scale;
    if (e.rise > 0) {
      // clawing up out of the water
      const k = 1 - e.rise / 0.9;
      c.save();
      c.beginPath(); c.rect(e.x - 60, e.y - 160, 120, 160); c.clip();
      Art.drawUnit(c, unitKey(e), "walk", Math.floor(k * 8), e.angle, e.x, e.y + (1 - k) * 34 * s, s, { alpha: 0.4 + 0.6 * k });
      c.restore();
      c.fillStyle = "rgba(60,200,210,0.5)";
      c.beginPath(); c.ellipse(e.x, e.y, 14 * s + 4, 4, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    shadow(c, e.x, e.y, 14 * s, 5 * s);
    if (e.state === "windup") {
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
    const flash = e.flash > 0 ? 0.9 : e.state === "windup" ? 0.2 + 0.2 * Math.sin(t * 30) : 0;
    const flashColor = e.flash > 0 ? "#ffffff" : "#7ff6ff";
    const [anim, fr, ang] = enemyAnim(e, t);
    Art.drawUnit(c, unitKey(e), anim, fr, ang, e.x, e.y, s, { flash, flashColor, alpha: e.dormant ? 0.8 : 1 });
    if (e.hp < e.maxHp) bar(c, e.x, e.y - (d.crawl ? 36 : 84) * s - 4, Math.round(26 * Math.max(1, s)), e.hp / e.maxHp, d.boss ? "#7ff6ff" : "#c8484e");
    if (e.burn > 0) Art.drawFire(c, e.x + Math.sin(t * 7) * 4, e.y - 10, 0.5, t);
  }

  // A soft cyan halo around the visor so the Drowned read in the dark.
  function drawEyes(c, e, t) {
    const s = e.def.scale;
    const ang = e.state === "move" ? e.angle : e.aim;
    const { dir, flip } = Art.unitDir(ang);
    if (dir === "up") return;
    const side = dir === "side" ? (flip ? -1 : 1) : 0;
    const x = e.x + side * (e.def.crawl ? 17 : 7) * s;
    const y = e.y - (e.def.crawl ? (dir === "side" ? 16 : 18) : 56) * s;
    const pulse = 0.75 + 0.25 * Math.sin(t * 5 + e.x);
    const r = 9 * s + 3;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(80,235,245,${0.5 * pulse})`);
    g.addColorStop(1, "rgba(80,235,245,0)");
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

  function drawProjectile(c, b) {
    const a = Math.atan2(b.vy, b.vx), ux = Math.cos(a), uy = Math.sin(a);
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
    if (G.wisp) {
      const w = G.wisp, g = c.createRadialGradient(w.x, w.y, 0, w.x, w.y, 14);
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
