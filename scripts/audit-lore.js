// Read-only audit: flag jumbled lore / famousShips across all factions.
// Run from repo root:  node scripts/audit-lore.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

const RULES_BLEED = /(must take|options? from the|At the start of the game|Launch \d|This [Ss]hip may|Hardpoint|Systems list|before players deploy|counts as)/;

let flags = 0;
FACTIONS.forEach(fk => {
  const d = JSON.parse(fs.readFileSync(`data/faction-${fk}.json`, 'utf8'));
  const report = [];
  const checkShip = (label, s) => {
    const issues = [];
    const lore = s.lore || '';
    const fsArr = s.famousShips || [];
    // 1. prose stuck in famousShips
    fsArr.forEach(n => {
      const words = n.trim().split(/\s+/).length;
      if (words > 4 || n.length > 34) issues.push(`famousShips prose: "${n}"`);
      else if (/[.;]$/.test(n.trim()) || /^[a-z]/.test(n.trim())) issues.push(`famousShips odd: "${n}"`);
    });
    // 2. rules text bleeding into lore
    if (RULES_BLEED.test(lore)) issues.push(`rules-in-lore: "...${lore.match(RULES_BLEED)[0]}..."`);
    // 3. leftover "ships of the class" header inside lore
    if (/ships of the class:/i.test(lore)) issues.push('lore still has "ships of the class:" header');
    // 4. duplicated sentence (same 40-char run twice)
    const sents = lore.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 25);
    const seen = new Set();
    sents.forEach(x => { if (seen.has(x)) issues.push(`dup sentence: "${x.slice(0, 50)}..."`); seen.add(x); });
    // 5. mid-word/sentence truncation (ends without terminal punctuation and not empty)
    if (lore && !/[.!?"')\]]$/.test(lore.trim()) && lore.length > 20) issues.push(`no terminal punctuation: "...${lore.slice(-45)}"`);
    if (issues.length) { report.push(`  [${label}] ${s.name}`); issues.forEach(i => report.push(`      - ${i}`)); flags++; }
  };
  (d.groups || []).forEach(g => {
    checkShip('ship', g.ship);
    (g.ship.variants || []).forEach(v => { if (v.lore || v.famousShips) checkShip('variant', { name: g.ship.name + ' / ' + v.name, lore: v.lore, famousShips: v.famousShips ? (Array.isArray(v.famousShips) ? v.famousShips : String(v.famousShips).split(/,\s*/)) : [] }); });
  });
  if (report.length) { console.log(`\n### ${fk.toUpperCase()}`); console.log(report.join('\n')); }
});
console.log(`\nTOTAL flagged ships: ${flags}`);
