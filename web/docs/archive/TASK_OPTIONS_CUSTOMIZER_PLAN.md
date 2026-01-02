# Task Options Customizer - Implementation Guide

> **✅ STATUS: COMPLETED** (Version 1.357 - November 2025)
> **Implementation**: `/modules/ui/taskOptionsCustomizer.js` (635 lines)
> **Tests**: `/tests/taskOptionsCustomizer.tests.js` (29 tests - 100% passing)
> **Test Coverage**: Integrated into test suite (1458/1458 tests passing)

---

## Implementation Summary

Successfully implemented as planned with the following enhancements:

✅ **Core Features**:
- `-/+` customize button on every task (always visible)
- Per-cycle button visibility customization modal
- Real-time changes (no save button needed - checkbox changes apply immediately)
- Global vs. cycle-scoped options (moveArrows & threeDots are global)
- Synchronization with settings panel and reminders modal

✅ **Technical Achievements**:
- Clean dependency injection architecture
- Full AppState integration with Schema 2.5
- Comprehensive test coverage (29 tests)
- Mobile-optimized responsive modal
- Dark mode + theme support (Dark Ocean, Golden Glow)

✅ **Files Added**:
- `modules/ui/taskOptionsCustomizer.js` - Core module
- `tests/taskOptionsCustomizer.tests.js` - Test suite
- Modal CSS styling in `miniCycle-styles.css` (+844 lines)
- DEFAULT_TASK_OPTION_BUTTONS constant in `globalUtils.js`

---

## Original Plan

## Overview

This feature adds a `-/+` customize button that allows users to show/hide task option buttons per cycle. Each cycle remembers its customized button visibility settings.

## Current Implementation Analysis

### How Task Buttons Are Currently Created

Location: `modules/task/taskDOM.js` - `createTaskButtonContainer()` method (lines ~650-680)

```javascript
const buttons = [
    { class: "move-up", icon: "▲", show: true },
    { class: "move-down", icon: "▼", show: true },
    { class: "recurring-btn", icon: "<i class='fas fa-repeat'></i>", show: showRecurring || (settings.alwaysShowRecurring || false) },
    { class: "set-due-date", icon: "<i class='fas fa-calendar-alt'></i>", show: !autoResetEnabled },
    { class: "enable-task-reminders", icon: "<i class='fas fa-bell'></i>", show: remindersEnabled || remindersEnabledGlobal, toggle: true },
    { class: "priority-btn", icon: "<i class='fas fa-exclamation-triangle'></i>", show: true },
    { class: "edit-btn", icon: "<i class='fas fa-edit'></i>", show: true },
    { class: "delete-btn", icon: "<i class='fas fa-trash'></i>", show: true }
];
```

### Current Issues

- Button visibility is hardcoded based on mode/settings
- Users can’t customize what they see
- Logic scattered across multiple conditions

-----

## Implementation Plan

### Phase 1: Data Schema (30 mins)

#### 1.1 Add to Schema 2.5

**File:** Update cycle data structure in AppState

```javascript
// Default button visibility for new cycles
const DEFAULT_TASK_OPTION_BUTTONS = {
    customize: true,        // -/+ button (always visible, can't disable)
    moveUp: false,          // ▲ Move up arrow
    moveDown: false,        // ▼ Move down arrow
    highPriority: true,     // ⚡ High priority toggle
    rename: true,           // ✏️ Rename/edit task
    delete: true,           // 🗑️ Delete task
    recurring: false,       // 🔁 Recurring task
    dueDate: false,         // 📅 Due date
    reminders: false        // 🔔 Reminders
};

// In cycle data structure
{
    "cycles": {
        "morning-routine": {
            "id": "morning-routine",
            "title": "Morning Routine",
            "tasks": [...],
            "mode": "auto",
            "taskOptionButtons": {
                "customize": true,
                "moveUp": false,
                "moveDown": false,
                "highPriority": true,
                "rename": true,
                "delete": true,
                "recurring": false,
                "dueDate": false,
                "reminders": false
            }
        }
    }
}
```

