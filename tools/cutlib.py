"""Cut a pixel sprite out of a concept sheet: key out the dark backdrop connected to the
crop border, keep the main shapes, shrink to a target height, limit the palette, outline."""
import numpy as np
from PIL import Image
from scipy import ndimage

def cut(img, box, height, cool=0, thr=30, colors=24, keep_frac=0.06, sat_keep=40, outline=(10, 11, 12), erode=0, clear=(), peel=0, peel_lum=55, peel_warm=True, nearest=False, close=0, max_hole=None):
    a = np.asarray(img.crop(box).convert('RGB')).astype(int)
    for (x0, y0, x1, y1) in clear:  # wipe neighbouring art inside the crop
        a[y0:y1, x0:x1] = [11, 15, 15]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sat = a.max(-1) - a.min(-1)
    dark = (lum < thr) & (sat < sat_keep)
    if cool: dark &= ((b - r) >= cool) | (lum < 9)
    lab, n = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    if close:  # bridge the black gaps inside armour so the fill below keeps it
        fg = ndimage.binary_closing(np.pad(fg, close), iterations=close)[close:-close, close:-close]
    filled = ndimage.binary_fill_holes(fg)
    if max_hole:  # fill only small holes, so the space inside a sword arc stays clear
        hl, hn = ndimage.label(filled & ~fg)
        hs = ndimage.sum(filled & ~fg, hl, range(1, hn + 1))
        filled = fg | np.isin(hl, 1 + np.where(hs <= max_hole)[0])
    fg = filled
    for _ in range(peel):  # strip dim glow halo from the outside in
        edge = fg & ~ndimage.binary_erosion(fg)
        fg &= ~(edge & (lum < peel_lum) & (((r - b) > 12) | (not peel_warm)))
    if erode: fg = ndimage.binary_opening(fg, iterations=erode)
    l2, n2 = ndimage.label(fg, structure=np.ones((3, 3)))
    if n2 == 0: raise ValueError('nothing found in %r' % (box,))
    sz = ndimage.sum(fg, l2, range(1, n2 + 1))
    fg = np.isin(l2, 1 + np.where(sz >= keep_frac * sz.max())[0])
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8')
    rgba[..., :3] = a[y0:y1, x0:x1]; rgba[..., 3] = fg[y0:y1, x0:x1] * 255
    k = height / rgba.shape[0]
    return shrink(rgba, k, colors, outline, nearest)


def shrink(rgba, k, colors=24, outline=(10, 11, 12), nearest=False, crop=True):
    """Scale a cut-out RGBA array by k into a pixel sprite: limited palette, solid alpha, 1 px outline."""
    w2, h2 = max(1, round(rgba.shape[1] * k)), max(1, round(rgba.shape[0] * k))
    pre = Image.fromarray(rgba).convert('RGBa')
    small = np.asarray(pre.resize((w2, h2), Image.NEAREST if nearest else Image.BOX).convert('RGBA'))
    al = small[..., 3] > 110
    rgb = Image.fromarray(small[..., :3])
    pal = rgb.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    o = np.zeros((h2, w2, 4), 'uint8'); o[..., :3] = np.asarray(pal); o[..., 3] = al * 255
    l3, n3 = ndimage.label(al, structure=np.ones((3, 3)))
    if n3:
        s3 = ndimage.sum(al, l3, range(1, n3 + 1)); al &= np.isin(l3, 1 + np.where(s3 >= max(4, 0.06 * s3.max()))[0])
    o[~al] = 0
    pad = np.zeros((h2 + 2, w2 + 2, 4), 'uint8'); pad[1:-1, 1:-1] = o
    A = pad[..., 3] > 0
    ring = ndimage.binary_dilation(A) & ~A
    pad[ring] = list(outline) + [255]
    out = Image.fromarray(pad)
    return out.crop(out.getbbox()) if crop else out

def contact(ims, path, scale=4, bgc=(22, 32, 38, 255)):
    W = sum(i.width + 4 for i in ims) + 4; H = max(i.height for i in ims) + 8
    c = Image.new('RGBA', (W, H), bgc); x = 4
    for i in ims: c.alpha_composite(i, (x, H - 4 - i.height)); x += i.width + 4
    c.resize((W * scale, H * scale), Image.NEAREST).save(path)


