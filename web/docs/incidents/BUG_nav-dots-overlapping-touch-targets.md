# Bug: enlarging the nav-dot touch targets made them overlap and steal each other's clicks

**Module:** `web/styles/utilities/helpers.css` (`.dot`)
**Severity:** Medium — the Home View "Routine" dot was effectively dead to pointer input for
~6 months. No data loss; the user simply could not switch back from Stats using the dot.
**Status:** ✅ **FIXED (August 14 2026, v2.421, `a285e651`)** — `.dot` is now `width: 24px`
with no negative margin, so targets tile instead of overlapping.

**Introduced:** `4e938602` — **February 19 2026, 15:44** — *"Enhance accessibility by updating
Content Security Policy and adding invisible touch target styles for improved user interaction."*

> **Provenance correction.** The fix commit `a285e651` attributes the CSS to `323f9a7f`
> (Feb 19, 16:25). That is wrong: `323f9a7f` only *reshaped* an overlap that already existed.
> The true origin is `4e938602`, 41 minutes earlier. The fix commit is already pushed in
> v2.421 and was not rewritten; this doc is the corrected record.

---

## What it did

```css
/* Invisible touch target — meets 48x48px minimum without changing dot size */
.dot::after { position: absolute; width: 48px; height: 48px; ... }
```

The comment states the intent exactly, and the intent is what caused the bug. The dots sit
**22px apart** (7px visual dot + 15px flex gap). Centring a **48px** target on each means
adjacent targets overlap by **26px**, and the later sibling paints on top — so the Stats dot's
invisible target covered the Routine dot's centre. Clicking the dot you can see dispatched to
Stats.

Only the leftmost ~1.5px of Routine's *visible* dot remained live, which is why it behaved as
intermittently-working rather than obviously dead.

**An accessibility improvement broke the control it was enlarging.**

## Timeline — it survived two same-day refactors

Each changed the mechanism while preserving the overlap, which is why the bug outlived the
code that introduced it:

| Time (Feb 19 2026) | Commit | Mechanism | Overlap |
|---|---|---|---|
| 15:30 | `4e938602^` | 7px dots, no target | none — worked |
| **15:44** | **`4e938602`** | absolute 48px `::after` | **26px — broke here** |
| 16:01 | `f3afac18` | `padding: 21px; margin: -21px` | 42px |
| 16:25 | `323f9a7f` | `width: 48px; margin: 0 -13px` | 26px |
| Aug 14 2026 | `a285e651` | `width: 24px; margin: 0` | none — fixed |

## Why it hid for six months

The click handler was never broken. A programmatic `.click()` on the Routine dot switched views
correctly, because `.click()` bypasses hit-testing — so every "is the handler wired?" check came
back clean, and the failure looked like anything *except* CSS.

The diagnostic that actually found it:

```js
const r = dot.getBoundingClientRect();
document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
// → returned the *Stats* button when probing the Routine dot
```

## The trap in reproducing it

The first attempt to simulate the pre-regression geometry injected an override for
`.dot::after` and reported every dot hitting itself — i.e. "the old geometry was fine, so
something else changed." **That was wrong.** The override lost a CSS specificity fight, the
pseudo-element stayed 7px, and the measurement was of bare non-overlapping dots.

It was caught by asserting the simulated target had actually rendered:

```js
getComputedStyle(dot, '::after').width   // expected "48px", was "7px"
```

Rebuilt in an isolated sandbox (unique class names, no specificity contest) the old geometry
reproduced the bug exactly: Routine's centre resolved to Stats.

**Verify that a simulation is simulating what you think before believing its verdict** — an
unapplied override fails *open*, reporting healthy.

## Lessons

1. **Touch targets larger than their spacing overlap, and overlap is won by DOM order.** Target
   size and visual spacing are coupled whenever the visible mark is centred in the target: the
   box width *is* the gap. You cannot have 22px spacing and 44px non-overlapping targets.
   WCAG 2.5.8 (AA) wants 24×24 — so 24px spacing is the floor for a dot row like this.
2. **A negative margin that pulls large targets together is the smell.** `margin: 0 -13px` on a
   48px box is a statement that the targets overlap by 26px.
3. **`.click()` passing proves the handler, not the hit-test.** For "the control does nothing"
   reports, probe `elementFromPoint` at the visual centre before reading any JS.

## See also

- `docs/reference/REVIEW_PATTERNS.md` §10 — the generalised fault line
- Focus View focus-handoff bug (v2.420) — same shape: reported as "the feature is broken",
  handler was fine, the real defect was in the interaction layer
