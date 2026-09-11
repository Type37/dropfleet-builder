#!/usr/bin/env python3
"""Small copies of the scenario maps for the references index.

    PYTHONUTF8=1 python scripts/gen-scenario-thumbs.py

Reads assets/scenarios/dropfleet/*.webp (written by extract-scenario-maps.py)
and writes 192px squares to assets/scenarios/dropfleet/thumb/, enough for a
96px thumbnail on a 2x screen. Re-run after extracting maps.
"""
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'scenarios', 'dropfleet')
OUT = os.path.join(SRC, 'thumb')
SIZE = 192


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    paths = sorted(glob.glob(os.path.join(SRC, '*.webp')))
    for path in paths:
        dest = os.path.join(OUT, os.path.basename(path))
        with Image.open(path) as im:
            im.convert('RGB').resize((SIZE, SIZE), Image.LANCZOS).save(dest, 'WEBP', quality=82, method=6)
        total += os.path.getsize(dest)
    print('%d thumbnails, %d KB -> %s' % (len(paths), total // 1024, os.path.relpath(OUT, ROOT)))


if __name__ == '__main__':
    main()
