# Settings Setup Functions Latch Their Idempotency Guard Before They Succeed

> **Status:** 🔴 OPEN — one instance measured, 12 more match the shape, none fixed ·
> **Severity:** Medium-High — a silently dead control for the whole session, user-facing ·
> **Found:** Oct 2026, while trying to enable three-dots mode for an accessibility test.
>
> Not found by a test, a gate, or a review. Found because a toggle refused to
> work and the reason was two lines apart in the same function.

---

## The bug

Every setup function in [`settingsUIManager.js`](../../modules/ui/settingsUIManager.js)
opens with an idempotency guard. The guard is **latched before the checks that
can abort the setup**:

```javascript
export function setupThreeDotsToggle() {
    if (_initialized.threeDotsToggle) return;
    _initialized.threeDotsToggle = true;        // ← latched here

    const threeDotsToggle = document.getElementById(DOM_IDS.TOGGLE_THREE_DOTS);
    if (!threeDotsToggle) return;

    const settings = currentSettings();
    if (!settings) {
        console.error('State data required for three dots toggle');
        return;                                  // ← bails, already latched
    }
    // ...the change handler is attached BELOW this point...
}
```

A missing *element* is usually permanent, so latching past it is harmless. A
missing *state* is **transient** — and latching past it converts a temporary
failure into a permanent one. The guard short-circuits every later call, so the
handler is never attached for the life of the session.

## Why state is reliably missing at that moment

This is not a rare race. `CLAUDE.md` documents it as a contract:

> **core-ready does not mean state-ready.** On a first run `AppState.init()`
> deliberately returns with `data = null` and `isInitialized = false` … State
> becomes ready when the first-run choice screen persists a routine.

So on a first run the settings UI initialises while state is deliberately empty,
every state-dependent setup bails, and all of them latch on the way out.

## Measured

`setupThreeDotsToggle`, first-run boot, Chromium:

| | |
|---|---|
| checkbox after click | `checked: true` |
| `settings.showThreeDots` in storage | **`false`** |
| `body.show-three-dots-enabled` | **absent** |
| `.three-dots-btn` elements rendered | **0** |
| console | `❌ State data required for three dots toggle` |

The control appears to work — it is a checkbox, so it flips — and persists
nothing, applies nothing. The only signal is one console line nobody is reading.

## Scope

A survey of `settingsUIManager.js` found **13 of 15** setup functions latching
before a guard that bails on transient state:

`setupSettingsMenu` · `setupMoveArrowsToggle` · `setupThreeDotsToggle` ·
`setupCompletedDropdownToggle` · `setupHelpWindowToggle` ·
`setupQuickActionsToggle` · `setupResetRecurringButton` ·
`setupResetAchievementProgressButton` · `setupRetakeGuidedTourButton` ·
`setupReducedMotionToggle` · `setupHighContrastToggle` · `setupFontSizeSelect` ·
`setupNotificationsToggle`

The other two (`setupDebugModeToggle`, `setupClearUndoHistoryButton`) bail only
on a missing element.

⚠️ **Only `setupThreeDotsToggle` has been reproduced.** The other 12 share the
shape; each needs its own check, because whether it actually bites depends on
whether that particular function runs before state is ready. Treat 13 as the
suspect list, not the confirmed count.

## The fix

Order every function so the latch sits below everything that can abort:

```javascript
if (_initialized.x) return;      // already wired
if (!element) return;            // nothing to wire (permanent)
if (!state?.settings) return;    // TRANSIENT — must not latch
_initialized.x = true;           // committed
// ...attach listeners...
```

If a guard's permanence is unclear, latch after it. Latching late can cost a
redundant re-wire; latching early costs the feature.

The template in
[HOW_TO_ADD_COOKBOOK.md § New Settings Toggle](../working-on-code/HOW_TO_ADD_COOKBOOK.md)
**taught this shape** and was corrected in the same pass that filed this doc —
anything written against the old template will have inherited it.

## Testing it

The hard part is not the fix, it is proving the fix. A test that boots with state
already ready cannot see this bug at all: the guard latches *after* a successful
setup and everything works. The failing condition is specifically
**setup runs → state not ready → setup runs again → state ready**.

So a regression test has to:

1. boot to a state-not-ready point (first run, before a routine is persisted);
2. let the settings UI initialise and bail;
3. make state ready;
4. re-run `initAllToggles()`;
5. assert the control now **persists** — not that it looks checked.

Assert the stored value, never the checkbox. `checked` is set by the browser on
click whether or not a handler exists, which is exactly why this hid.

## Related

- [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) — the fault-line this
  belongs to: a guard that swallows a failure instead of surfacing it.
- `validate:chains` gates the sibling shape (`?.` on a `required()` dep). There
  is no gate for "latched before it succeeded" — a static check for
  `_initialized.* = true` appearing above a `return` in the same function would
  catch the whole class cheaply.
