/* ============================================================================
   Combat Calculator UI (window.Calc)
   ----------------------------------------------------------------------------
   Front-end for the DFC damage engine (js/calc-engine.js, window.DFCCalc).
   Two surfaces share one engine and one rendering core:
     - openStandalone(): the full tool reached from the landing page.
     - the builder pane (#builder-calc): opened by the calculator icon on a
       weapon row in the builder's main pane. Accumulates a salvo, fires at any
       enemy ship (remembers the last target).

   Damage maths by Jafdy (everlasting-flawless-engineering.anvil.app); this is a
   vanilla-JS reimplementation of that engine. Charts are hand-built SVG.
   ========================================================================== */
(function () {
  'use strict';
  const E = window.DFCCalc;
  const FACTIONS = ['ucm', 'phr', 'scourge', 'shaltari', 'bioficer', 'resistance'];
  const WEIGHT_BY_CAT = { light: 'L', medium: 'M', heavy: 'H', colossal: 'C', payload: 'P' };
  const SAVE_OPTS = [2, 3, 4, 5, 6, 7]; // 7 = none

  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function pInt(v, dflt) { const m = String(v == null ? '' : v).match(/-?\d+/); return m ? parseInt(m[0], 10) : (dflt === undefined ? 0 : dflt); }
  function pSave(v) { const m = String(v == null ? '' : v).match(/\d+/); return m ? parseInt(m[0], 10) : 7; }
  function clampSave(n) { n = pInt(n, 7); return n < 2 ? 2 : (n > 7 ? 7 : n); }
  function colW(which, dflt) { try { const v = parseInt(localStorage.getItem('dfc_calc_col_' + which), 10); if (v >= 240 && v <= 620) return v; } catch (e) {} return dflt; }

  /* ---- ship database (lazy) ------------------------------------------------ */
  let loaded = false, targets = [], targetByKey = {};
  const _combo = {}; // per-combobox keyboard-nav state: { keys:[], active:int }

  async function ensureLoaded() {
    if (loaded) return;
    await Promise.all(FACTIONS.map(f => App.ensureFactionLoaded(f)));
    buildTargetList();
    loaded = true;
  }

  function shipBase(dbShip, category, factionKey) {
    const rulesHay = ((dbShip.special_rules || []).join(' ') + ' ' + (dbShip.special || ''));
    const shieldM = rulesHay.match(/Shield-(\d)\+?/i);
    const aegisM = rulesHay.match(/Aegis-(\d)/i);
    let weight = (dbShip.tonnage && dbShip.tonnage.length === 1) ? dbShip.tonnage : (WEIGHT_BY_CAT[category] || 'M');
    return {
      ES: pSave(dbShip.es), KS: pSave(dbShip.ks), BS: pSave(dbShip.bs),
      SS: shieldM ? parseInt(shieldM[1], 10) : 7,
      aegis: aegisM ? parseInt(aegisM[1], 10) : 0,
      reinforced: /Reinforced/i.test(rulesHay),
      weight, city: false, descent: false, station: false,
      name: dbShip.name, faction: factionKey,
      weapons: (dbShip.weapons || []).slice()
    };
  }

  function buildTargetList() {
    const { shipDB, FACTION_LABELS, CATEGORY_ORDER } = App.getCalcData();
    targets = []; targetByKey = {};
    FACTIONS.forEach(fk => {
      const fdb = shipDB[fk]; if (!fdb || !fdb.groups) return;
      const cats = Object.keys(fdb.groups);
      const order = (CATEGORY_ORDER || []).concat(cats.filter(c => (CATEGORY_ORDER || []).indexOf(c) === -1));
      order.forEach(cat => {
        const grp = fdb.groups[cat]; if (!grp || !grp.ships) return;
        Object.entries(grp.ships).forEach(([id, ship]) => {
          if (!ship || cat === 'famous_admirals') return; // skip admiral duplicates
          if (ship.additional) return; // skip neutral / civilian / mercenary "misc" ships
          const key = fk + '/' + cat + '/' + id;
          const base = shipBase(ship, cat, fk);
          base.factionLabel = (FACTION_LABELS && FACTION_LABELS[fk]) || fk.toUpperCase();
          targets.push({ key, name: ship.name, faction: fk, factionLabel: base.factionLabel, base });
          targetByKey[key] = base;
        });
      });
    });
    targets.sort((a, b) => a.factionLabel.localeCompare(b.factionLabel) || a.name.localeCompare(b.name));
    // Generic non-ship targets (stations + cities) at the top of the list.
    GENERIC_TARGETS.forEach(g => { targets.unshift(g); targetByKey[g.key] = g.base; });
  }

  // Generic targets from the rulebook (Fleet & Space Stations, Cities). Stations:
  // Small/Medium/Large all use ES 4+ / KS 4+, no backup, no shield. City stats per
  // the rulebook ground-target profile.
  const GENERIC_TARGETS = [
    { key: 'gen/station-s', name: 'Space Station (Small)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 4, KS: 4, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: false, descent: false, station: true, name: 'Space Station (Small)', faction: 'generic', factionLabel: 'Generic', weapons: [] } },
    { key: 'gen/station-m', name: 'Space Station (Medium)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 4, KS: 4, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: false, descent: false, station: true, name: 'Space Station (Medium)', faction: 'generic', factionLabel: 'Generic', weapons: [] } },
    { key: 'gen/station-l', name: 'Space Station (Large)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 4, KS: 4, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: false, descent: false, station: true, name: 'Space Station (Large)', faction: 'generic', factionLabel: 'Generic', weapons: [] } },
    { key: 'gen/city-s', name: 'City (Small)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 5, KS: 5, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: true, descent: false, station: false, name: 'City (Small)', faction: 'generic', factionLabel: 'Generic', weapons: [] } },
    { key: 'gen/city-m', name: 'City (Medium)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 5, KS: 5, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: true, descent: false, station: false, name: 'City (Medium)', faction: 'generic', factionLabel: 'Generic', weapons: [] } },
    { key: 'gen/city-l', name: 'City (Large)', faction: 'generic', factionLabel: 'Generic',
      base: { ES: 5, KS: 5, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'C', city: true, descent: false, station: false, name: 'City (Large)', faction: 'generic', factionLabel: 'Generic', weapons: [] } }
  ];

  /* ---- special-rule parsing ------------------------------------------------ */
  function parseSpecial(str) {
    str = str || '';
    const num = re => { const m = str.match(re); return m ? parseInt(m[1], 10) : 0; };
    const calM = str.match(/Calibre-([A-Z/]+)/i);
    return {
      burnthrough: num(/Burnthrough-(\d+)/i),
      reave: num(/Reave-(\d+)/i),
      critical: num(/Critical-(\d+)/i),
      scald: num(/Scald-(\d+)/i),
      penetrator: /\bPenetrator\b/i.test(str),
      crippling: /\bCrippling\b/i.test(str),
      caw: /Close Action/i.test(str),
      bombardment: /\bBombardment\b/i.test(str),
      mauler: /\bMauler\b/i.test(str),
      calibre: calM ? calM[1].toUpperCase().split('/') : [],
      a2a: /Air to Air/i.test(str),
      escape: /Escape Velocity/i.test(str),
      entry: /Re-?Entry/i.test(str),
      fusillade: num(/Fusillade-(\d+)/i),
      sustained: /Sustained Fire/i.test(str),
      overcharge: /\bOvercharge\b/i.test(str),
      volley: num(/Volley-(\d+)/i) || 1
    };
  }

  function makeWeaponRow(w) {
    const parsed = parseSpecial(w.special);
    return {
      name: w.name || 'Weapon',
      attack: pInt(w.attack, 1),
      lock: pSave(w.lock) === 7 ? 4 : pSave(w.lock),
      damage: pInt(w.damage, 1),
      type: (w.type === 'E' || w.type === 'K' || w.type === 'C') ? w.type : 'C',
      special: w.special || '',
      parsed,
      wsit: { overcharging: false, sustaining: false, telescope: false, number: parsed.volley || 1, calypso: 0 }
    };
  }

  function rowToParsedWeapon(r) {
    const p = r.parsed;
    return {
      attack: r.attack, lock: r.lock, damage: r.damage, damage_type: r.type,
      burnthrough: p.burnthrough, reave: p.reave, critical: p.critical, scald: p.scald,
      penetrator: p.penetrator, crippling: p.crippling, caw: p.caw,
      a2a: p.a2a, bombardment: p.bombardment, calibre: p.calibre, escape: p.escape,
      fusillade: p.fusillade, mauler: p.mauler, overcharge: p.overcharge, entry: p.entry,
      sustained: p.sustained
    };
  }

  /* ---- state --------------------------------------------------------------- */
  function customBase() {
    return { ES: 4, KS: 4, BS: 7, SS: 7, aegis: 0, reinforced: false, weight: 'M', city: false, descent: false, station: false, name: 'Custom target', faction: null };
  }
  function defaultSit() {
    return { fighters: 0, opal: false, WF: false, attacker_atmo: false, target_atmo: false, defences_offline: false, close: false, grouped: false, impetuous: false, telescope: false };
  }
  function freshState() { return { targetKey: '', base: customBase(), sit: defaultSit(), weapons: [], faction: null }; }

  const std = freshState();
  const bld = freshState();

  /* ---- engine bridge ------------------------------------------------------- */
  function compute(state) {
    const base = state.base;
    const sit = { aegis: base.aegis | 0, fighters: state.sit.fighters | 0, opal: state.sit.opal, WF: state.sit.WF,
      attacker_atmo: state.sit.attacker_atmo, target_atmo: state.sit.target_atmo, defences_offline: state.sit.defences_offline,
      close: state.sit.close, grouped: state.sit.grouped, impetuous: state.sit.impetuous };
    const target = E.createTarget(base, sit);
    if (!state.weapons.length) return null;
    // Telescope (Resistance token): exactly ONE weapon system crits one easier.
    // Pick the row where it helps most by trying each and keeping the best average.
    let teleRow = -1;
    if (state.sit.telescope) {
      let best = -1;
      state.weapons.forEach((r, i) => {
        const av = telescopeTrial(base, sit, state.weapons, i, target);
        if (av > best) { best = av; teleRow = i; }
      });
    }
    const engineWeapons = [], rowSpans = [];
    state.weapons.forEach((r, i) => {
      const wsit = (i === teleRow) ? Object.assign({}, r.wsit, { telescope: true }) : r.wsit;
      const ws = E.buildWeapons(rowToParsedWeapon(r), base, sit, wsit);
      rowSpans.push([engineWeapons.length, ws.length]);
      engineWeapons.push(...ws);
    });
    if (!engineWeapons.length) return null;
    try {
      const A = new E.Attack(engineWeapons, target).run();
      return { A, target, rowSpans, teleRow };
    } catch (e) { return { error: e.message || String(e) }; }
  }

  // Average total damage if Telescope is applied to row `teleIdx` (used to pick
  // the best single weapon for the token). Returns -1 on error.
  function telescopeTrial(base, sit, weapons, teleIdx, target) {
    const ews = [];
    weapons.forEach((r, i) => {
      const wsit = (i === teleIdx) ? Object.assign({}, r.wsit, { telescope: true }) : r.wsit;
      ews.push(...E.buildWeapons(rowToParsedWeapon(r), base, sit, wsit));
    });
    if (!ews.length) return -1;
    try { return new E.Attack(ews, target).run().average_result.toNumber(); }
    catch (e) { return -1; }
  }

  /* ---- SVG charts ---------------------------------------------------------- */
  function fmtPct(x) { return (x * 100).toFixed(x >= 0.0995 ? 1 : (x > 0 ? 2 : 0)) + '%'; }

  function distChart(dist) {
    const probs = dist.map(f => f.toNumber());
    let last = probs.length - 1; while (last > 0 && probs[last] < 1e-12) last--;
    const n = last + 1;
    const max = Math.max.apply(null, probs.slice(0, n).concat([1e-9]));
    const W = 100, H = 56, gap = n > 1 ? 2 : 0;
    const bw = (W - gap * (n - 1)) / n;
    let bars = '';
    for (let i = 0; i < n; i++) {
      const h = probs[i] > 0 ? Math.max(0.6, (probs[i] / max) * (H - 12)) : 0;
      const x = i * (bw + gap);
      bars += `<g class="calc-bar"><title>${i} damage: ${fmtPct(probs[i])}</title>`
        + `<rect x="${x.toFixed(2)}" y="${(H - 10 - h).toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="0.6"/>`
        + `<text class="calc-bar-x" x="${(x + bw / 2).toFixed(2)}" y="${H - 2}" text-anchor="middle">${i}</text></g>`;
    }
    return `<svg class="calc-chart calc-chart-dist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Damage distribution">${bars}</svg>`;
  }

  function cumChart(cum) {
    const probs = cum.map(f => f.toNumber());
    let last = probs.length - 1; while (last > 0 && probs[last] < 1e-12) last--;
    const n = last + 1; if (n < 2) return '';
    const W = 100, H = 56;
    const px = i => (n === 1 ? 0 : (i / (n - 1)) * W);
    const py = p => (H - 10) - p * (H - 14);
    let pts = '';
    for (let i = 0; i < n; i++) pts += `${px(i).toFixed(2)},${py(probs[i]).toFixed(2)} `;
    const area = `M0,${H - 10} ` + pts.trim().split(' ').map(s => 'L' + s).join(' ') + ` L${px(n - 1).toFixed(2)},${H - 10} Z`;
    let dots = '';
    for (let i = 0; i < n; i++) dots += `<g class="calc-dot"><title>P(damage ≥ ${i}): ${fmtPct(probs[i])}</title><circle cx="${px(i).toFixed(2)}" cy="${py(probs[i]).toFixed(2)}" r="1.6"/><text class="calc-bar-x" x="${px(i).toFixed(2)}" y="${H - 2}" text-anchor="middle">${i}</text></g>`;
    return `<svg class="calc-chart calc-chart-cum" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Cumulative probability">`
      + `<path class="calc-cum-area" d="${area}"/><polyline class="calc-cum-line" points="${pts.trim()}"/>${dots}</svg>`;
  }

  /* ---- result rendering ---------------------------------------------------- */
  function resultsHtml(state) {
    const r = compute(state);
    if (!r) return `<div class="calc-empty">Add a weapon to see the odds.</div>`;
    if (r.error) return `<div class="calc-empty calc-error">This combination cannot be computed (${esc(r.error)}). Try removing a Close Action weapon or shields.</div>`;
    const { A, rowSpans } = r;
    const avg = A.average_result.toNumber();
    // per-row averages and cripple
    let perRow = '';
    state.weapons.forEach((wr, idx) => {
      const [start, count] = rowSpans[idx];
      let a = 0; for (let i = 0; i < count; i++) a += A.individual_averages[start + i].toNumber();
      let crip = 1; let hasCrip = false;
      for (let i = 0; i < count; i++) { const c = A.cripple_results[start + i]; if (c && !c.isZero()) { hasCrip = true; } crip *= (1 - (c ? c.toNumber() : 0)); }
      const cripPct = hasCrip ? `<span class="calc-row-crip" title="Chance this weapon inflicts a Crippling effect">cripple ${fmtPct(1 - crip)}</span>` : '';
      perRow += `<div class="calc-rowavg"><span class="calc-rowavg-name">${esc(wr.name)}${wr.wsit.number > 1 ? ' ×' + wr.wsit.number : ''}</span><span class="calc-rowavg-val">${a.toFixed(2)}</span>${cripPct}</div>`;
    });
    const cum = A.cumulative_result.map(f => f.toNumber());
    const oneOrMore = cum.length > 1 ? cum[1] : 0;
    return `
      <div class="calc-headline">
        <div class="calc-headline-main"><span class="calc-headline-num">${avg.toFixed(2)}</span><span class="calc-headline-lbl">average damage</span></div>
        <div class="calc-headline-sub">${fmtPct(oneOrMore)} chance of 1+ damage</div>
      </div>
      <div class="calc-chart-block">
        <div class="calc-chart-title">Damage distribution <span class="calc-chart-hint">P(exactly k)</span></div>
        ${distChart(A.summed_result)}
      </div>
      <div class="calc-chart-block">
        <div class="calc-chart-title">Cumulative <span class="calc-chart-hint">P(k or more)</span></div>
        ${cumChart(A.cumulative_result)}
      </div>
      ${state.weapons.length > 1 || perRow.indexOf('cripple') !== -1 ? `<div class="calc-rowavgs"><div class="calc-rowavgs-head">Per weapon (average)</div>${perRow}</div>` : ''}
    `;
  }

  /* ---- target controls ----------------------------------------------------- */
  function saveSelect(label, val, onAttr) {
    const opts = SAVE_OPTS.map(s => `<option value="${s}"${s === val ? ' selected' : ''}>${s === 7 ? 'none' : s + '+'}</option>`).join('');
    return `<label class="calc-field"><span>${label}</span><select class="calc-select" ${onAttr}>${opts}</select></label>`;
  }

  // Ship options grouped into per-faction <optgroup>s (avoids a name separator).
  function shipOptgroups(selectedKey) {
    let out = '', cur = null;
    targets.forEach(t => {
      if (t.factionLabel !== cur) { if (cur !== null) out += '</optgroup>'; out += `<optgroup label="${esc(t.factionLabel)}">`; cur = t.factionLabel; }
      out += `<option value="${esc(t.key)}"${t.key === selectedKey ? ' selected' : ''}>${esc(t.name)}</option>`;
    });
    if (cur !== null) out += '</optgroup>';
    return out;
  }

  // Type-to-search combobox (replaces the 400-option dropdowns). kind: 'target' | 'addship'.
  function comboBox(scope, kind, value, placeholder) {
    const id = 'combo-' + scope + '-' + kind;
    return `<div class="calc-combo" id="${id}-wrap">
      <input class="calc-select calc-combo-input" id="${id}-input" type="text" autocomplete="off" spellcheck="false"
        placeholder="${esc(placeholder)}" value="${esc(value || '')}"
        oninput="Calc.comboFilter('${scope}','${kind}',this.value)"
        onfocus="this.select();Calc.comboFilter('${scope}','${kind}','')"
        onkeydown="Calc.comboKey('${scope}','${kind}',event)"
        onblur="Calc.comboBlur('${scope}','${kind}')">
      <div class="calc-combo-list" id="${id}-list" role="listbox"></div>
    </div>`;
  }

  function targetPanelHtml(state, scope) {
    const b = state.base;
    const curName = state.targetKey ? ((targets.find(t => t.key === state.targetKey) || {}).name || '') : '';
    const sit = state.sit;
    const chk = (k, label, src, hint) => `<label class="calc-check"${hint ? ` title="${esc(hint)}"` : ''}><input type="checkbox"${(src[k]) ? ' checked' : ''} onchange="Calc.setSit('${scope}','${k}',this.checked)"><span>${label}</span></label>`;
    const chkBase = (k, label, hint) => `<label class="calc-check"${hint ? ` title="${esc(hint)}"` : ''}><input type="checkbox"${(b[k]) ? ' checked' : ''} onchange="Calc.setBase('${scope}','${k}',this.checked)"><span>${label}</span></label>`;
    return `
      <div class="calc-panel-title">Target</div>
      <label class="calc-field calc-field-wide"><span>Enemy ship ${curName ? '' : '<em class="calc-field-note">custom</em>'}</span>
        ${comboBox(scope, 'target', curName, 'Type a ship name (or leave blank for custom)')}</label>
      <div class="calc-saves">
        ${saveSelect('Energy', clampSave(b.ES), `onchange="Calc.setBase('${scope}','ES',this.value)"`)}
        ${saveSelect('Kinetic', clampSave(b.KS), `onchange="Calc.setBase('${scope}','KS',this.value)"`)}
        ${saveSelect('Backup', clampSave(b.BS), `onchange="Calc.setBase('${scope}','BS',this.value)"`)}
        ${saveSelect('Shield', clampSave(b.SS), `onchange="Calc.setBase('${scope}','SS',this.value)"`)}
      </div>
      <div class="calc-saves calc-saves-2">
        <label class="calc-field"><span>Aegis</span><select class="calc-select" onchange="Calc.setBase('${scope}','aegis',this.value)">${[0,1,2,3,4,5,6].map(n=>`<option value="${n}"${n===(b.aegis|0)?' selected':''}>${n}</option>`).join('')}</select></label>
        <label class="calc-field"><span>Fighters</span><select class="calc-select" onchange="Calc.setSit('${scope}','fighters',this.value)">${[0,1,2,3,4,5,6,99].map(n=>`<option value="${n}"${n===(sit.fighters|0)?' selected':''}>${n===99?'∞':n}</option>`).join('')}</select></label>
        <label class="calc-field calc-field-ton"><span>Tonnage</span><select class="calc-select" onchange="Calc.setBase('${scope}','weight',this.value)">${['L','M','H','C','P'].map(t=>`<option value="${t}"${t===b.weight?' selected':''}>${({L:'Light',M:'Medium',H:'Heavy',C:'Colossal',P:'Payload'})[t]}</option>`).join('')}</select></label>
      </div>
      <details class="calc-mods"${scope==='std'?' open':''}>
        <summary>Situation</summary>
        <div class="calc-checks">
          ${chkBase('reinforced','Reinforced armour','Crits are one harder to roll')}
          ${chk('close','Within scan range',sit,'Enables Scald and Close Action range')}
          ${chk('defences_offline','Defences offline',sit,'+1 to all saves')}
          ${chk('opal','Opal (shield -1)',sit)}
          ${chk('grouped','Grouped (6+ backup)',sit,'Gives a 6+ Backup save to ships with none')}
          ${chk('impetuous','Impetuous (Lock -1)',sit)}
          ${chk('WF','Weapons Free',sit,'Adds Fusillade attacks')}
          ${(scope === 'std' || state.faction === 'resistance') ? chk('telescope','Telescope token',sit,'Resistance Galileo only: one of your weapons (the best one) crits one easier against this target') : ''}
          ${chkBase('city','Target is a city')}
          ${chk('target_atmo','Target in atmosphere',sit)}
          ${chk('attacker_atmo','Attacker in atmosphere',sit)}
          ${chkBase('descent','Target dropping into atmosphere','A ship descending from orbit into atmosphere is very hard to hit: most weapons can only hit it on a 6+ (needs Target in atmosphere too)')}
        </div>
      </details>
    `;
  }

  /* ---- weapon controls ----------------------------------------------------- */
  function ruleChips(p) {
    const chips = [];
    if (p.burnthrough) chips.push('Burnthrough-' + p.burnthrough);
    if (p.reave) chips.push('Reave-' + p.reave);
    if (p.critical) chips.push('Critical-' + p.critical);
    if (p.scald) chips.push('Scald-' + p.scald);
    if (p.penetrator) chips.push('Penetrator');
    if (p.crippling) chips.push('Crippling');
    if (p.caw) chips.push('Close Action');
    if (p.bombardment) chips.push('Bombardment');
    if (p.mauler) chips.push('Mauler');
    if (p.calibre.length) chips.push('Calibre-' + p.calibre.join('/'));
    if (p.volley > 1) chips.push('Volley-' + p.volley);
    return chips.map(c => `<span class="calc-chip">${esc(c)}</span>`).join('');
  }

  function weaponRowHtml(state, scope, idx) {
    const r = state.weapons[idx];
    const p = r.parsed;
    // Per-weapon toggles only appear when the weapon actually has that rule.
    // (Telescope is NOT here: it is a Resistance target-side token, handled as a
    // single situation toggle that auto-applies to the best weapon.)
    const toggles = [];
    if (p.overcharge) toggles.push(`<label class="calc-wtoggle" title="Double this weapon's damage (Overcharge)"><input type="checkbox"${r.wsit.overcharging?' checked':''} onchange="Calc.setWsit('${scope}',${idx},'overcharging',this.checked)"><span>Overcharge</span></label>`);
    if (p.sustained) toggles.push(`<label class="calc-wtoggle" title="Hit the same target last round (Sustained Fire doubles attacks)"><input type="checkbox"${r.wsit.sustaining?' checked':''} onchange="Calc.setWsit('${scope}',${idx},'sustaining',this.checked)"><span>Sustained</span></label>`);
    return `
      <div class="calc-weapon">
        <div class="calc-weapon-head">
          <input class="calc-weapon-name" value="${esc(r.name)}" onchange="Calc.setWeapon('${scope}',${idx},'name',this.value)" aria-label="Weapon name">
          <button class="calc-weapon-del" title="Remove weapon" onclick="Calc.removeWeapon('${scope}',${idx})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
        <div class="calc-weapon-stats">
          <label class="calc-field calc-field-sm"><span>Att</span><input type="number" min="1" max="40" class="calc-num" value="${r.attack}" onchange="Calc.setWeapon('${scope}',${idx},'attack',this.value)"></label>
          <label class="calc-field calc-field-sm"><span>Lock</span><select class="calc-select" onchange="Calc.setWeapon('${scope}',${idx},'lock',this.value)">${[2,3,4,5,6].map(l=>`<option value="${l}"${l===r.lock?' selected':''}>${l}+</option>`).join('')}</select></label>
          <label class="calc-field calc-field-sm"><span>Dmg</span><input type="number" min="1" max="20" class="calc-num" value="${r.damage}" onchange="Calc.setWeapon('${scope}',${idx},'damage',this.value)"></label>
          <label class="calc-field calc-field-sm"><span>Type</span><select class="calc-select" onchange="Calc.setWeapon('${scope}',${idx},'type',this.value)">${['E','K','C'].map(t=>`<option value="${t}"${t===r.type?' selected':''}>${t}</option>`).join('')}</select></label>
        </div>
        ${ruleChips(p) ? `<div class="calc-weapon-chips">${ruleChips(p)}</div>` : ''}
        ${toggles.length ? `<div class="calc-weapon-toggles">${toggles.join('')}</div>` : ''}
      </div>`;
  }

  function weaponsPanelHtml(state, scope) {
    const rows = state.weapons.map((_, i) => weaponRowHtml(state, scope, i)).join('');
    const addShip = comboBox(scope, 'addship', '', 'Add weapons from a ship (type to search)');
    return `
      <div class="calc-panel-title">Weapons ${state.weapons.length ? `<span class="calc-count">${state.weapons.length}</span>` : ''}</div>
      <div class="calc-weapons-list">${rows || '<div class="calc-empty">No weapons yet.</div>'}</div>
      <div class="calc-weapon-add">
        <button class="btn btn-outline btn-sm" onclick="Calc.addCustomWeapon('${scope}')"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> Custom weapon</button>
        ${addShip}
      </div>`;
  }

  /* ---- full render --------------------------------------------------------- */
  function renderStandalone() {
    const el = document.getElementById('view-calc');
    if (!el) return;
    if (!loaded) { el.innerHTML = `<div class="calc-loading">Loading ship data…</div>`; return; }
    el.innerHTML = `
      <div class="calc-standalone">
        <div class="calc-intro">
          <h1 class="calc-title">Combat Calculator</h1>
          <p class="calc-byline">Damage maths by <a href="https://everlasting-flawless-engineering.anvil.app" target="_blank" rel="noopener">Jafdy</a>.</p>
        </div>
        <div class="calc-grid">
          <section class="calc-col calc-col-target" id="calc-std-target" style="flex:0 0 ${colW('t', 320)}px">${targetPanelHtml(std, 'std')}</section>
          <div class="calc-vsplit" title="Drag to resize" onmousedown="Calc.startColResize(event,'t')"></div>
          <section class="calc-col calc-col-weapons" id="calc-std-weapons" style="flex:0 0 ${colW('w', 360)}px">${weaponsPanelHtml(std, 'std')}</section>
          <div class="calc-vsplit" title="Drag to resize" onmousedown="Calc.startColResize(event,'w')"></div>
          <section class="calc-col calc-col-results">
            <div class="calc-panel-title">Result</div>
            <div id="calc-std-results">${resultsHtml(std)}</div>
            <div class="calc-share">
              <button class="btn btn-outline btn-sm" onclick="Calc.copyLink('std')"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-1 1"/><path d="M10 6a3 3 0 0 0-4 0L4 8a3 3 0 0 0 4 4l1-1"/></svg> Copy share link</button>
            </div>
          </section>
        </div>
      </div>`;
  }

  function renderBuilder() {
    const el = document.getElementById('builder-calc');
    if (!el) return;
    if (!loaded) { el.innerHTML = `<div class="calc-loading">Loading…</div>`; return; }
    try { const w = parseInt(localStorage.getItem('dfc_calc_pane_w'), 10); if (w >= 300 && w <= 680) el.style.width = w + 'px'; } catch (e) {}
    el.innerHTML = `
      <div class="calc-builder">
        <div class="calc-resize-handle" title="Drag to resize" onmousedown="Calc.startResize(event)"></div>
        <div class="calc-builder-head">
          <span class="calc-builder-title">Combat Calculator</span>
          <button class="calc-builder-close" title="Close" onclick="Calc.closeBuilder()"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
        <div class="calc-builder-body">
          <section id="calc-bld-target">${targetPanelHtml(bld, 'bld')}</section>
          <section id="calc-bld-weapons">${weaponsPanelHtml(bld, 'bld')}</section>
          <section class="calc-col-results">
            <div class="calc-panel-title">Result</div>
            <div id="calc-bld-results">${resultsHtml(bld)}</div>
          </section>
          <div class="calc-builder-foot">
            <button class="btn btn-ghost btn-sm" onclick="Calc.openFull()">Open full calculator</button>
          </div>
        </div>
      </div>`;
  }

  function st(scope) { return scope === 'bld' ? bld : std; }
  function rerenderResults(scope) {
    const id = scope === 'bld' ? 'calc-bld-results' : 'calc-std-results';
    const node = document.getElementById(id);
    if (node) node.innerHTML = resultsHtml(st(scope));
    persist(scope);
  }
  function rerenderTarget(scope) {
    const id = scope === 'bld' ? 'calc-bld-target' : 'calc-std-target';
    const node = document.getElementById(id);
    if (node) node.innerHTML = targetPanelHtml(st(scope), scope);
    rerenderResults(scope);
  }
  function rerenderWeapons(scope) {
    const id = scope === 'bld' ? 'calc-bld-weapons' : 'calc-std-weapons';
    const node = document.getElementById(id);
    if (node) node.innerHTML = weaponsPanelHtml(st(scope), scope);
    rerenderResults(scope);
  }

  /* ---- persistence + share ------------------------------------------------- */
  function persist(scope) {
    try { localStorage.setItem('dfc_calc_' + scope, encodeState(st(scope))); } catch (e) {}
  }
  function encodeState(state) {
    const obj = {
      t: state.targetKey,
      b: state.base, s: state.sit,
      w: state.weapons.map(r => ({ n: r.name, a: r.attack, l: r.lock, d: r.damage, y: r.type, sp: r.special, ws: r.wsit }))
    };
    return b64urlEncode(JSON.stringify(obj));
  }
  function decodeState(code, state) {
    try {
      const obj = JSON.parse(b64urlDecode(code));
      state.targetKey = obj.t || '';
      state.base = Object.assign(customBase(), obj.b || {});
      state.sit = Object.assign(defaultSit(), obj.s || {});
      state.weapons = (obj.w || []).map(r => {
        const row = makeWeaponRow({ name: r.n, attack: r.a, lock: r.l, damage: r.d, type: r.y, special: r.sp });
        if (r.ws) row.wsit = Object.assign(row.wsit, r.ws);
        return row;
      });
      return true;
    } catch (e) { return false; }
  }
  function b64urlEncode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(s))); }

  /* ---- public API ---------------------------------------------------------- */
  const Calc = {
    async openStandalone(param) {
      renderStandalone();
      await ensureLoaded();
      if (param) decodeState(param, std);
      else { const saved = localStorage.getItem('dfc_calc_std'); if (saved && !std.weapons.length) decodeState(saved, std); }
      renderStandalone();
    },

    addBuilderWeapon(btn) {
      const w = { name: btn.getAttribute('data-cn'), attack: btn.getAttribute('data-ca'), lock: btn.getAttribute('data-cl'),
        damage: btn.getAttribute('data-cd'), type: btn.getAttribute('data-ct'), special: btn.getAttribute('data-cs') };
      ensureLoaded().then(() => {
        // your fleet's faction gates faction-only situations (e.g. Telescope = Resistance)
        try { bld.faction = App.getCalcData().currentFaction; } catch (e) {}
        if (bld.faction !== 'resistance') bld.sit.telescope = false;
        // restore last target on first open
        if (!bld.targetKey && !bld.weapons.length) {
          const lastKey = localStorage.getItem('dfc_calc_target');
          if (lastKey && targetByKey[lastKey]) { bld.targetKey = lastKey; bld.base = Object.assign(customBase(), targetByKey[lastKey]); }
        }
        bld.weapons.push(makeWeaponRow(w));
        this.openBuilderPane();
      });
    },

    startColResize(ev, which) {
      ev.preventDefault();
      const col = document.getElementById(which === 't' ? 'calc-std-target' : 'calc-std-weapons');
      if (!col) return;
      const startX = ev.clientX, startW = col.getBoundingClientRect().width;
      const move = (e) => { let w = startW + (e.clientX - startX); w = Math.max(240, Math.min(620, w)); col.style.flex = '0 0 ' + w + 'px'; };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
        try { localStorage.setItem('dfc_calc_col_' + which, Math.round(col.getBoundingClientRect().width)); } catch (e) {}
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      document.body.style.userSelect = 'none';
    },

    startResize(ev) {
      ev.preventDefault();
      const pane = document.getElementById('builder-calc');
      if (!pane) return;
      const right = pane.getBoundingClientRect().right;
      const move = (e) => { let w = right - e.clientX; w = Math.max(300, Math.min(680, w)); pane.style.width = w + 'px'; };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
        try { localStorage.setItem('dfc_calc_pane_w', parseInt(pane.style.width, 10)); } catch (e) {}
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      document.body.style.userSelect = 'none';
    },

    openBuilderPane() {
      const pane = document.getElementById('builder-calc');
      const layout = document.getElementById('builder-layout');
      if (pane) pane.classList.remove('hidden');
      if (layout) layout.classList.add('calc-open');
      renderBuilder();
    },
    closeBuilder() {
      const pane = document.getElementById('builder-calc');
      const layout = document.getElementById('builder-layout');
      if (pane) pane.classList.add('hidden');
      if (layout) layout.classList.remove('calc-open');
    },
    openFull() {
      // hand the current builder salvo to the standalone tool
      std.targetKey = bld.targetKey; std.base = Object.assign(customBase(), bld.base); std.sit = Object.assign(defaultSit(), bld.sit);
      std.weapons = bld.weapons.map(r => Object.assign({}, r, { wsit: Object.assign({}, r.wsit), parsed: Object.assign({}, r.parsed) }));
      App.navigate('calc');
    },

    chooseTarget(scope, key) {
      const s = st(scope);
      s.targetKey = key;
      if (key && targetByKey[key]) {
        s.base = Object.assign(customBase(), targetByKey[key]);
        if (scope === 'bld') { try { localStorage.setItem('dfc_calc_target', key); } catch (e) {} }
      }
      rerenderTarget(scope);
    },

    // ── type-to-search combobox (target + add-ship pickers) ──
    comboFilter(scope, kind, q) {
      const list = document.getElementById('combo-' + scope + '-' + kind + '-list');
      if (!list) return;
      const prev = _combo[scope + kind];
      const fac = (prev && prev.fac) || '';
      q = (q || '').trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      let matches = targets;
      if (fac) matches = matches.filter(t => t.factionLabel === fac);
      if (terms.length) matches = matches.filter(t => { const hay = (t.name + ' ' + t.factionLabel).toLowerCase(); return terms.every(w => hay.indexOf(w) !== -1); });
      const cap = 60;
      const shown = matches.slice(0, cap);
      // faction filter chips (sticky header)
      const facList = ['Generic', 'UCM', 'PHR', 'Scourge', 'Shaltari', 'Bioficers', 'Resistance'].filter(f => targets.some(t => t.factionLabel === f));
      let chips = `<button type="button" class="calc-combo-chip${fac === '' ? ' active' : ''}" onmousedown="event.preventDefault();Calc.comboFac('${scope}','${kind}','')">All</button>`;
      chips += facList.map(f => `<button type="button" class="calc-combo-chip${fac === f ? ' active' : ''}" onmousedown="event.preventDefault();Calc.comboFac('${scope}','${kind}','${esc(f)}')">${esc(f)}</button>`).join('');
      const keys = []; // flat list of selectable keys, in display order (for keyboard nav)
      let html = `<div class="calc-combo-chips">${chips}</div>`;
      if (kind === 'target') { html += `<div class="calc-combo-item calc-combo-custom" data-i="0" onmousedown="event.preventDefault();Calc.comboPick('${scope}','target','')">Custom target</div>`; keys.push(''); }
      let curFac = null;
      shown.forEach(t => {
        if (!fac && t.factionLabel !== curFac) { html += `<div class="calc-combo-group">${esc(t.factionLabel)}</div>`; curFac = t.factionLabel; }
        html += `<div class="calc-combo-item" data-i="${keys.length}" onmousedown="event.preventDefault();Calc.comboPick('${scope}','${kind}','${esc(t.key)}')"><span class="calc-combo-name">${esc(t.name)}</span></div>`;
        keys.push(t.key);
      });
      if (terms.length && !shown.length) html += `<div class="calc-combo-empty">No ships match that.</div>`;
      else if (matches.length > cap) html += `<div class="calc-combo-more">${matches.length - cap} more, keep typing to narrow.</div>`;
      list.innerHTML = html;
      list.classList.add('open');
      _combo[scope + kind] = { keys: keys, active: -1, fac: fac };
    },
    comboFac(scope, kind, fac) {
      const c = _combo[scope + kind] || (_combo[scope + kind] = { keys: [], active: -1, fac: '' });
      c.fac = fac;
      const inp = document.getElementById('combo-' + scope + '-' + kind + '-input');
      this.comboFilter(scope, kind, inp ? inp.value : '');
      if (inp) inp.focus();
    },
    comboKey(scope, kind, ev) {
      const st = _combo[scope + kind];
      const list = document.getElementById('combo-' + scope + '-' + kind + '-list');
      if (!st || !list) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!list.classList.contains('open')) { this.comboFilter(scope, kind, ev.target.value); return; }
        st.active += (ev.key === 'ArrowDown' ? 1 : -1);
        if (st.active < 0) st.active = st.keys.length - 1;
        if (st.active >= st.keys.length) st.active = 0;
        const items = list.querySelectorAll('.calc-combo-item');
        items.forEach((el, i) => el.classList.toggle('active', i === st.active));
        const act = items[st.active]; if (act) act.scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        if (st.active >= 0 && st.active < st.keys.length) { ev.preventDefault(); this.comboPick(scope, kind, st.keys[st.active]); ev.target.blur(); }
      } else if (ev.key === 'Escape') {
        list.classList.remove('open');
      }
    },
    comboPick(scope, kind, key) {
      if (kind === 'target') this.chooseTarget(scope, key);
      else if (key) this.addShipWeapons(scope, key);
      const list = document.getElementById('combo-' + scope + '-' + kind + '-list');
      if (list) { list.innerHTML = ''; list.classList.remove('open'); }
    },
    comboBlur(scope, kind) {
      setTimeout(() => { const list = document.getElementById('combo-' + scope + '-' + kind + '-list'); if (list) list.classList.remove('open'); }, 150);
    },
    setBase(scope, k, v) {
      const s = st(scope);
      if (k === 'ES' || k === 'KS' || k === 'BS' || k === 'SS') v = clampSave(v);
      else if (k === 'aegis') v = pInt(v, 0);
      else if (k === 'reinforced' || k === 'city' || k === 'descent' || k === 'station') v = !!v;
      s.base[k] = v;
      if (k === 'ES' || k === 'KS' || k === 'BS' || k === 'SS' || k === 'aegis') s.targetKey = ''; // now custom
      rerenderResults(scope);
    },
    setSit(scope, k, v) {
      const s = st(scope);
      if (k === 'fighters') v = (pInt(v, 0) >= 99 ? Infinity : pInt(v, 0));
      else v = !!v;
      s.sit[k] = v;
      rerenderResults(scope);
    },
    setWeapon(scope, idx, k, v) {
      const s = st(scope); const r = s.weapons[idx]; if (!r) return;
      if (k === 'attack') v = Math.max(1, pInt(v, 1));
      else if (k === 'damage') v = Math.max(1, pInt(v, 1));
      else if (k === 'lock') v = clampSave(v) === 7 ? 6 : clampSave(v);
      r[k] = v;
      rerenderResults(scope);
    },
    setWsit(scope, idx, k, v) {
      const s = st(scope); const r = s.weapons[idx]; if (!r) return;
      r.wsit[k] = (k === 'number' || k === 'calypso') ? pInt(v, 0) : !!v;
      rerenderResults(scope);
    },
    addCustomWeapon(scope) {
      st(scope).weapons.push(makeWeaponRow({ name: 'Custom weapon', attack: 4, lock: '4+', damage: 1, type: 'E', special: '' }));
      rerenderWeapons(scope);
    },
    addShipWeapons(scope, key) {
      const base = targetByKey[key]; if (!base) return;
      (base.weapons || []).forEach(w => st(scope).weapons.push(makeWeaponRow(w)));
      rerenderWeapons(scope);
    },
    removeWeapon(scope, idx) {
      st(scope).weapons.splice(idx, 1);
      rerenderWeapons(scope);
    },
    copyLink(scope) {
      const code = encodeState(st(scope));
      const url = location.origin + location.pathname + '#calc/' + code;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(showCopied, () => prompt('Copy this link', url));
      else prompt('Copy this link', url);
    }
  };

  function showCopied() {
    const b = document.querySelector('.calc-share .btn');
    if (!b) return; const old = b.innerHTML; b.innerHTML = 'Link copied'; setTimeout(() => { b.innerHTML = old; }, 1400);
  }

  window.Calc = Calc;
})();
