# Delete When Complete (Auto-Remove) - Implementation Plan

> **📋 STATUS: PLANNED** (Target: Version 1.358+)
> **Type**: New Feature - Task Lifecycle Management
> **Complexity**: Medium
> **Estimated Time**: 4-6 hours

---

## Overview

Add a "Delete When Complete" task option that automatically removes completed tasks during the next auto-reset cycle. This feature provides users with granular control over task persistence and complements the existing recurring task system.

### Key Concept
- **Immediate deletion**: Use trash icon (existing behavior)
- **Deferred deletion**: Use "Delete When Complete" button (new feature)
- Deletion occurs during auto-reset, allowing for undo if needed

---

## Use Cases

1. **One-off tasks in Auto-Cycle mode**: Tasks that should disappear after completion (e.g., "Call dentist", "Buy milk")
2. **To-Do mode ephemeral tasks**: Tasks that naturally clean themselves up
3. **Recurring task requirement**: Recurring tasks MUST be deleted to recur (auto-enabled, with warning if disabled)

---

## Behavior Specification

### Mode-Specific Defaults

| Mode | Default Behavior | User Control |
|------|-----------------|--------------|
| **To-Do Mode** | Delete when complete = ON | Toggleable (can keep tasks) |
| **Cycle Modes (Auto/Manual)** | Delete when complete = OFF | Toggleable per task |

### Special Cases

#### Recurring Tasks
- **Auto-enabled**: All recurring tasks have "Delete When Complete" = ON by default
- **Protection**: If user tries to disable it, show confirmation modal:
  ```
  ⚠️ Warning: Disabling auto-remove on recurring tasks

  This task is set to recur, but it won't recur if it stays in the list.

  Are you sure you want to disable auto-remove?

  [Keep Auto-Remove] [Disable Anyway]
  ```

#### Visual Indicators

1. **Cycle mode with "Delete When Complete" ON (non-recurring)**:
   - Show red X indicator (❌ or ✕) on task
   - Only visible on incomplete tasks

2. **To-Do mode with "Delete When Complete" OFF**:
   - Show pin icon (📌) to indicate "kept" status
   - Inverse indicator showing exception to default

3. **Recurring tasks**:
   - No indicator needed (always delete by design)

---

## Schema 2.5 Changes

### Task Properties

Add new boolean property to task schema:

```javascript
// In each task object
{
  id: "task-123",
  text: "Buy groceries",
  completed: false,
  deleteWhenComplete: false,  // ← NEW PROPERTY
  highPriority: false,
  recurring: false,
  remindersEnabled: false,
  dueDate: null,
  // ... other properties
}
```

### Cycle Settings (Optional - for future use)

```javascript
// Per cycle settings (for future customization)
{
  cycles: {
    "morning-routine": {
      settings: {
        deleteWhenCompleteDefault: false  // Different per mode
      }
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Schema & Data Structure (1 hour)

#### 1.1 Add to DEFAULT_TASK_OPTION_BUTTONS
**File**: `modules/utils/globalUtils.js`

```javascript
export const DEFAULT_TASK_OPTION_BUTTONS = {
    customize: true,
    moveUp: false,
    moveDown: false,
    highPriority: true,
    rename: true,
    delete: true,
    recurring: false,
    dueDate: false,
    reminders: false,
    deleteWhenComplete: false  // ← NEW: Default OFF, opt-in via customizer
};
```

#### 1.2 Task Creation Default
**File**: `modules/task/taskDOM.js` - `createMainTaskElement()`

Add to new task creation:
```javascript
const taskData = {
    id: generateId('task'),
    text: taskText,
    completed: false,
    deleteWhenComplete: false,  // ← NEW: Default false
    // ... other properties
};
```

#### 1.3 Migration Handler
**File**: `modules/data/migrationManager.js` or inline in cycle loader

Add property to existing tasks:
```javascript
// Ensure all existing tasks have the property
tasks.forEach(task => {
    if (task.deleteWhenComplete === undefined) {
        task.deleteWhenComplete = false;
    }
});
```

---

### Phase 2: UI - Task Option Button (1.5 hours)

#### 2.1 Add Button to Task DOM
**File**: `modules/task/taskDOM.js` - `createTaskButtonContainer()`

Add to buttons array:
```javascript
const buttons = [
    // ... existing buttons ...
    {
        class: "delete-when-complete-btn",
        icon: "<i class='fas fa-times-circle'></i>",  // Red X icon
        show: buttonVisibility.deleteWhenComplete,
        toggle: true,  // Toggle button like recurring/reminders
        ariaLabel: "Auto-remove when complete"
    }
];
```

#### 2.2 Button Styling
**File**: `miniCycle-styles.css`

```css
/* Delete When Complete Button */
.delete-when-complete-btn {
    background-color: transparent;
    color: #666;
    border: 1px solid transparent;
    transition: all 0.2s ease;
}

