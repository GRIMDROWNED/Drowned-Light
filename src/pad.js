/* Drowned Light — game controller (Xbox layout, the browser's standard gamepad mapping).
   In play the pad feeds DL.Input like the keyboard does, through the player's bindings (src/binds.js).
   On menus it moves a highlight between the buttons of the open screen: D-pad or left stick to move,
   A to press, B to go back. Those menu buttons are fixed, so a bad binding can't lock anyone out. */
"use strict";
(function (DL) {
  const $ = (id) => document.getElementById(id);
  // standard mapping button numbers
  const A = 0, B = 1, LB = 4, RB = 5, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
  const DEAD = 0.2;      // stick deadzone in play
  const NAV = 0.55;      // stick push that counts as a menu move
  const REPEAT_FIRST = 0.38, REPEAT_NEXT = 0.12;

  const Pad = (DL.Pad = { active: false, prev: [], cur: null, curKey: "", held: null, holdT: 0 });

  const pressed = (b) => !!b && (b.pressed || b.value > 0.5);
  const dead = (v, d) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

  function firstPad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }

  Pad.init = function () {
    // The highlight and the controller button hints show only while the pad is in use.
    const off = () => { if (Pad.active) { Pad.active = false; document.body.classList.remove("pad"); mark(null); } };
    addEventListener("keydown", off);
    addEventListener("pointerdown", off);
    addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && (Math.abs(e.movementX) + Math.abs(e.movementY)) > 2) off(); });
    addEventListener("gamepaddisconnected", () => {
      if (firstPad()) return;
      clearPlay();
      if (DL.Game.state === "play") DL.UI.pause(); // don't leave the knight standing in the dark
    });
  };

  function clearPlay() {
    const I = DL.Input;
    I.pad.x = I.pad.y = 0;
    I.padAttack = I.padMine = false;
    I.padAim = null;
  }

  // Short rumble, where the browser supports it.
  Pad.rumble = function (strong = 0.5, weak = 0.3, ms = 120) {
    const p = Pad.active && firstPad();
    const v = p && p.vibrationActuator;
    if (!v || !v.playEffect) return;
    try { v.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (e) { /* not supported */ }
  };

  Pad.poll = function (dt) {
    const p = firstPad();
    if (!p) { if (Pad.prev.length) { Pad.prev = []; clearPlay(); } return; }
    const btn = p.buttons.map(pressed);
    const ax = p.axes;
    const down = (i) => btn[i] && !Pad.prev[i];
    const anyInput = btn.some(Boolean) || ax.some((v) => Math.abs(v) > 0.5);
    if (anyInput && !Pad.active) { Pad.active = true; document.body.classList.add("pad"); }

    const G = DL.Game;
    if (G.state === "play") playInput(p, btn, ax, down);
    else { clearPlay(); if (Pad.active) menuInput(btn, ax, down, dt); }
    Pad.prev = btn;
  };

  /* ---------------- in play ---------------- */
  function playInput(p, btn, ax, down) {
    const I = DL.Input;
    let x = dead(ax[0] || 0, DEAD), y = dead(ax[1] || 0, DEAD);
    if (btn[LEFT]) x -= 1;
    if (btn[RIGHT]) x += 1;
    if (btn[UP]) y -= 1;
    if (btn[DOWN]) y += 1;
    I.pad.x = x; I.pad.y = y;
    const rx = ax[2] || 0, ry = ax[3] || 0;
    I.padAim = Math.hypot(rx, ry) > 0.4 ? Math.atan2(ry, rx) : null;
    const Bn = DL.Binds;
    I.padAttack = Bn.padHeld("attack", btn);
    I.padMine = Bn.padHeld("mine", btn);
    for (const a of ["dash", "ability", "torch", "boost", "camp", "pause"]) if (Bn.pad[a].some(down)) I.trigger(a);
  }

  /* ---------------- on menus ---------------- */
  // The screen on top (the last one open in page order).
  function openScreen() {
    const open = document.querySelectorAll(".screen:not(.hidden)");
    return open.length ? open[open.length - 1] : null;
  }
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  function targets(scope) {
    return [...scope.querySelectorAll("button, input")].filter(shown);
  }
  // A name for a button that survives the screen redrawing itself.
  function keyOf(el) {
    const d = el.dataset;
    return el.id || d.act || d.tab || d.pick || d.mode || d.coopkit || d.boot || (d.slot ? d.slot + d.slotAct : "") || el.textContent.trim();
  }
  function mark(el) {
    if (Pad.cur && Pad.cur !== el) Pad.cur.classList.remove("pad-focus");
    Pad.cur = el;
    if (!el) return;
    Pad.curKey = keyOf(el);
    el.classList.add("pad-focus");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return DL.View.toStage(r.left + r.width / 2, r.top + r.height / 2);
  }
  // Nearest button in the pushed direction, favouring ones straight ahead.
  function step(list, from, dx, dy) {
    const c = center(from);
    let best = null, bs = 1e9;
    for (const el of list) {
      if (el === from) continue;
      const q = center(el), vx = q.x - c.x, vy = q.y - c.y;
      const ahead = vx * dx + vy * dy, side = Math.abs(vx * dy - vy * dx);
      if (ahead < 4) continue;
      const s = ahead + side * 2.5;
      if (s < bs) { bs = s; best = el; }
    }
    return best;
  }

  function back(scr) {
    const UI = DL.UI;
    if (document.activeElement && document.activeElement.tagName === "INPUT") { document.activeElement.blur(); return; }
    switch (scr.id) {
      case "screenPause": UI.resume(); break;
      case "screenCamp": UI.closeCamp(); break;
      case "screenControls": UI.closeControls(); break;
      case "screenSetup": $("setupBack").click(); break;
      case "screenSaves": $("btnSavesBack").click(); break;
      case "screenCoop": $("btnCoopBack").click(); break;
    }
  }

  // LB / RB: the camp tabs to the left and right.
  function campTab(dir) {
    const tabs = targets($("campTabs"));
    const i = tabs.findIndex((t) => t.classList.contains("on"));
    const t = tabs[(i + dir + tabs.length) % tabs.length];
    if (t && t !== tabs[i]) { t.click(); mark(t); DL.Sound.play("chime"); }
  }

  function menuInput(btn, ax, down, dt) {
    // Rebinding on the Controls screen: the next button pressed is the new one.
    const cap = DL.UI.capture;
    if (cap && cap.kind === "pad") {
      const b = btn.findIndex((on, i) => on && !Pad.prev[i]);
      if (b >= 0) DL.UI.endCapture(b);
      return;
    }
    if (cap && down(B)) { DL.UI.endCapture(); return; }
    const scr = openScreen();
    if (!scr) { mark(null); return; }
    const list = targets(scr);
    if (!list.length) { mark(null); return; }
    if (!Pad.cur || !list.includes(Pad.cur)) {
      mark(list.find((el) => keyOf(el) === Pad.curKey) || list.find((el) => el.classList.contains("primary") && !el.disabled) || list.find((el) => !el.disabled) || list[0]);
    }

    // move: D-pad or left stick, repeating while held
    let dx = 0, dy = 0;
    const lx = ax[0] || 0, ly = ax[1] || 0;
    if (btn[LEFT] || lx < -NAV) dx = -1;
    else if (btn[RIGHT] || lx > NAV) dx = 1;
    else if (btn[UP] || ly < -NAV) dy = -1;
    else if (btn[DOWN] || ly > NAV) dy = 1;
    const dir = dx || dy ? dx + "," + dy : null;
    if (dir !== Pad.held) { Pad.held = dir; Pad.holdT = REPEAT_FIRST; if (dir) go(); }
    else if (dir && (Pad.holdT -= dt) <= 0) { Pad.holdT = REPEAT_NEXT; go(); }
    function go() {
      const n = step(list, Pad.cur, dx, dy);
      if (n) mark(n);
    }

    // right stick scrolls long screens (the camp)
    const ry = dead(ax[3] || 0, DEAD);
    if (ry) scr.scrollTop += ry * 900 * dt;

    if (down(A)) {
      const el = Pad.cur;
      if (el.tagName === "INPUT") el.focus();
      else if (el.disabled) DL.Sound.play("deny");
      else el.click();
    }
    if (down(B)) back(scr);
    const bound = (a) => DL.Binds.pad[a].some(down);
    if (scr.id === "screenCamp") {
      if (down(LB)) campTab(-1);
      if (down(RB)) campTab(1);
      if (bound("camp") || bound("pause")) DL.UI.closeCamp();
    } else if (bound("pause") && (scr.id === "screenPause" || scr.id === "screenControls")) back(scr);
  }
})(window.DL);
