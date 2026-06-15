# TAYNE I CAN GET WITH

Decisions I made my best guess on during the overnight run (2026-06-15 → 16).
Go over these Monday; tell me which guesses to keep and which to change.

Format: **Question** → *my guess* → why / how to change.

---

## !!! "Can't add New York Battleships" — I could NOT reproduce it
**Status:** investigated hard, works for me on desktop. Verified: New York shows in
the picker with a working "+ Add"; adding it creates the group; its detail and the
fleet overview render; no console errors; its data is complete (gun comes from the
Laser Refit, with Medium Torpedo + Fighters & Bombers loads, which is correct per
the rulebook/BSData, so empty BASE weapons is normal for it).
**Most likely cause:** a stale build cached on your device after ~20 rapid deploys
tonight. Try a hard refresh (Ctrl/Cmd+Shift+R) or clear site data; on mobile,
close and reopen the tab.
**If it persists, tell me:** desktop or mobile? what happens exactly (button does
nothing / error / blank screen)? That'll let me repro and fix it.

## 0. Namesake lore expansion + links — DONE (skim for taste/accuracy)
**What I did:** added 1-3 factual sentences to all 83 real-people / real-city
namesakes and linked the first mention (cities -> official tourism board or city
gov; people/ancient/regions -> Wikipedia). Web-researched + URL-verified by a
9-agent workflow; I spot-checked ~6 tourism/gov URLs (all official) and 5 lore
blurbs (all factual, no em-dashes). Scourge (myth) + Shaltari (minerals) left
alone as not people/places.
**Worth your eye:** it's machine-researched, so skim a handful for voice/accuracy.
Reversible as one commit. Agrippa's namesake didn't contain his name, so I
prepended "[Agrippa](wiki) won the Battle of Actium...". Mombasa/New Cairo/Havana/
Lima used Wikipedia (only national, not city-specific, tourism boards exist - tell
me if you want those pointed at the national tourism site instead). Oslo I
upgraded to visitoslo.com.

## 1. Em-dash sweep of lore text — DONE (per "make guesses, proceed")
**What I did:** replaced `—` with a comma in all 41 `lore`/`namesake` fields
across the 6 faction files (appositive/parenthetical em-dashes, which read
correctly as commas; spot-checked, reads natural). Left the 13 rule-description
em-dashes ALONE — those are the rulebook's own dash (verbatim rules win).
**Reversible:** it's one isolated commit; `git revert` it if you hate the commas.
**Change it by:** if you'd rather a spaced hyphen or want to restore specific
hand-written lines, point me at them. Some of these are your hand-written lore
(Aaru, Parasite, etc.) — I assumed you want them em-dash-free too since you hate
the character; say if any specific line should keep its original punctuation.

## 2. Other Dropfleet projects to link on the landing page
**Q:** "link to my other dropfleet shit." I know of: Mission Maker (already named
in the footer), the part-picker (in this repo under /partpicker), and
linktr.ee/warlore.
**My guess:** link Mission Maker + the WarLore linktree from the footer, and add
the part-picker if it's deployed. (See what I actually wired below once done.)
**Change it by:** giving me the real URLs / which projects to feature.

## 3. Card "Lore" heading styling
**Q:** You said the Roboto-Slab idea was for the "lore" heading inside the cards,
not the WarLore wordmark.
**My guess:** wordmark → all Terminal Grotesque Open (fixed); card lore heading →
gave it a restrained treatment (see commit). 
**Change it by:** say if you want the card lore heading bigger / different font.

## 4. "No gray text on blue" — couldn't find a clear instance
**Q:** You asked me to kill gray-text-on-blue. I audited it: every solid navy/blue
surface (topbar, dark sidebar, primary buttons, faction chips) already uses white
text, and the navy-tint chips use dark navy text on a near-white tint. I did NOT
find a gray-on-blue offender.
**What I DID fix (real WCAG AA fails the audit caught):** status colours on their
own light tints — warning badge (was 2.3:1), success badge (3.1), error badge,
fleet warning/error messages, mobile systems "complete" pill, mobile "illegal
fleet" pill, and darkened the modular-art note scrim. All now ≥4.5:1.
**Change it by:** if there's still a specific gray-on-blue spot, screenshot it and
I'll nuke it.

