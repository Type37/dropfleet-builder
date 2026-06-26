"""Generate small thumbnail variants of every ship/admiral/feature/station art.

The picker and list rows display art at ~52-96px but were loading the full
~1100-1500px source (median 54KB, up to 294KB) — ~2.4MB to open the picker.
This writes a 200px-wide webp for each art into assets/art/thumb/, preserving
transparency. The apps point small contexts at these; heroes/print keep full.

Run from the repo root. Idempotent; skips up-to-date thumbs."""
import os, glob
from PIL import Image

SRC = 'assets/art'
DST = 'assets/art/thumb'
WIDTH = 600            # hi-res: crisp even on retina at the largest small context; thumbs lazy-load
os.makedirs(DST, exist_ok=True)

made = skipped = 0
for path in glob.glob(os.path.join(SRC, '*.webp')):
    name = os.path.basename(path)
    out = os.path.join(DST, name)
    # skip if the thumb is newer than the source
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
        skipped += 1
        continue
    with Image.open(path) as im:
        im = im.convert('RGBA')
        if im.width > WIDTH:
            h = round(im.height * WIDTH / im.width)
            im = im.resize((WIDTH, h), Image.LANCZOS)
        im.save(out, 'WEBP', quality=90, method=6)
    made += 1

# report savings
def dir_kb(p):
    return sum(os.path.getsize(f) for f in glob.glob(os.path.join(p, '*.webp'))) // 1024
print('thumbnails written: %d  (skipped %d)' % (made, skipped))
print('full art:  %d KB' % dir_kb(SRC))
print('thumbs:    %d KB' % dir_kb(DST))
