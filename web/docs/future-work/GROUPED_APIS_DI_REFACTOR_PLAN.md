# Grouped APIs DI Refactor Plan

**Date:** December 16, 2025
**Status:** Partially Implemented (Branch: `claude/review-app-V2kdl`)
**Goal:** Migrate from individual legacy getters to grouped API pattern for cleaner dependency injection

---

## Background

### The Problem with Individual Getters

The original `appContext.js` had 50+ individual getter functions:

```javascript
// Old pattern - verbose and scattered
export function getAppState() { return legacy.AppState; }
export function getLoadMiniCycleData() { return legacy.loadMiniCycleData; }
export function getShowNotification() { return legacy.showNotification; }
export function getSwitchMiniCycle() { return legacy.switchMiniCycle; }
export function getRenameMiniCycle() { return legacy.renameMiniCycle; }
// ... 45+ more
```

This led to:
- Verbose imports: `import { getAppState, getLoadMiniCycleData, getShowNotification } from './appContext.js'`
- No logical grouping of related functions
- Difficult to discover available APIs
- ~800 lines of boilerplate across modules

### The Grouped API Solution

Group related functions into logical API objects:

```javascript
// New pattern - grouped and discoverable
export const cycle = () => getApi('cycle');
// Returns: { load, create, switch, rename, delete, check, ... }

export const ui = () => getApi('ui');
// Returns: { showNotification, hideMainMenu, showConfirmationModal, ... }

export const task = () => getApi('task');
// Returns: { add, delete, edit, refresh, ... }
```

Usage becomes cleaner:
```javascript
import { cycle, ui, task } from './appContext.js';

// Instead of: getLoadMiniCycle()?.()
cycle().load();

// Instead of: getShowNotification()?.('message', 'success')
ui().showNotification('message', 'success');
```

---

## What Was Implemented

### 1. New Files Added

| File | Purpose | Lines |
|------|---------|-------|
| `modules/core/diBase.js` | Standardized DI utilities (`createDIModule`, `required`, `optional`, `lazy`) | 360 |
| `modules/boot/moduleManifests.js` | Declarative module definitions with dependency graph | 509 |
| `modules/boot/moduleLoader.js` | Auto-loading modules using manifests | 501 |

### 2. Refactored appContext.js

**Before:** 891 lines with individual getters
**After:** 519 lines with grouped API structure

New structure:
```javascript
const apis = {
    state: null,      // AppState, loadMiniCycleData, autoSave
    task: null,       // add, delete, edit, refresh, ...
    cycle: null,      // load, create, switch, rename, delete, ...
    ui: null,         // showNotification, hideMainMenu, ...
    undo: null,       // capture, undo, redo, updateButtons, ...
    reminder: null,   // start, stop, updateButtons, ...
    recurring: null,  // panel, core, openForTask, ...
    utils: null       // GlobalUtils, sanitizeInput, generateId, ...
};

export function registerApi(name, api) {
    apis[name] = api;
}

export function getApi(name) {
    return apis[name];  // Returns null if not registered
}

// Typed accessors
export const state = () => getApi('state');
export const task = () => getApi('task');
export const cycle = () => getApi('cycle');
// etc.
```

### 3. Updated coreBoot.js

Changed dependency wiring to use grouped APIs:
```javascript
// Old
loadMiniCycle: () => appContextMod.getLoadMiniCycle?.(),

// New
loadMiniCycle: () => appContextMod.getCycleApi?.()?.load,
```

### 4. Proof of Concept Migrations

Three modules were migrated to use `diBase.js`:
- `modules/ui/uiEffects.js`
- `modules/utils/errorHandler.js`
- `modules/utils/dataValidator.js`

---

## What's Incomplete

### Critical Issue Fixed (December 2025)

**Problem:** `coreBoot.js` was updated to USE grouped APIs, but `featureBoot.js` never REGISTERED them.

```javascript
// coreBoot.js (consumer) - expects grouped API
loadMiniCycle: () => appContextMod.getCycleApi?.()?.load

// featureBoot.js (producer) - only used legacy pattern
appContextMod.setContextValue('cycleApi', {...});  // Stores in legacy['cycleApi']
// Missing: appContextMod.registerApi('cycle', {...});  // Should store in apis['cycle']
```

**Result:** `getCycleApi()` returned `null`, causing `loadMiniCycle` to silently fail.

**Fix Applied:** Added `registerApi('cycle', cycleApiObj)` in featureBoot.js.

### Remaining Work

| API | Registered? | To Complete |
|-----|-------------|-------------|
| `cycle` | ✅ Yes | Fixed |
| `state` | ❌ No | Add `registerApi('state', stateApiObj)` |
| `task` | ❌ No | Add `registerApi('task', taskApiObj)` |
| `ui` | ❌ No | Add `registerApi('ui', uiApiObj)` |
| `undo` | ❌ No | Add `registerApi('undo', undoApiObj)` |
| `reminder` | ❌ No | Add `registerApi('reminder', reminderApiObj)` |
| `recurring` | ❌ No | Add `registerApi('recurring', recurringApiObj)` |
| `utils` | ❌ No | Add `registerApi('utils', utilsApiObj)` |

The app still shows this warning:
```
⚠️ appContext: Missing APIs: state, task, ui, undo, reminder, recurring, utils
```

---

## How to Complete the Migration

### Step 1: Register All Grouped APIs

In `featureBoot.js`, after each API object is created with `setContextValue`, also call `registerApi`:

