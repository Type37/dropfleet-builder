// Adds the Bioficer "Genitor Tower" as a Payload option.
// Stats transcribed from Bioficer_Combined_Fleet_Stats_260429.pdf
// ("Bioficer Deployable Features / Towers" table):
//   Genitor Tower — Hull 8, 25 pts; weapon "Genitor Pod" F / Att 3 / Lk 4+ /
//   Dmg 1 / Type K / Special: Bombardment, Genitor.
// Jet asked for it in the Payload section (alongside the Cells), so it is added
// with category 'payload'. Shape is guaranteed by deep-cloning an existing
// payload entry (Prism Cell) and overriding only the known fields.
// Idempotent + self-validating. Run from repo root: node scripts/add-genitor-tower.js
const fs = require('fs');
const path = 'data/faction-bioficer.json';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));

if (d.groups.some(g => g.ship && g.ship.name === 'Genitor Tower')) {
  console.log('SKIP_ALREADY_PRESENT');
  process.exit(0);
}

// Template: an existing payload Cell (known-good shape).
const tmpl = d.groups.find(g => g.category === 'payload' && g.ship);
if (!tmpl) { console.log('FAIL_NO_PAYLOAD_TEMPLATE'); process.exit(1); }

const clone = JSON.parse(JSON.stringify(tmpl));

// Fresh id (keep format of existing ids: groups of 4 hex separated by '-').
function idLike(sample) {
  const n = (sample.match(/[0-9a-f]/gi) || []).length || 16;
  const hex = '0123456789abcdef';
  // deterministic-but-unique: derive from name so re-runs are stable
  let seed = 0; for (const c of 'Genitor Tower') seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  let out = '';
  for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) >>> 0; out += hex[seed & 15]; if (i % 4 === 3 && i < n - 1) out += '-'; }
  return out;
}
clone.id = idLike(tmpl.id || '0000-0000-0000-0000');
clone.category = 'payload';

const s = clone.ship;
s.name = 'Genitor Tower';
s.cost = 25;
// Static deployable tower: only a hull value (no thrust/scan/etc per the sheet).
s.stats = { hull: '8' };
s.weapons = [
  { name: 'Genitor Pod', arc: 'F', attack: '3', lock: '4+', damage: '1', type: 'K', special: 'Bombardment, Genitor' }
];
s.loads = [];
if ('loadoutOptions' in s) s.loadoutOptions = [];
if ('systemSelection' in s) s.systemSelection = null;
s.lore = s.lore && /genitor/i.test(s.lore) ? s.lore : '';
s.famousShips = []; s.famousShipsPrefix = ''; s.namesake = '';
if ('variants' in s) s.variants = [];
s.rulesText = s.rulesText || '';
s.groupMin = s.groupMin || 1;
s.groupMax = s.groupMax || (tmpl.ship.groupMax || 3);

d.groups.push(clone);

// Self-validate: re-serialize, re-parse, assert the new entry reads back clean.
const out = JSON.stringify(d);
const back = JSON.parse(out);
const added = back.groups.find(g => g.ship && g.ship.name === 'Genitor Tower');
const ok = added && added.category === 'payload' && added.ship.cost === 25 &&
  added.ship.stats.hull === '8' && added.ship.weapons.length === 1 &&
  added.ship.weapons[0].name === 'Genitor Pod' && added.ship.weapons[0].special === 'Bombardment, Genitor';
if (!ok) { console.log('FAIL_VALIDATION'); process.exit(1); }

fs.writeFileSync(path, out);
console.log('PASS_GENITOR_ADDED');
