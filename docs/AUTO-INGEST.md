# Automatic ingest

Instructions for the Claude run in `.github/workflows/dfc-files-scan.yml`. The
weekly watcher found a change and handed it to you. Integrate it so the app is
right, then stop. The workflow runs the checks, commits and deploys if they pass.
Jet is emailed only if you write `NEEDS_JET.md` or the checks fail, so finish the
job whenever the PDF settles the question.

`files.txt` and `cards.txt` in the repo root are this week's scan and card audit.

## Do not

- commit, push, or open issues or PRs. The workflow does that.
- edit `data/fleet-data.json` by hand. It is generated (`scripts/gen-fleet-data.py`).
- rewrite whole faction files with `json.dump`. Several have hand-compacted lines
  and PHR and Scourge are CRLF. Insert new groups as text and keep each file's own
  line endings (see `scripts/add-civilian-261001.py`, `insert_text`).
- guess. Every stat, weapon row, rule and lore paragraph is copied from the PDF.

## Steps

1. Download each new or changed PDF from the URL in `files.txt` with
   `python scripts/cdn_fetch.py URL Rules-Mechanics-PDFs/<file>`. TTCombat's CDN
   serves stale copies under the same URL; `cdn_fetch.py` keeps the newest build.
   Also fetch the previous edition from `scripts/dfc-files-manifest.json`'s `url`.
2. Diff the two editions' text page by page (PyMuPDF `get_text()`). Ignore page
   renumbering. List every real change: new cards, changed stats, costs, weapons,
   rules, renames, removals.
3. Write `scripts/add-<sheet>-<date>.py`, an idempotent ingest script in the style of
   `scripts/add-civilian-261001.py` and `scripts/add-260828-content.py`:
   - new ships go into the right `data/faction-*.json`; Mercenary ships go into
     all six with `additional: true`, next to the other civilian hulls;
   - rules already in a faction file (Rare, Vectored, Descent ...) are reused
     from there, not retyped; ship-specific rules are stored verbatim;
   - Boardable and Civilian Transport are dropped from civilian Special columns;
   - `groupMin`/`groupMax` from the G column, `isRare`/`isUnique` from Special.
   Run it, then `python scripts/gen-fleet-data.py`, and set each faction's
   `shipCount` in `data/fleet-index.json` to its number of groups.
4. Art: cut the ship picture from its page with its soft mask into
   `assets/art/<slug>.webp` (see `cut_art` in `add-civilian-261001.py`), add the
   name to `SHIP_ART_SPECIAL` in both `js/app.js` and `mobile/js/mobile.js`,
   then `python scripts/gen-thumbnails.py`.
5. Repoint every script that names the old edition to the new file
   (`grep -rn <old filename> scripts scenarios`). For the Civilian sheet that
   includes `build-civilian-ships.py` (its `ORDER`, page numbers and image xrefs),
   then run it. Write the new PDF's text to `scripts/_pdftext/<name>.txt`.
6. If a change affects what is legal to take (group sizes, Rare/Unique, a new
   limit, a new list-building choice), wire it into both apps, not just the data.
7. `python scripts/scan-dfc-files.py --update`, `python scripts/gen-offline-manifest.py`,
   bump `CACHE` in `sw.js` by one.
8. Add a dated entry at the top of `CHANGELOG` in both `js/app.js` and
   `mobile/js/mobile.js` (plain words a player understands, no file names), and a
   dated section at the top of `CHANGELOG.md` saying what moved and why.

## When to write NEEDS_JET.md

Only for a decision the PDF cannot settle. Examples: a rule change that needs new
builder behaviour you cannot implement confidently; two PDFs contradicting each
other; a card that cannot be read. Write what changed, what you did, and the one
question. Leave the rest of your work in place.

If the card audit reports a disagreement on an existing ship, open the card and
fix whichever side is wrong. If the parser misread it and the data is right, run
`python scripts/audit-cards.py --update`.
