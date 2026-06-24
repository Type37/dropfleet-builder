# Add the Scourge keel/crest refits from the Scourge Combined Fleet Stats PDF.
# The engine only applies statMods/weapons/loads from an option (no rule-granting),
# so the gained Cloak-2 / Stealth rules are carried in the option NAME (shown in the
# loadout picker + the new datasheet Refit note). Engine Upgrade is a clean +3" Thrust.
# Faction file + fleet-data mirror. "PDF is king."
import json, glob

# Optional Cloaking Crest (+5, gain Cloak-2 + Stealth) on the three destroyer classes.
CREST = {'Incubus Destroyers', 'Succubus Destroyers', 'Revenant Destroyers'}
def crest_block():
    return {'name': 'Cloaking Crest', 'minSelections': 1, 'maxSelections': 1, 'options': [
        {'name': 'No Cloaking Crest', 'cost': 0, 'weapons': [], 'loads': []},
        {'name': 'Cloaking Crest (gain Cloak-2, Stealth)', 'cost': 5, 'weapons': [], 'loads': []},
    ]}

# Optional Keel Refit on the Battleships: Cloaking Keel +15 (Stealth+Cloak-2) OR
# Engine Upgrade +25 (+3" Thrust). Has a free "No Keel Refit" default.
KEEL_REFIT = {'Daemon Battleship', 'Dragon Battleship', 'Beelzebub Battleship', 'Devil Battleship'}
def keel_refit_block():
    return {'name': 'Keel Refit', 'minSelections': 1, 'maxSelections': 1, 'options': [
        {'name': 'No Keel Refit', 'cost': 0, 'weapons': [], 'loads': []},
        {'name': 'Cloaking Keel (gain Stealth, Cloak-2)', 'cost': 15, 'weapons': [], 'loads': []},
        {'name': 'Engine Upgrade (+3" Thrust)', 'cost': 25, 'weapons': [], 'loads': [], 'statMods': {'thrust': 3}},
    ]}

# FORCED Keel Options on the Super Battleships: MUST take either Cloaking Keel (+0,
# Stealth+Cloak-2) or Engine Upgrade (+10, +3" Thrust). No "none" option; default is
# the free Cloaking Keel (index 0).
KEEL_FORCED = {'Nephilim Super Battleship', 'Bael Super Battleship', 'Samael Super Battleship', 'Faust Super Battleship'}
def keel_forced_block():
    return {'name': 'Keel Options', 'minSelections': 1, 'maxSelections': 1, 'options': [
        {'name': 'Cloaking Keel (gain Stealth, Cloak-2)', 'cost': 0, 'weapons': [], 'loads': []},
        {'name': 'Engine Upgrade (+3" Thrust)', 'cost': 10, 'weapons': [], 'loads': [], 'statMods': {'thrust': 3}},
    ]}

RULES = {
    **{n: ('This ship may take a Cloaking Crest for +5 pts, gaining Cloak-2 and Stealth.', crest_block) for n in CREST},
    **{n: ('This Ship may take a Cloaking Keel for +15 points, gaining Stealth and Cloak-2, or an Engine Upgrade for +25 points increasing Thrust by 3".', keel_refit_block) for n in KEEL_REFIT},
    **{n: ('This Ship must take either a Cloaking Keel, gaining Stealth and Cloak-2, or an Engine Upgrade for +10 points, increasing Thrust by 3".', keel_forced_block) for n in KEEL_FORCED},
}

def has_lo(s, name):
    return any(lo.get('name') == name for lo in s.get('loadoutOptions', []))

for fp in ['data/faction-scourge.json', 'data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = []
    def walk(o):
        if isinstance(o, dict):
            s = o.get('ship')
            if isinstance(s, dict) and o.get('name') in RULES:
                text, block = RULES[o['name']]
                blk = block()
                if not has_lo(s, blk['name']):
                    s.setdefault('loadoutOptions', []).append(blk)
                if not (s.get('rulesText') or '').strip():
                    s['rulesText'] = text
                changed.append(o['name'])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if changed:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    print(fp.split('/')[-1], '->', len(changed), sorted(set(changed)))
