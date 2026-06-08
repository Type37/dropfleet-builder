/* ─────────────────────────────────────────────────────────────────────────
   Rank insignia — shared by the desktop (js/app.js) and mobile (mobile/js/
   mobile.js) builders so the icons never drift between the two apps.

   RankInsignia(factionKey, level, sizePx?) -> inline <svg> string.

   One motif per faction, `level` (1–5) marks stacked centre-aligned (more
   marks = higher rank, like real insignia). Single faction-accent colour so it
   reads on light and dark. Faction → motif:
     ucm        US-Navy gold bars
     resistance Royal-Navy bars + executive curl on the top bar
     phr        post-human geometric up-chevrons
     scourge    organic spine / growth-ripple lines
     shaltari   crystalline diamond pips
     bioficer   cold data-dot rows  (Jet's "Directorate" brief — the 6th
                faction in this builder is Bioficer; dots double as bio cells)
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  const COLOR = {
    ucm: '#3e9945', phr: '#B8952F', scourge: '#c43c2f',
    shaltari: '#d98c1f', bioficer: '#2a8c8c', resistance: '#2a6099'
  };
  const LABEL = {
    ucm: 'UCM', phr: 'PHR', scourge: 'Scourge',
    shaltari: 'Shaltari', bioficer: 'Bioficer', resistance: 'Resistance'
  };

  // Centre-aligned y positions for n marks (i=0 is the bottom mark).
  function rows(n) {
    const step = 4, cy = 12, ys = [];
    for (let i = 0; i < n; i++) ys.push(cy + ((n - 1) / 2 - i) * step);
    return ys;
  }

  // Per-faction mark drawn around centre (12, y). (y, i, n, color) -> svg.
  const MARK = {
    ucm: (y, i, n, c) => `<rect x="4" y="${y - 1.4}" width="16" height="2.8" rx="0.6" fill="${c}"/>`,
    resistance: (y, i, n, c) =>
      `<rect x="4" y="${y - 1.3}" width="16" height="2.6" rx="0.6" fill="${c}"/>` +
      (i === n - 1 ? `<circle cx="6" cy="${y}" r="2.4" fill="none" stroke="${c}" stroke-width="1.3"/>` : ''),
    phr: (y, i, n, c) =>
      `<path d="M5 ${y + 2.2} L12 ${y - 2.2} L19 ${y + 2.2}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    scourge: (y, i, n, c) =>
      `<path d="M4 ${y} q3.5 -3 7 0 t7 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
    shaltari: (y, i, n, c) =>
      `<path d="M12 ${y - 2.7} L15.6 ${y} L12 ${y + 2.7} L8.4 ${y} Z" fill="${c}"/>`,
    bioficer: (y, i, n, c) =>
      `<circle cx="7" cy="${y}" r="1.5" fill="${c}"/><circle cx="12" cy="${y}" r="1.5" fill="${c}"/><circle cx="17" cy="${y}" r="1.5" fill="${c}"/>`
  };

  function rankInsignia(faction, level, sizePx) {
    const c = COLOR[faction] || '#777';
    const mark = MARK[faction] || MARK.ucm;
    const n = Math.max(1, Math.min(5, parseInt(level, 10) || 1));
    const s = sizePx || 20;
    const marks = rows(n).map((y, i) => mark(y, i, n, c)).join('');
    return `<svg class="rank-insignia rank-${faction}" viewBox="0 0 24 24" width="${s}" height="${s}" ` +
      `role="img" aria-label="${LABEL[faction] || faction} rank — Level ${n}" ` +
      `xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;
  }

  window.RankInsignia = rankInsignia;
})();
