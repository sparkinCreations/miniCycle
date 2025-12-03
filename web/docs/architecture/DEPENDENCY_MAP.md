# miniCycle Dependency Map

> **Generated:** November 2025
> **Updated:** December 3, 2025
> **Purpose:** Document actual module dependencies for debugging, maintenance, and feature development

## Executive Summary

The miniCycle codebase has **43 modules** across **11 directories**. Communication is transitioning from `window.*` globals to a `deps` container pattern.

### Key Numbers
| Metric | Before | Current | Target |
|--------|--------|---------|--------|
| Total modules | 43 | 43 | 43 |
| `window.*` globals created | ~68 | ~55 | <20 |
| `window.*` references consumed | ~748 | ~650 | <100 |
| Modules with true DI | 0 | 9 | 15+ |
| `deps.*` container usage | 0 | ~60 | 100+ |

> **Note:** Modular overhaul in progress (~25-30% complete). See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for tracking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      window.* globals                        │
│  AppState, taskCore, showNotification, sanitizeInput, etc.  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  core/  │  │  tasks/ │  │  cycle/ │  │   ui/   │        │
│  │         │  │         │  │         │  │         │        │
│  │appState │  │taskCore │  │ cycle   │  │ modal   │        │
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
├── cycleManager.js
├── cycleSwitcher.js
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
1. cycleLoader.loadMiniCycle()
2. UI fully interactive
```

---

## Module Dependency Details

### Tier 1: Foundation (Everything depends on these)

#### `modules/core/appState.js`
```
Creates:    window.AppState
Consumes:   localStorage, window.showNotification (optional)
Imports:    constants.js
Used by:    20+ modules
```

#### `modules/core/appInit.js`
```
Creates:    window.appInit
Consumes:   none
Imports:    none
Used by:    15+ modules (via waitForCore/waitForApp)
```

#### `modules/core/constants.js`
```
Creates:    none (clean module)
Consumes:   none
Imports:    none
Exports:    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS
```

---

### Tier 2: Core Functionality

#### `modules/cycle/cycleManager.js`
```
Creates:    window.cycleManager
Imports:    none
Dependencies (constructor injection with validation):
  - AppState, showPromptModal, sanitizeInput
  - loadMiniCycleData, completeInitialSetup, hideMainMenu, autoSave
  - safeLocalStorageGet, safeLocalStorageSet (storage utilities)
  - safeJSONParse, safeJSONStringify (JSON utilities)
  - DEFAULT_TASK_OPTION_BUTTONS (constant)
  - onCycleCreated (optional callback)
Note:       Has _validateDependencies() method, uses deps.* pattern
```

#### `modules/cycle/cycleLoader.js`
```
Creates:    window.loadMiniCycle (optional)
Consumes:   window.syncAllTasksWithMode, window.recurringCore
Imports:    appInit, constants.js
Dependencies (injected):
  - AppState, loadMiniCycleData, addTask, updateThemeColor
  - startReminders, catchUpMissedRecurringTasks
  - updateProgressBar, updateMainMenuHeader, updateStatsPanel
```

#### `modules/cycle/modeManager.js`
```
Creates:    window.modeManager, window.initializeModeSelector,
            window.setupModeSelector, window.syncModeFromToggles, etc.
Consumes:   window.AppState, window.recurringCore
Imports:    appInit
```

#### `modules/cycle/cycleSwitcher.js`
```
Creates:    window.cycleSwitcher + 7 wrapper functions
Consumes:   window.AppState, window.showPromptModal,
            window.showConfirmationModal, window.sanitizeInput,
            window.loadMiniCycle
Imports:    none
```

#### `modules/tasks/taskCore.js`
```
Creates:    none (class-based)
Consumes:   none (fully dependency injected)
Imports:    appInit
Dependencies (injected):
  - AppState, loadMiniCycleData, sanitizeInput
  - showNotification, updateStatsPanel, updateProgressBar
  - checkCompleteAllButton, refreshUIFromState
  - captureStateSnapshot, enableUndoSystemOnFirstInteraction
  - Modal functions, DOM helpers, autoSave
