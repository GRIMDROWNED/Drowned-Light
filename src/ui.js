/* Drowned Light — HUD, menus and on-screen controls. */
"use strict";
(function (DL) {
  const $ = (id) => document.getElementById(id);
  const UI = (DL.UI = {});
  const cache = new Map();
  // Only touch the DOM when a value actually changes.
  function set(el, key, val) {
    const k = el.id + key;
    if (cache.get(k) === val) return;
    cache.set(k, val);
    if (key === "text") el.textContent = val;
    else if (key === "html") el.innerHTML = val;
    else if (key === "width") el.style.width = val;
    else if (key === "class") el.className = val;
    else if (key === "transform") el.style.transform = val;
    else if (key === "hidden") el.classList.toggle("hidden", val);
    else el.style.setProperty(key, val);
  }
  const chip = (k, n, cls = "") => `<span class="chip ${cls}"><i style="background:${DL.RESOURCES[k].color}"></i>${n}</span>`;
  const costHtml = (cost) =>
    Object.entries(cost).map(([k, n]) => chip(k, n, (DL.Game.save.stash[k] || 0) >= n ? "ok" : "no") + `<span class="sr">${DL.RESOURCES[k].name}</span>`).join("");

  UI.init = function () {
    const G = DL.Game;
    const press = (id, fn) => {
      const el = $(id);
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    press("btnDash", () => DL.Input.trigger("dash"));
    press("btnAbility", () => DL.Input.trigger("ability"));
    press("btnTorch", () => DL.Input.trigger("torch"));
    $("btnPause").addEventListener("click", () => UI.pause());
    $("campBtn").addEventListener("click", () => UI.openCamp());

    $("btnBegin").addEventListener("click", () => {
      if (!G.save.started) { UI.openSetup(); return; }
      UI.hideScreens(); G.begin(); UI.showHud(true);
    });
    $("btnNew").addEventListener("click", () => {
      const btn = $("btnNew");
      if (G.save.started && !btn.dataset.armed) {
        btn.dataset.armed = "1";
        btn.textContent = "Tap again to erase your camp";
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = "New game"; }, 3000);
        return;
      }
      delete btn.dataset.armed;
      btn.textContent = "New game";
      UI.openSetup();
    });
    $("setupBack").addEventListener("click", () => {
      if (UI.setup.step === 2) { UI.setup.step = 1; UI.renderSetup(); return; }
      UI.closeSetup();
      UI.showTitle();
    });
    $("setupNext").addEventListener("click", () => {
      if (UI.setup.step === 1) { UI.setup.step = 2; UI.renderSetup(); return; }
      UI.closeSetup();
      UI.hideScreens();
      G.newGame(UI.setup.kit, UI.setup.diff);
      UI.showHud(true);
    });
    $("setupBody").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-pick]");
      if (!b) return;
      UI.setup[UI.setup.step === 1 ? "kit" : "diff"] = b.dataset.pick;
      UI.renderSetup();
    });
    $("btnRise").addEventListener("click", () => { UI.hideScreens(); G.respawn(); UI.showHud(true); });
    $("btnResume").addEventListener("click", () => UI.resume());
    $("btnQuit").addEventListener("click", () => {
      UI.hideScreens(); UI.showHud(false);
      G.init();
      UI.showTitle();
    });
    for (const id of ["btnSound", "btnSound2"]) $(id).addEventListener("click", () => UI.toggleSound());
    $("campClose").addEventListener("click", () => UI.closeCamp());
    $("campBody").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b || b.disabled) return;
      const [act, arg] = b.dataset.act.split(":");
      if (act === "up") G.buyUpgrade(arg);
      else if (act === "train") { const r = DL.Kits.train(); UI.justReached = r && r.milestone ? r.level : 0; }
      else if (act === "torch") G.craftTorch();
      else if (act === "rest") { G.restUntilDusk(); UI.closeCamp(); UI.toast("You rest by the fire until dusk.", "warn"); return; }
      UI.renderCamp();
    });
    for (const t of document.querySelectorAll("#campTabs button")) {
      t.addEventListener("click", () => { UI.campTab = t.dataset.tab; UI.renderCamp(); });
    }
    UI.campTab = "build";
    document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") UI.pause(); });
    if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
    UI.updateSoundLabel();
  };

  UI.showTitle = function () {
    const G = DL.Game;
    $("btnBegin").innerHTML = G.save.started
      ? `Continue — Day ${G.save.day}<span class="sub">${G.kit().name} · Level ${G.save.kitLevel} · ${G.diff().name}</span>`
      : "Begin";
    $("btnNew").classList.toggle("hidden", !G.save.started);
    $("screenTitle").classList.remove("hidden");
  };
  UI.hideScreens = function () {
    for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  };
  UI.showHud = function (on) {
    $("hud").classList.toggle("hidden", !on);
    $("touchzone").classList.toggle("hidden", !on);
  };

  UI.pause = function () {
    const G = DL.Game;
    if (G.state !== "play") return;
    G.state = "pause";
    $("screenPause").classList.remove("hidden");
  };
  UI.resume = function () {
    const G = DL.Game;
    $("screenPause").classList.add("hidden");
    if (G.state === "pause") G.state = "play";
    DL.Input.clear();
  };

  UI.toggleSound = function () {
    const G = DL.Game;
    G.save.muted = !G.save.muted;
    DL.Sound.muted = G.save.muted;
    G.persist();
    UI.updateSoundLabel();
  };
  UI.updateSoundLabel = function () {
    const m = DL.Game.save && DL.Game.save.muted;
    for (const id of ["btnSound", "btnSound2"]) $(id).textContent = m ? "Sound: off" : "Sound: on";
  };

  UI.toast = function (msg, kind = "info") {
    const box = $("toasts");
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add("out"), 3800);
    setTimeout(() => el.remove(), 4400);
  };

  UI.showDeath = function (info) {
    UI.showHud(false);
    $("deathTitle").textContent = info.cause === "corruption" ? "You have drowned" : "Your light is spent";
    $("deathCause").textContent = info.cause === "corruption"
      ? "The darkness filled your armour, and you became one of the Drowned."
      : "You fell to the Drowned, and the deep claimed what was left.";
    const lost = DL.RES_KEYS.filter((k) => info.lost[k] > 0).map((k) => chip(k, info.lost[k])).join("");
    $("deathLost").innerHTML = info.any
      ? `<p>Your drowned self now wanders <b>${info.zone}</b>, carrying:</p><div class="chips">${lost}</div><p class="muted">Slay it to reclaim your supplies.${info.hadSelf ? " Your previous drowned self has sunk into the deep — its supplies are gone." : ""}</p>`
      : `<p class="muted">You carried nothing. Your stored supplies and camp are safe.${info.hadSelf ? " Your drowned self still waits where you last fell." : ""}</p>`;
    $("deathStats").textContent = `Day ${info.day} · nights survived: ${info.nights}`;
    $("screenDeath").classList.remove("hidden");
  };

  /* ---------------- new game: choose a kit, then a difficulty ---------------- */
  UI.setup = { step: 1, kit: "lanternBlade", diff: "dark" };
  UI.openSetup = function () {
    UI.setup = { step: 1, kit: "lanternBlade", diff: "dark" };
    $("screenTitle").classList.add("hidden");
    $("screenSetup").classList.remove("hidden");
    UI.renderSetup();
    const loop = (ts) => {
      if ($("screenSetup").classList.contains("hidden")) return;
      UI.drawPortraits(ts / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  UI.closeSetup = function () { $("screenSetup").classList.add("hidden"); };

  UI.renderSetup = function () {
    const st = UI.setup;
    $("setupStep").textContent = `Step ${st.step} of 2`;
    $("setupTitle").textContent = st.step === 1 ? "Choose your kit" : "Choose your darkness";
    $("setupHint").textContent = st.step === 1
      ? "Your kit is yours for this whole game. Train it at camp to level 20; levels 5, 10, 15 and 20 transform it."
      : "Difficulty shapes the land itself: how much it gives, how hard the Drowned hit, and how much light there is to hide in.";
    $("setupBack").textContent = st.step === 1 ? "Back" : "Back to kits";
    $("setupNext").textContent = st.step === 1 ? "Next" : `Begin as ${DL.KITS[st.kit].name}`;
    let html = "";
    if (st.step === 1) {
      for (const id of DL.KIT_ORDER) {
        const k = DL.KITS[id];
        html += `<button class="pick kit-pick ${st.kit === id ? "on" : ""}" data-pick="${id}" aria-pressed="${st.kit === id}">
          <canvas class="portrait" data-kit="${id}" width="88" height="108"></canvas>
          <span class="pick-text">
            <span class="tag">${k.tag}</span>
            <span class="pick-name">${k.name}</span>
            <span class="motto">${k.motto}</span>
            <span class="roles">${k.roles.map((r) => `<i>${r}</i>`).join("")}</span>
            <span class="pick-line"><b>${k.attack.name}</b> · <b>${k.ability.name}</b></span>
          </span></button>`;
      }
      const k = DL.KITS[st.kit];
      html += `<div class="pick-detail"><h3>${k.name}</h3><p>${k.desc}</p>
        <p><b>${k.ability.name}:</b> ${k.ability.desc}</p>
        <p><b>Special: ${k.special.name}.</b> ${k.special.desc}</p>
        <ol class="ms-list">${k.milestones.map((m, i) => `<li><span>Lv ${DL.MILESTONE_LEVELS[i]}</span><b>${m.name}</b> ${m.desc}</li>`).join("")}</ol></div>`;
    } else {
      DL.DIFF_ORDER.forEach((id, i) => {
        const d = DL.DIFFICULTIES[id];
        html += `<button class="pick diff-pick d-${id} ${st.diff === id ? "on" : ""}" data-pick="${id}" aria-pressed="${st.diff === id}">
          <span class="pips">${[0, 1, 2, 3].map((j) => `<i class="${j <= i ? "on" : ""}"></i>`).join("")}</span>
          <span class="pick-name">${d.name}</span>
          <span class="motto">${d.motto}</span>
          <ul>${d.notes.map((n) => `<li>${n}</li>`).join("")}</ul></button>`;
      });
    }
    $("setupBody").className = "setup-grid step" + st.step;
    $("setupBody").innerHTML = html;
    UI.drawPortraits(0);
  };

  // Kit portraits: the chosen kit walks; the others stand.
  UI.drawPortraits = function (t) {
    for (const cv of document.querySelectorAll("canvas[data-kit]")) {
      const g = cv.getContext("2d"), id = cv.dataset.kit, on = UI.setup.kit === id || cv.dataset.still;
      g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      const anim = on && !cv.dataset.still ? (Math.floor(t / 2.4) % 2 ? "attack" : "walk") : "idle";
      const fr = anim === "attack" ? Math.floor(t * 6) % 3 : Math.floor(t * (anim === "walk" ? 8 : 1.6));
      DL.Art.drawUnit(g, id + "1", anim, fr, Math.PI / 2, cv.width / 2, cv.height - 6, cv.width / 88);
    }
  };

  /* ---------------- camp menu ---------------- */
  UI.openCamp = function () {
    const G = DL.Game;
    if (G.state !== "play" || !G.inCamp) return;
    G.state = "camp";
    UI.renderCamp();
    $("screenCamp").classList.remove("hidden");
  };
  UI.closeCamp = function () {
    const G = DL.Game;
    $("screenCamp").classList.add("hidden");
    if (G.state === "camp") G.state = "play";
    DL.Input.clear();
  };

  UI.renderCamp = function () {
    const G = DL.Game, s = G.save;
    for (const t of document.querySelectorAll("#campTabs button")) t.classList.toggle("on", t.dataset.tab === UI.campTab);
    $("campStash").innerHTML = DL.RES_KEYS.map((k) => `<span class="stash-item">${chip(k, s.stash[k])}<small>${DL.RESOURCES[k].name}</small></span>`).join("");
    const tier = DL.Camp.tier(s.up);
    $("campDay").textContent = `Tier ${"I".repeat(tier)} · ${DL.TIER_NAMES[tier]} · Day ${s.day} · ${G.phase() === "day" ? "Daylight" : G.phase() === "night" ? "Night" : G.phase() === "dusk" ? "Dusk" : "Dawn"}`;
    let html = "";
    if (UI.campTab === "build") {
      for (const u of DL.UPGRADES) {
        const lvl = s.up[u.id], max = lvl >= u.max;
        const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("");
        let action = "";
        if (max) action = `<span class="maxed">Complete</span>`;
        else {
          const cost = u.costs[lvl];
          const lock = G.upgradeLock(u, lvl);
          const ok = !lock && G.canAfford(cost);
          action = `<div class="cost">${costHtml(cost)}</div>` +
            (lock ? `<span class="req">${lock}</span>` : "") +
            `<button data-act="up:${u.id}" ${ok ? "" : "disabled"}>${lvl ? "Upgrade" : "Build"}</button>`;
        }
        html += `<article class="card">
          <header><h3>${u.name}</h3><div class="pips">${pips}</div></header>
          <p>${u.info}</p>
          <p class="effect">Now: ${u.effect(lvl)}${max ? "" : `<br>Next: ${u.effect(lvl + 1)}`}</p>
          <footer>${action}</footer></article>`;
      }
    } else if (UI.campTab === "kit") {
      const k = G.kit(), L = s.kitLevel, info = DL.Kits.trainInfo(), K = DL.Kits;
      const pos = (lvl) => ((lvl - 1) / (DL.KIT_MAX_LEVEL - 1)) * 100;
      const track = `<div class="lvl-track" aria-label="Level ${L} of ${DL.KIT_MAX_LEVEL}"><i style="width:${pos(L)}%"></i>${DL.MILESTONE_LEVELS.map((m) => `<b class="${L >= m ? "on" : ""}" style="left:${pos(m)}%">${m}</b>`).join("")}</div>`;
      let action;
      if (info.max) action = `<span class="maxed">Fully trained</span>`;
      else action = `<div class="cost">${costHtml(info.cost)}</div>` +
        `<button data-act="train" ${info.ok ? "" : "disabled"}>Train to level ${L + 1}</button>`;
      const band = DL.KIT_BANDS.find((b) => L + 1 <= b.upTo);
      const prev = DL.KIT_BANDS[DL.KIT_BANDS.indexOf(band) - 1];
      const reqLine = info.max ? "" : `<p class="effect">Levels ${prev ? prev.upTo + 1 : 2}–${band.upTo} need: ` +
        Object.keys(band.req).map((k) => {
          const got = s.up[k] >= band.req[k];
          return `<span class="${got ? "req-ok" : "req"}">${DL.UPGRADES.find((u) => u.id === k).name} ${band.req[k]}${got ? " ✓" : ""}</span>`;
        }).join(" · ") + "</p>";
      html += `<article class="card kit-card ${UI.justReached ? "celebrate" : ""}">
        <header><canvas class="portrait" data-kit="${G.save.kit}" data-still="1" width="66" height="81"></canvas>
          <div><span class="tag">${k.tag} · ${k.weapon}</span><h3>${k.name}</h3><span class="motto">${k.motto}</span></div>
          <span class="kit-lvl">Lv <b>${L}</b></span></header>
        ${track}
        <p class="effect">Damage ×${K.power().toFixed(2)} · ${k.ability.name} every ${K.abilityCd().toFixed(1)}s${L < DL.KIT_MAX_LEVEL ? `<br>Each level: +5% damage, faster ability` : ""}</p>
        <p class="effect"><b>Special: ${k.special.name}.</b> ${k.special.desc}</p>
        ${reqLine}
        <footer>${action}</footer></article>`;
      html += `<article class="card"><header><h3>Milestones</h3><span class="tag">Levels 5 · 10 · 15 · 20</span></header>
        <ol class="ms-list">${k.milestones.map((m, i) => {
          const lv = DL.MILESTONE_LEVELS[i], got = L >= lv;
          return `<li class="${got ? "got" : ""} ${UI.justReached === lv ? "new" : ""}"><span>Lv ${lv}</span><b>${m.name}</b> ${m.desc}</li>`;
        }).join("")}</ol></article>`;
      const d = G.diff();
      html += `<article class="card"><header><h3>${d.name}</h3><span class="tag">Difficulty</span></header>
        <p class="motto">${d.motto}</p><ul class="guide">${d.notes.map((n) => `<li>${n}</li>`).join("")}</ul></article>`;
      UI.justReached = 0;
    } else {
      const st = G.stats();
      const full = s.torches >= st.torchMax;
      html += `<article class="card">
        <header><h3>Torches</h3><span class="tag">${s.torches} / ${st.torchMax}</span></header>
        <p>Plant firelight anywhere. Torches reverse corruption like the camp fire, but burn out after a while — and Lantern Defilers hunt them.</p>
        <footer><div class="cost">${costHtml(DL.TORCH_COST)}</div><button data-act="torch" ${!full && G.canAfford(DL.TORCH_COST) ? "" : "disabled"}>${full ? "Satchel full" : "Craft"}</button></footer></article>`;
      const day = G.phase() === "day";
      html += `<article class="card">
        <header><h3>Rest</h3></header>
        <p>Sleep by the fire until dusk. You wake fully healed with a full lantern — ready to defend the camp through the night.</p>
        <footer><button data-act="rest" ${day ? "" : "disabled"}>${day ? "Rest until dusk" : "Only by day"}</button></footer></article>`;
      html += `<article class="card">
        <header><h3>Field guide</h3></header>
        <ul class="guide">
          <li><b class="warm">Firelight</b> (camp, torches, Illuminate) reverses corruption and refills your lantern.</li>
          <li><b class="cold">Bloomlight</b> (Refuge, Sentinel, Mother Root) only halts it. Blooms wake at night.</li>
          <li>Your <b>lantern oil</b> halves corruption in the dark until it runs dry.</li>
          <li><b>Abyssal Pearls</b> surface only in darkness, in the Mire and deeper.</li>
          <li>Defend a <b>Mother Root</b> until dawn for a rich reward.</li>
          <li>Fall, and your <b>drowned self</b> keeps your supplies. Slay it to get them back.</li>
        </ul></article>`;
    }
    $("campBody").innerHTML = html;
    UI.drawPortraits(0);
  };

  /* ---------------- per-frame HUD ---------------- */
  UI.update = function () {
    const G = DL.Game;
    if (G.state !== "play" && G.state !== "camp") return;
    const p = G.player, st = G.stats();

    set($("hpFill"), "width", (Math.max(0, p.hp) / st.maxHp) * 100 + "%");
    set($("hpText"), "text", `${Math.ceil(Math.max(0, p.hp))} / ${st.maxHp}`);
    set($("corFill"), "width", p.corrupt + "%");
    set($("corText"), "html", `${Math.floor(p.corrupt)}%<span class="opt"> · ${["", "Untouched", "Seeping", "Near drowning", "Drowning"][p.stage]}</span>`);
    set($("oilFill"), "width", (p.oil / st.maxOil) * 100 + "%");
    set($("oilText"), "text", `${Math.ceil(p.oil)} / ${st.maxOil}`);
    set($("vitals"), "class", "panel stage" + p.stage);

    let ls, lc;
    if (p.protect === "human") { ls = "Firelight — corruption receding"; lc = "warm"; }
    else if (p.protect === "bloom") { ls = "Bloomlight — corruption held"; lc = "cold"; }
    else if (p.exposed) { ls = p.oil > 0 ? "Darkness — your lantern slows it" : "Darkness — corruption rising fast"; lc = "danger"; }
    else { ls = "Daylight — safe"; lc = "day"; }
    set($("lightState"), "text", ls);
    set($("lightState"), "class", lc);

    const ph = G.phase();
    set($("dayText"), "text", `Day ${G.save.day}`);
    let pt;
    if (ph === "day") pt = `Nightfall in ${DL.fmtTime(G.timeToNight())}`;
    else if (ph === "dusk") pt = "Dusk — night is coming";
    else if (ph === "night") pt = `Dawn in ${DL.fmtTime(G.timeToDawn())}`;
    else pt = "Dawn breaks";
    set($("phaseText"), "text", pt);
    set($("phaseIcon"), "class", G.night ? "moon" : "sun");
    set($("clock"), "--prog", String(G.time / DL.CYCLE.total));

    set($("zoneText"), "text", DL.ZONES[p.zi].name);
    const d = Math.hypot(p.x, p.y);
    set($("homeArrow"), "transform", `rotate(${(Math.atan2(-p.y, -p.x) * 180) / Math.PI}deg)`);
    set($("homeDist"), "text", d < DL.CAMP_RADIUS ? "At camp" : `Camp ${Math.round(d / 10)}m`);
    const ds = G.save.drownedSelf;
    set($("selfNav"), "hidden", !ds);
    if (ds) {
      set($("selfArrow"), "transform", `rotate(${(Math.atan2(ds.y - p.y, ds.x - p.x) * 180) / Math.PI}deg)`);
      set($("selfDist"), "text", `Drowned self ${Math.round(Math.hypot(ds.x - p.x, ds.y - p.y) / 10)}m`);
    }

    const carried = DL.RES_KEYS.filter((k) => p.carried[k] > 0).map((k) => chip(k, p.carried[k])).join("");
    set($("carried"), "html", carried ? `<span class="lbl">Carrying</span>${carried}` : "");

    // objective banner
    let obj = "";
    if (!G.flame.lit) obj = "The Central Flame is out — survive until dawn";
    else if (G.night && Math.hypot(p.x, p.y) < G.siegeRadius()) obj = `Defend the camp · Flame ${Math.ceil(G.flame.hp)} / ${G.flame.max}`;
    else if (G.rootEvent && !G.rootEvent.obj.dead && Math.hypot(p.x - G.rootEvent.obj.x, p.y - G.rootEvent.obj.y) < 650) obj = `Defend the Mother Root until dawn · ${Math.ceil(G.rootEvent.obj.hp)} / ${Math.round(G.rootEvent.obj.maxHp)}`;
    set($("objective"), "text", obj);
    set($("objective"), "hidden", !obj);

    const kit = G.kit();
    set($("abilityName"), "text", kit.ability.name);
    const abFrac = p.abiCd > 0 ? p.abiCd / DL.Kits.abilityCd() : 0;
    set($("kitLine"), "text", `${kit.name} · Lv ${G.save.kitLevel} · ${G.diff().name}`);
    set($("btnAbility"), "--cd", abFrac.toFixed(3));
    set($("btnAbility"), "class", "act" + (p.oil < kit.ability.oil ? " low" : ""));
    set($("btnDash"), "--cd", (p.dashCd / 2.2).toFixed(3));
    set($("torchCount"), "text", String(G.save.torches));
    set($("campBtn"), "hidden", !G.inCamp);
  };
})(window.DL);
