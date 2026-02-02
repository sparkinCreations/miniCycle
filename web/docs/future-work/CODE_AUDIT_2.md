# Code Audit #2 — Memory Leaks, Async Patterns, Dead Code, Naming & Security

**Date:** February 2, 2026
**Status:** Complete
**Scope:** All modules under `modules/`

---

## 1. Memory Leaks — 6.5/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 1.1 | HIGH | `MutationObserver` created, never `disconnect()`ed | `helpWindowManager.js:180-202` | Fixed ✅ |
| 1.2 | HIGH | `MutationObserver` stored as `this._themeObserver`, never disconnected | `preferencesManager.js:258-272` | Fixed ✅ |
| 1.3 | HIGH | `setInterval` (2s) — no guaranteed cleanup if instance GC'd | `consoleCapture.js:166-170` | N/A (existing cleanup sufficient) |
| 1.4 | MEDIUM | Resize debounce timeout stored as local var, not instance property — leaks on destroy | `helpWindowManager.js:210-214` | Fixed ✅ |
| 1.5 | MEDIUM | Drag/drop listeners on `document` with no cleanup path | `cycleImportManager.js:282-309` | Documented |

**Positive patterns found:**
- `safeAddEventListener` prevents duplicate listeners across 52+ modules
- `WeakMap` usage in `taskDOM.js` for automatic handler GC
- Many modules use `_eventListenersInitialized` idempotency guards

---

## 2. Async/Promise Handling — 6/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 2.1 | HIGH | `updateAppState()` called without `await` — UI refresh races state save | `recurringActivation.js:169,280,367,479`, `recurringWatcher.js:320,479`, `recurringPanel.js:965,1565,1631` | Fixed ✅ |
| 2.2 | HIGH | Concurrent `updateAppState()` calls with no mutex/queue — state corruption possible | `recurringWatcher.js:320-335` + `479-494` | Fixed ✅ (via await) |
| 2.3 | MEDIUM | `setTimeout(async () => {...})` without try-catch — unhandled rejections | `testing-modal-integration.js:486,563` | Fixed ✅ (uiBoot/undoRedo were false positives) |
| 2.4 | MEDIUM | Sequential `await` in loops — could use `Promise.all()` | `backupManager.js` 4 loops | Fixed ✅ (taskUI kept sequential — order matters) |
| 2.5 | MEDIUM | Inconsistent error propagation — some async fns throw, some return false, some show notification | `dataAccess.js`, `appState.js`, `migrationManager.js` | Documented |

---

## 3. Dead Code — 8.5/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 3.1 | MEDIUM | `detectCircularDeps()`, `loadModule()`, `initializeModule()` exported but only used internally | `moduleLoader.js:282,313,363` | Documented (inspection hooks) |
| 3.2 | MEDIUM | `resetTaskLimitNotification()` exported, never called anywhere | `recurringWatcher.js:123-125` | Fixed ✅ (export removed) |
| 3.3 | LOW | `getLoadedModule()`, `getModuleInstance()`, `isModuleLoaded()` — debug utilities never called | `moduleLoader.js:1271,1280,1289` | Documented (inspection hooks) |
| 3.4 | LOW | `testRecurringIntegration()` — test function in production code | `recurringIntegration.js:368` | Kept (used by test suite) |

---

## 4. Naming & API Consistency — 6/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 4.1 | HIGH | Three init naming patterns: `init*` (35), `initialize*` (8), `setup*` (12) | Codebase-wide | Documented |
| 4.2 | HIGH | Magic timeout numbers (200-3000ms) not using `constants.js` | 15+ files | Documented |
| 4.3 | HIGH | Init functions inconsistently return: instance, Promise, or void | Various | Documented |
| 4.4 | MEDIUM | CSS class names as magic strings (`"hidden"`, `"visible"`) — no `DOM_CLASSES` | 50+ occurrences | Documented |
| 4.5 | MEDIUM | localStorage keys as magic strings (`"miniCycleData"`) — no `STORAGE_KEYS` | 15+ occurrences | Documented |
| 4.6 | MEDIUM | Three modal close methods coexist | `modalManager.js`, various | Documented |
| 4.7 | MEDIUM | Three idempotency guard naming patterns | Various | Documented |

