/* Drowned Light — the Spark Bearer and the Portal Hall (Robert, 2026-11-10; it replaced the Fire Bearer, the Drowned
   Gate and the Sunken King).
   Nothing of it shows until it's earned (the secrecy rule): Central Flame DL.FINALE.flame, the Starved Bell and the
   Deadly Rose slain, Derek won, and your Kindle lit (Finale.ready). At the next dawn Kindle climbs into the Central Flame
   and drinks it in, and a spark catches in him: he stands up as the Spark Bearer, and north of the Flame the ground
   cracks open on a pit, the way down to the Portal Hall.
     the escort   (Robert, 2026-11-11: a ceremony, not a mission) the first time, walk up to him and he sets out from the
                  Flame for the pit, slowly, only while a knight walks with him (DL.FINALE.escort). At its edge he
                  climbs down and the party follows him into the hall (save.finale.hole: after that he waits by the pit
                  and you climb down yourself).
     the hall     Robert's picture, far off the map (DL.FINALE.hall): stone walkways over black water from the dais at
                  its heart out to eight portals, and a road off its foot back up to the camp. G.cave is set while the party is
                  down there (`hall: true`), so the world's clock, its spawns and its bosses leave it alone, just as in Derek's Hollow (src/cave.js).
     the defense  down in the hall the Bearer climbs onto the dais at the hall's heart to fill it with his
                  spark. The Drowned pour out of the eight dark portals at him (the Sunken King's Tide Stalkers, Sunken
                  Wisps and Tide Leeches among them) while the knights hold them off. Struck down he loses part of his
                  spark and gets up again. If every knight is down at once the hall casts the party out and the pit
                  stays shut until the next dawn.
     lit          the spark full, Kindle comes back off the dais, small again, the first portal (the Abyssal Spires)
                  opens and the victory screen shows. Each later portal opens when the dungeon behind the one before it
                  is cleared (Finale.cleared, G.save.dungeons). Walk into a lit portal and the party goes in
                  (DL.Rift.go); a dark one shows "???" until it wakes.
   The host runs it all; guests follow its snapshots (Finale.snap) and "hall" messages. The hall is Robert's picture
   (assets/sprites/hall, tools/cut_hall.py); the Bearer is his drawn Spark Bearer (props/sb*). Numbers: DL.FINALE (src/data.js). */
