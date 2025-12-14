# DI Patterns Guide

**Last Updated:** December 14, 2025
**Status:** All modules now use strict DI - No `|| window.*` fallbacks remain

This document covers the dependency injection patterns used in miniCycle. All 46 modules follow these patterns.

---

## Table of Contents

1. [Core Pattern](#core-pattern-module-level-_deps-with-late-injection)
2. [Object.defineProperties (Critical)](#objectdefineproperties-critical)
3. [Instance Getter Pattern](#instance-getter-pattern)
4. [Wiring in orchestrator.js](#wiring-in-orchestratorjs)
5. [Complete Module Template](#complete-module-template)
6. [Common Mistakes](#common-mistakes)
7. [All DI Modules](#all-di-modules)

---

## Core Pattern: Module-Level `_deps` with Late Injection

Every module follows this structure:

```javascript
// Module-level deps container
let _deps = {};

// Called from modules/boot/orchestrator.js BEFORE creating instances
export function setModuleDependencies(dependencies) {
    // CRITICAL: Use Object.defineProperties to preserve lazy getters
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

export class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };

        // Required deps - fail fast
        if (!mergedDeps.AppState) {
            throw new Error('MyModule requires AppState');
        }

        this.deps = {
            AppState: mergedDeps.AppState,
            showNotification: mergedDeps.showNotification || this.fallbackNotification.bind(this)
        };
    }

    fallbackNotification(msg, type) {
        console.log(`[MyModule] ${type}: ${msg}`);
    }
}
```

---

## Object.defineProperties (Critical)

**This is the most important pattern in our DI system.**

### The Problem with Spread Operator

```javascript
// BAD: Spread operator evaluates getters immediately
export function setModuleDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    // If dependencies had: { get AppState() { return window.AppState; } }
    // The getter is invoked NOW, returning undefined if AppState isn't ready
}
```

### The Solution

```javascript
// GOOD: Object.defineProperties preserves getters
export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
    // Getters remain as getters, invoked only when accessed
}
```

### Why This Matters

When wiring dependencies in `modules/boot/orchestrator.js`:

```javascript
// Wiring happens BEFORE AppState is created
setModuleDependencies({
    get AppState() { return window.AppState; },  // Lazy getter
    showNotification: deps.utils.showNotification
});

// Later, when module code runs:
this.deps.AppState.get();  // Getter invoked NOW, AppState exists!
```

**All 40 modules with `set*Dependencies()` use this pattern.**

---

## Instance Getter Pattern

Use when an instance is created **before** all dependencies are available.

### The Problem

```javascript
// BAD: Captures values at construction time
class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        this.deps = {
            taskCore: mergedDeps.taskCore,  // Captured as null!
        };
    }
}

// Timeline:
// 1. Instance created → this.deps.taskCore = null
// 2. setModuleDependencies({ taskCore }) called
// 3. User action → this.deps.taskCore is STILL null
```

### The Solution

```javascript
// GOOD: Getter resolves at access time
class MyModule {
    constructor(dependencies = {}) {
        this._constructorDeps = {
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id))
        };
    }

    get deps() {
        return {
            taskCore: _deps.taskCore,  // Reads CURRENT value
            showNotification: _deps.showNotification || this.fallbackNotification,
            ...this._constructorDeps
        };
    }
}

// Timeline:
// 1. Instance created
// 2. setModuleDependencies({ taskCore }) called
// 3. User action → this.deps.taskCore getter returns current _deps.taskCore ✅
```

### Modules Using This Pattern

- `taskEvents.js` - Instance created before `taskCore` exists
- `statsPanel.js` - Uses `get dependencies()` pattern
- `basicPluginSystem.js` - `MiniCyclePlugin` base class uses getter

---

## Wiring in orchestrator.js

`modules/boot/orchestrator.js` is the **only place** where dependencies are connected.

### Complete Wiring Example

```javascript
// In modules/boot/orchestrator.js (DI wiring hub)

// 1. Import setter and module
const { MyModule, setModuleDependencies } = await import(withV('../path/myModule.js'));

// 2. Wire dependencies BEFORE creating instance
setModuleDependencies({
    // Direct values for deps that exist now
    showNotification: deps.utils.showNotification,
    AppMeta: window.AppMeta,

    // Lazy getters for deps that may not exist yet
    get AppState() { return getAppState(); },  // Via appContext getter
    get taskCore() { return deps.task.taskCore; },  // Via deps container

    // Function wrappers for defensive access
    loadData: () => getLoadMiniCycleData()?.()
});

// 3. Create instance (reads from _deps)
const myModule = new MyModule();

// 4. Store in deps container (NOT window.*)
deps.ui.myModule = myModule;
```

---

## appContext: Centralized Registry (Dec 2025)

`modules/core/appContext.js` provides a centralized registry for cross-module access without window.* pollution.

### The Pattern

```javascript
// In modules/core/appContext.js
const context = {};

export function initAppContext(deps) {
    Object.assign(context, deps);
}

export function setContextValue(key, value) {
    context[key] = value;
}

// Lazy getters for each registered value
export function getAppState() { return context.AppState; }
export function getAppInit() { return context.appInit; }
export function getShowNotification() { return context.showNotification; }
// ... etc
```

### Usage in Modules

```javascript
// Instead of window.AppState
import { getAppState, getShowNotification } from '../core/appContext.js';

const AppState = getAppState();
const showNotification = getShowNotification();
```

### Why appContext vs window.*

| Approach | Pros | Cons |
|----------|------|------|
| `window.*` | Simple, always available | Global pollution, no control, no typing |
| `appContext` | Explicit, auditable, no pollution | Requires import |

### Registration Points

- **coreBoot.js**: Registers core dependencies via `initAppContext()`
- **featureBoot.js**: Registers feature modules via `setContextValue()`
- **orchestrator.js**: Registers UI managers via `setContextValue()`

### When to Use Lazy Getters

Use `get X() { return window.X; }` when:
- The dependency doesn't exist yet at wiring time
- The dependency may be replaced/updated later
- You need circular dependency resolution

```javascript
// AppState created after this wiring code runs
setModuleDependencies({
    get AppState() { return window.AppState; },  // ✅ Deferred
    AppMeta: window.AppMeta  // ✅ Already exists
});
```

---

## Complete Module Template

```javascript
/**
 * MyModule - Description of what this module does
 *
 * Dependencies:
 * - AppState: State management (required)
 * - showNotification: Toast notifications (optional, has fallback)
 * - AppMeta: Version info (optional)
 */

let _deps = {};

/**
 * Set module dependencies. Called from modules/boot/orchestrator.js.
 * Uses Object.defineProperties to preserve lazy getters.
 */
export function setMyModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
    console.log('🔧 MyModule dependencies set:', Object.keys(dependencies));
}

export class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };

        // Validate required dependencies
        const required = ['AppState'];
        const missing = required.filter(dep => !mergedDeps[dep]);
        if (missing.length > 0) {
            throw new Error(`MyModule: Missing required dependencies: ${missing.join(', ')}`);
        }

        // Store dependencies
        this.deps = {
            AppState: mergedDeps.AppState,
            showNotification: mergedDeps.showNotification || this.fallbackNotification.bind(this),
            version: mergedDeps.AppMeta?.version || 'dev'
        };

        this.initialized = false;
    }

    fallbackNotification(message, type = 'info') {
        console.log(`[MyModule] ${type.toUpperCase()}: ${message}`);
    }

    async init() {
        if (this.initialized) return;

        // Safe to access AppState now
        const state = this.deps.AppState.get();
        console.log('MyModule initialized with state:', !!state);

        this.initialized = true;
    }

    doSomething() {
        this.deps.AppState.update(state => {
            // Modify state
        }, true);

        this.deps.showNotification('Action completed', 'success');
    }
}

// No window.* exports - main script handles exposure if needed
console.log('📦 MyModule loaded (strict DI)');
```

---

## Common Mistakes

### 1. Using spread instead of Object.defineProperties

```javascript
// ❌ WRONG: Getters evaluated immediately
export function setDeps(dependencies) {
    _deps = { ..._deps, ...dependencies };
}

// ✅ RIGHT: Getters preserved
export function setDeps(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}
```

### 2. Adding `|| window.*` fallbacks

```javascript
// ❌ WRONG: Reintroduces global coupling
this.deps = {
    AppState: mergedDeps.AppState || window.AppState
};

// ✅ RIGHT: Fail fast or use safe fallback
this.deps = {
    AppState: mergedDeps.AppState  // Will be undefined if not wired
};
if (!this.deps.AppState) {
    throw new Error('AppState required');
}
```

### 3. Forgetting to wire before instantiation

```javascript
// ❌ WRONG: Instance created before wiring
const { MyModule } = await import('./myModule.js');
const instance = new MyModule();  // deps are undefined!
setMyModuleDependencies({ ... });  // Too late!

// ✅ RIGHT: Wire first, then instantiate
const { MyModule, setMyModuleDependencies } = await import('./myModule.js');
setMyModuleDependencies({ ... });
const instance = new MyModule();
```

### 4. Capturing deps at construction when using late injection

```javascript
// ❌ WRONG: Captures null values
constructor() {
    this.taskCore = _deps.taskCore;  // null at construction time
}

// ✅ RIGHT: Use getter for late-available deps
get deps() {
    return { taskCore: _deps.taskCore };  // Resolved at access time
}
```

### 5. Not using function wrappers for optional deps

```javascript
// ❌ WRONG: Throws if loadMiniCycleData doesn't exist
loadData: window.loadMiniCycleData

// ✅ RIGHT: Safe access with optional chaining
loadData: () => window.loadMiniCycleData?.()
```

---

## All DI Modules

**All 46 modules use strict dependency injection with no `|| window.*` fallbacks.**

### Modules with `set*Dependencies()` (40 modules)

| Module | Setter Function |
|--------|-----------------|
| `appState.js` | `setAppStateDependencies` |
| `backupManager.js` | `setBackupManagerDependencies` |
| `basicPluginSystem.js` | `setBasicPluginSystemDependencies` |
| `consoleCapture.js` | `setConsoleCaptureDependencies` |
| `cycleLoader.js` | `setCycleLoaderDependencies` |
| `cycleManager.js` | `setCycleManagerDependencies` |
| `cycleSwitcher.js` | `setCycleSwitcherDependencies` |
| `dataValidator.js` | `setDataValidatorDependencies` |
| `deviceDetection.js` | `setDeviceDetectionDependencies` |
| `dragDropManager.js` | `setDragDropManagerDependencies` |
| `dueDates.js` | `setDueDatesDependencies` |
| `errorHandler.js` | `setErrorHandlerDependencies` |
| `gamesManager.js` | `setGamesManagerDependencies` |
| `globalUtils.js` | `setGlobalUtilsDependencies` |
| `helpWindowManager.js` | `setHelpWindowManagerDependencies` |
| `menuManager.js` | `setMenuManagerDependencies` |
| `migrationManager.js` | `setMigrationManagerDependencies` |
| `modalManager.js` | `setModalManagerDependencies` |
| `modeManager.js` | `setModeManagerDependencies` |
| `notifications.js` | `setNotificationsDependencies` |
| `onboardingManager.js` | `setOnboardingManagerDependencies` |
| `pluginIntegrationGuide.js` | `setPluginIntegrationGuideDependencies` |
| `pullToRefresh.js` | `setPullToRefreshDependencies` |
| `recurringCore.js` | `setRecurringCoreDependencies` |
| `recurringIntegration.js` | `setRecurringIntegrationDependencies` |
| `reminders.js` | `setRemindersDependencies` |
| `settingsManager.js` | `setSettingsManagerDependencies` |
| `statsPanel.js` | `setStatsPanelDependencies` |
| `taskCore.js` | `setTaskCoreDependencies` |
| `taskDOM.js` | `setTaskDOMManagerDependencies` |
| `taskEvents.js` | `setTaskEventsDependencies` |
| `taskOptionsCustomizer.js` | `setTaskOptionsCustomizerDependencies` |
| `taskRenderer.js` | `setTaskRendererDependencies` |
| `taskUtils.js` | `setTaskUtilsDependencies` |
| `taskValidation.js` | `setTaskValidationDependencies` |
| `testing-modal.js` | `setTestingModalDependencies` |
| `testing-modal-integration.js` | `setTestingModalIntegrationDependencies` |
| `themeManager.js` | `setThemeManagerDependencies` |
| `undoRedoManager.js` | `setUndoRedoManagerDependencies` |
| `cycleCompletion.js` | `setCycleCompletionDependencies` |

### Modules Without Setter (6 modules)

These are pure utilities or static configuration with no dependencies:

- `appInit.js` - Singleton initialization coordinator
- `constants.js` - Static constants
- `testing-modal-modifications.js` - Test modifications
- `exampleTimeTrackerPlugin.js` - Example plugin
- `recurringPanel.js` - Uses constructor DI only

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main developer guide
- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) - System architecture
- [TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md) - Detailed DI implementation example


  ---
  | Priority | Target                    | Lines | Target Module                        | Status              |
  |----------|---------------------------|-------|--------------------------------------|---------------------|
  | P4       | Notification Wrappers     | 80    | Delete                               | ✅ DONE (-175 lines) |
  | P0       | saveToggleAutoReset()     | ~758  | settingsManager.js (exists)          | Pending             |
  | P1       | createTaskLabel()         | ~350  | taskDOM.js or new module             | Pending             |
  | P2       | Completed Tasks (9 funcs) | ~214  | completedTasksManager.js (NEW)       | Pending             |
  | P3       | Initial Setup (2 funcs)   | ~190  | appInit.js (exists)                  | Pending             |
  | P5       | Progress System (7 funcs) | ~270  | progressManager.js (NEW)             | Pending             |
  | P6       | remindOverdueTasks()      | ~102  | notifications.js or taskReminders.js | Pending             |

   | Function                       | Lines | Worth Extracting?        |
  |--------------------------------|-------|--------------------------|
  | addTask()                      | ~40   | Keep - core orchestrator |
  | validateAndSanitizeTaskInput() | ~25   | Keep - fallback          |
  | loadTaskContext()              | ~45   | Keep - fallback          |
  | createOrUpdateTaskData()       | ~90   | Keep - fallback          |
  | createTaskDOMElements()        | ~124  | Could extract to taskDOM |
  | autoSave()                     | ~47   | Keep - core              |
  | loadMiniCycleData()            | ~111  | Keep - core              |
  | updateCycleData()              | ~57   | Keep - core              |
  | detectDeviceType()             | ~58   | Small utility            |
  | setupMiniCycleTitleListener()  | ~19   | Small setup              |
  | Various event handlers         | ~200  | Small handlers           |