<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

### [Open it](https://type37.github.io/dropfleet-builder/) &nbsp;·&nbsp; [Mobile](https://type37.github.io/dropfleet-builder/mobile/)

</div>

Assemble and print your fleet in this unofficial fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander), published by TTCombat. Unofficial builder by WarLore.

## What it does

- Six factions, every ship.
- Validates as you build: points, tonnage, group sizes, Unique and Rare, launch and Porter capacity.
- Print sheets, and a play mode for damage and turns.
- Works with no signal. One button downloads the lot.
- Phone-to-desktop sync on a six-word phrase. No account.
- Rules quoted from TTCombat's PDFs word for word.

## Design decisions

- Dresses as its own rulebook: warm paper, navy rail, gold Deco, Fluent 2 underneath.
- Nothing is cut off, and opening a menu never moves the page.
- Plain HTML, CSS and JS. No framework, no build step, hand-written Firestore rather than a 400 KB SDK.
- A separate `/mobile/` build, probably unnecessary. Dropzone came after as one responsive app.

## Still to do

- Adding an Admiral leaves the "must contain an Admiral" panel up until you navigate away and back.
- A QR code would share a fleet across a table faster than a link.

## Run it

```bash
python -m http.server 8901
```

## Legal

Code is [MIT](LICENSE); game data, rules text and art are TTCombat's. Stats from [BSData](https://github.com/BSData/dropfleet-commander). Unofficial, not endorsed by TTCombat.

[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/Type37/dropfleet-builder/issues/new/choose) · [WarLore](https://jetwong.neocities.org/)
