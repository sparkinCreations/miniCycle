# Orchestrator Refactor & DI Standardization Plan

**Created:** December 2025
**Updated:** December 15, 2025
**Status:** ✅ PARTIAL COMPLETE (Phase 1-2 done, Phase 3-5 deferred)
**Priority:** Medium
**Related:** MODULAR_OVERHAUL_PLAN.md, ZERO_WINDOW_GLOBALS_PLAN.md (COMPLETE)

---

## Executive Summary

The orchestrator is carrying legacy weight that makes it feel like it "handles too many possibilities." This plan focuses on making orchestrator small and boring (in a good way) by:

1. **Deleting redundant code** - featureBoot already handles most of what orchestrator duplicates
2. **Enforcing single DI pattern** - appContext getters everywhere, no tri-mix
3. **Moving cross-cutting concerns** - Undo wrapper belongs in undoRedoManager, not boot code

**Target:** Orchestrator should do only 5 things:
```javascript
async function initApp() {
    const deps = createDepsContainer();
    await initCoreBoot(deps);
    await bootFeatures(deps, coreResult);
    attachGlobalEventListeners();
    hideAppLoader();
}
```

Everything else belongs in the module that owns it.

---

## Part 1: What's Strong (Keep This)

### 1.1 Clear Boot Layering
- `coreBoot` establishes foundation early (sets `window.AppBootStarted` immediately)
- `featureBoot` wires almost everything
- `uiBoot` focuses on global event listeners/helpers

### 1.2 deps Container is the Right Idea
Feature modules should talk through injected functions/objects, not reach into `window.*`.

### 1.3 Back-Compat Strategy is Explicit
featureBoot has a dedicated "WINDOW.* EXPOSURES" section - the right place to centralize globals while migrating.

---

## Part 2: The Core Problem

### 2.1 The Tri-Mix is Why It Feels Huge

Orchestrator uses three dependency systems simultaneously:

| Pattern | Example | Problem |
|---------|---------|---------|
| `deps.*` | `deps.core.loadMiniCycleData` | DI container |
| `appContext getters` | `getAppState()` | Service locator |
| `window.*` | `window.AppState` | Legacy global |

Every code path needs 3 compatibility hooks. This is the root cause of the bloat.

### 2.2 Orchestrator Duplicates featureBoot Work

Orchestrator imports/initializes modules that featureBoot already handles:
- Notifications
- Theme manager
- Onboarding
- Console capture
- Error handler

This creates:
- **Double wiring risk** - Module gets dependencies twice
- **"Who owns the truth?" confusion** - `deps.utils.showNotification` vs `appContext` vs `window`
- **Hard-to-debug ordering bugs**

### 2.3 Cross-Cutting Logic Lives in Wrong Place

The `AppState.update` wrapper (undo snapshot capture) at `orchestrator.js:647-681` is classic "orchestrator bloat." This behavior belongs in:
- `undoRedoManager.js` (since it owns undo capture), OR
- `AppState` itself as middleware: `AppState.addMiddleware('beforeUpdate', fn)`

---

## Part 3: The Ideal Orchestrator

### 3.1 Job Description

Orchestrator should do **only** this:

```javascript
async function initApp() {
    // 1. Create deps container
    const deps = {
        utils: {}, features: {}, ui: {}, core: {},
        task: {}, cycle: {}, recurring: {}, progress: {},
        storage: {}, testing: {}
    };

    // 2. Initialize core (AppState, appInit, GlobalUtils)
    const coreResult = await initCoreBoot(deps);
    if (!coreResult) return; // Reload happening

    // 3. Load all features (this does the real work)
    await bootFeatures(deps, coreResult);

    // 4. Attach global event listeners
    attachGlobalEventListeners();

    // 5. Done
    hideAppLoader();
    validateContext();
}
```

**That's it.** Everything else belongs in the module that owns it.

### 3.2 What This Means

