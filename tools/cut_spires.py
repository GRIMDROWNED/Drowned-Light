"""Cut Robert's Abyssal Spires art (green #00FF00 backgrounds) into game sprites.

usage: python3 tools/cut_spires.py [returned dir]   (default /mnt/project-files/art-prompts/returned)
Writes assets/sprites/spires/*.png at 2 file px per world px (src/spires.js draws them at half size).
The floor tiles have no background: they are only scaled.
"""
import os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'spires')
os.makedirs(OUT, exist_ok=True)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float)


def key(a):
    """Green key with a soft edge: how far green rises over red and blue sets the alpha; then
    the green spill is taken out of what is kept."""
    gx = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((115 - gx) / 55, 0, 1)
    rgb = a.copy()
    spill = gx > 0  # green above both: a blend with the key; pull it back to the art's violet
    rgb[..., 1][spill] = np.minimum(a[..., 0], a[..., 2])[spill]
    out = np.dstack([rgb, alpha * 255]).clip(0, 255).astype('uint8')
    return Image.fromarray(out, 'RGBA')


def bbox(im, thr=24):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > thr)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def fit(im, w=None, h=None, k=None):
    if k is None: k = (w / im.width) if w else (h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), k


def save(im, name, colors=96):
    # pixel art: a small palette keeps the files light (soft mist edges keep their alpha)
    im = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(f'{name}: {im.width}x{im.height}')


S = os.path.join  # short
sp = 'spires'

# floors: whole tiles, 192 world px
for i in (2, 3, 4):
    im = Image.open(S(SRC, sp, f'floor-{i}.png')).convert('RGB').resize((384, 384), Image.LANCZOS)
    save(im, f'floor-{i}')

# the south-edge parapet: one period (post to post, three runs) so it tiles with a post at each seam
im = key(load(S(sp, 'kerb.png')))
x0, y0, x1, y1 = bbox(im)
posts = [0, 594, 1218, 1838]  # raw x of each post's left edge (posts every ~620 px)
im = im.crop((posts[0], y0, posts[3], y1))
save(fit(im, h=48)[0], 'kerb')

# hanging faces: brick band (tiles down) + rock roots (once, at the foot)
for i in (1, 2):
    im = key(load(S(sp, f'face-{i}.png')))
    x0, y0, x1, y1 = bbox(im)
    im = im.crop((x0, y0, x1, y1))
    a = np.asarray(im)[..., 3] > 200
    full = a.mean(1) > 0.985
    wall = int(np.argmin(full[5:])) + 5  # rows of solid wall, before the rock roots start
    im, k = fit(im, w=680)
    wall = round(wall * k)
    band = round(wall * 0.5)  # the top half of the wall tiles downward on tall faces
    save(im.crop((0, 0, im.width, band)), f'face-{i}-band')
    save(im.crop((0, band, im.width, im.height)), f'face-{i}-foot')
    print('  foot wall rows (file px):', wall - band)

# stairs (north): whole picture, 0.3 scale; spires.js maps the treads onto each stair's rect
im = key(load(S(sp, 'stairs-north.png')))
x0, y0, x1, y1 = bbox(im)
im = im.crop((x0, y0, x1, y1))
im, k = fit(im, k=0.3)
save(im, 'stairs')
print('  treads (file px):', round((190 - x0) * k), round((700 - x0) * k), round((205 - y0) * k), round((1400 - y0) * k))

# bridge planks: rails 60 world apart
im = key(load(S(sp, 'bridge-planks.png')))
x0, y0, x1, y1 = bbox(im)
im = im.crop((0, y0, im.width, y1))
im, k = fit(im, k=0.346)
save(im, 'bridge')
print('  rail centre y (file px):', round((336 - y0) * k))

for name, h in (('bridge-post', 60), ('post', 184), ('spire', 320), ('arch', 400), ('ring', 500), ('exit-banner', 132)):
    im = key(load(S(sp, name + '.png')))
    box = bbox(im)
    im = im.crop(box)
    im, k = fit(im, h=h)
    save(im, name)
    print('  crop', box, 'k', round(k, 4))

