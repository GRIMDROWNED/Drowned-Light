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
    'T2-inner-court/court': { 'nw': (95, 80, 245, 290), 'n': (440, 135, 545, 290), 'stN': (545, 85, 770, 290), 'w': (85, 290, 350, 445), 'stW': (85, 440, 350, 720), 'sw': (80, 760, 250, 1118), 's': (450, 820, 545, 1100), 'stS': (545, 790, 770, 1118), 'ne': (1067, 80, 1217, 290), 'se': (1062, 760, 1232, 1118), 'e': (962, 290, 1227, 445), 'stE': (962, 440, 1227, 720) },  # T2: the Inner Court
    'T4-outer-ward/ward': { 'nw': (40, 10, 215, 300), 'n': (235, 130, 330, 295), 'stN': (530, 75, 723, 305), 'w': (70, 300, 235, 470), 'stW': (78, 470, 205, 650), 'sw': (35, 760, 215, 1182), 's': (215, 900, 325, 1182), 'stS': (525, 830, 728, 1182), 'ne': (1038, 10, 1213, 300), 'se': (1038, 760, 1218, 1182), 'e': (1018, 300, 1183, 470), 'stE': (1048, 470, 1175, 650) },  # T4: the Outer Ward
    'T3-middle-ward/mward': { 'nw': (70, 28, 225, 270), 'n': (225, 60, 315, 230), 'stN': (540, 50, 773, 240), 'w': (85, 650, 225, 760), 'stW': (85, 400, 225, 580), 'sw': (40, 760, 230, 1139), 's': (230, 860, 305, 1130), 'stS': (540, 790, 773, 1139), 'ne': (1088, 28, 1243, 270), 'se': (1083, 760, 1273, 1139), 'e': (1088, 650, 1228, 760), 'stE': (1088, 400, 1228, 580) },  # T3: the Middle Ward
    'T5-low-ward/lward': { 'nw': (28, 10, 205, 270), 'n': (200, 75, 285, 245), 'stN': (505, 35, 750, 250), 'w': (55, 470, 190, 560), 'stW': (55, 290, 190, 470), 'sw': (15, 750, 200, 1223), 's': (200, 860, 280, 1170), 'stS': (505, 800, 750, 1223), 'ne': (1050, 10, 1227, 270), 'se': (1055, 750, 1240, 1223), 'e': (1065, 470, 1200, 560), 'stE': (1065, 290, 1200, 470) },  # T5: the Low Ward
    'T6-curtain/curt': { 'nw': (30, 20, 225, 270), 'n': (222, 105, 258, 265), 'stN': (495, 40, 760, 270), 'w': (55, 590, 200, 660), 'stW': (55, 400, 205, 560), 'sw': (15, 765, 210, 1220), 's': (210, 880, 255, 1215), 'stS': (495, 860, 760, 1225), 'ne': (1029, 20, 1224, 270), 'se': (1044, 765, 1239, 1220), 'e': (1054, 590, 1199, 660), 'stE': (1049, 400, 1199, 560) },  # T6: the Curtain Terrace
    'T7-great-wall/great': { 'nw': (20, 10, 190, 300), 'n': (185, 95, 300, 240), 'stN': (480, 10, 773, 245), 'w': (50, 410, 170, 450), 'stW': (50, 500, 170, 640), 'sw': (10, 840, 180, 1215), 's': (180, 900, 290, 1200), 'stS': (460, 800, 793, 1238), 'ne': (1063, 10, 1233, 300), 'se': (1073, 840, 1243, 1215), 'e': (1083, 410, 1203, 450), 'stE': (1083, 500, 1203, 640) },  # T7: the Great Wall
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
    if name.startswith('L'): a = to_grey(a, fg.astype(bool))  # only the early L pictures; T, S and D are drawn in the final colours
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

# S1 (2026-11-04): the east-west stair strip, one repeat from pillar centre to pillar centre (the avenues tile it)
rgba = keyed('S1-grand-stairs')
x0, x1 = 696, 957
crop = rgba[398:687, x0:x1]
im = Image.fromarray(crop).convert('RGBa').resize((round((x1 - x0) * 0.3), round(289 * 0.3)), Image.BOX).convert('RGBA')
a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
Image.fromarray(a).save(os.path.join(OUT, 'avenue-ew.png')); print('avenue-ew', im.size)

# S2 (2026-11-04): the north-south paved avenue, one repeat from pillar to pillar
rgba = keyed('S2-avenue')
y0, y1 = 228, 433
crop = rgba[y0:y1, 83:326]
im = Image.fromarray(crop).convert('RGBa').resize((round(243 * 0.3), round((y1 - y0) * 0.3)), Image.BOX).convert('RGBA')
a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
Image.fromarray(a).save(os.path.join(OUT, 'avenue-ns.png')); print('avenue-ns', im.size)

# S3 (2026-11-04): three seamless floors (sanctum mosaic, terrace flagstones, ward cobbles), trimmed inside their edges
src = np.asarray(Image.open(os.path.join(SRC, 'S3-floors.png')).convert('RGB'))
for n, (x0, x1) in zip(['floor-sanctum', 'floor-flags', 'floor-cobble'], [(46, 679), (774, 1398), (1497, 2126)]):
    crop = src[39:671, x0:x1]
    im = Image.fromarray(crop).resize((round((x1 - x0) * 0.3), round(632 * 0.3)), Image.BOX)
    im.save(os.path.join(OUT, n + '.png')); print(n, im.size)

