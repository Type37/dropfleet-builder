const fs = require('fs');

// Patterns that indicate rules text (not lore)
const rulesPatterns = [
  /^At the start of the game/i,
  /^This Ship may take/i,
  /^This Ship may be used/i,
  /^This Ship must take/i,
  /^This ship may replace/i,
  /^This Admiral may take/i,
  /^While this Flagship/i,
  /^An admiral assigned/i,
  /^When this Group/i,
  /^Before or after this Group/i,
  /^In 2679/i,  // Bioficer dreadnought lore starts this way - NOT a rule
  /^Laser Refit/i,
  /^Drive Refit/i,
  /^Cloaking/i,
  /^Stealth Drop/i,
];

// Patterns that indicate the start of actual lore (after rules text)
const loreStartPatterns = [
  /(?:Famous|Infamous|Known|Encountered|Recorded|Noted|Only) ships? of the class:/i,
  /The [A-Z][a-z]+ (?:class|is|was|shares|carries|emerged|has)/,
  /(?:Thankfully|Although|Pre-war|Due to|One issue|Generally|Kalium|While the|Hyperyacht)/,
];

let totalFixed = 0;

['ucm', 'scourge', 'phr', 'shaltari', 'resistance', 'bioficer'].forEach(fk => {
  const path = 'data/faction-' + fk + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  let fixes = 0;

  (data.groups || []).forEach(g => {
    const lore = g.ship.lore || '';
    if (!lore) return;

    // Check if lore starts with rules text
    const startsWithRules = rulesPatterns.some(p => p.test(lore));
    if (!startsWithRules) return;

    // Try to find where lore actually starts
    let loreStart = -1;
    for (const p of loreStartPatterns) {
      const m = lore.search(p);
      if (m > 0) {
        loreStart = m;
        break;
      }
    }

    if (loreStart > 0) {
      const rulesText = lore.substring(0, loreStart).trim();
      const loreText = lore.substring(loreStart).trim();

      // Store rules text separately, keep only lore
      if (!g.ship.rulesText) g.ship.rulesText = '';
      g.ship.rulesText = (g.ship.rulesText ? g.ship.rulesText + ' ' : '') + rulesText;
      g.ship.lore = loreText;
      fixes++;
      console.log(`  ${fk}/${g.ship.name}: split at ${loreStart} (rules: ${rulesText.substring(0, 50)}...)`);
    } else {
      // All rules, no lore detected — move everything to rulesText
      g.ship.rulesText = lore;
      g.ship.lore = '';
      fixes++;
      console.log(`  ${fk}/${g.ship.name}: all rules, no lore`);
    }
  });

  if (fixes > 0) {
    fs.writeFileSync(path, JSON.stringify(data));
    console.log(`${fk}: ${fixes} ships fixed\n`);
    totalFixed += fixes;
  }
});

console.log(`Total: ${totalFixed} ships had rules separated from lore`);
