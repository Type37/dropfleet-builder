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
function token(key, px, py, size = TOKEN) {
  const art = ctx.FI[key], inner = art.slice(art.indexOf('>') + 1, art.lastIndexOf('</svg>')), h = size / 2;
  return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(h + .8).toFixed(1)}" fill="#f4efe8"/><g transform="translate(${(px - h).toFixed(2)},${(py - h).toFixed(2)}) scale(${size / 64})">${inner}</g>`;
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
      ['MS', 24, 24, 0, ['out', 'out'], ''],
      ['LC', 6, 36, 0, ['out', 'out'], 'WS'],
      ['SC', 24, 36, 0, ['odg', 'out'], ''],
      ['LC', 42, 36, 0, ['out', 'out'], ''],
    ],
    // "The Medium Space Station replaces its two Military Outposts with two Hangars."
    // Drawn as a hidden layer (site = index in sites) the scenarios page shows when the Variant is on.
    variants: { 1: { site: 3, feats: ['han', 'han'] } },
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
  // Dragonslayer (Ether_Drake.pdf page 2, converted): Line edges, four Space Stations 12" from the centre
  // (Medium Space Stations under the conversion), the Ether Drake in the centre as the book's orange disc
  'dragonslayer': {
    zones: () => zone.edges(),
    extra: () => `<circle cx="${_i(24)}" cy="${_i(24)}" r="${_i(2)}" fill="#D9793F" fill-opacity=".85" stroke="#8A4420" stroke-width="1" stroke-dasharray="3,1.6"/>`,
    sites: [
      ['MS', 24, 12, 0, [], 'N'],
      ['MS', 12, 24, 0, [], 'W'],
      ['MS', 36, 24, 0, [], 'E'],
      ['MS', 24, 36, 0, [], 'S'],
    ],
  },
  // ── 1st edition scenarios converted to the current edition (scenario-legacy.js). Read off the
  // 1st edition maps: Clusters of 2/3/4 Sectors -> Small/Medium/Large Cities, Sector colours -> Features
  // (tan Military -> out, green Orbital Defence -> odg, orange Power Plant -> pow, pink Comms Station -> com,
  // yellow Industrial -> pow on Jet's call (2026-09-13); blue Commercial carries none). `cb` / `battle` put a Dropsite in the Clash-and-Battle / Battle-only game size layer.
  'the-ancient-relic': {
    zones: () => zone.edges(),
    // No measurements are printed; positions read off the map's grid
    extra: () => `<circle cx="${_i(46)}" cy="${_i(24)}" r="${_i(2)}" fill="#D9793F" fill-opacity=".85" stroke="#8A4420" stroke-width="1" stroke-dasharray="3,1.6"/>`,
    sites: [
      ['MS', 6, 16, 0, [], ''],
      ['MS', 32, 16, 0, [], ''],
      ['MS', 16, 32, 0, [], ''],
      ['MS', 42, 32, 0, [], ''],
    ],
  },
  // Features list the City's dots in the generator's order, '' for a dot with no Feature:
  // Large [top-left, top-right, bottom-left, bottom-right]; Medium [top, bottom-left, bottom-right] turned
  // with the rotation (180 = two dots on top); Small [left, right]. Each is the 1st edition Sector's own dot.
  'resistance-spearhead': {
    zones: () => zone.edges(),
    sites: [
      ['LC', 16, 16, 0, ['pow', 'out', 'out', 'pow'], 'NW'],
      ['LC', 32, 16, 0, ['out', 'pow', 'pow', 'out'], ''],
      ['MC', 24, 24, 0, [], ''],
      ['LC', 16, 32, 0, ['out', 'pow', 'pow', 'out'], ''],
      ['LC', 32, 32, 0, ['pow', 'out', 'out', 'pow'], ''],
    ],
    cb: [2],
  },
  'heavy-convoy': {
    zones: () => zone.edges(),
    sites: [],
  },
  'monitoring-the-situation': {
    zones: () => `<rect x="0" y="0" width="200" height="${STRIP}" ${RED}/><rect x="0" y="${200 - STRIP}" width="200" height="${STRIP}" ${BLUE}/>`,
    extra: () => ring(30),
    sites: [
      ['MC', 6, 24, 180, ['', 'odg', ''], ''],
      ['MC', 15, 24, 180, ['out', 'out', 'out'], ''],
      ['MC', 24, 24, 270, ['', 'odg', ''], ''],
      ['MC', 33, 24, 0, ['out', 'out', 'out'], ''],
      ['MC', 42, 24, 0, ['odg', '', ''], ''],
    ],
    // this page's blue-marked Clusters are "only used in Battles"
    battle: [1, 3],
  },
  'core-take-and-hold': {
    zones: () => zone.edges(),
    sites: [
      ['LC', 4, 24, 0, ['', 'pow', 'out', ''], ''],
      ['MC', 36, 18, 180, ['out', 'pow', ''], 'N'],
      ['LC', 24, 24, 0, ['out', '', 'pow', 'out'], ''],
      ['MC', 12, 30, 180, ['pow', 'out', ''], 'WS'],
      ['LC', 44, 24, 0, ['out', '', '', 'pow'], 'E'],
    ],
    cb: [1, 3],
  },
  'core-mixed-engagement': {
    zones: () => zone.edges(),
    sites: [
      ['MS', 24, 12, 0, [], ''],
      ['LC', 4, 24, 0, ['', 'pow', 'out', ''], ''],
      ['MS', 24, 24, 0, [], ''],
      ['LC', 44, 24, 0, ['out', '', '', 'pow'], 'E'],
      ['MS', 24, 36, 0, [], 'S'],
    ],
    cb: [2],
  },
  'core-erupting-battlefront': {
    zones: () => zone.edges(),
    extra: () => ring(24),
    sites: [
      ['MC', 12, 12, 180, ['out', 'pow', ''], ''],
      ['MC', 36, 12, 180, ['pow', 'out', ''], ''],
      ['MS', 24, 18, 0, [], 'N'],
      ['LC', 24, 24, 0, ['out', '', 'pow', 'out'], ''],
      ['MS', 24, 30, 0, [], ''],
      ['MC', 12, 36, 180, ['out', '', 'pow'], ''],
      ['MC', 36, 36, 180, ['', 'pow', 'out'], 'ES'],
    ],
    labels: [[12, 12, 'B'], [36, 12, 'B'], [12, 36, 'A'], [36, 36, 'A'], [24, 24, 'C']],
    cb: [2, 4],
    // Punching Up: 2 of the centre City's Sectors become Orbital Guns; the two that are not Military take them
    variants: { 1: { site: 3, feats: ['out', 'odg', 'odg', 'out'] } },
  },
  'core-station-assault': {
    zones: () => zone.cornerLs(12),
    sites: [
      ['MS', 24, 12, 0, [], ''],
      ['MS', 44, 18, 0, [], 'NE'],
      ['MS', 24, 24, 0, [], ''],
      ['MS', 4, 30, 0, [], ''],
      ['MS', 24, 36, 0, [], 'S'],
    ],
    labels: [[24, 12, 'B'], [44, 18, 'A'], [24, 24, 'A'], [4, 30, 'A'], [24, 36, 'B']],
  },
  'core-grid-control': {
    zones: () => zone.edges(),
    sites: [
      ['MC', 24, 12, 180, ['', 'pow', 'pow'], ''],
      ['SC', 4, 24, 0, ['out', 'odg'], ''],
      ['LC', 24, 24, 0, ['out', 'out', 'out', 'out'], ''],
      ['SC', 44, 24, 0, ['odg', 'out'], 'E'],
      ['MC', 24, 36, 0, ['', 'pow', 'pow'], 'S'],
    ],
    cb: [0, 4],
  },
  'core-power-grab': {
    zones: () => zone.cornerLs(12),
    sites: [
      ['MC', 42, 6, 0, ['pow', 'pow', ''], 'NE'],
      ['LC', 30, 18, 0, ['pow', 'pow', 'pow', 'pow'], ''],
      ['MC', 24, 24, 180, ['out', 'out', 'out'], ''],
      ['LC', 18, 30, 0, ['pow', 'pow', 'pow', 'pow'], 'WS'],
      ['MC', 6, 42, 180, ['pow', 'pow', ''], ''],
    ],
  },
  'core-defence-relay': {
    zones: () => zone.edges(),
    sites: [
      ['MS', 24, 18, 0, [], 'N'],
      ['SC', 4, 24, 0, ['pow', 'com'], ''],
      ['LC', 18, 24, 0, ['pow', 'out', 'out', ''], ''],
      ['LC', 30, 24, 0, ['out', '', 'pow', 'out'], 'E'],
      ['SC', 44, 24, 0, ['com', 'pow'], ''],
      ['MS', 24, 30, 0, [], ''],
    ],
    cb: [0, 5],
  },
};