```

#### `modules/tasks/taskDOM.js`
```
Creates:    window.__taskDOMManager, window.__TaskValidator,
            window.__TaskUtils, window.__TaskRenderer, window.__TaskEvents
Imports:    appInit, constants.js
Note:       Uses double-underscore globals for versioning workaround

TaskRenderer Dependencies (constructor injection with validation):
  - AppState, addTask, loadMiniCycle
  - updateProgressBar, checkCompleteAllButton, updateArrowsInDOM
  - checkOverdueTasks, enableDragAndDropOnTask
  - recurringPanel (via deferred getter for late-bound lookup)
  - updateRecurringPanelButtonVisibility
Note:       Has _validateDependencies() that warns (not throws) for missing deps
            Uses deferred getters for dependencies not available at init time
```

---

### Tier 3: Features

#### `modules/recurring/recurringCore.js`
```
Creates:    window.recurringCore (via wrapper)
Consumes:   none (fully dependency injected)
Imports:    appInit, constants.js
Dependencies (strict injection via setRecurringCoreDependencies):
  - getAppState, updateAppState, isAppStateReady
  - loadData, showNotification, querySelector
  - updateRecurringPanel, updateRecurringSummary
  - refreshUIFromState, updateProgressBar
```

#### `modules/features/dueDates.js`
```
Creates:    none (class-based)
Consumes:   AppState (via getter)
Imports:    appInit
```

#### `modules/features/reminders.js`
```
Creates:    window.reminders (wrapper)
Consumes:   AppState, showNotification
Imports:    appInit
```

#### `modules/ui/undoRedoManager.js`
```
Creates:    window.__undoRedoManager (internal)
Consumes:   none (fully dependency injected)
Imports:    appInit
Dependencies (strict injection via setUndoRedoManagerDependencies):
  - AppState, refreshUIFromState, AppGlobalState
  - getElementById, safeAddEventListener, showNotification
```

---

### Tier 4: UI & Utilities

#### `modules/ui/modalManager.js`
```
Creates:    window.modalManager
Imports:    none (removed appInit direct import)
Dependencies (via setModalManagerDependencies + initModalManager):
  - waitForCore (for initialization timing)
  - showNotification, hideMainMenu
  - sanitizeInput, safeAddEventListener
Note:       Uses explicit initialization via initModalManager()
            Must call initModalManager(deps) instead of auto-init on import
```

#### `modules/ui/settingsManager.js`
```
Creates:    none (class-based)
Consumes:   window.DataValidator, window.recurringCore,
            window.showNotification
Imports:    appInit
```

#### `modules/utils/globalUtils.js`
```
Creates:    window.GlobalUtils (class reference)
Consumes:   none (pure utilities)
Imports:    none
Exports:    GlobalUtils class with safeAddEventListener, etc.
```

#### `modules/utils/notifications.js`
```
Creates:    window.showNotification
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

## Global Variables Reference

### Core Globals (Always needed)
```javascript
window.AppState          // State management singleton
window.appInit           // Initialization coordinator
window.showNotification  // User feedback
window.sanitizeInput     // XSS prevention
window.loadMiniCycleData // Data loading
```

### Feature Globals
```javascript
window.cycleManager      // Cycle creation/management
window.cycleSwitcher     // Cycle switching
window.modeManager       // Mode management
window.taskCore          // Task operations (sometimes)
window.recurringCore     // Recurring tasks
window.statsPanel        // Statistics
window.menuManager       // Main menu
window.modalManager      // Modal coordination
window.reminders         // Reminder system
window.themeManager      // Theme system
```

### Utility Globals
```javascript
window.GlobalUtils       // Event listener helpers
window.safeAddEventListener
window.safeAddEventListenerById
window.DataValidator     // Data validation
window.escapeHtml        // XSS prevention
window.autoSave          // Save function
```

