#!/usr/bin/env python3
"""Fleet Space Station options from Fleet_Space_Stations_261104.pdf, pages 2 to 4.

    python scripts/build-station-features.py
    python scripts/gen-fleet-data.py

data/fleet-index.json `stationArmaments`: Weapon Systems, Structures, Features
and Upgrades with their points, and the generic stations' Hardpoints by size
(armaments up to 1/2/3, Features they must take 0/3/4, upgrades 1/1/2, where an
upgrade may be one Feature).

Each faction file's `spaceStations`:
  - generic Small/Medium/Large: cost 30/45/65, a Hardpoints rule.
  - every station: one rule per built-in Feature its Hardpoints names, with
    saves, Hull and effect.
  - `featurePicks` {required, optional}: Features it must or may buy.

Only the `spaceStations` block is rewritten (as JSON, in the file's own indent
and line endings), so the rest of each hand-formatted file is left alone.
Re-runnable: rules it wrote before are replaced, not doubled.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTIONS = ["bioficer", "phr", "resistance", "scourge", "shaltari", "ucm"]

FEATURES = [
    {"name": "Launch Control", "cost": 5, "es": "*", "ks": "*", "hull": 5,
     "effect": "This feature uses its Space Station’s best available saves. When all Launch Control Features are removed from a Space Station, that Station cannot Launch Assets."},
    {"name": "Weapons Control", "cost": 5, "es": "*", "ks": "*", "hull": 5,
     "effect": "This feature uses its Space Station’s best available saves. When all Weapons Control Features are removed from a Space Station, that Station cannot use its Weapon Systems."},
    {"name": "Life Support", "cost": 5, "es": "5+", "ks": "5+", "hull": 6,
     "effect": "When this Feature is removed, each player removes a Battalion from this Space Station. If this Space Station started with at least one Life Support Feature and has none remaining, at the end of each Cleanup step, each player removes a Battalion from this Space Station."},
    {"name": "Reactor Core", "cost": 0, "es": "5+", "ks": "5+", "hull": 6,
     "effect": "When this Feature or a Space Station with this feature is destroyed, it explodes with a Reactor Overload Explosion Effect with a range of D6+3”."},
    {"name": "Redundant Systems", "cost": 10, "es": "4+", "ks": "4+", "hull": 7,
     "effect": "This Space Station gains a 6+ Backup Save."},
    {"name": "Firing Computer", "cost": 10, "es": "5+", "ks": "5+", "hull": 5,
     "effect": "This Space Station’s Close Action weapons gain 6” additional range."},
    {"name": "Defensive Systems", "cost": 20, "es": "2+", "ks": "2+", "hull": 3, "effect": "None."},
    {"name": "Supercontrol Node", "cost": 25, "es": "4+", "ks": "4+", "hull": 6,
     "effect": "During the Activation and Asset Phases, you count as controlling this Space Station."},
]
FEATURES_NOTE = ("Each Fleet Space Station has a number of Features automatically, and may have the option to purchase "
                 "additional Features. If a Space Station has a specific Feature, it does not pay points for that Feature. "
                 "If it must or may take additional non-specific Features, those Features cost their stated points. "
                 "Space Stations may have multiple of the same Feature.")
WEAPONS = [
    ("Laser Armament", 15, {"arc": "F/S/R", "attack": "2", "lock": "3+", "damage": "1", "type": "E", "special": "Burnthrough-1, Flash-1"}),
    ("Mass Driver Armament", 10, {"arc": "F/S/R", "attack": "3", "lock": "3+", "damage": "1", "type": "K", "special": "-"}),
    ("Missile Armament", 5, {"arc": "F/S/R", "attack": "4", "lock": "3+", "damage": "1", "type": "K", "special": "Close Action"}),
]
STRUCTURES = [
    {"name": "Deep Space Tracking", "category": "Structures", "cost": 10, "oncePerStation": True,
     "effect": "When this Space Station targets enemy ships, Spikes on those ships have double their normal effect. So a Spike would increase the target’s Signature by 6” instead of 3”."},
    {"name": "Scanner Uplink", "category": "Structures", "cost": 15, "oncePerStation": True,
     "effect": "This Space Station’s Scan range is increased by 3”. In addition, friendly ships within 3” of one or more Space Stations with this special rule increase their Scan range by 3”. This special rule ceases to function while this Space Station is controlled by an enemy player."},
    {"name": "Defensive Garrison", "category": "Structures", "cost": 0, "oncePerStation": True, "exclusiveStructure": True,
     "effect": "This Structure does not cost points and can only be taken by a player that is the Defender in a scenario, choosing the scenario and agreeing with your opponent ahead of time. This Space Station starts the game with 2/3/4 Battalions on it for Small/Medium/Large Space Stations respectively. A Space Station that takes a Defensive Garrison cannot take any other Structures."},
    {"name": "Forward Operating Base", "category": "Structures", "cost": 0, "oncePerStation": True, "exclusiveStructure": True,
     "effect": "This Feature does not cost points and can only be taken by a player that is the Attacker in a scenario, choosing the scenario and agreeing with your opponent ahead of time. This Space Station may launch a single Bomber each round in addition to its normal launch (following Launch timing, restrictions, and your faction’s Bombers rules). Instead of attacking normally, you may remove this Bomber to place 2 Battalions on a Ship or Space Station in base contact with it. A Space Station that takes a Forward Operating Base cannot take any other Structures."},
]
UPGRADES = [
    {"name": "Astrobotanical Lab", "category": "Upgrades", "cost": 30, "isUpgrade": True, "subtitle": "Exo-Greenhouse",
     "effect": "Signature Bloom: Friendly Ships within this Space Station’s unmodified Signature are Hidden within its Bloom. Enemy Ships targeting a Hidden Ship’s Group ignore two Spikes if all Ships in the Group are Hidden. This rule has no effect while this Space Station is controlled by an enemy player."},
    {"name": "Defence Grid", "category": "Upgrades", "cost": 80, "isUpgrade": True, "subtitle": "Military Space Station",
     "weapons": [
         {"name": "35-KL Quad Mass Driver", "arc": "F/S/R", "attack": "4", "lock": "3+", "damage": "2", "type": "C", "special": "Bloom-4, Focused"},
         {"name": "9K-S Mass Driver", "arc": "F/S/R", "attack": "4", "lock": "2+", "damage": "1", "type": "K", "special": "-"},
         {"name": "9K-S Mass Driver", "arc": "F/S/R", "attack": "4", "lock": "2+", "damage": "1", "type": "K", "special": "-"},
         {"name": "NC-16 Missiles", "arc": "F/S/R", "attack": "6", "lock": "3+", "damage": "1", "type": "K", "special": "Close Action"},
         {"name": "NC-16 Missiles", "arc": "F/S/R", "attack": "6", "lock": "3+", "damage": "1", "type": "K", "special": "Close Action"}]},
]
UPGRADE_LINE = ("This station may be upgraded with {n} of the following: Astrobotanical Lab for +30 points, "
                "Defence Grid for +80 points, or one option from the Space Station Features list.")
GENERIC = {
    "Small Space Station": {"cost": 30, "arm": 1, "feat": 0, "upg": 1,
        "hardpoints": "This Space Station has a Weapons Control and a Life Support Feature. It may take one Armament from the Space Station Armaments list. " + UPGRADE_LINE.format(n=1)},
    "Medium Space Station": {"cost": 45, "arm": 2, "feat": 3, "upg": 1,
        "hardpoints": "This Space Station has a Life Support Feature. It must take three additional Features, and it may take up to two options from the Space Station Armaments list. " + UPGRADE_LINE.format(n=1)},
    "Large Space Station": {"cost": 65, "arm": 3, "feat": 4, "upg": 2,
        "hardpoints": "This Space Station has a Life Support Feature. It must take four additional Features, and it may take up to three options from the Space Station Armaments list. " + UPGRADE_LINE.format(n=2)},
}
NUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4}
WORD = {2: "Two", 3: "Three", 4: "Four"}
OLD_LIST_RULE = "Space Station Features list"


def saves(f):
    return f"ES {f['es']}, KS {f['ks']}, Hull {f['hull']}."


def built_in(hp):
    """Built-in Features a Hardpoints text names, in the order it names them."""
    hp = hp.split("This station may be upgraded")[0]
    found = []
    for f in FEATURES:
        m = re.search(r"\b(a|an|one|two|three|four) " + re.escape(f["name"]) + r"\b", hp)
        if m:
            found.append((m.start(), NUM[m.group(1)], f))
    return [(n, f) for _, n, f in sorted(found, key=lambda t: t[0])]


def feature_rules(hp):
    out = []
    for n, f in built_in(hp):
        name = f"{f['name']} Feature" if n == 1 else f"{WORD[n]} {f['name']} Features"
        out.append({"name": name, "effect": f"{saves(f)} {f['effect']}"})
    return out


def is_ours(name):
    names = "|".join(re.escape(f["name"]) for f in FEATURES)
    return name == OLD_LIST_RULE or re.match(r"^(Two |Three |Four )?(" + names + r") Features?$", name)


def picks(hp):
    req = re.search(r"must take (one|two|three|four) additional (?:option|Features?)", hp)
    opt = re.search(r"may take (one|two|three|four) additional", hp)
    return {"required": NUM[req.group(1)] if req else 0, "optional": NUM[opt.group(1)] if opt else 0}


def patch_station(st):
    g = GENERIC.get(st["name"])
    rules = [r for r in st.get("stationRules", []) if not is_ours(r.get("name", ""))]
    if g:
        st["cost"] = g["cost"]
        rules = [r for r in rules if r.get("name") != "Hardpoints"] + [{"name": "Hardpoints", "effect": g["hardpoints"]}]
    st.pop("featurePicks", None)
    out = []
    for r in rules:
        out.append(r)
        if r.get("name") == "Hardpoints":
            out += feature_rules(r["effect"])
            if not g:
                p = picks(r["effect"])
                if p["required"] or p["optional"]:
                    st["featurePicks"] = p
    st["stationRules"] = out
    return st


def value_end(raw, i):
    """Index just past the JSON array/object that opens at raw[i]."""
    depth, in_str, esc = 0, False, False
    for k in range(i, len(raw)):
        c = raw[k]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                return k + 1
    raise ValueError("unclosed JSON value")


def rewrite_block(path, key, fn):
    """Replace one top-level value in a hand-formatted JSON file, leaving the rest as it is."""
    raw = open(path, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    data = json.loads(raw)
    m = re.search(r'^( *)"' + re.escape(key) + r'": (?=[\[{])', raw, re.M)
    ind = m.group(1)
    start = m.end()
    end = value_end(raw, start)
    new = json.dumps(fn(data[key]), ensure_ascii=False, indent=len(ind)).replace("\n", nl + ind)
    s = raw[:start] + new + raw[end:]
    json.loads(s)
    open(path, "w", encoding="utf-8", newline="").write(s)


def drop_block(path, key):
    """Remove one top-level key (and the comma before it) from a hand-formatted JSON file."""
    raw = open(path, encoding="utf-8", newline="").read()
    m = re.search(r',\s*"' + re.escape(key) + r'": (?=[\[{])', raw)
    if not m:
        return
    s = raw[:m.start()] + raw[value_end(raw, m.end()):]
    json.loads(s)
    open(path, "w", encoding="utf-8", newline="").write(s)


def armaments():
    opts = [{"name": n, "category": "Weapon Systems", "cost": c, "weapons": [dict({"name": n}, **w)]} for n, c, w in WEAPONS]
    opts += STRUCTURES
    opts += [{"name": f["name"], "category": "Features", "cost": f["cost"], "es": f["es"], "ks": f["ks"],
              "hull": f["hull"], "effect": f"{saves(f)} {f['effect']}"} for f in FEATURES]
    opts += UPGRADES
    return {
        "note": "Fleet Space Station options, verbatim from Fleet_Space_Stations_261104.pdf pages 2 to 4. "
                "Generic stations take armaments up to armamentMaxBySize, the Features in featuresRequiredBySize, and "
                "up to upgradeCapBySize upgrades, where an upgrade may be one Feature. Faction stations buy Features "
                "per their featurePicks. Written by scripts/build-station-features.py.",
        "featuresNote": FEATURES_NOTE,
        "armamentMaxBySize": {k: v["arm"] for k, v in GENERIC.items()},
        "featuresRequiredBySize": {k: v["feat"] for k, v in GENERIC.items()},
        "upgradeCapBySize": {k: v["upg"] for k, v in GENERIC.items()},
        "options": opts,
    }


def patch_index():
    p = os.path.join(ROOT, "data", "fleet-index.json")
    drop_block(p, "stationFeatures")
    rewrite_block(p, "stationArmaments", lambda _old: armaments())


if __name__ == "__main__":
    for f in FACTIONS:
        rewrite_block(os.path.join(ROOT, "data", f"faction-{f}.json"), "spaceStations",
                      lambda sts: [patch_station(s) for s in sts])
        d = json.load(open(os.path.join(ROOT, "data", f"faction-{f}.json"), encoding="utf-8"))
        print(f"{f:11s} " + ", ".join(
            f"{s['name']} {s['cost']}" + (f" picks {s['featurePicks']['required']}+{s['featurePicks']['optional']}" if 'featurePicks' in s else "")
            for s in d["spaceStations"]))
    patch_index()
    print("fleet-index.json stationArmaments written")
