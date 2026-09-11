#!/usr/bin/env python3
"""Lift the whole Dropfleet rulebook out of the PDF as a browsable tree.

    PYTHONUTF8=1 python scripts/extract-rules-wiki.py
    PYTHONUTF8=1 python scripts/extract-rules-wiki.py --out data/rules-wiki.json --dry

Why this exists
---------------
The app can already tell you a ship has Burnthrough. It cannot tell you what
Burnthrough DOES, what a Spike is, or which step of the Attack sequence you are
in — all of that lives in a 45-page A5 PDF that nobody reads on a phone at a
table. This lifts the book itself into data so the app can present it: a tree of
chapter -> section -> subsection, each carrying its NUMBER, its heading, and its
paragraphs, with the bold runs kept.

Everything here is copied. Nothing is paraphrased, nothing is corrected. Where
the book has a typo it comes through as a typo and this script names it in the
report so a reader knows it was the printer and not us (see TYPO_WATCH).

Reading order is the whole problem
----------------------------------
page.get_text() flattens an A5 two-column spread by scan line, so the left
column's first line, the right column's first line, the left column's second
line... arrive interleaved. Feeding that to a section splitter gives you 7.3.5
"Inflict Damage" carrying half of 7.3.6 "Roll for Crippling Effects".

So nothing is read flat. Blocks come out of get_text("dict"), and a page is cut
into BANDS first:

  * a block whose bbox crosses the gutter is FULL-WIDTH — a table, a banner,
    a chapter title;
  * the runs of page between them are TWO-COLUMN — read left column top to
    bottom, then right column top to bottom.

Page 18 is the case that proves it is needed: two columns of prose across the
top (7.3.5 on the left, 7.3.6 on the right) and the full-width Crippling Effects
table beneath BOTH. Split the page on the midpoint alone and that table lands
inside 7.3.5, one section early, attached to the wrong rule.

Headings are found by their NUMBER, not their size
--------------------------------------------------
The chapter title is Arkhip 20pt and body is RobotoSlab-Light 9pt, but the
section face is not one size: 1.1 Stats Bar is 13pt, 6.1 Ability Point
Generation is 11pt and 14.1 Ship Special Rules is 14pt, because TTCombat shrinks
a heading to fit its box. Depth therefore comes from the DOTS in the number —
"7.3.6" is three deep — and size only decides whether an UNNUMBERED Arkhip line
is a heading (the scenario names in chapter 12: "Take and Hold", "3 - Midboard").

Section headings are also drawn TWICE, one copy exactly over the other, which is
how the book gets its outline effect. Identical text at an identical bbox is one
heading, not two.

Tables are rows, not prose
--------------------------
A stat table read as prose scrambles exactly like a two-column page does. These
come out as structured rows: find_tables() supplies the column boundaries, and
the rows are then re-clustered from the blocks themselves by vertical overlap,
because find_tables TRUNCATES. On page 18 it stops at "10 Navigation Offline"
and drops "11+ Orbital Decay" — a whole Crippling Effect — off the bottom.
Trusting its row count would have shipped a rules table missing its worst
result, silently. See extend_table_region().

"BACK TO TOP" is RobotoSlab-Bold 12pt in the page's left margin. It is a
hyperlink back to the contents, not a rule, and it is dropped.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF required: pip install pymupdf")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    ROOT, "Rules-Mechanics-PDFs", "A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf")
OUT_DEFAULT = os.path.join(ROOT, "data", "rules-wiki.json")

BOOK_EDITION = "2.3.1"

# Typography, measured off this PDF rather than assumed.
HEAD_FACE = "Arkhip"            # every heading in the book, all sizes
BODY_FACE = "RobotoSlab"        # Light body, Bold for defined terms
CHAPTER_MIN = 19.0              # "1. Ship Characteristics" is 20pt
# An unnumbered Arkhip line is only a heading at these sizes. 9pt Arkhip is a
# table column head, 8.6pt is the folio, and 11.3/14.5pt are the letters and
# distances printed ON the diagrams ("A", "B", '3"') — none of them are headings.
UNNUMBERED_HEAD_SIZES = (13.0, 14.0)
SIZE_TOL = 0.3

BACK_TO_TOP = "BACK TO TOP"     # navigation furniture in the left margin

NUMBERED_HEAD = re.compile(r"^(\d+(?:\.\d+)+)\s+(\S.*)$")
CHAPTER_HEAD = re.compile(r"^(\d+)\.\s+(\S.*)$")
FOLIO = re.compile(r"^\d{1,3}$")
BULLET = re.compile(r"^\s*[••]\s*")

# A cross-reference as the book prints it. Chapter 12 leans on these heavily
# ("as described in 12.1.5"), and they are what makes the wiki clickable.
XREF = re.compile(r"\b(\d+\.\d+(?:\.\d+)*)\b")

# A line that ends mid-compound: a word character, a hyphen or slash, then only
# the line's own trailing space. See runs_from_spans.
LINE_END_COMPOUND = re.compile(r"\w[-/]\s+$")
SUSPENDED = re.compile(r"^\s*(?:and|or|to)\b")

# Words too common in table column heads to say which section a table belongs
# to ("D6 Result", "Type", "Special", "Cannot be used in"). Compared with any
# trailing "s" removed, so "Effects" matches "Effect".
TABLE_STOP = {"d", "result", "type", "special", "the", "of", "and", "a", "to",
              "in", "be", "used", "cannot", "e", "k", "i", "for", "or"}

# Typos this run is EXPECTED to reproduce. Listed so the report can say "yes,
# the book really says that" instead of leaving a reader to wonder whether the
# extractor corrupted it — and so a NEW typo shows up as an unlisted surprise.
# Nothing here is repaired. Quoting a source defect is the whole job.
TYPO_WATCH = {
    "Entrapmoont": "scenario name, p37 — 'Entrapment' everywhere else",
    "14.1.221": "rule number, p42 — sits between 14.1.20 and 14.1.22",
    "Batallion": "p20 Bulk Lander table — 'Battalion' everywhere else",
    "Vanguard-X”": "p42 heading carries a stray inch mark after the X",
}


# ─────────────────────────────────────────────────────────────────────────────
# Text repair
# ─────────────────────────────────────────────────────────────────────────────
# A smart quote that lost its glyph mapping arrives as U+FFFD. After a digit it
# is an inch mark; anywhere else it is an apostrophe. This rulebook's 2.3.1
# export maps them correctly and the count comes back 0 — the repair stays
# because the faction stat PDFs in this same folder DO lose them, and a future
# re-export of the rulebook can regress the same way. The report prints the
# count so a regression is visible rather than silently repaired.
FFFD_INCH = re.compile(r"(?<=\d)�")


def repair(s):
    s = FFFD_INCH.sub("”", s)
    s = s.replace("�", "’")
    # PyMuPDF occasionally leaves a hard newline inside a single span.
    return s.replace("\n", " ")


def tidy(s):
    return re.sub(r"\s+", " ", s).strip()


def join_lines(pieces):
    """Glue a paragraph's lines back together.

    The extractor keeps a TRAILING SPACE on every line that is not the last of
    its paragraph, so straight concatenation is usually right. Usually is not
    always, so a space is inserted when the join would weld two words together.
    A line ending in a hyphen is left alone: this book breaks real compounds
    across lines ("Deploy-ment") and inventing a de-hyphenation rule would join
    words the book keeps apart.
    """
    out = ""
    for p in pieces:
        if out and not out.endswith((" ", "-", "–", "—")) and not p.startswith(" "):
            out += " "
        out += p
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Spans and blocks
# ─────────────────────────────────────────────────────────────────────────────
def page_blocks(page):
    """Text blocks with their spans, deduped, furniture dropped.

    Every centred section heading in this book is drawn twice at the same
    coordinates (that is where its outline comes from), and the two copies are
    not always in the same block — so the dedupe is per PAGE, keyed on text and
    position, not per line.
    """
    out, seen = [], set()
    for blk in page.get_text("dict")["blocks"]:
        if blk.get("type") == 1:
            continue
        lines = []
        for ln in blk.get("lines", []):
            spans = []
            for sp in ln["spans"]:
                txt = repair(sp["text"])
                if not txt.strip():
                    continue
                if txt.strip() == BACK_TO_TOP:
                    continue
                key = (txt, round(sp["bbox"][0], 1), round(sp["bbox"][1], 1))
                if key in seen:
                    continue
                seen.add(key)
                spans.append({
                    "text": txt,
                    "font": sp["font"],
                    "size": round(sp["size"], 1),
                    "bold": "Bold" in sp["font"] or bool(sp["flags"] & (1 << 4)),
                    "x0": sp["bbox"][0], "y0": sp["bbox"][1],
                    "x1": sp["bbox"][2], "y1": sp["bbox"][3],
                })
            if spans:
                # Only a LINE BREAK implies a space. Two spans on one line abut
                # exactly as printed: "|Groups may have up to 4 Spikes|; any"
                # is a bold span then a plain one with no space between, and
                # joining every span boundary as if it were a line break put a
                # space before that semicolon that the book does not have.
                for i, s in enumerate(spans):
                    s["ls"] = i == 0
                lines.append({"spans": spans,
                              "y0": min(s["y0"] for s in spans),
                              "y1": max(s["y1"] for s in spans),
                              "x0": min(s["x0"] for s in spans),
                              "x1": max(s["x1"] for s in spans)})
        if not lines:
            continue
        out.append({"lines": lines,
                    "x0": min(l["x0"] for l in lines),
                    "x1": max(l["x1"] for l in lines),
                    "y0": min(l["y0"] for l in lines),
                    "y1": max(l["y1"] for l in lines)})
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Splitting a block into headings and paragraphs
# ─────────────────────────────────────────────────────────────────────────────
# A PyMuPDF "block" is not a paragraph. It routinely swallows a heading and the
# paragraph beneath it into one unit -- "7.3.4 Roll to Save Take any remaining
# hits and..." -- and on a page where two centred section titles share a
# baseline it swallows BOTH of them, so 1.2 Weapons and 1.3 Assets arrive as one
# string. Reading blocks whole is how 7.3.4, 3.2.2 and the whole of 7.1.1-7.1.6
# went missing. So a block is split back into runs of lines by TYPEFACE, and a
# line of heading face is split again at any horizontal gap wide enough to be a
# column gutter.
HEAD_GAP = 12.0     # points of white space that separate two headings on a line


def is_head_line(ln):
    return all(HEAD_FACE in sp["font"] for sp in ln["spans"])


def split_block(b):
    """Yield ("head", spans) / ("para", spans) pieces in reading order."""
    pieces = []
    for ln in b["lines"]:
        if is_head_line(ln):
            group = []
            for sp in sorted(ln["spans"], key=lambda s: s["x0"]):
                if group and sp["x0"] - group[-1]["x1"] > HEAD_GAP:
                    pieces.append(["head", group, ln["y0"], ln["y1"]])
                    group = []
                group.append(sp)
            if group:
                pieces.append(["head", group, ln["y0"], ln["y1"]])
        else:
            pieces.append(["para", list(ln["spans"]), ln["y0"], ln["y1"]])

    # Re-join what belongs together: a heading that wrapped onto a second line,
    # and the successive lines of one paragraph. A wrapped heading is centred,
    # so its second line does not share the first's left edge -- adjacency in y
    # is what proves it is a continuation, plus not starting a number of its own.
    out = []
    for kind, spans, y0, y1 in pieces:
        if out and out[-1][0] == kind:
            pk, pspans, py0, py1 = out[-1]
            gap = y0 - py1
            size = max(s["size"] for s in pspans)
            if kind == "head":
                text = tidy(join_lines(s["text"] for s in spans))
                starts_new = bool(NUMBERED_HEAD.match(text)
                                  or CHAPTER_HEAD.match(text))
                if gap < 0.8 * size and not starts_new and y0 > py0:
                    out[-1] = [kind, pspans + spans, py0, max(py1, y1)]
                    continue
            else:
                if gap < 0.9 * size:
                    out[-1] = [kind, pspans + spans, py0, max(py1, y1)]
                    continue
        out.append([kind, list(spans), y0, y1])
    return out


def page_pieces(page, blocks):
    """Every block cut into its headings and paragraphs, with a bbox each, and
    any title that wrapped across two BLOCKS joined back into one.

    split_block joins a wrapped title inside a block, but the double-drawn
    centred titles do not stay in one block once their duplicate copy is
    removed: "14.2 Weapon Special" / "Rules" (p43) came out as section 14.2
    "Weapon Special" with an unnumbered child section called "Rules". A heading
    piece absorbs the heading piece directly beneath it when both are the same
    size, in the same column, within 1.4 lines, centred on roughly the same
    axis or sharing a left edge, and the lower one opens no number of its own.
    """
    mid = page.rect.width / 2
    out = []
    for b in blocks:
        for kind, spans, y0, y1 in split_block(b):
            out.append({"kind": kind, "spans": spans,
                        "x0": min(s["x0"] for s in spans),
                        "x1": max(s["x1"] for s in spans),
                        "y0": y0, "y1": y1})

    def yc(s):
        return (s["y0"] + s["y1"]) / 2

    heads = sorted((p for p in out if p["kind"] == "head"), key=lambda p: p["y0"])
    gone = set()
    for p in heads:
        if id(p) in gone:
            continue
        while True:
            size = max(s["size"] for s in p["spans"])
            bottom = max(yc(s) for s in p["spans"])
            axis = (p["x0"] + p["x1"]) / 2
            nxt = None
            for q in heads:
                if q is p or id(q) in gone or (q["x0"] >= mid) != (p["x0"] >= mid):
                    continue
                if abs(max(s["size"] for s in q["spans"]) - size) > 0.6:
                    continue
                if not 0 < min(yc(s) for s in q["spans"]) - bottom <= 1.4 * size:
                    continue
                if abs((q["x0"] + q["x1"]) / 2 - axis) > 40 and abs(q["x0"] - p["x0"]) > 3:
                    continue
                text = tidy("".join(s["text"] for s in q["spans"]))
                if NUMBERED_HEAD.match(text) or CHAPTER_HEAD.match(text) or FOLIO.match(text):
                    continue
                nxt = q
                break
            if nxt is None:
                break
            for s in nxt["spans"][:1]:
                s["ls"] = True
            p["spans"] = p["spans"] + nxt["spans"]
            p["x0"], p["x1"] = min(p["x0"], nxt["x0"]), max(p["x1"], nxt["x1"])
            p["y1"] = max(p["y1"], nxt["y1"])
            gone.add(id(nxt))
    return [p for p in out if id(p) not in gone]


def pieces_in_reading_order(page, blocks):
    """Left column, then right column, band by band between full-width content.

    Ordering PIECES rather than blocks, because a block can hold two section
    titles that merely share a baseline -- "9.1 Repair" on the left of page 24
    and "9.2 Victory Points" on the right. Ordered as one block, both titles
    came out before either column's prose, and every word of Repair was filed
    under Victory Points. Cut apart first, each title stays in its own column
    and keeps its own paragraphs.

    See the module docstring for why the bands exist: page 18.
    """
    mid = page.rect.width / 2
    # A table that crosses the gutter is a full-width band from its top row to
    # its bottom row, even where no single row reaches across. On page 18 the
    # header ("Result" | "Crippling Effect") and the first row are short enough
    # to sit either side of the midpoint, so they read as two columns of the
    # page and the table opened inside 7.3.5 -- one section before the
    # "consults the table below" in 7.3.6 that it belongs to.
    wide_tables = [r for r in table_regions(page, blocks)
                   if r["x0"] < mid - 20 and r["x1"] > mid + 20]
    blocks = page_pieces(page, blocks)
    if not blocks:
        return []

    def straddles(b):
        # A block genuinely spanning the gutter. A one-word block that merely
        # touches the midpoint is not one, hence the 40pt of real overhang.
        if any(block_in_region(b, r) for r in wide_tables):
            return True
        return b["x0"] < mid - 20 and b["x1"] > mid + 20

    full = [b for b in blocks if straddles(b)]
    # A block sharing vertical extent with a full-width block belongs to that
    # band too — a table's short first column is not a column of the page.
    bands = [(b["y0"], b["y1"]) for b in full]
    changed = True
    while changed:
        changed = False
        for b in blocks:
            if b in full:
                continue
            for i, (t, bt) in enumerate(bands):
                if b["y0"] < bt and t < b["y1"]:
                    bands[i] = (min(t, b["y0"]), max(bt, b["y1"]))
                    full.append(b)
                    changed = True
                    break

    def in_full(b):
        return any(b["y0"] < bt and t < b["y1"] for t, bt in bands)

    cols = [b for b in blocks if not in_full(b)]
    # Order the page as a sequence of segments by their top edge: a full-width
    # band reads straight down, a columnar stretch reads left then right.
    segs = []
    for t, bt in bands:
        members = [b for b in full if b["y0"] < bt and t < b["y1"]]
        segs.append((t, "full", members))
    cut = sorted(set([0.0] + [t for t, _ in bands] + [bt for _, bt in bands]
                     + [page.rect.height]))
    for i in range(len(cut) - 1):
        lo, hi = cut[i], cut[i + 1]
        members = [b for b in cols if lo <= b["y0"] < hi]
        if members:
            segs.append((lo, "col", members))
    segs.sort(key=lambda s: s[0])

    order = []
    for _, kind, members in segs:
        if kind == "full":
            order += sorted(members, key=lambda b: (round(b["y0"], 1), b["x0"]))
        else:
            left = sorted((b for b in members if b["x0"] < mid),
                          key=lambda b: b["y0"])
            right = sorted((b for b in members if b["x0"] >= mid),
                           key=lambda b: b["y0"])
            # A column of nothing but titles is not a column. The scenario
            # pages set each scenario's name on the left, over its map, and its
            # Players/Scenery/Deployment/Scoring lines on the right. Read as two
            # columns that gives every line of "Take and Hold" to "Erupting
            # Battlefront", the title below it. When one side has titles and no
            # prose at all, the two sides are one card each and are read across.
            titles_only = (left and all(b["kind"] == "head" for b in left)
                           and right and any(b["kind"] == "para" for b in right))
            if titles_only:
                order += sorted(members, key=lambda b: (round(b["y0"] / 6), b["x0"]))
            else:
                order += left + right
    return order


# ─────────────────────────────────────────────────────────────────────────────
# Tables
# ─────────────────────────────────────────────────────────────────────────────
def table_regions(page, blocks):
    """Column boundaries and vertical extent for every real table on the page.

    find_tables() is used for the COLUMNS only. Its row count is not trusted:
    it stopped the page-18 Crippling Effects table one row short and would have
    dropped Orbital Decay entirely. Its single-row "tables" are not tables at
    all — they are the rule drawn around a centred section heading.
    """
    out = []
    try:
        found = page.find_tables().tables
    except Exception:
        return out
    for t in found:
        if len(t.rows) < 2 or t.col_count < 2:
            continue
        widest = max(t.rows, key=lambda r: sum(c is not None for c in r.cells))
        starts = sorted(c[0] for c in widest.cells if c)
        if len(starts) < 2:
            continue
        x0, y0, x1, y1 = t.bbox
        y1 = extend_table_region(blocks, x0, y0, x1, y1)
        reg = {"x0": x0, "x1": x1, "y0": y0, "y1": y1, "cols": starts}
        # find_tables draws its grid off the ruled boxes the layout puts around
        # a centred section title, so a "table" can swallow a heading whole --
        # page 13's Ability table took 4.3 Choose a Scenario with it, and page
        # 20's Launch table took both 7.4 and 7.5. A region containing a real
        # heading is not a table; its contents fall back to prose, where the
        # heading is seen and nothing is lost. A COLUMN head (Arkhip at 9pt or
        # less: Result, Icon, Scan) is not a heading and does not trigger this.
        if any(HEAD_FACE in sp["font"] and sp["size"] >= 10
               for b in blocks if block_in_region(b, reg)
               for ln in b["lines"] for sp in ln["spans"]):
            continue
        out.append(reg)
    return out


def extend_table_region(blocks, x0, y0, x1, y1):
    """Pull back the rows find_tables dropped off the bottom of a table.

    A block is part of the table if it sits just below it, inside its width,
    and is INDENTED past the table's own left edge — body prose in this book
    always starts hard against the column margin, so the indent is what
    separates a stray table row from the paragraph after the table.

    A block that STARTS inside the table but runs past its bottom is a row too.
    Skipping those is how "11+ Orbital Decay" escaped: its text block begins
    beside the "11+" and ends 15pt lower, so once "11+" had pulled the bottom
    down, the text beside it looked like it was already inside and was passed
    over — and landed in 7.3.6 as a loose paragraph.
    """
    grew = True
    while grew:
        grew = False
        for b in blocks:
            if b["y1"] <= y1 + 0.5 or b["y0"] < y0 - 1 or b["y0"] > y1 + 30:
                continue
            if b["x0"] < x0 + 5 or b["x1"] > x1 + 2:
                continue
            y1 = b["y1"]
            grew = True
    return y1


def block_in_region(b, reg):
    return (b["y0"] >= reg["y0"] - 1 and b["y1"] <= reg["y1"] + 1
            and b["x0"] >= reg["x0"] - 2 and b["x1"] <= reg["x1"] + 2)


def build_table(blocks, reg, head_face):
    """Rows by vertical overlap, cells by x against the column boundaries."""
    members = [b for b in blocks if block_in_region(b, reg)]
    if not members:
        return None
    rows, used = [], set()
    for b in sorted(members, key=lambda b: b["y0"]):
        if id(b) in used:
            continue
        group, lo, hi = [b], b["y0"], b["y1"]
        used.add(id(b))
        grew = True
        while grew:
            grew = False
            for o in members:
                if id(o) in used:
                    continue
                if o["y0"] < hi and lo < o["y1"]:
                    group.append(o)
                    used.add(id(o))
                    lo, hi = min(lo, o["y0"]), max(hi, o["y1"])
                    grew = True
        rows.append((lo, group))
    rows.sort(key=lambda r: r[0])

    def col_of(x):
        idx = 0
        for i, cx in enumerate(reg["cols"]):
            if x >= cx - 3:
                idx = i
        return idx

    out_rows = []
    for _, group in rows:
        cells = defaultdict(list)
        for b in sorted(group, key=lambda b: (b["y0"], b["x0"])):
            for ln in b["lines"]:
                for sp in ln["spans"]:
                    cells[col_of(sp["x0"])].append(sp)
        row = []
        for i in range(len(reg["cols"])):
            row.append(runs_from_spans(cells.get(i, [])))
        out_rows.append(row)
    if not out_rows:
        return None
    header = None
    first = [b for _, g in rows[:1] for b in g]
    if first and all(head_face in sp["font"]
                     for b in first for ln in b["lines"] for sp in ln["spans"]):
        header = ["".join(r["t"] for r in cell) for cell in out_rows[0]]
        out_rows = out_rows[1:]
    return {"kind": "table", "header": header, "rows": out_rows}


# ─────────────────────────────────────────────────────────────────────────────
# Paragraphs
# ─────────────────────────────────────────────────────────────────────────────
def runs_from_spans(spans):
    """Collapse spans to runs, keeping only the bold/not-bold distinction.

    The book bolds a defined term where it is introduced — "Energy Surge:",
    "Each Ship is only affected by this roll once" — so the bolding is part of
    what the rule says, not decoration, and it is carried through.
    """
    runs = []
    for sp in spans:
        t = sp["text"]
        # A space is owed only where the book broke a LINE: "must remain in a
        # |single|<newline>cohesive grouping" needs one put back or it reads
        # "singlecohesive". Where two spans merely abut on one line --
        # "|Groups may have up to 4 Spikes|; any" -- the book printed no space
        # and inventing one there changes the text. A line ending in a hyphen
        # or dash gets no space either: "non-|standard" is one word broken
        # across the line, not two.
        sep = ""
        if runs and sp.get("ls"):
            prev = runs[-1]["t"]
            if LINE_END_COMPOUND.search(prev) and not SUSPENDED.match(t):
                # A compound broken at the end of a line keeps the line's
                # trailing space in the span -- "High- |Power",
                # "Defenders- |Protect". The space belongs to the line, not to
                # the book, so it goes and the halves join. Not before "and"/
                # "or"/"to": "Energy- and Kinetic" is a suspended hyphen and
                # its space is real.
                runs[-1]["t"] = prev.rstrip()
            elif not t.startswith(" ") and not prev.endswith((" ", "-", "–", "—", "/")):
                sep = " "
        if runs and runs[-1]["b"] == sp["bold"]:
            runs[-1]["t"] += sep + t
        else:
            if runs:
                runs[-1]["t"] += sep
            runs.append({"t": t, "b": sp["bold"]})
    # Whitespace is collapsed but NOT stripped at a run boundary. The book
    # bolds a phrase mid-sentence -- "Each Ship may attack |with any number| of
    # its Weapon Systems" -- and the space that ends the plain run is the only
    # space between the two words. Stripping each run tidily welded them into
    # "attackwith", in three paragraphs, invisibly.
    out = []
    for r in runs:
        t = re.sub(r"\s+", " ", r["t"])
        if not t.strip():
            if out:
                out[-1]["t"] += " "
            continue
        run = {"t": t}
        if r["b"]:
            run["b"] = True
        out.append(run)
    if out:
        out[0]["t"] = out[0]["t"].lstrip()
        out[-1]["t"] = out[-1]["t"].rstrip()
    return [r for r in out if r["t"]]


def spans_to_para(spans):
    runs = runs_from_spans(spans)
    if not runs:
        return None
    kind = "p"
    if BULLET.match(runs[0]["t"]):
        kind = "li"
        runs[0]["t"] = BULLET.sub("", runs[0]["t"])
        if not runs[0]["t"]:
            runs.pop(0)
    return {"kind": kind, "runs": runs} if runs else None


# ─────────────────────────────────────────────────────────────────────────────
# Heading detection
# ─────────────────────────────────────────────────────────────────────────────
def heading_of(spans):
    """(number|None, title, depth, size) if these spans are a heading, else None."""
    if not spans or not all(HEAD_FACE in sp["font"] for sp in spans):
        return None
    text = tidy(join_lines(sp["text"] for sp in spans))
    if not text or FOLIO.match(text):
        return None
    size = max(sp["size"] for sp in spans)

    m = CHAPTER_HEAD.match(text)
    if m and size >= CHAPTER_MIN:
        return (m.group(1), m.group(2), 1, size)
    m = NUMBERED_HEAD.match(text)
    if m:
        return (m.group(1), m.group(2), m.group(1).count(".") + 1, size)
    if any(abs(size - s) <= SIZE_TOL for s in UNNUMBERED_HEAD_SIZES):
        return (None, text, None, size)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Walk
# ─────────────────────────────────────────────────────────────────────────────
def extract(doc, report):
    root = []
    stack = []           # [(depth, node)]
    started = False
    dropped = Counter()

    for pno in range(doc.page_count):
        page = doc[pno]
        blocks = page_blocks(page)
        regions = table_regions(page, blocks)
        order = pieces_in_reading_order(page, blocks)
        done_regions = set()

        for piece in order:
            reg = next((r for r in regions if block_in_region(piece, r)), None)
            if reg is not None:
                key = (pno, round(reg["y0"], 1), round(reg["x0"], 1))
                if key in done_regions:
                    continue
                done_regions.add(key)
                tbl = build_table(blocks, reg, HEAD_FACE)
                if tbl and stack:
                    # Which section a full-width table belongs to is not a
                    # fact about layout. Page 18's Crippling Effects table sits
                    # under both columns and belongs to the RIGHT one (7.3.6,
                    # "consults the table below"); page 30's Approach Type table
                    # sits under both columns and belongs to the LEFT one
                    # (12.1.2), with three more sections read in between. No
                    # reading order gets both. The table's own column heads do:
                    # it goes to the section opened on this page whose heading
                    # shares the most words with them ("Crippling Effect" ->
                    # "Roll for Crippling Effects"), and to the section being
                    # read when nothing matches.
                    def words(s):
                        return {w.rstrip("s") for w in re.findall(r"[a-z]+", s.lower())} - TABLE_STOP
                    head_words = words(" ".join(tbl["header"] or []))
                    owner, best = stack[-1][1], 0
                    for _, cand in walk(root):
                        if cand["page"] != pno + 1:
                            continue
                        score = len(head_words & words(cand["heading"]))
                        if score > best:
                            owner, best = cand, score
                    owner["body"].append(tbl)
                elif tbl:
                    dropped["table before chapter 1"] += 1
                continue

            spans = piece["spans"]
            head = heading_of(spans) if piece["kind"] == "head" else None

            if head and head[0] and head[2] == 1:
                started = True
            if not started:
                continue

            if head:
                number, title, depth, size = head
                if depth is None:
                    # An unnumbered heading -- a scenario, a deployment type --
                    # hangs off the nearest NUMBERED section, and its unnumbered
                    # neighbours are its siblings. Nesting each one inside the
                    # last put "6 - Encirclement" nine levels deep under
                    # "1 - Line".
                    while stack and stack[-1][1]["number"] is None:
                        stack.pop()
                    depth = (stack[-1][0] + 1) if stack else 2
                node = {"number": number, "heading": title, "page": pno + 1,
                        "body": [], "children": []}
                while stack and stack[-1][0] >= depth:
                    stack.pop()
                if stack:
                    stack[-1][1]["children"].append(node)
                else:
                    root.append(node)
                stack.append((depth, node))
                continue

            if piece["kind"] == "head":
                # Heading face that is not a heading. The folio is furniture
                # and goes. Anything else -- a table column head outside a
                # table, the letters and distances printed on a diagram -- is
                # kept where it sits but marked as a caption, so "18" never
                # reads as a paragraph of 7.3.6 and "A" never reads as prose.
                text = tidy("".join(s["text"] for s in spans))
                if FOLIO.match(text) and piece["y0"] > page.rect.height - 30:
                    continue
                para = spans_to_para(spans)
                if para:
                    para["kind"] = "caption"
            else:
                para = spans_to_para(spans)
            if not para:
                continue
            if stack:
                stack[-1][1]["body"].append(para)
            else:
                dropped["paragraph before chapter 1"] += 1

    report["dropped"] = dict(dropped)
    report["regrouped"] = regroup_series(root)
    sort_series(root)
    assign_ids(root, None, set())
    return root


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def assign_ids(nodes, parent_id, used):
    """Give every node a unique, stable id, placed first in its object.

    The number where the book prints one; otherwise the parent's id plus a slug
    of the heading ("12.1.1/1-line", "12.2/take-and-hold"). Routing must use
    the id, never the number: an unnumbered card has no number, and a book can
    print the same number twice (the Dropzone rulebook does, at 4.3.1)."""
    for n in nodes:
        base = n["number"] or f"{parent_id or 'book'}/{slug(n['heading'])}"
        nid, k = base, 2
        while nid in used:
            nid, k = f"{base}-{k}", k + 1
        used.add(nid)
        items = list(n.items())
        n.clear()
        n["id"] = nid
        n.update(items)
        assign_ids(n["children"], nid, used)


# An unnumbered heading the book prints as one of a numbered set:
# "1 - Line" ... "6 - Encirclement" are the six Deployment Types.
ORDINAL = re.compile(r"^(\d+)\s*[-–—]\s+\S")


def regroup_series(nodes):
    """Put a stray member of a printed set back with the rest of its set.

    The six Deployment Types are laid out two to a page, and "1 - Line" is
    printed in the LEFT column of the page whose RIGHT column opens 12.1.1
    Deployment Type. Read a column at a time -- which is the only way the rest
    of the book parses -- and 1 arrives before the section it belongs to while
    2 to 6 arrive after it, so the set comes out split across two parents with
    its first member orphaned.

    Only a stray whose ordinal is MISSING from the set it is moved into is
    moved, and members are then put in the book's own printed order. Nothing is
    renamed and no text moves between sections.
    """
    moved = 0
    for n in nodes:
        moved += regroup_series(n["children"])
        strays = [c for c in n["children"]
                  if c["number"] is None and ORDINAL.match(c["heading"])]
        if not strays:
            continue
        for host in n["children"]:
            if host["number"] is None:
                continue
            have = {ORDINAL.match(c["heading"]).group(1)
                    for c in host["children"]
                    if c["number"] is None and ORDINAL.match(c["heading"])}
            if not have:
                continue
            take = [s for s in strays
                    if ORDINAL.match(s["heading"]).group(1) not in have]
            if not take:
                continue
            for s in take:
                n["children"].remove(s)
                host["children"].append(s)
                strays.remove(s)
                moved += 1
            break
    return moved


def sort_series(nodes):
    """Put each printed set back in its printed order — a separate pass, after
    every move, so a stray that arrived last does not stay last."""
    for n in nodes:
        kids = n["children"]
        if kids and all(k["number"] is None and ORDINAL.match(k["heading"])
                        for k in kids):
            kids.sort(key=lambda k: int(ORDINAL.match(k["heading"]).group(1)))
        sort_series(kids)


# ─────────────────────────────────────────────────────────────────────────────
# Report and checks
# ─────────────────────────────────────────────────────────────────────────────
def walk(nodes, depth=1):
    for n in nodes:
        yield depth, n
        yield from walk(n["children"], depth + 1)


def plain(node):
    out = []
    for item in node["body"]:
        if item["kind"] == "table":
            if item["header"]:
                out.append(" | ".join(item["header"]))
            for row in item["rows"]:
                out.append(" | ".join("".join(r["t"] for r in c) for c in row))
        else:
            out.append("".join(r["t"] for r in item["runs"]))
    return "\n".join(out)


def collect_xrefs(nodes, index):
    for _, n in walk(nodes):
        refs = set()
        for tgt in XREF.findall(plain(n)):
            if tgt in index and tgt != n.get("number"):
                refs.add(tgt)
        if refs:
            n["xrefs"] = sorted(refs, key=lambda s: [int(p) for p in s.split(".")])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pdf", default=SRC_DEFAULT)
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--dry", action="store_true", help="write nothing")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    raw = "".join(doc[i].get_text() for i in range(doc.page_count))
    report = {"fffd": raw.count("�")}

    tree = extract(doc, report)

    index = {}
    for _, n in walk(tree):
        if n.get("number"):
            index[n["number"]] = n["heading"]
    collect_xrefs(tree, index)

    by_depth = Counter(d for d, _ in walk(tree))
    n_tables = sum(1 for _, n in walk(tree) for i in n["body"] if i["kind"] == "table")
    n_paras = sum(1 for _, n in walk(tree) for i in n["body"] if i["kind"] != "table")
    n_xref = sum(len(n.get("xrefs", [])) for _, n in walk(tree))

    doc_json = {
        "game": "Dropfleet Commander",
        "book": "A5 Dropfleet Rulebook (Print Friendly)",
        "edition": BOOK_EDITION,
        "source": os.path.basename(args.pdf),
        "generator": "scripts/extract-rules-wiki.py",
        "verbatim": True,
        "chapters": tree,
    }

    print(f"read     {os.path.basename(args.pdf)}  ({doc.page_count} pages)")
    print(f"chapters {by_depth[1]}")
    for d in sorted(k for k in by_depth if k > 1):
        print(f"  depth {d}  {by_depth[d]}")
    print(f"total    {sum(by_depth.values())} nodes, "
          f"{n_paras} paragraphs, {n_tables} tables, {n_xref} cross-references")
    print(f"U+FFFD in source: {report['fffd']}")
    if report.get("regrouped"):
        n = report["regrouped"]
        print(f"regrouped {n} stray member(s) of a printed set")
    if report["dropped"]:
        print(f"dropped (front matter): {report['dropped']}")

    body = "\n".join(plain(n) for _, n in walk(tree))
    heads = "\n".join(str(n.get("number")) + " " + n["heading"] for _, n in walk(tree))
    hay = body + "\n" + heads
    for typo, why in TYPO_WATCH.items():
        seen = hay.count(typo)
        mark = "kept" if seen else "GONE — check the source"
        print(f"typo     {typo!r} x{seen} {mark}  ({why})")

    missing = sorted({t for t in XREF.findall(body) if t not in index},
                     key=lambda s: [int(p) for p in s.split(".")])
    if missing:
        print(f"xrefs with no target section: {missing}")

    if args.dry:
        print("dry run — nothing written")
        return
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(doc_json, fh, ensure_ascii=False, indent=1)
    print(f"wrote    {os.path.relpath(args.out, ROOT)} "
          f"({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
