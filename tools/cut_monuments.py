"""Cut Robert's monument sheet (M1, green #00FF00 background) into the base's monument ring sprites.

usage: python3 tools/cut_monuments.py [sheet]  (default /mnt/project-files/art-prompts/returned/monuments/M1-monuments.png)
Writes assets/sprites/refuge/m-stub.png, m-spires.png, m-mines.png: the three pieces at one shared scale, the plinth
PLINTH world px wide, 2 file px per world px (src/refuge.js drawMonument draws them at half size). Each file is
cropped so the plinth sits centred and its front edge is the picture's bottom row.
"""
import os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned/monuments/M1-monuments.png'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'refuge')
PLINTH = 54  # world px across the plinth
NAMES = ['m-stub', 'm-spires', 'm-mines']


# the hue a see-through key-blended pixel (mist, smoke, an edge) takes in each piece; its brightness is kept
TINT = {'m-stub': (1.0, 0.95, 0.9), 'm-spires': (0.85, 0.7, 1.0), 'm-mines': (0.9, 0.85, 0.82)}


def key(a):
    """Green key. A pixel whose green rises over red and blue is part key: how far sets its alpha (soft, so mist and
    smoke fade), and its colour is rebuilt from its red and blue (the art's own share) in the piece's tint, since a
    pale wisp over green can't be told apart from a teal one."""
    gx = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    spill = gx > 0
    alpha = np.where(spill, np.clip(1 - gx / 235, 0, 1) ** 1.3, 1.0)
    lum = np.clip(np.maximum(a[..., 0], a[..., 2]) / np.maximum(alpha, 0.05), 0, 255)
    return a.copy(), alpha, spill, lum


a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
rgb, alpha, spill, lum = key(a)
W = a.shape[1]
cols = (alpha > 0.1).any(0)
# the three pieces: split at the widest empty gaps between columns
runs, x = [], 0
while x < W:
    if cols[x]:
        s = x
        while x < W and cols[x]: x += 1
        runs.append([s, x])
    else: x += 1
while len(runs) > 3:  # merge across the smallest gap (mist wisps may break a piece apart)
    g = min(range(len(runs) - 1), key=lambda i: runs[i + 1][0] - runs[i][1])
    runs[g:g + 2] = [[runs[g][0], runs[g + 1][1]]]
assert len(runs) == 3, runs
# the plinth: the opaque span in the bottom rows of each piece; one scale for all three
pieces = []
for x0, x1 in runs:
    al = alpha[:, x0:x1]
    rows = np.where((al > 0.5).any(1))[0]
    y0, y1 = rows.min(), rows.max() + 1
    base = al[y1 - 30:y1] > 0.5
    px = np.where(base.any(0))[0]
    pieces.append((x0, x1, y0, y1, x0 + px.min(), x0 + px.max() + 1))
pw = np.mean([p[5] - p[4] for p in pieces])
k = 2 * PLINTH / pw
for name, (x0, x1, y0, y1, p0, p1) in zip(NAMES, pieces):
    cx = (p0 + p1) / 2
    half = max(cx - x0, x1 - cx)
    l, r = int(np.floor(cx - half)), int(np.ceil(cx + half))
    t = np.array(TINT[name])
    rgb[spill] = (lum[spill, None] * t[None]).clip(0, 255)
    sub = np.dstack([rgb[y0:y1, l:r] * alpha[y0:y1, l:r, None], alpha[y0:y1, l:r] * 255])  # premultiplied
    im = Image.fromarray(sub.clip(0, 255).astype('uint8'), 'RGBA')
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    o = np.asarray(im).astype(float)
    al = np.maximum(o[..., 3:4], 1)
    o[..., :3] = np.clip(o[..., :3] * 255 / al, 0, 255)
    o[..., 3][o[..., 3] < 10] = 0
    Image.fromarray(o.astype('uint8'), 'RGBA').save(os.path.join(OUT, name + '.png'), optimize=True)
    print(f'{name}: {im.width}x{im.height} file px ({im.width / 2:.0f}x{im.height / 2:.0f} world)')
