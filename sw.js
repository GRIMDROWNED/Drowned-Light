/* Drowned Light — service worker: lets the installed app start offline.
   Always asks the network for fresh files first (skipping the browser's HTTP cache),
   so a new version on GitHub Pages shows up on the next launch; the saved copy is
   used only when there's no connection. Bump VERSION together with index.html. */
const VERSION = "0.15.260";
const CACHE = "drowned-light-" + VERSION;
const FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "src/core.js", "src/binds.js", "src/view.js", "src/data.js", "src/camp.js", "src/refuge.js", "src/works.js", "src/art.js", "src/units.js", "src/sprites.js",
  "src/world.js", "src/game.js", "src/hounds.js", "src/den.js", "src/golem.js", "src/cave.js", "src/spires.js", "src/dungeon.js", "src/mines.js", "src/minetraps.js", "src/minefoes.js", "src/minebosses.js", "src/bullets.js", "src/spirefoes.js", "src/rift.js", "src/riftthrone.js", "src/colossus.js", "src/kindle.js", "src/abigail.js", "src/fred.js", "src/wyvern.js", "src/bell.js", "src/rose.js", "src/finale.js", "src/minions.js", "src/summons.js", "src/siege.js", "src/trophies.js", "src/pyramid.js", "src/outposts.js", "src/kits.js", "src/net.js", "src/render.js", "src/ui.js", "src/pad.js", "src/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "assets/drowned-games.jpg", "assets/title-portrait.jpg", "assets/title-landscape.jpg",
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
    "ashen-arbalist/side/": ["castA", "castB", "dash", "death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "ice-mage/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "ice-mage/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "flame-bastion/": ["attackA", "attackB", "attackC", "back", "cleaveB1", "cleaveB2", "cleaveB3", "cleaveB4", "cleaveB5", "cleaveB6", "cleaveB7", "cleaveB8", "cleaveF1", "cleaveF2", "cleaveF3", "cleaveF4", "cleaveF5", "cleaveF6", "cleaveF7", "cleaveF8", "front", "idleB1", "idleB2", "idleB3", "idleB4", "idleB5", "idleB6", "idleB7", "idleB8", "idleF1", "idleF2", "idleF3", "idleF4", "idleF5", "idleF6", "idleF7", "idleF8", "right", "stepB1", "stepB2", "stepB3", "stepB4", "stepB5", "stepB6", "stepB7", "stepB8", "stepF1", "stepF2", "stepF3", "stepF4", "stepF5", "stepF6", "stepF7", "stepF8", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "flame-bastion/side/": ["cleave1", "cleave2", "cleave3", "cleave4", "cleave5", "cleave6", "cleave7", "cleave8", "death", "fall1", "fall2", "fall3", "fall4", "fall5", "fall6", "fall7", "fall8", "hurt", "idle1", "idle2", "idle3", "idle4", "idle5", "idle6", "idle7", "idle8", "plant1", "plant2", "plant3", "plant4", "plant5", "plant6", "plant7", "plant8", "step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8", "walk1", "walk2", "walk3", "walk4"],
    "chain-reaper/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "chain-reaper/side/": ["dash", "death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "jade-breaker/": ["attackA", "attackB", "attackC", "back", "front", "idleB1", "idleB2", "idleB3", "idleB4", "idleB5", "idleB6", "idleB7", "idleB8", "idleF1", "idleF2", "idleF3", "idleF4", "idleF5", "idleF6", "idleF7", "idleF8", "right", "runB1", "runB2", "runB3", "runB4", "runF1", "runF2", "runF3", "runF4", "sprintB1", "sprintB2", "sprintB3", "sprintB4", "sprintB5", "sprintB6", "sprintB7", "sprintB8", "sprintF1", "sprintF2", "sprintF3", "sprintF4", "sprintF5", "sprintF6", "sprintF7", "sprintF8", "stepB1", "stepB2", "stepB3", "stepB4", "stepB5", "stepB6", "stepB7", "stepB8", "stepF1", "stepF2", "stepF3", "stepF4", "stepF5", "stepF6", "stepF7", "stepF8", "sweepB1", "sweepB2", "sweepB3", "sweepB4", "sweepB5", "sweepB6", "sweepB7", "sweepB8", "sweepF1", "sweepF2", "sweepF3", "sweepF4", "sweepF5", "sweepF6", "sweepF7", "sweepF8", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "jade-breaker/side/": ["castA", "castB", "dash", "death", "fall1", "fall2", "fall3", "fall4", "fall5", "fall6", "fall7", "fall8", "hurt", "idle1", "idle2", "idle3", "idle4", "idle5", "idle6", "idle7", "idle8", "run1", "run2", "run3", "run4", "sprint1", "sprint2", "sprint3", "sprint4", "sprint5", "sprint6", "sprint7", "sprint8", "step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8", "sweep1", "sweep2", "sweep3", "sweep4", "sweep5", "sweep6", "sweep7", "sweep8", "tide1", "tide2", "tide3", "tide4", "tide5", "tide6", "tide7", "tide8", "walk1", "walk2", "walk3", "walk4"],
    "rose-paladin/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "rose-paladin/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bloodsworn/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bloodsworn/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "cinderbrand/": ["attackA", "attackB", "attackC", "back", "front", "guardF", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "cinderbrand/side/": ["chop", "death", "guard", "guard1", "guard2", "guard3", "hurt", "lunge", "walk1", "walk2", "walk3", "walk4"],
    "bloodsworn-f2/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bloodsworn-f2/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bloodsworn-f3/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bloodsworn-f3/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bone-hound-f0/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound-f0/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bone-hound-f2/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound-f2/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "bone-hound-f3/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "bone-hound-f3/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "derek-f0/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "derek-f0/side/": ["castSlam", "castUp", "walk1", "walk2", "walk3", "walk4"],
    "derek-f2/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "derek-f2/side/": ["castSlam", "castUp", "walk1", "walk2", "walk3", "walk4"],
    "derek-f3/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "derek-f3/side/": ["castSlam", "castUp", "walk1", "walk2", "walk3", "walk4"],
    "abigail-f2/": ["back", "bless", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "abigail-f2/side/": ["castUp", "fade", "hurt", "throw", "walk1", "walk2", "walk3", "walk4"],
    "abigail-f3/": ["back", "bless", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "abigail-f3/side/": ["castUp", "fade", "hurt", "throw", "walk1", "walk2", "walk3", "walk4"],
    "derek/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "derek/side/": ["castSlam", "castUp", "walk1", "walk2", "walk3", "walk4"],
    "fred-f0/": ["attackA", "attackB", "back", "front", "heal", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "fred-f0/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "wyvern-f0/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "wyvern-f0/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "wyvern-f1/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "wyvern-f1/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "wyvern-f2/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "wyvern-f2/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "wyvern-f3/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "wyvern-f3/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "wyvern-mother/": ["back", "flyB1", "flyB2", "flyF1", "flyF2", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "wyvern-mother/side/": ["breath", "death", "dive", "fly1", "fly2", "fly3", "fly4", "hurt", "rake", "rear", "roar"],
    "fred-f1/": ["attackA", "attackB", "back", "front", "heal", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "fred-f1/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "fred-f2/": ["attackA", "attackB", "back", "front", "heal", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "fred-f2/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "fred-f3/": ["attackA", "attackB", "back", "front", "heal", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "fred-f3/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "kindle/": ["back", "broken", "front", "pour", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "kindle/side/": ["crouch", "hop", "point", "walk1", "walk2", "walk3", "walk4"],
    "abigail/": ["back", "bless", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "abigail/side/": ["castUp", "fade", "hurt", "throw", "walk1", "walk2", "walk3", "walk4"],
    "starved-bell/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "starved-bell/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "deadly-rose/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "deadly-rose/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "colossus/": ["back", "death", "front", "right", "stompDown", "stompUp", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "colossus/side/": ["attackA", "attackB", "hurt", "walk1", "walk2", "walk3"],
    "minions/rosewretch/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/rosewretch/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/handmaiden/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/handmaiden/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/skitterer/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/skitterer/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/tollwretch/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/tollwretch/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/leech/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/leech/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/raptor/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/raptor/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/screecher/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/screecher/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/cairn/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/cairn/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/servitor/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/servitor/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/siltfist/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/siltfist/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/thornling/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/thornling/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/tidestalker/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/tidestalker/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/wisp/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/wisp/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "props/": ["wispBolt", "flame5", "flame10", "flame15", "flame20", "claimBrazier", "claimBanner", "barracks1", "barracks2", "barracks3", "gardenBed1", "gardenBed2", "gardenBed3", "gardenOff", "gardenOn", "husk", "refugeOff", "refugeOn", "rootOff", "rootOn", "sentinelOff", "sentinelOn", "reeds1", "reeds2", "reeds3", "reeds4", "reeds5", "reeds6", "sproutBare", "sproutOff", "sproutOn", "sproutOn2", "sproutOff2", "swampTree11", "swampTree12", "swampTree13", "swampTree14", "swampTree21", "swampTree22", "swampTree23", "swampTree24", "swampTree31", "swampTree32", "swampTree33", "swampTree34", "boulder11", "boulder12", "boulder13", "boulder21", "boulder22", "boulder23", "boulder31", "boulder32", "boulder33", "boulder41", "boulder42", "boulder43", "flame1", "flame2", "flame3", "forge1", "forge2", "forge3", "forge4", "armory1", "armory2", "armory3", "armory4", "workbench1", "workbench2", "workbench3", "workbench4", "tower1", "tower2", "tower3", "pylon1", "pylon2", "pylon3", "stake", "palisade", "palisade2", "gatePost", "gatePost2", "palisadeSide", "palisadeSide2", "cornerPost", "cornerPost2", "tent", "banner", "torch", "burnt", "brazier", "fire1", "fire2", "fire3", "fire4", "fire5", "fire6", "iron11", "iron12", "iron13", "iron21", "iron22", "iron23", "iron31", "iron32", "iron33", "amethyst11", "amethyst12", "amethyst13", "amethyst21", "amethyst22", "amethyst23", "amethyst31", "amethyst32", "amethyst33", "resWood", "resStone", "resResin", "resIron", "resPearl", "denGuarded", "denCleared", "caveSealed", "caveOpen", "headstone", "grave", "grave2", "pillar", "soulOrb", "soulFly1", "soulFly2", "roseBriar1", "roseBriar2", "roseBriar3", "roseBriar4", "roseBriar5", "roseLash1", "roseLash2", "roseLash3", "roseWaltz1", "roseWaltz2", "roseWaltz3", "roseWaltz4", "roseBud", "roseWither", "roseBush0", "roseBush1", "roseBush2", "rosePetal1", "rosePetal2", "rosePetal3", "rosePetal4", "rosePetal5", "rosePetal6", "kennel1", "kennel2", "kennel3", "workshop1", "workshop2", "workshop3", "shrine1", "shrine2", "shrine3", "toadstool1", "toadstool2", "toadstool3", "roost1", "roost2", "roost3", "wyvNest", "wyvNestEmpty", "wyvEgg", "wyvEggHatch", "wyvEggShell", "fairyRing", "fairyRingWilt", "glowcap1", "glowcap2", "glowcap3", "bellTower", "roseHeart1", "roseHeart2", "roseHeart3", "blackPearl11", "blackPearl12", "blackPearl13", "blackPearl21", "blackPearl22", "blackPearl23", "blackPearl31", "blackPearl32", "blackPearl33", "resBlack", "outpost", "reaperSickle1", "reaperSickle2", "reaperSickle3", "reaperSickle4", "reaperChain", "reaperWeight", "reaperSnare", "reaperSnared", "wallFire1", "wallFire2", "wallFire3", "wallFire4", "arbBolt", "arbFlareBolt", "arbFlare1", "arbFlare2", "arbFlare3", "arbFlare4", "jadeCrystal1", "jadeCrystal2", "jadeCrystal3", "jadeCrystal4", "bloodThorn", "bloodThorns", "bloodCrescent", "bloodMist", "haloF", "haloB", "haloS", "haloLitF", "haloLitB", "haloLitS", "brandStreak", "brandFlame", "brandRing", "brandFlash", "brandSlash", "brandScorch", "magmaCrack", "dragon1", "dragon2", "dragon3", "dragon4", "dragon5", "dragon6", "dragonF1", "dragonF2", "dragonF3", "dragonF4", "dragonF5", "dragonF6", "dragonB1", "dragonB2", "dragonB3", "dragonB4", "dragonB5", "dragonB6", "owlFront", "owlBack", "owlSide", "owlRise", "owlFly1", "owlFly2", "owlFly3", "owlFly4", "owlFly5", "owlCast", "iceShard", "iceBolt", "iceBoltBig", "iceGem", "iceSpike1", "iceSpike2", "fnKingStill", "fnKingOpen", "fnKingRoar", "fnKingDying", "fnHandRest", "fnHandRaised", "fnHandSlam", "fnHandSweep", "fnGate1", "fnGate2", "fnGate3", "fnWall", "fnPost", "fnRuinA1", "fnRuinA2", "fnRuinA3", "fnRuinA4", "fnRuinB1", "fnRuinB2", "fnRuinB3", "fnRuinB4", "fbFront", "fbBack", "fbSide", "fbCamp", "fbHurl", "fbDown"],
    "minions/drakeling/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/drakeling/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "minions/tideleech/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "minions/tideleech/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "pyramid-champion/": ["attackA", "attackB", "attackC", "back", "front", "guard", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "pyramid-champion/side/": ["death", "hurt", "walk1", "walk2", "walk3"],
    "refuge/": ["foundation", "plaza", "low-n", "low-s", "low-e", "low-w", "low-nw", "low-ne", "low-sw", "low-se", "terrace-n", "terrace-s", "terrace-e", "terrace-w", "terrace-nw", "terrace-ne", "terrace-sw", "terrace-se", "terrace-stN", "terrace-stS", "terrace-stE", "terrace-stW", "terrace-floor", "avenue-ew", "avenue-ns", "floor-sanctum", "floor-flags", "floor-cobble", "plot-s", "plot-m", "plot-l", "d-bastion", "d-tower", "d-gate", "d-battlement", "d-pillar", "d-beacon", "d-bowl", "d-lantern", "d-statue", "d-planter", "d-well", "d-rack", "d-crates", "b-forge1", "b-forge2", "b-forge3", "b-forge4", "b-barracks1", "b-barracks2", "b-barracks3", "b-roseheart1", "b-roseheart2", "b-roseheart3", "b-bell1", "b-roost1", "b-roost2", "b-roost3", "b-shrine1", "b-shrine2", "b-shrine3", "b-toadstool1", "b-toadstool2", "b-toadstool3", "b-workshop1", "b-workshop2", "b-workshop3", "b-kennel1", "b-kennel2", "b-kennel3", "b-pylon1", "b-pylon2", "b-pylon3", "b-tower1", "b-tower2", "b-tower3", "b-workbench1", "b-workbench2", "b-workbench3", "b-workbench4", "b-storehouse1", "b-salvage1", "b-training1", "b-supplies1", "b-tent1", "b-tent2", "b-alchemy1", "b-quarters1", "b-lodge1", "b-archive1", "b-circle1", "b-garden1", "b-garden2", "b-garden3", "b-armory1", "b-armory2", "b-armory3", "b-armory4", "hearth1", "hearth5", "hearth10", "hearth15", "hearth20", "great-n", "great-s", "great-e", "great-w", "great-nw", "great-ne", "great-sw", "great-se", "great-stN", "great-stS", "great-stE", "great-stW", "curt-n", "curt-s", "curt-e", "curt-w", "curt-nw", "curt-ne", "curt-sw", "curt-se", "curt-stN", "curt-stS", "curt-stE", "curt-stW", "lward-n", "lward-s", "lward-e", "lward-w", "lward-nw", "lward-ne", "lward-sw", "lward-se", "lward-stN", "lward-stS", "lward-stE", "lward-stW", "mward-n", "mward-s", "mward-e", "mward-w", "mward-nw", "mward-ne", "mward-sw", "mward-se", "mward-stN", "mward-stS", "mward-stE", "mward-stW", "ward-n", "ward-s", "ward-e", "ward-w", "ward-nw", "ward-ne", "ward-sw", "ward-se", "ward-stN", "ward-stS", "ward-stE", "ward-stW", "court-n", "court-s", "court-e", "court-w", "court-nw", "court-ne", "court-sw", "court-se", "court-stN", "court-stS", "court-stE", "court-stW", "sanct-n", "sanct-s", "sanct-e", "sanct-w", "sanct-nw", "sanct-ne", "sanct-sw", "sanct-se", "sanct-stN", "sanct-stS", "sanct-stE", "sanct-stW", "rim-n", "rim-s", "rim-e", "rim-w", "rim-nw", "rim-ne", "rim-sw", "rim-se", "rim-stN", "rim-stS", "rim-stE", "rim-stW", "tier-n", "tier-s", "tier-e", "tier-w", "tier-nw", "tier-ne", "tier-sw", "tier-se", "tier-stN", "tier-stS", "tier-stE", "tier-stW"],
    "mines-bosses/golem/": ["attackA", "attackB", "back", "core", "front", "hurl", "regrow", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4", "windup"],
    "mines-bosses/golem/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-bosses/wyrm/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-bosses/wyrm/side/": ["death", "dive", "fly1", "fly2", "fly3", "fly4", "hurt", "land", "walk1", "walk2", "walk3", "walk4"],
    "mines-bosses/sovereign/": ["attackA", "attackB", "attackC", "back", "cloak", "crown", "front", "pillar", "right", "rising", "seated", "stepOut", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-bosses/sovereign/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-bosses/colossus/": ["attackA", "attackB", "attackC", "back", "front", "noTowers", "oneTower", "right", "unchained", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-bosses/colossus/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-bosses/seraph/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-bosses/seraph/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-bosses/hydra/": ["breath", "cut1", "cut2", "cut3", "dead", "hurt", "idle1", "idle2", "idle3", "idle4", "lob", "regrow", "roar", "spiral", "still"],
    "mines-foes/acolyte/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-foes/acolyte/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-foes/ashguard/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-foes/ashguard/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "mines-foes/wretch/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "mines-foes/wretch/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/leaper/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/leaper/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/bowman/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/bowman/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/shade/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/shade/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/caller/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/caller/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/prism/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/prism/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/mite/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/mite/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/swisp/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/swisp/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires-foes/warden/": ["attackA", "attackB", "attackC", "back", "front", "right", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "spires-foes/warden/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "rift-throne/": ["attackA", "attackB", "attackC", "back", "front", "right", "seated", "waking", "rising", "p2front", "p2sweep", "p2enraged", "walkB1", "walkB2", "walkB3", "walkB4", "walkF1", "walkF2", "walkF3", "walkF4"],
    "rift-throne/side/": ["death", "hurt", "walk1", "walk2", "walk3", "walk4"],
    "spires/": ["arena", "throne", "well-dark", "well-lit", "floor-2", "floor-3", "floor-4", "kerb", "face-1-band", "face-1-foot", "face-2-band", "face-2-foot", "stairs", "bridge", "bridge-post", "post", "spire", "arch", "ring", "exit-banner", "crystal-1", "crystal-2", "crystal-3", "column-1", "column-1b", "column-2", "column-3", "rune-circle", "rune-glow", "bullet-0", "bullet-1", "bullet-2", "bullet-3", "sentinel", "sentinel-orbit", "chest-shut", "chest-open", "aether-1", "aether-2", "aether-3", "seal-1", "seal-2", "seal-3", "seal-4", "icon-shard", "icon-aether", "icon-bag", "icon-well"],
    "mines/": ["arch", "arena-1", "arena-2", "banner", "brazier", "bullet-0", "bullet-1", "bullet-2", "bullet-3", "bullet-4", "bullet-5", "cage-broken", "cage-down", "cage-hang", "cart-broken", "cart-front", "cart-side", "chest-open", "chest-shut", "colossus-chain", "colossus-fist", "colossus-mortar", "crane", "crumble-1", "crumble-2", "crumble-3", "crumble-4", "face-1-band", "face-1-foot", "face-1-head", "face-2-band", "face-2-foot", "face-2-head", "fall-1", "fall-2", "fall-3", "fall-4", "floor-1", "floor-2", "floor-3", "geyser-1", "geyser-2", "geyser-3", "geyser-4", "golem-core", "golem-fist", "golem-pool", "grate-1", "grate-2", "grate-3", "grate-flame-1", "grate-flame-2", "grate-flame-3", "grate-flame-4", "jet-1", "jet-2", "jet-3", "jet-4", "jet-head", "rail", "rune-circle", "seal-1", "seal-2", "seal-3", "shard-1", "shard-2", "shard-3", "shard-break", "shard-burst", "shard-crack", "shrine-dark", "shrine-lit", "stairs", "throne"],
    "rift/": ["turret-1", "turret-2", "turret-3", "bolt", "flash-1", "flash-2", "hit", "lantern-1", "lantern-2", "lantern-3", "portal-off", "portal-on"],
    "pyramid/": ["step-south", "step-north", "step-east", "step-west", "stair-south", "stair-north", "stair-east", "stair-west", "stairway-lane"],
    "ground/": ["campEarth", "campFlags", "campPaving", "grass", "dirt", "shore", "shallow", "deep", "boardwalk", "caveFloor", "rimDeep", "rimShore"],
  }).flatMap(([dir, names]) => names.map((n) => "assets/sprites/" + dir + n + ".png")),
].map((f) => (/\.(js|css|jpg)$/.test(f) || f.startsWith("assets/sprites/") ? f + "?v=" + VERSION : f));

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
  // The page asks for them with ?v=<version>, so a new version's art never matches an older version's
  // saved copy and is fetched fresh; offline with nothing saved for it, any saved copy will do.
  if (/\.png$/.test(new URL(req.url).pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error()))));
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

