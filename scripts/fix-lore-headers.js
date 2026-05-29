// Fixes ships whose famous-ships list is still embedded in the `lore` field as
// "Recorded ships of the class: A, B, C LastName <prose...>" (famousShips null).
// Splits the names out (peeling the glued boundary name) and leaves clean lore.
// Run from repo root:  node scripts/fix-lore-headers.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

const PREFIX_RE = /^((?:Famous|Infamous|Known|Encountered|Recorded|Noted|Only)\s+ships?\s+of\s+the\s+class:\s*)([\s\S]*)$/i;

function isProse(s) {
  const words = s.trim().split(/\s+/).length;
  return words > 4 || s.length > 34;
}
function peelName(s) {
  // Boundary segment is "LastName <prose>". Real glued last-names are almost
  // always a single token (or "Name (Faction)"); the prose that follows often
  // starts with a capital, so we must NOT greedily grab a second word.
  const paren = s.match(/^(.*?\([^)]*\))\s+(.*)$/);      // "Name (Faction) <prose>"
  if (paren) return { name: paren[1].trim(), prose: paren[2].trim() };
  const one = s.match(/^(\S+)\s+(.*)$/);                 // single leading token as the name
  if (one && /^[A-Z“"']/.test(one[1])) return { name: one[1].trim(), prose: one[2].trim() };
  return { name: '', prose: s.trim() };
}

let total = 0;
FACTIONS.forEach(fk => {
  const path = `data/faction-${fk}.json`;
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let n = 0;
  (d.groups || []).forEach(g => {
    const s = g.ship;
    if (s.famousShips && s.famousShips.length) return;     // already has structured names
    const m = (s.lore || '').match(PREFIX_RE);
    if (!m) return;
    const prefix = m[1].trim();
    const segs = m[2].split(/,\s*/).map(x => x.trim()).filter(Boolean);
    const boundary = segs.findIndex(isProse);
    if (boundary < 0) return;                               // no prose tail — skip (all names? unlikely)
    const names = segs.slice(0, boundary);
    const tail = segs.slice(boundary);
    const { name, prose } = peelName(tail[0]);
    if (name) names.push(name);
    tail[0] = prose;
    const loreText = tail.filter(Boolean).join(', ').trim();
    if (names.length) { s.famousShips = names; s.famousShipsPrefix = prefix; }
    s.lore = loreText;
    n++; total++;
  });
  if (n) { fs.writeFileSync(path, JSON.stringify(d)); console.log(`${fk}: ${n} fixed`); }
});
console.log(`TOTAL: ${total}`);
