#!/usr/bin/env python3
"""Rebuild data/fleet-data.json from the files the app actually loads.

Nothing in the app reads fleet-data.json. Both the desktop builder (js/app.js)
and the mobile app (mobile/js/mobile.js) load data/fleet-index.json plus
data/faction-<key>.json on demand. fleet-data.json is a merged mirror kept for
scripts and for reading the whole game in one place.

Because it is a mirror only *some* ingest scripts remembered to update, it drifted:
by 2026-08-21 it was 19 ships and roughly 50 weapon rows behind the faction files,
and six shared rules short. That is not a harmless staleness. In July a session
checked a suspected data bug against this file, found the stale value, and deleted
a correct fix on the strength of it (66bbad0, four Bioficer ships losing a weapon
each). A mirror that can be believed has to be regenerated, not hand-patched.

Run this after any change to fleet-index.json or a faction file:

    python scripts/gen-fleet-data.py

Shape: fleet-index.json's own top-level keys, except `factions`, which becomes the
full contents of each data/faction-<key>.json rather than the index's per-faction
summary. The index's summary counts stay reachable in fleet-index.json itself.
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
INDEX = os.path.join(DATA, "fleet-index.json")
OUT = os.path.join(DATA, "fleet-data.json")

# The order the app names them in, so a diff of the merged file reads predictably.
FACTIONS = ["bioficer", "phr", "resistance", "scourge", "shaltari", "ucm"]


def load(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def ships(faction):
    """Every ship in a faction file, group ships and single-ship groups alike."""
    for g in faction.get("groups", []):
        if "ship" in g:
            yield g["ship"]
        for s in g.get("ships", []):
            yield s


def main():
    index = load(INDEX)
    out = {k: v for k, v in index.items() if k != "factions"}
    out["factions"] = {}

    total_ships = total_weapons = 0
    for key in FACTIONS:
        path = os.path.join(DATA, "faction-%s.json" % key)
        faction = load(path)
        out["factions"][key] = faction
        n = list(ships(faction))
        w = sum(len(s.get("weapons", [])) for s in n)
        total_ships += len(n)
        total_weapons += w
        print("  %-11s %3d ships  %4d weapon rows" % (key, len(n), w))

    with io.open(OUT, "w", encoding="utf-8", newline="") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")

    size = os.path.getsize(OUT)
    print("\nWrote %s — %d ships, %d weapon rows, %.2f MB"
          % (os.path.relpath(OUT, ROOT), total_ships, total_weapons, size / 1e6))
    print("Re-run scripts/gen-offline-manifest.py so the download size stays honest.")


if __name__ == "__main__":
    main()
