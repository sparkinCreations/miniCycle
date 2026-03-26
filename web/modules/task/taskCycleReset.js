/**
 * Task Cycle Reset Module (DI-Pure)
 * Handles cycle completion, task reset, and complete-all operations
 *
 * Extracted from taskCore.js for better maintainability
 *
 * @module task/taskCycleReset
 *
 * ## Hook Points for Extensions
 *
 * This module provides hook points for cleared tasks tracking and achievements.
 *
 * ### `deleteCompletedTasksImpl()` - Lines 489-534
 * Called when tasks are deleted/cleared in To-Do mode.
 * This is THE hook point for tracking cleared tasks.
 *
 * **Available data at hook point:**
 * - `tasksToDelete` - Array of task DOM elements being deleted
 * - `tasksToRecord` - Array of task data objects for history (text, priority)
 * - `taskIdsToDelete` - Array of task IDs being deleted
 *
 * **Current hooks:**
 * ```javascript
 * // Record cleared tasks for recreation feature (line 499-501)
 * _deps.recordMultipleClearedTasks(tasksToRecord);
 *
 * // Log history event (line 504-507)
 * _deps.logHistoryEvent('tasks_cleared', {
 *     tasksCleared: tasksToDelete.length
 * });
 *
 * // Update totalTasksCompleted and check achievements (line 520-534)
 * state.userProgress.totalTasksCompleted += taskIdsToDelete.length;
 * _deps.checkAchievements(globalCyclesCompleted, totalTasksCompleted);
 * ```
 *
 * **To add a new hook:**
 * 1. Add dependency to DI setup (lines 42-44)
 * 2. Add hook call in the `deleteCompletedTasksImpl()` function after line 507
 *
 * ### `resetTasks()` - The main reset orchestrator
 * Called when cycle completes in Auto/Manual mode.
 * Calls `incrementCycleCount()` which has its own hooks.
 * Do NOT add cleared-task hooks here - use `deleteCompletedTasksImpl()`.
 *
 * ### Important: To-Do Mode vs Cycle Reset
 * - **To-Do Mode clearing** → `deleteCompletedTasksImpl()` → records to clearedTasks
 * - **Cycle reset (Auto/Manual)** → `resetTasks()` → does NOT record to clearedTasks
 * - **Clear on Reset tasks** → deleted during reset, recorded to clearedTasks for recreate
 */

