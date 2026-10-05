# The Show-Three-Dots Toggle Was Dead on the Session That Created the Data

> **Status:** ✅ FIXED v2.587 — two defects, both required ·
> **Severity:** was Medium-High — a silently dead control for a whole session ·
> **Found:** Oct 2026, while trying to enable three-dots mode for an accessibility test.
>
> Kept rather than deleted because the *diagnosis* is the reusable part: the first
> scan said 13 functions were affected, the answer was 1, and the first fix was
> provably insufficient. Both mistakes are the interesting content.

---

## What was broken

`settingsManager.init()` calls `initAllToggles()` **exactly once**, gated on
`appInit.waitForCore()`. Core-ready is not state-ready — on a first run
`AppState` deliberately holds `data = null` until the choice screen persists a
routine — so `setupThreeDotsToggle()` hit its `if (!settings) return` and bailed.

Two independent defects then combined:

1. **The idempotency flag latched above the state guard.** `_initialized.threeDotsToggle = true`
   ran on entry, so the transient miss became permanent: every later call
   short-circuited and the change handler was never attached.
2. **Nothing retried.** `initAllToggles()` ran once, so even with the latch
   corrected there was no second call to benefit from it.

Measured on a first-run session: the checkbox flipped to `checked: true`,
`settings.showThreeDots` stayed `false`, `body.show-three-dots-enabled` never
applied, zero `.three-dots-btn` rendered. The only signal was one console line.

**The checkbox flipping is why this hid.** The browser sets `checked` on click
whether or not a handler exists, so the control looked like it worked.

## The fix

**Latch last** in `setupThreeDotsToggle()` — every guard that can abort now sits
above it. A missing *element* is effectively permanent so latching past it would
be harmless; a missing *state* never is, and latching last covers both for the
price of a redundant re-wire attempt.

**Retry on open** — `openSettings()` calls `initAllToggles()`. The user cannot
reach Settings before state exists, every setup carries its own guard (so it is a
no-op for anything already wired), and the handler already re-ran
`loadSettingsCollapsedStates()` per open for the same reason.

`setupSettingsMenu()` had already solved this for itself, with the comment
*"Only lock setup after the live modal path exists so a later retry can recover."*
The pattern was in the file; it just had not been applied to its neighbours.

⚠️ **Do not instead make `init()` await `AppState.isReady()`.** CLAUDE.md records
that measured deadlock: state only becomes ready once something writes, and every
writer is a UI manager waiting on that gate.

## Proof that both were needed

Each fix alone leaves the bug intact. Measured by reverting them independently
against the journey test:

| latch moved late | retry on open | result |
|---|---|---|
| ✗ | ✗ | FAIL |
| ✓ | ✗ | FAIL — the retry is the only thing that can use the unlatched flag |
| ✗ | ✓ | FAIL — the retry returns immediately on the latched flag |
| ✓ | ✓ | **PASS** |

A fix that passed only the first cell would have read as complete.

## The scan was wrong three times — this is the transferable part

The first survey reported **13 of 15** setup functions affected. The real answer
is **1**. Three successive refinements removed false positives:

| attempt | reported | why it was wrong |
|---|---|---|
| regex: `_initialized` set before any `return` | 13 | counted `if (!element) return` — permanent, harmless to latch past |
| + classify the guard as state vs element | 11 | matched `if (!state.settings) state.settings = {}` **inside handler bodies** — those run later, on interaction, and cannot abort wiring |
| + require 4-space (top-level) indentation | 2 | function extents split only on `export function`, so `export async function syncCurrentSettingsToStorage`'s guard was attributed to the setup above it |
| + split on any top-level function | **1** | matches the one function actually measured failing |

Every error inflated the count. A shape-matching scan over a large file produces
**candidates, not findings** — the number is an upper bound until each one is
executed. Writing "13 of 15" into three documents before verifying was the actual
mistake here, and the same class of error as the rest of this list: trusting a
signal that could not distinguish the thing it was looking for from something
that merely resembled it.

## Regression coverage

- `tests/settingsUIManager.tests.js` — the exact sequence (*setup with state
  missing → state becomes ready → setup again*), asserting the **stored value**,
  never `checked`. Plus a guard that a second call after a *successful* wire
  still attaches exactly one listener, so latching late did not become latching
  never.
- `tests/automated/run-journey-tests.cjs` — *"a settings toggle works on the
  session that created the data"*, driving the real boot and asserting all three
  layers: persisted, body class applied, three-dots buttons rendered.

A unit test alone cannot cover this: the failing condition requires boot's
state-not-ready window followed by a real Settings open.

## Related

- [REVIEW_PATTERNS.md § 18](../reference/REVIEW_PATTERNS.md) — the fault line.
- [HOW_TO_ADD_COOKBOOK.md § New Settings Toggle](../working-on-code/HOW_TO_ADD_COOKBOOK.md)
  — the template that taught the latch-on-entry shape, now corrected.
- No gate covers "latched before it succeeded". A static check for
  `_initialized.* = true` appearing above a top-level `return` in the same
  function would catch the class — and, per the table above, would need to
  respect indentation and `async` function boundaries to be worth having.
