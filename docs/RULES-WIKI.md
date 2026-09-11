# Rules wiki: data and build plan

Both apps (Dropfleet Builder, Dropzone 3E Army Builder) will present the full
official rulebook in-app as a browsable, linkable wiki. Not a PDF viewer, not a
link out. This document covers the extracted data, its schema, how
cross-references and errata work, and what will bite whoever builds the UI.

Status: extractors and data only. No UI exists yet. Nothing is committed.

---

## 1. What exists

| | Dropfleet | Dropzone |
|---|---|---|
| Extractor | `scripts/extract-rules-wiki.py` | `tools/dzc/extract_rules_wiki.py` |
| Run | `PYTHONUTF8=1 python scripts/extract-rules-wiki.py` | `python tools/dzc/extract_rules_wiki.py` |
| Source | `Rules-Mechanics-PDFs/A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf` | newest `rules/A5_Dropzone_*_Rulebook*.pdf` (3.02) and the two 3.02 errata PDFs, each picked by edition point |
| Output | `data/rules-wiki.json` (197 KB) | `data/dzc/rules-wiki.json` (289 KB) |
| Scope | chapters 1-14 (whole book) | chapters 1-12, Errata and FAQ, Faction Errata |

Both accept `--dry` (write nothing) and `--out`. Both print a report: node
counts by depth, paragraphs, tables, captions, cross-references, U+FFFD count,
and the source typos they reproduce on purpose.

The Dropzone extractor does not touch `data/dzc/rules.json` (the keyword
glossary `scan_rulebook.py` writes and the app already reads).

Counts, errata results and the coverage test are in section 6.

---

## 2. JSON schema

```jsonc
{
  "game": "Dropfleet Commander",
  "book": "A5 Dropfleet Rulebook (Print Friendly)",
  "edition": "2.3.1",
  "source": "A5_Dropfleet_Rulebook_2.3.1_Print_Friendly.pdf",
  "generator": "scripts/extract-rules-wiki.py",
  "verbatim": true,
  "chapters": [ Node, ... ],
  "errata": { ... }            // Dropzone only, see section 4
}
```

### Node

```jsonc
{
  "id": "7.3.6",               // unique, stable: the routing key
  "number": "7.3.6",           // as printed, or null (scenario and deployment cards)
  "heading": "Roll for Crippling Effects",
  "page": 18,                  // printed page the heading is on
  "body": [ Block, ... ],
  "children": [ Node, ... ],
  "xrefs": ["4.2.1"],          // optional: ids of nodes this body cites
  "errata": ["faq-erratum-10-1-3-awacs"]  // optional, Dropzone: entries targeting this node
}
```

Unnumbered nodes get `parent id + "/" + slug`: `12.2/take-and-hold`,
`12.1.1/1-line`, `9/battle-royale`.

### Block

```jsonc
{ "kind": "p",       "runs": [Run, ...] }   // paragraph
{ "kind": "li",      "runs": [Run, ...] }   // bullet item (bullet glyph removed)
{ "kind": "caption", "runs": [Run, ...] }   // heading-face text that is not a heading:
                                            // diagram labels, figure titles, stray column heads
{ "kind": "table",   "header": ["Result", "Crippling Effect"] | null,
                     "rows": [ [ [Run, ...], [Run, ...] ], ... ] }  // row, cell, runs
```

### Run

```jsonc
{ "t": "Energy Surge:", "b": true }   // b present only when bold
{ "t": " Gain a Spike." }
```

### Why this shape

- **`number` is a string.** "14.1.221" and "12" must survive; "7.10" is not "7.1".
- **`id` is separate from `number`.** Unnumbered nodes need ids, and the
  Dropzone book prints **4.3.1 twice** (Victory Points, then Cleanup), so the
  second is `4.3.1-2`. Route on `id`, display `number`.
- **Runs, not HTML or Markdown.** The text is verbatim and must never be
  reinterpreted: a `*` Lock value must not become emphasis, and nothing from
  the PDF should be able to inject markup. Bold is kept because Dropfleet bolds
  defined terms and binding clauses where they are introduced; that bolding is
  part of the rule. (Dropzone 3.02 sets no bold in chapters 1-12; the flag is
  simply never present there.)
- **Tables are rows, not prose.** Flattened, a table scrambles like a two-column
  page. Cells are run arrays so bold survives inside cells.
- **Captions are their own kind** so a diagram's "A", '3”' or "ZONE" can never
  render as a paragraph of rules.
- **`page`** is the printed page, which is what Dropzone's own cross-references
  cite.
