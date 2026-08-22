# Focus View Layout — the band model

**Status:** current as of v2.473 (Aug 2026)

Focus View's task card is not centred in the viewport. It is **anchored to a band**
whose top and bottom edges are both *measured* from the live chrome at runtime.

This document exists because the same bug was shipped three releases running
(v2.469, v2.471, v2.472), each time as a different constant inside a model that
was itself wrong. If you are about to change a number in the focus-mode
geometry, read this first.

---

## The model

```
   ┌─────────────────────────────┐  y = 0
   │  .mini-cycle-header-row     │  ← paints: backdrop-filter: blur(5px)
   │      ✕      logo      ⋯      │
   └─────────────────────────────┘  ← --focus-chrome-bottom   (MEASURED)
              + --focus-card-chrome-gap
   ┌─────────────────────────────┐  ← --focus-band-top   = #task-view top
   │  routine title              │
   │  task list (scrolls)        │
   │  progress bar               │
   │  help window                │
   └─────────────────────────────┘  ← band bottom = #task-view bottom
              + --focus-band-bottom-gap
   ─────────────────────────────── ← nav dots top
        Task | Routine | Stats       ← --nav-dots-clearance  (MEASURED)
```

```css
#task-view {
    top: var(--focus-band-top);
    transform: translateX(-50%);
    max-height: calc(100dvh
                     - var(--nav-dots-clearance, var(--nav-dots-clearance-fallback))
                     - var(--focus-band-bottom-gap)
                     - var(--focus-band-top));
}
```

Both edges are set by construction, so neither can drift. There is no doubling
term, no derived help-window clearance, and no circular dependency between them.

### The two knobs

| Token | Effect |
|---|---|
| `--focus-card-chrome-gap` | gap between the chrome and the card's top edge |
| `--focus-band-bottom-gap` | gap between the content's bottom edge and the nav dots |

Everything else is measured. **Change these, not the expression.**

---

## Why the chrome bottom is measured, not computed

Three plausible arithmetic answers exist, and each is wrong somewhere:

| Candidate | Why it fails |
|---|---|
| the ✕ / ⋯ buttons — `env(safe-area-inset-top) + 12 + 38` | bounds only the buttons. The band that **paints** is `.mini-cycle-header-row`, which extends *below* them: at inset 0 it runs to y=82 while the buttons end at 50. The routine title landed inside the blur — v2.472's report. |
| `--header-total-height` | that is `.fixed-header-container`: transparent, and it spans the mode-selector wrapper focus mode hides. Over-reserves ~35px. |
| the logo | v2.470 lowered it 6px, making it the lowest of the three on some viewports. |

Which one sits lowest changes with `env(safe-area-inset-top)` **and with the
surface**. So `headerLayoutManager.measureFocusChromeBottom()` publishes
`--focus-chrome-bottom` as the `max()` of the live rects, only while focus mode
is active.

### The surface trap

The same build on the same phone reports different insets:

| Surface | `env(safe-area-inset-top)` | chrome bottom |
|---|---|---|
| installed PWA | 61 | 111 (buttons win) |
| Safari / in-app browser | **0** | 82 (header row wins) |

Safari's own chrome covers the Dynamic Island, so the page gets no inset. Any
expression tuned on one surface is wrong on the other — this produced two
"fixed, still broken" rounds. **Test both.**

### Why the vars must be re-measured on focus toggle

Focus mode *moves* `#nav-dots` (`bottom: 80px` there), which changes
`--nav-dots-clearance`. Nothing else fires on that transition: no resize, no
orientation change, and the dots don't resize so the `ResizeObserver` stays
quiet. `headerLayoutManager` listens for `focusMode:activated` /
`focusMode:deactivated` for exactly this reason. Remove those listeners and the
band silently uses the *other* mode's numbers.

---

## Why centring failed (do not revert to it)

The previous model was `top: calc(50% + 25px)` with a height derived so the top
edge cleared the chrome. That only works while `50dvh + offset` sits near the
available band's centre.

At 820x480 the band runs 81 → 349, centred on **215**, while the element centred
on **265** — 50px low. So any height that cleared the top pushed the bottom past
the nav dots, and the help window's clearance margin was truncated by
`overflow: hidden` instead of pushing content up.

Band-anchoring reproduces every previously approved number *exactly* — card top
127 and help bottom 695 at 393x852 / inset 61, card top 98 at 402x656 / inset 0.
That match is the evidence the old formulas were computing this band the long way
round, and it is the check to repeat if the model is ever revisited.

---

## The guard

`npm run test:layout` covers focus view on all 7 viewports:

- `focus chrome var published` — non-zero
- `focus chrome var matches the live chrome` — published ≠ correct; this catches
  a stale-but-nonzero value, which is the failure a "published" check misses
- `focus card clears the painted chrome`
- `focus band clears nav dots`
- `focus content fits inside the band`

Nothing was watching this bound for three releases. If you change the geometry
and only `npm test` passes, you have not tested it.

---

## Known gap

Below roughly 520px of viewport height the content cannot fit the band — the
card-group's own floor exceeds it — and `#task-view`'s `overflow: hidden` clips
the help window. At 820x480 it overhangs the band by 29px (versus 59px past the
**nav dots** before band-anchoring). `min-height: 0` on the focus-mode task list
recovers part of it.

Not fixed: deciding what Focus View drops when there is no room (the help window
is the obvious candidate) is a product decision. The layout suite prints this
case as a `⚠` naming the viewport rather than asserting it away.

---

## Related

- `styles/base/variables.css` — the focus geometry tokens and their derivations
- `styles/components/focus-mode.css` — the mobile focus block
- `modules/ui/headerLayoutManager.js` — publishes both measured vars
- [CSS_ARCHITECTURE_GUIDE.md](CSS_ARCHITECTURE_GUIDE.md) — token system
- [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §0 — why probes of this
  layout kept measuring the wrong thing
