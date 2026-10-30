"""Cut a SpriteCook animation sheet (frames side by side, transparent background) into a kit's pixel frames.
First its colours are moved onto the kit's drawn side walk, class by class (the jade greens, the warm trims,
and the dark/neutral rest) since SpriteCook renders come out darker and muddier; then every frame is cut with
one shared box so the feet stay put, shrunk to the knight's height with one palette, and outlined.
  python3 tools/cut_spritecook_run.py SHEET OUT_DIR PREFIX [--kit jade-breaker] [--frame 224] [--body 200] [--height 89] [--keep-colors]
`--body` is the knight's height in the sheet's pixels (head to feet), `--height` his height in game (file px)."""
import argparse, os, numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('prefix')
ap.add_argument('--kit', default='jade-breaker'); ap.add_argument('--frame', type=int, default=224)
ap.add_argument('--body', type=float, default=200); ap.add_argument('--height', type=float, default=89)
ap.add_argument('--colors', type=int, default=40)
ap.add_argument('--keep-colors', action='store_true', help='skip the recolour (for sheets animated from his own drawn art)')
o = ap.parse_args()
KIT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', o.kit)

def opaque(im):
    a = np.asarray(im.convert('RGBA')).reshape(-1, 4); return a[a[:, 3] > 200][:, :3].astype(float)
def hsv(x): return np.asarray(Image.fromarray(x.reshape(-1, 1, 3).astype(np.uint8)).convert('HSV')).reshape(-1, 3).astype(float)
def rgb(h): return np.asarray(Image.fromarray(np.clip(h, 0, 255).reshape(-1, 1, 3).astype(np.uint8), 'HSV').convert('RGB')).reshape(-1, 3).astype(float)
def hist_match(s, r):
    out = np.empty_like(s)
    for c in range(s.shape[1]):
        q = np.searchsorted(np.sort(s[:, c]), s[:, c], side='right') / len(s)
        out[:, c] = np.quantile(r[:, c], np.clip(q, 0, 1))
    return out
def classes(h):  # 0 dark/neutral, 1 green, 2 warm
    c = np.zeros(len(h), int); ok = (h[:, 2] > 45) & (h[:, 1] > 40)
    c[ok & (h[:, 0] >= 55) & (h[:, 0] <= 150)] = 1; c[ok & ((h[:, 0] < 55) | (h[:, 0] > 230))] = 2
    return c

# 1. Recolour onto the drawn side walk.
A = np.asarray(Image.open(o.sheet).convert('RGBA')).astype(float)
m = A[..., 3] > 200
hs = hsv(A[..., :3][m])
hr = hsv(np.concatenate([opaque(Image.open(os.path.join(KIT, 'side', 'walk%d.png' % i))) for i in range(1, 5)]))
cs, cr = classes(hs), classes(hr)
out = hs.copy()
for k in (1, 2):
    s, r = hs[cs == k], hr[cr == k]; t = s.copy()
    t[:, 0] = (s[:, 0] + np.median(r[:, 0]) - np.median(s[:, 0])) % 256
    t[:, 1:] = hist_match(s, r)[:, 1:]; out[cs == k] = t
s = hs[cs == 0]; t = s.copy(); t[:, 2] = s[:, 2] + (hist_match(s, hr[cr == 0])[:, 2] - s[:, 2]) * 0.6; out[cs == 0] = t
if not o.keep_colors: A[..., :3][m] = np.clip(rgb(out), 0, 255)
S = A.astype(np.uint8)

# 2. Cut with one box, shrink, one palette, outline.
def grow(a):
    b = a.copy(); b[1:] |= a[:-1]; b[:-1] |= a[1:]; b[:, 1:] |= a[:, :-1]; b[:, :-1] |= a[:, 1:]
    b[1:, 1:] |= a[:-1, :-1]; b[:-1, :-1] |= a[1:, 1:]; b[1:, :-1] |= a[:-1, 1:]; b[:-1, 1:] |= a[1:, :-1]; return b
F = o.frame; n = S.shape[1] // F
fr = [S[:, i * F:(i + 1) * F] for i in range(n)]
ys, xs = np.where(np.any([f[..., 3] > 128 for f in fr], axis=0))
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
k = o.height / o.body; w2, h2 = round((x1 - x0) * k), round((y1 - y0) * k)
smalls = []
for f in fr:
    c = f[y0:y1, x0:x1].copy(); c[c[..., 3] <= 128] = 0; c[..., 3] = np.where(c[..., 3] > 128, 255, 0)
    smalls.append(np.asarray(Image.fromarray(c).convert('RGBa').resize((w2, h2), Image.BOX).convert('RGBA')))
pal = np.asarray(Image.fromarray(np.concatenate(smalls, axis=1)[..., :3]).quantize(o.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
os.makedirs(o.out, exist_ok=True)
for i, s in enumerate(smalls):
    a = s[..., 3] > 110
    p = np.zeros((h2 + 2, w2 + 2, 4), 'uint8'); p[1:-1, 1:-1, :3] = pal[:, i * w2:(i + 1) * w2]; p[1:-1, 1:-1, 3] = a * 255
    p[1:-1, 1:-1][~a] = 0
    al = p[..., 3] > 0; p[grow(al) & ~al] = [10, 11, 12, 255]
    Image.fromarray(p).save(os.path.join(o.out, '%s%d.png' % (o.prefix, i + 1)))
print('%d frames, %dx%d' % (n, w2 + 2, h2 + 2))
