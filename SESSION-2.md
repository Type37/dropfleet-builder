# Session 2 — Status & Todos

## Status

### Commits This Session (5 pushed to master)

1. **`4b28f8b`** — Add hero ship art to faction showcase chips on landing page
2. **`4c90822`** — Increase ship art sizes across all views for visual prominence
3. **`a4bc7b1`** — Add inline weapon ability descriptions to print output
4. **`7196db8`** — Sort overview groups by tonnage with category section dividers
5. **`91cdd14`** — Polish fleet cards with faction-color identity system

**Total commits on master: 25.** All pushed to origin.

### What Was Built

- **Landing page faction showcase**: Each faction chip shows 3 hero ship art images in an overlapping strip. Bioficers (no art yet) gets a faction-colored top accent instead.
- **Ship art sizes increased**: `ship-card-image` 100→120px, `group-ship-entry` 140→160px, `overview-group-art` 48→64px, `fleet-card-thumb` 32→40px, `shared-ship-art` 64→80px, `print-ship-art` 56→72px.
- **Print output improved**: Weapon abilities now shown inline on each ship card with "Ship Rules" and "Weapon Abilities" headings. Dashed border separates weapon abilities from ship rules.
- **Overview sorted by tonnage**: Groups sorted colossal→heavy→medium→light→payload. Section dividers inserted when category changes, showing category label, group count, and point subtotal per tonnage class.
- **Fleet cards faction-color system**: Faction color passed as CSS custom property `--fc`. Header gets a subtle faction-tinted gradient. Points number colored by faction. Progress bar uses faction color. Hover borders tint with faction color. Card padding moved to child elements for structured header/body layout.

### Uncommitted Changes

- **Fix redundant category label** in `renderShipSelectCard()` — changed `${data.tonnage} · ${catLabel}` to `${data.tonnage || catLabel}` so it no longer shows "Heavy · Heavy". JS validated, not yet committed.

### Technical Notes

- Dev server: `npx http-server -p 3456 -c-1`
- Cache bust parameter at `?_=89`
- Chrome tab ID was `666369371`
- `color-mix(in srgb, ...)` used in fleet card CSS — requires modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+)
- All 378 ship art WebP files verified present in `assets/art/`

---

## Session 3 Changes (uncommitted)

1. **Fixed doubled lore text** — 27 duplicated "Famous ships of the class" entries in ship-lore.json deduped
2. **Removed AI filler text** — stripped verbose helper text, "Crippled at X" labels, wordy placeholders, stats bar, landing subtitle
3. **Stripped faction-color tinting** — removed colored left borders, gradient headers, tinted points on fleet cards. Neutral navy throughout.
4. **Added Cardo font for lore** — imported from Google Fonts, applied to all lore/rules text. Removed unused Merriweather.
5. **Fixed weapon table alignment** — switched from flex to CSS grid layout with defined column widths
6. **Made Groups button prominent** — full-width dashed button, Groups section moved above Admirals/Space Station in sidebar
7. **Search debouncing** — 120ms debounce on ship search input
8. **Split fleet data by faction** — initial load dropped from 1MB to 18KB index. Factions load on demand (~80-137KB each).
9. **Fastplay starter fleets** — replaced 2000pt demo fleets with official fastplay sheet compositions (Skirmish ~400-485pts) for all 6 factions
10. **Font audit** — Cardo (lore), Jost (body), Roboto Slab (headings), Barlow Condensed (tables). Arkhip (brand) referenced but not loaded (falls back to Roboto Slab). Merriweather dropped.

## Remaining Todos

### User's Session 3 Feedback (not yet addressed)
- [ ] **Fleet construction rules enforcement** — tonnage restrictions (Light ≤ Medium+Heavy, Heavy ≤ Medium), read and internalize all rules
- [ ] **Auxiliary/extra ships in BSData** — identify ships in New Recruit data that aren't in faction stat PDFs, present list to user
- [ ] **Admiral system rework** — three categories: Generic, Faction, Famous. Re-read rules, model after BattleScribe/New Recruit
- [ ] **Verify famous admiral names** — cross-check against Combined Fleet Stats PDFs
- [ ] **Famous admiral ship stats** — when adding a famous admiral, show their flagship with full stats
- [ ] **Starter fleets from fastplay sheets** — replace demo fleets with actual fastplay compositions (UCM 449pts, Scourge 400pts, etc.)
- [ ] **Rethink groups UX** — user wants ship selection merged with Overview, details in right pane
- [ ] **Accessibility and UX audit** — general pass
- [ ] **Arc icons (F/S/R/FN/B)** — user says they exist somewhere, ask if not found
- [ ] **Ship images transparent backgrounds** — user will handle in Affinity
- [ ] **Performance deep work** — 1MB fleet-data.json is unavoidable, but DOM churn from full re-renders needs refactoring

### Standing Backlog
- [ ] **Mobile responsive testing** — CSS exists but needs real device testing
- [ ] **Ship selection modal polish** — minor visual tweaks possible
- [ ] **Settings page** — could add more options

### Verified Complete (do not redo)
- [x] Group mechanic (same ship profile per group)
- [x] Game size visual indicators
- [x] Print output with full rules text inline
- [x] Ship images visually larger and prominent
- [x] No emoji as icons — verified clean
- [x] No rounded pill buttons — verified clean
- [x] Demo fleets updated with current edition data
- [x] Landing page faction showcase with hero ship art
- [x] Overview groups sorted by tonnage with section dividers
- [x] Fleet cards — neutral styling (no faction tinting)
- [x] Share/import/export system (URL, text, JSON, clipboard)
- [x] Doubled lore text fixed
- [x] Cardo font for lore sections
- [x] Weapon table grid alignment
- [x] Groups button prominent, sidebar reordered
- [x] AI filler text removed
