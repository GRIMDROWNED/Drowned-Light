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


def shrink(rgba, k, colors=24, outline=(10, 11, 12), nearest=False):
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
    return out.crop(out.getbbox())

def contact(ims, path, scale=4, bgc=(22, 32, 38, 255)):
    W = sum(i.width + 4 for i in ims) + 4; H = max(i.height for i in ims) + 8
    c = Image.new('RGBA', (W, H), bgc); x = 4
    for i in ims: c.alpha_composite(i, (x, H - 4 - i.height)); x += i.width + 4
    c.resize((W * scale, H * scale), Image.NEAREST).save(path)


def cut_keyed(img, k, key=(255, 0, 255), tol=120, fringe=3, colors=32, outline=(10, 11, 12), recolor=None):
    """Cut a sprite off a flat key-colour background (AI renders): drop pixels near the key,
    peel the tinted fringe, keep the main shapes, then shrink by k."""
    a = np.asarray(img.convert('RGB')).astype(int)
    d = np.sqrt(((a - np.array(key)) ** 2).sum(-1))
    # purple fringe: red and blue both well above green
    tint = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 70
    fg = (d > tol) & ~tint
    fg = ndimage.binary_opening(fg, iterations=1)
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    sz = ndimage.sum(fg, lab, range(1, n + 1))
    fg = np.isin(lab, 1 + np.where(sz >= 0.02 * sz.max())[0])
    if fringe: fg = ndimage.binary_erosion(fg, iterations=fringe)
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
