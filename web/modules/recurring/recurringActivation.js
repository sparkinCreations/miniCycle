/**
 * miniCycle Recurring Tasks - Activation & Template Management
 *
 * Handles activating/deactivating recurring tasks, applying settings,
 * and managing recurring templates.
 *
 * @module recurringActivation
 */

import { createDIModule, optional } from '../core/diBase.js';
import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS,
    DOM_SELECTORS,
    DATA_SELECTORS
} from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringActivation', {
    AppState: optional(null),
    updateAppState: optional(null),
    showNotification: optional(null),
    showNotificationWithTip: optional(null),
    notifications: optional(null),
    querySelector: optional(null),
    updateRecurringPanel: optional(null),
    updateRecurringSummary: optional(null),
    updatePanelButtonVisibility: optional(null),
    updateProgressBar: optional(null),
    GlobalUtils: optional(null),
    // Functions from sibling modules (injected to avoid circular imports)
    normalizeRecurringSettings: optional(null),
    calculateNextOccurrence: optional(null),
    restartRecurringWatcher: optional(null)
});

// Late-binding deps via Proxy
const Deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Configure dependencies for the activation module
 * @param {Object} overrides - Dependency overrides
 */
export function setRecurringActivationDependencies(overrides = {}) {
    di.setDependencies(overrides);
    console.log('🔧 RecurringActivation dependencies configured');
}

/**
 * Ensure a dependency is available
 */
function assertInjected(name, value) {
    if (value == null) {
        throw new Error(`recurringActivation: missing required dependency '${name}'. Call setRecurringActivationDependencies() first.`);
    }
}

// ============================================================================
// SHARED STATE MUTATION HELPERS (Pure functions - no DI, no DOM)
// ============================================================================

/**
 * Pure state mutation: Apply recurring state to a task and create its template.
 * Call inside an updateAppState callback on the draft cycle.
 *
 * @param {Object} cycle - Draft cycle object (mutated in place)
 * @param {string} taskId - Task ID to activate
 * @param {Object} normalizedSettings - Already-normalized recurring settings
 * @param {Function} calculateNextOccurrenceFn - Function to calculate next occurrence
 */
export function activateTaskRecurringState(cycle, taskId, normalizedSettings, calculateNextOccurrenceFn) {
    const task = cycle.tasks.find(t => t.id === taskId);
    if (task) {
        task.recurring = true;
        task.recurringSettings = structuredClone(normalizedSettings);
        task.schemaVersion = 2;
        task.deleteWhenComplete = true;
        task.deleteWhenCompleteSettings = { ...DEFAULT_RECURRING_DELETE_SETTINGS };
    }

    if (!cycle.recurringTemplates) {
        cycle.recurringTemplates = {};
    }

    cycle.recurringTemplates[taskId] = {
        id: taskId,
        text: task?.text || cycle.recurringTemplates[taskId]?.text || 'Untitled Task',
        recurring: true,
        recurringSettings: structuredClone(normalizedSettings),
        highPriority: task?.highPriority || false,
        dueDate: task?.dueDate || null,
        remindersEnabled: task?.remindersEnabled || false,
        deleteWhenComplete: true,
        deleteWhenCompleteSettings: { ...DEFAULT_RECURRING_DELETE_SETTINGS },
        lastTriggeredTimestamp: null,
        nextScheduledOccurrence: calculateNextOccurrenceFn(normalizedSettings, Date.now()),
        schemaVersion: 2
    };
}

/**
 * Pure state mutation: Remove recurring state from a task and delete its template.
 * Call inside an updateAppState callback on the draft cycle.
 * Does NOT delete recurringSettings — preserves them so re-activating remembers config.
 *
 * @param {Object} cycle - Draft cycle object (mutated in place)
 * @param {string} taskId - Task ID to deactivate
 * @param {string} currentMode - 'todo' or 'cycle'
 */
export function deactivateTaskRecurringState(cycle, taskId, currentMode) {
    const task = cycle.tasks.find(t => t.id === taskId);
    if (task) {
        task.recurring = false;
        task.schemaVersion = 2;
        task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
        task.deleteWhenComplete = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS[currentMode];
    }

    if (cycle.recurringTemplates?.[taskId]) {
        delete cycle.recurringTemplates[taskId];
    }
}

// ============================================================================
// TASK ACTIVATION
// ============================================================================

/**
 * Activate recurring for a task
 * @param {Object} task - The task object to make recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle, settings
 * @param {HTMLElement} button - The recurring button element (optional)
 */
