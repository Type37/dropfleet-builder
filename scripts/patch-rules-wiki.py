#!/usr/bin/env python3
"""Repairs tables the rulebook extractor could not recover, in place, verbatim.

    python scripts/patch-rules-wiki.py

Re-runnable and idempotent: run it after extract-rules-wiki.py. Every value it
writes is lifted from the strings already in data/rules-wiki.json, so nothing is
invented or reworded, only re-shaped from stranded paragraphs into a table.

Chapter 11 Dropsites
--------------------
The Dropsite stats table on page 26 has no ruled grid, so find_tables() missed
it: its column heads (Icon, Dropsite, Scan, Sig, Hull, ES, KS) came through as
loose captions and its six rows as ordinary paragraphs. This gathers them back
into one table. The Icon column is dropped: it held only the dropsite icon,
which is a picture, not text.
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
    """Chapter 11.3 Features: the per-Feature cards (a stat line, a weapon or
    launch line, and a rule) flattened into one broken table with the weapon
    stats mis-split. Rebuild as clean tables, values read from page 27."""
    sec = find(ch, "11.3")
    if not sec:
        return False
    if any(it["kind"] == "table" and it.get("header", [""])[0] == "Feature"
           for it in sec["body"]):
        return False  # already repaired

    intro = next((it for it in sec["body"]
                  if it["kind"] == "p" and "".join(r["t"] for r in it["runs"]).startswith("Features are")), None)
    foot = next((it for it in sec["body"]
                 if it["kind"] == "p" and "".join(r["t"] for r in it["runs"]).lstrip().startswith("*")), None)

    stats = {"kind": "table", "header": ["Feature", "ES", "KS", "Special"], "rows": [
        row(cell("Military Outpost"), cell("3+"), cell("5+"), cell("-")),
        row(cell("Orbital Defence Gun"), cell("5+"), cell("3+"), cell("-")),
        row(cell("Comms Station"), cell("5+"), cell("4+"),
            cell(("Comms Uplink:", " If you control this Dropsite, increase the amount of Ability Points you generate by 1. You can only be affected by Comms Uplink once each round."))),
        row(cell("Power Plant"), cell("4+"), cell("5+"),
            cell(("Volatile:", " When this Feature is destroyed, all Groups within 3" + Q + " gain a Spike and this Feature" + APOS + "s Dropsite takes an additional 2D3 damage."))),
        row(cell("Hangar"), cell("4+"), cell("4+"), cell("-")),
    ]}
    weapons = {"kind": "table",
               "header": ["Feature", "Weapon", "Scan", "Att", "Lock", "Dmg", "Type", "Special"], "rows": [
                   row(cell("Military Outpost"), cell("Missile Halo"), cell("6" + Q), cell("1"), cell("2+"), cell("2"), cell("K"), cell("Close Action, Escape Velocity")),
                   row(cell("Orbital Defence Gun"), cell("Orbital Gun"), cell("6" + Q), cell("3"), cell("3+"), cell("1"), cell("E"), cell("Burnthrough-1, Escape Velocity")),
               ]}
    launch = {"kind": "table", "header": ["Feature", "Asset", "Launch", "Special"], "rows": [
        row(cell("Hangar"), cell("Fighters & Bombers*"), cell("2"), cell("-")),
    ]}

    body = []
    if intro:
        body.append(intro)
    body += [stats, weapons, launch]
    if foot:
        body.append(foot)
    sec["body"] = body
    return True


# Fiction that bled in from a facing page. How to Play carries rules only, so
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
    with open(OUT, encoding="utf-8") as fh:
        doc = json.load(fh)

    changed = 0
    h = fix_hyphens(doc["chapters"])
    if h:
        changed += 1
        print("patched %d hyphenated table head(s) -> Result / Deployment" % h)
    for ch in doc["chapters"]:
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
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
