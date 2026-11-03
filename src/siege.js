/* Drowned Light — the Great Siege and the Starved Bell Tower. Every tenth night the Drowned march on all the
   Pyramid's squares, wherever the knights are (Robert, 2026-11-03; on other nights they only go for the square
   a knight stands in, Siege.openSquare). Every destroyed square lowers the Central Flame one level;
   when no squares remain they attack the camp itself. A flame at level zero is a lost world.
   The Starved Bell Tower, built from the slain Bell's clapper, tolls before every wave that comes for the camp,
   says where it's coming from, and leaves the wave dazed when it arrives. The host's device runs it all. */
"use strict";
(function (DL) {
  const { rand, TAU } = DL;
  const G = DL.Game, S = DL.SIEGE;
  const say = (m, k) => { if (DL.UI) DL.UI.toast(m, k); DL.Net.say(m, k); };
  const sfx = (n) => DL.Sound.play(n);
  const Siege = (DL.Siege = { on: false, fallen: false, waveT: 0, nextA: null, warned: false });

  const compass = (a) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  // Tonight's night number (the first night is 1), and whether it's a siege night.
  const nightNo = () => G.save.nights + 1;
  Siege.isSiegeNight = (n) => n % S.every === 0;
  // Nights to the next Great Siege: 0 = tonight.
  Siege.nightsLeft = () => (S.every - (nightNo() % S.every)) % S.every;
  Siege.line = function () {
    const n = Siege.nightsLeft();
    if (Siege.on) return "The Great Siege is upon every square. Every square lost lowers the Central Flame; level 0 loses the world.";
    return n === 0 ? "Tonight the Drowned march on all your squares: the Great Siege." : `The Great Siege comes every ${S.every}th night: ${n} night${n > 1 ? "s" : ""} from now.`;
  };

  Siege.reset = function () { Siege.on = false; Siege.fallen = false; Siege.nextA = null; Siege.warned = false; };

  Siege.nightfall = function () {
    if (G.isGuest() || G.cave || !Siege.isSiegeNight(nightNo())) return;
    Siege.on = true;
    Siege.fallen = false;
    Siege.waveT = S.first;
    Siege.warned = false;
    Siege.nextA = rand(0, TAU);
    sfx("toll");
    for (const o of G.outposts) o.siegeT = 0;
    say("THE GREAT SIEGE. The Drowned march on every square! Each square lost lowers the Central Flame.", "danger");
  };
  Siege.dawn = function () {
    if (!Siege.on) return;
    Siege.on = false;
    if (!Siege.fallen) say("Dawn breaks over the Pyramid. The Great Siege is broken!", "good");
    Siege.fallen = false;
  };
  // A day dawning tomorrow on the eve of a siege: a warning.
  Siege.morning = function () {
    if (!G.isGuest() && Siege.nightsLeft() === 0) setTimeout(() => say("The Drowned gather in the deep. Tonight they will march on all your squares.", "warn"), 2600);
  };

  /* ---------------- waves ---------------- */
  // The bell's toll before a wave: where it'll come from. `a` = the angle from the camp.
  function toll(a) {
    if (!G.save.up.bell) return;
    sfx("toll");
    say(`The Bell Tower tolls: Drowned coming from the ${compass(a)}!`, "warn");
    G.effects.push({ type: "bellToll", x: 0, y: 0, t: 0, max: 1.4, a });
  }
  Siege.tollFor = toll;
  // A wave arriving after the bell warned of it comes in dazed.
  const daze = (list) => { if (G.save.up.bell) for (const e of list) e.stun = Math.max(e.stun || 0, S.daze); };
  Siege.daze = daze;

  /* An ordinary camp wave (a knight near the camp at night, src/game.js) spends `t` seconds counting down:
     with the Bell Tower built, it tolls `warn` seconds before. Returns the angle the wave will come from. */
  Siege.campTick = function (t) {
    if (Siege.nextA == null) Siege.nextA = rand(0, TAU);
    if (t <= S.warn && !Siege.warned) { Siege.warned = true; toll(Siege.nextA); }
    return Siege.nextA;
  };
  Siege.campSpawned = function (list) {
    daze(list);
    Siege.nextA = rand(0, TAU);
    Siege.warned = false;
  };

  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const openSides = (o) => SIDES.filter(([dx, dy]) => !DL.Pyramid.has(o.gx + dx, o.gy + dy));
  // Every held square is a target of the Great Siege.
  Siege.targets = () => G.outposts.filter((o) => o.lit && DL.Pyramid.has(o.gx, o.gy));
  /* Off siege nights the Drowned leave the squares alone unless a knight is in one: only that square's fire and
     lamps draw them (src/game.js goalValid / nearestLightTarget). */
  Siege.openSquare = function (q) {
    if (Siege.on) return true;
    const c = DL.Pyramid.cell(q.x, q.y);
    return G.knights().some((k) => { const s = DL.Pyramid.cell(k.x, k.y); return s.gx === c.gx && s.gy === c.gy; });
  };
  // This wave's targets: the squares attacked longest ago (all of them in turn), up to `groups` at once.
  Siege.pick = function () {
    const targets = Siege.targets();
    if (!targets.length) return [];
    return targets.sort((p, q) => (p.siegeT || 0) - (q.siegeT || 0) || DL.dist(0, 0, q.x, q.y) - DL.dist(0, 0, p.x, p.y)).slice(0, S.groups);
  };
  // Approach a square across an open (unheld) edge facing out from the camp if it has one, else straight outward.
  function approach(target) {
    const ux = target.x, uy = target.y, open = openSides(target);
    const [dx, dy] = open.length ? open.reduce((best, side) => side[0] * ux + side[1] * uy > best[0] * ux + best[1] * uy ? side : best) : [ux, uy];
    return { target, a: Math.atan2(dy, dx), radius: DL.MAP.cell / 2 + S.spawnGap };
  }

  Siege.update = function (dt) {
    if (!Siege.on || G.isGuest() || G.cave || Siege.fallen) return;
    Siege.waveT -= dt;
    if (Siege.waveT <= S.warn && !Siege.warned) { Siege.warned = true; toll(Siege.nextA); }
    if (Siege.waveT > 0) return;
    Siege.waveT = S.waveEvery;
    Siege.warned = false;
    const zi = S.zone(nightNo()), D = G.diff();
    const n = Math.round((3 + Math.floor(G.save.day * 1.3)) * S.size * D.spawn * G.partyScale());
    const all = [], picks = Siege.pick(), stamp = (Siege.stamp = (Siege.stamp || 0) + 1);
    if (!picks.length) { // no squares held: the camp itself
      for (let s = 0; s < S.sides; s++) all.push(...G.spawnWave(G.flame.x, G.flame.y, DL.campPool(G.save.day), Math.ceil(n / S.sides), G.flame, DL.WALL_R + S.spawnGap, zi, Siege.nextA + (s * TAU) / S.sides));
    }
    for (const target of picks) {
      const wave = approach(target);
      target.siegeT = stamp;
      all.push(...G.spawnWave(target.x, target.y, DL.campPool(G.save.day), Math.ceil(n / picks.length), target, wave.radius, zi, wave.a));
    }
    daze(all);
    Siege.nextA = rand(0, TAU);
  };

  // Recompute the central fire after losing a square or one level of the camp's fire.
  Siege.levelLost = function () {
    if (G.isGuest()) return;
    const st = G.stats();
    G.flame.max = st.flameHp;
    G.flame.hp = Math.min(G.flame.hp, st.flameHp);
    if (G.save.up.flame > 0) {
      say(`The Central Flame falls to level ${G.save.up.flame}.`, "danger");
      return;
    }
    G.flame.hp = 0; G.flame.lit = false;
    if (Siege.fallen) return;
    Siege.fallen = true;
    Siege.on = false;
    say("The Central Flame has fallen to level 0. Your camp is lost.", "danger");
    if (S.gameOver) G.campFallen();
  };

  // Without outer land the camp still has to be defended. A real snuff costs one level, not the whole world.
  Siege.flameOut = function () {
    if (G.isGuest() || !Siege.on || Siege.fallen || G.flame.lit) return false;
    G.save.up.flame = Math.max(0, G.save.up.flame - 1);
    Siege.levelLost();
    if (G.save.up.flame > 0) {
      G.flame.lit = true;
      G.flame.hp = G.flame.max;
    }
    G.persist();
    return true;
  };
})(window.DL);

