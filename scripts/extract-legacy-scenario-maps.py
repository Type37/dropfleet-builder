#!/usr/bin/env python3
"""The 1st edition map pictures and the Automated Dreadnought's art, from the old scenario PDFs.

    PYTHONUTF8=1 python scripts/extract-legacy-scenario-maps.py

Covers Dropfleet_Core_Scenarios.pdf, Advent_Scenarios.pdf and Automated_Dreadnought.pdf. The converted
scenarios show maps redrawn by scripts/draw-rulebook-maps.js; these pictures are what those drawings were
read from, and what gen-scenario-thumbs.py looks for before it prefers the .svg. Each is rendered from the
page, clipped to the picture's own box, at the picture's native resolution.
"""
import os
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit('PyMuPDF required:  pip install pymupdf')
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDFS = os.path.join(ROOT, 'Rules-Mechanics-PDFs')
MAPS = os.path.join(ROOT, 'assets', 'scenarios', 'dropfleet')
ART = os.path.join(ROOT, 'assets', 'art')
MAX = 1400

# (pdf, 1-based page, scenario id, embedded map xref)
PAGE_MAPS = [
    ('Dropfleet_Core_Scenarios.pdf', 2, 'core-take-and-hold', 13),
    ('Dropfleet_Core_Scenarios.pdf', 3, 'core-mixed-engagement', 20),
    ('Dropfleet_Core_Scenarios.pdf', 4, 'core-erupting-battlefront', 27),
    ('Dropfleet_Core_Scenarios.pdf', 5, 'core-station-assault', 34),
    ('Dropfleet_Core_Scenarios.pdf', 7, 'core-grid-control', 56),
    ('Dropfleet_Core_Scenarios.pdf', 8, 'core-power-grab', 63),
    ('Dropfleet_Core_Scenarios.pdf', 9, 'core-defence-relay', 70),
    ('Advent_Scenarios.pdf', 2, 'resistance-spearhead', 14),
    ('Advent_Scenarios.pdf', 3, 'heavy-convoy', 29),
    ('Advent_Scenarios.pdf', 4, 'monitoring-the-situation', 44),
    ('Automated_Dreadnought.pdf', 2, 'the-ancient-relic', 16),
]

# (pdf, 1-based page, xref, output name) - ship pictures with their transparency
SHIP_ART = [
    ('Automated_Dreadnought.pdf', 1, 317, 'automated_dreadnought.webp'),
]


def save(im, path):
    if max(im.size) > MAX:
        k = MAX / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(path, 'WEBP', quality=88, method=6)
    print('  %-60s %4dx%-4d %4d KB' % (os.path.relpath(path, ROOT), im.width, im.height, os.path.getsize(path) // 1024))


def page_map(doc, pno, xref):
    page = doc[pno - 1]
    info = next(i for i in page.get_image_info(xrefs=True) if i['xref'] == xref)
    rect = fitz.Rect(info['bbox'])
    zoom = info['width'] / rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)



def main():
    os.makedirs(MAPS, exist_ok=True)
    docs = {}
    op = lambda f: docs.setdefault(f, fitz.open(os.path.join(PDFS, f)))

    print('Maps')
    for f, pno, sid, xref in PAGE_MAPS:
        save(page_map(op(f), pno, xref), os.path.join(MAPS, sid + '.webp'))

    print('Ship art')
    for f, pno, xref, name in SHIP_ART:
        doc = op(f)
        smask = next(i[1] for i in doc[pno - 1].get_images(full=True) if i[0] == xref)
        pix = fitz.Pixmap(doc, xref)
        if pix.n > 3:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        if smask:
            pix = fitz.Pixmap(pix, fitz.Pixmap(doc, smask))
        mode = 'RGBA' if pix.alpha else 'RGB'
        save(Image.frombytes(mode, (pix.width, pix.height), pix.samples), os.path.join(ART, name))


if __name__ == '__main__':
    main()