| Currently In Orchestrator | Should Be In |
|---------------------------|--------------|
| Utility module imports | **DELETE** - featureBoot handles it |
| Theme loading | **DELETE** - featureBoot handles it |
| Notifications setup | **DELETE** - featureBoot handles it |
| AppState.update wrapper | `undoRedoManager.js` |
| DOM element references | `uiBoot.js` |
| Inline event handlers | Respective feature modules |
| Title listener | NEW `titleManager.js` |
| Recurring handlers | `recurringIntegration.js` |

---

## Part 4: Concrete Refactor Steps

### Step A: Delete Utility Module Imports Block (SAFE)

**Current Location:** `orchestrator.js:249-326`

This entire block is redundant - featureBoot already handles:
- Error handler
- Data validator
- Console capture
- Notifications
- Theme manager

**Action:** Delete lines 249-326. Trust featureBoot.

### Step B: featureBoot is Single Source of Globals (SAFE)

**Rule:** Orchestrator NEVER sets `window.*` except the one boot flag (which is already in coreBoot).

**Current violation:** Orchestrator still touches `window.*` in various places.

**Action:**
1. Search orchestrator for `window.` assignments
2. Delete them - featureBoot's "WINDOW.* EXPOSURES" section is the only place globals are set
3. If something breaks, add it to featureBoot, not orchestrator

### Step C: Move AppState.update Snapshot Wrapper (MEDIUM)

**Current Location:** `orchestrator.js:647-681`

```javascript
// THIS DOESN'T BELONG HERE
AppState.update = async (producer, immediate) => {
    // Capture undo snapshot before update
    if (appInitRef?.isCoreReady?.() && !globalState?.isPerformingUndoRedo) {
        const prev = boundGet();
        if (prev) captureSnapshot(prev);
    }
    return boundUpdate(producer, immediate);
};
```

**Action:** Move to `undoRedoManager.js`:

```javascript
// In undoRedoManager.js
export function wrapAppStateForUndo(AppState, getAppGlobalState, captureSnapshot) {
    const boundUpdate = AppState.update.bind(AppState);
    const boundGet = AppState.get.bind(AppState);

    AppState.update = async (producer, immediate) => {
        const globalState = getAppGlobalState();
        if (!globalState?.isPerformingUndoRedo) {
            const prev = boundGet();
            if (prev) captureSnapshot(prev);
        }
        return boundUpdate(producer, immediate);
    };
}
```

Call from featureBoot after undoRedoManager loads:
```javascript
// In featureBoot.js, Phase 6 (UI modules)
undoRedoManager.wrapAppStateForUndo(AppState, getAppGlobalState, captureSnapshot);
```

### Step D: uiBoot Should Use appContext, Not window.* (GRADUAL)

**Current problem:** uiBoot still calls `window.addTask`, `window.performStateBasedUndo`, etc.

**Already started:** uiBoot uses some appContext getters (`getAppState`, `getShowNotification`).

**Action:** Continue pushing this direction:

```javascript
// BEFORE (uiBoot.js)
window.addTask?.(...);
window.performStateBasedUndo?.();

// AFTER
getAddTask()?.(...);
getPerformStateBasedUndo()?.();
```

---

## Part 5: Delete List

### 5.1 Safe Deletions (featureBoot Already Handles)

These can be deleted immediately - featureBoot already does this work:

| Lines (approx) | What | Why Safe |
|----------------|------|----------|
| 249-270 | Error handler import/init | featureBoot Phase 1 |
| 271-282 | Console capture import/init | featureBoot Phase 1 |
| 283-326 | Notifications import/init | featureBoot Phase 1 |
| 328-340 | Theme manager deps setup | featureBoot Phase 2 |
| 342-354 | Games manager init | featureBoot Phase 6 |
| 356-375 | Onboarding manager init | featureBoot Phase 6 |

**Total safe deletion:** ~125 lines

