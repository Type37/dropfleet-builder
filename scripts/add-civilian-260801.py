#!/usr/bin/env python3
"""Add the one new ship from Civilian_Ships_Scenarios_260801 (M.A.B. 67 Fuel
Transport) to every faction file + the fleet-data.json mirror, following the same
cross-faction "Misc Ships" convention as EX-7 / Argonaut / OBV-64 (additional: true,
Mercenary keeps its verbatim "loses its Boardable..." clause; Boardable and Civilian
Transport themselves stay stripped from the Special line per the v344 removal).

Stats, weapons, rules and lore are verbatim from the PDF (page 6). The Fuel
Transporter rule grants a 2AP Ability ("Fully Fuelled"); it is carried inside that
rule's text rather than in abilitiesTable, which holds Admiral Abilities only.
Idempotent: re-running replaces the group rather than duplicating it.
"""
import json, glob, hashlib

def mkid(name):
    h = hashlib.md5(name.encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

MAB67 = {
    "id": mkid("M.A.B. 67 Fuel Transport"),
    "name": "M.A.B. 67 Fuel Transport",
    "category": "light",
    "ship": {
        "name": "M.A.B. 67 Fuel Transport",
        "cost": 55,
        "stats": {
            "thrust": "9\"", "scan": "6\"", "sig": "4\"", "hull": 6,
            "es": "4+", "ks": "4+", "bs": "6+", "g": "1-2",
            "special": "Vectored"
        },
        "weapons": [
            {"name": "Deterrence Missiles", "arc": "F/S", "attack": "4",
             "lock": "3+", "damage": "1", "type": "K", "special": "Alt-1, Close Action"},
            {"name": "Ignite Reserves", "arc": "F/S/R", "attack": "0",
             "lock": "2+", "damage": "2", "type": "E", "special": "Alt-1, Close Action, Fusillade-2"},
        ],
        "loads": [],
        "specialRules": [
            {"name": "Vectored",
             "description": "This Ship may make an additional turn at any point during its movement, regardless of the Order its Group has taken."},
            {"name": "Fuel Transporter",
             "description": "While a Ship with this rule is on the table, you have access to the following Ability:\n\nFully Fuelled (2AP): At the start of a friendly Group’s activation, if that Group is within 3” and on the same Orbital Layer as a Ship with the Fuel Transporter rule, the friendly Group increases its total movement (after Orders) by 3” this round. If that Group is on the Max Thrust order, it increases its total movement (after Orders) by 6” this round instead.\nIf the friendly Group is C Tonnage, that Group must be within 3” and on the same Orbital Layer as two Ships with the Fuel Transporter rule instead.\nShips with the Fuel Transporter rule are unaffected by this Ability."},
            {"name": "Ignite Reserves",
             "description": "After completing an attack with this Weapon, this Ship is destroyed (a weapon with 0 Attack value does not roll to hit, does not cause any saves to be made, and does not inflict damage due to hits).\n\nWhen this Ship is destroyed (for any reason), it explodes with a Fuel Detonation effect and a range of 3”. Ships damaged by this explosion also gain a Fire token."},
            {"name": "Mercenary",
             "description": "This Ship may be used in any Fleet regardless of faction. When taken as part of your fleet, this Ship loses its Boardable and Civilian Transport rules."},
        ],
        "groupMin": 1, "groupMax": 2,
        "isRare": False, "isUnique": False,
        "tonnage": "L",
        "lore": (
            "The Maganum Asset Bureau was once one of the largest civilian infrastructure manufacturers in the colonies prior to "
            "the inception of the UCM. Hailing from a relatively quiet colony with a focus on agriculture, the M.A.B. developed and "
            "put into service a multitude of logistical vessels. Many were designed to transport Maganum’s bountiful harvests to "
            "other colony worlds, such as the M.A.B. 45 and 46, with holds designed to keep live seafood and store masses of frozen "
            "produce, keeping the colonies main source of protein moving.\n\n"
            "Then there was the M.A.B. 67, arguably, the Bureau’s most successful design. This transport is able to safely carry "
            "an exceptional volume of various types of fuel, from Maganum’s simple biofuels, to the hypercompressed metallic "
            "hydrogen that keeps the UCM war machine running. Built to exacting standards, the 67 has one of the strongest and most "
            "reliable power plants for a ship of its size. As it was never expected to see actual combat, the reactors do not have the "
            "automatic shutdown safeties of UCM combat ships, indeed if the ship were to see combat, it is quite possible that any "
            "damage to the reactors could cause a major containment breach, flooding compartments with highly volatile plasma.\n\n"
            "The ubiquity of the line meant that they were scattered far and wide at the time of the Scourge invasion, now there are "
            "67’s amongst almost all the major players of the time. The UCM have continued to produce small numbers of this ship, "
            "while M.A.B. has dwindled, they still produce original and updated designs and have mostly superseded the 67 with the "
            "much more efficient 192, a built for purpose, clearly UCM design. The Scourge have re-purposed many of these ships into "
            "water transports and rarely use them for transporting fuel, while the PHR still make use of refit variants for their "
            "logistics purposes. Many of these have been seen in resistance hands, several are part of the Vega Scrapfleet and Kalium "
            "have seemingly gotten or reverse engineered the designs to produce more ships of the class, though are much more reckless "
            "with them than any other faction."
        ),
        "additional": True,
        "famousShipsPrefix": "Famous ships of the class:",
        "famousShips": [
            "Fire in a Can", "Petrol Pusher (UCM)", "Jugnaut", "Juice Sluice",
            "Bottle Bearer (Vega Scrapfleet)", "Logistics Vessel KLV-822 (Kalium)"
        ],
    }
}

NEW = [MAB67]
NEW_NAMES = {g["name"] for g in NEW}

def add_to_groups(groups):
    kept = [g for g in groups if g.get("name") not in NEW_NAMES]
    for g in NEW:
        kept.append(json.loads(json.dumps(g)))
    return kept

def detect_indent(fp):
    """Faction files are not uniformly formatted (UCM is 2-space, the rest 1-space).
    Match whatever the file already uses so the diff stays to the added group."""
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
    return len(line) - len(line.lstrip(' ')) or 1

total = 0
for fp in glob.glob('data/faction-*.json'):
    indent = detect_indent(fp)
    d = json.load(open(fp, encoding='utf-8'))
    d['groups'] = add_to_groups(d['groups'])
    json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=indent, ensure_ascii=False)
    total += 1
    print(f"{fp}: groups now {len(d['groups'])} (indent {indent})")

fd_indent = detect_indent('data/fleet-data.json')
fd = json.load(open('data/fleet-data.json', encoding='utf-8'))
for key, fac in fd.get('factions', {}).items():
    if 'groups' in fac:
        fac['groups'] = add_to_groups(fac['groups'])
json.dump(fd, open('data/fleet-data.json', 'w', encoding='utf-8', newline=''), indent=fd_indent, ensure_ascii=False)
print(f"data/fleet-data.json: {len(fd['factions'])} factions updated")
print("M.A.B. 67 id:", MAB67['id'])
print("DONE, files:", total + 1)
