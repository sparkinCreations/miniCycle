/**
 * miniCycle Task DOM Patch Module
 *
 * Handles DOM patching operations for task elements without full re-renders.
 * Extracted from taskDOM.js for better separation of concerns.
 *
 * Operations:
 * - patchTask: Update specific fields on a task element (O(1))
 * - removeTask: Remove a task from DOM (O(1))
 * - applyTaskOrder: Reorder tasks without full re-render
 * - syncBoundaryMarkers: Update first/last task CSS markers
 *
 * @module task/taskDOMPatch
 * @version 1.0.0
 * @see {@link module:task/taskDOM} - Main DOM manager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskDOMPatch', {
    sanitizeInput: optional(null),
    AppState: optional(null)
});

/**
 * Task DOM Patch operations
 * Handles patching individual task elements without full re-renders
 */
export class TaskDOMPatch {
    /**
     * @param {Object} dependencies - Injected dependencies
     * @param {Function} [dependencies.sanitizeInput] - Input sanitization function
     */
    constructor(dependencies = {}) {
        this.deps = di.resolve(dependencies);
    }

    /**
     * Patch a single task's DOM to reflect state changes (O(1) operation).
     * @param {string} taskId - Task ID to patch
     * @param {Object} taskData - Current task data from state
     * @param {string[]} [changedFields] - Specific fields that changed (for optimization)
     * @returns {boolean} True if patched successfully
     */
    patchTask(taskId, taskData, changedFields = null) {
        const taskElement = document.querySelector(DATA_SELECTORS.taskById(taskId));
        if (!taskElement) {
            console.warn(`🎨 patchTask: Task element not found for ${taskId}`);
            return false;
        }

        try {
            // If no specific fields, patch all common fields
            const fields = changedFields || ['completed', 'text', 'highPriority', 'dueDate', 'recurring', 'remindersEnabled'];

            fields.forEach(field => {
                switch (field) {
                    case 'completed':
                        this._patchCompleted(taskElement, taskData);
                        break;
                    case 'text':
                        this._patchText(taskElement, taskData);
                        break;
                    case 'highPriority':
                        this._patchHighPriority(taskElement, taskData);
                        break;
                    case 'dueDate':
                        this._patchDueDate(taskElement, taskData);
                        break;
                    case 'recurring':
                        this._patchRecurring(taskElement, taskData);
                        break;
                    case 'remindersEnabled':
                        this._patchReminders(taskElement, taskData);
                        break;
                    case 'priorityColor':
                        this._patchPriorityColor(taskElement, taskData);
                        break;
                    case 'deleteWhenComplete':
                        this._patchDeleteWhenComplete(taskElement, taskData);
                        break;
                }
            });

            return true;
        } catch (error) {
            console.error(`🎨 patchTask failed for ${taskId}:`, error);
            return false;
        }
    }

