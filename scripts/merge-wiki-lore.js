// Merge community-wiki lore (fetched verbatim as raw wikitext into
// scripts/_pdftext/wikilore-*.json) into faction JSONs for ships that have NO
// lore in the official PDFs. Strips wiki markup ([[link|text]] etc.) while
// preserving the prose exactly. Only fills EMPTY lore — never overwrites.
//
// Run from repo root:  node scripts/merge-wiki-lore.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari'];

function stripWiki(s) {
  return (s || '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')   // [[Target|Display]] -> Display
    .replace(/\[\[([^\]]*)\]\]/g, '$1')             // [[Target]] -> Target
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

let applied = 0, skippedHadLore = 0, residualMarkup = 0;
FACTIONS.forEach(fk => {
  const wp = `scripts/_pdftext/wikilore-${fk}.json`;
  if (!fs.existsSync(wp)) { console.log(`(no ${wp})`); return; }
  const wiki = JSON.parse(fs.readFileSync(wp, 'utf8'));
  const map = {};
  wiki.forEach(e => { if (e.found && e.lore && e.lore.trim()) map[e.name] = stripWiki(e.lore); });

  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let n = 0;
  (d.groups || []).forEach(g => {
    const s = g.ship;
    if (!map[s.name]) return;
    if (s.lore && s.lore.trim()) { skippedHadLore++; return; }   // never overwrite
    const lore = map[s.name];
    if (/\[\[|\]\]|\{\{|<ref/i.test(lore)) { console.log(`  ! residual markup in ${fk}/${s.name}`); residualMarkup++; }
    s.lore = lore;
    n++; applied++;
  });
  fs.writeFileSync(path, JSON.stringify(d));
  console.log(`${fk}: ${n} wiki lore entries applied`);
});
console.log(`\nTOTAL applied: ${applied} | skipped (already had lore): ${skippedHadLore} | residual-markup warnings: ${residualMarkup}`);
