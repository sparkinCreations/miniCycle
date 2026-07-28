# miniCycle Coding Standards

Version: 1.2
Last Updated: 2026-01-09

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

All modules use DI-injected `safeAddEventListener` for event handling. This ensures null-safety, testability, and consistent behavior:

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

---

## 8. CSS Standards

### Modular Architecture

All styles are organized in the `styles/` folder using native CSS imports (no build step):

```
styles/
├── main.css                 # Entry point - imports all modules
├── base/                    # Foundation styles
│   ├── variables.css        # CSS custom properties
│   ├── reset.css            # CSS reset
│   ├── background.css       # Background patterns & images
│   ├── typography.css       # Font styles
│   └── animations.css       # Keyframe animations
├── layout/                  # Page structure
├── components/              # UI component styles (18 files)
├── utilities/               # Dark mode, helpers, responsive
└── themes/                  # Theme system
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Component styles | kebab-case matching component | `task-list.css`, `stats-panel.css` |
| Base files | lowercase | `variables.css`, `reset.css` |
| Utility files | lowercase | `dark-mode.css`, `helpers.css` |

### CSS Variables

Use CSS custom properties for all theme-able values:

```css
/* In styles/base/variables.css */
:root {
    --theme-text-primary: inherit;
    --theme-bg-surface: rgba(255, 255, 255, 0.4);
    --theme-success: #4CAF50;
    --theme-error: #dc2626;
}

/* In component files - use with fallbacks */
.task {
    background: var(--theme-task-bg, white);
    color: var(--theme-task-text, #333);
}
```

### Dark Mode

Dark mode overrides live in `styles/utilities/dark-mode.css`:

```css
/* Use body.dark-mode selector for overrides */
body.dark-mode .component {
    background-color: #2a2a2a;
    color: #f0f0f0;
}
```

### Component CSS Structure

Each component file should follow this structure:

```css
/* ═══════════════════════════════════════════════════════════════════════════
   Component Name
   Brief description of what this component styles
   ═══════════════════════════════════════════════════════════════════════════ */

/* =============================================================================
   SECTION NAME
   ============================================================================= */

.component-class {
    /* Layout */
    display: flex;
    position: relative;

    /* Sizing */
    width: 100%;
    padding: 10px;

    /* Colors - use CSS variables */
    background: var(--theme-bg, white);
    color: var(--theme-text, #333);

    /* Effects */
    transition: background 0.2s ease;
}

/* =============================================================================
   MOBILE ADJUSTMENTS
   ============================================================================= */

@media (max-width: 768px) {
    .component-class {
        padding: 8px;
    }
}
```

### Best Practices

**DO:**
- Use CSS variables for colors, spacing, and timing values
- Group related properties (layout, sizing, colors, effects)
- Add section headers for organization
- Put media queries at the end of each file
- Use `var(--property, fallback)` for backwards compatibility

**DON'T:**
- Use `!important` unless absolutely necessary
- Hard-code colors that should be themeable
- Create overly specific selectors (avoid `.parent .child .grandchild`)
- Duplicate styles across components (extract to variables or utilities)

---

## 9. Label System

### Standard: Use `getLabel()` for User-Facing Strings

All user-facing strings (notifications, modal text, ARIA labels, button text) should use the centralized label system via `getLabel()`.

```javascript
import { getLabel } from '../labels/labelResolver.js';

// Simple string
showNotification(getLabel('notify.taskDeleted', { vars: { name: taskName } }), 'success');

// Pluralized noun
const taskWord = getLabel('noun.task', { count: tasks.length });

// With fallback
const label = getLabelOrFallback('custom.key', 'Default text');
```

### When to Use Labels

| Situation | Use `getLabel()`? | Example |
|-----------|-------------------|---------|
| Notification messages | Yes | `getLabel('notify.taskRenamed', { vars: { name } })` |
| Modal titles/messages | Yes | `getLabel('modal.resetTasks.title')` |
| ARIA labels | Yes | `getLabel('taskOption.edit')` |
| Button text | Yes | `getLabel('action.addTask')` |
| Console logs | No | `console.log('Debug info...')` |
| Error messages for developers | No | `throw new Error('Invalid input')` |

### Adding New Labels

1. Add the key to `modules/labels/defaultLabels.js` in the appropriate category
2. If lens-sensitive, add to `LENS_SENSITIVE_KEYS`
3. Use `{varName}` syntax for dynamic content
4. Import and use `getLabel()` in your module

### Emoji Convention

Keep emojis **separate** from label text. Emojis are prepended in the calling code, not stored in labels:

```javascript
// DO: Emoji separate from label
showNotification(`✅ ${getLabel('notify.taskDeleted', { vars: { name } })}`, 'success');

// DON'T: Emoji embedded in label
// defaultLabels: { notify: { taskDeleted: '✅ Task deleted' } }
```

This matches the existing `mode.autoEmoji` / `mode.auto` pattern.
