<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

A browser fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander). No sign-up; fleets save in your browser and work offline.

### ▶ [Desktop Builder](https://type37.github.io/dropfleet-builder/) &nbsp;·&nbsp; 📱 [Mobile Builder](https://type37.github.io/dropfleet-builder/mobile/)

*(Phones auto-redirect to the mobile build. Both share the same saved fleets.)*

</div>

---

## What it does

Build a fleet, check it's legal, then share or print it. All six factions: UCM, PHR, Scourge, Shaltari, Resistance, Bioficers.

- Every ship's stats, weapons, launch assets and special rules, with the rulebook text for any keyword on tap.
- Generic and famous admirals (famous ones bring their own flagship).
- Game sizes from Skirmish to Reconquest, with the right group, Colossal and admiral caps enforced.
- Resistance modular ships: Systems and Hardpoint pickers, Feature Carriers and loadout refits, all folded into the effective stats.
- Live legality checks: points, group caps, Unique/Rare, required systems, Porter/Payload capacity.
- Space stations, secondary objectives, ship art and class lore.
- Print view, share-by-link, and a New Recruit text export.

## Mobile

Phones redirect to [`/mobile/`](https://type37.github.io/dropfleet-builder/mobile/), a phone-first build that shares the same `dfc_fleets` storage as desktop, so a fleet built on one device shows up on the other. Same features, plus copy-as-text, PDF export, and one-tap Fast Play sheets. Installs as a PWA and works offline at the table.

## Data and art

Stats come from the [BSData repo](https://github.com/BSData/dropfleet-commander), converted to JSON: `data/fleet-index.json` loads on startup, then one `data/faction-<key>.json` per faction. Ship art is TTCombat's own renders, converted to WebP; it belongs to TTCombat.

## Tech

Static HTML/CSS/JS. No framework, no build step. Open `index.html`, or:

```sh
npx serve .
```

Fonts: [Jost](https://fonts.google.com/specimen/Jost), [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed).

## Links

- **WarLore:** [site](https://jetwong.neocities.org/) · [Linktree](https://linktr.ee/warlore) · [YouTube](https://www.youtube.com/@WarLore)
- **More DFC tools:** [Mission Maker and others](https://jetwong.neocities.org/wargaming/dropfleet-commander/)
- **Feedback:** [warlore1@outlook.com](mailto:warlore1@outlook.com)

## License

Code is MIT. Ship art and game data belong to TTCombat / Hawk Wargames. A fan project, not affiliated with or endorsed by TTCombat.
