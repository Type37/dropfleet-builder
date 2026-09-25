#!/usr/bin/env python3
"""Ingest the 25 Sep 2026 TTCombat releases.

Sources (all in Rules-Mechanics-PDFs/, downloaded from the official downloads page):
  Shaltari_Combined_Fleet_Stats_260925.pdf  p37  Seti the Kinslayer - Spear of Anubis
  Bioficer_Combined_Fleet_Stats_260925.pdf  p46  Aeon - The Ring Ship
  UCM_Combined_Fleet_Stats_260828.pdf       p44  re-uploaded in place again: the Flying
                                                 Dutchman captain is "Frances" once more

Page-diffing each new PDF against the edition it replaces showed these are the only
additions. The one other change is Bioficer's five Feature Carriers (Sluice, Syntax,
Synthesis, Sierra, Shade) now saying "Gravitational Arc" where they said
"Gravitational Lens"; the data already used "Gravitational Arc", so nothing to change.

Every stat, weapon row and rule below is copied from those pages verbatim. Shared
rules (Hero, Unique, Shield-4+) are reused from the faction file. Load names follow
the file's convention: the card prints "Torpedoes", stored as "Torpedo" so the
torpedo stat lookup finds it (the same fix Shade got).

Run once from the repo root:  python scripts/add-260925-content.py
"""
import json
import hashlib


