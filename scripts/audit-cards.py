#!/usr/bin/env python3
"""Weekly audit of our ship data against TTCombat's stat cards.

The other two tripwires in .github/workflows/dfc-files-scan.yml watch UPSTREAM:
scan-dfc-files.py notices TTCombat publishing something, compare-bsdata.py notices
the community catalogue disagreeing with us. Neither watches US. On 2026-07-27,
commit 66bbad0 deleted a weapon from four Bioficer ships. Nothing upstream moved,
so both tripwires stayed quiet and the Binary sailed with half its Scythe Nodules
for 25 days until a player noticed at the table.

This is the third tripwire, and the only one pointed inward: fetch the current
cards, parse them, and diff every cost, stat and weapon COUNT against
data/faction-*.json. Weapon count matters as much as weapon name — the whole
66bbad0 regression was a name that was still present, just once instead of twice.

It also settles the re-upload question the page scan can only guess at. Because it
has the bytes in hand it sha256s them, so a file TTCombat overwrites in place under
an unchanged filename, date stamp and ?v= shows up as RE-CUT. That happened to the
260731 Resistance stats (a VX Bomb wording fix) and every string-level check on the
URL read clean through it.

Usage:
  python scripts/audit-cards.py            # download current cards, audit, exit 1 on findings
  python scripts/audit-cards.py --local    # use Rules-Mechanics-PDFs/ (gitignored, dev only)
  python scripts/audit-cards.py --update   # rebaseline: accept today's mismatches and hashes
  python scripts/audit-cards.py --verbose  # also list mismatches the baseline already accepts

The baseline (scripts/card-audit-baseline.json) exists because the card parser has
honest false positives: a card whose columns wrap badly hands back a neighbour's
BS or points, and a generically-named card ("Heavy Cruiser") matches nothing. It
holds two buckets, and the difference between them matters:

  accepted    somebody opened the PDF, read the ship's block, and confirmed the
              data is right and the parser is wrong. A claim, with a reader behind it.
  unreviewed  silenced so the alert can see NEW drift, but nobody has read the card.
              Printed as a count on every run so it cannot quietly become "fine".

Moving a line from unreviewed to accepted means reading the card. Do not bulk-move
them. Believing an unread baseline is the mistake that started all this: 66bbad0
checked a stale mirror instead of a PDF and deleted four correct weapons.
"""
import argparse
import collections
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF required: pip install pymupdf")
from ingest_pdf import parse_page, canon, _vnorm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FILES_MANIFEST = os.path.join(ROOT, "scripts", "dfc-files-manifest.json")
BASELINE = os.path.join(ROOT, "scripts", "card-audit-baseline.json")
LOCAL_PDFS = os.path.join(ROOT, "Rules-Mechanics-PDFs")

# Manifest family -> the faction file its cards should agree with. Misc carries
# mercenary and civilian hulls that live in every faction file at once, so it is
# hashed for re-cuts but not ship-audited.
FAMILY_FACTION = {
    "Bioficer_Combined_Fleet_Stats": "bioficer",
    "PHR_Combined_Fleet_Stats": "phr",
    "Resistance_Combined_Fleet_Stats": "resistance",
    "Scourge_Combined_Fleet_Stats": "scourge",
    "Shaltari_Combined_Fleet_Stats": "shaltari",
    "UCM_Combined_Fleet_Stats": "ucm",
    "Misc_Combined_Ship_Stats": None,
}

STAT_KEYS = ["thrust", "scan", "sig", "hull", "es", "ks", "bs", "g"]


