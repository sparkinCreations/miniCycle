# Zero Window Globals Plan

**Created:** December 2025
**Status:** Planning
**Priority:** Medium
**Target:** 0 `window.*` globals (absolute zero, no exceptions)

---

## Executive Summary

Eliminate all `window.*` global variable usage from miniCycle, replacing with appContext getters. This improves testability, eliminates implicit dependencies, and creates a cleaner architecture.

**Current:** ~270 `window.*` usages
**Target:** Absolute 0 (no debug namespace, no exceptions)

> **Policy:** No `window.debug`, `window.miniCycle`, or any other "convenience" namespace will be added. Zero means zero. Debugging is done via DevTools localStorage inspection or dynamic ES module imports in console.

---

## Part 1: Current State Analysis

### 1.1 Summary

| Category | Count | Location |
|----------|-------|----------|
| Intentional public API exposures | 34 | `featureBoot.js:1249-1312` |
| Internal `window.*` reads | 236 | Throughout modules |
| HTML onclick handlers | 1 | `miniCycle.html:1624` |
| **Total** | **~270** | |

### 1.2 Top Offenders by Usage Count

```
51x  window.AppGlobalState     - Runtime flags
 7x  window.AppState           - State access
 5x  window.AppMeta            - Version metadata
 5x  window.removeEventListener - Browser API (KEEP)
 4x  window.loadMiniCycle      - Cycle loading
 3x  window.showCycleCreationModal
 3x  window.enableUndoSystemOnFirstInteraction
 3x  window.createInitialSchema25Data
 3x  window.AppBootStarted     - Boot detection flag
 3x  window.addTask
```

### 1.3 Files with Most window.* References

Run this to get current counts:
```bash
grep -rc "window\." modules --include="*.js" | grep -v ":0" | sort -t: -k2 -rn | head -20
```

---

## Part 2: Migration Strategy

### 2.1 Add Missing Getters to appContext.js

**New getters needed:**

```javascript
// In appContext.js - add to context object
const context = {
    // ... existing keys ...

    // ADD THESE:
    AppGlobalState: null,        // Currently 51 window.* refs
    AppMeta: null,               // Currently 5 window.* refs
    createInitialSchema25Data: null,
    closeStorageViewer: null,    // For testing modal
};

// ADD THESE GETTER FUNCTIONS:
export function getAppGlobalState() { return context.AppGlobalState; }
export function getAppMeta() { return context.AppMeta; }
export function getCreateInitialSchema25Data() { return context.createInitialSchema25Data; }
export function getCloseStorageViewer() { return context.closeStorageViewer; }
```

### 2.2 Register Values During Boot

**In coreBoot.js** (for early-boot values):
```javascript
// AppGlobalState is created here, register immediately
setContextValue('AppGlobalState', AppGlobalState);
setContextValue('AppMeta', AppMeta);
```

**In featureBoot.js** (for feature values):
```javascript
// Register instead of window.* exposure
setContextValue('createInitialSchema25Data', createInitialSchema25Data);
```

### 2.3 Replace window.* Reads with Getters

**Pattern:**
```javascript
// BEFORE
const globalState = window.AppGlobalState;
if (window.AppGlobalState?.isPerformingUndoRedo) { ... }

// AFTER
import { getAppGlobalState } from '../core/appContext.js';
const globalState = getAppGlobalState();
if (getAppGlobalState()?.isPerformingUndoRedo) { ... }
```

### 2.4 Remove Public API Exposures

**In featureBoot.js**, delete lines 1247-1314:
```javascript
// DELETE THIS ENTIRE SECTION:
// ============================================================================
// WINDOW.* EXPOSURES - PUBLIC API
// ============================================================================
window.AppState = deps.core.AppState;
window.AppGlobalState = AppGlobalState;
// ... all 34 lines
```

### 2.5 Fix HTML onclick Handler

**In miniCycle.html:1624:**
```html
<!-- BEFORE -->
<button class="btn-confirm" onclick="closeStorageViewer()">Close</button>

<!-- AFTER -->
<button class="btn-confirm" id="close-storage-viewer-btn">Close</button>
```