#### 1.2 Migration Code

**File:** `modules/cycle/migrationManager.js`

```javascript
/**
 * Migrate existing cycles to include taskOptionButtons
 */
function migrateToTaskOptionButtons(cycleData) {
    if (!cycleData.taskOptionButtons) {
        cycleData.taskOptionButtons = { ...DEFAULT_TASK_OPTION_BUTTONS };
        console.log(`✅ Migrated cycle "${cycleData.title}" to include taskOptionButtons`);
    }
    return cycleData;
}

// Call this in the migration chain
function migrateAllCycles(schemaData) {
    const cycles = schemaData.data?.cycles || {};
    Object.keys(cycles).forEach(cycleId => {
        cycles[cycleId] = migrateToTaskOptionButtons(cycles[cycleId]);
    });
    return schemaData;
}
```

#### 1.3 Update Cycle Creation

**File:** `modules/cycle/cycleManager.js`

```javascript
// In createNewMiniCycle() or similar function
function createNewCycle(title) {
    return {
        id: generateId(title),
        title: title,
        tasks: [],
        mode: 'manual',
        cycleCount: 0,
        taskOptionButtons: { ...DEFAULT_TASK_OPTION_BUTTONS }  // ← ADD THIS
    };
}
```

-----

### Phase 2: New Module - TaskOptionsCustomizer (2 hours)

**File:** `modules/ui/taskOptionsCustomizer.js`