def load(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (DFC-card-audit)"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        f.write(r.read())


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def app_ships(faction_key):
    """{normalised name: ship} for every ship the app can put on the table."""
    d = load(os.path.join(DATA, "faction-%s.json" % faction_key))
    out = {}
    for g in d.get("groups", []):
        for s in ([g["ship"]] if "ship" in g else g.get("ships", [])):
            out[_vnorm(s["name"])] = s
    # A famous admiral's flagship is its own hull with its own profile, printed on
    # its own card as "Atom - Scion". Register it under that full name only: 22 of
    # the 24 differ from the line ship they are named after, so letting a flagship
    # answer to the bare "Scion" would compare a hero unit against a line card.
    for a in d.get("admirals", []):
        fs = a.get("flagship")
        if fs:
            out[_vnorm("%s - %s" % (a.get("name", ""), fs.get("name", "")))] = fs
    return out


def card_ships(pdf_path):
    doc = fitz.open(pdf_path)
    out = []
    for page in doc:
        text = page.get_text()
        if "Thrust" not in text or "Scan" not in text:
            continue
        try:
            sh = parse_page(text)
        except Exception:
            continue
        if sh and sh.get("name") and sh.get("stats"):
            out.append(sh)
    return out


def weapon_counts(ship):
    """Multiset of weapon names, including the default loadout option's weapons.

    Counts, not a set: two Scythe Nodules is a different ship from one.
    """
    wl = list(ship.get("weapons", []))
    for lo in ship.get("loadoutOptions", []):
        opts = lo.get("options", [])
        if opts and opts[0].get("weapons"):
            wl += opts[0]["weapons"]
    return collections.Counter(_vnorm(w.get("name", "")) for w in wl)


def match(card_name, app):
    nm = _vnorm(card_name)
    if nm in app:
        return app[nm]
    cand = [v for k, v in app.items() if k.startswith(nm) or nm.startswith(k)]
    return cand[0] if len(cand) == 1 else None


def audit_faction(key, pdf_path):
    """[(ship, detail)] for every disagreement between the cards and the data."""
    app = app_ships(key)
    findings = []
    for card in card_ships(pdf_path):
        data = match(card["name"], app)
        if data is None:
            findings.append((card["name"], "on the card, no ship in the data matches it"))
            continue

        # A flagship card prices the admiral and the hull together ("310 pts
        # (65 + 245 pts)"); the data stores the hull alone. Compare hull to hull.
        want = card.get("famousAdmiral", {}).get("shipCost", card.get("cost"))
        got = data.get("famousAdmiral", {}).get("shipCost", data.get("cost"))
        if want is not None and got is not None and want != got:
            findings.append((card["name"], "cost card=%s app=%s" % (want, got)))

        cs, ds = card.get("stats", {}), data.get("stats", {})
        for k in STAT_KEYS:
            a, b = cs.get(k), ds.get(k)
            if a in (None, "") or b in (None, ""):
                continue
            if canon(a) != canon(b):
                findings.append((card["name"], "%s card=%s app=%s" % (k, a, b)))

        cw, dw = weapon_counts(card), weapon_counts(data)
        if cw != dw:
            for w in sorted(set(cw) | set(dw)):
                if cw[w] != dw[w]:
                    findings.append((card["name"], "%s card=%d app=%d" % (w, cw[w], dw[w])))
    return findings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="use Rules-Mechanics-PDFs/ instead of downloading")
    ap.add_argument("--update", action="store_true", help="rebaseline hashes and accepted mismatches")
    ap.add_argument("--verbose", action="store_true", help="also list already-accepted mismatches")
    args = ap.parse_args()

    families = load(FILES_MANIFEST)["files"]
    base = load(BASELINE) if os.path.exists(BASELINE) else {}
    base_accepted = base.get("accepted", {})
    base_unreviewed = base.get("unreviewed", {})
    recut, new_findings = [], []
    accepted_seen = unreviewed_seen = 0
    hashes, unreviewed = {}, {}

    tmp = tempfile.mkdtemp(prefix="dfc-cards-")
    for family, key in sorted(FAMILY_FACTION.items()):
        entry = families.get(family)
        if not entry:
            print("  !! %s is not on the downloads page any more" % family)
            continue
        filename = entry["filename"]

        path = os.path.join(LOCAL_PDFS, filename)
        if not (args.local and os.path.exists(path)):
            path = os.path.join(tmp, filename)
            fetch(entry["url"], path)

        digest = sha256(path)
        hashes[filename] = digest
        was = base.get("pdfs", {}).get(filename)
        if was and was != digest:
            recut.append(filename)

        if key is None:
            print("  %-11s %s (hash only)" % ("-", filename))
            continue

        found = audit_faction(key, path)
        ok = base_accepted.get(key, {})
        seen = base_unreviewed.get(key, {})
        unreviewed[key] = {}
        fresh = []
        for ship, detail in found:
            if detail in ok.get(ship, []):
                accepted_seen += 1
                if args.verbose:
                    print("      (accepted)   %s: %s" % (ship, detail))
            elif detail in seen.get(ship, []):
                unreviewed_seen += 1
                unreviewed[key].setdefault(ship, []).append(detail)
                if args.verbose:
                    print("      (unreviewed) %s: %s" % (ship, detail))
            else:
                fresh.append((ship, detail))
                unreviewed[key].setdefault(ship, []).append(detail)
        new_findings += [(key, s, d) for s, d in fresh]
        print("  %-11s %-46s %d disagreement(s), %d new"
              % (key, filename, len(found), len(fresh)))

    print()
    if recut:
        print("RE-CUT — same URL, different bytes. Diff the text before assuming cosmetic:")
        for f in recut:
            print("  %s" % f)
        print()

    if new_findings:
        print("The cards and the data disagree in %d new place(s):" % len(new_findings))
        by = collections.OrderedDict()
        for key, ship, detail in new_findings:
            by.setdefault(key, []).append((ship, detail))
        for key, rows in by.items():
            print("  %s" % key)
            for ship, detail in rows:
                print("      %-38s %s" % (ship, detail))
        print()
        print("The card settles it. Open the PDF, read the ship's block, and fix whichever")
        print("side is wrong. If the data is right and the parser is not, accept it with")
        print("`python scripts/audit-cards.py --update` so it stops reappearing.")
    elif not recut:
        print("Cards and data agree on everything the baseline does not already hold.")

    print("Baseline: %d verified against the card, %d never read."
          % (accepted_seen, unreviewed_seen + len(new_findings)))
    if unreviewed_seen or new_findings:
        print("Those unread lines are parser noise as far as anyone knows, which is not")
        print("the same as knowing. `--verbose` lists them; the card settles each one.")

    if args.update:
        with io.open(BASELINE, "w", encoding="utf-8", newline="") as f:
            json.dump({"pdfs": hashes, "accepted": base_accepted, "unreviewed": unreviewed},
                      f, indent=1, ensure_ascii=False)
            f.write("\n")
        print("\nBaseline updated: %s" % os.path.relpath(BASELINE, ROOT))

    n = 0 if args.update else len(new_findings) + len(recut)
    print("#findings=%d" % n)
    return 1 if n else 0


if __name__ == "__main__":
    sys.exit(main())
