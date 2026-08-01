#!/usr/bin/env python3
"""Migrate the Resistance fleet to Combined Fleet Stats 260731 (was 260327).

Everything below is verbatim from Resistance_Combined_Fleet_Stats_260731.pdf. The
260327 -> 260731 delta, established by a page-by-page diff of both PDFs:

  Existing ships
    Hagen - Tribune (famous admiral flagship)  255 -> 250 pts (45 + 205)
    Tribune Battlecruiser                      210 -> 205 pts
    Phalanx Battlecruiser                      165 -> 185 pts; the N-31 Hybrid Gun
                                               Long Battery splits into a Half and a
                                               Full Battery
    Senator Battlecruiser                      145 -> 155 pts; NC-16 Missile Salvo
                                               (Att 8) becomes an NC-16 Missile
                                               Turret Pair (Att 5) plus a smaller
                                               NC-16 Missile Salvo (Att 4); VX Bomb
                                               text now reads "City"; "Swacs" is now
                                               spelled SWACS
    Centurion Grand Cruisers                   N-31 Hybrid Gun Battery (Att 8,
                                               Volley-2) becomes N-31 Hybrid Gun Full
                                               Battery (Att 6, Critical-1,
                                               Fusillade-2, Volley-2); gains a Drive
                                               Refit option
    Gladiator Grand Cruisers                   gains a Drive Refit option
    Triumvir Repair Cruiser                    Box Of Scraps wording tightened

  10 new ships: Secutor, Retiarius, Trafalgar, Jutland, Midway (M);
                Xerxes, Darius, Cyrus, Actium, Salamis (H)
  3 new Deployable Features: ICBM Silo, Ark Lander, Scanner Dome
  1 new Launch Asset: Bombardment Torpedo

The Special column of the Senator/Xerxes really does read only Vanguard-3" in the
PDF, so SWACS is carried as a named rule rather than in stats.special (the old data
had "Swacs" in the Special column, which the PDF never showed).

Idempotent: re-running replaces the new groups/features rather than duplicating.
"""
import json, glob, hashlib