## 5. Deploy range as its own column (old backlog #11)
**Q:** You wanted launch "deploy range" more visible. I dug the rulebook: it's
universal — "place those Assets up to their Launch Value within **6\"** of their
Carrier, unless otherwise stated" (§ launching assets). So nearly every asset is
6\"; a dedicated column would just say "6\"" on every row.
**My guess (NOT applied — didn't want to add clutter you'd hate):** instead of a
repetitive column, either (a) leave as-is (range already lives in the Launch rule
tooltip), or (b) one small footnote under each launch table: "Launch within 6\"
of the carrier unless stated." 
**Change it by:** tell me "column", "footnote", or "leave it" and I'll do it.

## 7. Shop link (click ship art) — box ambiguity
**Problem you raised:** most frigates are only in the Battlefleet/Core box, and
some ships are in more than one box, so a per-ship product link is wrong/missing.
**What I found:** the old behaviour searched the ship name, which returns
CROSS-FACTION noise (e.g. "Sheffield Heavy Frigate" -> every faction's frigate
sprue). TTCombat has clean faction collection pages:
`ttcombat.com/collections/dropfleet-commander/faction_<ucm|phr|scourge|shaltari|resistance|bioficers>`.
**What I did (guess, applied):** click-art now lands on the ship's FACTION
collection page (always the right faction, never a dead end), unless the ship has
an explicit `storeUrl`. Per-ship `storeUrl` still wins.
**Change it by:** if you want specific ships to deep-link to their exact product
or box, give me the box mapping (or even just "frigates -> the faction battlefleet
box at /products/<faction>-battlefleet") and I'll set per-ship `storeUrl`s. The
faction-collection default is the safe interim.

## 6. Per-ship (individual hull) naming
**Q:** You confirmed single-ship-group naming is good. Naming individual hulls
inside a multi-ship squadron is still not done (it fights the collapse model +
mobile's one-datasheet-per-group view).
**My guess:** leave it unless you specifically want to name hulls in a squadron.
**Change it by:** say "yes, per-hull names" and I'll wire it (sig + share + print).

---

# Batch (2026-06-15, v187) - print overhaul + AP + Centurion + Kalium + Aldrin

## 7. PRINT MODE - rebuilt dense (your "totally doesn't work / looks bad / 2-col doesn't work")
**What was wrong:** the print PREVIEW reused the big on-screen stat cells +
weapon rows, but their COMPACT styling only existed inside `@media print`, so the
preview rendered huge (and the "2 columns" toggle changed nothing on screen, so it
felt broken).
**What I did (applied):** rebuilt the full-print datasheet with its own dense,
self-contained markup (`.dp-*`) that looks IDENTICAL on screen and on paper - so
the preview is now WYSIWYG. Per ship: a one-line stat strip (Scan/Sig/Thr/Hull/
ES/KS/BS, upgrades in green), a compact weapon table, a Launch line, spelled-out
rules, and a hull damage track for play. **Systems that are weapons now render as
weapon-table rows** (your frigate-systems point); non-weapon systems are a short
note. **2 columns now actually reflows** (CSS column-count, works on screen + in
print). **Dropped the ship art** in print (space) and **dropped the end "Rules
Reference" glossary** (every rule is already spelled out on each ship card, so no
page-flipping and fewer pages). Mobile print also now merges loadout/system
weapons into its weapon table.
**Decisions you can flip:** (a) bring ship art back in print; (b) re-add the end
glossary; (c) make 2-column the DEFAULT. Say the word.

## 8. AP / turn now counts Command Ships (your Las Vegas point)
**What was wrong:** AP/turn = sum of admiral Levels only; it ignored "Command
Ship-X" (Las Vegas = Command Ship-1, which raises the assigned admiral's Level by
1).
**What I did:** AP/turn now adds the best Command Ship-X in the fleet (the admiral
sits on it). Verified: Level-2 admiral + Las Vegas = 3 AP/turn. (Desktop sidebar;
mobile has no AP total to fix.) Edge case not modelled: a Famous admiral flies
their OWN flagship, so a separate Las Vegas in the same list wouldn't really boost
them - rare, left simple.

