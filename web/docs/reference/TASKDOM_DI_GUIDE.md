# DI-Pure Module Guide

**Last verified:** Nov 10 2026

> How to use TaskDOMManager, TaskCore, and other DI-pure modules correctly

## TL;DR

**New code**: declare the dependency in your module's manifest and receive it through DI
**Wrapper functions**: `taskDOM.js` and `taskCore.js` also export plain functions (`addTask`, `validateAndSanitizeTaskInput`, ...) that delegate to the instance. The loader routes them as injected deps. Nothing is exposed on `window.*`.

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
| **Core class** | Code that needs the instance | Injected: `taskCore` (lazy proxy) and `TaskDOMManager` (bound proxy) in `moduleLoader.js` depMappings; the instances live at `deps.task.taskCore` / `deps.task.taskDOMManager` (manifest `provideInstance`) |
| **Wrapper functions** | Code that needs one operation | Injected by name (`addTask`, `validateAndSanitizeTaskInput`, ...) — the names in each manifest's `provides` |

---

## Correct Usage in New Code

### Receive via dependency injection

No app module imports `taskDOM.js` or `taskCore.js` directly; the loader imports them and routes what they provide. `taskDOM.js` does not export its instance at all (`taskCore.js` exports `taskCoreInstance`, but nothing in `modules/` imports it).

```javascript
// modules/boot/moduleManifests.js — declare what you use
myNewModule: {
    path: '../features/myNewModule.js',
    phase: PHASES.UI_MANAGERS,
    requires: ['AppState'],
    optionalDeps: ['addTask', 'validateAndSanitizeTaskInput'],
    after: ['taskCore']
},

// modules/features/myNewModule.js
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('MyNewModule', {
    AppState: required(),
    addTask: optional(null),
    validateAndSanitizeTaskInput: optional(null)
});
export const setMyNewModuleDependencies = di.setDependencies;

export class MyNewModule {
    get deps() { return di.resolve(); }

    async doSomething(text) {
        const sanitized = this.deps.validateAndSanitizeTaskInput?.(text);
        if (!sanitized) return;
        return this.deps.addTask?.(sanitized);
    }
}
```

The full pipeline (manifest, depMappings, appContext API) is in [MAKING_CODE_CHANGES.md](../working-on-code/MAKING_CODE_CHANGES.md).

---

## What NOT to Do in New Code

```javascript
// DON'T: Reach for window.* — these globals do not exist
window.validateAndSanitizeTaskInput(text);  // undefined
window.addTask(text);                        // undefined
const core = window.taskCore;               // undefined

// DON'T: Use a dep the manifest does not declare
this.deps.addTask(text);                     // arrives undefined/null with no error
```

`validate:di` (CI, gated) fails on a dep that is read but not declared.

---

## Version Injection (AppMeta)

DI-pure modules receive their version via injection, not globals:

```javascript
// modules/boot/coreBoot.js builds it once, from version.js's APP_VERSION
deps.core.AppMeta = { version: APP_VERSION, appInitVersion: APPINIT_VERSION || null };

// Inside TaskCore / TaskDOMManager constructors (no window.* access)
this.version = resolvedDeps.AppMeta?.version;

// ...and init() uses it to load the sub-modules
import(`./taskCRUD.js?v=${version}`)
```

There is no fallback inside the module: without `AppMeta`, `TaskDOMManager.init()` warns and imports with `?v=undefined`. The `'dev-local'` fallback lives upstream, where `APP_VERSION` is read (`orchestrator.js`, `coreBoot.js`).

---

## TaskDOMManager Sub-Modules

After `initTaskDOMManager()` runs, the manager has these sub-modules (all dynamically imported by `init()`; none is in `moduleManifests.js`, and none should be added):

| Sub-module | File | Purpose | Key methods |
|------------|------|---------|-------------|
| `manager.validator` | `taskValidation.js` | Input validation | `validateAndSanitizeTaskInput()` |
| `manager.renderer` | `taskRenderer.js` | UI rendering | `renderTasks()`, `refreshUIFromState()`, `refreshTaskListUI()` |
| `manager.events` | `taskEvents.js` | Event handling | `initEventDelegation()`, `handleTaskButtonClick()` |
| `manager.buttons` | `taskButtons.js` | Task button creation | |
| `manager.patcher` | `taskDOMPatch.js` | In-place DOM patching | `patchTask()`, `applyTaskOrder()` |

`taskUtils.js` is the sixth file loaded, but `TaskUtils` is a class of static methods (`TaskUtils.buildTaskContext()`, `TaskUtils.loadTaskContext()`, ...) held at module level, not a `manager.utils` instance.

---

## Two Task Rendering Paths (Important!)

This used to be two separate code paths. It is now one: `renderTasksToDOM()` in `routineLoader.js` (boot, routine switching) is a thin wrapper that calls the same `TaskRenderer.renderTasks()` in `taskRenderer.js` that undo/redo and `refreshUIFromState()` use. If the renderer is unavailable it logs an error and leaves the existing list alone.