```javascript
/**
 * @module taskOptionsCustomizer
 * @version 1.348
 * @pattern Simple Instance 🎯
 * @description Manages customization of task option button visibility per cycle
 */

import { appInit } from '../core/appInit.js';

// Default visibility settings
export const DEFAULT_TASK_OPTION_BUTTONS = {
    customize: true,
    moveUp: false,
    moveDown: false,
    highPriority: true,
    rename: true,
    delete: true,
    recurring: false,
    dueDate: false,
    reminders: false
};

// Button configuration with labels and icons
const BUTTON_CONFIG = [
    { 
        key: 'customize', 
        label: 'Customize Options', 
        icon: '⋯', 
        disabled: true,
        description: 'Always visible - opens this customization menu'
    },
    { 
        key: 'moveUp', 
        label: 'Move Task Up', 
        icon: '▲',
        description: 'Reorder task upward in list'
    },
    { 
        key: 'moveDown', 
        label: 'Move Task Down', 
        icon: '▼',
        description: 'Reorder task downward in list'
    },
    { 
        key: 'highPriority', 
        label: 'High Priority Toggle', 
        icon: '⚡',
        description: 'Mark task as high priority'
    },
    { 
        key: 'rename', 
        label: 'Rename Task', 
        icon: '✏️',
        description: 'Edit task text'
    },
    { 
        key: 'delete', 
        label: 'Delete Task', 
        icon: '🗑️',
        description: 'Remove task from list'
    },
    { 
        key: 'recurring', 
        label: 'Recurring Task', 
        icon: '🔁',
        description: 'Schedule task to repeat automatically'
    },
    { 
        key: 'dueDate', 
        label: 'Set Due Date', 
        icon: '📅',
        description: 'Add deadline to task'
    },
    { 
        key: 'reminders', 
        label: 'Task Reminders', 
        icon: '🔔',
        description: 'Set notification reminders'
    }
];

export class TaskOptionsCustomizer {
    constructor(deps = {}) {
        this.deps = {
            AppState: deps.AppState || window.AppState,
            showNotification: deps.showNotification || window.showNotification,
            getElementById: deps.getElementById || ((id) => document.getElementById(id)),
            querySelector: deps.querySelector || ((sel) => document.querySelector(sel))
        };
        
        console.log('✅ TaskOptionsCustomizer initialized');
    }

    /**
     * Show customization modal for a specific cycle
     */
    async showCustomizationModal(cycleId) {
        await appInit.waitForCore();
        
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready');
            return;
        }

        const state = this.deps.AppState.get();
        const cycle = state.data.cycles[cycleId];
        
        if (!cycle) {
            console.error(`❌ Cycle not found: ${cycleId}`);
            return;
        }

        const currentOptions = cycle.taskOptionButtons || { ...DEFAULT_TASK_OPTION_BUTTONS };
        
        // Create and show modal
        this.createModal(cycleId, cycle.title, currentOptions);
    }

    /**
     * Create the customization modal
     */
    createModal(cycleId, cycleTitle, currentOptions) {
        // Remove any existing modal
        const existing = this.deps.getElementById('task-options-customizer-modal');
        if (existing) existing.remove();

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'task-options-customizer-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content task-options-modal">
                <div class="modal-header">
                    <h2>⚙️ Customize Task Options</h2>
                    <p class="modal-subtitle">Choose which buttons appear for tasks in "${cycleTitle}"</p>
                </div>
                
                <div class="modal-body">
                    <div class="task-options-list">
                        ${this.buildOptionsList(currentOptions)}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button id="reset-task-options-btn" class="secondary-button">
                        🔄 Reset to Default
                    </button>
                    <button id="cancel-task-options-btn" class="secondary-button">
                        Cancel
                    </button>
                    <button id="save-task-options-btn" class="primary-button">
                        ✅ Save & Apply
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach event listeners
        this.attachModalListeners(modal, cycleId);

        // Show modal with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * Build the options list HTML
     */
    buildOptionsList(currentOptions) {
        return BUTTON_CONFIG.map(option => {
            const isChecked = currentOptions[option.key] ?? DEFAULT_TASK_OPTION_BUTTONS[option.key];
            const isDisabled = option.disabled || false;
            
            return `
                <label class="task-option-item ${isDisabled ? 'disabled' : ''}">
                    <div class="option-checkbox-container">
                        <input 
                            type="checkbox" 
                            data-option="${option.key}" 
                            ${isChecked ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                            class="option-checkbox"
                        >
                        <span class="custom-checkbox"></span>
                    </div>
                    <div class="option-content">
                        <div class="option-header">
                            <span class="option-icon">${option.icon}</span>
                            <span class="option-label">${option.label}</span>
                            ${isDisabled ? '<span class="always-visible-badge">Always Visible</span>' : ''}
                        </div>
                        <div class="option-description">${option.description}</div>
                    </div>
                </label>
            `;
        }).join('');
    }

    /**
     * Attach event listeners to modal elements
     */
    attachModalListeners(modal, cycleId) {
        const saveBtn = modal.querySelector('#save-task-options-btn');
        const cancelBtn = modal.querySelector('#cancel-task-options-btn');
        const resetBtn = modal.querySelector('#reset-task-options-btn');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        // Save button
        saveBtn.addEventListener('click', () => {
            this.saveCustomization(cycleId, checkboxes);
            this.closeModal(modal);
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            this.closeModal(modal);
        });

        // Reset button
        resetBtn.addEventListener('click', () => {
            this.resetToDefaults(checkboxes);
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Save customization to AppState
     */
    async saveCustomization(cycleId, checkboxes) {
        const newOptions = {};
        
        checkboxes.forEach(cb => {
            newOptions[cb.dataset.option] = cb.checked;
        });

        // Ensure customize button is always enabled
        newOptions.customize = true;

        // Save to AppState
        this.deps.AppState.update(state => {
            if (state.data.cycles[cycleId]) {
                state.data.cycles[cycleId].taskOptionButtons = newOptions;
            }
        });

        // Refresh all task buttons in the UI
        this.refreshAllTaskButtons();

        this.deps.showNotification?.('✅ Task options updated', 'success', 2000);
        
        console.log(`✅ Saved task option customization for cycle: ${cycleId}`, newOptions);
    }

    /**
     * Reset all checkboxes to default values
     */
    resetToDefaults(checkboxes) {
        checkboxes.forEach(cb => {
            const defaultValue = DEFAULT_TASK_OPTION_BUTTONS[cb.dataset.option];
            cb.checked = defaultValue ?? false;
        });
        
        this.deps.showNotification?.('🔄 Reset to defaults', 'info', 2000);
    }

    /**
     * Close and remove modal
     */
    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300); // Wait for fade-out animation
    }

    /**
     * Refresh task button visibility for all tasks
     */
    refreshAllTaskButtons() {
        // This will be called by taskDOM when re-rendering
        // Or we can manually update visibility of existing buttons
        const tasks = document.querySelectorAll('.task');
        
        tasks.forEach(taskElement => {
            this.updateTaskButtonVisibility(taskElement);
        });
    }

    /**
     * Update button visibility for a single task element
     */
    updateTaskButtonVisibility(taskElement) {
        const state = this.deps.AppState.get();
        const activeCycleId = state.appState.activeCycleId;
        const cycle = state.data.cycles[activeCycleId];
        
        if (!cycle?.taskOptionButtons) return;

        const visibleOptions = cycle.taskOptionButtons;
        const buttonContainer = taskElement.querySelector('.task-options');
        
        if (!buttonContainer) return;

        // Update each button's visibility
        const buttonMap = {
            'move-up': 'moveUp',
            'move-down': 'moveDown',
            'priority-btn': 'highPriority',
            'edit-btn': 'rename',
            'delete-btn': 'delete',
            'recurring-btn': 'recurring',
            'set-due-date': 'dueDate',
            'enable-task-reminders': 'reminders'
        };

        Object.entries(buttonMap).forEach(([btnClass, optionKey]) => {
            const button = buttonContainer.querySelector(`.${btnClass}`);
            if (button) {
                const shouldShow = visibleOptions[optionKey] ?? false;
                if (shouldShow) {
                    button.classList.remove('hidden');
                } else {
                    button.classList.add('hidden');
                }
            }
        });
    }

    /**
     * Get button visibility settings for a cycle
     */
    getButtonVisibility(cycleId) {
        const state = this.deps.AppState?.get?.();
        if (!state) return { ...DEFAULT_TASK_OPTION_BUTTONS };

        const cycle = state.data.cycles[cycleId];
        return cycle?.taskOptionButtons || { ...DEFAULT_TASK_OPTION_BUTTONS };
    }
}

// ============================================
// Global Instance
// ============================================

let taskOptionsCustomizer = null;

/**
 * Initialize the task options customizer
 */
export function initTaskOptionsCustomizer(dependencies = {}) {
    if (taskOptionsCustomizer) {
        console.warn('⚠️ TaskOptionsCustomizer already initialized');
        return taskOptionsCustomizer;
    }

    taskOptionsCustomizer = new TaskOptionsCustomizer(dependencies);
    
    // Export to window for easy access
    window.taskOptionsCustomizer = taskOptionsCustomizer;
    window.TaskOptionsCustomizer = TaskOptionsCustomizer;
    window.DEFAULT_TASK_OPTION_BUTTONS = DEFAULT_TASK_OPTION_BUTTONS;
    
    return taskOptionsCustomizer;
}

export { taskOptionsCustomizer };

console.log('✅ TaskOptionsCustomizer module loaded');
```

-----

### Phase 3: Update TaskDOM Module (1 hour)

**File:** `modules/task/taskDOM.js`

Update the `createTaskButtonContainer()` method:

```javascript
/**
 * Create task button container with customizable button visibility
 */
createTaskButtonContainer(taskContext) {
    const {
        autoResetEnabled, deleteCheckedEnabled, settings,
        remindersEnabled, remindersEnabledGlobal, assignedTaskId,
        currentCycle, recurring, highPriority
    } = taskContext;

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("task-options");

    // ✅ NEW: Get button visibility settings for this cycle
    const visibleOptions = currentCycle.taskOptionButtons || window.DEFAULT_TASK_OPTION_BUTTONS || {};

    // ✅ NEW: Always show customize button first
    const customizeBtn = this.createCustomizeButton(currentCycle.id);
    buttonContainer.appendChild(customizeBtn);

    // ✅ UPDATED: Button configuration with visibility checks
    const buttons = [
        { 
            class: "move-up", 
            icon: "▲", 
            show: visibleOptions.moveUp ?? false 
        },
        { 
            class: "move-down", 
            icon: "▼", 
            show: visibleOptions.moveDown ?? false 
        },
        { 
            class: "priority-btn", 
            icon: "<i class='fas fa-exclamation-triangle'></i>", 
            show: visibleOptions.highPriority ?? true 
        },
        { 
            class: "edit-btn", 
            icon: "<i class='fas fa-edit'></i>", 
            show: visibleOptions.rename ?? true 
        },
        { 
            class: "delete-btn", 
            icon: "<i class='fas fa-trash'></i>", 
            show: visibleOptions.delete ?? true 
        },
        { 
            class: "recurring-btn", 
            icon: "<i class='fas fa-repeat'></i>", 
            show: visibleOptions.recurring ?? false 
        },
        { 
            class: "set-due-date", 
            icon: "<i class='fas fa-calendar-alt'></i>", 
            show: visibleOptions.dueDate ?? false 
        },
        { 
            class: "enable-task-reminders", 
            icon: "<i class='fas fa-bell'></i>", 
            show: visibleOptions.reminders ?? false,
            toggle: true 
        }
    ];

    buttons.forEach(buttonConfig => {
        const button = this.createTaskButton(buttonConfig, taskContext, buttonContainer);
        buttonContainer.appendChild(button);
    });

    return buttonContainer;
}

/**
 * ✅ NEW: Create the customize button (-/+)
 */
createCustomizeButton(cycleId) {
    const button = document.createElement("button");
    button.classList.add("task-btn", "customize-btn");
    button.innerHTML = "⋯"; // Three dots icon
    button.setAttribute("type", "button");
    button.setAttribute("title", "Customize task options");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-label", "Customize which task option buttons are visible");

    // Click handler
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.taskOptionsCustomizer) {
            window.taskOptionsCustomizer.showCustomizationModal(cycleId);
        } else {
            console.warn('⚠️ TaskOptionsCustomizer not initialized');
        }
    });

    // Keyboard handler
    button.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            button.click();
        }
    });

    return button;
}
```

-----

### Phase 4: CSS Styling (30 mins)

**File:** `miniCycle-styles.css`

```css
/* ================================================
   TASK OPTIONS CUSTOMIZER MODAL
   ================================================ */

.task-options-modal {
    max-width: 600px;
    width: 90%;
}

.task-options-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 8px;
}

.task-option-item {
    display: flex;
    align-items: flex-start;
    padding: 16px;
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 16px;
}

.task-option-item:hover:not(.disabled) {
    background: #e7f3ff;
    border-color: #4c79ff;
    transform: translateX(4px);
}

.task-option-item.disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: #f1f3f5;
}

.option-checkbox-container {
    position: relative;
    flex-shrink: 0;
    margin-top: 2px;
}

.option-checkbox {
    width: 24px;
    height: 24px;
    cursor: pointer;
}

.option-checkbox:disabled {
    cursor: not-allowed;
}

.option-content {
    flex: 1;
}

.option-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.option-icon {
    font-size: 1.2em;
    min-width: 24px;
    text-align: center;
}

.option-label {
    font-weight: 600;
    font-size: 1em;
    color: #212529;
}

.option-description {
    font-size: 0.875em;
    color: #6c757d;
    margin-top: 4px;
    line-height: 1.4;
}

.always-visible-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #ffc107;
    color: #212529;
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Customize button styling */
.task-btn.customize-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: bold;
    font-size: 1.2em;
    padding: 6px 10px;
    border: none;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.task-btn.customize-btn:hover {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.task-btn.customize-btn:active {
    transform: scale(0.95);
}

/* Dark mode styles */
body.dark-mode .task-option-item {
    background: #2c3e50;
    border-color: #34495e;
}

body.dark-mode .task-option-item:hover:not(.disabled) {
    background: #34495e;
    border-color: #667eea;
}

body.dark-mode .task-option-item.disabled {
    background: #1a252f;
}

body.dark-mode .option-label {
    color: #ecf0f1;
}

body.dark-mode .option-description {
    color: #95a5a6;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
    .task-options-modal {
        width: 95%;
        max-width: none;
    }

    .task-option-item {
        padding: 12px;
    }

    .option-label {
        font-size: 0.95em;
    }

    .option-description {
        font-size: 0.8em;
    }
}
```

-----

### Phase 5: Integration (30 mins)

**File:** `miniCycle-scripts.js`

Add initialization:

```javascript
// After other module initializations (around line 300-400)

// ✅ Initialize Task Options Customizer
console.log('🔄 Initializing task options customizer...');
try {
    const { initTaskOptionsCustomizer } = await import(withV('./modules/ui/taskOptionsCustomizer.js'));
    
    await initTaskOptionsCustomizer({
        AppState: window.AppState,
        showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur),
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel)
    });
    
    console.log('✅ Task options customizer initialized');
} catch (error) {
    console.error('❌ Failed to initialize task options customizer:', error);
}
```

-----

### Phase 6: Testing Checklist

**Manual Testing:**

- [ ] Create new cycle - verify default buttons show (⋯, ⚡, ✏️, 🗑️)
- [ ] Click ⋯ button - customization modal opens
- [ ] Toggle buttons on/off - verify checkboxes work
- [ ] Click “Save & Apply” - buttons update immediately
- [ ] Create another task - verify button visibility persists
- [ ] Switch to different cycle - verify different settings load
- [ ] Switch back - verify original settings preserved
- [ ] Click “Reset to Default” - verify defaults restore
- [ ] Close modal with Cancel - verify no changes saved
- [ ] Close modal with ESC key - verify no changes saved
- [ ] Close modal by clicking overlay - verify no changes saved

**Edge Cases:**

- [ ] Disable all buttons except customize - verify customize always shows
- [ ] Try to uncheck customize button - verify it’s disabled
- [ ] Load old cycle without taskOptionButtons - verify defaults applied
- [ ] Export/import cycle - verify settings preserved

-----

### Phase 7: Update Service Worker

**File:** `service-worker.js`

Add new module to cache:

```javascript
var UTILITIES = [
  // ... existing modules ...
  './modules/ui/taskOptionsCustomizer.js',
  // ... rest of modules ...
];
```

-----

## Benefits of This Implementation

### For Users:

✅ Full control over UI complexity
✅ Per-routine customization
✅ No confusion about missing buttons
✅ Clean, personalized interface

### For You (Developer):

✅ Removes mode-based button visibility logic
✅ Simpler, data-driven code
✅ Easier to add new task options
✅ Better architecture

### For Architecture:

✅ Data stored in cycle (proper separation of concerns)
✅ Per-cycle state (each routine independent)
✅ Sensible defaults (works great out of box)
✅ Migration-friendly (existing cycles get defaults)

-----

## Future Enhancements

1. **Presets:** Add “Minimal”, “Power User”, “Shopping List” presets
1. **Button Reordering:** Drag to reorder buttons
1. **Global Default:** “Use these settings for all new cycles”
1. **Quick Toggle:** Long-press ⋯ for quick enable/disable
1. **Export Settings:** Include in .mcyc file format

-----

## Estimated Implementation Time

- Phase 1 (Schema): 30 mins
- Phase 2 (Module): 2 hours
- Phase 3 (TaskDOM): 1 hour
- Phase 4 (CSS): 30 mins
- Phase 5 (Integration): 30 mins
- Phase 6 (Testing): 1 hour

**Total: ~5.5 hours**

-----

This implementation gives users full control while simplifying your codebase. Ready to proceed?