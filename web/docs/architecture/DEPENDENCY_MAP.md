# miniCycle Dependency Map

> **Generated:** November 2025
> **Updated:** December 27, 2025
> **Purpose:** Document actual module dependencies for debugging, maintenance, and feature development

## Executive Summary

The miniCycle codebase has **80 modules** across **12 directories**. All modules use strict dependency injection via `appContext.js` and the `deps` container pattern. **Zero custom `window.*` globals remain.**

### Key Numbers
| Metric | Before (Nov 2025) | Current | Target | Progress |
|--------|-------------------|---------|--------|----------|
| Total modules | 43 | **80** | — | — |
| `window.*` globals created | ~68 | **0** | 0 | **100%** ✅ |
| `window.*` references consumed | ~748 | **0** | 0 | **100%** ✅ |
| Modules with DI setters (`set*Dependencies`) | 0 | **40+** | All stateful | **Exceeded** |
| `this.deps.*` usage | 0 | **950+** | 100+ | **Exceeded** |
| Modules still exporting to `window.*` | ~40 | **0** | 0 | **100%** ✅ |

### Module Distribution
| Directory | Count |
|-----------|-------|
| ui/ | 18 |
| recurring/ | 13 |
| task/ | 10 |
| core/ | 8 |
| utils/ | 8 |
| boot/ | 6 |
| routine/ | 5 |
| features/ | 4 |
| other/ | 3 |
| testing/ | 3 |
| progress/ | 1 |
| storage/ | 1 |

> **Modular overhaul complete (December 2025).** All modules use strict DI.
>
> **Last verified:** December 27, 2025

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   appContext.js (centralized registry)       │
│  getAppState(), getTaskApi(), getUiApi(), getRoutineApi()   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  core/  │  │  tasks/ │  │routine/ │  │   ui/   │        │
│  │         │  │         │  │         │  │         │        │
│  │appState │  │taskCore │  │ routine │  │ modal   │        │
│  │appInit  │  │taskDOM  │  │ Manager │  │ Manager │        │
│  │constants│  │dragDrop │  │ modeMan │  │settings │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │recurring│  │features/│  │  utils/ │                     │
│  │         │  │         │  │         │                     │
│  │ core    │  │dueDates │  │globalUti│                     │
│  │ panel   │  │reminders│  │notifica │                     │
│  │integrat │  │themes   │  │dataValid│                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│                                                              │
│  All modules use strict DI - no window.* globals             │
└─────────────────────────────────────────────────────────────┘
```

---

## Initialization Order (Critical)

```
Phase 1: Core Systems
─────────────────────
1. appState.js      → window.AppState created
2. appInit.js       → markCoreSystemsReady() called
   └── waitForCore() promises resolve

Phase 2: Module Loading (parallel-safe)
───────────────────────────────────────
├── routineManager.js
├── routineSwitcher.js
├── modeManager.js
├── taskCore.js
├── taskDOM.js
├── modalManager.js
├── settingsManager.js
├── undoRedoManager.js
├── recurringCore.js
├── All feature modules...
└── markAppReady() called
    └── waitForApp() promises resolve

Phase 3: Data & Rendering
─────────────────────────
1. routineLoader.loadMiniCycle()
2. UI fully interactive
```

---

## Module Dependency Details

### Tier 1: Foundation (Everything depends on these)

#### `modules/core/appState.js`
```
Exports:    AppState class (via appContext.js getters)
Consumes:   localStorage, showNotification (via DI)
Imports:    constants.js
Used by:    20+ modules (via getAppState() or DI)
```

#### `modules/core/appInit.js`
```
Exports:    appInit object with waitForCore(), waitForApp()
Consumes:   none
Imports:    none
Used by:    15+ modules (via waitForCore/waitForApp)
```

#### `modules/core/constants.js`
```
Exports:    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS
Consumes:   none
Imports:    none
Used by:    Multiple modules via direct import
```

---

### Tier 2: Core Functionality

#### `modules/routine/routineManager.js`
```
Exports:    RoutineManager class, setRoutineManagerDependencies()
Imports:    none
Dependencies (strict DI via setRoutineManagerDependencies):
  - AppState, showPromptModal, sanitizeInput
  - loadMiniCycleData, completeInitialSetup, hideMainMenu, autoSave
  - safeLocalStorageGet, safeLocalStorageSet (storage utilities)
  - safeJSONParse, safeJSONStringify (JSON utilities)
  - DEFAULT_TASK_OPTION_BUTTONS (constant)
Note:       Has _validateDependencies() method, uses deps.* pattern
```

#### `modules/routine/routineLoader.js`
```
Exports:    RoutineLoader class, setRoutineLoaderDependencies()
Imports:    appInit, constants.js
Dependencies (strict DI):
  - AppState, loadMiniCycleData, addTask, updateThemeColor
  - startReminders, catchUpMissedRecurringTasks
  - updateProgressBar, updateMainMenuHeader, updateStatsPanel
