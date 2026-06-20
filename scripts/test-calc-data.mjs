/* Validates js/calc-data.js (Jafdy's SaveString codec + create_target/create_weapon)
   against his preset tables (round-trip) and the published matchup averages.
   Run: node scripts/test-calc-data.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
(0, eval)(fs.readFileSync(path.join(root, 'js', 'calc-engine.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(root, 'js', 'calc-data.js'), 'utf8'));
const D = globalThis.DFCData, C = globalThis.DFCCalc;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; if (fails.length < 30) fails.push(n + (d ? ' :: ' + d : '')); } };

// 1. round-trip every target code: import -> export == code
for (const [name, code] of Object.entries(D.target_coded)) {
  const imp = D.importTarget(code);
  ok('target import ' + name, imp !== false, 'code ' + code);
  if (imp) { const re = D.exportTarget(imp[0], imp[1]); ok('target roundtrip ' + name, re === code, `${code} -> ${re}`); }
}
// 2. round-trip every weapon code.
// Known-malformed codes in Jafdy's own table that HIS import_weapon also rejects
// (verified against the reference). We assert we reject them identically.
const KNOWN_BAD = new Set(['accee2']); // Dredger Mining Laser
for (const [name, code] of Object.entries(D.weapon_coded)) {
  const imp = D.importWeapon(code);
  if (KNOWN_BAD.has(code)) { ok('weapon faithfully-rejects ' + name, imp === false, code); continue; }
  ok('weapon import ' + name, imp !== false, 'code ' + code);
  if (imp) { const re = D.exportWeapon(imp[0], imp[1]); ok('weapon roundtrip ' + name, re === code, `${code} -> ${re}`); }
}

// 3. config-code spec test: PHR Medium Cruiser + Heavy Calibre Broadside == "2-aaddarC"
{
  const at = D.importTarget('2'), w = D.importWeapon('aaddarC');
  const code = D.exports(at, [w]);
  ok('AT7 exports == 2-aaddarC', code === '2-aaddarC', code);
}

// 4. matchup averages (reference exact values)
function matchup(weaponName, targetName) {
  const [atk, pt] = D.importTarget(D.target_coded[targetName]);
  const [wsit, pw] = D.importWeapon(D.weapon_coded[weaponName]);
  const T = D.createTarget(pt, atk);
  const W = D.createWeapon(pw, pt, atk, wsit);
  const A = new C.Attack(W, T).run();
  return A.average_result.toString();
}
ok('PHR HCB vs PHR Med Cruiser avg', matchup('PHR Heavy Calibre Broadside', 'PHR Medium Cruiser') === '3/2', matchup('PHR Heavy Calibre Broadside', 'PHR Medium Cruiser'));
ok('PHR Energy Glaive Battery vs Scourge Heavy Cruiser avg', matchup('PHR Energy Glaive Battery', 'Scourge Heavy Cruiser') === '4', matchup('PHR Energy Glaive Battery', 'Scourge Heavy Cruiser'));
ok('UCM Cobra Heavy Laser vs PHR Battleship avg', matchup('UCM Cobra Heavy Laser', 'PHR Battleship') === '752/729', matchup('UCM Cobra Heavy Laser', 'PHR Battleship'));

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (fail) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('Data/codec layer matches Jafdy reference.');