- **A tree, mirroring the book.** The UI can flatten it for search and a
  sidebar; rebuilding hierarchy from a flat list is lossy.
- **One schema for both games**, so one renderer serves both apps.

---

## 3. Making cross-references clickable

### What the books actually do

Numeric "see 12.1.5"-style references are **rare**. Measured on the extracted text:

- **Dropfleet**: 3 numeric references in the whole book, written as number plus
  name ("as found in 4.2.1 Admirals"). One prose pointer with no number at all:
  "(see the Scenery section for more info)".
- **Dropzone**: **zero** numeric references. It cites by page and quoted name,
  5 times: "(see page 34 ‘Entry’)", "See page 32 ‘Weapon Features’",
  "(see page 17 ‘The Stack’)", "(see page 36 ‘Objects’)" (twice).
- **Both**: the dominant cross-reference is the **rule or term name**: "the
  Focused special rule", "Crippling Effects", "Coherency", "Sited", "Aegis".

The extractors resolve the first two kinds into `node.xrefs` already. The third
needs a term linker at render time.

### Linker A: section numbers

```
(?<![\d.])(\d+(?:\.\d+)+)(?![\d”″"])
```

Link only when the match is a known `number`. The lookarounds keep measurements
('1.5”') and editions ("3.02") out.

### Linker B: page plus name (Dropzone)

```
[Ss]ee page (\d+) ‘([^’]+)’
```

Resolved by heading name, preferring a node on or before the cited page. All 5
resolve: Entry to 9.4, Weapon Features to 8.8.1, The Stack to 5.2.2, Objects
to 9.7. An unresolvable one is printed by the extractor, never guessed.

### Linker C: rule and term names (the valuable one)

Build a term index from:

1. Special-rule headings: Dropfleet chapter 14, Dropzone chapters 10 and 11.
2. Every other section heading (Coherency, Spikes, Sited, Initiative).
3. Dropfleet bold runs ending in a colon inside tables ("Energy Surge:").

Rules for applying it:

- **Parameterised names.** Headings are templates: "Aegis-X", "Burnthrough-X",
  "Shield: X Y” Z+". Reuse `matcher_for` in `tools/dzc/scan_rulebook.py`, which
  already handles "Ev X" against "Ev1" and "Repair X/Y" against "Repair D6: Medusa".
- Longest match first; whole words; first occurrence per section; never link a
  section to itself; never inside headings or table header cells.
- Match on the **joined paragraph string**, then map the character range back
  onto runs. A link can cross a bold boundary, and one run can hold two links.
- Keep an explicit stoplist for headings that are also ordinary English
  ("Move", "Ready", "Large", "Strike", "Ground", "Scout"). Do not infer terms
  from capitalisation; both books capitalise game terms inconsistently.

### Routing

`#rules/<id>` through `encodeURIComponent` (unnumbered ids contain `/`). Use
`xrefs` to build a reverse index on load, so a section can list what cites it.

---

## 4. Folding in errata

Dropzone ships two errata PDFs. Dropfleet has none on disk; the same schema and
overlay apply if one appears.

### What the extractor records

```jsonc
"errata": {
  "sources": [ { "file", "title", "preamble": [..],
                 "legend": [{"colour": "#00aeef", "status": "new", "text": ".."}],
                 "editions": ["Version 3.01 - published 30th July 2026", ".."] } ],
  "entries": [ {
    "id": "faq-erratum-10-1-3-awacs",
    "kind": "erratum",
    "source": "Dropzone_Commander_3.02_Errata_FAQ.pdf", "page": 2,
    "group": "Errata", "subgroup": null,
    "status": "new",            // blue #00aeef = new to this edition; green #40ad49 = previous
    "colour": "#00aeef",
    "target": "10.1.3 AWACS",   // exactly as printed
    "resolves_to": "10.1.3",    // node id, or null when it targets another document
    "steps": [ {
      "instruction": "Amend rule to",
      "op": "amend",            // amend | change | add | remove | replace | null
      "quote": ["“Enemy Aircraft within X” of one or more Units ... with a +1Ac bonus.”"],
      "book_check": "not-in-book"
    } ]
  } ],
  "faq": [ { "id", "kind": "faq", "group", "topic": "Transports", "status", "colour",
             "question", "answer": [..], "page" } ]
}
```

Status comes from the heading's colour, because that is how the errata PDFs
encode it (their page 1 legend is stored verbatim in `sources[].legend`).
Every string is verbatim, including the errata's own defects: three quotes are
closed with an opening mark (in 10.1.32 Strong, Remote Drone, Subterranean).

