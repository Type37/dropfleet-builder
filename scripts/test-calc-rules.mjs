/* Validates the rules layer (createTarget / buildWeapons) in js/calc-engine.js
   against the reference Data_Module create_target / create_weapon.
   Run: node scripts/test-calc-rules.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'calc-engine.js'), 'utf8');
(0, eval)(src);
const { createTarget, buildWeapons } = globalThis.DFCCalc;

const oracle = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'calc-rules-oracle.json'), 'utf8'));
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b) { if (a === b) pass++; else { fail++; if (fails.length < 25) fails.push(`${name}: got ${a} want ${b}`); } }

let i = 0;
for (const c of oracle) {
  i++;
  // calibre may be null, a single letter, or a list — buildWeapons expects a list
  const cal = c.pw.calibre == null ? [] : (Array.isArray(c.pw.calibre) ? c.pw.calibre : [c.pw.calibre]);
  const pw = Object.assign({}, c.pw, { calibre: cal });
  const T = createTarget(c.base, c.sit);
  eq(`#${i} T.ES`, T.ES, c.target.ES);
  eq(`#${i} T.KS`, T.KS, c.target.KS);
  eq(`#${i} T.BS`, T.BS, c.target.BS);
  eq(`#${i} T.aegis`, T.aegis, c.target.aegis);
  eq(`#${i} T.fighters`, T.fighters, c.target.fighters);
  eq(`#${i} T.reinforced`, T.reinforced, c.target.reinforced ? 1 : 0);

  const Ws = buildWeapons(pw, c.base, c.sit, c.wsit);
  eq(`#${i} nweapons`, Ws.length, c.nweapons);
  const w = Ws[0], ref = c.weapon0;
  eq(`#${i} w.attack`, w.attack, ref.attack);
  eq(`#${i} w.lock`, w.lock, ref.lock);
  eq(`#${i} w.damage`, w.damage, ref.damage);
  eq(`#${i} w.dtype`, w.damage_type, ref.damage_type);
  eq(`#${i} w.burn`, w.burnthrough, ref.burnthrough);
  eq(`#${i} w.reave`, w.reave, ref.reave);
  eq(`#${i} w.critical`, w.critical, ref.critical);
  eq(`#${i} w.scald`, w.scald, ref.scald);
  eq(`#${i} w.penetrator`, w.penetrator, ref.penetrator);
  eq(`#${i} w.crippling`, w.crippling, ref.crippling);
  eq(`#${i} w.caw`, w.caw, ref.caw);
  eq(`#${i} w.skipped`, w.skipped_save, ref.skipped_save);
  eq(`#${i} w.telescope`, w.telescope, ref.telescope ? 1 : 0);
}
console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (fail) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('Rules layer matches reference.');
