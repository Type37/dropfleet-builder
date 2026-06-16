// Per the UCM PDF, the four Super Battleships (Thebes/Carthage/Byzantium/Babylon)
// each carry TWO UF-4200 Mass Driver Turrets as standard, and the Laser Refit
// "replaces BOTH of its UF-4200 Mass Driver Turrets with a single Cobra Heavy
// Laser Pair". Our data only had ONE UF-4200 in each super-BB's Laser Refit
// default option, so the refit swapped a single turret. Add the second UF-4200.
// (Regular battleships already had two; they are untouched.)
const fs = require('fs');
const p = 'data/faction-ucm.json';
const ships = ['Thebes Super Battleship', 'Carthage Super Battleship', 'Byzantium Super Battleship', 'Babylon Super Battleship'];

const NL = '\r\n';
const DUP =
  ',' + NL +
  '         {' + NL +
  '          "name": "UF-4200 Mass Driver Turrets",' + NL +
  '          "arc": "F/S",' + NL +
  '          "attack": "4",' + NL +
  '          "lock": "4+",' + NL +
  '          "damage": "1",' + NL +
  '          "type": "K",' + NL +
  '          "special": "Fusillade-2"' + NL +
  '         }';
// opt0's UF-4200 weapon closes with this exact sequence (single turret, then array end):
const ANCHOR = '"special": "Fusillade-2"' + NL + '         }' + NL + '        ]';
const REPLACE = '"special": "Fusillade-2"' + NL + '         }' + DUP + NL + '        ]';

function uf4200Count(ship) {
  const lr = (ship.loadoutOptions || []).find(lo => /laser refit/i.test(lo.name));
  if (!lr) return -1;
  return (lr.options[0].weapons || []).filter(w => /UF-4200/i.test(w.name)).length;
}

let s = fs.readFileSync(p, 'utf8');
for (const name of ships) {
  const j = JSON.parse(s);
  const g = j.groups.find(g => g.ship && g.ship.name === name);
  const before = uf4200Count(g.ship);
  if (before === 2) { console.log(name.padEnd(28), 'already x2 - skip'); continue; }
  if (before !== 1) { console.log(name.padEnd(28), 'unexpected count', before, '- ABORT'); continue; }

  const shipIdx = s.indexOf('"' + name + '"');
  const lrIdx = s.indexOf('"Laser Refit"', shipIdx);
  const anchorIdx = s.indexOf(ANCHOR, lrIdx);
  if (anchorIdx < 0) { console.log(name.padEnd(28), 'anchor not found - ABORT'); continue; }
  s = s.slice(0, anchorIdx) + REPLACE + s.slice(anchorIdx + ANCHOR.length);

  // validate this ship now has 2
  const after = uf4200Count(JSON.parse(s).groups.find(g => g.ship && g.ship.name === name).ship);
  if (after !== 2) { console.log(name.padEnd(28), 'post-edit count', after, '- ABORT (not written)'); process.exit(1); }
  console.log(name.padEnd(28), 'x1 -> x2 OK');
}
JSON.parse(s); // final validate
fs.writeFileSync(p, s);
console.log('written.');
