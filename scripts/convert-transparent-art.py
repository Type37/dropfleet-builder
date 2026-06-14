"""
Re-convert specific FLATTENED (black-background) ship-art webps from their
transparent-background source PNGs in DFC-Art-Assets/, preserving alpha.

The mapping is explicit and reviewed: each target is a webp that is BOTH used by
the app AND currently flattened, paired with the transparent source PNG that
depicts that ship. Sources are located by filename anywhere under DFC-Art-Assets.

Usage:
  python scripts/convert-transparent-art.py --dry   # report only
  python scripts/convert-transparent-art.py         # convert + overwrite
"""
import glob, os, sys
from PIL import Image

DRY = '--dry' in sys.argv
ART = 'assets/art'

# target webp basename -> source PNG filename (somewhere under DFC-Art-Assets)
MAP = {
    'aaru_emerald': 'aaru-emerald-counts-asemerald.png',
    'amazon': 'amazon-counts-as-drake.png',
    'argonaut': 'argonaut-counts-as-farragut.png',
    'avalon': 'avalon-counts-as-perth.png',
    'centurion': 'centurion.png',
    'manticore': 'manticore-counts-as-banshee.png',
    'myrmidon': 'myrmidon-counts-as-barbarossa.png',
    'olympus': 'olympus-counts-as-yi-sun-sin.png',
    'palladium': 'palladium-counts-as-sapphire.png',
    'prototype_orpheus': 'prototype-orpheus.png',
    'saratoga': 'saratoga-counts-as-new-cairo.png',
    'scipio': 'scipio-counts-as-priam.png',
    'trident': 'trident-counts-as-nelson.png',
    'the_hated': 'the-hated-little-chaos.png',
    'guy': 'guy-fawkes-parliament.png',
    'kalium_knc5': 'kalium-knc-5-counts-as-resistance-light-cruiser-with-1xNC16-and-2x-VentCannonTurrets.png',
    'kalium_knc12': 'kalium-knc-12-countsas-resistance-light-cruiser-with-2xventcannon-2xfithers-bombers.png',
    'bioficer_battleship_bastion': 'bastion.png',
    'bioficer_battleship_binary': 'binary.png',
    'bioficer_battleship_bishop': 'bishop.png',
}

# index every source png by basename
srcindex = {}
for p in glob.glob('DFC-Art-Assets/**/*.png', recursive=True):
    srcindex.setdefault(os.path.basename(p), p)

done, missing, optaque_warn = [], [], []
for target, srcname in sorted(MAP.items()):
    src = srcindex.get(srcname)
    if not src:
        missing.append((target, srcname)); continue
    im = Image.open(src).convert('RGBA')
    if im.getchannel('A').getextrema()[0] >= 250:
        optaque_warn.append((target, srcname))   # source itself has no transparency
    out = os.path.join(ART, target + '.webp')
    if not DRY:
        im.save(out, 'WEBP', quality=88, method=6)
    done.append((target, srcname))

print(('DRY: would convert' if DRY else 'Converted'), len(done), 'webps:')
for t, s in done:
    print(f'    {t}.webp  <=  {s}')
if optaque_warn:
    print('\nWARNING - source PNG has no transparency (would still be flat):')
    for t, s in optaque_warn:
        print('   ', t, '<=', s)
if missing:
    print('\nMISSING source (skipped):')
    for t, s in missing:
        print('   ', t, '<=', s)
