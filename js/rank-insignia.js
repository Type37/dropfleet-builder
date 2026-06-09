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
     bioficer   triangular tessellation that GROWS with rank — L1 = 1 triangle,
                each level adds one more, tiling edge-to-edge into a larger
                subdivided triangle (a fractal Sierpinski-style growth). Reads
                as a self-assembling Directorate sigil. (Bioficer admirals top
                out at L4 = the complete side-2 triangle of 4 sub-triangles.)
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
      `<path d="M12 ${y - 2.7} L15.6 ${y} L12 ${y + 2.7} L8.4 ${y} Z" fill="${c}"/>`
    // bioficer is special-cased (a growing tessellation, not stacked rows) —
    // see bioficerInsignia() below.
  };

  // ── Bioficer: triangular tessellation that grows by level ──────────────
  // A larger upward triangle is subdivided into unit triangles; we reveal one
  // more each level in an edge-adjacent build order, so the sigil assembles
  // itself: L1 apex → L2 rhombus → L3/L4 complete the bigger triangle → L5
  // starts the next row. Each unit triangle is inset toward its centroid so the
  // tile gaps read on any background.
  function bioficerInsignia(n, c) {
    const ub = 6, uh = 5.196, apexY = 5.2, cx = 12;
    // Upward unit triangle at (row r, slot k): apex on the row's top line,
    // base on its bottom line.
    const up = (r, k) => {
      const yT = apexY + (r - 1) * uh, yB = apexY + r * uh;
      const xtL = cx - (r - 1) * ub / 2, xbL = cx - r * ub / 2;
      return [[xtL + k * ub, yT], [xbL + k * ub, yB], [xbL + (k + 1) * ub, yB]];
    };
    // Downward (inverted) unit triangle at (row r, slot k).
    const dn = (r, k) => {
      const yT = apexY + (r - 1) * uh, yB = apexY + r * uh;
      const xtL = cx - (r - 1) * ub / 2;
      return [[xtL + k * ub, yT], [xtL + (k + 1) * ub, yT], [xtL + k * ub + ub / 2, yB]];
    };
    // Edge-adjacent reveal order (index = level - 1).
    const order = [up(1, 0), dn(2, 0), up(2, 0), up(2, 1), dn(3, 0)];
    const inset = 0.09;
    return order.slice(0, n).map(pts => {
      const gx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const gy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const p = pts.map(([x, y]) =>
        `${(gx + (x - gx) * (1 - inset)).toFixed(2)},${(gy + (y - gy) * (1 - inset)).toFixed(2)}`).join(' ');
      return `<polygon points="${p}" fill="${c}"/>`;
    }).join('');
  }

  function rankInsignia(faction, level, sizePx) {
    const c = COLOR[faction] || '#777';
    const mark = MARK[faction] || MARK.ucm;
    const n = Math.max(1, Math.min(5, parseInt(level, 10) || 1));
    const s = sizePx || 20;
    const marks = faction === 'bioficer'
      ? bioficerInsignia(n, c)
      : rows(n).map((y, i) => mark(y, i, n, c)).join('');
    return `<svg class="rank-insignia rank-${faction}" viewBox="0 0 24 24" width="${s}" height="${s}" ` +
      `role="img" aria-label="${LABEL[faction] || faction} rank — Level ${n}" ` +
      `xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;
  }

  window.RankInsignia = rankInsignia;
})();
