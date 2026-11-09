/* Drowned Light — boot and main loop. */
"use strict";
(function (DL) {
  const G = DL.Game, UI = DL.UI, Input = DL.Input;

  function handleGlobalKeys() {
    if (Input.take("pause")) {
      if (!document.getElementById("screenControls").classList.contains("hidden")) UI.closeControls();
      else if (G.state === "play") UI.pause();
      else if (G.state === "pause") UI.resume();
      else if (G.state === "camp") UI.closeCamp();
    }
    if (Input.take("camp")) {
      if (G.state === "play") {
        UI.campAction();
      } else if (G.state === "camp") UI.closeCamp();
    }
    if (G.state !== "play") Input.clear();
  }

  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame); // scheduled first, so one bad frame can't stop the game
    const gap = (ts - last) / 1000 || 0, dt = Math.min(0.05, gap), t0 = performance.now();
    last = ts;
    DL.Pad.poll(dt);
    handleGlobalKeys();
    G.update(dt);
    DL.Net.tick(dt);
    DL.Finale.tick(); // the victory screen, once the Drowned Gate has opened
    const t1 = performance.now();
    // Messages and the objective banner stay hidden while paused or in a menu.
    document.body.classList.toggle("menu-open", G.state !== "play");
    DL.Render.draw(G);
    const t2 = performance.now();
    UI.update();
    const t3 = performance.now();
    // drops the resolution if the device can't keep up, and feeds the ?perf readout
    DL.Render.perf(gap, (t3 - t0) / 1000, G.state === "play", { update: (t1 - t0) / 1000, draw: (t2 - t1) / 1000, hud: (t3 - t2) / 1000 });
  }

  // Studio splash: shown from the first paint, held briefly, then fades into the title.
  const splashShown = performance.now();
  const SPLASH_MS = 2400;
  let splashGone = false;
  function hideSplash() {
    try { sessionStorage.setItem("dl-splash", "1"); } catch (e) {}
    const el = document.getElementById("splash");
    if (!el || splashGone) return;
    splashGone = true;
    el.classList.add("out");
    setTimeout(() => el.remove(), 1000);
  }
  const splashEl = document.getElementById("splash");
  if (splashEl) {
    splashEl.addEventListener("pointerdown", hideSplash);
    addEventListener("keydown", hideSplash, { once: true });
    addEventListener("gamepadconnected", hideSplash, { once: true });
  }

  async function boot() {
    DL.View.init();
    DL.View.lock();
    Input.init();
    DL.Pad.init();
    DL.Render.init();
    G.init();
    UI.init();
    DL.World.loadGround();
    await DL.Art.load();
    document.body.classList.add("ready");
    UI.showTitle();
    requestAnimationFrame((ts) => { last = ts; frame(ts); });
    setTimeout(hideSplash, Math.max(0, SPLASH_MS - (performance.now() - splashShown)));
  }
  boot();

  // Installable app: cache the game so it also starts offline (needs https or localhost).
  if ("serviceWorker" in navigator && /^(https:|http:\/\/localhost)/.test(location.href)) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {}));
    // No reload when a newer version takes over: the worker always fetches fresh files first,
    // so this launch already runs the latest code, and a reload would replay the splash mid-game.
  }
})(window.DL);
