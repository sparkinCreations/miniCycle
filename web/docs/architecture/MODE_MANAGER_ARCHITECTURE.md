# Mode Manager Architecture

> **Complete guide to miniCycle's mode management system**

**Version**: 1.373
**Last Updated**: November 23, 2025
**Module**: `modules/cycle/modeManager.js` (633 lines)
**Pattern**: Resilient Constructor 🛡️

---

## Table of Contents

1. [Overview](#overview)
2. [Three Operating Modes](#three-operating-modes)
3. [Architecture](#architecture)
4. [UI Refresh Without Reload](#ui-refresh-without-reload)
5. [Mode Switching Flow](#mode-switching-flow)
6. [Task Button Refresh](#task-button-refresh)
7. [State Synchronization](#state-synchronization)
8. [Implementation Details](#implementation-details)
9. [Critical Fixes](#critical-fixes)
10. [Best Practices](#best-practices)

---

## Overview

The **Mode Manager** (`modeManager.js`) controls miniCycle's three fundamental operating modes and manages smooth transitions between them without requiring page reloads. This is a critical system that affects how tasks behave throughout their lifecycle.

### Core Responsibility

**Mode Manager coordinates:**
- Mode selection UI (desktop and mobile selectors)
- Toggle state synchronization (autoReset, deleteCheckedTasks)
- Task button visibility based on current mode
- Mode persistence and restoration after reload
- UI updates without page refresh (v1.372+)

### Key Innovation (v1.372+)

Prior to v1.372, switching modes required a page reload. The Mode Manager now:
- ✅ Refreshes UI in-place without reload
- ✅ Updates task buttons to reflect new mode
- ✅ Syncs all UI elements (selectors, toggles, buttons)
- ✅ Maintains smooth user experience

---

## Three Operating Modes

### 1. Auto Cycle Mode ↻

**Behavior:**
- Tasks automatically reset when all are completed
- Cycle count increments
- Perfect for daily routines and habits

**Settings:**
- `autoReset: true`
- `deleteCheckedTasks: false`

**Use Cases:**
- Morning/evening routines
- Exercise routines
- Daily checklists
- Habit tracking

---

### 2. Manual Cycle Mode ✔︎↻

**Behavior:**
- "Complete Cycle" button appears when all tasks done
- User manually triggers reset
- Allows review before resetting

**Settings:**
- `autoReset: false`
- `deleteCheckedTasks: false`

**Use Cases:**
- Weekly planning reviews
- Project phase completions
- Intentional cycle tracking

---

### 3. To-Do Mode ✓

**Behavior:**
- Completed tasks are deleted (not reset)
- Traditional to-do list behavior
- Recurring tasks enabled for repeating items

**Settings:**
- `autoReset: false`
- `deleteCheckedTasks: true`

**Use Cases:**
- One-time project tasks
- Shopping lists
- Temporary checklists

---

## Architecture

### Class Structure

```javascript
export class ModeManager {
    constructor(dependencies = {}) {
        // Dependency injection for testability
        this.deps = {
            getAppState: dependencies.getAppState || (() => window.AppState),
            loadMiniCycleData: dependencies.loadMiniCycleData,
            createTaskButtonContainer: dependencies.createTaskButtonContainer,
            setupDueDateButtonInteraction: dependencies.setupDueDateButtonInteraction,
            checkCompleteAllButton: dependencies.checkCompleteAllButton,
            showNotification: dependencies.showNotification,
            helpWindowManager: dependencies.helpWindowManager,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Debounce timer for refresh operations
        this.refreshDebounceTimer = null;
        this.isInitialized = false;
    }

    async init() {
        await appInit.waitForCore();
        setTimeout(() => this.setupModeSelector(), 200);
        this.isInitialized = true;
    }
}
```

### Key Methods

#### `getModeName(mode)`
Converts mode identifier to friendly display name.

```javascript
getModeName(mode) {
    const modeNames = {
        'auto-cycle': 'Auto Cycle ↻',
        'manual-cycle': 'Manual Cycle ✔︎↻',
        'todo-mode': 'To-Do Mode ✓'
    };
    return modeNames[mode] || 'Auto Cycle ↻';
}
```

#### `syncModeFromToggles()`
Reads toggle states and updates mode selectors accordingly.

**Critical Fix (v1.373):**
```javascript
// ✅ FIXED: Update DOM to match data
toggleAutoReset.checked = autoReset;
deleteCheckedTasks.checked = deleteChecked;
```

Before this fix, toggles could get out of sync with stored data, causing mode selector to show wrong mode.

#### `refreshTaskButtonsForModeChange()`
Updates all task buttons when mode changes (debounced to 150ms).

**Key Features:**
- Debounced to prevent performance issues during rapid changes
- Re-creates button containers with new mode settings
- Re-attaches event listeners (especially due date buttons)
- Updates recurring button visibility
- Batch operations with summary logging

#### `setupModeSelector()`
Main initialization function that:
1. Attaches event listeners to both desktop and mobile selectors
2. Syncs toggles from mode selector changes
3. Updates storage when settings change
4. Triggers UI refresh
5. Shows notifications

---

## UI Refresh Without Reload

### The Problem (Pre-v1.372)

```javascript
// ❌ OLD: Required page reload
function switchMode(newMode) {
    updateSettings(newMode);
    location.reload();  // Disruptive!
}
```

### The Solution (v1.372+)

```javascript
// ✅ NEW: In-place refresh
async function switchMode(newMode) {
    // 1. Update settings
    updateSettingsFromMode(newMode);

    // 2. Refresh UI in-place
    await refreshTaskButtonsForModeChange();

    // 3. Update recurring visibility
    updateRecurringButtonVisibility();

    // 4. Show confirmation
    showNotification(`Switched to ${getModeName(newMode)}`);
}
```

### Refresh Flow

```
User selects mode
       ↓
syncTogglesFromMode()
       ↓
updateStorageFromToggles()
       ↓
refreshTaskButtonsForModeChange()  [DEBOUNCED 150ms]
       ↓
┌─────────────────────────────────────┐
│ For each task:                      │
│ 1. Get old button container         │
│ 2. Create new container with mode   │
│ 3. Preserve visibility state        │
│ 4. Replace old with new             │
│ 5. Re-attach event listeners        │
└─────────────────────────────────────┘
       ↓
updateRecurringButtonVisibility()
       ↓
checkCompleteAllButton()
       ↓
showNotification("Switched to ...")
```

---

## Mode Switching Flow

### Desktop Mode Selector Change

```javascript
modeSelector.addEventListener('change', (e) => {
    const selectedMode = e.target.value;

    // 1. Sync toggles from mode
    syncTogglesFromMode(selectedMode);

    // 2. Update mode description
    updateCycleModeDescription();

    // 3. Check complete button visibility
    checkCompleteAllButton();

    // 4. Refresh task buttons
    refreshTaskButtonsForModeChange();

    // 5. Update recurring buttons
    setTimeout(() => {
        window.recurringCore?.updateRecurringButtonVisibility();
    }, 100);

    // 6. Show notification
    showNotification(`Switched to ${getModeName(selectedMode)}`);
});
```

### Mobile Mode Selector Change

Identical flow to desktop, but uses `#mobile-mode-selector` element.

### Toggle Change (Direct)

```javascript
toggleAutoReset.addEventListener('change', (e) => {
    // 1. Sync mode from toggles
    syncModeFromToggles();

    // 2. Update description
    updateCycleModeDescription();

    // 3. Update complete button
    checkCompleteAllButton();

    // 4. Refresh task buttons
    refreshTaskButtonsForModeChange();
});
```

---

## Task Button Refresh

### Why Refresh Buttons?

Different modes need different buttons:
- **Cycle modes**: No recurring button (tasks persist)
- **To-Do mode**: Recurring button visible (for repeating to-dos)
- **Mode-specific settings**: Button visibility varies

### Refresh Implementation

```javascript
async refreshTaskButtonsForModeChange() {
    // Clear pending refresh
    if (this.refreshDebounceTimer) {
        clearTimeout(this.refreshDebounceTimer);
    }

    // Debounce to 150ms
    this.refreshDebounceTimer = setTimeout(async () => {
        await appInit.waitForCore();

        const tasks = this.deps.querySelectorAll('.task');
        if (tasks.length === 0) return;

        let successCount = 0;
        let failureCount = 0;

        // Get current mode
        const toggleAutoReset = this.deps.getElementById('toggleAutoReset');
        const deleteCheckedTasks = this.deps.getElementById('deleteCheckedTasks');
        const autoResetEnabled = toggleAutoReset?.checked || false;
        const deleteCheckedEnabled = deleteCheckedTasks?.checked || false;

        // Get current cycle (required for recurring handler)
        const AppState = this.deps.getAppState();
        const currentState = AppState?.get();
        const activeCycleId = currentState?.appState?.activeCycleId;
        const currentCycle = currentState?.data?.cycles?.[activeCycleId];

        tasks.forEach(task => {
            const taskId = task.dataset.taskId;
            const oldButtonContainer = task.querySelector('.task-options');
            if (!oldButtonContainer) {
                failureCount++;
                return;
            }

            // Build task context
            const taskContext = {
                autoResetEnabled,
                deleteCheckedEnabled,
                settings: currentState?.settings || {},
                remindersEnabled: task.querySelector('.enable-task-reminders')?.classList.contains('reminder-active') || false,
                remindersEnabledGlobal: currentState?.reminders?.enabled || false,
                assignedTaskId: taskId,
                currentCycle,        // ✅ Required for recurring button handler
                activeCycle: activeCycleId,
                recurring: task.classList.contains('recurring'),
                highPriority: task.classList.contains('high-priority')
            };

            // Create new button container
            const newButtonContainer = this.deps.createTaskButtonContainer(taskContext);
            if (!newButtonContainer) {
                failureCount++;
                return;
            }

            // Preserve visibility state
            const wasVisible = oldButtonContainer.style.visibility === 'visible' ||
                             oldButtonContainer.style.opacity === '1';
            if (wasVisible) {
                newButtonContainer.style.visibility = 'visible';
                newButtonContainer.style.opacity = '1';
            }

            // Replace old with new
            oldButtonContainer.replaceWith(newButtonContainer);

            // ✅ CRITICAL: Re-attach due date listener
            const dueDateInput = task.querySelector('.due-date');
            if (dueDateInput && this.deps.setupDueDateButtonInteraction) {
                const dueDateButton = newButtonContainer.querySelector('.set-due-date');
                if (dueDateButton) {
                    delete dueDateButton.dataset.listenerAttached;
                }
                this.deps.setupDueDateButtonInteraction(newButtonContainer, dueDateInput);
            }

            successCount++;
        });

        // Summary logging
        if (failureCount > 0) {
            console.warn(`⚠️ ModeManager: Failed to refresh ${failureCount} task button(s), succeeded: ${successCount}`);
        } else {
            console.log(`✅ ModeManager: Task button refresh complete (${successCount} tasks)`);
        }
    }, 150); // 150ms debounce
}
```

---

## State Synchronization

### Mode → Toggles

```javascript
function syncTogglesFromMode(selectedMode) {
    switch(selectedMode) {
        case 'auto-cycle':
            toggleAutoReset.checked = true;
            deleteCheckedTasks.checked = false;
            break;
        case 'manual-cycle':
            toggleAutoReset.checked = false;
            deleteCheckedTasks.checked = false;
            break;
        case 'todo-mode':
            toggleAutoReset.checked = false;
            deleteCheckedTasks.checked = true;
            break;
    }

    // Keep both selectors in sync
    modeSelector.value = selectedMode;
    mobileModeSelector.value = selectedMode;
}
```

### Toggles → Mode

```javascript
async syncModeFromToggles() {
    const AppState = this.deps.getAppState();
    const currentState = AppState?.get();
    const activeCycle = currentState?.appState?.activeCycleId;
    const currentCycle = currentState?.data?.cycles?.[activeCycle];

    let autoReset = false;
    let deleteChecked = false;

    if (currentCycle) {
        autoReset = currentCycle.autoReset || false;
        deleteChecked = currentCycle.deleteCheckedTasks || false;

        // ✅ CRITICAL FIX: Update DOM to match data
        toggleAutoReset.checked = autoReset;
        deleteCheckedTasks.checked = deleteChecked;
    }

    // Determine mode
    let mode = 'auto-cycle';
    if (deleteChecked) {
        mode = 'todo-mode';
    } else if (autoReset && !deleteChecked) {
        mode = 'auto-cycle';
    } else if (!autoReset && !deleteChecked) {
        mode = 'manual-cycle';
    }

    // Update both selectors
    modeSelector.value = mode;
    mobileModeSelector.value = mode;

    // Update body class
    document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
    document.body.classList.add(mode + '-mode');
}
```

---

## Implementation Details

### Initialization Sequence

```javascript
// 1. Module loaded
export async function initModeManager(dependencies = {}) {
    const manager = new ModeManager(dependencies);

    // 2. Wait for core (AppState ready)
    await manager.init();

    // 3. Export globally
    window.modeManager = manager;

    return manager;
}
```

### Mode Restoration After Reload

```javascript
// Check if mode needs restoration
const modeToRestore = sessionStorage.getItem('restoreModeAfterReload');
if (modeToRestore) {
    sessionStorage.removeItem('restoreModeAfterReload');

    setTimeout(() => {
        modeSelector.value = modeToRestore;
        mobileModeSelector.value = modeToRestore;
        this.syncModeFromToggles();
        this.updateCycleModeDescription();

        if (this.deps.showNotification) {
            this.deps.showNotification(`✅ Switched to ${this.getModeName(modeToRestore)}`, 'success', 3000);
        }
    }, 500);
}
```

### Debouncing Pattern

```javascript
// Prevent performance issues from rapid mode changes
this.refreshDebounceTimer = setTimeout(async () => {
    // Refresh logic...
}, 150);
```

**Why 150ms?**
- Prevents forced reflows during rapid clicks
- Allows multiple changes to batch together
- Still feels instant to users (<200ms threshold)

---

## Critical Fixes

### v1.373: Mode Sync Fix

**Problem:**
DOM toggles could get out of sync with stored data, causing wrong mode to display.

**Solution:**
```javascript
// ✅ FIX (modeManager.js:248-250)
toggleAutoReset.checked = autoReset;
deleteCheckedTasks.checked = deleteChecked;
```

**Impact:**
Mode selector now always reflects true data state.

### v1.372: Recurring Button Visibility

**Problem:**
Recurring buttons didn't update immediately when switching to/from to-do mode.

**Solution:**
```javascript
setTimeout(() => {
    window.recurringCore?.updateRecurringButtonVisibility();
}, 100);
```

**Impact:**
Button visibility updates correctly within 100ms of mode change.

### v1.372: Due Date Listener Re-attachment

**Problem:**
Due date buttons stopped working after mode switch.

**Solution:**
```javascript
// ✅ CRITICAL: Remove guard flag before re-attaching
const dueDateButton = newButtonContainer.querySelector('.set-due-date');
if (dueDateButton) {
    delete dueDateButton.dataset.listenerAttached;
}
this.deps.setupDueDateButtonInteraction(newButtonContainer, dueDateInput);
```

**Impact:**
All button interactions work correctly after refresh.

---

## Best Practices

### When Adding New Modes

1. **Update `getModeName()`** with new mode display name
2. **Add case to `syncTogglesFromMode()`** for toggle mapping
3. **Update mode detection logic** in `syncModeFromToggles()`
4. **Add body class** for CSS targeting
5. **Update documentation** (USER_GUIDE.md, this doc)
6. **Write tests** for new mode behavior

### When Modifying Task Buttons

1. **Always use `refreshTaskButtonsForModeChange()`** - don't manipulate directly
2. **Preserve visibility state** when replacing containers
3. **Re-attach all event listeners** after replacement
4. **Check for null/undefined** before accessing properties
5. **Log failures** for debugging

### Testing Mode Switches

```javascript
// Test all transitions
const modes = ['auto-cycle', 'manual-cycle', 'todo-mode'];
modes.forEach(fromMode => {
    modes.forEach(toMode => {
        if (fromMode !== toMode) {
            test(`Switch from ${fromMode} to ${toMode}`, () => {
                setMode(fromMode);
                setMode(toMode);
                expect(getMode()).toBe(toMode);
                expect(taskButtonsCorrect()).toBe(true);
            });
        }
    });
});
```

---

## Related Documentation

- [USER_GUIDE.md](../user-guides/USER_GUIDE.md) - User-facing mode documentation
- [SCHEMA_2_5.md](../data-schema/SCHEMA_2_5.md) - Data schema with mode settings
- [TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md) - Button customization system
- [EVENT_FLOW_PATTERNS.md](./EVENT_FLOW_PATTERNS.md) - UI state management patterns

---

**Mode Manager Architecture** - Seamless mode switching without page reloads

Built by [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
