# miniCycle Modular Overhaul Plan

> **Goal:** Transform from file-separated globals to truly decoupled modules
> **Benefit:** Testable, maintainable, reusable code with explicit dependencies

---

## Progress Tracker

**Last Updated:** November 30, 2025
**Status:** ~15-20% Complete

### What's Done ✅

| Item | Status | Notes |
|------|--------|-------|
| `deps` container created | ✅ Done | Central wiring hub in miniCycle-scripts.js |
| `deps.core.AppState` | ✅ Done | Stored after creation |
| `deps.utils.*` populated | ✅ Done | showNotification, sanitizeInput, generateId, safeAddEventListener, syncAllTasksWithMode, etc. |
| taskValidation.js | ✅ Done | `sanitizeInput` required (throws if missing), no window.* fallback |
| dataValidator.js | ✅ Done | `setDataValidatorDependencies()` added |
| themeManager.js | ✅ Done | `setThemeManagerDependencies()`, window.* fallbacks removed |
| modalManager.js | ✅ Done | `setModalManagerDependencies()`, window.* fallbacks removed |
| taskDOM.js | ✅ Done | Constructor window.* fallbacks removed, uses injected deps |
| undoRedoManager.js | ✅ Done | Wired with deps.utils.* |
| Tests updated | ✅ Done | taskValidation.tests.js updated for Phase 2 |

### What Remains 🔄

| Item | Priority | Effort |
|------|----------|--------|
| Remove window.* fallbacks from remaining Tier 0 modules | High | ~1 hour |
| Wire Tier 2: modeManager, cycleManager, recurringCore, taskCore | High | ~2-3 hours |
| Wire Tier 3: cycleLoader, settingsManager, statsPanel, cycleSwitcher | Medium | ~2-3 hours |
| Remove `window.*` **exports** from modules | Medium | ~2-3 hours |
| Minimize window.* to HTML-only needs | Low | ~1-2 hours |
| Add isolated tests for key modules | Low | ~2-3 hours |

### Metrics

| Metric | Before (Nov 2025) | Current | Target |
|--------|-------------------|---------|--------|
| `deps.*` usage in main script | 0 | ~45 | 100+ |
| Modules with `set*Dependencies()` | 0 | 6 | 15+ |
| Modules with window.* fallbacks removed | 0 | 4 | All |
| window.* globals for HTML | ~68 | ~60 | <20 |

---

## Current State vs Target State

### Current: Global Coupling
```javascript
// taskCore.js - reaches outward for dependencies
class TaskCore {
    constructor(deps = {}) {
        this.notify = deps.showNotification || window.showNotification; // fallback = coupling
    }

    addTask(text) {
        window.AppState.update(...);     // direct global access
        window.updateStatsPanel();        // invisible dependency
        this.notify("Task added");
    }
}

// Instantiated somewhere, grabs its own deps
const taskCore = new TaskCore();
window.taskCore = taskCore;
```

### Target: True Modularity
```javascript
// taskCore.js - receives dependencies, no globals
class TaskCore {
    constructor({ AppState, updateStatsPanel, showNotification }) {
        if (!AppState) throw new Error('TaskCore requires AppState');
        if (!showNotification) throw new Error('TaskCore requires showNotification');

        this.AppState = AppState;
        this.updateStatsPanel = updateStatsPanel;
        this.notify = showNotification;
    }

    addTask(text) {
        this.AppState.update(...);       // injected dependency
        this.updateStatsPanel?.();       // explicit optional dependency
        this.notify("Task added");
    }
}

export { TaskCore };  // No instantiation, no window.*
```

```javascript
// main.js - the ONLY place with wiring
import { TaskCore } from './modules/tasks/taskCore.js';
import { createStateManager } from './modules/core/appState.js';
import { notifications } from './modules/utils/notifications.js';
import { statsPanel } from './modules/ui/statsPanel.js';

// Wire everything together
const appState = createStateManager();
const taskCore = new TaskCore({
    AppState: appState,
    updateStatsPanel: () => statsPanel.update(),
    showNotification: notifications.show
});

// Only expose what HTML onclick handlers need
window.addTask = (text) => taskCore.addTask(text);
```

---

## The Three Principles

### 1. Inversion of Control
Modules don't reach out for dependencies. Dependencies are passed in.

```javascript
// BAD: Module reaches outward
this.notify = deps.notify || window.showNotification;

// GOOD: Module receives or fails
constructor({ notify }) {
    if (!notify) throw new Error('notify required');
    this.notify = notify;
}
```

### 2. Single Wiring Location
Only `miniCycle-scripts.js` knows how modules connect. Modules don't know about each other.