**In testing-modal.js:**
```javascript
// Add event listener instead of relying on window global
document.getElementById('close-storage-viewer-btn')
    ?.addEventListener('click', closeStorageViewer);
```

### 2.6 No Debug Namespace (Explicitly Rejected)

**We are NOT adding a `window.debug` namespace.**

Rationale:
- The goal is absolute zero `window.*` globals, no exceptions
- Debugging can be done via DevTools Application tab (localStorage inspection)
- If programmatic debugging is needed, import getters directly in DevTools console:
  ```javascript
  // In DevTools console, use dynamic import:
  const { getAppState, getAppContext } = await import('./modules/core/appContext.js');
  getAppState()?.get();
  ```
- Any "convenience" global is a slippery slope back to pollution

**This decision is final. Do not add window.debug or any similar namespace.**

---

## Part 3: File-by-File Migration Guide

### 3.1 High Priority (>10 references)

#### `modules/boot/orchestrator.js`
- [ ] Replace `window.AppGlobalState` with `getAppGlobalState()`
- [ ] Replace `window.AppMeta` with `getAppMeta()`
- [ ] Remove any `window.*` assignments
- [ ] Import required getters at top of file

#### `modules/boot/featureBoot.js`
- [ ] Delete all `window.*` exposures (lines 1247-1314)
- [ ] Ensure all values are registered via `setContextValue()` instead
- [ ] Keep `window.closeStorageViewer` temporarily until HTML onclick is fixed

#### `modules/core/appGlobalState.js`
- [ ] Remove any `window.AppGlobalState` self-assignment
- [ ] Export only via module system

### 3.2 Medium Priority (3-10 references)

#### `modules/cycle/cycleLoader.js`
- [ ] Replace `window.loadMiniCycle` references
- [ ] Replace `window.addTask` with `getAddTask()`
- [ ] Replace `window.createInitialSchema25Data` with getter

#### `modules/ui/undoRedoManager.js`
- [ ] Replace `window.AppGlobalState` with getter
- [ ] Replace `window.performStateBasedUndo/Redo` with getters
- [ ] Replace `window.enableUndoSystemOnFirstInteraction` with getter

#### `modules/features/reminders.js`
- [ ] Replace `window.startReminders` with getter
- [ ] Replace `window.updateReminderButtons` with getter
- [ ] Replace `window.loadRemindersSettings` with getter

#### `modules/cycle/modeManager.js`
- [ ] Replace `window.saveToggleAutoReset` with getter
- [ ] Replace `window.syncCurrentSettingsToStorage` with getter

### 3.3 Low Priority (1-2 references)

These files have minimal `window.*` usage - update as encountered:

- `modules/ui/menuManager.js`
- `modules/ui/settingsManager.js`
- `modules/ui/taskUI.js`
- `modules/task/taskCore.js`
- `modules/task/taskDOM.js`
- `modules/progress/cycleCompletion.js`
- `modules/recurring/recurringCore.js`
- `modules/recurring/recurringPanel.js`
- `modules/testing/testing-modal.js`

---

## Part 4: Special Cases

### 4.1 window.AppBootStarted

**Purpose:** Prevents lite fallback loader from showing

**Current:**
```javascript
// In orchestrator.js
window.AppBootStarted = true;
```

**Solution:** Keep this ONE exception OR move boot detection to a different mechanism:
```javascript
// Alternative: Use a meta tag or data attribute
document.documentElement.dataset.appBooted = 'true';

// Lite fallback checks:
if (document.documentElement.dataset.appBooted) { ... }
```

### 4.2 window.removeEventListener / window.addEventListener

**These are browser APIs, not custom globals. KEEP THEM.**

They're standard DOM methods and don't count toward our zero goal.

### 4.3 window.localStorage / window.sessionStorage

**These are browser APIs. KEEP THEM.**

### 4.4 window.location / window.matchMedia / etc.

**These are browser APIs. KEEP THEM.**

Our goal is zero *custom* `window.*` globals, not removing browser API usage.

---

## Part 5: Implementation Phases

