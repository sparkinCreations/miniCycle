# Code Audit #3 — Error Handling, Performance/DOM, Duplication/Coupling

**Date:** February 2, 2026
**Status:** Complete
**Scope:** All modules under `modules/`

---

## 1. Error Handling — 6.5/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 1.1 | MEDIUM | Missing finally blocks — UI state set in try, cleaned up only in catch | Multiple async handlers | N/A (all audited files already use finally correctly) |
| 1.2 | MEDIUM | Double error log — backupManager logs + throws, caller also logs | `backupManager.js`, `backupRestoreManager.js` | Fixed ✅ |
| 1.3 | MEDIUM | Double error log — dueDates logs before throwing | `dueDates.js:130-187` | Fixed ✅ |
| 1.4 | LOW | Generic error messages lose context | `taskCompletion.js:77`, `taskCRUD.js:120` | Fixed ✅ |
| 1.5 | MEDIUM | Unchecked return values (updateCycleData, autoSave) | `dataAccess.js`, callers | Documented |
| 1.6 | LOW | No retry logic for localStorage/IndexedDB | Codebase-wide | Documented (intentional) |

**Positive patterns found:**
- Zero swallowed errors — all catch blocks include logging
- Good cleanup patterns in backupManager, appState, coreBoot
- Consistent try-catch in storage operations

**Fixes applied:**
- 1.2: Removed console.error from backupManager.createManualBackup() catch — it re-throws, so caller handles logging
- 1.3: Removed console.error before throw in dueDates.saveTaskDueDate() — throw carries the message
- 1.4: Changed generic "Core wait timeout or error" to include `error?.message || 'timeout'` in both files

---

## 2. Performance & DOM — 5.5/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 2.1 | HIGH | Redundant DOM queries — 7+ getElementById calls in sequence | `menuManager.js:167-214` | Fixed ✅ |
| 2.2 | HIGH | Redundant DOM queries — same selectors re-queried | `settingsUIManager.js:120-227` | Fixed ✅ |
| 2.3 | HIGH | querySelectorAll('.drop-target') on every dragover | `dragDropManager.js:490,636,651` | Fixed ✅ |
| 2.4 | HIGH | Layout thrashing — getBoundingClientRect then DOM writes | `dragDropManager.js:472-538` | Fixed ✅ |
| 2.5 | HIGH | Layout thrashing — 3 separate style writes for tooltip | `quickActionsManager.js:765-788` | Fixed ✅ |
| 2.6 | MEDIUM | 3 individual style writes for task options visibility | `taskUI.js:128-130`, `modalManager.js:155-157` | Fixed ✅ |
| 2.7 | MEDIUM | Unbatched sequential appendChild in loops | `quickActionsManager.js:237-316` | Fixed ✅ |
| 2.8 | HIGH | JSON.stringify on every task render for data attributes | `taskDOM.js:639,675` | Documented (arch change) |
| 2.9 | MEDIUM | Full re-render on view switch (5 slots — minimal cost) | `quickActionsManager.js:231-234` | Documented |
| 2.10 | MEDIUM | closeAllModals iterates all tasks (infrequent) | `modalManager.js:149-168` | Documented |

**Positive patterns found:**
- safeAddEventListener prevents duplicate listeners across 52+ modules
- WeakMap usage in taskDOM.js for automatic handler GC
- dragDropManager has internal 75ms debounce on rearrange

**Fixes applied:**
- 2.1: Cached 6 getElementById results as local consts in menuManager.setupMainMenu()
- 2.2: Cached collapsible sections NodeList in settingsUIManager, passed to load/save functions
- 2.3: Replaced querySelectorAll('.drop-target') with `_currentDropTarget` instance variable tracking — O(1) instead of O(n)
- 2.4: Batched DOM reads (nextSibling, previousSibling) into local consts before DOM writes in dragDropManager.handleRearrange()
- 2.5: Replaced 3 separate `style.*` writes with single `Object.assign(style, {...})` in quickActionsManager._showTooltip()
- 2.6: Added `.task-options-force-hidden` CSS class; replaced triple style writes with classList.add/remove in taskUI.js and modalManager.js
- 2.7: Used DocumentFragment in all 3 render methods (_renderPinnedSlots, _renderRecentActions, _renderFrequentActions)

---

## 3. Duplication & Coupling — 6/10

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 3.1 | MEDIUM | Data-attribute selector magic strings (12+ occurrences) | taskDOM, taskDOMPatch, taskRenderer, recurringPanel, recurringActivation, menuManager, preferencesManager | Fixed ✅ |
| 3.2 | LOW | taskUI triple-write duplicated across files (same as 2.6) | `taskUI.js`, `modalManager.js` | Fixed ✅ (via 2.6) |
| 3.3 | MEDIUM | 44+ duplicated "get active cycle then modify" pattern | Codebase-wide | Documented |
| 3.4 | MEDIUM | 11 files with duplicated task filtering logic | Codebase-wide | Documented |
| 3.5 | LOW | 6 giant modules >1,600 lines | recurringPanel, statsPanel, undoRedoManager, routineSwitcher, migrationManager, taskDOM | Documented |
| 3.6 | LOW | 1,800+ optional chaining instances, many redundant | Codebase-wide | Documented |
| 3.7 | LOW | 3 coexisting DI resolution patterns | Codebase-wide | Documented |

**Positive patterns found:**
- Solid DI foundation with createDIModule across 60+ modules
- Centralized constants (DOM_IDS, DOM_SELECTORS, DOM_CLASSES, STORAGE_KEYS, UI_TIMEOUTS, DATA_SELECTORS)
- Clear folder structure by feature

**Fixes applied:**
- 3.1: Added `DATA_SELECTORS` factory object to constants.js with 5 parameterized selector functions; migrated 11 selectors across 7 files
- 3.2: Eliminated by CSS class approach in fix 2.6

**Remaining conventions (for new code):**
- Use `DATA_SELECTORS` for any new parameterized data-attribute queries
- Use `DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN` for task options visibility (never inline styles)
- 3.3: Future — create `withActiveCycle()` utility to reduce AppState.update boilerplate
- 3.4: Future — add task query utilities to taskUtils.js

---

## Fix Priority

### HIGH Priority (Performance)
- [x] 2.1: Cache DOM queries in menuManager setupMainMenu()
- [x] 2.2: Cache DOM queries in settingsUIManager
- [x] 2.3: Replace querySelectorAll with instance tracking in dragDropManager
- [x] 2.4: Batch reads before writes in dragDropManager
- [x] 2.5: Batch tooltip style writes in quickActionsManager

### MEDIUM Priority (Error Handling + DOM)
- [x] 1.1: Audit finally blocks — all 4 audited files already correct
- [x] 1.2: Remove double error log in backupManager
- [x] 1.3: Remove double error log in dueDates
- [x] 2.6: Replace triple style writes with CSS class toggle
- [x] 2.7: Use DocumentFragment for batch appends in quickActionsManager
- [x] 3.1: Migrate data-attribute selectors to DATA_SELECTORS constants

### LOW Priority
- [x] 1.4: Improve error messages in taskCompletion and taskCRUD

---

## Verification

After fixes complete:
1. Run full test suite: `npm test` — 1611/1611 ✅
2. Grep audit: `grep -rn 'style\.visibility.*hidden' modules/ui/taskUI.js modules/ui/modalManager.js` — 0 matches ✅
3. Grep audit: `grep -rn "data-task-id=" modules/` — parameterized selectors use DATA_SELECTORS ✅
4. Manual smoke test: drag-and-drop tasks, open/close modals, toggle task options, quick actions views
