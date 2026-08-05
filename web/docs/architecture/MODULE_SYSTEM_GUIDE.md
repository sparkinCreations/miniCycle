# Module System Guide

**Last Updated**: August 2026

---

## Current State

All production modules are **DI-Pure** (no `window.*` fallbacks). The legacy patterns below are retained as historical context and anti-pattern references.

See [PROJECT_STATS.md](../PROJECT_STATS.md) for current module counts and milestones.

---

## The 5 Module Patterns

### 1. Static Utilities (Pure Functions)

**No dependencies, no state.** These are genuinely decoupled.

```javascript
// modules/utils/globalUtils.js
export class GlobalUtils {
    static sanitizeInput(text) {
        if (typeof text !== 'string') return '';
        return text.trim().replace(/[<>]/g, '');
    }

    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
```

**Status:** ✅ Actually modular

---

### 2. Simple Instance (Self-Contained) - Legacy

**Creates its own DOM, minimal external dependencies.**

```javascript
// modules/utils/notifications.js
export class MiniCycleNotifications {
    constructor() {
        this.container = this.findOrCreateContainer();
    }

    show(message, type = 'info', duration = 3000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        if (duration) {
            setTimeout(() => this.remove(notification), duration);
        }
    }

    findOrCreateContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
}

// Legacy global exposure (pre-DI)
const notifications = new MiniCycleNotifications();
window.showNotification = (msg, type, dur) => notifications.show(msg, type, dur);
```

**Status:** ⚠️ Self-contained but pollutes `window`

---

### 3. Resilient Constructor (Graceful Degradation) - Legacy

**Accepts dependencies with fallbacks.** This is where the "DI theater" happens.

```javascript
// modules/features/statsPanel.js (as it looked pre-DI)
export class StatsPanelManager {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            loadData: dependencies.loadData || this.fallbackLoadData,
        };
    }

    fallbackNotification(msg) {
        console.log(`[Stats] ${msg}`);
    }

    fallbackLoadData() {
        return null;
    }
}

// Legacy wiring (globals)
const statsPanel = new StatsPanelManager({
    showNotification: window.showNotification,
    loadData: window.loadMiniCycleData,
});
```

**Status:** ❌ Looks like DI, but injects globals. Can't test without mocking `window`.

---

### 4. Strict Injection (Fail Fast) - Legacy

**Requires dependencies, throws if missing.**

```javascript
// modules/routine/routineLoader.js
const Deps = {};

export function setRoutineLoaderDependencies(overrides) {
    Object.assign(Deps, overrides);
}

function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`routineLoader: missing dependency ${name}`);
    }
}

export function loadMiniCycle() {
    assertInjected('loadMiniCycleData', Deps.loadMiniCycleData);
    assertInjected('addTask', Deps.addTask);

    const data = Deps.loadMiniCycleData();
    // ...
}

// Legacy wiring (globals)
setRoutineLoaderDependencies({
    loadMiniCycleData: window.loadMiniCycleData,
    addTask: window.addTask,
});
```

**Status:** ❌ Enforces contract but still coupled to globals.

---

### 5. DI-Pure (NEW - Target Pattern) ✅

**NO `window.*` fallbacks. Dependencies are injected or use local fallbacks.**

```javascript
// modules/task/taskCore.js
import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('TaskCore', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    // ... etc
});

export const setTaskCoreDependencies = di.setDependencies;

export class TaskCore {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        // (NEVER `{ ...deps }` spread — it evaluates lazy getters immediately)
        const resolvedDeps = di.resolve(dependencies);

        // Version via DI, not window.APP_VERSION
        this.version = resolvedDeps.AppMeta?.version;

        // NO window.* fallbacks - only injected deps or local fallbacks
        this.deps = {
            AppState: resolvedDeps.AppState || null,
            sanitizeInput: resolvedDeps.sanitizeInput || ((text) => text),
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            // ... etc
        };
    }
}

// Wiring happens declaratively: the module's manifest entry in
// moduleManifests.js declares requires/optionalDeps/lazyRequires,
// and moduleLoader injects them during featureBoot (Phase 2).
```

