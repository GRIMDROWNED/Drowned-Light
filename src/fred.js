/* Drowned Light — Fred, a mushroom familiar. A tiny Fred sleeps in a fairy ring of red toadstools out in the
   Drowned Reaches. Come to the ring at night with a torch and he wakes, terrified, and the Drowned hunt him until
   dawn; keep him alive and every knight who stood by him takes their own Fred home. If he dies, the ring wilts
   for a few nights. Fred is the healer: he spits slowing spores at the Drowned and sprouts glowcaps that heal
   whoever steps on them. At levels 5, 10 and 15 you choose his road: A, the Mender (more healing), or B, the
   Blight (more control); a level 3 Toadstool Cottage lets you choose again, at a price. Bosses are never
   confused, turned or put to sleep. The host runs every Fred, glowcap and fairy ring and sends them in its
   snapshots; each device heals its own knight. Numbers: DL.FRED. Until Robert's drawings are in, Fred is drawn
   here in code, a little different for each of his four forms. */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, F = DL.FRED;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const CAST = 0.5, CAST_AT = 0.25; // his spit, and when the glob leaves him
  const AMBER = "255,180,80", GREEN = "150,225,90"; // the Mender's lanterns and spores, and the Blight's
  const Fred = (DL.Fred = {});
  G.freds = [];
  G.glowcaps = [];
  G.sporeRings = [];

  const compass = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const myId = () => (G.isGuest() ? DL.Net.myId : 0);
  Fred.won = () => (G.isGuest() ? DL.Net.hasFred() : !!G.save.fred);
  Fred.mine = () => G.freds.find((m) => m.owner === myId()) || null;
  // His colour: amber while he leans to the Mender's road, a sickly green once he leans to the Blight's.
  Fred.col = function () {
    const p = (G.save.summons && G.save.summons.fredPath) || [];
    return p.filter((v) => v === "B").length > p.filter((v) => v === "A").length ? GREEN : AMBER;
  };

  /* ---------------- the fairy ring (the same for every visit and every friend in a world of this difficulty) ---------------- */
  let spot = null, spotFor = null;
  Fred.ringSpot = function () {
    if (spot && spotFor === G.save.difficulty) return spot;
    const W = DL.World, Dif = G.diff(), GR = DL.GROVE;
    const dry = (x, y) => !W.isWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !W.isWater(x + Math.cos(i * 0.785) * 120, y + Math.sin(i * 0.785) * 80));
    const groveNear = (x, y) => {
      for (let gy = Math.floor((y - 600) / GR.cell); gy <= Math.floor((y + 600) / GR.cell); gy++)
        for (let gx = Math.floor((x - 600) / GR.cell); gx <= Math.floor((x + 600) / GR.cell); gx++) {
          const g = W.grove(gx, gy, Dif);
          if (g && Math.hypot(g.x - x, g.y - y) < 480) return true;
        }
      return false;
    };
    spot = null;
    for (let t = 0; t < 80 && !spot; t++) {
      const a = DL.hash(71, 43, 300 + t) * TAU, r = F.ringDist + (DL.hash(71, 43, 400 + t) - 0.5) * 300;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (dry(x, y) && !groveNear(x, y) && !DL.Cave.clears(x, y)) spot = { x, y };
    }
    spot = spot || { x: -F.ringDist * 0.7, y: -F.ringDist * 0.7 };
    spotFor = G.save.difficulty;
    shrooms = null;
    return spot;
  };
  // The toadstools of the ring: round an ellipse, big and small.
  let shrooms = null;
  Fred.shrooms = function () {
    if (shrooms) return shrooms;
    const s = Fred.ringSpot();
    shrooms = [];
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * TAU + DL.hash(73, i, 1) * 0.25;
      shrooms.push({ x: s.x + Math.cos(a) * 66, y: s.y + Math.sin(a) * 36, k: 0.6 + DL.hash(73, i, 2) * 0.7, i });
    }
    return shrooms;
  };
  Fred.clears = (x, y) => { const s = Fred.ringSpot(); return Math.hypot(x - s.x, y - s.y) < F.clear; };
  Fred.where = function () { const s = Fred.ringSpot(); return { dir: compass(s.x, s.y), m: Math.round(Math.hypot(s.x, s.y) / 10) }; };

  /* ---------------- the night at the ring ---------------- */
  // Host: the trial ({ fredTrial, x, y, hp, max, ... }) or null. Guest: what the host last sent.
  let trial = null, netSealed = false;
  Fred.trial = () => trial;
  Fred.sealed = () => (G.isGuest() ? netSealed : G.save.fredRing.fail >= 0 && G.save.nights < G.save.fredRing.fail + F.wilt);
  const nightsLeft = () => Math.max(1, G.save.fredRing.fail + F.wilt - G.save.nights);
  // Host: the knight standing there has lit a torch, and little Fred wakes.
  function start() {
    if (trial || Fred.sealed()) return;
    const s = Fred.ringSpot(), max = Math.round(F.trialHp * (1 + 0.5 * G.allies.length));
    trial = { id: ++G.eid, fredTrial: true, x: s.x, y: s.y, hp: max, max, rad: 10, waveT: 2, capT: 5, flash: 0 };
    const m = "The torchlight wakes a tiny mushroom in the ring, and the Drowned come for him. Keep him alive until dawn!";
    say(m, "warn"); DL.Net.say(m, "warn");
    sfx("night");
    for (let i = 0; i < 16; i++) G.spark(s.x, s.y - 16, AMBER, 90);
  }
  Fred.startHost = start;
  // His little body takes the blows meant for him.
  Fred.hurtTrial = function (dmg) {
    if (!trial || G.isGuest()) return;
    trial.hp -= dmg;
    trial.flash = 0.15;
    G.text(trial.x, trial.y - 50, "-" + Math.round(dmg), "#ff8a7a", 0.9);
    if (trial.hp > 0) return;
    const s = Fred.ringSpot();
    trial = null;
    G.save.fredRing.fail = G.save.nights;
    G.persist();
    for (let i = 0; i < 24; i++) G.puff(s.x + rand(-20, 20), s.y - rand(0, 30), "rgba(120,110,90,0.7)", 50, 1.2, -20);
    const m = `The little mushroom's lanterns gutter out, and the fairy ring wilts. It will grow again in ${F.wilt} nights.`;
    say(m, "danger"); DL.Net.say(m, "danger");
    sfx("death");
  };
  // A hostile arrow or orb that strikes him.
  Fred.shot = function (b) {
    if (!trial || dist(b.x, b.y, trial.x, trial.y - 12) > 13) return false;
    Fred.hurtTrial(b.dmg);
    return true;
  };
  // Host: the knights by the ring get its waves instead of the usual roamers.
  Fred.busy = (p) => !!trial && dist(p.x, p.y, trial.x, trial.y) < 700;
  // Who a Drowned goes for: little Fred first while he's awake in his ring, and a Drowned near one that Mindrot
  // turned fights it back. Bosses keep to their own prey.
  Fred.decoy = function (e, best) {
    if (e.def.boss) return best;
    if (trial && dist(e.x, e.y, trial.x, trial.y) < 520) return trial;
    let bd = Math.min(170, dist(e.x, e.y, best.x, best.y)), out = best;
    for (const o of G.enemies) {
      if (!(o.mind > 0) || o === e || o.removed) continue;
      const d = dist(e.x, e.y, o.x, o.y);
      if (d < bd) { bd = d; out = o; }
    }
    return out;
  };
  // A turned Drowned's prey: the nearest of its own kind.
  const valid = (e) => e && !e.removed && e.rise <= 0 && !e.dormant;
  Fred.prey = function (e) {
    let best = null, bd = 400;
    for (const o of G.enemies) {
      if (o === e || !valid(o)) continue;
      const d = dist(e.x, e.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };

  // Every device: come upon the ring, and wake him with a torch at night.
  let near = false, guestFound = false;
  function visit() {
    const p = G.player;
    if (!p || G.state !== "play" || G.cave || p.downT > 0) return;
    const s = Fred.ringSpot(), d = dist(p.x, p.y, s.x, s.y);
    const found = G.isGuest() ? guestFound : G.save.fredRing.found;
    if (!found && d < 480) {
      if (G.isGuest()) guestFound = true;
      else { G.save.fredRing.found = true; G.persist(); }
      if (!Fred.won()) say("A ring of red toadstools, lanterns hanging from their caps. In the middle a tiny mushroom sleeps.", "warn");
    }
    if (d > F.wakeR + 50) near = false;
    if (d > F.wakeR || near) return;
    near = true;
    if (Fred.won() || trial) return;
    if (Fred.sealed()) { say("The fairy ring has wilted. It will grow back in a few nights.", "warn"); return; }
    if (!G.night) { say("The little mushroom sleeps soundly. Come back at night with a torch to wake him.", "warn"); return; }
    if (G.save.torches <= 0) { say("You need a torch in your satchel to wake him. Craft one at camp.", "warn"); return; }
    G.save.torches -= 1;
    sfx("torch");
    if (G.isGuest()) DL.Net.event({ t: "fredWake" });
    else { G.persist(); start(); }
  }

  // Host, each frame: waves come for him, and he sprouts glowcaps for his defenders.
  function trialStep(dt) {
    if (!trial) return;
    trial.flash = Math.max(0, trial.flash - dt);
    trial.waveT -= dt;
    if (trial.waveT <= 0) {
      trial.waveT = F.waveEvery;
      const n = Math.max(2, Math.round((3 + Math.floor(G.save.day * 0.4)) * G.diff().spawn * G.partyScale()));
      G.spawnWave(trial.x, trial.y, DL.ZONES[3].pool, n, null, F.waveR, 3);
    }
    trial.capT -= dt;
    if (trial.capT <= 0) {
      trial.capT = F.trialCapEvery;
      const a = rand(0, TAU);
      addCap(trial.x + Math.cos(a) * 40, trial.y + Math.sin(a) * 22, -1, 15, 0, 30);
    }
  }

  // Host: dawn after the night at the ring. Everyone who stood by him takes a Fred home.
  function win() {
    const s = Fred.ringSpot();
    let any = false;
    const p = G.player;
    if (p && !(p.downT > 0) && G.state === "play" && dist(p.x, p.y, s.x, s.y) < F.winR) {
      any = true;
      if (!G.save.fred) {
        G.save.fred = 1;
        spawn(0, s.x, s.y);
        say("Dawn. The little mushroom blinks at the sun, alive, and squeaks his name: Fred. He toddles after you. He's yours.", "good");
      }
    }
    for (const a of G.allies) {
      if (a.down || dist(a.x, a.y, s.x, s.y) > F.winR) continue;
      any = true;
      if (!G.freds.some((m) => m.owner === a.id)) { spawn(a.id, s.x, s.y); DL.Net.sendTo(a.id, { t: "fredWon" }); }
    }
    if (!any) say("The little mushroom lived through the night, but nobody was by his ring at dawn. He curls up and sleeps again.", "warn");
    sfx("milestone");
    G.persist();
  }
  Fred.dawn = function () {
    if (G.isGuest()) return;
    if (trial) { trial = null; win(); }
    // the Toadstool Cottage sprouts glowcaps in the camp
    const lv = G.save.up.toadstool || 0, n = F.campCaps[lv] || 0, h = DL.Camp.layout(G.save.up).toadstool;
    if (n && h) {
      for (let i = 0; i < n; i++) addCap(h.x + rand(-44, 44), h.y + rand(18, 40), -1, 18, 10, DL.CYCLE.total * 0.9, true);
      setTimeout(() => say(`The Toadstool Cottage sprouted ${n} glowcap${n > 1 ? "s" : ""} in the camp.`, "good"), 2600);
    }
  };
  // Guest: the host says you stood by his ring till dawn.
  Fred.wonGuest = function () {
    const pr = DL.Net.profile();
    pr.fred = 1;
    DL.Net.saveProfile(pr);
    sfx("milestone");
    say("Dawn. The little mushroom blinks at the sun, alive, and squeaks his name: Fred. He toddles after you. He's yours.", "good");
  };

  /* ---------------- glowcaps and fairy rings ---------------- */
  // owner: whose Fred grew it (-1: the ring or the cottage). Anyone may eat any glowcap.
  function addCap(x, y, owner, heal, clean, life, camp) {
    G.glowcaps.push({ id: ++G.eid, x, y, owner, heal: Math.round(heal), clean, t: 0, life, camp: !!camp });
    for (let i = 0; i < 6; i++) G.spark(x, y - 4, AMBER, 50);
  }
  const inRing = (k, r) => Math.hypot(k.x - r.x, (k.y - r.y) / 0.55) < F.ringR;
  // Every device, for its own knight: eat a glowcap you step on (only while it would do you good), heal in a fairy ring.
  let eaten = new Set();
  Fred.local = function (dt) {
    visit();
    const p = G.player;
    if (!p || G.state !== "play" || p.downT > 0) return;
    const st = G.stats();
    for (const c of G.glowcaps) {
      if (c.taken || eaten.has(c.id) || c.t < 0.6 || dist(p.x, p.y, c.x, c.y) > F.capR) continue;
      if (p.hp >= st.maxHp - 0.5 && !(c.clean && p.corrupt > 1)) continue; // leave it for someone who needs it
      c.taken = true;
      squash(c);
      p.hp = Math.min(st.maxHp, p.hp + c.heal);
      if (c.clean) p.corrupt = Math.max(0, p.corrupt - c.clean);
      G.text(p.x, p.y - 70, `+${c.heal}`, "#9fe08a");
      sfx("chime");
      for (let i = 0; i < 10; i++) G.spark(c.x, c.y - 6, AMBER, 80);
      if (G.isGuest()) { eaten.add(c.id); DL.Net.event({ t: "fredCap", id: c.id }); }
    }
    if (!G.isGuest()) G.glowcaps = G.glowcaps.filter((c) => !c.taken);
    for (const r of G.sporeRings) if (inRing(p, r)) p.hp = Math.min(st.maxHp, p.hp + F.ringHeal * dt);
  };
  // Host: a friend ate one.
  Fred.capEaten = function (id) { for (const c of G.glowcaps) if (c.id === id) squash(c); G.glowcaps = G.glowcaps.filter((c) => c.id !== id); };
  // the squashed cap left behind for a moment (just for show, on each device)
  let squashed = [];
  const squash = (c) => squashed.push({ x: c.x, y: c.y, t: 0 });

  /* ---------------- his spores ---------------- */
  function spore(e) {
    e.spore = F.slowFor;
    e.sporeK = 1 - F.slow * (e.def.boss ? 0.5 : 1); // bosses shrug off half of it
  }
  // A spore glob lands: it slows what it hits, and on the Blight's road bursts into a befuddling cloud.
  Fred.sporeHit = function (e, b) {
    spore(e);
    if (!b.cloud) return;
    const x = b.x, y = b.y + 12;
    G.effects.push({ type: "fredCloud", x, y, r: F.cloudR, t: 0, max: 0.9, col: b.col });
    for (const o of G.enemies) {
      if (!valid(o) || dist(o.x, o.y, x, y) > F.cloudR + o.def.radius) continue;
      spore(o);
      if (!o.def.boss) { o.conf = Math.max(o.conf || 0, F.confuse); o.wanderA = null; }
    }
  };

  /* ---------------- the Freds themselves (host only) ---------------- */
  function ownerOf(m) {
    if (m.owner === 0) return G.state === "play" || G.state === "camp" ? G.player : null;
    return G.allies.find((a) => a.id === m.owner) || null;
  }
  function spawn(owner, x, y) {
    const had = G.freds.find((m) => m.owner === owner);
    if (had) return had;
    const m = { id: ++G.eid, fred: true, owner, x, y, angle: Math.PI / 2, moving: false, animT: 0, state: "move", stT: 0, cd: 1.5,
      capT: 8, ringT: 3, mindT: 4, stormT: 6, stillT: 0 };
    G.freds.push(m);
    for (let i = 0; i < 16; i++) G.puff(x + rand(-12, 12), y - rand(0, 30), "rgba(220,190,140,0.6)", 50, 1, -25);
    return m;
  }
  // A new life (or a reload): your Fred is back at your side, and every friend's.
  Fred.reset = function () {
    const friends = G.freds.filter((m) => m.owner !== 0).map((m) => m.owner);
    G.freds = []; G.glowcaps = []; G.sporeRings = []; squashed = [];
    trial = null;
    near = false;
    if (G.isGuest()) return;
    if (G.save.fred && G.player) spawn(0, G.player.x - 20, G.player.y + 14);
    for (const a of G.allies) if (friends.includes(a.id)) spawn(a.id, a.x - 20, a.y + 14);
  };
  // Host: a friend who won him (here or in any world) brings him along; one who leaves takes him away.
  Fred.join = function (owner) {
    const a = G.allies.find((o) => o.id === owner);
    if (a) spawn(owner, a.x - 20, a.y + 14);
  };
  Fred.leave = function (owner) { G.freds = G.freds.filter((m) => m.owner !== owner); };
  Fred.forget = function () { eaten = new Set(); guestFound = false; trial = null; netSealed = false; };

  // His glob grows with the Central Flame and his own level (src/summons.js).
  Fred.dmg = () => Math.round(F.dmg * (1 + F.perFlame * Math.max(0, G.save.up.flame - F.reqFlame)) * DL.Summons.fred().mult * 10) / 10;
  function target(m, o) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (!valid(e) || dist(o.x, o.y, e.x, e.y) > F.sight) continue;
      const d = dist(m.x, m.y, e.x, e.y) + (e.spore > 0 ? 300 : 0); // the ones not yet spored first
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function spit(m, e, lv) {
    const h = HEIGHT[DL.Summons.form("fred")], x = m.x, y = m.y - h * 0.55, a = Math.atan2(e.y - 20 * e.def.scale - y, e.x - x);
    G.projectiles.push({ x, y, vx: Math.cos(a) * F.globSpeed, vy: Math.sin(a) * F.globSpeed, life: F.globLife, dmg: Fred.dmg(), hostile: false,
      kind: "spore", col: Fred.col(), r: 7, homing: true, hit: new Set(), spore: true, cloud: lv.cloud });
    sfx("spore");
  }
  const enemiesNear = (o, R) => G.enemies.some((e) => valid(e) && dist(o.x, o.y, e.x, e.y) < R);

  function step(m, dt) {
    const o = ownerOf(m);
    if (!o) { if (m.owner !== 0) m.gone = true; return; }
    const lv = DL.Summons.fred(), col = Fred.col();
    m.animT += dt;
    m.cd -= dt; m.capT -= dt; m.ringT -= dt; m.mindT -= dt; m.stormT -= dt;
    if (dist(m.x, m.y, o.x, o.y) > 700) {
      Object.assign(m, { x: o.x - 20, y: o.y + 14, state: "move" });
      for (let i = 0; i < 8; i++) G.puff(m.x, m.y - 10, "rgba(220,190,140,0.5)", 40, 0.7);
    }
    const down = o.downT > 0 || o.down;
    const dark = G.night || G.cave || DL.ZONES[DL.World.zoneIndex(m.x, m.y)].abyss;
    if (m.state === "cast") {
      m.stT -= dt;
      if (!m.thrown && m.stT <= CAST - CAST_AT) { m.thrown = true; if (valid(m.tgt)) spit(m, m.tgt, lv); }
      if (m.stT <= 0) m.state = "move";
    } else if (m.state === "heal") {
      m.stT -= dt;
      if (m.stT <= 0) m.state = "move";
    } else if (!down) {
      if (dark && m.capT <= 0) {
        // a glowcap at his feet (no more than a few of his lying about)
        m.capT = lv.capEvery;
        if (G.glowcaps.filter((c) => c.owner === m.owner).length < F.capMax) {
          addCap(m.x + rand(-10, 10), m.y + rand(6, 14), m.owner, lv.capHeal, lv.cleanse, F.capLife);
          Object.assign(m, { state: "heal", stT: 0.6 });
        }
      } else if (m.cd <= 0) {
        const e = target(m, o);
        if (e) {
          Object.assign(m, { state: "cast", stT: CAST, cd: lv.cd, tgt: e, thrown: false });
          m.angle = Math.atan2(e.y - m.y, e.x - m.x);
        }
      }
    }
    // Fairy Ring (the Mender's road, level 10): standing still, he drips a ring that heals and holds off corruption
    m.stillT = m.moving ? 0 : m.stillT + dt;
    if (lv.ring && m.stillT > 0.6 && m.ringT <= 0 && (G.night || enemiesNear(o, 300))) {
      m.ringT = F.ringEvery;
      G.sporeRings.push({ id: ++G.eid, owner: m.owner, x: m.x, y: m.y + 4, t: 0, life: F.ringFor });
      sfx("chime");
    }
    // Mindrot (the Blight's road, level 10): a Drowned turns on its own kind
    if (lv.mind && m.mindT <= 0) {
      m.mindT = 1;
      let pick = null;
      for (const e of G.enemies) {
        if (!valid(e) || e.def.boss || e.def.den || e.isSelf || e.mind > 0 || dist(o.x, o.y, e.x, e.y) > F.mindR) continue;
        if (!G.enemies.some((b) => b !== e && valid(b) && dist(b.x, b.y, e.x, e.y) < 320)) continue; // nothing for it to fight
        if (!pick || e.hp > pick.hp) pick = e;
      }
      if (pick) {
        m.mindT = F.mindEvery;
        pick.mind = F.mindFor; pick.goal = null; pick.conf = 0;
        G.effects.push({ type: "fredBeam", x1: m.x, y1: m.y - 30, x2: pick.x, y2: pick.y - 24 * pick.def.scale, t: 0, max: 0.6, col: GREEN });
        G.text(pick.x, pick.y - 50 * pick.def.scale - 30, "Turned", "#b8f07a", 0.9);
        sfx("whisper");
      }
    }
    // Spore Storm (the Blight's road, level 15): every Drowned near his knight falls asleep
    if (lv.storm && m.stormT <= 0) {
      m.stormT = 1;
      if (enemiesNear(o, F.stormR)) {
        m.stormT = F.stormEvery;
        G.effects.push({ type: "howl", x: o.x, y: o.y - 10, t: 0, max: 0.9, col: col, r: F.stormR });
        G.effects.push({ type: "fredCloud", x: o.x, y: o.y, r: F.stormR * 0.8, t: 0, max: 1.2, col });
        sfx("spore");
        for (const e of G.enemies) {
          if (!valid(e) || dist(o.x, o.y, e.x, e.y) > F.stormR) continue;
          spore(e);
          if (!e.def.boss) { e.stun = Math.max(e.stun || 0, F.sleep); e.sleep = true; e.state = "move"; }
        }
      }
    }
    // he toddles along at his knight's other side from Derek and Abigail, a little ahead, where you can see him
    if (m.state === "cast") return;
    const a = o.angle || 0;
    // the bigger forms keep further out so they don't hide their knight
    const sp = [34, 38, 46, 64][DL.Summons.form("fred")];
    const fx = o.x - Math.cos(a + Math.PI / 2) * sp + Math.cos(a) * 10, fy = o.y - Math.sin(a + Math.PI / 2) * sp * 0.65 + Math.sin(a) * 8 + 8;
    const d = dist(m.x, m.y, fx, fy);
    m.moving = d > (m.moving ? 4 : 14);
    if (!m.moving) return;
    let mx = fx - m.x, my = fy - m.y;
    const wp = DL.Hounds.gateWay(m, fx, fy);
    if (wp) { mx = wp.x - m.x; my = wp.y - m.y; }
    const md = Math.hypot(mx, my) || 1, spd = (d > 160 ? F.speed * 1.4 : Math.min(F.speed, d * 3)) * (DL.World.isWater(m.x, m.y) ? 0.85 : 1);
    m.x += (mx / md) * spd * dt;
    m.y += (my / md) * spd * dt;
    m.angle = Math.atan2(my, mx);
    DL.World.collide(m, 6);
    G.collideCamp(m, 6);
  }

  // Second Bloom (the Mender's road, level 15), on each device for its own knight: once a night, falling
  // stands you back up.
  let bloomedOn = -1;
  Fred.rebloom = function (p) {
    if (!Fred.mine() || !DL.Summons.fred().rebloom || bloomedOn === G.save.nights) return false;
    bloomedOn = G.save.nights;
    p.hp = G.stats().maxHp * F.rebloom;
    p.inv = 2;
    G.effects.push({ type: "fredCloud", x: p.x, y: p.y, r: 46, t: 0, max: 1.2, col: AMBER });
    for (let i = 0; i < 24; i++) G.puff(p.x + rand(-14, 14), p.y - rand(0, 50), `rgba(${AMBER},0.6)`, 50, 1.2, -30);
    sfx("milestone");
    say("Fred wraps you in spores and stands you back up. (Second Bloom: once a night.)", "good");
    return true;
  };

  Fred.update = function (dt) {
    for (const m of G.freds) step(m, dt);
    G.freds = G.freds.filter((m) => !m.gone);
    trialStep(dt);
    for (const c of G.glowcaps) c.t += dt;
    for (const q of squashed) q.t += dt;
    squashed = squashed.filter((q) => q.t < 4);
    G.glowcaps = G.glowcaps.filter((c) => c.t < c.life);
    for (const r of G.sporeRings) r.t += dt;
    G.sporeRings = G.sporeRings.filter((r) => r.t < r.life);
    Fred.local(dt);
  };

  // Light: his lanterns, the glowcaps, the fairy rings (bloomlight: they hold off corruption), and the ring out in the Reaches.
  Fred.lights = function (L) {
    const col = Fred.col();
    for (const m of G.freds) L.push({ x: m.x, y: m.y - HEIGHT[DL.Summons.form("fred")] * 0.6, r: 54, s: 0.4, col, a: 0.55 });
    for (const c of G.glowcaps) L.push({ x: c.x, y: c.y - 4, r: 26, s: 0.4, col: AMBER, a: 0.6 });
    for (const r of G.sporeRings) L.push({ x: r.x, y: r.y, r: F.ringR / 0.82, s: 0.4, col: AMBER, a: 0.5 * Math.min(1, (r.life - r.t) / 1.5), kind: "bloom", obj: null });
    const p = G.player;
    if (!p || G.cave) return;
    const s = Fred.ringSpot();
    if (Math.abs(s.x - p.x) < 1200 && Math.abs(s.y - p.y) < 1200) L.push({ x: s.x, y: s.y - 10, r: trial ? 160 : Fred.sealed() ? 50 : DL.Art.sprites.fairyRing && DL.Art.sprites.fairyRing.res ? 140 : 100, s: 0.35, col: AMBER, a: Fred.sealed() ? 0.2 : 0.5 });
  };

  /* ---------------- co-op ---------------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  Fred.rows = function () {
    return {
      f: G.freds.map((m) => [m.id, m.owner, r1(m.x), r1(m.y), r1(m.angle), m.moving ? 1 : 0, m.state === "cast" ? 1 : m.state === "heal" ? 2 : 0, r1(m.stT)]),
      c: G.glowcaps.map((c) => [c.id, r1(c.x), r1(c.y), c.heal, c.clean, c.camp ? 1 : 0]),
      r: G.sporeRings.map((r) => [r.id, r1(r.x), r1(r.y), r1(r.t), r.life]),
      t: trial ? [r1(trial.x), r1(trial.y), Math.round(trial.hp), trial.max, trial.flash > 0 ? 1 : 0] : 0,
      s: Fred.sealed() ? 1 : 0,
    };
  };
  Fred.apply = function (d) {
    if (!d) return;
    const old = new Map(G.freds.map((m) => [m.id, m]));
    G.freds = (d.f || []).map((r) => {
      const m = old.get(r[0]) || { id: r[0], fred: true, x: r[2], y: r[3], animT: 0 };
      return Object.assign(m, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], state: ["move", "cast", "heal"][r[6]], stT: r[7] });
    });
    G.glowcaps = (d.c || []).filter((r) => !eaten.has(r[0])).map((r) => ({ id: r[0], x: r[1], y: r[2], heal: r[3], clean: r[4], camp: !!r[5], t: 1 }));
    G.sporeRings = (d.r || []).map((r) => ({ id: r[0], x: r[1], y: r[2], t: r[3], life: r[4] }));
    trial = d.t ? { fredTrial: true, x: d.t[0], y: d.t[1], hp: d.t[2], max: d.t[3], flash: d.t[4] ? 0.1 : 0 } : null;
    netSealed = !!d.s;
  };
  // Guest: glide toward the host's positions, and heal your own knight.
  Fred.guest = function (dt, k01) {
    for (const m of G.freds) {
      if (m.tx == null) continue;
      m.x += (m.tx - m.x) * k01; m.y += (m.ty - m.y) * k01;
      m.animT += dt;
      if (m.state !== "move") m.stT -= dt;
    }
    for (const r of G.sporeRings) r.t += dt;
    Fred.local(dt);
  };

  // The field guide's line, and the camp card's.
  Fred.guideLine = function () {
    if (Fred.won()) return `<b>Fred</b> toddles at your heels, slowing the Drowned with spores and growing glowcaps that heal.`;
    const w = Fred.where(), found = G.isGuest() ? guestFound : G.save.fredRing.found;
    return `A ring of red toadstools grows in the Drowned Reaches${found ? `, ${w.m} m ${w.dir} of camp` : ""}. Something small sleeps in it. Wake it with a torch at night and keep it alive until dawn.`;
  };

  /* ---------------- drawing (a coded stand-in until Robert's drawings are in) ---------------- */
  const HEIGHT = [36, 48, 74, 100]; // how tall each form stands, in world px
  Fred.HEIGHT = HEIGHT;
  const PAL = { cap: "#a8322a", capDk: "#6e1c18", spot: "#e8d2a8", gill: "#d9c49a", body: "#cdb08a", bodyDk: "#8d7457",
    rag: "#7a2420", ragDk: "#4a1512", drip: "#e6dcc0", eye: "#1a0f0a", brass: "#b8862e", leg: "#cdb89a", hole: "#1c0d0a", out: "#120a07" };
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function poly(c, pts, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function seg(c, pts, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  }
  const unitDir = (a) => DL.Art.unitDir(a);
  // Where each form's lanterns hang and its eyes are, relative to its feet (x to the right when facing you).
  const LANTERNS = [[[-13, -17], [13, -17]], [[-14, -16], [14, -16]], [[-17, -48], [17, -48]], [[-32, -55], [18, -56], [32, -55]]];
  const EYES = [null, [-2.6, -19, 2.6, -19], [-2.5, -51, 2.5, -51], [-3, -57, 3, -57]];
  // The cap: a dome (or a tall point for Weeping Fred), its rim of gills, spots, rot holes and dripping ooze.
  function cap(c, f, cy, rx, ry, t, phase) {
    if (f === 2) poly(c, [-rx, cy, -rx * 0.7, cy - ry * 0.7, 2, cy - ry * 1.6, rx * 0.7, cy - ry * 0.6, rx, cy], PAL.cap);
    else { c.fillStyle = PAL.cap; c.beginPath(); c.ellipse(0, cy, rx, ry, 0, Math.PI, TAU); c.fill(); }
    ell(c, 0, cy, rx, Math.max(2, ry * 0.18), PAL.gill);
    c.fillStyle = PAL.capDk; c.fillRect(-rx * 0.15, cy - ry * 0.9, rx * 0.5, 2);
    const spots = [[-0.5, 0.45, 0.13], [0.15, 0.7, 0.12], [0.55, 0.35, 0.1], [-0.15, 0.25, 0.08], [0.35, 0.18, 0.07]];
    for (const [sx, sy, sr] of spots) ell(c, sx * rx, cy - sy * ry * (f === 2 ? 1.2 : 1), sr * rx, sr * rx * 0.75, PAL.spot);
    const holes = [0, 0, 2, 3][f];
    for (let i = 0; i < holes; i++) ell(c, (-0.35 + i * 0.4) * rx, cy - (0.45 + (i % 2) * 0.2) * ry, rx * 0.08, ry * 0.08, PAL.hole);
    const drips = [0, 5, 6, 9][f];
    for (let i = 0; i < drips; i++) {
      const x = -rx * 0.85 + (i / Math.max(1, drips - 1)) * rx * 1.7, len = (3 + ((i * 7) % 5) * 1.6) * (f >= 2 ? 1.6 : 1) * (0.85 + 0.15 * Math.sin(t * 1.5 + i + phase));
      c.fillStyle = PAL.drip; c.fillRect(x - 0.8, cy, 1.6, len); ell(c, x, cy + len, 1.3, 1.5, PAL.drip);
    }
  }
  function lanterns(c, f, t, phase) {
    for (const [lx, ly] of LANTERNS[f]) {
      const sw = Math.sin(t * 2.4 + lx * 0.3 + phase) * 1.5;
      seg(c, [lx, ly - 5, lx + sw, ly], 1, PAL.brass);
      c.fillStyle = PAL.brass; c.fillRect(lx + sw - 1.8, ly, 3.6, 4.4);
      c.fillStyle = "#ffcf7a"; c.fillRect(lx + sw - 0.8, ly + 1, 1.6, 2.4);
    }
  }
  /* One figure of Fred, his feet at (x, y). o: { f: form, dir, flip, anim: "idle"|"walk"|"cast"|"heal"|"sleep", ph: walk phase, t, id } */
  function figure(c, x, y, o) {
    const f = o.f, t = o.t, back = o.dir === "up", side = o.dir === "side", walk = o.anim === "walk";
    const step = walk ? Math.sin(o.ph) : 0, bob = walk ? Math.abs(Math.cos(o.ph)) * 1.5 : Math.sin(t * 2 + o.id) * 0.5;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (side && o.flip) c.scale(-1, 1);
    if (o.anim === "sleep") c.scale(1.05, 0.9);
    if (o.anim === "cast") c.rotate(side ? 0.12 : 0); // leaning into the spit
    if (f <= 1) {
      const k = f === 0 ? 1 : 1.3;
      c.scale(k, k);
      // stubby legs
      ell(c, -3 + (side ? step * 2 : 0), -2 - Math.max(0, step) * 2, 2.2, 3, PAL.bodyDk);
      ell(c, 3 - (side ? step * 2 : 0), -2 - Math.max(0, -step) * 2, 2.2, 3, PAL.bodyDk);
      c.translate(0, -bob);
      ell(c, 0, -9, 6, 7.5, PAL.body);
      if (f === 1) poly(c, [-6, -15, 6, -15, 8, -3, 5, -1, 2, -4, -1, -1, -4, -4, -8, -2], PAL.rag); // his ragged leafy cloak
      // the collar of red leaves
      for (let i = -2; i <= 2; i++) poly(c, [i * 2.6 - 2, -15, i * 2.6 + 2, -15, i * 2.6, -11 - (i % 2 ? 0 : 1)], f === 1 ? PAL.ragDk : PAL.rag);
      // arms: down, raised to his mouth (Fred), or raised high to heal
      const up = o.anim === "heal";
      c.fillStyle = PAL.body;
      if (up) { c.fillRect(-8, -24, 2, 9); c.fillRect(6, -24, 2, 9); }
      else if (f === 1 && !back) { ell(c, -1.8, -15.5, 1.6, 1.6, PAL.body); ell(c, 1.8, -15.5, 1.6, 1.6, PAL.body); }
      else { c.fillRect(-7.5, -13, 2, 6); c.fillRect(5.5, -13, 2, 6); }
      // face under the cap
      ell(c, 0, -19, 6, 4.5, PAL.body);
      if (!back) {
        if (o.anim === "sleep") { c.fillStyle = PAL.eye; c.fillRect(-4, -19, 3, 1); c.fillRect(1, -19, 3, 1); }
        else if (side) ell(c, 3, -19, 1.6, 1.9, PAL.eye);
        else { ell(c, -2.6, -19, 1.6, 1.9, PAL.eye); ell(c, 2.6, -19, 1.6, 1.9, PAL.eye); }
      }
      cap(c, f, -22, 14, 11, t, o.id || 0);
      lanterns(c, f, t, o.id || 0);
    } else if (f === 2) {
      // Weeping Fred: a long tattered robe to the ground, a hollow face under a tall rotten cap
      const sw = walk ? Math.sin(o.ph) * 3 : Math.sin(t * 1.6 + o.id) * 1;
      c.translate(0, -bob);
      poly(c, [-8, -46, 8, -46, 13 + sw, -4, 11 + sw, 0, 7 + sw, -3, 4 + sw, 1, 0 + sw, -3, -4 + sw, 1, -7 + sw, -3, -11 + sw, 0, -13 + sw, -4], PAL.rag);
      poly(c, [-5, -46, 5, -46, 7 + sw * 0.6, -10, 2 + sw * 0.5, -6, -3 + sw * 0.5, -10, -7 + sw * 0.6, -8], PAL.ragDk);
      c.fillStyle = PAL.drip; for (const [rx, ry] of [[-9, -20], [7, -28], [-3, -12]]) c.fillRect(rx + sw * 0.5, ry, 3, 2); // rotten cream rags
      if (o.anim === "heal" || o.anim === "cast") { seg(c, [-7, -40, -14, -54], 2.4, PAL.leg); seg(c, [7, -40, 14, -54], 2.4, PAL.leg); }
      ell(c, 0, -50, 7.5, 7, PAL.ragDk);
      if (!back) { ell(c, side ? 2 : 0, -50, 5.5, 6, PAL.hole); c.fillStyle = PAL.drip; c.fillRect(side ? 0 : -3, -46, side ? 4 : 6, 1.6); }
      cap(c, 2, -55, 19, 14, t, o.id || 0);
      lanterns(c, 2, t, o.id || 0);
    } else {
      // Fred the Rotwalker: a wide rotten cap on four long spider legs, a ribcage face full of fangs
      const legs = [[-1, 0], [-1, 1], [1, 0], [1, 1]];
      for (const [s, n] of legs) {
        const lift = walk ? Math.max(0, Math.sin(o.ph + (n ? Math.PI : 0) + (s > 0 ? Math.PI : 0))) * 6 : 0;
        const fx = s * (side ? (n ? 10 : 30) : (n ? 22 : 40)), kx = s * (side ? (n ? 20 : 38) : (n ? 30 : 46));
        seg(c, [s * 10, -40, kx, -54 - (n ? 0 : 8) - lift * 0.5, kx + s * 4, -30, fx, -lift], 3.2, n ? PAL.bodyDk : PAL.leg);
        seg(c, [fx, -lift, fx + s * 3, 1 - lift], 2, PAL.bodyDk);
      }
      c.translate(0, -bob);
      ell(c, 0, -42, 17, 13, PAL.rag);
      poly(c, [-17, -42, -13, -24, -9, -32, -5, -22, 0, -30, 5, -21, 9, -31, 13, -23, 17, -42], PAL.ragDk);
      ell(c, 0, -56, 11, 9, PAL.body);
      if (!back) {
        ell(c, side ? 3 : 0, -55, 8, 7, PAL.hole);
        c.fillStyle = PAL.drip;
        for (let i = -3; i <= 3; i++) c.fillRect((side ? 3 : 0) + i * 2.2 - 0.6, -52, 1.2, 4 + (i % 2 ? 0 : 2)); // fangs
        for (let i = 0; i < 3; i++) c.fillRect((side ? 3 : 0) - 6, -60 + i * 2.5, 12, 0.9); // the ribs of his face
      }
      if (o.anim === "cast" || o.anim === "heal") { seg(c, [-12, -46, -26, -70], 3, PAL.leg); seg(c, [12, -46, 26, -70], 3, PAL.leg); }
      cap(c, 3, -63, 36, 20, t, o.id || 0);
      lanterns(c, 3, t, o.id || 0);
    }
    c.restore();
  }
  // World points of his lantern flames and eyes, for the glow drawn over the dark.
  function glowPoints(x, y, f, dir, flip, anim, t, id) {
    const k = f === 0 ? 1 : f === 1 ? 1.3 : 1, s = dir === "side" && flip ? -1 : 1, out = { lamps: [], eyes: [] };
    for (const [lx, ly] of LANTERNS[f]) out.lamps.push([x + s * (lx + Math.sin(t * 2.4 + lx * 0.3 + id) * 1.5) * k, y + (ly + 3) * k]);
    if (dir !== "up" && anim !== "sleep" && f >= 1) {
      const e = EYES[f];
      if (dir === "side") out.eyes.push([x + s * (e[2] + (f >= 2 ? 1 : 0)) * k, y + e[3] * k]);
      else out.eyes.push([x + e[0] * k, y + e[1] * k], [x + e[2] * k, y + e[3] * k]);
    }
    return out;
  }
  function shadow(c, x, y, rx, ry) { c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function animOf(m, t) {
    if (m.state === "cast") return "cast";
    if (m.state === "heal") return "heal";
    return m.moving ? "walk" : "idle";
  }
  // Robert's drawing of a form, once it's loaded (fred_f0 and so on, src/sprites.js), replaces the coded figure.
  const drawnKey = (f) => { const k = "fred_f" + f, sh = DL.Art.sheets[k]; return sh && !sh.down.idle[0].blank && !sh.down.walk[0].blank ? k : null; };
  Fred.drawn = drawnKey;
  function drawnFrame(m, t) {
    if (m.state === "cast") return ["attack", Math.max(0, Math.min(2, Math.floor((1 - m.stT / CAST) * 3))), m.angle];
    if (m.state === "heal") return ["heal", 0, Math.PI / 2];
    if (m.moving) return ["walk", Math.floor(m.animT * 14), m.angle];
    return ["idle", 0, m.angle];
  }
  function drawFred(c, m, t) {
    const f = DL.Summons.form("fred"), { dir, flip } = unitDir(m.angle), anim = animOf(m, t), key = drawnKey(f);
    shadow(c, m.x, m.y, [7, 9, 13, 30][f], [2.5, 3, 4, 7][f]);
    if (key) { const [a, fr, ang] = drawnFrame(m, t); return DL.Art.drawUnit(c, key, a, fr, ang, m.x, m.y, 1); }
    figure(c, m.x, m.y, { f, dir, flip, anim, ph: m.animT * 11, t, id: m.id });
  }
  // Little Fred in his ring: asleep (the drawn breath pose, eyes shut), or awake and fighting for his life.
  function drawLittle(c, x, y, awake, flash, t) {
    shadow(c, x, y, 7, 2.5);
    const key = drawnKey(0);
    if (key) return DL.Art.drawUnit(c, key, awake ? "idle" : "attack", 0, Math.PI / 2, x, y, 1, flash ? { flash: 0.6, flashColor: "#ff8a7a" } : {});
    figure(c, x, y, { f: 0, dir: "down", flip: false, anim: awake ? (flash ? "cast" : "idle") : "sleep", ph: 0, t, id: 3 });
  }
  // A glowcap: a little cluster of pale caps glowing amber from underneath.
  function drawCap(c, cp, t) {
    const grow = Math.min(1, (cp.t || 1) / 0.6), art = DL.Art.sprites.glowcap2;
    if (art && art.res) {
      // Robert's drawing: a sprout for the first moment, then the grown cluster, fading as it withers
      const name = grow < 1 ? "glowcap1" : "glowcap2", s = DL.Art.sprites[name], fade = cp.life ? Math.min(1, (cp.life - cp.t) / 2) : 1;
      c.save(); c.globalAlpha = Math.max(0, fade);
      c.drawImage(s.c, Math.round(cp.x - s.w), Math.round(cp.y - s.h * 2 + 2), s.w * 2, s.h * 2);
      c.restore();
      return;
    }
    c.save(); c.translate(Math.round(cp.x), Math.round(cp.y)); c.scale(grow, grow);
    for (const [dx, h, r] of [[-4, 6, 3.4], [3, 8, 4], [0, 4, 2.8]]) {
      c.fillStyle = "#d8cfb4"; c.fillRect(dx - 0.8, -h, 1.6, h);
      c.fillStyle = "#efe2bf"; c.beginPath(); c.ellipse(dx, -h, r, r * 0.6, 0, Math.PI, TAU); c.fill();
      c.fillStyle = "#ffb347"; c.fillRect(dx - r * 0.7, -h, r * 1.4, 1);
    }
    c.restore();
  }
  function drawShroom(c, s, wilted, t) {
    const k = s.k, h = 9 * k, r = 7 * k;
    c.fillStyle = wilted ? "#7c7466" : "#e6d8b8"; c.fillRect(s.x - 1.5 * k, s.y - h, 3 * k, h);
    c.save(); c.translate(s.x, s.y - h);
    if (wilted) c.rotate(0.5 * (s.i % 2 ? 1 : -1));
    c.fillStyle = wilted ? "#5a5550" : PAL.cap; c.beginPath(); c.ellipse(0, 0, r, r * 0.7, 0, Math.PI, TAU); c.fill();
    c.fillStyle = wilted ? "#45403a" : PAL.gill; c.fillRect(-r, 0, r * 2, 1.5);
    if (!wilted) { c.fillStyle = PAL.spot; c.fillRect(-r * 0.4, -r * 0.45, 2, 2); c.fillRect(r * 0.25, -r * 0.3, 1.6, 1.6); }
    c.restore();
  }
  function bar(c, x, y, w, k, col) {
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, k), 3);
  }

  Fred.push = function (list, c, t, view) {
    const inView = (x, y, m = 120) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m * 1.6;
    for (const r of G.sporeRings) if (inView(r.x, r.y)) list.push({ y: r.y - 300, f: () => drawRing(c, r, t) });
    for (const cp of G.glowcaps) if (inView(cp.x, cp.y)) list.push({ y: cp.y, f: () => drawCap(c, cp, t) });
    const flat = DL.Art.sprites.glowcap3;
    if (flat && flat.res) for (const q of squashed) if (inView(q.x, q.y)) list.push({ y: q.y - 20, f: () => {
      c.save(); c.globalAlpha = Math.min(1, (4 - q.t) / 1.5);
      c.drawImage(flat.c, Math.round(q.x - flat.w), Math.round(q.y - flat.h * 2 + 2), flat.w * 2, flat.h * 2);
      c.restore();
    } });
    for (const m of G.freds) list.push({ y: m.y, f: () => drawFred(c, m, t) });
    if (G.cave) return;
    const s = Fred.ringSpot();
    if (!inView(s.x, s.y, 300)) return;
    const wilted = Fred.sealed();
    const art = DL.Art.sprites[wilted ? "fairyRingWilt" : "fairyRing"];
    if (art && art.res) {
      // Robert's drawing: the far half of the ring behind whoever stands in it, the near half in front
      list.push({ y: s.y - 42, f: () => ringHalf(c, art, s, false) });
      list.push({ y: s.y + RING_HOLE[1], f: () => ringHalf(c, art, s, true) });
    } else for (const sh of Fred.shrooms()) list.push({ y: sh.y, f: () => drawShroom(c, sh, wilted, t) });
    if (trial) list.push({ y: s.y, f: () => {
      drawLittle(c, trial.x, trial.y, true, trial.flash > 0, t);
      bar(c, trial.x, trial.y - 50, 30, trial.hp / trial.max, "#ffb347");
    } });
    else if (!Fred.won() && !wilted) list.push({ y: s.y, f: () => drawLittle(c, s.x, s.y, false, false, t) });
  };
  // The drawn ring is placed by the middle of its hole (in world px from its top left); its lanterns, for their glow.
  const RING_HOLE = [124, 90], RING_LAMPS = [[19, 46], [218, 22], [143, 140], [165, 159]];
  function ringHalf(c, art, s, near) {
    const w = art.w * 2, h = art.h * 2, k = art.c.height / h, top = near ? RING_HOLE[1] : 0, hh = near ? h - RING_HOLE[1] : RING_HOLE[1];
    c.drawImage(art.c, 0, top * k, art.c.width, hh * k, Math.round(s.x - RING_HOLE[0]), Math.round(s.y - RING_HOLE[1] + top), w, hh);
  }
  // A fairy ring dripped on the ground: a faint ring of light dotted with tiny caps.
  function drawRing(c, r, t) {
    const a = Math.min(1, r.t / 0.6) * Math.min(1, (r.life - r.t) / 1.2);
    c.strokeStyle = `rgba(${AMBER},${0.35 * a})`; c.lineWidth = 3;
    c.beginPath(); c.ellipse(r.x, r.y, F.ringR, F.ringR * 0.55, 0, 0, TAU); c.stroke();
    c.fillStyle = `rgba(${AMBER},${0.08 * a})`; c.fill();
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * TAU, x = r.x + Math.cos(q) * F.ringR, y = r.y + Math.sin(q) * F.ringR * 0.55;
      c.fillStyle = `rgba(239,226,191,${a})`; c.beginPath(); c.ellipse(x, y - 3, 3, 2, 0, Math.PI, TAU); c.fill();
    }
  }

  // Over the dark: his lanterns and eyes, the glowcaps' glow, little Fred in his ring, the marks of his spores on the
  // Drowned (? befuddled, a green swirl turned, Zz asleep), and his clouds and beams.
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(0.35, `rgba(${col},${a * 0.7})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Where the lanterns and eyes are on Robert's drawings, in world px from his feet ([across, up]), facing you and
  // facing right (mirrored when he faces left; from behind only the lanterns show). Measured off the cut sprites.
  const DRAWN_GLOW = [
    { front: { lamps: [[-12, 15], [11, 15]], eyes: [[-3.5, 22], [3.5, 22]] }, side: { lamps: [[-12, 12], [11, 19]], eyes: [[4.5, 21]] } },
    { front: { lamps: [[-17, 15], [17, 15]], eyes: [[-4, 28], [4, 28]] }, side: { lamps: [[-16, 14], [16, 22]], eyes: [[8, 29]] } },
    { front: { lamps: [[-20, 40], [17, 38]], eyes: [[-4, 60], [4, 60]] }, side: { lamps: [[-21, 35], [12, 40]], eyes: [[3, 58]] } },
    { front: { lamps: [[-40, 47], [29, 47]], eyes: [[-3, 68], [3, 68]] }, side: { lamps: [[-33, 46], [37, 39]], eyes: [[22, 66]] } },
  ];
  function figureGlow(c, x, y, f, dir, flip, anim, t, id, col) {
    const P = glowPoints(x, y, f, dir, flip, anim, t, id), fl = 0.8 + 0.2 * Math.sin(t * 7 + id);
    if (drawnKey(f)) {
      const D = DRAWN_GLOW[f][dir === "side" ? "side" : "front"], m = dir === "side" && flip ? -1 : 1;
      for (const [dx, up] of D.lamps) glow(c, x + m * dx, y - up, 7 + f * 3, col, 0.75 * fl);
      if (dir !== "up" && anim !== "sleep") for (const [dx, up] of D.eyes) glow(c, x + m * dx, y - up, 3 + f, AMBER, 0.65);
      if (f === 3 && dir !== "up") { const [dx, up] = D.eyes[0]; glow(c, x + m * (dir === "side" ? dx : 0), y - up + 6, 14, col, 0.5 * fl); } // the furnace in his maw
      return;
    }
    for (const [lx, ly] of P.lamps) glow(c, lx, ly, 9 + f * 2, col, 0.8 * fl);
    for (const [ex, ey] of P.eyes) glow(c, ex, ey, 4 + f, col, 0.95);
    if (f === 3 && dir !== "up") glow(c, x + (dir === "side" ? (flip ? -3 : 3) : 0), y - 54, 12, col, 0.5 * fl); // the furnace in his maw
  }
  Fred.glow = function (c, t, view) {
    const col = Fred.col(), f = DL.Summons.form("fred");
    for (const m of G.freds) {
      const { dir, flip } = unitDir(m.angle);
      figureGlow(c, m.x, m.y, f, dir, flip, animOf(m, t), t, m.id, col);
      if (m.state === "heal") glow(c, m.x, m.y - HEIGHT[f] * 0.7, 26, AMBER, 0.5 * Math.min(1, m.stT / 0.3));
    }
    for (const cp of G.glowcaps) glow(c, cp.x, cp.y - 5, 12, AMBER, 0.45 + 0.15 * Math.sin(t * 3 + cp.id));
    if (!G.cave) {
      const s = Fred.ringSpot();
      if (s.x > view.left - 200 && s.x < view.right + 200 && s.y > view.top - 200 && s.y < view.bottom + 200) {
        const art = DL.Art.sprites.fairyRing;
        if (art && art.res && !Fred.sealed())
          for (const [lx, ly] of RING_LAMPS) glow(c, s.x - RING_HOLE[0] + lx, s.y - RING_HOLE[1] + ly, 16, AMBER, 0.5 + 0.1 * Math.sin(t * 5 + lx));
        if (trial) figureGlow(c, trial.x, trial.y, 0, "down", false, "idle", t, 3, AMBER);
        else if (!Fred.won() && !Fred.sealed()) {
          figureGlow(c, s.x, s.y, 0, "down", false, "sleep", t, 3, AMBER);
          zz(c, s.x + 10, s.y - 34, t);
        }
      }
    }
    for (const e of G.enemies) {
      if (e.rise > 0) continue;
      const fx = G.isGuest() ? e.fx || 0 : (e.conf > 0 ? 1 : 0) | (e.mind > 0 ? 2 : 0) | (e.sleep && e.stun > 0 ? 4 : 0) | (e.spore > 0 ? 8 : 0);
      if (!fx) continue;
      const top = e.y - 52 * e.def.scale - 12;
      if (fx & 8) for (let i = 0; i < 2; i++) {
        const u = (t * 0.9 + i / 2 + e.id * 0.31) % 1;
        c.fillStyle = `rgba(${col},${0.6 * Math.sin(Math.PI * u)})`;
        c.fillRect(e.x + Math.sin(i * 3 + e.id) * 9 - 1, e.y - u * 30 * e.def.scale - 1, 2, 2);
      }
      if (fx & 4) zz(c, e.x + 6, top, t + e.id);
      else if (fx & 1) { c.fillStyle = `rgba(${GREEN},0.95)`; c.font = "bold 13px sans-serif"; c.textAlign = "center"; c.fillText("?", e.x + Math.sin(t * 4 + e.id) * 4, top); }
      if (fx & 2) {
        c.strokeStyle = `rgba(${GREEN},0.8)`; c.lineWidth = 2;
        c.beginPath(); c.ellipse(e.x, e.y, 15 * e.def.scale, 6 * e.def.scale, 0, t * 4, t * 4 + Math.PI * 1.4); c.stroke();
        glow(c, e.x, top + 4, 8, GREEN, 0.7);
      }
    }
    for (const fx of G.effects) {
      if (fx.type === "fredCloud") {
        const k = fx.t / fx.max;
        for (let i = 0; i < 10; i++) {
          const a = i * 2.4 + fx.x * 0.01, r = fx.r * (0.3 + 0.7 * Math.sqrt(k)) * (0.5 + (i % 3) * 0.25);
          const x = fx.x + Math.cos(a) * r, y = fx.y + Math.sin(a) * r * 0.55 - k * 14;
          c.fillStyle = `rgba(${fx.col},${0.3 * (1 - k)})`;
          c.beginPath(); c.arc(x, y, 6 + 6 * k, 0, TAU); c.fill();
        }
      } else if (fx.type === "fredBeam") {
        const k = fx.t / fx.max;
        c.strokeStyle = `rgba(${fx.col},${0.85 * (1 - k)})`; c.lineWidth = 3 * (1 - k) + 1;
        c.beginPath(); c.moveTo(fx.x1, fx.y1); c.quadraticCurveTo((fx.x1 + fx.x2) / 2, Math.min(fx.y1, fx.y2) - 30, fx.x2, fx.y2); c.stroke();
      }
    }
  };
  function zz(c, x, y, t) {
    c.font = "bold 10px sans-serif"; c.textAlign = "center";
    for (let i = 0; i < 2; i++) {
      const u = (t * 0.5 + i * 0.5) % 1;
      c.fillStyle = `rgba(230,240,255,${0.85 * Math.sin(Math.PI * u)})`;
      c.fillText("z", x + u * 8, y - u * 14);
    }
  }
  // His spore glob: a soft ball of spores trailing motes.
  Fred.drawGlob = function (c, b) {
    const a = Math.atan2(b.vy, b.vx), ux = Math.cos(a), uy = Math.sin(a), col = b.col || AMBER;
    for (let i = 1; i <= 5; i++) {
      c.fillStyle = `rgba(${col},${0.4 * (1 - i / 6)})`;
      c.beginPath(); c.arc(b.x - ux * i * 4 + Math.sin(i * 2.1 + b.x * 0.05) * 2, b.y - uy * i * 4, 4 - i * 0.5, 0, TAU); c.fill();
    }
    glow(c, b.x, b.y, 9, col, 0.9);
  };
  // The Kit tab's portrait: his current form, standing (or sleeping, before he's won).
  Fred.portrait = function (g, cv, t) {
    const f = Fred.won() ? DL.Summons.form("fred") : 0, sc = [1.1, 0.9, 0.62, 0.46][f], x = cv.width / 2, y = cv.height - 3;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    const key = drawnKey(f);
    if (key) { g.imageSmoothingEnabled = false; DL.Art.drawUnit(g, key, Fred.won() ? "idle" : "attack", 0, Math.PI / 2, 0, 0, 1); }
    else figure(g, 0, 0, { f, dir: "down", flip: false, anim: Fred.won() ? "idle" : "sleep", ph: 0, t, id: 1 });
    g.globalCompositeOperation = "lighter";
    figureGlow(g, 0, 0, f, "down", false, Fred.won() ? "idle" : "sleep", t, 1, Fred.col());
    g.restore();
  };
})(window.DL);
