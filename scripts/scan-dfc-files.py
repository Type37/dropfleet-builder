#!/usr/bin/env python3
"""Monthly scan of TTCombat's Dropfleet Commander downloads page.

Fetches https://ttcombat.com/pages/dropfleet-commander-downloads, extracts every
linked PDF/XLSX on the TTCombat Shopify CDN, and diffs it against the committed
baseline (scripts/dfc-files-manifest.json) to surface:

  NEW      a file family that wasn't there before (e.g. a brand-new supplement)
  UPDATED  a date-stamped family whose date changed (a new edition, e.g.
           Civilian_Ships_Scenarios_260501 -> _260701)
  REVISED  same date stamp but the ?v= cache-buster changed (file re-uploaded)
  REMOVED  a family that disappeared from the page

Stdlib only (urllib + re + json) so it runs in any environment with no installs.

Usage:
  python scripts/scan-dfc-files.py            # scan + print a report, exit 1 if changes
  python scripts/scan-dfc-files.py --update   # scan, print report, and rewrite the manifest
  python scripts/scan-dfc-files.py --json      # machine-readable diff on stdout
"""
import sys, os, re, json, urllib.request

PAGE = "https://ttcombat.com/pages/dropfleet-commander-downloads"
MANIFEST = os.path.join(os.path.dirname(__file__), "dfc-files-manifest.json")
CDN_RE = re.compile(r'https://cdn\.shopify\.com/s/files/[^\s"\'<>]+?\.(?:pdf|xlsx)(?:\?[^\s"\'<>]*)?', re.I)
DATE_RE = re.compile(r'_(\d{6})(?=\.[A-Za-z]+(?:\?|$))')  # trailing _YYMMDD before extension


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (DFC-file-scan)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def parse(html):
    """Return {family: {filename, date, version, url}} for every CDN file on the page."""
    out = {}
    for url in sorted(set(CDN_RE.findall(html))):
        base = url.split("?", 1)[0]
        filename = base.rsplit("/", 1)[-1]
        query = url.split("?", 1)[1] if "?" in url else ""
        m = DATE_RE.search(url)
        date = m.group(1) if m else None
        # family = filename with the trailing _YYMMDD and extension removed, so a new
        # date stamp on the same document reads as an UPDATE of the same family.
        stem = filename.rsplit(".", 1)[0]
        family = re.sub(r'_\d{6}$', '', stem)
        # strip trailing Shopify uuid suffixes so a re-upload keeps the same family
        family = re.sub(r'_[0-9a-f]{8}-[0-9a-f-]{20,}$', '', family)
        out[family] = {"filename": filename, "date": date, "version": query, "url": url}
    return out


def diff(old, new):
    changes = {"NEW": [], "UPDATED": [], "REVISED": [], "REMOVED": []}
    for fam, cur in new.items():
        prev = old.get(fam)
        if prev is None:
            changes["NEW"].append((fam, cur))
        elif (cur.get("date") or "") != (prev.get("date") or ""):
            changes["UPDATED"].append((fam, prev, cur))
        elif cur.get("version") != prev.get("version"):
            changes["REVISED"].append((fam, prev, cur))
    for fam, prev in old.items():
        if fam not in new:
            changes["REMOVED"].append((fam, prev))
    return changes


def main():
    update = "--update" in sys.argv
    as_json = "--json" in sys.argv

    old = {}
    if os.path.exists(MANIFEST):
        old = json.load(open(MANIFEST, encoding="utf-8")).get("files", {})

    html = fetch(PAGE)
    new = parse(html)
    changes = diff(old, new)
    n = sum(len(v) for v in changes.values())

    if as_json:
        print(json.dumps({"changeCount": n, "changes": changes, "files": new}, indent=2, ensure_ascii=False))
    else:
        print(f"DFC downloads scan: {len(new)} files on page, {len(old)} in baseline.\n")
        if n == 0:
            print("No changes since the last scan.")
        else:
            for fam, cur in changes["NEW"]:
                print(f"  NEW      {cur['filename']}\n           {cur['url']}")
            for fam, prev, cur in changes["UPDATED"]:
                print(f"  UPDATED  {fam}: {prev.get('date')} -> {cur.get('date')}  ({cur['filename']})\n           {cur['url']}")
            for fam, prev, cur in changes["REVISED"]:
                print(f"  REVISED  {cur['filename']} (re-uploaded; date stamp unchanged)\n           {cur['url']}")
            for fam, prev in changes["REMOVED"]:
                print(f"  REMOVED  {prev['filename']}")
            print(f"\n{n} change(s). Review, download updated PDFs into Rules-Mechanics-PDFs/, and integrate.")

    if update:
        json.dump({"source": PAGE, "files": new}, open(MANIFEST, "w", encoding="utf-8", newline=""),
                  indent=1, ensure_ascii=False)
        if not as_json:
            print(f"\nManifest updated: {MANIFEST}")

    # exit 1 when there are changes (and we didn't just rebaseline) so a scheduler can branch on it
    return 1 if (n and not update) else 0


if __name__ == "__main__":
    sys.exit(main())
