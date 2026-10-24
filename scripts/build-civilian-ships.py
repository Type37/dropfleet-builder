#!/usr/bin/env python3
"""Every Civilian Ship from Civilian Ships & Scenarios, for the Civilian Ship picker on the scenario pages.

    PYTHONUTF8=1 python scripts/build-civilian-ships.py [path/to/Civilian_Ships_Scenarios_YYMMDD.pdf]

The PDF (page 2): "The Civilian Ships in these scenarios can be represented by any of the stat sheets presented in
this document. While they were designed with the Princess Liner in mind, players may want to use a different
Civilian Ship". So the scenario pages show the Princess Liner and let a player switch to any of the 21.

The ship list and its order come from the PDF itself, so a new edition needs no edits here. Ships with points
are buildable Miscellaneous Ships already in data/fleet-data.json: their stats, weapons, launch loads, special
rules and lore come from there. The Scenario Only ships (no points) are listed below, verbatim; their page and
picture are found by name. A Scenario Only ship not listed below stops the build, so it gets added by a person
(or by Claude in the weekly run), never guessed. Writes scenarios/dropfleet/scenario-civilian.js.
"""
import io, json, os, re, sys
import fitz
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, 'Rules-Mechanics-PDFs')
OUT = os.path.join(ROOT, 'scenarios', 'dropfleet', 'scenario-civilian.js')
ART = os.path.join(ROOT, 'assets', 'art')

# Buildable ships whose picture is not simply named after the ship.
ART_OVERRIDES = {
    'M.A.B. 67 Fuel Transport': 'mab_67_fuel_transport.webp',
    'EX-7 Packet Runner': 'ex7_packet_runner.webp',
    'Jah’tar Startrader': 'jahetar_startrader.webp',
}

# The Scenario Only ships, as printed (tonnage, stats, special, weapons)
SCENARIO_ONLY = {
    'L-Type Barge': ('L', ['10”', '4”', '3”', 4, '3+', '6+', '5+', '1'], 'Descent, Boardable, Civilian Transport',
                     [['Asteroid Clearance Laser', 'F/S/R', '2', '4+', '1', 'E', 'Close Action']]),
    'Nirvana': ('L', ['9”', '4”', '3”', 6, '4+', '6+', '-', '1'], 'Blooming, Boardable, Civilian Transport',
                [['Asteroid Clearance Laser', 'F/S/R', '2', '4+', '1', 'E', 'Close Action']]),
    'Precedent One': ('L', ['9”', '4”', '3”', 6, '4+', '6+', '-', '1'], 'Blooming, Boardable, Civilian Transport, Elite Fighter Escort',
                      [['Deterrence Missiles', 'F/S', '4', '3+', '1', 'K', 'Close Action']]),
    'Affluence Liner': ('M', ['14”', '6”', '3”', 12, '4+', '5+', '-', '1'], 'Descent, Cloak-1, Boardable, Civilian Transport, Elite Fighter Escort, Unique',
                        [['Deterrence Missiles', 'F/S', '4', '3+', '1', 'K', 'Close Action']]),
    'Princess Liner': ('M', ['10”', '4”', '3”', 12, '4+', '5+', '-', '1'], 'Descent, Cloak-1, Boardable, Civilian Transport',
                       [['Asteroid Clearance Laser', 'F/S/R', '2', '4+', '1', 'E', 'Close Action']]),
}

# Page 2's rules for Civilian Ships, verbatim
CIVILIAN_RULES = {
    'Civilian Transport': ['This Ship can only choose the General Quarters order.',
                           'This Ship cannot be attacked unless it is controlled by a player. Players cannot attack a friendly Civilian Transport.',
                           'This Ship cannot be the target of Abilities.'],
    'Boardable': ['This Ship can have Battalions Assigned to it as if it were a Space Station.',
                  'At the start of the round, this Ship is controlled by a Player if only they have any Battalions on it, lasting until the end of the round.',
                  'Players that control a Boardable Ship may activate it as if it were a Ship in their Fleet, after all other Groups have activated.'],
    'Blooming': ['Other friendly Ships within 6” of this Ship are Hidden within its Bloom. Enemy Ships attacking these Hidden Ships ignore 2 of their Group’s Spikes when measuring weapons range.',
                 'This special rule ceases to function while this Ship is not controlled.'],
    'Elite Fighter Escort': ['At the start of each round, this Ship gains 3 Elite Fighter Tokens. Before rolling Kinetic or Energy saves against Close Action and Bomber (of any type) attacks for this ship, you may declare the use of any number of Elite Fighter Tokens.',
                             'Each token used causes this Ship to automatically succeed your choice of 2 of those Energy or Kinetic saves without rolling those dice.'],
}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def pdf_page(doc, pno):
    """The page's text as paragraphs. PyMuPDF splits a paragraph into several blocks (a justified last line
    becomes its own block), so blocks that touch vertically are joined; a gap between them starts a new paragraph."""
    blocks = sorted([b for b in doc[pno - 1].get_text('blocks') if b[4].strip()], key=lambda b: (round(b[1]), b[0]))
    paras, bottom = [], None
    for b in blocks:
        text = ' '.join(b[4].split())
        if paras and b[1] <= bottom + 4:
            paras[-1] += ' ' + text
        else:
            paras.append(text)
        bottom = b[3]
    return paras


