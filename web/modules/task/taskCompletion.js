/**
 * miniCycle Task Completion Module
 *
 * Handles task completion state changes, ordering, and persistence.
 * Manages the flow when a user checks/unchecks a task checkbox.
 *
 * Features:
 * - Completion state persistence to AppState
 * - Undo snapshot capture before changes
 * - Task list movement (active ↔ completed)
 * - Recurring task respawn triggering
 * - Overdue task styling updates
 *
 * @module task/taskCompletion
 * @version 1.0.0
 * @see {@link module:task/taskCRUD} - CRUD operations
 * @see {@link module:recurring/recurringWatcher} - Recurring task handling
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskCompletion', {
    appInit: optional(null),
    AppState: optional(null),
    isPerformingUndoRedo: optional(null),
    showNotification: optional(null),
    captureStateSnapshot: optional(null),
    checkOverdueTasks: optional(null),
    handleTaskListMovement: optional(null),
    helpWindowManager: optional(null),
    querySelector: optional(null),
    querySelectorAll: optional(null),
    watchRecurringTasks: optional(null)  // For immediate recurring task respawn
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, isPerformingUndoRedo: Function|null, showNotification: Function|null, captureStateSnapshot: Function|null, checkOverdueTasks: Function|null, handleTaskListMovement: Function|null, helpWindowManager: Object|null, querySelector: Function|null, querySelectorAll: Function|null, watchRecurringTasks: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskCompletion
 * @param {Object} dependencies - Dependencies to inject
 */
export function setTaskCompletionDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('Task Completion dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Wait for core with timeout (for test environment compatibility)
 */
async function waitForCoreWithTimeout() {
    try {
        await Promise.race([
            _deps.appInit?.waitForCore(),
            new Promise((resolve) => setTimeout(resolve, UI_TIMEOUTS.NOTIFICATION_LONG))
        ]);
    } catch (error) {
        console.warn('Core wait: timeout or rejection:', error?.message || 'timeout');
    }
}

/**
 * Helper to resolve getter functions for late-initialized dependencies.
 * @param {*} dep - The dependency (may be a getter function or direct value)
 * @returns {*} The resolved value
 */
function resolveGetter(dep) {
    if (typeof dep === 'function' && dep.length === 0) {
        try {
            return dep();
        } catch {
            return null;
        }
    }
    return dep;
}

// ============================================================================
// COMPLETION OPERATIONS
// ============================================================================

/**
 * Handle task completion checkbox change
 * @param {HTMLInputElement} checkbox - The checkbox element
 * @param {Object} deps - Resolved dependencies
 */
export async function handleTaskCompletionChangeImpl(checkbox, deps = {}) {
    try {
        const taskItem = checkbox.closest(DOM_SELECTORS.TASK);
        const taskId = taskItem?.dataset?.taskId;
        const isCompleted = checkbox.checked;

        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const isPerformingUndoRedo = deps.isPerformingUndoRedo || _deps.isPerformingUndoRedo || (() => false);
        const checkOverdueTasks = deps.checkOverdueTasks || _deps.checkOverdueTasks;
        const handleTaskListMovement = deps.handleTaskListMovement || _deps.handleTaskListMovement;
        const helpWindowManager = deps.helpWindowManager || _deps.helpWindowManager;

        // Capture state snapshot BEFORE making changes (for undo)
        if (typeof captureStateSnapshot === 'function' && !isPerformingUndoRedo()) {
            const currentState = AppState?.get?.();
            if (currentState) {
                captureStateSnapshot(currentState);
                console.log('Captured snapshot before task completion change');
            }
        }

        // Save completion state to AppState (only if taskId exists)
        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        if (taskId) {
            if (AppState?.isReady?.()) {
                await AppState.update(state => {
                    const cid = state.appState?.activeCycleId;
                    const cycle = state.data?.cycles?.[cid];
                    if (!cycle?.tasks) return;

                    const task = cycle.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.completed = isCompleted;
                        console.log(`Task completion saved to AppState: ${task.text} = ${isCompleted}`);
                    }
                }, false); // Don't force immediate save, let debounce handle it
            } else {
                console.warn('⚠️ AppState not ready for task completion save - state may be lost');
            }
        } else {
            console.warn('No task ID found - completion state not saved (DOM update only)');
        }

        // Update DOM classes (always do this, even without taskId for test compatibility)
        if (taskItem) {
            if (isCompleted) {
                taskItem.classList.remove("overdue-task");
            } else {
                // Check if task is overdue
                if (typeof checkOverdueTasks === 'function') {
                    checkOverdueTasks(taskItem);
                }
            }

            // Move task between active and completed lists
            if (typeof handleTaskListMovement === 'function') {
                handleTaskListMovement(taskItem, isCompleted);
            }
        }

        // Update help window if available (DI-pure, no window.* fallback)
        if (helpWindowManager) {
            setTimeout(() => {
                // Resolve fresh inside setTimeout (not stale from outer scope)
                const freshHelpWindowMgr = resolveGetter(helpWindowManager);
                if (freshHelpWindowMgr && typeof freshHelpWindowMgr.updateConstantMessage === 'function') {
                    freshHelpWindowMgr.updateConstantMessage();
                }
            }, UI_TIMEOUTS.STATS_UPDATE_DELAY);
        }

        // ✅ Trigger recurring task check for immediate respawn
        // When a recurring task is completed, check if next occurrence should spawn now
        if (isCompleted && taskItem?.classList.contains('recurring')) {
            const watchRecurringTasks = deps.watchRecurringTasks || _deps.watchRecurringTasks;
            if (typeof watchRecurringTasks === 'function') {
                // Small delay to allow state to settle after completion
                setTimeout(async () => {
                    try {
                        console.log('🔄 Triggering recurring check after task completion...');
                        await watchRecurringTasks();
                    } catch (error) {
                        console.warn('Recurring check after completion failed:', error);
                    }
                }, 100);
            }
        }
    } catch (error) {
        console.warn('Task completion change failed:', error);
        _deps.showNotification?.('Could not update task', 'warning');
    }
}

