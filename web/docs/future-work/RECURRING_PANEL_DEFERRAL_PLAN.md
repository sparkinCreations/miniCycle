# Recurring Panel Deferral Plan

**Status:** PLAN — not yet implemented (design for review)
**Date:** 2026-06-14
**Goal:** Move the recurring *panel UI* off the boot path to cut slow-device boot time.

## Why

Real-device profiling (old Android, v2.238) ranked **RECURRING as the #2 boot phase
(~418ms cold / ~402ms warm)** — second only to UI_MANAGERS — despite being only 3
manifest entries. Root cause: `recurringIntegration.initRecurringModules()`
(`modules/recurring/recurringIntegration.js`) eagerly dynamic-imports the panel UI at
boot:

```js
// recurringIntegration.js ~84-89
const recurringCore = await import('./recurringCore.js')                 // LOGIC — keep
const { RecurringPanelManager, ..., loadPanelSubModules }
      = await import('./recurringPanel.js')                              // 2040 lines — DEFER
const settingsApplicator = await import('./recurringSettingsApplicator.js') // LOGIC — keep
await loadPanelSubModules(version)  // Summary+Grids+Form+Events+Setup ≈ 1569 lines — DEFER
```

So ~3,600 lines of panel UI are parsed at boot before the user has opened the recurring
panel. Localhost's fast CPU hid this (parsed in ~ms); the old Android pays ~250–300ms of
the RECURRING phase for it.

**Expected payoff:** ~200–300ms off the boot sequence on slow devices (measure with the
Boot Timing modal before/after). Zero impact on fast devices.

## Eager vs deferred boundary

| Keep EAGER (boot) | DEFER (first panel-open) |
|---|---|
| `recurringCore.js` + its imports (matcher, watcher, date utils, calculators, activation) — drives whether recurring tasks show/reset on the visible list | `recurringPanel.js` (2040 lines — the `RecurringPanelManager`) |
| `recurringSettingsApplicator.js` — applies settings on reset | `loadPanelSubModules()` → Summary / Grids / Form / Events / Setup (~1569 lines) |
| `setupRecurringWatcher()` (STEP 6) — 30s interval | `recurringPanel.setup()` (STEP 5) |
| Recurring button **visibility** (trivial — see below) | `wireRecurringSettingsClickListener()` (STEP 6.5) → replaced by a lazy delegation stub |

## The four boot-time couplings (and how each is handled)

1. **Button visibility — TRIVIAL, extract.** `updateRecurringPanelButtonVisibility()`
   (recurringPanel.js:1411) is just `panelButton.classList.remove(HIDDEN)` — no state
   read. Extract to a standalone one-liner the boot stub calls. (The OPEN_RECURRING_PANEL
   button is always shown.)

2. **Info link — extract a lightweight version.** `updateRecurringInfoLink()`
   (recurringPanel.js:1432) reads `recurringTemplates` count, toggles the info link, and
   updates the empty-state hint. Runs at boot (STEP 8) and on recurring state change. It
   needs a standalone boot version (reads AppState, toggles `RECURRING_INFO_LINK`,
   binds a click handler that routes through the lazy loader → openPanel). ~50 lines to
   lift out of the panel class, OR a tiny new module `recurringInfoLink.js`.

3. **Open-trigger — lazy delegation stub (gamesManager pattern).** Today
   `wireRecurringSettingsClickListener()` (recurringPanel.js:1817) is a `document` click
   delegation on `DOM_SELECTORS.OPEN_RECURRING_SETTINGS`. Replace with a boot-time stub
   that, on first matching click (or open-button / info-link / quick-action), calls
   `ensureRecurringPanelLoaded()` then `panel.openRecurringSettingsPanelForTask(taskId)` /
   `panel.openPanel()`.

4. **Core → panel refresh callbacks (STEP 4).** Core calls `updateRecurringPanel`,
   `updateRecurringSummary`, `updatePanelButtonVisibility`, `updateInfoLink` on recurring
   state change. Rewire:
   - `updatePanelButtonVisibility` → standalone (item 1)
   - `updateInfoLink` → standalone (item 2)
   - `updateRecurringPanel` / `updateRecurringSummary` → no-op until the panel is loaded
     (they only matter while the panel is open), then delegate to the loaded instance.

## New mechanism: `ensureRecurringPanelLoaded()`

Add to `recurringIntegration.js` an idempotent loader that performs the current
STEP 1(panel)→STEP 6.5 on demand:
- `await import('./recurringPanel.js')` + `loadPanelSubModules(version)`
- `setRecurringPanelDependencies({...})` (the existing STEP 3 dep block)
- `new RecurringPanelManager()` + `recurringPanel.setup()`
- wire the live core callbacks (`updateRecurringPanel`/`Summary`) into recurringCore
- cache the instance; return it. Subsequent calls return the cached instance.

