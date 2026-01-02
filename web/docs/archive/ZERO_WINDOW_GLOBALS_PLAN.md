# Zero Window Globals Plan

**Created:** December 2025
**Updated:** December 15, 2025
**Status:** ✅ COMPLETE
**Priority:** Medium
**Target:** 0 `window.*` globals (absolute zero, no exceptions)
**Completed:** December 15, 2025

---

## Executive Summary

Eliminate all `window.*` global variable usage from miniCycle, replacing with appContext APIs. This improves testability, eliminates implicit dependencies, and creates a cleaner architecture.

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

Run this to get current counts (searches entire project):
```bash
grep -rc "window\." . --include="*.js" --include="*.html" | grep -v ":0" | grep -v node_modules | sort -t: -k2 -rn | head -20
```

---

## Part 2: The Getter Sprawl Problem

### 2.1 The Risk

Replacing 270 `window.*` globals with 100+ tiny getters doesn't reduce complexity—it just moves it. "Getter sprawl" is the new "window sprawl."

```javascript
// ❌ BAD: 15 separate task getters
getAddTask()
getUpdateTask()
getDeleteTask()
getLoadTaskContext()
getCreateTaskDOMElements()
// ... this is still messy, just typed messy
```

### 2.2 The Solution: Grouped Domain APIs

Instead of many individual getters, group by domain:

```javascript
// ✅ GOOD: Grouped APIs
getTaskApi()    → { add, update, delete, loadContext, createDOM, ... }
getCycleApi()   → { load, create, reset, check, ... }
getUiApi()      → { showNotification, showModal, hideMenu, ... }
getStateApi()   → { AppState, AppGlobalState, AppMeta }
getUndoApi()    → { capture, undo, redo, updateButtons }
```

**Rule of thumb:** If you're about to add the 3rd getter in a domain, make it a `*Api` object instead.

### 2.3 Recommended API Groupings

| API Group | Contents |
|-----------|----------|
| `getStateApi()` | `AppState`, `AppGlobalState`, `AppMeta`, `loadMiniCycleData`, `autoSave` |
| `getTaskApi()` | `add`, `update`, `delete`, `loadContext`, `createDOM`, `extractFromDOM`, `handleCompleteAll` |
| `getCycleApi()` | `load`, `create`, `check`, `showCreationModal`, `createInitialSchema` |
| `getUiApi()` | `showNotification`, `hideMainMenu`, `updateMainMenuHeader` |
| `getUndoApi()` | `capture`, `undo`, `redo`, `updateButtons`, `enableOnFirstInteraction` |
| `getReminderApi()` | `manager`, `start`, `stop`, `updateButtons`, `loadSettings` |
| `getRecurringApi()` | `panel`, `core`, `openSettingsForTask` |

### 2.4 Implementation in appContext.js

```javascript
// In appContext.js

const context = {
    // Grouped APIs (preferred)
    stateApi: null,
    taskApi: null,
    cycleApi: null,
    uiApi: null,
    undoApi: null,
    reminderApi: null,
    recurringApi: null,

    // Individual values that don't fit a group
    appInit: null,
    GlobalUtils: null,
};

// Grouped API getters
export function getStateApi() {
    assertRegistered('stateApi');
    return context.stateApi;
}

export function getTaskApi() {
    assertRegistered('taskApi');
    return context.taskApi;
}

// ... etc
```

---

## Part 3: Fail Loudly in Dev

### 3.1 The Problem

If `getAppGlobalState()` is called before registration, it returns `null` and causes silent breakage downstream. This is how bugs like `extractTaskDataFromDOM` happen.

### 3.2 The Solution: Assert on Access

```javascript
// In appContext.js

const DEV_MODE = true; // Or check process.env.NODE_ENV

function assertRegistered(key) {
    if (context[key] === null) {
        const error = `❌ appContext: "${key}" accessed before registration!`;
        console.error(error);
        console.trace(); // Show call stack

        if (DEV_MODE) {
            throw new Error(error); // Fail hard in dev
        }
    }
}

export function getStateApi() {
    assertRegistered('stateApi');
    return context.stateApi;
}

export function getTaskApi() {
    assertRegistered('taskApi');
    return context.taskApi;
}

// Apply to ALL getters
```

