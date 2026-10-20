/* Drowned Light — boot and main loop. */
"use strict";
(function (DL) {
  const G = DL.Game, UI = DL.UI, Input = DL.Input;

  function handleGlobalKeys() {
    if (Input.take("pause")) {
      if (G.state === "play") UI.pause();
      else if (G.state === "pause") UI.resume();
      else if (G.state === "camp") UI.closeCamp();
    }
    if (Input.take("camp")) {
      if (G.state === "play") {
        if (G.inCamp) UI.openCamp(); else UI.toast("Return to camp to build and upgrade.");
      } else if (G.state === "camp") UI.closeCamp();
    }
    if (G.state !== "play") Input.clear();
  }

  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    handleGlobalKeys();
    G.update(dt);
    DL.Render.draw(G);
    UI.update();
    requestAnimationFrame(frame);
  }

  async function boot() {
    Input.init();
    DL.Render.init();
    G.init();
    UI.init();
    await DL.Art.load();
    document.body.classList.add("ready");
    UI.showTitle();
    requestAnimationFrame((ts) => { last = ts; frame(ts); });
  }
  boot();

  // Installable app: cache the game so it also starts offline (needs https or localhost).
  if ("serviceWorker" in navigator && /^(https:|http:\/\/localhost)/.test(location.href)) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {}));
    // When a newer version takes over an already-running app, reload once to pick it up.
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
  }
})(window.DL);
