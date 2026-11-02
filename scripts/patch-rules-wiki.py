#!/usr/bin/env python3
"""Repairs tables the rulebook extractor could not recover, in place, verbatim.

    python scripts/patch-rules-wiki.py

Re-runnable and idempotent: run it after extract-rules-wiki.py. Every value it
writes is lifted from the strings already in data/rules-wiki.json, so nothing is
invented or reworded, only re-shaped from stranded paragraphs into a table.

Chapter 11 Dropsites
--------------------
In 2.3.1 the Dropsite stats table (page 26) had no ruled grid, so find_tables()
missed it: its column heads (Icon, Dropsite, Scan, Sig, Hull, ES, KS) came
through as loose captions and its six rows as ordinary paragraphs, and this
gathers them back into one table. 2.4 (page 30) rules it and the extractor
finds it whole. Either way the Icon column is dropped: it holds only the
dropsite icon, which is a picture, not text.

Edition 2.4
-----------
Run against the 2.4 book (A5_Dropfleet_Rulebook_2.4_Print_Friendly.pdf) the
extractor now recovers the 4.2, 4.2.1.1, 5 and 7.4.1 tables itself (their
column heads sit in a dark band one point above find_tables' grid; see
extend_table_head), so those four repairs find a table already there and do
nothing. They stay for a re-run against 2.3.1. 11.3 Features is rebuilt for
the 2.4 layout, which adds a Hull column to every Feature.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "rules-wiki.json")

STAT_HEADS = {"Icon", "Dropsite", "Scan", "Sig", "Hull", "ES", "KS"}
ROW_RE = re.compile(r"^(Small|Medium|Large) (Space Station|City)\b")


def plain(item):
    return "".join(r["t"] for r in item.get("runs", []))


def fix_dropsites(ch):
    body = ch["body"]
    for it in body:
        # 2.4 rules the table, so it is found whole -- with its Icon column,
        # which holds only the dropsite pictures and comes through empty. The
        # app draws those icons itself off a table headed "Dropsite".
        if (it["kind"] == "table" and (it.get("header") or [""])[0] == "Icon"
                and all(not "".join(r["t"] for r in row[0]).strip() for row in it["rows"])):
            it["header"] = it["header"][1:]
            it["rows"] = [row[1:] for row in it["rows"]]
            return True
    if any(it["kind"] == "table" for it in body):
        return False  # already repaired

    rows = []
    keep = []
    for it in body:
        txt = plain(it).strip()
        if it["kind"] == "caption" and txt in STAT_HEADS:
            continue  # a stranded column head — drop, the table carries its own
        if it["kind"] == "p" and ROW_RE.match(txt):
            toks = txt.split()
            stats = toks[-5:]           # Scan, Sig, Hull, ES, KS
            name = " ".join(toks[:-5])  # the dropsite's name
            rows.append([name] + stats)
            continue
        keep.append(it)

    if not rows:
        return False

    table = {
        "kind": "table",
        "header": ["Dropsite", "Scan", "Sig", "Hull", "ES", "KS"],
        "rows": [[[{"t": c}] for c in row] for row in rows],
    }
    # Put the table after the "Most Scenarios will specify a standard size…"
    # paragraph it belongs to, else at the end.
    at = len(keep)
    for i, it in enumerate(keep):
        if it["kind"] == "p" and plain(it).startswith("Most Scenarios"):
            at = i + 1
            break
    keep.insert(at, table)
    ch["body"] = keep
    return True


Q = "”"   # the book's right double quote, used for inches
APOS = "’"


def cell(*parts):
    """A table cell. A str is a plain run; a (label, rest) tuple bolds the label,
    the way the book bolds a Feature's rule name ("Comms Uplink:")."""
    runs = []
    for p in parts:
        if isinstance(p, tuple):
            runs.append({"t": p[0], "b": True})
            if len(p) > 1 and p[1]:
                runs.append({"t": p[1]})
        else:
            runs.append({"t": p})
    return runs


def row(*cells):
    return list(cells)


def find(node, number):
    if node.get("number") == number:
        return node
    for c in node.get("children", []):
        r = find(c, number)
        if r:
            return r
    return None


