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
