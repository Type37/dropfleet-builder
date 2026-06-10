# Dropfleet Commander Fleet Builder

A browser fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander). No backend, no accounts — fleets save to your browser. The only analytics are [GoatCounter](https://www.goatcounter.com/) (cookieless, aggregate page counts).

**[Open the builder →](https://type37.github.io/dropfleet-builder/)**

## Features

- All six factions (UCM, PHR, Scourge, Shaltari, Resistance, Bioficers)
- Full stats, weapons, and verbatim rules text
- Generic and famous admirals with level-based costing
- Game sizes (Skirmish → Reconquest) with the right group, colossal, and admiral caps
- Resistance Systems/Hardpoints (choose-N with category caps), Feature Carriers, and per-ship loadout refits
- Build validation — tonnage limits, caps, unique/rare, required systems
- Ship lore, a print view with full reference cards, and share-by-link
- Transparent-cutout ship art for 400+ profiles

## Mobile

Phones redirect to [`/mobile/`](https://type37.github.io/dropfleet-builder/mobile/) — a phone-first builder (Hobgoblin-style) that shares the same `dfc_fleets` storage as desktop, so a fleet built on one appears on the other. Full feature set, plus copy-as-text, export-as-PDF, one-tap starter fleets, and a guided coach for new players. Installable PWA, works offline.

## Links

- **WarLore** — [site](https://jetwong.neocities.org/) · [Linktree](https://linktr.ee/warlore) · [YouTube](https://www.youtube.com/@WarLore)
- [Source on GitHub](https://github.com/Type37/dropfleet-builder)

## Data & art

Stats come from the [BSData repo](https://github.com/BSData/dropfleet-commander), converted to JSON: a small `data/fleet-index.json` (game sizes, shared rules, faction metadata) loads on startup, then one `data/faction-<key>.json` lazy-loads per faction. Ship art is TTCombat's own renders, converted to WebP — bundled because the app needs it, but it belongs to TTCombat.

## Tech

Static HTML/CSS/JS — no framework, no build step, no dependencies. Open `index.html`, or `npx serve .`.

Fonts: [Jost](https://fonts.google.com/specimen/Jost) (body), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab) (display/numbers), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) (stat labels).

## License

Code is MIT. Ship art and game data belong to TTCombat / Hawk Wargames. A fan project — not affiliated with or endorsed by TTCombat.
