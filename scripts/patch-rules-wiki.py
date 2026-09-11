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


def main():
    with open(OUT, encoding="utf-8") as fh:
        doc = json.load(fh)

    changed = 0
    for ch in doc["chapters"]:
        if ch.get("number") == "11":
            if fix_dropsites(ch):
                changed += 1
                print("patched 11 Dropsites: stats table rebuilt (%d rows)"
                      % len(ch["body"][-1].get("rows", []) if False else
                            next(i for i in ch["body"] if i["kind"] == "table")["rows"]))

    if not changed:
        print("nothing to patch (already applied, or source shape changed)")
        return
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
