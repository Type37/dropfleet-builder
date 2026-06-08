# Dropfleet Commander Fleet Builder

A fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander) by TTCombat. Runs entirely in the browser — no backend, no accounts, no telemetry. Your fleets live in localStorage.

**[Live site](https://type37.github.io/dropfleet-builder/)** (GitHub Pages)

## What it does

- Build fleet rosters for all six factions (UCM, PHR, Scourge, Shaltari, Resistance, Bioficers)
- Full ship stats, weapons tables, and special rules text pulled from the game data
- Generic and famous admiral selection with level-based costing
- Game size presets (Skirmish / Clash / Battle / Reconquest) with appropriate group and admiral caps
- Ship art for ~230 profiles, converted from TTCombat's own renders
- Systems/Hardpoint selection for Resistance cruisers, frigates and dreadnoughts (choose-N with category caps), Feature Carriers, and per-ship loadout refits
- Fleet construction validation (tonnage limits, group/colossal caps, unique/rare, admiral limits, required Systems/Features)
- Ship lore plus "Namesake" flavour, a print view with full reference cards, and fleet sharing via URL/clipboard
- A dedicated phone-first app at **`/mobile/`** (see below)

## Mobile app

Phones are auto-redirected to **[`/mobile/`](https://type37.github.io/dropfleet-builder/mobile/)** — a separate, phone-first builder (Hobgoblin-style linear navigation) that **shares the same `dfc_fleets` storage and fleet schema** as the desktop app, so a fleet built on one shows up on the other. It has the full builder feature set (all six factions, groups, admirals with ability picks, stations, deployable features, Systems/Hardpoints, loadouts, validation, tap-to-learn rules), plus **copy-as-text** (Discord-friendly roster), **export-as-PDF**, share links, and one-tap **starter-box fleets** for new players. A hamburger "view desktop" escape hatch is always available.

## What it doesn't do (yet)

- Offline / PWA support (the mobile app is online-only — a service worker for `/mobile/` is the next infra step)
- Systems/Hardpoint lists for factions other than Resistance (other factions use loadout refits, which are supported)

## Data

Ship stats and admiral data come from the [BSData BattleScribe repository](https://github.com/BSData/dropfleet-commander), converted to JSON via the scripts in `tools/`. The app loads a small **`data/fleet-index.json`** (game sizes, shared rules glossary, faction metadata) on startup, then **lazy-loads one `data/faction-<key>.json` per faction** as needed. (`data/fleet-data.json` is a legacy monolithic converter output kept for tooling; the app no longer loads it.) Source XML isn't included.

Ship art is sourced from TTCombat's web assets and converted to WebP. They're included in this repo because the app is useless without them, but they belong to TTCombat.

## Project layout

```
index.html, css/app.css, js/app.js   Desktop app (single-page, three-panel builder)
mobile/                              Phone-first app (own index.html / css / js, shares dfc_fleets)
data/                                fleet-index.json + faction-<key>.json (lazy-loaded)
assets/art/                          Ship art (WebP)
tools/                               BSData → JSON converters
scripts/                            One-off data-patching scripts (lore, systems, fixes)
sw.js                                Service worker (desktop; bump CACHE on each deploy)
```

Both apps are independent vanilla-JS bundles that read the same `data/` and the same `localStorage` key (`dfc_fleets`), so fleets are interoperable. The desktop app lazy-loads factions via `ensureFactionLoaded`; the mobile app via `ensureFaction`. Deploys go straight to `master` (trunk-based) → GitHub Pages.

## Tech

Static HTML/CSS/JS. No framework, no build step, no dependencies. Open `index.html` or serve it with anything.

Fonts: [Jost](https://fonts.google.com/specimen/Jost) (body), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab) (headings), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) (stat blocks). Loaded from Google Fonts.

## Running locally

```
npx serve .
```

Or just open `index.html` in a browser. CORS isn't an issue since the data is loaded via relative paths.

## License

The code is MIT. Ship art and game data are property of TTCombat / Hawk Wargames. This is a fan project — not affiliated with or endorsed by TTCombat.