.delete-when-complete-btn:hover {
    color: #dc3545;
    border-color: #dc3545;
}

.delete-when-complete-btn.active {
    background-color: #dc3545;
    color: white;
    border-color: #dc3545;
}

/* Visual indicator on tasks */
.task.delete-when-complete::after {
    content: "✕";
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #dc3545;
    font-weight: bold;
    font-size: 14px;
    opacity: 0.6;
}

/* Pin indicator for kept tasks in To-Do mode */
.task.kept-task::after {
    content: "📌";
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    opacity: 0.6;
}

/* Dark mode adjustments */
body.dark-mode .delete-when-complete-btn {
    color: #aaa;
}

body.dark-mode .delete-when-complete-btn:hover {
    color: #ff6b6b;
    border-color: #ff6b6b;
}

body.dark-mode .delete-when-complete-btn.active {
    background-color: #dc3545;
    color: white;
}
```

#### 2.3 Setup Button Accessibility
**File**: `modules/task/taskDOM.js` - `setupButtonAccessibility()`

Add to ARIA labels:
```javascript
const ariaLabels = {
    // ... existing labels ...
    "delete-when-complete-btn": "Auto-remove when complete"
};
```

---

### Phase 3: Event Handlers & Logic (1.5 hours)

#### 3.1 Toggle Handler
**File**: `modules/task/taskEvents.js` - New method

```javascript
/**
 * Handle delete-when-complete button click
 * @param {HTMLElement} button - The button element
 * @param {HTMLElement} taskItem - The task element
 */
async handleDeleteWhenCompleteToggle(button, taskItem) {
    const taskId = taskItem.dataset.id;

    // Check if this is a recurring task
    const isRecurring = taskItem.classList.contains('recurring-task');
    const isActive = button.classList.contains('active');

    // If trying to disable on a recurring task, show warning
    if (isRecurring && isActive) {
        const confirmed = await this.showRecurringWarning();
        if (!confirmed) {
            return; // User cancelled
        }
    }

    // Toggle state
    const newState = !isActive;

    // Update UI
    button.classList.toggle('active', newState);
    button.setAttribute('aria-pressed', newState.toString());
    taskItem.classList.toggle('delete-when-complete', newState);

    // Save to AppState
    await this.saveDeleteWhenCompleteState(taskId, newState);

    // Show notification
    const message = newState
        ? "✓ Task will be removed on next reset"
        : "Task will remain after completion";
    this.deps.showNotification?.(message, 'success', 3000);
}

/**
 * Show warning modal for disabling delete-when-complete on recurring task
 * @returns {Promise<boolean>} True if user confirmed
 */
async showRecurringWarning() {
    return new Promise((resolve) => {
        const modal = this.deps.showConfirmationModal?.(
            "⚠️ Warning: Disabling auto-remove on recurring tasks",
            "This task is set to recur, but it won't recur if it stays in the list.\n\nAre you sure you want to disable auto-remove?",
            {
                confirmText: "Disable Anyway",
                cancelText: "Keep Auto-Remove",
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            }
        );
    });
}

/**
 * Save delete-when-complete state to AppState
 * @param {string} taskId - Task ID
 * @param {boolean} enabled - Whether to delete when complete
 */