### Phase 1: Preparation (Low Risk)
- [ ] Add all missing keys to `context` object in appContext.js
- [ ] Add all missing getter functions
- [ ] Add `getAppGlobalState()` getter (biggest impact - 51 refs)
- [ ] Add `getAppMeta()` getter

**Estimated:** 30 minutes

### Phase 2: Registration (Low Risk)
- [ ] Register `AppGlobalState` in coreBoot.js
- [ ] Register `AppMeta` in coreBoot.js
- [ ] Register remaining values in featureBoot.js via `setContextValue()`

**Estimated:** 30 minutes

### Phase 3: Big Migration - AppGlobalState (Medium Risk)
- [ ] Find all 51 `window.AppGlobalState` references
- [ ] Update each to use `getAppGlobalState()`
- [ ] Test after each file

**Estimated:** 2-3 hours

### Phase 4: Remaining Migrations (Medium Risk)
- [ ] Migrate all other `window.*` reads (~185 remaining)
- [ ] Group by file, update systematically
- [ ] Test incrementally

**Estimated:** 3-4 hours

### Phase 5: Remove Public API Exposures (Higher Risk)
- [ ] Delete `window.*` assignments in featureBoot.js
- [ ] Fix HTML onclick handler
- [ ] Verify NO debug namespace is added (policy: absolute zero)
- [ ] Full regression test

**Estimated:** 1 hour

### Phase 6: Cleanup & Verification
- [ ] Run verification script (see below)
- [ ] Fix any stragglers
- [ ] Update documentation

**Estimated:** 30 minutes

---

## Part 6: Verification

### 6.1 Verification Script

Create `scripts/verify-no-window-globals.sh`:

```bash
#!/bin/bash
# Verify zero custom window.* globals

echo "🔍 Checking for window.* globals..."

# Exclude browser APIs
EXCLUDE="window\.location|window\.matchMedia|window\.addEventListener|window\.removeEventListener|window\.innerWidth|window\.innerHeight|window\.scrollY|window\.getComputedStyle|window\.requestAnimationFrame|window\.confirm|window\.open|window\.setTimeout|window\.clearTimeout|window\.localStorage|window\.sessionStorage|window\.navigator|window\.screen|window\.performance|window\.history|window\.document|window\.alert|window\.fetch|window\.URL|window\.Blob|window\.File|window\.FormData|window\.Headers|window\.Request|window\.Response|window\.crypto|window\.indexedDB|window\.caches|window\.Promise|window\.Map|window\.Set|window\.WeakMap|window\.WeakSet|window\.Symbol|window\.Proxy|window\.Reflect|window\.ArrayBuffer|window\.DataView|window\.JSON|window\.Math|window\.Date|window\.RegExp|window\.Error|window\.console|window\.self|window\.parent|window\.top|window\.frames|window\.frameElement|window\.onerror|window\.onload"

# NO window.debug allowed - absolute zero policy

# Also allow window.APP_VERSION (build-time constant)
EXCLUDE="$EXCLUDE|window\.APP_VERSION"

# Count violations
VIOLATIONS=$(grep -rE "window\.[a-zA-Z_]+" modules --include="*.js" | grep -vE "$EXCLUDE" | grep -vE "^\s*//" | wc -l)

if [ "$VIOLATIONS" -eq 0 ]; then
    echo "✅ Zero custom window.* globals found!"
    exit 0
else
    echo "❌ Found $VIOLATIONS window.* violations:"
    grep -rE "window\.[a-zA-Z_]+" modules --include="*.js" | grep -vE "$EXCLUDE" | grep -vE "^\s*//"
    exit 1
fi
```

### 6.2 Run Verification

```bash
chmod +x scripts/verify-no-window-globals.sh
./scripts/verify-no-window-globals.sh
```

### 6.3 Add to CI/Pre-commit (Optional)

```yaml
# In .github/workflows/ci.yml or pre-commit hook
- name: Verify no window globals
  run: ./scripts/verify-no-window-globals.sh
```

---

## Part 7: Rollback Plan

If issues arise after removing `window.*` exposures:

1. **Quick rollback:** Re-add the specific `window.*` assignment that's needed
2. **Identify the caller:** Find what's still using `window.*` instead of getter
3. **Fix properly:** Update caller to use getter, then remove `window.*` again

