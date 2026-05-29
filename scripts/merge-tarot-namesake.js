// Merges parsed Tarot "Namesake" etymology text into a faction's ship data
// as a `namesake` field. Usage: node scripts/merge-tarot-namesake.js <fk> <json>
const fs = require('fs');
const fk = process.argv[2];
const items = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const path = `data/faction-${fk}.json`;
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
let n = 0;
items.forEach(it => {
  const base = it.name.toLowerCase();
  const g = data.groups.find(g => {
    const nm = g.ship.name.toLowerCase();
    return nm === base || nm.startsWith(base + ' ') || nm.split(' ')[0] === base;
  });
  if (g) { g.ship.namesake = it.namesake; n++; }
});
fs.writeFileSync(path, JSON.stringify(data));
console.log(`${fk}: ${n} namesakes merged`);
