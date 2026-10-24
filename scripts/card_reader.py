#!/usr/bin/env python3
"""Read every ship card in a TTCombat Dropfleet PDF into plain data.

Shared by auto-ingest.py. The stat table, weapons and loads come from
ingest_pdf.parse_page (the parser the weekly card audit already trusts). The rest
of the card is read by typography, which is the same on every sheet TTCombat
publishes:

    Arkhip, 11pt and up, below the table   a rule heading ("Mercenary")
    RobotoSlab-Light                        that rule's text
    RobotoSlab-Medium / -Bold ending ":"    "Known ships of the class:" and kin
    RobotoSlab-Thin                         the names after it, then the lore

Cards are keyed by ship name, never by page: a new card pushes every later page
down by one, and that must not read as every later ship having changed.

    python scripts/card_reader.py <pdf> [--page N]     # print what it read
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitz  # noqa: E402
from PIL import Image  # noqa: E402
from ingest_pdf import parse_page, _vnorm  # noqa: E402

LF = chr(10)


def _spans(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b['lines']:
            for s in ln['spans']:
                t = s['text']
                if t.strip():
                    out.append({'y': s['bbox'][1], 'x': s['bbox'][0], 'y1': s['bbox'][3],
                                'size': s['size'], 'font': s['font'], 'text': t})
    return out


def _join(lines):
    """Lines of one paragraph -> one string. A line ending in a hyphen joins tight."""
    out = ''
    for t in lines:
        t = t.strip()
        if not out:
            out = t
        elif out.endswith('-') and not out.endswith(' -'):
            out += t
        else:
            out += ' ' + t
    return re.sub(r'\s+', ' ', out).strip()


def _lines(spans):
    """Spans -> visual lines [(y, size, text)], top to bottom."""
    lines = []
    for s in sorted(spans, key=lambda s: (round(s['y']), s['x'])):
        if lines and abs(s['y'] - lines[-1][0]) < 2:
            y, size, t = lines[-1]
            lines[-1] = (y, size, t + ' ' + s['text'].strip())
        else:
            lines.append((s['y'], s['size'], s['text'].strip()))
    return lines


def _paragraphs(spans):
    """Group lines into paragraphs. TTCombat leaves ~1.2x the font size between
    lines of a paragraph and ~1.5x between paragraphs."""
    paras, cur, prev_y = [], [], None
    for y, size, t in _lines(spans):
        if prev_y is not None and y - prev_y > size * 1.4:
            paras.append(_join(cur))
            cur = []
        cur.append(t)
        prev_y = y
    if cur:
        paras.append(_join(cur))
    return [p for p in paras if p]


def read_card(page):
    """One page -> card dict, or None if the page is not a ship card with points."""
    text = page.get_text()
    if 'Thrust' not in text or 'Scan' not in text:
        return None
    parsed = parse_page(text)
    if not parsed or not parsed.get('name') or not parsed.get('stats'):
        return None
    spans = _spans(page)
    table_top = min((s['y'] for s in spans if s['font'].startswith('Arkhip') and s['text'].strip() == 'Thrust'),
                    default=0)

    # Text that is not the stat table (Regular) and not a heading (Arkhip).
    prose = [s for s in spans if not s['font'].startswith('Arkhip') and 'Regular' not in s['font']]
    heads = sorted([s for s in spans if s['font'].startswith('Arkhip') and s['size'] >= 11.5 and s['y'] > table_top],
                   key=lambda s: s['y'])
    label = next((s for s in prose if re.search(r'(of the class|individual)\s*:$', s['text'].strip(), re.I)), None)

    # Rules: each heading owns the text under it, down to the next heading or the
    # "... of the class:" line, whichever comes first. A rule is plain Light text;
    # anything else inside one (a bold ability name, an AP cost badge) is a layout
    # this reader does not model, so it is reported rather than dropped.
    rules, odd, used = [], [], set()
    for i, h in enumerate(heads):
        end = heads[i + 1]['y'] if i + 1 < len(heads) else 1e9
        if label and label['y'] > h['y']:
            end = min(end, label['y'])
        body = [s for s in prose if h['y'] - 2 <= s['y'] < end - 2]
        used.update(id(s) for s in body)
        rules.append({'name': h['text'].strip(), 'paragraphs': _paragraphs(body)})
        for s in body:
            if 'Light' not in s['font']:
                odd.append('%s: unread "%s"' % (h['text'].strip(), s['text'].strip()))

    # Below the label: the names (they may wrap onto a second line), then the lore.
    famous_prefix, famous, lore = '', [], []
    if label:
        famous_prefix = label['text'].strip()
        stop = min([h['y'] for h in heads if h['y'] > label['y']] or [1e9])
        below = [s for s in prose if s is not label and label['y'] - 2 <= s['y'] < stop - 2 and id(s) not in used]
        paras = _paragraphs(below)
        names = paras[0] if paras else ''
        famous = [n.strip() for n in re.split(r',(?![^()]*\))', names) if n.strip()]
        lore = paras[1:]
    else:
        lore = _paragraphs([s for s in prose if id(s) not in used])

    return {
        'page': page.number + 1,
        'name': parsed['name'],
        'parsed': parsed,
        'rules': rules,
        'famousPrefix': famous_prefix,
        'famous': famous,
        'lore': lore,
        'odd': odd,
        # What "this card changed" means: everything printed on it, whitespace-blind.
        'signature': re.sub(r'\s+', ' ', text).strip(),
    }


def read_pdf(path):
    """{normalised ship name: card} in page order (dicts keep insertion order)."""
    doc = fitz.open(path)
    cards = {}
    for page in doc:
        c = read_card(page)
        if c:
            cards[_vnorm(c['name'])] = c
    return cards


def cut_art(pdf_path, page_no, dest):
    """Save the card's ship picture (the largest image that is not the page
    background) as webp, keeping its transparency. Returns (width, height)."""
    doc = fitz.open(pdf_path)
    page = doc[page_no - 1]
    area = page.rect.width * page.rect.height
    best = None
    for img in page.get_images(full=True):
        xref, smask = img[0], img[1]
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        r = rects[0]
        if r.width * r.height > 0.7 * area or r.y0 > page.rect.height * 0.5:
            continue
        if best is None or r.width * r.height > best[2]:
            best = (xref, smask, r.width * r.height)
    if not best:
        return None
    xref, smask, _ = best
    pix = fitz.Pixmap(doc, xref)
    if pix.n > 3 or pix.alpha:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if smask:
        m = fitz.Pixmap(doc, smask)
        im.putalpha(Image.frombytes('L', (m.width, m.height), m.samples).resize(im.size, Image.LANCZOS))
    im.save(dest, 'WEBP', quality=88, method=6)
    return im.size


if __name__ == '__main__':
    pdf = sys.argv[1]
    only = int(sys.argv[sys.argv.index('--page') + 1]) if '--page' in sys.argv else None
    for c in read_pdf(pdf).values():
        if only and c['page'] != only:
            continue
        c = dict(c)
        c.pop('signature')
        print(json.dumps(c, ensure_ascii=False, indent=1))
