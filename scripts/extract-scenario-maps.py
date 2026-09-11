#!/usr/bin/env python3
"""Pull every published Dropfleet scenario map out of the PDFs, at native size.

    PYTHONUTF8=1 python scripts/extract-scenario-maps.py

Each scenario page prints its map as one embedded picture with the whole setup
already drawn into it: deployment zones, dropsites with their Features, scenery,
measurement arrows and inch labels. Nothing on top is vector, so there is no
drawing to lift; the picture itself is the map. It comes out byte-for-byte at the
resolution the book shipped: 1123px square in Scenario Expansion 1, 562px in
Civilian Ships & Scenarios, and only 240px in the rulebook.

A map is paired with its scenario by the title printed above it, matched against
the names already transcribed into scenarios/dropfleet/index.html. Anything that
fails to pair is reported rather than guessed.
"""
import io
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit('PyMuPDF required:  pip install pymupdf')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDFS = os.path.join(ROOT, 'Rules-Mechanics-PDFs')
OUT = os.path.join(ROOT, 'assets', 'scenarios', 'dropfleet')
GEN = os.path.join(ROOT, 'scenarios', 'dropfleet', 'index.html')

SOURCES = [
    ('A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf', 'Rulebook'),
    ('Scenario_Expansion_1_250818.pdf', 'Scenario Expansion 1'),
    ('Civilian_Ships_Scenarios_260901.pdf', 'Civilian Ships & Scenarios'),
]


def norm(t):
    return re.sub(r'[^a-z0-9]', '', t.lower())


def scenario_names():
    src = io.open(GEN, encoding='utf-8').read()
    pairs = re.findall(r"\{id:'([^']+)', name:'((?:[^'\\]|\\.)*)', src:'([^']+)'", src)
    return [(i, n.replace("\\'", "'"), s) for i, n, s in pairs]


def map_rects(page):
    """Square pictures smaller than the page are maps; the page background is not."""
    found = []
    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info['bbox'])
        if 100 < r.width < page.rect.width * 0.8 and abs(r.width - r.height) < 3:
            found.append((r, info['xref']))
    return sorted(found, key=lambda t: (round(t[0].y0), t[0].x0))


def main():
    os.makedirs(OUT, exist_ok=True)
    wanted = scenario_names()
    by_src = {}
    for sid, name, src in wanted:
        by_src.setdefault(src, []).append((sid, name))

    done, sizes = {}, {}
    for filename, src in SOURCES:
        names = by_src.get(src, [])
        doc = fitz.open(os.path.join(PDFS, filename))
        for pno, page in enumerate(doc):
            maps = map_rects(page)
            if not maps:
                continue
            titles = []
            for b in page.get_text('blocks'):
                n = norm(b[4])
                for sid, name in names:
                    if sid not in done and n.startswith(norm(name)):
                        titles.append((b[3], b[1], sid, name))
            for rect, xref in maps:
                above = [t for t in titles if t[1] <= rect.y0 + 24 and t[2] not in done]
                if not above:
                    continue
                _, _, sid, name = max(above, key=lambda t: t[1])
                pix = fitz.Pixmap(doc, xref)
                if pix.alpha or pix.n > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                path = os.path.join(OUT, sid + '.webp')
                from PIL import Image
                Image.frombytes('RGB', (pix.width, pix.height), pix.samples).save(path, 'WEBP', quality=88, method=6)
                done[sid] = (src, pno + 1, pix.width)
                sizes[sid] = os.path.getsize(path)
                titles = [t for t in titles if t[2] != sid]
        doc.close()

    for sid, name, src in wanted:
        if sid in done:
            s, p, w = done[sid]
            print('  %-28s %-28s p%-3d %4dpx %4d KB' % (sid, s, p, w, sizes[sid] // 1024))
    missing = [(sid, name, src) for sid, name, src in wanted if sid not in done]
    print('\n%d of %d scenarios have a map -> %s' % (len(done), len(wanted), os.path.relpath(OUT, ROOT)))
    for sid, name, src in missing:
        print('  no map paired: %s (%s, %s)' % (sid, name, src))


if __name__ == '__main__':
    main()
