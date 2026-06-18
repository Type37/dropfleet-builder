#!/usr/bin/env python3
"""Build the 1200x630 social/link-preview image as an INTENSELY Art Deco banner:
gold-on-navy, sunburst, stepped gold frame, flanking Deco rules, the DROPFLEET
COMMANDER chrome wordmark, FLEET BUILDER set in Broadway (the Deco display face),
the six faction emblems in a gold band, and the WarLore wordmark (the ONLY use of
Terminal Grotesque) + url in the footer. Self-contained (no app screenshot).
Run: python scripts/gen-og-image.py  ->  assets/logos/og-preview.png
"""
import os, math, tempfile
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
GOLD = (216, 178, 90)       # warm Deco gold (line/ink)
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


# ---- background: deep navy vertical gradient ----
canvas = Image.new('RGB', (W, H), (9, 18, 30))
px = canvas.load()
top, bot = (7, 14, 24), (16, 34, 54)
for y in range(H):
    t = y / H
    col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W):
        px[x, y] = col

# ---- sunburst behind the title (faint gold rays from upper centre) ----
rays = Image.new('RGBA', (W, H), (0, 0, 0, 0))
rd = ImageDraw.Draw(rays)
cx, cy, N, R = W // 2, 150, 48, 1000
for i in range(N):
    a = (2 * math.pi * i) / N
    r = R if i % 2 == 0 else int(R * 0.62)
    rd.line([(cx, cy), (cx + r * math.cos(a), cy + r * math.sin(a))], fill=(216, 178, 90, 20), width=3)
canvas = Image.alpha_composite(canvas.convert('RGBA'), rays).convert('RGB')
draw = ImageDraw.Draw(canvas)

# ---- stepped gold Deco frame ----
draw.rectangle([20, 20, W - 21, H - 21], outline=GOLD, width=3)
draw.rectangle([30, 30, W - 31, H - 31], outline=GOLD, width=1)
for (ox, oy, sx, sy) in [(20, 20, 1, 1), (W - 21, 20, -1, 1), (20, H - 21, 1, -1), (W - 21, H - 21, -1, -1)]:
    for s in range(3):
        o = 20 + s * 7
        draw.line([(ox + sx * (o + 7), oy + sy * o), (ox + sx * o, oy + sy * o), (ox + sx * o, oy + sy * (o + 7))], fill=GOLD_BRIGHT, width=2)

# ---- chrome wordmark ----
logo = Image.open(os.path.join(ROOT, 'assets', 'logos', 'dfc_logo_text.webp')).convert('RGBA')
lw = 500
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
canvas.paste(logo, ((W - lw) // 2, 62), logo)

# ---- FLEET BUILDER (Broadway) with flanking Deco rules ----
fb_y = 62 + lh + 6
fb_font = broadway(50)
fb_text = 'FLEET BUILDER'
fbw = tw(draw, fb_text, fb_font, 6)
center_tracked(draw, fb_text, fb_font, fb_y, GOLD_BRIGHT, 6)
ry = fb_y + 34
for side in (-1, 1):
    x_in = W // 2 + side * (fbw // 2 + 34)
    x_out = W // 2 + side * (fbw // 2 + 150)
    lo, hi = min(x_in, x_out), max(x_in, x_out)
    draw.line([(lo, ry), (hi, ry)], fill=GOLD, width=2)
    diamond(draw, x_in, ry, 6, fill=GOLD_BRIGHT)
    diamond(draw, x_out, ry, 4, outline=GOLD, wdt=2)

# ---- faction band (gold rules + emblems) ----
band_top, band_bot = 380, 512
for by in (band_top, band_bot):
    draw.line([(150, by), (W // 2 - 16, by)], fill=GOLD, width=2)
    draw.line([(W // 2 + 16, by), (W - 150, by)], fill=GOLD, width=2)
    diamond(draw, W // 2, by, 7, fill=GOLD_BRIGHT)
facs = ['ucm', 'phr', 'scourge', 'shaltari', 'resistance', 'bioficer']
sz, gap = 104, 56
row_w = len(facs) * sz + (len(facs) - 1) * gap
x = (W - row_w) // 2
mid = (band_top + band_bot) // 2
for i, key in enumerate(facs):
    im = Image.open(os.path.join(ROOT, 'assets', 'factions', key + '.webp')).convert('RGBA')
    im = im.resize((sz, int(im.height * sz / im.width)), Image.LANCZOS)
    canvas.paste(im, (x, mid - im.height // 2), im)
    if i:
        diamond(draw, x - gap // 2, mid, 4, outline=GOLD_SOFT, wdt=1)
    x += sz + gap

# ---- footer: WarLore wordmark (Terminal Grotesque only) + url (Century Gothic) ----
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

out = os.path.join(ROOT, 'assets', 'logos', 'og-preview.png')
canvas.save(out, 'PNG')
print('wrote', out, canvas.size)
