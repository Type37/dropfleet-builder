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

### 2026-07-02 — Print and battlegroup fixes
- Battlegroup reordering: each group card now shows a drag handle (whenever its weight class holds two or more groups), so you can drag to reorder groups within a class. The handle previously never rendered.
- Print and Print Preview: a battlegroup heading no longer prints alone at the foot of a page while its ship card flows onto the next.
- Rules text no longer splits mid-sentence across a page break, in both Big mode and the compact Roster layout.

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