export async function handleRecurringTaskActivation(task, taskContext, button = null) {
    const { assignedTaskId, currentCycle, settings } = taskContext;

    assertInjected('querySelector', Deps.querySelector);
    const taskItem = Deps.querySelector(DATA_SELECTORS.elementByTaskId(assignedTaskId));

    const defaultSettings = settings.defaultRecurringSettings || {
        frequency: "daily",
        indefinitely: true,
        time: null
    };

    // Use existing settings if task was previously recurring, otherwise use defaults
    if (!task.recurringSettings || Object.keys(task.recurringSettings).length === 0) {
        task.recurringSettings = Deps.normalizeRecurringSettings(structuredClone(defaultSettings));
    } else {
        task.recurringSettings = Deps.normalizeRecurringSettings(structuredClone(task.recurringSettings));
    }

    // Update DOM if element exists
    if (taskItem) {
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        taskItem.classList.add("recurring");
    }

    task.schemaVersion = 2;

    // Update task AND template in AppState
    assertInjected('updateAppState', Deps.updateAppState);
    await Deps.updateAppState(draft => {
        const activeCycleId = draft.appState?.activeCycleId;
        const currentCycleInState = draft.data?.cycles?.[activeCycleId];

        if (!currentCycleInState) {
            console.warn('⚠️ No active cycle found in AppState for template creation');
            return;
        }

        activateTaskRecurringState(
            currentCycleInState,
            assignedTaskId,
            task.recurringSettings,
            Deps.calculateNextOccurrence
        );
    }, true);

    // Sync DOM for delete-on-complete state
    if (taskItem && Deps.GlobalUtils?.syncTaskDeleteWhenCompleteDOM) {
        const currentMode = currentCycle?.deleteCheckedTasks ? 'todo' : 'cycle';
        Deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            taskItem,
            {
                deleteWhenComplete: true,
                deleteWhenCompleteSettings: { ...DEFAULT_RECURRING_DELETE_SETTINGS }
            },
            currentMode,
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );
    }

    console.log('✅ Recurring template created via AppState:', {
        taskId: assignedTaskId,
        taskText: task.text,
        settings: task.recurringSettings
    });

    // Show notification
    const frequency = task.recurringSettings?.frequency || 'daily';
    const pattern = task.recurringSettings?.indefinitely ? 'Indefinitely' : 'Limited';

    if (Deps.notifications?.createRecurringNotificationWithTip) {
        const notificationContent = Deps.notifications.createRecurringNotificationWithTip(assignedTaskId, frequency, pattern, task.text);

        if (Deps.showNotificationWithTip) {
            // ✅ Pass trusted: true because createRecurringNotificationWithTip already escapes user content (task.text)
            const notification = Deps.showNotificationWithTip(notificationContent, "recurring", 10000, 'recurring-cycle-explanation', { trusted: true });
            if (notification && Deps.notifications.initRecurringNotificationListeners) {
                Deps.notifications.initRecurringNotificationListeners(notification);
            }
        } else {
            assertInjected('showNotification', Deps.showNotification);
            const notification = Deps.showNotification(notificationContent, "recurring", 10000);
            if (notification && Deps.notifications.initRecurringNotificationListeners) {
                Deps.notifications.initRecurringNotificationListeners(notification);
            }
        }
    } else {
        assertInjected('showNotification', Deps.showNotification);
        Deps.showNotification(`✅ Task set to recurring (${frequency})`, "success", 5000);
    }

    console.log('✅ Task activated as recurring:', assignedTaskId);

    // Restart watcher at active interval since a template was created
    Deps.restartRecurringWatcher?.();

    // Update panel button visibility
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        setTimeout(() => {
            Deps.updatePanelButtonVisibility();
        }, 100);
    }
}

// ============================================================================
// TASK DEACTIVATION
// ============================================================================

/**
 * Deactivate recurring for a task
 * @param {Object} task - The task object to make non-recurring
 * @param {Object} taskContext - Context containing taskId, currentCycle
 * @param {string} assignedTaskId - The task ID
 */
