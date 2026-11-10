"""Cut Robert's Furnace Hydra sheets (green backgrounds) into boss frames.

usage: python3 tools/cut_hydra.py [returned dir]   (default /mnt/project-files/art-prompts/returned)
Reads returned/furnace-hydra/{idle,poses-a,poses-b}.png and writes assets/sprites/mines-bosses/hydra/*.png, every
frame on one canvas size with the rock mound's bottom centre at the same point (the hydra never moves, so the
frames must not jitter). Cut at res 4 (4 file px per art px; src/sprites.js hydra()).
"""
import os, sys
import numpy as np
from PIL import Image

SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned', 'furnace-hydra')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'mines-bosses', 'hydra')
os.makedirs(OUT, exist_ok=True)
HEIGHT = 400  # file px from the top of the tallest pose to the mound's foot: 100 art px, x1.4 in game (DL.BOSS.size)


def key(a):
    """Green key with a soft edge, spill pulled back to red-brown (as tools/cut_mines.py)."""
    gx = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((115 - gx) / 55, 0, 1)
    rgb = a.copy()
    spill = gx > 0
    rgb[..., 1][spill] = np.minimum(a[..., 0], a[..., 2])[spill]
    return Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype('uint8'), 'RGBA')


def grid(name, cols, rows):
    im = key(np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float))
    w, h = im.width / cols, im.height / rows
    return [im.crop((round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))) for r in range(rows) for c in range(cols)]


NAMES = {
    'idle.png': (4, 1, ['idle1', 'idle2', 'idle3', 'idle4']),
    'poses-a.png': (3, 2, ['still', 'breath', 'spiral', 'lob', 'hurt', 'roar']),
    'poses-b.png': (3, 2, ['cut1', 'cut2', 'cut3', 'regrow', None, 'dead']),  # cell 5 (three heads drooping) unused: it dies with none
}
frames = {}
for sheet, (cols, rows, names) in NAMES.items():
    for n, im in zip(names, grid(sheet, cols, rows)):
        if n is None: continue
        a = np.asarray(im)[..., 3] > 128
        a[:, :3] = a[:, -3:] = False
        ys, xs = np.where(a)
        bot = ys.max()
        base = np.where(a[bot - 40:bot + 1].any(0))[0]  # the mound's foot row band
        cx = (base.min() + base.max()) / 2
        frames[n] = (im, cx, bot, xs.min(), ys.min(), xs.max())

# one canvas for all, in raw px around the anchor (mound foot centre)
left = max(cx - x0 for im, cx, bot, x0, y0, x1 in frames.values())
right = max(x1 - cx for im, cx, bot, x0, y0, x1 in frames.values())
up = max(bot - y0 for im, cx, bot, x0, y0, x1 in frames.values())
k = HEIGHT / up
for n, (im, cx, bot, *_r) in frames.items():
    c = im.crop((round(cx - left), round(bot - up), round(cx + right) + 1, bot + 2))
    c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    c.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, n + '.png'), optimize=True)
print(f'hydra: {len(frames)} frames {round((left + right) * k)}x{round((up + 2) * k)} feet [{round(left * k)}, {HEIGHT}]')
