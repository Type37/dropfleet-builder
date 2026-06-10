"""
Convert the updated transparent-background ship-art PNGs in DFC-Art-Assets/ into
the app's assets/art/*.webp, for every PNG whose name maps confidently onto an
existing webp (exact match, or hyphen->underscore). PNGs that don't map are left
for a follow-up (printed at the end). Existing webps are tracked in git, so an
overwrite is recoverable.

Usage:
  python scripts/convert-new-art.py --dry    # report only
  python scripts/convert-new-art.py          # convert + overwrite
"""
import os, glob, sys

from PIL import Image

DRY = '--dry' in sys.argv
ART = 'assets/art'
webps = set(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(ART + '/*.webp'))
pngs = sorted(glob.glob('DFC-Art-Assets/**/*.png', recursive=True))

# Build confident mapping target_webp_basename -> [source pngs]
mapping = {}      # target -> list of source paths (to detect collisions)
unmapped = []
for p in pngs:
    base = os.path.splitext(os.path.basename(p))[0].lower()
    target = base if base in webps else (base.replace('-', '_') if base.replace('-', '_') in webps else None)
    if target is None:
        unmapped.append(base)
    else:
        mapping.setdefault(target, []).append(p)

collisions = {t: srcs for t, srcs in mapping.items() if len(srcs) > 1}
converted = 0
errors = []
total_bytes = 0
for target, srcs in sorted(mapping.items()):
    if len(srcs) > 1:
        # ambiguous: two source PNGs claim the same webp; skip, surface instead
        continue
    src = srcs[0]
    try:
        im = Image.open(src).convert('RGBA')
        out = os.path.join(ART, target + '.webp')
        if not DRY:
            im.save(out, 'WEBP', quality=88, method=6)
            total_bytes += os.path.getsize(out)
        converted += 1
    except Exception as e:
        errors.append((src, str(e)))

print(('DRY: would convert' if DRY else 'Converted'), converted, 'images')
print('Collisions (2+ PNGs -> same webp, SKIPPED):', len(collisions))
for t, srcs in sorted(collisions.items()):
    print('   ', t, '<=', [os.path.basename(s) for s in srcs])
print('Errors:', len(errors))
for s, e in errors[:10]:
    print('   ', s, e)
if not DRY:
    print('Total written bytes: %.1f MB' % (total_bytes / 1e6))
print('Unmapped (need a name decision):', len(unmapped))
