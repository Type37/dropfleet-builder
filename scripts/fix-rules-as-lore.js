// De-jumble: some ships have special-rule text mixed into their `lore` field
// (lore is NOT rules text). This works at SENTENCE level so it can:
//   - fully clear lore that is entirely a rule (e.g. Tally Cutter), and
//   - strip only the rule sentences from lore that mixes a rule with genuine
//     flavour (e.g. Voidgate = Open Network rule + real lore; Lysander = real
//     lore + Stealth Drop rule), keeping the genuine flavour intact.
//
// A sentence is treated as rule text if its normalized form is a contiguous
// substring of the ship's own special-rule corpus (each rule's name+description).
//
// Run from repo root:  node scripts/fix-rules-as-lore.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];
const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

let fullyCleared = 0, trimmed = 0;
FACTIONS.forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let changed = false;
  (d.groups || []).forEach(g => {
    const s = g.ship;
    if (!s.lore || !s.lore.trim()) return;
    const rules = (s.specialRules || []).filter(r => r.description);
    if (!rules.length) return;
    const corpus = rules.map(r => norm((r.name || '') + ' ' + r.description)).join('|');
    if (corpus.length < 25) return;

    const sentences = s.lore.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter(sent => {
      const sn = norm(sent);
      if (sn.length <= 20) return true;            // keep short/ambiguous bits
      return !corpus.includes(sn);                 // drop sentences that are rule text
    });
    // Only act when an actual rule sentence was removed; otherwise leave the lore
    // completely untouched (preserves verbatim text & \n\n paragraph breaks).
    if (kept.length === sentences.length) return;
    const newLore = kept.join(' ').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();

    if (norm(newLore).length < 25) {
      console.log(`  ${fk}: ${s.name} — CLEARED (all rules text)`);
      s.lore = '';
      fullyCleared++;
    } else {
      console.log(`  ${fk}: ${s.name} — TRIMMED rule text (${s.lore.length}→${newLore.length} chars)`);
      s.lore = newLore;
      trimmed++;
    }
    changed = true;
  });
  if (changed) fs.writeFileSync(path, JSON.stringify(d));
});
console.log(`\nCLEARED: ${fullyCleared} | TRIMMED: ${trimmed}`);
