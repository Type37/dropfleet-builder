/* ============================================================================
   Combat Calculator UI (window.Calc)
   ----------------------------------------------------------------------------
   Faithful front end over Jafdy's engine: window.DFCCalc (math) + window.DFCData
   (his preset tables, SaveString config codes, exact create_target/create_weapon).
   Mirrors his Form2 + WeaponTemplate: full per-weapon control set, target panel,
   his presets via search, config-code load/copy. Charts are hand-built SVG.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.DFCCalc, D = window.DFCData;

  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function pInt(v, dflt) { const m = String(v == null ? '' : v).match(/-?\d+/); return m ? parseInt(m[0], 10) : (dflt === undefined ? 0 : dflt); }

  const TARGET_NAMES = Object.keys(D.target_coded);
  const WEAPON_NAMES = Object.keys(D.weapon_coded);
  const SAVES = [2, 3, 4, 5, 6, 7]; // 7 = none

  /* ---- state model --------------------------------------------------------- */
  function rowFromPW(pw, wsit, presetName) {
    const cal = pw.calibre || [];
    return {
      preset: presetName || 'Custom', active: true,
      attack: pw.attack, lock: pw.lock, damage: pw.damage, type: pw.damage_type,
      burnthrough: { on: pw.burnthrough > 0, val: pw.burnthrough || 1 },
      reave: { on: pw.reave > 0, val: pw.reave || 1 },
      critical: { on: pw.critical > 0, val: pw.critical || 1 },
      scald: { on: pw.scald > 0, val: pw.scald || 1 },
      fusillade: { on: pw.fusillade > 0, val: pw.fusillade || 1 },
      penetrator: !!pw.penetrator, crippling: !!pw.crippling, bomber: !!pw.bomber,
      calibre: { L: cal.indexOf('L') !== -1, M: cal.indexOf('M') !== -1, H: cal.indexOf('H') !== -1, C: cal.indexOf('C') !== -1 },
      bombardment: !!pw.bombardment, overcharge: !!pw.overcharge, caw: !!pw.caw, mauler: !!pw.mauler,
      sustained: !!pw.sustained, a2a: !!pw.a2a, escape: !!pw.escape, entry: !!pw.entry,
      wsit: { number: (wsit && wsit.number) || 1, telescope: !!(wsit && wsit.telescope), calypso: (wsit && wsit.calypso) || 0, overcharging: !!(wsit && wsit.overcharging), sustaining: !!(wsit && wsit.sustaining) }
    };
  }
  function defaultRow() { return rowFromPW(D.defaults.weapon(), D.defaults.weapon_situation(), 'Custom'); }
  function rowToPW(r) {
    const cal = []; if (r.calibre.L) cal.push('L'); if (r.calibre.M) cal.push('M'); if (r.calibre.H) cal.push('H'); if (r.calibre.C) cal.push('C');
    return D.PresetWeapon(r.attack, r.lock, r.damage, r.type, {
      burnthrough: r.burnthrough.on ? r.burnthrough.val : 0,
      reave: r.reave.on ? r.reave.val : 0,
      critical: r.critical.on ? r.critical.val : 0,
      scald: r.scald.on ? r.scald.val : 0,
      penetrator: r.penetrator, crippling: r.crippling, caw: r.caw, a2a: r.a2a,
      bombardment: r.bombardment, calibre: cal, escape: r.escape,
      fusillade: r.fusillade.on ? r.fusillade.val : 0,
      mauler: r.mauler, overcharge: r.overcharge, entry: r.entry, sustained: r.sustained, bomber: r.bomber
    });
  }
  function rowToWsit(r) { return D.WeaponSituation(r.wsit); }

  function freshTargetState() {
    const pt = D.defaults.target();
    return {
      targetPreset: 'Custom', type: 'Ship',
      pt: { weight: pt.weight, ES: pt.ES, KS: pt.KS, BS: pt.BS, SS: pt.SS, descent: false, reinforced: false },
      sit: { aegisOn: false, aegis: 0, fightersOn: false, fighters: 0, fullFighters: false,
        opal: false, WF: true, attacker_atmo: false, target_atmo: false, defences_offline: false, close: true, grouped: false, impetuous: false, shielded: false }
    };
  }
  function freshState() { const t = freshTargetState(); t.weapons = []; t.faction = null; return t; }

  function ptFromState(s) {
    return D.PresetTarget(s.pt.weight, s.pt.ES, s.pt.KS, s.pt.BS, s.pt.SS, s.pt.descent, s.pt.reinforced, s.type === 'City', s.type === 'Station');
  }
  function sitFromState(s) {
    const v = s.sit;
    const fighters = v.fullFighters ? Infinity : (v.fightersOn ? (v.fighters | 0) : 0);
    return D.AttackSituation({ aegis: v.aegisOn ? (v.aegis | 0) : 0, fighters: fighters, opal: v.opal, WF: v.WF,
      attacker_atmo: v.attacker_atmo, target_atmo: v.target_atmo, defences_offline: v.defences_offline,
      close: v.close, grouped: v.grouped, impetuous: v.impetuous, shielded: v.shielded });
  }

  const std = freshState(), bld = freshState();
  function st(scope) { return scope === 'bld' ? bld : std; }
  // Telescope is a Resistance-only token (Galileo). Shown in the full standalone
  // tool; in the builder pane only when your fleet is Resistance.
  function teleAllowed(scope) { return scope !== 'bld' || bld.faction === 'resistance'; }

  /* ---- engine bridge ------------------------------------------------------- */
  function compute(state) {
    const active = state.weapons.filter(r => r.active);
    if (!active.length) return null;
    const pt = ptFromState(state), sit = sitFromState(state);
    const T = D.createTarget(pt, sit);
    const teleOK = state !== bld || bld.faction === 'resistance'; // telescope gated to Resistance in the builder pane
    const engineWeapons = [], spans = [];
    state.weapons.forEach(r => {
      if (!r.active) { spans.push(null); return; }
      const wsit = rowToWsit(r); if (!teleOK) wsit.telescope = false;
      const ws = D.createWeapon(rowToPW(r), pt, sit, wsit, r.crippling);
      spans.push([engineWeapons.length, ws.length]);
      engineWeapons.push(...ws);
    });
    try { return { A: new C.Attack(engineWeapons, T).run(), spans }; }
    catch (e) { return { error: e.message || String(e) }; }
  }

  /* ---- SVG charts ---------------------------------------------------------- */
  function fmtPct(x) { return (x * 100).toFixed(x >= 0.0995 ? 1 : (x > 0 ? 2 : 0)) + '%'; }
  function distChart(dist) {
    const p = dist.map(f => f.toNumber()); let last = p.length - 1; while (last > 0 && p[last] < 1e-12) last--;
    const n = last + 1, max = Math.max.apply(null, p.slice(0, n).concat([1e-9])), W = 100, H = 56, gap = n > 1 ? 2 : 0, bw = (W - gap * (n - 1)) / n;
    let bars = '';
    for (let i = 0; i < n; i++) { const h = p[i] > 0 ? Math.max(0.6, (p[i] / max) * (H - 12)) : 0, x = i * (bw + gap);
      bars += `<g class="calc-bar"><title>${i} damage: ${fmtPct(p[i])}</title><rect x="${x.toFixed(2)}" y="${(H - 10 - h).toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="0.6"/><text class="calc-bar-x" x="${(x + bw / 2).toFixed(2)}" y="${H - 2}" text-anchor="middle">${i}</text></g>`; }
    return `<svg class="calc-chart calc-chart-dist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Damage distribution">${bars}</svg>`;
  }
  function cumChart(cum) {
    const p = cum.map(f => f.toNumber()); let last = p.length - 1; while (last > 0 && p[last] < 1e-12) last--;
    const n = last + 1; if (n < 2) return ''; const W = 100, H = 56, px = i => (i / (n - 1)) * W, py = v => (H - 10) - v * (H - 14);
    let pts = ''; for (let i = 0; i < n; i++) pts += `${px(i).toFixed(2)},${py(p[i]).toFixed(2)} `;
    const area = `M0,${H - 10} ` + pts.trim().split(' ').map(s => 'L' + s).join(' ') + ` L${px(n - 1).toFixed(2)},${H - 10} Z`;
    let dots = ''; for (let i = 0; i < n; i++) dots += `<g class="calc-dot"><title>P(damage ≥ ${i}): ${fmtPct(p[i])}</title><circle cx="${px(i).toFixed(2)}" cy="${py(p[i]).toFixed(2)}" r="1.6"/><text class="calc-bar-x" x="${px(i).toFixed(2)}" y="${H - 2}" text-anchor="middle">${i}</text></g>`;
    return `<svg class="calc-chart calc-chart-cum" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Cumulative probability"><path class="calc-cum-area" d="${area}"/><polyline class="calc-cum-line" points="${pts.trim()}"/>${dots}</svg>`;
  }

  /* ---- combobox (preset search) -------------------------------------------- */
  const _combo = {};
  function comboBox(scope, kind, value, placeholder) {
    const id = 'combo-' + scope + '-' + kind;
    return `<div class="calc-combo" id="${id}-wrap"><input class="calc-select calc-combo-input" id="${id}-input" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(value || '')}" oninput="Calc.comboFilter('${scope}','${kind}',this.value)" onfocus="this.select();Calc.comboFilter('${scope}','${kind}','')" onkeydown="Calc.comboKey('${scope}','${kind}',event)" onblur="Calc.comboBlur('${scope}','${kind}')"><div class="calc-combo-list" id="${id}-list" role="listbox"></div></div>`;
  }

  /* ---- target panel -------------------------------------------------------- */
  function saveSel(label, val, on) {
    const opts = SAVES.map(s => `<option value="${s}"${s === val ? ' selected' : ''}>${s === 7 ? 'none' : s + '+'}</option>`).join('');
    return `<label class="calc-field"><span>${label}</span><select class="calc-select" ${on}>${opts}</select></label>`;
  }
  function targetPanel(s, scope) {
    const custom = s.targetPreset === 'Custom';
    const dis = custom ? '' : 'disabled';
    const v = s.sit;
    const chk = (k, label, hint) => `<label class="calc-check"${hint ? ` title="${esc(hint)}"` : ''}><input type="checkbox"${v[k] ? ' checked' : ''} onchange="Calc.setSit('${scope}','${k}',this.checked)"><span>${label}</span></label>`;
    const chkT = (k, label, hint) => `<label class="calc-check${custom ? '' : ' calc-disabled'}"${hint ? ` title="${esc(hint)}"` : ''}><input type="checkbox"${s.pt[k] ? ' checked' : ''} ${dis} onchange="Calc.setPT('${scope}','${k}',this.checked)"><span>${label}</span></label>`;
    return `
      <div class="calc-panel-title">Target ${s.targetPreset !== 'Custom' ? `<span class="calc-preset-tag">${esc(s.targetPreset)}</span>` : ''}</div>
      <label class="calc-field calc-field-wide"><span>Preset</span>${comboBox(scope, 'target', s.targetPreset === 'Custom' ? '' : s.targetPreset, 'Search ' + TARGET_NAMES.length + ' ships (blank = custom)')}</label>
      ${!custom ? `<div class="calc-preset-hint">Preset stats locked. <button type="button" class="calc-linkbtn" onclick="Calc.chooseTargetPreset('${scope}','')">Edit as Custom</button></div>` : ''}
      <div class="calc-saves calc-saves-3">
        <label class="calc-field"><span>Type</span><select class="calc-select" onchange="Calc.setType('${scope}',this.value)">${['Ship', 'City', 'Station'].map(t => `<option${t === s.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="calc-field"><span>Weight</span><select class="calc-select" ${dis} onchange="Calc.setPT('${scope}','weight',this.value)">${['L', 'M', 'H', 'C'].map(t => `<option value="${t}"${t === s.pt.weight ? ' selected' : ''}>${({ L: 'Light', M: 'Medium', H: 'Heavy', C: 'Colossal' })[t]}</option>`).join('')}</select></label>
        <span></span>
      </div>
      <div class="calc-saves">
        ${saveSel('Energy', s.pt.ES, `${dis} onchange="Calc.setPT('${scope}','ES',this.value)"`)}
        ${saveSel('Kinetic', s.pt.KS, `${dis} onchange="Calc.setPT('${scope}','KS',this.value)"`)}
        ${saveSel('Backup', s.pt.BS, `${dis} onchange="Calc.setPT('${scope}','BS',this.value)"`)}
        ${saveSel('Shield', s.pt.SS, `${dis} onchange="Calc.setPT('${scope}','SS',this.value)"`)}
      </div>
      <div class="calc-saves calc-saves-3">
        <label class="calc-field"><span>Aegis</span><select class="calc-select" onchange="Calc.setSitNum('${scope}','aegis',this.value)">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option${n === (v.aegisOn ? v.aegis : 0) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="calc-field"><span>Fighter rerolls</span><select class="calc-select"${v.fullFighters ? ' disabled' : ''} onchange="Calc.setSitNum('${scope}','fighters',this.value)">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option${n === (v.fightersOn ? v.fighters : 0) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="calc-check calc-check-inline" title="Unlimited fighter rerolls"><input type="checkbox"${v.fullFighters ? ' checked' : ''} onchange="Calc.setSit('${scope}','fullFighters',this.checked)"><span>∞</span></label>
      </div>
      <details class="calc-mods"${scope === 'std' ? ' open' : ''}>
        <summary>Situation</summary>
        <div class="calc-modgroup"><div class="calc-modgroup-head">Saves</div><div class="calc-checks">
          ${chkT('reinforced', 'Reinforced armour', 'Crits one harder to roll')}
          ${chk('defences_offline', 'Defences offline', '+1 to all saves')}
          ${chk('opal', 'Opal (shield -1)')}
          ${chk('grouped', 'Grouped (6+ backup)')}
          ${chk('shielded', 'Use shields', 'Defender rolls shield save instead of armour')}
        </div></div>
        <div class="calc-modgroup"><div class="calc-modgroup-head">Lock & orders</div><div class="calc-checks">
          ${chk('impetuous', 'Impetuous (Lock -1)')}
          ${chk('WF', 'Weapons Free', 'Adds Fusillade attacks')}
          ${chk('close', 'Within scan range', 'Enables Scald / Close Action')}
        </div></div>
        <div class="calc-modgroup"><div class="calc-modgroup-head">Atmosphere</div><div class="calc-checks">
          ${chk('target_atmo', 'Target in atmosphere')}
          ${chk('attacker_atmo', 'Attacker in atmosphere')}
          ${chkT('descent', 'Target descending', 'Dropping into atmosphere: most weapons hit on 6+')}
        </div></div>
      </details>`;
  }

  /* ---- weapon row (full control set, mirrors WeaponTemplate) ---------------- */
  function ruleVal(r, scope, idx, key, label, min) {
    const o = r[key];
    return `<label class="calc-rule"><input type="checkbox"${o.on ? ' checked' : ''}${r.preset === 'Custom' ? '' : ' disabled'} onchange="Calc.setRule('${scope}',${idx},'${key}',this.checked)"><span>${label}</span><input type="number" class="calc-rule-num" min="${min}" max="9" value="${o.val}"${(o.on && r.preset === 'Custom') ? '' : ' disabled'} onchange="Calc.setRuleVal('${scope}',${idx},'${key}',this.value)"></label>`;
  }
  function flag(r, scope, idx, key, label, alwaysOn) {
    const en = alwaysOn ? r.active : (r.preset === 'Custom');
    return `<label class="calc-flag"><input type="checkbox"${r[key] ? ' checked' : ''}${en ? '' : ' disabled'} onchange="Calc.setFlag('${scope}',${idx},'${key}',this.checked)"><span>${label}</span></label>`;
  }
  function weaponRow(s, scope, idx) {
    const r = s.weapons[idx];
    const custom = r.preset === 'Custom';
    const dis = custom ? '' : 'disabled';
    const cripEn = r.active && (custom || r.crippling);
    const calSeg = ['L', 'M', 'H', 'C'].map(k => `<button type="button" class="calc-seg-btn${r.calibre[k] ? ' on' : ''}"${custom ? '' : ' disabled'} aria-pressed="${!!r.calibre[k]}" onclick="Calc.setCal('${scope}',${idx},'${k}',${!r.calibre[k]})">${k}</button>`).join('');
    return `
      <div class="calc-weapon${r.active ? '' : ' calc-weapon-off'}">
        <div class="calc-weapon-head">
          <input type="checkbox" class="calc-weapon-active" title="Include this weapon"${r.active ? ' checked' : ''} onchange="Calc.setActive('${scope}',${idx},this.checked)">
          <div class="calc-weapon-preset">${comboBox(scope, 'w' + idx, custom ? '' : r.preset, 'Custom (search ' + WEAPON_NAMES.length + ' weapons)')}</div>
          <button class="calc-weapon-del" title="Remove" onclick="Calc.removeWeapon('${scope}',${idx})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
        ${(r.name || r.arc) ? `<div class="calc-weapon-id">${r.name ? `<span class="calc-weapon-name-lbl">${esc(r.name)}</span>` : ''}${r.arc ? `<span class="calc-weapon-arc" title="Firing arc">${esc(r.arc)}</span>` : ''}</div>` : ''}
        ${(!custom) ? `<div class="calc-preset-hint">Preset stats locked. <button type="button" class="calc-linkbtn" onclick="Calc.chooseWeaponPreset('${scope}',${idx},'')">Edit as Custom</button></div>` : ''}
        <div class="calc-weapon-stats">
          <label class="calc-field calc-field-sm"><span>Att</span><input type="number" min="1" max="62" class="calc-num" value="${r.attack}" ${dis} onchange="Calc.setStat('${scope}',${idx},'attack',this.value)"></label>
          <label class="calc-field calc-field-sm"><span>Lock</span><select class="calc-select" ${dis} onchange="Calc.setStat('${scope}',${idx},'lock',this.value)">${[2, 3, 4, 5, 6].map(l => `<option${l === r.lock ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="calc-field calc-field-sm"><span>Dmg</span><input type="number" min="0" max="20" class="calc-num" value="${r.damage}" ${dis} onchange="Calc.setStat('${scope}',${idx},'damage',this.value)"></label>
          <label class="calc-field calc-field-sm"><span>Type</span><select class="calc-select" ${dis} onchange="Calc.setStat('${scope}',${idx},'type',this.value)">${[['E', 'Energy'], ['K', 'Kinetic'], ['C', 'Core']].map(t => `<option value="${t[0]}"${t[0] === r.type ? ' selected' : ''}>${t[1]}</option>`).join('')}</select></label>
        </div>
        <div class="calc-rules">
          ${ruleVal(r, scope, idx, 'burnthrough', 'Burnthrough', 1)}
          ${ruleVal(r, scope, idx, 'reave', 'Reave', 1)}
          ${ruleVal(r, scope, idx, 'critical', 'Critical', 1)}
          ${ruleVal(r, scope, idx, 'scald', 'Scald', 1)}
          ${ruleVal(r, scope, idx, 'fusillade', 'Fusillade', 1)}
        </div>
        <div class="calc-flags">
          ${flag(r, scope, idx, 'penetrator', 'Penetrator')}
          <label class="calc-flag"><input type="checkbox"${r.crippling ? ' checked' : ''}${cripEn ? '' : ' disabled'} onchange="Calc.setFlag('${scope}',${idx},'crippling',this.checked)"><span>Crippling</span></label>
          ${flag(r, scope, idx, 'bombardment', 'Bombardment')}
          ${flag(r, scope, idx, 'overcharge', 'Overcharge')}
          ${flag(r, scope, idx, 'caw', 'Close Action')}
          ${flag(r, scope, idx, 'mauler', 'Mauler')}
          ${flag(r, scope, idx, 'sustained', 'Sustained')}
          ${flag(r, scope, idx, 'a2a', 'Air to Air')}
          ${flag(r, scope, idx, 'escape', 'Escape Velocity')}
          ${flag(r, scope, idx, 'entry', 'Re-Entry')}
          ${flag(r, scope, idx, 'bomber', 'Bomber')}
          <span class="calc-seg" title="Calibre tonnage (improves Lock vs matching weight)"><span class="calc-seg-lbl">Calibre</span>${calSeg}</span>
        </div>
        <div class="calc-wsit">
          <label class="calc-field calc-field-sm"><span>${r.bomber ? 'Bombers' : 'Number'}</span><input type="number" min="1" max="40" class="calc-num"${r.active ? '' : ' disabled'} value="${r.wsit.number}" onchange="Calc.setWsit('${scope}',${idx},'number',this.value)"></label>
          <label class="calc-field calc-field-sm"><span>Calypso</span><input type="number" min="-4" max="4" class="calc-num"${r.active ? '' : ' disabled'} value="${r.wsit.calypso}" onchange="Calc.setWsit('${scope}',${idx},'calypso',this.value)"></label>
          ${teleAllowed(scope) ? `<label class="calc-flag" title="Resistance Galileo: one weapon crits one easier"><input type="checkbox"${r.wsit.telescope ? ' checked' : ''}${r.active ? '' : ' disabled'} onchange="Calc.setWsit('${scope}',${idx},'telescope',this.checked)"><span>Telescope</span></label>` : ''}
          <label class="calc-flag"><input type="checkbox"${r.wsit.overcharging ? ' checked' : ''}${(r.active && r.overcharge) ? '' : ' disabled'} onchange="Calc.setWsit('${scope}',${idx},'overcharging',this.checked)"><span>Overcharging</span></label>
          <label class="calc-flag"><input type="checkbox"${r.wsit.sustaining ? ' checked' : ''}${(r.active && r.sustained) ? '' : ' disabled'} onchange="Calc.setWsit('${scope}',${idx},'sustaining',this.checked)"><span>Sustaining</span></label>
        </div>
      </div>`;
  }
  // Compact read-only weapon card for the builder sidebar (audit #1): the roster
  // weapon's stats are fixed, so show them as a summary instead of the full editor.
  function ruleChipsText(r) {
    const c = [];
    if (r.burnthrough.on) c.push('Burnthrough-' + r.burnthrough.val);
    if (r.reave.on) c.push('Reave-' + r.reave.val);
    if (r.critical.on) c.push('Critical-' + r.critical.val);
    if (r.scald.on) c.push('Scald-' + r.scald.val);
    if (r.fusillade.on) c.push('Fusillade-' + r.fusillade.val);
    if (r.penetrator) c.push('Penetrator');
    if (r.crippling) c.push('Crippling');
    if (r.caw) c.push('Close Action');
    if (r.bombardment) c.push('Bombardment');
    if (r.mauler) c.push('Mauler');
    if (r.overcharge) c.push('Overcharge');
    if (r.bomber) c.push('Bomber');
    if (r.sustained) c.push('Sustained');
    const cal = ['L', 'M', 'H', 'C'].filter(k => r.calibre[k]);
    if (cal.length) c.push('Calibre-' + cal.join('/'));
    return c;
  }
  function compactWeaponRow(s, scope, idx) {
    const r = s.weapons[idx];
    const chips = ruleChipsText(r).map(t => `<span class="calc-chip">${esc(t)}</span>`).join('');
    return `
      <div class="calc-weapon calc-weapon-compact${r.active ? '' : ' calc-weapon-off'}">
        <div class="calc-weapon-head">
          <input type="checkbox" class="calc-weapon-active" title="Include this weapon"${r.active ? ' checked' : ''} onchange="Calc.setActive('${scope}',${idx},this.checked)">
          <span class="calc-weapon-name-lbl">${esc(r.name || ('Weapon ' + (idx + 1)))}</span>
          ${r.arc ? `<span class="calc-weapon-arc" title="Firing arc">${esc(r.arc)}</span>` : ''}
          <button class="calc-weapon-del" title="Remove" onclick="Calc.removeWeapon('${scope}',${idx})"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
        <div class="calc-compact-stats"><span>Att <b>${r.attack}${r.wsit.number > 1 && !r.bomber ? ' ×' + r.wsit.number : ''}</b></span><span>Lock <b>${r.lock}+</b></span><span>Dmg <b>${r.damage}${r.type}</b></span></div>
        ${chips ? `<div class="calc-weapon-chips">${chips}</div>` : ''}
      </div>`;
  }
  function weaponsPanel(s, scope) {
    const compact = scope === 'bld';
    const rows = s.weapons.map((_, i) => (compact ? compactWeaponRow : weaponRow)(s, scope, i)).join('');
    return `
      <div class="calc-panel-title">Weapons ${s.weapons.length ? `<span class="calc-count">${s.weapons.length}</span>` : ''}</div>
      <div class="calc-weapons-list">${rows || '<div class="calc-empty">Click a weapon\'s damage in the roster to add it.</div>'}</div>
      ${compact ? '' : `<div class="calc-weapon-add"><button class="btn btn-outline btn-sm" onclick="Calc.addCustomWeapon('${scope}')"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> Add weapon</button></div>`}`;
  }

  /* ---- results ------------------------------------------------------------- */
  function resultsHtml(s) {
    const r = compute(s);
    if (!r) return `<div class="calc-empty">Add a weapon to see the odds.</div>`;
    if (r.error) return `<div class="calc-empty calc-error">Cannot compute this combination (${esc(r.error)}).</div>`;
    const A = r.A, avg = A.average_result.toNumber();
    let perRow = '';
    s.weapons.forEach((wr, idx) => {
      const sp = r.spans[idx]; if (!sp) return;
      let a = 0; for (let i = 0; i < sp[1]; i++) a += A.individual_averages[sp[0] + i].toNumber();
      let crip = 1, has = false; for (let i = 0; i < sp[1]; i++) { const c = A.cripple_results[sp[0] + i]; if (c && !c.isZero()) has = true; crip *= (1 - (c ? c.toNumber() : 0)); }
      perRow += `<div class="calc-rowavg"><span class="calc-rowavg-name">${esc(wr.name || (wr.preset === 'Custom' ? 'Weapon ' + (idx + 1) : wr.preset))}${wr.wsit.number > 1 && !wr.bomber ? ' ×' + wr.wsit.number : ''}</span><span class="calc-rowavg-val">${a.toFixed(2)}</span>${has ? `<span class="calc-row-crip">cripple ${fmtPct(1 - crip)}</span>` : ''}</div>`;
    });
    const cum = A.cumulative_result.map(f => f.toNumber());
    return `
      <div class="calc-headline"><span class="calc-headline-num">${avg.toFixed(2)}</span><span class="calc-headline-lbl">average damage</span><div class="calc-headline-sub">${fmtPct(cum.length > 1 ? cum[1] : 0)} chance of 1+ damage</div></div>
      <div class="calc-chart-block"><div class="calc-chart-title">Damage distribution <span class="calc-chart-hint">P(exactly k)</span></div>${distChart(A.summed_result)}</div>
      <div class="calc-chart-block"><div class="calc-chart-title">Cumulative <span class="calc-chart-hint">P(k or more)</span></div>${cumChart(A.cumulative_result)}</div>
      ${perRow ? `<div class="calc-rowavgs"><div class="calc-rowavgs-head">Per weapon</div>${perRow}</div>` : ''}`;
  }

  /* ---- full render --------------------------------------------------------- */
  function colW(which, dflt) { try { const v = parseInt(localStorage.getItem('dfc_calc_col_' + which), 10); if (v >= 240 && v <= 620) return v; } catch (e) {} return dflt; }
  function renderStandalone() {
    const el = document.getElementById('view-calc'); if (!el) return;
    el.innerHTML = `
      <div class="calc-standalone">
        <div class="calc-intro"><h1 class="calc-title">Combat Calculator</h1><p class="calc-byline">Damage maths by <a href="https://everlasting-flawless-engineering.anvil.app" target="_blank" rel="noopener">Jafdy</a>.</p></div>
        <div class="calc-grid">
          <section class="calc-col calc-col-target" id="calc-std-target" style="flex:0 0 ${colW('t', 330)}px">${targetPanel(std, 'std')}</section>
          <div class="calc-vsplit" title="Drag to resize" onmousedown="Calc.startColResize(event,'t')"></div>
          <section class="calc-col calc-col-weapons" id="calc-std-weapons" style="flex:1 1 0">${weaponsPanel(std, 'std')}</section>
          <div class="calc-vsplit" title="Drag to resize" onmousedown="Calc.startColResize(event,'w')"></div>
          <section class="calc-col calc-col-results" id="calc-std-results-col">
            <div class="calc-panel-title">Result</div>
            <div id="calc-std-results">${resultsHtml(std)}</div>
            <div class="calc-configcode">
              <label class="calc-field"><span>Config code</span><input class="calc-select" id="calc-std-code" value="${esc(D.exports([sitFromState(std), ptFromState(std)], std.weapons.filter(r=>r.active).map(r=>[rowToWsit(r), rowToPW(r)])) || '')}"></label>
              <div class="calc-code-btns"><button class="btn btn-outline btn-sm" onclick="Calc.loadCode('std')">Load</button><button class="btn btn-outline btn-sm" onclick="Calc.copyLink('std')">Copy link</button></div>
            </div>
          </section>
        </div>
      </div>`;
  }
  function renderBuilder() {
    const el = document.getElementById('builder-calc'); if (!el) return;
    try { const w = parseInt(localStorage.getItem('dfc_calc_pane_w'), 10); if (w >= 300 && w <= 680) el.style.width = w + 'px'; } catch (e) {}
    el.innerHTML = `
      <div class="calc-builder">
        <div class="calc-resize-handle" title="Drag to resize" onmousedown="Calc.startResize(event)"></div>
        <div class="calc-builder-head"><span class="calc-builder-title">Combat Calculator</span><button class="calc-builder-close" title="Close" onclick="Calc.closeBuilder()"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>
        <div class="calc-builder-body">
          <section id="calc-bld-target">${targetPanel(bld, 'bld')}</section>
          <section id="calc-bld-weapons">${weaponsPanel(bld, 'bld')}</section>
          <section class="calc-col-results"><div class="calc-panel-title">Result</div><div id="calc-bld-results">${resultsHtml(bld)}</div></section>
          <div class="calc-builder-foot"><button class="btn btn-ghost btn-sm" onclick="Calc.openFull()">Open full calculator</button></div>
        </div>
      </div>`;
  }
  function rerenderResults(scope) { const n = document.getElementById(scope === 'bld' ? 'calc-bld-results' : 'calc-std-results'); if (n) n.innerHTML = resultsHtml(st(scope)); updateCode(scope); persist(scope); }
  function rerenderTarget(scope) { const n = document.getElementById(scope === 'bld' ? 'calc-bld-target' : 'calc-std-target'); if (n) n.innerHTML = targetPanel(st(scope), scope); rerenderResults(scope); }
  function rerenderWeapons(scope) { const n = document.getElementById(scope === 'bld' ? 'calc-bld-weapons' : 'calc-std-weapons'); if (n) n.innerHTML = weaponsPanel(st(scope), scope); rerenderResults(scope); }
  function updateCode(scope) {
    if (scope !== 'std') return; const inp = document.getElementById('calc-std-code'); if (!inp) return;
    const s = st(scope); const code = D.exports([sitFromState(s), ptFromState(s)], s.weapons.filter(r => r.active).map(r => [rowToWsit(r), rowToPW(r)]));
    inp.value = code || '';
  }

  /* ---- persistence + builder special parsing ------------------------------- */
  function persist(scope) { try { localStorage.setItem('dfc_calc_' + scope, JSON.stringify({ t: st(scope).targetPreset, code: document.getElementById(scope === 'std' ? 'calc-std-code' : '')?.value }) ); } catch (e) {} }

  function parseBuilderWeapon(w) {
    const sp = w.special || '';
    const num = re => { const m = sp.match(re); return m ? parseInt(m[1], 10) : 0; };
    const cal = (sp.match(/Calibre-([A-Z/]+)/i) || [, ''])[1].toUpperCase();
    const pw = D.PresetWeapon(pInt(w.attack, 1), (pInt(w.lock, 4) || 4), pInt(w.damage, 1), (w.type === 'E' || w.type === 'K' || w.type === 'C') ? w.type : 'C', {
      burnthrough: num(/Burnthrough-(\d+)/i), reave: num(/Reave-(\d+)/i), critical: num(/Critical-(\d+)/i), scald: num(/Scald-(\d+)/i),
      penetrator: /\bPenetrator\b/i.test(sp), crippling: /\bCrippling\b/i.test(sp), caw: /Close Action/i.test(sp),
      bombardment: /\bBombardment\b/i.test(sp), mauler: /\bMauler\b/i.test(sp),
      calibre: ['L', 'M', 'H', 'C'].filter(x => cal.indexOf(x) !== -1),
      a2a: /Air to Air/i.test(sp), escape: /Escape Velocity/i.test(sp), entry: /Re-?Entry/i.test(sp),
      fusillade: num(/Fusillade-(\d+)/i), overcharge: /\bOvercharge\b/i.test(sp), sustained: /Sustained Fire/i.test(sp)
    });
    const volley = num(/Volley-(\d+)/i) || 1;
    const row = rowFromPW(pw, D.WeaponSituation({ number: volley }), 'Custom');
    row.name = w.name;
    row.arc = w.arc || '';
    return row;
  }

  /* ---- public API ---------------------------------------------------------- */
  const Calc = {
    openStandalone(param) {
      renderStandalone();
      if (param) { try { setStateFromCode(std, param); } catch (e) {} renderStandalone(); }
    },
    addBuilderWeapon(btn) {
      const w = { name: btn.getAttribute('data-cn'), attack: btn.getAttribute('data-ca'), lock: btn.getAttribute('data-cl'), damage: btn.getAttribute('data-cd'), type: btn.getAttribute('data-ct'), special: btn.getAttribute('data-cs'), arc: btn.getAttribute('data-carc') };
      try { bld.faction = App.getCalcData().currentFaction; } catch (e) {}
      bld.weapons.push(parseBuilderWeapon(w));
      this.openBuilderPane();
    },
    openBuilderPane() { const p = document.getElementById('builder-calc'), l = document.getElementById('builder-layout'); if (p) p.classList.remove('hidden'); if (l) l.classList.add('calc-open'); renderBuilder(); },
    closeBuilder() { const p = document.getElementById('builder-calc'), l = document.getElementById('builder-layout'); if (p) p.classList.add('hidden'); if (l) l.classList.remove('calc-open'); },
    openFull() { std.targetPreset = bld.targetPreset; std.type = bld.type; std.pt = Object.assign({}, bld.pt); std.sit = Object.assign({}, bld.sit); std.weapons = bld.weapons.map(r => JSON.parse(JSON.stringify(r))); App.navigate('calc'); },

    setType(scope, v) { st(scope).type = v; rerenderResults(scope); },
    setPT(scope, k, v) { const s = st(scope); if (k === 'weight') s.pt.weight = v; else if (k === 'descent' || k === 'reinforced') s.pt[k] = !!v; else s.pt[k] = pInt(v, 7); rerenderResults(scope); },
    setSit(scope, k, v) { const s = st(scope); s.sit[k] = !!v; if (k === 'fullFighters') return rerenderTarget(scope); rerenderResults(scope); },
    setSitNum(scope, k, v) { const s = st(scope); const n = pInt(v, 0); s.sit[k] = n; s.sit[k + 'On'] = n > 0; rerenderResults(scope); },
    setActive(scope, idx, v) { st(scope).weapons[idx].active = !!v; rerenderWeapons(scope); },
    setStat(scope, idx, k, v) { const r = st(scope).weapons[idx]; if (k === 'type') r.type = v; else if (k === 'lock') r.lock = pInt(v, 4); else r[k] = Math.max(k === 'damage' ? 0 : 1, pInt(v, 1)); rerenderResults(scope); },
    setRule(scope, idx, k, v) { st(scope).weapons[idx][k].on = !!v; rerenderWeapons(scope); },
    setRuleVal(scope, idx, k, v) { st(scope).weapons[idx][k].val = Math.max(1, pInt(v, 1)); rerenderResults(scope); },
    setFlag(scope, idx, k, v) { st(scope).weapons[idx][k] = !!v; rerenderWeapons(scope); },
    setCal(scope, idx, k, v) { st(scope).weapons[idx].calibre[k] = !!v; rerenderWeapons(scope); },
    setWsit(scope, idx, k, v) { const r = st(scope).weapons[idx]; if (k === 'number') r.wsit.number = Math.max(1, pInt(v, 1)); else if (k === 'calypso') r.wsit.calypso = Math.max(-4, Math.min(4, pInt(v, 0))); else r.wsit[k] = !!v; rerenderWeapons(scope); },
    addCustomWeapon(scope) { st(scope).weapons.push(defaultRow()); rerenderWeapons(scope); },
    removeWeapon(scope, idx) { st(scope).weapons.splice(idx, 1); rerenderWeapons(scope); },

    chooseTargetPreset(scope, name) {
      const s = st(scope);
      if (!name) { s.targetPreset = 'Custom'; rerenderTarget(scope); return; }
      const imp = D.importTarget(D.target_coded[name]); if (!imp) return;
      const [atk, pt] = imp; s.targetPreset = name;
      s.pt = { weight: pt.weight, ES: pt.ES, KS: pt.KS, BS: pt.BS, SS: pt.SS, descent: pt.descent, reinforced: pt.reinforced };
      s.type = pt.city ? 'City' : (pt.station ? 'Station' : 'Ship');
      // adopt the preset's situational defaults (WF/close etc.)
      s.sit = Object.assign(s.sit, { aegisOn: atk.aegis > 0, aegis: atk.aegis, fullFighters: atk.fighters === Infinity, fightersOn: atk.fighters > 0 && atk.fighters !== Infinity, fighters: atk.fighters === Infinity ? 0 : atk.fighters, opal: atk.opal, WF: atk.WF, attacker_atmo: atk.attacker_atmo, target_atmo: atk.target_atmo, defences_offline: atk.defences_offline, close: atk.close, grouped: atk.grouped, impetuous: atk.impetuous });
      rerenderTarget(scope);
    },
    chooseWeaponPreset(scope, idx, name) {
      const s = st(scope); const cur = s.weapons[idx]; if (!cur) return;
      if (!name) { cur.preset = 'Custom'; rerenderWeapons(scope); return; }
      const imp = D.importWeapon(D.weapon_coded[name]); if (!imp) return;
      const [wsit, pw] = imp; const row = rowFromPW(pw, wsit, name); row.active = cur.active;
      s.weapons[idx] = row; rerenderWeapons(scope);
    },

    loadCode(scope) {
      const inp = document.getElementById('calc-std-code'); if (!inp) return;
      try { setStateFromCode(st(scope), inp.value.trim()); renderStandalone(); }
      catch (e) { inp.value = 'invalid code'; }
    },
    copyLink(scope) {
      const s = st(scope); const code = D.exports([sitFromState(s), ptFromState(s)], s.weapons.filter(r => r.active).map(r => [rowToWsit(r), rowToPW(r)]));
      if (code === false) return;
      const url = location.origin + location.pathname + '#calc/' + code;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showCopied(), () => prompt('Copy', url)); else prompt('Copy', url);
    },

    // combobox
    comboFilter(scope, kind, q) {
      const list = document.getElementById('combo-' + scope + '-' + kind + '-list'); if (!list) return;
      const names = kind === 'target' ? TARGET_NAMES : WEAPON_NAMES;
      q = (q || '').trim().toLowerCase(); const terms = q.split(/\s+/).filter(Boolean);
      const matches = terms.length ? names.filter(n => { const h = n.toLowerCase(); return terms.every(w => h.indexOf(w) !== -1); }) : names;
      const cap = 60, shown = matches.slice(0, cap), keys = [];
      let html = `<div class="calc-combo-item calc-combo-custom" onmousedown="event.preventDefault();Calc.comboPick('${scope}','${kind}','')">Custom</div>`; keys.push('');
      shown.forEach(n => { html += `<div class="calc-combo-item" onmousedown="event.preventDefault();Calc.comboPick('${scope}','${kind}',${JSON.stringify(n).replace(/"/g, '&quot;')})"><span class="calc-combo-name">${esc(n)}</span></div>`; keys.push(n); });
      if (terms.length && !shown.length) html += `<div class="calc-combo-empty">No match.</div>`; else if (matches.length > cap) html += `<div class="calc-combo-more">${matches.length - cap} more, keep typing.</div>`;
      list.innerHTML = html; list.classList.add('open'); _combo[scope + kind] = { keys, active: -1 };
    },
    comboKey(scope, kind, ev) {
      const stt = _combo[scope + kind], list = document.getElementById('combo-' + scope + '-' + kind + '-list'); if (!stt || !list) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); if (!list.classList.contains('open')) return this.comboFilter(scope, kind, ev.target.value); stt.active += ev.key === 'ArrowDown' ? 1 : -1; if (stt.active < 0) stt.active = stt.keys.length - 1; if (stt.active >= stt.keys.length) stt.active = 0; const items = list.querySelectorAll('.calc-combo-item'); items.forEach((e, i) => e.classList.toggle('active', i === stt.active)); if (items[stt.active]) items[stt.active].scrollIntoView({ block: 'nearest' }); }
      else if (ev.key === 'Enter') { if (stt.active >= 0) { ev.preventDefault(); this.comboPick(scope, kind, stt.keys[stt.active]); ev.target.blur(); } }
      else if (ev.key === 'Escape') list.classList.remove('open');
    },
    comboPick(scope, kind, name) {
      if (kind === 'target') this.chooseTargetPreset(scope, name);
      else this.chooseWeaponPreset(scope, parseInt(kind.slice(1), 10), name);
      const list = document.getElementById('combo-' + scope + '-' + kind + '-list'); if (list) { list.innerHTML = ''; list.classList.remove('open'); }
    },
    comboBlur(scope, kind) { setTimeout(() => { const l = document.getElementById('combo-' + scope + '-' + kind + '-list'); if (l) l.classList.remove('open'); }, 150); },

    startResize(ev) { ev.preventDefault(); const pane = document.getElementById('builder-calc'); if (!pane) return; const right = pane.getBoundingClientRect().right; const move = e => { let w = right - e.clientX; w = Math.max(300, Math.min(680, w)); pane.style.width = w + 'px'; }; const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; try { localStorage.setItem('dfc_calc_pane_w', parseInt(pane.style.width, 10)); } catch (e) {} }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); document.body.style.userSelect = 'none'; },
    startColResize(ev, which) { ev.preventDefault(); const col = document.getElementById(which === 't' ? 'calc-std-target' : 'calc-std-weapons'); if (!col) return; const sx = ev.clientX, sw = col.getBoundingClientRect().width; const move = e => { let w = sw + (e.clientX - sx); w = Math.max(240, Math.min(620, w)); col.style.flex = '0 0 ' + w + 'px'; }; const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; try { localStorage.setItem('dfc_calc_col_' + which, Math.round(col.getBoundingClientRect().width)); } catch (e) {} }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); document.body.style.userSelect = 'none'; }
  };

  function setStateFromCode(s, code) {
    const [attack, weapons] = D.imports(code);
    if (attack === false) throw new Error('bad code');
    const [atk, pt] = attack;
    // try to name the target/weapons from the reverse tables (first match)
    const tcode = code.split('-')[0];
    s.targetPreset = (D.target_code_names[tcode] && D.target_code_names[tcode][0]) || 'Custom';
    s.pt = { weight: pt.weight, ES: pt.ES, KS: pt.KS, BS: pt.BS, SS: pt.SS, descent: pt.descent, reinforced: pt.reinforced };
    s.type = pt.city ? 'City' : (pt.station ? 'Station' : 'Ship');
    s.sit = { aegisOn: atk.aegis > 0, aegis: atk.aegis, fullFighters: atk.fighters === Infinity, fightersOn: atk.fighters > 0 && atk.fighters !== Infinity, fighters: atk.fighters === Infinity ? 0 : atk.fighters, opal: atk.opal, WF: atk.WF, attacker_atmo: atk.attacker_atmo, target_atmo: atk.target_atmo, defences_offline: atk.defences_offline, close: atk.close, grouped: atk.grouped, impetuous: atk.impetuous, shielded: false };
    const wcodes = code.split('-').slice(1).map(x => 'a' + x.slice(1));
    s.weapons = weapons.map((w, i) => {
      const [wsit, pw] = w; const nm = (D.weapon_code_names[wcodes[i]] && D.weapon_code_names[wcodes[i]][0]) || 'Custom';
      return rowFromPW(pw, wsit, nm);
    });
  }
  function showCopied() { const b = document.querySelector('.calc-code-btns .btn:last-child'); if (!b) return; const o = b.innerHTML; b.innerHTML = 'Copied'; setTimeout(() => { b.innerHTML = o; }, 1400); }

  window.Calc = Calc;
})();