async saveDeleteWhenCompleteState(taskId, enabled) {
    if (!this.deps.AppState?.update) {
        console.warn('AppState not available');
        return;
    }

    this.deps.AppState.update(state => {
        const activeCycleId = state.appState.activeCycleId;
        const cycle = state.data.cycles[activeCycleId];

        if (!cycle) return;

        const task = cycle.tasks.find(t => t.id === taskId);
        if (task) {
            task.deleteWhenComplete = enabled;
        }

        state.metadata.lastModified = Date.now();
    }, true); // immediate save
}
```

#### 3.2 Wire Up Event Listeners
**File**: `modules/task/taskEvents.js` - `handleTaskButtonClick()`

Add case for delete-when-complete:
```javascript
handleTaskButtonClick(event) {
    const button = event.target.closest('.task-btn');
    if (!button) return;

    const taskItem = button.closest('.task');
    if (!taskItem) return;

    // ... existing button handlers ...

    if (button.classList.contains('delete-when-complete-btn')) {
        this.handleDeleteWhenCompleteToggle(button, taskItem);
        return;
    }
}
```

---

### Phase 4: Auto-Reset Integration (1 hour)

#### 4.1 Modify Auto-Reset Logic
**File**: `modules/cycle/cycleManager.js` - `handleAutoCycleReset()` or similar

```javascript
async handleAutoCycleReset() {
    const state = this.deps.AppState.get();
    const activeCycleId = state.appState.activeCycleId;
    const cycle = state.data.cycles[activeCycleId];

    if (!cycle) return;

    // Track deleted tasks for notification
    let deletedCount = 0;
    const tasksToKeep = [];

    cycle.tasks.forEach(task => {
        // Delete completed tasks marked for deletion
        if (task.completed && task.deleteWhenComplete) {
            deletedCount++;
            // Don't add to tasksToKeep - effectively deleting it
        } else {
            // Reset incomplete tasks or keep completed ones not marked for deletion
            if (!task.deleteWhenComplete) {
                task.completed = false; // Reset as usual
            }
            tasksToKeep.push(task);
        }
    });

    // Update tasks array
    this.deps.AppState.update(state => {
        const cycle = state.data.cycles[activeCycleId];
        cycle.tasks = tasksToKeep;
        state.metadata.lastModified = Date.now();
    }, true);

    // Show notification
    if (deletedCount > 0) {
        const message = `🗑️ Removed ${deletedCount} completed task${deletedCount > 1 ? 's' : ''}`;
        this.deps.showNotification?.(message, 'info', 4000);
    }

    // Refresh UI
    this.deps.refreshUI?.();
}
```

---

### Phase 5: Recurring Task Auto-Enable (30 mins)

#### 5.1 Auto-Enable on Recurring Task Creation
**File**: Wherever recurring tasks are created

```javascript
// When enabling recurring on a task
function enableRecurringOnTask(taskId) {
    // ... existing recurring logic ...

    // Auto-enable delete-when-complete
    this.deps.AppState.update(state => {
        const activeCycleId = state.appState.activeCycleId;
        const cycle = state.data.cycles[activeCycleId];
        const task = cycle.tasks.find(t => t.id === taskId);

        if (task) {
            task.deleteWhenComplete = true;  // Auto-enable for recurring
        }

        state.metadata.lastModified = Date.now();
    }, true);

    // Update button visual state
    const taskElement = document.querySelector(`[data-id="${taskId}"]`);
    const deleteBtn = taskElement?.querySelector('.delete-when-complete-btn');
    if (deleteBtn) {
        deleteBtn.classList.add('active');
        deleteBtn.setAttribute('aria-pressed', 'true');
    }
}
```

---

### Phase 6: Visual Indicators (30 mins)

#### 6.1 Apply Visual Classes
**File**: `modules/task/taskDOM.js` - `createMainTaskElement()`

```javascript
// Add appropriate classes based on state
if (deleteWhenComplete && !recurring) {
    taskElement.classList.add('delete-when-complete');
}

