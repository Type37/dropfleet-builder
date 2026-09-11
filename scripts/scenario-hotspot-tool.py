# -*- coding: utf-8 -*-
"""Mark the symbols on a published scenario map, for hover stats on the scenarios page.

    python scripts/scenario-hotspot-tool.py grid <id>    map with a labelled 5% grid, to read positions from
    python scripts/scenario-hotspot-tool.py check <id>   map with every spot in data/scenario-hotspots/<id>.json drawn on it

Spots are a list of {"t": type, "x": %, "y": %, "r": %}: x and y the symbol's
centre and r a radius that covers it, in percent of the map's width (maps are
square). Types follow the rulebook's map key (11.3 and 12.1.4): orange diamond
out, green square odg, red ring com, bolt pow, grey triangle han; lettered discs
ss/ms/ls; city blobs sc/mc/lc by slot count; lo for Large Objects; ship.
Images go to the system temp folder. Then run scripts/build-scenario-hotspots.py.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

import tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS = os.path.join(ROOT, 'assets', 'scenarios', 'dropfleet')
DATA = os.path.join(ROOT, 'data', 'scenario-hotspots')
HERE = os.path.join(tempfile.gettempdir(), 'dfc-hotspots')
SIZE = 1000
TYPES = {
    'ss': 'Small Space Station', 'ms': 'Medium Space Station', 'ls': 'Large Space Station',
    'sc': 'Small City', 'mc': 'Medium City', 'lc': 'Large City',
    'out': 'Military Outpost', 'odg': 'Orbital Defence Gun', 'com': 'Comms Station',
    'pow': 'Power Plant', 'han': 'Hangar', 'lo': 'Large Object', 'ship': 'Civilian Ship',
}
COL = {'ss': '#d400ff', 'ms': '#d400ff', 'ls': '#d400ff', 'sc': '#0060ff', 'mc': '#0060ff', 'lc': '#0060ff',
       'out': '#ff0000', 'odg': '#ff0000', 'com': '#ff0000', 'pow': '#ff0000', 'han': '#ff0000',
       'lo': '#00a000', 'ship': '#ff8800'}


def load(mid):
    return Image.open(os.path.join(MAPS, mid + '.webp')).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)


def font(n):
    for f in ('arialbd.ttf', 'arial.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(f, n)
        except OSError:
            pass
    return ImageFont.load_default()


def grid(mid):
    im = load(mid)
    d = ImageDraw.Draw(im, 'RGBA')
    f = font(15)
    for p in range(0, 101, 5):
        v = p * SIZE / 100
        strong = p % 10 == 0
        c = (255, 0, 120, 150) if strong else (255, 0, 120, 70)
        d.line([(v, 0), (v, SIZE)], fill=c, width=2 if strong else 1)
        d.line([(0, v), (SIZE, v)], fill=c, width=2 if strong else 1)
        if strong and 0 < p < 100:
            for x, y in ((v + 3, 3), (3, v + 2)):
                d.rectangle([x - 1, y, x + 24, y + 17], fill=(255, 255, 255, 220))
                d.text((x, y), str(p), fill=(200, 0, 90), font=f)
    os.makedirs(os.path.join(HERE, 'grid'), exist_ok=True)
    out = os.path.join(HERE, 'grid', mid + '.png')
    im.save(out)
    print(out)


def check(mid):
    spots = json.load(open(os.path.join(DATA, mid + '.json'), encoding='utf-8'))
    im = load(mid)
    d = ImageDraw.Draw(im, 'RGBA')
    f = font(16)
    for s in spots:
        if s['t'] not in TYPES:
            sys.exit('unknown type %r in %s' % (s['t'], mid))
        x, y, r = (s['x'] * SIZE / 100, s['y'] * SIZE / 100, s['r'] * SIZE / 100)
        c = COL[s['t']]
        d.ellipse([x - r, y - r, x + r, y + r], outline=c, width=3)
        d.line([(x - 5, y), (x + 5, y)], fill=c, width=2)
        d.line([(x, y - 5), (x, y + 5)], fill=c, width=2)
        d.rectangle([x + r * .7, y - r - 18, x + r * .7 + 10 * len(s['t']) + 6, y - r], fill=(255, 255, 255, 230))
        d.text((x + r * .7 + 3, y - r - 18), s['t'], fill=c, font=f)
    os.makedirs(os.path.join(HERE, 'check'), exist_ok=True)
    out = os.path.join(HERE, 'check', mid + '.png')
    im.save(out)
    print(out, len(spots), 'spots')


if __name__ == '__main__':
    {'grid': grid, 'check': check}[sys.argv[1]](sys.argv[2])