```javascript
// BAD: taskDOM.js knows about statsPanel
import { statsPanel } from '../ui/statsPanel.js';

// GOOD: main script wires them
const taskDOM = new TaskDOM({
    onTaskComplete: () => statsPanel.update()
});
```

### 3. No Window Pollution from Modules
Modules export classes/functions. Main script decides what goes on `window.*`.

```javascript
// BAD: Module pollutes window
window.taskCore = new TaskCore();

// GOOD: Module exports, main script exposes
export { TaskCore };
// In main: window.taskCore = taskCore; // if needed for HTML
```

---

## Module Tiers & Refactor Order

Refactor bottom-up: start with modules that have no dependencies, work up to complex ones.

### Tier 0: Pure Utilities (No dependencies)
Refactor first - these are already close to modular.

| Module | Current Globals | Action |
|--------|-----------------|--------|
| `constants.js` | none | Already clean |
| `taskValidation.js` | `window.TaskValidator` | Remove window export |
| `taskUtils.js` | `window.TaskUtils` | Remove window export |
| `taskRenderer.js` | `window.TaskRenderer` | Remove window export |
| `dataValidator.js` | `window.DataValidator` | Remove window export |
| `deviceDetection.js` | `window.deviceDetection` | Remove window export |

**Pattern for Tier 0:**
```javascript
// BEFORE
export class TaskValidator { ... }
window.TaskValidator = TaskValidator;

// AFTER
export class TaskValidator { ... }
// That's it. No window.
```

### Tier 1: Core Infrastructure
These are used by many modules. Refactor carefully.

| Module | Current Globals | Dependencies |
|--------|-----------------|--------------|
| `appState.js` | `window.AppState` | localStorage, constants |
| `appInit.js` | `window.appInit` | none |
| `notifications.js` | `window.showNotification` | DOM |
| `globalUtils.js` | `window.GlobalUtils`, etc. | DOM |

**Pattern for Tier 1:**
```javascript
// appState.js
export function createStateManager(deps = {}) {
    const storage = deps.storage || localStorage;
    // ... implementation
    return stateManager;
}
// No window.AppState = ... here

// main.js
import { createStateManager } from './modules/core/appState.js';
const AppState = createStateManager();
// Only if HTML needs it:
window.AppState = AppState;
```

### Tier 2: Feature Modules
These depend on Tier 1 modules.

| Module | Dependencies to Inject |
|--------|------------------------|
| `taskCore.js` | AppState, showNotification, sanitizeInput |
| `taskDOM.js` | AppState, taskCore, showNotification |
| `cycleManager.js` | AppState, showNotification, sanitizeInput |
| `modeManager.js` | AppState, recurringCore |
| `undoRedoManager.js` | AppState, refreshUIFromState |
| `recurringCore.js` | AppState, showNotification |

**Pattern for Tier 2:**
```javascript
// taskCore.js
export class TaskCore {
    constructor({ AppState, showNotification, sanitizeInput }) {
        this.assertDep('AppState', AppState);
        this.assertDep('showNotification', showNotification);
        this.AppState = AppState;
        this.notify = showNotification;
        this.sanitize = sanitizeInput || (x => x); // optional with default
    }

    assertDep(name, value) {
        if (!value) throw new Error(`TaskCore: missing required dependency '${name}'`);
    }
}
```

### Tier 3: UI & Integration
These depend on Tier 2.

| Module | Dependencies to Inject |
|--------|------------------------|
| `cycleLoader.js` | AppState, taskCore, addTask, recurringCore |
| `cycleSwitcher.js` | AppState, loadMiniCycle, cycleManager |
| `settingsManager.js` | AppState, DataValidator, cycleLoader |
| `modalManager.js` | showNotification, hideMainMenu |
| `statsPanel.js` | AppState |

---

## The Wiring File

After refactoring, `miniCycle-scripts.js` becomes the wiring hub:

