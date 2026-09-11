#!/usr/bin/env node
/* Redraw the rulebook's six scenario maps as SVG, in the generator's own map style.

     node scripts/draw-rulebook-maps.js

   The rulebook (2.3.1 print friendly) only carries these maps as 240px pictures.
   This draws them crisp from measurements read off those pictures: every dropsite,
   Feature, zone and measurement below is in inches on a 48" table, x from the west
   edge and y from the north edge, matching the labels printed on the book's maps.
   Shapes come from the generator (scenarios/dropfleet/generator/index.html): its
   dropsites, zone styles, measurement lines and Feature tokens.

   Writes assets/scenarios/dropfleet/<id>.svg and data/scenario-hotspots/<id>.json
   (the hover spots, taken from the same drawing so they always line up). Then run
   scripts/build-scenario-hotspots.py and scripts/gen-scenario-thumbs.py.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);
const GEN = path.join(ROOT, 'scenarios', 'dropfleet', 'generator', 'index.html');
const LIB = path.join(ROOT, 'scenarios', 'dropfleet', 'scenario-lib.js');

// ── Borrow the generator's drawing code ─────────────────────────────────────
const html = fs.readFileSync(GEN, 'utf8').replace(/\r\n/g, '\n');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('missing ' + a); return html.slice(i, j); };
const ctx = {
  document: { currentScript: { src: 'file:///x/scenarios/dropfleet/scenario-lib.js' }, addEventListener() {}, body: {} },
  addEventListener() {}, URL, console,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(LIB, 'utf8') + '\nthis.FI=FI;', ctx);
vm.runInContext(between('// ─── COMBINED MAP SYSTEM', 'const LM={') +
  between('// ─── VARIANT MAP OVERLAYS', 'function stationOver(') +
  '\nthis.mk={mkLC,mkMC,mkSC,mkStn,_i,tokenSpot,TOKEN};', ctx);
const { mkLC, mkMC, mkSC, mkStn, _i, tokenSpot, TOKEN } = ctx.mk;
// The generator's cities use rgba fills; give them the same colour with a separate opacity
const plain = svg => svg.replace(/fill="rgba\((\d+),(\d+),(\d+),([.\d]+)\)"/g, (m, r, g, b, a) => `fill="rgb(${r},${g},${b})" fill-opacity="${a}"`);
// A Feature token: the real token art, placed with a transform rather than a nested <svg>
function token(key, px, py) {
  const art = ctx.FI[key], inner = art.slice(art.indexOf('>') + 1, art.lastIndexOf('</svg>')), h = TOKEN / 2;
  return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(h + .8).toFixed(1)}" fill="#f4efe8"/><g transform="translate(${(px - h).toFixed(2)},${(py - h).toFixed(2)}) scale(${TOKEN / 64})">${inner}</g>`;
}

// ── Zone styles, as the generator's depZone draws them ──────────────────────
// Colour and opacity kept apart (not rgba) so every SVG renderer, thumbnails included, draws them the same
const BLUE = 'fill="#1E7AA8" fill-opacity=".28" stroke="#1E7AA8" stroke-width="1.2" stroke-dasharray="5,2.5"';
const RED = 'fill="#C04020" fill-opacity=".28" stroke="#C04020" stroke-width="1.2" stroke-dasharray="5,2.5"';
const STRIP = 7;   // a table-edge deployment zone, as the generator draws Line
const zone = {
  edges: () => `<rect x="0" y="0" width="200" height="${STRIP}" ${BLUE}/><rect x="0" y="${200 - STRIP}" width="200" height="${STRIP}" ${RED}/>`,
  cornerArcs: r => { const p = _i(r); return `<path d="M${p},0 A${p},${p} 0 0,1 0,${p} L0,0 Z" ${BLUE}/><path d="M${200 - p},200 A${p},${p} 0 0,1 200,${200 - p} L200,200 Z" ${RED}/>`; },
  cornerLs: len => { const p = _i(len); return `<rect x="0" y="0" width="${p}" height="${STRIP}" ${BLUE}/><rect x="0" y="0" width="${STRIP}" height="${p}" ${BLUE}/><rect x="${200 - p}" y="${200 - STRIP}" width="${p}" height="${STRIP}" ${RED}/><rect x="${200 - STRIP}" y="${200 - p}" width="${STRIP}" height="${p}" ${RED}/>`; },
  redCorners: r => { const p = _i(r); return `<clipPath id="tbl"><rect width="200" height="200"/></clipPath><g clip-path="url(#tbl)">${[[0, 0], [200, 0], [0, 200], [200, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${p}" ${RED}/>`).join('')}</g>`; },
  blueDisc: (x, y, d) => `<circle cx="${_i(x)}" cy="${_i(y)}" r="${_i(d / 2)}" ${BLUE}/>`,
};
const zoneLabel = (x1, y1, x2, y2, txt, color) => {
  const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width=".7" opacity=".75"/><text x="${tx + 3}" y="${ty - 2}" font-size="5.5" fill="${color}" font-family="sans-serif">${txt}"</text>`;
};

// A Planetary Ring and a Large Object, as the generator draws them
const ring = y => `<line x1="0" y1="${_i(y)}" x2="200" y2="${_i(y)}" stroke="#C47A10" stroke-width="3" opacity=".8"/>`;
const largeObject = (x, y, d) => `<circle cx="${_i(x)}" cy="${_i(y)}" r="${_i(d / 2)}" fill="#c4beb6" stroke="#888" stroke-width="1.2" stroke-dasharray="4,2" opacity=".85"/><text x="${_i(x)}" y="${_i(y) + 3}" text-anchor="middle" font-size="7" fill="#555" font-family="sans-serif">${d}"</text>`;

// A measurement from a dropsite to a table edge, as the generator's edgeLine draws it
function edgeLine(edge, xi, yi, shift) {
  const x = _i(xi), y = _i(yi);
  let x2, y2, dist, tx, ty, anchor;
  switch (edge) {
    case 'N': x2 = x; y2 = 0; dist = yi; tx = x + 4; ty = y / 2 + 2; anchor = 'start'; break;
    case 'S': x2 = x; y2 = 200; dist = 48 - yi; tx = x + 4; ty = (y + 200) / 2 + 2; anchor = 'start'; break;
    case 'E': x2 = 200; y2 = y; dist = 48 - xi; tx = (x + 200) / 2; ty = y - 3; anchor = 'middle'; break;
    case 'W': x2 = 0; y2 = y; dist = xi; tx = x / 2; ty = y - 3; anchor = 'middle'; break;
  }
  const vert = edge === 'N' || edge === 'S';
  const tick = vert
    ? `<line x1="${x2 - 3}" y1="${y2}" x2="${x2 + 3}" y2="${y2}" stroke="#B8952F" stroke-width=".8" opacity=".7"/>`
    : `<line x1="${x2}" y1="${y2 - 3}" x2="${x2}" y2="${y2 + 3}" stroke="#B8952F" stroke-width=".8" opacity=".7"/>`;
  // A short measurement's midpoint sits under the dropsite and its tokens; put the label beside the edge instead
  if (dist < 9) { if (vert) ty = edge === 'N' ? 6.5 : 197; else ty = y + 9; }
  if (shift) { tx += shift[0]; ty += shift[1]; }
  return `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="#B8952F" stroke-width=".8" opacity=".65"/>${tick}<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="6" fill="#B8952F" font-family="sans-serif" font-weight="600">${Math.round(dist)}"</text>`;
}

// ── The six maps. Sites: [type, x", y", rotation, features[], edges measured] ──
const MAPS = {
  'take-and-hold': {
    zones: () => zone.edges(),
    sites: [
      ['MS', 36, 18, 0, ['out'], 'NE'],
      ['MS', 12, 30, 0, ['out'], 'SW'],
      ['LC', 6, 24, 0, ['out', 'odg'], 'W'],
      ['MC', 24, 24, 0, ['out'], ''],
      ['LC', 42, 24, 0, ['out', 'odg'], 'E'],
    ],
  },
  'erupting-battlefront': {
    zones: () => zone.edges(),
    extra: () => ring(24),
    sites: [
      ['MC', 12, 12, 180, ['com', 'pow', 'han'], 'NW'],
      ['MC', 36, 12, 180, ['com', 'pow', 'han'], 'NE'],
      ['MC', 12, 36, 0, ['han', 'pow', 'com'], 'SW'],
      ['MC', 36, 36, 0, ['han', 'pow', 'com'], 'SE'],
      ['LC', 24, 24, 0, [], ''],
    ],
  },
  'power-grab': {
    zones: () => zone.cornerArcs(12) + zoneLabel(0, 0, _i(12) * .707, _i(12) * .707, 12, '#1E7AA8') + zoneLabel(200, 200, 200 - _i(12) * .707, 200 - _i(12) * .707, 12, '#C04020'),
    sites: [
      ['LC', 42, 6, 0, ['out', 'odg'], 'NE'],
      ['MC', 24, 18, 180, ['out'], 'N'],
      ['SS', 12, 24, 0, ['out'], 'W'],
      ['SS', 36, 24, 0, ['out'], 'E'],
      ['MC', 24, 30, 0, ['out'], 'S'],
      ['LC', 6, 42, 0, ['out', 'odg'], 'WS'],
    ],
  },
  'shock-and-yaw': {
    zones: () => zone.cornerLs(12),
    sites: [
      ['LS', 40, 8, 0, ['com', 'odg'], 'E'],
      ['SC', 16, 16, 90, ['han'], 'NW'],
      ['MC', 40, 18, 0, ['out'], 'N', { N: [-22, 14] }],
      // Its special rule is about destroying a Power Plant here, so these are Power Plants
      ['MS', 24, 24, 0, ['pow', 'pow'], ''],
      ['MC', 8, 30, 0, ['out'], 'S', { S: [0, -20] }],
      ['SC', 32, 32, 90, ['han'], 'SE'],
      ['LS', 8, 40, 0, ['odg', 'com'], 'W'],
    ],
  },
  'orbital-support': {
    zones: () => zone.edges(),
    sites: [
      ['LC', 6, 12, 0, ['out', 'out'], ''],
      ['SC', 24, 12, 0, ['out', 'odg'], ''],
      ['LC', 42, 12, 0, ['out', 'out'], 'NE'],
      // "The Medium Space Station replaces its two Military Outposts with two Hangars."
      ['MS', 24, 24, 0, ['han', 'han'], ''],
      ['LC', 6, 36, 0, ['out', 'out'], 'WS'],
      ['SC', 24, 36, 0, ['odg', 'out'], ''],
      ['LC', 42, 36, 0, ['out', 'out'], ''],
    ],
  },
  'entrapmoont': {
    zones: () => zone.redCorners(8) + zone.blueDisc(24, 24, 18) +
      zoneLabel(200, 0, 200 - _i(8) * .707, _i(8) * .707, 8, '#C04020') + zoneLabel(0, 200, _i(8) * .707, 200 - _i(8) * .707, 8, '#C04020') +
      `<text x="${_i(24) + _i(7.2)}" y="${_i(24) - _i(7.2)}" font-size="6" fill="#1E7AA8" font-family="sans-serif" font-weight="600">18"</text>`,
    extra: () => largeObject(24, 24, 12),
    sites: [
      ['LS', 24, 12, 0, ['odg', 'out'], 'N'],
      ['SC', 12, 18, 0, ['out'], 'WN'],
      ['SC', 42, 18, 0, ['out'], 'EN'],
      ['SC', 6, 30, 0, ['out'], 'WS'],
      ['SC', 36, 30, 0, ['out'], 'ES'],
      ['LS', 24, 36, 0, ['out', 'odg'], 'S'],
    ],
    los: [[24, 24, 12]],
  },
};

// Hover spot radius (percent of the map) for each dropsite drawing
const SITE_R = { LC: 5, MC: 5, SC: 4.6, SS: 4, MS: 5, LS: 5 };
const FEAT_KEY = { out: 'out', odg: 'odg', com: 'com', pow: 'pow', han: 'han' };
const pct = v => Math.round(v / 2 * 10) / 10;   // SVG units (0-200) to percent

for (const [id, m] of Object.entries(MAPS)) {
  const GR = `<line x1="99" y1="0" x2="99" y2="200" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="101" y1="0" x2="101" y2="200" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="0" y1="99" x2="200" y2="99" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="0" y1="101" x2="200" y2="101" stroke="#B8952F" stroke-width=".4" opacity=".22"/>`;
  let dims = '', sites = '', toks = '';
  const spots = [];
  for (const [t, xi, yi, rot, feats, edges, shifts] of m.sites) {
    const x = _i(xi), y = _i(yi);
    for (const e of edges) dims += edgeLine(e, xi, yi, shifts && shifts[e]);
    sites += plain(t === 'LC' ? mkLC(x, y) : t === 'MC' ? mkMC(x, y, rot) : t === 'SC' ? mkSC(x, y, rot)
      : mkStn(x, y, t[0], t === 'SS' ? 7 : 9));
    spots.push({ t: t.toLowerCase(), x: pct(x), y: pct(y), r: SITE_R[t] });
    feats.forEach((k, i) => {
      const [px, py] = tokenSpot(t, x, y, rot, i, false);
      toks += token(k, px, py);
      spots.push({ t: FEAT_KEY[k], x: pct(px), y: pct(py), r: +((TOKEN / 2 + 0.8) / 2).toFixed(1) });
    });
  }
  for (const [lx, ly, d] of m.los || []) spots.push({ t: 'lo', x: pct(_i(lx)), y: pct(_i(ly)), r: pct(_i(d / 2)) });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1000" height="1000">` +
    `<rect width="200" height="200" fill="#f4efe8"/>${GR}${m.zones()}${m.extra ? m.extra() : ''}` +
    `<rect x="0" y="0" width="200" height="200" fill="none" stroke="#B8952F" stroke-width="1.6"/>${dims}${sites}${toks}</svg>\n`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'scenarios', 'dropfleet', id + '.svg'), svg);
  fs.writeFileSync(path.join(ROOT, 'data', 'scenario-hotspots', id + '.json'), JSON.stringify(spots, null, 1) + '\n');
  console.log(`${id}: ${m.sites.length} dropsites, ${spots.length} spots, ${Math.round(svg.length / 1024)} KB`);
}
