<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

A free fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander). No login, no install. Fleets save in your browser and work offline.

### ▶ [Desktop](https://type37.github.io/dropfleet-builder/) &nbsp;&nbsp;&nbsp; 📱 [Mobile](https://type37.github.io/dropfleet-builder/mobile/)

*Phones open the mobile version. Both share the same saved fleets.*

</div>

## Features

All six factions: UCM, PHR, Scourge, Shaltari, Resistance, Bioficers.

- Full stats, weapons, launch assets and special rules for every ship, with the rulebook text for any keyword one tap away.
- Generic and famous admirals (famous ones bring their flagship).
- Every game size from Skirmish to Reconquest, with group, Colossal and admiral limits enforced.
- Resistance modular ships: Systems/Hardpoint pickers, Feature Carriers and loadout refits, folded into the fielded stats.
- Live validation: points, group caps, Unique/Rare, required systems, Porter and Payload capacity.
- Space stations, secondary objectives, ship art and per-class lore.
- Print sheets, share links and New Recruit export.
- Combat calculator with exact damage odds.

## Mobile

The [mobile build](https://type37.github.io/dropfleet-builder/mobile/) is built for touch and shares storage with the desktop site. Copy-as-text, PDF export and one-tap Fast Play sheets. Add it to your home screen to run offline.

## Data

Stats come from the [BSData project](https://github.com/BSData/dropfleet-commander), converted to JSON and checked against the official Combined Fleet Stats PDFs. Ship art is TTCombat's. None of it is mine; it belongs to TTCombat.

## Running it

Plain HTML, CSS and JavaScript. No framework, no build step. Open `index.html`, or:

```sh
npx serve .
```

Fonts: [Jost](https://fonts.google.com/specimen/Jost), [Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed).

## Changelog

Mirrors the in-app "What's New". TTCombat publishes no official changelog, so dated edition notes are the maintainer's interpretation.

### 2026-07-08 — Namesake pronunciations: 12 more ships, search, admiral bios
- Wrote and added the 12 namesakes that were missing a pronunciation guide: Melusine, Rusalka, Nereid, Fossegrim, Kikimora (desktop + mobile); Scipio, Myrmidon, Vicarius and Aaru (desktop only, shown under a ship's "Also available as" counts-as variant, which mobile doesn't render).
- Ship search (desktop + mobile) now also matches a ship's Namesake text, so searching a mythological/folklore name finds its ship even if that word isn't in the ship's own name.
- For three Shaltari/Resistance famous admirals whose own CHARACTER name is the hard one to say, not their flagship's class (Quetzalcoatl, Mergen the Learned, Nguen), the pronunciation weaves into the first mention of their name in their own Admiral bio (desktop only; mobile has no admiral bio panel).
- Style: pronunciations now read as "A Rusalka (roo-SAL-kuh) is..." rather than leading with the bare linked name, matching common English phrasing.

### 2026-07-08 — How do you say it? Namesake pronunciations
- Ships named after hard-to-pronounce people, places and creatures now carry a pronunciation guide in the Lore panel, woven into the Namesake line at the first mention, e.g. "Namesake: Theseus (THEE-syoos) was the legendary king and founding hero of Athens...". Tap the respelling to hear it spoken aloud.
- Covers the trickiest namesakes across every faction (PHR Greek myth, Scourge folklore, Shaltari minerals, plus place and admiral names like Kyiv, Reykjavik and Yi Sun-sin), leaning toward the source-language pronunciation where two are commonly accepted. Data lives in `data/pronunciations.json` (word → respelling / IPA), rendered only on the Namesake line.
- Dark mode readability: fixed the admiral ("generals") panels, which fell back to a light cream background in dark mode (an undefined `--surface` token) and left their text unreadable; also lifted the changelog title colour so it reads on dark.

### 2026-07-08 — Scourge missing special rules
- The Bannik Pocket Battleship now has its Oculus Booster rule, which had been dropped when the Scourge fleet was updated to the latest edition. Its Special line reads "Command Ship-1, Oculus Booster" again.
- The Kikimora and Fossegrim Pocket Battleships now carry their Feature Carrier rule (choose a Scourge Deployable Feature at the start of the game), which was likewise missing.
- Added `scripts/audit-special-rules.py`, an automated data check so a ship can no longer silently lose one of the rules printed in its Special column when a fleet is re-ingested from a new edition PDF.

### 2026-07-05 — Kalium KNC fixes & launch totals
- Fixed the Kalium KNC-5 Line Cruiser (now 70 pts each, 140 for the minimum group of 2) and the KNC-12 Fleet Carrier (now 115 pts each, 230 for a group of 2). Both had wrongly shown the bare 45 pt Light Cruiser hull, with their loadout never costed in.
- The KNC-12 is a Fleet Carrier, not a Line Cruiser - fixed its name everywhere it appears (it had wrongly copied the KNC-5's class name).
- Both KNC ships now use their correct group size of 2 to 3, and only appear under the "Additional ships" toggle (they are Counts As resin models from the Misc ship stats).
- Launch bays now add up: a ship with two Fighters & Bombers Launch 2 bays reads as Launch 4, rather than "Launch 2 x2". Applies everywhere launch assets are shown, including the printed sheet, where two identical loads previously printed as separate, unmerged lines.
- High Power is no longer listed as a standing special rule just because a weapon can Overcharge. It only matters when a weapon is actually Overcharged, so it now lives inside the Overcharge rule text instead of on every card.
- Corrected the group sizes of three more Additional ships whose printed range disagreed with what the builder allowed: LKS Dredger (1 to 2), T-Type Tugboat (1 to 4) and Argonaut (1 to 2).
- Added a data audit (`scripts/audit-group-range.py`) that flags any ship whose printed group range disagrees with the group size the builder enforces.

### 2026-07-04 — Mobile Resistance Fast Play fix
- Brought the mobile Resistance Fast Play sheet to parity with desktop. It now builds the correct modular Cruiser, Strike Carrier and Heavy Frigate hulls with their systems pre-selected and their proper sheet names (VH2A Gun Cruiser, TFCS Hybrid Carrier, L2BR Fast Transport, TL Strike Carrier, CT Attack Frigate), instead of unequipped generic cruisers.

### 2026-07-02 — Bastion ship-stats fix
- Fixed the buildable Bioficer Bastion Battleship: it is 225 pts with BS 5+ (it had wrongly carried the Agency flagship Bastion's 245 pts and BS 4+). Its main gun reads Gravitic Hyperlance (Arrest-2) again, and the Torpedo is an optional +20 upgrade. The Agency flagship Bastion is unchanged and remains correct.

### 2026-07-02 — Print, reordering & rules fixes
- Battlegroup reordering: each group card now shows a drag handle (whenever its weight class holds two or more groups), so you can drag to reorder groups within a class. The handle previously never rendered.
- Print and Print Preview: a battlegroup heading no longer prints alone at the foot of a page while its ship card flows onto the next.
- Rules text no longer splits mid-sentence across a page break, in both Big mode and the compact Roster layout.
- The Argonaut's "Mind of its Own" is now enforced when building a list: no Admiral can be assigned to it, and its points do not count toward your Medium-tonnage allowance (rulebook 4.2 Light/Heavy limits).

### 2026-07-01 — New civilian ships
- Two new ships from the Civilian Ships & Scenarios update: the EX-7 Packet Runner (UCM courier, 57 pts) and the Argonaut (space-dwelling astrofauna, 112 pts). Both can be taken in any fleet, under the Misc Ships filter.

### 2026-06-29 — Fleet sorting, abilities table & fixes
- Battlegroups auto-order by weight class (Colossal first, then Heavy, Medium, Light); drag the grip handle to reorder within a class.
- Printed and exported sheets list one consolidated table of every usable Admiral Ability (with AP cost) and follow the builder's group order.
- Print Preview page-break markers now reflect how cards actually stay together, so the page count is accurate.
- Slimmer Settings panel; all print options moved into Print Preview.
- Fixed the buildable Zenith Dreadnought: it no longer comes with preselected hardpoint weapons.

### 2026-06-26 — New rules editions + heroes
- Scourge updated to the latest edition: Oculus Beam Array Attack 2→3 (Shadow, Umbra, Banshee, Akuma, Flayer), Shadow & Umbra points changes, reworked Oculus Booster rule.
- Eight new Scourge ships: Nereid, Rusalka, Nixie, Gloam, Kikimora, Bannik, Melusine, Fossegrim.
- Three new Scourge Deployable Features: Skybane Halo, Shrouding Platform, Infestation Bastion.
- New hero ships: Avram Bei (PHR, the Subatomic) and Rhiannon Major (UCM, the Leaden Triad).
- Famous-admiral flagship Porter abilities now count toward your fleet Payload capacity.
- Sharper, higher-resolution ship art thumbnails.

### 2026-06-25 — Ship-stats accuracy pass
- Audited every famous-admiral flagship against the official Combined Fleet Stats PDFs and fixed missing or wrong weapons, stats and points.
- Fixed missing Alt-fire weapon modes and several weapon stat errors.
- Restored 14 ships' full lore and corrected scrambled lore order on 16 ships; fixed the UCM Defence Hangar / Munitions Platform art swap.

### 2026-06 — Earlier highlights
- New Recruit list import.
- Exact-odds combat damage calculator on ship/weapon cards.
- Collection tracker: record the ships you own and filter the picker to what you can build.
- Print overhaul: per-ship thumbnails, ink-saver and density toggles, page-break preview.
- Name your battlegroups (names persist, share and print).

## Links

A WarLore project.

- WarLore: [site](https://jetwong.neocities.org/), [Linktree](https://linktr.ee/warlore), [YouTube](https://www.youtube.com/@WarLore)
- More DFC tools: [Mission Maker and others](https://jetwong.neocities.org/wargaming/dropfleet-commander/)
- Bug or request? [warlore1@outlook.com](mailto:warlore1@outlook.com)

## Legal

Code is MIT. Ship art and game data belong to TTCombat / Hawk Wargames. Fan project, not official or endorsed.
