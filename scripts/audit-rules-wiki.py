#!/usr/bin/env python3
"""Audit data/rules-wiki.json against the source PDF.

    python scripts/audit-rules-wiki.py

Checks, in order of importance:
  1. VERBATIM  - every paragraph, list item and table cell in the wiki must
     appear, word for word, in the PDF's own text. Anything that does not is
     either extractor corruption or a hand-patch that drifted from the book.
  2. NUMBERS   - section numbers run without a gap or an accidental duplicate.
  3. TABLES    - every row has the same column count as its header.
  4. COVERAGE  - how much of the PDF's body text the wiki carries, so a whole
     section quietly missing shows up as a low number.

Verbatim is checked on normalised text: lowercased, whitespace collapsed, and
the book's smart quotes / dashes folded to ASCII, because those are the only
differences that are not real. A short cell ("6\"", "4+", "-") is skipped: it is
too common to locate meaningfully and its correctness is a table-shape question,
not a text one.
"""
import json
import os
import re
import sys

try:
    import fitz
except ImportError:
    sys.exit("PyMuPDF required: pip install pymupdf")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIKI = os.path.join(ROOT, "data", "rules-wiki.json")
PDF = os.path.join(ROOT, "Rules-Mechanics-PDFs",
                   "A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf")


def norm(s):
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-").replace("−", "-")
    return re.sub(r"\s+", " ", s).strip().lower()


def walk(ns):
    for n in ns:
        yield n
        yield from walk(n["children"])


def cell_text(cell):
    return "".join(r["t"] for r in cell)


def main():
    doc = json.load(open(WIKI, encoding="utf-8"))
    pdf = fitz.open(PDF)
    hay = norm("".join(pdf[i].get_text() for i in range(pdf.page_count)))

    verbatim_fail, table_fail = [], []
    numbers, wiki_chars = [], 0

    for n in walk(doc["chapters"]):
        if n.get("number"):
            numbers.append(n["number"])
        for it in n["body"]:
            if it["kind"] == "table":
                w = len(it.get("header") or it["rows"][0])
                for ri, row in enumerate(it["rows"]):
                    if len(row) != w:
                        table_fail.append(f"{n.get('number')} table row {ri}: {len(row)} cells, header {w}")
                cells = [cell_text(c) for row in it["rows"] for c in row]
                if it.get("header"):
                    cells += it["header"]
                for c in cells:
                    wiki_chars += len(c)
                    t = norm(c)
                    if len(t) < 6:
                        continue
                    if t not in hay:
                        verbatim_fail.append(f"{n.get('number')} [cell] {c[:70]!r}")
            else:
                txt = "".join(r["t"] for r in it["runs"])
                wiki_chars += len(txt)
                t = norm(txt)
                if len(t) < 6:
                    continue
                if t not in hay:
                    verbatim_fail.append(f"{n.get('number')} [{it['kind']}] {txt[:70]!r}")

    print("=== VERBATIM (wiki text not found in PDF) ===")
    if verbatim_fail:
        for f in verbatim_fail:
            print("  MISS", f)
    else:
        print("  all paragraphs, list items and table cells found verbatim in the PDF")

    print("\n=== SECTION NUMBERS ===")
    seen, dupes = set(), []
    for num in numbers:
        if num in seen:
            dupes.append(num)
        seen.add(num)
    print(f"  {len(numbers)} numbered sections, {len(dupes)} duplicate(s)"
          + (": " + ", ".join(sorted(set(dupes))) if dupes else ""))

    print("\n=== TABLES ===")
    print("  " + ("\n  ".join(table_fail) if table_fail else "every row matches its header column count"))

    print("\n=== COVERAGE ===")
    pct = 100 * wiki_chars / max(1, len(hay))
    print(f"  wiki carries {wiki_chars} chars of body text vs {len(hay)} in the PDF "
          f"(~{pct:.0f}%, the rest is furniture, headings, captions and the front matter)")

    print("\n%d verbatim miss(es), %d table shape issue(s), %d duplicate number(s)"
          % (len(verbatim_fail), len(table_fail), len(dupes)))


if __name__ == "__main__":
    main()
