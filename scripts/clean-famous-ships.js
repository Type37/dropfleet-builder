// Repairs `famousShips` arrays that were contaminated with comma-split lore
// prose by the original converter. A genuine ship-class name is short (<=4
// words); anything longer is a sentence fragment. We find the first prose
// element, peel its leading ship name off, and reattach the prose (rejoined
// with ", " to restore the original sentence commas) to the `lore` field.
//
// Run from repo root:  node scripts/clean-famous-ships.js
const fs = require('fs');

const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

// An entry is "prose" (not a ship name) if it has more than 4 words or is long.
function isProse(s) {
  const words = s.trim().split(/\s+/);
  return words.length > 4 || s.length > 34;
}

// From a prose-contaminated boundary element ("Purgatory (Kalium) Designs for
// Resistance cruisers..."), peel the leading ship name from the prose tail.
function peelName(s) {
  const paren = s.match(/^(.*?\([^)]*\))\s+(.*)$/); // "Name (Faction) <prose>"
  if (paren) return { name: paren[1].trim(), prose: paren[2].trim() };
  const m = s.match(/^(\S+)\s+(.*)$/);              // "Name <prose>"
  if (m && /^[A-Z]/.test(m[1])) return { name: m[1].trim(), prose: m[2].trim() };
  return { name: '', prose: s.trim() };             // no clean leading name
}

let grandTotal = 0;
FACTIONS.forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  let fixes = 0;

  (data.groups || []).forEach(g => {
    const fs2 = g.ship.famousShips;
    if (!Array.isArray(fs2) || fs2.length === 0) return;

    const boundary = fs2.findIndex(isProse);
    if (boundary < 0) return; // already clean

    const cleanNames = fs2.slice(0, boundary);
    const proseFrags = fs2.slice(boundary).map(s => s.trim());

    // Peel a leading ship name off the first prose fragment if there is one.
    const { name, prose } = peelName(proseFrags[0]);
    if (name) cleanNames.push(name);
    proseFrags[0] = prose;

    const proseText = proseFrags.filter(Boolean).join(', ').trim();
    if (proseText) {
      g.ship.lore = (g.ship.lore ? g.ship.lore.trim() + '\n\n' : '') + proseText;
    }
    if (cleanNames.length > 0) {
      g.ship.famousShips = cleanNames;
    } else {
      delete g.ship.famousShips;
      delete g.ship.famousShipsPrefix;
    }
    fixes++;
  });

  if (fixes > 0) {
    fs.writeFileSync(path, JSON.stringify(data));
    grandTotal += fixes;
  }
  console.log(`${fk}: ${fixes} ships cleaned`);
});
console.log(`TOTAL: ${grandTotal} ships cleaned`);
