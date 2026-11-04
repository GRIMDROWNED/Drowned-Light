"""Cut Robert's refuge pictures (flat magenta) into the Refuge's pieces (src/refuge.js).
Usage: python3 tools/cut_refuge.py [folder]   (default /mnt/project-files/refuge/returned)

- L1-foundation.png: the hearth's stone base, cut whole.
- L2-plaza.png: the bordered plaza, cut whole (the plaza round the hearth, and each building's plot).
- L3-walls.png: the low walls, cut into corners, tiling wall runs and the posts at the openings.
- L4-terrace.png: the raised terrace, cut into corners, tiling wall runs, its four stairs and its floor.
- T1-sanctum.png etc. (terrace-fortress-prompts.md): one terrace each, kept in their own colours.
- L7-tall-tier.png (earlier L5-two-tier.png): two kits in one picture, `rim` (the outer wall ring) and `tier` (the tall inner terrace).
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
    # Robert's taller-walled picture (2026-11-04) replaced the first two-tier one (L5-two-tier.png, kept in returned/)
    'L7-tall-tier/rim': { 'nw': (150, 20, 335, 190), 'n': (335, 12, 520, 125), 'stN': (640, 22, 900, 160), 'w': (150, 400, 262, 520), 'stW': (145, 185, 265, 350), 'sw': (145, 790, 330, 1016), 's': (330, 880, 530, 1016), 'stS': (640, 870, 900, 1016), 'ne': (1202, 20, 1387, 190), 'se': (1207, 790, 1392, 1016), 'e': (1275, 400, 1387, 520), 'stE': (1272, 185, 1392, 350) },  # the outer wall ring (outer terrace)
    'L7-tall-tier/tier': { 'nw': (415, 185, 545, 355), 'n': (545, 200, 665, 280), 'stN': (665, 190, 875, 335), 'w': (462, 570, 522, 640), 'stW': (355, 380, 530, 600), 'sw': (415, 590, 560, 805), 's': (560, 650, 665, 805), 'stS': (665, 635, 880, 805), 'ne': (992, 185, 1122, 355), 'se': (977, 590, 1122, 805), 'e': (1015, 570, 1075, 640), 'stE': (1007, 380, 1182, 600) },  # the raised inner terrace (sanctum)
    'T1-sanctum/sanct': { 'nw': (150, 85, 380, 340), 'n': (372, 120, 540, 290), 'stN': (540, 85, 775, 300), 'w': (150, 290, 335, 340), 'stW': (85, 340, 345, 720), 'sw': (120, 680, 375, 1062), 's': (375, 760, 545, 1062), 'stS': (540, 740, 775, 1080), 'ne': (934, 85, 1164, 340), 'se': (939, 680, 1194, 1062), 'e': (979, 290, 1164, 340), 'stE': (969, 340, 1229, 720) },  # T1 (2026-11-04): the flame's platform, kept in its own colours
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
    if not name.startswith('T'): a = to_grey(a, fg.astype(bool))  # the T pictures are drawn in the final colours
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