**Status:** ✅ Fully testable in isolation. No window mocking needed.

**Key Difference:** Local fallbacks (like inline JSON.parse) instead of `|| window.*`.

**✅ All Modules Are DI-Pure**

The DI overhaul is complete. All modules use the DI-Pure pattern with:
- `createDIModule()` from `diBase.js`
- `required()` and `optional()` markers
- Zero `|| window.*` fallbacks

See [DI_PATTERNS.md](../working-on-code/DI_PATTERNS.md) for current best practices.

---

## The Problem (Legacy Patterns)

Legacy patterns eventually resolved to `window.*`:

```javascript
// What the code looks like:
constructor(dependencies = {}) {
    this.deps = {
        AppState: dependencies.AppState || window.AppState,
    };
}

// What gets passed in:
new Module({
    AppState: window.AppState,  // Legacy global wiring
});
```

**Result:**
- Can't test modules in isolation
- Can't reuse modules in other projects
- Dependencies are invisible (not in import statements)
- Changing one global affects unknown modules

---

## Pattern Selection Guide

| Pattern | When to Use | Testable? |
|---------|-------------|-----------|
| Static Utilities | Pure functions, no state | ✅ Yes |
| Simple Instance | Self-contained UI components | ⚠️ Need to mock DOM |
| Resilient Constructor | Complex features needing graceful degradation | ❌ Must mock `window` |
| Strict Injection | Critical business logic | ❌ Must mock `window` |
| **DI-Pure** ✅ | **New code - target pattern** | **✅ Yes - mock deps only** |

---

## True Modularity (Completed)

See [MODULAR_OVERHAUL_PLAN.md](../archive/MODULAR_OVERHAUL_PLAN.md) for the (now-completed) plan that transformed these patterns:

**Current:**
```javascript
constructor(dependencies = {}) {
    this.notify = dependencies.showNotification || window.showNotification;
}
```

**Target:**
```javascript
constructor({ showNotification }) {
    if (!showNotification) throw new Error('showNotification required');
    this.notify = showNotification;
}
```

The difference: no fallback to globals. Dependencies are required and explicit.

---

## Modules by Pattern (Historical)

> All of these modules are DI-Pure today. This list records which pattern each
> used *before* the migration, as a reference for recognizing old code in
> archives, diffs, and blog posts.

### First DI-Pure Migrations
- `modules/task/taskDOM.js` - TaskDOMManager (Dec 2025)
- `modules/task/taskCore.js` - TaskCore (Dec 2025)

### Static Utilities
- `modules/utils/globalUtils.js` - DOM utilities
- `modules/task/taskValidation.js` - Task validation
- `modules/utils/dataValidator.js` - Data validation

### Simple Instance
- `modules/utils/notifications.js` - Notification system
- `modules/utils/deviceDetection.js` - Device detection

### Formerly Resilient Constructor
- `modules/features/statsPanel.js` - Statistics panel
- `modules/ui/settingsManager.js` - Settings UI
- `modules/ui/modalManager.js` - Modal coordination
- Most UI modules

### Formerly Strict Injection
- `modules/routine/routineLoader.js` - Routine loading
- `modules/recurring/recurringCore.js` - Recurring logic
- `modules/ui/undoRedoManager.js` - Undo/redo system

---

## Next Steps

- **[TASKDOM_DI_GUIDE.md](../reference/TASKDOM_DI_GUIDE.md)** - How to use DI-pure modules
- **[DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md)** - See actual dependencies
- **[MODULAR_OVERHAUL_PLAN.md](../archive/MODULAR_OVERHAUL_PLAN.md)** - Plan for true decoupling
- **[DEVELOPMENT_WORKFLOW.md](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - How to work with current code