### The incorporation check

The FAQ's page 1 states that the digital rules already incorporate these
changes. The extractor tests that per step, comparing letters and digits only
against the target section and everything beneath it:

| `book_check` | meaning |
|---|---|
| `in-book` | the amended, added or replacement text **is** in the rulebook |
| `not-in-book` | it is **not** |
| `still-in-book` | remove: the text to remove is still there |
| `gone-from-book` | remove: already gone |
| `unchecked` | nothing checkable: no quote, a single-word swap, an image, or a target in another document |

For inline swaps ('Change “A” to “B”') both phrases must be three words or more
to count as evidence.

**3.02 result: 17 in-book, 1 not-in-book, 37 unchecked.** The claim holds for
every checkable step except **10.1.3 AWACS**, where the erratum (marked new)
inserts "a" before "+1Ac bonus" and the rulebook does not have it.

### How to present it

**Never mutate the extracted book text.** An erratum is an overlay.

1. **Section marker.** A node with `errata` shows a marker coloured by `status`:
   a control with an accessible name, not a sentence of copy.
2. **Both texts readable.** Opening it shows the erratum verbatim (instruction,
   quote, source file and page) in a positioned panel. The book's text stays on
   screen. Nothing is hidden with `display:none`.
3. **State from `book_check`.** `in-book`: the book already matches; the erratum
   is history. `not-in-book` on a whole-rule amend (AWACS): the erratum text is
   current and the book text is shown as superseded, both visible. Partial
   operations ("Amend first sentence to:", "Change third paragraph to:"): side
   by side, no splicing.
4. **No automatic splicing.** "Third paragraph" depends on where the extractor
   split paragraphs, and a wrong splice would put words in the rulebook's mouth.
   If splicing is wanted later, do it as a hand-verified map
   (`erratum id -> node id, block index, replacement`) with a test that fails
   when the quote no longer matches the source.
