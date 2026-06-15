/* ─────────────────────────────────────────────────────────────────────────
   Rank insignia — shared by the desktop (js/app.js) and mobile (mobile/js/
   mobile.js) builders so the icons never drift between the two apps.

   RankInsignia(factionKey, level, sizePx?) -> inline <svg> string.

   One motif per faction, `level` (1–5) marks stacked centre-aligned (more
   marks = higher rank, like real insignia). Single faction-accent colour so it
   reads on light and dark. Faction → motif:
     ucm        military down-pointing chevrons
     resistance Royal-Navy stripes + a looped executive curl above the top bar
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

  // Centre-aligned y positions for n marks (i=0 is the bottom mark). The marks
  // spread to fill most of the box height so the insignia reads big and bold.
  function rows(n) {
    // Wider spacing for fewer marks so a low rank still fills the box; tighter
    // as marks stack up (cap the total span ~18 units of the 24 viewBox).
    const span = 18, cy = 12, ys = [];
    const step = n > 1 ? Math.min(5, span / (n - 1)) : 0;
    for (let i = 0; i < n; i++) ys.push(cy + ((n - 1) / 2 - i) * step);
    return ys;
  }

  // Per-faction mark drawn around centre (12, y) — bold, near-full-width so the
  // motif fills the thumbnail. (y, i, n, color) -> svg.
  const MARK = {
    // UCM: military down-pointing chevrons (distinct from PHR's up-chevrons).
    ucm: (y, i, n, c) =>
      `<path d="M3 ${(y - 2.7).toFixed(1)} L12 ${(y + 2.7).toFixed(1)} L21 ${(y - 2.7).toFixed(1)}" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    // resistance is special-cased (bars + an executive curl loop) — see
    // resistanceInsignia() below.
    phr: (y, i, n, c) =>
      `<path d="M3 ${y + 2.8} L12 ${y - 2.8} L21 ${y + 2.8}" fill="none" stroke="${c}" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>`,
    scourge: (y, i, n, c) =>
      `<path d="M2.5 ${y} q4.875 -4 9.5 0 t9.5 0" fill="none" stroke="${c}" stroke-width="2.9" stroke-linecap="round"/>`,
    shaltari: (y, i, n, c) =>
      `<path d="M12 ${y - 3.6} L16.6 ${y} L12 ${y + 3.6} L7.4 ${y} Z" fill="${c}"/>`
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
    const inset = 0.05;
    return order.slice(0, n).map(pts => {
      const gx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const gy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const p = pts.map(([x, y]) =>
        `${(gx + (x - gx) * (1 - inset)).toFixed(2)},${(gy + (y - gy) * (1 - inset)).toFixed(2)}`).join(' ');
      return `<polygon points="${p}" fill="${c}"/>`;
    }).join('');
  }

  // ── Resistance: Royal-Navy stripes with an executive "curl" loop on top ────
  // n bars packed into the lower band, with a looped curl rising above the top
  // bar (the loopy loop), like a naval officer's rank lace.
  function resistanceInsignia(n, c) {
    const bandTop = 11, bandBottom = 21;
    const ys = [];
    if (n === 1) ys.push(16.5);
    else { const step = (bandBottom - bandTop) / (n - 1); for (let i = 0; i < n; i++) ys.push(bandBottom - i * step); }
    const bars = ys.map(y => `<rect x="3" y="${(y - 1.6).toFixed(1)}" width="18" height="3.2" rx="0.8" fill="${c}"/>`).join('');
    const topY = Math.min(...ys);
    // The curl: a loop centred above the top bar with a short tail joining it —
    // reads as the Royal-Navy executive curl.
    const cyL = topY - 5.2;
    const curl = `<circle cx="12" cy="${cyL.toFixed(1)}" r="3" fill="none" stroke="${c}" stroke-width="2"/>` +
      `<path d="M12 ${(cyL + 3).toFixed(1)} L12 ${(topY - 1.6).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
    return bars + curl;
  }

  function rankInsignia(faction, level, sizePx) {
    const c = COLOR[faction] || '#777';
    const mark = MARK[faction] || MARK.ucm;
    const n = Math.max(1, Math.min(5, parseInt(level, 10) || 1));
    const s = sizePx || 20;
    const marks = faction === 'bioficer'
      ? bioficerInsignia(n, c)
      : faction === 'resistance'
        ? resistanceInsignia(n, c)
        : rows(n).map((y, i) => mark(y, i, n, c)).join('');
    return `<svg class="rank-insignia rank-${faction}" viewBox="0 0 24 24" width="${s}" height="${s}" ` +
      `role="img" aria-label="${LABEL[faction] || faction} rank — Level ${n}" ` +
      `xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;
  }

  window.RankInsignia = rankInsignia;
})();
