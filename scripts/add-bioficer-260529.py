# Adds the May-2026 Bioficer content to data/faction-bioficer.json:
#  - 6 new ships (Sluice, Source, Syntax, Synthesis, Sierra, Shade) verbatim from
#    Bioficer_Combined_Fleet_Stats_260529 (adversarially verified by workflow).
#  - 2 new deployable features (Gravitational Arc, Ghost Orb Tower).
#  - Genitor Tower converted from a Porter "feature upgrade" into a PAYLOAD unit
#    (Payload S-1) so it lives in the Payload tab, consumes Porter S capacity, and
#    can be taken per-hull / up to capacity (per user + rules "as if Payload S-1").
import json, hashlib

FP = 'data/faction-bioficer.json'
d = json.load(open(FP, encoding='utf-8'))
groups = d['groups']

def find_ship(name):
    return next((s for s in groups if s.get('name') == name), None)

def find_rule(ship_entry, rule_name):
    for r in ship_entry['ship'].get('specialRules', []):
        if r.get('name') == rule_name:
            return dict(r)
    return None

# --- reuse existing verbatim rule descriptions ---
stature = find_ship('Stature Battlecruiser')
vanguard_rule = next((dict(r) for r in stature['ship']['specialRules'] if r['name'].startswith('Vanguard')), None)
vanguard_token = next((t.strip() for t in stature['ship']['stats']['special'].split(',') if t.strip().startswith('Vanguard')), 'Vanguard-6"')
zenith = find_ship('Zenith Dreadnought')
hvbp_rule = find_rule(zenith, 'High Velocity Boarding Pods')
# Payload S-1 rule description (reuse the canonical one already in the file)
payload_s1_rule = None
def walk(o):
    global payload_s1_rule
    if isinstance(o, dict):
        if o.get('name') == 'Payload S-1' and 'description' in o and payload_s1_rule is None:
            payload_s1_rule = dict(o)
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(d)
assert vanguard_rule and hvbp_rule and payload_s1_rule, (bool(vanguard_rule), bool(hvbp_rule), bool(payload_s1_rule))

# --- new rule descriptions (verbatim from the 260529 PDF) ---
BOMBARDMENT_SPINE_RULE = {"name": "Bombardment Spine",
    "description": "This weapon gains the Corruptor-2 special rule while on the Weapons Free order."}
FEATURE_CARRIER_RULE = {"name": "Feature Carrier",
    "description": "At the start of the game, before players deploy, choose from the Gravitational Arc or Ghost Orb Tower Deployable Feature. This Ship starts the game carrying the chosen Deployable Feature."}

def W(name, arc, att, lock, dmg, typ, special):
    return {"name": name, "arc": arc, "attack": att, "lock": lock, "damage": dmg, "type": typ, "special": special}
def L(name, launch, special):
    return {"name": name, "launch": launch, "special": special}
