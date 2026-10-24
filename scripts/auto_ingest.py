#!/usr/bin/env python3
"""Integrate one new edition of a TTCombat ship sheet into data/faction-*.json.

Cards are matched by ship name between the previous edition and the new one:

  same name, same printed text    skipped
  same name, different text       the fields that moved are copied from the card
  new name                        a whole new group is built from the card
  name gone                       not deleted; reported for a person to decide

A card is only written when everything on it is already familiar: every Special
keyword, weapon keyword and launch asset exists somewhere in our data, and no new
rule printed on the card reads like a list-building rule. Anything else is listed
in the report for Claude to handle, one card at a time, with the page number.

Library: ingest_family(...). Command line (dry run against copies, for testing):

    python scripts/auto_ingest.py <family> <new.pdf> [--old <old.pdf>] [--data-dir DIR] [--dry]
"""
import argparse
import glob
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from card_reader import read_pdf, cut_art  # noqa: E402
from ingest_pdf import canon, _vnorm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LF, CRLF = chr(10), chr(13) + chr(10)

FACTIONS = ['bioficer', 'phr', 'resistance', 'scourge', 'shaltari', 'ucm']
# Sheet family -> the faction files its ships belong in. The shared sheets carry
# Mercenary hulls, which every fleet can take, so they go into all six.
FAMILIES = {
    'Bioficer_Combined_Fleet_Stats': ['bioficer'],
    'PHR_Combined_Fleet_Stats': ['phr'],
    'Resistance_Combined_Fleet_Stats': ['resistance'],
    'Scourge_Combined_Fleet_Stats': ['scourge'],
    'Shaltari_Combined_Fleet_Stats': ['shaltari'],
    'UCM_Combined_Fleet_Stats': ['ucm'],
    'Civilian_Ships_Scenarios': FACTIONS,
    'Misc_Combined_Ship_Stats': FACTIONS,
}
ID_KEY = {'Civilian_Ships_Scenarios': 'civilian', 'Misc_Combined_Ship_Stats': 'misc'}
# Rules a civilian hull prints but loses when it joins a fleet (see Mercenary).
SHARED_DROP = {'Boardable', 'Civilian Transport'}
CATEGORY = {'L': 'light', 'M': 'medium', 'H': 'heavy', 'C': 'colossal'}
STAT_KEYS = ['thrust', 'scan', 'sig', 'hull', 'es', 'ks', 'bs', 'g']
# A new rule that talks about building a list needs judgement, not copying.
LIST_RULE_RE = re.compile(
    r'\b(may only (take|include|be taken)|you may take|per fleet|in your fleet|fleet may|'
    r'(Skirmish|Clash|Battle|Reconquest)[- ]sized|counts? (as|towards)|Admiral|Flagship|Refit|'
    r'instead of (a|an|the|its)|choose (one|two|a|an))\b', re.I)


def mkid(key, name):
    h = hashlib.md5(f'ingest:{key}:{name}'.encode()).hexdigest()
    return f'{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}'


def tokens(cell):
    out = []
    for t in re.split(r',(?![^()]*\))', cell or ''):
        t = re.sub(r'^[-–\s]+', '', t).strip()   # "- Feature Carrier" on some cards
        if t and t != '-':
            out.append(t)
    return out


def key(tok):
    """Spelling-blind form of a keyword: "Vanguard-4”" == 'Vanguard-4"', "Anti-Wing" == "Anti Wing"."""
    return re.sub(r'[^a-z0-9+"]', '', canon(tok).lower())


def load_key(name):
    """Launch asset names, plural-blind: "Torpedoes" == "Torpedo"."""
    return re.sub(r'(es|s)$', '', key(name))


def base(tok):
    """A keyword without its value: "Scald-1" -> "scald"."""
    return re.sub(r'[^a-z]', '', re.sub(r'-\s*[\d+"”″X]+["”″+]?$', '', canon(tok)).lower())


def plural(name):
    if name.endswith('s'):
        return name + 'es'
    if re.search(r'[^aeiou]y$', name):
        return name[:-1] + 'ies'
    return name + 's'


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


