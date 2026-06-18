#!/usr/bin/env python3
"""Build the 1200x630 social/link-preview image: a navy banner with the DROPFLEET
COMMANDER chrome wordmark + gold FLEET BUILDER, the six faction emblems in a row,
and a WarLore/url footer. Self-contained (no app screenshot needed).
Run: python scripts/gen-og-image.py  ->  assets/logos/og-preview.png
"""
import os, tempfile
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
GOLD = (255, 204, 0)
GOLD_SOFT = (212, 198, 152)
NAVY = (15, 38, 64)


def brand_font(size):
    src = os.path.join(ROOT, 'assets', 'fonts', 'terminal-grotesque-open.woff2')
    try:
        tmp = os.path.join(tempfile.gettempdir(), 'terminal-grotesque-open.ttf')
        if not os.path.exists(tmp):
            f = TTFont(src); f.flavor = None; f.save(tmp)
        return ImageFont.truetype(tmp, size)
    except Exception:
        return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', size)


canvas = Image.new('RGB', (W, H), NAVY)
draw = ImageDraw.Draw(canvas)

# Subtle vertical depth: darker top, lighter bottom.
top, bot = (10, 22, 36), (22, 46, 74)
px = canvas.load()
for y in range(H):
    t = y / H
    col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W):
        px[x, y] = col

# Gold rules top and bottom (Art Deco frame).
draw.rectangle([0, 0, W, 6], fill=GOLD)
draw.rectangle([0, H - 6, W, H], fill=GOLD)


def center(text, font, y, fill):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (box[2] - box[0])) // 2 - box[0], y), text, font=font, fill=fill)


# Chrome wordmark.
logo = Image.open(os.path.join(ROOT, 'assets', 'logos', 'dfc_logo_text.webp')).convert('RGBA')
lw = 620
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
canvas.paste(logo, ((W - lw) // 2, 56), logo)

# Gold "FLEET BUILDER".
center('FLEET BUILDER', brand_font(60), 56 + lh + 8, GOLD)

# Faction emblem row (UCM, PHR, Scourge, Shaltari, Resistance, Bioficer).
facs = ['ucm', 'phr', 'scourge', 'shaltari', 'resistance', 'bioficer']
icons = []
sz = 116
for key in facs:
    im = Image.open(os.path.join(ROOT, 'assets', 'factions', key + '.webp')).convert('RGBA')
    im = im.resize((sz, int(im.height * sz / im.width)), Image.LANCZOS)
    icons.append(im)
gap = 40
row_w = len(icons) * sz + (len(icons) - 1) * gap
x = (W - row_w) // 2
row_cy = 430
for im in icons:
    canvas.paste(im, (x, row_cy - im.height // 2), im)
    x += sz + gap

# Footer: WarLore + url.
foot = brand_font(28)
draw.text((36, H - 52), 'WARLORE', font=foot, fill=GOLD)
url = 'type37.github.io/dropfleet-builder'
ubox = draw.textbbox((0, 0), url, font=foot)
draw.text((W - 36 - (ubox[2] - ubox[0]), H - 52), url, font=foot, fill=GOLD_SOFT)

out = os.path.join(ROOT, 'assets', 'logos', 'og-preview.png')
canvas.save(out, 'PNG')
print('wrote', out, canvas.size)
