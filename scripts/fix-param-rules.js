const fs = require('fs');

['ucm','scourge','phr','shaltari','resistance','bioficer'].forEach(fk => {
  const path = 'data/faction-' + fk + '.json';
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  let fixes = 0;

  (d.groups || []).forEach(g => {
    const special = g.ship.stats?.special || '';
    if (!special) return;

    // Parse stats.special into individual rules: "Shield-4+, Cloak-2" etc.
    const actualRules = {};
    special.split(/,\s*/).forEach(part => {
      const m = part.trim().match(/^(.+?)[\s-](\d+\+?)$/);
      if (m) {
        actualRules[m[1].trim()] = m[2];
      }
    });

    (g.ship.specialRules || []).forEach(r => {
      if (r.name.includes('-X')) {
        const base = r.name.replace(/-X$/, '');
        // Look for matching actual value
        for (const [ruleBase, val] of Object.entries(actualRules)) {
          if (ruleBase.toLowerCase() === base.toLowerCase() ||
              ruleBase.toLowerCase().startsWith(base.toLowerCase())) {
            const oldName = r.name;
            r.name = base + '-' + val;
            fixes++;
            console.log(`  ${fk}/${g.ship.name}: ${oldName} → ${r.name}`);
            break;
          }
        }
      }
    });
  });

  if (fixes > 0) {
    fs.writeFileSync(path, JSON.stringify(d));
    console.log(`${fk}: ${fixes} rules fixed\n`);
  }
});