def key_mask(a, key=(255, 0, 255), tol=120, fringe=3, tint=True):
    """Foreground of a render on a flat key colour: drop pixels near the key and the tinted
    fringe, keep the main shapes."""
    d = np.sqrt(((a - np.array(key)) ** 2).sum(-1))
    fg = d > tol
    if tint and key[1] > key[0]:  # green fringe (a green key): green well above red and blue
        fg &= (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) <= 70
    elif tint:  # purple fringe: red and blue well above green (off for art that is purple itself)
        fg &= (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) <= 70
    fg = ndimage.binary_opening(fg, iterations=1)
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    if n == 0: return fg
    sz = ndimage.sum(fg, lab, range(1, n + 1))
    fg = np.isin(lab, 1 + np.where(sz >= 0.02 * sz.max())[0])
    if fringe: fg = ndimage.binary_erosion(fg, iterations=fringe)
    return fg


def cut_sheet(img, cols, rows, height, fringe=1, colors=32, outline=(10, 11, 12), tol=120, tint=True, key=(255, 0, 255)):
    """Cut an animation sheet (equal cells on a key colour) into frames that share one canvas.
    The AI rarely centres a figure in its cell, so each frame is lined up by its own upper body
    (horizontally) and its own lowest point (on the ground line) rather than by the cell. The first
    cell's figure is shrunk to `height` px and every cell by the same factor. Returns the frames
    and their common foot point (x, y)."""
    a = np.asarray(img.convert('RGB')).astype(int)
    cw, ch = a.shape[1] // cols, a.shape[0] // rows
    cells = [a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] for r in range(rows) for c in range(cols)]
    masks = [key_mask(c, key, tol=tol, fringe=fringe, tint=tint) for c in cells]
    boxes = []
    for m in masks:
        ys, xs = np.where(m)
        top, bottom = ys.min(), ys.max()
        torso = ys <= top + 0.45 * (bottom - top)
        boxes.append((top, bottom, xs.min(), xs.max(), xs[torso].mean()))
    k = height / (boxes[0][1] - boxes[0][0] + 1)
    left = int(np.ceil(max(cx - x0 for _, _, x0, _, cx in boxes))) + 1
    right = int(np.ceil(max(x1 - cx for _, _, _, x1, cx in boxes))) + 1
    tall = max(b - t for t, b, _, _, _ in boxes) + 1
    W, H = left + right, tall
    frames = []
    for c, m, (top, bottom, _, _, cx) in zip(cells, masks, boxes):
        rgba = np.zeros((H, W, 4), 'uint8')
        ys, xs = np.where(m)
        ty, tx = ys - bottom + H - 1, np.round(xs - cx + left).astype(int)
        rgba[ty, tx, :3] = c[ys, xs]; rgba[ty, tx, 3] = 255
        frames.append(shrink(rgba, k, colors, outline, crop=False))
    fw, fh = frames[0].size
    return frames, (int(round((left / W) * (fw - 2))) + 1, fh)


def cut_keyed(img, k, key=(255, 0, 255), tol=120, fringe=3, colors=32, outline=(10, 11, 12), recolor=None, tint=True):
    """Cut a sprite off a flat key-colour background (AI renders) and shrink it by k."""
    a = np.asarray(img.convert('RGB')).astype(int)
    fg = key_mask(a, key, tol, fringe, tint)
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), 'uint8')
    rgba[..., :3] = a[y0:y1, x0:x1] * fg[y0:y1, x0:x1, None]; rgba[..., 3] = fg[y0:y1, x0:x1] * 255
    if recolor: rgba[..., :3] = recolor(rgba[..., :3].astype(float)).clip(0, 255)
    return shrink(rgba, k, colors, outline)


def drowned_tint(a):
    """Turn a Lantern Knight render into a drowned one: red cloth to teal-black, steel, cloak and
    leather faded, darker and colder; cyan glow kept."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3
    cyan = (b > r + 40) & (g > r + 30)
    red = (r > g + 45) & (r > b + 35) & ~cyan
    out = a.copy()
    for i, m in enumerate((0.3, 0.48, 0.52)):
        out[..., i][red] = lum[red] * m
    rest = ~cyan & ~red
    for i, m in enumerate((0.74, 0.76, 0.78)):
        out[..., i][rest] = (a[..., i][rest] * 0.5 + lum[rest] * 0.5) * m
    return out


def match_colors(ref_img, key=(255, 0, 255), tol=120):
    """A recolor function that moves a render's colours (outside the cyan glow) to the mean and spread
    of a reference render's, after turning red cloth neutral. Used to fit one batch to another."""
    a = np.asarray(ref_img.convert('RGB')).astype(float)
    fg = np.sqrt(((a - np.array(key)) ** 2).sum(-1)) > tol
    def body(x):
        r, g, b = x[..., 0], x[..., 1], x[..., 2]
        return ~((b > r + 40) & (g > r + 30))
    ref = a[fg & body(a)]
    mu, sd = ref.mean(0), ref.std(0)
    def recolor(x):
        x = x.copy()
        r, g, b = x[..., 0], x[..., 1], x[..., 2]
        red = (r > g + 45) & (r > b + 35)
        lum = x.mean(-1)
        x[red] = lum[red][:, None] * np.array([0.9, 0.85, 0.8])
        m = body(x) & (x.sum(-1) > 0)
        v = x[m]
        x[m] = (v - v.mean(0)) / (v.std(0) + 1e-6) * sd + mu
        return x
    return recolor


