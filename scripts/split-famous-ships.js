const fs = require('fs');

const prefixRe = /((?:Famous|Infamous|Known|Encountered|Recorded|Noted|Only)\s+ships?\s+of\s+the\s+class:\s*)(.*)/is;

['ucm','scourge','phr','shaltari','resistance','bioficer'].forEach(fk => {
  const path = 'data/faction-' + fk + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  let fixes = 0;

  (data.groups || []).forEach(g => {
    // Reset any previous split
    delete g.ship.famousShipsPrefix;
    delete g.ship.famousShips;

    const fullLore = g.ship.lore || '';
    if (!fullLore) return;
    const m = fullLore.match(prefixRe);
    if (!m) return;

    const prefix = m[1].trim();
    const rest = m[2];

    // The pattern is: "ShipA, ShipB, ShipC LastShip The [ClassName] lore text..."
    // Ship names are comma-separated, but the LAST name runs directly into the
    // lore text. The lore typically starts with "The [Name]" where [Name] is the
    // ship class being described.
    //
    // Strategy: find " The " followed by a capital letter that starts a sentence
    // about the ship class. Then the last ship name is everything between the
    // last comma and " The ".

    const loreSplit = rest.search(/ The [A-Z][a-z]/);
    if (loreSplit < 0) {
      // No clear split point — try other patterns
      const altSplit = rest.search(/ (?:Although|Despite|Unlike|Pre-war|Due to|One issue|Generally|Kalium|While the|In 2679|This)/);
      if (altSplit > 0) {
        const namesStr = rest.substring(0, altSplit).trim();
        const loreBody = rest.substring(altSplit).trim();
        g.ship.famousShipsPrefix = prefix;
        g.ship.famousShips = namesStr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
        g.ship.lore = loreBody;
        fixes++;
      }
      return;
    }

    const namesStr = rest.substring(0, loreSplit).trim();
    const loreBody = rest.substring(loreSplit + 1).trim(); // +1 to skip the leading space

    const rawNames = namesStr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
    // Safety: if any "ship name" is > 30 chars, it's lore bleed — truncate the list
    const cleanNames = [];
    for (const n of rawNames) {
      if (n.length > 30) break;
      cleanNames.push(n);
    }
    if (cleanNames.length === 0) return;

    g.ship.famousShipsPrefix = prefix;
    g.ship.famousShips = cleanNames;
    g.ship.lore = loreBody;
    fixes++;
  });

  if (fixes > 0) {
    fs.writeFileSync(path, JSON.stringify(data));
    console.log(fk + ': ' + fixes + ' ships split');
  }
});

// Verify a few
['ucm','shaltari'].forEach(fk => {
  const data = JSON.parse(fs.readFileSync('data/faction-' + fk + '.json', 'utf8'));
  const checks = fk === 'ucm' ? ['Santiago','Berlin','Toulon'] : ['Cerium','Obsidian'];
  checks.forEach(name => {
    const g = data.groups.find(g => g.ship.name.includes(name));
    if (g && g.ship.famousShips) {
      console.log(`  ${fk}/${g.ship.name}: ships=[${g.ship.famousShips.join(', ')}] lore=${g.ship.lore.substring(0,50)}...`);
    }
  });
});