Keep a git branch/tag before Phase 5 for easy rollback:
```bash
git checkout -b pre-zero-globals
git tag v1.x-pre-zero-globals
```

---

## Part 8: Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Custom `window.*` assignments | 34 | **0** |
| Custom `window.*` reads | 236 | **0** |
| HTML onclick using globals | 1 | **0** |
| `window.debug` or similar | N/A | **Explicitly forbidden** |
| Verification script | N/A | Passes |
| All tests passing | Yes | Yes |
| App functions correctly | Yes | Yes |

---

## Part 9: Files to Modify (Complete List)

### Must Modify:
- `modules/core/appContext.js` - Add getters
- `modules/boot/coreBoot.js` - Register early values
- `modules/boot/featureBoot.js` - Remove exposures, register via setContextValue
- `modules/boot/orchestrator.js` - Replace reads with getters
- `miniCycle.html` - Fix onclick handler

### Likely Modify (based on grep counts):
- `modules/core/appGlobalState.js`
- `modules/cycle/cycleLoader.js`
- `modules/ui/undoRedoManager.js`
- `modules/features/reminders.js`
- `modules/cycle/modeManager.js`
- `modules/ui/menuManager.js`
- `modules/ui/settingsManager.js`
- `modules/task/taskCore.js`
- `modules/task/taskDOM.js`
- `modules/testing/testing-modal.js`

### Possibly Modify (1-2 refs each):
- ~15 other module files

---

## Appendix A: Quick Reference - Getter Mapping

| Old (window.*) | New (getter) |
|----------------|--------------|
| `window.AppState` | `getAppState()` |
| `window.AppGlobalState` | `getAppGlobalState()` |
| `window.AppMeta` | `getAppMeta()` |
| `window.loadMiniCycleData` | `getLoadMiniCycleData()` |
| `window.autoSave` | `getAutoSave()` |
| `window.showNotification` | `getShowNotification()` |
| `window.addTask` | `getAddTask()` |
| `window.handleCompleteAllTasks` | `getHandleCompleteAllTasks()` |
| `window.loadMiniCycle` | `getLoadMiniCycle()` *(add)* |
| `window.checkMiniCycle` | `getCheckMiniCycle()` *(add)* |
| `window.showCycleCreationModal` | `getShowCycleCreationModal()` |
| `window.hideMainMenu` | `getHideMainMenu()` |
| `window.updateMainMenuHeader` | `getUpdateMainMenuHeader()` |
| `window.reminderManager` | `getReminderManager()` |
| `window.startReminders` | `getStartReminders()` |
| `window.recurringPanel` | `getRecurringPanel()` |
| `window.recurringCore` | `getRecurringCore()` *(add)* |
| `window.captureStateSnapshot` | `getCaptureStateSnapshot()` |
| `window.performStateBasedUndo` | `getPerformStateBasedUndo()` |
| `window.performStateBasedRedo` | `getPerformStateBasedRedo()` |
| `window.updateUndoRedoButtons` | `getUpdateUndoRedoButtons()` |
| `window.createInitialSchema25Data` | `getCreateInitialSchema25Data()` *(add)* |

---

## Appendix B: Browser APIs (DO NOT REMOVE)

These `window.*` usages are standard browser APIs and should NOT be changed:

- `window.addEventListener` / `window.removeEventListener`
- `window.location`
- `window.localStorage` / `window.sessionStorage`
- `window.matchMedia`
- `window.innerWidth` / `window.innerHeight`
- `window.scrollY` / `window.scrollX`
- `window.getComputedStyle`
- `window.requestAnimationFrame`
- `window.setTimeout` / `window.clearTimeout`
- `window.confirm` / `window.alert`
- `window.open`
- `window.screen`
- `window.navigator`
- `window.performance`
- `window.fetch`
- `window.crypto`
- `window.indexedDB`
- `window.caches`

---

## References

- `docs/future-work/ORCHESTRATOR_REFACTOR_PLAN.md` - Related refactoring
- `docs/future-work/WINDOW_GLOBALS_REDUCTION_PLAN.md` - Previous reduction work
- `modules/core/appContext.js` - DI implementation
