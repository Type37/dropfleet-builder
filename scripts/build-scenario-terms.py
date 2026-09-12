#!/usr/bin/env python3
"""Build the verbatim definitions Load Scenario uses to explain a scenario.

    PYTHONUTF8=1 python scripts/build-scenario-terms.py

A published scenario names rules without explaining them: "All players
Imminent", "Demolish Scoring", "Focal Point", "Tugging Along". The generator card
explains its own terms from tables already in the page (arrival modes, objectives,
scenery, Features, dropsites). Everything else comes from here, and every word is
the book's or the ship card's:

  Scenario Expansion 1 (250818) p2  - Imminent, Backline, Staggered, and the
                                      Normal, Demolish, Focal Points, Kill Points
                                      and Assess scoring methods with their tables.
                                      Copied from the PDF text layer; the page is
                                      two columns, so it is not re-read by script.
  Rulebook 2.3.1 via data/rules-wiki.json - 11.1 Control & Contest, 11.2
                                      Damaging Dropsites, 12.3 Secondary Objectives,
                                      12.3.4 Annihilate, 12.3.5 Take Prizes,
                                      12.3.7 Decapitate, 12.4 Kill Points & Ties.
  data/fleet-data.json              - the seven Civilian ships the scenarios name,
                                      with stats, weapons and special rules as the
                                      builder already carries them.

Writes scenarios/dropfleet/scenario-terms.js.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'scenarios', 'dropfleet', 'scenario-terms.js')

SE1 = {
    'Imminent': {'body': [
        'Players using Imminent Deployment may only activate and deploy Groups with L and M Tonnage in the 1st round. From the start of the 2nd round onwards, they may activate Groups of H tonnage. From the start of the 3rd round onwards, they may activate any Group.']},
    'Backline': {'body': [
        'Players using Backline Deployment may only activate and deploy Groups of H and C Tonnage the 1st round. From the start of the 2nd round onwards, they may activate any Group. Groups with the Vanguard-X special rule may use it as normal.']},
    'Staggered': {'body': [
        'Players using Staggered Deployment can only activate and deploy X Groups of their choice in the 1st round. Then they must activate and deploy an additional X Groups of their choice in the 2nd round. They must activate and deploy any remaining Groups in the 3rd round. Groups with the Vanguard-X special rule may use it as normal.',
        'For Skirmish games, X is 1. For Clash games, X is 2. For Battle games, X is 3. For Reconquest games, X is 4 plus 1 for every 1000 points above 3001.']},
    'Normal Scoring': {
        'body': ['Players are awarded the corresponding High Scoring when they Control a Scenario Objective and the corresponding Low Scoring when they Contest a Scenario Objective.'],
        'table': {'head': ['Dropsite Size', 'High Scoring', 'Low Scoring'],
                  'rows': [['Small', '2VP', '0VP'], ['Medium', '3VP', '1VP'], ['Large', '4VP', '2VP']]},
        'after': ['Normal Scoring awards VP during the Victory Points step of the End Phase on rounds 4 and 6.']},
    'Demolish Scoring': {'body': [
        'Using the Normal Scoring table, players are immediately awarded the corresponding High Scoring when they have Levelled a Dropsite. Using the Normal Scoring table, players are immediately awarded the corresponding Low Scoring when they have Ruined a Dropsite.']},
    'Focal Points Scoring': {
        'body': ['Players total up the specified value of their Ships in range of the Focal Point. The players with the highest combined value within that distance gains 3VP. Any other player with at least half of that value within range of that Focal point gains 1VP. When calculating value, Ships use their High Value unless otherwise specified and Ships assigned an Admiral always use their High Value. Ships only count as being in a single Focal Point, if a Ship would be in range of two or more focal points, choose one for it to count towards.'],
        'table': {'head': ['Dropsite Size', 'High Value', 'Low Value'],
                  'rows': [['Light', '1', '0'], ['Medium', '4', '1'], ['Heavy', '7', '3'], ['Colossal', '11', '5']]},
        'after': ['Focal Points award VP during the Victory Points step of the End Phase on rounds 4 and 6.']},
    'Kill Points Scoring': {'body': [
        'Players are awarded 2VP at the end of the game for every 500 points of Ships and Admirals they have destroyed.']},
    'Assess Scoring': {'body': [
        'While on General Quarters, any Capital Ship within 6” of a Scenario Dropsite may choose to Assess that Dropsite before or after its movement. If it does, it cannot attack and cannot launch assets. Each Dropsite can only be Assessed by each player once and each Dropsite Assessed awards the Assessing player 1VP.']},
}

# 10 and 10.1-10.4: Scenery and its four types; 12.1.3: how a layout's scenery is placed
RULEBOOK = ['10', '10.1', '10.2', '10.3', '10.4', '11.1', '11.2', '12.1.3', '12.3', '12.3.4', '12.3.5',
            '12.3.7', '12.4']

SHIPS = {
    'Terminus Harvester': ('Type-87 Terminus Harvester', 'type_87_terminus_harvester.webp'),
    'Flenser': ('VX-22 Flenser', 'vx_22_flenser.webp'),
    'Provenance Ark': ('PRK-91 Provenance Ark', 'prk_91_provenance_ark.webp'),
    'Tugboat': ('T-Type Tugboat', 't_type_tugboat.webp'),
    'Hyperyacht': ('Hyperyacht Somniferum', 'hyperyacht_somniferum.webp'),
    'Resupply Hauler': ('SLM-9 Resupply Hauler', 'slm_9_resupply_hauler.webp'),
    'Dredger': ('LKS Dredger', 'lks_dredger.webp'),
}


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def runs_html(runs):
    out = []
    for r in runs:
        t = esc(r.get('t', '')) if isinstance(r, dict) else esc(str(r))
        out.append('<b>%s</b>' % t if isinstance(r, dict) and r.get('b') else t)
    return ''.join(out)


def rulebook_sections():
    wiki = json.load(io.open(os.path.join(ROOT, 'data', 'rules-wiki.json'), encoding='utf-8'))
    found = {}

    def walk(n):
        if isinstance(n, dict):
            if n.get('number') in RULEBOOK:
                found[n['number']] = n
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)
    walk(wiki)
    missing = [x for x in RULEBOOK if x not in found]
    if missing:
        sys.exit('rules-wiki.json is missing sections: %s' % missing)
    return {num: {'heading': n['heading'],
                  'body': [runs_html(b.get('runs', [])) for b in n.get('body', []) if b.get('kind') != 'table']}
            for num, n in found.items()}


def ships():
    data = json.load(io.open(os.path.join(ROOT, 'data', 'fleet-data.json'), encoding='utf-8'))
    wanted = {full: (key, art) for key, (full, art) in SHIPS.items()}
    recs = {}

    def walk(n):
        if isinstance(n, dict):
            if n.get('name') in wanted and 'stats' in n:
                recs.setdefault(n['name'], n)
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)
    walk(data)
    out = {}
    for full, (key, art) in wanted.items():
        r = recs.get(full)
        if not r:
            sys.exit('fleet-data.json has no %s' % full)
        if not os.path.exists(os.path.join(ROOT, 'assets', 'art', 'thumb', art)):
            sys.exit('missing art %s' % art)
        out[key] = {
            'name': full, 'art': art, 'tonnage': r.get('tonnage'), 'cost': r.get('cost'),
            'stats': r['stats'], 'weapons': r.get('weapons', []),
            'rules': [{'name': s['name'], 'text': esc(s['description']).replace('\n', '<br>')}
                      for s in r.get('specialRules', [])],
        }
    return out


def main():
    se1 = {k: dict(v) for k, v in SE1.items()}
    rb = rulebook_sections()
    sh = ships()
    js = ('// Generated by scripts/build-scenario-terms.py. Verbatim; do not edit by hand.\n'
          'const SCN_SE1=%s;\nconst SCN_RULEBOOK=%s;\nconst SCN_SHIPS=%s;\n'
          % (json.dumps(se1, ensure_ascii=False), json.dumps(rb, ensure_ascii=False), json.dumps(sh, ensure_ascii=False)))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
    print('Scenario Expansion 1 terms: %d' % len(se1))
    print('Rulebook sections: %s' % ', '.join('%s %s' % (k, rb[k]['heading']) for k in RULEBOOK))
    print('Ships: %s' % ', '.join(v['name'] for v in sh.values()))
    print('-> %s (%d KB)' % (os.path.relpath(OUT, ROOT), len(js.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