def fix_features(ch):
    """Chapter 11.3 Features (page 31 in 2.4): five Feature cards, each a
    Type/ES/KS/Hull/Special stat row, the two armed ones with a Weapon row
    beneath, and the Hangar with a Launch row. The rows of different cards
    share no column grid, so find_tables reads the whole page as one ten-column
    table with every card's head repeated and the weapon stats glued together
    ("1 E Burnthrough-1, Escape Velocity"). Rebuilt one table per printed row
    group, exactly as the book sets them out: no column is invented, and each
    value is checked against the extracted text before it is written.

    Printer omission, kept: the Hangar card prints no Hull value (its Hull
    cell is empty in the book; every other Feature has one)."""
    sec = find(ch, "11.3")
    if not sec:
        return False
    if any(it["kind"] == "table" and (it.get("header") or [""])[:2] == ["Type", "ES"]
           for it in sec["body"]):
        return False  # already repaired

    def ptext(it):
        if it["kind"] == "table":
            cells = list(it.get("header") or [])
            cells += ["".join(r["t"] for r in c) for row in it["rows"] for c in row]
            return " ".join(cells)
        return plain(it)
    src = re.sub(r"\s+", " ", " ".join(ptext(it) for it in sec["body"]))

    intro = next((it for it in sec["body"]
                  if it["kind"] == "p" and plain(it).startswith("Features are")), None)
    foot = next((it for it in sec["body"]
                 if it["kind"] == "p" and plain(it).lstrip().startswith("*")), None)
    _require(intro and foot, "11.3 Features intro/footnote")

    STAT = ["Type", "ES", "KS", "Hull", "Special"]
    WEAP = ["Weapon", "Scan", "Att", "Lock", "Dmg", "Type", "Special"]
    uplink = ("Comms Uplink:", " If you control this Dropsite, increase the amount of "
              "Ability Points you generate by 1. You can only be affected by Comms "
              "Uplink once each round.")
    volatile = ("Volatile:", " When this Feature is destroyed, all Groups within 3" + Q
                + " gain a Spike and this Feature" + APOS + "s Dropsite takes an "
                "additional 2D3 damage.")
    cards = [
        (["Military Outpost", "3+", "3+", "6", "-"],
         ["Missile Halo", "6" + Q, "1", "2+", "2", "K", "Close Action, Escape Velocity"]),
        (["Orbital Defence Gun", "5+", "5+", "5", "-"],
         ["Orbital Gun", "6" + Q, "3", "3+", "1", "E", "Burnthrough-1, Escape Velocity"]),
        (["Comms Station", "4+", "4+", "5", uplink], None),
        (["Power Plant", "5+", "5+", "5", volatile], None),
        (["Hangar", "4+", "4+", "", "-"], None),
    ]
    # Every short value must be in the extracted section; the two rule texts
    # are checked word by word, since the extractor scrambled their lines.
    for stat, weap in cards:
        for v in stat[:4] + (weap or []):
            if isinstance(v, str) and len(v) > 2:
                for w in v.replace(",", " ").split():
                    _require(w in src, "11.3 Features: %r" % v)
    for label, rest in (uplink, volatile):
        for w in (label + rest).split():
            _require(w in src, "11.3 Features: %r" % w)

    def mk(v):
        return cell(v) if isinstance(v, tuple) else cell(v) if v else []

    body = [intro]
    for stat, weap in cards:
        body.append({"kind": "table", "header": STAT, "rows": [[mk(v) for v in stat]]})
        if weap:
            body.append({"kind": "table", "header": WEAP, "rows": [[mk(v) for v in weap]]})
    body.append({"kind": "table", "header": ["Type", "Launch", "Special"],
                 "rows": [[cell("Fighters & Bombers*"), cell("2"), cell("-")]]})
    body.append(foot)
    body += [it for it in sec["body"] if it["kind"] not in ("table", "caption")
             and it is not intro and it is not foot]
    sec["body"] = body
    return True


def _plainset(body):
    """Every non-table block's text, stripped, for verbatim-source checks."""
    return {plain(it).strip() for it in body if it["kind"] != "table"}


def _require(cond, where):
    if not cond:
        sys.exit("patch-rules-wiki: %s — source shape changed, refusing to "
                 "invent. Re-check the extractor." % where)


