#!/usr/bin/env python3
"""The weekly Dropfleet update, end to end, with no person and (usually) no Claude.

    python scripts/auto-update.py

1. Ask scan-dfc-files.py what TTCombat changed on the downloads page.
2. Download each changed ship sheet to a temporary folder (nothing is kept).
3. Compare it card by card with scripts/card-snapshots.json, the previous
   edition's cards in text form, and write what moved into data/ (auto_ingest.py).
4. Cut art for new ships, point scripts at the new file names, rebuild the
   Civilian picker, regenerate the generated files, raise the cache name, and
   write the What's New entry and the "Updated <month> with <file>" line.

Writes auto-update-report.json and exits:
    0   done (or nothing to do)
    10  some cards or documents need Claude; the report lists each with its page
    20  something needs a person (a ship vanished from a sheet, a file was removed)
"""
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from auto_ingest import FAMILIES, FACTIONS, ingest_family, ROOT  # noqa: E402
from cdn_fetch import fetch_newest  # noqa: E402

PY = sys.executable
SNAPSHOTS = os.path.join(HERE, 'card-snapshots.json')
REPORT = os.path.join(ROOT, 'auto-update-report.json')
APPS = [os.path.join(ROOT, 'js', 'app.js'), os.path.join(ROOT, 'mobile', 'js', 'mobile.js')]
LF = chr(10)
FRIENDLY = {
    'Civilian_Ships_Scenarios': 'Civilian Ships', 'Misc_Combined_Ship_Stats': 'Miscellaneous Ships',
    'UCM_Combined_Fleet_Stats': 'UCM', 'PHR_Combined_Fleet_Stats': 'PHR', 'Scourge_Combined_Fleet_Stats': 'Scourge',
    'Shaltari_Combined_Fleet_Stats': 'Shaltari', 'Resistance_Combined_Fleet_Stats': 'Resistance',
    'Bioficer_Combined_Fleet_Stats': 'Bioficer',
}
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
          'October', 'November', 'December']


