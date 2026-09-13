#!/usr/bin/env python3
"""Regenerate the faint hover-preview thumbnails on the landing cards.

Each landing tool-card fades in a screenshot of its destination on hover
(see index.html .tool-card-shot and css/app.css). This captures those six
screens headlessly and writes them to assets/screens/<slug>.webp.

Re-run whenever a captured screen's look changes materially.

Requires:  pip install playwright  &&  python -m playwright install chromium
Usage:     start a static server at the repo root, then run this:
             python -m http.server 8099
             python scripts/gen-landing-previews.py
"""
import io
import pathlib
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = "http://localhost:8099"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "screens"

# slug -> URL. SPA views route by hash off the main app; the rest are their
# own pages. The slug is what index.html references in .tool-card-shot.
SHOTS = {
    "fleet-builder": f"{BASE}/index.html#fleets",
    "interactive-rules": f"{BASE}/index.html#rules",
    "combat-calc":   f"{BASE}/index.html#calc",
    "mission-maker": f"{BASE}/scenarios/dropfleet/generator/",
    "scenarios":     f"{BASE}/scenarios/dropfleet/",
    "faction-ref":   f"{BASE}/ref/index.html",
}


def save_thumb(png_bytes, slug):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    # Crop a 3:2 window from the top so the card frames the screen cleanly.
    w, h = im.size
    crop_h = int(w / (3 / 2))
    if crop_h < h:
        im = im.crop((0, 0, w, crop_h))
    im.thumbnail((900, 900), Image.LANCZOS)
    im.save(OUT / f"{slug}.webp", "WEBP", quality=78, method=6)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 853}, device_scale_factor=1)
        for slug, url in SHOTS.items():
            pg.goto(url, wait_until="networkidle")
            if "#" in url:  # nudge the SPA router and wait for the landing to hide
                pg.evaluate("window.dispatchEvent(new HashChangeEvent('hashchange'))")
                try:
                    pg.wait_for_selector("#view-landing.hidden", timeout=4000)
                except Exception:
                    pass
            pg.wait_for_timeout(1000)
            save_thumb(pg.screenshot(), slug)
            print("saved", slug)
        b.close()


if __name__ == "__main__":
    main()
