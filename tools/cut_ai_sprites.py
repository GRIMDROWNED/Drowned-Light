"""Cut AI-rendered sprites (one character per image on a flat magenta background) into game sprites.
Usage: python3 tools/cut_ai_sprites.py <folder of returned images> [character ...]
Every image of a character is shrunk by the same factor, set so the reference pose is TARGET px tall,
so poses keep their relative size."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cut_keyed, cut_sheet, contact, match_colors, mirror_legs, recolor_frames, split_grid

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
    'relic-bearer/poses-a.png': (3, 2, POSES_A),
    'relic-bearer/poses-b.png': (3, 2, POSES_B),
    'flame-bastion/poses-a.png': (3, 2, POSES_A),
    'flame-bastion/poses-b.png': (3, 2, POSES_B),
    'bone-hound/poses-a.png': (3, 2, POSES_A),
    'bone-hound/poses-b.png': (3, 2, POSES_B),
    'derek/poses-a.png': (3, 2, POSES_A),
    'derek/poses-b.png': (3, 2, POSES_B),
    'kindle/poses-a.png': (3, 2, POSES_A),
    'kindle/poses-b.png': (3, 2, POSES_B),
    'abigail/poses-a.png': (3, 2, POSES_A),
    'abigail/poses-b.png': (3, 2, POSES_B),
    'starved-bell/poses-a.png': (3, 2, POSES_A),
    'starved-bell/poses-b.png': (3, 2, POSES_B),
    # the Colossus's sheets: three side crawl frames, then a front stomp (fists up, fists down) and its collapse
    'colossus/poses-a.png': (3, 2, ['01_front', '02_back', '03_right', '08_attackA', '09_attackB', '11_hurt']),
    'colossus/poses-b.png': (3, 2, ['04_walk', '05_walk', '06_walk', '13_stompUp', '14_stompDown', '12_death']),
}
# Cells the AI drew at another scale than the rest of their sheet: cell -> factor to resize it by.
CELL_SCALE = {'pike-warden/07_walk': 1.16, 'relic-bearer/07_walk': 1.05,
              # the hound's attack row came out smaller than its standing row
              'bone-hound/08_attackA': 1.25, 'bone-hound/09_attackB': 1.25, 'bone-hound/10_attackC': 1.25}

# Cells redrawn on their own after a sheet came back: cell -> (redrawn image, cell whose figure height it takes).
# The redraw is shrunk to that height before it is cut, so it matches the rest of its sheet.
CELL_REDRAW = {'starved-bell/07_walk': ('bell-walk4.png', '04_walk'), 'starved-bell/08_attackA': ('bell-rear.png', '03_right')}

HOUND_H = 60
DEREK_H = 60  # cut at 4 file px per art pixel (res: 4): drawn 30 px tall, about 3/8 of the knight
DEREK_SIDE_H = 62
ABIGAIL_H = 112  # cut at res 4: drawn 28 px tall, hem to hood, about two thirds of the knight
KINDLE_H = 64
BELL_H = 224  # the Starved Bell boss, cut at res 4: drawn 56 art px tall (x1.25 in game), almost twice the knight  # cut at res 4 like Derek: drawn 32 px tall, ring included, about 40% of the knight
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
    'ashen-arbalist': ('ashen-arbalist', 'ashen-arbalist/01_front.png', 83, 1, twelve('ashen-arbalist', TWELVE_FILES)),
    'relic-bearer': ('relic-bearer', 'relic-bearer/01_front.png', 98, 1, twelve('relic-bearer', TWELVE_FILES)),
    # the heaviest kit (bulk 1 in src/units.js), a little bigger than the Lantern Knight
    'flame-bastion': ('flame-bastion', 'flame-bastion/01_front.png', 84, 1, twelve('flame-bastion', TWELVE_FILES)),
    # the Bone Hound summon: a dog, so shorter than a knight (its spines and raised tail make up the height)
    'bone-hound': ('bone-hound', 'bone-hound/01_front.png', HOUND_H, 1, twelve('bone-hound', TWELVE_FILES)),
    # Derek the golem familiar: his sheets put a front-facing cast (fists up, slam, rise) where the 12-pose
    # prompt has its attacks, and a side cast where it has hurt and death. Floating rocks count in his height.
    'derek': ('derek', 'derek/01_front.png', DEREK_H, 1, {
        'derek/01_front.png': 'front', 'derek/02_back.png': 'back', 'derek/03_right.png': 'right',
        'derek/04_walk.png': 'side/walk1', 'derek/05_walk.png': 'side/walk2', 'derek/06_walk.png': 'side/walk3', 'derek/07_walk.png': 'side/walk4',
        'derek/08_attackA.png': 'attackA', 'derek/09_attackB.png': 'attackB', 'derek/10_attackC.png': 'attackC',
        'derek/11_hurt.png': 'side/castUp', 'derek/12_death.png': 'side/castSlam'}),
    # Kindle the walking lantern: his sheets put the broken lantern (lying on its side), a pour (refilling a
    # lantern) and a point (leading the way) where the 12-pose prompt has its attacks, and a crouch and a hop
    # where it has hurt and death.
    # Abigail floats: her 'walk' is a drift; attackA/B raise and throw, 'hurt' recoils, then her blessing and her fading
    'abigail': ('abigail', 'abigail/01_front.png', ABIGAIL_H, 1, {
        'abigail/01_front.png': 'front', 'abigail/02_back.png': 'back', 'abigail/03_right.png': 'right',
        'abigail/04_walk.png': 'side/walk1', 'abigail/05_walk.png': 'side/walk2', 'abigail/06_walk.png': 'side/walk3', 'abigail/07_walk.png': 'side/walk4',
        'abigail/08_attackA.png': 'side/castUp', 'abigail/09_attackB.png': 'side/throw', 'abigail/10_attackC.png': 'side/hurt',
        'abigail/11_hurt.png': 'bless', 'abigail/12_death.png': 'side/fade'}),
    'kindle': ('kindle', 'kindle/01_front.png', KINDLE_H, 1, {
        'kindle/01_front.png': 'front', 'kindle/02_back.png': 'back', 'kindle/03_right.png': 'right',
        'kindle/04_walk.png': 'side/walk1', 'kindle/05_walk.png': 'side/walk2', 'kindle/06_walk.png': 'side/walk3', 'kindle/07_walk.png': 'side/walk4',
        'kindle/08_attackA.png': 'broken', 'kindle/09_attackB.png': 'pour', 'kindle/10_attackC.png': 'side/point',
        'kindle/11_hurt.png': 'side/crouch', 'kindle/12_death.png': 'side/hop'}),
    'starved-bell': ('starved-bell', 'starved-bell/01_front.png', BELL_H, 1, twelve('starved-bell', TWELVE_FILES)),
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
    'ashen-arbalist': [
        ('ashen-arbalist/walk-side-4.png', 4, 1, 79, 'side/walk'),
        ('ashen-arbalist/walk-front-4.png', 4, 1, 83, 'walkF'),
        ('ashen-arbalist/walk-back-4.png', 4, 1, 83, 'walkB'),
    ],
    'relic-bearer': [
        ('relic-bearer/walk-side-4.png', 4, 1, 103, 'side/walk'),
        ('relic-bearer/walk-front-4.png', 4, 1, 99, 'walkF'),
        ('relic-bearer/walk-back-4.png', 4, 1, 99, 'walkB'),
    ],
    'flame-bastion': [
        ('flame-bastion/walk-side-4.png', 4, 1, 82, 'side/walk'),
        ('flame-bastion/walk-front-4.png', 4, 1, 84, 'walkF'),
        ('flame-bastion/walk-back-4.png', 4, 1, 84, 'walkB'),
    ],
    # the side gallop's first frame is stretched out low, so it is much shorter than the standing pose
    'bone-hound': [
        ('bone-hound/walk-side-4.png', 4, 1, 40, 'side/walk'),
        ('bone-hound/walk-front-4.png', 4, 1, 62, 'walkF'),
        ('bone-hound/walk-back-4.png', 4, 1, 64, 'walkB'),
    ],
    'derek': [
        ('derek/walk-side-4.png', 4, 1, DEREK_SIDE_H, 'side/walk'),
        ('derek/walk-front-4.png', 4, 1, DEREK_H, 'walkF'),
        ('derek/walk-back-4.png', 4, 1, DEREK_H, 'walkB'),
    ],
    'abigail': [
        ('abigail/walk-side-4.png', 4, 1, ABIGAIL_H, 'side/walk'),
        ('abigail/walk-front-4.png', 4, 1, ABIGAIL_H, 'walkF'),
        ('abigail/walk-back-4.png', 4, 1, ABIGAIL_H, 'walkB'),
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
               ('pike-warden', 'walkF'): [1, 3, -1, 3],
               # frames 2 and 4 both lift the same foot
               ('relic-bearer', 'walkF'): [1, 2, 3, -2], ('flame-bastion', 'walkB'): [1, 2, 3, -2]}

# Where to mirror legs when the feet can't be found from the bottom rows (one foot lifted, a staff butt
# beside them): character -> (legs share, half width, centre x) for mirror_legs.
MIRROR_AT = {'relic-bearer': (0.32, 10, 39), 'flame-bastion': (0.32, 10, 36)}

# Walk sheets rendered in other colours than the character's first batch: recolour to this image.
SHEET_MATCH = {'tide-archer': 'tide-archer/01_front.png'}

# World props (plants for now): sheet -> (columns, rows, a sprite name per cell in reading order, None to skip).
# They're cut at res 2 like the units; PROPS in src/sprites.js lists the files.
PROP_GRIDS = {
    'plants/plants-lit.png': (5, 2, ['refugeOn', 'sentinelOn', 'rootOn', 'sproutOn', 'husk', None, None, None, 'gardenOn', None]),
    'plants/plants-unlit.png': (3, 2, ['refugeOff', 'sentinelOff', 'rootOff', 'sproutOff', 'sproutBare', 'gardenOff']),
    'plants/reeds.png': (3, 2, ['reeds1', 'reeds2', 'reeds3', 'reeds4', 'reeds5', 'reeds6']),
    'plants/garden-beds.png': (3, 1, ['gardenBed1', 'gardenBed2', 'gardenBed3']),
    'world/trees.png': (3, 1, ['swampTree1', 'swampTree2', 'swampTree3']),
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
    'world/boulders.png': (6, 2, ['boulder11', 'boulder12', 'boulder13', 'boulder21', 'boulder22', 'boulder23', 'boulder31', 'boulder32', 'boulder33', 'boulder41', 'boulder42', 'boulder43']),
}
# Height in file px of each unlit plant (twice the art px); the lit one is scaled to match its unlit twin by the
# width of their rocky base, since glow wisps change its height. Names not listed here use their own height.
PROP_HEIGHT = {'refugeOff': 116, 'sentinelOff': 96, 'rootOff': 150, 'sproutOff': 60, 'gardenOff': 14, 'husk': 104, 'reeds2': 50, 'gardenBed2': 100, 'swampTree2': 140, 'boulder11': 60,
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
PROP_SAME = {'caveSealed': 'caveOpen', 'swampTree1': 'swampTree2', 'swampTree3': 'swampTree2', 'gardenBed1': 'gardenBed2', 'gardenBed3': 'gardenBed2', 'reeds1': 'reeds2', 'reeds3': 'reeds2', 'reeds4': 'reeds2', 'reeds5': 'reeds2', 'reeds6': 'reeds2',
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
PROP_TWIN = {'refugeOn': 'refugeOff', 'sentinelOn': 'sentinelOff', 'rootOn': 'rootOff', 'sproutOn': 'sproutOff',
             'gardenOn': 'gardenOff', 'sproutBare': 'sproutOff'}
PROP_OUT = 'props'
# Renders where the magenta background tinted the art pink (the trees' moss): pull it back out (see despill).
PROP_DESPILL = {'swampTree1', 'swampTree2', 'swampTree3'}

only = sys.argv[2:]  # optional character names to cut
for sheet, (cols, rows, names) in GRIDS.items():
    p = os.path.join(SRC, sheet)
    if not os.path.exists(p): continue
    for n, cell in zip(names, split_grid(Image.open(p), cols, rows)):
        f = CELL_SCALE.get(os.path.dirname(sheet) + '/' + n)
        if f: cell = cell.resize((round(cell.width * f), round(cell.height * f)), Image.NEAREST)
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
        strip = Image.new('RGB', (cw * len(cells), ch), (255, 0, 255))
        for i, c in enumerate(cells):
            strip.paste(c, (i * cw + (cw - c.width) // 2, ch - c.height))
        strip.save(os.path.join(os.path.dirname(p), 'walk-side-4.png'))
for name, (folder, ref, target, fringe, files) in SETS.items():
    if only and name not in only: continue
    k = target / (cut_keyed(Image.open(os.path.join(SRC, ref)), 1, fringe=fringe).height - 2)
    done = []
    for src, out in files.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p): continue
        out, opt = out if isinstance(out, tuple) else (out, {})
        img, fr = Image.open(p), opt.get('fringe', fringe)
        kk = opt['height'] / (cut_keyed(img, 1, fringe=fr).height - 2) if 'height' in opt else k
        rc = match_colors(Image.open(os.path.join(SRC, opt['match']))) if 'match' in opt else None
        im = cut_keyed(img, kk, fringe=fr, colors=64 if rc else 32, recolor=rc)
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
        img = Image.open(p)
        if row:
            h = img.height // rows
            img, rows = img.crop((0, row[0] * h, img.width, (row[0] + 1) * h)), 1
        frames, feet = cut_sheet(img, cols, rows, height)
        if name in SHEET_MATCH:
            frames = recolor_frames(frames, match_colors(Image.open(os.path.join(SRC, SHEET_MATCH[name]))))
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

if not only or 'props' in only:
    cells = {}
    for sheet, (cols, rows, names) in PROP_GRIDS.items():
        p = os.path.join(SRC, sheet)
        if not os.path.exists(p): continue
        for n, cell in zip(names, split_grid(Image.open(p), cols, rows, tol=PROP_TOL.get(names[0], 120))):
            if n: cells[n] = cell
    k = {}
    for n, cell in cells.items():
        if n in PROP_HEIGHT: k[n] = PROP_HEIGHT[n] / (cut_keyed(cell, 1, fringe=1, tol=PROP_TOL.get(n, 120), tint=n not in PROP_TOL).height - 2)
        if n in PROP_WIDTH: k[n] = PROP_WIDTH[n] / (cut_keyed(cell, 1, fringe=1).width - 2)
    for n, ref in PROP_SAME.items():
        if n in cells and ref in k: k[n] = k[ref]
    for n, twin in PROP_TWIN.items():
        if n in cells and twin in k:
            k[n] = k[twin] * base_width(cut_keyed(cells[twin], 1, fringe=1)) / base_width(cut_keyed(cells[n], 1, fringe=1))
    done = []
    for n, cell in cells.items():
        im = cut_keyed(cell, k[n], fringe=1, tol=PROP_TOL.get(n, 120), tint=n not in PROP_TOL)
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
