#!/usr/bin/env python3
"""Cross-check our ship data against the BSData community catalogues.

Why this exists: TTCombat publish stat changes as PDFs and no changelog, so the
only way to stay current used to be reading every new PDF by hand. The BSData
volunteers already do that transcription, monthly, into structured JSON at
https://github.com/BSData/dropfleet-commander-2024 (checked: their 2026-08-01
commits covered Resistance 260731, the Shaltari Nefertem and the Civilian Fuel
Transport, and every points value agreed with ours exactly).

So this is a second pair of eyes, not a source of truth. It flags where we and
they disagree; the PDF still settles who is right. Two independent transcriptions
agreeing is far stronger evidence than either alone, and a disagreement is
exactly the thing worth a human's attention.

Compares points, the nine stat-line values and the Special column for every ship
present in both. Stdlib only, so it runs in CI with no installs.

Usage:
  python scripts/compare-bsdata.py           # report; exit 1 if anything differs
  python scripts/compare-bsdata.py --json    # machine-readable
  python scripts/compare-bsdata.py --quiet   # only differences, no matched list
  python scripts/compare-bsdata.py --strict  # also list rules we carry that BSData do not
"""
import sys, os, re, json, urllib.request, urllib.parse

RAW = "https://raw.githubusercontent.com/BSData/dropfleet-commander-2024/master/"
DATA = os.path.join(os.path.dirname(__file__), os.pardir, "data")

# BSData catalogue file -> the faction file(s) its ships should appear in. The
# cross-faction catalogues (Civilian, Industrial, Misc) are merged into every
# faction file on our side, so any one of them is enough to satisfy a match.
CATALOGUES = {
    "United Colonies of Mankind.json": ["ucm"],
    "Post-Human Republic.json":        ["phr"],
    "Scourge.json":                    ["scourge"],
    "Shaltari.json":                   ["shaltari"],
    "Resistance.json":                 ["resistance"],
    "Bioficers.json":                  ["bioficer"],
    "Civilian.json":                   None,   # None = any faction file
    "Industrial.json":                 None,
    "Misc.json":                       None,
}

STAT_KEYS = [("Thrust", "thrust"), ("Scan", "scan"), ("Sig", "sig"), ("Hull", "hull"),
             ("ES", "es"), ("KS", "ks"), ("BS", "bs"), ("G", "g")]

# Disagreements already settled against the PDF, so they stop crying wolf. Each
# entry records which field, and why we did not change. Adjudicated 2026-08-16;
# re-check if either side's number moves. {ship name: {field: reason}}
ADJUDICATED = {
    "Agrippa Battlecruiser": {
        "rule missing here":
            'PHR 260626 p48 names it "Holo Interference Field" throughout. BSData call '
            'it "Holo-Debris Field". Ours matches the PDF.'},
    "Olympus": {
        "pts":
            'Resistance 260731 p6 reads "Nguen - Olympus | 415 pts (85 + 330 pts)", so the '
            'ship is 330. BSData have 340.'},
    "Kalium KNC-5 Line Cruiser": {
        "pts":
            'A counts-as ship: Misc 250822 p18 makes it "a Resistance Light Cruiser with one '
            'NC-16 Missile Bank and two Vent Cannon Turrets", i.e. 45 + 5 + 10 + 10 = 70. '
            'BSData price the bare 45 pt hull and add the guns as separate selections.'},
    "Kalium KNC-12 Fleet Carrier": {
        "pts":
            'A counts-as ship: Misc 250822 p19 makes it "a Resistance Light Cruiser with one '
            'Vent Cannon Turret and two Fighters & Bombers", i.e. 45 + 10 + 30 + 30 = 115. '
            'BSData price the bare 45 pt hull.'},
}


# Ships one side has renamed. Mapping their old name onto ours keeps the stats
# being compared instead of the ship dropping out as unmatched every week.
# {BSData name: our name}
RENAMED = {
    # TTCombat's Shaltari 260731 re-upload renamed the ship; integrated in 9fe9499.
    "Nefertem of the Dawn - Invisible Night": "Nefertem of the Dawn - Invisible Light",
}


