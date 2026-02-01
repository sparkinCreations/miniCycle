# Making Code Changes

**Last Updated:** January 31, 2026
**Status:** Practical guide for modifying miniCycle modules

> This guide is for developers (or AI assistants) who need to make changes to the miniCycle codebase. It covers the dependency wiring workflow — the part most likely to cause silent bugs.

---

## Table of Contents

1. [Who This Is For](#who-this-is-for)
2. [How Dependencies Flow](#how-dependencies-flow)
3. [Adding a Dependency to a Module](#adding-a-dependency-to-a-module)
4. [Constructor Patterns](#constructor-patterns)
5. [Common Pitfalls](#common-pitfalls)
6. [Quick Reference Checklist](#quick-reference-checklist)

---

## Who This Is For

You should read this if you're about to:

- Add a new function call between two modules
- Wire a new dependency into an existing module
- Debug why a function is `undefined` at runtime
- Understand why a change you made "should work" but doesn't

This guide does **not** cover creating entirely new modules (see [MODULE_LOADER_GUIDE.md](./MODULE_LOADER_GUIDE.md)) or the DI primitives themselves (see [DI_PATTERNS.md](./DI_PATTERNS.md)). It covers the practical workflow of making a change touch all the right files.

---

## How Dependencies Flow

Every dependency passes through a 4-step pipeline before it reaches your module code:

```
┌──────────────────────┐
│  1. MODULE MANIFEST   │  moduleManifests.js — declares what a module needs
│     requires: [...]   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  2. MODULE LOADER     │  moduleLoader.js — builds the dependency object
│     depMappings       │  using lazy wrappers and createValidatedWrapper()
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  3. INTEGRATION       │  e.g. recurringIntegration.js — receives deps from
│     setDependencies() │  the loader, rewires them for sub-modules
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  4. MODULE            │  e.g. recurringPanel.js — uses this.deps.X
│     this.deps.X       │  in its methods
└──────────────────────┘
```

### What `createValidatedWrapper` Does

When the module loader wires a dependency like `refreshUIFromState`, it doesn't pass the function directly. It wraps it:

```javascript
// modules/boot/moduleLoader.js:787-788
refreshUIFromState: createValidatedWrapper('refreshUIFromState',
    () => deps.task?.refreshUIFromState),
```

The wrapper (`moduleLoader.js:146-166`) does three things:
1. **Defers resolution** — the `getter` function isn't called until your code actually invokes `refreshUIFromState()`
2. **Warns on null** — if the function hasn't been registered yet, it logs `"Lazy dep 'refreshUIFromState' resolved to null at call time"` instead of crashing
3. **Calls through** — once the real function exists, the wrapper forwards all arguments to it

This means a dependency can be wired *before* the providing module has loaded. The wrapper holds the slot open.

---

## Adding a Dependency to a Module

Here's the complete checklist, using a real example: adding `refreshUIFromState` to the recurring panel so it can re-render the task list after making a state change.

### Step 1: Declare it in the module's DI schema

Open the module that *needs* the dependency and add it to the `createDIModule` call.

```javascript
// modules/recurring/recurringPanel.js:32-56
const di = createDIModule('RecurringPanel', {
    // ... existing required deps ...
    AppState: required(),
    showNotification: required(),
    // ...

    // Optional — genuinely nullable, code checks before use
    syncRecurringStateToDOM: optional(null),
    refreshUIFromState: optional(null)      // <-- ADD HERE
}, { strict: true });
```

**Required vs Optional?** If the module can't function at all without it, use `required()`. If it's a nice-to-have (like a DOM sync that can be skipped), use `optional(null)`.

### Step 2: Wire it in the integration file

Open the integration file that coordinates this module. For recurring, that's `recurringIntegration.js`. Find where `setRecurringPanelDependencies` is called and add the new dep:

```javascript
// modules/recurring/recurringIntegration.js:194-218
setRecurringPanelDependencies({
    // ... existing deps ...
    AppState: deps.AppState,
    showNotification: deps.showNotification,

    // Optional
    syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
    refreshUIFromState: () => deps.refreshUIFromState?.()   // <-- ADD HERE
});
```

Note the `() => deps.refreshUIFromState?.()` pattern. This creates a closure that:
- Resolves `deps.refreshUIFromState` lazily (at call time, not wire time)
- Uses optional chaining (`?.`) to no-op if the dep is still null

### Step 3: Declare it in the manifest's `requires`

Open `moduleManifests.js` and add the dependency name to the module's `requires` array:

```javascript
// modules/boot/moduleManifests.js:234-243
recurringIntegration: {
    path: '../recurring/recurringIntegration.js',
    phase: PHASES.RECURRING,
    requires: ['appInit', 'AppState', 'showNotification',
               'showNotificationWithTip', 'notifications',
               'FeatureFlags', 'GlobalUtils',
               'refreshUIFromState'],              // <-- ALREADY HERE
    lazyRequires: ['updateProgressBar'],
    provides: ['panel', 'core'],
    api: 'recurring',
    after: ['taskDOM', 'reminders']
},
```

In this case, `refreshUIFromState` was already in `requires`. But if your dependency comes from a *later* phase, put it in `lazyRequires` instead — the manifest validator (`validateCrossPhaseDeeps`) will warn you if you get this wrong.

### Step 4: Check the module loader's `depMappings`

The module loader (`moduleLoader.js:655-1002`) has a giant `depMappings` object that maps dependency names to lazy resolution closures. Verify your dependency has an entry:

```javascript
// modules/boot/moduleLoader.js:787-788
refreshUIFromState: createValidatedWrapper('refreshUIFromState',
    () => deps.task?.refreshUIFromState),
```

If there's no entry, your dependency won't be available even if it's in `requires`. Add one following the existing patterns.

### Step 5: Use it in your module code

Now you can call `this.deps.refreshUIFromState()` in any method:

```javascript
// modules/recurring/recurringPanel.js:1604-1607
// Refresh main task list from state
setTimeout(() => {
    this.deps.refreshUIFromState?.();
}, 0);
```

### Summary: Files Changed

| Step | File | What to change |
|------|------|---------------|
| 1 | Module DI schema | Add `required()` or `optional(null)` entry |
| 2 | Integration file | Wire the dep in `setDependencies()` call |
| 3 | `moduleManifests.js` | Add to `requires` or `lazyRequires` |
| 4 | `moduleLoader.js` | Verify `depMappings` has an entry |
| 5 | Module code | Call `this.deps.yourDep()` |

Miss any one of these and the dep silently resolves to `undefined`.

---

## Constructor Patterns

There are three ways a module's constructor handles the dependencies it receives. Understanding which pattern a module uses is critical — it determines whether a new dependency you wire will actually be accessible.

### Approach A: Direct DI Resolution (diBase)

The module uses `diBase.js` with `required()`/`optional()` markers. No constructor at all, or the constructor calls `di.resolve()`.

```javascript
// Example: modules/recurring/recurringSettingsApplicator.js
const di = createDIModule('RecurringSettingsApplicator', {
    AppState: required(),
    showNotification: required(),
    syncRecurringStateToDOM: optional(null)
});

// deps accessed via di.resolve() — no constructor mapping
const deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop]; }
});
```

**How deps arrive:** Everything injected via `di.setDependencies()` is available automatically through `di.resolve()`.

**When to use:** Modules that are pure functions (no class), or modules that use a Proxy for late-binding access.

### Approach B: Manual Property Mapping

The constructor builds `this.deps` by hand, listing each property explicitly:

```javascript
// Example: modules/task/taskCore.js:228-260
constructor(dependencies = {}) {
    const resolvedDeps = { ..._deps, ...dependencies };
    this.deps = {
        AppState: resolvedDeps.AppState || null,
        loadMiniCycleData: resolvedDeps.loadMiniCycleData || this.fallbackLoadData,
        sanitizeInput: resolvedDeps.sanitizeInput || ((text) => text),
        // ... every dep listed explicitly ...
    };
}
```

**The danger:** If you wire a new dep into `setDependencies()` but forget to add the corresponding line in the constructor, `this.deps.yourNewDep` will be `undefined`. The DI schema accepted it, the integration wired it, but the constructor's manual mapping dropped it on the floor. **This is the most common source of silent bugs.**

**When to use:** Legacy modules that need fine-grained fallback behavior per-dep. Don't use this for new work.

### Approach C: Spread Resolution (Preferred)

The constructor spreads `di.resolve()` directly into `this.deps`:

```javascript
// Example: modules/recurring/recurringPanel.js:74-79
export class RecurringPanelManager {
    constructor(dependencies = {}) {
        // Resolve and spread — schema defines required vs optional
        this.deps = { ...di.resolve(dependencies) };

        this.state = { /* ... */ };
    }
}
```

**How deps arrive:** Every dependency in the `createDIModule` schema is available in `this.deps` after the spread. No manual mapping needed.

**When to use:** All new modules. This is the preferred pattern because adding a new dependency to the schema automatically makes it available in the constructor — no extra mapping step to forget.

### Pattern Comparison

| | Approach A (Proxy) | Approach B (Manual) | Approach C (Spread) |
|---|---|---|---|
| Add new dep to schema | Automatically available | **Must also add to constructor** | Automatically available |
| Fallback per-dep | Use `optional(defaultValue)` | Inline in constructor | Use `optional(defaultValue)` |
| Risk of silent drops | Low | **High** | Low |
| Used by | recurringIntegration, settingsApplicator | taskCore, routineManager | recurringPanel, routineSwitcher |

---

## Common Pitfalls

These are real bugs from the miniCycle codebase. Each one cost debugging time because it silently produced wrong behavior.

### Pitfall 1: The Constructor Mapping Gap (Approach B)

**What happened:** A new dependency was wired into a module's `setDependencies()` call, but the module's constructor used Approach B (manual mapping). The constructor didn't include the new dep, so `this.deps.newDep` was `undefined`.

**Why it's silent:** No error is thrown. `this.deps.newDep?.()` just no-ops. The code "works" — it just doesn't do anything.

**How to avoid:**
1. Before wiring a new dep, open the module and check which constructor pattern it uses
2. If it uses Approach B (manual `this.deps = { ... }` mapping), add your dep there too
3. For new modules, use Approach C (spread `di.resolve()`) to avoid this class of bug entirely

### Pitfall 2: String vs DOM Element

**What happened:** `syncRecurringStateToDOM(taskId)` was called with a string task ID, but the function expects a DOM element.

```javascript
// WRONG — passing a string ID
this.deps.syncRecurringStateToDOM(taskId);

// RIGHT — find the DOM element first, then pass it
const taskEl = document.querySelector(`#taskList [data-task-id="${taskId}"]`);
if (taskEl) {
    this.deps.syncRecurringStateToDOM(taskEl);
}
```

**Why it's silent:** `syncRecurringStateToDOM` likely calls methods like `element.classList.add()` on its argument. When that argument is a string, those method calls fail silently or throw an error that gets swallowed.

**How to avoid:** Check the function signature of the dependency you're calling. Look at how other callers use it — find existing call sites with a codebase search.

### Pitfall 3: Fixing the Wrong Function

**What happened:** The "Add X Tasks to Recurring" button in the panel calls `handleConfirmAddRecurring()` in `recurringPanel.js:1528`. But a bug fix was applied to `applyRecurringSettings()` in `recurringSettingsApplicator.js` instead — a completely separate code path.

The two functions do similar things (mark tasks as recurring) but are called from different UI actions:
- **`applyRecurringSettings()`** — called when configuring settings for a single task via the settings form
- **`handleConfirmAddRecurring()`** — called when bulk-adding selected tasks from the "Add Task" list

The fix in `applyRecurringSettings()` worked for the settings form, but the bulk-add path still had the bugs (missing `deleteWhenComplete`, broken DOM sync).

**How to avoid:**
1. Start from the UI action, not the function name. Click the button, trace the event handler, find the actual code path
2. Search for all callers of the function you think you're fixing: `grep -r "functionName" modules/`
3. If there are multiple code paths to the same behavior, fix all of them

### Pitfall 4: Missing `deleteWhenComplete` on Bulk Operations

**What happened:** When `handleConfirmAddRecurring()` was first written, it set `task.recurring = true` and `task.recurringSettings = {...}` but forgot to set `deleteWhenComplete = true` and `deleteWhenCompleteSettings`. The individual task path (`recurringActivation.js`) set these correctly, but the bulk path didn't.

The fix (now in `recurringPanel.js:1575-1576`):

```javascript
selectedTaskIds.forEach(taskId => {
    const task = cycle.tasks.find(t => t.id === taskId);
    if (task) {
        task.recurring = true;
        task.recurringSettings = { ...defaultSettings };
        task.deleteWhenComplete = true;                              // <-- was missing
        task.deleteWhenCompleteSettings = { cycle: true, todo: true }; // <-- was missing

        cycle.recurringTemplates[taskId] = {
            // ... also needs deleteWhenComplete here ...
            deleteWhenComplete: true,                                // <-- was missing
            deleteWhenCompleteSettings: { cycle: true, todo: true }  // <-- was missing
        };
    }
});
```

**How to avoid:** When a feature sets specific state properties, search the codebase for every place that creates or modifies that state. Use the working path as a reference for what properties need to be set.

---

## Quick Reference Checklist

### "I want to..."

| Goal | Files to change |
|------|----------------|
| **Call an existing function from a different module** | 1. Module DI schema (`createDIModule` or `_deps`)<br>2. Integration file (`set*Dependencies` call)<br>3. Manifest `requires`/`lazyRequires`<br>4. Verify `depMappings` in `moduleLoader.js`<br>5. Constructor mapping (if Approach B) |
| **Add a new exported function** | 1. Write the function in the source module<br>2. Register it via `provides` in the manifest<br>3. Add a `depMappings` entry in `moduleLoader.js`<br>4. Wire it wherever it's needed (see row above) |
| **Fix a bug in a UI action** | 1. Start from the button/event, not the function name<br>2. Trace the handler chain to the actual code path<br>3. Check for parallel code paths doing the same thing<br>4. Fix all paths, not just the first one you find |
| **Add a new optional dependency** | 1. `optional(null)` in DI schema<br>2. Wire with `?.()` in integration<br>3. Call with `this.deps.X?.()` (optional chaining)<br>4. Add to manifest `requires` (or `lazyRequires` if cross-phase) |
| **Change how a dependency resolves** | 1. Find its entry in `moduleLoader.js` `depMappings`<br>2. Update the getter/wrapper there<br>3. Check if integration files override it |
| **Debug a dep that's `undefined`** | 1. Is it in the DI schema?<br>2. Is it wired in the integration?<br>3. Is it in the manifest `requires`?<br>4. Is it in `depMappings`?<br>5. Does the constructor map it? (Approach B) |

---

## See Also

- [DI_PATTERNS.md](./DI_PATTERNS.md) — DI primitives, `Object.defineProperties`, instance getter pattern
- [MODULE_LOADER_GUIDE.md](./MODULE_LOADER_GUIDE.md) — Creating new modules, manifest format, phase system
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) — Dev server, testing, version management
- [TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md) — Task DOM module-specific DI patterns
- [HIDDEN_CODEBASE_INSIGHTS.md](./HIDDEN_CODEBASE_INSIGHTS.md) — Non-obvious codebase behaviors
