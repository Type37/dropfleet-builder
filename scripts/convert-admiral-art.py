"""Convert the named admiral-ship PNGs to the webp names the app's ADMIRAL_ART
map already references, so the famous-admiral flagship art updates to the new
transparent cutouts."""
import os, glob
from PIL import Image

MAP = {
    'agency-bastion-battleship': ['agency_bastion'],
    'granite-halsey-washington': ['halsey', 'granite_halsey'],
    'havelock-new-york': ['havelock'],
}
pngs = {os.path.splitext(os.path.basename(p))[0].lower(): p for p in glob.glob('DFC-Art-Assets/**/*.png', recursive=True)}
done = 0
for slug, targets in MAP.items():
    src = pngs.get(slug)
    if not src:
        print('MISSING source:', slug); continue
    im = Image.open(src).convert('RGBA')
    for t in targets:
        im.save(os.path.join('assets/art', t + '.webp'), 'WEBP', quality=88, method=6)
        print(' ', slug, '->', t + '.webp')
        done += 1
print('converted', done, 'webp files')
