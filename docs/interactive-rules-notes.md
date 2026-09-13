# Interactive Rules — notes & todos

Working notes for the in-app rulebook (desktop `js/app.js` + `css/app.css`, mobile `mobile/js/mobile.js` + `mobile/css/mobile.css`, data `data/rules-wiki.json`). Verbatim rulebook text; only presentation and cross-links are ours.

## Shipped this session (v425–v431)

- **Fewer dividers** — dropped the underline on subsections (`h4.rules-h`) and the left nesting rails; kept the chapter-title bar and per-section (`h3`) bar.
- **Example callout** (`.rules-eg`) lost its left bar.
- **Numbers are navy, not grey** — `.rules-h-n`, `.rules-chapter-n`, `.rules-tok-head` (grey is not in the palette).
- **Tokens in tables** — Feature and Crippling Effect counters drawn inline in their reference tables, name-matched (`TABLE_TOK` / `cellTok`). `clip-path: circle(47%)` crops the transparent margin so no light ring.
- **Dropsites ≠ Features** — token gallery split; **no city icon anywhere** (`dropsite-city` removed — there is no good one).
- **Battalion flavour** — the ~300-troop / Dropzone-scale line.
- **Flavour paragraphs** (`.rules-flavor`, warm serif italic) via `RULES_FLAVOR` fragment match (currently the Orbit "space above planets" line).
- **NB notes** (`.rules-nb`) via `SECTION_NOTES` — "Measure to the center of the dropsite." at ch.11.
- **Chapter 12** — manual generation tables (12.1.1–12.1.4) skipped, replaced by a **Generate a scenario** CTA (`SECTION_CTA` → `scenarios/dropfleet/generator/`); each **Standard Scenario (12.2) is a big button** (name + details) that opens it in the Scenario Reference. Duplicate "Players:" line deduped.
- **Core-term links** — book-section links added: Kill Points → `12.4`, Backup Save → `7.3.4` (Roll to Save), Core hits → `7.3.5` (Inflict Damage).
- **Special Rules glossary** (ch.14) restored as the keyword link target.
- **Mobile parity** — ch.12 (generator link + scenario buttons, previously unreachable on mobile) and ch.11 (table tokens, NB, flavour, term-links).

## Open / todo

- [ ] **Crippling strip redundancy** — 7.3.6 shows tokens BOTH inline in the table AND as the `SECTION_TOKENS['7.3.6']` strip below it. Decide: drop the strip and keep in-table only? (awaiting Jet)
- [ ] **Mobile visual check** — ch.11/12 changes are validated + mirror the verified desktop code, but the mobile rules screen only builds through the app's own menu (Settings → Interactive Rules), which the screenshot harness can't drive. Eyeball on a real phone / the `review` config.
- [ ] **Term-link over-linking** — "Core hits" / "Backup Save(s)" now link on every occurrence. Confirm that reads OK and isn't too busy; bare "Core" is intentionally NOT linked.
- [ ] **Token clip safety** — `clip-path: circle(47%)` assumes token art sits ~46% radius in a 64 box (true for the ones checked). If any counter's art fills the box it'd get clipped — spot-check play-mode / gallery uses.
- [ ] **Changelog debt** — none of this session's Interactive Rules changes are in the in-app changelog (`app.js` + `mobile.js`) or the README changelog yet. See [[feedback_changelog_everywhere]] convention.
- [ ] **`scenario-card.css`** was reformatted by a parallel session (fonts Barlow→Jost). Just noted; nothing to do unless it regressed the scenario weapon/stat styling.

## Handy anchors

- Wiki render: `wikiChapter` / `wikiSection` / `wikiBody` / `wikiTable` (desktop); `mChapter` / `mSection` / `mBody` / `mTable` (mobile).
- Skip list: `RULES_SKIP` (`1.1`, `12.1.1`–`12.1.4`).
- Cross-ref index: `rulesIndex()` / `linkifyRules()` (desktop), `mIndex()` / `mLinkify()` (mobile).
- Tokens: `TOKEN_GROUPS`, `SECTION_TOKENS`, `SECTION_TOKEN_ITEMS`.
- Scenario reference target: `scenarios/dropfleet/#<id>` (desktop), `../scenarios/dropfleet/#<id>` (mobile). Standard-scenario ids are `12.2/<slug>` in the wiki.
