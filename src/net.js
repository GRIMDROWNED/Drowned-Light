/* Drowned Light — online co-op for up to four (PeerJS).
   The host's device runs the world: the Drowned, day and night, the camp and its stash.
   Each guest's device runs only that guest's own knight (with its own kit and level) and
   sends what it does — hits, mined nodes, lights it raises, supplies it deposits — to the host.
   The host sends each guest a snapshot of the world about 15 times a second, including every
   other knight; all sides smooth the gaps. Guests only talk to the host, never to each other.

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
  const MAX_GUESTS = 3; // four knights in all
  const swingRow = (sw) => (sw ? [r1(sw.ang), r1(sw.t), sw.kind, Math.round(sw.range), r1(sw.arc || 1), sw.col, sw.flip ? 1 : 0] : 0);
  // One knight as sent over the link: [x, y, angle, moving, dash, stage, hp, maxHp, down, swing, cast, wisp, kit, kitLevel].
  function applyKnight(a, s) {
    a.tx = s[0]; a.ty = s[1]; a.angle = s[2]; a.moving = !!s[3]; a.dashT = s[4]; a.stage = s[5]; a.hp = s[6]; a.maxHp = s[7]; a.down = !!s[8];
    a.swing = s[9] ? { ang: s[9][0], t: s[9][1], dur: 0.2, kind: s[9][2], range: s[9][3], arc: s[9][4], col: s[9][5], flip: !!s[9][6] } : null;
    a.cast = s[10] || 0;
    a.wisp = s[11] ? { x: s[11][0], y: s[11][1] } : null;
    if (s[12] && DL.KITS[s[12]]) a.kit = s[12];
    if (s[13]) a.kitLevel = s[13];
  }
  const newAlly = (id, kit, level, x, label) => ({ id, label, x, y: 70, tx: x, ty: 70, angle: Math.PI / 2, moving: false, animT: 0,
    kit: DL.KITS[kit] ? kit : "lanternBlade", kitLevel: level || 1, stage: 1, hp: 100, maxHp: 100, down: false, swing: null, dashT: 0, proj: [] });
  const kitLabel = (kit) => (DL.KITS[kit] ? DL.KITS[kit].name : "Friend");

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
  // Both sides must run the same build: an update changes what the messages carry.
  const VERSION = ((document.querySelector(".version") || {}).textContent || "").replace(/[^0-9.]/g, "");
  const updateMsg = (theirs) => `Your friend's game is on ${theirs ? "version " + theirs : "an older version"} and yours is on ${VERSION}. Both of you close and reopen the game to update, then try again.`;
  const LINK_FAILED = "Found your friend's room, but your devices couldn't link up. This happens most on mobile data: try both on the same Wi-Fi.";
  // Reports when the direct link between the two devices gives up (instead of waiting out a timer).
  function onLinkFail(c, fn) {
    const pc = c.peerConnection;
    if (!pc) return;
    pc.addEventListener("iceconnectionstatechange", () => { if (pc.iceConnectionState === "failed") fn(); });
  }
  // conn/connected: the guest's link to the host. guests: the host's links, one per friend.
  const Net = (DL.Net = { role: null, code: null, peer: null, conn: null, connected: false, guests: [], events: [], acc: 0, status: "" });

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

  // PeerJS refuses any message over about 16 KB and reports it as a broken link, which dropped
  // friends (a long-played world's join message, a crowded night's snapshot). Big ones go in pieces.
  const WHOLE = 12000, PIECE = 6000;
  function wireSend(c, msg) {
    const s = JSON.stringify(msg);
    if (s.length <= WHOLE) { c.send(msg); return; }
    for (let i = 0; i < s.length; i += PIECE) c.send({ t: "part", d: s.slice(i, i + PIECE), end: i + PIECE >= s.length ? 1 : 0 });
  }
  function wireRecv(c, m, fn) {
    if (!m || m.t !== "part") { fn(m); return; }
    c.dlBuf = (c.dlBuf || "") + m.d;
    if (!m.end) return;
    const s = c.dlBuf;
    c.dlBuf = "";
    let whole = null;
    try { whole = JSON.parse(s); } catch (e) { return; }
    fn(whole);
  }
  // Only a real break ends the link: a message PeerJS turned down is not one.
  const fatal = (err) => !err || err.type !== "message-too-big";

  Net.send = function (msg) {
    if (Net.conn && Net.connected) { try { wireSend(Net.conn, msg); } catch (e) { /* closed */ } }
  };
  Net.event = function (ev) { Net.events.push(ev); };

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
          if (Net.guests.length >= MAX_GUESTS) { c.on("open", () => { c.send({ t: "full" }); setTimeout(() => c.close(), 300); }); return; }
          // the lowest free number, so names and spots stay steady as friends come and go
          let id = 1;
          while (Net.guests.some((x) => x.id === id)) id++;
          const g = { id, conn: c, open: false, ally: null };
          Net.guests.push(g);
          c.on("open", () => { g.open = true; });
          onLinkFail(c, () => { if (!g.open) say("A friend tried to join, but your devices couldn't link up. Try both on the same Wi-Fi.", "warn"); hostLost(g); });
          c.on("data", (m) => wireRecv(c, m, (x) => hostData(g, x)));
          c.on("close", () => hostLost(g));
          c.on("error", (err) => { if (fatal(err)) hostLost(g); });
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

  function sendTo(g, msg) {
    if (g && g.open) { try { wireSend(g.conn, msg); } catch (e) { /* closed */ } }
  }

  function hostLost(g) {
    if (!Net.guests.includes(g)) return;
    Net.guests = Net.guests.filter((x) => x !== g);
    try { g.conn.close(); } catch (e) { /* ignore */ }
    if (g.ally) {
      G.allies = G.allies.filter((a) => a !== g.ally);
      say(`The ${g.ally.label} left the game.`, "warn");
    }
  }

  // Host: remove a friend from the game. They're told why, then the link closes.
  Net.kick = function (id) {
    const g = Net.guests.find((x) => x.id === id);
    if (!g) return;
    sendTo(g, { t: "kicked" });
    const name = g.ally ? g.ally.label : "friend";
    g.ally && (G.allies = G.allies.filter((a) => a !== g.ally));
    g.ally = null; // so hostLost doesn't announce it as leaving
    setTimeout(() => hostLost(g), 300);
    say(`You removed the ${name} from the game.`, "warn");
  };

  function hostData(g, m) {
    if (!m || !m.t) return;
    if (m.t === "hello") {
      if (g.ally) return;
      if (m.v !== VERSION) {
        sendTo(g, { t: "version", v: VERSION });
        say(`A friend tried to join on ${m.v ? "version " + m.v : "an older version"}. You're on ${VERSION}: both of you close and reopen the game to update.`, "warn");
        setTimeout(() => hostLost(g), 300);
        return;
      }
      const a = (g.ally = newAlly(g.id, m.kit, m.level, 30 * g.id, ""));
      a.label = kitLabel(a.kit);
      a.g = g;
      G.allies.push(a);
      if (m.hound) DL.Hounds.join(g.id); // a friend who won a Bone Hound brings it along
      if (m.golem) DL.Golems.give(g.id); // they won Derek in a Hollow before: he comes along
      if (m.kindle) DL.Kindle.join(g.id); // and one who lit their Kindle, theirs
      const harvested = [];
      for (const c of DL.World.chunks.values()) for (const o of c.objects) if (o.harvested || o.dead || (o.maxHp && o.hp < o.maxHp)) harvested.push(objRow(o));
      sendTo(g, { t: "welcome", v: VERSION, id: g.id, up: G.save.up, difficulty: G.save.difficulty, day: G.save.day, nights: G.save.nights, time: G.time, ob: harvested });
      say(`A friend joined as the ${a.label} (Lv ${a.kitLevel}).`, "good");
      DL.Sound.play("dawn");
    } else if (m.t === "state") {
      const a = g.ally;
      if (!a) return;
      applyKnight(a, m.p);
      a.label = kitLabel(a.kit);
      a.proj = m.pr || [];
      for (const ev of m.ev || []) DL.Net.apply(ev, g);
    }
  }

  // A guest's actions, applied to the real world on the host.
  Net.apply = function (ev, g) {
    const who = g && g.ally ? "The " + g.ally.label : "Your friend";
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
    } else if (ev.t === "build") {
      const u = DL.UPGRADES.find((x) => x.id === ev.id);
      const ok = !!u && G.buyUpgrade(ev.id);
      sendTo(g, { t: "built", id: ev.id, ok, level: G.save.up[ev.id] });
      if (ok) say(`${who} built ${u.name} level ${G.save.up[ev.id]}.`, "good");
    } else if (ev.t === "train") {
      // The friend's kit level is theirs; the price comes out of the shared stash.
      const L = ev.level, cost = DL.kitLevelCost(L), req = DL.kitLevelReq(L + 1);
      const ok = L < DL.KIT_MAX_LEVEL && Object.keys(req).every((k) => G.save.up[k] >= req[k]) && G.canAfford(cost);
      if (ok) { G.pay(cost); G.persist(); if (g && g.ally) g.ally.kitLevel = L + 1; say(`${who} trained their kit to level ${L + 1}.`, "good"); }
      sendTo(g, { t: "trained", ok, level: ok ? L + 1 : L });
    } else if (ev.t === "craftTorch") {
      const ok = G.canAfford(DL.TORCH_COST);
      if (ok) { G.pay(DL.TORCH_COST); G.persist(); }
      sendTo(g, { t: "torchMade", ok });
    } else if (ev.t === "kindle") {
      // a friend fed their seventh torch to the broken lantern: their Kindle rises beside them
      DL.Kindle.join(g.id);
      if (g && g.ally) say(`${who} lit their Kindle.`, "good");
    } else if (ev.t === "deposit") {
      const parts = [];
      for (const k of DL.RES_KEYS) if (ev.res[k] > 0) { G.save.stash[k] += ev.res[k]; parts.push(`${ev.res[k]} ${DL.RESOURCES[k].name}`); }
      if (parts.length) { G.persist(); say(`${who} stored: ` + parts.join(", "), "good"); }
    }
  };

  // Host side: a blow or a pickup that lands on a friend's knight is sent to that friend's device.
  Net.hurtAlly = function (a, dmg, ang) { if (Net.role === "host") sendTo(a.g, { t: "hurt", dmg, ang }); };
  // Host: show a notice on every friend's screen too.
  Net.say = function (msg, kind) { if (Net.role === "host") for (const g of Net.guests) sendTo(g, { t: "say", m: msg, k: kind }); };
  Net.gain = function (a, res, amt) { if (Net.role === "host") sendTo(a.g, { t: "gain", res, amt }); };
  // Host: a notice for one friend only.
  Net.tell = function (id, msg, kind) { if (Net.role === "host") sendTo(Net.guests.find((g) => g.id === id), { t: "say", m: msg, k: kind }); };
  // Host: a friend carried a Bone Wolf's carcass into the camp and it rose as their hound.
  Net.houndMade = function (id) {
    const g = Net.guests.find((x) => x.id === id);
    sendTo(g, { t: "houndMade" });
    if (g && g.ally) say(`The ${g.ally.label} brought back a Bone Wolf. It rises as their Bone Hound.`, "good");
  };
  // Host: a message for one friend (by their co-op number).
  Net.sendTo = function (id, msg) { if (Net.role === "host") sendTo(Net.guests.find((g) => g.id === id), msg); };

  function objRow(o) { return [o.id, o.harvested ? 1 : 0, o.dead ? 1 : 0, o.hp != null ? Math.round(o.hp) : -1]; }
  function findObj(id) {
    if (typeof id !== "string") return null;
    const [cx, cy] = id.split(",").map(Number);
    return DL.World.chunk(cx, cy).objects.find((o) => o.id === id) || null;
  }

  function hostKnight() {
    const p = G.player;
    return [r1(p.x), r1(p.y), r1(p.angle), p.moving ? 1 : 0, r1(p.dashT), p.stage, Math.round(p.hp), G.stats().maxHp, G.state === "dying" || G.state === "dead" || p.downT > 0 ? 1 : 0,
      swingRow(p.swing), castK(p), wispK(), G.save.kit, G.save.kitLevel];
  }
  const allyKnight = (a) => [r1(a.x), r1(a.y), r1(a.angle), a.moving ? 1 : 0, r1(a.dashT), a.stage, Math.round(a.hp), a.maxHp, a.down ? 1 : 0,
    swingRow(a.swing), a.cast || 0, a.wisp ? [r1(a.wisp.x), r1(a.wisp.y)] : 0, a.kit, a.kitLevel];

  function snapshot(g, dirty) {
    const a = g.ally;
    // Only what's near this friend: keeps snapshots small when you're spread out.
    const near = (x, y, R) => Math.abs(x - a.x) < R && Math.abs(y - a.y) < R;
    return {
      t: "snap", time: r1(G.time), day: G.save.day, nights: G.save.nights, up: G.save.up, state: G.state,
      flame: [Math.round(G.flame.hp), G.flame.max, G.flame.lit ? 1 : 0],
      stash: G.save.stash,
      // every other knight: the host (id 0) and the other friends, with their bolts
      kn: [[0, "Host", hostKnight(), []], ...G.allies.filter((o) => o !== a).map((o) => [o.id, o.label, allyKnight(o), o.proj || []])],
      en: G.enemies.filter((e) => near(e.x, e.y, 1100)).map((e) => [e.id, TYPES.indexOf(e.type), r1(e.x), r1(e.y), r1(e.angle), e.state === "windup" ? 1 : e.state === "recover" ? 2 : 0,
        r1(e.stT), r1(e.aim || 0), Math.round(e.hp), Math.round(e.maxHp), r1(e.rise), e.moving ? 1 : 0, e.dormant ? 1 : 0, r1(e.burn || 0), r1(e.bleed || 0)]),
      pr: G.projectiles.filter((b) => near(b.x, b.y, 900)).map((b) => [r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.kind, b.col, b.hostile ? 1 : 0]),
      to: G.torches.map((o) => [r1(o.x), r1(o.y), r1(o.t), o.max, Math.round(o.r), o.type, Math.round(o.hp)]),
      lz: G.lightZones.map((z) => [r1(z.x), r1(z.y), Math.round(z.r), r1(z.t), z.heal ? 1 : 0, z.fire ? 1 : 0]),
      wa: G.walls.map((w) => [r1(w.x1), r1(w.y1), r1(w.x2), r1(w.y2), r1(w.t), w.max]),
      py: G.pylons.map((q) => [Math.round(q.hp), q.lit ? 1 : 0]),
      pk: G.pickups.filter((k) => near(k.x, k.y, 800)).map((k) => [k.id, r1(k.x), r1(k.y), k.res]),
      tg: G.telegraphs.filter((q) => near(q.x, q.y, 900)).map((q) => [r1(q.x), r1(q.y), q.r, r1(q.t), q.delay]),
      hx: G.hexPools.filter((q) => near(q.x, q.y, 900)).map((q) => [r1(q.x), r1(q.y), q.r, r1(q.t), q.life]),
      // Bone Hounds: [id, owner, x, y, angle, moving, hp, maxHp, biting, bite time left, hit flash, knocked out for]
      hd: G.hounds.filter((h) => near(h.x, h.y, 1100)).map((h) => [h.id, h.owner, r1(h.x), r1(h.y), r1(h.angle), h.moving ? 1 : 0, Math.round(h.hp), h.maxHp,
        h.state === "bite" ? 1 : 0, r1(h.stT), h.flash > 0 ? 1 : 0, r1(h.down || 0)]),
      // the Bone Wolf den: [pack broken, carcasses lying there, who hauls one]
      dn: DL.Den.row(),
      // Derek: [id, owner, x, y, angle, moving, casting, cast time left]; his walls: [id, owner, x, y, angle, length, hits left, age]
      gm: G.golems.filter((m) => near(m.x, m.y, 1100)).map((m) => [m.id, m.owner, r1(m.x), r1(m.y), r1(m.angle), m.moving ? 1 : 0, m.state === "cast" ? 1 : 0, r1(m.stT)]),
      sw: G.stoneWalls.filter((w) => near(w.x, w.y, 1100)).map((w) => [w.id, w.owner, r1(w.x), r1(w.y), r1(w.ang), w.len, w.hits, r1(w.t)]),
      cv: DL.Cave.snap(), // Derek's Hollow: [wave, fighting, seconds to the next wave, Drowned still to come]
      // Kindles, one per knight who lit theirs: [id, owner, x, y, angle, moving, angle he leads toward or null]
      kd: DL.Kindle.rows(),
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

  // A Bone Hound won in co-op, or in any of your own save slots, comes with you into a friend's world.
  Net.hasHound = () => !!Net.profile().hound || G.listSlots().some(({ save }) => save && save.hound);
  // The same for a Kindle you lit.
  Net.hasKindle = () => !!Net.profile().kindle || G.listSlots().some(({ save }) => save && save.kindle && save.kindle.lit);

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
          Net.send({ t: "hello", v: VERSION, kit: Net.joinKit, level: Net.joinLevel(Net.joinKit), hound: Net.hasHound() ? 1 : 0, golem: Net.profile().golem ? 1 : 0, kindle: Net.hasKindle() ? 1 : 0 });
        });
        c.on("data", (raw) => wireRecv(c, raw, (m) => {
          if (m && m.t === "full") { clearTimeout(timer); fail(`That room is full (${MAX_GUESTS + 1} players).`); return; }
          if (m && (m.t === "version" || (m.t === "welcome" && m.v !== VERSION))) { clearTimeout(timer); fail(updateMsg(m.v)); return; }
          if (m && m.t === "welcome") { clearTimeout(timer); Net.role = "guest"; Net.code = code; Net.myId = m.id; startGuest(m); resolve(true); return; }
          guestData(m);
        }));
        c.on("close", () => guestLost());
        c.on("error", (err) => { if (fatal(err)) guestLost(); });
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
    G.player.x = 30 * (w.id || 1);
    G.allies = [];
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
    if (m.t === "kicked") {
      Net.role = "kicked"; // so the link closing isn't reported as lost
      say("The host removed you from the game.", "danger");
      Net.leave(true);
      G.save = G.load(); DL.World.chunks.clear();
      DL.UI.toTitle();
    } else if (m.t === "say") say(m.m, m.k);
    else if (m.t === "hurt") G.hurtPlayer(m.dmg, m.ang);
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
    } else if (m.t === "houndMade") {
      const pr = Net.profile();
      pr.hound = 1;
      Net.saveProfile(pr);
      DL.Sound.play("growl");
      say("The carcass shudders, and the bones knit. A Bone Hound rises to hunt at your side.", "good");
      if (DL.UI.refreshCamp) DL.UI.refreshCamp();
    } else if (m.t === "cave" || m.t === "caveMend") DL.Cave.guestMsg(m);
    else if (m.t === "snap") applySnap(m);
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
    DL.Cave.applySnap(m.cv);

    // the host's knight and the other friends': keep the same objects so they glide and animate
    const known = new Map(G.allies.map((a) => [a.id, a]));
    G.allies = (m.kn || []).map(([id, label, row, proj]) => {
      let a = known.get(id);
      if (!a) { a = newAlly(id, row[12], row[13], row[0], label); a.x = row[0]; a.y = row[1]; }
      applyKnight(a, row);
      a.label = label;
      a.proj = proj;
      return a;
    });

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
      e.stT = r[6]; e.aim = r[7]; e.hp = r[8]; e.maxHp = r[9]; e.rise = r[10]; e.moving = !!r[11]; e.dormant = !!r[12]; e.burn = r[13]; e.bleed = r[14];
      next.push(e);
    }
    // a Bone Wolf leaves its carcass (sent with the den) instead of dissolving
    for (const gone of byId.values()) if (!gone.def.den) G.effects.push({ type: "dissolve", e: gone, t: 0, max: 0.6 });
    G.enemies = next;

    // world lights and objects
    G.netProjectiles = m.pr.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], kind: b[4], col: b[5], hostile: !!b[6] }));
    G.torches = m.to.map((o) => ({ x: o[0], y: o[1], t: o[2], max: o[3], r: o[4], type: o[5], hp: o[6], rad: 8, net: 1 }));
    G.lightZones = m.lz.map((z) => ({ x: z[0], y: z[1], r: z[2], t: z[3], heal: !!z[4], fire: !!z[5], net: 1 }));
    G.walls = m.wa.map((w) => ({ x1: w[0], y1: w[1], x2: w[2], y2: w[3], t: w[4], max: w[5], dps: 0, net: 1 }));
    m.py.forEach((q, i) => { if (G.pylons[i]) { G.pylons[i].hp = q[0]; G.pylons[i].lit = !!q[1]; } });
    G.pickups = m.pk.map((k) => ({ id: k[0], x: k[1], y: k[2], res: k[3], t: 1, vx: 0, vy: 0 }));
    G.telegraphs = m.tg.map((q) => ({ x: q[0], y: q[1], r: q[2], t: q[3], delay: q[4], done: true }));
    G.hexPools = (m.hx || []).map((q) => ({ x: q[0], y: q[1], r: q[2], t: q[3], life: q[4] }));
    // Bone Hounds: puppets kept between snapshots so they glide and run
    const hounds = new Map(G.hounds.map((h) => [h.id, h]));
    G.hounds = (m.hd || []).map((r) => {
      let h = hounds.get(r[0]);
      if (!h) h = { id: r[0], hound: true, x: r[2], y: r[3], animT: 0 };
      hounds.delete(r[0]);
      Object.assign(h, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], hp: r[6], maxHp: r[7], state: r[8] ? "bite" : "move", stT: r[9], flash: r[10] ? 0.1 : 0, down: r[11] || 0 });
      return h;
    });
    DL.Den.apply(m.dn);
    DL.Kindle.apply(m.kd);
    // Derek and his walls: a wall that appears rises with its dust, one that vanishes close by crumbles
    const golems = new Map(G.golems.map((o) => [o.id, o]));
    G.golems = (m.gm || []).map((r) => {
      const o = golems.get(r[0]) || { id: r[0], golem: true, x: r[2], y: r[3], animT: 0 };
      return Object.assign(o, { owner: r[1], tx: r[2], ty: r[3], angle: r[4], moving: !!r[5], state: r[6] ? "cast" : "move", stT: r[7] });
    });
    const walls = new Map(G.stoneWalls.map((w) => [w.id, w]));
    G.stoneWalls = (m.sw || []).map((r) => {
      let w = walls.get(r[0]);
      if (!w) { w = { id: r[0], stoneWall: true, rad: 10, hitT: 0 }; Object.assign(w, { x: r[2], y: r[3], ang: r[4], len: r[5] }); if (r[7] < 1) DL.Golems.raiseFx(w, G.golems.find((o) => o.owner === r[1])); }
      else if (r[6] < w.hits) w.hitT = 0.2;
      walls.delete(r[0]);
      return Object.assign(w, { owner: r[1], x: r[2], y: r[3], ang: r[4], len: r[5], hits: r[6], t: r[7] });
    });
    for (const w of walls.values()) if (Math.hypot(w.x - G.player.x, w.y - G.player.y) < 800) DL.Golems.crumbleFx(w);
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
    for (const h of G.hounds) {
      if (h.tx == null) continue;
      h.x += (h.tx - h.x) * k; h.y += (h.ty - h.y) * k;
      h.animT += dt;
    }
    for (const o of G.golems) {
      if (o.tx == null) continue;
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
      o.animT += dt;
      if (o.state === "cast") o.stT -= dt;
    }
    for (const w of G.stoneWalls) { w.t += dt; w.hitT = Math.max(0, w.hitT - dt); }
    DL.Kindle.guest(dt, k);
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
        swingRow(sw), castK(p), wispK(), G.save.kit, G.save.kitLevel],
      pr: G.projectiles.slice(0, 24).map((b) => [r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.kind, b.col]),
      ev: Net.events.splice(0),
    };
  }

  /* ---------------- every frame ---------------- */
  Net.tick = function (dt) {
    // The other knights glide toward their reported positions on every device.
    const k = 1 - Math.pow(0.0004, dt);
    for (const a of G.allies) {
      a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k;
      a.animT += dt;
      if (Math.hypot(a.tx - a.x, a.ty - a.y) > 300) { a.x = a.tx; a.y = a.ty; }
    }
    Net.acc += dt;
    // Skip a beat for a link that's backed up rather than let a queue (and the lag) build.
    const backed = (c) => c && c.dataChannel && c.dataChannel.bufferedAmount > 48 * 1024;
    if (Net.role === "host" && Net.acc >= SNAP_EVERY) {
      Net.acc = 0;
      // Changed objects go to every friend in the same beat, then the list is cleared.
      const dirty = [...G.dirty].map(objRow);
      G.dirty.clear();
      for (const g of Net.guests) if (g.open && g.ally && !backed(g.conn)) sendTo(g, snapshot(g, dirty));
    } else if (Net.role === "guest" && Net.connected && Net.acc >= STATE_EVERY && !backed(Net.conn)) {
      Net.acc = 0; forwardGuestCreations(); Net.send(guestState());
    }
  };

  Net.leave = function (quiet) {
    const was = Net.role;
    try { if (Net.conn) Net.conn.close(); } catch (e) { /* ignore */ }
    for (const g of Net.guests) { try { g.conn.close(); } catch (e) { /* ignore */ } }
    try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* ignore */ }
    Object.assign(Net, { role: null, code: null, peer: null, conn: null, connected: false, guests: [], events: [], acc: 0, mined: new Set(), myId: 0 });
    G.allies = [];
    G.netProjectiles = null;
    DL.Den.view = null;
    if (was === "guest") { G.save = G.load(); DL.World.chunks.clear(); }
    if (!quiet && was) say("Co-op session ended.");
  };
})(window.DL);
