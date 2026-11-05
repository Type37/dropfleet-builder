#!/usr/bin/env python3
"""Space Station Features from Fleet_Space_Stations_261104.pdf, page 2, verbatim.

    python scripts/build-station-features.py

Writes the list to data/fleet-index.json (`stationFeatures`) and, for every
faction station whose Hardpoints rule names Features, adds a station rule per
built-in Feature (saves, Hull, effect) right after Hardpoints. A Hardpoints rule
that mentions the Space Station Features list also gets that list, with points.
Re-runnable: entries it wrote before are replaced, not doubled.
Then run scripts/gen-fleet-data.py.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
RULE_NOTE = ("Each Fleet Space Station has a number of Features automatically, and may have the option to purchase "
             "additional Features. If a Space Station has a specific Feature, it does not pay points for that Feature. "
             "If it must or may take additional non-specific Features, those Features cost their stated points. "
             "Space Stations may have multiple of the same Feature.")
NUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4}
WORD = {2: "Two", 3: "Three", 4: "Four"}
LIST_NAME = "Space Station Features list"


def saves(f):
    return f"ES {f['es']}, KS {f['ks']}, Hull {f['hull']}."


def built_in(hp):
    out = []
    for f in FEATURES:
        m = re.search(r"\b(a|an|one|two|three|four) " + re.escape(f["name"]) + r"\b", hp)
        if m:
            out.append((m.start(), NUM[m.group(1)], f))
    return [(n, f) for _, n, f in sorted(out, key=lambda t: t[0])]


def entries(hp):
    rules = []
    for n, f in built_in(hp):
        name = f"{f['name']} Feature" if n == 1 else f"{WORD[n]} {f['name']} Features"
        rules.append({"name": name, "effect": f"{saves(f)} {f['effect']}"})
    if LIST_NAME in hp:
        body = " ".join(f"{f['name']}, {f['cost']} pts, {saves(f)[:-1]}: {f['effect']}" for f in FEATURES)
        rules.append({"name": LIST_NAME, "effect": RULE_NOTE + " " + body})
    return rules


def ours(name):
    return name == LIST_NAME or re.match(r"^(Two |Three |Four )?(" + "|".join(re.escape(f["name"]) for f in FEATURES) + r") Features?$", name)


def patch_faction(path):
    raw = open(path, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    lines = raw.split(nl)
    # drop entries this script wrote before
    out, i, removed = [], 0, 0
    while i < len(lines):
        m = re.match(r'^(\s*)\{$', lines[i])
        if m and i + 3 < len(lines):
            nm = re.match(r'^\s*"name": "(.*)",$', lines[i + 1])
            if nm and ours(json.loads('"' + nm.group(1) + '"')) and re.match(r'^\s*"effect": ', lines[i + 2]) and lines[i + 3].strip() in ("}", "},"):
                if lines[i + 3].strip() == "}" and out and out[-1].rstrip().endswith("},"):
                    out[-1] = out[-1].rstrip()[:-1]
                i += 4; removed += 1
                continue
        out.append(lines[i]); i += 1
    lines = out
    added = 0
    i = 0
    while i < len(lines):
        if lines[i].strip() == '"name": "Hardpoints",':
            eff = re.match(r'^(\s*)"effect": (".*")$', lines[i + 1])
            hp = json.loads(eff.group(2))
            close = lines[i + 2]
            ind = re.match(r'^(\s*)', close).group(1)
            new = entries(hp)
            if new:
                block = []
                for r in new:
                    block += [ind + "},", ind + "{", f'{ind} "name": {json.dumps(r["name"], ensure_ascii=False)},',
                              f'{ind} "effect": {json.dumps(r["effect"], ensure_ascii=False)}']
                trail = close.strip()[1:]  # "" or ","
                lines[i + 2:i + 3] = block + [ind + "}" + trail]
                added += len(new)
                i += len(block)
        i += 1
    s = nl.join(lines)
    json.loads(s)
    open(path, "w", encoding="utf-8", newline="").write(s)
    return removed, added


def patch_index():
    p = os.path.join(ROOT, "data", "fleet-index.json")
    raw = open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    blob = json.dumps({"source": "Fleet_Space_Stations_261104.pdf p2", "note": RULE_NOTE, "features": FEATURES},
                      ensure_ascii=False, indent=1).replace("\n", nl + " ")
    if '"stationFeatures":' in raw:
        raw = re.sub(r'"stationFeatures": \{.*?' + re.escape(nl) + r' \},', lambda m: '"stationFeatures": ' + blob + ',', raw, count=1, flags=re.S)
    else:
        raw = raw.replace(' "stationArmaments":', ' "stationFeatures": ' + blob + ',' + nl + ' "stationArmaments":', 1)
    json.loads(raw)
    open(p, "w", encoding="utf-8", newline="").write(raw)


if __name__ == "__main__":
    for f in ["bioficer", "phr", "resistance", "scourge", "shaltari", "ucm"]:
        r, a = patch_faction(os.path.join(ROOT, "data", f"faction-{f}.json"))
        print(f"{f:11s} removed {r:2d}  added {a:2d}")
    patch_index()
    print("fleet-index.json stationFeatures written")
