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
    im = Image.fromarray(rgba)
    k = height / im.height
    w2, h2 = max(1, round(im.width * k)), height
    # box-average the colour (weighted by coverage) so the small sprite keeps its shading, then threshold alpha
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
