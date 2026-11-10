"""Cut Robert's Molten Mines art (green #00FF00 backgrounds) into game sprites.

usage: python3 tools/cut_mines.py [returned dir]   (default /mnt/project-files/art-prompts/returned)
Writes assets/sprites/mines/*.png at 2 file px per world px unless noted (src/mines.js and src/minetraps.js draw
them at half size). Raw pictures: returned/crucible/. The floor tiles have no background: they are only scaled.
"""
import os, sys
import numpy as np
from PIL import Image

SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned', 'crucible')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'mines')
os.makedirs(OUT, exist_ok=True)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float)


def key(a):
    """Green key with a soft edge; the green spill is pulled back to the art's own red-brown."""
    gx = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((115 - gx) / 55, 0, 1)
    rgb = a.copy()
    spill = gx > 0
    rgb[..., 1][spill] = np.minimum(a[..., 0], a[..., 2])[spill]
    return Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype('uint8'), 'RGBA')


def bbox(im, thr=24):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > thr)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def crop(im):
    return im.crop(bbox(im))


def fit(im, w=None, h=None, k=None):
    if k is None: k = (w / im.width) if w else (h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), k


def save(im, name, colors=96):
    im = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(f'{name}: {im.width}x{im.height}')


def cells(name, xs, y0=None, y1=None):
    """Cut a strip of pictures at raw column ranges xs; with y0/y1 every cell shares those rows (feet line up)."""
    im = key(load(name))
    out = []
    for a, b in xs:
        c = im.crop((a, 0, b, im.height))
        if y0 is None: c = crop(c)
        else: c = c.crop((0, y0, c.width, y1))
        out.append(c)
    return out


# floors: whole tiles, 192 world px
for i in (1, 2, 3):
    save(Image.open(os.path.join(SRC, f'floor-{i}.png')).convert('RGB').resize((384, 384), Image.LANCZOS), f'floor-{i}')

# hanging faces: head (the column caps, once at the top), band (mid-wall, tiled down), foot (once, at the bottom).
# face-2's own lava fall is patched out with the columns west of it: the Mines pour their falls (animated) where
# src/mines.js FALLS puts them.
for i in (1, 2):
    a = load(f'face-{i}.png')
    if i == 2: a[:, 990:1150] = a[:, 830:990]
    im = crop(key(a))
    full = np.where((np.asarray(im)[..., 3] > 200).mean(1) > 0.9)[0]
    top, end = int(full[0]), int(full[-1])
    im, k = fit(im.crop((0, top, im.width, im.height)), w=680)
    end = round((end - top) * k)
    h1, h2 = round(end * 0.4), round(end * 0.7)
    save(im.crop((0, 0, im.width, h1)), f'face-{i}-head')
    save(im.crop((0, h1, im.width, h2)), f'face-{i}-band')
    save(im.crop((0, h2, im.width, im.height)), f'face-{i}-foot')
    print('  foot wall rows (file px):', end - h2)

# the lava fall, 4 frames (src/mines.js stretches the stream between the spout and the splash)
for i, c in enumerate(cells('lavafall.png', [(73, 370), (517, 813), (960, 1257), (1404, 1700)], 14, 852)):
    save(fit(c, w=72)[0], f'fall-{i + 1}')

# stairs: one picture at half the raw size (raw box x 128..1124, y 73..1137); mines.js slices it
im = key(load('stairs-north.png')).crop((128, 73, 1124, 1137))
save(fit(im, k=0.5)[0], 'stairs')

# the rune circle in the Ash Hall, the arch home, the throne and its arena (Robert's 2nd arena floor)
for src, name, w in (('rune-circle.png', 'rune-circle', 668), ('arch.png', 'arch', None), ('throne.png', 'throne', 560),
                     ('arena-1.png', 'arena-1', 1400), ('arena-2.png', 'arena-2', 1400)):
    im = key(load(src))
    box = bbox(im)
    im = im.crop(box)
    im, k = fit(im, w=w) if w else fit(im, k=0.25)
    save(im, name)
    print('  crop', box, 'k', round(k, 4))

for src, name, h in (('brazier.png', 'brazier', 160), ('banner.png', 'banner', 160)):
    save(fit(crop(key(load(src))), h=h)[0], name)

