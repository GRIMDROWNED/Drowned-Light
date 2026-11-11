"""The Portal Hall (src/finale.js) from Robert's picture (returned/hall/hall.png, 2026-11-10).

Writes assets/sprites/hall/hall.jpg (the picture, drawn as the hall's floor; hall-clean.png if present) and assets/sprites/hall/walk.png (where
knights and the Drowned may stand: white = the stone walkways and platforms, found from the lit cobbles' colour, minus
each portal's frame, at half the picture's size). PORTALS, DAIS and EXIT here must match DL.FINALE.hall in src/data.js.
Run: python3 tools/cut_hall.py [returned dir]"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'hall')
PORTALS = [(345, 168), (1040, 125), (1250, 312), (1312, 510), (1275, 830), (775, 812), (210, 800), (195, 420)]  # mouth feet
CLEAR = [(1340, 0, 1448, 350), (40, 690, 150, 790)]  # wall tops the colour test takes for floor

img = Image.open(os.path.join(SRC, 'hall', 'hall.png')).convert('RGB')
a = np.asarray(img).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = (r * 3 + g * 6 + b) / 10
m = (lum > 75) & (r - b > 14) & (r - b < 110)
m = ndimage.binary_closing(m, iterations=4)
m = ndimage.binary_opening(m, iterations=9)
lab, n = ndimage.label(m)
keep = lab == (np.argmax(ndimage.sum(m, lab, range(1, n + 1))) + 1)
holes = ndimage.binary_fill_holes(keep) & ~keep
hl, hn = ndimage.label(holes)
for i, s in enumerate(ndimage.sum(holes, hl, range(1, hn + 1))):
    if s < 2500: keep |= hl == (i + 1)
for x, y in PORTALS: keep[max(0, y - 150):y - 6, x - 45:x + 45] = False
for x0, y0, x1, y1 in CLEAR: keep[y0:y1, x0:x1] = False
os.makedirs(OUT, exist_ok=True)
Image.fromarray((keep * 255).astype(np.uint8)).resize((img.width // 2, img.height // 2), Image.NEAREST).convert('1').save(os.path.join(OUT, 'walk.png'), optimize=True)
# the picture drawn: Robert's clean version (empty dais, dark mouths, 2026-11-11) when there is one; the mask comes
# from the first (its lit red cobbles separate cleanly from the water), which lines up with it px for px
clean = os.path.join(SRC, 'hall', 'hall-clean.png')
(Image.open(clean).convert('RGB') if os.path.exists(clean) else img).save(os.path.join(OUT, 'hall.jpg'), quality=90)
print('hall', img.size, 'walkable', round(keep.mean(), 3))
