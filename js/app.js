/* ═══════════════════════════════════════════════════════════════
   DROPFLEET COMMANDER — FLEET BUILDER
   Application Logic
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  // ── State ──
  let shipDB = {};
  let factionData = {};
  let fleets = [];
  let currentFleet = null;
  let activeGroupId = null;
  let shipSortMode = 'name';
  let activeCategory = 'all';
  let activeFilters = new Set();  // 'launch', 'loadout', 'rare', 'unique'
  let pendingGroupCreation = false;  // true when "Add Group" opened the ship modal

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
    } catch (e) {
      console.error('Failed to load fleet data:', e);
    }

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
    'caracas','carthage','delhi','detroit','edmonton','geneva','glasgow',
    'halsey','hanoi','havana','havelock','istanbul','jakarta','johannesburg',
    'kyiv','lima','london','lysander','madrid','milwaukee','osaka','oslo',
    'perth','reykjavik','rio','rome','rotterdam','santiago','seattle',
    'sheffield','siam','taipei','tayne','thebes','tokyo','toulon',
    'ulaanbaatar','vancouver','venice','vienna','vilnius','warsaw',
    'washington','weaver','yokohama',
    // Scourge
    'akuma','apsasu','bael','banshee','beelzebub','charybdis','chimera',
    'cthulhu','daemon','devil','djinn','dragon','ebisu','faust','gargoyle',
    'harpy','hiruko','hydra','ifrit','incubus','lucifer','nephilim',
    'nosferatu','parasite','raiju','raum','revenant','samael','scylla',
    'shadow','sphinx','strix','succubus','wraith','wyvern','yokai',
    // Shaltari
    'actinium','amber','amethyst','aquamarine','azurite','basalt','bronze',
    'cerium','chromium','cobalt','copper','diamond','emerald','gallium',
    'gold','granite','hematite','iron','jade','jet','lanthanum','mercury',
    'obsidian','onyx','opal','platinum','ruby','sapphire','silver','topaz',
    'turquoise',
    // Resistance
    'aldrin','armstrong','barbarossa','collins','coloniser','drake','explorer',
    'farragut','iowa','lexington','musashi','nelson','nimitz','pathfinder',
    'phalanx','senator','seneca','vanguard','yamamoto',
    // Bioficer
    'binder','blackbird','brutal','cache','cacophony','carronade','cataphract',
    'cavern','charger','choral','cipher','combine','comet','conqueror',
    'construct','cosmic','diode','domain','foray','forestall','fresco',
    'fugue','fulcrum','logic','mantle','matrix','monarch','sanctum','scion',
    'stature','supercell','tally','tine','torrent','vertex','zenith','zodiac'
  ]);
  const SHIP_ART_SPECIAL = {
    'New York':'new_york','New Cairo':'new_cairo','New Mombasa':'new_mombasa',
    'New Orleans':'new_orleans','Las Vegas':'las_vegas',
    'San Francisco':'san_francisco','St Petersburg':'st_petersburg',
    'Nuuk':'nuuk_em_harraser',
    'Summoner Cell':'summoner_cell','Prism Cell':'prism_cell',
    'Torpedo Cell':'torpedo_cell','Lander Cell':'lander_cell',
    'Invasion Cell':'invasion_cell',
    'Yi Sun-sin':'yi-sun-sin','Voidgate':'voidgates',
    'Bastion':'bioficer_battleship_bastion',
    'Binary':'bioficer_battleship_binary',
    'Bishop':'bioficer_battleship_bishop',
    'Callous':'callouis','Catastrophe':'catastrope',
    'Triumvir':'trumvir','Tribune':'tribute','Disciple':'discipline'
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

      shipDB[factionKey] = { groups, admirals: faction.admirals || [], launchAssets };
    });
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
            topContext.textContent = currentFleet.name;
            renderBuilder();
            return;
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
  }

  function saveFleets() {
    localStorage.setItem('dfc_fleets', JSON.stringify(fleets));
  }

  function uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }

  // ── Fleet CRUD ──
  function openNewFleetModal() {
    document.getElementById('new-fleet-name').value = '';
    document.getElementById('new-fleet-desc').value = '';
    renderFactionPicker();
    renderSizePicker();
    openModal('modal-new-fleet');
    setTimeout(() => document.getElementById('new-fleet-name').focus(), 200);
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
    });
    const btn = document.querySelector(`.faction-pick-btn[data-faction="${key}"]`);
    if (btn) {
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      btn.style.background = FACTION_COLORS[key];
      btn.style.color = '#fff';
    }
    btn.dataset.selected = 'true';
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
    popover.innerHTML = Object.entries(GAME_SIZES).map(([key, size]) => {
      const active = key === currentFleet.gameSize ? ' active' : '';
      const colText = size.colossalMax > 0 ? `, ${size.colossalMax} Colossal` : '';
      return `<button class="game-size-popover-item${active}" onclick="App.applyGameSize('${key}')">
        <span class="game-size-popover-name">${size.label}</span>
        <span class="game-size-popover-desc">${size.desc} · ${size.groups} groups${colText}</span>
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
      admiral: null,
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
    fleets.push(copy);
    saveFleets();
    renderFleetList();
  }

  // ── Fleet List View ──
  function renderFleetList() {
    const grid = document.getElementById('fleet-grid');
    const cards = fleets.map(f => {
      const pts = calcFleetPoints(f);
      const sizeInfo = GAME_SIZES[f.gameSize] || GAME_SIZES.clash;
      const fName = (factionData[f.faction] || {}).name || f.faction.toUpperCase();
      return `
      <div class="fleet-card card-deco" onclick="App.navigate('builder','${f.id}')">
        <div class="flex items-center justify-between">
          <span class="badge badge-${f.faction}">${fName}</span>
          <span class="badge badge-neutral">${sizeInfo.label}</span>
        </div>
        <div class="fleet-card-name">${esc(f.name)}</div>
        ${f.description ? `<div class="text-caption" style="line-height:1.4">${esc(f.description)}</div>` : ''}
        <div class="flex items-center justify-between" style="margin-top:var(--sp-sm)">
          <span class="fleet-card-points">${pts} pts</span>
          <span class="text-caption">${f.battleGroups.length} groups</span>
        </div>
        <div class="fleet-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="App.duplicateFleet('${f.id}')">Duplicate</button>
          <button class="btn btn-danger btn-sm" onclick="App.deleteFleet('${f.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');

    grid.innerHTML = cards + `
      <div class="fleet-card fleet-card-new" onclick="App.openNewFleetModal()">
        <div class="fleet-card-new-icon">+</div>
        <div style="font-family:var(--font-display);font-weight:var(--weight-semibold);font-size:var(--text-md)">Create New Fleet</div>
        <div class="text-caption">Start building a new fleet roster</div>
      </div>`;
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
        admiral: null, battleGroups, createdAt: Date.now(), updatedAt: Date.now()
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

    document.getElementById('builder-fleet-name').textContent = f.name;
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

    if (f.battleGroups.length > 0 && !activeGroupId) {
      activeGroupId = f.battleGroups[0].id;
    }

    updatePoints();
    renderAdmiralSlot();
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

    f.updatedAt = Date.now();
    saveFleets();

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

    // 6. Admiral level check
    if (fleet.admiral) {
      const admLvl = fleet.admiral.level || 0;
      // Level 5 Famous Admirals count as Level 4 for game-size restrictions
      const effectiveLvl = admLvl >= 5 ? 4 : admLvl;
      if (effectiveLvl > sizeInfo.maxAdmiralLevel) {
        warnings.push({ type: 'error', msg: `Admiral Lv${admLvl} exceeds max Lv${sizeInfo.maxAdmiralLevel} for ${sizeInfo.label}` });
      }
    }

    return warnings;
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
      const icon = w.type === 'error' ? '⚠' : 'ℹ';
      return `<div class="fleet-warning fleet-warning-${w.type}">${icon} ${esc(w.msg)}</div>`;
    }).join('');
  }

  function calcFleetPoints(fleet) {
    let total = 0;
    if (fleet.admiral) total += fleet.admiral.points || 0;
    fleet.battleGroups.forEach(g => {
      g.ships.forEach(s => { total += s.points || 0; });
    });
    return total;
  }

  // ── Groups ──
  function renderGroupsNav() {
    const nav = document.getElementById('groups-nav');
    if (!currentFleet) return;

    if (currentFleet.battleGroups.length === 0) {
      nav.innerHTML = '<div class="text-caption text-center" style="padding:var(--sp-md)">No groups yet</div>';
      return;
    }

    nav.innerHTML = currentFleet.battleGroups.map((g, i) => {
      const shipCount = g.ships.length;
      const groupPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      return `
      <div class="group-nav-item ${g.id === activeGroupId ? 'active' : ''}" onclick="App.selectGroup('${g.id}')">
        <div class="group-nav-name">${esc(g.name)}</div>
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
    activeGroupId = gid;
    renderGroupsNav();
    renderActiveGroup();

    // On mobile, collapse sidebar
    const sidebar = document.getElementById('builder-sidebar');
    if (sidebar.classList.contains('expanded')) sidebar.classList.remove('expanded');
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

  function renameGroup(gid) {
    const g = currentFleet.battleGroups.find(g => g.id === gid);
    if (!g) return;
    const name = prompt('Group name:', g.name);
    if (name && name.trim()) {
      g.name = name.trim();
      saveFleets();
      renderGroupsNav();
      renderActiveGroup();
    }
  }

  // ── Active Group View ──
  function renderActiveGroup() {
    const emptyEl = document.getElementById('builder-empty');
    const contentEl = document.getElementById('builder-content');

    if (!currentFleet || currentFleet.battleGroups.length === 0 || !activeGroupId) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    const group = currentFleet.battleGroups.find(g => g.id === activeGroupId);
    if (!group) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const groupPts = group.ships.reduce((t, s) => t + (s.points || 0), 0);

    let html = `
    <div class="group-header-bar">
      <div class="flex items-center gap-md">
        <h2 class="group-title">${esc(group.name)}</h2>
        <span class="badge badge-navy">${groupPts} pts</span>
        <span class="badge badge-neutral">${group.ships.length} ships</span>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-ghost btn-sm" onclick="App.renameGroup('${group.id}')">Rename</button>
        <button class="btn btn-danger btn-sm" onclick="App.removeGroup('${group.id}')">Remove</button>
      </div>
    </div>`;

    if (group.ships.length > 0) {
      html += '<div class="group-ships-list">';
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

  function renderWeaponSpecialChips(specialStr) {
    if (!specialStr || specialStr === '-') return '';
    return specialStr.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      // Find matching rule — try exact match first, then base keyword (strip numbers)
      const baseKey = trimmed.replace(/-?\d+$/, '');
      const desc = WEAPON_SPECIAL_RULES[trimmed] || WEAPON_SPECIAL_RULES[baseKey] || '';
      if (desc) {
        return `<span class="weapon-special-chip has-tooltip" data-rule-desc="${esc(desc)}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(trimmed)}</span>`;
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
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(desc)}" onclick="App.showRuleTooltip(event, this)">${esc(r.name)}</span>`;
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
      loreHtml = `<details class="ship-lore no-print" id="${loreId}">
        <summary class="ship-lore-toggle">Lore</summary>
        <div class="ship-lore-text">${esc(loreText)}</div>
      </details>`;
    }

    return `
    <div class="group-ship-entry animate-in">
      ${img ? `<div class="ship-card-image"><img src="${esc(img)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-sm)">
        <div class="flex items-center justify-between">
          <div>
            <div class="ship-card-name">${esc(name)}</div>
            <div class="text-caption">${esc(tonnage)}</div>
          </div>
          <div class="ship-card-cost">${ship.points} pts</div>
        </div>
        ${statsHtml}
        ${weaponsHtml}
        ${loadoutsHtml}
        ${loadsHtml}
        ${rulesHtml}
        ${loreHtml}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm group-ship-remove" onclick="App.removeShip('${groupId}','${ship.id}')" data-tooltip="Remove ship">✕</button>
    </div>`;
  }

  // ── Ship Selection Modal ──
  function openShipSelectModal(groupId) {
    if (groupId) activeGroupId = groupId;
    activeCategory = 'all';
    activeFilters = new Set();

    const factionKey = currentFleet.faction;
    const factionShips = shipDB[factionKey];
    if (!factionShips || !factionShips.groups) return;

    renderCategoryTabs(factionShips.groups);
    renderShipFilters();
    renderShipSelectGrid(factionShips.groups, 'all');
    openModal('modal-ship-select');

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

    if (ships.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p class="text-caption">No ships match these filters</p></div>';
      return;
    }

    grid.innerHTML = ships.map(s => renderShipSelectCard(s)).join('');
  }

  function renderShipSelectCard({ key, data, category }) {
    const catLabel = CATEGORY_LABELS[category] || category;
    const specialRules = data.special_rules || [];

    return `
    <div class="ship-card" onclick="App.addShipToGroup('${key}','${category}')">
      <div class="ship-card-top">
        ${data.image ? `<div class="ship-card-image"><img src="${esc(data.image)}" alt="${esc(data.name)}" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
        <div class="ship-card-info">
          <div class="ship-card-name">${esc(data.name)}</div>
          <div class="ship-card-type">${esc(data.tonnage || '')} · ${catLabel}</div>
        </div>
        <div class="ship-card-cost">${data.points || 0}<span style="font-size:var(--text-sm);font-weight:var(--weight-regular)"> pts</span></div>
      </div>
      ${renderStatGrid(data)}
      ${specialRules.length > 0 ? `<div class="special-rules">${specialRules.slice(0, 4).map(r => {
        const detail = (data.specialRuleDetails || []).find(d => d.name === r);
        if (detail && detail.description) {
          return `<span class="rule-chip has-tooltip" data-rule-desc="${esc(detail.description)}" onclick="event.stopPropagation(); App.showRuleTooltip(event, this)">${esc(r)}</span>`;
        }
        return `<span class="rule-chip">${esc(r)}</span>`;
      }).join('')}${specialRules.length > 4 ? `<span class="rule-chip" style="background:rgba(255,255,255,0.06);color:var(--ink-faint)">+${specialRules.length - 4}</span>` : ''}</div>` : ''}
      <div class="flex items-center justify-between" style="margin-top:auto">
        <span class="text-caption">${data.g ? `Group size: ${data.g}` : ''}</span>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.addShipToGroup('${key}','${category}')">+ Add</button>
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

  // ── Admiral ──
  // TODO: The current implementation stores a single `admiral` object on each
  // fleet. Per rulebook Section 4.2.1, you may take ANY NUMBER of admirals —
  // each assigned to a Capital Ship (Medium/Heavy/Colossal). The only
  // restriction is that you may only include ONE Famous or Faction Admiral per
  // fleet. To support this properly, `fleet.admiral` should become an
  // `fleet.admirals` array, the admiral slot UI should allow adding/removing
  // multiple admirals, and calcFleetPoints should sum all admiral costs.
  function getAdmiralLevelCost(level) {
    if (!rawFleetData || !rawFleetData.gameSystem || !rawFleetData.gameSystem.admiralLevels) return 0;
    const entry = rawFleetData.gameSystem.admiralLevels.find(a => a.level === level);
    return entry ? entry.cost : 0;
  }

  function openAdmiralModal() {
    if (!currentFleet) return;
    const factionShips = shipDB[currentFleet.faction];
    if (!factionShips) return;

    const sizeInfo = GAME_SIZES[currentFleet.gameSize] || GAME_SIZES.clash;
    const maxLevel = sizeInfo.maxAdmiralLevel || 4;
    const genericAdmirals = (factionShips.admirals || []).filter(a => !a.isFamous);
    const admiralGroup = factionShips.groups?.famous_admirals;

    const container = document.getElementById('admiral-options');

    let html = `
    <div style="margin-bottom:var(--sp-md);padding:var(--sp-md);background:var(--surface);border:1px solid var(--stroke);border-radius:var(--radius-md);font-size:var(--text-sm);line-height:1.6;color:var(--ink-muted)">
      <strong style="color:var(--ink)">Admiral Rules (Section 4.2.1)</strong><br>
      You may take any number of Admirals. Each must be assigned to a Capital Ship
      (Medium, Heavy, or Colossal tonnage). Only one Famous or Faction Admiral is
      allowed per fleet. Admiral level is capped at Lv${maxLevel} for ${sizeInfo.label} games.
    </div>
    <div class="card card-interactive" onclick="App.selectAdmiral(null)" style="padding:var(--sp-lg)">
      <div class="flex items-center gap-md">
        <span style="font-size:var(--text-md);opacity:0.5;font-weight:600">&mdash;</span>
        <div>
          <div style="font-weight:var(--weight-semibold)">No Admiral</div>
          <div class="text-caption">Run your fleet without an admiral</div>
        </div>
      </div>
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
            <button class="btn btn-primary btn-sm" onclick="App.selectGenericAdmiral('${adm.id}', this)">Select</button>
          </div>
          ${abilities.length > 0 ? `<div style="margin-top:var(--sp-sm);font-size:var(--text-sm);color:var(--ink-muted);line-height:1.5">${abilities.map(a => `<div style="margin-bottom:var(--sp-xs)"><strong>${esc(a.name || '')}</strong>${a.description ? ': ' + esc(a.description) : ''}</div>`).join('')}</div>` : ''}
        </div>`;
      });
    }

    if (admiralGroup && admiralGroup.ships && Object.keys(admiralGroup.ships).length > 0) {
      html += `<div style="margin-top:var(--sp-lg);margin-bottom:var(--sp-sm);font-weight:var(--weight-semibold);font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted)">Famous Admirals</div>`;
      Object.entries(admiralGroup.ships).forEach(([key, admiral]) => {
        const abilities = admiral.special_abilities || [];
        html += `
        <div class="admiral-card card-interactive" onclick="App.selectFamousAdmiral('${key}')" style="cursor:pointer">
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

  function selectGenericAdmiral(admiralId, btn) {
    if (!currentFleet) return;
    const factionShips = shipDB[currentFleet.faction];
    const adm = (factionShips.admirals || []).find(a => a.id === admiralId);
    if (!adm) return;

    const card = btn.closest('.admiral-card');
    const checked = card.querySelector(`input[name="generic-level-${admiralId}"]:checked`);
    const level = checked ? parseInt(checked.value) : adm.level;
    const cost = checked ? parseInt(checked.dataset.cost) : adm.cost;

    currentFleet.admiral = {
      admiralId,
      name: adm.name,
      points: cost,
      level,
      type: 'Generic'
    };

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
  }

  function selectFamousAdmiral(shipKey) {
    if (!currentFleet) return;
    const factionShips = shipDB[currentFleet.faction];
    const admiralGroup = factionShips.groups?.famous_admirals;
    const admiral = admiralGroup?.ships?.[shipKey];
    if (!admiral) return;

    currentFleet.admiral = {
      shipKey,
      name: admiral.name,
      points: admiral.points || 0,
      level: admiral.level,
      type: 'Famous'
    };

    saveFleets();
    closeModal('modal-admiral');
    renderAdmiralSlot();
    updatePoints();
  }

  function selectAdmiral(shipKey) {
    if (!currentFleet) return;
    if (!shipKey) {
      currentFleet.admiral = null;
      saveFleets();
      closeModal('modal-admiral');
      renderAdmiralSlot();
      updatePoints();
    }
  }

  function renderAdmiralSlot() {
    const slot = document.getElementById('admiral-slot');
    if (!currentFleet || !currentFleet.admiral) {
      slot.innerHTML = `
      <div class="add-ship-area" onclick="App.openAdmiralModal()" style="padding:var(--sp-lg);min-height:60px">
        <span style="font-size:var(--text-sm)">+ Add Admiral</span>
      </div>`;
      return;
    }

    const a = currentFleet.admiral;
    slot.innerHTML = `
    <div class="admiral-card">
      <div class="flex items-center justify-between">
        <div>
          <div class="admiral-name">${esc(a.name)}</div>
          <div class="admiral-level">Level ${a.level || '?'}</div>
        </div>
        <span class="badge badge-gold">${a.points} pts</span>
      </div>
      <div class="flex gap-xs" style="margin-top:var(--sp-sm)">
        <button class="btn btn-ghost btn-sm" onclick="App.openAdmiralModal()">Change</button>
        <button class="btn btn-danger btn-sm" onclick="App.selectAdmiral(null)">Remove</button>
      </div>
    </div>`;
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

    let html = `<div class="print-fleet">
      <div class="print-header">
        <div class="print-fleet-name">${esc(f.name)}</div>
        <div class="print-fleet-meta">${esc(fName)} — ${sizeInfo.label} — ${pts} pts</div>
      </div>`;

    // Admiral
    if (f.admiral) {
      html += `<div class="print-section">
        <div class="print-section-title">Admiral</div>
        <div class="print-admiral">${esc(f.admiral.name)} — ${f.admiral.points} pts</div>
      </div>`;
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

        // Loads
        const loads = db.loads || [];
        let loadsHtml = '';
        if (loads.length > 0) {
          loadsHtml = loads.map(l => {
            allLaunchAssetNames.add(l.name);
            return `<span class="print-load">${esc(l.name)} (Launch ${l.launch}${l.special && l.special !== '-' ? ', ' + l.special : ''})</span>`;
          }).join(' ');
          loadsHtml = `<div class="print-loads">Launch: ${loadsHtml}</div>`;
        }

        // Collect special rules for glossary
        (db.specialRuleDetails || []).forEach(r => {
          if (r.description) rulesGlossary[r.name] = r.description;
        });

        // Rules chips
        const ruleNames = (db.specialRuleDetails || []).map(r => esc(r.name)).join(', ') ||
                          (db.special_rules || []).map(r => esc(r)).join(', ');

        html += `<div class="print-ship">
          <div class="print-ship-header">
            <span class="print-ship-name">${esc(name)}</span>
            <span class="print-ship-pts">${ship.points} pts</span>
          </div>
          ${statsHtml}
          ${wpnsHtml}
          ${loadoutWpnsHtml}
          ${loadsHtml}
          ${ruleNames ? `<div class="print-rules">Rules: ${ruleNames}</div>` : ''}
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

    // Rules glossary — full text for every rule used
    const glossaryEntries = Object.entries(rulesGlossary).sort((a, b) => a[0].localeCompare(b[0]));
    if (glossaryEntries.length > 0) {
      html += `<div class="print-section print-glossary">
        <div class="print-section-title">Rules Reference</div>
        ${glossaryEntries.map(([name, desc]) =>
          `<div class="print-glossary-entry">
            <span class="print-glossary-name">${esc(name)}</span>
            <span class="print-glossary-desc">${esc(desc).replace(/\n/g, '<br>')}</span>
          </div>`
        ).join('')}
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

  function shareFleet() {
    if (!currentFleet) return;
    const text = generateFleetText(currentFleet);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Fleet list copied to clipboard!');
      });
    } else {
      prompt('Copy your fleet list:', text);
    }
  }

  function generateFleetText(fleet) {
    const fName = (factionData[fleet.faction] || {}).name || fleet.faction.toUpperCase();
    const pts = calcFleetPoints(fleet);
    const sizeInfo = GAME_SIZES[fleet.gameSize] || GAME_SIZES.clash;
    let text = `${fleet.name}\n${fName} - ${sizeInfo.label} (${pts} pts)\n`;
    text += '═'.repeat(40) + '\n';

    if (fleet.admiral) {
      text += `\nADMIRAL: ${fleet.admiral.name} (${fleet.admiral.points} pts)\n`;
    }

    fleet.battleGroups.forEach(g => {
      const gPts = g.ships.reduce((t, s) => t + (s.points || 0), 0);
      text += `\n── ${g.name} (${gPts} pts) ──\n`;
      g.ships.forEach(s => {
        const dbShip = findShipInDB(fleet.faction, s.groupCategory, s.shipKey);
        text += `  • ${dbShip ? dbShip.name : s.shipKey} - ${s.points} pts\n`;
      });
    });

    text += '\n' + '═'.repeat(40);
    text += `\nTotal: ${pts} pts`;
    return text;
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
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:var(--paper);border:1px solid var(--stroke-strong);color:var(--ink);padding:12px 24px;border-radius:var(--radius-lg);font-size:var(--text-sm);z-index:2000;transition:transform 0.3s var(--ease-out);box-shadow:var(--shadow-lg);pointer-events:none';
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
    tooltip.innerHTML = `<div class="rule-tooltip-title">${el.textContent}</div><div class="rule-tooltip-body">${esc(desc).replace(/\n/g, '<br>')}</div>`;
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

    // Same ship or empty group — add directly
    addShipToGroupInner(group, shipKey, category, dbShip);
    saveFleets();
    updatePoints();
    renderGroupsNav();
    renderActiveGroup();
    showToast(`Added ${dbShip.name} to ${group.name}`);
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

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => {
        m.classList.remove('active');
      });
      document.body.style.overflow = '';
      pendingGroupCreation = false;
    }
  });

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ──
  return {
    navigate, openNewFleetModal, createFleet, deleteFleet, duplicateFleet,
    loadDemoFleets, selectFaction, selectGameSize, addGroup, selectGroup, removeGroup, renameGroup,
    openShipSelectModal, filterCategory, toggleShipFilter, addShipToGroup, addSameShip, removeLastShip, removeShip, sortShips, changeLoadout,
    openAdmiralModal, selectAdmiral, selectGenericAdmiral, selectFamousAdmiral, toggleSidebar, printFleet, shareFleet,
    openModal, closeModal, showRuleTooltip, openGameSizeChanger, applyGameSize
  };
})();