# S4 (2026-11-04): building plinths, small / medium / large, cut whole
rgba = keyed('S4-plots')
for n, (x0, y0, x1, y1) in {'plot-s': (67, 397, 371, 741), 'plot-m': (492, 246, 958, 750), 'plot-l': (1075, 38, 1802, 763)}.items():
    crop = rgba[y0:y1, x0:x1]
    im = Image.fromarray(crop).convert('RGBa').resize((round((x1 - x0) * 0.3), round((y1 - y0) * 0.3)), Image.BOX).convert('RGBA')
    a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
    Image.fromarray(a).save(os.path.join(OUT, n + '.png')); print(n, im.size)

# D1 (2026-11-04): defence pieces, cut whole (bastion, round tower, gatehouse, battlement, banner pillar)
rgba = keyed('D1-defence')
for n, (x0, y0, x1, y1) in {'d-bastion': (74, 272, 402, 676), 'd-tower': (469, 21, 767, 676), 'd-gate': (824, 111, 1412, 669),
                            'd-battlement': (1481, 356, 1882, 669), 'd-pillar': (1946, 267, 2091, 669)}.items():
    crop = rgba[y0:y1, x0:x1]
    im = Image.fromarray(crop).convert('RGBa').resize((round((x1 - x0) * 0.2), round((y1 - y0) * 0.2)), Image.BOX).convert('RGBA')
    a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
    Image.fromarray(a).save(os.path.join(OUT, n + '.png')); print(n, im.size)

# D2 (2026-11-04): decor, cut whole
rgba = keyed('D2-decor')
for n, (x0, y0, x1, y1) in {'d-beacon': (50, 141, 250, 632), 'd-bowl': (277, 456, 476, 632), 'd-lantern': (475, 208, 644, 632),
                            'd-statue': (671, 122, 895, 632), 'd-planter': (923, 342, 1169, 632), 'd-well': (1183, 193, 1507, 633),
                            'd-rack': (1534, 284, 1758, 632), 'd-crates': (1801, 313, 2127, 632)}.items():
    crop = rgba[y0:y1, x0:x1]
    im = Image.fromarray(crop).convert('RGBa').resize((round((x1 - x0) * 0.2), round((y1 - y0) * 0.2)), Image.BOX).convert('RGBA')
    a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
    Image.fromarray(a).save(os.path.join(OUT, n + '.png')); print(n, im.size)

# B01 (2026-11-04): the Central Flame's five looks (flame 1, 5, 10, 15, 20), cut whole with empty bowls
src = np.asarray(Image.open(os.path.join(SRC, 'B01-central-flame.png')).convert('RGB')).astype(int)
fgm = key_mask(src, tol=120, fringe=1)
for n, (x0, y0, x1, y1) in {'hearth1': (40, 344, 374, 654), 'hearth5': (431, 344, 764, 654), 'hearth10': (820, 275, 1172, 654),
                            'hearth15': (1229, 177, 1607, 654), 'hearth20': (1666, 36, 2134, 660)}.items():
    rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8'); rgba[..., :3] = src[y0:y1, x0:x1] * fgm[y0:y1, x0:x1, None]; rgba[..., 3] = fgm[y0:y1, x0:x1] * 255
    im = Image.fromarray(rgba).convert('RGBa').resize((round((x1 - x0) * 0.4), round((y1 - y0) * 0.4)), Image.BOX).convert('RGBA')
    a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
    Image.fromarray(a).save(os.path.join(OUT, n + '.png')); print(n, im.size)

# Buildings on their own plinths (B02-B18, 2026-11-04): BUILD[file] = boxes of each level, left to right, cut whole at 0.4
BUILD = {
    'B02-forge': ('forge', [(41, 250, 408, 681), (490, 146, 923, 681), (1005, 117, 1502, 681), (1583, 18, 2129, 681)]),
    'B05-cultivation-plot': ('garden', [(105, 255, 597, 695), (676, 138, 1213, 696), (1318, 26, 2088, 696)]),
    'B18-upper-works': ('upper', [(41, 288, 325, 697), (369, 272, 642, 697), (683, 249, 1014, 697), (1044, 280, 1315, 697), (1354, 461, 1637, 697)]),
    'B03-armory': ('armory', [(38, 265, 453, 684), (503, 161, 943, 684), (995, 122, 1507, 684), (1562, 31, 2131, 684)]),
}
for f, (key, boxes) in BUILD.items():
    src = np.asarray(Image.open(os.path.join(SRC, f + '.png')).convert('RGB')).astype(int)
    fgm = key_mask(src, tol=120, fringe=1)
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8'); rgba[..., :3] = src[y0:y1, x0:x1] * fgm[y0:y1, x0:x1, None]; rgba[..., 3] = fgm[y0:y1, x0:x1] * 255
        im = Image.fromarray(rgba).convert('RGBa').resize((round((x1 - x0) * 0.4), round((y1 - y0) * 0.4)), Image.BOX).convert('RGBA')
        a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] > 110) * 255
        name = ['alchemy', 'quarters', 'lodge', 'archive', 'circle'][i] + '1' if key == 'upper' else f'{key}{i + 1}'
        Image.fromarray(a).save(os.path.join(OUT, f'b-{name}.png'))
    print(f, len(boxes))