class Data:
    """The faction files, plus everything we already know how to read."""

    def __init__(self, data_dir):
        self.dir = data_dir
        self.files = {f: json.load(open(os.path.join(data_dir, f'faction-{f}.json'), encoding='utf-8'))
                      for f in FACTIONS}
        self.gloss, self.weapon_tokens, self.loads, self.load_names = {}, set(), set(), {}
        for f in FACTIONS:
            self._walk(self.files[f])
        self.gloss_by_key = {}
        for n, r in self.gloss.items():
            self.gloss_by_key.setdefault(key(n), r)
        for d in self.files.values():
            for g in d['groups']:
                s = g.get('ship') or {}
                for w in s.get('weapons', []):
                    for t in tokens(w.get('special')):
                        self.weapon_tokens.add(base(t))
                for ld in s.get('loads', []):
                    self.loads.add(load_key(ld.get('name', '')))
                    self.load_names.setdefault(load_key(ld.get('name', '')), ld.get('name'))
        # Index ships under every name a card could print for them: the data says
        # "Warsaw Heavy Cruiser" where the card says "Warsaw" over "Heavy Cruiser".
        self.index = {f: {} for f in FACTIONS}
        for f, d in self.files.items():
            for g in d['groups']:
                if 'ship' in g:
                    self.index[f][_vnorm(g['ship']['name'])] = g

        # The rulebook's keyword entries ("Regenerate-X", "Corruptor-X"), so a card
        # that uses a keyword at a value no ship had before still resolves.
        self.book = {}
        wiki = os.path.join(data_dir, 'rules-wiki.json')
        if not os.path.exists(wiki):
            wiki = os.path.join(ROOT, 'data', 'rules-wiki.json')
        if os.path.exists(wiki):
            def walk(n):
                for c in n.get('chapters', n.get('children', [])):
                    h = c.get('heading') or ''
                    if (c.get('number') or '').startswith('14.') and h:
                        text = LF.join(''.join(r.get('t', '') for r in b.get('runs', []))
                                       for b in c.get('body', []) if b.get('kind') == 'p')
                        if text:
                            self.book.setdefault(base(h), {'heading': h, 'text': text, 'page': c.get('page')})
                    walk(c)
            walk(json.load(open(wiki, encoding='utf-8')))

    def lookup_rule(self, tok):
        hit = self.gloss.get(tok) or self.gloss_by_key.get(key(tok))
        if hit:
            return hit
        entry = self.book.get(base(tok))
        num = re.search(r'\d+', tok.rsplit('-', 1)[-1]) if '-' in tok else None
        if not entry or not num or not re.search(r'-X\W*$', entry['heading']):
            return None
        rule = {'name': tok, 'description': re.sub(r'\bX\b', num.group(0), entry['text'])}
        # Cite it the way the other values of this keyword already are, if any.
        sib = next((r for n, r in self.gloss.items() if base(n) == base(tok) and r.get('publicationId')), None)
        if sib:
            rule['page'], rule['publicationId'] = sib.get('page'), sib['publicationId']
        return rule

    def known_weapon_keyword(self, tok):
        return base(tok) in self.weapon_tokens or base(tok) in self.book

    def _walk(self, o):
        if isinstance(o, dict):
            if isinstance(o.get('name'), str) and isinstance(o.get('description'), str):
                r = {k: v for k, v in o.items() if k in ('name', 'description', 'page', 'publicationId')}
                had = self.gloss.get(o['name'])
                if had is None or (len(r) > len(had) and r['description'] == had['description']):
                    self.gloss[o['name']] = r  # the copy that cites its page wins
            for v in o.values():
                self._walk(v)
        elif isinstance(o, list):
            for v in o:
                self._walk(v)

    def find(self, faction, name, cls=''):
        idx = self.index[faction]
        for n in (name, f'{name} {cls}'):
            if _vnorm(n) in idx:
                return idx[_vnorm(n)]
        return None