def norm(s):
    """Compare loosely: BSData writes 7" where we may write 7'' or 7”, and their
    ship names omit the class suffix we append ("Cyrus" vs "Cyrus Battlecruiser")."""
    if s is None:
        return ""
    s = str(s).replace("”", '"').replace("’", "'").replace("''", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def rule_parts(s):
    """The Special column is a set, not a sequence, and the two projects order it
    differently."""
    return {p.strip() for p in norm(s).split(",") if p.strip() and p.strip() != "-"}


def base_rule(name):
    """'vanguard-3"' -> 'vanguard'; 'feature carrier-2' -> 'feature carrier'.
    BSData encode a rule's parameter in the Special column (Feature Carrier-2,
    Cloak-1) and sometimes parenthesise it (Feature Carrier (Outpost)); we keep
    the parameter on the rule name instead. Compare on the bare name so that
    difference alone never counts as a disagreement."""
    n = re.sub(r"\s*\([^)]*\)", "", name)          # drop "(Outpost)"
    n = re.sub(r'[-\s]*\d+(?:["”\']*)$', "", n)    # drop trailing -2, -3", -6"
    return n.strip()


def our_rule_names(ship):
    """Every rule the ship carries, wherever we chose to put it. We keep
    stats.special verbatim to the PDF's Special column and hold rule-box entries
    (SWACS, Repair Bay, Feature Carrier, Fuel Transporter) in specialRules; BSData
    fold them all into Special. Union both sides or that convention alone reports
    two dozen false disagreements, and a checker that cries wolf gets ignored."""
    names = rule_parts((ship.get("stats") or {}).get("special"))
    for r in (ship.get("specialRules") or []):
        if r.get("name"):
            names.add(norm(r["name"]))
    return {base_rule(n) for n in names}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (dfc-bsdata-check)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def bs_ships(catalogue):
    """Every Ship profile in a catalogue -> {name: {pts, stats..., Special}}.
    The points live on the enclosing selection entry, so carry them down."""
    out = {}

    def walk(o, cost):
        if isinstance(o, dict):
            own = next((c["value"] for c in (o.get("costs") or []) if c.get("name") == "pts"), None)
            cost = own if own is not None else cost
            for p in (o.get("profiles") or []):
                if p.get("typeName") != "Ship":
                    continue
                ch = {c["name"]: c.get("$text") for c in p.get("characteristics", [])}
                out[p["name"]] = dict(ch, pts=cost)
            for v in o.values():
                walk(v, cost)
        elif isinstance(o, list):
            for v in o:
                walk(v, cost)

    walk(catalogue["catalogue"], None)
    return out


def our_ships():
    """{faction: {name: ship}} for every buildable group ship, plus every famous
    admiral's flagship (BSData profiles those too)."""
    out = {}
    for fk in ["ucm", "phr", "scourge", "shaltari", "resistance", "bioficer"]:
        path = os.path.join(DATA, f"faction-{fk}.json")
        d = json.load(open(path, encoding="utf-8"))
        ships = {}
        for g in d.get("groups", []):
            s = g.get("ship")
            if s:
                ships[s["name"]] = s
        for a in d.get("admirals", []):
            fs = a.get("flagship")
            if fs:
                ships.setdefault(fs["name"], fs)
        out[fk] = ships
    return out


def find_ours(bs_name, ours, factions):
    """Match "Cyrus" to our "Cyrus Battlecruiser". Prefer an exact hit, else a
    unique ship whose name starts with the BSData name followed by a space."""
    keys = list(factions) if factions else list(ours)
    bs_name = RENAMED.get(bs_name, bs_name)
    for fk in keys:
        if bs_name in ours[fk]:
            return fk, bs_name, ours[fk][bs_name]
    n = norm(bs_name)
    hits = []
    for fk in keys:
        for name, s in ours[fk].items():
            nn = norm(name)
            if nn == n or nn.startswith(n + " "):
                hits.append((fk, name, s))
    # A cross-faction ship (Centurion, Palatine, Pungari Thresher) is copied into
    # several faction files, so it legitimately hits more than once. That is one
    # ship, not an ambiguity: collapse on the name before giving up.
    if len({h[1] for h in hits}) == 1:
        return hits[0]
    return None, None, None


def main():
    as_json = "--json" in sys.argv
    quiet = "--quiet" in sys.argv
    strict = "--strict" in sys.argv
    ours = our_ships()

    diffs, missing, known, matched = [], [], [], 0

    for fname, factions in CATALOGUES.items():
        try:
            cat = fetch(RAW + urllib.parse.quote(fname))
        except Exception as e:                                  # noqa: BLE001
            print(f"WARN could not fetch {fname}: {e}", file=sys.stderr)
            continue
        for bs_name, bs in bs_ships(cat).items():
            fk, our_name, s = find_ours(bs_name, ours, factions)
            if not s:
                missing.append((fname, bs_name, bs.get("pts")))
                continue
            matched += 1
            fields = []
            if bs.get("pts") is not None and bs["pts"] != s.get("cost"):
                fields.append(("pts", s.get("cost"), bs["pts"]))
            st = s.get("stats") or {}
            for bs_key, our_key in STAT_KEYS:
                a, b = norm(st.get(our_key)), norm(bs.get(bs_key))
                if a and b and a != b:
                    fields.append((bs_key, st.get(our_key), bs.get(bs_key)))
            mine = our_rule_names(s)
            theirs = {base_rule(n) for n in rule_parts(bs.get("Special"))}
            only_theirs, only_mine = sorted(theirs - mine), sorted(mine - theirs)
            # A rule BSData carry and we don't is the case worth waking up for: it
            # is how a missed rule from a new edition would look.
            if only_theirs:
                fields.append(("rule missing here", "-", ", ".join(only_theirs)))
            # The reverse is almost always our own convention rather than an error:
            # we hold weapon-specific rules (VX Bomb, Thermal Lash) and the
            # cross-faction Mercenary marker in specialRules, and BSData don't put
            # those in Special at all. Off by default so the report stays trusted.
            if only_mine and strict:
                fields.append(("rule not in bsdata", ", ".join(only_mine), "-"))
            settled = ADJUDICATED.get(our_name, {})
            fresh = [f for f in fields if f[0] not in settled]
            if len(fresh) < len(fields):
                known.append((our_name, [settled[f[0]] for f in fields if f[0] in settled]))
            if fresh:
                diffs.append({"faction": fk, "ship": our_name, "bsdata": bs_name,
                              "fields": [{"field": f, "ours": o, "theirs": t} for f, o, t in fresh]})

    if as_json:
        print(json.dumps({"matched": matched, "diffs": diffs, "unmatched": missing,
                          "adjudicated": [k[0] for k in known]}, indent=1))
        return 1 if (diffs or missing) else 0

    print(f"Cross-check vs BSData/dropfleet-commander-2024: {matched} ships matched.\n")
    if diffs:
        print(f"{len(diffs)} ship(s) where we and BSData disagree. The PDF decides:\n")
        for d in diffs:
            print(f"  {d['ship']} ({d['faction']})")
            for f in d["fields"]:
                print(f"      {f['field']:<20} ours={f['ours']!r}  bsdata={f['theirs']!r}")
        print()
    else:
        print("No new disagreements on points, stats or rules.\n")

    if known and not quiet:
        print(f"{len(known)} known difference(s), already checked against the PDF and left as is:")
        for name, reasons in known:
            print(f"  {name}")
            for r in reasons:
                print(f"      {r}")
        print()

    # Unmatched ships are a finding, not background: they are half of what the
    # exit code reports, so --quiet must keep them or the alert names no cause.
    if missing:
        print(f"{len(missing)} BSData ship(s) with no counterpart here "
              f"(new ships, or naming that needs a manual look):")
        for fname, name, pts in missing:
            print(f"  {name}  ({pts} pts, {fname})")
        print()

    # The count the report above actually printed, for CI to gate the alert on so
    # a heading can never assert a finding the block does not list. The workflow
    # strips this line from the issue body.
    print(f"#findings={len(diffs) + len(missing)}")

    return 1 if (diffs or missing) else 0


if __name__ == "__main__":
    sys.exit(main())