def mkid(name):
    h = hashlib.md5(name.encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

def detect_indent(fp):
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
    return len(line) - len(line.lstrip(' ')) or 1

VANGUARD3 = ('Groups with this rule may begin the game Directly Deployed, ignoring the normal '
             'Scenario Deployment and Approach Types (though still counting towards Groups Directly '
             'Deployed). If it does, it may be deployed up to 3” away from your Deployment Zone.')
SWACS = ('Enemy ships within 12” of this ship may be targeted by friendly ships firing Close Action '
         'weapons using the firing ship’s normal Weapon Range (Scan + Sig).')
VX_BOMB = ('This weapon gains the Scald-2 special rule when targeting Cities. If this weapon does '
           'damage to a City, remove all Battalions (friendly and enemy) from that City and any of '
           'its Features (including deployed Features) in the same City.')
BOX_OF_SCRAPS = ('At the end of this ship’s activation, pick one friendly ship within 6” in line of '
                 'sight (including this one). Place a Box Of Scraps token next to that ship. The next '
                 'time that ship would be destroyed, it isn’t. Instead, before continuing to inflict '
                 'damage, remove the Box of Scraps token and that ship remains in play with D3 Hull '
                 'Points remaining, then continue inflicting damage as normal. Box Of Scraps tokens '
                 'persist through rounds but a ship may only have 1 Box Of Scraps token.')
REPAIR_BAY = ('Friendly Ships within 6” of this Ship that roll to repair Crippling Effects during the '
              'Repair step of the End Phase repair those effects on a roll of a 2+ instead of a 4+.\n'
              'Friendly Ships that end their activation within 6” of this Ship on the same Orbital '
              'Layer recover 2 lost Hull Points.')
RARE = ('You may only take one Group of this Ship in a Skirmish-sized game, two in a Clash, three in '
        'a Battle, and four in a Reconquest.')
FEATURE_ONE = ('At the start of the game, before players deploy, choose one Deployable Feature from '
               'the Resistance Deployable Features List. This Ship starts the game carrying that '
               'Deployable Feature.')
FEATURE_TWO = ('At the start of the game, before players deploy, choose two Deployable Features from '
               'the Resistance Deployable Features List (duplicates are allowed). This Ship starts '
               'the game carrying those Deployable Features.')
REMNANT = ('This ship may be used in UCM or PHR fleets in addition to Resistance fleets. In UCM and '
           'PHR fleets, they gain the Rare special rule.')

DRIVE_REFIT_TEXT = 'This Ship may take a Drive Refit for +25 points, increasing its Thrust by 3”.'
# The Centurion's box is worded "Engine Refit"; every other 260731 box says "Drive Refit".
ENGINE_REFIT_TEXT = 'This Ship may take an Engine Refit for +25 points, increasing its Thrust by 3”.'

def refit_block(label):
    return {
        'name': label,
        'minSelections': 1,
        'maxSelections': 1,
        'options': [
            {'name': 'No ' + label, 'cost': 0, 'weapons': [], 'loads': []},
            {'name': label + ' (+3" Thrust)', 'cost': 25,
             'weapons': [], 'loads': [], 'statMods': {'thrust': 3}},
        ],
    }

def w(name, arc, att, lock, dmg, typ, special):
    return {"name": name, "arc": arc, "attack": att, "lock": lock,
            "damage": dmg, "type": typ, "special": special}

def load(name, launch, special="-"):
    return {"name": name, "launch": launch, "special": special}

def ship(name, group_name, cost, category, tonnage, stats, weapons,
         loads=None, rules=None, rules_text=None, refits=None, rare=False):
    s = {
        "name": name,
        "cost": cost,
        "stats": stats,
        "weapons": weapons,
        "loads": loads or [],
        "specialRules": rules or [],
        "groupMin": 1,
        "groupMax": 1,
        "isRare": rare,
        "isUnique": False,
        "tonnage": tonnage,
    }
    if rules_text:
        s["rulesText"] = rules_text
    if refits:
        s["loadoutOptions"] = [refits]
    return {"id": mkid(group_name), "name": group_name, "category": category, "ship": s}


M_STATS = {"thrust": "5\"", "scan": "6\"", "sig": "6\"", "hull": 14,
           "es": "3+", "ks": "5+", "bs": "5+", "g": "1", "special": "-"}
SUPER_STATS = dict(M_STATS, thrust="8\"")
BC_STATS = {"thrust": "7\"", "scan": "6\"", "sig": "6\"", "hull": 15,
            "es": "3+", "ks": "4+", "bs": "5+", "g": "1", "special": "Vanguard-3\""}
CARRIER_STATS = {"thrust": "6\"", "scan": "6\"", "sig": "6\"", "hull": 15,
                 "es": "3+", "ks": "4+", "bs": "5+", "g": "1", "special": "-"}

R_VAN = {"name": "Vanguard-3\"", "description": VANGUARD3}

NEW_SHIPS = [
    ship("Secutor Grand Cruiser", "Secutor Grand Cruiser", 142, "medium", "M",
         dict(M_STATS),
         [w("NC-16 Missile Turret", "F/S/R", "5", "3+", "1", "K", "Close Action"),
          w("NC-16 Missile Bank", "F/S/R", "6", "3+", "1", "K", "Close Action, Volley-2")],
         loads=[load("Fighters & Bombers", "2")],
         rules_text=DRIVE_REFIT_TEXT, refits=refit_block("Drive Refit")),

    ship("Retiarius Grand Cruiser", "Retiarius Grand Cruiser", 134, "medium", "M",
         dict(M_STATS),
         [w("VX Bomb", "F", "3", "4+", "2", "E", "Bombardment, Limited-3"),
          w("NL-9 Laser Turret", "F/S", "2", "3+", "2", "E", "Flash-1, Focused, Fusillade-1, Reave-1")],
         rules=[{"name": "VX Bomb", "description": VX_BOMB}],
         rules_text=DRIVE_REFIT_TEXT, refits=refit_block("Drive Refit")),

    ship("Trafalgar Supercruiser", "Trafalgar Supercruiser", 122, "medium", "M",
         dict(SUPER_STATS),
         [w("NC-16 Missile Turret Pair", "F/S/R", "5", "3+", "1", "K", "Close Action, Volley-2")],
         rules=[{"name": "Feature Carrier", "description": FEATURE_ONE}]),

    ship("Jutland Supercruiser", "Jutland Supercruiser", 144, "medium", "M",
         dict(SUPER_STATS),
         [w("N-31 Hybrid Gun Full Battery", "B", "6", "4+", "1", "K", "Critical-1, Fusillade-2, Volley-2")],
         rules=[{"name": "Feature Carrier", "description": FEATURE_ONE}]),

    ship("Midway Supercruiser", "Midway Supercruiser", 160, "medium", "M",
         dict(SUPER_STATS),
         [w("NC-16 Missile Bank", "F/S/R", "6", "3+", "1", "K", "Close Action, Volley-2")],
         loads=[load("Fighters & Bombers", "2")],
         rules=[{"name": "Feature Carrier", "description": FEATURE_ONE}]),

    ship("Xerxes Battlecruiser", "Xerxes Battlecruiser", 175, "heavy", "H",
         dict(BC_STATS, scan="12\""),
         [w("NL-9 Laser Turret Pair", "F/S", "4", "3+", "2", "E", "Flash-2 Focused, Fusillade-2, Reave-1"),
          w("Heavy Vent Cannons", "F", "4", "3+", "2", "E", "Fusillade-1, Reave-1")],
         rules=[{"name": "SWACS", "description": SWACS}, dict(R_VAN)]),

    ship("Darius Battlecruiser", "Darius Battlecruiser", 180, "heavy", "H",
         dict(BC_STATS),
         [w("N-11 Artillery Cannon Turret", "F/S", "3", "4+", "1", "K", "Low Power, Fusillade-1"),
          w("NC-16 Missile Salvo", "F/S/R", "4", "3+", "1", "K", "Close Action, Volley-2"),
          w("NC-16 Missile Bank", "F/S/R", "6", "3+", "1", "K", "Close Action, Volley-2"),
          w("NC-16 Missile Turret Pair", "F/S/R", "5", "3+", "1", "K", "Close Action, Volley-2")],
         loads=[load("Fighters & Bombers", "2")],
         rules=[dict(R_VAN)]),

    ship("Cyrus Battlecruiser", "Cyrus Battlecruiser", 185, "heavy", "H",
         dict(BC_STATS, special="Rare, Vanguard-3\""),
         [w("Heavy Vent Cannon Turret", "F/S", "2", "3+", "2", "E", "Fusillade-1, Overcharge, Reave-1")],
         loads=[load("Bulk Landers & Fire Ships", "2")],
         rules=[{"name": "Rare", "description": RARE},
                {"name": "Repair Bay", "description": REPAIR_BAY},
                {"name": "Box Of Scraps", "description": BOX_OF_SCRAPS},
                dict(R_VAN)],
         rare=True),

    ship("Actium Battle Carrier", "Actium Battle Carrier", 180, "heavy", "H",
         dict(CARRIER_STATS),
         [w("N-11 Artillery Cannon Turret", "F/S", "3", "4+", "1", "K", "Low Power, Fusillade-1"),
          w("N-31 Hybrid Gun Half Battery", "B", "3", "4+", "1", "K", "Critical-1, Fusillade-1, Volley-2"),
          w("N-31 Hybrid Gun Full Battery", "B", "6", "4+", "1", "K", "Critical-1, Fusillade-2, Volley-2")],
         rules=[{"name": "Feature Carrier", "description": FEATURE_TWO}]),

    ship("Salamis Battle Carrier", "Salamis Battle Carrier", 200, "heavy", "H",
         dict(CARRIER_STATS),
         [w("NC-16 Missile Turret", "F/S/R", "5", "3+", "1", "K", "Close Action"),
          w("Heavy Vent Cannons", "F", "4", "3+", "2", "E", "Fusillade-1, Reave-1")],
         loads=[load("Fighters & Bombers", "2")],
         rules=[{"name": "Feature Carrier", "description": FEATURE_TWO}]),
]

# Actium and Salamis choose TWO Features; every other Feature Carrier chooses one.
for g in NEW_SHIPS:
    if g["name"] in ("Actium Battle Carrier", "Salamis Battle Carrier"):
        g["ship"]["featureSlots"] = 2

NEW_NAMES = {g["name"] for g in NEW_SHIPS}

NEW_FEATURES = [
    {
        "id": mkid("Resistance ICBM Silo"),
        "name": "ICBM Silo",
        "cost": 0,
        "features": [{"name": "ICBM Silo", "es": "5+", "ks": "5+", "special": "-"}],
        "loads": [{"name": "Bombardment Torpedo", "launch": "2", "special": "Limited-6"}],
        "rules": [{"name": "ICBM Silo", "description":
                   "Bombardment Torpedoes launched from this Feature can only attack Cities and cannot "
                   "attack the Dropsite the launching Feature is deployed to.\n"
                   "Bombardment Torpedoes launched from this Feature become damage Type C when used "
                   "against Cities at least 6” away from enemy Ships.\n"
                   "When an attacking Group or Asset/s attack would cause this feature to be removed, if "
                   "it has any remaining Torpedoes, the attacking opponent may remove an additional "
                   "Feature and any Battalions assigned to it from this Dropsite."}],
    },
    {
        "id": mkid("Resistance Ark Lander"),
        "name": "Ark Lander",
        "cost": 0,
        "features": [{"name": "Ark Lander", "es": "4+", "ks": "4+", "special": "-"}],
        "rules": [{"name": "Ark Lander", "description":
                   "When this feature is deployed to a Dropsite, 4 friendly Battalions are automatically "
                   "deployed to that Dropsite.\n"
                   "While Activating Dropsites (during 7.5 Activating Dropsites), if you have more "
                   "Battalions on this feature than any opponent, you count as controlling the Dropsite "
                   "this Feature is deployed to. If multiple players count as controlling the same "
                   "Dropsite this way, this effect is ignored."}],
    },
    {
        "id": mkid("Resistance Scanner Dome"),
        "name": "Scanner Dome",
        "cost": 0,
        "features": [{"name": "Scanner Dome", "es": "5+", "ks": "5+", "special": "-"}],
        "rules": [{"name": "Scanner Dome", "description":
                   "When you assign any weapons to an enemy Ship/Group within 6” of this Dropsite, "
                   "improve the Lock of those weapons by 1.\n"
                   "When you attack an enemy Descent Ship in Atmosphere within 6” of this Dropsite, "
                   "instead of the usual penalties for attacking a City or a Descent Ship in Atmosphere "
                   "(see paragraph 4 of 3.1.2 Atmosphere) that attack always hits on a 5+ and can never "
                   "cause a critical (instead of a 6+).\n"
                   "e.g. a weapon with Lock 3+ attacking a target in orbit within 6” of this Dropsite "
                   "would improve its Lock to 2+. If that weapon was attacking a Descent Ship in "
                   "Atmosphere within 6” of this Dropsite, it would always hit on a 5+ and will not "
                   "cause criticals. A weapon with Bombardment attacking the same Descent Ship would hit "
                   "on its Lock value improved by 1."}],
    },
]
NEW_FEATURE_NAMES = {f["name"] for f in NEW_FEATURES}

BOMBARDMENT_TORPEDO = {"name": "Bombardment Torpedo", "thrust": "6\"", "attack": "3",
                       "lock": "5+", "damage": "2", "type": "K", "special": "Bombardment"}


# ── existing-ship edits ────────────────────────────────────────────────────────

def edit_centurion(s):
    for weap in s["weapons"]:
        if weap["name"] == "N-31 Hybrid Gun Battery":
            weap["name"] = "N-31 Hybrid Gun Full Battery"
            weap["attack"] = "6"
            weap["special"] = "Critical-1, Fusillade-2, Volley-2"
    # The Remnant rule is what makes the Centurion legal (and Rare) in UCM and PHR
    # fleets; it was enforced in the data but its text was never shown.
    if not any(r["name"] == "Remnant" for r in s.get("specialRules", [])):
        s.setdefault("specialRules", []).insert(0, {"name": "Remnant", "description": REMNANT})
    s["rulesText"] = ENGINE_REFIT_TEXT
    if not any(lo.get("name") == "Drive Refit" for lo in s.get("loadoutOptions", [])):
        s.setdefault("loadoutOptions", []).append(refit_block("Drive Refit"))

def edit_gladiator(s):
    s["rulesText"] = DRIVE_REFIT_TEXT
    if not any(lo.get("name") == "Drive Refit" for lo in s.get("loadoutOptions", [])):
        s.setdefault("loadoutOptions", []).append(refit_block("Drive Refit"))

def edit_senator(s):
    s["cost"] = 155
    s["stats"]["special"] = "Vanguard-3\""
    s["weapons"] = [
        w("VX Bomb", "F", "3", "4+", "2", "E", "Bombardment, Limited-3"),
        w("NC-16 Missile Turret Pair", "F/S/R", "5", "3+", "1", "K", "Close Action, Volley-2"),
        w("NC-16 Missile Salvo", "F/S/R", "4", "3+", "1", "K", "Close Action, Volley-2"),
    ]
    s["specialRules"] = [
        {"name": "VX Bomb", "description": VX_BOMB},
        {"name": "SWACS", "description": SWACS},
        dict(R_VAN),
    ]

def edit_phalanx(s):
    s["cost"] = 185
    s["weapons"] = [
        w("9K Mass Driver Turrets", "F/S", "2", "2+", "2", "K", "Critical-1, Penetrator, Volley-2"),
        w("N-31 Hybrid Gun Half Battery", "B", "3", "4+", "1", "K", "Critical-1, Fusillade-1, Volley-2"),
        w("N-31 Hybrid Gun Full Battery", "B", "6", "4+", "1", "K", "Critical-1, Fusillade-2, Volley-2"),
    ]

def edit_triumvir(s):
    s["stats"]["special"] = "Rare, Repair Bay, Box Of Scraps, Vanguard-3\""
    for r in s.get("specialRules", []):
        if r["name"] in ("Box of Scraps", "Box Of Scraps"):
            r["name"] = "Box Of Scraps"
            r["description"] = BOX_OF_SCRAPS
        elif r["name"] == "Repair Bay":
            r["description"] = REPAIR_BAY

def edit_tribune(s):
    s["cost"] = 205

EDITS = {
    "Centurion Grand Cruisers": edit_centurion,
    "Gladiator Grand Cruisers": edit_gladiator,
    "Senator Battlecruiser": edit_senator,
    "Phalanx Battlecruiser": edit_phalanx,
    "Triumvir Repair Cruiser": edit_triumvir,
    "Tribune Battlecruiser": edit_tribune,
}
# The Centurion is also a UCM/PHR ship (Remnant); keep every copy in step.
CROSS_FACTION = {"Centurion Grand Cruisers"}

applied = {}

def walk(obj, faction_file):
    """Apply group edits anywhere a {name, ship} pair appears (faction files nest
    groups at the top level, fleet-data.json nests them under factions.<key>)."""
    if isinstance(obj, dict):
        s = obj.get("ship")
        name = obj.get("name")
        if isinstance(s, dict) and name in EDITS:
            if faction_file == "resistance" or name in CROSS_FACTION:
                EDITS[name](s)
                applied.setdefault(name, 0)
                applied[name] += 1
        for v in obj.values():
            walk(v, faction_file)
    elif isinstance(obj, list):
        for v in obj:
            walk(v, faction_file)


def upgrade_resistance(fac):
    """Add the new ships, features and launch asset to one Resistance fleet dict."""
    groups = [g for g in fac["groups"] if g.get("name") not in NEW_NAMES]
    # Insert medium ships after the Gladiator and heavy ships after the Tribune so
    # the picker keeps the PDF's ordering; the app re-sorts by weight class anyway.
    med = [json.loads(json.dumps(g)) for g in NEW_SHIPS if g["category"] == "medium"]
    hvy = [json.loads(json.dumps(g)) for g in NEW_SHIPS if g["category"] == "heavy"]
    def insert_after(lst, marker, items):
        idx = next((i for i, g in enumerate(lst) if g.get("name") == marker), None)
        if idx is None:
            return lst + items
        return lst[:idx + 1] + items + lst[idx + 1:]
    groups = insert_after(groups, "Gladiator Grand Cruisers", med)
    groups = insert_after(groups, "Tribune Battlecruiser", hvy)
    fac["groups"] = groups

    feats = [f for f in (fac.get("deployableFeatures") or []) if f.get("name") not in NEW_FEATURE_NAMES]
    feats += [json.loads(json.dumps(f)) for f in NEW_FEATURES]
    fac["deployableFeatures"] = feats

    for la in fac.get("launchAssets") or []:
        assets = [a for a in la.get("assets", []) if a.get("name") != "Bombardment Torpedo"]
        assets.append(dict(BOMBARDMENT_TORPEDO))
        la["assets"] = assets

    # Hagen's flagship is a Tribune: 250 pts = 45 (admiral) + 205 (ship).
    for a in fac.get("admirals") or []:
        f = a.get("flagship")
        if a.get("name") == "Hagen" and isinstance(f, dict) and f.get("name") == "Tribune Battlecruiser":
            f["cost"] = 205


for fp in sorted(glob.glob('data/faction-*.json')):
    indent = detect_indent(fp)
    d = json.load(open(fp, encoding='utf-8'))
    key = 'resistance' if fp.endswith('faction-resistance.json') else 'other'
    walk(d, key)
    if key == 'resistance':
        upgrade_resistance(d)
    json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=indent, ensure_ascii=False)
    print(f"{fp}: {len(d['groups'])} groups")

fp = 'data/fleet-data.json'
indent = detect_indent(fp)
fd = json.load(open(fp, encoding='utf-8'))
for fkey, fac in fd.get('factions', {}).items():
    walk(fac, 'resistance' if 'resistance' in fkey.lower() else 'other')
    if 'resistance' in fkey.lower() and 'groups' in fac:
        upgrade_resistance(fac)
json.dump(fd, open(fp, 'w', encoding='utf-8', newline=''), indent=indent, ensure_ascii=False)
print('data/fleet-data.json updated')

print('edits applied:', applied)
for fp in sorted(glob.glob('data/faction-*.json')) + ['data/fleet-data.json']:
    json.load(open(fp, encoding='utf-8'))
print('all JSON valid')
