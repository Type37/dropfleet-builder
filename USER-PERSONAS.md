# User Personas & Direction Notes

Consolidated from feedback across sessions. This is the "who are we building for and
how do they think" reference — taste, mental models, working preferences. When a design
decision is ambiguous, check it against these.

---

## Persona 1 — Jet (maintainer / lead user / domain expert)

The person driving the project. A Dropfleet Commander player who knows the game cold and
has strong, specific design taste. Builds lists for real tournament play.

### Who they are
- **Plays Dropfleet Commander.** Lists must be **tournament-legal** — correctness is not optional.
- **Domain authority.** Corrects the model directly when it's wrong (e.g. "a group is NOT a
  flexible thing"). Trust these corrections over assumptions.
- **Has their own assets.** Maintains hand-written TAROT-style ship cards (richer lore than
  BSData), the Arkhip display font, and a mission-maker on neocities. The builder should feel
  of-a-piece with that body of work.
- **Cares deeply about craft.** Notices typography weight, icon quality, panel friction,
  stale caches. Low tolerance for "AI slop."

### Design taste
- **Light theme** — warm off-white + navy, Art Deco gold accents. Deliberate, not bubbly.
- **Hobgoblin-style layout** — clean, dense, print-like ship cards (referenced as the model).
- **Ship art is central**, always visible, big and prominent — not decorative filler.
- **No emoji icons. No rounded pill buttons.** Distinctive geometric icons only (TAROT style:
  radar arcs = Scan, concentric circles = Sig, arrow = Thrust, hexagon = Hull, amber shield+bolt
  = ES, blue shield+crosshair = KS, grey outline shield = BS; weapons colour-coded blue K / amber
  E / red Core).
- **Fonts:** Cardo (lore), Jost (body), Roboto Slab (headings), Barlow Condensed (stat blocks),
  Arkhip (brand/display, biggest text only).
- **Size-led hierarchy**, not weight+size double-whammy (stat labels & values share weight;
  de-emphasis comes from size).
- **Lore ≠ rules.** Flavour text and game rules (loadouts, deployable features, refits) must be
  visually and structurally separate.
- **Print must be excellent** — reference-card quality, full rules text inline. They care a lot
  about print.

### Mental model (how they think about the tool) — THE big reframe
- **A group = "×N of one ship."** A battlegroup is one ship class + a quantity (within its
  group min/max). It is **not** a flexible container you open, navigate into, and assemble
  different ships within. Most current friction comes from the UI treating it as a container.
- **Guided, not open-ended.** Wants the app to walk them: faction → size → scaffold groups →
  fill toward a legal list. Prefers an opinionated, step-led flow over a blank canvas.
- **Phone-first.** The friction bites hardest on mobile; optimise small-screen first.
- **Fleet status should be glanceable** — points, legality, what's left to do — visible while
  working, never buried behind a panel switch.
- **Stated friction points (worst first):** group-is-flexible mismatch · panel-hopping
  (overview/detail/sidebar, losing your place) · editing a group feels fiddly/buried · status
  not glanceable.

### How they like to work with me
- **Terse, opinionated recommendations** — not menus of options. Make the call.
- **Bias to doing the work** over asking permission.
- **Verify in the real app** (browser preview, DOM/geometry) before claiming done — not
  screenshots, not "should work."
- **Push after each major change** so there's a testable trail of builds.
- Edit serially, not in giant parallel batches (they cascade-cancel).
- Commit messages end with the Claude co-author trailer.
- Encouraging when things land ("lovely work on the alternative layout — keep it up").

---

## Persona 2 — The tabletop player (end user of the builder)

The wider audience: Dropfleet Commander players building rosters to actually play with.
Jet is a power-user instance of this persona, but the tool serves all of them.

### Goals
- Build a **legal** list fast, for a specific game size (Skirmish / Clash / Battle / Reconquest).
- Reference **accurate** stats, weapons, and special rules mid-build and at the table.
- Print or carry a clean reference for game day.

### Needs / expectations
- **Correctness they can trust** — points, stats, rules matching the official PDFs; clear
  warnings when a list is illegal (tonnage, caps, unique/rare, admiral/station rules).
- **Speed** — adding "3 of this frigate" should be near-instant, not a multi-panel chore.
- **Works on a phone** at the table or on the couch.
- **Offline-friendly** (PWA) — venues have bad signal.
- **Glanceable status** — am I legal? how many points left? what still needs choosing
  (systems, features, admiral abilities)?

### Frustrations to design against
- Over-flexible UI that makes simple actions (×N of a ship) feel heavy.
- Losing your place navigating between panels on a small screen.
- Stale builds from cached assets (fixed via SW no-store, but stay vigilant).
- Empty/!wrong data (missing lore, miscounted payloads-as-groups) eroding trust.

---

## Quick decision checklist
When unsure, the answer that satisfies the most of these usually wins:

1. Does it treat a group as **×N of one ship** (not a container)?
2. Does it work **well on a phone** first?
3. Is it **guided** — does it move the user toward a legal list rather than present a blank canvas?
4. Is **fleet status glanceable** without a panel switch?
5. Is the **data correct** vs the PDFs, and is **illegality flagged clearly**?
6. Does it honour the **taste** (light/Deco, ship art prominent, geometric icons, size-led type, no slop)?
7. Is **print** still excellent?

---

## Still-open taste calls (Jet to weigh in — don't assume)
- Lore gaps (~75 ships with no source text): leave blank / Jet writes / I draft / stats-derived?
- Ship-art transparent cutouts: rembg ML matte / manual Affinity / CSS blend / defer?
- Alternative layout rollout: default everywhere / mobile-tablet only / polish first?
- Print priority: tarot cards / one-page roster / damage-track play aids?
- Faction-coloured fleet cards vs neutral navy.

*Sources: memory files user_preferences, feedback_design, feedback_ux_session3,
feedback_builder_convenience, reference_tarot_cards, project_ship_categories.*
