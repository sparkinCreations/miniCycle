# Namespace Architecture

> **Comprehensive documentation for miniCycle's namespace pollution fix**

**Version**: 1.374
**Status**: Phase 1 Complete ✅ | Phase 2 Steps 0-3 Complete ✅
**Tests**: 1011/1011 (100% pass)
**Last Updated**: November 23, 2025

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Namespace Lifecycle (Phase-Aware)](#namespace-lifecycle-phase-aware)
5. [API Reference](#api-reference)
6. [Migration Path](#migration-path)
7. [Testing Strategy](#testing-strategy)
8. [Phase 2 Roadmap (Main Script First)](#phase-2-roadmap-main-script-first)
9. [Phase 2 Contribution Rules](#phase-2-contribution-rules)
10. [Common Pitfalls (Lessons Learned)](#common-pitfalls-lessons-learned)
11. [Benefits](#benefits)
12. [Implementation Guide](#implementation-guide)
13. [Related Documentation](#related-documentation)

---

## Overview

The namespace architecture consolidates **163 global variables** into a single unified API at:

```javascript
window.miniCycle.*
```

This reduces global namespace pollution, improves discoverability, enables autocomplete, and provides a safe step-by-step migration path toward a single-global runtime.

### Key Metrics

| Metric | Before | Phase 1 | Phase 2 Step 3 | Phase 2 Complete (Target) |
|--------|--------|---------|----------------|---------------------------|
| Global Variables | 163 | 164 (+namespace) | ~143 (-20) | 1 (just miniCycle) |
| Modules Migrated | 0/40 | 0/40 | 4/40 (globalUtils, themeManager, notifications, modalManager) | 40/40 |
| API Entry Points | Scattered | Unified | Unified | Unified |
| Backward Compatibility | N/A | 100% ✅ | 100% ✅ | 100% ✅ until v2.0 |
| Test Coverage | 1011 tests | 1011 tests | 1011 tests ✅ | 1011+ tests |

### Implementation Phases

**Phase 1 (✅ COMPLETE - November 23, 2025):**
- ✅ Created unified `window.miniCycle.*` API wrapper (`modules/namespace.js`)
- ✅ Implemented backward compatibility layer with deprecation warnings
- ✅ Integrated into boot sequence (loads after globalUtils, before other modules)
- ✅ All 163 globals accessible via namespace
- ✅ Documentation complete

**Phase 2 Step 0 (✅ COMPLETE - November 23, 2025):**
- ✅ Migrated miniCycle-scripts.js to use namespace API (141/163 occurrences)
- ✅ Safe fallback patterns for boot timing (`window.miniCycle?.method || fallback`)
- ✅ Validator enhanced with allowlist/region markers
- ✅ App fully functional with namespace calls
- See: [NAMESPACE_STEP0_PROGRESS.md](./NAMESPACE_STEP0_PROGRESS.md)

**Phase 2 Step 1 (✅ COMPLETE - November 23, 2025):**
- ✅ Refactored globalUtils module (removed 44 `window.*` exports)
- ✅ Updated namespace to import GlobalUtils directly
- ✅ Installed 38 backward-compat shims for migrated functions
- ✅ Net reduction: ~15 globals eliminated
- ✅ All tests passing, app functional

**Phase 2 Step 2 (✅ COMPLETE - November 23, 2025):**
- ✅ Refactored themeManager module (removed 12 `window.*` exports)
- ✅ Updated namespace.js with direct themeManager imports
- ✅ Installed 12 backward-compat shims for theme functions
- ✅ All tests passing, app functional

**Phase 2 Step 3 (✅ COMPLETE - November 23, 2025):**
- ✅ Refactored notifications.js (removed 2 `window.*` exports)
- ✅ Refactored modalManager.js (removed 3 `window.*` exports)
- ✅ Updated namespace.js with direct imports for both modules
- ✅ Installed 5 backward-compat shims (2 for notifications, 3 for modals)
- ✅ Net reduction: ~20 globals eliminated total (Steps 1-3)
- ✅ All tests passing, app functional

**Phase 2 Steps 4-40 (📋 PLANNED):**
- Refactor remaining 36 modules to remove `window.*` exports
- Make namespace module the ONLY source of globals
- Keep all tests passing continuously

---

## Problem Statement

### Original Global Pollution

miniCycle originally assigned **163 unique names** to the global window object across 40+ modules:

```javascript
// Tasks (28 globals)
window.addTask = ...
window.editTask = ...
window.deleteTask = ...
window.validateAndSanitizeTaskInput = ...
window.renderTasks = ...
window.refreshTaskListUI = ...
// ... 22 more

// Cycles (19 globals)
window.createNewMiniCycle = ...
window.switchMiniCycle = ...
window.deleteMiniCycle = ...
window.resetCurrentMiniCycle = ...
window.renameMiniCycle = ...
// ... 14 more

// UI (19 globals)
window.showNotification = ...
window.showNotificationWithTip = ...
window.showConfirmModal = ...
window.showPromptModal = ...
window.closeAllModals = ...
window.showLoader = ...
window.hideLoader = ...
// ... 12 more

// Utils (26 globals)
window.sanitizeInput = ...
window.escapeHTML = ...
window.debounce = ...
window.throttle = ...
window.generateId = ...
window.safeLocalStorageGet = ...
// ... 20 more

// Features (6+ globals)
window.themeManager = ...
window.gamesManager = ...
window.StatsPanelManager = ...
window.MiniCycleReminders = ...
window.MiniCycleDueDates = ...
// ...

// State (5 globals)
window.AppState = ...
window.loadMiniCycleData = ...
window.saveTaskToSchema25 = ...
// ...
```

### Issues Caused by Global Pollution

1. **Name Collision Risk**
   - Any third-party script or extension could overwrite core globals
   - Example: A browser extension using `window.addTask` would break miniCycle

2. **Poor Discoverability**
   - Developers can't easily find what public API exists
   - No clear distinction between public API and internal functions

3. **No Autocomplete / Developer Experience**
   - IDE can't suggest available functions
   - Globals are flat and inconsistent (some camelCase, some not)

4. **Maintenance Burden**
   - Hard to audit what's public vs internal
   - Difficult to track dependencies between functions

5. **Testing Complexity**
   - Mocking 163 globals repeatedly increases test fragility
   - Hard to isolate module behavior

---

## Solution Architecture

### Unified Namespace API (Phase 1)

All functionality is now accessible through a single, organized hierarchy:

```javascript
window.miniCycle = {
  // Core version
  version: '1.374',

  // State management
  state: {
    get: () => AppState?.get?.() || null,
    update: async (updateFn, immediate) => { ... },
    isReady: () => AppState?.isReady?.(),
    getActiveCycle: () => AppState?.getActiveCycle?.(),
    getTasks: () => AppState?.getTasks?.()
  },

  // Task operations
  tasks: {
    add: (...args) => window.addTask(...args),
    edit: (item) => window.editTask(item),
    delete: (item) => window.deleteTask(item),
    validate: (input) => window.validateAndSanitizeTaskInput(input),
    render: (tasks) => window.renderTasks(tasks),
    refresh: () => window.refreshTaskListUI(),
    toggle: (checkbox) => window.toggleTaskCompletion(checkbox),
    priority: {
      toggle: (item) => window.toggleHighPriority(item),
      set: (item, priority) => window.setTaskPriority(item, priority)
    },
    recurring: {
      set: (item) => window.setTaskRecurring(item),
      update: () => window.updateRecurringButtonVisibility()
    }
  },

  // Cycle operations
  cycles: {
    create: () => window.createNewMiniCycle(),
    switch: (id) => window.switchMiniCycle(id),
    delete: (id) => window.deleteMiniCycle(id),
    reset: () => window.resetCurrentMiniCycle(),
    rename: () => window.renameMiniCycle(),
    list: () => window.listMiniCycles(),
    import: (data) => window.importMiniCycle(data),
    export: (id) => window.exportMiniCycle(id)
  },

  // UI utilities
  ui: {
    notifications: {
      show: (msg, type, duration, showTip) =>
        window.showNotification(msg, type, duration, showTip),
      showWithTip: (msg, tipText, type, duration) =>
        window.showNotificationWithTip(msg, tipText, type, duration)
    },
    modals: {
      confirm: (opts) => window.showConfirmModal(opts),
      prompt: (opts) => window.showPromptModal(opts),
      closeAll: () => window.closeAllModals()
    },
    loader: {
      show: (msg) => window.showLoader(msg),
      hide: () => window.hideLoader(),
      with: async (msg, asyncFn) => window.withLoader(msg, asyncFn)
    },
    progress: {
      update: () => window.updateProgressBar(),
      show: () => window.showProgressBar(),
      hide: () => window.hideProgressBar()
    },
    menu: {
      toggle: () => window.toggleMainMenu(),
      hide: () => window.hideMainMenu(),
      show: () => window.showMainMenu()
    }
  },

  // Utilities
  utils: {
    dom: {
      addListener: (el, event, handler, opts) =>
        window.addManagedListener(el, event, handler, opts),
      removeListener: (el, event) =>
        window.removeManagedListener(el, event),
      getById: (id) => document.getElementById(id),
      queryAll: (sel) => document.querySelectorAll(sel),
      addClass: (el, cls) => el?.classList?.add(cls),
      removeClass: (el, cls) => el?.classList?.remove(cls),
      toggleClass: (el, cls) => el?.classList?.toggle(cls)
    },

    storage: {
      get: (key, defaultValue) => window.safeLocalStorageGet(key, defaultValue),
      set: (key, value) => window.safeLocalStorageSet(key, value),
      remove: (key) => window.safeLocalStorageRemove(key),
      clear: () => localStorage.clear()
    },

    json: {
      parse: (str, fallback) => window.safeJSONParse(str, fallback),
      stringify: (obj, fallback) => window.safeJSONStringify(obj, fallback)
    },

    sanitize: (input) => window.sanitizeInput(input),
    escape: (html) => window.escapeHTML(html),
    generateId: () => window.generateId(),
    generateHashId: (str) => window.generateHashId(str),
    debounce: (fn, delay) => window.debounce(fn, delay),
    throttle: (fn, limit) => window.throttle(fn, limit)
  },

  // Feature managers (Phase 1 mirrors globals)
  features: {
    themes: window.themeManager,
    games: window.gamesManager,
    stats: window.StatsPanelManager,
    reminders: window.MiniCycleReminders,
    dueDates: window.MiniCycleDueDates,
    recurring: window._recurringModules
  },

  // Undo/Redo
  history: {
    undo: () => window.performStateBasedUndo(),
    redo: () => window.performStateBasedRedo(),
    canUndo: () => window.activeUndoStack?.length > 0,
    canRedo: () => window.activeRedoStack?.length > 0,
    capture: () => window.captureStateSnapshot()
  }
};
```

**Phase 2 goal**: Namespace methods should stop delegating to globals and instead call real module instances. The namespace becomes the true public API.

---

### Architecture Flow

This diagram shows how function calls flow through the system at different stages of migration.

#### Phase 1 / Step 0 (Wrapper Stage) - Current

```
miniCycle-scripts.js
   ↓ calls
window.miniCycle.*   (wrapper)
   ↓ delegates to
legacy window.* globals
   ↓ call
modules (export to window)
```

**Example call chain:**
```javascript
// Main script
window.miniCycle.tasks.add(text)
  ↓
// Namespace wrapper (namespace.js)
tasks: { add: (...args) => window.addTask(...args) }
  ↓
// Legacy global (set by taskCore module)
window.addTask = function(text) { /* ... */ }
  ↓
// Module internals
taskCore.addTask(text)
```

#### Phase 2 (Final Target) - After Module Refactor

```
miniCycle-scripts.js
   ↓ calls
window.miniCycle.*   (true public API)
   ↓ delegates to
module instances (no window exports)
   ↓ execute
internal module logic + AppState
```

**Example call chain:**
```javascript
// Main script
window.miniCycle.tasks.add(text)
  ↓
// Namespace (true API, namespace.js)
tasks: { add: (...args) => taskCore.addTask(...args) }
  ↓
// Module instance (returned from init, no window export)
taskCore.addTask(text)
  ↓
// AppState integration
AppState.update(state => { /* ... */ })
```

**Key Difference:**
- **Phase 1**: Namespace → globals → modules (double indirection)
- **Phase 2**: Namespace → modules directly (single indirection, clean)

---

## Backward Compatibility Layer

### Deprecation Warnings

Deprecated globals are wrapped with a warning-once shim:

```javascript
function wrapDeprecated(oldName, newPath) {
  const original = window[oldName];
  if (typeof original === 'function') {
    window[oldName] = function (...args) {
      if (!window.miniCycle._deprecationWarnings.has(oldName)) {
        console.warn(
          `⚠️ DEPRECATED: window.${oldName}() is deprecated. ` +
          `Use window.miniCycle.${newPath} instead. ` +
          `Backward compatibility will be removed in v2.0.`
        );
        window.miniCycle._deprecationWarnings.add(oldName);
      }
      return original.apply(this, args);
    };
  }
}

// Wrap top 20 most-used globals
wrapDeprecated('showNotification', 'ui.notifications.show()');
wrapDeprecated('addTask', 'tasks.add()');
wrapDeprecated('switchMiniCycle', 'cycles.switch()');
wrapDeprecated('editTask', 'tasks.edit()');
wrapDeprecated('deleteTask', 'tasks.delete()');
wrapDeprecated('showConfirmModal', 'ui.modals.confirm()');
wrapDeprecated('showPromptModal', 'ui.modals.prompt()');
wrapDeprecated('createNewMiniCycle', 'cycles.create()');
wrapDeprecated('resetCurrentMiniCycle', 'cycles.reset()');
wrapDeprecated('deleteMiniCycle', 'cycles.delete()');
wrapDeprecated('sanitizeInput', 'utils.sanitize()');
wrapDeprecated('escapeHTML', 'utils.escape()');
wrapDeprecated('showLoader', 'ui.loader.show()');
wrapDeprecated('hideLoader', 'ui.loader.hide()');
wrapDeprecated('updateProgressBar', 'ui.progress.update()');
wrapDeprecated('toggleTaskCompletion', 'tasks.toggle()');
wrapDeprecated('renderTasks', 'tasks.render()');
wrapDeprecated('refreshTaskListUI', 'tasks.refresh()');
wrapDeprecated('performStateBasedUndo', 'history.undo()');
wrapDeprecated('performStateBasedRedo', 'history.redo()');
```

### Warning Tracking

```javascript
// Internal tracking to show warnings only once
window.miniCycle._deprecationWarnings = new Set();

// Debug: See all deprecation warnings
window.miniCycle.getDeprecationWarnings = () => {
  return Array.from(window.miniCycle._deprecationWarnings);
};
```

---

## Namespace Lifecycle (Phase-Aware)

This section explains **when** the namespace is created and **how** it evolves during migration.

### Phase 1 — Wrapper + Backward Compat ✅

1. **`namespace.js` initializes `window.miniCycle`** early during AppInit Phase 1
2. **Public namespace methods point to existing globals** (mirror delegation)
   ```javascript
   tasks: {
     add: (...args) => window.addTask(...args),  // Delegates to global
     edit: (item) => window.editTask(item),       // Delegates to global
   }
   ```
3. **Deprecation wrappers installed on legacy globals**
   - First call to `window.addTask()` triggers console warning
   - Subsequent calls are silent (tracked in `_deprecationWarnings` Set)
4. **Result**: Both APIs work; namespace is discoverable; no breaking changes

**Key Point**: At this stage, `window.miniCycle.*` and `window.*` globals **both exist and work**. The namespace is a convenience wrapper, not the source of truth.

### Phase 2 Step 0 — Main Script Migration 🚧

1. **`miniCycle-scripts.js` global calls converted to namespace calls**
   - Before: `addTask(taskText)` (direct global call)
   - After: `window.miniCycle.tasks.add(taskText)` (namespace call)
2. **Legacy globals remain in place** (modules still export to `window.*`)
3. **Main script no longer depends on legacy globals directly**
4. **Result**: Globals become removable without breaking the boot flow

**Key Point**: Step 0 is **prerequisite** for module refactoring. Main script must use namespace FIRST, then modules can safely remove global exports.

### Phase 2 Steps 1-6 — Module Internal Refactor

1. **Modules stop assigning to `window.*`**
   ```javascript
   // Before (Phase 1)
   export async function init(deps) {
     window.addTask = (text) => { /* ... */ };
     window.editTask = (item) => { /* ... */ };
   }

   // After (Phase 2)
   export async function init(deps) {
     // No window assignments
     return {
       addTask: (text) => { /* ... */ },
       editTask: (item) => { /* ... */ }
     };
   }
   ```
2. **Modules export internal instances** (TaskCore, CycleCore, etc.)
3. **`namespace.js` updated to delegate to module instances**
   ```javascript
   // Phase 1 (wrapper)
   tasks: {
     add: (...args) => window.addTask(...args),  // Delegates to global
   }

   // Phase 2 (true delegation)
   tasks: {
     add: (...args) => taskCore.addTask(...args),  // Delegates to module instance
   }
   ```
4. **Result**: One public API surface; no duplicate ES module instances

**Key Point**: Namespace transitions from "wrapper around globals" to "true public API delegating to module internals."

### v2.0 — Backward Compat Removal

1. **Deprecation wrappers deleted** (no more `wrapDeprecated()`)
2. **Legacy globals removed** (no more `window.addTask`, `window.editTask`, etc.)
3. **`window.miniCycle` is the only global**
4. **Result**: Clean global namespace; single entry point; no legacy burden

---

### Why This Timeline Matters

**Problem it solves**: Prevents the duplicate module instance issue you encountered with `taskOptionsCustomizer`.

- ❌ **Wrong order**: Refactor modules BEFORE migrating main script
  - Modules remove `window.*` exports
  - Main script still calls `window.addTask()` → **ReferenceError: addTask is not defined**
  - Or worse: Static imports create duplicate ES module instances

- ✅ **Correct order**: Migrate main script FIRST (Step 0), THEN refactor modules
  - Main script uses `window.miniCycle.tasks.add()` (which delegates to global)
  - Modules can safely remove `window.*` exports
  - Namespace updated to delegate to module instances
  - No breakage, no duplicate instances

**Future contributors**: This lifecycle prevents you from breaking boot by refactoring in the wrong order.

---

## API Reference

### State Management

```javascript
// Get current state
const state = window.miniCycle.state.get();

// Update state
await window.miniCycle.state.update(state => {
  state.data.cycles[cycleId].tasks.push(newTask);
}, true);

// Check if AppState is ready
if (window.miniCycle.state.isReady()) {
  console.log('AppState ready!');
}

// Get active cycle
const cycle = window.miniCycle.state.getActiveCycle();

// Get tasks for current cycle
const tasks = window.miniCycle.state.getTasks();
```

### Tasks

```javascript
// Add new task
window.miniCycle.tasks.add('Buy groceries');

// Edit task
window.miniCycle.tasks.edit({ id: 'task-123', text: 'Updated text' });

// Delete task
window.miniCycle.tasks.delete({ id: 'task-123' });

// Validate user input
const isValid = window.miniCycle.tasks.validate(userInput);

// Render tasks
window.miniCycle.tasks.render(tasks);

// Refresh task list UI
window.miniCycle.tasks.refresh();

// Toggle task completion
window.miniCycle.tasks.toggle(checkboxElement);

// Toggle high priority
window.miniCycle.tasks.priority.toggle(taskElement);

// Set recurring
window.miniCycle.tasks.recurring.set(taskElement);
```

### Cycles

```javascript
// Create new cycle
window.miniCycle.cycles.create();

// Switch to cycle
window.miniCycle.cycles.switch('cycle_123');

// Delete cycle
window.miniCycle.cycles.delete('cycle_123');

// Reset current cycle
window.miniCycle.cycles.reset();

// Rename cycle
window.miniCycle.cycles.rename();

// List all cycles
const cycles = window.miniCycle.cycles.list();

// Import cycle from data
window.miniCycle.cycles.import(cycleData);

// Export cycle
const data = window.miniCycle.cycles.export('cycle_123');
```

### UI - Notifications

```javascript
// Show notification
window.miniCycle.ui.notifications.show('Success!', 'success', 3000);

// Show notification with educational tip
window.miniCycle.ui.notifications.showWithTip(
  'Task completed!',
  'You can use recurring tasks for repeating items',
  'success',
  5000
);
```

### UI - Modals

```javascript
// Confirm dialog
const confirmed = await window.miniCycle.ui.modals.confirm({
  title: 'Delete Task?',
  message: 'Are you sure you want to delete this task?',
  confirmText: 'Delete',
  cancelText: 'Cancel'
});

// Prompt dialog
const text = await window.miniCycle.ui.modals.prompt({
  title: 'Enter Task Name',
  placeholder: 'Task name...',
  confirmText: 'Create',
  cancelText: 'Cancel'
});

// Close all modals
window.miniCycle.ui.modals.closeAll();
```

### UI - Loader

```javascript
// Show loader
window.miniCycle.ui.loader.show('Loading...');

// Hide loader
window.miniCycle.ui.loader.hide();

// Loader with async operation
await window.miniCycle.ui.loader.with('Saving...', async () => {
  await saveData();
});
```

### UI - Progress & Menu

```javascript
// Update progress bar
window.miniCycle.ui.progress.update();

// Toggle main menu
window.miniCycle.ui.menu.toggle();

// Hide menu
window.miniCycle.ui.menu.hide();
```

### Utilities

```javascript
// DOM utilities
const el = window.miniCycle.utils.dom.getById('task-list');
window.miniCycle.utils.dom.addListener(el, 'click', handler);
window.miniCycle.utils.dom.addClass(el, 'active');

// Storage utilities
window.miniCycle.utils.storage.set('key', 'value');
const value = window.miniCycle.utils.storage.get('key', 'default');
window.miniCycle.utils.storage.remove('key');

// JSON utilities
const obj = window.miniCycle.utils.json.parse(jsonString, {});
const str = window.miniCycle.utils.json.stringify(obj, '{}');

// Sanitization
const safe = window.miniCycle.utils.sanitize(userInput);
const escaped = window.miniCycle.utils.escape('<script>alert("xss")</script>');

// ID generation
const id = window.miniCycle.utils.generateId();
const hash = window.miniCycle.utils.generateHashId('my-string');

// Function utilities
const debouncedFn = window.miniCycle.utils.debounce(() => {...}, 300);
const throttledFn = window.miniCycle.utils.throttle(() => {...}, 1000);
```

### History (Undo/Redo)

```javascript
// Undo last action
window.miniCycle.history.undo();

// Redo last undone action
window.miniCycle.history.redo();

// Check if can undo/redo
if (window.miniCycle.history.canUndo()) {
  console.log('Undo available');
}

// Manually capture snapshot
window.miniCycle.history.capture();
```

---

## Migration Path

### Current State (Phase 1)

```javascript
// Old way (still works, shows deprecation warning)
window.addTask('Buy groceries');
window.showNotification('Success!', 'success');

// New way (recommended)
window.miniCycle.tasks.add('Buy groceries');
window.miniCycle.ui.notifications.show('Success!', 'success');
```

### Future State (v2.0)

```javascript
// Old way removed
window.addTask('Buy groceries'); // TypeError: window.addTask is not a function

// New way only
window.miniCycle.tasks.add('Buy groceries');
```

### Migration Timeline

| Version | Status | Deprecated API | New API | Action Required |
|---------|--------|----------------|---------|-----------------|
| 1.373 | Phase 1 Complete | ✅ Works (warns) | ✅ Works | None |
| 1.374–1.399 | Phase 2 | ✅ Works (warns) | ✅ Works | Migrate main script + modules |
| 2.0 | Back-compat removed | ❌ Removed | ✅ Works | Namespace required |

---

## Testing Strategy

### Coverage

**128 new tests** validate:
- Namespace API shape and structure
- Namespace method behavior
- Backward compatibility still works
- No regressions to AppInit / cycles / tasks
- Deprecation warnings fire correctly

### Test Suite

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| namespace.tests.js | 75 | Structure + behavior + deprecations |
| cycleManager.tests.js | 24 | DI workflows + storage |
| appInit.tests.js | 29 | Phase-gating + hooks |
| **New Tests** | **128** | **100% pass** |
| **Total** | **1198** | **100% pass** |

### Running Tests

```bash
# Run all tests
npm test

# Expected output:
# ✅ 1198/1198 tests passing (100%)
# ⏱️ Completed in 21.40ms
```

### CI Integration

Tests run automatically on every commit via GitHub Actions:
- Node.js 18.x and 20.x
- Playwright browser tests
- All platforms (Mac, iPad, iPhone)

---

## Phase 2 Roadmap (Main Script First)

### Objectives

1. Reduce globals to a single public API
2. Keep 100% test pass rate continuously
3. Avoid duplicate ES module instances in a versioned boot setup
4. Improve developer experience with autocomplete

---

### ✅ Step 0 (Phase 2 Prerequisite): Migrate Main Script to Namespace Calls

**Current issue:**
`miniCycle-scripts.js` still calls globals directly:

```javascript
applyTheme(...)
addTask(...)
showNotification(...)
switchMiniCycle(...)
```

**Phase 2 prerequisite:**
Convert those calls to namespace usage first, while globals still exist.

**Example conversions:**

```javascript
// Tasks
- addTask(text)
+ window.miniCycle.tasks.add(text)

- editTask(item)
+ window.miniCycle.tasks.edit(item)

- deleteTask(item)
+ window.miniCycle.tasks.delete(item)

// UI
- showNotification(msg, 'success')
+ window.miniCycle.ui.notifications.show(msg, 'success')

- showConfirmModal(opts)
+ window.miniCycle.ui.modals.confirm(opts)

- showLoader('Loading...')
+ window.miniCycle.ui.loader.show('Loading...')

// Cycles
- switchMiniCycle(id)
+ window.miniCycle.cycles.switch(id)

- createNewMiniCycle()
+ window.miniCycle.cycles.create()

// Features
- applyTheme(theme)
+ window.miniCycle.features.themes.applyTheme(theme)
```

**After Step 0:**
- Main script no longer requires globals
- Unlocks safe removal of `window.*` exports in modules
- All tests still pass (backward compat layer handles everything)

**Progress tracking:** See [NAMESPACE_STEP0_PROGRESS.md](./NAMESPACE_STEP0_PROGRESS.md)

---

### ✅ Step 1: Migrate Low-Risk Modules (Pure Utils) - COMPLETE

**Status**: ✅ **COMPLETE** (November 23, 2025)

Refactored globalUtils module to stop writing globals.
Namespace now imports and delegates directly to the module.

**Completed:**
- ✅ `globalUtils.js` - 26 utilities migrated
- ✅ Removed 44 lines of `window.*` exports
- ✅ Updated namespace.js with direct imports
- ✅ Installed 38 backward-compat shims
- ✅ All tests passing (1011/1011)

**Implementation:**

```javascript
// Before (globalUtils.js):
window.sanitizeInput = GlobalUtils.sanitizeInput;
window.escapeHtml = GlobalUtils.escapeHtml;
window.debounce = GlobalUtils.debounce;
// ... 41 more window.* assignments

// After (globalUtils.js):
export default GlobalUtils;
export { DEFAULT_TASK_OPTION_BUTTONS };
// NO window.* pollution

// namespace.js imports and exposes:
import GlobalUtils, { DEFAULT_TASK_OPTION_BUTTONS } from './utils/globalUtils.js';

window.miniCycle.utils.sanitize = (...args) => GlobalUtils.sanitizeInput(...args);
window.miniCycle.utils.escape = (...args) => GlobalUtils.escapeHtml(...args);
window.miniCycle.utils.debounce = (...args) => GlobalUtils.debounce(...args);
// Direct delegation, no window.* middleman
```

**Backward Compatibility:**

Namespace automatically creates shims for all migrated functions:

```javascript
// Old code still works:
window.sanitizeInput(text) // → calls GlobalUtils.sanitizeInput()
window.debounce(fn, 300)   // → calls GlobalUtils.debounce()

// With deprecation warnings:
⚠️ DEPRECATED: window.sanitizeInput() is deprecated.
   Use window.miniCycle.utils.sanitize() instead.
   Backward compatibility will be removed in v2.0.
```

**Results:**
- Net reduction: ~15 globals eliminated
- Call chain: 2 hops → 1 hop (removed window.* middleman)
- Zero breaking changes
- Deprecation warnings guide future migration

---

### ✅ Step 2: Migrate Feature Modules (ThemeManager) - COMPLETE

**Status**: ✅ **COMPLETE** (November 23, 2025)

Refactored themeManager module to stop writing globals.
Namespace now imports and delegates directly to the module.

**Completed:**
- ✅ `themeManager.js` - 11 theme functions + 1 class migrated
- ✅ Removed 12 `window.*` exports
- ✅ Updated namespace.js with direct imports
- ✅ Installed 12 backward-compat shims
- ✅ All tests passing (1011/1011)

**Implementation:**

```javascript
// Before (themeManager.js):
window.applyTheme = applyTheme;
window.updateThemeColor = updateThemeColor;
window.ThemeManager = ThemeManager;
// ... 9 more window.* assignments

// After (themeManager.js):
export default ThemeManager;
export {
    themeManager,
    applyTheme,
    updateThemeColor,
    // ... clean ES6 exports only
};
// NO window.* pollution

// namespace.js imports and exposes:
import ThemeManager, { applyTheme, updateThemeColor, ... } from './features/themeManager.js';

window.miniCycle.features.themes.apply = (...args) => applyTheme(...args);
window.miniCycle.features.themes.updateColor = (...args) => updateThemeColor(...args);
// Direct delegation, no window.* middleman
```

**Backward Compatibility:**

```javascript
// Old code still works:
window.applyTheme('dark-ocean')        // → calls applyTheme()
window.updateThemeColor('#3498db')     // → calls updateThemeColor()

// With deprecation warnings:
⚠️ DEPRECATED: window.applyTheme() is deprecated.
   Use window.miniCycle.features.themes.apply() instead.
   Backward compatibility will be removed in v2.0.
```

---

### ✅ Step 3: Migrate UI Helpers (Notifications + Modals) - COMPLETE

**Status**: ✅ **COMPLETE** (November 23, 2025)

Refactored notifications and modalManager modules to stop writing globals.

**Completed:**
- ✅ `notifications.js` - 2 class exports migrated
- ✅ `modalManager.js` - 2 classes + 1 wrapper function migrated
- ✅ Removed 5 `window.*` exports total
- ✅ Updated namespace.js with direct imports
- ✅ Installed 5 backward-compat shims
- ✅ All tests passing (1011/1011)

**Implementation:**

```javascript
// Before (notifications.js):
window.MiniCycleNotifications = MiniCycleNotifications;
window.EducationalTipManager = EducationalTipManager;

// After (notifications.js):
export { MiniCycleNotifications, EducationalTipManager };
// NO window.* pollution

// Before (modalManager.js):
window.ModalManager = ModalManager;
window.modalManager = modalManager;
window.closeAllModals = () => modalManager?.closeAllModals();

// After (modalManager.js):
export default ModalManager;
export { modalManager };
// NO window.* pollution

// namespace.js creates shims:
const notificationsShims = [
    { old: 'MiniCycleNotifications', newFunc: MiniCycleNotifications, new: 'ui.notifications (class)' },
    { old: 'EducationalTipManager', newFunc: EducationalTipManager, new: 'ui.notifications.tips (class)' }
];

const modalManagerShims = [
    { old: 'ModalManager', newFunc: ModalManager, new: 'ui.modals (class)' },
    { old: 'modalManager', newFunc: modalManager, new: 'ui.modals (instance)' },
    { old: 'closeAllModals', newFunc: () => modalManager?.closeAllModals(), new: 'ui.modals.closeAll()' }
];
```

**Results:**
- Net reduction: ~20 globals eliminated (Steps 1-3 combined)
- 4 modules fully migrated
- Zero breaking changes
- Deprecation warnings guide future migration

---

### Step 4: Migrate Remaining UI Helpers

**Target modules:**
- Onboarding manager
- Games manager
- Console capture
- Other stateless UI helpers

**Example:**

```javascript
// Before (onboardingManager.js):
window.OnboardingManager = OnboardingManager;

// After (onboardingManager.js):
export default OnboardingManager;

// namespace.js:
import OnboardingManager from './ui/onboardingManager.js';
window.miniCycle.ui.notifications.show = showNotification;
```

---

### Step 3: Migrate Core Task/Cycle Logic

Tasks + cycles should export real module instances, then namespace delegates to them.

**Before (global exports):**

```javascript
window.addTask = function (text) { ... }
window.renderTasks = function (tasks) { ... }
```

**After (instance + namespace exposure):**

```javascript
// taskCore.js
export function initTaskCore(deps) {
  return new TaskCore(deps);
}

// namespace.js
const taskCore = initTaskCore({
  AppState: window.AppState,
  showNotification: showNotification
});

window.miniCycle.tasks.add = (text) => taskCore.add(text);
window.miniCycle.tasks.render = (tasks) => taskCore.render(tasks);
```

---

### Step 4: Migrate Feature Managers Last

Feature managers coordinate multiple systems - refactor after core is stable.

**Target managers:**
- ThemeManager
- Recurring
- Reminders
- Stats
- Games
- DueDates

**These are already class-based**, so migration is straightforward:

```javascript
// namespace.js
import { ThemeManager } from './features/themeManager.js';

const themeManager = new ThemeManager(deps);
window.miniCycle.features.themes = themeManager;
```

---

### Step 5: Namespace Becomes the Only Global Surface

At this stage:
- Modules no longer assign to `window.*`
- Main script only uses namespace
- `namespace.js` is the ONLY file that touches window
- Clean, single entry point

---

### Step 6: Remove Backward Compatibility (v2.0)

Delete deprecation wrappers + old globals.

**Final global state:**

```javascript
window.miniCycle
```

…only.

---

### Refactoring Order (Updated)

| Priority | Category | Count | Complexity | Notes |
|----------|----------|-------|------------|-------|
| 0 | Main script migration | 1 | Medium | **Unlocks everything** |
| 1 | Utils (pure) | 26 | Low | Easiest wins |
| 2 | UI helpers | 19 | Low | Stateless |
| 3 | Tasks core | 28 | Medium | Stable with tests |
| 4 | Cycles core | 19 | Medium | Stable with tests |
| 5 | Feature managers | 6+ | High | Refactor last |
| 6 | State layer | 5 | Critical | Only after others |

---

### Success Criteria

- ✅ All tests passing continuously
- ✅ Main script fully namespace-based
- ✅ No duplicate module instances (versioning safe)
- ✅ Only one global: `window.miniCycle`
- ✅ No UX or performance regressions
- ✅ Autocomplete working in IDE
- ✅ Documentation updated

---

## Phase 2 Contribution Rules

**Critical: Follow these rules during Phase 2 migration to prevent regressions.**

When Phase 2 is in progress, all contributors (including future you) must follow these guidelines to avoid breaking the boot system, creating duplicate module instances, or mixing API patterns.

### ✅ Allowed

**1. Use `window.miniCycle.*` in main script and new code**
```javascript
// ✅ GOOD: Use namespace API
window.miniCycle.tasks.add(text);
window.miniCycle.ui.notifications.show(msg, 'success');
window.miniCycle.cycles.switch(id);
```

**2. Access boot-versioned singletons via DI or namespace**
```javascript
// ✅ GOOD: Use dependency injection
export async function init(deps) {
  const { AppState, notificationCore } = deps;
  // Use injected dependencies
}

// ✅ GOOD: Or use namespace after boot
window.miniCycle.state.get();
```

**3. Remove globals only after Step 0 proves no main usage**
```javascript
// ✅ GOOD: Step 0 complete → safe to remove global exports
// Before (module exports to window)
export async function init(deps) {
  window.addTask = (text) => { /* ... */ };
}

// After (Step 0 complete → main script uses namespace)
export async function init(deps) {
  return {
    addTask: (text) => { /* ... */ }  // No window export
  };
}
```

**4. Add tests for any namespace surface changes**
```javascript
// ✅ GOOD: Test namespace API
test('miniCycle.tasks.add() creates task', () => {
  window.miniCycle.tasks.add('Test task');
  assert(window.miniCycle.state.getTasks().length === 1);
});
```

### ❌ Not Allowed

**1. Do NOT statically import modules loaded by `withV()` in boot**

```javascript
// ❌ BAD: Creates duplicate ES module instances
import { TaskCore } from './modules/core/taskCore.js';

// Why: AppInit already loads taskCore.js with withV() versioning
// Static import creates a SECOND instance of the module
// Result: Two TaskCore singletons exist, state diverges

// ✅ GOOD: Access via namespace or DI instead
const taskCore = window.miniCycle.tasks;  // Uses boot-loaded instance
```

**Problem this prevents:** The exact duplicate module instance issue you encountered with `taskOptionsCustomizer` where two separate ES module instances existed in memory.

**2. Do NOT add new `window.*` exports inside modules**

```javascript
// ❌ BAD: Adding new global exports
export async function init(deps) {
  window.newFunction = () => { /* ... */ };  // DON'T DO THIS
}

// ✅ GOOD: Return from init, expose via namespace
export async function init(deps) {
  return {
    newFunction: () => { /* ... */ }  // Return instance
  };
}

// Then in namespace.js:
window.miniCycle.newFeature = {
  newFunction: (...args) => featureCore.newFunction(...args)
};
```

**3. Do NOT remove legacy globals unless Step 0 migration is completed**

```javascript
// ❌ BAD: Removing global before main script migration
// miniCycle-scripts.js still calls window.addTask()
// You remove window.addTask = ... from module
// Result: ReferenceError: addTask is not defined

// ✅ GOOD: Complete Step 0 first
// 1. Migrate miniCycle-scripts.js to use window.miniCycle.tasks.add()
// 2. Run full test suite (all passing)
// 3. Now safe to remove window.addTask from module
```

**4. Do NOT mix namespace + global calls in the same new feature**

```javascript
// ❌ BAD: Mixing old and new patterns
function newFeature() {
  window.miniCycle.tasks.add(text);  // Namespace
  showNotification('Success');       // Global - inconsistent!
}

// ✅ GOOD: Use namespace consistently
function newFeature() {
  window.miniCycle.tasks.add(text);
  window.miniCycle.ui.notifications.show('Success');
}
```

### 🛡️ Safety Checks

Before committing any Phase 2 work, verify:

- [ ] Full test suite passes (`npm test` - 1198/1198 tests)
- [ ] Smoke test: Add task, edit task, delete task, switch cycle, undo/redo
- [ ] No new `window.*` exports in modules (except namespace.js)
- [ ] No static imports of versioned modules (check `withV()` list in appInit.js)
- [ ] Deprecation warnings logged but not breaking (check console)
- [ ] Validator passes: `node scripts/validate-namespace-migration.js`

### Why These Rules Matter

**These are not theoretical guidelines** - they're based on actual issues encountered during development:

1. **Duplicate module instances**: Caused hours of debugging when `taskOptionsCustomizer` was imported both statically and via `withV()`
2. **Boot breakage**: Removing globals before Step 0 would cause ReferenceErrors in main script
3. **Inconsistent API**: Mixing global and namespace calls creates confusing codebase
4. **Test fragility**: Not testing namespace API means silent breakage after global removal

Following these rules ensures Phase 2 migration is smooth, safe, and reversible at any point.

---

## Benefits

### 1. Reduced Global Pollution

| Phase | Global Count |
|-------|--------------|
| Before | 163 globals |
| Phase 1 | 164 globals (wrapper + deprecated globals) |
| **Phase 2** | **1 global** |

### 2. Improved Developer Experience

**Autocomplete + discoverability:**

```javascript
window.miniCycle.  // IDE shows everything!
  ├── state
  ├── tasks
  │   ├── add()
  │   ├── edit()
  │   ├── delete()
  │   ├── priority
  │   └── recurring
  ├── cycles
  │   ├── create()
  │   ├── switch()
  │   └── ...
  ├── ui
  │   ├── notifications
  │   ├── modals
  │   └── loader
  └── utils
      ├── dom
      ├── storage
      └── json
```

### 3. Easier Testing

**Before:**
```javascript
// Mock 163 globals
beforeEach(() => {
  window.addTask = jest.fn();
  window.editTask = jest.fn();
  window.deleteTask = jest.fn();
  // ... 160 more
});
```

**After:**
```javascript
// Mock one API
beforeEach(() => {
  window.miniCycle = mockNamespace;
});
```

### 4. Collision Prevention

**Before:**
```javascript
// Chrome extension overwrites global
window.addTask = function() {
  // Extension's code
};
// miniCycle breaks!
```

**After:**
```javascript
// Extension can't overwrite namespace internals
window.miniCycle.tasks.add = function() {
  // Still protected by namespace structure
};
```

### 5. Clear Public vs Private Code

Anything not in `window.miniCycle` is internal by definition.

**Before:**
```javascript
// Is this public or internal?
window.validateAndSanitizeTaskInput = ...
```

**After:**
```javascript
// Clearly public
window.miniCycle.tasks.validate = ...

// Clearly internal (not exposed)
function _internalHelper() { ... }
```

### 6. Better Onboarding

New developers can explore the API:

```javascript
console.dir(window.miniCycle);
// See entire public API structure
```

---

## Common Pitfalls (Lessons Learned)

**These pitfalls are based on actual issues encountered during miniCycle development.** Read this section before starting Phase 2 work to avoid repeating these mistakes.

### Pitfall 1: Duplicate Module Instances

**Symptom:**
- Module state appears duplicated
- Singletons exist twice in memory
- Changes to module don't affect namespace behavior
- Weird bugs like "I called the function but nothing happened"

**Cause:**
Static imports of modules that are already loaded by `withV()` in AppInit create duplicate ES module instances.

**Example of the problem:**
```javascript
// appInit.js loads taskCore with versioning
await withV('taskCore', './modules/core/taskCore.js', deps);
// Creates instance #1 in memory

// Later, in another file:
import { TaskCore } from './modules/core/taskCore.js';
// Creates instance #2 in memory (completely separate!)

// Result: Two TaskCore instances exist
// - Instance #1 is used by namespace and has real data
// - Instance #2 is isolated and empty
// Changes to #2 don't affect #1 → confusion!
```

**Real-world occurrence:**
Encountered with `taskOptionsCustomizer` where static import created a second instance that didn't have access to the boot-loaded singleton's state.

**Fix:**
- **Never** statically import modules loaded by `withV()`
- Access via namespace: `window.miniCycle.tasks.add()`
- Or use dependency injection: `deps.taskCore`
- Check `appInit.js` for the `withV()` list before importing any module

**Tracked in:** [Phase 2 Contribution Rules](#phase-2-contribution-rules) - Rule #1

---

### Pitfall 2: Wrapper Confusion (Phase 1 vs Phase 2)

**Symptom:**
- "Why does changing the module not affect the namespace?"
- "I updated the function but the namespace still calls the old version"
- Tests pass but manual testing shows old behavior

**Cause:**
Phase 1 wrappers point to **legacy globals**, not module internals. Changes to module internals won't affect namespace until Phase 2 refactor updates the delegation.

**Example of the problem:**
```javascript
// Phase 1 namespace wrapper (current state)
window.miniCycle.tasks.add = (...args) => window.addTask(...args);
//                                        ↑
//                                        Points to GLOBAL, not module

// You modify taskCore.js internal logic
export async function init(deps) {
  const newAddTask = (text) => {
    console.log('NEW LOGIC');  // You added this
    // ... new implementation
  };
  window.addTask = newAddTask;  // But namespace still points to global
}

// Result: Namespace behavior doesn't change until you update namespace.js
```

**Fix:**
- Understand that Phase 1 namespace is a **wrapper**, not true delegation
- Step 0 must complete **before** module refactoring begins
- Don't expect module changes to affect namespace until Phase 2 Steps 1-6

**Tracked in:** [Namespace Lifecycle](#namespace-lifecycle-phase-aware)

---

### Pitfall 3: Half-Migrated Features (Mixed API Patterns)

**Symptom:**
- Some code uses `window.miniCycle.*`, some uses globals
- Inconsistent patterns across the codebase
- Confusing for new developers (which API should I use?)
- Hard to validate migration progress

**Cause:**
Incomplete batch migration or new code using old global patterns during transition period.

**Example of the problem:**
```javascript
// ❌ BAD: Mixing old and new APIs in same feature
async function handleTaskAction(text) {
  // Uses namespace (new)
  window.miniCycle.tasks.add(text);

  // Uses global (old) - inconsistent!
  showNotification('Task added', 'success');

  // Uses namespace again (new)
  window.miniCycle.state.update(/* ... */);

  // Uses global again (old)
  updateProgressBar();
}

// Result: Unclear which API is "correct", migration progress is muddy
```

**Fix:**
- Follow Step 0 batches atomically (complete entire category at once)
- Use search/replace to ensure all calls in a batch are converted
- Never mix APIs in the same PR or feature
- Use validator to check: `node scripts/validate-namespace-migration.js`

**Tracked in:** [Phase 2 Contribution Rules](#phase-2-contribution-rules) - Rule #4 and [Step 0 Workflow](#step-0-workflow-repeatable)

---

### Pitfall 4: Removing Globals Before Step 0 Completion

**Symptom:**
- ReferenceError: `addTask is not defined`
- Boot process breaks
- Tests fail catastrophically
- Manual rollback required

**Cause:**
Module refactoring started before main script migration completed. Main script still calls `window.addTask()` but module removed the global export.

**Example of the problem:**
```javascript
// miniCycle-scripts.js (main script - NOT YET MIGRATED)
function setupUI() {
  addTask('Welcome');  // Still calls global directly
}

// Meanwhile, you refactor taskCore.js:
export async function init(deps) {
  // ❌ You removed this:
  // window.addTask = (text) => { /* ... */ };

  // ✅ And changed to:
  return {
    addTask: (text) => { /* ... */ }  // No global export
  };
}

// Result: Boot breaks with ReferenceError
```

**Fix:**
- **Always** complete Step 0 (main script migration) first
- Validate with: `node scripts/validate-namespace-migration.js` (exit 0 = safe)
- Only start module refactoring (Steps 1-6) after Step 0 shows 0 violations
- Follow the order: Step 0 → Step 1 → Step 2 → ... → Step 6

**Tracked in:** [Phase 2 Contribution Rules](#phase-2-contribution-rules) - Rule #3

---

### Pitfall 5: Skipping Tests During Migration

**Symptom:**
- Silent breakage that only appears in production
- "It worked in dev but failed after deploy"
- Regression in features you didn't touch

**Cause:**
Making bulk changes without running full test suite after each batch.

**Fix:**
- Run `npm test` after **every single batch** (not optional!)
- Run smoke tests: Add task, edit, delete, switch cycle, undo/redo
- Check for deprecation warnings in console (expected, but should not throw)
- Use validator: `node scripts/validate-namespace-migration.js`
- Commit only when all tests pass (1198/1198)

**Tracked in:** [Step 0 Workflow](#step-0-workflow-repeatable) and [Phase 2 Contribution Rules](#phase-2-contribution-rules) Safety Checks

---

### Quick Checklist: "Am I About to Hit a Pitfall?"

Before making any Phase 2 changes, ask yourself:

- [ ] Did I check if this module is loaded by `withV()` in appInit.js?
- [ ] Am I completing an entire batch atomically (not half-migrating)?
- [ ] Did I run the validator to confirm Step 0 status?
- [ ] Will I run the full test suite after this change?
- [ ] Am I using namespace API consistently (not mixing with globals)?

If you answered "no" to any of these, **stop** and review the relevant pitfall above.

---

## Implementation Guide

### Step 0: Main Script Migration

See [NAMESPACE_STEP0_PROGRESS.md](./NAMESPACE_STEP0_PROGRESS.md) for detailed tracking.

**Recommended approach:**

1. **Batch by category** (10-20 calls at a time)
   ```bash
   # Example: Migrate all notification calls
   # Find:    showNotification\(
   # Replace: window.miniCycle.ui.notifications.show(
   ```

2. **Run tests after each batch**
   ```bash
   npm test
   # All 1198 tests should pass
   ```

3. **Commit frequently**
   ```bash
   git add miniCycle-scripts.js
   git commit -m "refactor: migrate notification calls to namespace (19/163)"
   ```

4. **Track progress**
   - Update NAMESPACE_STEP0_PROGRESS.md
   - Add to CHANGELOG.md

5. **Validate with script**
   ```bash
   node scripts/validate-namespace-migration.js
   ```

### Creating the Validation Script

```bash
# Create scripts directory if needed
mkdir -p scripts

# Create validation script
touch scripts/validate-namespace-migration.js
chmod +x scripts/validate-namespace-migration.js
```

See script implementation in [scripts/validate-namespace-migration.js](../../scripts/validate-namespace-migration.js)

### Testing Strategy

**After each migration batch:**

```bash
# 1. Run automated tests
npm test

# 2. Manual smoke test
npm start
open http://localhost:8080/miniCycle.html

# 3. Test on mobile
# iPad/iPhone: http://YOUR_IP:8080/miniCycle.html

# 4. Check console for deprecation warnings
# Should see fewer warnings as you migrate
```

---

## Related Documentation

### Core Architecture
- [DEVELOPER_DOCUMENTATION.md](../developer-guides/DEVELOPER_DOCUMENTATION.md) - Main developer hub
- [ARCHITECTURE_OVERVIEW.md](../developer-guides/ARCHITECTURE_OVERVIEW.md) - System architecture
- [MODULE_SYSTEM_GUIDE.md](../developer-guides/MODULE_SYSTEM_GUIDE.md) - Module patterns

### Implementation Details
- [APPINIT_EXPLAINED.md](../architecture/APPINIT_EXPLAINED.md) - 2-phase initialization
- [DATA_SCHEMA_GUIDE.md](../developer-guides/DATA_SCHEMA_GUIDE.md) - Schema structure
- [API_REFERENCE.md](../developer-guides/API_REFERENCE.md) - Complete API docs

### Testing & Quality
- [TESTING_GUIDE.md](../developer-guides/TESTING_GUIDE.md) - Testing system
- [TESTING_QUICK_REFERENCE.md](../testing/TESTING_QUICK_REFERENCE.md) - Test patterns
- [CODE_REVIEW_FINDINGS_2025.md](./CODE_REVIEW_FINDINGS_2025.md) - Code review insights

### Progress Tracking
- [NAMESPACE_STEP0_PROGRESS.md](./NAMESPACE_STEP0_PROGRESS.md) - Migration progress tracker
- [CHANGELOG.md](../../CHANGELOG.md) - Version history

---

## File Locations

| File | Location |
|------|----------|
| Implementation | `modules/core/namespace.js` |
| Tests | `tests/namespace.tests.js` |
| Integration | `miniCycle-scripts.js` |
| Progress Tracker | `docs/future-work/NAMESPACE_STEP0_PROGRESS.md` |
| Validation Script | `scripts/validate-namespace-migration.js` |
| This Documentation | `docs/future-work/NAMESPACE_ARCHITECTURE.md` |

---

## Changelog

### v1.374 (Planned - Phase 2 Step 0)
- 🚧 Migrate miniCycle-scripts.js to namespace API
- 🚧 Track progress in NAMESPACE_STEP0_PROGRESS.md
- 🚧 Create validation script
- 🚧 Target: 163/163 conversions (100%)

### v1.373 (November 23, 2025 - Phase 1 Complete)
- ✅ Created unified namespace API
- ✅ Implemented backward compatibility layer
- ✅ Added 128 comprehensive tests
- ✅ Documented architecture and migration path
- ✅ All 1198 tests passing (100%)

---

**Last Updated**: November 23, 2025
**Version**: 1.374 (Planned)
**Status**: Phase 1 Complete ✅ | Phase 2 Ready (Main Script First) 🚧
**Next Step**: [NAMESPACE_STEP0_PROGRESS.md](./NAMESPACE_STEP0_PROGRESS.md)

---

**Built by** [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
