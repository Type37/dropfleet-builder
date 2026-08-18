#!/usr/bin/env python3
"""Cut TTCombat's Dropfleet token sheet into one SVG per token.

    python scripts/extract-tokens.py

The sheet (Rules-Mechanics-PDFs/Dropfleet_Downloadable_Tokens.pdf, from the official
downloads page and tracked in scripts/dfc-files-manifest.json) is pure vector on a
regular 8-column grid, so each token can come out as real paths rather than a
screenshot: crisp at any size, a couple of KB each, and no raster to re-export when
a layout changes.

PyMuPDF's own show_pdf_page/get_svg_image route was tried first and is unusable here
— it embeds the WHOLE source page behind a clip, so every one-token file came out at
300 KB carrying all 534 drawings. So this walks page.get_drawings(), keeps the shapes
whose bounding box falls inside a token's cell, and re-emits them as a fresh SVG
translated to a local origin. Output is ~1-4 KB per token.
"""
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit('PyMuPDF required:  pip install pymupdf')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Rules-Mechanics-PDFs', 'Dropfleet_Downloadable_Tokens.pdf')
OUT = os.path.join(ROOT, 'assets', 'tokens')

# Grid centres, measured off the sheet's token backgrounds (8 columns x 12 rows).
COL_X = [57.0, 125.8, 194.5, 263.2, 332.0, 400.7, 469.5, 538.6]
ROW_Y = [53.9, 119.1, 186.1, 251.7, 319.1, 385.0, 451.2, 517.5, 582.4, 647.3, 710.8, 775.7]
HALF = 32.0        # token radius; cells are ~68pt apart so this leaves a clean gutter

# (row, col, filename, aria label). Duplicate columns on the sheet are skipped.
WANTED = [
    # Spike tokens — one disc that fills from the bottom, a band per Spike.
    (0, 0, 'spike-1', '1 Spike'),
    (0, 1, 'spike-2', '2 Spikes'),
    (0, 2, 'spike-3', '3 Spikes'),
    (0, 3, 'spike-4', '4 Spikes'),
    # Crippling Effects (rulebook 7.3.6), plus the Atmosphere marker.
    (2, 0, 'status-fire', 'On Fire'),
    (2, 2, 'status-scanners-offline', 'Scanners Offline'),
    (2, 3, 'status-weapons-offline', 'Weapons Offline'),
    (2, 4, 'status-defence-systems-offline', 'Defence Systems Offline'),
    (2, 5, 'status-navigation-offline', 'Navigation Offline'),
    (2, 6, 'status-orbital-decay', 'Orbital Decay'),
    (2, 7, 'status-in-atmosphere', 'In Atmosphere'),
    # Dropsite Features.
    (5, 0, 'dropsite-military-outpost', 'Military Outpost'),
    (5, 2, 'dropsite-orbital-defence-gun', 'Orbital Defence Gun'),
    (5, 4, 'dropsite-comms-station', 'Comms Station'),
    (5, 5, 'dropsite-hangar', 'Hangar'),
    (5, 6, 'dropsite-power-plant', 'Power Plant'),
    (5, 7, 'dropsite-city', 'City'),
]


def num(v):
    """Trim coordinates to 2dp and drop trailing zeros — this alone roughly halves
    the file, and the tokens are 64pt squares so 2dp is well below a rendered pixel."""
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'


def rgb(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)


def path_d(items, close, ox, oy):
    """Rebuild one drawing's path data, translated so the token sits at the origin."""
    out = []
    cur = None

    def pt(p):
        return num(p.x - ox), num(p.y - oy)

    for it in items:
        op = it[0]
        if op == 'l':
            p1, p2 = it[1], it[2]
            if cur is None or abs(cur.x - p1.x) > 1e-6 or abs(cur.y - p1.y) > 1e-6:
                out.append('M%s %s' % pt(p1))
            out.append('L%s %s' % pt(p2))
            cur = p2
        elif op == 'c':
            p1, p2, p3, p4 = it[1], it[2], it[3], it[4]
            if cur is None or abs(cur.x - p1.x) > 1e-6 or abs(cur.y - p1.y) > 1e-6:
                out.append('M%s %s' % pt(p1))
            out.append('C%s %s %s %s %s %s' % (pt(p2) + pt(p3) + pt(p4)))
            cur = p4
        elif op == 're':
            r = it[1]
            x0, y0 = num(r.x0 - ox), num(r.y0 - oy)
            out.append('M%s %sH%sV%sH%sZ' % (x0, y0, num(r.x1 - ox), num(r.y1 - oy), x0))
            cur = None
        elif op == 'qu':
            q = it[1]
            out.append('M%s %sL%s %sL%s %sL%s %sZ' % (pt(q.ul) + pt(q.ur) + pt(q.lr) + pt(q.ll)))
            cur = None
    if close and out:
        out.append('Z')
    return ''.join(out)


