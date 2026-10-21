"""Cut AI-rendered sprites (one character per image on a flat magenta background) into game sprites.
Usage: python3 tools/cut_ai_sprites.py <folder of returned images> [character ...]
Every image of a character is shrunk by the same factor, set so the reference pose is TARGET px tall,
so poses keep their relative size."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cut_keyed, contact

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

# character: (output folder, reference image, target height of the reference pose in file px, fringe px to peel, {source: output name})
# Sprites are cut at 2 file px per art pixel (res: 2 in src/sprites.js), so 80 px is 40 art px.
TWELVE = ['front', 'back', 'right', 'side/walk1', 'side/walk2', 'side/walk3', 'side/walk4',
          'attackA', 'attackB', 'attackC', 'side/hurt', 'side/death']  # the 12-pose enemy prompt, in order

def twelve(folder, names):
    return {folder + '/' + n: out for n, out in zip(names, TWELVE)}

SETS = {
    'lantern-knight': ('lantern-knight', 'knight-front.png', 80, 3, {
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
    'mire-stalker': ('drowned/squire', 'mire-stalker/01_idle_front.png', 80, 1, twelve('mire-stalker', [
        '01_idle_front.png', '02_idle_back.png', '03_idle_right.png', '04_walk_left_forward.png', '05_walk_passing_a.png',
        '06_walk_right_forward.png', '07_walk_passing_b.png', '08_attack_windup.png', '09_attack_midstrike.png',
        '10_attack_followthrough.png', '11_hurt_recoil.png', '12_death.png'])),
}

only = sys.argv[2:]  # optional character names to cut
for name, (folder, ref, target, fringe, files) in SETS.items():
    if only and name not in only: continue
    k = target / (cut_keyed(Image.open(os.path.join(SRC, ref)), 1, fringe=fringe).height - 2)
    done = []
    for src, out in files.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p): continue
        im = cut_keyed(Image.open(p), k, fringe=fringe)
        dst = os.path.join(OUT, folder, out + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        done.append(im)
        print(dst, im.size)
    if done: contact(done, os.path.join(SRC, name + '-preview.png'))
