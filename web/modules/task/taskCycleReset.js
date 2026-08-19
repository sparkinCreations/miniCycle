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
import { applyTaskStatusLabel } from './taskUtils.js';
import { TASK_TIMEOUTS, UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, MILESTONES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskCycleReset', {
    appInit: optional(null),
    AppState: optional(null),
    // Re-arm reminders after a reset: the reminder timer stops itself when it
    // fires with zero incomplete tasks (long window in Manual Cycle mode), and
    // resetting tasks to incomplete never restarted it — reminders went silent
    // for the whole new cycle. Mirrors taskCRUD's re-arm after task deletion.
    // startReminders is idempotent (clears its own timeout) and self-gating
    // (no-ops when disabled/exhausted), so unconditional calls are safe.
    startReminders: optional(null),
    AppGlobalState: optional(null),  // batch-operation flag for undo snapshot guard
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
    checkBackupReminderOnTaskClear: optional(null),  // () => void — backup reminder after 100 cleared tasks
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
 * @returns {void}
 */
export function setTaskCycleResetDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// MODULE STATE
// ============================================================================

// Track active state to prevent concurrent resets
let isResetting = false;

// v2.360: mirror the reset flag into
// AppGlobalState.isResetting — undoRedoManager's batch-operation guard reads
// the GLOBAL flag, which was declared and checked but never SET anywhere (the
// setter was lost in the taskCore extraction; only this module-local existed).
// Result: snapshots WERE captured during resets and Complete All — the first
// Undo after completing a cycle appeared to do nothing, and Clear Completed
// stacked multiple snapshots.
function setResettingFlag(value, deps = {}) {
    isResetting = value;
    const gs = deps.AppGlobalState || _deps.AppGlobalState;
    if (gs) gs.isResetting = value;
}
const activeTimeouts = new Set();

/**
 * Track a timeout for later cleanup
 * @param {number} timeoutId - The timeout ID returned by setTimeout
 * @returns {number}
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
    // Release the reset lock too: the RESET_LOCK_RELEASE timeout we just
    // cancelled was the only thing that would have cleared it — cancelling
    // the timeouts without releasing the lock left isResetting stuck true,
    // so every later resetTasksImpl silently no-oped (hit by the test
    // harness; the destroy() path had the same exposure).
    setResettingFlag(false);
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
 * @returns {*} The resolved value.
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
 * Get context needed for reset operation.
 * @param {Object} deps - Resolved dependencies
 * @returns {Object|null} Reset context or null if invalid
 */
function getResetContext(deps) {
    const querySelector = deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel));
    const taskList = querySelector(`#${DOM_IDS.TASK_LIST}`);
    const completedTaskList = querySelector(`#${DOM_IDS.COMPLETED_TASK_LIST}`);

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
 * Perform the core data reset logic.
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
        if (taskEl.classList.contains(DOM_CLASSES.RECURRING)) {
            const taskId = taskEl.dataset.taskId;
            const task = freshCycleData?.tasks?.find(t => t.id === taskId);
            if (task?.text) recurringRemovedNames.push(task.text);
        }
    });

    // Plan the recurring-task removal: DOM effects happen now, state changes
    // are returned as a plan and applied inside the producer below (one-door
    // migration v2.361 — previously this mutated live state directly).
    const recurringPlan = (typeof removeRecurringTasksFromCycle === 'function')
        ? (removeRecurringTasksFromCycle(taskElements, freshCycleData) || { removedIds: [], keptIds: [], templateUpdates: {} })
        : { removedIds: [], keptIds: [], templateUpdates: {} };

    // Process non-recurring tasks
    const tasksToDelete = [];
    const tasksToDeleteNames = [];
    let animationIndex = 0;
    const STAGGER_DELAY = 60; // ms between each task animation
    const disableTaskAnimation = freshState?.settings?.disableCompletionAnimation === true;

    taskElements.forEach(taskEl => {
        if (taskEl.classList.contains(DOM_CLASSES.RECURRING)) return;

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
        const checkbox = taskEl.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
        const dueDateInput = taskEl.querySelector(DOM_SELECTORS.DUE_DATE);

        // Apply staggered reset animation - Fix #58: wrap with trackTimeout
        if (disableTaskAnimation) {
            // Skip animation, just reset immediately
            if (checkbox) checkbox.checked = false;
            // The accessible name is NOT derived from checkbox.checked — it is a
            // written attribute, so unchecking without this leaves every row
            // announcing "Completed" over an unchecked box.
            applyTaskStatusLabel(taskEl, false);
            taskEl.classList.remove(DOM_CLASSES.OVERDUE_TASK);
            if (dueDateInput) {
                dueDateInput.value = "";
                dueDateInput.classList.add(DOM_CLASSES.HIDDEN);
            }
        } else {
            const delay = animationIndex * STAGGER_DELAY;
            trackTimeout(setTimeout(() => {
                taskEl.classList.add(DOM_CLASSES.TASK_RESETTING);
                if (checkbox) checkbox.checked = false;
                applyTaskStatusLabel(taskEl, false);
                taskEl.classList.remove(DOM_CLASSES.OVERDUE_TASK);
                if (dueDateInput) {
                    dueDateInput.value = "";
                    dueDateInput.classList.add(DOM_CLASSES.HIDDEN);
                }
                // Remove animation class after it completes
                trackTimeout(setTimeout(() => {
                    taskEl.classList.remove(DOM_CLASSES.TASK_RESETTING);
                }, 400));
            }, delay));
        }

        animationIndex++;
    });

    // Record deleteWhenComplete tasks to cleared tasks before deletion
    if (tasksToDelete.length > 0) {
        const tasksToRecord = tasksToDelete
            .map(taskId => freshCycleData?.tasks?.find(t => t.id === taskId))
            .filter(Boolean)
            .map(buildClearedRecord);

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
                // Apply the recurring-removal plan (state side of what the
                // DOM already shows): remove spawned recurring instances,
                // uncheck kept ones, advance their templates.
                const removedIdSet = new Set(recurringPlan.removedIds);
                if (removedIdSet.size > 0 || tasksToDelete.length > 0) {
                    cycle.tasks = cycle.tasks.filter(t => !removedIdSet.has(t.id) && !tasksToDelete.includes(t.id));
                }
                recurringPlan.keptIds.forEach(keptId => {
                    const keptTask = cycle.tasks.find(t => t.id === keptId);
                    if (keptTask) keptTask.completed = false;
                });
                Object.entries(recurringPlan.templateUpdates).forEach(([templateId, upd]) => {
                    const template = cycle.recurringTemplates?.[templateId];
                    if (template) {
                        template.nextScheduledOccurrence = upd.nextScheduledOccurrence;
                        template.lastTriggeredTimestamp = upd.lastTriggeredTimestamp;
                    }
                });
                cycle.tasks.forEach(task => {
                    if (!task.recurring) {
                        task.completed = false;
                        task.dueDate = null;
                    }
                });
            }

            // Count the deleteWhenComplete tasks this reset just removed.
            //
            // This path and deleteCompletedTasksImpl both clear tasks and both
            // archive them, but only that one was advancing the counter — so in
            // To-Do mode, where finishing the last task completes the CYCLE and
            // lands here instead, totalTasksCompleted never moved and no
            // task-count achievement could ever unlock. The archive filled up
            // while the number behind it stayed at zero.
            //
            // tasksToDelete is already non-recurring: the collection loop above
            // returns early on DOM_CLASSES.RECURRING. That matches the rule the
            // sibling path documents — a recurring occurrence is scheduled to
            // return, so it must not inflate this total, and it still reaches
            // achievements through the cycle-completion path.
            if (tasksToDelete.length > 0) {
                if (!state.userProgress) state.userProgress = {};
                state.userProgress.totalTasksCompleted =
                    (state.userProgress.totalTasksCompleted || 0) + tasksToDelete.length;
            }
        }, true); // immediate save - required for stats panel to read correct data

        // Re-check achievements against the new total, mirroring the sibling
        // path. Without this the unlock waits for some later event to happen to
        // call it, which for a To-Do user may be never.
        if (tasksToDelete.length > 0 && typeof _deps.checkAchievements === 'function') {
            const updatedState = AppState.get();
            _deps.checkAchievements(
                updatedState.userProgress?.cyclesCompleted || 0,
                updatedState.userProgress?.totalTasksCompleted || 0
            );
        }
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
 * @returns {void}
 */