// Check mode for kept-task indicator
const mode = this.getCurrentMode();
if (mode === 'todo-mode' && !deleteWhenComplete) {
    taskElement.classList.add('kept-task');
}
```

---

### Phase 7: Task Options Customizer Integration (30 mins)

#### 7.1 Add to Customizer Modal
**File**: `modules/ui/taskOptionsCustomizer.js` - `buildOptionsHTML()`

The button already integrates automatically if added to DEFAULT_TASK_OPTION_BUTTONS.

Ensure proper labels:
```javascript
const optionLabels = {
    // ... existing labels ...
    deleteWhenComplete: {
        label: "Auto-remove",
        description: "Delete task when completed during auto-reset",
        icon: "fas fa-times-circle"
    }
};
```

---

## Testing Plan

### Unit Tests

**File**: `tests/deleteWhenComplete.tests.js` (new file)

```javascript
// Test coverage:
1. Toggle delete-when-complete on/off
2. Auto-enable on recurring tasks
3. Warning modal appears when disabling on recurring
4. Auto-reset deletes marked tasks
5. Auto-reset keeps unmarked tasks
6. Mode-specific defaults (To-Do vs Cycle)
7. Visual indicators appear correctly
8. Schema property persists across reloads
9. Migration adds property to existing tasks
10. Undo/Redo preserves deleteWhenComplete state
```

### Manual Testing Checklist

- [ ] Create task in Cycle mode, enable delete-when-complete, complete it, verify deletion on reset
- [ ] Create task in To-Do mode, verify default is ON
- [ ] Disable in To-Do mode, verify pin indicator appears
- [ ] Enable recurring, verify delete-when-complete auto-enables
- [ ] Try to disable on recurring task, verify warning appears
- [ ] Complete multiple tasks with mixed settings, verify correct deletions
- [ ] Check visual indicators in light/dark mode
- [ ] Test on mobile (button accessibility)
- [ ] Verify Schema 2.5 data structure
- [ ] Test undo/redo with delete-when-complete changes

---

## Edge Cases & Considerations

### 1. Undo/Redo
- Deleting tasks during reset should be undoable
- Consider capturing pre-reset snapshot

### 2. Import/Export
- Ensure deleteWhenComplete property is preserved
- Handle imported tasks without the property (default to false)

### 3. Mode Switching
- User switches from To-Do → Cycle mode
- Keep individual task settings, don't reset to mode defaults

### 4. Recurring + Delete When Complete
- If user disables delete-when-complete on recurring task
- Task won't recur (as designed)
- Consider showing badge "Won't recur" on such tasks

### 5. Performance
- Large task lists (100+ tasks)
- Filter operation during reset should be fast
- No performance concerns expected

---

## Future Enhancements (Post-MVP)

### Archive System (v1.359+)
- Instead of permanent deletion, move to archive
- Allow recovery of deleted tasks
- Archive management UI

### Bulk Actions
- "Enable auto-remove on all completed tasks"
- "Disable auto-remove on all tasks"

### Smart Defaults
- ML-based suggestions: "You complete this task weekly, make it recurring?"
- Pattern detection for one-off vs persistent tasks

---

## Dependencies

### Required Modules
- `modules/task/taskDOM.js` - Button creation
- `modules/task/taskEvents.js` - Event handling
- `modules/cycle/cycleManager.js` - Auto-reset logic
- `modules/ui/taskOptionsCustomizer.js` - Customization modal
- `modules/utils/globalUtils.js` - Defaults

### Required Tools/APIs
- AppState for data persistence
- Notification system for user feedback
- Confirmation modal for warnings

---

## Migration Path

### For Existing Users

1. **No breaking changes**: Default is OFF (conservative)
2. **Auto-migration**: Add property to all existing tasks
3. **Notification on first launch**:
   ```
   🆕 New Feature: Auto-Remove Tasks

   You can now mark tasks to be automatically removed when completed.
   Enable the "Auto-remove" button in the task customizer.

   [Learn More] [Got It]
   ```

---

## Success Metrics

- Feature adoption rate (% of users enabling the button)
- User feedback on usefulness
- Reduction in manual task deletion actions
- No increase in bug reports related to task persistence

---

## Files to Create/Modify

### New Files
- `tests/deleteWhenComplete.tests.js` - Test suite

### Modified Files
1. `modules/utils/globalUtils.js` - Add to defaults
2. `modules/task/taskDOM.js` - Button creation, visual indicators
3. `modules/task/taskEvents.js` - Event handlers, toggle logic
4. `modules/cycle/cycleManager.js` - Auto-reset integration
5. `modules/ui/taskOptionsCustomizer.js` - Labels/descriptions
6. `miniCycle-styles.css` - Button & indicator styling
7. `modules/data/migrationManager.js` - Property migration (optional)

---

## Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Schema & data structure | 1h | ⏳ Pending |
| 2 | UI button creation | 1.5h | ⏳ Pending |
| 3 | Event handlers & logic | 1.5h | ⏳ Pending |
| 4 | Auto-reset integration | 1h | ⏳ Pending |
| 5 | Recurring auto-enable | 30m | ⏳ Pending |
| 6 | Visual indicators | 30m | ⏳ Pending |
| 7 | Customizer integration | 30m | ⏳ Pending |
| 8 | Testing & polish | 1h | ⏳ Pending |

**Total Estimated Time**: 6 hours

---

## References

- Task Options Customizer: `TASK_OPTIONS_CUSTOMIZER_PLAN.md`
- Schema 2.5: `SCHEMA_2_6_PLAN.md`
- Recurring tasks implementation: `modules/recurring/`
- Auto-reset logic: `modules/cycle/cycleManager.js`

---

**Last Updated**: 2025-01-16
**Author**: miniCycle Development Team
**Version**: 1.0 (Initial Plan)
