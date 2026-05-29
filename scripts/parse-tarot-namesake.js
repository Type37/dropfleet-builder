// Extracts the "Namesake" etymology flavour text (.betym-txt) from Tarot cards.
// Usage: node scripts/parse-tarot-namesake.js <html> > out.json
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
function strip(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
const chunks = html.split(/<div class="face back"/).slice(1);
const out = [];
chunks.forEach(chunk => {
  const nameM = chunk.match(/class="btn(?:-tiny)?"[^>]*>([^<]+)</);
  if (!nameM) return;
  const name = strip(nameM[1]).split(/\s+[—-]\s+/)[0].trim();
  const etym = chunk.match(/<div class="betym-txt"[^>]*>([\s\S]*?)<\/div>/);
  if (etym) {
    const namesake = strip(etym[1]);
    if (namesake) out.push({ name, namesake });
  }
});
console.log(JSON.stringify(out, null, 1));