## 9. Centurion Grand Cruiser - not Rare in Resistance (you said twice)
Resistance copy: removed the Rare rule + the "may be used in UCM/PHR... gain Rare"
note (it's a home-faction ship there). UCM/PHR copies keep Rare + count as cross-
faction. Done in data, so it's correct in builder/detail/print/share automatically.

## 10. Two-column "Recorded ships of the class"
When the list is tagged by sub-faction (e.g. "Equatorial (Independents)" /
"Purgatory (Kalium)") it now splits into underlined-header columns. Both apps.

## 11. Kalium counts-as text + Aldrin lore
KNC-5 / KNC-12 counts-as text set verbatim. Aldrin: moved "In many cases" to the
start of the lore and fixed the recorded ships (Endeavour, Endurance, Odyssey).

## 12. Overcharge -> High Power
Any ship with an Overcharge weapon now lists the "High Power" rule in its rules
(detail, builder, print, both apps) but NEVER as a weapon chip. (Overcharging a
weapon makes it High Power.)

## 13. STILL NEED YOUR STEER (couldn't safely guess):
- **"add screenshots for when i post shit"** - do you mean a "save fleet as image"
  button (renders the fleet card to a PNG you can drop into Discord/forums)? That's
  what I'll build unless you meant something else.
- **"I don't like that you're always click on/off stuff"** - which toggles? (loadout
  cards? secondary-objective toggles? the systems +/- steppers? settings?) Tell me
  which and what you'd prefer (e.g. single-tap select, no accidental deselect).
- **"did you ever get to the thing from the user's feedback?"** - which item? Point
  me at it and I'll confirm/do it.

---

# Batch (2026-06-15, v188) - link preview + click-on/off (you clarified)

## 14. Link preview image (your "better preview screenshot when I link the builder")
Made a real 1200x630 PNG card (assets/logos/og-preview.png, gen by
scripts/gen-og-image.py): chrome DROPFLEET COMMANDER wordmark + gold FLEET BUILDER
+ faction line + WarLore/url, gold Art-Deco rules. Pointed og:image + twitter:image
at it (was the tiny WebP logo; WebP also isn't reliable for scrapers). Now Discord/
Twitter/iMessage show a proper card. Want a different look (faction art montage, a
real in-app screenshot)? Say so and I'll regen.

## 15. "Don't like always click on/off stuff" (you said: ships, objectives, loadouts)
- **Secondary objectives**: FIXED the real friction - at 2 chosen, tapping another
  now swaps out the oldest (no "click off then on"). Both apps.
- **Loadout cards**: already pure single-pick radio (clicking an option just selects
  it; no on/off toggle). Left as-is - tell me if you meant something else here.
- **Ships**: I couldn't find a ship on/off TOGGLE - the picker uses an explicit
  "+ Add" button and the builder uses a +/- quantity stepper (neither toggles a
  ship on/off). Point me at the exact spot (or a screenshot) that feels like an
  on/off click and I'll change it.

## 16. "Did you ever get to the thing from the user's feedback?"
Not sure which item - tell me which and I'll confirm. (Recent shipped: print
rebuild, AP/Command Ship, Centurion-not-rare, Kalium/Aldrin text, Overcharge->High
Power, two-column recorded ships, link preview, objective swap.)
