/* Drowned Light — game state and simulation. */
"use strict";
(function (DL) {
  const { clamp, dist, rand, TAU, angleDiff } = DL;
  const W = DL.World;
  const CYC = DL.CYCLE;
  const SAVE_KEY = "drowned-light-save-v1";
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const emptyRes = () => ({ wood: 0, stone: 0, resin: 0, iron: 0, pearl: 0 });

  const G = (DL.Game = { state: "title", t: 0, time: 0, nightAmt: 0, night: false, ally: null, eid: 0, pid: 0, dirty: new Set() });
  // Co-op: the guest's device plays inside the host's world and never saves it.
  G.isGuest = () => !!(DL.Net && DL.Net.role === "guest");

  /* ---------------- save ---------------- */
  G.defaultSave = () => ({
    v: 1, day: 1, nights: 0, deepest: 0, muted: false,
    stash: emptyRes(),
    up: { flame: 1, forge: 0, armory: 0, workbench: 0, garden: 0, tower: 0, pylon: 0, stakes: 0 },
    kit: "lanternBlade",
    kitLevel: 1,
    difficulty: "dark",
    attackMode: "auto",
    torches: 2,
    drownedSelf: null,
    started: false,
  });
  function merge(base, s) {
    for (const k in s) {
      if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) && base[k] && typeof base[k] === "object") merge(base[k], s[k]);
      else base[k] = s[k];
    }
    return base;
  }
  G.load = function () {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1) {
        // The Lanternwright became the Workbench.
        if (s.up && s.up.lantern != null) { s.up.workbench = Math.max(s.up.workbench || 0, s.up.lantern); delete s.up.lantern; }
        // Kits used to be bought and swapped with three mastery ranks; now one kit levels 1–20.
        if (s.kits) {
          const m = (s.kits[s.kit] && s.kits[s.kit].mastery) || 0;
          s.kit = s.kit === "pyreCenser" ? "flameBastion" : s.kit;
          s.kitLevel = s.kitLevel || 1 + 3 * m;
          delete s.kits;
        }
        if (!DL.KITS[s.kit]) s.kit = "lanternBlade";
        return merge(G.defaultSave(), s);
      }
    } catch (e) { /* storage unavailable */ }
    return G.defaultSave();
  };
  G.persist = function () {
    if (G.isGuest()) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* ignore */ }
  };

  G.stats = function () {
    const u = G.save.up;
    return {
      maxHp: 100 + 25 * u.armory,
      maxOil: 60 + 25 * u.workbench,
      lanternR: (70 + 14 * u.workbench) * DL.Kits.lanternMult() * G.diff().light,
      dmgMult: 1 + 0.2 * u.forge,
      flameR: (180 + 40 * u.flame) * G.diff().light,
      flameHp: 150 + 100 * u.flame,
      torchMax: 3 + u.workbench,
      torchDur: 50 + 15 * u.workbench,
    };
  };
  G.kit = () => DL.KITS[G.save.kit] || DL.KITS.lanternBlade;
  G.diff = () => DL.DIFFICULTIES[G.save.difficulty] || DL.DIFFICULTIES.dark;
  G.siegeRadius = () => G.stats().flameR + 90;
  G.stage = (c) => (c < 25 ? 1 : c < 50 ? 2 : c < 75 ? 3 : 4);

  /* ---------------- cycle ---------------- */
  G.phase = function () {
    const t = G.time;
    if (t < CYC.day) return "day";
    if (t < CYC.day + CYC.dusk) return "dusk";
    if (t < CYC.day + CYC.dusk + CYC.night) return "night";
    return "dawn";
  };
  function nightAmount(t) {
    const a = CYC.day, b = a + CYC.dusk, c = b + CYC.night;
    if (t < a) return 0;
    if (t < b) return (t - a) / CYC.dusk;
    if (t < c) return 1;
    return 1 - (t - c) / CYC.dawn;
  }
  G.timeToNight = () => Math.max(0, CYC.day + CYC.dusk * 0.5 - G.time);
  G.timeToDawn = () => Math.max(0, CYC.day + CYC.dusk + CYC.night + CYC.dawn * 0.5 - G.time);

  /* ---------------- lifecycle ---------------- */
  G.init = function () {
    G.save = G.load();
    DL.Sound.muted = G.save.muted;
    G.startLife();
    G.state = "title";
    G.time = CYC.day + CYC.dusk + 20; // the title screen shows the camp at night
  };

  G.begin = function () {
    DL.Sound.init();
    if (!G.save.started) {
      G.save.started = true;
      G.persist();
      setTimeout(() => say("Gather supplies by day. Return to the fire before nightfall."), 600);
      setTimeout(() => say("Deeper lands hold richer supplies — and deadlier Drowned."), 5200);
    }
    G.startLife();
  };

  G.newGame = function (kit, difficulty, attackMode) {
    const muted = G.save.muted;
    G.save = G.defaultSave();
    G.save.muted = muted;
    G.save.kit = kit;
    G.save.difficulty = difficulty;
    G.save.attackMode = attackMode === "manual" ? "manual" : "auto";
    W.chunks.clear(); // the land is regenerated for the new difficulty
    G.persist();
    G.begin();
  };

  G.startLife = function () {
    const st = G.stats();
    G.player = {
      x: 0, y: 70, kx: 0, ky: 0, hp: st.maxHp, corrupt: 0, oil: st.maxOil,
      angle: Math.PI / 2, moving: false, animT: 0,
      dashT: 0, dashCd: 0, dashDir: { x: 0, y: 1 }, dashHit: new Set(), trail: [],
      inv: 0, atkCd: 0, swing: null, abiCd: 0, flash: 0, hurtFlash: 0,
      carried: emptyRes(), protect: null, stage: 1, zi: 0, aim: Math.PI / 2,
    };
    G.time = 4;
    G.enemies = []; G.projectiles = []; G.pickups = []; G.effects = []; G.texts = [];
    G.torches = []; G.lightZones = []; G.telegraphs = []; G.pearls = []; G.decals = []; G.lights = [];
    G.blooms = []; G.walls = []; G.wisp = null; G.hitNodes = [];
    G.flame = { kind: "flame", x: 0, y: 0, rad: 24, hp: st.flameHp, max: st.flameHp, lit: true, hitT: 0 };
    G.towerCd = [0, 0, 0];
    G.resetPylons();
    G.siegeT = 5; G.spawnT = 3; G.pearlT = 2; G.rootEvent = null; G.selfEnemy = null; G.champSpawned = false;
    G.dying = 0;
    G.camera = { x: 0, y: 70, shake: 0 };
    G.nightAmt = 0; G.night = false;
    W.resetDay();
    G.state = "play";
  };

  // Pylon state (lit, health) for the current layout.
  G.resetPylons = function () {
    G.pylons = DL.Camp.layout(G.save.up).pylons.map((q) => ({ kind: "pylon", x: q.x, y: q.y, rad: 8, hp: 80, max: 80, lit: true, hitT: 0 }));
  };

  G.respawn = function () {
    G.save.day += 1;
    G.persist();
    G.startLife();
    say(`Day ${G.save.day}. You wake beside the Central Flame.`);
  };

  /* ---------------- main update ---------------- */
  G.update = function (dt) {
    G.t += dt;
    if (G.state === "title") {
      G.nightAmt = 1; G.night = true;
      buildLights();
      updateEffects(dt);
      return;
    }
    if (G.state === "dying") {
      G.dying += dt;
      updateEffects(dt);
      if (G.dying > 2.6) { G.state = "dead"; DL.UI.showDeath(G.deathInfo); }
      return;
    }
    if (G.state !== "play") return;
    if (G.isGuest()) { guestUpdate(dt); return; }

    const wasNight = G.night;
    G.time += dt;
    if (G.time >= CYC.total) { G.time -= CYC.total; onNewDay(); }
    G.nightAmt = nightAmount(G.time);
    G.night = G.nightAmt >= 0.5;
    if (G.night && !wasNight) onNightfall();
    if (!G.night && wasNight) onDawn();

    collectBlooms();
    buildLights();
    updatePlayer(dt);
    if (G.state !== "play") return;
    updateCorruption(dt);
    if (G.state !== "play") return;
    updateSpawning(dt);
    updateEnemies(dt);
    updateDefenses(dt);
    DL.Kits.update(dt);
    updateProjectiles(dt);
    updateTelegraphs(dt);
    updatePickups(dt);
    updateLightsources(dt);
    updateEffects(dt);
    updateCamera(dt);
  };

  // The guest runs only its own knight; the host's snapshots move the world (src/net.js).
  function guestUpdate(dt) {
    const wasNight = G.night;
    G.time = (G.time + dt) % CYC.total;
    G.nightAmt = nightAmount(G.time);
    G.night = G.nightAmt >= 0.5;
    if (G.night && !wasNight) { sfx("night"); say("Night falls. Stay in the light — or the darkness will take you.", "warn"); }
    if (!G.night && wasNight) { sfx("dawn"); say("Dawn breaks. The Drowned retreat from the sun.", "good"); }
    collectBlooms();
    buildLights();
    const p = G.player;
    if (p.downT > 0) {
      p.downT -= dt;
      if (p.downT <= 0) guestRise();
    } else {
      updatePlayer(dt);
      if (G.state === "play") updateCorruption(dt);
    }
    DL.Net.smooth(dt);
    DL.Kits.update(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateCamera(dt);
  }

  // A guest who falls isn't drowned: they rise again at the camp after a few seconds.
  function guestDown() {
    const p = G.player;
    p.downT = 5;
    p.hp = 0;
    p.carried = emptyRes();
    sfx("death");
    for (let i = 0; i < 30; i++) puff(p.x + rand(-12, 12), p.y - rand(0, 60), "rgba(60,220,230,0.7)", 50, 1.4, -30);
    say("You have fallen. You'll rise at the camp in a moment — whatever you carried is lost.", "danger");
  }
  function guestRise() {
    const p = G.player, st = G.stats();
    Object.assign(p, { x: 20, y: 70, hp: st.maxHp, corrupt: 0, oil: st.maxOil, downT: 0, inv: 1.5 });
    G.camera.x = p.x; G.camera.y = p.y;
    say("You rise beside the Central Flame.", "good");
  }

  function onNightfall() {
    sfx("night");
    say("Night falls. Stay in the light — or the darkness will take you.", "warn");
    G.champSpawned = false;
    G.siegeT = 4;
    if (G.save.nights === 0) setTimeout(() => say("Cyan Refuge Blooms halt corruption. Firelight reverses it."), 3500);
  }

  function onDawn() {
    sfx("dawn");
    G.save.nights += 1;
    say("Dawn breaks. The Drowned retreat from the sun.", "good");
    if (G.rootEvent) {
      const o = G.rootEvent.obj;
      if (!o.dead) {
        const z = DL.ZONES[o.zi];
        dropRes(o.x, o.y, "resin", Math.round(10 * z.yield));
        dropRes(o.x, o.y, "pearl", 2 + o.zi);
        dropRes(o.x, o.y, "iron", Math.round(4 * z.yield));
        say("The Mother Root endured. It offers you its gifts.", "good");
      }
      G.rootEvent = null;
    }
    G.flame.lit = true;
    G.flame.hp = G.flame.max;
    for (const q of G.pylons) { q.lit = true; q.hp = q.max; }
    const gy = DL.GARDEN_YIELD[G.save.up.garden];
    if (gy) {
      G.save.stash.resin += gy;
      setTimeout(() => say(`The Cultivation Plot yielded ${gy} Bloom Resin.`, "good"), 1600);
    }
    G.persist();
  }

  function onNewDay() {
    G.save.day += 1;
    W.resetDay();
    G.pearls = G.pearls.filter((p) => DL.ZONES[W.zoneIndex(p.x, p.y)].abyss);
    G.persist();
    say(`Day ${G.save.day}. The wetland stirs — supplies have regrown.`);
  }

  /* ---------------- light ---------------- */
  function collectBlooms() {
    const p = G.player, out = [];
    W.near(p.x, p.y, 1000, (o) => {
      if (o.def.bloom || o.type === "sprout") {
        o.active = !o.dead && (G.nightAmt > 0.3 || DL.ZONES[o.zi].abyss);
        out.push(o);
      }
    });
    G.blooms = out;
  }

  function buildLights() {
    const L = [], st = G.stats(), p = G.player;
    if (G.flame.lit) L.push({ x: 0, y: -8, r: st.flameR, s: 1, col: "255,150,60", a: 1, flick: 1, kind: "human" });
    else L.push({ x: 0, y: -8, r: 50, s: 0.5, col: "255,80,30", a: 0.4, flick: 1 });
    const lay = DL.Camp.layout(G.save.up);
    for (const q of G.pylons) {
      if (q.lit) L.push({ x: q.x, y: q.y - 40, r: 118 * G.diff().light, s: 1, col: "255,170,80", a: 0.85, flick: 1, kind: "human" });
    }
    if (lay.forge) L.push({ x: lay.forge.x - 4, y: lay.forge.y - 14, r: 60, s: 0.6, col: "255,120,40", a: 0.7, flick: 1 });
    if (lay.workbench) L.push({ x: lay.workbench.x + 8, y: lay.workbench.y - 26, r: 45, s: 0.5, col: "255,190,100", a: 0.5, flick: 1 });
    if (lay.garden && G.nightAmt > 0.3) L.push({ x: lay.garden.x, y: lay.garden.y - 12, r: 60 + 12 * G.save.up.garden, s: 0.6, col: "80,230,240", a: 0.8 });
    if (G.save.up.stakes >= 3) {
      for (const g of DL.Camp.GATES) for (const sgn of [-1, 1]) {
        const a = g + (sgn * (DL.Camp.GATE_HALF + 6)) / DL.WALL_R;
        L.push({ x: Math.cos(a) * DL.WALL_R, y: Math.sin(a) * DL.WALL_R - 40, r: 50, s: 0.5, col: "255,180,90", a: 0.6, flick: 1 });
      }
    }
    for (const t of G.torches) {
      const f = t.t < 8 ? t.t / 8 : 1;
      L.push({ x: t.x, y: t.y - 18, r: t.r * (0.45 + 0.55 * f), s: 1, col: t.type === "brazier" ? "255,110,40" : "255,165,80", a: f, flick: 1, kind: "human" });
    }
    for (const z of G.lightZones) {
      const f = Math.min(1, z.t / 1.2);
      L.push({ x: z.x, y: z.y, r: z.r * (0.6 + 0.4 * f), s: f, col: "255,215,140", a: f, kind: "human" });
    }
    for (const o of G.blooms) {
      if (!o.active) continue;
      if (o.type === "sprout") { if (!o.harvested) L.push({ x: o.x + 6, y: o.y - 30, r: 46, s: 0.45, col: "80,230,240", a: 0.6 }); continue; }
      L.push({ x: o.x, y: o.y - 24, r: o.def.light * G.diff().light, s: 0.92, col: "80,230,240", a: 0.95, kind: "bloom", obj: o });
    }
    for (const pr of G.pearls) L.push({ x: pr.x, y: pr.y - 4, r: 34, s: 0.45, col: "190,160,255", a: 0.9 });
    if (p && G.state !== "title") {
      const lr = st.lanternR * (p.oil > 0 ? 1 : 0.4);
      L.push({ x: p.x, y: p.y - 28, r: lr, s: 0.8, col: "255,180,90", a: p.oil > 0 ? 0.75 : 0.3, flick: 1, lantern: true });
    } else if (p) {
      L.push({ x: p.x, y: p.y - 28, r: 80, s: 0.8, col: "255,180,90", a: 0.75, flick: 1 });
    }
    if (G.ally && !G.ally.down) L.push({ x: G.ally.x, y: G.ally.y - 28, r: 80, s: 0.8, col: "255,180,90", a: 0.7, flick: 1 });
    for (const e of G.enemies) {
      if (e.type === "defiler") L.push({ x: e.x, y: e.y - 70, r: 70, s: 0.4, col: "70,230,240", a: 0.8 });
      else if (e.def.boss) L.push({ x: e.x, y: e.y - 40, r: 60, s: 0.3, col: "70,230,240", a: 0.6 });
    }
    for (const pr of G.projectiles) L.push({ x: pr.x, y: pr.y, r: pr.kind === "orb" ? 44 : 26, s: 0.3, col: pr.col, a: 0.8 });
    if (G.walls) DL.Kits.lights(L);
    G.lights = L;
  }

  // "human" (firelight: reverses corruption), "bloom" (halts it), or null.
  G.protectionAt = function (x, y) {
    let best = null;
    for (const l of G.lights) {
      if (!l.kind) continue;
      if (dist(x, y, l.x, l.y) < l.r * 0.82) {
        if (l.kind === "human") return "human";
        best = "bloom";
      }
    }
    return best;
  };
  G.bloomShelter = function (x, y) {
    for (const l of G.lights) if (l.kind === "bloom" && dist(x, y, l.x, l.y) < l.r * 0.82) return l.obj;
    return null;
  };
  function humanLightAt(x, y) {
    for (const l of G.lights) if (l.kind === "human" && dist(x, y, l.x, l.y) < l.r * 0.82) return true;
    return false;
  }

  /* ---------------- player ---------------- */
  function updatePlayer(dt) {
    const p = G.player, st = G.stats(), inp = DL.Input.axis();
    p.inv = Math.max(0, p.inv - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.abiCd = Math.max(0, p.abiCd - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.animT += dt;
    p.zi = W.zoneIndex(p.x, p.y);
    if (p.zi > G.save.deepest) {
      G.save.deepest = p.zi;
      say(`You enter ${DL.ZONES[p.zi].name}. Richer supplies — and deadlier Drowned.`, "warn");
    }

    if (DL.Input.take("dash")) tryDash(inp);
    if (DL.Input.take("ability")) useAbility();
    if (DL.Input.take("torch")) placeTorch();

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashDir.x * 440 * dt;
      p.y += p.dashDir.y * 440 * dt;
      p.trail.push({ x: p.x, y: p.y, life: 0.25, ang: p.angle });
      DL.Kits.dashTick(p, st, dt);
    } else {
      const wet = W.isWater(p.x, p.y) ? 0.82 : 1;
      const spd = 150 * wet * (p.corrupt >= 75 ? 0.9 : 1);
      p.moving = inp.m > 0.15;
      p.stillT = p.moving ? 0 : (p.stillT || 0) + dt;
      if (p.moving) {
        p.x += inp.x * spd * dt;
        p.y += inp.y * spd * dt;
        p.angle = Math.atan2(inp.y, inp.x);
      }
    }
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter((t) => t.life > 0);

    p.x += p.kx * dt; p.y += p.ky * dt;
    const decay = Math.pow(0.002, dt);
    p.kx *= decay; p.ky *= decay;
    W.collide(p, 10);
    collideCamp(p, 10);

    // Combat and mining. Auto mode fights the nearest Drowned, or mines a supply node you stand by
    // when none are near. Manual mode keeps them apart: Attack strikes where you aim (mouse, or the
    // way you face) and never mines; Mine works the nearest supply node in reach.
    p.atkCd -= dt;
    if (p.swing) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing = null; }
    p.aim = aimAngle(p);
    G.mineTarget = G.save.attackMode === "manual" ? nodeNear(p, 34) : null;
    if (p.atkCd <= 0 && p.dashT <= 0) {
      if (G.save.attackMode === "manual") {
        if (DL.Input.attacking()) DL.Kits.attack(p, st, p.aim);
        else if (DL.Input.mining() && G.mineTarget) mineStrike(p, G.mineTarget);
      } else if (!DL.Kits.attack(p, st)) {
        const node = nodeNear(p, 26);
        if (node) mineStrike(p, node);
      }
    }
    for (const o of G.hitNodes) o.hitT = Math.max(0, o.hitT - dt);
    G.hitNodes = G.hitNodes.filter((o) => o.hitT > 0);

    // Deposit carried supplies at camp.
    const inCamp = Math.hypot(p.x, p.y) < DL.CAMP_RADIUS;
    G.inCamp = inCamp;
    if (inCamp && DL.RES_KEYS.some((k) => p.carried[k] > 0)) {
      const parts = [];
      if (G.isGuest()) DL.Net.event({ t: "deposit", res: { ...p.carried } });
      for (const k of DL.RES_KEYS) if (p.carried[k]) { parts.push(`${p.carried[k]} ${DL.RESOURCES[k].name}`); if (!G.isGuest()) G.save.stash[k] += p.carried[k]; p.carried[k] = 0; }
      G.persist();
      sfx("pickup");
      say((G.isGuest() ? "Stored at your friend's camp: " : "Stored at camp: ") + parts.join(", "), "good");
    }

    // Your drowned self waits where you fell.
    const ds = G.isGuest() ? null : G.save.drownedSelf;
    if (ds && !G.selfEnemy && dist(p.x, p.y, ds.x, ds.y) < 900) {
      const e = makeEnemy("self", ds.x, ds.y, Math.max(1, W.zoneIndex(ds.x, ds.y)), { isSelf: true, dormant: true });
      G.enemies.push(e);
      G.selfEnemy = e;
    } else if (G.selfEnemy && dist(p.x, p.y, G.selfEnemy.x, G.selfEnemy.y) > 1500) {
      G.enemies = G.enemies.filter((e) => e !== G.selfEnemy);
      G.selfEnemy = null;
    }
  }

  G.corruptBonus = corruptBonus;
  function corruptBonus() {
    const s = G.player.stage;
    return s === 3 ? 1.15 : s === 4 ? 1.3 : 1;
  }

  function tryDash(inp) {
    const p = G.player;
    if (p.dashCd > 0 || p.dashT > 0) return;
    const a = inp.m > 0.15 ? Math.atan2(inp.y, inp.x) : p.angle;
    p.angle = a;
    p.dashDir = { x: Math.cos(a), y: Math.sin(a) };
    p.dashT = 0.22;
    p.dashCd = 2.2;
    p.inv = Math.max(p.inv, 0.3);
    p.dashHit.clear();
    DL.Kits.dashStart(p);
    sfx("dash");
    for (let i = 0; i < 8; i++) puff(p.x, p.y, "rgba(150,140,120,0.5)", 40, 0.4);
  }

  function useAbility() {
    const p = G.player, ab = G.kit().ability;
    if (p.abiCd > 0) { sfx("deny"); return; }
    if (p.oil < ab.oil) { say("Not enough lantern oil. Refill it in firelight.", "warn"); sfx("deny"); return; }
    p.oil -= ab.oil;
    p.abiCd = DL.Kits.abilityCd();
    sfx("ability");
    DL.Kits.ability(p, G.stats());
  }

  function placeTorch() {
    const p = G.player;
    if (G.save.torches <= 0) { say("No torches left — craft more at camp.", "warn"); sfx("deny"); return; }
    G.save.torches -= 1;
    G.persist();
    const dur = G.stats().torchDur;
    G.torches.push({ type: "torch", x: p.x + 14, y: p.y + 4, t: dur, max: dur, r: 125 * G.diff().light, hp: 40, rad: 8 });
    sfx("torch");
    say("Torch placed. It will burn for a short while.");
  }

  // Manual aim: toward the mouse when one is in use, otherwise the way the knight faces.
  function aimAngle(p) {
    const m = DL.Input.mouse, v = DL.Render.view;
    if (DL.Input.attackAim != null) return DL.Input.attackAim; // dragging the Attack button
    if (G.save.attackMode === "manual" && v && performance.now() - m.seen < 4000 && !DL.Input.touch) {
      return Math.atan2(v.top + m.y / v.z - (p.y - 24), v.left + m.x / v.z - p.x);
    }
    return p.angle;
  }

  /* ---------------- mining ---------------- */
  function nodeNear(p, R) {
    let best = null, bd = 1e9;
    const check = (o) => {
      if (!o.def.hits || o.harvested) return;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < (o.def.r || 12) + R && d < bd) { bd = d; best = o; }
    };
    W.near(p.x, p.y, 70, check);
    for (const pr of G.pearls) check(pr);
    return best;
  }

  function mineStrike(p, o) {
    const kit = G.kit(), ang = Math.atan2(o.y - 6 - p.y, o.x - p.x);
    p.attackN = (p.attackN || 0) + 1;
    p.swing = { ang, t: 0, dur: 0.2, col: "255,236,200", kind: kit.attack.type === "thrust" ? "thrust" : "arc", range: 44, arc: 1.3, flip: p.attackN % 2 === 1 };
    p.atkCd = 0.5;
    if (!p.moving) p.angle = ang;
    o.mineHp = (o.mineHp == null ? o.def.hits : o.mineHp) - 1;
    o.hitT = 0.18;
    if (!G.hitNodes.includes(o)) G.hitNodes.push(o);
    const col = DL.RESOURCES[o.def.res].color, ix = o.x - Math.cos(ang) * 6, iy = o.y - 12;
    for (let i = 0; i < 6; i++) puff(ix, iy, col, 90, 0.45, -60);
    if (o.type === "sprout" || o.type === "pearl") { for (let i = 0; i < 5; i++) spark(ix, iy, o.type === "pearl" ? "190,160,255" : "80,230,240", 90); sfx("chime"); }
    else sfx(o.type === "wood" ? "chop" : "clink");
    if (o.mineHp <= 0) shatter(o);
  }

  const NODE_SPRITE = { wood: "driftwood", stone: "rock", iron: "ironpile", pearl: "pearl" };
  function shatter(o) {
    o.harvested = true;
    const name = NODE_SPRITE[o.type] || (o.active ? "sproutOn" : "sproutOff");
    const s = DL.Art.sprites[name], PS = 2, w = s.w * PS, h = s.h * PS, pieces = [];
    const cols = 3, rows = 2, pw = Math.ceil(s.w / cols), ph = Math.ceil(s.h / rows);
    for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
      const sx = gx * pw, sy = gy * ph, cx = o.x - w / 2 + (sx + pw / 2) * PS, cy = o.y + 2 - h + (sy + ph / 2) * PS;
      pieces.push({ sx, sy, sw: Math.min(pw, s.w - sx), sh: Math.min(ph, s.h - sy), x: cx, y: cy, vx: (cx - o.x) * 3 + rand(-30, 30), vy: -rand(70, 150), vr: rand(-7, 7) });
    }
    G.effects.push({ type: "shatter", sprite: name, pieces, t: 0, max: 0.75 });
    for (let i = 0; i < 10; i++) puff(o.x, o.y - 4, "rgba(120,110,95,0.55)", 70, 0.7);
    sfx("shatter");
    G.camera.shake = Math.max(G.camera.shake, 2);
    if (G.isGuest()) {
      const p = G.player;
      p.carried[o.def.res] += o.amount;
      text(p.x, p.y - 70, `+${o.amount} ${DL.RESOURCES[o.def.res].name}`, DL.RESOURCES[o.def.res].color);
      DL.Net.event({ t: "mined", id: o.id });
    } else {
      dropRes(o.x, o.y - 6, o.def.res, o.amount);
      G.dirty.add(o);
    }
    if (o.type === "pearl") G.pearls = G.pearls.filter((x) => x !== o);
  }
  G.shatter = shatter;

  // Camp tents and buildings are solid, and the palisade only opens at its gates.
  G.campSolids = () => DL.Camp.layout(G.save.up).solids;
  function collideCamp(ent, r) {
    if (Math.hypot(ent.x, ent.y) > 280) return;
    DL.Camp.collideWall(ent, r, G.save.up);
    for (const s of G.campSolids()) {
      const dx = ent.x - s.x, dy = ent.y - s.y, d = Math.hypot(dx, dy), m = s.r + r;
      if (d < m && d > 0.01) { ent.x = s.x + (dx / d) * m; ent.y = s.y + (dy / d) * m; }
    }
  }

  /* ---------------- corruption ---------------- */
  function updateCorruption(dt) {
    const p = G.player, st = G.stats(), Z = DL.ZONES[p.zi];
    const prot = G.protectionAt(p.x, p.y);
    p.protect = prot;
    const D = G.diff();
    const darkness = G.night ? 1 : Z.abyss ? 0.45 : D.dayCorrupt && p.zi >= 2 ? 0.35 : 0;
    p.exposed = false;
    if (prot === "human") {
      p.corrupt -= 10 * dt;
      p.oil = Math.min(st.maxOil, p.oil + 14 * dt);
      p.hp = Math.min(st.maxHp, p.hp + 3 * dt);
    } else if (prot === "bloom") {
      p.hp = Math.min(st.maxHp, p.hp + 0.6 * dt);
    } else if (darkness > 0) {
      let rate = 2.3 * Z.corrupt * darkness * D.corrupt;
      if (p.oil > 0) { rate *= 0.5; p.oil = Math.max(0, p.oil - 1.1 * DL.Kits.oilDrain() * dt); }
      p.corrupt += rate * dt;
      p.exposed = true;
    } else {
      p.corrupt -= 0.7 * dt;
    }
    p.corrupt = clamp(p.corrupt, 0, 100);
    const stage = G.stage(p.corrupt);
    if (stage > p.stage) {
      sfx("whisper");
      say(["", "", "The darkness seeps into your armour…", "You are near drowning. Find light!", "The deep is calling you home. FIND LIGHT NOW."][stage], "danger");
    }
    p.stage = stage;
    if (p.corrupt >= 100) die("corruption");
  }

  /* ---------------- spawning ---------------- */
  function updateSpawning(dt) {
    const a = G.ally;
    const p = a && !a.down && dist(a.x, a.y, G.player.x, G.player.y) > 500 && Math.random() < 0.5
      ? { x: a.x, y: a.y, zi: W.zoneIndex(a.x, a.y) } : G.player;
    const Z = DL.ZONES[Math.max(1, p.zi)], dCamp = Math.hypot(p.x, p.y);
    const active = G.night || (Z.abyss && G.nightAmt < 0.5);

    // Abyssal pearls surface only in darkness.
    G.pearlT -= dt;
    if (G.pearlT <= 0) {
      G.pearlT = 2.5;
      if ((G.night || Z.abyss) && p.zi >= 2 && G.pearls.length < 5) {
        const a = rand(0, TAU), r = rand(280, 600), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!G.protectionAt(x, y) && W.zoneIndex(x, y) >= 2) {
          const zi = W.zoneIndex(x, y);
          G.pearls.push({ id: "pearl" + G.t, type: "pearl", def: DL.OBJ.pearl, x, y, zi, amount: Math.max(1, Math.round(DL.ZONES[zi].yield * 0.6 * G.diff().yield)), harvested: false });
        }
      }
    }
    if (!G.night && !Z.abyss) { G.pearls.length = 0; }
    if (!active) return;

    const cap = G.night ? 55 : 14;
    if (G.enemies.length >= cap) return;

    // Siege: the Drowned come for the Central Flame.
    if (G.night && dCamp < G.siegeRadius()) {
      G.siegeT -= dt;
      if (G.siegeT <= 0) {
        G.siegeT = 11;
        const n = Math.round((3 + Math.floor(G.save.day * 1.3)) * G.diff().spawn);
        spawnWave(0, 0, DL.campPool(G.save.day), n, G.flame, 540, 1);
        if (G.save.day >= 5 && !G.champSpawned && G.phase() === "night") {
          G.champSpawned = true;
          const a = rand(0, TAU);
          G.enemies.push(makeEnemy("champion", Math.cos(a) * 560, Math.sin(a) * 560, 2, { goal: G.flame }));
          say("A Drowned Champion marches on your camp!", "danger");
        }
      }
      return;
    }

    // Mother Root: defend it until dawn for its gifts.
    if (G.night && !G.rootEvent) {
      const root = G.blooms.find((o) => o.type === "root" && !o.dead && dist(p.x, p.y, o.x, o.y) < 260);
      if (root) {
        G.rootEvent = { obj: root, waveT: 3 };
        say("The Mother Root stirs. Defend it until dawn.", "warn");
      }
    }
    if (G.rootEvent && !G.rootEvent.obj.dead && dist(p.x, p.y, G.rootEvent.obj.x, G.rootEvent.obj.y) < 650) {
      const ev = G.rootEvent;
      ev.waveT -= dt;
      if (ev.waveT <= 0) {
        ev.waveT = 12;
        spawnWave(ev.obj.x, ev.obj.y, DL.ZONES[ev.obj.zi].pool, 4 + ev.obj.zi + Math.floor(G.save.day * 0.5), ev.obj, 520, ev.obj.zi);
      }
      return;
    }

    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    G.spawnT = Math.max(0.8, (G.night ? 3.2 : 6.5) - p.zi * 0.35 - G.save.day * 0.06) / G.diff().spawn;
    const shelter = G.bloomShelter(p.x, p.y);
    const type = DL.weighted(Z.pool);
    const count = type === "revenant" ? 4 + ((Math.random() * 3) | 0) : type === "squire" ? 2 + ((Math.random() * 2) | 0) : 1;
    let x, y;
    for (let tries = 0; tries < 6; tries++) {
      const a = rand(0, TAU), r = type === "revenant" ? rand(200, 320) : rand(460, 620);
      x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r;
      if (!humanLightAt(x, y)) break;
    }
    for (let i = 0; i < count; i++) {
      const e = makeEnemy(type, x + rand(-30, 30), y + rand(-30, 30), Math.max(1, p.zi));
      if (shelter && Math.random() < 0.5) e.goal = shelter; // they come for your bloom
      G.enemies.push(e);
    }
  }

  function spawnWave(cx, cy, pool, n, goal, R, zi) {
    const base = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = base + rand(-0.9, 0.9), r = R + rand(0, 80);
      const type = DL.weighted(pool);
      const e = makeEnemy(type, cx + Math.cos(a) * r, cy + Math.sin(a) * r, zi, { goal });
      G.enemies.push(e);
    }
  }

  function makeEnemy(type, x, y, zi, extra) {
    const def = DL.ENEMIES[type], Z = DL.ZONES[Math.max(1, zi)], day = G.save.day;
    const D = G.diff();
    const hp = def.hp * Z.hp * (1 + 0.08 * (day - 1)) * D.enemyHp;
    return Object.assign({
      id: ++G.eid, type, def, x, y, kx: 0, ky: 0, hp, maxHp: hp,
      dmg: def.dmg * Z.dmg * (1 + 0.05 * (day - 1)) * D.enemyDmg,
      speed: def.speed * rand(0.9, 1.1), angle: Math.PI / 2, moving: false, animT: rand(0, 1),
      state: "move", stT: 0, cd: rand(0.3, 1), flash: 0, burn: 0, burnDps: 0, slow: 0,
      rise: def.crawl ? 0.9 : 0, goal: null, staked: false, summonT: 6, spikeT: 4, zi,
    }, extra || {});
  }
  G.makeEnemy = makeEnemy;

  /* ---------------- enemies ---------------- */
  function goalValid(g) {
    if (!g) return false;
    if (g.kind === "flame" || g.kind === "pylon") return g.lit;
    if (g.type === "torch" || g.type === "brazier") return G.torches.includes(g);
    return !g.dead && g.active !== false;
  }
  function nearestLightTarget(x, y, R) {
    let best = null, bd = R;
    const consider = (o) => { const d = dist(x, y, o.x, o.y); if (d < bd) { bd = d; best = o; } };
    if (G.flame.lit) consider(G.flame);
    for (const q of G.pylons) if (q.lit) consider(q);
    for (const t of G.torches) consider(t);
    for (const o of G.blooms) if (o.def.bloom && o.active) consider(o);
    return best;
  }

  // Each Drowned hunts whichever knight is nearer (host or co-op friend).
  function targetFor(e) {
    const p = G.player, a = G.ally;
    if (!a || a.down) return p;
    return dist(e.x, e.y, a.x, a.y) < dist(e.x, e.y, p.x, p.y) ? a : p;
  }
  function hurtKnight(k, dmg, ang) {
    if (k === G.ally) DL.Net.hurtAlly(dmg, ang);
    else hurtPlayer(dmg, ang);
  }

  function updateEnemies(dt) {
    for (const e of G.enemies) {
      const p = targetFor(e);
      e.flash = Math.max(0, e.flash - dt);
      e.animT += dt;
      if (e.rise > 0) {
        e.rise -= dt;
        if (Math.random() < 0.4) puff(e.x + rand(-8, 8), e.y, "rgba(60,200,210,0.6)", 30, 0.5);
        continue;
      }
      const eZ = DL.ZONES[W.zoneIndex(e.x, e.y)];
      if (!G.night && !eZ.abyss && !e.isSelf) {
        e.hp -= 30 * dt; // the sun unmakes them
        if (Math.random() < 0.3) puff(e.x + rand(-8, 8), e.y - rand(10, 40), "rgba(40,60,70,0.6)", 30, 0.8);
        if (e.hp <= 0) { kill(e, false); continue; }
      }
      if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < 0.3) spark(e.x + rand(-6, 6), e.y - rand(10, 40), "255,130,50", 40);
        if (e.hp <= 0) { kill(e, true); continue; }
      }
      const dp = dist(e.x, e.y, p.x, p.y);
      if (e.dormant) {
        if (dp < 170 || e.hp < e.maxHp) { e.dormant = false; if (e.isSelf) say("Your drowned self rises to meet you.", "danger"); }
        else continue;
      }

      // Choose what to chase.
      let goal = null;
      if (e.def.targetsLight) {
        if (!goalValid(e.goal)) e.goal = nearestLightTarget(e.x, e.y, 700);
        goal = dp < 60 ? null : e.goal;
      } else if (goalValid(e.goal)) {
        goal = dp < 150 ? null : e.goal;
      } else e.goal = null;
      if (goal && !goalValid(goal)) goal = null;
      const tx = goal ? goal.x : p.x, ty = goal ? goal.y : p.y;
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      const reach = e.def.range + (goal ? goal.rad || 12 : 10);

      e.cd -= dt;
      e.slow = Math.max(0, e.slow - dt);
      if (e.stun > 0) {
        e.stun -= dt; // staggered: no moving, no attacking
        e.state = "move";
        e.moving = false;
      } else if (e.state === "windup") {
        e.stT -= dt;
        if (e.stT <= 0) { strike(e); e.state = "recover"; e.stT = 0.35; e.cd = e.def.cd; }
      } else if (e.state === "recover") {
        e.stT -= dt;
        if (e.stT <= 0) e.state = "move";
      } else {
        let want = 1;
        if (e.def.ranged && !goal) { if (d < e.def.keep - 30) want = -1; else if (d < e.def.range) want = 0; }
        else if (d < reach * 0.8) want = 0;
        const spd = e.speed * (humanLightAt(e.x, e.y) ? 0.72 : 1) * (e.slow > 0 ? 0.6 : 1);
        // Walls in the way: head for the nearest gate first.
        const wp = want === 1 ? DL.Camp.route(e.x, e.y, tx, ty, G.save.up) : null;
        const mx = wp ? wp.x - e.x : dx, my = wp ? wp.y - e.y : dy, md = Math.hypot(mx, my) || 1;
        e.x += (mx / md) * spd * want * dt;
        e.y += (my / md) * spd * want * dt;
        e.angle = Math.atan2(my, mx);
        e.moving = want !== 0;
        if (d <= reach && e.cd <= 0) {
          e.state = "windup";
          e.stT = e.def.windup;
          e.aim = e.angle;
          e.aimGoal = goal;
          e.tgt = p;
          e.moving = false;
        }
        if (e.type === "champion") champion(e, dt, dp);
      }

      e.x += e.kx * dt; e.y += e.ky * dt;
      const decay = Math.pow(0.004, dt);
      e.kx *= decay; e.ky *= decay;

      // Barricade: stakes wound attackers as they cross the perimeter (at the gates once walls stand).
      const lv = G.save.up.stakes;
      if (lv > 0) {
        const dc = Math.hypot(e.x, e.y);
        if (dc < DL.WALL_R + 4) {
          e.slow = Math.max(e.slow, lv >= 3 ? 0.4 : 0.2);
          if (!e.staked && dc > DL.WALL_R - 40) { e.staked = true; hitEnemy(e, [0, 15, 25, 40][lv], Math.atan2(e.y, e.x), 160); if (e.hp <= 0) continue; }
        }
      }
    }

    // Separation, and keep them out of the knight.
    const es = G.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.rise > 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.rise > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.def.radius + b.def.radius;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d), ma = a.def.mass, mb = b.def.mass, tot = ma + mb;
          a.x -= (dx / d) * push * (mb / tot); a.y -= (dy / d) * push * (mb / tot);
          b.x += (dx / d) * push * (ma / tot); b.y += (dy / d) * push * (ma / tot);
        }
      }
      for (const k of G.ally && !G.ally.down ? [G.player, G.ally] : [G.player]) {
        const dx = a.x - k.x, dy = a.y - k.y, d = Math.hypot(dx, dy) || 0.01, min = a.def.radius + 9;
        if (d < min) { a.x = k.x + (dx / d) * min; a.y = k.y + (dy / d) * min; }
      }
      W.collide(a, a.def.radius * 0.6);
      collideCamp(a, a.def.radius * 0.6);
    }
    G.enemies = G.enemies.filter((e) => !e.removed);
  }

  function champion(e, dt, dp) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = 9;
      for (let i = 0; i < 3; i++) {
        const a = rand(0, TAU);
        G.enemies.push(makeEnemy("revenant", e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, e.zi, { goal: e.goal }));
      }
    }
    e.spikeT -= dt;
    if (e.spikeT <= 0 && dp < 420) {
      e.spikeT = 5.5;
      const p = targetFor(e);
      for (let i = 0; i < 3; i++) {
        const a = rand(0, TAU), r = i ? rand(30, 70) : 0;
        G.telegraphs.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 34, t: 0, delay: 0.9, dmg: e.dmg * 0.8 });
      }
    }
  }

  function strike(e) {
    const p = e.tgt || G.player;
    if (e.def.ranged && !e.aimGoal) {
      const a = Math.atan2(p.y - e.y, p.x - e.x) * 0.3 + e.aim * 0.7;
      G.projectiles.push({ x: e.x, y: e.y - 22, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 1.4, dmg: e.dmg, hostile: true, kind: "arrow", col: "90,235,245" });
      sfx("arrow");
      return;
    }
    G.effects.push({ type: "slash", x: e.x, y: e.y - 18, ang: e.aim, arc: 1.9, r: e.def.range + 8, t: 0, max: 0.18, col: "90,230,240", w: 4 + e.def.scale * 3 });
    const g = e.aimGoal;
    if (g && goalValid(g)) {
      if (dist(e.x, e.y, g.x, g.y) < e.def.range + (g.rad || 12) + 14) damageLight(g, e.def.lightDmg || e.dmg);
      return;
    }
    const d = dist(e.x, e.y, p.x, p.y);
    const ad = Math.abs(angleDiff(e.aim, Math.atan2(p.y - e.y, p.x - e.x)));
    if (d <= e.def.range + 16 && ad < 1.25) hurtKnight(p, e.dmg, e.aim);
  }

  function damageLight(o, amt) {
    sfx("flameHit");
    if (o.kind === "flame") {
      o.hp -= amt;
      o.hitT = 0.2;
      if (o.hp <= 0 && o.lit) {
        o.lit = false; o.hp = 0;
        say("The Central Flame has gone out! Hold on until dawn.", "danger");
        for (let i = 0; i < 30; i++) puff(0, -10, "rgba(40,40,40,0.7)", 80, 1.2);
      }
      return;
    }
    if (o.kind === "pylon") {
      o.hp -= amt;
      o.hitT = 0.2;
      for (let i = 0; i < 4; i++) spark(o.x, o.y - 40, "255,160,70", 80);
      if (o.hp <= 0 && o.lit) {
        o.lit = false; o.hp = 0;
        say("A Lantern Pylon has been snuffed out.", "warn");
        for (let i = 0; i < 12; i++) puff(o.x, o.y - 40, "rgba(40,40,40,0.7)", 50, 1);
      }
      return;
    }
    o.hp -= amt;
    o.hitT = 0.2;
    if (o.def) G.dirty.add(o);
    for (let i = 0; i < 4; i++) spark(o.x, o.y - 20, o.type === "torch" || o.type === "brazier" ? "255,160,70" : "80,230,240", 80);
    if (o.hp <= 0) {
      if (o.type === "torch" || o.type === "brazier") collapseTorch(o);
      else {
        o.dead = true;
        say(`A ${o.def.name} has withered into a husk.`, "warn");
        for (let i = 0; i < 18; i++) puff(o.x, o.y - 20, "rgba(60,200,210,0.6)", 60, 1);
      }
    }
  }

  function collapseTorch(t) {
    G.torches = G.torches.filter((x) => x !== t);
    G.decals.push({ x: t.x, y: t.y, type: "burnt", t: 40 });
    for (let i = 0; i < 10; i++) puff(t.x, t.y - 16, "rgba(50,45,40,0.7)", 40, 0.9);
  }

  function hurtPlayer(dmg, ang) {
    const p = G.player;
    if (p.inv > 0 || p.dashT > 0 || G.state !== "play") return;
    dmg *= DL.Kits.damageTaken(p);
    p.hp -= dmg;
    p.inv = 0.5;
    p.hurtFlash = 0.3;
    p.flash = 0.15;
    if (!DL.Kits.steady(p)) { p.kx += Math.cos(ang) * 160; p.ky += Math.sin(ang) * 160; }
    G.camera.shake = 7;
    sfx("hurt");
    text(p.x, p.y - 70, "-" + Math.round(dmg), "#ff6a6a");
    if (p.hp <= 0) die("wounds");
  }

  function hitEnemy(e, dmg, ang, kb, burn, remote) {
    if (e.removed) return;
    const crit = !remote && Math.random() < 0.12;
    let d = dmg * (crit ? 1.6 : 1);
    if (G.isGuest()) {
      // Show the hit now; the host owns the Drowned and applies it.
      DL.Net.event({ t: "hit", id: e.id, dmg: d, ang, kb, burn: burn || 0 });
      e.flash = 0.12;
      sfx("hit");
      text(e.x + rand(-8, 8), e.y - 40 * e.def.scale - 20, Math.round(d * (1 - (e.def.armor || 0))) + (crit ? "!" : ""), crit ? "#ffe08a" : "#f3e6cf", crit ? 1.3 : 1);
      for (let i = 0; i < 4; i++) puff(e.x, e.y - 24 * e.def.scale, "rgba(70,210,220,0.7)", 90, 0.35);
      return;
    }
    d *= 1 - (e.def.armor || 0);
    e.hp -= d;
    e.flash = 0.12;
    if (e.dormant) e.dormant = false;
    const m = e.def.mass;
    e.kx += (Math.cos(ang) * kb) / m;
    e.ky += (Math.sin(ang) * kb) / m;
    if (burn) { e.burn = 3; e.burnDps = burn; }
    if (!remote) {
      sfx("hit");
      text(e.x + rand(-8, 8), e.y - 40 * e.def.scale - 20, Math.round(d) + (crit ? "!" : ""), crit ? "#ffe08a" : "#f3e6cf", crit ? 1.3 : 1);
    }
    for (let i = 0; i < 4; i++) puff(e.x, e.y - 24 * e.def.scale, "rgba(70,210,220,0.7)", 90, 0.35);
    if (e.hp <= 0) kill(e, true);
  }
  G.hitEnemy = hitEnemy;
  G.kill = (e) => { if (!G.isGuest()) kill(e, true); };

  function kill(e, drops) {
    if (e.removed || G.isGuest()) return;
    e.removed = true;
    sfx("kill");
    G.effects.push({ type: "dissolve", e, t: 0, max: 0.6 });
    for (let i = 0; i < 16; i++) puff(e.x + rand(-10, 10), e.y - rand(0, 50) * e.def.scale, "rgba(60,220,230,0.7)", 50, 0.9, -40);
    if (e.isSelf) {
      const c = G.save.drownedSelf ? G.save.drownedSelf.carried : {};
      for (const k in c) if (c[k] > 0) dropRes(e.x, e.y, k, c[k]);
      G.save.drownedSelf = null;
      G.selfEnemy = null;
      G.persist();
      say("You reclaim what the darkness took.", "good");
      return;
    }
    if (!drops) return;
    for (const k in e.def.drop) {
      const ch = e.def.drop[k];
      const raw = ch >= 1 ? ch * (1 + e.zi * 0.6) + rand(0, 2) : Math.random() < ch ? 1 + (e.zi > 2 ? 1 : 0) : 0;
      const n = Math.floor(raw * G.diff().yield + Math.random());
      if (n > 0) dropRes(e.x, e.y, k, n);
    }
    if (e.def.boss) say(`${e.def.name} falls!`, "good");
  }

  function dropRes(x, y, res, n) {
    const chunks = Math.min(n, 6);
    for (let i = 0; i < chunks; i++) {
      const amt = Math.floor(n / chunks) + (i < n % chunks ? 1 : 0);
      const a = rand(0, TAU), s = rand(40, 110);
      G.pickups.push({ id: ++G.pid, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, res, amt, t: 0 });
    }
  }

  /* ---------------- defenses, projectiles, telegraphs ---------------- */
  function nearestEnemy(x, y, R) {
    let best = null, bd = R;
    for (const e of G.enemies) {
      if (e.rise > 0 || e.dormant) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function shoot(x, y, target, speed, dmg, col, kind) {
    const a = Math.atan2(target.y - 20 - y, target.x - x);
    G.projectiles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1.3, dmg, hostile: false, kind, col });
  }

  function updateDefenses(dt) {
    const lv = G.save.up.tower;
    if (G.night) {
      DL.Camp.layout(G.save.up).towers.forEach((t, i) => {
        G.towerCd[i] -= dt;
        if (G.towerCd[i] > 0) return;
        const e = nearestEnemy(t.x, t.y, 300);
        if (e) { G.towerCd[i] = 1.1; shoot(t.x, t.y - 56, e, 520, 10 + 6 * lv, "255,190,110", "bolt"); }
      });
    }
    for (const o of G.blooms) {
      if (o.type !== "sentinel" || !o.active) continue;
      o.cd -= dt;
      if (o.cd > 0) continue;
      const e = nearestEnemy(o.x, o.y, 190);
      if (e) { o.cd = 1.2; shoot(o.x, o.y - 24, e, 380, 8 * (1 + 0.25 * (o.zi - 1)), "170,245,255", "shard"); }
    }
    for (const t of G.torches) {
      if (t.type !== "brazier") continue;
      for (const e of G.enemies) {
        if (e.rise > 0) continue;
        if (dist(t.x, t.y, e.x, e.y) < t.r * 0.6) {
          e.hp -= t.dps * dt;
          e.slow = Math.max(e.slow, 0.2);
          if (Math.random() < 0.1) spark(e.x, e.y - 20, "255,130,50", 40);
          if (e.hp <= 0) kill(e, true);
        }
      }
    }
    G.enemies = G.enemies.filter((e) => !e.removed);
  }

  function updateProjectiles(dt) {
    const p = G.player;
    for (const b of G.projectiles) {
      if (b.homing) {
        // Relic orbs bend toward the nearest Drowned they haven't hit yet.
        let tgt = null, bd = 280;
        for (const e of G.enemies) {
          if (e.rise > 0 || e.removed || b.hit.has(e)) continue;
          const d = dist(b.x, b.y, e.x, e.y);
          if (d < bd) { bd = d; tgt = e; }
        }
        if (tgt) {
          const want = Math.atan2(tgt.y - 20 * tgt.def.scale - b.y, tgt.x - b.x), cur = Math.atan2(b.vy, b.vx);
          const na = cur + Math.max(-6 * dt, Math.min(6 * dt, angleDiff(cur, want))), sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.hostile) {
        if (dist(b.x, b.y, p.x, p.y - 22) < 16) { hurtPlayer(b.dmg, Math.atan2(b.vy, b.vx)); b.life = 0; }
        else if (G.ally && !G.ally.down && dist(b.x, b.y, G.ally.x, G.ally.y - 22) < 16) { DL.Net.hurtAlly(b.dmg, Math.atan2(b.vy, b.vx)); b.life = 0; }
      } else {
        for (const e of G.enemies) {
          if (e.rise > 0 || e.removed || (b.hit && b.hit.has(e))) continue;
          if (dist(b.x, b.y, e.x, e.y - 20 * e.def.scale) < e.def.radius + (b.r || 8)) {
            hitEnemy(e, b.dmg * DL.Kits.farShotMult(b), Math.atan2(b.vy, b.vx), 60);
            if (b.flare) flare(b.x, b.y, b.dmg);
            if (b.hit) b.hit.add(e);
            if (!b.pierce || b.pierce-- <= 0) { b.life = 0; break; }
          }
        }
      }
      if (b.life <= 0 && b.lightOnEnd && !b.ended) {
        b.ended = true;
        G.lightZones.push({ x: b.x, y: b.y + 10, r: 60 * G.diff().light, t: 2.5 });
        spark(b.x, b.y, b.col, 60);
      }
    }
    G.projectiles = G.projectiles.filter((b) => b.life > 0);
    G.enemies = G.enemies.filter((e) => !e.removed);
  }

  // Ashen Arbalist flare bolt: a burst of searing light.
  function flare(x, y, dmg) {
    G.effects.push({ type: "ring", x, y, r0: 6, r1: 58, t: 0, max: 0.35, col: "255,200,120", w: 6 });
    for (const e of G.enemies.slice()) if (!e.removed && dist(x, y, e.x, e.y - 20) < 58 + e.def.radius) hitEnemy(e, dmg * 0.6, Math.atan2(e.y - y, e.x - x), 120);
    G.lightZones.push({ x, y: y + 16, r: 70 * G.diff().light, t: 3 });
    for (let i = 0; i < 10; i++) spark(x, y, "255,210,140", 140);
  }

  function updateTelegraphs(dt) {
    const p = G.player;
    for (const t of G.telegraphs) {
      t.t += dt;
      if (t.t >= t.delay && !t.done) {
        t.done = true;
        if (dist(t.x, t.y, p.x, p.y) < t.r + 6) hurtPlayer(t.dmg, Math.atan2(p.y - t.y, p.x - t.x));
        const a = G.ally;
        if (a && !a.down && dist(t.x, t.y, a.x, a.y) < t.r + 6) DL.Net.hurtAlly(t.dmg, Math.atan2(a.y - t.y, a.x - t.x));
        for (let i = 0; i < 10; i++) spark(t.x + rand(-t.r, t.r) * 0.6, t.y + rand(-t.r, t.r) * 0.3, "90,235,245", 120);
        G.effects.push({ type: "spikes", x: t.x, y: t.y, r: t.r, t: 0, max: 0.5 });
      }
    }
    G.telegraphs = G.telegraphs.filter((t) => t.t < t.delay + 0.05);
  }

  function updatePickups(dt) {
    for (const k of G.pickups) {
      k.t += dt;
      const a = G.ally && !G.ally.down ? G.ally : null;
      const p = a && dist(k.x, k.y, a.x, a.y) < dist(k.x, k.y, G.player.x, G.player.y) ? a : G.player;
      const d = dist(k.x, k.y, p.x, p.y - 10);
      if (k.t > 0.45 && d < 95) {
        const s = 420;
        k.x += ((p.x - k.x) / d) * s * dt;
        k.y += ((p.y - 10 - k.y) / d) * s * dt;
        if (d < 16 && p === G.ally) {
          k.done = true;
          DL.Net.send({ t: "gain", res: k.res, amt: k.amt });
        } else if (d < 16) {
          k.done = true;
          p.carried[k.res] += k.amt;
          text(p.x, p.y - 70, `+${k.amt} ${DL.RESOURCES[k.res].name}`, DL.RESOURCES[k.res].color);
          sfx("pickup");
        }
      } else {
        k.x += k.vx * dt; k.y += k.vy * dt;
        k.vx *= Math.pow(0.02, dt); k.vy *= Math.pow(0.02, dt);
      }
    }
    G.pickups = G.pickups.filter((k) => !k.done && k.t < 120);
  }

  function updateLightsources(dt) {
    for (const t of G.torches) {
      t.t -= dt;
      if (t.hitT) t.hitT = Math.max(0, t.hitT - dt);
    }
    for (const t of G.torches.slice()) if (t.t <= 0) collapseTorch(t);
    for (const z of G.lightZones) z.t -= dt;
    G.lightZones = G.lightZones.filter((z) => z.t > 0);
    for (const d of G.decals) d.t -= dt;
    G.decals = G.decals.filter((d) => d.t > 0);
    G.flame.hitT = Math.max(0, G.flame.hitT - dt);
    for (const o of G.blooms) if (o.hitT) o.hitT = Math.max(0, o.hitT - dt);
  }

  /* ---------------- effects ---------------- */
  function puff(x, y, col, spd, life, vy = 0) {
    const a = rand(0, TAU), s = rand(0.2, 1) * spd;
    G.effects.push({ type: "p", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 + vy, t: 0, max: life * rand(0.6, 1.2), col, size: rand(1.5, 3.5) });
  }
  function spark(x, y, rgb, spd) {
    const a = rand(0, TAU), s = rand(0.3, 1) * spd;
    G.effects.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, max: rand(0.3, 0.7), col: rgb, size: rand(1.5, 3) });
  }
  function text(x, y, txt, col, scale = 1) {
    G.texts.push({ x, y, txt, col, t: 0, max: 1, scale });
  }
  G.spark = spark;
  G.puff = puff;
  G.text = text;
  G.hurtPlayer = hurtPlayer;
  G.dropRes = dropRes;
  G.nightAmount = nightAmount;

  function updateEffects(dt) {
    for (const f of G.effects) {
      f.t += dt;
      if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(0.1, dt); f.vy *= Math.pow(0.1, dt); }
    }
    G.effects = G.effects.filter((f) => f.t < f.max);
    for (const t of G.texts) { t.t += dt; t.y -= 26 * dt; }
    G.texts = G.texts.filter((t) => t.t < t.max);
    if (G.effects.length > 600) G.effects.splice(0, G.effects.length - 600);
  }

  function updateCamera(dt) {
    const c = G.camera, p = G.player;
    const k = 1 - Math.pow(0.0005, dt);
    c.x += (p.x - c.x) * k;
    c.y += (p.y - 20 - c.y) * k;
    c.shake = Math.max(0, c.shake - dt * 30);
  }

  /* ---------------- death ---------------- */
  function die(cause) {
    const p = G.player;
    if (G.state !== "play") return;
    if (G.isGuest()) { if (!(p.downT > 0)) guestDown(); return; }
    G.state = "dying";
    G.dying = 0;
    sfx("death");
    const lost = { ...p.carried };
    const any = DL.RES_KEYS.some((k) => lost[k] > 0);
    const hadSelf = !!G.save.drownedSelf;
    if (any) {
      G.save.drownedSelf = { x: p.x, y: p.y, carried: lost };
      G.selfEnemy = null;
      G.enemies = G.enemies.filter((e) => !e.isSelf);
    }
    G.persist();
    G.deathInfo = { cause, lost, any, hadSelf, zone: DL.ZONES[p.zi].name, day: G.save.day, nights: G.save.nights };
    for (let i = 0; i < 40; i++) puff(p.x + rand(-12, 12), p.y - rand(0, 60), "rgba(60,220,230,0.7)", 50, 1.6, -30);
  }

  /* ---------------- camp actions (called by the camp menu) ---------------- */
  G.canAfford = function (cost) {
    for (const k in cost) if ((G.save.stash[k] || 0) < cost[k]) return false;
    return true;
  };
  function pay(cost) { for (const k in cost) G.save.stash[k] -= cost[k]; }
  G.pay = pay;

  // Why the next level of a building can't be built yet (null when it can, cost aside).
  G.upgradeLock = function (u, lvl) {
    const needFlame = u.reqFlame(lvl + 1);
    if (G.save.up.flame < needFlame) return `Needs Central Flame ${needFlame}`;
    if (u.id === "flame") {
      const nights = DL.FLAME_NIGHTS[lvl + 1] || 0;
      if (G.save.nights < nights) return `Needs ${nights} night${nights > 1 ? "s" : ""} survived (${G.save.nights} so far)`;
    }
    return null;
  };

  G.buyUpgrade = function (id) {
    const u = DL.UPGRADES.find((x) => x.id === id), lvl = G.save.up[id];
    if (lvl >= u.max) return false;
    const cost = u.costs[lvl];
    if (G.upgradeLock(u, lvl) || !G.canAfford(cost)) { sfx("deny"); return false; }
    pay(cost);
    G.save.up[id] = lvl + 1;
    const st = G.stats();
    if (id === "flame") { G.flame.max = st.flameHp; G.flame.hp = st.flameHp; G.flame.lit = true; }
    if (id === "armory") G.player.hp += 25;
    if (id === "workbench") G.player.oil = st.maxOil;
    if (id === "pylon") G.resetPylons();
    if (id === "flame" && DL.Camp.tier(G.save.up) !== DL.Camp.tier({ ...G.save.up, flame: lvl })) {
      setTimeout(() => say(`Your camp grows: ${DL.TIER_NAMES[DL.Camp.tier(G.save.up)]}.`, "good"), 300);
    }
    G.persist();
    sfx("build");
    return true;
  };

  G.craftTorch = function () {
    if (G.save.torches >= G.stats().torchMax || !G.canAfford(DL.TORCH_COST)) { sfx("deny"); return false; }
    pay(DL.TORCH_COST);
    G.save.torches += 1;
    G.persist();
    sfx("torch");
    return true;
  };

  G.restUntilDusk = function () {
    if (G.phase() !== "day") return;
    G.time = CYC.day - 2;
    const st = G.stats();
    G.player.hp = st.maxHp;
    G.player.oil = st.maxOil;
  };
})(window.DL);
