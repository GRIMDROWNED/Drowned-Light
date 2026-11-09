/* Drowned Light — the endless wetland: chunked procedural ground and world objects. */
"use strict";
(function (DL) {
  const CH = 256;      // chunk size in world px
  const GS = 128;      // ground texture resolution per chunk (1 texel = 2 world px)
  const CAMP_CLEAR = 420; // no trees or rocks this close (camp-square distance): room for the walls at their widest
  const CAMP_DRY = 380;   // and no water
  // ...nor under the Refuge's terraces, which reach farther out (src/refuge.js)
  const dry = () => (DL.Refuge && DL.Game.save && DL.Refuge.on() ? Math.max(CAMP_DRY, DL.Refuge.clearR()) : CAMP_DRY);
  // waterVal below WATER is water (about a tenth of the land), up to SHORE is its muddy edge, where reeds grow.
  const WATER = 0.31, SHORE = 0.345;
  const RIM_SHORE = 420; // px of Abyss shore inside the black water at the world's edge
  const GROUND_K = 0.62; // drawn ground textures are darkened by this to stay under the characters and props

  // The map's grid ends GRID px out (Camp.sq); past it a rim of Abyss shore, then black water to EDGE, where the
  // world ends (DL.MAP, docs/PYRAMID-PLAN.md). Derek's Hollow lies off the map and isn't bounded.
  // Off the map: Derek's Hollow and the dungeons (src/dungeon.js; nothing of the wetland is made there).
  const offMap = (x, y) => DL.Cave.inRegion(x, y) || DL.Dungeon.inRegion(x, y);
  const GRID = DL.MAP.cell * (DL.MAP.rings + 0.5), EDGE = GRID + DL.MAP.rim, SEA = 160;

  const W = (DL.World = {
    CH, GRID, EDGE,
    // Past the world's end (or on the black water just inside it)?
    // (the shore wobbles up to 120 px either way, so the world's end isn't a ruled line)
    shoreOut(x, y) { return DL.Camp.sq(x, y) - (EDGE - SEA) + (DL.fbm(x / 300, y / 300, 91) - 0.5) * 240; },
    beyond(x, y, pad = 0) { return !offMap(x, y) && this.shoreOut(x, y) > -pad; },
    chunks: new Map(),
    ground: new Map(),

    zoneIndex(x, y) {
      if (DL.Cave.inRegion(x, y)) return DL.CAVE.zone; // Derek's Hollow, far off the map
      if (DL.Dungeon.inRegion(x, y)) return 0; // the dungeons (src/dungeon.js)
      const d = DL.Camp.sq(x, y); // the zones are the map's square rings
      let z = 0;
      for (let i = 0; i < DL.ZONES.length; i++) if (d >= DL.ZONES[i].r) z = i;
      return z;
    },
    zone(x, y) { return DL.ZONES[this.zoneIndex(x, y)]; },

    waterVal(x, y) { return DL.fbm(x / 260, y / 260, 11); },
    isWater(x, y) { return DL.Camp.sq(x, y) > dry() && !offMap(x, y) && (this.waterVal(x, y) < WATER || this.beyond(x, y)); },
    isShore(x, y) { const w = this.waterVal(x, y); return DL.Camp.sq(x, y) > dry() && !offMap(x, y) && w >= WATER && w < SHORE; },

    chunk(cx, cy) {
      const key = cx + "," + cy;
      let c = this.chunks.get(key);
      if (!c) { c = { cx, cy, objects: this.gen(cx, cy) }; this.chunks.set(key, c); }
      return c;
    },

    gen(cx, cy) {
      const objs = [];
      const mx = (cx + 0.5) * CH, my = (cy + 0.5) * CH;
      if (offMap(mx, my)) return []; // the Hollow's cave floor and the Spires are bare
      if (this.beyond(mx, my, -CH - 120)) return []; // the black water at the world's end
      const zi = Math.max(1, this.zoneIndex(mx, my));
      const D = DL.Game.diff();
      // Each chunk lies inside exactly one cell of the grove grid (the cell is a whole number of chunks).
      const grove = this.grove(Math.floor(mx / DL.GROVE.cell), Math.floor(my / DL.GROVE.cell), D);
      // The Bone Wolf den keeps a clearing of bare ground round it (src/den.js).
      const den = DL.Den.spot(), denR = DL.DEN.clear, denHere = Math.hypot(mx - den.x, my - den.y) < CH + denR;
      // and Kindle's resting place a smaller one, so he isn't lost under a tree (src/kindle.js)
      const kin = DL.Kindle.spot(), kinHere = Math.hypot(mx - kin.x, my - kin.y) < CH + 70;
      // and the Abyss graves a clearing for their stones (src/abigail.js)
      const gs = DL.Abigail.graveSpot(), gsR = DL.ABIGAIL.clear, gsHere = Math.hypot(mx - gs.x, my - gs.y) < CH + gsR;
      // and the Deadly Rose's garden one for her roses (src/rose.js)
      const rl = DL.Rose.lair(), rlHere = Math.hypot(mx - rl.x, my - rl.y) < CH + DL.ROSE.clear;
      // and Fred's fairy ring one for its toadstools (src/fred.js)
      const fr = DL.Fred.ringSpot(), frHere = Math.hypot(mx - fr.x, my - fr.y) < CH + DL.FRED.clear;
      // and the wyvern's nest one for its rocks (src/wyvern.js)
      const wn = DL.Wyvern.nestSpot(), wnHere = Math.hypot(mx - wn.x, my - wn.y) < CH + DL.WYVERN.clear;
      // and the Drowned Gate's arena and black water bare ground (src/finale.js)
      const fg = DL.Finale.gate(), fnHere = Math.hypot(mx - fg.x, my - fg.y - DL.FINALE.gate.arenaY) < CH + DL.FINALE.gate.clear + 900;
      const n = Math.round(DL.ZONES[zi].density * D.density * (0.7 + DL.hash(cx, cy, 5) * 0.6));
      for (let i = 0; i < n; i++) {
        const x = (cx + DL.hash(cx, cy, i * 3 + 1)) * CH, y = (cy + DL.hash(cx, cy, i * 3 + 2)) * CH;
        if (DL.Camp.sq(x, y) < CAMP_CLEAR || DL.Cave.clears(x, y)) continue;
        // the Pyramid's cross of stairways (src/pyramid.js) stays clear
        if (Math.min(Math.abs(x), Math.abs(y)) < DL.PYRAMID.stairW / 2 + 45 && DL.Camp.sq(x, y) < GRID) continue;
        const ozi = Math.max(1, this.zoneIndex(x, y));
        let type = DL.weighted(DL.SPAWN_TABLE[ozi], DL.hash(cx, cy, i * 3 + 3));
        // "gap" is where driftwood used to lie: nothing spawns there, so the ground is clearer
        if (type === "gap") continue;
        // nothing grows in the water; reeds grow only on its edge, and half of what lands there turns to reeds
        if (this.isWater(x, y)) continue;
        if (this.isShore(x, y)) { if (DL.hash(cx, cy, i * 7 + 9) < 0.5) type = "reeds"; }
        else if (type === "reeds") continue;
        // a grove's heart is a clearing: no trees or rocks crowd its light
        if (grove && DL.OBJ[type].solid && Math.hypot(x - grove.x, y - grove.y) < DL.GROVE.clear) continue;
        if (denHere && Math.hypot(x - den.x, y - den.y) < denR) continue;
        if (kinHere && Math.hypot(x - kin.x, y - kin.y) < 70) continue;
        if (gsHere && Math.hypot(x - gs.x, y - gs.y) < gsR) continue;
        if (rlHere && DL.Rose.clears(x, y)) continue;
        if (frHere && DL.Fred.clears(x, y)) continue;
        if (wnHere && DL.Wyvern.clears(x, y)) continue;
        if (fnHere && DL.Finale.clears(x, y)) continue;
        const wild = this.makeObj(type, x, y, `${cx},${cy},${i}`, ozi, DL.hash(cx, cy, i * 5 + 4));
        wild.wild = true; // hidden once its square is held and paved (src/pyramid.js)
        objs.push(wild);
      }
      // The marsh beds of the Pyramid's squares (src/pyramid.js): each grows a few nodes, seen once the square is held.
      const B = DL.PYRAMID.beds, C = DL.MAP.cell;
      for (let gy = Math.round(cy * CH / C); gy <= Math.round((cy + 1) * CH / C); gy++) for (let gx = Math.round(cx * CH / C); gx <= Math.round((cx + 1) * CH / C); gx++) {
        for (const b of DL.Pyramid.beds(gx, gy)) for (let k = 0; k < B.nodes; k++) {
          const a = (k / B.nodes) * Math.PI * 2 + DL.hash(gx, gy, 3300 + b.i) * 6.28, r = b.half * 0.5;
          const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
          if (Math.floor(x / CH) !== cx || Math.floor(y / CH) !== cy || DL.Cave.clears(x, y)) continue;
          const bzi = Math.max(1, this.zoneIndex(x, y)), table = {};
          for (const [t, w] of Object.entries(DL.SPAWN_TABLE[bzi])) if (t !== "gap" && t !== "reeds") table[t] = w;
          const type = DL.weighted(table, DL.hash(gx * 7 + b.i, gy * 7 + k, 3400));
          const o = this.makeObj(type, x, y, `${cx},${cy},bed${gx}_${gy}_${b.i}_${k}`, bzi, DL.hash(gx, gy, 3500 + b.i * 5 + k));
          o.bed = gx + "," + gy;
          objs.push(o);
        }
      }
      // The Refuge's marsh beds on its outer wards (src/refuge.js): seen once their ward stands.
      if (DL.Refuge && DL.Refuge.beds) for (const b of DL.Refuge.beds()) for (let k = 0; k < B.nodes; k++) {
        const a = (k / B.nodes) * Math.PI * 2 + DL.hash(b.i, 7, 3600) * 6.28, r = b.half * 0.5;
        const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
        if (Math.floor(x / CH) !== cx || Math.floor(y / CH) !== cy) continue;
        const bzi = Math.max(1, this.zoneIndex(x, y)), table = {};
        for (const [t, w] of Object.entries(DL.SPAWN_TABLE[bzi])) if (t !== "gap" && t !== "reeds") table[t] = w;
        const type = DL.weighted(table, DL.hash(b.i * 7, k, 3700));
        const o = this.makeObj(type, x, y, `${cx},${cy},rbed${b.i}_${k}`, bzi, DL.hash(b.i, k, 3800));
        o.rbed = b.ring;
        objs.push(o);
      }
      // The blooms of this chunk's grove that stand inside it.
      if (grove) for (const g of grove.items) {
        if (Math.floor(g.x / CH) === cx && Math.floor(g.y / CH) === cy && !DL.Cave.clears(g.x, g.y)) {
          const o = this.makeObj(g.type, g.x, g.y, g.id, grove.zi, g.h);
          o.wild = true; // a grove under a held square's paving is gone too (src/pyramid.js)
          objs.push(o);
        }
      }
      if (Math.floor(den.x / CH) === cx && Math.floor(den.y / CH) === cy) objs.push(this.makeObj("den", den.x, den.y, `${cx},${cy},den`, zi, 0.3));
      if (gsHere) for (const g of DL.Abigail.graves()) {
        if (Math.floor(g.x / CH) === cx && Math.floor(g.y / CH) === cy) objs.push(this.makeObj(g.type, g.x, g.y, `${cx},${cy},grave${g.i}`, zi, (g.i * 0.37) % 1));
      }
      // Rare Mother Roots in the Mire and deeper.
      if (zi >= 2 && DL.hash(cx, cy, 77) < 0.06 * D.bloom && !this.isWater(mx, my) && !denHere && !gsHere && !frHere && !fnHere && !DL.Cave.clears(mx, my)) objs.push(this.makeObj("root", mx, my, `${cx},${cy},root`, zi, 0.5));
      return objs;
    },

    /* The bloom grove of grove-grid cell (gx, gy), or null. Its heart sits well inside the cell, so neighbouring
       groves are at least 2 * margin apart and the land between them is dark at night. Difficulty scales how
       many cells have one and how many blooms each holds. Deterministic, so every visit and every co-op peer
       sees the same groves. */
    grove(gx, gy, D) {
      const GR = DL.GROVE, span = GR.cell - 2 * GR.margin;
      if (DL.hash(gx, gy, 1001) >= GR.chance * D.bloom) return null;
      let x, y, zi = 0;
      for (let t = 0; t < 4 && !zi; t++) {
        x = gx * GR.cell + GR.margin + DL.hash(gx, gy, 1002 + t * 2) * span;
        y = gy * GR.cell + GR.margin + DL.hash(gx, gy, 1003 + t * 2) * span;
        if (Math.hypot(x, y) > CAMP_CLEAR + GR.spread + 80 && !this.isWater(x, y)) zi = Math.max(1, this.zoneIndex(x, y));
      }
      if (!zi) return null;
      const Z = GR.zones[zi], items = [];
      const count = (r, s, scale) => Math.round((r[0] + Math.floor(DL.hash(gx, gy, s) * (r[1] - r[0] + 1))) * scale);
      const lights = [];
      const nRefuge = Math.max(1, count(Z.refuge, 1020, Math.sqrt(D.bloom)));
      const nSentinel = count(Z.sentinel, 1021, Math.sqrt(D.bloom));
      for (let k = 0; k < nRefuge; k++) lights.push("refuge");
      for (let k = 0; k < nSentinel; k++) lights.splice(1 + Math.floor(DL.hash(gx, gy, 1030 + k) * lights.length), 0, "sentinel");
      // Blooms on a jittered sunflower spiral round the heart, so they clump without stacking.
      const turn = DL.hash(gx, gy, 1022) * Math.PI * 2;
      lights.forEach((type, k) => {
        const a = turn + k * 2.39996 + (DL.hash(gx, gy, 1100 + k) - 0.5) * 0.6;
        const r = GR.spread * Math.sqrt((k + 0.4) / lights.length) * (0.85 + 0.3 * DL.hash(gx, gy, 1200 + k));
        items.push({ type, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, id: `grove${gx},${gy},${k}`, h: DL.hash(gx, gy, 1300 + k) });
      });
      // Bloom Sprouts (resin) grow in the gaps between them, so there is work to do while you hold the grove.
      const nSprout = count(Z.sprout, 1023, 1);
      for (let k = 0; k < nSprout; k++) {
        const a = turn + 1.2 + (k / nSprout) * Math.PI * 2 + (DL.hash(gx, gy, 1400 + k) - 0.5) * 0.8;
        const r = GR.spread * (0.55 + 0.5 * DL.hash(gx, gy, 1500 + k));
        items.push({ type: "sprout", x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, id: `grove${gx},${gy},s${k}`, h: DL.hash(gx, gy, 1600 + k) });
      }
      return { x, y, zi, items: items.filter((g) => !this.isWater(g.x, g.y)) };
    },

    makeObj(type, x, y, id, zi, h) {
      const def = DL.OBJ[type];
      const o = { id, type, def, x, y, zi, variant: h < 0.5 ? 0 : 1, flip: h > 0.62, harvested: false, dead: false, cd: 0, hitT: 0 };
      if (def.res) o.amount = Math.max(1, Math.round(def.base * DL.ZONES[zi].yield * DL.Game.diff().yield * (0.8 + h * 0.5)));
      if (def.hp) o.hp = o.maxHp = def.hp * (1 + 0.25 * (zi - 1));
      if (def.rad) o.rad = def.rad;
      return o;
    },

    // Visit every object in chunks overlapping the square around (x, y).
    near(x, y, R, fn) {
      const x0 = Math.floor((x - R) / CH), x1 = Math.floor((x + R) / CH);
      const y0 = Math.floor((y - R) / CH), y1 = Math.floor((y + R) / CH);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const objs = this.chunk(cx, cy).objects, v = DL.Pyramid.ver;
        for (let i = 0; i < objs.length; i++) {
          const o = objs[i];
          if (o.pv !== v) { o.pv = v; o.off = DL.Pyramid.hides(o); } // paved over, or a bed of land not yet held
          if (!o.off) fn(o);
        }
      }
    },

    // Push a circle out of solid objects (trees, rocks, pillars, roots).
    collide(ent, r) {
      DL.Cave.collide(ent, r); // the cave mouth's mound, and the Hollow's walls
      DL.Dungeon.collide(ent, r); // in a dungeon only its stone holds you up
      // nobody wades out past the world's end
      if (!offMap(ent.x, ent.y)) {
        const lim = EDGE - SEA - 120 - r;
        ent.x = Math.max(-lim, Math.min(lim, ent.x)); ent.y = Math.max(-lim, Math.min(lim, ent.y));
      }
      this.near(ent.x, ent.y, 60, (o) => {
        const s = o.def.solid;
        if (!s || o.harvested) return;
        const dx = ent.x - o.x, dy = ent.y - o.y, d = Math.hypot(dx, dy), min = s + r;
        if (d < min && d > 0.01) { ent.x = o.x + (dx / d) * min; ent.y = o.y + (dy / d) * min; }
      });
    },

    // Dawn: harvested nodes regrow and withered blooms return.
    resetDay() {
      for (const c of this.chunks.values()) for (const o of c.objects) {
        o.harvested = false; o.dead = false; o.cd = 0; o.mineHp = null;
        if (o.maxHp) o.hp = o.maxHp;
      }
    },

    /* ---- ground texture ---- */
    // Drawn ground textures (assets/sprites/ground), one texel per ground texel, repeating. Until one loads,
    // or if it's missing, that terrain keeps its coded colours. Each load drops the built chunks to redraw.
    tex: {},
    canvases: {},
    loadGround() {
      for (const n of ["campEarth", "campFlags", "campPaving", "grass", "dirt", "shore", "shallow", "deep", "boardwalk", "caveFloor", "rimDeep", "rimShore"]) {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          this.canvases[n] = c;
          this.tex[n] = { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
          this.ground.clear();
        };
        img.src = DL.asset("assets/sprites/ground/" + n + ".png");
      }
    },
    // The colour of texture n at world (x, y), darkened by k to sit under the art; null if not loaded.
    texel(n, x, y, k) {
      const t = this.tex[n];
      if (!t) return null;
      const tx = (((x >> 1) % t.w) + t.w) % t.w, ty = (((y >> 1) % t.h) + t.h) % t.h, i = (ty * t.w + tx) * 4;
      return [t.d[i] * k, t.d[i + 1] * k, t.d[i + 2] * k];
    },

    groundCanvas(cx, cy, allowBuild) {
      const key = cx + "," + cy;
      let c = this.ground.get(key);
      if (c) { this.ground.delete(key); this.ground.set(key, c); return c; } // kept newest, so the oldest unseen chunk goes first
      if (!allowBuild) return c;
      c = this.buildGround(cx, cy);
      this.ground.set(key, c);
      if (this.ground.size > 180) this.ground.delete(this.ground.keys().next().value);
      return c;
    },

    buildGround(cx, cy) {
      const c = document.createElement("canvas");
      c.width = c.height = GS;
      const g = c.getContext("2d");
      const img = g.createImageData(GS, GS), p = img.data;
      for (let py = 0; py < GS; py++) for (let px = 0; px < GS; px++) {
        const x = cx * CH + px * 2, y = cy * CH + py * 2;
        const col = this.groundColor(x, y);
        const i = (py * GS + px) * 4;
        p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    },

    groundColor(x, y) {
      if (DL.Cave.inRegion(x, y)) return DL.Cave.groundColor(x, y);
      const out = DL.Camp.sq(x, y) > GRID ? this.shoreOut(x, y) : -1;
      if (out > 0) {
        // the black water at the world's end, darkening out to nothing
        const k = Math.min(1, out / 600), dp = this.texel("rimDeep", x, y, 1.1 * (1 - k)) || this.texel("deep", x, y, 0.55 * (1 - k));
        if (dp) return dp;
        return [6 * (1 - k), 12 * (1 - k), 16 * (1 - k)];
      }
      const d = Math.hypot(x, y);
      const depth = Math.min(1, d / 5000);
      const h = DL.hash(x >> 1, y >> 1, 3);
      let r, g, b;
      // Camp earth (only worked out where it shows: in the camp, and blended in round the hearth; building a chunk
      // is a lot of pixels, and the camera pulling back near a boss builds many at once)
      const inCamp = DL.Camp.sq(x, y) < DL.WALL_R;
      let earth = null, er = 0, eg = 0, eb = 0;
      if (inCamp || d < 300) {
        const m0 = DL.noise(x / 40, y / 40, 4);
        earth = this.texel("campEarth", x, y, GROUND_K);
        er = earth ? earth[0] : 40 + m0 * 14; eg = earth ? earth[1] : 35 + m0 * 11; eb = earth ? earth[2] : 27 + m0 * 8;
      }
      if (inCamp) {
        r = er; g = eg; b = eb;
        if (!earth && h > 0.985) { r += 18; g += 16; b += 12; }
        else if (!earth && h < 0.02) { r -= 8; g -= 8; b -= 6; }
      } else {
        const w = this.waterVal(x, y);
        // water is kept brighter than the land so it reads at a glance
        const wet = w < WATER, sh = wet && this.texel("shallow", x, y, 0.95), dp = wet && this.texel("deep", x, y, 1.05);
        const so = w < SHORE ? this.texel("shore", x, y, 0.8) : null; // (the textures are only looked up where they're used)
        if (w < WATER && sh && dp && so) {
          // drawn water: shallow at the edge, deep further in, fading out of the shore over the first stretch
          const k = Math.min(1, (WATER - w) * 8), e = Math.max(0, (w - WATER + 0.008) / 0.008);
          r = DL.lerp(DL.lerp(sh[0], dp[0], k), so[0], e); g = DL.lerp(DL.lerp(sh[1], dp[1], k), so[1], e); b = DL.lerp(DL.lerp(sh[2], dp[2], k), so[2], e);
          if (w > WATER - 0.008 && w < WATER - 0.003) { r += 14; g += 26; b += 26; } // a pale wet line where the water starts
          if (h > 0.994 - depth * 0.01) { r = 40; g = 150; b = 160; }
        } else if (w < WATER) {
          const k = Math.min(1, (WATER - w) * 4);
          r = 10 - k * 4; g = 24 - k * 8; b = 32 - k * 6;
          if (h > 0.994 - depth * 0.01) { r = 40; g = 150; b = 160; }
          else if (DL.hash(x >> 3, y >> 1, 8) > 0.97) { r += 8; g += 14; b += 16; }
        } else if (w < SHORE && so) {
          [r, g, b] = so;
        } else if (w < SHORE) {
          r = 17; g = 35; b = 38;
          if (h > 0.85) { r = 24; g = 46; b = 46; }
        } else if (this.tex.grass && this.tex.dirt) {
          // drawn marsh: dirt where the moss noise is low, grass where it's high, blended between
          const m = DL.fbm(x / 110, y / 110, 21), k = Math.min(1, Math.max(0, (m - 0.42) / 0.12));
          const gr = this.texel("grass", x, y, GROUND_K), di = this.texel("dirt", x, y, GROUND_K);
          r = DL.lerp(di[0], gr[0], k); g = DL.lerp(di[1], gr[1], k); b = DL.lerp(di[2], gr[2], k);
          if (w < SHORE + 0.025) { const t = (SHORE + 0.025 - w) / 0.025; r *= 1 - 0.2 * t; g *= 1 - 0.12 * t; b *= 1 - 0.05 * t; }
        } else {
          const m = DL.fbm(x / 110, y / 110, 21);
          if (m > 0.56) { r = 30; g = 44; b = 30; } else if (m > 0.42) { r = 28; g = 36; b = 29; } else { r = 32; g = 31; b = 27; }
          if (h > 0.955) { r += 14; g += 18; b += 9; }
          else if (h < 0.04) { r -= 9; g -= 9; b -= 8; }
          if (w < SHORE + 0.025 && h > 0.6) { r -= 5; g -= 2; b += 2; }
        }
        // the Abyss shore: the last stretch of land before the black water turns to wet black mud
        const so2 = DL.Camp.sq(x, y) > GRID && out > -RIM_SHORE && this.texel("rimShore", x, y, GROUND_K);
        if (so2) { const t = Math.min(1, (out + RIM_SHORE) / (RIM_SHORE * 0.6)); r = DL.lerp(r, so2[0], t); g = DL.lerp(g, so2[1], t); b = DL.lerp(b, so2[2], t); }
        if (d < 300) {
          const t = (300 - d) / 65;
          r = DL.lerp(r, er, t); g = DL.lerp(g, eg, t); b = DL.lerp(b, eb, t);
        }
      }
      const f = 1 - depth * 0.35;
      return [Math.max(0, r * f), Math.max(0, g * f), Math.max(0, b * f * (1 + depth * 0.25))];
    },
  });
})(window.DL);