```

#### `modules/routine/modeManager.js`
```
Exports:    ModeManager class, setModeManagerDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState, recurringCore
```

#### `modules/routine/routineSwitcher.js`
```
Exports:    RoutineSwitcher class, setRoutineSwitcherDependencies()
Dependencies (strict DI):
  - AppState, showPromptModal, showConfirmationModal
  - sanitizeInput, loadMiniCycle
```

#### `modules/task/taskCore.js`
```
Exports:    TaskCore class, setTaskCoreDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState, loadMiniCycleData, sanitizeInput
  - showNotification, updateStatsPanel, updateProgressBar
  - checkCompleteAllButton, refreshUIFromState
  - captureStateSnapshot, enableUndoSystemOnFirstInteraction
  - Modal functions, DOM helpers, autoSave
```

#### `modules/task/taskDOM.js`
```
Exports:    TaskDOMManager, TaskValidator, TaskUtils, TaskRenderer, TaskEvents
           setTaskDOMDependencies()
Imports:    appInit, constants.js

TaskRenderer Dependencies (strict DI):
  - AppState, addTask, loadMiniCycle
  - updateProgressBar, checkCompleteAllButton, updateArrowsInDOM
  - checkOverdueTasks, enableDragAndDropOnTask
  - recurringPanel (via deferred getter for late-bound lookup)
Note:       Uses deferred getters for dependencies not available at init time
```

---

### Tier 3: Features

#### `modules/recurring/recurringCore.js`
```
Exports:    RecurringCore class, setRecurringCoreDependencies()
Imports:    appInit, constants.js
Dependencies (strict DI via setRecurringCoreDependencies):
  - getAppState, updateAppState, isAppStateReady
  - loadData, showNotification, querySelector
  - updateRecurringPanel, updateRecurringSummary
  - refreshUIFromState, updateProgressBar
```

#### `modules/features/dueDates.js`
```
Exports:    DueDates class, setDueDatesDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState
```

#### `modules/features/reminders.js`
```
Exports:    Reminders class, setRemindersDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState, showNotification
```

#### `modules/ui/undoRedoManager.js`
```
Exports:    UndoRedoManager class, setUndoRedoManagerDependencies()
Imports:    appInit
Dependencies (strict DI via setUndoRedoManagerDependencies):
  - AppState, refreshUIFromState, AppGlobalState
  - getElementById, safeAddEventListener, showNotification
```

---

### Tier 4: UI & Utilities

#### `modules/ui/modalManager.js`
```
Exports:    ModalManager class, setModalManagerDependencies(), initModalManager()
Imports:    none
Dependencies (strict DI via setModalManagerDependencies + initModalManager):
  - waitForCore (for initialization timing)
  - showNotification, hideMainMenu
  - sanitizeInput, safeAddEventListener
Note:       Uses explicit initialization via initModalManager()
```

#### `modules/ui/settingsManager.js`
```
Exports:    SettingsManager class, setSettingsManagerDependencies()
Imports:    appInit
Dependencies (strict DI):
  - DataValidator, recurringCore, showNotification
```

#### `modules/ui/onboardingManager.js`
```
Exports:    OnboardingManager class, setOnboardingManagerDependencies()
Imports:    appInit
Dependencies (strict DI via setOnboardingManagerDependencies):
  - AppState, showNotification
  - showCycleCreationModal, completeInitialSetup
  - safeAddEventListenerById
```

#### `modules/ui/pullToRefresh.js`
```
Exports:    PullToRefresh class, setPullToRefreshDependencies()
Imports:    none (standalone)
Dependencies (strict DI via setPullToRefreshDependencies):
  - refreshUIFromState, checkRecurringTasksNow, watchRecurringTasks
  - promptServiceWorkerUpdate, showNotification
Note:       Mobile PWA pull-to-refresh with SW update checking
```

#### `modules/utils/globalUtils.js`
```
Exports:    GlobalUtils class with safeAddEventListener, sanitizeInput, etc.
Consumes:   none (pure utilities)
Imports:    none
```

#### `modules/utils/notifications.js`
```
Exports:    showNotification function, setNotificationsDependencies()
Consumes:   DOM
Imports:    none
```

---

### Leaf Modules (Nothing depends on these)

These modules are endpoints - they use other modules but nothing uses them:

- `gamesManager.js` - Standalone game system
- `consoleCapture.js` - Debug utility
- `errorHandler.js` - Error utility
- `deviceDetection.js` - Device detection
- `dataValidator.js` - Validation utility
- `backupManager.js` - Backup utility
- `basicPluginSystem.js` - Plugin system
- `testing-modal*.js` - Testing infrastructure

---

## Module Access Reference

**No `window.*` globals exist.** All module access is via:

### appContext.js Getters (Preferred)
```javascript
import {
  getAppState, getShowNotification,
  getTaskApi, getCycleApi, getUiApi, getStateApi
} from '../core/appContext.js';

