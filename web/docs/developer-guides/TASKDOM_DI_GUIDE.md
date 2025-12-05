# DI-Pure Module Guide

> How to use TaskDOMManager, TaskCore, and other DI-pure modules correctly

## TL;DR

**New code**: Import and use the manager instance directly or inject via dependencies
**Legacy code**: Can still use `window.*` wrappers (but don't write new code this way)

---

## DI-Pure Modules

These modules have NO `window.*` fallbacks in their constructor/deps:

| Module | Class | DI-Pure Since |
|--------|-------|---------------|
| `taskDOM.js` | TaskDOMManager | Dec 2025 |
| `taskCore.js` | TaskCore | Dec 2025 |

---

## The Two Layers

DI-pure modules have two layers:

| Layer | For | How to access |
|-------|-----|---------------|
| **Core class** | New DI-compliant modules | `import { instance }` or inject via dependencies |
| **Legacy wrappers** | Old `window.*` callers | `window.functionName()`, etc. |

---

## Correct Usage in New Code

### Option 1: Import directly (preferred)

```javascript
import { taskDOMManager } from './modules/task/taskDOM.js';
import { taskCoreInstance } from './modules/task/taskCore.js';

// Use the manager's methods
const sanitized = taskDOMManager.validator.validateAndSanitizeTaskInput(text);
await taskCoreInstance.addTask(text);
```

### Option 2: Receive via dependency injection

```javascript
class MyNewModule {
    constructor(dependencies = {}) {
        this.taskDOM = dependencies.taskDOMManager;
        this.taskCore = dependencies.taskCore;
    }

    async doSomething(text) {
        const sanitized = this.taskDOM.validator.validateAndSanitizeTaskInput(text);
        return this.taskCore.addTask(sanitized);
    }
}

// In miniCycle-scripts.js
const myModule = new MyNewModule({
    taskDOMManager: window.__taskDOMManager,
    taskCore: window.taskCore
});
```

---

## What NOT to Do in New Code

```javascript
// DON'T: Use window.* wrappers in new modules
window.validateAndSanitizeTaskInput(text);  // Legacy only!
window.addTask(text);                        // Legacy only!

// DON'T: Access window.* directly in module code
const core = window.taskCore;               // Breaks DI purity

// DON'T: Import then ignore the manager and use globals anyway
import { taskCoreInstance } from './taskCore.js';
window.addTask(text);                        // Why import then?
```

---

## Version Injection (AppMeta)

DI-pure modules receive their version via injection, not globals:

```javascript
// In miniCycle-scripts.js (window.* OK here - it's the wiring hub)
const taskCore = await initTaskCore({
    AppMeta: window.AppMeta,  // { version: '1.392' }
    // ...other deps
});

// Inside TaskCore (no window.* access)
this.version = mergedDeps.AppMeta?.version;  // DI-pure
const version = this.version || 'dev-local'; // For dynamic imports
```

---

## TaskDOMManager Sub-Modules

After `initTaskDOMManager()` runs, the manager has these sub-modules:

| Sub-module | Purpose | Key methods |
|------------|---------|-------------|
| `manager.validator` | Input validation | `validateAndSanitizeTaskInput()` |
| `manager.utils` | Task utilities | `buildTaskContext()`, `extractTaskDataFromDOM()` |
| `manager.renderer` | UI rendering | `refreshUIFromState()`, `refreshTaskListUI()` |
| `manager.events` | Event handling | `initEventDelegation()`, `handleTaskButtonClick()` |

---

## TaskCore Dependencies

TaskCore receives these injectable dependencies:

```javascript
const taskCore = await initTaskCore({
    // State management
    AppState: window.AppState,
    AppGlobalState: window.AppGlobalState,  // For isResetting flag
    AppMeta: window.AppMeta,                 // For version

    // Safe storage utilities (DI-pure)
    safeJSONParse: GlobalUtils.safeJSONParse,
    safeJSONStringify: GlobalUtils.safeJSONStringify,
    safeLocalStorageGet: GlobalUtils.safeLocalStorageGet,
    safeLocalStorageSet: GlobalUtils.safeLocalStorageSet,

    // UI updates
    showNotification: deps.utils.showNotification,
    updateStatsPanel: () => window.updateStatsPanel?.(),
    refreshUIFromState: () => window.refreshUIFromState?.(),
    // ...etc
});
```

---

## When Legacy Wrappers Are OK

The legacy wrappers exist for:
- Old code that hasn't been migrated yet
- HTML onclick handlers that need global access
- Third-party integrations that expect `window.*`

If you're writing **new module code**, always use the DI approach.

---

## Testing DI-Pure Modules

DI-pure modules can be tested in isolation:

```javascript
// taskCore.test.js
import { TaskCore } from './taskCore.js';

describe('TaskCore', () => {
    it('adds a task', async () => {
        const mockAppState = {
            get: () => ({ data: { cycles: { main: { tasks: [] } } } }),
            update: jest.fn(),
            isReady: () => true
        };
        const mockNotify = jest.fn();

        const taskCore = new TaskCore({
            AppState: mockAppState,
            AppMeta: { version: '1.0.0' },
            showNotification: mockNotify,
            sanitizeInput: x => x,
            safeJSONParse: JSON.parse,
            safeJSONStringify: JSON.stringify,
            safeLocalStorageGet: () => null,
            safeLocalStorageSet: () => {},
            // ...minimal deps
        });

        await taskCore.addTask('Test task');

        expect(mockAppState.update).toHaveBeenCalled();
    });
});
```

---

## Quick Reference

```javascript
// NEW CODE - Do this
import { taskDOMManager } from './modules/task/taskDOM.js';
import { taskCoreInstance } from './modules/task/taskCore.js';
taskDOMManager.validator.validateAndSanitizeTaskInput(text);
taskCoreInstance.addTask(text);

// LEGACY CODE - Exists but don't add new usage
window.validateAndSanitizeTaskInput(text);
window.addTask(text);
```

---

## Related Documentation

- [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) - Full DI refactoring plan
- [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md) - Version injection via AppMeta
- [MODULE_SYSTEM_GUIDE.md](./MODULE_SYSTEM_GUIDE.md) - General module patterns
