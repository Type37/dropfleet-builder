#!/usr/bin/env python3
"""
Audit: datasheet text leaked into ship `lore` fields.

During PDF->JSON ingest, the launch/weapon/stat tables or refit lines sometimes
got appended to a ship's lore prose (e.g. Seattle's lore ended with "Load Launch
Special Fighters & Bombers 2 - ... Minelayer This ship may replace..."). On screen
this reads as the lore trailing off into table gibberish. Fixed 8 ships 2026-06-29.

This flags any lore field (ship, variant, or famous-admiral flagship) that still
contains a datasheet signature, so it's caught after future data/edition updates.
Exits non-zero if anything is flagged.

    python scripts/audit-lore-leak.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTIONS = ['ucm', 'phr', 'scourge', 'shaltari', 'resistance', 'bioficer']
SIGS = [
    ('LAUNCH-TABLE', re.compile(r'Load Launch Special', re.I)),
    ('STAT-HEADER', re.compile(r'Thrust\s+Scan\s+Sig\s+Hull|\bES\s+KS\s+BS\b')),
    ('WEAPON-HEADER', re.compile(r'Name\s+Arc\s+Att\s+Lock|\bArc\s+Att\s+Lock\b')),
    ('REFIT-LINE', re.compile(r'This [Ss]hip may (take|replace)\b.*?for \+\d+\s*(pts|points)', re.I)),
    ('LOAD-ROW', re.compile(r'(Fighters?\s*&\s*Bombers?|Bulk Landers?|Drop ?Pods?)\s+\d+\s+[-A-Za-z]')),
]

def main():
    flagged = []
    for fk in FACTIONS:
        fac = json.load(open(os.path.join(ROOT, 'data', f'faction-{fk}.json'), encoding='utf-8'))
        def check(lore, label):
            if not lore:
                return
            hits = [name for name, rx in SIGS if rx.search(lore)]
            if hits:
                pos = min(rx.search(lore).start() for name, rx in SIGS if rx.search(lore))
                flagged.append((fk, label, hits, lore[pos:pos + 90]))
        for g in fac.get('groups', []):
            sh = g.get('ship') or {}
            check(sh.get('lore', ''), sh.get('name', '?'))
            for v in (sh.get('variants') or []):
                if v:
                    check(v.get('lore', ''), '(var) ' + v.get('name', '?'))
        for a in fac.get('admirals', []):
            fs = a.get('flagship') or {}
            check(fs.get('lore', ''), '(adm) ' + a.get('name', '?'))
    if flagged:
        print(f"LORE with leaked datasheet text: {len(flagged)}")
        for fk, label, hits, snip in flagged:
            print(f"  {fk:10} {label:34} {hits}")
            print(f"        >> {snip!r}")
        sys.exit(1)
    print("OK - no datasheet text leaked into lore.")

if __name__ == '__main__':
    main()
