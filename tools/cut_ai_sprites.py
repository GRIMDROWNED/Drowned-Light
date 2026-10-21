"""Cut AI-rendered sprites (one character per image on a flat magenta background) into game sprites.
Usage: python3 tools/cut_ai_sprites.py <folder of returned images> [character ...]
Every image of a character is shrunk by the same factor, set so the reference pose is TARGET px tall,
so poses keep their relative size."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutlib import cut_keyed, cut_sheet, contact, match_colors

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art-prompts/returned'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

# character: (output folder, reference image, target height of the reference pose in file px, fringe px to peel, {source: output name})
# An output name can be (name, options) for an image from a different batch:
#   height: its own target height in file px (when it was rendered at another scale)
#   match: recolour it to match another returned image (when the batch came out in other colours)
#   fringe: its own fringe
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
        'knight-dash.png': 'side/dash',
        'knight-hurt.png': 'side/hurt',
        'knight-death.png': 'side/death',
    }),
    'drowned-wretch': ('drowned/footman', 'drowned-wretch/01_front.png', 80, 3, {
        # first batch: the knight's design, recoloured to match the second batch
        'drowned-wretch/01_front.png': ('front', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/02_back.png': ('back', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_c.png': ('right', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_a.png': ('side/walk1', {'match': 'drowned-wretch/b_walk.png'}),
        'drowned-wretch/walk_b.png': ('side/walk3', {'match': 'drowned-wretch/b_walk.png'}),
        # second batch: cropped at one scale, already in the concept colours
        'drowned-wretch/b_attackA.png': ('attackA', {'height': 77, 'fringe': 1}),
        'drowned-wretch/b_attackB.png': ('attackB', {'height': 56, 'fringe': 1}),
        'drowned-wretch/b_attackC.png': ('attackC', {'height': 67, 'fringe': 1}),
        'drowned-wretch/b_hurt.png': ('side/hurt', {'height': 74, 'fringe': 1}),
        'drowned-wretch/b_death.png': ('side/death', {'height': 38, 'fringe': 1}),
    }),
    'tide-archer': ('drowned/archer', 'tide-archer/01_front.png', 80, 2, {
        'tide-archer/01_front.png': 'front',
        'tide-archer/02_back.png': 'back',
        'tide-archer/03_right.png': 'right',
        'tide-archer/04_walk.png': 'side/walk1',
        'tide-archer/05_walk.png': 'side/walk2',
        'tide-archer/06_walk.png': 'side/walk3',
        # cells of a 3x2 sheet (sheet2.png), rendered at a smaller scale
        'tide-archer/07_walk.png': ('side/walk4', {'height': 78, 'fringe': 1}),
        'tide-archer/08_attack_draw.png': ('attackA', {'height': 91, 'fringe': 1}),
        'tide-archer/09_attack_release.png': ('attackB', {'height': 82, 'fringe': 1}),
        'tide-archer/10_attack_lower.png': ('attackC', {'height': 80, 'fringe': 1}),
        'tide-archer/11_hurt.png': ('side/hurt', {'height': 73, 'fringe': 1}),
        'tide-archer/12_death.png': ('side/death', {'height': 42, 'fringe': 1}),
    }),
    'mire-stalker': ('drowned/squire', 'mire-stalker/01_idle_front.png', 80, 1, twelve('mire-stalker', [
        '01_idle_front.png', '02_idle_back.png', '03_idle_right.png', '04_walk_left_forward.png', '05_walk_passing_a.png',
        '06_walk_right_forward.png', '07_walk_passing_b.png', '08_attack_windup.png', '09_attack_midstrike.png',
        '10_attack_followthrough.png', '11_hurt_recoil.png', '12_death.png'])),
}

# Animation sheets: character -> [(sheet, columns, rows, height of the first frame's figure, output prefix)].
# Frames come out on one shared canvas (numbered prefix1, prefix2, ...); put the printed foot point
# in that unit's `feet` in src/sprites.js.
SHEETS = {
    'lantern-knight': [('knight-walk-side-sheet.png', 4, 2, 78, 'side/walk')],
}

only = sys.argv[2:]  # optional character names to cut
for name, (folder, ref, target, fringe, files) in SETS.items():
    if only and name not in only: continue
    k = target / (cut_keyed(Image.open(os.path.join(SRC, ref)), 1, fringe=fringe).height - 2)
    done = []
    for src, out in files.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p): continue
        out, opt = out if isinstance(out, tuple) else (out, {})
        img, fr = Image.open(p), opt.get('fringe', fringe)
        kk = opt['height'] / (cut_keyed(img, 1, fringe=fr).height - 2) if 'height' in opt else k
        rc = match_colors(Image.open(os.path.join(SRC, opt['match']))) if 'match' in opt else None
        im = cut_keyed(img, kk, fringe=fr, colors=64 if rc else 32, recolor=rc)
        dst = os.path.join(OUT, folder, out + '.png')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        done.append(im)
        print(dst, im.size)
    if done: contact(done, os.path.join(SRC, name + '-preview.png'))

for name, sheets in SHEETS.items():
    if only and name not in only: continue
    folder = SETS[name][0]
    for sheet, cols, rows, height, prefix in sheets:
        p = os.path.join(SRC, sheet)
        if not os.path.exists(p): continue
        frames, feet = cut_sheet(Image.open(p), cols, rows, height)
        for i, im in enumerate(frames):
            dst = os.path.join(OUT, folder, prefix + str(i + 1) + '.png')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst)
        print(folder, prefix, len(frames), 'frames', frames[0].size, 'feet', list(feet))
        contact(frames, os.path.join(SRC, name + '-' + prefix.replace('/', '-') + '-preview.png'))
