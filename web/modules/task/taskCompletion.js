/**
 * Task Completion & State Management Module (DI-Pure)
 * Handles task completion changes, ordering, and persistence
 *
 * Extracted from taskCore.js for better maintainability
 *
 * @module task/taskCompletion
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS } from '../core/constants.js';

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
    querySelectorAll: optional(null)
});

// Late-binding deps via Proxy
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
            new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
    } catch (error) {
        console.warn('Core wait timeout or error:', error);
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
        const taskItem = checkbox.closest(".task");
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

        const taskElements = querySelectorAll("#taskList .task");
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
