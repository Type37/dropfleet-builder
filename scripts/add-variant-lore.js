// Adds official TTCombat product lore to event-exclusive variant ships that
// were missing it. Sourced via research (ttcombat.com product pages + the
// original Hawk Wargames web-exclusive writeups / community wiki).
// Run from repo root:  node scripts/add-variant-lore.js
const fs = require('fs');

const SARATOGA = "The Saratoga is an experimental development of the New Cairo class Light Cruiser, with a focus on efficiency and incorporating the very latest systems. An entirely new prow and amidships superstructure were conceived from the ground up, making it unique amongst the UCM's roster of ships. Early field reports of the class in action have been exemplary: it matches the combat performance of the New Cairo while requiring less energy and half the crew complement. The Saratogas were built exclusively at the FSI (Ferrum Shipping Industries) yards over the planet Ferrum, which were entirely destroyed during the Scourge onslaught in late 2671. The yards had turned out only a meagre twelve vessels for early void trials before their loss, making this one of the rarest ships in the UCMF.";

const BATTLECRUISER = "The Adamant and Palladium class battlecruisers are highly potent vessels designed for maximum firepower in a fast, sleek package. They combine battleship-level firepower with the speed to keep up with cruisers, making them excellent command vessels and superlative in the arts of flanking sweeps and the annihilation of enemy supply convoys behind the lines. They lack a battleship's ability to take punishment, however, trading durability for speed, and so demand captains who employ dexterity, restraint and opportunistic aggression.";

const ANOMALY = "The Anomaly is an anomalous starship sighted on the battlefields of the Reconquest, with almost nothing known of its allegiances, specifications, or capabilities. The ship is said to be capable of moving at beyond-relativistic speeds while in realspace. No life signs were detected aboard by UCM scans, yet the presence of unusually homogeneous organic matter has been revealed through spectral analysis. Though the Anomaly's hull is substantially different from that of known Bioficer vessels, it carries the same armament as a Construct-class cruiser, hinting that it may be an alternative form of that ship.";

function loadF(fk) { return JSON.parse(fs.readFileSync(`data/faction-${fk}.json`, 'utf8')); }
function saveF(fk, d) { fs.writeFileSync(`data/faction-${fk}.json`, JSON.stringify(d)); }
function findVariant(d, baseName, varName) {
  const g = (d.groups || []).find(g => g.ship.name === baseName);
  if (!g) return null;
  return (g.ship.variants || []).find(v => v.name === varName) || null;
}

let changed = 0;

// UCM — Saratoga (counts as New Cairo)
let ucm = loadF('ucm');
let sara = findVariant(ucm, 'New Cairo Light Cruiser', 'Saratoga');
if (sara && !sara.lore) { sara.lore = SARATOGA; saveF('ucm', ucm); changed++; console.log('+ Saratoga lore'); }

// Shaltari — Adamant (Ruby) + Palladium (Sapphire) share the kit's flavour text
let shal = loadF('shaltari');
let adam = findVariant(shal, 'Ruby Battlecruiser', 'Adamant');
let pall = findVariant(shal, 'Sapphire Battlecruiser', 'Palladium');
let shalChanged = false;
if (adam && !adam.lore) { adam.lore = BATTLECRUISER; shalChanged = true; console.log('+ Adamant lore'); }
if (pall && !pall.lore) { pall.lore = BATTLECRUISER; shalChanged = true; console.log('+ Palladium lore'); }
if (shalChanged) { saveF('shaltari', shal); changed++; }

// Bioficer — Anomaly is a counts-as Construct Cruiser, not yet in the data.
// Add it as a variant of Construct Cruiser (art already present).
let bio = loadF('bioficer');
let construct = (bio.groups || []).find(g => g.ship.name === 'Construct Cruiser');
if (construct) {
  construct.ship.variants = construct.ship.variants || [];
  if (!construct.ship.variants.some(v => v.name === 'Anomaly')) {
    construct.ship.variants.push({
      name: 'Anomaly',
      note: 'The Anomaly counts as a Construct Cruiser',
      image: 'assets/art/the_anomaly.webp',
      lore: ANOMALY
    });
    saveF('bioficer', bio);
    changed++;
    console.log('+ Anomaly variant added to Construct Cruiser');
  }
}

console.log(`\nDONE: ${changed} faction file(s) updated`);
console.log('NOTE: Athens (UCM, counts-as Osaka) has no official lore on TTCombat — left as-is.');
console.log('NOTE: Vicarius (Resistance Senator variant) already had lore — left untouched.');
