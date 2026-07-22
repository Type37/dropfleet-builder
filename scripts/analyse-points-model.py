#!/usr/bin/env python3
"""Reverse-engineer TTCombat's points formula from the shipped ship costs.

Fits a least-squares model of cost against engineered stat features across all
six factions, then reports which ships the model thinks are mispriced. The point
is NOT to second-guess TTCombat: it is to recover the implicit exchange rate
between hull, armour, thrust and firepower so homebrew ships can be costed on
the same scale instead of by vibes.

Usage:
    python scripts/analyse-points-model.py            # fit + report
    python scripts/analyse-points-model.py --csv out.csv
"""
import json
import glob
import os
import re
import sys
import math
import collections
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── Stat parsing ───────────────────────────────────────────────────────────

def num(v, default=0.0):
    """Pull the first number out of '6"', '4+', 12, None."""
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r'-?\d+(?:\.\d+)?', str(v))
    return float(m.group()) if m else default


def save_prob(v):
    """'3+' -> probability a D6 saves = (7-3)/6. Missing/'-' -> 0."""
    if not v or str(v).strip() in ('-', '', 'None'):
        return 0.0
    n = num(v, 7)
    return max(0.0, min(1.0, (7.0 - n) / 6.0))


def lock_prob(v):
    """'4+' -> probability to hit."""
    if not v or str(v).strip() in ('-', ''):
        return 0.0
    n = num(v, 7)
    return max(0.0, min(1.0, (7.0 - n) / 6.0))


# Arc breadth: a turret that fires everywhere is worth more than a fixed prow gun.
ARC_WEIGHT = {
    'F': 0.55, 'F/S': 0.85, 'S': 0.6, 'F/R': 0.7, 'R': 0.45,
    'FSR': 1.0, 'F/S/R': 1.0, 'ALL': 1.0, 'N': 0.5,
}


def arc_weight(a):
    if not a:
        return 0.7
    key = str(a).strip().upper()
    if key in ARC_WEIGHT:
        return ARC_WEIGHT[key]
    # e.g. "F/S x2" or odd spellings — fall back on how many arcs are named
    parts = [p for p in re.split(r'[/,]', key) if p.strip()]
    return min(1.0, 0.45 + 0.2 * len(parts))


# Weapon special rules that clearly change output. Multipliers are deliberately
# crude: the regression decides how much the resulting "threat" number is worth,
# so these only need to rank weapons sensibly relative to each other.
SPECIAL_MULT = [
    (r'\bburnthrough\b', 1.6),
    (r'\bparticle\b', 1.15),
    (r'\bcritical-?(\d)?', 1.25),
    (r'\bpenetrator\b', 1.2),
    (r'\bfusillade\b', 1.15),
    (r'\bclose action\b', 0.75),
    (r'\bscald\b', 1.1),
    (r'\bcorruptor-?(\d)?', 1.15),
    (r'\bflash\b', 0.9),
    (r'\bwide angle\b', 1.1),
    (r'\bfocused\b', 1.1),
    (r'\bgroup\b', 1.05),
]


def weapon_threat(w):
    """A single scalar standing in for 'how much damage does this thing do'.

    attack x P(hit) x damage, scaled by arc breadth and special rules. Not exact
    (the real engine in js/calc-engine.js models saves and rerolls properly),
    but monotone in the things that matter and cheap to compute for 1500 ships.
    """
    atk = num(w.get('attack'), 0)
    dmg = num(w.get('damage'), 1) or 1
    p = lock_prob(w.get('lock'))
    base = atk * p * dmg * arc_weight(w.get('arc'))
    spec = (w.get('special') or '').lower()
    for pat, mult in SPECIAL_MULT:
        if re.search(pat, spec):
            base *= mult
    return base


# Ship-level special rules worth pricing separately.
SHIP_FLAGS = {
    'aegis': r'\baegis-?(\d+)?',
    'command': r'\bcommand ship-?(\d+)?',
    'reinforced': r'\breinforced armour\b',
    'stealth': r'\bstealth\b',
    'atmospheric': r'\batmospheric\b',
    'launch': r'\blaunch-?\s?(\d+)?',
    'open': r'\bopen\b',
}


