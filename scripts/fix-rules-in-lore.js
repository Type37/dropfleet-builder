// Moves trailing rules sentences that got appended to the `lore` field into
// `rulesText` where they belong (so the always-visible Ship Rules block shows
// them, lore reads clean, and Feature-Carrier detection works).
// Run from repo root:  node scripts/fix-rules-in-lore.js
const fs = require('fs');
const FACTIONS = ['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'];

// A trailing sentence is "rules" if it has a points cost or names a build option.
const RULELIKE = /(\+\s?\d+\s?(pts|points))|Deployable Feature|Drive Augmentation|may replace its|This [Ss]hip may take/;

function splitSentences(text) {
  // split after a period (optionally preceded by a closing quote) + whitespace
  return text.split(/(?<=[.”"])\s+/).map(s => s.trim()).filter(Boolean);
}

let total = 0;
FACTIONS.forEach(fk => {
  const d = JSON.parse(fs.readFileSync(`data/faction-${fk}.json`, 'utf8'));
  let n = 0;
  (d.groups || []).forEach(g => {
    const s = g.ship;
    if (!s.lore) return;
    const sents = splitSentences(s.lore);
    const moved = [];
    while (sents.length && RULELIKE.test(sents[sents.length - 1])) moved.unshift(sents.pop());
    if (!moved.length) return;
    const rulesAdd = moved.join(' ').trim();
    s.lore = sents.join(' ').trim();
    s.rulesText = s.rulesText ? (rulesAdd + ' ' + s.rulesText) : rulesAdd;
    n++; total++;
  });
  if (n) { fs.writeFileSync(`data/faction-${fk}.json`, JSON.stringify(d)); console.log(`${fk}: ${n} ships`); }
});
console.log(`TOTAL: ${total}`);
