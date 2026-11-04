/* Drowned Light — the bosses' minions (Robert's concept sheets, 2026-11-04). Each great boss calls its own kind while it
   fights: the Colossus its Cairn Crawlers, Totem Servitors and a Silt Fist; the Starved Bell its Chapel Skitterers,
   Clapper Leeches and a Toll Wretch; the Deadly Rose her Briar Handmaidens, Rose Wretches and Thornlings; the Mother
   Wyvern her Drakelings, Raptors and Screechers. They are ordinary Drowned (DL.ENEMIES, with `minion: true`) that
   remember their boss (`lord`, its id), and they crumble when it dies or goes. The host calls them; friends see them
   in the snapshots. Numbers: DL.MINIONS (who comes when) and DL.ENEMIES (their bodies). */
"use strict";
(function (DL) {
  const { dist, rand, TAU } = DL;
  const G = DL.Game, M = DL.MINIONS;
  const Minions = (DL.Minions = {});
  const KIND = (e) => (e.def.colossus ? "colossus" : e.def.bell ? "bell" : e.def.rose ? "rose" : e.def.wyvern ? "wyvern" : e.def.king ? "king" : null);

  const mine = (b, type) => G.enemies.filter((e) => e.lord === b.id && e.type === type && !e.removed);
  const lordOf = (e) => (e.lord ? G.enemies.find((b) => b.id === e.lord && !b.removed) : null);
  const cap = (c) => Math.round(c.max * (c.party ? G.partyScale() : 1));

  // Call `n` of `type` round boss `b` (never past its cap). `at` is where they climb out (defaults to round the boss).
  function call(b, type, n, at) {
    const c = M[KIND(b)][type];
    let have = mine(b, type).length;
    for (let i = 0; i < n && have < cap(c); i++, have++) {
      const o = at ? at(i) : b.def.king ? DL.Finale.callSpot() : (() => { const a = rand(0, TAU), r = b.def.radius + rand(40, 110); return { x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r * 0.8 }; })();
      if (b.def.colossus && DL.Colossus.inArena) Object.assign(o, DL.Colossus.inArena(o.x, o.y));
      const e = G.makeEnemy(type, o.x, o.y, b.zi || 4, { lord: b.id, rise: 0.9, fromColossus: b.def.colossus || undefined, fromKing: b.def.king || undefined });
      G.enemies.push(e);
      for (let k = 0; k < 6; k++) G.puff(o.x + rand(-12, 12), o.y + rand(-4, 4), "rgba(60,200,210,0.6)", 60, 0.6, -30);
    }
  }
  Minions.call = call;

  /* ---------------- every frame (host) ---------------- */
  Minions.update = function (dt) {
    if (G.isGuest()) return;
    for (const b of G.enemies.slice()) {
      const kind = KIND(b);
      if (!kind || b.removed || b.dormant || b.rise > 0) continue;
      if (!G.knights().some((k) => dist(k.x, k.y, b.x, b.y) < M.near)) continue;
      const set = M[kind], half = b.hp < b.maxHp * 0.5;
      if (!b.mStart) {
        b.mStart = true;
        for (const type in set) if (set[type].start) call(b, type, set[type].start);
      }
      if (half && !b.mHalf) {
        b.mHalf = true;
        for (const type in set) if (set[type].phase2) call(b, type, set[type].phase2);
      }
      b.mT = b.mT || {};
      for (const type in set) {
        const c = set[type];
        if (c.every) {
          b.mT[type] = (b.mT[type] == null ? c.every * 0.5 : b.mT[type]) - dt;
          if (b.mT[type] <= 0) {
            b.mT[type] = half && c.every2 ? c.every2 : c.every;
            if (c.bushes && DL.Rose.bushes) {
              const bs = DL.Rose.bushes().filter((q) => dist(q.x, q.y, b.x, b.y) < 700);
              call(b, type, c.n, bs.length ? (i) => { const q = bs[(Math.random() * bs.length) | 0]; return { x: q.x + rand(-14, 14), y: q.y + rand(4, 14) }; } : null);
            } else call(b, type, c.n);
          }
        }
        if (c.respawn && b.mStart && !mine(b, type).length) {
          b.mT["r" + type] = (b.mT["r" + type] == null ? c.respawn : b.mT["r" + type]) - dt;
          if (b.mT["r" + type] <= 0) { b.mT["r" + type] = null; call(b, type, 1); }
        }
      }
    }
    for (const e of G.enemies) {
      if (!e.lord || e.removed) continue;
      const b = lordOf(e);
      if (!b) { crumble(e); continue; } // its boss is slain or gone back to sleep
      if (e.type === "screecher" && e.rise <= 0) {
        e.callT = (e.callT == null ? 3 : e.callT) - dt;
        if (e.callT <= 0) {
          e.callT = M.wyvern.screecher.callEvery;
          if (e.state === "move") e.stun = 0.5; // it rears back to shriek
          G.text(e.x, e.y - 60, "SCREECH", "#ff9a8a", 0.9);
          DL.Sound.play("growl");
          call(b, "drakeling", M.wyvern.screecher.call, () => ({ x: e.x + rand(-40, 40), y: e.y + rand(-30, 30) }));
        }
      }
    }
  };
  // Tide Leech: every `burrow` s it dives into the causeway and bursts up under the knight it hunts
  function burrow(e, dt) {
    if (e.dive) {
      e.dive.t -= dt;
      if (e.dive.t <= 0) {
        e.x = e.dive.x; e.y = e.dive.y; e.dive = null; e.hidden = false;
        e.rise = 0.5; e.cd = 0.4;
        for (let i = 0; i < 10; i++) G.puff(e.x + rand(-16, 16), e.y + rand(-5, 5), "rgba(60,200,210,0.7)", 90, 0.6, -40);
      }
      return;
    }
    e.burrowT = (e.burrowT == null ? e.def.burrow : e.burrowT) - dt;
    if (e.burrowT > 0 || e.state !== "move") return;
    const ks = G.knights().filter((k) => dist(k.x, k.y, e.x, e.y) < 700);
    if (!ks.length) return;
    const k = ks[(Math.random() * ks.length) | 0], delay = 1.1;
    e.burrowT = e.def.burrow;
    e.dive = { x: k.x, y: k.y, t: delay };
    e.hidden = true;
    G.telegraphs.push({ by: e.def.name, x: k.x, y: k.y, r: 40, t: 0, delay, dmg: e.dmg });
    for (let i = 0; i < 10; i++) G.puff(e.x + rand(-16, 16), e.y + rand(-5, 5), "rgba(60,200,210,0.7)", 70, 0.6, -20);
  }
  Minions.busy = function (e, dt) {
    if (e.def.burrow) burrow(e, dt);
    return !!e.dive; // under the causeway: nothing else to do
  };
  // how fast the Fire Bearer gathers its flame (a Sunken Wisp alive slows it)
  Minions.bearerRate = () => (G.enemies.some((e) => e.type === "wisp" && e.lord && !e.removed && e.rise <= 0) ? DL.MINIONS.king.wisp.slow : 1);
  function crumble(e) {
    e.hp = 0;
    G.kill(e);
  }

  /* ---------------- hooks from the bosses and the Drowned (src/game.js, src/bell.js, src/colossus.js) ---------------- */
  // the Starved Bell tolled: Skitterers burst from the mud round it
  Minions.toll = function (b) {
    if (G.isGuest()) return;
    call(b, "skitterer", M.bell.skitterer.perToll);
  };
  // how much faster the Bell tolls (a Toll Wretch ringing for it)
  Minions.tollRate = (b) => (mine(b, "tollwretch").some((e) => e.rise <= 0) ? M.bell.tollwretch.tollRate : 1);
  // one of the Colossus's ruins crumbled: a Crawler climbs out of the rubble
  Minions.ruin = function (q) {
    if (G.isGuest()) return;
    const b = G.enemies.find((e) => e.def.colossus && !e.removed && !e.dormant);
    if (b) call(b, "cairn", M.colossus.cairn.fromRuin, () => ({ x: q.x, y: q.y + 6 }));
  };
  // what's left of a blow to a boss: a Totem Servitor near it wards it
  Minions.ward = function (b) {
    if (!b.def.boss || !b.id) return 1;
    let w = 0;
    for (const e of G.enemies) if (e.lord === b.id && e.def.ward && !e.removed && e.rise <= 0 && dist(e.x, e.y, b.x, b.y) < M.colossus.servitor.ward) w = Math.max(w, e.def.ward);
    return 1 - w;
  };
  // a minion's bite landed: a Leech or Rose Wretch feeds its boss
  Minions.bit = function (e) {
    if (!e.def.drain) return;
    const b = lordOf(e);
    if (!b) return;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * e.def.drain);
    G.text(b.x, b.y - 30, "+" + Math.round(b.maxHp * e.def.drain), "#8aff9a", 0.9);
    for (let i = 0; i < 4; i++) G.puff(e.x, e.y - 10, "rgba(200,40,60,0.6)", 60, 0.5, -30);
  };
  // whom a minion hunts: the egg carrier, or the most wounded knight near it
  Minions.prey = function (e, best) {
    if (e.def.prey === "egg") return DL.Wyvern.prey(e, best);
    let pick = best, low = 2;
    for (const k of G.knights()) {
      if (dist(k.x, k.y, e.x, e.y) > 600) continue;
      const f = k.hp / (k === G.player ? G.stats().maxHp : k.maxHp || 100);
      if (f < low) { low = f; pick = k; }
    }
    return pick;
  };

  /* ---------------- drawing ---------------- */
  // the unit drawings a minion wears (its own once Robert's are cut in, else its stand-in) and their size
  Minions.look = function (e) {
    const d = e.def;
    if (!d.look || DL.Art.sheets[e.type]) return null;
    return { key: d.look, scale: d.lookScale || 1, tint: d.tint, tintK: d.tintK || 0 };
  };
  // in the glow pass: the cyan tether from a Totem Servitor to the Colossus it wards
  Minions.drawGlow = function (c, t) {
    for (const e of G.enemies) {
      if (!e.def.ward || !e.lord || e.removed || e.rise > 0) continue;
      const b = lordOf(e);
      if (!b || dist(e.x, e.y, b.x, b.y) > M.colossus.servitor.ward) continue;
      const a = 0.35 + 0.2 * Math.sin(t * 6 + e.id);
      c.strokeStyle = `rgba(80,235,245,${a})`;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(e.x, e.y - 40); c.lineTo(b.x, b.y - 50 * b.def.scale); c.stroke();
      c.strokeStyle = `rgba(220,255,255,${a * 0.8})`;
      c.lineWidth = 1;
      c.stroke();
    }
  };
})(window.DL);