def mkid(faction, name):
    h = hashlib.md5(f"ingest:{faction}:{name}".encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"


def detect_indent(fp):
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
    return len(line) - len(line.lstrip(' ')) or 1


def glossary(data):
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


def rule(gloss, name):
    assert name in gloss, f'{name} not found in faction file'
    return json.loads(json.dumps(gloss[name]))


def insert_after(groups, marker, entry):
    if any(g['id'] == entry['id'] for g in groups):
        return 'already present'
    for i, g in enumerate(groups):
        if g['name'].startswith(marker):
            groups.insert(i + 1, entry)
            return f'after {g["name"]}'
    groups.append(entry)
    return 'appended'


# -- Shaltari_Combined_Fleet_Stats_260925.pdf p37 ---------------------------
SETI_NAME = "Seti the Kinslayer - Spear of Anubis Heavy Cruiser"
SETI_ALPHA_STRIKE = (
    "Dropships deploying Battalions from this Ship do not use the Mothership and Gateship-X special "
    "rules and can be deployed to any orbital layer. When you deploy any of this Ship’s Dropships to a "
    "Dropsite, Immediately remove that many enemy Battalions from that Dropsite."
)
SETI_LORE = (
    "Seti the Kinslayer is an infamously treacherous Shaltari who loves nothing better than fighting and "
    "ending his own kind. With no better targets, annihilating the lesser races will do. He was originally "
    "known as a ground commander but has since been known to helm a unique, personal vessel of heavy "
    "cruiser tonnage: the Spear of Anubis. Unusually, and excessively, this ship packs two vast torpedo "
    "tubes, presumably to achieve kills in a most satisfying manner. Those are augmented by a spinal "
    "mounted thermal lance cannon. Inside, a small teleportation chamber allows Seti and his warriors to "
    "make planetfall whenever the impersonality of void combat bores him. He is understood to relish the "
    "smells of smoke, death, and blood.\n\n"
    "Seti will attach himself to any tribe’s campaign so long as it promises good sport for him, but given "
    "his reputation, any starchief that accepts his sword should be permanently nervous. If anything, this "
    "reputation has soured further in recent years after the Brazilian incident and his gleefully vicious "
    "actions over Aaru in 2678."
)


def build_seti(gloss):
    return {
        "id": mkid('shaltari', SETI_NAME),
        "name": SETI_NAME,
        "category": "medium",
        "ship": {
            "name": SETI_NAME,
            "cost": 170,
            "stats": {"thrust": "8\"", "scan": "12\"", "sig": "6\"", "hull": 11, "es": "5+",
                      "ks": "4+", "bs": "6+", "g": "1", "special": "Hero, Shield-4+, Unique"},
            "weapons": [
                {"name": "Ancient Thermal Lance Cannon", "arc": "FN", "attack": "3", "lock": "2+",
                 "damage": "1", "type": "E", "special": "Bloom-1, Burnthrough-1, Critical-2"},
            ],
            "loads": [
                {"name": "Dropships", "launch": "2", "special": "Limited-2"},
                {"name": "Torpedo", "launch": "2", "special": "Limited-4"},
            ],
            "specialRules": [
                rule(gloss, "Hero"),
                rule(gloss, "Shield-4+"),
                rule(gloss, "Unique"),
                {"name": "Seti Alpha Strike", "description": SETI_ALPHA_STRIKE},
            ],
            "groupMin": 1,
            "groupMax": 1,
            "isRare": False,
            "isUnique": True,
            "tonnage": "M",
            "famousShipsPrefix": "Only ship of the class:",
            "famousShips": ["Spear of Anubis"],
            "lore": SETI_LORE,
        },
    }


# -- Bioficer_Combined_Fleet_Stats_260925.pdf p46 ---------------------------
AEON_NAME = "Aeon - The Ring Ship Heavy Cruiser"
SUMMONING = (
    "When you activate a Wing within 2” of this Ship, instead of moving them normally, you may remove "
    "them from the table, then place them anywhere within 18” of this Ship. Wings placed this way suffer "
    "the effects of any scenery they are placed on but ignore intervening scenery. Wings placed this way "
    "may form and divide into Wings as if they had moved normally. Wings placed this way cannot be the "
    "target of your Abilities until the end of the round (other players may target them with Abilities "
    "as normal)."
)
AEON_LORE = (
    "Reports of an apparently unique, lone Bioficer vessel have increased in recent months. UCMF crews "
    "have nicknamed it The Ring Ship, and the Admiralty have assigned the Intelligence that controls it "
    "the designation Aeon. Bioficer teleportation rings are known, but this one dominates the "
    "superstructure of a heavy cruiser and is larger than anything seen besides space stations, and this "
    "one is mobile. From these rings, Bioficer launch assets appear from elsewhere. They can also jump "
    "nearby launch assets limited distances. Both factors make them quite different from Shaltari "
    "teleporters and potentially more advanced.\n\n"
    "This ship also features an unusual prow armament for the Bioficers: a rack of physical missiles. "
    "These are essentially miniaturised versions of Bioficer torpedoes, so while they are damaging on "
    "impact, the real horror is when the warhead’s genitor cores churn out nightmares into the living "
    "spaces of the target. These distinctive systems imply that certain Bioficer Intelligences have a "
    "high degree of autonomy and personal resources to develop killing machines that suit their "
    "individual, twisted tastes."
)


def build_aeon(gloss):
    return {
        "id": mkid('bioficer', AEON_NAME),
        "name": AEON_NAME,
        "category": "medium",
        "ship": {
            "name": AEON_NAME,
            "cost": 175,
            "stats": {"thrust": "7\"", "scan": "11\"", "sig": "4\"", "hull": 9, "es": "4+",
                      "ks": "4+", "bs": "5+", "g": "1", "special": "Hero, Unique"},
            "weapons": [
                {"name": "Genitor Bomblets", "arc": "F", "attack": "8", "lock": "3+",
                 "damage": "1", "type": "K", "special": "Close Action, Corruptor-2"},
            ],
            "loads": [
                {"name": "Fighters & Bombers", "launch": "5", "special": "-"},
            ],
            "specialRules": [
                rule(gloss, "Hero"),
                rule(gloss, "Unique"),
                {"name": "Summoning", "description": SUMMONING},
            ],
            "groupMin": 1,
            "groupMax": 1,
            "isRare": False,
            "isUnique": True,
            "tonnage": "M",
            "famousShipsPrefix": "Only ship of the class:",
            "famousShips": ["The Ring Ship"],
            "lore": AEON_LORE,
        },
    }


def save(fp, d, indent):
    json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=indent, ensure_ascii=False)
    json.load(open(fp, encoding='utf-8'))


for key, marker, build in (('shaltari', 'Nefertem', build_seti), ('bioficer', 'Anode', build_aeon)):
    fp = f'data/faction-{key}.json'
    indent = detect_indent(fp)
    d = json.load(open(fp, encoding='utf-8'))
    where = insert_after(d['groups'], marker, build(glossary(d)))
    save(fp, d, indent)
    print(f'{fp}: {where}')

# UCM: "Francis" back to "Frances" (name, ship name and lore).
fp = 'data/faction-ucm.json'
indent = detect_indent(fp)
d = json.load(open(fp, encoding='utf-8'))
n = 0
for g in d['groups']:
    if 'Flying Dutchman' in g['name']:
        g['name'] = g['name'].replace('Francis', 'Frances')
        g['ship']['name'] = g['ship']['name'].replace('Francis', 'Frances')
        g['ship']['lore'] = g['ship']['lore'].replace('Francis', 'Frances')
        n += 1
save(fp, d, indent)
print(f'{fp}: Frances Mendoza ({n})')
print("\nNow run: python scripts/gen-fleet-data.py")
