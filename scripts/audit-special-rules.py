#!/usr/bin/env python3
"""
Audit: ship Special-COLUMN rules printed on the official stat cards but MISSING
from a ship's data.

Root cause this guards against: a ship's Special stat column can list MORE THAN
ONE named rule. The Bannik Pocket Battleship's column reads "Command Ship-1" AND
"Oculus Booster", but the PDF->JSON ingest captured only the first token and
silently dropped the second from both stats.special and specialRules (reported
2026-07-08). audit-named-rules.py catches rules keyed by a WEAPON's name; this
catches a second/third rule token sitting in the ship's Special stat column.

Method: these Combined Fleet Stats PDFs reprint a ship special rule's full text
under EACH ship that carries it, so the rule's name appears as a standalone line
once inside each owning ship's datasheet. We split the PDF into datasheet spans
(delimited by the "Thrust Scan Sig Hull ES KS BS G Special" stat header) and,
for every rule name in a faction's specialRules, compare:

    (# datasheet spans that contain the name as a standalone line)
    vs
    (# JSON ships whose specialRules include that name)

Splitting on the stat header is what makes this reliable: it ignores the same
rule name where it appears OUTSIDE a datasheet - a glossary, the admiral-ability
tables, or deployable-cell rules at the front of the PDF (that is why an earlier
naive line-count falsely flagged Bioficer "High Velocity Boarding Pods").

If the PDF shows the rule on MORE ships than the JSON records, a ship is missing
it. (PDF < JSON is fine: a ship kept from an older edition may hold a rule the
current PDF no longer prints; that direction never means data loss.)

Run after any data or edition change. Exits non-zero if anything is flagged.

    python scripts/audit-special-rules.py

Requires: pdfplumber. PDFs in Rules-Mechanics-PDFs/ (canonical editions below).
"""
import json, os, sys, unicodedata, re
try:
    import pdfplumber
except ImportError:
    print("pip install pdfplumber"); sys.exit(2)

# The stat header that opens every ship datasheet (and nothing else).
STATHEADER = re.compile(r'Thrust\s+Scan\s+Sig\s+Hull\s+ES\s+KS\s+BS\s+G\s+Special', re.I)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDFS = {
    'ucm': 'UCM_Combined_Fleet_Stats_260529.pdf',
    'phr': 'PHR_Combined_Fleet_Stats_260626.pdf',
    'scourge': 'Scourge_Combined_Fleet_Stats_260626.pdf',
    'shaltari': 'Shaltari_Combined_Fleet_Stats_260327.pdf',
    'resistance': 'Resistance_Combined_Fleet_Stats_260327.pdf',
    'bioficer': 'Bioficer_Combined_Fleet_Stats_260529.pdf',
}


def norm(s):
    """Normalise curly quotes / dashes / whitespace so PDF text and JSON match."""
    s = unicodedata.normalize('NFKC', s or '')
    s = (s.replace('’', "'").replace('‘', "'")
          .replace('“', '"').replace('”', '"')
          .replace('″', '"').replace('′', "'")
          .replace('–', '-').replace('—', '-'))
    return re.sub(r'\s+', ' ', s).strip()


def pdf_datasheet_spans(path):
    """Return one list of normalised lines per ship datasheet (each span starts at
    a stat-header line and runs to the next). Lines before the first datasheet -
    cover pages, admiral tables, deployable-cell rules, glossaries - are dropped."""
    raw = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            raw += (pg.extract_text() or '').split('\n')
    spans, cur = [], None
    for l in raw:
        if STATHEADER.search(l):
            cur = []
            spans.append(cur)
        if cur is not None:
            cur.append(norm(l))
    return spans


def main():
    flagged = []
    for fk, pf in PDFS.items():
        ppath = os.path.join(ROOT, 'Rules-Mechanics-PDFs', pf)
        jpath = os.path.join(ROOT, 'data', f'faction-{fk}.json')
        if not os.path.exists(ppath):
            print(f"  (skip {fk}: missing {pf})"); continue
        if not os.path.exists(jpath):
            print(f"  (skip {fk}: missing faction-{fk}.json)"); continue

        spans = pdf_datasheet_spans(ppath)
        fac = json.load(open(jpath, encoding='utf-8'))

        # Every JSON datasheet: buildable ships AND famous-admiral flagships. Both
        # are printed as full datasheets in the PDF, so both must be counted here or
        # a flagship-only rule reads as "missing" (Bioficer Ascendant / High Velocity
        # Boarding Pods). See memory: flagships-differ.
        ships = [g.get('ship') or {} for g in fac.get('groups', [])]
        ships += [a['flagship'] for a in fac.get('admirals', []) if a.get('flagship')]

        # Universe of real ship special rules for this faction, and how many
        # datasheets carry each (by specialRules membership - the captured state).
        json_ships = {}     # rule name (normalised) -> count of datasheets
        display = {}        # normalised -> original display name
        for sh in ships:
            names = set()
            for r in sh.get('specialRules', []):
                nm = r.get('name', '')
                if nm:
                    names.add(norm(nm))
                    display.setdefault(norm(nm), nm)
            for nm in names:
                json_ships[nm] = json_ships.get(nm, 0) + 1

        for nm, jcount in sorted(json_ships.items()):
            if not nm:
                continue
            # Number of ship datasheets that print this rule name as a standalone line.
            pdf_count = sum(1 for sp in spans if nm in sp)
            # PDF never prints this name as a datasheet heading -> it lives in a shared
            # glossary or is inline only; can't infer per-ship ownership. Skip.
            if pdf_count == 0:
                continue
            if pdf_count > jcount:
                flagged.append((fk, display[nm], pdf_count, jcount))

    if flagged:
        print(f"SHIP special-column rules missing from some ships: {len(flagged)}\n")
        for fk, rule, pc, jc in flagged:
            print(f"  {fk:10} {rule!r}: PDF prints it under {pc} ship(s), "
                  f"JSON records it on {jc}. {pc - jc} ship(s) missing it.")
        print("\nFind the ship(s) whose Special stat column lists this rule in the PDF")
        print("and add it to BOTH stats.special (comma-joined) and specialRules")
        print("(verbatim text). See memory: dev gotchas / Bannik Oculus Booster.")
        sys.exit(1)
    print("OK - every PDF ship special-column rule is captured on all its ships.")


if __name__ == '__main__':
    main()
