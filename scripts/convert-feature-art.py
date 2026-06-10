"""Convert the deployable-feature PNGs whose name matches a real feature into
assets/art/feat-<slug>.webp, for the feature picker to display."""
import os, glob, re
from PIL import Image

SLUGS = ['aegis-platform', 'comms-platform', 'torpedo-platform']
pngs = {os.path.splitext(os.path.basename(p))[0].lower(): p
        for p in glob.glob('DFC-Art-Assets/**/*.png', recursive=True)}
n = 0
for s in SLUGS:
    src = pngs.get(s)
    if not src:
        print('MISSING:', s); continue
    Image.open(src).convert('RGBA').save(os.path.join('assets/art', 'feat-' + s + '.webp'), 'WEBP', quality=88, method=6)
    print(' ', s, '-> feat-%s.webp' % s); n += 1
print('converted', n)
