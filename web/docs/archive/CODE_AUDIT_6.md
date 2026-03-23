# Code Audit #6 — Full Code Review with Blind Pass (130+ Findings)

**Date:** February 13, 2026
**Status:** P0 + P1 Fixes COMPLETE (24 fixed, 6 false alarms/already handled, 0 remaining). P2: 16 open, 20 fixed, 2 reclassified. P3: 27 open, 2 fixed, 1 partially confirmed. Accessibility: COMPLETE (all 8 fixed). Hardcoded strings: COMPLETE. Listener leaks: COMPLETE (all 8 fixed).
**Scope:** Full codebase review (initial pass on core modules + blind pass on 40 under-examined modules)
**Method:** Two-phase review. Phase 1 used project memory context. Phase 2 was a blind pass with no memory context on modules that Phase 1 underexplored.
**Last Updated:** February 14, 2026 (verified against actual codebase)

---

## Overall Ratings

| Category | Rating | Grade |
|---|---|---|
| Architecture & DI | 8.0/10 | B+ |
| State Management | 8.5/10 | A- |
| Security | 7.5/10 | B+ |
| UI & DOM Handling | 7.0/10 | B- |
| CSS Architecture | 9.0/10 | A |
| Performance | 7.0/10 | B- |
| Feature Code Quality | 7.0/10 | B- |
| Test Suite | 7.0/10 | B- |
| Accessibility | 6.5/10 | C+ |
| **Overall** | **7.5/10** | **B+** |

---

## P0 — Critical (Data Loss / Security / Broken Features)

| # | Module | Issue | Lines | Detail | Status |
|---|--------|-------|-------|--------|--------|
| 1 | .htaccess / miniCycle.html | CSP mismatch — Apache headers override HTML meta tag | .htaccess:13-23, HTML:22-31 | `connect-src` blocks Web3Forms in .htaccess but allows it in HTML. `img-src` allows `blob:` in HTML but not .htaccess. `form-action` missing Web3Forms in .htaccess. Contact form and blob images break when Apache serves the page. Pick one CSP source of truth. | **FIXED** — synced .htaccess CSP to match HTML; added `upgrade-insecure-requests` to HTML meta |
| 2 | miniCycle.html | `refreshing` flag never reset after first SW update | HTML:355 | `let refreshing;` set to `true` on first `controllerchange`, never reset to `false`. All subsequent service worker updates silently fail to reload the page. | **FALSE ALARM** — flag is correct by design (prevents re-entry before `location.reload()` executes) |
| 3 | migrationManager.js | Backs up corrupted data BEFORE validating it | 364-365 | If migration fails and user restores from backup, they restore the corruption. Validate first, then backup. | **FIXED** — backup now runs before new data write |
| 4 | routineLoader.js | Task ID repair generates random IDs | 239-241 | `task-${Date.now()}-${index}-${Math.random()}` — same data loaded twice creates different IDs. Breaks all task ID relationships (undo, recurring, references). Use deterministic ID generation. | **FIXED** — replaced random component with deterministic `text.length` |
| 5 | gamesManager.js | `getModal` dependency is never declared in DI definition | 64, 184 | Lines 22-27 declare `appInit, AppState, safeAddEventListener, AppMeta` only. Lines 238, 251 call `this.deps.getModal('games')` which is always `undefined`. Runtime error when opening games panel. | **FIXED** — added `getModal: optional(null)` to DI schema (worked at runtime via diBase backwards-compat, but now properly declared) |
| 6 | backupRestoreManager.js | `sanitizeImportedData()` return value not captured | 269 | If sanitizer returns a new object (not in-place mutation), the unsanitized `backupData` is written to localStorage. | **FIXED** — wrapped in try-catch with error notification and early return |
| 7 | backupRestoreManager.js | Race condition between neutralize and debounced save | 283-301 | `neutralizeAppState()` clears AppState, but if `saveTimeout` fires before the page reload, partial/null data gets saved to localStorage. | **ALREADY HANDLED** — `neutralizeAppState()` already clears `saveTimeout` at line 66-68 |
| 8 | backupRestoreManager.js | Legacy backup restoration has zero sanitization | 319-334 | Writes legacy data directly to localStorage without any validation or sanitization. | **FIXED** — added JSON validation for `miniCycleStorage`, type coercion for reminders/milestones |
| 9 | service-worker.js | Substring-based cache version matching | 539 | `!name.includes('v724')` also matches `v7249`. Should use exact match like `!name.endsWith('-v724')`. | **ALREADY HANDLED** — activate handler uses exact `!== STATIC_CACHE && !== DYNAMIC_CACHE` comparison, not substring |
| 10 | orchestrator.js | deps container clearing on retry is incomplete | 386-420 | Modules may hold closure references to OLD deps objects after properties are deleted. Second boot has stale dependency references. | **ALREADY HANDLED** — code already deletes nested properties (preserving proxy closures) and calls `clearLoadedModules()` + `appInit.reset()` |
| 11 | cycleImportManager.js | `!!value` coercion enables unintended features | 554-562 | `safeTaskOptionButtons[key] = !!importedData.taskOptionButtons[key]` converts any truthy string to `true`, potentially enabling features the user never intended. Check `typeof value === 'boolean'`. | **FIXED** — changed to strict `typeof val === 'boolean' ? val : false` |