    /**
     * Patch completed state
     * @private
     */
    _patchCompleted(taskElement, taskData) {
        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = taskData.completed || false;
        }
        taskElement.classList.toggle(DOM_CLASSES.COMPLETED, taskData.completed || false);
    }

    /**
     * Patch task text
     * @private
     */
    _patchText(taskElement, taskData) {
        const taskLabel = taskElement.querySelector(DOM_SELECTORS.TASK_TEXT);
        if (taskLabel) {
            const sanitized = this.deps.sanitizeInput?.(taskData.text) || taskData.text;
            // Preserve child elements (e.g., recurring indicator icon)
            const firstTextNode = taskLabel.firstChild;
            if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
                firstTextNode.textContent = sanitized;
            } else {
                taskLabel.insertBefore(document.createTextNode(sanitized), taskLabel.firstChild);
            }
        }
    }

    /**
     * Patch high priority state
     * @private
     */
    _patchHighPriority(taskElement, taskData) {
        const isHighPriority = taskData.highPriority || false;
        taskElement.classList.toggle(DOM_CLASSES.HIGH_PRIORITY, isHighPriority);

        // Apply or clear per-task priority color via CSS custom property
        if (isHighPriority && taskData.priorityColor) {
            taskElement.style.setProperty('--task-priority-color', taskData.priorityColor);
        } else if (!isHighPriority) {
            taskElement.style.removeProperty('--task-priority-color');
        }

        const priorityBtn = taskElement.querySelector(DOM_SELECTORS.PRIORITY_BTN);
        if (priorityBtn) {
            priorityBtn.classList.toggle(DOM_CLASSES.PRIORITY_ACTIVE, isHighPriority);
            priorityBtn.setAttribute('aria-pressed', String(isHighPriority));
        }
    }

    /**
     * Patch priority color only (when highPriority itself didn't change)
     * @private
     */
    _patchPriorityColor(taskElement, taskData) {
        if (taskData.highPriority && taskData.priorityColor) {
            taskElement.style.setProperty('--task-priority-color', taskData.priorityColor);
        } else {
            taskElement.style.removeProperty('--task-priority-color');
        }
    }

    /**
     * Patch due date display
     * @private
     */
    _patchDueDate(taskElement, taskData) {
        const dueDateSpan = taskElement.querySelector(DOM_SELECTORS.DUE_DATE);
        if (dueDateSpan) {
            if (taskData.dueDate) {
                const date = new Date(taskData.dueDate);
                dueDateSpan.textContent = date.toLocaleDateString();
                dueDateSpan.classList.remove(DOM_CLASSES.HIDDEN);
            } else {
                dueDateSpan.textContent = '';
                dueDateSpan.classList.add(DOM_CLASSES.HIDDEN);
            }
        }
    }

    /**
     * Patch recurring state
     * @private
     */
    _patchRecurring(taskElement, taskData) {
        const isRecurring = taskData.recurring || false;
        taskElement.classList.toggle(DOM_CLASSES.RECURRING, isRecurring);

        const recurringBtn = taskElement.querySelector(DOM_SELECTORS.RECURRING_BTN);
        if (recurringBtn) {
            recurringBtn.classList.toggle(DOM_CLASSES.ACTIVE, isRecurring);
            recurringBtn.setAttribute('aria-pressed', String(isRecurring));
        }

        // Add or remove recurring icon from task label
        const taskLabel = taskElement.querySelector(DOM_SELECTORS.TASK_TEXT);
        if (taskLabel) {
            const existingIcon = taskLabel.querySelector(DOM_SELECTORS.RECURRING_INDICATOR);
            if (isRecurring && !existingIcon) {
                const icon = document.createElement('span');
                icon.className = 'recurring-indicator';
                icon.innerHTML = `<span class="icon" aria-hidden="true">${ICONS['sync-alt']}</span>`;
                taskLabel.appendChild(icon);
            } else if (!isRecurring && existingIcon) {
                existingIcon.remove();
            }
        }
    }

    /**
     * Patch reminders state
     * @private
     */
    _patchReminders(taskElement, taskData) {
        const reminderBtn = taskElement.querySelector(DOM_SELECTORS.ENABLE_TASK_REMINDERS);
        if (reminderBtn) {
            reminderBtn.classList.toggle(DOM_CLASSES.REMINDER_ACTIVE, taskData.remindersEnabled || false);
            reminderBtn.setAttribute('aria-pressed', String(taskData.remindersEnabled || false));
        }
    }

    /**
     * Patch delete-when-complete state
     * @private
     */
    _patchDeleteWhenComplete(taskElement, taskData) {
        const isActive = taskData.deleteWhenComplete || false;
        const isRecurring = taskData.recurring || false;

        const dwcBtn = taskElement.querySelector(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
        if (dwcBtn) {
            dwcBtn.classList.toggle(DOM_CLASSES.ACTIVE, isActive);
            dwcBtn.classList.toggle(DOM_CLASSES.DELETE_WHEN_COMPLETE_ACTIVE, isActive);
            dwcBtn.setAttribute('aria-pressed', String(isActive));
        }

        // Sync task element data attribute and visual indicator classes
        taskElement.dataset.deleteWhenComplete = String(isActive);
        if (!isRecurring) {
            const state = this.deps.AppState?.get?.();
            const activeCycleId = state?.appState?.activeCycleId;
            const isToDoMode = state?.data?.cycles?.[activeCycleId]?.deleteCheckedTasks === true;
            if (isToDoMode) {
                taskElement.classList.remove(DOM_CLASSES.SHOW_DELETE_INDICATOR);
                taskElement.classList.toggle(DOM_CLASSES.KEPT_TASK, !isActive);
            } else {
                taskElement.classList.toggle(DOM_CLASSES.SHOW_DELETE_INDICATOR, isActive);
                taskElement.classList.remove(DOM_CLASSES.KEPT_TASK);
            }
        }
    }

    /**
     * Remove a task from the DOM (O(1) operation).
     * @param {string} taskId - Task ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeTask(taskId) {
        const taskElement = document.querySelector(DATA_SELECTORS.taskById(taskId));
        if (!taskElement) {
            console.warn(`🎨 removeTask: Task element not found for ${taskId}`);
            return false;
        }

        taskElement.remove();
        return true;
    }

    /**
     * Reorder tasks in DOM without full re-render.
     * @param {string[]} taskIds - Task IDs in desired order
     * @returns {boolean} True if reordered successfully
     */
    applyTaskOrder(taskIds) {
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) {
            console.warn('🎨 applyTaskOrder: taskList not found');
            return false;
        }

        // Build a map of existing elements
        const elementMap = new Map();
        taskList.querySelectorAll(DOM_SELECTORS.TASK_BY_ID).forEach(el => {
            elementMap.set(el.dataset.taskId, el);
        });

        // Create document fragment in new order
        const fragment = document.createDocumentFragment();
        let reorderNeeded = false;

        taskIds.forEach((taskId, index) => {
            const element = elementMap.get(taskId);
            if (element) {
                // Check if reorder is actually needed
                const currentIndex = Array.from(taskList.children).indexOf(element);
                if (currentIndex !== index) {
                    reorderNeeded = true;
                }
                fragment.appendChild(element);
            }
        });

        if (reorderNeeded) {
            // Atomic swap - single reflow
            taskList.replaceChildren(fragment);
        }

        return true;
    }

    /**
     * Sync first/last task boundary markers (O(1) operation)
     * Used for CSS-driven arrow visibility
     */
    syncBoundaryMarkers() {
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) return;

        // Remove old markers (O(1) - at most one of each)
        taskList.querySelector(DOM_SELECTORS.IS_FIRST_TASK)?.classList.remove(DOM_CLASSES.IS_FIRST_TASK);
        taskList.querySelector(DOM_SELECTORS.IS_LAST_TASK)?.classList.remove(DOM_CLASSES.IS_LAST_TASK);

        // Find first/last INCOMPLETE tasks (skip completed — their arrows are hidden)
        const tasks = Array.from(taskList.children).filter(el =>
            el.classList.contains(DOM_CLASSES.TASK) && !el.querySelector(DOM_SELECTORS.TASK_INPUT_CHECKED)
        );

        const firstTask = tasks[0] || null;
        const lastTask = tasks.length > 1 ? tasks[tasks.length - 1] : null;

        if (firstTask) {
            firstTask.classList.add(DOM_CLASSES.IS_FIRST_TASK);
        }
        if (lastTask && lastTask !== firstTask) {
            lastTask.classList.add(DOM_CLASSES.IS_LAST_TASK);
        }
    }
}