| Caller | When Used | Renders through |
|--------|-----------|-----------------|
| `renderTasksToDOM()` in `routineLoader.js` | Boot-time, routine switching | `TaskRenderer.renderTasks()` |
| `refreshUIFromState()` / `refreshTaskListUI()` | Undo/redo, state refresh, runtime updates | `TaskRenderer.renderTasks()` |

**Why this matters:** A hook for "after tasks are rendered" (e.g., updating UI based on task count) belongs in the renderer, and one injection covers every path.

**Example - Task Search Visibility:**
```javascript
// modules/boot/moduleLoader.js, runPostInitInjections()
deps.task.taskDOMManager.renderer.injectDependency('updateSearchVisibility', deps.ui.updateSearchVisibility);
deps.task.taskDOMManager.renderer.injectDependency('reapplyActiveFilter', deps.ui.reapplyActiveFilter);
```

`renderTasks()` then calls `this.deps.updateSearchVisibility?.(tasksArray.length)` after every render. `featureBoot.js` still also hands `updateSearchVisibility` to `setRoutineLoaderDependencies()`, and `routineLoader.js` still declares it, but `renderTasksToDOM()` no longer reads it.

**A renderer dep that arrives after construction** (a later boot phase) must be pushed in with `injectDependency()`; `taskDOMManager.injectDependency(name, value)` sets it on the manager and forwards it to the renderer.

---

## TaskCore Dependencies

TaskCore's dependencies are declared in two places that must agree: the `createDIModule('TaskCore', {...})` block at the top of `taskCore.js` and the `taskCore` entry in `moduleManifests.js`.

```javascript
// modules/boot/moduleManifests.js (abridged — read the file for the full list)
taskCore: {
    path: '../task/taskCore.js',
    phase: PHASES.UI_MANAGERS,
    requires: ['appInit', 'AppState', 'showNotification', 'sanitizeInput',
               'removeRecurringTasksFromCycle', 'vocabThemeManager'],
    optionalDeps: ['AppGlobalState', 'updateStatsPanel', 'updateProgressBar',
                   'refreshUIFromState', 'validateAndSanitizeTaskInput', /* ... */],
    provides: ['addTask', 'editTask', 'deleteTask', 'toggleTaskPriority',
               'handleTaskCompletionChange', 'resetTasks', 'saveRoutineToState',
               'handleCompleteAllTasks'],
    provideInstance: 'taskCore',
    api: 'task',
    after: ['taskDOM', 'cycleCompletion', 'recurringIntegration']
}
```

Many of the `optionalDeps` are forward-through: TaskCore does not call them itself, it hands them to its dynamically imported sub-modules (`taskCRUD.js`, `taskCompletion.js`, `taskCycleReset.js`). Undeclared, they arrive null. The same holds for `taskDOM` and its sub-modules.

---

## When Legacy Wrappers Are OK

The wrapper functions at the bottom of `taskDOM.js` and `taskCore.js` (labelled "Legacy Compatibility Layer" in `taskDOM.js`) are how most of the app calls these modules today: they are the names in each manifest's `provides`, so a consumer that declares `addTask` or `refreshUIFromState` gets the wrapper. They are module-level functions, not `window.*` globals, and they go through DI like everything else.

Use a wrapper when you need one operation. Ask for the instance (`taskCore`, `TaskDOMManager`) only when you need something the wrappers do not cover.

---

## Testing DI-Pure Modules

DI-pure modules can be constructed with mock dependencies. The project's tests are browser tests with their own `test(name, fn)` helper (no Jest); this is the shape used in `tests/taskCore.tests.js`:

```javascript
// tests/taskCore.tests.js
import { TaskCore, setTaskCoreDependencies, initTaskCore } from '../modules/task/taskCore.js';
import { createMockAppState, createMockNotification, setupTestEnvironment } from './testHelpers.js';

await test('accepts dependency injection', async () => {
    const mockNotification = (msg) => ({ message: msg });

    const instance = new TaskCore({ showNotification: mockNotification });

    if (!instance || !instance.deps.showNotification) {
        throw new Error('Dependency injection failed');
    }
});

await test('addTask accepts all parameters', async () => {
    const instance = new TaskCore({
        validateAndSanitizeTaskInput: (text) => text,
        loadTaskContext: () => null
    });

    await instance.addTask('Test Task', { completed: false, shouldSave: true });
});
```

`TaskCore` declares every dep `optional`, so `new TaskCore()` constructs with fallbacks. `TaskDOMManager` throws from its constructor without `AppState` and `sanitizeInput`, and declares `vocabThemeManager` as `required()`.

---

## Quick Reference

```javascript
// Do this: declare in the manifest, read from injected deps
this.deps.validateAndSanitizeTaskInput(text);
this.deps.addTask(text);

// Not this: these globals do not exist
window.validateAndSanitizeTaskInput(text);
window.addTask(text);
```

---

## Related Documentation

- [MODULAR_OVERHAUL_PLAN.md](../archive/MODULAR_OVERHAUL_PLAN.md) - Full DI refactoring plan
- [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md) - Version injection via AppMeta
- [MODULE_SYSTEM_GUIDE.md](../architecture/MODULE_SYSTEM_GUIDE.md) - General module patterns
