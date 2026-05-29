// Populates missing Famous Admiral flagships (verified against the Combined
// Fleet Stats PDFs). The flagship object mirrors a ship profile + category, and
// its cost is the ship's points cost (matching how existing flagships are stored).
// Also applies two optional full-name corrections.
// Run from repo root:  node scripts/populate-flagships.js
const fs = require('fs');

// faction -> { "Admiral name": "Flagship leading class word" }
const FLAGSHIPS = {
  scourge:    { 'Baba Yaga': 'Daemon', 'Enslaver': 'Raiju' },
  phr:        { 'Helena of Asgard': 'Pompeius' },
  resistance: { 'Magellan': 'Coloniser', 'Nguen': 'Olympus', 'Hagen': 'Tribune', 'Typhoon Vasquez': 'Heavy Cruiser' },
  bioficer:   { 'Ascendant': 'Zenith', 'Agency': 'Bastion', 'Atom': 'Scion' }
};
// Optional full-name corrections (per lore / PDF headers)
const RENAMES = {
  phr: { 'Javelin': 'Director Javelin' },
  ucm: { 'Tayne': 'Tobias Tayne' }
};

function shipProfile(group) {
  const s = group.ship;
  return {
    name: s.name, cost: s.cost, stats: s.stats, weapons: s.weapons || [],
    loads: s.loads || [], specialRules: s.specialRules || [],
    groupMin: s.groupMin, groupMax: s.groupMax, isRare: s.isRare,
    isUnique: s.isUnique, tonnage: (s.stats && s.stats.tonnage) || '', category: group.category
  };
}

let totalFlag = 0, totalRename = 0;
const notes = [];
Object.keys({ ...FLAGSHIPS, ...RENAMES }).forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  let changed = false;

  Object.entries(FLAGSHIPS[fk] || {}).forEach(([admName, shipWord]) => {
    const adm = data.admirals.find(a => a.isFamous && a.name === admName);
    if (!adm) { notes.push(`${fk}: admiral "${admName}" not found`); return; }
    // match a ship whose name starts with the class word
    const g = data.groups.find(g => g.ship.name === shipWord || g.ship.name.startsWith(shipWord + ' '));
    if (!g) { notes.push(`${fk}: flagship ship "${shipWord}" not found for ${admName}`); return; }
    adm.flagship = shipProfile(g);
    changed = true; totalFlag++;
    if (shipWord === 'Heavy Cruiser') notes.push(`resistance: Typhoon Vasquez flagship set to base Heavy Cruiser (${g.ship.cost}pts) — needs the "Bullet Baron" Cruiser Systems for exact points`);
  });

  Object.entries(RENAMES[fk] || {}).forEach(([oldName, newName]) => {
    const adm = data.admirals.find(a => a.isFamous && a.name === oldName);
    if (adm) { adm.name = newName; changed = true; totalRename++; }
  });

  if (changed) fs.writeFileSync(path, JSON.stringify(data));
});

console.log(`Flagships added: ${totalFlag}, names fixed: ${totalRename}`);
notes.forEach(n => console.log('NOTE: ' + n));
