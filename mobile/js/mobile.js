/* ═══════════════════════════════════════════════════════════
   DFC Mobile, App Logic
   Hobgoblin-style linear stack navigation.
   Uses the SAME fleet schema as the desktop app (dfc_fleets):
     fleet.battleGroups[].ships[] storing { shipKey, groupCategory, points, loadouts }
     fleet.admirals[], fleet.spaceStation, fleet.gameSize
   so fleets are fully interoperable between desktop and mobile.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  // Feedback emails the maker directly, prefilled with guided questions.
  const FEEDBACK_HREF = 'mailto:warlore1@outlook.com?subject=' +
    encodeURIComponent('Dropfleet Builder feedback') + '&body=' +
    encodeURIComponent(
      'Thanks for helping improve the Dropfleet Commander Fleet Builder.\n\n' +
      '1. What were you trying to do, and could you finish it?\n\n' +
      '2. Did anything look wrong (a points cost, a stat, a rule)?\n\n' +
      '3. What would make you use it for your next game?\n\n' +
      '4. How long have you played DFC?\n'
    );
  const FACTIONS = {};         // raw faction JSON keyed by faction key
  let RULES_DB = {};           // shared rules glossary
  let SECONDARY_OBJECTIVES = []; // [{name, description}], pick 2 per game
  let STATION_ARMAMENTS = null;  // universal Fleet Space Station armaments/upgrades
  let fleets = [];
  let activeFleet = null;
  let activeGroupIdx = -1;     // index into activeFleet.battleGroups
  let activeAdmiralIdx = -1;   // index into activeFleet.admirals
  let pickerFilter = 'all';            // tonnage filter, pick ONE (radio)
  let pickerAttrs = new Set();         // attribute filters, multi-select (AND)
  let pickerSort = { key: 'points', dir: 'asc' };  // default: cheapest first
  // Mirrors the desktop "Additional Ships" setting: mercenaries / cross-faction /
  // optional units have no ship art, so they're hidden until this is toggled on.
  let pickerShowExtra = localStorage.getItem('dfc_show_extra') === '1';
  // One-time reset: misc ships default OFF (clears any stale "on" from testing).
  try { if (localStorage.getItem('dfc_misc_off_v1') !== '1') { pickerShowExtra = false; localStorage.setItem('dfc_show_extra', '0'); localStorage.setItem('dfc_misc_off_v1', '1'); } } catch (e) {}

  // Filled check for selected/active toggle states (replaces the old "✓" text
  // glyph, which rendered as an emoji on some platforms). Inherits colour from
  // the host control via currentColor.
  const CHECK_SVG = '<svg class="check-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';

  const FACTION_FILES = {
    ucm: '../data/faction-ucm.json',
    phr: '../data/faction-phr.json',
    scourge: '../data/faction-scourge.json',
    shaltari: '../data/faction-shaltari.json',
    resistance: '../data/faction-resistance.json',
    bioficer: '../data/faction-bioficer.json'
  };

  const FACTION_ICONS = {
    ucm: '../assets/factions/ucm.webp',
    phr: '../assets/factions/phr.webp',
    scourge: '../assets/factions/scourge.webp',
    shaltari: '../assets/factions/shaltari.webp',
    resistance: '../assets/factions/resistance.webp',
    bioficer: '../assets/factions/bioficer.webp'
  };

  // One-line beginner descriptors + ordering (beginner-friendly first)
  const FACTION_INFO = {
    ucm:        { name: 'UCM', order: 1 },
    scourge:    { name: 'Scourge', order: 2 },
    phr:        { name: 'PHR', order: 3 },
    shaltari:   { name: 'Shaltari', order: 4 },
    resistance: { name: 'Resistance', order: 5 },
    bioficer:   { name: 'Bioficers', order: 6 }
  };

  const GAME_SIZES = {
    skirmish:   { label: 'Skirmish',   min: 501,  max: 1000,  groups: 16, maxAdmiralLevel: 2, colossalMax: 0, time: '1–1.5 hrs' },
    clash:      { label: 'Clash',      min: 1001, max: 2000,  groups: 20, maxAdmiralLevel: 3, colossalMax: 1, time: '2–3 hrs' },
    battle:     { label: 'Battle',     min: 2001, max: 3000,  groups: 24, maxAdmiralLevel: 4, colossalMax: 2, time: '3–4 hrs' },
    reconquest: { label: 'Reconquest', min: 3001, max: 99999, groups: 28, maxAdmiralLevel: 5, colossalMax: 3, time: '4+ hrs' }
  };

  // Three-line size summary (rulebook 4.2): points range / group caps / admiral range.
  function gameSizeLines(s) {
    const pts = s.max >= 99999 ? `${s.min}+ points` : `${s.min} – ${s.max} points`;
    const groups = `≤ ${s.groups} Groups${s.colossalMax > 0 ? `, ≤ ${s.colossalMax} Colossal Group${s.colossalMax === 1 ? '' : 's'}` : ''}`;
    return [pts, groups, `Admiral Level 1-${s.maxAdmiralLevel}`];
  }
  const RARE_MAX = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 };

  // Haptics (Android web only; iOS Safari + unsupported browsers no-op silently).
  // Distinct patterns so actions feel different: a confident bump to add, a
  // double-tick to remove, a light tick for tweaks, a warning pulse when you tip
  // over the points limit.
  const HAPTIC = { tick: 8, add: 22, remove: [12, 35, 12], over: [0, 35, 45, 35] };
  function haptic(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  let _wasOverBudget = false;

  // 4 blocks that fill clockwise (TL, TR, BR, BL) as the game escalates.
  const GAME_SIZE_LEVEL = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 };
  function gameSizeBlocks(key) {
    const lvl = GAME_SIZE_LEVEL[key] || 1;
    const clockwise = [0, 1, 3, 2];
    let html = '';
    for (let p = 0; p < 4; p++) html += `<span class="gs-block${clockwise.indexOf(p) < lvl ? ' filled' : ''}"></span>`;
    return `<span class="gs-grid">${html}</span>`;
  }

  // Starter-box fleets (mirrors desktop fastplaySpecs) — the "I have the starter set" path.
  const STARTER_SPECS = [
    { faction: 'ucm', name: 'UCM Fast Play', size: 'skirmish', groups: [
      ['medium','Bruges',1],['medium','Edmonton',1],['medium','San Francisco',1],
      ['light','Toulon',2],['light','New Orleans',2],['light','Lima',2]] },
    { faction: 'scourge', name: 'Scourge Fast Play', size: 'skirmish', groups: [
      ['medium','Sphinx',1],['medium','Hydra',1],['medium','Chimera',1],
      ['light','Gargoyle',2],['light','Harpy',2]] },
    { faction: 'phr', name: 'PHR Fast Play', size: 'skirmish', groups: [
      ['medium','Theseus',1],['medium','Ikarus',1],['medium','Orpheus',1],
      ['light','Pandora',2],['light','Medea',2]] },
    { faction: 'shaltari', name: 'Shaltari Fast Play', size: 'skirmish', groups: [
      ['medium','Obsidian',1],['medium','Basalt',1],['medium','Emerald',1],
      ['light','Topaz',2],['light','Opal',2],['light','Voidgate',3]] },
    { faction: 'bioficer', name: 'Bioficer Fast Play', size: 'skirmish', groups: [
      ['medium','Comet',1],['medium','Cavern',1],['medium','Catastrophe',1],
      ['payload','Prism Cell',1],['light','Fulcrum',2],['light','Foray',2],
      ['payload','Invasion Cell',2],['payload','Lander Cell',2]] },
    // Resistance fastplay ships are MODULAR (Cruiser/Strike Carrier/Heavy Frigate hulls
    // with chosen systems) and carry flavour names on the official sheet. Each is its own
    // group named for its sheet name, with its starting modules pre-selected (from the
    // Resistance Fastplay Sheet A5 2.3). Object-form entries: {cat, ship, qty, name, systems}.
    { faction: 'resistance', name: 'Resistance Fast Play', size: 'skirmish', groups: [
      { cat:'medium', ship:'Cruiser', qty:1, name:'VH2A Gun Cruiser', systems:['Vent Cannon Turret','N-31 Hybrid Gun Bank','N-31 Hybrid Gun Bank','Ablative Armour'] },
      { cat:'medium', ship:'Cruiser', qty:1, name:'TFCS Hybrid Carrier', systems:['XN-31 Mass Driver Turret','NC-16 Missile Bank','Fighters & Bombers','Scanner Array'] },
      { cat:'medium', ship:'Cruiser', qty:1, name:'L2BR Fast Transport', systems:['N-109 Bombardment Mortar Turret','Bulk Landers & Fire Ships','Bulk Landers & Fire Ships','Drive Refit'] },
      { cat:'light', ship:'Strike Carrier', qty:2, name:'TL Strike Carrier', systems:['N-31 Hybrid Gun Turret'] },
      { cat:'light', ship:'Heavy Frigate', qty:2, name:'CT Attack Frigate', systems:['NC-16 Missile Turret','Light Vent Cannon Turret'] }
    ] }
  ];

  /* ── Ship art ──────────────────────────────────────────── */
  const SHIP_ART = new Set([
    // PHR
    'achilles','agamemnon','agrippa','ajax','amphion','andromeda','antigonus',
    'antony','ariadne','augustus','avram','bellerophon','brutus','cadmus','caesar',
    'calypso','castor','cato','chrysaor','echo','electra','europa','ganymede',
    'harpocrates','hector','heracles','ikarus','jason','kairos','leonnatus',
    'medea','meleager','memnon','minos','octavius','odysseus','orion','orpheus',
    'otera','ourania','pandora','pegasus','perseus','philonoe','pollux',
    'pompeius','priam','ptolemy','remus','rhadamanthus','romulus','sarpedon',
    'seleucus','sysyphus','teucer','theseus','trajan',
    // UCM
    'babylon','beijing','berlin','boston','bruges','bucharest','busan','byzantium',
    'caracas','carthage','centurion','delhi','detroit','edmonton','geneva',
    'gladiator','glasgow','halsey','hanoi','havana','havelock','istanbul',
    'jakarta','johannesburg','kyiv','lima','london','lysander','madrid',
    'milwaukee','newton','osaka','oslo','perth','reykjavik','rhiannon','rio','rome',
    'rotterdam','santiago','seattle','sheffield','siam','taipei','tayne',
    'thebes','tokyo','toulon','ulaanbaatar','vancouver','venice','vienna',
    'vilnius','warsaw','washington','weaver','yokohama',
    // Scourge
    'akuma','apsasu','bael','banshee','bannik','beelzebub','charybdis','chimera',
    'cthulhu','daemon','devil','djinn','dragon','ebisu','faust','fossegrim','gargoyle',
    'gloam','harpy','hiruko','hydra','ifrit','incubus','kikimora','kulshedra','lamassu','lucifer',
    'melusine','munifex','nephilim','nereid','nickar','nixie','nosferatu','parasite','raiju','raum',
    'revenant','rusalka','samael','scylla','shadow','shenlong','sphinx','strix',
    'succubus','wraith','wyvern','yokai',
    // Shaltari
    'actinium','amber','amethyst','aquamarine','azurite','baleares','basalt',
    'boracite','bronze','caesium','cerium','chromium','citrine','cobalt',
    'copper','diamond','emerald','euclase','gallium','glass','goethite',
    'gold','granite','helium','hematite','iridium','iron','jade','jet',
    'lanthanum','mercury','mesolite','natrolite','obsidian','onyx','opal',
    'painite','platinum','plutonium','ruby','sapphire','scoria','selenium',
    'shedu','silicon','silver','spinel','strontium','thorium','topaz',
    'turquoise','umbra','uranium',
    // Resistance
    'aldrin','armstrong','barbarossa','collins','coloniser','drake','explorer',
    'farragut','galileo','guy','iowa','lexington','musashi','nelson','nimitz',
    'pathfinder','phalanx','senator','seneca','vanguard','yamamoto',
    // Bioficer
    'binder','blackbird','brutal','cache','cacophony','carronade','cataphract',
    'cavern','charger','choral','cipher','combine','comet','conqueror',
    'construct','cosmic','diode','domain','foray','forestall','fresco',
    'fugue','fulcrum','gremlin','logic','mantle','matrix','monarch',
    'sagitarii','sanctum','scion','stature','supercell','tally','tine',
    'torrent','vertex','zenith','zodiac'
  ]);
  const SHIP_ART_SPECIAL = {
    'New York':'new_york','New Cairo':'new_cairo','New Mombasa':'new_mombasa',
    'New Orleans':'new_orleans','New Dubai':'new_dubai','Las Vegas':'las_vegas',
    'San Francisco':'san_francisco','Vilnius':'vilnius','Warsaw':'warsaw',
    'Hong Kong':'hong_kong','Nuuk':'nuuk',
    'Heavy Cruiser':'heavy_cruiser','Heavy Frigate':'heavy_frigate',
    'Light Cruiser':'light_cruiser','Strike Carrier':'strike_carrier',
    // Regular Resistance Cruiser hull — checked after Heavy/Light Cruiser above so
    // those keep their own art (startsWith). Without this it had no art and was
    // hidden whenever the "Additional ships" toggle was off.
    'Cruiser':'cruiser',
    // Civilian / industrial / mercenary ships (cross-faction "Misc Ships") — wire
    // their transparent art so they show with art instead of being hidden/blank.
    'Anode':'anode_the_melter',
    'Argonaut':'argonaut_astrofauna',
    'DH-Type Penal Transport':'dh_type_penal_transport',
    'EX-7 Packet Runner':'ex7_packet_runner',
    'Frigate':'frigate',
    'Hyperyacht Aurorum':'hyperyacht_aurorum',
    'Hyperyacht Somniferum':'hyperyacht_somniferum',
    'Jah':'jahetar_startrader',
    'Kalium KNC-12':'kalium_knc12',
    'Kalium KNC-5':'kalium_knc5',
    'LKS Dredger':'lks_dredger',
    'M-Type Barge':'m_type_barge',
    'OBV-64':'obv_64_oblivion_barge',
    'PRK-91':'prk_91_provenance_ark',
    'Palatine Command Barge':'palatine',
    'Pungari Thresher':'pungari_thresher',
    'SLM-9':'slm_9_resupply_hauler',
    'T-Type Tugboat':'t_type_tugboat',
    'Type-87':'type_87_terminus_harvester',
    'VX-22 Flenser':'vx_22_flenser',
    'The Hated':'the_hated',
    'Summoner Cell':'summoner_cell','Prism Cell':'prism_cell',
    'Torpedo Cell':'torpedo_cell','Lander Cell':'lander_cell',
    'Invasion Cell':'invasion_cell',
    'Yi Sun-sin':'yi-sun-sin','Voidgate':'voidgate',
    'Bastion':'bioficer_battleship_bastion',
    'Binary':'bioficer_battleship_binary',
    'Bishop':'bioficer_battleship_bishop',
    'Callous':'callous','Catastrophe':'catastrophe',
    'Triumvir':'triumvir','Tribune':'tribune','Disciple':'disciple',
    'M-Type':'m-type','El Paso':'el_paso'
  };
  const ADMIRAL_ART = {
    'claudia rhee':'claudia_rhee','gaius chau':'gaius_chau','javelin':'director_javelin',
    'helena of asgard':'helena_of_asgard','halsey':'halsey','havelock':'havelock',
    'weaver':'weaver','tayne':'tayne','ascendant':'ascendant_zenith',
    'agency':'agency_bastion','atom':'atom_scion','atlas':'atlas_catastrophe','genitor':'genitor',
    'nguen':'nguen_olympus'
  };

  function shipArtPath(name) {
    if (!name) return null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (name.startsWith(prefix)) return `../assets/art/${file}.webp`;
    }
    const first = name.split(/\s+/)[0].toLowerCase();
    return SHIP_ART.has(first) ? `../assets/art/${first}.webp` : null;
  }
  // Ships with an alternate resin sculpt at ../assets/art/<slug>_resin.webp — the
  // same ship, a different physical model, offered as alternate hero art.
  const SHIP_ALT = new Set(['rhadamanthus','beelzebub','beijing','bronze','daemon','delhi','devil','diamond','dragon','gold','hanoi','heracles','kairos','lucifer','minos','new_york','platinum','sarpedon','silver','tokyo']);
  function shipAltArt(name) {
    if (!name) return [];
    let slug = null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (name.startsWith(prefix)) { slug = file; break; }
    }
    if (!slug) slug = name.split(/\s+/)[0].toLowerCase();
    return SHIP_ALT.has(slug) ? [`../assets/art/${slug}_resin.webp`] : [];
  }
  // Small-display variant of an art URL for picker cards and list-row thumbs
  // (the source art is ~1100-1500px but shown at 52-96px). Heroes and print keep
  // the full image. Thumbs are 200px webps in assets/art/thumb/.
  function thumbUrl(url) { return url ? url.replace('/art/', '/art/thumb/') : url; }
  // Deployable-feature art (a subset have cutouts): assets/art/feat-<slug>.webp.
  const FEATURE_ART = new Set(['aegis-platform', 'comms-platform', 'torpedo-platform']);
  function featureArtPath(name) {
    if (!name) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return FEATURE_ART.has(slug) ? `../assets/art/feat-${slug}.webp` : null;
  }
  // Space-station art. The three generic stations (Small/Medium/Large) share a
  // model, so they reuse one faction image; faction-specific stations match by
  // name. Only high-confidence matches return art — the rest keep the blank
  // thumb rather than show a wrong picture.
  // Faction-specific stations → their transparent renders in assets/art/stations/.
  // Names are unique across factions, so a flat name→file map is unambiguous. The
  // generic Small/Medium/Large Space Stations have no dedicated art (kept blank
  // rather than showing the wrong faction's model). Mirrors desktop js/app.js.
  const STATION_NAME_ART = {
    'Defence Halo': 'phr-defence-halo', 'Orbital Picket': 'phr-orbital-picket',
    'Orbital Outpost': 'phr-orbital-outpost', 'Orbital Spire': 'phr-orbital-spire',
    'Grand Station': 'resistance-grand-station', 'Astrobotanical Outpost': 'resistance-astrobotanical-outpost',
    'Ephyra': 'scourge-ephyra', 'Nematocyst': 'scourge-nematocyst',
    'Gatestation': 'shaltari-gatestation', 'Grav Hook': 'shaltari-grav-hook',
    'Anchor': 'shaltari-anchor', 'Shuriken': 'shaltari-shuriken',
    'Defence Hangar': 'ucm-defence-hangar', 'Munitions Platform': 'ucm-munitions-platform',
  };
  function stationArtPath(factionKey, station) {
    if (!station) return null;
    const f = STATION_NAME_ART[station.name];
    return f ? `../assets/art/stations/${f}.webp` : null;
  }
  // Two universal station upgrades have their own art; shown as a small thumb on
  // the upgrade row in the armament picker. Mirrors desktop js/app.js.
  const STATION_UPGRADE_ART = { 'Astrobotanical Lab': 'astrobotanical-lab', 'Defence Grid': 'defence-grid' };
  function stationOptThumb(name) {
    const f = STATION_UPGRADE_ART[name];
    return f ? `<img class="sys-option-art" src="../assets/art/thumb/stations/${f}.webp" alt="" loading="lazy" onerror="this.remove()">` : '';
  }
  function admiralArtPath(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const [pat, file] of Object.entries(ADMIRAL_ART)) {
      if (lower.includes(pat)) return `../assets/art/${file}.webp`;
    }
    return null;
  }

  // TTCombat store links. Ships sell in boxed sets, so a name search returns
  // cross-faction noise. Honour an explicit ship.storeUrl; else land on the
  // ship's FACTION collection page (always the right faction); else name search.
  const TTC_FACTION_TAG = {
    ucm: 'ucm', phr: 'phr', scourge: 'scourge', shaltari: 'shaltari',
    resistance: 'resistance', bioficer: 'bioficers'
  };
  function shipStoreUrl(name, ship) {
    if (ship && ship.storeUrl) return ship.storeUrl;
    const tag = TTC_FACTION_TAG[activeFleet && activeFleet.faction];
    if (tag) return 'https://ttcombat.com/collections/dropfleet-commander/faction_' + tag;
    return 'https://ttcombat.com/search?q=' + encodeURIComponent((name || '').trim());
  }
  // Wrap a ship <img> in a TTCombat store link (no icon overlay; the art itself
  // is the link). Used only on single-ship hero art (group detail + datasheet
  // sheet), not in list/picker thumbnails.
  function shopLinkImg(name, imgTag, ship) {
    if (!imgTag) return '';
    const url = shipStoreUrl(name, ship);
    return `<a class="shop-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Find ${esc(name || 'this ship')} on the TTCombat store" onclick="event.stopPropagation()">${imgTag}</a>`;
  }

  // Status glyphs for validation rows — clean line icons, no emoji (a skull read
  // as "your fleet is dead" for what is really "add an admiral"). currentColor
  // inherits the row's state colour (danger / gold / green).
  const STATUS_ICON = {
    error: '<svg class="status-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><line x1="10" y1="5.6" x2="10" y2="10.6"/><circle cx="10" cy="13.9" r="0.95" fill="currentColor" stroke="none"/></svg>',
    // eos-icons "organization" (org chart) — a command-hierarchy mark for the
    // admiral-required row (inlined; the app ships with no build step).
    admiral: '<svg class="status-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.01 10.99h-7v-2h-2v2H3.47v4h2v-2h5.54v2h2v-2h5.5v2h2v-4z"/><circle cx="12.01" cy="4.51" r="2.5"/><circle cx="4.47" cy="19.49" r="2.5"/><circle cx="12.01" cy="19.49" r="2.5"/><circle cx="19.51" cy="19.49" r="2.5"/></svg>',
    warn: '<svg class="status-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.2 18.2 16.6 1.8 16.6Z"/><line x1="10" y1="8.2" x2="10" y2="11.8"/><circle cx="10" cy="14.4" r="0.9" fill="currentColor" stroke="none"/></svg>',
    ok: '<svg class="status-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M6.3 10.3 8.8 12.8 13.7 7.2"/></svg>'
  };

  // Firing-arc diagrams (ported from desktop). Raw arc text like "F/S/R" clips
  // in the narrow mobile weapon column, so render a compact SVG sector instead,
  // with the short code beneath it. Falls back to text for unmapped codes.
  const ARC_LABELS = {
    'B': 'Broadside (Port & Starboard)', 'F': 'Front', 'F/S': 'Front & Side',
    'F/S/R': 'Front, Side & Rear', 'FN': 'Front Narrow', 'Fn': 'Front Narrow',
    'S': 'Side', 'SL': 'Side Left', 'SR': 'Side Right', 'R': 'Rear',
    '*': 'Shuriken Arcs — 5 unique 72° arcs (see Disintegrator Bank)'
  };
  // Firing-arc glyphs, tuned for legibility at ~16px (bow points up): a bolder ring
  // + an edge stroke on each wedge so narrow arcs read. FN/RN are 30deg (the rule's
  // 22deg is an invisible sliver this small); Broadside (B) uses wider fore/aft gaps
  // so it stays distinct from the full F/S/R disc. Kept in sync with desktop app.js.
  const ARC_ICONS = {
    'B': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L68.6,10.1A44,44 0 0,1 68.6,89.9Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M50,50L31.4,10.1A44,44 0 0,0 31.4,89.9Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L18.9,18.9A44,44 0 0,1 81.1,18.9Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F/S': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L18.9,81.1A44,44 0 1,1 81.1,81.1Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F/S/R': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="currentColor" r="44"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5"/><polygon fill="#FFFFFF" points="50,2 47,8 53,8"/></svg>',
    'FN': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L38.6,7.5A44,44 0 0,1 61.4,7.5Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'Fn': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L38.6,7.5A44,44 0 0,1 61.4,7.5Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'S': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,18.9A44,44 0 0,1 81.1,81.1Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M50,50L18.9,81.1A44,44 0 0,1 18.9,18.9Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'SL': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L18.9,81.1A44,44 0 0,1 18.9,18.9Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'SR': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,18.9A44,44 0 0,1 81.1,81.1Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'R': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,81.1A44,44 0 0,1 18.9,81.1Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    '*': '<svg height="16" viewBox="0 0 100 100" width="16"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><g stroke="currentColor" stroke-width="3"><line x1="50" y1="50" x2="50" y2="6"/><line x1="50" y1="50" x2="91.8" y2="36.4"/><line x1="50" y1="50" x2="75.9" y2="85.6"/><line x1="50" y1="50" x2="24.1" y2="85.6"/><line x1="50" y1="50" x2="8.2" y2="36.4"/></g><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/></svg>'
  };
  function arcCell(arc) {
    const a = (arc || '').trim();
    if (!a) return '';
    if (ARC_ICONS[a]) return `<span class="arc-ico" title="${esc(ARC_LABELS[a] || a)}">${ARC_ICONS[a]}<span class="arc-label">${esc(a)}</span></span>`;
    return esc(a);
  }

  // The portrait-thumbnail slot for an admiral row: the ship/admiral portrait
  // when one exists (famous admirals), otherwise the rank insignia fills the
  // whole square (generic/faction admirals have no portrait). `lg` for the
  // larger detail-header box.
  function admiralThumb(factionKey, level, art, lg) {
    const cls = 'ship-thumb' + (lg ? ' ship-thumb-lg' : '');
    if (art) return `<div class="${cls}"><img src="${thumbUrl(art)}" alt="" loading="lazy"></div>`;
    const ins = window.RankInsignia ? RankInsignia(factionKey, level, lg ? 56 : 40) : '';
    return `<div class="${cls} rank-thumb">${ins}</div>`;
  }

  /* ── Rules glossary ────────────────────────────────────── */
  const STAT_META = {
    scan:   { label: 'Scan',   desc: 'Scan range. The distance (in inches) at which this ship detects enemies and uses close-range weapons.' },
    sig:    { label: 'Signature', desc: 'How visible this ship is. Enemies must be within their Scan range of your Signature to target you, a low Signature is harder to hit.' },
    thrust: { label: 'Thrust', desc: 'Movement speed, how far (in inches) this ship moves each activation.' },
    hull:   { label: 'Hull',   desc: 'Hull points. The ship’s structural integrity. It becomes Crippled at half, and is destroyed at zero.' },
    es:     { label: 'Energy Shield', desc: 'Energy Save. When hit by an Energy (E) weapon, roll this number or higher on a d6 to avoid the damage.' },
    ks:     { label: 'Kinetic Shield', desc: 'Kinetic Save. When hit by a Kinetic (K) weapon, roll this number or higher on a d6 to avoid the damage.' },
    bs:     { label: 'Backup Save', desc: 'Backup Save. A last-resort save used when a ship has no relevant shield, or against certain weapons.' },
    pd:     { label: 'Point Defence', desc: 'Point Defence. Dice rolled to shoot down incoming Close Action attacks and bombers.' },
    g:      { label: 'Group size', desc: 'How many of this ship can form one battle group, shown as a range (min–max).' }
  };

  const STAT_ICONS = {
    scan:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3,12 A9,9 0 0,1 21,12"/><path d="M7,12 A5,5 0 0,1 17,12"/><circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none"/></svg>',
    sig:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>',
    thrust: '<svg viewBox="0 0 24 24"><polygon fill="currentColor" points="4,4 20,12 4,20 8,12"/></svg>',
    hull:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>',
    es:     '<svg viewBox="0 0 16 22"><path d="M8,0.5 C8,0.5 0.5,3.5 0.5,3.5L0.5,10.5 C0.5,16 8,21.5 8,21.5 C8,21.5 15.5,16 15.5,10.5L15.5,3.5Z" fill="#1C1A17"/><path d="M8.5,4.5 L5,11 L7.5,11 L6,18.5 L12,9.5 L9,9.5 L11,4.5Z" fill="#FAECC8"/></svg>',
    ks:     '<svg viewBox="0 0 16 22"><path d="M5.5,0 L10.5,0 L10.5,3 L5.5,3Z" fill="#1C1A17"/><path d="M3,3 C1,5 0,8 0,11L0,15 L3,15 L3,18 C3,20 5.5,21.5 8,21.5 C10.5,21.5 13,20 13,18L13,15 L16,15 L16,11 C16,8 15,5 13,3Z" fill="#1C1A17"/><rect fill="#D0E4FF" height="2" rx="0.5" width="7" x="4.5" y="10"/><rect fill="#D0E4FF" height="7" rx="0.5" width="2" x="7" y="10"/></svg>',
    bs:     '<svg viewBox="0 0 16 22"><path d="M8,1 C8,1 1,4 1,4L1,11 C1,16.5 8,21 8,21 C8,21 15,16.5 15,11L15,4Z" fill="none" stroke="#1C1A17" stroke-width="1.5"/><line stroke="#1C1A17" stroke-linecap="round" stroke-width="1.2" x1="4" x2="12" y1="11" y2="11"/></svg>'
  };
  function statIcon(key) {
    return STAT_ICONS[key] ? `<span class="stat-icon stat-icon-${key}">${STAT_ICONS[key]}</span>` : '';
  }
  // Shared stat grid, matching the official profile order (and desktop): Thrust on
  // top, saves run KS / ES / BS downward.
  // 2-col grid: Thrust|KS, Scan|ES, Sig|BS, Hull(full). Each save its own cell.
  function statGridMobile(entries, tappable) {
    const byKey = {}; entries.forEach(e => { byKey[e.key] = e; });
    const cell = (k, cls = '') => {
      const e = byKey[k]; if (!e || e.val == null || e.val === '') return '';
      let extra = (k === 'es' || k === 'ks' || k === 'bs') ? 'stat-cell-' + k : '';
      if (k === 'bs' && (e.val === '-' || e.val === '--')) extra = 'stat-cell-none';
      if (e.mod) extra += ' stat-cell-modified';
      const tap = tappable ? ` tappable" onclick="App.openStat('${k}')` : '';
      return `<div class="stat-cell ${extra} ${cls}${tap}">${statIcon(k)}<span class="stat-cell-text"><span class="stat-value">${esc(e.val)}</span><span class="stat-label">${e.label}</span></span></div>`;
    };
    const cells = [
      cell('thrust'), cell('ks'),
      cell('scan'),   cell('es'),
      cell('sig'),    cell('bs'),
      cell('hull', 'stat-cell-wide')
    ].filter(Boolean).join('');
    return `<div class="stat-grid">${cells}</div>`;
  }

  // Adjust the numeric part of a stat value by a signed delta, keeping its suffix
  // (so "8\"" + 3 -> "11\"", a save "4+" - 1 -> "3+", "12" + 2 -> "14").
  function adjustStatVal(v, delta) {
    if (v == null) return v;
    const s = String(v); const m = s.match(/-?\d+/);
    if (!m) return v;
    return s.slice(0, m.index) + (parseInt(m[0], 10) + delta) + s.slice(m.index + m[0].length);
  }
  // Total stat deltas from a built ship's selected loadout options (e.g. a Drive
  // Refit's +3" Thrust) AND selected system/hardpoint options (e.g. Resistance
  // Scanner Array Scan +4"). Returns { key: delta }.
  function loadoutStatMods(ship, inst, factionKey) {
    const mods = {};
    const add = (sm) => { if (sm) Object.entries(sm).forEach(([k, d]) => { mods[k] = (mods[k] || 0) + d; }); };
    (ship.loadoutOptions || []).forEach((lo, i) => {
      const sel = inst && inst.loadouts ? inst.loadouts[i] : undefined;
      const opt = lo.options && lo.options[sel];
      if (opt) add(opt.statMods);
    });
    if (factionKey && inst && Array.isArray(inst.systems) && inst.systems.length) {
      const list = systemsListFor(ship, factionKey);
      if (list) inst.systems.forEach(name => { const o = findSystemOption(list, name); if (o) add(o.statMods); });
    }
    return mods;
  }
  // Build the stat-grid entries for a built ship, applying any loadout statMods
  // and tagging changed entries so the grid colours them.
  function shipStatEntries(stats, mods) {
    const sv = k => (mods && mods[k]) ? adjustStatVal(stats[k], mods[k]) : stats[k];
    const list = [
      { key: 'scan', label: 'Scan', val: sv('scan'), mod: mods && mods.scan },
      { key: 'sig', label: 'Sig', val: sv('sig'), mod: mods && mods.sig },
      { key: 'thrust', label: 'Thrust', val: sv('thrust'), mod: mods && mods.thrust },
      { key: 'hull', label: 'Hull', val: sv('hull'), mod: mods && mods.hull },
      { key: 'es', label: 'ES', val: sv('es'), mod: mods && mods.es },
      { key: 'ks', label: 'KS', val: sv('ks'), mod: mods && mods.ks }
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');
    if (stats.bs && stats.bs !== '-') list.push({ key: 'bs', label: 'BS', val: sv('bs'), mod: mods && mods.bs });
    return list;
  }

  function lookupRule(name) {
    // Single source of truth: the shared rules glossary (RULES_DB, from
    // data/fleet-index.json). Resolve parameterized keywords to their base "-X"
    // entry — numeric suffixes ("Reave 2") and letter/word suffixes alike
    // ("Calibre-H", "Crippling-Fire" -> "Calibre-X"/"Crippling-X").
    if (!name) return { name, description: '', page: '' };
    // Substitute the value (2, H, …) into the resolved "-X" description so
    // "Reave-2" reads "...by 2" instead of "...by X".
    const wrap = (e, val) => {
      let desc = e.description || '';
      if (val && /\bX\b/.test(desc)) desc = desc.replace(/\bX\b/g, val);
      return { name, description: desc, page: e.page || '' };
    };
    if (RULES_DB[name]) return wrap(RULES_DB[name]);
    const numM = name.match(/^(.*?)[-\s]?(\d+)$/);
    if (numM) {
      const base = numM[1].trim(), val = numM[2];
      const hit = RULES_DB[base] || RULES_DB[base + '-X'];
      if (hit) return wrap(hit, val);
    }
    const hi = name.lastIndexOf('-');
    if (hi > 0) {
      const pb = name.slice(0, hi).trim(), val = name.slice(hi + 1).trim();
      const hit = RULES_DB[pb] || RULES_DB[pb + '-X'];
      if (hit) return wrap(hit, val);
    }
    return { name, description: '', page: '' };
  }

  // Wrap any known glossary keyword found in prose (e.g. an ability's effect)
  // in a tappable span that opens its rule. Case-sensitive (keywords are Title
  // Case in the text) to avoid linking generic lowercase words.
  let _kwRe = null;
  function keywordRegex() {
    if (_kwRe) return _kwRe;
    const bases = new Set();
    Object.keys(RULES_DB).forEach(k => {
      const b = k.replace(/-X$/, '').trim();
      if (b.length >= 3) bases.add(b);
    });
    const terms = [...bases].sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    _kwRe = new RegExp('\\b(' + terms.join('|') + ')(-\\d+)?\\b', 'g');
    return _kwRe;
  }
  function linkKeywords(text) {
    if (!text) return '';
    return esc(text).replace(keywordRegex(), m =>
      `<span class="kw-link" onclick="event.stopPropagation();App.openRule('${m.replace(/'/g, "\\'")}')">${m}</span>`);
  }

  /* ── Bottom sheet ──────────────────────────────────────── */
  function showSheet(title, body, pageRef) {
    document.getElementById('rule-sheet-title').textContent = title;
    document.getElementById('rule-sheet-body').innerHTML = body;
    const pageEl = document.getElementById('rule-sheet-page');
    if (pageRef) { pageEl.textContent = 'Core Rules p.' + pageRef; pageEl.style.display = ''; }
    else { pageEl.style.display = 'none'; }
    document.getElementById('rule-sheet').classList.add('active');
    document.body.classList.add('sheet-open');
  }
  function openRule(name) {
    const rule = lookupRule(name);
    const body = rule.description
      ? `<p>${ruleHtml(rule.description)}</p>`
      : `<p class="rule-sheet-unknown">No rules text on file for this keyword yet.</p>`;
    showSheet(name, body, rule.page);
  }
  function openStat(key) {
    const meta = STAT_META[key];
    if (meta) showSheet(meta.label, `<p>${meta.desc}</p>`);
  }
  function closeRuleSheet() {
    document.getElementById('rule-sheet').classList.remove('active');
    document.body.classList.remove('sheet-open');
  }

  /* ── Action sheet (overflow menu) ──────────────────────── */
  function showActionSheet(items) {
    const el = document.getElementById('action-sheet-items');
    el.innerHTML = items.map((it, i) =>
      `<button class="action-sheet-item ${it.danger ? 'danger' : ''}" data-idx="${i}">${it.label}</button>`
    ).join('');
    el.querySelectorAll('.action-sheet-item').forEach((btn, i) => {
      btn.onclick = () => { closeActionSheet(); items[i].action(); };
    });
    document.getElementById('action-sheet').classList.add('active');
    document.body.classList.add('sheet-open');
  }
  function closeActionSheet() {
    document.getElementById('action-sheet').classList.remove('active');
    if (!document.getElementById('rule-sheet').classList.contains('active')) {
      document.body.classList.remove('sheet-open');
    }
  }

  // Swipe-down-to-dismiss for bottom sheets. Drag is allowed from the handle/
  // header at any time, and from the scrollable body only when it's scrolled to
  // the top — so a downward swipe always dismisses without fighting body scroll.
  // The sheet follows the finger; releasing past a distance/velocity threshold
  // closes it, otherwise it snaps back.
  function makeSheetSwipeable(sheetEl, closeFn, scrollEl) {
    if (!sheetEl) return;
    let startY = 0, lastY = 0, startT = 0, dragging = false;
    const onStart = (e) => {
      const t = e.touches[0];
      const fromGrab = !scrollEl || !scrollEl.contains(e.target) || scrollEl.scrollTop <= 0;
      if (!fromGrab) { dragging = false; return; }
      startY = lastY = t.clientY; startT = Date.now(); dragging = true;
      sheetEl.style.transition = 'none';
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { sheetEl.style.transform = 'translateY(0)'; lastY = e.touches[0].clientY; return; }
      // Actively pulling the sheet down — suppress body scroll/overscroll.
      if (e.cancelable) e.preventDefault();
      lastY = e.touches[0].clientY;
      sheetEl.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const dy = lastY - startY;
      const velocity = dy / Math.max(Date.now() - startT, 1);
      sheetEl.style.transition = '';
      sheetEl.style.transform = '';
      if (dy > 110 || velocity > 0.5) closeFn();
    };
    sheetEl.addEventListener('touchstart', onStart, { passive: true });
    sheetEl.addEventListener('touchmove', onMove, { passive: false });
    sheetEl.addEventListener('touchend', onEnd);
    sheetEl.addEventListener('touchcancel', onEnd);
  }

  function setupSheetGestures() {
    makeSheetSwipeable(document.getElementById('rule-sheet'), closeRuleSheet,
      document.getElementById('rule-sheet-body'));
    makeSheetSwipeable(document.getElementById('action-sheet'), closeActionSheet,
      document.getElementById('action-sheet-items'));
  }

  /* ── Helpers ───────────────────────────────────────────── */
  function uuid() { return 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  // "How do you say it?" guide for hard namesakes (../data/pronunciations.json).
  // Map of distinctive word -> respelling string or { say, ipa }; matched as a whole
  // word, longest key wins. Shown inline in the lore "Namesake:" line. Desktop-shared.
  let PRON = {}, PRON_KEYS = [];
  const _pronCache = new Map();
  function pronFor(name) {
    if (!name) return null;
    if (_pronCache.has(name)) return _pronCache.get(name);
    let hit = null;
    for (const key of PRON_KEYS) {
      const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(name)) {
        const e = PRON[key];
        hit = { word: key, say: typeof e === 'string' ? e : (e && e.say) || '', ipa: (e && e.ipa) || '' };
        break;
      }
    }
    _pronCache.set(name, hit);
    return hit;
  }
  function pronSpan(p) {
    const say = esc(p.say), word = esc(p.word);
    const tip = p.ipa ? `IPA /${esc(p.ipa)}/ · tap to hear ${word}` : `Tap to hear ${word}`;
    return `(<span class="lore-pron" role="button" tabindex="0" onclick="event.stopPropagation();App.sayName(this)" data-word="${word}" data-say="${say}" title="${tip}">${say}</span>)`;
  }
  function namesakePron(namesakeText, shipName) {
    const html = loreLinks(namesakeText);
    const p = pronFor(shipName || namesakeText);
    if (!p) return html;
    const span = pronSpan(p);
    const w = p.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkRe = new RegExp('<a\\b[^>]*>\\s*' + w + '[^<]*<\\/a>', 'i');
    if (linkRe.test(html)) return html.replace(linkRe, m => m + ' ' + span);
    const wordRe = new RegExp('\\b' + w + '\\b', 'i');
    if (wordRe.test(html)) return html.replace(wordRe, m => m + ' ' + span);
    return `<span class="lore-namesake-name">${esc(p.word)}</span> ${span}. ${html}`;
  }
  // Inner HTML for the "Namesake:" line (or '' ). Falls back to a bare
  // "Kikimora (kih-KEE-mor-uh)" when a hard-named ship has no namesake text.
  function namesakeInner(namesakeText, shipName) {
    if (namesakeText) return namesakePron(namesakeText, shipName);
    const p = pronFor(shipName);
    return p ? `<span class="lore-namesake-name">${esc(p.word)}</span> ${pronSpan(p)}` : '';
  }
  function sayName(btn) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const word = btn.getAttribute('data-word') || '';
      const say = btn.getAttribute('data-say') || word;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(say.replace(/-/g, ' ').toLowerCase());
      u.rate = 0.9;
      synth.speak(u);
      btn.classList.add('pron-speaking');
      u.onend = () => btn.classList.remove('pron-speaking');
    } catch (e) { /* speech optional */ }
  }
  // Rule/description text: escape everything, then re-allow our own <b> emphasis
  // (rules text stores verbatim bold via <b> tags) and turn newlines into breaks.
  function ruleHtml(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/\n/g, '<br>'); }

  const CATEGORY_ORDER = ['light', 'medium', 'heavy', 'colossal', 'payload'];
  const CATEGORY_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy', colossal: 'Colossal', payload: 'Payload', famous_admirals: 'Famous Admiral' };
  // Battlegroups print heaviest-first (Colossal > Heavy > Medium > Light, payloads
  // last), matching the text export and the desktop sheet. Array.sort is stable.
  const GROUP_CAT_ORDER = { colossal: 0, heavy: 1, medium: 2, light: 3, payload: 4 };
  function sortGroupsByWeight(groups) {
    return [...(groups || [])].sort((a, b) =>
      (GROUP_CAT_ORDER[a.ships[0]?.groupCategory] ?? 9) - (GROUP_CAT_ORDER[b.ships[0]?.groupCategory] ?? 9));
  }
  function groupCatOf(g) { return (g && g.ships && g.ships[0] && g.ships[0].groupCategory) || 'medium'; }
  // Spell out the single-letter tonnage code for display (L = Light, not Large).
  // Stored values stay single-letter — this is display only.
  const TON_WORDS = { L: 'Light', M: 'Medium', H: 'Heavy', C: 'Colossal', P: 'Payload' };
  function tonLabel(t) { return TON_WORDS[t] || t || ''; }

  /* ── Persistence (shared dfc_fleets) ───────────────────── */
  const STORAGE_KEY = 'dfc_fleets';
  function saveFleets() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fleets)); } catch (e) {}
  }
  function loadFleets() {
    try { fleets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { fleets = []; }
    // Normalize: ensure desktop-shaped fields exist; migrate any legacy mobile fleets.
    let migrated = false;
    fleets.forEach(f => {
      if (!Array.isArray(f.admirals)) { f.admirals = f.admiral ? [f.admiral] : []; delete f.admiral; migrated = true; }
      // Legacy mobile shape used `groups` with embedded `ship` + `qty`. Convert.
      if (!Array.isArray(f.battleGroups)) {
        f.battleGroups = [];
        if (Array.isArray(f.groups)) {
          f.groups.forEach(g => {
            if (!g.ship) return;
            const qty = g.qty || 1;
            const ships = [];
            for (let i = 0; i < qty; i++) {
              ships.push({ id: uuid(), shipKey: g.shipId || g.shipKey, groupCategory: g.category, points: g.ship.cost || 0, loadouts: {} });
            }
            f.battleGroups.push({ id: g.id || uuid(), name: g.ship.name, ships });
          });
          delete f.groups;
        }
        migrated = true;
      }
      if (f.targetPoints && !f.gameSize) { f.gameSize = sizeForPoints(f.targetPoints); migrated = true; }
      if (!f.gameSize) { f.gameSize = 'clash'; migrated = true; }
      if (!f.pointsLimit) { f.pointsLimit = (GAME_SIZES[f.gameSize] || GAME_SIZES.clash).max; }
      // Merge legacy duplicate payload groups (Bioficer Cells) into one group each —
      // older fleets spawned a separate 1-ship group per copy, spamming the list.
      if (Array.isArray(f.battleGroups)) {
        const firstByKey = {}, kept = [];
        f.battleGroups.forEach(g => {
          const s = g.ships && g.ships[0];
          if (s && s.groupCategory === 'payload') {
            if (firstByKey[s.shipKey]) { firstByKey[s.shipKey].ships.push(...g.ships); migrated = true; return; }
            firstByKey[s.shipKey] = g;
          }
          kept.push(g);
        });
        f.battleGroups = kept;
      }
    });
    if (migrated) saveFleets();
  }
  function viewDesktop() {
    localStorage.setItem('dfc_force_desktop', '1');
    location.href = '../';
  }

  /* ── Lookups ───────────────────────────────────────────── */
  function findFaction(key) { return FACTIONS[key] || null; }

  // Lazy faction loading — fetch a faction file only when needed, cache the promise.
  const factionLoading = {};
  function ensureFaction(key) {
    if (!key) return Promise.resolve(null);
    if (FACTIONS[key]) return Promise.resolve(FACTIONS[key]);
    if (factionLoading[key]) return factionLoading[key];
    const url = FACTION_FILES[key];
    if (!url) return Promise.resolve(null);
    factionLoading[key] = fetch(url).then(r => r.json()).then(d => { FACTIONS[key] = d; return d; })
      .catch(e => { console.warn('load faction', key, e); return null; });
    return factionLoading[key];
  }
  function findShip(factionKey, category, shipKey) {
    const f = FACTIONS[factionKey];
    if (!f) return null;
    const g = (f.groups || []).find(g => g.id === shipKey || (g.category === category && g.id === shipKey));
    return g ? g.ship : null;
  }
  function findFamousAdmiral(factionKey, admiralId) {
    const f = FACTIONS[factionKey];
    if (!f) return null;
    return (f.admirals || []).find(a => a.id === admiralId) || null;
  }

  // Resolve a ship group entry by category + name fragment (for starter specs).
  function findGroupByName(factionKey, category, namePart) {
    const f = FACTIONS[factionKey];
    if (!f) return null;
    const lc = namePart.toLowerCase();
    const inCat = (f.groups || []).filter(g => g.category === category);
    let sub = null;
    for (const g of inCat) {
      const sn = (g.ship?.name || '').toLowerCase();
      if (sn === lc || sn === lc + 's') return g;
      if (!sub && (sn.startsWith(lc) || sn.includes(lc))) sub = g;
    }
    return sub;
  }

  async function buildStarterFleet(spec) {
    await ensureFaction(spec.faction);   // starter ships need the faction data loaded
    const size = GAME_SIZES[spec.size] || GAME_SIZES.skirmish;
    const battleGroups = [];
    // A starter group entry is either the legacy [category, name, qty] tuple OR an
    // object {cat, ship, qty, name, systems} — the object form names the group and
    // pre-selects modular systems (Resistance fastplay ships ship WITH modules chosen).
    spec.groups.forEach(entry => {
      const e = Array.isArray(entry)
        ? { cat: entry[0], ship: entry[1], qty: entry[2], name: null, systems: null }
        : { cat: entry.cat, ship: entry.ship, qty: entry.qty || 1, name: entry.name || null, systems: entry.systems || null };
      const g = findGroupByName(spec.faction, e.cat, e.ship);
      if (!g) return;
      const ships = [];
      for (let i = 0; i < e.qty; i++) {
        const inst = makeShipInstance(spec.faction, e.cat, g.id);
        if (e.systems && e.systems.length) {
          inst.systems = e.systems.slice();
          inst.points = recalcShipPoints(spec.faction, g.ship, inst);
        }
        ships.push(inst);
      }
      battleGroups.push({ id: uuid(), name: e.name || g.ship.name, ships });
    });
    if (!battleGroups.length) return;
    const fleet = {
      id: uuid(), name: spec.name, description: '', faction: spec.faction,
      gameSize: spec.size, pointsLimit: size.max, maxGroups: size.groups,
      admirals: [], battleGroups, spaceStation: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    fleets.push(fleet);
    saveFleets();
    openFleet(fleets.length - 1);
  }
  function openStarterFleets() {
    showActionSheet(STARTER_SPECS.map(spec => ({
      label: (FACTION_INFO[spec.faction]?.name || spec.faction) + ', Fast Play Sheet',
      action: () => buildStarterFleet(spec)
    })));
  }

  /* ── Deployable Features ───────────────────────────────── */
  function shipRuleNames(ship) {
    return (ship?.specialRules || []).map(r => r.name).join(' ');
  }
  function isFeatureCarrier(ship) {
    if (!ship) return false;
    const names = shipRuleNames(ship);
    const hay = (ship.rulesText || '') + ' ' + names;
    // The Genitor Tower is a Payload S-1, so only Porter S ships may carry it (a
    // Porter L can't take a size-S payload). The porter size lives in the
    // capacity stat string `stats.special` (e.g. "Porter S-1" / "Porter L-1"),
    // not the generic "Porter S/L-X" rule name. Hard-codes size S (the only
    // Bioficer deployable feature today).
    return /Deployable Feature|Feature Carrier/i.test(hay) || /Porter\s*S\b/i.test(ship.stats?.special || '');
  }
  function featureRequired(ship) {
    if (!ship) return false;
    return /Deployable Feature|Feature Carrier/i.test((ship.rulesText || '') + ' ' + shipRuleNames(ship));
  }
  function factionFeatures(factionKey) {
    return (FACTIONS[factionKey]?.deployableFeatures) || [];
  }
  function featureCost(factionKey, featureName) {
    if (!featureName) return 0;
    const f = factionFeatures(factionKey).find(x => x.name === featureName);
    return f ? (f.cost || 0) : 0;
  }

  /* ── Systems / Hardpoints (Resistance) ─────────────────── */
  // A ship is "fully modular" when it has a Systems selection and NO fixed
  // loadout at all — no base weapons AND no base launch loads. Its armament is
  // built entirely from chosen systems, so the art is just a base-hull
  // placeholder. We desaturate it to signal "blank until configured" (mirrors
  // the desktop ship-img-modular treatment). Ships with a fixed load (e.g. the
  // Strike Carrier's Dropships) are NOT fully modular.
  function isFullyModular(ship) {
    return !!(ship && ship.systemSelection
      && (!ship.weapons || ship.weapons.length === 0)
      && (!ship.loads || ship.loads.length === 0));
  }
  // True if this ship can deliver Battalions to the ground (Bulk Lander / Dropship
  // / Drop Pod loads), directly or via a loadout option. Boarding Pods are for
  // boarding actions, not ground drop, so they don't count.
  function shipHasDrop(ship) {
    const re = /bulk lander|dropship|drop pod/i;
    const has = arr => (arr || []).some(l => re.test((l && l.name) || ''));
    return has(ship && ship.loads) || ((ship && ship.loadoutOptions) || []).some(lo => (lo.options || []).some(o => has(o.loads)));
  }
  function systemsListFor(ship, factionKey) {
    const seln = ship && ship.systemSelection;
    if (!seln) return null;
    const lists = (FACTIONS[factionKey]?.systemsLists) || {};
    const list = lists[seln.listName];
    return (list && Array.isArray(list.options) && list.options.length) ? list : null;
  }
  function findSystemOption(list, name) { return list.options.find(o => o.name === name) || null; }
  function summariseSystems(inst, list, seln) {
    const counts = {};
    (inst.systems || []).forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const total = (inst.systems || []).length;
    const capUsage = {};
    Object.keys(seln.categoryCaps || {}).forEach(k => { capUsage[k] = 0; });
    // catCounts: exact per-category tallies, drives the per-tier hardpoint model.
    const catCounts = {};
    (inst.systems || []).forEach(n => {
      const o = findSystemOption(list, n);
      if (!o) return;
      Object.keys(capUsage).forEach(k => { if ((o.category || '').startsWith(k)) capUsage[k]++; });
      const cat = o.category || '';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    return { counts, total, capUsage, catCounts };
  }
  function canAddSystem(inst, ship, factionKey, optName) {
    const seln = ship.systemSelection;
    const list = systemsListFor(ship, factionKey);
    if (!seln || !list) return false;
    const opt = findSystemOption(list, optName);
    if (!opt) return false;
    const { counts, total, capUsage, catCounts } = summariseSystems(inst, list, seln);
    if (opt.oncePerShip && (counts[optName] || 0) >= 1) return false;
    if (seln.categoryReq) {                                  // per-tier: block at this tier's max
      const req = seln.categoryReq[opt.category || ''];
      const max = (req && req.max != null) ? req.max : 0;
      return (catCounts[opt.category || ''] || 0) < max;
    }
    if (total >= seln.totalRequired) return false;
    for (const [k, max] of Object.entries(seln.categoryCaps || {})) {
      if ((opt.category || '').startsWith(k) && capUsage[k] >= max) return false;
    }
    return true;
  }
  function systemsCost(factionKey, ship, inst) {
    const list = systemsListFor(ship, factionKey);
    if (!list || !inst.systems) return 0;
    return inst.systems.reduce((t, n) => t + (findSystemOption(list, n)?.cost || 0), 0);
  }

  function sizeForPoints(pts) {
    for (const [k, s] of Object.entries(GAME_SIZES)) {
      if (pts >= s.min && pts <= s.max) return k;
    }
    return 'clash';
  }

  /* ── Fleet math ────────────────────────────────────────── */
  function shipLoadoutCost(ship, loadouts) {
    if (!ship?.loadoutOptions?.length) return 0;
    let extra = 0;
    ship.loadoutOptions.forEach((lo, i) => {
      const sel = loadouts && loadouts[i] != null ? loadouts[i] : 0;
      extra += lo.options[sel]?.cost || 0;
    });
    return extra;
  }
  // Unified per-ship points: base + loadout options + chosen feature + systems.
  function recalcShipPoints(factionKey, shipDef, inst) {
    return (shipDef?.cost || 0)
      + shipLoadoutCost(shipDef, inst.loadouts)
      + featureCost(factionKey, inst.feature)
      + systemsCost(factionKey, shipDef, inst);
  }
  function groupPoints(fleet, group) {
    return (group.ships || []).reduce((t, s) => t + (s.points || 0), 0);
  }
  function fleetPoints(fleet) {
    let pts = 0;
    (fleet.battleGroups || []).forEach(g => { pts += groupPoints(fleet, g); });
    (fleet.admirals || []).forEach(a => { pts += a.points || 0; });
    if (fleet.spaceStation) pts += fleet.spaceStation.cost || 0;
    return pts;
  }
  function countableGroups(fleet) {
    return (fleet.battleGroups || []).filter(g => g.ships[0]?.groupCategory !== 'payload');
  }

  /* ── Validation (subset of desktop rules) ──────────────── */
  function validateFleet(fleet) {
    const w = [];
    if (!fleet) return w;
    const size = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    const pts = fleetPoints(fleet);
    // Only over-budget is flagged; the live points total already shows progress
    // toward the minimum, so a "below minimum" warning is just constant noise.
    const limit = fleet.pointsLimit || size.max;   // custom cap (shared w/ desktop) overrides bracket
    if (pts > limit && limit !== 99999) w.push({ t: 'error', m: `Over budget: ${pts}/${limit} pts` });

    const gc = countableGroups(fleet).length;
    if (gc > size.groups) w.push({ t: 'error', m: `Too many groups: ${gc}/${size.groups}` });

    // Admiral required
    if (!fleet.admirals || fleet.admirals.length === 0) {
      w.push({ t: 'error', m: 'Fleet must contain an Admiral', fix: 'admiral' });
    }
    // Admiral level cap + un-picked abilities (soft)
    const facAdmirals = (FACTIONS[fleet.faction]?.admirals) || [];
    (fleet.admirals || []).forEach(a => {
      if (a.level && a.level > size.maxAdmiralLevel) {
        w.push({ t: 'error', m: `${a.name} (Lv${a.level}) exceeds max Lv${size.maxAdmiralLevel} for ${size.label}` });
      }
      const def = facAdmirals.find(x => x.id === a.admiralId);
      const picks = def ? (def.abilityPicks || 0) : 0;
      const chosen = (a.selectedAbilities || []).length;
      if (picks > 0 && chosen < picks) {
        w.push({ t: 'warn', m: `${a.name}: choose ${picks} Abilit${picks > 1 ? 'ies' : 'y'} (${chosen}/${picks})` });
      }
    });
    // One famous/named admiral max
    const named = (fleet.admirals || []).filter(a => a.type === 'Famous' || a.admiralId).length;
    if (named > 1) w.push({ t: 'error', m: `Only one named Admiral per fleet (you have ${named})` });

    // Colossal cap
    const colossal = fleet.battleGroups.filter(g => g.ships[0]?.groupCategory === 'colossal');
    if (colossal.length > (size.colossalMax ?? 99)) {
      w.push({ t: 'error', m: `Too many Colossal groups: ${colossal.length}/${size.colossalMax}` });
    }

    // Group size + unique/rare
    const counts = {};
    fleet.battleGroups.forEach(g => {
      if (!g.ships.length) return;
      const s = g.ships[0];
      const db = findShip(fleet.faction, s.groupCategory, s.shipKey);
      if (!db) return;
      // Payloads (Bioficer Cells) have no group size — exempt from min/max.
      const min = db.groupMin || 1, max = s.groupCategory === 'payload' ? Infinity : (db.groupMax || 1);
      if (g.ships.length < min) w.push({ t: 'warn', m: `${db.name}: needs ${min} (has ${g.ships.length})` });
      if (g.ships.length > max) w.push({ t: 'error', m: `${db.name}: max ${max} (has ${g.ships.length})` });
      const key = s.shipKey;
      if (!counts[key]) counts[key] = { n: db.name, c: 0, rare: db.isRare, uniq: db.isUnique };
      counts[key].c++;
    });
    const rareMax = RARE_MAX[fleet.gameSize] || 2;
    Object.values(counts).forEach(i => {
      if (i.uniq && i.c > 1) w.push({ t: 'error', m: `${i.n} is Unique, max 1 group` });
      if (i.rare && i.c > rareMax) w.push({ t: 'error', m: `${i.n} is Rare, max ${rareMax} at ${size.label}` });
    });

    // Tonnage restrictions
    let light = 0, medium = 0, heavy = 0;
    fleet.battleGroups.forEach(g => {
      const s0 = g.ships[0];
      const cat = s0?.groupCategory;
      // Argonaut "Mind of its Own": excluded from the 4.2 tonnage-points budget.
      const db0 = s0 ? findShip(fleet.faction, s0.groupCategory, s0.shipKey) : null;
      if (db0 && db0.noTonnageCount) return;
      const p = groupPoints(fleet, g);
      if (cat === 'light') light += p; else if (cat === 'medium') medium += p; else if (cat === 'heavy') heavy += p;
    });
    if (heavy > medium) w.push({ t: 'error', m: `Heavy points (${heavy}) can’t exceed Medium points (${medium}) (rulebook 4.2)` });
    if (light > medium + heavy) w.push({ t: 'error', m: `Light points (${light}) can’t exceed Medium + Heavy points (${medium + heavy}) (rulebook 4.2)` });

    // Payload capacity — Payload Ships "take up X of a Porter Ship's capacity" and
    // must be assigned to a Porter of the same size letter (S or L). Soft warning
    // when total Payload of a letter exceeds total Porter capacity of that letter.
    const porterCap = {}, payloadDemand = {};
    const tallyPorter = special => {
      let m;
      const pRe = /Porter\s*([SLF])-(\d+)/gi;
      while ((m = pRe.exec(special || ''))) { const L = m[1].toUpperCase(); porterCap[L] = (porterCap[L] || 0) + parseInt(m[2], 10); }
      const dRe = /Payload\s*([SLF])-(\d+)/gi;
      while ((m = dRe.exec(special || ''))) { const L = m[1].toUpperCase(); payloadDemand[L] = (payloadDemand[L] || 0) + parseInt(m[2], 10); }
    };
    fleet.battleGroups.forEach(g => {
      g.ships.forEach(s => {
        const db = findShip(fleet.faction, s.groupCategory, s.shipKey);
        tallyPorter(db && db.stats && db.stats.special);
      });
    });
    // Famous-admiral flagships count too (e.g. Atlas's Catastrophe is Porter S-1).
    (fleet.admirals || []).forEach(a => {
      const fs = admiralFlagship(a);
      tallyPorter(fs && fs.stats && fs.stats.special);
    });
    ['S', 'L', 'F'].forEach(letter => {
      const demand = payloadDemand[letter] || 0;
      if (demand > (porterCap[letter] || 0)) {
        w.push({ t: 'warn', m: `Payload ${letter}: ${demand} assigned, fleet Porter ${letter} capacity ${porterCap[letter] || 0}` });
      }
    });

    // Deployable Features are always OPTIONAL now — never flagged for an empty slot
    // (a carrier can pick/swap one right before the game).
    fleet.battleGroups.forEach((g, gi) => {
      const s = g.ships[0];
      if (!s) return;
      const db = findShip(fleet.faction, s.groupCategory, s.shipKey);
      // Systems / Hardpoints validation
      const list = db && systemsListFor(db, fleet.faction);
      const seln = db && db.systemSelection;
      if (list && seln) {
        const { total, capUsage, catCounts } = summariseSystems(s, list, seln);
        if (seln.categoryReq) {
          // Per-tier hardpoint requirements (Bioficer dreadnoughts).
          Object.entries(seln.categoryReq).forEach(([cat, req]) => {
            const c = catCounts[cat] || 0;
            const min = req.min || 0, max = req.max != null ? req.max : Infinity;
            if (c < min) w.push({ t: 'warn', m: `${db.name}: choose ${min === max ? min : min + '+'} from ${cat} (has ${c})` });
            else if (c > max) w.push({ t: 'error', m: `${db.name}: max ${max} from ${cat} (has ${c})` });
          });
        } else if (seln.totalIsExact && total !== seln.totalRequired) {
          w.push({ t: total < seln.totalRequired ? 'warn' : 'error',
            m: `${db.name}: ${total < seln.totalRequired ? 'choose' : 'too many, max'} ${seln.totalRequired} ${seln.listName} (has ${total})` });
        } else if (!seln.totalIsExact && total > seln.totalRequired) {
          w.push({ t: 'error', m: `${db.name}: max ${seln.totalRequired} ${seln.listName} (has ${total})` });
        }
        Object.entries(seln.categoryCaps || {}).forEach(([k, max]) => {
          if (capUsage[k] > max) w.push({ t: 'error', m: `${db.name}: max ${max} from ${k} (has ${capUsage[k]})` });
        });
      }
    });

    // Generic space station needs its required armaments (soft nudge).
    if (fleet.spaceStation) {
      const spec = stationArmamentSpec(fleet.spaceStation);
      if (spec) {
        const { armTotal } = summariseStation(fleet.spaceStation);
        if (armTotal < spec.required) {
          w.push({ t: 'warn', m: `${fleet.spaceStation.name}: choose ${spec.required} armament${spec.required > 1 ? 's' : ''} (has ${armTotal})`, fix: 'station' });
        }
      }
    }

    return w;
  }

  /* ── Navigation ────────────────────────────────────────── */
  const history = [];
  const RENDERERS = {
    'screen-fleet-list': renderFleetList,
    'screen-fleet-detail': renderFleetDetail,
    'screen-add-group': renderShipPicker,
    'screen-group-detail': renderGroupDetail,
    'screen-admiral': renderAdmiralPicker,
    'screen-admiral-detail': renderAdmiralDetail,
    'screen-station': renderStationPicker,
    'screen-station-detail': renderStationDetail,
    'screen-play': renderMobilePlay
  };

  function navigate(screenId, opts) {
    const current = document.querySelector('.screen.active');
    if (current && !opts?.replace) history.push({ id: current.id, scroll: window.scrollY });
    if (RENDERERS[screenId]) RENDERERS[screenId]();
    if (current && !opts?.replace) {
      current.classList.remove('active');
      current.classList.add('slide-out-left');
      setTimeout(() => current.classList.remove('slide-out-left'), 220);
    } else if (current) {
      current.classList.remove('active');
    }
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      if (current && !opts?.replace) {
        target.classList.add('slide-in-right');
        setTimeout(() => target.classList.remove('slide-in-right'), 220);
      }
      window.scrollTo(0, 0);
    }
    afterNav(screenId);
  }
  function goBack() {
    if (!history.length) { navigate('screen-fleet-list', { replace: true }); return; }
    const prev = history.pop();
    const current = document.querySelector('.screen.active');
    if (RENDERERS[prev.id]) RENDERERS[prev.id]();
    if (current) {
      current.classList.remove('active');
      current.classList.add('slide-out-right');
      setTimeout(() => current.classList.remove('slide-out-right'), 220);
    }
    const target = document.getElementById(prev.id);
    if (target) {
      target.classList.add('active', 'slide-in-left');
      setTimeout(() => target.classList.remove('slide-in-left'), 220);
    }
    window.scrollTo(0, prev.scroll || 0);
    afterNav(prev.id);
  }
  function afterNav(screenId) {
    updateAppBar(screenId);
    const fab = document.getElementById('fab-add-group');
    if (fab) fab.style.display = screenId === 'screen-fleet-detail' ? '' : 'none';
    // Privacy-friendly analytics: count each screen as a virtual pageview.
    if (window.goatcounter && window.goatcounter.count) {
      const p = '/mobile/' + screenId.replace('screen-', '');
      window.goatcounter.count({ path: p, title: screenId, event: false });
    }
  }

  function updateAppBar(screenId) {
    const back = document.getElementById('app-bar-back');
    const title = document.getElementById('app-bar-title');
    const menu = document.getElementById('app-bar-menu');
    const overflow = document.getElementById('app-bar-overflow');
    const ptsEl = document.getElementById('app-bar-pts');
    back.classList.add('hidden'); menu.classList.add('hidden'); overflow.classList.add('hidden');
    ptsEl.classList.add('hidden'); ptsEl.textContent = '';

    const showPts = () => {
      if (!activeFleet) return;
      const pts = fleetPoints(activeFleet);
      const limit = activeFleet.pointsLimit || (GAME_SIZES[activeFleet.gameSize] || GAME_SIZES.clash).max;
      // Match desktop format: "X / limit pts" + "Y left / over" with over-budget styling.
      let txt = `${pts} / ${limit === 99999 ? '∞' : limit} pts`;
      if (limit !== 99999) {
        const rem = limit - pts;
        txt += ` · ${rem >= 0 ? rem + ' left' : Math.abs(rem) + ' over'}`;
      }
      ptsEl.textContent = txt;
      const over = limit !== 99999 && pts > limit;
      ptsEl.classList.toggle('pts-over', over);
      ptsEl.classList.remove('hidden');
      // Warning pulse only on the moment you cross into over-budget, not while over.
      if (over && !_wasOverBudget) haptic(HAPTIC.over);
      _wasOverBudget = over;
    };

    switch (screenId) {
      case 'screen-fleet-list': menu.classList.remove('hidden'); title.textContent = 'Fleet Builder'; break;
      case 'screen-fleet-detail': back.classList.remove('hidden'); overflow.classList.remove('hidden'); title.textContent = 'Fleet'; showPts(); break;
      case 'screen-add-group': back.classList.remove('hidden'); title.textContent = 'Add Group'; showPts(); break;
      case 'screen-group-detail': { back.classList.remove('hidden'); overflow.classList.remove('hidden'); const _ag = (activeFleet && activeGroupIdx >= 0) ? activeFleet.battleGroups[activeGroupIdx] : null; title.textContent = (_ag && _ag.name) ? _ag.name : 'Group'; showPts(); break; }
      case 'screen-admiral': back.classList.remove('hidden'); title.textContent = 'Add Admiral'; showPts(); break;
      case 'screen-admiral-detail': back.classList.remove('hidden'); title.textContent = 'Admiral'; showPts(); break;
      case 'screen-station': back.classList.remove('hidden'); title.textContent = 'Space Station'; showPts(); break;
      case 'screen-station-detail': back.classList.remove('hidden'); title.textContent = 'Space Station'; showPts(); break;
      case 'screen-play': back.classList.remove('hidden'); title.textContent = (mPlayFleet ? esc(mPlayFleet.name) + ' — Play' : 'Play Mode'); break;
    }
  }

  /* ── Screen: Fleet List ────────────────────────────────── */
  function renderFleetList() {
    const c = document.getElementById('fleet-list-rows');
    if (!fleets.length) {
      c.innerHTML = `<div class="empty-state">
        <div class="empty-state-title">No fleets yet</div>
        <div class="empty-state-sub">New to Dropfleet? Load one of the Fast Play Sheets, or build a fleet from scratch.</div>
        <button class="btn btn-primary" style="margin-top:var(--sp-l)" onclick="App.openStarterFleets()">Load Fast Play Sheets</button>
      </div>`;
      return;
    }
    // Most-recent first
    const order = fleets.map((f, i) => ({ f, i })).sort((a, b) => (b.f.updatedAt || 0) - (a.f.updatedAt || 0));
    c.innerHTML = order.map(({ f, i }) => {
      const pts = fleetPoints(f);
      const limit = f.pointsLimit || (GAME_SIZES[f.gameSize] || GAME_SIZES.clash).max;
      const gc = (f.battleGroups || []).length;
      const icon = FACTION_ICONS[f.faction];
      const info = FACTION_INFO[f.faction];
      const pct = Math.min(100, (pts / limit) * 100);
      const over = pts > limit;
      return `<div class="list-row" onclick="App.openFleet(${i})">
        ${icon ? `<img src="${icon}" alt="" class="faction-icon" loading="lazy">` : ''}
        <div class="list-row-content">
          <div class="list-row-title">${esc(f.name || 'Unnamed Fleet')}</div>
          <div class="list-row-sub">${pts} / ${limit} pts · ${gc} group${gc !== 1 ? 's' : ''}, ${(GAME_SIZES[f.gameSize] || {}).label || ''}</div>
          <div class="fleet-row-bar"><div class="fleet-row-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
        </div>
      </div>`;
    }).join('');
  }

  /* The "guided coach" banner was removed — it editorialised with AI-written
     filler copy and duplicated the legality warnings. The warnings + empty
     states already tell you the next step. */

  /* ── Screen: Fleet Detail ──────────────────────────────── */
  function openFleet(index) {
    activeFleet = fleets[index];
    activeFleet._index = index;
    navigate('screen-fleet-detail');
  }

  function renderFleetDetail() {
    const f = activeFleet;
    if (!f) return;
    const pts = fleetPoints(f);
    const size = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const limit = f.pointsLimit || size.max;
    const info = FACTION_INFO[f.faction];

    document.getElementById('fleet-detail-name').textContent = f.name || 'Unnamed Fleet';
    document.getElementById('fleet-detail-sub').textContent =
      `${info?.name || f.faction} · ${size.label}, ${(f.battleGroups || []).length} group${(f.battleGroups || []).length !== 1 ? 's' : ''}`;

    const pct = Math.min(100, (pts / limit) * 100);
    const over = pts > limit;
    document.getElementById('fleet-pts-current').textContent = `${pts} / ${limit} pts`;
    // Only surface the over-budget delta (the "X left" was redundant with the
    // "N / max pts" line above).
    document.getElementById('fleet-pts-remaining').textContent = over ? `${pts - limit} over` : '';
    const fill = document.getElementById('fleet-pts-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', over);

    // Warnings — tappable when they have a fix
    const warns = validateFleet(f);
    const warnEl = document.getElementById('fleet-warnings');
    const legal = warns.length === 0;
    // Play-ready status lives up top next to the fleet name: green check when
    // ready, red mark when not. No separate "Legal fleet" line either way.
    // Tapping the red mark reveals the alerts (declutter: no standalone lines).
    const warnTitle = legal ? 'Legal fleet, ready to play' : warns.map(w => w.m).join('\n');
    const tap = legal ? '' : ' onclick="App.toggleWarnings()" role="button" tabindex="0" aria-label="Tap to see why the fleet is not ready"';
    // Illegal mark is a tappable pill (icon + caret) so it clearly invites a tap;
    // iOS won't show the title tooltip on tap, so the caret is the real affordance.
    const markInner = legal ? STATUS_ICON.ok : `${STATUS_ICON.error}<span class="legal-bad-caret">▾</span>`;
    const nm = document.getElementById('fleet-detail-name');
    if (nm) nm.innerHTML = `${esc(f.name || 'Unnamed Fleet')} <span class="fleet-legal-check ${legal ? '' : 'legal-bad'}"${tap} title="${esc(warnTitle)}">${markInner}</span>`;
    if (warns.length) {
      warnEl.classList.add('hidden');   // collapsed; tap the red mark up top to reveal
      warnEl.innerHTML = warns.map(w => {
        const icon = w.fix === 'admiral' ? STATUS_ICON.admiral : (w.t === 'error' ? STATUS_ICON.error : STATUS_ICON.warn);
        const cls = w.t === 'error' ? 'warn-error' : 'warn-soft';
        const onclick = w.fix === 'admiral' ? ` onclick="App.openAdmiral()" style="cursor:pointer"`
          : w.fix === 'station' ? ` onclick="App.openStationDetail()" style="cursor:pointer"`
          : w.fix === 'group' ? ` onclick="App.openGroup(${w.gi})" style="cursor:pointer"` : '';
        const arrow = w.fix ? ' <span class="warn-fix">Fix ›</span>' : '';
        return `<div class="warning-item ${cls}"${onclick}><span class="warning-icon">${icon}</span><span>${esc(w.m)}${arrow}</span></div>`;
      }).join('');
    } else {
      warnEl.classList.add('hidden');
      warnEl.innerHTML = '';
    }

    // Groups
    const groupsEl = document.getElementById('fleet-groups');
    let html = '';
    // Famous admirals fly their own flagship — it's a ship on the table, so it
    // shows here among the groups (sourced from the admiral; its cost is already
    // counted in the admiral's points, so no separate pts here to avoid
    // double-counting). Tapping it opens the admiral.
    const flagshipCards = (f.admirals || []).map((a, ai) => {
      const fs = admiralFlagship(a);
      if (!fs) return '';
      const art = shipArtPath(fs.name);
      const sizeClass = fs.category ? (CATEGORY_LABELS[fs.category] || '') : tonLabel(fs.tonnage);
      return `<div class="list-row flagship-row" onclick="App.openAdmiralDetail(${ai})">
        ${art ? `<div class="ship-thumb"><img src="${thumbUrl(art)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb"></div>'}
        <div class="list-row-content">
          <div class="list-row-title">${flagshipLabel(fs, true, true)}</div>
          <div class="list-row-sub">${sizeClass ? esc(sizeClass) + ', ' : ''}flies with ${esc(a.name)}</div>
        </div>
        <span class="list-chevron">›</span>
      </div>`;
    }).join('');
    // No empty-state block when there are no groups — the section header's
    // "Add Group" button (and the FAB) are the affordance; show nothing.
    if ((f.battleGroups || []).length) {
      // Groups auto-bucket by weight class (heaviest first), matching desktop's
      // overview panel and the print/share output — screen order now always
      // agrees with what gets printed. The underlying array keeps insertion
      // order; only the display is sorted (stable), so every existing handler
      // below still gets the group's REAL index (pair.i), unchanged.
      const catColors = { light: '#5b9bd5', medium: '#3e9945', heavy: '#d98c1f', colossal: '#c43c2f', payload: '#6a4c9c' };
      const paired = f.battleGroups.map((g, i) => ({ g, i }));
      const sortedPairs = [...paired].sort((a, b) => (GROUP_CAT_ORDER[groupCatOf(a.g)] ?? 9) - (GROUP_CAT_ORDER[groupCatOf(b.g)] ?? 9));
      const classCounts = {};
      sortedPairs.forEach(p => { const c = groupCatOf(p.g); classCounts[c] = (classCounts[c] || 0) + 1; });
      let lastCat = null;
      html += sortedPairs.map(({ g, i }) => {
        const s = g.ships[0];
        if (!s) return '';
        const db = findShip(f.faction, s.groupCategory, s.shipKey);
        const qty = g.ships.length;
        const gp = groupPoints(f, g);
        const art = shipArtPath(db?.name);
        const modCls = isFullyModular(db) ? ' ship-img-modular' : '';
        const { gMin, gMax } = groupQtyBounds(db, s.groupCategory);
        const cat = groupCatOf(g);
        const catLabel = CATEGORY_LABELS[cat] || cat;
        // A variable-size group gets an inline ×N stepper so you set the count
        // right here, no panel-hop. Fixed groups (gMin===gMax) just show ×N.
        const canVary = gMax > gMin;
        const titleQty = (!canVary && qty > 1) ? ' ×' + qty : '';
        const stepper = canVary ? `<div class="row-qty" onclick="event.stopPropagation()">
            <button class="counter-btn counter-btn-sm${qty <= gMin ? ' counter-btn-x' : ''}" onclick="event.stopPropagation();App.changeGroupQty(${i},-1)" aria-label="${qty <= gMin ? 'Remove group' : 'Remove one'}">${qty <= gMin ? '×' : '−'}</button>
            <span class="row-qty-num">×${qty}</span>
            <button class="counter-btn counter-btn-sm" onclick="event.stopPropagation();App.changeGroupQty(${i},1)" ${qty >= gMax ? 'disabled' : ''} aria-label="Add one">+</button>
          </div>` : '';
        const divider = cat !== lastCat
          ? `<div class="roster-cat-divider" style="--cat-color:${catColors[cat] || 'var(--navy)'}"><span class="roster-cat-label">${esc(catLabel)}</span></div>`
          : '';
        lastCat = cat;
        const grip = classCounts[cat] > 1
          ? `<span class="group-drag-grip" title="Drag to reorder within ${esc(catLabel)}" aria-label="Drag to reorder ${esc(g.name)} within its weight class" onpointerdown="App.onGripPointerDown(event,'${g.id}')"><svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="8" cy="3" r="1.3"/><circle cx="8" cy="7" r="1.3"/><circle cx="13" cy="3" r="1.3"/><circle cx="13" cy="7" r="1.3"/></svg></span>`
          : '';
        return `${divider}<div class="swipe-row" data-gcat="${cat}" data-gid="${g.id}">
          <button class="swipe-del" onclick="event.stopPropagation();App.swipeDeleteGroup(${i})" aria-label="Remove group">Remove</button>
          <div class="list-row swipe-fg" onclick="App.openGroup(${i})">
            ${grip}
            ${art ? `<div class="ship-thumb${modCls}"><img src="${thumbUrl(art)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb"></div>'}
            <div class="list-row-content">
              <div class="list-row-title">${esc((g.name && g.name !== (db?.name || 'Unknown')) ? g.name : (db?.name || 'Unknown'))}${titleQty}</div>
              <div class="list-row-sub">${gp} pts, ${(g.name && g.name !== (db?.name || 'Unknown')) ? esc(qty + '× ' + (db?.name || 'Unknown')) : (tonLabel(db?.tonnage) || CATEGORY_LABELS[s.groupCategory] || '')}</div>
            </div>
            ${stepper}
            <span class="list-chevron">›</span>
          </div>
        </div>`;
      }).join('');
    }
    html += flagshipCards;

    // Admiral slot(s)
    html += `<div class="section-header">Admiral</div>`;
    const admiralCount = (f.admirals || []).length;
    if (admiralCount) {
      html += f.admirals.map((a, i) => {
        const art = admiralArtPath(a.name);
        return `<div class="list-row" onclick="App.openAdmiralDetail(${i})">
          ${admiralThumb(f.faction, a.level, art)}
          <div class="list-row-content">
            <div class="list-row-title">${esc(a.name)}</div>
            <div class="list-row-sub">${a.points} pts, Level ${a.level || '?'}${a.shipName ? ', ' + esc(a.shipName) : ''}</div>
          </div>
          <span class="list-chevron">›</span>
        </div>`;
      }).join('');
    }
    // Always allow adding (more) admirals — rules permit any number.
    html += `<div class="add-slot" onclick="App.openAdmiral()">+ Add ${admiralCount ? 'Another ' : ''}Admiral</div>`;

    // Station slot
    html += `<div class="section-header">Space Station</div>`;
    if (f.spaceStation) {
      const stArt = stationArtPath(f.faction, f.spaceStation);
      const stSpec = stationArmamentSpec(f.spaceStation);
      const stSub = stSpec ? `${f.spaceStation.cost} pts, ${summariseStation(f.spaceStation).armTotal}/${stSpec.required} armaments` : `${f.spaceStation.cost} pts`;
      html += `<div class="list-row" onclick="App.openStationDetail()">
        ${stArt ? `<div class="ship-thumb"><img src="${thumbUrl(stArt)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb"></div>'}
        <div class="list-row-content">
          <div class="list-row-title">${esc(f.spaceStation.name)}</div>
          <div class="list-row-sub">${stSub}</div>
        </div>
        <span class="list-chevron">›</span>
      </div>`;
    } else {
      html += `<div class="add-slot add-slot-optional" onclick="App.openStation()"><span class="add-slot-opt">(Optional)</span> Add Space Station</div>`;
    }

    // Secondary Objectives — pick 2 for your game (rules data from the BSData
    // game system). Stored on the fleet so they travel with it (and share).
    if (SECONDARY_OBJECTIVES.length) {
      const sel = f.secondaryObjectives || [];
      const chosen = SECONDARY_OBJECTIVES.filter(o => sel.includes(o.name));
      html += `<div class="section-header">Secondary Objectives</div>`;
      if (chosen.length) {
        html += `<div class="list-row" onclick="App.openSecondaryModal()">
          <div class="list-row-content">
            <div class="list-row-title">${chosen.map(o => esc(o.name)).join(' · ')}</div>
            <div class="list-row-sub">${sel.length}/2 chosen, tap to edit</div>
          </div>
          <span class="list-chevron">›</span>
        </div>`;
      } else {
        html += `<div class="add-slot" onclick="App.openSecondaryModal()">+ Choose secondary objectives</div>`;
      }
    }

    groupsEl.innerHTML = html;
    setupGroupSwipe();
  }

  // Swipe a group row left to reveal a Remove action (the stepper × stays as the
  // visible fallback, per NN/g). Bound once; ignores the qty stepper and art thumb,
  // and only hijacks horizontal drags so vertical scrolling still works.
  function setupGroupSwipe() {
    const c = document.getElementById('fleet-groups');
    if (!c || c._swBound) return;
    c._swBound = true;
    let fg = null, sx = 0, sy = 0, dx = 0, dir = null, openFg = null, swiped = false;
    const closeOpen = () => { if (openFg) { openFg.style.transform = ''; openFg.classList.remove('swipe-open'); openFg = null; } };
    c.addEventListener('pointerdown', e => {
      if (e.target.closest('.row-qty') || e.target.closest('.ship-thumb') || e.target.closest('.swipe-del') || e.target.closest('.group-drag-grip')) return;
      const el = e.target.closest('.swipe-fg');
      if (el !== openFg) closeOpen();
      fg = el; sx = e.clientX; sy = e.clientY; dx = 0; dir = null; swiped = false;
    });
    c.addEventListener('pointermove', e => {
      if (!fg) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (dir === null) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      }
      if (dir !== 'h') { fg = null; return; }
      e.preventDefault(); swiped = true;
      dx = Math.max(-92, Math.min(0, (fg === openFg ? -88 : 0) + mx));
      fg.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!fg) return;
      if (dx < -46) { fg.style.transform = 'translateX(-88px)'; fg.classList.add('swipe-open'); openFg = fg; }
      else { fg.style.transform = ''; fg.classList.remove('swipe-open'); if (openFg === fg) openFg = null; }
      fg = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('click', e => {
      const el = e.target.closest('.swipe-fg');
      // Only a tap ON the row foreground gets swallowed (after a swipe, or to close
      // an open row). A tap on the revealed Remove button must pass through.
      if (el && (swiped || el === openFg)) {
        e.stopPropagation(); e.preventDefault();
        if (el === openFg) closeOpen();
      }
      swiped = false;
    }, true);
  }
  function swipeDeleteGroup(i) {
    const f = activeFleet;
    if (!f || !f.battleGroups[i]) return;
    f.battleGroups.splice(i, 1);
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.remove);
    renderFleetDetail();
  }

  // ── Drag-to-reorder battlegroups (within a weight class only) ──
  // Mirrors desktop: groups auto-bucket by weight class (heaviest first, matching
  // print/share); a grip reorders a group among its same-class siblings only.
  // Pointer Events, not native HTML5 drag-and-drop, so it works with touch.
  let groupDrag = null; // { gid, rowEl, startY, rowTop, rowH, peers, targetGid, after }

  function onGripPointerDown(ev, gid) {
    const f = activeFleet;
    if (!f) return;
    ev.preventDefault();
    ev.stopPropagation();
    const grip = ev.currentTarget;
    const row = grip.closest('.swipe-row');
    const dragged = f.battleGroups.find(g => g.id === gid);
    if (!row || !dragged) return;
    const cat = groupCatOf(dragged);
    const peers = [...document.querySelectorAll('#fleet-groups .swipe-row')]
      .filter(r => r.dataset.gcat === cat)
      .map(r => { const rc = r.getBoundingClientRect(); return { gid: r.dataset.gid, el: r, top: rc.top, height: rc.height }; });
    if (peers.length < 2) return;
    const rowRect = row.getBoundingClientRect();
    groupDrag = { gid, rowEl: row, startY: ev.clientY, rowTop: rowRect.top, rowH: rowRect.height, peers, targetGid: null, after: false };
    row.classList.add('dragging');
    try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
    grip.addEventListener('pointermove', onGripPointerMove);
    grip.addEventListener('pointerup', onGripPointerUp);
    grip.addEventListener('pointercancel', onGripPointerCancel);
    haptic(HAPTIC.tick);
  }

  function onGripPointerMove(ev) {
    if (!groupDrag) return;
    ev.preventDefault();
    const dy = ev.clientY - groupDrag.startY;
    groupDrag.rowEl.style.transform = `translateY(${dy}px)`;
    const centerY = groupDrag.rowTop + groupDrag.rowH / 2 + dy;
    groupDrag.peers.forEach(p => p.el.classList.remove('drag-over-before', 'drag-over-after'));
    let best = null, bestDist = Infinity;
    groupDrag.peers.forEach(p => {
      if (p.gid === groupDrag.gid) return;
      const dist = Math.abs(centerY - (p.top + p.height / 2));
      if (dist < bestDist) { bestDist = dist; best = p; }
    });
    if (best) {
      const after = centerY > (best.top + best.height / 2);
      best.el.classList.add(after ? 'drag-over-after' : 'drag-over-before');
      groupDrag.targetGid = best.gid;
      groupDrag.after = after;
    } else {
      groupDrag.targetGid = null;
    }
  }

  function endGripDrag(grip, commit) {
    grip.removeEventListener('pointermove', onGripPointerMove);
    grip.removeEventListener('pointerup', onGripPointerUp);
    grip.removeEventListener('pointercancel', onGripPointerCancel);
    if (!groupDrag) return;
    const { gid, targetGid, after, rowEl, peers } = groupDrag;
    rowEl.style.transform = '';
    rowEl.classList.remove('dragging');
    peers.forEach(p => p.el.classList.remove('drag-over-before', 'drag-over-after'));
    groupDrag = null;
    if (commit && targetGid) reorderGroupWithinClass(gid, targetGid, after);
  }

  function onGripPointerUp(ev) { endGripDrag(ev.currentTarget, true); }
  function onGripPointerCancel(ev) { endGripDrag(ev.currentTarget, false); }

  function reorderGroupWithinClass(draggedGid, targetGid, placeAfter) {
    const f = activeFleet;
    if (!f || !draggedGid || draggedGid === targetGid) return;
    const groups = f.battleGroups;
    const dragged = groups.find(g => g.id === draggedGid);
    const target = groups.find(g => g.id === targetGid);
    if (!dragged || !target || groupCatOf(dragged) !== groupCatOf(target)) return;
    groups.splice(groups.indexOf(dragged), 1);
    const ti = groups.indexOf(target);
    groups.splice(placeAfter ? ti + 1 : ti, 0, dragged);
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    renderFleetDetail();
  }

  function toggleSecondary(idx) {
    const f = activeFleet;
    if (!f) return;
    const obj = SECONDARY_OBJECTIVES[idx];
    if (!obj) return;
    f.secondaryObjectives = f.secondaryObjectives || [];
    const i = f.secondaryObjectives.indexOf(obj.name);
    if (i >= 0) f.secondaryObjectives.splice(i, 1);
    else {
      // Pick up to 2; at two, swap out the oldest instead of forcing a deselect first.
      if (f.secondaryObjectives.length >= 2) f.secondaryObjectives.shift();
      f.secondaryObjectives.push(obj.name);
    }
    f.updatedAt = Date.now();
    saveFleets();
    renderFleetDetail();
    if (document.getElementById('modal-secondary').classList.contains('active')) renderSecondaryModalBody();
  }

  // Secondary objectives picked in a pop-up modal (like the ability picker).
  function renderSecondaryModalBody() {
    const f = activeFleet;
    if (!f) return;
    const sel = f.secondaryObjectives || [];
    const sub = document.getElementById('secondary-modal-sub');
    if (sub) sub.textContent = sel.length >= 2 ? 'Both chosen. Tap another to swap it in, or tap a chosen one to drop it.' : `Pick ${2 - sel.length} more.`;
    const body = document.getElementById('secondary-modal-body');
    if (body) body.innerHTML = `<div class="secondary-list">` + SECONDARY_OBJECTIVES.map((o, i) => {
      const on = sel.includes(o.name);
      const locked = false; // tapping a new one swaps out the oldest, so nothing is locked
      return `<div class="secondary-item${on ? ' selected' : ''}${locked ? ' locked' : ''}" onclick="App.toggleSecondary(${i})">
        <span class="secondary-check">${on ? CHECK_SVG : ''}</span>
        <div class="secondary-body">
          <div class="secondary-name">${esc(o.name)}</div>
          <div class="secondary-desc">${esc(o.description)}</div>
        </div>
      </div>`;
    }).join('') + `</div>`;
  }
  function openSecondaryModal() {
    if (!activeFleet) return;
    renderSecondaryModalBody();
    document.getElementById('modal-secondary').classList.add('active');
  }
  function closeSecondaryModal() {
    document.getElementById('modal-secondary').classList.remove('active');
  }

  /* ── Screen: Ship Picker ───────────────────────────────── */
  function openAddGroup() {
    if (!activeFleet) return;
    pickerFilter = 'all';
    pickerAttrs.clear();
    const s = document.getElementById('picker-search');
    if (s) s.value = '';
    navigate('screen-add-group');
  }
  // Launch-capability icons for picker rows (fighters / fire ships / mines /
  // dropships / torpedoes / other), detected from the ship's loads.
  const LAUNCH_TYPE_DEFS = [
    { re: /fighter|bomber/i, label: 'Fighters / Bombers', icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l5.5 13L8 11l-5.5 3z"/></svg>' },
    { re: /fire\s*ship/i, label: 'Fire Ships', icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.5 2.5 3.5 3.5 3.5 7a3.5 3.5 0 0 1-7 0c0-1.4.6-2.3 1.3-3 .1 1 .7 1.4 1.4 1 0-1.9-.8-3.3.8-5z"/></svg>' },
    { re: /\bmine/i, label: 'Mines', icon: '<svg width="13" height="13" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.6v2.3M8 12.1v2.3M1.6 8h2.3M12.1 8h2.3M3.4 3.4l1.6 1.6M11 11l1.6 1.6M12.6 3.4 11 5M5 11l-1.6 1.6"/></g></svg>' },
    { re: /dropship|drop\s*pod|bulk\s*lander/i, label: 'Dropships / Landers', icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v8M4.5 6.5L8 10l3.5-3.5M2.5 14h11"/></svg>' },
    { re: /torpedo|boarding\s*pod/i, label: 'Torpedoes / Boarding Pods', icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="6" width="9" height="4" rx="2"/><path d="M10.5 8l4-2.2v4.4z"/></svg>' },
  ];
  const LAUNCH_TYPE_OTHER = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2" stroke-linecap="round"/></svg>';
  function shipLaunchIcons(ship, factionKey) {
    if (!ship) return '';
    const names = new Set();
    const add = loads => (loads || []).forEach(l => { if (l && l.name) String(l.name).split(/\s*&\s*/).forEach(p => names.add(p.trim().toLowerCase())); });
    add(ship.loads);
    (ship.loadoutOptions || []).forEach(lo => (lo.options || []).forEach(o => add(o.loads)));
    const list = systemsListFor(ship, factionKey);
    if (list) (list.options || []).forEach(o => add(o.loads));
    if (!names.size) return '';
    const arr = [...names];
    const icons = [];
    LAUNCH_TYPE_DEFS.forEach(t => { if (arr.some(n => t.re.test(n))) icons.push(`<span class="launch-type-chip">${t.icon}<span>${esc(t.label)}</span></span>`); });
    if (arr.some(n => !LAUNCH_TYPE_DEFS.some(t => t.re.test(n)))) icons.push(`<span class="launch-type-chip">${LAUNCH_TYPE_OTHER}<span>Other launch asset</span></span>`);
    return icons.length ? `<div class="ship-card-launch"><span class="launch-cap-lead">Launches</span>${icons.join('')}</div>` : '';
  }

  function renderShipPicker() {
    const f = activeFleet;
    if (!f) return;
    const faction = FACTIONS[f.faction];
    if (!faction) return;
    const groups = faction.groups || [];

    // Attribute filters — multi-select toggles (AND). Only the ones that exist
    // in this faction are shown.
    const attrDefs = [
      { key: 'launch',  label: 'Launch',  test: s => (s.loads && s.loads.length) || (s.loadoutOptions || []).some(lo => (lo.options || []).some(o => o.loads && o.loads.length)) },
      // "Drop" = can deliver Battalions to the ground (Bulk Lander / Dropship / Drop Pod).
      { key: 'drop',    label: 'Drop',    test: s => shipHasDrop(s) },
      { key: 'modular', label: 'Modular', test: s => isFullyModular(s) },
      { key: 'rare',    label: 'Rare',    test: s => s.isRare },
      { key: 'unique',  label: 'Unique',  test: s => s.isUnique },
      { key: 'famous',  label: 'Famous',  test: s => !!s._famous }
    ];
    const _hasFamous = (faction.admirals || []).some(a => a.isFamous && a.flagship);
    const presentAttrs = attrDefs.filter(a => a.key === 'famous' ? _hasFamous : groups.some(g => a.test(g.ship || {})));

    // Famous admirals fly a flagship that's a ship on the table — surface them in
    // the picker too (not just the Admiral screen, where they sit below the fold).
    // Picking one adds the admiral + flagship. Modelled as pseudo-groups sorted by
    // the flagship's tonnage; they always show (never hidden by the Misc toggle).
    const famousPseudo = (faction.admirals || []).filter(a => a.isFamous && a.flagship).map(a => ({
      id: a.id, category: a.flagship.category || 'medium', _famous: true,
      _art: admiralArtPath(a.name) || shipArtPath(a.flagship.name),
      _flagship: a.flagship.name, _level: a.level,
      ship: Object.assign({}, a.flagship, { name: a.name, cost: a.cost + a.flagship.cost, _famous: true })
    }));

    // Apply all filters first so the live count is accurate.
    const search = (document.getElementById('picker-search')?.value || '').toLowerCase();
    let list = groups.concat(famousPseudo).filter(g => {
      const s = g.ship || {};
      // Misc Ships is its own list: ON = only additional ships; OFF = core ships
      // (additional hidden). Famous admirals always show.
      if (!g._famous) {
        if (pickerShowExtra) { if (!s.additional) return false; }
        else if (s.additional) return false;
      }
      if (pickerFilter !== 'all' && g.category !== pickerFilter) return false;
      if (search) {
        const hay = ((s.name || g.name) + ' ' + (s.namesake || '')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      for (const k of pickerAttrs) { const d = attrDefs.find(a => a.key === k); if (d && !d.test(s)) return false; }
      return true;
    });

    // Filter chips: Tonnage = pick ONE (radio); attributes = multi-select.
    const cats = [...new Set(groups.map(g => g.category))].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
    const anyActive = pickerFilter !== 'all' || pickerAttrs.size > 0;
    document.getElementById('picker-chips').innerHTML = `
      <div class="filter-row">
        <span class="filter-label">Tonnage</span>
        <button class="chip ${pickerFilter === 'all' ? 'active' : ''}" onclick="App.filterShips('all')">All</button>
        ${cats.map(c => `<button class="chip ${pickerFilter === c ? 'active' : ''}" onclick="App.filterShips('${c}')">${CATEGORY_LABELS[c] || c}</button>`).join('')}
      </div>
      <div class="filter-row">
        <span class="filter-label"></span>
        ${presentAttrs.map(a => `<button class="chip chip-toggle ${pickerAttrs.has(a.key) ? 'active' : ''}" onclick="App.toggleAttr('${a.key}')">${pickerAttrs.has(a.key) ? CHECK_SVG : ''}${a.label}</button>`).join('')}
        <button class="chip chip-toggle ${pickerShowExtra ? 'active' : ''}" onclick="App.toggleExtra()" title="Mercenaries, cross-faction and other optional ships">${pickerShowExtra ? CHECK_SVG : ''}Misc Ships</button>
      </div>`;

    // Sort chips — tap to sort, tap the active one to flip direction. The live
    // ship count + Clear ride on the right of this row (no separate count line).
    const sortKeys = [['points', 'Points'], ['name', 'Name'], ['tonnage', 'Tonnage']];
    document.getElementById('picker-sort').innerHTML =
      `<span class="sort-label">Sort</span>` +
      sortKeys.map(([k, lbl]) => {
        const on = pickerSort.key === k;
        const arrow = on ? `<span class="sort-arrow">${pickerSort.dir === 'asc' ? '↑' : '↓'}</span>` : '';
        return `<button class="sort-chip ${on ? 'active' : ''}" onclick="App.setSort('${k}')">${lbl}${arrow}</button>`;
      }).join('') +
      `<span class="picker-meta"><span class="filter-count">${list.length} ship${list.length !== 1 ? 's' : ''}</span>${anyActive ? `<button class="filter-clear" onclick="App.clearFilters()">Clear ×</button>` : ''}</span>`;

    const cmp = {
      points:  (a, b) => (a.ship?.cost || 0) - (b.ship?.cost || 0),
      name:    (a, b) => (a.ship?.name || '').localeCompare(b.ship?.name || ''),
      tonnage: (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
                         || (a.ship?.cost || 0) - (b.ship?.cost || 0),
    }[pickerSort.key];
    list = list.slice().sort(cmp);
    if (pickerSort.dir === 'desc') list.reverse();

    const sizeSel = GAME_SIZES[activeFleet.gameSize] || GAME_SIZES.clash;
    const namedTaken = (activeFleet.admirals || []).some(a => a.type === 'Famous' || a.type === 'Faction' || a.admiralId);
    document.getElementById('picker-list').innerHTML = list.map(g => {
      const ship = g.ship || {};
      const cost = ship.cost || 0;
      const gMin = ship.groupMin || 1, gMax = ship.groupMax || gMin;
      const tonnage = tonLabel(ship.tonnage) || CATEGORY_LABELS[g.category] || g.category;
      const modCls = isFullyModular(ship) ? ' ship-img-modular' : '';
      if (g._famous) {
        const blocked = namedTaken || (g._level && g._level > (sizeSel.maxAdmiralLevel || 4));
        const reason = namedTaken ? 'One named Admiral per fleet' : (g._level > (sizeSel.maxAdmiralLevel || 4) ? `Exceeds ${sizeSel.label} cap` : '');
        return `<div class="list-row${blocked ? ' row-disabled' : ''}" onclick="${blocked ? '' : `App.addAdmiral('${g.id}')`}">
          ${g._art ? `<div class="ship-thumb ship-thumb-lg"><img src="${thumbUrl(g._art)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb ship-thumb-lg"></div>'}
          <div class="list-row-content">
            <div class="flex justify-between items-center">
              <span class="list-row-title">${esc(ship.name)} <span class="ship-tag">Admiral</span></span>
              <span class="list-row-pts">${cost}<span class="pts-unit">pts</span></span>
            </div>
            <div class="list-row-sub">${tonnageBadge(g.category)}Flies ${esc(g._flagship || 'flagship')}${blocked && reason ? `, ${esc(reason)}` : ''}</div>
          </div>
        </div>`;
      }
      const art = shipArtPath(ship.name);
      const tags = [];
      if (ship.isUnique) tags.push('<span class="ship-tag">Unique</span>');
      if (ship.isRare) tags.push('<span class="ship-tag">Rare</span>');
      if (isFullyModular(ship)) tags.push('<span class="ship-tag">Modular</span>');
      // (No Launch/Drop tag next to the name — it reads from the launch filter
      // chip and the ship's loads/launch table; an inline tag is just noise.)
      return `<div class="list-row" data-gid="${g.id}" onclick="App.addShip('${g.id}','${g.category}')">
        ${art ? `<div class="ship-thumb ship-thumb-lg${modCls}"><img src="${thumbUrl(art)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb ship-thumb-lg"></div>'}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(ship.name)} ${tags.join('')}</span>
            <span class="list-row-pts">${gMin > 1 ? cost * gMin : cost}<span class="pts-unit">pts</span></span>
          </div>
          <div class="list-row-sub">${tonnageBadge(g.category)}${esc(tonnage)}, Group ${gMin}${gMax > gMin ? '–' + gMax : ''}${gMin > 1 ? ` · ${gMin}× ${cost}` : ''}</div>
          ${(() => { const rs = (ship.specialRules || []).map(r => r.name).filter(Boolean).join(', '); return rs ? `<div class="list-row-rules">${renderSpecialChips(rs)}</div>` : ''; })()}
          ${shipLaunchIcons(ship, activeFleet.faction)}
        </div>
      </div>`;
    }).join('');
    setupPickerLongPress();
  }

  // Long-press a ship row to preview its datasheet (without adding it). Reuses
  // the rule bottom-sheet. Bound once via delegation on the persistent list.
  function setupPickerLongPress() {
    const list = document.getElementById('picker-list');
    if (!list || list._lpBound) return;
    list._lpBound = true;
    let timer = null, fired = false, sx = 0, sy = 0, row = null;
    const cancel = () => { clearTimeout(timer); timer = null; };
    list.addEventListener('pointerdown', e => {
      row = e.target.closest('.list-row');
      if (!row) return;
      fired = false; sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        fired = true;
        if (navigator.vibrate) navigator.vibrate(15);  // Android only; iOS web no-ops
        const fac = activeFleet && FACTIONS[activeFleet.faction];
        const g = ((fac && fac.groups) || []).find(x => x.id === row.dataset.gid);
        if (g && g.ship) showShipSheet(g.ship);
      }, 450);
    });
    list.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); });
    list.addEventListener('pointerup', cancel);
    list.addEventListener('pointercancel', cancel);
    // Swallow the click (add) that a long-press would otherwise trigger.
    list.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  }

  // Compact ship datasheet rendered into the rule bottom sheet.
  function showShipSheet(ship) {
    const s = ship.stats || {};
    const stat = [['SCAN', s.scan], ['SIG', s.sig], ['THR', s.thrust], ['HULL', s.hull], ['ES', s.es], ['KS', s.ks], ['BS', s.bs]]
      .filter(([, v]) => v != null && v !== '-' && v !== '')
      .map(([l, v]) => `<span class="ss-stat"><b>${esc(String(v))}</b> ${l}</span>`).join('');
    const weapons = (ship.weapons || []).map(w => `<div class="ss-weapon">
      <div class="ss-wname">${esc(w.name)}</div>
      <div class="ss-wline">${w.arc ? arcCell(w.arc) + ' ' : ''}Lock ${esc(String(w.lock || '-'))} · ${esc(String(w.attack || '-'))} Att · ${esc(String(w.damage || '-'))}${w.type ? ' ' + esc(w.type) : ''}</div>
      ${renderSpecialChips(w.special)}
    </div>`).join('');
    const ruleNames = (ship.specialRules || []).map(r => r.name).filter(Boolean).join(', ');
    const rules = ruleNames ? `<div class="ss-rules">${renderSpecialChips(ruleNames)}</div>` : '';
    showSheet(ship.name, `<div class="ss-stats">${stat}</div>${weapons}${rules}`);
  }

  function filterShips(cat) { pickerFilter = cat; renderShipPicker(); }
  function toggleAttr(key) { if (pickerAttrs.has(key)) pickerAttrs.delete(key); else pickerAttrs.add(key); renderShipPicker(); }
  // Persisted preference (mirrors desktop's "Additional Ships" setting), so it is
  // deliberately NOT reset by Clear.
  function toggleExtra() { pickerShowExtra = !pickerShowExtra; localStorage.setItem('dfc_show_extra', pickerShowExtra ? '1' : '0'); renderShipPicker(); }
  function clearFilters() { pickerFilter = 'all'; pickerAttrs.clear(); renderShipPicker(); }
  function setSort(key) {
    if (pickerSort.key === key) pickerSort.dir = pickerSort.dir === 'asc' ? 'desc' : 'asc';
    else pickerSort = { key, dir: 'asc' };
    renderShipPicker();
  }
  function tonnageBadge(category) {
    const letter = { light: 'L', medium: 'M', heavy: 'H', colossal: 'C', payload: 'P' }[category] || '?';
    return `<span class="ton-badge ton-${category}">${letter}</span>`;
  }

  function makeShipInstance(factionKey, category, shipKey) {
    const ship = findShip(factionKey, category, shipKey);
    const loadouts = {};
    (ship?.loadoutOptions || []).forEach((lo, i) => { loadouts[i] = 0; });
    const inst = { id: uuid(), shipKey, groupCategory: category, points: 0, loadouts };
    inst.points = recalcShipPoints(factionKey, ship, inst);
    return inst;
  }
  // A group is "×N of one identically-equipped ship", so a new copy must inherit
  // the existing ship's loadouts/systems/feature/points, not reset to base.
  function cloneShipInstance(src) {
    const c = { ...src, id: uuid(), loadouts: { ...(src.loadouts || {}) } };
    if (src.systems) c.systems = [...src.systems];
    return c;
  }
  function addShip(shipKey, category) {
    if (!activeFleet) return;
    const ship = findShip(activeFleet.faction, category, shipKey);
    activeFleet.battleGroups = activeFleet.battleGroups || [];
    // Payloads (Bioficer Cells) have no group size — fold a repeat add into the
    // existing payload group of the same ship so the list isn't spammed with
    // identical 1-ship groups.
    if (category === 'payload') {
      const existing = activeFleet.battleGroups.find(g =>
        g.ships.length > 0 && g.ships[0].groupCategory === 'payload' && g.ships[0].shipKey === shipKey);
      if (existing) {
        existing.ships.push(makeShipInstance(activeFleet.faction, category, shipKey));
        activeFleet.updatedAt = Date.now();
        saveFleets();
        haptic(HAPTIC.add);
        goBack();
        return;
      }
    }
    const minQty = ship?.groupMin || 1;
    const ships = [];
    for (let i = 0; i < minQty; i++) ships.push(makeShipInstance(activeFleet.faction, category, shipKey));
    activeFleet.battleGroups.push({ id: uuid(), name: ship?.name || 'Group', ships });
    activeFleet.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.add);
    goBack();
  }

  /* ── Screen: Group Detail ──────────────────────────────── */
  // Tap the red status mark to reveal/hide the alert list (kept collapsed so the
  // fleet stays uncluttered; the warnings retain their tap-to-fix shortcuts).
  function toggleWarnings() {
    const el = document.getElementById('fleet-warnings');
    if (el) el.classList.toggle('hidden');
  }

  function openGroup(index) { activeGroupIdx = index; navigate('screen-group-detail'); }

  // Hero art carousel (primary + resin sculpt + counts-as variant art). Tap the
  // arrows/dots or swipe the image to switch; state resets when the screen renders.
  let heroArtsM = [];
  let heroIdxM = 0;
  function setHeroArt(i) {
    if (heroArtsM.length < 2) return;
    heroIdxM = (i + heroArtsM.length) % heroArtsM.length;
    const cur = heroArtsM[heroIdxM];
    const wrap = document.querySelector('#group-detail-content .ship-art-hero');
    if (!wrap) return;
    const img = wrap.querySelector('img'); if (img) { img.src = cur.src; img.alt = cur.label; }
    const label = wrap.querySelector('.hero-art-label'); if (label) label.textContent = cur.label;
    wrap.querySelectorAll('.hero-art-dot').forEach((d, j) => d.classList.toggle('active', j === heroIdxM));
    // Persist the chosen sculpt on the group's ships so it sticks (shared schema
    // with desktop's ship.artIdx).
    if (activeFleet && activeGroupIdx >= 0) {
      const g = activeFleet.battleGroups[activeGroupIdx];
      if (g) { g.ships.forEach(s => s.artIdx = heroIdxM); saveFleets(); }
    }
  }
  function cycleShipArt(delta) { setHeroArt(heroIdxM + delta); }
  function bindHeroSwipe() {
    const wrap = document.querySelector('#group-detail-content .ship-art-hero');
    if (!wrap || wrap._swipeBound || heroArtsM.length < 2) return;
    wrap._swipeBound = true;
    let x0 = null;
    wrap.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) cycleShipArt(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function renderGroupDetail() {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    if (!group || !group.ships.length) return;
    const inst = group.ships[0];
    const ship = findShip(f.faction, inst.groupCategory, inst.shipKey);
    if (!ship) return;
    const stats = ship.stats || {};
    const qty = group.ships.length;
    const gp = groupPoints(f, group);

    // G-stat range
    let gMin = ship.groupMin || 1, gMax = ship.groupMax || 1;
    const gStat = stats.g || '';
    if (gStat.includes('-')) { const p = gStat.split('-'); gMin = parseInt(p[0]) || gMin; gMax = parseInt(p[1]) || gMax; }
    // Payloads (Bioficer Cells) have no group size — take as many as you like.
    const isPayloadGrp = inst.groupCategory === 'payload';
    if (isPayloadGrp) gMax = Infinity;

    const statEntries = shipStatEntries(stats, loadoutStatMods(ship, inst, f.faction));

    const weapons = ship.weapons || [];
    const loadoutOptions = ship.loadoutOptions || [];
    // Weapon table = base weapons + the currently selected loadout option weapons,
    // so swap options (Laser Refit) and ships whose entire armament is a loadout
    // (the New York) read right. Each option's datasheet shows only on UNSELECTED
    // cards below (a preview), so nothing is ever listed twice.
    const displayWeapons = [...weapons];
    loadoutOptions.forEach((lo, i) => {
      const sel = inst.loadouts && inst.loadouts[i] != null ? inst.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && Array.isArray(opt.weapons)) displayWeapons.push(...opt.weapons);
    });
    // Show every ship special rule as a full text card (incl. Rare/Unique — the
    // user wants the rule spelled out, not just a chip). The compact Rare/Unique
    // tag by the name still carries the at-a-glance flag.
    // Rules granted by a selected loadout option (e.g. a Cloaking Crest grants Cloak-2
    // + Stealth), resolved to full text from the shared glossary so they read as real
    // rules, not just a line in the option name.
    const gainedRules = [];
    loadoutOptions.forEach((lo, i) => {
      const sel = inst.loadouts && inst.loadouts[i] != null ? inst.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && Array.isArray(opt.gainRules)) opt.gainRules.forEach(nm => {
        const r = lookupRule(nm);
        if (r && r.description) gainedRules.push({ name: nm, description: r.description });
      });
    });
    const rules = [...(ship.specialRules || []), ...gainedRules];
    const ruleNames = new Set(rules.map(r => (r.name || '').toLowerCase()));
    // The special-stat chip row must not repeat anything already shown as a full
    // card below (e.g. "Rare" lives in both stats.special and specialRules).
    const specialText = (stats.special && stats.special !== '-' ? stats.special : '')
      .split(',').map(s => s.trim()).filter(t => t && !ruleNames.has(t.toLowerCase())).join(', ');
    const artSrc = shipArtPath(ship.name);
    const carrier = isFeatureCarrier(ship);
    const featReq = false; // Deployable Features are always optional now
    const features = carrier ? factionFeatures(f.faction) : [];
    const chosenFeature = inst.feature || '';
    const sysList = systemsListFor(ship, f.faction);
    const sysSel = ship.systemSelection;

    // High Power is intentionally NOT auto-listed from Overcharge. Overcharge's own rule
    // text explains the weapon becomes High Power when Overcharged, so tapping the
    // Overcharge chip is enough — no standalone rule card unless the ship natively has it.

    // Hero art carousel: primary + resin sculpt + counts-as variant art.
    heroArtsM = [];
    if (artSrc) heroArtsM.push({ src: artSrc, label: 'Standard sculpt' });
    shipAltArt(ship.name).forEach(a => heroArtsM.push({ src: a, label: 'Resin sculpt' }));
    (ship.variants || []).forEach(v => { if (v.image) heroArtsM.push({ src: v.image.startsWith('assets/') ? '../' + v.image : v.image, label: v.name }); });
    // Restore the previously chosen sculpt (persisted on the ship) so it sticks.
    heroIdxM = heroArtsM.length ? Math.min(Math.max(inst.artIdx || 0, 0), heroArtsM.length - 1) : 0;
    const multiArtM = heroArtsM.length > 1;
    const heroSrcM = heroArtsM.length ? heroArtsM[heroIdxM].src : artSrc;

    document.getElementById('group-detail-content').innerHTML = `
      ${artSrc ? `<div class="ship-art-hero${isFullyModular(ship) ? ' ship-img-modular' : ''}${multiArtM ? ' has-alts' : ''}">${isFullyModular(ship) ? '<div class="modular-art-note">Base hull shown, your ship’s look depends on the systems you choose</div>' : ''}${shopLinkImg(ship.name, `<img src="${heroSrcM}" alt="${esc(ship.name)}" loading="lazy">`, ship)}${multiArtM ? `<button class="hero-art-arrow hero-art-prev" onclick="event.preventDefault();event.stopPropagation();App.cycleShipArt(-1)" aria-label="Previous sculpt">‹</button><button class="hero-art-arrow hero-art-next" onclick="event.preventDefault();event.stopPropagation();App.cycleShipArt(1)" aria-label="Next sculpt">›</button><div class="hero-art-meta"><span class="hero-art-label">${esc(heroArtsM[heroIdxM].label)}</span><span class="hero-art-dots">${heroArtsM.map((_, i) => `<span class="hero-art-dot${i === heroIdxM ? ' active' : ''}"></span>`).join('')}</span></div>` : ''}</div>` : ''}
      <div class="detail-header">
        <div>
          <div class="detail-name detail-name-editable" onclick="App.editGroupName()" title="Rename battlegroup">${esc((group.name && group.name !== ship.name) ? group.name : ship.name)}${ship.isUnique ? ' <span class="ship-tag ship-tag-unique">Unique</span>' : ship.isRare ? ' <span class="ship-tag ship-tag-rare">Rare</span>' : ''}</div>
          <div class="detail-type">${(group.name && group.name !== ship.name) ? esc(ship.name) + ' · ' : ''}${tonLabel(ship.tonnage) || CATEGORY_LABELS[inst.groupCategory] || ''}</div>
        </div>
        <div class="pts-badge-lg"><div class="pts-badge-value">${gp}</div><div class="pts-badge-label">Points</div></div>
      </div>

      <div class="group-counter">
        <div>
          <div class="group-counter-label">Group size</div>
          ${isPayloadGrp ? `<div class="group-counter-range">No limit</div>` : (gMax > gMin ? `<div class="group-counter-range">${gMin}–${gMax} allowed</div>` : `<div class="group-counter-range">Fixed at ${gMin}</div>`)}
        </div>
        ${gMax > gMin ? `<div class="group-counter-controls">
          <button class="counter-btn${qty <= gMin ? ' counter-btn-x' : ''}" onclick="App.changeQty(-1)" aria-label="${qty <= gMin ? 'Remove group' : 'Remove one'}">${qty <= gMin ? '×' : '−'}</button>
          <div class="group-counter-value">${qty}</div>
          <button class="counter-btn" onclick="App.changeQty(1)" ${qty >= gMax ? 'disabled' : ''}>+</button>
        </div>` : (qty > 1 ? `<div class="group-counter-value group-counter-value-static">×${qty}</div>` : '')}
      </div>

      ${statGridMobile(statEntries, true)}

      ${displayWeapons.length ? `<div class="weapon-table">
        <div class="weapon-row weapon-row-header">
          <div class="weapon-name">Weapon</div><div class="weapon-val">Lk</div><div class="weapon-val">At</div><div class="weapon-val">Dm</div><div class="weapon-val">Arc</div>
        </div>
        ${displayWeapons.map(w => {
          const t = (w.type || '').toUpperCase();
          const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
          const dmg = `${w.damage || ''}${t ? `<span class="${tc}" style="margin-left:2px;font-size: 12px">${t}</span>` : ''}`;
          return `<div class="weapon-row ${tc}">
            <div class="weapon-name">${esc(w.name)}</div><div class="weapon-val">${esc(w.lock || '')}</div>
            <div class="weapon-val">${esc(w.attack || '')}</div><div class="weapon-val">${dmg}</div><div class="weapon-val weapon-arc">${arcCell(w.arc)}</div>
          </div>${w.special && w.special !== '-' ? `<div class="weapon-special">${renderSpecialChips(w.special)}</div>` : ''}`;
        }).join('')}
      </div>` : ''}

      ${renderLaunchTable(f.faction, ship, inst)}

      ${loadoutOptions.length ? `<div class="loadout-section">
        <div class="section-header" style="padding:0 0 var(--sp-s)">Loadout</div>
        ${loadoutOptions.map((lo, loIdx) => `
          <div class="loadout-group-label">${esc(lo.name || 'Option')}</div>
          ${lo.options.map((opt, oi) => {
            const sel = inst.loadouts && inst.loadouts[loIdx] != null ? inst.loadouts[loIdx] : 0;
            const on = oi === sel;
            // Show BOTH options' datasheets so the two guns can be compared under
            // their radios (matches desktop), not just the unselected preview.
            const sheet = opt.weapons?.length ? optionWeaponSheet(opt.weapons)
              : (opt.loads?.length ? buildLaunchTable(f.faction, opt.loads) : '');
            // Don't repeat the option name when its datasheet already shows it.
            const redundant = opt.weapons?.length && opt.weapons.every(w => w.name === opt.name);
            return `<div class="loadout-option loadout-radio-opt ${on ? 'selected' : ''}" onclick="App.selectLoadout(${loIdx}, ${oi})">
              <div class="loadout-radio-row">
                <span class="loadout-radio-dot"></span>
                <span class="loadout-option-name">${redundant ? '' : esc(opt.name)}</span>
                <span class="loadout-option-cost">${opt.cost ? '+' + opt.cost + 'pts' : 'Free'}</span>
              </div>
              ${sheet}
            </div>`;
          }).join('')}
        `).join('')}
      </div>` : ''}

      ${sysList && sysSel ? renderSystemsPicker(f.faction, ship, inst, sysList, sysSel) : ''}

      ${carrier && features.length ? `<div class="loadout-section">
        <div class="section-header" style="padding:0 0 var(--sp-s)">
          ${featReq ? 'Deployable Feature' + (chosenFeature ? '' : ', required') : 'Deployable Feature, optional'}
        </div>
        <div class="loadout-option loadout-radio-opt ${!chosenFeature ? 'selected' : ''}" onclick="App.selectFeature('')">
          <div class="loadout-radio-row">
            <span class="loadout-radio-dot"></span>
            <span class="loadout-option-name">${featReq ? 'None (choose one)' : 'No feature'}</span>
            <span class="loadout-option-cost loadout-req-flag">${featReq && !chosenFeature ? STATUS_ICON.warn : ''}</span>
          </div>
        </div>
        ${features.map(ft => {
          const sel = ft.name === chosenFeature;
          const stat = (ft.features && ft.features[0]) ? ft.features[0] : null;
          const detail = stat ? `ES ${stat.es || '-'} · KS ${stat.ks || '-'}${stat.special && stat.special !== '-' ? ' · ' + stat.special : ''}` : '';
          // Show every option's full rules inline so they can be compared before picking.
          const rulesHtml = (ft.rules || []).map(r =>
            `<div class="feature-rule">${r.description ? `<b>${esc(r.name)}:</b> ${ruleHtml(r.description)}` : `<b>${esc(r.name)}</b>`}</div>`
          ).join('');
          // Feature weapons (e.g. Skybane Halo's Skybane Oculus Array) fire by Scan, not Arc.
          const weaponsHtml = (ft.weapons || []).map(w =>
            `<div class="feature-rule">${esc(w.name)} — ${w.scan ? `Scan ${esc(w.scan)}, ` : ''}Att ${esc(w.attack)}, Lock ${esc(w.lock)}, Dmg ${esc(w.damage)} ${esc(w.type || '')}${w.special && w.special !== '-' ? ' ' + renderSpecialChips(w.special) : ''}</div>`
          ).join('');
          const art = featureArtPath(ft.name);
          return `<div class="loadout-option loadout-radio-opt ${sel ? 'selected' : ''}" onclick="App.selectFeature('${ft.name.replace(/'/g, "\\'")}')">
            <div class="loadout-radio-row">
              <span class="loadout-radio-dot"></span>
              ${art ? `<img class="feature-opt-art" src="${art}" alt="" loading="lazy" onerror="this.remove()">` : ''}
              <span class="loadout-option-name" style="flex:1">${esc(ft.name)}</span>
              <span class="loadout-option-cost">${ft.cost ? '+' + ft.cost + 'pts' : 'Free'}</span>
            </div>
            ${detail ? `<div class="loadout-option-desc">${esc(detail)}</div>` : ''}
            ${weaponsHtml}
            ${rulesHtml}
          </div>`;
        }).join('')}
      </div>` : ''}

      ${specialText ? `<div class="rule-card">
        <div class="rule-card-name" style="margin-bottom:var(--sp-s)">Special Rules</div>
        <div class="weapon-special" style="margin:0">${renderSpecialChips(specialText)}</div>
      </div>` : ''}

      ${rules.map(r => `<div class="rule-card">
        <div class="rule-card-name">${esc(r.name)}</div>
        ${r.description ? `<div class="rule-card-text">${ruleHtml(r.description)}</div>` : ''}
      </div>`).join('')}

      ${renderLore(ship)}

      <div style="padding:var(--sp-l)">
        <button class="btn btn-ghost btn-block" onclick="App.copyGroup()" style="margin-bottom:var(--sp-m)"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px;margin-right:6px"><g fill="currentColor"><path d="M4 9a3 3 0 0 0 3 3h4v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1z"/><path d="M13 1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zM9 5H7v2h2v2h2V7h2V5h-2V3H9z"/></g></svg>Duplicate Group</button>
        <button class="btn btn-ghost btn-block" onclick="App.removeGroup()" style="color:var(--danger);border-color:var(--danger)">Remove Group</button>
      </div>
    `;
    bindHeroSwipe();
  }

  // Lore/namesake text may carry markdown links: [label](https://...). Convert to
  // safe new-tab links; everything else escaped (only http(s) URLs become links).
  function loreLinks(text) {
    if (!text) return '';
    // URL may contain one level of balanced parens (e.g. .../Memnon_(mythology)),
    // so match either a non-paren char or a whole (...) group, not just [^)].
    const re = /\[([^\]]+)\]\((https?:\/\/(?:[^()\s]|\([^()\s]*\))*)\)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(text)) !== null) {
      out += esc(text.slice(last, m.index));
      out += `<a href="${esc(m[2])}" target="_blank" rel="noopener" class="lore-link">${esc(m[1])}</a>`;
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }

  // Flavour lore — kept visually + structurally separate from rules (Cardo serif).
  // Recorded ships list. Entries may carry a trailing sub-faction tag like
  // "Equatorial (Independents)" / "Purgatory (Kalium)"; when present the tag marks
  // the end of that run, so the list splits into separate underlined columns.
  // A trailing "(label)" only opens a sub-faction column when the label is an actual
  // faction/operator; a descriptive note like "(Manticore class)" or a markdown link's
  // "(url)" stays inline. Kept in sync with desktop FAMOUS_COL_TAG.
  const FAMOUS_COL_TAG = /^(UCM|PHR|Scourge|Shaltari|Resistance|Bioficers?|Independents?|Kalium|Vega Scrapfleet)$/i;

  function renderFamousShips(prefix, famousShips) {
    if (typeof famousShips === 'string') famousShips = famousShips ? famousShips.split(', ') : [];
    if (!famousShips || !famousShips.length) return '';
    const groups = [];
    let cur = [], tagged = false;
    famousShips.forEach(s => {
      const txt = String(s).trim();
      const m = txt.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (m && FAMOUS_COL_TAG.test(m[2].trim())) {
        tagged = true;
        if (m[1].trim()) cur.push(m[1].trim());
        groups.push({ label: m[2].trim(), ships: cur });
        cur = [];
      } else if (txt) {
        cur.push(txt);
      }
    });
    if (cur.length) groups.push({ label: '', ships: cur });
    const head = `<span class="lore-famous-label">${esc(prefix || 'Known ships of the class:')}</span>`;
    if (!tagged || groups.length < 2) {
      const flat = groups.length ? groups.flatMap(g => g.ships) : famousShips.map(String);
      return `<div class="lore-famous">${head}<ul>${flat.map(s => `<li>${loreLinks(s)}</li>`).join('')}</ul></div>`;
    }
    const cols = groups.map(g =>
      `<div class="lore-famous-col">${g.label ? `<span class="lore-famous-subhead">${esc(g.label)}</span>` : ''}<ul>${g.ships.map(s => `<li>${loreLinks(s)}</li>`).join('')}</ul></div>`
    ).join('');
    return `<div class="lore-famous">${head}<div class="lore-famous-cols">${cols}</div></div>`;
  }

  function renderLore(ship) {
    const lore = (ship.lore || '').trim();
    const namesake = (ship.namesake || '').trim();
    const famous = ship.famousShips || [];
    const nsInner = namesakeInner(namesake, ship.name);
    if (!lore && !nsInner && !famous.length) return '';
    const paras = lore ? lore.split(/\n\n+/).map(p => `<p>${loreLinks(p.trim())}</p>`).join('') : '';
    // Order matches desktop: lore → famous ships (bold header, italic bullets) → Namesake.
    const famousList = renderFamousShips(ship.famousShipsPrefix, famous);
    const namesakeLine = nsInner ? `<div class="lore-namesake"><span class="lore-namesake-label">Namesake:</span> ${nsInner}</div>` : '';
    return `<div class="lore-card">
      <div class="lore-label">Lore</div>
      <div class="lore-body">${paras}</div>
      ${famousList}
      ${namesakeLine}
    </div>`;
  }

  // Non-weapon detail line (launch loads / passive effect). Weapon options get
  // the full datasheet via optionWeaponSheet instead.
  function systemOptionDetail(opt) {
    if (opt.loads && opt.loads.length) return `Launch ${esc(opt.loads[0].launch || '')}`;
    if (opt.effect) return esc(opt.effect);
    return '';
  }
  // Full mini weapon-datasheet for a hardpoint option that bears weapons — the
  // same table the ship's own weapons use, so an option reads like a real
  // datasheet (arc diagram, Lock, Attack, Damage, tappable special rules).
  function optionWeaponSheet(weapons, omitName) {
    if (!weapons || !weapons.length) return '';
    const rows = weapons.map(w => {
      const t = (w.type || '').toUpperCase();
      const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
      const dmg = `${w.damage || ''}${t ? `<span class="${tc}" style="margin-left:2px;font-size: 12px">${t}</span>` : ''}`;
      return `<div class="weapon-row ${tc}">
        ${omitName ? '' : `<div class="weapon-name">${esc(w.name)}</div>`}<div class="weapon-val">${esc(w.lock || '')}</div>
        <div class="weapon-val">${esc(w.attack || '')}</div><div class="weapon-val">${dmg}</div><div class="weapon-val weapon-arc">${arcCell(w.arc)}</div>
      </div>${w.special && w.special !== '-' ? `<div class="weapon-special">${renderSpecialChips(w.special)}</div>` : ''}`;
    }).join('');
    return `<div class="weapon-table opt-weapon-table${omitName ? ' weapon-table-noname' : ''}">
      <div class="weapon-row weapon-row-header">
        ${omitName ? '' : '<div class="weapon-name">Weapon</div>'}<div class="weapon-val">Lk</div><div class="weapon-val">At</div><div class="weapon-val">Dm</div><div class="weapon-val">Arc</div>
      </div>${rows}</div>`;
  }
  function renderSystemsPicker(factionKey, ship, inst, list, seln) {
    const { counts, total, capUsage, catCounts } = summariseSystems(inst, list, seln);
    const required = seln.totalRequired;
    const req = seln.categoryReq;
    const sumMin = req ? Object.values(req).reduce((a, r) => a + (r.min || 0), 0) : 0;
    const sumMax = req ? Object.values(req).reduce((a, r) => a + (r.max != null ? r.max : 0), 0) : 0;
    const complete = req
      ? Object.entries(req).every(([cat, r]) => { const c = catCounts[cat] || 0; return c >= (r.min || 0) && c <= (r.max != null ? r.max : Infinity); })
      : (seln.totalIsExact ? total === required : total <= required);
    // Category requirement / cap chips
    const capChips = req
      ? Object.entries(req).map(([cat, r]) => {
          const c = catCounts[cat] || 0;
          const lo = r.min || 0, hi = r.max != null ? r.max : Infinity;
          const need = lo === hi ? `${hi}` : `${lo}-${hi === Infinity ? '∞' : hi}`;
          const ok = c >= lo && c <= hi;
          return `<span class="sys-cap-chip ${ok ? 'full' : ''}">${esc(cat)} ${c}/${need}</span>`;
        }).join('')
      : Object.entries(seln.categoryCaps || {})
          .map(([k, max]) => `<span class="sys-cap-chip ${capUsage[k] >= max ? 'full' : ''}">${esc(k)} ${capUsage[k]}/${max}</span>`).join('');
    // Group options by category
    const byCat = {};
    list.options.forEach(o => { (byCat[o.category] = byCat[o.category] || []).push(o); });
    const optsHtml = Object.entries(byCat).map(([cat, opts]) => `
      <div class="sys-cat-label">${esc(cat)}</div>
      ${opts.map(o => {
        const c = counts[o.name] || 0;
        const canAdd = canAddSystem(inst, ship, factionKey, o.name);
        const isLaunch = o.loads && o.loads.length;
        const sheet = (o.weapons && o.weapons.length)
          ? optionWeaponSheet(o.weapons, o.weapons.length === 1)
          : isLaunch ? buildLaunchTable(factionKey, o.loads)
          : (o.effect ? `<div class="loadout-option-desc">${esc(o.effect)}</div>` : '');
        return `<div class="sys-option ${c > 0 ? 'selected' : ''}">
          <div class="sys-option-row">
            <div class="sys-option-main">
              <div class="flex justify-between items-center">
                <span class="loadout-option-name">${esc(o.name)}${o.oncePerShip ? ' <span class="ship-tag">1×</span>' : ''}</span>
                <span class="loadout-option-cost">${o.cost ? '+' + o.cost : '0'} pts</span>
              </div>
            </div>
            <div class="sys-option-controls">
              <button class="counter-btn" onclick="App.removeSystem('${o.name.replace(/'/g, "\\'")}')" ${c <= 0 ? 'disabled' : ''}>−</button>
              <span class="sys-option-count">${c}</span>
              <button class="counter-btn" onclick="App.addSystem('${o.name.replace(/'/g, "\\'")}')" ${canAdd ? '' : 'disabled'}>+</button>
            </div>
          </div>
          ${sheet}
        </div>`;
      }).join('')}
    `).join('');
    return `<div class="loadout-section">
      <div class="section-header" style="padding:0 0 var(--sp-xs)">
        ${esc(seln.listName)}, ${req ? 'choose ' + (sumMin === sumMax ? sumMax : sumMin + '-' + sumMax) : (seln.totalIsExact ? 'choose ' + required : 'up to ' + required)}
        <span class="sys-total ${complete ? 'ok' : 'incomplete'}">${total}/${req ? (sumMin === sumMax ? sumMax : sumMin + '-' + sumMax) : required}</span>
      </div>
      ${capChips ? `<div class="sys-cap-row">${capChips}</div>` : ''}
      ${optsHtml}
    </div>`;
  }

  function renderSpecialChips(specialStr) {
    if (!specialStr || specialStr === '-') return '';
    return specialStr.split(',').map(s => {
      const t = s.trim();
      if (!t) return '';
      const rule = lookupRule(t);
      return rule.description
        ? `<span class="weapon-special-chip tappable" onclick="event.stopPropagation();App.openRule('${t.replace(/'/g, "\\'")}')">${esc(t)}</span>`
        : `<span class="weapon-special-chip">${esc(t)}</span>`;
    }).join(' ');
  }

  // Deployment range for Battalion/Feature-deploying Assets. Not in the ship
  // data — these are fixed rulebook constants (Rulebook 2.3.1 §7.4). Combat
  // assets (torpedoes, bombers, mines, fighters) use the universal 6" launch
  // placement and so are not listed here. Some ships carry a special rule that
  // overrides these (e.g. UCM "launch Dropships/Drop Pods at 6\"").
  // Battalion-deploying Assets and their listed deploy ranges (Rulebook §7.4.1).
  // Everything NOT in this map is a standard Asset that uses the general 6" rule.
  const DEPLOY_RANGE = {
    'bulk landers': '6"', 'bulk lander': '6"',
    'dropships': '3"', 'dropship': '3"',
    'boarding pods': '3"', 'boarding pod': '3"',
    'drop pods': '3"', 'drop pod': '3"'
  };
  // Verbatim launch-placement rules behind the launch table's Range column. Standard
  // Assets use the general 6" rule; battalion-deployers have their own targets/ranges.
  const RANGE_TIPS = {
    launch: { title: 'Launch Range', text: 'When you launch Assets, place those Assets up to their Launch Value within 6" of their Carrier (measured from the stem of the carrier to the center of the token) divided up as you wish. This placement counts as moving through scenery when placed through or onto scenery.' },
    battalion: { title: 'Battalion Deployment', text: 'Battalions are deployed by launching their associated Asset. Each of these have different targets for their Battalions. These resolve immediately so do not need tokens—place 1 Battalion on their target for each Asset being launched at it. These Assets may only be launched at targets within their range, measured from the launching Carrier\'s stem to the center of the targeted site.\n\nWhen you deploy Battalions to Dropsites, you may instead deploy them to a specific Feature on that Dropsite.' }
  };
  function openRangeTip(kind) {
    const t = RANGE_TIPS[kind];
    if (t) showSheet(t.title, `<p>${ruleHtml(t.text)}</p>`);
  }
  // Verbatim activation rules (Rulebook §8.3.x) behind each launch asset's NAME.
  // Tap the Load name to read these; <b> marks the book's bold. Fire Ships are
  // Bombers, so they reproduce the Bomber activation after their own note.
  const _BOMBER_ACTIVATION = 'First, move your Bombers in a straight line <b>in any direction</b> up to their Thrust, then form any Wings if allowed. Different types of Bombers (Such as Heavy Bombers or Fire Ships) may only form Wings with other Bombers of that type.\n\nThey may then attack any Group or Space Station they are in base contact with that does not have any friendly Battalions present. <b>Only Bombers with the Bombardment special rule may attack Cities or Descent Groups in Atmosphere.</b> When you attack with a Wing, all Bombers in that Wing contribute to the attack.\n\nBombers attack as if they were a Weapon with the stats in their profile. Every friendly Bomber in every friendly Wing attacking the same target combines into one roll. Damage is assigned to a Group in the usual way, including against Ships not in base contact with the Bombers.\n\n<b>When Bombers attack, remove the attacking Bombers from play after completing the attack.</b>';
  const LAUNCH_RULES = {
    fighters: { title: 'Activating Fighters', text: 'First, move your Fighters in a straight line <b>in any direction</b> up to their Thrust, then form any Wings if allowed.\n\nEach Wing may then attack one enemy Wing they are in base contact with.\n\nIf attacking a Bomber Wing, remove the attacking Fighters and defending Bombers equally until only one of those Wings remains.\n\nIf attacking a Fighter Wing, remove all the Fighters in the smaller Wing and the same number of Fighters in the larger.\n\nOnce all their attacks have been resolved, the Fighter\'s activation is over. Any remaining Fighters can activate again in the next round.' },
    bombers: { title: 'Activating Bombers', text: _BOMBER_ACTIVATION },
    fireships: { title: 'Fire Ships', text: 'Fire Ships are a type of Bomber and follow the rules for Activating Bombers.\n\n' + _BOMBER_ACTIVATION },
    torpedoes: { title: 'Activating Torpedoes', text: 'First, move your Torpedoes in a straight line in any direction up to their Thrust.\n\nThey may then attack any Ship or Space Station they are in base contact with. <b>Only Torpedoes with the Bombardment special rule may attack Cities or attack Descent Groups in Atmosphere</b>. Torpedoes attack as if they were a Weapon with the stats in their profile. <b>Torpedoes can only damage the attacked Ship</b>.\n\n<b>When a Torpedo attacks, remove the attacking Torpedo from play after completing the attack.</b>' },
    mines: { title: 'Mines', text: '<b>Mines cannot move or be moved once launched</b>. Instead, whenever an enemy Ship in Orbit moves through a Mine\'s Thrust, you may have that Mine attack that Ship.\n\nWhen a Mine attacks, remove it from the table and make an attack with its profile. This attack is made when the Ship completes its movement, even if it ends just out of range. <b>Mines can only damage the attacked Ship.</b>' },
    bulklanders: { title: 'Bulk Landers', text: '<b>Target:</b> Dropsites on any orbital layer. If that Dropsite or its Features have enemy Battalions on them, 2 Bulk Landers are needed to place 1 Battalion.' },
    dropships: { title: 'Dropships', text: '<b>Target:</b> Dropsites on the same orbital layer.' },
    boardingpods: { title: 'Boarding Pods', text: '<b>Target:</b> Space Stations and enemy Ships in the same Orbital Layer.' },
    droppods: { title: 'Drop Pods', text: '<b>Target:</b> Cities.' }
  };
  function launchRuleKey(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('fire ship')) return 'fireships';
    if (n.includes('fighter')) return 'fighters';
    if (n.includes('bomber')) return 'bombers';
    if (n.includes('torpedo')) return 'torpedoes';
    if (n.includes('mine')) return 'mines';
    if (n.includes('bulk lander')) return 'bulklanders';
    if (n.includes('dropship')) return 'dropships';
    if (n.includes('boarding pod')) return 'boardingpods';
    if (n.includes('drop pod')) return 'droppods';
    return null;
  }
  function openLaunchRule(key) {
    const r = LAUNCH_RULES[key];
    if (r) showSheet(r.title, `<p>${ruleHtml(r.text)}</p>`);
  }
  // Shared 7-column grid for the launch table (Launch | Load | Rng | Thr | At | Lk | Dm).
  const LT_GRID = '46px 1fr 38px 36px 28px 28px 36px';

  function getLaunchAssetMap(factionKey) {
    const f = FACTIONS[factionKey];
    if (!f) return {};
    const map = {};
    (f.launchAssets || []).forEach(grp => (grp.assets || []).forEach(a => { map[a.name.toLowerCase()] = a; }));
    return map;
  }
  // Build a launch-asset stat table from a list of loads. Reused by the ship launch
  // table AND by the modular pickers so every launch option shows its full statblock.
  function buildLaunchTable(factionKey, loads) {
    if (!loads || !loads.length) return '';
    const map = getLaunchAssetMap(factionKey);
    // Launch capacity adds up: two "Fighters & Bombers" Launch 2 bays read as a single
    // "Launch 4", never two rows or "×2". Merge identical loads (name+special) and sum
    // their numeric launch values; non-numeric launches stay as separate rows.
    const grouped = [];
    const byKey = new Map();
    loads.forEach(load => {
      if (!load.name) return;
      const n = parseInt(load.launch, 10);
      const key = Number.isFinite(n) ? `${load.name}|${load.special ?? ''}` : null;
      if (key && byKey.has(key)) { const g = byKey.get(key); g._n += n; g.launch = String(g._n); }
      else { const g = { ...load, _n: Number.isFinite(n) ? n : null }; if (key) byKey.set(key, g); grouped.push(g); }
    });
    let rows = '';
    grouped.forEach(load => {
      if (!load.name) return;
      const parts = load.name.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
      const ls = (load.special && load.special !== '-') ? ` <span style="color:var(--fg3);font-size:var(--text-caption2)">${esc(load.special)}</span>` : '';
      parts.forEach((part, i) => {
        const a = map[part.toLowerCase()] || { name: part };
        const has = a.attack != null;
        const t = (a.type || '').toUpperCase();
        const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
        const dmg = has ? `${a.damage || '-'}${t ? `<span class="${tc}" style="margin-left:2px">${t}</span>` : ''}` : '-';
        const special = (a.special && a.special !== '-') ? renderSpecialChips(a.special)
          : a.ksReroll != null ? `<span class="weapon-special-chip tappable" onclick="event.stopPropagation();App.openRule('Close Protection')">Close Protection (re-roll ${a.ksReroll})</span>`
          : '-';
        const isBattalion = DEPLOY_RANGE[part.toLowerCase()] !== undefined;
        const range = isBattalion ? DEPLOY_RANGE[part.toLowerCase()] : '6"';
        const rangeKind = isBattalion ? 'battalion' : 'launch';
        const lrKey = launchRuleKey(part);
        const nameCell = lrKey
          ? `<div class="weapon-name"><span class="tappable" style="text-decoration:underline dotted;cursor:pointer" onclick="event.stopPropagation();App.openLaunchRule('${lrKey}')">${esc(part)}</span></div>`
          : `<div class="weapon-name">${esc(part)}</div>`;
        rows += `<div class="weapon-row ${tc}" style="grid-template-columns:${LT_GRID}">
          ${i === 0 ? `<div class="weapon-val" style="font-weight:700">${esc(load.launch || '-')}${ls}</div>` : '<div></div>'}
          ${nameCell}
          <div class="weapon-val"><span class="tappable" style="cursor:pointer;text-decoration:underline dotted" onclick="event.stopPropagation();App.openRangeTip('${rangeKind}')">${esc(range)}</span></div>
          <div class="weapon-val">${esc(a.thrust || '-')}</div>
          <div class="weapon-val">${has ? esc(a.attack) : '-'}</div>
          <div class="weapon-val">${has ? esc(a.lock) : '-'}</div>
          <div class="weapon-val">${dmg}</div>
        </div>${special !== '-' ? `<div class="weapon-special">${special}</div>` : ''}`;
      });
    });
    return `<div class="weapon-table">
      <div class="weapon-row weapon-row-header" style="grid-template-columns:${LT_GRID}">
        <div class="weapon-val">Launch</div><div class="weapon-name" style="color:var(--fg3)">Load</div>
        <div class="weapon-val">Rng</div><div class="weapon-val">Thr</div><div class="weapon-val">At</div><div class="weapon-val">Lk</div><div class="weapon-val">Dm</div>
      </div>${rows}</div>`;
  }

  function renderLaunchTable(factionKey, ship, inst) {
    const loads = [...(ship.loads || [])];
    // Selected loadout options and systems/hardpoints can grant launch (Resistance
    // modular ships build their launch entirely from chosen options).
    (ship.loadoutOptions || []).forEach((lo, i) => {
      const sel = inst && inst.loadouts && inst.loadouts[i] != null ? inst.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && opt.loads) loads.push(...opt.loads);
    });
    if (inst && Array.isArray(inst.systems) && inst.systems.length) {
      const list = systemsListFor(ship, factionKey);
      if (list) inst.systems.forEach(n => { const o = findSystemOption(list, n); if (o && o.loads) loads.push(...o.loads); });
    }
    return buildLaunchTable(factionKey, loads);
  }

  // A group is "×N of one ship". Resolve the allowed N range (groupMin/Max,
  // overridable by the 'g' stat range like "1-3").
  function groupQtyBounds(ship, category) {
    let gMin = ship?.groupMin || 1, gMax = ship?.groupMax || 1;
    const gStat = ship?.stats?.g || '';
    if (gStat.includes('-')) { const p = gStat.split('-'); gMin = parseInt(p[0]) || gMin; gMax = parseInt(p[1]) || gMax; }
    // Payloads (Bioficer Cells) have no group size — take as many as you like.
    if (category === 'payload') gMax = Infinity;
    return { gMin, gMax };
  }

  // Add/remove one ship from a group, honouring its size range. Used by both
  // the group-detail stepper and the inline stepper on the fleet-list rows.
  function stepGroupQty(group, delta) {
    if (!group) return false;
    const f = activeFleet;
    const inst = group.ships[0];
    const ship = findShip(f.faction, inst.groupCategory, inst.shipKey);
    const { gMin, gMax } = groupQtyBounds(ship, inst.groupCategory);
    const newQty = group.ships.length + delta;
    if (newQty < gMin || newQty > gMax) return false;
    if (delta > 0) group.ships.push(cloneShipInstance(inst));
    else group.ships.pop();
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    return true;
  }

  // True when the group is already at its minimum size — the next − removes it.
  function isAtGroupMin(group) {
    if (!group || !group.ships.length) return false;
    const inst = group.ships[0];
    const ship = findShip(activeFleet.faction, inst.groupCategory, inst.shipKey);
    return group.ships.length <= groupQtyBounds(ship, inst.groupCategory).gMin;
  }

  function changeQty(delta) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    // Pressing − at the minimum removes the whole group (and returns to fleet).
    if (delta < 0 && isAtGroupMin(group)) { removeGroup(); return; }
    if (!stepGroupQty(group, delta)) return;
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }

  // Inline stepper on the fleet-list group rows — set "how many of this ship"
  // without opening the group-detail panel (the #1 post-add edit).
  function changeGroupQty(groupIdx, delta) {
    const f = activeFleet;
    if (!f) return;
    const group = f.battleGroups[groupIdx];
    if (delta < 0 && isAtGroupMin(group)) {
      f.battleGroups.splice(groupIdx, 1);
      f.updatedAt = Date.now();
      saveFleets();
      haptic(HAPTIC.remove);
      renderFleetDetail();
      return;
    }
    if (!stepGroupQty(group, delta)) return;
    renderFleetDetail();
  }

  function selectLoadout(loIdx, optIdx) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    const inst = group.ships[0];
    const ship = findShip(f.faction, inst.groupCategory, inst.shipKey);
    // Apply to every ship in the group (same profile + loadout per rules)
    group.ships.forEach(s => {
      s.loadouts = s.loadouts || {};
      s.loadouts[loIdx] = optIdx;
      s.points = recalcShipPoints(f.faction, ship, s);
    });
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }

  function selectFeature(featureName) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    const inst0 = group.ships[0];
    const ship = findShip(f.faction, inst0.groupCategory, inst0.shipKey);
    group.ships.forEach(s => {
      s.feature = featureName || undefined;
      s.points = recalcShipPoints(f.faction, ship, s);
    });
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }

  function addSystem(optName) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    const inst0 = group.ships[0];
    const ship = findShip(f.faction, inst0.groupCategory, inst0.shipKey);
    if (!canAddSystem(inst0, ship, f.faction, optName)) return;
    group.ships.forEach(s => {
      if (!s.systems) s.systems = [];
      s.systems.push(optName);
      s.points = recalcShipPoints(f.faction, ship, s);
    });
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }
  function removeSystem(optName) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    const inst0 = group.ships[0];
    const ship = findShip(f.faction, inst0.groupCategory, inst0.shipKey);
    group.ships.forEach(s => {
      if (!s.systems) return;
      const i = s.systems.lastIndexOf(optName);
      if (i >= 0) s.systems.splice(i, 1);
      s.points = recalcShipPoints(f.faction, ship, s);
    });
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.tick);
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }

  function removeGroup() {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    f.battleGroups.splice(activeGroupIdx, 1);
    activeGroupIdx = -1;
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.remove);
    goBack();
  }

  // Duplicate the whole group — ships, loadouts, systems, features and quantity —
  // right after the original. Permissive like add (Unique/Rare/group-count limits
  // surface as fleet warnings rather than blocking the copy).
  function copyGroup() {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const g = f.battleGroups[activeGroupIdx];
    if (!g || !g.ships.length) return;
    const clone = JSON.parse(JSON.stringify(g));
    clone.id = uuid();
    clone.ships = clone.ships.map(sh => ({ ...sh, id: uuid() }));
    clone.name = `${g.name} (copy)`;
    f.battleGroups.splice(activeGroupIdx + 1, 0, clone);
    activeGroupIdx += 1;
    f.updatedAt = Date.now();
    saveFleets();
    haptic(HAPTIC.add);
    renderGroupDetail();
    updateAppBar('screen-group-detail');
  }

  function groupOverflow() {
    showActionSheet([
      { label: 'Rename battlegroup', action: editGroupName },
      { label: 'Remove this group', danger: true, action: removeGroup }
    ]);
  }

  // Inline-rename the active battlegroup: swap the detail-name for an input,
  // commit to group.name and re-render. Mirrors the desktop feature; group.name
  // already round-trips through save, share and print.
  function editGroupName() {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    if (!group) return;
    const el = document.querySelector('#group-detail-content .detail-name');
    if (!el) return;
    const current = group.name || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 40;
    input.className = 'gname-input';
    input.setAttribute('aria-label', 'Battlegroup name');
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();
    let handled = false;
    const finish = (save) => {
      if (handled) return;
      handled = true;
      const val = input.value.trim();
      if (save && val && val !== current) { group.name = val; saveFleets(); }
      renderGroupDetail();
      updateAppBar('screen-group-detail');
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  }

  /* ── Screen: Admiral Picker ────────────────────────────── */
  // Generic admirals are bought purely by level (no faction/abilities) — mirrors
  // the desktop GENERIC_ADMIRAL_LEVELS so both apps offer the same options.
  const GENERIC_ADMIRAL_LEVELS = [
    { level: 2, cost: 20 },
    { level: 3, cost: 40 },
    { level: 4, cost: 60 }
  ];
  function openAdmiral() { if (activeFleet) navigate('screen-admiral'); }
  function renderAdmiralPicker() {
    const f = activeFleet;
    if (!f) return;
    const faction = FACTIONS[f.faction];
    if (!faction) return;
    const size = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const maxLevel = size.maxAdmiralLevel || 4;

    // Generic admirals — the rulebook's L2/L3/L4 table (any number; no special
    // abilities, so we DON'T list an abilities line). Not fabricated.
    const genericRows = GENERIC_ADMIRAL_LEVELS.filter(l => l.level <= maxLevel).map(l =>
      `<div class="list-row" onclick="App.addGenericAdmiral(${l.level}, ${l.cost})">
        ${admiralThumb(f.faction, l.level, null)}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">Level ${l.level} Admiral</span>
            <span class="list-row-pts">${l.cost} pts</span>
          </div>
          <div class="list-row-sub">Take any number, adds Level for AP; highest-Level Admiral adds +1 to Initiative</div>
        </div>
      </div>`).join('');

    // One row for a Faction or Famous admiral, showing innate abilities (#2),
    // how many extra they pick from the faction table (#3), and — for famous —
    // their flagship's name + size class (#4).
    const admRow = (a) => {
      const fs = a.flagship;
      const total = fs ? (a.cost + fs.cost) : a.cost;
      const art = admiralArtPath(a.name) || (fs ? shipArtPath(fs.name) : null);
      const overLevel = a.level > size.maxAdmiralLevel;
      const sizeClass = (fs && fs.category) ? (CATEGORY_LABELS[fs.category] || '') : '';
      const flagshipStr = fs ? `, ${esc(fs.name)}${sizeClass ? ', ' + sizeClass : ''}` : '';
      const innate = (a.abilities || []).map(x => x.name).filter(Boolean);
      const picks = a.abilityPicks || 0;
      const sub = `Level ${a.level}${a.isFamous ? ' Famous' : ''}${flagshipStr}${overLevel ? `, exceeds ${size.label} cap` : ''}`;
      return `<div class="list-row ${overLevel ? 'row-disabled' : ''}" onclick="${overLevel ? '' : `App.addAdmiral('${a.id}')`}">
        ${admiralThumb(f.faction, a.level, art)}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(a.name)}</span>
            <span class="list-row-pts">${total} pts</span>
          </div>
          <div class="list-row-sub">${sub}</div>
          ${innate.length ? `<div class="list-row-abilities">${innate.map(n => `<span class="ability-tag">${esc(n)}</span>`).join('')}</div>` : ''}
          ${picks > 0 ? `<div class="list-row-picks">+ ${picks} ability pick${picks > 1 ? 's' : ''} from the ${esc(faction.name || 'faction')} table</div>` : ''}
        </div>
      </div>`;
    };

    const sorted = (faction.admirals || []).slice().sort((a, b) => (a.level || 0) - (b.level || 0));
    const factionRows = sorted.filter(a => !a.isFamous).map(admRow).join('');
    const famousRows = sorted.filter(a => a.isFamous).map(admRow).join('');

    document.getElementById('admiral-list').innerHTML =
      `<div class="section-header">Generic admirals</div>${genericRows}` +
      (factionRows ? `<div class="section-header">Faction admirals, choose one Faction or Famous</div>${factionRows}` : '') +
      (famousRows ? `<div class="section-header">Famous admirals, choose one Faction or Famous</div>${famousRows}` : '');
  }
  function addGenericAdmiral(level, cost) {
    const f = activeFleet;
    if (!f) return;
    f.admirals = f.admirals || [];
    f.admirals.push({
      name: `Level ${level} Admiral`,
      points: cost,
      admiralId: null,
      level,
      type: 'Generic',
      shipName: null,
      selectedAbilities: [],
      assignedGroupId: null
    });
    f.updatedAt = Date.now();
    saveFleets();
    goBack();
  }
  function addAdmiral(admiralId) {
    const f = activeFleet;
    const faction = FACTIONS[f.faction];
    const a = (faction.admirals || []).find(x => x.id === admiralId);
    if (!a) return;
    const fs = a.flagship;
    f.admirals = f.admirals || [];
    f.admirals.push({
      name: a.name,
      points: fs ? (a.cost + fs.cost) : a.cost,
      admiralId: a.id,
      level: a.level,
      type: a.isFamous ? 'Famous' : 'Faction',
      shipName: fs ? fs.name : null,
      selectedAbilities: [],
      assignedGroupId: null
    });
    f.updatedAt = Date.now();
    saveFleets();
    // If this admiral picks abilities from the faction table, return to the
    // fleet and pop the ability picker modal so the choice isn't missed.
    goBack();
    if ((a.abilityPicks || 0) > 0) {
      setTimeout(() => openAbilityModal(f.admirals.length - 1), 180);
    }
  }
  function removeAdmiralPrompt(i) {
    const a = activeFleet.admirals[i];
    showActionSheet([{ label: `Remove ${a.name}`, danger: true, action: () => {
      activeFleet.admirals.splice(i, 1);
      activeFleet.updatedAt = Date.now();
      saveFleets();
      renderFleetDetail();
      updateAppBar('screen-fleet-detail');
    } }]);
  }

  /* ── Admiral detail (abilities + assignment) ───────────── */
  function getAdmiralInfo(a) {
    const faction = FACTIONS[activeFleet.faction];
    if (!faction) return null;
    const def = (faction.admirals || []).find(x => x.id === a.admiralId);
    if (!def) return null;
    return { innate: def.abilities || [], table: faction.abilitiesTable || [], picks: def.abilityPicks || 0 };
  }
  function capitalShipGroups() {
    return (activeFleet.battleGroups || []).filter(g => {
      const cat = g.ships[0]?.groupCategory;
      if (!(cat === 'medium' || cat === 'heavy' || cat === 'colossal')) return false;
      // A ship whose rules forbid an Admiral (e.g. Argonaut "Mind of its Own") is
      // never a valid host, even though it is Capital tonnage.
      const db = findShip(activeFleet.faction, g.ships[0].groupCategory, g.ships[0].shipKey);
      return !(db && db.noAdmiral);
    }).map(g => {
      const s = g.ships[0];
      const db = findShip(activeFleet.faction, s.groupCategory, s.shipKey);
      return { id: g.id, name: db?.name || g.name };
    });
  }
  // Famous admirals fly a named flagship; fetch its datasheet from the faction def.
  function admiralFlagship(a) {
    if (!a || !a.admiralId) return null;
    const faction = FACTIONS[activeFleet.faction];
    const def = (faction && faction.admirals || []).find(x => x.id === a.admiralId);
    if (!(def && def.isFamous && def.flagship)) return null;
    // Some famous admirals have a pre-named flagship (e.g. "Fortune's Fancy"); the
    // proper name lives on the admiral def, the class name on the flagship ship.
    return def.flagshipName ? Object.assign({}, def.flagship, { flagshipName: def.flagshipName }) : def.flagship;
  }
  // A named flagship reads "Fortune's Fancy (Tribune Battlecruiser)"; an unnamed one
  // just shows its class. `withClass` appends the class in parentheses.
  // asHtml=true wraps the "(Class)" part in a smaller, muted inline span so a
  // named flagship's proper name reads as the primary text and its class as a
  // quieter aside — stays on the same line. Matches desktop.
  function flagshipLabel(fs, withClass, asHtml) {
    if (!fs) return '';
    const cls = fs.name || '';
    if (fs.flagshipName) {
      if (!(withClass && cls)) return asHtml ? esc(fs.flagshipName) : fs.flagshipName;
      return asHtml
        ? `${esc(fs.flagshipName)} <span class="flagship-class-inline">(${esc(cls)})</span>`
        : `${fs.flagshipName} (${cls})`;
    }
    return asHtml ? esc(cls) : cls;
  }
  // Render a flagship's full datasheet (stat grid + weapons + rules), reusing the
  // same components as the group ship detail so it matches desktop parity.
  function flagshipDatasheet(fs) {
    if (!fs) return '';
    // Flagship data carries namesake but not lore — pull the flagship ship's lore
    // (and recorded ships) from the matching regular ship by name so it shows.
    const _fac = FACTIONS[activeFleet.faction];
    const _loreSrc = (_fac && (_fac.groups || []).map(g => g.ship).find(s => s && s.name === fs.name)) || {};
    const loreShip = {
      lore: fs.lore || _loreSrc.lore || '',
      namesake: fs.namesake || _loreSrc.namesake || '',
      famousShips: fs.famousShips || _loreSrc.famousShips || [],
      famousShipsPrefix: fs.famousShipsPrefix || _loreSrc.famousShipsPrefix || ''
    };
    const stats = fs.stats || {};
    const statEntries = [
      { key: 'scan', label: 'Scan', val: stats.scan },
      { key: 'sig', label: 'Sig', val: stats.sig },
      { key: 'thrust', label: 'Thrust', val: stats.thrust },
      { key: 'hull', label: 'Hull', val: stats.hull },
      { key: 'es', label: 'ES', val: stats.es },
      { key: 'ks', label: 'KS', val: stats.ks }
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');
    if (stats.bs && stats.bs !== '-') statEntries.push({ key: 'bs', label: 'BS', val: stats.bs });
    const weapons = fs.weapons || [];
    const rules = fs.specialRules || [];
    // Don't list a special twice: as a bare chip from stats.special AND as a full
    // rule card below (e.g. a flagship's Porter S-1 lives in both).
    const ruleNames = new Set(rules.map(r => (r.name || r || '').toLowerCase()));
    const specialText = (stats.special && stats.special !== '-' ? stats.special : '')
      .split(',').map(s => s.trim()).filter(t => t && !ruleNames.has(t.toLowerCase())).join(', ');
    const artSrc = shipArtPath(fs.name);
    const sizeClass = fs.category ? (CATEGORY_LABELS[fs.category] || '') : '';
    return `<div class="section-header">${flagshipLabel(fs, true, true)}${sizeClass ? ', ' + esc(sizeClass) : ''}${fs.cost ? `, ${fs.cost} pts` : ''}</div>
      ${artSrc ? `<div class="ship-art-hero">${shopLinkImg(fs.name, `<img src="${artSrc}" alt="${esc(fs.name)}" loading="lazy">`, fs)}</div>` : ''}
      ${statGridMobile(statEntries, false)}
      ${weapons.length ? `<div class="weapon-table">
        <div class="weapon-row weapon-row-header">
          <div class="weapon-name">Weapon</div><div class="weapon-val">Lk</div><div class="weapon-val">At</div><div class="weapon-val">Dm</div><div class="weapon-val">Arc</div>
        </div>
        ${weapons.map(w => {
          const t = (w.type || '').toUpperCase();
          const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
          const dmg = `${w.damage || ''}${t ? `<span class="${tc}" style="margin-left:2px;font-size: 12px">${t}</span>` : ''}`;
          return `<div class="weapon-row ${tc}">
            <div class="weapon-name">${esc(w.name)}</div><div class="weapon-val">${esc(w.lock || '')}</div>
            <div class="weapon-val">${esc(w.attack || '')}</div><div class="weapon-val">${dmg}</div><div class="weapon-val weapon-arc">${arcCell(w.arc)}</div>
          </div>${w.special && w.special !== '-' ? `<div class="weapon-special">${renderSpecialChips(w.special)}</div>` : ''}`;
        }).join('')}
      </div>` : ''}
      ${fs.loads && fs.loads.length ? buildLaunchTable(activeFleet.faction, fs.loads) : ''}
      ${specialText ? `<div class="rule-card"><div class="rule-card-text">${esc(specialText)}</div></div>` : ''}
      ${rules.length ? rules.map(r => `<div class="rule-card"><div class="rule-card-name">${esc(r.name || r)}</div>${r.description ? `<div class="rule-card-text">${ruleHtml(r.description)}</div>` : ''}</div>`).join('') : ''}
      ${renderLore(loreShip)}`;
  }
  function openAdmiralDetail(i) { activeAdmiralIdx = i; navigate('screen-admiral-detail'); }
  function renderAdmiralDetail() {
    const f = activeFleet;
    if (!f || activeAdmiralIdx < 0) return;
    const a = f.admirals[activeAdmiralIdx];
    if (!a) return;
    const info = getAdmiralInfo(a);
    const art = admiralArtPath(a.name);
    const sel = Array.isArray(a.selectedAbilities) ? a.selectedAbilities : [];

    const abilityInfo = ab => `<div class="rule-card">
      <div class="flex justify-between items-center">
        <div class="rule-card-name">${esc(ab.name)}</div>
        ${ab.cost ? `<span class="loadout-option-cost">${esc(ab.cost)}</span>` : ''}
      </div>
      ${ab.effect ? `<div class="rule-card-text">${linkKeywords(ab.effect)}</div>` : ''}
    </div>`;

    let abilitiesHtml = '';
    if (info && info.innate.length) {
      abilitiesHtml += `<div class="section-header">Ability</div>` + info.innate.map(abilityInfo).join('');
    }
    if (info && info.table.length && info.picks > 0) {
      const remaining = info.picks - sel.length;
      abilitiesHtml += `<div class="section-header">Abilities Table, choose ${info.picks} ${remaining > 0 ? `(${remaining} left)` : '(full)'}</div>`;
      // Choose-1 is a radio group (tap any to switch); choose-many stays a
      // multi-select checklist that locks once full.
      const single = info.picks === 1;
      abilitiesHtml += info.table.map(ab => {
        const on = sel.includes(ab.name);
        const locked = !single && !on && remaining <= 0;
        const click = locked ? '' : `App.toggleAdmiralAbility('${ab.name.replace(/'/g, "\\'")}')`;
        const head = single
          ? `<div class="loadout-radio-row"><span class="loadout-radio-dot"></span><span class="loadout-option-name">${esc(ab.name)}</span>${ab.cost ? `<span class="loadout-option-cost">${esc(ab.cost)}</span>` : ''}</div>`
          : `<div class="flex justify-between items-center"><span class="loadout-option-name">${on ? '✓ ' : ''}${esc(ab.name)}</span>${ab.cost ? `<span class="loadout-option-cost">${esc(ab.cost)}</span>` : ''}</div>`;
        return `<div class="loadout-option ${single ? 'loadout-radio-opt' : ''} ${on ? 'selected' : ''} ${locked ? 'row-disabled' : ''}" onclick="${click}">
          ${head}
          ${ab.effect ? `<div class="loadout-option-desc">${linkKeywords(ab.effect)}</div>` : ''}
        </div>`;
      }).join('');
    }

    // Famous admirals fly their own flagship (shown as a datasheet); Generic and
    // Faction admirals instead lead from one of the fleet's Capital ships.
    const fs = admiralFlagship(a);
    let assignHtml;
    if (fs) {
      assignHtml = flagshipDatasheet(fs);
    } else {
      const caps = capitalShipGroups();
      assignHtml = `<div class="section-header">Assigned to</div>`;
      if (caps.length) {
        assignHtml += `<div class="loadout-section">` +
          `<div class="loadout-option loadout-radio-opt ${!a.assignedGroupId ? 'selected' : ''}" onclick="App.assignAdmiral('')">
            <div class="loadout-radio-row"><span class="loadout-radio-dot"></span><span class="loadout-option-name">Unassigned</span></div></div>` +
          caps.map(c => `<div class="loadout-option loadout-radio-opt ${a.assignedGroupId === c.id ? 'selected' : ''}" onclick="App.assignAdmiral('${c.id}')">
            <div class="loadout-radio-row"><span class="loadout-radio-dot"></span><span class="loadout-option-name">${esc(c.name)}</span></div></div>`).join('') +
          `</div>`;
      } else {
        assignHtml += `<div class="empty-state-sm">No Capital ships (Medium+) to assign to yet.</div>`;
      }
    }

    document.getElementById('admiral-detail-content').innerHTML = `
      <div class="detail-header">
        ${admiralThumb(f.faction, a.level, art, true)}
        <div style="flex:1;margin-left:var(--sp-m)">
          <div class="detail-name">${esc(a.name)}</div>
          <div class="detail-type">Level ${a.level || '?'}${a.shipName ? ', ' + esc(a.shipName) : ''}</div>
        </div>
        <div class="pts-badge-lg"><div class="pts-badge-value">${a.points}</div><div class="pts-badge-label">Points</div></div>
      </div>
      ${assignHtml}
      ${abilitiesHtml}
      <div style="padding:var(--sp-l)">
        <button class="btn btn-ghost btn-block" onclick="App.removeActiveAdmiral()" style="color:var(--danger);border-color:var(--danger)">Remove Admiral</button>
      </div>
    `;
  }
  function toggleAdmiralAbility(name) {
    const a = activeFleet.admirals[activeAdmiralIdx];
    const info = getAdmiralInfo(a);
    if (!info) return;
    if (!Array.isArray(a.selectedAbilities)) a.selectedAbilities = [];
    const pos = a.selectedAbilities.indexOf(name);
    if (pos >= 0) a.selectedAbilities.splice(pos, 1);   // tap a checked one to uncheck
    else if (info.picks === 1) a.selectedAbilities = [name];   // tap switches
    else if (a.selectedAbilities.length >= info.picks) { a.selectedAbilities.shift(); a.selectedAbilities.push(name); } // swap oldest at cap
    else a.selectedAbilities.push(name);
    activeFleet.updatedAt = Date.now();
    saveFleets();
    // Re-render whichever surface is showing the picker.
    if (document.getElementById('modal-abilities').classList.contains('active')) renderAbilityModalBody(activeAdmiralIdx);
    else renderAdmiralDetail();
  }

  // Ability picker that pops up when you add an admiral (mirrors desktop).
  function renderAbilityModalBody(idx) {
    const a = activeFleet.admirals[idx];
    if (!a) return;
    const info = getAdmiralInfo(a);
    if (!info) return;
    const sel = Array.isArray(a.selectedAbilities) ? a.selectedAbilities : [];
    const remaining = info.picks - sel.length;
    document.getElementById('abilities-modal-title').textContent = `${a.name}, choose ${info.picks}`;
    const head = (ab, extra) => `<div class="ability-pick-head"><span class="ability-pick-name">${esc(ab.name)}</span>${extra}${ab.cost ? `<span class="ability-pick-cost">${esc(ab.cost)}</span>` : ''}</div>`;
    let html = '';
    // Innate abilities — always on, so no radio; an "Always" tag instead.
    if (info.innate && info.innate.length) {
      html += info.innate.map(ab => `<div class="ability-row ability-row-innate">
        ${head(ab, '<span class="ability-always">Always</span>')}
        ${ab.effect ? `<div class="ability-pick-effect">${linkKeywords(ab.effect)}</div>` : ''}
      </div>`).join('');
    }
    // The choosable table — radio-style rows. Keywords in the effect are tappable.
    html += info.table.map(ab => {
      const on = sel.includes(ab.name);
      return `<div class="ability-row ability-pick ${on ? 'selected' : ''}" onclick="App.toggleAdmiralAbility('${ab.name.replace(/'/g, "\\'")}')">
        <span class="ability-check">${on ? CHECK_SVG : ''}</span>
        <div class="ability-pick-body">
          ${head(ab, '')}
          ${ab.effect ? `<div class="ability-pick-effect">${linkKeywords(ab.effect)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    document.getElementById('abilities-modal-body').innerHTML = html;
  }
  function openAbilityModal(idx) {
    activeAdmiralIdx = idx;
    renderAbilityModalBody(idx);
    document.getElementById('modal-abilities').classList.add('active');
  }
  function closeAbilityModal() {
    document.getElementById('modal-abilities').classList.remove('active');
  }
  function assignAdmiral(groupId) {
    const a = activeFleet.admirals[activeAdmiralIdx];
    a.assignedGroupId = groupId || null;
    activeFleet.updatedAt = Date.now();
    saveFleets();
    renderAdmiralDetail();
  }
  function removeActiveAdmiral() {
    activeFleet.admirals.splice(activeAdmiralIdx, 1);
    activeAdmiralIdx = -1;
    activeFleet.updatedAt = Date.now();
    saveFleets();
    goBack();
  }

  /* ── Screen: Station Picker ────────────────────────────── */
  function openStation() { if (activeFleet) navigate('screen-station'); }
  function renderStationPicker() {
    const f = activeFleet;
    const faction = FACTIONS[f.faction];
    const stations = faction.spaceStations || [];
    const el = document.getElementById('station-list');
    if (!stations.length) {
      el.innerHTML = `<div class="empty-state-sm">No space stations available for this faction.</div>`;
      return;
    }
    el.innerHTML = stations.map(s => {
      const st = s.stats || {};
      const art = stationArtPath(f.faction, s);
      return `<div class="list-row" onclick="App.addStation('${s.id}')">
        ${art ? `<div class="ship-thumb"><img src="${thumbUrl(art)}" alt="" loading="lazy"></div>` : '<div class="ship-thumb"></div>'}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(s.name)}</span>
            <span class="list-row-pts">${s.cost} pts</span>
          </div>
          <div class="list-row-sub">Hull ${st.hull || '?'}, ES ${st.es || '-'}, KS ${st.ks || '-'}</div>
        </div>
      </div>`;
    }).join('');
  }
  function addStation(stationId) {
    const f = activeFleet;
    const faction = FACTIONS[f.faction];
    const s = (faction.spaceStations || []).find(x => x.id === stationId);
    if (!s) return;
    f.spaceStation = { name: s.name, baseCost: s.cost, cost: s.cost, stationKey: s.id, systems: [] };
    f.updatedAt = Date.now();
    saveFleets();
    navigate('screen-station-detail');
  }
  function openStationDetail() { if (activeFleet && activeFleet.spaceStation) navigate('screen-station-detail'); }
  function removeStationPrompt() {
    showActionSheet([{ label: `Remove ${activeFleet.spaceStation.name}`, danger: true, action: () => {
      activeFleet.spaceStation = null;
      activeFleet.updatedAt = Date.now();
      saveFleets();
      goBack();
      renderFleetDetail();
      updateAppBar('screen-fleet-detail');
    } }]);
  }

  /* ── Station hardpoints (generic Small/Medium/Large) ───────
     The three generic stations share the universal Space Station Armaments
     (STATION_ARMAMENTS, from fleet-index). Weapon Systems + Structures fill the
     required armament count (1/2/3 by size); Upgrades are extra (cap 1/1/2).
     Faction-specific stations are fixed and just display their datasheet. */
  function findStationDef(factionKey, station) {
    const fac = FACTIONS[factionKey];
    if (!fac) return null;
    return (fac.spaceStations || []).find(x => x.id === station.stationKey || x.name === station.name) || null;
  }
  function stationArmamentSpec(station) {
    if (!STATION_ARMAMENTS || !STATION_ARMAMENTS.requiredBySize) return null;
    const required = STATION_ARMAMENTS.requiredBySize[station.name];
    if (required == null) return null;   // faction-specific = fixed, no picker
    return { required, upgradeCap: (STATION_ARMAMENTS.upgradeCapBySize || {})[station.name] || 0, options: STATION_ARMAMENTS.options || [] };
  }
  function stationOpt(name) { return (STATION_ARMAMENTS && STATION_ARMAMENTS.options || []).find(o => o.name === name) || null; }
  function recalcStation(factionKey, station) {
    const def = findStationDef(factionKey, station);
    const base = def ? def.cost : (station.baseCost != null ? station.baseCost : station.cost || 0);
    station.baseCost = base;
    station.cost = base + (station.systems || []).reduce((t, n) => t + (stationOpt(n)?.cost || 0), 0);
  }
  function summariseStation(station) {
    const counts = {}; let armTotal = 0, upgTotal = 0;
    (station.systems || []).forEach(n => {
      counts[n] = (counts[n] || 0) + 1;
      const o = stationOpt(n);
      if (o) { if (o.category === 'Upgrades') upgTotal++; else armTotal++; }
    });
    return { counts, armTotal, upgTotal };
  }
  function canAddStationOption(station, opt, spec) {
    const { counts, armTotal, upgTotal } = summariseStation(station);
    if (opt.category === 'Upgrades') return upgTotal < spec.upgradeCap;
    if (opt.oncePerStation && (counts[opt.name] || 0) >= 1) return false;
    return armTotal < spec.required;   // Weapon Systems + Structures share the count
  }
  function addStationSystem(name) {
    const f = activeFleet; const st = f && f.spaceStation; if (!st) return;
    const spec = stationArmamentSpec(st); const opt = stationOpt(name);
    if (!spec || !opt || !canAddStationOption(st, opt, spec)) return;
    st.systems = st.systems || []; st.systems.push(name);
    recalcStation(f.faction, st);
    f.updatedAt = Date.now(); saveFleets(); haptic(HAPTIC.tick);
    renderStationDetail(); updateAppBar('screen-station-detail');
  }
  function removeStationSystem(name) {
    const f = activeFleet; const st = f && f.spaceStation; if (!st || !st.systems) return;
    const i = st.systems.lastIndexOf(name); if (i < 0) return;
    st.systems.splice(i, 1);
    recalcStation(f.faction, st);
    f.updatedAt = Date.now(); saveFleets(); haptic(HAPTIC.tick);
    renderStationDetail(); updateAppBar('screen-station-detail');
  }

  function renderStationArmamentPicker(station, spec) {
    const { counts, armTotal } = summariseStation(station);
    const complete = armTotal === spec.required;
    const byCat = {};
    spec.options.forEach(o => { (byCat[o.category] = byCat[o.category] || []).push(o); });
    const cats = Object.keys(byCat);
    const stationStepper = (o, c, canAdd) => `<div class="sys-option-controls">
              <button class="counter-btn" onclick="App.removeStationSystem('${o.name.replace(/'/g, "\\'")}')" ${c <= 0 ? 'disabled' : ''}>−</button>
              <span class="sys-option-count">${c}</span>
              <button class="counter-btn" onclick="App.addStationSystem('${o.name.replace(/'/g, "\\'")}')" ${canAdd ? '' : 'disabled'}>+</button>
            </div>`;
    const optsHtml = cats.map(cat => {
      const opts = byCat[cat];
      // Weapon armaments share ONE table (single header), each weapon a row with
      // its stats, then a compact cost + stepper line — mirrors desktop, no
      // repeated per-weapon datasheet per option.
      const isWeaponCat = opts.every(o => o.weapons && o.weapons.length);
      if (isWeaponCat) {
        const rows = opts.map(o => {
          const c = counts[o.name] || 0;
          const canAdd = canAddStationOption(station, o, spec);
          const w = o.weapons[0];
          const t = (w.type || '').toUpperCase();
          const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
          const dmg = `${w.damage || ''}${t ? `<span class="${tc}" style="margin-left:2px;font-size:12px">${t}</span>` : ''}`;
          const star = o.oncePerStation ? ' <span class="ship-tag">1×</span>' : '';
          return `<div class="weapon-row station-arm-row ${c > 0 ? 'selected' : ''}">
            <div class="weapon-name">${esc(o.name)}${star}</div>
            <div class="weapon-val">${esc(w.lock || '')}</div>
            <div class="weapon-val">${esc(w.attack || '')}</div>
            <div class="weapon-val">${dmg}</div>
            <div class="weapon-val weapon-arc">${arcCell(w.arc)}</div>
          </div>
          <div class="station-arm-ctrl">
            <span class="station-arm-special">${w.special && w.special !== '-' ? renderSpecialChips(w.special) : ''}</span>
            <span class="loadout-option-cost">${o.cost ? '+' + o.cost : '0'} pts</span>
            ${stationStepper(o, c, canAdd)}
          </div>`;
        }).join('');
        return `<div class="sys-cat-label">${esc(cat)}</div>
          <div class="weapon-table station-arm-table">
            <div class="weapon-row weapon-row-header">
              <div class="weapon-name">Weapon</div><div class="weapon-val">Lk</div><div class="weapon-val">At</div><div class="weapon-val">Dm</div><div class="weapon-val">Arc</div>
            </div>
            ${rows}
          </div>`;
      }
      // Non-weapon categories (launch modules, structures): keep the per-option
      // card with its launch table or effect line.
      return `
      <div class="sys-cat-label">${esc(cat)}</div>
      ${opts.map(o => {
        const c = counts[o.name] || 0;
        const canAdd = canAddStationOption(station, o, spec);
        // A mixed category (e.g. Upgrades) can still hold a weapon-bearing option
        // like Defence Grid — keep showing its datasheet here.
        const sheet = (o.weapons && o.weapons.length) ? optionWeaponSheet(o.weapons)
          : (o.loads && o.loads.length) ? buildLaunchTable(activeFleet.faction, o.loads)
          : (o.effect ? `<div class="loadout-option-desc">${linkKeywords(o.effect)}</div>` : '');
        return `<div class="sys-option ${c > 0 ? 'selected' : ''}">
          <div class="sys-option-row">
            ${stationOptThumb(o.name)}
            <div class="sys-option-main">
              <div class="flex justify-between items-center">
                <span class="loadout-option-name">${esc(o.name)}${o.oncePerStation ? ' <span class="ship-tag">1×</span>' : ''}</span>
                <span class="loadout-option-cost">${o.cost ? '+' + o.cost : '0'} pts</span>
              </div>
            </div>
            ${stationStepper(o, c, canAdd)}
          </div>
          ${sheet}
        </div>`;
      }).join('')}
    `;
    }).join('');
    return `<div class="loadout-section">
      <div class="section-header" style="padding:0 0 var(--sp-xs)">
        Armaments, choose ${spec.required}
        <span class="sys-total ${complete ? 'ok' : 'incomplete'}">${armTotal}/${spec.required}</span>
      </div>
      ${optsHtml}
    </div>`;
  }

  function renderStationDetail() {
    const f = activeFleet; const st = f && f.spaceStation;
    const el = document.getElementById('station-detail-content');
    if (!el) return;
    if (!st) { el.innerHTML = ''; return; }
    recalcStation(f.faction, st);
    const def = findStationDef(f.faction, st);
    const stats = (def && def.stats) || {};
    const art = stationArtPath(f.faction, st);
    const spec = stationArmamentSpec(st);

    const statDefs = [
      { key: 'scan', label: 'Scan', val: stats.scan },
      { key: 'sig', label: 'Sig', val: stats.sig },
      { key: 'hull', label: 'Hull', val: stats.hull },
      { key: 'es', label: 'ES', val: stats.es },
      { key: 'ks', label: 'KS', val: stats.ks }
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');
    const statGrid = statDefs.length ? statGridMobile(statDefs, false) : '';

    const weapons = (def && def.weapons) || [];
    const weaponSheet = weapons.length ? optionWeaponSheet(weapons) : '';
    // Weapons added by the selected upgrade (e.g. Defence Grid).
    let upgradeWeaponSheet = '';
    if (spec && st.systems) {
      const upgradeWpns = [];
      st.systems.forEach(name => {
        const opt = spec.options.find(o => o.name === name);
        if (opt && opt.weapons && opt.weapons.length) upgradeWpns.push(...opt.weapons);
      });
      if (upgradeWpns.length) upgradeWeaponSheet = optionWeaponSheet(upgradeWpns);
    }
    // Launch assets as the full ship-style table (parity with desktop + ships).
    const loadsHtml = def ? renderLaunchTable(f.faction, def) : '';
    const rules = (def && def.stationRules) || [];
    const rulesHtml = rules.length ? `<div class="loadout-section"><div class="section-header" style="padding:0 0 var(--sp-xs)">Station Rules</div>${rules.map(r => `<div class="rule-card"><div class="rule-card-name">${esc(r.name)}</div><div class="rule-card-text">${linkKeywords(r.effect || '')}</div></div>`).join('')}</div>` : '';
    const picker = spec ? renderStationArmamentPicker(st, spec) : '';

    el.innerHTML = `
      <div class="section-header">${esc(st.name)}, ${st.cost} pts</div>
      ${art ? `<div class="ship-art-hero">${shopLinkImg(st.name, `<img src="${art}" alt="${esc(st.name)}" loading="lazy">`, def)}</div>` : ''}
      ${statGrid}
      ${weaponSheet}
      ${upgradeWeaponSheet}
      ${loadsHtml}
      ${rulesHtml}
      ${picker}
      <button class="btn btn-ghost btn-block" onclick="App.removeStationPrompt()" style="color:var(--danger);border-color:var(--danger);margin-top:var(--sp-m)">Remove Station</button>
    `;
  }

  /* ── Play Mode ─────────────────────────────────────────── */
  const M_PLAY_ORDERS = ['General Quarters', 'Silent Running', 'Weapons Free', 'Course Change', 'Max Thrust', 'Damage Control'];
  const M_PLAY_ORDER_RULES = {
    'General Quarters':  'Remove two Spikes from the Group at the beginning of its activation. The Group may turn up to 45 degrees and then must move between half and full Thrust. Each Ship may attack with up to half of its listed Weapons rounded up (a Ship with three Weapons could fire two of them). Each Ship may launch Assets at the end of its Group\'s activation.',
    'Silent Running':    'Remove all Spikes from the Group at the beginning of its activation. The Group may not turn and must move between half and full Thrust. The Group cannot attack with any Weapons. Each Ship may launch Assets at the end of its Group\'s activation. If it does not, reduce its Signature to 0" until its next activation.',
    'Weapons Free':      'The Group cannot turn and must move between half and full Thrust. Each Ship may attack with any number of its Weapon Systems. Each Ship may then launch Assets, then the Group gains two Spikes at the end of its activation.',
    'Course Change':     'The Group may turn up to 45 degrees, must move up to half its Thrust, then make an additional turn up to 45 degrees. Each Ship may only attack with a single Weapon. The Group may forgo one of its allowed turns (either the first or second) to launch Assets at the end of its activation. The Group gains a Spike at the end of its activation.',
    'Max Thrust':        'The Group may not turn and must move between full and twice its Thrust. The Group cannot attack with any Weapons. The Group gains two Spikes at the end of its activation and cannot launch Assets.',
    'Damage Control':    'Each Ship recovers 1 lost Hull Point. Ships of H and C tonnage recover D3 lost Hull Points instead. The Group may turn up to 45 degrees then move up to half its Thrust. Each Ship may only attack with a single Close Action Weapon. The Group may not Launch Assets. During the Repair step of the End Phase, roll 2 dice for each Crippling Effect the Group attempts to repair. While rolling to save against Core hits due to Boarding Actions, this ship improves its BS value by 1 or gains a BS of 6+ if it has no BS value listed.',
  };
  const M_PLAY_CAPITAL = new Set(['M', 'H', 'C']);
  const M_CRIP_EFFECTS = [
    { key: 'fire',        label: 'On Fire',           stackable: true,
      icon: '<svg viewBox="0 0 20 24" fill="currentColor"><path d="M10 0C10 0 6 5 6 10c0 1.6.4 3 1 4.2C5.2 13.1 4 11 4 8.5 4 8.5 1 11 1 16a9 9 0 0 0 18 0C19 8 10 0 10 0Zm0 21a5 5 0 0 1-5-5c0-2.5 1.7-4.5 3-5.5.2 1 .8 2 1.7 2.5C9 10.5 10 8 10 8c0 0 3 2.5 3 6a3 3 0 0 1-3 3Z"/></svg>',
      color: 'err', title: '1 damage per token at start of End Phase. Repairable on 4+.' },
    { key: 'defSysOff',   label: 'Def. Sys. Offline',  stackable: false,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>',
      color: 'warn', title: 'All saves -1. Can be targeted as Focused ignoring Formation. Repairable 4+.' },
    { key: 'scannersOff', label: 'Scanners Offline',   stackable: false,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2.5"/></svg>',
      color: 'warn', title: 'Scan reduced to 1". Repairable on 4+.' },
    { key: 'weaponsOff',  label: 'Weapons Offline',    stackable: false,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="3" x2="12" y2="10"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2.5"/></svg>',
      color: 'warn', title: 'Cannot use Weapons or launch Assets. Repairable on 4+.' },
    { key: 'navOff',      label: 'Nav. Offline',       stackable: false,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8l-3 8 3-2 3 2-3-8Z" fill="currentColor" stroke="none"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2.5"/></svg>',
      color: 'warn', title: 'Movement capped at 2". Cannot turn or change Orbital Layer. Repairable on 4+.' },
    { key: 'orbDecay',    label: 'Orbital Decay',      stackable: false,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M12 12v8"/><path d="M8 18l4 4 4-4"/></svg>',
      color: 'err', title: 'Falls into Atmosphere. Cannot return to Orbit. Repairable on 6+.' },
  ];
  let mPlayFleet = null;
  let mPlayState = null;

  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  function mLoadPlayState(fleetId) {
    try { const r = localStorage.getItem('dfc_play_' + fleetId); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  function mSavePlayState() {
    if (!mPlayFleet || !mPlayState) return;
    try { localStorage.setItem('dfc_play_' + mPlayFleet.id, JSON.stringify(mPlayState)); } catch {}
  }
  function mInitPlayState(fleet) {
    const ex = mLoadPlayState(fleet.id) || {};
    mPlayState = { round: ex.round || 1, passes: ex.passes || [], opponentGroups: ex.opponentGroups || 0, vp: ex.vp || 0, oppVp: ex.oppVp || 0, battlegroups: ex.battlegroups || {}, ships: ex.ships || {} };
    for (const bg of (fleet.battleGroups || [])) {
      if (!mPlayState.battlegroups[bg.id]) mPlayState.battlegroups[bg.id] = { order: 'Standard', activated: false, spikes: 0 };
      else if (mPlayState.battlegroups[bg.id].spikes === undefined) mPlayState.battlegroups[bg.id].spikes = 0;
      for (const inst of (bg.ships || [])) {
        const db = findShip(fleet.faction, inst.groupCategory, inst.shipKey);
        const mods = db ? loadoutStatMods(db, inst, fleet.faction) : {};
        const rawHull = db && db.stats && db.stats.hull;
        const hull = db ? (parseInt(mods.hull ? adjustStatVal(rawHull, mods.hull) : rawHull) || 1) : 1;
        if (!mPlayState.ships[inst.id]) {
          mPlayState.ships[inst.id] = { cur: hull, fire: 0, defSysOff: false, scannersOff: false, weaponsOff: false, navOff: false, orbDecay: false };
        } else {
          const ss = mPlayState.ships[inst.id];
          if (ss.onFire !== undefined) { if (!ss.fire) ss.fire = ss.onFire ? 1 : 0; delete ss.onFire; }
          if (ss.powerOut !== undefined) { if (ss.weaponsOff === undefined) ss.weaponsOff = ss.powerOut; delete ss.powerOut; }
          M_CRIP_EFFECTS.forEach(e => { if (!e.stackable && ss[e.key] === undefined) ss[e.key] = false; });
          if (ss.fire === undefined) ss.fire = 0;
        }
      }
    }
    mSavePlayState();
  }
  function openMobilePlay() {
    if (!activeFleet) return;
    mPlayFleet = activeFleet;
    ensureFaction(mPlayFleet.faction).then(() => {
      mInitPlayState(mPlayFleet);
      navigate('screen-play');
    });
  }
  function mShowPlayPassInfo() {
    showSheet('Pass Tokens', '<p>Determine how many Groups each player has on the table, plus any the Scenario states may deploy this turn. If a player has two fewer Groups than the player with the most, they generate a Pass token. For each additional Group fewer, they generate another Pass token.</p><p>Pass tokens do not persist after the Activation Phase.</p>');
  }
  function renderMobilePlay() {
    const el = document.getElementById('play-content');
    if (!mPlayFleet || !mPlayState) { el.innerHTML = '<div class="play-empty">No fleet loaded.</div>'; return; }

    // Pass token auto-calc from opponent group count.
    const myGroups = (mPlayFleet.battleGroups || []).length;
    const oppGroups = mPlayState.opponentGroups || 0;
    const calcTokens = oppGroups > 0 ? Math.max(0, oppGroups - myGroups - 1) : 0;
    // Always resize — guards against ghost tokens when opp groups drops back to 0.
    while (mPlayState.passes.length < calcTokens) mPlayState.passes.push(false);
    if (mPlayState.passes.length > calcTokens) mPlayState.passes = mPlayState.passes.slice(0, calcTokens);
    const passes = mPlayState.passes || [];
    const passHtml = passes.length
      ? passes.map((used, i) =>
          `<span class="play-pass-pip${used ? ' play-pass-used' : ''}" onclick="App.mPlayTogglePass(${i})"></span>`
        ).join('')
      : (oppGroups > 0 ? '<span class="play-pass-none">none</span>' : '<span class="play-pass-none">&#x2193; groups</span>');
    const passInfoBtn = `<button class="play-pass-info-btn" onclick="App.mShowPlayPassInfo()" title="Pass token rules">&#9432;</button>`;
    const vp = mPlayState.vp || 0;
    const oppVp = mPlayState.oppVp || 0;
    const bgCards = (mPlayFleet.battleGroups || []).map(bg => renderMobilePlayBg(bg)).join('');
    el.innerHTML = `
      <div class="play-header">
        <div class="play-header-top">
          <div class="play-round-ctrl">
            <button class="play-round-btn" onclick="App.mPlayChangeRound(-1)" aria-label="Previous round">-</button>
            <div class="play-round-block">
              <span class="play-round-label">Round</span>
              <span class="play-round-num">${mPlayState.round}<span class="play-round-of">/6</span></span>
            </div>
            <button class="play-round-btn" onclick="App.mPlayChangeRound(1)" aria-label="Next round">+</button>
          </div>
          <div class="play-pass-tokens">
            <span class="play-pass-label">Pass ${passInfoBtn}</span>
            <span class="play-pass-pips">${passHtml}</span>
          </div>
          <div class="play-header-spacer"></div>
          <button class="play-end-round-btn" onclick="App.mPlayEndRound()">End Round</button>
        </div>
        <div class="play-header-bottom">
          <div class="play-score-ctrl">
            <span class="play-score-label">My VP</span>
            <button class="play-score-btn" onclick="App.mPlayChangeVP(-1)">&#8722;</button>
            <span class="play-score-num">${vp}</span>
            <button class="play-score-btn" onclick="App.mPlayChangeVP(1)">+</button>
          </div>
          <div class="play-score-ctrl">
            <span class="play-score-label">Opp VP</span>
            <button class="play-score-btn" onclick="App.mPlayChangeOppVP(-1)">&#8722;</button>
            <span class="play-score-num">${oppVp}</span>
            <button class="play-score-btn" onclick="App.mPlayChangeOppVP(1)">+</button>
          </div>
          <div class="play-score-ctrl play-opp-groups">
            <span class="play-score-label">Opp Groups</span>
            <button class="play-score-btn" onclick="App.mPlayChangeOppGroups(-1)">&#8722;</button>
            <span class="play-score-num">${oppGroups > 0 ? oppGroups : '?'}</span>
            <button class="play-score-btn" onclick="App.mPlayChangeOppGroups(1)">+</button>
          </div>
        </div>
      </div>
      <div class="play-bgs" style="padding:var(--sp-m);padding-bottom:88px">${bgCards}</div>`;
  }
  function renderMobilePlayBg(bg) {
    const bgs = mPlayState.battlegroups[bg.id] || { order: 'Standard', activated: false, spikes: 0 };
    const spikes = bgs.spikes || 0;
    let tonCode = 'M';
    if (bg.ships && bg.ships.length) {
      const db0 = findShip(mPlayFleet.faction, bg.ships[0].groupCategory, bg.ships[0].shipKey);
      if (db0 && db0.tonnage) tonCode = db0.tonnage;
    }
    const tonLabels = { L: 'Light', M: 'Medium', H: 'Heavy', C: 'Super-Heavy' };
    let admiralStr = '';
    const bgAdmiral = (mPlayFleet.admirals || []).find(a => a.groupId === bg.id);
    if (bgAdmiral) admiralStr = ` <span class="play-bg-admiral">&mdash; ${esc(bgAdmiral.name || 'Admiral')} (${bgAdmiral.rating || 0})</span>`;
    const spikePips = [0,1,2,3].map(i =>
      `<button class="play-spike-pip${i < spikes ? ' play-spike-on' : ''}" onclick="App.mPlaySpikeChange('${escAttr(bg.id)}',${i < spikes ? -1 : 1})">
        <svg viewBox="0 0 24 24" fill="${i < spikes ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l10 10-10 10L2 12Z"/></svg>
      </button>`
    ).join('');
    const orderChips = M_PLAY_ORDERS.map(o => {
      const isActive = bgs.order === o;
      const desc = escAttr(M_PLAY_ORDER_RULES[o] || '');
      return `<button class="play-order-chip${isActive ? ' play-order-sel' : ''}" data-rule-desc="${desc}" onclick="App.mPlaySetOrderAndShow(event,'${escAttr(bg.id)}','${escAttr(o)}')">${esc(o)}</button>`;
    }).join('');
    const famAdmiral = bgAdmiral && bgAdmiral.flagshipName ? bgAdmiral : null;
    const shipsHtml = (bg.ships || []).map((inst, idx) =>
      renderMobilePlayShip(inst, idx === 0 && famAdmiral ? famAdmiral.flagshipName : null)
    ).join('');
    const actDone = bgs.activated;
    return `<div class="play-bg-card play-ton-card-${tonCode}${actDone ? ' play-activated' : ''}">
      <div class="play-bg-header">
        <span class="play-ton-badge play-ton-${tonCode}">${tonLabels[tonCode] || tonCode}</span>
        <span class="play-bg-name">${esc(bg.name || 'Unnamed battlegroup')}${admiralStr}</span>
        <button class="play-act-btn${actDone ? ' play-done' : ''}" onclick="App.mPlayToggleActivation('${escAttr(bg.id)}')">${actDone ? '&#10003; Activated' : 'Activate'}</button>
      </div>
      <div class="play-spike-row">
        <span class="play-spike-label">Spikes</span>
        <span class="play-spike-sig">${spikes ? `+${spikes * 3}" Sig` : ''}</span>
        <div class="play-spike-pips">${spikePips}</div>
      </div>
      <div class="play-orders-row">${orderChips}</div>
      <div class="play-ships">${shipsHtml}</div>
    </div>`;
  }
  function renderMobilePlayShip(inst, flagshipName) {
    const db = findShip(mPlayFleet.faction, inst.groupCategory, inst.shipKey);
    if (!db) return '';
    const mods = loadoutStatMods(db, inst, mPlayFleet.faction);
    const getS = k => { const v = db.stats && db.stats[k]; return mods[k] ? adjustStatVal(v, mods[k]) : v; };
    const isCapital = M_PLAY_CAPITAL.has(db.tonnage);
    const ss = mPlayState.ships[inst.id] || { cur: parseInt(getS('hull')) || 1, fire: 0 };
    const hullMax = parseInt(getS('hull')) || 1;
    const cur = Math.max(0, Math.min(hullMax, ss.cur));
    const dmgTaken = hullMax - cur;
    const cripThresh = Math.floor(hullMax / 2);
    const isCrippled = isCapital && cur > 0 && cur <= cripThresh;
    const isDestroyed = cur === 0;

    // Ship name: flagship override shows famous admiral ship name, then class muted.
    const nameHtml = flagshipName
      ? `${esc(flagshipName)} <span class="play-ship-class">${esc(db.name)}</span>`
      : esc(db.name);

    // Hull pips: empty = healthy, filled orange/red = hit. Fill left→right as damage taken.
    let hullPipHtml = '';
    if (hullMax <= 20) {
      hullPipHtml = Array.from({ length: hullMax }, (_, i) => {
        const isDmg = i < dmgTaken;
        const pastCrip = isCapital && i >= cripThresh;
        const atThresh = isCapital && i === cripThresh;
        return `<span class="play-pip${isDmg ? (pastCrip ? ' play-pip-crip' : ' play-pip-dmg') : ''}${atThresh ? ' play-pip-thresh' : ''}"></span>`;
      }).join('');
    }
    const hullNumCls = isDestroyed ? ' play-hull-dead' : isCrippled ? ' play-hull-crippled' : '';
    const hullNum = `<span class="play-hull-num${hullNumCls}">${cur}/${hullMax}</span>`;

    const statCells = [
      { k: 'thrust', l: 'Thrust' }, { k: 'scan', l: 'Scan' }, { k: 'sig', l: 'Sig' },
      { k: 'es', l: 'ES' }, { k: 'ks', l: 'KS' }, { k: 'bs', l: 'BS' }
    ].filter(c => { const v = getS(c.k); return v && v !== '-' && v !== '--'; }).map(c =>
      `<div class="play-stat"><span class="play-stat-val">${esc(String(getS(c.k)))}</span><span class="play-stat-lbl">${c.l}</span></div>`
    ).join('');
    const wpns = Array.isArray(db.weapons) ? [...db.weapons] : [];
    (Array.isArray(db.loadoutOptions) ? db.loadoutOptions : []).forEach((lo, i) => {
      const sel = (inst.loadouts && inst.loadouts[i] !== undefined) ? inst.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && Array.isArray(opt.weapons)) wpns.push(...opt.weapons);
    });
    let weaponsHtml = '';
    if (wpns.length) {
      const rows = wpns.map(w => {
        const attRaw = parseInt(w.attack || w.att || 0);
        const attDisplay = isCrippled ? `<span class="play-crippled-atk">${Math.floor(attRaw / 2)}</span>` : (attRaw || '-');
        const dmgType = w.type || w.t || '';
        const dmg = w.damage || w.dmg || '-';
        return `<tr>
          <td class="play-wt-name">${esc(w.name)}</td>
          <td class="play-wt-num">${esc(w.arc || '-')}</td>
          <td class="play-wt-num">${attDisplay}</td>
          <td class="play-wt-num">${esc(w.lock || w.lk || '-')}</td>
          <td class="play-wt-num play-dmg-${dmgType}">${esc(String(dmg))}${dmgType ? `<span style="font-size:9px;opacity:.7">${dmgType}</span>` : ''}</td>
          <td class="play-wt-special">${esc(w.special || w.sp || '-')}</td>
        </tr>`;
      }).join('');
      weaponsHtml = `<div class="play-weapons-wrap"><table class="play-weapons">
        <thead><tr><th>Weapon</th><th>Arc</th><th>Att</th><th>Lk</th><th>Dmg</th><th>Sp</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }
    // Launch assets. Note: field is specialRules (camelCase), not special_rules.
    const loads = db.loads || [];
    let launchHtml = '';
    if (loads.length) {
      const items = loads.map(l =>
        `<span class="play-launch-item"><span class="play-launch-name">${esc(l.name)}</span> <span class="play-launch-val">Launch ${esc(String(l.launch || '?'))}</span>${l.special && l.special !== '-' ? ` <span class="play-launch-sp">${esc(l.special)}</span>` : ''}</span>`
      ).join(' ');
      launchHtml = `<div class="play-launch-row">${items}</div>`;
    }
    const rules = (db.specialRules || []).map(r => (typeof r === 'string' ? r : r.name)).filter(Boolean);
    let rulesHtml = '';
    if (rules.length) {
      const chips = rules.map(rname => {
        return `<span class="play-rule-chip" onclick="App.openRule('${escAttr(rname)}')">${esc(rname)}</span>`;
      }).join('');
      rulesHtml = `<div class="play-status-tokens">${chips}</div>`;
    }
    let cripHtml = '';
    if (isCapital) {
      const effs = M_CRIP_EFFECTS.map(ef => {
        if (ef.stackable) {
          const count = ss[ef.key] || 0;
          return `<div class="play-crip-counter${count ? ' play-crip-on play-crip-' + ef.color : ''}">
            <button class="play-crip-adj" onclick="App.mPlayCripChange('${escAttr(inst.id)}','${ef.key}',-1)">-</button>
            <span class="play-crip-icon">${ef.icon}</span>
            <span class="play-crip-badge-lbl">${esc(ef.label)}</span>
            <span class="play-crip-count">${count}</span>
            <button class="play-crip-adj" onclick="App.mPlayCripChange('${escAttr(inst.id)}','${ef.key}',1)">+</button>
          </div>`;
        }
        const on = !!ss[ef.key];
        return `<button class="play-crip-tok${on ? ' play-crip-on play-crip-' + ef.color : ''}" onclick="App.mPlayCripToggle('${escAttr(inst.id)}','${ef.key}')" title="${escAttr(ef.title)}">
          <span class="play-crip-icon">${ef.icon}</span>
          <span class="play-crip-badge-lbl">${esc(ef.label)}</span>
        </button>`;
      }).join('');
      cripHtml = `<div class="play-crip-row">${effs}</div>`;
    }
    const hasCorruptor = rules.some(r => /corruptor/i.test(r)) || /corruptor/i.test((db.stats && db.stats.special) || '');
    let corruptorHtml = '';
    if (hasCorruptor) {
      const cc = ss.corruptor || 0;
      corruptorHtml = `<div class="play-status-tokens"><div class="play-corruptor-ctrl">
        <button class="play-corruptor-btn" onclick="App.mPlayCorruptorChange('${escAttr(inst.id)}',-1)">-</button>
        <span class="play-corruptor-label">Corruptor &times;${cc}</span>
        <button class="play-corruptor-btn" onclick="App.mPlayCorruptorChange('${escAttr(inst.id)}',1)">+</button>
      </div></div>`;
    }
    return `<div class="play-ship${isDestroyed ? ' play-ship-destroyed' : ''}">
      <div class="play-ship-nameline">
        <span class="play-ship-name">${nameHtml}</span>
        ${isCrippled && !isDestroyed ? '<span class="play-crippled-badge">Crippled</span>' : ''}
      </div>
      <div class="play-hull-row">
        <div class="play-hull-pips">${hullPipHtml}${hullNum}</div>
        <div class="play-hull-dmg">
          <button class="play-hull-minus" onclick="App.mPlayHullChange('${escAttr(inst.id)}',1)" title="Remove 1 damage">−</button>
          <span class="play-hull-dmg-lbl">DMG</span>
          <button class="play-hull-plus" onclick="App.mPlayHullChange('${escAttr(inst.id)}',-1)" title="Add 1 damage">+</button>
        </div>
      </div>
      <div class="play-statline">${statCells}</div>
      ${weaponsHtml}
      ${launchHtml}
      ${rulesHtml}
      ${cripHtml}
      ${corruptorHtml}
    </div>`;
  }
  function mPlayChangeRound(delta) {
    if (!mPlayState) return;
    mPlayState.round = Math.max(1, Math.min(6, mPlayState.round + delta));
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayEndRound() {
    if (!mPlayState) return;
    Object.values(mPlayState.battlegroups).forEach(b => { b.activated = false; });
    mPlayState.passes = mPlayState.passes.map(() => false);
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayTogglePass(i) {
    if (!mPlayState) return;
    mPlayState.passes[i] = !mPlayState.passes[i];
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayChangeVP(delta) {
    if (!mPlayState) return;
    mPlayState.vp = Math.max(0, (mPlayState.vp || 0) + delta);
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayChangeOppVP(delta) {
    if (!mPlayState) return;
    mPlayState.oppVp = Math.max(0, (mPlayState.oppVp || 0) + delta);
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayChangeOppGroups(delta) {
    if (!mPlayState) return;
    mPlayState.opponentGroups = Math.max(0, (mPlayState.opponentGroups || 0) + delta);
    mSavePlayState(); renderMobilePlay();
  }
  function mPlaySetOrderAndShow(event, bgId, order) {
    mPlaySetOrder(bgId, order);
    const el = event.currentTarget;
    showSheet(order, `<p>${M_PLAY_ORDER_RULES[order] || ''}</p>`);
  }
  function mPlaySpikeChange(bgId, delta) {
    if (!mPlayState) return;
    const bg = mPlayState.battlegroups[bgId] || (mPlayState.battlegroups[bgId] = { order: 'Standard', activated: false, spikes: 0 });
    bg.spikes = Math.max(0, Math.min(4, (bg.spikes || 0) + delta));
    mSavePlayState(); renderMobilePlay();
  }
  function mPlaySetOrder(bgId, order) {
    if (!mPlayState) return;
    if (!mPlayState.battlegroups[bgId]) mPlayState.battlegroups[bgId] = { order: 'Standard', activated: false, spikes: 0 };
    mPlayState.battlegroups[bgId].order = order;
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayToggleActivation(bgId) {
    if (!mPlayState) return;
    if (!mPlayState.battlegroups[bgId]) mPlayState.battlegroups[bgId] = { order: 'Standard', activated: false, spikes: 0 };
    mPlayState.battlegroups[bgId].activated = !mPlayState.battlegroups[bgId].activated;
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayHullChange(shipId, delta) {
    if (!mPlayState) return;
    const ss = mPlayState.ships[shipId];
    if (!ss) return;
    let hullMax = 1;
    if (mPlayFleet) {
      outer: for (const bg of (mPlayFleet.battleGroups || [])) {
        for (const inst of (bg.ships || [])) {
          if (inst.id === shipId) {
            const db = findShip(mPlayFleet.faction, inst.groupCategory, inst.shipKey);
            if (db) {
              const mods = loadoutStatMods(db, inst, mPlayFleet.faction);
              const rawH = db.stats && db.stats.hull;
              hullMax = parseInt(mods.hull ? adjustStatVal(rawH, mods.hull) : rawH) || 1;
            }
            break outer;
          }
        }
      }
    }
    ss.cur = Math.max(0, Math.min(hullMax, ss.cur + delta));
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayCripChange(shipId, key, delta) {
    if (!mPlayState || !mPlayState.ships[shipId]) return;
    const ss = mPlayState.ships[shipId];
    ss[key] = Math.max(0, (ss[key] || 0) + delta);
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayCripToggle(shipId, key) {
    if (!mPlayState || !mPlayState.ships[shipId]) return;
    mPlayState.ships[shipId][key] = !mPlayState.ships[shipId][key];
    mSavePlayState(); renderMobilePlay();
  }
  function mPlayCorruptorChange(shipId, delta) {
    if (!mPlayState || !mPlayState.ships[shipId]) return;
    const ss = mPlayState.ships[shipId];
    ss.corruptor = Math.max(0, (ss.corruptor || 0) + delta);
    mSavePlayState(); renderMobilePlay();
  }

  /* ── Overflow dispatcher (app-bar ··· button) ──────────── */
  function overflow() {
    const active = document.querySelector('.screen.active')?.id;
    if (active === 'screen-group-detail') groupOverflow();
    else fleetOverflow();
  }


  /* ── Fleet overflow (delete / duplicate / share) ───────── */
  // Settings/options sheet (the gear in the app bar) — mobile equivalent of the
  // desktop Settings modal: the Additional-ships toggle, feedback, desktop switch.
  // Tapping the toggle re-opens the sheet so its new on/off state is visible.
  // What's New — TTCombat publishes no official changelog, so this is the
  // maintainer's interpretation. Mirrors the desktop changelog.
  const CHANGELOG = [
    { date: '2026-07-09', title: 'Play Mode improvements', items: [
      'VP tracking: My VP and Opp VP counters in the play header. Opp Groups counter auto-calculates your Pass tokens (rulebook 4.3.1).',
      'Orders now correct per rulebook 2.3.1: General Quarters, Silent Running, Weapons Free, Course Change, Max Thrust, Damage Control. Tap any order chip to set it AND read its full verbatim rules.',
      'Battlegroup cards get a coloured left-border accent by tonnage class.',
      'Weapon table now scrolls horizontally on narrow screens instead of spilling off the edge.',
      'Hull tracker: Hit/Fix buttons replaced with compact -DMG+ pill. - removes damage, + adds it.',
      'Hull tracker: pips fill left-to-right as damage accumulates (orange = below cripple, red = past it).',
      'Crippled badge and halved attack dice now correctly appear for Colossal/Super-Heavy ships.',
      'Activate button now says "Activated" once tapped.',
      'Pass token button now opens full pass-token rules on tap.',
      'Launch assets (drop/assault) shown on ships that carry them.',
      'Famous-admiral flagship names shown as primary; ship class in muted parentheses.',
      'Spike Sig text always reserves its width -- no more layout jump when spikes change.',
      'Special rules chips now correctly appear for all ships.',
    ] },
    { date: '2026-07-09', title: 'Play Mode', items: [
      'New: tap the ... menu on a fleet and choose "Play mode" to open an in-game companion for your fleet.',
      'Per-ship hull pips (filled/empty dots) for instant damage readout, plus numeric tracker. Crippled only triggers on Capital ships (M/H/C tonnage, rulebook 7.3.6) -- Light frigates are never crippled.',
      'When a Capital Ship hits half hull, a cripple threshold marker appears on the pips and weapon attacks show halved in red.',
      'Spike tracker per battlegroup: 4 diamond pips, each showing +3" Sig penalty.',
      'Full crippling effects panel per Capital Ship: On Fire (stackable counter), Defence Systems Offline, Scanners Offline, Weapons Offline, Navigation Offline, Orbital Decay -- each with icon and rules summary.',
      'Special rules as tappable chips that open the full rule description.',
      'Orders picker, Activate button that dims the battlegroup card once tapped.',
      'Round counter (1/6 to 6/6), Pass token pips with tap-for-rules button, End Round resets activations and pass tokens.',
      'Bioficer ships get a Corruptor counter.',
      'All state persists in localStorage -- shared with the desktop app for the same fleet.',
    ] },
    { date: '2026-07-09', title: 'Quieter ship class next to named flagships', items: [
      'A named famous-admiral flagship (e.g. "Fortune\'s Fancy") now shows its ship class in a smaller, muted aside on the same line, e.g. Fortune\'s Fancy (Tribune Battlecruiser), rather than the class competing at full size with the flagship\'s proper name.',
    ] },
    { date: '2026-07-09', title: 'Six Bioficer ships were missing their Class', items: [
      'Sluice, Source, Syntax, Synthesis, Sierra and Shade showed only a single-word name with no ship Class, unlike every other ship in the roster. Fixed to Sluice Supercruiser, Source Battlecruiser, Syntax Pocket Battleship, Synthesis Pocket Battleship, Sierra Pocket Battleship and Shade Pocket Battleship, matching the official stats sheet.',
      'Also filled in missing tonnage codes and group-size fields for the same six ships, and fixed Shade\'s Torpedo load (was misnamed "Torpedoes", which meant it silently missed its Corruptor-2 stat).',
    ] },
    { date: '2026-07-09', title: 'Corrected admiral initiative text; Bioficer Torpedo fix', items: [
      'The generic-admiral picker said an Admiral "adds Level for AP & initiative" — the AP half is right, but initiative isn\'t additive: per the rulebook (6.3), only the single highest-Level Admiral on the table adds a flat +1 to their side\'s initiative roll (or all sides if tied for highest). Corrected the wording.',
      'The Bioficer Torpedo launch asset was missing its Corruptor-2 special rule, so any ship carrying a Torpedo load (e.g. the Bastion Battleship) showed it without that stat. Fixed to match the official stats sheet.',
    ] },
    { date: '2026-07-09', title: 'Battlegroups now sort by weight class + drag to reorder', items: [
      'The battlegroup list now auto-buckets by weight class (Colossal > Heavy > Medium > Light > Payload), with a divider between each, exactly matching desktop and the printed/shared sheet. Previously mobile showed groups in whatever order you added them, which could look different from what got printed or shared.',
      'Added a drag handle to reorder a group among its same-weight-class siblings (built with Pointer Events, so it works reliably with touch).',
    ] },
    { date: '2026-07-08', title: 'Namesake pronunciations: 5 more ships, search', items: [
      'Wrote and added namesakes for 5 ships that were missing a pronunciation guide: Melusine, Rusalka, Nereid, Fossegrim and Kikimora Pocket Battleship/Supercruiser.',
      'Ship search now also matches a ship\'s Namesake text, so searching a mythological or folklore name finds its ship even if that word isn\'t in the ship\'s own name.',
    ] },
    { date: '2026-07-08', title: 'How do you say it? Namesake pronunciations', items: [
      'Ships named after hard-to-pronounce people, places and creatures now carry a pronunciation guide in the Lore panel, woven into the Namesake line at the first mention, e.g. "Namesake: Theseus (THEE-syoos) was the legendary king...".',
      'Tap the respelling to hear it spoken aloud.',
      'Covers the trickiest namesakes across every faction (PHR Greek myth, Scourge folklore, Shaltari minerals, plus place and admiral names like Kyiv, Reykjavik and Yi Sun-sin).',
    ] },
    { date: '2026-07-08', title: 'Scourge missing special rules', items: [
      'The Bannik Pocket Battleship now has its Oculus Booster rule, which had been dropped when the Scourge fleet was updated to the latest edition. Its Special line reads "Command Ship-1, Oculus Booster" again.',
      'The Kikimora and Fossegrim Pocket Battleships now carry their Feature Carrier rule (choose a Scourge Deployable Feature at the start of the game), which was likewise missing.',
      'Added an automated data check so a ship can no longer silently lose one of the rules printed in its Special column when a fleet is re-ingested from a new edition PDF.',
    ] },
    { date: '2026-07-05', title: 'Kalium KNC fixes & launch totals', items: [
      'Fixed the Kalium KNC-5 Line Cruiser (now 70 pts each, 140 for the minimum group of 2) and the KNC-12 Fleet Carrier (now 115 pts each, 230 for a group of 2). Both had wrongly shown the bare 45 pt Light Cruiser hull, with their loadout never costed in.',
      'The KNC-12 is a Fleet Carrier, not a Line Cruiser - fixed its name everywhere it appears (it had wrongly copied the KNC-5\'s class name).',
      'Both KNC ships now use their correct group size of 2 to 3, and only appear under the "Additional ships" toggle (they are Counts As resin models from the Misc ship stats).',
      'Launch bays now add up: a ship with two Fighters & Bombers Launch 2 bays reads as Launch 4, rather than two "Launch 2" rows.',
      'High Power is no longer listed as a standing special rule just because a weapon can Overcharge. It only matters when a weapon is actually Overcharged (tap the Overcharge chip to read how).',
      'Corrected the group sizes of three more Additional ships whose printed range disagreed with what the builder allowed: LKS Dredger (1 to 2), T-Type Tugboat (1 to 4) and Argonaut (1 to 2).',
    ] },
    { date: '2026-07-04', title: 'Mobile Resistance Fast Play fix', items: [
      'The mobile Resistance Fast Play sheet now matches desktop: it builds the correct modular Cruiser, Strike Carrier and Heavy Frigate hulls with their systems pre-selected and their proper sheet names (VH2A Gun Cruiser, TFCS Hybrid Carrier, L2BR Fast Transport, TL Strike Carrier, CT Attack Frigate), instead of unequipped generic cruisers.',
    ] },
    { date: '2026-07-02', title: 'Bastion ship-stats fix', items: [
      'Fixed the buildable Bioficer Bastion Battleship: 225 pts, BS 5+, Gravitic Hyperlance (it had wrongly carried the Agency flagship\'s 245 pts / BS 4+). The Agency flagship Bastion is unchanged.',
    ] },
    { date: '2026-07-02', title: 'Print, reordering & rules fixes', items: [
      'Desktop: group cards now show a drag handle to reorder battlegroups within a weight class, and print sheets keep headings with their ships and no longer split rules mid-sentence across a page.',
      'The Argonaut\'s "Mind of its Own" is now enforced when building a list: no Admiral can be assigned to it, and its points do not count toward your Medium-tonnage allowance (rulebook 4.2).',
    ] },
    { date: '2026-07-01', title: 'New civilian ships', items: [
      'Two new ships from the Civilian Ships & Scenarios update: the EX-7 Packet Runner (UCM courier, 57 pts) and the Argonaut (space-dwelling astrofauna, 112 pts). Both can be taken in any fleet, under the Misc Ships filter.',
    ] },
    { date: '2026-06-26', title: 'New rules editions + heroes', items: [
      'Scourge updated to the latest edition: Oculus Beam Array Attack 2→3 (Shadow, Umbra, Banshee, Akuma, Flayer), Shadow & Umbra points changes, reworked Oculus Booster rule.',
      'Eight new Scourge ships: Nereid, Rusalka, Nixie, Gloam, Kikimora, Bannik, Melusine, Fossegrim.',
      'Three new Scourge Deployable Features: Skybane Halo, Shrouding Platform, Infestation Bastion.',
      'New hero ships: Avram Bei (PHR) and Rhiannon Major (UCM).',
      'Famous-admiral flagship Porter abilities now count toward Payload capacity.',
      'Sharper, higher-resolution ship art thumbnails.',
    ] },
    { date: '2026-06-25', title: 'Ship-stats accuracy pass', items: [
      'Audited every famous-admiral flagship against the official PDFs and fixed wrong weapons, stats and points.',
      'Fixed missing Alt-fire weapon modes; restored and reordered ship lore; fixed a UCM station art swap.',
    ] },
    { date: '2026-06', title: 'Earlier highlights', items: [
      'New Recruit list import; combat damage calculator; collection tracker; print overhaul; battlegroup naming.',
    ] },
  ];
  function openChangelog() {
    const body = `<p style="font-style:italic;color:var(--fg3);background:var(--bg2);border-left:3px solid var(--accent,#b8902b);padding:8px 10px;border-radius:4px;margin:0 0 12px">TTCombat has not kept the changelog updated or made it public, so this is my interpretation. No promises!</p>`
      + CHANGELOG.map(e => `<div style="margin-bottom:12px"><div style="font-weight:600;text-transform:uppercase;letter-spacing:.03em;font-size:.85em;border-bottom:1px solid rgba(0,0,0,.12);padding-bottom:2px;margin-bottom:4px">${esc(e.date)} &middot; ${esc(e.title)}</div><ul style="margin:0;padding-left:1.1em">${e.items.map(i => `<li style="margin-bottom:3px">${esc(i)}</li>`).join('')}</ul></div>`).join('');
    showSheet("What's New", body);
  }
  function openSettingsSheet() {
    showActionSheet([
      // Misc Ships is a picker filter chip now (its own list), not a global setting.
      { label: `Two-column print  ${localStorage.getItem('dfc_print2col') === '1' ? '✓ On' : 'Off'}`,
        action: () => { localStorage.setItem('dfc_print2col', localStorage.getItem('dfc_print2col') === '1' ? '0' : '1'); haptic(HAPTIC.tick); openSettingsSheet(); } },
      { label: "What's New", action: openChangelog },
      { label: 'Send feedback', action: () => { window.location.href = FEEDBACK_HREF; } },
      { label: 'Switch to desktop view', action: viewDesktop }
    ]);
  }

  function fleetOverflow() {
    showActionSheet([
      { label: 'Play mode', action: openMobilePlay },
      { label: 'Copy army list', action: copyFleetText },
      { label: 'Copy as JSON', action: copyFleetJSON },
      { label: 'Export PDF', action: exportPdf },
      { label: 'Edit name & size', action: openEditFleet },
      { label: 'Share', action: shareFleet },
      { label: 'Duplicate fleet', action: duplicateFleet },
      { label: 'Send feedback', action: () => { window.location.href = FEEDBACK_HREF; } },
      { label: 'Delete fleet', danger: true, action: deleteFleetPrompt }
    ]);
  }
  function deleteFleetPrompt() {
    showActionSheet([{ label: `Delete “${activeFleet.name}”?`, danger: true, action: () => {
      const idx = fleets.indexOf(activeFleet);
      if (idx >= 0) fleets.splice(idx, 1);
      activeFleet = null;
      saveFleets();
      history.length = 0;
      navigate('screen-fleet-list', { replace: true });
    } }]);
  }
  function duplicateFleet() {
    const copy = JSON.parse(JSON.stringify(activeFleet));
    copy.id = uuid();
    copy.name = activeFleet.name + ' (Copy)';
    copy.createdAt = copy.updatedAt = Date.now();
    delete copy._index;
    fleets.push(copy);
    saveFleets();
    activeFleet = copy;
    renderFleetDetail();
  }

  /* ── Share (URL encode, desktop-compatible) ────────────── */
  // Unicode-safe base64 (btoa/atob are Latin1-only and throw on curly apostrophes,
  // em-dashes, accents). Round-trip through UTF-8 bytes; ASCII encodes identically
  // to plain btoa, so old links and cross-app (desktop) links still decode.
  function b64FromStr(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function strFromB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeFleet(fleet) {
    const _sz = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    const mini = {
      n: fleet.name, f: fleet.faction, s: fleet.gameSize,
      pl: (fleet.pointsLimit && fleet.pointsLimit !== _sz.max) ? fleet.pointsLimit : undefined,
      g: (fleet.battleGroups || []).map(g => ({
        n: g.name,
        sh: g.ships.map(s => {
          const e = { c: s.groupCategory, k: s.shipKey, p: s.points };
          if (s.loadouts && Object.keys(s.loadouts).length) e.l = s.loadouts;
          if (s.feature) e.ft = s.feature;                       // deployable feature / Genitor Tower
          if (s.systems && s.systems.length) e.sy = s.systems;   // Resistance hardpoints
          return e;
        })
      }))
    };
    if (fleet.description) mini.d = fleet.description;
    if (fleet.admirals?.length) mini.as = fleet.admirals.map(a => {
      const o = { n: a.name, p: a.points };
      if (a.admiralId) o.i = a.admiralId;
      if (a.shipKey) o.k = a.shipKey;
      if (a.level) o.l = a.level;
      if (a.type) o.t = a.type;
      if (a.selectedAbilities?.length) o.sa = a.selectedAbilities;
      if (a.assignedGroupId) o.ag = a.assignedGroupId;
      return o;
    });
    if (fleet.spaceStation) {
      mini.ss = { n: fleet.spaceStation.name, c: fleet.spaceStation.cost, k: fleet.spaceStation.stationKey };
      if (fleet.spaceStation.systems && fleet.spaceStation.systems.length) mini.ss.sy = fleet.spaceStation.systems;
    }
    if (fleet.secondaryObjectives?.length) mini.so = fleet.secondaryObjectives;
    return b64FromStr(JSON.stringify(mini)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeFleet(encoded) {
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const mini = JSON.parse(strFromB64(b64));
      const size = GAME_SIZES[mini.s] || GAME_SIZES.clash;
      const fleet = {
        id: uuid(), name: mini.n || 'Shared Fleet', description: mini.d || '',
        faction: mini.f, gameSize: mini.s || 'clash',
        pointsLimit: mini.pl != null ? mini.pl : size.max, maxGroups: size.groups,
        admirals: [], spaceStation: null,
        battleGroups: (mini.g || []).map(g => ({
          id: uuid(), name: g.n || 'Group',
          ships: (g.sh || []).map(s => ({
            id: uuid(), groupCategory: s.c, shipKey: s.k, points: s.p, loadouts: s.l || {},
            feature: s.ft || undefined, systems: s.sy || []
          }))
        })),
        secondaryObjectives: mini.so || [],
        createdAt: Date.now(), updatedAt: Date.now()
      };
      if (mini.ss) fleet.spaceStation = { name: mini.ss.n, cost: mini.ss.c || 0, stationKey: mini.ss.k || null, systems: mini.ss.sy || [] };
      if (mini.as) fleet.admirals = mini.as.map(a => ({
        // Famous admirals are keyed by id; desktop stores it as `k`, mobile as `i`
        // — cross-fall-back so a fleet shared from either device resolves.
        name: a.n, points: a.p || 0, admiralId: a.i || a.k || null, shipKey: a.k || a.i || null,
        level: a.l || 1, type: a.t || 'Generic',
        shipName: null, selectedAbilities: a.sa || [], assignedGroupId: a.ag || null
      }));
      return fleet;
    } catch (e) { console.warn('decode failed', e); return null; }
  }

  async function importFromHash() {
    const m = location.hash.match(/#share\/(.+)$/) || location.hash.match(/#fleet=(.+)$/);
    if (!m) return false;
    const fleet = decodeFleet(m[1]);
    window.history.replaceState(null, '', location.pathname); // clear hash (local `history` is the nav stack)
    if (!fleet) return false;
    await ensureFaction(fleet.faction);   // shared fleet may be a faction we haven't loaded
    fleets.push(fleet);
    saveFleets();
    openFleet(fleets.length - 1);
    return true;
  }

  /* ── Fleet as plain-text army list (New-Recruit style, Discord-friendly) ── */
  // Mirrors the desktop generateFleetText: header + total, then Famous Admirals
  // (split into admiral + flagship), then groups by tonnage Colossal→Light, then
  // Space Station. Multi-ship groups read "• Nx Name [per-ship pts]".
  function fleetToText(fleet) {
    const total = fleetPoints(fleet);
    const name = fleet.name || 'Fleet';
    const faction = FACTIONS[fleet.faction] || {};
    let out = `# ++ ${name} ++ [${total} pts]\n`;

    const admirals = fleet.admirals || [];
    if (admirals.length) {
      const admPts = admirals.reduce((t, a) => t + (a.points || 0), 0);
      const anyFamous = admirals.some(a => a.type === 'Famous' || a.type === 'Faction');
      out += `\n## ${anyFamous ? 'Famous Admirals' : 'Admirals'} [${admPts} pts]\n`;
      admirals.forEach(a => {
        const src = (faction.admirals || []).find(x => x.id === a.admiralId);
        const flagCost = (src && src.flagship && src.flagship.cost) || 0;
        const flagName = a.shipName || (src && src.flagship && src.flagship.name);
        if (flagName && flagCost) {
          out += `• 1x ${a.name} [${(a.points || 0) - flagCost} pts]\n`;
          out += `• 1x ${flagName} [${flagCost} pts]\n`;
        } else {
          out += `• 1x ${a.name} [${a.points || 0} pts]\n`;
        }
      });
    }

    const TONNAGE = [['colossal', 'Colossal'], ['heavy', 'Heavy'], ['medium', 'Medium'], ['light', 'Light'], ['payload', 'Payload']];
    TONNAGE.forEach(([cat, label]) => {
      const groups = (fleet.battleGroups || []).filter(g => g.ships.length && (g.ships[0].groupCategory || 'medium') === cat);
      if (!groups.length) return;
      const secPts = groups.reduce((t, g) => t + groupPoints(fleet, g), 0);
      out += `\n## ${label} Groups [${secPts} pts]\n`;
      groups.forEach(g => {
        const profs = [];
        g.ships.forEach(s => {
          const key = s.shipKey + ':' + JSON.stringify(s.loadouts || {}) + ':' + JSON.stringify(s.systems || []) + ':' + (s.feature || '');
          let p = profs.find(x => x.key === key);
          if (!p) { p = { key, s, count: 0 }; profs.push(p); }
          p.count++;
        });
        profs.forEach(({ s, count }) => {
          const db = findShip(fleet.faction, s.groupCategory, s.shipKey);
          const nm = db ? db.name : s.shipKey;
          out += count > 1 ? `• ${count}x ${nm} [${s.points} pts]\n` : `${nm} [${s.points} pts]\n`;
          const notes = [];
          (db && db.loadoutOptions || []).forEach((lo, i) => { const o = lo.options[(s.loadouts && s.loadouts[i]) || 0]; if (o && o.cost) notes.push(o.name); });
          if (s.systems && s.systems.length) { const c = {}; s.systems.forEach(n => c[n] = (c[n] || 0) + 1); notes.push(...Object.entries(c).map(([n, k]) => k > 1 ? `${k}x ${n}` : n)); }
          if (s.feature) notes.push(s.feature);
          notes.forEach(n => { out += `    - ${n}\n`; });
        });
      });
    });

    if (fleet.spaceStation) {
      out += `\n## Space Station [${fleet.spaceStation.cost || 0} pts]\n`;
      out += `${fleet.spaceStation.name} [${fleet.spaceStation.cost || 0} pts]\n`;
      (fleet.spaceStation.systems || []).forEach(n => { out += `    - ${n}\n`; });
    }

    return out.trimEnd();
  }
  function copyFleetText() {
    const text = fleetToText(activeFleet);
    const show = (msg) => showSheet('Copy List',
      `<p>${msg}</p><pre class="copy-pre">${esc(text)}</pre>`);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => show('Copied to clipboard, paste it into Discord, etc.')).catch(() => show('Select and copy:'));
    } else {
      show('Select and copy:');
    }
  }

  /* ── Copy fleet as JSON (backup / power users) — desktop parity ─ */
  function copyFleetJSON() {
    const json = JSON.stringify(activeFleet, null, 2);
    const show = (msg) => showSheet('Copy JSON', `<p>${msg}</p><pre class="copy-pre">${esc(json)}</pre>`);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => show('Copied JSON to clipboard.')).catch(() => show('Select and copy:'));
    } else { show('Select and copy:'); }
  }

  /* ── Import a fleet from a pasted link / code / JSON — desktop parity ─ */
  function importFleetPrompt() {
    showSheet('Import a fleet',
      `<p>Paste a share link, a share code, or fleet JSON, from desktop or another device.</p>
       <textarea id="import-text" class="import-textarea" rows="5" placeholder="https://…#share/…   or   { fleet JSON }"></textarea>
       <button class="btn btn-primary btn-block" style="margin-top:var(--sp-m)" onclick="App.doImportText()">Import fleet</button>`);
  }
  async function doImportText() {
    const el = document.getElementById('import-text');
    const raw = ((el && el.value) || '').trim();
    if (!raw) return;
    let fleet = null;
    // 1) Share link or bare share code
    const m = raw.match(/#(?:share\/|fleet=)(.+)$/);
    const code = m ? m[1] : (/^[A-Za-z0-9\-_]+={0,2}$/.test(raw) ? raw : null);
    if (code) fleet = decodeFleet(code);
    // 2) Raw fleet JSON
    if (!fleet) {
      try {
        const o = JSON.parse(raw);
        if (o && o.faction && Array.isArray(o.battleGroups)) {
          fleet = o; fleet.id = uuid(); fleet.createdAt = fleet.updatedAt = Date.now();
        }
      } catch (e) { /* not JSON */ }
    }
    if (!fleet) { showSheet('Import failed', `<p>That doesn’t look like a valid fleet link, code, or JSON.</p>`); return; }
    closeRuleSheet();
    await ensureFaction(fleet.faction);
    fleets.push(fleet);
    saveFleets();
    openFleet(fleets.length - 1);
  }

  // Launch-asset table for the printed sheet. Mirrors the on-screen launch
  // table (same data + deploy ranges) so printed docs carry full launch info.
  function printLaunchTable(map, db) {
    const loads = db.loads || [];
    if (!loads.length) return '';
    // Sum identical launch bays so "Launch 4" prints once, not two "Launch 2" rows.
    const grouped = [];
    const byKey = new Map();
    loads.forEach(load => {
      if (!load.name) return;
      const n = parseInt(load.launch, 10);
      const key = Number.isFinite(n) ? `${load.name}|${load.special ?? ''}` : null;
      if (key && byKey.has(key)) { const g = byKey.get(key); g._n += n; g.launch = String(g._n); }
      else { const g = { ...load, _n: Number.isFinite(n) ? n : null }; if (key) byKey.set(key, g); grouped.push(g); }
    });
    let rows = '';
    grouped.forEach(load => {
      if (!load.name) return;
      const parts = load.name.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
      parts.forEach((part, i) => {
        const a = map[part.toLowerCase()] || { name: part };
        const has = a.attack != null;
        const t = (a.type || '').toUpperCase();
        const isBattalion = DEPLOY_RANGE[part.toLowerCase()] !== undefined;
        const range = isBattalion ? DEPLOY_RANGE[part.toLowerCase()] : '6"';
        const special = (a.special && a.special !== '-') ? a.special
          : a.ksReroll != null ? `Close Protection (re-roll ${a.ksReroll})`
          : '';
        rows += `<tr>
          <td>${i === 0 ? esc(load.launch || '-') : ''}</td>
          <td>${esc(part)}</td>
          <td>${esc(range)}</td>
          <td>${esc(a.thrust || '-')}</td>
          <td>${has ? esc(a.attack) : '-'}</td>
          <td>${has ? esc(a.lock) : '-'}</td>
          <td>${has ? `${esc(a.damage)}${t}` : '-'}</td>
          <td>${esc(special)}</td>
        </tr>`;
      });
    });
    return `<div class="pr-launch-label">Launch Assets</div>
      <table class="pr-weapons pr-launch"><thead><tr><th>Launch</th><th>Load</th><th>Rng</th><th>Thr</th><th>At</th><th>Lk</th><th>Dm</th><th>Special</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  /* ── Export as PDF (printable view → browser "Save as PDF") ─ */
  function exportPdf() {
    const f = activeFleet;
    const size = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const limit = f.pointsLimit || size.max;
    const pts = fleetPoints(f);
    const info = FACTION_INFO[f.faction];
    const usedRules = new Map();  // keyword -> description (for the glossary)

    const collectRule = name => {
      const r = lookupRule(name);
      if (r.description && !usedRules.has(name)) usedRules.set(name, r.description);
    };
    const laMap = getLaunchAssetMap(f.faction);

    const groupsHtml = sortGroupsByWeight(f.battleGroups).map(g => {
      const inst = g.ships[0];
      if (!inst) return '';
      const db = findShip(f.faction, inst.groupCategory, inst.shipKey);
      if (!db) return '';
      const st = db.stats || {};
      const qty = g.ships.length;
      const mods = loadoutStatMods(db, inst, f.faction);
      const statCells = [['Scan', 'scan', st.scan], ['Sig', 'sig', st.sig], ['Thrust', 'thrust', st.thrust], ['Hull', 'hull', st.hull],
        ['ES', 'es', st.es], ['KS', 'ks', st.ks], ['BS', 'bs', st.bs], ['PD', 'pd', st.pd]]
        .filter(([, , v]) => v != null && v !== '-' && v !== '')
        .map(([lab, key, v]) => `<span class="pr-stat${mods[key] ? ' pr-stat-mod' : ''}"><b>${lab}</b> ${esc(mods[key] ? adjustStatVal(v, mods[key]) : v)}</span>`).join('');
      // Merge base + selected loadout + selected system/hardpoint weapons into one
      // table, so "systems that are weapons" read as weapon rows on the print sheet.
      const wlist = (db.weapons || []).map(w => ({ ...w }));
      (db.loadoutOptions || []).forEach((lo, i) => {
        const si = inst.loadouts && inst.loadouts[i] != null ? inst.loadouts[i] : 0;
        const o = lo.options[si];
        if (o && o.weapons) o.weapons.forEach(w => wlist.push({ ...w }));
      });
      const sysListW = systemsListFor(db, f.faction);
      if (sysListW && inst.systems) {
        const cnts = {}; inst.systems.forEach(n => cnts[n] = (cnts[n] || 0) + 1);
        Object.entries(cnts).forEach(([nm, c]) => { const o = findSystemOption(sysListW, nm); if (o && o.weapons) o.weapons.forEach(w => wlist.push({ ...w, name: (c > 1 ? c + '× ' : '') + (w.name || nm) })); });
      }
      const weapons = wlist.map(w => {
        if (w.special && w.special !== '-') w.special.split(',').forEach(s => collectRule(s.trim()));
        return `<tr><td>${esc(w.name)}</td><td>${esc(w.lock || '')}</td><td>${esc(w.attack || '')}</td><td>${esc(w.damage || '')}${esc(w.type || '')}</td><td>${esc(w.arc || '')}</td><td>${esc(w.special && w.special !== '-' ? w.special : '')}</td></tr>`;
      }).join('');
      // launch-asset special keywords also feed the glossary
      (db.loads || []).forEach(load => {
        if (!load.name) return;
        load.name.split(/\s*&\s*/).forEach(part => {
          const a = laMap[part.trim().toLowerCase()];
          if (a && a.special && a.special !== '-') a.special.split(',').forEach(s => collectRule(s.trim()));
        });
      });
      // ship special rules (full text inline)
      (db.specialRules || []).forEach(r => { if (r.description && !usedRules.has(r.name)) usedRules.set(r.name, r.description); });
      const rulesInline = (db.specialRules || []).map(r => esc(r.name)).join(', ');
      const opts = [];
      (db.loadoutOptions || []).forEach((lo, i) => {
        const si = inst.loadouts && inst.loadouts[i] != null ? inst.loadouts[i] : 0;
        if (lo.options[si] && si !== 0) opts.push('Loadout: ' + lo.options[si].name);
      });
      if (inst.feature) opts.push('Feature: ' + inst.feature);
      if (inst.systems && inst.systems.length) {
        const c = {}; inst.systems.forEach(n => c[n] = (c[n] || 0) + 1);
        opts.push('Systems: ' + Object.entries(c).map(([n, ct]) => ct > 1 ? `${n} ×${ct}` : n).join(', '));
      }
      const prLabel = (g.name && g.name !== db.name) ? `${esc(g.name)} <span class="pr-group-class">(${qty}× ${esc(db.name)})</span>` : `${qty}× ${esc(db.name)}`;
      return `<div class="pr-group">
        <div class="pr-group-head"><span class="pr-group-name">${prLabel}</span><span class="pr-group-pts">${groupPoints(f, g)} pts</span></div>
        <div class="pr-stats">${statCells}</div>
        ${weapons ? `<table class="pr-weapons"><thead><tr><th>Weapon</th><th>Lk</th><th>At</th><th>Dm</th><th>Arc</th><th>Special</th></tr></thead><tbody>${weapons}</tbody></table>` : ''}
        ${printLaunchTable(laMap, db)}
        ${rulesInline ? `<div class="pr-rules-line"><b>Special:</b> ${rulesInline}</div>` : ''}
        ${opts.length ? `<div class="pr-opts">${opts.map(esc).join(', ')}</div>` : ''}
      </div>`;
    }).join('');

    const admiralsHtml = (f.admirals || []).map(a =>
      `<div class="pr-line"><b>${esc(a.name)}</b> (Lv ${a.level || '?'}), ${a.points} pts${a.selectedAbilities?.length ? ', ' + esc(a.selectedAbilities.join(', ')) : ''}</div>`).join('');
    const stationHtml = f.spaceStation ? `<div class="pr-line"><b>${esc(f.spaceStation.name)}</b>, ${f.spaceStation.cost} pts${(f.spaceStation.systems && f.spaceStation.systems.length) ? ' (' + f.spaceStation.systems.map(esc).join(', ') + ')' : ''}</div>` : '';

    // Secondary objectives (the two chosen for the game), spelled out.
    const secObjsHtml = (f.secondaryObjectives || []).map(n => {
      const o = (SECONDARY_OBJECTIVES || []).find(x => x.name === n) || { name: n, description: '' };
      return `<div class="pr-gloss"><b>${esc(o.name)}</b>${o.description ? ': ' + ruleHtml(o.description) : ''}</div>`;
    }).join('');

    const glossary = [...usedRules.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([n, d]) => `<div class="pr-gloss"><b>${esc(n)}</b>: ${ruleHtml(d)}</div>`).join('');

    document.getElementById('print-root').innerHTML = `
      <div class="pr-header">
        <div class="pr-title">${esc(f.name || 'Unnamed Fleet')}</div>
        <div class="pr-sub">${info?.name || f.faction} · ${size.label} · ${pts} / ${limit} pts, ${(f.battleGroups || []).length} groups</div>
      </div>
      <div class="pr-units${localStorage.getItem('dfc_print2col') === '1' ? ' pr-2col' : ''}">${groupsHtml}</div>
      ${admiralsHtml ? `<div class="pr-section-title">Admiral</div>${admiralsHtml}` : ''}
      ${stationHtml ? `<div class="pr-section-title">Space Station</div>${stationHtml}` : ''}
      ${secObjsHtml ? `<div class="pr-section-title">Secondary Objectives</div><div class="pr-glossary">${secObjsHtml}</div>` : ''}
      ${glossary ? `<div class="pr-section-title">Rules Glossary</div><div class="pr-glossary">${glossary}</div>` : ''}
      <div class="pr-foot">type37.github.io/dropfleet-builder</div>
    `;
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 300);
  }

  function shareFleet() {
    // Default share = the simple army list (New Recruit style text). The import link
    // rides along in the share payload / shown below for anyone who wants the exact
    // fleet with loadouts.
    const text = fleetToText(activeFleet);
    const code = encodeFleet(activeFleet);
    const url = location.origin + location.pathname.replace(/mobile\/?$/, '') + '#share/' + code;
    const sheet = (msg) => showSheet('Share Fleet',
      `${msg ? `<p>${msg}</p>` : ''}<pre class="copy-pre">${esc(text)}</pre><p style="word-break:break-all;font-family:var(--font-condensed);font-size:var(--text-caption1);color:var(--fg3);margin-top:var(--sp-s)">Import link: ${esc(url)}</p>`);
    if (navigator.share) {
      navigator.share({ title: activeFleet.name, text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => sheet('Army list copied to clipboard.')).catch(() => sheet(''));
    } else {
      sheet('');
    }
  }

  /* ── Create / Edit Fleet modal ─────────────────────────── */
  let editingFleet = null;
  function populateFleetForm(fleet) {
    const fp = document.getElementById('new-fleet-faction');
    const ordered = Object.keys(FACTION_FILES).sort((a, b) => (FACTION_INFO[a]?.order || 99) - (FACTION_INFO[b]?.order || 99));
    fp.innerHTML = ordered.map(k => `<option value="${k}">${FACTION_INFO[k]?.name || k}</option>`).join('');
    document.getElementById('new-fleet-name').value = fleet ? (fleet.name || '') : '';
    document.getElementById('new-fleet-desc').value = fleet ? (fleet.description || '') : '';
    fp.value = fleet ? fleet.faction : (ordered.includes('ucm') ? 'ucm' : ordered[0]);
    selectFleetSize(fleet ? fleet.gameSize : 'skirmish');
    // Points limit: show the custom value if one is set, else blank (= bracket max).
    const pl = document.getElementById('new-fleet-points');
    if (pl) {
      const sz = GAME_SIZES[fleet ? fleet.gameSize : 'skirmish'] || GAME_SIZES.clash;
      pl.value = (fleet && fleet.pointsLimit && fleet.pointsLimit !== sz.max) ? fleet.pointsLimit : '';
    }
    updateFactionDesc();
  }

  // Visible game-size picker (cards, not a dropdown) so all sizes show at once.
  function selectFleetSize(key) {
    const sp = document.getElementById('new-fleet-size');
    if (sp) sp.value = key;
    const c = document.getElementById('new-fleet-size-cards');
    if (!c) return;
    c.innerHTML = Object.entries(GAME_SIZES).map(([k, s]) => {
      const lines = gameSizeLines(s);
      return `<button type="button" class="size-card${k === key ? ' selected' : ''}" onclick="App.selectFleetSize('${k}')">
        ${gameSizeBlocks(k)}
        <span class="size-card-info">
          <span class="size-card-name">${s.label}</span>
          <span class="size-card-sub">${lines[0]}</span>
          <span class="size-card-sub">${lines[1]}</span>
          <span class="size-card-sub">${lines[2]} · ${s.time}</span>
        </span>
      </button>`;
    }).join('');
  }
  function openCreateFleet() {
    editingFleet = null;
    document.getElementById('modal-fleet-title').textContent = 'New Fleet';
    document.getElementById('modal-fleet-submit').textContent = 'Create Fleet';
    document.getElementById('new-fleet-faction').disabled = false;
    populateFleetForm(null);
    document.getElementById('modal-create-fleet').classList.add('active');
  }
  function openEditFleet() {
    if (!activeFleet) return;
    editingFleet = activeFleet;
    document.getElementById('modal-fleet-title').textContent = 'Edit Fleet';
    document.getElementById('modal-fleet-submit').textContent = 'Save Changes';
    // Faction is locked once ships exist (ships are faction-specific)
    document.getElementById('new-fleet-faction').disabled = (activeFleet.battleGroups || []).length > 0;
    populateFleetForm(activeFleet);
    document.getElementById('modal-create-fleet').classList.add('active');
  }
  function updateFactionDesc() {
    const k = document.getElementById('new-fleet-faction').value;
    const el = document.getElementById('new-fleet-faction-desc');
    if (el) el.textContent = FACTION_INFO[k]?.desc || '';
  }
  function closeCreateFleet() { document.getElementById('modal-create-fleet').classList.remove('active'); }
  async function doCreateFleet() {
    // Fleet names start blank by design (naming UX to be revisited); no auto-default.
    const name = document.getElementById('new-fleet-name').value.trim();
    const desc = document.getElementById('new-fleet-desc').value.trim();
    const faction = document.getElementById('new-fleet-faction').value;
    const gameSize = document.getElementById('new-fleet-size').value;
    const size = GAME_SIZES[gameSize] || GAME_SIZES.clash;
    // Custom points limit: blank/invalid → bracket max (shared field with desktop).
    const plRaw = parseInt(document.getElementById('new-fleet-points').value, 10);
    const pointsLimit = (isNaN(plRaw) || plRaw <= 0) ? size.max : plRaw;
    await ensureFaction(faction);   // make sure the chosen faction's data is loaded
    if (editingFleet) {
      editingFleet.name = name;
      editingFleet.description = desc;
      if (!document.getElementById('new-fleet-faction').disabled) editingFleet.faction = faction;
      editingFleet.gameSize = gameSize;
      editingFleet.pointsLimit = pointsLimit;
      editingFleet.maxGroups = size.groups;
      editingFleet.updatedAt = Date.now();
      saveFleets();
      closeCreateFleet();
      renderFleetDetail();
      updateAppBar('screen-fleet-detail');
      editingFleet = null;
      return;
    }
    const fleet = {
      id: uuid(), name, description: desc, faction, gameSize,
      pointsLimit, maxGroups: size.groups,
      admirals: [], battleGroups: [], spaceStation: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    fleets.push(fleet);
    saveFleets();
    closeCreateFleet();
    openFleet(fleets.length - 1);
  }

  /* ── Init ──────────────────────────────────────────────── */
  async function init() {
    // Cold load fetches ONLY the rules glossary (~20K). Faction files (~150K each)
    // load on demand — we never need all six at once. fleet-data.json (1MB) and
    // ship-lore.json (216K) were unused dead weight and are no longer fetched.
    await fetch('../data/fleet-index.json').then(r => r.json()).then(idx => {
      Object.entries(idx.sharedRules || {}).forEach(([k, v]) => {
        RULES_DB[k] = (typeof v === 'string') ? { description: v, page: '' } : { description: v.description || '', page: v.page || '' };
      });
      SECONDARY_OBJECTIVES = idx.secondaryObjectives || [];
      STATION_ARMAMENTS = idx.stationArmaments || null;
    }).catch(() => {});

    await fetch('../data/pronunciations.json').then(r => r.json()).then(raw => {
      PRON = {};
      Object.keys(raw).forEach(k => { if (!k.startsWith('_')) PRON[k] = raw[k]; });
      PRON_KEYS = Object.keys(PRON).sort((a, b) => b.length - a.length);
    }).catch(() => {});

    loadFleets();

    // Bottom-sheet swipe gestures — wire early so they work even on the
    // share-link path below (which returns before the rest of init runs).
    setupSheetGestures();

    // If arriving via a #share/ link, import it and open it directly.
    if (await importFromHash()) return;

    // Preload only the factions referenced by saved fleets (the list needs their
    // data to compute points/validation). Usually 0–2 files, not 6.
    const used = [...new Set(fleets.map(f => f.faction).filter(Boolean))];
    await Promise.all(used.map(ensureFaction));

    renderFleetList();
    navigate('screen-fleet-list', { replace: true });

    const search = document.getElementById('picker-search');
    if (search) search.addEventListener('input', () => renderShipPicker());
    const fp = document.getElementById('new-fleet-faction');
    if (fp) fp.addEventListener('change', updateFactionDesc);

    // Register the root service worker (it controls the whole origin, including
    // /data/ and /assets/ which sit above /mobile/) so the app works offline.
    if ('serviceWorker' in navigator) {
      // Self-update a live tab: reload when a new build takes over + poll while open.
      if (navigator.serviceWorker.controller) {
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return; reloading = true; window.location.reload();
        });
      }
      navigator.serviceWorker.register('../sw.js').then(reg => {
        setInterval(() => reg.update().catch(() => {}), 60000);
      }).catch(() => {});
    }
  }

  /* ── Public API ────────────────────────────────────────── */
  window.App = {
    init, goBack, viewDesktop,
    openFleet, openCreateFleet, openEditFleet, closeCreateFleet, doCreateFleet, selectFleetSize, openStarterFleets,
    openAddGroup, filterShips, toggleAttr, toggleExtra, clearFilters, setSort, addShip,
    openGroup, toggleWarnings, cycleShipArt, changeQty, changeGroupQty, swipeDeleteGroup, onGripPointerDown, selectLoadout, selectFeature, addSystem, removeSystem, removeGroup, copyGroup, groupOverflow, editGroupName, toggleSecondary, openSecondaryModal, closeSecondaryModal,
    openAdmiral, addAdmiral, addGenericAdmiral, removeAdmiralPrompt,
    openAdmiralDetail, toggleAdmiralAbility, assignAdmiral, removeActiveAdmiral, closeAbilityModal,
    openStation, addStation, openStationDetail, removeStationPrompt, addStationSystem, removeStationSystem,
    overflow, fleetOverflow, openSettingsSheet, deleteFleetPrompt, duplicateFleet, shareFleet, copyFleetText, copyFleetJSON, exportPdf,
    importFleetPrompt, doImportText,
    openMobilePlay, renderMobilePlay, mShowPlayPassInfo, mPlayChangeRound, mPlayEndRound, mPlayTogglePass, mPlayChangeVP, mPlayChangeOppVP, mPlayChangeOppGroups, mPlaySpikeChange, mPlaySetOrder, mPlaySetOrderAndShow, mPlayToggleActivation, mPlayHullChange, mPlayCripChange, mPlayCripToggle, mPlayCorruptorChange,
    openRule, openRangeTip, openLaunchRule, openStat, closeRuleSheet, closeActionSheet, sayName
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