### 3.3 Post-Boot Validation

Run after featureBoot completes, before uiBoot attaches listeners:

```javascript
// In appContext.js
export function validateAllApisRegistered() {
    const requiredApis = [
        'stateApi', 'taskApi', 'cycleApi', 'uiApi',
        'undoApi', 'reminderApi', 'recurringApi',
        'appInit', 'GlobalUtils'
    ];

    const missing = requiredApis.filter(key => context[key] === null);

    if (missing.length > 0) {
        console.error('❌ appContext validation failed!');
        console.error('Missing APIs:', missing);
        throw new Error(`Boot incomplete: missing ${missing.join(', ')}`);
    }

    console.log('✅ appContext validation passed - all APIs registered');
}
```

Call from orchestrator:
```javascript
// In orchestrator.js
await bootFeatures(deps, coreResult);
validateAllApisRegistered(); // BEFORE uiBoot
attachGlobalEventListeners();
```

---

## Part 4: Migration Strategy

### 4.1 Register Values as Grouped APIs

**In coreBoot.js** (early boot):
```javascript
import { setContextValue } from '../core/appContext.js';

// Register state API
setContextValue('stateApi', {
    AppState,
    AppGlobalState,
    AppMeta,
    loadMiniCycleData: () => loadMiniCycleData(),
    autoSave: (tasks, immediate) => autoSave(tasks, immediate),
});
```

**In featureBoot.js** (feature loading):
```javascript
// Register task API
setContextValue('taskApi', {
    add: deps.task.addTask,
    loadContext: deps.task.loadTaskContext,
    createDOM: deps.task.createTaskDOMElements,
    extractFromDOM: deps.task.extractTaskDataFromDOM,
    handleCompleteAll: deps.task.handleCompleteAllTasks,
});

// Register cycle API
setContextValue('cycleApi', {
    load: deps.cycle.loadMiniCycle,
    create: deps.cycle.showCycleCreationModal,
    check: deps.progress.checkMiniCycle,
    createInitialSchema: createInitialSchema25Data,
});

// Register UI API
setContextValue('uiApi', {
    showNotification: deps.utils.showNotification,
    hideMainMenu: deps.ui.hideMainMenu,
    updateMainMenuHeader: deps.ui.updateMainMenuHeader,
});
```

### 4.2 Replace window.* Reads with API Calls

```javascript
// BEFORE
const globalState = window.AppGlobalState;
window.showNotification?.('message', 'info');
window.addTask?.(text, false);

// AFTER
import { getStateApi, getUiApi, getTaskApi } from '../core/appContext.js';

const globalState = getStateApi().AppGlobalState;
getUiApi().showNotification?.('message', 'info');
getTaskApi().add?.(text, false);
```

### 4.3 Remove Public API Exposures (ONLY AFTER ALL READS MIGRATED)

**Critical:** Do NOT delete exposures until all callers are migrated.

**Order:**
1. First pass: Replace all reads in modules (`window.X` → `getXApi().x`)
2. Second pass: Replace UI callback reads (handlers that use `window.*`)
3. Third pass: Verify zero `window.*` reads remain (run verification)
4. **Only then:** Delete the exposure section in featureBoot.js

---

## Part 5: Fix HTML onclick Handler

### 5.1 The Problem

```html
<!-- miniCycle.html:1624 -->
<button class="btn-confirm" onclick="closeStorageViewer()">Close</button>
```

This requires `window.closeStorageViewer` to exist.

### 5.2 The Solution: Event Delegation

Use event delegation to handle dynamically created elements:

```javascript
// In testing-modal.js (or a global listener setup)

document.addEventListener('click', (e) => {
    // Handle storage viewer close button
    if (e.target.id === 'close-storage-viewer-btn' ||
        e.target.closest('#close-storage-viewer-btn')) {
        closeStorageViewer();
    }
});
```

**HTML change:**
```html
<!-- BEFORE -->
<button class="btn-confirm" onclick="closeStorageViewer()">Close</button>

<!-- AFTER -->
<button class="btn-confirm" id="close-storage-viewer-btn">Close</button>
```

