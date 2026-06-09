// One-off: add the specific Crippling Effect entries (verbatim, rulebook §7.3.6,
// printed p19) that the four Crippling-* weapon keywords reference, so tapping
// e.g. "Crippling-Fire" on a weapon shows what the Fire effect does instead of
// falling back to the generic Crippling-X. Textual insert (preserve CRLF/indent).
const fs = require('fs');
const p = 'data/fleet-index.json';
let raw = fs.readFileSync(p, 'utf8');

// Anchor: end of the Crippling-X entry.
const anchor =
  '      "page": "38"\r\n    },\r\n    "Critical-X": {\r\n';
if (!raw.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
if (raw.includes('"Crippling-Fire"')) { console.error('ALREADY PRESENT'); process.exit(1); }

const entries = {
  'Crippling-Fire':
    'Gain a Fire Token. At the start of the End Phase, before the Repair step, this ship suffers a point of damage for each Fire Token it has. Repairable.',
  'Crippling-2xFire':
    'Place two Fire Tokens. At the start of the End Phase, before the Repair step, this ship suffers a point of damage for each Fire Token it has. Repairable.',
  'Crippling-Navigation Offline':
    'Gain a Navigation Offline token, reducing this Ship’s total movement to 2” (regardless of Thrust) and preventing it from turning or changing Orbital Layer. Repairable.',
  'Crippling-Weapons Offline':
    'Gain a Weapons Offline token, preventing this Ship from using Weapons or launching Assets. Repairable.',
};

let block = '';
for (const [k, d] of Object.entries(entries)) {
  block += '    ' + JSON.stringify(k) + ': {\r\n' +
           '      "description": ' + JSON.stringify(d) + ',\r\n' +
           '      "page": "19"\r\n    },\r\n';
}
// Insert the new entries before the Critical-X entry (i.e. after Crippling-X).
raw = raw.replace(
  '      "page": "38"\r\n    },\r\n    "Critical-X": {\r\n',
  '      "page": "38"\r\n    },\r\n' + block + '    "Critical-X": {\r\n'
);
JSON.parse(raw); // validate
fs.writeFileSync(p, raw);
console.log('Inserted 4 Crippling-* entries. JSON valid.');