### Internal Globals (Versioning workaround)
```javascript
window.__taskDOMManager
window.__TaskValidator
window.__TaskUtils
window.__TaskRenderer
window.__TaskEvents
window.__dragDropManager
window.__statsPanel
```

---

## State Flow

```
User Action
    ↓
TaskCore / CycleSwitcher / etc.
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

### Pattern 1: Constructor with fallbacks (most common)
```javascript
constructor(dependencies = {}) {
    this.deps = {
        AppState: dependencies.AppState || window.AppState,
        notify: dependencies.showNotification || window.showNotification
    };
}
```
**Reality:** DI parameter is never used. Always falls back to `window.*`.

### Pattern 2: Strict injection (critical modules)
```javascript
const Deps = {};
export function setDependencies(overrides) {
    Object.assign(Deps, overrides);
}
// Used by: recurringCore, undoRedoManager, migrationManager, themeManager,
//          dataValidator, modalManager, cycleManager, taskRenderer
```
**Reality:** Actually enforced. Must call setter before use.

### Pattern 3: Getter functions (runtime access)
```javascript
this.deps = {
    getAppState: dependencies.getAppState || (() => window.AppState)
};
```
**Reality:** Defers resolution to call time. Still usually gets from `window`.

### Pattern 4: Deferred getter objects (late-bound dependencies)
```javascript
// For dependencies not available at initialization time
recurringPanel: this.dependencies.recurringPanel || {
    get updateRecurringPanel() { return window.recurringPanel?.updateRecurringPanel; },
    get updateRecurringPanelButtonVisibility() { return window.recurringPanel?.updateRecurringPanelButtonVisibility; }
}
```
**Used by:** TaskRenderer (for recurringPanel which initializes after taskDOM)

### Pattern 5: Explicit initialization function
```javascript
export async function initModalManager(dependencies = {}) {
    setModalManagerDependencies(dependencies);
    modalManager = new ModalManager(dependencies);
    await modalManager.init();
    return modalManager;
}
```
**Used by:** modalManager (removes auto-init on import, allows DI of waitForCore)

---

## Common Debugging Scenarios

### "Feature X doesn't work"
1. Check if required globals exist: `console.log(window.AppState, window.featureX)`
2. Check initialization order in console logs
3. Verify `appInit.waitForCore()` was awaited

### "State changes don't persist"
1. Check `AppState.isReady()` returns true
2. Check localStorage in DevTools
3. Look for save errors in console

### "Module Y can't find Module Z"
1. Both communicate via `window.*` - check if Z is initialized first
2. Check for typos in global name
3. Verify Z's initialization runs before Y tries to use it

### "Circular dependency suspected"
1. No actual ES6 circular imports exist (all go through `window.*`)
2. Issue is likely initialization order
3. Check if both modules use `waitForCore()` properly

---

## Future: Path to True Modularity

Current state: **File separation with global coupling**

To achieve true modularity:

1. **Remove fallbacks** - Make DI required, not optional
2. **Wire in main script** - One place creates and connects all modules
3. **Remove window pollution** - Modules don't write to `window.*`
4. **Explicit imports** - Dependencies visible in import statements

Example transformation:
```javascript
// CURRENT (globally coupled)
class TaskCore {
    constructor(deps = {}) {
        this.notify = deps.showNotification || window.showNotification;
    }
}

// TARGET (truly modular)
class TaskCore {
    constructor({ showNotification }) {
        if (!showNotification) throw new Error('showNotification required');
        this.notify = showNotification;
    }
}

// In main script:
const taskCore = new TaskCore({
    showNotification: notifications.show
});
```

---

## Maintenance Notes

- **Adding a new feature:** Create module, have it use `window.*` for deps, expose via `window.featureName`
- **Debugging state issues:** Start at AppState, trace through subscribers
- **Performance issues:** Check for excessive re-renders in state subscribers
- **Testing:** Mock `window.*` globals before importing module

---

*This document reflects the actual architecture, not the aspirational one. Update when significant refactoring occurs.*
