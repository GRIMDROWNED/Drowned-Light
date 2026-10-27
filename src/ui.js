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
    press("btnBoost", () => DL.Input.trigger("boost"));
    // Manual Attack button: strikes for as long as it's held.
    // The Attack button doubles as an aiming stick: press to strike, drag to aim
    // (so you can back away while striking the other way). A plain press strikes the way you face.
    const atk = $("btnAttack"), atkKnob = $("attackKnob");
    let atkOrigin = null, atkId = null;
    const atkMove = (e) => {
      if (e.pointerId !== atkId || !atkOrigin) return;
      const q = DL.View.toStage(e.clientX, e.clientY);
      let dx = q.x - atkOrigin.x, dy = q.y - atkOrigin.y;
      const len = Math.hypot(dx, dy), R = 28;
      if (len > 12) DL.Input.attackAim = Math.atan2(dy, dx);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      atkKnob.style.transform = `translate(${dx}px,${dy}px)`;
      atk.classList.toggle("aiming", len > 12);
    };
    const atkEnd = (e) => {
      if (e.pointerId !== atkId) return;
      atkId = null; atkOrigin = null;
      DL.Input.attackBtn = false;
      DL.Input.attackAim = null;
      atkKnob.style.transform = "";
      atk.classList.remove("aiming");
    };
    atk.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      atkId = e.pointerId;
      atkOrigin = DL.View.toStage(e.clientX, e.clientY);
      DL.Input.attackBtn = true;
      try { atk.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    atk.addEventListener("pointermove", atkMove);
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) atk.addEventListener(ev, atkEnd);
    atk.addEventListener("contextmenu", (e) => e.preventDefault());
    const mine = $("btnMine");
    mine.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); DL.Input.mineBtn = true; try { mine.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) mine.addEventListener(ev, () => { DL.Input.mineBtn = false; });
    mine.addEventListener("contextmenu", (e) => e.preventDefault());
    for (const id of ["btnView", "btnView2"]) $(id).addEventListener("click", () => { DL.View.cycle(); UI.updateViewLabel(); });
    $("btnCombat").addEventListener("click", () => {
      G.save.attackMode = G.save.attackMode === "manual" ? "auto" : "manual";
      G.persist();
      UI.updateCombatLabel();
    });
    $("btnPause").addEventListener("click", () => UI.pause());
    $("campBtn").addEventListener("click", () => UI.campAction());

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
      G.newGame(UI.setup.kit, UI.setup.diff, UI.setup.attack);
      UI.showHud(true);
    });
    $("setupBody").addEventListener("click", (e) => {
      const m = e.target.closest("button[data-mode]");
      if (m) { UI.setup.attack = m.dataset.mode; UI.renderSetup(); return; }
      const b = e.target.closest("button[data-pick]");
      if (!b) return;
      UI.setup[UI.setup.step === 1 ? "kit" : "diff"] = b.dataset.pick;
      UI.renderSetup();
    });
    $("btnRise").addEventListener("click", () => { UI.hideScreens(); G.respawn(); UI.showHud(true); });
    $("btnResume").addEventListener("click", () => UI.resume());
    $("btnQuit").addEventListener("click", () => { G.persist(); DL.Net.leave(true); UI.toTitle(); });

    /* co-op */
    $("btnCoop").addEventListener("click", () => UI.openCoop());
    $("btnSaves").addEventListener("click", () => UI.openSaves());
    $("btnSavesBack").addEventListener("click", () => { $("screenSaves").classList.add("hidden"); UI.showTitle(); });
    $("savesList").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-slot]");
      if (!b) return;
      const n = +b.dataset.slot, act = b.dataset.slotAct;
      if (act === "play") { G.useSlot(n); UI.hideScreens(); G.begin(); UI.showHud(true); }
      else if (act === "new") { G.useSlot(n); $("screenSaves").classList.add("hidden"); UI.openSetup(); }
      else if (act === "delete") {
        if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Tap again to delete"; setTimeout(() => UI.renderSaves(), 3000); return; }
        G.deleteSlot(n);
        UI.renderSaves();
      }
    });
    $("btnCoopBack").addEventListener("click", () => {
      if (DL.Net.role === "host" && G.state === "title") DL.Net.leave(true);
      $("screenCoop").classList.add("hidden");
      UI.showTitle();
    });
    $("btnHost").addEventListener("click", async () => {
      $("btnHost").disabled = true;
      const ok = await DL.Net.host();
      $("btnHost").disabled = false;
      if (!ok) return;
      $("btnHost").classList.add("hidden");
      $("coopCodeText").textContent = DL.Net.code;
      $("coopCode").classList.remove("hidden");
    });
    $("btnCoopStart").addEventListener("click", () => { UI.hideScreens(); G.begin(); UI.showHud(true); });
    $("btnJoin").addEventListener("click", async () => {
      $("btnJoin").disabled = true;
      await DL.Net.join($("coopInput").value, UI.coopKit);
      $("btnJoin").disabled = false;
    });
    $("coopKits").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-coopkit]");
      if (b) { UI.coopKit = b.dataset.coopkit; UI.renderJoinKits(); }
    });
    $("coopInput").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") $("btnJoin").click(); });
    $("coopPlayers").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-boot]");
      if (!b) return;
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Tap again to remove"; setTimeout(() => UI.renderCoopPlayers(), 3000); return; }
      DL.Net.kick(+b.dataset.boot);
      UI.renderCoopPlayers();
    });
    $("btnLeaveCoop").addEventListener("click", () => {
      const guest = DL.Net.role === "guest";
      DL.Net.leave();
      if (guest) UI.toTitle(); else UI.resume();
    });
    for (const id of ["btnSound", "btnSound2"]) $(id).addEventListener("click", () => UI.toggleSound());
    $("btnControls").addEventListener("click", () => UI.openControls("screenTitle"));
    $("btnControls2").addEventListener("click", () => UI.openControls("screenPause"));
    $("btnControlsBack").addEventListener("click", () => UI.closeControls());
    $("bindRows").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-bind]");
      if (b) UI.startCapture(b.dataset.bind, b.dataset.act);
    });
    $("btnBindsReset").addEventListener("click", () => { UI.endCapture(); DL.Binds.reset(); UI.refreshBinds(); DL.Sound.play("chime"); });
    // Rebinding a key: the next key pressed (Esc cancels). Runs before the game's own key handler.
    addEventListener("keydown", (e) => {
      const cap = UI.capture;
      if (!cap) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const k = e.key.toLowerCase();
      if (k === "escape" || cap.kind !== "keys") UI.endCapture();
      else UI.endCapture(k);
    }, true);
    $("campClose").addEventListener("click", () => UI.closeCamp());
    $("campBody").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b || b.disabled) return;
      const [act, arg] = b.dataset.act.split(":");
      if (act === "up") G.buyUpgrade(arg);
      else if (act === "train") { const r = DL.Kits.train(); UI.justReached = r && r.milestone ? r.level : 0; }
      else if (act === "trainSummon") DL.Summons.train(arg);
      else if (act === "fredPath") DL.Summons.choose(arg);
      else if (act === "fredRepick") DL.Summons.repick();
      else if (act === "wyvPath") DL.Summons.choose(arg, "wyvern");
      else if (act === "wyvRepick") DL.Summons.repick("wyvern");
      else if (act === "travel") { if (DL.Outposts.travel(arg)) { UI.closeCamp(); return; } }
      else if (act === "torch") G.craftTorch();
      else if (act === "rest") { G.restUntilDusk(); UI.closeCamp(); UI.toast("You rest by the fire until dusk.", "warn"); return; }
      UI.renderCamp();
    });
    for (const t of document.querySelectorAll("#campTabs button")) {
      t.addEventListener("click", () => { UI.campTab = t.dataset.tab; UI.renderCamp(); });
    }
    UI.campTab = "build";
    document.addEventListener("visibilitychange", () => { if (!document.hidden) return; if (G.state === "play") UI.pause(); G.persist(); });
    if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
    UI.updateSoundLabel();
    UI.updateViewLabel();
    UI.refreshBinds();
  };

  UI.showTitle = function () {
    const G = DL.Game;
    $("btnBegin").innerHTML = G.save.started
      ? `Continue — Day ${G.save.day}<span class="sub">Slot ${G.slot} · ${G.kit().name} · Level ${G.save.kitLevel} · ${G.diff().name}</span>`
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

  UI.toTitle = function () {
    UI.hideScreens();
    UI.showHud(false);
    DL.Game.init();
    UI.showTitle();
  };

  UI.openCoop = function () {
    const G = DL.Game;
    $("screenTitle").classList.add("hidden");
    $("screenCoop").classList.remove("hidden");
    const hosting = DL.Net.role === "host";
    $("btnHost").classList.toggle("hidden", hosting);
    $("coopCode").classList.toggle("hidden", !hosting);
    if (G.save.started) {
      $("coopHostInfo").textContent = `Your world: day ${G.save.day}, ${G.kit().name} level ${G.save.kitLevel}, ${G.diff().name}. You keep all progress.`;
      $("btnHost").disabled = false;
    } else {
      $("coopHostInfo").textContent = "Start a game of your own first; your friend joins your world.";
      $("btnHost").disabled = true;
    }
    UI.coopKit = UI.coopKit || G.save.kit;
    UI.renderJoinKits();
    UI.coopStatus("");
  };
  // Join card: pick the kit you bring into your friend's world.
  UI.renderJoinKits = function () {
    const k = UI.coopKit, lvl = DL.Net.joinLevel(k);
    $("coopKits").innerHTML = DL.KIT_ORDER.map((id) =>
      `<button class="kit-chip ${id === k ? "on" : ""}" data-coopkit="${id}" aria-pressed="${id === k}" title="${DL.KITS[id].name}">
        <canvas class="portrait" data-kit="${id}" data-still="1" width="44" height="54"></canvas><span>${DL.KITS[id].name.split(" ")[1]}</span></button>`).join("");
    $("coopJoinInfo").textContent = `You'll join as the ${DL.KITS[k].name}, level ${lvl}. Levels you train in co-op are kept for your next co-op game; your own saves don't change.`;
    UI.drawPortraits(0);
  };
  UI.refreshCamp = function () { if (DL.Game.state === "camp") UI.renderCamp(); };

  UI.coopStatus = function (msg) { $("coopStatus").textContent = msg || ""; };

  UI.pause = function () {
    const G = DL.Game;
    if (G.state !== "play") return;
    $("btnLeaveCoop").classList.toggle("hidden", !DL.Net.role);
    UI.renderCoopPlayers();
    $("pauseNote").textContent = G.isGuest()
      ? "The world keeps running while you're paused. Only the host can pause it for both of you."
      : DL.Net.role && G.allies.length ? "Paused for everyone. Camp upgrades and stored supplies save automatically."
      : "Camp upgrades and stored supplies save automatically.";
    G.state = "pause";
    UI.updateCombatLabel();
    $("screenPause").classList.remove("hidden");
  };
  // Host's pause menu: a button per friend to remove them from the game (tap twice).
  UI.renderCoopPlayers = function () {
    const G = DL.Game, host = DL.Net.role === "host" && G.allies.length;
    $("coopPlayers").classList.toggle("hidden", !host);
    $("coopPlayers").innerHTML = host ? G.allies.map((a) => `<button data-boot="${a.id}">Remove ${a.label}</button>`).join("") : "";
  };
  UI.resume = function () {
    const G = DL.Game;
    $("screenPause").classList.add("hidden");
    if (G.state === "pause") G.state = "play";
    DL.Input.clear();
  };

  // Controls reference, opened from the title or the pause menu; Back returns there.
  UI.openControls = function (from) {
    UI.controlsFrom = from;
    $(from).classList.add("hidden");
    UI.renderBinds();
    $("screenControls").classList.remove("hidden");
  };
  UI.closeControls = function () {
    UI.endCapture();
    $("screenControls").classList.add("hidden");
    $(UI.controlsFrom || "screenTitle").classList.remove("hidden");
  };

  /* ---------------- bindings (src/binds.js) ---------------- */
  const kbds = (list) => list.map((x) => `<kbd>${x}</kbd>`).join(" / ") || `<span class="muted">none</span>`;
  UI.keyLabel = (id) => DL.Binds.keys[id].map(DL.Binds.keyName);
  UI.padLabel = (id) => (DL.Binds.pad[id] || []).map(DL.Binds.padName);
  UI.renderBinds = function () {
    const cell = (kind, a, list) => `<td><button class="bind" data-bind="${kind}" data-act="${a.id}" aria-label="Rebind ${a.name}">${kbds(list)}</button></td>`;
    $("bindRows").innerHTML = DL.Binds.ACTIONS.map((a) => `<tr><th>${a.name}</th>${cell("keys", a, UI.keyLabel(a.id))}` +
      (a.pad ? cell("pad", a, UI.padLabel(a.id)) : `<td><kbd>Left stick</kbd> / <kbd>D-pad</kbd></td>`) + "</tr>").join("");
  };
  // HUD and title hints follow the bindings.
  UI.refreshBinds = function () {
    UI.renderBinds();
    const hud = { btnTorch: "torch", btnAbility: "ability", btnBoost: "boost", btnDash: "dash", btnAttack: "attack", btnMine: "mine" };
    for (const id in hud) {
      const k = $(id).querySelector("kbd");
      k.textContent = UI.keyLabel(hud[id])[0] || "";
      k.dataset.pad = UI.padLabel(hud[id])[0] || "";
    }
    UI.campShown = null; // redraws the camp button's hint
    const K = (id) => `<kbd>${UI.keyLabel(id)[0] || "—"}</kbd>`, P = (id) => `<kbd>${UI.padLabel(id)[0] || "—"}</kbd>`;
    const mv = ["up", "left", "down", "right"].map((id) => UI.keyLabel(id)[0] || "").join("");
    $("hintDesk").innerHTML = `Move <kbd>${mv}</kbd> · Attack (manual) ${K("attack")} or click · Mine (manual) ${K("mine")} or right-click · Dash ${K("dash")} · Ability ${K("ability")} · Torch ${K("torch")} · Familiar boost ${K("boost")} · Camp ${K("camp")} · Pause <kbd>Esc</kbd>`;
    $("hintPad").innerHTML = `Controller: move <kbd>Left stick</kbd> · Dash ${P("dash")} · Ability ${P("ability")} · Attack ${P("attack")} · Torch ${P("torch")} · Boost ${P("boost")} · Camp ${P("camp")} · Pause ${P("pause")}`;
  };
  UI.capture = null;
  UI.startCapture = function (kind, id) {
    UI.endCapture();
    const el = $("bindRows").querySelector(`button[data-bind="${kind}"][data-act="${id}"]`);
    if (!el) return;
    el.blur();
    el.classList.add("listening");
    el.textContent = kind === "pad" ? "Press a button…" : "Press a key… (Esc cancels)";
    UI.capture = { kind, id, timer: setTimeout(() => UI.endCapture(), 8000) };
  };
  // Finish rebinding: v is the new key or pad button, or undefined to cancel.
  UI.endCapture = function (v) {
    const cap = UI.capture;
    if (!cap) return;
    UI.capture = null;
    clearTimeout(cap.timer);
    if (v !== undefined) { DL.Binds.set(cap.kind, cap.id, v); DL.Sound.play("chime"); }
    UI.refreshBinds();
  };

  UI.updateCombatLabel = function () {
    $("btnCombat").textContent = "Combat: " + (DL.Game.save.attackMode === "manual" ? "Manual attack" : "Auto-attack");
  };

  UI.updateViewLabel = function () {
    for (const id of ["btnView", "btnView2"]) $(id).textContent = "View: " + DL.View.LABELS[DL.View.mode];
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
    $("deathTitle").textContent = info.cause === "corruption" ? "You have drowned" : info.cause === "camp" ? "Your camp has fallen" : "Your light is spent";
    $("deathCause").textContent = info.cause === "corruption"
      ? "The darkness filled your armour, and you became one of the Drowned."
      : info.cause === "camp" ? "The Drowned put out the Central Flame, and the dark poured in."
      : "You fell to the Drowned, and the deep claimed what was left.";
    const lost = DL.RES_KEYS.filter((k) => info.lost[k] > 0).map((k) => chip(k, info.lost[k])).join("");
    $("deathLost").innerHTML = info.any
      ? `<p>Your drowned self now wanders <b>${info.zone}</b>, carrying:</p><div class="chips">${lost}</div><p class="muted">Slay it to reclaim your supplies.${info.hadSelf ? " Your previous drowned self has sunk into the deep — its supplies are gone." : ""}</p>`
      : `<p class="muted">You carried nothing. Your stored supplies and camp are safe.${info.hadSelf ? " Your drowned self still waits where you last fell." : ""}</p>`;
    $("deathStats").textContent = `Day ${info.day} · nights survived: ${info.nights}`;
    $("screenDeath").classList.remove("hidden");
  };

  /* ---------------- new game: choose a kit, then a difficulty ---------------- */
  UI.setup = { step: 1, kit: "lanternBlade", diff: "dark", attack: "auto" };
  /* ---------------- save slots ---------------- */
  UI.openSaves = function () {
    $("screenTitle").classList.add("hidden");
    $("screenSaves").classList.remove("hidden");
    UI.renderSaves();
  };
  UI.renderSaves = function () {
    const G = DL.Game;
    $("savesList").innerHTML = G.listSlots().map(({ slot, save }) => {
      const cur = slot === G.slot ? `<span class="tag">Current</span>` : "";
      if (!save) {
        return `<article class="card save-card"><header><h3>Slot ${slot}</h3>${cur}</header><p class="muted">Empty</p>
          <footer><button data-slot="${slot}" data-slot-act="new">New game here</button></footer></article>`;
      }
      const k = DL.KITS[save.kit], d = DL.DIFFICULTIES[save.difficulty] || DL.DIFFICULTIES.dark;
      const when = save.lastPlayed ? new Date(save.lastPlayed).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
      return `<article class="card save-card"><header><h3>Slot ${slot}</h3>${cur}</header>
        <p><b>Day ${save.day}</b> · ${k.name} level ${save.kitLevel} · ${d.name}</p>
        <p class="muted">Central Flame ${save.up.flame} · ${save.nights} night${save.nights === 1 ? "" : "s"} survived${when ? " · played " + when : ""}</p>
        <footer><button data-slot="${slot}" data-slot-act="play" class="go">Play</button>
          <button data-slot="${slot}" data-slot-act="new">New game here</button>
          <button data-slot="${slot}" data-slot-act="delete" class="danger">Delete</button></footer></article>`;
    }).join("");
  };

  UI.openSetup = function () {
    UI.setup = { step: 1, kit: "lanternBlade", diff: "dark", attack: "auto" };
    $("screenTitle").classList.add("hidden");
    $("screenSaves").classList.add("hidden");
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
      : "Difficulty shapes the land itself: how much it gives, how hard the Drowned hit, and how much light there is to hide in. Then choose how you fight.";
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
      const modes = [
        ["auto", "Auto-attack", "Your knight strikes the nearest Drowned, and mines supplies you stand beside. You move, dash and use your ability."],
        ["manual", "Manual attack", "You strike where you aim: the mouse or J on a computer, the Attack button on a phone: drag on it to aim, even while retreating. Mining has its own control: G or right-click, or the Mine button."],
      ];
      html += `<div class="mode-row" role="group" aria-label="Combat"><h3>Combat</h3>${modes.map(([id, name, desc]) =>
        `<button class="pick mode-pick ${st.attack === id ? "on" : ""}" data-mode="${id}" aria-pressed="${st.attack === id}"><span class="pick-name">${name}</span><span class="pick-line">${desc}</span></button>`).join("")}</div>`;
    }
    $("setupBody").className = "setup-grid step" + st.step;
    $("setupBody").innerHTML = html;
    UI.drawPortraits(0);
  };

  // Kit portraits: the chosen kit walks; the others stand.
  // A locked familiar's portrait: the drawing filled in as a dark shape.
  function silhouette(cv) {
    const g = cv.getContext("2d");
    g.save(); g.globalCompositeOperation = "source-atop"; g.fillStyle = "#03070a"; g.fillRect(0, 0, cv.width, cv.height); g.restore();
  }
  UI.drawPortraits = function (t) {
    for (const cv of document.querySelectorAll("canvas[data-kit]")) {
      const g = cv.getContext("2d"), id = cv.dataset.kit, on = UI.setup.kit === id || cv.dataset.still;
      g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      const anim = on && !cv.dataset.still ? (Math.floor(t / 2.4) % 2 ? "attack" : "walk") : "idle";
      const fr = anim === "attack" ? Math.floor(t * 6) % 3 : Math.floor(t * (anim === "walk" ? 8 : 1.6));
      DL.Art.drawUnit(g, id + "1", anim, fr, Math.PI / 2, cv.width / 2, cv.height - 6, cv.width / 88);
    }
    for (const cv of document.querySelectorAll("canvas[data-hound]")) {
      const g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      DL.Art.drawUnit(g, "boneHound", "idle", 0, 0, cv.width / 2 - 2, cv.height - 4, cv.width / 88);
    }
    for (const cv of document.querySelectorAll("canvas[data-wraith]")) {
      const g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      g.save();
      g.translate(cv.width / 2, cv.height - 2);
      g.scale(0.9, 0.9);
      const lk = DL.Summons.look("wraith");
      // the Soul Wisp is only glow (drawn over the dark in the world), so draw that here
      if (lk.wisp && !lk.drawn) DL.Render.drawWisp(g, 0, -26, 1.6, Math.PI / 2, 1, t);
      else DL.Render.drawWraith(g, { id: 1, x: 0, y: 0, angle: Math.PI / 2, state: "move" }, t);
      g.restore();
    }
    for (const cv of document.querySelectorAll("canvas[data-fred]")) {
      const g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      DL.Fred.portrait(g, cv, t);
    }
    for (const cv of document.querySelectorAll("canvas[data-wyvern]")) {
      const g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      DL.Wyvern.portrait(g, cv, t);
    }
    for (const cv of document.querySelectorAll("canvas[data-golem]")) {
      const g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      DL.Art.drawUnit(g, "derek", "idle", Math.floor(t * 1.6), Math.PI / 2, cv.width / 2, cv.height - 4, 1.5); // he's small: drawn big here
    }
    for (const cv of document.querySelectorAll("canvas[data-locked]")) silhouette(cv);
  };

  /* ---------------- camp menu ---------------- */
  // The camp button (and the C key): enter the camp, open an outpost's paths, or raise an outpost in this grove.
  UI.campLabel = function () {
    const G = DL.Game;
    if (G.inCamp) return "Enter camp";
    if (G.atOutpost) return "Outpost";
    if (G.save.up.flame >= DL.OUTPOST.reqFlame && G.player && DL.Outposts.claimable(G.player.x, G.player.y)) return "Raise outpost";
    return null;
  };
  UI.campAction = function () {
    const G = DL.Game, l = UI.campLabel();
    if (G.state !== "play") return;
    if (l === "Raise outpost") DL.Outposts.raise();
    else if (l) UI.openCamp();
    else UI.toast("Return to camp to build and upgrade.");
  };
  UI.openCamp = function () {
    const G = DL.Game;
    if (G.state !== "play" || !(G.inCamp || G.atOutpost)) return;
    G.state = "camp";
    // at an outpost there is only the way home and on to the other outposts
    UI.atOutpost = !G.inCamp;
    if (UI.atOutpost) UI.campTab = "travel";
    else if (UI.campTab === "travel" && !G.outposts.length) UI.campTab = "build";
    UI.renderCamp();
    $("screenCamp").classList.remove("hidden");
  };
  UI.closeCamp = function () {
    const G = DL.Game;
    $("screenCamp").classList.add("hidden");
    if (G.state === "camp") G.state = "play";
    if (UI.atOutpost) { UI.atOutpost = false; UI.campTab = "build"; }
    DL.Input.clear();
  };

  UI.renderCamp = function () {
    const G = DL.Game, s = G.save;
    for (const t of document.querySelectorAll("#campTabs button")) {
      t.classList.toggle("on", t.dataset.tab === UI.campTab);
      t.classList.toggle("hidden", UI.atOutpost ? t.dataset.tab !== "travel" : t.dataset.tab === "travel" && !G.outposts.length);
    }
    $("campStash").innerHTML = DL.RES_KEYS.map((k) => `<span class="stash-item">${chip(k, s.stash[k])}<small>${DL.RESOURCES[k].name}</small></span>`).join("");
    const tier = DL.Camp.tier(s.up);
    const siegeIn = DL.Siege.nightsLeft();
    $("campDay").textContent = (UI.atOutpost ? "Outpost · " : G.isGuest() ? "Your friend's camp · shared stash · " : "") + `Tier ${"I".repeat(tier)} · ${DL.TIER_NAMES[tier]} · Day ${s.day} · ${G.phase() === "day" ? "Daylight" : G.phase() === "night" ? "Night" : G.phase() === "dusk" ? "Dusk" : "Dawn"}` +
      ` · ${DL.Siege.on ? "GREAT SIEGE" : siegeIn === 0 ? "Great Siege tonight" : `Great Siege in ${siegeIn} night${siegeIn > 1 ? "s" : ""}`}`;
    let html = "";
    if (UI.campTab === "build") {
      let hidden = 0;
      for (const u of DL.UPGRADES) {
        const lvl = s.up[u.id], max = lvl >= u.max;
        if (!lvl && secret(u)) { hidden++; continue; } // won from a boss or a familiar: kept a surprise until then
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
      if (hidden) html += `<article class="card locked-card"><header><h3>???</h3><span class="tag">Undiscovered</span></header>
        <p>Not everything here can be built with wood and stone. ${hidden} more ${hidden > 1 ? "are" : "is"} won out in the dark, from what hunts there and from what waits to be found.</p></article>`;
    } else if (UI.campTab === "travel") {
      html += travelCards(G);
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
      html += houndCard(G);
      html += golemCard(G);
      html += wraithCard(G);
      html += fredCard(G);
      html += wyvernCard(G);
      const d = G.diff();
      html += `<article class="card"><header><h3>${d.name}</h3><span class="tag">Difficulty</span></header>
        <p class="motto">${d.motto}</p><ul class="guide">${d.notes.map((n) => `<li>${n}</li>`).join("")}</ul></article>`;
      UI.justReached = 0;
    } else {
      const st = G.stats();
      const full = s.torches >= st.torchMax;
      html += `<article class="card">
        <header><h3>Torches</h3><span class="tag">${s.torches} / ${st.torchMax}</span></header>
        <p>Plant firelight anywhere. Torches reverse corruption like the camp fire, but burn out after a while — and Lantern Reavers snuff them out.</p>
        <footer><div class="cost">${costHtml(DL.TORCH_COST)}</div><button data-act="torch" ${!full && G.canAfford(DL.TORCH_COST) ? "" : "disabled"}>${full ? "Satchel full" : "Craft"}</button></footer></article>`;
      const day = G.phase() === "day", guest = G.isGuest();
      html += `<article class="card">
        <header><h3>Rest</h3></header>
        <p>Sleep by the fire until dusk. You wake fully healed with a full lantern — ready to defend the camp through the night.</p>
        <footer><button data-act="rest" ${day && !guest ? "" : "disabled"}>${guest ? "Only the host can rest" : day ? "Rest until dusk" : "Only by day"}</button></footer></article>`;
      html += `<article class="card">
        <header><h3>Field guide</h3></header>
        <ul class="guide">
          <li><b class="warm">Firelight</b> (camp, torches, Illuminate) reverses corruption and refills your lantern.</li>
          <li><b class="cold">Bloomlight</b> (Refuge, Sentinel, Mother Root) only halts it. Blooms wake at night and grow in groves, with darkness between them: pick one before dusk and hold it.</li>
          <li>Your <b>lantern oil</b> halves corruption in the dark until it runs dry.</li>
          <li><b>Amethyst</b> deposits glow purple in the Drowned Reaches and the Abyss, farther out than iron. They stay day and night and regrow at dawn.</li>
          <li>Defend a <b>Mother Root</b> until dawn for a rich reward.</li>
          <li>${owns("hound") ? `Your <b>Bone Hound</b> rose from the pack that denned in the Mire, to the ${DL.Den.direction()}.` : `Bone Wolves den in the Mire, to the ${DL.Den.direction()}. Break the pack and carry a carcass home, and see what rises.`}</li>
          <li>${DL.Kindle.guideLine()}</li>
          <li>${DL.Abigail.guideLine()}</li>
          <li>${DL.Fred.guideLine()}</li>
          <li>${DL.Wyvern.guideLine()}</li>
          <li>${DL.Rose.guideLine()}</li>
          <li><b>Black Pearls</b> are found only in the Abyss: in clams half sunk in its mud, now and then on its Drowned, and on its great bosses. The last levels of the camp need them.</li>
          <li>${DL.Siege.line()}${s.trophies.bell ? " Your Bell Tower, hung with the Starved Bell's clapper, warns of every wave." : ""}</li>
          <li>From Central Flame ${DL.OUTPOST.reqFlame}, stand at the heart of a bloom grove to raise an <b>outpost</b>. Supplies brought there go home${DL.Kindle.lit() ? ", and with your Kindle lit you can travel between outposts and the camp" : ". Something lost in the Mire still remembers the old paths between them"}.</li>
          <li>Fall, and your <b>drowned self</b> keeps your supplies. Slay it to get them back.</li>
        </ul></article>`;
    }
    $("campBody").innerHTML = html;
    UI.drawPortraits(0);
  };

  // Whether this knight has won a familiar (each knight wins their own; a guest's come from their profile).
  function owns(kind) {
    const G = DL.Game;
    if (kind === "hound") return G.isGuest() ? DL.Net.hasHound() : !!G.save.hound;
    if (kind === "golem") return G.isGuest() ? !!DL.Net.profile().golem : !!G.save.golem;
    if (kind === "wraith") return DL.Abigail.won();
    if (kind === "fred") return DL.Fred.won();
    if (kind === "wyvern") return DL.Wyvern.won();
    return true;
  }
  UI.owns = owns;
  // A building won from a boss (a trophy) or for a familiar (its home), not yet earned in this world.
  const secret = (u) => (u.trophy && !DL.Game.save.trophies[u.trophy]) || (u.needs && !DL.Summons.anyHas(u.needs));
  /* A familiar not yet won: who it is stays a secret. Its portrait is a dark shape, and the card only says
     where to look and how the hunt is going (`action`). */
  function lockedCard(data, hint, action) {
    return `<article class="card hound-card locked-card">
      <header><canvas class="portrait" ${data} data-locked="1" width="66" height="52"></canvas>
        <div><span class="tag">Familiar · Undiscovered</span><h3>???</h3><span class="motto">Something out there could be yours.</span></div></header>
      <p>${hint}</p>
      <footer>${action}</footer></article>`;
  }

  /* A companion's level (src/summons.js): its form, a track to 15 with the forms marked, what the next form
     brings, and the training button. Shown on its card once anyone in this world has won it. */
  function summonTrain(kind) {
    const S = DL.SUMMON, K = S[kind], Sm = DL.Summons;
    if (!Sm.anyHas(kind)) return "";
    const L = Sm.level(kind), f = Sm.form(kind), info = Sm.trainInfo(kind);
    const pos = (lv) => (lv / S.max) * 100;
    const track = `<div class="lvl-track" aria-label="Level ${L} of ${S.max}"><i style="width:${pos(L)}%"></i>${S.formAt.slice(1).map((m) => `<b class="${L >= m ? "on" : ""}" style="left:${pos(m)}%">${m}</b>`).join("")}</div>`;
    const next = f < 3 ? `<br>Level ${S.formAt[f + 1]}: <b>${K.forms[f + 1]}</b>. ${K.powers[f + 1]}.` : "";
    let action;
    if (info.max) action = `<span class="maxed">Fully grown</span>`;
    else action = `<div class="cost">${costHtml(info.cost)}</div>` + (info.lock ? `<span class="req">${info.lock}</span>` : "") +
      `<button data-act="trainSummon:${kind}" ${info.ok ? "" : "disabled"}>Train to level ${L + 1}</button>`;
    return `<p class="effect"><b>${K.forms[f]}</b> · level ${L} of ${S.max} · ${K.powers[f]}.${next}</p>${track}<footer class="train">${action}</footer>`;
  }

  // At an outpost or in the camp: Kindle's paths to everywhere else.
  function travelCards(G) {
    const lock = DL.Outposts.travelLock(), dests = DL.Outposts.dests();
    const kin = DL.Kindle.lit();
    let html = `<article class="card"><header><h3>${kin ? "Kindle's paths" : "The old paths"}</h3><span class="tag">${G.outposts.length} / ${DL.Outposts.max()} outposts</span></header>
      <p>${kin ? "Your Kindle knows the old paths between the camp and your outposts." : "Old paths run between the camp and your outposts, if you had a guide."} Supplies you bring to an outpost go home to the camp's stash.</p>
      ${lock ? `<p class="effect"><span class="req">${lock}</span></p>` : ""}</article>`;
    for (const d of dests) {
      const ok = !lock && d.lit;
      html += `<article class="card"><header><h3>${d.name}</h3><span class="tag">${d.id === "camp" ? "Home" : `${d.m} m ${d.dir} of camp`}</span></header>
        <p class="effect">${d.far} m from here${d.lit ? "" : " · its fire is out until dawn"}</p>
        <footer><button data-act="travel:${d.id}" ${ok ? "" : "disabled"}>Travel</button></footer></article>`;
    }
    if (!dests.length) html += `<article class="card"><p>No outposts yet. From Central Flame ${DL.OUTPOST.reqFlame}, stand at the heart of a bloom grove and raise one.</p></article>`;
    return html;
  }

  // The Bone Hound: won at the Bone Wolf den (src/den.js), one per knight. This card says where the den is and how it's going.
  const houndState = (h) => (h ? (h.down > 0 ? "down" : "up") : DL.Den.carrying() ? "carry" : "none");
  function houndCard(G) {
    const H = DL.HOUND, st = DL.Hounds.stats(), mine = DL.Hounds.mine(), den = DL.Den.state();
    UI.houndShown = houndState(mine);
    let action;
    if (mine && mine.down > 0) action = `<span class="req">Knocked out · gets up in ${Math.ceil(mine.down)} s</span>`;
    else if (mine) action = `<span class="maxed">At your side · ${Math.ceil(mine.hp)} / ${mine.maxHp}</span>`;
    else if (DL.Den.carrying()) action = `<span class="req">You carry a carcass: bring it into the camp</span>`;
    else if (den.cleared && den.bodies.length) action = `<span class="req">The pack is broken: ${den.bodies.length} carcass${den.bodies.length > 1 ? "es lie" : " lies"} at the den, to the ${DL.Den.direction()}</span>`;
    else action = `<span class="req">Hunt the pack: the den lies in the Mire, to the ${DL.Den.direction()} of the camp</span>`;
    if (!owns("hound")) return lockedCard(`data-hound="1"`, "Five things sleep at a den of bones out in the Mire, by day and by night. Break the pack, then carry what's left of one back into the camp. In co-op every knight carries their own.", action);
    return `<article class="card hound-card">
      <header><canvas class="portrait" data-hound="1" width="66" height="52"></canvas>
        <div><span class="tag">Ally · Melee</span><h3>${H.name}</h3><span class="motto">It hunts what runs.</span></div></header>
      <p>Five Bone Wolves sleep at their den out in the Mire, by day and by night. Kill all five, then carry one of their carcasses back into the camp and it rises as your own hound. In co-op every knight carries their own.</p>
      <p>It hunts any Drowned that retreats first (Mire Stalkers, anything backing away), then anything that shoots (Tide Archers, Hexbearers), then whatever is nearest. Every bite makes them bleed.</p>
      <p class="effect">Health ${st.maxHp} · bite ${st.dmg} · bleed ${H.bleedDps}/s, stacking ${st.bleedMax}× · heals in firelight<br>Never dies: beaten down, it gets up again after ${st.downTime} s · one per knight · grows with the Central Flame and its training</p>
      ${summonTrain("hound")}
      <footer>${action}</footer></article>`;
  }

  // Derek: a stone golem familiar, one per knight, who walls the Drowned off. He's won in Derek's Hollow.
  function golemCard(G) {
    const H = DL.GOLEM, gs = DL.Summons.golem(), mine = DL.Golems.mine(), w = DL.Cave.where(), n = DL.CAVE.waves.length;
    UI.golemShown = !!mine;
    let action;
    if (G.cave) action = `<span class="req">Fighting beside you in the Hollow</span>`;
    else if (mine && !mine.trial) action = `<span class="maxed">At your side</span>`;
    else action = `<span class="req">${DL.Cave.sealed() ? "The Hollow is sealed until tomorrow night" : `The Hollow lies ${w.m} m ${w.dir} of camp · its stones part at night`}</span>`;
    const how = mine && !mine.trial ? "" : `<p class="effect"><b>Win him in Derek's Hollow.</b> A cave mouth in the Mire, ${w.m} m ${w.dir} of camp. Walk in at night and Derek wakes beside you: hold out together through ${n} waves of the Drowned, each bringing a kind you haven't faced yet. Clear them all and he's yours for good. Fall, and the Hollow seals until the next night. With friends, everyone is pulled in, and everyone gets their own Derek.</p>`;
    if (!owns("golem")) return lockedCard(`data-golem="1"`, `A cave mouth in the Mire, ${w.m} m ${w.dir} of camp, whose stones part only at night. Something sleeps in there. Hold out through ${n} waves of the Drowned beside it and it's yours. Fall, and the cave seals until the next night.`, action);
    return `<article class="card hound-card">
      <header><canvas class="portrait" data-golem="1" width="66" height="52"></canvas>
        <div><span class="tag">Familiar · Defender</span><h3>${H.name}</h3><span class="motto">Stone between you and the dark.</span></div></header>
      <p>A mossy stone golem with a glowing heart who follows you everywhere. When the Drowned close in, he raises a stone wall across their path. Any Drowned near a wall stops chasing you to smash it, and arrows and orbs break on it too.</p>
      <p class="effect">A wall every ${gs.buildCd.toFixed(1)} s · ${gs.hits} hit${gs.hits > 1 ? "s" : ""} to break · lasts ${gs.life} s · up to ${gs.maxWalls} at once<br>Can't be hurt · stays with you for good · one per knight</p>
      ${how}
      ${summonTrain("golem")}
      <footer>${action}</footer></article>`;
  }

  // Abigail: a soul wraith familiar, one per knight, won by laying soul orbs to rest at the Abyss graves.
  function wraithCard(G) {
    const A = DL.ABIGAIL, ws = DL.Summons.wraith(), mine = DL.Abigail.mine(), pr = DL.Abigail.progress(), w = DL.Abigail.where(), pct = Math.round(ws.buff * 100), cpct = Math.round(ws.curse * 100);
    UI.wraithShown = !!mine;
    let action;
    if (mine) action = `<span class="maxed">At your side${mine.buff > 0 ? " · blessing you now" : ""}</span>`;
    else if (pr.held + pr.given >= A.need) action = `<span class="req">You carry enough souls: take them to the graves${pr.found ? `, ${w.m} m ${w.dir}` : " in the Abyss"}</span>`;
    else action = `<span class="req">Soul orbs ${pr.given} laid to rest · ${pr.held} carried · ${A.need} needed</span>`;
    const how = mine ? "" : `<p class="effect"><b>Win her at the graves.</b> Soul orbs glow pale teal all over the land, from the Shallows to the Abyss. Walk over one to take it, and carry them to the old graves deep in the Abyss${pr.found ? `, ${w.m} m ${w.dir} of camp` : ""}. Lay ${A.need} to rest at the tall headstone and Abigail rises. Orbs you carry aren't lost when you fall. With friends, everyone gathers their own.</p>`;
    if (!owns("wraith")) return lockedCard(`data-wraith="1"`, `Soul orbs glow pale teal all over the land, from the Shallows to the Abyss. Walk over one to take it, and carry them to the old graves deep in the Abyss${pr.found ? `, ${w.m} m ${w.dir} of camp` : ""}. Lay ${A.need} to rest at the tall headstone and see who rises. Orbs you carry aren't lost when you fall.`, action);
    return `<article class="card hound-card">
      <header><canvas class="portrait" data-wraith="1" width="66" height="52"></canvas>
        <div><span class="tag">Familiar · Ranged · Curse</span><h3>${A.name}</h3><span class="motto">She remembers every soul the dark took.</span></div></header>
      <p>A hooded soul wraith who drifts at your shoulder. She sends homing soul orbs at the Drowned, and any Drowned an orb touches is weakened for good. Every ${A.pulseEvery} seconds she blesses you.</p>
      <p class="effect">Soul orb ${DL.Abigail.dmg()} damage every ${ws.cd.toFixed(1)} s · weakened Drowned: ${cpct}% less damage and speed, ${cpct}% more damage taken<br>${ws.bless ? `Blessing every ${A.pulseEvery} s for ${A.buffDur} s: ${pct}% more damage and speed, ${pct}% less damage taken` : "No blessing yet: she must grow out of a wisp first"}<br>Can't be hurt · stays with you for good · one per knight</p>
      ${how}
      ${summonTrain("wraith")}
      <footer>${action}</footer></article>`;
  }

  // Fred: a mushroom familiar, one per knight, won by keeping him alive through a night at his fairy ring.
  // His card also shows his roads: at levels 5, 10 and 15 the Mender's (A) or the Blight's (B).
  function fredCard(G) {
    const F = DL.FRED, Sm = DL.Summons, fs = Sm.fred(), mine = DL.Fred.mine(), w = DL.Fred.where(), tr = DL.Fred.trial();
    UI.fredShown = !!mine;
    let action;
    if (mine) action = `<span class="maxed">At your side</span>`;
    else if (tr) action = `<span class="req">The little mushroom is awake in the ring: keep him alive until dawn</span>`;
    else if (DL.Fred.sealed()) action = `<span class="req">The fairy ring has wilted · it grows back in a few nights</span>`;
    else action = `<span class="req">A fairy ring lies in the Drowned Reaches${G.save.fredRing.found ? `, ${w.m} m ${w.dir} of camp` : ""}</span>`;
    const how = DL.Fred.won() ? "" : `<p class="effect"><b>Win him at the fairy ring.</b> A ring of red toadstools grows out in the Drowned Reaches, and a tiny mushroom sleeps in it. Walk into the ring at night with a torch in your satchel and he wakes, and the Drowned come for him all night. He sprouts glowcaps for you while you fight. Keep him alive until dawn and he follows you home; if he dies, the ring wilts for ${F.wilt} nights. With friends, everyone by the ring at dawn gets their own Fred.</p>`;
    // his roads
    let roads = "";
    if (Sm.anyHas("fred")) {
      const L = Sm.level("fred"), path = Sm.fredPath();
      roads = `<ol class="ms-list">${F.roads.map((pair, i) => {
        const lv = DL.SUMMON.formAt[i + 1], got = path[i];
        if (got) { const r = pair[got === "A" ? 0 : 1]; return `<li class="got"><span>Lv ${lv}</span><b>${r.name}</b> (${got === "A" ? "Mender" : "Blight"}). ${r.text}.</li>`; }
        if (L < lv) return `<li><span>Lv ${lv}</span>Choose: <b>${pair[0].name}</b> (A, Mender) or <b>${pair[1].name}</b> (B, Blight).</li>`;
        return `<li class="new"><span>Lv ${lv}</span>Choose his road:<br><b>A · ${pair[0].name}</b>: ${pair[0].text}.<br><b>B · ${pair[1].name}</b>: ${pair[1].text}.
          <div class="road-pick"><button data-act="fredPath:${i}-A">A · ${pair[0].name}</button> <button data-act="fredPath:${i}-B">B · ${pair[1].name}</button></div></li>`;
      }).join("")}</ol>`;
      if (path.some((v) => v)) {
        const lock = Sm.repickLock(), ok = !lock && G.canAfford(F.repick);
        roads += `<footer class="train"><div class="cost">${costHtml(F.repick)}</div>${lock ? `<span class="req">${lock}</span>` : ""}<button data-act="fredRepick" ${ok ? "" : "disabled"}>Choose his roads again</button></footer>`;
      }
    }
    if (!owns("fred")) return lockedCard(`data-fred="1"`, `A ring of red toadstools grows out in the Drowned Reaches, and something small sleeps in it. Walk into the ring at night with a torch in your satchel and it wakes, and the Drowned come for it all night. Keep it alive until dawn; if it dies, the ring wilts for ${F.wilt} nights.`, action);
    return `<article class="card hound-card">
      <header><canvas class="portrait" data-fred="1" width="66" height="52"></canvas>
        <div><span class="tag">Familiar · Healer · Control</span><h3>${F.name}</h3><span class="motto">Small, frightened, and full of spores.</span></div></header>
      <p>A little mushroom with lanterns hanging from his cap, who toddles after you everywhere. He spits spore globs that slow the Drowned (bosses only half as much), and by night, or in the Abyss, he sprouts glowcaps at his feet: step on one to heal.</p>
      <p class="effect">Spore glob ${DL.Fred.dmg()} damage every ${fs.cd.toFixed(1)} s · ${Math.round(F.slow * 100)}% slower for ${F.slowFor} s<br>A glowcap every ${fs.capEvery} s: heals ${Math.round(fs.capHeal)}${fs.cleanse ? `, burns away ${fs.cleanse} corruption` : ""}<br>Can't be hurt · stays with you for good · one per knight · bosses are never befuddled, turned or put to sleep</p>
      ${how}
      ${summonTrain("fred")}
      ${roads}
      <footer>${action}</footer></article>`;
  }

  // David: a wyvern familiar, one per knight, won by stealing an egg from his mother's nest and killing her.
  // His card also shows his roads: at levels 5, 10 and 15 the Storm's (A) or the Fire's (B).
  function wyvernCard(G) {
    const W = DL.WYVERN, Sm = DL.Summons, ws = Sm.wyvern(), mine = DL.Wyvern.mine(), w = DL.Wyvern.where(), found = G.isGuest() || G.save.wyvNest.found;
    UI.wyvernShown = !!mine;
    let action;
    if (mine) action = `<span class="maxed">At your side${DL.Wyvern.boostT > 0 ? ` · ${DL.Wyvern.boostName()} now` : ""}</span>`;
    else if (DL.Wyvern.carrying()) action = `<span class="req">You carry her egg: slay the mother wyvern before she kills you</span>`;
    else if (DL.Wyvern.empty()) action = `<span class="req">The nest lies empty · its mother is gone for a few days</span>`;
    else action = `<span class="req">A wyvern's nest lies in the Drowned Reaches${found ? `, ${w.m} m ${w.dir} of camp` : ""}</span>`;
    const hint = `A wyvern nests on the rocks of the Drowned Reaches${found ? `, ${w.m} m ${w.dir} of camp` : ""}, and while she hunts her clutch of blood-red eggs lies unguarded. Walk into the nest and take one, and she will hunt you wherever you run, over walls and water, until one of you is dead. Slay her and see what hatches; fall, and she takes her egg back.`;
    if (!owns("wyvern")) return lockedCard(`data-wyvern="1"`, hint, action);
    let roads = "";
    if (Sm.anyHas("wyvern")) {
      const L = Sm.level("wyvern"), path = Sm.path("wyvern");
      roads = `<ol class="ms-list">${W.roads.map((pair, i) => {
        const lv = DL.SUMMON.formAt[i + 1], got = path[i];
        if (got) { const r = pair[got === "A" ? 0 : 1]; return `<li class="got"><span>Lv ${lv}</span><b>${r.name}</b> (${got === "A" ? "Storm" : "Fire"}). ${r.text}.</li>`; }
        if (L < lv) return `<li><span>Lv ${lv}</span>Choose: <b>${pair[0].name}</b> (A, Storm) or <b>${pair[1].name}</b> (B, Fire).</li>`;
        return `<li class="new"><span>Lv ${lv}</span>Choose his road:<br><b>A · ${pair[0].name}</b>: ${pair[0].text}.<br><b>B · ${pair[1].name}</b>: ${pair[1].text}.
          <div class="road-pick"><button data-act="wyvPath:${i}-A">A · ${pair[0].name}</button> <button data-act="wyvPath:${i}-B">B · ${pair[1].name}</button></div></li>`;
      }).join("")}</ol>`;
      if (path.some((v) => v)) {
        const lock = Sm.repickLock("wyvern"), ok = !lock && G.canAfford(W.repick);
        roads += `<footer class="train"><div class="cost">${costHtml(W.repick)}</div>${lock ? `<span class="req">${lock}</span>` : ""}<button data-act="wyvRepick" ${ok ? "" : "disabled"}>Choose his roads again</button></footer>`;
      }
    }
    const boost = ws.boost ? `<br>${DL.Wyvern.boostName()}: press <b>Boost</b> (${UI.keyLabel("boost")[0] || "—"}) · lasts ${W.boostFor} s · again ${W.boostEvery} s after it began` : "";
    return `<article class="card hound-card">
      <header><canvas class="portrait" data-wyvern="1" width="66" height="52"></canvas>
        <div><span class="tag">Familiar · Ranged · Boost</span><h3>${W.name}</h3><span class="motto">Stolen as an egg. His mother never forgave you.</span></div></header>
      <p>A wyvern of bone and torn red wings who flies at your shoulder, over walls and water alike, and spits bolts at the Drowned. At levels 5, 10 and 15 he takes the road of the Storm (lightning that leaps between foes, and speed) or of the Fire (great single blows, and fury).</p>
      <p class="effect">${ws.chain ? "Chain lightning" : ws.sear ? "Searing bolt" : "Bolt"} ${Math.round(DL.Wyvern.dmg() * (ws.sear ? W.searMult : 1) * 10) / 10} damage every ${ws.cd.toFixed(1)} s${ws.chain ? `, leaping to ${W.chainN} more` : ws.sear ? ", sets it burning" : ""}${boost}<br>Can't be hurt · stays with you for good · one per knight</p>
      ${summonTrain("wyvern")}
      ${roads}
      <footer>${action}</footer></article>`;
  }

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

    set($("zoneText"), "text", G.cave ? "Derek's Hollow" : DL.ZONES[p.zi].name);
    const N = DL.Net;
    const coopText = !N.role ? "" : N.role === "guest" ? "Co-op · your friend's world" : G.allies.length ? `Co-op · ${G.allies.length + 1} players · room ${N.code}` : `Room ${N.code} · waiting for friends`;
    set($("coopChip"), "text", coopText);
    set($("coopChip"), "hidden", !coopText);
    const d = Math.hypot(p.x, p.y);
    set($("homeArrow"), "transform", `rotate(${(Math.atan2(-p.y, -p.x) * 180) / Math.PI}deg)`);
    set($("homeDist"), "text", G.cave ? "Camp: far above" : DL.Camp.sq(p.x, p.y) < DL.CAMP_RADIUS ? "At camp" : `Camp ${Math.round(d / 10)}m`);
    // the way to Derek's Hollow, once found, until you've won him
    const cn = DL.Cave.showNav();
    set($("caveNav"), "hidden", !cn);
    if (cn) {
      const m = DL.Cave.mouth();
      set($("caveArrow"), "transform", `rotate(${(Math.atan2(m.y - p.y, m.x - p.x) * 180) / Math.PI}deg)`);
      set($("caveDist"), "text", `Hollow ${Math.round(Math.hypot(m.x - p.x, m.y - p.y) / 10)}m`);
    }
    // the way to the Abyss graves, once found, while you carry soul orbs
    const gn = DL.Abigail.showNav();
    set($("graveNav"), "hidden", !gn);
    if (gn) {
      const m = DL.Abigail.graveSpot();
      set($("graveArrow"), "transform", `rotate(${(Math.atan2(m.y - p.y, m.x - p.x) * 180) / Math.PI}deg)`);
      set($("graveDist"), "text", `Graves ${Math.round(Math.hypot(m.x - p.x, m.y - p.y) / 10)}m`);
    }
    // the way to the Deadly Rose's garden, once found, while she lives
    const rn = DL.Rose.showNav();
    set($("roseNav"), "hidden", !rn);
    if (rn) {
      const m = DL.Rose.lair();
      set($("roseArrow"), "transform", `rotate(${(Math.atan2(m.y - p.y, m.x - p.x) * 180) / Math.PI}deg)`);
      set($("roseDist"), "text", `Rose ${Math.round(Math.hypot(m.x - p.x, m.y - p.y) / 10)}m`);
    }
    const ds = G.save.drownedSelf;
    set($("selfNav"), "hidden", !ds);
    // where your nearest co-op friend is
    let fr = null;
    for (const a of G.allies) if (!fr || Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(fr.x - p.x, fr.y - p.y)) fr = a;
    set($("friendNav"), "hidden", !fr);
    if (fr) {
      set($("friendArrow"), "transform", `rotate(${(Math.atan2(fr.y - p.y, fr.x - p.x) * 180) / Math.PI}deg)`);
      set($("friendDist"), "text", `${fr.label || "Friend"} ${Math.round(Math.hypot(fr.x - p.x, fr.y - p.y) / 10)}m`);
    }
    set($("hostPaused"), "hidden", !(G.isGuest() && G.hostState === "pause"));
    if (ds) {
      set($("selfArrow"), "transform", `rotate(${(Math.atan2(ds.y - p.y, ds.x - p.x) * 180) / Math.PI}deg)`);
      set($("selfDist"), "text", `Drowned self ${Math.round(Math.hypot(ds.x - p.x, ds.y - p.y) / 10)}m`);
    }

    // soul orbs and a hauled Bone Wolf carcass go in the satchel line too
    const souls = DL.Abigail.won() ? 0 : DL.Abigail.held(), carcass = (DL.Den.carrying() ? `<span class="chip carcass"><i></i>Bone Wolf carcass</span>` : "") + (DL.Wyvern.carrying() ? `<span class="chip egg"><i></i>Wyvern egg</span>` : "");
    const carried = DL.RES_KEYS.filter((k) => p.carried[k] > 0).map((k) => chip(k, p.carried[k])).join("") + (souls ? `<span class="chip soul"><i></i>${souls} soul orb${souls > 1 ? "s" : ""}</span>` : "") + carcass;
    set($("carried"), "html", carried ? `<span class="lbl">Carrying</span>${carried}` : "");

    // objective banner
    let obj = "";
    if (G.cave) obj = DL.Cave.objective();
    else if (G.isGuest() && (G.hostState === "dead" || G.hostState === "dying")) obj = "Your friend has fallen — waiting for them to rise";
    else if (DL.Wyvern.carrying()) obj = "The mother wyvern hunts you — slay her to keep the egg";
    else if (!G.flame.lit) obj = "The Central Flame is out — survive until dawn";
    else if (G.night && Math.hypot(p.x, p.y) < G.siegeRadius()) obj = `Defend the camp · Flame ${Math.ceil(G.flame.hp)} / ${G.flame.max}`;
    else if (G.rootEvent && !G.rootEvent.obj.dead && Math.hypot(p.x - G.rootEvent.obj.x, p.y - G.rootEvent.obj.y) < 650) obj = `Defend the Mother Root until dawn · ${Math.ceil(G.rootEvent.obj.hp)} / ${Math.round(G.rootEvent.obj.maxHp)}`;
    set($("objective"), "text", obj);
    set($("objective"), "hidden", !obj);

    const kit = G.kit();
    set($("abilityName"), "text", kit.ability.name);
    const abFrac = p.abiCd > 0 ? p.abiCd / DL.Kits.abilityCd() : 0;
    set($("kitLine"), "text", `${kit.name} · Lv ${G.save.kitLevel} · ${G.diff().name}${DL.Abigail.buffed() ? " · Abigail's blessing" : ""}`);
    set($("btnAbility"), "--cd", abFrac.toFixed(3));
    set($("btnAbility"), "class", "act" + (p.oil < kit.ability.oil ? " low" : ""));
    set($("btnDash"), "--cd", (p.dashCd / DL.Kits.dashCd()).toFixed(3));
    // David's boost: shown once his level 10 road is chosen
    const hb = DL.Wyvern.hasBoost();
    set($("btnBoost"), "class", "act small" + (hb ? "" : " hidden") + (DL.Wyvern.boostKind === "A" || DL.Summons.wyvern().boost === "A" ? " storm" : "") + (DL.Wyvern.boostT > 0 ? " on" : ""));
    if (hb) {
      set($("btnBoost"), "--cd", (DL.Wyvern.boostT > 0 ? 0 : DL.Wyvern.boostCd / DL.WYVERN.boostEvery).toFixed(3));
      set($("boostName"), "text", DL.Wyvern.boostT > 0 ? Math.ceil(DL.Wyvern.boostT) + " s" : DL.Wyvern.boostName());
    }
    set($("torchCount"), "text", String(G.save.torches));
    const manual = G.save.attackMode === "manual";
    set($("btnAttack"), "hidden", !manual);
    set($("btnMine"), "class", "act small mine" + (manual ? "" : " hidden") + (G.mineTarget ? " ready" : ""));
    document.body.classList.toggle("manual", manual);
    const cl = UI.campLabel();
    set($("campBtn"), "hidden", !cl);
    if (cl && UI.campShown !== cl) { UI.campShown = cl; $("campBtn").innerHTML = `${cl} <kbd data-pad="${UI.padLabel("camp")[0] || ""}">${UI.keyLabel("camp")[0] || ""}</kbd>`; }
    // the Bone Hound card follows the hound rising, going down or getting up while the menu is open
    if (G.state === "camp" && UI.campTab === "kit" && (houndState(DL.Hounds.mine()) !== UI.houndShown || !!DL.Golems.mine() !== UI.golemShown || !!DL.Abigail.mine() !== UI.wraithShown || !!DL.Fred.mine() !== UI.fredShown || !!DL.Wyvern.mine() !== UI.wyvernShown)) UI.renderCamp();
  };
})(window.DL);
