#!/usr/bin/env python3
r"""Resolve every generic "<Rule>-X" specialRule chip to its real per-ship value.

Companion to fix-vanguard-x.py (which already handled Vanguard). Nine more rule
families render a meaningless "-X" chip on units:

  Porter S/L-X, Payload S/L-X, Shield-X, Aegis-X, Command Ship-X, Regenerate-X,
  Gateship-X, Cloak-X, Reave-X

The true value almost always already lives in the ship's own special stat line
(e.g. "Aegis-6", "Porter L-1", "Shield-4+"). This reads it off, renames the rule
to the concrete value and substitutes the value into the rule description.

Three families need special handling because the value is NOT in the special:
  * Cloak-X on Scourge capital ships (Daemon, Faust, ...) - BSData confirms these
    ships have no Cloak at all (special "-"). The chip is spurious -> removed.
    Nosferatu (Cloak-1 in special) resolves normally.
  * Shield-X on the Pungari Thresher Hive Ship - per the rules it has Shield-5+
    only in a Shaltari fleet. So: Shaltari -> Shield-5+ (also added to special);
    every other faction -> removed (no shield outside Shaltari).
  * Reave-X on the Romulus Dreadnought - Reave is really a weapon keyword; the
    Romulus' only Reave value is the Reave-2 from its Gaius Chau ability -> Reave-2.

Reports every rename, removal and anything it could not resolve."""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
FILES = {
    "ucm": "faction-ucm.json", "phr": "faction-phr.json",
    "scourge": "faction-scourge.json", "shaltari": "faction-shaltari.json",
    "resistance": "faction-resistance.json", "bioficer": "faction-bioficer.json",
}

# family name-prefix -> (regex over the ship special, builder(name), builder(descval))
FAMILIES = [
    ("Porter",       re.compile(r'Porter ([SLF])-(\d+)'),  lambda m: f"Porter {m.group(1)}-{m.group(2)}",   lambda m: m.group(2)),
    ("Payload",      re.compile(r'Payload ([SLF])-(\d+)'), lambda m: f"Payload {m.group(1)}-{m.group(2)}",  lambda m: m.group(2)),
    ("Command Ship", re.compile(r'Command Ship-(\d+)'),    lambda m: f"Command Ship-{m.group(1)}",          lambda m: m.group(1)),
    ("Shield",       re.compile(r'Shield-(\d+)\+'),        lambda m: f"Shield-{m.group(1)}+",               lambda m: m.group(1)),
    ("Aegis",        re.compile(r'Aegis-(\d+)'),           lambda m: f"Aegis-{m.group(1)}",                 lambda m: m.group(1)),
    ("Regenerate",   re.compile(r'Regenerate-(\d+)'),      lambda m: f"Regenerate-{m.group(1)}",            lambda m: m.group(1)),
    ("Gateship",     re.compile(r'Gateship-(\d+)'),        lambda m: f"Gateship-{m.group(1)}",              lambda m: m.group(1)),
    ("Cloak",        re.compile(r'Cloak-(\d+)'),           lambda m: f"Cloak-{m.group(1)}",                 lambda m: m.group(1)),
]

renamed, removed, unresolved = [], [], []


def special_of(obj):
    stats = obj.get("stats")
    if isinstance(stats, dict) and isinstance(stats.get("special"), str):
        return stats["special"]
    return obj["special"] if isinstance(obj.get("special"), str) else ""


def sub_desc(desc, val):
    return re.sub(r'\bX\b', val, desc) if isinstance(desc, str) else desc