def mkid(name):
    h = hashlib.md5(('bf260529:'+name).encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

def ship_entry(name, category, cost, stats_special, stats, weapons, loads, rules):
    st = {"thrust": stats[0], "scan": stats[1], "sig": stats[2], "hull": stats[3],
          "es": stats[4], "ks": stats[5], "bs": stats[6], "g": stats[7], "special": stats_special}
    shp = {"name": name, "cost": cost, "stats": st, "weapons": weapons, "loads": loads, "specialRules": rules}
    return {"id": mkid(name), "name": name, "category": category, "ship": shp}

HYPER = lambda: W("Hyper Lightvice", "F/S", "5", "2+", "3", "K", "Bloom-1, Close Action, Focused, Scald-1")
BLASTER = lambda: W("Decon Blaster", "FN", "3", "3+", "1", "E", "-")
SPINE = lambda: W("Bombardment Spine", "F/S/R", "9", "5+", "2", "E", "Alt-1, Bombardment")

new_ships = [
    ship_entry("Sluice", "medium", 152, "Feature Carrier",
        ['7"', '10"', '4"', 11, "4+", "4+", "5+", "1"],
        [HYPER()], [L("Torpedo", "2", "Limited-4")], [dict(FEATURE_CARRIER_RULE)]),
    ship_entry("Source", "heavy", 190, vanguard_token + ", High Velocity Boarding Pods, Bombardment Spine",
        ['8"', '10"', '4"', 12, "4+", "4+", "5+", "1"],
        [SPINE()], [L("Drop Pods", "4", "Alt-1"), L("Boarding Pods", "2", "-")],
        [dict(vanguard_rule), dict(hvbp_rule), dict(BOMBARDMENT_SPINE_RULE)]),
    ship_entry("Syntax", "heavy", 175, "Feature Carrier",
        ['8"', '10"', '4"', 14, "4+", "4+", "5+", "1"],
        [W("Decon Annihilator", "FN", "12", "3+", "1", "E", "Reave-1"), BLASTER(), BLASTER()],
        [], [dict(FEATURE_CARRIER_RULE)]),
    ship_entry("Synthesis", "heavy", 230, "Feature Carrier",
        ['8"', '10"', '4"', 14, "4+", "4+", "5+", "1"],
        [W("Decon Blast", "F/S/R", "4", "4+", "1", "E", "-")],
        [L("Fighters & Bombers", "5", "-"), L("Torpedo", "2", "Limited-4")], [dict(FEATURE_CARRIER_RULE)]),
    ship_entry("Sierra", "heavy", 185, "Feature Carrier",
        ['8"', '10"', '4"', 14, "4+", "4+", "5+", "1"],
        [HYPER(), BLASTER(), BLASTER()], [], [dict(FEATURE_CARRIER_RULE)]),
    ship_entry("Shade", "heavy", 225, "Feature Carrier, High Velocity Boarding Pods, Bombardment Spine",
        ['8"', '10"', '4"', 14, "4+", "4+", "5+", "1"],
        [SPINE()],
        [L("Drop Pods", "4", "Alt-1"), L("Boarding Pods", "2", "-"), L("Torpedoes", "2", "Limited-4")],
        [dict(FEATURE_CARRIER_RULE), dict(hvbp_rule), dict(BOMBARDMENT_SPINE_RULE)]),
]

# --- Genitor Tower as a PAYLOAD unit (was a deployable feature) ---
GENITOR_TOWER_RULE = {"name": "Genitor Tower",
    "description": ("This Feature may be purchased for your fleet when you build your list. It must be assigned "
        "to a Ship with the Porter special rule as if it were a Ship with the Payload S-1 special rule. When one "
        "or more enemy Battalions on this Dropsite and its Features are removed for any reason, place 2 friendly "
        "Battalions on this Dropsite regardless of the number of Battalions removed or Genitor Towers on this "
        "Dropsite. If these Battalions are gained through Battalion Combat, they are placed after Battalion Combat. "
        "When this Feature is destroyed, it contributes its points to the Kill Points of the opposing player that "
        "destroyed it.")}
genitor_payload = {
    "id": mkid("Genitor Tower Payload"),
    "name": "Genitor Tower",
    "category": "payload",
    "ship": {
        "name": "Genitor Tower",
        "cost": 15,
        "stats": {"thrust": "-", "scan": "-", "sig": "-", "hull": 5, "es": "4+", "ks": "4+",
                  "bs": "-", "g": "-", "special": "Payload S-1"},
        "weapons": [], "loads": [],
        "specialRules": [dict(payload_s1_rule), dict(GENITOR_TOWER_RULE)],
    },
}

# remove Genitor from deployableFeatures; add the two new features
feat = lambda name, rules: {"id": mkid("feat:"+name), "name": name, "cost": 0,
    "features": [{"name": name, "es": "4+", "ks": "4+", "special": "-"}], "rules": rules}
GRAV_ARC = feat("Gravitational Arc", [{"name": "Gravitational Arc",
    "description": ("When an enemy Group ends its move within 6\" of this Feature's dropsite and in atmosphere, "
        "that Group's player rolls a dice. On a 1-3, the Group is moved into Orbit and cannot move into Atmosphere "
        "again this round. It suffers the effects of moving through any scenery it is placed in. This takes place "
        "before that Group attacks or launches assets. If all Ships in the Group have Orbital Decay tokens, they "
        "are not affected.\nThis feature requires 5 or more Battalions to be removed during Battalion Combat and "
        "5 damage to remove due to attacks.")}])
GHOST_ORB = feat("Ghost Orb Tower", [
    {"name": "Ghost Orb Tower",
     "description": ("When you activate this Feature, remove 1 enemy Battalion from each Feature on this Dropsite, "
        "then remove 1 enemy Battalion from anywhere on this Dropsite.\nThis feature requires 5 or more Battalions "
        "to be removed due to Battalion Combat and 5 damage to remove due to Group/Asset attacks.")},
    {"name": "Ghost Orb",
     "description": ("Effects caused by this weapon's Status rule are removed at the start of next round's End Phase "
        "instead of this round's End Phase.\nGhost Orb weapon: Scan 8\", Att 2, Lock 3+, DMG 2, Type E. "
        "Special: Close Action, Escape Velocity, Status.")}])
# the Ghost Orb Tower carries a weapon profile too
GHOST_ORB['features'][0]['weapon'] = "Ghost Orb: Scan 8\", Att 2, Lock 3+, DMG 2 E, Close Action, Escape Velocity, Status"

before_feats = [f.get('name') for f in d.get('deployableFeatures', [])]
d['deployableFeatures'] = [f for f in d.get('deployableFeatures', []) if f.get('name') != 'Genitor Tower']
d['deployableFeatures'].append(GRAV_ARC)
d['deployableFeatures'].append(GHOST_ORB)

# append new ships + the Genitor payload unit
groups.extend(new_ships)
groups.append(genitor_payload)

json.dump(d, open(FP, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)

print('deployableFeatures before:', before_feats)
print('deployableFeatures after :', [f.get('name') for f in d['deployableFeatures']])
print('added ships:', [s['name'] for s in new_ships], '+ Genitor Tower payload')
print('vanguard_token used:', repr(vanguard_token))
