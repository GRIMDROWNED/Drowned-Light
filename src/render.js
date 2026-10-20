/* Drowned Light — rendering: world, characters, darkness and light. */
"use strict";
(function (DL) {
  const W = DL.World, Art = DL.Art;
  const KS = 0.22; // knight frame scale: 240×336 art → 53×74 world px
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
    R.W = innerWidth;
    R.H = innerHeight;
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

    /* camp ground details */
    c.strokeStyle = "rgba(90,75,55,0.35)";
    c.lineWidth = 3;
    c.setLineDash([6, 10]);
    c.beginPath(); c.arc(0, 0, DL.CAMP_RADIUS, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

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
    for (const pr of G.pearls) list.push({ y: pr.y, f: () => { sprite(c, "pearl", pr.x, pr.y - Math.sin(t * 3 + pr.x) * 2); } });
    pushCamp(list, G, c, t);
    for (const tr of G.torches) list.push({ y: tr.y, f: () => drawTorch(c, tr, t) });
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
      const s = p.swing;
      drawSlash(c, p.x, p.y - 24, s.ang, s.arc, s.range, s.t / s.dur, s.col, 9, s.flip);
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
    if (o.hitT > 0) x += Math.sin(G.t * 80) * 2;
    sprite(c, name, x, o.y + 2, o.flip);
    if (o.def.bloom && !o.dead && o.hp < o.maxHp) bar(c, o.x, o.y - Art.sprites[name].h * PS - 6, 34, o.hp / o.maxHp, "#5fe6ee");
    const g = G.player && G.player.gather;
    if (g && g.obj === o) {
      const k = g.t / o.def.gather;
      c.strokeStyle = "rgba(0,0,0,0.6)";
      c.lineWidth = 4;
      c.beginPath(); c.arc(o.x, o.y - 26, 11, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = DL.RESOURCES[o.def.res].color;
      c.lineWidth = 3;
      c.beginPath(); c.arc(o.x, o.y - 26, 11, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke();
    }
  }

  function bar(c, x, y, w, k, col) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 5);
    c.fillStyle = col;
    c.fillRect(Math.round(x - w / 2), Math.round(y), Math.max(0, w * k), 3);
  }

  function pushCamp(list, G, c, t) {
    const u = G.save.up;
    list.push({ y: -52, f: () => { shadow(c, -78, -50, 26, 7); sprite(c, "tent", -78, -48); } });
    list.push({ y: -64, f: () => { shadow(c, 70, -62, 26, 7); sprite(c, "tent", 70, -60, true); } });
    if (u.forge) list.push({ y: 44, f: () => { shadow(c, -100, 46, 16, 5); sprite(c, "anvil", -100, 48); } });
    if (u.armory) list.push({ y: 40, f: () => { shadow(c, 100, 42, 16, 5); sprite(c, "rack", 100, 44); } });
    if (u.lantern) list.push({ y: -88, f: () => sprite(c, "lanternpost", 14, -86) });
    for (let i = 0; i < u.tower; i++) {
      const tw = G.towers[i];
      list.push({ y: tw.y, f: () => { shadow(c, tw.x, tw.y + 2, 20, 6); sprite(c, "tower", tw.x, tw.y + 4); } });
    }
    if (u.stakes) {
      const n = 14 + u.stakes * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.cos(a) * 218, y = Math.sin(a) * 218;
        list.push({ y, f: () => sprite(c, "stake", x, y + 2, i % 2 === 0) });
      }
    }
    const f = G.flame;
    list.push({
      y: 2,
      f: () => {
        sprite(c, "firering", 0, 10);
        const lvl = u.flame;
        if (f.lit) Art.drawFire(c, 0, 2, 1.6 + lvl * 0.25 + (f.hitT > 0 ? -0.4 : 0), t);
        else { c.fillStyle = "#6a2a14"; c.fillRect(-4, -2, 3, 2); c.fillRect(3, 0, 2, 2); }
        if (f.lit && f.hp < f.max) bar(c, 0, -46 - lvl * 4, 46, f.hp / f.max, "#ffb35a");
      },
    });
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

  function drawPlayer(c, G, t) {
    const p = G.player;
    const col = Art.col(p.angle);
    for (const tr of p.trail) Art.drawKnight(c, "player", 2, tr.col, tr.x, tr.y, KS, { alpha: tr.life * 1.2 });
    shadow(c, p.x, p.y, 15, 5);
    let row = 0, bob = Math.sin(t * 2) * 0.5;
    if (p.dashT > 0) row = 2;
    else if (p.moving) { row = Math.floor(p.animT * 7) % 2 ? 1 : 0; bob = -Math.abs(Math.sin(p.animT * 11)) * 1.6; }
    const y = p.y + bob;
    let alpha = 1;
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2) alpha = 0.6;
    if (G.state === "dying") {
      const k = Math.min(1, G.dying / 1.6);
      Art.drawKnight(c, "player", row, col, p.x, y, KS, { alpha: 1 - k });
      Art.drawKnight(c, "drowned", row, col, p.x, y, KS, { alpha: k });
      return;
    }
    Art.drawKnight(c, "player", row, col, p.x, y, KS, { alpha, flash: p.flash > 0 ? 0.8 : 0, flashColor: "#ff9a9a" });
    const cor = DL.clamp((p.corrupt - 8) / 92, 0, 1);
    if (cor > 0) Art.drawKnight(c, "drowned", row, col, p.x, y, KS, { alpha: cor * 0.92 * alpha });
  }

  function drawEnemy(c, e, t) {
    const d = e.def, s = KS * d.scale;
    const col = Art.col(e.angle);
    if (e.rise > 0) {
      const k = 1 - e.rise / 0.9;
      c.save();
      c.beginPath(); c.rect(e.x - 40, e.y - 120, 80, 120); c.clip();
      Art.drawKnight(c, d.variant, 2, col, e.x, e.y + (1 - k) * 60 * d.scale, s, { alpha: 0.4 + 0.6 * k });
      c.restore();
      c.fillStyle = "rgba(60,200,210,0.5)";
      c.beginPath(); c.ellipse(e.x, e.y, 14, 4, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    shadow(c, e.x, e.y, 14 * d.scale, 5 * d.scale);
    let row = 0, bob = 0;
    if (d.crawl) row = 2;
    else if (e.moving) { row = Math.floor(e.animT * 6) % 2 ? 1 : 0; bob = -Math.abs(Math.sin(e.animT * 9)) * 1.2; }
    if (e.state === "windup") {
      // telegraph: lean back and glow
      const k = 1 - e.stT / d.windup;
      c.save();
      c.globalCompositeOperation = "lighter";
      if (d.ranged) {
        c.strokeStyle = `rgba(90,235,245,${0.15 + 0.5 * k})`;
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(e.x, e.y - 22); c.lineTo(e.x + Math.cos(e.aim) * 240, e.y - 22 + Math.sin(e.aim) * 240); c.stroke();
      } else {
        c.fillStyle = `rgba(60,220,230,${0.08 + 0.22 * k})`;
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.ellipse(e.x, e.y, d.range + 14, (d.range + 14) * 0.7, 0, e.aim - 0.95, e.aim + 0.95);
        c.closePath(); c.fill();
      }
      c.restore();
    }
    const flash = e.flash > 0 ? 0.9 : e.state === "windup" ? 0.25 + 0.25 * Math.sin(t * 30) : 0;
    const flashColor = e.flash > 0 ? "#ffffff" : "#7ff6ff";
    const alpha = e.dormant ? 0.75 : 1;
    // weapon props behind/around the body
    if (e.type === "defiler") drawDefilerLantern(c, e, t);
    Art.drawKnight(c, d.variant, row, col, e.x, e.y + bob, s, { flash, flashColor, alpha });
    if (e.type === "archer") drawBow(c, e);
    if (e.type === "blackguard") drawShield(c, e);
    if (e.type === "champion") drawCrown(c, e, t);
    if (e.hp < e.maxHp) bar(c, e.x, e.y - 72 * d.scale - 8, Math.round(26 * Math.max(1, d.scale)), e.hp / e.maxHp, d.boss ? "#7ff6ff" : "#c8484e");
    if (e.burn > 0) Art.drawFire(c, e.x + Math.sin(t * 7) * 4, e.y - 10, 0.5, t);
  }

  function drawEyes(c, e, t) {
    const s = e.def.scale, a = e.angle;
    if (Math.sin(a) < -0.45) return; // facing away
    const x = e.x + Math.cos(a) * 3 * s, y = e.y - (e.def.crawl ? 30 : 52) * s * (KS / 0.2);
    const pulse = 0.75 + 0.25 * Math.sin(t * 5 + e.x);
    const g = c.createRadialGradient(x, y, 0, x, y, 10 * s);
    g.addColorStop(0, `rgba(80,235,245,${0.45 * pulse})`);
    g.addColorStop(1, "rgba(80,235,245,0)");
    c.fillStyle = g;
    c.fillRect(x - 10 * s, y - 10 * s, 20 * s, 20 * s);
    c.fillStyle = `rgba(190,255,255,${pulse})`;
    const gap = Math.abs(Math.cos(a)) > 0.8 ? 0 : 2.5 * s;
    c.fillRect(x - gap - 1, y - 0.5, 2, 1.5);
    if (gap) c.fillRect(x + gap - 1, y - 0.5, 2, 1.5);
  }

  function drawBow(c, e) {
    const a = e.state === "windup" ? e.aim : e.angle, x = e.x + Math.cos(a) * 12, y = e.y - 26 + Math.sin(a) * 6;
    c.strokeStyle = "#3a2a20"; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 12, a - 1.2, a + 1.2); c.stroke();
    c.strokeStyle = "rgba(120,240,250,0.9)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + Math.cos(a - 1.2) * 12, y + Math.sin(a - 1.2) * 12); c.lineTo(x + Math.cos(a + 1.2) * 12, y + Math.sin(a + 1.2) * 12); c.stroke();
  }
  function drawShield(c, e) {
    const a = e.angle;
    if (Math.sin(a) < -0.3) return; // facing away: shield hidden behind the body
    const x = e.x + Math.cos(a) * 16, y = e.y - 32;
    c.fillStyle = "#07090a"; c.fillRect(x - 10, y - 15, 20, 30);
    c.fillStyle = "#2c3238"; c.fillRect(x - 9, y - 14, 18, 28);
    c.fillStyle = "#6e2a26"; c.fillRect(x - 9, y - 14, 18, 3); c.fillRect(x - 1, y - 11, 2, 25);
    c.fillStyle = "#4f5a62"; c.fillRect(x - 7, y - 10, 2, 20);
  }
  function drawDefilerLantern(c, e, t) {
    const x = e.x + 14, y = e.y - 62;
    c.strokeStyle = "#2a2622"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(e.x + 10, e.y); c.lineTo(x, y - 4); c.stroke();
    c.fillStyle = "#07090a"; c.fillRect(x - 5, y - 2, 10, 13);
    c.fillStyle = "#1c5c64"; c.fillRect(x - 4, y - 1, 8, 11);
    c.fillStyle = `rgba(140,250,255,${0.7 + 0.3 * Math.sin(t * 6 + e.x)})`; c.fillRect(x - 2, y + 1, 4, 7);
  }
  function drawCrown(c, e, t) {
    const y = e.y - 118, x = e.x;
    c.fillStyle = "#07090a";
    for (let i = -2; i <= 2; i++) c.fillRect(x + i * 6 - 2, y - 10 + Math.abs(i) * 3, 4, 12 - Math.abs(i) * 3);
    c.fillStyle = `rgba(120,245,255,${0.8 + 0.2 * Math.sin(t * 4)})`;
    for (let i = -2; i <= 2; i++) c.fillRect(x + i * 6 - 1, y - 9 + Math.abs(i) * 3, 2, 9 - Math.abs(i) * 3);
  }

  function drawDissolve(c, f) {
    const e = f.e, k = f.t / f.max, d = e.def;
    c.save();
    c.beginPath(); c.rect(e.x - 60, e.y - 200, 120, 200 - 0); c.clip();
    Art.drawKnight(c, d.variant, d.crawl ? 2 : 0, Art.col(e.angle), e.x, e.y + k * 30 * d.scale, KS * d.scale, { alpha: 1 - k, flash: 0.6, flashColor: "#5fe6ee" });
    c.restore();
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
    const a = Math.atan2(b.vy, b.vx);
    const len = b.kind === "arrow" ? 14 : b.kind === "bolt" ? 12 : 8;
    c.strokeStyle = `rgba(${b.col},0.95)`;
    c.lineWidth = b.kind === "shard" ? 3 : 2;
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.fillRect(b.x - 1, b.y - 1, 2, 2);
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
    const dark = Math.min(0.96, 0.12 + 0.84 * G.nightAmt + dim * (1 - G.nightAmt));
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