**Why event delegation?** The testing modal might be injected late. Direct `getElementById` + `addEventListener` could miss it if the DOM isn't ready.

---

## Part 6: AppBootStarted Solution

### 6.1 Current Problem

```javascript
// In orchestrator.js
window.AppBootStarted = true;
```

This is the one remaining `window.*` assignment we need to eliminate.

### 6.2 The Solution: Dataset Attribute

```javascript
// In coreBoot.js (as early as possible, even before imports)
document.documentElement.dataset.appBooted = 'true';
```

**Checking boot status:**
```javascript
// In lite fallback or any code that needs to check
if (document.documentElement.dataset.appBooted === 'true') {
    // Main app has started booting
}
```

**Benefits:**
- No `window.*` pollution
- Works before any modules load (can be in inline script)
- Survives across module boundaries
- Clear semantic meaning

---

## Part 7: Implementation Phases (Refined Order)

The key insight: **Don't delete exposures until ALL callers are migrated.**

### Phase 1: Add APIs + Dev Protection ✅ COMPLETE
- [x] Add grouped API structure to appContext.js
- [x] Add `assertRegistered()` function
- [x] Add `validateAllApisRegistered()` function
- [x] Test that missing APIs throw errors in dev

### Phase 2: Register Early APIs ✅ COMPLETE
- [x] Register `stateApi` in coreBoot.js
- [x] Replace `window.AppBootStarted` with dataset attribute
- [x] Verify state API accessible after coreBoot

### Phase 3: Register Feature APIs ✅ COMPLETE
- [x] Register `taskApi` in featureBoot.js
- [x] Register `cycleApi` in featureBoot.js
- [x] Register `uiApi` in featureBoot.js
- [x] Register `undoApi` in featureBoot.js
- [x] Register `reminderApi` in featureBoot.js
- [x] Register `recurringApi` in featureBoot.js
- [x] Call `validateAllApisRegistered()` after boot

### Phase 4: Migrate AppGlobalState (51 refs) ✅ COMPLETE
- [x] Replace all `window.AppGlobalState` with `getStateApi().AppGlobalState`
- [x] Test after each file
- [x] This proves the pattern works at scale

### Phase 5: Migrate Remaining Reads ✅ COMPLETE
- [x] Migrate all other `window.*` reads (~185)
- [x] Focus on one file at a time
- [x] Test incrementally

### Phase 6: Fix HTML onclick ✅ COMPLETE
- [x] Replace onclick handlers with CustomEvent dispatching
- [x] Add event listeners in featureBoot.js for CustomEvents
- [x] Test storage viewer still works

### Phase 7: Delete Exposures ✅ COMPLETE
- [x] Removed all `window.*` assignments in featureBoot.js
- [x] Removed `window.*` exposures in appGlobalState.js
- [x] Removed dead code file: testing-modal-modifications.js
- [x] Full regression test

### Phase 8: CI Integration (Optional - Future)
- [ ] Add verification script to CI
- [ ] Ensure builds fail on `window.*` violations
- [ ] Document in README

---

## Part 8: Verification

### 8.1 Verification Script (Searches Entire Project)

Create `scripts/verify-no-window-globals.sh`:

