"""Cut AI-rendered sprites (one character per image on a flat magenta background) into game sprites.
Usage: python3 tools/cut_ai_sprites.py <folder of returned images> [character ...]
Every image of a character is shrunk by the same factor, set so the reference pose is TARGET px tall,
so poses keep their relative size."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cool_violet, cut_keyed, cut_sheet, contact, match_colors, match_hist, mirror_legs, recolor_frames, split_grid

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

# character: (output folder, reference image, target height of the reference pose in file px, fringe px to peel, {source: output name})
# An output name can be (name, options) for an image from a different batch:
#   height: its own target height in file px (when it was rendered at another scale)
#   match: recolour it to match another returned image (when the batch came out in other colours)
#   fringe: its own fringe
# Sprites are cut at 2 file px per art pixel (res: 2 in src/sprites.js), so 80 px is 40 art px.
TWELVE = ['front', 'back', 'right', 'side/walk1', 'side/walk2', 'side/walk3', 'side/walk4',
          'attackA', 'attackB', 'attackC', 'side/hurt', 'side/death']  # the 12-pose enemy prompt, in order

def twelve(folder, names):
    return {folder + '/' + n: out for n, out in zip(names, TWELVE)}

# The two-sheets-of-six enemy prompt: each 3x2 sheet is split into one image per cell before cutting,
# and the four side walk cells are joined into one strip for SHEETS. sheet -> (columns, rows, cell names)
POSES_A = ['01_front', '02_back', '03_right', '08_attackA', '09_attackB', '10_attackC']
POSES_B = ['04_walk', '05_walk', '06_walk', '07_walk', '11_hurt', '12_death']
TWELVE_FILES = [n + '.png' for n in sorted(POSES_A + POSES_B)]
GRIDS = {
    'swarming-revenant/poses-a.png': (3, 2, POSES_A),
    'swarming-revenant/poses-b.png': (3, 2, POSES_B),
    'lantern-reaver/poses-a.png': (3, 2, POSES_A),
    'lantern-reaver/poses-b.png': (3, 2, POSES_B),
    'bone-bulwark/poses-a.png': (3, 2, POSES_A),
    'bone-bulwark/poses-b.png': (3, 2, POSES_B),
    'marsh-hexbearer/poses-a.png': (3, 2, POSES_A),
    'marsh-hexbearer/poses-b.png': (3, 2, POSES_B),
    'drowned-sovereign/poses-a.png': (3, 2, POSES_A),
    'drowned-sovereign/poses-b.png': (3, 2, POSES_B),
    'pike-warden/poses-a.png': (3, 2, POSES_A),
    'pike-warden/poses-b.png': (3, 2, POSES_B),
    'ashen-arbalist/poses-a.png': (3, 2, POSES_A),
    'ashen-arbalist/poses-b.png': (3, 2, POSES_B),
    'ice-mage/poses-a.png': (3, 2, POSES_A),
    'ice-mage/poses-b.png': (3, 2, POSES_B),
    'flame-bastion/poses-a.png': (3, 2, POSES_A),
    'flame-bastion/poses-b.png': (3, 2, POSES_B),
    'bone-hound/poses-a.png': (3, 2, POSES_A),
    'bone-hound/poses-b.png': (3, 2, POSES_B),
    'bone-hound-f0/poses-a.png': (3, 2, POSES_A),
    'bone-hound-f0/poses-b.png': (3, 2, POSES_B),
    'bone-hound-f2/poses-a.png': (3, 2, POSES_A),
    'bone-hound-f2/poses-b.png': (3, 2, POSES_B),
    'bone-hound-f3/poses-a.png': (3, 2, POSES_A),
    'bone-hound-f3/poses-b.png': (3, 2, POSES_B),
    'derek/poses-a.png': (3, 2, POSES_A),
    'derek/poses-b.png': (3, 2, POSES_B),
    'derek-f0/poses-a.png': (3, 2, POSES_A),
    'derek-f0/poses-b.png': (3, 2, POSES_B),
    'derek-f2/poses-a.png': (3, 2, POSES_A),
    'derek-f2/poses-b.png': (3, 2, POSES_B),
    'derek-f3/poses-a.png': (3, 2, POSES_A),
    'derek-f3/poses-b.png': (3, 2, POSES_B),
    'abigail-f2/poses-a.png': (3, 2, POSES_A),
    'abigail-f2/poses-b.png': (3, 2, POSES_B),
    'abigail-f3/poses-a.png': (3, 2, POSES_A),
    'abigail-f3/poses-b.png': (3, 2, POSES_B),
    'fred-f0/poses-a.png': (3, 2, POSES_A),
    'fred-f0/poses-b.png': (3, 2, POSES_B),
    'fred-f1/poses-a.png': (3, 2, POSES_A),
    'fred-f1/poses-b.png': (3, 2, POSES_B),
    'fred-f2/poses-a.png': (3, 2, POSES_A),
    'fred-f2/poses-b.png': (3, 2, POSES_B),
    'fred-f3/poses-a.png': (3, 2, POSES_A),
    'fred-f3/poses-b.png': (3, 2, POSES_B),
    # David the wyvern (src/wyvern.js): poses B's four flap cells stand in for the side walk
    'wyvern-f0/poses-a.png': (3, 2, POSES_A),
    'wyvern-f0/poses-b.png': (3, 2, POSES_B),
    'wyvern-f1/poses-a.png': (3, 2, POSES_A),
    'wyvern-f1/poses-b.png': (3, 2, POSES_B),
    'wyvern-f2/poses-a.png': (3, 2, POSES_A),
    'wyvern-f2/poses-b.png': (3, 2, POSES_B),
    'wyvern-f3/poses-a.png': (3, 2, POSES_A),
    'wyvern-f3/poses-b.png': (3, 2, POSES_B),
    # the Mother Wyvern: standing poses and her fire; side flaps (as a walk strip), her dive and storm roar;
    # flying toward and away from you, hurt and dead
    'mother/poses-a.png': (3, 2, ['01_front', '02_back', '03_right', '08_rear', '09_breath', '10_rake']),
    'mother/poses-b.png': (3, 2, ['04_walk', '05_walk', '06_walk', '07_walk', '13_dive', '14_roar']),
    'mother/poses-c.png': (3, 2, ['15_flyF1', '16_flyF2', '17_flyB1', '18_flyB2', '11_hurt', '12_death']),
    'kindle/poses-a.png': (3, 2, POSES_A),
    'kindle/poses-b.png': (3, 2, POSES_B),
    'abigail/poses-a.png': (3, 2, POSES_A),
    'abigail/poses-b.png': (3, 2, POSES_B),
    'starved-bell/poses-a.png': (3, 2, POSES_A),
    'starved-bell/poses-b.png': (3, 2, POSES_B),
    'deadly-rose/poses-a.png': (3, 2, POSES_A),
    'deadly-rose/poses-b.png': (3, 2, POSES_B),
    # the Colossus's sheets: three side crawl frames, then a front stomp (fists up, fists down) and its collapse
    # the Chain Reaper (kit 06), drawn on green: the throw's chain and sickle are cut off at the fist (see CELL_CROP),
    # since the game draws the flying sickle itself; attackC is the chain whirled overhead (Violet Snare's cast)
    'chain-reaper/poses-a.png': (3, 2, POSES_A),
    'chain-reaper/poses-b.png': (3, 2, POSES_B),
    'chain-reaper/dash.png': (2, 1, ['13_dash', '14_dashB']),
    # the Ashen Arbalist's ability poses: his dash, then Scatter Shot kneeling to aim and fired
    'ashen-arbalist/abilities.png': (3, 1, ['13_dash', '14_castA', '15_castB']),
    # the Jade Breaker (kit 07): his dash, then Jade Tide's wind-up and the sweep that sends the crystals out
    'jade-breaker/poses-a.png': (3, 2, POSES_A),
    'jade-breaker/poses-b.png': (3, 2, POSES_B),
    'jade-breaker/abilities.png': (3, 1, ['13_dash', '14_castA', '15_castB']),
    # the Rose Paladin (kit 08): front, back, side and his three swing poses; his side walk, hurt and death
    'rose-paladin/poses-a.png': (3, 2, POSES_A),
    'rose-paladin/poses-b.png': (3, 2, POSES_B),
    'colossus/poses-a.png': (3, 2, ['01_front', '02_back', '03_right', '08_attackA', '09_attackB', '11_hurt']),
    'colossus/poses-b.png': (3, 2, ['04_walk', '05_walk', '06_walk', '13_stompUp', '14_stompDown', '12_death']),
}
# Cells the AI drew at another scale than the rest of their sheet: cell -> factor to resize it by.
CELL_SCALE = {'pike-warden/07_walk': 1.16, 
              # the hound's attack row came out smaller than its standing row
              'bone-hound/08_attackA': 1.25, 'bone-hound/09_attackB': 1.25, 'bone-hound/10_attackC': 1.25}
# the Ember Hound's and the Grave Warg's attack rows and whole second sheets came out smaller than their standing rows
CELL_SCALE.update({'bone-hound-f2/' + n: 1.27 for n in POSES_A[3:]})
CELL_SCALE.update({'bone-hound-f2/' + n: 1.17 for n in POSES_B})
CELL_SCALE.update({'bone-hound-f3/' + n: 1.3 for n in POSES_A[3:]})
CELL_SCALE.update({'bone-hound-f3/' + n: 1.18 for n in POSES_B})
# Pebble Derek's second sheet came out bigger than his first
CELL_SCALE.update({'derek-f0/' + n: 0.88 for n in POSES_B})

# Cells cut off at a share of their width (key colour painted over the rest): the Chain Reaper's throw keeps
# its arm and loses the chain and sickle stretched out ahead, which the game draws flying (src/render.js).
CELL_CROP = {'chain-reaper/09_attackB': 0.58}

# Cells redrawn on their own after a sheet came back: cell -> (redrawn image, cell whose figure height it takes).
# The redraw is shrunk to that height before it is cut, so it matches the rest of its sheet.
CELL_REDRAW = {'starved-bell/07_walk': ('bell-walk4.png', '04_walk'), 'starved-bell/08_attackA': ('bell-rear.png', '03_right'),
               # David's second form: his side view and shriek came back with tangled wings
               'wyvern-f1/03_right': ('redraw-right.png', '03_right'), 'wyvern-f1/10_attackC': ('redraw-shriek.png', '10_attackC'),
               'wyvern-f2/10_attackC': ('redraw-shriek.png', '10_attackC')}

# Characters whose own colours come close to the magenta key (violet ghost-fire): keyed with a tighter
# tolerance and without the purple-fringe filter, so their glow isn't eaten.
KEY_OPTS = {'chain-reaper': {'key': (0, 255, 0)}, 'bone-hound-f3': {'tol': 60, 'tint': False}, 'abigail-f2': {'tol': 60, 'tint': False}, 'abigail-f3': {'tol': 60, 'tint': False}}
# Characters whose colours are reworked as they're cut (all their poses, walks and dash): name -> recolour function.
def jade_match(x):
    """The Jade Breaker's sheets each came out a little different in colour: match them all to his front view."""
    if not hasattr(jade_match, 'f'): jade_match.f = match_hist(Image.open(os.path.join(SRC, 'jade-breaker/01_front.png')))
    return jade_match.f(x)
