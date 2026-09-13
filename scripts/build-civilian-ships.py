#!/usr/bin/env python3
"""Every Civilian Ship from Civilian Ships & Scenarios, for the Civilian Ship picker on the scenario pages.

    PYTHONUTF8=1 python scripts/build-civilian-ships.py

The PDF (page 2): "The Civilian Ships in these scenarios can be represented by any of the stat sheets presented in
this document. While they were designed with the Princess Liner in mind, players may want to use a different
Civilian Ship". So the scenario pages show the Princess Liner and let a player switch to any of the 20.

15 of them are buildable Miscellaneous Ships already in data/fleet-data.json: their stats, weapons, launch
loads, special rules and lore come from there. The 5 Scenario Only ships (no points) are read from the PDF
here, verbatim, and their pictures taken from it. Writes scenarios/dropfleet/scenario-civilian.js.
"""
import io, json, os, re, sys
import fitz
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'Rules-Mechanics-PDFs', 'Civilian_Ships_Scenarios_260901.pdf')
OUT = os.path.join(ROOT, 'scenarios', 'dropfleet', 'scenario-civilian.js')
ART = os.path.join(ROOT, 'assets', 'art')

# PDF order (pages 3-22). Buildable ships: (name, art thumb). Scenario Only: (name, None) with a PDF block below.
ORDER = [
    ('Hyperyacht Somniferum', 'hyperyacht_somniferum.webp'), ('L-Type Barge', None), ('LKS Dredger', 'lks_dredger.webp'),
    ('MK Mass Transporter', 'mk_mass_transporter.webp'), ('M.A.B. 67 Fuel Transport', 'mab_67_fuel_transport.webp'),
    ('Nirvana', None), ('Precedent One', None), ('SLM-9 Resupply Hauler', 'slm_9_resupply_hauler.webp'),
    ('T-Type Tugboat', 't_type_tugboat.webp'), ('EX-7 Packet Runner', 'ex7_packet_runner.webp'), ('Affluence Liner', None),
    ('DH-Type Penal Transport', 'dh_type_penal_transport.webp'), ('Jah’tar Startrader', 'jahetar_startrader.webp'),
    ('M-Type Barge', 'm_type_barge.webp'), ('Princess Liner', None), ('OBV-64 Oblivion Barge', 'obv_64_oblivion_barge.webp'),
    ('Argonaut', 'argonaut.webp'), ('Type-87 Terminus Harvester', 'type_87_terminus_harvester.webp'),
    ('VX-22 Flenser', 'vx_22_flenser.webp'), ('PRK-91 Provenance Ark', 'prk_91_provenance_ark.webp'),
]

# The Scenario Only ships, as printed (page, picture xref, tonnage, stats, special, weapons)
SCENARIO_ONLY = {
    'L-Type Barge': (4, 16, 'L', ['10”', '4”', '3”', 4, '3+', '6+', '5+', '1'], 'Descent, Boardable, Civilian Transport',
                     [['Asteroid Clearance Laser', 'F/S/R', '2', '4+', '1', 'E', 'Close Action']]),
    'Nirvana': (8, 44, 'L', ['9”', '4”', '3”', 6, '4+', '6+', '-', '1'], 'Blooming, Boardable, Civilian Transport',
                [['Asteroid Clearance Laser', 'F/S/R', '2', '4+', '1', 'E', 'Close Action']]),
    'Precedent One': (9, 50, 'L', ['9”', '4”', '3”', 6, '4+', '6+', '-', '1'], 'Blooming, Boardable, Civilian Transport, Elite Fighter Escort',
                      [['Deterrence Missiles', 'F/S', '4', '3+', '1', 'K', 'Close Action']]),
    'Affluence Liner': (13, 73, 'M', ['14”', '6”', '3”', 12, '4+', '5+', '-', '1'], 'Descent, Cloak-1, Boardable, Civilian Transport, Elite Fighter Escort, Unique',
                        [['Deterrence Missiles', 'F/S', '4', '3+', '1', 'K', 'Close Action']]),
    'Princess Liner': (17, 98, 'M', ['10”', '4”', '3”', 12, '4+', '5+', '-', '1'], 'Descent, Cloak-1, Boardable, Civilian Transport',
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
    pno, xref, tonnage, st, special, weapons = SCENARIO_ONLY[name]
    blocks = pdf_page(doc, pno)
    famous_i = next(i for i, b in enumerate(blocks) if re.match(r'(Known ships of the class|Only Ship of the Class):', b))
    prefix, ships = blocks[famous_i].split(':', 1)
    lore = blocks[famous_i + 1:]
    assert lore and blocks[0].startswith(name), (name, blocks[:2])
    # the picture, with its transparency
    page = doc[pno - 1]
    smask = next(i[1] for i in page.get_images(full=True) if i[0] == xref)
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


def main():
    doc = fitz.open(PDF)
    data = json.load(io.open(os.path.join(ROOT, 'data', 'fleet-data.json'), encoding='utf-8'))
    ships = [scenario_only(doc, n) if art is None else buildable(data, n, art) for n, art in ORDER]
    js = ('// Generated by scripts/build-civilian-ships.py. Verbatim; do not edit by hand.\n'
          'const SCN_CIVILIAN={ships:%s,rules:%s};\n' % (json.dumps(ships, ensure_ascii=False), json.dumps(CIVILIAN_RULES, ensure_ascii=False)))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
    for s in ships:
        print('  %-28s %4s pts  %d lore paragraphs  %s' % (s['name'], s['cost'] if s['cost'] is not None else '-', len(s['lore']), s['art']))
    print('%d ships -> %s (%d KB)' % (len(ships), os.path.relpath(OUT, ROOT), len(js.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
