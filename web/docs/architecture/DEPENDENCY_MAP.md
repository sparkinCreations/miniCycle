# miniCycle Dependency Map

> **Generated:** November 2025
> **Updated:** August 5, 2026
> **Purpose:** Document actual module dependencies for debugging, maintenance, and feature development

> **Note:** This map reflects architecture as of December 2025. Infrastructure globals (APP_VERSION for service worker, window.onerror for error handling) are intentional exceptions to the "no window.*" rule.

## Executive Summary

The miniCycle codebase has modules across 14 directories (see [PROJECT_STATS.md](../PROJECT_STATS.md) for current counts). All modules use strict dependency injection via `appContext.js` and the `deps` container pattern.

**No custom business logic is exposed on `window.*`** (exceptions: version/service-worker infrastructure, browser API event handlers).

### Key Numbers
| Metric | Before (Nov 2025) | Current | Target | Progress |
|--------|-------------------|---------|--------|----------|
| Total modules | 43 | **136** _(live count in [PROJECT_STATS.md](../PROJECT_STATS.md))_ | — | — |
| Custom `window.*` globals (business logic) | ~68 | **0** | 0 | **100%** ✅ |
| `window.*` fallbacks in modules | ~748 | **0** | 0 | **100%** ✅ |
| Modules with DI setters (`set*Dependencies`) | 0 | **40+** | All stateful | **Exceeded** |
| `this.deps.*` usage | 0 | **950+** | 100+ | **Exceeded** |
| Modules still exporting to `window.*` | ~40 | **0** | 0 | **100%** ✅ |

**Infrastructure exceptions (intentional):**
- `window.APP_VERSION` / `self.APP_VERSION` - Service worker cache versioning
- `window.onerror`, `window.addEventListener('unhandledrejection')` - Global error handlers
- `document.documentElement.dataset.appBooted` - Boot completion flag

### Module Distribution
_(as of Aug 2026 — live counts in [PROJECT_STATS.md](../PROJECT_STATS.md))_

| Directory | Count |
|-----------|-------|
| ui/ | 37 |
| utils/ | 19 |
| recurring/ | 16 |
| task/ | 13 |
| features/ | 11 |
| core/ | 9 |
| testing/ | 9 |
| boot/ | 7 |
| routine/ | 5 |
| labels/ | 3 |
| other/ | 3 |
| storage/ | 2 |
| progress/ | 1 |
| platform/ | 1 |

> **Modular overhaul complete (December 2025).** All modules use strict DI.
>
> **Last verified:** August 5, 2026

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   appContext.js (centralized registry)       │
│   getStateApi(), getTaskApi(), getCycleApi(), getUiApi()    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  core/  │  │  task/  │  │routine/ │  │   ui/   │        │
│  │         │  │         │  │         │  │         │        │
│  │appState │  │taskCore │  │ routine │  │ modal   │        │
│  │appInit  │  │taskDOM  │  │ Manager │  │ Manager │        │
│  │appContxt│  │dragDrop │  │ modeMan │  │settings │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │recurring│  │features/│  │  utils/ │  │  boot/  │        │
│  │         │  │         │  │         │  │         │        │
│  │ core    │  │dueDates │  │globalUti│  │orchestr │        │
│  │ panel   │  │reminders│  │notifica │  │coreBoot │        │
│  │ matcher │  │themes   │  │dataValid│  │featBoot │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  + storage/, progress/, testing/, other/                     │
│                                                              │
│  All modules use strict DI (infrastructure globals excepted) │
└─────────────────────────────────────────────────────────────┘
```

---

## Initialization Order (Critical)

```
miniCycle-main.js (entrypoint)
    ↓
