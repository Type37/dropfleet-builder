# Proposal: #13 Resistance systems picker — inline mini weapon-datasheet

You asked for a proposal before I build this. Here it is.

## Today

Each system/hardpoint option in the picker shows a terse one-liner:

> XN-31 Mass Driver Turret &nbsp; +6 pts
> `F/S · 2/2+/1K · Critical-1`

You have to already know that means Arc F/S, Attack 2, Lock 2+, Damage 1
Kinetic. New players can't read it.

## Proposed

Render each weapon-bearing option as the same mini weapon-datasheet the ship's
own weapon table uses, inline under the option name:

```
┌ XN-31 Mass Driver Turret ──────────────  +6 pts ─┐
│  Weapon            Lk   At   Dm   Arc            │
│  XN-31 Mass Driver 2+   2    1K   ◣ (F/S)        │
│  [Critical-1]                                    │   ← tappable chip → rule
└──────────────────────────────  [ − ] 0 [ + ] ───┘
```

- Reuse the existing arc SVG (`arcSvg`/ARC diagrams) and the weapon-row CSS — no new components.
- Special rules become tappable chips (`openRule`) like everywhere else.
- Options that aren't weapons (Drive Refit, Ablative Armour, Scanner Array, launch loads) keep a short effect line / launch summary — only weapon options get the datasheet.
- Multi-weapon options (if any) list each weapon as its own row.

## Why it's cheap

The data already has everything: every option carries a full `weapons[]`
array with `arc/lock/attack/damage/type/special`. No data changes. Both apps
already render this exact table for ship weapons, so it's mostly wiring the
existing renderer into `systemOptionDetail` / the desktop equivalent.

## Scope

- Mobile `renderSystemsPicker` + `systemOptionDetail`.
- Desktop systems picker (same treatment, desktop weapon-table markup).
- Collapsed/selected state: show the datasheet only on the option rows, not repeated per count.

## Open questions for you

1. Always-expanded datasheets, or collapsed with a tap-to-expand? (Expanded is clearer for Sam; denser list is faster for Jet.) My default: **always expanded** on mobile, since the list is short per ship class.
2. Show the datasheet for the already-fixed (non-modular) weapons too, or only the modular options? My default: **only the modular options** (the fixed weapons already have the main table above).

Say go and I'll build it; tell me the two defaults are fine or flip them.
