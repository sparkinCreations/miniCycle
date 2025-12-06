# DI Patterns Guide

This document covers dependency injection patterns used in miniCycle, including common pitfalls and lessons learned.

## Core Pattern: Module-Level `_deps` with Late Injection

```javascript
// Module-level deps for late injection
let _deps = {
    AppState: null,
    taskCore: null,
    showNotification: null
};

// Called from miniCycle-scripts.js after dependencies are available
export function setModuleDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
}
```

---

## Lesson Learned: Instance Getter Pattern

### The Problem

When a class instance is created **before** dependencies are injected, capturing `_deps` values at construction time causes them to be permanently `null`:

```javascript
// BAD: Captures values at construction time
class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        this.deps = {
            taskCore: mergedDeps.taskCore,  // Captured as null!
        };
    }

    doSomething() {
        // this.deps.taskCore is still null even after setModuleDependencies() was called
        this.deps.taskCore.doThing();  // ERROR: Cannot read property 'doThing' of null
    }
}
```

**Timeline of failure:**
1. `initMyModule()` creates instance → `this.deps.taskCore = null`
2. `setModuleDependencies({ taskCore })` updates `_deps.taskCore`
3. User clicks button → `this.deps.taskCore` is still `null`

### The Solution

Use a **getter** so `this.deps` reads from `_deps` at access time, not construction time:

```javascript
// GOOD: Reads current _deps values at access time
class MyModule {
    constructor(dependencies = {}) {
        // Only store constructor-specific deps that won't change
        this._constructorDeps = {
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id))
        };
    }

    // Getter resolves _deps at access time
    get deps() {
        return {
            taskCore: _deps.taskCore,  // Reads current value!
            showNotification: _deps.showNotification || this.fallbackNotification,
            ...this._constructorDeps
        };
    }

    doSomething() {
        // this.deps.taskCore now resolves to current _deps.taskCore
        this.deps.taskCore.doThing();  // Works!
    }
}
```

**Timeline of success:**
1. `initMyModule()` creates instance
2. `setModuleDependencies({ taskCore })` updates `_deps.taskCore`
3. User clicks button → `this.deps.taskCore` getter reads current `_deps.taskCore` → Works!

### When to Use This Pattern

Use the getter pattern when **ALL** of these are true:
- Module uses `set*Dependencies()` for late injection
- Instance is created before all dependencies are available
- Instance needs to access dependencies that are injected after construction

### Modules Using This Pattern

- `taskEvents.js` - Instance created before `taskCore` exists
- `basicPluginSystem.js` - `MiniCyclePlugin` base class uses getter for `deps`

---

## Wiring in miniCycle-scripts.js (Critical Step)

Making a module DI-pure requires **two steps**:

1. **Module changes** - Add `_deps`, getter pattern, remove `window.*` fallbacks
2. **Main script wiring** - Call `set*Dependencies()` before instantiation

**Forgetting step 2 causes all dependencies to be null/undefined**, resulting in warnings like:
- `"Dark mode toggle not available"`
- `"AppState not available"`
- `"Data loading not available"`

### Wiring Pattern

```javascript
// In miniCycle-scripts.js

// 1. Import the setter along with the module
const { MyModule, setMyModuleDependencies } = await import(withV('./modules/path/myModule.js'));

// 2. Wire dependencies BEFORE creating instance
setMyModuleDependencies({
    showNotification: deps.utils.showNotification,
    loadData: () => window.loadMiniCycleData?.(),

    // Use lazy getters for deps that don't exist yet at wiring time
    get AppState() { return window.AppState; },
    get taskCore() { return window.taskCore; },

    AppMeta: window.AppMeta
});

// 3. NOW create the instance (it will read from _deps via getter)
const myModule = new MyModule();
```

### Lazy Getters in Wiring

Use lazy getters (`get X() { return window.X; }`) when:
- The dependency doesn't exist yet at wiring time
- The dependency may be replaced/updated later
- You need circular dependency resolution

```javascript
// BAD: Captures undefined if AppState isn't ready yet
setMyModuleDependencies({
    AppState: window.AppState,  // undefined at this point!
});

// GOOD: Resolves when actually accessed
setMyModuleDependencies({
    get AppState() { return window.AppState; },  // Works!
});
```

---

## DI-Pure Checklist

A module is "DI-pure" when:

**Module side:**
- [ ] No `|| window.*` fallbacks in constructor or methods
- [ ] Has `set*Dependencies()` function for late injection
- [ ] Uses getter pattern if instance is created before deps are available
- [ ] All external dependencies come through `_deps` or constructor
- [ ] Console log confirms: `'Module loaded (DI-pure, no window.* exports)'`

**Wiring side (miniCycle-scripts.js):**
- [ ] Imports `set*Dependencies` along with the module
- [ ] Calls `set*Dependencies({...})` BEFORE creating instance
- [ ] Uses lazy getters for deps that don't exist at wiring time

### DI-Pure Modules (as of Dec 2025)

**Fully DI-Pure (no `window.*` fallbacks):**
- `taskCore.js` - Task state management
- `taskEvents.js` - Task event handling
- `notifications.js` - Notification system
- `basicPluginSystem.js` - Plugin architecture
- `pluginIntegrationGuide.js` - Plugin docs/helpers
- `statsPanel.js` - Stats panel UI
- `settingsManager.js` - Settings management
- `taskOptionsCustomizer.js` - Task button customization
- `recurringPanel.js` - Recurring task UI panel
- `taskDOM.js` - Task DOM manipulation
- `errorHandler.js` - Global error handling
- `deviceDetection.js` - Device capability detection
- `reminders.js` - Task reminder system
- `pullToRefresh.js` - Mobile pull-to-refresh
- `taskUtils.js` - Task utility functions

**Intentionally Uses `window.*` (wiring layer):**
- `orchestrator.js` - This is the bridge between DI-pure modules and legacy code. It's *supposed* to expose modules to `window.*`

---

## Common Mistakes

### 1. Forgetting the getter when needed
```javascript
// Instance created at module load, deps injected later
const instance = new MyClass();  // deps are null
export function setDeps(d) { _deps = d; }  // Too late for instance.deps
```

### 2. Using `this.deps = _deps` directly
```javascript
// BAD: Still captures reference at construction time
this.deps = _deps;  // If _deps is reassigned, this.deps won't update
```

### 3. Not merging constructor deps with module deps
```javascript
// BAD: Ignores constructor-passed deps
get deps() {
    return { ..._deps };  // Missing constructor overrides
}

// GOOD: Merge both
get deps() {
    return { ..._deps, ...this._constructorDeps };
}
```

### 4. Forgetting to wire in miniCycle-scripts.js
```javascript
// BAD: Module is DI-pure but dependencies never injected
const { MyModule } = await import('./myModule.js');
const instance = new MyModule();  // All deps are null!

// GOOD: Wire before instantiation
const { MyModule, setMyModuleDependencies } = await import('./myModule.js');
setMyModuleDependencies({ /* deps */ });
const instance = new MyModule();  // Deps available via getter
```

### 5. Not using lazy getters for late-available deps
```javascript
// BAD: window.AppState doesn't exist yet
setMyModuleDependencies({
    AppState: window.AppState  // undefined!
});

// GOOD: Defer resolution
setMyModuleDependencies({
    get AppState() { return window.AppState; }
});
```

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main developer guide
- [TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md) - DI-pure implementation example
- [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) - Progress tracking



  - errorHandler.js (9)
  - deviceDetection.js (8)
  - reminders.js (7)
  - pullToRefresh.js (6)
  - taskUtils.js (6)