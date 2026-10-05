#!/usr/bin/env python3
"""Download a TTCombat PDF and make sure it is the NEWEST copy the CDN has.

Shopify's CDN can serve two different files under one URL when TTCombat
overwrites a PDF in place: some edges keep the old bytes. On 2026-09-28 the
UCM 260828 link answered with the 08-28 build ("Frances Mendoza") about one
time in four and the 09-01 build ("Francis") otherwise. A single download on
09-25 caught the old one and the app was "corrected" backwards.

So: probe the URL several times, collect every distinct file it hands out, and
keep the one whose PDF /CreationDate is latest. Stdlib only, so the page scan
can use it too.

Usage:
  python scripts/cdn_fetch.py URL DEST      # download the newest copy to DEST
"""
import os
import re
import sys
import time
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (DFC-cdn-fetch)"}
CREATED_RE = re.compile(rb"/CreationDate\s*\(D:(\d{14})")

# Minutes to wait before each retry of a 429 or 5xx. The weekly watch fires at
# 07:00, when scheduled jobs from every repo on GitHub's shared runners hit the
# web at once, and TTCombat answered that crowd with a 429 on 2026-10-05.
# Waiting out the rush costs runner time only on a week it is refused.
RETRY_MINUTES = (2, 5, 10, 20)


def get(url, headers=UA, timeout=180):
    req = urllib.request.Request(url, headers=headers)
    for wait in RETRY_MINUTES + (None,):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or wait is None:
                raise
            print("%s answered %d; retrying in %d min" % (url, e.code, wait), file=sys.stderr)
            time.sleep(wait * 60)


_get = get


def created(data):
    """PDF creation stamp as YYYYMMDDHHMMSS, or '' if the file doesn't say.
    Read from the tail first: an incremental save appends the newer Info dict."""
    stamps = CREATED_RE.findall(data[-200000:]) or CREATED_RE.findall(data)
    return max(stamps).decode() if stamps else ""


def fetch_newest(url, dest, tries=4):
    """Download `url` up to `tries` times, write the newest distinct copy to `dest`.
    Returns a list of (bytes, created) for every distinct copy seen, newest first,
    so a caller can report when the CDN is split."""
    seen = {}
    for _ in range(tries):
        data = _get(url)
        seen.setdefault(len(data), data)
    ranked = sorted(seen.values(), key=lambda d: (created(d), len(d)), reverse=True)
    with open(dest, "wb") as f:
        f.write(ranked[0])
    return [(len(d), created(d)) for d in ranked]


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    copies = fetch_newest(sys.argv[1], sys.argv[2])
    print(f"Saved {os.path.basename(sys.argv[2])}: {copies[0][0]} bytes, built {copies[0][1] or 'unknown'}")
    for n, c in copies[1:]:
        print(f"  CDN also served an older copy: {n} bytes, built {c or 'unknown'} (ignored)")
