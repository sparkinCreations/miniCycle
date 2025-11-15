# Event Flow & UI State Management Patterns

**Version**: 1.359
**Last Updated**: November 15, 2025
**Status**: Active Architecture Guide
**Lessons Learned From**: Three-dots button debugging session (v1.358-1.359)

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem: Competing Event Handlers](#the-problem-competing-event-handlers)
3. [Solution: Mode-Aware Event Coordination](#solution-mode-aware-event-coordination)
4. [Design Patterns](#design-patterns)
5. [Task Options Visibility: A Case Study](#task-options-visibility-a-case-study)
6. [Implementation Guidelines](#implementation-guidelines)
7. [Common Pitfalls](#common-pitfalls)
8. [Debugging Strategies](#debugging-strategies)

---

## Overview

### What This Document Covers

This document establishes architectural patterns for managing **competing event handlers** that control the same UI state. It emerged from debugging a complex interaction issue where multiple event types (click, hover, focus) competed to control task option button visibility.

### Core Principle

**When multiple event handlers can modify the same UI element, they must coordinate through mode-aware guards and centralized state management.**

Without coordination, you get:
- Race conditions (one handler sets state, another immediately changes it)
- Conflicting behaviors (hover shows, focus hides)
- Difficult-to-debug timing issues
- Inconsistent user experiences

---

## The Problem: Competing Event Handlers

### Real-World Example: Task Options Visibility

In miniCycle v1.358, task option buttons (edit, delete, priority, etc.) could be revealed through three different interaction patterns:

```javascript
// Pattern 1: Hover (mouse users)
taskItem.addEventListener("mouseenter", showTaskOptions);
taskItem.addEventListener("mouseleave", hideTaskOptions);

// Pattern 2: Focus (keyboard users)
taskItem.addEventListener("focusin", (e) => {
    taskOptions.style.visibility = "visible";  // 🚨 Always runs!
});

// Pattern 3: Three-dots button click (explicit mode)
threeDotButton.addEventListener("click", () => {
    revealTaskButtons(taskItem);  // Toggle visibility
});
```

### The Bug

When three-dots mode was enabled:

1. User clicks three-dots button
2. Click focuses the task element
3. **`focusin` handler fires FIRST** and sets `visibility = "visible"`
4. Three-dots click handler runs and sees options are already visible
5. Click handler toggles visibility OFF (thinking user clicked twice)
6. Result: Options disappear immediately, requiring a second click

### Root Cause Analysis

**Three independent event handlers were ALL trying to control visibility without checking what mode the app was in.**

```javascript
// ❌ PROBLEM: No mode awareness
taskItem.addEventListener("focusin", (e) => {
    // Always sets visibility, regardless of mode!
    taskOptions.style.visibility = "visible";
});
```

### Why Refactoring Didn't Prevent This

The code was already well-modularized:
- ✅ Clean module boundaries
- ✅ Dependency injection
- ✅ Event delegation for memory leak prevention

**But modules were missing mode-aware coordination.** Each handler operated independently without checking:
- "Should I handle this event given the current mode?"
- "Is another handler better suited for this interaction?"
- "What is the single source of truth for this UI state?"

---

## Solution: Mode-Aware Event Coordination

### Pattern 1: Early Exit Guards

Every event handler should check mode context and exit early if inappropriate:

```javascript
// ✅ CORRECT: Mode-aware handler
taskItem.addEventListener("focusin", (e) => {
    // Guard: Don't interfere in three-dots mode
    const threeDotsEnabled = document.body.classList.contains("show-three-dots-enabled");
    if (threeDotsEnabled) {
        console.log('⏭️ Skipping focusin auto-reveal (three-dots mode enabled)');
        return;  // Bow out gracefully
    }

    // Only proceed if we should handle this
    const options = taskItem.querySelector(".task-options");
    if (options) {
        options.style.visibility = "visible";
    }
});
```

### Pattern 2: Handler Responsibility Matrix

Document which handler is responsible in which mode:

| Interaction | Hover Mode | Three-Dots Mode | Purpose |
|-------------|-----------|-----------------|---------|
| `mouseenter` | ✅ Show options | ❌ Ignore | Mouse users in hover mode |
| `mouseleave` | ✅ Hide options | ❌ Ignore | Mouse users in hover mode |
| `focusin` | ✅ Show options | ❌ Ignore | Keyboard users in hover mode |
| `focusout` | ✅ Hide options | ✅ Hide options | Keyboard users (all modes) |
| Three-dots click | ❌ N/A | ✅ Toggle visibility | Explicit control in three-dots mode |

### Pattern 3: Centralized Visibility Controller

✅ **IMPLEMENTED in v1.359** - miniCycle now uses `TaskOptionsVisibilityController`

Instead of multiple handlers directly manipulating DOM, all visibility changes route through a centralized controller:

```javascript
/**
 * ✅ ACTUAL IMPLEMENTATION (miniCycle-scripts.js:2974-3047)
 * TaskOptionsVisibilityController - Centralized controller for task options visibility
 */
class TaskOptionsVisibilityController {
    /**
     * Get the current visibility mode
     * @returns {'hover' | 'three-dots'} Current mode
     */
    static getMode() {
        return document.body.classList.contains("show-three-dots-enabled") ? 'three-dots' : 'hover';
    }

    /**
     * Check if a caller is allowed to change visibility in the current mode
     * @param {string} caller - Identifier for the event handler calling this
     * @returns {boolean} Whether the caller can modify visibility
     */
    static canHandle(caller) {
        const mode = this.getMode();

        const permissions = {
            'hover': ['mouseenter', 'mouseleave', 'focusin', 'focusout'],
            'three-dots': ['three-dots-button', 'focusout']
        };

        return permissions[mode]?.includes(caller) || false;
    }

    /**
     * Set task options visibility with mode-aware coordination
     * @param {HTMLElement} taskItem - The task element
     * @param {boolean} visible - Desired visibility state
     * @param {string} caller - Identifier for the event handler (for logging/permissions)
     * @returns {boolean} Whether the visibility was changed
     */
    static setVisibility(taskItem, visible, caller = 'unknown') {
        const taskOptions = taskItem.querySelector('.task-options');
        if (!taskOptions) {
            console.warn(`⚠️ TaskOptionsVisibilityController: No .task-options found for ${caller}`);
            return false;
        }

        // Check if this caller is allowed to change visibility in current mode
        if (!this.canHandle(caller)) {
            console.log(`⏭️ ${caller}: Skipping visibility change in ${this.getMode()} mode`);
            return false;
        }

        // Apply visibility state
        taskOptions.style.visibility = visible ? "visible" : "hidden";
        taskOptions.style.opacity = visible ? "1" : "0";
        taskOptions.style.pointerEvents = visible ? "auto" : "none";

        console.log(`👁️ ${caller}: visibility → ${visible ? 'visible' : 'hidden'} (mode: ${this.getMode()})`);
        return true;
    }

    /**
     * Show task options (convenience method)
     */
    static show(taskItem, caller) {
        return this.setVisibility(taskItem, true, caller);
    }

    /**
     * Hide task options (convenience method)
     */
    static hide(taskItem, caller) {
        return this.setVisibility(taskItem, false, caller);
    }
}

// All handlers route through centralized controller
taskItem.addEventListener("mouseenter", () => {
    TaskOptionsVisibilityController.show(taskItem, 'mouseenter');
});

taskItem.addEventListener("focusin", () => {
    TaskOptionsVisibilityController.show(taskItem, 'focusin');
});

threeDotsButton.addEventListener("click", () => {
    const currentlyVisible = taskOptions.style.visibility === "visible";
    if (currentlyVisible) {
        TaskOptionsVisibilityController.hide(taskItem, 'three-dots-button');
    } else {
        TaskOptionsVisibilityController.show(taskItem, 'three-dots-button');
    }
});
```

**Implementation Locations:**
- **Controller Class**: `miniCycle-scripts.js:2974-3047`
- **focusin/focusout**: `miniCycle-scripts.js:3080, 3090`
- **mouseenter/mouseleave**: `miniCycle-scripts.js:3180, 3204`
- **three-dots toggle**: `modules/task/taskEvents.js:243-247`
- **focus handler**: `modules/task/taskEvents.js:360`

**Benefits:**
- ✅ Single source of truth for visibility logic
- ✅ Mode checks happen in one place
- ✅ Easy to add logging/debugging
- ✅ Changes to visibility logic only need one update
- ✅ Clear audit trail of who changed what
- ✅ Permission system prevents conflicting handlers

---

## Design Patterns

### Pattern: Mode Context Checking

Always check the current mode before modifying UI:

```javascript
function shouldHandleEvent(eventType) {
    const threeDotsMode = document.body.classList.contains("show-three-dots-enabled");
    const hoverMode = !threeDotsMode;

    const handlers = {
        'mouseenter': hoverMode,
        'mouseleave': hoverMode,
        'focusin': hoverMode,
        'click': threeDotsMode
    };

    return handlers[eventType] || false;
}

// Usage
taskItem.addEventListener("focusin", (e) => {
    if (!shouldHandleEvent('focusin')) {
        console.log('⏭️ Skipping focusin - wrong mode');
        return;
    }

    // Handle event...
});
```

### Pattern: Event Priority System

When multiple events can fire, establish priority:

```javascript
/**
 * Priority order for task options visibility:
 * 1. Three-dots button click (explicit user action)
 * 2. Hover events (mouse users)
 * 3. Focus events (keyboard users)
 *
 * Higher priority events suppress lower priority handlers
 */
const EVENT_PRIORITY = {
    'three-dots-click': 3,
    'mouseenter': 2,
    'focusin': 1
};

function canHandleEvent(eventType, currentMode) {
    // Three-dots mode: only priority 3 events allowed
    if (currentMode === 'three-dots' && EVENT_PRIORITY[eventType] < 3) {
        return false;
    }

    // Hover mode: priority 2+ events allowed
    if (currentMode === 'hover' && EVENT_PRIORITY[eventType] >= 2) {
        return true;
    }

    // Fallback to focus events
    return EVENT_PRIORITY[eventType] >= 1;
}
```

### Pattern: State Machine for Visibility

Model visibility as a state machine:

```javascript
class TaskOptionsVisibilityState {
    constructor(taskItem) {
        this.taskItem = taskItem;
        this.state = 'hidden';  // 'hidden' | 'visible' | 'locked'
        this.mode = 'hover';    // 'hover' | 'three-dots'
    }

    updateMode(newMode) {
        this.mode = newMode;
        console.log(`🔄 Visibility mode changed to: ${newMode}`);
    }

    show(caller) {
        if (this.state === 'locked') {
            console.log(`🔒 Visibility locked, ignoring show from ${caller}`);
            return false;
        }

        if (!this.canHandleInCurrentMode(caller)) {
            console.log(`⏭️ ${caller} can't show in ${this.mode} mode`);
            return false;
        }

        this.state = 'visible';
        this.applyToDOM();
        return true;
    }

    hide(caller) {
        if (this.state === 'locked') {
            console.log(`🔒 Visibility locked, ignoring hide from ${caller}`);
            return false;
        }

        this.state = 'hidden';
        this.applyToDOM();
        return true;
    }

    toggle(caller) {
        if (this.state === 'visible') {
            return this.hide(caller);
        } else {
            return this.show(caller);
        }
    }

    lock() {
        this.state = 'locked';
    }

    unlock() {
        this.state = this.state === 'locked' ? 'hidden' : this.state;
    }

    canHandleInCurrentMode(caller) {
        const permissions = {
            'hover': ['mouseenter', 'mouseleave', 'focusin', 'focusout'],
            'three-dots': ['three-dots-button', 'focusout']
        };

        return permissions[this.mode]?.includes(caller) || false;
    }

    applyToDOM() {
        const taskOptions = this.taskItem.querySelector('.task-options');
        if (!taskOptions) return;

        const visible = this.state === 'visible';
        taskOptions.style.visibility = visible ? 'visible' : 'hidden';
        taskOptions.style.opacity = visible ? '1' : '0';
        taskOptions.style.pointerEvents = visible ? 'auto' : 'none';
    }
}

// Usage
const visibilityState = new TaskOptionsVisibilityState(taskItem);

taskItem.addEventListener('mouseenter', () => {
    visibilityState.show('mouseenter');
});

taskItem.addEventListener('focusin', () => {
    visibilityState.show('focusin');
});
```

---

## Task Options Visibility: A Case Study

### Complete Event Flow Documentation

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════
 * TASK OPTIONS VISIBILITY - COMPLETE EVENT FLOW
 * ═══════════════════════════════════════════════════════════════════
 *
 * GOAL: Show/hide task option buttons (.task-options) based on interaction
 *
 * MODES:
 * - HOVER MODE: Options show on mouseenter/focusin, hide on mouseleave/focusout
 * - THREE-DOTS MODE: Options show ONLY on three-dots button click, manual toggle
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOVER MODE EVENT FLOW
 * ═══════════════════════════════════════════════════════════════════
 *
 * Precondition: document.body DOES NOT have class "show-three-dots-enabled"
 *
 * Mouse Users:
 * 1. mouseenter → showTaskOptions() → visibility = visible
 * 2. mouseleave → hideTaskOptions() → visibility = hidden
 *
 * Keyboard Users:
 * 1. Tab focuses task → focusin event
 * 2. Check: target NOT checkbox, NOT task-text
 * 3. visibility = visible
 * 4. Shift+Tab or Tab away → focusout event
 * 5. visibility = hidden
 *
 * ═══════════════════════════════════════════════════════════════════
 * THREE-DOTS MODE EVENT FLOW
 * ═══════════════════════════════════════════════════════════════════
 *
 * Precondition: document.body HAS class "show-three-dots-enabled"
 *
 * Three-Dots Button Click:
 * 1. User clicks three-dots button (.three-dots-btn)
 * 2. Click event bubbles up
 * 3. handleThreeDotsClick(taskItem, event)
 * 4. event.stopPropagation() (prevent task click delegation)
 * 5. revealTaskButtons(taskItem)
 * 6. Check current inline visibility (taskOptions.style.visibility)
 * 7. If "visible" → toggle OFF (hide)
 * 8. If NOT "visible" → toggle ON (show)
 *
 * Focus Events (THREE-DOTS MODE):
 * 1. focusin event fires (e.g., when clicking button)
 * 2. ✅ FIX (v1.359): Check if three-dots mode enabled
 * 3. If enabled → SKIP auto-reveal, return early
 * 4. This prevents focus from interfering with manual button control
 *
 * Hover Events (THREE-DOTS MODE):
 * 1. mouseenter event fires
 * 2. showTaskOptions() checks if three-dots enabled
 * 3. If enabled → return early without showing
 * 4. Same for mouseleave
 *
 * ═══════════════════════════════════════════════════════════════════
 * CRITICAL FIXES (v1.359)
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG: Three-dots button required double-click
 * ROOT CAUSE: focusin event set visibility="visible" BEFORE click handler
 * FIX: Added mode check in focusin handler:
 *
 * ```javascript
 * taskItem.addEventListener("focusin", (e) => {
 *     // ✅ FIX: Don't auto-reveal in three-dots mode
 *     const threeDotsEnabled = document.body.classList.contains("show-three-dots-enabled");
 *     if (threeDotsEnabled) {
 *         console.log('⏭️ Skipping focusin auto-reveal (three-dots mode enabled)');
 *         return;
 *     }
 *
 *     // Proceed with auto-reveal only in hover mode...
 * });
 * ```
 *
 * LESSON: Every event handler must check mode before modifying UI
 *
 * ═══════════════════════════════════════════════════════════════════
 * HANDLER RESPONSIBILITY MATRIX
 * ═══════════════════════════════════════════════════════════════════
 *
 * | Event         | Hover Mode | Three-Dots Mode | Location                      |
 * |---------------|------------|-----------------|-------------------------------|
 * | mouseenter    | ✅ Show    | ❌ Skip         | miniCycle-scripts.js:3070     |
 * | mouseleave    | ✅ Hide    | ❌ Skip         | miniCycle-scripts.js:3096     |
 * | focusin       | ✅ Show    | ❌ Skip (v1.359)| miniCycle-scripts.js:2973     |
 * | focusout      | ✅ Hide    | ✅ Hide         | miniCycle-scripts.js:2996     |
 * | three-dots    | N/A        | ✅ Toggle       | taskDOM.js:421 → taskEvents:207|
 *
 * ═══════════════════════════════════════════════════════════════════
 */
```

### Implementation Checklist

When adding new event handlers that control shared UI state:

- [ ] Document which mode(s) this handler should operate in
- [ ] Add mode check at the start of the handler
- [ ] Log when skipping (for debugging)
- [ ] Update the responsibility matrix documentation
- [ ] Test in all applicable modes
- [ ] Check for race conditions with other handlers
- [ ] Verify timing with browser DevTools event log

---

## Implementation Guidelines

### 1. Always Document Event Flow

At the top of the relevant module/file:

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════
 * [FEATURE NAME] - EVENT FLOW DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * MODES: [List all operational modes]
 * GOAL: [What this event flow achieves]
 *
 * MODE 1:
 * - Event A → Handler X → Outcome Y
 * - Event B → Handler Z → Outcome Q
 *
 * MODE 2:
 * - Event A → SKIP (reason)
 * - Event C → Handler W → Outcome P
 *
 * CRITICAL NOTES:
 * - [Any gotchas, race conditions, or non-obvious behavior]
 *
 * ═══════════════════════════════════════════════════════════════════
 */
```

### 2. Mode Check Template

Every handler should follow this pattern:

```javascript
function eventHandler(event) {
    // 1. MODE CHECK - Determine if this handler should run
    const currentMode = getCurrentMode(); // e.g., check body classes, AppState, etc.
    const shouldHandle = canHandleInMode(currentMode, 'event-name');

    if (!shouldHandle) {
        console.log(`⏭️ Skipping event-name handler in ${currentMode} mode`);
        return;
    }

    // 2. SAFETY CHECKS - Validate DOM elements, state, etc.
    const element = event.target.closest('.selector');
    if (!element) {
        console.warn('⚠️ Event target not found');
        return;
    }

    // 3. BUSINESS LOGIC - Actual event handling
    // ...

    // 4. STATE UPDATE - Update shared state if needed
    // ...

    // 5. LOGGING - Track what happened
    console.log(`✅ event-name handled successfully`);
}
```

### 3. Centralize Mode Detection

Don't scatter mode checks throughout code:

```javascript
// ❌ BAD: Scattered mode checks
function handler1() {
    if (document.body.classList.contains('show-three-dots-enabled')) return;
    // ...
}

function handler2() {
    const threeDotsEnabled = document.body.classList.contains('show-three-dots-enabled');
    if (threeDotsEnabled) return;
    // ...
}

// ✅ GOOD: Centralized mode detection
class ModeManager {
    static isThreeDotsMode() {
        return document.body.classList.contains('show-three-dots-enabled');
    }

    static isHoverMode() {
        return !this.isThreeDotsMode();
    }

    static getCurrentMode() {
        return this.isThreeDotsMode() ? 'three-dots' : 'hover';
    }
}

// Usage
function handler1() {
    if (ModeManager.isThreeDotsMode()) return;
    // ...
}
```

### 4. Add Diagnostic Logging

During development, add comprehensive logging:

```javascript
function revealTaskButtons(taskItem) {
    const taskOptions = taskItem.querySelector(".task-options");
    if (!taskOptions) {
        console.warn('⚠️ revealTaskButtons: No .task-options found');
        return;
    }

    const isCurrentlyVisible = taskOptions.style.visibility === "visible";

    // 🐛 DIAGNOSTIC LOGGING
    console.log('🔍 revealTaskButtons called:', {
        taskId: taskItem.dataset.id || 'unknown',
        inlineVisibility: taskOptions.style.visibility || '(not set)',
        isCurrentlyVisible,
        willToggleOff: isCurrentlyVisible,
        timestamp: Date.now()
    });

    // Toggle logic...
}
```

### 5. Test Event Order

Use browser DevTools to log event order:

```javascript
// Temporary debugging - log all events
const events = ['click', 'mouseenter', 'mouseleave', 'focusin', 'focusout'];

events.forEach(eventType => {
    taskItem.addEventListener(eventType, (e) => {
        console.log(`📅 ${eventType}:`, {
            target: e.target.className,
            timestamp: Date.now(),
            mode: ModeManager.getCurrentMode()
        });
    }, { capture: true }); // Log in capture phase to see order
});
```

---

## Common Pitfalls

### Pitfall 1: Assuming Event Order

**Problem:**
```javascript
// ❌ WRONG: Assumes click fires before focusin
button.addEventListener('click', () => {
    isClicked = true;
});

taskItem.addEventListener('focusin', () => {
    if (!isClicked) {
        showOptions();
    }
});
```

**Why It Fails:**
- `focusin` fires BEFORE `click` in the event flow
- Timing varies by browser

**Solution:**
```javascript
// ✅ CORRECT: Mode-based logic, not timing assumptions
taskItem.addEventListener('focusin', () => {
    if (ModeManager.isThreeDotsMode()) {
        // In this mode, only clicks should reveal
        return;
    }
    showOptions();
});
```

### Pitfall 2: Multiple Inline Style Manipulations

**Problem:**
```javascript
// ❌ BAD: Many handlers directly set styles
function showOptions() {
    taskOptions.style.visibility = "visible";
    taskOptions.style.opacity = "1";
}

function hideOptions() {
    taskOptions.style.visibility = "hidden";
    taskOptions.style.opacity = "0";
}

function focusShowOptions() {
    taskOptions.style.visibility = "visible";
    taskOptions.style.opacity = "1";
}
```

**Why It Fails:**
- Duplicated logic
- Inconsistent between handlers
- Hard to change visibility logic globally
- No single source of truth

**Solution:**
```javascript
// ✅ GOOD: Centralized visibility controller
class TaskOptionsController {
    static setVisibility(taskItem, visible, caller) {
        const options = taskItem.querySelector('.task-options');
        if (!options) return;

        console.log(`👁️ ${caller}: visibility → ${visible}`);

        options.style.visibility = visible ? "visible" : "hidden";
        options.style.opacity = visible ? "1" : "0";
        options.style.pointerEvents = visible ? "auto" : "none";
    }

    static show(taskItem, caller) {
        this.setVisibility(taskItem, true, caller);
    }

    static hide(taskItem, caller) {
        this.setVisibility(taskItem, false, caller);
    }
}

// All handlers use centralized controller
function showOptions(taskItem) {
    TaskOptionsController.show(taskItem, 'mouseenter');
}
```

### Pitfall 3: Reading Computed Styles for State

**Problem:**
```javascript
// ❌ WRONG: Computed style includes CSS :hover pseudo-classes
const computedStyle = window.getComputedStyle(taskOptions);
const isVisible = computedStyle.visibility === "visible";

// This might be true due to CSS :hover rules, not actual inline state!
```

**Why It Fails:**
- `getComputedStyle()` includes CSS pseudo-class states (`:hover`, `:focus`)
- Can't distinguish between inline styles and CSS rules
- Creates false positives

**Solution:**
```javascript
// ✅ CORRECT: Check inline styles only
const isVisible = taskOptions.style.visibility === "visible";

// Or maintain explicit state
class VisibilityState {
    constructor() {
        this.visible = false;
    }

    show() {
        this.visible = true;
        this.applyToDOM();
    }

    isVisible() {
        return this.visible;  // Explicit state, not DOM-derived
    }
}
```

### Pitfall 4: No Mode Documentation

**Problem:**
```javascript
// ❌ BAD: No documentation of when handler runs
taskItem.addEventListener('focusin', showOptions);
```

**Why It Fails:**
- Future developers don't know the intent
- Mode changes break undocumented assumptions
- Hard to debug when handler should/shouldn't run

**Solution:**
```javascript
// ✅ GOOD: Clear documentation
/**
 * Show task options on focus
 *
 * MODE BEHAVIOR:
 * - HOVER MODE: Shows options (keyboard accessibility)
 * - THREE-DOTS MODE: Skipped (only button controls visibility)
 *
 * REASON: In three-dots mode, explicit button clicks should be
 * the only way to reveal options. Focus would compete with the
 * toggle logic and cause race conditions.
 */
taskItem.addEventListener('focusin', (e) => {
    if (ModeManager.isThreeDotsMode()) return;
    showOptions(taskItem);
});
```

### Pitfall 5: Missing Cleanup on Mode Switch

**Problem:**
```javascript
// ❌ BAD: Mode changes but handlers don't update
function enableThreeDotsMode() {
    document.body.classList.add('show-three-dots-enabled');
    // Handlers still attached from hover mode!
}
```

**Why It Fails:**
- Old handlers keep running in new mode
- Creates hybrid behavior
- Unpredictable state

**Solution:**
```javascript
// ✅ GOOD: Clean up on mode transition
function enableThreeDotsMode() {
    // Update mode flag
    document.body.classList.add('show-three-dots-enabled');

    // Hide all currently visible options (reset state)
    document.querySelectorAll('.task-options[style*="visible"]').forEach(opt => {
        opt.style.visibility = 'hidden';
        opt.style.opacity = '0';
        opt.style.pointerEvents = 'none';
    });

    console.log('✅ Switched to three-dots mode, reset all visibility');
}

// Handlers check mode on each event (don't need re-attachment)
taskItem.addEventListener('mouseenter', () => {
    if (ModeManager.isThreeDotsMode()) return;  // Skip in new mode
    showOptions();
});
```

---

## Debugging Strategies

### Strategy 1: Event Flow Logging

Add comprehensive logging to trace event order:

```javascript
// Add this during debugging
const DEBUG_EVENTS = true;

function logEvent(eventName, details = {}) {
    if (!DEBUG_EVENTS) return;

    console.log(`📅 [${eventName}]`, {
        timestamp: Date.now(),
        mode: ModeManager.getCurrentMode(),
        ...details
    });
}

// Usage in handlers
taskItem.addEventListener('focusin', (e) => {
    logEvent('focusin', {
        target: e.target.className,
        currentVisibility: taskOptions.style.visibility
    });

    if (ModeManager.isThreeDotsMode()) {
        logEvent('focusin-skipped', { reason: 'three-dots mode' });
        return;
    }

    // Handle event...
});
```

### Strategy 2: State Snapshot Logging

Log full state before and after changes:

```javascript
function revealTaskButtons(taskItem) {
    const BEFORE = {
        inlineVisibility: taskOptions.style.visibility,
        computedVisibility: window.getComputedStyle(taskOptions).visibility,
        mode: ModeManager.getCurrentMode()
    };

    console.log('🔍 BEFORE revealTaskButtons:', BEFORE);

    // Toggle logic...

    const AFTER = {
        inlineVisibility: taskOptions.style.visibility,
        computedVisibility: window.getComputedStyle(taskOptions).visibility,
        mode: ModeManager.getCurrentMode()
    };

    console.log('✅ AFTER revealTaskButtons:', AFTER);
}
```

### Strategy 3: Breakpoint on Attribute Mutation

Use DOM breakpoints to catch unexpected changes:

```javascript
// In browser DevTools Console:
// 1. Right-click the .task-options element
// 2. Break on → Attribute modifications
// 3. Trigger the bug
// 4. Debugger pauses when style attribute changes
// 5. Check call stack to see what handler modified it
```

### Strategy 4: Event Listener Audit

Find all listeners on an element:

```javascript
// Paste in DevTools Console
function getEventListeners(element) {
    // Chrome/Edge only - shows all attached listeners
    return getEventListeners(element);
}

// Or use manual tracking
const listenerRegistry = new Map();

function trackListener(element, eventType, handler, description) {
    const key = `${element.id || 'unknown'}-${eventType}`;
    if (!listenerRegistry.has(key)) {
        listenerRegistry.set(key, []);
    }

    listenerRegistry.get(key).push({
        handler,
        description,
        attachedAt: new Date().toISOString()
    });

    element.addEventListener(eventType, handler);
}

// Usage
trackListener(taskItem, 'focusin', handleFocusIn, 'Keyboard accessibility');
trackListener(taskItem, 'mouseenter', handleMouseEnter, 'Hover mode reveal');

// Later, audit what's attached
console.table(Array.from(listenerRegistry.entries()));
```

### Strategy 5: Mode Transition Logging

Log all mode changes:

```javascript
class ModeManager {
    static _currentMode = 'hover';

    static setMode(newMode) {
        const oldMode = this._currentMode;

        if (oldMode === newMode) {
            console.log(`ℹ️ Mode already ${newMode}, no change`);
            return;
        }

        console.log(`🔄 MODE TRANSITION: ${oldMode} → ${newMode}`, {
            timestamp: Date.now(),
            triggeredBy: new Error().stack.split('\n')[2] // Call stack
        });

        this._currentMode = newMode;

        // Trigger cleanup/setup as needed
        this._onModeChange(oldMode, newMode);
    }

    static getCurrentMode() {
        return this._currentMode;
    }

    static _onModeChange(oldMode, newMode) {
        console.log(`🧹 Cleaning up ${oldMode} mode...`);
        console.log(`🚀 Initializing ${newMode} mode...`);

        // Reset UI state, clear conflicting handlers, etc.
    }
}
```

---

## Conclusion

### Key Takeaways

1. **Mode awareness is critical** - Every event handler must check if it should run in the current mode
2. **Centralize state management** - Don't scatter DOM manipulation across handlers ✅ **IMPLEMENTED**
3. **Document event flow** - Future developers (including you!) need to understand the interaction model
4. **Log liberally during debugging** - Comprehensive logging reveals timing issues and race conditions
5. **Test mode transitions** - Ensure clean state when switching between operational modes

### Implementation Status

✅ **TaskOptionsVisibilityController is now live in miniCycle v1.359**

All task options visibility changes now route through the centralized controller:
- **Location**: `miniCycle-scripts.js:2974-3047`
- **Usage**: All 6 event handlers (focusin, focusout, mouseenter, mouseleave, three-dots, focus)
- **Benefits**: Single source of truth, mode-aware permissions, consistent logging

**To use in new features:**
```javascript
// Show task options
TaskOptionsVisibilityController.show(taskItem, 'your-handler-name');

// Hide task options
TaskOptionsVisibilityController.hide(taskItem, 'your-handler-name');

// Check current mode
const mode = TaskOptionsVisibilityController.getMode(); // 'hover' | 'three-dots'
```

### When to Apply These Patterns

Use mode-aware coordination when:
- Multiple event types control the same UI element
- You have explicit operational modes (hover vs click, auto vs manual, etc.)
- Timing/order of events matters
- Debugging reveals race conditions or conflicting handlers
- Adding new interaction patterns to existing features

### Further Reading

- [UNDO_REDO_ARCHITECTURE.md](./UNDO_REDO_ARCHITECTURE.md) - State management patterns
- [DEVELOPER_DOCUMENTATION.md](../developer-guides/DEVELOPER_DOCUMENTATION.md) - Module system
- [APPINIT_EXPLAINED.md](./APPINIT_EXPLAINED.md) - 2-phase initialization patterns

---

**Document History:**
- v1.1 (Nov 15, 2025): Added implementation status - TaskOptionsVisibilityController now live
- v1.0 (Nov 15, 2025): Initial version based on three-dots debugging session