def build_group(card, family, data):
    """Card -> (group, problems). Problems mean: do not write it, ask Claude."""
    p = card['parsed']
    shared = family in ID_KEY
    problems = list(card['odd'])
    if p.get('famousAdmiral') or p.get('refits'):
        problems.append('famous admiral or refit card')
    st = dict(p['stats'])
    special = [t for t in tokens(st.get('special')) if not (shared and t in SHARED_DROP)]
    printed = {r['name'] for r in card['rules']}
    rules = []
    for t in special:
        if t in printed:
            continue
        if data.lookup_rule(t):
            rules.append(dict(data.lookup_rule(t)))
        else:
            problems.append(f'Special keyword "{t}" is not in our rules')
    for r in card['rules']:
        text = LF.join(r['paragraphs'])
        if not data.lookup_rule(r['name']) and LIST_RULE_RE.search(text):
            problems.append(f'new rule "{r["name"]}" may change list building')
        if not text:
            problems.append(f'rule "{r["name"]}" has no text')
        rules.append({'name': r['name'], 'description': text})
    for w in p.get('weapons', []):
        for t in tokens(w.get('special')):
            if not data.known_weapon_keyword(t):
                problems.append(f'weapon keyword "{t}" is new')
    loads = []
    for ld in p.get('loads', []):
        # Use our spelling: the app finds a launch asset's rules by its name.
        loads.append(dict(ld, name=data.load_names.get(load_key(ld['name']), ld['name'])))
        if load_key(ld['name']) not in data.loads:
            problems.append(f'launch asset "{ld["name"]}" is new')
    g = st.get('g', '1')
    m = re.match(r'^(\d+)(?:-(\d+))?$', g)
    if not m:
        problems.append(f'group size "{g}" not understood')
        gmin = gmax = 1
    else:
        gmin, gmax = int(m.group(1)), int(m.group(2) or m.group(1))
    if p.get('tonnage') not in CATEGORY:
        problems.append(f'tonnage "{p.get("tonnage")}" not understood')
    stats = {k: (int(st[k]) if k == 'hull' and str(st.get(k, '')).isdigit() else st.get(k, '-')) for k in STAT_KEYS}
    stats['special'] = ', '.join(special) if special else '-'
    full = p['name'] if shared or not p.get('class') else f"{p['name']} {p['class']}"
    ship = {
        'name': full,
        'cost': p['cost'],
        'stats': stats,
        'weapons': p.get('weapons', []),
        'loads': loads,
        'specialRules': rules,
        'groupMin': gmin,
        'groupMax': gmax,
        'isRare': 'Rare' in special,
        'isUnique': 'Unique' in special,
        'tonnage': p.get('tonnage'),
    }
    if shared:
        ship['additional'] = True
    if card['famousPrefix']:
        ship['famousShipsPrefix'] = card['famousPrefix']
        ship['famousShips'] = [re.sub(r'^[-–]\s*', '', n) for n in card['famous']]
    ship['lore'] = (LF + LF).join(card['lore'])
    group = {
        'id': mkid(ID_KEY.get(family, FAMILIES[family][0]), full),
        'name': plural(full) if gmax > 1 else full,
        'category': CATEGORY.get(p.get('tonnage'), 'medium'),
        'ship': ship,
    }
    return group, problems