**Note:** Items 4.1–4.7 are style/refactor scope. Documenting conventions here; large-scale rename deferred.

**Recommended conventions (for new code):**
- Init functions: use `init*` (not `initialize*` or `setup*`)
- Idempotency guards: use `_[methodName]Initialized`
- Timeouts: add to `constants.js` `UI_TIMEOUTS` / `TASK_TIMEOUTS` objects
- CSS classes: add `DOM_CLASSES` to `constants.js` when next touching a file
- Storage keys: add `STORAGE_KEYS` to `constants.js` when next touching a file

---

## 5. Security & Robustness — 7.5/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 5.1 | HIGH | Raw localStorage user data logged to console | `appInit.js:332`, `dataAccess.js:120` | Fixed ✅ (logs length only) |
| 5.2 | MEDIUM | `Object.assign(state, data)` without `__proto__`/`constructor` key filtering | `themeManager.js:835` | Fixed ✅ |
| 5.3 | MEDIUM | `JSON.parse(localStorage...)` without try-catch | `exampleTimeTrackerPlugin.js:177,195,219` | Fixed ✅ |
| 5.4 | MEDIUM | innerHTML with dynamic `dataset.freq` value (currently safe, fragile) | `notifications.js:1118` | Fixed ✅ (textContent) |
| 5.5 | LOW | `document.write()` in testing print window | `testing-modal-ui.js:662-666` | Fixed ✅ (DOM API) |

No `eval()`, `new Function()`, or dynamic code execution found.

---

## Fix Priority

### HIGH Priority (Bugs / Security)
- [x] 1.1 + 1.2: Add `disconnect()` to MutationObservers (helpWindowManager, preferencesManager — stored as instance property, disconnect on re-init)
- [ ] 1.3: Add cleanup guarantee to consoleCapture setInterval (existing `stopConsoleCapture()` handles cleanup; no further action without WeakRef)
- [x] 2.1 + 2.2: Add `await` to `updateAppState()` calls in recurring modules (recurringActivation 4 calls, recurringWatcher 2 calls, recurringPanel 3 calls — all functions made async)
- [x] 5.1: Remove raw data from console.error logs (appInit, dataAccess — now log data length only)

### MEDIUM Priority (Robustness)
- [x] 1.4: Store debounce timeout as instance property (helpWindowManager `_resizeTimeout`; statsPanel had no resize handler — false positive)
- [x] 2.3: Add try-catch to `setTimeout(async ...)` patterns (testing-modal-integration.js — 3 nested setTimeouts wrapped; uiBoot/undoRedoManager already had try-catch — false positives)
- [x] 2.4: Convert sequential awaits to `Promise.all()` where safe (backupManager — 4 deletion loops parallelized; taskUI kept sequential — task order matters)
- [x] 3.2: Remove unused `resetTaskLimitNotification` export from recurringWatcher
- [x] 5.2: Add prototype pollution guard to `Object.assign` in themeManager `saveSchemaData()`
- [x] 5.3: Add try-catch to all 3 `JSON.parse` calls in exampleTimeTrackerPlugin
- [x] 5.4: Use `textContent` instead of `innerHTML` for freq display in notifications.js

### LOW Priority (Cleanup)
- [x] 3.4: `testRecurringIntegration()` — kept exported (used by test suite); no action needed
- [x] 5.5: Replace `document.write` with DOM API in testing print (testing-modal-ui.js — now uses createElement/textContent)
- 3.1 + 3.3: moduleLoader debug exports (`getLoadedModule` etc.) — intentional inspection hooks, kept as-is

### Documented Only (Style — apply incrementally)
- 4.1–4.7: Naming conventions, magic numbers, CSS/storage constants

---

## Verification

After fixes complete:
1. Run full test suite: `node tests/automated/run-browser-tests.cjs` — expect 1611/1611
2. Grep audit: `grep -rn "console\.\(error\|log\).*rawData\|substring" modules/core/` — should show no raw data logging
3. Grep audit: `grep -rn "new MutationObserver" modules/` — each should have matching `disconnect()`
4. Manual smoke test: recurring tasks, theme switching, preferences, help window
