"""The Spark Bearer's walks (Robert, 2026-11-11): three sheets of 4 frames in a row (front, back, side facing right),
from returned/finale/spark-bearer-walk-*.png into props sbWalkF1-4 / sbWalkB1-4 / sbWalkS1-4 (src/finale.js). Every frame
of a sheet keeps the same box, so he doesn't jitter: his feet stand on the box's foot and its middle is his middle.
Run: python3 tools/cut_bearer_walk.py [returned dir]"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import key_mask, shrink

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'props')
K = 0.26  # about the height of his standing pictures (sbFront)
for view, tag in (('front', 'F'), ('back', 'B'), ('side', 'S')):
    img = Image.open(os.path.join(SRC, 'finale', 'spark-bearer-walk-' + view + '.png')).convert('RGB')
    cw = img.width // 4
    frames = []
    for i in range(4):
        a = np.asarray(img.crop((i * cw, 0, (i + 1) * cw, img.height))).astype(int)
        fg = key_mask(a, (255, 0, 255), 120, 1, True)
        rgba = np.zeros(a.shape[:2] + (4,), 'uint8'); rgba[..., :3] = a * fg[..., None]; rgba[..., 3] = fg * 255
        frames.append(shrink(rgba, K, 96, crop=False))
    boxes = [f.getbbox() for f in frames]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    for i, f in enumerate(frames):
        f = f.crop(box)
        if f.width % 2: f = f.crop((0, 0, f.width + 1, f.height))
        f.save(os.path.join(OUT, 'sbWalk%s%d.png' % (tag, i + 1)))
    print(view, frames[0].crop(box).size)