def run(*args):
    r = subprocess.run([PY, *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8',
                       env=dict(os.environ, PYTHONUTF8='1'))
    return r.returncode, r.stdout + r.stderr


def read(p):
    return open(p, encoding='utf-8', newline='').read()


def write(p, s):
    open(p, 'w', encoding='utf-8', newline='').write(s)


def month_of(date_stamp):
    """'261001' -> 'October 2026'."""
    if date_stamp and re.match(r'^\d{6}$', date_stamp):
        return '%s 20%s' % (MONTHS[int(date_stamp[2:4]) - 1], date_stamp[:2])
    t = datetime.date.today()
    return '%s %d' % (MONTHS[t.month - 1], t.year)


def text_files():
    pats = ['scripts/*.py', 'scripts/*.js', 'scripts/*.mjs', 'scenarios/**/*.js', 'scenarios/**/*.html',
            'js/*.js', 'mobile/js/*.js']
    for pat in pats:
        for p in glob.glob(os.path.join(ROOT, pat), recursive=True):
            yield p


def repoint(old, new):
    """Every reference to the old file name or URL now names the new one."""
    touched = []
    for p in text_files():
        if os.path.basename(p) in ('auto-update.py', 'auto_ingest.py'):
            continue
        s = read(p)
        t = s
        for a, b in ((old.get('url'), new.get('url')), (old.get('filename'), new.get('filename'))):
            if a and b and a != b:
                t = t.replace(a, b)
        if t != s:
            write(p, t)
            touched.append(os.path.relpath(p, ROOT))
    return touched


def referenced(filename):
    return any(filename in read(p) for p in text_files()
               if os.path.basename(p) not in ('auto-update.py', 'auto_ingest.py'))


def add_art_entries(pairs):
    for p in APPS:
        s = read(p)
        nl = chr(13) + LF if chr(13) + LF in s[:2000] else LF
        anchor = 'const SHIP_ART_SPECIAL = {'
        i = s.index(anchor) + len(anchor)
        lines = ''.join("%s    '%s':'%s'," % (nl, name.replace("'", "\\'"), slug)
                        for name, slug in pairs if "'%s':" % name.replace("'", "\\'") not in s)
        write(p, s[:i] + lines + s[i:])


def bump_cache():
    p = os.path.join(ROOT, 'sw.js')
    s = read(p)
    m = re.search(r"const CACHE = 'dfc-cache-v(\d+)';", s)
    write(p, s.replace(m.group(0), "const CACHE = 'dfc-cache-v%d';" % (int(m.group(1)) + 1)))


def js_str(s):
    return s.replace('\\', '').replace("'", '’')


def add_changelog(title, items, files):
    today = datetime.date.today().isoformat()
    entry = "    { date: '%s', title: '%s', items: [%s%s%s    ]}," % (
        today, js_str(title), LF, ''.join("      '%s',%s" % (js_str(i), LF) for i in items), '')
    for p in APPS:
        s = read(p)
        nl = chr(13) + LF if chr(13) + LF in s[:2000] else LF
        anchor = '  const CHANGELOG = [' + nl
        i = s.index(anchor) + len(anchor)
        write(p, s[:i] + entry.replace(LF, nl) + nl + s[i:])
    p = os.path.join(ROOT, 'CHANGELOG.md')
    s = read(p)
    anchor = 'of what changed between stats PDFs.' + LF + LF
    md = '### %s: %s%s%sAutomatic, from %s.%s%s%s%s' % (
        today, title, LF, LF, ', '.join('`%s`' % f for f in files), LF, LF,
        ''.join('- %s%s' % (i, LF) for i in items), LF)
    write(p, s.replace(anchor, anchor + md, 1))


def set_edition(month, files):
    p = os.path.join(ROOT, 'data', 'fleet-index.json')
    s = read(p)
    d = json.loads(s)
    d['edition'] = {'month': month, 'file': ', '.join(os.path.splitext(f)[0] for f in files)}
    step = (len(s.split(LF, 2)[1]) - len(s.split(LF, 2)[1].lstrip(' '))) or 1
    out = json.dumps(d, indent=step, ensure_ascii=False)
    write(p, out.replace(LF, chr(13) + LF) if chr(13) + LF in s[:200] else out)


def ship_counts():
    p = os.path.join(ROOT, 'data', 'fleet-index.json')
    s = read(p)
    d = json.loads(s)
    for k, f in d['factions'].items():
        f['shipCount'] = len(json.load(open(os.path.join(ROOT, 'data', 'faction-%s.json' % k), encoding='utf-8'))['groups'])
    step = (len(s.split(LF, 2)[1]) - len(s.split(LF, 2)[1].lstrip(' '))) or 1
    out = json.dumps(d, indent=step, ensure_ascii=False)
    write(p, out.replace(LF, chr(13) + LF) if chr(13) + LF in s[:200] else out)


def main():
    report = {'changelog': [], 'claude': [], 'person': [], 'files': []}
    code, out = run(os.path.join(HERE, 'scan-dfc-files.py'), '--json')
    try:
        scan = json.loads(out[out.index('{'):])
    except ValueError:
        print(out.strip())
        print('Could not read the scan; nothing done.')
        return 0
    ch = scan['changes']
    todo = [(fam, None, cur) for fam, cur in ch['NEW']] + [(fam, prev, cur) for k in ('UPDATED', 'REVISED', 'RESIZED')
                                                           for fam, prev, cur in ch[k]]
    for fam, prev in ch['REMOVED']:
        report['person'].append('TTCombat removed %s from the downloads page.' % prev['filename'])
    if not todo and not report['person']:
        print('Nothing new on the downloads page.')
        json.dump(report, open(REPORT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        return 0

    snaps = json.load(open(SNAPSHOTS, encoding='utf-8')) if os.path.exists(SNAPSHOTS) else {}
    tmp = tempfile.mkdtemp(prefix='dfc-')
    data_changed, new_art, dated, civilian = False, [], [], None
    try:
        for fam, prev, cur in todo:
            report['files'].append(cur['filename'])
            dated.append(cur.get('date'))
            pdf = os.path.join(tmp, cur['filename'])
            if fam in FAMILIES:
                fetch_newest(cur['url'], pdf)
                before = {f: read(os.path.join(ROOT, 'data', 'faction-%s.json' % f)) for f in FACTIONS}
                r = ingest_family(fam, pdf, (snaps.get(fam) or {}).get('cards'))
                after = {f: read(os.path.join(ROOT, 'data', 'faction-%s.json' % f)) for f in FACTIONS}
                data_changed |= before != after
                report['changelog'] += ['%s: %s' % (FRIENDLY[fam], line) if not line.startswith('New ship') else line
                                        for line in r['changelog']]
                for c in r['claude']:
                    c['url'] = cur['url']
                report['claude'] += r['claude']
                report['person'] += r['person']
                new_art += r['newArt']
                snaps[fam] = {'file': cur['filename'], 'cards': r['snapshot']}
                if fam == 'Civilian_Ships_Scenarios':
                    civilian = (pdf, cur)
            elif prev and referenced(prev['filename']):
                report['claude'].append({'family': fam, 'pdf': cur['filename'], 'url': cur['url'],
                                         'why': ['a document the app uses changed; read it and bring the app in line']})
            if prev:
                repoint(prev, cur)
        if new_art:
            add_art_entries(new_art)
            run(os.path.join(HERE, 'gen-thumbnails.py'))
        if civilian:  # after the thumbnails: the picker shows them
            pdf, cur = civilian
            rc, o = run(os.path.join(HERE, 'build-civilian-ships.py'), pdf)
            if rc:
                report['claude'].append({'family': 'Civilian_Ships_Scenarios', 'pdf': cur['filename'], 'url': cur['url'],
                                         'why': ['Civilian Ship picker: ' + o.strip().splitlines()[-1]]})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if data_changed:
        ship_counts()
    if report['changelog']:
        fams = sorted({FRIENDLY.get(re.sub(r'_\d{6}\.pdf$', '', f), f) for f in report['files']})
        add_changelog('TTCombat update: ' + ', '.join(fams), report['changelog'], report['files'])
        stamps = [d for d in dated if d]
        set_edition(month_of(max(stamps) if stamps else None), report['files'])
        bump_cache()
    # Last, because it mirrors fleet-index.json (ship counts, edition) as well as the factions.
    run(os.path.join(HERE, 'gen-fleet-data.py'))
    json.dump(snaps, open(SNAPSHOTS, 'w', encoding='utf-8', newline=LF), ensure_ascii=False, indent=0)
    run(os.path.join(HERE, 'gen-offline-manifest.py'))
    run(os.path.join(HERE, 'scan-dfc-files.py'), '--update')

    json.dump(report, open(REPORT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in report.items()}, indent=1, ensure_ascii=False))
    if report['person']:
        return 20
    if report['claude']:
        return 10
    return 0


if __name__ == '__main__':
    sys.exit(main())
