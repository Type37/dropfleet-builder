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
    mark: '<svg class="vp-dm" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 15,8 8,15 1,8" fill="#B8952F"/></svg>',
  };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let G, app, query = '', current = null, score = null;
  const all = () => G.groups.flatMap(g => g.items);

  /* ── Index ── */
  function cell(label, vals) {
    return `<span class="scn-f">${vals.length ? `<span class="scn-fl">${label}</span>` : ''}${vals.map((v, i) => `<span>${v}${i < vals.length - 1 ? ',' : ''}</span>`).join('')}</span>`;
  }
  function groupsHTML() {
    const q = query.trim().toLowerCase();
    const cols = G.columns;
    return G.groups.map(g => {
      const list = g.items.filter(s => !q || [G.name(s), ...cols.flatMap(c => c.values(s))].join(' ').toLowerCase().includes(q));
      if (!list.length) return '';
      return `<section class="book"><h2 class="book-h">${g.name}</h2>
        <div class="scn-cols" aria-hidden="true"><span>Scenario</span>${cols.map(c => `<span>${c.label}</span>`).join('')}</div>
        <ul class="scn-list">${list.map(s => {
          const t = G.thumb(s);
          return `<li><a class="scn" href="#${G.id(s)}">${t ? `<img class="scn-map" src="${t}" alt="" loading="lazy" width="72" height="72">` : '<span class="scn-map"></span>'}<span class="scn-name">${G.name(s)}${G.tag && G.tag(s) ? ` <i class="scn-tag">${G.tag(s)}</i>` : ''}</span>${cols.map(c => cell(c.label, c.values(s))).join('')}</a></li>`;
        }).join('')}</ul></section>`;
    }).join('');
  }
  function renderIndex() {
    document.title = G.indexDocTitle;
    app.innerHTML = `<div class="idx" style="--cols:${G.columns.length}">
      <div class="idx-head">
        <h1 class="idx-h">${G.indexTitle}</h1>
        <div class="idx-tools">
          <input id="q" type="search" placeholder="Search" aria-label="Search scenarios" autocomplete="off" value="${esc(query)}">
          ${G.random === false ? '' : `<button class="btn" id="rand">${ICON.die}Random</button>`}
          ${Object.entries(G.views || {}).map(([k, v]) => `<a class="btn btn-quiet" href="#${k}">${v.label}</a>`).join('')}
        </div>
      </div>
      ${G.lead || ''}
      <div id="books">${groupsHTML()}</div>
    </div>`;
    document.getElementById('q').addEventListener('input', e => { query = e.target.value; document.getElementById('books').innerHTML = groupsHTML(); });
    document.getElementById('rand')?.addEventListener('click', () => {
      const pool = all().filter(G.randomPool || (() => true));
      location.hash = G.id(pool[Math.floor(Math.random() * pool.length)]);
    });
  }

  /* ── Scenario ── */
  function renderOne(s) {
    document.title = `${G.name(s)}: ${G.titleSuffix}`;
    app.innerHTML = `<div class="bar"><div class="bar-in">
        <a class="bar-back" href="#">← All scenarios</a>
        ${(src => src ? `<a class="bar-src" href="${src.url}" target="_blank" rel="noopener">Source: ${src.title}</a>` : '<span></span>')(G.source && G.source(s))}
        <div class="acts">
          <button class="icon-btn" id="share" aria-label="Share">${ICON.share}</button>
          <button class="icon-btn" id="print" aria-label="Print">${ICON.print}</button>
        </div>
      </div></div>
      ${G.scoreRows && window.ScoreSheet ? '<div class="sheet ss-host" id="score"></div>' : ''}
      <article class="sheet">${G.render(s)}</article>`;
    current = s;
    if (G.scoreRows && window.ScoreSheet) {
      score = ScoreSheet.mount(document.getElementById('score'), { key: `${G.storageKey}-score:${G.id(s)}`, rows: G.scoreRows(s), markRound: r => !!(G.markRound && G.markRound(s, r)) });
    }
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
    // a page calls this when something it shows changes what can score (a Variant, a game size)
    rescore() { if (score && current) score.update(G.scoreRows(current)); },
    start(game) {
      G = game;
      app = document.getElementById('app');
      addEventListener('hashchange', route);
      route();
    },
  };
})();
