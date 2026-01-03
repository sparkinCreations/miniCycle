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

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskDOMPatch', {
    sanitizeInput: optional(null)
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
     * Patch a single task's DOM to reflect state changes (O(1) operation)
     * @param {string} taskId - Task ID to patch
     * @param {Object} taskData - Current task data from state
     * @param {string[]} [changedFields] - Specific fields that changed (for optimization)
     * @returns {boolean} True if patched successfully
     */
    patchTask(taskId, taskData, changedFields = null) {
        const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
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
                    case 'deleteWhenComplete':
                        this._patchDeleteWhenComplete(taskElement, taskData);
                        break;
                }
            });

            console.log(`🎨 Patched task ${taskId}:`, changedFields || 'all fields');
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
        taskElement.classList.toggle('completed', taskData.completed || false);
    }

    /**
     * Patch task text
     * @private
     */
    _patchText(taskElement, taskData) {
        const label = taskElement.querySelector('label');
        if (label) {
            const sanitized = this.deps.sanitizeInput?.(taskData.text) || taskData.text;
            label.textContent = sanitized;
        }
    }

    /**
     * Patch high priority state
     * @private
     */
    _patchHighPriority(taskElement, taskData) {
        taskElement.classList.toggle('high-priority', taskData.highPriority || false);

        const priorityBtn = taskElement.querySelector('.priority-btn');
        if (priorityBtn) {
            priorityBtn.classList.toggle('priority-active', taskData.highPriority || false);
            priorityBtn.setAttribute('aria-pressed', String(taskData.highPriority || false));
        }
    }

    /**
     * Patch due date display
     * @private
     */
    _patchDueDate(taskElement, taskData) {
        const dueDateSpan = taskElement.querySelector('.due-date');
        if (dueDateSpan) {
            if (taskData.dueDate) {
                const date = new Date(taskData.dueDate);
                dueDateSpan.textContent = date.toLocaleDateString();
                dueDateSpan.classList.remove('hidden');
            } else {
                dueDateSpan.textContent = '';
                dueDateSpan.classList.add('hidden');
            }
        }
    }

    /**
     * Patch recurring state
     * @private
     */
    _patchRecurring(taskElement, taskData) {
        taskElement.classList.toggle('recurring', taskData.recurring || false);

        const recurringBtn = taskElement.querySelector('.recurring-btn');
        if (recurringBtn) {
            recurringBtn.classList.toggle('active', taskData.recurring || false);
            recurringBtn.setAttribute('aria-pressed', String(taskData.recurring || false));
        }
    }

    /**
     * Patch reminders state
     * @private
     */
    _patchReminders(taskElement, taskData) {
        const reminderBtn = taskElement.querySelector('.enable-task-reminders');
        if (reminderBtn) {
            reminderBtn.classList.toggle('reminder-active', taskData.remindersEnabled || false);
            reminderBtn.setAttribute('aria-pressed', String(taskData.remindersEnabled || false));
        }
    }

    /**
     * Patch delete-when-complete state
     * @private
     */
    _patchDeleteWhenComplete(taskElement, taskData) {
        const dwcBtn = taskElement.querySelector('.delete-when-complete-btn');
        if (dwcBtn) {
            const isActive = taskData.deleteWhenComplete || false;
            dwcBtn.classList.toggle('active', isActive);
            dwcBtn.setAttribute('aria-pressed', String(isActive));
        }
    }

    /**
     * Remove a task from the DOM (O(1) operation)
     * @param {string} taskId - Task ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeTask(taskId) {
        const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
        if (!taskElement) {
            console.warn(`🎨 removeTask: Task element not found for ${taskId}`);
            return false;
        }

        taskElement.remove();
        console.log(`🎨 Removed task ${taskId} from DOM`);
        return true;
    }

    /**
     * Reorder tasks in DOM without full re-render
     * @param {string[]} taskIds - Task IDs in desired order
     * @returns {boolean} True if reordered successfully
     */
    applyTaskOrder(taskIds) {
        const taskList = document.getElementById('taskList');
        if (!taskList) {
            console.warn('🎨 applyTaskOrder: taskList not found');
            return false;
        }

        // Build a map of existing elements
        const elementMap = new Map();
        taskList.querySelectorAll('.task[data-task-id]').forEach(el => {
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
            console.log(`🎨 Reordered ${taskIds.length} tasks`);
        }

        return true;
    }

    /**
     * Sync first/last task boundary markers (O(1) operation)
     * Used for CSS-driven arrow visibility
     */
    syncBoundaryMarkers() {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;

        // Remove old markers (O(1) - at most one of each)
        taskList.querySelector('.is-first-task')?.classList.remove('is-first-task');
        taskList.querySelector('.is-last-task')?.classList.remove('is-last-task');

        // Add new markers
        const firstTask = taskList.firstElementChild;
        const lastTask = taskList.lastElementChild;

        if (firstTask?.classList.contains('task')) {
            firstTask.classList.add('is-first-task');
        }
        if (lastTask?.classList.contains('task') && lastTask !== firstTask) {
            lastTask.classList.add('is-last-task');
        }
    }
}

console.log('🔧 TaskDOMPatch module loaded');