### 5.2 Medium Risk Deletions (Need Verification)

| Lines (approx) | What | Risk |
|----------------|------|------|
| 647-681 | AppState.update wrapper | Must move to undoRedoManager first |
| 429-456 | DOM element references | Must add to uiBoot first |
| 476-510 | Recurring handlers | Must move to recurringIntegration first |

### 5.3 Requires New Module First

| Lines (approx) | What | Prerequisite |
|----------------|------|--------------|
| 1076-1151 | Title listener | Create `titleManager.js` |
| 1177-1200 | Reminder handlers | Move to `reminders.js` |
| 1232-1239 | Recurring panel handler | Move to `recurringPanel.js` |

---

## Part 6: DI Pattern Standardization

### 6.1 The Single Pattern

**Standardize on appContext getters everywhere:**

```javascript
// ✅ THE ONLY PATTERN
import { getAppState, getShowNotification } from '../core/appContext.js';

function doSomething() {
    const AppState = getAppState();
    getShowNotification()?.('message', 'info');
}
```

### 6.2 Migration Order

1. **Orchestrator first** - Replace all `deps.xyz` with getters
2. **uiBoot second** - Replace all `window.xyz` with getters
3. **featureBoot** - Keep `deps` for collecting, but modules receive getters
4. **Class modules** - `this.deps` stores getters from appContext

### 6.3 What to Stop Doing

| Don't Do This | Do This Instead |
|---------------|-----------------|
| `deps.core.AppState` | `getAppState()` |
| `deps.utils.showNotification` | `getShowNotification()` |
| `window.addTask` | `getAddTask()` |
| `this.deps.xyz = window.xyz` | `this.deps.xyz = getXyz` |

---

## Part 7: Boot Sequence Hardening

### 7.1 Add Post-Boot Validation

```javascript
// In appContext.js
export function validateContext() {
    const requiredKeys = [
        'AppState', 'appInit', 'loadMiniCycleData', 'autoSave',
        'showNotification', 'addTask', 'extractTaskDataFromDOM',
        // ... all required keys
    ];

    const missing = requiredKeys.filter(key => context[key] === null);

    if (missing.length > 0) {
        console.error('❌ appContext validation failed. Missing:', missing);
        return false;
    }

    console.log('✅ appContext validation passed');
    return true;
}
```

### 7.2 Call After Boot

```javascript
// In orchestrator.js, at the very end of initApp()
import { validateContext } from '../core/appContext.js';

async function initApp() {
    // ... all boot steps ...

    validateContext(); // Catch missing registrations
    hideAppLoader();
}
```

---

## Part 8: Implementation Phases

### Phase 1: Safe Deletions (Low Risk) ✅ COMPLETE
- [x] Delete utility module imports block (lines 249-326)
- [x] Delete duplicate theme/games/onboarding init
- [x] Delete duplicate event handlers (reset-notification-position, switch modal deselect)
- [x] Clean up empty lines and redundant "MOVED/REMOVED" comments
- [x] Verify app still works (featureBoot handles these)

**Result:** Reduced orchestrator from 1209 to 917 lines (24% reduction)

### Phase 2: Move Cross-Cutting Logic (Medium Risk) ✅ COMPLETE
- [x] AppState.update wrapper already moved to undoRedoManager.js (via ZERO_WINDOW_GLOBALS work)
- [x] validateAllApisRegistered() already being called post-boot
- [x] Title listener already extracted to titleManager.js
- [x] Recurring handlers already in recurringIntegration.js

### Phase 3: Extract Remaining Code (Medium Risk) - DEFERRED
- [ ] Move DOM elements to `getDOMElements()` in uiBoot.js
- [ ] Move remaining inline event handlers to respective modules

**Note:** The remaining code in orchestrator is tightly coupled to the boot sequence. Further extraction requires careful refactoring to avoid race conditions.

