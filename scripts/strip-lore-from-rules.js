// Remove narrative lore that got concatenated into ships' rulesText (lore is not
// a ship rule — it lives in the `lore` field). For each ship whose rulesText
// contains its lore (normalized match), excise exactly that span, leaving only
// the real rules. Run from repo root: node scripts/strip-lore-from-rules.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];
const normCh = c => c.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

// Build normalized string + map of normalized-index -> raw-index.
function normMap(raw) {
  let norm = ''; const map = [];
  for (let i = 0; i < raw.length; i++) {
    const n = normCh(raw[i]);
    if (n) { norm += n; for (let k = 0; k < n.length; k++) map.push(i); }
  }
  return { norm, map };
}

let fixed = 0;
FACTIONS.forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let changed = false;
  (d.groups || []).forEach(g => {
    const s = g.ship;
    if (!s.rulesText || !s.lore || !s.lore.trim()) return;
    const loreNorm = normCh(s.lore) ? s.lore.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '') : '';
    if (loreNorm.length < 20) return;
    const { norm, map } = normMap(s.rulesText);
    const at = norm.indexOf(loreNorm);
    if (at < 0) return;
    const rawStart = map[at];
    const rawEnd = (at + loreNorm.length < map.length) ? map[at + loreNorm.length] : s.rulesText.length;
    const before = s.rulesText.slice(0, rawStart);
    const after = s.rulesText.slice(rawEnd);
    let newRules = (before + after).replace(/\s{2,}/g, ' ').replace(/^[\s.,;:—-]+/, '').trim();
    console.log(`  ${fk}: ${s.name} — rulesText ${s.rulesText.length}→${newRules.length} chars`);
    s.rulesText = newRules;
    changed = true; fixed++;
  });
  if (changed) fs.writeFileSync(path, JSON.stringify(d));
});
console.log(`\nTOTAL fixed: ${fixed}`);
