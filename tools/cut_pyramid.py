"""Cut Robert's pyramid step strips (flat magenta background) into tiling strips for src/pyramid.js.
Usage: python3 tools/cut_pyramid.py [folder of returned images]
Each strip is trimmed at its repeat ends (so no outline shows at the seams), shrunk so its thin side is
THIN file px, and saved to assets/sprites/pyramid/. Strips are cut at 2 file px per world px."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import key_mask, shrink, contact, split_grid, cut_keyed

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned/pyramid'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'pyramid')
# name: (thin side in file px, the strip runs 'h' (left/right) or 'v' (up/down))
STRIPS = {'step-south': (36, 'h'), 'step-north': (20, 'h'), 'step-east': (24, 'v'), 'step-west': (24, 'v')}
TRIM = 0.025  # of the long side, off each repeat end

os.makedirs(OUT, exist_ok=True)
outs = []
for name, (thin, run) in STRIPS.items():
    a = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGB')).astype(int)
    fg = key_mask(a, tol=120, fringe=2)
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    if run == 'h': t = int((x1 - x0) * TRIM); x0 += t; x1 -= t
    else: t = int((y1 - y0) * TRIM); y0 += t; y1 -= t
    rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8')
    rgba[..., :3] = a[y0:y1, x0:x1] * fg[y0:y1, x0:x1, None]; rgba[..., 3] = fg[y0:y1, x0:x1] * 255
    k = thin / (rgba.shape[0] if run == 'h' else rgba.shape[1])
    im = shrink(rgba, k, colors=32, crop=False)
    w, h = im.size
    im = im.crop((2, 0, w - 2, h) if run == 'h' else (0, 2, w, h - 2))  # drop the outline across the repeat ends
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, name + '.png'))
    outs.append(im)
    print(name, im.size)
# Stairs: one flight per image, cut whole (no repeat trim) to WIDTH file px wide.
STAIRS = {'stair-south': 244, 'stair-north': 244, 'stair-east': 400, 'stair-west': 400}  # stair-west is stair-east mirrored (Robert asked)
for name, width in STAIRS.items():
    path = os.path.join(SRC, name + '.png')
    if not os.path.exists(path): continue
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    fg = key_mask(a, tol=120, fringe=2)
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8')
    rgba[..., :3] = a[y0:y1, x0:x1] * fg[y0:y1, x0:x1, None]; rgba[..., 3] = fg[y0:y1, x0:x1] * 255
    im = shrink(rgba, width / rgba.shape[1], colors=32)
    im.save(os.path.join(OUT, name + '.png'))
    outs.append(im)
    print(name, im.size)
# Barracks levels 1-3, one sheet of three side by side, cut to WIDTHS file px (props, res 2).
sheet = os.path.join(SRC, 'barracks-sheet.png')
if os.path.exists(sheet):
    for i, (cell, width) in enumerate(zip(split_grid(Image.open(sheet), 3, 1), (140, 156, 172))):
        a = np.asarray(cell.convert('RGB')).astype(int)
        fg = key_mask(a, tol=120, fringe=2)
        xs = np.where(fg.any(0))[0]
        im = cut_keyed(cell, width / (xs.max() - xs.min() + 1), fringe=2)
        im.save(os.path.join(OUT, '..', 'props', 'barracks%d.png' % (i + 1)))
        outs.append(im)
        print('barracks%d' % (i + 1), im.size)
# Central Flame looks at flame 5, 10, 15 and 20: one sheet of four side by side, cut to WIDTHS file px (props, res 2).
# Prints where the coals sit (world px above the bottom), for FLAME_FIRE in src/render.js.
sheet = os.path.join(SRC, 'flame-sheet.png')
if os.path.exists(sheet):
    for cell, lvl, width in zip(split_grid(Image.open(sheet), 4, 1), (5, 10, 15, 20), (116, 128, 144, 160)):
        a = np.asarray(cell.convert('RGB')).astype(int)
        fg = key_mask(a, tol=120, fringe=2)
        xs = np.where(fg.any(0))[0]
        im = cut_keyed(cell, width / (xs.max() - xs.min() + 1), fringe=2)
        im.save(os.path.join(OUT, '..', 'props', 'flame%d.png' % lvl))
        outs.append(im)
        q = np.asarray(im).astype(int); h, w = q.shape[:2]
        mid = q[:, w // 2 - 6: w // 2 + 6]
        coal = (mid[..., 3] > 0) & (mid[..., :3].max(-1) < 75) & (mid[..., :3].max(-1) - mid[..., :3].min(-1) < 18)
        rows = np.where(coal.sum(1) >= 4)[0]
        print('flame%d' % lvl, im.size, 'coals top at', (h - rows.min()) / 2 if len(rows) else None, 'world px above bottom')
# The claimed-square marker: Robert drew both the brazier and the banner, so a square shows both. name: (file, width or None, height)
for name, (prop, width, height) in {'claim-brazier': ('claimBrazier', 64, None), 'claim-banner': ('claimBanner', None, 92)}.items():
    path = os.path.join(SRC, name + '.png')
    if not os.path.exists(path): continue
    img = Image.open(path)
    a = np.asarray(img.convert('RGB')).astype(int)
    fg = key_mask(a, tol=120, fringe=2)
    ys, xs = np.where(fg)
    k = width / (xs.max() - xs.min() + 1) if width else height / (ys.max() - ys.min() + 1)
    im = cut_keyed(img, k, fringe=2)
    im.save(os.path.join(OUT, '..', 'props', prop + '.png'))
    outs.append(im)
    print(prop, im.size)
contact(outs, os.path.join(SRC, 'contact.png'))