### Phase 4: DI Pattern Migration (Higher Risk) ✅ PARTIALLY COMPLETE
- [x] All `window.xyz` reads replaced with appContext getters (via ZERO_WINDOW_GLOBALS work)
- [x] uiBoot uses appContext getters exclusively
- [ ] Replace all `deps.xyz` in orchestrator with getters (deferred - deps container still used for collecting)

### Phase 5: Validation & Cleanup ✅ COMPLETE
- [x] `validateAllApisRegistered()` in appContext.js
- [x] Validation called at end of boot
- [x] Final cleanup pass on orchestrator
- [x] Documentation updated

---

## Part 9: Success Metrics

| Metric | Before | Current | Target |
|--------|--------|---------|--------|
| orchestrator.js lines | 1209 | **917** | ~100-150 |
| DI patterns in use | 3 (tri-mix) | **2** (deps + getters) | 1 (appContext getters) |
| window.* reads | ~270 | **0** | 0 ✅ |
| Cross-cutting logic in orchestrator | Yes (undo wrapper) | **No** | No ✅ |
| Duplicate event handlers | 2 | **0** | 0 ✅ |
| Post-boot validation | None | **Automatic** | Automatic ✅ |

---

## Part 10: The Target Orchestrator

After all phases complete, orchestrator.js should look like this:

```javascript
/**
 * orchestrator.js - Boot Orchestration
 *
 * This file ONLY coordinates the boot sequence.
 * It does NOT initialize modules (featureBoot does that).
 * It does NOT set window.* globals (featureBoot does that).
 * It does NOT contain business logic (modules do that).
 */

import { validateContext } from '../core/appContext.js';

window.AppBootStarted = true;

async function initApp() {
    console.log('🚀 Starting miniCycle initialization...');

    // 1. Load boot modules
    const { initCoreBoot, initAppState } = await import('./coreBoot.js');
    const { bootFeatures } = await import('./featureBoot.js');
    const { attachGlobalEventListeners, hideAppLoader } = await import('./uiBoot.js');

    // 2. Create deps container
    const deps = {
        utils: {}, features: {}, ui: {}, core: {},
        task: {}, cycle: {}, recurring: {}, progress: {},
        storage: {}, testing: {}
    };

    // 3. Initialize core systems
    const coreResult = await initCoreBoot(deps);
    if (!coreResult) return; // Reload happening

    // 4. Initialize AppState
    await initAppState(deps);

    // 5. Boot all features (this does the real work)
    await bootFeatures(deps, coreResult);

    // 6. Attach global event listeners
    attachGlobalEventListeners();

    // 7. Validate and finish
    validateContext();
    hideAppLoader();

    console.log('✅ miniCycle initialization complete');
}

// Run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
```

**That's ~50 lines.** Everything else lives in the module that owns it.

---

## Appendix A: Files to Modify

| File | Changes |
|------|---------|
| `modules/boot/orchestrator.js` | Major deletion, simplification |
| `modules/boot/featureBoot.js` | Add undo wrapper call, ensure all modules init here |
| `modules/boot/uiBoot.js` | Add getDOMElements(), use getters not window.* |
| `modules/core/appContext.js` | Add validateContext() |
| `modules/ui/undoRedoManager.js` | Add wrapAppStateForUndo() |
| `modules/ui/titleManager.js` | NEW - title editing logic |
| `modules/recurring/recurringIntegration.js` | Receive recurring handlers |
| `modules/features/reminders.js` | Receive reminder handlers |

## Appendix B: What NOT to Touch

- `coreBoot.js` - Already clean and focused
- `appContext.js` - Just add validateContext()
- Module internals - Only change how they receive deps, not what they do

---

## References

- `docs/future-work/ZERO_WINDOW_GLOBALS_PLAN.md` - Window.* elimination
- `docs/future-work/MODULAR_OVERHAUL_PLAN.md` - Original modularization
- `modules/boot/featureBoot.js:1240-1314` - Current window.* exposures
