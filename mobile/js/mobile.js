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

  function shipArtPath(name) {
    if (!name) return null;
    for (const [prefix, file] of Object.entries(SHIP_ART_SPECIAL)) {
      if (name.startsWith(prefix)) return `../assets/art/${file}.webp`;
    }
    const first = name.split(/\s+/)[0].toLowerCase();
    return SHIP_ART.has(first) ? `../assets/art/${first}.webp` : null;
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
    updateAppBar(screenId, data);
    if (typeof data?.render === 'function') data.render();
  }

  function goBack() {
    if (!history.length) return;
    const prev = history.pop();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(prev.id);
    if (target) target.classList.add('active');
    window.scrollTo(0, prev.scroll || 0);
    // Re-render if needed
    if (prev.id === 'screen-fleet-list') renderFleetList();
    if (prev.id === 'screen-fleet-detail') renderFleetDetail();
    if (prev.id === 'screen-group-detail') renderGroupDetail();
    updateAppBar(prev.id);
  }

  function updateAppBar(screenId, data) {
    const bar = document.getElementById('app-bar');
    const backBtn = document.getElementById('app-bar-back');
    const title = document.getElementById('app-bar-title');
    const menu = document.getElementById('app-bar-menu');
    const overflow = document.getElementById('app-bar-overflow');

    // Defaults
    backBtn.classList.add('hidden');
    menu.classList.add('hidden');
    overflow.classList.add('hidden');

    switch (screenId) {
      case 'screen-fleet-list':
        menu.classList.remove('hidden');
        title.textContent = 'Fleet Builder';
        break;
      case 'screen-fleet-detail':
        backBtn.classList.remove('hidden');
        overflow.classList.remove('hidden');
        title.textContent = 'Fleet';
        break;
      case 'screen-add-group':
        backBtn.classList.remove('hidden');
        title.textContent = 'Add Group';
        break;
      case 'screen-group-detail':
        backBtn.classList.remove('hidden');
        overflow.classList.remove('hidden');
        title.textContent = 'Group';
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
      return `
        <div class="list-row" onclick="App.openFleet(${i})">
          <div class="list-row-content">
            <div class="list-row-title">${f.name || 'Unnamed Fleet'}</div>
            <div class="list-row-sub">${pts}pts, ${groupCount} group${groupCount !== 1 ? 's' : ''} · ${factionName}</div>
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
      { label: 'Scan', val: stats.scan },
      { label: 'Sig', val: stats.sig },
      { label: 'Thrust', val: stats.thrust },
      { label: 'Hull', val: stats.hull },
      { label: 'Armour', val: stats.es || stats.armour },
      { label: 'PD', val: stats.pd || stats.ks },
    ].filter(s => s.val != null && s.val !== '-' && s.val !== '');

    // If there are additional stats like BS, include them
    if (stats.bs && stats.bs !== '-') {
      statEntries.push({ label: 'BS', val: stats.bs });
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
      <!-- Ship name + points circle -->
      <div class="detail-header">
        <div>
          <div class="detail-name">${ship.name || 'Unknown'}</div>
          <div class="detail-type">${ship.tonnage || CATEGORY_LABELS[g.category] || g.category || ''}</div>
        </div>
        <div class="pts-badge">
          <div class="pts-badge-value">${cost}</div>
          <div class="pts-badge-label">Points</div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="stat-grid">
        ${statEntries.map(s => `
          <div>
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.val}</div>
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
          ${weapons.map(w => `
            <div class="weapon-row">
              <div class="weapon-name">${w.name}</div>
              <div class="weapon-val">${w.lock || ''}</div>
              <div class="weapon-val">${w.attack || ''}</div>
              <div class="weapon-val">${w.damage || ''}</div>
              <div class="weapon-val">${w.arc || ''}</div>
            </div>
            ${w.special && w.special !== '-' ? `<div class="weapon-special">${w.special}</div>` : ''}
          `).join('')}
        </div>
      ` : ''}

      <!-- Launch assets -->
      ${loads.length ? `
        <div class="loadout-section">
          <div class="section-header" style="padding:0 0 var(--sp-s)">Launch Assets</div>
          <div class="launch-picker">
            ${loads.map((l, i) => `
              <button class="launch-option ${i === 0 ? 'active' : ''}" onclick="App.selectLaunch(${activeGroupIdx}, ${i})">${l.name}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

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

      <!-- Ship art -->
      ${artSrc ? `
        <div class="ship-art-block">
          <img src="${artSrc}" alt="${ship.name}">
        </div>
      ` : ''}
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
