#!/usr/bin/env python3
"""Generate the 1200x630 social/link-preview image (og:image) for the fleet builder.

Scrapers (Discord, Twitter, Facebook, iMessage) want a ~1200x630 PNG/JPG; WebP is
unreliable. We composite the chrome DROPFLEET COMMANDER wordmark on a brand dark-navy
gradient with a gold "FLEET BUILDER" subtitle, the faction line, and the WarLore mark.
Run: python scripts/gen-og-image.py  ->  assets/logos/og-preview.png
"""
import os, tempfile
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
GOLD = (255, 204, 0)
GOLD_DIM = (190, 154, 30)
INK_FAINT = (150, 165, 185)

# Brand font: convert the WOFF2 to a temp TTF so PIL can use it.
def brand_font(size):
    src = os.path.join(ROOT, 'assets', 'fonts', 'terminal-grotesque-open.woff2')
    try:
        tmp = os.path.join(tempfile.gettempdir(), 'terminal-grotesque-open.ttf')
        if not os.path.exists(tmp):
            f = TTFont(src)
            f.flavor = None
            f.save(tmp)
        return ImageFont.truetype(tmp, size)
    except Exception:
        return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', size)

# Background: vertical gradient black -> navy.
img = Image.new('RGB', (W, H), (10, 12, 16))
top = (9, 12, 18)
bot = (20, 40, 64)
px = img.load()
for y in range(H):
    t = y / (H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)
draw = ImageDraw.Draw(img)

# Gold rules top & bottom for an Art-Deco frame feel.
draw.rectangle([0, 0, W, 6], fill=GOLD)
draw.rectangle([0, H - 6, W, H], fill=GOLD)

# Centre wordmark.
logo = Image.open(os.path.join(ROOT, 'assets', 'logos', 'dfc_logo_text.webp')).convert('RGBA')
lw = 920
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
img.paste(logo, ((W - lw) // 2, 120), logo)


def center(text, font, y, fill):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (box[2] - box[0])) // 2 - box[0], y), text, font=font, fill=fill)

# Gold "FLEET BUILDER" subtitle.
sub = brand_font(96)
center('FLEET BUILDER', sub, 120 + lh + 18, GOLD)

# Faction line.
fac = brand_font(34)
center('UCM   PHR   SCOURGE   SHALTARI   RESISTANCE   BIOFICERS', fac, 470, INK_FAINT)

# Footer: WarLore mark (left) + url (right).
foot = brand_font(30)
draw.text((40, H - 58), 'WARLORE', font=foot, fill=GOLD)
url = 'type37.github.io/dropfleet-builder'
box = draw.textbbox((0, 0), url, font=foot)
draw.text((W - 40 - (box[2] - box[0]), H - 58), url, font=foot, fill=GOLD_DIM)

out = os.path.join(ROOT, 'assets', 'logos', 'og-preview.png')
img.save(out, 'PNG')
print('wrote', out, img.size)
