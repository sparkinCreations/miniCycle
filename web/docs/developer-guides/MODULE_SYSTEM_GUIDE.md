# Module System Guide

**Last Updated**: December 2025

---

## Current State: Honest Assessment

The codebase uses 5 module patterns:

- **4 legacy patterns** - Fall back to `window.*` globals (DI structure but not true decoupling)
- **1 new pattern** - **DI-Pure** (no `window.*` fallbacks, fully testable)

**Progress:** 2 modules are now DI-pure (taskDOM, taskCore). See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for tracking.

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

### 2. Simple Instance (Self-Contained)

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

// Exposed globally
const notifications = new MiniCycleNotifications();
window.showNotification = (msg, type, dur) => notifications.show(msg, type, dur);
```

**Status:** ⚠️ Self-contained but pollutes `window`

---

### 3. Resilient Constructor (Graceful Degradation)

**Accepts dependencies with fallbacks.** This is where the "DI theater" happens.

```javascript
// modules/ui/statsPanel.js
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

// In main script - dependencies ARE globals
const statsPanel = new StatsPanelManager({
    showNotification: window.showNotification,  // ← global
    loadData: window.loadMiniCycleData,         // ← global
});
```

**Status:** ❌ Looks like DI, but injects globals. Can't test without mocking `window`.

---

### 4. Strict Injection (Fail Fast)

**Requires dependencies, throws if missing.**

```javascript
// modules/cycle/cycleLoader.js
const Deps = {};

export function setCycleLoaderDependencies(overrides) {
    Object.assign(Deps, overrides);
}

function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`cycleLoader: missing dependency ${name}`);
    }
}

export function loadMiniCycle() {
    assertInjected('loadMiniCycleData', Deps.loadMiniCycleData);
    assertInjected('addTask', Deps.addTask);

    const data = Deps.loadMiniCycleData();
    // ...
}

// In main script - still injects globals
setCycleLoaderDependencies({
    loadMiniCycleData: window.loadMiniCycleData,  // ← global
    addTask: window.addTask,                       // ← global
});
```

**Status:** ❌ Enforces contract but still coupled to globals.

---

### 5. DI-Pure (NEW - Target Pattern) ✅

**NO `window.*` fallbacks. Dependencies are injected or use local fallbacks.**

```javascript
// modules/task/taskCore.js
export class TaskCore {
    constructor(dependencies = {}) {
        const mergedDeps = { ...moduleDeps, ...dependencies };

        // Version via DI, not window.APP_VERSION
        this.version = mergedDeps.AppMeta?.version;

        // NO window.* fallbacks - only injected deps or null
        this.deps = {
            AppState: mergedDeps.AppState || null,
            AppGlobalState: mergedDeps.AppGlobalState || null,
            safeJSONParse: mergedDeps.safeJSONParse || ((str, fb) => { try { return JSON.parse(str); } catch { return fb; } }),
            showNotification: mergedDeps.showNotification || this.fallbackNotification,
            // ... etc
        };
    }
}

// In main script - wiring hub (window.* OK here)
const taskCore = await initTaskCore({
    AppState: window.AppState,
    AppGlobalState: window.AppGlobalState,
    AppMeta: window.AppMeta,
    safeJSONParse: GlobalUtils.safeJSONParse,
    showNotification: deps.utils.showNotification,
});
```

**Status:** ✅ Fully testable in isolation. No window mocking needed.

**Key Difference:** Local fallbacks (like inline JSON.parse) instead of `|| window.*`.

**Current DI-Pure Modules:**
- `modules/task/taskDOM.js` - TaskDOMManager
- `modules/task/taskCore.js` - TaskCore

See [TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md) for usage patterns.

---

## The Problem (Legacy Patterns)

Every pattern eventually resolves to `window.*`:

```javascript
// What the code looks like:
constructor(dependencies = {}) {
    this.deps = {
        AppState: dependencies.AppState || window.AppState,
    };
}

// What gets passed in:
new Module({
    AppState: window.AppState,  // Just a pointer to the global
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

## Future: True Modularity

See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for the plan to transform these patterns:

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

## Existing Modules by Pattern

### DI-Pure ✅ (Target Pattern)
- `modules/task/taskDOM.js` - TaskDOMManager (Dec 2025)
- `modules/task/taskCore.js` - TaskCore (Dec 2025)

### Static Utilities
- `modules/utils/globalUtils.js` - DOM utilities
- `modules/task/taskValidation.js` - Task validation
- `modules/utils/dataValidator.js` - Data validation

### Simple Instance
- `modules/utils/notifications.js` - Notification system
- `modules/utils/deviceDetection.js` - Device detection

### Resilient Constructor (Legacy)
- `modules/ui/statsPanel.js` - Statistics panel
- `modules/ui/settingsManager.js` - Settings UI
- `modules/ui/modalManager.js` - Modal coordination
- Most UI modules

### Strict Injection (Legacy)
- `modules/cycle/cycleLoader.js` - Cycle loading
- `modules/recurring/recurringCore.js` - Recurring logic
- `modules/ui/undoRedoManager.js` - Undo/redo system

---

## Next Steps

- **[TASKDOM_DI_GUIDE.md](./TASKDOM_DI_GUIDE.md)** - How to use DI-pure modules
- **[DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md)** - See actual dependencies
- **[MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md)** - Plan for true decoupling
- **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** - How to work with current code