RECOLOR = {'chain-reaper': cool_violet, 'jade-breaker': jade_match}
HOUND_H = 60
EMBER_H = 136  # the Ember Hound (third form), cut at res 4: drawn 34 px tall with its flames, a little bigger than the hound
WARG_H = 152  # the Grave Warg (last form), cut at res 4: drawn 38 px tall with its horns and mist, a quarter bigger than the hound
PUP_H = 88  # the Bone Pup (the hound's first form, src/summons.js), cut at res 4: drawn 22 px tall, about three quarters of the hound
DEREK_H = 60  # cut at 4 file px per art pixel (res: 4): drawn 30 px tall, about 3/8 of the knight
DEREK_SIDE_H = 62
BASTION_H = 78  # Derek the Bastion (his last form), res 4: a third bigger than Derek
CRYSTAL_H = 68  # Crystal Derek (his third form), res 4: a seventh bigger than Derek
PEBBLE_H = 44  # Pebble Derek (his first form, src/summons.js), res 4: about three quarters of Derek
QUEEN_H = 140  # Abigail, Queen of Sorrows (her last form), res 4: a fifth taller than Abigail, crown and soul flames included
MOURNING_H = 123  # Mourning Abigail (her third form), res 4: a tenth taller than Abigail
ABIGAIL_H = 112  # cut at res 4: drawn 28 px tall, hem to hood, about two thirds of the knight
KINDLE_H = 64
FRED0_H = 80  # Fred the Sprout (Fred's first form, src/fred.js), res 4: 20 art px tall with his cap, half the knight
FRED1_H = 107  # Fred (level 5), a third taller than the Sprout
FRED2_H = 164  # Weeping Fred (level 10), about the knight's height
FRED3_H = 210  # Fred the Rotwalker (level 15), a hulking stalker taller than the knight
WYV0_H = 96  # David the Hatchling (src/wyvern.js), res 4: 24 art px from wing tip to tail, wings as wide as the knight is tall
WYV1_H = 150  # David (his second form), res 4: 37 art px from wing tip to tail, wings about 1.2 times the Hatchling's
WYV2_H = 190  # Great David (his third form), res 4: 47 art px from wing tip to tail
WYV3_H = 210  # David the Bloodwing (his last form), res 4: 52 art px from wing tip to tail, a little bigger than Great David
MOTHER_H = 380  # the Mother Wyvern boss, res 4: 95 art px standing with her wings half spread, about two and a half knights
BELL_H = 224  # the Starved Bell boss, cut at res 4: drawn 56 art px tall (x1.25 in game), almost twice the knight  # cut at res 4 like Derek: drawn 32 px tall, ring included, about 40% of the knight
ROSE_H = 368  # the Deadly Rose, cut at res 4: drawn 92 art px tall standing (x0.8 in game), about twice the knight
ICE_MAGE_H = 104  # the Frostweaver, hat and staff tip included: the body about the other knights' height (res 2)
COLOSSUS_H = 256  # the Drowned Colossus, cut at res 4: drawn 64 art px tall crouched, about one and a half knights
SETS = {
    'lantern-knight': ('lantern-knight', 'knight-front.png', 80, 3, {
        'knight-front.png': 'front',
        'knight-back.png': 'back',
        'knight-side.png': 'right',
        'knight-attack1-raised.png': 'attackA',
        'knight-attack2-level.png': 'attackB',
        'knight-attack3-low.png': 'attackC',
        'knight-dash.png': 'side/dash',
        'knight-hurt.png': 'side/hurt',
        'knight-death.png': 'side/death',
    }),
    'drowned-wretch': ('drowned/footman', 'drowned-wretch/01_front.png', 80, 3, {
        # first batch: the knight's design, recoloured to match the second batch
        'drowned-wretch/01_front.png': ('front', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/02_back.png': ('back', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_c.png': ('right', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_a.png': ('side/walk1', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_b.png': ('side/walk3', {'match': 'drowned-wretch/b_walk.png'}),
        # second batch: cropped at one scale, already in the concept colours
        'drowned-wretch/b_attackA.png': ('attackA', {'height': 77, 'fringe': 1}),
        'drowned-wretch/b_attackB.png': ('attackB', {'height': 56, 'fringe': 1}),
        'drowned-wretch/b_attackC.png': ('attackC', {'height': 67, 'fringe': 1}),
        'drowned-wretch/b_hurt.png': ('side/hurt', {'height': 74, 'fringe': 1}),
        'drowned-wretch/b_death.png': ('side/death', {'height': 38, 'fringe': 1}),
    }),
    'tide-archer': ('drowned/archer', 'tide-archer/01_front.png', 80, 2, {
        'tide-archer/01_front.png': 'front',
        'tide-archer/02_back.png': 'back',
        'tide-archer/03_right.png': 'right',
        'tide-archer/04_walk.png': 'side/walk1',
        'tide-archer/05_walk.png': 'side/walk2',
        'tide-archer/06_walk.png': 'side/walk3',
        # cells of a 3x2 sheet (sheet2.png), rendered at a smaller scale
        'tide-archer/07_walk.png': ('side/walk4', {'height': 78, 'fringe': 1}),
        'tide-archer/08_attack_draw.png': ('attackA', {'height': 91, 'fringe': 1}),
        'tide-archer/09_attack_release.png': ('attackB', {'height': 82, 'fringe': 1}),
        'tide-archer/10_attack_lower.png': ('attackC', {'height': 80, 'fringe': 1}),
        'tide-archer/11_hurt.png': ('side/hurt', {'height': 73, 'fringe': 1}),
        'tide-archer/12_death.png': ('side/death', {'height': 42, 'fringe': 1}),
    }),
    'mire-stalker': ('drowned/squire', 'mire-stalker/01_idle_front.png', 80, 1, twelve('mire-stalker', [
        '01_idle_front.png', '02_idle_back.png', '03_idle_right.png', '04_walk_left_forward.png', '05_walk_passing_a.png',
        '06_walk_right_forward.png', '07_walk_passing_b.png', '08_attack_windup.png', '09_attack_midstrike.png',
        '10_attack_followthrough.png', '11_hurt_recoil.png', '12_death.png'])),
    'swarming-revenant': ('drowned/revenant', 'swarming-revenant/01_front.png', 76, 1, twelve('swarming-revenant', TWELVE_FILES)),
    'lantern-reaver': ('drowned/defiler', 'lantern-reaver/01_front.png', 82, 1, twelve('lantern-reaver', TWELVE_FILES)),
    'bone-bulwark': ('drowned/blackguard', 'bone-bulwark/01_front.png', 84, 1, twelve('bone-bulwark', TWELVE_FILES)),
    # its staff stands above the hood, so the reference pose is taller than the others
    'marsh-hexbearer': ('drowned/hexbearer', 'marsh-hexbearer/01_front.png', 92, 1, twelve('marsh-hexbearer', TWELVE_FILES)),
    # the boss is drawn 1.5x bigger, so it is cut at 3 file px per art pixel (res: 3) to stay sharp
    'drowned-sovereign': ('drowned/champion', 'drowned-sovereign/01_front.png', 128, 1, twelve('drowned-sovereign', TWELVE_FILES)),
    # kit knights: the body is 80 px like the Lantern Knight's, so the reference pose with its pike above the hood is taller
    'pike-warden': ('pike-warden', 'pike-warden/01_front.png', 104, 1, twelve('pike-warden', TWELVE_FILES)),
    # redrawn 2026-10-28 (white hood, crossbow): the slimmest, shortest knight; his ability poses were rendered at another scale
    'ashen-arbalist': ('ashen-arbalist', 'ashen-arbalist/01_front.png', 82, 1, dict(twelve('ashen-arbalist', TWELVE_FILES), **{
        'ashen-arbalist/13_dash.png': ('side/dash', {'height': 61}),
        'ashen-arbalist/14_castA.png': ('side/castA', {'height': 58}),
        'ashen-arbalist/15_castB.png': ('side/castB', {'height': 65})})),
    # the Frostweaver (kit 04): his side view is a standalone picture facing left (the sheet's kept swapping the staff's hand),
    # so it's flipped to face right ('flip'); his hat and staff tip make up the height
    'ice-mage': ('ice-mage', 'ice-mage/01_front.png', ICE_MAGE_H, 1, {
        'ice-mage/01_front.png': 'front', 'ice-mage/02_back.png': 'back', 'ice-mage/side.png': ('right', {'height': ICE_MAGE_H, 'flip': True}),
        'ice-mage/08_attackA.png': 'attackA', 'ice-mage/09_attackB.png': 'attackB', 'ice-mage/10_attackC.png': 'attackC',
        'ice-mage/11_hurt.png': 'side/hurt', 'ice-mage/12_death.png': 'side/death'}),
    # the heaviest kit (bulk 1 in src/units.js): broader than the others, his horns and big sword make up the height
    'flame-bastion': ('flame-bastion', 'flame-bastion/01_front.png', 94, 1, twelve('flame-bastion', TWELVE_FILES)),
    # the Bone Hound summon: a dog, so shorter than a knight (its spines and raised tail make up the height)
    'bone-hound': ('bone-hound', 'bone-hound/01_front.png', HOUND_H, 1, twelve('bone-hound', TWELVE_FILES)),
    'bone-hound-f2': ('bone-hound-f2', 'bone-hound-f2/01_front.png', EMBER_H, 1, twelve('bone-hound-f2', TWELVE_FILES)),
    'bone-hound-f3': ('bone-hound-f3', 'bone-hound-f3/01_front.png', WARG_H, 1, twelve('bone-hound-f3', TWELVE_FILES)),
    'bone-hound-f0': ('bone-hound-f0', 'bone-hound-f0/01_front.png', PUP_H, 1, twelve('bone-hound-f0', TWELVE_FILES)),
    # Derek the golem familiar: his sheets put a front-facing cast (fists up, slam, rise) where the 12-pose
    # prompt has its attacks, and a side cast where it has hurt and death. Floating rocks count in his height.
    'derek': ('derek', 'derek/01_front.png', DEREK_H, 1, {
        'derek/01_front.png': 'front', 'derek/02_back.png': 'back', 'derek/03_right.png': 'right',
        'derek/04_walk.png': 'side/walk1', 'derek/05_walk.png': 'side/walk2', 'derek/06_walk.png': 'side/walk3', 'derek/07_walk.png': 'side/walk4',
        'derek/08_attackA.png': 'attackA', 'derek/09_attackB.png': 'attackB', 'derek/10_attackC.png': 'attackC',
        'derek/11_hurt.png': 'side/castUp', 'derek/12_death.png': 'side/castSlam'}),
    'derek-f0': ('derek-f0', 'derek-f0/01_front.png', PEBBLE_H, 1, {
        'derek-f0/01_front.png': 'front', 'derek-f0/02_back.png': 'back', 'derek-f0/03_right.png': 'right',
        'derek-f0/04_walk.png': 'side/walk1', 'derek-f0/05_walk.png': 'side/walk2', 'derek-f0/06_walk.png': 'side/walk3', 'derek-f0/07_walk.png': 'side/walk4',
        'derek-f0/08_attackA.png': 'attackA', 'derek-f0/09_attackB.png': 'attackB', 'derek-f0/10_attackC.png': 'attackC',
        'derek-f0/11_hurt.png': 'side/castUp', 'derek-f0/12_death.png': 'side/castSlam'}),
    'derek-f2': ('derek-f2', 'derek-f2/01_front.png', CRYSTAL_H, 1, {
        'derek-f2/01_front.png': 'front', 'derek-f2/02_back.png': 'back', 'derek-f2/03_right.png': 'right',
        'derek-f2/04_walk.png': 'side/walk1', 'derek-f2/05_walk.png': 'side/walk2', 'derek-f2/06_walk.png': 'side/walk3', 'derek-f2/07_walk.png': 'side/walk4',
        'derek-f2/08_attackA.png': 'attackA', 'derek-f2/09_attackB.png': 'attackB', 'derek-f2/10_attackC.png': 'attackC',
        'derek-f2/11_hurt.png': 'side/castUp', 'derek-f2/12_death.png': 'side/castSlam'}),
    'derek-f3': ('derek-f3', 'derek-f3/01_front.png', BASTION_H, 1, {
        'derek-f3/01_front.png': 'front', 'derek-f3/02_back.png': 'back', 'derek-f3/03_right.png': 'right',
        'derek-f3/04_walk.png': 'side/walk1', 'derek-f3/05_walk.png': 'side/walk2', 'derek-f3/06_walk.png': 'side/walk3', 'derek-f3/07_walk.png': 'side/walk4',
        'derek-f3/08_attackA.png': 'attackA', 'derek-f3/09_attackB.png': 'attackB', 'derek-f3/10_attackC.png': 'attackC',
        'derek-f3/11_hurt.png': 'side/castUp', 'derek-f3/12_death.png': 'side/castSlam'}),
    # Kindle the walking lantern: his sheets put the broken lantern (lying on its side), a pour (refilling a
    # lantern) and a point (leading the way) where the 12-pose prompt has its attacks, and a crouch and a hop
    # where it has hurt and death.
    # Abigail floats: her 'walk' is a drift; attackA/B raise and throw, 'hurt' recoils, then her blessing and her fading
    'abigail': ('abigail', 'abigail/01_front.png', ABIGAIL_H, 1, {
        'abigail/01_front.png': 'front', 'abigail/02_back.png': 'back', 'abigail/03_right.png': 'right',
        'abigail/04_walk.png': 'side/walk1', 'abigail/05_walk.png': 'side/walk2', 'abigail/06_walk.png': 'side/walk3', 'abigail/07_walk.png': 'side/walk4',
        'abigail/08_attackA.png': 'side/castUp', 'abigail/09_attackB.png': 'side/throw', 'abigail/10_attackC.png': 'side/hurt',
        'abigail/11_hurt.png': 'bless', 'abigail/12_death.png': 'side/fade'}),
    'abigail-f2': ('abigail-f2', 'abigail-f2/01_front.png', MOURNING_H, 1, {
        'abigail-f2/01_front.png': 'front', 'abigail-f2/02_back.png': 'back', 'abigail-f2/03_right.png': 'right',
        'abigail-f2/04_walk.png': 'side/walk1', 'abigail-f2/05_walk.png': 'side/walk2', 'abigail-f2/06_walk.png': 'side/walk3', 'abigail-f2/07_walk.png': 'side/walk4',
        'abigail-f2/08_attackA.png': 'side/castUp', 'abigail-f2/09_attackB.png': 'side/throw', 'abigail-f2/10_attackC.png': 'side/hurt',
        'abigail-f2/11_hurt.png': 'bless', 'abigail-f2/12_death.png': 'side/fade'}),
    'abigail-f3': ('abigail-f3', 'abigail-f3/01_front.png', QUEEN_H, 1, {
        'abigail-f3/01_front.png': 'front', 'abigail-f3/02_back.png': 'back', 'abigail-f3/03_right.png': 'right',
        'abigail-f3/04_walk.png': 'side/walk1', 'abigail-f3/05_walk.png': 'side/walk2', 'abigail-f3/06_walk.png': 'side/walk3', 'abigail-f3/07_walk.png': 'side/walk4',
        'abigail-f3/08_attackA.png': 'side/castUp', 'abigail-f3/09_attackB.png': 'side/throw', 'abigail-f3/10_attackC.png': 'side/hurt',
        'abigail-f3/11_hurt.png': 'bless', 'abigail-f3/12_death.png': 'side/fade'}),
    'kindle': ('kindle', 'kindle/01_front.png', KINDLE_H, 1, {
        'kindle/01_front.png': 'front', 'kindle/02_back.png': 'back', 'kindle/03_right.png': 'right',
        'kindle/04_walk.png': 'side/walk1', 'kindle/05_walk.png': 'side/walk2', 'kindle/06_walk.png': 'side/walk3', 'kindle/07_walk.png': 'side/walk4',
        'kindle/08_attackA.png': 'broken', 'kindle/09_attackB.png': 'pour', 'kindle/10_attackC.png': 'side/point',
        'kindle/11_hurt.png': 'side/crouch', 'kindle/12_death.png': 'side/hop'}),
    # Fred: poses A put his breath (attackA), his spit (attackB) and his healing (arms up, facing you) where the attacks go
    'fred-f0': ('fred-f0', 'fred-f0/01_front.png', FRED0_H, 1, dict(twelve('fred-f0', TWELVE_FILES), **{'fred-f0/10_attackC.png': 'heal'})),
    'fred-f3': ('fred-f3', 'fred-f3/01_front.png', FRED3_H, 1, dict(twelve('fred-f3', TWELVE_FILES), **{'fred-f3/10_attackC.png': 'heal'})),
    'fred-f2': ('fred-f2', 'fred-f2/01_front.png', FRED2_H, 1, dict(twelve('fred-f2', TWELVE_FILES), **{'fred-f2/10_attackC.png': 'heal'})),
    'fred-f1': ('fred-f1', 'fred-f1/01_front.png', FRED1_H, 1, dict(twelve('fred-f1', TWELVE_FILES), **{'fred-f1/10_attackC.png': 'heal'})),
    # David: poses A put his breath (rear back), his spit and his shriek where the attacks go
    'wyvern-f0': ('wyvern-f0', 'wyvern-f0/01_front.png', WYV0_H, 1, twelve('wyvern-f0', TWELVE_FILES)),
    'wyvern-f1': ('wyvern-f1', 'wyvern-f1/01_front.png', WYV1_H, 1, twelve('wyvern-f1', TWELVE_FILES)),
    'wyvern-f2': ('wyvern-f2', 'wyvern-f2/01_front.png', WYV2_H, 1, twelve('wyvern-f2', TWELVE_FILES)),
    'wyvern-f3': ('wyvern-f3', 'wyvern-f3/01_front.png', WYV3_H, 1, twelve('wyvern-f3', TWELVE_FILES)),
    'mother': ('wyvern-mother', 'mother/01_front.png', MOTHER_H, 1, {
        'mother/01_front.png': 'front', 'mother/02_back.png': 'back', 'mother/03_right.png': 'right',
        'mother/08_rear.png': 'side/rear', 'mother/09_breath.png': 'side/breath', 'mother/10_rake.png': 'side/rake',
        'mother/13_dive.png': 'side/dive', 'mother/14_roar.png': 'side/roar',
        'mother/15_flyF1.png': 'flyF1', 'mother/16_flyF2.png': 'flyF2', 'mother/17_flyB1.png': 'flyB1', 'mother/18_flyB2.png': 'flyB2',
        'mother/11_hurt.png': 'side/hurt', 'mother/12_death.png': 'side/death'}),
    'starved-bell': ('starved-bell', 'starved-bell/01_front.png', BELL_H, 1, twelve('starved-bell', TWELVE_FILES)),
    'deadly-rose': ('deadly-rose', 'deadly-rose/01_front.png', ROSE_H, 1, twelve('deadly-rose', TWELVE_FILES)),
    # the Chain Reaper (kit 06): slimmer than the Lantern Knight, his hood about as high; the dash sheet came out
    # at a bigger scale, so its lunge gets its own height (about the throw's crouch)
    'jade-breaker': ('jade-breaker', 'jade-breaker/01_front.png', 90, 1, dict(twelve('jade-breaker', TWELVE_FILES), **{
        'jade-breaker/13_dash.png': ('side/dash', {'height': 70}),
        'jade-breaker/14_castA.png': ('side/castA', {'height': 76}),
        'jade-breaker/15_castB.png': ('side/castB', {'height': 72})})),
    # the Rose Paladin (kit 08): crown spikes and all, a little taller than the Flame Bastion
    'rose-paladin': ('rose-paladin', 'rose-paladin/01_front.png', 98, 1, twelve('rose-paladin', TWELVE_FILES)),
    'chain-reaper': ('chain-reaper', 'chain-reaper/01_front.png', 84, 1, dict(twelve('chain-reaper', TWELVE_FILES), **{
        'chain-reaper/13_dash.png': ('side/dash', {'height': 70})})),
    'colossus': ('colossus', 'colossus/01_front.png', COLOSSUS_H, 1, {
        'colossus/01_front.png': 'front', 'colossus/02_back.png': 'back', 'colossus/03_right.png': 'right',
        'colossus/08_attackA.png': 'side/attackA', 'colossus/09_attackB.png': 'side/attackB', 'colossus/11_hurt.png': 'side/hurt',
        'colossus/13_stompUp.png': 'stompUp', 'colossus/14_stompDown.png': 'stompDown', 'colossus/12_death.png': 'death'}),
}

# Animation sheets: character -> [(sheet, columns, rows, height of the first frame's figure, output prefix[, row])].
# With a row, only that row of the sheet is cut (a sheet holding two views).
# Frames come out on one shared canvas (numbered prefix1, prefix2, ...); put the printed foot point
# in that unit's `feet` in src/sprites.js.
SHEETS = {
    # the Frostweaver's side walk (the four walk cells of his poses-b sheet, strung into a strip by the GRIDS step), front and back walks
    'ice-mage': [('ice-mage/walk-side-4.png', 4, 1, 102, 'side/walk'), ('ice-mage/walk-front.png', 4, 1, 104, 'walkF'),
                 ('ice-mage/walk-back.png', 4, 1, 103, 'walkB')],
    'lantern-knight': [
        ('knight-walk-side-4.png', 4, 1, 78, 'side/walk'),
        ('knight-walk-front-4b.png', 4, 1, 80, 'walkF'),
        ('knight-walk-back-4.png', 4, 1, 80, 'walkB'),
    ],
    'mire-stalker': [
        ('mire-stalker/walk-side-4.png', 4, 1, 80, 'side/walk'),
        ('mire-stalker/walk-front-4.png', 4, 1, 82, 'walkF'),
        ('mire-stalker/walk-back-4.png', 4, 1, 81, 'walkB'),
    ],
    'drowned-wretch': [
        ('drowned-wretch/walk-side-4.png', 4, 1, 76, 'side/walk'),
        ('drowned-wretch/walk-front-4.png', 4, 1, 82, 'walkF'),
        ('drowned-wretch/walk-back-4.png', 4, 1, 81, 'walkB'),
    ],
    'tide-archer': [
        ('tide-archer/walk-side-4.png', 4, 1, 79, 'side/walk'),
        ('tide-archer/walk-front-4.png', 4, 1, 88, 'walkF'),
        ('tide-archer/walk-back-4.png', 4, 1, 86, 'walkB'),
    ],
    'swarming-revenant': [
        ('swarming-revenant/walk-side-4.png', 4, 1, 72, 'side/walk'),
        ('swarming-revenant/walk-front-4.png', 4, 1, 78, 'walkF'),
        ('swarming-revenant/walk-back-4.png', 4, 1, 80, 'walkB'),
    ],
    'lantern-reaver': [
        ('lantern-reaver/walk-side-4.png', 4, 1, 79, 'side/walk'),
        ('lantern-reaver/walk-front-4.png', 4, 1, 84, 'walkF'),
        ('lantern-reaver/walk-back-4.png', 4, 1, 85, 'walkB'),
    ],
    'bone-bulwark': [
        ('bone-bulwark/walk-side-4.png', 4, 1, 85, 'side/walk'),
        ('bone-bulwark/walk-front-4.png', 4, 1, 86, 'walkF'),
        ('bone-bulwark/walk-back-4.png', 4, 1, 85, 'walkB'),
    ],
    'marsh-hexbearer': [
        ('marsh-hexbearer/walk-side-4.png', 4, 1, 89, 'side/walk'),
        ('marsh-hexbearer/walk-front-4.png', 4, 1, 93, 'walkF'),
        ('marsh-hexbearer/walk-back-4.png', 4, 1, 91, 'walkB'),
    ],
    'drowned-sovereign': [
        ('drowned-sovereign/walk-side-4.png', 4, 1, 125, 'side/walk'),
        ('drowned-sovereign/walk-front-4.png', 4, 1, 127, 'walkF'),
        ('drowned-sovereign/walk-back-4.png', 4, 1, 129, 'walkB'),
    ],
    'pike-warden': [
        ('pike-warden/walk-side-4.png', 4, 1, 99, 'side/walk'),
        ('pike-warden/walk-front-4.png', 4, 1, 101, 'walkF'),
        ('pike-warden/walk-back-4.png', 4, 1, 101, 'walkB'),
    ],
    'chain-reaper': [
        ('chain-reaper/walk-side-4.png', 4, 1, 78, 'side/walk'),
        ('chain-reaper/walk-front-4.png', 4, 1, 84, 'walkF'),
        ('chain-reaper/walk-back-4.png', 4, 1, 84, 'walkB'),
        # his run (played at full speed), on green like the rest of him
        ('chain-reaper/run-side.png', 4, 1, 74, 'side/run'),
        ('chain-reaper/run-front.png', 4, 1, 80, 'runF'),
        ('chain-reaper/run-back.png', 4, 1, 80, 'runB'),
    ],
    'jade-breaker': [
        ('jade-breaker/walk-side-4.png', 4, 1, 88, 'side/walk'),
        ('jade-breaker/walk-front.png', 4, 1, 90, 'walkF'),
        # his run (played at full speed): leaning forward, so shorter than he stands
        ('jade-breaker/run-side.png', 4, 1, 86, 'side/run'),
        ('jade-breaker/run-front.png', 4, 1, 92, 'runF'),
        ('jade-breaker/run-back.png', 4, 1, 92, 'runB'),
        ('jade-breaker/walk-back.png', 4, 1, 90, 'walkB'),
    ],
    'rose-paladin': [
        ('rose-paladin/walk-side-4.png', 4, 1, 96, 'side/walk'),
        ('rose-paladin/walk-front-4.png', 4, 1, 98, 'walkF'),
        ('rose-paladin/walk-back-4.png', 4, 1, 98, 'walkB'),
    ],
    'ashen-arbalist': [
        ('ashen-arbalist/walk-side-4.png', 4, 1, 80, 'side/walk'),
        ('ashen-arbalist/walk-front-4.png', 4, 1, 82, 'walkF'),
        ('ashen-arbalist/walk-back-4.png', 4, 1, 82, 'walkB'),
    ],
    'flame-bastion': [
        ('flame-bastion/walk-side-4.png', 4, 1, 92, 'side/walk'),
        ('flame-bastion/walk-front-4.png', 4, 1, 94, 'walkF'),
        ('flame-bastion/walk-back-4.png', 4, 1, 90, 'walkB'),
    ],
    # the side gallop's first frame is stretched out low, so it is much shorter than the standing pose
    'bone-hound': [
        ('bone-hound/walk-side-4.png', 4, 1, 40, 'side/walk'),
        ('bone-hound/walk-front-4.png', 4, 1, 62, 'walkF'),
        ('bone-hound/walk-back-4.png', 4, 1, 64, 'walkB'),
    ],
    # the pup's front and back walks came out drawn bigger than its poses, so they're sized by the skull's width
    'bone-hound-f0': [
        ('bone-hound-f0/walk-side-4.png', 4, 1, 64, 'side/walk'),
        ('bone-hound-f0/walk-front.png', 4, 1, 86, 'walkF'),
        ('bone-hound-f0/walk-back.png', 4, 1, 85, 'walkB'),
    ],
    'bone-hound-f2': [
        ('bone-hound-f2/walk-side-4.png', 4, 1, 105, 'side/walk'),
        ('bone-hound-f2/walk-front.png', 4, 1, EMBER_H, 'walkF'),
        ('bone-hound-f2/walk-back.png', 4, 1, EMBER_H, 'walkB'),
    ],
    'bone-hound-f3': [
        ('bone-hound-f3/walk-side-4.png', 4, 1, 124, 'side/walk'),
        ('bone-hound-f3/walk-front.png', 4, 1, WARG_H, 'walkF'),
        ('bone-hound-f3/walk-back.png', 4, 1, WARG_H, 'walkB'),
    ],
    'derek': [
        ('derek/walk-side-4.png', 4, 1, DEREK_SIDE_H, 'side/walk'),
        ('derek/walk-front-4.png', 4, 1, DEREK_H, 'walkF'),
        ('derek/walk-back-4.png', 4, 1, DEREK_H, 'walkB'),
    ],
    # his front and back walks were drawn at other scales than his poses: sized by the width of his body
    'derek-f0': [
        ('derek-f0/walk-side-4.png', 4, 1, 45, 'side/walk'),
        ('derek-f0/walk-front.png', 4, 1, 43, 'walkF'),
        ('derek-f0/walk-back.png', 4, 1, 42, 'walkB'),
    ],
    'derek-f2': [
        ('derek-f2/walk-side-4.png', 4, 1, 73, 'side/walk'),
        ('derek-f2/walk-front.png', 4, 1, CRYSTAL_H, 'walkF'),
        ('derek-f2/walk-back.png', 4, 1, CRYSTAL_H, 'walkB'),
    ],
    'derek-f3': [
        ('derek-f3/walk-side-4.png', 4, 1, 83, 'side/walk'),
        ('derek-f3/walk-front.png', 4, 1, BASTION_H, 'walkF'),
        ('derek-f3/walk-back.png', 4, 1, BASTION_H, 'walkB'),
    ],
    'fred-f0': [
        ('fred-f0/walk-side-4.png', 4, 1, FRED0_H, 'side/walk'),
        ('fred-f0/walk-front.png', 4, 1, FRED0_H, 'walkF'),
        ('fred-f0/walk-back.png', 4, 1, FRED0_H, 'walkB'),
    ],
    # his flap cycles toward and away from you; the first frame has the wings raised, so it stands taller
    'wyvern-f0': [
        ('wyvern-f0/walk-side-4.png', 4, 1, 115, 'side/walk'),
        ('wyvern-f0/fly-front.png', 4, 1, 114, 'walkF'),
        ('wyvern-f0/fly-back.png', 4, 1, 120, 'walkB'),
    ],
    'wyvern-f1': [
        ('wyvern-f1/walk-side-4.png', 4, 1, 158, 'side/walk'),
        ('wyvern-f1/fly-front.png', 4, 1, 171, 'walkF'),
        ('wyvern-f1/fly-back.png', 4, 1, 187, 'walkB'),
    ],
    # Great David's wings are raised far higher in the first fly frames, so they stand much taller than his poses
    'wyvern-f2': [
        ('wyvern-f2/walk-side-4.png', 4, 1, 208, 'side/walk'),
        ('wyvern-f2/fly-front.png', 4, 1, 265, 'walkF'),
        ('wyvern-f2/fly-back.png', 4, 1, 259, 'walkB'),
    ],
    'wyvern-f3': [
        ('wyvern-f3/walk-side-4.png', 4, 1, 255, 'side/walk'),
        ('wyvern-f3/fly-front.png', 4, 1, 287, 'walkF'),
        ('wyvern-f3/fly-back.png', 4, 1, 285, 'walkB'),
    ],
    # her side "walk" is poses B's four wing beats: she flies side on, and stalks on foot toward and away from you
    'mother': [
        ('mother/walk-side-4.png', 4, 1, 392, 'side/fly'),
        ('mother/walk-front.png', 4, 1, 380, 'walkF'),
        ('mother/walk-back.png', 4, 1, 386, 'walkB'),
    ],
    'fred-f1': [
        ('fred-f1/walk-side-4.png', 4, 1, FRED1_H, 'side/walk'),
        ('fred-f1/walk-front.png', 4, 1, FRED1_H, 'walkF'),
        ('fred-f1/walk-back.png', 4, 1, FRED1_H, 'walkB'),
    ],
    'fred-f2': [
        ('fred-f2/walk-side-4.png', 4, 1, FRED2_H, 'side/walk'),
        ('fred-f2/walk-front.png', 4, 1, FRED2_H, 'walkF'),
        ('fred-f2/walk-back.png', 4, 1, FRED2_H, 'walkB'),
    ],
    'fred-f3': [
        ('fred-f3/walk-side-4.png', 4, 1, FRED3_H, 'side/walk'),
        ('fred-f3/walk-front.png', 4, 1, FRED3_H, 'walkF'),
        ('fred-f3/walk-back.png', 4, 1, FRED3_H, 'walkB'),
    ],
    'abigail': [
        ('abigail/walk-side-4.png', 4, 1, ABIGAIL_H, 'side/walk'),
        ('abigail/walk-front-4.png', 4, 1, ABIGAIL_H, 'walkF'),
        ('abigail/walk-back-4.png', 4, 1, ABIGAIL_H, 'walkB'),
    ],
    # her front and back drifts were drawn a little bigger and with longer hems: sized by the hood
    'abigail-f2': [
        ('abigail-f2/walk-side-4.png', 4, 1, 117, 'side/walk'),
        ('abigail-f2/walk-front.png', 4, 1, 145, 'walkF'),
        ('abigail-f2/walk-back.png', 4, 1, 145, 'walkB'),
    ],
    'abigail-f3': [
        ('abigail-f3/walk-side-4.png', 4, 1, 128, 'side/walk'),
        ('abigail-f3/walk-front.png', 4, 1, 162, 'walkF'),
        ('abigail-f3/walk-back.png', 4, 1, 157, 'walkB'),
    ],
    'kindle': [
        ('kindle/walk-side-4.png', 4, 1, KINDLE_H, 'side/walk'),
        ('kindle/walk-front-4.png', 4, 1, KINDLE_H, 'walkF'),
        ('kindle/walk-back-4.png', 4, 1, KINDLE_H, 'walkB'),
    ],
    'starved-bell': [
        ('starved-bell/walk-side-4.png', 4, 1, BELL_H, 'side/walk'),
        ('starved-bell/walk-front-4.png', 4, 1, BELL_H, 'walkF'),
        ('starved-bell/walk-back-4.png', 4, 1, BELL_H, 'walkB'),
    ],
    'deadly-rose': [
        ('deadly-rose/walk-side-4.png', 4, 1, ROSE_H, 'side/walk'),
        ('deadly-rose/walk-front-4.png', 4, 1, ROSE_H, 'walkF'),
        ('deadly-rose/walk-back-4.png', 4, 1, ROSE_H, 'walkB'),  # repacked from walk-back-4-raw.png, whose frames overran their quarters
    ],
    # its side crawl came as three cells of the second pose sheet
    'colossus': [
        ('colossus/walk-side-4.png', 3, 1, COLOSSUS_H - 20, 'side/walk'),
        ('colossus/walk-front-4.png', 4, 1, COLOSSUS_H, 'walkF'),
        ('colossus/walk-back-4.png', 4, 1, COLOSSUS_H, 'walkB'),
    ],
}

# Walk sheets the AI drew out of order or stepping with one foot only: the frames (1-based) to keep,
# in play order; a negative number is that frame with its legs mirrored, giving the other foot's step.
FRAME_ORDER = {('lantern-knight', 'walkB'): [2, 1, 4, -1], ('mire-stalker', 'walkB'): [1, 2, 3, -2],
               # the lantern is missing from frames 1 and 3
               ('drowned-wretch', 'walkB'): [2, 2, 4, 4],
               # every frame steps with the same foot
               ('pike-warden', 'walkF'): [1, 3, -1, 3]}

# Where to mirror legs when the feet can't be found from the bottom rows (one foot lifted, a staff butt
# beside them): character -> (legs share, half width, centre x) for mirror_legs.
MIRROR_AT = {}  # (the Relic Bearer's, retired with him in v0.15.135, was (0.32, 10, 39))

# Walk sheets rendered in other colours than the character's first batch: recolour to this image.
SHEET_MATCH = {'tide-archer': 'tide-archer/01_front.png'}

# World props (plants for now): sheet -> (columns, rows, a sprite name per cell in reading order, None to skip).
# They're cut at res 2 like the units; PROPS in src/sprites.js lists the files.
PROP_GRIDS = {
    'plants/plants-lit.png': (5, 2, ['refugeOn', 'sentinelOn', 'rootOn', None, 'husk', None, None, None, 'gardenOn', None]),
    'plants/plants-unlit.png': (3, 2, ['refugeOff', 'sentinelOff', 'rootOff', None, None, 'gardenOff']),
    # the Bloom Sprout by day then glowing by night: whole, hacked once, harvested stump (the two stumps match)
    'plants/sprout-stages.png': (3, 2, ['sproutOff', 'sproutOff2', 'sproutBare', 'sproutOn', 'sproutOn2', None]),
    'plants/reeds.png': (3, 2, ['reeds1', 'reeds2', 'reeds3', 'reeds4', 'reeds5', 'reeds6']),
    'plants/garden-beds.png': (3, 1, ['gardenBed1', 'gardenBed2', 'gardenBed3']),
    # three trees, each whole -> lopped -> broken -> stump as it's chopped
    'world/trees-stages.png': (4, 3, ['swampTree11', 'swampTree12', 'swampTree13', 'swampTree14', 'swampTree21', 'swampTree22', 'swampTree23', 'swampTree24', 'swampTree31', 'swampTree32', 'swampTree33', 'swampTree34']),
    # camp buildings, one picture per level (the Central Flame has one per camp tier)
    'camp/flame.png': (3, 1, ['flame1', 'flame2', 'flame3']),
    'camp/forge.png': (4, 1, ['forge1', 'forge2', 'forge3', 'forge4']),
    'camp/armory.png': (4, 1, ['armory1', 'armory2', 'armory3', 'armory4']),
    'camp/workbench.png': (4, 1, ['workbench1', 'workbench2', 'workbench3', 'workbench4']),
    'camp/towers.png': (3, 1, ['tower1', 'tower2', 'tower3']),
    'camp/pylons.png': (3, 1, ['pylon1', 'pylon2', 'pylon3']),
    # these keep the coded sprites' names, so the drawn ones simply replace them
    'camp/barricade.png': (5, 1, ['stake', 'palisade', 'gatePost', 'gatePost2', 'palisade2']),
    # the east and west walls, seen from the side (running away from the viewer), and the corner posts
    'camp/side-walls.png': (4, 1, ['palisadeSide', 'palisadeSide2', 'cornerPost', 'cornerPost2']),
    'camp/tent-banner.png': (2, 1, ['tent', 'banner']),
    'camp/torches.png': (3, 1, ['torch', 'burnt', 'brazier']),
    # the fire's animation frames (Art.drawFire)
    'camp/fire.png': (6, 1, ['fire1', 'fire2', 'fire3', 'fire4', 'fire5', 'fire6']),
    # three iron deposits, each whole -> cracked -> rubble
    'world/iron.png': (3, 3, ['iron11', 'iron12', 'iron13', 'iron21', 'iron22', 'iron23', 'iron31', 'iron32', 'iron33']),
    # three amethyst deposits (the 'pearl' resource), each whole -> snapped -> stumps
    'world/amethyst.png': (3, 3, ['amethyst11', 'amethyst12', 'amethyst13', 'amethyst21', 'amethyst22', 'amethyst23', 'amethyst31', 'amethyst32', 'amethyst33']),
    # the five supplies, as pickups ('res' + resource key)
    'world/supplies.png': (5, 1, ['resWood', 'resStone', 'resResin', 'resIron', 'resPearl']),
    # two boulders, bare then mossy, each whole -> cracked -> crumbling
    # the Bone Wolf den (src/den.js): guarded (eyes in the dark) while the pack lives, then cleared
    'den/den.png': (2, 1, ['denGuarded', 'denCleared']),
    # the mouth of Derek's Hollow: sealed by a slab, then open with its runes lit
    'cave/cave-entrance.png': (2, 1, ['caveSealed', 'caveOpen']),
    # the Abyss graves (src/abigail.js): the headstone where soul orbs are laid, two graves, a pillar (keeping the coded names)
    'abigail/graves.png': (4, 1, ['headstone', 'grave', 'grave2', 'pillar']),
    # Abigail's soul orb: lying out in the world, then flying (two flickers)
    'abigail/soul-orb.png': (3, 1, ['soulOrb', 'soulFly1', 'soulFly2']),
    # the Deadly Rose's briar (src/rose.js): thorns breaking the ground, shooting up, grown, swaying, withering
    'deadly-rose/briar.png': (5, 1, ['roseBriar1', 'roseBriar2', 'roseBriar3', 'roseBriar4', 'roseBriar5']),
    # her whip lash's trail: coiled, cracked out in a long arc, fading in petals
    'deadly-rose/lash.png': (3, 1, ['roseLash1', 'roseLash2', 'roseLash3']),
    # her waltz: a ring of whirling thorn whips, a quarter turn a frame (it loops)
    'deadly-rose/waltz.png': (4, 1, ['roseWaltz1', 'roseWaltz2', 'roseWaltz3', 'roseWaltz4']),
    # the giant bud she sleeps in, and the withered bloom she leaves when slain
    'deadly-rose/heart.png': (2, 1, ['roseBud', 'roseWither']),
    # the rose bushes ringing her garden: low and wide, tall, half dead (keeping the coded names)
    'deadly-rose/bushes.png': (3, 1, ['roseBush0', 'roseBush1', 'roseBush2']),
    # petals on the wind round her garden: six tumbling shapes, played in turn as a petal drifts
    'deadly-rose/petals.png': (6, 1, ['rosePetal1', 'rosePetal2', 'rosePetal3', 'rosePetal4', 'rosePetal5', 'rosePetal6']),
    # the companion homes (src/summons.js), one picture per level
    'camp/kennel.png': (3, 1, ['kennel1', 'kennel2', 'kennel3']),
    'camp/workshop.png': (3, 1, ['workshop1', 'workshop2', 'workshop3']),
    'camp/shrine.png': (3, 1, ['shrine1', 'shrine2', 'shrine3']),
    'camp/toadstool.png': (3, 1, ['toadstool1', 'toadstool2', 'toadstool3']),
    'camp/roost.png': (3, 1, ['roost1', 'roost2', 'roost3']),
    # David's nest in the Reaches (src/wyvern.js), with its clutch and empty; his egg whole, hatching and broken
    'world/wyvern-nest.png': (2, 1, ['wyvNest', 'wyvNestEmpty']),
    'world/wyvern-egg.png': (3, 1, ['wyvEgg', 'wyvEggHatch', 'wyvEggShell']),
    # Fred's fairy ring in the Reaches (src/fred.js), alive and wilted
    'world/fairy-ring.png': (2, 1, ['fairyRing', 'fairyRingWilt']),
    # Fred's glowcaps: sprouting, grown, squashed underfoot
    'world/glowcap.png': (3, 1, ['glowcap1', 'glowcap2', 'glowcap3']),
    # the Abyss trophies (src/trophies.js): the Starved Bell's clapper hung in a tower, the Rose's heart at three levels
    'camp/bell-tower.png': (1, 1, ['bellTower']),
    'camp/rose-heart.png': (3, 1, ['roseHeart1', 'roseHeart2', 'roseHeart3']),
    # a forward outpost in a bloom grove (src/outposts.js), its fire basket unlit (the fire is drawn on top)
    'camp/outpost.png': (1, 1, ['outpost']),
    # three Black Pearl clams (the Abyss resource), each whole -> prised open -> broken, and its pickup
    'world/black-pearl.png': (3, 3, ['blackPearl11', 'blackPearl12', 'blackPearl13', 'blackPearl21', 'blackPearl22', 'blackPearl23', 'blackPearl31', 'blackPearl32', 'blackPearl33']),
    'world/res-black-pearl.png': (1, 1, ['resBlack']),
    # the Chain Reaper's pieces (src/kits.js, drawn in src/render.js), on green: the flying sickle a quarter turn a frame,
    # a run of chain that repeats end to end and the weight on its end, Violet Snare's ring, the coil on a snared Drowned
    'chain-reaper/sickle-spin.png': (4, 1, ['reaperSickle1', 'reaperSickle2', 'reaperSickle3', 'reaperSickle4']),
    'chain-reaper/chain-weight.png': (2, 1, ['reaperChain', 'reaperWeight']),
    'chain-reaper/snare-ring.png': (1, 1, ['reaperSnare']),
    'chain-reaper/snared.png': (1, 1, ['reaperSnared']),
    # the Flame Bastion's fire wall (src/kits.js, drawn in src/render.js): one section of the wall flickering, lined up along it
    'flame-bastion/fire-wall.png': (4, 1, ['wallFire1', 'wallFire2', 'wallFire3', 'wallFire4']),
    # the Ashen Arbalist's bolts in flight (plain, then the level 15 Flare Bolt) and the burst of light where a flare lands
    'ashen-arbalist/bolts.png': (2, 1, ['arbBolt', 'arbFlareBolt']),
    'ashen-arbalist/flare.png': (4, 1, ['arbFlare1', 'arbFlare2', 'arbFlare3', 'arbFlare4']),
    # Jade Tide's crystals bursting from the ground: cracking up, grown, glinting, shattering
    'jade-breaker/crystals.png': (4, 1, ['jadeCrystal1', 'jadeCrystal2', 'jadeCrystal3', 'jadeCrystal4']),
    'world/boulders.png': (6, 2, ['boulder11', 'boulder12', 'boulder13', 'boulder21', 'boulder22', 'boulder23', 'boulder31', 'boulder32', 'boulder33', 'boulder41', 'boulder42', 'boulder43']),
}
# Height in file px of each unlit plant (twice the art px); the lit one is scaled to match its unlit twin by the
# width of their rocky base, since glow wisps change its height. Names not listed here use their own height.
PROP_HEIGHT = {'refugeOff': 116, 'sentinelOff': 96, 'rootOff': 150, 'sproutOff': 60, 'gardenOff': 14, 'husk': 104, 'reeds2': 50, 'gardenBed2': 100, 'swampTree21': 140, 'boulder11': 60,
               'flame3': 110, 'tower3': 160, 'pylon3': 120,
               'stake': 40, 'gatePost': 100, 'banner': 96,
               'torch': 58, 'fire3': 64}
# Or the width in file px, for low, wide props.
PROP_WIDTH = {'flame1': 84, 'flame2': 104, 'forge4': 124, 'armory4': 120, 'workbench4': 116, 'palisade': 56, 'tent': 100, 'brazier': 44, 'iron11': 62}
PROP_HEIGHT['amethyst11'] = 50
PROP_WIDTH['resWood'] = 22
PROP_WIDTH['denGuarded'] = 220  # about four knights wide
PROP_WIDTH['caveOpen'] = 176  # about four knights wide
PROP_HEIGHT.update({'headstone': 84, 'grave': 50, 'pillar': 104, 'soulOrb': 40})
PROP_WIDTH.update({'grave2': 60, 'soulFly1': 56, 'soulFly2': 56})
# Renders whose own colours come close to the magenta key (purple crystals): key them out with a tighter
# tolerance than the default 120 and without the purple-fringe filter, so the art isn't eaten.
PROP_TOL = {n: 60 for n in ['amethyst11', 'amethyst12', 'amethyst13', 'amethyst21', 'amethyst22', 'amethyst23', 'amethyst31', 'amethyst32', 'amethyst33']}
PROP_TOL['resPearl'] = 60
# Props whose footing isn't in the middle of the picture (a leaning stake, a post with a lamp hung out to one
# side): padded so the footing is centred, since sprites are drawn centred on their spot.
PROP_FOOT_CENTRE = {'stake', 'gatePost', 'gatePost2', 'fire1', 'fire2', 'fire3', 'fire4', 'fire5', 'fire6'}
# Variants drawn on one sheet at one scale: name -> the variant whose scale it shares.
PROP_SAME = {'caveSealed': 'caveOpen', 'gardenBed1': 'gardenBed2', 'gardenBed3': 'gardenBed2', 'reeds1': 'reeds2', 'reeds3': 'reeds2', 'reeds4': 'reeds2', 'reeds5': 'reeds2', 'reeds6': 'reeds2',
            'boulder12': 'boulder11', 'boulder13': 'boulder11', 'boulder21': 'boulder11', 'boulder22': 'boulder11', 'boulder23': 'boulder11', 'boulder31': 'boulder11', 'boulder32': 'boulder11', 'boulder33': 'boulder11', 'boulder41': 'boulder11', 'boulder42': 'boulder11', 'boulder43': 'boulder11',
            'forge1': 'forge4', 'forge2': 'forge4', 'forge3': 'forge4',
            'armory1': 'armory4', 'armory2': 'armory4', 'armory3': 'armory4',
            'workbench1': 'workbench4', 'workbench2': 'workbench4', 'workbench3': 'workbench4',
            'tower1': 'tower3', 'tower2': 'tower3',
            'pylon1': 'pylon3', 'pylon2': 'pylon3', 'palisade2': 'palisade', 'gatePost2': 'gatePost',
            'palisadeSide': 'palisade', 'palisadeSide2': 'palisade', 'cornerPost': 'palisade', 'cornerPost2': 'palisade',
            'burnt': 'torch', 'fire1': 'fire3', 'fire2': 'fire3', 'fire4': 'fire3', 'fire5': 'fire3', 'fire6': 'fire3',
            'iron12': 'iron11', 'iron13': 'iron11', 'iron21': 'iron11', 'iron22': 'iron11', 'iron23': 'iron11', 'iron31': 'iron11', 'iron32': 'iron11', 'iron33': 'iron11',
            'amethyst12': 'amethyst11', 'amethyst13': 'amethyst11', 'amethyst21': 'amethyst11', 'amethyst22': 'amethyst11', 'amethyst23': 'amethyst11', 'amethyst31': 'amethyst11', 'amethyst32': 'amethyst11', 'amethyst33': 'amethyst11',
            'denCleared': 'denGuarded',
            'resStone': 'resWood', 'resResin': 'resWood', 'resIron': 'resWood', 'resPearl': 'resWood'}
# the Deadly Rose's briar: grown, a bit taller than the knight; every frame at that one scale
PROP_HEIGHT['roseBriar3'] = 96
PROP_SAME.update({n: 'roseBriar3' for n in ['roseBriar1', 'roseBriar2', 'roseBriar4', 'roseBriar5']})
PROP_WIDTH['roseLash2'] = 150  # the lash's reach
PROP_SAME.update({'roseLash1': 'roseLash2', 'roseLash3': 'roseLash2'})
PROP_WIDTH['roseWaltz1'] = 340  # as wide as the ring she cuts (DL.ROSE.waltz.r 170)
PROP_HEIGHT['roseBud'] = 128  # a bit taller than the knight
PROP_SAME['roseWither'] = 'roseBud'
PROP_HEIGHT['roseBush1'] = 84  # the tall one, about the knight's height
PROP_SAME.update({'roseBush0': 'roseBush1', 'roseBush2': 'roseBush1'})
PROP_WIDTH['rosePetal1'] = 16
PROP_SAME.update({'rosePetal%d' % i: 'rosePetal1' for i in range(2, 7)})
PROP_SAME.update({'roseWaltz2': 'roseWaltz1', 'roseWaltz3': 'roseWaltz1', 'roseWaltz4': 'roseWaltz1'})
# the companion homes: each about as wide as the forge at its last level
# (a little smaller than the forge, so the crowded first camp still has room for them)
PROP_WIDTH.update({'kennel3': 92, 'workshop3': 108, 'shrine3': 104, 'toadstool3': 100, 'fairyRing': 240, 'glowcap2': 22})
PROP_HEIGHT.update({'bellTower': 130, 'roseHeart3': 86})  # the tower well over the knight, the great bud about his height
PROP_SAME.update({'roseHeart1': 'roseHeart3', 'roseHeart2': 'roseHeart3'})
PROP_WIDTH.update({'outpost': 120, 'blackPearl11': 64, 'resBlack': 22})  # the outpost about two knights wide, a clam about a shield
PROP_SAME.update({n: 'blackPearl11' for n in ['blackPearl11', 'blackPearl12', 'blackPearl13', 'blackPearl21', 'blackPearl22', 'blackPearl23', 'blackPearl31', 'blackPearl32', 'blackPearl33'] if n != 'blackPearl11'})
PROP_WIDTH.update({'roost3': 116, 'wyvNest': 170})  # the eyrie with its hung wings a little wider than the other homes; the nest about two knights across
PROP_HEIGHT['wyvEgg'] = 22  # about a quarter of the knight
PROP_SAME.update({'roost1': 'roost3', 'roost2': 'roost3', 'wyvNestEmpty': 'wyvNest', 'wyvEggHatch': 'wyvEgg', 'wyvEggShell': 'wyvEgg'})
PROP_SAME.update({'kennel1': 'kennel3', 'kennel2': 'kennel3', 'workshop1': 'workshop3', 'workshop2': 'workshop3', 'shrine1': 'shrine3', 'shrine2': 'shrine3', 'toadstool1': 'toadstool3', 'toadstool2': 'toadstool3', 'fairyRingWilt': 'fairyRing', 'glowcap1': 'glowcap2', 'glowcap3': 'glowcap2'})
PROP_SAME.update({n: 'sproutOff' for n in ['sproutOff2', 'sproutBare', 'sproutOn', 'sproutOn2']})
PROP_TWIN = {'refugeOn': 'refugeOff', 'sentinelOn': 'sentinelOff', 'rootOn': 'rootOff',
             'gardenOn': 'gardenOff'}
PROP_HEIGHT.update({'reaperSickle1': 30, 'reaperChain': 6, 'reaperWeight': 14})  # the sickle as big as in his hand; the chain's links 3 px across
PROP_WIDTH.update({'reaperSnare': 230, 'reaperSnared': 36})  # the ring as wide as the snare reaches (DL.KITS.chainReaper.ability.radius); the coil a Drowned's ankles
PROP_SAME.update({'reaperSickle2': 'reaperSickle1', 'reaperSickle3': 'reaperSickle1', 'reaperSickle4': 'reaperSickle1'})
PROP_WIDTH['wallFire1'] = 84  # a section about half the wall's 170 px, so they overlap along it
PROP_SAME.update({'wallFire2': 'wallFire1', 'wallFire3': 'wallFire1', 'wallFire4': 'wallFire1'})
PROP_WIDTH.update({'arbBolt': 28, 'arbFlare2': 124})  # a bolt about a third of the knight; the burst as wide as a flare's reach (game.js flare(), 58 px)
PROP_HEIGHT['jadeCrystal2'] = 60  # the grown crystals about two thirds of the knight
PROP_SAME.update({'jadeCrystal1': 'jadeCrystal2', 'jadeCrystal3': 'jadeCrystal2', 'jadeCrystal4': 'jadeCrystal2'})
PROP_SAME.update({'arbFlareBolt': 'arbBolt', 'arbFlare1': 'arbFlare2', 'arbFlare3': 'arbFlare2', 'arbFlare4': 'arbFlare2'})
# Prop sheets drawn on another key colour than magenta, by folder.
PROP_KEY = {'chain-reaper': (0, 255, 0)}
PROP_OUT = 'props'
# Renders where the magenta background tinted the art pink (the trees' moss): pull it back out (see despill).
PROP_DESPILL = set(['swampTree11', 'swampTree12', 'swampTree13', 'swampTree14', 'swampTree21', 'swampTree22', 'swampTree23', 'swampTree24', 'swampTree31', 'swampTree32', 'swampTree33', 'swampTree34'])
PROP_SAME.update({n: 'swampTree21' for n in PROP_DESPILL if n != 'swampTree21'})

# Sheets where two poses touch: magenta lines (x, y0, y1) painted down the gap before the sheet is split.
SEAMS = {'wyvern-f3/poses-a.png': [(533, 0, 512)], 'wyvern-f3/fly-back.png': [(446, 0, 724)],
         'wyvern-f2/fly-front.png': [(465, 0, 724), (1122, 0, 724), (1565, 0, 724)],
         'wyvern-f2/fly-back.png': [(457, 0, 724), (1092, 0, 724), (1512, 0, 724)]}
# Animation sheets whose wings reach over into the next cell: split by figure (as GRIDS are) and laid out
# again in equal cells before cutting, so no frame picks up its neighbour's wingtip or loses its own.
REGRID = {'wyvern-f%d/%s' % (f, n) for f in range(4) for n in ('fly-front.png', 'fly-back.png')} | {'mother/walk-front.png', 'mother/walk-back.png', 'chain-reaper/run-side.png'}

def open_sheet(sheet):
    img = Image.open(os.path.join(SRC, sheet)).convert('RGB')
    for x, y0, y1 in SEAMS.get(sheet, []):
        img.paste((255, 0, 255), (x - 1, y0, x + 2, y1))
    return img

def regrid(img, cols, rows, key=(255, 0, 255)):
    cells = split_grid(img, cols, rows, key=key)
    cw, ch = max(c.width for c in cells), max(c.height for c in cells)
    out = Image.new('RGB', (cw * cols, ch * rows), key)
    for i, c in enumerate(cells):
        out.paste(c, ((i % cols) * cw + (cw - c.width) // 2, (i // cols) * ch + ch - c.height))
    return out

only = sys.argv[2:]  # optional character names to cut
for sheet, (cols, rows, names) in GRIDS.items():
    p = os.path.join(SRC, sheet)
    if not os.path.exists(p) or (only and os.path.dirname(sheet) not in only): continue
    ko = KEY_OPTS.get(os.path.dirname(sheet), {})
    key = ko.get('key', (255, 0, 255))
    for n, cell in zip(names, split_grid(open_sheet(sheet), cols, rows, key=key, tol=ko.get('tol', 120))):
        f = CELL_SCALE.get(os.path.dirname(sheet) + '/' + n)
        if f: cell = cell.resize((round(cell.width * f), round(cell.height * f)), Image.NEAREST)
        crop = CELL_CROP.get(os.path.dirname(sheet) + '/' + n)
        if crop: cell.paste(key, (round(cell.width * crop), 0, cell.width, cell.height))
        cell.save(os.path.join(os.path.dirname(p), n + '.png'))
    for n in names:
        redo = CELL_REDRAW.get(os.path.dirname(sheet) + '/' + n)
        if not redo or not os.path.exists(os.path.join(os.path.dirname(p), redo[0])): continue
        img = Image.open(os.path.join(os.path.dirname(p), redo[0])).convert('RGB')
        like = cut_keyed(Image.open(os.path.join(os.path.dirname(p), redo[1] + '.png')), 1, fringe=1).height
        f = like / cut_keyed(img, 1, fringe=1).height
        img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS).save(os.path.join(os.path.dirname(p), n + '.png'))
    walks = sorted(n for n in names if 'walk' in n)
    if walks:
        cells = [Image.open(os.path.join(os.path.dirname(p), n + '.png')) for n in walks]
        cw, ch = max(c.width for c in cells), max(c.height for c in cells)
        strip = Image.new('RGB', (cw * len(cells), ch), key)
        for i, c in enumerate(cells):
            strip.paste(c, (i * cw + (cw - c.width) // 2, ch - c.height))
        strip.save(os.path.join(os.path.dirname(p), 'walk-side-4.png'))
for name, (folder, ref, target, fringe, files) in SETS.items():
    if only and name not in only: continue
    ko = KEY_OPTS.get(name, {})
    k = target / (cut_keyed(Image.open(os.path.join(SRC, ref)), 1, fringe=fringe, **ko).height - 2)
    done = []
    for src, out in files.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p): continue
        out, opt = out if isinstance(out, tuple) else (out, {})
        img, fr = Image.open(p), opt.get('fringe', fringe)
        kk = opt['height'] / (cut_keyed(img, 1, fringe=fr, **ko).height - 2) if 'height' in opt else k
        rc = match_colors(Image.open(os.path.join(SRC, opt['match']))) if 'match' in opt else RECOLOR.get(name)
        im = cut_keyed(img, kk, fringe=fr, colors=64 if rc else 32, recolor=rc, **ko)
        if opt.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        dst = os.path.join(OUT, folder, out + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        done.append(im)
        print(dst, im.size)
    if done: contact(done, os.path.join(SRC, name + '-preview.png'))

for name, sheets in SHEETS.items():
    if only and name not in only: continue
    folder = SETS[name][0]
    for sheet, cols, rows, height, prefix, *row in sheets:
        p = os.path.join(SRC, sheet)
        if not os.path.exists(p): continue
        img = open_sheet(sheet)
        if sheet in REGRID: img = regrid(img, cols, rows, KEY_OPTS.get(name, {}).get('key', (255, 0, 255)))
        if row:
            h = img.height // rows
            img, rows = img.crop((0, row[0] * h, img.width, (row[0] + 1) * h)), 1
        frames, feet = cut_sheet(img, cols, rows, height, **KEY_OPTS.get(name, {}))
        if name in SHEET_MATCH:
            frames = recolor_frames(frames, match_colors(Image.open(os.path.join(SRC, SHEET_MATCH[name]))))
        if name in RECOLOR: frames = recolor_frames(frames, RECOLOR[name])
        order = FRAME_ORDER.get((name, prefix))
        if order:
            frames = [frames[i - 1] if i > 0 else mirror_legs(frames[-i - 1], *MIRROR_AT.get(name, ())) for i in order]
        for i, im in enumerate(frames):
            dst = os.path.join(OUT, folder, prefix + str(i + 1) + '.png')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst)
        print(folder, prefix, len(frames), 'frames', frames[0].size, 'feet', list(feet))
        contact(frames, os.path.join(SRC, name + '-' + prefix.replace('/', '-') + '-preview.png'))

def despill(im):
    """Take the magenta tint out of a cut-out: where red and blue both beat green, pull them down to it."""
    import numpy as np
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    over = np.clip(np.minimum(r, b) - g, 0, None) * 0.85
    a[..., 0] -= over; a[..., 2] -= over
    return Image.fromarray(a.clip(0, 255).astype('uint8'))

def centre_foot(im):
    """Pad a cut-out on one side so the middle of its lowest tenth sits in the middle of the image."""
    import numpy as np
    a = np.asarray(im)[..., 3] > 0
    xs = np.where(a[int(a.shape[0] * 0.9):].any(axis=0))[0]
    shift = int(round((xs.min() + xs.max()) / 2 - im.width / 2)) * 2
    w = im.width + abs(shift)
    pad = Image.new('RGBA', (w, im.height)); pad.paste(im, (0 if shift > 0 else -shift, 0))
    return pad

def base_width(im):
    """Width of the lowest tenth of a cut-out's opaque pixels: its footing, which glow doesn't change."""
    import numpy as np
    a = np.asarray(im)[..., 3] > 0
    rows = a[int(a.shape[0] * 0.9):]
    xs = np.where(rows.any(axis=0))[0]
    return xs.max() - xs.min() + 1

if not only or 'props' in only or any(os.path.dirname(sh) in only for sh in PROP_GRIDS):
    cells, keys = {}, {}
    for sheet, (cols, rows, names) in PROP_GRIDS.items():
        p = os.path.join(SRC, sheet)
        if not os.path.exists(p) or (only and 'props' not in only and os.path.dirname(sheet) not in only): continue
        key = PROP_KEY.get(os.path.dirname(sheet), (255, 0, 255))
        for n, cell in zip(names, split_grid(Image.open(p), cols, rows, key=key, tol=PROP_TOL.get(names[0], 120))):
            if n: cells[n], keys[n] = cell, key
    k = {}
    for n, cell in cells.items():
        if n in PROP_HEIGHT: k[n] = PROP_HEIGHT[n] / (cut_keyed(cell, 1, key=keys[n], fringe=1, tol=PROP_TOL.get(n, 120), tint=n not in PROP_TOL).height - 2)
        if n in PROP_WIDTH: k[n] = PROP_WIDTH[n] / (cut_keyed(cell, 1, key=keys[n], fringe=1).width - 2)
    for n, ref in PROP_SAME.items():
        if n in cells and ref in k: k[n] = k[ref]
    for n, twin in PROP_TWIN.items():
        if n in cells and twin in k:
            k[n] = k[twin] * base_width(cut_keyed(cells[twin], 1, fringe=1)) / base_width(cut_keyed(cells[n], 1, fringe=1))
    done = []
    for n, cell in cells.items():
        im = cut_keyed(cell, k[n], key=keys[n], fringe=1, tol=PROP_TOL.get(n, 120), tint=n not in PROP_TOL)
        if n in PROP_DESPILL: im = despill(im)
        if n in PROP_FOOT_CENTRE: im = centre_foot(im)
        # even sizes, so the art-pixel size (half) is whole; the padding goes on the top and the left
        w, h = im.width + im.width % 2, im.height + im.height % 2
        if (w, h) != im.size:
            pad = Image.new('RGBA', (w, h)); pad.paste(im, (w - im.width, h - im.height)); im = pad
        dst = os.path.join(OUT, PROP_OUT, n + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        done.append(im)
        print(dst, im.size)
    if done: contact(done, os.path.join(SRC, 'plants-preview.png'))

# The finale (src/finale.js): the Sunken King's body (2x2, cut flat at the waterline), his right hand (2x2) and the
# Drowned Gate (3x1). The sheets aren't evenly spaced, so each cell has its own box in the returned image. FINALE_K
# is each sheet's shrink; the King's body is drawn at twice its file size in the game (DKG.scale in finale.js).
FINALE_CELLS = {
    'finale/king-body.png': [('fnKingStill', (0, 0, 772, 485)), ('fnKingOpen', (772, 0, 1536, 485)),
                             ('fnKingRoar', (0, 488, 772, 1024)), ('fnKingDying', (772, 488, 1536, 1024))],
    'finale/king-hands.png': [('fnHandRest', (0, 0, 765, 514)), ('fnHandRaised', (765, 0, 1536, 514)),
                              ('fnHandSlam', (0, 514, 765, 1024)), ('fnHandSweep', (765, 514, 1536, 1024))],
    'finale/drowned-gate.png': [('fnGate1', (0, 0, 724, 724)), ('fnGate2', (724, 0, 1448, 724)), ('fnGate3', (1448, 0, 2172, 724))],
    # the causeway's low wall (running away from the viewer) and its fire-bowl post; the broken piece faces the viewer
    # and isn't used (causeway-walls-iso.png is an isometric try, unused too)
    'finale/causeway-walls.png': [('fnWall', (0, 0, 500, 887)), ('fnPost', (1340, 0, 1774, 887))],
    # ruins standing in the black lake, two sets: an arch, a broken arch with its fallen stones, a tall pillar, a stump
    'finale/lake-ruins.png': [('fnRuinA1', (0, 0, 720, 724)), ('fnRuinA2', (720, 0, 1394, 724)), ('fnRuinA3', (1394, 0, 1726, 724)), ('fnRuinA4', (1726, 0, 2172, 724))],
    # the Fire Bearer (3x2): front, back, side (facing right), planted for the night, hurling its flame (right), guttered out.
    # A third item lists boxes (inside the cell) to blank first: the hurled flame reaches over the next cell.
    'finale/fire-bearer.png': [('fbFront', (0, 0, 437, 582)), ('fbBack', (437, 0, 875, 582)), ('fbSide', (875, 0, 1312, 582)),
                               ('fbCamp', (0, 582, 437, 1199)), ('fbHurl', (437, 582, 1060, 1199), [(450, 300, 623, 617)]),
                               ('fbDown', (875, 760, 1312, 1199), [(0, 0, 200, 90)])],
    'finale/lake-ruins-2.png': [('fnRuinB1', (0, 0, 720, 724)), ('fnRuinB2', (720, 0, 1382, 724)), ('fnRuinB3', (1382, 0, 1704, 724)), ('fnRuinB4', (1704, 0, 2172, 724))],
}
FINALE_COLORS = {'finale/drowned-gate.png': 160, 'finale/causeway-walls.png': 96, 'finale/lake-ruins.png': 96, 'finale/lake-ruins-2.png': 96, 'finale/fire-bearer.png': 96}  # its small red and green hollows and the flames need the room
FINALE_K = {'finale/king-body.png': 0.6, 'finale/king-hands.png': 0.48, 'finale/drowned-gate.png': 0.51, 'finale/causeway-walls.png': 0.17, 'finale/lake-ruins.png': 0.33, 'finale/lake-ruins-2.png': 0.33, 'finale/fire-bearer.png': 0.32}

if not only or 'finale' in only:
    done = []
    for sheet, cells in FINALE_CELLS.items():
        p = os.path.join(SRC, sheet)
        if not os.path.exists(p): continue
        img = Image.open(p).convert('RGB')
        for n, box, *blank in cells:
            cell = img.crop(box)
            for b in (blank[0] if blank else []): cell.paste((255, 0, 255), b)
            im = cut_keyed(cell, FINALE_K[sheet], fringe=1, colors=FINALE_COLORS.get(sheet, 64))
            w, h = im.width + im.width % 2, im.height + im.height % 2
            if (w, h) != im.size:
                pad = Image.new('RGBA', (w, h)); pad.paste(im, (w - im.width, h - im.height)); im = pad
            dst = os.path.join(OUT, PROP_OUT, n + '.png')
            im.save(dst)
            done.append(im)
            print(dst, im.size)
    if done: contact(done, os.path.join(SRC, 'finale-preview.png'), scale=1)

# Ground textures: a square render per terrain, shrunk so one texel is one ground texel (2 world px) and made to
# repeat: the last BLEND texels of each edge are cross-faded into the first ones, then cut off, so the right edge
# runs on into the left and the bottom into the top. `World` in src/world.js samples them.
GROUND = {'camp-earth': 'campEarth', 'camp-flagstones': 'campFlags', 'camp-paving': 'campPaving', 'grass': 'grass', 'dirt': 'dirt',
          'shore': 'shore', 'shallow': 'shallow', 'deep': 'deep', 'boardwalk': 'boardwalk',
          '../cave/cave-floor': 'caveFloor'}  # the floor of Derek's Hollow
GROUND_SIZE, GROUND_BLEND = 200, 8

def seamless(a, k):
    """Wrap an image array on itself: fade its last k rows/columns into its first k, then drop them."""
    import numpy as np
    for axis in (1, 0):
        a = np.moveaxis(a, axis, 0)
        n = a.shape[0] - k
        t = (np.arange(k) / k).reshape((k,) + (1,) * (a.ndim - 1))
        head = a[n:] * (1 - t) + a[:k] * t
        a = np.moveaxis(np.concatenate([head, a[k:n]]), 0, axis)
    return a

if not only or 'ground' in only:
    import numpy as np
    for src, name in GROUND.items():
        p = os.path.join(SRC, 'ground', src + '.png')
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGB').resize((GROUND_SIZE, GROUND_SIZE), Image.BOX)
        out = Image.fromarray(seamless(np.asarray(im).astype(float), GROUND_BLEND).round().astype('uint8'))
        dst = os.path.join(OUT, 'ground', name + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst)
        print(dst, out.size)

# The Frostweaver (kit 04, src/kits.js): one concept picture and one sheet of his ice owl, both on magenta.
# His own poses are a SETS entry ('ice-mage'); here are the owl and his ice.
# The owl sheet isn't on a grid and its cells overlap, so each piece is a box on it, keeping only the shapes whose
# middle is inside the box. Items: (prop name, box, shrink). The owl is cut about 52 px tall standing, half the mage.
ICE_SRC = 'ice-mage/owl-sheet.png'
ICE_K = 0.13
ICE_CELLS = [
    ('owlFront', (10, 20, 310, 432), ICE_K), ('owlBack', (355, 10, 592, 444), ICE_K), ('owlSide', (558, 22, 958, 428), ICE_K),
    ('owlRise', (974, 10, 1526, 444), ICE_K),
    # the flight, wings from high to low (facing right)
    ('owlFly1', (6, 444, 316, 682), ICE_K), ('owlFly2', (316, 444, 644, 682), ICE_K), ('owlFly3', (638, 486, 966, 676), ICE_K),
    ('owlFly4', (944, 482, 1268, 654), ICE_K), ('owlFly5', (1228, 496, 1536, 660), ICE_K),
    # casting: wings spread over a burst of ice
    ('owlCast', (6, 686, 386, 1006), ICE_K),
    # its shard (the owl's shot), the staff's frost bolt and its bigger, trailing one, and a gem (the Ice Bomb in flight)
    ('iceShard', (440, 798, 610, 866), 0.12), ('iceBolt', (636, 764, 858, 870), 0.15), ('iceBoltBig', (880, 764, 1242, 914), 0.15),
    ('iceGem', (362, 774, 444, 894), 0.2),
    # two crystals from the ring round the owl: the Ice Bomb's burst raises a ring of them
    ('iceSpike1', (1466, 752, 1508, 868), 0.5), ('iceSpike2', (1344, 683, 1388, 772), 0.5),
]

def ice_pieces(img, box, key=(255, 0, 255)):
    """The part of a sheet inside `box`, with every shape whose middle lies outside it keyed out."""
    import numpy as np
    from scipy import ndimage
    a = np.asarray(img).astype(int)
    fg = np.sqrt(((a - np.array(key)) ** 2).sum(-1)) > 120
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=4))
    x0, y0, x1, y1 = box
    keep = np.zeros(n + 1, bool)
    for i, s in enumerate(ndimage.find_objects(lab)):
        cy, cx = (s[0].start + s[0].stop) / 2, (s[1].start + s[1].stop) / 2
        keep[i + 1] = x0 <= cx < x1 and y0 <= cy < y1
    out = a.copy()
    out[~keep[lab]] = key
    return Image.fromarray(out[y0:y1, x0:x1].astype('uint8'))

if not only or 'ice-mage' in only:
    done = []
    p = os.path.join(SRC, ICE_SRC)
    if os.path.exists(p):
        img = Image.open(p).convert('RGB')
        for n, box, kk in ICE_CELLS:
            cell = ice_pieces(img, box) if not n.startswith('iceSpike') else img.crop(box)
            im = cut_keyed(cell, kk, fringe=1, colors=48)
            w, h = im.width + im.width % 2, im.height + im.height % 2
            if (w, h) != im.size:
                pad = Image.new('RGBA', (w, h)); pad.paste(im, (w - im.width, h - im.height)); im = pad
            dst = os.path.join(OUT, PROP_OUT, n + '.png')
            im.save(dst)
            done.append(im)
            print(dst, im.size)
    if done: contact(done, os.path.join(SRC, 'ice-owl-preview.png'))
