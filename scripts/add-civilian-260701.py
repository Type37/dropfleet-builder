#!/usr/bin/env python3
"""Add the two new ships from Civilian_Ships_Scenarios_260701 (EX-7 Packet Runner,
Argonaut) to every faction file + the fleet-data.json mirror, following the same
cross-faction "Misc Ships" convention as OBV-64 / VX-22 (additional: true, Mercenary
keeps its verbatim "loses its Boardable..." clause; Boardable + Civilian Transport
themselves stay stripped from the special line per the v344 removal).

Stats/weapons/rules/lore are verbatim from the PDF. Standard rule descriptions
(Monitor, Reinforced Armour, Rare, Impetuous) are the same verbatim text already
used elsewhere in the data; weapon specials (Close Action, Scald-2, Sustained Fire,
Arrest-2, Impel-2) resolve from data/fleet-data.json > sharedRules at runtime.
Idempotent: re-running replaces the two groups rather than duplicating them.
"""
import json, glob, hashlib

def mkid(name):
    h = hashlib.md5(name.encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

EX7 = {
    "id": mkid("EX-7 Packet Runner"),
    "name": "EX-7 Packet Runner",
    "category": "light",
    "ship": {
        "name": "EX-7 Packet Runner",
        "cost": 57,
        "stats": {
            "thrust": "6\"", "scan": "4\"", "sig": "3\"", "hull": 6,
            "es": "4+", "ks": "5+", "bs": "6+", "g": "1",
            "special": "Monitor, Reinforced Armour"
        },
        "weapons": [
            {"name": "Deterrence Missiles", "arc": "F/S", "attack": "4",
             "lock": "3+", "damage": "1", "type": "K", "special": "Close Action"}
        ],
        "loads": [],
        "specialRules": [
            {"name": "Monitor",
             "description": "Ships with this rule may not use Course Change or Max Thrust orders."},
            {"name": "Reinforced Armour",
             "description": "Weapons rolling to hit this Ship or its Group can only score criticals against it on a result of a 3 higher than its Lock value."},
            {"name": "Feature Carrier",
             "description": "This ship starts the game carrying a single deployable Hangar Feature (see 7.4.2 Deploying Features and 11.3 Features)."},
            {"name": "Space Trucker",
             "description": "This Ship's Hangar Deployable Feature can only be deployed to Space Stations (of any type)."},
            {"name": "Mercenary",
             "description": "This Ship may be used in any Fleet regardless of faction. When taken as part of your fleet, this Ship loses its Boardable and Civilian Transport rules."},
        ],
        "groupMin": 1, "groupMax": 1,
        "isRare": False, "isUnique": False,
        "tonnage": "L",
        "lore": (
            "The EX-7 Packet-Runner is a common courier craft used throughout the territories of the United Colonies of Mankind. "
            "Designed for routine parcel and sensitive package transport, it prioritizes simple construction and dependable operation "
            "over appearance or refinement. Most examples in service are visibly beaten up and poorly maintained, their worn hulls "
            "reflecting constant use and minimal upkeep.\n\n"
            "They are Built around a straightforward modular frame, similar to other workhorse craft like the T-Type utility haulers "
            "and the smaller VX-22 Flesners. The EX-7 typically consists of little more than the essentials: cockpit, drive assembly, "
            "and standardized cargo racks bolted into a compact hull with the cargo containers mounted underneath.\n\n"
            "Though rarely the focus of attention, EX-7 Packet-Runners move a constant flow of everyday freight between stations, "
            "depots, and outposts, quietly handling the unglamorous but essential task of keeping day-to-day logistics running. "
            "Colonial authorities have repurposed many of these ships for the express purpose of resupplying fighter and bomber "
            "support craft. Their cargo containers filled with factory-fresh compliments of fighters and bombers waiting for an "
            "appropriate launch platform. Experimental versions of these containers have been developed to effortlessly convert "
            "standardised hardpoints on space stations into makeshift hangar bays."
        ),
        "additional": True,
        "famousShipsPrefix": "Known ships of the class:",
        "famousShips": ["Cargoer", "Pack Rat", "Porch Pirate (independents)", "Logistics Vessel KLV-302 (Kalium)"],
    }
}

ARGONAUT = {
    "id": mkid("Argonaut"),
    "name": "Argonaut",
    "category": "medium",
    "ship": {
        "name": "Argonaut",
        "cost": 112,
        "stats": {
            "thrust": "10\"", "scan": "4\"", "sig": "2\"", "hull": 11,
            "es": "5+", "ks": "5+", "bs": "6+", "g": "1-2",
            "special": "Impetuous, Rare"
        },
        "weapons": [
            {"name": "Thermal Lash", "arc": "F/S/R", "attack": "3", "lock": "3+",
             "damage": "2", "type": "E", "special": "Scald-2, Sustained Fire"},
            {"name": "Force Wave", "arc": "F/S", "attack": "4", "lock": "3+",
             "damage": "1", "type": "K", "special": "Arrest-2, Impel-2"},
        ],
        "loads": [],
        "specialRules": [
            {"name": "Impetuous",
             "description": "At the start of each round, friendly Groups with this rule improve the Lock of their Weapon Systems by 1 until you activate a friendly Group without this rule."},
            {"name": "Rare",
             "description": "You may only take one Group of this Ship in a Skirmish-sized game, two in a Clash, three in a Battle, and four in a Reconquest."},
            {"name": "Thermal Lash",
             "description": "This weapon can only be used against targets in base contact.\nWhen you inflict damage with this weapon, you may remove a Spike from this Group, if you do, the defending Group gains a Spike."},
            {"name": "Mind of its Own",
             "description": "This Ship can be used in any fleet, regardless of faction but does not count towards point spent on M Tonnage Ships when building your fleet. This Ship cannot have an Admiral assigned to it for any reason.\nInstead of picking an Order for this Group when it activates, it may in any order; turn in any direction, move up to its Thrust, attack with any number of its weapons gaining a Spike for each additional Weapon System assigned after the first. Each option can only be chosen once per activation.\nAt the end of this Group's activation, if it did not gain any Spikes, remove a Spike from it."},
        ],
        "groupMin": 1, "groupMax": 1,
        "isRare": True, "isUnique": False,
        # "Mind of its Own": this Ship cannot have an Admiral assigned to it for any
        # reason. Enforced in list-building (excluded from the Capital-ship host list).
        "noAdmiral": True,
        "tonnage": "M",
        "lore": (
            "Though there has been extensive speculation on the viability or even potential existence of any kind of life adapted "
            "for the vacuum of space, none have been able to prove any hypothesis one way or another. The complete alien nature of "
            "something that could feasibly live without any kind of atmosphere or gravity pushes the limits of human speculation. "
            "Though themselves alien, every other race humanity has encountered has had a terrestrial origin. PHR expeditionary "
            "fleets have almost by accident stumbled into proof of space-based lifeforms. A solitary, anomalous creature was found "
            "in a small orange dwarf system. For an as-yet-unknown reason, this creature was traversing a veritable cosmic backwater "
            "with nought but ice and gas giants. Seemingly passive, the creature ignored the survey fleet, at least until it closed "
            "in. Initially curious, the creature allowed a single survey vessel close enough to scan, though was likely taking in all "
            "it could of the strange mechanical interloper.\n\n"
            "It's temperament suddenly changed, however, when a second survey vessel moved to its opposite flank. Without warning, it "
            "unleashed a tentacle that damn near tore the closest ship in half. If it wasn't for the quick thinking of the crew the "
            "ship could well have been lost to the attack. The flanking ship was hit by an attack with no discernible origin. "
            "Crushing forces impacted the ship and though little structural damage was caused, they were pushed into a completely "
            "different heading and at a much reduced velocity.\n\n"
            "Fortunately both ships had completed detailed scans of the creature, and although these are currently highly classified, "
            "news of this incredible discovery, now dubbed \"The Argonaut\", is reaching the ears of those back in the republic. "
            "Unfortunately, both survey ships have been prevented from returning to PHR space and have been instructed to seek the "
            "nearest safe-haven to repair and shelter. While the Solar system is hardly safe, it is the largest concentration of PHR "
            "assets within a reasonable distance, and is about as safe as anywhere else."
        ),
        "additional": True,
        "famousShipsPrefix": "Encountered individual:",
        "famousShips": ["Astrofauna HD215152-A"],
    }
}

NEW = [EX7, ARGONAUT]
NEW_NAMES = {g["name"] for g in NEW}

def add_to_groups(groups):
    # drop any existing copies (idempotent), then append fresh
    kept = [g for g in groups if g.get("name") not in NEW_NAMES]
    for g in NEW:
        kept.append(json.loads(json.dumps(g)))
    return kept

total = 0
for fp in glob.glob('data/faction-*.json'):
    d = json.load(open(fp, encoding='utf-8'))
    d['groups'] = add_to_groups(d['groups'])
    json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    total += 1
    print(f"{fp}: groups now {len(d['groups'])}")

# fleet-data.json mirror: factions.<key>.groups
fd = json.load(open('data/fleet-data.json', encoding='utf-8'))
for key, fac in fd.get('factions', {}).items():
    if 'groups' in fac:
        fac['groups'] = add_to_groups(fac['groups'])
json.dump(fd, open('data/fleet-data.json', 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
print(f"data/fleet-data.json: {len(fd['factions'])} factions updated")
print("EX-7 id:", EX7['id'], "| Argonaut id:", ARGONAUT['id'])
print("DONE, files:", total + 1)