```javascript
// Example for state API (around line 1560)
const stateApiObj = {
    AppState: deps.core.AppState,
    loadMiniCycleData: deps.core.loadMiniCycleData,
    autoSave: deps.core.autoSave
};
appContextMod.setContextValue('stateApi', stateApiObj);
appContextMod.registerApi('state', stateApiObj);  // ADD THIS

// Repeat for task, ui, undo, reminder, recurring, utils
```

### Step 2: Update Consumers (Optional)

Once APIs are registered, update code to use the cleaner pattern:

```javascript
// Before
import { getShowNotification, getLoadMiniCycleData } from './appContext.js';
const notify = getShowNotification();
const load = getLoadMiniCycleData();

// After
import { ui, state } from './appContext.js';
ui().showNotification('message', 'success');
state().loadMiniCycleData();
```

### Step 3: Migrate Modules to diBase.js (Optional)

For each module, replace boilerplate with `createDIModule`:

```javascript
// Before (~20 lines per module)
let _deps = {};
export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}
export class MyModule {
    constructor(overrides = {}) {
        this.deps = { ..._deps, ...overrides };
        // Manual validation...
    }
}

// After (~5 lines)
import { createDIModule, required, optional } from '../core/diBase.js';
const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    autoSave: optional(() => {})
});
export const setMyModuleDependencies = di.setDependencies;
```

### Step 4: Use Module Manifests (Optional)

Define modules declaratively in `moduleManifests.js`:

```javascript
export const MODULE_MANIFESTS = {
    taskCore: {
        path: '../task/taskCore.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['AppState', 'loadMiniCycleData', 'showNotification'],
        provides: ['addTask', 'deleteTask', 'TaskCore'],
        setDependencies: 'setTaskCoreDependencies'
    }
};
```

Then use `moduleLoader.js` for automatic dependency resolution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        appContext.js                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    apis (grouped)                        │    │
│  │  state: { AppState, loadMiniCycleData, autoSave }       │    │
│  │  task:  { add, delete, edit, refresh, ... }             │    │
│  │  cycle: { load, create, switch, rename, delete, ... }   │    │
│  │  ui:    { showNotification, hideMainMenu, ... }         │    │
│  │  undo:  { capture, undo, redo, updateButtons, ... }     │    │
│  │  ...                                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  legacy (individual)                     │    │
│  │  AppState, loadMiniCycleData, showNotification, ...     │    │
│  │  (50+ individual values for backwards compatibility)     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ registerApi() / setContextValue()
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       featureBoot.js                             │
│  - Loads all 45+ modules                                        │
│  - Calls setModuleDependencies() for each                       │
│  - Registers APIs with appContext                               │
│  - Stores instances in deps container                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ getCycleApi(), state(), ui(), etc.
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Consumer Modules                             │
│  coreBoot.js, appInit.js, cycleManager.js, etc.                 │
│  - Use grouped APIs for cleaner access                          │
│  - Or use legacy getters for backwards compatibility            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefits When Complete

| Metric | Before | After |
|--------|--------|-------|
| Boilerplate per module | ~20 lines | ~5 lines |
| Total boilerplate | ~800 lines | ~200 lines |
| API discoverability | Poor (50+ getters) | Good (8 grouped APIs) |
| Import verbosity | High | Low |
| Dependency validation | Manual | Automatic |
| Load order determination | Manual | Automatic (via manifests) |

---

## Files Modified in This Branch

| File | Changes |
|------|---------|
| `modules/core/appContext.js` | New grouped API structure, `registerApi()`, `getApi()` |
| `modules/core/diBase.js` | **NEW** - DI utilities |
| `modules/boot/moduleManifests.js` | **NEW** - Declarative module definitions |
| `modules/boot/moduleLoader.js` | **NEW** - Auto-loading utilities |
| `modules/boot/coreBoot.js` | Updated to use `getCycleApi()` |
| `modules/boot/featureBoot.js` | Added `registerApi('cycle', ...)` (partial fix) |
| `modules/ui/uiEffects.js` | Migrated to diBase.js |
| `modules/utils/dataValidator.js` | Migrated to diBase.js |
| `modules/utils/errorHandler.js` | Migrated to diBase.js |

---

## Testing Considerations

After completing the migration:

1. **Verify all APIs registered:** Console should NOT show "Missing APIs" warning
2. **Test import flow:** Import .mcyc file and verify tasks load
3. **Test cycle switching:** Switch between cycles and verify UI updates
4. **Test all managers:** Settings, reminders, recurring tasks, undo/redo
5. **Run test suite:** All 1,458 browser tests should pass

---

## Related Documents

- [WINDOW_GLOBALS_REDUCTION_PLAN.md](./WINDOW_GLOBALS_REDUCTION_PLAN.md) - Eliminating window.* pollution
- [MODULE_INDEPENDENCE_REFACTOR_PLAN.md](./MODULE_INDEPENDENCE_REFACTOR_PLAN.md) - Making modules self-contained
- [BOOT_FILE_SPLIT_PLAN.md](./BOOT_FILE_SPLIT_PLAN.md) - Boot sequence organization

---

## Conclusion

This refactoring improves code organization and reduces boilerplate, but was left incomplete. The critical `cycle` API issue has been fixed. Completing the remaining API registrations is low-risk and can be done incrementally.

**Recommendation:** Complete the migration by adding `registerApi()` calls for all grouped APIs in `featureBoot.js`. This eliminates the warning and enables full use of the cleaner grouped API pattern.
