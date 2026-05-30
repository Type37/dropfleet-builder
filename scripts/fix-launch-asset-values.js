// Correct launch-asset stat profiles against the Combined Fleet Stats PDFs.
// The BSData conversion dropped/garbled some specials and damage TYPES. Each fix
// below was verified against the faction's PDF asset table.
// Run from repo root: node scripts/fix-launch-asset-values.js
const fs = require('fs');

// faction -> assetName -> { field: value } overrides
const FIX = {
  ucm: {
    'Light Torpedo':  { special: 'Penetrator' },
    'Medium Torpedo': { special: 'Penetrator' },
    'Heavy Torpedo':  { special: 'Penetrator' },
    'Heavy Bombers':  { special: 'Calibre-H/C, Penetrator' },
  },
  scourge: {
    'Torpedo':  { special: 'Corruptor-2, Crippling-Fire' },
    'Bombers':  { special: 'Crippling-Fire' },
    'Mines':    { special: 'Corruptor-1' },
  },
  phr: {
    'Torpedo':  { special: 'Penetrator' },
  },
  shaltari: {
    'Torpedo':      { type: 'C', special: 'Flash-2' },
    'Bombers':      { type: 'E' },
    'Mines':        { type: 'E' },
    'Impel Mines':  { type: 'E', special: 'Arrest-4, Impel-1' },
  },
  resistance: {
    'Torpedo':     { special: 'Penetrator' },
    'Fire Ships':  { type: 'E' },
  },
};

let total = 0;
Object.entries(FIX).forEach(([fk, fixes]) => {
  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let n = 0;
  (d.launchAssets || []).forEach(grp => (grp.assets || []).forEach(a => {
    const fix = fixes[a.name];
    if (!fix) return;
    Object.entries(fix).forEach(([k, v]) => {
      if (a[k] !== v) { console.log(`  ${fk}: ${a.name}.${k} "${a[k]}" -> "${v}"`); a[k] = v; n++; total++; }
    });
  }));
  if (n) fs.writeFileSync(path, JSON.stringify(d));
  console.log(`${fk}: ${n} field(s) corrected`);
});
console.log(`\nTOTAL corrections: ${total}`);
