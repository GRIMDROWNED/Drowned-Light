"""Cut Robert's refuge pictures (flat magenta) into the Refuge's pieces (src/refuge.js).
Usage: python3 tools/cut_refuge.py [folder]   (default /mnt/project-files/refuge/returned)

- L1-foundation.png: the hearth's stone base, cut whole.
- L2-plaza.png: the bordered plaza, cut whole (the plaza round the hearth, and each building's plot).
- L3-walls.png: the low walls, cut into corners, tiling wall runs and the posts at the openings.
- L4-terrace.png: the raised terrace, cut into corners, tiling wall runs, its four stairs and its floor.
- L5-two-tier.png: two kits in one picture, `rim` (the outer wall ring) and `tier` (the tall inner terrace).
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
    'L5-two-tier/rim': {  # the outer wall ring (outer terrace)
        'nw': (175, 22, 320, 300), 'ne': (1215, 22, 1360, 300), 'sw': (175, 785, 310, 1004), 'se': (1225, 785, 1360, 1004),
        'n': (320, 22, 520, 108), 's': (310, 890, 510, 1004), 'w': (175, 590, 245, 785), 'e': (1290, 590, 1360, 785),
        'stN': (645, 20, 890, 125), 'stS': (645, 890, 890, 1004), 'stW': (175, 360, 270, 570), 'stE': (1265, 360, 1360, 570),
    },
    'L5-two-tier/tier': {  # the raised inner terrace (sanctum)
        'nw': (390, 158, 525, 360), 'ne': (1010, 158, 1145, 360), 'sw': (385, 600, 530, 845), 'se': (1005, 600, 1150, 845),
        'n': (525, 175, 645, 250), 's': (530, 678, 650, 845), 'w': (395, 250, 470, 355), 'e': (1065, 250, 1140, 355),
        'stN': (645, 155, 890, 305), 'stS': (645, 655, 890, 845), 'stW': (325, 370, 510, 610), 'stE': (1025, 370, 1210, 610),
    },
}
WHOLE = {'L1-foundation': 0.5, 'L2-plaza': 0.6}  # file px per source px

os.makedirs(OUT, exist_ok=True)
# Robert chose grey stone everywhere (2026-11-04, from his grey two-tier picture): every picture is recoloured onto
# GREY's colours by luminance rank, so the tan pictures keep their shading but take the grey stone's palette.
GREY = 'L6-two-tier-grey'
def grey_ramp():
    a = np.asarray(Image.open(os.path.join(SRC, GREY + '.png')).convert('RGB')).astype(float)
    m = key_mask(a.astype(int), tol=120, fringe=1).astype(bool)
    px = a[m]; lum = px @ [0.3, 0.59, 0.11]
    order = np.argsort(lum); px = px[order]
    n = 256  # the grey stone's colour at each of 256 luminance ranks
    return np.array([px[int(i * len(px) / n):int((i + 1) * len(px) / n)].mean(0) for i in range(n)])
RAMP = grey_ramp()
def to_grey(a, fg):
    lum = a @ [0.3, 0.59, 0.11]
    vals = lum[fg]; rank = np.empty(len(vals)); rank[np.argsort(vals, kind='stable')] = np.arange(len(vals))
    out = a.copy().astype(float)
    out[fg] = RAMP[np.minimum(255, (rank * 256 / len(vals)).astype(int))]
    return out.round().astype(int)
def keyed(name):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGB')).astype(int)
    fg = key_mask(a, tol=120, fringe=1)
    a = to_grey(a, fg.astype(bool))
    rgba = np.zeros(a.shape[:2] + (4,), 'uint8')
    rgba[..., :3] = a * fg[..., None]; rgba[..., 3] = fg * 255
    return rgba
for name, k in WHOLE.items():
    rgba = keyed(name)
    ys, xs = np.where(rgba[..., 3] > 0)
    im = shrink(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], k, colors=48)
    im.save(os.path.join(OUT, name.split('-')[1] + '.png')); print(name, im.size)
for name, boxes in BOXES.items():
    src, _, pre = name.partition('/')
    rgba = keyed(src)
    pre = pre or ('terrace' if name.startswith('L4') else 'low')
    for piece, (x0, y0, x1, y1) in boxes.items():
        crop = rgba[y0:y1, x0:x1]
        w, h = round((x1 - x0) * K), round((y1 - y0) * K)
        im = Image.fromarray(crop).convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
        a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
        Image.fromarray(a).save(os.path.join(OUT, f'{pre}-{piece}.png'))
    print(name, len(boxes), 'pieces')
