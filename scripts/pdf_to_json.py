#!/usr/bin/env python3
"""Convert a Dropfleet "Combined Fleet Stats" PDF into structured JSON.

Source of truth is the Rules-Mechanics-PDFs/*_Combined_Fleet_Stats_*.pdf files
(BattleScribe is dead). Each ship is one page; PyMuPDF (fitz) returns every table
cell on its own line in reading order, and crucially keeps a TRAILING SPACE on
the non-final fragment of any wrapped cell, so we can re-join wrapped cells
deterministically before parsing the regular column layout.

Usage:
  PYTHONUTF8=1 python scripts/pdf_to_json.py <stats.pdf> [--out out.json] [--validate data/faction-ucm.json]

This extracts: name, cost (+ admiral/ship split for Famous Admirals), class,
tonnage, stat line, weapons, launch loads, refit prose (+ its weapon table), and
the first lore line. It does NOT invent IDs or lore beyond what the PDF prints.
Quote rules verbatim: refit/special text is copied exactly.
"""
import sys, re, json, argparse

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF (fitz) required: pip install pymupdf")

ARC_RE = re.compile(r'^[FSRN](?:/?[FSRN])*$')        # F, S, R, N, FN, F/S, F/S/R ...
LOCK_RE = re.compile(r'^(\d\+|-)$')
NUM_RE = re.compile(r'^(\d+|-)$')
TYPE_RE = re.compile(r'^[KEC]$')
PTS_RE = re.compile(r'^(\d+)\s*pts(?:\s*\((\d+)\s*\+\s*(\d+)\s*pts\))?', re.I)
TON_RE = re.compile(r'^([LMHCS])\s*/\s*(\d+)mm$')
FAMOUS_RE = re.compile(r'^Famous Admiral Level\s*(\d+)\s*&\s*(.+)$', re.I)

def canon(s):
    """Canonicalise inch marks to a straight double-quote. PDFs/data variously use
    '', ', ”, or “ for inches; applied to stat/measurement values only."""
    s = str(s).replace('”', '"').replace('“', '"').replace("'", '"')
    while '""' in s:
        s = s.replace('""', '"')
    return s.strip()

def merge_cells(raw_lines):
    """Re-join wrapped cell fragments: a fragment that ends with whitespace
    continues on the next line (fitz marks wraps this way)."""
    out, cur = [], None
    for l in raw_lines:
        if not l.strip():
            continue
        cur = l if cur is None else cur + l
        if cur.endswith(' ') or cur.endswith('\t'):
            continue
        out.append(re.sub(r'\s+', ' ', cur).strip())
        cur = None
    if cur is not None:
        out.append(re.sub(r'\s+', ' ', cur).strip())
    return out

def is_break(l):
    """A line that ends the weapon/load tables (a new section or prose)."""
    if l in ('Load', 'Name', 'Thrust'):   # next section header (any layout order)
        return True
    if re.match(r'^(This Ship|This Flagship|Famous ships|When |While |At the |If )', l):
        return True
    if re.search(r'\bRefit$', l):           # refit title e.g. "Drive Refit"
        return True
    if len(l) > 50:                          # lore / rules prose
        return True
    return False

def parse_weapons(lines, start):
    """Parse weapon rows from `start`. Returns (weapons, next_index)."""
    weapons, j = [], start
    while j < len(lines):
        if is_break(lines[j]):
            break
        name_parts = []
        while j < len(lines) and not ARC_RE.match(lines[j]) and not is_break(lines[j]):
            name_parts.append(lines[j]); j += 1
        if j + 5 >= len(lines) or not ARC_RE.match(lines[j]):
            break
        arc, att, lock, dmg, typ, special = lines[j:j+6]
        # sanity: the 5-cell core must look like a weapon
        if not (NUM_RE.match(att) and LOCK_RE.match(lock) and NUM_RE.match(dmg) and TYPE_RE.match(typ)):
            break
        weapons.append({
            "name": ' '.join(name_parts).strip(), "arc": arc, "attack": att,
            "lock": lock, "damage": dmg, "type": typ,
            "special": special if special != '-' else '-',
        })
        j += 6
    return weapons, j