"use strict";
(function (DL) {
  const { dist, rand, TAU, clamp } = DL;
  const G = DL.Game, F = DL.FINALE, HL = F.hall;
  const toast = (m, k) => DL.UI && DL.UI.toast(m, k);
  const say = (m, k) => { toast(m, k); DL.Net.say(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const Finale = (DL.Finale = { b: null });
  const SPARK = "255,205,120";
  const now = () => performance.now() / 1000;
  let net = { stage: 0, charge: 0, mask: 0 }, seen = -1, winAt = 0;

  /* ---------------- state ---------------- */
  // stage: 0 nothing yet (all secret), 1 the Bearer waits (by the Flame, or by the pit once
  // he's been walked there: s.hole), 4 the hall is lit (old worlds' 2 and 3, the
  // march and the gate, go back to 1)
  const S = () => G.save.finale;
  Finale.stage = () => (G.isGuest() ? net.stage : S().stage);
  // while Kindle is the Bearer, the host's Kindle isn't at their heel (src/kindle.js)
  Finale.bearing = () => !G.isGuest() && S().stage === 1;
  Finale.ready = () => (G.save.up.flame || 0) >= F.flame && !!G.save.trophies.bell && !!G.save.trophies.rose && !!G.save.golem && !!G.save.kindle.lit;
  Finale.won = () => Finale.stage() === 4;
  Finale.sealed = () => S().fail === G.save.nights;
  const inHallNow = () => !!(G.cave && G.cave.hall);
  const defending = () => inHallNow() && G.cave.mode === "defend";

  /* ---------------- the dungeons behind the portals ---------------- */
  // A dungeon's boss beaten: it's cleared for good (from src/riftthrone.js, src/minebosses.js). Old worlds count too.
  Finale.cleared = function (id) {
    if (G.isGuest()) return;
    const d = (G.save.dungeons = G.save.dungeons || {});
    if (d[id]) return;
    d[id] = 1;
    G.persist();
    const i = F.portals.findIndex((q) => q && q.id === id);
    if (i >= 0 && Finale.won() && portalLit(i + 1)) setTimeout(() => say("Far below the camp, another portal in the Portal Hall wakes.", "good"), 4000);
  };
  Finale.isCleared = (id) => !!(G.save.dungeons || {})[id] || (id === "spires" && G.save.riftlord > 0) || (id === "mines" && G.save.sovereign > 0);
  // Portal `i` is open: the hall is lit, the dungeon behind it is built (and open), and the one before it is cleared
  // (the Sandbox opens every built one)
  function portalLit(i) {
    const q = F.portals[i];
    if (!q || S().stage !== 4) return false;
    const d = DL.Rift.DUNGEONS.find((x) => x.id === q.id);
    if (!d || (d.open && !d.open())) return false;
    return DL.SANDBOX || i === 0 || (F.portals[i - 1] && Finale.isCleared(F.portals[i - 1].id));
  }
  Finale.portalLit = (i) => (G.isGuest() ? !!(net.mask & (1 << i)) : portalLit(i));
  const litCount = () => F.portals.reduce((n, q, i) => n + (Finale.portalLit(i) ? 1 : 0), 0);

  /* ---------------- where things are ---------------- */
  // Robert's picture of the hall (2026-11-10): winding stone walkways over black water, from the dais at its heart out to
  // the eight portals' platforms, and a road off its foot back up to the camp. Where one may stand is its walk mask
  // (assets/sprites/hall/walk.png, half the picture's size, from tools/cut_hall.py).
  const HX = HL.x, HY = HL.y, SC = HL.s, X0 = HX - (HL.w * SC) / 2, Y0 = HY - (HL.h * SC) / 2;
  const at = (q) => ({ x: X0 + q[0] * SC, y: Y0 + q[1] * SC }); // a picture px in the world
  const DAIS = at(HL.dais), EXIT = at(HL.exit);
  Finale.inHall = (x, y) => Math.abs(x - HX) < (HL.w * SC) / 2 + 200 && Math.abs(y - HY) < (HL.h * SC) / 2 + 200;
  // a portal's mouth foot, `out` world px down from it (out onto its platform)
  const portalAt = (i, out) => { const o = at(HL.portals[i]); return { x: o.x, y: o.y + out }; };
  // the pit down, north of the Central Flame (on the ground the compact base keeps for it, DL.Camp.layout().hall; else
  // DL.FINALE.door), and where the Bearer waits: beside the Flame until he's led to the pit once (save.finale.hole),
  // then beside the pit
  const built = () => { const L = DL.Camp.layout ? DL.Camp.layout(G.save.up) : null; return L && L.hall ? L.hall : null; };
  const door = () => { const h = built(); return h ? { x: h.x, y: h.y + 20, hw: h.hw } : { x: F.door.x, y: F.door.y, hw: 44 }; };
  const pit = () => { const d = door(); return { x: d.x, y: d.y - 34 }; }; // the pit's middle (rx PIT_RX, ry PIT_RY)
  const PIT_RX = 46, PIT_RY = 24;
  const flameSpot = () => ({ x: 78, y: 34 });
  const pitSide = () => { const d = door(); return { x: d.x + d.hw + 40, y: d.y + 10 }; };
  const waitSpot = () => (S().hole ? pitSide() : flameSpot());
  const backSpot = (n) => { const d = door(); return { x: d.x + (n ? 34 * n * (n % 2 ? 1 : -1) / 2 : 0), y: d.y + 70 }; }; // coming back up
  const topOfStair = (n) => { const e = at(HL.enter); return { x: e.x + (n ? 26 * n * (n % 2 ? 1 : -1) / 2 : 0), y: e.y }; };

  // the picture and its walk mask
  let PIC = null, WALK = null, MW = 0, MH = 0;
  function loadHall() {
    if (PIC) return;
    PIC = new Image();
    PIC.src = DL.asset("assets/sprites/hall/hall.jpg");
    const m = new Image();
    m.onload = () => {
      const cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = MW = m.width; cv.height = MH = m.height;
      g.drawImage(m, 0, 0);
      const d = g.getImageData(0, 0, MW, MH).data, w = new Uint8Array(MW * MH);
      for (let i = 0; i < w.length; i++) w[i] = d[i * 4] > 127 ? 1 : 0;
      WALK = w; fields.clear(); cells = null;
    };
    m.src = DL.asset("assets/sprites/hall/walk.png");
  }
  const MK = 2 * SC; // world px per mask px
  function walkable(x, y) {
    if (!WALK) return Finale.inHall(x, y); // (not loaded yet: anywhere)
    const mx = Math.floor((x - X0) / MK), my = Math.floor((y - Y0) / MK);
    return mx >= 0 && my >= 0 && mx < MW && my < MH && WALK[my * MW + mx] === 1;
  }
  const walkR = (x, y, m) => walkable(x, y) && walkable(x - m, y) && walkable(x + m, y) && walkable(x, y - m) && walkable(x, y + m);
  Finale.walkable = walkable;

  // Keep a walker on the stone: back to where it last stood (sliding along the edge if it can), as in the Spires.
  Finale.collideHall = function (ent, r) {
    if (!Finale.inHall(ent.x, ent.y)) return;
    loadHall();
    const m = Math.min(8, r * 0.6);
    if (!walkR(ent.x, ent.y, m)) {
      const lx = ent.hwx, ly = ent.hwy;
      if (lx == null || !Finale.inHall(lx, ly)) { /* nowhere to go back to: leave it be */ }
      else if (walkR(ent.x, ly, m)) ent.y = ly;
      else if (walkR(lx, ent.y, m)) ent.x = lx;
      else { ent.x = lx; ent.y = ly; }
    }
    ent.hwx = ent.x; ent.hwy = ent.y;
  };

  // The Drowned find their way along the walkways: a flow field over a coarse grid of the mask, one per target cell
  // (cached), followed as far ahead as there's a clear line. From the enemy walk in src/game.js.
  const CELL = 4, CW = CELL * MK; // mask px per cell; world px per cell
  let cells = null, GW = 0, GH = 0;
  const fields = new Map();
  function grid() { // a cell is open when a walker could stand at its middle (an edge's width in from the water)
    if (cells || !WALK) return cells;
    GW = Math.ceil(MW / CELL); GH = Math.ceil(MH / CELL);
    cells = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++)
      cells[gy * GW + gx] = walkR(X0 + (gx + 0.5) * CW, Y0 + (gy + 0.5) * CW, 12) ? 1 : 0;
    return cells;
  }
  const cellOf = (x, y) => { const gx = Math.floor((x - X0) / CW), gy = Math.floor((y - Y0) / CW); return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? -1 : gy * GW + gx; };
  function nearCell(k) { // the nearest open cell to cell k (a walker brushing the edge)
    if (k < 0) return -1;
    if (cells[k]) return k;
    const gx = k % GW, gy = (k / GW) | 0;
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && cells[y * GW + x]) return y * GW + x;
    }
    return -1;
  }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function field(goal) { // steps from every cell to the goal (a breadth-first flood)
    let f = fields.get(goal);
    if (f) return f;
    f = new Int32Array(GW * GH).fill(1e9);
    const q = new Int32Array(GW * GH);
    let h = 0, n = 0;
    f[goal] = 0; q[n++] = goal;
    while (h < n) {
      const k = q[h++], gx = k % GW, gy = (k / GW) | 0;
      for (let d = 0; d < 4; d++) {
        const x = gx + NB[d][0], y = gy + NB[d][1];
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        const j = y * GW + x;
        if (cells[j] && f[j] > f[k] + 1) { f[j] = f[k] + 1; q[n++] = j; }
      }
    }
    if (fields.size > 48) fields.delete(fields.keys().next().value);
    fields.set(goal, f);
    return f;
  }
  function clear(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
    for (let i = 1; i <= n; i++) if (!walkR(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 7)) return false;
    return true;
  }
  Finale.route = function (x, y, tx, ty) {
    if (!G.cave || !G.cave.hall || !Finale.inHall(x, y) || !grid()) return null;
    if (clear(x, y, tx, ty)) return null; // in sight: straight at it
    const goal = nearCell(cellOf(tx, ty)), from = nearCell(cellOf(x, y));
    if (goal < 0 || from < 0 || goal === from) return null;
    const f = field(goal);
    if (f[from] >= 1e9) return null;
    // downhill, as far along as stays in a clear line
    let k = from, best = null;
    for (let step = 0; step < 24; step++) {
      const gx = k % GW, gy = (k / GW) | 0;
      let nk = -1, nv = f[k];
      for (const [dx, dy] of NB) {
        const xx = gx + dx, yy = gy + dy;
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        if (dx && dy && (!cells[gy * GW + xx] || !cells[yy * GW + gx])) continue; // no cutting corners
        const j = yy * GW + xx;
        if (f[j] < nv) { nv = f[j]; nk = j; }
      }
      if (nk < 0) break;
      k = nk;
      if (step % 2 === 0 && k !== goal) continue; // (every other cell is looked at)
      const c = { x: X0 + ((k % GW) + 0.5) * CW, y: Y0 + (((k / GW) | 0) + 0.5) * CW };
      if (best && !clear(x, y, c.x, c.y)) break;
      best = c;
      if (k === goal) break;
    }
    return best || { x: X0 + ((k % GW) + 0.5) * CW, y: Y0 + (((k / GW) | 0) + 0.5) * CW };
  };

  /* ---------------- the Bearer ---------------- */
  const maxHp = () => Math.round(F.hp * G.partyScale());
  function makeBearer(x, y) {
    const max = maxHp();
    return { kind: "bearer", x, y, rad: 34, hp: max, max, lit: true, down: false, downT: 0, angle: Math.PI / 2, moving: false, animT: 0, hitT: 0, charge: 0, pulseT: F.pulseEvery };
  }
  Finale.reset = function () {
    Finale.b = null; winAt = 0;
    if (G.isGuest()) return;
    const s = S();
    if (s.stage === 2 || s.stage === 3) { s.stage = 1; s.rest = null; } // the march and the gate are gone: he waits again
    if (s.stage === 1) Finale.b = makeBearer(waitSpot().x, waitSpot().y);
  };
  function store() { G.persist(); }

  // The Drowned's blows on him (src/game.js), while they make him their goal.
  Finale.hurt = function (b, amt) {
    if (!b || b.down) return;
    b.hp -= amt;
    b.hitT = 0.2;
    if (defending()) b.charge = Math.max(0, b.charge - F.hitCharge);
    for (let i = 0; i < 4; i++) G.spark(b.x + rand(-14, 14), b.y - rand(40, 110), SPARK, 90);
    if (b.hp <= 0) fall(b);
  };
  // Struck down on the dais: he loses part of his spark, and gets up again after a while.
  function fall(b) {
    b.hp = 0; b.down = true; b.lit = false; b.downT = F.downFor;
    b.charge = Math.max(0, b.charge - F.fallLoss);
    for (let i = 0; i < 30; i++) G.puff(b.x + rand(-30, 30), b.y - rand(0, 140), "rgba(40,36,32,0.75)", 80, 1.3, -20);
    sfx("death");
    say(`The Spark Bearer falls! His spark gutters to ${Math.floor(b.charge * 100)}%. Hold them off until he gets up.`, "danger");
  }
  function getUp(b) {
    b.down = false; b.lit = true; b.hp = b.max * F.riseHp;
    for (const e of G.enemies) if (!e.removed && Finale.inHall(e.x, e.y)) e.goal = b; // they turn on him again
    for (let i = 0; i < 20; i++) G.spark(b.x + rand(-20, 20), b.y - rand(20, 120), SPARK, 100);
    say("The Spark Bearer climbs back onto the dais. His spark catches again.", "good");
  }
  // His fire scorches whatever crowds him.
  function pulse(b, dt) {
    b.pulseT -= dt;
    if (b.pulseT > 0) return;
    const prey = G.enemies.filter((e) => !e.removed && e.rise <= 0 && dist(e.x, e.y, b.x, b.y) < F.pulseR + e.def.radius);
    if (!prey.length) { b.pulseT = 0.4; return; }
    b.pulseT = F.pulseEvery;
    G.effects.push({ type: "ring", x: b.x, y: b.y - 6, r0: 20, r1: F.pulseR, col: SPARK, w: 6, t: 0, max: 0.5 });
    for (const e of prey) G.hitEnemy(e, F.pulseDmg, Math.atan2(e.y - b.y, e.x - b.x), 140, 6, true);
    sfx("flameHit");
  }

  /* ---------------- rising (host, at dawn) ---------------- */
  function rise() {
    const s = S();
    s.stage = 1; s.fail = -1; s.hole = 0;
    G.kindles = G.kindles.filter((k) => k.owner !== 0); // Kindle goes into the fire
    Finale.b = makeBearer(flameSpot().x, flameSpot().y);
    Finale.b.grow = 0;
    store();
    setTimeout(() => say("Kindle scuttles up onto the Central Flame and drinks it in, flame and all.", "good"), 2600);
    setTimeout(() => { sfx("milestone"); G.camera.shake = 10; say("A spark catches in him, and he stands up as tall as a tower: the Spark Bearer.", "good"); }, 6500);
    setTimeout(() => say("North of the Flame the ground cracks open on a deep pit, down to a hall no knight has seen. Walk up to the Spark Bearer and he'll lead the way.", "warn"), 11000);
  }
  Finale.dawn = function () {
    if (G.isGuest()) return;
    const s = S(), b = Finale.b;
    if (s.stage === 0 && Finale.ready()) return rise();
    if (b && !inHallNow()) { b.hp = b.max = maxHp(); b.down = false; b.lit = true; }
  };
  Finale.nightfall = function () {};
  // Sandbox (pause menu): raise him now, or put the hall back to sleep to play it again
  Finale.sandbox = function () {
    if (G.isGuest() || inHallNow()) return;
    const s = S();
    if (s.stage === 0) return rise();
    s.stage = 0; s.fail = -1; s.won = 0; s.hole = 0;
    Finale.b = null;
    if (G.save.kindle.lit && !G.kindles.some((k) => k.owner === 0)) DL.Kindle.back(G.player.x - 26, G.player.y + 10);
    store();
    toast("Sandbox: the Portal Hall sleeps again. Use the button once more to raise the Spark Bearer.", "warn");
  };
  Finale.sandboxLabel = () => (S().stage === 0 ? "Sandbox: raise the Spark Bearer" : "Sandbox: put the Portal Hall to sleep");

  /* ---------------- going down and coming up (host) ---------------- */
  const followers = () => [...G.hounds, ...G.golems, ...G.kindles];
  const everyone = () => [G.player, ...G.allies];
  function enter(mode) {
    if (G.state === "camp") DL.UI.closeCamp();
    G.cave = { hall: true, mode, intro: mode === "defend" ? 5 : 0, burstT: 2, surged: [], sendT: {} };
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = []; G.walls = []; G.lightZones = [];
    G.selfEnemy = null;
    const p = G.player, at = topOfStair(0);
    p.x = at.x; p.y = at.y; p.kx = p.ky = 0; p.dashT = 0; p.angle = -Math.PI / 2;
    G.camera.x = p.x; G.camera.y = p.y;
    for (const a of G.allies) pull(a);
    for (const f of followers()) { f.x = p.x + rand(-30, 30); f.y = p.y + rand(-10, 20); }
    if (mode === "defend") {
      const b = Finale.b || (Finale.b = makeBearer(DAIS.x, DAIS.y));
      Object.assign(b, { x: DAIS.x, y: DAIS.y, hp: maxHp(), max: maxHp(), down: false, lit: true, charge: 0, angle: Math.PI / 2, grow: 1, moving: false, walk: false, descend: null });
      sfx("rise");
      G.camera.shake = 8;
      say("Down the pit lies a hall of eight dark portals. The Spark Bearer climbs onto the dais at its heart and begins to burn. Something stirs in the portals: guard him until his spark fills the hall!", "warn");
    } else {
      sfx("chime");
      toast(`The Portal Hall. ${litCount()} of 8 portals burn; walk into one to go through. The road at its foot leads back up to the camp.`, "good");
      if (G.allies.length) DL.Net.say("Your party climbs down the pit into the Portal Hall.", "good");
    }
  }
  function pull(a) {
    const s = topOfStair(a.id);
    a.x = a.tx = s.x; a.y = a.ty = s.y;
    if (G.cave) G.cave.sendT[a.id] = 2;
    DL.Net.sendTo(a.id, { t: "hall", on: 1, mode: G.cave ? G.cave.mode : "open", x: s.x, y: s.y });
  }
  // Back up out of the pit into the camp (`lost`: cast out of a lost defense).
  function leave(lost) {
    G.cave = null;
    G.enemies = []; G.projectiles = []; G.telegraphs = []; G.hexPools = []; G.stoneWalls = [];
    const p = G.player, max = G.stats().maxHp, at = backSpot(0);
    if (lost || p.downT > 0) { p.downT = 0; p.hp = Math.max(1, max * F.failHp); p.inv = 1.5; }
    p.hallRise = 0;
    p.x = at.x; p.y = at.y; p.kx = p.ky = 0;
    G.camera.x = p.x; G.camera.y = p.y;
    for (const f of followers()) { f.x = p.x + rand(-30, 30); f.y = p.y + rand(-10, 20); }
    for (const a of G.allies) {
      const s = backSpot(a.id);
      a.x = a.tx = s.x; a.y = a.ty = s.y;
      DL.Net.sendTo(a.id, { t: "hall", on: 0, lost: lost ? 1 : 0, x: s.x, y: s.y });
    }
    for (const k of everyone()) k.hallT = 2;
    G.persist();
  }
  function lose() {
    const s = S(), b = Finale.b;
    s.fail = G.save.nights;
    leave(true);
    if (b) Object.assign(b, waitSpot(), { hp: maxHp(), max: maxHp(), down: false, lit: true, charge: 0, moving: false });
    sfx("death");
    say("Every knight is down. The hall casts you out, and the Spark Bearer climbs back out of the pit, his spark spent. The pit stays shut until the next dawn.", "danger");
  }
  function win() {
    const s = S(), b = Finale.b, cv = G.cave;
    s.stage = 4;
    s.won = G.save.day;
    cv.mode = "open";
    for (const e of G.enemies) {
      e.removed = true;
      for (let i = 0; i < 6; i++) G.puff(e.x + rand(-12, 12), e.y - rand(0, 40), "rgba(255,210,140,0.6)", 60, 0.8, -30);
    }
    G.enemies = []; G.projectiles = []; G.telegraphs = [];
    rouse(); // the fallen get up
    if (b) { b.leave = 0; b.down = false; b.lit = true; }
    G.camera.shake = 14;
    sfx("milestone");
    store();
    say("The Spark Bearer's spark fills the hall! Fire runs along the floor to every portal, and the first of them bursts into light.", "good");
    winAt = now() + 8;
  }
  // the knights who fell in the defense get up (the host here; friends from a message)
  function rouse() {
    const p = G.player, max = G.stats().maxHp;
    if (p.downT > 0) { p.downT = 0; p.hp = max * 0.5; p.inv = 1.5; }
    p.hallRise = 0;
    for (const a of G.allies) DL.Net.sendTo(a.id, { t: "hall", rise: 1 });
  }
  // Into a lit portal: back up out of the hall first (a run comes home to where it set out), then through.
  function go(i) {
    const q = F.portals[i];
    leave(false);
    if (!DL.Rift.go(q.id)) toast("The portal flickers, but won't let you through yet.", "warn");
  }

  /* ---------------- a knight falls in the hall ---------------- */
  // Not drowned: down until `knightRise` s have passed (or the defense is over). From die() via Cave.fall (src/game.js).
  Finale.fall = function () {
    const p = G.player;
    if (p.downT > 0) return true;
    p.downT = 1e9; // (src/game.js counts a guest's down time; the hall raises its own)
    p.hallRise = F.knightRise;
    p.hp = 0;
    sfx("death");
    for (let i = 0; i < 24; i++) G.puff(p.x + rand(-12, 12), p.y - rand(0, 60), "rgba(255,200,120,0.6)", 50, 1.2, -30);
    toast(`You fall. You'll get up in ${F.knightRise} seconds, if anyone still stands.`, "danger");
    return true;
  };
  function riseLocal(dt) {
    const p = G.player;
    if (!(p.downT > 0) || !(p.hallRise > 0) || !inHallNow()) return;
    p.hallRise -= dt;
    if (p.hallRise > 0) return;
    p.downT = 0; p.hallRise = 0; p.hp = G.stats().maxHp * 0.4; p.inv = 1.5;
    for (let i = 0; i < 12; i++) G.spark(p.x + rand(-10, 10), p.y - rand(0, 40), SPARK, 60);
    toast("You get back up.", "good");
  }

  /* ---------------- every frame ---------------- */
  Finale.update = function (dt) {
    riseLocal(dt);
    const b = Finale.b;
    if (b) {
      b.animT += dt * (b.moving ? 0.35 : 0.5);
      b.hitT = Math.max(0, b.hitT - dt);
      if (b.grow != null && b.grow < 1) b.grow = Math.min(1, b.grow + dt / 6);
    }
    if (G.isGuest()) return;
    if (b && b.leave != null) leaving(b, dt);
    if (inHallNow()) return G.cave.mode === "defend" ? defend(dt) : hub(dt);
    if (G.spires || G.cave || G.state !== "play" || S().stage < 1) return;
    if (b && S().stage === 1 && (!S().hole || b.descend != null)) return escort(b, dt);
    // climbing down into the pit north of the Central Flame
    const c = pit();
    for (const k of everyone()) {
      if (!k || k.down || k.downT > 0) continue;
      k.hallT = Math.max(0, (k.hallT || 0) - dt);
      const dx = (k.x - c.x) / PIT_RX, dy = (k.y - c.y) / PIT_RY;
      if (dx * dx + dy * dy > 0.6 || k.hallT > 0) continue;
      if (S().stage === 4) return enter("open");
      if (Finale.sealed()) { k.hallT = 6; tell(k, "The pit is shut. The hall will open again at dawn."); continue; }
      return enter("defend");
    }
  };
  const tell = (k, msg) => { if (k === G.player) { toast(msg, "warn"); sfx("deny"); } else DL.Net.tell(k.id, msg, "warn"); };

  // The first time: the knights walk the Spark Bearer from the Flame to the pit (a short, slow walk: a ceremony, not
  // a fight), and he climbs down into it, the party after him.
  function escort(b, dt) {
    if (b.descend != null) return descend(b, dt);
    const near = everyone().filter((k) => k && !k.down && !(k.downT > 0) && dist(k.x, k.y, b.x, b.y) < F.escort.near);
    if (!b.walk) { // waiting beside the Flame for a knight to step up to him
      b.moving = false;
      const k = near.find((q) => dist(q.x, q.y, b.x, b.y) < F.escort.start && !(q.hallT > 0));
      if (!k || (b.grow != null && b.grow < 1)) return;
      if (Finale.sealed()) { k.hallT = 6; tell(k, "The Spark Bearer's spark is spent. He'll set out again at dawn."); return; }
      b.walk = true; b.trailT = 0;
      sfx("chime");
      say("The Spark Bearer turns toward the pit and sets out, slow and solemn. Walk beside him.", "good");
    }
    const c = pit(), tx = c.x, ty = c.y + PIT_RY + 26, d = dist(b.x, b.y, tx, ty);
    b.moving = near.length > 0 && d > 4;
    if (!b.moving) return;
    const step = Math.min(d, F.escort.speed * dt);
    b.angle = Math.atan2(ty - b.y, tx - b.x);
    b.x += Math.cos(b.angle) * step; b.y += Math.sin(b.angle) * step;
    b.trailT -= dt;
    if (b.trailT <= 0) { b.trailT = 0.18; G.spark(b.x + rand(-16, 16), b.y - rand(0, 10), SPARK, 50); } // embers where he walks
    if (dist(b.x, b.y, tx, ty) > 4) return;
    b.moving = false; b.walk = false; b.descend = 0;
    S().hole = 1; store();
    sfx("rise"); G.camera.shake = 8;
    say("At the pit's edge the Spark Bearer stops. His light pours down into the dark, and he climbs down after it. Follow him!", "warn");
  }
  function descend(b, dt) {
    const c = pit();
    b.descend += dt / F.escort.descend;
    b.angle = -Math.PI / 2;
    b.x += (c.x - b.x) * Math.min(1, dt * 2); b.y += (c.y - b.y) * Math.min(1, dt * 2);
    if (Math.random() < 0.6) G.spark(c.x + rand(-PIT_RX, PIT_RX) * 0.7, c.y - rand(0, 30), SPARK, 140);
    if (b.descend < 1) return;
    b.descend = null;
    enter("defend");
  }
  // Into the hall's middle he goes (from the road at its foot); back out of it, small again, at the end.
  function leaving(b, dt) {
    b.leave += dt / 4;
    if (b.leave < 1) return;
    Finale.b = null;
    for (let i = 0; i < 30; i++) G.spark(DAIS.x + rand(-40, 40), DAIS.y - rand(0, 200), SPARK, 120);
    DL.Kindle.back(DAIS.x, DAIS.y + 40);
    say("Off the dais scuttles Kindle, small again, his fire still burning. He runs to your side.", "good");
  }

  // Host, in the defense.
  function defend(dt) {
    const cv = G.cave, b = Finale.b;
    for (const a of G.allies) { // a friend who joined late (or missed the message) is pulled down too
      if (Finale.inHall(a.tx, a.ty)) continue;
      cv.sendT[a.id] = (cv.sendT[a.id] || 0) - dt;
      if (cv.sendT[a.id] <= 0) pull(a);
    }
    if (G.player.downT > 0 && G.allies.every((a) => a.down)) return lose();
    if (!b) return;
    if (cv.intro > 0) { cv.intro -= dt; return; }
    if (b.down) {
      b.downT -= dt;
      if (b.downT <= 0) getUp(b);
    } else {
      const wisp = G.enemies.some((e) => e.type === "wisp" && !e.removed && e.rise <= 0);
      b.charge = Math.min(1, b.charge + (dt / F.charge) * (wisp ? F.wispSlow : 1));
      pulse(b, dt);
    }
    // a crowd at each mark
    F.surges.forEach((q, i) => {
      if (cv.surged[i] || b.charge < q.at) return;
      cv.surged[i] = true;
      for (const type in q.kinds) for (let n = 0; n < Math.max(1, Math.round(q.kinds[type] * G.partyScale())); n++) spawn(type, (Math.random() * 8) | 0);
      G.camera.shake = 10;
      sfx("growl");
      say(`${q.name}!`, "danger");
    });
    // and a steady flow out of the dark portals
    cv.burstT -= dt;
    if (cv.burstT <= 0) {
      cv.burstT = F.burst / G.diff().spawn;
      const live = G.enemies.filter((e) => !e.removed).length, cap = Math.round(F.cap * G.partyScale());
      const n = Math.round((F.n[0] + (F.n[1] - F.n[0]) * b.charge) * G.partyScale()), at = (Math.random() * 8) | 0;
      for (let i = 0; i < n && live + i < cap; i++) spawn(pickType(), at);
    }
    if (b.charge >= 1) win();
  }
  function pickType() {
    let sum = 0;
    for (const k in F.pool) sum += F.pool[k];
    let r = Math.random() * sum;
    for (const k in F.pool) { r -= F.pool[k]; if (r <= 0) return k; }
    return "footman";
  }
  function spawn(type, i) {
    const o = [70, 100, 130, 40].map((d) => portalAt(i, d)).find((q) => walkable(q.x, q.y)) || portalAt(i, 70), b = Finale.b;
    G.enemies.push(G.makeEnemy(type, o.x + rand(-24, 24), o.y + rand(-14, 14), F.zone, { rise: 0.6, goal: b && b.lit ? b : null }));
    for (let k = 0; k < 6; k++) G.puff(o.x + rand(-20, 20), o.y + rand(-8, 8), "rgba(150,90,220,0.6)", 60, 0.7, -30);
  }

  // Host, in the lit hall: the road back up, and the portals.
  function hub(dt) {
    for (const k of everyone()) {
      if (!k || k.down || k.downT > 0) continue;
      k.hallT = Math.max(0, (k.hallT || 0) - dt);
      if (k.y > EXIT.y && Math.abs(k.x - EXIT.x) < 160) return leave(false); // up the road off the hall's foot
      for (let i = 0; i < 8; i++) {
        const o = portalAt(i, 30);
        if (dist(k.x, k.y, o.x, o.y) > 50) continue;
        if (portalLit(i)) return go(i);
        if (k.hallT > 0) continue;
        k.hallT = 5;
        const msg = portalHint(i), id = k === G.player ? 0 : k.id;
        if (id === 0) { toast(msg, "warn"); sfx("deny"); } else DL.Net.tell(id, msg, "warn");
      }
    }
  }
  function portalHint(i) {
    const q = F.portals[i], before = F.portals[i - 1];
    if (!q) return "This portal is dark and cold. Nothing has been found behind it yet.";
    if (before && !Finale.isCleared(before.id)) return `This portal is dark. It wakes once you have cleared ${before.name.replace(/^The /, "the ")}.`;
    return "This portal stirs, but it hasn't woken yet.";
  }

  // The victory screen, once the hall is lit (every device).
  Finale.tick = function () {
    if (winAt && now() >= winAt) { winAt = 0; DL.UI.showWin(); }
  };
  Finale.local = function () {};

  /* ---------------- the camp menu, the field guide and the HUD ---------------- */
  Finale.card = function () {
    const st = Finale.stage();
    if (st < 1) return "";
    if (st === 4) return `<article class="card finale-card"><header><h3>The Portal Hall</h3><span class="tag">${litCount()} of 8 lit</span></header>
      <p>The Spark Bearer filled the hall below the camp with his spark. Climb down the pit north of the Central Flame and walk into a burning portal to reach the dungeon behind it. Clear a dungeon and the next portal wakes.</p></article>`;
    const shut = Finale.sealed();
    return `<article class="card finale-card"><header><h3>The Spark Bearer</h3><span class="tag">${shut ? "The pit is shut" : "Waiting"}</span></header>
      <p>Kindle drank the Central Flame and rose as the Spark Bearer. ${S().hole ? "He waits beside the pit north of the Flame" : "He waits beside the Flame for you to walk him to the pit north of it"}, down to a hall of eight dark portals. Climb down after him and hold the hall while he fills it with his spark: the Drowned will pour out of the portals at him.</p>
      ${shut ? `<footer><span class="req">The hall cast you out. The pit opens again at dawn.</span></footer>` : ""}</article>`;
  };
  Finale.guideLine = function () {
    const st = Finale.stage();
    if (st === 0) return "";
    if (st === 4) return `<b>The Portal Hall</b> lies down the pit north of the Central Flame: ${litCount()} of its 8 portals burn.`;
    return "<b>The Spark Bearer</b> waits " + (S().hole ? "by the pit north of" : "beside") + " the Central Flame, to lead you down to the Portal Hall.";
  };
  // The banner in the camp (the hall's own comes through Cave.objective, below)
  Finale.objective = function (p) {
    if (inHallNow() || Finale.stage() !== 1 || !Finale.b) return "";
    const b = Finale.b;
    if (b.descend != null) return "The Spark Bearer climbs down into the pit · follow him";
    if (b.walk || b.moving) return "Walk the Spark Bearer to the pit";
    if (dist(p.x, p.y, b.x, b.y) > 520 && dist(p.x, p.y, door().x, door().y) > 520) return "";
    if (Finale.sealed()) return "The pit to the Portal Hall is shut until dawn";
    return S().hole || G.isGuest() ? "The Spark Bearer waits · climb down the pit after him" : "The Spark Bearer waits · walk up to him and he'll lead you to the pit";
  };
  Finale.hallObjective = function () {
    const cv = G.cave, b = Finale.b;
    if (!cv) return "";
    if (cv.mode !== "defend") return `The Portal Hall · ${litCount()} of 8 portals lit`;
    const ch = Math.floor((G.isGuest() ? net.charge : b ? b.charge : 0) * 100);
    if (G.player.downT > 0) return `You're down · the Spark Bearer's spark ${ch}%`;
    if (b && b.down) return `The Spark Bearer is down · his spark ${ch}% · hold them off`;
    return `Guard the Spark Bearer · his spark ${ch}%` + (b ? ` · ${Math.max(0, Math.ceil(b.hp))} / ${b.max}` : "");
  };
  // The compass: back to the pit while the Bearer waits and you're out in the marsh.
  Finale.nav = function (p) {
    if (G.cave || G.spires || Finale.stage() !== 1) return null;
    return dist(p.x, p.y, door().x, door().y) > 700 ? (S().hole ? { x: door().x, y: door().y, label: "Portal Hall" } : { x: Finale.b ? Finale.b.x : 0, y: Finale.b ? Finale.b.y : 0, label: "Spark Bearer" }) : null;
  };
  // In the defense the camera pulls back to show the whole hall (src/render.js, src/game.js).
  Finale.view = (p) => (defending() && p && Finale.inHall(p.x, p.y) ? { need: 1150, needW: 1500, x: DAIS.x, y: DAIS.y - 60, lean: 0.5 } : null);

  /* ---------------- light ---------------- */
  // The hall's glow (it halts corruption, like the bloomlight), its platforms' lanterns, the burning portals, the Bearer.
  Finale.lights = function (L) {
    const b = Finale.b, p = G.player, diff = G.diff().light;
    if (b && !b.down) {
      const grow = b.grow != null ? b.grow : 1, fade = b.leave != null ? 1 - b.leave : 1;
      L.push({ x: b.x, y: b.y - 60, r: F.light * diff * (0.3 + 0.7 * grow) * fade, s: 1, col: SPARK, a: 0.95 * fade, flick: 1, kind: "human" });
    } else if (b && b.down) L.push({ x: b.x, y: b.y - 20, r: 70, s: 0.4, col: "255,120,40", a: 0.45, flick: 1 });
    if (p && Finale.inHall(p.x, p.y)) {
      // a dim glow over the whole hall, from the spark in the stone: no corruption builds down here
      L.push({ x: HX, y: HY, r: HL.w * SC * 0.6, s: 0.25, col: "200,170,140", a: 0.35, kind: "bloom" });
      L.push({ x: DAIS.x, y: DAIS.y, r: 420, s: 0.5, col: "255,180,110", a: 0.5, kind: "bloom" });
      L.push({ x: EXIT.x, y: EXIT.y, r: 200, s: 0.4, col: "255,180,110", a: 0.6 }); // the road up
      for (let i = 0; i < 8; i++) {
        const o = portalAt(i, 0), q = F.portals[i];
        L.push({ x: o.x, y: o.y + 70, r: 230 * diff, s: 0.7, col: "255,170,90", a: 0.7, flick: 1, kind: "bloom" }); // its platform's lanterns
        if (Finale.portalLit(i)) L.push({ x: o.x, y: o.y - 60, r: 240, s: 0.75, col: q.col, a: 0.9 });
      }
      if (Finale.stage() === 4 && !b) L.push({ x: DAIS.x, y: DAIS.y - 20, r: 260 * diff, s: 0.8, col: SPARK, a: 0.85, flick: 1, kind: "human" });
      return;
    }
    if (Finale.stage() >= 1 && p && Math.abs(p.x - door().x) < 1200 && Math.abs(p.y - door().y) < 1200)
      L.push({ x: door().x, y: door().y - 30, r: 90, s: 0.5, col: Finale.won() ? "200,150,255" : SPARK, a: 0.7 });
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Finale.snap = function () {
    const st = S().stage, b = Finale.b, cv = G.cave;
    if (!st && !b) return 0;
    let mask = 0;
    for (let i = 0; i < 8; i++) if (portalLit(i)) mask |= 1 << i;
    return [st, b ? [r1(b.x), r1(b.y), Math.round(b.hp), b.max, (b.down ? 1 : 0) | (b.moving ? 4 : 0), r1(b.angle), Math.round(b.charge * 1000) / 1000,
      b.leave != null ? r1(b.leave) : -1, b.grow != null ? r1(b.grow) : 1, b.descend != null ? r1(b.descend) : -1] : 0,
      cv && cv.hall ? [cv.mode === "defend" ? 1 : 0] : 0, mask];
  };
  Finale.applySnap = function (m) {
    if (!m) { net.stage = 0; net.mask = 0; Finale.b = null; return; }
    const was = net.stage;
    net.stage = m[0]; net.mask = m[3] || 0;
    if (seen < 0) seen = net.stage; // the stage when we joined: a hall lit before we came shows no victory
    if (net.stage === 4 && was !== 4 && seen !== 4) winAt = now() + 8;
    const r = m[1];
    if (r) {
      const b = Finale.b || (Finale.b = { kind: "bearer", x: r[0], y: r[1], rad: 34, animT: 0, hitT: 0 });
      if (Math.hypot(r[0] - b.x, r[1] - b.y) > 600) { b.x = r[0]; b.y = r[1]; } // into the hall, or back up: no gliding there
      Object.assign(b, { tx: r[0], ty: r[1], hp: r[2], max: r[3], down: !!(r[4] & 1), moving: !!(r[4] & 4), angle: r[5], lit: !(r[4] & 1), charge: r[6],
        leave: r[7] >= 0 ? r[7] : null, grow: r[8], descend: r[9] >= 0 ? r[9] : null });
      net.charge = r[6];
    } else Finale.b = null;
    if (m[2]) G.cave = { hall: true, mode: m[2][0] ? "defend" : "open", guest: true }; // (Cave.applySnap cleared it just before)
  };
  // Guest: glide the Bearer toward the host's position.
  Finale.guest = function (dt, k01) {
    const b = Finale.b;
    if (!b || b.tx == null) return;
    b.x += (b.tx - b.x) * k01; b.y += (b.ty - b.y) * k01;
  };
  // Guest: pulled down into the hall, sent back up, or raised when the defense is won.
  Finale.guestMsg = function (m) {
    const p = G.player, max = G.stats().maxHp;
    if (m.rise) { if (p.downT > 0) { p.downT = 0; p.hp = max * 0.5; p.inv = 1.5; } p.hallRise = 0; return; }
    if (m.on) {
      if (G.state === "camp") DL.UI.closeCamp();
      G.cave = { hall: true, mode: m.mode, guest: true };
    } else {
      G.cave = null;
      if (m.lost || p.downT > 0) { p.downT = 0; p.hp = Math.max(p.hp, max * F.failHp); }
      p.hallRise = 0;
    }
    p.x = m.x; p.y = m.y; p.kx = 0; p.ky = 0; p.inv = 1.5;
    G.camera.x = p.x; G.camera.y = p.y;
    G.enemies = []; G.projectiles = [];
    sfx(m.on ? "rise" : m.lost ? "death" : "chime");
  };

  /* ---------------- drawing: stand-ins until Robert's concept art is drawn ---------------- */
  // a soft round glow, painted once per colour and stamped (no gradients built every frame)
  const glows = {};
  function glowPic(col) {
    if (glows[col]) return glows[col];
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = cv.height = 64;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glows[col] = cv);
  }
  function glow(c, x, y, r, col, a) {
    c.globalAlpha = a;
    c.drawImage(glowPic(col), x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
  }
  // a drawn sprite, `k` world px per file px, anchored at (ax, ay) of its size, mirrored if asked
  function spr(c, n, x, y, k, flip) {
    const s = DL.Art.sprites[n];
    if (!s) return false;
    const w = Math.round(s.w * s.res * k), h = Math.round(s.h * s.res * k), sm = c.imageSmoothingEnabled;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (flip) c.scale(-1, 1);
    c.imageSmoothingEnabled = false;
    c.drawImage(s.c, Math.round(-w / 2), -h, w, h);
    c.imageSmoothingEnabled = sm;
    c.restore();
    return true;
  }
  const visible = (view, x0, y0, x1, y1) => x1 > view.left && x0 < view.right && y1 > view.top && y0 < view.bottom;

  // Under the picture (src/world.js ground chunks): black.
  Finale.groundColor = function (x, y) { const v = 5 + DL.fbm(x / 70, y / 70, 31) * 5; return [v, v + 1, v + 3]; };

  Finale.drawGround = function (c, view, t) {
    if (Finale.stage() >= 1 && visible(view, door().x - 90, door().y - 90, door().x + 90, door().y + 40)) drawPit(c, t);
    if (!visible(view, X0, Y0, X0 + HL.w * SC, Y0 + HL.h * SC)) return;
    loadHall();
    if (PIC.complete && PIC.naturalWidth) { // only the part on screen
      const sx0 = clamp(Math.floor((view.left - X0) / SC), 0, HL.w), sy0 = clamp(Math.floor((view.top - Y0) / SC), 0, HL.h);
      const sx1 = clamp(Math.ceil((view.right - X0) / SC) + 1, 0, HL.w), sy1 = clamp(Math.ceil((view.bottom - Y0) / SC) + 1, 0, HL.h);
      if (sx1 > sx0 && sy1 > sy0) {
        const sm = c.imageSmoothingEnabled;
        c.imageSmoothingEnabled = false;
        c.drawImage(PIC, sx0, sy0, sx1 - sx0, sy1 - sy0, X0 + sx0 * SC, Y0 + sy0 * SC, (sx1 - sx0) * SC, (sy1 - sy0) * SC);
        c.imageSmoothingEnabled = sm;
      }
    }
    // the energy in every portal's mouth: dark while it sleeps, its dungeon's colour once it burns
    for (let i = 0; i < 8; i++) drawEnergy(c, i, t);
    // the ring round the dais fills with the spark
    const b = Finale.b, ch = b && defending() ? (G.isGuest() ? net.charge : b.charge) : 0, full = Finale.won() ? 1 : ch;
    if (full > 0) {
      c.strokeStyle = `rgba(${SPARK},${0.5 + 0.4 * full})`; c.lineWidth = 5;
      c.beginPath(); c.ellipse(DAIS.x, DAIS.y + 20, 120, 52, 0, -Math.PI / 2, -Math.PI / 2 + TAU * full); c.stroke();
    }
  };
  // Robert's portal energy (assets/sprites/hall/energy.png, 2026-11-11): one picture fitted to each mouth
  // (DL.FINALE.hall.mouths), as drawn while the portal sleeps, and tinted to its dungeon's colour once it burns. A portal
  // that woke since you last stood in the hall fills with its colour over a few seconds (save.finale.seen).
  let EN = null;
  const tinted = {};
  function energyPic() {
    if (!EN) { EN = new Image(); EN.src = DL.asset("assets/sprites/hall/energy.png"); }
    return EN.complete && EN.naturalWidth ? EN : null;
  }
  function tint(col) {
    if (tinted[col]) return tinted[col];
    const im = energyPic();
    if (!im) return null;
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = im.width; cv.height = im.height;
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height), px = d.data, [cr, cg, cb] = col.split(",").map(Number);
    for (let i = 0; i < px.length; i += 4) {
      const l = Math.min(1, (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 75); // (the picture is dark: 75 is bright in it)
      const w = Math.max(0, l - 0.55) * 1.6; // the brightest wisps run to white
      px[i] = Math.min(255, cr * (0.1 + 1.25 * l) + 255 * w);
      px[i + 1] = Math.min(255, cg * (0.1 + 1.25 * l) + 255 * w);
      px[i + 2] = Math.min(255, cb * (0.1 + 1.25 * l) + 255 * w);
    }
    g.putImageData(d, 0, 0);
    return (tinted[col] = cv);
  }
  const fill = [];
  function drawEnergy(c, i, t) {
    const im = energyPic(), m = HL.mouths[i];
    if (!im || !m) return;
    const x0 = X0 + m[0] * SC, y0 = Y0 + m[1] * SC, w = (m[2] - m[0]) * SC, h = (m[3] - m[1]) * SC;
    const lit = Finale.portalLit(i), host = !G.isGuest(), seen = host ? S().seen || 0 : 0;
    if (fill[i] == null) fill[i] = lit && (!host || seen & (1 << i)) ? 1 : 0;
    if (!lit) fill[i] = 0;
    else if (fill[i] < 1) {
      fill[i] = Math.min(1, fill[i] + 1 / 180); // about 3 s
      if (Math.random() < 0.5) G.spark(x0 + Math.random() * w, y0 + h * (0.3 + Math.random() * 0.7), F.portals[i].col, 70);
      if (fill[i] >= 1 && host && inHallNow()) { S().seen = seen | (1 << i); store(); }
    }
    const k = fill[i], pulse = 0.9 + 0.1 * Math.sin(t * 2.2 + i);
    if (k < 1) { c.globalAlpha = 0.9 * (1 - k); c.drawImage(im, x0, y0, w, h); }
    const tc = k > 0 ? tint(F.portals[i].col) : null;
    if (tc) {
      c.globalAlpha = k * pulse;
      c.drawImage(tc, x0, y0, w, h);
      // a second layer, mirrored and breathing, so the mist seems to stir
      c.save(); c.globalAlpha = k * (0.12 + 0.1 * Math.sin(t * 1.3 + i * 2)); c.globalCompositeOperation = "lighter";
      c.translate(x0 + w, y0); c.scale(-1, 1); c.drawImage(tc, 0, 0, w, h); c.restore();
    }
    c.globalAlpha = 1;
  }

  // In the camp: the pit north of the Flame, a ragged hole of broken flagstones with the hall's light far down in it
  // (drawn in code if his picture hasn't loaded)
  function drawPit(c, t) {
    const o = pit(), lit = Finale.won(), b = Finale.b, col = lit ? "200,150,255" : SPARK;
    if (DL.Art.sprites.hallPit) { // Robert's picture of it (props/hallPit, 2026-11-11), and its glow stirring while he climbs down
      spr(c, "hallPit", o.x + 2, o.y + 40, 1);
      const k = b && b.descend != null ? 0.25 + 0.5 * b.descend : 0.08 + 0.06 * Math.sin(t * 1.8);
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(o.x, o.y + 6, 0, o.x, o.y + 6, PIT_RX);
      g.addColorStop(0, `rgba(${col},${k})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.ellipse(o.x, o.y + 4, PIT_RX, PIT_RY, 0, 0, TAU); c.fill();
      c.restore();
      return;
    }
    c.save();
    c.translate(o.x, o.y);
    // the broken stones round its lip
    c.fillStyle = "#2e2b29";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, w = 10 + ((i * 7) % 5) * 2;
      c.beginPath(); c.ellipse(Math.cos(a) * (PIT_RX + 5), Math.sin(a) * (PIT_RY + 4), w, w * 0.55, a, 0, TAU); c.fill();
    }
    c.fillStyle = "#151313"; c.beginPath(); c.ellipse(0, 0, PIT_RX + 4, PIT_RY + 3, 0, 0, TAU); c.fill();
    // the dark, and a glow from far below it (brighter while he climbs down)
    c.fillStyle = "#030203"; c.beginPath(); c.ellipse(0, 2, PIT_RX - 2, PIT_RY - 2, 0, 0, TAU); c.fill();
    const k = b && b.descend != null ? 0.35 + 0.5 * b.descend : 0.22 + 0.08 * Math.sin(t * 1.8);
    const g = c.createRadialGradient(0, 8, 0, 0, 8, PIT_RX * 0.8);
    g.addColorStop(0, `rgba(${col},${k})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 4, PIT_RX - 4, PIT_RY - 4, 0, 0, TAU); c.fill();
    // the inner wall falling away on the far side
    c.fillStyle = "#1d1a19"; c.beginPath(); c.ellipse(0, -PIT_RY * 0.35, PIT_RX - 3, PIT_RY * 0.55, 0, Math.PI, TAU); c.fill();
    c.restore();
  }

  // Into the y-sorted scene: the spark left on the dais, and the Bearer.
  Finale.push = function (list, c, t, view) {
    const b = Finale.b;
    if (!b && Finale.won() && visible(view, DAIS.x - 100, DAIS.y - 200, DAIS.x + 100, DAIS.y + 40))
      list.push({ y: DAIS.y, f: () => DL.Art.drawFire(c, DAIS.x, DAIS.y - 4, 1.6, t) }); // the spark he left on the dais
    if (b && visible(view, b.x - 300, b.y - 600, b.x + 300, b.y + 60)) list.push({ y: b.y, f: () => drawBearer(c, b, t) });
  };

  // A portal's name over its mouth, close by ("???" while it's dark)
  function portalName(c, i) {
    const o = portalAt(i, 0), p = G.player, lit = Finale.portalLit(i), q = F.portals[i];
    if (!p || dist(p.x, p.y, o.x, o.y + 40) > 260) return;
    const y = o.y - 80 * SC;
    c.font = "bold 15px serif"; c.textAlign = "center";
    c.fillStyle = "rgba(0,0,0,0.7)"; c.fillText(lit ? q.name : "???", o.x + 1, y + 1);
    c.fillStyle = lit ? `rgb(${q.col})` : "#a49cb0"; c.fillText(lit ? q.name : "???", o.x, y);
  }

  // Over the dark: the portals' swirl, the Bearer's spark and the ring of his charge.
  Finale.glow = function (c, t, view) {
    const b = Finale.b;
    if (visible(view, X0, Y0, X0 + HL.w * SC, Y0 + HL.h * SC)) {
      for (let i = 0; i < 8; i++) {
        if (Finale.portalLit(i) && fill[i] > 0) { const m = HL.mouths[i]; glow(c, X0 + (m[0] + m[2]) * SC / 2, Y0 + (m[1] + m[3]) * SC / 2, 80 + Math.sin(t * 2.4 + i) * 6, F.portals[i].col, 0.35 * fill[i]); }
        portalName(c, i);
      }
    }
    if (b && !b.down) {
      const s = bearerScale(b), x = b.x, y = b.y - (DL.Art.sprites.sbFront || DL.Art.sprites.fbFront ? 24 : 15) * s, r = (16 + Math.sin(t * 7) * 2) * s;
      glow(c, x, y, r, SPARK, 0.8);
      const ch = G.isGuest() ? net.charge : b.charge;
      if (defending() && ch > 0) {
        c.strokeStyle = `rgba(${SPARK},${0.4 + 0.5 * ch})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, r * 0.9 + 30 * (1 - ch), -Math.PI / 2, -Math.PI / 2 + TAU * ch); c.stroke();
      }
    }
  };

  // How big he stands: growing out of the fire when he first rises, shrinking back into Kindle at the end.
  function bearerScale(b) {
    const grow = b.grow != null ? b.grow : 1, leave = b.leave != null ? b.leave : 0;
    return (1 + 3.4 * grow) * (1 - 0.75 * Math.min(1, leave * 1.5));
  }
  // Robert's drawn Spark Bearer (props/sb*, 2026-11-10; walks 2026-11-11): standing by the Flame or the pit, pouring his spark into the dais in the
  // defense, collapsed when down. (His old Fire Bearer, props/fb*, stands in if those haven't loaded.)
  function drawnBearer(c, b, t, k) {
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle), sb = !!DL.Art.sprites.sbFront;
    let n = sb ? "sbFront" : "fbCamp", flip = false;
    if (b.down) n = sb ? "sbDown" : "fbDown";
    else if (sb && defending() && b.leave == null && Finale.inHall(b.x, b.y)) n = "sbPour";
    else if (b.moving && Math.abs(ca) > Math.abs(sa) * 1.2) { n = sb ? "sbSide" : "fbSide"; flip = ca < 0; }
    else if (b.moving && sa < 0) n = sb ? "sbBack" : "fbBack";
    else if (b.moving && !sb) n = "fbFront";
    // walking: Robert's 4-frame walks (props/sbWalkF/B/S1-4, 2026-11-11), about 7 steps a second
    if (b.moving && !b.down && n.startsWith("sb") && DL.Art.sprites.sbWalkF1) {
      const f = 1 + (Math.floor(b.animT * 20) % 4);
      n = n === "sbSide" ? "sbWalkS" + f : n === "sbBack" ? "sbWalkB" + f : "sbWalkF" + f;
    }
    spr(c, n, b.x, b.y + (n === "sbPour" ? 8 * k : 0), k, flip); // (his spark's beam reaches a little below his feet)
  }
  function drawBearer(c, b, t) {
    const s = bearerScale(b), dsc = b.descend != null ? b.descend : 0;
    c.save();
    if (dsc) { c.globalAlpha = 1 - dsc; c.translate(0, dsc * 50); } // climbing down into the pit
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath(); c.ellipse(b.x, b.y, 12 * s, 4.4 * s, 0, 0, TAU); c.fill();
    if (b.hitT > 0) c.filter = "brightness(1.8)";
    if (DL.Art.sprites.sbFront || DL.Art.sprites.fbFront) drawnBearer(c, b, t, s / 4.4);
    else DL.Render.kindleUnit(c, { x: b.x, y: b.y, angle: b.angle, moving: b.moving, animT: b.animT }, t, s, b.down);
    c.restore();
    if (b.hp < b.max && !b.down && b.max) { // his health, while he's hurt
      const w = 90, x = b.x - w / 2, y = b.y - 42 * s - 14;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = "#ffd27a"; c.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 4);
    }
  }
})(window.DL);
