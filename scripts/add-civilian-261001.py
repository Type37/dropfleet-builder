#!/usr/bin/env python3
"""Ingest Civilian_Ships_Scenarios_261001 (TTCombat, 1 Oct 2026).

Page-diffing it against 260901 gives one new card and one cosmetic change:

  p10  PSC Interdictor, 48 pts (Mercenary, all six fleets)
  p6   MK Mass Transporter: the BS column now prints "-" instead of "N/A"

Every other page is unchanged apart from moving down one page.

The Interdictor follows the cross-faction "Misc Ships" convention (see
add-civilian-260801.py / add-260828-content.py): stored in every faction file with
additional: true; Boardable dropped from its Special column like every other civilian
hull; Mercenary keeps its verbatim clause. Rapid Drop, Rare and Vectored are reused
from the faction files rather than retyped. Stats, weapon, load, rules and lore are
verbatim from page 10. Crippling-Navigation Offline only applies on Weapons Free, so
it lives in the UF-2800i rule text, not in the weapon's Special column.

Idempotent: re-running replaces the group rather than duplicating it.

    PYTHONUTF8=1 python scripts/add-civilian-261001.py
"""
import glob
import hashlib
import io
import json
import os

import fitz
from PIL import Image

LF, CRLF = chr(10), chr(13) + chr(10)
FACTIONS = sorted(glob.glob('data/faction-*.json'))
PDF = 'Rules-Mechanics-PDFs/Civilian_Ships_Scenarios_261001.pdf'
ART = 'assets/art/psc_interdictor.webp'


def mkid(faction, name):
    h = hashlib.md5(f"ingest:{faction}:{name}".encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"


def save(fp, data, indent):
    """Keep the file's own line endings (PHR and Scourge are CRLF, the rest LF)."""
    crlf = CRLF.encode() in open(fp, 'rb').read(200)
    text = json.dumps(data, indent=indent, ensure_ascii=False)
    if crlf:
        text = text.replace(LF, CRLF)
    open(fp, 'w', encoding='utf-8', newline='').write(text)


def detect_indent(fp):
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
    return len(line) - len(line.lstrip(' ')) or 1


def glossary(paths):
    """name -> rule object, from every faction file (Rapid Drop is only in two)."""
    out = {}

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get('name'), str) and isinstance(o.get('description'), str):
                out.setdefault(o['name'], {k: v for k, v in o.items()
                                           if k in ('name', 'description', 'page', 'publicationId')})
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    for fp in paths:
        walk(json.load(open(fp, encoding='utf-8')))
    return out


GLOSS = glossary(FACTIONS)


def rule(name):
    return dict(GLOSS[name])


UF2800I = ("While this Group is on the Max Thrust Order, it may attack with one Weapon System. "
           "While this Group is on the Weapons Free Order, its UF-2800i Interdiction Mass Drivers "
           "have Crippling-Navigation Offline.")

LORE = (
    "The Colonial Fleet Penal Corps GH-Type Interdictor is a mainstay of inter-system policing and target "
    "acquisition. This fast attack craft is built to chase down fleeing criminal elements and as quickly and "
    "safely as possible, disable engines and deliver preliminary boarding parties before more specialised forces "
    "arrive to take the target into custody. Colloquially known as Gazehounds, these pack hunters are brutally "
    "efficient at intercepting fleeing ships, impacts from their custom mass drivers cause small EM pulses that "
    "stall engines and knock out reactors. While smaller than other turrets produced by the Olympus Fleet Yards, "
    "these UF-2800 variants have inbuilt capacitors, allowing the ship itself to put full power to the engines "
    "while also having weapons ready to fire. Alternatively, when all power is put into weapon systems, these "
    "capacitors add to the power coursing through the weapon, delivering a far more potent shot and clipping the "
    "wings of any criminal foolish enough to be in its sights."
)


