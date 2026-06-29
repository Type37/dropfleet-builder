#!/usr/bin/env python3
"""
Audit: named weapon-rules present on the official datasheets but MISSING from the
ship data.

Root cause this guards against: some rules are spelled out on a datasheet under a
WEAPON's name (e.g. "VX Bomb", "Explosive Detonation", "Spinal Mass Annihilator"),
not as a token in the ship's Special column. The PDF->JSON ingest only captured
Special-column tokens and generic weapon keywords (Bombardment, Scald, ...), so a
rule keyed by the weapon's own name had no path into `specialRules` and silently
went missing (Senator VX Bomb, reported 2026-06-29).

This flags any weapon whose name also appears as a standalone rule heading in the
faction PDF but isn't present in that ship's specialRules / rulesText / Special.
Run it after any data or edition change. Exits non-zero if anything is flagged.

    python scripts/audit-named-rules.py

Requires: pdfplumber. PDFs in Rules-Mechanics-PDFs/ (canonical editions below).
"""
import json, re, os, sys
try:
    import pdfplumber
except ImportError:
    print("pip install pdfplumber"); sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDFS = {
    'ucm': 'UCM_Combined_Fleet_Stats_260529.pdf',
    'phr': 'PHR_Combined_Fleet_Stats_260626.pdf',
    'scourge': 'Scourge_Combined_Fleet_Stats_260626.pdf',
    'shaltari': 'Shaltari_Combined_Fleet_Stats_260327.pdf',
    'resistance': 'Resistance_Combined_Fleet_Stats_260327.pdf',
    'bioficer': 'Bioficer_Combined_Fleet_Stats_260529.pdf',
}
# A real stat-table row looks like "<arc> <att> <lock> ...": e.g. "F 3 4+ 2 E ...".
STATROW = re.compile(r'^(F|S|R|B|FN|RN|F/S|F/S/R|S/R|\*)\s+\d', re.I)

def pdf_lines(path):
    txt = ''
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            txt += (pg.extract_text() or '') + '\n'
    return [l.rstrip() for l in txt.split('\n')]

def main():
    flagged = []
    for fk, pf in PDFS.items():
        ppath = os.path.join(ROOT, 'Rules-Mechanics-PDFs', pf)
        if not os.path.exists(ppath):
            print(f"  (skip {fk}: missing {pf})"); continue
        lines = pdf_lines(ppath)
        # rule headings = a line that exactly equals some text AND whose next line
        # is prose (not a stat row) -> the weapon's named rule, not a wrapped table row.
        heading_at = {}
        for i, l in enumerate(lines):
            s = l.strip()
            if not s:
                continue
            nxt = lines[i + 1].strip() if i + 1 < len(lines) else ''
            if nxt and not STATROW.match(nxt):
                heading_at.setdefault(s, i)
        fac = json.load(open(os.path.join(ROOT, 'data', f'faction-{fk}.json'), encoding='utf-8'))
        for g in fac.get('groups', []):
            sh = g.get('ship') or {}
            have = {r.get('name', '') for r in sh.get('specialRules', [])}
            blob = (sh.get('stats', {}).get('special', '') or '') + ' ' + (sh.get('rulesText', '') or '')
            for w in sh.get('weapons', []):
                wn = w.get('name', '')
                if not wn or wn in have or wn in blob:
                    continue
                if wn in heading_at:
                    flagged.append((fk, sh.get('name', '?'), wn))
    if flagged:
        print(f"MISSING named weapon-rules: {len(flagged)}")
        for fk, ship, rule in flagged:
            print(f"  {fk:10} {ship:36} needs rule: {rule!r}")
        print("\nAdd each to the ship's specialRules (verbatim from the PDF rules section),")
        print("or fold it into rulesText. See memory: project session 2026-06-29.")
        sys.exit(1)
    print("OK - no missing named weapon-rules.")

if __name__ == '__main__':
    main()