def mirror_legs(im, legs=0.32, half=9, cx=None):
    """Make the other foot's step from a front or back walk frame: flip the lowest `legs` share of the
    figure left to right inside a strip `half` px either side of the feet's centre. Runs of feet columns
    narrower than 5 px (a pike or staff butt on the ground) don't count toward the centre. Pass `cx` when
    one foot is off the ground, since then the bottom rows only show the other."""
    on = np.asarray(im)[-8:, :, 3].max(axis=0) > 0
    xs, run = [], []
    for x in range(len(on) + 1):
        if x < len(on) and on[x]: run.append(x); continue
        if len(run) >= 5: xs += run
        run = []
    xs = np.array(xs) if xs else np.where(on)[0]
    if cx is None: cx = round((xs.min() + xs.max() + 1) / 2)
    out = im.copy()
    top = im.height - round(im.height * legs)
    box = (cx - half, top, cx + half, im.height)
    out.paste((0, 0, 0, 0), box)
    out.alpha_composite(im.crop(box).transpose(Image.FLIP_LEFT_RIGHT), box[:2])
    return out


def recolor_frames(frames, recolor):
    """Apply a match_colors recolor to already cut RGBA frames, leaving transparent pixels alone."""
    out = []
    for im in frames:
        a = np.asarray(im.convert('RGBA')).astype(float)
        rgb = a[..., :3].copy()
        rgb[a[..., 3] == 0] = 0
        a[..., :3] = np.clip(recolor(rgb), 0, 255)
        out.append(Image.fromarray(a.astype(np.uint8)))
    return out


def split_grid(img, cols, rows, key=(255, 0, 255), tol=120):
    """Split a sheet of cols x rows poses into one image per pose. Each connected blob of figure pixels
    goes to the cell holding its centre, so a cloak or blade that pokes over a cell edge stays with its
    pose. Returns images in reading order, each the poses' bounding box (plus a margin) on magenta."""
    a = np.asarray(img.convert('RGB')).astype(int)
    fg = np.sqrt(((a - np.array(key)) ** 2).sum(-1)) > tol
    lab, n = ndimage.label(fg)
    cw, ch = a.shape[1] / cols, a.shape[0] / rows
    owner = np.zeros(n + 1, int) - 1
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    for i, (cy, cx) in enumerate(ndimage.center_of_mass(fg, lab, range(1, n + 1))):
        if sizes[i] >= 20:  # specks of noise belong to no pose
            owner[i + 1] = min(int(cy // ch), rows - 1) * cols + min(int(cx // cw), cols - 1)
    out = []
    for c in range(cols * rows):
        m = owner[lab] == c
        m[lab == 0] = False
        ys, xs = np.where(m)
        y0, y1 = max(ys.min() - 8, 0), min(ys.max() + 9, a.shape[0])
        x0, x1 = max(xs.min() - 8, 0), min(xs.max() + 9, a.shape[1])
        cell = np.zeros((y1 - y0, x1 - x0, 3), 'uint8') + np.array(key, 'uint8')
        cell[m[y0:y1, x0:x1]] = a[y0:y1, x0:x1][m[y0:y1, x0:x1]]
        out.append(Image.fromarray(cell))
    return out


def cool_violet(x):
    """The Chain Reaper's tone: his renders came out muddy mauve, so the weakly coloured parts (armour, chain)
    become cool silver with more contrast, and the violet cloth is pulled from pink toward blue-violet so it
    stays violet under the game's warm firelight. x is an (..., 3) float array, 0..255."""
    a = x / 255.0
    mx, mn = a.max(-1), a.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    v, s = mx, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    armour = s < 0.3
    cloth = ~armour & (h > 0.7)
    h = np.where(armour, 0.64, np.where(cloth, h - (h - 0.74) * 0.6, h))
    s = np.where(armour, s * 0.35, np.minimum(1, s * 1.08))
    v = np.where(armour, np.clip((v - 0.12) * 1.45 + 0.08, 0, 1), np.clip(v * 1.12, 0, 1))
    i = (h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    return np.stack([np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])], -1) * 255
