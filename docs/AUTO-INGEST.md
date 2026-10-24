# Automatic update: Claude's part

The monthly run (2nd weekday of the month) in `.github/workflows/dfc-files-scan.yml` has already done the routine
work with `scripts/auto-update.py`: downloaded the changed TTCombat sheets, compared
them card by card with `scripts/card-snapshots.json`, written new and changed ships,
cut their art, rebuilt the Civilian picker, and written the What's New entry. You are
called only for what it could not do. Keep to that; do not redo its work.

Your work is listed in two places in the repo root:

- `auto-update-report.json` → `claude`: each item names the sheet (`pdf`, `url`),
  the `page`, the `ship`, and `why` the script stopped (a keyword not in our rules,
  a layout it does not read, a document the app uses that changed).
- `pre.txt`, if it is not empty: where our data disagrees with TTCombat's current
  cards (the card audit) or the generated mirror was hand-edited.

## How

1. Download the sheet: `python scripts/cdn_fetch.py "<url>" /tmp/<file>`. Read only
   the page named. `python scripts/card_reader.py /tmp/<file> --page N` shows what
   the script read from it.
2. Fix that one card in every faction file it belongs in (Mercenary ships are in all
   six). Copy stats, weapons, rules and lore from the card word for word. Reuse a
   rule's existing entry when one exists; a new keyword's text comes from the
   rulebook (`data/rules-wiki.json`, chapter 14) when it is there.
3. Insert as text, never by rewriting a whole faction file with `json.dump`: several
   have hand-compacted lines and PHR and Scourge are CRLF. `write_groups` in
   `scripts/auto_ingest.py` does this safely.
4. A new rule that changes what is legal to take (group limits, a new list choice)
   must be enforced in both `js/app.js` and `mobile/js/mobile.js`, not only shown.
5. Add one plain-words line per card you handled to the newest entry of `CHANGELOG`
   in both apps (the script already created the entry for this run).
6. Run `python scripts/gen-fleet-data.py`. The workflow runs every other check.

For `pre.txt` drift: open the card. If our data is wrong, fix it. If the card reader
misread a correct entry, run `python scripts/audit-cards.py --update`.

## Do not

- commit, push, open issues or pull requests. The workflow does that.
- add files to the repo beyond the data, art and app changes the card needs.
- guess. If the card cannot settle something (two sheets contradict each other, a
  card is unreadable, a rule needs builder behaviour you cannot implement with
  confidence), write `NEEDS_JET.md`: what changed, what you did, and the one question.
  That is the only thing that emails Jet, so use it only when it is truly needed.