orchestrator.js (sequence controller)
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: coreBoot.js - Core Systems                         │
├─────────────────────────────────────────────────────────────┤
│ 1. AppState initialized (stored in deps.core.AppState)      │
│ 2. GlobalUtils loaded                                       │
│ 3. Migration check                                          │
│ 4. appInit.markCoreSystemsReady() called                    │
│    └── waitForCore() promises resolve                       │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: featureBoot.js - Feature Modules (DI wiring)       │
├─────────────────────────────────────────────────────────────┤
│ moduleLoader reads moduleManifests.js and, for each module: │
│   1. Import module (phase order, honoring after/before)     │
│   2. Build its deps from requires/optionalDeps/lazyRequires │
│   3. Call its init function with those deps                 │
│   4. Register provides/provideInstance in deps container    │
│                                                             │
│ Modules: taskCore, routineManager, recurringCore,           │
│          modalManager, settingsManager, undoRedoManager...  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: uiBoot.js - Data & UI                              │
├─────────────────────────────────────────────────────────────┤
│ 1. routineLoader.loadMiniCycle()                            │
│ 2. Event listeners attached                                 │
│ 3. UI fully interactive                                     │
│ 4. appInit.markAppReady() called                            │
│    └── waitForApp() promises resolve                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Details

> **Authoritative source:** each module's `requires` / `optionalDeps` /
> `lazyRequires` in `modules/boot/moduleManifests.js`. The lists below are a
> curated snapshot for orientation, not an exhaustive inventory.

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
Imports:    diBase.js, constants.js, labelResolver.js
Used by:    15+ modules (via waitForCore/waitForApp)
```

#### `modules/core/constants.js`
```
Exports:    DOM_IDS, DOM_CLASSES, DOM_SELECTORS, DATA_SELECTORS, Z_INDEX,
            UI_TIMEOUTS, BOOT_TIMEOUTS, INTERVALS, LIMITS, COLORS,
            STORAGE_KEYS, EVENTS, MILESTONES, GESTURE, BREAKPOINTS,
            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS, ...
Consumes:   none
Imports:    none
Used by:    Most modules via direct import (central home for all tunable values)
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
Exports:    loadMiniCycle(), renderTasksToDOM(), and related functions
            (no class), setRoutineLoaderDependencies()
Imports:    appInit, constants.js
Dependencies (strict DI):
  - AppState, loadMiniCycleData, addTask, updateThemeColor
  - startReminders, catchUpMissedRecurringTasks
  - updateProgressBar, updateMainMenuHeader, updateStatsPanel
  - updateSearchVisibility (task search visibility)
```

**⚠️ Important: Two Task Rendering Paths**

routineLoader has its own `renderTasksToDOM()` function that renders tasks during boot.
This is SEPARATE from `TaskRenderer.renderTasks()` which handles runtime re-renders.

| Path | When Used | Location |
|------|-----------|----------|
| `renderTasksToDOM()` | Boot-time, routine switching | `routineLoader.js` |
| `TaskRenderer.renderTasks()` | Undo/redo, state refresh, runtime updates | `taskRenderer.js` |

**If you need to hook into "after tasks render"**, you must hook into BOTH paths.
Example: `updateSearchVisibility` is injected into both routineLoader and TaskRenderer.

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
Exports:    TaskDOMManager (facade) + grouped functions,
           setTaskDOMManagerDependencies()
Sub-modules: taskValidation, taskUtils, taskRenderer, taskEvents
           (dynamically imported by the facade — NOT in moduleManifests.js)
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
Exports:    MiniCycleDueDates class, setDueDatesDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState
```

#### `modules/features/reminders.js`
```
Exports:    MiniCycleReminders class, setRemindersDependencies()
Imports:    appInit
Dependencies (strict DI):
  - AppState, showNotification
```

#### `modules/ui/undoRedoManager.js`
```
Exports:    performStateBasedUndo(), performStateBasedRedo(),
            captureStateSnapshot(), initUndoRedoManager(), and related
            functions (no class), setUndoRedoManagerDependencies()
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
Exports:    MiniCycleNotifications class, EducationalTipManager,
            setNotificationsDependencies()
Consumes:   DOM
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
- `storagePersistence.js` - Durable-storage request (eviction protection)
- `basicPluginSystem.js` - Plugin system
- `testing-modal*.js` - Testing infrastructure

---

## Module Access Reference

**No `window.*` globals exist.** All module access is via:

### appContext.js Getters (Preferred)
```javascript
import {
  state, task, cycle, ui,           // typed accessors
  getStateApi, getTaskApi, getCycleApi, getUiApi  // getter-style aliases
} from '../core/appContext.js';

