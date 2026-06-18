<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

A fast, offline-capable browser fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander).
No backend, no accounts, no tracking. Fleets save to your browser and sync between desktop and mobile.

### ▶ [Open the Desktop Builder](https://type37.github.io/dropfleet-builder/) &nbsp;·&nbsp; 📱 [Open the Mobile Builder](https://type37.github.io/dropfleet-builder/mobile/)

*(Phones auto-redirect to the mobile build. Both share the same saved fleets.)*

</div>

---

## What it does

Build, validate, share, and print tournament-legal fleets for all six factions, with the full datasheet and the official rules text one tap away.

- **All six factions:** UCM, PHR, Scourge, Shaltari, Resistance, and Bioficers.
- **Complete datasheets:** stats, weapons (with arc icons), launch assets, and special rules, every keyword tappable for its **verbatim rulebook text** (bold preserved). Launch assets show their deploy range and activation rules.
- **Admirals:** generic admirals with level-based costing, plus famous admirals who bring their own flagship to the table.
- **Game sizes:** Skirmish through Reconquest, each enforcing the correct group, Colossal, and admiral-level caps.
- **Resistance modular ships:** Systems/Hardpoint pickers (choose-N with category min/max), Feature Carriers, and per-ship loadout refits, all factored into the effective stats.
- **Live validation:** tonnage limits, group caps, Unique/Rare limits, required systems, Porter/Payload capacity, surfaced as always-visible alerts.
- **Space stations:** generic stations get an armament/upgrade picker; faction-specific stations show their datasheet.
- **Print and share:** a dense, paper-ready print view with full reference cards, plus share-by-link and a New Recruit text export.
- **Ship lore and art:** transparent-cutout TTCombat renders for 400+ profiles, with hand-written class lore.

## Mobile

Phones redirect to [`/mobile/`](https://type37.github.io/dropfleet-builder/mobile/), a phone-first (Hobgoblin-style) build that shares the same `dfc_fleets` storage as desktop, so a fleet built on one device appears on the other. Full feature set plus copy-as-text, export-as-PDF, one-tap starter fleets, and a guided coach for new players. Installable as a PWA; works offline at the table.

## Privacy

No accounts, no cookies, no backend. Fleets live in your browser's local storage. The only analytics are [GoatCounter](https://www.goatcounter.com/): cookieless, aggregate page counts, no personal data.

## Data and art

Stats come from the [BSData repo](https://github.com/BSData/dropfleet-commander), converted to JSON: a small `data/fleet-index.json` (game sizes, shared rules, faction metadata) loads on startup, then one `data/faction-<key>.json` lazy-loads per faction. Ship art is TTCombat's own renders, converted to WebP and bundled because the app needs it, but it belongs to TTCombat.

## Tech

Static HTML/CSS/JS. No framework, no build step, no dependencies. Open `index.html` directly, or serve the folder:

```sh
npx serve .
# then open http://localhost:3000
```

Fonts: [Jost](https://fonts.google.com/specimen/Jost) (body), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab) (display/numbers), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) (stat labels).

## Links

- **WarLore:** [site](https://jetwong.neocities.org/) · [Linktree](https://linktr.ee/warlore) · [YouTube](https://www.youtube.com/@WarLore)
- **More DFC tools:** [Mission Maker and others](https://jetwong.neocities.org/wargaming/dropfleet-commander/)
- **Feedback:** [warlore1@outlook.com](mailto:warlore1@outlook.com)

## License

Code is MIT. Ship art and game data belong to TTCombat / Hawk Wargames. A fan project, not affiliated with or endorsed by TTCombat.