def parse_loads(lines, start):
    loads, j = [], start
    while j < len(lines):
        if is_break(lines[j]):
            break
        name_parts = []
        while j < len(lines) and not NUM_RE.match(lines[j]) and not is_break(lines[j]):
            name_parts.append(lines[j]); j += 1
        if j + 1 >= len(lines) or not NUM_RE.match(lines[j]):
            break
        launch, special = lines[j], lines[j+1]
        loads.append({"name": ' '.join(name_parts).strip(), "launch": launch,
                      "special": special if special != '-' else '-'})
        j += 2
    return loads, j

def parse_page(text):
    lines = merge_cells(text.split('\n'))
    # locate the points line (anchor)
    pts_idx = next((i for i, l in enumerate(lines) if PTS_RE.match(l)), None)
    if pts_idx is None:
        return None
    ship = {}
    m = PTS_RE.match(lines[pts_idx])
    ship["cost"] = int(m.group(1))
    name = lines[pts_idx - 1].strip() if pts_idx > 0 else ''
    cls = lines[pts_idx + 1] if pts_idx + 1 < len(lines) else ''
    ton = lines[pts_idx + 2] if pts_idx + 2 < len(lines) else ''

    fm = FAMOUS_RE.match(cls)
    if fm and m.group(2):
        adm, _, flagship = name.partition(' - ')
        ship["famousAdmiral"] = {"admiral": adm.strip(), "level": int(fm.group(1)),
                                 "admiralCost": int(m.group(2)), "shipCost": int(m.group(3))}
        ship["name"] = flagship.strip() or name
        ship["class"] = fm.group(2).strip()
    else:
        ship["name"] = name
        ship["class"] = cls.strip()
    tm = TON_RE.match(ton)
    if tm:
        ship["tonnage"] = tm.group(1)
        ship["armour"] = tm.group(2) + "mm"

    # stats: header is a run of column labels (Thrust..Special). Read the labels
    # dynamically so factions with different columns (Shaltari Shield, etc.) work,
    # then map the values positionally and treat the trailing column as Special.
    try:
        sh = next(i for i in range(len(lines) - 1) if lines[i] == 'Thrust' and lines[i+1] == 'Scan')
    except StopIteration:
        return ship
    try:
        spec_rel = next(k - sh for k in range(sh, len(lines)) if lines[k] == 'Special')
    except StopIteration:
        return ship
    labels = lines[sh: sh + spec_rel + 1]        # ['Thrust',...,'Special']
    nvals = len(labels) - 1
    vals = lines[sh + len(labels):]
    stats = {}
    for lab, v in zip(labels[:-1], vals[:nvals]):
        stats[lab.strip().lower()] = canon(v)
    rest = vals[nvals:]                            # Special cell(s), until next section
    sp = []
    for l in rest:
        if l in ('Name', 'Load') or is_break(l):
            break
        sp.append(l)
    stats['special'] = ' '.join(sp).strip() if sp else '-'
    ship["stats"] = stats

    # weapons (first table) - the table can sit above OR below the stat block, so
    # search the whole page; the first "Name/Arc" header is the base weapons.
    try:
        wh = next(i for i in range(len(lines) - 1) if lines[i] == 'Name' and lines[i+1] == 'Arc')
        ship["weapons"], after = parse_weapons(lines, wh + 7)
    except StopIteration:
        ship["weapons"] = []

    # loads
    lh = next((i for i in range(len(lines) - 1) if lines[i] == 'Load' and lines[i+1] == 'Launch'), None)
    if lh is not None:
        ship["loads"], _ = parse_loads(lines, lh + 3)

    # refits: prose lines "This Ship may take a <X> Refit for +N points, ..."
    refits = []
    for i, l in enumerate(lines):
        rm = re.match(r'^This Ship may take a (.+?) for \+(\d+) points?,?\s*(.*)$', l)
        if rm:
            refits.append({"name": rm.group(1).strip(), "cost": int(rm.group(2)),
                           "text": l.strip()})
    if refits:
        ship["refits"] = refits

    # lore: the line after "Famous ships of the class:" block, or first long sentence
    fam = next((l for l in lines if l.startswith('Famous ships of the class')), None)
    if fam:
        ship["famousShips"] = fam.split(':', 1)[1].strip()
    return ship

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--out')
    ap.add_argument('--validate')
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    ships, errors = [], []
    for pi in range(len(doc)):
        text = doc[pi].get_text()
        if 'Thrust' not in text or 'Scan' not in text:
            continue   # front matter
        try:
            s = parse_page(text)
            if s and s.get('name') and s.get('stats'):
                s["_page"] = pi
                ships.append(s)
        except Exception as e:
            errors.append((pi, str(e)))

    out_path = args.out or (args.pdf.rsplit('.', 1)[0] + '.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(ships, f, indent=1, ensure_ascii=False)
    print(f"Parsed {len(ships)} ships -> {out_path}")
    if errors:
        print(f"{len(errors)} page errors:", errors[:5])

    if args.validate:
        validate(ships, args.validate)

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def validate(ships, data_path):
    data = json.load(open(data_path, encoding='utf-8'))
    by = {}
    for g in data.get('groups', []):
        s = g.get('ship') or {}
        if s.get('name'):
            by[norm(s['name'])] = s
    print(f"\n=== Validation vs {data_path} ({len(by)} data ships) ===")
    ok_cost = ok_stat = ok_wpn = matched = 0
    misses = []
    wpn_misses = []
    cost_misses = []
    stat_misses = []
    for sh in ships:
        # A ship can appear both as a regular datasheet AND as a Famous Admiral's
        # flagship (an upgraded variant with its own cost/stats). Only validate the
        # regular datasheets against the regular data ships; comparing a flagship
        # variant to the regular ship produces false "discrepancies".
        if sh.get('famousAdmiral'):
            continue
        nm = norm(sh['name'])
        # match by exact, or data name starting with the PDF name (+ class suffix)
        d = by.get(nm)
        if not d:
            cand = [v for k, v in by.items() if k.startswith(nm) or nm.startswith(k)]
            d = cand[0] if len(cand) == 1 else None
        if not d:
            misses.append(sh['name']); continue
        matched += 1
        # cost: famous uses shipCost
        pc = sh.get('famousAdmiral', {}).get('shipCost', sh['cost'])
        if pc == d.get('cost'):
            ok_cost += 1
        else:
            cost_misses.append((sh['name'], pc, d.get('cost')))
        ds = d.get('stats', {})
        keys = ['thrust','scan','sig','hull','es','ks','bs','g']
        q = lambda s: canon(s)
        common = [k for k in keys if sh['stats'].get(k) not in (None, '') and ds.get(k) not in (None, '')]
        diffs = {k: (sh['stats'][k], ds.get(k)) for k in common if q(sh['stats'][k]) != q(ds.get(k))}
        if not diffs:
            ok_stat += 1
        else:
            stat_misses.append((sh['name'], diffs))
        pw = sorted(norm(w['name']) for w in sh.get('weapons', []))
        # Data may model refit/swap guns as loadoutOptions, so compare against the
        # ship's DEFAULT effective weapons (base + first option of each loadout group).
        dwl = list(d.get('weapons', []))
        for lo in d.get('loadoutOptions', []):
            opts = lo.get('options', [])
            if opts and opts[0].get('weapons'):
                dwl += opts[0]['weapons']
        dw = sorted(norm(w.get('name','')) for w in dwl)
        if pw == dw:
            ok_wpn += 1
        elif pw:
            wpn_misses.append((sh['name'], pw, dw))
    print(f"matched {matched}/{len(ships)} | cost {ok_cost}/{matched} | stats {ok_stat}/{matched} | weapon-names {ok_wpn}/{matched}")
    if misses:
        print(f"unmatched ({len(misses)}):", misses)
    for nm, p, dval in cost_misses:
        print(f"  COST DIFF {nm}: pdf={p} data={dval}")
    for nm, diffs in stat_misses:
        print(f"  STAT DIFF {nm}: " + ', '.join(f"{k} pdf={pv} data={dv}" for k,(pv,dv) in diffs.items()))

if __name__ == '__main__':
    main()