import { createDIModule, optional } from '../core/diBase.js';
import { TASK_TIMEOUTS, UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskCycleReset', {
    appInit: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    autoSave: optional(null),
    isPerformingUndoRedo: optional(null),
    showNotification: optional(null),
    showConfirmationModal: optional(null),
    captureStateSnapshot: optional(null),
    updateUndoRedoButtons: optional(null),
    updateCompletedTasksCount: optional(null),
    incrementCycleCount: optional(null),
    animateProgressBarFill: optional(null),
    animateProgressBarEmpty: optional(null),
    showCompletionAnimation: optional(null),
    showClearAnimation: optional(null),
    helpWindowManager: optional(null),
    pluginManager: optional(null),
    recurringCore: optional(null),
    removeRecurringTasksFromCycle: optional(null),
    checkMiniCycle: optional(null),
    querySelector: optional(null),
    querySelectorAll: optional(null),
    // UIOrchestrator for coalesced UI updates
    requestUIUpdate: optional(null),
    // Cleared tasks tracking (for To-Do mode history)
    recordMultipleClearedTasks: optional(null),
    logHistoryEvent: optional(null),
    checkAchievements: optional(null),
    showMilestoneCelebrationOverlay: optional(null),
    // Logo effects
    triggerLogoScan: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, loadMiniCycleData: Function|null, autoSave: Function|null, isPerformingUndoRedo: Function|null, showNotification: Function|null, showConfirmationModal: Function|null, captureStateSnapshot: Function|null, updateUndoRedoButtons: Function|null, updateCompletedTasksCount: Function|null, incrementCycleCount: Function|null, animateProgressBarFill: Function|null, animateProgressBarEmpty: Function|null, showCompletionAnimation: Function|null, helpWindowManager: Object|null, pluginManager: Object|null, recurringCore: Object|null, removeRecurringTasksFromCycle: Function|null, checkMiniCycle: Function|null, querySelector: Function|null, querySelectorAll: Function|null, requestUIUpdate: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskCycleReset
 * @param {Object} dependencies - Dependencies to inject
 */
export function setTaskCycleResetDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// MODULE STATE
// ============================================================================

// Track active state to prevent concurrent resets
let isResetting = false;
const activeTimeouts = new Set();

/**
 * Track a timeout for later cleanup
 * @param {number} timeoutId - The timeout ID returned by setTimeout
 */
function trackTimeout(timeoutId) {
    activeTimeouts.add(timeoutId);
    return timeoutId;
}

/**
 * Clear all tracked timeouts
 */
export function clearAllTimeouts() {
    for (const timeoutId of activeTimeouts) {
        clearTimeout(timeoutId);
    }
    activeTimeouts.clear();
}

/**
 * Check if reset is in progress
 */
export function isResetInProgress() {
    return isResetting;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

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

/**
 * Wait for specific global functions to be available
 * Used by resetTasks to ensure UI functions exist before calling them
 */
async function waitForUIFunctions(deps, maxWaitMs = TASK_TIMEOUTS.UI_FUNC_WAIT_TOTAL) {
    const startTime = Date.now();
    const checkInterval = TASK_TIMEOUTS.UI_FUNC_CHECK_INTERVAL;

    while (Date.now() - startTime < maxWaitMs) {
        const hasIncrementCycleCount = typeof deps.incrementCycleCount === 'function';
        const helpWindowMgr = resolveGetter(deps.helpWindowManager);
        const hasHelpWindowManager = helpWindowMgr && typeof helpWindowMgr.showCycleCompleteMessage === 'function';
        const hasShowCompletionAnimation = typeof deps.showCompletionAnimation === 'function';

        if (hasIncrementCycleCount && hasHelpWindowManager && hasShowCompletionAnimation) {
            return true;
        }

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // Final check for logging
    const helpWindowMgr = resolveGetter(deps.helpWindowManager);
    console.warn('Timeout waiting for UI functions:', {
        incrementCycleCount: typeof deps.incrementCycleCount === 'function',
        helpWindowManager: helpWindowMgr && typeof helpWindowMgr.showCycleCompleteMessage === 'function',
        showCompletionAnimation: typeof deps.showCompletionAnimation === 'function'
    });
    return false;
}

/**
 * Fallback confirmation modal using browser confirm
 */
function fallbackConfirmModal(config) {
    const result = confirm(config.message);
    if (config.callback) {
        config.callback(result);
    }
}

// ============================================================================
// RESET HELPERS
// ============================================================================

/**
 * Get context needed for reset operation
 * @param {Object} deps - Resolved dependencies
 * @returns {Object|null} Reset context or null if invalid
 */
function getResetContext(deps) {
    const querySelector = deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel));
    const taskList = querySelector("#taskList");
    const completedTaskList = querySelector("#completedTaskList");

    if (!taskList) {
        console.error('Task list element not found');
        return null;
    }

    // Get tasks from both lists
    const taskElements = [
        ...taskList.querySelectorAll(DOM_SELECTORS.TASK),
        ...(completedTaskList?.querySelectorAll(DOM_SELECTORS.TASK) || [])
    ];

    // Get cycle data from AppState (always ready by the time user actions trigger this)
    const AppState = deps.AppState || _deps.AppState;

    if (!AppState?.isReady?.()) {
        console.error('AppState not ready for resetTasks');
        return null;
    }

    const state = AppState.get();
    const cycles = state?.data?.cycles || {};
    const activeCycle = state?.appState?.activeCycleId;
    const cycleData = cycles[activeCycle];

    if (!activeCycle || !cycleData) {
        console.error("No active cycle found for resetTasks");
        return null;
    }

    return { taskList, completedTaskList, taskElements, cycles, activeCycle, cycleData };
}

/**
 * Perform the core data reset logic
 * @param {Object} context - Reset context from getResetContext
 * @param {Object} deps - Resolved dependencies
 * @returns {Object} Result with tasksDeleted count
 */
function resetTasksData(context, deps) {
    const { taskElements, activeCycle } = context;
    const AppState = deps.AppState || _deps.AppState;
    const removeRecurringTasksFromCycle = deps.removeRecurringTasksFromCycle || _deps.removeRecurringTasksFromCycle;

    // Get fresh state (user may have switched cycles during animation)
    const freshState = AppState?.get?.();
    const currentActiveCycle = freshState?.appState?.activeCycleId;

    if (currentActiveCycle !== activeCycle) {
        console.warn('Cycle switched during reset, aborting');
        return { aborted: true };
    }

    const freshCycleData = freshState?.data?.cycles?.[currentActiveCycle];
    if (!freshCycleData) {
        console.warn('Could not get fresh cycle data');
        return { aborted: true };
    }

    // Capture recurring task names before removal for history logging
    const recurringRemovedNames = [];
    taskElements.forEach(taskEl => {
        if (taskEl.classList.contains('recurring')) {
            const taskId = taskEl.dataset.taskId;
            const task = freshCycleData?.tasks?.find(t => t.id === taskId);
            if (task?.text) recurringRemovedNames.push(task.text);
        }
    });

    // Remove recurring tasks
    if (typeof removeRecurringTasksFromCycle === 'function') {
        removeRecurringTasksFromCycle(taskElements, freshCycleData);
    }

    // Process non-recurring tasks
    const tasksToDelete = [];
    const tasksToDeleteNames = [];
    let animationIndex = 0;
    const STAGGER_DELAY = 60; // ms between each task animation
    const disableTaskAnimation = freshState?.settings?.disableCompletionAnimation === true;

    taskElements.forEach(taskEl => {
        if (taskEl.classList.contains("recurring")) return;

        const taskId = taskEl.dataset.taskId;
        const task = freshCycleData?.tasks?.find(t => t.id === taskId);

        // Check if task should be deleted
        if (task?.deleteWhenComplete === true) {
            tasksToDelete.push(taskId);
            if (task.text) tasksToDeleteNames.push(task.text);
            taskEl.remove();
            return;
        }

        // Reset task DOM with staggered animation
        const checkbox = taskEl.querySelector("input[type='checkbox']");
        const dueDateInput = taskEl.querySelector(DOM_SELECTORS.DUE_DATE);

        // Apply staggered reset animation - Fix #58: wrap with trackTimeout
        if (disableTaskAnimation) {
            // Skip animation, just reset immediately
            if (checkbox) checkbox.checked = false;
            taskEl.classList.remove("overdue-task");
            if (dueDateInput) {
                dueDateInput.value = "";
                dueDateInput.classList.add("hidden");
            }
        } else {
            const delay = animationIndex * STAGGER_DELAY;
            trackTimeout(setTimeout(() => {
                taskEl.classList.add("task-resetting");
                if (checkbox) checkbox.checked = false;
                taskEl.classList.remove("overdue-task");
                if (dueDateInput) {
                    dueDateInput.value = "";
                    dueDateInput.classList.add("hidden");
                }
                // Remove animation class after it completes
                trackTimeout(setTimeout(() => {
                    taskEl.classList.remove("task-resetting");
                }, 400));
            }, delay));
        }

        animationIndex++;
    });

    // Record deleteWhenComplete tasks to cleared tasks before deletion
    if (tasksToDelete.length > 0) {
        const tasksToRecord = tasksToDelete.map(taskId => {
            const task = freshCycleData?.tasks?.find(t => t.id === taskId);
            return task ? {
                text: task.text,
                highPriority: task.highPriority || false,
                dueDate: task.dueDate,
                priorityColor: task.priorityColor || null,
                remindersEnabled: task.remindersEnabled || false,
                deleteWhenComplete: task.deleteWhenComplete || false,
                deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || null,
                recurring: task.recurring || false,
                recurringSettings: task.recurringSettings || null
            } : null;
        }).filter(Boolean);

        const recordFn = deps.recordMultipleClearedTasks || _deps.recordMultipleClearedTasks;
        if (tasksToRecord.length > 0 && typeof recordFn === 'function') {
            recordFn(tasksToRecord);
        }
    }

    // ✅ Use AppState only (no localStorage fallback) - DI-pure
    if (AppState?.isReady?.()) {
        AppState.update(state => {
            const cycle = state?.data?.cycles?.[currentActiveCycle];
            if (cycle) {
                if (tasksToDelete.length > 0) {
                    cycle.tasks = cycle.tasks.filter(t => !tasksToDelete.includes(t.id));
                }
                cycle.tasks.forEach(task => {
                    if (!task.recurring) {
                        task.completed = false;
                        task.dueDate = null;
                    }
                });
            }
        }, true); // immediate save - required for stats panel to read correct data
    } else {
        console.warn('⚠️ AppState not ready for cycle reset - state may be lost');
    }

    // Log history events for task removals during reset
    const logHistoryEvent = deps.logHistoryEvent || _deps.logHistoryEvent;
    if (typeof logHistoryEvent === 'function') {
        if (recurringRemovedNames.length > 0) {
            logHistoryEvent('recurring_tasks_removed', {
                count: recurringRemovedNames.length,
                taskNames: recurringRemovedNames
            });
        }
        if (tasksToDeleteNames.length > 0) {
            logHistoryEvent('tasks_removed_on_reset', {
                count: tasksToDeleteNames.length,
                taskNames: tasksToDeleteNames
            });
        }
    }

    return { aborted: false, tasksDeleted: tasksToDelete.length, recurringRemovedCount: recurringRemovedNames.length };
}

/**
 * Move completed tasks back to active list and restore original order
 * @param {Object} context - Reset context
 * @param {Object} deps - Resolved dependencies
 */
function moveCompletedTasksBack(context, deps) {
    const { taskList, completedTaskList, activeCycle } = context;
    const updateCompletedTasksCount = deps.updateCompletedTasksCount || _deps.updateCompletedTasksCount;
    const AppState = deps.AppState || _deps.AppState;

    if (!completedTaskList || !taskList) return;

    // Move completed tasks back to main list first
    const completedTaskElements = completedTaskList.querySelectorAll(DOM_SELECTORS.TASK);
    completedTaskElements.forEach(taskEl => {
        if (!taskEl.classList.contains('recurring')) {
            taskList.appendChild(taskEl);
        }
    });

    if (completedTaskElements.length > 0) {
    }

    // Restore original task order from AppState
    if (AppState?.isReady?.()) {
        const state = AppState.get();
        const cycleData = state?.data?.cycles?.[activeCycle];
        const stateTaskOrder = cycleData?.tasks?.map(t => t.id) || [];

        if (stateTaskOrder.length > 0) {
            // Get all task elements and sort by state order
            const allTaskEls = Array.from(taskList.querySelectorAll(DOM_SELECTORS.TASK));
            const taskMap = new Map(allTaskEls.map(el => [el.dataset.taskId, el]));

            // Reorder DOM to match state order
            stateTaskOrder.forEach(taskId => {
                const taskEl = taskMap.get(taskId);
                if (taskEl) {
                    taskList.appendChild(taskEl);
                }
            });
        }
    }

    if (typeof updateCompletedTasksCount === 'function') {
        updateCompletedTasksCount();
    }
}

// ============================================================================
// MAIN RESET FUNCTIONS
// ============================================================================

/**
 * Reset all tasks (cycle completion)
 * @param {Object} deps - Resolved dependencies
 */
export async function resetTasksImpl(deps = {}) {
    try {
        if (isResetting) return;
        isResetting = true;

        // Merge deps with module-level deps
        const mergedDeps = {
            AppState: deps.AppState || _deps.AppState,
            loadMiniCycleData: deps.loadMiniCycleData || _deps.loadMiniCycleData,
            querySelector: deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel)),
            captureStateSnapshot: deps.captureStateSnapshot || _deps.captureStateSnapshot,
            isPerformingUndoRedo: deps.isPerformingUndoRedo || _deps.isPerformingUndoRedo || (() => false),
            animateProgressBarFill: deps.animateProgressBarFill || _deps.animateProgressBarFill,
            animateProgressBarEmpty: deps.animateProgressBarEmpty || _deps.animateProgressBarEmpty,
            incrementCycleCount: deps.incrementCycleCount || _deps.incrementCycleCount,
            helpWindowManager: deps.helpWindowManager || _deps.helpWindowManager,
            showCompletionAnimation: deps.showCompletionAnimation || _deps.showCompletionAnimation,
            updateUndoRedoButtons: deps.updateUndoRedoButtons || _deps.updateUndoRedoButtons,
            pluginManager: deps.pluginManager || _deps.pluginManager,
            recurringCore: deps.recurringCore || _deps.recurringCore,
            autoSave: deps.autoSave || _deps.autoSave,
            updateStatsPanel: deps.updateStatsPanel || _deps.updateStatsPanel,
            removeRecurringTasksFromCycle: deps.removeRecurringTasksFromCycle || _deps.removeRecurringTasksFromCycle,
            updateCompletedTasksCount: deps.updateCompletedTasksCount || _deps.updateCompletedTasksCount
        };

        // Wait for critical UI functions to be available
        await waitForUIFunctions(mergedDeps);

        // Step 1: Get and validate context
        const context = getResetContext(mergedDeps);
        if (!context) {
            isResetting = false;
            return;
        }

        const { activeCycle, cycles } = context;

        // Step 2: Capture undo snapshot BEFORE modifications
        if (typeof mergedDeps.captureStateSnapshot === 'function' && !mergedDeps.isPerformingUndoRedo()) {
            const currentState = mergedDeps.AppState?.get?.();
            if (currentState) {
                mergedDeps.captureStateSnapshot(currentState);
            }
        }

        // Step 3: Animate progress bar fill (delegated to cycleCompletion)
        if (typeof mergedDeps.animateProgressBarFill === 'function') {
            await mergedDeps.animateProgressBarFill();
        }

        // Step 3.5: Spin the logo (coin-flip animation)
        const headerLogo = document.querySelector(DOM_SELECTORS.HEADER_LOGO);
        if (headerLogo) {
            headerLogo.classList.remove('logo-spin'); // Reset if already spinning
            // Force reflow to restart animation
            void headerLogo.offsetWidth;
            headerLogo.classList.add('logo-spin');
            // Remove class after animation completes
            setTimeout(() => headerLogo.classList.remove('logo-spin'), UI_TIMEOUTS.CLEAR_ANIMATION);
        }

        // Step 4: Perform core data reset
        const result = resetTasksData(context, mergedDeps);
        if (result.aborted) {
            isResetting = false;
            return;
        }

        // Step 5: Move completed tasks back
        moveCompletedTasksBack(context, mergedDeps);

        // Step 6: Increment cycle count (handles animation + milestones)
        if (typeof mergedDeps.incrementCycleCount === 'function') {
            mergedDeps.incrementCycleCount(activeCycle, cycles);
        }

        // Step 7: Animate progress bar empty (delegated to cycleCompletion)
        if (typeof mergedDeps.animateProgressBarEmpty === 'function') {
            mergedDeps.animateProgressBarEmpty();
        }

        // Step 8: Show cycle completion message
        const helpWindowMgr = resolveGetter(mergedDeps.helpWindowManager);
        if (helpWindowMgr?.showCycleCompleteMessage) {
            helpWindowMgr.showCycleCompleteMessage();
        }

        // Step 8.5: Chain recurring-removed message after cycle complete message (if applicable)
        if (result.recurringRemovedCount > 0) {
            trackTimeout(setTimeout(() => {
                helpWindowMgr?.showRecurringRemovedMessage?.();
            }, 2100)); // fires after 2s cycle-complete message ends
        }

        // Step 9: Update undo/redo buttons
        if (typeof mergedDeps.updateUndoRedoButtons === 'function') {
            mergedDeps.updateUndoRedoButtons();
        }

        // Step 10: Trigger plugin hook (if pluginManager available)
        if (mergedDeps.pluginManager?.triggerHook) {
            mergedDeps.pluginManager.triggerHook('cycleReset', { cycleId: activeCycle });
        }

        // Step 11: Schedule cleanup and release lock
        trackTimeout(setTimeout(() => {
            if (mergedDeps.recurringCore?.watchRecurringTasks) {
                mergedDeps.recurringCore.watchRecurringTasks();
            }
            // Note: autoSave removed - resetTasksData already calls AppState.update()
            mergedDeps.updateStatsPanel?.();
        }, TASK_TIMEOUTS.POST_RESET_CLEANUP));

        trackTimeout(setTimeout(() => {
            isResetting = false;
        }, TASK_TIMEOUTS.RESET_LOCK_RELEASE));

    } catch (error) {
        console.warn('Reset tasks failed:', error);
        isResetting = false;
        _deps.showNotification?.(getLabel('notify.taskResetFailed'), 'warning');
    }
}