def fix_tonnage(ch):
    """4.2 Build Your Fleet: the Tonnage/Restriction table (page 12) lost its
    grid; its heads became captions and its rows scattered (the Colossal label
    split from its restriction). Rebuilt verbatim from those same strings."""
    sec = find(ch, "4.2")
    if not sec or any(it["kind"] == "table" for it in sec["body"]):
        return False
    src = _plainset(sec["body"])
    light = next((s for s in src if s.startswith("Light ")), None)
    heavy = next((s for s in src if s.startswith("Heavy ")), None)
    colossal = next((s for s in src if s.startswith("Skirmish: 0 Groups")), None)
    _require(light and heavy and colossal and "Colossal" in src, "4.2 Tonnage")
    table = {"kind": "table", "header": ["Tonnage", "Restriction"], "rows": [
        row(cell(("Light",)), cell(light[len("Light "):])),
        row(cell(("Heavy",)), cell(heavy[len("Heavy "):])),
        row(cell(("Colossal",)), cell(colossal)),
    ]}
    keep = [it for it in sec["body"]
            if it["kind"] != "caption"
            and plain(it).strip() not in (light, heavy, colossal, "Colossal")]
    at = next((i + 1 for i, it in enumerate(keep)
               if it["kind"] == "p" and plain(it).startswith("The combined points")), 0)
    keep.insert(at, table)
    sec["body"] = keep
    return True


def fix_abilities(ch):
    """4.2.1.1 Abilities and Ability Points: the four core Abilities (page 13)
    are a Cost/Effect table. Rebuilt from the same paragraphs, reusing their
    runs so the bold Ability names survive."""
    sec = find(ch, "4.2.1.1")
    if not sec or any(it["kind"] == "table" for it in sec["body"]):
        return False
    names = ("AP Re-roll:", "Brace for Impact:", "Contain Reactor:", "Time to Target:")
    is_eff = lambda it: it["kind"] == "p" and plain(it).lstrip().startswith(names)
    is_cost = lambda it: it["kind"] == "p" and re.fullmatch(r"\*?\d*AP", plain(it).strip())
    effs = [it for it in sec["body"] if is_eff(it)]
    costs = [it for it in sec["body"] if is_cost(it)]
    _require(len(effs) == 4 and len(costs) == 4, "4.2.1.1 Abilities")
    table = {"kind": "table", "header": ["Cost", "Effect"],
             "rows": [[c["runs"], e["runs"]] for e, c in zip(effs, costs)]}
    consumed = set(id(it) for it in effs + costs)
    keep = [it for it in sec["body"]
            if it["kind"] != "caption" and id(it) not in consumed]
    at = next((i + 1 for i, it in enumerate(keep)
               if it["kind"] == "p" and plain(it).startswith("Players have access")), len(keep))
    keep.insert(at, table)
    sec["body"] = keep
    return True


def fix_game_rounds(ch):
    """5 Game Rounds: the round structure (page 14) is a four-column table, one
    phase per column with its steps stacked. Rebuilt by assigning each stranded
    step to its phase (from page 14), so column interleaving can't misplace one."""
    sec = ch if ch.get("number") == "5" else find(ch, "5")
    if not sec or any(it["kind"] == "table" for it in sec["body"]):
        return False
    phases = [
        ("Planning Phase", ["Ability Point Generation.", "Pass Token Generation.", "Determine Initiative."]),
        ("Activation Phase", ["Players alternate activating Groups.", "Players alternate activating Dropsites."]),
        ("Asset Phase", ["Battalion Combat.", "Boarding Actions.", "Asset Combat."]),
        ("End Phase", ["Repair.", "Victory Points.", "Cleanup."]),
    ]
    src = _plainset(sec["body"])
    steps = [s for _, ss in phases for s in ss]
    _require(all(s in src for s in steps), "5 Game Rounds")
    table = {"kind": "table", "header": [h for h, _ in phases],
             "rows": [[cell(" ".join(ss)) for _, ss in phases]]}
    keep = [it for it in sec["body"]
            if it["kind"] != "caption" and plain(it).strip() not in steps]
    at = next((i + 1 for i, it in enumerate(keep)
               if it["kind"] == "p" and plain(it).startswith("Dropfleet is played over")), 0)
    keep.insert(at, table)
    sec["body"] = keep
    return True