function moveCompletedTasksBack(context, deps) {
    const { taskList, completedTaskList, activeCycle } = context;
    const updateCompletedTasksCount = deps.updateCompletedTasksCount || _deps.updateCompletedTasksCount;
    const AppState = deps.AppState || _deps.AppState;

    if (!completedTaskList || !taskList) return;

    // Move all remaining completed tasks back to main list
    // (deleteWhenComplete recurring tasks were already removed in resetTasksData Step 4)
    const completedTaskElements = completedTaskList.querySelectorAll(DOM_SELECTORS.TASK);
    completedTaskElements.forEach(taskEl => {
        // Clear stale interaction classes before moving back
        taskEl.classList.remove(
            DOM_CLASSES.LONG_PRESSED,
            DOM_CLASSES.DRAGGING,
            DOM_CLASSES.IS_FIRST_TASK,
            DOM_CLASSES.IS_LAST_TASK
        );

        // Reset task options visibility
        const taskOptions = taskEl.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        if (taskOptions) {
            taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
            taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
        }

        // Restore draggable attribute for active list
        taskEl.setAttribute('draggable', 'true');

        taskList.appendChild(taskEl);
    });


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
 * @returns {Promise<void>}
 */
export async function resetTasksImpl(deps = {}) {
    try {
        if (isResetting) return;
        setResettingFlag(true, deps);

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
            setResettingFlag(false, deps);
            return;
        }

        const { activeCycle, cycles } = context;

        // (Former Step 2 — pre-reset snapshot — removed in v2.362.) resetTasks
        // is an EFFECT EXECUTOR, never a gesture origin: every caller reaches it
        // from a gesture that already captured at its own boundary — the
        // checkbox handler (taskCompletion), Complete All (executeCompleteAll),
        // or a mode switch (modeManager). Capturing here as well double-counted
        // the checkbox flow (restoring the all-completed intermediate on first
        // Undo); and once the global isResetting flag was raised, this
        // capture was dead code anyway. The invariant is now uniform:
        // gestures capture, executors don't.

        // Step 3: Animate progress bar fill (delegated to cycleCompletion)
        if (typeof mergedDeps.animateProgressBarFill === 'function') {
            await mergedDeps.animateProgressBarFill();
        }

        // Step 3.5: Spin the logo (coin-flip animation)
        const headerLogo = document.querySelector(DOM_SELECTORS.HEADER_LOGO);
        if (headerLogo) {
            headerLogo.classList.remove(DOM_CLASSES.LOGO_SPIN); // Reset if already spinning
            // Force reflow to restart animation
            void headerLogo.offsetWidth;
            headerLogo.classList.add(DOM_CLASSES.LOGO_SPIN);
            // Remove class after animation completes
            setTimeout(() => headerLogo.classList.remove(DOM_CLASSES.LOGO_SPIN), UI_TIMEOUTS.CLEAR_ANIMATION);
        }

        // Step 4: Perform core data reset
        const result = resetTasksData(context, mergedDeps);
        if (result.aborted) {
            setResettingFlag(false, deps);
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
            // Every reset path (auto cycle AND manual Complete via
            // markAllTasksCompleteImpl → resetTasksFn) funnels through here, so
            // this single re-arm covers both. See the DI schema note.
            _deps.startReminders?.();
        }, TASK_TIMEOUTS.POST_RESET_CLEANUP));

        trackTimeout(setTimeout(() => {
            setResettingFlag(false, deps);
        }, TASK_TIMEOUTS.RESET_LOCK_RELEASE));

    } catch (error) {
        console.warn('Reset tasks failed:', error);
        setResettingFlag(false, deps);
        _deps.showNotification?.(getLabel('notify.taskResetFailed'), 'warning');
    }
}

