# Focus View Layout — the band model

**Status:** current as of v2.596 (Oct 2026)

Focus View's task card is not centred in the viewport. It is **anchored to a band**
whose top and bottom edges are both *measured* from the live chrome at runtime.

This document exists because the same bug was shipped three releases running
(v2.469, v2.471, v2.472), each time as a different constant inside a model that
was itself wrong. If you are about to change a number in the focus-mode
geometry, read this first.

**None of it was novel.** Home view has measured the same chrome and sized
itself against it since long before — see
[CSS_ARCHITECTURE_GUIDE.md → *Measured chrome → CSS variables (band-centering)*](CSS_ARCHITECTURE_GUIDE.md#measured-chrome--css-variables-band-centering),
which documents `--header-total-height` / `--nav-dots-clearance` and the
band-centring formula. Focus mode was the one surface that ignored it, using a
hardcoded `top: 50% + 25px`, and every symptom below follows from that single
divergence. The lesson generalises past this file: when a view misbehaves at
some viewport size, first check whether it opted out of the measured-chrome
pattern the other views already use.

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

## Desktop joined the band (Oct 2026)

The band rule was scoped to `max-width: 1023px` from v2.473 until Oct 2026; at
1024px and wider `#task-view` stayed centred (`top: 50% - 35px`, content-sized,
list capped at `100dvh - 340px`). Two things were wrong with that and both
showed up as "a lot of unutilised vertical space":

- the 340px list cap was tuned when the help window sat under the card. On
  desktop it is side-docked, so ~60px was reserved for nothing;
- a centred, content-sized box cannot use the band's edges. At ~1070x790 the
  content sat 28px under the header and ~90px above the nav dots while the
  list scrolled.

A first attempt (2.594) kept centring and added a symmetric height cap so the
top edge could never ride under the header. That fixed the collision and did
nothing for the dead space. The band does both: `body.focus-mode #task-view`
is now the unscoped rule in `focus-mode.css`, `#focus-task-panel` centres on
the same band at every width, the card / list carry no viewport-derived caps
(the band bounds them, and the flex chain down to the list has
`min-height: 0`), and the desktop nav-dots / undo row sits 25px lower
(`bottom: 40px` / `25px` at ≥1024px), which the measured `--nav-dots-clearance`
turns into 25px more list.

`--focus-chrome-floor` (5px) remains as the floor the layout suite asserts; the
band gives 16px by construction. The `*-long` rows additionally assert that the
band reaches the nav dots and that a long routine fills it, so a literal cap
cannot creep back in at any width.

---

## Home view's box is the band too (Oct 2026)

Home view (`body:not(.focus-mode)`) centres `#task-view` on the same measured
band (`app-container.css`), and from Oct 2026 at ≥769px the box has the band's
**height** (`height: band − 2 × --home-band-gap`, `justify-content: safe
center`) rather than only a `max-height`. The reason is not visual — content
centred in a fixed box sits exactly where the content-sized, centred box put it
— it is the desktop drag-customize feature (`taskViewLayoutManager`). Every
dragged element is positioned in pixels relative to `#task-view`, and a box that
hugs its in-flow content moves its origin whenever that content changes: a
longer routine, the Add-task row opening, or an element floating out of it.
Measured before the change: followers restored *inside* the card after a reload
and the Add-task row docked 30px high. A fixed box is a stable frame; saved
positions carry `taskViewLayout.frame` (`LAYOUT_FRAME_VERSION`) and positions
from the hugging box are discarded once, with a notice.

Two consequences:

- `#task-card-group` must not **grow** into the band (`flex-grow: 0` at ≥769px)
  or a short routine's list background stretches to fill it — the same stretch
  Focus View removed. It still shrinks.
- a **floating** card is out of the flow, so the band no longer bounds it. It
  gets `max-height: band − --home-float-travel` (`task-view-layout.css`,
  ≥1024px) so it fits and still has room to be moved up and down. The old
  literal desktop list cap in `buttons.css` (`100vh − 400px`) is gone; the
  fixed box exposed it as binding 5px short of the band.

Focus View is unaffected: its band rule sets `height: auto` and anchors
`top`/`bottom`. ≤768px keeps the content-sized box; there is no drag feature
there to anchor.

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

## The content has to be allowed to shrink

The band bounds the *wrapper*. For the content to fit it, every flex item on the
chain down to the list — `#task-card-group`, `.task-card`, `.task-list-container`
— needs `min-height: 0`, because a flex item's default `min-height: auto` is its
content height and cannot give. Until Oct 2026 only the list had it, so with the
list pinned at its `--focus-task-list-reduction-*` cap nothing above it could
shrink and a long routine overflowed the band: on iPad portrait (834x1112, 19
tasks, input bar up) the group ended 63px past the band, and the progress row,
the × and the status pill sat on top of the nav dots. The wrapper checks all
passed, because the wrapper was fine. The `*-long` rows of the layout suite now
measure the painted content (progress row + × and help window) against the nav
line with a long routine and the input bar showing.

## Known gap

Below roughly 520px of viewport height the list shrinks to very little — it now
absorbs all of the shortage rather than the help window being clipped. At
820x480 the band is 97 → 324 and the list gets what is left after the title,
progress row and help window.

Not fixed: deciding what Focus View drops when there is no room (the help window
is the obvious candidate) is a product decision. The layout suite prints this
case as a `⚠` naming the viewport rather than asserting it away.

## The first-run tour un-does the band

While the first-run welcome banner is up (`body.first-run-welcome-active`, and the
legacy `body.onboarding-active`), `styles/main.css` takes `#task-view` OUT of the
band: `position: relative`, in document flow below the fixed banner, with the
page scrolling underneath it. Skip removes the class and the locked band returns.
The tour opens in Focus View, so that override sits on top of everything above.

**Every property the band sets on `#task-view` has to be reset there**, or it keeps
its meaning under a different positioning scheme. v2.474 added `bottom` to the band;
the override reset `top` but not `bottom`, and on a relative element with
`top: auto`, `bottom` is an upward offset: the input bar, title and first task sat
~156px up behind the banner, where scrolling cannot reach, from Aug 2026 until
the Sep 2026 fix. The same override has to beat the focus caps on `.task-card` and
`.task-list-container` (they carry `#task-view`, so the override must too), or the
list keeps its own inner scroll, and on iOS that captures a swipe that starts on it.

**Adding a property to the band means adding its reset to the tour override.** The
layout suite's tour phase (`tour: …` / `after Skip: …` rows) drives the real
first-run choice and fails if anything sits behind the banner, the routine is not
reachable by page scroll, the list scrolls on its own, or the page still scrolls
after Skip.

---

## Related

- `styles/base/variables.css` — the focus geometry tokens and their derivations
- `styles/components/focus-mode.css` — the mobile focus block
- `modules/ui/headerLayoutManager.js` — publishes both measured vars
- [CSS_ARCHITECTURE_GUIDE.md](CSS_ARCHITECTURE_GUIDE.md) — the token system, and
  the measured-chrome / band-centring pattern this view should have used from
  the start
- [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) §0 — why probes of this
  layout kept measuring the wrong thing
