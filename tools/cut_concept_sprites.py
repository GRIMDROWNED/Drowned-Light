"""Rough pixel sprites cut from the concept sheets (not part of the game; run by hand).

    python3 tools/cut_concept_sprites.py <folder with the concept sheet PNGs>

Writes PNG frames under assets/sprites/. Crop boxes are in concept-sheet pixels.
The Lantern Knight side frames were cut separately and are not rewritten here."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cut

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

def save(img, rel):
    p = os.path.join(OUT, rel + '.png'); os.makedirs(os.path.dirname(p), exist_ok=True); img.save(p)

def dim(img, k=0.45):
    """An unlit copy: glow colours pulled toward grey and darkened."""
    a = np.asarray(img).astype(float); rgb = a[..., :3]
    l = rgb.mean(-1, keepdims=True)
    rgb = (rgb + (l - rgb) * 0.8) * (1 - k * (rgb.max(-1, keepdims=True) - rgb.min(-1, keepdims=True)) / 255 - 0.15)
    a[..., :3] = np.clip(rgb, 0, 255); return Image.fromarray(a.astype('uint8'))

# Motion sheets: the large 8-direction poses (front, right, back) and three of the six attack frames.
MOTION = {  # concept sheet -> (sprite folder, height in art pixels)
    'lantern-knight': ('lantern-knight', 37), 'drowned-wretch': ('drowned/footman', 36), 'mire-stalker': ('drowned/squire', 34),
    'tide-archer': ('drowned/archer', 36), 'lantern-reaver': ('drowned/defiler', 37), 'bone-bulwark': ('drowned/blackguard', 40),
    'drowned-sovereign': ('drowned/champion', 42),
}
POSE = dict(thr=18, sat_keep=30, nearest=True, close=3, max_hole=500)
ATTACK = dict(thr=26, sat_keep=30, nearest=True, close=3, max_hole=300)
AX = [20, 130, 240, 355, 465, 580, 700]  # attack frame columns
for sheet, (folder, h) in MOTION.items():
    im = Image.open(os.path.join(SRC, 'motion-' + sheet + '.png'))
    y0, y1 = (217, 340) if sheet == 'drowned-sovereign' else (230, 340)
    for name, (xa, xb) in {'front': (482, 592), 'right': (721, 832), 'back': (962, 1074)}.items():
        save(cut(im, (xa, y0, xb, y1), h, **POSE), folder + '/' + name)
    for name, i in (('attackA', 1), ('attackB', 2), ('attackC', 4)):
        save(cut(im, (AX[i] + (14 if i == 4 else 9), 646, AX[i + 1] - 6, 762), h, **ATTACK), folder + '/' + name)

# Swarming Revenant: six single revenants from the idle column, two from the attack row
rev = Image.open(os.path.join(SRC, 'motion-swarming-revenant.png'))
R = dict(thr=18, sat_keep=30, nearest=True, close=3, max_hole=300, keep_frac=0.3)
k = 0
for (y0, y1) in [(258, 330), (336, 408), (418, 500)]:
    for (x0, x1) in [(478, 565), (565, 655)]:
        save(cut(rev, (x0, y0, x1, y1), 26, **R), f'drowned/revenant/r{k}'); k += 1
for name, (x0, x1) in (('attackA', (130, 235)), ('attackB', (235, 340))):
    save(cut(rev, (x0, 640, x1, 760), 26, **dict(R, thr=26)), 'drowned/revenant/' + name)

# Bioluminescent plants
pl = Image.open(os.path.join(SRC, 'bioluminescent-plants-sheet.png'))
P = dict(thr=44, cool=1, sat_keep=60)
save(cut(pl, (25, 578, 215, 705), 56, **P), 'plants/refugeOn')
save(cut(pl, (28, 728, 112, 835), 40, **P), 'plants/refugeOff')
save(cut(pl, (240, 578, 440, 705), 44, **P), 'plants/sentinelOn')
save(cut(pl, (245, 728, 322, 835), 40, **P), 'plants/sentinelOff')
root = cut(pl, (458, 578, 684, 705), 64, **P)
save(root, 'plants/rootOn'); save(dim(root), 'plants/rootOff')
save(cut(pl, (795, 728, 898, 835), 30, **P), 'plants/sproutOn')
sprout = cut(pl, (720, 728, 795, 835), 28, **P)
save(sprout, 'plants/sproutOff'); save(dim(sprout, 0.7), 'plants/sproutBare')
save(cut(pl, (912, 578, 1108, 705), 52, **P), 'plants/husk')

# Structures & Plants sheet: camp structures in their small state cells, and resource nodes
st = Image.open(os.path.join(SRC, 'structures-plants-sheet.png'))
T = dict(thr=38, sat_keep=40, nearest=True, close=2, max_hole=200)
save(cut(st, (251, 540, 287, 582), 22, **T), 'camp/firering')        # campfire, out (the game draws the flame)
save(cut(st, (754, 524, 792, 620), 64, **T), 'camp/tower')           # beacon tower, lit
save(cut(st, (1009, 524, 1047, 620), 34, **T), 'camp/palisade')      # barricade, intact
save(cut(st, (1309, 524, 1347, 620), 56, **T), 'camp/pylon')         # light post, standing
save(cut(st, (26, 902, 98, 1003), 26, **T), 'world/driftwood')
save(cut(st, (258, 904, 332, 1003), 30, **T), 'world/rock')

# Environment sheet: trees, reeds and ruins
env = Image.open(os.path.join(SRC, 'environment-sheet.png'))
E = dict(thr=38, sat_keep=40, nearest=True, close=2, max_hole=150)
save(cut(env, (893, 572, 958, 657), 66, **E), 'world/tree0')
save(cut(env, (800, 574, 890, 655), 62, **E), 'world/tree1')
save(cut(env, (588, 576, 623, 613), 18, **E), 'world/reeds')
save(cut(env, (1028, 563, 1067, 657), 46, **E), 'world/pillar')
save(cut(env, (1170, 568, 1212, 657), 22, **E), 'world/grave')

# Camp (Base Camp sheet, key structures row)
cp = Image.open(os.path.join(SRC, 'base-camp-sheet.png'))
C = dict(thr=40, cool=2, sat_keep=60)
save(cut(cp, (295, 945, 425, 1053), 38, **C), 'camp/rack')
save(cut(cp, (440, 945, 566, 1053), 38, **C), 'camp/workbench')
save(cut(cp, (572, 945, 700, 1053), 36, **C), 'camp/garden')
