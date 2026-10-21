"""Cut AI-rendered sprites (one character per image on a flat magenta background) into game sprites.
Usage: python3 tools/cut_ai_sprites.py <folder of returned images>
Every image of a character is shrunk by the same factor, set so the reference pose is TARGET px tall,
so poses keep their relative size."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cut_keyed, contact

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

# character: (output folder, reference image, its figure height in the render, target height in file px, {source: output name})
# The knight is cut at 2 file px per art pixel (res: 2 in src/sprites.js), so 80 px is 40 art px.
SETS = {
    'lantern-knight': ('lantern-knight', 'knight-front.png', 1082, 80, {
        'knight-front.png': 'front',
        'knight-back.png': 'back',
        'knight-side.png': 'right',
        'knight-attack1-raised.png': 'attackA',
        'knight-attack2-level.png': 'attackB',
        'knight-attack3-low.png': 'attackC',
        'knight-walk1.png': 'side/walk1',
        'knight-walk2.png': 'side/walk2',
        'knight-walk3.png': 'side/walk3',
        'knight-walk4.png': 'side/walk4',
        'knight-dash.png': 'side/dash',
        'knight-hurt.png': 'side/hurt',
        'knight-death.png': 'side/death',
    }),
}

for name, (folder, ref, ref_h, target, files) in SETS.items():
    k = target / ref_h
    done = []
    for src, out in files.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p): continue
        im = cut_keyed(Image.open(p), k)
        dst = os.path.join(OUT, folder, out + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        done.append(im)
        print(dst, im.size)
    if done: contact(done, os.path.join(SRC, name + '-preview.png'))