def ship_features(ship, category):
    st = ship.get('stats') or {}
    weps = ship.get('weapons') or []
    spec = (st.get('special') or '').lower()

    threat = sum(weapon_threat(w) for w in weps)
    hull = num(st.get('hull'))
    es, ks = save_prob(st.get('es')), save_prob(st.get('ks'))
    # Effective durability: hull scaled by how often each save type turns damage
    # away. Averaging the two saves is a simplification (real games weight them
    # by what the opponent brings) but is faction-neutral.
    avg_save = (es + ks) / 2.0
    durability = hull / max(0.25, (1.0 - avg_save))

    f = {
        'hull': hull,
        'durability': durability,
        'save_avg': avg_save,
        'thrust': num(st.get('thrust')),
        'scan': num(st.get('scan')),
        'sig': num(st.get('sig')),
        'bs': save_prob(st.get('bs')),
        'threat': threat,
        'threat_x_dur': threat * math.sqrt(max(1.0, durability)) / 10.0,
        'n_weapons': float(len(weps)),
    }
    for name, pat in SHIP_FLAGS.items():
        m = re.search(pat, spec)
        f['sp_' + name] = (num(m.group(1), 1.0) if (m and m.lastindex) else 1.0) if m else 0.0
    for cat in ('light', 'medium', 'heavy', 'colossal', 'payload'):
        f['cat_' + cat] = 1.0 if category == cat else 0.0
    return f


# ── Load ───────────────────────────────────────────────────────────────────

def load_ships():
    rows = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'data', 'faction-*.json'))):
        faction = os.path.basename(path).replace('faction-', '').replace('.json', '')
        d = json.load(open(path, encoding='utf-8'))
        for g in d.get('groups') or []:
            ship = g.get('ship') or {}
            cost = ship.get('cost')
            if not isinstance(cost, (int, float)) or cost <= 0:
                continue
            if ship.get('additional') or g.get('additional'):
                continue          # counts-as/misc pricing is a different beast
            cat = g.get('category') or ''
            rows.append({
                'faction': faction,
                'name': ship.get('name') or g.get('name') or '?',
                'category': cat,
                'cost': float(cost),
                'feat': ship_features(ship, cat),
            })
    return rows


# ── Fit ────────────────────────────────────────────────────────────────────

def fit(rows, keys):
    X = np.array([[r['feat'][k] for k in keys] + [1.0] for r in rows])
    y = np.array([r['cost'] for r in rows])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    pred = X @ beta
    resid = y - pred
    ss_res = float((resid ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    return beta, pred, resid, r2


def main():
    rows = load_ships()
    if not rows:
        print('No ships loaded.')
        return
    keys = sorted(rows[0]['feat'].keys())

    beta, pred, resid, r2 = fit(rows, keys)
    mae = float(np.abs(resid).mean())

    print(f'Fitted on {len(rows)} core ships across 6 factions.')
    print(f'R^2 = {r2:.3f}   mean abs error = {mae:.1f} pts   '
          f'(mean cost {np.mean([r["cost"] for r in rows]):.0f})\n')

    print('Coefficients (points per unit):')
    for k, b in sorted(zip(keys, beta[:-1]), key=lambda kv: -abs(kv[1])):
        print(f'  {k:16s} {b:+9.2f}')
    print(f'  {"(intercept)":16s} {beta[-1]:+9.2f}\n')

    # Per-faction bias: is any faction systematically cheaper than the model?
    print('Mean residual by faction (negative = costs less than the model expects):')
    byf = collections.defaultdict(list)
    for r, e in zip(rows, resid):
        byf[r['faction']].append(e)
    for f, es in sorted(byf.items(), key=lambda kv: np.mean(kv[1])):
        print(f'  {f:11s} {np.mean(es):+7.1f}  (n={len(es)})')

    print('\nMean residual by weight class:')
    byc = collections.defaultdict(list)
    for r, e in zip(rows, resid):
        byc[r['category'] or '?'].append(e)
    for c, es in sorted(byc.items(), key=lambda kv: np.mean(kv[1])):
        print(f'  {c:11s} {np.mean(es):+7.1f}  (n={len(es)})')

    order = np.argsort(resid)
    print('\nCheapest vs model (potential bargains):')
    for i in order[:10]:
        r = rows[i]
        print(f'  {r["cost"]:>4.0f} pts (model {pred[i]:>5.0f})  {r["faction"]:10s} {r["name"]}')
    print('\nDearest vs model:')
    for i in order[-10:][::-1]:
        r = rows[i]
        print(f'  {r["cost"]:>4.0f} pts (model {pred[i]:>5.0f})  {r["faction"]:10s} {r["name"]}')

    if '--csv' in sys.argv:
        out = sys.argv[sys.argv.index('--csv') + 1]
        with open(out, 'w', encoding='utf-8') as fh:
            fh.write('faction,name,category,cost,model,residual\n')
            for r, p, e in zip(rows, pred, resid):
                nm = r['name'].replace(',', ' ')
                fh.write(f'{r["faction"]},{nm},{r["category"]},{r["cost"]:.0f},{p:.1f},{e:.1f}\n')
        print(f'\nWrote {out}')


if __name__ == '__main__':
    main()