export async function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId) {
    assertInjected('querySelector', Deps.querySelector);
    assertInjected('updateAppState', Deps.updateAppState);
    assertInjected('AppState', Deps.AppState);

    if (!Deps.AppState?.isReady?.()) {
        console.warn('⚠️ AppState not ready for handleRecurringTaskDeactivation');
        return;
    }

    const state = Deps.AppState?.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for handleRecurringTaskDeactivation');
        return;
    }

    const taskItem = Deps.querySelector(DATA_SELECTORS.elementByTaskId(assignedTaskId));

    // Get current mode
    const currentCycle = state.data?.cycles?.[activeCycleId];
    const isToDoMode = currentCycle?.deleteCheckedTasks === true;
    const currentMode = isToDoMode ? 'todo' : 'cycle';

    // Update via AppState
    await Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];

        deactivateTaskRecurringState(cycle, assignedTaskId, currentMode);

        // Fallback: ensure task stays in main array even if not found
        const targetTask = cycle.tasks.find(t => t.id === assignedTaskId);
        if (!targetTask) {
            console.warn('⚠️ Task missing from main array, re-adding:', assignedTaskId);
            cycle.tasks.push({
                ...task,
                recurring: false,
                recurringSettings: task.recurringSettings || {},
                deleteWhenCompleteSettings: { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS },
                deleteWhenComplete: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS[currentMode],
                schemaVersion: 2
            });
        }
    }, true);

    // Update DOM
    if (taskItem) {
        taskItem.removeAttribute("data-recurring-settings");
        taskItem.classList.remove("recurring");

        if (Deps.GlobalUtils?.syncTaskDeleteWhenCompleteDOM) {
            Deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
                taskItem,
                {
                    deleteWhenComplete: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS[currentMode],
                    deleteWhenCompleteSettings: { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
                },
                currentMode,
                { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
            );
        }
    }

    assertInjected('showNotification', Deps.showNotification);
    Deps.showNotification("↩️ Recurring turned off for this task.", "info", 2000);

    console.log('✅ Task deactivated from recurring:', assignedTaskId);

    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }
}

// ============================================================================
// SETTINGS APPLICATION
// ============================================================================

/**
 * Apply recurring settings to a task (Schema 2.5)
 * @param {string} taskId - The task ID
 * @param {Object} newSettings - New recurring settings to apply
 */
export async function applyRecurringToTaskSchema25(taskId, newSettings) {
    assertInjected('AppState', Deps.AppState);
    assertInjected('updateAppState', Deps.updateAppState);

    if (!Deps.AppState?.isReady?.()) {
        console.warn('⚠️ AppState not ready for applyRecurringToTaskSchema25');
        return;
    }

    const state = Deps.AppState?.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for applyRecurringToTaskSchema25');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.error('❌ Cycle data not found for applyRecurringToTaskSchema25');
        return;
    }

    let task = cycleData.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('❌ Task not found for applyRecurringToTaskSchema25:', taskId);
        return;
    }

    // Update via AppState
    await Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        const targetTask = cycle.tasks.find(t => t.id === taskId);

        if (targetTask) {
            // Merge settings
            targetTask.recurringSettings = {
                ...targetTask.recurringSettings,
                ...newSettings
            };
            targetTask.recurring = true;
            targetTask.schemaVersion = 2;

            // Backfill deleteWhenComplete if missing (tasks activated via older code paths)
            if (targetTask.deleteWhenComplete === undefined) {
                targetTask.deleteWhenComplete = true;
                targetTask.deleteWhenCompleteSettings = { ...DEFAULT_RECURRING_DELETE_SETTINGS };
            }

            // Keep templates in sync
            if (!cycle.recurringTemplates) cycle.recurringTemplates = {};

            const isNewRecurring = !cycle.recurringTemplates[taskId] || !cycle.recurringTemplates[taskId].recurring;

            cycle.recurringTemplates[taskId] = {
                ...(cycle.recurringTemplates[taskId] || {}),
                id: taskId,
                text: targetTask.text,
                recurring: true,
                schemaVersion: 2,
                recurringSettings: { ...targetTask.recurringSettings },
                nextScheduledOccurrence: isNewRecurring ? 0 : Deps.calculateNextOccurrence(targetTask.recurringSettings, Date.now())
            };

            // Backfill deleteWhenComplete on template if missing
            if (cycle.recurringTemplates[taskId].deleteWhenComplete === undefined) {
                cycle.recurringTemplates[taskId].deleteWhenComplete = true;
                cycle.recurringTemplates[taskId].deleteWhenCompleteSettings = { ...DEFAULT_RECURRING_DELETE_SETTINGS };
            }
        }
    }, true);

    // Update DOM
    assertInjected('querySelector', Deps.querySelector);
    const taskElement = Deps.querySelector(DATA_SELECTORS.elementByTaskId(taskId));
    if (taskElement) {
        taskElement.classList.add("recurring");
        taskElement.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
        const recurringBtn = taskElement.querySelector(DOM_SELECTORS.RECURRING_BTN);
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }
    }

    // Update panel displays
    if (Deps.updateRecurringPanel && typeof Deps.updateRecurringPanel === 'function') {
        Deps.updateRecurringPanel();
    }

    if (Deps.updateRecurringSummary && typeof Deps.updateRecurringSummary === 'function') {
        Deps.updateRecurringSummary();
    }

    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }

    // Restart watcher at active interval since a template was created/updated
    Deps.restartRecurringWatcher?.();

    console.log('✅ Recurring settings applied to task:', taskId);
}

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Delete a recurring template
 * @param {string} taskId - The task ID
 */