# crystals: one scale for all three, so the sizes stay as drawn
for i in (1, 2, 3):
    im = key(load(S(sp, f'crystal-{i}.png')))
    im = im.crop(bbox(im))
    save(fit(im, k=0.13)[0], f'crystal-{i}')

# floating columns
for n in ('column-1', 'column-1b', 'column-2', 'column-3'):
    im = key(load(S(sp, n + '.png')))
    im = im.crop(bbox(im))
    save(fit(im, w=200)[0], n)

# rune circle + its glow, cut with the same box and scale so they line up
circ = key(load(S(sp, 'rune-circle.png')))
box = bbox(circ)
c2, k = fit(circ.crop(box), w=648)
save(c2, 'rune-circle')
g = load(S(sp, 'rune-circle-glow.png'))
glow = key(g)
gb = bbox(glow)
print('  circle box', box, 'glow box', gb)
# the glow picture was framed a little differently: scale and move its outer groove onto the circle's
GX0, GX1 = 120, 1135  # the circle's outer groove (raw x)
s = (GX1 - GX0) / (gb[2] - gb[0])
gw = glow.crop(gb)
gw = gw.resize((round(gw.width * s), round(gw.height * s)), Image.LANCZOS)
canvas = Image.new('RGBA', circ.size, (0, 0, 0, 0))
cy = (box[1] + box[3]) / 2 + 2
canvas.alpha_composite(gw, (round(GX0), round(cy - gw.height / 2)))
save(fit(canvas.crop(box), k=k)[0], 'rune-glow')

# bullets: 4 cells, each fitted into 40 file px
im = key(load(S(sp, 'bullets.png')))
cw = im.width // 4
for i in range(4):
    cell = im.crop((i * cw, 0, (i + 1) * cw, im.height))
    cell = cell.crop(bbox(cell))
    k = 40 / max(cell.size)
    save(fit(cell, k=k)[0], f'bullet-{i}')

# the Spire Sentinel: poses-a (3x2: idle, charge 1, charge 2, fire, hurt, shattered) + orbit (6x1, idle loop)
SEN = os.path.join(SRC, 'spire-sentinel')


def cells(path, cols, rows):
    im = key(load(path))
    cw, ch = im.width // cols, im.height // rows
    return [im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(rows) for c in range(cols)]


def frames(cs, H, name):
    boxes = [bbox(c) for c in cs]
    k = H / (boxes[0][3] - boxes[0][1])
    # line each frame up by its pedestal: bottom row on the ground line, centred on its lowest 25%
    outs = []
    for c, b in zip(cs, boxes):
        a = np.asarray(c)[..., 3] > 24
        foot = a[int(b[3] - (b[3] - b[1]) * 0.25):b[3]]
        xs = np.where(foot.any(0))[0]
        cx = (xs.min() + xs.max()) / 2
        outs.append((c, b, cx))
    half = max(max(cx - b[0], b[2] - cx) for _, b, cx in outs)
    tall = max(b[3] - b[1] for _, b, _ in outs)
    sheet = Image.new('RGBA', (round(2 * half * k) * len(outs), round(tall * k)), (0, 0, 0, 0))
    fw = round(2 * half * k)
    for i, (c, b, cx) in enumerate(outs):
        crop = c.crop((round(cx - half), b[3] - tall, round(cx + half), b[3]))
        crop = crop.resize((fw, round(tall * k)), Image.LANCZOS)
        sheet.alpha_composite(crop, (i * fw, 0))
    save(sheet, name)
    print('  frame', fw, 'x', sheet.height)


frames(cells(os.path.join(SEN, 'poses-a.png'), 3, 2), 168, 'sentinel')
frames(cells(os.path.join(SEN, 'orbit.png'), 6, 1), 168, 'sentinel-orbit')