/**
 * Delete completed tasks that have deleteWhenComplete enabled (To-Do mode).
 * @param {string} activeCycleId - The active cycle ID
 * @param {Object} cycleData - The cycle data object
 * @param {HTMLElement} taskList - The task list DOM element
 * @param {Object} deps - Resolved dependencies
 * @returns {Object} { deleted: number } or { aborted: true, reason: string }
 */
export async function deleteCompletedTasksImpl(activeCycleId, cycleData, taskList, deps = {}) {
    const AppState = deps.AppState || _deps.AppState;

    // Find all tasks that are BOTH completed AND marked for deletion
    // Check both main taskList AND completedTaskList (for when dropdown is enabled)
    const tasksToDelete = [];
    const allTaskElements = taskList.querySelectorAll(DOM_SELECTORS.TASK);
    const completedTaskList = document.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
    const completedTaskElements = completedTaskList?.querySelectorAll(DOM_SELECTORS.TASK) || [];

    // Helper to process task elements
    const processTaskElement = (taskElement) => {
        const taskId = taskElement.dataset.taskId;
        const task = cycleData.tasks?.find(t => t.id === taskId);
        const checkbox = taskElement.querySelector("input[type='checkbox']");
        const isCompleted = checkbox?.checked || false;

        if (isCompleted && task?.deleteWhenComplete === true) {
            tasksToDelete.push({ taskId, taskElement });
        }
    };

    // Process tasks from main list
    allTaskElements.forEach(processTaskElement);

    // Process tasks from completed dropdown list
    completedTaskElements.forEach(processTaskElement);

    if (tasksToDelete.length === 0) {
        _deps.showNotification?.(getLabel('notify.noCompletedToDelete'), "default", UI_TIMEOUTS.NOTIFICATION_LONG);
        return { aborted: true, reason: 'no_tasks' };
    }

    // Count recurring tasks among those being deleted
    const recurringDeleteCount = tasksToDelete.filter(({ taskId }) => {
        const task = cycleData.tasks?.find(t => t.id === taskId);
        return task?.recurring === true;
    }).length;

    // Trigger logo scan effect for to-do mode task clearing
    if (typeof _deps.triggerLogoScan === 'function') {
        _deps.triggerLogoScan(500);
    }

    // Record cleared tasks before deleting (for history tracking)
    const tasksToRecord = tasksToDelete.map(({ taskId }) => {
        const task = cycleData.tasks?.find(t => t.id === taskId);
        return task ? {
            text: task.text,
            highPriority: task.highPriority || false,
            dueDate: task.dueDate,
            priorityColor: task.priorityColor || null,
            remindersEnabled: task.remindersEnabled || false,
            deleteWhenComplete: task.deleteWhenComplete || false,
            deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || null,
            recurring: task.recurring || false,
            recurringSettings: task.recurringSettings || null
        } : null;
    }).filter(Boolean);

    if (tasksToRecord.length > 0 && typeof _deps.recordMultipleClearedTasks === 'function') {
        _deps.recordMultipleClearedTasks(tasksToRecord);
    }

    // Log history event for tasks cleared
    if (typeof _deps.logHistoryEvent === 'function') {
        _deps.logHistoryEvent('tasks_cleared', {
            tasksCleared: tasksToDelete.length
        });
    }

    // Show tasks cleared message in help window
    const helpWindowMgr = deps.helpWindowManager || _deps.helpWindowManager;
    const resolvedHelpMgr = typeof helpWindowMgr === 'function' ? helpWindowMgr() : helpWindowMgr;
    if (resolvedHelpMgr?.showTasksClearedMessage) {
        resolvedHelpMgr.showTasksClearedMessage(tasksToDelete.length);
    }

    // Chain recurring-removed message after tasks-cleared message (if applicable)
    if (recurringDeleteCount > 0) {
        trackTimeout(setTimeout(() => {
            resolvedHelpMgr?.showRecurringRemovedMessage?.();
        }, 2100)); // fires after 2s tasks-cleared message ends
    }

    // Animate and remove from DOM, collect IDs
    const CLEAR_STAGGER_DELAY = 50; // ms between each task animation
    const CLEAR_ANIMATION_DURATION = 350; // matches CSS animation duration

    const taskIdsToDelete = tasksToDelete.map(({ taskId }) => taskId);

    // DOM-dependent UI updaters — must wait until elements are removed
    const updateCompletedTasksCount = deps.updateCompletedTasksCount || _deps.updateCompletedTasksCount;
    const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;

    // Apply staggered clear animation
    const lastIndex = tasksToDelete.length - 1;
    tasksToDelete.forEach(({ taskElement }, index) => {
        const delay = index * CLEAR_STAGGER_DELAY;
        trackTimeout(setTimeout(() => {
            taskElement.classList.add("task-clearing");
            // Remove from DOM after animation completes
            trackTimeout(setTimeout(() => {
                taskElement.remove();
                // After last task is removed, update DOM-dependent UI
                if (index === lastIndex) {
                    if (typeof updateCompletedTasksCount === 'function') {
                        updateCompletedTasksCount();
                    }
                    requestUIUpdate?.({ progress: true, stats: true });
                }
            }, CLEAR_ANIMATION_DURATION));
        }, delay));
    });

    // ✅ Use AppState only (no localStorage fallback) - DI-pure
    if (AppState?.isReady?.()) {
        await AppState.update(state => {
            const cycle = state.data.cycles[activeCycleId];
            if (cycle?.tasks) {
                cycle.tasks = cycle.tasks.filter(t => !taskIdsToDelete.includes(t.id));
            }
            // Update total tasks completed count for achievements
            if (!state.userProgress) state.userProgress = {};
            state.userProgress.totalTasksCompleted = (state.userProgress.totalTasksCompleted || 0) + taskIdsToDelete.length;
        }, true);

        // Check for new achievements (OR-based: cycles OR tasks can unlock)
        if (typeof _deps.checkAchievements === 'function') {
            const updatedState = AppState.get();
            const globalCyclesCompleted = updatedState.userProgress?.cyclesCompleted || 0;
            const totalTasksCompleted = updatedState.userProgress?.totalTasksCompleted || 0;
            _deps.checkAchievements(globalCyclesCompleted, totalTasksCompleted);
        }

        // Check for 500 tasks cleared milestone celebration
        const postUpdateState = AppState.get();
        const newTotalTasks = postUpdateState.userProgress?.totalTasksCompleted || 0;
        if (newTotalTasks >= 500 && !postUpdateState.userProgress?.celebrated500Tasks) {
            _deps.showMilestoneCelebrationOverlay?.('milestoneTrail', 'notify.milestone500Tasks', 'notify.milestone500TasksSubtitle');
            await AppState.update(state => {
                if (!state.userProgress) state.userProgress = {};
                state.userProgress.celebrated500Tasks = true;
            }, true);
        }
    } else {
        console.warn('⚠️ AppState not ready for task deletion - state may be lost');
    }

    // Request non-DOM-dependent UI updates immediately
    requestUIUpdate?.({
        completeAllButton: true
    });

    // Show clear animation for To-Do mode
    const showClearAnimation = deps.showClearAnimation || _deps.showClearAnimation;
    if (typeof showClearAnimation === 'function') {
        showClearAnimation();
    }

    return { deleted: taskIdsToDelete.length };
}

