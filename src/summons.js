/* Drowned Light — companion levels. The Bone Hound, Derek and Abigail each train from level 0 to 15 at camp
   (the Kit tab), five levels per level of their home: the Bone Kennel, Derek's Workshop and the Soul Shrine
   (DL.UPGRADES). Levels 5, 10 and 15 change a companion's form: a new look and a new power (DL.SUMMON).
   Levels belong to the world (the host's save), so every knight's companion in it shares them.
   Each form is drawn from its own sheet once Robert's art for it is in (src/sprites.js: boneHound_f0 and so on);
   until then the companion's usual sprite is scaled and tinted to tell the forms apart. */
"use strict";
(function (DL) {
  const G = DL.Game, S = DL.SUMMON;
  const say = (m, k) => DL.UI && DL.UI.toast(m, k);
  const sfx = (n) => DL.Sound.play(n);
  const Summons = (DL.Summons = {});
  Summons.KINDS = ["hound", "golem", "wraith", "fred"];

  Summons.level = (kind) => Math.max(0, Math.min(S.max, (G.save.summons && G.save.summons[kind]) || 0));
  Summons.form = (kind) => { const L = Summons.level(kind); return L >= 15 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0; };
  Summons.formName = (kind) => S[kind].forms[Summons.form(kind)];
  // Has anyone in this world won this companion? (Its home can't be built before.)
  Summons.anyHas = function (kind) {
    if (kind === "hound") return !!G.save.hound || G.hounds.length > 0;
    if (kind === "golem") return !!G.save.golem || G.golems.some((m) => !m.trial);
    if (kind === "fred") return !!G.save.fred || G.freds.length > 0;
    return !!G.save.abigail || G.wraiths.length > 0;
  };
  // The highest level its home allows.
  Summons.cap = (kind) => Math.min(S.max, S.perHome * (G.save.up[S[kind].home] || 0));

  /* ---------------- what each level gives ---------------- */
  // Bone Hound: health and bite from 70% (pup) to 160% (warg), on top of the Central Flame's growth.
  Summons.hound = function () {
    const L = Summons.level("hound"), f = Summons.form("hound");
    return {
      mult: 0.7 + 0.06 * L,
      lunge: f >= 1,            // the pup can't leap yet
      burn: f >= 2 ? 3 : 0,     // ember bites: fire damage per second for 2 s
      bleedMax: f >= 2 ? 5 : DL.HOUND.bleedMax,
      howl: f >= 3 ? 16 : 0,    // seconds between howls
      downTime: f >= 3 ? DL.HOUND.downTime / 2 : DL.HOUND.downTime,
      speed: DL.HOUND.speed * (0.92 + 0.012 * L),
    };
  };
  // Derek: walls come quicker, stand longer, take more blows; crystal walls cut, the bastion's burst.
  // (In Derek's Hollow, before he's won, he fights as a full Derek: `trial`.)
  Summons.golem = function (trial) {
    const L = trial ? Math.max(5, Summons.level("golem")) : Summons.level("golem"), f = L >= 15 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0;
    return {
      buildCd: Math.max(5.5, 11 - 0.32 * L),
      life: 14 + L,
      hits: [1, 2, 3, 4][f],
      maxWalls: [1, 2, 2, 3][f],
      len: Math.round(60 + 2.4 * L),
      shards: f >= 2 ? 8 : 0,   // damage to whatever strikes a crystal wall
      burst: f >= 3,            // a falling wall staggers the Drowned near it
    };
  };
  // Abigail: orbs from 60% to 180% sting; blessing from her second form; orbs leap on from her third; the wail at last.
  Summons.wraith = function () {
    const L = Summons.level("wraith"), f = Summons.form("wraith");
    return {
      dmgMult: 0.6 + 0.08 * L,
      cd: Math.max(1.1, 1.9 - 0.035 * L),
      bless: f >= 1,
      buff: f >= 3 ? 0.15 : DL.ABIGAIL.buff,
      curse: f >= 2 ? 0.15 : DL.ABIGAIL.curse,
      bounce: f >= 2 ? 1 : 0,
      wail: f >= 3 ? 22 : 0,    // seconds between wails
    };
  };

  /* Fred: his glob from 70% to 160% and quicker, his glowcaps a little stronger with each level; the rest comes
     from the roads chosen at levels 5, 10 and 15 (DL.FRED.roads): A, the Mender, or B, the Blight. */
  Summons.fredPath = () => (G.save.summons && G.save.summons.fredPath) || [null, null, null];
  Summons.fred = function () {
    const L = Summons.level("fred"), F = DL.FRED, p = Summons.fredPath(), bloom = p[0] === "A";
    return {
      mult: 0.7 + 0.06 * L,
      cd: Math.max(1.4, F.cd - 0.04 * L),
      capEvery: bloom ? F.bloomEvery : F.capEvery,
      capHeal: (bloom ? F.bloomHeal : F.capHeal) * (1 + 0.03 * L),
      cleanse: bloom ? F.bloomCleanse : 0,
      cloud: p[0] === "B",
      ring: p[1] === "A",
      mind: p[1] === "B",
      rebloom: p[2] === "A",
      storm: p[2] === "B",
    };
  };
  // Choosing a road ("0-A": level 5, the Mender's): once he has reached that level, and it isn't chosen yet.
  Summons.choose = function (arg) {
    if (G.isGuest()) { DL.Net.event({ t: "fredPath", arg }); return true; }
    return Summons.chooseHost(arg);
  };
  Summons.chooseHost = function (arg) {
    const [i, v] = String(arg).split("-"), n = +i, p = Summons.fredPath();
    if (!(n >= 0 && n < 3) || (v !== "A" && v !== "B") || p[n] || Summons.level("fred") < S.formAt[n + 1]) { sfx("deny"); return false; }
    p[n] = v;
    G.save.summons.fredPath = p;
    G.persist();
    sfx("milestone");
    say(`Fred takes the road of the ${v === "A" ? "Mender" : "Blight"}: ${DL.FRED.roads[n][v === "A" ? 0 : 1].name}.`, "good");
    Summons.changed("fred");
    return true;
  };
  // Choosing again, at a level 3 Toadstool Cottage: every road is forgotten, to be chosen anew.
  Summons.repickLock = function () {
    if ((G.save.up.toadstool || 0) < 3) return "Needs Toadstool Cottage 3";
    if (!Summons.fredPath().some((v) => v)) return "No road chosen yet";
    return null;
  };
  Summons.repick = function () {
    if (G.isGuest()) { DL.Net.event({ t: "fredRepick" }); return true; }
    return Summons.repickHost();
  };
  Summons.repickHost = function () {
    if (Summons.repickLock() || !G.canAfford(DL.FRED.repick)) { sfx("deny"); return false; }
    G.pay(DL.FRED.repick);
    G.save.summons.fredPath = [null, null, null];
    G.persist();
    sfx("build");
    say("Fred forgets his roads. Choose them again.", "good");
    return true;
  };

  /* ---------------- how each form looks ---------------- */
  // Until each form's drawing is in: the usual sprite scaled, tinted and glowing. `key` is the sheet to draw.
  const LOOKS = {
    hound: [
      { scale: 0.74, flash: 0.28, flashColor: "#d8d0bc" },             // Bone Pup: small and pale
      { scale: 1 },                                                    // Bone Hound
      { scale: 1.12, flash: 0.2, flashColor: "#ff6a20", ember: "255,120,40" },  // Ember Hound
      { scale: 1.26, flash: 0.26, flashColor: "#3b2a55", ember: "150,110,255" }, // Grave Warg
    ],
    golem: [
      { scale: 0.74, flash: 0.22, flashColor: "#8a8f86" },             // Pebble Derek
      { scale: 1 },                                                    // Derek
      { scale: 1.14, flash: 0.18, flashColor: "#66e8ff", ember: "120,240,255" }, // Crystal Derek
      { scale: 1.3, flash: 0.16, flashColor: "#e8c46a", ember: "255,215,120" },  // Derek the Bastion
    ],
    wraith: [
      { scale: 1, wisp: true },                                        // Soul Wisp: a soul orb with eyes
      { scale: 1 },                                                    // Abigail
      { scale: 1.1, flash: 0.2, flashColor: "#8a5cff", ember: "170,130,255" },   // Mourning Abigail
      { scale: 1.22, flash: 0.18, flashColor: "#e6f7ff", ember: "210,250,255" }, // Queen of Sorrows
    ],
    // Fred is drawn in code for now (src/fred.js); only the burst of light at a new form uses this
    fred: [{ ember: "255,180,80" }, { ember: "255,180,80" }, { ember: "255,180,80" }, { ember: "255,180,80" }],
  };
  const BASE = { hound: "boneHound", golem: "derek", wraith: "abigail" };
  Summons.look = function (kind) {
    const f = Summons.form(kind), key = BASE[kind] + "_f" + f;
    // Robert's drawing of this form, once it's in, replaces the stand-in (drawn at its own size, no tint)
    const sh = DL.Art.sheets[key];
    // `size`: how big the form stands next to the usual sprite, for things placed on it (Derek's heart glow)
    if (sh && !sh.down.idle[0].blank && !sh.down.walk[0].blank) return { key, scale: 1, size: LOOKS[kind][f].scale, drawn: true, ember: LOOKS[kind][f].ember };
    return Object.assign({ key: BASE[kind] }, LOOKS[kind][f]);
  };

  /* ---------------- training (Kit tab) ---------------- */
  Summons.trainInfo = function (kind) {
    const L = Summons.level(kind), cap = Summons.cap(kind);
    if (L >= S.max) return { L, max: true };
    const cost = DL.summonCost(L), home = DL.UPGRADES.find((u) => u.id === S[kind].home);
    let lock = null;
    if (!Summons.anyHas(kind)) lock = `Win ${S[kind].name} first`;
    else if (kind === "fred" && S.formAt.slice(1).some((m, i) => L >= m && !Summons.fredPath()[i])) lock = "Choose Fred's road first";
    else if (L + 1 > cap) lock = `Needs ${home.name} ${Math.ceil((L + 1) / S.perHome)}`;
    return { L, cost, lock, ok: !lock && G.canAfford(cost) };
  };
  Summons.train = function (kind) {
    if (G.isGuest()) { DL.Net.event({ t: "trainSummon", kind }); return true; } // the host trains it from the shared stash
    return Summons.trainHost(kind);
  };
  Summons.trainHost = function (kind) {
    const info = Summons.trainInfo(kind);
    if (info.max || !info.ok) { sfx("deny"); return false; }
    const before = Summons.form(kind);
    G.pay(info.cost);
    G.save.summons[kind] = info.L + 1;
    G.persist();
    const after = Summons.form(kind);
    if (after !== before) {
      sfx("milestone");
      say(`${S[kind].forms[before]} becomes ${S[kind].forms[after]}! ${S[kind].powers[after]}.`, "good");
      Summons.changed(kind);
    } else sfx("build");
    return true;
  };
  // A new form: a burst of light round every companion of that kind.
  Summons.changed = function (kind) {
    const list = kind === "hound" ? G.hounds : kind === "golem" ? G.golems : kind === "fred" ? G.freds : G.wraiths;
    const col = (LOOKS[kind][Summons.form(kind)].ember) || "255,230,170";
    for (const m of list) for (let i = 0; i < 18; i++) G.spark(m.x, m.y - 20, col, 110);
  };
})(window.DL);
