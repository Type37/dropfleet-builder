/* Scenario reference shell, shared by the Dropfleet and Dropzone scenario pages.

   ScenarioShell.start(game) draws the index (grouped by book, with search, Random
   and fact columns) and a scenario view (the game's own card, a round and VP
   tracker kept per scenario on this device, share and print), routed by #id.

   game = {
     storageKey: 'dfc',                         // prefix for the tracker's saved state
     titleSuffix: 'Dropfleet Commander Scenarios',  // after a scenario's name in the tab title
     indexDocTitle: 'Dropfleet Commander: Scenarios',
     indexTitle: 'Scenarios',
     groups: [{ name, items: [scenario] }],     // in display order
     id: s => s.id, name: s => s.name,
     thumb: s => url or '',                     // map thumbnail for the index
     columns: [{ label, values: s => [strings] }],
     randomPool: s => true,                     // which scenarios Random may land on
     render: s => html,                         // the scenario card
     markRound: (s, round) => true/false,       // gold mark on the round counter (a scoring round)
     views: { d66: { label, title, render: () => html } },  // optional extra pages, linked from the index, routed by #key
   }
   Markup expected on the page: <main id="app"></main>. */
const ScenarioShell = (() => {
  const ICON = {
    die: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17"/><circle cx="8.3" cy="8.3" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.7" cy="8.3" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.3" cy="15.7" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.5" fill="currentColor" stroke="none"/></svg>',
    share: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v8h14v-8"/></svg>',
    done: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    print: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z"/></svg>',
    diamond: '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="#B8952F" stroke-width="1.5"/><polygon points="8,5 11,8 8,11 5,8" fill="#B8952F" opacity="0.28"/></svg>',
    mark: '<svg class="vp-dm" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 15,8 8,15 1,8" fill="#B8952F"/></svg>',
  };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let G, app, query = '';
  const all = () => G.groups.flatMap(g => g.items);

  /* ── Index ── */
  function cell(label, vals) {
    return `<span class="scn-f">${vals.length ? `<span class="scn-fl">${label}</span>` : ''}${vals.map(v => `<span>${v}</span>`).join('')}</span>`;
  }
  function groupsHTML() {
    const q = query.trim().toLowerCase();
    const cols = G.columns;
    return G.groups.map(g => {
      const list = g.items.filter(s => !q || [G.name(s), ...cols.flatMap(c => c.values(s))].join(' ').toLowerCase().includes(q));
      if (!list.length) return '';
      return `<section class="book"><h2 class="book-h">${ICON.diamond}${g.name}</h2>
        <div class="scn-cols" aria-hidden="true"><span>Scenario</span>${cols.map(c => `<span>${c.label}</span>`).join('')}</div>
        <ul class="scn-list">${list.map(s => {
          const t = G.thumb(s);
          return `<li><a class="scn" href="#${G.id(s)}">${t ? `<img class="scn-map" src="${t}" alt="" loading="lazy" width="72" height="72">` : '<span class="scn-map"></span>'}<span class="scn-name">${G.name(s)}</span>${cols.map(c => cell(c.label, c.values(s))).join('')}</a></li>`;
        }).join('')}</ul></section>`;
    }).join('');
  }
  function renderIndex() {
    document.title = G.indexDocTitle;
    document.body.classList.remove('has-trk');
    app.innerHTML = `<div class="idx" style="--cols:${G.columns.length}">
      <div class="idx-head">
        <h1 class="idx-h">${G.indexTitle}</h1>
        <div class="idx-tools">
          <input id="q" type="search" placeholder="Search" aria-label="Search scenarios" autocomplete="off" value="${esc(query)}">
          <button class="btn" id="rand">${ICON.die}Random</button>
          ${Object.entries(G.views || {}).map(([k, v]) => `<a class="btn btn-quiet" href="#${k}">${v.label}</a>`).join('')}
        </div>
      </div>
      <div id="books">${groupsHTML()}</div>
    </div>`;
    document.getElementById('q').addEventListener('input', e => { query = e.target.value; document.getElementById('books').innerHTML = groupsHTML(); });
    document.getElementById('rand').addEventListener('click', () => {
      const pool = all().filter(G.randomPool || (() => true));
      location.hash = G.id(pool[Math.floor(Math.random() * pool.length)]);
    });
  }

  /* ── Tracker: round and VP, kept per scenario on this device ── */
  const key = s => `${G.storageKey}-scenario-track:${G.id(s)}`;
  function load(s) {
    try { const t = JSON.parse(localStorage.getItem(key(s))); if (t && Array.isArray(t.vp)) return t; } catch (e) {}
    return { round: 1, vp: [0, 0] };
  }
  function save(s, t) { try { localStorage.setItem(key(s), JSON.stringify(t)); } catch (e) {} }
  function sizeTrack() {
    const el = document.getElementById('trk');
    if (el) document.documentElement.style.setProperty('--trk-h', el.getBoundingClientRect().height + 'px');
  }
  function drawTrack(s, t) {
    const el = document.getElementById('trk');
    if (!el) return;
    const mark = G.markRound && G.markRound(s, t.round) ? ICON.mark : '';
    el.innerHTML = `<div class="trk-g"><span class="trk-l">Round</span><button data-a="r-" aria-label="Previous round">−</button><output aria-live="polite">${t.round}${mark}</output><button data-a="r+" aria-label="Next round">+</button></div>
      ${t.vp.map((v, i) => `<div class="trk-g"><span class="trk-l">Player ${i + 1}</span><button data-a="v-" data-p="${i}" aria-label="Player ${i + 1} VP down">−</button><output aria-live="polite">${v}</output><button data-a="v+" data-p="${i}" aria-label="Player ${i + 1} VP up">+</button></div>`).join('')}
      ${t.vp.length < 4 ? '<button class="trk-plain" data-a="p+">Add player</button>' : ''}
      ${t.vp.length > 2 ? '<button class="trk-plain" data-a="p-">Remove player</button>' : ''}
      <button class="trk-plain" data-a="clear">Clear</button>`;
    sizeTrack();
  }
  function wireTrack(s) {
    let t = load(s);
    drawTrack(s, t);
    document.getElementById('trk').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a, p = b.dataset.p;
      switch (a) {
        case 'r-': t.round = Math.max(1, t.round - 1); break;
        case 'r+': t.round++; break;
        case 'v-': t.vp[+p]--; break;
        case 'v+': t.vp[+p]++; break;
        case 'p+': if (t.vp.length < 4) t.vp.push(0); break;
        case 'p-': if (t.vp.length > 2) t.vp.pop(); break;
        case 'clear': t = { round: 1, vp: t.vp.map(() => 0) }; break;
      }
      save(s, t);
      drawTrack(s, t);
      const again = document.querySelector(`#trk button[data-a="${a}"]${p !== undefined ? `[data-p="${p}"]` : ''}`);
      if (again) again.focus();
    });
  }

  /* ── Scenario ── */
  function renderOne(s) {
    document.title = `${G.name(s)}: ${G.titleSuffix}`;
    document.body.classList.add('has-trk');
    app.innerHTML = `<div class="bar"><div class="bar-in">
        <a class="bar-back" href="#">← All scenarios</a>
        <div class="trk" id="trk"></div>
        <div class="acts">
          <button class="icon-btn" id="share" aria-label="Share">${ICON.share}</button>
          <button class="icon-btn" id="print" aria-label="Print">${ICON.print}</button>
        </div>
      </div></div>
      <article class="sheet">${G.render(s)}</article>`;
    wireTrack(s);
    document.getElementById('print').addEventListener('click', () => window.print());
    document.getElementById('share').addEventListener('click', async e => {
      const b = e.currentTarget, url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: G.name(s), url });
        else {
          await navigator.clipboard.writeText(url);
          b.innerHTML = ICON.done; b.setAttribute('aria-label', 'Link copied');
          setTimeout(() => { b.innerHTML = ICON.share; b.setAttribute('aria-label', 'Share'); }, 1600);
        }
      } catch (err) {}
    });
  }

  /* ── An extra page a game supplies, such as a printable chart ── */
  function renderView(v) {
    document.title = `${v.title}: ${G.titleSuffix}`;
    document.body.classList.remove('has-trk');
    app.innerHTML = `<div class="bar"><div class="bar-in">
        <a class="bar-back" href="#">← All scenarios</a>
        <span></span>
        <div class="acts"><button class="icon-btn" id="print" aria-label="Print">${ICON.print}</button></div>
      </div></div>
      <article class="sheet">${v.render()}</article>`;
    document.getElementById('print').addEventListener('click', () => window.print());
  }

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const s = id && all().find(x => G.id(x) === id);
    const v = id && G.views && G.views[id];
    if (s) renderOne(s); else if (v) renderView(v); else renderIndex();
    window.scrollTo(0, 0);
  }

  return {
    start(game) {
      G = game;
      app = document.getElementById('app');
      addEventListener('hashchange', route);
      addEventListener('resize', sizeTrack);
      route();
    },
  };
})();