/**
 * Mark all tasks as complete and trigger cycle check/reset.
 * @param {Object} cycleData - The cycle data object
 * @param {HTMLElement} taskList - The task list DOM element
 * @param {Function} resetTasksFn - The resetTasks function to call
 * @param {Object} deps - Resolved dependencies
 */
export function markAllTasksCompleteImpl(cycleData, taskList, resetTasksFn, deps = {}) {
    if (isResetting) {
        return;
    }

    const checkMiniCycle = deps.checkMiniCycle || _deps.checkMiniCycle;

    taskList.querySelectorAll(".task input").forEach(task => task.checked = true);

    if (typeof checkMiniCycle === 'function') {
        checkMiniCycle();
    }

    // Only call resetTasks() if autoReset is OFF
    if (!cycleData.autoReset && typeof resetTasksFn === 'function') {
        trackTimeout(setTimeout(() => resetTasksFn(), TASK_TIMEOUTS.CORE_INIT));
    }
}

/**
 * Get context for complete all operation.
 * @param {Object} deps - Resolved dependencies
 * @returns {Object|null} { activeCycle, cycleData, taskList } or null if invalid
 */
function getCompleteAllContext(deps) {
    const querySelector = deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel));
    const AppState = deps.AppState || _deps.AppState;

    const taskList = querySelector("#taskList");

    if (!AppState?.isReady?.()) {
        console.error('AppState not ready for handleCompleteAllTasks');
        return null;
    }

    const state = AppState.get();
    const activeCycle = state?.appState?.activeCycleId;
    const cycleData = state?.data?.cycles?.[activeCycle];

    if (!activeCycle || !cycleData) {
        console.warn('No active cycle found for complete all tasks');
        return null;
    }

    return { activeCycle, cycleData, taskList };
}