def build_interdictor():
    return {
        "id": mkid('civilian', 'PSC Interdictor'),
        "name": "PSC Interdictors",
        "category": "light",
        "ship": {
            "name": "PSC Interdictor",
            "cost": 48,
            "stats": {"thrust": "9\"", "scan": "6\"", "sig": "4\"", "hull": 4, "es": "4+",
                      "ks": "4+", "bs": "-", "g": "2-4", "special": "Rapid Drop, Rare, Vectored"},
            "weapons": [
                {"name": "UF-2800i Interdiction Mass Drivers", "arc": "F/S", "attack": "2", "lock": "3+",
                 "damage": "1", "type": "K", "special": "Arrest-4, Scald-1"},
            ],
            "loads": [
                {"name": "Boarding Pods", "launch": "1", "special": "-"},
            ],
            "specialRules": [
                rule("Rapid Drop"),
                rule("Rare"),
                rule("Vectored"),
                {"name": "UF-2800i Interdiction Mass Drivers", "description": UF2800I},
                {"name": "Mercenary",
                 "description": "This Ship may be used in any Fleet regardless of faction. When taken as part of "
                                "your fleet, this Ship loses its Boardable rule."},
            ],
            "groupMin": 2,
            "groupMax": 4,
            "isRare": True,
            "isUnique": False,
            "tonnage": "L",
            "additional": True,
            "famousShipsPrefix": "Infamous Ships of the Class:",
            "famousShips": ["Whippet", "Borzoi", "Shin Kicker", "Stay Put"],
            "lore": LORE,
        },
    }


def insert_after(groups, marker, entry):
    groups = [g for g in groups if g['id'] != entry['id']]
    for i, g in enumerate(groups):
        if g['name'].startswith(marker):
            groups.insert(i + 1, entry)
            return groups, f'after {g["name"]}'
    groups.append(entry)
    return groups, 'appended'


def cut_art():
    """The ship picture from page 10, with its transparency (same method as build-civilian-ships.py)."""
    doc = fitz.open(PDF)
    page = doc[9]
    xref = 66
    smask = next(i[1] for i in page.get_images(full=True) if i[0] == xref)
    pix = fitz.Pixmap(doc, xref)
    if pix.n > 3 or pix.alpha:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if smask:
        m = fitz.Pixmap(doc, smask)
        im.putalpha(Image.frombytes('L', (m.width, m.height), m.samples).resize(im.size, Image.LANCZOS))
    im.save(ART, 'WEBP', quality=88, method=6)
    print(f'{ART}: {im.size[0]}x{im.size[1]}')


def object_span(text, inner):
    """Start and end of the JSON object that directly encloses position `inner`."""
    depth, i, in_str = 0, inner, False
    while True:  # walk back to the unmatched '{'
        i -= 1
        c = text[i]
        if c == '"' and text[i - 1] != '\\':
            in_str = not in_str
        elif not in_str and c == '}':
            depth += 1
        elif not in_str and c == '{':
            if depth == 0:
                break
            depth -= 1
    start, depth, j, in_str = i, 0, i, False
    while True:
        c = text[j]
        if c == '"' and text[j - 1] != '\\':
            in_str = not in_str
        elif not in_str and c == '{':
            depth += 1
        elif not in_str and c == '}':
            depth -= 1
            if depth == 0:
                return start, j + 1
        j += 1


def insert_text(fp, entry):
    """Insert the group as text after the MK group, so hand-formatted lines elsewhere in
    the file are left exactly as they are. Also fixes the MK's BS column."""
    raw = open(fp, encoding='utf-8', newline='').read()
    nl = CRLF if CRLF in raw[:200] else LF
    text = raw.replace(CRLF, LF)
    if f'"id": "{entry["id"]}"' in text:
        return 'already present'
    s, e = object_span(text, text.index('"name": "MK Mass Transporters"'))
    mk = text[s:e].replace('"bs": "N/A"', '"bs": "-"')
    line_start = text.rfind(LF, 0, s) + 1
    pad = text[line_start:s]
    step = detect_indent(fp)
    body = json.dumps(entry, indent=step, ensure_ascii=False).replace(LF, LF + pad)
    text = text[:s] + mk + ',' + LF + pad + body + text[e:]
    json.loads(text)  # still valid
    open(fp, 'w', encoding='utf-8', newline='').write(text.replace(LF, nl))
    return 'after MK Mass Transporters'


for fp in FACTIONS:
    where = insert_text(fp, build_interdictor())
    n = len(json.load(open(fp, encoding='utf-8'))['groups'])
    print(f'{fp}: PSC Interdictors {where}; groups now {n}')

# Landing-page ship counts
idx_fp = 'data/fleet-index.json'
idx_indent = detect_indent(idx_fp)
idx = json.load(open(idx_fp, encoding='utf-8'))
for key, fac in idx['factions'].items():
    fac['shipCount'] = len(json.load(open(f'data/faction-{key}.json', encoding='utf-8'))['groups'])
save(idx_fp, idx, idx_indent)
print('fleet-index shipCount:', {k: v['shipCount'] for k, v in idx['factions'].items()})

cut_art()
