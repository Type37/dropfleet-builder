/* ═══════════════════════════════════════════════════════════
   DFC Mobile — App Logic (UCM + Bioficers only)
   Hobgoblin-style linear stack navigation
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Data ──────────────────────────────────────────────── */
  const FACTIONS = {};         // keyed by faction id
  let FLEET_DATA = null;       // game system rules
  let SHIP_LORE = {};          // ship lore lookup
  let fleets = [];             // saved fleet roster array
  let activeFleet = null;      // currently open fleet object
  let activeGroupIdx = -1;     // index into activeFleet.groups

  const FACTION_FILES = {
    ucm: '../data/faction-ucm.json',
    bioficer: '../data/faction-bioficer.json'
  };

  /* ── Ship Art ──────────────────────────────────────────── */
  const SHIP_ART = new Set([
    // UCM
    'babylon','beijing','berlin','boston','bruges','bucharest','busan','byzantium',
    'caracas','carthage','centurion','delhi','detroit','edmonton','geneva',
    'gladiator','glasgow','halsey','hanoi','havana','havelock','istanbul',
    'jakarta','johannesburg','kyiv','lima','london','lysander','madrid',
    'milwaukee','newton','osaka','oslo','perth','reykjavik','rio','rome',
    'rotterdam','santiago','seattle','sheffield','siam','taipei','tayne',
    'thebes','tokyo','toulon','ulaanbaatar','vancouver','venice','vienna',
    'vilnius','warsaw','washington','weaver','yokohama',
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
    'Hong Kong':'hong_kong','M-Type':'m-type','El Paso':'el_paso'
  };

  const FACTION_ICONS = {
    ucm: '../assets/factions/ucm.webp',
    bioficer: '../assets/factions/bioficer.webp'
  };

  const STAT_ICONS = {
    scan:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3,12 A9,9 0 0,1 21,12"/><path d="M7,12 A5,5 0 0,1 17,12"/><circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none"/></svg>',
    sig:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>',
    thrust: '<svg viewBox="0 0 24 24"><polygon fill="currentColor" points="4,4 20,12 4,20 8,12"/></svg>',
    hull:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>',
    es:     '<svg viewBox="0 0 16 22"><path d="M8,0.5 C8,0.5 0.5,3.5 0.5,3.5L0.5,10.5 C0.5,16 8,21.5 8,21.5 C8,21.5 15.5,16 15.5,10.5L15.5,3.5Z" fill="#1C1A17"/><path d="M8.5,4.5 L5,11 L7.5,11 L6,18.5 L12,9.5 L9,9.5 L11,4.5Z" fill="#FAECC8"/></svg>',
    ks:     '<svg viewBox="0 0 16 22"><path d="M5.5,0 L10.5,0 L10.5,3 L5.5,3Z" fill="#1C1A17"/><path d="M3,3 C1,5 0,8 0,11L0,15 L3,15 L3,18 C3,20 5.5,21.5 8,21.5 C10.5,21.5 13,20 13,18L13,15 L16,15 L16,11 C16,8 15,5 13,3Z" fill="#1C1A17"/><rect fill="#D0E4FF" height="2" rx="0.5" width="7" x="4.5" y="10"/><rect fill="#D0E4FF" height="7" rx="0.5" width="2" x="7" y="10"/></svg>',
    bs:     '<svg viewBox="0 0 16 22"><path d="M8,1 C8,1 1,4 1,4L1,11 C1,16.5 8,21 8,21 C8,21 15,16.5 15,11L15,4Z" fill="none" stroke="#1C1A17" stroke-width="1.5"/><line stroke="#1C1A17" stroke-linecap="round" stroke-width="1.2" x1="4" x2="12" y1="11" y2="11"/></svg>',
    pd:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>'
  };

  function statIcon(key) {
    return STAT_ICONS[key] ? `<span class="stat-icon stat-icon-${key}">${STAT_ICONS[key]}</span>` : '';
  }

  function shipArtPath(name) {
    if (!name) return null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (name.startsWith(prefix)) return `../assets/art/${file}.webp`;
    }
    const first = name.split(/\s+/)[0].toLowerCase();
    return SHIP_ART.has(first) ? `../assets/art/${first}.webp` : null;
  }

  /* ── Launch asset & weapon special helpers ─────────────── */
  function getLaunchAssetMap(factionKey) {
    const faction = findFactionByKey(factionKey);
    if (!faction) return {};
    const map = {};
    (faction.launchAssets || []).forEach(group => {
      (group.assets || []).forEach(a => { map[a.name.toLowerCase()] = a; });
    });
    return map;
  }

  function renderLaunchTable(factionKey, ship) {
    const loads = ship.loads || [];
    if (!loads.length) return '';
    const assetMap = getLaunchAssetMap(factionKey);

    let rows = '';
    loads.forEach(load => {
      if (!load.name) return;
      const parts = load.name.split(/\s*&\s*/).map(p => p.trim()).filter(Boolean);
      const loadSpecial = (load.special && load.special !== '-') ? ` <span style="color:var(--fg3);font-size:var(--text-caption2)">${load.special}</span>` : '';

      parts.forEach((part, i) => {
        const a = assetMap[part.toLowerCase()] || { name: part };
        const hasStats = a.attack !== undefined && a.attack !== null;
        const typeClass = a.type ? `weapon-type-${a.type.toLowerCase()}` : '';
        const dmgCell = hasStats ? `${a.damage || '—'}${a.type ? `<span class="${typeClass}" style="margin-left:2px">${a.type}</span>` : ''}` : '—';
        const special = (a.special && a.special !== '-') ? renderSpecialChips(a.special) : (a.ksReroll != null ? `<span class="weapon-special-chip">Close Protection (re-roll ${a.ksReroll} KS)</span>` : '—');

        rows += `<div class="weapon-row ${typeClass}">
          ${i === 0 ? `<div class="weapon-val" style="font-weight:700;grid-row:span ${parts.length}">${load.launch || '—'}${loadSpecial}</div>` : ''}
          <div class="weapon-name">${part}</div>
          <div class="weapon-val">${a.thrust || '—'}</div>
          <div class="weapon-val">${hasStats ? a.attack : '—'}</div>
          <div class="weapon-val">${hasStats ? a.lock : '—'}</div>
          <div class="weapon-val">${dmgCell}</div>
        </div>
        ${special !== '—' ? `<div class="weapon-special">${special}</div>` : ''}`;
      });
    });

    return `
      <div class="weapon-table">
        <div class="section-header" style="padding:0 0 var(--sp-s)">Launch Assets</div>
        <div class="weapon-row weapon-row-header" style="grid-template-columns:36px 1fr 40px 32px 32px 40px">
          <div class="weapon-val">Lch</div>
          <div class="weapon-name" style="color:var(--fg3)">Load</div>
          <div class="weapon-val">Thr</div>
          <div class="weapon-val">At</div>
          <div class="weapon-val">Lk</div>
          <div class="weapon-val">Dm</div>
        </div>
        ${rows.replace(/class="weapon-row/g, 'class="weapon-row" style="grid-template-columns:36px 1fr 40px 32px 32px 40px')}
      </div>`;
  }

  function renderSpecialChips(specialStr) {
    if (!specialStr || specialStr === '-') return '';
    return specialStr.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      return `<span class="weapon-special-chip">${trimmed}</span>`;
    }).join(' ');
  }

  function artImg(name, cls) {
    const src = shipArtPath(name);
    if (!src) return '';
    return `<img src="${src}" alt="" class="${cls || ''}" onerror="this.parentElement.style.display='none'">`;
  }

  /* ── Helpers ───────────────────────────────────────────── */
  function uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  }

  function saveFleets() {
    try { localStorage.setItem('dfc_mobile_fleets', JSON.stringify(fleets)); } catch (e) { /* quota */ }
  }

  function loadFleets() {
    try {
      const raw = localStorage.getItem('dfc_mobile_fleets');
      if (raw) fleets = JSON.parse(raw);
    } catch (e) { fleets = []; }
  }

  function findFactionByKey(key) {
    return Object.values(FACTIONS).find(f =>
      f.shortName?.toLowerCase() === key.toLowerCase() ||
      f.name?.toLowerCase().includes(key.toLowerCase())
    );
  }

  function getGameSize(pts) {
    if (!FLEET_DATA) return { label: '—' };
    const sizes = FLEET_DATA.gameSystem.gameSizes;
    for (const [k, s] of Object.entries(sizes)) {
      if (pts >= s.min && (s.max === -1 || pts <= s.max)) return s;
    }
    return Object.values(sizes)[0];
  }

  function fleetPoints(fleet) {
    return (fleet.groups || []).reduce((sum, g) => {
      const shipCost = g.ship?.cost || 0;
      const qty = g.qty || 1;
      const loadoutExtra = (g.loadouts || []).reduce((s, l) => s + (l.cost || 0), 0);
      return sum + (shipCost + loadoutExtra) * qty;
    }, 0);
  }

  const CATEGORY_ORDER = ['light', 'medium', 'heavy', 'colossal'];
  const CATEGORY_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy', colossal: 'Colossal' };


  /* ── Navigation ────────────────────────────────────────── */
  const history = [];  // stack of {screen, data}

  function navigate(screenId, data, opts) {
    const current = document.querySelector('.screen.active');
    if (current && !opts?.replace) {
      history.push({ id: current.id, scroll: window.scrollY });
    }

    // Render FIRST (before animation) so content is ready
    if (typeof data?.render === 'function') data.render();

    // Then animate
    if (current && !opts?.replace) {
      current.classList.remove('active');
      current.classList.add('slide-out-left');
      setTimeout(() => {
        current.classList.remove('slide-out-left');
      }, 300);
    } else if (current) {
      current.classList.remove('active');
    }

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active', 'slide-in-right');
      setTimeout(() => {
        target.classList.remove('slide-in-right');
      }, 300);
      window.scrollTo(0, 0);
    }
    updateAppBar(screenId, data);
    // Show FAB only on fleet detail
    const fab = document.getElementById('fab-add-group');
    if (fab) fab.style.display = screenId === 'screen-fleet-detail' ? '' : 'none';
  }

  function goBack() {
    if (!history.length) return;
    const prev = history.pop();
    const current = document.querySelector('.screen.active');

    // Re-render destination FIRST
    if (prev.id === 'screen-fleet-list') renderFleetList();
    if (prev.id === 'screen-fleet-detail') renderFleetDetail();
    if (prev.id === 'screen-group-detail') renderGroupDetail();

    if (current) {
      current.classList.remove('active');
      current.classList.add('slide-out-right');
      setTimeout(() => {
        current.classList.remove('slide-out-right');
      }, 300);
    }

    const target = document.getElementById(prev.id);
    if (target) {
      target.classList.add('active', 'slide-in-left');
      setTimeout(() => {
        target.classList.remove('slide-in-left');
      }, 300);
    }
    window.scrollTo(0, prev.scroll || 0);
    updateAppBar(prev.id);
    const fab = document.getElementById('fab-add-group');
    if (fab) fab.style.display = prev.id === 'screen-fleet-detail' ? '' : 'none';
  }

  function updateAppBar(screenId, data) {
    const bar = document.getElementById('app-bar');
    const backBtn = document.getElementById('app-bar-back');
    const title = document.getElementById('app-bar-title');
    const menu = document.getElementById('app-bar-menu');
    const overflow = document.getElementById('app-bar-overflow');

    const ptsEl = document.getElementById('app-bar-pts');

    // Defaults
    backBtn.classList.add('hidden');
    menu.classList.add('hidden');
    overflow.classList.add('hidden');
    ptsEl.classList.add('hidden');
    ptsEl.textContent = '';

    switch (screenId) {
      case 'screen-fleet-list':
        menu.classList.remove('hidden');
        title.textContent = 'Fleet Builder';
        break;
      case 'screen-fleet-detail':
        backBtn.classList.remove('hidden');
        overflow.classList.remove('hidden');
        title.textContent = 'Fleet';
        if (activeFleet) {
          const pts = fleetPoints(activeFleet);
          const target = activeFleet.targetPoints || 1500;
          ptsEl.textContent = `${pts} / ${target}`;
          ptsEl.classList.remove('hidden');
        }
        break;
      case 'screen-add-group':
        backBtn.classList.remove('hidden');
        title.textContent = 'Add Group';
        if (activeFleet) {
          const pts = fleetPoints(activeFleet);
          const target = activeFleet.targetPoints || 1500;
          ptsEl.textContent = `${pts} / ${target}`;
          ptsEl.classList.remove('hidden');
        }
        break;
      case 'screen-group-detail':
        backBtn.classList.remove('hidden');
        overflow.classList.remove('hidden');
        title.textContent = 'Group';
        if (activeFleet) {
          const pts = fleetPoints(activeFleet);
          const target = activeFleet.targetPoints || 1500;
          ptsEl.textContent = `${pts} / ${target}`;
          ptsEl.classList.remove('hidden');
        }
        break;
      default:
        backBtn.classList.remove('hidden');
        title.textContent = data?.title || '';
    }
  }


  /* ── Screen: Fleet List ────────────────────────────────── */
  function renderFleetList() {
    const container = document.getElementById('fleet-list-rows');
    if (!fleets.length) {
      container.innerHTML = `
        <div style="padding:48px 24px;text-align:center;color:var(--fg3)">
          <div style="font-size:var(--text-subtitle2);font-weight:var(--weight-semibold);margin-bottom:var(--sp-s)">No fleets yet</div>
          <div style="font-size:var(--text-caption1)">Tap Create Fleet to get started.</div>
        </div>`;
      return;
    }
    container.innerHTML = fleets.map((f, i) => {
      const pts = fleetPoints(f);
      const groupCount = (f.groups || []).length;
      const faction = findFactionByKey(f.faction);
      const factionName = faction?.shortName || f.faction;
      const factionIcon = FACTION_ICONS[f.faction] || FACTION_ICONS[factionName?.toLowerCase()];
      const target = f.targetPoints || 1500;
      const pct = Math.min(100, (pts / target) * 100);
      const over = pts > target;
      return `
        <div class="list-row" onclick="App.openFleet(${i})">
          ${factionIcon ? `<img src="${factionIcon}" alt="" class="faction-icon">` : ''}
          <div class="list-row-content">
            <div class="list-row-title">${f.name || 'Unnamed Fleet'}</div>
            <div class="list-row-sub">${pts}/${target}pts, ${groupCount} group${groupCount !== 1 ? 's' : ''}</div>
            <div class="fleet-row-bar"><div class="fleet-row-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
          </div>
        </div>`;
    }).join('');
  }


  /* ── Screen: Fleet Detail ──────────────────────────────── */
  function openFleet(index) {
    activeFleet = fleets[index];
    activeFleet._index = index;
    navigate('screen-fleet-detail', { render: renderFleetDetail });
  }

  function renderFleetDetail() {
    if (!activeFleet) return;
    const f = activeFleet;
    const pts = fleetPoints(f);
    const faction = findFactionByKey(f.faction);
    const factionName = faction?.shortName || f.faction;
    const gameSize = getGameSize(f.targetPoints || 1500);
    const pct = Math.min(100, (pts / (f.targetPoints || 1500)) * 100);
    const over = pts > (f.targetPoints || 1500);

    // Fleet header
    document.getElementById('fleet-detail-name').textContent = f.name || 'Unnamed Fleet';
    document.getElementById('fleet-detail-sub').textContent =
      `${factionName} · ${gameSize.label || '—'} · ${(f.groups || []).length} group${(f.groups || []).length !== 1 ? 's' : ''}`;

    // Points bar
    document.getElementById('fleet-pts-current').textContent = `${pts} / ${f.targetPoints || 1500} pts`;
    document.getElementById('fleet-pts-remaining').textContent = over ? `${pts - (f.targetPoints || 1500)} over` : `${(f.targetPoints || 1500) - pts} remaining`;
    const fill = document.getElementById('fleet-pts-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', over);

    // Warnings
    const warnings = [];
    if (!(f.admiral)) warnings.push('Fleet must contain an Admiral');
    const warnEl = document.getElementById('fleet-warnings');
    if (warnings.length) {
      warnEl.classList.remove('hidden');
      warnEl.innerHTML = warnings.map(w => `
        <div class="warning-item">
          <span class="warning-icon">☠</span>
          <span>${w}</span>
        </div>`).join('');
    } else {
      warnEl.classList.add('hidden');
    }

    // Groups
    const groupsEl = document.getElementById('fleet-groups');
    if (!(f.groups || []).length) {
      groupsEl.innerHTML = `
        <div style="padding:32px 24px;text-align:center;color:var(--fg3);font-size:var(--text-caption1)">
          No groups added yet.
        </div>`;
    } else {
      groupsEl.innerHTML = f.groups.map((g, i) => {
        const ship = g.ship || {};
        const stats = ship.stats || {};
        const qty = g.qty || 1;
        const totalPts = (ship.cost || 0) * qty;
        const art = shipArtPath(ship.name);
        return `
          <div class="list-row" onclick="App.openGroup(${i})">
            ${art ? `<div class="ship-thumb"><img src="${art}" alt=""></div>` : ''}
            <div class="list-row-content">
              <div class="list-row-title">${ship.name || 'Unknown'}${qty > 1 ? ' x' + qty : ''}</div>
              <div class="list-row-sub">${totalPts}pts, ${ship.tonnage || CATEGORY_LABELS[g.category] || g.category || '—'}</div>
            </div>
          </div>`;
      }).join('');
    }
  }


  /* ── Screen: Add Group (Ship Picker) ───────────────────── */
  function openAddGroup() {
    if (!activeFleet) return;
    navigate('screen-add-group', { render: () => renderShipPicker() });
  }

  function renderShipPicker(filter) {
    const faction = findFactionByKey(activeFleet.faction);
    if (!faction) return;

    const groups = faction.groups || [];
    const filterCat = filter || 'all';

    // Category chips
    const chipEl = document.getElementById('picker-chips');
    const cats = [...new Set(groups.map(g => g.category))].sort((a, b) =>
      CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
    chipEl.innerHTML = `<button class="chip ${filterCat === 'all' ? 'active' : ''}" onclick="App.filterShips('all')">All</button>` +
      cats.map(c => `<button class="chip ${filterCat === c ? 'active' : ''}" onclick="App.filterShips('${c}')">${CATEGORY_LABELS[c] || c}</button>`).join('');

    // Ship list
    const listEl = document.getElementById('picker-list');
    const search = (document.getElementById('picker-search')?.value || '').toLowerCase();

    const filtered = groups.filter(g => {
      if (filterCat !== 'all' && g.category !== filterCat) return false;
      if (search && !g.name.toLowerCase().includes(search)) return false;
      return true;
    });

    listEl.innerHTML = filtered.map((g, i) => {
      const ship = g.ship || {};
      const cost = ship.cost || 0;
      const gMin = ship.groupMin || 1;
      const gMax = ship.groupMax || parseInt(ship.stats?.g) || 1;
      const art = shipArtPath(ship.name || g.name);
      const tonnage = ship.tonnage || CATEGORY_LABELS[g.category] || g.category;
      return `
        <div class="list-row" onclick="App.addShipToFleet('${g.id}')">
          ${art ? `<div class="ship-thumb ship-thumb-lg"><img src="${art}" alt=""></div>` : ''}
          <div class="list-row-content">
            <div class="flex justify-between items-center">
              <span class="list-row-title">${ship.name || g.name}</span>
              <span class="list-row-pts">${cost}pts</span>
            </div>
            <div class="list-row-sub">${tonnage} · Group ${gMin}${gMax > gMin ? '-' + gMax : ''}</div>
          </div>
        </div>`;
    }).join('');
  }

  let currentPickerFilter = 'all';
  function filterShips(cat) {
    currentPickerFilter = cat;
    renderShipPicker(cat);
  }

  function addShipToFleet(groupId) {
    const faction = findFactionByKey(activeFleet.faction);
    if (!faction) return;
    const template = faction.groups.find(g => g.id === groupId);
    if (!template) return;

    const ship = JSON.parse(JSON.stringify(template.ship));
    const newGroup = {
      id: uuid(),
      category: template.category,
      shipId: groupId,
      ship: ship,
      qty: ship.groupMin || 1,
      loadouts: []
    };

    if (!activeFleet.groups) activeFleet.groups = [];
    activeFleet.groups.push(newGroup);
    saveFleets();
    goBack(); // Return to fleet detail
    renderFleetDetail();
  }


  /* ── Screen: Group Detail ──────────────────────────────── */
  function openGroup(index) {
    activeGroupIdx = index;
    navigate('screen-group-detail', { render: renderGroupDetail });
  }

  function renderGroupDetail() {
    if (!activeFleet || activeGroupIdx < 0) return;
    const g = activeFleet.groups[activeGroupIdx];
    if (!g) return;
    const ship = g.ship || {};
    const stats = ship.stats || {};
    const qty = g.qty || 1;
    const cost = (ship.cost || 0) * qty;

    const el = document.getElementById('group-detail-content');

    // Parse G stat for counter range
    const gStat = stats.g || '1';
    let gMin = ship.groupMin || 1;
    let gMax = ship.groupMax || 1;
    if (gStat.includes('-')) {
      const parts = gStat.split('-');
      gMin = parseInt(parts[0]) || 1;
      gMax = parseInt(parts[1]) || gMin;
    } else {
      gMin = parseInt(gStat) || 1;
      gMax = gMin;
    }

    // Build stat cells (exclude G — it's in the counter)
    const statEntries = [
      { key: 'scan',   label: 'Scan',   val: stats.scan },
      { key: 'sig',    label: 'Sig',    val: stats.sig },
      { key: 'thrust', label: 'Thrust', val: stats.thrust },
      { key: 'hull',   label: 'Hull',   val: stats.hull },
      { key: 'es',     label: 'ES',     val: stats.es },
      { key: 'ks',     label: 'KS',     val: stats.ks },
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');

    // Add BS if present
    if (stats.bs && stats.bs !== '-') {
      statEntries.push({ key: 'bs', label: 'BS', val: stats.bs });
    }

    // Weapons
    const weapons = ship.weapons || [];

    // Launch assets / loads
    const loads = ship.loads || [];

    // Loadout options
    const loadoutOptions = ship.loadoutOptions || [];

    // Special rules
    const rules = ship.specialRules || [];

    // Ship special text (from stats.special)
    const specialText = stats.special && stats.special !== '-' ? stats.special : '';

    // Art
    const artSrc = shipArtPath(ship.name);

    el.innerHTML = `
      <!-- Ship art hero at top -->
      ${artSrc ? `
        <div class="ship-art-hero">
          <img src="${artSrc}" alt="${ship.name}">
        </div>
      ` : ''}

      <!-- Ship name + points circle -->
      <div class="detail-header">
        <div>
          <div class="detail-name">${ship.name || 'Unknown'}${qty > 1 ? ' x' + qty : ''}</div>
          <div class="detail-type">${ship.tonnage || CATEGORY_LABELS[g.category] || g.category || ''}</div>
        </div>
        <div class="pts-badge-lg">
          <div class="pts-badge-value">${cost}</div>
          <div class="pts-badge-label">Points</div>
        </div>
      </div>

      <!-- Stats grid with TAROT icons -->
      <div class="stat-grid">
        ${statEntries.map(s => `
          <div class="stat-cell">
            ${statIcon(s.key)}
            <div>
              <div class="stat-label">${s.label}</div>
              <div class="stat-value">${s.val}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Group counter (integrates G stat) -->
      <div class="group-counter">
        <div>
          <div class="group-counter-label">Group size</div>
          ${gMax > gMin ? `<div class="group-counter-range">${gMin}–${gMax} allowed</div>` : ''}
        </div>
        <div class="group-counter-controls">
          <button class="counter-btn" onclick="App.changeQty(-1)" ${qty <= gMin ? 'disabled' : ''}>−</button>
          <div class="group-counter-value">${qty}</div>
          <button class="counter-btn" onclick="App.changeQty(1)" ${qty >= gMax ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <!-- Weapons table -->
      ${weapons.length ? `
        <div class="weapon-table">
          <div class="section-header" style="padding:0 0 var(--sp-s)">Weapons</div>
          <div class="weapon-row weapon-row-header">
            <div class="weapon-name">Weapon</div>
            <div class="weapon-val">Lk</div>
            <div class="weapon-val">At</div>
            <div class="weapon-val">Dm</div>
            <div class="weapon-val">Arc</div>
          </div>
          ${weapons.map(w => {
            const wtype = (w.type || '').toUpperCase();
            const typeClass = wtype === 'K' ? 'weapon-type-k' : wtype === 'E' ? 'weapon-type-e' : wtype === 'C' ? 'weapon-type-c' : '';
            const dmgCell = `${w.damage || ''}${wtype ? `<span class="${typeClass}" style="margin-left:2px;font-size:9px">${wtype}</span>` : ''}`;
            return `
            <div class="weapon-row ${typeClass}">
              <div class="weapon-name">${w.name}</div>
              <div class="weapon-val">${w.lock || ''}</div>
              <div class="weapon-val">${w.attack || ''}</div>
              <div class="weapon-val">${dmgCell}</div>
              <div class="weapon-val">${w.arc || ''}</div>
            </div>
            ${w.special && w.special !== '-' ? `<div class="weapon-special">${renderSpecialChips(w.special)}</div>` : ''}
          `}).join('')}
        </div>
      ` : ''}

      <!-- Launch assets table -->
      ${loads.length ? renderLaunchTable(activeFleet.faction, ship) : ''}

      <!-- Loadout options -->
      ${loadoutOptions.length ? `
        <div class="loadout-section">
          <div class="section-header" style="padding:0 0 var(--sp-s)">Loadout</div>
          ${loadoutOptions.map(lo => lo.options.map((opt, oi) => `
            <div class="loadout-option ${oi === 0 ? 'selected' : ''}" onclick="App.selectLoadout(${activeGroupIdx}, '${lo.name}', ${oi})">
              <div class="flex justify-between items-center">
                <span class="loadout-option-name">${opt.name}</span>
                <span class="loadout-option-cost">${opt.cost ? '+' + opt.cost + 'pts' : 'Free'}</span>
              </div>
              ${opt.weapons?.length ? `<div class="loadout-option-desc">${opt.weapons.map(w => w.name).join(', ')}</div>` : ''}
            </div>
          `).join('')).join('')}
        </div>
      ` : ''}

      <!-- Special abilities from stats.special -->
      ${specialText ? `
        <div class="rule-card">
          <div class="flex justify-between items-center">
            <div class="rule-card-name">Special</div>
          </div>
          <div class="rule-card-text">${specialText}</div>
        </div>
      ` : ''}

      <!-- Special rules with full text -->
      ${rules.map(r => `
        <div class="rule-card">
          <div class="flex justify-between items-center">
            <div style="flex:1">
              <div class="rule-card-name">${r.name}</div>
              ${r.description ? `<div class="rule-card-text">${r.description.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
            <span class="rule-card-icon">ⓘ</span>
          </div>
        </div>
      `).join('')}

      <!-- (ship art is the hero at top) -->
    `;
  }

  function changeQty(delta) {
    if (!activeFleet || activeGroupIdx < 0) return;
    const g = activeFleet.groups[activeGroupIdx];
    if (!g) return;
    const stats = g.ship?.stats || {};
    const gStat = stats.g || '1';
    let gMin = g.ship?.groupMin || 1;
    let gMax = g.ship?.groupMax || 1;
    if (gStat.includes('-')) {
      const parts = gStat.split('-');
      gMin = parseInt(parts[0]) || 1;
      gMax = parseInt(parts[1]) || gMin;
    } else {
      gMin = parseInt(gStat) || 1;
      gMax = gMin;
    }
    const newQty = (g.qty || 1) + delta;
    if (newQty >= gMin && newQty <= gMax) {
      g.qty = newQty;
      saveFleets();
      renderGroupDetail();
    }
  }

  function selectLaunch(groupIdx, loadIdx) {
    // Visual only for now — just toggle active class
    const btns = document.querySelectorAll('#screen-group-detail .launch-option');
    btns.forEach((b, i) => b.classList.toggle('active', i === loadIdx));
  }

  function selectLoadout(groupIdx, loName, optIdx) {
    // Visual toggle
    const opts = document.querySelectorAll('#screen-group-detail .loadout-option');
    opts.forEach((o, i) => o.classList.toggle('selected', i === optIdx));
  }

  function removeGroup() {
    if (!activeFleet || activeGroupIdx < 0) return;
    activeFleet.groups.splice(activeGroupIdx, 1);
    activeGroupIdx = -1;
    saveFleets();
    goBack();
  }


  /* ── Create Fleet Modal ────────────────────────────────── */
  function openCreateFleet() {
    document.getElementById('modal-create-fleet').classList.add('active');
    document.getElementById('new-fleet-name').value = '';
    document.getElementById('new-fleet-desc').value = '';
    // Populate faction picker
    const picker = document.getElementById('new-fleet-faction');
    picker.innerHTML = Object.values(FACTIONS).map(f =>
      `<option value="${f.shortName?.toLowerCase() || f.id}">${f.shortName || f.name}</option>`
    ).join('');
    // Populate size picker
    const sizePicker = document.getElementById('new-fleet-size');
    if (FLEET_DATA) {
      const sizes = FLEET_DATA.gameSystem.gameSizes;
      sizePicker.innerHTML = Object.entries(sizes).map(([k, s]) =>
        `<option value="${s.max === -1 ? s.min : s.max}" ${k === 'clash' ? 'selected' : ''}>${s.label} · ${s.max === -1 ? s.min + '+' : s.min + '–' + s.max}pts</option>`
      ).join('');
    }
  }

  function closeCreateFleet() {
    document.getElementById('modal-create-fleet').classList.remove('active');
  }

  function doCreateFleet() {
    const name = document.getElementById('new-fleet-name').value.trim() || 'Unnamed Fleet';
    const desc = document.getElementById('new-fleet-desc').value.trim();
    const faction = document.getElementById('new-fleet-faction').value;
    const targetPoints = parseInt(document.getElementById('new-fleet-size').value) || 1500;

    const fleet = {
      id: uuid(),
      name,
      description: desc,
      faction,
      targetPoints,
      groups: [],
      admiral: null,
      created: Date.now(),
      updated: Date.now()
    };
    fleets.push(fleet);
    saveFleets();
    closeCreateFleet();
    renderFleetList();
    // Open the new fleet
    openFleet(fleets.length - 1);
  }


  /* ── Init ──────────────────────────────────────────────── */
  async function init() {
    // Load data files
    const loads = Object.entries(FACTION_FILES).map(async ([key, url]) => {
      try {
        const resp = await fetch(url);
        const data = await resp.json();
        FACTIONS[key] = data;
      } catch (e) {
        console.warn(`Failed to load ${key}:`, e);
      }
    });

    // Load fleet data
    loads.push(
      fetch('../data/fleet-data.json').then(r => r.json()).then(d => FLEET_DATA = d).catch(() => {})
    );

    // Load ship lore
    loads.push(
      fetch('../data/ship-lore.json').then(r => r.json()).then(d => SHIP_LORE = d).catch(() => {})
    );

    await Promise.all(loads);

    // Load saved fleets
    loadFleets();

    // Render initial screen
    renderFleetList();
    navigate('screen-fleet-list', null, { replace: true });

    // Wire up search
    const searchInput = document.getElementById('picker-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderShipPicker(currentPickerFilter));
    }
  }


  /* ── Public API ────────────────────────────────────────── */
  window.App = {
    init,
    goBack,
    openFleet,
    openAddGroup,
    openGroup,
    openCreateFleet,
    closeCreateFleet,
    doCreateFleet,
    filterShips,
    addShipToFleet,
    changeQty,
    selectLaunch,
    selectLoadout,
    removeGroup
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
