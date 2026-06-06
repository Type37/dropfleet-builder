/* ═══════════════════════════════════════════════════════════
   DFC Mobile — App Logic
   Hobgoblin-style linear stack navigation.
   Uses the SAME fleet schema as the desktop app (dfc_fleets):
     fleet.battleGroups[].ships[] storing { shipKey, groupCategory, points, loadouts }
     fleet.admirals[], fleet.spaceStation, fleet.gameSize
   so fleets are fully interoperable between desktop and mobile.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  const FACTIONS = {};         // raw faction JSON keyed by faction key
  let FLEET_DATA = null;       // game system data
  let SHIP_LORE = {};
  let RULES_DB = {};           // shared rules glossary
  let fleets = [];
  let activeFleet = null;
  let activeGroupIdx = -1;     // index into activeFleet.battleGroups
  let activeAdmiralIdx = -1;   // index into activeFleet.admirals
  let pickerFilter = 'all';

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
    ucm:        { name: 'UCM', desc: 'Durable human navy. Forgiving, great for beginners.', order: 1 },
    scourge:    { name: 'Scourge', desc: 'Aggressive energy weapons, fragile. High risk/reward.', order: 2 },
    phr:        { name: 'PHR', desc: 'Tough, elite, few ships. Slow but punishing.', order: 3 },
    shaltari:   { name: 'Shaltari', desc: 'Shielded glass cannons. Tricky, rewards skill.', order: 4 },
    resistance: { name: 'Resistance', desc: 'Scrappy human rebels. Flexible, unconventional.', order: 5 },
    bioficer:   { name: 'Bioficers', desc: 'Advanced bio-ships. Unusual rules — not for a first game.', order: 6 }
  };

  const GAME_SIZES = {
    skirmish:   { label: 'Skirmish',   min: 501,  max: 1000,  groups: 16, maxAdmiralLevel: 2, colossalMax: 0, time: '1–1.5 hrs' },
    clash:      { label: 'Clash',      min: 1001, max: 2000,  groups: 20, maxAdmiralLevel: 3, colossalMax: 1, time: '2–3 hrs' },
    battle:     { label: 'Battle',     min: 2001, max: 3000,  groups: 24, maxAdmiralLevel: 4, colossalMax: 2, time: '3–4 hrs' },
    reconquest: { label: 'Reconquest', min: 3001, max: 99999, groups: 28, maxAdmiralLevel: 5, colossalMax: 3, time: '4+ hrs' }
  };
  const RARE_MAX = { skirmish: 1, clash: 2, battle: 3, reconquest: 4 };

  /* ── Ship art ──────────────────────────────────────────── */
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
    'San Francisco':'san_francisco','St Petersburg':'st_petersburg',
    'Hong Kong':'hong_kong','Nuuk':'nuuk',
    'Heavy Cruiser':'heavy_cruiser','Heavy Frigate':'heavy_frigate',
    'Light Cruiser':'light_cruiser','Strike Carrier':'strike_carrier',
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
    'agency':'agency_bastion','atom':'atom_scion','atlas':'atlas_catastrophe','genitor':'genitor'
  };

  function shipArtPath(name) {
    if (!name) return null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (name.startsWith(prefix)) return `../assets/art/${file}.webp`;
    }
    const first = name.split(/\s+/)[0].toLowerCase();
    return SHIP_ART.has(first) ? `../assets/art/${first}.webp` : null;
  }
  function admiralArtPath(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const [pat, file] of Object.entries(ADMIRAL_ART)) {
      if (lower.includes(pat)) return `../assets/art/${file}.webp`;
    }
    return null;
  }

  /* ── Rules glossary ────────────────────────────────────── */
  const WEAPON_SPECIAL_RULES = {
    'Air to Air':'Can only target Launch Assets (fighters, bombers, etc.), not ships.',
    'Alt':'This weapon has an alternative fire mode. Choose one mode when attacking.',
    'Anti Wing':'Effective against Launch Assets. Hits against wings are resolved with bonus dice.',
    'Arrest':'Target’s Thrust is reduced by the Arrest value next turn.',
    'Bloom':'Firing this weapon increases the ship’s Signature by the Bloom value until the end of the turn.',
    'Bombardment':'Used for orbital bombardment of ground targets. Cannot target ships.',
    'Burnthrough':'For each critical hit, roll additional attack dice equal to the Burnthrough value.',
    'Calibre-L':'Can only target Light tonnage ships.',
    'Calibre-L/M':'Can only target Light or Medium tonnage ships.',
    'Calibre-M':'Can only target Medium tonnage ships.',
    'Calibre-H':'Can only target Heavy tonnage ships.',
    'Calibre-H/C':'Can only target Heavy or Colossal tonnage ships.',
    'Calibre-M/H/C':'Can only target Medium, Heavy, or Colossal tonnage ships.',
    'Close Action':'Close Action weapons fire at targets within Scan range. Uses the Close Action combat sequence.',
    'Crippling':'When this weapon causes damage, the target also suffers a Crippling effect (roll on Crippling table).',
    'Critical':'Extra critical damage — each critical hit inflicts additional hits equal to the Critical value.',
    'Escape Velocity':'Can only be fired if the ship has not turned this activation.',
    'Flash':'Reduces the target’s Scan value by the Flash value until end of turn.',
    'Focused':'All attack dice from this weapon must be allocated to the same target.',
    'Fusillade':'Gains additional attack dice equal to (Fusillade value × number of other ships in group firing this weapon).',
    'High Power':'Adds +1 to the Damage value of this weapon.',
    'Impel':'On hit, push the target directly away from the firing ship by the Impel value in inches.',
    'Limited':'This weapon can only fire a number of times per game equal to the Limited value.',
    'Low Power':'Reduces the Damage value of this weapon by 1 (minimum 1).',
    'Mauler':'If the target is within Scan range, this weapon gains +1 Damage.',
    'Overcharge':'May worsen Lock by 1 to gain +1 Damage for this attack.',
    'Penetrator':'Enemy armour saves (ES/KS) are worsened by 1 against this weapon.',
    'Re-Entry':'This weapon can target ground sectors for bombardment in addition to normal fire.',
    'Reave':'For each point of hull damage inflicted, the target loses additional hull points equal to the Reave value.',
    'Scald':'Reduces the target’s Point Defence by the Scald value for the rest of the turn.',
    'Status':'Applies a status effect to the target instead of dealing damage.',
    'Sustained Fire':'If the ship did not use the Course Change order this activation, gain extra attack dice.',
    'Volley':'Roll additional attack dice equal to the Volley value, but at Lock worsened by 1.'
  };

  const STAT_META = {
    scan:   { label: 'Scan',   desc: 'Scan range. The distance (in inches) at which this ship detects enemies and uses close-range weapons.' },
    sig:    { label: 'Signature', desc: 'How visible this ship is. Enemies must be within their Scan range of your Signature to target you — a low Signature is harder to hit.' },
    thrust: { label: 'Thrust', desc: 'Movement speed — how far (in inches) this ship moves each activation.' },
    hull:   { label: 'Hull',   desc: 'Hull points. The ship’s structural integrity. It becomes Crippled at half, and is destroyed at zero.' },
    es:     { label: 'Energy Shield', desc: 'Energy Save. When hit by an Energy (E) weapon, roll this number or higher on a d6 to avoid the damage.' },
    ks:     { label: 'Kinetic Shield', desc: 'Kinetic Save. When hit by a Kinetic (K) weapon, roll this number or higher on a d6 to avoid the damage.' },
    bs:     { label: 'Backup Save', desc: 'Backup Save. A last-resort save used when a ship has no relevant shield, or against certain weapons.' },
    pd:     { label: 'Point Defence', desc: 'Point Defence. Dice rolled to shoot down incoming Close Action attacks and bombers.' },
    g:      { label: 'Group size', desc: 'How many of this ship can form one battle group — shown as a range (min–max).' }
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

  function lookupRule(name) {
    if (!name) return { name, description: '', page: '' };
    const base = name.replace(/-?\d+$/, '').replace(/\s+\d+$/, '').trim();
    const xKey = base + '-X';
    const entry = RULES_DB[name] || RULES_DB[base] || RULES_DB[xKey];
    if (entry) return { name, description: entry.description, page: entry.page || '' };
    const wpn = WEAPON_SPECIAL_RULES[name] || WEAPON_SPECIAL_RULES[base];
    if (wpn) return { name, description: wpn, page: '' };
    return { name, description: '', page: '' };
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
      ? `<p>${esc(rule.description).replace(/\n/g, '<br>')}</p>`
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

  /* ── Helpers ───────────────────────────────────────────── */
  function uuid() { return 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  const CATEGORY_ORDER = ['light', 'medium', 'heavy', 'colossal', 'payload'];
  const CATEGORY_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy', colossal: 'Colossal', payload: 'Payload' };

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
    });
    if (migrated) saveFleets();
  }
  function viewDesktop() {
    localStorage.setItem('dfc_force_desktop', '1');
    location.href = '../';
  }

  /* ── Lookups ───────────────────────────────────────────── */
  function findFaction(key) { return FACTIONS[key] || null; }
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

  /* ── Deployable Features ───────────────────────────────── */
  function shipRuleNames(ship) {
    return (ship?.specialRules || []).map(r => r.name).join(' ');
  }
  function isFeatureCarrier(ship) {
    if (!ship) return false;
    const names = shipRuleNames(ship);
    const hay = (ship.rulesText || '') + ' ' + names;
    return /Deployable Feature/i.test(hay) || /\bPorter\b/i.test(names);
  }
  function featureRequired(ship) {
    if (!ship) return false;
    return /Deployable Feature/i.test((ship.rulesText || '') + ' ' + shipRuleNames(ship));
  }
  function factionFeatures(factionKey) {
    return (FACTIONS[factionKey]?.deployableFeatures) || [];
  }
  function featureCost(factionKey, featureName) {
    if (!featureName) return 0;
    const f = factionFeatures(factionKey).find(x => x.name === featureName);
    return f ? (f.cost || 0) : 0;
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
  // Unified per-ship points: base + loadout options + chosen feature.
  function recalcShipPoints(factionKey, shipDef, inst) {
    return (shipDef?.cost || 0) + shipLoadoutCost(shipDef, inst.loadouts) + featureCost(factionKey, inst.feature);
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
    if (pts > size.max && size.max !== 99999) w.push({ t: 'error', m: `Over budget: ${pts}/${size.max} pts` });
    else if (fleet.battleGroups.length && pts < size.min) w.push({ t: 'warn', m: `Under minimum: ${pts}/${size.min} pts` });

    const gc = countableGroups(fleet).length;
    if (gc > size.groups) w.push({ t: 'error', m: `Too many groups: ${gc}/${size.groups}` });

    // Admiral required
    if (!fleet.admirals || fleet.admirals.length === 0) {
      w.push({ t: 'error', m: 'Fleet must contain an Admiral', fix: 'admiral' });
    }
    // Admiral level cap
    (fleet.admirals || []).forEach(a => {
      if (a.level && a.level > size.maxAdmiralLevel) {
        w.push({ t: 'error', m: `${a.name} (Lv${a.level}) exceeds max Lv${size.maxAdmiralLevel} for ${size.label}` });
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
      const min = db.groupMin || 1, max = db.groupMax || 1;
      if (g.ships.length < min) w.push({ t: 'warn', m: `${db.name}: needs ${min} (has ${g.ships.length})` });
      if (g.ships.length > max) w.push({ t: 'error', m: `${db.name}: max ${max} (has ${g.ships.length})` });
      const key = s.shipKey;
      if (!counts[key]) counts[key] = { n: db.name, c: 0, rare: db.isRare, uniq: db.isUnique };
      counts[key].c++;
    });
    const rareMax = RARE_MAX[fleet.gameSize] || 2;
    Object.values(counts).forEach(i => {
      if (i.uniq && i.c > 1) w.push({ t: 'error', m: `${i.n} is Unique — max 1 group` });
      if (i.rare && i.c > rareMax) w.push({ t: 'error', m: `${i.n} is Rare — max ${rareMax} at ${size.label}` });
    });

    // Tonnage restrictions
    let light = 0, medium = 0, heavy = 0;
    fleet.battleGroups.forEach(g => {
      const cat = g.ships[0]?.groupCategory;
      const p = groupPoints(fleet, g);
      if (cat === 'light') light += p; else if (cat === 'medium') medium += p; else if (cat === 'heavy') heavy += p;
    });
    if (heavy > medium) w.push({ t: 'error', m: `Heavy (${heavy}pts) can’t exceed Medium (${medium}pts)` });
    if (light > medium + heavy) w.push({ t: 'error', m: `Light (${light}pts) can’t exceed Medium+Heavy (${medium + heavy}pts)` });

    // Feature carriers must choose a Deployable Feature
    fleet.battleGroups.forEach(g => {
      const s = g.ships[0];
      if (!s) return;
      const db = findShip(fleet.faction, s.groupCategory, s.shipKey);
      if (db && featureRequired(db) && g.ships.some(x => !x.feature)) {
        w.push({ t: 'warn', m: `${db.name} must choose a Deployable Feature` });
      }
    });

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
    'screen-station': renderStationPicker
  };

  function navigate(screenId, opts) {
    const current = document.querySelector('.screen.active');
    if (current && !opts?.replace) history.push({ id: current.id, scroll: window.scrollY });
    if (RENDERERS[screenId]) RENDERERS[screenId]();
    if (current && !opts?.replace) {
      current.classList.remove('active');
      current.classList.add('slide-out-left');
      setTimeout(() => current.classList.remove('slide-out-left'), 300);
    } else if (current) {
      current.classList.remove('active');
    }
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      if (current && !opts?.replace) {
        target.classList.add('slide-in-right');
        setTimeout(() => target.classList.remove('slide-in-right'), 300);
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
      setTimeout(() => current.classList.remove('slide-out-right'), 300);
    }
    const target = document.getElementById(prev.id);
    if (target) {
      target.classList.add('active', 'slide-in-left');
      setTimeout(() => target.classList.remove('slide-in-left'), 300);
    }
    window.scrollTo(0, prev.scroll || 0);
    afterNav(prev.id);
  }
  function afterNav(screenId) {
    updateAppBar(screenId);
    const fab = document.getElementById('fab-add-group');
    if (fab) fab.style.display = screenId === 'screen-fleet-detail' ? '' : 'none';
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
      ptsEl.textContent = `${pts} / ${activeFleet.pointsLimit || (GAME_SIZES[activeFleet.gameSize] || GAME_SIZES.clash).max}`;
      ptsEl.classList.remove('hidden');
    };

    switch (screenId) {
      case 'screen-fleet-list': menu.classList.remove('hidden'); title.textContent = 'Fleet Builder'; break;
      case 'screen-fleet-detail': back.classList.remove('hidden'); overflow.classList.remove('hidden'); title.textContent = 'Fleet'; showPts(); break;
      case 'screen-add-group': back.classList.remove('hidden'); title.textContent = 'Add Group'; showPts(); break;
      case 'screen-group-detail': back.classList.remove('hidden'); overflow.classList.remove('hidden'); title.textContent = 'Group'; showPts(); break;
      case 'screen-admiral': back.classList.remove('hidden'); title.textContent = 'Add Admiral'; showPts(); break;
      case 'screen-admiral-detail': back.classList.remove('hidden'); title.textContent = 'Admiral'; showPts(); break;
      case 'screen-station': back.classList.remove('hidden'); title.textContent = 'Space Station'; showPts(); break;
    }
  }

  /* ── Screen: Fleet List ────────────────────────────────── */
  function renderFleetList() {
    const c = document.getElementById('fleet-list-rows');
    if (!fleets.length) {
      c.innerHTML = `<div class="empty-state">
        <div class="empty-state-title">No fleets yet</div>
        <div class="empty-state-sub">Tap Create Fleet to start building.</div>
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
      const errs = validateFleet(f).filter(x => x.t === 'error').length;
      return `<div class="list-row" onclick="App.openFleet(${i})">
        ${icon ? `<img src="${icon}" alt="" class="faction-icon">` : ''}
        <div class="list-row-content">
          <div class="list-row-title">${esc(f.name || 'Unnamed Fleet')}${errs ? `<span class="row-badge-issue">${errs} issue${errs > 1 ? 's' : ''}</span>` : ''}</div>
          <div class="list-row-sub">${pts}/${limit}pts · ${gc} group${gc !== 1 ? 's' : ''} · ${(GAME_SIZES[f.gameSize] || {}).label || ''}</div>
          <div class="fleet-row-bar"><div class="fleet-row-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
        </div>
      </div>`;
    }).join('');
  }

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
      `${info?.name || f.faction} · ${size.label} · ${(f.battleGroups || []).length} group${(f.battleGroups || []).length !== 1 ? 's' : ''}`;

    const pct = Math.min(100, (pts / limit) * 100);
    const over = pts > limit;
    document.getElementById('fleet-pts-current').textContent = `${pts} / ${limit} pts`;
    document.getElementById('fleet-pts-remaining').textContent = over ? `${pts - limit} over` : `${limit - pts} left`;
    const fill = document.getElementById('fleet-pts-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', over);

    // Warnings — tappable when they have a fix
    const warns = validateFleet(f);
    const warnEl = document.getElementById('fleet-warnings');
    if (warns.length) {
      warnEl.classList.remove('hidden');
      warnEl.innerHTML = warns.map(w => {
        const icon = w.t === 'error' ? '☠' : '⚠';
        const cls = w.t === 'error' ? 'warn-error' : 'warn-soft';
        const onclick = w.fix === 'admiral' ? ` onclick="App.openAdmiral()" style="cursor:pointer"` : '';
        const arrow = w.fix ? ' <span class="warn-fix">Fix ›</span>' : '';
        return `<div class="warning-item ${cls}"${onclick}><span class="warning-icon">${icon}</span><span>${esc(w.m)}${arrow}</span></div>`;
      }).join('');
    } else {
      warnEl.classList.remove('hidden');
      warnEl.innerHTML = `<div class="warning-item warn-ok"><span class="warning-icon">✓</span><span>Legal fleet — ready to play</span></div>`;
    }

    // Groups
    const groupsEl = document.getElementById('fleet-groups');
    let html = '';
    if (!(f.battleGroups || []).length) {
      html += `<div class="empty-state-sm">No groups yet. Tap “Add Group”.</div>`;
    } else {
      html += f.battleGroups.map((g, i) => {
        const s = g.ships[0];
        if (!s) return '';
        const db = findShip(f.faction, s.groupCategory, s.shipKey);
        const qty = g.ships.length;
        const gp = groupPoints(f, g);
        const art = shipArtPath(db?.name);
        return `<div class="list-row" onclick="App.openGroup(${i})">
          ${art ? `<div class="ship-thumb"><img src="${art}" alt=""></div>` : '<div class="ship-thumb"></div>'}
          <div class="list-row-content">
            <div class="list-row-title">${esc(db?.name || 'Unknown')}${qty > 1 ? ' ×' + qty : ''}</div>
            <div class="list-row-sub">${gp}pts · ${db?.tonnage || CATEGORY_LABELS[s.groupCategory] || ''}</div>
          </div>
          <span class="list-chevron">›</span>
        </div>`;
      }).join('');
    }

    // Admiral slot(s)
    html += `<div class="section-header">Admiral</div>`;
    if ((f.admirals || []).length) {
      html += f.admirals.map((a, i) => {
        const art = admiralArtPath(a.name);
        return `<div class="list-row" onclick="App.openAdmiralDetail(${i})">
          ${art ? `<div class="ship-thumb"><img src="${art}" alt=""></div>` : '<div class="ship-thumb"></div>'}
          <div class="list-row-content">
            <div class="list-row-title">${esc(a.name)}</div>
            <div class="list-row-sub">${a.points}pts · Level ${a.level || '?'}${a.shipName ? ' · ' + esc(a.shipName) : ''}</div>
          </div>
          <span class="list-chevron">›</span>
        </div>`;
      }).join('');
    } else {
      html += `<div class="add-slot" onclick="App.openAdmiral()">+ Add Admiral</div>`;
    }

    // Station slot
    html += `<div class="section-header">Space Station</div>`;
    if (f.spaceStation) {
      html += `<div class="list-row" onclick="App.removeStationPrompt()">
        <div class="ship-thumb"></div>
        <div class="list-row-content">
          <div class="list-row-title">${esc(f.spaceStation.name)}</div>
          <div class="list-row-sub">${f.spaceStation.cost}pts</div>
        </div>
        <span class="list-chevron">›</span>
      </div>`;
    } else {
      html += `<div class="add-slot" onclick="App.openStation()">+ Choose Station</div>`;
    }

    groupsEl.innerHTML = html;
  }

  /* ── Screen: Ship Picker ───────────────────────────────── */
  function openAddGroup() {
    if (!activeFleet) return;
    pickerFilter = 'all';
    const s = document.getElementById('picker-search');
    if (s) s.value = '';
    navigate('screen-add-group');
  }
  function renderShipPicker() {
    const f = activeFleet;
    if (!f) return;
    const faction = FACTIONS[f.faction];
    if (!faction) return;
    const groups = faction.groups || [];

    const chipEl = document.getElementById('picker-chips');
    const cats = [...new Set(groups.map(g => g.category))].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
    chipEl.innerHTML = `<button class="chip ${pickerFilter === 'all' ? 'active' : ''}" onclick="App.filterShips('all')">All</button>` +
      cats.map(c => `<button class="chip ${pickerFilter === c ? 'active' : ''}" onclick="App.filterShips('${c}')">${CATEGORY_LABELS[c] || c}</button>`).join('');

    const search = (document.getElementById('picker-search')?.value || '').toLowerCase();
    let list = groups.filter(g => {
      if (pickerFilter !== 'all' && g.category !== pickerFilter) return false;
      if (search && !(g.ship?.name || g.name).toLowerCase().includes(search)) return false;
      return true;
    });
    // Beginner-friendly: cheapest first within the list (not scariest-first)
    list = list.slice().sort((a, b) => (a.ship?.cost || 0) - (b.ship?.cost || 0));

    document.getElementById('picker-list').innerHTML = list.map(g => {
      const ship = g.ship || {};
      const cost = ship.cost || 0;
      const gMin = ship.groupMin || 1, gMax = ship.groupMax || gMin;
      const art = shipArtPath(ship.name);
      const tonnage = ship.tonnage || CATEGORY_LABELS[g.category] || g.category;
      const tags = [];
      if (ship.isUnique) tags.push('<span class="ship-tag">Unique</span>');
      if (ship.isRare) tags.push('<span class="ship-tag">Rare</span>');
      return `<div class="list-row" onclick="App.addShip('${g.id}','${g.category}')">
        ${art ? `<div class="ship-thumb ship-thumb-lg"><img src="${art}" alt=""></div>` : '<div class="ship-thumb ship-thumb-lg"></div>'}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(ship.name)} ${tags.join('')}</span>
            <span class="list-row-pts">${cost}pts</span>
          </div>
          <div class="list-row-sub">${tonnage} · Group ${gMin}${gMax > gMin ? '–' + gMax : ''}</div>
        </div>
      </div>`;
    }).join('');
  }
  function filterShips(cat) { pickerFilter = cat; renderShipPicker(); }

  function makeShipInstance(factionKey, category, shipKey) {
    const ship = findShip(factionKey, category, shipKey);
    const loadouts = {};
    (ship?.loadoutOptions || []).forEach((lo, i) => { loadouts[i] = 0; });
    const inst = { id: uuid(), shipKey, groupCategory: category, points: 0, loadouts };
    inst.points = recalcShipPoints(factionKey, ship, inst);
    return inst;
  }
  function addShip(shipKey, category) {
    if (!activeFleet) return;
    const ship = findShip(activeFleet.faction, category, shipKey);
    const minQty = ship?.groupMin || 1;
    const ships = [];
    for (let i = 0; i < minQty; i++) ships.push(makeShipInstance(activeFleet.faction, category, shipKey));
    activeFleet.battleGroups = activeFleet.battleGroups || [];
    activeFleet.battleGroups.push({ id: uuid(), name: ship?.name || 'Group', ships });
    activeFleet.updatedAt = Date.now();
    saveFleets();
    goBack();
  }

  /* ── Screen: Group Detail ──────────────────────────────── */
  function openGroup(index) { activeGroupIdx = index; navigate('screen-group-detail'); }

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

    const statEntries = [
      { key: 'scan', label: 'Scan', val: stats.scan },
      { key: 'sig', label: 'Sig', val: stats.sig },
      { key: 'thrust', label: 'Thrust', val: stats.thrust },
      { key: 'hull', label: 'Hull', val: stats.hull },
      { key: 'es', label: 'ES', val: stats.es },
      { key: 'ks', label: 'KS', val: stats.ks }
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');
    if (stats.bs && stats.bs !== '-') statEntries.push({ key: 'bs', label: 'BS', val: stats.bs });

    const weapons = ship.weapons || [];
    const loadoutOptions = ship.loadoutOptions || [];
    const rules = ship.specialRules || [];
    const specialText = stats.special && stats.special !== '-' ? stats.special : '';
    const artSrc = shipArtPath(ship.name);
    const carrier = isFeatureCarrier(ship);
    const featReq = carrier && featureRequired(ship);
    const features = carrier ? factionFeatures(f.faction) : [];
    const chosenFeature = inst.feature || '';

    document.getElementById('group-detail-content').innerHTML = `
      ${artSrc ? `<div class="ship-art-hero"><img src="${artSrc}" alt="${esc(ship.name)}"></div>` : ''}
      <div class="detail-header">
        <div>
          <div class="detail-name">${esc(ship.name)}${qty > 1 ? ' ×' + qty : ''}</div>
          <div class="detail-type">${ship.tonnage || CATEGORY_LABELS[inst.groupCategory] || ''}</div>
        </div>
        <div class="pts-badge-lg"><div class="pts-badge-value">${gp}</div><div class="pts-badge-label">Points</div></div>
      </div>

      <div class="stat-grid">
        ${statEntries.map(s => `<div class="stat-cell tappable" onclick="App.openStat('${s.key}')">
          ${statIcon(s.key)}<div><div class="stat-label">${s.label}</div><div class="stat-value">${esc(s.val)}</div></div>
        </div>`).join('')}
      </div>

      <div class="group-counter">
        <div>
          <div class="group-counter-label">Group size</div>
          ${gMax > gMin ? `<div class="group-counter-range">${gMin}–${gMax} allowed</div>` : `<div class="group-counter-range">Fixed at ${gMin}</div>`}
        </div>
        <div class="group-counter-controls">
          <button class="counter-btn" onclick="App.changeQty(-1)" ${qty <= gMin ? 'disabled' : ''}>−</button>
          <div class="group-counter-value">${qty}</div>
          <button class="counter-btn" onclick="App.changeQty(1)" ${qty >= gMax ? 'disabled' : ''}>+</button>
        </div>
      </div>

      ${weapons.length ? `<div class="weapon-table">
        <div class="section-header" style="padding:0 0 var(--sp-s)">Weapons</div>
        <div class="weapon-row weapon-row-header">
          <div class="weapon-name">Weapon</div><div class="weapon-val">Lk</div><div class="weapon-val">At</div><div class="weapon-val">Dm</div><div class="weapon-val">Arc</div>
        </div>
        ${weapons.map(w => {
          const t = (w.type || '').toUpperCase();
          const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
          const dmg = `${w.damage || ''}${t ? `<span class="${tc}" style="margin-left:2px;font-size:9px">${t}</span>` : ''}`;
          return `<div class="weapon-row ${tc}">
            <div class="weapon-name">${esc(w.name)}</div><div class="weapon-val">${esc(w.lock || '')}</div>
            <div class="weapon-val">${esc(w.attack || '')}</div><div class="weapon-val">${dmg}</div><div class="weapon-val">${esc(w.arc || '')}</div>
          </div>${w.special && w.special !== '-' ? `<div class="weapon-special">${renderSpecialChips(w.special)}</div>` : ''}`;
        }).join('')}
      </div>` : ''}

      ${renderLaunchTable(f.faction, ship)}

      ${loadoutOptions.length ? `<div class="loadout-section">
        <div class="section-header" style="padding:0 0 var(--sp-s)">Loadout</div>
        ${loadoutOptions.map((lo, loIdx) => `
          <div class="loadout-group-label">${esc(lo.name || 'Option')}</div>
          ${lo.options.map((opt, oi) => {
            const sel = inst.loadouts && inst.loadouts[loIdx] != null ? inst.loadouts[loIdx] : 0;
            return `<div class="loadout-option ${oi === sel ? 'selected' : ''}" onclick="App.selectLoadout(${loIdx}, ${oi})">
              <div class="flex justify-between items-center">
                <span class="loadout-option-name">${esc(opt.name)}</span>
                <span class="loadout-option-cost">${opt.cost ? '+' + opt.cost + 'pts' : 'Free'}</span>
              </div>
              ${opt.weapons?.length ? `<div class="loadout-option-desc">${opt.weapons.map(w => esc(w.name)).join(', ')}</div>` : ''}
            </div>`;
          }).join('')}
        `).join('')}
      </div>` : ''}

      ${carrier && features.length ? `<div class="loadout-section">
        <div class="section-header" style="padding:0 0 var(--sp-s)">
          ${featReq ? 'Deployable Feature' + (chosenFeature ? '' : ' — required') : 'Payload Feature — optional'}
        </div>
        <div class="loadout-option ${!chosenFeature ? 'selected' : ''}" onclick="App.selectFeature('')">
          <div class="flex justify-between items-center">
            <span class="loadout-option-name">${featReq ? 'None (choose one)' : 'No feature'}</span>
            <span class="loadout-option-cost">${featReq && !chosenFeature ? '⚠' : ''}</span>
          </div>
        </div>
        ${features.map(ft => {
          const sel = ft.name === chosenFeature;
          const stat = (ft.features && ft.features[0]) ? ft.features[0] : null;
          const detail = stat ? `ES ${stat.es || '-'} · KS ${stat.ks || '-'}${stat.special && stat.special !== '-' ? ' · ' + stat.special : ''}` : '';
          return `<div class="loadout-option ${sel ? 'selected' : ''}" onclick="App.selectFeature('${ft.name.replace(/'/g, "\\'")}')">
            <div class="flex justify-between items-center">
              <span class="loadout-option-name">${esc(ft.name)}</span>
              <span class="loadout-option-cost">${ft.cost ? '+' + ft.cost + 'pts' : 'Free'}</span>
            </div>
            ${detail ? `<div class="loadout-option-desc">${esc(detail)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}

      ${specialText ? `<div class="rule-card">
        <div class="rule-card-name" style="margin-bottom:var(--sp-s)">Special Rules</div>
        <div class="weapon-special" style="margin:0">${renderSpecialChips(specialText)}</div>
      </div>` : ''}

      ${rules.map(r => `<div class="rule-card">
        <div class="rule-card-name">${esc(r.name)}</div>
        ${r.description ? `<div class="rule-card-text">${esc(r.description).replace(/\n/g, '<br>')}</div>` : ''}
      </div>`).join('')}
    `;
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

  function getLaunchAssetMap(factionKey) {
    const f = FACTIONS[factionKey];
    if (!f) return {};
    const map = {};
    (f.launchAssets || []).forEach(grp => (grp.assets || []).forEach(a => { map[a.name.toLowerCase()] = a; }));
    return map;
  }
  function renderLaunchTable(factionKey, ship) {
    const loads = ship.loads || [];
    if (!loads.length) return '';
    const map = getLaunchAssetMap(factionKey);
    let rows = '';
    loads.forEach(load => {
      if (!load.name) return;
      const parts = load.name.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
      const ls = (load.special && load.special !== '-') ? ` <span style="color:var(--fg3);font-size:var(--text-caption2)">${esc(load.special)}</span>` : '';
      parts.forEach((part, i) => {
        const a = map[part.toLowerCase()] || { name: part };
        const has = a.attack != null;
        const t = (a.type || '').toUpperCase();
        const tc = t === 'K' ? 'weapon-type-k' : t === 'E' ? 'weapon-type-e' : t === 'C' ? 'weapon-type-c' : '';
        const dmg = has ? `${a.damage || '—'}${t ? `<span class="${tc}" style="margin-left:2px">${t}</span>` : ''}` : '—';
        const special = (a.special && a.special !== '-') ? renderSpecialChips(a.special) : (a.ksReroll != null ? `<span class="weapon-special-chip">Close Protection (re-roll ${a.ksReroll} KS)</span>` : '—');
        rows += `<div class="weapon-row ${tc}" style="grid-template-columns:36px 1fr 40px 32px 32px 40px">
          ${i === 0 ? `<div class="weapon-val" style="font-weight:700">${esc(load.launch || '—')}${ls}</div>` : '<div></div>'}
          <div class="weapon-name">${esc(part)}</div>
          <div class="weapon-val">${esc(a.thrust || '—')}</div>
          <div class="weapon-val">${has ? esc(a.attack) : '—'}</div>
          <div class="weapon-val">${has ? esc(a.lock) : '—'}</div>
          <div class="weapon-val">${dmg}</div>
        </div>${special !== '—' ? `<div class="weapon-special">${special}</div>` : ''}`;
      });
    });
    return `<div class="weapon-table">
      <div class="section-header" style="padding:0 0 var(--sp-s)">Launch Assets</div>
      <div class="weapon-row weapon-row-header" style="grid-template-columns:36px 1fr 40px 32px 32px 40px">
        <div class="weapon-val">Lch</div><div class="weapon-name" style="color:var(--fg3)">Load</div>
        <div class="weapon-val">Thr</div><div class="weapon-val">At</div><div class="weapon-val">Lk</div><div class="weapon-val">Dm</div>
      </div>${rows}</div>`;
  }

  function changeQty(delta) {
    const f = activeFleet;
    if (!f || activeGroupIdx < 0) return;
    const group = f.battleGroups[activeGroupIdx];
    const inst = group.ships[0];
    const ship = findShip(f.faction, inst.groupCategory, inst.shipKey);
    let gMin = ship?.groupMin || 1, gMax = ship?.groupMax || 1;
    const gStat = ship?.stats?.g || '';
    if (gStat.includes('-')) { const p = gStat.split('-'); gMin = parseInt(p[0]) || gMin; gMax = parseInt(p[1]) || gMax; }
    const newQty = group.ships.length + delta;
    if (newQty < gMin || newQty > gMax) return;
    if (delta > 0) {
      group.ships.push(makeShipInstance(f.faction, inst.groupCategory, inst.shipKey));
    } else {
      group.ships.pop();
    }
    f.updatedAt = Date.now();
    saveFleets();
    renderGroupDetail();
    updateAppBar('screen-group-detail');
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
    goBack();
  }

  function groupOverflow() {
    showActionSheet([
      { label: 'Remove this group', danger: true, action: removeGroup }
    ]);
  }

  /* ── Screen: Admiral Picker ────────────────────────────── */
  function openAdmiral() { if (activeFleet) navigate('screen-admiral'); }
  function renderAdmiralPicker() {
    const f = activeFleet;
    if (!f) return;
    const faction = FACTIONS[f.faction];
    if (!faction) return;
    const size = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const admirals = (faction.admirals || []).slice().sort((a, b) => (a.level || 0) - (b.level || 0));
    document.getElementById('admiral-list').innerHTML = admirals.map(a => {
      const fs = a.flagship;
      const total = fs ? (a.cost + fs.cost) : a.cost;
      const art = admiralArtPath(a.name) || (fs ? shipArtPath(fs.name) : null);
      const overLevel = a.level > size.maxAdmiralLevel;
      return `<div class="list-row ${overLevel ? 'row-disabled' : ''}" onclick="${overLevel ? '' : `App.addAdmiral('${a.id}')`}">
        ${art ? `<div class="ship-thumb"><img src="${art}" alt=""></div>` : '<div class="ship-thumb"></div>'}
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(a.name)}</span>
            <span class="list-row-pts">${total}pts</span>
          </div>
          <div class="list-row-sub">Level ${a.level}${a.isFamous ? ' · Famous' : ''}${fs ? ' · ' + esc(fs.name) : ''}${overLevel ? ` · exceeds ${size.label} cap` : ''}</div>
        </div>
      </div>`;
    }).join('');
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
    goBack();
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
      return cat === 'medium' || cat === 'heavy' || cat === 'colossal';
    }).map(g => {
      const s = g.ships[0];
      const db = findShip(activeFleet.faction, s.groupCategory, s.shipKey);
      return { id: g.id, name: db?.name || g.name };
    });
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
      ${ab.effect ? `<div class="rule-card-text">${esc(ab.effect)}</div>` : ''}
    </div>`;

    let abilitiesHtml = '';
    if (info && info.innate.length) {
      abilitiesHtml += `<div class="section-header">Ability</div>` + info.innate.map(abilityInfo).join('');
    }
    if (info && info.table.length && info.picks > 0) {
      const remaining = info.picks - sel.length;
      abilitiesHtml += `<div class="section-header">Abilities Table — choose ${info.picks} ${remaining > 0 ? `(${remaining} left)` : '(full)'}</div>`;
      abilitiesHtml += info.table.map(ab => {
        const on = sel.includes(ab.name);
        const locked = !on && remaining <= 0;
        return `<div class="loadout-option ${on ? 'selected' : ''} ${locked ? 'row-disabled' : ''}" onclick="${locked ? '' : `App.toggleAdmiralAbility('${ab.name.replace(/'/g, "\\'")}')`}">
          <div class="flex justify-between items-center">
            <span class="loadout-option-name">${on ? '✓ ' : ''}${esc(ab.name)}</span>
            ${ab.cost ? `<span class="loadout-option-cost">${esc(ab.cost)}</span>` : ''}
          </div>
          ${ab.effect ? `<div class="loadout-option-desc">${esc(ab.effect)}</div>` : ''}
        </div>`;
      }).join('');
    }

    // Capital-ship assignment (admirals lead from a capital ship)
    const caps = capitalShipGroups();
    let assignHtml = `<div class="section-header">Assigned to</div>`;
    if (caps.length) {
      assignHtml += `<div class="loadout-section">` +
        `<div class="loadout-option ${!a.assignedGroupId ? 'selected' : ''}" onclick="App.assignAdmiral('')">
          <span class="loadout-option-name">Unassigned</span></div>` +
        caps.map(c => `<div class="loadout-option ${a.assignedGroupId === c.id ? 'selected' : ''}" onclick="App.assignAdmiral('${c.id}')">
          <span class="loadout-option-name">${esc(c.name)}</span></div>`).join('') +
        `</div>`;
    } else {
      assignHtml += `<div class="empty-state-sm">No Capital ships (Medium+) to assign to yet.</div>`;
    }

    document.getElementById('admiral-detail-content').innerHTML = `
      <div class="detail-header">
        ${art ? `<div class="ship-thumb ship-thumb-lg"><img src="${art}" alt=""></div>` : ''}
        <div style="flex:1;${art ? 'margin-left:var(--sp-m)' : ''}">
          <div class="detail-name">${esc(a.name)}</div>
          <div class="detail-type">Level ${a.level || '?'}${a.shipName ? ' · ' + esc(a.shipName) : ''}</div>
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
    if (pos >= 0) a.selectedAbilities.splice(pos, 1);
    else { if (a.selectedAbilities.length >= info.picks) return; a.selectedAbilities.push(name); }
    activeFleet.updatedAt = Date.now();
    saveFleets();
    renderAdmiralDetail();
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
      return `<div class="list-row" onclick="App.addStation('${s.id}')">
        <div class="ship-thumb"></div>
        <div class="list-row-content">
          <div class="flex justify-between items-center">
            <span class="list-row-title">${esc(s.name)}</span>
            <span class="list-row-pts">${s.cost}pts</span>
          </div>
          <div class="list-row-sub">Hull ${st.hull || '?'} · ES ${st.es || '-'} · KS ${st.ks || '-'}</div>
        </div>
      </div>`;
    }).join('');
  }
  function addStation(stationId) {
    const f = activeFleet;
    const faction = FACTIONS[f.faction];
    const s = (faction.spaceStations || []).find(x => x.id === stationId);
    if (!s) return;
    f.spaceStation = { name: s.name, cost: s.cost, stationKey: s.id };
    f.updatedAt = Date.now();
    saveFleets();
    goBack();
  }
  function removeStationPrompt() {
    showActionSheet([{ label: `Remove ${activeFleet.spaceStation.name}`, danger: true, action: () => {
      activeFleet.spaceStation = null;
      activeFleet.updatedAt = Date.now();
      saveFleets();
      renderFleetDetail();
      updateAppBar('screen-fleet-detail');
    } }]);
  }

  /* ── Overflow dispatcher (app-bar ··· button) ──────────── */
  function overflow() {
    const active = document.querySelector('.screen.active')?.id;
    if (active === 'screen-group-detail') groupOverflow();
    else fleetOverflow();
  }

  /* ── Fleet overflow (delete / duplicate / share) ───────── */
  function fleetOverflow() {
    showActionSheet([
      { label: 'Edit name & size', action: openEditFleet },
      { label: 'Share fleet', action: shareFleet },
      { label: 'Duplicate fleet', action: duplicateFleet },
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
  function encodeFleet(fleet) {
    const mini = {
      n: fleet.name, f: fleet.faction, s: fleet.gameSize,
      g: (fleet.battleGroups || []).map(g => ({
        n: g.name,
        sh: g.ships.map(s => {
          const e = { c: s.groupCategory, k: s.shipKey, p: s.points };
          if (s.loadouts && Object.keys(s.loadouts).length) e.l = s.loadouts;
          return e;
        })
      }))
    };
    if (fleet.description) mini.d = fleet.description;
    if (fleet.admirals?.length) mini.as = fleet.admirals.map(a => {
      const o = { n: a.name, p: a.points };
      if (a.admiralId) o.i = a.admiralId;
      if (a.level) o.l = a.level;
      if (a.type) o.t = a.type;
      return o;
    });
    if (fleet.spaceStation) mini.ss = { n: fleet.spaceStation.name, c: fleet.spaceStation.cost, k: fleet.spaceStation.stationKey };
    return btoa(JSON.stringify(mini)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeFleet(encoded) {
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const mini = JSON.parse(atob(b64));
      const size = GAME_SIZES[mini.s] || GAME_SIZES.clash;
      const fleet = {
        id: uuid(), name: mini.n || 'Shared Fleet', description: mini.d || '',
        faction: mini.f, gameSize: mini.s || 'clash',
        pointsLimit: size.max, maxGroups: size.groups,
        admirals: [], spaceStation: null,
        battleGroups: (mini.g || []).map(g => ({
          id: uuid(), name: g.n || 'Group',
          ships: (g.sh || []).map(s => ({
            id: uuid(), groupCategory: s.c, shipKey: s.k, points: s.p, loadouts: s.l || {}
          }))
        })),
        createdAt: Date.now(), updatedAt: Date.now()
      };
      if (mini.ss) fleet.spaceStation = { name: mini.ss.n, cost: mini.ss.c || 0, stationKey: mini.ss.k || null };
      if (mini.as) fleet.admirals = mini.as.map(a => ({
        name: a.n, points: a.p || 0, admiralId: a.i || null, level: a.l || 1, type: a.t || 'Generic',
        shipName: null, selectedAbilities: a.sa || [], assignedGroupId: a.ag || null
      }));
      return fleet;
    } catch (e) { console.warn('decode failed', e); return null; }
  }

  function importFromHash() {
    const m = location.hash.match(/#share\/(.+)$/) || location.hash.match(/#fleet=(.+)$/);
    if (!m) return false;
    const fleet = decodeFleet(m[1]);
    window.history.replaceState(null, '', location.pathname); // clear hash (local `history` is the nav stack)
    if (!fleet) return false;
    fleets.push(fleet);
    saveFleets();
    openFleet(fleets.length - 1);
    return true;
  }

  function shareFleet() {
    const code = encodeFleet(activeFleet);
    // Desktop-compatible share format (#share/<code>). Point at the root app so
    // the link works on desktop too; mobile users get redirected back here.
    const url = location.origin + location.pathname.replace(/mobile\/?$/, '') + '#share/' + code;
    const doToast = (msg) => showSheet('Share Fleet',
      `<p>${msg}</p><p style="word-break:break-all;font-family:var(--font-condensed);font-size:var(--text-caption1);color:var(--fg3);margin-top:var(--sp-s)">${esc(url)}</p>`);
    if (navigator.share) {
      navigator.share({ title: activeFleet.name, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => doToast('Link copied to clipboard.')).catch(() => doToast('Copy this link:'));
    } else {
      doToast('Copy this link:');
    }
  }

  /* ── Create / Edit Fleet modal ─────────────────────────── */
  let editingFleet = null;
  function populateFleetForm(fleet) {
    const fp = document.getElementById('new-fleet-faction');
    const ordered = Object.keys(FACTIONS).sort((a, b) => (FACTION_INFO[a]?.order || 99) - (FACTION_INFO[b]?.order || 99));
    fp.innerHTML = ordered.map(k => `<option value="${k}">${FACTION_INFO[k]?.name || k}</option>`).join('');
    const sp = document.getElementById('new-fleet-size');
    sp.innerHTML = Object.entries(GAME_SIZES).map(([k, s]) =>
      `<option value="${k}">${s.label} · ${s.min}–${s.max === 99999 ? '∞' : s.max}pts · ${s.time}</option>`
    ).join('');
    document.getElementById('new-fleet-name').value = fleet ? (fleet.name || '') : '';
    document.getElementById('new-fleet-desc').value = fleet ? (fleet.description || '') : '';
    fp.value = fleet ? fleet.faction : (ordered.includes('ucm') ? 'ucm' : ordered[0]);
    sp.value = fleet ? fleet.gameSize : 'skirmish';
    updateFactionDesc();
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
  function doCreateFleet() {
    const name = document.getElementById('new-fleet-name').value.trim() || 'Unnamed Fleet';
    const desc = document.getElementById('new-fleet-desc').value.trim();
    const faction = document.getElementById('new-fleet-faction').value;
    const gameSize = document.getElementById('new-fleet-size').value;
    const size = GAME_SIZES[gameSize] || GAME_SIZES.clash;
    if (editingFleet) {
      editingFleet.name = name;
      editingFleet.description = desc;
      if (!document.getElementById('new-fleet-faction').disabled) editingFleet.faction = faction;
      editingFleet.gameSize = gameSize;
      editingFleet.pointsLimit = size.max;
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
      pointsLimit: size.max, maxGroups: size.groups,
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
    const loads = Object.entries(FACTION_FILES).map(([key, url]) =>
      fetch(url).then(r => r.json()).then(d => { FACTIONS[key] = d; }).catch(e => console.warn('load', key, e))
    );
    loads.push(fetch('../data/fleet-data.json').then(r => r.json()).then(d => FLEET_DATA = d).catch(() => {}));
    loads.push(fetch('../data/ship-lore.json').then(r => r.json()).then(d => SHIP_LORE = d).catch(() => {}));
    loads.push(fetch('../data/fleet-index.json').then(r => r.json()).then(idx => {
      Object.entries(idx.sharedRules || {}).forEach(([k, v]) => {
        RULES_DB[k] = (typeof v === 'string') ? { description: v, page: '' } : { description: v.description || '', page: v.page || '' };
      });
    }).catch(() => {}));
    await Promise.all(loads);

    loadFleets();
    // If arriving via a #share/ link, import it and open it directly
    if (importFromHash()) return;
    renderFleetList();
    navigate('screen-fleet-list', { replace: true });

    const search = document.getElementById('picker-search');
    if (search) search.addEventListener('input', () => renderShipPicker());
    const fp = document.getElementById('new-fleet-faction');
    if (fp) fp.addEventListener('change', updateFactionDesc);
  }

  /* ── Public API ────────────────────────────────────────── */
  window.App = {
    init, goBack, viewDesktop,
    openFleet, openCreateFleet, openEditFleet, closeCreateFleet, doCreateFleet,
    openAddGroup, filterShips, addShip,
    openGroup, changeQty, selectLoadout, selectFeature, removeGroup, groupOverflow,
    openAdmiral, addAdmiral, removeAdmiralPrompt,
    openAdmiralDetail, toggleAdmiralAbility, assignAdmiral, removeActiveAdmiral,
    openStation, addStation, removeStationPrompt,
    overflow, fleetOverflow, deleteFleetPrompt, duplicateFleet, shareFleet,
    openRule, openStat, closeRuleSheet, closeActionSheet
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
