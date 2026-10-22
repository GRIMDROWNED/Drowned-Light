/* Drowned Light — online co-op for two (PeerJS).
   The host's device runs the world: the Drowned, day and night, the camp and its stash.
   The guest's device runs only the guest's own knight (with its own kit and level) and
   sends what it does — hits, mined nodes, lights it raises, supplies it deposits — to the host.
   The host sends a snapshot of the world about 15 times a second; both sides smooth the gaps.

   Connecting uses the free public PeerJS server to introduce the two devices; after that the
   game data goes directly between them (WebRTC). The library loads only when co-op is used. */
"use strict";
(function (DL) {
  const G = DL.Game;
  const PEERJS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
  const PREFIX = "drowned-light-";
  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
  const SNAP_EVERY = 1 / 15, STATE_EVERY = 1 / 20;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const r1 = (v) => Math.round(v * 10) / 10;
  // How far through its special move a knight is (0..1, 0 when not casting), for its attack pose on the other screen.
  const castK = (p) => (p.cast ? Math.max(0.1, r1(p.cast.t / p.cast.dur)) : 0);
  const wispK = () => (G.wisp ? [r1(G.wisp.x), r1(G.wisp.y)] : 0);
  const TYPES = Object.keys(DL.ENEMIES);

  /* Two phones on mobile data (or behind strict routers) can't reach each other directly, so their
     data has to go through a relay ("TURN") server. PeerJS's own relays no longer answer, so put the
     free ExpressTURN account details here (expressturn.com, 1 TB a month free). Left empty, co-op
     still works for phones on the same Wi-Fi and on friendlier networks. */
  const TURN = { username: "000000002108000612", credential: "6rr7klTQzqEjYaTao22kW6qEVLg=" };
  const ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.expressturn.com:3478" },
    ...(TURN.username ? [{ urls: ["turn:relay1.expressturn.com:3478?transport=udp", "turn:relay1.expressturn.com:3478?transport=tcp", "turns:relay1.expressturn.com:443?transport=tcp"], ...TURN }] : []),
  ];
  // window.DL_PEER_CONFIG = { lib, peer } lets a local test point co-op at its own PeerJS server.
  const cfg = () => window.DL_PEER_CONFIG || { peer: { config: { iceServers: ICE } } };
  const LINK_FAILED = "Found your friend's room, but your devices couldn't link up. This happens most on mobile data: try both on the same Wi-Fi.";
  // Reports when the direct link between the two devices gives up (instead of waiting out a timer).
  function onLinkFail(c, fn) {
    const pc = c.peerConnection;
    if (!pc) return;
    pc.addEventListener("iceconnectionstatechange", () => { if (pc.iceConnectionState === "failed") fn(); });
  }
  const Net = (DL.Net = { role: null, code: null, peer: null, conn: null, connected: false, events: [], acc: 0, status: "" });

  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = cfg().lib || PEERJS;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Couldn't load the co-op library. Check your internet connection."));
      document.head.appendChild(s);
    });
  }
  function setStatus(msg) { Net.status = msg; if (DL.UI && DL.UI.coopStatus) DL.UI.coopStatus(msg); }
  function newCode() { let c = ""; for (let i = 0; i < 5; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; return c; }

  Net.send = function (msg) {
    if (Net.conn && Net.connected) { try { Net.conn.send(msg); } catch (e) { /* closed */ } }
  };
  Net.event = function (ev) { Net.events.push(ev); if (ev.t === "mined") Net.mined.add(ev.id); };
  Net.mined = new Set(); // what the guest broke, so it doesn't pop back before the host hears

  /* ---------------- host ---------------- */
  Net.host = async function () {
    Net.leave(true);
    setStatus("Opening a room…");
    try { await loadLib(); } catch (e) { setStatus(e.message); return false; }
    return new Promise((resolve) => {
      const tryOpen = (attempt) => {
        const code = newCode();
        const peer = new window.Peer(PREFIX + code, cfg().peer);
        peer.on("open", () => {
          Net.role = "host"; Net.code = code; Net.peer = peer;
          setStatus(`Room ${code} is open. Share the code with your friend.`);
          resolve(true);
        });
        peer.on("connection", (c) => {
          if (Net.conn && Net.connected) { c.on("open", () => { c.send({ t: "full" }); setTimeout(() => c.close(), 300); }); return; }
          Net.conn = c;
          c.on("open", () => { Net.connected = true; });
          onLinkFail(c, () => { if (!Net.connected) { say("A friend tried to join, but your devices couldn't link up. Try both on the same Wi-Fi.", "warn"); Net.conn = null; } });
          c.on("data", hostData);
          c.on("close", () => hostLost());
          c.on("error", () => hostLost());
        });
        peer.on("error", (err) => {
          if (err.type === "unavailable-id" && attempt < 3) { peer.destroy(); tryOpen(attempt + 1); return; }
          if (Net.role !== "host") { setStatus("Couldn't open a room: " + (err.message || err.type)); resolve(false); }
        });
        peer.on("disconnected", () => { if (Net.role === "host" && !peer.destroyed) peer.reconnect(); });
      };
      tryOpen(0);
    });
  };

  function hostLost() {
    if (!Net.conn) return;
    Net.conn = null;
    Net.connected = false;
    if (G.ally) say("Your friend left the game.", "warn");
    G.ally = null;
  }

  function hostData(m) {
    if (!m || !m.t) return;
    if (m.t === "hello") {
      G.ally = { x: 30, y: 70, tx: 30, ty: 70, angle: Math.PI / 2, moving: false, animT: 0, kit: DL.KITS[m.kit] ? m.kit : "lanternBlade",
        kitLevel: m.level || 1, stage: 1, hp: 100, maxHp: 100, down: false, swing: null, dashT: 0, proj: [] };
      const harvested = [];
      for (const c of DL.World.chunks.values()) for (const o of c.objects) if (o.harvested || o.dead || (o.maxHp && o.hp < o.maxHp)) harvested.push(objRow(o));
      Net.send({ t: "welcome", up: G.save.up, difficulty: G.save.difficulty, day: G.save.day, nights: G.save.nights, time: G.time, ob: harvested });
      say(`A friend joined as the ${DL.KITS[G.ally.kit].name} (Lv ${G.ally.kitLevel}).`, "good");
      DL.Sound.play("dawn");
    } else if (m.t === "state") {
      const a = G.ally;
      if (!a) return;
      const s = m.p;
      a.tx = s[0]; a.ty = s[1]; a.angle = s[2]; a.moving = !!s[3]; a.dashT = s[4]; a.stage = s[5]; a.hp = s[6]; a.maxHp = s[7]; a.down = !!s[8];
      a.swing = s[9] ? { ang: s[9][0], t: s[9][1], dur: 0.2, kind: s[9][2], range: s[9][3], arc: s[9][4], col: s[9][5], flip: !!s[9][6] } : null;
      a.cast = s[10] || 0;
      a.wisp = s[11] ? { x: s[11][0], y: s[11][1] } : null;
      a.proj = m.pr || [];
      for (const ev of m.ev || []) DL.Net.apply(ev);
    }
  }

  // The guest's actions, applied to the real world on the host.
  Net.apply = function (ev) {
    if (ev.t === "hit") {
      const e = G.enemies.find((x) => x.id === ev.id);
      if (e) G.hitEnemy(e, ev.dmg, ev.ang, ev.kb, ev.burn, true);
    } else if (ev.t === "stun" || ev.t === "slow") {
      const e = G.enemies.find((x) => x.id === ev.id);
      if (e) e[ev.t] = Math.max(e[ev.t] || 0, ev.v);
    } else if (ev.t === "zone") G.lightZones.push(ev.z);
    else if (ev.t === "wall") G.walls.push(ev.w);
    else if (ev.t === "torch") G.torches.push(ev.o);
    else if (ev.t === "mined") {
      const o = findObj(ev.id);
      if (o && !o.harvested) { o.harvested = true; G.dirty.add(o); }
      if (o && o.type === "pearl") G.pearls = G.pearls.filter((x) => x !== o);
    } else if (ev.t === "build") {
      const u = DL.UPGRADES.find((x) => x.id === ev.id);
      const ok = !!u && G.buyUpgrade(ev.id);
      Net.send({ t: "built", id: ev.id, ok, level: G.save.up[ev.id] });
      if (ok) say(`Your friend built ${u.name} level ${G.save.up[ev.id]}.`, "good");
    } else if (ev.t === "train") {
      // The friend's kit level is theirs; the price comes out of the shared stash.
      const L = ev.level, cost = DL.kitLevelCost(L), req = DL.kitLevelReq(L + 1);
      const ok = L < DL.KIT_MAX_LEVEL && Object.keys(req).every((k) => G.save.up[k] >= req[k]) && G.canAfford(cost);
      if (ok) { G.pay(cost); G.persist(); if (G.ally) G.ally.kitLevel = L + 1; say(`Your friend trained their kit to level ${L + 1}.`, "good"); }
      Net.send({ t: "trained", ok, level: ok ? L + 1 : L });
    } else if (ev.t === "craftTorch") {
      const ok = G.canAfford(DL.TORCH_COST);
      if (ok) { G.pay(DL.TORCH_COST); G.persist(); }
      Net.send({ t: "torchMade", ok });
    } else if (ev.t === "deposit") {
      const parts = [];
      for (const k of DL.RES_KEYS) if (ev.res[k] > 0) { G.save.stash[k] += ev.res[k]; parts.push(`${ev.res[k]} ${DL.RESOURCES[k].name}`); }
      if (parts.length) { G.persist(); say("Your friend stored: " + parts.join(", "), "good"); }
    }
  };

  Net.hurtAlly = function (dmg, ang) { Net.send({ t: "hurt", dmg, ang }); };

  function objRow(o) { return [o.id, o.harvested ? 1 : 0, o.dead ? 1 : 0, o.hp != null ? Math.round(o.hp) : -1]; }
  function findObj(id) {
    if (typeof id !== "string") return null;
    if (id.startsWith("pearl")) return G.pearls.find((p) => p.id === id) || null;
    const [cx, cy] = id.split(",").map(Number);
    return DL.World.chunk(cx, cy).objects.find((o) => o.id === id) || null;
  }

  function snapshot() {
    const p = G.player, sw = p.swing, a = G.ally;
    const dirty = [...G.dirty].map(objRow);
    G.dirty.clear();
    // Only what's near the friend: keeps snapshots small when the two of you are far apart.
    const near = (x, y, R) => Math.abs(x - a.x) < R && Math.abs(y - a.y) < R;
    return {
      t: "snap", time: r1(G.time), day: G.save.day, nights: G.save.nights, up: G.save.up, state: G.state,
      flame: [Math.round(G.flame.hp), G.flame.max, G.flame.lit ? 1 : 0],
      stash: G.save.stash,
      host: [r1(p.x), r1(p.y), r1(p.angle), p.moving ? 1 : 0, r1(p.dashT), p.stage, Math.round(p.hp), G.stats().maxHp, G.save.kit, G.save.kitLevel,
        sw ? [r1(sw.ang), r1(sw.t), sw.kind, Math.round(sw.range), r1(sw.arc || 1), sw.col, sw.flip ? 1 : 0] : 0, G.state === "dying" || G.state === "dead" ? 1 : 0, castK(p), wispK()],
      en: G.enemies.filter((e) => near(e.x, e.y, 1100)).map((e) => [e.id, TYPES.indexOf(e.type), r1(e.x), r1(e.y), r1(e.angle), e.state === "windup" ? 1 : e.state === "recover" ? 2 : 0,
        r1(e.stT), r1(e.aim || 0), Math.round(e.hp), Math.round(e.maxHp), r1(e.rise), e.moving ? 1 : 0, e.dormant ? 1 : 0, r1(e.burn || 0)]),
      pr: G.projectiles.filter((b) => near(b.x, b.y, 900)).map((b) => [r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.kind, b.col, b.hostile ? 1 : 0]),
      to: G.torches.map((o) => [r1(o.x), r1(o.y), r1(o.t), o.max, Math.round(o.r), o.type, Math.round(o.hp)]),
      lz: G.lightZones.map((z) => [r1(z.x), r1(z.y), Math.round(z.r), r1(z.t), z.heal ? 1 : 0, z.fire ? 1 : 0]),
      wa: G.walls.map((w) => [r1(w.x1), r1(w.y1), r1(w.x2), r1(w.y2), r1(w.t), w.max]),
      py: G.pylons.map((q) => [Math.round(q.hp), q.lit ? 1 : 0]),
      pk: G.pickups.filter((k) => near(k.x, k.y, 800)).map((k) => [k.id, r1(k.x), r1(k.y), k.res]),
      pe: G.pearls.filter((q) => near(q.x, q.y, 1000)).map((q) => [q.id, r1(q.x), r1(q.y), q.amount, q.zi]),
      tg: G.telegraphs.filter((q) => near(q.x, q.y, 900)).map((q) => [r1(q.x), r1(q.y), q.r, r1(q.t), q.delay]),
      hx: G.hexPools.filter((q) => near(q.x, q.y, 900)).map((q) => [r1(q.x), r1(q.y), q.r, r1(q.t), q.life]),
      ob: dirty,
    };
  }

  /* ---------------- guest ---------------- */
  // Co-op kit levels the guest earns while playing in someone else's world.
  const PROFILE = "drowned-light-coop";
  Net.profile = function () {
    try { return JSON.parse(localStorage.getItem(PROFILE)) || { levels: {} }; } catch (e) { return { levels: {} }; }
  };
  Net.saveProfile = function (pr) { try { localStorage.setItem(PROFILE, JSON.stringify(pr)); } catch (e) { /* ignore */ } };
  // The level a kit joins at: its co-op level, or the best level from any of your own save slots.
  Net.joinLevel = function (kit) {
    let best = Net.profile().levels[kit] || 1;
    for (const { save } of G.listSlots()) if (save && save.kit === kit) best = Math.max(best, save.kitLevel);
    return best;
  };

  Net.join = async function (code, kit) {
    Net.joinKit = DL.KITS[kit] ? kit : G.save.kit;
    code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5) { setStatus("Room codes are 5 letters and numbers."); return false; }
    Net.leave(true);
    setStatus("Connecting…");
    try { await loadLib(); } catch (e) { setStatus(e.message); return false; }
    return new Promise((resolve) => {
      const peer = new window.Peer(cfg().peer);
      Net.peer = peer;
      const fail = (msg) => { setStatus(msg); Net.leave(true); resolve(false); };
      let reached = false; // the room answered, so the code was right
      const timer = setTimeout(() => fail(reached ? LINK_FAILED : "No answer from that room. Check the code, and that your friend's game is open."), 25000);
      peer.on("error", (err) => {
        // Once in, the PeerJS server is no longer needed: a phone briefly losing it (screen off, switching
        // networks) must not end the game. Only the link between the two devices closing does that.
        if (Net.role === "guest") return;
        clearTimeout(timer);
        fail(err.type === "peer-unavailable" ? "No room with that code is open." : "Couldn't connect: " + (err.message || err.type));
      });
      peer.on("open", () => {
        const c = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
        Net.conn = c;
        onLinkFail(c, () => { if (Net.role === "guest") return guestLost(); clearTimeout(timer); fail(LINK_FAILED); });
        if (c.peerConnection) c.peerConnection.addEventListener("signalingstatechange", () => { if (c.peerConnection.signalingState === "stable") reached = true; });
        c.on("open", () => {
          Net.connected = true;
          Net.send({ t: "hello", kit: Net.joinKit, level: Net.joinLevel(Net.joinKit) });
        });
        c.on("data", (m) => {
          if (m && m.t === "full") { clearTimeout(timer); fail("That room already has two players."); return; }
          if (m && m.t === "welcome") { clearTimeout(timer); Net.role = "guest"; Net.code = code; startGuest(m); resolve(true); return; }
          guestData(m);
        });
        c.on("close", () => guestLost());
        c.on("error", () => guestLost());
      });
    });
  };

  function startGuest(w) {
    // Play inside the host's world: their camp, difficulty and day. Your own save is never written.
    G.save.up = w.up;
    G.save.kit = Net.joinKit;
    G.save.kitLevel = Net.joinLevel(Net.joinKit);
    G.save.difficulty = w.difficulty;
    G.save.day = w.day;
    G.save.nights = w.nights;
    DL.World.chunks.clear();
    G.startLife();
    G.time = w.time;
    G.player.x = 30;
    G.ally = { x: 0, y: 70, tx: 0, ty: 70, angle: Math.PI / 2, moving: false, animT: 0, kit: "lanternBlade", kitLevel: 1, stage: 1, hp: 100, maxHp: 100, down: false, swing: null, dashT: 0, proj: [] };
    applyObjs(w.ob);
    setStatus("");
    DL.UI.hideScreens();
    DL.UI.showHud(true);
    DL.Sound.init();
    say("You joined your friend's world. Their camp is your camp tonight.", "good");
  }

  function guestLost() {
    if (Net.role !== "guest") return;
    say("The connection to your friend was lost.", "danger");
    Net.leave(true);
    DL.UI.toTitle();
  }

  function applyObjs(rows) {
    for (const [id, h, d, hp] of rows || []) {
      const o = findObj(id);
      if (!o) continue;
      o.harvested = !!h; o.dead = !!d;
      if (hp >= 0 && o.maxHp) o.hp = hp;
    }
  }

  function guestData(m) {
    if (!m) return;
    if (m.t === "hurt") G.hurtPlayer(m.dmg, m.ang);
    else if (m.t === "gain") {
      const p = G.player;
      p.carried[m.res] += m.amt;
      G.text(p.x, p.y - 70, `+${m.amt} ${DL.RESOURCES[m.res].name}`, DL.RESOURCES[m.res].color);
      DL.Sound.play("pickup");
    } else if (m.t === "built") {
      if (!m.ok) say("Couldn't build that — not enough in the stash, or it isn't unlocked yet.", "warn");
      if (DL.UI.refreshCamp) DL.UI.refreshCamp();
    } else if (m.t === "trained") {
      if (m.ok) {
        G.save.kitLevel = m.level;
        const pr = Net.profile();
        pr.levels[G.save.kit] = m.level;
        Net.saveProfile(pr);
        DL.Kits.levelUpFx(m.level);
      } else say("Couldn't train — check the stash and the camp requirements.", "warn");
      if (DL.UI.refreshCamp) DL.UI.refreshCamp();
    } else if (m.t === "torchMade") {
      if (m.ok) { G.save.torches += 1; DL.Sound.play("torch"); } else say("Not enough in the stash for a torch.", "warn");
      if (DL.UI.refreshCamp) DL.UI.refreshCamp();
    } else if (m.t === "snap") applySnap(m);
  }

  function applySnap(m) {
    if (m.day !== G.save.day) { G.save.day = m.day; DL.World.resetDay(); }
    G.save.nights = m.nights;
    G.save.stash = m.stash;
    const layoutChanged = JSON.stringify(m.up) !== JSON.stringify(G.save.up);
    G.save.up = m.up;
    if (layoutChanged) G.resetPylons();
    G.time = m.time;
    G.hostState = m.state;
    G.flame.hp = m.flame[0]; G.flame.max = m.flame[1]; G.flame.lit = !!m.flame[2];

    // the host's knight
    const h = m.host, a = G.ally;
    a.tx = h[0]; a.ty = h[1]; a.angle = h[2]; a.moving = !!h[3]; a.dashT = h[4]; a.stage = h[5]; a.hp = h[6]; a.maxHp = h[7];
    a.kit = h[8]; a.kitLevel = h[9];
    a.swing = h[10] ? { ang: h[10][0], t: h[10][1], dur: 0.2, kind: h[10][2], range: h[10][3], arc: h[10][4], col: h[10][5], flip: !!h[10][6] } : null;
    a.down = !!h[11];
    a.cast = h[12] || 0;
    a.wisp = h[13] ? { x: h[13][0], y: h[13][1] } : null;

    // the Drowned: update puppets in place so animation and smoothing carry on
    const byId = new Map(G.enemies.map((e) => [e.id, e]));
    const next = [];
    for (const r of m.en) {
      let e = byId.get(r[0]);
      if (!e) {
        e = G.makeEnemy(TYPES[r[1]], r[2], r[3], 1);
        e.id = r[0];
      }
      byId.delete(r[0]);
      e.tx = r[2]; e.ty = r[3]; e.angle = r[4];
      e.state = r[5] === 1 ? "windup" : r[5] === 2 ? "recover" : "move";
      e.stT = r[6]; e.aim = r[7]; e.hp = r[8]; e.maxHp = r[9]; e.rise = r[10]; e.moving = !!r[11]; e.dormant = !!r[12]; e.burn = r[13];
      next.push(e);
    }
    for (const gone of byId.values()) G.effects.push({ type: "dissolve", e: gone, t: 0, max: 0.6 });
    G.enemies = next;

    // world lights and objects
    G.netProjectiles = m.pr.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], kind: b[4], col: b[5], hostile: !!b[6] }));
    G.torches = m.to.map((o) => ({ x: o[0], y: o[1], t: o[2], max: o[3], r: o[4], type: o[5], hp: o[6], rad: 8 }));
    G.lightZones = m.lz.map((z) => ({ x: z[0], y: z[1], r: z[2], t: z[3], heal: !!z[4], fire: !!z[5], net: 1 }));
    G.walls = m.wa.map((w) => ({ x1: w[0], y1: w[1], x2: w[2], y2: w[3], t: w[4], max: w[5], dps: 0, net: 1 }));
    m.py.forEach((q, i) => { if (G.pylons[i]) { G.pylons[i].hp = q[0]; G.pylons[i].lit = !!q[1]; } });
    G.pickups = m.pk.map((k) => ({ id: k[0], x: k[1], y: k[2], res: k[3], t: 1, vx: 0, vy: 0 }));
    // Keep the same amethyst objects between snapshots so hits on them add up (they take two).
    const pearlById = new Map(G.pearls.map((q) => [q.id, q]));
    G.pearls = m.pe.map((q) => Object.assign(pearlById.get(q[0]) || { id: q[0], type: "pearl", def: DL.OBJ.pearl, harvested: false }, { x: q[1], y: q[2], amount: q[3], zi: q[4] }))
      .filter((q) => !q.harvested && !Net.mined.has(q.id));
    G.telegraphs = m.tg.map((q) => ({ x: q[0], y: q[1], r: q[2], t: q[3], delay: q[4], done: true }));
    G.hexPools = (m.hx || []).map((q) => ({ x: q[0], y: q[1], r: q[2], t: q[3], life: q[4] }));
    applyObjs(m.ob);
  }

  // Guest side: smooth the host's knight and the Drowned toward their last known positions.
  Net.smooth = function (dt) {
    const k = 1 - Math.pow(0.0004, dt);
    for (const e of G.enemies) {
      if (e.tx == null) continue;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt);
    }
  };

  // Lights, walls and torches the guest makes become the host's; the guest sees them come back in the next snapshot.
  function forwardGuestCreations() {
    for (const z of G.lightZones) if (!z.net) { Net.event({ t: "zone", z: { x: z.x, y: z.y, r: z.r, t: z.t, heal: z.heal, fire: z.fire, dps: z.dps } }); z.net = 1; }
    for (const w of G.walls) if (!w.net) { Net.event({ t: "wall", w: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, t: w.t, max: w.max, dps: w.dps } }); w.net = 1; }
    for (const o of G.torches) if (!o.net) { Net.event({ t: "torch", o: { type: o.type, x: o.x, y: o.y, t: o.t, max: o.max, r: o.r, hp: o.hp, rad: o.rad } }); o.net = 1; }
    for (const e of G.enemies) {
      if (e.stun > (e.sentStun || 0) + 0.05) { Net.event({ t: "stun", id: e.id, v: e.stun }); e.sentStun = e.stun; }
      if (e.slow > (e.sentSlow || 0) + 0.05) { Net.event({ t: "slow", id: e.id, v: e.slow }); e.sentSlow = e.slow; }
    }
  }

  function guestState() {
    const p = G.player, sw = p.swing;
    return {
      t: "state",
      p: [r1(p.x), r1(p.y), r1(sw ? sw.ang : p.angle), p.moving ? 1 : 0, r1(p.dashT), p.stage, Math.round(Math.max(0, p.hp)), G.stats().maxHp, p.downT > 0 ? 1 : 0,
        sw ? [r1(sw.ang), r1(sw.t), sw.kind, Math.round(sw.range), r1(sw.arc || 1), sw.col, sw.flip ? 1 : 0] : 0, castK(p), wispK()],
      pr: G.projectiles.slice(0, 24).map((b) => [r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.kind, b.col]),
      ev: Net.events.splice(0),
    };
  }

  /* ---------------- every frame ---------------- */
  Net.tick = function (dt) {
    // The friend's knight glides toward its reported position on either side.
    const a = G.ally;
    if (a) {
      const k = 1 - Math.pow(0.0004, dt);
      a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k;
      a.animT += dt;
      if (Math.hypot(a.tx - a.x, a.ty - a.y) > 300) { a.x = a.tx; a.y = a.ty; }
    }
    if (!Net.connected) return;
    Net.acc += dt;
    // Skip a beat when the link is backed up rather than let a queue (and the lag) build.
    const dc = Net.conn && Net.conn.dataChannel;
    if (dc && dc.bufferedAmount > 48 * 1024) return;
    if (Net.role === "host" && G.ally && Net.acc >= SNAP_EVERY) { Net.acc = 0; Net.send(snapshot()); }
    else if (Net.role === "guest" && Net.acc >= STATE_EVERY) { Net.acc = 0; forwardGuestCreations(); Net.send(guestState()); }
  };

  Net.leave = function (quiet) {
    const was = Net.role;
    try { if (Net.conn) Net.conn.close(); } catch (e) { /* ignore */ }
    try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* ignore */ }
    Object.assign(Net, { role: null, code: null, peer: null, conn: null, connected: false, events: [], acc: 0, mined: new Set() });
    G.ally = null;
    G.netProjectiles = null;
    if (was === "guest") { G.save = G.load(); DL.World.chunks.clear(); }
    if (!quiet && was) say("Co-op session ended.");
  };
})(window.DL);
