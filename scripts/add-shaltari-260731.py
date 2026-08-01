# Shaltari Combined Fleet Stats 260731: adds the hero ship
# "Nefertem of the Dawn - Invisible Night" (the only change vs the 260327 edition).
# Modelled the same way as Avram Bei / Rhiannon Major: a Hero + Unique group ship,
# not an entry in admirals[] (the Hero rule forbids assigning an Admiral).
import json, io

PATH = 'data/faction-shaltari.json'
d = json.load(io.open(PATH, encoding='utf-8'))

NAME = 'Nefertem of the Dawn - Invisible Night'
d['groups'] = [g for g in d['groups'] if g.get('name') != NAME]

group = {
    "id": "7c31-9ad4-45e2-b118",
    "name": NAME,
    "category": "light",
    "ship": {
        "name": NAME,
        "cost": 81,
        "stats": {
            "thrust": "12”",
            "scan": "12”",
            "sig": "6”",
            "hull": 7,
            "es": "5+",
            "ks": "4+",
            "bs": "-",
            "g": "1",
            "special": "Cloak-2, Hero, Shield-5+, Stealth, Unique"
        },
        "weapons": [
            {
                "name": "Microwave Crescent",
                "arc": "F",
                "attack": "4",
                "lock": "3+",
                "damage": "1",
                "type": "C",
                "special": "Crippling-2xFire, Sustained Fire"
            }
        ],
        "loads": [],
        "specialRules": [
            {
                "name": "Cloak-2",
                "description": "This Group may have a maximum of 2 Spikes."
            },
            {
                "name": "Hero",
                "description": "You can only include two Groups with this special rule in your fleet. You cannot assign an Admiral to this Ship when building your fleet."
            },
            {
                "name": "Shield-5+",
                "description": None  # filled in below from an existing Shaltari ship
            },
            {
                "name": "Stealth",
                "description": "This Ship may fire one Weapon while Silent Running."
            },
            {
                "name": "Unique",
                "description": "You may only take one Group of this Ship."
            }
        ],
        "groupMin": 1,
        "groupMax": 1,
        "isRare": False,
        "isUnique": True,
        "tonnage": "L",
        "famousShipsPrefix": "Only ship of the class:",
        "famousShips": ["Invisible Night"],
        "lore": (
            "Stealth technology and camouflage in all its forms are abhorrent and dishonourable for most "
            "Shaltari, but Nefertem chose long ago to reject this notion. Her stance is that subterfuge and surprise "
            "attack are time-honoured, central tenets of battle and has chosen to master them. To that end, she "
            "commissioned a unique vessel.\n\n"
            "Invisible Light demonstrates that, of course, the Shaltari are perfectly capable of matching or "
            "exceeding the Scourge in stealth technology if they so wish. Of heavy destroyer tonnage, this vessel’s "
            "innocuous-looking additional frontal superstructure arms conceal this cloaking system as well as "
            "supporting the additional mass of its only weapons system. The thus-far unique Microwave Crescent "
            "is a long range, low-observable variant of typical microwave technology that can reach into the heart "
            "of any target, cooking its crew and delicate systems from the inside. Often, the victim has no idea "
            "where the burst came from and has little chance of returning fire."
        )
    }
}

# Reuse the Shield-5+ wording already carried by the rest of the fleet.
shield = None
for g in d['groups']:
    for sr in (g.get('ship') or {}).get('specialRules') or []:
        if sr['name'] == 'Shield-5+':
            shield = sr['description']
            break
    if shield:
        break
assert shield, 'Shield-5+ description not found'
for sr in group['ship']['specialRules']:
    if sr['name'] == 'Shield-5+':
        sr['description'] = shield

# Insert at the end of the faction-core block, before the mercenary/civilian ships.
idx = next(i for i, g in enumerate(d['groups']) if g['name'] == 'Voidgates') + 1
d['groups'].insert(idx, group)

with io.open(PATH, 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=1, ensure_ascii=False)
    f.write('\n')

json.load(io.open(PATH, encoding='utf-8'))
print('OK: inserted %s at index %d (%d groups)' % (NAME, idx, len(d['groups'])))
