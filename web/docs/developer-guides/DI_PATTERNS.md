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

## Lazy Getter Pattern for Circular Dependencies

When two modules need each other, use lazy getters to defer resolution:

```javascript
// In miniCycle-scripts.js
setTaskEventsDependencies({
    get taskCore() { return taskCore; },  // Resolved when accessed, not when passed
    // ...
});
```

This allows passing a reference to something that doesn't exist yet.

---

## DI-Pure Checklist

A module is "DI-pure" when:

- [ ] No `|| window.*` fallbacks in constructor or methods
- [ ] Has `set*Dependencies()` function for late injection
- [ ] Uses getter pattern if instance is created before deps are available
- [ ] All external dependencies come through `_deps` or constructor
- [ ] Console log confirms: `'Module loaded (DI-pure, no window.* exports)'`

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

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main developer guide
- [TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md) - DI-pure implementation example
- [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) - Progress tracking
