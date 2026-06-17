/* ═══════════════════════════════════════════════════════════════
   DROPFLEET COMMANDER, FLEET BUILDER
   Application Logic
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  // ── State ──
  let shipDB = {};
  let factionData = {};
  let sharedRulesDB = {};  // Global rules lookup from BSData (ship + weapon rules)
  let fleets = [];
  let currentFleet = null;

  // Feedback goes straight to the maker's inbox via the user's mail app. Body is
  // prefilled with guided questions so responses are useful, not just "looks cool".
  const FEEDBACK_HREF = 'mailto:warlore1@outlook.com?subject=' +
    encodeURIComponent('Dropfleet Builder feedback') + '&body=' +
    encodeURIComponent(
      'Thanks for helping improve the Dropfleet Commander Fleet Builder.\n\n' +
      '1. What were you trying to do, and could you finish it?\n\n' +
      '2. Did anything look wrong (a points cost, a stat, a rule)?\n\n' +
      '3. What would make you use it for your next game?\n\n' +
      '4. How long have you played DFC?\n'
    );
  let activeGroupId = null;
  let activeFlagship = null;  // admiral index when a famous flagship is selected (shown in the detail panel like a group)
  let shipSort = { key: 'points', dir: 'asc' };  // picker sort (parity w/ mobile: default cheapest-first)
  let activeCategory = 'all';
  let activeFilters = new Set();  // 'launch', 'drop', 'rare', 'unique'
  let shipSearchQuery = '';
  let pendingGroupCreation = false;  // true when "Add Group" opened the ship modal
  let settings = { showAdditionalShips: false, compactView: false, autoExpandLore: false, altStatBlock: false, print2col: false, printSimple: false };
  let fleetSortMode = 'updated'; // 'updated', 'name', 'faction', 'points'

  // Filled check used for selected/active toggle states (replaces the old "✓"
  // text glyph, which rendered as an emoji on some platforms). Inherits colour
  // from the host control via currentColor.
  const CHECK_SVG = '<svg class="check-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';

  // Game sizes per rulebook Section 4.2. maxAdmiralLevel is the highest admiral
  // level permitted at this game size (not a cap on the number of admirals —
  // you may take any number of admirals per Section 4.2.1).
  // Level 5 Famous Admirals count as Level 4 for game-size restrictions.
  const GAME_SIZES = {
    skirmish:   { label: 'Skirmish',   min: 501,  max: 1000,  groups: 16, maxAdmiralLevel: 2, colossalMax: 0, time: '1-1.5 hrs', desc: '501-1000 pts' },
    clash:      { label: 'Clash',      min: 1001, max: 2000,  groups: 20, maxAdmiralLevel: 3, colossalMax: 1, time: '2-3 hrs',   desc: '1001-2000 pts' },
    battle:     { label: 'Battle',     min: 2001, max: 3000,  groups: 24, maxAdmiralLevel: 4, colossalMax: 2, time: '3-4 hrs',   desc: '2001-3000 pts' },
    reconquest: { label: 'Reconquest', min: 3001, max: 99999, groups: 28, maxAdmiralLevel: 5, colossalMax: 3, time: '4+ hrs',    desc: '3001+ pts' }
  };

  // Three-line size summary (rulebook 4.2): points range / group caps / admiral range.
  function gameSizeLines(s) {
    const pts = s.max >= 99999 ? `${s.min}+ points` : `${s.min}-${s.max} points`;
    const groups = `≤ ${s.groups} Groups${s.colossalMax > 0 ? `, ≤ ${s.colossalMax} Colossal Group${s.colossalMax === 1 ? '' : 's'}` : ''}`;
    return [pts, groups, `Admiral Level 1-${s.maxAdmiralLevel}`];
  }

  // Escalating game-size indicator: 4 blocks that fill clockwise (TL, TR, BR, BL)
  // as the game grows, like a clock filling up. Skirmish 1 -> Reconquest 4.
  const GAME_SIZE_LEVEL = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 };
  function gameSizeBlocks(key) {
    const lvl = GAME_SIZE_LEVEL[key] || 1;
    const clockwise = [0, 1, 3, 2]; // grid cell order: top-left, top-right, bottom-right, bottom-left
    let html = '';
    for (let p = 0; p < 4; p++) html += `<span class="gs-block${clockwise.indexOf(p) < lvl ? ' filled' : ''}"></span>`;
    return html;
  }

  const FACTION_COLORS = {
    ucm: '#3e9945', phr: '#B8952F', scourge: '#c43c2f',
    shaltari: '#d98c1f', bioficer: '#2a8c8c', resistance: '#2a6099'
  };

  const FACTION_LABELS = {
    ucm: 'UCM', phr: 'PHR', scourge: 'Scourge',
    shaltari: 'Shaltari', bioficer: 'Bioficers', resistance: 'Resistance'
  };


  const CATEGORY_LABELS = {
    colossal: 'Colossal',
    heavy: 'Heavy',
    medium: 'Medium',
    light: 'Light',
    payload: 'Payload',
    famous_admirals: 'Famous Admiral'
  };

  const CATEGORY_ORDER = ['light','medium','heavy','colossal','payload'];

  // Spell out the single-letter tonnage code for display (L = Light, not Large).
  // Stored values stay single-letter (rules/sorting depend on them) — display only.
  const TON_WORDS = { L: 'Light', M: 'Medium', H: 'Heavy', C: 'Colossal', P: 'Payload' };
  function tonLabel(t) { return TON_WORDS[t] || t || ''; }

  let rawFleetData = null;

  const fastplaySpecs = [
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
    { faction: 'resistance', name: 'Resistance Fast Play', size: 'skirmish', groups: [
      ['medium','Heavy Cruiser',1],['medium','Cruiser',1],['medium','Light Cruiser',1],
      ['light','Strike Carrier',2],['light','Heavy Frigate',2]] }
  ];

  // ── Init ──
  let factionLoadPromises = {};

  async function init() {
    try {
      const res = await fetch('data/fleet-index.json');
      rawFleetData = await res.json();
      transformIndex(rawFleetData);
      populateLanding(rawFleetData);
    } catch (e) {
      console.error('Failed to load fleet index:', e);
    }

    loadSettings();
    loadFleets();
    setupRouting();
    initBottomSheetGestures();
    const fb = document.getElementById('footer-feedback');
    if (fb) fb.href = FEEDBACK_HREF;   // upgrade the plain mailto to the guided one
    window.dispatchEvent(new Event('hashchange'));
  }

  async function ensureFactionLoaded(factionKey) {
    if (shipDB[factionKey]) return;
    if (factionLoadPromises[factionKey]) return factionLoadPromises[factionKey];
    factionLoadPromises[factionKey] = (async () => {
      try {
        const res = await fetch(`data/faction-${factionKey}.json`);
        const faction = await res.json();
        transformFaction(factionKey, faction);
      } catch (e) {
        console.error(`Failed to load faction ${factionKey}:`, e);
      }
    })();
    return factionLoadPromises[factionKey];
  }

  const SHIP_ART = new Set([
    // PHR
    'achilles','agamemnon','agrippa','ajax','amphion','andromeda','antigonus',
    'antony','ariadne','augustus','bellerophon','brutus','cadmus','caesar',
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
    'milwaukee','newton','osaka','oslo','perth','reykjavik','rio','rome',
    'rotterdam','santiago','seattle','sheffield','siam','taipei','tayne',
    'thebes','tokyo','toulon','ulaanbaatar','vancouver','venice','vienna',
    'vilnius','warsaw','washington','weaver','yokohama',
    // Scourge
    'akuma','apsasu','bael','banshee','beelzebub','charybdis','chimera',
    'cthulhu','daemon','devil','djinn','dragon','ebisu','faust','gargoyle',
    'harpy','hiruko','hydra','ifrit','incubus','kulshedra','lamassu','lucifer',
    'munifex','nephilim','nickar','nosferatu','parasite','raiju','raum',
    'revenant','samael','scylla','shadow','shenlong','sphinx','strix',
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
    'DH-Type Penal Transport':'dh_type_penal_transport',
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
    'Triumvir':'triumvir','Tribune':'tribune','Disciple':'disciple'
  };
  const ADMIRAL_ART = {
    // PHR
    'claudia rhee': 'claudia_rhee',
    'gaius chau': 'gaius_chau',
    'javelin': 'director_javelin',
    'helena of asgard': 'helena_of_asgard',
    // UCM
    'halsey': 'halsey',
    'havelock': 'havelock',
    'weaver': 'weaver',
    'tayne': 'tayne',
    // Bioficer
    'ascendant': 'ascendant_zenith',
    'agency': 'agency_bastion',
    'atom': 'atom_scion',
    'atlas': 'atlas_catastrophe',
    'genitor': 'genitor',
    // Resistance
    'nguen': 'nguen_olympus'
  };

  function shipArtPath(shipName) {
    if (!shipName) return null;
    // Check special multi-word / irregular mappings first
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (shipName.startsWith(prefix)) return `assets/art/${file}.webp`;
    }
    const first = shipName.split(/\s+/)[0].toLowerCase();
    return SHIP_ART.has(first) ? `assets/art/${first}.webp` : null;
  }

  // Ships with an alternate resin sculpt at assets/art/<slug>_resin.webp — the same
  // ship, a different physical model, offered as alternate hero art (top toggle).
  const SHIP_ALT = new Set(['rhadamanthus','beelzebub','beijing','bronze','daemon','delhi','devil','diamond','dragon','gold','hanoi','heracles','kairos','lucifer','minos','new_york','platinum','sarpedon','silver','tokyo']);
  function shipAltArt(shipName) {
    if (!shipName) return [];
    let slug = null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (shipName.startsWith(prefix)) { slug = file; break; }
    }
    if (!slug) slug = shipName.split(/\s+/)[0].toLowerCase();
    return SHIP_ALT.has(slug) ? [`assets/art/${slug}_resin.webp`] : [];
  }

  // Deployable-feature art (a subset have transparent cutouts). Keyed by the
  // feature name slugified; files live at assets/art/feat-<slug>.webp.
  const FEATURE_ART = new Set(['aegis-platform', 'comms-platform', 'torpedo-platform']);
  function featureArtPath(name) {
    if (!name) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return FEATURE_ART.has(slug) ? `assets/art/feat-${slug}.webp` : null;
  }
  // Small-display variant of an art URL for picker cards, overview/list thumbs
  // and admiral thumbs (source art is ~1100-1500px, shown at ~96-140px). The
  // unit-detail hero and print keep full resolution. Thumbs: assets/art/thumb/.
  function thumbUrl(url) { return url ? url.replace('/art/', '/art/thumb/') : url; }
  // Faction-specific stations → their transparent renders in assets/art/stations/.
  // Names are unique across factions, so a flat name→file map is unambiguous. The
  // generic Small/Medium/Large Space Stations have no dedicated art (kept blank
  // rather than showing the wrong faction's model).
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
    if (!station || !station.name) return null;
    const f = STATION_NAME_ART[station.name];
    return f ? `assets/art/stations/${f}.webp` : null;
  }
  // Two universal station upgrades have their own art; shown as a small thumb on
  // the upgrade row in the armament picker.
  const STATION_UPGRADE_ART = { 'Astrobotanical Lab': 'astrobotanical-lab', 'Defence Grid': 'defence-grid' };
  function stationOptThumb(name) {
    const f = STATION_UPGRADE_ART[name];
    return f ? `<img class="sys-opt-art" src="${thumbUrl('assets/art/stations/' + f + '.webp')}" alt="" loading="lazy" onerror="this.remove()">` : '';
  }

  // ── TTCombat store links ───────────────────────────────────────────────
  // Ships are sold in boxed sets (battlefleets, sprues), so per-ship product
  // pages mostly don't exist and a name search returns cross-faction noise
  // (e.g. "Sheffield Heavy Frigate" -> every faction's frigate sprue). So:
  // honour an explicit storeUrl when set; else land on the ship's FACTION
  // collection page (always the right faction, never a dead end); else a name
  // search as a last resort.
  const TTC_FACTION_TAG = {
    ucm: 'ucm', phr: 'phr', scourge: 'scourge', shaltari: 'shaltari',
    resistance: 'resistance', bioficer: 'bioficers'
  };
  function shipStoreUrl(name, ship) {
    if (ship && ship.storeUrl) return ship.storeUrl;
    const tag = TTC_FACTION_TAG[currentFleet && currentFleet.faction];
    if (tag) return 'https://ttcombat.com/collections/dropfleet-commander/faction_' + tag;
    return 'https://ttcombat.com/search?q=' + encodeURIComponent((name || '').trim());
  }
  // Wrap a ship <img> string in a TTCombat store link (no icon overlay; the art
  // itself is the link). Used only on the unit-detail hero image so the store
  // link doesn't clutter the fleet menu or picker. stopPropagation so tapping the
  // art opens the store without triggering a clickable parent card.
  function shopLinkImg(name, imgTag, ship) {
    if (!imgTag) return '';
    const url = shipStoreUrl(name, ship);
    return `<a class="shop-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Find ${esc(name || 'this ship')} on the TTCombat store" onclick="event.stopPropagation()">${imgTag}</a>`;
  }

  function admiralArtPath(admiralName) {
    if (!admiralName) return null;
    const lower = admiralName.toLowerCase();
    for (const [pattern, file] of Object.entries(ADMIRAL_ART)) {
      if (lower.includes(pattern)) return `assets/art/${file}.webp`;
    }
    return null;
  }

  function transformIndex(raw) {
    if (raw.sharedRules) {
      Object.entries(raw.sharedRules).forEach(([k, v]) => {
        if (typeof v === 'string') {
          sharedRulesDB[k] = { description: v, page: '' };
        } else {
          sharedRulesDB[k] = { description: v.description || '', page: v.page || '' };
        }
      });
    }
    Object.entries(raw.factions).forEach(([factionKey, meta]) => {
      factionData[factionKey] = { name: meta.name, shortName: meta.shortName };
    });
  }

  function transformFaction(factionKey, faction) {
    factionData[factionKey] = { name: faction.name, shortName: faction.shortName };

    const groups = {};

    (faction.groups || []).forEach(g => {
      const cat = g.category || 'medium';
      if (!groups[cat]) groups[cat] = { ships: {} };
      const s = g.ship;
      groups[cat].ships[g.id] = {
        name: s.name,
        points: s.cost,
        tonnage: (s.stats?.tonnage && s.stats.tonnage !== '?') ? s.stats.tonnage : (CATEGORY_LABELS[cat] || cat),
        scan: s.stats?.scan, sig: s.stats?.sig,
        thrust: s.stats?.thrust, hull: s.stats?.hull,
        es: s.stats?.es, ks: s.stats?.ks,
        bs: s.stats?.bs, g: s.stats?.g,
        special: s.stats?.special,
        weapons: s.weapons || [],
        loads: s.loads || [],
        special_rules: (s.specialRules || []).map(r => r.name),
        specialRuleDetails: s.specialRules || [],
        groupMin: s.groupMin, groupMax: s.groupMax,
        isRare: s.isRare, isUnique: s.isUnique,
        additional: !!s.additional,
        loadoutOptions: s.loadoutOptions || [],
        lore: s.lore || '',
        rulesText: s.rulesText || '',
        famousShipsPrefix: s.famousShipsPrefix || '',
        famousShips: s.famousShips || [],
        namesake: s.namesake || '',
        image: shipArtPath(s.name),
        variants: s.variants || [],
        systemSelection: s.systemSelection || null
      };
    });

    const famous = (faction.admirals || []).filter(a => a.isFamous);
    if (famous.length > 0) {
      groups.famous_admirals = { ships: {} };
      famous.forEach(a => {
        const fs = a.flagship;
        groups.famous_admirals.ships[a.id] = {
          name: a.name,
          points: fs ? (a.cost + fs.cost) : a.cost,
          admiral_cost: a.cost,
          ship_cost: fs ? fs.cost : 0,
          level: a.level,
          type: 'Famous',
          special_abilities: a.abilities || [],
          ability_picks: a.abilityPicks || 1,
          ship_name: fs?.name || null,
          className: fs?.className || null,
          shipCategory: fs?.category || null,
          scan: fs?.stats?.scan, sig: fs?.stats?.sig,
          thrust: fs?.stats?.thrust, hull: fs?.stats?.hull,
          es: fs?.stats?.es, ks: fs?.stats?.ks,
          bs: fs?.stats?.bs, g: fs?.stats?.g,
          special: fs?.stats?.special,
          tonnage: fs?.tonnage || fs?.stats?.tonnage,
          weapons: fs?.weapons || [],
          loads: fs?.loads || [],
          special_rules: (fs?.specialRules || []).map(r => r.name),
          specialRuleDetails: fs?.specialRules || [],
          image: admiralArtPath(a.name) || shipArtPath(fs?.name)
        };
      });
    }

    const launchAssets = [];
    (faction.launchAssets || []).forEach(la => {
      (la.assets || []).forEach(a => launchAssets.push(a));
    });

    const spaceStations = (faction.spaceStations || []).map(ss => ({
      id: ss.id,
      name: ss.name,
      cost: ss.cost || 0,
      stats: ss.stats || {},
      specialRules: ss.specialRules || [],
      special: ss.stats?.special || '-',
      weapons: ss.weapons || [],
      loads: ss.loads || [],
      stationRules: ss.stationRules || []
    }));
    const deployableFeatures = (faction.deployableFeatures || []).map(df => ({
      id: df.id,
      name: df.name,
      cost: df.cost || 0,
      features: df.features || [],
      rules: df.rules || []
    }));

    shipDB[factionKey] = { groups, admirals: faction.admirals || [], abilitiesTable: faction.abilitiesTable || [], launchAssets, spaceStations, deployableFeatures, systemsLists: faction.systemsLists || {} };
  }

  // ── Landing Page Dynamic Content ──
  function populateLanding(raw) {
    // Faction showcase — with hero ship art per faction
    const factionsEl = document.getElementById('landing-factions');
    if (factionsEl && raw) {
      // Pick 3 signature ships per faction for the preview strip
      const heroShips = {
        ucm: ['beijing', 'tokyo', 'seattle'],
        phr: ['agamemnon', 'orion', 'ajax'],
        scourge: ['akuma', 'wyvern', 'djinn'],
        shaltari: ['hematite', 'turquoise', 'cobalt'],
        bioficer: [],
        resistance: ['vanguard', 'gladiator', 'armstrong']
      };
      const factionKeys = ['ucm','phr','scourge','shaltari','bioficer','resistance']
        .filter(k => raw.factions[k]);
      const chips = factionKeys.map(fk => {
        const f = raw.factions[fk];
        const color = FACTION_COLORS[fk] || 'var(--navy)';
        const label = FACTION_LABELS[fk] || fk.toUpperCase();
        const count = f.shipCount || (f.groups || []).length;
        const fIcon = FACTION_ICONS[fk];
        const heroes = (heroShips[fk] || []).map(h => shipArtPath(h)).filter(Boolean);
        const heroStrip = heroes.length > 0
          ? `<div class="faction-chip-heroes">${heroes.map(h => `<img src="${h}" alt="" loading="lazy">`).join('')}</div>`
          : '';
        return `<div class="faction-chip" style="--current-faction:${color}" onclick="App.startFactionFleet('${fk}')">
          ${heroStrip}
          <div class="faction-chip-info">
            ${fIcon ? `<img src="${fIcon}" alt="" class="faction-chip-icon">` : '<div class="faction-chip-dot"></div>'}
            <span class="faction-chip-name">${label}</span>
            <span class="faction-chip-count">${count} ships</span>
          </div>
        </div>`;
      }).join('');
      factionsEl.innerHTML = `
        <div class="landing-factions-title">Choose Your Faction</div>
        <div class="faction-showcase">${chips}</div>`;
    }

    // Objectives reference
    // Secondary objectives reference removed from the landing (it lives in the
    // builder's Secondary Objectives picker where it's actually used).
    const objEl = document.getElementById('landing-objectives');
    if (objEl) { objEl.innerHTML = ''; objEl.style.display = 'none'; }
  }

  // Quick start: create a new fleet for the chosen faction
  function startFactionFleet(factionKey) {
    navigate('fleets');
    // Wait for view render, then open modal with pre-selected faction
    setTimeout(() => {
      openNewFleetModal();
      setTimeout(() => selectFaction(factionKey), 100);
    }, 150);
  }

  // ── Routing ──
  function setupRouting() {
    window.addEventListener('hashchange', () => {
      const hash = location.hash.slice(1) || 'landing';
      const [view, param] = hash.split('/');
      showView(view, param);
    });
  }

  function navigate(view, param) {
    location.hash = param ? `${view}/${param}` : view;
  }

  function showView(view, param) {
    // Privacy-friendly analytics: count each view as a virtual pageview (the SPA
    // never reloads, so onload alone would only ever register one visit).
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: '/' + (view || 'landing'), title: view || 'landing', event: false });
    }
    document.querySelectorAll('#app > section').forEach(s => s.classList.add('hidden'));
    const topActions = document.getElementById('topbar-actions');
    const topContext = document.getElementById('topbar-context');
    topActions.innerHTML = '';

    switch (view) {
      case 'landing':
        show('view-landing');
        topContext.textContent = 'Fleet Builder';
        break;
      case 'fleets':
        show('view-fleets');
        topContext.textContent = 'Your Fleets';
        renderFleetList();
        break;
      case 'builder':
        if (param) {
          currentFleet = fleets.find(f => f.id === param);
          if (currentFleet) {
            show('view-builder');
            topContext.innerHTML = `<a href="#fleets" class="topbar-back" onclick="App.navigate('fleets'); return false;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L4 8l6 6"/></svg></a> ${esc(currentFleet.name)}`;
            topActions.innerHTML = `
              <button class="btn btn-ghost btn-sm topbar-action-btn" onclick="App.shareFleet()" data-tooltip="Share">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="8" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><path d="M6 7l4-2M6 9l4 2"/></svg>
                <span class="topbar-action-label">Share</span>
              </button>
              <button class="btn btn-ghost btn-sm topbar-action-btn" onclick="App.printFleet()" data-tooltip="Print preview">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6V2h8v4M4 12H2V7h12v5h-2"/><rect x="4" y="10" width="8" height="4"/></svg>
                <span class="topbar-action-label">Print preview</span>
              </button>
              <button class="btn btn-ghost btn-sm topbar-action-btn" onclick="App.openSettings()" data-tooltip="Settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path opacity=".55" d="M13.765 2.152C13.398 2 12.932 2 12 2s-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083c-.092.223-.129.484-.143.863a1.62 1.62 0 0 1-.79 1.353a1.62 1.62 0 0 1-1.567.008c-.336-.178-.579-.276-.82-.308a2 2 0 0 0-1.478.396C4.04 5.79 3.806 6.193 3.34 7s-.7 1.21-.751 1.605a2 2 0 0 0 .396 1.479c.148.192.355.353.676.555c.473.297.777.803.777 1.361s-.304 1.064-.777 1.36c-.321.203-.529.364-.676.556a2 2 0 0 0-.396 1.479c.052.394.285.798.75 1.605c.467.807.7 1.21 1.015 1.453a2 2 0 0 0 1.479.396c.24-.032.483-.13.819-.308a1.62 1.62 0 0 1 1.567.008c.483.28.77.795.79 1.353c.014.38.05.64.143.863a2 2 0 0 0 1.083 1.083C10.602 22 11.068 22 12 22s1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083c.092-.223.129-.483.143-.863c.02-.558.307-1.074.79-1.353a1.62 1.62 0 0 1 1.567-.008c.336.178.579.276.819.308a2 2 0 0 0 1.479-.396c.315-.242.548-.646 1.014-1.453s.7-1.21.751-1.605a2 2 0 0 0-.396-1.479c-.148-.192-.355-.353-.676-.555A1.62 1.62 0 0 1 19.562 12c0-.558.304-1.064.777-1.36c.321-.203.529-.364.676-.556a2 2 0 0 0 .396-1.479c-.052-.394-.285-.798-.75-1.605c-.467-.807-.7-1.21-1.015-1.453a2 2 0 0 0-1.479-.396c-.24.032-.483.13-.82.308a1.62 1.62 0 0 1-1.566-.008a1.62 1.62 0 0 1-.79-1.353c-.014-.38-.05-.64-.143-.863a2 2 0 0 0-1.083-1.083Z"/></svg>
              </button>`;
            ensureFactionLoaded(currentFleet.faction).then(() => renderBuilder());
            return;
          }
        }
        navigate('fleets');
        break;
      case 'share':
        if (param) {
          const shared = decodeFleet(param);
          if (shared) {
            // Load the fleet's faction first, else a cold-opened share link renders
            // raw ship keys instead of names/stats/art (shipDB isn't populated yet).
            ensureFactionLoaded(shared.faction).then(() => showSharedFleet(shared));
            return;
          } else {
            showToast('Invalid share link');
          }
        }
        navigate('fleets');
        break;
      default:
        show('view-landing');
    }
  }

  function show(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  // ── Persistence ──
  function loadFleets() {
    try { fleets = JSON.parse(localStorage.getItem('dfc_fleets') || '[]'); }
    catch { fleets = []; }

    // Migrate legacy single-admiral → admirals array
    let migrated = false;
    fleets.forEach(f => {
      if (!Array.isArray(f.admirals)) {
        f.admirals = f.admiral ? [f.admiral] : [];
        delete f.admiral;
        migrated = true;
      }
    });

    // Merge legacy duplicate payload groups (Bioficer Cells) into one group each.
    // Older fleets spawned a separate 1-ship group per copy, which spammed the
    // printout with identical cells; consolidate same-ship payloads into one.
    fleets.forEach(f => {
      if (!Array.isArray(f.battleGroups)) return;
      const firstByKey = {};
      const kept = [];
      f.battleGroups.forEach(g => {
        const s = g.ships && g.ships[0];
        if (s && s.groupCategory === 'payload') {
          if (firstByKey[s.shipKey]) {
            firstByKey[s.shipKey].ships.push(...g.ships);
            migrated = true;
            return; // drop this duplicate group
          }
          firstByKey[s.shipKey] = g;
        }
        kept.push(g);
      });
      f.battleGroups = kept;
    });

    if (migrated) saveFleets();
  }

  function saveFleets() {
    localStorage.setItem('dfc_fleets', JSON.stringify(fleets));
  }

  function uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }

  // ── Fleet Sharing (URL encode/decode) ──
  // Unicode-safe base64: btoa/atob only handle Latin1, so fleet/ship names with
  // curly apostrophes, em-dashes or accented characters would throw on share.
  // Round-trip through UTF-8 bytes instead. ASCII-only input produces the same
  // base64 as plain btoa, so previously-shared links still decode.
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
    // Build a minimal representation — only data needed to reconstruct
    const mini = {
      n: fleet.name,
      f: fleet.faction,
      s: fleet.gameSize,
      pl: isCustomMax(fleet) ? fleet.pointsLimit : undefined,
      g: fleet.battleGroups.map(g => ({
        n: g.name,
        sh: g.ships.map(s => {
          const entry = { c: s.groupCategory, k: s.shipKey, p: s.points };
          if (s.loadouts && Object.keys(s.loadouts).length > 0) entry.l = s.loadouts;
          if (s.feature) entry.ft = s.feature;
          if (s.systems && s.systems.length > 0) entry.sy = s.systems;
          return entry;
        })
      }))
    };
    if (fleet.description) mini.d = fleet.description;
    if (fleet.admirals && fleet.admirals.length > 0) {
      mini.as = fleet.admirals.map(adm => {
        const a = { n: adm.name, p: adm.points };
        if (adm.admiralId) a.i = adm.admiralId;
        if (adm.shipKey) a.k = adm.shipKey;
        if (adm.level) a.l = adm.level;
        if (adm.type) a.t = adm.type;
        if (adm.selectedAbilities && adm.selectedAbilities.length) a.sa = adm.selectedAbilities;
        if (adm.assignedGroupId) a.ag = adm.assignedGroupId;
        return a;
      });
    }
    if (fleet.spaceStation) {
      mini.ss = { n: fleet.spaceStation.name, c: fleet.spaceStation.cost };
      const sk = fleet.spaceStation.id || fleet.spaceStation.stationKey;
      if (sk) mini.ss.k = sk;
      if (fleet.spaceStation.systems && fleet.spaceStation.systems.length) mini.ss.sy = fleet.spaceStation.systems;
    }
    if (fleet.secondaryObjectives && fleet.secondaryObjectives.length) mini.so = fleet.secondaryObjectives;
    const json = JSON.stringify(mini);
    // base64url encode (no padding, URL-safe chars)
    return b64FromStr(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeFleet(encoded) {
    try {
      // Restore base64 padding and standard chars
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = strFromB64(b64);
      const mini = JSON.parse(json);

      const fleet = {
        id: uuid(),
        name: mini.n || 'Shared Fleet',
        description: mini.d || '',
        faction: mini.f,
        gameSize: mini.s || 'clash',
        pointsLimit: mini.pl != null ? mini.pl : (GAME_SIZES[mini.s] || GAME_SIZES.clash).max,
        maxGroups: (GAME_SIZES[mini.s] || GAME_SIZES.clash).groups,
        admirals: [],
        battleGroups: (mini.g || []).map(g => ({
          id: uuid(),
          name: g.n || 'Group',
          ships: (g.sh || []).map(s => ({
            id: uuid(),
            groupCategory: s.c,
            shipKey: s.k,
            points: s.p,
            loadouts: s.l || {},
            feature: s.ft || undefined,
            systems: s.sy || []
          }))
        })),
        spaceStation: null,
        secondaryObjectives: mini.so || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Decode space station
      if (mini.ss) {
        fleet.spaceStation = {
          id: mini.ss.k || null,
          name: mini.ss.n,
          cost: mini.ss.c || 0,
          stationKey: mini.ss.k || null,
          systems: mini.ss.sy || []
        };
      }

      // Decode admirals array (new format) or legacy single admiral
      if (mini.as && mini.as.length > 0) {
        fleet.admirals = mini.as.map(a => ({
          name: a.n,
          points: a.p || 0,
          // Famous-admiral id: desktop stores `k`, mobile stores `i` — cross-fall-back.
          admiralId: a.i || a.k || null,
          shipKey: a.k || a.i || null,
          level: a.l || 1,
          type: a.t || 'Generic',
          selectedAbilities: a.sa || [],
          assignedGroupId: a.ag || null
        }));
      } else if (mini.a) {
        fleet.admirals = [{
          name: mini.a.n,
          points: mini.a.p || 0,
          admiralId: mini.a.i || null,
          shipKey: mini.a.k || null,
          level: mini.a.l || 1
        }];
      }

      return fleet;
    } catch (e) {
      console.error('Failed to decode fleet:', e);
      return null;
    }
  }

  function getShareURL(fleet) {
    const encoded = encodeFleet(fleet);
    return `${location.origin}${location.pathname}#share/${encoded}`;
  }

  // ── Fleet CRUD ──
  function openNewFleetModal() {
    document.getElementById('new-fleet-name').value = '';
    document.getElementById('new-fleet-desc').value = '';
    const ptsInput = document.getElementById('new-fleet-points');
    if (ptsInput) { ptsInput.value = ''; ptsInput.placeholder = `${(GAME_SIZES.clash || {}).max || ''} (bracket max)`; }
    renderFactionPicker();
    renderSizePicker();
    openModal('modal-new-fleet');
    const nameInput = document.getElementById('new-fleet-name');
    setTimeout(() => nameInput.focus(), 200);
    // Enter key creates fleet (from name input only, not desc textarea)
    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); createFleet(); }
    };
  }

  const FACTION_ICONS = {
    ucm: 'assets/factions/ucm.webp',
    phr: 'assets/factions/phr.webp',
    scourge: 'assets/factions/scourge.webp',
    shaltari: 'assets/factions/shaltari.webp',
    resistance: 'assets/factions/resistance.webp',
    bioficer: 'assets/factions/bioficer.webp'
  };

  function renderFactionPicker() {
    const container = document.getElementById('faction-picker');
    // 2x3 grid, column order UCM/PHR/RES then SCOURGE/SHALTARI/BIOFICER, so it
    // reads: UCM·SCOURGE / PHR·SHALTARI / RES·BIOFICERS (row-major fill).
    const factions = ['ucm','scourge','phr','shaltari','resistance','bioficer'];
    container.innerHTML = factions.map(key => {
      const name = FACTION_LABELS[key] || (factionData[key] || {}).name || key.toUpperCase();
      const icon = FACTION_ICONS[key]
        ? `<img src="${FACTION_ICONS[key]}" alt="" style="width:20px;height:20px;object-fit:contain;flex-shrink:0">`
        : `<span style="width:20px;height:20px;border-radius:2px;background:${FACTION_COLORS[key]};flex-shrink:0;display:block"></span>`;
      return `<button type="button" class="btn btn-outline faction-pick-btn" data-faction="${key}"
        onclick="App.selectFaction('${key}')"
        style="position:relative;overflow:hidden">
        ${icon}
        <span>${name}</span>
      </button>`;
    }).join('');
    // Descriptor line beneath the picker (new-recruit onboarding)
    let desc = document.getElementById('faction-pick-desc');
    if (!desc) {
      desc = document.createElement('div');
      desc.id = 'faction-pick-desc';
      desc.className = 'faction-pick-desc';
      container.insertAdjacentElement('afterend', desc);
    }
    desc.textContent = '';
  }

  function selectFaction(key) {
    document.querySelectorAll('.faction-pick-btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
      btn.style.background = '';
      btn.style.color = '';
      delete btn.dataset.selected;
    });
    const btn = document.querySelector(`.faction-pick-btn[data-faction="${key}"]`);
    if (btn) {
      // Clear, high-contrast selection — neutral navy, not the faction colour
      // (which reads poorly for light factions). The icon carries faction identity.
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      btn.dataset.selected = 'true';
    }
    const desc = document.getElementById('faction-pick-desc');
    if (desc) desc.textContent = '';
  }

  function renderSizePicker() {
    const container = document.getElementById('size-picker');
    // Compact cards in a 2x2 grid so the whole New Fleet modal fits with no scroll.
    container.innerHTML = Object.entries(GAME_SIZES).map(([key, size]) => {
      const lines = gameSizeLines(size);
      return `
      <div class="game-size-option ${key === 'clash' ? 'selected' : ''}" data-size="${key}" onclick="App.selectGameSize('${key}')">
        <input type="radio" name="game-size" value="${key}" style="display:none" ${key === 'clash' ? 'checked' : ''}>
        <div class="game-size-info">
          <div class="game-size-name">${size.label}</div>
          <div class="game-size-details">${lines[0]}</div>
          <div class="game-size-details game-size-sub">${lines[1]} · ${lines[2]}</div>
        </div>
      </div>`;
    }).join('');
  }

  function selectGameSize(key) {
    document.querySelectorAll('.game-size-option').forEach(opt => {
      opt.classList.remove('selected');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = false;
    });
    const selected = document.querySelector(`.game-size-option[data-size="${key}"]`);
    if (selected) {
      selected.classList.add('selected');
      const radio = selected.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
    // Reflect the new bracket maximum in the custom points-limit placeholder.
    const ptsInput = document.getElementById('new-fleet-points');
    const max = (GAME_SIZES[key] || {}).max;
    if (ptsInput && max) ptsInput.placeholder = `${max} (bracket max)`;
  }

  function openGameSizeChanger() {
    if (!currentFleet) return;
    // Remove any existing popover
    const existing = document.getElementById('game-size-popover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'game-size-popover';
    popover.className = 'game-size-popover';
    popover.innerHTML = Object.entries(GAME_SIZES).map(([key, size]) => {
      const active = key === currentFleet.gameSize ? ' active' : '';
      const lines = gameSizeLines(size);
      const bars = gameSizeBlocks(key);
      return `<button class="game-size-popover-item${active}" onclick="App.applyGameSize('${key}')">
        <div class="game-size-visual">${bars}</div>
        <div>
          <span class="game-size-popover-name">${size.label}</span>
          <span class="game-size-popover-desc">${lines[0]} · ${lines[1]}</span>
        </div>
      </button>`;
    }).join('');

    // Position near the badge
    const badge = document.getElementById('builder-fleet-size');
    const rect = badge.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = (rect.bottom + 4) + 'px';
    popover.style.left = rect.left + 'px';
    document.body.appendChild(popover);

    // Dismiss on click outside
    function dismiss(e) {
      if (!popover.contains(e.target) && e.target !== badge) {
        popover.remove();
        document.removeEventListener('click', dismiss, true);
      }
    }
    setTimeout(() => document.addEventListener('click', dismiss, true), 10);
  }

  function applyGameSize(key) {
    if (!currentFleet) return;
    currentFleet.gameSize = key;
    const sizeInfo = GAME_SIZES[key];
    currentFleet.pointsLimit = sizeInfo.max;
    currentFleet.maxGroups = sizeInfo.groups;
    saveFleets();

    // Remove popover
    const popover = document.getElementById('game-size-popover');
    if (popover) popover.remove();

    renderBuilder();
    showToast(`Game size changed to ${sizeInfo.label}`);
  }

  function createFleet() {
    const selectedFaction = document.querySelector('.faction-pick-btn[data-selected="true"]');
    if (!selectedFaction) return;
    const faction = selectedFaction.dataset.faction;

    const sizeRadio = document.querySelector('input[name="game-size"]:checked');
    const gameSize = sizeRadio ? sizeRadio.value : 'clash';
    const sizeInfo = GAME_SIZES[gameSize];

    // Fleet names start blank by design (naming UX to be revisited); no auto-default.
    const name = document.getElementById('new-fleet-name').value.trim();

    // Optional custom points limit (e.g. a 1500-pt Clash). Blank = bracket max.
    const ptsRaw = (document.getElementById('new-fleet-points') || {}).value;
    const customPts = ptsRaw ? parseInt(ptsRaw, 10) : NaN;
    const pointsLimit = (!isNaN(customPts) && customPts > 0) ? customPts : sizeInfo.max;

    const fleet = {
      id: uuid(),
      name,
      description: document.getElementById('new-fleet-desc').value.trim(),
      faction,
      gameSize,
      pointsLimit,
      maxGroups: sizeInfo.groups,
      admirals: [],
      battleGroups: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    fleets.push(fleet);
    saveFleets();
    closeModal('modal-new-fleet');
    navigate('builder', fleet.id);
  }

  // Fleet-card overflow (⋮) menu — toggle the inline options menu, closing on
  // outside click. Duplicate/Delete re-render the list so the menu clears.
  function toggleFleetCardMenu(ev, btn) {
    ev.stopPropagation();
    const wrap = btn.closest('.fleet-card-menu-wrap');
    if (!wrap) return;
    const isOpen = wrap.classList.contains('open');
    document.querySelectorAll('.fleet-card-menu-wrap.open').forEach(w => w.classList.remove('open'));
    if (!isOpen) {
      wrap.classList.add('open');
      const close = (e) => {
        if (!wrap.contains(e.target)) { wrap.classList.remove('open'); document.removeEventListener('click', close, true); }
      };
      setTimeout(() => document.addEventListener('click', close, true), 0);
    }
  }

  function deleteFleet(id) {
    const fleet = fleets.find(f => f.id === id);
    if (!fleet) return;
    confirmAction(`Delete "${fleet.name}"?`, 'This cannot be undone.', () => {
      fleets = fleets.filter(f => f.id !== id);
      saveFleets();
      if (currentFleet && currentFleet.id === id) currentFleet = null;
      renderFleetList();
    });
  }

  function duplicateFleet(id) {
    const src = fleets.find(f => f.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uuid();
    copy.name = src.name + ' (copy)';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.battleGroups.forEach(g => { g.id = uuid(); g.ships.forEach(s => { s.id = uuid(); }); });
    if (copy.admirals) copy.admirals.forEach(a => { a.id = uuid(); });
    fleets.push(copy);
    saveFleets();
    renderFleetList();
    showToast(`Duplicated "${src.name}"`);
  }

  function sortFleetList(mode) {
    fleetSortMode = mode;
    document.querySelectorAll('.fleet-sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === mode);
    });
    renderFleetList();
  }

  // ── Fleet List View ──
  function renderFleetList() {
    const grid = document.getElementById('fleet-grid');
    const sortBar = document.getElementById('fleet-sort-bar');
    if (sortBar) sortBar.style.display = fleets.length > 1 ? '' : 'none';

    // Sort fleets before rendering
    const sortedFleets = [...fleets];
    if (fleetSortMode === 'name') {
      sortedFleets.sort((a, b) => a.name.localeCompare(b.name));
    } else if (fleetSortMode === 'faction') {
      sortedFleets.sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));
    } else if (fleetSortMode === 'points') {
      sortedFleets.sort((a, b) => calcFleetPoints(b) - calcFleetPoints(a));
    } else {
      sortedFleets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    const cards = sortedFleets.map(f => {
      const pts = calcFleetPoints(f);
      const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
      const fName = (factionData[f.faction] || {}).name || f.faction.toUpperCase();
      const shipCount = f.battleGroups.reduce((t, g) => t + g.ships.length, 0);
      const admCount = (f.admirals || []).length;
      const updated = f.updatedAt ? new Date(f.updatedAt) : null;
      const timeAgo = updated ? formatTimeAgo(updated) : '';
      const warnings = validateFleet(f);
      const errorCount = warnings.filter(w => w.type === 'error').length;
      const warnCount = warnings.filter(w => w.type === 'warn').length;
      const limit = effMax(f);
      const pctFill = limit === 99999 ? 0 : Math.min((pts / limit) * 100, 100);
      const barClass = pts > limit ? 'fleet-card-bar-over' : pctFill > 85 ? 'fleet-card-bar-near' : '';
      const validationBadge = '';  // issue counts are not shown on fleet cards
      const fIcon = FACTION_ICONS[f.faction];
      return `
      <div class="fleet-card card-deco" onclick="App.navigate('builder','${f.id}')">
        <div class="fleet-card-header">
          <div class="flex items-center gap-xs">
            ${fIcon ? `<img src="${fIcon}" alt="" class="fleet-card-faction-icon">` : ''}
            <span class="badge badge-navy">${fName}</span>
          </div>
          <div class="fleet-card-menu-wrap" onclick="event.stopPropagation()">
            <button class="fleet-card-menu-btn" aria-label="Fleet options" aria-haspopup="true" onclick="App.toggleFleetCardMenu(event, this)"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/></svg></button>
            <div class="fleet-card-menu" role="menu">
              <button role="menuitem" onclick="App.duplicateFleet('${f.id}')"><svg width="14" height="14" viewBox="0 0 16 16"><g fill="currentColor"><path d="M4 9a3 3 0 0 0 3 3h4v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1z"/><path d="M13 1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zM9 5H7v2h2v2h2V7h2V5h-2V3H9z"/></g></svg> Duplicate</button>
              <button role="menuitem" class="danger" onclick="App.deleteFleet('${f.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Delete</button>
            </div>
          </div>
        </div>
        <div class="fleet-card-name">${esc(f.name)}</div>
        ${f.description ? `<div class="text-caption" style="line-height:1.4">${esc(f.description)}</div>` : ''}
        <div class="fleet-card-points-row">
          <span class="fleet-card-points">${pts} <span class="fleet-card-pts-label">/ ${limit === 99999 ? '∞' : limit} pts</span></span>
          <span class="text-caption">${sizeInfo.label}, ${f.battleGroups.length} group${f.battleGroups.length !== 1 ? 's' : ''}${admCount > 0 ? `, ${admCount} admiral${admCount !== 1 ? 's' : ''}` : ''}${f.spaceStation ? `, ${esc(f.spaceStation.name).replace(' Space Station','')}` : ''}</span>
        </div>
        <div class="fleet-card-bar"><div class="fleet-card-bar-fill ${barClass}" style="width:${pctFill}%"></div></div>
        ${renderFleetCardComp(f)}
        ${timeAgo ? `<div class="fleet-card-time text-caption">${timeAgo}</div>` : ''}
      </div>`;
    }).join('');

    const newCard = `
      <div class="fleet-card fleet-card-new" onclick="App.openNewFleetModal()">
        <div class="fleet-card-new-icon"><svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg></div>
        <div style="font-family:var(--font-display);font-weight:var(--weight-semibold);font-size:var(--text-md)">Create New Fleet</div>
        <div class="text-caption">New Fleet</div>
      </div>`;

    if (fleets.length === 0) {
      grid.innerHTML = `
        <div class="fleet-list-empty">
          <h2 class="fleet-list-empty-title">No fleets yet</h2>
          <button class="btn btn-primary" style="margin-top:var(--sp-lg)" onclick="App.openNewFleetModal()"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> New Fleet</button>
        </div>`;
    } else {
      grid.innerHTML = cards + newCard;
    }
  }

  let activeFleetTab = 'my';
  function showFleetTab(tab) {
    activeFleetTab = tab;
    const myTab = document.getElementById('tab-my-fleets');
    const fpTab = document.getElementById('tab-fastplay');
    const grid = document.getElementById('fleet-grid');
    const sortBar = document.getElementById('fleet-sort-bar');
    const fpContainer = document.getElementById('fastplay-container');
    const actions = document.getElementById('fleet-actions');

    if (tab === 'my') {
      myTab.classList.add('active'); fpTab.classList.remove('active');
      grid.classList.remove('hidden'); sortBar.classList.remove('hidden');
      fpContainer.classList.add('hidden');
      if (actions) actions.style.display = '';
    } else {
      fpTab.classList.add('active'); myTab.classList.remove('active');
      grid.classList.add('hidden'); sortBar.classList.add('hidden');
      fpContainer.classList.remove('hidden');
      if (actions) actions.style.display = 'none';
      renderFastplayFleets();
    }
  }

  function renderFastplayFleets() {
    const container = document.getElementById('fastplay-container');
    if (!container) return;

    const factionKeys = ['ucm','phr','scourge','shaltari','bioficer','resistance'];
    const cards = factionKeys.map(fk => {
      const label = FACTION_LABELS[fk] || fk.toUpperCase();
      const fIcon = FACTION_ICONS[fk];
      const spec = fastplaySpecs.find(s => s.faction === fk);
      if (!spec) return '';
      const shipList = spec.groups.map(([cat, name]) => esc(name)).join(', ');
      return `<button class="fastplay-faction-btn" onclick="App.loadFastplayFaction('${fk}')">
        ${fIcon ? `<img src="${fIcon}" alt="" style="width:20px;height:20px;object-fit:contain">` : ''}
        <div style="text-align:left;flex:1">
          <div style="font-weight:var(--weight-semibold)">${label}</div>
          <div style="font-size:var(--text-xs);color:var(--ink-muted);font-weight:var(--weight-normal)">${shipList}</div>
        </div>
      </button>`;
    }).join('');

    container.innerHTML = `<div class="fastplay-grid">${cards}</div>`;
  }

  function loadFastplayFaction(fk) {
    ensureFactionLoaded(fk).then(() => {
      const spec = fastplaySpecs.find(s => s.faction === fk);
      if (!spec) return;
      const battleGroups = [];
      spec.groups.forEach(([cat, name, qty]) => {
        const g = makeGroup(fk, null, cat, name, qty);
        if (g) battleGroups.push(g);
      });
      if (battleGroups.length === 0) return;
      const gs = GAME_SIZES[spec.size || 'skirmish'] || GAME_SIZES.skirmish;
      const fleet = {
        id: uuid(), name: spec.name,
        faction: fk, gameSize: spec.size || 'skirmish', pointsLimit: gs.max, maxGroups: gs.groups,
        admirals: [], battleGroups, spaceStation: null,
        createdAt: Date.now(), updatedAt: Date.now()
      };
      fleets.push(fleet);
      saveFleets();
      navigate('builder', fleet.id);
    });
  }

  function loadSingleFastplay(factionKey) {
    ensureFactionLoaded(factionKey).then(() => {
      const spec = fastplaySpecs.find(s => s.faction === factionKey);
      if (!spec) return;
      const battleGroups = [];
      spec.groups.forEach(([cat, name, qty]) => {
        const g = makeGroup(factionKey, null, cat, name, qty);
        if (g) battleGroups.push(g);
      });
      if (battleGroups.length === 0) return;
      const gs = GAME_SIZES[spec.size || 'skirmish'] || GAME_SIZES.skirmish;
      fleets.push({
        id: uuid(), name: spec.name,
        faction: factionKey, gameSize: spec.size || 'skirmish', pointsLimit: gs.max, maxGroups: gs.groups,
        admirals: [], battleGroups, spaceStation: null,
        createdAt: Date.now(), updatedAt: Date.now()
      });
      saveFleets();
      showFleetTab('my');
      renderFleetList();
      showToast(`${FACTION_LABELS[factionKey]} Fast Play fleet added`);
    });
  }

  // Mini composition strip for fleet cards
  function renderFleetCardComp(f) {
    if (f.battleGroups.length === 0) return '';
    const catColors = { light: '#5b9bd5', medium: '#3e9945', heavy: '#d98c1f', colossal: '#c43c2f', payload: '#6a4c9c' };
    // Collect unique ship names with art paths (deduplicated)
    const seen = new Set();
    const shipPreviews = [];
    f.battleGroups.forEach(g => {
      if (g.ships.length === 0) return;
      const s = g.ships[0];
      const key = `${s.groupCategory}:${s.shipKey}`;
      if (seen.has(key)) return;
      seen.add(key);
      const db = findShipInDB(f.faction, s.groupCategory, s.shipKey);
      if (db) {
        const art = shipArtPath(db.name);
        if (art) shipPreviews.push({ art, name: db.name, cat: s.groupCategory });
      }
    });
    if (shipPreviews.length === 0) return '';
    const maxShow = 5;
    const shown = shipPreviews.slice(0, maxShow);
    const overflow = shipPreviews.length - maxShow;
    const thumbs = shown.map(sp =>
      `<div class="fleet-card-thumb" style="border-color:${catColors[sp.cat] || '#999'}" title="${esc(sp.name)}"><img src="${sp.art}" alt="" loading="lazy"></div>`
    ).join('');
    return `<div class="fleet-card-comp">${thumbs}${overflow > 0 ? `<span class="fleet-card-thumb-more">+${overflow}</span>` : ''}</div>`;
  }

  // ── Ship Lookup Helpers ──
  function findShipKey(factionKey, category, namePart) {
    const faction = shipDB[factionKey];
    if (!faction || !faction.groups || !faction.groups[category]) return null;
    const ships = faction.groups[category].ships;
    const lc = namePart.toLowerCase();
    let substringMatch = null;
    for (const [key, ship] of Object.entries(ships)) {
      const sn = ship.name.toLowerCase();
      if (sn === lc || sn === lc + 's') return { key, ship };
      if (!substringMatch && sn.startsWith(lc)) substringMatch = { key, ship };
      if (!substringMatch && sn.includes(lc)) substringMatch = { key, ship };
    }
    return substringMatch;
  }

  function makeGroup(factionKey, groupName, category, namePart, qty) {
    const found = findShipKey(factionKey, category, namePart);
    if (!found) return null;
    const { key, ship } = found;
    const ships = [];
    for (let i = 0; i < qty; i++) {
      const loadouts = {};
      let loadoutCost = 0;
      if (ship.loadoutOptions && ship.loadoutOptions.length > 0) {
        ship.loadoutOptions.forEach((lo, loIdx) => {
          loadouts[loIdx] = 0;
          loadoutCost += lo.options[0]?.cost || 0;
        });
      }
      ships.push({ id: uuid(), shipKey: key, groupCategory: category, points: (ship.points || 0) + loadoutCost, loadouts });
    }
    return { id: uuid(), name: groupName || ship.name, ships };
  }

  // ── Demo Fleets ──
  function loadDemoFleets() {
    if (fleets.some(f => f.name.includes('Demo'))) {
      showToast('Demo fleets already loaded');
      return;
    }

    const demoSpecs = fastplaySpecs;

    let loaded = 0;
    const loadPromises = demoSpecs.map(spec => ensureFactionLoaded(spec.faction));
    Promise.all(loadPromises).then(() => {
      demoSpecs.forEach(spec => {
        if (!shipDB[spec.faction]) return;
        const battleGroups = [];
        spec.groups.forEach(([cat, name, qty]) => {
          const g = makeGroup(spec.faction, null, cat, name, qty);
          if (g) battleGroups.push(g);
        });
        if (battleGroups.length === 0) return;

        const gs = GAME_SIZES[spec.size || 'skirmish'] || GAME_SIZES.skirmish;
        fleets.push({
          id: uuid(), name: spec.name,
          faction: spec.faction, gameSize: spec.size || 'skirmish', pointsLimit: gs.max, maxGroups: gs.groups,
          admirals: [], battleGroups, spaceStation: null,
          createdAt: Date.now() - (5 - loaded) * 60000, updatedAt: Date.now() - (5 - loaded) * 60000
        });
        loaded++;
      });

      saveFleets();
      renderFleetList();
      showToast(`${loaded} demo fleet${loaded !== 1 ? 's' : ''} loaded!`);
    });
  }

  // ── Render Batching ──
  // Coalesce render calls within a frame: multiple mutations in one tick
  // (e.g. updatePoints + nav + panels) collapse into a single paint, and
  // duplicate render functions are deduped by reference.
  let _renderQueue = new Set();
  let _renderPending = false;
  function scheduleRender(...fns) {
    fns.forEach(fn => _renderQueue.add(fn));
    if (_renderPending) return;
    _renderPending = true;
    // Microtask, not requestAnimationFrame: it still coalesces a burst of
    // mutations from one handler into a single render, but always fires —
    // rAF is throttled/paused in background tabs, which would freeze the UI.
    queueMicrotask(() => {
      const queued = Array.from(_renderQueue);
      _renderQueue.clear();
      _renderPending = false;
      queued.forEach(fn => { try { fn(); } catch(e) { console.error('Render error:', e); } });
    });
  }

  // ── Builder View ──
  function renderBuilder() {
    if (!currentFleet) return;
    const f = currentFleet;
    const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const fName = (factionData[f.faction] || {}).name || f.faction.toUpperCase();

    const nameEl = document.getElementById('builder-fleet-name');
    nameEl.textContent = f.name;
    nameEl.title = 'Click to rename fleet';
    nameEl.style.cursor = 'pointer';
    nameEl.onclick = () => editFleetName();
    document.getElementById('builder-fleet-faction').textContent = fName;
    const sizeEl = document.getElementById('builder-fleet-size');
    sizeEl.textContent = sizeInfo.label;
    sizeEl.style.cursor = 'pointer';
    sizeEl.title = 'Click to change game size';
    sizeEl.onclick = () => App.openGameSizeChanger();

    // Game size summary beneath the badge
    const sizeDetail = document.getElementById('game-size-detail');
    if (sizeDetail) {
      // One line per rule (rulebook Section 4.2), stacked.
      sizeDetail.innerHTML = gameSizeLines(sizeInfo).map(l => `<div>${l}</div>`).join('');
    }

    const panel = document.getElementById('fleet-info-panel');
    panel.closest('[id="view-builder"]').dataset.faction = f.faction;

    // Default to fleet overview (no group selected)
    if (!activeGroupId) {
      activeGroupId = null;
    }

    updatePoints();
    renderAdmiralSlot();
    renderStationSlot();
    renderGroupsNav();
    renderActiveGroup();
  }

  // Best "Command Ship-X" value among the fleet's ships. An Admiral assigned to a
  // Command Ship has their Level (and thus AP/turn) raised by X; a player puts their
  // admiral on the strongest one, so we surface that single best bonus.
  function fleetCommandShipBonus(f) {
    let best = 0;
    (f.battleGroups || []).forEach(g => (g.ships || []).forEach(s => {
      const db = findShipInDB(f.faction, s.groupCategory, s.shipKey);
      const sp = db ? (db.special || '') : '';
      const m = String(sp).match(/Command Ship-(\d+)/i);
      if (m) best = Math.max(best, parseInt(m[1], 10));
    }));
    return best;
  }

  function updatePoints() {
    const f = currentFleet;
    if (!f) return;
    const pts = calcFleetPoints(f);
    const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const limit = effMax(f);
    const pct = Math.min((pts / limit) * 100, 100);

    document.getElementById('points-current').textContent = pts;
    document.getElementById('points-limit').textContent = limit === 99999 ? '∞' : limit;
    const remainEl = document.getElementById('points-remaining');
    if (remainEl && limit !== 99999) {
      const rem = limit - pts;
      remainEl.textContent = rem >= 0 ? `${rem} left` : `${Math.abs(rem)} over`;
      remainEl.className = 'points-remaining' + (rem < 0 ? ' points-over' : '');
    }

    const fill = document.getElementById('points-fill');
    fill.style.width = limit === 99999 ? '0%' : pct + '%';
    fill.className = 'points-fill' + (pts > limit ? ' over-budget' : pct > 85 ? ' near-limit' : '');

    const groupCount = countableGroups(f).length;
    const gcEl = document.getElementById('groups-count');
    if (gcEl) gcEl.textContent = `${groupCount} / ${sizeInfo.groups} groups`;
    const glEl = document.getElementById('groups-limit');
    if (glEl) glEl.textContent = '';

    // AP/turn = the admiral's Level. A "Command Ship-X" ship raises the Level of the
    // Admiral assigned to it by X, so the admiral placed on the best Command Ship in
    // the fleet gets that bonus (e.g. Las Vegas Command Carrier = +1).
    const baseAP = (f.admirals || []).reduce((t, a) => t + (a.level || 0), 0);
    const cmdBonus = (f.admirals && f.admirals.length) ? fleetCommandShipBonus(f) : 0;
    const totalAP = baseAP + cmdBonus;
    const apEl = document.getElementById('fleet-ap-per-turn');
    if (apEl) apEl.textContent = totalAP > 0 ? `${totalAP} AP/turn` : '';

    // Update mobile sidebar peek summary
    const peekPts = document.getElementById('sidebar-peek-points');
    const peekGrp = document.getElementById('sidebar-peek-groups');
    if (peekPts) peekPts.textContent = `${pts} / ${limit === 99999 ? '∞' : limit} pts`;
    if (peekGrp) peekGrp.textContent = `${groupCount} group${groupCount !== 1 ? 's' : ''}`;

    f.updatedAt = Date.now();
    saveFleets();

    // Composition breakdown
    renderCompositionBar();
    // Validation warnings live in the centre overview panel only (the sidebar
    // copy was a duplicate).
  }

  // ── Fleet Validation ──
  // Returns an array of {type: 'error'|'warn', message} for display
  // Payload groups (Bioficer Cells, deployed from carriers) are not independent
  // battle groups — they don't count toward the game-size group limit.
  function isPayloadGroup(fleet, g) {
    if (!g || !g.ships || !g.ships.length) return false;
    const s = g.ships[0];
    if (s.groupCategory === 'payload') return true;
    const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
    const ton = (db && db.tonnage) || s.tonnage || '';
    return ton === 'P';
  }
  function countableGroups(fleet) {
    return (fleet.battleGroups || []).filter(g => !isPayloadGroup(fleet, g));
  }

  // Effective points cap for a fleet. `pointsLimit` (shared with the mobile app)
  // holds the live cap; it defaults to the game size's max but can be overridden
  // to any custom value (e.g. a 1500-pt game in the Clash bracket). 99999 = open.
  function bracketMax(fleet) {
    return (GAME_SIZES[fleet && fleet.gameSize] || GAME_SIZES.clash).max;
  }
  function effMax(fleet) {
    return (fleet && fleet.pointsLimit) ? fleet.pointsLimit : bracketMax(fleet);
  }
  function isCustomMax(fleet) {
    return !!(fleet && fleet.pointsLimit && fleet.pointsLimit !== bracketMax(fleet));
  }

  // Set/clear the fleet's points limit (empty/invalid → revert to bracket default).
  function setCustomMax(val) {
    if (!currentFleet) return;
    const n = parseInt(val, 10);
    currentFleet.pointsLimit = (val === '' || val == null || isNaN(n) || n <= 0) ? bracketMax(currentFleet) : n;
    saveFleets();
    scheduleRender(renderGroupsNav, renderActiveGroup, updatePoints);
  }

  // How many Abilities-Table picks an admiral is supposed to make (0 = none, e.g.
  // generic level admirals). Famous/faction admirals carry their own pick count.
  function admiralRequiredPicks(fleet, adm) {
    const fs = shipDB[fleet && fleet.faction];
    if (!fs || !adm) return 0;
    if (adm.shipKey) { const a = fs.groups?.famous_admirals?.ships?.[adm.shipKey]; return a ? (a.ability_picks || 0) : 0; }
    if (adm.admiralId) { const a = (fs.admirals || []).find(x => x.id === adm.admiralId); return a ? (a.abilityPicks || 0) : 0; }
    return 0;
  }

  function validateFleet(fleet) {
    if (!fleet) return [];
    const warnings = [];
    const sizeInfo = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    const pts = calcFleetPoints(fleet);

    // 1. Points range. Only the over-budget case is flagged: the live points
    // total (e.g. "715 / 2001") already shows progress toward the minimum, so a
    // separate "below minimum" warning is just noise the whole time you build.
    const maxPts = effMax(fleet);
    if (pts > maxPts && maxPts !== 99999) {
      warnings.push({ type: 'error', msg: `Over budget: ${pts}/${maxPts} pts` });
    }

    // 2. Group count
    const groupTally = countableGroups(fleet).length;
    if (groupTally > sizeInfo.groups) {
      warnings.push({ type: 'error', msg: `Too many groups: ${groupTally}/${sizeInfo.groups}` });
    }

    // 3. Colossal group limit
    const colossalMax = sizeInfo.colossalMax ?? 99;
    const colossalGroups = fleet.battleGroups.filter(g => {
      if (g.ships.length === 0) return false;
      const s = g.ships[0];
      const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
      return db && (db.category === 'colossal' || s.groupCategory === 'colossal');
    });
    if (colossalGroups.length > colossalMax) {
      warnings.push({ type: 'error', msg: `Too many Colossal groups: ${colossalGroups.length}/${colossalMax}` });
    }

    // 4. Unique ship limit (max 1 group per unique ship)
    // 5. Rare ship limit (scales with game size: skirmish 1, clash 2, battle 3, reconquest 4)
    const rareMax = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 }[fleet.gameSize] || 2;
    const shipGroupCounts = {};
    fleet.battleGroups.forEach(g => {
      if (g.ships.length === 0) return;
      const s = g.ships[0];
      const key = `${s.groupCategory}:${s.shipKey}`;
      if (!shipGroupCounts[key]) {
        const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
        shipGroupCounts[key] = { count: 0, name: db ? db.name : s.shipKey, isRare: db?.isRare, isUnique: db?.isUnique };
      }
      shipGroupCounts[key].count++;
    });

    Object.values(shipGroupCounts).forEach(info => {
      if (info.isUnique && info.count > 1) {
        warnings.push({ type: 'error', msg: `${info.name} is Unique, max 1 group` });
      }
      if (info.isRare && info.count > rareMax) {
        warnings.push({ type: 'error', msg: `${info.name} is Rare, max ${rareMax} group${rareMax > 1 ? 's' : ''} at ${sizeInfo.label}` });
      }
    });

    // 6. Group size validation (ships per group within min-max). Payloads
    // (Bioficer Cells) have no group size, so they're exempt from this check.
    fleet.battleGroups.forEach(g => {
      if (g.ships.length === 0) return;
      const s = g.ships[0];
      if (s.groupCategory === 'payload') return;
      const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
      if (!db) return;
      const min = db.groupMin || 1;
      const max = db.groupMax || 1;
      if (g.ships.length < min) {
        warnings.push({ type: 'warn', msg: `${esc(g.name)}: needs ${min} ${db.name} (has ${g.ships.length})` });
      }
      if (g.ships.length > max) {
        warnings.push({ type: 'error', msg: `${esc(g.name)}: max ${max} ${db.name} (has ${g.ships.length})` });
      }
    });

    // 7. Tonnage restrictions (Section 4.2)
    let lightPts = 0, mediumPts = 0, heavyPts = 0;
    fleet.battleGroups.forEach(g => {
      const cat = g.ships[0]?.groupCategory;
      const groupPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      if (cat === 'light') lightPts += groupPts;
      else if (cat === 'medium') mediumPts += groupPts;
      else if (cat === 'heavy') heavyPts += groupPts;
    });
    // Both are hard restrictions per Section 4.2: Heavy points may not exceed
    // Medium points; Light points may not exceed Medium + Heavy points.
    if (heavyPts > mediumPts) {
      warnings.push({ type: 'error', msg: `Heavy points (${heavyPts}) can't exceed Medium points (${mediumPts}) (rulebook 4.2)` });
    }
    if (lightPts > mediumPts + heavyPts) {
      warnings.push({ type: 'error', msg: `Light points (${lightPts}) can't exceed Medium + Heavy points (${mediumPts + heavyPts}) (rulebook 4.2)` });
    }

    // 7b. Deployable Features are always OPTIONAL now — a carrier can pick/swap one
    // right before the game, so an empty slot is never flagged.

    // 7c. Systems/Hardpoint selections must satisfy their list rules
    fleet.battleGroups.forEach(g => {
      if (g.ships.length === 0) return;
      const s = g.ships[0];
      const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
      validateSystems(s, db, fleet.faction).forEach(msg => warnings.push({ type: 'warn', msg }));
    });

    // 7d. Payload capacity — Payload Ships "take up X of a Porter Ship's capacity"
    // and must be assigned to a Porter of the same size letter (S or L). Soft
    // warning when the fleet's total Payload of a letter exceeds its total Porter
    // capacity of that letter. Fleet-wide aggregate, not per-Porter assignment.
    const porterCap = {};      // { S: n, L: n } — capacity from Porter stat strings
    const payloadDemand = {};  // { S: n, L: n } — capacity consumed by Payload Ships
    fleet.battleGroups.forEach(g => {
      g.ships.forEach(s => {
        const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
        const special = (db && db.special) || '';
        let m;
        const pRe = /Porter\s*([SLF])-(\d+)/gi;
        while ((m = pRe.exec(special))) { const L = m[1].toUpperCase(); porterCap[L] = (porterCap[L] || 0) + parseInt(m[2], 10); }
        const dRe = /Payload\s*([SLF])-(\d+)/gi;
        while ((m = dRe.exec(special))) { const L = m[1].toUpperCase(); payloadDemand[L] = (payloadDemand[L] || 0) + parseInt(m[2], 10); }
      });
    });
    ['S', 'L', 'F'].forEach(letter => {
      const demand = payloadDemand[letter] || 0;
      if (demand > (porterCap[letter] || 0)) {
        warnings.push({ type: 'warn', msg: `Payload ${letter}: ${demand} assigned, fleet Porter ${letter} capacity ${porterCap[letter] || 0}` });
      }
    });

    // 8. Admiral checks
    const admirals = fleet.admirals || [];
    if (admirals.length === 0 && fleet.battleGroups.length > 0) {
      warnings.push({ type: 'error', msg: 'Fleet must contain an Admiral' });
    }
    let namedCount = 0;
    admirals.forEach(adm => {
      const admLvl = adm.level || 0;
      const effectiveLvl = admLvl >= 5 ? 4 : admLvl;
      if (effectiveLvl > sizeInfo.maxAdmiralLevel) {
        warnings.push({ type: 'error', msg: `${adm.name} (Lv${admLvl}) exceeds max Lv${sizeInfo.maxAdmiralLevel} for ${sizeInfo.label}` });
      }
      if (adm.type === 'Famous' || adm.type === 'Faction') namedCount++;
      // Generic/Faction admirals must be assigned to a Capital ship (Section 4.2.1).
      if (adm.type !== 'Famous') {
        const caps = capitalShipGroups();
        if (caps.length && !caps.some(g => g.id === adm.assignedGroupId)) {
          warnings.push({ type: 'warn', msg: `${adm.name} is not assigned to a Capital ship` });
        }
      }
      // Admiral hasn't picked all its Abilities Table choices yet (soft nudge).
      const picks = admiralRequiredPicks(fleet, adm);
      const chosen = (adm.selectedAbilities || []).length;
      if (picks > 0 && chosen < picks) {
        warnings.push({ type: 'warn', msg: `${adm.name}: choose ${picks} Abilit${picks > 1 ? 'ies' : 'y'} (${chosen}/${picks})` });
      }
    });
    if (namedCount > 1) {
      warnings.push({ type: 'error', msg: `Only one Famous/Faction Admiral per fleet (you have ${namedCount})` });
    }

    // Generic space station needs its required armaments (soft nudge).
    if (fleet.spaceStation) {
      const spec = stationArmamentSpec(fleet.spaceStation);
      if (spec) {
        const { armTotal } = summariseStation(fleet.spaceStation);
        if (armTotal < spec.required) {
          warnings.push({ type: 'warn', msg: `${fleet.spaceStation.name}: choose ${spec.required} armament${spec.required > 1 ? 's' : ''} (has ${armTotal})` });
        }
      }
    }

    return warnings;
  }

  function validateGroupSize(group, fleet) {
    if (!group || group.ships.length === 0) return [];
    const errors = [];
    const s = group.ships[0];
    const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
    if (!db) return [];

    // Payloads (Bioficer Cells) have no group size — skip the min/max check.
    const isPayload = s.groupCategory === 'payload';
    const min = db.groupMin || 1;
    const max = isPayload ? Infinity : (db.groupMax || 1);
    if (group.ships.length > max) {
      errors.push(`max ${max} ${db.name} (has ${group.ships.length})`);
    }
    if (!isPayload && group.ships.length < min) {
      errors.push(`needs at least ${min} ${db.name} (has ${group.ships.length})`);
    }
    if (db.isUnique) {
      // Check fleet-wide for other groups with same ship
      const otherGroups = fleet.battleGroups.filter(g =>
        g.id !== group.id && g.ships.length > 0 &&
        g.ships[0].groupCategory === s.groupCategory && g.ships[0].shipKey === s.shipKey
      );
      if (otherGroups.length > 0) {
        errors.push(`${db.name} is Unique, only 1 group allowed`);
      }
    }
    return errors;
  }

  function calcFleetPoints(fleet) {
    let total = 0;
    (fleet.admirals || []).forEach(a => { total += a.points || 0; });
    fleet.battleGroups.forEach(g => {
      g.ships.forEach(s => { total += s.points || 0; });
    });
    if (fleet.spaceStation) total += fleet.spaceStation.cost || 0;
    return total;
  }

  function renderCompositionBar() {
    const container = document.getElementById('fleet-composition');
    if (!container || !currentFleet) { if (container) container.innerHTML = ''; return; }
    if (currentFleet.battleGroups.length === 0) { container.innerHTML = ''; return; }

    const catCounts = {};
    let totalPts = 0;
    currentFleet.battleGroups.forEach(g => {
      g.ships.forEach(s => {
        const cat = s.groupCategory || 'medium';
        if (!catCounts[cat]) catCounts[cat] = { pts: 0, ships: 0 };
        catCounts[cat].pts += s.points || 0;
        catCounts[cat].ships++;
        totalPts += s.points || 0;
      });
    });

    if (totalPts === 0) { container.innerHTML = ''; return; }

    const catColors = {
      light: '#5b9bd5', medium: '#3e9945', heavy: '#d98c1f',
      colossal: '#c43c2f', payload: '#6a4c9c'
    };
    const catOrder = ['light', 'medium', 'heavy', 'colossal', 'payload'];

    const present = catOrder.filter(cat => catCounts[cat]);
    const bars = present.map(cat => {
      const info = catCounts[cat];
      const pct = (info.pts / totalPts) * 100;
      const color = catColors[cat] || 'var(--ink-muted)';
      return `<div class="comp-segment" style="width:${pct}%;background:${color}"></div>`;
    }).join('');
    // No colour-key legend — one hover tooltip explains the whole (thicker) bar.
    const explain = present.map(cat => {
      const i = catCounts[cat];
      return `${CATEGORY_LABELS[cat] || cat}: ${i.ships} ship${i.ships > 1 ? 's' : ''}, ${i.pts} pts (${Math.round((i.pts / totalPts) * 100)}%)`;
    }).join('\n');
    container.innerHTML = `<div class="comp-bar comp-bar-thick" title="${esc(explain)}">${bars}</div>`;
  }

  // ── Groups ──
  function renderGroupsNav() {
    const nav = document.getElementById('groups-nav');
    if (!nav || !currentFleet) return;  // groups nav lives in the overview panel now

    if (currentFleet.battleGroups.length === 0) {
      nav.innerHTML = '<div class="text-caption text-center" style="padding:var(--sp-md)">No groups yet</div>';
      return;
    }

    const total = currentFleet.battleGroups.length;
    const catColors = { light: '#5b9bd5', medium: '#3e9945', heavy: '#d98c1f', colossal: '#c43c2f', payload: '#6a4c9c' };
    // The centre panel always shows the fleet overview, so a dedicated
    // "Overview" nav row in the sidebar is redundant — clicking the active
    // group again deselects it and returns focus to the overview.
    nav.innerHTML = currentFleet.battleGroups.map((g, i) => {
      const shipCount = g.ships.length;
      const groupPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      const isActive = g.id === activeGroupId;

      // Ship info from first ship
      let catLabel = '';
      let catKey = 'medium';
      let artThumb = '';
      let shipName = '';
      if (g.ships.length > 0) {
        catKey = g.ships[0].groupCategory || 'medium';
        catLabel = CATEGORY_LABELS[catKey] || catKey;
        const firstDb = findShipInDB(currentFleet.faction, g.ships[0].groupCategory, g.ships[0].shipKey);
        if (firstDb) {
          shipName = firstDb.name;
          const art = shipArtPath(firstDb.name);
          if (art) artThumb = `<div class="group-nav-art"><img src="${art}" alt="" loading="lazy"></div>`;
        }
      }

      // Validation status
      const groupErrors = validateGroupSize(g, currentFleet);
      const hasError = groupErrors.length > 0;
      const statusDot = hasError ? `<span class="group-nav-dot group-nav-dot-error" title="${esc(groupErrors[0])}"></span>` : '';

      // Tonnage accent color
      const accentColor = catColors[catKey] || 'rgba(255,255,255,0.15)';

      const reorderBtns = isActive && total > 1
        ? `<span class="group-nav-reorder" onclick="event.stopPropagation()">
            <button class="group-move-btn" onclick="App.moveGroup('${g.id}',-1)" ${i === 0 ? 'disabled' : ''} title="Move up"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10l4-4 4 4"/></svg></button>
            <button class="group-move-btn" onclick="App.moveGroup('${g.id}',1)" ${i === total - 1 ? 'disabled' : ''} title="Move down"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg></button>
           </span>`
        : '';
      return `
      <div class="group-nav-item ${isActive ? 'active' : ''}${hasError ? ' has-error' : ''}" onclick="App.selectGroup('${g.id}')" role="button" tabindex="0" aria-pressed="${isActive}" aria-label="${esc(g.name)}, ${catLabel}, ${groupPts} points, ${shipCount} ship${shipCount !== 1 ? 's' : ''}" style="--nav-accent:${accentColor}">
        ${artThumb}
        <div class="group-nav-body">
          <div class="group-nav-top">
            <span class="group-nav-name group-name-editable" onclick="event.stopPropagation(); App.editGroupName('${g.id}', this)" title="Click to rename battlegroup">${esc(g.name)}</span>
            ${statusDot}
            ${reorderBtns}
          </div>
          <div class="group-nav-meta">
            <span class="group-nav-cat">${catLabel}</span>
            <span class="group-nav-pts">${groupPts}pts</span>
            <span class="group-nav-count">${shipCount} ship${shipCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function addGroup() {
    if (!currentFleet) return;
    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    if (countableGroups(currentFleet).length >= sizeInfo.groups) {
      showToast('Maximum groups reached for ' + sizeInfo.label);
      return;
    }
    // Open ship selection — picking a ship creates the group
    pendingGroupCreation = true;
    openShipSelectModal(null);
  }

  function selectGroup(gid) {
    // Clicking the already-active group toggles it off, returning focus to the
    // always-visible overview (there's no dedicated Overview nav row anymore).
    activeGroupId = (gid && gid === activeGroupId) ? null : (gid || null);
    activeFlagship = null;   // selecting a group deselects any selected flagship
    // Selection only changes the nav highlight + which group the detail panel
    // shows — the overview content is unchanged, so don't rebuild it.
    scheduleRender(renderGroupsNav, renderDetailPanel);

    // On mobile, collapse sidebar
    if (gid) {
      const sidebar = document.getElementById('builder-sidebar');
      if (sidebar.classList.contains('expanded')) sidebar.classList.remove('expanded');
    }
  }

  // Select a famous admiral's flagship (by admiral index): it shows in the detail
  // panel like a normal battlegroup. Toggles off if already selected.
  function selectFlagship(idx) {
    activeFlagship = (activeFlagship === idx) ? null : idx;
    activeGroupId = null;
    scheduleRender(renderGroupsNav, renderDetailPanel);
    const sidebar = document.getElementById('builder-sidebar');
    if (sidebar && sidebar.classList.contains('expanded')) sidebar.classList.remove('expanded');
  }

  // The flagship's detail-panel view: same shape as a battlegroup's (header bar +
  // ship card with the full datasheet). The admiral character is managed in the
  // left rail; this is the ship on the table.
  function renderFlagshipDetail(idx, a, fdb) {
    const shipName = fdb.ship_name || fdb.name || 'Flagship';
    const ton = tonLabel(fdb.tonnage) || '';
    const tonClass = (fdb.tonnage || '').toLowerCase().replace(/\s+/g, '-');
    const img = fdb.image;
    return `
    <button class="detail-back mobile-only" onclick="App.selectFlagship(${idx})">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L4 8l6 6"/></svg> Back to fleet
    </button>
    <div class="group-header-bar">
      <div class="flex items-center gap-md flex-wrap">
        <h2 class="group-title ship-card-name-link" onclick="App.openShipDetail('${currentFleet.faction}','famous_admirals','${a.shipKey}')">${esc(shipName)}</h2>
        <span class="ship-badge ship-badge-unique">Flagship</span>
        ${ton ? `<span class="badge badge-tonnage badge-tonnage-${tonClass}">${esc(ton)}</span>` : ''}
        <span class="badge badge-navy">${a.points} pts</span>
      </div>
      <div class="group-header-actions">
        <button class="btn btn-danger btn-sm" onclick="App.removeAdmiral(${idx})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
      </div>
    </div>
    <div class="group-ships-list">
      <div class="group-ship-entry">
        ${img ? `<div class="ship-card-image"><img src="${esc(img)}" alt="${esc(shipName)}" loading="lazy" decoding="async" onerror="this.style.display='none'"></div>` : ''}
        <div class="ship-card-body" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-sm)">
          ${sharedShipDatasheet(currentFleet, a, fdb)}
          <div class="text-caption">Flies with ${esc(a.name)}, who is managed in the left rail.</div>
        </div>
      </div>
    </div>`;
  }

  function removeGroup(gid) {
    if (!currentFleet) return;
    const g = currentFleet.battleGroups.find(g => g.id === gid);
    if (!g) return;
    confirmAction(`Remove "${g.name}"?`, 'All ships in this group will be removed.', () => {
      currentFleet.battleGroups = currentFleet.battleGroups.filter(g => g.id !== gid);
      if (activeGroupId === gid) {
        activeGroupId = currentFleet.battleGroups.length > 0 ? currentFleet.battleGroups[0].id : null;
      }
      saveFleets();
      scheduleRender(renderGroupsNav, renderActiveGroup, updatePoints);
    });
  }

  // Duplicate a whole group — ships, loadouts, systems, features and quantity —
  // as a fresh group right after the original. A big time-saver for repeated
  // builds (especially Payload-heavy Resistance lists). Honours the same
  // Unique/Rare/Colossal/group-count limits as creating a group from scratch.
  function copyGroup(gid) {
    if (!currentFleet) return;
    const idx = currentFleet.battleGroups.findIndex(g => g.id === gid);
    if (idx < 0) return;
    const g = currentFleet.battleGroups[idx];
    const s = g.ships[0];
    if (!s) return;
    const dbShip = findShipInDB(currentFleet.faction, s.groupCategory, s.shipKey);
    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const isPayload = s.groupCategory === 'payload';

    // Group-count limit (payloads don't count toward it).
    if (!isPayload && countableGroups(currentFleet).length >= sizeInfo.groups) {
      showToast('Maximum groups reached for ' + sizeInfo.label);
      return;
    }
    if (dbShip && dbShip.isUnique) {
      showToast(`${dbShip.name} is Unique, only 1 group allowed`);
      return;
    }
    if (dbShip && dbShip.isRare) {
      const rareMax = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 }[currentFleet.gameSize] || 2;
      const existing = currentFleet.battleGroups.filter(x =>
        x.ships.length > 0 && x.ships[0].shipKey === s.shipKey && x.ships[0].groupCategory === s.groupCategory).length;
      if (existing >= rareMax) {
        showToast(`${dbShip.name} is Rare, max ${rareMax} group${rareMax > 1 ? 's' : ''} at ${sizeInfo.label}`);
        return;
      }
    }
    if (s.groupCategory === 'colossal') {
      const colossalMax = sizeInfo.colossalMax ?? 0;
      const existing = currentFleet.battleGroups.filter(x =>
        x.ships.length > 0 && x.ships[0].groupCategory === 'colossal').length;
      if (existing >= colossalMax) {
        showToast(`${sizeInfo.label} allows max ${colossalMax} Colossal group${colossalMax !== 1 ? 's' : ''}`);
        return;
      }
    }

    const clone = JSON.parse(JSON.stringify(g));
    clone.id = uuid();
    clone.ships = clone.ships.map(sh => ({ ...sh, id: uuid() }));
    clone.name = `${g.name} (copy)`;
    currentFleet.battleGroups.splice(idx + 1, 0, clone);
    activeGroupId = clone.id;
    saveFleets();
    scheduleRender(renderGroupsNav, renderActiveGroup, updatePoints);
    showToast(`Copied ${g.name}`);
  }

  function moveGroup(gid, direction) {
    if (!currentFleet) return;
    const groups = currentFleet.battleGroups;
    const idx = groups.findIndex(g => g.id === gid);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= groups.length) return;
    // Swap
    [groups[idx], groups[newIdx]] = [groups[newIdx], groups[idx]];
    saveFleets();
    renderGroupsNav();
  }

  function editFleetName() {
    if (!currentFleet) return;
    const nameEl = document.getElementById('builder-fleet-name');
    const current = currentFleet.name;

    // Replace the name display with an inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'fleet-name-input';
    input.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:3px;padding:2px 6px;width:100%;outline:none;';
    nameEl.textContent = '';
    nameEl.appendChild(input);
    nameEl.onclick = null;
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim();
      if (val && val !== current) {
        currentFleet.name = val;
        saveFleets();
        document.getElementById('topbar-context').innerHTML = `<a href="#fleets" class="topbar-back" onclick="App.navigate('fleets'); return false;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L4 8l6 6"/></svg></a> ${esc(val)}`;
        showToast('Fleet renamed');
      }
      nameEl.textContent = currentFleet.name;
      nameEl.onclick = () => editFleetName();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
  }

  // Inline-rename a battlegroup. `el` is the name element clicked (overview card,
  // sidebar nav, or detail header title); it's swapped for an input and the whole
  // builder re-renders on commit so the new name shows everywhere it appears.
  function editGroupName(groupId, el) {
    if (!currentFleet || !el) return;
    const group = (currentFleet.battleGroups || []).find(g => g.id === groupId);
    if (!group) return;
    const current = group.name || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 40;
    input.className = 'group-name-input';
    input.setAttribute('aria-label', 'Battlegroup name');
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();
    let handled = false;
    const finish = (save) => {
      if (handled) return;
      handled = true;
      const val = input.value.trim();
      if (save && val && val !== current) {
        group.name = val;
        saveFleets();
        showToast('Battlegroup renamed');
      }
      renderBuilder();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      e.stopPropagation();
    });
    input.addEventListener('click', e => e.stopPropagation());
  }

  // ── Fleet Overview ──
  function renderFleetOverview() {
    const f = currentFleet;
    const pts = calcFleetPoints(f);
    const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const fName = (factionData[f.faction] || {}).name || f.faction.toUpperCase();
    const warnings = validateFleet(f);
    const errors = warnings.filter(w => w.type === 'error');
    const notes = warnings.filter(w => w.type === 'warn');
    const fIcon = FACTION_ICONS[f.faction];

    // Group cards — sorted by tonnage category then rendered with section dividers
    const catOrder = { colossal: 0, heavy: 1, medium: 2, light: 3, payload: 4 };
    const sortedGroups = [...f.battleGroups].sort((a, b) => {
      const aCat = a.ships.length > 0 ? (a.ships[0].groupCategory || 'medium') : 'medium';
      const bCat = b.ships.length > 0 ? (b.ships[0].groupCategory || 'medium') : 'medium';
      return (catOrder[aCat] ?? 5) - (catOrder[bCat] ?? 5);
    });
    let lastCat = null;
    const groupCards = sortedGroups.map(g => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      const shipNames = [];
      const shipCounts = {};
      g.ships.forEach(s => {
        const db = findShipInDB(f.faction, s.groupCategory, s.shipKey);
        const n = db ? db.name : s.shipKey;
        shipCounts[n] = (shipCounts[n] || 0) + 1;
      });
      Object.entries(shipCounts).forEach(([n, c]) => {
        shipNames.push(c > 1 ? `${c}× ${n}` : n);
      });
      const shipsLine = shipNames.join(', ');
      const cat = g.ships.length > 0 ? (g.ships[0].groupCategory || 'medium') : 'medium';
      const catLabel = CATEGORY_LABELS[cat] || cat;
      const firstShip = g.ships[0];
      const firstDbForArt = firstShip ? findShipInDB(f.faction, firstShip.groupCategory, firstShip.shipKey) : null;
      const artSrc = firstDbForArt ? shipArtPath(firstDbForArt.name) : null;
      const artModularClass = isFullyModular(firstDbForArt) ? ' ship-img-modular' : '';

      const catColor = { light: '#2f6ba0', medium: '#2f7a3a', heavy: '#8a5e10', colossal: '#b83828', payload: '#6a4c9c' }[cat] || 'var(--navy)';

      // Inline quantity stepper — a group IS "×N of one ship", so editing the
      // count must happen right here without opening the detail panel.
      // stopPropagation keeps the card's selectGroup click from firing too.
      const gMin = firstDbForArt ? (firstDbForArt.groupMin || 1) : 1;
      // Payloads (Bioficer Cells) have no group size — you take as many as you
      // like, so they get a stepper that grows without limit instead of spamming
      // the list with identical 1-ship groups.
      const isPayloadCat = cat === 'payload';
      const gMax = isPayloadCat ? Infinity : (firstDbForArt ? (firstDbForArt.groupMax || 1) : 1);
      const qty = g.ships.length;
      const shipName = firstDbForArt ? firstDbForArt.name : g.name;
      // A group's size is adjustable only when the ship's min and max differ.
      // Fixed-size groups (gMin === gMax) get no stepper — just a static ×N when
      // they hold more than one (removal is via the group's Remove button).
      const stepperHtml = gMax > gMin
        ? `<div class="overview-group-stepper" onclick="event.stopPropagation()">
            <button class="ovg-step${qty <= gMin ? ' ovg-step-remove' : ''}" onclick="event.stopPropagation();App.removeLastShip('${g.id}')" aria-label="${qty <= gMin ? 'Remove group' : 'Remove one ' + esc(shipName)}">&minus;</button>
            <span class="ovg-qty" aria-label="${qty} ${esc(shipName)} in group">${qty}</span>
            <button class="ovg-step" onclick="event.stopPropagation();App.addSameShip('${g.id}')" ${qty >= gMax ? 'disabled' : ''} aria-label="Add one ${esc(shipName)}">+</button>
          </div>`
        : (qty > 1 ? `<div class="overview-group-stepper overview-group-stepper-static"><span class="ovg-qty">×${qty}</span></div>` : '');

      // Validation status for this group
      const gErrors = validateGroupSize(g, f);
      const gErrorDot = gErrors.length > 0
        ? `<span class="overview-group-error" title="${esc(gErrors[0])}">${esc(gErrors[0])}</span>`
        : '';

      // Count groups in this category for the section header
      const catCount = sortedGroups.filter(sg => {
        const sc = sg.ships.length > 0 ? (sg.ships[0].groupCategory || 'medium') : 'medium';
        return sc === cat;
      }).length;
      const catSectionPts = sortedGroups.filter(sg => {
        const sc = sg.ships.length > 0 ? (sg.ships[0].groupCategory || 'medium') : 'medium';
        return sc === cat;
      }).reduce((t, sg) => t + sg.ships.reduce((st, s) => st + (s.points || 0), 0), 0);

      // Insert section divider when tonnage category changes
      const sectionDivider = cat !== lastCat
        ? `<div class="overview-cat-divider" style="--cat-color:${catColor}">
            <span class="overview-cat-label">${esc(catLabel)}</span>
            <span class="overview-cat-count">${catCount} group${catCount !== 1 ? 's' : ''}, ${catSectionPts} pts</span>
          </div>`
        : '';
      lastCat = cat;

      return `${sectionDivider}<div class="overview-group-card card-deco" onclick="App.selectGroup('${g.id}')" role="button" tabindex="0" aria-label="${esc(g.name)}, ${esc(catLabel)}, ${gPts} points" style="cursor:pointer;border-left-color:${catColor}">
        <div class="overview-group-top">
          ${artSrc ? `<div class="overview-group-art${artModularClass}"><img src="${thumbUrl(artSrc)}" alt="" onerror="this.closest('.overview-group-art').remove()"></div>` : ''}
          <div class="overview-group-info">
            <div class="overview-group-name group-name-editable" onclick="event.stopPropagation(); App.editGroupName('${g.id}', this)" role="button" tabindex="0" title="Click to rename battlegroup">${esc(g.name)}</div>
            <div class="overview-group-meta">
              <span class="ship-tonnage-label ship-tonnage-${cat}" style="font-size: 12px;padding:1px 6px">${esc(catLabel)}</span>
              <span class="text-caption">${g.ships.length} ship${g.ships.length !== 1 ? 's' : ''}</span>
            </div>
            ${shipsLine && shipsLine !== g.name ? `<div class="overview-group-ships">${esc(shipsLine)}</div>` : ''}
            ${gErrorDot}
          </div>
          <div class="overview-group-right">
            <div class="overview-group-actions">
              <button class="overview-group-copy" onclick="event.stopPropagation(); App.copyGroup('${g.id}')" aria-label="Duplicate ${esc(g.name)}" title="Duplicate group"><svg width="19" height="19" viewBox="0 0 16 16"><g fill="currentColor"><path d="M4 9a3 3 0 0 0 3 3h4v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1z"/><path d="M13 1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zM9 5H7v2h2v2h2V7h2V5h-2V3H9z"/></g></svg></button>
              <button class="overview-group-remove" onclick="event.stopPropagation(); App.removeGroup('${g.id}')" aria-label="Remove ${esc(g.name)}" title="Remove group"><svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
            </div>
            <div class="overview-group-pts">${gPts} pts</div>
            ${stepperHtml}
          </div>
        </div>
      </div>`;
    }).join('');

    // Famous admirals fly their own flagship — a ship on the table, so it shows
    // among the groups. Sourced from the admiral; its cost is already in the
    // admiral's points (no separate pts here → no double-count). Read-only —
    // managed via the admiral slot.
    const flagshipCatColor = { light: '#2f6ba0', medium: '#2f7a3a', heavy: '#8a5e10', colossal: '#b83828', payload: '#6a4c9c' };
    const flagshipCards = (f.admirals || []).map((a, ai) => {
      if (a.type !== 'Famous' || !a.shipKey) return '';
      const fs = shipDB[f.faction]?.groups?.famous_admirals?.ships?.[a.shipKey];
      if (!fs) return '';
      const name = fs.ship_name || fs.className || 'Ship';
      const cat = fs.shipCategory || 'medium';
      const catLabel = CATEGORY_LABELS[cat] || cat;
      const catColor = flagshipCatColor[cat] || 'var(--navy)';
      const artSrc = fs.image || null;
      return `<div class="overview-group-card card-deco overview-flagship-card overview-flagship-clickable" style="border-left-color:${catColor}" title="${esc(name)} flies ${esc(a.name)}. Click to open its datasheet" onclick="App.selectFlagship(${ai})" role="button" tabindex="0">
        <div class="overview-group-top">
          ${artSrc ? `<div class="overview-group-art"><img src="${esc(thumbUrl(artSrc))}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
          <div class="overview-group-info">
            <div class="overview-group-name">${esc(name)}</div>
            <div class="overview-group-meta">
              <span class="ship-tonnage-label ship-tonnage-${cat}" style="font-size: 12px;padding:1px 6px">${esc(catLabel)}</span>
              <span class="text-caption">flies with ${esc(a.name)}</span>
            </div>
          </div>
          <div class="overview-group-right">
            <div class="overview-group-pts overview-flagship-pts">incl.</div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Admirals + Station now render via renderAdmiralSlot / renderStationSlot
    // into the #admiral-slot / #station-slot containers in the sections below.

    // Secondary Objectives — pick 2 for your game (picked in a modal, like
    // admiral/station). The overview shows just the chosen ones + an edit button.
    let secondaryHtml = '';
    const secObjs = (rawFleetData && rawFleetData.secondaryObjectives) || [];
    if (secObjs.length) {
      const sel = f.secondaryObjectives || [];
      const chosen = secObjs.filter(o => sel.includes(o.name));
      secondaryHtml = `<div class="overview-section">
        <div class="overview-section-head">
          <div class="overview-section-label">Secondary Objectives</div>
          <button class="overview-add-group-btn" onclick="App.openSecondaryModal()">${sel.length ? 'Edit' : 'Choose 2'} ›</button>
        </div>
        ${chosen.length
          ? `<div class="overview-secondary-chosen">${chosen.map(o => `<span class="secondary-chip">${esc(o.name)}</span>`).join('')}</div>`
          : ''}
      </div>`;
    }

    // Validation summary is tucked into the legal mark's tooltip (hover to read
    // the full alerts), not shown as standalone lines. Errors first, then notes.
    const warnTitle = warnings.length
      ? [...errors, ...notes].map(w => w.msg).join('\n')
      : 'Legal fleet, ready to play';
    // Visible alert panel (not just the legal-mark tooltip) — errors were too easy
    // to miss. Errors (red) first, then soft notes (amber); each on its own line.
    const validHtml = warnings.length
      ? `<div class="overview-alerts ${errors.length ? 'has-errors' : 'has-warns'}">
          <div class="overview-alerts-head">${errors.length ? `<span class="overview-alerts-dot err"></span>${errors.length} issue${errors.length !== 1 ? 's' : ''} to fix` : `<span class="overview-alerts-dot warn"></span>${notes.length} note${notes.length !== 1 ? 's' : ''}`}</div>
          <ul class="overview-alerts-list">${[...errors, ...notes].map(w => `<li class="oa-${w.type}">${esc(w.msg)}</li>`).join('')}</ul>
        </div>`
      : '';

    return `
      <div class="fleet-overview">
        <div class="overview-header">
          <div class="overview-header-left">
            ${fIcon ? `<img src="${fIcon}" alt="" class="overview-faction-icon">` : ''}
            <div>
              <div class="overview-pts-line"><span class="overview-pts-big">${pts}</span><span class="overview-pts-cap">/ <input class="overview-pts-cap-input" type="number" min="0" step="50" value="${effMax(f) !== 99999 ? effMax(f) : ''}" placeholder="∞" title="Set a custom points limit" aria-label="Points limit" onclick="event.stopPropagation()" onchange="App.setCustomMax(this.value)"> pts${isCustomMax(f) ? ` <button class="overview-pts-reset" title="Reset to ${esc(sizeInfo.label)} default (${sizeInfo.max})" onclick="App.setCustomMax('')">&#8635;</button>` : ''}</span></div>
            </div>
          </div>
          <div class="overview-header-right">
            ${warnings.length === 0
              ? `<span class="overview-legal-check" title="${esc(warnTitle)}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M6.3 10.3 8.8 12.8 13.7 7.2"/></svg></span>`
              : `<span class="overview-legal-check is-illegal" title="${esc(warnTitle)}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="5.6" x2="10" y2="10.6"/><circle cx="10" cy="13.9" r="0.95" fill="currentColor" stroke="none"/></svg></span>`}
            ${effMax(f) !== 99999 ? (pts > effMax(f) ? `<span class="overview-legal-pill is-illegal">${pts - effMax(f)} pts over</span>` : `<span class="overview-legal-pill is-ok">${effMax(f) - pts} pts left</span>`) : ''}
          </div>
        </div>
        <div class="overview-desc" onclick="this.querySelector('.overview-desc-input')?.focus()">
          <textarea class="overview-desc-input" placeholder="Add fleet notes..." rows="2" onblur="App.saveFleetDesc(this.value)" onkeydown="if(event.key==='Escape'){this.blur()}">${esc(f.description || '')}</textarea>
        </div>
        ${validHtml}
        <div class="overview-section">
          <div class="overview-section-head">
            <div class="overview-section-label">Battle Groups (${f.battleGroups.length})</div>
            <button class="overview-add-group-btn" onclick="App.addGroup()" aria-label="Add a battle group"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> Add Group</button>
          </div>
          <div class="overview-groups">${groupCards + flagshipCards}</div>
          <div class="add-ship-area add-group-cta" onclick="App.addGroup()" role="button" tabindex="0" aria-label="Add a battle group" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.addGroup()}">
            <span style="font-size:var(--text-sm);font-weight:var(--weight-semibold)"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px"><path d="M8 3v10M3 8h10"/></svg> Add Group</span>
          </div>
        </div>
        <div class="overview-section">
          <div class="overview-section-head">
            <div class="overview-section-label">Space Station</div>
          </div>
          <div id="station-slot"></div>
        </div>
        ${secondaryHtml}
      </div>`;
  }

  function saveFleetDesc(val) {
    if (!currentFleet) return;
    currentFleet.description = val.trim();
    saveFleets();
  }

  function toggleSecondaryObjective(idx) {
    if (!currentFleet) return;
    const objs = (rawFleetData && rawFleetData.secondaryObjectives) || [];
    const obj = objs[idx];
    if (!obj) return;
    currentFleet.secondaryObjectives = currentFleet.secondaryObjectives || [];
    const i = currentFleet.secondaryObjectives.indexOf(obj.name);
    if (i >= 0) currentFleet.secondaryObjectives.splice(i, 1);
    else {
      // Pick up to 2. When two are already chosen, swap out the oldest rather than
      // forcing the player to deselect one first (no "click off then on" dance).
      if (currentFleet.secondaryObjectives.length >= 2) currentFleet.secondaryObjectives.shift();
      currentFleet.secondaryObjectives.push(obj.name);
    }
    saveFleets();
    renderOverviewPanel();
    const modal = document.getElementById('modal-secondary');
    if (modal && modal.classList.contains('active')) renderSecondaryModalBody();
  }

  function renderSecondaryModalBody() {
    if (!currentFleet) return;
    const secObjs = (rawFleetData && rawFleetData.secondaryObjectives) || [];
    const sel = currentFleet.secondaryObjectives || [];
    const sub = document.getElementById('secondary-modal-sub');
    if (sub) sub.textContent = sel.length >= 2 ? 'Both chosen. Tap another to swap it in, or tap a chosen one to drop it.' : `Pick ${2 - sel.length} more, choose 2 for your game.`;
    const doneBtn = document.getElementById('secondary-done-btn');
    if (doneBtn) doneBtn.textContent = `Done (${Math.min(sel.length, 2)}/2)`;
    const body = document.getElementById('secondary-modal-body');
    if (body) body.innerHTML = `<div class="secondary-list">${secObjs.map((o, i) => {
      const on = sel.includes(o.name);
      const locked = !on && sel.length >= 2;
      return `<div class="secondary-item${on ? ' selected' : ''}${locked ? ' locked' : ''}" onclick="App.toggleSecondaryObjective(${i})" role="button" tabindex="0" aria-pressed="${on}">
        <span class="secondary-check">${on ? CHECK_SVG : ''}</span>
        <div class="secondary-body">
          <div class="secondary-name">${esc(o.name)}</div>
          <div class="secondary-desc">${esc(o.description)}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function openSecondaryModal() {
    if (!currentFleet) return;
    renderSecondaryModalBody();
    openModal('modal-secondary');
  }

  // ── Active Group View ──
  // Full render of both centre + right panels. Use the narrower
  // renderOverviewPanel / renderDetailPanel when only one side changed —
  // notably group selection, which must NOT rebuild the overview.
  function renderActiveGroup() {
    renderOverviewPanel();
    renderDetailPanel();
  }

  function renderOverviewPanel() {
    if (!currentFleet) return;
    const overviewEl = document.getElementById('builder-overview');
    if (overviewEl) {
      overviewEl.innerHTML = renderFleetOverview();
      // Admiral + Station now live in the overview (moved out of the sidebar);
      // their slot containers are recreated by the innerHTML above, so fill them.
      renderAdmiralSlot();
      renderStationSlot();
    }
  }

  function renderDetailPanel() {
    const detailEl = document.getElementById('builder-detail');
    if (!currentFleet || !detailEl) return;

    // A famous admiral's flagship selected from the overview shows here, exactly
    // like a normal battlegroup (its full datasheet in the detail panel).
    if (activeFlagship != null) {
      const fa = (currentFleet.admirals || [])[activeFlagship];
      const fdb = fa && fa.shipKey ? findShipInDB(currentFleet.faction, 'famous_admirals', fa.shipKey) : null;
      if (fa && fdb) {
        detailEl.classList.remove('hidden');
        detailEl.innerHTML = renderFlagshipDetail(activeFlagship, fa, fdb);
        return;
      }
      activeFlagship = null;
    }

    // Detail panel: show when a group is selected
    if (!activeGroupId) {
      detailEl.classList.add('hidden');
      return;
    }

    const group = currentFleet.battleGroups.find(g => g.id === activeGroupId);
    if (!group || !group.ships || group.ships.length === 0) {
      detailEl.classList.add('hidden');
      return;
    }

    detailEl.classList.remove('hidden');

    const groupPts = group.ships.reduce((t, s) => t + (s.points || 0), 0);

    // First-ship facts for the header (a group is one ship profile, so the
    // header is the single authoritative title — name/tonnage/badges live here,
    // not repeated on the card body below).
    let tonnageBadge = '';
    let headerBadges = '';
    let titleHtml = `<h2 class="group-title" id="detail-group-title">${esc(group.name)}</h2>`;
    if (group.ships.length > 0) {
      const fs0 = group.ships[0];
      const firstDb = findShipInDB(currentFleet.faction, fs0.groupCategory, fs0.shipKey);
      const ton = firstDb ? (firstDb.tonnage || '') : '';
      if (ton) {
        const tonClass = ton.toLowerCase().replace(/\s+/g, '-');
        tonnageBadge = `<span class="badge badge-tonnage badge-tonnage-${tonClass}">${esc(tonLabel(ton))}</span>`;
      }
      if (firstDb) {
        if (firstDb.isUnique) headerBadges += '<span class="ship-badge ship-badge-unique">Unique</span>';
        else if (firstDb.isRare) headerBadges += '<span class="ship-badge ship-badge-rare">Rare</span>';
        const gmin = firstDb.groupMin || 1, gmax = firstDb.groupMax || 1;
        if (gmax > 1) headerBadges += `<span class="ship-badge ship-badge-group">${gmin}–${gmax}</span>`;
        titleHtml = `<h2 class="group-title ship-card-name-link" id="detail-group-title" onclick="App.openShipDetail('${currentFleet.faction}','${fs0.groupCategory}','${fs0.shipKey}')">${esc(group.name)}</h2>`;
      }
    }

    // Check for group-level validation errors
    let groupWarnings = '';
    const groupErrors = validateGroupSize(group, currentFleet);
    if (groupErrors.length > 0) {
      groupWarnings = `<div class="group-warnings">${groupErrors.map(e =>
        `<div class="group-warning-item">${esc(e)}</div>`
      ).join('')}</div>`;
    }

    // Fleet budget context
    const fleetPts = calcFleetPoints(currentFleet);
    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const remaining = effMax(currentFleet) - fleetPts;
    const budgetClass = remaining < 0 ? 'budget-over' : remaining < 50 ? 'budget-tight' : '';

    // Quantity stepper (shown in the header's upper-right, under Remove) — only
    // when the ship's group size can actually vary.
    let qtyStepper = '';
    if (group.ships.length > 0) {
      const firstShip = group.ships[0];
      const dbFirst = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
      const groupMax = dbFirst ? (dbFirst.groupMax || 12) : 12;
      const groupMin = dbFirst ? (dbFirst.groupMin || 1) : 1;
      if (groupMax > groupMin) {
        const atMax = group.ships.length >= groupMax;
        const atMin = group.ships.length <= groupMin;
        qtyStepper = `
        <div class="group-qty-stepper" title="${groupMin}–${groupMax} per group">
          <button class="group-qty-btn" onclick="App.removeLastShip('${group.id}')" ${atMin ? 'disabled' : ''} aria-label="Remove one">−</button>
          <span class="group-qty-num">×${group.ships.length}</span>
          <button class="group-qty-btn" onclick="App.addSameShip('${group.id}')" ${atMax ? 'disabled' : ''} aria-label="Add one more">+</button>
        </div>`;
      }
    }

    let html = `
    <button class="detail-back mobile-only" onclick="App.selectGroup('${group.id}')">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L4 8l6 6"/></svg> Back to fleet
    </button>
    <div class="group-header-bar">
      <div class="flex items-center gap-md flex-wrap">
        ${titleHtml}
        <button class="group-rename-btn" onclick="App.editGroupName('${group.id}', document.getElementById('detail-group-title'))" title="Rename battlegroup" aria-label="Rename battlegroup"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10z"/></svg></button>
        ${headerBadges}
        ${tonnageBadge}
        <span class="badge badge-navy">${groupPts} pts</span>
      </div>
      <div class="group-header-actions">
        <button class="btn btn-danger btn-sm" onclick="App.removeGroup('${group.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
        ${qtyStepper}
      </div>
    </div>
    ${groupWarnings}`;

    if (group.ships.length > 0) {
      html += '<div class="group-ships-list">';
      // Collapse identical ships (same loadout selection) into a single card
      // with a ×N count instead of repeating the whole card per copy.
      const sigOrder = [];
      const sigGroups = {};
      group.ships.forEach(ship => {
        const sig = JSON.stringify(ship.loadouts || {});
        if (!sigGroups[sig]) { sigGroups[sig] = []; sigOrder.push(sig); }
        sigGroups[sig].push(ship);
      });
      sigOrder.forEach(sig => {
        const ships = sigGroups[sig];
        const rep = ships[0];
        const dbShip = findShipInDB(currentFleet.faction, rep.groupCategory, rep.shipKey);
        html += renderGroupShipEntry(rep, dbShip, group.id, ships.length);
      });
      html += '</div>';
      // Quantity controls now live in the header's upper-right (group-qty-stepper).
      // (Launch Asset Reference renders inline on each ship card.)
    }

    detailEl.innerHTML = html;
  }

  function renderWeaponHeader(omitName) {
    return `<div class="weapon-row weapon-row-header">
      ${omitName === true ? '' : '<span class="weapon-col weapon-col-name">Weapon</span>'}
      <span class="weapon-col weapon-col-arc">Arc</span>
      <span class="weapon-col weapon-col-att">Att</span>
      <span class="weapon-col weapon-col-lock">Lk</span>
      <span class="weapon-col weapon-col-dmg">Dmg</span>
      <span class="weapon-col weapon-col-special">Special</span>
    </div>`;
  }

  const WEAPON_TYPE_LABELS = { K: 'Kinetic', E: 'Energy', C: 'Core' };

  const WEAPON_TYPE_ICONS = {
    // Kinetic = the proper kinetic-impact glyph (never a star), supplied by Jet.
    K: '<svg width="14" height="14" viewBox="0 0 32 32" fill="#0057A3" aria-label="Kinetic"><path d="M30.83 30.773c-0.233 0.070-0.349-0.045-0.473-0.103-3.406-1.623-6.832-3.204-10.115-5.071-0.091-0.052-0.204-0.108-0.32-0.157l-0.023-0.009c-0.559-0.237-0.816-0.158-1.126 0.378-0.126 0.221-0.261 0.494-0.381 0.774l-0.022 0.057c-0.74 1.654-1.474 3.312-2.218 4.966-0.057 0.127-0.080 0.284-0.251 0.391-0.273-0.571-0.546-1.131-0.809-1.695q-0.958-2.044-1.913-4.091c-0.085-0.19-0.169-0.347-0.263-0.498l0.010 0.018c-0.263-0.417-0.558-0.517-1.019-0.334-0.212 0.095-0.387 0.187-0.555 0.288l0.023-0.013c-3.301 1.791-6.633 3.523-9.956 5.261-0.063 0.052-0.145 0.083-0.234 0.083-0.010 0-0.021-0-0.031-0.001l0.001 0c-0.121-0.129 0.028-0.23 0.072-0.328 1.607-3.452 3.185-6.92 5.092-10.223 0.045-0.079 0.090-0.158 0.127-0.241 0.29-0.655 0.116-1.128-0.546-1.42-0.614-0.27-1.242-0.508-1.856-0.785-1.351-0.608-2.697-1.238-4.045-1.859 0.062-0.218 0.249-0.226 0.387-0.292q2.621-1.253 5.259-2.493c0.082-0.039 0.166-0.074 0.247-0.109 0.805-0.399 0.914-0.724 0.476-1.506-1.044-1.879-2.038-3.776-3.025-5.675q-1.168-2.244-2.322-4.497c-0.052-0.102-0.166-0.194-0.12-0.337 0.166-0.076 0.282 0.050 0.402 0.109 3.435 1.643 6.88 3.268 10.206 5.132 0.015 0.009 0.028 0.022 0.045 0.031 0.848 0.455 1.158 0.359 1.565-0.531 0.835-1.83 1.658-3.668 2.486-5.502 0.073-0.161 0.102-0.348 0.293-0.494 0.347 0.764 0.689 1.512 1.026 2.263q0.793 1.762 1.579 3.526c0.029 0.067 0.059 0.133 0.090 0.199 0.429 0.914 0.764 1.024 1.659 0.52 3.286-1.856 6.661-3.544 10.026-5.251 0.091-0.046 0.175-0.129 0.299-0.109 0.073 0.161-0.053 0.275-0.109 0.394-1.604 3.434-3.193 6.88-5.051 10.185-0.009 0.016-0.022 0.030-0.029 0.046-0.442 0.835-0.358 1.136 0.507 1.529 1.849 0.842 3.664 1.754 5.485 2.652l0.302 0.156c-0.074 0.204-0.278 0.212-0.427 0.278-1.719 0.775-3.443 1.54-5.164 2.31-1.092 0.488-1.192 0.794-0.608 1.826 1.896 3.352 3.598 6.8 5.346 10.251zM7.572 7.754c-0.016-0.050-0.055-0.091-0.094-0.046s0.007 0.074 0.056 0.082c0.048 0.312 0.236 0.566 0.376 0.835 0.954 1.856 1.92 3.698 2.887 5.556-1.27 0.604-2.537 1.208-3.858 1.838 1.31 0.681 2.602 1.239 3.88 1.821-1.192 2.14-2.203 4.307-3.167 6.494l0.095 0.079c2.1-1.104 4.2-2.207 6.321-3.323l1.866 3.943 1.78-3.957c2.146 1.179 4.311 2.206 6.544 3.218-0.012-0.071-0.027-0.133-0.045-0.193l0.003 0.010c-0.988-1.981-1.973-3.962-3.040-5.897-0.218-0.398-0.218-0.399 0.211-0.592 0.828-0.369 1.659-0.733 2.484-1.107 0.287-0.131 0.596-0.218 0.915-0.463l-3.81-1.876q1.778-3.23 3.267-6.574c-2.218 1.052-4.383 2.141-6.536 3.336l-1.823-4.040c-0.624 1.377-1.22 2.691-1.824 4.024-1.92-1.064-3.853-1.983-5.788-2.893-0.227-0.104-0.439-0.259-0.701-0.276z"/><path d="M15.906 12.777c1.75 0.009 3.165 1.43 3.165 3.181 0 1.757-1.424 3.181-3.181 3.181s-3.181-1.424-3.181-3.181c0-0 0-0.001 0-0.001v0c0.006-1.758 1.432-3.18 3.191-3.18 0.002 0 0.005 0 0.007 0h-0zM16.799 15.935c-0.012-0.483-0.406-0.871-0.891-0.871-0.492 0-0.891 0.399-0.891 0.891 0 0.007 0 0.015 0 0.022l-0-0.001c0.019 0.48 0.413 0.863 0.896 0.863 0.015 0 0.030-0 0.044-0.001l-0.002 0c0.473-0.034 0.844-0.426 0.844-0.905 0 0 0-0 0-0v0z"/></svg>',
    E: '<svg width="14" height="14" viewBox="0 0 16 16" fill="#92400E"><path d="M9 1L4 8h4l-1 7 6-8H9l1-6z"/></svg>',
    C: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#c43c2f" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/></svg>'
  };

  // Launch-asset TYPE icons for the picker cards, so you can tell at a glance what a
  // ship can launch (fighters, fire ships, mines, dropships/landers, torpedoes, or
  // something else). Detection is by the load name.
  const LAUNCH_TYPE_DEFS = [
    { key: 'fighters', re: /fighter|bomber/i, label: 'Fighters / Bombers',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l5.5 13L8 11l-5.5 3z"/></svg>' },
    { key: 'fireships', re: /fire\s*ship/i, label: 'Fire Ships',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.5 2.5 3.5 3.5 3.5 7a3.5 3.5 0 0 1-7 0c0-1.4.6-2.3 1.3-3 .1 1 .7 1.4 1.4 1 0-1.9-.8-3.3.8-5z"/></svg>' },
    { key: 'mines', re: /\bmine/i, label: 'Mines',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.6v2.3M8 12.1v2.3M1.6 8h2.3M12.1 8h2.3M3.4 3.4l1.6 1.6M11 11l1.6 1.6M12.6 3.4 11 5M5 11l-1.6 1.6"/></g></svg>' },
    { key: 'dropships', re: /dropship|drop\s*pod|bulk\s*lander/i, label: 'Dropships / Landers',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v8M4.5 6.5L8 10l3.5-3.5M2.5 14h11"/></svg>' },
    { key: 'torpedoes', re: /torpedo|boarding\s*pod/i, label: 'Torpedoes / Boarding Pods',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="6" width="9" height="4" rx="2"/><path d="M10.5 8l4-2.2v4.4z"/></svg>' },
  ];
  const LAUNCH_TYPE_OTHER = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2" stroke-linecap="round"/></svg>';

  function shipLaunchIcons(dbShip, factionKey) {
    if (!dbShip) return '';
    const names = new Set();
    const add = loads => (loads || []).forEach(l => { if (l && l.name) String(l.name).split(/\s*&\s*/).forEach(p => names.add(p.trim().toLowerCase())); });
    add(dbShip.loads);
    (dbShip.loadoutOptions || []).forEach(lo => (lo.options || []).forEach(o => add(o.loads)));
    const list = systemsListFor(dbShip, factionKey);
    if (list) (list.options || []).forEach(o => add(o.loads));
    if (!names.size) return '';
    const arr = [...names];
    const icons = [];
    LAUNCH_TYPE_DEFS.forEach(t => { if (arr.some(n => t.re.test(n))) icons.push(`<span class="launch-type-icon" title="${esc(t.label)}">${t.icon}</span>`); });
    if (arr.some(n => !LAUNCH_TYPE_DEFS.some(t => t.re.test(n)))) icons.push(`<span class="launch-type-icon" title="Other launch asset">${LAUNCH_TYPE_OTHER}</span>`);
    return icons.length ? `<div class="ship-card-launch" title="Launch capability">${icons.join('')}</div>` : '';
  }

  const ARC_LABELS = {
    'B': 'Broadside (Port & Starboard)',
    'F': 'Front',
    'F/S': 'Front & Side',
    'F/S/R': 'Front, Side & Rear',
    'FN': 'Front Narrow',
    'Fn': 'Front Narrow',
    'S': 'Side',
    'SL': 'Side Left',
    'SR': 'Side Right',
    'R': 'Rear'
  };

  const ARC_ICONS = {
    'B': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,18.9A44,44 0 0,1 81.1,81.1Z" fill="currentColor"/><path d="M50,50L18.9,81.1A44,44 0 0,1 18.9,18.9Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L18.9,18.9A44,44 0 0,1 81.1,18.9Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F/S': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L18.9,81.1A44,44 0 1,1 81.1,81.1Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'F/S/R': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="currentColor" r="44"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'FN': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L28,11.9A44,44 0 0,1 72,11.9Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'Fn': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L28,11.9A44,44 0 0,1 72,11.9Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'S': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,18.9A44,44 0 0,1 81.1,81.1Z" fill="currentColor"/><path d="M50,50L18.9,81.1A44,44 0 0,1 18.9,18.9Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>',
    'R': '<svg height="14" viewBox="0 0 100 100" width="14"><circle cx="50" cy="50" fill="#FFFFFF" r="44"/><path d="M50,50L81.1,81.1A44,44 0 0,1 18.9,81.1Z" fill="currentColor"/><circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" fill="#FFFFFF" r="5" stroke="currentColor" stroke-width="1.5"/><polygon fill="currentColor" points="50,2 47,8 53,8"/></svg>'
  };

  const STAT_ICONS = {
    scan:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3,12 A9,9 0 0,1 21,12"/><path d="M7,12 A5,5 0 0,1 17,12"/><circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none"/></svg>',
    sig:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>',
    thrust: '<svg width="14" height="14" viewBox="0 0 24 24"><polygon fill="currentColor" points="4,4 20,12 4,20 8,12"/></svg>',
    hull:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>',
    es:     '<svg width="14" height="14" viewBox="0 0 16 22"><rect fill="#FAECC8" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M8,0.5 C8,0.5 0.5,3.5 0.5,3.5L0.5,10.5 C0.5,16 8,21.5 8,21.5 C8,21.5 15.5,16 15.5,10.5L15.5,3.5Z" fill="#1C1A17"/><path d="M8.5,4.5 L5,11 L7.5,11 L6,18.5 L12,9.5 L9,9.5 L11,4.5Z" fill="#FAECC8"/></svg>',
    ks:     '<svg width="14" height="14" viewBox="0 0 16 22"><rect fill="#D0E4FF" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M5.5,0 L10.5,0 L10.5,3 L5.5,3Z" fill="#1C1A17"/><path d="M3,3 C1,5 0,8 0,11L0,15 L3,15 L3,18 C3,20 5.5,21.5 8,21.5 C10.5,21.5 13,20 13,18L13,15 L16,15 L16,11 C16,8 15,5 13,3Z" fill="#1C1A17"/><rect fill="#D0E4FF" height="2" rx="0.5" width="7" x="4.5" y="10"/><rect fill="#D0E4FF" height="7" rx="0.5" width="2" x="7" y="10"/></svg>',
    bs:     '<svg width="14" height="14" viewBox="0 0 16 22"><rect fill="#E8E5DF" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M8,1 C8,1 1,4 1,4L1,11 C1,16.5 8,21 8,21 C8,21 15,16.5 15,11L15,4Z" fill="none" stroke="#1C1A17" stroke-width="1.5"/><line stroke="#1C1A17" stroke-linecap="round" stroke-width="1.2" x1="4" x2="12" y1="11" y2="11"/></svg>',
    g:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="8" r="2.5"/><circle cx="11" cy="8" r="2.5"/></svg>'
  };

  const STAT_META = {
    scan:   { label: 'Scan',   title: 'Scan range, detection distance' },
    sig:    { label: 'Sig',    title: 'Signature, how visible the ship is' },
    thrust: { label: 'Thrust', title: 'Thrust, movement speed' },
    hull:   { label: 'Hull',   title: 'Hull points, structural integrity' },
    es:     { label: 'ES',     title: 'Energy Shield, save vs Energy weapons', cssClass: 'stat-cell-es' },
    ks:     { label: 'KS',     title: 'Kinetic Shield, save vs Kinetic weapons', cssClass: 'stat-cell-ks' },
    bs:     { label: 'BS',     title: 'Backup Save, last-resort save', cssClass: 'stat-cell-bs' },
    g:      { label: 'G',      title: 'Group size, ships per battle group' }
  };

  // Adjust the numeric part of a stat value by a signed delta, keeping its suffix
  // (so "8\"" + 3 -> "11\"", a save "4+" - 1 -> "3+", "12" + 2 -> "14").
  function adjustStatValue(v, delta) {
    if (v == null) return v;
    const s = String(v);
    const m = s.match(/-?\d+/);
    if (!m) return v;
    return s.slice(0, m.index) + (parseInt(m[0], 10) + delta) + s.slice(m.index + m[0].length);
  }

  // Effective stats for a built ship: apply any selected loadout option's
  // statMods (e.g. a Drive Refit's +3" Thrust) onto the base stats. Returns
  // { stats, mods } where mods maps stat-key -> total delta, so the grid can
  // colour the cells the upgrade changed.
  function effectiveStats(dbShip, ship, factionKey) {
    const stats = Object.assign({}, dbShip);
    const mods = {};
    const apply = (sm) => {
      if (!sm) return;
      Object.entries(sm).forEach(([k, delta]) => {
        stats[k] = adjustStatValue(stats[k], delta);
        mods[k] = (mods[k] || 0) + delta;
      });
    };
    // Loadout options (either/or refits, e.g. UCM Drive Refit).
    const opts = dbShip && Array.isArray(dbShip.loadoutOptions) ? dbShip.loadoutOptions : [];
    opts.forEach((lo, i) => {
      const sel = ship && ship.loadouts ? ship.loadouts[i] : undefined;
      const opt = lo.options && lo.options[sel];
      if (opt) apply(opt.statMods);
    });
    // Selected system/hardpoint options (e.g. Resistance Scanner Array Scan +4").
    if (factionKey && ship && Array.isArray(ship.systems) && ship.systems.length) {
      const list = systemsListFor(dbShip, factionKey);
      if (list) ship.systems.forEach(name => { const o = findSystemOption(list, name); if (o) apply(o.statMods); });
    }
    return { stats, mods };
  }

  function renderStatGrid(ship, mods) {
    // 2-col grid, each main stat paired with a save on its row, Hull full-width:
    //   Scan | KS,  Sig | ES,  Thrust | BS,  Hull (spans both).
    // Each save is its own cell (not a combined column). `mods` (optional) marks
    // stats changed by a selected upgrade so the cell reads in the upgrade colour.
    const cell = (k, cls = '') => {
      const v = ship[k];
      if (v === undefined || v === 0) return '';
      const meta = STAT_META[k];
      let extra = meta.cssClass || '';
      if (k === 'bs' && (v === '-' || v === '--')) extra = 'stat-cell-none';
      const md = mods && mods[k];
      if (md) extra += ' stat-cell-modified';
      const icon = STAT_ICONS[k] || '';
      const title = md ? `${meta.title} (upgraded ${md > 0 ? '+' + md : md})` : meta.title;
      return `<div class="stat-cell ${extra} ${cls}" title="${title}">
        ${icon ? `<span class="stat-cell-icon">${icon}</span>` : ''}
        <span class="stat-cell-text">
          <span class="stat-cell-value">${v}</span>
          <span class="stat-cell-label">${meta.label}</span>
        </span>
      </div>`;
    };
    const cells = [
      cell('scan'), cell('ks'),
      cell('sig'),  cell('es'),
      cell('thrust'), cell('bs'),
      cell('hull', 'stat-cell-wide')
    ].filter(Boolean).join('');
    return cells ? `<div class="stat-grid">${cells}</div>` : '';
  }

  // Weapon special rules — descriptions from the rulebook
  function lookupRule(name) {
    // Shared rules lookup: try exact, then base keyword (strip numeric suffix),
    // then base-X form (BSData uses e.g. "Crippling-X" for parameterized rules)
    // Returns description string only
    const full = lookupRuleFull(name);
    return full ? full.description : '';
  }

  // Substitute the actual parameter value into a resolved "-X" rule so e.g.
  // "Reave-2" reads "...reduce ... by 2" instead of "...by X".
  function ruleWithValue(rule, val) {
    if (!rule || !val || !/\bX\b/.test(rule.description || '')) return rule;
    return { description: rule.description.replace(/\bX\b/g, val), page: rule.page };
  }
  function lookupRuleFull(name) {
    // Returns {description, page} or null. Single source of truth: the shared
    // rules glossary (data/fleet-index.json). Resolve parameterized keywords to
    // their base "-X" entry — numeric suffixes ("Reave 2") and letter/word
    // suffixes alike ("Calibre-H", "Crippling-Fire" -> "Calibre-X"/"Crippling-X")
    // — and substitute the value (2, H, …) into the description's X placeholders.
    if (sharedRulesDB[name]) return sharedRulesDB[name];
    const numM = name.match(/^(.*?)[-\s]?(\d+)$/);
    if (numM) {
      const base = numM[1].trim(), val = numM[2];
      const hit = sharedRulesDB[base] || sharedRulesDB[base + '-X'];
      if (hit) return ruleWithValue(hit, val);
    }
    const hi = name.lastIndexOf('-');
    if (hi > 0) {
      const pb = name.slice(0, hi).trim(), val = name.slice(hi + 1).trim();
      const hit = sharedRulesDB[pb] || sharedRulesDB[pb + '-X'];
      if (hit) return ruleWithValue(hit, val);
    }
    return null;
  }

  // Wrap known glossary keywords found in prose (e.g. an ability's effect) in a
  // hover/tap tooltip. Case-sensitive (keywords are Title Case in the text).
  let _kwRe = null;
  function keywordRegex() {
    if (_kwRe) return _kwRe;
    const bases = new Set();
    Object.keys(sharedRulesDB || {}).forEach(k => {
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
    return esc(text).replace(keywordRegex(), m => {
      const full = lookupRuleFull(m);
      if (full && full.description) {
        const pageAttr = full.page ? ` data-rule-page="${esc(full.page)}"` : '';
        return `<span class="kw-link has-tooltip" data-rule-desc="${esc(full.description)}"${pageAttr} onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${m}</span>`;
      }
      return m;
    });
  }

  function renderWeaponSpecialChips(specialStr) {
    if (!specialStr || specialStr === '-') return '';
    return specialStr.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      const full = lookupRuleFull(trimmed);
      if (full && full.description) {
        const pageAttr = full.page ? ` data-rule-page="${esc(full.page)}"` : '';
        return `<span class="weapon-special-chip has-tooltip" data-rule-desc="${esc(full.description)}"${pageAttr} onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(trimmed)}</span>`;
      }
      return `<span class="weapon-special-chip">${esc(trimmed)}</span>`;
    }).join('');
  }

  function renderWeaponRow(w, omitName) {
    const special = w.special && w.special !== '-' ? w.special : '';
    const typeLabel = WEAPON_TYPE_LABELS[w.type] || w.type || '?';
    // Damage carries its type as a colour-coded letter (e.g. 1E, 2K, 1C) — the
    // type is part of the damage, not a separate "special".
    const typeTag = w.type ? `<span class="dmg-type dmg-type-${esc(w.type)}">${esc(w.type)}</span>` : '';
    return `<div class="weapon-row">
      ${omitName === true ? '' : `<span class="weapon-col weapon-col-name">${esc(w.name)}</span>`}
      <span class="weapon-col weapon-col-arc" title="${ARC_LABELS[w.arc] || 'Firing Arc: ' + (w.arc || '')}">${ARC_ICONS[w.arc] ? ARC_ICONS[w.arc] + '<span class="arc-label">' + esc(w.arc || '') + '</span>' : esc(w.arc || '')}</span>
      <span class="weapon-col weapon-col-att">${w.attack}</span>
      <span class="weapon-col weapon-col-lock">${w.lock}</span>
      <span class="weapon-col weapon-col-dmg" title="${w.damage} ${typeLabel}">${w.damage}${typeTag}</span>
      ${special ? `<span class="weapon-col weapon-col-special">${renderWeaponSpecialChips(special)}</span>` : ''}
    </div>`;
  }

  // A Feature Carrier deploys one Deployable Feature chosen at fleet-build time.
  // Detected from the rules text ("choose one Deployable Feature from the
  // [Faction] Deployable Features List").
  function isFeatureCarrier(dbShip) {
    if (!dbShip) return false;
    // NB: the DB ship exposes special-rule NAMES as `special_rules` (not
    // `specialRules`). A ship may carry a Deployable Feature if its rules say so
    // OR if it has the Porter rule — Porters may take a Genitor Tower as a
    // Payload S-1 (DFC: "assigned to a Ship with the Porter special rule").
    // The Genitor Tower is specifically a Payload S-1, so only Porter S ships
    // qualify — a Porter L can't carry a size-S payload. (Hard-codes size S; the
    // only Bioficer deployable feature today is the Tower.) The porter size lives
    // in the capacity stat string `special` (e.g. "Porter S-1" / "Porter L-1").
    const ruleNames = (dbShip.special_rules || []).join(' ');
    const hay = (dbShip.rulesText || '') + ' ' + ruleNames;
    return /Deployable Feature|Feature Carrier/i.test(hay) || /Porter\s*S\b/i.test(dbShip.special || '');
  }

  // A genuine "choose one Deployable Feature" ship MUST take one; a Porter MAY.
  function featureRequired(dbShip) {
    if (!dbShip) return false;
    const ruleNames = (dbShip.special_rules || []).join(' ');
    return /Deployable Feature|Feature Carrier/i.test((dbShip.rulesText || '') + ' ' + ruleNames);
  }

  // A ship is "fully modular" when it has a Systems selection and NO fixed
  // loadout at all — no base weapons AND no base launch loads. Its entire
  // armament comes from chosen options, so the art is just a base-hull
  // placeholder (we desaturate it to make that clear). Ships with a fixed load
  // (e.g. the Strike Carrier's Dropships) or a fixed weapon (the Interstellar
  // Dreadnoughts) are NOT fully modular.
  function isFullyModular(dbShip) {
    return !!(dbShip && dbShip.systemSelection
      && (!dbShip.weapons || dbShip.weapons.length === 0)
      && (!dbShip.loads || dbShip.loads.length === 0));
  }

  function renderFeatureStats(feat) {
    if (!feat) return '';
    const statLine = (feat.features || []).map(f =>
      `<span class="station-stat">${esc(f.name)}${f.es ? ` ES ${f.es}` : ''}${f.ks ? ` KS ${f.ks}` : ''}${f.special && f.special !== '-' ? `, ${esc(f.special)}` : ''}</span>`
    ).join('');
    const ruleChips = (feat.rules || []).map(r =>
      r.description
        ? `<span class="rule-chip rule-chip-sm has-tooltip" data-rule-desc="${esc(r.description)}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r.name)}</span>`
        : `<span class="rule-chip rule-chip-sm">${esc(r.name)}</span>`
    ).join('');
    return `${statLine ? `<div class="station-stats" style="margin-top:var(--sp-xs)">${statLine}</div>` : ''}${ruleChips ? `<div style="margin-top:var(--sp-xs)">${ruleChips}</div>` : ''}`;
  }

  function renderFeatureCarrierBlock(ship, dbShip, groupId) {
    if (!isFeatureCarrier(dbShip)) return '';
    const faction = shipDB[currentFleet.faction];
    const feats = (faction && faction.deployableFeatures) || [];
    if (feats.length === 0) return '';
    const chosen = ship.feature || '';
    // Deployable Features are always optional (you can pick/swap one right before
    // the game), so the picker never marks them required.
    const label = 'Deployable Feature, optional';
    // Radio list (not a dropdown) so every option's full rules are visible while
    // choosing, rather than hidden until selected.
    const row = (value, name, cost, feat, isChosen) => {
      const costLabel = cost ? ` <span class="feature-radio-cost">+${cost} pts</span>` : '';
      const art = feat ? featureArtPath(feat.name) : null;
      return `<label class="feature-radio${isChosen ? ' selected' : ''}">
        <input type="radio" name="feat-${ship.id}"${isChosen ? ' checked' : ''} onchange="App.changeFeature('${groupId}','${ship.id}','${value.replace(/'/g, "\\'")}')">
        ${art ? `<img class="feature-radio-art" src="${art}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <span class="feature-radio-main">
          <span class="feature-radio-name">${esc(name)}${costLabel}</span>
          ${feat ? renderFeatureFullRules(feat) : ''}
        </span>
      </label>`;
    };
    // Deployable Features are always optional now, so always offer "No feature"
    // and never flag the block as unset. (Previously referenced an undefined
    // `required`, which threw and broke every Porter/feature-carrier ship.)
    const noneRow = row('', 'No feature', 0, null, chosen === '');
    const featRows = feats.map(f => row(f.name, f.name, f.cost, f, f.name === chosen)).join('');
    return `<div class="feature-carrier-block">
      <div class="feature-carrier-label">${label}</div>
      <div class="feature-radio-list">${noneRow}${featRows}</div>
    </div>`;
  }

  // Full inline rules for one Deployable Feature: stat line + every rule's verbatim
  // text (so options can be compared before picking).
  function renderFeatureFullRules(feat) {
    const statLine = (feat.features || []).map(f =>
      `<span class="station-stat">${esc(f.name)}${f.es ? ` ES ${f.es}` : ''}${f.ks ? ` KS ${f.ks}` : ''}${f.special && f.special !== '-' ? `, ${esc(f.special)}` : ''}</span>`
    ).join('');
    const rules = (feat.rules || []).map(r =>
      `<div class="feature-rule">${r.description ? `<b>${esc(r.name)}:</b> ${ruleHtml(r.description)}` : `<b>${esc(r.name)}</b>`}</div>`
    ).join('');
    return `${statLine ? `<div class="station-stats" style="margin-top:2px">${statLine}</div>` : ''}${rules}`;
  }

  // ── Systems / Hardpoint selection (Resistance Cruiser/Frigate/Dreadnought) ──
  function systemsListFor(dbShip, factionKey) {
    const sel = dbShip && dbShip.systemSelection;
    if (!sel) return null;
    const lists = (shipDB[factionKey] && shipDB[factionKey].systemsLists) || {};
    const list = lists[sel.listName];
    return (list && Array.isArray(list.options) && list.options.length) ? list : null;
  }

  function findSystemOption(list, name) {
    return list.options.find(o => o.name === name) || null;
  }

  // Selections are stored on the ship as an array of option names (repeats
  // allowed unless oncePerShip). Returns {counts, total, capUsage, byCategory}.
  function summariseSystems(ship, list, sel) {
    const counts = {};
    (ship.systems || []).forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const total = (ship.systems || []).length;
    // Cap usage: a cap key matches an option category by prefix (startsWith).
    const capUsage = {};
    Object.keys(sel.categoryCaps || {}).forEach(k => { capUsage[k] = 0; });
    // catCounts: exact per-category tallies, keyed by full category name. Drives
    // the per-tier hardpoint model (categoryReq) where each tier has its own count.
    const catCounts = {};
    (ship.systems || []).forEach(n => {
      const o = findSystemOption(list, n);
      if (!o) return;
      Object.keys(capUsage).forEach(k => { if ((o.category || '').startsWith(k)) capUsage[k]++; });
      const cat = o.category || '';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    return { counts, total, capUsage, catCounts };
  }

  function validateSystems(ship, dbShip, factionKey) {
    const sel = dbShip && dbShip.systemSelection;
    const list = systemsListFor(dbShip, factionKey);
    if (!sel || !list) return [];
    const errors = [];
    const { total, capUsage, catCounts } = summariseSystems(ship, list, sel);
    if (sel.categoryReq) {
      // Per-tier hardpoint requirements (Bioficer dreadnoughts: exactly 1
      // Secondary, exactly 2 Tertiary, up to 1 Launch). Each tier owns its count.
      Object.entries(sel.categoryReq).forEach(([cat, req]) => {
        const c = catCounts[cat] || 0;
        const min = req.min || 0, max = req.max != null ? req.max : Infinity;
        if (c < min) errors.push(`${dbShip.name}: choose ${min === max ? min : min + '+'} from ${cat} (has ${c})`);
        else if (c > max) errors.push(`${dbShip.name}: max ${max} from ${cat} (has ${c})`);
      });
      return errors;
    }
    if (sel.totalIsExact && total !== sel.totalRequired) {
      errors.push(total < sel.totalRequired
        ? `${dbShip.name}: choose ${sel.totalRequired} ${sel.listName} (has ${total})`
        : `${dbShip.name}: too many ${sel.listName}, max ${sel.totalRequired} (has ${total})`);
    } else if (!sel.totalIsExact && total > sel.totalRequired) {
      errors.push(`${dbShip.name}: max ${sel.totalRequired} ${sel.listName} (has ${total})`);
    }
    Object.entries(sel.categoryCaps || {}).forEach(([k, max]) => {
      if (capUsage[k] > max) errors.push(`${dbShip.name}: max ${max} from ${k} (has ${capUsage[k]})`);
    });
    return errors;
  }

  // True if another copy of this option can still be added right now.
  function canAddSystem(ship, dbShip, factionKey, optName) {
    const sel = dbShip.systemSelection;
    const list = systemsListFor(dbShip, factionKey);
    if (!sel || !list) return false;
    const opt = findSystemOption(list, optName);
    if (!opt) return false;
    const { counts, total, capUsage, catCounts } = summariseSystems(ship, list, sel);
    if (opt.oncePerShip && (counts[optName] || 0) >= 1) return false;
    if (sel.categoryReq) {                                   // per-tier: block at this tier's max
      const req = sel.categoryReq[opt.category || ''];
      const max = (req && req.max != null) ? req.max : 0;
      return (catCounts[opt.category || ''] || 0) < max;
    }
    if (total >= sel.totalRequired) return false;            // at the total cap
    for (const [k, max] of Object.entries(sel.categoryCaps || {})) {
      if ((opt.category || '').startsWith(k) && capUsage[k] >= max) return false;
    }
    return true;
  }

  function systemOptionSummary(opt) {
    if (opt.weapons && opt.weapons.length) {
      const w = opt.weapons[0];
      const icon = WEAPON_TYPE_ICONS[w.type] || '';
      return `<span class="sys-opt-detail">${esc(w.arc || '')} · ${esc(w.attack || '')}/${esc(w.lock || '')}/${esc(w.damage || '')}${icon}${w.special && w.special !== '-' ? ' · ' + esc(w.special) : ''}</span>`;
    }
    if (opt.loads && opt.loads.length) {
      const l = opt.loads[0];
      return `<span class="sys-opt-detail">Launch ${esc(l.launch || '')}${l.special && l.special !== '-' ? ', ' + esc(l.special) : ''}</span>`;
    }
    if (opt.effect) return `<span class="sys-opt-detail">${esc(opt.effect)}</span>`;
    return '';
  }

  function renderSystemsPicker(ship, dbShip, groupId, factionKey) {
    const sel = dbShip && dbShip.systemSelection;
    if (!sel) return '';
    const list = systemsListFor(dbShip, factionKey);
    if (!list) return '';   // option table not loaded yet, Ship Rules text still explains it

    const { counts, total, capUsage, catCounts } = summariseSystems(ship, list, sel);
    const required = sel.totalRequired;
    const req = sel.categoryReq;
    const sumMin = req ? Object.values(req).reduce((a, r) => a + (r.min || 0), 0) : 0;
    const sumMax = req ? Object.values(req).reduce((a, r) => a + (r.max != null ? r.max : 0), 0) : 0;
    const complete = req
      ? Object.entries(req).every(([cat, r]) => { const c = catCounts[cat] || 0; return c >= (r.min || 0) && c <= (r.max != null ? r.max : Infinity); })
      : (sel.totalIsExact ? total === required : total <= required);
    const headerClass = complete ? '' : ' systems-picker-incomplete';
    const reqLabel = req
      ? `${total} / ${sumMin === sumMax ? sumMax : sumMin + '-' + sumMax}`
      : (sel.totalIsExact ? `${total} / ${required}` : `${total} / up to ${required}`);

    const cats = list.categories && list.categories.length
      ? list.categories
      : [...new Set(list.options.map(o => o.category))];

    const body = cats.map(cat => {
      const opts = list.options.filter(o => o.category === cat);
      if (!opts.length) return '';
      // cap label for this category. Per-tier model shows count/need and flags
      // tiers not yet satisfied; legacy cap model shows usage against the max.
      let capNote = '';
      if (req && req[cat]) {
        const r = req[cat];
        const c = catCounts[cat] || 0;
        const lo = r.min || 0, hi = r.max != null ? r.max : Infinity;
        const need = lo === hi ? `${hi}` : `${lo}-${hi === Infinity ? '∞' : hi}`;
        const ok = c >= lo && c <= hi;
        capNote = `<span class="sys-cat-cap${ok ? '' : ' sys-cat-cap-need'}">${c}/${need}</span>`;
      } else {
        Object.entries(sel.categoryCaps || {}).forEach(([k, max]) => {
          if (cat.startsWith(k)) capNote = `<span class="sys-cat-cap">${capUsage[k]}/${max}</span>`;
        });
      }
      // Each weapon hardpoint is a two-line entry that fits the narrow detail
      // panel: name + cost + stepper on top, the weapon's stat line below (arc,
      // attack, lock, damage, special). All weapon options are single-weapon.
      const isWeaponCat = opts.every(o => o.weapons && o.weapons.length === 1);
      if (isWeaponCat) {
        const swRows = opts.map(o => {
          const c = counts[o.name] || 0;
          const canAdd = canAddSystem(ship, dbShip, factionKey, o.name);
          const w = o.weapons[0];
          const star = o.oncePerShip ? '<span class="sys-opt-star" title="Max one per ship">*</span>' : '';
          const typeTag = w.type ? `<span class="dmg-type dmg-type-${esc(w.type)}">${esc(w.type)}</span>` : '';
          const arcCell = ARC_ICONS[w.arc] ? ARC_ICONS[w.arc] + '<span class="arc-label">' + esc(w.arc || '') + '</span>' : esc(w.arc || '');
          const special = w.special && w.special !== '-' ? `<span class="hp-opt-special">${renderWeaponSpecialChips(w.special)}</span>` : '';
          return `<div class="hp-opt${c > 0 ? ' hp-opt-active' : ''}">
            <div class="hp-opt-head">
              <span class="hp-opt-name">${esc(o.name)}${star}</span>
              <span class="hp-opt-pts">${o.cost > 0 ? '+' + o.cost : o.cost} pts</span>
              <div class="sys-opt-step">
                <button class="sys-step-btn" aria-label="Remove one ${esc(o.name)}" ${c <= 0 ? 'disabled' : ''} onclick="App.removeSystem('${groupId}','${ship.id}','${esc(o.name).replace(/'/g, "\\'")}')">−</button>
                <span class="sys-opt-count" aria-label="${c} selected">${c}</span>
                <button class="sys-step-btn" aria-label="Add one ${esc(o.name)}" ${canAdd ? '' : 'disabled'} onclick="App.addSystem('${groupId}','${ship.id}','${esc(o.name).replace(/'/g, "\\'")}')">+</button>
              </div>
            </div>
            <div class="hp-opt-stat">
              <span class="hp-stat hp-stat-arc" title="${esc(ARC_LABELS[w.arc] || w.arc || '')}">${arcCell}</span>
              <span class="hp-stat"><span class="hp-stat-k">Att</span> ${esc(String(w.attack))}</span>
              <span class="hp-stat"><span class="hp-stat-k">Lock</span> ${esc(String(w.lock))}</span>
              <span class="hp-stat"><span class="hp-stat-k">Dmg</span> ${esc(String(w.damage))}${typeTag}</span>
              ${special}
            </div>
          </div>`;
        }).join('');
        return `<div class="sys-cat"><div class="sys-cat-head">${esc(cat)}${capNote}</div><div class="hp-opt-list">${swRows}</div></div>`;
      }

      const rows = opts.map(o => {
        const c = counts[o.name] || 0;
        const canAdd = canAddSystem(ship, dbShip, factionKey, o.name);
        const star = o.oncePerShip ? '<span class="sys-opt-star" title="Max one per ship">*</span>' : '';
        // Every modular option shows its FULL statblock: weapon options get the
        // weapon datasheet, launch options get the launch-asset datasheet (Fighters/
        // Bombers/Mines/Fire Ships stats), and stat-modifier/effect options keep the
        // short effect line (e.g. "Scan +4").
        const isWeapon = o.weapons && o.weapons.length;
        const isLaunch = !isWeapon && o.loads && o.loads.length;
        // The option name already heads the card, so a single-weapon datasheet
        // drops its redundant name column (and the "Weapon" header). Multi-weapon
        // options keep names so each row is identifiable.
        const omitName = isWeapon && o.weapons.length === 1;
        const summary = (isWeapon || isLaunch) ? '' : systemOptionSummary(o);
        const sheet = isWeapon
          ? `<div class="weapon-list sys-opt-sheet${omitName ? ' weapon-list-noname' : ''}">${renderWeaponHeader(omitName)}${o.weapons.map(w => renderWeaponRow(w, omitName)).join('')}</div>`
          : (isLaunch ? buildLaunchTable(factionKey, o.loads, true) : '');
        return `<div class="sys-opt${c > 0 ? ' sys-opt-active' : ''}">
          <div class="sys-opt-main">
            <span class="sys-opt-name">${esc(o.name)}${star}</span>
            ${summary}
          </div>
          <span class="sys-opt-cost">${o.cost > 0 ? '+' + o.cost : o.cost} pts</span>
          <div class="sys-opt-step">
            <button class="sys-step-btn" aria-label="Remove one ${esc(o.name)}" ${c <= 0 ? 'disabled' : ''} onclick="App.removeSystem('${groupId}','${ship.id}','${esc(o.name).replace(/'/g, "\\'")}')">−</button>
            <span class="sys-opt-count" aria-label="${c} selected">${c}</span>
            <button class="sys-step-btn" aria-label="Add one ${esc(o.name)}" ${canAdd ? '' : 'disabled'} onclick="App.addSystem('${groupId}','${ship.id}','${esc(o.name).replace(/'/g, "\\'")}')">+</button>
          </div>
          ${sheet}
        </div>`;
      }).join('');
      return `<div class="sys-cat"><div class="sys-cat-head">${esc(cat)}${capNote}</div>${rows}</div>`;
    }).join('');

    return `<div class="systems-picker${headerClass}">
      <div class="systems-picker-head">
        <span class="systems-picker-title">${esc(sel.listName)}</span>
        <span class="systems-picker-count">${reqLabel}</span>
      </div>
      ${body}
    </div>`;
  }

  // Every special rule the ship actually uses (its own + all weapon specials,
  // base and selected loadout), spelled out in full once, deduped. So the rules
  // are readable on the detail page without tapping a single chip.
  function renderShipRulesGlossary(dbShip, ship) {
    if (!dbShip) return '';
    const seen = new Map(); // name -> {description, page}
    const add = (name) => {
      const n = (name || '').trim();
      if (!n || n === '-' || n === '--' || /^(rare|unique)$/i.test(n) || seen.has(n)) return;
      const full = lookupRuleFull(n);
      if (full && full.description) seen.set(n, full);
    };
    (dbShip.specialRuleDetails || []).forEach(r => {
      if (!r || !r.name) return;
      if (r.description && !seen.has(r.name)) seen.set(r.name, { description: r.description, page: r.page || '' });
      else add(r.name);
    });
    const weapons = [...(dbShip.weapons || [])];
    (dbShip.loadoutOptions || []).forEach((lo, i) => {
      const sel = (ship && ship.loadouts && ship.loadouts[i] !== undefined) ? ship.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && opt.weapons) weapons.push(...opt.weapons);
    });
    // Selected systems/hardpoints carry their own weapons (e.g. Vent Cannon Turret).
    const glossarySysList = systemsListFor(dbShip, currentFleet && currentFleet.faction);
    if (glossarySysList && ship && Array.isArray(ship.systems)) {
      ship.systems.forEach(nm => { const o = findSystemOption(glossarySysList, nm); if (o && o.weapons) weapons.push(...o.weapons); });
    }
    let hasOvercharge = false;
    weapons.forEach(w => { if (w && w.special) { if (/\bOvercharge\b/i.test(w.special)) hasOvercharge = true; w.special.split(',').forEach(add); } });
    // Overcharging a Weapon turns it into a High Power Weapon, so spell that rule
    // out too (it is never shown as its own weapon chip).
    if (hasOvercharge) add('High Power');
    if (!seen.size) return '';
    const entries = [...seen.entries()].map(([name, full]) =>
      `<div class="detail-rule-entry"><span class="detail-rule-name">${esc(name)}${full.page ? ` <span class="detail-rule-page">p.${esc(full.page)}</span>` : ''}</span><span class="detail-rule-desc">${ruleHtml(full.description)}</span></div>`
    ).join('');
    return `<div class="ship-rules-glossary"><div class="ship-rules-block-label">Rules</div><div class="detail-rules-list">${entries}</div></div>`;
  }

  function renderGroupShipEntry(ship, dbShip, groupId, count = 1) {
    const name = dbShip ? dbShip.name : ship.shipKey;
    const img = dbShip ? dbShip.image : '';
    const tonnage = dbShip ? tonLabel(dbShip.tonnage) : '';
    const specialRules = dbShip && dbShip.special_rules ? dbShip.special_rules : [];

    const eff = dbShip ? effectiveStats(dbShip, ship, currentFleet && currentFleet.faction) : null;
    const statsHtml = dbShip ? renderStatGrid(eff.stats, eff.mods) : '';

    // Weapon table = base weapons + the weapons from the currently selected
    // loadout option(s). This shows the ship's real current guns, so swap options
    // (UCM Laser Refit) and ships whose entire armament is a loadout (the New
    // York) read correctly. Each option's own datasheet appears only on the
    // UNSELECTED option cards below (a preview), so nothing is ever listed twice.
    let weaponsHtml = '';
    const wpns = (dbShip && Array.isArray(dbShip.weapons)) ? [...dbShip.weapons] : [];
    (dbShip && Array.isArray(dbShip.loadoutOptions) ? dbShip.loadoutOptions : []).forEach((lo, i) => {
      const sel = (ship.loadouts && ship.loadouts[i] !== undefined) ? ship.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && Array.isArray(opt.weapons)) wpns.push(...opt.weapons);
    });
    if (wpns.length > 0) {
      weaponsHtml = '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
    }

    // Loadout options — an either/or weapon swap (e.g. UCM Laser Refit). Present
    // BOTH options as radio cards, each with its full weapon datasheet, and pick
    // one (replaces the old dropdown so you can compare the guns before choosing).
    let loadoutsHtml = '';
    const loadoutOpts = dbShip && Array.isArray(dbShip.loadoutOptions) ? dbShip.loadoutOptions : [];
    // The SELECTED option's weapons/loads already appear in the ship's main
    // weapon + launch tables above, so only render a datasheet for UNSELECTED
    // options (a preview of what you'd switch to). Prevents listing the same
    // gun/launch (e.g. a Torpedo Upgrade) twice.
    const optSheet = (opt, isSelected) => {
      if (isSelected) return '';
      let h = '';
      if (opt.weapons && opt.weapons.length) h += '<div class="weapon-list loadout-weapons">' + renderWeaponHeader() + opt.weapons.map(renderWeaponRow).join('') + '</div>';
      // Launch loadout options show their full launch-asset statblock too.
      if (opt.loads && opt.loads.length) h += buildLaunchTable(currentFleet && currentFleet.faction, opt.loads, true);
      return h;
    };
    if (loadoutOpts.length > 0) {
      loadoutsHtml = loadoutOpts.map((lo, loIdx) => {
        const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
        if (lo.options.length > 1) {
          const cards = lo.options.map((opt, oi) => {
            const on = oi === selIdx;
            const costLabel = opt.cost > 0 ? `+${opt.cost} pts` : opt.cost < 0 ? `${opt.cost} pts` : 'Included';
            // Don't repeat the option name when its weapon datasheet already shows
            // it (e.g. option "Cobra Heavy Laser Pair" over a Cobra Heavy Laser Pair
            // weapon row). The selected option shows no datasheet (it's in the main
            // table), so always keep its name there so the choice stays labelled.
            const redundant = !on && opt.weapons && opt.weapons.length && opt.weapons.every(w => w.name === opt.name);
            const head = redundant
              ? `<div class="loadout-radio-head loadout-radio-head-costonly"><span class="loadout-radio-cost">${costLabel}</span></div>`
              : `<div class="loadout-radio-head"><span class="loadout-radio-name">${esc(opt.name)}</span><span class="loadout-radio-cost">${costLabel}</span></div>`;
            return `<label class="loadout-radio${on ? ' selected' : ''}">
              <input type="radio" class="loadout-radio-input" name="lo-${ship.id}-${loIdx}" ${on ? 'checked' : ''} onchange="App.changeLoadout('${groupId}','${ship.id}',${loIdx},${oi})">
              <span class="loadout-radio-dot" aria-hidden="true"></span>
              <div class="loadout-radio-main">
                ${head}
                ${optSheet(opt, on)}
              </div>
            </label>`;
          }).join('');
          return `<div class="loadout-picker">${cards}</div>`;
        }
        // Single fixed option — always applied, so its stats already show in the
        // ship's main weapon/launch tables; nothing extra to render here.
        return optSheet(lo.options[selIdx] || lo.options[0] || {}, true);
      }).join('');
    }

    // One combined Launch Assets table (Launch | Load | stats…) — see renderLaunchTable.
    const launchTableHtml = dbShip ? renderLaunchTable(currentFleet.faction, dbShip, ship) : '';
    const launchBlockHtml = launchTableHtml
      ? `<div class="launch-block">${launchTableHtml}</div>`
      : '';

    let rulesHtml = '';
    // Rare/Unique already show as the prominent badge by the ship name, so drop
    // them from the special-rule chips (don't print the keyword twice).
    const isBadgeRule = r => /^(rare|unique)$/i.test(typeof r === 'string' ? r : (r.name || ''));
    const ruleDetails = (dbShip && dbShip.specialRuleDetails ? dbShip.specialRuleDetails : []).filter(r => !isBadgeRule(r));
    const ruleChips = specialRules.filter(r => !isBadgeRule(r));
    if (ruleDetails.length > 0) {
      rulesHtml = '<div class="special-rules">' + ruleDetails.map(r => {
        const desc = r.description || '';
        if (desc) {
          const pgAttr = r.page ? ` data-rule-page="${esc(r.page)}"` : '';
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(desc)}"${pgAttr} onclick="App.showRuleTooltip(event, this)">${esc(r.name)}</span>`;
        }
        return `<span class="rule-chip">${esc(r.name)}</span>`;
      }).join('') + '</div>';
    } else if (ruleChips.length > 0) {
      rulesHtml = '<div class="special-rules">' + ruleChips.map(r =>
        `<span class="rule-chip">${esc(r)}</span>`
      ).join('') + '</div>';
    }

    // Ship-specific rules text (loadout options, deployable features, etc.)
    // Always visible — this is build-critical info, not flavour.
    let rulesTextHtml = '';
    const rulesText = dbShip ? dbShip.rulesText : '';
    if (rulesText) {
      rulesTextHtml = `<div class="ship-rules-block">
        <div class="ship-rules-block-label">Ship Rules</div>
        <div class="ship-rules-block-text">${esc(rulesText)}</div>
      </div>`;
    }

    // Variants / counts-as
    let variantsHtml = '';
    const variants = dbShip ? dbShip.variants : [];
    if (variants.length > 0) {
      const varNames = variants.map(v => esc(v.name)).join(', ');
      const varDetails = variants.map(v => {
        const vImg = v.image ? `<img src="${esc(v.image)}" alt="${esc(v.name)}" loading="lazy" style="height:56px;width:auto;object-fit:contain;border-radius:var(--radius-sm)" onerror="this.style.display='none'">` : '';
        const vLore = v.lore ? `<div class="ship-lore-text" style="border:none;padding:var(--sp-xs) 0 0;background:none;font-size:var(--text-xs)">${formatLore(v.lore, v.famousShips ? 'Famous ships of the class:' : '', v.famousShips ? v.famousShips.split(', ') : [])}</div>` : '';
        return `<div style="margin-top:var(--sp-sm);padding:var(--sp-sm);background:var(--paper-alt);border-radius:var(--radius-sm);display:flex;gap:var(--sp-sm);align-items:flex-start">
          ${vImg}
          <div style="flex:1;min-width:0">
            <div style="font-weight:var(--weight-semibold);font-size:var(--text-sm)">${esc(v.name)}</div>
            ${vLore}
          </div>
        </div>`;
      }).join('');
      variantsHtml = `<details class="ship-lore no-print">
        <summary class="ship-lore-toggle" style="font-size:var(--text-xs)">Also available as: ${varNames}</summary>
        ${varDetails}
      </details>`;
    }

    // Lore / flavor text (collapsible, hidden in print)
    let loreHtml = '';
    const loreText = dbShip ? dbShip.lore : '';
    if (loreText) {
      const loreId = `lore-${ship.id}`;
      const openAttr = settings.autoExpandLore ? ' open' : '';
      const namesakeHtml = dbShip.namesake
        ? `<div class="lore-namesake"><span class="lore-namesake-label">Namesake:</span> ${loreLinks(dbShip.namesake)}</div>`
        : '';
      loreHtml = `<details class="ship-lore no-print" id="${loreId}"${openAttr}>
        <summary class="ship-lore-toggle">Lore</summary>
        <div class="ship-lore-text">${formatLore(loreText, dbShip.famousShipsPrefix, dbShip.famousShips)}${namesakeHtml}</div>
      </details>`;
    } else if (dbShip.namesake) {
      // Namesake flavour even when there's no main lore block
      const loreId = `lore-${ship.id}`;
      const openAttr = settings.autoExpandLore ? ' open' : '';
      loreHtml = `<details class="ship-lore no-print" id="${loreId}"${openAttr}>
        <summary class="ship-lore-toggle">Lore</summary>
        <div class="ship-lore-text"><div class="lore-namesake"><span class="lore-namesake-label">Namesake:</span> ${loreLinks(dbShip.namesake)}</div></div>
      </details>`;
    }

    const compact = settings.compactView;
    const isRare = dbShip && dbShip.isRare;
    const isUnique = dbShip && dbShip.isUnique;
    const groupMin = dbShip ? dbShip.groupMin : 1;
    const groupMax = dbShip ? dbShip.groupMax : 1;
    let badges = '';
    if (isUnique) badges += '<span class="ship-badge ship-badge-unique">Unique</span>';
    else if (isRare) badges += '<span class="ship-badge ship-badge-rare">Rare</span>';
    if (groupMax > 1) badges += `<span class="ship-badge ship-badge-group">${groupMin}–${groupMax}</span>`;

    // When several identical ships are collapsed into one card, show a ×N
    // multiplier and the combined cost (per-ship cost shown alongside).
    const qtyBadge = '';  // quantity lives on the stepper, not repeated on the art
    const costHtml = count > 1
      ? `<div class="ship-card-cost">${ship.points * count} pts<span class="ship-card-cost-each">${count} × ${ship.points}</span></div>`
      : `<div class="ship-card-cost">${ship.points} pts</div>`;

    // Experimental alt layout (item: 2×4 stat grid): image on top, then the
    // stat grid (forced to 2 columns) sitting beside the special-rules block.
    // Weapons/loadouts/launch flow below as usual. Off by default; toggled in
    // Settings. Suppressed in compact view (which hides stats anyway).
    const useAlt = settings.altStatBlock && !compact;
    const midSection = useAlt
      ? `<div class="alt-statblock-row">
          <div class="alt-stats">${statsHtml}</div>
          <div class="alt-rules">${rulesHtml}${rulesTextHtml}</div>
        </div>
        ${weaponsHtml}
        ${loadoutsHtml}
        ${launchBlockHtml}`
      : `${compact ? '' : `<div class="stat-weapon-row"><div class="sw-stats">${statsHtml}</div>${weaponsHtml ? `<div class="sw-weapons">${weaponsHtml}</div>` : ''}</div>`}
        ${compact ? '' : loadoutsHtml}
        ${compact ? '' : launchBlockHtml}
        ${rulesHtml}
        ${rulesTextHtml}`;

    return `
    <div class="group-ship-entry${compact ? ' compact' : ''}${useAlt ? ' alt2x4' : ''}">
      ${img ? `<div class="ship-card-image${isFullyModular(dbShip) ? ' ship-img-modular' : ''}"${isFullyModular(dbShip) ? ' title="Base hull shown, your ship\'s actual look depends on the systems you choose"' : ''}>${qtyBadge}<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" decoding="async" onerror="this.style.display='none'"></div>` : ''}
      <div class="ship-card-body" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-sm)">
        ${midSection}
        ${renderSystemsPicker(ship, dbShip, groupId, currentFleet.faction)}
        ${renderFeatureCarrierBlock(ship, dbShip, groupId)}
        ${compact ? '' : renderShipRulesGlossary(dbShip, ship)}
        ${compact ? '' : loreHtml}
        ${compact ? '' : variantsHtml}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm group-ship-remove" onclick="App.removeShip('${groupId}','${ship.id}')" aria-label="Remove ship"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </div>`;
  }

  // ── Ship Selection Modal ──
  function openShipSelectModal(groupId) {
    if (groupId) activeGroupId = groupId;
    activeCategory = 'all';
    activeFilters = new Set();
    shipSearchQuery = '';

    const factionKey = currentFleet.faction;
    const factionShips = shipDB[factionKey];
    if (!factionShips || !factionShips.groups) return;

    const searchInput = document.getElementById('ship-search-input');
    if (searchInput) searchInput.value = '';

    renderCategoryTabs(factionShips.groups);
    renderShipFilters();
    syncSortButtons();
    renderShipSelectGrid(factionShips.groups, 'all');
    openModal('modal-ship-select');
    if (searchInput) setTimeout(() => searchInput.focus(), 200);

    const fName = (factionData[factionKey] || {}).name || factionKey.toUpperCase();
    document.getElementById('ship-select-title').textContent = pendingGroupCreation
      ? `New Group, ${fName}`
      : `Add Unit, ${fName}`;
  }

  function renderCategoryTabs(groups) {
    const container = document.getElementById('ship-category-tabs');
    let tabs = '<button class="category-tab active" onclick="App.filterCategory(\'all\',this)">All Ships</button>';

    CATEGORY_ORDER.forEach(catKey => {
      if (groups[catKey] && groups[catKey].ships && Object.keys(groups[catKey].ships).length > 0) {
        const label = CATEGORY_LABELS[catKey] || catKey;
        const count = Object.keys(groups[catKey].ships).length;
        tabs += `<button class="category-tab" onclick="App.filterCategory('${catKey}',this)">${label} <span class="text-muted">(${count})</span></button>`;
      }
    });

    container.innerHTML = tabs;
  }

  function filterCategory(cat, el) {
    activeCategory = cat;
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');

    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) {
      renderShipSelectGrid(factionShips.groups, cat);
    }
  }

  // "Has Drop" = can deliver Battalions to the ground (Bulk Lander / Dropship /
  // Drop Pod loads), directly or via a loadout. Boarding Pods (boarding, not
  // ground drop) don't count.
  const DROP_RE = /bulk lander|dropship|drop pod/i;
  const shipHasDrop = s => {
    const has = arr => (arr || []).some(l => DROP_RE.test((l && l.name) || ''));
    return has(s.loads) || (s.loadoutOptions || []).some(lo => (lo.options || []).some(o => has(o.loads)));
  };
  const SHIP_FILTERS = [
    { key: 'launch',  label: 'Has Launch',   test: s => (s.loads && s.loads.length > 0) || (s.loadoutOptions || []).some(lo => lo.options.some(o => o.loads && o.loads.length > 0)) },
    { key: 'drop',    label: 'Has Drop',     test: shipHasDrop },
    { key: 'rare',    label: 'Rare',         test: s => s.isRare },
    { key: 'unique',  label: 'Unique',       test: s => s.isUnique },
    { key: 'famous',  label: 'Famous',       test: s => s.type === 'Famous' },
    { key: 'modular', label: 'Modular',      test: s => isFullyModular(s) }
  ];

  function renderShipFilters() {
    const container = document.getElementById('ship-select-filters');
    if (!container) return;
    // Only show a chip if the current faction actually has a ship matching it
    // (so "Modular" appears for Resistance, "Drop" only where drops exist, etc.).
    const pool = [];
    const fgroups = (shipDB[currentFleet && currentFleet.faction] || {}).groups || {};
    Object.values(fgroups).forEach(cat => { if (cat && cat.ships) Object.values(cat.ships).forEach(d => pool.push(d)); });
    const chips = SHIP_FILTERS.filter(f => activeFilters.has(f.key) || pool.some(d => { try { return f.test(d); } catch (e) { return false; } }));
    container.innerHTML = chips.map(f =>
      `<button class="filter-chip ${activeFilters.has(f.key) ? 'active' : ''}" onclick="App.toggleShipFilter('${f.key}')">${activeFilters.has(f.key) ? CHECK_SVG : ''}${f.label}</button>`
    ).join('') +
      // Misc Ships is a distinct vertical toggle switch (not a filter chip) — it
      // changes WHICH ships exist in the list, not just narrows them.
      `<button class="misc-vtoggle ${settings.showAdditionalShips ? 'on' : ''}" role="switch" aria-checked="${settings.showAdditionalShips}" onclick="App.toggleMiscShips()" title="Show mercenaries, cross-faction and other optional ships">
        <span class="misc-vtoggle-track"><span class="misc-vtoggle-knob"></span></span>
        <span class="misc-vtoggle-label">Misc<br>Ships</span>
      </button>`;
  }

  // The "Misc Ships" picker chip mirrors the Settings "Additional Ships" toggle:
  // reveals mercenaries / cross-faction / other optional units right in the picker.
  function toggleMiscShips() {
    toggleSetting('showAdditionalShips', !settings.showAdditionalShips);
    renderShipFilters();
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) renderShipSelectGrid(factionShips.groups, activeCategory);
  }

  function toggleShipFilter(key) {
    if (activeFilters.has(key)) {
      activeFilters.delete(key);
    } else {
      activeFilters.add(key);
    }
    renderShipFilters();
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) {
      renderShipSelectGrid(factionShips.groups, activeCategory);
    }
  }

  function clearShipFilters() {
    activeCategory = 'all';
    activeFilters.clear();
    shipSearchQuery = '';
    const si = document.getElementById('ship-search-input'); if (si) si.value = '';
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    const allTab = document.querySelector('.category-tab'); if (allTab) allTab.classList.add('active');
    renderShipFilters();
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) renderShipSelectGrid(factionShips.groups, 'all');
  }

  let _searchTimer = 0;
  function searchShips(query) {
    shipSearchQuery = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('ship-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !shipSearchQuery);
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      const factionShips = shipDB[currentFleet.faction];
      if (factionShips && factionShips.groups) {
        renderShipSelectGrid(factionShips.groups, activeCategory);
      }
    }, 120);
  }

  function clearShipSearch() {
    const input = document.getElementById('ship-search-input');
    if (input) { input.value = ''; input.focus(); }
    searchShips('');
  }

  function renderShipSelectGrid(groups, category) {
    const grid = document.getElementById('ship-select-grid');
    let ships = [];

    const catsToShow = category === 'all' ? CATEGORY_ORDER : [category];

    catsToShow.forEach(catKey => {
      if (groups[catKey] && groups[catKey].ships) {
        Object.entries(groups[catKey].ships).forEach(([shipKey, ship]) => {
          if (ship.type === 'launch_asset') return;
          ships.push({ key: shipKey, data: ship, category: catKey });
        });
      }
    });

    // Famous admirals fly a flagship that's a ship on the table — surface them in
    // the picker too (not just the Admiral menu, where they sit below the fold).
    // Picking one adds the admiral together with their flagship. They sort in by
    // the flagship's tonnage category.
    const famGroup = groups.famous_admirals;
    if (famGroup && famGroup.ships) {
      Object.entries(famGroup.ships).forEach(([k, adm]) => {
        const fcat = adm.shipCategory || 'medium';
        if (category === 'all' || category === fcat) ships.push({ key: k, data: adm, category: fcat });
      });
    }

    // Hide auxiliary/mercenary/civilian ships (cross-faction "additional" ships,
    // flagged in the data) when the setting is off. Famous admirals always show —
    // they're a deliberate pick, not auxiliary clutter.
    if (!settings.showAdditionalShips) {
      ships = ships.filter(s => s.data.type === 'Famous' || !s.data.additional);
    }

    // Apply search filter
    if (shipSearchQuery) {
      ships = ships.filter(s => {
        const name = (s.data.name || '').toLowerCase();
        const tonnage = (s.data.tonnage || '').toLowerCase();
        const rules = (s.data.special_rules || []).join(' ').toLowerCase();
        return name.includes(shipSearchQuery) || tonnage.includes(shipSearchQuery) || rules.includes(shipSearchQuery);
      });
    }

    // Apply active filters (AND logic — ship must pass all active filters)
    if (activeFilters.size > 0) {
      ships = ships.filter(s => {
        for (const f of SHIP_FILTERS) {
          if (activeFilters.has(f.key) && !f.test(s.data)) return false;
        }
        return true;
      });
    }

    const sortDir = shipSort.dir === 'desc' ? -1 : 1;
    const shipCmp = {
      points:  (a, b) => (a.data.points || 0) - (b.data.points || 0),
      name:    (a, b) => (a.data.name || '').localeCompare(b.data.name || ''),
      tonnage: (a, b) => (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
                         || ((a.data.points || 0) - (b.data.points || 0)),
    }[shipSort.key] || ((a, b) => (a.data.points || 0) - (b.data.points || 0));
    ships.sort((a, b) => shipCmp(a, b) * sortDir);

    // Update results bar
    const resultsBar = document.getElementById('ship-results-bar');
    if (resultsBar) {
      const isFiltered = shipSearchQuery || activeFilters.size > 0 || category !== 'all';
      if (isFiltered) {
        let ctx = [];
        if (shipSearchQuery) ctx.push(`"${esc(shipSearchQuery)}"`);
        if (activeFilters.size > 0) ctx.push([...activeFilters].join(', '));
        resultsBar.innerHTML = `<span class="results-count">${ships.length} ship${ships.length !== 1 ? 's' : ''}</span>${ctx.length ? ` <span class="results-context">matching ${ctx.join(' + ')}</span>` : ''}<button class="results-clear" onclick="App.clearShipFilters()">Clear ×</button>`;
        resultsBar.classList.remove('hidden');
      } else {
        resultsBar.classList.add('hidden');
        resultsBar.innerHTML = '';
      }
    }

    if (ships.length === 0) {
      const suggestion = shipSearchQuery
        ? `No ships match "<strong>${esc(shipSearchQuery)}</strong>". Try a different search term or clear filters.`
        : activeFilters.size > 0
          ? 'No ships match the active filters. Try removing some filters.'
          : 'No ships available in this category.';
      grid.innerHTML = `<div class="empty-state"><p class="text-caption">${suggestion}</p></div>`;
      return;
    }

    grid.innerHTML = ships.map(s => renderShipSelectCard(s)).join('');
  }

  function renderShipSelectCard({ key, data, category }) {
    const catLabel = CATEGORY_LABELS[category] || category;
    const specialRules = data.special_rules || [];
    // Famous admiral entry: the card represents the admiral + their flagship.
    const isFamous = data.type === 'Famous';
    let selectBadges = '';
    if (isFamous) selectBadges += '<span class="ship-badge ship-badge-admiral">Admiral</span>';
    else if (data.isUnique) selectBadges += '<span class="ship-badge ship-badge-unique">Unique</span>';
    else if (data.isRare) selectBadges += '<span class="ship-badge ship-badge-rare">Rare</span>';
    // (No Launch/Drop badge next to the name — launch capability already reads
    // from the launch-capacity indicator, the weapon summary and the loads.)

    // Compact weapon summary for ship select cards
    const wpns = data.weapons || [];
    const hasLoads = (data.loads && data.loads.length > 0) || (data.loadoutOptions || []).some(lo => lo.options.some(o => o.loads && o.loads.length > 0));
    let weaponSummary = '';
    if (wpns.length > 0) {
      const parts = wpns.map(w => {
        const typeIcon = WEAPON_TYPE_ICONS[w.type] || '';
        return `<span class="weapon-mini" title="${esc(w.name)}: ${w.attack}A Lk${w.lock} D${w.damage} ${w.arc || ''}">${typeIcon} ${esc(w.name)}</span>`;
      });
      weaponSummary = `<div class="weapon-summary">${parts.join('')}</div>`;
    }

    // Launch capability indicator
    let launchIndicator = '';
    if (hasLoads) {
      const totalLaunch = (data.loads || []).reduce((t, l) => t + (parseInt(l.launch) || 0), 0);
      launchIndicator = totalLaunch > 0
        ? `<span class="launch-indicator" title="Launch capacity: ${totalLaunch}"><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z"/></svg> ${totalLaunch}</span>`
        : '';
    }

    // Famous admirals open no datasheet (handled via the Admiral slot) and use
    // the admiral add-flow; the type line names their flagship.
    const sizeInfoSel = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const famBlocked = isFamous && (hasFamousAdmiral() || (data.level && data.level > (sizeInfoSel.maxAdmiralLevel || 4)));
    const famReason = !isFamous ? '' : (hasFamousAdmiral() ? 'One named admiral per fleet' : (data.level > (sizeInfoSel.maxAdmiralLevel || 4) ? `Requires ${sizeInfoSel.label}+` : ''));
    // Famous admirals live under the famous_admirals group — open their datasheet
    // with that category so the "click for info" works for them too.
    const cardOnclick = ` onclick="App.openShipDetail('${currentFleet.faction}','${isFamous ? 'famous_admirals' : category}','${key}',true)"`;
    const typeLine = isFamous
      ? `${esc(data.ship_name || data.className || 'Flagship')} · ${esc(tonLabel(data.tonnage) || catLabel)}`
      : `${esc(tonLabel(data.tonnage) || catLabel)}`;
    const addBtn = isFamous
      ? `<button class="btn btn-primary btn-sm"${famBlocked ? ` disabled title="${esc(famReason)}"` : ''} onclick="event.stopPropagation(); App.addFamousAdmiralFromPicker('${key}')">+ Add Admiral</button>`
      : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.addShipToGroup('${key}','${category}')">+ Add</button>`;

    return `
    <div class="ship-card${isFamous ? ' ship-card-admiral' : ''}"${cardOnclick} title="${isFamous ? esc(data.name) : 'View full datasheet'}">
      <div class="ship-card-top">
        ${data.image ? `<div class="ship-card-image"><img src="${esc(thumbUrl(data.image))}" alt="${esc(data.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
        <div class="ship-card-info">
          <div class="ship-card-name">${esc(data.name)}${selectBadges ? ` ${selectBadges}` : ''}</div>
          <div class="ship-card-type">${typeLine}</div>
        </div>
        <div class="ship-card-cost">${(data.groupMin > 1 && !isFamous) ? (data.points || 0) * data.groupMin : (data.points || 0)}<span style="font-size:var(--text-sm);font-weight:var(--weight-regular)"> pts</span>${(data.groupMin > 1 && !isFamous) ? `<span class="ship-card-cost-each">${data.groupMin}× ${data.points}</span>` : ''}</div>
      </div>
      ${renderStatGrid(data)}
      ${weaponSummary}
      ${isFamous ? '' : shipLaunchIcons(data, currentFleet.faction)}
      ${specialRules.length > 0 ? `<div class="special-rules">${specialRules.slice(0, 4).map(r => {
        const detail = (data.specialRuleDetails || []).find(d => d.name === r);
        if (detail && detail.description) {
          const pgA = detail.page ? ` data-rule-page="${esc(detail.page)}"` : '';
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(detail.description)}"${pgA} onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r)}</span>`;
        }
        return `<span class="rule-chip">${esc(r)}</span>`;
      }).join('')}${specialRules.length > 4 ? `<span class="rule-chip" style="background:rgba(255,255,255,0.06);color:var(--ink-faint)">+${specialRules.length - 4}</span>` : ''}</div>` : ''}
      <div class="flex items-center justify-between" style="margin-top:auto">
        <span class="text-caption">${data.g ? `Group: ${data.g}` : ''}</span>
        <div class="flex gap-xs">
          ${addBtn}
        </div>
      </div>
    </div>`;
  }

  function addShipToGroup(shipKey, category) {
    // Payloads (Bioficer Cells) have no group size and no tonnage limit. Rather
    // than spawn a fresh 1-ship group for every copy (which spams the printout
    // with identical cells), fold a repeat add into the existing payload group of
    // the same ship as a quantity bump.
    if (category === 'payload' && currentFleet) {
      const existing = currentFleet.battleGroups.find(g =>
        g.ships.length > 0 && g.ships[0].groupCategory === 'payload' && g.ships[0].shipKey === shipKey);
      if (existing) {
        const dbShip = findShipInDB(currentFleet.faction, category, shipKey);
        if (dbShip) {
          addShipToGroupInner(existing, shipKey, category, dbShip);
          activeGroupId = existing.id;
          saveFleets();
          updatePoints();
          scheduleRender(renderGroupsNav, renderActiveGroup);
          showToast(`Added ${dbShip.name} (×${existing.ships.length})`);
          return;
        }
      }
    }
    if (pendingGroupCreation) {
      // Create a brand-new group with this ship and close the modal
      const dbShip = findShipInDB(currentFleet.faction, category, shipKey);
      if (!dbShip) return;
      const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;

      // Validate colossal limit
      if (category === 'colossal') {
        const colossalMax = sizeInfo.colossalMax ?? 0;
        const existing = currentFleet.battleGroups.filter(g =>
          g.ships.length > 0 && g.ships[0].groupCategory === 'colossal'
        ).length;
        if (existing >= colossalMax) {
          showToast(`${sizeInfo.label} allows max ${colossalMax} Colossal group${colossalMax !== 1 ? 's' : ''}`);
          return;
        }
      }

      // Validate unique — only 1 group of this ship
      if (dbShip.isUnique) {
        const exists = currentFleet.battleGroups.some(g =>
          g.ships.length > 0 && g.ships[0].shipKey === shipKey && g.ships[0].groupCategory === category
        );
        if (exists) {
          showToast(`${dbShip.name} is Unique, only 1 group allowed`);
          return;
        }
      }

      // Validate rare — limit by game size
      if (dbShip.isRare) {
        const rareMax = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 }[currentFleet.gameSize] || 2;
        const existing = currentFleet.battleGroups.filter(g =>
          g.ships.length > 0 && g.ships[0].shipKey === shipKey && g.ships[0].groupCategory === category
        ).length;
        if (existing >= rareMax) {
          showToast(`${dbShip.name} is Rare, max ${rareMax} group${rareMax > 1 ? 's' : ''} at ${sizeInfo.label}`);
          return;
        }
      }

      const group = { id: uuid(), name: dbShip.name, ships: [] };
      // Seed the group at its minimum size (parity with mobile): a ship whose
      // group is 2-4 starts as ×2, not ×1.
      const startQty = Math.max(1, dbShip.groupMin || 1);
      for (let i = 0; i < startQty; i++) addShipToGroupInner(group, shipKey, category, dbShip);
      currentFleet.battleGroups.push(group);
      activeGroupId = group.id;

      // Keep the picker open so several groups can be created back-to-back —
      // the user dismisses it with the modal's Close (×) when done, instead of
      // hunting for the Add Group button after every single add.
      saveFleets();
      scheduleRender(renderGroupsNav, renderActiveGroup, updatePoints);
      showToast(`Added group: ${dbShip.name}, pick another, or close when done`);
      return;
    }
    addShipToGroupEnforced(shipKey, category);
  }

  function changeLoadout(groupId, shipId, loadoutIdx, optionIdx) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    const ship = group.ships.find(s => s.id === shipId);
    if (!ship) return;

    const dbShip = findShipInDB(currentFleet.faction, ship.groupCategory, ship.shipKey);
    if (!dbShip || !dbShip.loadoutOptions) return;

    // The card is collapsed by loadout signature, so apply the change to every
    // copy that currently matches this ship's loadout — they're shown as one.
    const beforeSig = JSON.stringify(ship.loadouts || {});
    const targets = group.ships.filter(s =>
      s.shipKey === ship.shipKey &&
      s.groupCategory === ship.groupCategory &&
      JSON.stringify(s.loadouts || {}) === beforeSig
    );

    targets.forEach(s => {
      if (!s.loadouts) s.loadouts = {};
      s.loadouts[loadoutIdx] = optionIdx;
      // Recalculate total points: base + all loadout costs
      let total = dbShip.points || 0;
      dbShip.loadoutOptions.forEach((lo, li) => {
        const selIdx = s.loadouts[li] ?? 0;
        total += lo.options[selIdx]?.cost || 0;
      });
      s.points = total;
    });

    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function changeFeature(groupId, shipId, featureName) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    const ship = group.ships.find(s => s.id === shipId);
    if (!ship) return;
    // Every ship in a group must carry the same options — apply to all copies
    // of this ship type so the collapsed card stays consistent.
    const dbShip = findShipInDB(currentFleet.faction, ship.groupCategory, ship.shipKey);
    group.ships
      .filter(s => s.shipKey === ship.shipKey && s.groupCategory === ship.groupCategory)
      .forEach(s => {
        s.feature = featureName || undefined;
        if (dbShip) s.points = recalcShipPoints(s, dbShip, currentFleet.faction);
      });
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  // Recompute a ship's points: base + selected loadout options + chosen systems.
  function recalcShipPoints(ship, dbShip, factionKey) {
    let total = dbShip.points || 0;
    (dbShip.loadoutOptions || []).forEach((lo, li) => {
      const selIdx = (ship.loadouts && ship.loadouts[li] !== undefined) ? ship.loadouts[li] : 0;
      total += lo.options[selIdx]?.cost || 0;
    });
    const list = systemsListFor(dbShip, factionKey);
    if (list && ship.systems) {
      ship.systems.forEach(n => {
        const o = findSystemOption(list, n);
        if (o) total += o.cost || 0;
      });
    }
    // Deployable feature (e.g. a Porter's Genitor Tower) adds its own cost.
    if (ship.feature) {
      const feats = (shipDB[factionKey] && shipDB[factionKey].deployableFeatures) || [];
      const f = feats.find(x => x.name === ship.feature);
      if (f) total += f.cost || 0;
    }
    return total;
  }

  // Every ship in a group takes the same Hardpoint options, so add/remove
  // applies to all copies of this ship type in the group.
  function sameTypeShips(group, ship) {
    return group.ships.filter(s => s.shipKey === ship.shipKey && s.groupCategory === ship.groupCategory);
  }

  function addSystem(groupId, shipId, optName) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    const ship = group.ships.find(s => s.id === shipId);
    if (!ship) return;
    const dbShip = findShipInDB(currentFleet.faction, ship.groupCategory, ship.shipKey);
    if (!dbShip) return;
    if (!canAddSystem(ship, dbShip, currentFleet.faction, optName)) return;
    sameTypeShips(group, ship).forEach(s => {
      if (!s.systems) s.systems = [];
      s.systems.push(optName);
      s.points = recalcShipPoints(s, dbShip, currentFleet.faction);
    });
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function removeSystem(groupId, shipId, optName) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    const ship = group.ships.find(s => s.id === shipId);
    if (!ship) return;
    const dbShip = findShipInDB(currentFleet.faction, ship.groupCategory, ship.shipKey);
    if (!dbShip) return;
    sameTypeShips(group, ship).forEach(s => {
      if (!s.systems) return;
      const i = s.systems.lastIndexOf(optName);
      if (i >= 0) s.systems.splice(i, 1);
      s.points = recalcShipPoints(s, dbShip, currentFleet.faction);
    });
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function removeShip(groupId, shipId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    group.ships = group.ships.filter(s => s.id !== shipId);
    // A group always has a ship — removing the last one removes the group.
    if (group.ships.length === 0) {
      currentFleet.battleGroups = currentFleet.battleGroups.filter(g => g.id !== groupId);
      if (activeGroupId === groupId) activeGroupId = null;
    }
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function addSameShip(groupId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group || group.ships.length === 0) return;

    const firstShip = group.ships[0];
    const dbShip = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
    if (!dbShip) return;

    // Payloads have no group-size cap; everything else honours groupMax.
    const groupMax = firstShip.groupCategory === 'payload' ? Infinity : (dbShip.groupMax || 12);
    if (group.ships.length >= groupMax) {
      showToast(`Maximum ${groupMax} ships per group`);
      return;
    }

    addShipToGroupInner(group, firstShip.shipKey, firstShip.groupCategory, dbShip);
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function removeLastShip(groupId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group || group.ships.length === 0) return;

    const firstShip = group.ships[0];
    const dbShip = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
    const groupMin = dbShip ? (dbShip.groupMin || 1) : 1;

    if (group.ships.length <= groupMin) {
      // At the minimum, − removes the whole group (subtract past the floor).
      currentFleet.battleGroups = currentFleet.battleGroups.filter(g => g.id !== groupId);
      if (activeGroupId === groupId) activeGroupId = currentFleet.battleGroups[0] ? currentFleet.battleGroups[0].id : null;
      saveFleets();
      updatePoints();
      scheduleRender(renderGroupsNav, renderActiveGroup);
      return;
    }

    group.ships.pop();
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
  }

  function sortShips(mode) {
    // Tap a new key → sort ascending by it; tap the active key → flip direction
    // (mirrors the mobile picker's sort chips).
    if (shipSort.key === mode) shipSort.dir = shipSort.dir === 'asc' ? 'desc' : 'asc';
    else { shipSort.key = mode; shipSort.dir = 'asc'; }
    syncSortButtons();
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) {
      renderShipSelectGrid(factionShips.groups, activeCategory);
    }
  }
  function syncSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(b => {
      const on = b.dataset.sort === shipSort.key;
      b.classList.toggle('active', on);
      const lbl = { points: 'Points', name: 'Name', tonnage: 'Tonnage' }[b.dataset.sort] || b.dataset.sort;
      b.innerHTML = on ? `${lbl} <span class="sort-arrow">${shipSort.dir === 'asc' ? '↑' : '↓'}</span>` : lbl;
    });
  }

  // ── Admirals ──
  // Per rulebook Section 4.2.1, you may take ANY NUMBER of admirals — each
  // assigned to a Capital Ship (Medium/Heavy/Colossal). The only restriction is
  // that you may only include ONE Famous or Faction Admiral per fleet. Admirals
  // are stored as `fleet.admirals` (array).
  function getAdmiralLevelCost(level) {
    if (!rawFleetData || !rawFleetData.gameSystem || !rawFleetData.gameSystem.admiralLevels) return 0;
    const entry = rawFleetData.gameSystem.admiralLevels.find(a => a.level === level);
    return entry ? entry.cost : 0;
  }

  function hasFamousAdmiral() {
    if (!currentFleet) return false;
    return (currentFleet.admirals || []).some(a => a.type === 'Famous' || a.type === 'Faction');
  }

  const GENERIC_ADMIRAL_LEVELS = [
    { level: 2, cost: 20 },
    { level: 3, cost: 40 },
    { level: 4, cost: 60 }
  ];

  // The portrait-thumbnail slot for an admiral: the portrait when one exists
  // (famous admirals), otherwise the rank insignia fills the whole square
  // (generic/faction admirals have no portrait). The insignia lives here now,
  // not inline with the name.
  function admiralThumb(level, imgUrl) {
    if (imgUrl) return `<div class="admiral-thumb"><img src="${esc(thumbUrl(imgUrl))}" alt="" loading="lazy" onerror="this.style.display='none'"></div>`;
    const ins = window.RankInsignia ? RankInsignia(currentFleet.faction, level, 52) : '';
    return `<div class="admiral-thumb rank-thumb">${ins}</div>`;
  }

  function openAdmiralModal() {
    if (!currentFleet) return;
    const factionShips = shipDB[currentFleet.faction];
    if (!factionShips) return;

    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const maxLevel = sizeInfo.maxAdmiralLevel || 4;
    const factionAdmirals = (factionShips.admirals || []).filter(a => !a.isFamous);
    const admiralGroup = factionShips.groups?.famous_admirals;
    const alreadyHasNamedAdmiral = hasFamousAdmiral();

    const container = document.getElementById('admiral-options');
    const sectionTitle = (text) => `<div style="margin-top:var(--sp-lg);margin-bottom:var(--sp-sm);font-weight:var(--weight-semibold);font-size:var(--text-sm);letter-spacing:0.05em;color:var(--ink-muted)">${text}</div>`;

    let html = '';

    // ── Generic Admirals: pick a level ──
    html += sectionTitle('Generic Admiral');
    const levelBtns = GENERIC_ADMIRAL_LEVELS.filter(l => l.level <= maxLevel).map(l =>
      `<div class="admiral-card" style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-md)">
        <div class="flex items-center gap-md" style="min-width:0">
          ${admiralThumb(l.level, null)}
          <div>
            <div class="admiral-name">Level ${l.level} Admiral</div>
            <div class="admiral-level">${l.cost} pts, assign to any Capital Ship</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.addGenericAdmiral(null, ${l.level}, ${l.cost})">Add</button>
      </div>`
    ).join('');
    html += levelBtns;

    // ── Faction Admirals ──
    if (factionAdmirals.length > 0) {
      html += sectionTitle('Faction Admirals');
      if (alreadyHasNamedAdmiral) {
        html += `<div style="margin-bottom:var(--sp-sm);padding:var(--sp-sm) var(--sp-md);background:var(--gold-subtle);border:1px solid var(--gold-line);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--gold-dark)">Only one Faction or Famous Admiral per fleet.</div>`;
      }
      factionAdmirals.forEach(adm => {
        const disabled = alreadyHasNamedAdmiral;
        const abilities = adm.abilities || [];
        const picks = adm.abilityPicks || 1;
        html += `
        <div class="admiral-card${disabled ? ' disabled' : ''}" style="${disabled ? 'opacity:0.5;' : ''};display:flex;gap:var(--sp-md);align-items:flex-start">
          ${admiralThumb(adm.level, null)}
          <div style="flex:1;min-width:0">
            <div class="admiral-name">${esc(adm.name)}</div>
            <div class="admiral-level">Level ${adm.level || '?'}, ${adm.cost} pts</div>
            ${abilities.length > 0 ? `<div style="margin-top:var(--sp-sm);font-size:var(--text-sm);color:var(--ink-muted);line-height:1.5">${abilities.map(a => `<div style="margin-bottom:var(--sp-xs)"><strong>${esc(a.name || '')}</strong>${a.cost ? ` (${esc(a.cost)})` : ''}${a.effect ? ', ' + esc(a.effect) : ''}</div>`).join('')}</div>` : ''}
            <div class="admiral-modal-picks">+ choose ${picks} from the Abilities Table</div>
            ${disabled ? '' : `<button class="btn btn-primary btn-sm" style="margin-top:var(--sp-sm)" onclick="App.addFactionAdmiral('${adm.id}')">Add to fleet</button>`}
          </div>
        </div>`;
      });
    }

    // ── Famous Admirals ──
    if (admiralGroup && admiralGroup.ships && Object.keys(admiralGroup.ships).length > 0) {
      html += sectionTitle('Famous Admirals');
      if (alreadyHasNamedAdmiral && !factionAdmirals.length) {
        html += `<div style="margin-bottom:var(--sp-sm);padding:var(--sp-sm) var(--sp-md);background:var(--gold-subtle);border:1px solid var(--gold-line);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--gold-dark)">Only one Faction or Famous Admiral per fleet.</div>`;
      }
      Object.entries(admiralGroup.ships).forEach(([key, admiral]) => {
        const abilities = admiral.special_abilities || [];
        const disabled = alreadyHasNamedAdmiral;
        const levelForSize = admiral.level >= 5 ? 4 : admiral.level;
        const tooHighLevel = levelForSize > maxLevel;
        const isDisabled = disabled || tooHighLevel;
        html += `
        <div class="admiral-card${isDisabled ? ' disabled' : ''}" style="${isDisabled ? 'opacity:0.5;' : ''}">
          <div class="flex gap-md items-start">
            ${admiral.image ? `<div class="ship-card-image"><img src="${esc(thumbUrl(admiral.image))}" alt="${esc(admiral.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : admiralThumb(admiral.level, null)}
            <div style="flex:1;min-width:0">
              <div class="admiral-name">${esc(admiral.name)}</div>
              <div class="admiral-level">Level ${admiral.level || '?'} Famous${tooHighLevel ? `, requires ${sizeInfo.label}+` : ''}</div>
              <div class="flex gap-sm flex-wrap" style="margin-top:var(--sp-xs)">
                <span class="badge badge-gold">${admiral.points} pts</span>
                ${admiral.ship_cost ? `<span class="badge badge-neutral">Ship: ${admiral.ship_cost} pts</span>` : ''}
              </div>
              ${admiral.ship_name ? `<div style="margin-top:var(--sp-xs);font-size:var(--text-xs);color:var(--ink-muted)">Ship: ${esc(admiral.ship_name)}${admiral.shipCategory ? ', ' + (CATEGORY_LABELS[admiral.shipCategory] || '') : ''}</div>` : ''}
            </div>
          </div>
          ${abilities.length > 0 ? `<div style="margin-top:var(--sp-md);font-size:var(--text-sm);color:var(--ink-muted);line-height:1.5">${abilities.map(a => `<div style="margin-bottom:var(--sp-xs)"><strong>${esc(a.name || '')}</strong>${a.cost ? ` (${esc(a.cost)})` : ''}${a.effect ? ', ' + esc(a.effect) : ''}</div>`).join('')}</div>` : ''}
          <div class="admiral-modal-picks">+ choose ${admiral.ability_picks || 1} from the Abilities Table</div>
          ${isDisabled ? `<div class="text-caption" style="margin-top:var(--sp-sm)">${tooHighLevel ? `Requires ${sizeInfo.label}+` : 'One named admiral per fleet'}</div>` : `<button class="btn btn-primary btn-sm" style="margin-top:var(--sp-md)" onclick="App.addFamousAdmiral('${key}')">Add to fleet: brings ${esc(admiral.ship_name || 'their ship')}</button>`}
        </div>`;
      });
    }

    container.innerHTML = html;
    openModal('modal-admiral');
  }

  function addGenericAdmiral(admiralId, level, cost) {
    if (!currentFleet) return;
    if (!currentFleet.admirals) currentFleet.admirals = [];

    currentFleet.admirals.push({
      name: `Level ${level} Admiral`,
      points: cost,
      level,
      type: 'Generic'
    });

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
  }

  function addFactionAdmiral(admiralId) {
    if (!currentFleet) return;
    if (!currentFleet.admirals) currentFleet.admirals = [];
    if (hasFamousAdmiral()) return;

    const factionShips = shipDB[currentFleet.faction];
    const adm = (factionShips.admirals || []).find(a => a.id === admiralId);
    if (!adm) return;

    currentFleet.admirals.push({
      admiralId,
      name: adm.name,
      points: adm.cost,
      level: adm.level,
      type: 'Faction',
      selectedAbilities: []
    });

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
    promptAdmiralAbilities(currentFleet.admirals.length - 1);
  }

  // After adding an admiral that picks from the Abilities Table, pop the picker
  // modal so you're prompted to choose (after the add-admiral modal closes).
  function promptAdmiralAbilities(index) {
    const a = (currentFleet && currentFleet.admirals || [])[index];
    if (!a) return;
    const info = getAdmiralAbilityInfo(a);
    if (info && info.table.length && info.picks > 0) {
      setTimeout(() => openAdmiralAbilityModal(index), 200);
    }
  }

  function addFamousAdmiral(shipKey) {
    if (!currentFleet) return;
    if (!currentFleet.admirals) currentFleet.admirals = [];
    if (hasFamousAdmiral()) return; // enforce one Famous max

    const factionShips = shipDB[currentFleet.faction];
    const admiralGroup = factionShips.groups?.famous_admirals;
    const admiral = admiralGroup?.ships?.[shipKey];
    if (!admiral) return;

    currentFleet.admirals.push({
      shipKey,
      name: admiral.name,
      points: admiral.points || 0,
      level: admiral.level,
      type: 'Famous',
      selectedAbilities: []
    });

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    renderOverviewPanel();   // the flagship now shows among the groups
    updatePoints();
    promptAdmiralAbilities(currentFleet.admirals.length - 1);
  }

  // Add a famous admiral picked from the ship-selection grid (not the Admiral
  // menu). addFamousAdmiral does the work + pops the ability picker; we just
  // close the ship picker first so the modals don't stack.
  function addFamousAdmiralFromPicker(shipKey) {
    if (!currentFleet) return;
    if (hasFamousAdmiral()) { showToast('One named admiral per fleet'); return; }
    closeModal('modal-ship-select');
    addFamousAdmiral(shipKey);
  }

  function removeAdmiral(index) {
    if (!currentFleet || !currentFleet.admirals) return;
    currentFleet.admirals.splice(index, 1);
    activeFlagship = null;   // its flagship detail (if open) no longer applies
    saveFleets();
    renderAdmiralSlot();
    renderOverviewPanel();   // drop the flagship from the groups list
    renderDetailPanel();
    updatePoints();
  }

  // Resolve a fleet admiral entry's ability data from the faction DB.
  // Returns { innate:[{name,cost,effect}], table:[...], picks:N } or null for
  // generic (abstract) admirals, who do not draw from the Abilities Table.
  function getAdmiralAbilityInfo(a) {
    if (!a || a.type === 'Generic') return null;
    const fdb = shipDB[currentFleet.faction];
    if (!fdb) return null;
    const table = fdb.abilitiesTable || [];
    if (a.type === 'Famous' && a.shipKey) {
      const adm = fdb.groups?.famous_admirals?.ships?.[a.shipKey];
      if (!adm) return null;
      return { innate: adm.special_abilities || [], table, picks: adm.ability_picks || 1 };
    }
    if (a.admiralId) {
      const adm = (fdb.admirals || []).find(x => x.id === a.admiralId);
      if (!adm) return null;
      return { innate: adm.abilities || [], table, picks: adm.abilityPicks || 1 };
    }
    return null;
  }

  // Capital-ship groups (Medium/Heavy/Colossal) an admiral may be assigned to.
  function capitalShipGroups() {
    if (!currentFleet) return [];
    return (currentFleet.battleGroups || []).filter(g => g.ships && g.ships.length).map(g => {
      const s = g.ships[0];
      const db = findShipInDB(currentFleet.faction, s.groupCategory, s.shipKey);
      const cat = db ? (db.category || s.groupCategory) : s.groupCategory;
      return { id: g.id, name: g.name, cat };
    }).filter(g => g.cat === 'medium' || g.cat === 'heavy' || g.cat === 'colossal');
  }

  // Assign a Generic/Faction admiral to one of the fleet's Capital ships.
  function assignAdmiralShip(index, groupId) {
    if (!currentFleet) return;
    const a = (currentFleet.admirals || [])[index];
    if (!a) return;
    a.assignedGroupId = groupId || null;
    saveFleets();
    // Re-render the whole overview (not just the admiral slot) so the validation
    // marks recheck immediately — assigning to a Capital ship clears the
    // "not assigned to a Capital ship" warning without needing another action.
    renderOverviewPanel();
    updatePoints();
  }

  // Ship-assignment selector for Generic/Faction admirals (Famous fly their own
  // flagship, so they are not assignable).
  function renderAdmiralAssignment(a, i) {
    if (a.type === 'Famous') return '';
    const caps = capitalShipGroups();
    if (!caps.length) {
      return `<div class="admiral-assign admiral-assign-empty">Assign to a Capital ship, add a Medium/Heavy/Colossal group first.</div>`;
    }
    const valid = caps.some(g => g.id === a.assignedGroupId);
    const opts = [`<option value=""${valid ? '' : ' selected'}>Assign to a Capital ship</option>`]
      .concat(caps.map(g => `<option value="${g.id}"${a.assignedGroupId === g.id ? ' selected' : ''}>${esc(g.name)}</option>`)).join('');
    return `<div class="admiral-assign">
      <label class="admiral-assign-label">Aboard</label>
      <select class="admiral-assign-select" onchange="App.assignAdmiralShip(${i}, this.value)">${opts}</select>
    </div>`;
  }

  // Toggle a chosen Abilities-Table pick for the admiral at `index`, respecting
  // its pick cap.
  function toggleAdmiralAbility(index, abilityName) {
    if (!currentFleet) return;
    const a = (currentFleet.admirals || [])[index];
    if (!a) return;
    const info = getAdmiralAbilityInfo(a);
    if (!info) return;
    if (!Array.isArray(a.selectedAbilities)) a.selectedAbilities = [];
    const pos = a.selectedAbilities.indexOf(abilityName);
    if (pos >= 0) {
      a.selectedAbilities.splice(pos, 1);   // tap a checked one to uncheck it
    } else if (a.selectedAbilities.length >= info.picks) {
      // At the cap: ticking another one swaps out the oldest, so you never have to
      // uncheck first (no "click off then on").
      if (info.picks === 1) a.selectedAbilities = [abilityName];
      else { a.selectedAbilities.shift(); a.selectedAbilities.push(abilityName); }
    } else {
      a.selectedAbilities.push(abilityName);
    }
    saveFleets();
    renderAdmiralSlot();
    renderOverviewPanel();
    // Keep the modal picker in sync when it's the one being used.
    const modal = document.getElementById('modal-admiral-abilities');
    if (modal && modal.classList.contains('active')) renderAdmiralAbilityModalBody(index);
  }

  // Render an admiral's innate abilities (always expanded) + the Abilities-Table
  // picker. Returns '' for generic admirals.
  // Sidebar admiral slot: a compact, READ-ONLY list of abilities (innate +
  // chosen) so it stays scannable in the narrow column. Picking from the table
  // happens in a roomy modal (openAdmiralAbilityModal), not inline.
  function renderAdmiralAbilities(a, index) {
    const info = getAdmiralAbilityInfo(a);
    if (!info) return '';
    const liteLine = ab => `<div class="admiral-ability-lite">
        <span class="admiral-ability-name">${esc(ab.name || '')}</span>${ab.cost ? ` <span class="admiral-ability-cost">${esc(ab.cost)}</span>` : ''}
      </div>`;
    let html = '';
    if (info.innate.length) {
      html += `<div class="admiral-abilities-block">
        <div class="admiral-abilities-label">Innate Abilit${info.innate.length === 1 ? 'y' : 'ies'}</div>
        ${info.innate.map(liteLine).join('')}
      </div>`;
    }
    if (info.table.length && info.picks > 0) {
      const sel = Array.isArray(a.selectedAbilities) ? a.selectedAbilities : [];
      const remaining = info.picks - sel.length;
      const chosen = info.table.filter(ab => sel.includes(ab.name));
      html += `<div class="admiral-abilities-block${remaining > 0 ? ' admiral-abilities-unset' : ''}">
        <div class="admiral-abilities-label">Chosen Abilities <span class="admiral-picks-remaining">${sel.length}/${info.picks}</span></div>
        ${chosen.length ? chosen.map(liteLine).join('') : '<div class="admiral-ability-none">None chosen yet</div>'}
        <button class="btn btn-outline btn-sm admiral-choose-btn" onclick="App.openAdmiralAbilityModal(${index})">${remaining > 0 ? `Choose ${remaining} abilit${remaining === 1 ? 'y' : 'ies'} ›` : 'Edit abilities ›'}</button>
      </div>`;
    }
    return html;
  }

  // The interactive Abilities-Table picker (buttons + full effect text). Shown
  // in the modal where there's room to read.
  function renderAbilityPicker(a, index, info) {
    const sel = Array.isArray(a.selectedAbilities) ? a.selectedAbilities : [];
    const remaining = info.picks - sel.length;
    return `<div class="admiral-ability-picks admiral-ability-picks-modal">
      ${info.table.map(ab => {
        const on = sel.includes(ab.name);
        // Visible checkboxes — tick to select, tick another at the cap to swap the
        // oldest. Nothing is ever locked, so there's no "click off then on".
        return `<div class="admiral-pick${on ? ' is-selected' : ''}" role="button" tabindex="0" onclick="App.toggleAdmiralAbility(${index}, ${JSON.stringify(ab.name).replace(/"/g, '&quot;')})">
          <span class="admiral-pick-check">${on ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg>' : ''}</span>
          <div class="admiral-pick-text">
            <span class="admiral-pick-head"><span class="admiral-ability-name">${esc(ab.name)}</span>${ab.cost ? ` <span class="admiral-ability-cost">${esc(ab.cost)}</span>` : ''}</span>
            ${ab.effect ? `<span class="admiral-ability-effect">${linkKeywords(ab.effect)}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderAdmiralAbilityModalBody(index) {
    const a = (currentFleet && currentFleet.admirals || [])[index];
    if (!a) return;
    const info = getAdmiralAbilityInfo(a);
    if (!info) return;
    const sel = Array.isArray(a.selectedAbilities) ? a.selectedAbilities : [];
    const remaining = info.picks - sel.length;
    const titleEl = document.getElementById('admiral-abilities-modal-title');
    if (titleEl) titleEl.textContent = `${a.name}, choose ${info.picks} abilit${info.picks === 1 ? 'y' : 'ies'}`;
    const subEl = document.getElementById('admiral-abilities-modal-sub');
    if (subEl) subEl.textContent = remaining > 0 ? `${remaining} pick${remaining === 1 ? '' : 's'} remaining` : 'All picks made';
    const body = document.getElementById('admiral-abilities-modal-body');
    if (body) body.innerHTML = renderAbilityPicker(a, index, info);
  }

  function openAdmiralAbilityModal(index) {
    const a = (currentFleet && currentFleet.admirals || [])[index];
    if (!a) return;
    if (!getAdmiralAbilityInfo(a)) return;
    renderAdmiralAbilityModalBody(index);
    openModal('modal-admiral-abilities');
  }

  function renderAdmiralSlot() {
    const slot = document.getElementById('admiral-slot');
    if (!currentFleet || !slot) return;   // slot now lives in the overview, created lazily
    const admirals = currentFleet.admirals || [];

    if (admirals.length === 0) {
      slot.innerHTML = `
      <div class="add-ship-area" onclick="App.openAdmiralModal()" style="padding:var(--sp-lg);min-height:60px">
        <span style="font-size:var(--text-sm)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> Add Admiral</span>
      </div>`;
      return;
    }

    let html = admirals.map((a, i) => {
      let flagshipHtml = '';
      let admiralImgUrl = null;
      if (a.type === 'Famous' && a.shipKey) {
        const flagship = shipDB[currentFleet.faction]?.groups?.famous_admirals?.ships?.[a.shipKey];
        if (flagship) {
          admiralImgUrl = flagship.image || null;
          const fsName = flagship.ship_name || flagship.className || (flagship.tonnage ? flagship.tonnage + ' Ship' : 'Ship');
          const fsSize = flagship.shipCategory ? (CATEGORY_LABELS[flagship.shipCategory] || '') : '';
          // The flagship is a ship on the table: its card sits in the middle and
          // opens the full datasheet. The admiral card here just links to it.
          flagshipHtml = `<button class="admiral-flagship-link" onclick="App.openShipDetail('${currentFleet.faction}','famous_admirals','${a.shipKey}',false)" title="Open the flagship datasheet">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11l6-8 6 8M3 11h10l-1 3H4z"/></svg>
            <span>Flagship: <strong>${esc(fsName)}</strong>${fsSize ? `, ${esc(fsSize)}` : ''}</span>
          </button>`;
        }
      }
      return `
      <div class="admiral-card" style="margin-bottom:var(--sp-sm)">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-md" style="min-width:0">
            ${admiralThumb(a.level, admiralImgUrl)}
            <div style="min-width:0">
              <div class="admiral-name">${esc(a.name)}</div>
              <div class="admiral-level">Level ${a.level || '?'}${a.type !== 'Generic' ? ', ' + a.type : ''}</div>
            </div>
          </div>
          <span class="badge badge-gold">${a.points} pts</span>
        </div>
        ${flagshipHtml}
        ${renderAdmiralAssignment(a, i)}
        ${renderAdmiralAbilities(a, i)}
        <div class="flex gap-xs" style="margin-top:var(--sp-sm)">
          <button class="btn btn-danger btn-sm" onclick="App.removeAdmiral(${i})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
        </div>
      </div>`;
    }).join('');

    html += `
    <div class="add-ship-area" onclick="App.openAdmiralModal()" style="padding:var(--sp-sm) var(--sp-lg);min-height:40px;margin-top:var(--sp-xs)">
      <span style="font-size:var(--text-xs)">+ Add Another Admiral</span>
    </div>`;

    slot.innerHTML = html;
  }

  // ── Space Station ──
  function renderStationSlot() {
    const slot = document.getElementById('station-slot');
    if (!currentFleet || !slot) return;
    const station = currentFleet.spaceStation;

    if (!station) {
      slot.innerHTML = `
      <button class="station-add-optional" onclick="App.openStationModal()">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z"/><path d="M8 8v7M2 4.5L8 8l6-3.5"/></svg>
        <span class="opt-tag">(Optional)</span> Add Space Station
      </button>`;
      return;
    }

    // Show station stats inline
    const ss = station;
    recalcStationCost(ss);   // keep cost fresh + set baseCost for migrated stations
    const def = stationDefFor(ss);
    const stats = ss.stats || (def && def.stats) || {};
    const specialRules = (ss.specialRules || []).map(r => r.name || '').filter(Boolean);
    const rulesLine = specialRules.length > 0
      ? `<div class="station-rules">${specialRules.map(r => `<span class="rule-chip rule-chip-sm">${esc(r)}</span>`).join('')}</div>`
      : '';

    // Fixed weapons / launch loads / station rules (faction-specific stations)
    const weapons = (def && def.weapons) || [];
    const weaponSheet = weapons.length
      ? `<div class="weapon-list" style="margin-top:var(--sp-sm)">${renderWeaponHeader()}${weapons.map(renderWeaponRow).join('')}</div>`
      : '';
    // Launch assets rendered as the full ship-style table (Launch/Load/Thrust/
    // Att/Lock/Dmg/Special), not a flat badge.
    const loadsLine = def ? renderLaunchTable(currentFleet.faction, def, ss) : '';
    const stationRules = (def && def.stationRules) || [];
    const stationRulesHtml = stationRules.length
      ? `<div style="margin-top:var(--sp-sm)">${stationRules.map(r => `<div style="margin-bottom:var(--sp-sm);font-size:var(--text-sm);line-height:1.45"><strong>${esc(r.name)}:</strong> ${linkKeywords(r.effect || '')}</div>`).join('')}</div>`
      : '';
    // Generic Small/Medium/Large stations choose modules in a modal (Hobgoblin
    // style). The card shows the chosen modules + a button to open the picker.
    const spec = stationArmamentSpec(ss);
    // Weapons contributed by the selected upgrade (e.g. Defence Grid adds 5 weapons).
    let upgradeWeaponSheet = '';
    if (spec && ss.systems) {
      const upgradeWpns = [];
      ss.systems.forEach(name => {
        const opt = spec.options.find(o => o.name === name);
        if (opt && opt.weapons && opt.weapons.length) upgradeWpns.push(...opt.weapons);
      });
      if (upgradeWpns.length) upgradeWeaponSheet = `<div class="weapon-list" style="margin-top:var(--sp-sm)">${renderWeaponHeader()}${upgradeWpns.map(renderWeaponRow).join('')}</div>`;
    }
    let pickerHtml = '';
    if (spec) {
      const sum = summariseStation(ss);
      const chosen = (ss.systems && ss.systems.length)
        ? `<div class="station-rules" style="margin-top:var(--sp-xs)">${ss.systems.map(n => `<span class="badge badge-neutral">${esc(n)}</span>`).join('')}</div>`
        : '';
      const done = sum.armTotal === spec.required;
      pickerHtml = `${chosen}
        <button class="btn ${done ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="App.openStationArmaments()" style="margin-top:var(--sp-sm)">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13"/></svg>
          ${ss.systems && ss.systems.length ? 'Edit modules' : 'Choose modules'} (${sum.armTotal}/${spec.required})
        </button>`;
    }

    const stationArt = stationArtPath(currentFleet.faction, ss);
    slot.innerHTML = `
    <div class="station-card">
      ${stationArt ? `<div class="station-card-art"><img src="${stationArt}" alt="${esc(ss.name)}" loading="lazy" onerror="this.closest('.station-card-art').remove()"></div>` : ''}
      <div class="flex items-center justify-between">
        <div>
          <div class="station-name">${esc(ss.name)}</div>
        </div>
        <span class="badge badge-gold">${ss.cost} pts</span>
      </div>
      ${renderStatGrid(stats)}
      ${rulesLine}
      ${weaponSheet}
      ${upgradeWeaponSheet}
      ${loadsLine}
      ${stationRulesHtml}
      ${pickerHtml}
      <div class="flex gap-xs" style="margin-top:var(--sp-sm)">
        <button class="btn btn-outline btn-sm" onclick="App.openStationModal()"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 1l4 4-9 9H2v-4L11 1z"/></svg> Change</button>
        <button class="btn btn-danger btn-sm" onclick="App.removeStation()"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
      </div>
    </div>`;
  }

  function openStationModal() {
    if (!currentFleet) return;
    const factionInfo = shipDB[currentFleet.faction];
    if (!factionInfo) return;

    const stations = factionInfo.spaceStations || [];
    const container = document.getElementById('station-options');
    if (!container) return;

    const currentId = currentFleet.spaceStation ? currentFleet.spaceStation.id : null;

    container.innerHTML = stations.map(ss => {
      const stats = ss.stats || {};
      const specialRules = (ss.specialRules || []).map(r => r.name || '').filter(Boolean);
      const specialStr = ss.special && ss.special !== '-' ? ss.special : '';
      const rulesLine = specialRules.length > 0
        ? `<div class="station-modal-rules">${specialRules.map(r => {
            const desc = r.description || lookupRule(r);
            if (desc) {
              return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(typeof desc === 'string' ? desc : '')}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r)}</span>`;
            }
            return `<span class="rule-chip">${esc(r)}</span>`;
          }).join('')}</div>`
        : specialStr
          ? `<div class="station-modal-rules">${renderWeaponSpecialChips(specialStr)}</div>`
          : '';

      const isCurrent = ss.id === currentId;
      const optArt = stationArtPath(currentFleet.faction, ss);
      // Show the station's guns in the picker so you can compare before choosing.
      const wpns = ss.weapons || [];
      const wpnHtml = wpns.length
        ? `<div class="weapon-list" style="margin-top:var(--sp-xs)">${renderWeaponHeader()}${wpns.map(renderWeaponRow).join('')}</div>`
        : '';
      const launchHtml = renderLaunchTable(currentFleet.faction, ss, ss);
      const genericNote = (!wpns.length && !launchHtml)
        ? `<div class="text-caption" style="margin-top:var(--sp-xs)">Choose its armaments after adding it.</div>`
        : '';
      return `<div class="station-option${isCurrent ? ' station-option-active' : ''}" onclick="App.selectStation('${ss.id}')">
        <div class="flex items-center justify-between" style="margin-bottom:var(--sp-xs)">
          <span class="station-option-name">${optArt ? `<span class="station-option-thumb"><img src="${thumbUrl(optArt)}" alt="" loading="lazy" onerror="this.closest('.station-option-thumb').remove()"></span>` : ''}${esc(ss.name)}${isCurrent ? ' <span class="badge badge-navy" style="font-size: 12px">Current</span>' : ''}</span>
          <span class="badge badge-gold">${ss.cost} pts</span>
        </div>
        ${renderStatGrid(stats)}
        ${rulesLine}
        ${wpnHtml}
        ${launchHtml}
        ${genericNote}
      </div>`;
    }).join('');

    openModal('modal-station');
  }

  function selectStation(stationId) {
    if (!currentFleet) return;
    const factionInfo = shipDB[currentFleet.faction];
    if (!factionInfo) return;
    const station = (factionInfo.spaceStations || []).find(ss => ss.id === stationId);
    if (!station) return;

    currentFleet.spaceStation = {
      id: station.id,
      name: station.name,
      baseCost: station.cost,
      cost: station.cost,
      stats: station.stats,
      specialRules: station.specialRules,
      systems: []
    };

    saveFleets();
    closeModal('modal-station');
    renderStationSlot();
    updatePoints();
    showToast(`${station.name} selected`);

    // If the station has required modules (generic Small/Med/Large), pop the
    // modules modal straight away so the player fills them in.
    const spec = stationArmamentSpec(currentFleet.spaceStation);
    if (spec && spec.required > 0) openStationArmaments();
  }

  /* ── Station hardpoints (generic Small/Medium/Large) ───────
     Mirror of the mobile logic: generic stations draw from the universal
     stationArmaments (Weapon Systems + Structures fill the 1/2/3 count;
     Upgrades are extra, cap 1/1/2). Faction-specific stations are fixed. */
  function stationArmamentSpec(station) {
    const SA = rawFleetData && rawFleetData.stationArmaments;
    if (!SA || !SA.requiredBySize) return null;
    const required = SA.requiredBySize[station.name];
    if (required == null) return null;
    return { required, upgradeCap: (SA.upgradeCapBySize || {})[station.name] || 0, options: SA.options || [] };
  }
  function stationOpt(name) {
    const SA = rawFleetData && rawFleetData.stationArmaments;
    return (SA && SA.options || []).find(o => o.name === name) || null;
  }
  function stationDefFor(station) {
    const fdb = shipDB[currentFleet && currentFleet.faction];
    // Match on id, the mobile/shared `stationKey`, or name — so a station that came
    // from a share link or mobile (which store no inline stats) still resolves.
    return (fdb && fdb.spaceStations || []).find(x => x.id === station.id || x.id === station.stationKey || x.name === station.name) || null;
  }
  function recalcStationCost(station) {
    const def = stationDefFor(station);
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
    return armTotal < spec.required;
  }
  function addStationSystem(name) {
    if (!currentFleet || !currentFleet.spaceStation) return;
    const st = currentFleet.spaceStation;
    const spec = stationArmamentSpec(st); const opt = stationOpt(name);
    if (!spec || !opt || !canAddStationOption(st, opt, spec)) return;
    st.systems = st.systems || []; st.systems.push(name);
    recalcStationCost(st); saveFleets(); renderStationSlot(); renderStationArmamentsModal(); updatePoints();
  }
  function removeStationSystem(name) {
    if (!currentFleet || !currentFleet.spaceStation) return;
    const st = currentFleet.spaceStation;
    const i = (st.systems || []).lastIndexOf(name); if (i < 0) return;
    st.systems.splice(i, 1);
    recalcStationCost(st); saveFleets(); renderStationSlot(); renderStationArmamentsModal(); updatePoints();
  }
  function renderStationArmamentPicker(station, spec) {
    const { counts, armTotal } = summariseStation(station);
    const complete = armTotal === spec.required;
    const byCat = {};
    spec.options.forEach(o => { (byCat[o.category] = byCat[o.category] || []).push(o); });
    const stepper = (o, c, canAdd) => `<div class="sys-opt-step">
            <button class="sys-step-btn" aria-label="Remove one ${esc(o.name)}" ${c <= 0 ? 'disabled' : ''} onclick="App.removeStationSystem('${esc(o.name).replace(/'/g, "\\'")}')">−</button>
            <span class="sys-opt-count">${c}</span>
            <button class="sys-step-btn" aria-label="Add one ${esc(o.name)}" ${canAdd ? '' : 'disabled'} onclick="App.addStationSystem('${esc(o.name).replace(/'/g, "\\'")}')">+</button>
          </div>`;
    const body = Object.keys(byCat).map(cat => {
      const opts = byCat[cat];
      // Weapon armaments share ONE table (single header), each weapon a row with
      // its stats + cost + the +/- stepper inline — no repeated per-weapon table.
      const isWeaponCat = opts.every(o => o.weapons && o.weapons.length);
      if (isWeaponCat) {
        const head = `<div class="weapon-row weapon-row-header station-arm-row">
          <span class="weapon-col weapon-col-name">Weapon</span>
          <span class="weapon-col weapon-col-arc">Arc</span>
          <span class="weapon-col weapon-col-att">Att</span>
          <span class="weapon-col weapon-col-lock">Lk</span>
          <span class="weapon-col weapon-col-dmg">Dmg</span>
          <span class="weapon-col weapon-col-special">Special</span>
          <span class="weapon-col station-arm-pts">Pts</span>
          <span class="weapon-col station-arm-qty"></span>
        </div>`;
        const wrows = opts.map(o => {
          const c = counts[o.name] || 0;
          const canAdd = canAddStationOption(station, o, spec);
          const w = o.weapons[0];
          const star = o.oncePerStation ? '<span class="sys-opt-star" title="Max one">*</span>' : '';
          const typeTag = w.type ? `<span class="dmg-type dmg-type-${esc(w.type)}">${esc(w.type)}</span>` : '';
          const arcCell = ARC_ICONS[w.arc] ? ARC_ICONS[w.arc] + '<span class="arc-label">' + esc(w.arc || '') + '</span>' : esc(w.arc || '');
          return `<div class="weapon-row station-arm-row${c > 0 ? ' sys-opt-active' : ''}">
            <span class="weapon-col weapon-col-name">${esc(o.name)}${star}</span>
            <span class="weapon-col weapon-col-arc" title="${ARC_LABELS[w.arc] || w.arc || ''}">${arcCell}</span>
            <span class="weapon-col weapon-col-att">${w.attack}</span>
            <span class="weapon-col weapon-col-lock">${w.lock}</span>
            <span class="weapon-col weapon-col-dmg">${w.damage}${typeTag}</span>
            <span class="weapon-col weapon-col-special">${w.special && w.special !== '-' ? renderWeaponSpecialChips(w.special) : ''}</span>
            <span class="weapon-col station-arm-pts">${o.cost > 0 ? '+' + o.cost : o.cost}</span>
            <span class="weapon-col station-arm-qty">${stepper(o, c, canAdd)}</span>
          </div>`;
        }).join('');
        // No category header for weapons — the table's "Weapon" column header
        // already labels it (the "Weapon Systems" heading was redundant).
        return `<div class="sys-cat"><div class="weapon-list station-arm-list">${head}${wrows}</div></div>`;
      }
      // Launch modules show their full launch-asset statblock; upgrades with weapons
      // (e.g. Defence Grid) show a weapon table; Structures/effect-only options show
      // their short effect line.
      const rows = opts.map(o => {
        const c = counts[o.name] || 0;
        const canAdd = canAddStationOption(station, o, spec);
        const hasWeapons = o.weapons && o.weapons.length;
        const isLaunch = o.loads && o.loads.length;
        const summary = (!hasWeapons && !isLaunch && o.effect) ? `<span class="sys-opt-detail">${esc(o.effect)}</span>` : '';
        const sheet = hasWeapons
          ? `<div class="weapon-list sys-opt-sheet">${renderWeaponHeader()}${o.weapons.map(w => renderWeaponRow(w)).join('')}</div>`
          : (isLaunch ? buildLaunchTable(currentFleet.faction, o.loads, true) : '');
        const star = o.oncePerStation ? '<span class="sys-opt-star" title="Max one">*</span>' : '';
        return `<div class="sys-opt${c > 0 ? ' sys-opt-active' : ''}">
          ${stationOptThumb(o.name)}<div class="sys-opt-main"><span class="sys-opt-name">${esc(o.name)}${star}</span>${summary}</div>
          <span class="sys-opt-cost">${o.cost > 0 ? '+' + o.cost : o.cost} pts</span>
          ${stepper(o, c, canAdd)}
          ${sheet}
        </div>`;
      }).join('');
      return `<div class="sys-cat"><div class="sys-cat-head">${esc(cat)}</div>${rows}</div>`;
    }).join('');
    return `<div class="systems-picker${complete ? '' : ' systems-picker-incomplete'}">
      <div class="systems-picker-head">
        <span class="systems-picker-title">Armaments, choose ${spec.required}</span>
        <span class="systems-picker-count">${armTotal} / ${spec.required}</span>
      </div>
      ${body}
    </div>`;
  }

  // Module picker as a modal (Hobgoblin-style) for the generic stations.
  function openStationArmaments() {
    if (!currentFleet || !currentFleet.spaceStation) return;
    if (!stationArmamentSpec(currentFleet.spaceStation)) return;
    renderStationArmamentsModal();
    openModal('modal-station-armaments');
  }
  function renderStationArmamentsModal() {
    const body = document.getElementById('station-armaments-body');
    const st = currentFleet && currentFleet.spaceStation;
    if (!body || !st) return;
    const spec = stationArmamentSpec(st);
    body.innerHTML = spec ? renderStationArmamentPicker(st, spec) : '';
    const title = document.getElementById('station-armaments-title');
    if (title) title.textContent = `${st.name} Modules`;
  }

  function removeStation() {
    if (!currentFleet || !currentFleet.spaceStation) return;
    const name = currentFleet.spaceStation.name;
    currentFleet.spaceStation = null;
    saveFleets();
    renderStationSlot();
    updatePoints();
    showToast(`${name} removed`);
  }

  // ── Print / Share ──
  // Dense print helpers. These emit compact, self-contained markup styled the SAME
  // on screen (in the preview) as on paper — so the preview is WYSIWYG and a fleet
  // fits onto a few readable pages (Army-App / Hobgoblin style), instead of reusing
  // the big on-screen stat cells whose compact form only existed inside @media print.
  const DP_STAT_ORDER = [['scan', 'Scan'], ['sig', 'Sig'], ['thrust', 'Thr'], ['hull', 'Hull'], ['es', 'ES'], ['ks', 'KS'], ['bs', 'BS']];
  function dpStatLine(stats, mods) {
    const cells = DP_STAT_ORDER.map(([k, lab]) => {
      const v = stats[k];
      if (v === undefined || v === 0 || v === '-' || v === '--') return '';
      const mod = mods && mods[k] ? ' dp-stat-mod' : '';
      return `<span class="dp-stat${mod}"><b>${lab}</b> ${esc(String(v))}</span>`;
    }).filter(Boolean).join('');
    return cells ? `<div class="dp-statline">${cells}</div>` : '';
  }
  // weapons: array of {name, arc, attack, lock, damage, type, special, qty?}
  function dpWeaponTable(weapons) {
    if (!weapons.length) return '';
    const body = weapons.map(w => {
      const dmg = `${esc(w.damage || '')}${w.type ? ' ' + esc(w.type) : ''}`;
      const special = (w.special && w.special !== '-') ? esc(w.special) : '';
      const nm = `${w.qty > 1 ? w.qty + '× ' : ''}${esc(w.name || '')}`;
      return `<tr><td class="dp-w-name">${nm}</td><td>${esc(w.arc || '')}</td><td>${esc(w.attack || '')}</td><td>${esc(w.lock || '')}</td><td>${dmg}</td><td class="dp-w-spec">${special}</td></tr>`;
    }).join('');
    return `<table class="dp-weapons"><thead><tr><th class="dp-w-name">Weapon</th><th>Arc</th><th>Att</th><th>Lk</th><th>Dmg</th><th class="dp-w-spec">Special</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  function dpHullTrack(hull, count) {
    const h = parseInt(hull, 10);
    if (!h || h <= 0) return '';
    const crip = Math.ceil(h / 2);
    const track = (label) => `<div class="dp-hull"><span class="dp-hull-lab">${esc(label)}</span><span class="dp-hull-boxes">${Array.from({ length: h }, (_, i) => `<span class="dp-box${i + 1 === crip ? ' dp-box-crip' : ''}"></span>`).join('')}</span></div>`;
    if (count <= 1) return track('Hull');
    return Array.from({ length: count }, (_, i) => track('#' + (i + 1))).join('');
  }

  function buildFullPrintHTML(f) {
    const fName = (factionData[f.faction] || {}).name || f.faction.toUpperCase();
    const pts = calcFleetPoints(f);
    const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const factionInfo = shipDB[f.faction];

    // Collect all special rules used across the fleet for the rules glossary
    const rulesGlossary = {};

    // Fleet composition summary
    const totalShips = f.battleGroups.reduce((t, g) => t + g.ships.length, 0);
    const totalGroups = f.battleGroups.length;
    const admCount = (f.admirals || []).length;

    // Validation warnings
    const warnings = validateFleet(f);
    const printWarnings = warnings.length > 0
      ? `<div class="print-warnings">${warnings.map(w =>
          `<div class="print-warning print-warning-${w.type}">${esc(w.msg)}</div>`
        ).join('')}</div>`
      : '';

    const fIcon = FACTION_ICONS[f.faction];

    // Fleet description
    const descHtml = f.description
      ? `<div class="print-desc">${esc(f.description)}</div>`
      : '';

    let html = `<div class="print-fleet${settings.print2col ? ' print-2col' : ''}" data-fleet-name="${esc(f.name)}">
      <div class="print-header">
        <div class="print-header-top">
          ${fIcon ? `<img src="${fIcon}" alt="" class="print-faction-icon">` : ''}
          <div class="print-header-text">
            <div class="print-fleet-name">${esc(f.name)}</div>
            <div class="print-fleet-meta">${esc(fName)}, ${sizeInfo.label}</div>
          </div>
          <div class="print-header-points">
            <div class="print-points-big">${pts}</div>
            <div class="print-points-cap">${effMax(f) !== 99999 ? '/ ' + effMax(f) : ''} pts</div>
          </div>
        </div>
        <div class="print-fleet-summary">${totalGroups} group${totalGroups !== 1 ? 's' : ''}, ${totalShips} ship${totalShips !== 1 ? 's' : ''}${admCount > 0 ? `, ${admCount} admiral${admCount !== 1 ? 's' : ''}` : ''}${f.spaceStation ? `, ${esc(f.spaceStation.name)}${(f.spaceStation.systems && f.spaceStation.systems.length) ? ' (' + f.spaceStation.systems.map(esc).join(', ') + ')' : ''}` : ''}</div>
      </div>
      ${descHtml}
      ${printWarnings}`;

    // Admirals
    if (f.admirals && f.admirals.length > 0) {
      const factionAdmirals = factionInfo ? factionInfo.admirals || [] : [];
      html += `<div class="print-section">
        <div class="print-section-title">Admiral${f.admirals.length > 1 ? 's' : ''}</div>
        ${f.admirals.map(a => {
          const info = getAdmiralAbilityInfo(a);
          const abilityLine = ab => `<div class="print-admiral-ability"><span class="print-ability-name">${esc(ab.name)}</span>${ab.cost ? ` <span class="print-ability-cost">${esc(ab.cost)}</span>` : ''}${ab.effect ? `, ${esc(ab.effect)}` : ''}</div>`;
          let abilitiesHtml = '';
          if (info) {
            const chosen = (a.selectedAbilities || [])
              .map(n => info.table.find(t => t.name === n)).filter(Boolean);
            if (info.innate.length) {
              abilitiesHtml += `<div class="print-admiral-abilities">${info.innate.map(abilityLine).join('')}</div>`;
            }
            if (chosen.length) {
              abilitiesHtml += `<div class="print-admiral-abilities"><div class="print-admiral-ability-sublabel">Chosen Abilities</div>${chosen.map(abilityLine).join('')}</div>`;
            }
          }
          // Famous admirals: print the flagship datasheet (stats + weapons).
          let flagshipHtml = '';
          if (a.type === 'Famous' && a.shipKey) {
            const fsp = factionInfo?.groups?.famous_admirals?.ships?.[a.shipKey];
            if (fsp) {
              const fsName = fsp.ship_name || fsp.className || (fsp.tonnage ? fsp.tonnage + ' Ship' : 'Ship');
              const fsSize = fsp.shipCategory ? (CATEGORY_LABELS[fsp.shipCategory] || '') : '';
              const wpns = fsp.weapons || [];
              flagshipHtml = `<div class="dp-flagship">
                <div class="dp-flagship-name">${esc(fsName)}${fsSize ? ', ' + fsSize : ''}${fsp.ship_cost ? ` (${fsp.ship_cost} pts)` : ''}</div>
                ${dpStatLine(fsp, null)}
                ${dpWeaponTable((wpns || []).map(w => ({ ...w })))}
                ${(fsp.specialRuleDetails || []).filter(r => r.description).length ? `<div class="dp-rules">${fsp.specialRuleDetails.filter(r => r.description).map(r => `<span class="dp-rule"><b>${esc(r.name)}:</b> ${ruleHtml(r.description)}</span>`).join('')}</div>` : ''}
              </div>`;
            }
          }
          return `<div class="print-admiral-card">
            <div class="print-admiral-header">
              <span class="print-admiral-name">${esc(a.name)}, Level ${a.level || '?'}${a.type === 'Famous' ? ' (Famous)' : ''}</span>
              <span class="print-admiral-pts">${a.points} pts</span>
            </div>
            ${flagshipHtml}
            ${abilitiesHtml}
          </div>`;
        }).join('')}
      </div>`;
    }

    // Space Station
    if (f.spaceStation) {
      const ss = f.spaceStation;
      // Shared/mobile stations store no inline stats/weapons — fall back to the def.
      const ssDef = stationDefFor(ss);
      const ssStats = ss.stats || (ssDef && ssDef.stats) || {};
      const ssRules = ((ss.specialRules && ss.specialRules.length ? ss.specialRules : (ssDef && ssDef.specialRules) || [])).map(r => esc(r.name || '')).filter(Boolean).join(', ');
      const ssWeaponsList = (ss.weapons && ss.weapons.length) ? ss.weapons : ((ssDef && ssDef.weapons) || []);
      const ssWeaponsHtml = ssWeaponsList.length ? dpWeaponTable(ssWeaponsList.map(w => ({ ...w }))) : '';
      html += `<div class="print-section">
        <div class="print-section-title">Space Station</div>
        <div class="dp-ship">
          <div class="dp-ship-head">
            <span class="dp-name">${esc(ss.name)}</span>
            <span class="dp-pts">${ss.cost} pts</span>
          </div>
          ${dpStatLine(ssStats, null)}
          ${ssWeaponsHtml}
          ${ssRules ? `<div class="dp-systems"><b>Rules:</b> ${ssRules}</div>` : ''}
          ${dpHullTrack(ssStats.hull, 1)}
        </div>
      </div>`;
      // Collect station rules for glossary
      (ss.specialRules || []).forEach(r => {
        if (r.description) rulesGlossary[r.name] = { description: r.description, page: r.page || '' };
      });
    }

    // Groups — dense, self-contained datasheets that read the same on screen (in the
    // preview) as on paper. System/loadout weapons merge into the weapon table.
    const allLaunchAssetNames = new Set();
    let groupsHtml = '';
    f.battleGroups.forEach(g => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      const gCat = g.ships.length > 0 ? (g.ships[0].groupCategory || 'medium') : 'medium';
      const gCatLabel = CATEGORY_LABELS[gCat] || gCat;
      groupsHtml += `<div class="dp-group">
        <div class="dp-group-head">
          <span class="dp-group-name">${esc(g.name)} <span class="dp-group-cat dp-group-cat-${gCat}">${gCatLabel}</span></span>
          <span class="dp-group-pts">${gPts} pts · ${g.ships.length} ship${g.ships.length !== 1 ? 's' : ''}</span>
        </div>`;

      // Collapse identical ships (same loadout/systems/feature) into one card with N hull tracks.
      const shipBuckets = [];
      g.ships.forEach(ship => {
        const bucketKey = `${ship.shipKey}:${ship.groupCategory}:${JSON.stringify(ship.loadouts || {})}:${JSON.stringify(ship.systems || [])}:${ship.feature || ''}`;
        let bucket = shipBuckets.find(b => b.key === bucketKey);
        if (!bucket) { bucket = { key: bucketKey, ship, count: 0 }; shipBuckets.push(bucket); }
        bucket.count++;
      });

      shipBuckets.forEach(({ ship, count }) => {
        const db = findShipInDB(f.faction, ship.groupCategory, ship.shipKey);
        if (!db) return;
        const name = db.name;
        const eff = effectiveStats(db, ship, f.faction);

        // Weapons: base + selected loadout + selected system/hardpoint weapons, all
        // merged into one table (so "systems that are weapons" read as weapon rows).
        const weaponRows = (db.weapons || []).map(w => ({ ...w }));
        (db.loadoutOptions || []).forEach((lo, loIdx) => {
          const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
          const selOpt = lo.options[selIdx];
          if (selOpt && selOpt.weapons) selOpt.weapons.forEach(w => weaponRows.push({ ...w }));
        });
        // Loads: base + selected loadout.
        const allLoads = [...(db.loads || [])];
        (db.loadoutOptions || []).forEach((lo, loIdx) => {
          const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
          const selOpt = lo.options[selIdx];
          if (selOpt && selOpt.loads) allLoads.push(...selOpt.loads);
        });
        // Selected systems: weapon options → the weapon table, load options → launch,
        // everything else → a short note line.
        const nonWeaponSystems = [];
        const sysList = systemsListFor(db, f.faction);
        if (sysList && ship.systems && ship.systems.length) {
          const counts = {};
          ship.systems.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
          Object.entries(counts).forEach(([nm, c]) => {
            const o = findSystemOption(sysList, nm);
            if (!o) return;
            if (o.weapons && o.weapons.length) o.weapons.forEach(w => weaponRows.push({ ...w, name: w.name || nm, qty: c }));
            else if (o.loads && o.loads.length) o.loads.forEach(l => allLoads.push({ ...l, name: (c > 1 ? c + '× ' : '') + l.name }));
            else nonWeaponSystems.push(`${c > 1 ? c + '× ' : ''}${nm}${o.effect ? ', ' + o.effect : ''}`);
          });
        }

        // Glossary + spelled-out rules. Ship rules + every weapon special (incl.
        // system weapons); plus High Power whenever a weapon carries Overcharge.
        (db.specialRuleDetails || []).forEach(r => { if (r.description) rulesGlossary[r.name] = { description: r.description, page: r.page || '' }; });
        const weaponSpecials = {};
        let hasOvercharge = false;
        weaponRows.forEach(w => {
          if (!w.special || w.special === '-') return;
          if (/\bOvercharge\b/i.test(w.special)) hasOvercharge = true;
          w.special.split(',').forEach(s => {
            const t = s.trim(); if (!t) return;
            const full = lookupRuleFull(t);
            if (full) {
              const baseKey = t.replace(/-?\d+$/, '').replace(/\s+\d+$/, '').trim() || t;
              rulesGlossary[baseKey] = { description: full.description, page: full.page || '' };
              weaponSpecials[t] = { description: full.description, page: full.page || '' };
            }
          });
        });
        if (hasOvercharge) {
          const hp = lookupRuleFull('High Power');
          if (hp && hp.description) { rulesGlossary['High Power'] = { description: hp.description, page: hp.page || '' }; weaponSpecials['High Power'] = { description: hp.description, page: hp.page || '' }; }
        }

        // Launch line + feed the fleet launch-asset reference.
        let loadsHtml = '';
        if (allLoads.length) {
          loadsHtml = `<div class="dp-loads"><b>Launch:</b> ${allLoads.map(l => {
            allLaunchAssetNames.add(String(l.name).replace(/^\d+×\s*/, ''));
            return `${esc(String(l.name))} (${esc(String(l.launch))}${l.special && l.special !== '-' ? ', ' + esc(l.special) : ''})`;
          }).join('; ')}</div>`;
        }
        const sysHtml = nonWeaponSystems.length
          ? `<div class="dp-systems"><b>${esc(db.systemSelection ? db.systemSelection.listName : 'Systems')}:</b> ${esc(nonWeaponSystems.join('; '))}</div>` : '';
        let featHtml = '';
        if (ship.feature) {
          const feat = ((shipDB[f.faction] || {}).deployableFeatures || []).find(df => df.name === ship.feature);
          const fStat = feat ? (feat.features || []).map(x => `${x.name}${x.es ? ` ES ${x.es}` : ''}${x.ks ? ` KS ${x.ks}` : ''}${x.special && x.special !== '-' ? `, ${x.special}` : ''}`).join('; ') : '';
          featHtml = `<div class="dp-systems"><b>Deployable Feature:</b> ${esc(ship.feature)}${fStat ? ', ' + esc(fStat) : ''}</div>`;
        }

        // Spelled-out rules: ship rules first, then weapon abilities (incl. High Power).
        const ruleEntries = [];
        (db.specialRuleDetails || []).forEach(r => { if (r.description) ruleEntries.push([r.name, r.description, r.page || '']); });
        Object.entries(weaponSpecials).forEach(([n, e]) => { if (!ruleEntries.some(([rn]) => rn === n)) ruleEntries.push([n, e.description, e.page || '']); });
        const rulesHtml = ruleEntries.length
          ? `<div class="dp-rules">${ruleEntries.map(([n, d, p]) => `<span class="dp-rule"><b>${esc(n)}${p ? ` p.${esc(p)}` : ''}:</b> ${ruleHtml(d)}</span>`).join('')}</div>` : '';

        const tonnageLabel = tonLabel(db.tonnage) || CATEGORY_LABELS[ship.groupCategory] || '';
        const badge = db.isUnique ? ' <span class="dp-badge">Unique</span>' : db.isRare ? ' <span class="dp-badge">Rare</span>' : '';
        const qtyPrefix = count > 1 ? `${count}× ` : '';
        const totalPts = ship.points * count;

        groupsHtml += `<div class="dp-ship">
          <div class="dp-ship-head">
            <span class="dp-name">${esc(qtyPrefix)}${esc(name)}${tonnageLabel ? ` <span class="dp-ton">${esc(tonnageLabel)}</span>` : ''}${badge}</span>
            <span class="dp-pts">${count > 1 ? `${totalPts} pts <span class="dp-each">(${ship.points} ea)</span>` : `${ship.points} pts`}</span>
          </div>
          ${dpStatLine(eff.stats, eff.mods)}
          ${dpWeaponTable(weaponRows)}
          ${loadsHtml}
          ${sysHtml}
          ${featHtml}
          ${rulesHtml}
          ${dpHullTrack(db.hull, count)}
        </div>`;
      });

      groupsHtml += '</div>';
    });
    html += `<div class="dp-groups${settings.print2col ? ' dp-2col' : ''}">${groupsHtml}</div>`;

    // Launch asset reference for the whole fleet
    if (factionInfo && factionInfo.launchAssets && allLaunchAssetNames.size > 0) {
      const relevantAssets = [];
      const seenNames = new Set();
      allLaunchAssetNames.forEach(loadName => {
        loadName.split(/\s*&\s*/).forEach(part => {
          const key = part.trim().toLowerCase();
          if (!seenNames.has(key)) {
            const match = factionInfo.launchAssets.find(a => a.name.toLowerCase() === key);
            if (match) { seenNames.add(key); relevantAssets.push(match); }
          }
        });
      });
      if (relevantAssets.length > 0) {
        html += renderLaunchAssetReference(relevantAssets);
      }
    }

    // Fleet totals summary
    const admPts = (f.admirals || []).reduce((t, a) => t + (a.points || 0), 0);
    const stationPts = f.spaceStation ? (f.spaceStation.cost || 0) : 0;
    const shipPts = pts - admPts - stationPts;
    const groupPtsList = f.battleGroups.map(g => {
      const gp = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      return `<span class="print-totals-item">${esc(g.name)}: ${gp}</span>`;
    }).join('');

    html += `<div class="print-totals">
      <div class="print-totals-header">Fleet Summary</div>
      <div class="print-totals-grid">
        <div class="print-totals-row">
          <span class="print-totals-label">Ships</span>
          <span class="print-totals-value">${shipPts} pts</span>
        </div>
        ${admPts > 0 ? `<div class="print-totals-row">
          <span class="print-totals-label">Admirals</span>
          <span class="print-totals-value">${admPts} pts</span>
        </div>` : ''}
        ${stationPts > 0 ? `<div class="print-totals-row">
          <span class="print-totals-label">Space Station</span>
          <span class="print-totals-value">${stationPts} pts</span>
        </div>` : ''}
        <div class="print-totals-row print-totals-total">
          <span class="print-totals-label">Total</span>
          <span class="print-totals-value">${pts}${effMax(f) !== 99999 ? ' / ' + effMax(f) : ''} pts</span>
        </div>
      </div>
      <div class="print-totals-breakdown">${groupPtsList}</div>
    </div>`;

    // No separate rules glossary: every rule is already spelled out on each ship card
    // above, so the player reads it in place (no page-flipping) and the sheet stays
    // to a few pages. `rulesGlossary` is still collected for potential future use.

    // Secondary objectives (the two chosen for the game), spelled out for the table.
    const secObjList = (f.secondaryObjectives || []).map(n =>
      ((rawFleetData && rawFleetData.secondaryObjectives) || []).find(x => x.name === n) || { name: n, description: '' }
    );
    if (secObjList.length) {
      html += `<div class="print-section">
        <div class="print-section-title">Secondary Objectives</div>
        <div class="dp-rules">${secObjList.map(o => `<span class="dp-rule"><b>${esc(o.name)}:</b> ${o.description ? ruleHtml(o.description) : ''}</span>`).join('')}</div>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  // "Simple Print View" = the plain-text army list (the same New-Recruit-style export
  // as Share), rendered in a clean monospace block so it prints dense and readable.
  function buildSimplePrintHTML(f) {
    const secObjs = (f.secondaryObjectives || []);
    let txt = generateFleetText(f);
    if (secObjs.length) txt += `\n\n## Secondary Objectives\n${secObjs.map(o => '• ' + o).join('\n')}`;
    return `<div class="print-fleet print-simple" data-fleet-name="${esc(f.name)}"><pre class="print-simple-text">${esc(txt)}</pre></div>`;
  }

  function fleetPrintHTML(f) {
    return settings.printSimple ? buildSimplePrintHTML(f) : buildFullPrintHTML(f);
  }

  // Print uses a #print-container the @media print CSS targets.
  function doPrintNow() {
    if (!currentFleet) return;
    // @media print hides everything except #print-container, so the preview
    // overlay can stay open underneath.
    document.getElementById('print-container')?.remove();
    const printDiv = document.createElement('div');
    printDiv.id = 'print-container';
    printDiv.innerHTML = fleetPrintHTML(currentFleet);
    document.body.appendChild(printDiv);
    window.print();
    printDiv.remove();
  }

  // Print Preview: choose options (Simple / 2-column) and see the output before
  // sending it to the browser's print dialog.
  function printFleet() {
    if (!currentFleet) return;
    openPrintPreview();
  }
  function openPrintPreview() {
    if (!currentFleet) return;
    document.getElementById('print-preview-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'print-preview-overlay';
    ov.className = 'print-preview-overlay';
    ov.innerHTML = `
      <div class="print-preview-bar">
        <span class="print-preview-title">Print preview</span>
        <span class="print-preview-spacer"></span>
        <label class="print-preview-opt"><input type="checkbox" id="pp-simple" ${settings.printSimple ? 'checked' : ''}> Simple Print View</label>
        <label class="print-preview-opt"><input type="checkbox" id="pp-2col" ${settings.print2col ? 'checked' : ''} ${settings.printSimple ? 'disabled' : ''}> 2 columns</label>
        <button class="btn btn-outline btn-sm pp-close-btn" id="pp-close" type="button">Close</button>
        <button class="btn btn-primary btn-sm" id="pp-print" type="button">Print</button>
      </div>
      <div class="print-preview-scroll"><div class="print-preview-surface" id="pp-surface">${fleetPrintHTML(currentFleet)}</div></div>`;
    document.body.appendChild(ov);
    const closePreview = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') closePreview(); };
    document.addEventListener('keydown', onKey);
    const refresh = () => { const s = document.getElementById('pp-surface'); if (s) s.innerHTML = fleetPrintHTML(currentFleet); };
    ov.querySelector('#pp-simple').onchange = (e) => { settings.printSimple = e.target.checked; saveSettings(); const c = ov.querySelector('#pp-2col'); if (c) c.disabled = e.target.checked; refresh(); };
    ov.querySelector('#pp-2col').onchange = (e) => { settings.print2col = e.target.checked; saveSettings(); refresh(); };
    ov.querySelector('#pp-close').addEventListener('click', closePreview);
    ov.querySelector('#pp-print').addEventListener('click', doPrintNow);
    // Click on the dark backdrop (outside the page surface) also closes.
    ov.querySelector('.print-preview-scroll').addEventListener('click', (e) => { if (e.target === e.currentTarget) closePreview(); });
  }

  // ── Shared Fleet Viewer ──
  // One ship's datasheet body for the shared-fleet preview: effective stats,
  // weapons (base + selected loadout), launch table, and special rules. Shared by
  // the battle-group ships AND famous-admiral flagships so the flagship lists its
  // full stats like the rest of the fleet.
  function sharedShipDatasheet(fleet, ship, dbShip) {
    if (!dbShip) return '';
    let h = '';
    const eff = effectiveStats(dbShip, ship, fleet.faction);
    h += renderStatGrid(eff.stats, eff.mods);
    const wpns = [...(dbShip.weapons || [])];
    (dbShip.loadoutOptions || []).forEach((lo, i) => {
      const sel = (ship.loadouts && ship.loadouts[i] !== undefined) ? ship.loadouts[i] : 0;
      const opt = lo.options && lo.options[sel];
      if (opt && Array.isArray(opt.weapons)) wpns.push(...opt.weapons);
    });
    if (wpns.length > 0) h += '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
    const lt = renderLaunchTable(fleet.faction, dbShip, ship);
    if (lt) h += lt;
    const rules = dbShip.special_rules || [];
    if (rules.length > 0) {
      h += `<div class="special-rules">${rules.map(r => {
        const detail = (dbShip.specialRuleDetails || []).find(d => d.name === r);
        if (detail && detail.description) {
          const pgA = detail.page ? ` data-rule-page="${esc(detail.page)}"` : '';
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(detail.description)}"${pgA} onclick="App.showRuleTooltip(event, this)">${esc(r)}</span>`;
        }
        return `<span class="rule-chip">${esc(r)}</span>`;
      }).join('')}</div>`;
    }
    return h;
  }

  function showSharedFleet(fleet) {
    document.querySelectorAll('#app > section').forEach(s => s.classList.add('hidden'));
    show('view-shared');

    const topContext = document.getElementById('topbar-context');
    topContext.textContent = 'Shared Fleet';
    document.getElementById('topbar-actions').innerHTML = '';

    const fName = (factionData[fleet.faction] || {}).name || fleet.faction.toUpperCase();
    const pts = calcFleetPoints(fleet);
    const sizeInfo = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    const fIcon = FACTION_ICONS[fleet.faction];

    let html = `
      <div class="shared-fleet-header">
        <div class="shared-header-left">
          ${fIcon ? `<img src="${esc(fIcon)}" alt="${fName}" class="shared-faction-icon">` : ''}
          <div>
            <h1 class="shared-fleet-name">${esc(fleet.name)}</h1>
            <div class="shared-fleet-meta">
              <span class="badge badge-faction badge-${fleet.faction}">${fName}</span>
              <span class="badge badge-neutral">${sizeInfo.label}</span>
              <span class="shared-fleet-sublabel">${sizeInfo.desc}</span>
            </div>
          </div>
        </div>
        <div class="shared-header-right">
          <div class="shared-fleet-points">${pts}<span class="shared-fleet-pts-label"> / ${effMax(fleet)} pts</span></div>
          <div class="shared-fleet-actions">
            <button class="btn btn-primary" onclick="App.importSharedFleet()"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2 13h12"/></svg> Import to My Fleets</button>
            <button class="btn btn-outline" onclick="location.hash='fleets'">My Fleets</button>
          </div>
        </div>
      </div>
    `;

    if (fleet.description) {
      html += `<div class="shared-desc">${esc(fleet.description)}</div>`;
    }

    // Composition summary
    const compCounts = {};
    fleet.battleGroups.forEach(g => {
      g.ships.forEach(s => {
        const ton = s.tonnage || 'Unknown';
        compCounts[ton] = (compCounts[ton] || 0) + 1;
      });
    });
    const COMP_ORDER = ['Light', 'Medium', 'Heavy', 'Super Heavy', 'Colossal'];
    const compParts = COMP_ORDER.filter(t => compCounts[t]).map(t =>
      `<span class="shared-comp-tag shared-comp-${t.toLowerCase().replace(/\s+/g, '-')}">${compCounts[t]} ${t}</span>`
    );
    if (compParts.length > 0) {
      html += `<div class="shared-comp">${compParts.join('')}</div>`;
    }

    if (fleet.admirals && fleet.admirals.length > 0) {
      html += `<div class="shared-section">
        <div class="shared-section-title">Admiral${fleet.admirals.length > 1 ? 's' : ''}</div>
        ${fleet.admirals.map(a => {
          let admiralHtml = `<div class="shared-admiral-card">
            <div class="shared-admiral-info">
              <span class="shared-admiral-name">${esc(a.name)}</span>
              ${a.type === 'Famous' ? '<span class="ship-badge ship-badge-unique">Famous</span>' : ''}
              <span class="shared-admiral-level">Level ${a.level || '?'}</span>
            </div>
            <span class="shared-admiral-pts">${a.points} pts</span>
          </div>`;
          // Famous admirals fly a flagship — show its full datasheet like the rest
          // of the fleet (stats/weapons/launch/rules), not just the admiral line.
          if (a.type === 'Famous' && a.shipKey) {
            const fdb = findShipInDB(fleet.faction, 'famous_admirals', a.shipKey);
            if (fdb) {
              const fimg = shipArtPath(fdb.ship_name || fdb.name) || fdb.image;
              admiralHtml += `<div class="shared-ship-card">
                <div class="shared-ship-top">
                  ${fimg ? `<div class="shared-ship-art"><img src="${esc(thumbUrl(fimg))}" alt="${esc(fdb.ship_name || fdb.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
                  <div class="shared-ship-info">
                    <div class="shared-ship-name">${esc(fdb.ship_name || fdb.name)}</div>
                    <div class="shared-ship-type">${esc(tonLabel(fdb.tonnage) || '')}${fdb.className ? ', ' + esc(fdb.className) : ''}</div>
                  </div>
                </div>
                ${sharedShipDatasheet(fleet, a, fdb)}
              </div>`;
            }
          }
          return admiralHtml;
        }).join('')}
      </div>`;
    }

    if (fleet.spaceStation) {
      const ss = fleet.spaceStation;
      html += `<div class="shared-section">
        <div class="shared-section-title">Space Station</div>
        <div class="shared-admiral-card">
          <span class="shared-admiral-name">${esc(ss.name)}</span>
          <span class="shared-admiral-pts">${ss.cost} pts</span>
        </div>
      </div>`;
    }

    fleet.battleGroups.forEach((g, i) => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      const shipCount = g.ships.length;
      html += `<div class="shared-section">
        <div class="shared-section-title">${esc(g.name)} <span class="text-caption">${shipCount} ship${shipCount !== 1 ? 's' : ''}, ${gPts} pts</span></div>
        <div class="shared-group-ships">`;

      // Group ships by profile
      const profiles = {};
      g.ships.forEach(s => {
        const key = s.groupCategory + '/' + s.shipKey;
        if (!profiles[key]) profiles[key] = { ship: s, count: 0 };
        profiles[key].count++;
      });

      Object.values(profiles).forEach(({ ship, count }) => {
        const dbShip = findShipInDB(fleet.faction, ship.groupCategory, ship.shipKey);
        const name = dbShip ? dbShip.name : ship.shipKey;
        const tonnage = dbShip ? tonLabel(dbShip.tonnage) : '';
        const cat = CATEGORY_LABELS[ship.groupCategory] || ship.groupCategory;
        const img = shipArtPath(name);

        html += `<div class="shared-ship-card">`;
        html += `<div class="shared-ship-top">`;
        if (img) html += `<div class="shared-ship-art"><img src="${esc(thumbUrl(img))}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"></div>`;
        html += `<div class="shared-ship-info">
            <div class="shared-ship-name">${count > 1 ? count + '× ' : ''}${esc(name)}</div>
            <div class="shared-ship-type">${esc(tonnage)}, ${cat}</div>
          </div>
          <div class="shared-ship-pts">${ship.points * count}<span class="shared-ship-pts-label"> pts</span></div>
        </div>`;

        // Show stats if available
        if (dbShip) html += sharedShipDatasheet(fleet, ship, dbShip);

        html += `</div>`;
      });

      html += `</div></div>`;
    });

    const container = document.getElementById('shared-fleet-content');
    container.innerHTML = html;

    // Store temporarily for import
    window._sharedFleet = fleet;
  }

  function importSharedFleet() {
    const fleet = window._sharedFleet;
    if (!fleet) return;

    // Clone and give fresh IDs
    const imported = JSON.parse(JSON.stringify(fleet));
    imported.id = uuid();
    imported.name = fleet.name + ' (imported)';
    imported.createdAt = Date.now();
    imported.updatedAt = Date.now();
    imported.battleGroups.forEach(g => {
      g.id = uuid();
      g.ships.forEach(s => s.id = uuid());
    });

    fleets.push(imported);
    saveFleets();
    showToast('Fleet imported!');
    navigate('builder', imported.id);
  }

  function shareFleet() {
    if (!currentFleet) return;
    const url = getShareURL(currentFleet);
    const text = generateFleetText(currentFleet);

    const body = document.getElementById('share-body');
    // Default share = the simple army list (New Recruit style), so it leads here.
    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">Army List</div>
        <textarea class="share-text-export" readonly onclick="this.select()">${esc(text)}</textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-sm)" onclick="App.copyShareText()">Copy army list</button>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Share Link</div>
        <div class="share-url-row">
          <input type="text" class="share-url-input" value="${esc(url)}" readonly id="share-url-input" onclick="this.select()">
          <button class="btn btn-outline btn-sm" onclick="App.copyShareURL()">Copy</button>
        </div>
        <p class="text-caption" style="margin-top:var(--sp-sm)">A link anyone can open to view and import the exact fleet.</p>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">JSON Export</div>
        <p class="text-caption" style="margin-bottom:var(--sp-sm)">Copy the fleet as JSON data. Paste into another browser's Import to transfer fleets between devices.</p>
        <button class="btn btn-outline btn-sm" onclick="App.copyShareJSON()"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v12M12 2v12M4 6h8M4 10h8"/></svg> Copy JSON</button>
      </div>
    `;
    openModal('modal-share');
  }

  function copyShareURL() {
    const input = document.getElementById('share-url-input');
    if (input && navigator.clipboard) {
      navigator.clipboard.writeText(input.value).then(() => showToast('Share link copied!'));
    } else if (input) {
      input.select();
      document.execCommand('copy');
      showToast('Share link copied!');
    }
  }

  function copyShareText() {
    if (!currentFleet) return;
    const text = generateFleetText(currentFleet);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('Fleet text copied!'));
    } else {
      prompt('Copy your fleet list:', text);
    }
  }

  function copyShareJSON() {
    if (!currentFleet) return;
    const json = JSON.stringify(currentFleet, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => showToast('Fleet JSON copied!'));
    } else {
      prompt('Copy fleet JSON:', json);
    }
  }

  // Open a manual paste modal. Reading the clipboard programmatically is blocked
  // by iOS Safari outside a synchronous gesture (it shows a native paste bubble
  // + denial), so a paste-it-yourself textarea is the reliable cross-platform UX.
  // We still try a best-effort clipboard pre-fill, ignoring any failure silently.
  function importFleetFromClipboard() {
    const ta = document.getElementById('import-text');
    if (ta) ta.value = '';
    openModal('modal-import');
    if (ta) setTimeout(() => ta.focus(), 50);
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText()
        .then(text => { if (ta && !ta.value && text && text.trim()) ta.value = text.trim(); })
        .catch(() => {}); // denial is expected on mobile, no toast, the textarea handles it
    }
  }

  function doImportFromText() {
    const ta = document.getElementById('import-text');
    const text = ta ? ta.value.trim() : '';
    if (!text) { showToast('Paste a share link or fleet code first'); return; }
    if (importFleetFromText(text)) closeModal('modal-import');
  }

  // Parse + import from a raw string (share URL, single-fleet JSON, or a backup
  // array). Returns true on success. Shared by the manual paste flow.
  function importFleetFromText(text) {
    try {
      const urlMatch = text.match(/[?#]share\/([A-Za-z0-9+/=_-]+)/);
      if (urlMatch) {
        const fleet = decodeFleet(urlMatch[1]);
        if (fleet) { importSingleFleet(fleet); return true; }
      }
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        let count = 0;
        parsed.forEach(f => {
          if (f && f.faction && f.battleGroups) { importSingleFleet(f, true); count++; }
        });
        if (count > 0) { renderFleetList(); showToast(`Imported ${count} fleet${count > 1 ? 's' : ''}`); return true; }
        showToast('No valid fleets found in data');
        return false;
      }
      if (parsed && parsed.faction && parsed.battleGroups) { importSingleFleet(parsed); return true; }
      showToast('Invalid fleet data');
      return false;
    } catch (e) {
      // Not JSON and not a recognised share link
      showToast('Could not read that, paste a share link or fleet code');
      return false;
    }
  }

  function importSingleFleet(fleet, skipRender) {
    const imported = JSON.parse(JSON.stringify(fleet));
    imported.id = uuid();
    if (!imported.name) imported.name = 'Imported Fleet';
    // Don't double-tag
    if (!imported.name.endsWith('(imported)')) {
      imported.name += ' (imported)';
    }
    imported.createdAt = Date.now();
    imported.updatedAt = Date.now();
    if (imported.battleGroups) {
      imported.battleGroups.forEach(g => {
        g.id = uuid();
        if (g.ships) g.ships.forEach(s => s.id = uuid());
      });
    }
    if (imported.admirals) imported.admirals.forEach(a => { a.id = uuid(); });

    fleets.push(imported);
    saveFleets();
    if (!skipRender) {
      renderFleetList();
      showToast(`Imported "${imported.name}"`);
    }
  }

  // New-Recruit-style plain-text army list (the "simple army list"): a header with
  // the total, then sections (Famous Admirals, then groups by tonnage Colossal→Light,
  // then Space Station), each with its points subtotal. Multi-ship groups read
  // "• Nx Name [per-ship pts]"; single ships read "Name [pts]". Loadout/system/feature
  // picks are indented sub-lines only when present.
  function generateFleetText(fleet) {
    const total = calcFleetPoints(fleet);
    const name = fleet.name || 'Fleet';
    const factionInfo = shipDB[fleet.faction];
    let out = `# ++ ${name} ++ [${total} pts]\n`;

    const admirals = fleet.admirals || [];
    if (admirals.length) {
      const admPts = admirals.reduce((t, a) => t + (a.points || 0), 0);
      const anyFamous = admirals.some(a => a.type === 'Famous' || a.type === 'Faction');
      out += `\n## ${anyFamous ? 'Famous Admirals' : 'Admirals'} [${admPts} pts]\n`;
      admirals.forEach(a => {
        const fsp = (a.shipKey && factionInfo && factionInfo.groups && factionInfo.groups.famous_admirals && factionInfo.groups.famous_admirals.ships[a.shipKey]) || null;
        if (fsp) {
          const flagName = fsp.ship_name || fsp.className || 'Flagship';
          const flagCost = fsp.ship_cost || 0;
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
      const secPts = groups.reduce((t, g) => t + g.ships.reduce((tt, s) => tt + (s.points || 0), 0), 0);
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
          const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
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

  // ── Settings ──
  function openSettings() {
    const body = document.getElementById('settings-body');
    const descValue = currentFleet ? (currentFleet.description || '') : '';
    const fleetSection = currentFleet ? `
      <div class="settings-group">
        <div class="settings-group-title">Fleet Details</div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-sm)">
          <label class="form-label" style="margin-top:var(--sp-sm)">Description</label>
          <textarea class="form-textarea" id="settings-fleet-desc" placeholder="Fleet notes..." style="min-height:60px;font-size:var(--text-sm)">${esc(descValue)}</textarea>
          <button class="btn btn-outline btn-sm" style="align-self:flex-start" onclick="App.updateFleetDescription()">Save Description</button>
        </div>
      </div>` : '';

    body.innerHTML = `
      ${fleetSection}
      <div class="settings-group">
        <div class="settings-group-title">Ship Selection</div>
        <label class="settings-toggle">
          <span class="settings-toggle-label">
            <span class="settings-toggle-name">Additional Ships</span>
            <span class="settings-toggle-desc">Mercenaries, cross-faction ships, and other optional units</span>
          </span>
          <input type="checkbox" ${settings.showAdditionalShips ? 'checked' : ''} onchange="App.toggleSetting('showAdditionalShips', this.checked)">
          <span class="settings-toggle-switch"></span>
        </label>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Builder Display</div>
        <label class="settings-toggle">
          <span class="settings-toggle-label">
            <span class="settings-toggle-name">Compact View</span>
            <span class="settings-toggle-desc">Hide weapon tables and launch assets in the fleet builder for a denser overview</span>
          </span>
          <input type="checkbox" ${settings.compactView ? 'checked' : ''} onchange="App.toggleSetting('compactView', this.checked)">
          <span class="settings-toggle-switch"></span>
        </label>
        <label class="settings-toggle">
          <span class="settings-toggle-label">
            <span class="settings-toggle-name">Auto-expand Lore</span>
            <span class="settings-toggle-desc">Automatically show flavour text on ship cards instead of requiring a click</span>
          </span>
          <input type="checkbox" ${settings.autoExpandLore ? 'checked' : ''} onchange="App.toggleSetting('autoExpandLore', this.checked)">
          <span class="settings-toggle-switch"></span>
        </label>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Print</div>
        <label class="settings-toggle">
          <span class="settings-toggle-label">
            <span class="settings-toggle-name">Two-column units</span>
            <span class="settings-toggle-desc">Pack units two per row when printing (about four per page) to save paper</span>
          </span>
          <input type="checkbox" ${settings.print2col ? 'checked' : ''} onchange="App.toggleSetting('print2col', this.checked)">
          <span class="settings-toggle-switch"></span>
        </label>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Data</div>
        <div class="flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="App.exportAllFleets()"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2 13h12"/></svg> Export All Fleets</button>
        </div>
        <p class="text-caption" style="margin-top:var(--sp-sm)">Download all your fleet data as a JSON backup file.</p>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Feedback</div>
        <div class="flex gap-sm">
          <a class="btn btn-outline btn-sm" href="${FEEDBACK_HREF}"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12v8H2zM2 4l6 5 6-5"/></svg> Send Feedback</a>
        </div>
      </div>
    `;
    openModal('modal-settings');
  }

  function updateFleetDescription() {
    if (!currentFleet) return;
    const textarea = document.getElementById('settings-fleet-desc');
    if (!textarea) return;
    currentFleet.description = textarea.value.trim();
    saveFleets();
    showToast('Description updated');
  }

  function exportAllFleets() {
    const data = JSON.stringify(fleets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropfleet-fleets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Fleets exported!');
  }

  function saveSettings() {
    try { localStorage.setItem('dfc_settings', JSON.stringify(settings)); } catch (e) {}
  }
  function toggleSetting(key, value) {
    settings[key] = value;
    saveSettings();
    showToast(value ? 'Setting enabled' : 'Setting disabled');
    // Re-render if display-affecting settings changed
    if (key === 'compactView' || key === 'autoExpandLore' || key === 'altStatBlock') renderBuilder();
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem('dfc_settings');
      if (saved) Object.assign(settings, JSON.parse(saved));
      // One-time reset: misc/additional ships default OFF. Clears any stale "on"
      // left from earlier testing; future toggles still persist normally.
      if (localStorage.getItem('dfc_misc_off_v1') !== '1') {
        settings.showAdditionalShips = false;
        localStorage.setItem('dfc_misc_off_v1', '1');
        localStorage.setItem('dfc_settings', JSON.stringify(settings));
      }
    } catch(e) {}
  }

  // ── Modals ──
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.removeProperty('opacity');
      modal.style.removeProperty('visibility');
      modal.style.removeProperty('pointer-events');
      modal.offsetHeight;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      // Ship picker keeps the collapsed fleet-summary sheet peeking above it on
      // mobile, so running points/composition stay glanceable while browsing.
      if (id === 'modal-ship-select') document.body.classList.add('picker-open');
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (id === 'modal-ship-select') { pendingGroupCreation = false; document.body.classList.remove('picker-open'); }
  }

  function confirmAction(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-action');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      closeModal('modal-confirm');
      onConfirm();
    });
    openModal('modal-confirm');
  }

  // ── Sidebar Toggle (mobile) ──
  function toggleSidebar() {
    const sidebar = document.getElementById('builder-sidebar');
    sidebar.classList.toggle('expanded');
  }

  // iOS-style drag on the mobile bottom sheet. Attached once to the persistent
  // sheet element, so swipe-to-collapse works in EVERY state (including while the
  // ship picker is open, since the sheet floats above it). Swipe down collapses,
  // swipe up expands; the sheet follows the finger and snaps on release.
  function initBottomSheetGestures() {
    const sheet = document.getElementById('builder-sidebar');
    if (!sheet || sheet._gesturesInit) return;
    sheet._gesturesInit = true;
    const handle = () => sheet.querySelector('.sidebar-handle');
    let startY = 0, lastY = 0, dragging = false, moved = false, baseExpanded = false, collapsedY = 0;

    sheet.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      if (getComputedStyle(sheet).position !== 'fixed') return;  // desktop: no-op
      const t = e.touches[0];
      startY = lastY = t.clientY;
      baseExpanded = sheet.classList.contains('expanded');
      const onHandle = handle() && handle().contains(e.target);
      const atTop = sheet.scrollTop <= 0;
      // Drag when grabbing the handle, when collapsed (peek), or when expanded &
      // scrolled to the top (so content can still scroll otherwise).
      dragging = !!onHandle || !baseExpanded || (baseExpanded && atTop);
      moved = false;
      collapsedY = sheet.offsetHeight - 48;
    }, { passive: true });

    sheet.addEventListener('touchmove', e => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      lastY = e.touches[0].clientY;
      if (Math.abs(dy) < 4) return;
      if (baseExpanded && dy < 0) { dragging = false; return; }  // let content scroll up
      moved = true;
      const baseY = baseExpanded ? 0 : collapsedY;
      const ty = Math.max(0, Math.min(collapsedY, baseY + dy));
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${ty}px)`;
      e.preventDefault();
    }, { passive: false });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (!moved) return;                         // a tap, let onclick toggle
      const dy = lastY - startY;
      if (dy > 50) sheet.classList.remove('expanded');       // swipe down → collapse
      else if (dy < -50) sheet.classList.add('expanded');    // swipe up → expand
    };
    sheet.addEventListener('touchend', end, { passive: true });
    sheet.addEventListener('touchcancel', end, { passive: true });
  }

  // ── Toast ──
  let _toastTimer = null;
  function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.pointerEvents = 'none'; // never intercept taps (mobile)
    // Show immediately — don't depend on rAF (throttled/unreliable on mobile).
    toast.style.transform = 'translateX(-50%) translateY(0)';
    // A single tracked timer so rapid toasts don't leave one stuck visible.
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      _toastTimer = null;
    }, 2500);
  }

  // ── Launch Asset Reference ──
  // Collects all unique launch asset profiles needed by ships in a group.
  // Splits compound load names like "Fighters & Bombers" into individual
  // asset lookups against the faction's launch asset table.
  // Launch asset profiles a single ship can deploy (base loads + the loads on
  // its currently-selected loadout options). Compound names like
  // "Fighters & Bombers" are split into individual asset lookups.
  function collectShipLaunchAssets(factionKey, dbShip, ship) {
    const factionInfo = shipDB[factionKey];
    if (!factionInfo || !factionInfo.launchAssets || factionInfo.launchAssets.length === 0) return [];
    if (!dbShip) return [];

    const assetsByName = {};
    factionInfo.launchAssets.forEach(a => { assetsByName[a.name.toLowerCase()] = a; });

    const allLoads = [...(dbShip.loads || [])];
    (dbShip.loadoutOptions || []).forEach((lo, loIdx) => {
      const selIdx = (ship && ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
      const selOpt = lo.options[selIdx];
      if (selOpt && selOpt.loads) allLoads.push(...selOpt.loads);
    });

    const needed = new Set();
    const result = [];
    allLoads.forEach(load => {
      if (!load.name) return;
      load.name.split(/\s*&\s*/).forEach(part => {
        const key = part.trim().toLowerCase();
        if (!needed.has(key) && assetsByName[key]) {
          needed.add(key);
          result.push(assetsByName[key]);
        }
      });
    });
    return result;
  }

  // One combined launch table per unit: Launch | Load | Thrust | Att | Lock | Dmg
  // | Special. The Launch count (from the ship's load) spans that load's
  // component assets (e.g. "Fighters & Bombers 5" → one Launch-5 cell over the
  // Bombers and Fighters rows), each shown with its own stat profile.
  // Deployment range for Battalion/Feature-deploying Assets. Not stored in the
  // ship data — these are fixed rulebook constants (Rulebook 2.3.1 §7.4).
  // Combat assets (torpedoes/bombers/mines/fighters) use the universal 6"
  // launch placement and are intentionally omitted. Some ships carry a special
  // rule overriding these (e.g. UCM "launch Dropships/Drop Pods at 6\"").
  const DEPLOY_RANGE = {
    'bulk landers': '6"', 'bulk lander': '6"',
    'dropships': '3"', 'dropship': '3"',
    'boarding pods': '3"', 'boarding pod': '3"',
    'drop pods': '3"', 'drop pod': '3"'
  };

  // Build a launch-asset stat table for a list of loads (each load = {name, launch,
  // special}; the name may be "A & B" → one row per sub-asset). Resolves each asset's
  // full stats (Thrust/Att/Lock/Dmg/Special) from the faction's launchAssets. Reused
  // by the ship launch table AND by modular pickers so every launch option shows its
  // full statblock. `compact` tightens it for an inline option sheet.
  function buildLaunchTable(factionKey, allLoads, compact) {
    const factionInfo = shipDB[factionKey];
    if (!factionInfo || !allLoads || !allLoads.length) return '';
    const assetsByName = {};
    (factionInfo.launchAssets || []).forEach(a => { assetsByName[a.name.toLowerCase()] = a; });
    let body = '';
    allLoads.forEach(load => {
      if (!load.name) return;
      const parts = load.name.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
      const loadSpecial = (load.special && load.special !== '-') ? load.special : '';
      const launchCell = `<td class="lt-launch" rowspan="${parts.length}">${esc(String(load.launch ?? '-'))}${loadSpecial ? `<span class="lt-launch-note">${esc(loadSpecial)}</span>` : ''}</td>`;
      parts.forEach((part, i) => {
        const a = assetsByName[part.toLowerCase()] || { name: part };
        const hasStats = a.attack !== undefined;
        const dmg = hasStats
          ? `${esc(String(a.damage ?? ''))}${a.type ? `<span class="dmg-type dmg-type-${esc(a.type)}">${esc(a.type)}</span>` : ''}`
          : '-';
        let special = '-';
        const dr = DEPLOY_RANGE[part.toLowerCase()];
        if (a.special && a.special !== '-') special = renderWeaponSpecialChips(a.special);
        else if (a.ksReroll !== undefined) special = closeProtectionChip(a.ksReroll);
        else if (dr) special = `<span title="Deploys within ${dr} of a friendly carrier">Deploy ${dr}</span>`;
        body += `<tr>
          ${i === 0 ? launchCell : ''}
          <td class="lt-load">${esc(part)}</td>
          <td>${esc(String(a.thrust ?? '-'))}</td>
          <td>${hasStats ? esc(String(a.attack)) : '-'}</td>
          <td>${hasStats ? esc(String(a.lock)) : '-'}</td>
          <td>${dmg}</td>
          <td class="lt-special">${special}</td>
        </tr>`;
      });
    });
    return `<div class="launch-table-wrap${compact ? ' sys-opt-sheet' : ''}">
      <table class="launch-table">
        <thead><tr><th>Launch</th><th>Load</th><th>Thrust</th><th>Att</th><th>Lock</th><th>Dmg</th><th>Special</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  function renderLaunchTable(factionKey, dbShip, ship) {
    const factionInfo = shipDB[factionKey];
    if (!factionInfo || !dbShip) return '';
    const allLoads = [...(dbShip.loads || [])];
    (dbShip.loadoutOptions || []).forEach((lo, loIdx) => {
      const selIdx = (ship && ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
      const selOpt = lo.options[selIdx];
      if (selOpt && selOpt.loads) allLoads.push(...selOpt.loads);
    });
    // Launch from selected systems/hardpoints (Resistance modular ships build their
    // launch entirely from chosen options), so those assets show their stats too.
    if (ship && Array.isArray(ship.systems) && ship.systems.length) {
      const list = systemsListFor(dbShip, factionKey);
      if (list) ship.systems.forEach(name => { const o = findSystemOption(list, name); if (o && o.loads) allLoads.push(...o.loads); });
    }
    return buildLaunchTable(factionKey, allLoads);
  }

  // Group-wide dedup across all ships (kept for callers that need it).
  function collectGroupLaunchAssets(group, factionKey) {
    const needed = new Set();
    const result = [];
    group.ships.forEach(ship => {
      const dbShip = findShipInDB(factionKey, ship.groupCategory, ship.shipKey);
      collectShipLaunchAssets(factionKey, dbShip, ship).forEach(a => {
        const key = a.name.toLowerCase();
        if (!needed.has(key)) { needed.add(key); result.push(a); }
      });
    });
    return result;
  }

  // Renders the full launch asset reference panel — stat table for each
  // asset type the group's ships can launch.
  function renderLaunchAssetReference(assets) {
    if (!assets || assets.length === 0) return '';

    // Separate fighters (no attack/damage) from offensive assets
    const offensive = assets.filter(a => a.attack);
    const defensive = assets.filter(a => a.ksReroll !== undefined && !a.attack);

    let html = '<div class="launch-ref">';
    html += '<div class="launch-ref-header">Launch Asset Reference</div>';

    // Offensive assets table (torpedoes, bombers, mines)
    if (offensive.length > 0) {
      html += `<div class="launch-ref-table">
        <div class="launch-ref-row launch-ref-row-header">
          <span class="launch-ref-col launch-ref-col-name">Asset</span>
          <span class="launch-ref-col launch-ref-col-thrust">Thrust</span>
          <span class="launch-ref-col launch-ref-col-att">Att</span>
          <span class="launch-ref-col launch-ref-col-lock">Lk</span>
          <span class="launch-ref-col launch-ref-col-dmg">Dmg</span>
          <span class="launch-ref-col launch-ref-col-type">Type</span>
          <span class="launch-ref-col launch-ref-col-special">Special</span>
        </div>`;
      offensive.forEach(a => {
        const typeLabel = WEAPON_TYPE_LABELS[a.type] || a.type || '';
        const typeClass = a.type ? `weapon-type-${a.type.toLowerCase()}` : '';
        const typeIcon = WEAPON_TYPE_ICONS[a.type] || '';
        const special = a.special && a.special !== '-' ? a.special : '';
        html += `<div class="launch-ref-row">
          <span class="launch-ref-col launch-ref-col-name">${esc(a.name)}</span>
          <span class="launch-ref-col launch-ref-col-thrust">${esc(a.thrust)}</span>
          <span class="launch-ref-col launch-ref-col-att">${a.attack}</span>
          <span class="launch-ref-col launch-ref-col-lock">${a.lock}</span>
          <span class="launch-ref-col launch-ref-col-dmg">${a.damage}</span>
          <span class="launch-ref-col launch-ref-col-type ${typeClass}" title="${typeLabel}">${typeIcon || a.type || ''}</span>
          <span class="launch-ref-col launch-ref-col-special">${special ? renderWeaponSpecialChips(special) : ''}</span>
        </div>`;
      });
      html += '</div>';
    }

    // Fighters table (different stat line — thrust + KS reroll)
    if (defensive.length > 0) {
      html += `<div class="launch-ref-table">
        <div class="launch-ref-row launch-ref-row-header">
          <span class="launch-ref-col launch-ref-col-name">Asset</span>
          <span class="launch-ref-col launch-ref-col-thrust">Thrust</span>
          <span class="launch-ref-col launch-ref-col-special">Close Protection</span>
        </div>`;
      defensive.forEach(a => {
        html += `<div class="launch-ref-row">
          <span class="launch-ref-col launch-ref-col-name">${esc(a.name)}</span>
          <span class="launch-ref-col launch-ref-col-thrust">${esc(a.thrust)}</span>
          <span class="launch-ref-col launch-ref-col-special">${closeProtectionChip(a.ksReroll)}</span>
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ── Helpers ──
  function findShipInDB(factionKey, category, shipKey) {
    const faction = shipDB[factionKey];
    if (!faction || !faction.groups) return null;
    const group = faction.groups[category];
    if (!group || !group.ships) return null;
    return group.ships[shipKey] || null;
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // Rule/description text: escape everything, then re-allow our own <b> emphasis
  // (rules text stores verbatim bold via <b> tags) and turn newlines into breaks.
  function ruleHtml(str) { return esc(str).replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/\n/g, '<br>'); }

  // Fighters' defensive value is the Close Protection re-roll count (per faction).
  // Render it as a tooltip chip carrying the verbatim §8.3.3.1 rule. Note: the
  // re-rolls apply to Kinetic OR Energy saves, so the label deliberately omits "KS".
  function closeProtectionChip(rerolls) {
    const cp = lookupRuleFull('Close Protection') || { description: '', page: '' };
    return `<span class="rule-chip rule-chip-sm has-tooltip" data-rule-desc="${esc(cp.description)}" data-rule-page="${esc(cp.page || '')}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">Close Protection (re-roll ${esc(String(rerolls))})</span>`;
  }

  // Lore/namesake text may carry markdown links: [label](https://...). Convert
  // those to safe new-tab links; everything else is escaped (XSS-safe — only
  // http(s) URLs are turned into links, all other text is escaped).
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

  // Render the "Recorded ships of the class" list. Entries may carry a trailing
  // sub-faction tag, e.g. "Equatorial (Independents)" / "Purgatory (Kalium)". When
  // present, the tag marks the end of that sub-faction's run, so the flat list is
  // split into separate underlined-header columns instead of one mixed list.
  function renderFamousShips(prefix, famousShips) {
    if (!famousShips || famousShips.length === 0) return '';
    const groups = [];
    let cur = [], tagged = false;
    famousShips.forEach(s => {
      const txt = String(s).trim();
      // A trailing "(label)" closes a sub-faction column. Ignore it when the "("
      // belongs to a markdown link [name](url) (name part ends with "]") or looks
      // like a URL, so linked entries are not mistaken for tags.
      const m = txt.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (m && !m[1].endsWith(']') && !/https?:\/\//.test(m[2])) {
        tagged = true;
        if (m[1].trim()) cur.push(m[1].trim());
        groups.push({ label: m[2].trim(), ships: cur });
        cur = [];
      } else if (txt) {
        cur.push(txt);
      }
    });
    if (cur.length) groups.push({ label: '', ships: cur });
    const head = `<strong>${esc(prefix || 'Known ships of the class:')}</strong>`;
    if (!tagged || groups.length < 2) {
      const flat = (groups.length ? groups.flatMap(g => g.ships) : famousShips.map(String));
      return `<div class="lore-famous-ships">${head}<ul>${flat.map(s => `<li>${loreLinks(s)}</li>`).join('')}</ul></div>`;
    }
    const cols = groups.map(g =>
      `<div class="lore-famous-col">${g.label ? `<span class="lore-famous-subhead">${esc(g.label)}</span>` : ''}<ul>${g.ships.map(s => `<li>${loreLinks(s)}</li>`).join('')}</ul></div>`
    ).join('');
    return `<div class="lore-famous-ships">${head}<div class="lore-famous-cols">${cols}</div></div>`;
  }

  function formatLore(loreText, famousShipsPrefix, famousShips) {
    if (!loreText && (!famousShips || famousShips.length === 0)) return '';
    let html = '';
    if (loreText) {
      html += loreText.split(/\n\n+/).map(p => `<p>${loreLinks(p.trim())}</p>`).join('');
    }
    html += renderFamousShips(famousShipsPrefix, famousShips);
    return html;
  }

  function formatTimeAgo(date) {
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  // ── Ship Detail Modal ──
  // Hero art carousel: primary art + alternate resin sculpt(s) + counts-as variant
  // art, switchable from the top of the detail (arrows on desktop, swipe/dots on
  // mobile). State is reset each time the detail opens.
  let detailHeroArts = [];
  let detailHeroIdx = 0;
  function cycleShipArt(delta) {
    if (detailHeroArts.length < 2) return;
    detailHeroIdx = (detailHeroIdx + delta + detailHeroArts.length) % detailHeroArts.length;
    const cur = detailHeroArts[detailHeroIdx];
    const wrap = document.querySelector('#detail-ship-body .detail-hero-image');
    if (!wrap) return;
    const img = wrap.querySelector('img'); if (img) { img.src = cur.src; img.alt = cur.label; }
    const label = wrap.querySelector('.hero-art-label'); if (label) label.textContent = cur.label;
    wrap.querySelectorAll('.hero-art-dot').forEach((d, i) => d.classList.toggle('active', i === detailHeroIdx));
  }

  function openShipDetail(faction, category, shipKey, addable) {
    const dbShip = findShipInDB(faction, category, shipKey);
    if (!dbShip) return;

    document.getElementById('detail-ship-name').textContent = dbShip.name;
    const body = document.getElementById('detail-ship-body');

    const img = dbShip.image;
    const tonnage = tonLabel(dbShip.tonnage) || CATEGORY_LABELS[category] || category;
    const badges = [];
    if (dbShip.isUnique) badges.push('<span class="ship-badge ship-badge-unique">Unique</span>');
    else if (dbShip.isRare) badges.push('<span class="ship-badge ship-badge-rare">Rare</span>');
    if (dbShip.groupMax > 1) badges.push(`<span class="ship-badge ship-badge-group">${dbShip.groupMin || 1}–${dbShip.groupMax}</span>`);

    const statsHtml = renderStatGrid(dbShip);

    // Weapons
    const wpns = dbShip.weapons || [];
    let weaponsHtml = '';
    if (wpns.length > 0) {
      weaponsHtml = '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
    }

    // Loadout options
    let loadoutsHtml = '';
    const loadoutOpts = dbShip.loadoutOptions || [];
    if (loadoutOpts.length > 0) {
      loadoutsHtml = '<div class="detail-section-label">Loadout Options</div>';
      loadoutsHtml += loadoutOpts.map(lo => {
        const items = lo.options.map(opt => {
          const costLabel = opt.cost > 0 ? ` (+${opt.cost} pts)` : opt.cost < 0 ? ` (${opt.cost} pts)` : ' (free)';
          const optWpns = opt.weapons || [];
          let wpnDetail = '';
          if (optWpns.length > 0) {
            wpnDetail = '<div class="weapon-list" style="margin-top:var(--sp-xs)">' + renderWeaponHeader() + optWpns.map(renderWeaponRow).join('') + '</div>';
          }
          const redundant = optWpns.length && optWpns.every(w => w.name === opt.name);
          return `<div class="detail-loadout-option">
            <div class="detail-loadout-name">${redundant ? costLabel.replace(/^ \(|\)$/g, '').trim() || 'Included' : esc(opt.name) + costLabel}</div>
            ${wpnDetail}
          </div>`;
        }).join('');
        return `<div class="detail-loadout-group">
          <div class="detail-loadout-title">${esc(lo.name)}</div>
          ${items}
        </div>`;
      }).join('');
    }

    // Launch assets
    const loads = dbShip.loads || [];
    let loadsHtml = '';
    if (loads.length > 0) {
      loadsHtml = loads.map(l =>
          `<div class="load-row"><span class="load-row-name">${esc(l.name)}</span>
          <div class="weapon-row-stats"><span class="weapon-stat-chip">Launch ${l.launch}</span>
          ${l.special && l.special !== '-' ? `<span class="weapon-stat-chip">${esc(l.special)}</span>` : ''}
          </div></div>`
        ).join('');
    }

    // Special rules with full descriptions
    const ruleDetails = dbShip.specialRuleDetails || [];
    const ruleRows = ruleDetails.map(r => ({ name: r.name, page: r.page, desc: r.description }));
    // Overcharging a Weapon turns it into a High Power Weapon, so if any of this ship's
    // weapons (base, loadout option, or system option) has Overcharge, list High Power
    // too (it is never shown as its own weapon chip).
    const detailWeapons = [...(dbShip.weapons || [])];
    (dbShip.loadoutOptions || []).forEach(lo => (lo.options || []).forEach(o => { if (o.weapons) detailWeapons.push(...o.weapons); }));
    const detailSysList = systemsListFor(dbShip, faction);
    if (detailSysList) (detailSysList.options || []).forEach(o => { if (o.weapons) detailWeapons.push(...o.weapons); });
    if (detailWeapons.some(w => w.special && /\bOvercharge\b/i.test(w.special)) && !ruleRows.some(r => /^High Power$/i.test(r.name))) {
      const hp = lookupRuleFull('High Power');
      if (hp && hp.description) ruleRows.push({ name: 'High Power', page: hp.page, desc: hp.description });
    }
    let rulesHtml = '';
    if (ruleRows.length > 0) {
      rulesHtml = '<div class="detail-section-label">Special Rules</div><div class="detail-rules-list">' +
        ruleRows.map(r => {
          const page = r.page ? ` <span class="detail-rule-page">p.${esc(r.page)}</span>` : '';
          return `<div class="detail-rule-entry">
            <span class="detail-rule-name">${esc(r.name)}${page}</span>
            ${r.desc ? `<span class="detail-rule-desc">${ruleHtml(r.desc)}</span>` : ''}
          </div>`;
        }).join('') + '</div>';
    }

    // Variants
    let variantsHtml = '';
    if (dbShip.variants && dbShip.variants.length > 0) {
      variantsHtml = `<div class="detail-lore">
        <div class="detail-section-label">Also available as</div>
        ${dbShip.variants.map(v => `<div style="margin-bottom:var(--sp-md);display:flex;gap:var(--sp-md);align-items:flex-start">
          ${v.image ? `<img src="${esc(v.image)}" alt="${esc(v.name)}" loading="lazy" style="height:80px;width:auto;object-fit:contain;border-radius:var(--radius-sm)" onerror="this.style.display='none'">` : ''}
          <div style="flex:1;min-width:0">
            <div style="font-weight:var(--weight-semibold)">${esc(v.name)}</div>
            <div class="text-muted" style="font-size:var(--text-sm)">${esc(v.note)}</div>
            ${v.lore ? `<div class="text-rules" style="margin-top:var(--sp-xs)">${formatLore(v.lore, v.famousShips ? 'Famous ships of the class:' : '', v.famousShips ? v.famousShips.split(', ') : [])}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>`;
    }

    // Lore
    let loreHtml = '';
    const detailNamesake = dbShip.namesake
      ? `<div class="lore-namesake"><span class="lore-namesake-label">Namesake:</span> ${loreLinks(dbShip.namesake)}</div>`
      : '';
    if (dbShip.lore || dbShip.namesake) {
      loreHtml = `<div class="detail-lore">
        <div class="detail-section-label">Lore</div>
        <div class="text-rules">${formatLore(dbShip.lore, dbShip.famousShipsPrefix, dbShip.famousShips)}${detailNamesake}</div>
      </div>`;
    }

    // Hero art = primary + alternate resin sculpt(s) + counts-as variant art,
    // switchable from the top (this toggle replaces the old static bottom image).
    const altArt = shipAltArt(dbShip.name);
    detailHeroArts = [];
    if (img) detailHeroArts.push({ src: img, label: 'Standard sculpt' });
    altArt.forEach(a => detailHeroArts.push({ src: a, label: 'Resin sculpt' }));
    (dbShip.variants || []).forEach(v => { if (v.image) detailHeroArts.push({ src: v.image, label: v.name }); });
    detailHeroIdx = 0;
    const multiArt = detailHeroArts.length > 1;

    body.innerHTML = `
      <div class="detail-hero">
        ${img ? `<div class="detail-hero-image${multiArt ? ' has-alts' : ''}">
          ${shopLinkImg(dbShip.name, `<img src="${esc(img)}" alt="${esc(dbShip.name)}" loading="lazy" onerror="this.style.display='none'">`, dbShip)}
          ${multiArt ? `<button class="hero-art-arrow hero-art-prev" onclick="event.preventDefault();event.stopPropagation();App.cycleShipArt(-1)" aria-label="Previous sculpt">‹</button><button class="hero-art-arrow hero-art-next" onclick="event.preventDefault();event.stopPropagation();App.cycleShipArt(1)" aria-label="Next sculpt">›</button><div class="hero-art-meta"><span class="hero-art-label">${esc(detailHeroArts[0].label)}</span><span class="hero-art-dots">${detailHeroArts.map((_, i) => `<span class="hero-art-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</span></div>` : ''}
        </div>` : ''}
        <div class="detail-hero-info">
          <div class="detail-hero-tonnage ship-tonnage-label ship-tonnage-${category}">${esc(tonnage)}</div>
          <div class="detail-hero-cost">${dbShip.points} pts</div>
          ${badges.length > 0 ? `<div class="flex gap-xs">${badges.join('')}</div>` : ''}
          ${statsHtml}
          ${addable ? (category === 'famous_admirals'
            ? `<button class="btn btn-primary detail-add-btn" onclick="App.closeModal('modal-ship-detail'); App.addFamousAdmiralFromPicker('${shipKey}')">+ Add Admiral</button>`
            : `<button class="btn btn-primary detail-add-btn" onclick="App.addShipToGroup('${shipKey}','${category}'); App.closeModal('modal-ship-detail')">+ Add to fleet</button>`) : ''}
        </div>
      </div>
      ${weaponsHtml}
      ${loadoutsHtml}
      ${loadsHtml}
      ${rulesHtml}
      ${loreHtml}
      ${variantsHtml}
    `;

    openModal('modal-ship-detail');
  }

  // ── Rule Tooltip ──
  function showRuleTooltip(event, el) {
    event.stopPropagation();
    // Remove any existing tooltip
    const existing = document.getElementById('rule-tooltip');
    if (existing) existing.remove();

    const desc = el.getAttribute('data-rule-desc');
    if (!desc) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'rule-tooltip';
    tooltip.className = 'rule-tooltip-popup';
    const page = el.getAttribute('data-rule-page');
    const pageHtml = page ? `<span class="rule-tooltip-page">Rulebook p.${esc(page)}</span>` : '';
    tooltip.innerHTML = `<div class="rule-tooltip-title">${el.textContent}${pageHtml}</div><div class="rule-tooltip-body">${ruleHtml(desc)}</div>`;
    document.body.appendChild(tooltip);

    // Position near the chip
    const rect = el.getBoundingClientRect();
    const tooltipW = Math.min(380, window.innerWidth - 24);
    tooltip.style.width = tooltipW + 'px';

    let left = rect.left + rect.width / 2 - tooltipW / 2;
    if (left < 8) left = 8;
    if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - 8 - tooltipW;
    tooltip.style.left = left + 'px';

    let top = rect.bottom + 8;
    if (top + 200 > window.innerHeight) top = rect.top - tooltip.offsetHeight - 8;
    if (top < 8) top = 8;
    tooltip.style.top = top + 'px';

    // Dismiss on click anywhere
    function dismiss(e) {
      if (!tooltip.contains(e.target)) {
        tooltip.remove();
        document.removeEventListener('click', dismiss, true);
      }
    }
    setTimeout(() => document.addEventListener('click', dismiss, true), 10);
  }

  // ── Group Enforcement: same ship per group ──
  // When adding a ship to a group that already has ships, check if the new
  // ship matches the existing ships. If the group already contains a different
  // ship type, auto-create a new group for it.
  function addShipToGroupEnforced(shipKey, category) {
    if (!currentFleet || !activeGroupId) return;
    const group = currentFleet.battleGroups.find(g => g.id === activeGroupId);
    if (!group) return;

    const dbShip = findShipInDB(currentFleet.faction, category, shipKey);
    if (!dbShip) return;

    // Check if the group already has ships of a different type
    if (group.ships.length > 0) {
      const firstShip = group.ships[0];
      if (firstShip.shipKey !== shipKey || firstShip.groupCategory !== category) {
        // Different ship — create a new group and add there
        const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
        if (countableGroups(currentFleet).length >= sizeInfo.groups) {
          showToast('Maximum groups reached');
          return;
        }
        const num = currentFleet.battleGroups.length + 1;
        const newGroup = { id: uuid(), name: dbShip.name, ships: [] };
        currentFleet.battleGroups.push(newGroup);
        activeGroupId = newGroup.id;
        const startQty = Math.max(1, dbShip.groupMin || 1);
        for (let i = 0; i < startQty; i++) addShipToGroupInner(newGroup, shipKey, category, dbShip);
        saveFleets();
        renderGroupsNav();
        renderActiveGroup();
        updatePoints();
        showToast(`Created new group for ${dbShip.name}`);
        return;
      }
    }

    // Check group size limit
    const maxSize = dbShip.groupMax || 12;
    if (group.ships.length >= maxSize) {
      showToast(`${group.name} is full (max ${maxSize})`);
      return;
    }

    // Same ship or empty group — add directly
    addShipToGroupInner(group, shipKey, category, dbShip);
    saveFleets();
    updatePoints();
    scheduleRender(renderGroupsNav, renderActiveGroup);
    showToast(`Added ${dbShip.name} to ${group.name}`);

    // Visual flash on the clicked card
    const cardEl = document.querySelector(`.ship-card[onclick*="'${shipKey}'"]`);
    if (cardEl) {
      cardEl.classList.add('ship-card-added');
      setTimeout(() => cardEl.classList.remove('ship-card-added'), 600);
    }
  }

  function addShipToGroupInner(group, shipKey, category, dbShip) {
    // A group is "×N of one identically-equipped ship". When a matching ship is
    // already in the group, clone its full config (loadouts/systems/feature/points)
    // so added copies inherit it instead of resetting to a bare base hull.
    const existing = group.ships.find(s => s.shipKey === shipKey && s.groupCategory === category);
    let entry;
    if (existing) {
      entry = { ...existing, id: uuid(), loadouts: { ...(existing.loadouts || {}) } };
      if (existing.systems) entry.systems = [...existing.systems];
    } else {
      const loadouts = {};
      let loadoutCost = 0;
      if (dbShip.loadoutOptions && dbShip.loadoutOptions.length > 0) {
        dbShip.loadoutOptions.forEach((lo, loIdx) => {
          loadouts[loIdx] = 0;
          loadoutCost += lo.options[0]?.cost || 0;
        });
      }
      entry = {
        id: uuid(),
        shipKey,
        groupCategory: category,
        points: (dbShip.points || 0) + loadoutCost,
        loadouts
      };
    }

    group.ships.push(entry);

    // Auto-name the group to match ship name if it's still a default name
    if (group.ships.length === 1 && /^Group \d+$/.test(group.name)) {
      group.name = dbShip.name;
    }
  }

  // Close modals on overlay click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
      pendingGroupCreation = false;
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Keyboard activation for focusable clickable divs (role="button")
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute &&
        e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      e.target.click();
      return;
    }

    // Escape: close modals, rule tooltips, popovers
    if (e.key === 'Escape') {
      const activeModals = document.querySelectorAll('.modal-overlay.active');
      if (activeModals.length > 0) {
        activeModals.forEach(m => m.classList.remove('active'));
        document.body.style.overflow = '';
        pendingGroupCreation = false;
        return;
      }
      // Dismiss rule tooltip
      const tooltip = document.getElementById('rule-tooltip');
      if (tooltip) { tooltip.remove(); return; }
      // Dismiss game size popover
      const popover = document.getElementById('game-size-popover');
      if (popover) { popover.remove(); return; }
    }

    // Ctrl/Cmd+P: print fleet (only in builder view)
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      if (currentFleet && !document.querySelector('.modal-overlay.active')) {
        e.preventDefault();
        printFleet();
      }
    }

    // Skip shortcuts if typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (document.querySelector('.modal-overlay.active')) return;

    // N: new fleet (from fleet list)
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !currentFleet) {
      e.preventDefault();
      openNewFleetModal();
    }

    // A: add group (in builder)
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey && currentFleet) {
      e.preventDefault();
      addGroup();
    }

    // O: fleet overview (in builder)
    if (e.key === 'o' && !e.ctrlKey && !e.metaKey && currentFleet) {
      e.preventDefault();
      selectGroup(null);
    }

    // 1-9: select group by number (in builder)
    if (currentFleet && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < currentFleet.battleGroups.length) {
        e.preventDefault();
        selectGroup(currentFleet.battleGroups[idx].id);
      }
    }

    // ?: show keyboard shortcuts help
    if (e.key === '?') {
      e.preventDefault();
      showKeyboardHelp();
    }
  });

  function showKeyboardHelp() {
    const shortcuts = [
      ['?', 'Show this help'],
      ['Esc', 'Close modal / tooltip'],
      ['Ctrl+P', 'Print fleet'],
      ['N', 'New fleet (from fleet list)'],
      ['A', 'Add group (in builder)'],
      ['O', 'Fleet overview'],
      ['1–9', 'Select group by number']
    ];
    const body = document.getElementById('detail-ship-body');
    document.getElementById('detail-ship-name').textContent = 'Keyboard Shortcuts';
    body.innerHTML = `<div class="detail-rules-list" style="gap:var(--sp-md)">
      ${shortcuts.map(([key, desc]) =>
        `<div class="flex items-center gap-md" style="padding:var(--sp-xs) 0;border-bottom:1px dotted var(--stroke-light)">
          <kbd class="kbd">${key}</kbd>
          <span>${esc(desc)}</span>
        </div>`
      ).join('')}
    </div>`;
    openModal('modal-ship-detail');
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ──
  return {
    navigate, openNewFleetModal, createFleet, deleteFleet, duplicateFleet, startFactionFleet, editFleetName, sortFleetList,
    loadDemoFleets, showFleetTab, loadFastplayFaction, selectFaction, selectGameSize, addGroup, selectGroup, selectFlagship, removeGroup, copyGroup, moveGroup, editGroupName, toggleFleetCardMenu,
    openShipSelectModal, filterCategory, toggleShipFilter, toggleMiscShips, clearShipFilters, searchShips, clearShipSearch, addShipToGroup, addSameShip, removeLastShip, removeShip, sortShips, changeLoadout, changeFeature, addSystem, removeSystem,
    openAdmiralModal, addGenericAdmiral, addFactionAdmiral, addFamousAdmiral, addFamousAdmiralFromPicker, removeAdmiral, toggleAdmiralAbility, assignAdmiralShip,
    openStationModal, selectStation, removeStation, addStationSystem, removeStationSystem, openStationArmaments,
    toggleSidebar, printFleet,
    shareFleet, copyShareURL, copyShareText, copyShareJSON, importSharedFleet, importFleetFromClipboard, doImportFromText,
    openSettings, toggleSetting, updateFleetDescription, exportAllFleets, openModal, closeModal, showRuleTooltip, openGameSizeChanger, applyGameSize, setCustomMax, openShipDetail, cycleShipArt, saveFleetDesc, toggleSecondaryObjective, openSecondaryModal, openAdmiralAbilityModal
  };
})();