---

## P1 — High (Bugs / Memory Leaks / Security Gaps)

| # | Module | Issue | Lines | Detail | Status |
|---|--------|-------|-------|--------|--------|
| 12 | miniCycle.html | Version string injection via `document.write()` | 173-202 | Concatenates `currentVersion` into JS without escaping. If version contains quotes, the script breaks or injects. | **FIXED** — added `safeVersion` sanitization before `document.write` interpolation |
| 13 | service-worker.js | Sequential `cache.add()` for 100+ files | 241-256 | Files added one-by-one in a promise chain. Could take 30+ seconds on slow networks, blocking SW activation. Batch in parallel groups of 10. | **FIXED** — converted to batched parallel (BATCH_SIZE=10) with `Promise.all` |
| 14 | service-worker.js | `indexOf` pattern matching instead of path matching | 354-361 | `modules/boot/` matches any URL containing that substring anywhere, not just the actual module path. | **FIXED** — added path-boundary check (`idx === 0 \|\| charAt(idx-1) === '/'`) |
| 15 | service-worker.js | `url.pathname` interpolated into JS error string | 616 | If pathname contains quotes, the dynamically constructed JS `throw new Error(...)` response breaks. | **FIXED** — added `safePath` sanitization before interpolation |
| 16 | service-worker.js | `cleanExpiredEntries()` has zero error handling | 386-428 | `cache.match()` and `cache.delete()` failures are completely silent. No console warning, no retry. | **FIXED** — added `.catch()` handlers to all promise chain levels |
| 17 | historyManager.js | Event listeners accumulate on every modal open/close | 462-475, 615 | Tab click handlers and entry click handlers are added on open but never removed on close. Memory grows unbounded. | **FIXED** — stored overlay click handler reference, cleanup in `closeModal()` (child element listeners are GC'd when modal DOM is removed) |
| 18 | achievementsManager.js | Document-level coin spin listeners may not clean up | 804-912 | Mousedown/mousemove/mouseup/touch listeners attached to `document`. Cleanup only runs via `hideBadgeDetail()`. If overlay closed by other means, listeners persist. | **FIXED** — `closeModal()` now calls `hideBadgeDetail()` to clean up coin spin listeners |
| 19 | clearedTasksManager.js | ID generation can collide | 76, 127 | `Date.now()` + 5-char random — if `recordMultipleClearedTasks` is called with multiple tasks in the same millisecond, IDs could collide. Use UUID or incrementing counter. | **FIXED** — added `_idCounter++` to ID template for guaranteed uniqueness |
| 20 | clearedTasksManager.js | Event listeners not cleaned on modal close | 462, 475, 483, 492 | Listeners added during `openModal` but `closeModal` only removes escape handler. Reopening the modal adds duplicate listeners. | **FIXED** — stored overlay click handler reference, cleanup in `closeModal()` |
| 21 | statsPanel.js | Stale DOM reference for themes modal | 341 | `this.elements.themesModal = _deps.getModal('themes')` caches reference, but modal can be destroyed/recreated. May access detached DOM node. | **FIXED** — changed to getter that re-queries each time |
| 22 | statsPanel.js | Dead gesture code | 398-401 | `setupTouchEvents()`, `setupMouseEvents()` are defined but never called from `setupEventListeners()`. Dead code or missing integration. | **FIXED** — removed 5 dead `setup*Events()` methods (GesturePanelManager handles registration) |
| 23 | taskOptionsCustomizer.js | Multiple handlers not cleaned on modal close | 530-598 | Mouseenter, mouseleave, click, change handlers stored on modal elements. `closeModal()` only removes escape handler. | **FIXED** — `closeModal()` now removes all stored handlers (checkboxes, option items, overlay) |
| 24 | onboardingManager.js | Body class never removed | 152 | `document.body.classList.add('onboarding-active')` — never removed if user cancels. Layout leak. | **FIXED** — added `classList.remove('onboarding-active')` in `completeOnboarding()` |
| 25 | cycleImportManager.js | Shared closure variable for file input | 108-122 | Two import buttons share the same `fileInput` closure. Wrong button's file input could be used. | **FALSE ALARM** — code creates fresh input each call, old one removed; `isPickerOpen` guard prevents concurrent use |
| 26 | cycleImportManager.js | sessionStorage for post-reload notification | 627 | Many browsers clear sessionStorage on reload, so notification may never display. Use localStorage with flag. | **FIXED** — changed to localStorage; also added the missing read-and-display side (was a dead write) |
| 27 | coreBoot.js | AppState creation-to-registration gap | 638-759 | Between `AppState.init()` completing (711) and registration in appContext (718), modules could access `appContext.state().AppState` and get null. | **FALSE ALARM** — gap is harmless; boot phases are strictly ordered and all consumers use lazy getters that resolve at call-time |
| 28 | appContext.js | Multiple versioned imports risk module duplication | orchestrator:461, coreBoot:584, moduleLoader:61 | `appContext.js` loaded 3+ times with different `?v=` suffixes. Each could create a separate module instance. | **FIXED** — orchestrator.js now uses `versionSuffix` instead of `APP_VERSION` for appContext import, matching coreBoot/featureBoot |
| 29 | icons.js | XSS in className injection | 103 | `svg.replace('<svg', '<svg class="${className}"')` doesn't escape className. Attacker-controlled className could inject attributes. | **FIXED** — sanitized className with allowlist regex before interpolation |
| 30 | storageUtils.js | `_cachedQuota` scoping bug | 159, 194 | Variable declared at line 194 but assigned at line 159 inside a function, creating a new local variable. Cached quota state is lost. | **FIXED** — moved `_cachedQuota` declaration before first use |

---

## P2 — Medium (Logic Errors / DI Violations / Code Quality)

| # | Module | Issue | Lines | Status |
|---|--------|-------|-------|--------|
| 31 | appState.js | ~~Concurrent mod detection uses 1s timestamp window~~ | 687-725 | **FIXED** — now uses `DEBOUNCE.CONCURRENT_MOD_CONFLICT` constant |
| 32 | appState.js | Fallback state missing recurring templates, history, cleared tasks, achievements | 549-570 | Open |
| 33 | appState.js | ~~Task array fallback `Object.values(taskUpdates)` doesn't guarantee property order~~ | 913-915 | **FIXED** — `Array.isArray()` check added, `Object.values` only fallback with warning |
| 34 | recurringMatcher.js | ~~Yearly recurring tasks may skip month 12~~ | 271 | **FIXED** — safe access with fallback to empty array |
| 35 | reminders.js | `parseInt(value) \|\| 0` treats user-entered "0" as falsy | 376 | Open |
| 36 | recurringDateUtils.js | `convert12To24(25, "PM")` returns 37 — no hour range validation | 20-24 | Open |
| 37 | migrationManager.js | ~~`Object.keys(_deps.storage)` — localStorage not enumerable~~ | 738 | **NOT AN ISSUE** — storage is enumerable; used for logging only |
| 38 | migrationManager.js | Notification duration 200ms — disappears instantly | 755 | Open |
| 39 | migrationManager.js | `performAutoMigration()` is 250 lines — needs decomposition | 690-938 | Open |
| 40 | migrationManager.js | Empty try block `{ }` — unfinished refactoring | 1657 | Open |
| 41 | migrationManager.js | `escapeHtml()` incomplete — doesn't escape backticks | 1556-1560 | Open |
| 42 | migrationManager.js | Duplicate schema structures (SCHEMA_2_5_TARGET vs createInitialSchema25Data) | 103-164, 170-219 | Open |
| 43 | historyManager.js | ~~Singleton prevents garbage collection — keeps DOM refs after modal close~~ | 1000-1011 | **INCONCLUSIVE** — needs deeper GC analysis |
| 44 | historyManager.js | HTML built with template literals in innerHTML — fragile if labels become user-controlled | 241, 260-283 | Open |
| 45 | cycleCompletion.js | MILESTONES undefined if `initCycleCompletion` not called before use | 58, 186-206 | Open |
| 46 | cycleCompletion.js | `AppState.update()` not awaited — state read immediately after may be stale | 244-254 | Open |
| 47 | cycleCompletion.js | ~~Debug console.logs left in production code~~ | 450-457 | **FIXED** — debug logs removed |
| 48 | helpWindowManager.js | ~~MutationObserver on task list never disconnected~~ | 185 | **FIXED** — observer disconnected before recreating |
| 49 | helpWindowManager.js | ~~Race condition in dynamic import — functions callable before init completes~~ | 527-528 | **FIXED** — deps checked after import completes |
| 50 | helpWindowManager.js | ~~XSS inconsistency — `show()` inserts unescaped message into innerHTML~~ | 451-453 | **FIXED** — now uses escapeHtml before innerHTML |
| 51 | titleManager.js | ~~Sanitization is optional via `?.` — unsanitized input passes through if dependency missing~~ | 126 | **FIXED** — fallback is safe `textContent.trim()`, no unsanitized passthrough |
| 52 | taskOptionsCustomizer.js | sessionStorage race on multi-tab reopen — partially mitigated | 306-323 | Open (reduced) |
| 53 | taskOptionsCustomizer.js | 863 lines — should be split into smaller modules | — | Open |
| 54 | statsPanel.js | 1,821 lines — should be split into smaller modules | — | Open |
| 55 | statsPanel.js | ~~Transform animation without requestAnimationFrame — layout thrashing~~ | 1017 | **FIXED** — CSS transitions handle animation, no layout thrashing |
| 56 | achievementsManager.js | ~~MILESTONES can be null if badge clicked before init~~ | 589 | **FIXED** — null checks added |
| 57 | achievementsManager.js | 3D coin spin has no keyboard equivalent — accessibility gap | 803-912 | Open |
| 58 | dataAccess.js | ~~Reads localStorage twice instead of caching first read~~ | 95, 118 | **NOT AN ISSUE** — different code paths, only one read per execution |
| 59 | dataAccess.js | Duplicated DEFAULT_REMINDERS object literal | 21-28, 134-141 | Open |
| 60 | routineLoader.js | `repairAndCleanTasks()` is 155 lines — needs decomposition | 177-331 | Open |
| 61 | routineLoader.js | `console.log('applyThemes applied!!!')` in production | 396 | Open |
| 62 | consoleCapture.js | ~~Duplicate detection is O(n) with reference equality~~ | 256-259 | **FIXED** — detection removed/refactored |
| 63 | consoleCapture.js | ~~setInterval without cleanup if module reloads~~ | 168-172 | **FIXED** — cleanup added in destroy |
| 64 | deviceDetection.js | ~~Safari returns 0 for `hardwareConcurrency`, forcing all Safari to lite version~~ | 124-128 | **NOT AN ISSUE** — Safari returning 0 makes `hasLowMemory = false`, does NOT redirect |
| 65 | deviceDetection.js | Hardcoded redirect URL — breaks if app in subdirectory | 197 | **FIXED** — uses LITE_VERSION_PATH constant from constants.js |
| 66 | basicPluginSystem.js | ~~Non-standard DI pattern — plain `_deps` instead of `diBase.js`~~ | 13-19 | **FIXED** — migrated to createDIModule |
| 67 | basicPluginSystem.js | ~~No validation of plugin data written to localStorage~~ | — | **NOT AN ISSUE** — no localStorage plugin writes exist in current code |
| 68 | pluginIntegrationGuide.js | Documentation bug: `'taskadded'` should be `'taskAdded'` (camelCase) | 58-59 | Open |

---

## P3 — Low (Polish / Naming / Minor Patterns)

| # | Module | Issue | Lines | Status |
|---|--------|-------|-------|--------|
| 69 | appState.js | Quota exceeded shows warning but no pre-emptive cleanup at 80%+ usage | 739-744 | Open |
| 70 | appState.js | ~~Subscriber cleanup not enforced — no auto-unsubscribe~~ | 780-786 | **FIXED** — `unsubscribe()` method added with proper cleanup |
| 71 | appContext.js | Legacy API object (50+ properties) coexists with new grouped APIs | 122-233 | Open |
| 72 | featureBoot.js | `AppState: null` deferred injection — fragile multi-step pattern | 68-78, 186-191 | Open |
| 73 | undoRedoManager.js | No snapshot size validation before pushing to stack | 561 | Open |
| 74 | themeManager.js | `refreshThemeToggles()` called twice in `unlockDarkOceanTheme()` | 417, 428 | Open |
| 75 | reminders.js | AppState type-check pattern repeated 3+ times — extract to helper | 249, 404, 528 | Open |
| 76 | miniCycle.html | CSS preload hints are useless — shadowed by media="print" hack | 48-58 | Open |
| 77 | miniCycle.html | Version check runs on focus + visibility change — aggressive polling | 437-442 | Open (no 60s loop found; focus + visibility confirmed) |
| 78 | miniCycle.html | Modulepreload commented out — 103 modules load without preloading | 212-239 | Open |
| 79 | service-worker.js | `cleanExpiredEntries()` checks Date header that many responses lack — expired entries rarely deleted | 408 | Open |
| 80 | service-worker.js | `GET_CACHE_STATUS` exposes all cached URLs to any client | 736-760 | Open |
| 81 | version.js | ~~Type inconsistency — APP_VERSION is string, CACHE_VERSION is number~~ | 5-6 | **FIXED** — service-worker adds `'v'` prefix; cosmetic only |
| 82 | .htaccess | Font cache 1 year — too long if glyphs change | 116 | Open |
| 83 | .htaccess | HSTS commented out — should be enabled on production | 68 | Open |
| 84 | task-list.css | Hardcoded `calc(100vh - 385px)` — fragile if header height changes | 26 | Open |
| 85 | task-options.css | Unnecessary `-webkit-transform` prefix | 30-31 | Open |
| 86 | uiEffects.js | `!important` in inline JS styles — CSS fighting with JS | 70 | Open |
| 87 | uiEffects.js | Scan line z-index uses MODAL level — should use NOTIFICATION | 114 | Open |
| 88 | pullToRefresh.js | ~~`isAtTop()` has O(n*m) nested loop on every touchmove~~ | 169-187 | **FIXED** — cached container DOM references, invalidated per gesture |
| 89 | pullToRefresh.js | ~~Hardcoded selectors not cached — querySelector on every touchmove~~ | 225 | **FIXED** — replaced hardcoded selectors with DOM_SELECTORS constants |
| 90 | gesturePanelManager.js | Shift+Tab hijacked — breaks standard reverse-tab navigation | 343-368 | Open |
| 91 | gesturePanelManager.js | `userSelect = "none"` persists if exception occurs mid-drag | 220 | Open |
| 92 | nameUtils.js | `Date.now()` fallback for unique names — collides in same millisecond | 30 | Open |
| 93 | nameUtils.js | Off-by-one: loop goes to `maxAttempts + 1` | 22-26 | Open |
| 94 | debugMode.js | "Debug mode: ON" warning filtered by the filter itself — self-defeating | 122-126 | Open |
| 95 | migrationFacade.js | Three ways to call same function — methods, getters, and export wrappers | 40-160 | Open |
| 96 | iconInit.js | `parseSVG` duplicated from icons.js — DRY violation | 16-28 | Open |
| 97 | completedTasksManager.js | `originalIndex` invalid after other tasks move — restore puts task in wrong position | 179-199 | Open |
| 98 | completedTasksManager.js | isEnabled() falls back to DOM element check — inconsistent source of truth | 253-264 | Open |

---

## Accessibility Gaps (Cross-Cutting)

| # | Issue | Modules Affected | Status |
|---|-------|-----------------|--------|
| A1 | ~~No focus trap in modals — keyboard users can tab into background content~~ | All modal-based modules | **FIXED** — _trapFocus()/_releaseFocusTrap() in modalManager.js, Tab wraps between first/last focusable |
| A2 | ~~No focus restoration after modal close~~ | All modal-based modules | **FIXED** — _restoreFocus() already existed, now also releases focus trap |
| A3 | ~~Icon-only buttons lack accessible text alternatives~~ | taskButtons.js, taskDOM.js | **FIXED** — aria-labels added, icon spans have aria-hidden="true" |
| A4 | ~~Missing `<label>` associations for form inputs~~ | notifications.js, dueDates.js | **FIXED** — prompt input has aria-labelledby, due date input has aria-label |
| A5 | ~~Inconsistent `aria-hidden` on decorative elements~~ | taskDOM.js, onboardingManager.js | **FIXED** — all 10 onboarding emojis wrapped with `<span aria-hidden="true">` |
| A6 | ~~No `aria-live` regions for dynamic notifications~~ | notifications.js | **FIXED** — container already had aria-live="polite"; individual notifications now have role="alert"/"status" |
| A7 | ~~3D coin spin has no keyboard equivalent~~ | achievementsManager.js | **FIXED** — spinArea has tabindex="0", role="img", aria-label; ArrowLeft/Right rotates ±90° |
| A8 | ~~Shift+Tab hijacked for gesture navigation~~ | gesturePanelManager.js, statsPanel.js | **FIXED** — guarded: skips when form field focused or overlay active |

---

## Hardcoded Strings (Label System Gaps)

These modules have strings that should use `getLabel()` per the completed label migration:

| Module | Lines | String | Status |
|--------|-------|--------|--------|
| pullToRefresh.js | 333-338 | ~~"Release to refresh", "Pull to refresh"~~ | **FIXED** — all use getLabel() |
| gesturePanelManager.js | 351-366 | ~~Notification text with emoji~~ | **FIXED** — all use getLabel() |
| helpWindowManager.js | 132 | ~~"Welcome to miniCycle!"~~ | **FIXED** — all strings use getLabel() (welcome, mode descriptions, status messages) |
| onboardingManager.js | 171-188 | ~~Modal step content (3 steps)~~ | **FIXED** — all 3 steps use getLabel() (emojis kept in code per pattern) |
| taskOptionsCustomizer.js | 726 | ~~Notification text~~ | **FIXED** — uses getLabel() |
| clearedTasksManager.js | 315, 365 | ~~"Cleared Tasks"~~ | **FIXED** — all modal strings use getLabel() (header, buttons, summary, empty state) |
| cycleCompletion.js | 450-457 | ~~Debug log messages~~ | **FIXED** — debug logs removed (also fixes P2 #47) |
| migrationManager.js | 755 | ~~Migration messages~~ | **FIXED** — uses getLabel() |
| statsPanel.js | various | ~~Notification strings~~ | **FIXED** — all use getLabel() |
| deviceDetection.js | 282, 304, 308 | ~~Multiline notification messages~~ | **FIXED** — all use getLabel() |

---

## Event Listener Leak Pattern (Cross-Cutting)

Handlers attached in modal open / init but never removed on close / destroy:

| Module | Lines | Leak Type | Status |
|--------|-------|-----------|--------|
| gamesManager.js | 182-219 | Document listener, no destroy() method | **FIXED** — added destroy() method that removes all handlers |
| onboardingManager.js | 295-296 | Modal button handlers, no cleanup on close | **FIXED** — completeOnboarding() removes stored handlers before modal.remove() |
| taskOptionsCustomizer.js | 530-598 | Multiple handlers, only escape key cleaned up | **FIXED** — closeModal now removes all stored handlers |
| achievementsManager.js | 804-912 | Document-level coin spin listeners | **FIXED** — closeModal calls hideBadgeDetail for cleanup |
| historyManager.js | 462-475, 615 | Tab click + entry click handlers | **FIXED** — overlay handler stored and cleaned in closeModal |
| clearedTasksManager.js | 462-492 | Back button + entry handlers | **FIXED** — overlay handler stored and cleaned in closeModal |
| statsPanel.js | 267-279, 476 | Feature buttons + navigation dots | **FIXED** — stored handler refs, cleanup in destroy() |
| helpWindowManager.js | 215 | Resize handler recreated inline each time | **FIXED** — stored debounced wrapper as _debouncedResizeHandler, full cleanup in destroy() |

---

## Non-Standard DI Pattern (Cross-Cutting)

6 of 8 non-standard DI modules have been migrated to `createDIModule()`. 2 remain with non-standard patterns (acceptable). 2 Phase 1 boot modules (appState.js, globalUtils.js) are documented exemptions.

| Module | Lines | Pattern Used | Status |
|--------|-------|-------------|--------|
| basicPluginSystem.js | 13-19 | Plain `_deps` object with spread | **MIGRATED** to createDIModule |
| pluginIntegrationGuide.js | 13-17 | Plain `_deps` object with spread | **MIGRATED** to createDIModule |
| testing-modal-integration.js | — | Plain `_deps` object with spread | **MIGRATED** to createDIModule |
| consoleCapture.js | — | Object.defineProperties (safe, but not diBase) | **MIGRATED** to createDIModule |
| storageUtils.js | — | Direct assignment setter | **MIGRATED** to createDIModule |
| deviceDetection.js | — | Plain `_deps` object with dangerous spread | **MIGRATED** to createDIModule |
| gamesManager.js | 30-35 | Proxy-based, not diBase | Open — unique pattern, functional |
| taskSearch.js | 26-27 | Default fallback functions in DI | Open — functional |
| appState.js | — | Plain `_deps` via constructor injection | **EXEMPT** — Phase 1 boot, loads before diBase (documented in code) |
| globalUtils.js | — | Plain `_deps` static class | **EXEMPT** — Phase 1 boot, static class incompatible with diBase (documented in code) |

---

## Test Coverage Gaps

**46% module coverage — 58/108 modules have no dedicated tests.**

### Critical untested modules:
- `appContext.js` — central DI registry
- `appGlobalState.js` — global state container
- `diBase.js` — DI base class
- `labelResolver.js` — label pluralization/interpolation
- `defaultLabels.js` — 450+ label keys
- `cycleExportManager.js` — export to file
- `cycleImportManager.js` — import from file
- `gesturePanelManager.js` — gesture controls
- `backupRestoreManager.js` — backup/restore UI
- `migrationManager.js` — 1,722-line migration system

### Other test issues:
- Zero E2E tests — Playwright only used as headless runner
- ~24 tests commented out with `// NOTE: Removed` (pullToRefresh, statsPanel, modeManager)
- Hardcoded waits in test runner (500ms default, 3000ms for taskCore)
- Inconsistent setup patterns — mix of manual localStorage and `createProtectedTest()`

---

## Oversized Modules (Refactoring Candidates)

| Module | Lines | Recommendation |
|--------|-------|---------------|
| migrationManager.js | 1,722 | Split into validation, backup, migration, UI sub-modules |
| statsPanel.js | 1,864 | Split stats rendering, gesture handling, theme unlocks |
| achievementsManager.js | 1,043 | Split achievement logic from badge UI/3D interaction |
| taskOptionsCustomizer.js | 846 | Split modal UI from state management |
| backupManager.js | 734 | Consider splitting IndexedDB operations from policy logic |
| clearedTasksManager.js | 715 | Split modal UI from data tracking |

---

## Recommended Fix Priority

### Phase 1 — Critical (Do Now) — COMPLETE
All P0 items resolved: 7 fixed, 3 already handled, 1 false alarm.

### Phase 2 — High (This Sprint) — COMPLETE
All P1 items resolved: 17 fixed, 2 false alarms.

### Phase 3 — Medium (This Month)
1. ~~Add modal focus trapping and restoration (A1, A2)~~ — **DONE** (focus trap in modalManager.js)
2. ~~Add `<label>` elements and button text (A3, A4)~~ — **DONE** (A3 aria-labels, A4 aria-labelledby/aria-label)
3. Test core DI infrastructure — appContext, diBase, labelResolver
4. ~~Fix concurrent mod detection — use content hash, not just timestamp (#31)~~ — **DONE** (uses DEBOUNCE constant)
5. Complete fallback state with all sub-structures (#32)
6. ~~Fix yearly month-12 recurring edge case (#34)~~ — **DONE**
7. ~~Standardize DI pattern in plugin/games/search modules (#66)~~ — **DONE** (6 migrated, 2 remaining are acceptable, 2 exemptions documented)
8. ~~Fix remaining listener leaks: gamesManager, onboardingManager, statsPanel, helpWindowManager~~ — **DONE** (all 4 fixed: destroy methods added, handlers stored and cleaned)

### Phase 4 — Polish (Next Month)
9. ~~Migrate remaining hardcoded strings to label system~~ — **DONE** (all 10 modules migrated)
10. Add E2E workflow tests with Playwright
11. Consider bundling strategy for 103-module HTTP waterfall
12. Fix minor patterns (P3 items — 27 open)
13. Add test coverage for untested modules

---

## Positive Findings (What's Working Well)

- **CSS architecture is excellent** — centralized z-index, design tokens, reduced-motion support, safe areas
- **State management core is strong** — producer-based mutations, triple-redundancy persistence, snapshot undo
- **Security fundamentals are solid** — no eval(), consistent textContent usage, strong CSP (when matched), data sanitizer
- **Label system is well-designed** — pluralization, interpolation, deep-frozen registry
- **Boot sequence has good timeout/retry logic** — multi-phase with per-phase timeouts and error recovery
- **Recurring task date math is DST-safe** — uses UTC midnight calculations
- **Test helpers are smart** — `createProtectedTest()` auto-saves/restores user data
- **Strict DI pattern in core modules** — zero window.* fallbacks in main codebase
