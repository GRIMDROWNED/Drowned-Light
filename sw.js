/* Drowned Light — service worker: lets the installed app start offline.
   Network first, so a new version on GitHub Pages shows up on the next launch;
   the cached copy is used only when there's no connection. */
const CACHE = "drowned-light-v1";
const FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "src/core.js", "src/data.js", "src/camp.js", "src/art.js", "src/units.js",
  "src/world.js", "src/game.js", "src/render.js", "src/ui.js", "src/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
