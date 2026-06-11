# Decisions pending Jet's review

Things I guessed or that need your call while you were at lunch. Each says what I
did so you can confirm or redirect. Nothing here is blocking — I made a sensible
choice and kept moving.

## Resolved this round
- **Social URLs** — confirmed good (`linktr.ee/warlore`, `youtube.com/@WarLore`).
- **Admiral icon** — done: eos-icons "organization" org-chart glyph on the admiral-required row (inlined; no build step).
- **#13 modular picker** — DONE both apps: hardpoint options now show the full inline weapon-datasheet, always expanded, tappable specials.
- **Swipe-right** — dropped per your call ("forget swiping").
- **Unwired art** — generated [unwired-art.html](unwired-art.html) (101 orphan webp of 412): art that exists but nothing displays. Serve it and tell me where each hooks up. Buckets: ship-ish (81), station-ish (4), alt/variant (16).

## Needs your confirm (I guessed)
- **Station art name mapping** — DONE conservatively. The three generic stations (Small/Medium/Large) share one model, so they reuse a single faction image: UCM→`ucm_space_station_1`, Scourge→`scourge_space_station_1`, Resistance→`resistance_space_station`. Faction-specific: Shaltari Gatestation→`voidgate`. Everything else (PHR generic, Shaltari/PHR/Bioficer faction-specific stations, Grand Station, Astrobotanical Outpost, Orbital Picket, etc.) shows NO image rather than a wrong one — we don't have confident art for them. If you have art for those, point me at the files and I'll extend the map (`STATION_GENERIC_ART` / `STATION_NAME_ART` in both apps).

## Stations customizable — DONE (both apps)

Built per your answers: dedicated station detail screen, faction-specific fixed + datasheet, soft amber validation, upgrades mixed into the armaments list. Generic Small/Med/Large get the armament picker (Weapon Systems + Structures fill the 1/2/3 count, capped; Astrobotanical Lab/Defence Grid as Upgrades, cap 1/1/2). Each weapon option shows the full datasheet. Faction-specific stations show their fixed weapons/loads/rules. Cost recalculates; armaments persist through share/text/print. Verified live on both.

One thing to check: **Shaltari Shuriken cost** conflict above (our data 120 vs PDF 150).

## Resolved

- **Shaltari Shuriken cost** — RESOLVED: set to **150 pts** (PDF wins for station points, per Jet). Was 120 (BSData).

## Investigated / resolved (no action)

- **#14 per-ship cost × ship count** — NOT a bug in current code. Resistance per-ship upgrades are *systems* (5–35 pts each). `addSystem` applies the system to every same-type ship in the group and recomputes each ship's `points` (desktop `sameTypeShips`; mobile `group.ships.forEach`), and the fleet total sums per-ship. A group of 3 each taking a 6pt turret correctly totals +18, not +6. Likely fixed alongside the #8 group-copy fix. Can do a live demo if you want to see it.
- **#16 admiral-ability popup** — already implemented in both apps; the picker pops immediately after you add an admiral with table picks. Verified live on mobile.
- **User-facing em-dashes** — already clean. The em-dashes still in the codebase are all in *code comments* or *verbatim rules data* (which must stay verbatim), not in rendered copy. The one user-facing grey area is `data/ship-lore.json` (your hand-written lore) — I left it alone rather than edit your prose. Say the word if you want lore em-dashes stripped too.

## FYI (no action)

- **GitHub Pages deploy emails** — intermittent `401 Requires authentication` on the auto Pages deploy. GitHub-side flakiness, not our code; latest deploys succeed and the live site is current.
