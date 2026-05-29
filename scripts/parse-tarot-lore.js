// Parses lore prose out of the user's neocities Tarot card HTML pages.
// Each card "back" face has a `.btn-tiny` ship name ("Agamemnon — Battlecruiser")
// and one or more `.blore` prose paragraphs. We also grab the etymology
// ("Namesake") if present. Output: JSON array of {name, lore}.
// Usage: node scripts/parse-tarot-lore.js <html-file> > out.json
const fs = require('fs');

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

// Split into back-face chunks (each card's lore lives in one .face.back block).
const chunks = html.split(/<div class="face back"/).slice(1);
const out = [];
chunks.forEach(chunk => {
  const nameM = chunk.match(/class="btn(?:-tiny)?"[^>]*>([^<]+)</);
  if (!nameM) return;
  let rawName = stripTags(nameM[1]);
  // "Agamemnon — Battlecruiser" -> "Agamemnon"
  const name = rawName.split(/\s+[—-]\s+/)[0].trim();

  const loreParts = [];
  const loreRe = /<div class="blore"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = loreRe.exec(chunk)) !== null) {
    const t = stripTags(m[1]);
    if (t) loreParts.push(t);
  }
  if (loreParts.length === 0) return;

  out.push({ name, lore: loreParts.join('\n\n') });
});

console.log(JSON.stringify(out, null, 1));
