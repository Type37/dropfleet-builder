# Add the Resistance "Engine Refit" upgrade to the 7 Grand Battleships. Per the
# Resistance Combined Fleet Stats PDF each may take an Engine Refit for +45 points,
# increasing its Thrust by 2" (NOTE: +2", not the +3" UCM/Shaltari use). Modelled as
# the same either/or loadoutOption the other drive refits use (index-based, statMods
# thrust:+2), in the faction file and the merged fleet-data mirror. "PDF is king."
import json, glob

SHIPS = {
    'Nelson Grand Battleship', 'Yi Sun-sin Grand Battleship', 'Barbarossa Grand Battleship',
    'Farragut Grand Battleship', 'Drake Grand Battleship', 'Nimitz Grand Battleship',
    'Yamamoto Grand Battleship',
}
RULES_TEXT = 'This Ship may take an Engine Refit for +45 points, increasing its Thrust by 2".'

def block():
    return {
        'name': 'Engine Refit',
        'minSelections': 1,
        'maxSelections': 1,
        'options': [
            {'name': 'No Engine Refit', 'cost': 0, 'weapons': [], 'loads': []},
            {'name': 'Engine Refit (+2" Thrust)', 'cost': 45,
             'weapons': [], 'loads': [], 'statMods': {'thrust': 2}},
        ],
    }

def has_block(s):
    return any(lo.get('name') == 'Engine Refit' for lo in s.get('loadoutOptions', []))

for fp in ['data/faction-resistance.json', 'data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = []
    def walk(o):
        if isinstance(o, dict):
            s = o.get('ship')
            if isinstance(s, dict) and o.get('name') in SHIPS:
                if not has_block(s):
                    s.setdefault('loadoutOptions', []).append(block())
                if not (s.get('rulesText') or '').strip():
                    s['rulesText'] = RULES_TEXT
                changed.append(o['name'])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if changed:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    print(fp.split('/')[-1], '->', len(changed), sorted(set(changed)))

print('missing:', SHIPS - set())