// The converted 1st edition maps put each Feature on the City dot it replaces, as the 1st edition map
// coloured that Sector's dot (Jet, 2026-09-13); the book's own maps keep their tokens beside the Dropsite
const ON_DOTS = new Set(['the-ancient-relic', 'resistance-spearhead', 'heavy-convoy', 'monitoring-the-situation', 'core-take-and-hold', 'core-mixed-engagement', 'core-erupting-battlefront', 'core-station-assault', 'core-grid-control', 'core-power-grab', 'core-defence-relay']);
const DOT_TOKEN = 6.6;
// The generator's dot centres (mkLC, mkMC, mkSC), turned with the Dropsite
const DOTS = { LC: [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]], MC: [[0, -3], [-3.8, 3.2], [3.8, 3.2]], SC: [[-3, 0], [3, 0]] };
function dotSpot(t, x, y, rot, i) {
  const [dx, dy] = DOTS[t][i % DOTS[t].length], a = (rot || 0) * Math.PI / 180;
  return [x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a)];
}

// Hover spot radius (percent of the map) for each dropsite drawing
const SITE_R = { LC: 5, MC: 5, SC: 4.6, SS: 4, MS: 5, LS: 5 };
const FEAT_KEY = { out: 'out', odg: 'odg', com: 'com', pow: 'pow', han: 'han' };
const pct = v => Math.round(v / 2 * 10) / 10;   // SVG units (0-200) to percent