```bash
#!/bin/bash
# Verify zero custom window.* globals across entire project

echo "🔍 Checking for window.* globals..."

# Exclude browser APIs
EXCLUDE="window\.location|window\.matchMedia|window\.addEventListener|window\.removeEventListener|window\.innerWidth|window\.innerHeight|window\.scrollY|window\.scrollX|window\.getComputedStyle|window\.requestAnimationFrame|window\.confirm|window\.open|window\.setTimeout|window\.clearTimeout|window\.setInterval|window\.clearInterval|window\.localStorage|window\.sessionStorage|window\.navigator|window\.screen|window\.performance|window\.history|window\.document|window\.alert|window\.fetch|window\.URL|window\.Blob|window\.File|window\.FormData|window\.Headers|window\.Request|window\.Response|window\.crypto|window\.indexedDB|window\.caches|window\.Promise|window\.Map|window\.Set|window\.WeakMap|window\.WeakSet|window\.Symbol|window\.Proxy|window\.Reflect|window\.ArrayBuffer|window\.DataView|window\.JSON|window\.Math|window\.Date|window\.RegExp|window\.Error|window\.console|window\.self|window\.parent|window\.top|window\.frames|window\.frameElement|window\.onerror|window\.onload|window\.onbeforeunload|window\.onunload|window\.onresize|window\.onscroll|window\.dispatchEvent|window\.CustomEvent|window\.Event|window\.focus|window\.blur|window\.print|window\.atob|window\.btoa|window\.encodeURI|window\.decodeURI|window\.encodeURIComponent|window\.decodeURIComponent|window\.escape|window\.unescape|window\.isNaN|window\.isFinite|window\.parseFloat|window\.parseInt|window\.Object|window\.Array|window\.String|window\.Number|window\.Boolean|window\.Function|window\.eval|window\.getSelection|window\.devicePixelRatio|window\.visualViewport|window\.speechSynthesis|window\.Notification|window\.Worker|window\.ServiceWorker|window\.BroadcastChannel|window\.MessageChannel|window\.requestIdleCallback|window\.cancelIdleCallback|window\.queueMicrotask|window\.reportError|window\.structuredClone"

# NO window.debug allowed - absolute zero policy
# Also allow window.APP_VERSION (build-time constant)
EXCLUDE="$EXCLUDE|window\.APP_VERSION"

# Search entire project (not just modules)
SEARCH_PATHS="modules miniCycle.html"

# Count violations (excluding comments)
VIOLATIONS=$(grep -rE "window\.[a-zA-Z_]+" $SEARCH_PATHS --include="*.js" --include="*.html" 2>/dev/null | grep -vE "$EXCLUDE" | grep -vE "^\s*//" | grep -vE "<!--.*-->" | wc -l | tr -d ' ')

if [ "$VIOLATIONS" -eq "0" ]; then
    echo "✅ Zero custom window.* globals found!"
    exit 0
else
    echo "❌ Found $VIOLATIONS window.* violations:"
    echo ""
    grep -rn "window\.[a-zA-Z_]+" $SEARCH_PATHS --include="*.js" --include="*.html" 2>/dev/null | grep -vE "$EXCLUDE" | grep -vE "^\s*//" | grep -vE "<!--.*-->"
    exit 1
fi
```

### 8.2 Run Before Deleting Exposures

```bash
chmod +x scripts/verify-no-window-globals.sh
./scripts/verify-no-window-globals.sh
```

**If this doesn't pass, DO NOT proceed to Phase 7.**

### 8.3 CI Integration

```yaml
# In .github/workflows/ci.yml
- name: Verify no window globals
  run: ./scripts/verify-no-window-globals.sh
```

---

## Part 9: Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Custom `window.*` assignments | 34 | **0** |
| Custom `window.*` reads | 236 | **0** |
| HTML onclick using globals | 1 | **0** |
| `window.debug` or similar | N/A | **Explicitly forbidden** |
| Individual getters in appContext | N/A | **Grouped into ~7 APIs** |
| Missing registration detection | Silent null | **Throws in dev** |
| Verification script | N/A | **Passes + in CI** |

---

## Part 10: Rollback Plan

If issues arise after removing `window.*` exposures:

1. **Quick rollback:** Re-add the specific `window.*` assignment that's needed
2. **Identify the caller:** The dev assertion should show the call stack
3. **Fix properly:** Update caller to use API getter, then remove `window.*` again

**Keep a git branch before Phase 7:**
```bash
git checkout -b pre-zero-globals
git tag v1.x-pre-zero-globals
```

---

## Appendix A: API Reference

### getStateApi()
```javascript
{
    AppState,           // The state manager
    AppGlobalState,     // Runtime flags
    AppMeta,            // Version info
    loadMiniCycleData,  // Load from storage
    autoSave,           // Save to storage
}
```

### getTaskApi()
```javascript
{
    add,                // Add new task
    loadContext,        // Load task context
    createDOM,          // Create DOM elements
    extractFromDOM,     // Extract data from DOM
    handleCompleteAll,  // Complete all handler
}
```

### getCycleApi()
```javascript
{
    load,               // Load a cycle
    create,             // Show creation modal
    check,              // Check cycle completion
    createInitialSchema,// Create initial data
}
```

