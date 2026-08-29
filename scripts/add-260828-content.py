#!/usr/bin/env python3
"""Ingest the 28 Aug / 1 Sep 2026 TTCombat releases.

Sources (all in Rules-Mechanics-PDFs/, downloaded from the official downloads page):
  UCM_Combined_Fleet_Stats_260828.pdf      p44  Frances Mendoza - Flying Dutchman
  PHR_Combined_Fleet_Stats_260828.pdf      p41  Camilla Felix - Nanomatrix
  Civilian_Ships_Scenarios_260901.pdf      p6   MK Mass Transporter
  Fleet_Space_Stations_250828.pdf          p11  Bioficer Hypershredder + Hypersummoner

Page-diffing each new PDF against the edition it replaces showed these four cards
are the only additions; the sole other change is the UCM Kiev lore paragraph now
spelling the class "Kyiv" (the group name and namesake already did).

Every stat, weapon row and rule below is copied from those pages verbatim. Rules
that already exist in a faction file (Hero, Unique, Vectored, Descent, Rare,
Mercenary) are reused from that file rather than retyped, so page/publicationId
references stay consistent. "Boardable" is dropped from the Special column of the
MK Mass Transporter, matching how every other civilian hull is stored since v344.

Run once from the repo root:  python scripts/add-260828-content.py
"""
import glob
import json
import hashlib

FACTIONS = sorted(glob.glob('data/faction-*.json'))
RULEBOOK = "45b0-3e3b-e83d-fd70"


