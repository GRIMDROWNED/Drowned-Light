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

# Lantern Knight front and back (Kit 01 sheet, top-down gameplay view)
kit = Image.open(os.path.join(SRC, 'kit01-lantern-knight-sheet.png'))
for name, box in {'front': (520, 385, 655, 555), 'back': (655, 385, 795, 555), 'walk34': (795, 385, 935, 555), 'lunge34': (935, 385, 1095, 555)}.items():
    save(cut(kit, box, 37, thr=40, cool=3, peel=10, nearest=True), 'lantern-knight/' + ('down/' if name != 'back' else 'up/') + name)

# Drowned Knights: each column has a 2x2 block of top-down sprites
en = Image.open(os.path.join(SRC, 'drowned-knights-enemy-sheet.png'))
cols = {'squire': (5, 187, 34), 'footman': (192, 375, 36), 'archer': (380, 558, 36), 'revenant': (562, 735, 28), 'blackguard': (916, 1094, 38)}
for k, (x0, x1, h) in cols.items():
    xm = (x0 + x1) // 2
    for j, (ya, yb) in enumerate([(608, 693), (693, 788)]):
        for i, (xa, xb) in enumerate([(x0, xm), (xm, x1)]):
            if k == 'revenant' and (j, i) == (0, 1): continue  # a cluster of small ones
            save(cut(en, (xa, ya, xb, yb), h, keep_frac=0.25), f'drowned/{k}/{j}{i}')
for j, (ya, yb) in enumerate([(608, 693), (693, 788)]):
    save(cut(en, (740, ya, 912, yb), 38), f'drowned/defiler/{j}')
save(cut(en, (1100, 605, 1310, 790), 40), 'drowned/champion/0')

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

# Camp (Base Camp sheet, key structures row)
cp = Image.open(os.path.join(SRC, 'base-camp-sheet.png'))
C = dict(thr=40, cool=2, sat_keep=60)
save(cut(cp, (295, 945, 425, 1053), 38, **C), 'camp/rack')
save(cut(cp, (440, 945, 566, 1053), 38, **C), 'camp/workbench')
save(cut(cp, (572, 945, 700, 1053), 36, **C), 'camp/garden')
