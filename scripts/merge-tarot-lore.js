// Merges parsed Tarot-card lore (scripts/parse-tarot-lore.js output) into a
// faction JSON file's ship `lore` fields. The Tarot lore is the user's own
// curated text and takes precedence; `famousShips`/`famousShipsPrefix` are
// preserved untouched.
// Usage: node scripts/merge-tarot-lore.js <factionKey> <lore-json>
const fs = require('fs');

const fk = process.argv[2];
const loreFile = process.argv[3];
const lore = JSON.parse(fs.readFileSync(loreFile, 'utf8'));
const path = `data/faction-${fk}.json`;
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function matchShip(baseName) {
  const base = baseName.toLowerCase();
  return data.groups.find(g => {
    const n = g.ship.name.toLowerCase();
    return n === base || n.startsWith(base + ' ') || n.split(' ')[0] === base;
  });
}

let merged = 0;
const skipped = [];
lore.forEach(L => {
  const g = matchShip(L.name);
  if (!g) { skipped.push(L.name); return; }
  g.ship.lore = L.lore;
  merged++;
});

fs.writeFileSync(path, JSON.stringify(data));
console.log(`${fk}: ${merged} ship lore entries merged from Tarot cards`);
if (skipped.length) console.log(`  no ship match (likely admirals/other): ${skipped.join(', ')}`);
