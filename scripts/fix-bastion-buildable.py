#!/usr/bin/env python3
"""Fix the BUILDABLE Bioficer Bastion Battleship (groups[]), which had been given
the AGENCY FLAGSHIP Bastion's numbers by mistake (the classic buildable-vs-flagship
mix-up). Per the Bioficer 260529 PDF the two are DIFFERENT ships:

  Buildable Bastion (p57):  225 pts, BS 5+, Gravitic Hyperlance (Arrest-2), Torpedo
                            is an optional +20 upgrade.
  Agency flagship (p6):     245 pts ship, BS 4+, Gravitic Hyperspear (Arrest-4),
                            Torpedo baked in.  <- correct, DO NOT touch.

This only rewrites groups[] entries named "Bastion Battleship"; the flagship lives
in admirals[].flagship and is left untouched. Idempotent.
"""
import json

CORRECT = {'cost': 225, 'bs': '5+', 'weapon_from': 'Gravitic Hyperspear',
           'weapon_to': 'Gravitic Hyperlance', 'arrest_from': 'Arrest-4', 'arrest_to': 'Arrest-2'}

def fix_ship(s):
    changed = []
    if s.get('cost') != CORRECT['cost']:
        changed.append(f"cost {s.get('cost')}->{CORRECT['cost']}"); s['cost'] = CORRECT['cost']
    if s.get('stats', {}).get('bs') != CORRECT['bs']:
        changed.append(f"bs {s['stats'].get('bs')}->{CORRECT['bs']}"); s['stats']['bs'] = CORRECT['bs']
    for w in s.get('weapons', []):
        if w.get('name') == CORRECT['weapon_from']:
            w['name'] = CORRECT['weapon_to']; changed.append('weapon->Hyperlance')
        if CORRECT['arrest_from'] in (w.get('special') or ''):
            w['special'] = w['special'].replace(CORRECT['arrest_from'], CORRECT['arrest_to']); changed.append('Arrest-4->Arrest-2')
    return changed

def bioficer_groups(d):
    if 'groups' in d:
        return d['groups']
    return d.get('factions', {}).get('bioficer', {}).get('groups', [])

for fp in ['data/faction-bioficer.json', 'data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    hits = []
    for g in bioficer_groups(d):
        if g.get('name') == 'Bastion Battleship' and isinstance(g.get('ship'), dict):
            c = fix_ship(g['ship'])
            if c:
                hits.append(c)
    if hits:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    print(fp, '->', hits or 'no change')
print('DONE (flagship in admirals[] left untouched)')
