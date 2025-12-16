/**
 * Task UI Module (DI-Pure)
 *
 * Handles task list UI operations including:
 * - Task list refresh from state
 * - Task options visibility (show/hide on hover/focus)
 * - Complete all button visibility
 *
 * Pattern: Simple Instance ✨
 * - Single responsibility (task UI operations)
 * - Required dependencies via diBase.js
 *
 * @module modules/ui/taskUI
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskUI', {
    // For refreshTaskListUI
    loadMiniCycleData: optional(null),
    addTask: optional(null),
    updateRecurringButtonVisibility: optional(null),
    getElementById: optional(null),

    // For checkCompleteAllButton
    getTaskList: optional(null),
    getCompleteAllButton: optional(null),

    // For touch detection
    isTouchDevice: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskUI module
 * @param {Object} dependencies - Injected dependencies
 */
export function setTaskUIDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎯 TaskUI dependencies set:', Object.keys(dependencies));
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * TASK OPTIONS VISIBILITY CONTROLLER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Centralized controller for task options visibility state.
 * Coordinates between multiple interaction modes (hover, three-dots, focus)
 * to prevent race conditions and conflicting behavior.
 *
 * MODES:
 * - HOVER MODE: Options show on mouseenter/focusin, hide on mouseleave/focusout
 * - THREE-DOTS MODE: Options show ONLY on three-dots button click (manual toggle)
 *
 * See: docs/architecture/EVENT_FLOW_PATTERNS.md for complete documentation
 * ═══════════════════════════════════════════════════════════════════
 */
export class TaskOptionsVisibilityController {
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

        // Always allow long-press, regardless of mode
        // This guarantees mobile long-press can reveal options
        // whether three-dots is enabled or not.
        if (caller === 'long-press') {
            return true;
        }

        const permissions = {
            'hover': ['mouseenter', 'mouseleave', 'focusin', 'focusout', 'hideTaskButtons'],
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
            console.warn(`TaskOptionsVisibilityController: No .task-options found for ${caller}`);
            return false;
        }

        // Check if this caller is allowed to change visibility in current mode
        if (!this.canHandle(caller)) {
            console.log(`${caller}: Skipping visibility change in ${this.getMode()} mode`);
            return false;
        }

        // Apply visibility state
        taskOptions.style.visibility = visible ? "visible" : "hidden";
        taskOptions.style.opacity = visible ? "1" : "0";
        taskOptions.style.pointerEvents = visible ? "auto" : "none";

        console.log(`${caller}: visibility -> ${visible ? 'visible' : 'hidden'} (mode: ${this.getMode()})`);
        return true;
    }

    /**
     * Show task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static show(taskItem, caller) {
        return this.setVisibility(taskItem, true, caller);
    }

    /**
     * Hide task options (convenience method)
     * @param {HTMLElement} taskItem - The task element
     * @param {string} caller - Identifier for the event handler
     * @returns {boolean} Whether the visibility was changed
     */
    static hide(taskItem, caller) {
        return this.setVisibility(taskItem, false, caller);
    }
}

/**
 * Refreshes the task list UI from Schema 2.5 state.
 * Clears and re-renders all tasks from the current cycle.
 */
export async function refreshTaskListUI() {
    console.log('Refreshing task list UI (Schema 2.5 only)...');

    const loadMiniCycleData = _deps.loadMiniCycleData;
    if (typeof loadMiniCycleData !== 'function') {
        console.error('refreshTaskListUI: loadMiniCycleData dependency not set');
        return;
    }

    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        console.error('Schema 2.5 data required for refreshTaskListUI');
        throw new Error('Schema 2.5 data not found');
    }

    const { cycles, activeCycle } = schemaData;
    const cycleData = cycles[activeCycle];

    if (!cycleData) {
        console.warn("No active cycle found for UI refresh");
        return;
    }

    // Clear current list
    const getElementById = _deps.getElementById || ((id) => document.getElementById(id));
    const taskListContainer = getElementById("taskList");
    if (!taskListContainer) return;
    taskListContainer.innerHTML = "";

    // Re-render each task from Schema 2.5 (await each to ensure proper settings are loaded)
    const addTask = _deps.addTask;
    if (typeof addTask !== 'function') {
        console.error('refreshTaskListUI: addTask dependency not set');
        return;
    }

    const tasks = cycleData.tasks || [];
    for (const task of tasks) {
        await addTask(
            task.text,
            task.completed,
            false, // Don't double save
            task.dueDate,
            task.highPriority,
            true,  // isLoading (skip overdue reminder immediately)
            task.remindersEnabled,
            task.recurring,
            task.id,
            task.recurringSettings,
            task.deleteWhenComplete,
            task.deleteWhenCompleteSettings
        );
    }

    const updateRecurringButtonVisibility = _deps.updateRecurringButtonVisibility;
    if (typeof updateRecurringButtonVisibility === 'function') {
        updateRecurringButtonVisibility();
    }

    console.log("Task list UI refreshed from Schema 2.5");
}