### getUiApi()
```javascript
{
    showNotification,   // Show notification
    hideMainMenu,       // Hide menu
    updateMainMenuHeader, // Update header
}
```

### getUndoApi()
```javascript
{
    capture,            // Capture snapshot
    undo,               // Perform undo
    redo,               // Perform redo
    updateButtons,      // Update UI buttons
    enableOnFirstInteraction, // Enable on interaction
}
```

### getReminderApi()
```javascript
{
    manager,            // Reminder manager instance
    start,              // Start reminders
    stop,               // Stop reminders
    updateButtons,      // Update UI
    loadSettings,       // Load settings
}
```

### getRecurringApi()
```javascript
{
    panel,              // Recurring panel
    core,               // Recurring core
    openSettingsForTask,// Open settings
}
```

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

## Appendix C: Old Getter Mapping (For Reference)

If you prefer individual getters over grouped APIs, here's the mapping:

| Old (window.*) | Individual Getter | Grouped API |
|----------------|-------------------|-------------|
| `window.AppState` | `getAppState()` | `getStateApi().AppState` |
| `window.AppGlobalState` | `getAppGlobalState()` | `getStateApi().AppGlobalState` |
| `window.addTask` | `getAddTask()` | `getTaskApi().add` |
| `window.showNotification` | `getShowNotification()` | `getUiApi().showNotification` |
| `window.checkMiniCycle` | `getCheckMiniCycle()` | `getCycleApi().check` |

**Recommendation:** Use grouped APIs. They're more maintainable.

---

## References

- `docs/future-work/ORCHESTRATOR_REFACTOR_PLAN.md` - Related refactoring
- `docs/future-work/WINDOW_GLOBALS_REDUCTION_PLAN.md` - Previous reduction work
- `modules/core/appContext.js` - DI implementation

---

## Completion Summary (December 15, 2025)

### What Was Achieved

The miniCycle application now has **zero custom window.* globals**. All module communication happens through:

1. **ES Module imports** - Direct function/class imports
2. **appContext.js grouped APIs** - `getStateApi()`, `getTaskApi()`, `getUiApi()`, etc.
3. **CustomEvents** - For HTML-to-module communication (e.g., `app:showNotification`)
4. **Dataset attributes** - For boot flags (`document.documentElement.dataset.appBooted`)

### Key Changes Made

| File | Change |
|------|--------|
| `modules/core/appGlobalState.js` | Removed all `window.*` exposures and backward-compat property getters |
| `modules/boot/featureBoot.js` | Replaced `window.*` exposures with CustomEvent listeners |
| `modules/boot/orchestrator.js` | Removed `window.closeStorageViewer` and `window.AppState = null` |
| `modules/boot/uiBoot.js` | Changed to `dataset.appLoaded` instead of `window.__cancelLoadTimeout` |
| `modules/boot/coreBoot.js` | Changed bootStartTime to dataset attribute |
| `modules/utils/notifications.js` | Removed `window.isDraggingNotification` sync |
| `modules/testing/testing-modal-modifications.js` | **DELETED** (was dead code) |
| `miniCycle.html` | Added `_notify()` and `_confirm()` helpers that dispatch CustomEvents |

### Remaining window.* (Legitimate)

Only browser API event handlers remain:
- `window.onload` in orchestrator.js (boot entry point)
- `window.onerror` in errorHandler.js (global error handler)

These are standard browser patterns and are explicitly allowed.

### How HTML Communicates with Modules Now

```javascript
// In miniCycle.html - dispatch CustomEvent
function _notify(message, type, duration) {
  document.dispatchEvent(new CustomEvent('app:showNotification', {
    detail: { message, type, duration }
  }));
}

// In featureBoot.js - listen and handle
document.addEventListener('app:showNotification', (e) => {
  const { message, type, duration } = e.detail || {};
  deps.utils.showNotification?.(message, type, duration);
});
```

### Bug Fixes Included

1. **Duplicate tasks on mode switch** - Fixed by checking `event.isTrusted` in `modeManager.js` to skip `refreshTaskListUI()` on programmatic change events
2. **Recurring button not showing on load** - Fixed by calling `updateRecurringPanelButtonVisibility()` at end of recurring module initialization
