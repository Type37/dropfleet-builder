// Restructure admiral data to model the real DFC rule:
//   "Famous and Faction Admirals may take additional Abilities from the
//    [Faction] Abilities Table. Each Admiral states how many they may take."
//
// The BSData converter had dumped the ENTIRE faction ability table into every
// admiral's `abilities` array. We split that back out:
//   - faction.abilitiesTable  = the shared selectable pool (the abilities common
//                               to all admirals = the published Abilities Table).
//   - admiral.abilities       = only that admiral's OWN innate ability(s).
//   - admiral.abilityPicks    = how many table abilities they may choose (1 or 2,
//                               per the "* may take N additional Abilities" note).
//
// Also fixes the long-standing Nguen (Resistance) flagship gap: his flagship
// "Olympus" is a Yi Sun-sin-class Grand Battleship (weapons match exactly:
// 9K Mass Driver Turrets + Mega Vent Cannon Half Battery, Hull 24); the PDF
// header reads "Nguen - Olympus 415 pts (85 + 330 pts)".
//
// Run from repo root:  node scripts/restructure-admirals.js
const fs = require('fs');

// Admirals that may take TWO table abilities (matched by name substring).
// Everyone else takes one. Derived from the "* may take N additional" footnotes
// in each Combined Fleet Stats PDF (aligned by level + flagship class).
const TWO_PICKS = {
  ucm:        ['Halsey'],
  scourge:    ['Enslaver', 'Baba Yaga', 'Overlord of Flies'],
  phr:        ['Gaius Chau', 'Claudia Rhee'],
  shaltari:   ['Quetzalcoatl', 'Twins of Aaru'],
  resistance: [],
  bioficer:   ['Ascendant'],
};
const FACTIONS = Object.keys(TWO_PICKS);

FACTIONS.forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  const adms = d.admirals || [];

  // The Abilities Table = abilities present on EVERY admiral (intersection).
  const sets = adms.map(a => new Set((a.abilities || []).map(x => x.name)));
  let inter = sets.length ? [...sets[0]] : [];
  sets.forEach(s => inter = inter.filter(n => s.has(n)));
  const interSet = new Set(inter);

  // Build the table, preserving {name, cost, effect}, in published order.
  const src = adms.find(a => (a.abilities || []).length) || { abilities: [] };
  d.abilitiesTable = inter.map(name => {
    const e = src.abilities.find(x => x.name === name);
    return { name: e.name, cost: e.cost, effect: e.effect };
  });

  // Trim each admiral to their innate abilities + set pick count.
  const twos = TWO_PICKS[fk] || [];
  adms.forEach(a => {
    a.abilities = (a.abilities || [])
      .filter(x => !interSet.has(x.name))
      .map(x => ({ name: x.name, cost: x.cost, effect: x.effect }));
    a.abilityPicks = twos.some(s => a.name.includes(s)) ? 2 : 1;
  });

  // Nguen flagship fix.
  if (fk === 'resistance') {
    const nguen = adms.find(a => /Nguen/i.test(a.name));
    const yi = (d.groups || []).map(g => g.ship).find(s => /Yi Sun/i.test(s.name));
    if (nguen && !nguen.flagship && yi) {
      nguen.flagship = {
        name: 'Olympus',
        className: 'Yi Sun-sin Grand Battleship',
        cost: 330,
        stats: yi.stats,
        weapons: yi.weapons,
        loads: yi.loads || [],
        specialRules: [
          ...(yi.specialRules || []),
          { name: 'Extensive Reactor Modifications', description: "If Hull points lost due to its Vent Cannon Batteries' Overcharge rule would cause this Ship to be destroyed, it rolls 3D3 for its explosion and that explosion also affects Ships in other Orbital Layers." }
        ],
        groupMin: 1, groupMax: 1, tonnage: 'H', category: 'heavy'
      };
      console.log('  resistance: set Nguen flagship -> Olympus (Yi Sun-sin Grand Battleship, 330 pts)');
    }
  }

  fs.writeFileSync(path, JSON.stringify(d));
  const pickSummary = adms.filter(a => a.abilityPicks === 2).map(a => a.name).join(', ') || '(all 1)';
  console.log(`${fk}: table=${d.abilitiesTable.length} abilities | 2-pick admirals: ${pickSummary}`);
});
