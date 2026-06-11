# Tuesday's Tasks — Dropfleet Builder handoff notes

Outstanding work + everything you'd need to pick it up cold. Reconciled 2026-06-11 against
`DECISIONS-PENDING.md`, `PROPOSAL-modular-picker.md`, and the memory backlog.
Repo: `Type37/dropfleet-builder` → auto-deploys to GitHub Pages from `master`.

---

## How this codebase works (read first)

Two apps that share data:

- **Desktop** — `index.html`, `js/app.js` (one big IIFE: `const App = (() => { … return {…} })()`), `css/app.css`.
- **Mobile** — `mobile/index.html`, `mobile/js/mobile.js` (`window.App = {…}`), `mobile/css/mobile.css`.
- **Shared** — `data/fleet-index.json` (game-size rules, shared rules glossary), per-faction data in `data/faction-*.json`, `js/rank-insignia.js`, `sw.js`. Fleets live in `localStorage` under `dfc_fleets` (same schema both apps). Groups are under `fleet.battleGroups` (NOT `fleet.groups`); each group is "×N of one ship" in `group.ships[]`.

### Standing rules
- **Every change applies to BOTH apps** unless told otherwise.
- **No AI-slop copy.** Only real data or my own words. No invented flavour/lore/coaching text.
- **No duplicated info / error states.**
- **Bump the SW cache** (`const CACHE = 'dfc-cache-vNN'` in `sw.js`) on every commit that changes a cached asset. **Currently v56.**
- **Commit each task separately**, descriptive message + co-author footer. **Push to `origin/master`** after each.

### Verifying changes
- Review server: `preview_start "review"` → port **3457**. Hit mobile at `/mobile/` **with the trailing slash**.
- **Headless screenshots time out** — verify via DOM geometry / `getComputedStyle`. Reload with `?cb='+Date.now()`. `localStorage.dfc_force_desktop='1'` skips the mobile redirect.

---

## ⚠️ Needs YOUR decision/input (blocked on you)

- **Unwired art hookup.** 101 orphan `.webp` exist but nothing displays them (81 ship-ish, 4 station-ish, 16 alt/variant). Review `unwired-art.html`, tell me where each hooks up (or confirm unused).
- **Station art mapping.** Done conservatively — many stations (PHR generic, several faction-specific, Grand Station, Astrobotanical Outpost, Orbital Picket…) show **no image** rather than a wrong one. Point me at art files and I'll extend `STATION_GENERIC_ART` / `STATION_NAME_ART` (both apps).
- **Stat-cell redesign (#1).** `stat-cell-mock.html` is built and **awaiting your review** before I wire it in.

## 🔨 Open — build

- **#1 Stat cells (both).** "4/3"-style: icon left (landmark), big number (primary), abbreviation below/right. SCAN/SIG/THRUST/HULL + ES/KS/BS. Mock ready (above). Desktop `STAT_ICONS` (~`js/app.js` 2116) + `altStatBlock` setting; mobile `statIcon()` + `.stat-cell` in `renderGroupDetail` (~`mobile/js/mobile.js` 1220).
- **#10 "Add Group" button not reliably visible.** Flagged repeatedly — find the real root cause (overflow / sticky-footer clipping / z-index), don't just nudge. Watch the ≤768px desktop sidebar bottom-peek and mobile bottom-action overlap.
- **#6 Points display parity.** Mobile points format + placement to match desktop. Investigate current state first.
- **#2 Mobile long-press → info window.** Hold a button on the Add screen → info popup. Reuse the existing `openRule()` bottom rule-sheet / `openStat()`.
- **#11 Deploy range as its own column.** Deploy currently shows inline in Special for landers/dropships/pods (`DEPLOY_RANGE` map, ~`mobile/js/mobile.js` 1431). A dedicated column needs the universal-6"/override values for offensive assets — not in the data, needs a rules-PDF pass.

## 🔎 Open — research first

- **#12 Mandatory systems for Resistance ships.** Confirm which ships have required system slots (data: `data/faction-resistance.json` `systemSelection`/`loadoutOptions`; + rules). Then auto-select or flag-as-required so a ship can't sit silently incomplete.
- **Placeholder rule text.** Filler like *"Descent / This special rule confers various benefits covered in the core rules"* still needs real verbatim text from the rulebook. You called this "not acceptable."
- **"Alt-1" weapon labels.** You flagged confusion ("what is up with all this alt-1 stuff?"). Status unconfirmed — verify whether the Alt / Alt-1 fire-mode labelling was cleaned up; fix if not.

---

## ✅ Done (do NOT redo)

This 2026-06-09→11 stretch:
- Unified lore rendering · ship-art→TTCombat store links · fixed-size groups hide stepper · mobile Remove Group button · mobile arc icons · mobile print launch-asset table · dropped redundant "Weapons" heading · iOS auto-zoom fix · springier stepper feedback. (SW v49→v56.)

Earlier this session (recorded in `DECISIONS-PENDING.md`):
- **#13 + 13a Resistance modular picker** — DONE both apps: hardpoint options show the full inline weapon-datasheet (arc icon, Lk/At/Dm, tappable special chips), always expanded.
- **#7 Stations customizable** — DONE both apps: generic Small/Med/Large get armament+upgrade picker; faction-specific show datasheets. Shaltari Shuriken cost set to 150 (PDF).
- **#14 per-ship cost × ship count** — investigated, NOT a bug (3 ships × 6pt system = +18, correct).
- **#9 Swipe gestures** — DROPPED per your call ("forget swiping").
- Admiral-ability popup, user-facing em-dashes — already clean.

## Known data gaps / context
- Backlog mirror: memory `project_backlog.md` + `MEMORY.md` index.
- GitHub Pages occasionally emails `401` on auto-deploy — GitHub flakiness, deploys still land.
