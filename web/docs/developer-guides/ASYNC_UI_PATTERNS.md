# Async UI Patterns & Common Pitfalls

> **Last Updated**: December 2024
> **Audience**: Developers working on miniCycle
> **Purpose**: Document lessons learned from async state management bugs

---

## Overview

This guide documents common mistakes when working with async state and UI updates in miniCycle, along with the correct patterns to follow.

**Core Theme**: Don't assume async operations complete before the next user action.

---

## 1. Wrapper Functions Not Forwarding All Parameters

### The Problem
When creating wrapper functions for dependency injection, it's easy to forget optional parameters.

```javascript
// ❌ WRONG - Only forwarded one parameter
updateAppState: (updateFn) => {
    return window.AppState.update(updateFn);
},

// ✅ RIGHT - Forward all parameters
updateAppState: (updateFn, immediate = false) => {
    return window.AppState.update(updateFn, immediate);
},
```

### Why It Matters
The `immediate` parameter triggers instant localStorage persistence. Without it, saves are debounced and can be lost if the user refreshes quickly.

### Lesson
When creating wrapper functions, always forward ALL parameters, especially optional ones.

---

## 2. Updating Template But Not the Task Itself

### The Problem
Data sometimes exists in multiple places (e.g., task object + recurring template). Updating only one location causes inconsistencies on reload.

```javascript
// ❌ WRONG - Only updated the template
recurringTemplates[taskId] = {
    deleteWhenComplete: true,
    deleteWhenCompleteSettings: {...}
};

// ✅ RIGHT - Also update the task in the tasks array
recurringTemplates[taskId] = {
    deleteWhenComplete: true,
    deleteWhenCompleteSettings: {...}
};

const task = cycle.tasks.find(t => t.id === taskId);
if (task) {
    task.deleteWhenComplete = true;
    task.deleteWhenCompleteSettings = {...};
}
```

### Why It Matters
On page reload, tasks are rendered from `cycle.tasks[]`, not from templates. If the task object wasn't updated, the UI won't reflect the correct state.

### Lesson
When data exists in multiple places (task + template), update BOTH.

---

## 3. Missing Window Exports

### The Problem
With ES modules and dependency injection, functions may exist internally but not be exposed where other modules expect them.

```javascript
// ❌ WRONG - Function exists but not exposed to window
window.recurringCore = recurringModules.coreAPI; // Has handleDeactivation

// But taskDOM.js looks for:
if (window.handleRecurringTaskDeactivation) // UNDEFINED!

// ✅ RIGHT - Explicitly expose what other modules need
window.handleRecurringTaskDeactivation = (...args) =>
    recurringModules.coreAPI.handleDeactivation(...args);
```

### Why It Matters
Silent failures - the code checks `if (window.functionName)` and simply skips execution if it's undefined, making bugs hard to track.

### Lesson
When Module A calls `window.functionName`, Module B must explicitly set `window.functionName = ...`.

---

## 4. Relying Only on Async State for UI Decisions

### The Problem
Checking only async state creates race conditions when users click rapidly.

```javascript
// ❌ WRONG - Only checks async state (race condition)
const hasTemplate = cycle.recurringTemplates[taskId];
const isCurrentlyRecurring = !!hasTemplate;

// ✅ BETTER - Also check synchronous UI state as fallback
const hasTemplate = cycle.recurringTemplates[taskId];
const isButtonActive = button.classList.contains('active');
const isCurrentlyRecurring = !!hasTemplate || isButtonActive;
```

### The Nuance

**This is a pragmatic fallback: DOM + state together.**

However:
- Treat the **DOM as a UI hint**, not the ultimate source of truth
- **AppState is always the canonical source of truth**

### The More Robust Pattern (Optimistic UI)

```javascript
button.addEventListener('click', async () => {
    // 1. Immediately sync DOM (optimistic update)
    button.classList.toggle('active');

    // 2. Kick off state update in background
    try {
        await AppState.update(...);
    } catch (error) {
        // 3. If state update fails, re-sync DOM FROM state (rollback)
        const currentState = AppState.get();
        const actualValue = currentState.data...;
        button.classList.toggle('active', actualValue);
        showNotification('Failed to save, reverted changes', 'error');
    }
});
```

### Lesson
Update UI immediately for responsiveness, but always be ready to rollback to the true state if the async operation fails.

---

## 5. Async Functions for Immediate UI Updates

### The Problem
DOM updates inside async functions happen after `await`, causing visible delays.

```javascript
// ❌ WRONG - DOM update inside async function (delayed)
async function handleRecurringTaskDeactivation() {
    await AppState.update(...);  // Async - takes time
    syncDOM();  // User sees delay before this runs
}

// ✅ RIGHT - Immediate sync in the click handler itself
button.addEventListener('click', () => {
    handleRecurringTaskDeactivation();  // Fire and forget

    // Immediately sync DOM right here, don't wait
    deleteBtn.classList.toggle('active', defaultState);
    taskItem.classList.remove('recurring');
});
```

### Why It Matters
Users expect instant feedback. Even a 100ms delay feels sluggish.

### Lesson
For instant UI feedback, do DOM updates synchronously in the event handler, not inside async functions.

---

## Summary Checklist

When working with async state and UI:

- [ ] Forward all parameters through wrapper functions
- [ ] Update all data locations (task + template, etc.)
- [ ] Expose functions to `window.*` where needed
- [ ] Use synchronous DOM state as backup for async state
- [ ] Update UI synchronously for instant feedback
- [ ] Implement rollback logic for failed state updates

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
- [Module System Guide](./MODULE_SYSTEM_GUIDE.md)
- [AppInit System](./APPINIT_SYSTEM.md)
- [Data Schema Guide](./DATA_SCHEMA_GUIDE.md)
