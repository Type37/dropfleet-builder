// One-off: insert the verbatim "Close Protection" rule (§8.3.3.1) into
// data/fleet-index.json sharedRules, textually (preserves CRLF + 2-space indent,
// no JSON reflow). Verbatim rulebook wording, bold via <b> tags.
const fs = require('fs');
const p = 'data/fleet-index.json';
let raw = fs.readFileSync(p, 'utf8');

const anchor =
  '      "description": "This Weapon may only be fired at targets within Scan range and on the same Orbital Layer as the attacking Ship.",\r\n' +
  '      "page": "38"\r\n    },\r\n';

if (!raw.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
if (raw.includes('"Close Protection"')) { console.error('ALREADY PRESENT'); process.exit(1); }

const desc =
  '<b>After rolling Kinetic or Energy saves</b> against Close Action and Bomber (of any type) attacks, you may declare the use of any number of Fighters. Each Fighter used confers its re-rolls to a defending friendly Group within its Thrust range. The <b>defending player assigns all re-rolls</b> from each Fighter against specific weapons, dividing up Fighters as they choose. Shield and Backup saves cannot be re-rolled this way.\n<b>Once a Fighter has been used in this way, remove it.</b>';

const entry =
  '    "Close Protection": {\r\n' +
  '      "description": ' + JSON.stringify(desc) + ',\r\n' +
  '      "page": "22"\r\n    },\r\n';

raw = raw.replace(anchor, anchor + entry);
JSON.parse(raw); // validate
fs.writeFileSync(p, raw);
console.log('Inserted. JSON valid.');
console.log(JSON.stringify(JSON.parse(raw).sharedRules['Close Protection'], null, 1));
