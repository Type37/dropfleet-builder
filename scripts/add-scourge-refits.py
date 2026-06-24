# Scourge keel/crest refits from the Scourge Combined Fleet Stats PDF.
# Cloaking options grant Cloak-2 + Stealth via the option's `gainRules` (the engine
# now resolves these to full rule text from the shared glossary); Engine Upgrade is a
# clean +3" Thrust statMod. Replaces any existing block of the same name so the script
# is idempotent. Faction file + fleet-data mirror. "PDF is king."
import json, glob

def opt(name, cost, **extra):
    o = {'name': name, 'cost': cost, 'weapons': [], 'loads': []}
    o.update(extra)
    return o

# Optional Cloaking Crest (+5, gain Cloak-2 + Stealth) — three destroyer classes.
CREST = {'Incubus Destroyers', 'Succubus Destroyers', 'Revenant Destroyers'}
def crest_block():
    return {'name': 'Cloaking Crest', 'minSelections': 1, 'maxSelections': 1, 'options': [
        opt('No Cloaking Crest', 0),
        opt('Cloaking Crest', 5, gainRules=['Cloak-2', 'Stealth']),
    ]}

# Optional Keel Refit on the Battleships: Cloaking Keel +15 (Stealth+Cloak-2) OR
# Engine Upgrade +25 (+3" Thrust); free "No Keel Refit" default.
KEEL_REFIT = {'Daemon Battleship', 'Dragon Battleship', 'Beelzebub Battleship', 'Devil Battleship'}
def keel_refit_block():
    return {'name': 'Keel Refit', 'minSelections': 1, 'maxSelections': 1, 'options': [
        opt('No Keel Refit', 0),
        opt('Cloaking Keel', 15, gainRules=['Stealth', 'Cloak-2']),
        opt('Engine Upgrade (+3" Thrust)', 25, statMods={'thrust': 3}),
    ]}

# FORCED Keel Options on the Super Battleships: MUST take either Cloaking Keel (+0,
# Stealth+Cloak-2) or Engine Upgrade (+10, +3" Thrust). No "none"; default index 0.
KEEL_FORCED = {'Nephilim Super Battleship', 'Bael Super Battleship', 'Samael Super Battleship', 'Faust Super Battleship'}
def keel_forced_block():
    return {'name': 'Keel Options', 'minSelections': 1, 'maxSelections': 1, 'options': [
        opt('Cloaking Keel', 0, gainRules=['Stealth', 'Cloak-2']),
        opt('Engine Upgrade (+3" Thrust)', 10, statMods={'thrust': 3}),
    ]}

RULES = {
    **{n: ('This ship may take a Cloaking Crest for +5 pts, gaining Cloak-2 and Stealth.', crest_block) for n in CREST},
    **{n: ('This Ship may take a Cloaking Keel for +15 points, gaining Stealth and Cloak-2, or an Engine Upgrade for +25 points increasing Thrust by 3".', keel_refit_block) for n in KEEL_REFIT},
    **{n: ('This Ship must take either a Cloaking Keel, gaining Stealth and Cloak-2, or an Engine Upgrade for +10 points, increasing Thrust by 3".', keel_forced_block) for n in KEEL_FORCED},
}

for fp in ['data/faction-scourge.json', 'data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = []
    def walk(o):
        if isinstance(o, dict):
            s = o.get('ship')
            if isinstance(s, dict) and o.get('name') in RULES:
                text, block = RULES[o['name']]
                blk = block()
                los = [x for x in s.get('loadoutOptions', []) if x.get('name') != blk['name']]
                los.append(blk)
                s['loadoutOptions'] = los
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