/**
 * Hides task buttons with mode-aware coordination.
 * Used by hideTaskOptions and dragDropManager.
 * @param {HTMLElement} taskItem - The task element
 */
export function hideTaskButtons(taskItem) {
    if (taskItem.classList.contains("rearranging")) {
        console.log("Skipping hide during task rearrangement");
        return;
    }

    // Don't hide if task is long-pressed (mobile long-press in progress)
    if (taskItem.classList.contains("long-pressed")) {
        console.log("Skipping hide during long-press");
        return;
    }

    // Use centralized controller instead of direct manipulation
    // Controller will check permissions and skip if not allowed in current mode
    // In three-dots mode: hideTaskButtons is NOT in the permissions list,
    // so it won't be able to override the three-dots button's visibility control
    const wasHidden = TaskOptionsVisibilityController.hide(taskItem, 'hideTaskButtons');

    if (!wasHidden) {
        console.log('hideTaskButtons: Skipped by controller (three-dots mode protection)');
        return;
    }

    // Clear individual button inline styles if we successfully hid
    const taskOptions = taskItem.querySelector(".task-options");
    if (taskOptions) {
        const threeDotsEnabled = document.body.classList.contains("show-three-dots-enabled");

        if (threeDotsEnabled) {
            // Three-dots mode: use inline styles to explicitly hide individual buttons
            taskItem.querySelectorAll(".task-btn").forEach(btn => {
                btn.style.visibility = "hidden";
                btn.style.opacity = "0";
                btn.style.pointerEvents = "none";
            });
        } else {
            // Regular hover mode: clear inline styles to let CSS handle it
            taskItem.querySelectorAll(".task-btn").forEach(btn => {
                btn.style.visibility = "";
                btn.style.opacity = "";
                btn.style.pointerEvents = "";
            });
        }
    }
}

/**
 * Shows task options on mouse enter (hover handler).
 * Only shows on desktop or if long-pressed on mobile.
 * @param {Event} event - The mouseenter event
 */
export function showTaskOptions(event) {
    const taskElement = event.currentTarget;

    // Only allow on desktop or if long-pressed on mobile
    const isTouchDevice = _deps.isTouchDevice;
    const isMobile = typeof isTouchDevice === 'function' ? isTouchDevice() : false;
    const allowShow = !isMobile || taskElement.classList.contains("long-pressed");

    console.log('showTaskOptions (hover handler) called:', {
        taskId: taskElement.dataset.id || 'unknown',
        eventType: event.type,
        isMobile,
        isLongPressed: taskElement.classList.contains("long-pressed"),
        allowShow
    });

    if (allowShow) {
        // Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.show(taskElement, 'mouseenter');
    }
}

/**
 * Hides task options on mouse leave (hover handler).
 * Only hides if not long-pressed on mobile.
 * @param {Event} event - The mouseleave event
 */
export function hideTaskOptions(event) {
    const taskElement = event.currentTarget;

    // Only hide if not long-pressed on mobile (so buttons stay open during drag)
    const isTouchDevice = _deps.isTouchDevice;
    const isMobile = typeof isTouchDevice === 'function' ? isTouchDevice() : false;
    const allowHide = !isMobile || !taskElement.classList.contains("long-pressed");

    console.log('hideTaskOptions (mouseleave handler) called:', {
        taskId: taskElement.dataset.id || 'unknown',
        eventType: event.type,
        isMobile,
        isLongPressed: taskElement.classList.contains("long-pressed"),
        allowHide
    });

    if (allowHide) {
        // Use centralized controller (handles mode checking automatically)
        TaskOptionsVisibilityController.hide(taskElement, 'mouseleave');
    }
}

/**
 * Checks if the complete all button should be visible.
 * Shows when there are tasks and not in auto cycle mode.
 */
export function checkCompleteAllButton() {
    const getTaskList = _deps.getTaskList;
    const getCompleteAllButton = _deps.getCompleteAllButton;

    const taskList = typeof getTaskList === 'function' ? getTaskList() : document.getElementById('taskList');
    const completeAllButton = typeof getCompleteAllButton === 'function' ? getCompleteAllButton() : document.getElementById('completeAll');

    if (!taskList || !completeAllButton) {
        // Elements should exist after DOMContentLoaded - warn if missing
        console.warn('checkCompleteAllButton: Required elements not found (taskList:', !!taskList, ', completeAllButton:', !!completeAllButton, ')');
        return;
    }

    const isAutoMode = document.body.classList.contains('auto-cycle-mode');

    if (taskList.children.length > 0 && !isAutoMode) {
        completeAllButton.style.display = "block";
    } else {
        completeAllButton.style.display = "none";
    }
}

// DI-pure module (no window.* exports)
console.log('TaskUI module loaded (DI-pure, no window.* exports)');