def scenario_only(doc, name):
    tonnage, st, special, weapons = SCENARIO_ONLY[name]
    pno = next(i + 1 for i, pg in enumerate(doc) if title(pg) == name)
    blocks = pdf_page(doc, pno)
    famous_i = next(i for i, b in enumerate(blocks) if re.match(r'(Known ships of the class|Only Ship of the Class):', b))
    prefix, ships = blocks[famous_i].split(':', 1)
    lore = blocks[famous_i + 1:]
    assert lore and blocks[0].startswith(name), (name, blocks[:2])
    # the picture, with its transparency
    page = doc[pno - 1]
    xref, smask = ship_picture(page)
    pix = fitz.Pixmap(doc, xref)
    if pix.n > 3 or pix.alpha:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if smask:
        # the soft mask can be stored at a different size from the picture
        m = fitz.Pixmap(doc, smask)
        im.putalpha(Image.frombytes('L', (m.width, m.height), m.samples).resize(im.size, Image.LANCZOS))
    art = slug(name) + '.webp'
    im.save(os.path.join(ART, art), 'WEBP', quality=88, method=6)
    return {
        'name': name, 'cost': None, 'tonnage': tonnage, 'art': art,
        'stats': dict(zip(['thrust', 'scan', 'sig', 'hull', 'es', 'ks', 'bs', 'g'], st), special=special),
        'weapons': [dict(zip(['name', 'arc', 'attack', 'lock', 'damage', 'type', 'special'], w)) for w in weapons],
        'loads': [], 'rules': [{'name': r, 'text': ''} for r in [x.strip() for x in special.split(',')]],
        'famousPrefix': prefix.strip() + ':', 'famous': [s.strip() for s in ships.split(',') if s.strip()],
        'lore': lore,
    }


def buildable(data, name, art):
    rec = None
    for f in data['factions'].values():
        for g in f.get('groups', []):
            s = g.get('ship') or {}
            if s.get('name') == name:
                rec = s
                break
        if rec:
            break
    if not rec:
        sys.exit('fleet-data.json has no %s' % name)
    if not os.path.exists(os.path.join(ART, 'thumb', art)):
        sys.exit('missing art thumb %s' % art)
    return {
        'name': name, 'cost': rec.get('cost'), 'tonnage': rec.get('tonnage'), 'art': art,
        'stats': rec['stats'], 'weapons': rec.get('weapons', []), 'loads': rec.get('loads', []),
        'rules': [{'name': r['name'], 'text': r.get('description', '')} for r in rec.get('specialRules', [])],
        'famousPrefix': rec.get('famousShipsPrefix') or '', 'famous': rec.get('famousShips') or [],
        'lore': [p.strip() for p in re.split(r'\n\s*\n|\n', rec.get('lore') or '') if p.strip()],
    }


def title(page):
    """A ship page's title: its first line, when the page carries a stat table."""
    text = page.get_text()
    if 'Thrust' not in text or 'Scan' not in text:
        return None
    return text.strip().splitlines()[0].strip()


def ship_picture(page):
    """(xref, smask) of the largest picture that is not the page background."""
    area = page.rect.width * page.rect.height
    best = None
    for img in page.get_images(full=True):
        rects = page.get_image_rects(img[0])
        if not rects or rects[0].width * rects[0].height > 0.7 * area:
            continue
        size = rects[0].width * rects[0].height
        if best is None or size > best[0]:
            best = (size, img[0], img[1])
    return best[1], best[2]


def ship_order(doc, data):
    """[(name, art or None)] in the PDF's order. None means Scenario Only."""
    known = {s.get('name') for f in data['factions'].values() for g in f.get('groups', []) for s in [g.get('ship') or {}]}
    order = []
    for page in doc:
        name = title(page)
        if not name or name in [n for n, _ in order]:
            continue
        if name in known:
            order.append((name, ART_OVERRIDES.get(name, slug(name) + '.webp')))
        elif name in SCENARIO_ONLY:
            order.append((name, None))
        else:
            sys.exit('%s (page %d) is neither in fleet-data.json nor in SCENARIO_ONLY' % (name, page.number + 1))
    return order


def newest_pdf():
    found = sorted(f for f in os.listdir(PDF_DIR) if re.match(r'Civilian_Ships_Scenarios_\d{6}\.pdf$', f))
    if not found:
        sys.exit('No Civilian_Ships_Scenarios_YYMMDD.pdf in ' + PDF_DIR)
    return os.path.join(PDF_DIR, found[-1])


def main():
    doc = fitz.open(sys.argv[1] if len(sys.argv) > 1 else newest_pdf())
    data = json.load(io.open(os.path.join(ROOT, 'data', 'fleet-data.json'), encoding='utf-8'))
    ships = [scenario_only(doc, n) if art is None else buildable(data, n, art) for n, art in ship_order(doc, data)]
    js = ('// Generated by scripts/build-civilian-ships.py. Verbatim; do not edit by hand.\n'
          'const SCN_CIVILIAN={ships:%s,rules:%s};\n' % (json.dumps(ships, ensure_ascii=False), json.dumps(CIVILIAN_RULES, ensure_ascii=False)))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
    for s in ships:
        print('  %-28s %4s pts  %d lore paragraphs  %s' % (s['name'], s['cost'] if s['cost'] is not None else '-', len(s['lore']), s['art']))
    print('%d ships -> %s (%d KB)' % (len(ships), os.path.relpath(OUT, ROOT), len(js.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