# the Rift Throne boss's arena floor and throne, and the Mist Wells (dark and lit)
RB = 'rift-throne-boss'
for src, name, w in ((S(RB, 'arena.png'), 'arena', 1400), (S(RB, 'throne.png'), 'throne', 330),
                     (S(sp, 'well-dark.png'), 'well-dark', 260), (S(sp, 'well-lit.png'), 'well-lit', 260)):
    im = key(load(src))
    im = im.crop(bbox(im))
    save(fit(im, w=w)[0], name)

# ---- step 8: the run's loot and the camp's dungeon buildings ----
def crop(im):
    return im.crop(bbox(im))


def same_scale(cs, k, prefix, out=None):
    """Each cell cut to its own bounds at one shared scale k (so levels keep their sizes against each other)."""
    for i, c in enumerate(cs):
        save(fit(crop(c), k=k)[0], f'{prefix}{i + 1}' if prefix[-1] == '-' else prefix + str(i + 1), **({} if out is None else out))


# side-room chest, shut and open (one scale: the open lid stands taller)
cs = cells(S(sp, 'chest.png'), 2, 1)
k = 112 / (bbox(cs[0])[2] - bbox(cs[0])[0])
save(fit(crop(cs[0]), k=k)[0], 'chest-shut')
save(fit(crop(cs[1]), k=k)[0], 'chest-open')
# Aether Crystal nodes in the mist: three shapes (the full-grown left column)
cs = cells(S(sp, 'aether.png'), 3, 3)
for i, c in enumerate((cs[0], cs[3], cs[6])):
    save(fit(crop(c), h=64)[0], f'aether-{i + 1}')
# the room seal's 4 flickering frames, each to one size so they swap cleanly
cs = cells(S(sp, 'room-seal.png'), 4, 1)
bs = [bbox(c) for c in cs]
w = max(b[2] - b[0] for b in bs); h = max(b[3] - b[1] for b in bs)
for i, (c, b) in enumerate(zip(cs, bs)):
    cx = (b[0] + b[2]) // 2
    f = c.crop((cx - w // 2, b[3] - h, cx - w // 2 + w, b[3]))
    save(fit(f, h=150)[0], f'seal-{i + 1}')
# icons: Rift Shard, Aether Crystal, loot sack, Mist Well token (small, for the HUD and menus)
for src, name in ((S(sp, 'rift-shard.png'), 'icon-shard'), (S(sp, 'aether-icon.png'), 'icon-aether')):
    save(fit(crop(key(load(src))), h=48)[0], name)
cs = cells(S(sp, 'icons.png'), 2, 1)
save(fit(crop(cs[0]), h=48)[0], 'icon-bag')
save(fit(crop(cs[1]), h=48)[0], 'icon-well')

# the camp's dungeon buildings, to assets/sprites/rift
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'rift')
os.makedirs(OUT, exist_ok=True)
cs = cells(S('camp', 'crystal-turret.png'), 3, 1)  # levels 1-3; the launcher points right
k = 190 / (bbox(cs[2])[3] - bbox(cs[2])[1])
for i, c in enumerate(cs):
    b = bbox(c)
    print(f'turret-{i + 1} raw bbox', b)
    save(fit(c.crop(b), k=k)[0], f'turret-{i + 1}')
cs = cells(S('camp', 'crystal-turret-fx.png'), 4, 1)  # bolt, flash, big flash, shatter
k = 56 / (bbox(cs[0])[2] - bbox(cs[0])[0])
for c, name in zip(cs, ('bolt', 'flash-1', 'flash-2', 'hit')):
    save(fit(crop(c), k=k)[0], name)
cs = cells(S('camp', 'mist-lantern.png'), 3, 1)
k = 230 / (bbox(cs[2])[3] - bbox(cs[2])[1])
for i, c in enumerate(cs):
    save(fit(crop(c), k=k)[0], f'lantern-{i + 1}')
cs = cells(S('camp', 'rift-portal.png'), 2, 1)
k = 330 / (bbox(cs[1])[3] - bbox(cs[1])[1])
for c, name in zip(cs, ('portal-off', 'portal-on')):
    save(fit(crop(c), k=k)[0], name)
