#!/usr/bin/env python3
"""Print the Game Summary quick-reference sheet to PDF.

Source:  rules/game-summary/index.html  (three 11in x 8.5in landscape pages)
Output:  assets/rules/game-summary-dfc.pdf

Needs a static server on the repo root at http://localhost:8099
(python -m http.server 8099) and Playwright for Python with Chromium.
Run:  python scripts/build-game-summary.py

Before printing it checks every column on every page and stops if any
column runs past the bottom of its page or any table cell's text is wider
than the cell.
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'http://localhost:8099/rules/game-summary/index.html'
OUT = os.path.join(ROOT, 'assets', 'rules', 'game-summary-dfc.pdf')
BOTTOM_MARGIN_PT = 6  # columns must end at least this far above the page edge

CHECK_JS = """(margin) => {
  const pt = 96 / 72;
  const out = [];
  document.querySelectorAll('.page').forEach((page, i) => {
    const pb = page.getBoundingClientRect();
    page.querySelectorAll('.col').forEach((col, j) => {
      const cb = col.getBoundingClientRect();
      const bottomPt = (cb.bottom - pb.top) / pt;
      const limitPt = pb.height / pt - margin;
      const overX = col.scrollWidth > col.clientWidth + 1;
      const clipped = [...col.querySelectorAll('th, td, .hd')]
        .filter(c => c.scrollWidth > c.clientWidth + 1)
        .map(c => c.textContent.trim().slice(0, 40));
      out.push({page: i + 1, col: j + 1, bottom: Math.round(bottomPt * 10) / 10,
                limit: Math.round(limitPt * 10) / 10, clipped,
                over: bottomPt > limitPt || overX || clipped.length > 0});
    });
  });
  return out;
}"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.emulate_media(media='print')
        page.goto(URL, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        families = page.evaluate(
            "[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)")
        if not any('Barlow Condensed' in f for f in families):
            browser.close()
            sys.exit('Barlow Condensed did not load; check the network and try again.')
        report = page.evaluate(CHECK_JS, BOTTOM_MARGIN_PT)
        for r in report:
            flag = 'OVERFLOW' if r['over'] else 'ok'
            print(f"page {r['page']} col {r['col']}: ends {r['bottom']}pt / limit {r['limit']}pt  {flag}")
            for text in r['clipped']:
                print(f'    text wider than its cell: {text!r}')
        if any(r['over'] for r in report):
            browser.close()
            sys.exit('Content overflows a page; fix rules/game-summary/index.html first.')
        page.pdf(path=OUT, width='11in', height='8.5in', print_background=True,
                 margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                 prefer_css_page_size=True)
        browser.close()
    print('wrote', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
