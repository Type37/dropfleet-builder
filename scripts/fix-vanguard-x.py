#!/usr/bin/env python3
"""Replace the generic 'Vanguard-X' specialRule on every unit with its real value.

Each ship already carries the true value in its own stats.special string
(e.g. "Vanguard-6\""). The specialRules[] entry, however, was left as the
generic "Vanguard-X" with an "...up to X\" away..." description. This walks every
ship object, reads the real value off its special string, and rewrites the
specialRule name + description in place. Reports any unit where no value could
be found (those are left untouched and must be fixed by hand)."""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
FILES = [
    "faction-ucm.json", "faction-phr.json", "faction-scourge.json",
    "faction-shaltari.json", "faction-resistance.json", "faction-bioficer.json",
]

# Matches "Vanguard-6", optionally followed by an inch mark (straight or curly).
VANGUARD_TOKEN = re.compile(r'Vanguard-(\d+)\s*(["”]?)')

changed = []
unresolved = []


def special_of(obj):
    """The ship's own Special characteristic string, wherever it lives."""
    stats = obj.get("stats")
    if isinstance(stats, dict) and isinstance(stats.get("special"), str):
        return stats["special"]
    if isinstance(obj.get("special"), str):
        return obj["special"]
    return ""


def walk(node, ship_name=None):
    if isinstance(node, dict):
        # Track the nearest enclosing name for reporting.
        name = node.get("name", ship_name) if isinstance(node.get("name"), str) else ship_name
        rules = node.get("specialRules")
        if isinstance(rules, list):
            special = special_of(node)
            for rule in rules:
                if not isinstance(rule, dict):
                    continue
                # Catch the generic "Vanguard-X" placeholder AND any Vanguard
                # rule left without an inch mark or with a stray X in its prose
                # (e.g. Stature Battlecruiser: name "Vanguard-6", desc still "X").
                if not rule.get("name", "").strip().lower().startswith("vanguard"):
                    continue
                m = VANGUARD_TOKEN.search(special)
                if not m:
                    unresolved.append((name, special))
                    continue
                val = m.group(1)
                # Normalise the rule-name inch mark to a straight quote; the
                # source special strings mix straight ("), curly (”) and none.
                new_name = f'Vanguard-{val}"'
                rule["name"] = new_name
                if isinstance(rule.get("description"), str):
                    # Replace the lone "X" placeholder with the real value.
                    rule["description"] = re.sub(r'\bX\b', val, rule["description"])
                changed.append((name, new_name))
        for v in node.values():
            walk(v, name)
    elif isinstance(node, list):
        for item in node:
            walk(item, ship_name)


for fname in FILES:
    path = DATA / fname
    data = json.loads(path.read_text(encoding="utf-8"))
    before = len(changed)
    walk(data)
    n = len(changed) - before
    if n:
        # No trailing newline: the source files have none, so this keeps the
        # diff to just the changed Vanguard entries.
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{fname}: fixed {n}")

print(f"\nTotal fixed: {len(changed)}")
if unresolved:
    print(f"\nUNRESOLVED ({len(unresolved)}) - no Vanguard value in ship special:")
    for name, special in unresolved:
        print(f"  - {name!r}: special={special!r}")
    sys.exit(1)
