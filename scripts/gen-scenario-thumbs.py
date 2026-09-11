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


def without_variants(path):
    """The map as the book prints it. A Variant's layer is display="none", which MuPDF ignores,
    so it is taken out before rendering."""
    import xml.etree.ElementTree as ET
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    root = ET.parse(path).getroot()
    for parent in root.iter():
        for child in [c for c in parent if 'data-v' in c.attrib]:
            parent.remove(child)
    return ET.tostring(root)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    paths = sorted(glob.glob(os.path.join(SRC, '*.webp')))
    for path in paths:
        dest = os.path.join(OUT, os.path.basename(path))
        svg = path[:-5] + '.svg'
        if os.path.exists(svg):   # a redrawn map wins over the book's small picture
            import fitz
            page = fitz.open(stream=without_variants(svg), filetype='svg')[0]
            zoom = SIZE * 2 / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        else:
            im = Image.open(path)
        im.convert('RGB').resize((SIZE, SIZE), Image.LANCZOS).save(dest, 'WEBP', quality=82, method=6)
        total += os.path.getsize(dest)
    print('%d thumbnails, %d KB -> %s' % (len(paths), total // 1024, os.path.relpath(OUT, ROOT)))


if __name__ == '__main__':
    main()