def build(page, cell, label):
    """Emit the SVG for one grid cell."""
    # Own a shape by its CENTRE, not by containment. The City and Atmosphere tokens
    # draw their art larger than the disc and let the PDF's clip path trim it, so a
    # "wholly inside" test threw four of their five shapes away and left a bare
    # circle. The disc is re-applied below as an SVG clipPath instead.
    mine = [dr for dr in page.get_drawings()
            if cell.contains(fitz.Point((dr['rect'].x0 + dr['rect'].x1) / 2,
                                        (dr['rect'].y0 + dr['rect'].y1) / 2))]
    # The token background is its largest shape; its box gives the clip geometry.
    bg = max((dr['rect'] for dr in mine), key=lambda r: r.width * r.height, default=cell)

    body = []
    for dr in mine:
        d = path_d(dr['items'], dr.get('closePath'), cell.x0, cell.y0)
        if not d:
            continue
        attrs = []
        fill = dr.get('fill')
        stroke = dr.get('color')
        attrs.append('fill="%s"' % (rgb(fill) if fill is not None else 'none'))
        if dr.get('even_odd'):
            attrs.append('fill-rule="evenodd"')
        if stroke is not None and dr.get('type') in ('s', 'fs'):
            attrs.append('stroke="%s"' % rgb(stroke))
            w = dr.get('width') or 1
            attrs.append('stroke-width="%s"' % num(w))
        fo = dr.get('fill_opacity')
        if fo is not None and fo < 1:
            attrs.append('fill-opacity="%s"' % num(fo))
        body.append('<path %s d="%s"/>' % (' '.join(attrs), d))

    size = num(cell.width)
    # Clip to the token's own outline, so overhanging art is trimmed the way the sheet
    # trims it. Round tokens take a circle, the square ones a rounded rect.
    ox, oy = bg.x0 - cell.x0, bg.y0 - cell.y0
    if abs(bg.width - bg.height) < 2 and bg.width > cell.width * 0.7:
        outline = '<circle cx="%s" cy="%s" r="%s"/>' % (
            num(ox + bg.width / 2), num(oy + bg.height / 2), num(bg.width / 2))
    else:
        outline = '<rect x="%s" y="%s" width="%s" height="%s" rx="%s"/>' % (
            num(ox), num(oy), num(bg.width), num(bg.height), num(bg.width * 0.12))
    cid = 'tk'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" role="img" aria-label="%s">'
        % (size, size, re.sub(r'[<>&"]', '', label))
        + '<clipPath id="%s">%s</clipPath><g clip-path="url(#%s)">' % (cid, outline, cid)
        + ''.join(body)
        + '</g></svg>\n'
    )


def main():
    if not os.path.exists(SRC):
        sys.exit('Missing %s\nDownload it from the URL in scripts/dfc-files-manifest.json.' % SRC)
    os.makedirs(OUT, exist_ok=True)
    doc = fitz.open(SRC)
    page = doc[0]
    total = 0
    for row, col, name, label in WANTED:
        cx, cy = COL_X[col], ROW_Y[row]
        cell = fitz.Rect(cx - HALF, cy - HALF, cx + HALF, cy + HALF)
        svg = build(page, cell, label)
        path = os.path.join(OUT, name + '.svg')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(svg)
        n = os.path.getsize(path)
        total += n
        print('  %-34s %5d bytes  %2d paths' % (name + '.svg', n, svg.count('<path')))
    doc.close()
    print('\n%d tokens, %.1f KB total -> %s' % (len(WANTED), total / 1024, os.path.relpath(OUT, ROOT)))


if __name__ == '__main__':
    main()
