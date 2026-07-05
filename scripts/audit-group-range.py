# Audit: a ship's group size is stated in TWO places that must agree —
#   stats.g   : the printed group range, e.g. "2-3" or "1"
#   groupMin/groupMax : the numbers the builder actually enforces
# When they disagree the picker shows the wrong group (this is exactly how the
# Kalium KNC-5/KNC-12 shipped as "group of 2" when the card said 2-3).
#
# This also flags the sibling mistake behind those ships: a "Counts As" misc ship
# left at the bare base-hull cost (its loadout never added). We can't recompute
# every cost here, but we CAN flag counts-as ships that are missing the
# `additional: true` misc-gate, which is the other half of the same bug.
#
# Read-only: prints findings, exits non-zero if any. Run before committing ship data.
import json, glob, re, sys

def rng(g):
    """Return (min,max) a 'g' stat implies, or None if not a plain number/range."""
    if g is None: return None
    s = str(g).strip()
    m = re.fullmatch(r'(\d+)\s*[-–]\s*(\d+)', s)
    if m: return int(m.group(1)), int(m.group(2))
    if re.fullmatch(r'\d+', s): return int(s), int(s)
    return None  # e.g. "-" or free text: nothing to check

problems = []

def check(ship, where):
    st = ship.get('stats') or {}
    r = rng(st.get('g'))
    gmin, gmax = ship.get('groupMin'), ship.get('groupMax')
    if r is not None and gmin is not None and gmax is not None:
        if (gmin, gmax) != r:
            problems.append(f"{where}: stats.g='{st.get('g')}' implies {r[0]}-{r[1]} "
                            f"but groupMin/Max = {gmin}/{gmax}")
    # Counts-as misc ship not gated behind the Miscellaneous Ships toggle.
    note = json.dumps(ship, ensure_ascii=False).lower()
    name = (ship.get('name') or '')
    if 'counts as a resistance' in (ship.get('note') or '').lower() and not ship.get('additional'):
        problems.append(f"{where}: '{name}' is a counts-as ship but missing additional:true")

for fp in sorted(glob.glob('data/faction-*.json')):
    d = json.load(open(fp, encoding='utf-8'))
    fn = fp.replace('\\', '/').split('/')[-1]
    for entry in (d.get('groups', []) if isinstance(d, dict) else []):
        ship = entry.get('ship') if isinstance(entry, dict) else None
        if isinstance(ship, dict):
            check(ship, f"{fn} / {entry.get('name')}")

if problems:
    print("GROUP-RANGE AUDIT — %d issue(s):\n" % len(problems))
    for p in problems: print("  -", p)
    sys.exit(1)
print("Group-range audit clean: stats.g agrees with groupMin/groupMax everywhere.")
