// One-shot data fix: the Pungari Thresher's Subservient Mercenaries rule says it
// "always uses Shaltari Fire Ships". Launch-asset stats are resolved by NAME from
// each faction's launchAssets, so a generic "Fire Ships" load shows no stats in
// UCM/PHR/Scourge/Bioficer and the WRONG stats in Resistance (which has its own
// Fire Ships ship card). Fix, in every faction the Pungari appears in, by:
//   1) renaming the Pungari's load to "Shaltari Fire Ships", and
//   2) adding a "Shaltari Fire Ships" ship card (7" 4 5+ 1 K) to launchAssets.
// Targeted string surgery preserves the files' \u escaping + CRLF formatting.
const fs = require('fs');
const facs = ['ucm', 'phr', 'scourge', 'shaltari', 'resistance', 'bioficer'];
const ASSET =
  '\r\n    {' +
  '\r\n     "name": "Shaltari Fire Ships",' +
  '\r\n     "thrust": "7\\"",' +
  '\r\n     "attack": "4",' +
  '\r\n     "lock": "5+",' +
  '\r\n     "damage": "1",' +
  '\r\n     "type": "K",' +
  '\r\n     "special": "-"' +
  '\r\n    },';

for (const f of facs) {
  const p = 'data/faction-' + f + '.json';
  let s = fs.readFileSync(p, 'utf8');

  // 1) Rename the Pungari's Fire Ships load (scoped: between the ship name and its specialRules).
  const pIdx = s.indexOf('"Pungari Thresher Hive Ship"');
  if (pIdx < 0) { console.log(f.padEnd(11), 'NO PUNGARI - skip'); continue; }
  const srIdx = s.indexOf('"specialRules"', pIdx);
  const win = s.slice(pIdx, srIdx);
  const cnt = (win.match(/"name": "Fire Ships"/g) || []).length;
  if (cnt === 1) {
    s = s.slice(0, pIdx) + win.replace('"name": "Fire Ships"', '"name": "Shaltari Fire Ships"') + s.slice(srIdx);
  } else if (win.includes('"name": "Shaltari Fire Ships"')) {
    // already renamed
  } else {
    console.log(f.padEnd(11), 'unexpected Fire Ships count', cnt, '- ABORT'); continue;
  }

  // 2) Add the Shaltari Fire Ships ship card to launchAssets (idempotent).
  const laIdx = s.indexOf('"launchAssets"');
  const assetsIdx = s.indexOf('"assets": [', laIdx);
  if (assetsIdx < 0) { console.log(f.padEnd(11), 'NO assets array - ABORT'); continue; }
  if (!s.includes('"name": "Shaltari Fire Ships",\r\n     "thrust"')) {
    const insertAt = assetsIdx + '"assets": ['.length;
    s = s.slice(0, insertAt) + ASSET + s.slice(insertAt);
  }

  JSON.parse(s); // validate
  fs.writeFileSync(p, s);
  console.log(f.padEnd(11), 'OK');
}