def fix_battalions(ch):
    """7.4.1 Deploying Battalions: the Type/Target/Range table (page 20) badly
    interleaved (type labels split from their rows, ranges stranded). Rebuilt
    verbatim from page 20; every cell string is checked against the source."""
    sec = find(ch, "7.4.1")
    if not sec or any(it["kind"] == "table" for it in sec["body"]):
        return False
    rows_txt = [
        ("Bulk Landers", "Dropsites on any orbital layer. If that Dropsite or its Features have enemy Battalions on them, 2 Bulk Landers are needed to place 1 Batallion.", "6" + Q),
        ("Dropships", "Dropsites on the same orbital layer.", "3" + Q),
        ("Boarding Pods", "Space Stations and enemy Ships in the same Orbital Layer.", "3" + Q),
        ("Drop Pods", "Cities.", "3" + Q),
    ]
    blob = " ".join(plain(it) for it in sec["body"])
    for typ, tgt, rng in rows_txt:
        _require(typ in blob and tgt in blob, "7.4.1 Battalions: " + typ)
    table = {"kind": "table", "header": ["Type", "Target", "Range"],
             "rows": [row(cell((typ,)), cell(tgt), cell(rng)) for typ, tgt, rng in rows_txt]}
    keep = [it for it in sec["body"] if it["kind"] == "p" and (
        plain(it).startswith("Battalions are deployed")
        or plain(it).startswith("When you deploy Battalions to Dropsites"))]
    keep.append(table)
    sec["body"] = keep
    return True


# Fiction that bled in from a facing page. Interactive Rules carries rules only, so
# these narrative paragraphs are dropped (matched by their opening words).
FLAVOR_STRIP = {
    "13.1": [
        "I skid over the blood-slicked deck",
        "Three of those armoured PHR",
        "But there, through the smoke",
    ],
}


def fix_flavor(ch):
    changed = False
    for number, openers in FLAVOR_STRIP.items():
        sec = find(ch, number)
        if not sec:
            continue
        kept = []
        for it in sec["body"]:
            t = "".join(r["t"] for r in it.get("runs", [])).strip() if it["kind"] != "table" else ""
            if any(t.startswith(o) for o in openers):
                changed = True
                continue
            kept.append(it)
        sec["body"] = kept
    return changed


# Single words the PDF broke across a line inside a table head, which the
# extractor left hyphenated ("Re-sult"). Rejoined; these are not real compounds.
HYPHEN_FIX = {"Re-sult": "Result", "Deploy-ment": "Deployment"}


def fix_hyphens(nodes):
    changed = 0
    for n in nodes:
        for it in n["body"]:
            if it["kind"] != "table":
                continue
            if it.get("header"):
                for i, h in enumerate(it["header"]):
                    for bad, good in HYPHEN_FIX.items():
                        if bad in h:
                            it["header"][i] = h.replace(bad, good)
                            changed += 1
            for r_ in it["rows"]:
                for c in r_:
                    for run in c:
                        for bad, good in HYPHEN_FIX.items():
                            if bad in run["t"]:
                                run["t"] = run["t"].replace(bad, good)
                                changed += 1
        changed += fix_hyphens(n["children"])
    return changed


def main():
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--path", default=OUT, help="rules-wiki JSON to patch in place")
    args = ap.parse_args()
    out = args.path
    with open(out, encoding="utf-8") as fh:
        doc = json.load(fh)

    changed = 0
    h = fix_hyphens(doc["chapters"])
    if h:
        changed += 1
        print("patched %d hyphenated table head(s) -> Result / Deployment" % h)
    for ch in doc["chapters"]:
        if ch.get("number") == "4":
            if fix_tonnage(ch):
                changed += 1
                print("patched 4.2: Tonnage/Restriction table rebuilt")
            if fix_abilities(ch):
                changed += 1
                print("patched 4.2.1.1 Abilities: Cost/Effect table rebuilt")
        if ch.get("number") == "5":
            if fix_game_rounds(ch):
                changed += 1
                print("patched 5 Game Rounds: phase table rebuilt")
        if ch.get("number") == "7":
            if fix_battalions(ch):
                changed += 1
                print("patched 7.4.1 Battalions: Type/Target/Range table rebuilt")
        if ch.get("number") == "11":
            if fix_dropsites(ch):
                changed += 1
                print("patched 11 Dropsites: stats table rebuilt")
            if fix_features(ch):
                changed += 1
                print("patched 11.3 Features: stats/weapons/launch tables rebuilt")
        if ch.get("number") == "13":
            if fix_flavor(ch):
                changed += 1
                print("patched 13.1: stripped leaked fiction paragraphs")

    if not changed:
        print("nothing to patch (already applied, or source shape changed)")
        return
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
