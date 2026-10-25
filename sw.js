/* Drowned Light — service worker: lets the installed app start offline.
   Always asks the network for fresh files first (skipping the browser's HTTP cache),
   so a new version on GitHub Pages shows up on the next launch; the saved copy is
   used only when there's no connection. Bump VERSION together with index.html. */
const VERSION = "0.15.82";
const CACHE = "drowned-light-" + VERSION;
const FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "src/core.js", "src/view.js", "src/data.js", "src/camp.js", "src/art.js", "src/units.js", "src/sprites.js",
  "src/world.js", "src/game.js", "src/hounds.js", "src/den.js", "src/golem.js", "src/cave.js", "src/colossus.js", "src/kindle.js", "src/abigail.js", "src/bell.js", "src/rose.js", "src/kits.js", "src/net.js", "src/render.js", "src/ui.js", "src/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "assets/drowned-games.jpg",
  ...Object.entries({
    "drowned/archer/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/archer/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/revenant/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/revenant/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/blackguard/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/blackguard/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/hexbearer/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/hexbearer/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/champion/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/champion/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/defiler/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/defiler/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/footman/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/footman/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "drowned/squire/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "drowned/squire/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "lantern-knight/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "lantern-knight/side/": ["dash", "death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "pike-warden/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "pike-warden/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "ashen-arbalist/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "ashen-arbalist/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "relic-bearer/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "relic-bearer/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "flame-bastion/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "flame-bastion/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bone-hound/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "derek/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "derek/side/": ["castSlam", "castUp", "walk1", "walk2", "walk3", "walk4"],
    "kindle/": ["back", "broken", "front", "pour", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "kindle/side/": ["crouch", "hop", "point", "walk1", "walk2", "walk3", "walk4"],
    "abigail/": ["back", "bless", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "abigail/side/": ["castUp", "fade", "hurt", "throw", "walk1", "walk2", "walk3", "walk4"],
    "starved-bell/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "starved-bell/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "deadly-rose/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkF1", "walkF2", "walkF3", "walkF4"],
    "deadly-rose/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "colossus/": ["back", "death", "front", "right", "stompDown", "stompUp", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "colossus/side/": ["attackA", "attackB", "hurt", "walk1", "walk2", "walk3"],
    "props/": ["gardenBed1", "gardenBed2", "gardenBed3", "gardenOff", "gardenOn", "husk", "refugeOff", "refugeOn", "rootOff", "rootOn", "sentinelOff", "sentinelOn", "reeds1", "reeds2", "reeds3", "reeds4", "reeds5", "reeds6", "sproutBare", "sproutOff", "sproutOn", "swampTree1", "swampTree2", "swampTree3", "boulder11", "boulder12", "boulder13", "boulder21", "boulder22", "boulder23", "boulder31", "boulder32", "boulder33", "boulder41", "boulder42", "boulder43", "flame1", "flame2", "flame3", "forge1", "forge2", "forge3", "forge4", "armory1", "armory2", "armory3", "armory4", "workbench1", "workbench2", "workbench3", "workbench4", "tower1", "tower2", "tower3", "pylon1", "pylon2", "pylon3", "stake", "palisade", "palisade2", "gatePost", "gatePost2", "palisadeSide", "palisadeSide2", "cornerPost", "cornerPost2", "tent", "banner", "torch", "burnt", "brazier", "fire1", "fire2", "fire3", "fire4", "fire5", "fire6", "iron11", "iron12", "iron13", "iron21", "iron22", "iron23", "iron31", "iron32", "iron33", "amethyst11", "amethyst12", "amethyst13", "amethyst21", "amethyst22", "amethyst23", "amethyst31", "amethyst32", "amethyst33", "resWood", "resStone", "resResin", "resIron", "resPearl", "denGuarded", "denCleared", "caveSealed", "caveOpen", "headstone", "grave", "grave2", "pillar", "soulOrb", "soulFly1", "soulFly2"],
    "ground/": ["campEarth", "campFlags", "campPaving", "grass", "dirt", "shore", "shallow", "deep", "boardwalk", "caveFloor"],
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
  // Sprite PNGs are saved with this version when it installs, so serve them from there:
  // a launch then skips ~300 network checks (a phone on mobile data can drop some of them).
  if (/\.png$/.test(new URL(req.url).pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  const fresh = req.mode === "navigate" ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : new Request(req, { cache: "no-cache" });
  e.respondWith(
    fetch(fresh)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true })).then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
