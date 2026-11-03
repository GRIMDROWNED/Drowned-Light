"""Cut Robert's refuge pictures (flat magenta) into the Refuge's pieces (src/refuge.js).
Usage: python3 tools/cut_refuge.py [folder]   (default /mnt/project-files/refuge/returned)

- L1-foundation.png: the hearth's stone base, cut whole.
- L2-plaza.png: the bordered plaza, cut whole (the plaza round the hearth, and each building's plot).
- L3-walls.png: the low walls, cut into corners, tiling wall runs and the posts at the openings.
- L4-terrace.png: the raised terrace, cut into corners, tiling wall runs, its four stairs and its floor.
Kit pieces keep their crop boxes exactly (BOXES, mirrored in KIT in src/refuge.js) at K file px per source px,
so the game can line them up from the source coordinates. 2 file px = 1 world px."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import key_mask, shrink

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/refuge/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'refuge')
K = 0.6  # file px per source px (0.3 world px)
BOXES = {
    'L4-terrace': {
        'nw': (305, 100, 455, 265), 'ne': (1080, 100, 1230, 265), 'sw': (300, 670, 455, 908), 'se': (1080, 670, 1235, 908),
        'n': (455, 118, 625, 232), 's': (455, 730, 625, 908), 'w': (298, 262, 422, 338), 'e': (1108, 262, 1232, 338),
        'stN': (625, 95, 910, 282), 'stS': (622, 712, 912, 936), 'stW': (236, 330, 442, 628), 'stE': (1094, 330, 1302, 628),
        'floor': (470, 280, 1080, 690),
    },
    'L3-walls': {
        'nw': (158, 335, 268, 458), 'ne': (990, 335, 1098, 458), 'sw': (158, 805, 268, 966), 'se': (990, 805, 1098, 966),
        'n': (268, 358, 490, 455), 's': (268, 832, 475, 962), 'w': (170, 458, 257, 528), 'e': (998, 458, 1087, 528),
    },
}
WHOLE = {'L1-foundation': 0.5, 'L2-plaza': 0.6}  # file px per source px

os.makedirs(OUT, exist_ok=True)
def keyed(name):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGB')).astype(int)
    fg = key_mask(a, tol=120, fringe=1)
    rgba = np.zeros(a.shape[:2] + (4,), 'uint8')
    rgba[..., :3] = a * fg[..., None]; rgba[..., 3] = fg * 255
    return rgba
for name, k in WHOLE.items():
    rgba = keyed(name)
    ys, xs = np.where(rgba[..., 3] > 0)
    im = shrink(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], k, colors=48)
    im.save(os.path.join(OUT, name.split('-')[1] + '.png')); print(name, im.size)
for name, boxes in BOXES.items():
    rgba = keyed(name)
    pre = 'terrace' if name.startswith('L4') else 'low'
    for piece, (x0, y0, x1, y1) in boxes.items():
        crop = rgba[y0:y1, x0:x1]
        w, h = round((x1 - x0) * K), round((y1 - y0) * K)
        im = Image.fromarray(crop).convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
        a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
        Image.fromarray(a).save(os.path.join(OUT, f'{pre}-{piece}.png'))
    print(name, len(boxes), 'pieces')