def _h(x):
    return hashlib.sha1(json.dumps(x, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]


def snapshot(card):
    """What we keep of a card between editions: the numbers in full, a fingerprint
    of the words. Enough to see that something moved and say what, without
    keeping the PDF."""
    p = card['parsed']
    return {
        'name': card['name'],
        'page': card['page'],
        'sig': _h(card['signature']),
        'cost': p.get('cost'),
        'stats': p.get('stats', {}),
        'weapons': p.get('weapons', []),
        'loads': p.get('loads', []),
        'rules': {r['name']: _h(r['paragraphs']) for r in card['rules']},
        'lore': _h(card['lore']),
        'famous': _h([card['famousPrefix'], card['famous']]),
    }


def snapshot_pdf(path):
    return {k: snapshot(c) for k, c in read_pdf(path).items()}


def changed_fields(old, new):
    """What moved between two snapshots of one card, in words for the changelog."""
    out = []
    if old['cost'] != new['cost']:
        out.append(('cost', f'{old["cost"]} to {new["cost"]} pts'))
    for k in STAT_KEYS:
        a, b = canon(old['stats'].get(k, '')), canon(new['stats'].get(k, ''))
        if a != b:
            out.append(('stat', f'{k.upper() if len(k) < 3 else k.title()} {a} to {b}'))
    if canon(old['stats'].get('special', '')) != canon(new['stats'].get('special', '')):
        out.append(('special', 'Special keywords changed'))
    if old['weapons'] != new['weapons']:
        out.append(('weapons', 'weapons changed'))
    if old['loads'] != new['loads']:
        out.append(('loads', 'launch assets changed'))
    if set(old['rules']) != set(new['rules']):
        out.append(('rule-set', 'rules added or removed'))
    for n in new['rules']:
        if n in old['rules'] and old['rules'][n] != new['rules'][n]:
            out.append(('rule-text', f'"{n}" reworded'))
    if old['lore'] != new['lore']:
        out.append(('lore', 'lore'))
    if old['famous'] != new['famous']:
        out.append(('famous', 'known ships'))
    return out


# ── writing: text-level, so hand-formatted lines elsewhere stay untouched ──

def _object_span(text, inner):
    depth, i, in_str = 0, inner, False
    while True:
        i -= 1
        c = text[i]
        if c == '"' and text[i - 1] != '\\':
            in_str = not in_str
        elif not in_str and c == '}':
            depth += 1
        elif not in_str and c == '{':
            if depth == 0:
                break
            depth -= 1
    start, depth, j, in_str = i, 0, i, False
    while True:
        c = text[j]
        if c == '"' and text[j - 1] != '\\':
            in_str = not in_str
        elif not in_str and c == '{':
            depth += 1
        elif not in_str and c == '}':
            depth -= 1
            if depth == 0:
                return start, j + 1
        j += 1


def _indent_step(text):
    second = text.split(LF, 2)[1]
    return (len(second) - len(second.lstrip(' '))) or 1


def _group_span(text, group_id):
    k = text.index(f'"id": "{group_id}"')
    return _object_span(text, k)


def write_groups(path, inserts, replaces):
    """inserts: [(anchor_group_id or None, group)]; replaces: [group] (same id)."""
    raw = open(path, encoding='utf-8', newline='').read()
    nl = CRLF if CRLF in raw[:200] else LF
    text = raw.replace(CRLF, LF)
    step = _indent_step(text)
    for g in replaces:
        s, e = _group_span(text, g['id'])
        pad = text[text.rfind(LF, 0, s) + 1:s]
        text = text[:s] + json.dumps(g, indent=step, ensure_ascii=False).replace(LF, LF + pad) + text[e:]
    for anchor, g in inserts:
        if f'"id": "{g["id"]}"' in text:
            continue
        if anchor:
            s, e = _group_span(text, anchor)
        else:  # after the last group
            gs = text.index('"groups"')
            close = _object_span(text, text.index('{', gs) + 1)  # first group
            s, e = close
            while True:
                nxt = text.find('{', e)
                if nxt == -1 or text[e:nxt].strip() != ',':
                    break
                s, e = _object_span(text, nxt + 1)
        pad = text[text.rfind(LF, 0, s) + 1:s]
        text = text[:e] + ',' + LF + pad + json.dumps(g, indent=step, ensure_ascii=False).replace(LF, LF + pad) + text[e:]
    json.loads(text)
    open(path, 'w', encoding='utf-8', newline='').write(text.replace(LF, nl))


def ingest_family(family, new_pdf, old_pdf=None, data_dir=None, art_dir=None, dry=False):
    """Returns {'changelog': [...], 'claude': [...], 'person': [...], 'newArt': [...]}"""
    data_dir = data_dir or os.path.join(ROOT, 'data')
    art_dir = art_dir or os.path.join(ROOT, 'assets', 'art')
    targets = FAMILIES[family]
    data = Data(data_dir)
    new = read_pdf(new_pdf)
    # The previous edition: a snapshot dict, or a PDF to take one from.
    if isinstance(old_pdf, dict):
        old = old_pdf
    else:
        old = snapshot_pdf(old_pdf) if old_pdf and os.path.exists(old_pdf) else None
    snaps = {k: snapshot(c) for k, c in new.items()}
    report = {'changelog': [], 'claude': [], 'person': [], 'newArt': [], 'snapshot': snaps}
    inserts = {f: [] for f in targets}
    replaces = {f: [] for f in targets}
    order = list(new)

    for k, card in new.items():
        name, cls = card['name'], card['parsed'].get('class', '')
        present = [f for f in targets if data.find(f, name, cls)]
        if not present and (old is None or k in old):
            # Printed before but not found under this name in our data (a few ships
            # are stored under a different name), or no previous edition to tell a
            # new ship from a renamed one. Never guess: an unchanged card is fine,
            # anything else is for Claude.
            if old is not None and old[k]['sig'] == snaps[k]['sig']:
                continue
            report['claude'].append({'family': family, 'pdf': os.path.basename(new_pdf), 'page': card['page'],
                                     'ship': name, 'why': ['card not found in our data under this name']})
            continue
        if not present:
            group, problems = build_group(card, family, data)
            if problems:
                report['claude'].append({'family': family, 'pdf': os.path.basename(new_pdf),
                                         'page': card['page'], 'ship': name, 'why': problems})
                continue
            # next to the card printed before it, so the file reads in sheet order
            prev = next((data.find(targets[0], new[j]['name'], new[j]['parsed'].get('class', ''))
                         for j in reversed(order[:order.index(k)])
                         if data.find(targets[0], new[j]['name'], new[j]['parsed'].get('class', ''))), None)
            for f in targets:
                inserts[f].append((prev['id'] if prev else None, group))
            dest = os.path.join(art_dir, slug(name) + '.webp')
            if not dry and not os.path.exists(dest):
                if cut_art(new_pdf, card['page'], dest):
                    report['newArt'].append((name, slug(name)))
            who = 'any fleet' if family in ID_KEY else family.split('_')[0]
            report['changelog'].append(f'New ship: {name}, {card["parsed"]["cost"]} pts ({who}).')
            continue
        if old is None:
            continue  # without the previous edition, the card audit compares numbers instead
        prev_card = old.get(k)
        if prev_card is None or prev_card['sig'] == snaps[k]['sig']:
            continue
        moved = changed_fields(prev_card, snaps[k])
        if not moved:
            continue
        # An odd layout (ability box, cost badge) only matters if its words moved.
        hard = [w for k, w in moved if k in ('special', 'rule-set')]
        if any(k == 'rule-text' for k, _ in moved) and card['odd']:
            hard += card['odd']
        if hard:
            report['claude'].append({'family': family, 'pdf': os.path.basename(new_pdf), 'page': card['page'],
                                     'ship': name, 'why': hard})
            continue
        built, problems = build_group(card, family, data)
        problems = [x for x in problems if x not in card['odd']]
        if problems:
            report['claude'].append({'family': family, 'pdf': os.path.basename(new_pdf), 'page': card['page'],
                                     'ship': name, 'why': problems})
            continue
        for f in present:
            g = json.loads(json.dumps(data.find(f, name, cls)))
            s, b = g['ship'], built['ship']
            for k, _ in moved:
                if k == 'cost':
                    s['cost'] = b['cost']
                elif k == 'stat':
                    for sk in STAT_KEYS:
                        s['stats'][sk] = b['stats'][sk]
                elif k in ('weapons', 'loads'):
                    s[k] = b[k]
                elif k == 'rule-text':
                    texts = {r['name']: r['description'] for r in b['specialRules']}
                    for r in s.get('specialRules', []):
                        if r['name'] in texts:
                            r['description'] = texts[r['name']]
                elif k == 'lore':
                    s['lore'] = b['lore']
                elif k == 'famous':
                    s['famousShipsPrefix'] = b.get('famousShipsPrefix', s.get('famousShipsPrefix'))
                    s['famousShips'] = b.get('famousShips', s.get('famousShips'))
            if g != data.find(f, name, cls):
                replaces[f].append(g)
        report['changelog'].append(f'{name}: ' + ', '.join(w for _, w in moved) + '.')

    if old is not None:
        for k, card in old.items():
            if k not in new:
                report['person'].append(f'{card["name"]} is no longer on {os.path.basename(new_pdf)}. '
                                         'Nothing was removed; decide whether it should be.')

    if not dry:
        for f in targets:
            if inserts[f] or replaces[f]:
                write_groups(os.path.join(data_dir, f'faction-{f}.json'), inserts[f], replaces[f])
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('family')
    ap.add_argument('new')
    ap.add_argument('--old')
    ap.add_argument('--data-dir')
    ap.add_argument('--art-dir')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    print(json.dumps(ingest_family(a.family, a.new, a.old, a.data_dir, a.art_dir, a.dry), indent=1, ensure_ascii=False))