```javascript
// miniCycle-scripts.js - THE wiring file

// ============================================
// PHASE 1: Import all modules
// ============================================
import { createStateManager } from './modules/core/appState.js';
import { appInit } from './modules/core/appInit.js';
import { TaskCore } from './modules/tasks/taskCore.js';
import { TaskDOM } from './modules/tasks/taskDOM.js';
import { CycleManager } from './modules/cycle/cycleManager.js';
import { notifications } from './modules/utils/notifications.js';
import { StatsPanel } from './modules/ui/statsPanel.js';
// ... etc

// ============================================
// PHASE 2: Create core instances
// ============================================
const AppState = createStateManager();
const notify = notifications.show.bind(notifications);

// ============================================
// PHASE 3: Wire feature modules
// ============================================
const statsPanel = new StatsPanel({ AppState });

const taskCore = new TaskCore({
    AppState,
    showNotification: notify,
    sanitizeInput: GlobalUtils.sanitizeInput,
    updateStatsPanel: () => statsPanel.update()
});

const taskDOM = new TaskDOM({
    AppState,
    taskCore,
    showNotification: notify
});

const cycleManager = new CycleManager({
    AppState,
    showNotification: notify,
    sanitizeInput: GlobalUtils.sanitizeInput,
    loadMiniCycle: () => cycleLoader.load()
});

// ... wire all modules

// ============================================
// PHASE 4: Initialize
// ============================================
await AppState.init();
appInit.markCoreSystemsReady();

// ... initialize modules

appInit.markAppReady();

// ============================================
// PHASE 5: Expose minimal window.* for HTML
// ============================================
// Only what HTML onclick/onchange handlers need
window.addTask = (text) => taskCore.addTask(text);
window.switchCycle = (name) => cycleSwitcher.switch(name);
window.toggleTask = (id) => taskCore.toggle(id);
// ... minimal exposure
```

---

## Testing Benefits

### Current: Untestable
```javascript
// Can't test without full app environment
import { TaskCore } from './taskCore.js';
// TaskCore immediately tries to access window.AppState
// Test fails or requires complex mocking
```

### After: Easily Testable
```javascript
// taskCore.test.js
import { TaskCore } from './taskCore.js';

describe('TaskCore', () => {
    it('adds a task', () => {
        const mockAppState = {
            get: () => ({ data: { cycles: { main: { tasks: [] } } } }),
            update: jest.fn()
        };
        const mockNotify = jest.fn();

        const taskCore = new TaskCore({
            AppState: mockAppState,
            showNotification: mockNotify,
            sanitizeInput: x => x
        });

        taskCore.addTask('Test task');

        expect(mockAppState.update).toHaveBeenCalled();
        expect(mockNotify).toHaveBeenCalledWith('Task added');
    });
});
```

---

## Migration Strategy

### Option A: Big Bang (Not Recommended)
Refactor everything at once. High risk, hard to debug.

### Option B: Incremental (Recommended)

1. **Week 1: Tier 0** - Pure utilities
   - Remove window exports from 6 utility modules
   - Update imports in main script
   - Test app still works

2. **Week 2: Tier 1** - Core infrastructure
   - Refactor appState, notifications, globalUtils
   - Wire in main script
   - Keep backward-compat window.* temporarily

3. **Week 3-4: Tier 2** - Feature modules
   - Refactor taskCore, cycleManager, etc.
   - Remove fallback patterns
   - Wire dependencies explicitly

4. **Week 5: Tier 3** - UI modules
   - Refactor remaining modules
   - Clean up main script wiring

5. **Week 6: Cleanup**
   - Remove all backward-compat window.* from modules
   - Minimize window.* to only what HTML needs
   - Add tests for critical modules

### Option C: Parallel New Architecture
Create new modular versions alongside old ones. Swap when ready.

---

## Checklist Per Module

For each module refactor:

- [ ] Remove all `window.X = ...` exports
- [ ] Remove all `|| window.X` fallbacks
- [ ] Add required deps to constructor
- [ ] Throw on missing required deps
- [ ] Use `this.dep` instead of `window.dep`
- [ ] Export class/functions only
- [ ] Add to wiring in main script
- [ ] Verify app still works
- [ ] Add basic test

---

## What You'll Gain

| Before | After |
|--------|-------|
| Change one module, unknown ripple effects | Explicit deps = clear impact |
| Can't test without full app | Test any module in isolation |
| Debug by searching window.* | Debug by following injected deps |
| Can't reuse modules elsewhere | Portable, reusable modules |
| "Magic" initialization order | Explicit wiring order |
| 748 global references | <20 window.* for HTML only |

---

## Decision Points

Before starting, decide:

1. **How minimal should window.* be?**
   - Option: Only what HTML onclick handlers need (~10-15)
   - Option: Also expose for console debugging (~25-30)

2. **Error handling for missing deps?**
   - Option: Throw immediately (fail fast)
   - Option: Throw on first use (lazy validation)

3. **Optional vs required deps?**
   - Some deps genuinely optional (updateStatsPanel)
   - Some are required (AppState)
   - Document which is which

4. **How to handle circular needs?**
   - A needs B, B needs A at runtime
   - Solution: Inject interface/callback, not instance
   - Example: `onTaskComplete: () => statsPanel.update()`

---

## Next Steps

1. Review this plan
2. Decide on migration strategy (A, B, or C)
3. Start with Tier 0 (safest, builds confidence)
4. Create a tracking issue/checklist
5. Proceed module by module

---

*This is the path to true modularity. It's significant work, but each step makes the codebase more maintainable.*
