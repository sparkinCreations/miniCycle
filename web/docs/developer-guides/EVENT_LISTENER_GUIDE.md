# Event Listener Management Guide

**Last Updated:** March 2026
**Status:** Complete reference for listener patterns and cleanup

> Event listener leaks are the #1 source of memory leaks and bugs in miniCycle. This guide documents the patterns used, cleanup requirements, and common pitfalls.

---

## Table of Contents

1. [The Golden Rule](#the-golden-rule)
2. [Pattern 1: safeAddEventListener](#pattern-1-safeaddeventlistener)
3. [Pattern 2: WeakMap Cleanup](#pattern-2-weakmap-cleanup)
4. [Pattern 3: Event Delegation](#pattern-3-event-delegation)
5. [Pattern 4: Explicit destroy()](#pattern-4-explicit-destroy)
6. [Modal Listener Lifecycle](#modal-listener-lifecycle)
7. [Document-Level Listeners](#document-level-listeners)
8. [Common Mistakes](#common-mistakes)
9. [Debugging Listener Leaks](#debugging-listener-leaks)

---

## The Golden Rule

**Every `addEventListener` must have a corresponding `removeEventListener` path.**

This means:
- Store handler references so you can remove them later
- Remove ALL listeners on modal close — not just the escape key handler
- Use `safeAddEventListener` (removes before adding) to prevent duplicates
- For loops: use event delegation on a parent, not per-element listeners

---

## Pattern 1: safeAddEventListener

The most common pattern. `GlobalUtils.safeAddEventListener` removes the existing listener before adding a new one, preventing duplicates.

```javascript
// Available via DI as this.deps.safeAddEventListener
this.deps.safeAddEventListener(element, 'click', this.handleClick);

// Also available as static methods:
GlobalUtils.safeAddEventListener(element, 'click', handler);
GlobalUtils.safeAddEventListenerById('my-id', 'click', handler);
GlobalUtils.safeAddEventListenerBySelector('.my-class', 'click', handler);
```

### How it works

```javascript
static safeAddEventListener(element, event, handler, options) {
    if (!element) return;
    element.removeEventListener(event, handler, options);  // Remove old
    element.addEventListener(event, handler, options);      // Add fresh
}
```

### When to use

- One-time bindings during initialization
- Listeners that should only exist once (buttons, toggles)
- Rebinding after DOM updates

### Limitation

Only works if you pass the **exact same function reference** both times. Arrow functions created inline create new references and defeat the deduplication:

```javascript
// WRONG — new function each time, old one is never removed
safeAddEventListener(btn, 'click', () => this.doThing());

// RIGHT — stable reference, old one is properly removed
this._doThingHandler = () => this.doThing();
safeAddEventListener(btn, 'click', this._doThingHandler);

// ALSO RIGHT — bound method (bind once, reuse)
this.handleClick = this.handleClick.bind(this);
safeAddEventListener(btn, 'click', this.handleClick);
```

---

## Pattern 2: WeakMap Cleanup

For per-element listeners where elements may be added/removed dynamically. The WeakMap allows automatic garbage collection when the element is removed from the DOM.

```javascript
class MyComponent {
    constructor() {
        this._listeners = new WeakMap();
    }

    attachListeners(element) {
        const clickHandler = (e) => this.handleClick(e);
        const hoverHandler = (e) => this.handleHover(e);

        element.addEventListener('click', clickHandler);
        element.addEventListener('mouseenter', hoverHandler);

        // Store cleanup function
        const cleanup = () => {
            element.removeEventListener('click', clickHandler);
            element.removeEventListener('mouseenter', hoverHandler);
        };
        this._listeners.set(element, cleanup);
    }

    detachListeners(element) {
        const cleanup = this._listeners.get(element);
        if (cleanup) {
            cleanup();
            this._listeners.delete(element);
        }
    }

    destroy() {
        // WeakMap entries are auto-GC'd when elements are removed,
        // but explicitly clean up known elements if you have references
    }
}
```

### When to use

- Dynamic lists where elements are created/destroyed frequently
- Task elements, recurring task items, list entries
- When you need multiple listeners per element

---

## Pattern 3: Event Delegation

For lists of similar elements, attach ONE listener to the parent instead of one per child.

```javascript
// ONE listener on the task list handles all task clicks
const taskList = document.getElementById(DOM_IDS.TASK_LIST);

taskList.addEventListener('click', (e) => {
    // Find the closest .task ancestor of the clicked element
    const task = e.target.closest(DOM_SELECTORS.TASK);
    if (!task) return;

    // Check which button was clicked
    const priorityBtn = e.target.closest(DOM_SELECTORS.PRIORITY_BTN);
    if (priorityBtn) {
        this.handlePriorityClick(task, priorityBtn);
        return;
    }

    const deleteBtn = e.target.closest(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
    if (deleteBtn) {
        this.handleDeleteClick(task, deleteBtn);
        return;
    }
});
```

### When to use

- Task lists (any number of tasks, dynamically added/removed)
- Recurring task lists
- Any container with many similar child elements
- Replaces per-element listeners in loops

### Benefits

- Single listener to manage (easy cleanup)
- Works for dynamically added elements (no re-binding needed)
- Better memory usage than per-element listeners

---

## Pattern 4: Explicit destroy()

Every module that manages listeners should have a `destroy()` method:

```javascript
class MyFeature {
    constructor() {
        this._handlers = {};
        this._intervals = [];
        this._timeouts = [];
    }

    init() {
        this._handlers.click = () => this.handleClick();
        this._handlers.resize = () => this.handleResize();

        this.deps.safeAddEventListener(this.element, 'click', this._handlers.click);
        window.addEventListener('resize', this._handlers.resize);

        this._intervals.push(setInterval(() => this.poll(), 5000));
    }

    destroy() {
        // Remove all event listeners
        this.element?.removeEventListener('click', this._handlers.click);
        window.removeEventListener('resize', this._handlers.resize);

        // Clear all intervals and timeouts
        this._intervals.forEach(id => clearInterval(id));
        this._timeouts.forEach(id => clearTimeout(id));

        // Clear references
        this._handlers = {};
        this._intervals = [];
        this._timeouts = [];
        this.initialized = false;
    }
}
```

---

## Modal Listener Lifecycle

Modals are the most common source of listener leaks. Follow this lifecycle:

### Opening a modal

```javascript
openModal() {
    const modal = this.deps.getElementById(DOM_IDS.MY_MODAL);

    // 1. Store ALL handler references
    this._handlers = {
        close: () => this.closeModal(),
        escape: (e) => { if (e.key === 'Escape') this.closeModal(); },
        backdrop: (e) => { if (e.target === modal) this.closeModal(); },
        save: () => this.handleSave(),
        change: (e) => this.handleChange(e),
    };

    // 2. Attach all listeners
    this.deps.safeAddEventListener(closeBtn, 'click', this._handlers.close);
    document.addEventListener('keydown', this._handlers.escape);
    this.deps.safeAddEventListener(modal, 'click', this._handlers.backdrop);
    this.deps.safeAddEventListener(saveBtn, 'click', this._handlers.save);
    this.deps.safeAddEventListener(select, 'change', this._handlers.change);

    // 3. Save previous focus for restoration
    this._previousFocus = document.activeElement;
    closeBtn.focus();
}
```

### Closing a modal

```javascript
closeModal() {
    const modal = this.deps.getElementById(DOM_IDS.MY_MODAL);
    modal.classList.add(DOM_CLASSES.HIDDEN);

    // CRITICAL: Remove ALL listeners, not just escape
    document.removeEventListener('keydown', this._handlers.escape);
    closeBtn?.removeEventListener('click', this._handlers.close);
    modal?.removeEventListener('click', this._handlers.backdrop);
    saveBtn?.removeEventListener('click', this._handlers.save);
    select?.removeEventListener('change', this._handlers.change);

    // Clear handler references
    this._handlers = {};

    // Restore focus
    this._previousFocus?.focus();
}
```

### Common modal mistake

```javascript
// WRONG — only removes escape handler, leaks all other listeners
closeModal() {
    modal.classList.add('hidden');
    document.removeEventListener('keydown', this._escHandler);
    // Where are the click, change, and backdrop handlers?!
}
```

---

## Document-Level Listeners

Listeners on `document` or `window` are especially dangerous because they persist even if the component is destroyed.

### Rules for document-level listeners

1. **Always store the handler reference**
2. **Always remove in the teardown path** (`closeModal`, `destroy`, `deactivate`)
3. **Prefer scoped listeners** when possible (listen on a container instead of document)

```javascript
// Good — stored and removable
this._scrollHandler = () => this.handleScroll();
document.addEventListener('scroll', this._scrollHandler, { passive: true });

// Teardown
document.removeEventListener('scroll', this._scrollHandler);

// Bad — anonymous function, cannot be removed
document.addEventListener('scroll', () => this.handleScroll());
```

---

## Common Mistakes

### 1. Anonymous handlers (cannot be removed)

```javascript
// WRONG — no way to remove this later
element.addEventListener('click', () => doThing());

// RIGHT — store reference
this._clickHandler = () => doThing();
element.addEventListener('click', this._clickHandler);
```

### 2. Adding listeners in a loop without tracking

```javascript
// WRONG — creates N listeners with no cleanup path
tasks.forEach(task => {
    task.addEventListener('click', () => handleTask(task));
});

// RIGHT — use event delegation on parent
taskList.addEventListener('click', (e) => {
    const task = e.target.closest(DOM_SELECTORS.TASK);
    if (task) handleTask(task);
});
```

### 3. Re-binding without removing old listener

```javascript
// WRONG — adds a NEW listener every time render() is called
render() {
    button.addEventListener('click', this.handleClick);
}

// RIGHT — safeAddEventListener removes old one first
render() {
    this.deps.safeAddEventListener(button, 'click', this.handleClick);
}
```

### 4. Assuming modal close cleans everything up

Many modals have a `closeModal()` that only handles the escape key and hides the modal. But the click handlers on buttons, change handlers on selects, and backdrop click handlers are still active.

**Fix:** Audit every modal's close path and ensure ALL listeners are removed.

### 5. Forgetting to clear intervals and timeouts

```javascript
// WRONG — interval runs forever after component is destroyed
init() {
    setInterval(() => this.checkStatus(), 5000);
}

// RIGHT — track and clear
init() {
    this._checkInterval = setInterval(() => this.checkStatus(), 5000);
}
destroy() {
    clearInterval(this._checkInterval);
}
```

### 6. Stale closures capturing mutable state

```javascript
// WRONG — activeCycleId captured at handler creation time
const cycleId = state.appState.activeCycleId;
radio.addEventListener('change', () => {
    applyTheme(cycleId);  // Uses stale cycleId!
});

// RIGHT — read fresh from state at event-fire time
radio.addEventListener('change', () => {
    const currentCycleId = this.deps.AppState.get().appState.activeCycleId;
    applyTheme(currentCycleId);
});
```

---

## Debugging Listener Leaks

### Symptoms of listener leaks

- Actions fire multiple times per click
- Removed modals still respond to keyboard events
- Memory usage grows over time
- Console shows duplicate log messages

### How to find leaks

1. **Chrome DevTools → Elements → Event Listeners tab**: Select an element and see all attached listeners. Look for unexpected listeners after a modal is closed.

2. **Performance Monitor**: Watch JS event listeners count over time. Open/close a modal — the count should return to the same number.

3. **`getEventListeners(element)` in console**: Chrome-only DevTools API that shows all listeners on an element.

4. **Search for `addEventListener` without matching `removeEventListener`**: Every add should have a corresponding remove path.

---

## See Also

- [HOW_TO_ADD_COOKBOOK.md](./HOW_TO_ADD_COOKBOOK.md) — Checklists for adding new event listeners
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — General coding conventions
- [MAKING_CODE_CHANGES.md](./MAKING_CODE_CHANGES.md) — DI wiring workflow
