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
}
# Cells the AI drew at another scale than the rest of their sheet: cell -> factor to resize it by.
CELL_SCALE = {'pike-warden/07_walk': 1.16, 'relic-bearer/07_walk': 1.05}

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
    # cropped from a phone screenshot (JPEG), so the key colour is noisy
    'world/trees.png': (3, 1, ['swampTree1', 'swampTree2', 'swampTree3']),
}
# Height in file px of each unlit plant (twice the art px); the lit one is scaled to match its unlit twin by the
# width of their rocky base, since glow wisps change its height. Names not listed here use their own height.
PROP_HEIGHT = {'refugeOff': 116, 'sentinelOff': 96, 'rootOff': 150, 'sproutOff': 60, 'gardenOff': 14, 'husk': 104, 'reeds2': 50, 'gardenBed2': 100, 'swampTree2': 140}
# Variants drawn on one sheet at one scale: name -> the variant whose scale it shares.
PROP_SAME = {'swampTree1': 'swampTree2', 'swampTree3': 'swampTree2', 'gardenBed1': 'gardenBed2', 'gardenBed3': 'gardenBed2', 'reeds1': 'reeds2', 'reeds3': 'reeds2', 'reeds4': 'reeds2', 'reeds5': 'reeds2', 'reeds6': 'reeds2'}
PROP_TWIN = {'refugeOn': 'refugeOff', 'sentinelOn': 'sentinelOff', 'rootOn': 'rootOff', 'sproutOn': 'sproutOff',
             'gardenOn': 'gardenOff', 'sproutBare': 'sproutOff'}
PROP_OUT = 'props'
# Cut from a JPEG, so magenta bled into the edges: pull the pink back out (see despill).
PROP_DESPILL = {'swampTree1', 'swampTree2', 'swampTree3'}

only = sys.argv[2:]  # optional character names to cut
for sheet, (cols, rows, names) in GRIDS.items():
    p = os.path.join(SRC, sheet)
    if not os.path.exists(p): continue
    for n, cell in zip(names, split_grid(Image.open(p), cols, rows)):
        f = CELL_SCALE.get(os.path.dirname(sheet) + '/' + n)
        if f: cell = cell.resize((round(cell.width * f), round(cell.height * f)), Image.NEAREST)
        cell.save(os.path.join(os.path.dirname(p), n + '.png'))
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
        for n, cell in zip(names, split_grid(Image.open(p), cols, rows)):
            if n: cells[n] = cell
    k = {}
    for n, cell in cells.items():
        if n in PROP_HEIGHT: k[n] = PROP_HEIGHT[n] / (cut_keyed(cell, 1, fringe=1).height - 2)
    for n, ref in PROP_SAME.items():
        if n in cells and ref in k: k[n] = k[ref]
    for n, twin in PROP_TWIN.items():
        if n in cells and twin in k:
            k[n] = k[twin] * base_width(cut_keyed(cells[twin], 1, fringe=1)) / base_width(cut_keyed(cells[n], 1, fringe=1))
    done = []
    for n, cell in cells.items():
        im = cut_keyed(cell, k[n], fringe=1)
        if n in PROP_DESPILL: im = despill(im)
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