`initRecurringModules()` at boot then does only: recurringCore + settingsApplicator wiring
(STEP 2/2.5), watcher (STEP 6), the standalone button-visibility + info-link, and the lazy
open-trigger stub. It returns a `panel`/`panelAPI` whose methods route through
`ensureRecurringPanelLoaded()`.

## All five open paths must route through the lazy loader

| Path | Where | Change |
|---|---|---|
| `.open-recurring-settings` task buttons | delegation (recurringPanel.js:1817) | lazy stub in boot |
| OPEN_RECURRING_PANEL button | panel `setup()` (recurringPanel.js:150-161) | lazy open-button handler in boot stub |
| Recurring info link | recurringPanel.js:1467 | lazy (item 2) |
| Quick actions | `quickActionsManager.js:625` `deps.recurringPanel?.openPanel` | `openPanel` returned by integration becomes lazy-loading |
| Notifications action | `notifications.js:1386` via injected `openRecurringSettingsPanelForTask` | `featureBoot.js:272` injection → route through `ensureRecurringPanelLoaded()` |

All consumers already use optional chaining, so a not-yet-loaded panel degrades to no-op
(no crash) — the risk is a *missed* open, which the lazy routing fixes.

## Files touched

- `modules/recurring/recurringIntegration.js` — main refactor (split boot vs lazy; add
  `ensureRecurringPanelLoaded`; standalone button-visibility + info-link; lazy trigger).
- `modules/recurring/recurringPanel.js` — extract `updateRecurringPanelButtonVisibility`
  + `updateRecurringInfoLink` as exported standalone helpers (or new `recurringInfoLink.js`).
- `modules/boot/featureBoot.js` — `openRecurringSettingsPanelForTask` (line 272) and
  `openSettingsForTask` (459) injections route through the lazy loader.
- (Verify) `modules/boot/moduleLoader.js` depMappings (1016, 1554) and
  `appContext.js` (203) still resolve via `deps.recurring.panel.*`.

## Risk + test checklist

Risk: **moderate** — core feature (recurring task editing). All open paths must be
re-routed or the panel silently won't open. Test on device after:
- [ ] Recurring button visible at boot; recurring tasks show their indicator
- [ ] Boot Timing: RECURRING phase drops ~200–300ms; recurringPanel NOT fetched/parsed at boot (Network tab)
- [ ] Open panel via: task `.open-recurring-settings` button, OPEN_RECURRING_PANEL button, info link, quick action, notification action — all load + open correctly first time
- [ ] Set/edit/delete a recurring template; watcher still fires; settings persist
- [ ] Reset cycle → recurring tasks reappear (applicator/watcher unaffected)
- [ ] Second open reuses cached instance (no re-import)
- [ ] `destroy()` / boot-retry path still cleans up panel listeners

## Test impact

Existing coverage: **15 recurring test files** (`tests/recurring*.tests.js`).

- **Survive unchanged (protect panel behavior):** `recurringPanel.tests.js` + the 5 panel
  sub-module tests construct the panel directly (facade-testing convention) and exercise
  `openPanel()`, form/grids/summary in isolation — independent of how integration loads it.
  Logic tests (`recurringCore/Matcher/Watcher/SettingsApplicator`) also untouched.
- **Must be updated:** `recurringIntegration.tests.js` asserts the CURRENT contract that
  `initRecurringModules()` returns a synchronously-loaded panel:
  - `'initializes with valid dependencies'` → `if (!result.panel)` (line ~195)
  - `'returns recurringPanel in result'` (~230)
  - `'returns complete API objects'` → `panelAPI[fn]` typeof function (~260–302)
  - `'returns panel update functions in panelAPI'` (~545)

  Designing the return as **lazy-routing wrappers** (`result.panel` truthy; `panelAPI.*`
  are functions that `ensureRecurringPanelLoaded()`-then-delegate on call) lets most of
  these keep passing — but each must be re-verified, not assumed. STEP-8 boot calls
  (button-visibility/info-link) must use the standalone helpers, NOT the lazy wrappers, or
  they'd trigger the panel load at boot and defeat the purpose.
- **Add:** a new test (in `recurringIntegration.tests.js` or a small `recurringPanelDefer`)
  covering `ensureRecurringPanelLoaded()` idempotency + that an open path lazy-loads and
  opens; assert `recurringPanel.js` is NOT imported until first open.

## Out of scope (separate items)

- UI_MANAGERS leaf deferral (help/onboarding/quickActions/taskOptionsCustomizer)
- Cold Core(AppState) 516ms investigation
- SW precache trim + terser release step (parse-size reduction)