/**
 * Build the cleared-task record handed to recordMultipleClearedTasks before deletion.
 * Both delete paths — the cycle-reset path and the To-Do "Clear Completed" path — record
 * the same shape; keep it in one place so adding or changing a field can't silently diverge
 * between them. See ARCH REVIEW FINDINGS §2.3. (clearedTasksManager builds a different,
 * richer storage entry from this — not this shape.)
 * @param {Object} task - The live task being cleared
 * @returns {Object} Cleared-task record
 */
function buildClearedRecord(task) {
    return {
        text: task.text,
        highPriority: task.highPriority || false,
        dueDate: task.dueDate,
        priorityColor: task.priorityColor || null,
        remindersEnabled: task.remindersEnabled || false,
        deleteWhenComplete: task.deleteWhenComplete || false,
        deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || null,
        recurring: task.recurring || false,
        recurringSettings: task.recurringSettings || null
    };
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
        // §1.1: read completion from STATE, not the DOM checkbox. The cycle-reset path
        // reads task.completed; this To-Do "Clear Completed" path must match it. Reading the
        // checkbox is a second source of truth — any path that sets completed in state
        // without touching the checkbox (bulk action, async re-render, undo restore) would
        // make Clear Completed delete or skip the wrong tasks. See ARCH REVIEW FINDINGS §1.1.
        const isCompleted = task?.completed === true;

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

    // Partition the batch by recurrence ONCE — both the Cleared Tasks archive and the
    // achievement counter below key off this.
    //
    // A recurring occurrence is not a task the user finished with: it is scheduled to
    // come back. Archiving it offered a "restore" for something that restores itself,
    // and counting it inflated the cleared-task achievement total. Recurring tasks still
    // contribute to CYCLE achievements — that path is untouched.
    //
    // Both exclusions matter and they are separate writes to separate state:
    // `cycle.clearedTasks` (the archive) and `userProgress.totalTasksCompleted` (what
    // achievementsManager reads). Filtering only one leaves the other wrong.
    const isRecurringTask = (taskId) =>
        cycleData.tasks?.find(t => t.id === taskId)?.recurring === true;
    const nonRecurringToDelete = tasksToDelete.filter(({ taskId }) => !isRecurringTask(taskId));
    const recurringDeleteCount = tasksToDelete.length - nonRecurringToDelete.length;

    // Trigger logo scan effect for to-do mode task clearing
    if (typeof _deps.triggerLogoScan === 'function') {
        _deps.triggerLogoScan(500);
    }

    // Record cleared tasks before deleting (for history tracking).
    // Recurring occurrences are excluded — see the partition above.
    const tasksToRecord = nonRecurringToDelete
        .map(({ taskId }) => cycleData.tasks?.find(t => t.id === taskId))
        .filter(Boolean)
        .map(buildClearedRecord);

    // Accept a caller override like the cycle-reset path does (see the sibling
    // `deps.recordMultipleClearedTasks || _deps...` above). This path read only the
    // module-level dep, so a caller-supplied recorder was silently ignored — which also
    // made the archive untestable without mutating module DI, and a test that mocked it
    // via the params object passed while asserting nothing.
    const recordClearedFn = deps.recordMultipleClearedTasks || _deps.recordMultipleClearedTasks;
    if (tasksToRecord.length > 0 && typeof recordClearedFn === 'function') {
        recordClearedFn(tasksToRecord);
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
            taskElement.classList.add(DOM_CLASSES.TASK_CLEARING);
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
            // Update total tasks completed count for achievements.
            // Counts NON-RECURRING clears only — a recurring occurrence is scheduled to
            // return, so counting it inflated the cleared-task milestones. This is the
            // second of the two writes the recurrence partition above governs; the other
            // is the Cleared Tasks archive. Recurring tasks still reach achievements via
            // the cycle-completion path.
            if (!state.userProgress) state.userProgress = {};
            state.userProgress.totalTasksCompleted =
                (state.userProgress.totalTasksCompleted || 0) + nonRecurringToDelete.length;
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
        if (newTotalTasks >= MILESTONES.CELEBRATE_TASKS_500 && !postUpdateState.userProgress?.celebrated500Tasks) {
            _deps.showMilestoneCelebrationOverlay?.('milestoneTrail', 'notify.milestone500Tasks', 'notify.milestone500TasksSubtitle');
            await AppState.update(state => {
                if (!state.userProgress) state.userProgress = {};
                state.userProgress.celebrated500Tasks = true;
            }, true);
        }

        // Check backup reminder (100-task interval)
        _deps.checkBackupReminderOnTaskClear?.();
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

    // The delete-when-complete branch removes tasks without a reset, so the
    // reminder set changed here too — same re-arm taskCRUD does after deletion.
    _deps.startReminders?.();

    return { deleted: taskIdsToDelete.length };
}

/**
 * Mark all tasks as complete and trigger cycle check/reset.
 * @param {Object} cycleData - The cycle data object
 * @param {HTMLElement} taskList - The task list DOM element
 * @param {Function} resetTasksFn - The resetTasks function to call
 * @param {Object} deps - Resolved dependencies
 * @returns {void}
 */
export function markAllTasksCompleteImpl(cycleData, taskList, resetTasksFn, deps = {}) {
    // NOTE: no `if (isResetting) return` guard here. It was redundant with
    // handleCompleteAllTasksImpl's entry guard (the only live caller path), and
    // once executeCompleteAll raises the batch flag around this call, the guard
    // would bail every time — the v2.360 regression that silently killed
    // cycle-mode Complete. Concurrent-click protection stays at the entry guard.

    const checkMiniCycle = deps.checkMiniCycle || _deps.checkMiniCycle;

    // Persist completion to state, not just the DOM. Programmatic .checked
    // writes fire no change event, so without this the completions existed only
    // on screen until the reset ran — a reload (or an aborted reset) in that
    // window dropped them, and state readers (stats, Clear Completed, the new
    // auto-reset completion guard) disagreed with the visible checkboxes.
    const AppState = deps.AppState || _deps.AppState;
    if (AppState?.isReady?.()) {
        AppState.update(state => {
            const cycle = state.data?.cycles?.[state.appState?.activeCycleId];
            if (cycle?.tasks) {
                cycle.tasks.forEach(task => { task.completed = true; });
            }
        });
    }

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
 * @returns {Object|null} { activeCycle, cycleData, taskList } or null if invalid.
 */
function getCompleteAllContext(deps) {
    const querySelector = deps.querySelector || _deps.querySelector || ((sel) => document.querySelector(sel));
    const AppState = deps.AppState || _deps.AppState;

    const taskList = querySelector(`#${DOM_IDS.TASK_LIST}`);

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
 * @returns {Promise<void>}
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
            showClearAnimation: deps.showClearAnimation || _deps.showClearAnimation,
            // Forward so executeCompleteAll can take the gesture-boundary snapshot
            captureStateSnapshot: deps.captureStateSnapshot || _deps.captureStateSnapshot,
            isPerformingUndoRedo: deps.isPerformingUndoRedo || _deps.isPerformingUndoRedo,
            AppGlobalState: deps.AppGlobalState || _deps.AppGlobalState
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
 * @returns {Promise<void>}
 */
async function executeCompleteAll(activeCycle, cycleData, taskList, resetTasksFn, deps) {
    // Gesture-boundary undo snapshot (v2.362): Complete All and Clear Completed
    // are user gestures, so they capture ONE snapshot at entry — here, before
    // any mutation. Everything downstream (mark-all, the delete, the delayed
    // reset) is an EFFECT of this gesture and must not capture (the reset
    // executor no longer does — Step 2 was removed). Without this, both
    // batch ops ran with ZERO snapshots and Undo jumped past the whole batch.
    const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
    const isPerformingUndoRedo = deps.isPerformingUndoRedo || _deps.isPerformingUndoRedo || (() => false);
    if (typeof captureStateSnapshot === 'function' && !isPerformingUndoRedo()) {
        const preBatchState = (deps.AppState || _deps.AppState)?.get?.();
        if (preBatchState) captureStateSnapshot(preBatchState);
    }

    // Raise isResetting around the WHOLE batch so the undo wrapper
    // (wrapAppStateForUndo — captures before EVERY AppState.update, gated by
    // this flag via captureStateSnapshot) stays suppressed for the batch's
    // internal updates. Without it the To-Do path leaked a second snapshot:
    // Clear Completed does two updates — record-cleared (bumps
    // clearedTasks.totalCleared) then delete — and the snapshot signature
    // includes that count (`ct`), so the wrapper's pre-delete capture had a
    // DIFFERENT signature from the gesture capture, dodged dedup, and pushed a
    // phantom intermediate (first Undo restored the tasks but kept the cleared
    // records). v2.363 removed this flag to fix a DIFFERENT bug — that
    // markAllTasksCompleteImpl bailed on `if (isResetting) return` — but that
    // guard is redundant (handleCompleteAllTasksImpl's entry guard is the real
    // concurrent-click protection) and has now been removed, so the flag is
    // safe to restore. The delayed reset fires after this finally clears the
    // flag and raises its own.
    setResettingFlag(true, deps);
    try {
        if (cycleData.deleteCheckedTasks) {
            // To-Do mode: delete completed tasks
            await deleteCompletedTasksImpl(activeCycle, cycleData, taskList, deps);
        } else {
            // Cycle mode: mark all complete and trigger reset
            markAllTasksCompleteImpl(cycleData, taskList, resetTasksFn, deps);
        }
    } finally {
        setResettingFlag(false, deps);
    }
}

// ============================================================================
// MODULE INFO
// ============================================================================

