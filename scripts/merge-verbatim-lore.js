// Merge verbatim ship lore extracted from the official Combined Fleet Stats /
// Civilian / Misc PDFs (scripts/_pdftext/lore-*.json) into the faction JSONs.
//
// Every non-null lore string is VERIFIED before merging: its normalized form
// (lowercase, alphanumerics only) must appear as a substring of the normalized
// source-PDF text. This guarantees we only write text that is actually present
// verbatim in the source — anything paraphrased or invented fails the check and
// is skipped (and reported).
//
// Shared auxiliary/mercenary ships (Civilian + Misc) are applied to EVERY
// faction that currently has that ship with empty lore. Faction-specific lore
// is applied only to its own faction.
//
// Run from repo root:  node scripts/merge-verbatim-lore.js
const fs = require('fs');
const path = require('path');

const PT = 'scripts/_pdftext';
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

// lore-*.json file  ->  source text file used to verify it
const SOURCES = {
  ucm:        'UCM_Combined_Fleet_Stats_260327.txt',
  scourge:    'Scourge_Combined_Fleet_Stats_260327.txt',
  phr:        'PHR_Combined_Fleet_Stats_260429.txt',
  shaltari:   'Shaltari_Combined_Fleet_Stats_260327.txt',
  resistance: 'Resistance_Combined_Fleet_Stats_260327.txt',
  bioficer:   'Bioficer_Combined_Fleet_Stats_260429.txt',
  civilian:   'Civilian_Ships_Scenarios_260501.txt',
  misc:       'Misc_Combined_Ship_Stats_250822.txt',
};
// which lore files are shared across all factions vs faction-specific
const SHARED_KEYS = ['civilian', 'misc'];
const FACTION_KEYS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

// Build ONE combined corpus of every source PDF's text. A lore string counts as
// verbatim if it appears in ANY official source — this guards against fabrication
// while tolerating the extractor filing a ship under the wrong source file
// (e.g. Somniferum is in Civilian, KNC ships are in Misc).
const corpusNorm = Object.values(SOURCES)
  .map(f => norm(fs.readFileSync(path.join(PT, f), 'utf8')))
  .join('');

// Load + verify every lore-*.json against the combined corpus.
const verified = {};   // key -> [{name, lore}]
let totalOk = 0, totalFail = 0, totalNull = 0;
for (const key of Object.keys(SOURCES)) {
  const lorePath = path.join(PT, `lore-${key}.json`);
  if (!fs.existsSync(lorePath)) { console.log(`(skip ${key}: no ${lorePath})`); continue; }
  const entries = JSON.parse(fs.readFileSync(lorePath, 'utf8'));
  const srcNorm = corpusNorm;
  verified[key] = [];
  for (const e of entries) {
    if (!e.lore) { totalNull++; continue; }
    const ln = norm(e.lore);
    if (srcNorm.includes(ln)) { verified[key].push(e); totalOk++; }
    else {
      totalFail++;
      // find the longest matching prefix to locate where it diverges
      let lo = 0, hi = ln.length;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (srcNorm.includes(ln.slice(0, mid))) lo = mid; else hi = mid - 1; }
      console.log(`  ✗ VERIFY FAIL [${key}] ${e.name} — diverges after ~${lo}/${ln.length} chars: "...${e.lore.slice(Math.max(0, Math.round(lo * e.lore.length / ln.length) - 30), Math.round(lo * e.lore.length / ln.length) + 30)}..."`);
    }
  }
}
console.log(`\nVerification: ${totalOk} verbatim-OK, ${totalFail} FAILED, ${totalNull} null/skipped\n`);

// Build the shared-aux name->lore map (applies to all factions).
const sharedMap = {};
for (const k of SHARED_KEYS) for (const e of (verified[k] || [])) sharedMap[e.name] = e.lore;

// Merge into each faction file.
let applied = 0, notFound = 0;
for (const fk of FACTIONS) {
  const fp = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  // faction-specific map for this faction (if present)
  const factionMap = {};
  for (const e of (verified[fk] || [])) factionMap[e.name] = e.lore;
  let n = 0;
  for (const g of (d.groups || [])) {
    const s = g.ship;
    if (s.lore && s.lore.trim()) continue;           // never overwrite existing lore
    const lore = factionMap[s.name] || sharedMap[s.name];
    if (lore) { s.lore = lore; n++; applied++; }
  }
  fs.writeFileSync(fp, JSON.stringify(d));
  console.log(`${fk}: ${n} lore entries applied`);
}
console.log(`\nTOTAL applied across factions: ${applied}`);
