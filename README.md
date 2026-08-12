<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

Build, check and print a legal fleet for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander), then use it at the table. Free, no login, no install. Fleets save in your browser and the whole app runs offline.

### ▶ [Open the builder](https://type37.github.io/dropfleet-builder/) &nbsp;&nbsp;&nbsp; 📱 [Mobile version](https://type37.github.io/dropfleet-builder/mobile/)

*Phones are sent to the mobile version automatically. Both share the same saved fleets.*

</div>

## What you get

All six factions: UCM, PHR, Scourge, Shaltari, Resistance and Bioficers, plus space stations, civilian and mercenary ships.

**Building a list**

- Full stats, weapons, launch assets and special rules for every ship, with the rulebook text for any keyword one tap away.
- Generic and famous admirals, with their abilities. Famous admirals bring their flagship.
- Every game size from Skirmish to Reconquest, with points, tonnage, group, Colossal, Unique and Rare limits enforced as you build.
- Live validation for the fiddly parts: required systems, Porter and Payload capacity, ships that refuse an admiral, features that must be chosen.
- Resistance and other modular ships get proper Systems and Hardpoint pickers, Feature Carriers and loadout refits, all folded into the fielded stats.
- Battlegroups sort themselves by weight class, can be named, and drag to reorder.

**At the table**

- Play Mode: hull and damage tracking, orders that grey out the weapons you cannot fire, crippling effects, VP and Pass tokens.
- Combat calculator with exact damage odds, on any ship or weapon.
- Print sheets with per-ship art, ink-saver and density options, full rules text and an accurate page-break preview.
- Share links, plain-text army lists and New Recruit import.

**Your stuff**

- Offline download: one button fetches every faction, rule and ship image, about 28 MB, so nothing needs signal at a games night.
- Fleet Sync: optional cross-device sync with a six-word token. No account, no password.
- My Collection: record the models you own and filter the ship picker to what you can actually field.
- Ship art, per-class lore, namesakes and a pronunciation guide for the hard names.

## Mobile

The [mobile build](https://type37.github.io/dropfleet-builder/mobile/) is a separate, touch-first app that reads and writes the same saved fleets as the desktop site. Add it to your home screen and it behaves like an installed app, offline included.

## Data and accuracy

Ship stats start from the [BSData project](https://github.com/BSData/dropfleet-commander), converted to JSON, then checked line by line against TTCombat's Combined Fleet Stats PDFs. Rules text in the app is quoted from the official PDFs rather than paraphrased. Automated audit scripts in `scripts/` guard against a ship silently losing a special rule or a group size when a faction is re-ingested from a newer edition.

Ship art and game data are TTCombat's, not mine.

## Running it locally

Plain HTML, CSS and JavaScript. No framework, no build step, no package manager. Open `index.html`, or serve the folder:

```sh
npx serve .
```

Deploys to GitHub Pages from `master` via `.github/workflows/deploy.yml`. Fonts are [Jost](https://fonts.google.com/specimen/Jost), [Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab) and [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed).

## Recent changes

Full history, with the reasoning behind each change, is in [CHANGELOG.md](CHANGELOG.md). The player-facing version is the *What is New* panel inside the app.

- **2026-08-11** Dropzone Commander armies were leaking into the fleet list through shared storage and sync. Fixed, and any that arrived are cleaned up automatically.
- **2026-08-11** My Collection, army-list import, fleet backups and model links all came to mobile. Torpedoes and Boarding Pods are separate chips again, which corrected 67 ships.
- **2026-08-01** Resistance updated to the 260731 edition: ten new ships, three new Deployable Features, and points and weapon changes on the Phalanx, Senator, Tribune, Centurion and Gladiator. Shaltari gained Nefertem of the Dawn, and every fleet can hire the M.A.B. 67 Fuel Transport.
- **2026-07-29** Fleet Sync: opt-in cross-device sync with a six-word token, no account.
- **2026-07-21** Offline download, so the whole app works with no signal.
- **2026-07-19** Crippled no longer halves weapon Attack dice. That was never a Dropfleet rule and should not have shipped.

## Bugs and requests

[Open an issue](https://github.com/Type37/dropfleet-builder/issues/new/choose) (you can paste a screenshot straight in), or email [warlore1@outlook.com](mailto:warlore1@outlook.com).

## Links

A WarLore project.

- WarLore: [site](https://jetwong.neocities.org/), [Linktree](https://linktr.ee/warlore), [YouTube](https://www.youtube.com/@WarLore)
- More DFC tools, including the Mission Maker: [jetwong.neocities.org](https://jetwong.neocities.org/wargaming/dropfleet-commander/)

## Legal

Code is MIT, see [LICENSE](LICENSE). Ship art, ship stats and rules text belong to TTCombat / Hawk Wargames and are used here under no claim of ownership. This is an unofficial fan project, not endorsed by or affiliated with TTCombat.