export async function deleteRecurringTemplate(taskId) {
    console.log('🗑️ Deleting recurring template (AppState-based)...');

    assertInjected('updateAppState', Deps.updateAppState);
    assertInjected('AppState', Deps.AppState);

    if (!Deps.AppState?.isReady?.()) {
        console.warn('⚠️ AppState not ready for deleteRecurringTemplate');
        return;
    }

    const state = Deps.AppState?.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for deleteRecurringTemplate');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.error('❌ Cycle data not found for deleteRecurringTemplate');
        return;
    }

    if (!cycleData.recurringTemplates || !cycleData.recurringTemplates[taskId]) {
        console.warn(`⚠ Task "${taskId}" not found in recurring templates.`);
        return;
    }

    await Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        if (cycle?.recurringTemplates?.[taskId]) {
            delete cycle.recurringTemplates[taskId];
        }
    }, true);

    console.log('✅ Recurring template deleted via AppState');
}

/**
 * Remove recurring tasks from cycle during reset
 * @param {Array} taskElements - Array of task DOM elements
 * @param {Object} cycleData - Current cycle data
 */
export function removeRecurringTasksFromCycle(taskElements, cycleData) {
    let removedCount = 0;
    let keptCount = 0;

    taskElements.forEach(taskEl => {
        const taskId = taskEl.dataset.taskId;
        const isRecurring = taskEl.classList.contains("recurring");

        if (isRecurring) {
            const task = cycleData?.tasks?.find(t => t.id === taskId);
            const shouldDelete = task?.deleteWhenComplete !== false;

            if (!shouldDelete) {
                console.log(`📌 Keeping recurring task (deleteWhenComplete=false): ${task?.text || taskId}`);
                const checkbox = taskEl.querySelector("input[type='checkbox']");
                if (checkbox) checkbox.checked = false;
                if (task) task.completed = false;
                keptCount++;
                return;
            }

            // Remove from DOM
            taskEl.remove();
            removedCount++;

            // Remove from tasks array only
            if (cycleData.tasks) {
                const taskIndex = cycleData.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    cycleData.tasks.splice(taskIndex, 1);
                }
            }

            // Recalculate nextScheduledOccurrence
            if (cycleData.recurringTemplates && cycleData.recurringTemplates[taskId]) {
                const template = cycleData.recurringTemplates[taskId];

                const nextOccurrence = Deps.calculateNextOccurrence(
                    template.recurringSettings,
                    Date.now()
                );

                template.nextScheduledOccurrence = nextOccurrence;
                template.lastTriggeredTimestamp = null;

                console.log(`✅ Recalculated nextScheduledOccurrence for "${template.text}":`,
                    new Date(nextOccurrence || 0).toLocaleString());
            }
        }
    });

    // Update progress bar
    if (removedCount > 0 && Deps.updateProgressBar) {
        Deps.updateProgressBar();
        console.log(`✅ Progress bar updated after removing ${removedCount} recurring task(s)`);
    }

    if (keptCount > 0) {
        console.log(`📌 Kept ${keptCount} recurring task(s) with deleteWhenComplete=false`);
    }
}

/**
 * Handle recurring tasks after cycle reset
 */
export function handleRecurringTasksAfterReset() {
    console.log('🔄 Handling recurring tasks after reset (AppState-based)...');

    assertInjected('AppState', Deps.AppState);

    if (!Deps.AppState?.isReady?.()) {
        console.warn('⚠️ AppState not ready for handleRecurringTasksAfterReset');
        return;
    }

    const state = Deps.AppState?.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.error('❌ No active cycle found for handleRecurringTasksAfterReset');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle data found for recurring task reset');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    const templateCount = Object.keys(recurringTemplates).length;

    if (templateCount > 0) {
        console.log(`✅ ${templateCount} recurring templates preserved for future recreation`);
    } else {
        console.log('📋 No recurring templates to preserve');
    }
}

console.log('🔄 RecurringActivation module loaded');
