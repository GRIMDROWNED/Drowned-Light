/* Drowned Light — service worker: lets the installed app start offline.
   Always asks the network for fresh files first (skipping the browser's HTTP cache),
   so a new version on GitHub Pages shows up on the next launch; the saved copy is
   used only when there's no connection. Bump VERSION together with index.html. */
const VERSION = "0.14.0";
const CACHE = "drowned-light-" + VERSION;
const FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "src/core.js", "src/view.js", "src/data.js", "src/camp.js", "src/art.js", "src/units.js", "src/sprites.js",
  "src/world.js", "src/game.js", "src/kits.js", "src/net.js", "src/render.js", "src/ui.js", "src/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "assets/drowned-games.jpg",
  ...Object.entries({
    "camp/": ["firering", "garden", "palisade", "pylon", "rack", "tower", "workbench"],
    "drowned/archer/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/blackguard/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/champion/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/defiler/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/footman/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/hexbearer/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "drowned/revenant/": ["attackA", "attackB", "r0", "r1", "r2", "r3", "r4", "r5"],
    "drowned/squire/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "lantern-knight/": ["attackA", "attackB", "attackC", "back", "front", "right"],
    "lantern-knight/side/": ["dash", "death", "hurt", "idle", "walk1", "walk2", "walk3"],
    "plants/": ["husk", "refugeOff", "refugeOn", "rootOff", "rootOn", "sentinelOff", "sentinelOn", "sproutBare", "sproutOff", "sproutOn"],
    "world/": ["driftwood", "grave", "pillar", "reeds", "rock", "tree0", "tree1"],
  }).flatMap(([dir, names]) => names.map((n) => "assets/sprites/" + dir + n + ".png")),
].map((f) => (/\.(js|css|jpg)$/.test(f) ? f + "?v=" + VERSION : f));

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
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
  const fresh = req.mode === "navigate" ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : new Request(req, { cache: "no-cache" });
  e.respondWith(
    fetch(fresh)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true })).then((r) => r || caches.match("index.html")))
  );
});
