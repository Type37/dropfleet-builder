/* ═══════════════════════════════════════════════════════════════
   DROPFLEET COMMANDER — FLEET BUILDER
   Application Logic
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  // ── State ──
  let shipDB = {};
  let factionData = {};
  let sharedRulesDB = {};  // Global rules lookup from BSData (ship + weapon rules)
  let fleets = [];
  let currentFleet = null;
  let activeGroupId = null;
  let shipSortMode = 'name';
  let activeCategory = 'all';
  let activeFilters = new Set();  // 'launch', 'loadout', 'rare', 'unique'
  let shipSearchQuery = '';
  let pendingGroupCreation = false;  // true when "Add Group" opened the ship modal
  let settings = { showAuxiliaries: true, compactView: false, autoExpandLore: false };
  let fleetSortMode = 'updated'; // 'updated', 'name', 'faction', 'points'

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

  const FACTION_COLORS = {
    ucm: '#3e9945', phr: '#6a4c9c', scourge: '#c43c2f',
    shaltari: '#d98c1f', bioficer: '#2a8c8c', resistance: '#b04a2a'
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
    payload: 'Payload'
  };

  const CATEGORY_ORDER = ['light','medium','heavy','colossal','payload'];

  let rawFleetData = null;

  // ── Init ──
  async function init() {
    try {
      const res = await fetch('data/fleet-data.json');
      rawFleetData = await res.json();
      transformData(rawFleetData);
      populateLanding(rawFleetData);
    } catch (e) {
      console.error('Failed to load fleet data:', e);
    }

    loadSettings();
    loadFleets();
    setupRouting();
    window.dispatchEvent(new Event('hashchange'));
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
    'genitor': 'genitor'
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

  function admiralArtPath(admiralName) {
    if (!admiralName) return null;
    const lower = admiralName.toLowerCase();
    for (const [pattern, file] of Object.entries(ADMIRAL_ART)) {
      if (lower.includes(pattern)) return `assets/art/${file}.webp`;
    }
    return null;
  }

  function transformData(raw) {
    // Store global shared rules (ship + weapon rules from BSData)
    // Normalize: values may be plain strings or {description, page} objects
    if (raw.sharedRules) {
      Object.entries(raw.sharedRules).forEach(([k, v]) => {
        if (typeof v === 'string') {
          sharedRulesDB[k] = { description: v, page: '' };
        } else {
          sharedRulesDB[k] = { description: v.description || '', page: v.page || '' };
        }
      });
    }

    Object.entries(raw.factions).forEach(([factionKey, faction]) => {
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
          loadoutOptions: s.loadoutOptions || [],
          lore: s.lore || '',
          image: shipArtPath(s.name)
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
            scan: fs?.stats?.scan, sig: fs?.stats?.sig,
            thrust: fs?.stats?.thrust, hull: fs?.stats?.hull,
            es: fs?.stats?.es, ks: fs?.stats?.ks,
            bs: fs?.stats?.bs, g: fs?.stats?.g,
            special: fs?.stats?.special,
            tonnage: fs?.stats?.tonnage,
            weapons: fs?.weapons || [],
            loads: fs?.loads || [],
            special_rules: (fs?.specialRules || []).map(r => r.name),
            specialRuleDetails: fs?.specialRules || [],
            image: admiralArtPath(a.name) || shipArtPath(fs?.name)
          };
        });
      }

      // Store launch asset profiles for this faction
      const launchAssets = [];
      (faction.launchAssets || []).forEach(la => {
        (la.assets || []).forEach(a => launchAssets.push(a));
      });

      // Store space stations and deployable features for this faction
      const spaceStations = (faction.spaceStations || []).map(ss => ({
        id: ss.id,
        name: ss.name,
        cost: ss.cost || 0,
        stats: ss.stats || {},
        specialRules: ss.specialRules || [],
        special: ss.stats?.special || '-'
      }));
      const deployableFeatures = (faction.deployableFeatures || []).map(df => ({
        id: df.id,
        name: df.name,
        cost: df.cost || 0,
        features: df.features || [],
        rules: df.rules || []
      }));

      shipDB[factionKey] = { groups, admirals: faction.admirals || [], launchAssets, spaceStations, deployableFeatures };
    });
  }

  // ── Landing Page Dynamic Content ──
  function populateLanding(raw) {
    // Stats bar
    const statsEl = document.getElementById('landing-stats');
    if (statsEl && raw) {
      let totalShips = 0, totalAdmirals = 0;
      const factionKeys = Object.keys(raw.factions || {});
      factionKeys.forEach(fk => {
        const f = raw.factions[fk];
        totalShips += (f.groups || []).length;
        totalAdmirals += (f.admirals || []).length;
      });
      const totalRules = Object.keys(raw.sharedRules || {}).length;
      const stats = [
        { num: totalShips, label: 'Ships' },
        { num: totalAdmirals, label: 'Admirals' },
        { num: factionKeys.length, label: 'Factions' },
        { num: totalRules, label: 'Rules' }
      ];
      statsEl.innerHTML = stats.map((s, i) =>
        (i > 0 ? '<span class="landing-stat-sep">·</span>' : '') +
        `<span class="landing-stat"><span class="landing-stat-num">${s.num}</span> ${s.label}</span>`
      ).join('');
    }

    // Faction showcase
    const factionsEl = document.getElementById('landing-factions');
    if (factionsEl && raw) {
      const factionKeys = ['ucm','phr','scourge','shaltari','bioficer','resistance']
        .filter(k => raw.factions[k]);
      const chips = factionKeys.map(fk => {
        const f = raw.factions[fk];
        const color = FACTION_COLORS[fk] || 'var(--navy)';
        const label = FACTION_LABELS[fk] || fk.toUpperCase();
        const count = (f.groups || []).length;
        const fIcon = FACTION_ICONS[fk];
        return `<div class="faction-chip" style="--current-faction:${color}" onclick="App.startFactionFleet('${fk}')">
          ${fIcon ? `<img src="${fIcon}" alt="" class="faction-chip-icon">` : '<div class="faction-chip-dot"></div>'}
          <span class="faction-chip-name">${label}</span>
          <span class="faction-chip-count">${count} ships</span>
        </div>`;
      }).join('');
      factionsEl.innerHTML = `
        <div class="landing-factions-title">Choose Your Faction</div>
        <div class="faction-showcase">${chips}</div>`;
    }

    // Objectives reference
    const objEl = document.getElementById('landing-objectives');
    const objectives = raw?.gameSystem?.objectives || [];
    if (objEl && objectives.length > 0) {
      const cards = objectives.map(o =>
        `<div class="objective-card">
          <div class="objective-card-name">${esc(o.name)}</div>
          <div class="objective-card-desc">${esc(o.description)}</div>
        </div>`
      ).join('');
      objEl.innerHTML = `
        <div class="objectives-header" onclick="this.parentElement.classList.toggle('objectives-list-expanded')">
          <span class="objectives-title">Secondary Objectives Reference</span>
          <span class="objectives-toggle">Show <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg></span>
        </div>
        <div class="objectives-grid">${cards}</div>`;
    }
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
              <button class="btn btn-ghost btn-sm topbar-action-btn" onclick="App.printFleet()" data-tooltip="Print">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6V2h8v4M4 12H2V7h12v5h-2"/><rect x="4" y="10" width="8" height="4"/></svg>
                <span class="topbar-action-label">Print</span>
              </button>
              <button class="btn btn-ghost btn-sm topbar-action-btn" onclick="App.openSettings()" data-tooltip="Settings">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
              </button>`;
            renderBuilder();
            return;
          }
        }
        navigate('fleets');
        break;
      case 'share':
        if (param) {
          const shared = decodeFleet(param);
          if (shared) {
            showSharedFleet(shared);
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
    if (migrated) saveFleets();
  }

  function saveFleets() {
    localStorage.setItem('dfc_fleets', JSON.stringify(fleets));
  }

  function uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }

  // ── Fleet Sharing (URL encode/decode) ──
  function encodeFleet(fleet) {
    // Build a minimal representation — only data needed to reconstruct
    const mini = {
      n: fleet.name,
      f: fleet.faction,
      s: fleet.gameSize,
      g: fleet.battleGroups.map(g => ({
        n: g.name,
        sh: g.ships.map(s => {
          const entry = { c: s.groupCategory, k: s.shipKey, p: s.points };
          if (s.loadoutSelections && Object.keys(s.loadoutSelections).length > 0) {
            entry.l = s.loadoutSelections;
          }
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
        return a;
      });
    }
    if (fleet.spaceStation) {
      mini.ss = { n: fleet.spaceStation.name, c: fleet.spaceStation.cost };
      if (fleet.spaceStation.stationKey) mini.ss.k = fleet.spaceStation.stationKey;
    }
    const json = JSON.stringify(mini);
    // base64url encode (no padding, URL-safe chars)
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeFleet(encoded) {
    try {
      // Restore base64 padding and standard chars
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = atob(b64);
      const mini = JSON.parse(json);

      const fleet = {
        id: uuid(),
        name: mini.n || 'Shared Fleet',
        description: mini.d || '',
        faction: mini.f,
        gameSize: mini.s || 'clash',
        pointsLimit: (GAME_SIZES[mini.s] || GAME_SIZES.clash).max,
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
            loadoutSelections: s.l || {}
          }))
        })),
        spaceStation: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Decode space station
      if (mini.ss) {
        fleet.spaceStation = {
          name: mini.ss.n,
          cost: mini.ss.c || 0,
          stationKey: mini.ss.k || null
        };
      }

      // Decode admirals array (new format) or legacy single admiral
      if (mini.as && mini.as.length > 0) {
        fleet.admirals = mini.as.map(a => ({
          name: a.n,
          points: a.p || 0,
          admiralId: a.i || null,
          shipKey: a.k || null,
          level: a.l || 1,
          type: a.t || 'Generic'
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
    const factions = ['ucm','phr','scourge','shaltari','bioficer','resistance'];
    container.innerHTML = factions.map(key => {
      const name = FACTION_LABELS[key] || (factionData[key] || {}).name || key.toUpperCase();
      const icon = FACTION_ICONS[key]
        ? `<img src="${FACTION_ICONS[key]}" alt="" style="width:20px;height:20px;object-fit:contain;flex-shrink:0">`
        : `<span style="width:20px;height:20px;border-radius:2px;background:${FACTION_COLORS[key]};flex-shrink:0;display:block"></span>`;
      return `<button type="button" class="btn btn-outline faction-pick-btn" data-faction="${key}"
        onclick="App.selectFaction('${key}')"
        style="flex:1;min-width:100px;border-color:${FACTION_COLORS[key]}33;position:relative;overflow:hidden">
        ${icon}
        <span>${name}</span>
      </button>`;
    }).join('');
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
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      btn.style.background = FACTION_COLORS[key];
      btn.style.color = '#fff';
      btn.dataset.selected = 'true';
    }
  }

  function renderSizePicker() {
    const container = document.getElementById('size-picker');
    const barProfiles = {
      skirmish:   [8, 12, 6, 4],
      clash:      [10, 16, 12, 8],
      battle:     [14, 22, 18, 12],
      reconquest: [16, 28, 24, 18]
    };
    container.innerHTML = Object.entries(GAME_SIZES).map(([key, size]) => {
      const bars = barProfiles[key].map(h => `<div class="game-size-bar" style="height:${h}px"></div>`).join('');
      const colossalText = size.colossalMax > 0 ? ` · ${size.colossalMax} Colossal` : '';
      return `
      <div class="game-size-option ${key === 'clash' ? 'selected' : ''}" data-size="${key}" onclick="App.selectGameSize('${key}')">
        <input type="radio" name="game-size" value="${key}" style="display:none" ${key === 'clash' ? 'checked' : ''}>
        <div class="game-size-visual">${bars}</div>
        <div class="game-size-info">
          <div class="game-size-name">${size.label}</div>
          <div class="game-size-details">${size.desc} · ${size.groups} groups max</div>
          <div class="game-size-time">~${size.time} · Admiral Lv${size.maxAdmiralLevel} max${colossalText}</div>
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
  }

  function openGameSizeChanger() {
    if (!currentFleet) return;
    // Remove any existing popover
    const existing = document.getElementById('game-size-popover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'game-size-popover';
    popover.className = 'game-size-popover';
    const barProfiles = {
      skirmish:   [8, 12, 6, 4],
      clash:      [10, 16, 12, 8],
      battle:     [14, 22, 18, 12],
      reconquest: [16, 28, 24, 18]
    };
    popover.innerHTML = Object.entries(GAME_SIZES).map(([key, size]) => {
      const active = key === currentFleet.gameSize ? ' active' : '';
      const colText = size.colossalMax > 0 ? ` · ${size.colossalMax} Colossal` : '';
      const bars = barProfiles[key].map(h => `<div class="game-size-bar" style="height:${h}px"></div>`).join('');
      return `<button class="game-size-popover-item${active}" onclick="App.applyGameSize('${key}')">
        <div class="game-size-visual">${bars}</div>
        <div>
          <span class="game-size-popover-name">${size.label}</span>
          <span class="game-size-popover-desc">${size.desc} · ~${size.time} · ${size.groups} groups${colText}</span>
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

    const rawName = document.getElementById('new-fleet-name').value.trim();
    const fLabel = FACTION_LABELS[faction] || faction.toUpperCase();
    const name = rawName || `${fLabel} ${sizeInfo.label} Fleet`;

    const fleet = {
      id: uuid(),
      name,
      description: document.getElementById('new-fleet-desc').value.trim(),
      faction,
      gameSize,
      pointsLimit: sizeInfo.max,
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
      const fColor = FACTION_COLORS[f.faction] || 'var(--navy)';
      const updated = f.updatedAt ? new Date(f.updatedAt) : null;
      const timeAgo = updated ? formatTimeAgo(updated) : '';
      const warnings = validateFleet(f);
      const errorCount = warnings.filter(w => w.type === 'error').length;
      const warnCount = warnings.filter(w => w.type === 'warn').length;
      const limit = sizeInfo.max;
      const pctFill = limit === 99999 ? 0 : Math.min((pts / limit) * 100, 100);
      const barClass = pts > limit ? 'fleet-card-bar-over' : pctFill > 85 ? 'fleet-card-bar-near' : '';
      const validationBadge = errorCount > 0
        ? `<span class="badge badge-error">${errorCount} issue${errorCount > 1 ? 's' : ''}</span>`
        : warnCount > 0
        ? `<span class="badge badge-warn">${warnCount} note${warnCount > 1 ? 's' : ''}</span>`
        : '';
      const fIcon = FACTION_ICONS[f.faction];
      return `
      <div class="fleet-card card-deco" onclick="App.navigate('builder','${f.id}')" style="border-left:3px solid ${fColor}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-xs">
            ${fIcon ? `<img src="${fIcon}" alt="" class="fleet-card-faction-icon">` : ''}
            <span class="badge badge-${f.faction}">${fName}</span>
          </div>
          <div class="flex gap-xs items-center">
            ${validationBadge}
            <span class="badge badge-neutral">${sizeInfo.label}</span>
          </div>
        </div>
        <div class="fleet-card-name">${esc(f.name)}</div>
        ${f.description ? `<div class="text-caption" style="line-height:1.4">${esc(f.description)}</div>` : ''}
        <div class="fleet-card-points-row">
          <span class="fleet-card-points">${pts} <span class="fleet-card-pts-label">/ ${limit === 99999 ? '∞' : limit} pts</span></span>
          <span class="text-caption">${f.battleGroups.length} group${f.battleGroups.length !== 1 ? 's' : ''} · ${shipCount} ship${shipCount !== 1 ? 's' : ''}${admCount > 0 ? ` · ${admCount} adm` : ''}${f.spaceStation ? ` · ${esc(f.spaceStation.name).replace(' Space Station','')}` : ''}</span>
        </div>
        <div class="fleet-card-bar"><div class="fleet-card-bar-fill ${barClass}" style="width:${pctFill}%"></div></div>
        <div class="fleet-card-actions" onclick="event.stopPropagation()">
          ${timeAgo ? `<span class="text-caption" style="margin-right:auto;font-size:var(--text-xs)">${timeAgo}</span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.duplicateFleet('${f.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M2 11V3c0-.6.4-1 1-1h8"/></svg> Duplicate</button>
          <button class="btn btn-danger btn-sm" onclick="App.deleteFleet('${f.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Delete</button>
        </div>
      </div>`;
    }).join('');

    const newCard = `
      <div class="fleet-card fleet-card-new" onclick="App.openNewFleetModal()">
        <div class="fleet-card-new-icon"><svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg></div>
        <div style="font-family:var(--font-display);font-weight:var(--weight-semibold);font-size:var(--text-md)">Create New Fleet</div>
        <div class="text-caption">Start building a new fleet roster</div>
      </div>`;

    if (fleets.length === 0) {
      grid.innerHTML = `
        <div class="fleet-list-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.2">
            <path d="M2 20l10-6 10 6"/>
            <path d="M12 14V2"/>
            <path d="M5 17l7-4 7 4"/>
            <path d="M8 6l4-4 4 4"/>
            <path d="M6 10l6-3 6 3"/>
          </svg>
          <h2 class="fleet-list-empty-title">No fleets yet</h2>
          <p class="fleet-list-empty-desc">Create your first fleet roster to get started, or load demo fleets to explore the builder.</p>
          <div class="flex gap-sm" style="margin-top:var(--sp-lg)">
            <button class="btn btn-primary" onclick="App.openNewFleetModal()"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> New Fleet</button>
            <button class="btn btn-outline" onclick="App.loadDemoFleets()">Load Demos</button>
          </div>
        </div>`;
    } else {
      grid.innerHTML = cards + newCard;
    }
  }

  // ── Demo Fleets ──
  function loadDemoFleets() {
    if (fleets.some(f => f.name.includes('Demo'))) {
      showToast('Demo fleets already loaded');
      return;
    }

    const demoSpecs = [
      { faction: 'ucm', name: 'Demo - UCM Battlefleet', desc: 'A balanced UCM strike force' },
      { faction: 'scourge', name: 'Demo - Scourge Swarm', desc: 'An aggressive Scourge raiding force' }
    ];

    demoSpecs.forEach(spec => {
      const factionShips = shipDB[spec.faction];
      if (!factionShips || !factionShips.groups) return;
      const groups = factionShips.groups;

      const battleGroups = [];

      function pickShips(catKey, count) {
        if (!groups[catKey] || !groups[catKey].ships) return [];
        const entries = Object.entries(groups[catKey].ships);
        const picked = [];
        for (let i = 0; i < Math.min(count, entries.length); i++) {
          const [key, ship] = entries[i];
          const loadouts = {};
          let loadoutCost = 0;
          if (ship.loadoutOptions && ship.loadoutOptions.length > 0) {
            ship.loadoutOptions.forEach((lo, loIdx) => {
              loadouts[loIdx] = 0;
              loadoutCost += lo.options[0]?.cost || 0;
            });
          }
          picked.push({ id: uuid(), shipKey: key, groupCategory: catKey, points: (ship.points || 0) + loadoutCost, loadouts });
        }
        return picked;
      }

      if (groups.heavy) {
        battleGroups.push({ id: uuid(), name: 'Group 1', ships: pickShips('heavy', 2) });
      }
      if (groups.medium) {
        battleGroups.push({ id: uuid(), name: 'Group 2', ships: pickShips('medium', 3) });
      }
      if (groups.light) {
        battleGroups.push({ id: uuid(), name: 'Group 3', ships: pickShips('light', 2) });
      }

      const fleet = {
        id: uuid(), name: spec.name, description: spec.desc,
        faction: spec.faction, gameSize: 'clash', pointsLimit: 2000, maxGroups: 20,
        admirals: [], battleGroups, createdAt: Date.now(), updatedAt: Date.now()
      };
      fleets.push(fleet);
    });

    saveFleets();
    renderFleetList();
    showToast('Demo fleets loaded!');
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
      const colText = sizeInfo.colossalMax > 0 ? `${sizeInfo.colossalMax} Colossal` : 'No Colossal';
      sizeDetail.innerHTML = `<span>${sizeInfo.desc}</span><span>${sizeInfo.groups} groups max</span><span>Admiral Lv${sizeInfo.maxAdmiralLevel} max</span><span>${colText}</span><span>~${sizeInfo.time}</span>`;
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

  function updatePoints() {
    const f = currentFleet;
    if (!f) return;
    const pts = calcFleetPoints(f);
    const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
    const limit = sizeInfo.max;
    const pct = Math.min((pts / limit) * 100, 100);

    document.getElementById('points-current').textContent = pts;
    document.getElementById('points-limit').textContent = limit === 99999 ? '∞' : limit;

    const fill = document.getElementById('points-fill');
    fill.style.width = limit === 99999 ? '0%' : pct + '%';
    fill.className = 'points-fill' + (pts > limit ? ' over-budget' : pct > 85 ? ' near-limit' : '');

    const groupCount = f.battleGroups.length;
    document.getElementById('groups-count').textContent = `${groupCount} group${groupCount !== 1 ? 's' : ''}`;
    document.getElementById('groups-limit').textContent = `/ ${sizeInfo.groups} max`;

    // Update mobile sidebar peek summary
    const peekPts = document.getElementById('sidebar-peek-points');
    const peekGrp = document.getElementById('sidebar-peek-groups');
    if (peekPts) peekPts.textContent = `${pts} / ${limit === 99999 ? '∞' : limit} pts`;
    if (peekGrp) peekGrp.textContent = `${groupCount} group${groupCount !== 1 ? 's' : ''}`;

    f.updatedAt = Date.now();
    saveFleets();

    // Composition breakdown
    renderCompositionBar();

    // Run fleet validation and display warnings
    renderFleetWarnings();
  }

  // ── Fleet Validation ──
  // Returns an array of {type: 'error'|'warn', message} for display
  function validateFleet(fleet) {
    if (!fleet) return [];
    const warnings = [];
    const sizeInfo = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    const pts = calcFleetPoints(fleet);

    // 1. Points range
    if (pts > sizeInfo.max && sizeInfo.max !== 99999) {
      warnings.push({ type: 'error', msg: `Over budget: ${pts}/${sizeInfo.max} pts` });
    } else if (pts < sizeInfo.min && fleet.battleGroups.length > 0) {
      warnings.push({ type: 'warn', msg: `Under minimum: ${pts}/${sizeInfo.min} pts` });
    }

    // 2. Group count
    if (fleet.battleGroups.length > sizeInfo.groups) {
      warnings.push({ type: 'error', msg: `Too many groups: ${fleet.battleGroups.length}/${sizeInfo.groups}` });
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
        warnings.push({ type: 'error', msg: `${info.name} is Unique — max 1 group` });
      }
      if (info.isRare && info.count > rareMax) {
        warnings.push({ type: 'error', msg: `${info.name} is Rare — max ${rareMax} group${rareMax > 1 ? 's' : ''} at ${sizeInfo.label}` });
      }
    });

    // 6. Group size validation (ships per group within min-max)
    fleet.battleGroups.forEach(g => {
      if (g.ships.length === 0) return;
      const s = g.ships[0];
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

    // 7. Admiral checks
    const admirals = fleet.admirals || [];
    let famousCount = 0;
    admirals.forEach(adm => {
      const admLvl = adm.level || 0;
      // Level 5 Famous Admirals count as Level 4 for game-size restrictions
      const effectiveLvl = admLvl >= 5 ? 4 : admLvl;
      if (effectiveLvl > sizeInfo.maxAdmiralLevel) {
        warnings.push({ type: 'error', msg: `${adm.name} (Lv${admLvl}) exceeds max Lv${sizeInfo.maxAdmiralLevel} for ${sizeInfo.label}` });
      }
      if (adm.type === 'Famous') famousCount++;
    });
    if (famousCount > 1) {
      warnings.push({ type: 'error', msg: `Only one Famous/Faction Admiral per fleet (you have ${famousCount})` });
    }

    return warnings;
  }

  function validateGroupSize(group, fleet) {
    if (!group || group.ships.length === 0) return [];
    const errors = [];
    const s = group.ships[0];
    const db = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
    if (!db) return [];

    const min = db.groupMin || 1;
    const max = db.groupMax || 1;
    if (group.ships.length > max) {
      errors.push(`max ${max} ${db.name} (has ${group.ships.length})`);
    }
    if (db.isUnique) {
      // Check fleet-wide for other groups with same ship
      const otherGroups = fleet.battleGroups.filter(g =>
        g.id !== group.id && g.ships.length > 0 &&
        g.ships[0].groupCategory === s.groupCategory && g.ships[0].shipKey === s.shipKey
      );
      if (otherGroups.length > 0) {
        errors.push(`${db.name} is Unique — only 1 group allowed`);
      }
    }
    return errors;
  }

  function renderFleetWarnings() {
    const el = document.getElementById('fleet-warnings');
    if (!el || !currentFleet) { if (el) el.innerHTML = ''; return; }

    const warnings = validateFleet(currentFleet);
    if (warnings.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = warnings.map(w => {
      const icon = w.type === 'error'
        ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 4.5v4m0 1.5v1"/><path d="M7.25 5.5h1.5v4h-1.5zm0 5.5h1.5v1.5h-1.5z"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></svg>';
      return `<div class="fleet-warning fleet-warning-${w.type}">${icon} ${esc(w.msg)}</div>`;
    }).join('');
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

    const bars = catOrder
      .filter(cat => catCounts[cat])
      .map(cat => {
        const info = catCounts[cat];
        const pct = (info.pts / totalPts) * 100;
        const color = catColors[cat] || 'var(--ink-muted)';
        return `<div class="comp-segment" style="width:${pct}%;background:${color}" title="${CATEGORY_LABELS[cat] || cat}: ${info.ships} ship${info.ships > 1 ? 's' : ''}, ${info.pts} pts (${Math.round(pct)}%)"></div>`;
      }).join('');

    const legend = catOrder
      .filter(cat => catCounts[cat])
      .map(cat => {
        const info = catCounts[cat];
        const color = catColors[cat] || 'var(--ink-muted)';
        return `<span class="comp-legend-item"><span class="comp-legend-dot" style="background:${color}"></span>${CATEGORY_LABELS[cat] || cat} ${info.ships}</span>`;
      }).join('');

    container.innerHTML = `
      <div class="comp-bar">${bars}</div>
      <div class="comp-legend">${legend}</div>`;
  }

  // ── Groups ──
  function renderGroupsNav() {
    const nav = document.getElementById('groups-nav');
    if (!currentFleet) return;

    if (currentFleet.battleGroups.length === 0) {
      nav.innerHTML = '<div class="text-caption text-center" style="padding:var(--sp-md)">No groups yet</div>';
      return;
    }

    const total = currentFleet.battleGroups.length;
    const overviewItem = `<div class="group-nav-item group-nav-overview ${!activeGroupId ? 'active' : ''}" onclick="App.selectGroup(null)">
      <div class="group-nav-name"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> Overview</div>
    </div>`;
    nav.innerHTML = overviewItem + currentFleet.battleGroups.map((g, i) => {
      const shipCount = g.ships.length;
      const groupPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      const isActive = g.id === activeGroupId;
      // Get the ship category for this group (from the first ship)
      let catLabel = '';
      if (g.ships.length > 0) {
        const cat = g.ships[0].groupCategory || 'medium';
        catLabel = CATEGORY_LABELS[cat] || cat;
      }
      const reorderBtns = isActive && total > 1
        ? `<span class="group-nav-reorder" onclick="event.stopPropagation()">
            <button class="group-move-btn" onclick="App.moveGroup('${g.id}',-1)" ${i === 0 ? 'disabled' : ''} title="Move up"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10l4-4 4 4"/></svg></button>
            <button class="group-move-btn" onclick="App.moveGroup('${g.id}',1)" ${i === total - 1 ? 'disabled' : ''} title="Move down"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg></button>
           </span>`
        : '';
      return `
      <div class="group-nav-item ${isActive ? 'active' : ''}" onclick="App.selectGroup('${g.id}')">
        <div class="group-nav-name">${esc(g.name)}${catLabel ? `<span class="group-nav-cat">${catLabel}</span>` : ''}</div>
        ${reorderBtns}
        <span class="text-caption" style="white-space:nowrap">${groupPts}pts</span>
        <span class="group-nav-count">${shipCount}</span>
      </div>`;
    }).join('');
  }

  function addGroup() {
    if (!currentFleet) return;
    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    if (currentFleet.battleGroups.length >= sizeInfo.groups) {
      showToast('Maximum groups reached for ' + sizeInfo.label);
      return;
    }
    // Open ship selection — picking a ship creates the group
    pendingGroupCreation = true;
    openShipSelectModal(null);
  }

  function selectGroup(gid) {
    activeGroupId = gid || null;
    renderGroupsNav();
    renderActiveGroup();

    // On mobile, collapse sidebar
    if (gid) {
      const sidebar = document.getElementById('builder-sidebar');
      if (sidebar.classList.contains('expanded')) sidebar.classList.remove('expanded');
    }
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
      renderGroupsNav();
      renderActiveGroup();
      updatePoints();
    });
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

  function renameGroup(gid) {
    const g = currentFleet.battleGroups.find(gg => gg.id === gid);
    if (!g) return;
    // Find the group name element in the header bar
    const headerName = document.querySelector('.group-header-bar h2');
    if (!headerName) {
      // Fallback to prompt if header not found
      const name = prompt('Group name:', g.name);
      if (name && name.trim()) { g.name = name.trim(); saveFleets(); renderGroupsNav(); renderActiveGroup(); }
      return;
    }
    const current = g.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'group-name-input';
    input.style.cssText = 'font:inherit;color:inherit;background:var(--paper-warm);border:1px solid var(--stroke);border-radius:3px;padding:2px 8px;width:300px;max-width:100%;outline:none;';
    headerName.textContent = '';
    headerName.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim();
      if (val && val !== current) {
        g.name = val;
        saveFleets();
        showToast('Group renamed');
      }
      renderGroupsNav();
      renderActiveGroup();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
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

    // Group cards
    const groupCards = f.battleGroups.map(g => {
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
      const cat = g.ships.length > 0 ? (g.ships[0].groupCategory || 'medium') : 'medium';
      const catLabel = CATEGORY_LABELS[cat] || cat;
      const firstShip = g.ships[0];
      const artSrc = firstShip ? shipArtPath((findShipInDB(f.faction, firstShip.groupCategory, firstShip.shipKey) || {}).name) : null;

      return `<div class="overview-group-card card-deco" onclick="App.selectGroup('${g.id}')" style="cursor:pointer">
        <div class="overview-group-top">
          ${artSrc ? `<div class="overview-group-art"><img src="${artSrc}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
          <div class="overview-group-info">
            <div class="overview-group-name">${esc(g.name)}</div>
            <div class="overview-group-meta">
              <span class="ship-tonnage-label ship-tonnage-${cat}" style="font-size:10px;padding:1px 6px">${esc(catLabel)}</span>
              <span class="text-caption">${g.ships.length} ship${g.ships.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="overview-group-ships">${shipNames.map(n => esc(n)).join(', ')}</div>
          </div>
          <div class="overview-group-pts">${gPts} pts</div>
        </div>
      </div>`;
    }).join('');

    // Admirals summary
    const factionInfo = shipDB[f.faction];
    let admHtml = '';
    if (f.admirals && f.admirals.length > 0) {
      admHtml = f.admirals.map(a => {
        return `<div class="overview-admiral">
          <span class="overview-admiral-name">${esc(a.name)}</span>
          <span class="text-caption">Lv${a.level || '?'}${a.type === 'Famous' ? ' (Famous)' : ''} — ${a.points} pts</span>
        </div>`;
      }).join('');
      admHtml = `<div class="overview-section">
        <div class="overview-section-label">Admirals</div>
        ${admHtml}
      </div>`;
    }

    // Station summary
    let stationHtml = '';
    if (f.spaceStation) {
      stationHtml = `<div class="overview-section">
        <div class="overview-section-label">Space Station</div>
        <div class="overview-admiral">
          <span class="overview-admiral-name">${esc(f.spaceStation.name)}</span>
          <span class="text-caption">${f.spaceStation.cost} pts</span>
        </div>
      </div>`;
    }

    // Validation summary
    let validHtml = '';
    if (warnings.length > 0) {
      validHtml = `<div class="overview-validation">
        ${errors.map(w => `<div class="overview-valid-item overview-valid-error">${esc(w.msg)}</div>`).join('')}
        ${notes.map(w => `<div class="overview-valid-item overview-valid-warn">${esc(w.msg)}</div>`).join('')}
      </div>`;
    }

    return `
      <div class="fleet-overview">
        <div class="overview-header">
          <div class="overview-header-left">
            ${fIcon ? `<img src="${fIcon}" alt="" class="overview-faction-icon">` : ''}
            <div>
              <h2 class="overview-title">Fleet Overview</h2>
              <div class="overview-subtitle">${esc(fName)} — ${sizeInfo.label}</div>
            </div>
          </div>
          <div class="overview-header-right">
            <div class="overview-pts-big">${pts}</div>
            <div class="overview-pts-cap">${sizeInfo.max !== 99999 ? '/ ' + sizeInfo.max : ''} pts</div>
          </div>
        </div>
        <div class="overview-desc" onclick="this.querySelector('.overview-desc-input')?.focus()">
          <textarea class="overview-desc-input" placeholder="Add fleet notes..." rows="2" onblur="App.saveFleetDesc(this.value)" onkeydown="if(event.key==='Escape'){this.blur()}">${esc(f.description || '')}</textarea>
        </div>
        ${validHtml}
        <div class="overview-section">
          <div class="overview-section-label">Battle Groups (${f.battleGroups.length})</div>
          <div class="overview-groups stagger">${groupCards}</div>
        </div>
        ${admHtml}
        ${stationHtml}
      </div>`;
  }

  function saveFleetDesc(val) {
    if (!currentFleet) return;
    currentFleet.description = val.trim();
    saveFleets();
  }

  // ── Active Group View ──
  function renderActiveGroup() {
    const emptyEl = document.getElementById('builder-empty');
    const contentEl = document.getElementById('builder-content');

    if (!currentFleet || currentFleet.battleGroups.length === 0) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    // Show fleet overview when no group is selected
    if (!activeGroupId) {
      emptyEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
      contentEl.innerHTML = renderFleetOverview();
      return;
    }

    const group = currentFleet.battleGroups.find(g => g.id === activeGroupId);
    if (!group) {
      emptyEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
      contentEl.innerHTML = renderFleetOverview();
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const groupPts = group.ships.reduce((t, s) => t + (s.points || 0), 0);

    // Determine tonnage category from first ship
    let tonnageBadge = '';
    if (group.ships.length > 0) {
      const firstDb = findShipInDB(currentFleet.faction, group.ships[0].groupCategory, group.ships[0].shipKey);
      const ton = firstDb ? (firstDb.tonnage || '') : '';
      if (ton) {
        const tonClass = ton.toLowerCase().replace(/\s+/g, '-');
        tonnageBadge = `<span class="badge badge-tonnage badge-tonnage-${tonClass}">${ton}</span>`;
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

    let html = `
    <div class="group-header-bar">
      <div class="flex items-center gap-md flex-wrap">
        <h2 class="group-title">${esc(group.name)}</h2>
        ${tonnageBadge}
        <span class="badge badge-navy">${groupPts} pts</span>
        <span class="badge badge-neutral">${group.ships.length} ship${group.ships.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-ghost btn-sm" onclick="App.renameGroup('${group.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 1l4 4-9 9H2v-4L11 1z"/></svg> Rename</button>
        <button class="btn btn-danger btn-sm" onclick="App.removeGroup('${group.id}')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
      </div>
    </div>
    ${groupWarnings}`;

    if (group.ships.length > 0) {
      html += '<div class="group-ships-list stagger">';
      group.ships.forEach(ship => {
        const dbShip = findShipInDB(currentFleet.faction, ship.groupCategory, ship.shipKey);
        html += renderGroupShipEntry(ship, dbShip, group.id);
      });
      html += '</div>';

      // Quantity controls — add/remove copies of the same ship type
      const firstShip = group.ships[0];
      const dbFirst = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
      const shipName = dbFirst ? dbFirst.name : firstShip.shipKey;
      const groupMax = dbFirst ? (dbFirst.groupMax || 12) : 12;
      const groupMin = dbFirst ? (dbFirst.groupMin || 1) : 1;
      const atMax = group.ships.length >= groupMax;
      const atMin = group.ships.length <= groupMin;

      html += `
      <div class="group-quantity-bar">
        <div class="group-quantity-info">
          <span class="group-quantity-count">${group.ships.length} × ${esc(shipName)}</span>
          <span class="group-quantity-limit">${groupMin}–${groupMax} per group</span>
        </div>
        <div class="group-quantity-controls">
          <button class="btn btn-outline btn-sm group-qty-btn" onclick="App.removeLastShip('${group.id}')" ${atMin ? 'disabled' : ''} title="Remove one">−</button>
          <span class="group-quantity-num">${group.ships.length}</span>
          <button class="btn btn-primary btn-sm group-qty-btn" onclick="App.addSameShip('${group.id}')" ${atMax ? 'disabled' : ''} title="Add one more">+</button>
        </div>
      </div>`;
      // Launch asset reference — show stat profiles for any assets this group can launch
      const launchAssets = collectGroupLaunchAssets(group, currentFleet.faction);
      if (launchAssets.length > 0) {
        html += renderLaunchAssetReference(launchAssets);
      }
    } else {
      // Empty group — shouldn't happen with new flow, but handle gracefully
      html += `
      <div class="add-ship-area" onclick="App.openShipSelectModal('${group.id}')" style="margin-top:var(--sp-lg)">
        <span style="font-size:24px">+</span>
        <span>Choose a ship for ${esc(group.name)}</span>
      </div>`;
    }

    contentEl.innerHTML = html;
  }

  function renderWeaponHeader() {
    return `<div class="weapon-row weapon-row-header">
      <span class="weapon-col weapon-col-name">Weapon</span>
      <span class="weapon-col weapon-col-arc">Arc</span>
      <span class="weapon-col weapon-col-att">Att</span>
      <span class="weapon-col weapon-col-lock">Lk</span>
      <span class="weapon-col weapon-col-dmg">Dmg</span>
      <span class="weapon-col weapon-col-type">Type</span>
      <span class="weapon-col weapon-col-special">Special</span>
    </div>`;
  }

  const WEAPON_TYPE_LABELS = { K: 'Kinetic', E: 'Energy', C: 'Close Action' };

  // Weapon type inline icons — 14px, used in weapon row type column
  const WEAPON_TYPE_ICONS = {
    K: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.5 5H15l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5.5z"/></svg>',
    E: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L4 8h4l-1 7 6-8H9l1-6z"/></svg>',
    C: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/></svg>'
  };

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

  // Inline SVG icons for stat cells — monochrome, 12px, geometric/Art Deco
  const STAT_ICONS = {
    scan:   '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 8L12 4"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>',
    sig:    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg>',
    thrust: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 6H4l4-6z"/><path d="M6 10l2 4 2-4"/></svg>',
    hull:   '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5L14 5v6l-6 3.5L2 11V5L8 1.5z"/></svg>',
    es:     '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1C5 1 3 3 3 3v5c0 3 5 6 5 6s5-3 5-6V3s-2-2-5-2z"/><path d="M8 5v4M6 7h4"/></svg>',
    ks:     '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1C5 1 3 3 3 3v5c0 3 5 6 5 6s5-3 5-6V3s-2-2-5-2z"/><path d="M6 6l4 4M10 6l-4 4"/></svg>',
    bs:     '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1C5 1 3 3 3 3v5c0 3 5 6 5 6s5-3 5-6V3s-2-2-5-2z"/></svg>',
    g:      '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="8" r="2"/><circle cx="11" cy="8" r="2"/></svg>'
  };

  const STAT_META = {
    scan:   { label: 'Scan',   title: 'Scan range — detection distance' },
    sig:    { label: 'Sig',    title: 'Signature — how visible the ship is' },
    thrust: { label: 'Thrust', title: 'Thrust — movement speed' },
    hull:   { label: 'Hull',   title: 'Hull points — structural integrity' },
    es:     { label: 'ES',     title: 'Energy Shield — save vs Energy weapons', cssClass: 'stat-cell-es' },
    ks:     { label: 'KS',     title: 'Kinetic Shield — save vs Kinetic weapons', cssClass: 'stat-cell-ks' },
    bs:     { label: 'BS',     title: 'Backup Save — last-resort save', cssClass: 'stat-cell-bs' },
    g:      { label: 'G',      title: 'Group size — ships per battle group' }
  };

  function renderStatGrid(ship) {
    const keys = ['scan','sig','thrust','hull','es','ks','bs','g'];
    const cells = keys.map(k => {
      const v = ship[k];
      if (v === undefined || v === 0) return '';
      const meta = STAT_META[k];
      let cellClass = meta.cssClass || '';
      // Gray out BS when it's "-"
      if (k === 'bs' && (v === '-' || v === '--')) cellClass = 'stat-cell-none';
      const icon = STAT_ICONS[k] || '';
      return `<div class="stat-cell ${cellClass}" title="${meta.title}">
        <div class="stat-cell-label">${icon} ${meta.label}</div>
        <div class="stat-cell-value">${v}</div>
      </div>`;
    }).filter(Boolean).join('');
    return cells ? `<div class="stat-grid">${cells}</div>` : '';
  }

  // Weapon special rules — descriptions from the rulebook
  const WEAPON_SPECIAL_RULES = {
    'Air to Air':       'Can only target Launch Assets (fighters, bombers, etc.), not ships.',
    'Alt':              'This weapon has an alternative fire mode. Choose one mode when attacking.',
    'Anti Wing':        'Effective against Launch Assets. Hits against wings are resolved with bonus dice.',
    'Arrest':           'Target\'s Thrust is reduced by the Arrest value next turn.',
    'Bloom':            'Firing this weapon increases the ship\'s Signature by the Bloom value until the end of the turn.',
    'Bombardment':      'Used for orbital bombardment of ground targets. Cannot target ships.',
    'Burnthrough':      'For each critical hit, roll additional attack dice equal to the Burnthrough value.',
    'Calibre-L':        'Can only target Light tonnage ships.',
    'Calibre-L/M':      'Can only target Light or Medium tonnage ships.',
    'Calibre-M':        'Can only target Medium tonnage ships.',
    'Calibre-H':        'Can only target Heavy tonnage ships.',
    'Calibre-H/C':      'Can only target Heavy or Colossal tonnage ships.',
    'Calibre-M/H/C':    'Can only target Medium, Heavy, or Colossal tonnage ships.',
    'Close Action':     'Close Action weapons fire at targets within Scan range. Uses the Close Action combat sequence.',
    'Crippling':        'When this weapon causes damage, the target also suffers a Crippling effect (roll on Crippling table).',
    'Crippling-Fire':           'When this weapon causes damage, the target suffers the Fire crippling effect.',
    'Crippling-2xFire':         'When this weapon causes damage, the target suffers two Fire crippling effects.',
    'Crippling-Navigation Offline': 'When this weapon causes damage, the target suffers Navigation Offline.',
    'Crippling-Weapons Offline':    'When this weapon causes damage, the target suffers Weapons Offline.',
    'Critical':         'Extra critical damage — each critical hit inflicts additional hits equal to the Critical value.',
    'Escape Velocity':  'Can only be fired if the ship has not turned this activation.',
    'Flash':            'Reduces the target\'s Scan value by the Flash value until end of turn.',
    'Focused':          'All attack dice from this weapon must be allocated to the same target.',
    'Fusillade':        'Gains additional attack dice equal to (Fusillade value × number of other ships in group firing this weapon).',
    'High Power':       'Adds +1 to the Damage value of this weapon.',
    'Impel':            'On hit, push the target directly away from the firing ship by the Impel value in inches.',
    'Limited':          'This weapon can only fire a number of times per game equal to the Limited value.',
    'Low Power':        'Reduces the Damage value of this weapon by 1 (minimum 1).',
    'Mauler':           'If the target is within Scan range, this weapon gains +1 Damage.',
    'Overcharge':       'May worsen Lock by 1 to gain +1 Damage for this attack.',
    'Penetrator':       'Enemy armour saves (ES/KS) are worsened by 1 against this weapon.',
    'Re-Entry':         'This weapon can target ground sectors for bombardment in addition to normal fire.',
    'Reave':            'For each point of hull damage inflicted, the target loses additional hull points equal to the Reave value.',
    'Scald':            'Reduces the target\'s Point Defence by the Scald value for the rest of the turn.',
    'Status':           'Applies a status effect to the target instead of dealing damage.',
    'Sustained Fire':   'If the ship did not use the Course Change order this activation, gain extra attack dice.',
    'Volley':           'Roll additional attack dice equal to the Volley value, but at Lock worsened by 1.'
  };

  function lookupRule(name) {
    // Shared rules lookup: try exact, then base keyword (strip numeric suffix),
    // then base-X form (BSData uses e.g. "Crippling-X" for parameterized rules)
    // Returns description string only
    const full = lookupRuleFull(name);
    return full ? full.description : '';
  }

  function lookupRuleFull(name) {
    // Returns {description, page} or null
    const baseKey = name.replace(/-?\d+$/, '').replace(/\s+\d+$/, '').trim();
    const xKey = baseKey + '-X';
    const entry = sharedRulesDB[name] || sharedRulesDB[baseKey] || sharedRulesDB[xKey];
    if (entry) return entry;
    const wpnDesc = WEAPON_SPECIAL_RULES[name] || WEAPON_SPECIAL_RULES[baseKey];
    if (wpnDesc) return { description: wpnDesc, page: '' };
    return null;
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

  function renderWeaponRow(w) {
    const special = w.special && w.special !== '-' ? w.special : '';
    const typeLabel = WEAPON_TYPE_LABELS[w.type] || w.type || '?';
    const typeClass = w.type ? `weapon-type-${w.type.toLowerCase()}` : '';
    const typeIcon = WEAPON_TYPE_ICONS[w.type] || '';
    return `<div class="weapon-row">
      <span class="weapon-col weapon-col-name">${esc(w.name)}</span>
      <span class="weapon-col weapon-col-arc" title="${ARC_LABELS[w.arc] || 'Firing Arc: ' + (w.arc || '')}">${esc(w.arc || '')}</span>
      <span class="weapon-col weapon-col-att">${w.attack}</span>
      <span class="weapon-col weapon-col-lock">${w.lock}</span>
      <span class="weapon-col weapon-col-dmg">${w.damage}</span>
      <span class="weapon-col weapon-col-type ${typeClass}" title="${typeLabel}">${typeIcon || w.type || '?'}</span>
      ${special ? `<span class="weapon-col weapon-col-special">${renderWeaponSpecialChips(special)}</span>` : ''}
    </div>`;
  }

  function renderGroupShipEntry(ship, dbShip, groupId) {
    const name = dbShip ? dbShip.name : ship.shipKey;
    const img = dbShip ? dbShip.image : '';
    const tonnage = dbShip ? dbShip.tonnage : '';
    const specialRules = dbShip && dbShip.special_rules ? dbShip.special_rules : [];

    const statsHtml = dbShip ? renderStatGrid(dbShip) : '';

    // Base weapons
    let weaponsHtml = '';
    const wpns = dbShip && Array.isArray(dbShip.weapons) ? dbShip.weapons : [];
    if (wpns.length > 0) {
      weaponsHtml = '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
    }

    // Loadout options — render selected option's weapons + selector
    let loadoutsHtml = '';
    const loadoutOpts = dbShip && Array.isArray(dbShip.loadoutOptions) ? dbShip.loadoutOptions : [];
    if (loadoutOpts.length > 0) {
      loadoutsHtml = loadoutOpts.map((lo, loIdx) => {
        const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
        const selOpt = lo.options[selIdx];
        const selWeapons = selOpt && selOpt.weapons ? selOpt.weapons : [];
        const selLoads = selOpt && selOpt.loads ? selOpt.loads : [];

        // Selector (only if multiple choices)
        let selectorHtml = '';
        if (lo.options.length > 1) {
          const opts = lo.options.map((opt, oi) => {
            const costLabel = opt.cost > 0 ? ` (+${opt.cost} pts)` : opt.cost < 0 ? ` (${opt.cost} pts)` : '';
            return `<option value="${oi}" ${oi === selIdx ? 'selected' : ''}>${esc(opt.name)}${costLabel}</option>`;
          }).join('');
          selectorHtml = `<div class="loadout-selector">
            <label class="loadout-label">${esc(lo.name)}</label>
            <select class="loadout-select" onchange="App.changeLoadout('${groupId}','${ship.id}',${loIdx},parseInt(this.value))">
              ${opts}
            </select>
          </div>`;
        } else {
          selectorHtml = '';
        }

        // Render selected option's weapons
        let optWpnsHtml = '';
        if (selWeapons.length > 0) {
          optWpnsHtml = '<div class="weapon-list loadout-weapons">' + renderWeaponHeader() + selWeapons.map(renderWeaponRow).join('') + '</div>';
        }

        // Render selected option's loads
        let optLoadsHtml = '';
        if (selLoads.length > 0) {
          optLoadsHtml = '<div class="load-list">' + selLoads.map(l =>
            `<div class="load-row">
              <span class="load-row-name">${esc(l.name)}</span>
              <div class="weapon-row-stats">
                <span class="weapon-stat-chip">Launch ${l.launch}</span>
                ${l.special && l.special !== '-' ? `<span class="weapon-stat-chip">${esc(l.special)}</span>` : ''}
              </div>
            </div>`
          ).join('') + '</div>';
        }

        return selectorHtml + optWpnsHtml + optLoadsHtml;
      }).join('');
    }

    // Base launch assets (loads)
    let loadsHtml = '';
    const loads = dbShip && Array.isArray(dbShip.loads) ? dbShip.loads : [];
    if (loads.length > 0) {
      loadsHtml = `<div class="load-list">
        <div class="load-section-label">Launch Assets</div>
        ${loads.map(l =>
          `<div class="load-row">
            <span class="load-row-name">${esc(l.name)}</span>
            <div class="weapon-row-stats">
              <span class="weapon-stat-chip">Launch ${l.launch}</span>
              ${l.special && l.special !== '-' ? `<span class="weapon-stat-chip">${esc(l.special)}</span>` : ''}
            </div>
          </div>`
        ).join('')}
      </div>`;
    }

    let rulesHtml = '';
    const ruleDetails = dbShip && dbShip.specialRuleDetails ? dbShip.specialRuleDetails : [];
    if (ruleDetails.length > 0) {
      rulesHtml = '<div class="special-rules">' + ruleDetails.map(r => {
        const desc = r.description || '';
        if (desc) {
          const pgAttr = r.page ? ` data-rule-page="${esc(r.page)}"` : '';
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(desc)}"${pgAttr} onclick="App.showRuleTooltip(event, this)">${esc(r.name)}</span>`;
        }
        return `<span class="rule-chip">${esc(r.name)}</span>`;
      }).join('') + '</div>';
    } else if (specialRules.length > 0) {
      rulesHtml = '<div class="special-rules">' + specialRules.map(r =>
        `<span class="rule-chip">${esc(r)}</span>`
      ).join('') + '</div>';
    }

    // Lore / flavor text (collapsible, hidden in print)
    let loreHtml = '';
    const loreText = dbShip ? dbShip.lore : '';
    if (loreText) {
      const loreId = `lore-${ship.id}`;
      const openAttr = settings.autoExpandLore ? ' open' : '';
      loreHtml = `<details class="ship-lore no-print" id="${loreId}"${openAttr}>
        <summary class="ship-lore-toggle">Lore</summary>
        <div class="ship-lore-text">${esc(loreText)}</div>
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

    return `
    <div class="group-ship-entry animate-in${compact ? ' compact' : ''}">
      ${img ? `<div class="ship-card-image"><img src="${esc(img)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-sm)">
        <div class="flex items-center justify-between">
          <div>
            <div class="ship-card-name ship-card-name-link" onclick="event.stopPropagation(); App.openShipDetail('${currentFleet.faction}','${ship.groupCategory}','${ship.shipKey}')">${esc(name)}${badges ? ` ${badges}` : ''}</div>
            <div class="ship-tonnage-label ship-tonnage-${ship.groupCategory || 'medium'}">${esc(tonnage)}</div>
          </div>
          <div class="ship-card-cost">${ship.points} pts</div>
        </div>
        ${compact ? '' : statsHtml}
        ${compact ? '' : weaponsHtml}
        ${compact ? '' : loadoutsHtml}
        ${compact ? '' : loadsHtml}
        ${rulesHtml}
        ${compact ? '' : loreHtml}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm group-ship-remove" onclick="App.removeShip('${groupId}','${ship.id}')" data-tooltip="Remove ship"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
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
    renderShipSelectGrid(factionShips.groups, 'all');
    openModal('modal-ship-select');
    if (searchInput) setTimeout(() => searchInput.focus(), 200);

    const fName = (factionData[factionKey] || {}).name || factionKey.toUpperCase();
    document.getElementById('ship-select-title').textContent = pendingGroupCreation
      ? `New Group — ${fName}`
      : `Add Unit — ${fName}`;
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

  const SHIP_FILTERS = [
    { key: 'launch',  label: 'Has Launch',   test: s => (s.loads && s.loads.length > 0) || (s.loadoutOptions || []).some(lo => lo.options.some(o => o.loads && o.loads.length > 0)) },
    { key: 'loadout', label: 'Has Loadout',  test: s => s.loadoutOptions && s.loadoutOptions.length > 0 },
    { key: 'rare',    label: 'Rare',         test: s => s.isRare },
    { key: 'unique',  label: 'Unique',       test: s => s.isUnique }
  ];

  function renderShipFilters() {
    const container = document.getElementById('ship-select-filters');
    if (!container) return;
    container.innerHTML = SHIP_FILTERS.map(f =>
      `<button class="filter-chip ${activeFilters.has(f.key) ? 'active' : ''}" onclick="App.toggleShipFilter('${f.key}')">${f.label}</button>`
    ).join('');
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

  function searchShips(query) {
    shipSearchQuery = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('ship-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !shipSearchQuery);
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) {
      renderShipSelectGrid(factionShips.groups, activeCategory);
    }
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

    // Hide auxiliary/mercenary ships when setting is off
    if (!settings.showAuxiliaries) {
      ships = ships.filter(s => s.data.image);
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

    if (shipSortMode === 'cost') {
      ships.sort((a, b) => (a.data.points || 0) - (b.data.points || 0));
    } else {
      ships.sort((a, b) => (a.data.name || '').localeCompare(b.data.name || ''));
    }

    // Update results bar
    const resultsBar = document.getElementById('ship-results-bar');
    if (resultsBar) {
      const isFiltered = shipSearchQuery || activeFilters.size > 0 || category !== 'all';
      if (isFiltered) {
        let ctx = [];
        if (shipSearchQuery) ctx.push(`"${esc(shipSearchQuery)}"`);
        if (activeFilters.size > 0) ctx.push([...activeFilters].join(', '));
        resultsBar.innerHTML = `<span class="results-count">${ships.length} ship${ships.length !== 1 ? 's' : ''}</span>${ctx.length ? ` <span class="results-context">matching ${ctx.join(' + ')}</span>` : ''}`;
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
    let selectBadges = '';
    if (data.isUnique) selectBadges += '<span class="ship-badge ship-badge-unique">Unique</span>';
    else if (data.isRare) selectBadges += '<span class="ship-badge ship-badge-rare">Rare</span>';

    // Compact weapon summary for ship select cards
    const wpns = data.weapons || [];
    const loadoutCount = (data.loadoutOptions || []).length;
    const hasLoads = (data.loads && data.loads.length > 0) || (data.loadoutOptions || []).some(lo => lo.options.some(o => o.loads && o.loads.length > 0));
    let weaponSummary = '';
    if (wpns.length > 0 || loadoutCount > 0) {
      const parts = [];
      wpns.forEach(w => {
        const typeIcon = WEAPON_TYPE_ICONS[w.type] || '';
        parts.push(`<span class="weapon-mini" title="${esc(w.name)}: ${w.attack}A Lk${w.lock} D${w.damage} ${w.arc || ''}">${typeIcon} ${esc(w.name)}</span>`);
      });
      if (loadoutCount > 0) {
        parts.push(`<span class="weapon-mini weapon-mini-loadout" title="${loadoutCount} loadout option${loadoutCount > 1 ? 's' : ''}">+ ${loadoutCount} loadout</span>`);
      }
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

    return `
    <div class="ship-card" onclick="App.addShipToGroup('${key}','${category}')">
      <div class="ship-card-top">
        ${data.image ? `<div class="ship-card-image"><img src="${esc(data.image)}" alt="${esc(data.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
        <div class="ship-card-info">
          <div class="ship-card-name">${esc(data.name)}${selectBadges ? ` ${selectBadges}` : ''}</div>
          <div class="ship-card-type">${esc(data.tonnage || '')} · ${catLabel}</div>
        </div>
        <div class="ship-card-cost">${data.points || 0}<span style="font-size:var(--text-sm);font-weight:var(--weight-regular)"> pts</span></div>
      </div>
      ${renderStatGrid(data)}
      ${weaponSummary}
      ${specialRules.length > 0 ? `<div class="special-rules">${specialRules.slice(0, 4).map(r => {
        const detail = (data.specialRuleDetails || []).find(d => d.name === r);
        if (detail && detail.description) {
          const pgA = detail.page ? ` data-rule-page="${esc(detail.page)}"` : '';
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(detail.description)}"${pgA} onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r)}</span>`;
        }
        return `<span class="rule-chip">${esc(r)}</span>`;
      }).join('')}${specialRules.length > 4 ? `<span class="rule-chip" style="background:rgba(255,255,255,0.06);color:var(--ink-faint)">+${specialRules.length - 4}</span>` : ''}</div>` : ''}
      <div class="flex items-center justify-between" style="margin-top:auto">
        <span class="text-caption">${data.g ? `Group: ${data.g}` : ''}${launchIndicator ? (data.g ? ' · ' : '') + launchIndicator : ''}</span>
        <div class="flex gap-xs">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation(); App.openShipDetail('${currentFleet.faction}','${category}','${key}')" title="View details"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></svg></button>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.addShipToGroup('${key}','${category}')">+ Add</button>
        </div>
      </div>
    </div>`;
  }

  function addShipToGroup(shipKey, category) {
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
          showToast(`${dbShip.name} is Unique — only 1 group allowed`);
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
          showToast(`${dbShip.name} is Rare — max ${rareMax} group${rareMax > 1 ? 's' : ''} at ${sizeInfo.label}`);
          return;
        }
      }

      const group = { id: uuid(), name: dbShip.name, ships: [] };
      addShipToGroupInner(group, shipKey, category, dbShip);
      currentFleet.battleGroups.push(group);
      activeGroupId = group.id;

      pendingGroupCreation = false;
      closeModal('modal-ship-select');
      saveFleets();
      renderGroupsNav();
      renderActiveGroup();
      updatePoints();
      showToast(`Created group: ${dbShip.name}`);
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

    // Update selection
    if (!ship.loadouts) ship.loadouts = {};
    ship.loadouts[loadoutIdx] = optionIdx;

    // Recalculate total points: base + all loadout costs
    let total = dbShip.points || 0;
    dbShip.loadoutOptions.forEach((lo, li) => {
      const selIdx = ship.loadouts[li] ?? 0;
      total += lo.options[selIdx]?.cost || 0;
    });
    ship.points = total;

    saveFleets();
    updatePoints();
    renderGroupsNav();
    renderActiveGroup();
  }

  function removeShip(groupId, shipId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group) return;
    group.ships = group.ships.filter(s => s.id !== shipId);
    saveFleets();
    updatePoints();
    renderGroupsNav();
    renderActiveGroup();
  }

  function addSameShip(groupId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group || group.ships.length === 0) return;

    const firstShip = group.ships[0];
    const dbShip = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
    if (!dbShip) return;

    const groupMax = dbShip.groupMax || 12;
    if (group.ships.length >= groupMax) {
      showToast(`Maximum ${groupMax} ships per group`);
      return;
    }

    addShipToGroupInner(group, firstShip.shipKey, firstShip.groupCategory, dbShip);
    saveFleets();
    updatePoints();
    renderGroupsNav();
    renderActiveGroup();
  }

  function removeLastShip(groupId) {
    if (!currentFleet) return;
    const group = currentFleet.battleGroups.find(g => g.id === groupId);
    if (!group || group.ships.length === 0) return;

    const firstShip = group.ships[0];
    const dbShip = findShipInDB(currentFleet.faction, firstShip.groupCategory, firstShip.shipKey);
    const groupMin = dbShip ? (dbShip.groupMin || 1) : 1;

    if (group.ships.length <= groupMin) {
      showToast(`Minimum ${groupMin} ship${groupMin > 1 ? 's' : ''} per group`);
      return;
    }

    group.ships.pop();
    saveFleets();
    updatePoints();
    renderGroupsNav();
    renderActiveGroup();
  }

  function sortShips(mode) {
    shipSortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === mode));
    const factionShips = shipDB[currentFleet.faction];
    if (factionShips && factionShips.groups) {
      renderShipSelectGrid(factionShips.groups, activeCategory);
    }
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
    return (currentFleet.admirals || []).some(a => a.type === 'Famous');
  }

  function openAdmiralModal() {
    if (!currentFleet) return;
    const factionShips = shipDB[currentFleet.faction];
    if (!factionShips) return;

    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const maxLevel = sizeInfo.maxAdmiralLevel || 4;
    const genericAdmirals = (factionShips.admirals || []).filter(a => !a.isFamous);
    const admiralGroup = factionShips.groups?.famous_admirals;
    const alreadyHasFamous = hasFamousAdmiral();

    const container = document.getElementById('admiral-options');

    let html = `
    <div style="margin-bottom:var(--sp-md);padding:var(--sp-md);background:var(--surface);border:1px solid var(--stroke);border-radius:var(--radius-md);font-size:var(--text-sm);line-height:1.6;color:var(--ink-muted)">
      <strong style="color:var(--ink)">Admiral Rules (Section 4.2.1)</strong><br>
      You may take any number of Admirals. Each must be assigned to a Capital Ship
      (Medium, Heavy, or Colossal tonnage). Only one Famous or Faction Admiral is
      allowed per fleet. Admiral level is capped at Lv${maxLevel} for ${sizeInfo.label} games.
    </div>`;

    if (genericAdmirals.length > 0) {
      html += `<div style="margin-top:var(--sp-lg);margin-bottom:var(--sp-sm);font-weight:var(--weight-semibold);font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted)">Generic Admirals</div>`;
      genericAdmirals.forEach(adm => {
        const baseLevel = adm.level || 1;
        const baseCost = adm.cost || 0;
        let levelOptions = '';
        for (let lv = baseLevel; lv <= maxLevel; lv++) {
          const upgradeCost = lv > baseLevel ? getAdmiralLevelCost(lv) : 0;
          const totalCost = baseCost + upgradeCost;
          const selected = lv === baseLevel ? 'checked' : '';
          levelOptions += `<label class="level-option" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;padding:4px 8px;border:1px solid var(--stroke);border-radius:var(--radius-sm);font-size:var(--text-sm)">
            <input type="radio" name="generic-level-${adm.id}" value="${lv}" data-cost="${totalCost}" ${selected} style="margin:0">
            Lv${lv} <span class="text-muted">${totalCost}pts</span>
          </label> `;
        }
        const abilities = (adm.abilities || []).slice(0, 3);
        html += `
        <div class="admiral-card card-interactive" style="cursor:pointer" data-admiral-id="${adm.id}">
          <div style="flex:1;min-width:0">
            <div class="admiral-name">${esc(adm.name)}</div>
            <div class="admiral-level" style="margin-bottom:var(--sp-sm)">Base Level ${baseLevel} · ${esc(baseCost)} pts</div>
            <div class="flex gap-sm flex-wrap" style="margin-bottom:var(--sp-sm)">${levelOptions}</div>
            <button class="btn btn-primary btn-sm" onclick="App.addGenericAdmiral('${adm.id}', this)">Add to Fleet</button>
          </div>
          ${abilities.length > 0 ? `<div style="margin-top:var(--sp-sm);font-size:var(--text-sm);color:var(--ink-muted);line-height:1.5">${abilities.map(a => `<div style="margin-bottom:var(--sp-xs)"><strong>${esc(a.name || '')}</strong>${a.description ? ': ' + esc(a.description) : ''}</div>`).join('')}</div>` : ''}
        </div>`;
      });
    }

    if (admiralGroup && admiralGroup.ships && Object.keys(admiralGroup.ships).length > 0) {
      html += `<div style="margin-top:var(--sp-lg);margin-bottom:var(--sp-sm);font-weight:var(--weight-semibold);font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted)">Famous Admirals</div>`;
      if (alreadyHasFamous) {
        html += `<div style="margin-bottom:var(--sp-sm);padding:var(--sp-sm) var(--sp-md);background:var(--gold-subtle);border:1px solid var(--gold-line);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--gold-dark)">Your fleet already has a Famous Admiral. Only one is allowed per fleet.</div>`;
      }
      Object.entries(admiralGroup.ships).forEach(([key, admiral]) => {
        const abilities = admiral.special_abilities || [];
        const disabled = alreadyHasFamous;
        html += `
        <div class="admiral-card card-interactive${disabled ? ' disabled' : ''}" ${disabled ? '' : `onclick="App.addFamousAdmiral('${key}')"`} style="cursor:${disabled ? 'not-allowed' : 'pointer'};${disabled ? 'opacity:0.5;' : ''}">
          <div class="flex gap-md items-start">
            ${admiral.image ? `<div class="ship-card-image"><img src="${esc(admiral.image)}" alt="${esc(admiral.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
            <div style="flex:1;min-width:0">
              <div class="admiral-name">${esc(admiral.name)}</div>
              <div class="admiral-level">Level ${admiral.level || '?'} · Famous</div>
              <div class="flex gap-sm flex-wrap" style="margin-top:var(--sp-xs)">
                <span class="badge badge-gold">${admiral.points} pts total</span>
                <span class="badge badge-neutral">Admiral: ${admiral.admiral_cost} pts</span>
                <span class="badge badge-neutral">Ship: ${admiral.ship_cost} pts</span>
              </div>
            </div>
          </div>
          ${abilities.length > 0 ? `<div style="margin-top:var(--sp-md);font-size:var(--text-sm);color:var(--ink-muted);line-height:1.5">${abilities.map(a => `<div style="margin-bottom:var(--sp-xs)"><strong>${esc(a.name || '')}</strong>${a.description ? ': ' + esc(a.description) : ''}</div>`).join('')}</div>` : ''}
        </div>`;
      });
    }

    container.innerHTML = html;
    openModal('modal-admiral');
  }

  function addGenericAdmiral(admiralId, btn) {
    if (!currentFleet) return;
    if (!currentFleet.admirals) currentFleet.admirals = [];
    const factionShips = shipDB[currentFleet.faction];
    const adm = (factionShips.admirals || []).find(a => a.id === admiralId);
    if (!adm) return;

    const card = btn.closest('.admiral-card');
    const checked = card.querySelector(`input[name="generic-level-${admiralId}"]:checked`);
    const level = checked ? parseInt(checked.value) : adm.level;
    const cost = checked ? parseInt(checked.dataset.cost) : adm.cost;

    currentFleet.admirals.push({
      admiralId,
      name: adm.name,
      points: cost,
      level,
      type: 'Generic'
    });

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
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
      type: 'Famous'
    });

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
  }

  function removeAdmiral(index) {
    if (!currentFleet || !currentFleet.admirals) return;
    currentFleet.admirals.splice(index, 1);
    saveFleets();
    renderAdmiralSlot();
    updatePoints();
  }

  function renderAdmiralSlot() {
    const slot = document.getElementById('admiral-slot');
    if (!currentFleet) return;
    const admirals = currentFleet.admirals || [];

    if (admirals.length === 0) {
      slot.innerHTML = `
      <div class="add-ship-area" onclick="App.openAdmiralModal()" style="padding:var(--sp-lg);min-height:60px">
        <span style="font-size:var(--text-sm)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> Add Admiral</span>
      </div>`;
      return;
    }

    let html = admirals.map((a, i) => `
    <div class="admiral-card" style="margin-bottom:var(--sp-sm)">
      <div class="flex items-center justify-between">
        <div>
          <div class="admiral-name">${esc(a.name)}</div>
          <div class="admiral-level">Level ${a.level || '?'}${a.type === 'Famous' ? ' · Famous' : ''}</div>
        </div>
        <span class="badge badge-gold">${a.points} pts</span>
      </div>
      <div class="flex gap-xs" style="margin-top:var(--sp-sm)">
        <button class="btn btn-danger btn-sm" onclick="App.removeAdmiral(${i})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"/><path d="M3 4l1 10h8l1-10"/></svg> Remove</button>
      </div>
    </div>`).join('');

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
      <div class="add-ship-area" onclick="App.openStationModal()" style="padding:var(--sp-lg);min-height:60px">
        <span style="font-size:var(--text-sm)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z"/><path d="M8 8v7M2 4.5L8 8l6-3.5"/></svg> Choose Station</span>
      </div>`;
      return;
    }

    // Show station stats inline
    const ss = station;
    const stats = ss.stats || {};
    const statPairs = [
      ['Hull', stats.hull], ['ES', stats.es], ['KS', stats.ks],
      ['Scan', stats.scan], ['Sig', stats.sig]
    ].filter(([,v]) => v && v !== '-' && v !== '--');
    const statLine = statPairs.map(([l,v]) => `<span class="station-stat">${l} ${v}</span>`).join('');

    const specialRules = (ss.specialRules || []).map(r => r.name || '').filter(Boolean);
    const rulesLine = specialRules.length > 0
      ? `<div class="station-rules">${specialRules.map(r => `<span class="rule-chip rule-chip-sm">${esc(r)}</span>`).join('')}</div>`
      : '';

    slot.innerHTML = `
    <div class="station-card">
      <div class="flex items-center justify-between">
        <div>
          <div class="station-name">${esc(ss.name)}</div>
          <div class="station-stats">${statLine}</div>
        </div>
        <span class="badge badge-gold">${ss.cost} pts</span>
      </div>
      ${rulesLine}
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
      const statPairs = [
        ['Hull', stats.hull], ['ES', stats.es], ['KS', stats.ks],
        ['Scan', stats.scan], ['Sig', stats.sig]
      ].filter(([,v]) => v && v !== '-' && v !== '--');
      const statLine = statPairs.map(([l,v]) => `<span class="station-stat">${l} ${v}</span>`).join('');

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
      return `<div class="station-option${isCurrent ? ' station-option-active' : ''}" onclick="App.selectStation('${ss.id}')">
        <div class="flex items-center justify-between" style="margin-bottom:var(--sp-xs)">
          <span class="station-option-name">${esc(ss.name)}${isCurrent ? ' <span class="badge badge-navy" style="font-size:9px">Current</span>' : ''}</span>
          <span class="badge badge-gold">${ss.cost} pts</span>
        </div>
        <div class="station-stats">${statLine}</div>
        ${rulesLine}
      </div>`;
    }).join('');

    // Add deployable features reference if faction has them
    const features = factionInfo.deployableFeatures || [];
    if (features.length > 0) {
      container.innerHTML += `
      <div style="border-top:1px solid var(--stroke);padding-top:var(--sp-md);margin-top:var(--sp-sm)">
        <div class="text-overline" style="margin-bottom:var(--sp-sm)">Deployable Sector Features</div>
        <p class="text-caption" style="margin-bottom:var(--sp-sm)">These features are deployed to dropsites during the game. Cost is 0 pts — they are included with your faction.</p>
        ${features.map(df => {
          const featureStats = (df.features || []).map(f =>
            `<span class="station-stat">${esc(f.name)}${f.es ? ` ES:${f.es}` : ''}${f.ks ? ` KS:${f.ks}` : ''}</span>`
          ).join('');
          const featureRules = (df.rules || []).map(r =>
            r.description
              ? `<span class="rule-chip rule-chip-sm has-tooltip" data-rule-desc="${esc(r.description)}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r.name)}</span>`
              : `<span class="rule-chip rule-chip-sm">${esc(r.name)}</span>`
          ).join('');
          return `<div class="feature-ref-card">
            <div class="feature-ref-name">${esc(df.name)}</div>
            ${featureStats ? `<div class="station-stats">${featureStats}</div>` : ''}
            ${featureRules ? `<div style="margin-top:var(--sp-xs)">${featureRules}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }

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
      cost: station.cost,
      stats: station.stats,
      specialRules: station.specialRules
    };

    saveFleets();
    closeModal('modal-station');
    renderStationSlot();
    updatePoints();
    showToast(`${station.name} selected`);
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
  function printFleet() {
    if (!currentFleet) return;
    const f = currentFleet;
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
          `<div class="print-warning print-warning-${w.type}">${w.type === 'error' ? 'ILLEGAL' : 'NOTE'}: ${esc(w.msg)}</div>`
        ).join('')}</div>`
      : '';

    // Fleet composition by tonnage for print
    const printCatCounts = {};
    f.battleGroups.forEach(g => {
      g.ships.forEach(s => {
        const cat = s.groupCategory || 'medium';
        if (!printCatCounts[cat]) printCatCounts[cat] = 0;
        printCatCounts[cat]++;
      });
    });
    const compParts = CATEGORY_ORDER
      .filter(c => printCatCounts[c])
      .map(c => `${printCatCounts[c]} ${CATEGORY_LABELS[c]}`);
    const compLine = compParts.length > 0 ? compParts.join(' · ') : '';

    // Print date
    const printDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const fIcon = FACTION_ICONS[f.faction];

    let html = `<div class="print-fleet" data-fleet-name="${esc(f.name)}">
      <div class="print-header">
        <div class="print-header-top">
          ${fIcon ? `<img src="${fIcon}" alt="" class="print-faction-icon">` : ''}
          <div class="print-header-text">
            <div class="print-fleet-name">${esc(f.name)}</div>
            <div class="print-fleet-meta">${esc(fName)} — ${sizeInfo.label} — ${pts}${sizeInfo.max !== 99999 ? '/' + sizeInfo.max : ''} pts</div>
          </div>
          <div class="print-header-points">
            <div class="print-points-big">${pts}</div>
            <div class="print-points-cap">${sizeInfo.max !== 99999 ? '/ ' + sizeInfo.max : ''} pts</div>
          </div>
        </div>
        <div class="print-fleet-summary">${totalGroups} group${totalGroups !== 1 ? 's' : ''} · ${totalShips} ship${totalShips !== 1 ? 's' : ''}${admCount > 0 ? ` · ${admCount} admiral${admCount !== 1 ? 's' : ''}` : ''}${f.spaceStation ? ` · ${esc(f.spaceStation.name)}` : ''}${compLine ? ` · ${compLine}` : ''}</div>
        <div class="print-fleet-date">Printed ${printDate}</div>
      </div>
      ${printWarnings}`;

    // Admirals
    if (f.admirals && f.admirals.length > 0) {
      const factionAdmirals = factionInfo ? factionInfo.admirals || [] : [];
      html += `<div class="print-section">
        <div class="print-section-title">Admiral${f.admirals.length > 1 ? 's' : ''}</div>
        ${f.admirals.map(a => {
          const fullAdm = a.admiralId ? factionAdmirals.find(fa => fa.id === a.admiralId) : null;
          const abilities = fullAdm ? (fullAdm.abilities || []) : [];
          let abilitiesHtml = '';
          if (abilities.length > 0) {
            abilitiesHtml = `<div class="print-admiral-abilities">
              ${abilities.map(ab => `<div class="print-admiral-ability"><span class="print-ability-name">${esc(ab.name)}</span> <span class="print-ability-cost">${esc(ab.cost)}</span> — ${esc(ab.effect)}</div>`).join('')}
            </div>`;
          }
          return `<div class="print-admiral-card">
            <div class="print-admiral-header">
              <span class="print-admiral-name">${esc(a.name)} — Level ${a.level || '?'}${a.type === 'Famous' ? ' (Famous)' : ''}</span>
              <span class="print-admiral-pts">${a.points} pts</span>
            </div>
            ${abilitiesHtml}
          </div>`;
        }).join('')}
      </div>`;
    }

    // Space Station
    if (f.spaceStation) {
      const ss = f.spaceStation;
      const ssStats = ss.stats || {};
      const ssStatPairs = [
        ['Hull', ssStats.hull], ['ES', ssStats.es], ['KS', ssStats.ks],
        ['Scan', ssStats.scan], ['Sig', ssStats.sig]
      ].filter(([,v]) => v && v !== '-' && v !== '--');
      const ssStatLine = ssStatPairs.map(([l,v]) => `${l}: ${v}`).join(' · ');
      const ssRules = (ss.specialRules || []).map(r => esc(r.name || '')).filter(Boolean).join(', ');
      // Station hull damage boxes
      const ssHull = parseInt(ssStats.hull, 10);
      let ssDmgHtml = '';
      if (ssHull && ssHull > 0) {
        const boxes = Array.from({length: ssHull}, () => '<span class="print-dmg-box"></span>').join('');
        ssDmgHtml = `<div class="print-dmg-track"><span class="print-dmg-label">Hull</span>${boxes}</div>`;
      }
      // Station weapons
      let ssWeaponsHtml = '';
      if (ss.weapons && ss.weapons.length > 0) {
        ssWeaponsHtml = '<div class="weapon-list">' + renderWeaponHeader() + ss.weapons.map(renderWeaponRow).join('') + '</div>';
      }
      html += `<div class="print-section">
        <div class="print-section-title">Space Station</div>
        <div class="print-station">
          <div class="print-ship-header">
            <span class="print-ship-name">${esc(ss.name)}</span>
            <span class="print-ship-pts">${ss.cost} pts</span>
          </div>
          <div class="print-station-stats">${ssStatLine}</div>
          ${ssDmgHtml}
          ${ssWeaponsHtml}
          ${ssRules ? `<div class="print-station-rules">Rules: ${ssRules}</div>` : ''}
        </div>
      </div>`;
      // Collect station rules for glossary
      (ss.specialRules || []).forEach(r => {
        if (r.description) rulesGlossary[r.name] = { description: r.description, page: r.page || '' };
      });
    }

    // Groups
    const allLaunchAssetNames = new Set();
    f.battleGroups.forEach(g => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      html += `<div class="print-group">
        <div class="print-group-header">
          <span class="print-group-name">${esc(g.name)}</span>
          <span class="print-group-pts">${gPts} pts — ${g.ships.length} ship${g.ships.length !== 1 ? 's' : ''}</span>
        </div>`;

      g.ships.forEach(ship => {
        const db = findShipInDB(f.faction, ship.groupCategory, ship.shipKey);
        if (!db) return;
        const name = db.name;
        const statsHtml = renderStatGrid(db);

        // Weapons
        let wpnsHtml = '';
        const wpns = db.weapons || [];
        if (wpns.length > 0) {
          wpnsHtml = '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
        }

        // Loadout weapons
        let loadoutWpnsHtml = '';
        (db.loadoutOptions || []).forEach((lo, loIdx) => {
          const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
          const selOpt = lo.options[selIdx];
          if (selOpt && selOpt.weapons && selOpt.weapons.length > 0) {
            const loLabel = lo.name || 'Loadout';
            loadoutWpnsHtml += `<div class="print-loadout-label">${esc(loLabel)}: ${esc(selOpt.name || selOpt.weapons[0].name)}</div>`;
            loadoutWpnsHtml += '<div class="weapon-list">' + renderWeaponHeader() + selOpt.weapons.map(renderWeaponRow).join('') + '</div>';
          }
        });

        // Loads (base + selected loadout options)
        const allLoads = [...(db.loads || [])];
        (db.loadoutOptions || []).forEach((lo, loIdx) => {
          const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
          const selOpt = lo.options[selIdx];
          if (selOpt && selOpt.loads) allLoads.push(...selOpt.loads);
        });
        let loadsHtml = '';
        if (allLoads.length > 0) {
          loadsHtml = allLoads.map(l => {
            allLaunchAssetNames.add(l.name);
            return `<span class="print-load">${esc(l.name)} (Launch ${l.launch}${l.special && l.special !== '-' ? ', ' + l.special : ''})</span>`;
          }).join(' ');
          loadsHtml = `<div class="print-loads">Launch: ${loadsHtml}</div>`;
        }

        // Collect special rules for glossary
        (db.specialRuleDetails || []).forEach(r => {
          if (r.description) rulesGlossary[r.name] = { description: r.description, page: r.page || '' };
        });

        // Collect weapon special rules for glossary (prefer BSData descriptions)
        const collectWeaponSpecials = (weapons) => {
          (weapons || []).forEach(w => {
            if (!w.special || w.special === '-') return;
            w.special.split(',').forEach(s => {
              const trimmed = s.trim();
              if (!trimmed) return;
              const baseKey = trimmed.replace(/-?\d+$/, '');
              const full = lookupRuleFull(trimmed);
              if (full) rulesGlossary[baseKey || trimmed] = { description: full.description, page: full.page || '' };
            });
          });
        };
        collectWeaponSpecials(wpns);
        (db.loadoutOptions || []).forEach((lo, loIdx) => {
          const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
          const selOpt = lo.options[selIdx];
          if (selOpt && selOpt.weapons) collectWeaponSpecials(selOpt.weapons);
        });

        // Rules — inline with full descriptions for print
        const ruleDetails = db.specialRuleDetails || [];
        const ruleNames = ruleDetails.map(r => esc(r.name)).join(', ') ||
                          (db.special_rules || []).map(r => esc(r)).join(', ');
        let rulesInlineHtml = '';
        if (ruleDetails.length > 0) {
          rulesInlineHtml = `<div class="print-rules-inline">
            ${ruleDetails.map(r => {
              const pageRef = r.page ? ` <span class="print-glossary-page">p.${esc(r.page)}</span>` : '';
              return `<div class="print-rule-entry"><span class="print-rule-name">${esc(r.name)}${pageRef}</span>${r.description ? ` — ${esc(r.description)}` : ''}</div>`;
            }).join('')}
          </div>`;
        } else if (ruleNames) {
          rulesInlineHtml = `<div class="print-rules">Rules: ${ruleNames}</div>`;
        }

        // Tonnage label
        const tonnageLabel = db.tonnage || CATEGORY_LABELS[ship.groupCategory] || '';
        const artSrc = shipArtPath(db.name);

        // Damage tracking boxes — hull boxes for marking damage during play
        const hullVal = parseInt(db.hull, 10);
        let dmgBoxesHtml = '';
        if (hullVal && hullVal > 0) {
          const boxes = Array.from({length: hullVal}, () => '<span class="print-dmg-box"></span>').join('');
          dmgBoxesHtml = `<div class="print-dmg-track"><span class="print-dmg-label">Hull</span>${boxes}</div>`;
        }

        // Badge indicators
        const badges = [];
        if (db.isUnique) badges.push('<span class="print-badge print-badge-unique">Unique</span>');
        else if (db.isRare) badges.push('<span class="print-badge print-badge-rare">Rare</span>');
        const badgeHtml = badges.length > 0 ? ` ${badges.join(' ')}` : '';

        html += `<div class="print-ship">
          <div class="print-ship-top">
            ${artSrc ? `<div class="print-ship-art"><img src="${artSrc}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
            <div class="print-ship-content">
              <div class="print-ship-header">
                <span class="print-ship-name">${esc(name)}${tonnageLabel ? ` <span class="print-ship-tonnage">${esc(tonnageLabel)}</span>` : ''}${badgeHtml}</span>
                <span class="print-ship-pts">${ship.points} pts</span>
              </div>
              ${statsHtml}
              ${dmgBoxesHtml}
            </div>
          </div>
          ${wpnsHtml}
          ${loadoutWpnsHtml}
          ${loadsHtml}
          ${rulesInlineHtml}
        </div>`;
      });

      html += '</div>';
    });

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

    // Rules glossary — full text for every rule used, with page references
    const glossaryEntries = Object.entries(rulesGlossary).sort((a, b) => a[0].localeCompare(b[0]));
    if (glossaryEntries.length > 0) {
      html += `<div class="print-section print-glossary">
        <div class="print-section-title">Rules Reference</div>
        ${glossaryEntries.map(([name, entry]) => {
          const desc = typeof entry === 'string' ? entry : (entry.description || '');
          const page = typeof entry === 'object' ? (entry.page || '') : '';
          const pageRef = page ? ` <span class="print-glossary-page">p.${esc(page)}</span>` : '';
          return `<div class="print-glossary-entry">
            <span class="print-glossary-name">${esc(name)}${pageRef}</span>
            <span class="print-glossary-desc">${esc(desc).replace(/\n/g, '<br>')}</span>
          </div>`;
        }).join('')}
      </div>`;
    }

    html += '</div>';

    // Create print container, print, then remove
    const printDiv = document.createElement('div');
    printDiv.id = 'print-container';
    printDiv.innerHTML = html;
    document.body.appendChild(printDiv);
    window.print();
    printDiv.remove();
  }

  // ── Shared Fleet Viewer ──
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
          <div class="shared-fleet-points">${pts}<span class="shared-fleet-pts-label"> / ${sizeInfo.max} pts</span></div>
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
        <div class="shared-section-title">${esc(g.name)} <span class="text-caption">${shipCount} ship${shipCount !== 1 ? 's' : ''} · ${gPts} pts</span></div>
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
        const tonnage = dbShip ? dbShip.tonnage : '';
        const cat = CATEGORY_LABELS[ship.groupCategory] || ship.groupCategory;
        const img = shipArtPath(name);

        html += `<div class="shared-ship-card">`;
        html += `<div class="shared-ship-top">`;
        if (img) html += `<div class="shared-ship-art"><img src="${esc(img)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"></div>`;
        html += `<div class="shared-ship-info">
            <div class="shared-ship-name">${count > 1 ? count + '× ' : ''}${esc(name)}</div>
            <div class="shared-ship-type">${esc(tonnage)} · ${cat}</div>
          </div>
          <div class="shared-ship-pts">${ship.points * count}<span class="shared-ship-pts-label"> pts</span></div>
        </div>`;

        // Show stats if available
        if (dbShip) {
          html += renderStatGrid(dbShip);

          // Loadout info
          if (ship.loadout && dbShip.loadoutOptions) {
            const loGroup = dbShip.loadoutOptions.find(lo => lo.options.some(o => o.key === ship.loadout));
            const loOption = loGroup ? loGroup.options.find(o => o.key === ship.loadout) : null;
            if (loOption) {
              html += `<div class="shared-loadout">Loadout: <strong>${esc(loOption.name)}</strong></div>`;
            }
          }

          const wpns = dbShip.weapons || [];
          if (wpns.length > 0) {
            html += '<div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
          }

          // Special rules
          const rules = dbShip.special_rules || [];
          if (rules.length > 0) {
            html += `<div class="special-rules">${rules.map(r => {
              const detail = (dbShip.specialRuleDetails || []).find(d => d.name === r);
              if (detail && detail.description) {
                const pgA = detail.page ? ` data-rule-page="${esc(detail.page)}"` : '';
                return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(detail.description)}"${pgA} onclick="App.showRuleTooltip(event, this)">${esc(r)}</span>`;
              }
              return `<span class="rule-chip">${esc(r)}</span>`;
            }).join('')}</div>`;
          }
        }

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
    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">Share Link</div>
        <div class="share-url-row">
          <input type="text" class="share-url-input" value="${esc(url)}" readonly id="share-url-input" onclick="this.select()">
          <button class="btn btn-primary btn-sm" onclick="App.copyShareURL()">Copy</button>
        </div>
        <p class="text-caption" style="margin-top:var(--sp-sm)">Anyone with this link can view and import your fleet.</p>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Text Export</div>
        <textarea class="share-text-export" readonly onclick="this.select()">${esc(text)}</textarea>
        <button class="btn btn-outline btn-sm" style="margin-top:var(--sp-sm)" onclick="App.copyShareText()">Copy Text</button>
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

  function importFleetFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showToast('Clipboard access not available');
      return;
    }
    navigator.clipboard.readText().then(text => {
      if (!text || !text.trim()) {
        showToast('Clipboard is empty');
        return;
      }
      try {
        // Try to decode a share URL first
        const urlMatch = text.match(/[?#]share\/([A-Za-z0-9+/=_-]+)/);
        if (urlMatch) {
          const fleet = decodeFleet(urlMatch[1]);
          if (fleet) {
            importSingleFleet(fleet);
            return;
          }
        }

        // Try raw JSON — could be single fleet or array of fleets (backup)
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          // Bulk import from backup
          let count = 0;
          parsed.forEach(f => {
            if (f && f.faction && f.battleGroups) {
              importSingleFleet(f, true);
              count++;
            }
          });
          if (count > 0) {
            renderFleetList();
            showToast(`Imported ${count} fleet${count > 1 ? 's' : ''}`);
          } else {
            showToast('No valid fleets found in data');
          }
          return;
        }

        if (parsed && parsed.faction && parsed.battleGroups) {
          importSingleFleet(parsed);
          return;
        }

        showToast('Invalid fleet data');
      } catch (e) {
        showToast('Could not parse fleet data');
      }
    }).catch(() => {
      showToast('Clipboard access denied');
    });
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

  function generateFleetText(fleet) {
    const fName = (factionData[fleet.faction] || {}).name || fleet.faction.toUpperCase();
    const pts = calcFleetPoints(fleet);
    const sizeInfo = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    let text = `${fleet.name}\n${fName} - ${sizeInfo.label} (${pts} pts)\n`;
    text += '═'.repeat(40) + '\n';

    if (fleet.admirals && fleet.admirals.length > 0) {
      fleet.admirals.forEach(a => {
        text += `\nADMIRAL: ${a.name} — Lv${a.level || '?'}${a.type === 'Famous' ? ' (Famous)' : ''} (${a.points} pts)\n`;
      });
    }

    if (fleet.spaceStation) {
      text += `\nSTATION: ${fleet.spaceStation.name} (${fleet.spaceStation.cost} pts)\n`;
    }

    fleet.battleGroups.forEach(g => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      text += `\n── ${g.name} (${gPts} pts, ${g.ships.length} ship${g.ships.length !== 1 ? 's' : ''}) ──\n`;
      // Group ships by profile to show quantity
      const profiles = {};
      g.ships.forEach(s => {
        const key = s.groupCategory + '/' + s.shipKey + '/' + JSON.stringify(s.loadouts || []);
        if (!profiles[key]) profiles[key] = { ship: s, count: 0 };
        profiles[key].count++;
      });
      Object.values(profiles).forEach(({ ship: s, count }) => {
        const dbShip = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
        const name = dbShip ? dbShip.name : s.shipKey;
        const prefix = count > 1 ? `${count}× ` : '';
        let loadoutInfo = '';
        if (dbShip && dbShip.loadoutOptions) {
          const parts = [];
          dbShip.loadoutOptions.forEach((lo, loIdx) => {
            if (lo.options.length > 1) {
              const selIdx = (s.loadouts && s.loadouts[loIdx] !== undefined) ? s.loadouts[loIdx] : 0;
              const selOpt = lo.options[selIdx];
              if (selOpt) parts.push(selOpt.name);
            }
          });
          if (parts.length > 0) loadoutInfo = ` [${parts.join(', ')}]`;
        }
        text += `  • ${prefix}${name}${loadoutInfo} — ${s.points * count} pts\n`;
      });
    });

    text += '\n' + '═'.repeat(40);
    text += `\nTotal: ${pts}/${sizeInfo.max !== 99999 ? sizeInfo.max : '∞'} pts`;
    return text;
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
          <textarea class="form-textarea" id="settings-fleet-desc" placeholder="Describe your fleet's purpose or lore..." style="min-height:60px;font-size:var(--text-sm)">${esc(descValue)}</textarea>
          <button class="btn btn-outline btn-sm" style="align-self:flex-start" onclick="App.updateFleetDescription()">Save Description</button>
        </div>
      </div>` : '';

    body.innerHTML = `
      ${fleetSection}
      <div class="settings-group">
        <div class="settings-group-title">Ship Selection</div>
        <label class="settings-toggle">
          <span class="settings-toggle-label">
            <span class="settings-toggle-name">Show Auxiliary Ships</span>
            <span class="settings-toggle-desc">Display mercenary and auxiliary ships (transports, barges, etc.) in the ship selection grid</span>
          </span>
          <input type="checkbox" ${settings.showAuxiliaries ? 'checked' : ''} onchange="App.toggleSetting('showAuxiliaries', this.checked)">
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
        <div class="settings-group-title">Data</div>
        <div class="flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="App.exportAllFleets()"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2 13h12"/></svg> Export All Fleets</button>
        </div>
        <p class="text-caption" style="margin-top:var(--sp-sm)">Download all your fleet data as a JSON backup file.</p>
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

  function toggleSetting(key, value) {
    settings[key] = value;
    try { localStorage.setItem('dfc_settings', JSON.stringify(settings)); } catch(e) {}
    showToast(value ? 'Setting enabled' : 'Setting disabled');
    // Re-render if display-affecting settings changed
    if (key === 'compactView' || key === 'autoExpandLore') renderBuilder();
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem('dfc_settings');
      if (saved) Object.assign(settings, JSON.parse(saved));
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
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (id === 'modal-ship-select') pendingGroupCreation = false;
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

  // ── Toast ──
  function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(100px)'; }, 2500);
    });
  }

  // ── Launch Asset Reference ──
  // Collects all unique launch asset profiles needed by ships in a group.
  // Splits compound load names like "Fighters & Bombers" into individual
  // asset lookups against the faction's launch asset table.
  function collectGroupLaunchAssets(group, factionKey) {
    const factionInfo = shipDB[factionKey];
    if (!factionInfo || !factionInfo.launchAssets || factionInfo.launchAssets.length === 0) return [];

    const assetsByName = {};
    factionInfo.launchAssets.forEach(a => { assetsByName[a.name.toLowerCase()] = a; });

    const needed = new Set();
    const result = [];

    group.ships.forEach(ship => {
      const dbShip = findShipInDB(factionKey, ship.groupCategory, ship.shipKey);
      if (!dbShip) return;

      // Gather loads from base ship
      const allLoads = [...(dbShip.loads || [])];

      // Gather loads from selected loadout options
      const loadoutOpts = dbShip.loadoutOptions || [];
      loadoutOpts.forEach((lo, loIdx) => {
        const selIdx = (ship.loadouts && ship.loadouts[loIdx] !== undefined) ? ship.loadouts[loIdx] : 0;
        const selOpt = lo.options[selIdx];
        if (selOpt && selOpt.loads) {
          allLoads.push(...selOpt.loads);
        }
      });

      allLoads.forEach(load => {
        if (!load.name) return;
        // Split compound names: "Fighters & Bombers" → ["Fighters", "Bombers"]
        const parts = load.name.split(/\s*&\s*/);
        parts.forEach(part => {
          const key = part.trim().toLowerCase();
          if (!needed.has(key) && assetsByName[key]) {
            needed.add(key);
            result.push(assetsByName[key]);
          }
        });
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
          <span class="launch-ref-col launch-ref-col-special">Kinetic Save Reroll</span>
        </div>`;
      defensive.forEach(a => {
        html += `<div class="launch-ref-row">
          <span class="launch-ref-col launch-ref-col-name">${esc(a.name)}</span>
          <span class="launch-ref-col launch-ref-col-thrust">${esc(a.thrust)}</span>
          <span class="launch-ref-col launch-ref-col-special">Reroll ${a.ksReroll} KS die per Fighter token</span>
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
  function openShipDetail(faction, category, shipKey) {
    const dbShip = findShipInDB(faction, category, shipKey);
    if (!dbShip) return;

    document.getElementById('detail-ship-name').textContent = dbShip.name;
    const body = document.getElementById('detail-ship-body');

    const img = dbShip.image;
    const tonnage = dbShip.tonnage || CATEGORY_LABELS[category] || category;
    const badges = [];
    if (dbShip.isUnique) badges.push('<span class="ship-badge ship-badge-unique">Unique</span>');
    else if (dbShip.isRare) badges.push('<span class="ship-badge ship-badge-rare">Rare</span>');
    if (dbShip.groupMax > 1) badges.push(`<span class="ship-badge ship-badge-group">${dbShip.groupMin || 1}–${dbShip.groupMax}</span>`);

    const statsHtml = renderStatGrid(dbShip);

    // Weapons
    const wpns = dbShip.weapons || [];
    let weaponsHtml = '';
    if (wpns.length > 0) {
      weaponsHtml = '<div class="detail-section-label">Weapons</div><div class="weapon-list">' + renderWeaponHeader() + wpns.map(renderWeaponRow).join('') + '</div>';
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
          return `<div class="detail-loadout-option">
            <div class="detail-loadout-name">${esc(opt.name)}${costLabel}</div>
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
      loadsHtml = '<div class="detail-section-label">Launch Assets</div>' +
        loads.map(l =>
          `<div class="load-row"><span class="load-row-name">${esc(l.name)}</span>
          <div class="weapon-row-stats"><span class="weapon-stat-chip">Launch ${l.launch}</span>
          ${l.special && l.special !== '-' ? `<span class="weapon-stat-chip">${esc(l.special)}</span>` : ''}
          </div></div>`
        ).join('');
    }

    // Special rules with full descriptions
    const ruleDetails = dbShip.specialRuleDetails || [];
    let rulesHtml = '';
    if (ruleDetails.length > 0) {
      rulesHtml = '<div class="detail-section-label">Special Rules</div><div class="detail-rules-list">' +
        ruleDetails.map(r => {
          const page = r.page ? ` <span class="detail-rule-page">p.${esc(r.page)}</span>` : '';
          return `<div class="detail-rule-entry">
            <span class="detail-rule-name">${esc(r.name)}${page}</span>
            ${r.description ? `<span class="detail-rule-desc">${esc(r.description)}</span>` : ''}
          </div>`;
        }).join('') + '</div>';
    }

    // Lore
    let loreHtml = '';
    if (dbShip.lore) {
      loreHtml = `<div class="detail-lore">
        <div class="detail-section-label">Lore</div>
        <p class="text-rules">${esc(dbShip.lore)}</p>
      </div>`;
    }

    body.innerHTML = `
      <div class="detail-hero">
        ${img ? `<div class="detail-hero-image"><img src="${esc(img)}" alt="${esc(dbShip.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
        <div class="detail-hero-info">
          <div class="detail-hero-tonnage ship-tonnage-label ship-tonnage-${category}">${esc(tonnage)}</div>
          <div class="detail-hero-cost">${dbShip.points} pts</div>
          ${badges.length > 0 ? `<div class="flex gap-xs" style="margin-top:var(--sp-sm)">${badges.join('')}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      ${weaponsHtml}
      ${loadoutsHtml}
      ${loadsHtml}
      ${rulesHtml}
      ${loreHtml}
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
    tooltip.innerHTML = `<div class="rule-tooltip-title">${el.textContent}${pageHtml}</div><div class="rule-tooltip-body">${esc(desc).replace(/\n/g, '<br>')}</div>`;
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
        if (currentFleet.battleGroups.length >= sizeInfo.groups) {
          showToast('Maximum groups reached');
          return;
        }
        const num = currentFleet.battleGroups.length + 1;
        const newGroup = { id: uuid(), name: dbShip.name, ships: [] };
        currentFleet.battleGroups.push(newGroup);
        activeGroupId = newGroup.id;
        addShipToGroupInner(newGroup, shipKey, category, dbShip);
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
    renderGroupsNav();
    renderActiveGroup();
    showToast(`Added ${dbShip.name} to ${group.name}`);

    // Visual flash on the clicked card
    const cardEl = document.querySelector(`.ship-card[onclick*="'${shipKey}'"]`);
    if (cardEl) {
      cardEl.classList.add('ship-card-added');
      setTimeout(() => cardEl.classList.remove('ship-card-added'), 600);
    }
  }

  function addShipToGroupInner(group, shipKey, category, dbShip) {
    const loadouts = {};
    let loadoutCost = 0;
    if (dbShip.loadoutOptions && dbShip.loadoutOptions.length > 0) {
      dbShip.loadoutOptions.forEach((lo, loIdx) => {
        loadouts[loIdx] = 0;
        loadoutCost += lo.options[0]?.cost || 0;
      });
    }

    const entry = {
      id: uuid(),
      shipKey,
      groupCategory: category,
      points: (dbShip.points || 0) + loadoutCost,
      loadouts
    };

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
    loadDemoFleets, selectFaction, selectGameSize, addGroup, selectGroup, removeGroup, renameGroup, moveGroup,
    openShipSelectModal, filterCategory, toggleShipFilter, searchShips, clearShipSearch, addShipToGroup, addSameShip, removeLastShip, removeShip, sortShips, changeLoadout,
    openAdmiralModal, addGenericAdmiral, addFamousAdmiral, removeAdmiral,
    openStationModal, selectStation, removeStation,
    toggleSidebar, printFleet,
    shareFleet, copyShareURL, copyShareText, copyShareJSON, importSharedFleet, importFleetFromClipboard,
    openSettings, toggleSetting, updateFleetDescription, exportAllFleets, openModal, closeModal, showRuleTooltip, openGameSizeChanger, applyGameSize, openShipDetail, saveFleetDesc
  };
})();