def process(obj, faction, ship_name):
    rules = obj.get("specialRules")
    if not isinstance(rules, list):
        return
    special = special_of(obj)
    kept = []
    for rule in rules:
        if not isinstance(rule, dict) or not str(rule.get("name", "")).endswith("-X"):
            kept.append(rule)
            continue
        name = rule["name"]

        # --- special-cased families (value not in the ship special) ---
        if name == "Cloak-X" and not re.search(r'Cloak-\d+', special):
            removed.append((faction, ship_name, "Cloak-X (BSData: ship has no Cloak)"))
            continue  # drop the spurious rule
        if name == "Shield-X" and "Pungari" in (ship_name or ""):
            if faction == "shaltari":
                rule["name"] = "Shield-5+"
                rule["description"] = sub_desc(rule.get("description", ""), "5")
                # keep the stat line consistent with the resolved chip
                st = obj.get("stats")
                if isinstance(st, dict) and isinstance(st.get("special"), str) and "Shield" not in st["special"]:
                    st["special"] = st["special"] + ", Shield-5+"
                renamed.append((faction, ship_name, "Shield-X", "Shield-5+ (+stat)"))
                kept.append(rule)
            else:
                removed.append((faction, ship_name, "Shield-X (Pungari has no shield outside Shaltari)"))
            continue
        if name == "Reave-X" and "Romulus" in (ship_name or ""):
            rule["name"] = "Reave-2"
            rule["description"] = sub_desc(rule.get("description", ""), "2")
            renamed.append((faction, ship_name, "Reave-X", "Reave-2 (from Gaius Chau ability)"))
            kept.append(rule)
            continue

        # --- generic: resolve from the ship's own special ---
        for prefix, rx, mk_name, mk_val in FAMILIES:
            if name.startswith(prefix):
                m = rx.search(special)
                if m:
                    new = mk_name(m)
                    rule["name"] = new
                    rule["description"] = sub_desc(rule.get("description", ""), mk_val(m))
                    renamed.append((faction, ship_name, name, new))
                else:
                    unresolved.append((faction, ship_name, name, special))
                break
        else:
            unresolved.append((faction, ship_name, name, special))
        kept.append(rule)
    obj["specialRules"] = kept


def walk(node, faction, ship_name=None):
    if isinstance(node, dict):
        nm = node.get("name", ship_name) if isinstance(node.get("name"), str) else ship_name
        if isinstance(node.get("specialRules"), list):
            process(node, faction, nm)
        for v in node.values():
            walk(v, faction, nm)
    elif isinstance(node, list):
        for x in node:
            walk(x, faction, ship_name)


# ── Pass 2 ────────────────────────────────────────────────────────────────
# Many rules were ALREADY value-named in the source (Cloak-2, Shield-4+,
# Marines-1, Command Ship-2, Aegis-6, Regenerate-2, Gateship-3, ...) but their
# inline description still carried the generic "X" placeholder, since they were
# never "-X" names for pass 1 to touch. The app renders that inline description
# verbatim (chip tooltips, the ship rules glossary, print), so users saw "X".
# The value is in the name, so substitute it. Skip:
#   * self-defining descriptions ("...where X is the number of...") - the X is
#     intentional (e.g. Parasite's Energy Siphon -> Regenerate-X).
#   * non-value-named rules (Mothership, *Booster) - their X is a generic
#     reference to another rule, not a parameter.
desc_subbed = []
VALUE_NAME = re.compile(r'^[A-Za-z][A-Za-z /-]*-(\d+)\+?$')


def fill_descriptions(node, faction, ship_name=None):
    if isinstance(node, dict):
        nm = node.get("name", ship_name) if isinstance(node.get("name"), str) else ship_name
        for rule in (node.get("specialRules") or []):
            if not isinstance(rule, dict):
                continue
            name, desc = str(rule.get("name", "")), rule.get("description", "")
            if not isinstance(desc, str) or not re.search(r'\bX\b', desc):
                continue
            m = VALUE_NAME.match(name)
            if not m or re.search(r'where\s+X\b', desc):
                continue
            rule["description"] = re.sub(r'\bX\b', m.group(1), desc)
            desc_subbed.append((faction, nm, name))
        for v in node.values():
            fill_descriptions(v, faction, nm)
    elif isinstance(node, list):
        for x in node:
            fill_descriptions(x, faction, ship_name)


for faction, fname in FILES.items():
    path = DATA / fname
    data = json.loads(path.read_text(encoding="utf-8"))
    walk(data, faction)
    fill_descriptions(data, faction)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

print(f"Descriptions filled (already value-named): {len(desc_subbed)}")
import collections as _c
_byrule = _c.Counter(name for _, _, name in desc_subbed)
for name, cnt in sorted(_byrule.items()):
    print(f"  {name}: {cnt}")
print()
print(f"Renamed: {len(renamed)}")
for fac, ship, old, new in renamed:
    print(f"  [{fac}] {ship}: {old} -> {new}")
print(f"\nRemoved (spurious): {len(removed)}")
for fac, ship, what in removed:
    print(f"  [{fac}] {ship}: removed {what}")
if unresolved:
    print(f"\nUNRESOLVED: {len(unresolved)}")
    for fac, ship, name, sp in unresolved:
        print(f"  [{fac}] {ship}: {name} | special={sp!r}")
    sys.exit(1)
