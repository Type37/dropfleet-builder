// Targeted, hand-verified corrections for specific jumbled lore/famousShips
// entries the automated passes mis-split. Each case was inspected individually.
// Run from repo root:  node scripts/fix-lore-jumbles.js
const fs = require('fs');

function load(fk) { return JSON.parse(fs.readFileSync(`data/faction-${fk}.json`, 'utf8')); }
function save(fk, d) { fs.writeFileSync(`data/faction-${fk}.json`, JSON.stringify(d)); }
function ship(d, name) { const g = d.groups.find(g => g.ship.name === name); return g && g.ship; }

// Move the first word of lore onto the last famousShips entry (fixes two-word
// final names that were split, e.g. "Heaven’s Spear" -> "Heaven’s" + "Spear …").
function reuniteName(s) {
  const m = (s.lore || '').match(/^(\S+)\s+([\s\S]*)$/);
  if (!m) return;
  s.famousShips[s.famousShips.length - 1] += ' ' + m[1];
  s.lore = m[2];
}

let log = [];

// — Shaltari: two-word final names split —
{
  const d = load('shaltari');
  ['Painite Pocket Battleship', 'Thorium Super Battleship', 'Euclase Pocket Battleship', 'Natrolite Supercruiser']
    .forEach(n => { const s = ship(d, n); if (s) { reuniteName(s); log.push(`shaltari/${n}: ${s.famousShips.slice(-1)} | lore→ ${s.lore.slice(0, 30)}`); } });
  save('shaltari', d);
}

// — Scourge —
{
  const d = load('scourge');
  // Revenant: famous list collapsed to ["The"]; rebuild from the lore prefix.
  const rev = ship(d, 'Revenant Destroyer');
  if (rev) {
    rev.famousShips = ['The Four Horsemen (group of four vessels)', 'Greywolf'];
    rev.lore = (rev.lore || '').replace(/^Four Horsemen \(group of four vessels\),\s*Greywolf\s+/, '');
    log.push(`scourge/Revenant: ${JSON.stringify(rev.famousShips)} | lore→ ${rev.lore.slice(0, 30)}`);
  }
  // Cthulhu: "Scourge" is a prose fragment, not a ship name.
  const cth = ship(d, 'Cthulhu Dreadnought');
  if (cth && cth.famousShips) { cth.famousShips = cth.famousShips.filter(n => n !== 'Scourge'); log.push('scourge/Cthulhu: dropped bogus "Scourge"'); }
  // Hydra: launch-asset words leaked to the front of lore.
  const hyd = ship(d, 'Hydra Fleet Carrier');
  if (hyd) { hyd.lore = (hyd.lore || '').replace(/^The Hive,\s*Bombardier\s+/, ''); log.push('scourge/Hydra: stripped leading "The Hive, Bombardier"'); }
  save('scourge', d);
}

// — Resistance —
{
  const d = load('resistance');
  // Senator: "Dark Side of the Moon" split; stray tail dumped in lore.
  const sen = ship(d, 'Senator Battlecruiser');
  if (sen) {
    if (sen.famousShips && sen.famousShips[sen.famousShips.length - 1] === 'Dark') sen.famousShips[sen.famousShips.length - 1] = 'Dark Side of the Moon';
    sen.lore = (sen.lore || '').replace(/\s*\n+\s*Side of the Moon\s*$/, '');
    log.push('resistance/Senator: famous→ "Dark Side of the Moon"; trimmed lore tail');
  }
  // Seneca Detonator: badly scrambled — rebuild famous list + reflow prose.
  const sec = ship(d, 'Seneca Detonator');
  if (sec) {
    sec.famousShips = ['Surprise', 'Abra Kadabra', 'Boombox (Independents)', 'DS-1', 'DS-2 etc (Kalium, no prose names bestowed)'];
    sec.lore = "Though lacking in military resources, most fleets scattered by the Scourge invasion had a high proportion of merchantmen - rightly more likely to run than engage. Forced to be inventive, ragtag Resistance groups sought to repurpose civilian vessels to military ends. Haulers often make poor gun platforms but offer capacious internal holds. When combined with ‘repurposed’ shuttles, yachts and small transports, a formidable weapon can result: the Detonator, a hive of remote-operated, explosive-packed fire ships. The most common vessel is a Seneca class - unweildy and utilitarian, it offered pre-war traders the largest storage for the lowest cost, although many other patterns are in service in this unlikely role. Crewing a repurposed flimsy brick fizzing with improvised time bombs is not for the sane and/or skittish. These individuals are treated with wary respect when on shore leave, notable in the bar due to singed hair - if they’ve survived to douse their burns in booze. In the service of Kalium, Detonators are employed in an altogether more sinister, regimented fashion, which says a lot of how much the Kabal values flesh and blood.";
    log.push('resistance/Seneca: rebuilt famous list + reflowed lore');
  }
  save('resistance', d);
}

console.log(log.join('\n'));
console.log('\nDONE');
