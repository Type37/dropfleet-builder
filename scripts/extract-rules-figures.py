#!/usr/bin/env python3
"""Cut the rulebook's instructional diagrams out of the PDF for the How to Play
wiki, one PNG per figure, each mapped to the section it illustrates.

    python scripts/extract-rules-figures.py

Only the diagrams the rules TEXT points at are taken (the ones whose meaning is
lost without the picture): Base Contact, Coherency, Weapon Arcs, Move and the
Explosion chain. Chapter splash art, the miniatures photos and the scenario
maps are deliberately left out. The token overview on page 8 is skipped too:
the Tokens section already shows each of those counters, labelled, as its own
vector (see scripts/extract-tokens.py).

Two kinds of figure live in this book and each needs a different cut:

  * RASTER — Base Contact (p8) and the Explosion chain (p19) are single embedded
    images on a white ground. Pulled straight out by xref, so they come through
    exactly as drawn.
  * VECTOR — Coherency (p10), Arcs (p11) and Move (p16) are drawn as lines and
    ship sprites inside a light-blue rounded frame, so there is no one image to
    pull. These are RENDERED from the page, clipped to the frame's own bounding
    box (measured, below), at 3x for a crisp result.

The section ids are the wiki's own (data/rules-wiki.json); app.js keys each
figure to its section by that id.
"""
import os
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF required: pip install pymupdf")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Rules-Mechanics-PDFs",
                   "A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf")
OUT = os.path.join(ROOT, "assets", "rules")

# name, section id, kind, spec.
#   raster: spec = xref;  vector: spec = (page, x0, y0, x1, y1) in PDF points.
# Everything is rendered from the page at high scale (crisp at large display
# sizes), clipped to the diagram's own rect. The raster diagrams (Base Contact,
# Explosion) are single embedded images, so their rect is the image placement;
# the vector diagrams are clipped to their blue frame.
FIGURES = [
    ("fig-base-contact", "2.3.1.1", "vector", (8,  22,  17, 395, 291)),
    ("fig-coherency",    "3.2.1.2", "vector", (10, 214, 211, 395, 470)),
    ("fig-arcs",         "3.4",     "vector", (11, 214,  17, 395, 221)),
    ("fig-move",         "7.2",     "vector", (16,  22, 192, 203, 573)),
    ("fig-explosion",    "7.3.7",   "vector", (19,  22, 402, 395, 574)),
]

PAD = 2          # points of margin around a diagram rect
SCALE = 3        # render scale (3x -> crisp when shown large)


def save_raster(doc, xref, path):
    pix = fitz.Pixmap(doc, xref)
    if pix.n > 4:                       # CMYK / with alpha -> RGB
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(path)
    return pix.width, pix.height


def save_vector(doc, spec, path):
    pno, x0, y0, x1, y1 = spec
    clip = fitz.Rect(x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD)
    pix = doc[pno - 1].get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=clip)
    pix.save(path)
    return pix.width, pix.height


def main():
    if not os.path.exists(SRC):
        sys.exit("Missing %s" % SRC)
    os.makedirs(OUT, exist_ok=True)
    doc = fitz.open(SRC)
    for name, sec, kind, spec in FIGURES:
        path = os.path.join(OUT, name + ".png")
        if kind == "raster":
            w, h = save_raster(doc, spec, path)
        else:
            w, h = save_vector(doc, spec, path)
        print("  %-20s %-9s %4dx%-4d  %6d bytes"
              % (name + ".png", sec, w, h, os.path.getsize(path)))
    doc.close()
    print("\n%d figures -> %s" % (len(FIGURES), os.path.relpath(OUT, ROOT)))


if __name__ == "__main__":
    main()
