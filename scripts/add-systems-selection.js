// Adds structured `systemSelection` rules to the Resistance ships that must
// choose options from a Systems/Hardpoint list. Parsed from the printed
// rulesText constraints (kept verbatim in the data already). categoryCaps keys
// are matched against option categories by prefix (startsWith), so "Broadside"
// covers both "Broadside Hardpoint (Weapons)" and "Broadside Hardpoint (Launch)".
// Run from repo root:  node scripts/add-systems-selection.js
const fs = require('fs');

const SEL = {
  // Cruiser Systems — exactly N total; <=2 broadside (weapons+launch), <=2 structures
  'Light Cruiser':  { listName: 'Cruiser Systems', totalRequired: 3, totalIsExact: true, categoryCaps: { Broadside: 2, Structures: 2 } },
  'Cruiser':        { listName: 'Cruiser Systems', totalRequired: 4, totalIsExact: true, categoryCaps: { Broadside: 2, Structures: 2 } },
  'Heavy Cruiser':  { listName: 'Cruiser Systems', totalRequired: 5, totalIsExact: true, categoryCaps: { Broadside: 2, Structures: 2 } },
  // Dreadnought Systems — exactly N total; per-category caps
  'Pathfinder Interstellar Raft':      { listName: 'Dreadnought Systems', totalRequired: 4, totalIsExact: true, categoryCaps: { Broadside: 2, Turret: 2, Launch: 2, Structures: 1 } },
  'Explorer Interstellar Ark':         { listName: 'Dreadnought Systems', totalRequired: 6, totalIsExact: true, categoryCaps: { Broadside: 3, Turret: 3, Launch: 3, Structures: 1 } },
  'Coloniser Interstellar Dreadnought':{ listName: 'Dreadnought Systems', totalRequired: 8, totalIsExact: true, categoryCaps: { Broadside: 4, Turret: 4, Launch: 4, Structures: 2 } },
  // Frigate Systems — exact for frigates; Strike Carrier may take 0 or 1
  'Frigate':        { listName: 'Frigate Systems', totalRequired: 1, totalIsExact: true,  categoryCaps: {} },
  'Heavy Frigate':  { listName: 'Frigate Systems', totalRequired: 2, totalIsExact: true,  categoryCaps: {} },
  'Strike Carrier': { listName: 'Frigate Systems', totalRequired: 1, totalIsExact: false, categoryCaps: {} }
};

const path = 'data/faction-resistance.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
let n = 0;
data.groups.forEach(g => {
  const sel = SEL[g.ship.name];
  if (sel) { g.ship.systemSelection = sel; n++; }
});
fs.writeFileSync(path, JSON.stringify(data));
console.log(`Resistance: added systemSelection to ${n} ships`);
