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
    DATA_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { buildRecurringTemplate } from './recurringTemplate.js';

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
    updateInfoLink: optional(null),
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
 * @returns {void}
 */
export function setRecurringActivationDependencies(overrides = {}) {
    di.setDependencies(overrides);
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
 * @returns {void}
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

    cycle.recurringTemplates[taskId] = buildRecurringTemplate({
        id: taskId,
        text: task?.text || cycle.recurringTemplates[taskId]?.text || getLabel('noun.untitledTask'),
        recurringSettings: structuredClone(normalizedSettings),
        highPriority: task?.highPriority || false,
        priorityColor: task?.priorityColor || null,
        dueDate: task?.dueDate || null,
        remindersEnabled: task?.remindersEnabled || false,
        nextScheduledOccurrence: calculateNextOccurrenceFn(normalizedSettings, Date.now())
    });
}

/**
 * Pure state mutation: Remove recurring state from a task and delete its template.
 * Call inside an updateAppState callback on the draft cycle.
 * Does NOT delete recurringSettings — preserves them so re-activating remembers config.
 *
 * @param {Object} cycle - Draft cycle object (mutated in place)
 * @param {string} taskId - Task ID to deactivate
 * @param {string} currentMode - 'todo' or 'cycle'
 * @returns {void}
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
 * @returns {Promise<void>}
 */
