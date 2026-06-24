# Three small fixes from the rule-resolution audit:
#  1. UCM Viper/Python lasers: "Bloom-N Burnthrough-N" -> "Bloom-N, Burnthrough-N"
#     (missing comma fused two keywords into one unresolvable token).
#  2. PHR Agrippa: stats.special token "Holo-Debris Field" -> "Holo Interference Field"
#     to match the ship's own specialRules entry (and the PDF).
#  3. Resistance Guy Fawkes: add the missing "Set Timers And Run" + "Skeleton Crew"
#     rules (verbatim, Resistance Combined Fleet Stats PDF).
import json, glob, re

SET_TIMERS = ("Once you complete an attack sequence with Explosive Detonation, remove this ship from the game. "
    "If there is a friendly Ship within 8\" of this Ship, place a Fawkes' Crew Battalion on that Ship. This ship "
    "only counts for Ships killed when Fawkes' Crew Battalion is removed from the game.")
SKELETON = "This Ship can only go on General Quarters."

def fix_weapon_special(s):
    # only touches the fused "Bloom-N Burnthrough-N" form
    return re.sub(r'\bBloom-(\d) Burnthrough-(\d)\b', r'Bloom-\1, Burnthrough-\2', s or '')

def ensure_rule(ship, name, desc):
    rules = ship.setdefault('specialRules', [])
    if not any(r.get('name') == name for r in rules):
        rules.append({'name': name, 'description': desc})

for fp in glob.glob('data/faction-*.json') + ['data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    counts = {'comma': 0, 'holo': 0, 'fawkes': 0}
    def walk(o):
        if isinstance(o, dict):
            # 1. comma fix on any weapon special
            if 'special' in o and isinstance(o['special'], str) and 'Bloom-' in o['special']:
                fixed = fix_weapon_special(o['special'])
                if fixed != o['special']:
                    o['special'] = fixed; counts['comma'] += 1
            s = o.get('ship') if isinstance(o.get('ship'), dict) else None
            # 2. Holo rename in a ship's stats.special
            if s and isinstance(s.get('stats'), dict):
                sp = s['stats'].get('special')
                if isinstance(sp, str) and 'Holo-Debris Field' in sp:
                    s['stats']['special'] = sp.replace('Holo-Debris Field', 'Holo Interference Field')
                    counts['holo'] += 1
            # 3. Guy Fawkes rules
            if s and 'Guy Fawkes' in (o.get('name') or ''):
                ensure_rule(s, 'Set Timers And Run', SET_TIMERS)
                ensure_rule(s, 'Skeleton Crew', SKELETON)
                counts['fawkes'] += 1
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if any(counts.values()):
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    print(fp.split('\\')[-1].split('/')[-1], counts)