/**
 * Complete all tasks at once
 * @param {Function} resetTasksFn - The resetTasks function to call when needed
 * @param {Object} deps - Resolved dependencies
 */
export async function handleCompleteAllTasksImpl(resetTasksFn, deps = {}) {
    try {
        // Guard against rapid clicks while a reset is already in progress
        if (isResetting) {
            return;
        }

        // Merge deps with module-level deps
        const mergedDeps = {
            AppState: deps.AppState || _deps.AppState,
            loadMiniCycleData: deps.loadMiniCycleData || _deps.loadMiniCycleData,
            querySelector: deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel)),
            showConfirmationModal: deps.showConfirmationModal || _deps.showConfirmationModal || fallbackConfirmModal,
            checkMiniCycle: deps.checkMiniCycle || _deps.checkMiniCycle,
            updateProgressBar: deps.updateProgressBar || _deps.updateProgressBar,
            updateStatsPanel: deps.updateStatsPanel || _deps.updateStatsPanel,
            checkCompleteAllButton: deps.checkCompleteAllButton || _deps.checkCompleteAllButton,
            showClearAnimation: deps.showClearAnimation || _deps.showClearAnimation
        };

        // Step 1: Get context
        const context = getCompleteAllContext(mergedDeps);
        if (!context) return;

        const { activeCycle, cycleData, taskList } = context;

        // Step 2: Check if confirmation modal is needed (due dates in cycle mode)
        if (!cycleData.deleteCheckedTasks) {
            const hasDueDates = [...taskList.querySelectorAll(DOM_SELECTORS.DUE_DATE)].some(
                dueDateInput => dueDateInput.value
            );

            if (hasDueDates) {
                mergedDeps.showConfirmationModal({
                    title: getLabel('modal.resetTasksTitle'),
                    message: getLabel('modal.resetTasksMessage'),
                    confirmText: getLabel('modal.resetTasksConfirm'),
                    cancelText: getLabel('button.cancel'),
                    callback: async (confirmed) => {
                        if (!confirmed) return;

                        // Read FRESH state - user may have changed mode while modal was open
                        const freshContext = getCompleteAllContext(mergedDeps);
                        if (!freshContext) {
                            console.warn('Could not get fresh state in confirmation callback');
                            return;
                        }

                        await executeCompleteAll(
                            freshContext.activeCycle,
                            freshContext.cycleData,
                            freshContext.taskList,
                            resetTasksFn,
                            mergedDeps
                        );
                    }
                });
                return;
            }
        }

        // Step 3: Execute the appropriate action
        await executeCompleteAll(activeCycle, cycleData, taskList, resetTasksFn, mergedDeps);

    } catch (error) {
        console.warn('Complete all tasks failed:', error);
        _deps.showNotification?.(getLabel('notify.completeAllFailed'), 'warning');
    }
}

/**
 * Execute the complete all operation (delete or mark complete).
 * @param {string} activeCycle - Active cycle ID
 * @param {Object} cycleData - Cycle data
 * @param {HTMLElement} taskList - Task list element
 * @param {Function} resetTasksFn - The resetTasks function to call
 * @param {Object} deps - Resolved dependencies
 */
async function executeCompleteAll(activeCycle, cycleData, taskList, resetTasksFn, deps) {
    if (cycleData.deleteCheckedTasks) {
        // To-Do mode: delete completed tasks
        await deleteCompletedTasksImpl(activeCycle, cycleData, taskList, deps);
    } else {
        // Cycle mode: mark all complete and trigger reset
        markAllTasksCompleteImpl(cycleData, taskList, resetTasksFn, deps);
    }
}

// ============================================================================
// MODULE INFO
// ============================================================================