export async function handleRecurringTaskActivation(task, taskContext, button = null) {
    const { assignedTaskId, currentCycle, settings } = taskContext;

    assertInjected('querySelector', Deps.querySelector);
    assertInjected('normalizeRecurringSettings', Deps.normalizeRecurringSettings);
    assertInjected('calculateNextOccurrence', Deps.calculateNextOccurrence);
    const taskItem = Deps.querySelector(DATA_SELECTORS.elementByTaskId(assignedTaskId));

    const defaultSettings = settings.defaultRecurringSettings || {
        frequency: "daily",
        indefinitely: true,
        time: null
    };

    // Use existing settings if task was previously recurring, otherwise defaults.
    // One-door migration (v2.361): computed into a LOCAL — the old code wrote
    // task.recurringSettings/task.schemaVersion onto the live get() object as a
    // scratch carrier before the producer ran; activateTaskRecurringState sets
    // both properly on the draft, so the pre-producer writes were aliasing-only.
    const normalizedSettings = Deps.normalizeRecurringSettings(structuredClone(
        (task.recurringSettings && Object.keys(task.recurringSettings).length > 0)
            ? task.recurringSettings
            : defaultSettings
    ));

    // Commit state FIRST (single source of truth), then sync DOM
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
            normalizedSettings,
            Deps.calculateNextOccurrence
        );
    }, true);

    // Update DOM AFTER state is committed (prevents desync if state update fails)
    if (taskItem) {
        taskItem.setAttribute(DATA_SELECTORS.ATTR_RECURRING_SETTINGS, JSON.stringify(normalizedSettings));
        taskItem.classList.add(DOM_CLASSES.RECURRING);
    }

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

    // Show notification
    const frequency = normalizedSettings?.frequency || 'daily';
    const pattern = normalizedSettings?.indefinitely ? getLabel('recurring.patternIndefinitely') : getLabel('recurring.patternLimited');

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
            const notification = Deps.showNotification(notificationContent, "recurring", UI_TIMEOUTS.NOTIFICATION_OVERLAY);
            if (notification && Deps.notifications.initRecurringNotificationListeners) {
                Deps.notifications.initRecurringNotificationListeners(notification);
            }
        }
    } else {
        assertInjected('showNotification', Deps.showNotification);
        Deps.showNotification(`✅ ${getLabel('notify.taskSetRecurring', { vars: { frequency } })}`, "success", UI_TIMEOUTS.NOTIFICATION_SLOW);
    }

    // Restart watcher at active interval since a template was created
    Deps.restartRecurringWatcher?.();

    // Update panel button visibility and info link
    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        setTimeout(() => {
            Deps.updatePanelButtonVisibility();
            Deps.updateInfoLink?.();
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
 * @returns {Promise<void>}
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
        taskItem.removeAttribute(DATA_SELECTORS.ATTR_RECURRING_SETTINGS);
        taskItem.classList.remove(DOM_CLASSES.RECURRING);

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
    Deps.showNotification(`↩️ ${getLabel('notify.recurringTurnedOff')}`, "info", UI_TIMEOUTS.NOTIFICATION_SHORT);

    if (Deps.updatePanelButtonVisibility && typeof Deps.updatePanelButtonVisibility === 'function') {
        Deps.updatePanelButtonVisibility();
    }
    Deps.updateInfoLink?.();
}

// ============================================================================
// SETTINGS APPLICATION
// ============================================================================

/**
 * Apply recurring settings to a task (Schema 2.5)
 * @param {string} taskId - The task ID
 * @param {Object} newSettings - New recurring settings to apply
 * @returns {Promise<void>}
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

    // Merge new settings with existing, then normalize
    const mergedSettings = { ...task.recurringSettings, ...newSettings };
    const normalizedSettings = Deps.normalizeRecurringSettings
        ? Deps.normalizeRecurringSettings(mergedSettings)
        : mergedSettings;

    // Delegate to the canonical activation function (single source of truth
    // for task + template state shape)
    await Deps.updateAppState(draft => {
        const cycle = draft.data.cycles[activeCycleId];
        activateTaskRecurringState(cycle, taskId, normalizedSettings, Deps.calculateNextOccurrence);
    }, true);

    // Re-read task from updated state (the `task` variable above holds pre-update data)
    const updatedState = Deps.AppState.get();
    const updatedCycle = updatedState.data?.cycles?.[activeCycleId];
    const updatedTask = updatedCycle?.tasks?.find(t => t.id === taskId);

    // Update DOM
    assertInjected('querySelector', Deps.querySelector);
    const taskElement = Deps.querySelector(DATA_SELECTORS.elementByTaskId(taskId));
    if (taskElement) {
        taskElement.classList.add(DOM_CLASSES.RECURRING);
        taskElement.setAttribute(DATA_SELECTORS.ATTR_RECURRING_SETTINGS, JSON.stringify(updatedTask?.recurringSettings || task.recurringSettings));
        const recurringBtn = taskElement.querySelector(DOM_SELECTORS.RECURRING_BTN);
        if (recurringBtn) {
            recurringBtn.classList.add(DOM_CLASSES.ACTIVE);
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
    Deps.updateInfoLink?.();

    // Restart watcher at active interval since a template was created/updated
    Deps.restartRecurringWatcher?.();

}

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Delete a recurring template
 * @param {string} taskId - The task ID
 * @returns {Promise<void>}
 */
export async function deleteRecurringTemplate(taskId) {

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

}

/**
 * PLAN the recurring-task removal for a cycle reset: performs the DOM effects
 * (element removal / checkbox unchecks) and computes the state changes, but
 * does NOT touch state. One-door migration (v2.361): this function previously
 * spliced tasks, flipped flags, and advanced templates directly on the LIVE
 * AppState object the caller handed in — while its docstring claimed the
 * argument was "not a live AppState reference". The caller applies the
 * returned plan inside its reset producer, so the mutations are dirty-marked,
 * listener-visible, and undo-consistent.
 *
 * @param {Array} taskElements - Array of task DOM elements
 * @param {Object} cycleData - Current cycle data (READ ONLY here)
 * @returns {{removedIds: string[], keptIds: string[], templateUpdates: Object}}
 *   templateUpdates maps taskId → { nextScheduledOccurrence, lastTriggeredTimestamp }
 */
export function removeRecurringTasksFromCycle(taskElements, cycleData) {
    const plan = { removedIds: [], keptIds: [], templateUpdates: {} };

    taskElements.forEach(taskEl => {
        const taskId = taskEl.dataset.taskId;
        const isRecurring = taskEl.classList.contains(DOM_CLASSES.RECURRING);

        if (isRecurring) {
            const task = cycleData?.tasks?.find(t => t.id === taskId);
            const shouldDelete = task?.deleteWhenComplete !== false;

            if (!shouldDelete) {
                const checkbox = taskEl.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
                if (checkbox) checkbox.checked = false;
                plan.keptIds.push(taskId);
                return;
            }

            // Remove from DOM (state removal happens in the caller's producer)
            taskEl.remove();
            plan.removedIds.push(taskId);

            // Compute the template advance here (calculation lives with the
            // recurring domain); the producer applies the plain values.
            if (cycleData?.recurringTemplates?.[taskId]) {
                const template = cycleData.recurringTemplates[taskId];
                plan.templateUpdates[taskId] = {
                    nextScheduledOccurrence: Deps.calculateNextOccurrence(
                        template.recurringSettings,
                        Date.now()
                    ),
                    lastTriggeredTimestamp: null
                };
            }
        }
    });

    // Update progress bar
    if (plan.removedIds.length > 0 && Deps.updateProgressBar) {
        Deps.updateProgressBar();
    }

    return plan;
}

/**
 * Handle recurring tasks after cycle reset
 */
export function handleRecurringTasksAfterReset() {

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

}

