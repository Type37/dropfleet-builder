#!/usr/bin/env python3
"""Build the 1200x630 social/link-preview image: a navy title band (DROPFLEET
COMMANDER chrome wordmark + gold FLEET BUILDER) above a real screenshot of the
builder datasheets (captured headless into __ogcap_raw.png).
Run: python scripts/gen-og-image.py  ->  assets/logos/og-preview.png
"""
import os, tempfile
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
GOLD = (255, 204, 0)
BAND_H = 210


def brand_font(size):
    src = os.path.join(ROOT, 'assets', 'fonts', 'terminal-grotesque-open.woff2')
    try:
        tmp = os.path.join(tempfile.gettempdir(), 'terminal-grotesque-open.ttf')
        if not os.path.exists(tmp):
            f = TTFont(src); f.flavor = None; f.save(tmp)
        return ImageFont.truetype(tmp, size)
    except Exception:
        return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', size)


canvas = Image.new('RGB', (W, H), (10, 22, 36))
draw = ImageDraw.Draw(canvas)

# Builder screenshot fills the area below the title band. Crop a full-width slice
# that starts at the first ship card (skip the app top-bar + fleet header).
shot = Image.open(os.path.join(ROOT, '__ogcap_raw.png')).convert('RGB')
sw, sh = shot.size
area_h = H - BAND_H                       # 420
crop_h = int(area_h * sw / W)             # full-width slice height
crop_top = 250                            # ~ first ship card
bg = shot.crop((0, crop_top, sw, min(sh, crop_top + crop_h))).resize((W, area_h), Image.LANCZOS)
canvas.paste(bg, (0, BAND_H))

# Title band: vertical navy gradient.
top, bot = (8, 16, 26), (26, 54, 84)
bpx = canvas.load()
for y in range(BAND_H):
    t = y / BAND_H
    col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W):
        bpx[x, y] = col
draw.rectangle([0, 0, W, 5], fill=GOLD)            # top gold rule
draw.rectangle([0, BAND_H - 4, W, BAND_H], fill=GOLD)  # rule between band and shot

# Chrome wordmark, centred in the band.
logo = Image.open(os.path.join(ROOT, 'assets', 'logos', 'dfc_logo_text.webp')).convert('RGBA')
lw = 560
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
canvas.paste(logo, ((W - lw) // 2, 24), logo)


def center(text, font, y, fill):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (box[2] - box[0])) // 2 - box[0], y), text, font=font, fill=fill)

center('FLEET BUILDER', brand_font(56), 24 + lh + 6, GOLD)

# Bottom strip: WarLore + url on a navy bar (legible over the light datasheets).
bar_h = 50
bar = Image.new('RGBA', (W, bar_h), (8, 16, 26, 235))
canvas.paste(Image.alpha_composite(canvas.crop((0, H - bar_h, W, H)).convert('RGBA'), bar).convert('RGB'), (0, H - bar_h))
draw.rectangle([0, H - bar_h - 3, W, H - bar_h], fill=GOLD)
foot = brand_font(27)
draw.text((34, H - bar_h + 11), 'WARLORE', font=foot, fill=GOLD)
url = 'type37.github.io/dropfleet-builder'
ubox = draw.textbbox((0, 0), url, font=foot)
draw.text((W - 34 - (ubox[2] - ubox[0]), H - bar_h + 11), url, font=foot, fill=(212, 198, 152))

out = os.path.join(ROOT, 'assets', 'logos', 'og-preview.png')
canvas.save(out, 'PNG')
print('wrote', out, canvas.size)