# shrine dark | lit, one scale
for name, c in zip(('shrine-dark', 'shrine-lit'), cells('shrine.png', [(72, 812), (959, 1698)])):
    save(fit(c, h=260)[0], name)

# the fire curtain across a shut room's door, 3 frames
for i, c in enumerate(cells('seal.png', [(55, 664), (781, 1390), (1507, 2116)], 89, 612)):
    save(fit(c, w=240)[0], f'seal-{i + 1}')

# ---- traps (src/minetraps.js) ----
for i, c in enumerate(cells('grate.png', [(72, 655), (796, 1379), (1520, 2103)])):
    save(fit(c, w=112)[0], f'grate-{i + 1}')
for i, c in enumerate(cells('grate-flame-2.png', [(80, 395), (512, 828), (944, 1259), (1375, 1692)], 100, 786)):
    save(fit(c, w=124)[0], f'grate-flame-{i + 1}')
# crane, hanging cage, landed cage, broken cage: one scale
for name, c in zip(('crane', 'cage-hang', 'cage-down', 'cage-broken'), cells('crane-cage.png', [(47, 514), (664, 971), (1159, 1529), (1657, 2125)])):
    save(fit(c, k=0.34)[0], name)
# the dragon-head nozzle and its 4 flame frames (pointing east)
hd, = cells('jet.png', [(52, 562)])
save(fit(hd, w=84)[0], 'jet-head')
im = key(load('jet.png'))
for i, (a, b) in enumerate([(37, 158), (188, 335), (369, 518), (549, 685)]):
    c = im.crop((668, a, 1990, b))
    save(fit(c, w=480)[0], f'jet-{i + 1}')
for i, c in enumerate(cells('crumble.png', [(41, 504), (585, 1047), (1128, 1590), (1672, 2134)])):
    save(fit(c, w=96)[0], f'crumble-{i + 1}')
for name, c in zip(('cart-side', 'cart-front', 'cart-broken'), cells('cart.png', [(38, 526), (644, 965), (1054, 1597)])):
    save(fit(c, k=0.25)[0], name)
rail, = cells('cart.png', [(1655, 2125)])
save(fit(rail, h=60)[0], 'rail')
for i, c in enumerate(cells('geyser.png', [(33, 411), (476, 855), (919, 1297), (1363, 1741)], 47, 795)):
    save(fit(c, w=128)[0], f'geyser-{i + 1}')

# bullets: orb, comet, crescent, rock, shard, spark (each fitted into 40 file px)
for i, c in enumerate(cells('bullets.png', [(99, 252), (347, 653), (747, 1000), (1107, 1385), (1475, 1791), (1884, 2106)])):
    save(fit(c, k=40 / max(c.size))[0], f'bullet-{i}')

# ---- the Magma Golem's props (bottom row of returned/crucible/magma-golem/attacks.png) ----
im = key(load('magma-golem/attacks.png'))
for name, box, w in (('golem-fist', (29, 600, 474, 900), 130), ('golem-pool', (539, 600, 990, 920), 300), ('golem-core', (1052, 600, 1489, 920), 90)):
    save(fit(crop(im.crop(box)), w=w)[0], name)

# ---- the Seething Seraph's obsidian shards (returned/crucible/seething-seraph/shards.png): three whole, cracked,
# breaking, burst. One scale for all (a shard about 40 world px tall).
im = key(load('seething-seraph/shards.png'))
for name, box in (('shard-1', (150, 0, 370, 512)), ('shard-2', (630, 0, 900, 512)), ('shard-3', (1160, 0, 1400, 512)),
                  ('shard-crack', (140, 512, 380, 1024)), ('shard-break', (640, 512, 900, 1024)), ('shard-burst', (1120, 512, 1420, 1024))):
    save(fit(crop(im.crop(box)), k=0.2)[0], name)

# ---- the Cinder Colossus's props (bottom row of returned/crucible/cinder-colossus/extras.png): a mortar shell, a
# broken chain (flung when it tears free), a fist rocketing on a jet of flame (its thrown fist)
im = key(load('cinder-colossus/extras.png'))
for name, box, w in (('colossus-mortar', (100, 600, 450, 930), 70), ('colossus-chain', (530, 640, 980, 880), 90),
                     ('colossus-fist', (1020, 600, 1520, 940), 170)):
    save(fit(crop(im.crop(box)), w=w)[0], name)