for (const [id, m] of Object.entries(MAPS)) {
  const GR = `<line x1="99" y1="0" x2="99" y2="200" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="101" y1="0" x2="101" y2="200" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="0" y1="99" x2="200" y2="99" stroke="#B8952F" stroke-width=".4" opacity=".22"/><line x1="0" y1="101" x2="200" y2="101" stroke="#B8952F" stroke-width=".4" opacity=".22"/>`;
  let dims = '', sites = '', toks = '';
  const spots = [];
  for (const [si, [t, xi, yi, rot, feats, edges, shifts]] of m.sites.entries()) {
    const x = _i(xi), y = _i(yi);
    // A Dropsite only on the table in bigger games sits in a data-size layer the scenario page's game size
    // switch shows or hides: "clash" = Clash and Battle, "battle" = Battle only
    const gsize = (m.battle || []).includes(si) ? 'battle' : (m.cb || []).includes(si) ? 'clash' : '';
    const sized = s => gsize ? `<g data-size="${gsize}">${s}</g>` : s, stag = gsize ? { size: gsize } : {};
    let d = '';
    for (const e of edges) d += edgeLine(e, xi, yi, shifts && shifts[e]);
    dims += sized(d);
    sites += sized(plain(t === 'LC' ? mkLC(x, y) : t === 'MC' ? mkMC(x, y, rot) : t === 'SC' ? mkSC(x, y, rot)
      : mkStn(x, y, t[0], t === 'SS' ? 7 : 9)));
    spots.push({ t: t.toLowerCase(), x: pct(x), y: pct(y), r: SITE_R[t], ...stag });
    // A site's Features, wrapped in a layer when a Variant swaps them (v: shown with it, hideV: hidden by it)
    const layer = (list, attrs, tag) => {
      let out = '';
      list.forEach((k, i) => {
        if (!k) return;
        const onDot = ON_DOTS.has(id) && DOTS[t], size = onDot ? DOT_TOKEN : TOKEN;
        const [px, py] = onDot ? dotSpot(t, x, y, rot, i) : tokenSpot(t, x, y, rot, i, false);
        out += token(k, px, py, size);
        spots.push({ t: FEAT_KEY[k], x: pct(px), y: pct(py), r: +((size / 2 + 0.8) / 2).toFixed(1), ...tag, ...stag });
      });
      return attrs ? `<g${attrs}>${out}</g>` : out;
    };
    const swaps = Object.entries(m.variants || {}).filter(([, v]) => v.site === si);
    const hide = swaps.map(([n]) => n).join(' ');
    let tk = hide ? layer(feats, ` data-hide-v="${hide}"`, { hideV: hide }) : layer(feats, '', {});
    for (const [n, v] of swaps) tk += layer(v.feats, ` data-v="${n}" display="none"`, { v: n });
    toks += sized(tk);
  }
  for (const [lx, ly, d] of m.los || []) spots.push({ t: 'lo', x: pct(_i(lx)), y: pct(_i(ly)), r: pct(_i(d / 2)) });
  // A/B/C names sit below their Dropsite, clear of its Feature tokens
  const labels = (m.labels || []).map(([lx, ly, t]) => `<text x="${_i(lx) + (lx > 40 ? -12 : 12)}" y="${_i(ly) + 16}" text-anchor="middle" font-size="9" font-weight="700" fill="#2B4A6F" font-family="sans-serif">${t}</text>`).join('');
  sites += labels;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1000" height="1000">` +
    `<rect width="200" height="200" fill="#f4efe8"/>${GR}${m.zones()}${m.extra ? m.extra() : ''}` +
    `<rect x="0" y="0" width="200" height="200" fill="none" stroke="#B8952F" stroke-width="1.6"/>${dims}${sites}${toks}</svg>\n`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'scenarios', 'dropfleet', id + '.svg'), svg);
  fs.writeFileSync(path.join(ROOT, 'data', 'scenario-hotspots', id + '.json'), JSON.stringify(spots, null, 1) + '\n');
  console.log(`${id}: ${m.sites.length} dropsites, ${spots.length} spots, ${Math.round(svg.length / 1024)} KB`);
}