def mkid(faction, name):
    h = hashlib.md5(f"ingest:{faction}:{name}".encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"


def detect_indent(fp):
    """Faction files are not uniformly formatted (UCM is 2-space, the rest 1-space).
    Match whatever the file already uses so the diff stays to the added group."""
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
    return len(line) - len(line.lstrip(' ')) or 1


def glossary(data):
    """name -> rule object, harvested from everything already in this faction file."""
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
    walk(data)
    return out


def rule(gloss, name, description=None, after=None):
    """Reuse the faction's existing wording for a shared rule; otherwise take the
    verbatim text passed in. `after` clones another rule's page reference (used for
    Regenerate-3, which the rulebook only prints in its Regenerate-X form)."""
    if name in gloss:
        return json.loads(json.dumps(gloss[name]))
    r = {"name": name, "description": description}
    if after and after in gloss:
        src = gloss[after]
        if src.get('page'):
            r['page'] = src['page']
            r['publicationId'] = src.get('publicationId', RULEBOOK)
    return r


# -- UCM_Combined_Fleet_Stats_260828.pdf p44 --------------------------------
DUTCHMAN_NAME = "Frances Mendoza - Flying Dutchman Heavy Cruiser"
DUTCHMAN_LORE = (
    "Captain Frances Mendoza has destroyed more enemy tonnage in his career than any other colonial "
    "officer of his rank. He famously captained the light cruiser Crimson Heart throughout the 1st "
    "Battle of Olympus to nine capital ship kills before his vessel was crippled. Before and since he "
    "has built a reputation for single-minded, ruthless lethality. His steely disregard for the wider "
    "fleet has precluded any further promotion, but the Admiralty has now recognised his stellar record "
    "with a new, experimental command.\n\n"
    "The Flying Dutchman is a heavy cruiser of currently unique design. She was envisioned as a short "
    "mission duration ship-killer to be brought in under dire circumstances. With additional engines she "
    "is much faster than any other current UCMF vessel of her tonnage while offering a suite of "
    "aggressive gunnery at the expense of ammunition, fuel, and consumables storage. Her ultra-short "
    "endurance might preclude the design from wider adoption, but the Admiralty could find no captain "
    "more suitable for this experimental vessel than Mendoza."
)

# -- PHR_Combined_Fleet_Stats_260828.pdf p41 --------------------------------
NANOMATRIX_NAME = "Camilla Felix - Nanomatrix Heavy Cruiser"
NANOMATRIX_LORE = (
    "Camilla Felix is the younger sister of renowned war leader and, to some, heretic, Aurellia Felix. "
    "Just as charismatic but more hot-headed, which limited her advancement in a Grand Fleet naval "
    "career, Camilla is known for her individualism, humanity, and skill in war. When Aurellia declared "
    "her intention to schism along with her forces, Camilla was among a flotilla of ardent followers of "
    "the White Sphere. Given her sister’s actions, an arrest was apparently attempted, but "
    "Camilla’s crew stood with her, repelled the boarders, and helped her masterfully shoot her way "
    "out of newly hostile space in the first widely documented PHR-on-PHR combat.\n\n"
    "She brought with her the Nanomatrix, an apparently unique vessel of heavy cruiser tonnage. A more "
    "advanced design than regular classes, this ship features an additional primary engine, a sleeker "
    "hull, and a prow-mounted energy glaive supported by a state-of-the-art power core. The vessel’s "
    "main feature however is a grossly oversized nanomachine hive, enabling both repair and offensive "
    "actions with storms of ultra-advanced nanomachines. The presumably huge cost of all this may have "
    "limited this class to one example, budget must trouble the Grand Fleet as it does the UCMF."
)
REPAIR_NANOMACHINES = (
    "Friendly Ships within 6” of this Ship that roll to repair Crippling Effects during the Repair "
    "step of the End Phase improve the results of those rolls by 2. Other friendly Ships that end their "
    "activation within 6” of this Ship on the same Orbital Layer recover 2 lost Hull Points."
)

# -- Civilian_Ships_Scenarios_260901.pdf p6 ---------------------------------
MK_LORE = (
    "It’s a tough, thankless job hauling cargo from ground to space, but the Maganum Kinematics Mass "
    "Transporter takes it all in its stride. This reliable workhorse can be frequently seen flitting "
    "between orbit and atmosphere collecting and dispensing valuable cargo. During the reconquest, the "
    "durable, yet lightly armoured spaceframe of this vessel was used as a second line support vessel "
    "assisting troopships in setting up forward operating bases. Full of prefabricated barricades, "
    "fire-support bunkers, and even command centres, this small hauler vastly improves the efficiency of "
    "troops deployed to combat zones. Keeping the war machine well equipped, well stocked, and with a "
    "relatively comfortable, if cramped base to strike out at Scourge targets from.\n\n"
    "Even though their primary contracts are with the UCM, Maganum Kinematics have sold many of these to "
    "other non government organisations. Various shipping magnates operate at least one of these reliable "
    "ships at each of their destinations. More surprisingly, even other factions have been making use of "
    "these vessels. The PHR stationed at Earth have requisitioned a pair of these ships, as well as "
    "Kalium counting no fewer than four of these vessels amongst its fleet, though only two have been "
    "seen operating in the vicinity of Earth."
)
BULK_LIGHTER = (
    "While a Ship with this rule is on the table, you have access to the following Ability:\n\n"
    "Battalion Support (1AP): Once per activation, when you deploy Battalions from a Group on any Orbital "
    "Layer within 6” of a friendly Ship with the Bulk Lighter rule, choose one of the launching Asset "
    "types. If the chosen Asset is either Dropships or Drop Pods, place an additional Battalion. If the "
    "chosen Asset is Bulk Landers, place an additional two Battalions. Other Launch Assets are unaffected "
    "by this Ability."
)

# -- Fleet_Space_Stations_250828.pdf p11 ------------------------------------
BIOFICER_STATIONS = [
    {
        "id": mkid('bioficer', 'Hypershredder'),
        "name": "Hypershredder",
        "cost": 220,
        "stats": {"scan": "12\"", "sig": "4\"", "hull": 22, "es": "4+", "ks": "4+",
                  "bs": "6+", "g": "1", "special": "-"},
        "specialRules": [],
        "weapons": [
            {"name": "Dimensional Hypershredder", "arc": "FN", "attack": "12", "lock": "3+",
             "damage": "1", "type": "*",
             "special": "Bombardment, Critical-1, Focused, Reave-2"}
        ],
        "stationRules": [
            {"name": "Dimensional Hypershredder",
             "effect": "When you attack with this weapon, choose Energy or Kinetic. This weapon’s "
                       "Type becomes the chosen Type for this attack."},
            {"name": "Slow Traversal",
             "effect": "This Space Station uses arcs as if it was a Ship and may only be turned due to "
                       "this rule. When this Space Station is activated, you may turn it up to 22 degrees "
                       "in any direction (22 degrees is the size of the FN Arc), even if it is controlled "
                       "or contested by an opponent."},
        ],
    },
    {
        "id": mkid('bioficer', 'Hypersummoner'),
        "name": "Hypersummoner",
        "cost": 200,
        "stats": {"scan": "12\"", "sig": "4\"", "hull": 22, "es": "4+", "ks": "4+",
                  "bs": "6+", "g": "1", "special": "-"},
        "specialRules": [],
        "stationRules": [
            {"name": "Summoned Ingress",
             "effect": "From the 2nd round onwards, when a Group of L Tonnage not on the table deploys, "
                       "you may treat this Space Stations front Arc up to 6” away as that Group’s "
                       "deployment zone. If a Group deploys this way, roll a dice for each Ship in that "
                       "Group and apply the corresponding Crippling Effect to the Group and the Group "
                       "cannot attack or launch Assets this round."},
            {"name": "Hypersummoning",
             "effect": "When you launch a Wing from a friendly Bioficer Ship, instead of launching them "
                       "normally, you may place them anywhere within 18” of this Space Station. Wings "
                       "placed this way suffer the effects of any scenery they are placed on but ignore "
                       "intervening scenery. Wings placed this way count as having moved but may form and "
                       "divide into Wings as if they had moved normally but cannot move or form and divide "
                       "into Wings during the Asset Phase. Wings placed this way cannot be the target of "
                       "your Abilities until the end of the round (other players may target them with "
                       "Abilities as normal)."},
        ],
    },
]


def build_dutchman(gloss):
    return {
        "id": mkid('ucm', DUTCHMAN_NAME),
        "name": DUTCHMAN_NAME,
        "category": "medium",
        "ship": {
            "name": DUTCHMAN_NAME,
            "cost": 136,
            "stats": {"thrust": "10\"", "scan": "6\"", "sig": "6\"", "hull": 12, "es": "4+",
                      "ks": "3+", "bs": "6+", "g": "1", "special": "Hero, Vectored, Unique"},
            "weapons": [
                {"name": "Cobra Heavy Laser Pair", "arc": "FN", "attack": "6", "lock": "3+",
                 "damage": "1", "type": "E", "special": "Burnthrough-2, Flash-2, Focused"},
                {"name": "Arowana Missile Turrets", "arc": "F/S/R", "attack": "6", "lock": "3+",
                 "damage": "1", "type": "K", "special": "Close Action, Scald-1"},
                {"name": "Arowana Missile Turrets", "arc": "F/S/R", "attack": "6", "lock": "3+",
                 "damage": "1", "type": "K", "special": "Close Action, Scald-1"},
            ],
            "loads": [],
            "specialRules": [
                rule(gloss, "Hero"),
                rule(gloss, "Vectored"),
                rule(gloss, "Unique"),
            ],
            "groupMin": 1,
            "groupMax": 1,
            "isRare": False,
            "isUnique": True,
            "tonnage": "M",
            "famousShipsPrefix": "Only ship of the class:",
            "famousShips": ["Flying Dutchman"],
            "lore": DUTCHMAN_LORE,
        },
    }


def build_nanomatrix(gloss):
    return {
        "id": mkid('phr', NANOMATRIX_NAME),
        "name": NANOMATRIX_NAME,
        "category": "medium",
        "ship": {
            "name": NANOMATRIX_NAME,
            "cost": 146,
            "stats": {"thrust": "9\"", "scan": "8\"", "sig": "6\"", "hull": 13, "es": "3+",
                      "ks": "4+", "bs": "6+", "g": "1",
                      "special": "Hero, Regenerate-3, Unique"},
            "weapons": [
                {"name": "Glaive Lance", "arc": "FN", "attack": "3", "lock": "2+",
                 "damage": "2", "type": "E", "special": "Overcharge"},
                {"name": "Black Nano Drones", "arc": "F/S/R", "attack": "8", "lock": "4+",
                 "damage": "1", "type": "K", "special": "Close Action, Penetrator"},
            ],
            "loads": [],
            "specialRules": [
                rule(gloss, "Hero"),
                rule(gloss, "Regenerate-3",
                     "This Ship recovers 3 lost Hull Points at the end of its activation.",
                     after="Regenerate-2"),
                rule(gloss, "Unique"),
                {"name": "Repair Nanomachines", "description": REPAIR_NANOMACHINES},
            ],
            "groupMin": 1,
            "groupMax": 1,
            "isRare": False,
            "isUnique": True,
            "tonnage": "M",
            "famousShipsPrefix": "Only ship of the class:",
            "famousShips": ["Nanomatrix"],
            "lore": NANOMATRIX_LORE,
        },
    }


def build_mk(gloss):
    return {
        "id": mkid('civilian', 'MK Mass Transporter'),
        "name": "MK Mass Transporters",
        "category": "light",
        "ship": {
            "name": "MK Mass Transporter",
            "cost": 41,
            "stats": {"thrust": "10\"", "scan": "4\"", "sig": "4\"", "hull": 5, "es": "5+",
                      "ks": "6+", "bs": "N/A", "g": "1-2", "special": "Descent, Rare"},
            "weapons": [
                {"name": "Deterrence Missiles", "arc": "F/S", "attack": "4", "lock": "3+",
                 "damage": "1", "type": "K", "special": "Close Action"},
            ],
            "loads": [],
            "specialRules": [
                rule(gloss, "Descent"),
                rule(gloss, "Rare"),
                rule(gloss, "Mercenary"),
                {"name": "Bulk Lighter", "description": BULK_LIGHTER},
            ],
            "groupMin": 1,
            "groupMax": 2,
            "isRare": True,
            "isUnique": False,
            "tonnage": "L",
            "additional": True,
            "lore": MK_LORE,
        },
    }


def insert_after(groups, marker, entry):
    """Keep the new ship next to its neighbours (the faction's other Hero ship, the
    other civilian hulls) rather than at the end of the file. The app sorts by
    weight class anyway; this only keeps the JSON readable."""
    if any(g['id'] == entry['id'] for g in groups):
        return groups, 'already present'
    for i, g in enumerate(groups):
        if g['name'].startswith(marker):
            groups.insert(i + 1, entry)
            return groups, f'after {g["name"]}'
    groups.append(entry)
    return groups, 'appended'


changed = []
for fp in FACTIONS:
    key = fp.replace('\\', '/').split('faction-')[1][:-5]
    indent = detect_indent(fp)
    d = json.load(open(fp, encoding='utf-8'))
    gloss = glossary(d)
    notes = []

    # MK Mass Transporter is a Mercenary hull: it can be taken by any fleet, so it
    # is stored alongside the other civilian ships in every faction file.
    d['groups'], where = insert_after(d['groups'], 'M.A.B. 67', build_mk(gloss))
    notes.append(f'MK Mass Transporters ({where})')

    if key == 'ucm':
        d['groups'], where = insert_after(d['groups'], 'Rhiannon Major', build_dutchman(gloss))
        notes.append(f'Flying Dutchman ({where})')
        for g in d['groups']:
            lore = g['ship'].get('lore')
            if g['name'].startswith('Kyiv') and lore and 'Kiev' in lore:
                g['ship']['lore'] = lore.replace('Kiev', 'Kyiv')
                notes.append('Kyiv lore spelling')
    if key == 'phr':
        d['groups'], where = insert_after(d['groups'], 'Avram Bei', build_nanomatrix(gloss))
        notes.append(f'Nanomatrix ({where})')
    if key == 'bioficer':
        have = {s['id'] for s in d['spaceStations']}
        for st in BIOFICER_STATIONS:
            if st['id'] not in have:
                d['spaceStations'].append(json.loads(json.dumps(st)))
                notes.append(f'station {st["name"]}')

    json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=indent, ensure_ascii=False)
    changed.append((fp, indent, notes))

for fp, indent, notes in changed:
    print(f"{fp} (indent {indent}): " + '; '.join(notes))
print("\nNow run: python scripts/gen-fleet-data.py")
