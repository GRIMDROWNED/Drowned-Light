/* Drowned Light — the Great Siege and the Starved Bell Tower. Every tenth night the Drowned march on the camp
   itself, wherever the knights are: waves pour in from two sides all night, and if the Central Flame goes out
   the camp has fallen. (While the game is in development a fallen camp only says so: DL.SIEGE.gameOver.)
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
    if (Siege.on) return "The Great Siege is upon the camp. Keep the Central Flame burning until dawn.";
    return n === 0 ? "Tonight the Drowned march on the camp: the Great Siege." : `The Great Siege comes every ${S.every}th night: ${n} night${n > 1 ? "s" : ""} from now.`;
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
    say("THE GREAT SIEGE. The Drowned march on your camp from every side!", "danger");
  };
  Siege.dawn = function () {
    if (!Siege.on) return;
    Siege.on = false;
    if (!Siege.fallen) say("Dawn breaks over the camp. The Great Siege is broken!", "good");
    Siege.fallen = false;
  };
  // A day dawning tomorrow on the eve of a siege: a warning.
  Siege.morning = function () {
    if (!G.isGuest() && Siege.nightsLeft() === 0) setTimeout(() => say("The Drowned gather in the deep. Tonight they will march on your camp.", "warn"), 2600);
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

  Siege.update = function (dt) {
    if (!Siege.on || G.isGuest() || G.cave || Siege.fallen) return;
    Siege.waveT -= dt;
    if (Siege.waveT <= S.warn && !Siege.warned) { Siege.warned = true; toll(Siege.nextA); }
    if (Siege.waveT > 0) return;
    Siege.waveT = S.waveEvery;
    Siege.warned = false;
    const zi = S.zone(nightNo()), D = G.diff();
    const n = Math.round((3 + Math.floor(G.save.day * 1.3)) * S.size * D.spawn * G.partyScale());
    const all = [];
    for (let s = 0; s < S.sides; s++) {
      const a = Siege.nextA + (s * TAU) / S.sides;
      all.push(...G.spawnWave(0, 0, DL.campPool(G.save.day), Math.ceil(n / S.sides), G.flame, DL.WALL_R + 300, zi, a));
    }
    daze(all);
    Siege.nextA = rand(0, TAU);
  };

  // The Central Flame went out (src/game.js). On a siege night that is the camp fallen.
  Siege.flameOut = function () {
    if (!Siege.on || Siege.fallen) return false;
    Siege.fallen = true;
    if (S.gameOver) {
      say("The Central Flame is drowned. Your camp has fallen.", "danger");
      setTimeout(() => G.campFallen && G.campFallen(), 1500);
    } else {
      say("Your camp has fallen! (While the game is in development, a fallen camp doesn't end your game.)", "danger");
    }
    return true;
  };
})(window.DL);
