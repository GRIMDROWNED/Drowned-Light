/* Drowned Light — the player's own key and controller bindings, kept on this device.
   Menus keep fixed controls (mouse, Esc, and the pad's D-pad / A / B) so a bad binding can't lock anyone out. */
"use strict";
(function (DL) {
  const STORE = "drowned-light-binds";

  // Rebindable actions, in the order the Controls screen lists them. Keys are KeyboardEvent.key in lower case;
  // pad buttons are standard-mapping numbers. Movement stays on the sticks and D-pad, and the arrow keys always move.
  const ACTIONS = [
    { id: "up", name: "Move up", keys: ["w"] },
    { id: "down", name: "Move down", keys: ["s"] },
    { id: "left", name: "Move left", keys: ["a"] },
    { id: "right", name: "Move right", keys: ["d"] },
    { id: "dash", name: "Dash", keys: [" ", "shift"], pad: [0] },
    { id: "ability", name: "Kit ability", keys: ["e", "q"], pad: [1] },
    { id: "torch", name: "Place torch", keys: ["f", "t"], pad: [4] },
    { id: "boost", name: "Familiar boost", keys: ["r"], pad: [5] },
    { id: "camp", name: "Camp menu", keys: ["c"], pad: [3] },
    { id: "pause", name: "Pause", keys: ["p"], pad: [9, 8] },
    { id: "attack", name: "Attack (manual)", keys: ["j", "k"], pad: [7, 2] },
    { id: "mine", name: "Mine (manual)", keys: ["g"], pad: [6] },
  ];
  const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "D-pad up", "D-pad down", "D-pad left", "D-pad right", "Xbox"];

  const Binds = (DL.Binds = { ACTIONS, keys: {}, pad: {} });

  Binds.defaults = function () {
    for (const a of ACTIONS) {
      Binds.keys[a.id] = a.keys.slice();
      if (a.pad) Binds.pad[a.id] = a.pad.slice();
    }
  };
  Binds.load = function () {
    Binds.defaults();
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) { /* no storage */ }
    if (!s) return;
    for (const a of ACTIONS) {
      if (s.keys && Array.isArray(s.keys[a.id])) Binds.keys[a.id] = s.keys[a.id].filter((k) => typeof k === "string");
      if (a.pad && s.pad && Array.isArray(s.pad[a.id])) Binds.pad[a.id] = s.pad[a.id].filter((b) => Number.isInteger(b));
    }
    // An action added since these were saved keeps its own defaults: they come off whatever older action had them.
    for (const a of ACTIONS) for (const [kind, map] of [["keys", Binds.keys], ["pad", Binds.pad]]) {
      if (!map[a.id] || (s[kind] && s[kind][a.id])) continue;
      for (const id in map) if (id !== a.id && map[id].some((v) => map[a.id].includes(v)) && map[id].some((v) => !map[a.id].includes(v))) map[id] = map[id].filter((v) => !map[a.id].includes(v));
    }
  };
  Binds.save = function () {
    try { localStorage.setItem(STORE, JSON.stringify({ keys: Binds.keys, pad: Binds.pad })); } catch (e) { /* ignore */ }
  };
  Binds.reset = function () {
    Binds.defaults();
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
  };

  // Bind one key (or pad button) to an action, replacing what it had. An action that used it loses it,
  // and if that leaves it with nothing, the two swap so no action is left unbound.
  Binds.set = function (kind, id, v) {
    const map = kind === "pad" ? Binds.pad : Binds.keys, old = map[id].filter((x) => x !== v);
    for (const k in map) {
      if (k === id || !map[k].includes(v)) continue;
      map[k] = map[k].filter((x) => x !== v);
      if (!map[k].length) map[k] = old.slice();
    }
    map[id] = [v];
    Binds.save();
  };

  Binds.keyAction = function (k) {
    for (const id in Binds.keys) if (Binds.keys[id].includes(k)) return id;
    return null;
  };
  Binds.held = function (id, keys) { return Binds.keys[id].some((k) => keys.has(k)); };
  Binds.padHeld = function (id, btn) { return (Binds.pad[id] || []).some((b) => btn[b]); };

  Binds.keyName = function (k) {
    if (k === " ") return "Space";
    if (k.length === 1) return k.toUpperCase();
    return k.replace(/^arrow/, "").replace(/^./, (c) => c.toUpperCase());
  };
  Binds.padName = (b) => PAD_NAMES[b] || "Button " + b;

  Binds.load();
})(window.DL);