/**
 * Save current task order after drag & drop
 * @param {Object} deps - Resolved dependencies
 */
export async function saveCurrentTaskOrderImpl(deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const AppState = deps.AppState || _deps.AppState;
        const querySelectorAll = deps.querySelectorAll || _deps.querySelectorAll || ((sel) => document.querySelectorAll(sel));

        const taskElements = querySelectorAll(`#${DOM_IDS.TASK_LIST} ${DOM_SELECTORS.TASK}`);
        const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);

        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                const cid = state.appState.activeCycleId;
                const cycle = state.data.cycles[cid];
                if (!cycle?.tasks) return;

                // Reorder tasks based on DOM order
                const reorderedTasks = newOrderIds.map(id =>
                    cycle.tasks.find(task => task.id === id)
                ).filter(Boolean);

                cycle.tasks = reorderedTasks;
            }, true);
        } else {
            console.warn('⚠️ AppState not ready for saveCurrentTaskOrder - order may be lost');
        }

    } catch (error) {
        console.warn('Save task order failed:', error);
        _deps.showNotification?.('Could not save task order', 'warning');
    }
}

/**
 * Save task data to Schema 2.5 storage
 * ✅ Use AppState only (no localStorage fallback) - DI-pure
 *
 * @param {string} activeCycle - The cycle ID to save
 * @param {object} currentCycle - The cycle data to save
 * @param {Object} deps - Resolved dependencies
 */
export function saveTaskToSchema25Impl(activeCycle, currentCycle, deps = {}) {
    const AppState = deps.AppState || _deps.AppState;

    if (AppState?.isReady?.()) {
        try {
            AppState.update(state => {
                if (state?.data?.cycles) {
                    state.data.cycles[activeCycle] = currentCycle;
                    state.metadata.lastModified = Date.now();
                }
            }, true); // immediate save - required for stats panel to read correct data
        } catch (error) {
            console.error('❌ AppState save failed:', error);
        }
    } else {
        console.warn('⚠️ AppState not ready for saveTaskToSchema25 - state may be lost');
    }
}

// ============================================================================
// MODULE INFO
// ============================================================================

console.log('Task Completion module loaded (DI-pure)');
