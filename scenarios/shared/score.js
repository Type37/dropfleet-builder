/* The score sheet: a scenario's scoring as a list you tick and count, with a running VP total.
   Shared by the Dropfleet generator and both games' scenario pages (copied into the Dropzone
   repo by tools/dzc/sync_scenario_shell.py).

     ScoreSheet.mount(el, {key, rows, rounds, markRound, reset}) -> {update(rows)}

   rows, built by the page from the scenario's own words:
     {heading, sub}                                        a heading inside the list
     {text, parts: [{kind: 'count'|'check', vp, label}]}   a rule, one control per VP amount it names

   A count adds vp for every step, a check adds vp once. "Other VP" at the foot takes anything the
   rules do not fix to a number. Round, players and counts are kept per key on this device. */
window.ScoreSheet = (function () {
  const css = `
.ss{background:#fff;border:1px solid #e1d6be;font-family:'Jost',system-ui,sans-serif;color:#0E0C08;}
.ss-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;padding:10px 16px;}
.ss-head .ss-clear{margin-left:auto;}
.ss-toggle{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:none;border:0;padding:0;cursor:pointer;text-align:left;color:inherit;}
.ss-title{font:700 18px/1.2 'Roboto Slab',Georgia,serif;text-transform:uppercase;color:#5A4710;}
.ss-sum{font:400 14px/1.3 'Jost',system-ui,sans-serif;color:#5d5850;}
.ss-chev{width:18px;height:18px;color:#5d5850;transition:transform .15s;}
.ss.closed .ss-chev{transform:rotate(-90deg);}
.ss-clear{font:600 12px/1 'Jost',system-ui,sans-serif;text-transform:uppercase;color:#6b5210;background:none;border:1.5px solid #8a6a12;padding:5px 10px;cursor:pointer;}
.ss-clear:hover{background:#f7f1e6;}
.ss-body{padding:0 16px 14px;}
.ss.closed .ss-body{display:none;}
.ss-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;}
.ss-seg{display:flex;flex-wrap:wrap;align-items:center;gap:2px;}
.ss-l{font-size:13px;color:#5d5850;margin-right:8px;}
.ss-seg button{font:600 14px/1 'Jost',system-ui,sans-serif;min-width:34px;height:32px;padding:0 10px;border:0;background:#f1ece2;color:#3d3834;cursor:pointer;}
.ss-seg button:hover{background:#e6ddcc;}
.ss-seg button[aria-pressed="true"]{background:#d3b27a;color:#0E0C08;}
.ss-seg button.mark{box-shadow:inset 0 -3px 0 #8a6a12;}
.ss-seg .ss-n{font-weight:700;margin-left:8px;}
.ss-rows{list-style:none;margin:0;padding:0;}
.ss-row{display:grid;grid-template-columns:minmax(0,26em) max-content;justify-content:start;align-items:center;gap:6px 32px;padding:6px 0;font-size:15px;line-height:1.45;}
.ss-row .ss-t{flex:1;min-width:0;}
.ss-row b{font-weight:700;}
.ss-h{padding:14px 0 2px;font:700 16px/1.3 'Roboto Slab',Georgia,serif;}
.ss-h span{font:400 13px 'Jost',system-ui,sans-serif;color:#5d5850;margin-left:8px;}
.ss-check{display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;cursor:pointer;}
.ss-box{appearance:none;-webkit-appearance:none;width:18px;height:18px;flex:0 0 18px;margin:3px 0 0;border:1.5px solid #b08a3e;background:#f7f1e6;cursor:pointer;}
.ss-box:checked{background:#8a5a12 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12l5 5L20 7' fill='none' stroke='%23fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/14px no-repeat;border-color:#8a5a12;}
.ss-check:has(.ss-box:checked) .ss-t{text-decoration:line-through;color:#6b6660;}
/* every counter is the same width, so Control and Contest line up down the sheet */
.ss-parts{display:grid;grid-template-columns:repeat(2,max-content);align-items:center;gap:6px 28px;}
.ss-part{display:grid;grid-template-columns:4.2em 92px 6em;align-items:center;gap:8px;white-space:nowrap;}
.ss-part .ss-pl{text-align:right;}
.ss-part .ss-pl{color:#3d3834;}
.ss-step{display:inline-flex;align-items:center;border:1px solid #d8ccb4;}
.ss-step button{width:28px;height:28px;display:grid;place-items:center;border:0;background:#f7f1e6;color:#3d3834;cursor:pointer;padding:0;}
.ss-step button:hover{background:#ece2cf;}
.ss-step svg{width:14px;height:14px;}
.ss-step output{min-width:2.4ch;text-align:center;font-weight:700;}
.ss-vp{font-weight:700;color:#a14a07;white-space:nowrap;}
.ss-total{display:flex;align-items:baseline;gap:16px;padding-top:12px;font-size:15px;color:#5d5850;}
.ss-total b{font:700 30px/1 'Jost',system-ui,sans-serif;color:#a14a07;}
.ss button:focus-visible,.ss-box:focus-visible{outline:2px solid #B86C0A;outline-offset:2px;}
/* phones: a rule's name and its counters share a line, counters stacked on the right, so the sheet stays short */
@media (max-width:640px){.ss-head,.ss-body{padding-left:12px;padding-right:12px;}.ss-row{grid-template-columns:minmax(0,1fr) max-content;gap:4px 10px;padding:4px 0;font-size:14px;}.ss-parts{grid-template-columns:max-content;gap:4px;}.ss-part{grid-template-columns:auto 84px 3.2em;gap:6px;}.ss-each{display:none;}.ss-step button{width:26px;height:28px;}.ss-h{padding-top:10px;}}
@media print{.ss{display:none !important;}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Tabler Icons (MIT), via Iconify
  const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const MINUS = icon('M5 12h14'), PLUS = icon('M12 5v14m-7-7h14'), CHEV = 'M6 9l6 6l6-6';
  const plain = t => String(t).replace(/<[^>]+>/g, '');
  const idOf = (row, j) => plain(row.text).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '#' + j;
  const vpText = (p) => `${p.vp} VP${p.kind === 'count' ? '<span class="ss-each"> each</span>' : ''}`;

  function mount(el, cfg) {
    const rounds = cfg.rounds || 6;
    let rows = cfg.rows || [];
    const load = () => { try { const s = JSON.parse(localStorage.getItem(cfg.key)); if (s && Array.isArray(s.players)) return s; } catch (e) {} return null; };
    const fresh = () => ({ round: 1, active: 0, open: true, players: [{ c: {} }, { c: {} }] });
    let st = (!cfg.reset && load()) || fresh();
    if (cfg.reset) { const old = load(); if (old) st.open = old.open; }
    const save = () => { try { localStorage.setItem(cfg.key, JSON.stringify(st)); } catch (e) {} };

    function total(p) {
      let t = +(p.c.other || 0);
      rows.forEach(r => (r.parts || []).forEach((part, j) => { t += part.vp * (+(p.c[idOf(r, j)] || 0)); }));
      return t;
    }
    function draw() {
      const p = st.players[st.active];
      const control = (r, part, j) => {
        const id = idOf(r, j), n = +(p.c[id] || 0);
        if (part.kind === 'check') return '';
        return `<span class="ss-part"><span class="ss-pl">${part.label || ''}</span><span class="ss-step"><button type="button" data-step="-1" data-id="${id}" aria-label="One fewer">${MINUS}</button><output>${n}</output><button type="button" data-step="1" data-id="${id}" aria-label="One more">${PLUS}</button></span><span class="ss-vp">${vpText(part)}</span></span>`;
      };
      const rowHTML = r => {
        if (r.heading) return `<li class="ss-h">${r.heading}${r.sub ? `<span>${r.sub}</span>` : ''}</li>`;
        const parts = r.parts || [];
        // a rule scored once, for one amount, is a tick box; anything else gets a counter per amount
        if (parts.length === 1 && parts[0].kind === 'check') {
          const id = idOf(r, 0);
          return `<li class="ss-row"><label class="ss-check"><input class="ss-box" type="checkbox" data-id="${id}"${p.c[id] ? ' checked' : ''}><span class="ss-t">${r.text}</span></label><span class="ss-vp">${vpText(parts[0])}</span></li>`;
        }
        const boxes = parts.map((part, j) => part.kind === 'check'
          ? `<span class="ss-part"><span class="ss-pl"></span><input class="ss-box" type="checkbox" data-id="${idOf(r, j)}" aria-label="${part.vp} VP"${p.c[idOf(r, j)] ? ' checked' : ''}><span class="ss-vp">${vpText(part)}</span></span>`
          : control(r, part, j)).join('');
        return `<li class="ss-row"><span class="ss-t">${r.text}</span><span class="ss-parts">${boxes}</span></li>`;
      };
      const other = +(p.c.other || 0);
      const scores = st.players.map(total);
      el.innerHTML = `<section class="ss${st.open ? '' : ' closed'}" aria-label="Score">
        <div class="ss-head">
          <button type="button" class="ss-toggle" aria-expanded="${st.open}"><svg class="ss-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="${CHEV}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="ss-title">Score</span>${st.open ? '' : `<span class="ss-sum">Round ${st.round} · ${scores.map(s => s + 'VP').join('–')}</span>`}</button>
          ${st.open ? `<div class="ss-bar">
            <div class="ss-seg" role="group" aria-label="Round"><span class="ss-l">Round</span>${Array.from({ length: rounds }, (_, i) => i + 1).map(r => `<button type="button" data-round="${r}" aria-pressed="${r === st.round}"${cfg.markRound && cfg.markRound(r) ? ' class="mark"' : ''}>${r}</button>`).join('')}</div>
            <div class="ss-seg" role="group" aria-label="Player">${st.players.map((_, i) => `<button type="button" data-player="${i}" aria-pressed="${i === st.active}">Player ${i + 1}<span class="ss-n">${scores[i]}VP</span></button>`).join('')}${st.players.length < 4 ? `<button type="button" data-add aria-label="Add a player">${PLUS}</button>` : ''}${st.players.length > 2 ? `<button type="button" data-remove aria-label="Remove the last player">${MINUS}</button>` : ''}</div>
          </div>` : ''}
          <button type="button" class="ss-clear">Clear</button>
        </div>
        <div class="ss-body">
          <ul class="ss-rows">${rows.map(rowHTML).join('')}
            <li class="ss-row"><span class="ss-t">Other VP</span><span class="ss-parts"><span class="ss-part"><span class="ss-pl"></span><span class="ss-step"><button type="button" data-step="-1" data-id="other" aria-label="One fewer">${MINUS}</button><output>${other}</output><button type="button" data-step="1" data-id="other" aria-label="One more">${PLUS}</button></span></span></span></li>
          </ul>
          <div class="ss-total"><span>VP scored, Player ${st.active + 1}</span><b>${scores[st.active]}</b></div>
        </div>
      </section>`;
      el.querySelectorAll('.ss-seg button svg,.ss-step svg').forEach(s => { s.style.width = '14px'; s.style.height = '14px'; });
    }
    function refocus(sel) { const t = sel && el.querySelector(sel); if (t) t.focus(); }
    // mounting again on the same element (a new roll) replaces the old sheet's listeners
    if (el._ssOff) el._ssOff();
    const onClick = e => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      const p = st.players[st.active];
      let focus = null;
      if (b.classList.contains('ss-toggle')) { st.open = !st.open; focus = '.ss-toggle'; }
      else if (b.classList.contains('ss-clear')) { const open = st.open; st = fresh(); st.open = open; focus = '.ss-clear'; }
      else if (b.dataset.round) { st.round = +b.dataset.round; focus = `[data-round="${b.dataset.round}"]`; }
      else if (b.dataset.player) { st.active = +b.dataset.player; focus = `[data-player="${b.dataset.player}"]`; }
      else if (b.hasAttribute('data-add')) { st.players.push({ c: {} }); st.active = st.players.length - 1; focus = `[data-player="${st.active}"]`; }
      else if (b.hasAttribute('data-remove')) { st.players.pop(); st.active = Math.min(st.active, st.players.length - 1); focus = '[data-add]'; }
      else if (b.dataset.step) { const id = b.dataset.id; p.c[id] = Math.max(id === 'other' ? -999 : 0, (+(p.c[id] || 0)) + (+b.dataset.step)); focus = `[data-id="${id}"][data-step="${b.dataset.step}"]`; }
      else return;
      save(); draw(); refocus(focus);
    };
    const onChange = e => {
      const box = e.target.closest('.ss-box');
      if (!box) return;
      st.players[st.active].c[box.dataset.id] = box.checked ? 1 : 0;
      save(); draw(); refocus(`.ss-box[data-id="${box.dataset.id}"]`);
    };
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el._ssOff = () => { el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); };
    save();
    draw();
    return { update(next) { rows = next || []; draw(); } };
  }
  return { mount };
})();
