#!/usr/bin/env python3
"""Convert the renamed transparent station PNGs in DFC-Art-Assets/Space_Stations_Art
into web-sized webp (alpha preserved) under assets/art/stations/.
Run from repo root:  python scripts/gen-station-art.py
Re-run after adding/renaming source art."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "DFC-Art-Assets", "Space_Stations_Art")
OUT = os.path.join(ROOT, "assets", "art", "stations")
THUMB = os.path.join(ROOT, "assets", "art", "thumb", "stations")  # thumbUrl() swaps /art/ -> /art/thumb/
MAX_W = 640    # full: station cards/upgrade art; 640px keeps files light
THUMB_W = 200  # thumb: station picker option rows

os.makedirs(OUT, exist_ok=True)
os.makedirs(THUMB, exist_ok=True)
count = 0
for fn in sorted(os.listdir(SRC)):
    if not fn.lower().endswith(".png"):
        continue
    base = os.path.splitext(fn)[0] + ".webp"
    im = Image.open(os.path.join(SRC, fn)).convert("RGBA")

    full = im if im.width <= MAX_W else im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    full.save(os.path.join(OUT, base), "WEBP", quality=82, method=6)

    thumb = im if im.width <= THUMB_W else im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.LANCZOS)
    thumb.save(os.path.join(THUMB, base), "WEBP", quality=80, method=6)

    count += 1
    print(f"  {fn} -> stations/{base}  ({os.path.getsize(os.path.join(OUT, base))//1024} KB)")
print(f"Done: {count} station images (full + thumb).")
