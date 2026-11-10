"""Split Robert's Seething Seraph poses-b sheet (4 figures on top, 3 below: not a 3x2 grid) into the cells that
tools/cut_ai_sprites.py expects, and string the four side floats into walk-side-4.png.

usage: python3 tools/prep_seraph.py [returned dir]; then python3 tools/cut_ai_sprites.py [returned dir] seething-seraph
"""
import os, sys
from PIL import Image

D = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned', 'seething-seraph')
im = Image.open(os.path.join(D, 'poses-b.png')).convert('RGB')
W, H = im.size
# column cuts between the figures (raw px), per row
TOP = [0, 385, 800, 1156, W]
BOT = [0, 435, 979, W]
cells = [im.crop((TOP[i], 0, TOP[i + 1], H // 2)) for i in range(4)] + [im.crop((BOT[i], H // 2, BOT[i + 1], H)) for i in range(3)]
names = ['04_walk', '05_walk', '06_walk', '07_walk', None, '11_hurt', '12_death']  # the 5th float is a spare
for n, c in zip(names, cells):
    if n: c.save(os.path.join(D, n + '.png'))
walks = cells[:4]
w, h = max(c.width for c in walks), max(c.height for c in walks)
strip = Image.new('RGB', (w * 4, h), (0, 255, 0))
for i, c in enumerate(walks): strip.paste(c, (i * w + (w - c.width) // 2, h - c.height))
strip.save(os.path.join(D, 'walk-side-4.png'))
print('seraph cells', strip.size)
