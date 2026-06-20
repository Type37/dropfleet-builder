/* Validates js/calc-engine.js against the reference Python engine.
   Run: node scripts/test-calc-engine.mjs
   Oracle: scripts/calc-oracle.json (exact fractions from the reference). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// load the (non-module) engine into this realm
const src = fs.readFileSync(path.join(root, 'js', 'calc-engine.js'), 'utf8');
(0, eval)(src);
const { Fr, Target, Weapon, Attack } = globalThis.DFCCalc;

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) { if (cond) pass++; else { fail++; fails.push(name + (detail ? ' :: ' + detail : '')); } }

function mkTarget(t) {
  return new Target(t.energy_save, t.kinetic_save, t.backup_save ?? 7, t.shield_save ?? 7, t.aegis ?? 0, t.fighters ?? 0, t.reinforced ?? false);
}
function mkWeapon(w) {
  return new Weapon(w.attack, w.lock, w.damage, w.damage_type, w.burnthrough, w.reave, w.critical, w.scald, w.penetrator, w.crippling, w.caw, w.skipped_save, w.telescope);
}
function distEq(got, want) {
  // trailing zeros may differ in length; compare up to max length, padding with 0
  const n = Math.max(got.length, want.length);
  for (let i = 0; i < n; i++) {
    const g = got[i] ? got[i].toString() : '0';
    const wv = want[i] !== undefined ? want[i] : '0';
    if (g !== wv) return `idx ${i}: got ${g} want ${wv}`;
  }
  return null;
}

// ---- published acceptance tests ----
(function acceptance() {
  let A = new Attack([new Weapon(4, 3, 1, 'E')], mkTarget({ energy_save: 7, kinetic_save: 7 })).run();
  check('AT1 avg', A.average_result.toString() === '8/3', A.average_result.toString());
  A = new Attack([new Weapon(4, 3, 1, 'E')], mkTarget({ energy_save: 4, kinetic_save: 4 })).run();
  check('AT2 avg', A.average_result.toString() === '4/3', A.average_result.toString());
})();

// ---- oracle diff ----
const oracle = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'calc-oracle.json'), 'utf8'));
let ci = 0;
for (const c of oracle) {
  ci++;
  let A;
  try {
    A = new Attack(c.weapons.map(mkWeapon), mkTarget(c.target)).run();
  } catch (e) {
    check('case ' + ci + ' threw', false, e.message);
    continue;
  }
  check('case ' + ci + ' avg', A.average_result.toString() === c.avg, `got ${A.average_result.toString()} want ${c.avg}`);
  const de = distEq(A.summed_result, c.dist);
  check('case ' + ci + ' dist', de === null, de);
  const ce = distEq(A.cumulative_result, c.cum);
  check('case ' + ci + ' cum', ce === null, ce);
  const crip = distEq(A.cripple_results, c.cripple);
  check('case ' + ci + ' cripple', crip === null, crip);
  const ind = distEq(A.individual_averages, c.indiv);
  check('case ' + ci + ' indiv', ind === null, ind);
  const ssum = A.summed_result.reduce((acc, x) => acc.add(x), new Fr(0n, 1n));
  check('case ' + ci + ' sums-to-1', ssum.toString() === '1', ssum.toString());
}

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (fail) { console.log('First failures:'); fails.slice(0, 25).forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('All checks passed.');
