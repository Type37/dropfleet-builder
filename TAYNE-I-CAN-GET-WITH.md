# TAYNE I CAN GET WITH

Decisions I made my best guess on during the overnight run (2026-06-15 → 16).
Go over these Monday; tell me which guesses to keep and which to change.

Format: **Question** → *my guess* → why / how to change.

---

## 1. Em-dash sweep of lore text
**Q:** You hate em-dashes as AI-slop. Lore (61) + namesake (8) flavour fields
still contain them, but some lore is your hand-written prose.
**My guess (NOT yet applied):** Replace `—` with a comma in lore/namesake
(appositive em-dashes read fine as commas), leaving the 13 rule-description
em-dashes alone (those are the rulebook's own dash = verbatim).
**Change it by:** telling me a different replacement (spaced hyphen ` - `? colon?)
or "leave my hand-written lore alone, only touch the auto-generated stuff."
Holding because mangling your writing felt worse than waiting.

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
