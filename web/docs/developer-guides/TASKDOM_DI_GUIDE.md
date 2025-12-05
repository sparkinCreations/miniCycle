# TaskDOMManager - DI Usage Guide

> How to use TaskDOMManager correctly in new code

## TL;DR

**New code**: Import and use the manager instance directly
**Legacy code**: Can still use `window.*` wrappers (but don't write new code this way)

---

## The Two Layers

TaskDOMManager has two layers:

| Layer | For | How to access |
|-------|-----|---------------|
| **Core class** | New DI-compliant modules | `import { taskDOMManager }` or inject via dependencies |
| **Legacy wrappers** | Old `window.*` callers | `window.validateAndSanitizeTaskInput()`, etc. |

---

## Correct Usage in New Code

### Option 1: Import directly (preferred)

```javascript
import { taskDOMManager } from './modules/task/taskDOM.js';

// Use the manager's sub-modules
const sanitized = taskDOMManager.validator.validateAndSanitizeTaskInput(text);
const context = taskDOMManager.utils.buildTaskContext(taskItem, taskId);
```

### Option 2: Receive via dependency injection

```javascript
class MyNewModule {
    constructor(dependencies = {}) {
        this.taskDOM = dependencies.taskDOMManager;
    }

    doSomething(text) {
        return this.taskDOM.validator.validateAndSanitizeTaskInput(text);
    }
}

// In miniCycle-scripts.js
const myModule = new MyNewModule({
    taskDOMManager: window.__taskDOMManager
});
```

---

## What NOT to Do in New Code

```javascript
// DON'T: Use window.* wrappers in new modules
window.validateAndSanitizeTaskInput(text);  // Legacy only!
window.createTaskDOMElements(ctx, data);     // Legacy only!

// DON'T: Access window.__taskDOMManager directly in module code
const manager = window.__taskDOMManager;     // Breaks DI purity

// DON'T: Import then ignore the manager and use globals anyway
import { taskDOMManager } from './taskDOM.js';
window.validateAndSanitizeTaskInput(text);   // Why import then?
```

---

## Available Sub-Modules

After `initTaskDOMManager()` runs, the manager has these sub-modules:

| Sub-module | Purpose | Key methods |
|------------|---------|-------------|
| `manager.validator` | Input validation | `validateAndSanitizeTaskInput()` |
| `manager.utils` | Task utilities | `buildTaskContext()`, `extractTaskDataFromDOM()` |
| `manager.renderer` | UI rendering | `refreshUIFromState()`, `refreshTaskListUI()` |
| `manager.events` | Event handling | `initEventDelegation()`, `handleTaskButtonClick()` |

---

## Version Injection (AppMeta)

TaskDOMManager receives its version via DI, not globals:

```javascript
// In miniCycle-scripts.js (window.* OK here)
const taskDOMManager = await initTaskDOMManager({
    AppMeta: window.AppMeta,  // { version: '1.395' }
    // ...other deps
});

// Inside TaskDOMManager (no window.* access)
this.version = mergedDeps.AppMeta?.version;  // DI-pure
const version = this.version || 'dev-local'; // For dynamic imports
```

---

## When Legacy Wrappers Are OK

The legacy wrappers exist for:
- Old code that hasn't been migrated yet
- HTML onclick handlers that need global access
- Third-party integrations that expect `window.*`

If you're writing **new module code**, always use the DI approach.

---

## Quick Reference

```javascript
// NEW CODE - Do this
import { taskDOMManager } from './modules/task/taskDOM.js';
taskDOMManager.validator.validateAndSanitizeTaskInput(text);

// LEGACY CODE - Exists but don't add new usage
window.validateAndSanitizeTaskInput(text);
```