// Usage
const AppState = getAppState();
const taskApi = getTaskApi();
taskApi.add('New task');
```

### deps Container (Boot-time)
```javascript
// In boot files, modules are stored in deps container
deps.core.AppState
deps.utils.showNotification
deps.task.taskCore
deps.ui.modalManager
deps.routine.routineManager
deps.recurring.recurringCore
```

### Direct ES Module Import
```javascript
import { GlobalUtils } from '../utils/globalUtils.js';
import { TaskCore } from '../task/taskCore.js';
```

---

## State Flow

```
User Action
    ↓
TaskCore / RoutineSwitcher / etc.
    ↓
AppState.update(producer, immediate)
    ↓
├── State modified immutably
├── Listeners notified
├── Save scheduled (600ms debounce)
    ↓
localStorage.setItem('miniCycleData', ...)
    ↓
UI modules react to state changes
```

---

## Dependency Injection Patterns Used

All modules now use strict DI with no `window.*` fallbacks. The patterns below are the current standard:

### Pattern 1: Module-level setter with Object.defineProperties (standard)
```javascript
let _deps = {};

export function setModuleDependencies(dependencies) {
    // Preserves lazy getters for late resolution
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        if (!mergedDeps.AppState) throw new Error('AppState required');
        this.deps = {
            AppState: mergedDeps.AppState,  // No fallback
            showNotification: mergedDeps.showNotification
        };
    }
}
```
**Used by:** Most modules (taskCore, routineManager, recurringCore, etc.)
**Key:** Uses `Object.defineProperties` to preserve lazy getters during wiring.

### Pattern 2: Deferred getter objects (late-bound dependencies)
```javascript
// For dependencies not available at initialization time
this.deps = {
    get recurringPanel() { return _deps.recurringPanel; }
};
```
**Used by:** TaskRenderer (for recurringPanel which initializes after taskDOM)
**Key:** Getter is evaluated at access time, not construction time.

### Pattern 3: Explicit initialization function
```javascript
export async function initModalManager(dependencies = {}) {
    setModalManagerDependencies(dependencies);
    modalManager = new ModalManager(dependencies);
    await modalManager.init();
    return modalManager;
}
```
**Used by:** modalManager
**Key:** Explicit init call instead of auto-init on import.

---

## Common Debugging Scenarios

### "Feature X doesn't work"
1. Check if dependencies were wired: Look in `featureBoot.js` for `setXDependencies()` call
2. Check initialization order in console logs
3. Verify `appInit.waitForCore()` was awaited before accessing state

### "State changes don't persist"
1. Check `AppState.isReady()` returns true (via `getAppState().isReady()`)
2. Check localStorage in DevTools → Application → Local Storage
3. Look for save errors in console

### "Module Y can't find Module Z"
1. Check `featureBoot.js` wiring order - Z must be wired before Y uses it
2. Use deferred getter pattern if Z initializes after Y
3. Check for typos in dependency names in setter call

### "Circular dependency suspected"
1. ES6 imports are fine - issue is usually DI wiring order
2. Check if both modules use `waitForCore()` properly
3. Consider deferred getter pattern for late-bound deps

---

## True Modularity Achieved (December 2025)

**Current state: True modularity with strict DI**

All goals achieved:

1. ✅ **No fallbacks** - DI required, no `|| window.*` patterns
2. ✅ **Wire in boot files** - `featureBoot.js` creates and connects all modules
3. ✅ **No window pollution** - Zero custom `window.*` globals
4. ✅ **Explicit imports** - Dependencies via appContext.js or direct import

Current pattern (all modules):
```javascript
// All modules follow strict DI
let _deps = {};

export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

class TaskCore {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        if (!mergedDeps.AppState) throw new Error('AppState required');
        this.deps = {
            AppState: mergedDeps.AppState,  // No fallback
            showNotification: mergedDeps.showNotification
        };
    }
}

// In featureBoot.js:
setModuleDependencies({
    get AppState() { return deps.core.AppState; },
    showNotification: deps.utils.showNotification
});
const taskCore = new TaskCore();
```

---

## Maintenance Notes

- **Adding a new feature:** Create module with `set*Dependencies()`, wire in `featureBoot.js`, register in `appContext.js` if needed
- **Debugging state issues:** Start at AppState, trace through subscribers
- **Performance issues:** Check for excessive re-renders in state subscribers
- **Testing:** Mock dependencies via `set*Dependencies()` - no window mocking needed

---

*This document reflects the actual architecture as of December 27, 2025. All modules use strict DI.*
