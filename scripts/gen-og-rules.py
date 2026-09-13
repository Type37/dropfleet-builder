#!/usr/bin/env python3
"""Build the Interactive Rules link-preview image: the same gold-on-navy Art Deco
frame as the main banner, but plain, no faction band. The DROPFLEET COMMANDER
chrome wordmark, INTERACTIVE RULES in Broadway, a one-line subtitle, WarLore footer.
Run: python scripts/gen-og-rules.py  ->  assets/og/rules.png
"""
import os, tempfile
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
GOLD = (216, 178, 90)
GOLD_BRIGHT = (255, 204, 0)
GOLD_SOFT = (196, 168, 110)
WIN = 'C:/Windows/Fonts/'


def broadway(size):
    try: return ImageFont.truetype(WIN + 'BROADW.TTF', size)
    except Exception: return ImageFont.truetype(WIN + 'GOTHICB.TTF', size)

def gothic(size):
    try: return ImageFont.truetype(WIN + 'GOTHIC.TTF', size)
    except Exception: return ImageFont.truetype(WIN + 'arial.ttf', size)

def terminal(size):
    src = os.path.join(ROOT, 'assets', 'fonts', 'terminal-grotesque-open.woff2')
    try:
        tmp = os.path.join(tempfile.gettempdir(), 'terminal-grotesque-open.ttf')
        if not os.path.exists(tmp):
            f = TTFont(src); f.flavor = None; f.save(tmp)
        return ImageFont.truetype(tmp, size)
    except Exception:
        return ImageFont.truetype(WIN + 'GOTHICB.TTF', size)


def tw(d, text, font, tr):
    return sum(d.textlength(c, font=font) + tr for c in text) - (tr if text else 0)

def tracked(d, text, font, x, y, fill, tr):
    cx = x
    for c in text:
        d.text((cx, y), c, font=font, fill=fill)
        cx += d.textlength(c, font=font) + tr

def center_tracked(d, text, font, y, fill, tr):
    tracked(d, text, font, (W - tw(d, text, font, tr)) / 2, y, fill, tr)

def diamond(d, cx, cy, r, fill=None, outline=None, wdt=2):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill, outline=outline, width=wdt)


# background: deep navy vertical gradient
canvas = Image.new('RGB', (W, H), (9, 18, 30))
px = canvas.load()
top, bot = (7, 14, 24), (16, 34, 54)
for y in range(H):
    t = y / H
    col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W):
        px[x, y] = col
draw = ImageDraw.Draw(canvas)

# stepped gold Deco frame
draw.rectangle([20, 20, W - 21, H - 21], outline=GOLD, width=3)
draw.rectangle([30, 30, W - 31, H - 31], outline=GOLD, width=1)
for (ox, oy, sx, sy) in [(20, 20, 1, 1), (W - 21, 20, -1, 1), (20, H - 21, 1, -1), (W - 21, H - 21, -1, -1)]:
    for s in range(3):
        o = 20 + s * 7
        draw.line([(ox + sx * (o + 7), oy + sy * o), (ox + sx * o, oy + sy * o), (ox + sx * o, oy + sy * (o + 7))], fill=GOLD_BRIGHT, width=2)

# chrome wordmark
logo = Image.open(os.path.join(ROOT, 'assets', 'logos', 'dfc_logo_text.webp')).convert('RGBA')
lw = 520
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
canvas.paste(logo, ((W - lw) // 2, 150), logo)

# INTERACTIVE RULES (Broadway) with flanking Deco rules
title_y = 150 + lh + 30
tf = broadway(66)
title = 'INTERACTIVE RULES'
tw_ = tw(draw, title, tf, 8)
center_tracked(draw, title, tf, title_y, GOLD_BRIGHT, 8)
ry = title_y + 46
for side in (-1, 1):
    x_in = W // 2 + side * (tw_ // 2 + 40)
    x_out = W // 2 + side * (tw_ // 2 + 150)
    lo, hi = min(x_in, x_out), max(x_in, x_out)
    draw.line([(lo, ry), (hi, ry)], fill=GOLD, width=2)
    diamond(draw, x_in, ry, 6, fill=GOLD_BRIGHT)
    diamond(draw, x_out, ry, 4, outline=GOLD, wdt=2)

# subtitle
sf = gothic(30)
center_tracked(draw, 'The Rules, in clickable wiki-like form.', sf, ry + 34, GOLD_SOFT, 1)

# footer: WarLore wordmark + url
fy = H - 74
tg = terminal(34)
wl = 'WarLore'
wlw = int(tw(draw, wl, tg, 1))
pad = 12
draw.rectangle([46, fy - 6, 46 + wlw + pad * 2, fy + 40], fill=(0, 0, 0))
tracked(draw, wl, tg, 46 + pad, fy, GOLD_BRIGHT, 1)
gf = gothic(22)
url = 'type37.github.io/dropfleet-builder'
uw = tw(draw, url, gf, 1)
tracked(draw, url, gf, W - 58 - uw, fy + 8, GOLD_SOFT, 1)

out = os.path.join(ROOT, 'assets', 'og', 'rules.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
canvas.save(out, 'PNG')
print('wrote', out, canvas.size)