5. **Unchecked entries** ("Flak Turret should have Att 6.", "Amend Attrition to
   2 VP.", the two token symbols added to chapter 12 as images) are shown as
   printed, for a human to confirm.
6. **Faction errata** (22 entries) target stat cards, faction rules, the
   Behemoths PDF and fastplay sheets, so `resolves_to` is null. Attach them by
   name to `data/dzc/rules.json` rule ids and faction unit names in a later
   pass, with the same overlay component. Do not match by number: the faction
   sheet's "1.2 Exceptions" is Behemoths section 1.2, not rulebook 1.2 Ruler.
7. **FAQ** (43 entries, 7 topics) is its own section grouped by `topic`, with the
   term linker run over questions and answers so each answer links into the rules.

Re-run the extractor whenever the rulebook or either errata PDF changes. The
`book` tally in its report is the drift alarm.

---

## 5. What will bite the UI build

Roughly in order of how badly.

1. **The source is not clean, and the text must stay verbatim.** Never correct
   these in data, CSS or search indexing:
   - Dropfleet: scenario "Entrapmoont"; rule numbered "14.1.221 Reinforced
     Armour" (between 14.1.20 and 14.1.22); heading "14.1.22 Vanguard-X”" with a
     stray inch mark; "Batallion" in the Launch Assets table; "Levelled/ Ruined"
     with a space mid-line in 12.1.5.1; table heads "D6 Re-sult" and "Red Team
     Deploy-ment" (hyphenated inside narrow cells).
   - Dropzone: "4.3.1" printed twice (ids `4.3.1`, `4.3.1-2`); "AA-R
     (Anti-Aircraft- Reactive)" is one span as printed; errata quotes closed with
     opening marks.
   - So: route on `id`, never `number`. Never derive depth from the dot count
     (Dropzone's 10.1.1 sits directly under chapter 10; the book prints no
     "10.1"). Make search tolerant of these spellings.
2. **Figures are not extracted.** Diagrams (coherency examples, deployment and
   layout maps, transport symbols, zone diagrams, the Dropzone token plate) are
   images; only their labels come through, as `caption` blocks. Captions without
   the picture are noise. Either crop figures (the approach in
   `tools/dzc/extract_tokens.py` and `scripts/extract-tokens.py` already works
   on these PDFs) or group captions into a figure placeholder. Image-only table
   columns (Dropfleet 11 Dropsites "Icon") arrive as empty cells.
3. **Errata cannot be spliced safely.** See section 4. Overlay; both texts visible.
4. **Whitespace and dashes inside runs are significant.** Never trim a run: a
   run can begin or end with the only space between two words. Render runs
   inline in one text flow. Em and en dashes inside rules text are verbatim;
   the project's no-em-dash rule covers app copy, not quoted rules.
5. **Tables.** `header` can be null (Dropzone 2.5, 2.6, 2.7, 6.3); cells can be
   empty; cells are run arrays. Wide tables scroll in their own
   `overflow-x: auto` container. Never truncate a cell.
6. **Ordered lists are not modelled.** Dropzone sometimes emits a list number
   and its item as two paragraphs ("1." then "Determine potential targets" in
   6.2). Render a paragraph that is only `^\d+\.$` as the marker of the next,
   or add an `ol` kind to the extractor.
7. **Reading-order rules are layout-specific.** The extractors carry a few
   targeted rules, each documented where it lives: full-width bands for tables
   and banners, a titles-only column read across (scenario cards), wrapped
   titles joined across blocks, a stray member of a printed numbered set
   regrouped, a full-width table given to the section whose heading matches its
   column heads. A PDF re-layout can break any of them quietly. Keep the
   coverage test in section 6 as a guard.
8. **Cross-references are mostly names.** A number-only linker links almost
   nothing. Linker C is the real work and needs its stoplist.
9. **Unnumbered structure.** Scenario and deployment cards have `number: null`.
   Sidebars and breadcrumbs must cope; ids contain `/`.
10. **Both apps, both form factors.** Desktop and the `/mobile/` sub-app. Term
    previews and erratum panels must be positioned popovers with no layout
    shift, and registered in `topDismissible()` or Back will skip them.
11. **Offline.** Add the JSON to the offline manifest (`gen-offline-manifest.py`)
    and bump the service-worker cache version, or installed users never get it.
12. **Copy rules.** No instructional microcopy around the wiki. Never the word
    "datasheet". Update both in-app changelogs and the README changelog when it
    ships.

---

## 6. Latest run (2026-09-10)

### Dropfleet 2.3.1

- 193 nodes: 14 chapters, 42 at depth 2, 112 at depth 3, 25 at depth 4
- 489 paragraphs, 13 list items, 25 captions, 8 tables
- 18 unnumbered nodes (6 deployment types, 6 layouts, 6 scenarios)
- 3 numeric cross-references, all resolved
- U+FFFD in source: 0 (the repair stays for future re-exports)

### Dropzone 3.02, chapters 1-12

- 233 nodes: 12 chapters, 126 at depth 2, 82 at depth 3, 13 at depth 4
  (tree position, not dot count; chapters 10 and 11 hold their rules directly)
- 731 paragraphs, 70 captions, 7 tables
- 12 unnumbered scenario cards, under chapter 9
- 5 page-and-name cross-references, all resolved; 0 numeric
- 21 rulebook errata (all resolved to a node), 22 faction errata, 43 FAQ in 7 topics
- `book_check`: 17 in-book, 1 not-in-book (10.1.3 AWACS), 37 unchecked
- U+FFFD in source: 0

### Coverage test

Every text block of the source (Dropfleet pages 5-45, Dropzone pages 4-51) was
cut into consecutive 8-word runs, reduced to lowercase letters and digits, and
each run searched for in the JSON. Unmatched runs: Dropfleet 30, Dropzone 25.
Each was inspected. All are one of: the second, double-drawn copy of a centred
heading; a section number that now lives in `number` instead of the text; or a
diagram label stored as its own caption. No rules prose is missing.

This should become a committed test. Dropzone's PDFs are tracked in `rules/`,
so its test can run in CI. Dropfleet's `Rules-Mechanics-PDFs/` is gitignored,
so its test runs locally only.

### Spot-checks (PDF lines against JSON)

| Section | What was compared | Result |
|---|---|---|
| Dropfleet 3.3 Spikes (p11) | bold run ends before the semicolon, no space | identical |
| Dropfleet 7.3.6 (p18) | "11+ Orbital Decay" row, whose text block starts above its result number | identical, in the table, under 7.3.6 |
| Dropfleet 14.2.7 Burnthrough-X (p43) | six lines of right-column text | identical |
| Dropzone 10.1.3 AWACS X” (p44) | book text against the erratum quote | book identical; erratum differs by one word |
| Dropzone 8.3.2 Exiting a Zone (p29) | first paragraph against the erratum quote | identical; `in-book` |
| Dropzone 6.2 Attacking (p19) | section lost in early runs to a 2pt-offset duplicate number | present and identical |
| Dropzone 4.3.1 Cleanup (p14) | duplicate number as printed | kept, id `4.3.1-2` |
