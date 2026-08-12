<div align="center">

[![Dropfleet Commander Fleet Builder](assets/logos/og-preview.png)](https://type37.github.io/dropfleet-builder/)

# Dropfleet Commander Fleet Builder

### [Open it](https://type37.github.io/dropfleet-builder/) &nbsp;·&nbsp; [Mobile](https://type37.github.io/dropfleet-builder/mobile/)

</div>

A fleet builder for [Dropfleet Commander](https://www.ttcombat.com/games/dropfleet-commander), all six factions. Free, no login, and it works with no signal.

**Nothing in it is invented.** Every stat and every rule is quoted from TTCombat's PDFs word for word, never paraphrased. I learned why that matters the hard way: a rule I had half-remembered, that a Crippled ship halves its Attack dice, shipped and survived hundreds of versions before it was caught. It was never a Dropfleet rule. Nothing that affects play goes in now without the page it came from, and audit scripts re-run on every edition ingest so a ship cannot quietly lose a special rule or a group size when TTCombat updates a stats sheet.

**Nothing is ever cut off.** No ellipsis, no truncated weapon name, no rule folded away behind a "show more". If it is something you need at the table, it is on screen in full and the box grows to fit it.

**It assumes you have no signal.** One button downloads the whole app, every faction and every ship image, instead of trusting a service worker to have happened to cache the right things. Discovering mid-game that your opponent's faction never loaded is not a failure worth risking to save 28 MB.

**There are no accounts.** Syncing fleets between a phone and a desktop is a six-word phrase, and the phrase is the entire credential. No email, no password, nothing of yours held anywhere that could leak.

**It checks the list so you do not have to.** Points, tonnage, group sizes, Unique and Rare, launch and Porter capacity, the ships that refuse an admiral, the features you have to choose before the list is legal. The rules that are tedious to remember are the ones worth automating.

Under it: plain HTML, CSS and JavaScript, no framework and no build step. When sync needed a backend I wrote the Firestore calls by hand rather than add a 400 KB SDK to an app whose whole job is to work offline.

## Links

[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/Type37/dropfleet-builder/issues/new/choose) · [WarLore](https://jetwong.neocities.org/) · [More DFC tools](https://jetwong.neocities.org/wargaming/dropfleet-commander/)

## Legal

Code is [MIT](LICENSE). The game data, rules text, ship names and art are TTCombat's and are not covered by that licence. Ship stats are derived from [BSData](https://github.com/BSData/dropfleet-commander). Unofficial fan project, not endorsed by TTCombat.