// Usage
const AppState = state().AppState;   // or getStateApi().AppState
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

### Pattern 1: diBase createDIModule (standard)
```javascript
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: optional(null),
});

export const setMyModuleDependencies = di.setDependencies;

class MyModule {
    constructor(dependencies = {}) {
        // NEVER spread deps ({ ...deps }) — that evaluates lazy getters
        const resolved = di.resolve(dependencies);
        this.deps = {
            AppState: resolved.AppState,  // No fallback
            showNotification: resolved.showNotification
        };
    }
}
```
**Used by:** Most modules (taskCore, routineManager, recurringCore, etc.)
**Key:** `di.setDependencies` uses `Object.defineProperties` internally to preserve lazy getters during wiring. A handful of Phase 1 boot modules still use a plain `let _deps = {}` + `Object.defineProperties` setter for startup-order reasons — do not use that for new modules.

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
1. Check if dependencies were declared: look at the module's manifest entry in `moduleManifests.js` (`requires`/`optionalDeps`/`lazyRequires`) and run `npm run validate:di`
2. Check initialization order in console logs
3. Verify `appInit.waitForCore()` was awaited before accessing state

### "State changes don't persist"
1. Check `AppState.isReady()` returns true (via `getAppState().isReady()`)
2. Check localStorage in DevTools → Application → Local Storage
3. Look for save errors in console

### "Module Y can't find Module Z"
1. Check load order in `moduleManifests.js` — Z's phase/`after` must put it before Y (or declare the dep in Y's `optionalDeps`/`lazyRequires` for cross-phase use)
2. Use deferred getter pattern if Z initializes after Y
3. Check for typos in dependency names — an undeclared or misspelled dep resolves to `undefined` silently

### "Circular dependency suspected"
1. ES6 imports are fine - issue is usually DI wiring order
2. Check if both modules use `waitForCore()` properly
3. Consider deferred getter pattern for late-bound deps

---

## True Modularity Achieved (December 2025)

**Current state: True modularity with strict DI**

All goals achieved:

1. ✅ **No fallbacks** - DI required, no `|| window.*` patterns
2. ✅ **Wire in boot files** - moduleLoader creates and connects all modules from `moduleManifests.js` during `featureBoot`
3. ✅ **No window pollution** - Zero custom `window.*` globals
4. ✅ **Explicit imports** - Dependencies via appContext.js or direct import

Current pattern (all modules):
```javascript
// All modules follow strict DI via diBase.js
import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('TaskCore', {
    AppState: optional(null),
    showNotification: optional(null),
});

export const setTaskCoreDependencies = di.setDependencies;

class TaskCore {
    constructor(dependencies = {}) {
        const resolved = di.resolve(dependencies);  // never { ...deps } spread
        this.deps = {
            AppState: resolved.AppState,  // No fallback
            showNotification: resolved.showNotification
        };
    }
}

// Wiring is declarative: the module's entry in moduleManifests.js declares
// requires/optionalDeps/lazyRequires, and moduleLoader injects them (with
// lazy getters) during featureBoot.
```

---

## Maintenance Notes

- **Adding a new feature:** Create module with `createDIModule()` (diBase.js), add a manifest entry in `moduleManifests.js`, register in `appContext.js` if needed
- **Debugging state issues:** Start at AppState, trace through subscribers
- **Performance issues:** Check for excessive re-renders in state subscribers
- **Testing:** Mock dependencies via `set*Dependencies()` - no window mocking needed

---

*This document reflects the actual architecture as of August 5, 2026. All modules use strict DI.*
