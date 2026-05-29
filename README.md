# Dropfleet Commander Fleet Builder

A fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander) by TTCombat. Runs entirely in the browser — no backend, no accounts, no telemetry. Your fleets live in localStorage.

**[Live site](https://type37.github.io/dropfleet-builder/)** (GitHub Pages)

## What it does

- Build fleet rosters for all six factions (UCM, PHR, Scourge, Shaltari, Resistance, Bioficers)
- Full ship stats, weapons tables, and special rules text pulled from the game data
- Generic and famous admiral selection with level-based costing
- Game size presets (Skirmish / Clash / Battle / Reconquest) with appropriate group and admiral caps
- Ship art for ~230 profiles, converted from TTCombat's own renders
- Works on mobile

## What it doesn't do (yet)

- Print view with reference cards (planned, and it will be good)
- Fleet sharing via URL
- Group composition validation (tonnage limits, max-one-space-station, etc.)
- Offline / PWA support

## Data

Ship stats and admiral data come from the [BSData BattleScribe repository](https://github.com/BSData/dropfleet-commander), converted to JSON via a local script. The source XML files aren't included here — just the processed `fleet-data.json`.

Ship art is sourced from TTCombat's web assets and converted to WebP. They're included in this repo because the app is useless without them, but they belong to TTCombat.

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
