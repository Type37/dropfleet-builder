// Audit: which ships in the converted faction JSON do NOT appear in the official
// TTCombat stat PDFs? These are "extra" entries that came from BSData but aren't
// in the published Combined Fleet Stats / Misc / Civilian sheets — worth surfacing
// so we can decide whether to keep, flag, or hide them.
//
// Matching is by ship name against the (normalized) text of the faction's own
// stat PDF plus the shared Misc + Civilian sheets. Run from repo root:
//   node scripts/audit-extra-ships.js
const fs = require('fs');
const PT = 'scripts/_pdftext';

const FACTION_PDF = {
  ucm:        'UCM_Combined_Fleet_Stats_260327.txt',
  scourge:    'Scourge_Combined_Fleet_Stats_260327.txt',
  phr:        'PHR_Combined_Fleet_Stats_260429.txt',
  shaltari:   'Shaltari_Combined_Fleet_Stats_260327.txt',
  resistance: 'Resistance_Combined_Fleet_Stats_260327.txt',
  bioficer:   'Bioficer_Combined_Fleet_Stats_260429.txt',
};
const SHARED = ['Misc_Combined_Ship_Stats_250822.txt', 'Civilian_Ships_Scenarios_260501.txt'];

const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const read = f => { try { return norm(fs.readFileSync(`${PT}/${f}`, 'utf8')); } catch { return ''; } };

const sharedText = SHARED.map(read).join('');

// PDF text is reflowed (name, points and type get separated), so contiguous
// full-name matching is unreliable. Instead key on the ship's DISTINCTIVE
// proper-noun token — the class name (e.g. "Venice", "Cobalt", "San Francisco").
// That token is unique per ship and survives reflow.
const COMMON_PREFIX = /^(new|san|las|hong|old|yi|guy|el|le|de|the)$/;
function nameKeys(name) {
  // Take the leading proper-noun words before the tonnage/role descriptor.
  const words = name.split(/\s+/);
  let head = words[0];
  // Multi-word proper nouns: "San Francisco", "New York", "Hong Kong",
  // "Yi Sun-sin", "Guy Fawkes", "Las Vegas", "New Mombasa"...
  if (COMMON_PREFIX.test(head.toLowerCase()) && words[1]) head = words[0] + words[1];
  return [norm(head)].filter(k => k.length >= 3);
}

let grandExtra = 0;
Object.entries(FACTION_PDF).forEach(([fk, pdf]) => {
  const factionText = read(pdf) + sharedText;
  const d = JSON.parse(fs.readFileSync(`data/faction-${fk}.json`, 'utf8'));
  const extras = [];
  const check = (name, label) => {
    const keys = nameKeys(name);
    const found = keys.some(k => k.length >= 3 && factionText.includes(k));
    if (!found) extras.push(`${label}${name}`);
  };
  (d.groups || []).forEach(g => {
    check(g.ship.name, '');
    (g.ship.variants || []).forEach(v => check(v.name, `  ↳ variant: `));
  });
  if (extras.length) {
    console.log(`\n### ${fk.toUpperCase()} — ${extras.length} not found in official PDFs`);
    extras.forEach(e => console.log(`  - ${e}`));
    grandExtra += extras.length;
  } else {
    console.log(`\n### ${fk.toUpperCase()} — all ships present in official PDFs ✓`);
  }
});
console.log(`\nTOTAL extra/unmatched: ${grandExtra}`);
