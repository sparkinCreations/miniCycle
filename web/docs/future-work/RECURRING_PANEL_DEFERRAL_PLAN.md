# Recurring Panel Deferral Plan

**Status:** ✅ DONE & VERIFIED (June 14 2026), shipped v2.239. Device-confirmed on old Android:
RECURRING phase ~400ms → 251ms (dropped #2 → #3), and the panel opens/edits correctly via the
open paths (functional test passed). Lint clean + 260/260 recurring tests.
Code: `recurringBoot.js` (new), `recurringPanel.js` (2 delegations + open-button moved to boot),
`recurringIntegration.js` (lazy loader + lazy hybrid panel), `service-worker.js` (precache
recurringBoot), `recurringIntegration.tests.js` (+1 deferral test). Verified: lint clean +
260/260 recurring tests pass (incl. new deferral test). The Proxy/depMapping indirection meant
NO consumer-side edits were needed (featureBoot/quickActions/notifications/appContext untouched).
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

## Verification findings (pre-impl) — the consumer surface is already indirected

Re-checking the wiring before coding revealed that **every external consumer reaches the
panel through `deps.recurring.panel`, resolved lazily at call time** — so the lazy boundary
is a SINGLE object and most of the "five open paths" need no edits:

- `moduleLoader.js:1171` — `recurringPanel: new Proxy({}, { get: (t,p) => deps.recurring?.panel?.[p] })`. Consumers (quickActionsManager `required()` at :213) get this Proxy; property access forwards to `deps.recurring.panel.*` at access time.
- `moduleLoader.js:1016/1181-1183` — `openRecurringSettingsPanelForTask`, `updateRecurringPanel`, `updateRecurringPanelButtonVisibility`, `updateRecurringInfoLink` are all `(...args) => deps.recurring?.panel?.X?.(...args)` — resolved at INVOCATION.
- `featureBoot.js:270` — notifications wiring is **guarded on `deps.recurring?.panel` being truthy**, then injects `openRecurringSettingsPanelForTask` as `() => deps.recurring?.panel?.X?.()`.
- `featureBoot.js:514` — `appContext.setContextValue('recurringPanel', deps.recurring?.panel)` **snapshots the reference at boot**.

**Implication — simpler than the original plan:** make `deps.recurring.panel` (the object
`initRecurringModules()` returns as `panel`) a **lazy hybrid object** and the Proxy +
depMappings + featureBoot guard + appContext snapshot all work transparently. **No edits
to featureBoot routing / quickActionsManager / notifications / appContext are needed.**

### Two hard constraints this imposes
1. **`deps.recurring.panel` must be a truthy object from boot** (not null) — or the
   `featureBoot:270` guard skips notification wiring, the appContext snapshot is null, and
   `quickActionsManager`'s `required()` fails.
2. **TRAP:** `updateRecurringPanelButtonVisibility` is a depMapping consumed by **task
   modules** (`taskCore` optionalDeps, moduleManifests.js:539) and fired on every task
   render/change. If the lazy object's `updateRecurringPanelButtonVisibility` triggered a
   panel load, tasks rendering at boot would load the panel immediately and **defeat the
   deferral.** So button-visibility + info-link must be the **standalone, no-load**
   implementations on the lazy object.

### Lazy-object method contract (three categories)
| Category | Methods | Behavior |
|---|---|---|
| **Standalone (no load)** | `updateRecurringPanelButtonVisibility`, `updateRecurringInfoLink` | run the extracted standalone helper directly |
| **Load-then-call** (user-initiated open) | `openPanel`, `openRecurringSettingsPanelForTask`, `openForTask` | `await ensureRecurringPanelLoaded()` → delegate (already async today) |
| **No-op until loaded** (refresh while open) | `updateRecurringPanel`, `updateRecurringSummary`, `closePanel` | if panel already loaded → delegate; else no-op (nothing to refresh when closed — must NOT trigger a load) |

`ensureRecurringPanelLoaded()` stays idempotent (returns cached instance); the lazy object
routes through it every call — no reference-swapping (which would miss the appContext
snapshot).

### Remaining open path that DOES need a boot stub
- `.open-recurring-settings` task-button delegation — currently wired by
  `panel.setup()` → `wireRecurringSettingsClickListener()` (recurringPanel.js:1817). Since
  `setup()` is deferred, wire an equivalent `document` delegation stub at boot that calls
  the lazy object's `openRecurringSettingsPanelForTask(taskId)`.
- OPEN_RECURRING_PANEL button + info-link click — also wired in `setup()` today; the
  standalone info-link helper rebinds its own click, and the open-button needs a lazy
  boot handler (or fold into the same boot stub).

## Files touched (revised after verification — fewer than first thought)

- `modules/recurring/recurringIntegration.js` — **main refactor**: split boot vs lazy;
  build the lazy hybrid `panel` object; add `ensureRecurringPanelLoaded()`; run standalone
  button-visibility + info-link at boot; wire the `.open-recurring-settings` (+ open-button)
  boot delegation stub.
- `modules/recurring/recurringPanel.js` — extract `updateRecurringPanelButtonVisibility`
  (trivial) + `updateRecurringInfoLink` (~50 lines) as exported standalone helpers (or a
  new tiny `recurringInfoLink.js`) that the lazy object and boot stub call.
- `tests/recurringIntegration.tests.js` — update the synchronous-load assertions; add the
  lazy-load test (see Test impact).
- **NOT needed** (verification showed the Proxy/depMapping indirection handles routing):
  `featureBoot.js`, `quickActionsManager.js`, `notifications.js`, `appContext.js`,
  `moduleLoader.js` depMappings — all already route through `deps.recurring.panel`, which
  the lazy object satisfies. (Still re-verify each at impl time, but no edits expected.)

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
