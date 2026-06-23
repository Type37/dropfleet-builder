# Make Shaltari "Drive Augmentation" a selectable upgrade. The PDF gives 7 heavy
# capital ships the option ("This Ship may take a Drive Augmentation for +35 points,
# increasing its Thrust by 3\""), but our data only carried it as descriptive text on
# 2 of them and none as a pickable loadout. Add the same either/or loadoutOption the
# UCM Drive Refit uses (index-based, statMods thrust +3) to all 7, in the faction file
# and the merged fleet-data mirror. "PDF is king."
import json, glob

SHIPS = {
    'Diamond Battleship', 'Platinum Supercarrier', 'Gold Supercarrier',
    'Silver Battleship', 'Bronze Battleship', 'Copper Battleship', 'Iron Supercarrier',
}
RULES_TEXT = 'This Ship may take a Drive Augmentation for +35 points, increasing its Thrust by 3".'

def drive_aug_block():
    return {
        'name': 'Drive Augmentation',
        'minSelections': 1,
        'maxSelections': 1,
        'options': [
            {'name': 'No Drive Augmentation', 'cost': 0, 'weapons': [], 'loads': []},
            {'name': 'Drive Augmentation (+3" Thrust)', 'cost': 35,
             'weapons': [], 'loads': [], 'statMods': {'thrust': 3}},
        ],
    }

def has_drive_aug(s):
    return any((lo.get('name') == 'Drive Augmentation') for lo in s.get('loadoutOptions', []))

total = {}
for fp in ['data/faction-shaltari.json', 'data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = []
    def walk(o):
        if isinstance(o, dict):
            s = o.get('ship')
            if isinstance(s, dict) and o.get('name') in SHIPS:
                if not has_drive_aug(s):
                    s.setdefault('loadoutOptions', []).append(drive_aug_block())
                s['rulesText'] = RULES_TEXT  # normalise to the clean verbatim line
                changed.append(o['name'])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if changed:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    total[fp] = changed
    print(fp.split('/')[-1], '->', len(changed), sorted(set(changed)))

missing = SHIPS - set(total.get('data/faction-shaltari.json', []))
print('\nShips not found in faction file (should be empty):', missing)
