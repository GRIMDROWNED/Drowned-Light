/* Drowned Light — view orientation: Auto, Portrait or Landscape.
   An installed app can lock the screen rotation. Where it can't, a phone held the
   "wrong" way turns the whole game 90°, and a desktop window shows a portrait or
   landscape play area with dark bars. */
"use strict";
(function (DL) {
  const PREFS = "drowned-light-prefs";
  const View = (DL.View = { mode: "auto", rot: 0, stage: null });
  View.MODES = ["auto", "portrait", "landscape"];
  View.LABELS = { auto: "Auto", portrait: "Portrait", landscape: "Landscape" };

  View.init = function () {
    View.stage = document.getElementById("stage");
    try { View.mode = (JSON.parse(localStorage.getItem(PREFS)) || {}).view || "auto"; } catch (e) { /* no storage */ }
    if (!View.MODES.includes(View.mode)) View.mode = "auto";
    addEventListener("resize", () => View.apply());
    addEventListener("orientationchange", () => setTimeout(() => View.apply(), 150));
    View.apply();
  };

  View.set = function (mode) {
    View.mode = mode;
    try { localStorage.setItem(PREFS, JSON.stringify({ view: mode })); } catch (e) { /* ignore */ }
    View.lock();
    View.apply();
  };
  View.cycle = function () { View.set(View.MODES[(View.MODES.indexOf(View.mode) + 1) % View.MODES.length]); };

  // Ask the device to rotate for us (works in the installed app and in fullscreen).
  View.lock = function () {
    const o = screen.orientation;
    if (!o) return;
    try {
      if (View.mode === "auto") { if (o.unlock) o.unlock(); return; }
      if (o.lock) o.lock(View.mode).catch(() => {});
    } catch (e) { /* not supported */ }
  };

  View.apply = function () {
    const st = View.stage;
    if (!st) return;
    st.className = "";
    View.rot = 0;
    if (View.mode !== "auto") {
      const portraitNow = innerHeight >= innerWidth;
      if ((View.mode === "portrait") !== portraitNow) {
        const touch = matchMedia("(pointer: coarse)").matches;
        if (touch) { st.className = "rot"; View.rot = 90; }
        else st.className = View.mode === "portrait" ? "box-portrait" : "box-landscape";
      }
    }
    if (DL.Render && DL.Render.cv) DL.Render.resize();
  };

  // Screen (client) coordinates → coordinates inside the possibly rotated stage.
  View.toStage = function (cx, cy) {
    const r = View.stage ? View.stage.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth };
    if (View.rot === 90) return { x: cy - r.top, y: r.right - cx };
    return { x: cx - r.left, y: cy - r.top };
  };
  View.size = function () {
    const st = View.stage;
    return st ? { w: st.clientWidth, h: st.clientHeight } : { w: innerWidth, h: innerHeight };
  };
})(window.DL);
