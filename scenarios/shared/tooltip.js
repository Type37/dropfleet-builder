/* Hover, tap or focus a symbol to see what it is.
   Shared by the Dropfleet and Dropzone scenario pages. Any element with a
   data-tip key opens one tooltip: on hover with a mouse, on tap on touch, on
   keyboard focus. The page defines tipHTML(key), which turns a key into the
   tooltip's content; an empty string means no tooltip. */
(function () {
  const css = `
#scn-tip{position:fixed;z-index:500;max-width:300px;background:#0a1e2e;color:#eef2f4;padding:9px 11px;font:400 13px/1.45 'Jost',system-ui,sans-serif;box-shadow:0 8px 24px -8px rgba(0,0,0,.5);pointer-events:none;}
#scn-tip b{color:#fff;font-weight:600;}
#scn-tip .scn-tip-h{display:flex;align-items:center;gap:7px;margin-bottom:4px;font-size:14px;}
#scn-tip .scn-tip-h svg,#scn-tip .scn-tip-h img{width:20px;height:20px;flex:0 0 20px;}
#scn-tip .scn-tip-st{display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px;margin-bottom:4px;}
#scn-tip .ico-stat{width:14px;height:14px;}
#scn-tip .sv-e,#scn-tip .sv-k{color:#f3d98a;font-size:13px;}
@media screen{.tip-t{display:inline-flex;align-items:center;cursor:help;}.tip-t:focus-visible{outline:2px solid #B86C0A;outline-offset:1px;}}
@media print{#scn-tip{display:none !important;}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let tip = null, owner = null, pinned = false;
  const box = () => tip || (tip = Object.assign(document.body.appendChild(document.createElement('div')), { id: 'scn-tip', role: 'tooltip', hidden: true }));
  function show(t) {
    const html = typeof tipHTML === 'function' ? tipHTML(t.dataset.tip) : '';
    if (!html) return;
    const b = box();
    b.innerHTML = html; b.hidden = false; owner = t;
    const r = t.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight, m = 8;
    const x = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), innerWidth - w - m);
    let y = r.top - h - 10;
    if (y < m) y = r.bottom + 10;
    b.style.left = x + 'px';
    b.style.top = Math.min(y, innerHeight - h - m) + 'px';
  }
  function hide() { if (tip) tip.hidden = true; owner = null; pinned = false; }
  const target = e => e.target.closest && e.target.closest('[data-tip]');
  document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse' || pinned) return; const t = target(e); if (t && t !== owner) show(t); });
  document.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse' || pinned) return; const t = target(e); if (t && !t.contains(e.relatedTarget)) hide(); });
  document.addEventListener('click', e => { const t = target(e); if (t) { if (owner === t && pinned) hide(); else { show(t); pinned = true; } } else if (!(tip && tip.contains(e.target))) hide(); });
  document.addEventListener('focusin', e => { const t = target(e); if (t) show(t); });
  document.addEventListener('focusout', e => { if (target(e) && !pinned) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', () => { if (owner) hide(); }, true);
  addEventListener('resize', hide);
})();
