# miniCycle Coding Standards

Version: 1.1
Last Updated: 2025-12-30

## 1. Export Patterns

### Standard: Named Exports Only

**DO:**
```javascript
// Export class
export class MenuManager { ... }

// Export singleton instance
const menuManager = new MenuManager();
export { menuManager };

// Export function
export function setMenuManagerDependencies(deps) { ... }

// Export DI setup
export const setMenuManagerDependencies = (deps) => di.setDependencies(deps);
```

**DON'T:**
```javascript
// Avoid default exports - they create ambiguity
export default MenuManager;
export default menuManager;
```

### Singleton Pattern

For modules that should only have one instance:

```javascript
// 1. Define class
class ErrorHandler { ... }

// 2. Create singleton instance
const errorHandler = new ErrorHandler();

// 3. Export as named export
export { errorHandler };

// 4. Also export the DI setup function
export const setErrorHandlerDependencies = (deps) => di.setDependencies(deps);
```

---

## 2. Error Handling Policy

### Throw vs. Return

| Situation | Action |
|-----------|--------|
| Invalid input at API boundary | Throw with descriptive message |
| Missing required dependency | Throw (fail fast) |
| Optional feature unavailable | Log warning, return gracefully |
| User-facing operation fails | Show notification, don't throw |
| Internal recoverable error | Log, attempt recovery, continue |

### Pattern

```javascript
// At module boundaries - THROW
static validateTask(task) {
    if (typeof task !== 'object' || task === null) {
        throw new TypeError('Task must be an object');  // Throw - bad input
    }
    // ...
}

// User-facing operations - NOTIFY
async clearAllTasks() {
    if (!AppState?.isReady?.()) {
        this.deps.showNotification('App not ready', 'warning');
        return;  // Return gracefully
    }
    // ...
}

// Optional features - LOG + CONTINUE
init() {
    try {
        this.setupOptionalFeature();
    } catch (error) {
        console.warn('Optional feature unavailable:', error.message);
        // Continue without the feature
    }
}
```

---

## 3. Event Listener Pattern

### Standard: DI-Injected SafeAddEventListener

All 86 modules use DI-injected `safeAddEventListener` for event handling. This ensures null-safety, testability, and consistent behavior:

```javascript
// In module DI setup
const di = createDIModule('MyModule', {
    safeAddEventListener: optional(null),
    safeAddEventListenerById: optional(null)
});

// In module code - use DI with fallback
const safeAdd = this.deps.safeAddEventListener;
if (safeAdd) {
    safeAdd(element, 'click', handler);
} else {
    element.addEventListener('click', handler);
}
```

### Acceptable Patterns by Context

| Context | Pattern | Example |
|---------|---------|---------|
| Feature modules | DI-injected with fallback | `this.deps.safeAddEventListener(el, 'click', fn)` |
| Boot code | GlobalUtils as parameter | `GlobalUtils.safeAddEventListener(el, 'click', fn)` |
| System events | Direct addEventListener | `window.addEventListener('beforeunload', fn)` |

**System events** (visibilitychange, beforeunload, unhandledrejection) are acceptable as direct addEventListener since they're set up once during initialization and don't need duplicate-prevention.

### Idempotency Guard

All modules with event listeners MUST use idempotency guards:

```javascript
class MyManager {
    _eventListenersInitialized = false;

    setupEventListeners() {
        if (this._eventListenersInitialized) {
            console.log('Event listeners already initialized');
            return;
        }
        this._eventListenersInitialized = true;

        // Setup listeners...
    }
}
```

**DON'T:**
```javascript
// Direct addEventListener for UI elements without guard or fallback
element.addEventListener('click', handler);

// Direct import and use of GlobalUtils (use DI instead)
import { GlobalUtils } from '../utils/globalUtils.js';
GlobalUtils.safeAddEventListener(element, 'click', handler);
```

---

## 4. DI Pattern

### Standard Setup

Every module should follow this pattern:

```javascript
import { createDIModule, required, optional } from '../core/diBase.js';

// 1. Define dependencies
const di = createDIModule('ModuleName', {
    requiredDep: required(),
    optionalDep: optional(defaultValue)
});

// 2. Create late-binding proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// 3. Export DI setter
export const setModuleNameDependencies = (deps) => di.setDependencies(deps);

// 4. Module code uses _deps
class MyModule {
    doSomething() {
        _deps.requiredDep.method();
    }
}
```

---

## 5. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `menuManager.js` |
| Classes | PascalCase | `MenuManager` |
| Functions | camelCase | `setupMainMenu()` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Private members | _prefix | `_initialized` |
| DI setter | set[Module]Dependencies | `setMenuManagerDependencies` |

---

## 6. Code Style

- Use `const` by default, `let` only when reassignment needed
- Never use `var`
- Always use semicolons
- K&R brace style (opening brace on same line)
- 4-space indentation
- Console logs with emoji prefixes: `console.log('📦 Loading...')`

---

## 7. File Structure

```javascript
/**
 * Module description
 * @module modules/category/moduleName
 */

import { createDIModule, required, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('ModuleName', { ... });
const _deps = new Proxy({}, { ... });
export const setModuleNameDependencies = (deps) => di.setDependencies(deps);

// ============================================================================
// MAIN CLASS/FUNCTIONS
// ============================================================================

export class ModuleName { ... }

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

console.log('📦 ModuleName module loaded');
```
